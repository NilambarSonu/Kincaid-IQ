"""
Broker Compensation Index (formerly Shady Broker Index) — fiduciary-grade broker scoring engine.

Score model (0–100, higher = cleaner):
  - 10 weighted categories computed from DOL Form 5500 Schedule A/H filings
  - Per-category score, severity, evidence, and remediation
  - Overall = weighted average; rating tier mirrors PBM Contract Clarity 360 (excellent/good/fair/concern/red_flag)

Endpoints:
  GET /api/shady-broker/analyze/{ein}
  GET /api/shady-broker/demo
  GET /api/shady-broker/list   (recent shady candidates)
"""
import sys
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException

sys.path.insert(0, "/home/runner/workspace")
from backend.duckdb import get_duck
from backend.manifest_utils import register_manifest_path

router = APIRouter(prefix="/api/shady-broker", tags=["shady-broker"])

register_manifest_path("/api/shady-broker/analyze/{ein}")
register_manifest_path("/api/shady-broker/demo")

DEMO_EIN = "231352204"  # Tower Health Medical Plan (per replit.md)

# National DOL benchmarks (derived from DuckDB high_commission_flags view).
# Conservative anchors; the analyzer will refresh from DuckDB when available.
DEFAULT_BENCHMARKS = {
    "median_broker_pct_income": 1.4,
    "p75_broker_pct_income":    3.2,
    "p90_broker_pct_income":   12.5,
    "median_broker_per_member": 38.0,
    "p75_broker_per_member":   142.0,
    "p90_broker_per_member":   480.0,
    "median_admin_pct_income":  2.1,
    "p90_admin_pct_income":     9.4,
}


# ─── helpers ─────────────────────────────────────────────────────────────────

def _get_multiyear(ein: str) -> List[Dict[str, Any]]:
    duck = get_duck()
    rows = duck.execute("""
        SELECT
            FORM_YEAR, PLAN_NAME_LS, SPONS_DFE_NAME,
            CITY, STATE, BUSINESS_CODE,
            PARTICIPANTS, CARRIER_NAME,
            TOTAL_INCOME_AMT, TOT_ASSETS_EOY_AMT,
            ADMIN_SERVICE_FEES_AMT, BROKER_COMMISSIONS, WELFARE_PREMIUMS,
            INVEST_MGMT_FEES_AMT, LEGAL_FEES_AMT,
            IS_HEALTH, IS_DENTAL, IS_VISION, IS_LIFE, IS_STOP_LOSS, IS_DRUG
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC
    """, [ein]).fetchall()
    cols = ['form_year','plan_name','sponsor_name','city','state','biz_code',
            'participants','carrier','total_income','assets_eoy',
            'admin_fees','broker_commissions','welfare_premiums',
            'invest_fees','legal_fees',
            'is_health','is_dental','is_vision','is_life','is_stop_loss','is_drug']
    return [dict(zip(cols, r)) for r in rows]


def _safe(v: Any, default: float = 0.0) -> float:
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _rating(score: float) -> str:
    if score >= 85: return "excellent"
    if score >= 70: return "good"
    if score >= 55: return "fair"
    if score >= 35: return "concern"
    return "red_flag"


def _severity(score: float) -> str:
    if score >= 70: return "low"
    if score >= 50: return "medium"
    if score >= 30: return "high"
    return "critical"


# ─── category scorers (each returns score 0..100 + evidence) ────────────────

def _score_commission_magnitude(years: List[dict], b: dict) -> dict:
    """C1 — Is the broker commission % above national P90?"""
    pcts = []
    for y in years:
        inc = _safe(y["total_income"])
        comm = _safe(y["broker_commissions"])
        if inc > 0 and comm > 0:
            pcts.append((y["form_year"], comm / inc * 100))
    if not pcts:
        return {"score": 100, "rating": "excellent", "value": None,
                "narrative": "No broker commissions filed.", "evidence": []}
    avg = sum(p for _, p in pcts) / len(pcts)
    p90 = b["p90_broker_pct_income"]
    p50 = b["median_broker_pct_income"]
    # 0..100 inverse curve: avg <= P50 = 100, avg >= 3×P90 = 0
    score = max(0.0, min(100.0, 100 - ((avg - p50) / (3 * p90 - p50)) * 100)) if avg > p50 else 100
    evidence = [{"year": y, "value_pct": round(p, 2), "vs_p90": round(p - p90, 2)} for y, p in pcts]
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": round(avg, 2),
        "unit": "% of plan income",
        "benchmark_p50": p50,
        "benchmark_p90": p90,
        "narrative": (
            f"Average broker commission is {avg:.1f}% of plan income. "
            f"National median is {p50:.1f}%; P90 (excessive trigger) is {p90:.1f}%."
        ),
        "evidence": evidence,
    }


