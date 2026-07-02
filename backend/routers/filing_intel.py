"""
Sales Console OS™ — Module 11
Form 5500 Intelligence Distribution & Opportunity Management System

Transforms public DOL Form 5500 filings (DuckDB `sch_h_2024`, 936K filings) into a
prioritized, routed, and accountable opportunity-distribution network.

Pipeline:  Ingest → Normalize → Score → Route → Distribute → Track

Endpoints (prefix /api/filing-intel):
  GET  /feed         — scored + routed filing pipeline (filters: state, vertical, tier, min_score, q, limit)
  GET  /stats        — accountability + pipeline aggregate metrics
  GET  /filing/{ein} — Filing Command Center (profile, score breakdown, benchmark analysis, relationships)
  GET  /consultants  — Consultant & Influencer rankings (carrier influence network)
  GET  /digest       — Executive Distribution Engine (daily digest + weekly/monthly rollups)
  POST /ai-brief     — AI Prioritization & Recommendation Engine for a single filing
"""

import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend import models
from backend.auth import get_current_user
from backend.duckdb import get_duck

logger = logging.getLogger("kincaid.filing_intel")

router = APIRouter(prefix="/api/filing-intel", tags=["filing-intel"])


# ─── Reference maps ───────────────────────────────────────────────────────────

# Regulatory strictness by state (mirrors Sales IQ regulatory intelligence; default 5.0).
_STATE_STRICTNESS: dict[str, float] = {
    "CA": 9.7, "NY": 9.1, "MA": 8.5, "WA": 8.0, "NJ": 7.8, "CO": 7.6, "IL": 7.4,
    "TX": 6.5, "FL": 6.0, "PA": 6.4, "OH": 5.8, "GA": 5.6,
}

_STATE_REGION: dict[str, str] = {
    "CT": "Northeast", "ME": "Northeast", "MA": "Northeast", "NH": "Northeast",
    "NJ": "Northeast", "NY": "Northeast", "PA": "Northeast", "RI": "Northeast",
    "VT": "Northeast", "DC": "Northeast", "DE": "Northeast", "MD": "Northeast",
    "AL": "Southeast", "AR": "Southeast", "FL": "Southeast", "GA": "Southeast",
    "KY": "Southeast", "LA": "Southeast", "MS": "Southeast", "NC": "Southeast",
    "SC": "Southeast", "TN": "Southeast", "VA": "Southeast", "WV": "Southeast",
    "IL": "Midwest", "IN": "Midwest", "IA": "Midwest", "KS": "Midwest",
    "MI": "Midwest", "MN": "Midwest", "MO": "Midwest", "NE": "Midwest",
    "ND": "Midwest", "OH": "Midwest", "SD": "Midwest", "WI": "Midwest",
    "TX": "South", "OK": "South", "AZ": "South", "NM": "South",
    "AK": "West", "CA": "West", "CO": "West", "HI": "West", "ID": "West",
    "MT": "West", "NV": "West", "OR": "West", "UT": "West", "WA": "West", "WY": "West",
}

# NAICS 2-digit prefix → sales vertical.
_VERTICALS = ["Healthcare", "Manufacturing", "Education", "Government", "Technology", "Retail", "General"]


def _vertical_for(business_code: Optional[str]) -> str:
    if not business_code:
        return "General"
    p2 = business_code[:2]
    if p2 == "62":
        return "Healthcare"
    if p2 in ("31", "32", "33"):
        return "Manufacturing"
    if p2 == "61":
        return "Education"
    if p2 == "92":
        return "Government"
    if p2 in ("51", "54"):
        return "Technology"
    if p2 in ("44", "45"):
        return "Retail"
    return "General"


def _region_for(state: Optional[str]) -> str:
    return _STATE_REGION.get((state or "").upper(), "National")


def _is_health(welfare_codes: Optional[str]) -> bool:
    return bool(welfare_codes) and "4A" in welfare_codes


# ─── Scoring engine (Opportunity Intelligence Score, 0–100, fully explainable) ──

