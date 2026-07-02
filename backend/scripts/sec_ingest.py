"""
SEC Financial Statement Data Sets — Ingestion Script
Downloads quarterly ZIP files from SEC DERA and loads them into PostgreSQL.

Data source: https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets
Covers: 2023 Q1 through 2025 Q4 (12 quarters, ~3 years)

Each ZIP contains four TSV files:
  sub.txt   — company/filing submission metadata
  num.txt   — numeric financial values (the big one)
  tag.txt   — XBRL taxonomy tag definitions
  pre.txt   — financial statement presentation structure
"""

import os
import io
import csv
import sys
import time
import zipfile
import logging
import tempfile
import traceback
from datetime import datetime
from typing import Optional

import requests
import psycopg2
import psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger(__name__)

SEC_BASE_URL = "https://www.sec.gov/files/dera/data/financial-statement-data-sets"
USER_AGENT   = "KincaidIQ Financial Platform contact@kincaidrmc.com"
RATE_LIMIT_SLEEP = 2.0  # seconds between requests (SEC allows 10/sec; be conservative)

DB_URL = os.environ.get("DATABASE_URL")

# Quarters to ingest — 3 years back from March 2026
QUARTERS = [
    "2023q1", "2023q2", "2023q3", "2023q4",
    "2024q1", "2024q2", "2024q3", "2024q4",
    "2025q1", "2025q2", "2025q3", "2025q4",
]


def get_conn():
    return psycopg2.connect(DB_URL)


def log_status(conn, quarter: str, status: str, rows=None, error=None):
    now = datetime.utcnow()
    with conn.cursor() as cur:
        if status == "running":
            cur.execute("""
                INSERT INTO sec_ingestion_log (quarter, status, started_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (quarter) DO UPDATE SET status = %s, started_at = %s, error_message = NULL
            """, (quarter, status, now, status, now))
        elif status in ("done", "error"):
            r = rows or {}
            cur.execute("""
                INSERT INTO sec_ingestion_log (quarter, status, completed_at, rows_sub, rows_num, rows_tag, rows_pre, error_message)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (quarter) DO UPDATE SET
                  status       = EXCLUDED.status,
                  completed_at = EXCLUDED.completed_at,
                  rows_sub     = EXCLUDED.rows_sub,
                  rows_num     = EXCLUDED.rows_num,
                  rows_tag     = EXCLUDED.rows_tag,
                  rows_pre     = EXCLUDED.rows_pre,
                  error_message = EXCLUDED.error_message
            """, (quarter, status, now,
                  r.get("sub", 0), r.get("num", 0), r.get("tag", 0), r.get("pre", 0),
                  error))
    conn.commit()