def _score_income_ratio(years: List[dict], b: dict) -> dict:
    """C2 — Years where commission exceeds 50% of plan income."""
    triggers = []
    for y in years:
        inc = _safe(y["total_income"]); comm = _safe(y["broker_commissions"])
        if inc > 0 and comm / inc > 0.5:
            triggers.append({"year": y["form_year"], "pct": round(comm / inc * 100, 1)})
    if not triggers:
        return {"score": 100, "rating": "excellent", "value": 0,
                "narrative": "No year shows commission exceeding 50% of plan income.", "evidence": []}
    score = max(0.0, 100 - len(triggers) * 40)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": len(triggers),
        "unit": "years over 50% of plan income",
        "narrative": (
            f"{len(triggers)} year(s) show broker commission greater than half of total plan income — "
            f"a structural impossibility absent prohibited compensation routing."
        ),
        "evidence": triggers,
    }


def _score_admin_coupling(years: List[dict]) -> dict:
    """C3 — Commission == admin to the dollar across years (408(b)(2) trigger)."""
    matches = []
    for y in years:
        comm = _safe(y["broker_commissions"]); adm = _safe(y["admin_fees"])
        if comm > 0 and adm > 0 and abs(comm - adm) / max(comm, adm) < 0.01:
            matches.append({"year": y["form_year"], "commission": comm, "admin": adm})
    if not matches:
        return {"score": 100, "rating": "excellent", "value": 0,
                "narrative": "Broker commissions and admin fees are independent line items.", "evidence": []}
    pct_years = len(matches) / max(len([y for y in years if _safe(y["broker_commissions"]) > 0]), 1)
    score = max(0.0, 100 - pct_years * 100)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": len(matches),
        "unit": "years where comm = admin (±1%)",
        "narrative": (
            f"In {len(matches)} year(s), broker commissions match admin service fees to the dollar — "
            f"ERISA §408(b)(2) requires distinct, disclosed compensation. Identity coupling is a hard flag."
        ),
        "evidence": matches,
    }


def _score_per_member(years: List[dict], b: dict) -> dict:
    """C4 — Broker $/member vs national P90."""
    ppms = []
    for y in years:
        parts = int(y["participants"] or 0); comm = _safe(y["broker_commissions"])
        if parts > 0 and comm > 0:
            ppms.append((y["form_year"], comm / parts))
    if not ppms:
        return {"score": 100, "rating": "excellent", "value": None,
                "narrative": "No per-member commission data filed.", "evidence": []}
    avg = sum(v for _, v in ppms) / len(ppms)
    p90 = b["p90_broker_per_member"]; p50 = b["median_broker_per_member"]
    score = max(0.0, min(100.0, 100 - ((avg - p50) / (3 * p90 - p50)) * 100)) if avg > p50 else 100
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": round(avg, 0),
        "unit": "$/member/year (avg)",
        "benchmark_p50": p50,
        "benchmark_p90": p90,
        "narrative": (
            f"Average broker compensation is ${avg:,.0f} per covered member per year. "
            f"National median is ${p50:.0f}; P90 is ${p90:.0f}."
        ),
        "evidence": [{"year": y, "value_per_member": round(v, 0)} for y, v in ppms],
    }


def _score_carrier_switch_stability(years: List[dict]) -> dict:
    """C5 — Carrier changed but commission unchanged (≤5%)."""
    sorted_y = sorted(years, key=lambda x: x["form_year"])
    transitions = []
    for i in range(1, len(sorted_y)):
        prev, cur = sorted_y[i-1], sorted_y[i]
        if (prev["carrier"] or "") != (cur["carrier"] or "") and prev["carrier"] and cur["carrier"]:
            pc = _safe(prev["broker_commissions"]); cc = _safe(cur["broker_commissions"])
            if pc > 0 and cc > 0 and abs(pc - cc) / max(pc, cc) < 0.05:
                transitions.append({
                    "from_year": prev["form_year"], "to_year": cur["form_year"],
                    "from_carrier": prev["carrier"], "to_carrier": cur["carrier"],
                    "from_comm": pc, "to_comm": cc,
                })
    if not transitions:
        return {"score": 100, "rating": "excellent", "value": 0,
                "narrative": "No suspect carrier transitions detected.", "evidence": []}
    score = max(0.0, 100 - len(transitions) * 35)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": len(transitions),
        "unit": "unchanged-fee carrier switches",
        "narrative": (
            f"{len(transitions)} carrier transition(s) left broker compensation unchanged within 5%. "
            f"A re-marketing event should drive material commission renegotiation."
        ),
        "evidence": transitions,
    }


def _score_multi_year_trend(years: List[dict]) -> dict:
    """C6 — Commission grew >25% YoY while participants/income did not."""
    sorted_y = sorted(years, key=lambda x: x["form_year"])
    flags = []
    for i in range(1, len(sorted_y)):
        prev, cur = sorted_y[i-1], sorted_y[i]
        pc = _safe(prev["broker_commissions"]); cc = _safe(cur["broker_commissions"])
        if pc <= 0:
            continue
        comm_growth = (cc - pc) / pc
        if comm_growth <= 0.25:
            continue
        pp = int(prev["participants"] or 0); cp = int(cur["participants"] or 0)
        part_growth = (cp - pp) / pp if pp > 0 else 0
        if part_growth < comm_growth / 2:
            flags.append({
                "from_year": prev["form_year"], "to_year": cur["form_year"],
                "commission_growth_pct": round(comm_growth * 100, 1),
                "participant_growth_pct": round(part_growth * 100, 1),
            })
    if not flags:
        return {"score": 100, "rating": "excellent", "value": 0,
                "narrative": "Commission trend tracks participant growth.", "evidence": []}
    score = max(0.0, 100 - len(flags) * 30)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": len(flags),
        "unit": "unjustified YoY commission jumps",
        "narrative": (
            f"{len(flags)} year-over-year commission jump(s) outpace participant growth by 2× or more — "
            f"compensation rose without a workload basis."
        ),
        "evidence": flags,
    }


