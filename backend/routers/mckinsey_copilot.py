import os
import re
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.duckdb import get_duck, duck_available

logger = logging.getLogger("kincaid.mckinsey")

router = APIRouter(prefix="/api/mckinsey", tags=["mckinsey"])

ANTHROPIC_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
ANTHROPIC_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL", "")

MCKINSEY_SYSTEM_PROMPT = """You are the McKinsey Co-Pilot, an elite management consulting AI advisor embedded in the Kincaid IQ Fiduciary Intelligence Platform. You operate with the rigor, precision, and frameworks of a McKinsey & Company senior partner.

## Your Core Principles
- **MECE**: Every analysis is Mutually Exclusive, Collectively Exhaustive
- **Issue Tree**: Decompose every problem into a logical, structured hierarchy
- **Hypothesis-Led**: Lead with a clear hypothesis, then validate with evidence
- **So What?**: Every insight must answer "So what? What should we do?"
- **80/20**: Focus on the vital few that drive the critical many

## Your Frameworks (use contextually)
- **BCG Growth-Share Matrix** — Portfolio prioritization
- **McKinsey 7-S Framework** — Organizational alignment  
- **Porter's Five Forces** — Competitive dynamics
- **SWOT + Strategic Options** — Situation assessment
- **GE-McKinsey Matrix** — Business unit prioritization
- **Pyramid Principle** — Communication structure
- **Value Chain Analysis** — Cost/differentiation mapping
- **3 Horizons of Growth** — Innovation portfolio planning
- **Balanced Scorecard** — KPI alignment to strategy

## Communication Style
- Lead with the key insight (Pyramid Principle: answer first)
- Use crisp, executive-ready language
- Quantify impact wherever possible (revenue, cost, risk)
- Provide specific, actionable recommendations
- Structure output with clear headers and logical flow
- When appropriate, suggest which framework best applies

## Domain Expertise
You have deep expertise in:
- Healthcare benefits & PBM contract optimization
- ERISA fiduciary compliance & governance
- Self-funded employer health plans
- Stop-loss insurance & actuarial analysis
- Private equity & family office portfolio management
- M&A due diligence & valuation
- Operational excellence & cost transformation
- Digital transformation strategy

Always be direct, intellectually honest, and focused on measurable business impact."""


class CoPilotMessage(BaseModel):
    role: str
    content: str


class CoPilotRequest(BaseModel):
    message: str
    history: Optional[List[CoPilotMessage]] = []
    framework: Optional[str] = None
    context: Optional[str] = None


class FrameworkRequest(BaseModel):
    topic: str
    framework: str
    data: Optional[dict] = None


FRAMEWORKS = [
    {
        "id": "issue-tree",
        "name": "Issue Tree",
        "icon": "GitBranch",
        "description": "Decompose a problem MECE into root causes and drivers",
        "prompt_prefix": "Build a complete MECE issue tree for the following problem:",
    },
    {
        "id": "bcg-matrix",
        "name": "BCG Growth-Share Matrix",
        "icon": "LayoutGrid",
        "description": "Classify business units or initiatives by growth and share",
        "prompt_prefix": "Apply the BCG Growth-Share Matrix to analyze the following portfolio:",
    },
    {
        "id": "7s-framework",
        "name": "McKinsey 7-S Framework",
        "icon": "Target",
        "description": "Assess organizational alignment across 7 dimensions",
        "prompt_prefix": "Apply the McKinsey 7-S Framework to evaluate the following organization:",
    },
    {
        "id": "porters-five-forces",
        "name": "Porter's Five Forces",
        "icon": "Shield",
        "description": "Map competitive dynamics in the industry",
        "prompt_prefix": "Apply Porter's Five Forces analysis to the following market or business:",
    },
    {
        "id": "pyramid-principle",
        "name": "Pyramid Principle",
        "icon": "BarChart3",
        "description": "Structure a recommendation using SCQA or answer-first logic",
        "prompt_prefix": "Structure the following recommendation using the Pyramid Principle (answer first, then supporting arguments):",
    },
    {
        "id": "3-horizons",
        "name": "3 Horizons of Growth",
        "icon": "TrendingUp",
        "description": "Map innovation initiatives across defend, extend, and create horizons",
        "prompt_prefix": "Apply the 3 Horizons of Growth framework to plan the following growth strategy:",
    },
    {
        "id": "value-chain",
        "name": "Value Chain Analysis",
        "icon": "Link",
        "description": "Map primary and support activities to identify cost/differentiation leverage",
        "prompt_prefix": "Perform a Value Chain Analysis for the following business or process:",
    },
    {
        "id": "swot",
        "name": "SWOT + Strategic Options",
        "icon": "Crosshair",
        "description": "Assess strengths, weaknesses, opportunities, threats with action options",
        "prompt_prefix": "Conduct a SWOT analysis and derive strategic options for:",
    },
]


