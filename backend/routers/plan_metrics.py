"""
Kincaid IQ — Plan Metrics Intelligence (Expansion Suite)
========================================================
A self-contained expansion of the "live plan metrics" engine. Computes 11
employer-level intelligence sections from the DOL Form 5500 DuckDB store
(`data/dol5500.duckdb`) plus the SEC XBRL tables in PostgreSQL.

Every section reports a confidence tier per the platform doctrine:
  - CERTIFIED            — computed directly from filed values.
  - MODELED              — inference from incomplete evidence; bounds disclosed.
  - INSUFFICIENT_EVIDENCE — the underlying data is not present; no finding issued.

The suite NEVER fabricates data. Where a capability requires source data that
is not ingested (Schedule C service-provider comp, participant status splits,
PBM contracts, SEC filings for private employers), the section returns
INSUFFICIENT_EVIDENCE and names the ingestion that would unlock it.

Prefix: /api/plan-metrics
"""
from __future__ import annotations

import math
import re
import statistics
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.duckdb import get_duck, duck_available

router = APIRouter(prefix="/api/plan-metrics", tags=["plan-metrics"])

# ── Sentinels / constants ────────────────────────────────────────────────────
DEFAULT_EIN = "231352204"  # Tower Health Medical Plan — platform default entity

CERTIFIED = "CERTIFIED"
MODELED = "MODELED"
INSUFFICIENT = "INSUFFICIENT_EVIDENCE"

# DOL welfare benefit code labels (parsed from WELFARE_BENEFIT_CODES; the IS_*
# booleans in the source are unreliable — they are all False even when the code
# string contains 4A, so we parse the code string instead).
WELFARE_CODE_LABELS = {
    "4A": "Health",
    "4B": "Life",
    "4D": "Dental",
    "4E": "Vision",
    "4F": "Short-term disability",
    "4H": "Long-term disability",
    "4L": "Death benefit",
    "4Q": "Other welfare",
}

# Per-condition workforce risk by NAICS/SIC prefix. Values are MODELED priors
# (eligibility-weighted base risk), not filed facts. Annual cost is the modeled
# per-at-risk-member intervention/claims cost.
CONDITION_MODELS = {
    "metabolic_glp1": {
        "label": "Metabolic / GLP-1",
        "cost_per_member": 18000,
        "eligibility": 0.12,
        "by_sic3": {"541": 0.78, "581": 0.80, "200": 0.80, "421": 0.74, "701": 0.70,
                    "622": 0.58, "623": 0.60, "311": 0.70, "452": 0.72},
        "base": 0.45,
    },
    "musculoskeletal": {
        "label": "Musculoskeletal / Ortho",
        "cost_per_member": 9500,
        "eligibility": 0.20,
        "by_sic3": {"236": 0.82, "238": 0.82, "484": 0.80, "493": 0.78, "327": 0.74,
                    "622": 0.55, "311": 0.72, "423": 0.66},
        "base": 0.48,
    },
    "oncology": {
        "label": "Oncology",
        "cost_per_member": 42000,
        "eligibility": 0.015,
        "by_sic3": {"324": 0.78, "325": 0.76, "211": 0.74, "622": 0.60, "212": 0.72},
        "base": 0.50,
    },
    "cardiometabolic": {
        "label": "Cardiometabolic",
        "cost_per_member": 16000,
        "eligibility": 0.09,
        "by_sic3": {"484": 0.80, "212": 0.74, "238": 0.70, "622": 0.58, "311": 0.70},
        "base": 0.46,
    },
    "behavioral_health": {
        "label": "Behavioral Health",
        "cost_per_member": 7200,
        "eligibility": 0.18,
        "by_sic3": {"622": 0.72, "611": 0.66, "722": 0.70, "623": 0.74, "541": 0.58},
        "base": 0.50,
    },
    "maternity": {
        "label": "Maternity",
        "cost_per_member": 22000,
        "eligibility": 0.05,
        "by_sic3": {"611": 0.70, "622": 0.68, "445": 0.64, "452": 0.62, "722": 0.60},
        "base": 0.45,
    },
}


