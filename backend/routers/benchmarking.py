"""
Kincaid IQ — Benefits Benchmarking Engine
Queries the DOL EFAST2 DuckDB database to benchmark any employer against
national and state-level peers by industry (NAICS/business code).
"""
import json
import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from backend.duckdb import get_duck, duck_available
from backend.auth import get_current_user
from backend.database import get_db
from backend import models

logger = logging.getLogger("kincaid.benchmarking")
router = APIRouter(prefix="/api/benchmark", tags=["benchmarking"])

# ── Industry code labels ───────────────────────────────────────────────────────
INDUSTRY_LABELS: dict[str, str] = {
    "211000": "Oil & Gas Extraction",
    "212000": "Mining (except Oil & Gas)",
    "221000": "Utilities",
    "230000": "Construction",
    "236000": "Building Construction",
    "237000": "Heavy & Civil Engineering Construction",
    "238000": "Specialty Trade Contractors",
    "310000": "Food & Textile Manufacturing",
    "311000": "Food Manufacturing",
    "312000": "Beverage & Tobacco Manufacturing",
    "315000": "Apparel Manufacturing",
    "321000": "Wood Product Manufacturing",
    "322000": "Paper Manufacturing",
    "325000": "Chemical Manufacturing",
    "326000": "Plastics & Rubber Manufacturing",
    "327000": "Nonmetallic Mineral Manufacturing",
    "331000": "Primary Metal Manufacturing",
    "332000": "Fabricated Metal Manufacturing",
    "333000": "Machinery Manufacturing",
    "334000": "Computer & Electronics Manufacturing",
    "335000": "Electrical Equipment Manufacturing",
    "336000": "Transportation Equipment Manufacturing",
    "337000": "Furniture & Related Manufacturing",
    "339000": "Miscellaneous Manufacturing",
    "420000": "Wholesale Trade",
    "423000": "Wholesale - Durable Goods",
    "424000": "Wholesale - Nondurable Goods",
    "425000": "Wholesale - Electronic Markets",
    "441000": "Motor Vehicle & Parts Dealers",
    "442000": "Furniture & Home Stores",
    "444000": "Building Material & Garden Stores",
    "445000": "Food & Beverage Stores",
    "447000": "Gasoline Stations",
    "448000": "Clothing & Accessories Stores",
    "451000": "Sporting Goods & Hobby Stores",
    "452000": "General Merchandise Stores",
    "453000": "Miscellaneous Retail",
    "481000": "Air Transportation",
    "484000": "Truck Transportation",
    "485000": "Transit & Ground Transportation",
    "493000": "Warehousing & Storage",
    "511000": "Publishing",
    "512000": "Motion Picture & Sound Recording",
    "515000": "Broadcasting",
    "517000": "Telecommunications",
    "518000": "Data Processing",
    "519000": "Other Information Services",
    "521000": "Monetary Authorities",
    "522000": "Credit Intermediation & Related",
    "523000": "Securities & Commodity Contracts",
    "524000": "Insurance Carriers & Related",
    "525000": "Funds & Trusts",
    "531000": "Real Estate",
    "532000": "Rental & Leasing",
    "541000": "Professional, Scientific & Technical",
    "551000": "Management of Companies",
    "561000": "Administrative & Support Services",
    "562000": "Waste Management & Remediation",
    "611000": "Educational Services",
    "621000": "Ambulatory Health Care",
    "622000": "Hospitals",
    "623000": "Nursing & Residential Care",
    "624000": "Social Assistance",
    "711000": "Arts, Entertainment & Recreation",
    "721000": "Accommodation",
    "722000": "Food Services & Drinking Places",
    "811000": "Repair & Maintenance",
    "812000": "Personal & Laundry Services",
    "813000": "Religious, Civic & Professional Orgs",
    "900000": "Government / Public Admin",
}