def _f(v) -> float:
    """DuckDB returns decimal.Decimal — coerce to float; None → 0.0."""
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _score_filing(row: dict) -> dict:
    """
    Compute the Opportunity Intelligence Score from real filing attributes and
    industry benchmarks. Returns the score, tier, weighted components (each with
    its own contribution + plain-English detail), routing, and modeled $ value.
    """
    participants = int(row.get("participants") or 0)
    income = _f(row.get("total_income"))
    admin = _f(row.get("admin_fees"))
    broker = _f(row.get("broker_commissions"))
    health = _is_health(row.get("welfare_codes"))
    state = (row.get("state") or "").upper()

    ind_admin_p75 = _f(row.get("ind_admin_p75"))
    ind_admin_p90 = _f(row.get("ind_admin_p90"))
    ind_admin_p50 = _f(row.get("ind_admin_p50"))
    ind_brk_p75 = _f(row.get("ind_brk_p75"))
    ind_brk_p90 = _f(row.get("ind_brk_p90"))

    comps: list[dict] = []

    # 1 — Covered lives / employer size (max 25)
    if participants >= 10000:
        s1, d1 = 25, f"{participants:,} covered lives — enterprise scale"
    elif participants >= 5000:
        s1, d1 = 20, f"{participants:,} covered lives — large market"
    elif participants >= 2000:
        s1, d1 = 15, f"{participants:,} covered lives — upper mid-market"
    elif participants >= 1000:
        s1, d1 = 11, f"{participants:,} covered lives — mid-market"
    elif participants >= 250:
        s1, d1 = 7, f"{participants:,} covered lives — small group"
    else:
        s1, d1 = 3, f"{participants:,} covered lives — micro group"
    comps.append({"label": "Covered Lives", "score": s1, "max": 25, "detail": d1})

    # 2 — Health plan spend (max 20)
    if income >= 100_000_000:
        s2, d2 = 20, f"${income/1e6:,.0f}M plan income — top-decile spend"
    elif income >= 50_000_000:
        s2, d2 = 17, f"${income/1e6:,.0f}M plan income — major spend"
    elif income >= 10_000_000:
        s2, d2 = 13, f"${income/1e6:,.1f}M plan income — substantial"
    elif income >= 1_000_000:
        s2, d2 = 8, f"${income/1e6:,.1f}M plan income — material"
    elif income > 0:
        s2, d2 = 4, f"${income/1e3:,.0f}K plan income — modest"
    else:
        s2, d2 = 0, "No reported plan income (likely fully-insured)"
    comps.append({"label": "Health Plan Spend", "score": s2, "max": 20, "detail": d2})

    # 3 — Administrative fee excess vs industry benchmark (max 20)
    if admin > 0 and ind_admin_p90 > 0 and admin >= ind_admin_p90:
        s3, d3 = 20, f"Admin fees ${admin/1e3:,.0f}K exceed industry P90 (${ind_admin_p90/1e3:,.0f}K)"
    elif admin > 0 and ind_admin_p75 > 0 and admin >= ind_admin_p75:
        s3, d3 = 15, f"Admin fees ${admin/1e3:,.0f}K above industry P75 (${ind_admin_p75/1e3:,.0f}K)"
    elif admin > 0 and ind_admin_p50 > 0 and admin >= ind_admin_p50:
        s3, d3 = 9, f"Admin fees ${admin/1e3:,.0f}K above industry median"
    elif admin > 0:
        s3, d3 = 4, f"Admin fees ${admin/1e3:,.0f}K at/below median"
    else:
        s3, d3 = 2, "No admin fee disclosure — opacity flag"
    comps.append({"label": "Admin Fee Excess", "score": s3, "max": 20, "detail": d3})

    # 4 — Broker commission opportunity vs benchmark (max 15)
    if broker > 0 and ind_brk_p90 > 0 and broker >= ind_brk_p90:
        s4, d4 = 15, f"Broker comp ${broker/1e3:,.0f}K exceeds industry P90"
    elif broker > 0 and ind_brk_p75 > 0 and broker >= ind_brk_p75:
        s4, d4 = 11, f"Broker comp ${broker/1e3:,.0f}K above industry P75"
    elif broker > 0:
        s4, d4 = 6, f"Broker comp ${broker/1e3:,.0f}K disclosed"
    else:
        s4, d4 = 3, "No broker comp disclosed — CAA 2021 gap"
    comps.append({"label": "Broker Comp Opportunity", "score": s4, "max": 15, "detail": d4})

    # 5 — PBM / Rx indicator (max 10)
    if health and income >= 10_000_000:
        s5, d5 = 10, "Self-funded medical at scale — high PBM/Rx leverage"
    elif health:
        s5, d5 = 5, "Medical benefit present — PBM review candidate"
    else:
        s5, d5 = 0, "No medical benefit code (4A) on filing"
    comps.append({"label": "PBM / Rx Indicator", "score": s5, "max": 10, "detail": d5})

    # 6 — Regulatory / competitive environment (max 10)
    strict = _STATE_STRICTNESS.get(state, 5.0)
    s6 = round(strict, 1)
    d6 = f"{state or '—'} regulatory strictness {strict:.1f}/10 — " + (
        "high compliance urgency" if strict >= 8 else "moderate urgency" if strict >= 6 else "standard environment"
    )
    comps.append({"label": "Regulatory Environment", "score": s6, "max": 10, "detail": d6})

    total = round(sum(c["score"] for c in comps), 1)

    if total >= 78:
        tier, action = "Platinum", "Immediate Executive Review"
    elif total >= 60:
        tier, action = "Gold", "Priority Outreach"
    elif total >= 42:
        tier, action = "Silver", "Sales Development Queue"
    else:
        tier, action = "Bronze", "Monitor Only"

    # Modeled recoverable opportunity value (transparent, bounded heuristic):
    #   spread/admin recovery ~ excess admin over P50 + 8% of disclosed broker comp
    #   + 3% of plan income when self-funded medical (PBM/Rx recovery proxy).
    admin_excess = max(0.0, admin - ind_admin_p50) if ind_admin_p50 > 0 else admin * 0.15
    rx_recovery = income * 0.03 if (health and income > 0) else 0.0
    broker_recovery = broker * 0.08
    opp_value = round(admin_excess + rx_recovery + broker_recovery)

    return {
        "score": total,
        "tier": tier,
        "tier_action": action,
        "components": comps,
        "opportunity_value": opp_value,
    }


