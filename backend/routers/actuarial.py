"""
Actuarial Engine IQ™ — Real DuckDB-powered 5500 workbench
4 live tiles + employer search + multi-year profile + AI narrative
"""
import logging
from fastapi import APIRouter, Query, HTTPException, UploadFile, File
from typing import List
from backend.duckdb import get_duck
from datetime import datetime, timezone

logger = logging.getLogger("kincaid.actuarial")

router = APIRouter(prefix="/api/actuarial", tags=["actuarial"])

_NATIONAL = {
    "admin_ratio_pct": 6.27,
    "admin_ratio_p75": 18.98,
    "welfare_prem_median_K": 947.7,
    "invest_fee_pct": 8.0,
    "broker_ratio_pct": 6.3,
}

def _ts():
    return datetime.now(timezone.utc).isoformat()

@router.get("/tiles")
def actuarial_tiles(ein: str = Query(None)):
    duck = get_duck()
    tiles = []

    if ein:
        ein_clean = "".join(c for c in ein if c.isdigit())
        row = duck.execute("""
            SELECT
                ADMIN_SERVICE_FEES_AMT,
                TOTAL_INCOME_AMT,
                WELFARE_PREMIUMS,
                INVEST_MGMT_FEES_AMT,
                TOT_ASSETS_EOY_AMT,
                BROKER_COMMISSIONS,
                PARTICIPANTS,
                FORM_YEAR
            FROM sch_h_2024
            WHERE EIN = ?
            ORDER BY FORM_YEAR DESC LIMIT 1
        """, [ein_clean]).fetchone()
    else:
        row = None

    nat = _NATIONAL

    # Tile 1: Admin Cost Ratio
    if row and row[1] and row[1] > 0:
        admin_pct = round(100.0 * float(row[0] or 0) / float(row[1]), 2)
        admin_delta = round(admin_pct - nat["admin_ratio_pct"], 2)
        admin_bench = max(5, min(95, int(50 - (admin_delta / nat["admin_ratio_p75"]) * 40)))
        defensibility = "red" if admin_pct > nat["admin_ratio_p75"] else ("yellow" if admin_pct > nat["admin_ratio_pct"] else "green")
        admin_note = f"{'+' if admin_delta>=0 else ''}{admin_delta}% vs national median"
    else:
        admin_pct = nat["admin_ratio_pct"]
        admin_delta = 0
        admin_bench = 62
        defensibility = "yellow"
        admin_note = f"National median {nat['admin_ratio_pct']}%"

    tiles.append({
        "tile_key": "ADMIN_RATIO",
        "label": "Admin Cost Ratio",
        "value": admin_pct,
        "unit": "%",
        "delta": admin_note,
        "benchmark_pct": admin_bench,
        "defensibility": defensibility,
        "sub": f"National median {nat['admin_ratio_pct']}% · P75 {nat['admin_ratio_p75']}%",
        "evidence": {"source": "DOL Form 5500 · Schedule H", "year": 2023, "n": 67773},
    })

    # Tile 2: Welfare Premium Load
    if row and row[2] and row[2] > 0:
        welfare_K = round(float(row[2]) / 1000, 1)
        welfare_delta_pct = round((welfare_K - nat["welfare_prem_median_K"]) / nat["welfare_prem_median_K"] * 100, 1)
        w_bench = max(5, min(95, int(50 + welfare_delta_pct * 0.3)))
        w_def = "green" if welfare_K > nat["welfare_prem_median_K"] else "yellow"
        w_note = f"${welfare_K:,.0f}K vs ${nat['welfare_prem_median_K']:,.0f}K national median"
    else:
        welfare_K = nat["welfare_prem_median_K"]
        w_bench = 55
        w_def = "yellow"
        w_note = f"National median ${nat['welfare_prem_median_K']:,.0f}K"

    tiles.append({
        "tile_key": "WELFARE_LOAD",
        "label": "Welfare Premium Load",
        "value": round(welfare_K, 0),
        "unit": "K",
        "delta": w_note,
        "benchmark_pct": w_bench,
        "defensibility": w_def,
        "sub": f"National median ${nat['welfare_prem_median_K']:,.0f}K · P75 $1,701K",
        "evidence": {"source": "DOL Form 5500 · Schedule H", "year": 2023, "n": 62667},
    })

    # Tile 3: Investment Fee Rate (invest mgmt fees / assets)
    if row and row[4] and row[4] > 0:
        fee_pct = round(100.0 * float(row[3] or 0) / float(row[4]), 2)
        fee_delta = round(fee_pct - nat["invest_fee_pct"], 2)
        f_bench = max(5, min(95, int(50 - fee_delta * 3)))
        f_def = "red" if fee_pct > nat["invest_fee_pct"] * 1.5 else ("yellow" if fee_pct > nat["invest_fee_pct"] else "green")
        f_note = f"{'+' if fee_delta>=0 else ''}{fee_delta}% vs {nat['invest_fee_pct']}% national"
    else:
        fee_pct = nat["invest_fee_pct"]
        fee_delta = 0
        f_bench = 62
        f_def = "yellow"
        f_note = f"National median {nat['invest_fee_pct']}%"

    tiles.append({
        "tile_key": "INVEST_FEE_RATE",
        "label": "Investment Fee Rate",
        "value": fee_pct,
        "unit": "%",
        "delta": f_note,
        "benchmark_pct": f_bench,
        "defensibility": f_def,
        "sub": f"Invest. mgmt fees / total assets · National {nat['invest_fee_pct']}%",
        "evidence": {"source": "DOL Form 5500 · Schedule H", "year": 2023, "n": 67773},
    })

    # Tile 4: Broker Commission Ratio (commissions / welfare premiums)
    if row and row[2] and row[2] > 0:
        broker_pct = round(100.0 * float(row[5] or 0) / float(row[2]), 2)
        b_delta = round(broker_pct - nat["broker_ratio_pct"], 2)
        b_bench = max(5, min(95, int(50 - b_delta * 4)))
        b_def = "red" if broker_pct > nat["broker_ratio_pct"] * 2 else ("yellow" if broker_pct > nat["broker_ratio_pct"] else "green")
        b_note = f"{'+' if b_delta>=0 else ''}{b_delta}% vs {nat['broker_ratio_pct']}% national"
    else:
        broker_pct = nat["broker_ratio_pct"]
        b_bench = 60
        b_def = "yellow"
        b_note = f"National median {nat['broker_ratio_pct']}%"

    tiles.append({
        "tile_key": "BROKER_RATIO",
        "label": "Broker Commission Ratio",
        "value": broker_pct,
        "unit": "%",
        "delta": b_note,
        "benchmark_pct": b_bench,
        "defensibility": b_def,
        "sub": f"Commissions / welfare premiums · National {nat['broker_ratio_pct']}%",
        "evidence": {"source": "DOL Form 5500 · Schedule H", "year": 2023, "n": 62667},
    })

    assert len(tiles) == 4
    return {
        "tiles": tiles,
        "ein": ein or "national",
        "generated_at": _ts(),
        "national_benchmarks": nat,
    }