def _score_disclosure_hygiene(years: List[dict]) -> dict:
    """C7 — Indirect compensation disclosure proxy (Schedule A reporting completeness)."""
    fee_only = [y for y in years if _safe(y["broker_commissions"]) > 0 and _safe(y["admin_fees"]) == 0]
    if not fee_only:
        return {"score": 90, "rating": "excellent", "value": 0,
                "narrative": "Schedule A discloses both broker commissions and admin fees in all years.", "evidence": []}
    score = max(0.0, 100 - len(fee_only) * 25)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": len(fee_only),
        "unit": "years with commission but no admin disclosure",
        "narrative": (
            f"{len(fee_only)} year(s) report broker commissions without a corresponding admin-fee disclosure. "
            f"§408(b)(2) requires direct + indirect compensation in the same notice."
        ),
        "evidence": [{"year": y["form_year"], "commission": _safe(y["broker_commissions"])} for y in fee_only],
    }


def _score_income_excess_trigger(years: List[dict]) -> dict:
    """C8 — Catastrophic: commission > plan income (single year)."""
    over = []
    for y in years:
        inc = _safe(y["total_income"]); comm = _safe(y["broker_commissions"])
        if inc > 0 and comm > inc:
            over.append({"year": y["form_year"], "pct": round(comm / inc * 100, 1), "excess": comm - inc})
    if not over:
        return {"score": 100, "rating": "excellent", "value": 0,
                "narrative": "No year shows commission exceeding total plan income.", "evidence": []}
    score = max(0.0, 100 - len(over) * 60)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": len(over),
        "unit": "catastrophic over-income years",
        "narrative": (
            f"{len(over)} year(s) show broker compensation in excess of total plan income — "
            f"this is structurally impossible from premiums alone and triggers EBSA investigative review."
        ),
        "evidence": over,
    }


def _score_concentration(years: List[dict]) -> dict:
    """C9 — Single carrier with high commission for 3+ consecutive years."""
    sorted_y = sorted(years, key=lambda x: x["form_year"])
    streak = 0; max_streak = 0; current_carrier = None
    for y in sorted_y:
        c = (y["carrier"] or "").strip().upper()
        comm_pct = (_safe(y["broker_commissions"]) / _safe(y["total_income"]) * 100) if _safe(y["total_income"]) > 0 else 0
        if c and c == current_carrier and comm_pct > 5:
            streak += 1
        else:
            streak = 1 if comm_pct > 5 else 0
            current_carrier = c
        max_streak = max(max_streak, streak)
    if max_streak < 3:
        return {"score": 100, "rating": "excellent", "value": max_streak,
                "narrative": "No prolonged single-carrier high-commission concentration.", "evidence": []}
    score = max(20.0, 100 - (max_streak - 2) * 25)
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": max_streak,
        "unit": "consecutive years, same carrier, high commission",
        "narrative": (
            f"Single-carrier high-commission concentration spans {max_streak} consecutive years. "
            f"Loyalty without a competitive bid breaches the prudent-expert standard."
        ),
        "evidence": [{"carrier": current_carrier, "streak_years": max_streak}],
    }


def _score_admin_inflation(years: List[dict], b: dict) -> dict:
    """C10 — Admin fees above national P90 (proxy for hidden broker comp inside admin)."""
    pcts = []
    for y in years:
        inc = _safe(y["total_income"]); adm = _safe(y["admin_fees"])
        if inc > 0 and adm > 0:
            pcts.append((y["form_year"], adm / inc * 100))
    if not pcts:
        return {"score": 100, "rating": "excellent", "value": None,
                "narrative": "No admin-fee data filed.", "evidence": []}
    avg = sum(p for _, p in pcts) / len(pcts)
    p90 = b["p90_admin_pct_income"]; p50 = b["median_admin_pct_income"]
    score = max(0.0, min(100.0, 100 - ((avg - p50) / (3 * p90 - p50)) * 100)) if avg > p50 else 100
    return {
        "score": round(score, 1),
        "rating": _rating(score),
        "value": round(avg, 2),
        "unit": "% admin/income (avg)",
        "benchmark_p50": p50,
        "benchmark_p90": p90,
        "narrative": (
            f"Admin-fee ratio averages {avg:.1f}% of plan income. P90 trigger is {p90:.1f}%. "
            f"Elevated admin can mask indirect broker compensation."
        ),
        "evidence": [{"year": y, "admin_pct": round(p, 2)} for y, p in pcts],
    }


# ─── analyzer ────────────────────────────────────────────────────────────────