# ── Benchmark intent detection & data injection ───────────────────────────────

_BENCHMARK_PATTERNS = [
    r"benchmark\s+(.+?)(?:\s+against|\s+vs\.?|\s+compared?|\s+for\s+me|$)",
    r"how\s+does\s+(.+?)\s+(?:compare|rank|perform|stack\s+up)",
    r"(?:analyze|analyse|look\s+up|pull\s+up|show\s+me|find)\s+(.+?)\s+(?:benchmark|plan|benefits|premiums|commissions|admin)",
    r"(.+?)\s+(?:benefits\s+benchmark|plan\s+benchmark|dol\s+data|form\s+5500|admin\s+fees|broker\s+commissions?)",
    r"what\s+(?:are|is)\s+(?:the\s+)?(.+?)\s+(?:paying|spending)\s+(?:for|on)\s+(?:benefits|admin|commissions?)",
    r"(?:run|get|give\s+me\s+a?)\s+(?:a\s+)?(?:benchmarking?\s+(?:report|analysis|on)\s+)(.+?)$",
]

def _extract_company_name(message: str) -> Optional[str]:
    """Extract a company name from a benchmarking query."""
    text = message.strip()
    for pattern in _BENCHMARK_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip().rstrip(".,?!")
            # Filter out generic words that aren't company names
            if len(name) >= 2 and name.lower() not in (
                "me", "this", "company", "employer", "them", "it", "us", "our", "their"
            ):
                return name
    return None


def _fmt_dollars(n: float) -> str:
    if n >= 1_000_000_000:
        return f"${n/1_000_000_000:.1f}B"
    if n >= 1_000_000:
        return f"${n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"${n/1_000:.0f}K"
    return f"${n:.0f}"


def _calc_percentile(value: float, p50: float, p75: float, p90: float) -> str:
    if value <= 0 or p50 <= 0:
        return "N/A"
    if value <= p50:
        pct = max(1, int(value / p50 * 50))
        return f"~{pct}th (below median)"
    elif value <= p75:
        span = p75 - p50
        pct = 50 + (int((value - p50) / span * 25) if span > 0 else 12)
        return f"~{pct}th (above median)"
    elif value <= p90:
        span = p90 - p75
        pct = 75 + (int((value - p75) / span * 15) if span > 0 else 7)
        return f"~{pct}th (top quartile)"
    else:
        return f">90th (top decile)"