@router.get("/national-trends")
def national_trends():
    """Year-over-year national DOL trends for charts"""
    duck = get_duck()
    rows = duck.execute("""
        SELECT FORM_YEAR,
               total_plans,
               total_participants,
               total_welfare_premiums,
               total_admin_fees,
               total_broker_commissions,
               avg_welfare_premiums,
               avg_broker_commissions
        FROM year_trends
        ORDER BY FORM_YEAR
    """).fetchall()
    return {
        "trends": [
            {
                "year": r[0],
                "plans": r[1],
                "participants": r[2],
                "welfare_premiums": float(r[3] or 0),
                "admin_fees": float(r[4] or 0),
                "broker_commissions": float(r[5] or 0),
                "avg_welfare_prem": float(r[6] or 0),
                "avg_broker_commission": float(r[7] or 0),
            }
            for r in rows
        ]
    }


# ── NEW: Employer Search ───────────────────────────────────────────────────────

@router.get("/states")
def actuarial_states():
    """List all states present in the employers table."""
    duck = get_duck()
    rows = duck.execute("""
        SELECT state, COUNT(*) as cnt
        FROM employers
        WHERE state IS NOT NULL AND state != ''
        GROUP BY state
        ORDER BY state
    """).fetchall()
    return {"states": [{"code": r[0], "count": r[1]} for r in rows]}


