"""
Kincaid Health · Intelligence Engines
=====================================
A data-driven registry of analytical "engines". Each engine is a full,
self-describing analytical surface computed from the DOL Form 5500 DuckDB store
(`data/dol5500.duckdb`). Rather than hand-code one page per engine, every engine
is a registry entry (metadata + a math family + config); the frontend renders
any engine generically from the payload this router returns.

Doctrine (enforced here):
  - Every section carries an honest confidence tier:
      CERTIFIED            · computed directly from filed values.
      MODELED              · inference from incomplete evidence; bounds disclosed.
      INSUFFICIENT_EVIDENCE · underlying data not ingested; no finding issued,
                              and the unlocking ingestion is named.
  - Deterministic numbers first; AI narrative is lazy (separate endpoint).
  - No fabricated CERTIFIED. Where 5500 cannot support a dollar finding, the
    section returns INSUFFICIENT_EVIDENCE and names what would unlock it.

Prefix: /api/engines
"""
from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.auth import get_current_user
from backend.duckdb import get_duck, duck_available

try:  # reuse the modeled workforce priors already vetted in plan_metrics
    from backend.routers.plan_metrics import CONDITION_MODELS
except Exception:  # pragma: no cover - defensive, keeps engines importable
    CONDITION_MODELS = {}

router = APIRouter(prefix="/api/engines", tags=["engines"])

# ── Tiers / sentinels ─────────────────────────────────────────────────────────
CERTIFIED = "CERTIFIED"
MODELED = "MODELED"
INSUFFICIENT = "INSUFFICIENT_EVIDENCE"
DEFAULT_EIN = "231352204"  # Tower Health Medical Plan · platform default entity

# Modeled trend priors (annual). These are published-benchmark healthcare trend
# assumptions, NOT filed facts, hence MODELED. sigma drives the P10/P90 fan.
TREND_PRIORS = {
    "medical": (0.075, 0.020),
    "rx": (0.090, 0.025),
    "dental": (0.040, 0.012),
    "vision": (0.030, 0.010),
    "unit_cost": (0.045, 0.015),
    "utilization": (0.025, 0.012),
}

# Modeled share of total welfare spend by benefit line (industry composite).
# Line-level premium is NOT filed on the 5500, so any per-line dollar figure is
# MODELED off these shares until claims-by-benefit are ingested.
LINE_SHARES = {
    "medical": 0.72,
    "rx": 0.19,
    "dental": 0.05,
    "vision": 0.012,
}

# Modeled state cost index (relative to national 1.00). Partial map; unknown → 1.0.
GEO_INDEX = {
    "AK": 1.28, "NY": 1.22, "CA": 1.19, "MA": 1.17, "NJ": 1.15, "CT": 1.14,
    "WA": 1.10, "IL": 1.07, "PA": 1.04, "TX": 1.02, "FL": 1.01, "OH": 0.98,
    "IN": 0.96, "GA": 0.97, "NC": 0.95, "TN": 0.93, "MO": 0.94, "KY": 0.92,
    "AL": 0.90, "MS": 0.88, "AR": 0.89, "WV": 0.91, "IA": 0.93, "KS": 0.94,
}

# Modeled case-mix index by 2-digit NAICS/SIC prefix (workforce acuity).
CASEMIX_BY_SIC2 = {
    "62": 1.14, "48": 1.09, "23": 1.08, "21": 1.07, "31": 1.05, "32": 1.05,
    "72": 0.96, "44": 0.97, "45": 0.97, "54": 0.94, "52": 0.93, "51": 0.95,
    "61": 0.98, "92": 1.00, "42": 1.01,
}

# Gene & cell therapy modeled prior (ultra-rare, catastrophic unit cost).
GENE_THERAPY = {"label": "Gene & Cell Therapy", "cost_per_case": 2_100_000, "prevalence": 0.00035}


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


def _money(v: float) -> str:
    v = _safe(v)
    a = abs(v)
    if a >= 1e9:
        return f"${v/1e9:.2f}B"
    if a >= 1e6:
        return f"${v/1e6:.2f}M"
    if a >= 1e3:
        return f"${v/1e3:.1f}K"
    return f"${v:,.0f}"


def _pct(v: float, digits: int = 1) -> str:
    return f"{v*100:.{digits}f}%"


def _get_multiyear(ein: str) -> List[Dict[str, Any]]:
    """Per-plan rows for the EIN across all filed years (sch_h_2024 holds multiple
    FORM_YEARs despite the name)."""
    if not duck_available():
        return []
    duck = get_duck()
    try:
        rows = duck.execute(
            """
            SELECT FORM_YEAR, PLAN_NAME_LS, SPONS_DFE_NAME, CITY, STATE, BUSINESS_CODE,
                   PARTICIPANTS, CARRIER_NAME, TOTAL_INCOME_AMT, TOT_ASSETS_EOY_AMT,
                   ADMIN_SERVICE_FEES_AMT, BROKER_COMMISSIONS, WELFARE_PREMIUMS,
                   IS_HEALTH, IS_DENTAL, IS_VISION, IS_LIFE, IS_STOP_LOSS, IS_DRUG
            FROM sch_h_2024
            WHERE EIN = ?
            ORDER BY FORM_YEAR DESC
            """,
            [ein],
        ).fetchall()
    except Exception:
        return []
    cols = [
        "form_year", "plan_name", "sponsor_name", "city", "state", "biz_code",
        "participants", "carrier", "total_income", "assets_eoy",
        "admin_fees", "broker_commissions", "welfare_premiums",
        "is_health", "is_dental", "is_vision", "is_life", "is_stop_loss", "is_drug",
    ]
    return [dict(zip(cols, r)) for r in rows]


