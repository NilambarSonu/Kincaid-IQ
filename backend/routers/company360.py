"""
Company 360 — cross-module aggregator keyed by employer EIN.

One endpoint fans out across every EIN-addressable module and returns a single
normalized dossier in the shared evidence vocabulary (confidence tiers +
dollar-denominated KPIs). Modules that cannot resolve by EIN return
INSUFFICIENT_EVIDENCE, which is a first-class finding under the platform doctrine
(narratives never outrun evidence) — not an error.

Each module entry carries a deep-link `route` so the frontend can hand the user
off into the underlying module with EIN + company context preserved.
"""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend import models
from backend.auth import get_current_user

logger = logging.getLogger("kincaid.company360")

router = APIRouter(prefix="/api/company-360", tags=["company-360"])

CERTIFIED = "CERTIFIED"
MODELED = "MODELED"
INSUFFICIENT = "INSUFFICIENT_EVIDENCE"


def _kpi(label: str, value: Any, unit: str = "") -> dict:
    return {"label": label, "value": value, "unit": unit}


def _gap_card(key: str, module: str, route: str, reason: str) -> dict:
    """A doctrine-compliant INSUFFICIENT_EVIDENCE card with a clear next step."""
    return {
        "key": key,
        "module": module,
        "route": route,
        "confidence": INSUFFICIENT,
        "headline": "No evidence on file for this employer",
        "summary": reason,
        "kpis": [],
    }


# ── Per-module resolvers ──────────────────────────────────────────────────────

def _card_benchmarking(ein: str) -> dict:
    """Filing Intelligence / Benefits Benchmarking — filed DOL Form 5500 data."""
    from backend.routers.rfp_intelligence import _get_benchmarking_bundle
    b = _get_benchmarking_bundle(ein)
    if not b:
        return _gap_card(
            "benchmarking", "Filing Intelligence", "/benefits-benchmarking",
            "No DOL Form 5500 filing found for this EIN.",
        )
    return {
        "key": "benchmarking",
        "module": "Filing Intelligence",
        "route": "/benefits-benchmarking",
        "confidence": CERTIFIED,
        "headline": f"{b.get('sponsor_name') or 'Sponsor'} — filed {b.get('latest_year')}",
        "summary": (
            f"Latest Form 5500 (FY{b.get('latest_year')}) shows "
            f"{b.get('participants'):,} participants on carrier "
            f"{b.get('carrier') or 'n/a'}."
        ),
        "kpis": [
            _kpi("Admin Fees", round(b.get("admin_fees") or 0), "$"),
            _kpi("Broker Commissions", round(b.get("broker_commissions") or 0), "$"),
            _kpi("Plan Income", round(b.get("total_income") or 0), "$"),
            _kpi("Participants", int(b.get("participants") or 0), ""),
        ],
    }


def _card_shady_broker(ein: str) -> dict:
    """Shady Broker Index — multi-year forensic integrity score."""
    from backend.routers.shady_broker import _analyze
    try:
        r = _analyze(ein)
    except HTTPException:
        return _gap_card(
            "shady-broker", "Shady Broker Index", "/shady-broker-index",
            "No multi-year filing history to score broker integrity.",
        )
    exposure = r.get("exposure", {})
    return {
        "key": "shady-broker",
        "module": "Shady Broker Index",
        "route": "/shady-broker-index",
        "confidence": MODELED,
        "headline": f"Integrity Score {r.get('overall_score')}/100 — {r.get('rating')}",
        "summary": (
            f"{r.get('criticals', 0)} critical / {r.get('highs', 0)} high findings "
            f"across {r.get('years_analyzed', 0)} years "
            f"({r.get('year_range', '')})."
        ),
        "kpis": [
            _kpi("Integrity Score", r.get("overall_score"), "/100"),
            _kpi("Annual $ at Risk", round(exposure.get("annual_at_risk") or 0), "$"),
            _kpi("5-Year At-Risk Value", round(exposure.get("five_year_at_risk") or 0), "$"),
            _kpi("Avg Broker % of Income",
                 (r.get("totals", {}) or {}).get("avg_broker_pct_income"), "%"),
        ],
    }