@router.get("/search")
def actuarial_search(
    q: str = Query("", min_length=0),
    state: str = Query("", alias="state"),
    limit: int = Query(20, le=50),
):
    """Search employers by name or EIN for actuarial analysis, with optional state filter."""
    duck = get_duck()
    q_clean = q.strip()
    state_clean = state.strip().upper()

    if not q_clean and not state_clean:
        return {"results": [], "count": 0, "query": q}

    SELECT = """
        SELECT EIN, employer_name, latest_plan_name, state, city,
               latest_year, max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, filing_count, has_health, has_stop_loss
        FROM employers
    """
    state_clause = "state = ?" if state_clean else ""
    params: list = []

    if q_clean:
        ein_mode = q_clean.replace("-", "").isdigit()
        if ein_mode:
            where = "EIN LIKE ?"
            params = [f"{q_clean.replace('-','')}%"]
        else:
            where = "(LOWER(employer_name) LIKE LOWER(?) OR LOWER(latest_plan_name) LIKE LOWER(?))"
            params = [f"%{q_clean}%", f"%{q_clean}%"]
        if state_clause:
            where = f"({where}) AND {state_clause}"
            params.append(state_clean)
    else:
        where = state_clause
        params = [state_clean]

    rows = duck.execute(
        f"{SELECT} WHERE {where} ORDER BY max_participants DESC NULLS LAST LIMIT ?",
        params + [limit]
    ).fetchall()

    return {
        "results": [
            {
                "ein": r[0], "name": r[1], "plan_name": r[2],
                "state": r[3], "city": r[4], "latest_year": r[5],
                "participants": r[6], "business_code": r[7],
                "welfare_premiums": float(r[8] or 0),
                "broker_commissions": float(r[9] or 0),
                "admin_fees": float(r[10] or 0),
                "filing_count": r[11],
                "has_health": r[12], "has_stop_loss": r[13],
            }
            for r in rows
        ],
        "count": len(rows),
        "query": q,
        "state_filter": state_clean or None,
    }


# ── NEW: Full Actuarial Profile ────────────────────────────────────────────────