def _industry_label(code: str) -> str:
    if not code:
        return "Unknown Industry"
    # Try exact, then 3-digit prefix, then 2-digit prefix
    for length in (6, 5, 4, 3, 2):
        key = (code[:length]).ljust(6, "0")
        if key in INDUSTRY_LABELS:
            return INDUSTRY_LABELS[key]
        prefix = code[:length]
        for k, v in INDUSTRY_LABELS.items():
            if k.startswith(prefix):
                return v
    return f"Industry {code}"


def _calc_percentile(value: float, p25: float, p50: float, p75: float, p90: float) -> int:
    """Estimate percentile from known quartiles using linear interpolation."""
    if value <= 0:
        return 1
    if p50 <= 0:
        return 50
    if value <= p25:
        return max(1, int(value / p25 * 25)) if p25 > 0 else 10
    elif value <= p50:
        span = p50 - p25
        return 25 + (int((value - p25) / span * 25) if span > 0 else 12)
    elif value <= p75:
        span = p75 - p50
        return 50 + (int((value - p50) / span * 25) if span > 0 else 12)
    elif value <= p90:
        span = p90 - p75
        return 75 + (int((value - p75) / span * 15) if span > 0 else 7)
    else:
        return min(99, 90 + int((value - p90) / (p90 + 1) * 9))