# ── Small helpers ─────────────────────────────────────────────────────────────
def _safe(v: Any, default: float = 0.0) -> float:
    if v is None:
        return default
    try:
        fv = float(v)
    except (TypeError, ValueError):
        return default
    if math.isnan(fv) or math.isinf(fv):
        return default
    return fv


def _clean_ein(ein: str) -> str:
    return re.sub(r"[^0-9]", "", ein or "")


def _resolve_ein(ein: Optional[str]) -> str:
    c = _clean_ein(ein or "")
    if not c or (ein or "").upper() in ("ENTITY_001", "N", ""):
        return DEFAULT_EIN
    return c


def _parse_codes(code_str: Optional[str]) -> list[str]:
    if not code_str:
        return []
    return re.findall(r"4[A-U]", str(code_str).upper())


def _pct_bucket(value: float, p50: float, p75: float, p90: float) -> str:
    if value <= 0:
        return "n/a"
    if value <= p50:
        return "≤P50"
    if value <= p75:
        return "P50–P75"
    if value <= p90:
        return "P75–P90"
    return ">P90"


def _require_duck():
    if not duck_available():
        raise HTTPException(503, "Analytics database unavailable")


# ── Data access ───────────────────────────────────────────────────────────────
def _fetch_filings(ein: str) -> list[dict]:
    """All Form 5500 filing rows for an EIN, newest first."""
    duck = get_duck()
    rows = duck.execute(
        """
        SELECT FORM_YEAR, PARTICIPANTS, WELFARE_BENEFIT_CODES, CARRIER_NAME,
               WELFARE_PREMIUMS, BROKER_COMMISSIONS, ADMIN_SERVICE_FEES_AMT,
               INVEST_MGMT_FEES_AMT, LEGAL_FEES_AMT, TOTAL_INCOME_AMT,
               TOT_ASSETS_EOY_AMT, TOT_LIABILITIES_EOY_AMT, BUSINESS_CODE,
               STATE, CITY, SPONS_DFE_NAME, PLAN_NAME_LS
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC
        """,
        [ein],
    ).fetchall()
    out = []
    for r in rows:
        out.append({
            "year": int(r[0]) if r[0] is not None else None,
            "participants": int(_safe(r[1])),
            "codes": _parse_codes(r[2]),
            "carrier": (r[3] or "").strip() or None,
            "welfare_premiums": _safe(r[4]),
            "broker_commissions": _safe(r[5]),
            "admin_fees": _safe(r[6]),
            "invest_fees": _safe(r[7]),
            "legal_fees": _safe(r[8]),
            "total_income": _safe(r[9]),
            "assets": _safe(r[10]),
            "liabilities": _safe(r[11]),
            "business_code": (r[12] or "").strip(),
            "state": (r[13] or "").strip(),
            "city": (r[14] or "").strip(),
            "sponsor": (r[15] or "").strip(),
            "plan_name": (r[16] or "").strip(),
        })
    return out


def _employer_header(filings: list[dict]) -> dict:
    if not filings:
        return {}
    latest = filings[0]
    return {
        "name": latest["sponsor"] or latest["plan_name"],
        "state": latest["state"],
        "city": latest["city"],
        "business_code": latest["business_code"],
        "latest_year": latest["year"],
        "participants": max((f["participants"] for f in filings), default=0),
        "filing_count": len(filings),
    }