def _fetch_benchmark_context(company_name: str) -> Optional[str]:
    """
    Look up a company by name in the DOL DuckDB database and return a rich
    text context block for injection into the Claude prompt.
    Returns None if not found or DuckDB unavailable.
    """
    if not duck_available():
        return None

    try:
        con = get_duck()

        # Search by name
        rows = con.execute("""
            SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
                   max_participants, business_code,
                   total_welfare_premiums, total_broker_commissions,
                   total_admin_fees, total_income, has_health, has_stop_loss, filing_count
            FROM employers
            WHERE UPPER(employer_name) LIKE UPPER(?)
            ORDER BY max_participants DESC NULLS LAST
            LIMIT 5
        """, [f"%{company_name}%"]).fetchall()

        if not rows:
            return None

        emp = rows[0]
        ein         = emp[0]
        name        = emp[1]
        plan_name   = emp[2] or "Benefit Plan"
        state       = emp[3] or "N/A"
        city        = emp[4] or "N/A"
        year        = emp[5]
        participants = int(emp[6] or 1)
        biz_code    = emp[7] or ""
        welfare     = float(emp[8] or 0)
        commissions = float(emp[9] or 0)
        admin_fees  = float(emp[10] or 0)
        income      = float(emp[11] or 0)
        has_health  = emp[12]
        has_stoploss = emp[13]
        filings     = emp[14]

        pmpm = round(welfare / participants / 12, 2) if participants > 0 else 0

        # Pull national industry benchmark
        nat = con.execute("""
            SELECT plan_count, avg_participants,
                   p50_income, p75_income,
                   p50_admin_fees, p75_admin_fees, p90_admin_fees,
                   p50_broker_comm, p75_broker_comm, p90_broker_comm,
                   total_welfare_premiums
            FROM industry_bench
            WHERE BUSINESS_CODE = ? AND FORM_YEAR = ?
        """, [biz_code, year or 2023]).fetchone()

        # Try adjacent year
        if not nat and biz_code:
            nat = con.execute("""
                SELECT plan_count, avg_participants,
                       p50_income, p75_income,
                       p50_admin_fees, p75_admin_fees, p90_admin_fees,
                       p50_broker_comm, p75_broker_comm, p90_broker_comm,
                       total_welfare_premiums
                FROM industry_bench
                WHERE BUSINESS_CODE = ?
                ORDER BY ABS(FORM_YEAR - ?) LIMIT 1
            """, [biz_code, year or 2023]).fetchone()

        # Pull state benchmark
        state_b = con.execute("""
            SELECT plan_count, p50_admin_fees, p75_admin_fees, p90_admin_fees,
                   p50_commissions, p75_commissions, p90_commissions
            FROM state_benchmarks
            WHERE STATE = ? AND BUSINESS_CODE = ? AND FORM_YEAR = ?
        """, [state, biz_code, year or 2023]).fetchone()

        # Pull top carriers in state
        carriers = con.execute("""
            SELECT CARRIER_NAME, plan_count, total_premiums
            FROM carrier_rankings WHERE STATE = ?
            ORDER BY total_premiums DESC LIMIT 5
        """, [state]).fetchall()

        # Alternative matches
        alt_names = [r[1] for r in rows[1:4]]

        # ── Build context block ──────────────────────────────────────────
        lines = [
            f"## DOL EFAST2 Benchmarking Data — {name}",
            f"",
            f"**Employer:** {name}",
            f"**Plan Name:** {plan_name}",
            f"**EIN:** {ein}",
            f"**Location:** {city}, {state}",
            f"**Latest Filing Year:** {year}",
            f"**Covered Lives (Participants):** {participants:,}",
            f"**Industry (NAICS/DOL Code):** {biz_code}",
            f"**Plan Types:** {'Health ✓' if has_health else 'Health ✗'}  |  {'Stop-Loss ✓' if has_stoploss else 'Stop-Loss ✗'}",
            f"**DOL Filings on Record:** {filings}",
            f"",
            f"### Plan Financials (Cumulative across all filing years)",
            f"- Total Welfare Premiums: {_fmt_dollars(welfare)}",
            f"- Total Broker Commissions: {_fmt_dollars(commissions)}",
            f"- Total Admin Fees: {_fmt_dollars(admin_fees)}",
            f"- Total Plan Income: {_fmt_dollars(income)}",
            f"- Estimated PMPM (welfare premiums / lives / 12): ${pmpm:,.2f}",
        ]

        if nat:
            p50_admin = float(nat[4] or 0)
            p75_admin = float(nat[5] or 0)
            p90_admin = float(nat[6] or 0)
            p50_comm  = float(nat[7] or 0)
            p75_comm  = float(nat[8] or 0)
            p90_comm  = float(nat[9] or 0)
            p50_inc   = float(nat[2] or 0)
            p75_inc   = float(nat[3] or 0)
            peer_count = int(nat[0] or 0)
            avg_part  = round(float(nat[1] or 0), 0)

            admin_pct = _calc_percentile(admin_fees, p50_admin, p75_admin, p90_admin)
            comm_pct  = _calc_percentile(commissions, p50_comm, p75_comm, p90_comm)

            lines += [
                f"",
                f"### National Industry Peer Benchmarks ({peer_count:,} peer plans, avg {avg_part:,.0f} participants)",
                f"",
                f"| Metric | This Employer | P50 (Median) | P75 | P90 |",
                f"|--------|--------------|-------------|-----|-----|",
                f"| Admin Fees | {_fmt_dollars(admin_fees)} | {_fmt_dollars(p50_admin)} | {_fmt_dollars(p75_admin)} | {_fmt_dollars(p90_admin)} |",
                f"| Broker Commissions | {_fmt_dollars(commissions)} | {_fmt_dollars(p50_comm)} | {_fmt_dollars(p75_comm)} | {_fmt_dollars(p90_comm)} |",
                f"| Plan Income | {_fmt_dollars(income)} | {_fmt_dollars(p50_inc)} | {_fmt_dollars(p75_inc)} | N/A |",
                f"",
                f"**Percentile Positions:**",
                f"- Admin Fees: {admin_pct}",
                f"- Broker Commissions: {comm_pct}",
            ]
        else:
            lines.append(f"\n_No national peer benchmark data found for industry code {biz_code}._")

        if state_b:
            sp50a = float(state_b[1] or 0)
            sp75a = float(state_b[2] or 0)
            sp90a = float(state_b[3] or 0)
            sp50c = float(state_b[4] or 0)
            sp75c = float(state_b[5] or 0)
            sp90c = float(state_b[6] or 0)
            state_admin_pct = _calc_percentile(admin_fees, sp50a, sp75a, sp90a)
            state_comm_pct  = _calc_percentile(commissions, sp50c, sp75c, sp90c)
            lines += [
                f"",
                f"### {state} State Peer Benchmarks ({int(state_b[0] or 0):,} peers in {state})",
                f"- Admin Fees: {_fmt_dollars(admin_fees)} vs. P50={_fmt_dollars(sp50a)} / P75={_fmt_dollars(sp75a)} / P90={_fmt_dollars(sp90a)} → {state_admin_pct}",
                f"- Commissions: {_fmt_dollars(commissions)} vs. P50={_fmt_dollars(sp50c)} / P75={_fmt_dollars(sp75c)} / P90={_fmt_dollars(sp90c)} → {state_comm_pct}",
            ]

        if carriers:
            lines += [
                f"",
                f"### Top Carriers in {state}",
            ]
            for c in carriers:
                lines.append(f"- {c[0]}: {c[1]:,} plans, {_fmt_dollars(float(c[2] or 0))} total premiums")

        if alt_names:
            lines += [
                f"",
                f"_Note: Also found similar employers: {', '.join(alt_names)}_",
            ]

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"[BenchmarkContext] Failed for '{company_name}': {exc}")
        return None


