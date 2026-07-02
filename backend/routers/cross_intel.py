"""
Kincaid IQ — DOL 5500 × EDGAR Cross-Intelligence Engine
Joins 937k plan filings with 2,014 matched public-company SEC filings.
Six analytical modules for Jeremiah Shrack / Kincaid RMC.
"""
from __future__ import annotations
import math, logging, re
from typing import Any
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import get_db
from backend.auth import get_current_user
from backend import models
from backend.duckdb import get_duck, duck_available

logger = logging.getLogger("kincaid.cross_intel")
router = APIRouter(prefix="/api/cross-intel", tags=["cross-intel"])

# ── helpers ───────────────────────────────────────────────────────────────────
def _f(v, default=0.0):
    if v is None: return default
    try:
        fv = float(v)
        return default if (math.isnan(fv) or math.isinf(fv)) else fv
    except Exception:
        return default

def _clean_ein(ein: str) -> str:
    return re.sub(r"[^0-9]", "", str(ein or ""))

# SIC → sector label
SIC_SECTORS = {
    "01": "Agriculture", "10": "Mining", "15": "Construction",
    "20": "Food Mfg", "22": "Textile", "23": "Apparel",
    "25": "Furniture", "26": "Paper", "27": "Printing",
    "28": "Chemicals", "29": "Petroleum", "30": "Rubber/Plastics",
    "32": "Stone/Glass", "33": "Primary Metals", "34": "Fabricated Metals",
    "35": "Industrial Machinery", "36": "Electronics", "37": "Transportation Equip",
    "38": "Instruments", "40": "Railroad", "41": "Transit",
    "42": "Trucking", "44": "Water Transport", "45": "Air Transport",
    "47": "Transportation Svcs", "48": "Communications", "49": "Utilities",
    "50": "Wholesale - Durable", "51": "Wholesale - Non-Durable",
    "52": "Retail - Building", "53": "General Merchandise",
    "54": "Food Stores", "55": "Auto Dealers", "56": "Apparel Stores",
    "57": "Furniture Stores", "58": "Eating/Drinking", "59": "Misc Retail",
    "60": "Banking", "61": "Credit", "62": "Security Brokers",
    "63": "Insurance", "64": "Insurance Agents", "65": "Real Estate",
    "67": "Holding Companies", "70": "Hotels", "72": "Personal Svcs",
    "73": "Business Svcs", "75": "Auto Repair", "78": "Motion Pictures",
    "79": "Amusement", "80": "Health Svcs", "81": "Legal Svcs",
    "82": "Education", "83": "Social Svcs", "86": "Membership Orgs",
    "87": "Engineering/Mgmt Svcs", "89": "Services, NEC",
}

# GLP-1 high-risk SIC codes (obesity/metabolic risk workforce)
GLP1_RISK_SICS = {
    "5411": 0.92, "5812": 0.91, "5411": 0.92, "2000": 0.88, "2011": 0.88,
    "5141": 0.87, "5912": 0.86, "5900": 0.85, "5311": 0.84,
    "7011": 0.82, "4213": 0.81, "4210": 0.81, "4215": 0.80,
    "2300": 0.78, "2311": 0.78, "5600": 0.75, "5411": 0.92,
    "3440": 0.74, "3490": 0.73, "3460": 0.72, "3559": 0.71,
    "3560": 0.70, "3710": 0.73, "3714": 0.72, "5571": 0.68,
    "5511": 0.65, "7389": 0.60, "8099": 0.88, "8049": 0.85,
}

def _sector_label(sic: Any) -> str:
    s = str(sic or "")[:2]
    return SIC_SECTORS.get(s, f"SIC {sic}")