# ── Section computations ──────────────────────────────────────────────────────
def _sec_funding_type(filings: list[dict]) -> dict:
    """#1 Self-insured vs fully-insured (heuristic from premiums / carrier / admin fees)."""
    funded = [f for f in filings if f["welfare_premiums"] > 0 or f["admin_fees"] > 0 or f["codes"]]
    if not funded:
        return {"tier": INSUFFICIENT, "note": "No welfare plan financials on file."}
    latest_year = funded[0]["year"]
    cohort = [f for f in funded if f["year"] == latest_year] or funded[:1]
    lines = []
    for f in cohort:
        prem = f["welfare_premiums"]
        if prem > 0 and f["carrier"]:
            kind, why = "Fully-insured", f"Premium paid to carrier ({f['carrier']})"
        elif prem <= 0 and f["admin_fees"] > 0:
            kind, why = "Self-insured", "Admin fees with no carrier premium"
        else:
            kind, why = "Indeterminate", "Insufficient funding signal"
        lines.append({
            "plan": f["plan_name"] or f["sponsor"], "carrier": f["carrier"],
            "premium": round(prem), "admin_fees": round(f["admin_fees"]),
            "funding": kind, "reason": why,
            "benefit_lines": [WELFARE_CODE_LABELS.get(c, c) for c in f["codes"]],
        })
    self_n = sum(1 for l in lines if l["funding"] == "Self-insured")
    full_n = sum(1 for l in lines if l["funding"] == "Fully-insured")
    return {
        "tier": MODELED,
        "plans": lines,
        "summary": {"self_insured": self_n, "fully_insured": full_n,
                    "indeterminate": len(lines) - self_n - full_n},
        "note": ("Funding arrangement inferred from premium/carrier/admin-fee signals — "
                 "DOL filings do not state self- vs fully-insured directly."),
    }


def _sec_benefit_lines(filings: list[dict]) -> dict:
    """#2 Benefit-line composition + estimated per-line PMPM."""
    latest_year = filings[0]["year"] if filings else None
    cohort = [f for f in filings if f["year"] == latest_year]
    code_counts: dict[str, int] = {}
    total_prem = 0.0
    total_part = 0
    for f in cohort:
        total_prem += f["welfare_premiums"]
        total_part = max(total_part, f["participants"])
        for c in f["codes"]:
            code_counts[c] = code_counts.get(c, 0) + 1
    if not code_counts:
        return {"tier": INSUFFICIENT, "note": "No welfare benefit codes on file."}
    present = [{"code": c, "label": WELFARE_CODE_LABELS.get(c, c), "plans": n}
               for c, n in sorted(code_counts.items())]
    # MODELED dollar split using standard benefit-cost weights (health dominates;
    # Rx is bundled inside health under code 4A).
    weights = {"4A": 0.82, "4D": 0.05, "4E": 0.015, "4B": 0.03, "4F": 0.03,
               "4H": 0.03, "4L": 0.005, "4Q": 0.02}
    active = {c: weights.get(c, 0.01) for c in code_counts}
    wsum = sum(active.values()) or 1.0
    pmpm_total = (total_prem / total_part / 12) if total_part else 0.0
    split = []
    for c, w in sorted(active.items(), key=lambda x: -x[1]):
        frac = w / wsum
        split.append({
            "code": c, "label": WELFARE_CODE_LABELS.get(c, c),
            "share_pct": round(frac * 100, 1),
            "est_annual_premium": round(total_prem * frac),
            "est_pmpm": round(pmpm_total * frac, 2),
        })
    return {
        "tier": MODELED,
        "lines_present": present,
        "total_premium": round(total_prem),
        "total_pmpm": round(pmpm_total, 2),
        "estimated_split": split,
        "note": ("Lines present are CERTIFIED (from benefit codes); the dollar split is "
                 "MODELED via standard benefit-cost weights — filings do not break premium "
                 "out by benefit line. Rx is bundled within Health (4A)."),
    }


def _sec_participant_detail(filings: list[dict]) -> dict:
    """#3 Granular participant status split — not in this dataset."""
    total = max((f["participants"] for f in filings), default=0)
    return {
        "tier": INSUFFICIENT,
        "total_participants": total,
        "note": ("Active/retired/separated-vested splits are not ingested. Total participant "
                 "count is CERTIFIED; the status breakdown requires Schedule H/I line-item "
                 "ingestion before a finding can be issued."),
    }