def _get_anthropic_client():
    try:
        from backend import anthropic_compat as anthropic
        return anthropic.Anthropic(
            api_key=ANTHROPIC_API_KEY,
            base_url=ANTHROPIC_BASE_URL,
        )
    except Exception as e:
        logger.error(f"Failed to initialize Anthropic client: {e}")
        return None


@router.get("/frameworks")
def get_frameworks():
    return {"frameworks": FRAMEWORKS}


@router.post("/chat")
def chat(
    body: CoPilotRequest,
    user: models.User = Depends(get_current_user),
):
    client = _get_anthropic_client()
    if not client:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    messages = []
    for msg in (body.history or []):
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})

    user_content = body.message

    # ── Auto-detect benchmarking intent and inject DOL data ──────────────────
    benchmark_context: Optional[str] = None
    company_name = _extract_company_name(body.message)
    if company_name:
        logger.info(f"[McKinsey] Benchmark intent detected → '{company_name}'")
        benchmark_context = _fetch_benchmark_context(company_name)
        if benchmark_context:
            logger.info(f"[McKinsey] DOL data injected for '{company_name}'")

    # Apply framework prefix
    if body.framework:
        fw = next((f for f in FRAMEWORKS if f["id"] == body.framework), None)
        if fw:
            user_content = f"{fw['prompt_prefix']}\n\n{body.message}"

    # Layer context: page context → benchmark DOL data → user message
    context_blocks: list[str] = []
    if body.context:
        context_blocks.append(f"**Page Context:** {body.context}")
    if benchmark_context:
        context_blocks.append(benchmark_context)
        context_blocks.append(
            "**Instruction:** Use the DOL EFAST2 benchmark data above as your primary source. "
            "Provide a McKinsey-grade analysis of this employer's benefits plan performance, "
            "percentile positioning, cost efficiency, and 2-3 specific actionable recommendations. "
            "Call out any red flags (e.g., broker commissions above P90, PMPM significantly above peers). "
            "End with a clear 'Bottom Line' summary."
        )

    if context_blocks:
        user_content = "\n\n".join(context_blocks) + "\n\n" + user_content

    messages.append({"role": "user", "content": user_content})

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=MCKINSEY_SYSTEM_PROMPT,
            messages=messages,
        )
        content = response.content[0]
        reply = content.text if content.type == "text" else ""
        return {
            "reply": reply,
            "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
            "benchmark_used": benchmark_context is not None,
            "benchmark_company": company_name if benchmark_context else None,
        }
    except Exception as e:
        logger.error(f"McKinsey Co-Pilot error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/live-alerts")