def _card_sales_os(ein: str) -> dict:
    """Sales OS — opportunity scoring and addressable premium."""
    from backend.routers.sales_os import get_prospect_detail
    try:
        res = get_prospect_detail(ein)
    except HTTPException:
        return _gap_card(
            "sales-os", "Sales OS", "/sales-os",
            "Employer not present in the prospecting universe.",
        )
    d = (res or {}).get("data", {}) or {}
    return {
        "key": "sales-os",
        "module": "Sales OS",
        "route": f"/sales-os/account/{ein}",
        "confidence": MODELED,
        "headline": f"Opportunity Score {d.get('opportunity_score')}/100 — {d.get('opportunity_tier')}",
        "summary": (
            f"Commission rate {d.get('commission_rate')}% of welfare premium; "
            f"{int(d.get('max_participants') or 0):,} participants."
        ),
        "kpis": [
            _kpi("Opportunity Score", d.get("opportunity_score"), "/100"),
            _kpi("Est. Annual Premium", round(d.get("total_welfare_premiums") or 0), "$"),
            _kpi("Broker Commissions", round(d.get("total_broker_commissions") or 0), "$"),
            _kpi("Commission Rate", d.get("commission_rate"), "%"),
        ],
    }


def _card_stop_loss(bundle: dict) -> dict:
    """Stop-Loss IQ — gated on whether the filing reports stop-loss coverage."""
    if not bundle:
        return _gap_card(
            "stop-loss", "Stop-Loss IQ", "/stop-loss",
            "No filing on record to detect stop-loss coverage.",
        )
    if not bundle.get("has_stop_loss"):
        return _gap_card(
            "stop-loss", "Stop-Loss IQ", "/stop-loss",
            "Filing reports no stop-loss schedule — upload a policy to analyze attachment risk.",
        )
    return {
        "key": "stop-loss",
        "module": "Stop-Loss IQ",
        "route": "/stop-loss",
        "confidence": MODELED,
        "headline": "Stop-loss coverage detected on filing",
        "summary": "Employer carries stop-loss. Upload the policy for lasering and attachment-point analysis.",
        "kpis": [
            _kpi("Participants", int(bundle.get("participants") or 0), ""),
            _kpi("Carrier", bundle.get("carrier") or "n/a", ""),
        ],
    }


def _card_fiduciary(bundle: dict) -> dict:
    """Fiduciary IQ — modeled 408(b)(2) signal from disclosed fees vs income."""
    if not bundle:
        return _gap_card(
            "fiduciary-iq", "Fiduciary IQ", "/fiduciary-iq",
            "No filing on record to assess fiduciary exposure.",
        )
    income = bundle.get("total_income") or 0
    fees = (bundle.get("admin_fees") or 0) + (bundle.get("broker_commissions") or 0)
    fee_pct = round(fees / income * 100, 2) if income > 0 else 0
    elevated = fee_pct > 10.0
    return {
        "key": "fiduciary-iq",
        "module": "Fiduciary IQ",
        "route": "/fiduciary-iq",
        "confidence": MODELED,
        "headline": f"Disclosed fee load {fee_pct}% of plan income",
        "summary": (
            "Elevated fee load relative to plan income — review 408(b)(2) disclosures."
            if elevated else
            "Fee load within typical range; create a plan to certify duty-level compliance."
        ),
        "kpis": [
            _kpi("Fee Load", fee_pct, "%"),
            _kpi("Disclosed Fees", round(fees), "$"),
            _kpi("Audit Signal", "ELEVATED" if elevated else "NOMINAL", ""),
        ],
    }


def _card_network() -> dict:
    return _gap_card(
        "network-iq", "Network IQ", "/network-iq",
        "Network adequacy requires a provider directory and member ZIP file — not derivable from Form 5500.",
    )


def _card_rx_defense() -> dict:
    return _gap_card(
        "rx-defense", "Rx Defense IQ", "/rx-defense",
        "PBM contract analysis requires uploading the contract document for this employer.",
    )