def _sec_trends(filings: list[dict]) -> dict:
    """#4 Multi-year trend + volatility per fee line."""
    by_year: dict[int, dict] = {}
    for f in filings:
        y = f["year"]
        if y is None:
            continue
        agg = by_year.setdefault(y, {"admin": 0.0, "broker": 0.0, "premium": 0.0,
                                     "invest": 0.0, "participants": 0})
        agg["admin"] += f["admin_fees"]
        agg["broker"] += f["broker_commissions"]
        agg["premium"] += f["welfare_premiums"]
        agg["invest"] += f["invest_fees"]
        agg["participants"] = max(agg["participants"], f["participants"])
    years = sorted(by_year)
    if len(years) < 2:
        return {"tier": INSUFFICIENT, "note": "Fewer than two filing years available."}
    series = [{"year": y, **{k: round(v) if k != "participants" else v
                             for k, v in by_year[y].items()}} for y in years]

    def _vol(key: str) -> dict:
        vals = [by_year[y][key] for y in years]
        mean = statistics.mean(vals) if vals else 0.0
        cv = (statistics.pstdev(vals) / mean) if mean else 0.0
        first, last = vals[0], vals[-1]
        cagr = ((last / first) ** (1 / (len(vals) - 1)) - 1) if first > 0 and last > 0 else 0.0
        return {"mean": round(mean), "volatility_cv": round(cv, 3),
                "trend_pct": round(cagr * 100, 1)}

    metrics = {k: _vol(k) for k in ("admin", "broker", "premium", "invest")}
    tier = CERTIFIED if len(years) >= 3 else MODELED
    flags = [k for k, m in metrics.items() if m["trend_pct"] >= 10 and m["volatility_cv"] < 0.5]
    return {
        "tier": tier, "years": years, "series": series, "metrics": metrics,
        "creeping_fee_flags": flags,
        "note": ("Year-over-year fee trajectory and volatility (coefficient of variation). "
                 "Steady upward creep is flagged separately from one-off spikes."),
    }


def _sec_provider_leakage(filings: list[dict]) -> dict:
    """#5 Carrier-level leakage map (Schedule C indirect comp not ingested)."""
    by_carrier: dict[str, dict] = {}
    for f in filings:
        name = f["carrier"]
        if not name:
            continue
        c = by_carrier.setdefault(name, {"carrier": name, "broker": 0.0, "admin": 0.0,
                                         "premium": 0.0, "years": set()})
        c["broker"] += f["broker_commissions"]
        c["admin"] += f["admin_fees"]
        c["premium"] += f["welfare_premiums"]
        c["years"].add(f["year"])
    if not by_carrier:
        return {"tier": INSUFFICIENT,
                "note": "No carrier-attributed service provider records on file."}
    rows = []
    for c in by_carrier.values():
        broker, admin = c["broker"], c["admin"]
        coupled = broker > 0 and admin > 0 and abs(broker - admin) / max(broker, admin) < 0.01
        rows.append({
            "carrier": c["carrier"], "broker_comm": round(broker),
            "admin_fees": round(admin), "premium": round(c["premium"]),
            "years": sorted(c["years"]),
            "flag": "commission/admin coupling" if coupled else None,
        })
    rows.sort(key=lambda r: r["broker_comm"] + r["admin_fees"], reverse=True)
    return {
        "tier": MODELED, "providers": rows,
        "note": ("Carrier-level direct compensation is CERTIFIED. Indirect compensation to "
                 "TPAs, PBMs and consultants (Schedule C) is INSUFFICIENT_EVIDENCE — it "
                 "requires Schedule C ingestion, the highest-value next data source."),
    }