def _route_filing(row: dict, scored: dict) -> dict:
    """Intelligent Territory Assignment — region, vertical, team, and owners."""
    state = (row.get("state") or "").upper()
    region = _region_for(state)
    vertical = _vertical_for(row.get("business_code"))
    participants = int(row.get("participants") or 0)
    broker = _f(row.get("broker_commissions"))
    ind_brk_p75 = _f(row.get("ind_brk_p75"))
    health = _is_health(row.get("welfare_codes"))
    income = _f(row.get("total_income"))

    if broker > 0 and ind_brk_p75 > 0 and broker >= ind_brk_p75:
        team = "Broker Team"
    elif health and income >= 10_000_000:
        team = "PBM Team"
    elif participants >= 10000:
        team = "Strategic Accounts Team"
    elif participants >= 2500:
        team = "Large Market Team"
    else:
        team = "Consulting Team"

    tier = scored["tier"]
    exec_sponsor = (
        "Chief Revenue Officer" if tier == "Platinum"
        else "VP, Sales" if tier == "Gold"
        else "Sales Director"
    )

    return {
        "region": region,
        "vertical": vertical,
        "team": team,
        "primary_owner": f"{region} Territory Lead",
        "secondary_owner": f"{vertical} Practice Lead",
        "executive_sponsor": exec_sponsor,
    }


# 8-stage opportunity lifecycle. Stage 1-2 are *computed* (qualification gate);
# the deeper stages used by the accountability funnel are a MODELED distribution
# (deterministic from EIN) — clearly labeled as modeled in the UI.
_LIFECYCLE_STAGES = [
    "New Filing", "Qualified", "Assigned", "Outreach Initiated",
    "Meeting Scheduled", "Opportunity Created", "Proposal Submitted", "Won / Lost",
]


def _ein_hash(ein: str) -> int:
    return int(hashlib.sha256((ein or "").encode()).hexdigest(), 16)