@router.get("/profile/{ein}")
def actuarial_profile(ein: str):
    """Full multi-year actuarial profile for a specific EIN."""
    duck = get_duck()
    ein_clean = "".join(c for c in ein if c.isdigit())

    # Employer summary
    emp = duck.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city,
               latest_year, max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, filing_count, has_health, has_stop_loss
        FROM employers WHERE EIN = ?
    """, [ein_clean]).fetchone()

    if not emp:
        raise HTTPException(status_code=404, detail=f"No employer found for EIN {ein}")

    # Multi-year Schedule H data
    years_rows = duck.execute("""
        SELECT FORM_YEAR, PARTICIPANTS, WELFARE_PREMIUMS, ADMIN_SERVICE_FEES_AMT,
               BROKER_COMMISSIONS, INVEST_MGMT_FEES_AMT, TOTAL_INCOME_AMT,
               TOT_ASSETS_EOY_AMT, TOT_LIABILITIES_EOY_AMT, LEGAL_FEES_AMT,
               PLAN_NAME_LS, CARRIER_NAME, CARRIER_EIN, NAIC_CODE,
               IS_HEALTH, IS_DENTAL, IS_VISION, IS_LIFE, IS_STOP_LOSS, IS_DRUG,
               STATE, CITY, BUSINESS_CODE, WELFARE_BENEFIT_CODES
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC
    """, [ein_clean]).fetchall()

    def safe_pct(num, den):
        return round(100.0 * float(num or 0) / float(den), 2) if den and float(den) > 0 else None

    def safe_f(v):
        return float(v) if v is not None else 0.0

    years = []
    for r in years_rows:
        wp = safe_f(r[2])
        admin = safe_f(r[3])
        broker = safe_f(r[4])
        invest = safe_f(r[5])
        income = safe_f(r[6])
        assets = safe_f(r[7])
        legal = safe_f(r[9])
        parts = r[1] or 0
        years.append({
            "year": r[0],
            "participants": parts,
            "welfare_premiums": wp,
            "admin_fees": admin,
            "broker_commissions": broker,
            "invest_fees": invest,
            "legal_fees": legal,
            "total_income": income,
            "total_assets": safe_f(r[7]),
            "total_liabilities": safe_f(r[8]),
            # Derived ratios
            "admin_ratio_pct":   safe_pct(admin, wp),
            "broker_ratio_pct":  safe_pct(broker, wp),
            "invest_fee_pct":    safe_pct(invest, assets),
            "pmpm": round(wp / (parts * 12), 2) if parts > 0 and wp > 0 else None,
            "total_cost_ppm":    round(income / parts, 2) if parts > 0 and income > 0 else None,
            # Plan characteristics
            "plan_name": r[10],
            "carrier_name": r[11],
            "carrier_ein": r[12],
            "naic_code": r[13],
            "is_health": r[14], "is_dental": r[15], "is_vision": r[16],
            "is_life": r[17],   "is_stop_loss": r[18], "is_drug": r[19],
            "state": r[20], "city": r[21], "business_code": r[22],
            "benefit_codes": r[23],
        })

    # Industry benchmarks (latest year available)
    bc = emp[7]
    bench_year = years[0]["year"] if years else 2023
    bench = duck.execute("""
        SELECT plan_count, avg_participants,
               p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm,
               total_welfare_premiums, total_broker_commissions
        FROM industry_bench
        WHERE BUSINESS_CODE = ? AND FORM_YEAR = ?
    """, [bc, bench_year]).fetchone()

    # State benchmarks
    state_bench = duck.execute("""
        SELECT p50_income, p75_income, p25_income,
               p50_commissions, p75_commissions, p90_commissions,
               plan_count
        FROM state_benchmarks
        WHERE STATE = ? AND BUSINESS_CODE = ? AND FORM_YEAR = ?
        LIMIT 1
    """, [emp[3], bc, bench_year]).fetchone()

    # High commission flag
    flag_row = duck.execute("""
        SELECT commission_pct, BROKER_COMMISSIONS, WELFARE_PREMIUMS, industry_p75
        FROM high_commission_flags
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC
        LIMIT 1
    """, [ein_clean]).fetchone()

    flags = []
    if flag_row:
        pct = round(float(flag_row[0] or 0), 1)
        p75 = float(flag_row[3] or 0)
        flags.append({
            "type": "HIGH_COMMISSION",
            "severity": "red",
            "message": (
                f"Broker commissions at {pct}% of premiums — "
                f"exceeds industry P75 ({p75:,.0f}). "
                "Review under ERISA 408(b)(2) fee disclosure requirements."
            ),
        })

    latest = years[0] if years else {}
    if latest.get("admin_ratio_pct") and latest["admin_ratio_pct"] > 20:
        flags.append({"type": "HIGH_ADMIN", "severity": "yellow",
            "message": f"Admin cost ratio {latest['admin_ratio_pct']}% exceeds national P75 (19%). Review TPA/ASO fee structure."})
    if latest.get("pmpm") and latest["pmpm"] > 2000:
        flags.append({"type": "HIGH_PMPM", "severity": "yellow",
            "message": f"PMPM of ${latest['pmpm']:,.2f} significantly above market — specialty drug exposure or adverse selection likely."})

    industry_bench_out = None
    if bench:
        industry_bench_out = {
            "plan_count": bench[0], "avg_participants": bench[1],
            "p50_income": float(bench[2] or 0), "p75_income": float(bench[3] or 0),
            "p50_admin_fees": float(bench[4] or 0), "p75_admin_fees": float(bench[5] or 0),
            "p90_admin_fees": float(bench[6] or 0),
            "p50_broker_comm": float(bench[7] or 0), "p75_broker_comm": float(bench[8] or 0),
            "p90_broker_comm": float(bench[9] or 0),
        }

    state_bench_out = None
    if state_bench:
        p75_income = float(state_bench[1] or 0)
        state_bench_out = {
            "p50_welfare": float(state_bench[0] or 0),
            "p75_welfare": p75_income,
            "p90_welfare": round(p75_income * 1.35, 2),
            "p50_broker": float(state_bench[3] or 0),
            "p75_broker": float(state_bench[4] or 0),
            "p90_broker": float(state_bench[5] or 0),
            "plan_count": state_bench[6],
        }

    return {
        "employer": {
            "ein": emp[0], "name": emp[1], "plan_name": emp[2],
            "state": emp[3], "city": emp[4], "latest_year": emp[5],
            "max_participants": emp[6], "business_code": emp[7],
            "welfare_premiums": float(emp[8] or 0),
            "broker_commissions": float(emp[9] or 0),
            "admin_fees": float(emp[10] or 0),
            "filing_count": emp[11],
            "has_health": emp[12], "has_stop_loss": emp[13],
        },
        "years": years,
        "industry_bench": industry_bench_out,
        "state_bench": state_bench_out,
        "flags": flags,
        "generated_at": _ts(),
    }


# ── NEW: AI Actuarial Narrative ────────────────────────────────────────────────

@router.post("/ai-narrative")
async def actuarial_ai_narrative(payload: dict):
    """Generate Claude actuarial commentary for a 5500 profile."""
    import os
    from backend import anthropic_compat as anthropic
    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")
    client = anthropic.Anthropic(api_key=api_key, base_url=base_url)

    emp = payload.get("employer", {})
    years = payload.get("years", [])[:3]
    flags = payload.get("flags", [])
    bench = payload.get("industry_bench") or {}
    state_bench = payload.get("state_bench") or {}

    latest = years[0] if years else {}

    prompt = f"""You are a credentialed actuary (FSA, MAAA) and ERISA attorney performing a fiduciary review of a DOL Form 5500 / Schedule H filing. Provide a concise, professional actuarial analysis in the following structured format:

## Plan Overview
Summarize the plan's size, coverage, and filing history.

## Financial Ratios Analysis
Analyze: Admin Cost Ratio ({latest.get('admin_ratio_pct','N/A')}%), Broker Commission Ratio ({latest.get('broker_ratio_pct','N/A')}%), PMPM (${latest.get('pmpm','N/A')}), Investment Fee Rate ({latest.get('invest_fee_pct','N/A')}%).

## Benchmarking Position
Compare against industry peers (P50/P75/P90) and identify percentile positioning.

## Red Flags & Fiduciary Risk
List any actuarial or fiduciary concerns from the data. Be specific about ERISA 404(a) prudent person standard implications.

## Trend Analysis
Note year-over-year trends if multi-year data is available.

## Recommendations
Provide 3–5 actionable recommendations for the plan fiduciary.

DATA:
Employer: {emp.get('name','Unknown')} | EIN: {emp.get('ein','N/A')}
Plan: {emp.get('plan_name','N/A')} | State: {emp.get('state','N/A')}
Participants: {emp.get('max_participants','N/A')} | Filings: {emp.get('filing_count','N/A')}

Latest Year ({latest.get('year','N/A')}) Financials:
- Welfare Premiums: ${latest.get('welfare_premiums',0):,.0f}
- Admin Fees: ${latest.get('admin_fees',0):,.0f} ({latest.get('admin_ratio_pct','N/A')}% of premiums)
- Broker Commissions: ${latest.get('broker_commissions',0):,.0f} ({latest.get('broker_ratio_pct','N/A')}% of premiums)
- Investment Mgmt Fees: ${latest.get('invest_fees',0):,.0f}
- Total Income: ${latest.get('total_income',0):,.0f}
- PMPM: ${latest.get('pmpm','N/A')}
- Carrier: {latest.get('carrier_name','N/A')}
- Stop-Loss: {'Yes' if latest.get('is_stop_loss') else 'No'}

Flags: {'; '.join(f['message'] for f in flags) if flags else 'None'}

Industry Benchmarks (same NAICS code):
- P50 Admin Fees: ${bench.get('p50_admin_fees',0):,.0f}
- P75 Admin Fees: ${bench.get('p75_admin_fees',0):,.0f}
- P50 Broker Comm: ${bench.get('p50_broker_comm',0):,.0f}
- P75 Broker Comm: ${bench.get('p75_broker_comm',0):,.0f}
- Peer Plans in cohort: {bench.get('plan_count','N/A')}