def _sec_pbm_exposure(filings: list[dict]) -> dict:
    """#6 Rx / PBM spend exposure (modeled; contract terms not available)."""
    rx_plans = [f for f in filings if "4A" in f["codes"]]  # Rx bundled in health
    if not rx_plans:
        return {"tier": INSUFFICIENT, "note": "No health (Rx-bearing) coverage on file."}
    participants = max((f["participants"] for f in rx_plans), default=0)
    rx_pmpy = 1400.0  # modeled national average employer Rx spend per member-year
    est_rx_spend = participants * rx_pmpy
    return {
        "tier": MODELED,
        "participants": participants,
        "assumed_rx_pmpy": rx_pmpy,
        "est_annual_rx_spend": round(est_rx_spend),
        "est_spread_exposure_low": round(est_rx_spend * 0.04),
        "est_spread_exposure_high": round(est_rx_spend * 0.12),
        "rebate_retention": INSUFFICIENT,
        "note": ("Rx spend is MODELED from headcount × national PMPY. Actual spread pricing "
                 "and rebate retention are INSUFFICIENT_EVIDENCE — they require the PBM "
                 "contract (see the Rx Defense module for contract-level analysis)."),
    }


def _sec_catastrophic(filings: list[dict], header: dict) -> dict:
    """#7 Catastrophic claim + IBNR projection (modeled)."""
    participants = header.get("participants", 0)
    if participants <= 0:
        return {"tier": INSUFFICIENT, "note": "No participant count available."}
    cat_rate = 0.012            # modeled share of members with a catastrophic claim
    avg_cat_claim = 165000.0    # modeled average catastrophic claim
    expected_claimants = participants * cat_rate
    expected_cost = expected_claimants * avg_cat_claim
    ibnr_reserve = expected_cost * 0.18  # modeled incurred-but-not-reported reserve
    return {
        "tier": MODELED,
        "participants": participants,
        "expected_catastrophic_claimants": round(expected_claimants, 1),
        "expected_catastrophic_cost": round(expected_cost),
        "ibnr_reserve_estimate": round(ibnr_reserve),
        "assumptions": {"cat_rate": cat_rate, "avg_cat_claim": avg_cat_claim,
                        "ibnr_factor": 0.18},
        "note": ("Actuarial projection from headcount and modeled incidence/severity priors. "
                 "Bounds disclosed via assumptions; not a filed value."),
    }


def _sec_recoverable_bands(filings: list[dict], peer: dict) -> dict:
    """#8 Recoverable-fees point estimate with disclosed P10/P50/P90 bands."""
    latest_year = filings[0]["year"] if filings else None
    cohort = [f for f in filings if f["year"] == latest_year]
    total_fees = sum(f["admin_fees"] + f["invest_fees"] + f["legal_fees"]
                     + f["broker_commissions"] for f in cohort)
    total_income = sum(f["total_income"] for f in cohort)
    if total_fees <= 0 or total_income <= 0:
        return {"tier": INSUFFICIENT, "note": "Insufficient fee/income data for estimate."}
    # Median peer admin-fee benchmark (national p50) drives the "excess".
    p50_admin = peer.get("national", {}).get("p50_admin_fees", 0) if peer else 0
    excess = max(total_fees - (p50_admin if p50_admin else total_fees * 0.6), 0.0)
    bands = {
        "p10": round(excess * 0.25),
        "p50": round(excess * 0.40),
        "p90": round(excess * 0.55),
    }
    return {
        "tier": MODELED,
        "total_fees": round(total_fees),
        "benchmark_p50_admin": round(p50_admin),
        "excess_over_benchmark": round(excess),
        "recoverable_bands": bands,
        "note": ("Recoverable fees as a band: recoverability of the excess-over-median is "
                 "modeled at 25%/40%/55% (P10/P50/P90). Bounds disclosed per doctrine."),
    }


