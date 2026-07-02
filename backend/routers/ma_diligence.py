from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database import get_db
from backend.duckdb import get_duck
from backend import models
from backend.auth import get_current_user
import re

router = APIRouter(prefix="/api/ma", tags=["ma-diligence"])

def _f(v):
    try: return float(v or 0)
    except: return 0.0

def _ein(e):
    return re.sub(r"[^0-9]", "", str(e or ""))

SECTOR_MAP = {
    "10": "Mining", "15": "Construction", "20": "Food Manufacturing",
    "22": "Textile", "26": "Paper", "28": "Chemicals", "29": "Petroleum",
    "33": "Primary Metal", "34": "Fabricated Metal", "35": "Industrial Machinery",
    "36": "Electronics", "37": "Transportation Equipment", "38": "Instruments",
    "40": "Railroad", "42": "Trucking", "44": "Water Transport",
    "45": "Air Transport", "48": "Communications", "49": "Utilities",
    "50": "Wholesale Trade", "52": "Retail",
    "54": "Professional Services", "55": "Auto Dealers",
    "57": "Hardware/Garden", "58": "Eating & Drinking",
    "60": "Banks & Finance", "61": "Credit", "62": "Securities", "63": "Insurance",
    "70": "Hotels & Lodging", "72": "Personal Services", "73": "Business Services",
    "75": "Auto Repair", "78": "Amusement", "79": "Recreation",
    "80": "Health Services", "82": "Education", "83": "Social Services",
    "87": "Engineering & Management", "89": "Services NEC",
}

def _sector(biz_code):
    if not biz_code: return "Unknown"
    s = str(biz_code)[:2]
    return SECTOR_MAP.get(s, f"Code {biz_code}")