Write in professional actuarial language. Be specific and data-driven. Limit response to ~600 words."""

    try:
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        narrative = msg.content[0].text if msg.content else "Analysis unavailable."
    except Exception as e:
        logger.error(f"[Actuarial AI] Claude error: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

    return {"narrative": narrative, "generated_at": _ts()}


# ── Indiana 5500 Upload & Analysis ─────────────────────────────────────────────

def _extract_pdf_text(data: bytes) -> str:
    """Extract raw text from a PDF using pypdf."""
    import io
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        pages = []
        for page in reader.pages[:20]:  # cap at 20 pages
            pages.append(page.extract_text() or "")
        return "\n".join(pages)[:18000]  # Claude context limit
    except Exception as e:
        logger.warning(f"[Upload] PDF extract failed: {e}")
        return ""


def _get_indiana_benchmarks(duck) -> dict:
    """Pull statewide Indiana benchmarks (all industries combined)."""
    rows = duck.execute("""
        SELECT
            COUNT(*) as plan_count,
            ROUND(AVG(CAST(p50_income AS DOUBLE)),0) as avg_income,
            ROUND(AVG(CAST(p50_commissions AS DOUBLE)),0) as avg_p50_comm,
            ROUND(AVG(CAST(p75_commissions AS DOUBLE)),0) as avg_p75_comm,
            ROUND(AVG(CAST(p90_commissions AS DOUBLE)),0) as avg_p90_comm,
            ROUND(AVG(CAST(p50_admin_fees AS DOUBLE)),0) as avg_p50_admin,
            ROUND(AVG(CAST(p75_admin_fees AS DOUBLE)),0) as avg_p75_admin
        FROM state_benchmarks WHERE STATE = 'IN'
    """).fetchone()
    if not rows:
        return {}
    return {
        "plan_count": rows[0],
        "avg_income": float(rows[1] or 0),
        "p50_commissions": float(rows[2] or 0),
        "p75_commissions": float(rows[3] or 0),
        "p90_commissions": float(rows[4] or 0),
        "p50_admin_fees": float(rows[5] or 0),
        "p75_admin_fees": float(rows[6] or 0),
    }


def _get_indiana_employer_stats(duck) -> dict:
    """Pull aggregate stats for all Indiana employers."""
    row = duck.execute("""
        SELECT
            COUNT(*) as employer_count,
            ROUND(AVG(max_participants), 0) as avg_participants,
            ROUND(MEDIAN(total_welfare_premiums), 0) as median_premiums,
            ROUND(MEDIAN(total_broker_commissions), 0) as median_commissions,
            ROUND(MEDIAN(total_admin_fees), 0) as median_admin_fees,
            ROUND(AVG(CASE WHEN total_welfare_premiums > 0
                THEN total_broker_commissions / total_welfare_premiums * 100 ELSE NULL END), 2) as avg_broker_pct,
            ROUND(AVG(CASE WHEN total_welfare_premiums > 0
                THEN total_admin_fees / total_welfare_premiums * 100 ELSE NULL END), 2) as avg_admin_pct
        FROM employers WHERE state = 'IN'
            AND total_welfare_premiums > 10000
    """).fetchone()
    if not row:
        return {}
    return {
        "employer_count": row[0],
        "avg_participants": float(row[1] or 0),
        "median_premiums": float(row[2] or 0),
        "median_commissions": float(row[3] or 0),
        "median_admin_fees": float(row[4] or 0),
        "avg_broker_pct": float(row[5] or 0),
        "avg_admin_pct": float(row[6] or 0),
    }


@router.post("/upload-indiana")
async def upload_indiana_5500s(files: List[UploadFile] = File(...)):
    """
    Accept up to 5 Form 5500 PDFs, extract text via pypdf,
    use Claude to parse key financials, then benchmark against
    Indiana DOL EFAST2 data and produce a comparative report.
    """
    import os
    from backend import anthropic_compat as anthropic

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 files allowed")

    api_key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    client = anthropic.Anthropic(api_key=api_key, base_url=base_url)
    duck = get_duck()
    in_bench = _get_indiana_benchmarks(duck)
    in_stats = _get_indiana_employer_stats(duck)

    # Step 1: Extract text from each PDF
    extracted: list[dict] = []
    for f in files:
        raw = await f.read()
        text = _extract_pdf_text(raw)
        extracted.append({"filename": f.filename, "text": text, "size_kb": round(len(raw) / 1024, 1)})

    # Step 2: Ask Claude to parse each filing and extract key financials
    extraction_prompt = """You are an ERISA actuary reviewing DOL Form 5500 filings. For each filing below, extract the following fields as a JSON array. Return ONLY valid JSON, no markdown:

[
  {
    "filename": "...",
    "employer_name": "...",
    "ein": "...",
    "plan_year": 2023,
    "participants_beginning": 0,
    "participants_end": 0,
    "total_welfare_premiums": 0.0,
    "total_broker_commissions": 0.0,
    "total_admin_fees": 0.0,
    "total_income": 0.0,
    "has_stop_loss": false,
    "has_health_coverage": false,
    "plan_name": "...",
    "carrier_name": "...",
    "notes": "..."
  }
]

Use 0 for any numeric field not found. Use null for text fields not found. Extract figures from Schedule A (insurance) and Schedule H (financial) sections. Broker commissions are typically in Schedule A, Line 2(d) or similar.

