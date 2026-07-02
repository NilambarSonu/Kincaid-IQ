"""
SEC Financial Statement Data — API Router
Provides endpoints to trigger/monitor ingestion and query the data.
"""

import os
import threading
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
import psycopg2
import psycopg2.extras

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sec", tags=["sec"])

DB_URL = os.environ.get("DATABASE_URL")

_ingest_thread: Optional[threading.Thread] = None
_ingest_lock = threading.Lock()


def get_conn():
    return psycopg2.connect(DB_URL)


def _run_ingestion(quarters=None):
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from backend.scripts.sec_ingest import main as ingest_main
    ingest_main(quarters)


@router.get("/status")
def get_ingest_status():
    """Return ingestion status for all quarters."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT quarter, status, started_at, completed_at,
                       rows_sub, rows_num, rows_tag, rows_pre, error_message
                FROM sec_ingestion_log
                ORDER BY quarter
            """)
            rows = cur.fetchall()

        total_num = 0
        total_sub = 0
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM sec_numeric")
            total_num = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM sec_submissions")
            total_sub = cur.fetchone()[0]

        done_quarters = [r for r in rows if r["status"] == "done"]
        running = any(r["status"] == "running" for r in rows)

        return {
            "is_running": _ingest_thread is not None and _ingest_thread.is_alive(),
            "quarters": [dict(r) for r in rows],
            "summary": {
                "total_quarters_done": len(done_quarters),
                "total_quarters_target": 12,
                "total_filings": total_sub,
                "total_data_points": total_num,
                "running": running,
            },
        }
    finally:
        conn.close()


@router.post("/ingest/start")
def start_ingestion(quarters: Optional[str] = Query(None, description="Comma-separated quarters e.g. 2023q1,2023q2")):
    """Start the SEC data ingestion in the background."""
    global _ingest_thread

    with _ingest_lock:
        if _ingest_thread is not None and _ingest_thread.is_alive():
            return {"status": "already_running", "message": "Ingestion is already in progress"}

        selected = [q.strip() for q in quarters.split(",")] if quarters else None
        _ingest_thread = threading.Thread(
            target=_run_ingestion,
            args=(selected,),
            daemon=True,
        )
        _ingest_thread.start()

    return {
        "status": "started",
        "message": f"Ingestion started for {'all 12 quarters' if not selected else selected}",
    }


@router.get("/filings")
def search_filings(
    q: Optional[str] = Query(None, description="Company name search"),
    form: Optional[str] = Query(None, description="Form type e.g. 10-K, 10-Q"),
    cik: Optional[int] = Query(None, description="CIK number"),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
):
    """Search SEC company filings."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            conditions = []
            params = []
            if q:
                conditions.append("LOWER(name) LIKE LOWER(%s)")
                params.append(f"%{q}%")
            if form:
                conditions.append("form = %s")
                params.append(form.upper())
            if cik:
                conditions.append("cik = %s")
                params.append(cik)

            where = "WHERE " + " AND ".join(conditions) if conditions else ""

            cur.execute(f"""
                SELECT adsh, cik, name, sic, form, period, filed, fy, fp, quarter
                FROM sec_submissions
                {where}
                ORDER BY filed DESC NULLS LAST
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            rows = cur.fetchall()

            cur.execute(f"SELECT COUNT(*) FROM sec_submissions {where}", params)
            total = cur.fetchone()[0]

        return {"total": total, "filings": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.get("/financials/{adsh}")
def get_filing_financials(
    adsh: str,
    tag: Optional[str] = Query(None, description="Filter by XBRL tag"),
    stmt: Optional[str] = Query(None, description="Statement type: BS, IS, CF"),
):
    """Get numeric financial data for a specific filing."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT adsh, cik, name, form, period, filed, fy, fp, quarter
                FROM sec_submissions WHERE adsh = %s
            """, (adsh,))
            sub = cur.fetchone()
            if not sub:
                raise HTTPException(status_code=404, detail="Filing not found")

            conditions = ["n.adsh = %s"]
            params = [adsh]
            if tag:
                conditions.append("n.tag ILIKE %s")
                params.append(f"%{tag}%")
            if stmt:
                conditions.append("p.stmt = %s")
                params.append(stmt.upper())

            join = "LEFT JOIN sec_presentations p ON p.adsh = n.adsh AND p.tag = n.tag" if stmt else ""
            where = "WHERE " + " AND ".join(conditions)

            cur.execute(f"""
                SELECT DISTINCT n.tag, n.version, n.ddate, n.qtrs, n.uom, n.value,
                       t.tlabel, t.crdr, t.iord
                FROM sec_numeric n
                {join}
                LEFT JOIN sec_tags t ON t.tag = n.tag AND t.version = n.version AND t.quarter = n.quarter
                {where}
                ORDER BY n.tag, n.ddate DESC
                LIMIT 1000
            """, params)
            nums = cur.fetchall()

        return {
            "filing": dict(sub),
            "data_points": len(nums),
            "financials": [dict(r) for r in nums],
        }
    finally:
        conn.close()


@router.get("/company/{cik}")
def get_company_financials(
    cik: int,
    tag: str = Query(..., description="XBRL tag e.g. Revenues, Assets, NetIncomeLoss"),
    form: Optional[str] = Query("10-K", description="Form type"),
):
    """Get time-series financial data for a company across all filings."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT n.adsh, n.tag, n.ddate, n.qtrs, n.uom, n.value,
                       s.name, s.form, s.period, s.fy, s.fp
                FROM sec_numeric n
                JOIN sec_submissions s ON s.adsh = n.adsh
                WHERE s.cik = %s
                  AND n.tag ILIKE %s
                  AND (%s IS NULL OR s.form = %s)
                ORDER BY n.ddate DESC
                LIMIT 200
            """, (cik, f"%{tag}%", form, form))
            rows = cur.fetchall()

        return {
            "cik": cik,
            "tag": tag,
            "data_points": len(rows),
            "series": [dict(r) for r in rows],
        }
    finally:
        conn.close()


@router.get("/tags/search")
def search_tags(q: str = Query(..., min_length=2), limit: int = Query(20, le=100)):
    """Search XBRL taxonomy tags."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT DISTINCT ON (tag) tag, version, datatype, crdr, iord, tlabel, doc
                FROM sec_tags
                WHERE LOWER(tag) LIKE LOWER(%s) OR LOWER(tlabel) LIKE LOWER(%s)
                ORDER BY tag
                LIMIT %s
            """, (f"%{q}%", f"%{q}%", limit))
            rows = cur.fetchall()
        return {"tags": [dict(r) for r in rows]}
    finally:
        conn.close()
