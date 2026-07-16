"""
Kincaid Health — DOL Form 5500 Bulk Downloader & Importer
Downloads 10 years of Form 5500 (main) + Schedule A from DOL EBSA
and imports into PostgreSQL for full-text search.

Usage:
    python -m backend.scripts.download_5500 --years 2015-2024
    python -m backend.scripts.download_5500 --year 2023
"""
import os
import io
import csv
import sys
import time
import zipfile
import logging
import argparse
import requests
import psycopg2
from datetime import datetime, timezone
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("f5500")

BASE_URL = "https://askebsa.dol.gov/FOIA%20Files/{year}/Latest/{file}_{year}_Latest.zip"

# Columns to extract (name → db column)
F5500_COLS = [
    "ACK_ID", "FORM_PLAN_YEAR_BEGIN_DATE",
    "PLAN_NAME", "SPONSOR_DFE_NAME", "SPONS_DFE_EIN",
    "SPONS_DFE_MAIL_US_STATE", "SPONS_DFE_MAIL_US_CITY",
    "BUSINESS_CODE", "TOT_ACTIVE_PARTCP_CNT",
    "TYPE_PLAN_ENTITY_CD", "TYPE_WELFARE_BNFT_CODE", "TYPE_PENSION_BNFT_CODE",
]

SCH_A_COLS = [
    "ACK_ID", "SCH_A_EIN", "SCH_A_PLAN_YEAR_BEGIN_DATE",
    "INS_CARRIER_NAME", "INS_CARRIER_EIN", "INS_CARRIER_NAIC_CODE",
    "INS_BROKER_COMM_TOT_AMT", "INS_BROKER_FEES_TOT_AMT",
    "PENSION_PREM_PAID_TOT_AMT", "WLFR_PREMIUM_RCVD_AMT",
    "WLFR_BNFT_HEALTH_IND", "WLFR_BNFT_DENTAL_IND", "WLFR_BNFT_VISION_IND",
    "WLFR_BNFT_LIFE_INSUR_IND", "WLFR_BNFT_STOP_LOSS_IND",
    "WLFR_BNFT_DRUG_IND", "WLFR_RET_COMMISSIONS_AMT",
]


def get_db():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def update_log(cur, year: int, file_type: str, status: str,
               rows: int = 0, error: str = None):
    cur.execute("""
        INSERT INTO f5500_import_log (form_year, file_type, status, rows_imported, error_msg, updated_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (form_year, file_type) DO UPDATE
          SET status = EXCLUDED.status,
              rows_imported = EXCLUDED.rows_imported,
              error_msg = EXCLUDED.error_msg,
              updated_at = NOW()
    """, (year, file_type, status, rows, error))


def _safe_int(v: str) -> Optional[int]:
    try:
        return int(float(v)) if v and v.strip() not in ("", "nan") else None
    except (ValueError, TypeError):
        return None


def _safe_float(v: str) -> Optional[float]:
    try:
        return float(v) if v and v.strip() not in ("", "nan") else None
    except (ValueError, TypeError):
        return None


def download_zip(url: str) -> bytes:
    log.info(f"Downloading {url}")
    r = requests.get(url, timeout=120, stream=True)
    r.raise_for_status()
    chunks = []
    for chunk in r.iter_content(chunk_size=1024 * 512):
        chunks.append(chunk)
    return b"".join(chunks)


def extract_csv_from_zip(data: bytes, filename_hint: str) -> io.TextIOWrapper:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        csv_name = next((n for n in names if n.upper().endswith(".CSV")), names[0])
        raw = z.read(csv_name)
    return io.StringIO(raw.decode("latin-1"))


def import_filings(conn, year: int, progress_cb=None) -> int:
    cur = conn.cursor()
    update_log(cur, year, "F_5500", "downloading"); conn.commit()
    try:
        url = BASE_URL.format(year=year, file="F_5500")
        data = download_zip(url)
    except Exception as e:
        update_log(cur, year, "F_5500", "error", error=str(e)); conn.commit()
        raise

    update_log(cur, year, "F_5500", "importing"); conn.commit()
    text_io = extract_csv_from_zip(data, "F_5500")
    reader = csv.DictReader(text_io)

    buf = io.StringIO()
    writer = csv.writer(buf)
    count = 0

    for row in reader:
        try:
            plan_year = row.get("FORM_PLAN_YEAR_BEGIN_DATE", "") or ""
            form_year_val = int(plan_year[:4]) if len(plan_year) >= 4 else year
        except Exception:
            form_year_val = year

        writer.writerow([
            row.get("ACK_ID", "")[:30],
            form_year_val,
            row.get("PLAN_NAME", "")[:200],
            row.get("SPONSOR_DFE_NAME", "")[:120],
            row.get("SPONS_DFE_EIN", "")[:9],
            row.get("SPONS_DFE_MAIL_US_STATE", "")[:2],
            row.get("SPONS_DFE_MAIL_US_CITY", "")[:40],
            row.get("BUSINESS_CODE", "")[:6],
            _safe_int(row.get("TOT_ACTIVE_PARTCP_CNT", "")),
            row.get("TYPE_PLAN_ENTITY_CD", "")[:1],
            row.get("TYPE_WELFARE_BNFT_CODE", "")[:60],
            row.get("TYPE_PENSION_BNFT_CODE", "")[:60],
        ])
        count += 1
        if count % 50_000 == 0:
            log.info(f"  {year} F_5500: {count:,} rows buffered...")

    buf.seek(0)
    cur.execute(f"DELETE FROM f5500_filings WHERE form_year = %s", (year,))
    cur.copy_from(
        buf, "f5500_filings",
        columns=("ack_id","form_year","plan_name","sponsor_name","ein","state","city",
                 "business_code","participants","plan_entity_cd","welfare_benefit_codes","pension_benefit_codes"),
        sep=",", null=""
    )
    update_log(cur, year, "F_5500", "done", rows=count); conn.commit()
    log.info(f"  {year} F_5500: {count:,} rows imported.")
    return count