CATEGORY_DEFS = [
    {"id": 1,  "key": "magnitude",   "label": "Commission Magnitude",      "weight": 0.16, "fn": _score_commission_magnitude},
    {"id": 2,  "key": "income_ratio","label": "Income Ratio",              "weight": 0.10, "fn": _score_income_ratio},
    {"id": 3,  "key": "admin_couple","label": "Admin Fee Coupling",        "weight": 0.14, "fn": _score_admin_coupling},
    {"id": 4,  "key": "per_member",  "label": "Per-Member Cost",           "weight": 0.10, "fn": _score_per_member},
    {"id": 5,  "key": "carrier_swap","label": "Carrier-Switch Stability",  "weight": 0.08, "fn": _score_carrier_switch_stability},
    {"id": 6,  "key": "trend",       "label": "Multi-Year Trend",          "weight": 0.10, "fn": _score_multi_year_trend},
    {"id": 7,  "key": "disclosure",  "label": "Disclosure Hygiene",        "weight": 0.08, "fn": _score_disclosure_hygiene},
    {"id": 8,  "key": "over_income", "label": "Income-Excess Trigger",     "weight": 0.12, "fn": _score_income_excess_trigger},
    {"id": 9,  "key": "concentration","label": "Concentration Risk",       "weight": 0.06, "fn": _score_concentration},
    {"id": 10, "key": "admin_infl",  "label": "Admin Fee Inflation",       "weight": 0.06, "fn": _score_admin_inflation},
]


def _analyze(ein: str) -> Dict[str, Any]:
    years = _get_multiyear(ein)
    if not years:
        raise HTTPException(404, f"No DOL filings found for EIN {ein}")

    benchmarks = DEFAULT_BENCHMARKS.copy()
    # opportunistic refresh from DuckDB high_commission_flags view
    try:
        duck = get_duck()
        row = duck.execute("""
            SELECT
                MEDIAN(broker_pct_income), QUANTILE_CONT(broker_pct_income, 0.75),
                QUANTILE_CONT(broker_pct_income, 0.90)
            FROM high_commission_flags
            WHERE broker_pct_income IS NOT NULL AND broker_pct_income > 0
        """).fetchone()
        if row and row[0]:
            benchmarks["median_broker_pct_income"] = round(float(row[0]), 2)
            benchmarks["p75_broker_pct_income"]    = round(float(row[1] or 0), 2)
            benchmarks["p90_broker_pct_income"]    = round(float(row[2] or 0), 2)
    except Exception:
        pass

    categories = []
    weighted_sum = 0.0
    total_weight = 0.0
    for cat in CATEGORY_DEFS:
        result = cat["fn"](years, benchmarks) if cat["fn"].__code__.co_argcount == 2 else cat["fn"](years)
        weighted_sum += result["score"] * cat["weight"]
        total_weight += cat["weight"]
        categories.append({
            "id": cat["id"],
            "key": cat["key"],
            "label": cat["label"],
            "weight": cat["weight"],
            "severity": _severity(result["score"]),
            **result,
        })

    overall_score = round(weighted_sum / total_weight, 1) if total_weight else 0
    rating = _rating(overall_score)

    # Aggregate financials
    sorted_y = sorted(years, key=lambda x: x["form_year"])
    total_comm = sum(_safe(y["broker_commissions"]) for y in years)
    total_admin = sum(_safe(y["admin_fees"]) for y in years)
    total_income = sum(_safe(y["total_income"]) for y in years)
    latest = sorted_y[-1] if sorted_y else {}
    latest_comm = _safe(latest.get("broker_commissions"))
    latest_parts = int(latest.get("participants") or 0)

    # Key findings (severity-ordered)
    key_findings = []
    for c in sorted(categories, key=lambda x: x["score"]):
        if c["severity"] == "critical":
            key_findings.append({"severity": "critical", "category": c["label"], "text": c["narrative"]})
        elif c["severity"] == "high":
            key_findings.append({"severity": "warning",  "category": c["label"], "text": c["narrative"]})
    for c in categories:
        if c["score"] >= 85:
            key_findings.append({"severity": "positive", "category": c["label"], "text": c["narrative"]})

    # Exposure / opportunity scenarios
    annual_run = latest_comm
    exposure = {
        "annual_at_risk": round(annual_run, 0),
        "five_year_at_risk": round(annual_run * 5, 0),
        "total_documented_overcharge": round(total_comm, 0),
        "scenarios": [
            {
                "name": "Full BOR Takeover (current rate)",
                "annual": round(annual_run, 0),
                "five_year": round(annual_run * 5, 0),
                "strategy": "Fiduciary audit opener",
            },
            {
                "name": "Restructure to P75 Benchmark",
                "annual": round(annual_run * 0.5, 0),
                "five_year": round(annual_run * 0.5 * 5, 0),
                "strategy": "Savings-based pitch",
            },
            {
                "name": f"{len(years)}-Year Documented Overcharge",
                "annual": 0,
                "five_year": round(total_comm, 0),
                "strategy": "Clawback / forensic angle",
            },
        ],
    }

    # Engagement script
    over_pcts = [round(_safe(y["broker_commissions"]) / _safe(y["total_income"]) * 100, 1)
                 for y in years if _safe(y["total_income"]) > 0]
    engagement = {
        "opener": (
            f"We ran your Form 5500 filings through the Kincaid Broker Index Engine and scored "
            f"the broker on your plan at {overall_score} out of 100 — tier '{rating}'. "
            f"{key_findings[0]['text'] if key_findings else ''} "
            f"We'd like to walk you through the documentation and your options."
        ),
        "talking_points": [c["narrative"] for c in categories if c["score"] < 55][:5],
        "citations": [
            "ERISA §408(b)(2) — Reasonable contract; direct + indirect comp disclosure",
            "29 CFR 2550.408b-2(c) — Required disclosure timing",
            "ERISA §404(a)(1)(A)(ii) — Defraying reasonable expenses",
            "DOL Field Assistance Bulletin 2012-02",
        ],
    }

    return {
        "ein": ein,
        "sponsor_name": latest.get("sponsor_name") or "Unknown Sponsor",
        "plan_name":    latest.get("plan_name"),
        "city":         latest.get("city"),
        "state":        latest.get("state"),
        "biz_code":     latest.get("biz_code"),
        "years_analyzed": len(years),
        "year_range":   f"{sorted_y[0]['form_year']}–{sorted_y[-1]['form_year']}" if sorted_y else "",
        "latest_year":  latest.get("form_year"),
        "latest_participants": latest_parts,
        "overall_score": overall_score,
        "rating": rating,
        "criticals": sum(1 for c in categories if c["severity"] == "critical"),
        "highs":     sum(1 for c in categories if c["severity"] == "high"),
        "totals": {
            "total_broker_commissions": round(total_comm, 0),
            "total_admin_fees":         round(total_admin, 0),
            "total_plan_income":        round(total_income, 0),
            "avg_broker_pct_income":    round((total_comm / total_income * 100) if total_income else 0, 2),
        },
        "categories": categories,
        "key_findings": key_findings,
        "exposure": exposure,
        "engagement": engagement,
        "benchmarks": benchmarks,
        "yearly": [
            {
                "year":        y["form_year"],
                "plan_name":   y["plan_name"],
                "carrier":     y["carrier"],
                "participants": int(y["participants"] or 0),
                "total_income": round(_safe(y["total_income"]), 0),
                "broker_commissions": round(_safe(y["broker_commissions"]), 0),
                "admin_fees": round(_safe(y["admin_fees"]), 0),
                "welfare_premiums": round(_safe(y["welfare_premiums"]), 0),
                "broker_pct_income": round((_safe(y["broker_commissions"]) / _safe(y["total_income"]) * 100), 2) if _safe(y["total_income"]) > 0 else None,
                "broker_per_member": round((_safe(y["broker_commissions"]) / int(y["participants"] or 1)), 0) if (y["participants"] or 0) > 0 else None,
            }
            for y in sorted_y
        ],
    }