def _sec_condition_exposure(filings: list[dict], header: dict) -> dict:
    """#9 Multi-condition workforce exposure suite (modeled)."""
    participants = header.get("participants", 0)
    sic = header.get("business_code", "")
    if participants <= 0:
        return {"tier": INSUFFICIENT, "note": "No participant count available."}
    sic3 = (sic or "")[:3]
    conditions = []
    for key, m in CONDITION_MODELS.items():
        risk = m["by_sic3"].get(sic3, m["base"])
        at_risk = participants * risk * m["eligibility"]
        annual = at_risk * m["cost_per_member"]
        conditions.append({
            "condition": m["label"], "risk_index": round(risk, 2),
            "at_risk_members": round(at_risk, 1),
            "annual_cost_exposure": round(annual),
        })
    conditions.sort(key=lambda c: c["annual_cost_exposure"], reverse=True)
    return {
        "tier": MODELED,
        "participants": participants,
        "business_code": sic,
        "conditions": conditions,
        "total_exposure": round(sum(c["annual_cost_exposure"] for c in conditions)),
        "note": ("Per-condition exposure modeled from industry risk priors × eligibility × "
                 "modeled per-member cost. Directional planning estimate, not filed claims."),
    }


def _sec_ebitda_xbrl(db: Session, ein: str, filings: list[dict]) -> dict:
    """#10 EBITDA impact refined via SEC XBRL (private employers → INSUFFICIENT)."""
    try:
        row = db.execute(text("""
            SELECT s.name, s.adsh, s.sic
            FROM sec_submissions s
            WHERE REGEXP_REPLACE(s.ein, '[^0-9]', '', 'g') = :ein
              AND s.form = '10-K'
            ORDER BY s.period DESC LIMIT 1
        """), {"ein": ein}).fetchone()
    except Exception:
        row = None
    if not row:
        return {"tier": INSUFFICIENT,
                "note": ("No SEC 10-K on file for this EIN (typical for private employers). "
                         "EBITDA-impact refinement requires public-company XBRL filings.")}
    name, adsh, sic = row

    def _tag(tags: list[str]) -> float:
        for t in tags:
            r = db.execute(text("""
                SELECT value FROM sec_numeric
                WHERE adsh = :adsh AND tag = :tag
                ORDER BY ddate DESC LIMIT 1
            """), {"adsh": adsh, "tag": t}).fetchone()
            if r and r[0] is not None:
                return float(r[0])
        return 0.0

    op_income = _tag(["OperatingIncomeLoss"])
    ebitda_est = op_income * 1.12 if op_income else 0.0
    total_fees = sum(f["admin_fees"] + f["invest_fees"] + f["legal_fees"]
                     + f["broker_commissions"] for f in filings[:3])
    impact = (total_fees / ebitda_est * 100) if ebitda_est else 0.0
    if ebitda_est <= 0:
        return {"tier": INSUFFICIENT,
                "note": f"SEC filing found for {name} but no usable operating income tag."}
    return {
        "tier": MODELED,
        "company": name,
        "ebitda_est": round(ebitda_est),
        "plan_fees": round(total_fees),
        "ebitda_impact_pct": round(impact, 2),
        "note": "Plan fees as a share of SEC-derived estimated EBITDA (operating income × 1.12).",
    }


