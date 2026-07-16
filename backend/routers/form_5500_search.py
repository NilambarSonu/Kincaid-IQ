"""
Kincaid Health — Form 5500 Full Database Search API
Serves the 10-year DOL EBSA Form 5500 dataset (main filings + Schedule A).
"""
import os
import threading
from typing import Optional
from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.database import get_db, engine

router = APIRouter(prefix="/api/f5500", tags=["form5500"])


# ─── Schema setup ─────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS f5500_filings (
    id              SERIAL PRIMARY KEY,
    ack_id          VARCHAR(30),
    form_year       SMALLINT,
    plan_name       VARCHAR(200),
    sponsor_name    VARCHAR(120),
    ein             VARCHAR(9),
    state           VARCHAR(2),
    city            VARCHAR(40),
    business_code   VARCHAR(6),
    participants    INTEGER,
    plan_entity_cd  VARCHAR(1),
    welfare_benefit_codes  VARCHAR(60),
    pension_benefit_codes  VARCHAR(60)
);
CREATE INDEX IF NOT EXISTS idx_f5500_filings_year    ON f5500_filings(form_year);
CREATE INDEX IF NOT EXISTS idx_f5500_filings_ein     ON f5500_filings(ein);
CREATE INDEX IF NOT EXISTS idx_f5500_filings_state   ON f5500_filings(state);
CREATE INDEX IF NOT EXISTS idx_f5500_filings_fts
    ON f5500_filings USING gin(to_tsvector('english', coalesce(plan_name,'') || ' ' || coalesce(sponsor_name,'')));

CREATE TABLE IF NOT EXISTS f5500_schedule_a (
    id                  SERIAL PRIMARY KEY,
    ack_id              VARCHAR(30),
    form_year           SMALLINT,
    ein                 VARCHAR(9),
    carrier_name        VARCHAR(120),
    carrier_ein         VARCHAR(9),
    naic_code           VARCHAR(5),
    broker_commissions  NUMERIC(14,2),
    welfare_premiums    NUMERIC(14,2),
    pension_premiums    NUMERIC(14,2),
    ret_commissions     NUMERIC(14,2),
    is_health           BOOLEAN DEFAULT false,
    is_dental           BOOLEAN DEFAULT false,
    is_vision           BOOLEAN DEFAULT false,
    is_life             BOOLEAN DEFAULT false,
    is_stop_loss        BOOLEAN DEFAULT false,
    is_drug             BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_f5500_scha_year     ON f5500_schedule_a(form_year);
CREATE INDEX IF NOT EXISTS idx_f5500_scha_ein      ON f5500_schedule_a(ein);
CREATE INDEX IF NOT EXISTS idx_f5500_scha_carrier  ON f5500_schedule_a(carrier_name);
CREATE INDEX IF NOT EXISTS idx_f5500_scha_fts
    ON f5500_schedule_a USING gin(to_tsvector('english', coalesce(carrier_name,'')));

CREATE TABLE IF NOT EXISTS f5500_import_log (
    id          SERIAL PRIMARY KEY,
    form_year   SMALLINT NOT NULL,
    file_type   VARCHAR(20) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    rows_imported INTEGER DEFAULT 0,
    error_msg   TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(form_year, file_type)
);
"""


def ensure_tables():
    with engine.connect() as conn:
        conn.execute(text(DDL))
        conn.commit()


# ─── Import trigger ───────────────────────────────────────────────────────────

_import_lock = threading.Lock()


def _run_import(years: list[int], only_sch_a: bool, only_main: bool):
    import subprocess, sys
    year_str = ",".join(str(y) for y in years)
    cmd = [sys.executable, "-m", "backend.scripts.download_5500",
           "--years", year_str]
    if only_sch_a:
        cmd.append("--only-sch-a")
    if only_main:
        cmd.append("--only-main")
    subprocess.run(cmd, cwd="/home/runner/workspace")


@router.post("/import/start")
def start_import(
    years: str = Query(default="2015,2016,2017,2018,2019,2020,2021,2022,2023,2024",
                       description="Comma-separated years to import"),
    only_sch_a: bool = Query(default=False),
    only_main: bool = Query(default=False),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
):
    year_list = [int(y.strip()) for y in years.split(",")]
    # Mark all as pending
    for y in year_list:
        for ft in ([] if only_sch_a else ["F_5500"]) + ([] if only_main else ["F_SCH_A"]):
            db.execute(text("""
                INSERT INTO f5500_import_log (form_year, file_type, status, updated_at)
                VALUES (:y, :ft, 'queued', NOW())
                ON CONFLICT (form_year, file_type) DO UPDATE
                  SET status='queued', updated_at=NOW()
            """), {"y": y, "ft": ft})
    db.commit()
    background_tasks.add_task(_run_import, year_list, only_sch_a, only_main)
    return {"status": "started", "years": year_list}


@router.get("/import/status")
def import_status(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT form_year, file_type, status, rows_imported, error_msg,
               updated_at
        FROM f5500_import_log
        ORDER BY form_year DESC, file_type
    """)).fetchall()

    items = [
        {
            "year": r[0], "fileType": r[1], "status": r[2],
            "rowsImported": r[3] or 0, "error": r[4],
            "updatedAt": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]
    total_rows = sum(i["rowsImported"] for i in items)
    done = sum(1 for i in items if i["status"] == "done")
    active = sum(1 for i in items if i["status"] in ("downloading", "importing"))
    return {
        "items": items,
        "totalRowsImported": total_rows,
        "completedJobs": done,
        "activeJobs": active,
        "totalJobs": len(items),
    }


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    def _q(sql):
        try:
            return db.execute(text(sql)).scalar() or 0
        except Exception:
            return 0

    filing_count = _q("SELECT count(*) FROM f5500_filings")
    scha_count   = _q("SELECT count(*) FROM f5500_schedule_a")
    years        = db.execute(text(
        "SELECT DISTINCT form_year FROM f5500_filings ORDER BY form_year"
    )).fetchall() if filing_count else []
    total_comm   = _q("SELECT sum(broker_commissions) FROM f5500_schedule_a WHERE broker_commissions > 0")
    total_prem   = _q("SELECT sum(welfare_premiums) FROM f5500_schedule_a WHERE welfare_premiums > 0")

    return {
        "filingCount": filing_count,
        "scheduleACount": scha_count,
        "yearsLoaded": [r[0] for r in years],
        "totalBrokerCommissions": float(total_comm),
        "totalWelfarePremiums": float(total_prem),
    }


# ─── Search: Main Filings ─────────────────────────────────────────────────────

@router.get("/search")
def search_filings(
    q: Optional[str] = None,
    ein: Optional[str] = None,
    state: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    min_participants: Optional[int] = None,
    plan_type: Optional[str] = None,   # "welfare" | "pension" | "both"
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    conditions = []
    params: dict = {}

    if q:
        conditions.append(
            "(to_tsvector('english', coalesce(plan_name,'') || ' ' || coalesce(sponsor_name,'')) "
            " @@ plainto_tsquery('english', :q) "
            " OR sponsor_name ILIKE :q_like "
            " OR plan_name ILIKE :q_like)"
        )
        params["q"] = q
        params["q_like"] = f"%{q}%"

    if ein:
        clean = ein.replace("-", "").strip()
        conditions.append("ein = :ein")
        params["ein"] = clean

    if state:
        conditions.append("state = :state")
        params["state"] = state.upper()

    if year_from:
        conditions.append("form_year >= :year_from")
        params["year_from"] = year_from

    if year_to:
        conditions.append("form_year <= :year_to")
        params["year_to"] = year_to

    if min_participants:
        conditions.append("participants >= :min_p")
        params["min_p"] = min_participants

    if plan_type == "welfare":
        conditions.append("welfare_benefit_codes IS NOT NULL AND welfare_benefit_codes != ''")
    elif plan_type == "pension":
        conditions.append("pension_benefit_codes IS NOT NULL AND pension_benefit_codes != ''")

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * limit

    count_sql = f"SELECT count(*) FROM f5500_filings {where}"
    total = db.execute(text(count_sql), params).scalar() or 0

    rows = db.execute(text(f"""
        SELECT ack_id, form_year, plan_name, sponsor_name, ein, state, city,
               participants, welfare_benefit_codes, pension_benefit_codes
        FROM f5500_filings {where}
        ORDER BY form_year DESC, participants DESC NULLS LAST
        LIMIT {limit} OFFSET {offset}
    """), params).fetchall()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": [
            {
                "ackId": r[0], "year": r[1], "planName": r[2],
                "sponsorName": r[3], "ein": r[4], "state": r[5],
                "city": r[6], "participants": r[7],
                "welfareCodes": r[8], "pensionCodes": r[9],
            }
            for r in rows
        ],
    }