def _card_war_room(ein: str, identity: dict) -> dict:
    """CFO War Room — the executive synthesis surface for this entity."""
    return {
        "key": "war-room",
        "module": "CFO War Room",
        "route": "/cfo-war-room",
        "confidence": MODELED,
        "headline": "Open the 4-tile executive synthesis",
        "summary": "Compose this employer's findings into Financial Exposure, Contract Integrity, Operational Behavior, and Strategic Leverage.",
        "kpis": [],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/search")
def search_companies(
    q: str = Query(..., min_length=2),
    limit: int = 12,
    user: models.User = Depends(get_current_user),
):
    """Type-ahead company search over the DuckDB employers table."""
    try:
        from backend.duckdb import get_duck
        duck = get_duck()
        rows = duck.execute(
            """
            SELECT EIN, employer_name, state, city, latest_year, max_participants
            FROM employers
            WHERE employer_name ILIKE ?
            ORDER BY max_participants DESC NULLS LAST
            LIMIT ?
            """,
            [f"%{q}%", limit],
        ).fetchall()
    except Exception as exc:
        logger.warning(f"[Company360] search failed: {exc}")
        return {"results": []}
    return {
        "results": [
            {
                "ein": str(r[0]),
                "company": r[1],
                "state": r[2],
                "city": r[3],
                "latest_year": r[4],
                "participants": int(r[5] or 0),
            }
            for r in rows
        ]
    }


@router.get("/{ein}")
def company_360(
    ein: str,
    user: models.User = Depends(get_current_user),
):
    """Aggregate every EIN-addressable module into one normalized dossier."""
    ein = ein.strip()

    # Identity + benchmarking bundle is the spine; fetch once and reuse.
    from backend.routers.rfp_intelligence import _get_benchmarking_bundle
    bundle = _get_benchmarking_bundle(ein)
    if not bundle:
        raise HTTPException(404, f"No filing evidence on record for EIN {ein}")

    identity = {
        "ein": ein,
        "sponsor": bundle.get("sponsor_name"),
        "city": bundle.get("city"),
        "state": bundle.get("state"),
        "industry": bundle.get("industry"),
        "participants": int(bundle.get("participants") or 0),
        "carrier": bundle.get("carrier"),
        "latest_year": bundle.get("latest_year"),
    }

    # (key, module label, deep-link route, resolver) — the tuple guarantees a
    # deterministic fallback card so dossier cardinality is stable even when a
    # single module errors. Fixed cardinality keeps the roll-up math honest.
    resolvers = [
        ("benchmarking", "Filing Intelligence", "/benefits-benchmarking", lambda: _card_benchmarking(ein)),
        ("shady-broker", "Shady Broker Index", "/shady-broker-index", lambda: _card_shady_broker(ein)),
        ("sales-os", "Sales OS", f"/sales-os/account/{ein}", lambda: _card_sales_os(ein)),
        ("stop-loss", "Stop-Loss IQ", "/stop-loss", lambda: _card_stop_loss(bundle)),
        ("network-iq", "Network IQ", "/network-iq", _card_network),
        ("rx-defense", "Rx Defense IQ", "/rx-defense", _card_rx_defense),
        ("fiduciary-iq", "Fiduciary IQ", "/fiduciary-iq", lambda: _card_fiduciary(bundle)),
        ("war-room", "CFO War Room", "/cfo-war-room", lambda: _card_war_room(ein, identity)),
    ]

    modules: List[dict] = []
    for key, module, route, resolve in resolvers:
        try:
            modules.append(resolve())
        except Exception as exc:  # never let one module break the dossier
            logger.warning(f"[Company360] module resolver '{key}' failed for {ein}: {exc}")
            modules.append(_gap_card(key, module, route, "Module temporarily unavailable."))

    # Aggregate roll-up in the shared vocabulary.
    confidence_mix: Dict[str, int] = {CERTIFIED: 0, MODELED: 0, INSUFFICIENT: 0}
    for m in modules:
        confidence_mix[m["confidence"]] = confidence_mix.get(m["confidence"], 0) + 1

    shady = next((m for m in modules if m["key"] == "shady-broker"), None)
    annual_leak = 0.0
    if shady:
        for k in shady.get("kpis", []):
            if k["label"] == "Annual $ at Risk":
                annual_leak = float(k["value"] or 0)

    rollup = {
        "total_broker_commissions": round(bundle.get("broker_commissions") or 0),
        "total_admin_fees": round(bundle.get("admin_fees") or 0),
        "total_plan_income": round(bundle.get("total_income") or 0),
        "estimated_annual_leakage": round(annual_leak),
        "modules_with_findings": sum(
            1 for m in modules if m["confidence"] != INSUFFICIENT
        ),
        "modules_total": len(modules),
        "confidence_mix": confidence_mix,
    }

    return {
        "ein": ein,
        "company": identity["sponsor"],
        "identity": identity,
        "rollup": rollup,
        "modules": modules,
    }