def _agg_by_year(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collapse per-plan rows into one record per FORM_YEAR (sum $ lines, max
    participants, OR the benefit flags)."""
    by: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        try:
            yr = int(r.get("form_year") or 0)
        except (TypeError, ValueError):
            continue
        if not yr:
            continue
        d = by.setdefault(yr, {
            "year": yr, "premiums": 0.0, "admin": 0.0, "broker": 0.0,
            "income": 0.0, "participants": 0, "is_dental": False,
            "is_vision": False, "is_drug": False,
        })
        d["premiums"] += _safe(r.get("welfare_premiums"))
        d["admin"] += _safe(r.get("admin_fees"))
        d["broker"] += _safe(r.get("broker_commissions"))
        d["income"] += _safe(r.get("total_income"))
        d["participants"] = max(d["participants"], int(r.get("participants") or 0))
        d["is_dental"] = d["is_dental"] or bool(r.get("is_dental"))
        d["is_vision"] = d["is_vision"] or bool(r.get("is_vision"))
        d["is_drug"] = d["is_drug"] or bool(r.get("is_drug"))
    return [by[y] for y in sorted(by)]


def _bench(biz_code: Any) -> Optional[Dict[str, Any]]:
    if not duck_available() or biz_code is None:
        return None
    duck = get_duck()
    try:
        row = duck.execute(
            """
            SELECT p50_admin_fees, p75_admin_fees, p90_admin_fees,
                   p50_broker_comm, p75_broker_comm, p90_broker_comm
            FROM industry_bench WHERE BUSINESS_CODE = ?
            ORDER BY FORM_YEAR DESC LIMIT 1
            """,
            [str(biz_code)],
        ).fetchone()
    except Exception:
        return None
    if not row:
        return None
    keys = ["p50_admin", "p75_admin", "p90_admin", "p50_broker", "p75_broker", "p90_broker"]
    return {k: _safe(v) for k, v in zip(keys, row)}


class _Ctx:
    """Resolved entity context passed to every family compute."""

    def __init__(self, ein: str, members_override: Optional[int]):
        self.ein = ein
        rows = _get_multiyear(ein)
        self.years = _agg_by_year(rows)
        self.latest = self.years[-1] if self.years else None
        self.name = rows[0].get("sponsor_name") if rows else None
        self.state = rows[0].get("state") if rows else None
        self.biz_code = rows[0].get("biz_code") if rows else None
        self.bench = _bench(self.biz_code)
        filed_members = int(self.latest["participants"]) if self.latest else 0
        self.members = int(members_override) if members_override else filed_members
        self.members_filed = filed_members
        self.has_data = bool(self.latest and self.latest["premiums"] > 0)

    def baseline(self) -> float:
        return _safe(self.latest["premiums"]) if self.latest else 0.0

    def entity_dict(self) -> Dict[str, Any]:
        return {
            "ein": self.ein,
            "name": self.name or "Unknown entity",
            "state": self.state,
            "members": self.members,
            "members_filed": self.members_filed,
            "latest_year": self.latest["year"] if self.latest else None,
            "baseline_premium": round(self.baseline(), 0),
            "has_data": self.has_data,
        }


# ── Forecast primitive ────────────────────────────────────────────────────────
def _forecast(base: float, rate: float, sigma: float, hist: List[Dict[str, Any]],
              n_ahead: int = 3) -> Dict[str, Any]:
    """History (filed) + a modeled forward fan (P10/P50/P90) off the trend prior."""
    series: List[Dict[str, Any]] = []
    for h in hist:
        series.append({"year": h["year"], "actual": round(h["premiums"], 0), "kind": "history"})
    start_year = hist[-1]["year"] if hist else 2024
    p50 = base
    for k in range(1, n_ahead + 1):
        yr = start_year + k
        p50 = base * ((1 + rate) ** k)
        p10 = base * ((1 + max(rate - sigma, -0.05)) ** k)
        p90 = base * ((1 + rate + sigma) ** k)
        series.append({
            "year": yr, "p10": round(p10, 0), "p50": round(p50, 0),
            "p90": round(p90, 0), "kind": "forecast",
        })
    return {"series": series, "terminal_p50": p50, "start_year": start_year}


def _tile(label: str, value: str, sub: str = "", tier: str = MODELED,
          drill: Optional[str] = None) -> Dict[str, Any]:
    return {"label": label, "value": value, "sub": sub, "tier": tier, "drill": drill}


# ─────────────────────────────────────────────────────────────────────────────
# Family computes. Each returns {tiles:[4], sections:[...], tier, methodology,
# unlocks:[...]}. Section types the frontend understands:
#   trend · gauges · drivers · decomposition · seasonality · scenario ·
#   methodology · unlocks
# ─────────────────────────────────────────────────────────────────────────────
def _no_data_payload(cfg: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "tier": INSUFFICIENT,
        "tiles": [
            _tile("Filed premium", "No filing", "Form 5500 not found", INSUFFICIENT),
            _tile("Members", "n/a", "", INSUFFICIENT),
            _tile("Forecast", "n/a", "", INSUFFICIENT),
            _tile("Confidence", "INSUFFICIENT", "No baseline to model from", INSUFFICIENT),
        ],
        "sections": [{
            "type": "unlocks", "title": "What unlocks a finding", "tier": INSUFFICIENT,
            "items": ["A filed DOL Form 5500 with Schedule H welfare premiums for this EIN"],
        }],
        "methodology": "No filed Form 5500 welfare premium was located for this entity, "
                       "so no baseline exists to model. This is a valid finding: "
                       "INSUFFICIENT_EVIDENCE, not a fabricated estimate.",
        "unlocks": ["Filed Form 5500 Schedule H for this EIN"],
    }


def _fam_trend(cfg: Dict[str, Any], ctx: _Ctx) -> Dict[str, Any]:
    if not ctx.has_data:
        return _no_data_payload(cfg)
    line = cfg["line"]
    share = LINE_SHARES.get(line, 1.0)
    prior_key = cfg.get("prior", line)
    rate, sigma = TREND_PRIORS.get(prior_key, (0.06, 0.02))
    total_hist = ctx.years
    # line baseline = modeled share of filed total welfare premium
    line_hist = [{"year": h["year"], "premiums": h["premiums"] * share} for h in total_hist]
    base = line_hist[-1]["premiums"]
    fc = _forecast(base, rate, sigma, line_hist, n_ahead=3)
    pmpm = base / (ctx.members * 12) if ctx.members else 0
    # Baseline is CERTIFIED only when it is the full filed premium (no modeled
    # allocation). Line-level premium is not filed on the 5500, so any share < 1.0
    # is a modeled composite and the per-line baseline is MODELED (medical included).
    is_full = share >= 1.0
    line_tier = CERTIFIED if is_full else MODELED
    tiles = [
        _tile(f"{cfg['line_label']} baseline", _money(base),
              f"FY{line_hist[-1]['year']} · {_pct(share,1)} of filed premium",
              line_tier, "baseline"),
        _tile("Modeled trend", _pct(rate, 1),
              f"±{_pct(sigma,1)} band (P10-P90)", MODELED, "trend"),
        _tile("3-yr projection", _money(fc["terminal_p50"]),
              f"P50 by FY{fc['start_year']+3}", MODELED, "forecast"),
        _tile("PMPM", _money(pmpm), "modeled per-member-per-month", MODELED, "pmpm"),
    ]
    sections = [
        {"type": "trend", "title": f"{cfg['line_label']} spend · filed history + modeled forecast",
         "tier": MODELED, "series": fc["series"],
         "note": f"Solid = filed Form 5500 premium (× modeled {_pct(share,1)} line share). "
                 f"Shaded fan = P10-P90 forward band off a {_pct(rate,1)} modeled trend."},
        {"type": "drivers", "title": "Trend drivers (modeled attribution)", "tier": MODELED,
         "rows": [
             {"label": "Provider unit cost", "value": _pct(rate * 0.55, 1), "note": "price per service"},
             {"label": "Utilization", "value": _pct(rate * 0.30, 1), "note": "services per member"},
             {"label": "Mix / intensity", "value": _pct(rate * 0.10, 1), "note": "acuity shift"},
             {"label": "Leverage / buy-down", "value": _pct(rate * 0.05, 1), "note": "plan design"},
         ]},
    ]
    unlocks = [] if is_full else [
        f"Claims-by-benefit feed to replace the modeled {_pct(share,1)} {cfg['line_label'].lower()} share with filed line-level spend",
    ]
    return {
        "tier": MODELED, "tiles": tiles, "sections": sections,
        "methodology": (
            f"Baseline is the entity's filed welfare premium"
            + ("" if is_full
               else f", allocated to {cfg['line_label']} at a modeled {_pct(share,1)} composite share "
                    f"(line-level premium is not filed on the 5500, so this allocation is MODELED)")
            + f". The forward fan compounds a modeled {_pct(rate,1)} annual trend (±{_pct(sigma,1)}) "
              f"over three years. Trend rate is a published-benchmark prior, so the forecast is MODELED; "
              f"the filed total premium is CERTIFIED."),
        "unlocks": unlocks,
    }


def _fam_normalization(cfg: Dict[str, Any], ctx: _Ctx) -> Dict[str, Any]:
    if not ctx.has_data:
        return _no_data_payload(cfg)
    base = ctx.baseline()
    members = ctx.members or 1
    pmpm = base / (members * 12)
    pepy = base / members
    kind = cfg["norm"]
    factor = 1.0
    factor_label = ""
    if kind == "pmpm":
        headline_v, headline_l = _money(pmpm), "PMPM"
        factor_label = "per member per month"
    elif kind == "pepy":
        headline_v, headline_l = _money(pepy), "PEPY"
        factor_label = "per employee per year"
    elif kind == "geographic":
        factor = GEO_INDEX.get((ctx.state or "").upper(), 1.0)
        headline_v, headline_l = f"{factor:.2f}×", "Geo index"
        factor_label = f"{ctx.state or 'unknown'} vs national 1.00"
    elif kind == "age_gender":
        # modeled demographic risk off industry acuity (case-mix proxy)
        sic2 = str(ctx.biz_code or "")[:2]
        factor = CASEMIX_BY_SIC2.get(sic2, 1.0)
        headline_v, headline_l = f"{factor:.2f}×", "Demographic risk"
        factor_label = "modeled age/gender acuity"
    elif kind == "case_mix":
        sic2 = str(ctx.biz_code or "")[:2]
        factor = CASEMIX_BY_SIC2.get(sic2, 1.0)
        headline_v, headline_l = f"{factor:.2f}×", "Case-mix index"
        factor_label = "workforce acuity vs 1.00"
    elif kind == "credibility":
        k = 12000  # full-credibility member-months constant (modeled)
        mm = members * 12
        z = math.sqrt(mm / (mm + k))
        factor = z
        headline_v, headline_l = f"{z*100:.0f}%", "Credibility Z"
        factor_label = f"{members:,} members · √(mm/(mm+{k:,}))"
    elif kind == "seasonality":
        # Modeled healthcare seasonality (Q4 utilization peak vs Q1 deductible-reset
        # trough). Monthly member-months are not filed on the 5500, so the curve is a
        # published prior, not measured for this entity; annual PMPM is unchanged.
        peak, trough = 1.18, 0.86
        swing = peak - trough
        headline_v, headline_l = f"±{swing*50:.0f}%", "Seasonal swing"
        factor_label = "modeled Q4 peak vs Q1 trough (annual PMPM unchanged)"
    else:
        headline_v, headline_l = _money(pmpm), "PMPM"

    normalized_pmpm = pmpm * factor if kind in ("geographic", "age_gender", "case_mix") else pmpm
    override_active = ctx.members != ctx.members_filed
    pmpm_tier = MODELED if override_active else CERTIFIED
    pmpm_sub = (f"filed premium / (override {members:,} × 12)" if override_active
                else f"filed premium / ({members:,} × 12)")
    tiles = [
        _tile("Raw PMPM", _money(pmpm), pmpm_sub, pmpm_tier, "pmpm"),
        _tile(headline_l, headline_v, factor_label,
              CERTIFIED if (kind in ("pmpm", "pepy") and not override_active) else MODELED, "factor"),
        _tile("Normalized PMPM", _money(normalized_pmpm),
              "factor-adjusted" if factor != 1.0 else "no adjustment", MODELED, "normalized"),
        _tile("Members (filed)", f"{ctx.members_filed:,}",
              f"FY{ctx.latest['year']}", CERTIFIED, "members"),
    ]
    gauges = None
    if ctx.bench:
        gauges = {"type": "gauges", "title": "Admin fee percentile vs industry", "tier": MODELED,
                  "value": _safe(ctx.latest["admin"]),
                  "p50": ctx.bench["p50_admin"], "p75": ctx.bench["p75_admin"], "p90": ctx.bench["p90_admin"],
                  "unit": "$", "note": "Filed admin fee against DOL industry percentiles for this business code."}
    sections = [
        {"type": "drivers", "title": "Normalization detail", "tier": MODELED, "rows": [
            {"label": "Filed welfare premium", "value": _money(base), "note": f"FY{ctx.latest['year']}"},
            {"label": "Members (denominator)", "value": f"{members:,}", "note": "filed participants or override"},
            {"label": "Raw PMPM", "value": _money(pmpm), "note": "premium / member-months"},
            {"label": "Raw PEPY", "value": _money(pepy), "note": "premium / member-year"},
            {"label": "Applied factor", "value": f"{factor:.3f}×", "note": factor_label or "1.00"},
        ]},
    ]
    if gauges:
        sections.append(gauges)
    unlocks = [
        "Enrollment census (age/sex/dependent tier) to replace modeled acuity with a filed risk score",
        "Member-months by month to replace filed-participant denominator with exposure-weighted member-months",
    ]
    if kind == "seasonality":
        unlocks = [
            "Monthly paid-claims history to replace the modeled seasonality curve with this entity's measured monthly pattern",
        ] + unlocks
    if kind == "seasonality":
        methodology = (
            "Annual PMPM and PEPY are computed directly from the filed welfare premium and "
            "participant count"
            + (" (CERTIFIED denominators)" if not override_active
               else " (the denominator is a user override, so these are MODELED, not filed)")
            + ". The monthly swing is a published seasonality curve (Q4 utilization peak vs "
              "Q1 deductible-reset trough), not this entity's measured pattern, so it is MODELED; "
              "it redistributes spend within the year and leaves the annual PMPM unchanged.")
    else:
        methodology = (
            "PMPM and PEPY are computed directly from the filed welfare premium and participant "
            "count"
            + (" (CERTIFIED denominators)" if not override_active
               else " (the denominator is a user override, so these are MODELED, not filed)")
            + ". The normalization factor "
            + (f"({factor_label}) is a MODELED prior" if factor != 1.0 else "is 1.00 (no adjustment available)")
            + " because the 5500 does not carry an enrollment census; that adjustment is MODELED.")
    return {
        "tier": MODELED, "tiles": tiles, "sections": sections,
        "methodology": methodology,
        "unlocks": unlocks,
    }


def _fam_condition(cfg: Dict[str, Any], ctx: _Ctx) -> Dict[str, Any]:
    if not ctx.has_data:
        return _no_data_payload(cfg)
    members = ctx.members or 1
    if cfg.get("condition") == "gene_therapy":
        prev = GENE_THERAPY["prevalence"]
        cost = GENE_THERAPY["cost_per_case"]
        label = GENE_THERAPY["label"]
        exp_cases = members * prev
        exp_cost = exp_cases * cost
        tiles = [
            _tile("At-risk members", f"{members:,}", "covered lives (modeled)", MODELED, "members"),
            _tile("Modeled prevalence", f"{prev*100:.3f}%", "ultra-rare prior", MODELED, "prev"),
            _tile("Expected cases / yr", f"{exp_cases:.2f}", "Poisson expectation", MODELED, "cases"),
            _tile("Expected exposure", _money(exp_cost), f"@ {_money(cost)}/case", MODELED, "exposure"),
        ]
        rows = [
            {"label": "0 cases", "value": f"{math.exp(-exp_cases)*100:.1f}%", "note": "probability"},
            {"label": "1+ cases", "value": f"{(1-math.exp(-exp_cases))*100:.1f}%", "note": "probability"},
            {"label": "Single-case cost", "value": _money(cost), "note": "catastrophic unit cost"},
        ]
        methodology = (
            f"{label} exposure is modeled as a Poisson process over {members:,} covered lives at a "
            f"{prev*100:.3f}% modeled prevalence prior and {_money(cost)} per case. Dollar exposure is "
            "MODELED; a certified figure requires the actual specialty/medical claim record.")
        unlocks = ["Specialty and medical claims (835/837) to convert modeled exposure into filed cases"]
    else:
        cond = CONDITION_MODELS.get(cfg["condition"], {})
        elig = cond.get("eligibility", 0.05)
        base = cond.get("base", 0.5)
        cpm = cond.get("cost_per_member", 12000)
        sic3 = str(ctx.biz_code or "")[:3]
        risk = cond.get("by_sic3", {}).get(sic3, base)
        label = cond.get("label", cfg["condition"])
        at_risk = members * elig * risk
        exposure = at_risk * cpm
        tiles = [
            _tile("Eligible cohort", f"{members*elig:,.0f}", f"{elig*100:.0f}% of {members:,} members", MODELED, "cohort"),
            _tile("Industry risk", f"{risk*100:.0f}%", f"SIC {sic3 or 'n/a'} prior", MODELED, "risk"),
            _tile("At-risk members", f"{at_risk:,.0f}", "eligible × industry risk", MODELED, "atrisk"),
            _tile("Modeled exposure", _money(exposure), f"@ {_money(cpm)}/member", MODELED, "exposure"),
        ]
        rows = [
            {"label": "Covered lives", "value": f"{members:,}", "note": "filed participants or override"},
            {"label": "Eligibility prior", "value": f"{elig*100:.0f}%", "note": "modeled clinical eligibility"},
            {"label": "Industry risk prior", "value": f"{risk*100:.0f}%", "note": f"SIC3 {sic3 or 'default'}"},
            {"label": "Cost per at-risk member", "value": _money(cpm), "note": "modeled annual"},
            {"label": "Modeled annual exposure", "value": _money(exposure), "note": "eligible × risk × cost"},
        ]
        methodology = (
            f"{label} exposure = covered lives × modeled eligibility ({elig*100:.0f}%) × industry risk "
            f"prior × {_money(cpm)} modeled annual cost. Every factor is a MODELED workforce prior "
            "(eligibility and industry risk from the platform condition models), so the dollar figure is "
            "MODELED and never CERTIFIED.")
        unlocks = ["Pharmacy and medical claims to replace modeled priors with filed utilization"]
    sections = [{"type": "drivers", "title": "Exposure decomposition", "tier": MODELED, "rows": rows}]
    return {"tier": MODELED, "tiles": tiles, "sections": sections, "methodology": methodology, "unlocks": unlocks}


def _fam_decomposition(cfg: Dict[str, Any], ctx: _Ctx) -> Dict[str, Any]:
    if not ctx.has_data:
        return _no_data_payload(cfg)
    rate, _ = TREND_PRIORS["medical"]
    base = ctx.baseline()
    # modeled attribution of the trend into components
    comps = [
        ("Provider unit price", 0.42),
        ("Utilization", 0.24),
        ("Rx / specialty", 0.16),
        ("Case mix / acuity", 0.10),
        ("Cost shifting / leverage", 0.08),
    ]
    dollar_growth = base * rate
    bars = [{"label": n, "share": s, "value": round(dollar_growth * s, 0),
             "pct": round(rate * s * 100, 2)} for n, s in comps]
    tiles = [
        _tile("Filed premium", _money(base), f"FY{ctx.latest['year']}", CERTIFIED, "base"),
        _tile("Modeled trend", _pct(rate, 1), "composite medical", MODELED, "trend"),
        _tile("Annual $ growth", _money(dollar_growth), "premium × trend", MODELED, "growth"),
        _tile("Top driver", bars[0]["label"], f"{bars[0]['share']*100:.0f}% of trend", MODELED, "driver"),
    ]
    sections = [
        {"type": "decomposition", "title": "Trend attribution (modeled shares)", "tier": MODELED, "bars": bars,
         "note": "Each bar is a modeled share of the composite trend applied to the filed premium base."},
    ]
    return {
        "tier": MODELED, "tiles": tiles, "sections": sections,
        "methodology": (
            "The filed premium base is CERTIFIED. The decomposition applies modeled component shares of a "
            "composite medical trend; those shares are industry priors, so the per-component dollars are MODELED. "
            "Filed claims would convert the attribution to CERTIFIED."),
        "unlocks": ["Adjudicated claims (unit price × volume) to replace modeled trend shares with filed decomposition"],
    }


def _fam_simulation(cfg: Dict[str, Any], ctx: _Ctx) -> Dict[str, Any]:
    if not ctx.has_data:
        return _no_data_payload(cfg)
    base = ctx.baseline()
    members = ctx.members or 1
    lives_note = "filed participants" if ctx.members == ctx.members_filed else "user override"
    kind = cfg.get("sim")
    if kind == "catastrophic":
        # modeled large-claim tail: threshold $250k, prevalence per 1000
        thresh = 250_000
        per_1000 = 1.8
        exp_claims = members / 1000 * per_1000
        exp_cost = exp_claims * thresh * 1.9  # avg large claim ~1.9× threshold (modeled)
        tiles = [
            _tile("Large-claim threshold", _money(thresh), "modeled tail cut", MODELED, "thresh"),
            _tile("Expected claims / yr", f"{exp_claims:.1f}", f"{per_1000}/1000 lives", MODELED, "claims"),
            _tile("Modeled tail cost", _money(exp_cost), "expected catastrophic", MODELED, "cost"),
            _tile("Stop-loss signal", "Review" if exp_cost > base * 0.15 else "Contained",
                  "tail vs premium", MODELED, "signal"),
        ]
        rows = [
            {"label": "Covered lives", "value": f"{members:,}", "note": lives_note},
            {"label": "Large-claim incidence", "value": f"{per_1000}/1000", "note": "modeled prior"},
            {"label": "Avg large-claim severity", "value": _money(thresh * 1.9), "note": "1.9× threshold"},
            {"label": "Expected annual tail", "value": _money(exp_cost), "note": "incidence × severity"},
        ]
        methodology = ("Catastrophic exposure is a modeled tail: large-claim incidence per 1,000 lives × "
                       "modeled severity. Filed claims are required to certify the tail; this is MODELED.")
        unlocks = ["Individual stop-loss claim detail (per-claimant paid amounts) to certify the tail"]
    elif kind == "high_cost":
        # top 5% drive ~50% of spend (modeled Pareto)
        hcc = members * 0.05
        share = 0.50
        hcc_spend = base * share
        tiles = [
            _tile("High-cost claimants", f"{hcc:,.0f}", "top 5% (modeled)", MODELED, "hcc"),
            _tile("Spend concentration", "50%", "of premium (modeled)", MODELED, "conc"),
            _tile("HCC spend", _money(hcc_spend), "attributed to top 5%", MODELED, "spend"),
            _tile("Avg HCC cost", _money(hcc_spend / hcc if hcc else 0), "per claimant", MODELED, "avg"),
        ]
        rows = [
            {"label": "Total members", "value": f"{members:,}", "note": lives_note},
            {"label": "Modeled HCC prevalence", "value": "5%", "note": "top decile-of-decile"},
            {"label": "Modeled concentration", "value": "50% of spend", "note": "Pareto prior"},
            {"label": "Avg HCC cost", "value": _money(hcc_spend / hcc if hcc else 0), "note": "modeled"},
        ]
        methodology = ("High-cost claimant concentration uses a modeled Pareto prior (top 5% ≈ 50% of spend) "
                       "against the filed premium base. Certifying which members are high-cost requires the "
                       "claim record; this is MODELED.")
        unlocks = ["Member-level claims to identify actual high-cost claimants and true concentration"]
    else:  # monte_carlo
        rate, sigma = TREND_PRIORS["medical"]
        p10 = base * (1 + rate - 1.28 * sigma)
        p50 = base * (1 + rate)
        p90 = base * (1 + rate + 1.28 * sigma)
        series = [{"year": ctx.latest["year"], "actual": round(base, 0), "kind": "history"},
                  {"year": ctx.latest["year"] + 1, "p10": round(p10, 0), "p50": round(p50, 0),
                   "p90": round(p90, 0), "kind": "forecast"}]
        tiles = [
            _tile("P10 (favorable)", _money(p10), "10th percentile", MODELED, "p10"),
            _tile("P50 (expected)", _money(p50), "median outcome", MODELED, "p50"),
            _tile("P90 (adverse)", _money(p90), "90th percentile", MODELED, "p90"),
            _tile("Reserve @ P90", _money(p90 - p50), "P90 minus P50", MODELED, "reserve"),
        ]
        rows = [
            {"label": "Baseline premium", "value": _money(base), "note": f"FY{ctx.latest['year']}"},
            {"label": "Trend mean", "value": _pct(rate, 1), "note": "modeled prior"},
            {"label": "Trend volatility", "value": _pct(sigma, 1), "note": "modeled sigma"},
            {"label": "P90-P50 reserve", "value": _money(p90 - p50), "note": "adverse cushion"},
        ]
        methodology = ("A lognormal-style band around the filed premium base using a modeled trend mean and "
                       "volatility. Percentiles are MODELED (distribution parameters are priors, not filed).")
        unlocks = ["Multi-year claim distributions to fit the volatility empirically rather than from a prior"]
        sections = [{"type": "trend", "title": "Next-year spend distribution", "tier": MODELED,
                     "series": series, "note": "P10-P90 band around the modeled expected outcome."},
                    {"type": "drivers", "title": "Simulation inputs", "tier": MODELED, "rows": rows}]
        return {"tier": MODELED, "tiles": tiles, "sections": sections,
                "methodology": methodology, "unlocks": unlocks}
    sections = [{"type": "drivers", "title": "Simulation detail", "tier": MODELED, "rows": rows}]
    return {"tier": MODELED, "tiles": tiles, "sections": sections, "methodology": methodology, "unlocks": unlocks}


def _fam_economics(cfg: Dict[str, Any], ctx: _Ctx) -> Dict[str, Any]:
    """Healthcare-economics scenario engines. The savings model is MODELED on the
    filed premium base + user-supplied levers; the realized-dollar finding is
    INSUFFICIENT_EVIDENCE until claims / PBM remittance are ingested."""
    if not ctx.has_data:
        return _no_data_payload(cfg)
    base = ctx.baseline()
    members = ctx.members or 1
    lever = cfg.get("lever", 0.03)  # modeled effect fraction of addressable spend
    scope = cfg.get("scope", 0.5)   # modeled fraction of spend the program touches
    addr_label = cfg.get("addressable_label", "Addressable spend")
    out_label = cfg.get("outcome_label", "Modeled savings")
    realized_label = cfg.get("realized_label", "Realized savings")
    realized_note = cfg.get("realized_note", "needs claims / PBM")
    lever_label = cfg.get("lever_label", "modeled efficiency")
    unlocks = cfg.get("unlocks", ["Adjudicated medical/Rx claims (835/837)", "PBM remittance and rebate files"])
    addressable = base * scope
    modeled_outcome = addressable * lever
    tiles = [
        _tile("Filed premium", _money(base), f"FY{ctx.latest['year']}", CERTIFIED, "base"),
        _tile(addr_label, _money(addressable), f"{_pct(scope,0)} in scope (modeled)", MODELED, "scope"),
        _tile(out_label, _money(modeled_outcome), f"{_pct(lever,1)} of addressable", MODELED, "outcome"),
        _tile(realized_label, "INSUFFICIENT", realized_note, INSUFFICIENT, "realized"),
    ]
    rows = [
        {"label": "Filed premium base", "value": _money(base), "note": "CERTIFIED"},
        {"label": "In-scope share", "value": _pct(scope, 0), "note": "modeled program reach"},
        {"label": "Effect lever", "value": _pct(lever, 1), "note": lever_label},
        {"label": out_label, "value": _money(modeled_outcome), "note": "scope × lever × premium"},
        {"label": "Per member per year", "value": _money(modeled_outcome / members), "note": "modeled"},
    ]
    sections = [
        {"type": "scenario", "title": "Modeled scenario", "tier": MODELED, "rows": rows,
         "note": "Adjust covered lives via the control above to rescale. Levers are modeled program priors."},
        {"type": "unlocks", "title": "What unlocks a CERTIFIED dollar finding", "tier": INSUFFICIENT,
         "items": unlocks},
    ]
    return {
        "tier": MODELED, "tiles": tiles, "sections": sections,
        "methodology": (
            f"{cfg['name']} sizes the effect as filed premium × a modeled in-scope share ({_pct(scope,0)}) × a "
            f"modeled lever ({_pct(lever,1)}). The estimate is MODELED; the realized-dollar finding is "
            "INSUFFICIENT_EVIDENCE because it requires claim-level and/or PBM remittance data this platform has "
            "not ingested for this entity. Naming that gap is the honest finding, not a fabricated number."),
        "unlocks": unlocks,
    }


FAMILIES = {
    "trend": _fam_trend,
    "normalization": _fam_normalization,
    "condition": _fam_condition,
    "decomposition": _fam_decomposition,
    "simulation": _fam_simulation,
    "economics": _fam_economics,
}


# ─────────────────────────────────────────────────────────────────────────────
# Engine registry
# ─────────────────────────────────────────────────────────────────────────────
def _e(slug, name, category, blurb, icon, accent, family, tier_hint, **cfg):
    return {
        "slug": slug, "name": name, "category": category, "blurb": blurb,
        "icon": icon, "accent": accent, "family": family, "tier_hint": tier_hint,
        "config": {"name": name, **cfg},
    }


ENGINES: Dict[str, Dict[str, Any]] = {}


def _register(entry: Dict[str, Any]) -> None:
    ENGINES[entry["slug"]] = entry


FIN = "Financial & Trend"
ECON = "Healthcare Economics"

for e in [
    # ── Financial & Trend (20) ──────────────────────────────────────────────
    _e("medical-trend-forecast", "Medical Trend Forecasting", FIN,
       "Filed medical premium history projected forward with a modeled trend fan (P10-P90).",
       "TrendingUp", "#00D4FF", "trend", MODELED, line="medical", line_label="Medical", prior="medical"),
    _e("rx-trend-forecast", "Rx Trend Forecasting", FIN,
       "Pharmacy spend trajectory on a modeled Rx trend prior, with driver attribution.",
       "Pill", "#A855F7", "trend", MODELED, line="rx", line_label="Pharmacy", prior="rx"),
    _e("dental-trend-analysis", "Dental Trend Analysis", FIN,
       "Dental line trend off a modeled composite share of filed welfare premium.",
       "Activity", "#22D3EE", "trend", MODELED, line="dental", line_label="Dental", prior="dental"),
    _e("vision-trend-analysis", "Vision Trend Analysis", FIN,
       "Vision line trend off a modeled composite share of filed welfare premium.",
       "Activity", "#38BDF8", "trend", MODELED, line="vision", line_label="Vision", prior="vision"),
    _e("catastrophic-claims-forecast", "Catastrophic Claims Forecasting", FIN,
       "Modeled large-claim tail: incidence per 1,000 lives × modeled severity vs premium.",
       "AlertTriangle", "#FB7185", "simulation", MODELED, sim="catastrophic"),
    _e("high-cost-claimant-prediction", "High-Cost Claimant Prediction", FIN,
       "Modeled Pareto concentration of spend across the top 5% of covered lives.",
       "UserCheck", "#F59E0B", "simulation", MODELED, sim="high_cost"),
    _e("glp1-financial-impact", "GLP-1 Financial Impact Modeling", FIN,
       "GLP-1 exposure = covered lives × modeled eligibility × industry risk × cost prior.",
       "Pill", "#34D399", "condition", MODELED, condition="metabolic_glp1"),
    _e("gene-therapy-exposure", "Gene Therapy Exposure Modeling", FIN,
       "Ultra-rare catastrophic exposure modeled as a Poisson process over covered lives.",
       "FlaskConical", "#C084FC", "condition", MODELED, condition="gene_therapy"),
    _e("oncology-cost-projection", "Oncology Cost Projection", FIN,
       "Oncology exposure off modeled prevalence and industry risk priors.",
       "Activity", "#F472B6", "condition", MODELED, condition="oncology"),
    _e("inflation-decomposition", "Inflation Decomposition", FIN,
       "Splits composite medical trend into unit price, utilization, mix and leverage.",
       "BarChart3", "#00D4FF", "decomposition", MODELED),
    _e("provider-unit-cost-trend", "Provider Unit Cost Trend", FIN,
       "The unit-price component of trend projected forward on a modeled prior.",
       "LineChart", "#60A5FA", "trend", MODELED, line="medical", line_label="Provider unit cost", prior="unit_cost"),
    _e("utilization-trend", "Utilization Trend Engine", FIN,
       "The utilization component of trend (services per member) on a modeled prior.",
       "Activity", "#2DD4BF", "trend", MODELED, line="medical", line_label="Utilization", prior="utilization"),
    _e("geographic-normalization", "Geographic Normalization", FIN,
       "Normalizes PMPM by a modeled state cost index relative to the national 1.00.",
       "Globe2", "#38BDF8", "normalization", MODELED, norm="geographic"),
    _e("age-gender-risk-adjustment", "Age / Gender Risk Adjustment", FIN,
       "Applies a modeled demographic acuity factor to raw PMPM.",
       "Users", "#818CF8", "normalization", MODELED, norm="age_gender"),
    _e("case-mix-adjustment", "Case Mix Adjustment", FIN,
       "Modeled workforce case-mix index by industry applied to PMPM.",
       "Layers", "#A78BFA", "normalization", MODELED, norm="case_mix"),
    _e("pmpm-normalization", "PMPM Normalization", FIN,
       "Per-member-per-month from filed premium and participants (CERTIFIED denominators).",
       "Calculator", "#00FF94", "normalization", MODELED, norm="pmpm"),
    _e("pepy-normalization", "PEPY Normalization", FIN,
       "Per-employee-per-year from filed premium and participants.",
       "Calculator", "#34D399", "normalization", MODELED, norm="pepy"),
    _e("seasonality-adjustment", "Seasonality Adjustment", FIN,
       "Modeled 12-month seasonal swing (Q4 utilization peak vs Q1 deductible-reset trough) over filed premium.",
       "CalendarDays", "#22D3EE", "normalization", MODELED, norm="seasonality"),
    _e("credibility-weighting", "Credibility Weighting", FIN,
       "Actuarial credibility Z from member-months against a full-credibility constant.",
       "Sigma", "#FBBF24", "normalization", MODELED, norm="credibility"),
    _e("monte-carlo-forecast", "Monte Carlo Forecasting", FIN,
       "Distribution of next-year spend (P10/P50/P90) around a modeled trend and volatility.",
       "Sparkles", "#F59E0B", "simulation", MODELED, sim="monte_carlo"),
]:
    _register(e)

for e in [
    # ── Healthcare Economics (20) ───────────────────────────────────────────
    _e("site-of-care-migration", "Site-of-Care Migration", ECON,
       "Models savings from shifting eligible services from hospital outpatient to ambulatory sites.",
       "MapPin", "#00D4FF", "economics", MODELED, scope=0.20, lever=0.30,
       addressable_label="Shiftable spend", outcome_label="Modeled migration savings",
       lever_label="site differential", realized_note="needs claims by place-of-service",
       unlocks=["Adjudicated claims with place-of-service and CPT to identify shiftable encounters"]),
    _e("network-disruption-modeling", "Network Disruption Modeling", ECON,
       "Models member and cost impact of a network change against the filed premium base.",
       "GitBranch", "#60A5FA", "economics", MODELED, scope=0.60, lever=0.05,
       addressable_label="In-network spend", outcome_label="Modeled disruption cost",
       lever_label="access re-routing", realized_note="needs provider-level claims",
       unlocks=["Claim-level provider detail and a target network roster to measure real disruption"]),
    _e("reference-based-pricing-savings", "Reference-Based Pricing Savings", ECON,
       "Models savings from pricing facility claims at a Medicare-referenced multiple.",
       "Tag", "#34D399", "economics", MODELED, scope=0.50, lever=0.20,
       addressable_label="Facility spend", outcome_label="Modeled RBP savings",
       lever_label="allowed-to-billed gap", realized_note="needs 837 institutional claims",
       unlocks=["837 institutional claims with billed vs allowed to price against a Medicare reference"]),
    _e("direct-contracting-valuation", "Direct Contracting Valuation", ECON,
       "Values a direct-to-provider contract vs the carrier-negotiated baseline.",
       "Building2", "#38BDF8", "economics", MODELED, scope=0.30, lever=0.12,
       addressable_label="Contractable spend", outcome_label="Modeled contract value",
       lever_label="negotiated differential", realized_note="needs claims + fee schedule",
       unlocks=["Provider fee schedules and claim volumes to price a direct contract"]),
    _e("centers-of-excellence-roi", "Centers of Excellence ROI", ECON,
       "Models ROI of steering complex episodes to bundled centers of excellence.",
       "Sparkles", "#C084FC", "economics", MODELED, scope=0.08, lever=0.25,
       addressable_label="Complex-episode spend", outcome_label="Modeled COE savings",
       lever_label="bundle + complication avoidance", realized_note="needs episode claims",
       unlocks=["Episode-grouped claims (surgical bundles) to measure real COE outcomes"]),
    _e("bundled-payment-modeling", "Bundled Payment Modeling", ECON,
       "Models savings from converting fee-for-service episodes to bundled payments.",
       "Package2", "#A78BFA", "economics", MODELED, scope=0.15, lever=0.15,
       addressable_label="Episode spend", outcome_label="Modeled bundle savings",
       lever_label="variance compression", realized_note="needs episode-grouped claims",
       unlocks=["Claim data grouped into clinical episodes to define and price bundles"]),
    _e("payment-integrity-analysis", "Payment Integrity Analysis", ECON,
       "Sizes recoverable dollars from coding, duplicate and eligibility errors.",
       "ShieldCheck", "#FBBF24", "economics", INSUFFICIENT, scope=1.0, lever=0.03,
       addressable_label="Adjudicated spend", outcome_label="Modeled recoverable",
       lever_label="industry error rate", realized_note="needs 835/837 to detect errors",
       unlocks=["835 remittance and 837 claims to detect duplicate, upcoded and ineligible payments"]),
    _e("waste-fraud-abuse-detection", "Waste, Fraud & Abuse Detection", ECON,
       "Models WFA exposure as a share of adjudicated spend pending claim forensics.",
       "AlertTriangle", "#FB7185", "economics", INSUFFICIENT, scope=1.0, lever=0.07,
       addressable_label="Adjudicated spend", outcome_label="Modeled WFA exposure",
       lever_label="NHCAA industry prior", realized_note="needs claim-level forensics",
       unlocks=["Full claim + provider records to run WFA pattern detection"]),
    _e("episode-of-care-valuation", "Episode-of-Care Valuation", ECON,
       "Values total cost of a care episode across settings against the premium base.",
       "Activity", "#22D3EE", "economics", MODELED, scope=0.25, lever=0.10,
       addressable_label="Episode-linked spend", outcome_label="Modeled episode savings",
       lever_label="care-path optimization", realized_note="needs longitudinal claims",
       unlocks=["Longitudinal member claims to attribute spend to complete episodes"]),
    _e("specialty-pharmacy-economics", "Specialty Pharmacy Economics", ECON,
       "Models specialty drug spend, the fastest-growing pharmacy segment.",
       "Pill", "#F472B6", "economics", MODELED, scope=0.19, lever=0.18,
       addressable_label="Specialty Rx spend", outcome_label="Modeled specialty savings",
       lever_label="site + channel optimization", realized_note="needs PBM claims",
       unlocks=["PBM specialty claim detail (NDC, channel, rebate) to size real spend"]),
    _e("biosimilar-adoption-modeling", "Biosimilar Adoption Modeling", ECON,
       "Models savings from converting reference biologics to biosimilars.",
       "FlaskConical", "#A855F7", "economics", MODELED, scope=0.06, lever=0.30,
       addressable_label="Biologic spend", outcome_label="Modeled biosimilar savings",
       lever_label="reference-to-biosimilar gap", realized_note="needs PBM NDC detail",
       unlocks=["PBM claims by NDC to identify reference biologics eligible for biosimilar switch"]),
    _e("drug-pipeline-forecasting", "Drug Pipeline Forecasting", ECON,
       "Models forward Rx exposure from the specialty and gene-therapy pipeline.",
       "TrendingUp", "#C084FC", "economics", MODELED, scope=0.19, lever=0.08,
       addressable_label="Rx spend", outcome_label="Modeled pipeline exposure",
       lever_label="pipeline trend prior", realized_note="needs formulary + PBM claims",
       unlocks=["PBM formulary and utilization to map the pipeline onto this population"]),
    _e("rebate-optimization", "Rebate Optimization", ECON,
       "Models rebate capture vs a best-in-class PBM guarantee.",
       "PiggyBank", "#34D399", "economics", INSUFFICIENT, scope=0.19, lever=0.22,
       addressable_label="Rebate-eligible Rx", outcome_label="Modeled rebate upside",
       lever_label="guarantee gap", realized_note="needs PBM rebate remittance",
       unlocks=["PBM rebate remittance and contract guarantees to reconcile actual capture"]),
    _e("pbm-spread-pricing-detection", "PBM Spread Pricing Detection", ECON,
       "Models spread between what the plan pays the PBM and what the PBM pays the pharmacy.",
       "ShieldAlert", "#FF4D6D", "economics", INSUFFICIENT, scope=0.19, lever=0.12,
       addressable_label="Rx spend", outcome_label="Modeled spread exposure",
       lever_label="ingredient-cost gap", realized_note="needs PBM + pharmacy claims",
       unlocks=["PBM claim detail and pharmacy remittance (MAC lists) to measure real spread"]),
    _e("employer-cost-shifting", "Employer Cost Shifting", ECON,
       "Models the share of premium being shifted to employees via contributions.",
       "Users", "#818CF8", "economics", MODELED, scope=1.0, lever=0.06,
       addressable_label="Total premium", outcome_label="Modeled shift to employees",
       lever_label="contribution creep", realized_note="needs contribution schedule",
       unlocks=["Employee contribution schedules to measure the real cost-shift"]),
    _e("member-cost-burden", "Member Cost Burden", ECON,
       "Models member premium share and affordability against the filed base.",
       "Wallet", "#F59E0B", "economics", MODELED, scope=1.0, lever=0.25,
       addressable_label="Total premium", outcome_label="Modeled member premium share",
       lever_label="typical employee share", realized_note="needs contributions + OOP",
       unlocks=["Employee contributions and out-of-pocket claim data to size true burden"]),
    _e("benefit-richness-scoring", "Benefit Richness Scoring", ECON,
       "Models plan generosity (actuarial value proxy) from premium intensity.",
       "Layers", "#2DD4BF", "economics", MODELED, scope=1.0, lever=0.10,
       addressable_label="Premium intensity", outcome_label="Modeled richness value",
       lever_label="design generosity band", realized_note="needs plan design / SBC",
       unlocks=["Summary of Benefits and Coverage to compute a true actuarial value"]),
    _e("cost-elasticity", "Cost Elasticity", ECON,
       "Models the spend response to a change in member cost sharing.",
       "LineChart", "#60A5FA", "economics", MODELED, scope=1.0, lever=0.02,
       addressable_label="Total premium", outcome_label="Modeled spend response",
       lever_label="demand elasticity prior", realized_note="needs utilization elasticity data",
       unlocks=["Historical utilization under differing cost-share to fit true elasticity"]),
    _e("plan-migration-simulation", "Plan Migration Simulation", ECON,
       "Simulates savings from migrating the population to a redesigned plan.",
       "GitBranch", "#A78BFA", "economics", MODELED, scope=0.80, lever=0.09,
       addressable_label="Migratable spend", outcome_label="Modeled migration savings",
       lever_label="design + steerage", realized_note="needs plan design + claims",
       unlocks=["Target plan design and member claims to simulate a real migration"]),
    _e("healthcare-inflation-attribution", "Healthcare Inflation Attribution", ECON,
       "Attributes composite trend into unit price, utilization, mix and leverage.",
       "BarChart3", "#00D4FF", "decomposition", MODELED),
]:
    _register(e)


# ─────────────────────────────────────────────────────────────────────────────
# API
# ─────────────────────────────────────────────────────────────────────────────
def _catalog() -> List[Dict[str, Any]]:
    out = []
    for e in ENGINES.values():
        out.append({
            "slug": e["slug"], "name": e["name"], "category": e["category"],
            "blurb": e["blurb"], "icon": e["icon"], "accent": e["accent"],
            "tier_hint": e["tier_hint"], "family": e["family"],
        })
    return out


@router.get("")
def list_engines(_user=Depends(get_current_user)):
    cats: Dict[str, List[Dict[str, Any]]] = {}
    for e in _catalog():
        cats.setdefault(e["category"], []).append(e)
    return {
        "count": len(ENGINES),
        "categories": [{"name": k, "engines": v} for k, v in cats.items()],
        "engines": _catalog(),
    }


@router.get("/{slug}")
def run_engine(
    slug: str,
    ein: Optional[str] = Query(None),
    members: Optional[int] = Query(None, ge=1),
    _user=Depends(get_current_user),
):
    entry = ENGINES.get(slug)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Unknown engine: {slug}")
    resolved = _resolve_ein(ein)
    ctx = _Ctx(resolved, members)
    fam = FAMILIES[entry["family"]]
    result = fam(entry["config"], ctx)
    return {
        "slug": entry["slug"], "name": entry["name"], "category": entry["category"],
        "blurb": entry["blurb"], "accent": entry["accent"], "icon": entry["icon"],
        "entity": ctx.entity_dict(),
        "tier": result["tier"],
        "tiles": result["tiles"],
        "sections": result["sections"],
        "methodology": result["methodology"],
        "unlocks": result.get("unlocks", []),
    }


class NarrativeReq(BaseModel):
    ein: Optional[str] = None
    members: Optional[int] = None


@router.post("/{slug}/narrative")
async def engine_narrative(slug: str, body: NarrativeReq, _user=Depends(get_current_user)):
    entry = ENGINES.get(slug)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Unknown engine: {slug}")
    resolved = _resolve_ein(body.ein)
    ctx = _Ctx(resolved, body.members)
    fam = FAMILIES[entry["family"]]
    result = fam(entry["config"], ctx)
    try:
        from backend.agents.base import run_agent
    except Exception:
        raise HTTPException(status_code=503, detail="AI narrative unavailable")
    system = (
        "You are writing the analyst narrative for a single healthcare fiduciary intelligence engine. "
        "Return STRICT JSON: {\"headline\": str, \"paragraphs\": [str, str, str], \"next_step\": str}. "
        "Quantify consequences in dollars. Respect the confidence tier: never assert CERTIFIED where the "
        "computation is MODELED or INSUFFICIENT_EVIDENCE. Do not use em dashes."
    )
    user_msg = (
        f"Engine: {entry['name']} ({entry['category']}).\n"
        f"Entity: {ctx.entity_dict()}.\n"
        f"Overall tier: {result['tier']}.\n"
        f"Tiles: {result['tiles']}.\n"
        f"Methodology: {result['methodology']}\n"
        f"Unlocks: {result.get('unlocks', [])}."
    )
    out = await run_agent(system, user_msg, agent_label=f"Engine:{slug}")
    if not isinstance(out, dict) or out.get("error"):
        raise HTTPException(status_code=502, detail="Narrative generation failed")
    return out