@router.get("/lookup/{ein}")
def lookup_ein(
    ein: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    ein_clean = _ein(ein)
    if len(ein_clean) < 8:
        raise HTTPException(400, "Invalid EIN — must be at least 8 digits")

    duck = get_duck()

    # ── Employer summary from pre-aggregated table ──
    emp = duck.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city,
               latest_year, max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, filing_count, has_health, has_stop_loss
        FROM employers
        WHERE EIN = ?
        LIMIT 1
    """, [ein_clean]).fetchone()

    # ── Per-year plan detail from Schedule H ──
    plan_rows = duck.execute("""
        SELECT FORM_YEAR, PLAN_NAME_LS, PARTICIPANTS,
               TOTAL_INCOME_AMT, WELFARE_PREMIUMS,
               ADMIN_SERVICE_FEES_AMT, BROKER_COMMISSIONS,
               TOT_ASSETS_EOY_AMT, TOT_LIABILITIES_EOY_AMT,
               IS_HEALTH, IS_STOP_LOSS, IS_DRUG,
               CARRIER_NAME, INVEST_MGMT_FEES_AMT, LEGAL_FEES_AMT
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC
        LIMIT 20
    """, [ein_clean]).fetchall()

    if not emp and not plan_rows:
        raise HTTPException(404, f"No Form 5500 records found for EIN {ein_clean}. Verify the EIN and try again.")

    # ── EDGAR lookup for public company data ──
    edgar_data = None
    try:
        edgar_row = db.execute(text("""
            SELECT DISTINCT ON (ein) adsh, name, sic, stprba, cityba, cik, period
            FROM edgar_companies
            WHERE REGEXP_REPLACE(ein,'[^0-9]','','g') = :ein AND form='10-K'
            ORDER BY ein, period DESC LIMIT 1
        """), {"ein": ein_clean}).fetchone()
        if edgar_row:
            edgar_data = {
                "name": edgar_row.name,
                "sic": edgar_row.sic,
                "cik": edgar_row.cik,
                "state": edgar_row.stprba,
                "city": edgar_row.cityba,
                "period": edgar_row.period,
                "sector": _sector(edgar_row.sic),
                "is_public": True,
            }
    except Exception:
        pass

    # ── Derive key metrics ──
    # Prefer employer summary; fall back to plan_rows aggregate
    if emp:
        total_participants = int(_f(emp[6]))          # max_participants
        total_welfare      = round(_f(emp[8]))         # total_welfare_premiums
        filing_count       = int(_f(emp[11]))
        has_health_emp     = bool(emp[12])
        has_stop_loss_emp  = bool(emp[13])
        comp_name          = emp[1] or f"EIN {ein_clean}"
        state_emp          = emp[3] or ""
        city_emp           = emp[4] or ""
        sector_emp         = _sector(emp[7])
    else:
        total_participants = 0
        total_welfare      = 0
        filing_count       = 0
        has_health_emp     = False
        has_stop_loss_emp  = False
        comp_name          = f"EIN {ein_clean}"
        state_emp          = ""
        city_emp           = ""
        sector_emp         = "Unknown"

    # From plan detail rows
    plan_count = len(plan_rows)
    has_stop_loss = has_stop_loss_emp or any(r[10] for r in plan_rows)
    has_drug      = any(r[11] for r in plan_rows)
    has_health    = has_health_emp or any(r[9] for r in plan_rows)
    carriers      = list({r[12] for r in plan_rows if r[12]})

    latest = plan_rows[0] if plan_rows else None
    total_income  = round(_f(latest[3])) if latest else 0
    total_expense = round(total_welfare) if total_welfare else (round(_f(latest[4])) if latest else 0)
    total_assets  = round(_f(latest[7])) if latest else 0
    total_liab    = round(_f(latest[8])) if latest else 0

    # If we got no participants from the employer table, sum latest year's plan rows
    if total_participants == 0 and plan_rows:
        latest_year = plan_rows[0][0]
        yr_plans = [r for r in plan_rows if r[0] == latest_year]
        total_participants = sum(int(_f(r[2])) for r in yr_plans)

    pmpm = round(total_expense / max(total_participants * 12, 1)) if total_expense else 0
    mlr_est = round((total_expense / max(total_income, 1)) * 100, 1) if total_income else 0

    # ── Year-over-year history ──
    year_hist = []
    seen_years: set = set()
    for r in plan_rows:
        yr = int(_f(r[0]))
        if yr in seen_years:
            continue
        seen_years.add(yr)
        yr_plans = [p for p in plan_rows if int(_f(p[0])) == yr]
        year_hist.append({
            "year": yr,
            "participants": sum(int(_f(p[2])) for p in yr_plans),
            "income": round(sum(_f(p[3]) for p in yr_plans)),
            "expense": round(sum(_f(p[4]) for p in yr_plans)),
        })

    # ── Gate scores (deterministic heuristics) ──
    sl_score        = 85 if has_stop_loss else (45 if total_participants > 500 else 68)
    rx_score        = 72 if has_drug else 58
    fiduciary_score = 60
    claims_score    = max(0, min(100, 100 - (mlr_est - 75) * 3)) if mlr_est else 70
    tpa_score       = 72
    integration_score = 55 if filing_count > 3 else 72
    regulatory_score  = 70 if filing_count >= 2 else 52

    overall_score = round(
        sl_score        * 0.20 +
        rx_score        * 0.16 +
        fiduciary_score * 0.18 +
        claims_score    * 0.16 +
        tpa_score       * 0.10 +
        integration_score * 0.10 +
        regulatory_score  * 0.10
    )

    # ── Liability estimates ──
    sl_liability  = 0 if has_stop_loss else max(0, (total_participants - 200) * 450)
    rx_liability  = round(total_participants * 280 * 0.22)
    fid_liability = round(total_expense * 0.04) if total_expense > 0 else round(total_participants * 450)
    total_quantified = sl_liability + rx_liability + fid_liability

    # ── Resolve company identity ──
    company_name = edgar_data["name"] if edgar_data else comp_name
    city  = edgar_data["city"]   if edgar_data else city_emp
    state = edgar_data["state"]  if edgar_data else state_emp
    sector = edgar_data["sector"] if edgar_data else sector_emp

    return {
        "ein": ein_clean,
        "company_name": company_name,
        "city": city,
        "state": state,
        "sector": sector,
        "edgar": edgar_data,
        "plan_count": plan_count,
        "filing_count": filing_count,
        "has_welfare": has_health,
        "has_pension": False,
        "has_stop_loss": has_stop_loss,
        "has_drug": has_drug,
        "carriers": carriers[:5],
        "total_participants": total_participants,
        "total_income": total_income,
        "total_expense": total_expense,
        "total_assets": total_assets,
        "total_liabilities": total_liab,
        "pmpm": pmpm,
        "mlr_est": mlr_est,
        "year_history": year_hist[:5],
        "scores": {
            "overall": overall_score,
            "stop_loss": sl_score,
            "rx_pbm": rx_score,
            "fiduciary": fiduciary_score,
            "claims_financial": claims_score,
            "tpa_carrier": tpa_score,
            "integration_risk": integration_score,
            "regulatory": regulatory_score,
        },
        "liabilities": {
            "stop_loss_gap": sl_liability,
            "rx_overcharge": rx_liability,
            "fiduciary_exposure": fid_liability,
            "total_quantified": total_quantified,
        },
        "flags": {
            "no_stop_loss": not has_stop_loss and total_participants > 200,
            "high_mlr": mlr_est > 85,
            "multi_plan": plan_count > 1,
            "is_public": edgar_data is not None,
            "low_overall": overall_score < 60,
        },
        "recommendation": (
            "PROCEED WITH CONDITIONS" if 50 <= overall_score < 70 else
            "FLAG FOR RENEGOTIATION" if overall_score < 50 else "PROCEED"
        ),
    }


@router.post("/upload-doc")
async def upload_doc(
    ein: str = Form(...),
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    user: models.User = Depends(get_current_user),
):
    content = await file.read()
    size_kb = round(len(content) / 1024, 1)
    return {
        "status": "received",
        "doc_type": doc_type,
        "filename": file.filename,
        "size_kb": size_kb,
        "ein": ein,
        "message": f"{doc_type} uploaded ({size_kb} KB) — analysis will incorporate this document.",
    }