def live_alerts():
    """Return top high-commission flag employers for the co-pilot alert feed."""
    if not duck_available():
        return {"alerts": [], "total_flags": 0}
    duck = get_duck()
    try:
        rows = duck.execute("""
            SELECT EIN, SPONS_DFE_NAME, STATE, FORM_YEAR,
                   commission_pct, BROKER_COMMISSIONS, WELFARE_PREMIUMS, industry_p75
            FROM high_commission_flags
            WHERE commission_pct IS NOT NULL
            ORDER BY commission_pct DESC NULLS LAST
            LIMIT 8
        """).fetchall()
        total = duck.execute("SELECT COUNT(*) FROM high_commission_flags").fetchone()[0]
        return {
            "alerts": [
                {
                    "ein": r[0],
                    "name": r[1],
                    "state": r[2],
                    "year": r[3],
                    "commission_pct": round(float(r[4] or 0), 1),
                    "broker_commissions": float(r[5] or 0),
                    "welfare_premiums": float(r[6] or 0),
                    "industry_p75": float(r[7] or 0),
                }
                for r in rows
            ],
            "total_flags": int(total),
        }
    except Exception as e:
        logger.error(f"Live alerts error: {e}")
        return {"alerts": [], "total_flags": 0}


@router.post("/framework-analysis")
def framework_analysis(
    body: FrameworkRequest,
    user: models.User = Depends(get_current_user),
):
    client = _get_anthropic_client()
    if not client:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    fw = next((f for f in FRAMEWORKS if f["id"] == body.framework), None)
    if not fw:
        raise HTTPException(status_code=400, detail="Unknown framework")

    data_context = ""
    if body.data:
        data_context = f"\n\nRelevant data: {json.dumps(body.data, indent=2)}"

    prompt = f"{fw['prompt_prefix']}\n\n{body.topic}{data_context}"

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=MCKINSEY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0]
        return {
            "framework": fw["name"],
            "topic": body.topic,
            "analysis": content.text if content.type == "text" else "",
        }
    except Exception as e:
        logger.error(f"Framework analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