def already_done(conn, quarter: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM sec_ingestion_log WHERE quarter = %s", (quarter,))
        row = cur.fetchone()
        return row is not None and row[0] == "done"


def download_zip(quarter: str) -> Optional[str]:
    """Download zip to a temp file and return the path (caller must delete)."""
    url = f"{SEC_BASE_URL}/{quarter}.zip"
    log.info(f"  Downloading {url}")
    headers = {"User-Agent": USER_AGENT}

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip", prefix=f"sec_{quarter}_")
    try:
        r = requests.get(url, headers=headers, timeout=300, stream=True)
        if r.status_code == 404:
            log.warning(f"  {quarter}.zip not found (404) — skipping")
            tmp.close()
            os.unlink(tmp.name)
            return None
        r.raise_for_status()
        total = 0
        for chunk in r.iter_content(chunk_size=1_048_576):
            tmp.write(chunk)
            total += len(chunk)
        tmp.close()
        log.info(f"  Downloaded {total / 1_048_576:.1f} MB → {tmp.name}")
        return tmp.name
    except Exception:
        tmp.close()
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
        raise


def safe_bool(val: str) -> Optional[bool]:
    if val is None or val.strip() == "":
        return None
    return val.strip().lower() in ("1", "true", "t", "yes")


def safe_int(val: str) -> Optional[int]:
    try:
        return int(val.strip()) if val and val.strip() != "" else None
    except (ValueError, AttributeError):
        return None


def safe_float(val: str) -> Optional[float]:
    try:
        return float(val.strip()) if val and val.strip() != "" else None
    except (ValueError, AttributeError):
        return None


def ingest_sub(conn, reader, quarter: str) -> int:
    rows = []
    for row in reader:
        rows.append((
            row.get("adsh", "").strip() or None,
            safe_int(row.get("cik", "")),
            row.get("name", "").strip()[:255] or None,
            safe_int(row.get("sic", "")),
            row.get("countryba", "").strip()[:3] or None,
            row.get("stprba", "").strip()[:2] or None,
            row.get("cityba", "").strip()[:100] or None,
            row.get("zipba", "").strip()[:20] or None,
            row.get("bas1", "").strip()[:255] or None,
            row.get("bas2", "").strip()[:255] or None,
            row.get("baph", "").strip()[:30] or None,
            row.get("countryma", "").strip()[:3] or None,
            row.get("stprma", "").strip()[:2] or None,
            row.get("cityma", "").strip()[:100] or None,
            row.get("zipma", "").strip()[:20] or None,
            row.get("countryinc", "").strip()[:3] or None,
            row.get("stprinc", "").strip()[:2] or None,
            row.get("ein", "").strip()[:15] or None,
            row.get("accepted", "").strip() or None,
            safe_int(row.get("period", "")),
            safe_int(row.get("fy", "")),
            row.get("fp", "").strip()[:2] or None,
            row.get("form", "").strip()[:20] or None,
            safe_int(row.get("filed", "")),
            row.get("fye", "").strip()[:4] or None,
            safe_bool(row.get("prevrpt", "")),
            safe_bool(row.get("detail", "")),
            row.get("instance", "").strip()[:255] or None,
            safe_int(row.get("nciks", "")),
            row.get("aciks", "").strip()[:255] or None,
            quarter,
        ))

    if not rows:
        return 0

    with conn.cursor() as cur:
        cur.execute("DELETE FROM sec_submissions WHERE quarter = %s", (quarter,))
        psycopg2.extras.execute_values(cur, """
            INSERT INTO sec_submissions (
              adsh, cik, name, sic, countryba, stprba, cityba, zipba,
              bas1, bas2, baph, countryma, stprma, cityma, zipma,
              countryinc, stprinc, ein, accepted, period, fy, fp, form,
              filed, fye, prevrpt, detail, instance, nciks, aciks, quarter
            ) VALUES %s
            ON CONFLICT (adsh) DO UPDATE SET
              cik = EXCLUDED.cik, name = EXCLUDED.name,
              period = EXCLUDED.period, form = EXCLUDED.form,
              filed = EXCLUDED.filed, quarter = EXCLUDED.quarter
        """, rows, page_size=2000)
    conn.commit()
    return len(rows)


def ingest_num(conn, reader, quarter: str) -> int:
    count = 0
    batch = []
    BATCH = 5000

    with conn.cursor() as cur:
        cur.execute("DELETE FROM sec_numeric WHERE quarter = %s", (quarter,))
    conn.commit()

    for row in reader:
        batch.append((
            row.get("adsh", "").strip() or None,
            row.get("tag", "").strip()[:200] or None,
            row.get("version", "").strip()[:50] or None,
            row.get("coreg", "").strip()[:256] or None,
            safe_int(row.get("ddate", "")),
            safe_int(row.get("qtrs", "")) or 0,
            row.get("uom", "").strip()[:50] or None,
            safe_float(row.get("value", "")),
            row.get("footnote", "").strip()[:500] or None,
            quarter,
        ))
        if len(batch) >= BATCH:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO sec_numeric (adsh, tag, version, coreg, ddate, qtrs, uom, value, footnote, quarter)
                    VALUES %s
                """, batch, page_size=BATCH)
            conn.commit()
            count += len(batch)
            batch = []

    if batch:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, """
                INSERT INTO sec_numeric (adsh, tag, version, coreg, ddate, qtrs, uom, value, footnote, quarter)
                VALUES %s
            """, batch, page_size=len(batch))
        conn.commit()
        count += len(batch)

    return count


def ingest_tag(conn, reader, quarter: str) -> int:
    rows = []
    for row in reader:
        rows.append((
            row.get("tag", "").strip()[:200] or None,
            row.get("version", "").strip()[:50] or None,
            safe_bool(row.get("custom", "")),
            safe_bool(row.get("abstract", "")),
            row.get("datatype", "").strip()[:50] or None,
            row.get("iord", "").strip()[:1] or None,
            row.get("crdr", "").strip()[:1] or None,
            row.get("tlabel", "").strip() or None,
            row.get("doc", "").strip() or None,
            quarter,
        ))

    if not rows:
        return 0

    with conn.cursor() as cur:
        cur.execute("DELETE FROM sec_tags WHERE quarter = %s", (quarter,))
        psycopg2.extras.execute_values(cur, """
            INSERT INTO sec_tags (tag, version, custom, abstract, datatype, iord, crdr, tlabel, doc, quarter)
            VALUES %s
            ON CONFLICT (tag, version, quarter) DO NOTHING
        """, rows, page_size=2000)
    conn.commit()
    return len(rows)


def ingest_pre(conn, reader, quarter: str) -> int:
    count = 0
    batch = []
    BATCH = 5000

    with conn.cursor() as cur:
        cur.execute("DELETE FROM sec_presentations WHERE quarter = %s", (quarter,))
    conn.commit()

    for row in reader:
        batch.append((
            row.get("adsh", "").strip() or None,
            safe_int(row.get("report", "")),
            safe_int(row.get("line", "")),
            row.get("stmt", "").strip()[:2] or None,
            safe_bool(row.get("inpth", "")),
            row.get("rfile", "").strip()[:1] or None,
            row.get("tag", "").strip()[:200] or None,
            row.get("version", "").strip()[:50] or None,
            row.get("prole", "").strip()[:50] or None,
            row.get("plabel", "").strip() or None,
            safe_bool(row.get("negating", "")),
            quarter,
        ))
        if len(batch) >= BATCH:
            with conn.cursor() as cur:
                psycopg2.extras.execute_values(cur, """
                    INSERT INTO sec_presentations (adsh, report, line, stmt, inpth, rfile, tag, version, prole, plabel, negating, quarter)
                    VALUES %s
                """, batch, page_size=BATCH)
            conn.commit()
            count += len(batch)
            batch = []

    if batch:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(cur, """
                INSERT INTO sec_presentations (adsh, report, line, stmt, inpth, rfile, tag, version, prole, plabel, negating, quarter)
                VALUES %s
            """, batch, page_size=len(batch))
        conn.commit()
        count += len(batch)

    return count


def process_zip(conn, zip_path: str, quarter: str) -> dict:
    counts = {"sub": 0, "num": 0, "tag": 0, "pre": 0}

    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        log.info(f"  ZIP contents: {names}")

        for fname in names:
            key = None
            if fname.endswith("sub.txt"):
                key = "sub"
            elif fname.endswith("num.txt"):
                key = "num"
            elif fname.endswith("tag.txt"):
                key = "tag"
            elif fname.endswith("pre.txt"):
                key = "pre"
            else:
                continue

            log.info(f"  Ingesting {fname} ({key}) ...")
            t0 = time.time()
            with zf.open(fname) as f:
                text = io.TextIOWrapper(f, encoding="utf-8", errors="replace")
                reader = csv.DictReader(text, delimiter="\t")
                if key == "sub":
                    counts["sub"] = ingest_sub(conn, reader, quarter)
                elif key == "num":
                    counts["num"] = ingest_num(conn, reader, quarter)
                elif key == "tag":
                    counts["tag"] = ingest_tag(conn, reader, quarter)
                elif key == "pre":
                    counts["pre"] = ingest_pre(conn, reader, quarter)

            elapsed = time.time() - t0
            log.info(f"  {fname}: {counts[key]:,} rows in {elapsed:.1f}s")

    return counts


def ingest_quarter(conn, quarter: str) -> bool:
    if already_done(conn, quarter):
        log.info(f"[{quarter}] Already ingested — skipping")
        return True

    log.info(f"[{quarter}] Starting ingestion")
    log_status(conn, quarter, "running")

    zip_path = None
    try:
        zip_path = download_zip(quarter)
        if zip_path is None:
            log_status(conn, quarter, "error", error="ZIP not found (404)")
            return False

        time.sleep(RATE_LIMIT_SLEEP)

        counts = process_zip(conn, zip_path, quarter)
        log_status(conn, quarter, "done", rows=counts)
        log.info(f"[{quarter}] Done — sub:{counts['sub']:,} num:{counts['num']:,} tag:{counts['tag']:,} pre:{counts['pre']:,}")
        return True

    except Exception as e:
        err = traceback.format_exc()
        log.error(f"[{quarter}] FAILED: {e}\n{err}")
        log_status(conn, quarter, "error", error=str(e)[:500])
        return False
    finally:
        if zip_path and os.path.exists(zip_path):
            try:
                os.unlink(zip_path)
                log.info(f"  Cleaned up temp file {zip_path}")
            except Exception:
                pass


def main(quarters=None):
    if not DB_URL:
        log.error("DATABASE_URL not set")
        sys.exit(1)

    target = quarters or QUARTERS
    log.info(f"Starting SEC ingestion for {len(target)} quarters: {target[0]} → {target[-1]}")

    conn = get_conn()
    try:
        ok = 0
        fail = 0
        for q in target:
            success = ingest_quarter(conn, q)
            if success:
                ok += 1
            else:
                fail += 1
            if q != target[-1]:
                time.sleep(RATE_LIMIT_SLEEP)

        log.info(f"Ingestion complete: {ok} succeeded, {fail} failed")
    finally:
        conn.close()


if __name__ == "__main__":
    selected = sys.argv[1:] if len(sys.argv) > 1 else None
    main(selected)