def _get_edgar_financials(db: Session, ein: str) -> dict:
    """Pull latest 10-K financials for a company from EDGAR."""
    ein_clean = _clean_ein(ein)
    rows = db.execute(text("""
        SELECT s.name, s.cik, s.sic, s.stprba, s.cityba, s.period, s.adsh
        FROM sec_submissions s
        WHERE REGEXP_REPLACE(s.ein, '[^0-9]', '', 'g') = :ein
          AND s.form = '10-K'
        ORDER BY s.period DESC LIMIT 1
    """), {"ein": ein_clean}).fetchone()

    if not rows:
        return {}

    name, cik, sic, state, city, period, adsh = rows

    def _tag(tags: list[str], qtrs_in: tuple = (4,)) -> float:
        for tag in tags:
            r = db.execute(text("""
                SELECT value FROM sec_numeric
                WHERE adsh = :adsh AND tag = :tag AND qtrs = ANY(:qtrs)
                ORDER BY ddate DESC LIMIT 1
            """), {"adsh": adsh, "tag": tag, "qtrs": list(qtrs_in)}).fetchone()
            if r and r[0] is not None:
                return float(r[0])
        return 0.0

    revenue   = _tag(["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                       "SalesRevenueNet", "RevenueNet"], (4, 1, 2, 3))
    net_income = _tag(["NetIncomeLoss", "ProfitLoss"], (4, 1, 2, 3))
    assets     = _tag(["Assets"], (4, 1, 2, 3))
    equity     = _tag(["StockholdersEquity",
                        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], (4, 1, 2, 3))
    op_income  = _tag(["OperatingIncomeLoss"], (4, 1, 2, 3))
    labor      = _tag(["LaborAndRelatedExpense", "SalaryAndWageExpense",
                        "EmployeeBenefitsAndShareBasedCompensation",
                        "SalariesWagesAndOfficersCompensation"], (4, 1, 2, 3))
    employees  = _tag(["EntityNumberOfEmployees"], (0, 4, 1))
    pension_obl = _tag(["DefinedBenefitPlanBenefitObligation",
                         "PensionAndOtherPostretirementDefinedBenefitPlansLiabilitiesNoncurrent"], (4, 1, 2, 3))
    pension_assets = _tag(["DefinedBenefitPlanFairValueOfPlanAssets"], (4, 1, 2, 3))
    shares = _tag(["CommonStockSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"], (0, 4))
    share_comp = _tag(["AllocatedShareBasedCompensationExpense",
                        "EmployeeBenefitsAndShareBasedCompensation"], (4, 1, 2, 3))

    return {
        "name": name, "cik": cik, "sic": int(sic or 0), "sector": _sector_label(sic),
        "state": state, "city": city, "period": period, "adsh": adsh,
        "revenue": revenue, "net_income": net_income, "assets": assets, "equity": equity,
        "op_income": op_income, "labor_expense": labor, "employees": int(employees or 0),
        "pension_obligation": pension_obl, "pension_assets": pension_assets,
        "shares_outstanding": shares, "share_comp_expense": share_comp,
        "ebitda_est": op_income * 1.12 if op_income else 0,
    }

def _get_dol_plan(ein: str) -> dict:
    """Pull 5500 plan data from DuckDB for a given EIN."""
    duck = get_duck()
    ein_clean = _clean_ein(ein)
    row = duck.execute("""
        SELECT EIN, PLAN_NAME_LS, SPONS_DFE_NAME, STATE, CITY, PARTICIPANTS,
               TOTAL_INCOME_AMT, TOT_ASSETS_EOY_AMT, TOT_LIABILITIES_EOY_AMT,
               INVEST_MGMT_FEES_AMT, ADMIN_SERVICE_FEES_AMT, LEGAL_FEES_AMT,
               BROKER_COMMISSIONS, CARRIER_NAME, IS_HEALTH, IS_STOP_LOSS, IS_DRUG,
               WELFARE_PREMIUMS, COUNT(*) OVER () as plan_count,
               MAX(FORM_YEAR) OVER () as latest_year
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC LIMIT 1
    """, [ein_clean]).fetchone()
    if not row:
        return {}
    invest_fees = _f(row[9])
    admin_fees  = _f(row[10])
    legal_fees  = _f(row[11])
    broker_comm = _f(row[12])
    total_fees  = invest_fees + admin_fees + legal_fees
    income      = _f(row[6])
    return {
        "ein": row[0], "plan_name": row[1], "sponsor": row[2],
        "state": row[3], "city": row[4], "participants": int(row[5] or 0),
        "total_income": income, "assets_eoy": _f(row[7]),
        "liabilities_eoy": _f(row[8]),
        "invest_fees": invest_fees, "admin_fees": admin_fees,
        "legal_fees": legal_fees, "broker_commissions": broker_comm,
        "total_fees": total_fees,
        "carrier": row[13], "has_health": row[14], "has_stop_loss": row[15],
        "has_drug": row[16], "welfare_premiums": _f(row[17]),
        "plan_count": int(row[18] or 1),
        "plan_fee_ratio": (total_fees / income * 100) if income > 0 else 0,
    }


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/search")
def search_companies(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, le=50),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Search public companies that appear in both EDGAR and DOL 5500."""
    rows = db.execute(text("""
        WITH latest AS (
            SELECT DISTINCT ON (ein) ein, name, sic, stprba, cityba, period
            FROM sec_submissions
            WHERE form='10-K' AND ein IS NOT NULL
              AND name ILIKE :q
            ORDER BY ein, period DESC
        )
        SELECT l.ein, l.name, l.sic, l.stprba, l.cityba, l.period,
               f.plan_name, f.participants
        FROM latest l
        LEFT JOIN LATERAL (
            SELECT ff.plan_name,
                   COALESCE(ff.participants, 0) as participants
            FROM f5500_filings ff
            WHERE REGEXP_REPLACE(ff.ein, '[^0-9]', '', 'g') = REGEXP_REPLACE(l.ein, '[^0-9]', '', 'g')
            ORDER BY ff.form_year DESC LIMIT 1
        ) f ON TRUE
        ORDER BY f.participants DESC NULLS LAST
        LIMIT :limit
    """), {"q": f"%{q}%", "limit": limit}).fetchall()

    results = []
    for r in rows:
        results.append({
            "ein": r[0], "name": r[1], "sic": r[2],
            "sector": _sector_label(r[2]),
            "state": r[3], "city": r[4], "period": r[5],
            "plan_name": r[6], "participants": int(r[7] or 0),
            "total_income": 0,
            "total_fees": 0,
            "has_plan_data": r[6] is not None,
        })
    return {"results": results, "count": len(results), "query": q}


@router.get("/company/{ein}")
def company_profile(
    ein: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Full cross-dataset company profile — EDGAR + DOL 5500 merged."""
    edgar = _get_edgar_financials(db, ein)
    dol   = _get_dol_plan(ein)

    if not edgar and not dol:
        return {"error": "Company not found in EDGAR or DOL 5500", "ein": ein}

    # ── Module 1: Fiduciary Cost Ratio ────────────────────────────────────────
    revenue       = edgar.get("revenue", 0)
    total_fees    = dol.get("total_fees", 0)
    fcr           = (total_fees / revenue * 100) if revenue > 0 else 0
    ebitda        = edgar.get("ebitda_est", 0)
    ebitda_impact = (total_fees / ebitda * 100) if ebitda > 0 else 0

    # Sector median FCR (estimate from DuckDB state/industry benchmarks)
    duck = get_duck()
    sic_prefix = str(edgar.get("sic", 0))[:2]
    bench = duck.execute("""
        SELECT AVG(ADMIN_SERVICE_FEES_AMT + INVEST_MGMT_FEES_AMT + LEGAL_FEES_AMT) / NULLIF(AVG(TOTAL_INCOME_AMT),0) * 100
        FROM sch_h_2024
        WHERE BUSINESS_CODE LIKE ? AND TOTAL_INCOME_AMT > 0
    """, [f"{sic_prefix}%"]).fetchone()
    sector_median_fcr = _f(bench[0], 4.2) if bench else 4.2
    fcr_percentile = min(99, max(1, int((fcr / max(sector_median_fcr, 0.1)) * 50)))

    # ── Module 2: M&A Diligence ───────────────────────────────────────────────
    pension_gap = max(0, dol.get("liabilities_eoy", 0) - dol.get("assets_eoy", 0))
    funding_ratio = (dol.get("assets_eoy", 0) / max(dol.get("liabilities_eoy", 1), 1)) * 100
    pension_gap_edgar = max(0, edgar.get("pension_obligation", 0) - edgar.get("pension_assets", 0))
    carrier_risk = "High" if dol.get("broker_commissions", 0) > 500_000 else \
                   "Medium" if dol.get("broker_commissions", 0) > 100_000 else "Low"
    stop_loss_gap = not dol.get("has_stop_loss", False) and dol.get("participants", 0) > 200

    # ── Module 3: Exec Comp vs Plan Health ───────────────────────────────────
    labor_exp    = edgar.get("labor_expense", 0)
    share_comp   = edgar.get("share_comp_expense", 0)
    employees    = edgar.get("employees", 0)
    cost_per_emp = (labor_exp / employees) if employees > 0 else 0
    plan_per_emp = (total_fees / dol.get("participants", 1)) if dol.get("participants", 0) > 0 else 0
    exec_labor_ratio = (share_comp / max(labor_exp, 1)) * 100

    # ── Module 4: GLP-1 Exposure ──────────────────────────────────────────────
    sic_4 = str(edgar.get("sic", "0")).zfill(4)
    glp1_base_risk = GLP1_RISK_SICS.get(sic_4, GLP1_RISK_SICS.get(sic_4[:3], 0.45))
    participants = dol.get("participants", employees // 3 if employees else 0)
    glp1_est_members = int(participants * glp1_base_risk * 0.12)  # ~12% eligible
    glp1_annual_cost = glp1_est_members * 18_000  # ~$18k/yr per GLP-1 patient
    glp1_score = min(100, int(glp1_base_risk * 100))

    # ── Composite risk score ──────────────────────────────────────────────────
    risk_flags = []
    if fcr > sector_median_fcr * 1.5: risk_flags.append("High fee drag vs sector")
    if pension_gap > 0: risk_flags.append(f"Plan underfunded by ${pension_gap/1e6:.1f}M")
    if pension_gap_edgar > 1e6: risk_flags.append(f"EDGAR pension gap ${pension_gap_edgar/1e6:.1f}M")
    if stop_loss_gap: risk_flags.append("Stop-loss gap (200+ participants, no coverage)")
    if carrier_risk == "High": risk_flags.append("High broker commission exposure")
    if glp1_score > 75: risk_flags.append(f"GLP-1 exposure HIGH ({glp1_est_members} at-risk members)")
    if exec_labor_ratio > 15: risk_flags.append(f"Share comp is {exec_labor_ratio:.0f}% of labor (governance risk)")

    return {
        "ein": ein,
        "edgar": edgar,
        "dol": dol,
        "modules": {
            "fiduciary_cost_ratio": {
                "fcr_pct": round(fcr, 2),
                "total_fees": round(total_fees),
                "revenue": round(revenue),
                "ebitda_impact_pct": round(ebitda_impact, 2),
                "sector_median_fcr": round(sector_median_fcr, 2),
                "fcr_percentile": fcr_percentile,
                "verdict": "Excessive" if fcr > sector_median_fcr * 2 else
                           "Elevated" if fcr > sector_median_fcr * 1.25 else "Competitive",
                "recoverable": round(max(0, total_fees - revenue * sector_median_fcr / 100) * 0.40),
            },
            "ma_diligence": {
                "plan_funding_ratio": round(funding_ratio, 1),
                "plan_underfunding": round(pension_gap),
                "pension_gap_edgar": round(pension_gap_edgar),
                "carrier": dol.get("carrier", "Unknown"),
                "carrier_risk": carrier_risk,
                "broker_commissions": round(dol.get("broker_commissions", 0)),
                "stop_loss_gap": stop_loss_gap,
                "total_plan_liabilities": round(dol.get("liabilities_eoy", 0)),
                "welfare_premiums": round(dol.get("welfare_premiums", 0)),
                "ma_risk_score": min(100, len(risk_flags) * 15 + (20 if stop_loss_gap else 0)),
                "key_flags": risk_flags[:5],
            },
            "exec_vs_plan": {
                "labor_expense": round(labor_exp),
                "share_comp_expense": round(share_comp),
                "exec_labor_ratio_pct": round(exec_labor_ratio, 1),
                "employees": employees,
                "cost_per_employee": round(cost_per_emp),
                "plan_cost_per_participant": round(plan_per_emp),
                "plan_participants": dol.get("participants", 0),
                "verdict": "Misaligned" if exec_labor_ratio > 20 and plan_per_emp > 2000 else
                           "Watch" if exec_labor_ratio > 12 else "Aligned",
                "governance_flag": exec_labor_ratio > 15,
            },
            "glp1_exposure": {
                "risk_score": glp1_score,
                "sic_code": edgar.get("sic"),
                "sector": edgar.get("sector"),
                "at_risk_members_est": glp1_est_members,
                "projected_annual_cost": round(glp1_annual_cost),
                "cost_per_employee": round(glp1_annual_cost / max(employees, 1), 2),
                "risk_tier": "Critical" if glp1_score >= 85 else
                             "High" if glp1_score >= 70 else
                             "Moderate" if glp1_score >= 50 else "Low",
                "18mo_projection": round(glp1_annual_cost * 1.5),
            },
        },
        "risk_flags": risk_flags,
        "risk_score": min(100, len(risk_flags) * 14),
    }


@router.get("/sector/{sic}")
def sector_benchmark(
    sic: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Sector-level plan cost benchmarking across all matched EDGAR+DOL companies."""
    # Get all EINs in this SIC from EDGAR
    rows = db.execute(text("""
        SELECT DISTINCT ON (ein) ein, name, stprba
        FROM sec_submissions
        WHERE sic = :sic AND form='10-K' AND ein IS NOT NULL
        ORDER BY ein, period DESC LIMIT 200
    """), {"sic": sic}).fetchall()

    eins = [_clean_ein(r[0]) for r in rows]
    if not eins:
        return {"error": f"No companies found for SIC {sic}", "sic": sic}

    duck = get_duck()
    placeholders = ", ".join(f"'{e}'" for e in eins if e)
    bench = duck.execute(f"""
        SELECT
            COUNT(*) as plan_count,
            AVG(TOTAL_INCOME_AMT) as avg_income,
            AVG(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as avg_fees,
            MEDIAN(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as median_fees,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as p25,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as p75,
            PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as p90,
            AVG(PARTICIPANTS) as avg_participants,
            SUM(BROKER_COMMISSIONS) as total_commissions,
            AVG(BROKER_COMMISSIONS) as avg_commissions
        FROM sch_h_2024
        WHERE EIN IN ({placeholders or "''"})
          AND TOTAL_INCOME_AMT > 0
    """).fetchone()

    # Breakdown by year
    trends = duck.execute(f"""
        SELECT FORM_YEAR,
               COUNT(*) as plans,
               AVG(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as avg_fees,
               SUM(TOTAL_INCOME_AMT) as total_income
        FROM sch_h_2024
        WHERE EIN IN ({placeholders or "''"})
        GROUP BY FORM_YEAR ORDER BY FORM_YEAR
    """).fetchall()

    # Top plans in sector by fee size
    top_plans = duck.execute(f"""
        SELECT EIN, PLAN_NAME_LS, SPONS_DFE_NAME,
               INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT as total_fees,
               PARTICIPANTS, TOTAL_INCOME_AMT
        FROM sch_h_2024
        WHERE EIN IN ({placeholders or "''"})
          AND (INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) > 0
        ORDER BY total_fees DESC LIMIT 10
    """).fetchall()

    return {
        "sic": sic,
        "sector": _sector_label(sic),
        "company_count": len(rows),
        "benchmark": {
            "plan_count": int(_f(bench[0])), "avg_income": round(_f(bench[1])),
            "avg_fees": round(_f(bench[2])), "median_fees": round(_f(bench[3])),
            "p25_fees": round(_f(bench[4])), "p75_fees": round(_f(bench[5])),
            "p90_fees": round(_f(bench[6])), "avg_participants": round(_f(bench[7])),
            "total_commissions": round(_f(bench[8])),
            "avg_commissions": round(_f(bench[9])),
        },
        "trends": [{"year": r[0], "plans": r[1], "avg_fees": round(_f(r[2])),
                    "total_income": round(_f(r[3]))} for r in trends],
        "top_plans": [{"ein": r[0], "plan_name": r[1], "sponsor": r[2],
                       "total_fees": round(_f(r[3])), "participants": int(r[4] or 0),
                       "total_income": round(_f(r[5]))} for r in top_plans],
    }


@router.get("/carrier-risk")
def carrier_risk(
    user: models.User = Depends(get_current_user),
):
    """Carrier concentration by plan income tier (DuckDB-native, no EDGAR join needed)."""
    duck = get_duck()

    tier_order = [
        ("Enterprise (>$50M income)", "TOTAL_INCOME_AMT >= 50000000"),
        ("Large ($10M–$50M income)",  "TOTAL_INCOME_AMT >= 10000000 AND TOTAL_INCOME_AMT < 50000000"),
        ("Mid ($1M–$10M income)",     "TOTAL_INCOME_AMT >= 1000000 AND TOTAL_INCOME_AMT < 10000000"),
        ("Small ($100K–$1M income)",  "TOTAL_INCOME_AMT >= 100000 AND TOTAL_INCOME_AMT < 1000000"),
        ("Micro (<$100K income)",     "TOTAL_INCOME_AMT > 0 AND TOTAL_INCOME_AMT < 100000"),
    ]

    results = []
    total_plans = 0
    for tier_name, condition in tier_order:
        stats = duck.execute(f"""
            SELECT COUNT(*) as plan_cnt, COUNT(DISTINCT EIN) as company_cnt
            FROM sch_h_2024 WHERE {condition}
        """).fetchone()
        plan_cnt = int(stats[0] or 0)
        company_cnt = int(stats[1] or 0)
        total_plans += plan_cnt

        carriers = duck.execute(f"""
            SELECT CARRIER_NAME, COUNT(*) as plan_cnt,
                   SUM(BROKER_COMMISSIONS) as total_comm,
                   AVG(BROKER_COMMISSIONS) as avg_comm,
                   AVG(PARTICIPANTS) as avg_participants
            FROM sch_h_2024
            WHERE {condition} AND CARRIER_NAME IS NOT NULL AND CARRIER_NAME != ''
              AND BROKER_COMMISSIONS > 0
            GROUP BY CARRIER_NAME
            ORDER BY total_comm DESC NULLS LAST LIMIT 8
        """).fetchall()

        results.append({
            "tier": tier_name,
            "company_count": company_cnt,
            "plan_count": plan_cnt,
            "carriers": [{"name": r[0], "plan_count": int(r[1]),
                          "total_commissions": round(_f(r[2])),
                          "avg_commission": round(_f(r[3])),
                          "avg_participants": round(_f(r[4]))} for r in carriers],
        })

    return {"tiers": results, "total_companies": total_plans}


@router.get("/glp1-exposure")
def glp1_exposure(
    min_participants: int = Query(100),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """GLP-1/specialty drug exposure scores — uses DuckDB batch queries for speed."""
    # 1. Get all EDGAR companies (no correlated subqueries — just metadata)
    edgar_rows = db.execute(text("""
        SELECT DISTINCT ON (ein) ein, name, sic, stprba, cityba
        FROM sec_submissions WHERE form='10-K' AND ein IS NOT NULL
        ORDER BY ein, period DESC
    """)).fetchall()

    # 2. Filter to high-risk SICs in Python
    high_risk = []
    for r in edgar_rows:
        sic = str(r[2] or "0").zfill(4)
        risk_score = GLP1_RISK_SICS.get(sic, 0)
        if risk_score >= 0.55:
            high_risk.append((r[0], r[1], r[2], r[3], r[4], risk_score))

    if not high_risk:
        return {"companies": [], "total": 0}

    # 3. Batch DuckDB lookup for all high-risk EINs at once
    duck = get_duck()
    ein_list = [_clean_ein(r[0]) for r in high_risk]
    ph = ", ".join(f"'{e}'" for e in ein_list if e)

    dol_map: dict[str, tuple] = {}
    if ph:
        dol_rows = duck.execute(f"""
            SELECT EIN, PARTICIPANTS, TOTAL_INCOME_AMT
            FROM (
                SELECT EIN, PARTICIPANTS, TOTAL_INCOME_AMT,
                       ROW_NUMBER() OVER (PARTITION BY EIN ORDER BY FORM_YEAR DESC) as rn
                FROM sch_h_2024 WHERE EIN IN ({ph})
            ) t WHERE rn = 1
        """).fetchall()
        for dr in dol_rows:
            dol_map[str(dr[0])] = (int(dr[1] or 0), float(dr[2] or 0))

    # 4. Join and build results
    results = []
    for (ein, name, sic, state, city, risk_score) in high_risk:
        ein_clean = _clean_ein(ein)
        plan_data = dol_map.get(ein_clean)
        participants = plan_data[0] if plan_data else 0
        plan_income  = plan_data[1] if plan_data else 0

        if participants < min_participants:
            continue

        glp1_eligible = int(participants * risk_score * 0.12)
        annual_cost   = glp1_eligible * 18_000

        results.append({
            "ein": ein, "name": name, "sic": sic, "sector": _sector_label(sic),
            "state": state, "city": city, "employees": 0,
            "participants": participants,
            "glp1_risk_score": int(risk_score * 100),
            "risk_tier": "Critical" if risk_score >= 0.85 else
                         "High" if risk_score >= 0.70 else "Moderate",
            "glp1_eligible_est": glp1_eligible,
            "projected_annual_cost": round(annual_cost),
            "pct_of_revenue": None,
            "plan_income": round(plan_income),
        })

    results.sort(key=lambda x: x["projected_annual_cost"], reverse=True)
    return {"companies": results[:limit], "total": len(results)}


@router.get("/year-trends")
def year_trends(user: models.User = Depends(get_current_user)):
    """National DOL 5500 trend data 2020-2024."""
    duck = get_duck()
    rows = duck.execute("""
        SELECT FORM_YEAR, COUNT(*) as plans,
               SUM(PARTICIPANTS) as participants,
               SUM(TOTAL_INCOME_AMT) as total_income,
               SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as total_fees,
               AVG(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as avg_fees,
               SUM(BROKER_COMMISSIONS) as broker_commissions,
               SUM(WELFARE_PREMIUMS) as welfare_premiums
        FROM sch_h_2024
        GROUP BY FORM_YEAR ORDER BY FORM_YEAR
    """).fetchall()
    return {"trends": [
        {"year": r[0], "plans": int(r[1] or 0),
         "participants": int(_f(r[2])),
         "total_income": round(_f(r[3])),
         "total_fees": round(_f(r[4])),
         "avg_fees": round(_f(r[5])),
         "broker_commissions": round(_f(r[6])),
         "welfare_premiums": round(_f(r[7]))} for r in rows
    ]}

# ══════════════════════════════════════════════════════════════════════════════
# DRILL-DOWN ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/company/{ein}/history")
def company_history(ein: str, user: models.User = Depends(get_current_user)):
    """Year-over-year plan history for a specific company."""
    duck = get_duck()
    ein_clean = _clean_ein(ein)

    rows = duck.execute("""
        SELECT FORM_YEAR,
               SUM(PARTICIPANTS) as participants,
               SUM(TOTAL_INCOME_AMT) as total_income,
               SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as total_fees,
               SUM(BROKER_COMMISSIONS) as broker_commissions,
               SUM(WELFARE_PREMIUMS) as welfare_premiums,
               COUNT(*) as plan_count,
               STRING_AGG(DISTINCT CARRIER_NAME, ', ') FILTER (WHERE CARRIER_NAME IS NOT NULL AND CARRIER_NAME != '') as carriers
        FROM sch_h_2024
        WHERE EIN = ?
        GROUP BY FORM_YEAR ORDER BY FORM_YEAR
    """, [ein_clean]).fetchall()

    if not rows:
        return {"history": [], "ein": ein}

    history = []
    prev_fees = None
    for r in rows:
        fees = _f(r[3])
        yoy_pct = ((fees - prev_fees) / prev_fees * 100) if prev_fees and prev_fees > 0 else None
        history.append({
            "year": r[0],
            "participants": int(r[1] or 0),
            "total_income": round(_f(r[2])),
            "total_fees": round(fees),
            "broker_commissions": round(_f(r[4])),
            "welfare_premiums": round(_f(r[5])),
            "plan_count": int(r[6] or 1),
            "carriers": r[7] or "",
            "yoy_fee_pct": round(yoy_pct, 1) if yoy_pct is not None else None,
        })
        prev_fees = fees

    # Per-plan breakdown for latest year
    latest_year = rows[-1][0]
    plans = duck.execute("""
        SELECT PLAN_NAME_LS, PN, PARTICIPANTS, TOTAL_INCOME_AMT,
               INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT as fees,
               BROKER_COMMISSIONS, CARRIER_NAME, IS_HEALTH, IS_STOP_LOSS, IS_DRUG,
               WELFARE_PREMIUMS
        FROM sch_h_2024
        WHERE EIN = ? AND FORM_YEAR = ?
        ORDER BY PARTICIPANTS DESC
    """, [ein_clean, latest_year]).fetchall()

    return {
        "ein": ein,
        "history": history,
        "latest_year": latest_year,
        "plan_details": [{
            "plan_name": r[0] or f"Plan {r[1]}",
            "pn": r[1],
            "participants": int(r[2] or 0),
            "total_income": round(_f(r[3])),
            "fees": round(_f(r[4])),
            "broker_commissions": round(_f(r[5])),
            "carrier": r[6] or "Unknown",
            "has_health": bool(r[7]),
            "has_stop_loss": bool(r[8]),
            "has_drug": bool(r[9]),
            "welfare_premiums": round(_f(r[10])),
        } for r in plans],
    }


@router.get("/company/{ein}/peers")
def company_peers(ein: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Find 8 comparable companies by sector + participant size."""
    duck = get_duck()
    ein_clean = _clean_ein(ein)

    # Get target company's SIC and participant count
    target_edgar = db.execute(text("""
        SELECT sic, name FROM sec_submissions WHERE REGEXP_REPLACE(ein,'[^0-9]','','g')=:ein
        AND form='10-K' ORDER BY period DESC LIMIT 1
    """), {"ein": ein_clean}).fetchone()

    target_dol = duck.execute("SELECT PARTICIPANTS FROM sch_h_2024 WHERE EIN=? ORDER BY FORM_YEAR DESC LIMIT 1", [ein_clean]).fetchone()

    if not target_edgar:
        return {"peers": []}

    sic = target_edgar[0]
    participants = int(target_dol[0] if target_dol else 1000)

    # Get companies with same SIC prefix from EDGAR
    sic_prefix = str(sic)[:2]
    peer_eins = db.execute(text("""
        SELECT DISTINCT ON (ein) REGEXP_REPLACE(ein,'[^0-9]','','g') as ein_clean, name, sic, stprba
        FROM sec_submissions
        WHERE form='10-K' AND sic::text LIKE :prefix
          AND ein IS NOT NULL AND REGEXP_REPLACE(ein,'[^0-9]','','g') != :ein
        ORDER BY ein, period DESC LIMIT 200
    """), {"prefix": f"{sic_prefix}%", "ein": ein_clean}).fetchall()

    if not peer_eins:
        return {"peers": []}

    # Batch lookup in DuckDB, filter by similar participant count
    ph = ", ".join(f"'{r[0]}'" for r in peer_eins if r[0])
    if not ph:
        return {"peers": []}

    max_year = duck.execute("SELECT MAX(FORM_YEAR) FROM sch_h_2024 WHERE FORM_YEAR <= 2023").fetchone()[0] or 2023
    peers = duck.execute(f"""
        SELECT EIN, FIRST(SPONS_DFE_NAME) as sponsor,
               SUM(PARTICIPANTS) as participants,
               SUM(TOTAL_INCOME_AMT) as total_income,
               SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as fees,
               SUM(BROKER_COMMISSIONS) as broker_commissions,
               ABS(SUM(PARTICIPANTS) - {participants}) as size_diff
        FROM sch_h_2024
        WHERE EIN IN ({ph}) AND PARTICIPANTS > 0
          AND FORM_YEAR = {max_year}
        GROUP BY EIN
        ORDER BY size_diff ASC LIMIT 8
    """).fetchall()

    # Look up names from EDGAR for matched EINs
    ein_name_map = {r[0]: r[1] for r in peer_eins}

    return {"peers": [{
        "ein": r[0],
        "name": ein_name_map.get(r[0], r[1] or "Unknown"),
        "participants": int(r[2] or 0),
        "total_income": round(_f(r[3])),
        "fees": round(_f(r[4])),
        "broker_commissions": round(_f(r[5])),
        "fee_per_participant": round(_f(r[4]) / max(int(r[2] or 1), 1)),
        "size_diff": int(r[6] or 0),
    } for r in peers], "target_participants": participants, "sic": sic}


@router.get("/sector/{sic}/breakdown")
def sector_breakdown(sic: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Fee histogram + by-state breakdown for a sector."""
    rows = db.execute(text("""
        SELECT DISTINCT ON (ein) REGEXP_REPLACE(ein,'[^0-9]','','g') as ein_clean, stprba
        FROM sec_submissions WHERE sic=:sic AND form='10-K' AND ein IS NOT NULL
        ORDER BY ein, period DESC
    """), {"sic": sic}).fetchall()

    if not rows:
        return {"histogram": [], "by_state": []}

    duck = get_duck()
    ph = ", ".join(f"'{r[0]}'" for r in rows if r[0])
    state_map = {r[0]: r[1] for r in rows}

    if not ph:
        return {"histogram": [], "by_state": []}

    # Fee histogram buckets
    hist = duck.execute(f"""
        SELECT
            CASE
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 10000 THEN '<$10K'
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 50000 THEN '$10K–$50K'
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 100000 THEN '$50K–$100K'
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 250000 THEN '$100K–$250K'
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 500000 THEN '$250K–$500K'
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 1000000 THEN '$500K–$1M'
                WHEN INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT < 5000000 THEN '$1M–$5M'
                ELSE '>$5M'
            END as bucket,
            COUNT(*) as plan_count,
            MIN(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as bucket_min
        FROM sch_h_2024
        WHERE EIN IN ({ph})
          AND (INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) > 0
        GROUP BY 1 ORDER BY bucket_min
    """).fetchall()

    # Fee breakdown: invest vs admin vs legal
    breakdown = duck.execute(f"""
        SELECT
            AVG(INVEST_MGMT_FEES_AMT) as avg_invest,
            AVG(ADMIN_SERVICE_FEES_AMT) as avg_admin,
            AVG(LEGAL_FEES_AMT) as avg_legal,
            AVG(BROKER_COMMISSIONS) as avg_broker,
            AVG(WELFARE_PREMIUMS) as avg_welfare,
            AVG(PARTICIPANTS) as avg_participants,
            AVG(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as avg_total,
            SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as total_fees_all,
            COUNT(CASE WHEN IS_STOP_LOSS THEN 1 END) * 100.0 / COUNT(*) as stop_loss_pct,
            COUNT(CASE WHEN IS_HEALTH THEN 1 END) * 100.0 / COUNT(*) as health_pct
        FROM sch_h_2024 WHERE EIN IN ({ph})
    """).fetchone()

    # By-state stats
    by_state_raw = duck.execute(f"""
        SELECT STATE,
               COUNT(*) as plan_count,
               SUM(PARTICIPANTS) as participants,
               AVG(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as avg_fees,
               SUM(BROKER_COMMISSIONS) as total_commissions
        FROM sch_h_2024
        WHERE EIN IN ({ph}) AND STATE IS NOT NULL
        GROUP BY STATE ORDER BY participants DESC NULLS LAST LIMIT 15
    """).fetchall()

    return {
        "sic": sic,
        "sector": _sector_label(sic),
        "histogram": [{"bucket": r[0], "count": int(r[1])} for r in hist],
        "fee_breakdown": {
            "avg_invest": round(_f(breakdown[0])),
            "avg_admin": round(_f(breakdown[1])),
            "avg_legal": round(_f(breakdown[2])),
            "avg_broker": round(_f(breakdown[3])),
            "avg_welfare": round(_f(breakdown[4])),
            "avg_participants": round(_f(breakdown[5])),
            "avg_total_fees": round(_f(breakdown[6])),
            "total_fees_all": round(_f(breakdown[7])),
            "stop_loss_pct": round(_f(breakdown[8]), 1),
            "health_pct": round(_f(breakdown[9]), 1),
        },
        "by_state": [{
            "state": r[0], "plan_count": int(r[1]),
            "participants": int(r[2] or 0),
            "avg_fees": round(_f(r[3])),
            "total_commissions": round(_f(r[4])),
        } for r in by_state_raw],
    }


@router.get("/carrier-detail")
def carrier_detail(
    tier_condition: str = Query("TOTAL_INCOME_AMT >= 10000000 AND TOTAL_INCOME_AMT < 50000000"),
    user: models.User = Depends(get_current_user),
):
    """Market share, HHI, and year-over-year trend for carriers in a given tier."""
    # Sanitize tier_condition to prevent injection
    allowed = ["TOTAL_INCOME_AMT >= 50000000",
               "TOTAL_INCOME_AMT >= 10000000 AND TOTAL_INCOME_AMT < 50000000",
               "TOTAL_INCOME_AMT >= 1000000 AND TOTAL_INCOME_AMT < 10000000",
               "TOTAL_INCOME_AMT >= 100000 AND TOTAL_INCOME_AMT < 1000000",
               "TOTAL_INCOME_AMT > 0 AND TOTAL_INCOME_AMT < 100000"]
    if tier_condition not in allowed:
        tier_condition = allowed[1]

    duck = get_duck()

    # Market share with HHI
    carriers = duck.execute(f"""
        WITH totals AS (
            SELECT SUM(BROKER_COMMISSIONS) as grand_total
            FROM sch_h_2024
            WHERE {tier_condition} AND CARRIER_NAME IS NOT NULL AND BROKER_COMMISSIONS > 0
        )
        SELECT c.CARRIER_NAME,
               COUNT(*) as plan_cnt,
               SUM(c.BROKER_COMMISSIONS) as total_comm,
               SUM(c.BROKER_COMMISSIONS) * 100.0 / t.grand_total as mkt_share_pct,
               AVG(c.BROKER_COMMISSIONS) as avg_comm,
               AVG(c.PARTICIPANTS) as avg_participants
        FROM sch_h_2024 c, totals t
        WHERE {tier_condition} AND c.CARRIER_NAME IS NOT NULL
          AND c.CARRIER_NAME != '' AND c.BROKER_COMMISSIONS > 0
        GROUP BY c.CARRIER_NAME, t.grand_total
        ORDER BY total_comm DESC NULLS LAST LIMIT 12
    """).fetchall()

    # HHI = sum of squared market share
    hhi = sum((_f(r[3]) ** 2) for r in carriers)

    # Year trends for top 3 carriers
    top_3 = [r[0] for r in carriers[:3]]
    trends = []
    for carrier in top_3:
        yrows = duck.execute(f"""
            SELECT FORM_YEAR, COUNT(*) as plans, SUM(BROKER_COMMISSIONS) as commissions
            FROM sch_h_2024
            WHERE {tier_condition} AND CARRIER_NAME = ? AND BROKER_COMMISSIONS > 0
              AND FORM_YEAR <= 2023
            GROUP BY FORM_YEAR ORDER BY FORM_YEAR
        """, [carrier]).fetchall()
        trends.append({
            "carrier": carrier,
            "by_year": [{"year": r[0], "plans": int(r[1]),
                         "commissions": round(_f(r[2]))} for r in yrows],
        })

    return {
        "carriers": [{
            "name": r[0], "plan_count": int(r[1]),
            "total_commissions": round(_f(r[2])),
            "market_share_pct": round(_f(r[3]), 1),
            "avg_commission": round(_f(r[4])),
            "avg_participants": round(_f(r[5])),
        } for r in carriers],
        "hhi": round(hhi, 1),
        "concentration": "High" if hhi > 2500 else "Moderate" if hhi > 1500 else "Competitive",
        "top3_trends": trends,
    }


@router.get("/glp1-by-state")
def glp1_by_state(
    sic_prefix: str = Query("4", description="SIC prefix to filter by"),
    user: models.User = Depends(get_current_user),
):
    """GLP-1 exposure by state for a given industry SIC prefix."""
    # Allow only numeric SIC prefixes 1-2 chars
    import re as _re
    if not _re.match(r'^\d{1,4}$', sic_prefix):
        sic_prefix = "4"

    risk_score = 0.75  # default high-risk score for labor-intensive industries

    duck = get_duck()
    rows = duck.execute(f"""
        SELECT STATE,
               COUNT(DISTINCT EIN) as employer_count,
               COUNT(*) as plan_count,
               SUM(PARTICIPANTS) as total_participants,
               AVG(PARTICIPANTS) as avg_participants,
               SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as total_fees,
               SUM(BROKER_COMMISSIONS) as total_commissions,
               SUM(CASE WHEN IS_STOP_LOSS THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as stop_loss_pct,
               SUM(CASE WHEN IS_DRUG THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as drug_benefit_pct
        FROM sch_h_2024
        WHERE BUSINESS_CODE LIKE ?
          AND PARTICIPANTS >= 50
          AND STATE IS NOT NULL
        GROUP BY STATE
        ORDER BY total_participants DESC NULLS LAST
        LIMIT 52
    """, [f"{sic_prefix}%"]).fetchall()

    results = []
    for r in rows:
        participants = int(r[3] or 0)
        glp1_eligible = int(participants * risk_score * 0.12)
        annual_cost = glp1_eligible * 18_000
        results.append({
            "state": r[0],
            "employer_count": int(r[1] or 0),
            "plan_count": int(r[2] or 0),
            "total_participants": participants,
            "avg_participants": round(_f(r[4])),
            "total_fees": round(_f(r[5])),
            "total_commissions": round(_f(r[6])),
            "stop_loss_pct": round(_f(r[7]), 1),
            "drug_benefit_pct": round(_f(r[8]), 1),
            "glp1_eligible_est": glp1_eligible,
            "projected_annual_cost": round(annual_cost),
        })

    return {
        "sic_prefix": sic_prefix,
        "by_state": results,
        "total_participants": sum(r["total_participants"] for r in results),
        "total_glp1_exposure": sum(r["projected_annual_cost"] for r in results),
    }


@router.get("/trends/deep")
def trends_deep(user: models.User = Depends(get_current_user)):
    """Deep national trends: per-participant costs, stop-loss adoption, fee type split."""
    duck = get_duck()

    rows = duck.execute("""
        SELECT FORM_YEAR,
               COUNT(*) as plan_count,
               COUNT(DISTINCT EIN) as employer_count,
               SUM(PARTICIPANTS) as total_participants,
               SUM(TOTAL_INCOME_AMT) as total_income,
               SUM(INVEST_MGMT_FEES_AMT) as invest_fees,
               SUM(ADMIN_SERVICE_FEES_AMT) as admin_fees,
               SUM(LEGAL_FEES_AMT) as legal_fees,
               SUM(BROKER_COMMISSIONS) as broker_commissions,
               SUM(WELFARE_PREMIUMS) as welfare_premiums,
               SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as total_fees,
               SUM(PARTICIPANTS) / NULLIF(COUNT(*), 0) as avg_participants_per_plan,
               SUM(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT)
                   / NULLIF(SUM(PARTICIPANTS), 0) as fees_per_participant,
               SUM(TOTAL_INCOME_AMT) / NULLIF(SUM(PARTICIPANTS), 0) as income_per_participant,
               SUM(CASE WHEN IS_STOP_LOSS THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as stop_loss_pct,
               SUM(CASE WHEN IS_HEALTH THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as health_pct,
               SUM(CASE WHEN IS_DRUG THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as drug_pct
        FROM sch_h_2024
        WHERE FORM_YEAR <= 2023 AND PARTICIPANTS > 0
        GROUP BY FORM_YEAR ORDER BY FORM_YEAR
    """).fetchall()

    trends = []
    prev = None
    for r in rows:
        year_data = {
            "year": r[0],
            "plan_count": int(r[1] or 0),
            "employer_count": int(r[2] or 0),
            "total_participants": int(r[3] or 0),
            "total_income": round(_f(r[4])),
            "invest_fees": round(_f(r[5])),
            "admin_fees": round(_f(r[6])),
            "legal_fees": round(_f(r[7])),
            "broker_commissions": round(_f(r[8])),
            "welfare_premiums": round(_f(r[9])),
            "total_fees": round(_f(r[10])),
            "avg_participants_per_plan": round(_f(r[11])),
            "fees_per_participant": round(_f(r[12]), 2),
            "income_per_participant": round(_f(r[13]), 2),
            "stop_loss_pct": round(_f(r[14]), 1),
            "health_pct": round(_f(r[15]), 1),
            "drug_pct": round(_f(r[16]), 1),
        }
        if prev:
            tf_now = year_data["total_fees"] or 1
            tf_prev = prev["total_fees"] or 1
            year_data["yoy_fee_pct"] = round((tf_now - tf_prev) / tf_prev * 100, 1)
            bp_now = year_data["broker_commissions"] or 1
            bp_prev = prev["broker_commissions"] or 1
            year_data["yoy_broker_pct"] = round((bp_now - bp_prev) / bp_prev * 100, 1)
            fp_now = year_data["fees_per_participant"] or 1
            fp_prev = prev["fees_per_participant"] or 1
            year_data["yoy_fpp_pct"] = round((fp_now - fp_prev) / fp_prev * 100, 1)
        trends.append(year_data)
        prev = year_data

    return {"trends": trends}