# ─── Search: Schedule A (Insurance) ──────────────────────────────────────────

@router.get("/schedule-a")
def search_schedule_a(
    q: Optional[str] = None,       # carrier name search
    ein: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    benefit_type: Optional[str] = None,  # health|dental|vision|life|stop_loss|drug
    min_commission: Optional[float] = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    conditions = []
    params: dict = {}

    if q:
        conditions.append(
            "(to_tsvector('english', coalesce(carrier_name,'')) "
            " @@ plainto_tsquery('english', :q) "
            " OR carrier_name ILIKE :q_like)"
        )
        params["q"] = q
        params["q_like"] = f"%{q}%"

    if ein:
        conditions.append("ein = :ein")
        params["ein"] = ein.replace("-", "").strip()

    if year_from:
        conditions.append("form_year >= :yf"); params["yf"] = year_from
    if year_to:
        conditions.append("form_year <= :yt"); params["yt"] = year_to

    if benefit_type:
        col_map = {
            "health": "is_health", "dental": "is_dental", "vision": "is_vision",
            "life": "is_life", "stop_loss": "is_stop_loss", "drug": "is_drug",
        }
        col = col_map.get(benefit_type.lower())
        if col:
            conditions.append(f"{col} = true")

    if min_commission:
        conditions.append("broker_commissions >= :mc"); params["mc"] = min_commission

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * limit

    total = db.execute(text(f"SELECT count(*) FROM f5500_schedule_a {where}"), params).scalar() or 0

    rows = db.execute(text(f"""
        SELECT ack_id, form_year, ein, carrier_name, carrier_ein, naic_code,
               broker_commissions, welfare_premiums, pension_premiums, ret_commissions,
               is_health, is_dental, is_vision, is_life, is_stop_loss, is_drug
        FROM f5500_schedule_a {where}
        ORDER BY form_year DESC, broker_commissions DESC NULLS LAST
        LIMIT {limit} OFFSET {offset}
    """), params).fetchall()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "results": [
            {
                "ackId": r[0], "year": r[1], "ein": r[2],
                "carrierName": r[3], "carrierEin": r[4], "naicCode": r[5],
                "brokerCommissions": float(r[6] or 0),
                "welfarePremiums": float(r[7] or 0),
                "pensionPremiums": float(r[8] or 0),
                "retCommissions": float(r[9] or 0),
                "benefits": {
                    "health": r[10], "dental": r[11], "vision": r[12],
                    "life": r[13], "stopLoss": r[14], "drug": r[15],
                },
            }
            for r in rows
        ],
    }