def _peer_cohorts(filings: list[dict], header: dict) -> dict:
    """#11 Industry + state percentile placement."""
    if not filings:
        return {"tier": INSUFFICIENT, "note": "No filings to benchmark."}
    sic = header.get("business_code", "")
    state = header.get("state", "")
    year = header.get("latest_year")
    latest = filings[0]
    admin = latest["admin_fees"]
    broker = latest["broker_commissions"]
    duck = get_duck()

    nat = duck.execute("""
        SELECT p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm, plan_count
        FROM industry_bench WHERE BUSINESS_CODE = ? AND FORM_YEAR = ?
        ORDER BY plan_count DESC LIMIT 1
    """, [sic, year]).fetchone()
    st = duck.execute("""
        SELECT p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_commissions, p75_commissions, p90_commissions, plan_count
        FROM state_benchmarks WHERE STATE = ? AND BUSINESS_CODE = ? AND FORM_YEAR = ?
        ORDER BY plan_count DESC LIMIT 1
    """, [state, sic, year]).fetchone()

    result: dict[str, Any] = {"business_code": sic, "state": state, "year": year,
                              "your_admin_fees": round(admin), "your_broker_comm": round(broker)}
    tier = INSUFFICIENT
    if nat:
        result["national"] = {
            "p50_admin_fees": _safe(nat[0]), "p75_admin_fees": _safe(nat[1]),
            "p90_admin_fees": _safe(nat[2]), "plan_count": int(_safe(nat[6])),
            "admin_percentile": _pct_bucket(admin, _safe(nat[0]), _safe(nat[1]), _safe(nat[2])),
            "broker_percentile": _pct_bucket(broker, _safe(nat[3]), _safe(nat[4]), _safe(nat[5])),
        }
        tier = CERTIFIED
    if st:
        result["state_cohort"] = {
            "p50_admin_fees": _safe(st[0]), "p75_admin_fees": _safe(st[1]),
            "p90_admin_fees": _safe(st[2]), "plan_count": int(_safe(st[6])),
            "admin_percentile": _pct_bucket(admin, _safe(st[0]), _safe(st[1]), _safe(st[2])),
            "broker_percentile": _pct_bucket(broker, _safe(st[3]), _safe(st[4]), _safe(st[5])),
        }
        tier = CERTIFIED
    result["tier"] = tier
    if tier == INSUFFICIENT:
        result["note"] = "No industry/state benchmark cohort matched this employer's profile/year."
    else:
        result["note"] = "Percentile placement of your filed fees vs national and state peer cohorts."
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("/search")
def search_employers(
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _require_duck()
    duck = get_duck()
    term = q.strip()
    digits = _clean_ein(term)
    if digits and len(digits) >= 4:
        rows = duck.execute("""
            SELECT EIN, employer_name, state, city, business_code, max_participants
            FROM employers WHERE EIN LIKE ? ORDER BY max_participants DESC LIMIT 20
        """, [digits + "%"]).fetchall()
    else:
        rows = duck.execute("""
            SELECT EIN, employer_name, state, city, business_code, max_participants
            FROM employers WHERE employer_name ILIKE ? ORDER BY max_participants DESC LIMIT 20
        """, ["%" + term + "%"]).fetchall()
    return [{"ein": r[0], "name": r[1], "state": r[2], "city": r[3],
             "business_code": r[4], "participants": int(_safe(r[5]))} for r in rows]


@router.get("/{ein}")
def plan_metrics(
    ein: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Combined plan-metrics intelligence for an employer (all 11 sections)."""
    _require_duck()
    resolved = _resolve_ein(ein)
    filings = _fetch_filings(resolved)
    if not filings:
        raise HTTPException(404, f"No Form 5500 filings found for EIN {resolved}")
    header = _employer_header(filings)

    def _guard(fn, *args):
        try:
            return fn(*args)
        except Exception as exc:  # never let one section break the response
            return {"tier": INSUFFICIENT, "note": f"Section error: {exc}"}

    peer = _guard(_peer_cohorts, filings, header)
    sections = {
        "funding_type": _guard(_sec_funding_type, filings),
        "benefit_lines": _guard(_sec_benefit_lines, filings),
        "participant_detail": _guard(_sec_participant_detail, filings),
        "trends": _guard(_sec_trends, filings),
        "provider_leakage": _guard(_sec_provider_leakage, filings),
        "pbm_exposure": _guard(_sec_pbm_exposure, filings),
        "catastrophic": _guard(_sec_catastrophic, filings, header),
        "recoverable_bands": _guard(_sec_recoverable_bands, filings, peer),
        "condition_exposure": _guard(_sec_condition_exposure, filings, header),
        "ebitda_xbrl": _guard(_sec_ebitda_xbrl, db, resolved, filings),
        "peer_cohorts": peer,
    }
    tiers = [s.get("tier") for s in sections.values()]
    return {
        "ein": resolved,
        "employer": header,
        "sections": sections,
        "coverage": {
            "certified": tiers.count(CERTIFIED),
            "modeled": tiers.count(MODELED),
            "insufficient": tiers.count(INSUFFICIENT),
        },
    }