def _fmt_emp(r) -> dict:
    return {
        "ein": r[0],
        "name": r[1],
        "planName": r[2],
        "state": r[3],
        "city": r[4],
        "latestYear": r[5],
        "maxParticipants": r[6],
        "businessCode": r[7],
        "industryLabel": _industry_label(r[7] or ""),
        "totalWelfarePremiums": float(r[8] or 0),
        "totalBrokerCommissions": float(r[9] or 0),
        "totalAdminFees": float(r[10] or 0),
        "totalIncome": float(r[11] or 0),
        "hasHealth": bool(r[12]),
        "hasStopLoss": bool(r[13]),
        "filingCount": r[14],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lookup")
def lookup_employers(
    q: str = Query(min_length=2),
    limit: int = Query(default=12, le=50),
    user: models.User = Depends(get_current_user),
):
    """Search employers by name or EIN."""
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    con = get_duck()
    clean_q = q.replace("-", "").strip()
    rows = con.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
               max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, total_income, has_health, has_stop_loss, filing_count
        FROM employers
        WHERE UPPER(employer_name) LIKE UPPER(?)
           OR EIN = ?
        ORDER BY max_participants DESC NULLS LAST
        LIMIT ?
    """, [f"%{q}%", clean_q, limit]).fetchall()
    return {"results": [_fmt_emp(r) for r in rows], "total": len(rows)}


@router.get("/employer/{ein}")
def get_employer_benchmark(
    ein: str,
    year: int = Query(default=2023),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Full benchmarking profile for a specific employer."""
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    con = get_duck()
    clean_ein = ein.replace("-", "").strip()

    emp = con.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
               max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, total_income, has_health, has_stop_loss, filing_count
        FROM employers WHERE EIN = ?
    """, [clean_ein]).fetchone()

    if not emp:
        raise HTTPException(404, "Employer not found")

    biz_code = emp[7] or ""
    state = emp[3] or ""
    participants = int(emp[6] or 1)

    # National industry benchmark
    nat = con.execute("""
        SELECT plan_count, avg_participants,
               p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm,
               total_welfare_premiums, total_broker_commissions
        FROM industry_bench
        WHERE BUSINESS_CODE = ? AND FORM_YEAR = ?
    """, [biz_code, year]).fetchone()

    # Try adjacent year if exact miss
    if not nat:
        nat = con.execute("""
            SELECT plan_count, avg_participants,
                   p50_income, p75_income,
                   p50_admin_fees, p75_admin_fees, p90_admin_fees,
                   p50_broker_comm, p75_broker_comm, p90_broker_comm,
                   total_welfare_premiums, total_broker_commissions
            FROM industry_bench
            WHERE BUSINESS_CODE = ?
            ORDER BY ABS(FORM_YEAR - ?) ASC LIMIT 1
        """, [biz_code, year]).fetchone()

    # State benchmark
    state_b = con.execute("""
        SELECT plan_count, avg_participants,
               p25_income, p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_commissions, p75_commissions, p90_commissions
        FROM state_benchmarks
        WHERE STATE = ? AND BUSINESS_CODE = ? AND FORM_YEAR = ?
    """, [state, biz_code, year]).fetchone()

    # Year trends
    trends = con.execute("""
        SELECT FORM_YEAR, total_plans, total_participants,
               avg_welfare_premiums, avg_broker_commissions, avg_admin_fees,
               health_plans, stop_loss_plans
        FROM year_trends ORDER BY FORM_YEAR
    """).fetchall()

    # Top carriers in state
    carriers = con.execute("""
        SELECT CARRIER_NAME, plan_count, total_premiums, total_commissions,
               avg_commissions_per_plan
        FROM carrier_rankings
        WHERE STATE = ?
        ORDER BY total_premiums DESC
        LIMIT 10
    """, [state]).fetchall()

    # ── Compute percentiles ──────────────────────────────────────────────
    emp_admin = float(emp[10] or 0)
    emp_comm  = float(emp[9] or 0)
    emp_income = float(emp[11] or 0)

    # PMPM (welfare premiums / participants / 12)
    welfare_total = float(emp[8] or 0)
    emp_pmpm = round(welfare_total / participants / 12, 2) if participants > 0 else None

    admin_pct = comm_pct = income_pct = None
    nat_pmpm = None

    if nat:
        p50_admin = float(nat[4] or 0)
        p75_admin = float(nat[5] or 0)
        p90_admin = float(nat[6] or 0)
        p50_comm  = float(nat[7] or 0)
        p75_comm  = float(nat[8] or 0)
        p90_comm  = float(nat[9] or 0)
        p50_inc   = float(nat[2] or 0)
        p75_inc   = float(nat[3] or 0)
        avg_part  = float(nat[1] or 1)

        admin_pct  = _calc_percentile(emp_admin, p50_admin * 0.5, p50_admin, p75_admin, p90_admin)
        comm_pct   = _calc_percentile(emp_comm,  p50_comm * 0.5,  p50_comm,  p75_comm,  p90_comm)
        income_pct = _calc_percentile(emp_income, p50_inc * 0.5,  p50_inc,   p75_inc,   p75_inc * 1.2)
        # National average PMPM estimate from welfare premiums / avg_participants / 12
        nat_wp = float(nat[10] or 0)
        nat_count = int(nat[0] or 1)
        if nat_count > 0 and avg_part > 0:
            nat_pmpm = round(nat_wp / nat_count / avg_part / 12, 2)

    # ── State-level percentiles (mirror the national gauges, but vs in-state peers) ──
    state_admin_pct = state_comm_pct = state_income_pct = None
    if state_b:
        sp25_inc   = float(state_b[2] or 0)
        sp50_inc   = float(state_b[3] or 0)
        sp75_inc   = float(state_b[4] or 0)
        sp50_admin = float(state_b[5] or 0)
        sp75_admin = float(state_b[6] or 0)
        sp90_admin = float(state_b[7] or 0)
        sp50_comm  = float(state_b[8] or 0)
        sp75_comm  = float(state_b[9] or 0)
        sp90_comm  = float(state_b[10] or 0)

        state_admin_pct  = _calc_percentile(emp_admin, sp50_admin * 0.5, sp50_admin, sp75_admin, sp90_admin)
        state_comm_pct   = _calc_percentile(emp_comm,  sp50_comm * 0.5,  sp50_comm,  sp75_comm,  sp90_comm)
        state_income_pct = _calc_percentile(
            emp_income,
            sp25_inc if sp25_inc > 0 else sp50_inc * 0.5,
            sp50_inc, sp75_inc, sp75_inc * 1.2,
        )

    result = {
        "employer": _fmt_emp(emp),
        "employerPmpm": emp_pmpm,
        "natPmpm": nat_pmpm,
        "percentiles": {
            "adminFees": admin_pct,
            "brokerCommissions": comm_pct,
            "totalIncome": income_pct,
        },
        "statePercentiles": {
            "adminFees": state_admin_pct,
            "brokerCommissions": state_comm_pct,
            "totalIncome": state_income_pct,
        },
        "nationalBenchmark": {
            "planCount": int(nat[0] or 0),
            "avgParticipants": round(float(nat[1] or 0), 0),
            "p50Income": float(nat[2] or 0),
            "p75Income": float(nat[3] or 0),
            "p50AdminFees": float(nat[4] or 0),
            "p75AdminFees": float(nat[5] or 0),
            "p90AdminFees": float(nat[6] or 0),
            "p50BrokerComm": float(nat[7] or 0),
            "p75BrokerComm": float(nat[8] or 0),
            "p90BrokerComm": float(nat[9] or 0),
        } if nat else None,
        "stateBenchmark": {
            "planCount": int(state_b[0] or 0),
            "avgParticipants": round(float(state_b[1] or 0), 0),
            "p25Income": float(state_b[2] or 0),
            "p50Income": float(state_b[3] or 0),
            "p75Income": float(state_b[4] or 0),
            "p50AdminFees": float(state_b[5] or 0),
            "p75AdminFees": float(state_b[6] or 0),
            "p90AdminFees": float(state_b[7] or 0),
            "p50Commissions": float(state_b[8] or 0),
            "p75Commissions": float(state_b[9] or 0),
            "p90Commissions": float(state_b[10] or 0),
        } if state_b else None,
        "yearTrends": [
            {
                "year": r[0],
                "totalPlans": r[1],
                "totalParticipants": r[2],
                "avgPremiums": round(float(r[3] or 0), 0),
                "avgCommissions": round(float(r[4] or 0), 0),
                "avgAdminFees": round(float(r[5] or 0), 0),
                "healthPlans": r[6] or 0,
                "stopLossPlans": r[7] or 0,
            }
            for r in trends
        ],
        "topCarriers": [
            {
                "name": r[0],
                "planCount": int(r[1] or 0),
                "totalPremiums": float(r[2] or 0),
                "totalCommissions": float(r[3] or 0),
                "avgCommissionsPerPlan": round(float(r[4] or 0), 0),
            }
            for r in carriers
        ],
    }

    # ── Auto-save to AI Output History so users can compare scores over time ──
    try:
        from backend.routers.ai_history import save_history_internal
        pmpm_str = f"${result['employerPmpm']}/mo PMPM" if result["employerPmpm"] else "PMPM n/a"
        admin_str = (
            f"Admin {admin_pct}th pct" if admin_pct is not None else "Admin n/a"
        )
        comm_str = (
            f"Comm {comm_pct}th pct" if comm_pct is not None else "Comm n/a"
        )
        headline = f"{pmpm_str} · {admin_str} · {comm_str} ({year})"
        snapshot = {
            "headline": headline,
            "employer": {
                "ein": result["employer"]["ein"],
                "name": result["employer"]["name"],
                "state": result["employer"]["state"],
                "city": result["employer"]["city"],
                "industryLabel": result["employer"]["industryLabel"],
                "maxParticipants": result["employer"]["maxParticipants"],
            },
            "year": year,
            "employerPmpm": result["employerPmpm"],
            "natPmpm": result["natPmpm"],
            "percentiles": result["percentiles"],
            "statePercentiles": result["statePercentiles"],
            "totalAdminFees": result["employer"]["totalAdminFees"],
            "totalBrokerCommissions": result["employer"]["totalBrokerCommissions"],
            "totalIncome": result["employer"]["totalIncome"],
            "totalWelfarePremiums": result["employer"]["totalWelfarePremiums"],
        }
        # Score: invert admin-fee percentile so low fees (good) render green
        score = None
        if admin_pct is not None:
            score = float(max(1, min(99, 100 - admin_pct)))
        save_history_internal(
            db,
            "benchmarking",
            clean_ein,
            snapshot,
            user_id=user.id,
            score=score,
            label=f"{result['employer']['name']} · {year}",
        )
    except Exception:
        logger.exception("benchmarking: history save failed (non-fatal)")

    return result


@router.get("/industry")
def get_industry_benchmark(
    business_code: str = Query(min_length=3),
    year: int = Query(default=2023),
    user: models.User = Depends(get_current_user),
):
    """National benchmarks for an industry code."""
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    con = get_duck()
    row = con.execute("""
        SELECT plan_count, avg_participants,
               p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm,
               total_welfare_premiums, total_broker_commissions
        FROM industry_bench
        WHERE BUSINESS_CODE = ? AND FORM_YEAR = ?
    """, [business_code, year]).fetchone()
    if not row:
        raise HTTPException(404, "No benchmark data for this industry/year")
    return {
        "businessCode": business_code,
        "industryLabel": _industry_label(business_code),
        "year": year,
        "planCount": int(row[0] or 0),
        "avgParticipants": round(float(row[1] or 0), 1),
        "p50Income": float(row[2] or 0),
        "p75Income": float(row[3] or 0),
        "p50AdminFees": float(row[4] or 0),
        "p75AdminFees": float(row[5] or 0),
        "p90AdminFees": float(row[6] or 0),
        "p50BrokerComm": float(row[7] or 0),
        "p75BrokerComm": float(row[8] or 0),
        "p90BrokerComm": float(row[9] or 0),
        "totalWelfarePremiums": float(row[10] or 0),
        "totalBrokerCommissions": float(row[11] or 0),
    }


@router.get("/trends")
def get_national_trends(user: models.User = Depends(get_current_user)):
    """National year-over-year market trends."""
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    con = get_duck()
    rows = con.execute("""
        SELECT FORM_YEAR, total_plans, total_participants,
               avg_welfare_premiums, avg_broker_commissions, avg_admin_fees,
               total_welfare_premiums, total_broker_commissions,
               health_plans, stop_loss_plans, drug_plans
        FROM year_trends ORDER BY FORM_YEAR
    """).fetchall()
    return {
        "trends": [
            {
                "year": r[0],
                "totalPlans": r[1],
                "totalParticipants": r[2],
                "avgPremiums": round(float(r[3] or 0), 0),
                "avgCommissions": round(float(r[4] or 0), 0),
                "avgAdminFees": round(float(r[5] or 0), 0),
                "totalPremiums": float(r[6] or 0),
                "totalCommissions": float(r[7] or 0),
                "healthPlans": r[8] or 0,
                "stopLossPlans": r[9] or 0,
                "drugPlans": r[10] or 0,
            }
            for r in rows
        ]
    }


@router.get("/carriers")
def get_carrier_rankings(
    state: Optional[str] = Query(default=None),
    limit: int = Query(default=15, le=50),
    user: models.User = Depends(get_current_user),
):
    """Top carriers by state or nationally."""
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    con = get_duck()
    if state:
        rows = con.execute("""
            SELECT CARRIER_NAME, plan_count, total_premiums, total_commissions,
                   avg_commissions_per_plan, STATE
            FROM carrier_rankings
            WHERE STATE = ?
            ORDER BY total_premiums DESC
            LIMIT ?
        """, [state.upper(), limit]).fetchall()
    else:
        rows = con.execute("""
            SELECT CARRIER_NAME, SUM(plan_count), SUM(total_premiums),
                   SUM(total_commissions), AVG(avg_commissions_per_plan), 'ALL'
            FROM carrier_rankings
            GROUP BY CARRIER_NAME
            ORDER BY SUM(total_premiums) DESC
            LIMIT ?
        """, [limit]).fetchall()
    return {
        "carriers": [
            {
                "name": r[0],
                "planCount": int(r[1] or 0),
                "totalPremiums": float(r[2] or 0),
                "totalCommissions": float(r[3] or 0),
                "avgCommissionsPerPlan": round(float(r[4] or 0), 0),
                "state": r[5],
            }
            for r in rows
        ]
    }


@router.get("/divergence-watch")
def divergence_watch(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Per-employer benchmarking history (percentile + dollar spark points) for every
    EIN the current user has saved a benchmarking lookup for. The frontend runs the
    same `detectDivergence` logic against these series so the "Fees rising at rank"
    flag stays consistent between the gauges and the list/search rows.

    Returns: { "<ein>": { "percentiles": {adminFees,brokerCommissions,totalIncome:[{date,value}]},
                          "dollars": {adminFees,brokerCommissions,totalIncome:[{date,value}]} } }
    """
    rows = (
        db.query(models.AiOutputHistory)
        .filter(
            models.AiOutputHistory.user_id == user.id,
            models.AiOutputHistory.tool == "benchmarking",
        )
        .order_by(models.AiOutputHistory.generated_at.asc())
        .all()
    )

    out: dict[str, dict] = {}
    for row in rows:
        ein = row.entity_id
        if not ein:
            continue
        try:
            payload = json.loads(row.output_json) if row.output_json else {}
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            continue
        date = row.generated_at.isoformat() if row.generated_at else None
        if date is None:
            continue
        entry = out.setdefault(
            ein,
            {
                "percentiles": {"adminFees": [], "brokerCommissions": [], "totalIncome": []},
                "dollars": {"adminFees": [], "brokerCommissions": [], "totalIncome": []},
            },
        )
        pct = payload.get("percentiles") or {}
        for key in ("adminFees", "brokerCommissions", "totalIncome"):
            v = pct.get(key)
            if v is not None:
                try:
                    entry["percentiles"][key].append({"date": date, "value": float(v)})
                except (TypeError, ValueError):
                    pass
        dollar_map = {
            "adminFees": payload.get("totalAdminFees"),
            "brokerCommissions": payload.get("totalBrokerCommissions"),
            "totalIncome": payload.get("totalIncome"),
        }
        for key, v in dollar_map.items():
            if v is not None:
                try:
                    entry["dollars"][key].append({"date": date, "value": float(v)})
                except (TypeError, ValueError):
                    pass

    # This endpoint deliberately returns RAW per-metric series only — it does NOT
    # apply any "fees rising at rank" / divergence flagging server-side. The
    # frontend re-runs `detectDivergence` against these series with the user's
    # tunable thresholds so the list/search-row flags stay identical to the gauge
    # flags. Never reintroduce hardcoded-threshold flagging here or the two will
    # drift apart.
    #
    # Drop EINs that can't possibly produce a divergence on ANY metric. This
    # mirrors `detectDivergence` exactly: it needs the SAME metric to have >=2
    # percentile points AND >=2 dollar points. A cross-metric check (any pct >=2
    # AND any dollar >=2) would be looser and could surface EINs that can never
    # flag — keeping it per-metric guarantees the returned set matches what the
    # frontend can actually flag.
    metrics = ("adminFees", "brokerCommissions", "totalIncome")
    pruned = {
        ein: data
        for ein, data in out.items()
        if any(
            len(data["percentiles"][m]) >= 2 and len(data["dollars"][m]) >= 2
            for m in metrics
        )
    }
    return pruned


def _filing_divergence_map(eins: list[str]) -> dict[str, dict]:
    """
    Build per-EIN benchmarking history (percentile + dollar spark points) straight
    from the employer's own multi-year DOL Form 5500 filings in DuckDB — no prior
    saved lookups required. Mirrors the percentile math in `get_employer_benchmark`
    so the frontend's `detectDivergence` (and DIVERGENCE_THRESHOLDS) behaves the
    same as on the gauges.

    Returns: { "<ein>": { "percentiles": {adminFees,brokerCommissions,totalIncome:[{date,value}]},
                          "dollars":     {adminFees,brokerCommissions,totalIncome:[{date,value}]} } }
    Only EINs that yield >=2 aligned points in some metric are included.
    """
    clean = [e.replace("-", "").strip() for e in eins if e and e.strip()]
    clean = list(dict.fromkeys(clean))  # de-dupe, preserve order
    if not clean or not duck_available():
        return {}
    con = get_duck()
    placeholders = ",".join(["?"] * len(clean))
    rows = con.execute(f"""
        WITH agg AS (
            SELECT EIN, FORM_YEAR,
                   SUM(ADMIN_SERVICE_FEES_AMT) AS admin_fees,
                   SUM(BROKER_COMMISSIONS)     AS broker_comm,
                   SUM(TOTAL_INCOME_AMT)       AS plan_income
            FROM sch_h_2024
            WHERE EIN IN ({placeholders})
            GROUP BY EIN, FORM_YEAR
        )
        SELECT a.EIN, a.FORM_YEAR, a.admin_fees, a.broker_comm, a.plan_income,
               ib.p50_admin_fees, ib.p75_admin_fees, ib.p90_admin_fees,
               ib.p50_broker_comm, ib.p75_broker_comm, ib.p90_broker_comm,
               ib.p50_income, ib.p75_income
        FROM agg a
        LEFT JOIN employers e ON e.EIN = a.EIN
        LEFT JOIN industry_bench ib
               ON ib.BUSINESS_CODE = e.business_code AND ib.FORM_YEAR = a.FORM_YEAR
        ORDER BY a.EIN, a.FORM_YEAR
    """, clean).fetchall()

    out: dict[str, dict] = {}
    for r in rows:
        ein = r[0]
        year = r[1]
        if ein is None or year is None:
            continue
        admin = float(r[2] or 0)
        comm = float(r[3] or 0)
        income = float(r[4] or 0)
        # Industry benchmark for that year (None when the LEFT JOIN missed)
        if r[5] is None:
            continue  # no peer benchmark → can't place a percentile for this year
        p50_admin, p75_admin, p90_admin = float(r[5] or 0), float(r[6] or 0), float(r[7] or 0)
        p50_comm, p75_comm, p90_comm = float(r[8] or 0), float(r[9] or 0), float(r[10] or 0)
        p50_inc, p75_inc = float(r[11] or 0), float(r[12] or 0)

        entry = out.setdefault(
            ein,
            {
                "percentiles": {"adminFees": [], "brokerCommissions": [], "totalIncome": []},
                "dollars": {"adminFees": [], "brokerCommissions": [], "totalIncome": []},
            },
        )
        date = f"{int(year)}-01-01"
        # Only record a point when the employer actually reported a positive value
        # for that line item (a 0 means "not reported", which would distort deltas).
        if admin > 0:
            entry["percentiles"]["adminFees"].append(
                {"date": date, "value": float(_calc_percentile(admin, p50_admin * 0.5, p50_admin, p75_admin, p90_admin))}
            )
            entry["dollars"]["adminFees"].append({"date": date, "value": admin})
        if comm > 0:
            entry["percentiles"]["brokerCommissions"].append(
                {"date": date, "value": float(_calc_percentile(comm, p50_comm * 0.5, p50_comm, p75_comm, p90_comm))}
            )
            entry["dollars"]["brokerCommissions"].append({"date": date, "value": comm})
        if income > 0:
            entry["percentiles"]["totalIncome"].append(
                {"date": date, "value": float(_calc_percentile(income, p50_inc * 0.5, p50_inc, p75_inc, p75_inc * 1.2))}
            )
            entry["dollars"]["totalIncome"].append({"date": date, "value": income})

    # Keep only EINs that can actually produce a divergence (>=2 aligned points in some metric).
    pruned = {
        ein: data
        for ein, data in out.items()
        if any(len(data["dollars"][k]) >= 2 for k in ("adminFees", "brokerCommissions", "totalIncome"))
    }
    return pruned


@router.get("/divergence-filings")
def divergence_filings(
    eins: str = Query(..., description="Comma-separated list of EINs"),
    user: models.User = Depends(get_current_user),
):
    """
    Filing-trend divergence for arbitrary employers, computed directly from their
    own multi-year DOL Form 5500 history in DuckDB. Unlike `/divergence-watch`
    (which only covers EINs the user has personally saved a lookup for twice), this
    flags "fees rising at rank" for any company with 2+ years on file — so search
    rows can surface the signal without prior manual lookups.
    """
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    ein_list = [e for e in eins.split(",") if e.strip()][:60]
    if not ein_list:
        return {}
    return _filing_divergence_map(ein_list)


@router.get("/industries")
def list_industries(
    year: int = Query(default=2023),
    user: models.User = Depends(get_current_user),
):
    """List all available industry codes with plan counts."""
    if not duck_available():
        raise HTTPException(503, "DOL data not available")
    con = get_duck()
    rows = con.execute("""
        SELECT BUSINESS_CODE, plan_count, avg_participants,
               total_welfare_premiums, total_broker_commissions
        FROM industry_bench
        WHERE FORM_YEAR = ?
        ORDER BY plan_count DESC
        LIMIT 60
    """, [year]).fetchall()
    return {
        "industries": [
            {
                "code": r[0],
                "label": _industry_label(r[0] or ""),
                "planCount": int(r[1] or 0),
                "avgParticipants": round(float(r[2] or 0), 0),
                "totalWelfarePremiums": float(r[3] or 0),
                "totalBrokerCommissions": float(r[4] or 0),
            }
            for r in rows
        ]
    }


# ── User preferences (per-broker, cross-device) ────────────────────────────────
# The Benefits Benchmarking "fees rising at rank" divergence thresholds were
# previously stored only in the browser's localStorage, so a broker lost their
# tuned settings on a new device or after clearing their browser. These endpoints
# persist them server-side keyed to the logged-in user (org_id captured
# best-effort) so preferences follow the broker everywhere.

DIVERGENCE_THRESHOLDS_PREF_KEY = "benchmarking.divergence-thresholds"


def _user_org_id(db: Session, user: models.User) -> Optional[str]:
    membership = (
        db.query(models.OrganizationMember)
        .filter_by(user_id=user.id)
        .first()
    )
    return membership.org_id if membership else None


@router.get("/preferences/divergence-thresholds")
def get_divergence_thresholds(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return the broker's saved divergence thresholds, or null if unset."""
    pref = (
        db.query(models.UserPreference)
        .filter_by(user_id=user.id, key=DIVERGENCE_THRESHOLDS_PREF_KEY)
        .first()
    )
    return {"thresholds": pref.value if pref else None}


@router.put("/preferences/divergence-thresholds")
def save_divergence_thresholds(
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Upsert the broker's divergence thresholds."""
    keys = ("percentileFlatPts", "dollarMaterialPct", "dollarMaterialAbs")
    cleaned: dict = {}
    for k in keys:
        v = body.get(k)
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            raise HTTPException(422, f"'{k}' must be a number")
        cleaned[k] = float(v)

    pref = (
        db.query(models.UserPreference)
        .filter_by(user_id=user.id, key=DIVERGENCE_THRESHOLDS_PREF_KEY)
        .first()
    )
    if pref:
        pref.value = cleaned
        pref.org_id = _user_org_id(db, user)
    else:
        pref = models.UserPreference(
            user_id=user.id,
            org_id=_user_org_id(db, user),
            key=DIVERGENCE_THRESHOLDS_PREF_KEY,
            value=cleaned,
        )
        db.add(pref)
    db.commit()
    return {"thresholds": cleaned}


@router.delete("/preferences/divergence-thresholds")
def reset_divergence_thresholds(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Clear the broker's saved divergence thresholds (reset to defaults)."""
    deleted = (
        db.query(models.UserPreference)
        .filter_by(user_id=user.id, key=DIVERGENCE_THRESHOLDS_PREF_KEY)
        .delete()
    )
    db.commit()
    return {"cleared": bool(deleted)}