def import_schedule_a(conn, year: int, progress_cb=None) -> int:
    cur = conn.cursor()
    update_log(cur, year, "F_SCH_A", "downloading"); conn.commit()
    try:
        url = BASE_URL.format(year=year, file="F_SCH_A")
        data = download_zip(url)
    except Exception as e:
        update_log(cur, year, "F_SCH_A", "error", error=str(e)); conn.commit()
        raise

    update_log(cur, year, "F_SCH_A", "importing"); conn.commit()
    text_io = extract_csv_from_zip(data, "F_SCH_A")
    reader = csv.DictReader(text_io)

    buf = io.StringIO()
    writer = csv.writer(buf)
    count = 0

    for row in reader:
        try:
            plan_year = row.get("SCH_A_PLAN_YEAR_BEGIN_DATE", "") or ""
            form_year_val = int(plan_year[:4]) if len(plan_year) >= 4 else year
        except Exception:
            form_year_val = year

        health    = row.get("WLFR_BNFT_HEALTH_IND", "")
        dental    = row.get("WLFR_BNFT_DENTAL_IND", "")
        vision    = row.get("WLFR_BNFT_VISION_IND", "")
        life      = row.get("WLFR_BNFT_LIFE_INSUR_IND", "")
        stop_loss = row.get("WLFR_BNFT_STOP_LOSS_IND", "")
        drug      = row.get("WLFR_BNFT_DRUG_IND", "")

        broker_comm = (_safe_float(row.get("INS_BROKER_COMM_TOT_AMT", "")) or 0) + \
                      (_safe_float(row.get("INS_BROKER_FEES_TOT_AMT", "")) or 0)

        welfare_prem  = _safe_float(row.get("WLFR_PREMIUM_RCVD_AMT", ""))
        pension_prem  = _safe_float(row.get("PENSION_PREM_PAID_TOT_AMT", ""))
        ret_comm      = _safe_float(row.get("WLFR_RET_COMMISSIONS_AMT", ""))

        writer.writerow([
            row.get("ACK_ID", "")[:30],
            form_year_val,
            row.get("SCH_A_EIN", "")[:9],
            (row.get("INS_CARRIER_NAME", "") or "")[:120],
            row.get("INS_CARRIER_EIN", "")[:9],
            row.get("INS_CARRIER_NAIC_CODE", "")[:5],
            broker_comm or "",
            welfare_prem or "",
            pension_prem or "",
            ret_comm or "",
            "1" if health    == "X" else "0",
            "1" if dental    == "X" else "0",
            "1" if vision    == "X" else "0",
            "1" if life      == "X" else "0",
            "1" if stop_loss == "X" else "0",
            "1" if drug      == "X" else "0",
        ])
        count += 1
        if count % 50_000 == 0:
            log.info(f"  {year} F_SCH_A: {count:,} rows buffered...")

    buf.seek(0)
    cur.execute("DELETE FROM f5500_schedule_a WHERE form_year = %s", (year,))
    cur.copy_from(
        buf, "f5500_schedule_a",
        columns=("ack_id","form_year","ein","carrier_name","carrier_ein","naic_code",
                 "broker_commissions","welfare_premiums","pension_premiums","ret_commissions",
                 "is_health","is_dental","is_vision","is_life","is_stop_loss","is_drug"),
        sep=",", null=""
    )
    update_log(cur, year, "F_SCH_A", "done", rows=count); conn.commit()
    log.info(f"  {year} F_SCH_A: {count:,} rows imported.")
    return count


def run(years: list[int], only_sch_a: bool = False, only_main: bool = False):
    conn = get_db()
    for year in years:
        log.info(f"=== Processing year {year} ===")
        if not only_sch_a:
            try:
                import_filings(conn, year)
            except Exception as e:
                log.error(f"  FAILED F_5500 {year}: {e}")
        if not only_main:
            try:
                import_schedule_a(conn, year)
            except Exception as e:
                log.error(f"  FAILED F_SCH_A {year}: {e}")
    conn.close()
    log.info("All done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", default="2015-2024",
                        help="Year range like 2015-2024 or comma list 2022,2023")
    parser.add_argument("--year", type=int, help="Single year override")
    parser.add_argument("--only-sch-a", action="store_true")
    parser.add_argument("--only-main", action="store_true")
    args = parser.parse_args()

    if args.year:
        years = [args.year]
    elif "-" in args.years:
        start, end = args.years.split("-")
        years = list(range(int(start), int(end) + 1))
    else:
        years = [int(y) for y in args.years.split(",")]

    run(years, only_sch_a=args.only_sch_a, only_main=args.only_main)