FILINGS:
"""

    for i, ex in enumerate(extracted):
        extraction_prompt += f"\n--- FILING {i+1}: {ex['filename']} ---\n{ex['text'][:4000]}\n"

    try:
        extract_msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": extraction_prompt}],
        )
        raw_json = extract_msg.content[0].text.strip()
        # Strip markdown fences if present
        if raw_json.startswith("```"):
            raw_json = raw_json.split("```")[1]
            if raw_json.startswith("json"):
                raw_json = raw_json[4:]
        import json as _json
        parsed_filings = _json.loads(raw_json.strip())
    except Exception as e:
        logger.error(f"[Upload Indiana] Extraction error: {e}")
        raise HTTPException(status_code=500, detail=f"Claude extraction failed: {e}")

    # Step 3: Compute derived ratios for each filing
    for filing in parsed_filings:
        premiums = float(filing.get("total_welfare_premiums") or 0)
        comms = float(filing.get("total_broker_commissions") or 0)
        admin = float(filing.get("total_admin_fees") or 0)
        parts = float(filing.get("participants_end") or filing.get("participants_beginning") or 1)
        filing["broker_pct"] = round(comms / premiums * 100, 2) if premiums > 0 else None
        filing["admin_pct"] = round(admin / premiums * 100, 2) if premiums > 0 else None
        filing["pmpm"] = round(premiums / parts / 12, 2) if parts > 0 and premiums > 0 else None
        filing["vs_in_broker_median_pct"] = round(
            (comms - in_stats.get("median_commissions", 0)) / max(in_stats.get("median_commissions", 1), 1) * 100, 1
        ) if in_stats.get("median_commissions") else None

    # Step 4: Generate comparative narrative
    filings_summary = "\n".join([
        f"  {i+1}. {f.get('employer_name','Unknown')} | EIN {f.get('ein','N/A')} | {f.get('plan_year','N/A')} | "
        f"{f.get('participants_end','N/A')} participants | "
        f"Premiums ${float(f.get('total_welfare_premiums') or 0):,.0f} | "
        f"Commissions ${float(f.get('total_broker_commissions') or 0):,.0f} ({f.get('broker_pct','N/A')}%) | "
        f"Admin ${float(f.get('total_admin_fees') or 0):,.0f} ({f.get('admin_pct','N/A')}%)"
        for i, f in enumerate(parsed_filings)
    ])

    narrative_prompt = f"""You are a credentialed actuary (FSA, MAAA) and ERISA attorney. You have received {len(parsed_filings)} Form 5500 filings from Indiana employers. Write a professional comparative actuarial intelligence report.

## Indiana DOL EFAST2 Benchmark Context (3,232 IN employers)
- Median broker commissions: ${in_stats.get('median_commissions', 0):,.0f}
- Median admin fees: ${in_stats.get('median_admin_fees', 0):,.0f}
- Median welfare premiums: ${in_stats.get('median_premiums', 0):,.0f}
- Average broker % of premiums: {in_stats.get('avg_broker_pct', 0):.1f}%
- Average admin % of premiums: {in_stats.get('avg_admin_pct', 0):.1f}%
- Average participants per plan: {in_stats.get('avg_participants', 0):,.0f}

## Uploaded Filings
{filings_summary}

Write a structured report with these sections:

## Executive Summary
High-level findings across all {len(parsed_filings)} filings.

## Comparative Analysis
Side-by-side comparison of key metrics across employers. Identify outliers.

## Indiana Benchmarking
How each filing compares to the Indiana DOL median. Flag any above P75.

## Broker Commission Intelligence
Identify any commission structures that warrant fiduciary scrutiny. Reference ERISA 408(b)(2) disclosure requirements.

## Admin Fee Assessment
Compare admin costs across filings and against Indiana medians.

## Red Flags & Fiduciary Risks
Specific ERISA 404(a) concerns across the uploaded filings.

## Recommendations
Actionable recommendations for each employer or across the group.

Write in professional actuarial language. Be specific and data-driven. ~800 words."""

    try:
        narrative_msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": narrative_prompt}],
        )
        narrative = narrative_msg.content[0].text if narrative_msg.content else "Analysis unavailable."
    except Exception as e:
        logger.error(f"[Upload Indiana] Narrative error: {e}")
        narrative = f"Narrative generation failed: {e}"

    return {
        "filings": parsed_filings,
        "indiana_benchmark": in_stats,
        "state_bench_detail": in_bench,
        "narrative": narrative,
        "file_count": len(parsed_filings),
        "generated_at": _ts(),
    }