def _lifecycle_stage(row: dict, scored: dict) -> dict:
    """
    Stage 1 = New Filing, Stage 2 = Qualified (computed from score >= 42).
    Modeled progression beyond Qualified is derived deterministically from the EIN
    so the pipeline is stable across requests. Returned `modeled` flags the source.
    """
    qualified = scored["score"] >= 42
    if not qualified:
        return {"stage_num": 1, "stage": _LIFECYCLE_STAGES[0], "modeled": False}

    # Higher tiers skew further down the funnel; EIN hash spreads the rest.
    tier_floor = {"Platinum": 4, "Gold": 3, "Silver": 2, "Bronze": 1}[scored["tier"]]
    h = _ein_hash(row.get("ein", "")) % 100
    advance = 0 if h < 45 else 1 if h < 70 else 2 if h < 85 else 3 if h < 95 else 4
    stage_num = min(8, max(2, tier_floor + advance))
    # Stages 1–2 are computed from the score; stages 3–8 are a modeled projection.
    return {"stage_num": stage_num, "stage": _LIFECYCLE_STAGES[stage_num - 1], "modeled": stage_num > 2}


# ─── Candidate query ──────────────────────────────────────────────────────────

_CANDIDATE_SQL = """
WITH latest AS (
    SELECT EIN, SPONS_DFE_NAME, STATE, CITY, FORM_YEAR, PARTICIPANTS,
           BUSINESS_CODE, WELFARE_BENEFIT_CODES, CARRIER_NAME,
           TOTAL_INCOME_AMT, ADMIN_SERVICE_FEES_AMT, BROKER_COMMISSIONS,
           row_number() OVER (PARTITION BY EIN ORDER BY FORM_YEAR DESC,
                              TOTAL_INCOME_AMT DESC NULLS LAST) AS rn
    FROM sch_h_2024
    WHERE PARTICIPANTS IS NOT NULL AND PARTICIPANTS > 0
      AND (TOTAL_INCOME_AMT > 0 OR BROKER_COMMISSIONS > 0)
      {filters}
)
SELECT l.EIN, l.SPONS_DFE_NAME, l.STATE, l.CITY, l.FORM_YEAR, l.PARTICIPANTS,
       l.BUSINESS_CODE, l.WELFARE_BENEFIT_CODES, l.CARRIER_NAME,
       l.TOTAL_INCOME_AMT, l.ADMIN_SERVICE_FEES_AMT, l.BROKER_COMMISSIONS,
       ib.p50_admin_fees, ib.p75_admin_fees, ib.p90_admin_fees,
       ib.p75_broker_comm, ib.p90_broker_comm
FROM latest l
LEFT JOIN industry_bench ib
       ON ib.BUSINESS_CODE = l.BUSINESS_CODE AND ib.FORM_YEAR = l.FORM_YEAR
WHERE l.rn = 1
ORDER BY (COALESCE(l.TOTAL_INCOME_AMT,0) + COALESCE(l.BROKER_COMMISSIONS,0)*20
          + COALESCE(l.PARTICIPANTS,0)::BIGINT*1000) DESC
LIMIT {cap}
"""


def _row_to_dict(r) -> dict:
    return {
        "ein": r[0], "sponsor": r[1], "state": r[2], "city": r[3], "form_year": r[4],
        "participants": r[5], "business_code": r[6], "welfare_codes": r[7], "carrier": r[8],
        "total_income": r[9], "admin_fees": r[10], "broker_commissions": r[11],
        "ind_admin_p50": r[12], "ind_admin_p75": r[13], "ind_admin_p90": r[14],
        "ind_brk_p75": r[15], "ind_brk_p90": r[16],
    }