# ─── endpoints ───────────────────────────────────────────────────────────────

@router.get("/analyze/{ein}")
def analyze(ein: str):
    return _analyze(ein.strip())


@router.get("/demo")
def demo():
    return _analyze(DEMO_EIN)


@router.get("/list")
def list_candidates(limit: int = 20):
    """Top shady candidates by broker_pct_income from the high_commission_flags view."""
    safe_limit = max(1, min(int(limit or 20), 100))
    duck = get_duck()
    try:
        rows = duck.execute(f"""
            SELECT ein, sponsor_name, broker_pct_income, broker_commissions, form_year
            FROM high_commission_flags
            WHERE broker_pct_income IS NOT NULL
            ORDER BY broker_pct_income DESC
            LIMIT {safe_limit}
        """).fetchall()
        return {"candidates": [
            {
                "ein": r[0], "sponsor_name": r[1],
                "broker_pct_income": round(float(r[2] or 0), 2),
                "broker_commissions": round(float(r[3] or 0), 0),
                "form_year": r[4],
            } for r in rows
        ]}
    except Exception as e:
        return {"candidates": [], "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════
# SBI PLATFORM EXPANSION — Leaderboards, Broker Profiles, AI Narrative, CFO Calc
# ═══════════════════════════════════════════════════════════════════════════

import re
from pydantic import BaseModel
from backend.routers.ai import call_anthropic


def _slugify(s: str) -> str:
    if not s:
        return "unknown"
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "unknown"


# ─── Leaderboards ────────────────────────────────────────────────────────────

@router.get("/leaderboard/{kind}")
def leaderboard(kind: str, limit: int = 25):
    """kind ∈ {most_shady, cleanest, top_brokers, state_waste}"""
    safe_limit = max(1, min(int(limit or 25), 100))
    duck = get_duck()
    if kind == "most_shady":
        rows = duck.execute(f"""
            SELECT EIN, SPONS_DFE_NAME, STATE, CITY,
                   SUM(BROKER_COMMISSIONS) as total_comm,
                   SUM(TOTAL_INCOME_AMT) as total_income,
                   AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                       THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct,
                   COUNT(*) as years
            FROM sch_h_2024
            WHERE BROKER_COMMISSIONS > 0 AND TOTAL_INCOME_AMT > 0
            GROUP BY EIN, SPONS_DFE_NAME, STATE, CITY
            HAVING avg_pct > 8 AND years >= 2
            ORDER BY avg_pct DESC, total_comm DESC
            LIMIT {safe_limit}
        """).fetchall()
        return {"kind": kind, "rows": [
            {"ein": r[0], "sponsor": r[1], "state": r[2], "city": r[3],
             "total_commissions": round(float(r[4] or 0), 0),
             "total_income":      round(float(r[5] or 0), 0),
             "avg_pct_income":    round(float(r[6] or 0), 2),
             "years": int(r[7])}
            for r in rows
        ]}
    if kind == "cleanest":
        rows = duck.execute(f"""
            SELECT EIN, SPONS_DFE_NAME, STATE,
                   SUM(BROKER_COMMISSIONS) as total_comm,
                   SUM(TOTAL_INCOME_AMT) as total_income,
                   AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                       THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct,
                   COUNT(*) as years
            FROM sch_h_2024
            WHERE BROKER_COMMISSIONS > 0 AND TOTAL_INCOME_AMT > 1000000
            GROUP BY EIN, SPONS_DFE_NAME, STATE
            HAVING avg_pct < 1.0 AND years >= 3
            ORDER BY total_income DESC
            LIMIT {safe_limit}
        """).fetchall()
        return {"kind": kind, "rows": [
            {"ein": r[0], "sponsor": r[1], "state": r[2],
             "total_commissions": round(float(r[3] or 0), 0),
             "total_income":      round(float(r[4] or 0), 0),
             "avg_pct_income":    round(float(r[5] or 0), 2),
             "years": int(r[6])}
            for r in rows
        ]}
    if kind == "top_brokers":
        rows = duck.execute(f"""
            SELECT CARRIER_NAME,
                   COUNT(DISTINCT EIN) as employers,
                   SUM(BROKER_COMMISSIONS) as total_comm,
                   AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                       THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct,
                   SUM(PARTICIPANTS) as total_lives
            FROM sch_h_2024
            WHERE CARRIER_NAME IS NOT NULL AND CARRIER_NAME != ''
              AND BROKER_COMMISSIONS > 0
            GROUP BY CARRIER_NAME
            HAVING employers >= 3
            ORDER BY total_comm DESC
            LIMIT {safe_limit}
        """).fetchall()
        return {"kind": kind, "rows": [
            {"slug": _slugify(r[0]), "carrier": r[0],
             "employers": int(r[1]),
             "total_commissions": round(float(r[2] or 0), 0),
             "avg_pct_income":    round(float(r[3] or 0), 2),
             "lives_covered":     int(r[4] or 0)}
            for r in rows
        ]}
    if kind == "state_waste":
        rows = duck.execute(f"""
            SELECT STATE,
                   COUNT(DISTINCT EIN) as employers,
                   SUM(BROKER_COMMISSIONS) as total_comm,
                   SUM(TOTAL_INCOME_AMT) as total_income,
                   AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                       THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct
            FROM sch_h_2024
            WHERE STATE IS NOT NULL AND STATE != ''
              AND BROKER_COMMISSIONS > 0
            GROUP BY STATE
            HAVING employers >= 5
            ORDER BY avg_pct DESC
            LIMIT {safe_limit}
        """).fetchall()
        return {"kind": kind, "rows": [
            {"state": r[0],
             "employers": int(r[1]),
             "total_commissions": round(float(r[2] or 0), 0),
             "total_income":      round(float(r[3] or 0), 0),
             "avg_pct_income":    round(float(r[4] or 0), 2)}
            for r in rows
        ]}
    raise HTTPException(400, f"Unknown leaderboard kind: {kind}")


# ─── Broker (Carrier) Aggregate Profile ──────────────────────────────────────

@router.get("/broker/{slug}")
def broker_profile(slug: str):
    """Aggregate intelligence for a broker/carrier across all employers they touch."""
    duck = get_duck()
    # Resolve slug → carrier name in DuckDB (slugify in-SQL, O(1) match)
    row = duck.execute("""
        SELECT CARRIER_NAME
        FROM sch_h_2024
        WHERE CARRIER_NAME IS NOT NULL AND CARRIER_NAME != ''
          AND BROKER_COMMISSIONS > 0
          AND trim(BOTH '-' FROM regexp_replace(lower(CARRIER_NAME), '[^a-z0-9]+', '-', 'g')) = ?
        LIMIT 1
    """, [slug]).fetchone()
    if not row:
        raise HTTPException(404, f"No broker matching slug {slug}")
    carrier = row[0]

    # Aggregate metrics
    agg = duck.execute("""
        SELECT COUNT(DISTINCT EIN) as employers,
               COUNT(*) as filings,
               SUM(BROKER_COMMISSIONS) as total_comm,
               SUM(ADMIN_SERVICE_FEES_AMT) as total_admin,
               SUM(TOTAL_INCOME_AMT) as total_income,
               SUM(PARTICIPANTS) as total_lives,
               AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                   THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct,
               MIN(FORM_YEAR), MAX(FORM_YEAR)
        FROM sch_h_2024
        WHERE CARRIER_NAME = ?
    """, [carrier]).fetchone()

    # Top employers by commission
    top_employers = duck.execute("""
        SELECT EIN, SPONS_DFE_NAME, STATE,
               SUM(BROKER_COMMISSIONS) as total_comm,
               AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                   THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct
        FROM sch_h_2024
        WHERE CARRIER_NAME = ? AND BROKER_COMMISSIONS > 0
        GROUP BY EIN, SPONS_DFE_NAME, STATE
        ORDER BY total_comm DESC
        LIMIT 20
    """, [carrier]).fetchall()

    # State distribution
    states = duck.execute("""
        SELECT STATE, COUNT(DISTINCT EIN) as n
        FROM sch_h_2024
        WHERE CARRIER_NAME = ? AND STATE IS NOT NULL AND STATE != ''
        GROUP BY STATE
        ORDER BY n DESC
        LIMIT 15
    """, [carrier]).fetchall()

    # Year trend
    yearly = duck.execute("""
        SELECT FORM_YEAR,
               COUNT(DISTINCT EIN) as employers,
               SUM(BROKER_COMMISSIONS) as comm,
               AVG(CASE WHEN TOTAL_INCOME_AMT > 0
                   THEN BROKER_COMMISSIONS / TOTAL_INCOME_AMT * 100 END) as avg_pct
        FROM sch_h_2024
        WHERE CARRIER_NAME = ?
        GROUP BY FORM_YEAR
        ORDER BY FORM_YEAR
    """, [carrier]).fetchall()

    avg_pct = float(agg[6] or 0)
    # SBI score for the broker (lower avg_pct = cleaner)
    if avg_pct <= 1.4:    sbi = 90
    elif avg_pct <= 3.2:  sbi = 75
    elif avg_pct <= 6.0:  sbi = 60
    elif avg_pct <= 12.5: sbi = 40
    else:                  sbi = max(10, int(100 - avg_pct * 2))

    return {
        "slug": slug,
        "carrier": carrier,
        "sbi_score": sbi,
        "rating": _rating(sbi),
        "summary": {
            "employers_touched": int(agg[0] or 0),
            "filings_analyzed":  int(agg[1] or 0),
            "total_commissions": round(float(agg[2] or 0), 0),
            "total_admin":       round(float(agg[3] or 0), 0),
            "total_income":      round(float(agg[4] or 0), 0),
            "lives_covered":     int(agg[5] or 0),
            "avg_pct_income":    round(avg_pct, 2),
            "year_range":        f"{agg[7]}–{agg[8]}" if agg[7] else "",
        },
        "top_employers": [
            {"ein": r[0], "sponsor": r[1], "state": r[2],
             "total_commissions": round(float(r[3] or 0), 0),
             "avg_pct_income":    round(float(r[4] or 0), 2)}
            for r in top_employers
        ],
        "state_distribution": [{"state": s[0], "employers": int(s[1])} for s in states],
        "yearly": [
            {"year": int(y[0]),
             "employers": int(y[1] or 0),
             "commissions": round(float(y[2] or 0), 0),
             "avg_pct_income": round(float(y[3] or 0), 2)}
            for y in yearly
        ],
    }


# ─── CFO Leakage Calculator ──────────────────────────────────────────────────

class LeakageInput(BaseModel):
    employees: int
    current_admin_pct: float = 3.0
    current_broker_pct: float = 2.5
    annual_premium_per_employee: float = 14400.0


@router.post("/leakage")
def leakage(payload: LeakageInput):
    """Estimate annual fiduciary leakage from broker overpayment."""
    p = payload
    total_premium = p.employees * p.annual_premium_per_employee
    plan_income = total_premium  # proxy
    current_broker_dollars = plan_income * (p.current_broker_pct / 100)
    p50_broker_dollars     = plan_income * (DEFAULT_BENCHMARKS["median_broker_pct_income"] / 100)
    p75_broker_dollars     = plan_income * (DEFAULT_BENCHMARKS["p75_broker_pct_income"] / 100)
    current_admin_dollars  = plan_income * (p.current_admin_pct / 100)
    p50_admin_dollars      = plan_income * (DEFAULT_BENCHMARKS["median_admin_pct_income"] / 100)
    annual_leakage = max(0.0, current_broker_dollars - p50_broker_dollars) + \
                     max(0.0, current_admin_dollars  - p50_admin_dollars)
    return {
        "inputs": p.model_dump(),
        "totals": {
            "total_premium": round(total_premium, 0),
            "current_broker_dollars": round(current_broker_dollars, 0),
            "current_admin_dollars":  round(current_admin_dollars, 0),
        },
        "benchmarks": {
            "p50_broker_dollars": round(p50_broker_dollars, 0),
            "p75_broker_dollars": round(p75_broker_dollars, 0),
            "p50_admin_dollars":  round(p50_admin_dollars, 0),
        },
        "annual_leakage": round(annual_leakage, 0),
        "five_year_leakage": round(annual_leakage * 5, 0),
        "ten_year_leakage":  round(annual_leakage * 10, 0),
        "narrative": (
            f"With {p.employees:,} employees at ${p.annual_premium_per_employee:,.0f} avg premium, "
            f"current broker compensation ({p.current_broker_pct:.1f}% of premium) plus admin "
            f"({p.current_admin_pct:.1f}%) is approximately "
            f"${annual_leakage:,.0f} above the DOL P50 transparency benchmark — "
            f"${annual_leakage*5:,.0f} over 5 years."
        ),
    }


# ─── AI Investigative Narrative ──────────────────────────────────────────────

@router.get("/narrative/{ein}")
async def narrative(ein: str):
    """AI-generated investigative narrative (Anthropic Claude)."""
    import asyncio
    report = await asyncio.to_thread(_analyze, ein.strip())
    flags = "\n".join(
        f"- {c['label']} (score {c['score']}/100, {c['severity']}): {c['narrative']}"
        for c in report["categories"] if c["score"] < 70
    )
    system = (
        "You are a senior investigative analyst at the Broker Compensation Index — a fiduciary "
        "transparency platform for employer health plans. Voice: McKinsey partner overlaid "
        "with Pulitzer-grade investigative journalist. Tone: data-driven, legally cautious, "
        "executive-grade. Frame all conclusions as RISK INDICATORS, PROBABILITY SIGNALS, or "
        "TRANSPARENCY GAPS — never as direct accusations. Never name individual brokers as "
        "bad actors; speak in terms of structural anomalies in the data. Reference ERISA "
        "§408(b)(2), §404(a), and DOL EFAST2 Form 5500 evidence by name."
    )
    user = f"""Plan sponsor: {report['sponsor_name']} (EIN {ein})
Overall SBI score: {report['overall_score']}/100 ({report['rating']})
Years analyzed: {report['year_range']}
Total broker commissions (all years): ${report['totals']['total_broker_commissions']:,.0f}
Average broker % of plan income: {report['totals']['avg_broker_pct_income']:.2f}%

Failing categories:
{flags}

Produce a 4-section investigative brief. Format as JSON:
{{
  "headline": "1-sentence McKinsey-style framing of the central anomaly",
  "why_this_scores_poorly": "2-paragraph analysis of the structural pattern in the data",
  "hidden_compensation_signals": ["bullet 1", "bullet 2", "bullet 3"],
  "cfo_questions": ["question 1 the CFO should ask", "...", "...", "...", "..."],
  "fiduciary_concerns": ["specific ERISA/DOL concern 1", "..."],
  "next_step": "1-sentence recommended action for the plan sponsor"
}}

Return only the JSON. No markdown fences."""
    try:
        raw = await call_anthropic(f"{system}\n\n{user}")
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip("`").strip()
        import json
        data = json.loads(raw)
        return {"ein": ein, "sponsor": report["sponsor_name"], "score": report["overall_score"], "narrative": data}
    except Exception as e:
        return {
            "ein": ein, "sponsor": report["sponsor_name"], "score": report["overall_score"],
            "narrative": {
                "headline": "Investigative narrative temporarily unavailable.",
                "why_this_scores_poorly": str(e),
                "hidden_compensation_signals": [], "cfo_questions": [],
                "fiduciary_concerns": [], "next_step": "",
            },
        }


# ─── Live DOL EFAST2 5500 Name Search ────────────────────────────────────────

@router.get("/search")
def search_5500(q: str, limit: int = 12):
    """Live name search across the DOL Form 5500 corpus (sch_h_2024 / 936K filings)."""
    q = (q or "").strip()
    if len(q) < 2:
        return {"q": q, "results": []}
    safe_limit = max(1, min(int(limit or 12), 50))
    duck = get_duck()
    # Aggregate to one row per EIN; take the most recent year's snapshot
    rows = duck.execute(f"""
        WITH matches AS (
            SELECT EIN, SPONS_DFE_NAME, STATE, CITY, FORM_YEAR, PARTICIPANTS,
                   BROKER_COMMISSIONS, TOTAL_INCOME_AMT, CARRIER_NAME,
                   row_number() OVER (PARTITION BY EIN ORDER BY FORM_YEAR DESC) AS rn
            FROM sch_h_2024
            WHERE SPONS_DFE_NAME ILIKE ? OR EIN = ?
        )
        SELECT EIN, SPONS_DFE_NAME, STATE, CITY, FORM_YEAR, PARTICIPANTS,
               BROKER_COMMISSIONS, TOTAL_INCOME_AMT, CARRIER_NAME
        FROM matches
        WHERE rn = 1
        ORDER BY PARTICIPANTS DESC NULLS LAST
        LIMIT {safe_limit}
    """, [f"%{q}%", q]).fetchall()
    return {
        "q": q,
        "source": "DOL EFAST2 · Form 5500 Schedule H · {} filings".format(
            duck.execute("SELECT COUNT(*) FROM sch_h_2024").fetchone()[0]
        ),
        "results": [
            {
                "ein":          r[0],
                "sponsor":      r[1],
                "state":        r[2],
                "city":         r[3],
                "latest_year":  int(r[4]) if r[4] else None,
                "participants": int(r[5]) if r[5] else 0,
                "broker_commissions": float(r[6] or 0),
                "total_income":       float(r[7] or 0),
                "carrier":      r[8],
            }
            for r in rows
        ],
    }