def _build_candidates(state=None, vertical=None, q=None, cap=600) -> list[dict]:
    filt = ""
    params: list = []
    if state:
        filt += " AND UPPER(STATE) = ?"
        params.append(state.upper())
    if q:
        filt += " AND SPONS_DFE_NAME ILIKE ?"
        params.append(f"%{q}%")
    if vertical and vertical != "All":
        # NAICS prefix filter mirroring _vertical_for
        prefixes = {
            "Healthcare": ["62"], "Manufacturing": ["31", "32", "33"], "Education": ["61"],
            "Government": ["92"], "Technology": ["51", "54"], "Retail": ["44", "45"],
        }.get(vertical)
        if prefixes:
            ors = " OR ".join("BUSINESS_CODE LIKE ?" for _ in prefixes)
            filt += f" AND ({ors})"
            params.extend([f"{p}%" for p in prefixes])

    sql = _CANDIDATE_SQL.format(filters=filt, cap=int(cap))
    duck = get_duck()
    rows = duck.execute(sql, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def _enrich(row: dict) -> dict:
    scored = _score_filing(row)
    routing = _route_filing(row, scored)
    life = _lifecycle_stage(row, scored)
    return {
        "ein": row["ein"],
        "sponsor": row["sponsor"],
        "state": row["state"],
        "city": row["city"],
        "form_year": row["form_year"],
        "participants": int(row.get("participants") or 0),
        "total_income": _f(row.get("total_income")),
        "admin_fees": _f(row.get("admin_fees")),
        "broker_commissions": _f(row.get("broker_commissions")),
        "carrier": row.get("carrier"),
        "score": scored["score"],
        "tier": scored["tier"],
        "tier_action": scored["tier_action"],
        "opportunity_value": scored["opportunity_value"],
        "components": scored["components"],
        "routing": routing,
        "lifecycle": life,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/feed")
async def filing_feed(
    state: Optional[str] = None,
    vertical: Optional[str] = None,
    tier: Optional[str] = None,
    min_score: float = 0.0,
    q: Optional[str] = None,
    limit: int = 40,
    user: models.User = Depends(get_current_user),
):
    """New Filing Intelligence Pipeline — scored, routed, lifecycle-tracked filings."""
    try:
        candidates = _build_candidates(state=state, vertical=vertical, q=q, cap=600)
    except Exception as e:
        logger.warning("[FilingIntel] feed query failed: %s", e)
        raise HTTPException(503, "Filing intelligence database unavailable")

    enriched = [_enrich(c) for c in candidates]
    if tier and tier != "All":
        enriched = [e for e in enriched if e["tier"] == tier]
    if min_score > 0:
        enriched = [e for e in enriched if e["score"] >= min_score]
    enriched.sort(key=lambda e: e["score"], reverse=True)

    return {
        "filings": enriched[: int(limit)],
        "returned": min(len(enriched), int(limit)),
        "matched": len(enriched),
    }


@router.get("/stats")
async def filing_stats(user: models.User = Depends(get_current_user)):
    """Accountability Dashboard — pipeline totals, tiers, funnel, and breakdowns."""
    try:
        candidates = _build_candidates(cap=600)
    except Exception as e:
        logger.warning("[FilingIntel] stats query failed: %s", e)
        raise HTTPException(503, "Filing intelligence database unavailable")

    enriched = [_enrich(c) for c in candidates]
    by_tier: dict[str, int] = {"Platinum": 0, "Gold": 0, "Silver": 0, "Bronze": 0}
    by_state: dict[str, int] = {}
    by_vertical: dict[str, int] = {}
    funnel = {s: 0 for s in _LIFECYCLE_STAGES}
    total_value = 0.0
    score_sum = 0.0

    for e in enriched:
        by_tier[e["tier"]] = by_tier.get(e["tier"], 0) + 1
        st = e["state"] or "—"
        by_state[st] = by_state.get(st, 0) + 1
        vt = e["routing"]["vertical"]
        by_vertical[vt] = by_vertical.get(vt, 0) + 1
        funnel[e["lifecycle"]["stage"]] += 1
        total_value += e["opportunity_value"]
        score_sum += e["score"]

    n = len(enriched) or 1
    top_states = sorted(by_state.items(), key=lambda kv: kv[1], reverse=True)[:8]

    # Total processed across the full corpus (distinct sponsors w/ financials).
    try:
        processed = get_duck().execute(
            "SELECT COUNT(DISTINCT EIN) FROM sch_h_2024 "
            "WHERE PARTICIPANTS > 0 AND (TOTAL_INCOME_AMT > 0 OR BROKER_COMMISSIONS > 0)"
        ).fetchone()[0]
    except Exception:
        processed = len(enriched)

    return {
        "filings_processed": int(processed),
        "opportunities_active": len(enriched),
        "by_tier": by_tier,
        "by_state": [{"state": s, "count": c} for s, c in top_states],
        "by_vertical": [{"vertical": v, "count": c} for v, c in sorted(by_vertical.items(), key=lambda kv: kv[1], reverse=True)],
        "lifecycle_funnel": [{"stage": s, "count": funnel[s]} for s in _LIFECYCLE_STAGES],
        "total_opportunity_value": round(total_value),
        "avg_score": round(score_sum / n, 1),
        "assigned": by_tier["Platinum"] + by_tier["Gold"],
        "funnel_modeled": True,
    }


@router.get("/filing/{ein}")
async def filing_command_center(ein: str, user: models.User = Depends(get_current_user)):
    """Filing Command Center — full workspace for a single employer filing."""
    duck = get_duck()
    sql = _CANDIDATE_SQL.format(filters=" AND EIN = ?", cap=1)
    try:
        rows = duck.execute(sql, [ein]).fetchall()
    except Exception as e:
        logger.warning("[FilingIntel] command center query failed: %s", e)
        raise HTTPException(503, "Filing intelligence database unavailable")
    if not rows:
        raise HTTPException(404, f"No filing found for EIN {ein}")

    row = _row_to_dict(rows[0])
    enriched = _enrich(row)

    # Benchmark analysis vs industry + geographic peers.
    admin = _f(row.get("admin_fees"))
    broker = _f(row.get("broker_commissions"))
    income = _f(row.get("total_income"))
    ind_admin_p50 = _f(row.get("ind_admin_p50"))
    ind_admin_p75 = _f(row.get("ind_admin_p75"))
    ind_admin_p90 = _f(row.get("ind_admin_p90"))

    state_bench = None
    try:
        sb = duck.execute(
            "SELECT p50_admin_fees, p75_admin_fees, p90_admin_fees, p50_commissions, p75_commissions, plan_count "
            "FROM state_benchmarks WHERE STATE = ? AND BUSINESS_CODE = ? ORDER BY FORM_YEAR DESC LIMIT 1",
            [row.get("state"), row.get("business_code")],
        ).fetchone()
        if sb:
            state_bench = {
                "admin_p50": _f(sb[0]), "admin_p75": _f(sb[1]), "admin_p90": _f(sb[2]),
                "broker_p50": _f(sb[3]), "broker_p75": _f(sb[4]), "plan_count": int(sb[5] or 0),
            }
    except Exception:
        state_bench = None

    excess_admin = max(0.0, admin - ind_admin_p50) if ind_admin_p50 > 0 else 0.0
    excess_pbm = income * 0.03 if (_is_health(row.get("welfare_codes")) and income > 0) else 0.0

    # Carrier / consultant relationships for this sponsor across all filing years.
    relationships = []
    try:
        rel = duck.execute(
            "SELECT CARRIER_NAME, COUNT(*) AS yrs, MAX(FORM_YEAR) AS last_yr, "
            "SUM(COALESCE(WELFARE_PREMIUMS,0)) AS prem "
            "FROM sch_h_2024 WHERE EIN = ? AND CARRIER_NAME IS NOT NULL AND CARRIER_NAME <> '' "
            "GROUP BY CARRIER_NAME ORDER BY prem DESC LIMIT 8",
            [ein],
        ).fetchall()
        relationships = [
            {"carrier": c[0], "years_on_file": int(c[1]), "last_year": int(c[2] or 0), "premiums": _f(c[3])}
            for c in rel
        ]
    except Exception:
        relationships = []

    return {
        "filing": enriched,
        "profile": {
            "ein": row["ein"], "sponsor": row["sponsor"], "state": row["state"], "city": row["city"],
            "business_code": row.get("business_code"), "form_year": row["form_year"],
            "welfare_codes": row.get("welfare_codes"),
        },
        "benchmark": {
            "admin_fees": admin,
            "industry": {"p50": ind_admin_p50, "p75": ind_admin_p75, "p90": ind_admin_p90},
            "state": state_bench,
            "broker_commissions": broker,
            "excess_admin": round(excess_admin),
            "excess_pbm": round(excess_pbm),
            "total_savings_opportunity": round(excess_admin + excess_pbm + broker * 0.08),
        },
        "relationships": relationships,
    }


@router.get("/consultants")
async def consultant_rankings(limit: int = 20, user: models.User = Depends(get_current_user)):
    """Consultant & Influencer Mapping — carrier influence network across filings."""
    duck = get_duck()
    try:
        rows = duck.execute(
            "WITH latest AS ("
            "  SELECT EIN, CARRIER_NAME, PARTICIPANTS, WELFARE_PREMIUMS, BROKER_COMMISSIONS, "
            "         row_number() OVER (PARTITION BY EIN, CARRIER_NAME ORDER BY FORM_YEAR DESC) rn "
            "  FROM sch_h_2024 WHERE CARRIER_NAME IS NOT NULL AND CARRIER_NAME <> '' AND PARTICIPANTS > 0"
            ") "
            "SELECT CARRIER_NAME, COUNT(DISTINCT EIN) employers, SUM(PARTICIPANTS) lives, "
            "       SUM(COALESCE(WELFARE_PREMIUMS,0)) prem, SUM(COALESCE(BROKER_COMMISSIONS,0)) comm "
            "FROM latest WHERE rn = 1 "
            "GROUP BY CARRIER_NAME ORDER BY lives DESC LIMIT ?",
            [int(limit)],
        ).fetchall()
    except Exception as e:
        logger.warning("[FilingIntel] consultants query failed: %s", e)
        raise HTTPException(503, "Filing intelligence database unavailable")

    ranked = []
    for i, c in enumerate(rows):
        prem = _f(c[3])
        comm = _f(c[4])
        ranked.append({
            "rank": i + 1,
            "name": c[0],
            "employers_represented": int(c[1]),
            "total_covered_lives": int(c[2] or 0),
            "total_premiums": prem,
            "total_commissions": comm,
            "opportunity_value": round(prem * 0.03 + comm * 0.08),
        })
    return {"consultants": ranked, "total": len(ranked)}


@router.get("/digest")
async def executive_digest(user: models.User = Depends(get_current_user)):
    """Executive Distribution Engine — daily digest + weekly/monthly rollups."""
    try:
        candidates = _build_candidates(cap=600)
    except Exception as e:
        logger.warning("[FilingIntel] digest query failed: %s", e)
        raise HTTPException(503, "Filing intelligence database unavailable")

    enriched = [_enrich(c) for c in candidates]
    enriched.sort(key=lambda e: e["score"], reverse=True)

    top_accounts = [
        {
            "ein": e["ein"], "sponsor": e["sponsor"], "state": e["state"],
            "tier": e["tier"], "score": e["score"], "opportunity_value": e["opportunity_value"],
            "team": e["routing"]["team"],
        }
        for e in enriched if e["tier"] in ("Platinum", "Gold")
    ][:8]

    pbm_opps = [
        {"ein": e["ein"], "sponsor": e["sponsor"], "state": e["state"], "value": e["opportunity_value"]}
        for e in enriched if e["routing"]["team"] == "PBM Team"
    ][:5]

    platinum = sum(1 for e in enriched if e["tier"] == "Platinum")
    gold = sum(1 for e in enriched if e["tier"] == "Gold")
    total_value = sum(e["opportunity_value"] for e in enriched)

    return {
        "daily": {
            "new_filings": len(enriched),
            "platinum": platinum,
            "gold": gold,
            "top_accounts": top_accounts,
            "new_pbm_opportunities": pbm_opps,
            "total_opportunity_value": round(total_value),
        },
        "weekly": {
            "states_active": len({e["state"] for e in enriched}),
            "verticals_active": len({e["routing"]["vertical"] for e in enriched}),
            "avg_score": round(sum(e["score"] for e in enriched) / (len(enriched) or 1), 1),
        },
        "monthly": {
            "opportunities_generated": len(enriched),
            "opportunities_assigned": platinum + gold,
            "revenue_potential": round(total_value),
        },
    }


class AiBriefRequest(BaseModel):
    ein: str


@router.post("/ai-brief")
async def ai_brief(req: AiBriefRequest, user: models.User = Depends(get_current_user)):
    """AI Prioritization & Recommendation Engine — per-filing strategic brief."""
    duck = get_duck()
    sql = _CANDIDATE_SQL.format(filters=" AND EIN = ?", cap=1)
    try:
        rows = duck.execute(sql, [req.ein]).fetchall()
    except Exception as e:
        logger.warning("[FilingIntel] ai-brief query failed: %s", e)
        raise HTTPException(503, "Filing intelligence database unavailable")
    if not rows:
        raise HTTPException(404, f"No filing found for EIN {req.ein}")

    row = _row_to_dict(rows[0])
    e = _enrich(row)
    facts = (
        f"Employer: {e['sponsor']} ({e['state']}); covered lives {e['participants']:,}; "
        f"plan income ${e['total_income']/1e6:,.1f}M; admin fees ${e['admin_fees']/1e3:,.0f}K; "
        f"broker comp ${e['broker_commissions']/1e3:,.0f}K; vertical {e['routing']['vertical']}; "
        f"tier {e['tier']} (score {e['score']}/100); modeled recoverable ${e['opportunity_value']:,.0f}; "
        f"assigned team {e['routing']['team']}."
    )

    ai_result = await _ai_recommendation(facts, e)
    if ai_result:
        ai_result["ai_generated"] = True
        return {"filing": e, **ai_result}

    # Rule-based fallback.
    return {
        "filing": e,
        "ai_generated": False,
        "opportunity_summary": (
            f"{e['sponsor']} is a {e['tier']}-tier opportunity ({e['score']}/100) covering "
            f"{e['participants']:,} lives with ${e['opportunity_value']:,.0f} in modeled recoverable spend, "
            f"concentrated in administrative fees and pharmacy."
        ),
        "risk_assessment": (
            "Primary barriers: incumbent broker relationship and renewal timing. Disclosure gaps "
            "(CAA 2021) create both risk and a fiduciary opening."
        ),
        "recommended_strategy": (
            f"Lead with a no-cost fee benchmark vs {e['routing']['vertical']} peers, then convert the admin "
            "and PBM excess into a board-ready savings case timed to renewal."
        ),
        "recommended_team": e["routing"]["team"],
        "recommended_next_action": (
            f"Route to {e['routing']['primary_owner']}; open with a fiduciary fee-benchmark offer within 5 business days."
        ),
    }


async def _ai_recommendation(facts: str, enriched: dict) -> Optional[dict]:
    """Try OpenAI (gpt-4o) then Anthropic; return None on failure → rule-based fallback."""
    prompt = (
        "You are a senior healthcare benefits sales strategist. Given the employer filing facts, "
        "produce a tight, board-room-quality opportunity brief. No hedging, no marketing fluff.\n\n"
        f"FACTS: {facts}\n\n"
        "Respond in EXACT JSON (no other text):\n"
        "{\n"
        '  "opportunity_summary": "2 sentences — why this account matters",\n'
        '  "risk_assessment": "2 sentences — the real barriers to winning it",\n'
        '  "recommended_strategy": "2 sentences — the engagement path",\n'
        '  "recommended_team": "which team should pursue",\n'
        '  "recommended_next_action": "one specific tactical next step"\n'
        "}"
    )
    import json

    # Gemini first.
    try:
        from backend.gemini_compat import AsyncGeminiClient
        import os
        if os.environ.get("AI_INTEGRATIONS_GEMINI_API_KEY"):
            client = AsyncGeminiClient()
            resp = await client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=600,
            )
            return json.loads(resp.choices[0].message.content)
    except Exception as ex:
        logger.warning("[FilingIntel] Gemini brief failed: %s", ex)

    # Anthropic fallback.
    try:
        from backend.routers.ai import call_anthropic
        raw = await call_anthropic(prompt)
        if raw:
            txt = raw.strip()
            if txt.startswith("```"):
                txt = txt.split("```")[1].replace("json", "", 1).strip()
            return json.loads(txt)
    except Exception as ex:
        logger.warning("[FilingIntel] Anthropic brief failed: %s", ex)

    return None
