"""
Sales Command - the unifying Kincaid Health Sales OS Executive Command Center.

The platform grew several strong but fragmented sales surfaces (Sales OS pre-call
intelligence, Opportunity OS book-of-business analysis, the Sales IQ broker
console, CRM sync, and the AI agent council). This endpoint is the single source
of truth that fans out ACROSS those surfaces IN-PROCESS (never via HTTP) and
returns one normalized command-center payload: executive KPIs, data-backed
rollup module cards, a pipeline snapshot, CRM connection status, the AI-agent
roster, and a navigational launchpad.

It follows the Company 360 aggregator doctrine: each rollup module is resolved
through a (key, label, route, resolver) tuple with a try/except fallback so a
single failing module degrades to a gap card instead of breaking the whole
command center. Fixed module cardinality keeps the roll-up math honest, and
confidence tiers are reported honestly (a metric we cannot source, e.g. win
rate, ships as INSUFFICIENT_EVIDENCE naming its unlock, never a fabricated
number).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db

logger = logging.getLogger("kincaid.sales_command")

router = APIRouter(prefix="/api/sales-command", tags=["sales-command"])

CERTIFIED = "CERTIFIED"
MODELED = "MODELED"
INSUFFICIENT = "INSUFFICIENT_EVIDENCE"


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _kpi(label: str, value: Any, unit: str, confidence: str, sublabel: str) -> dict:
    return {
        "label": label,
        "value": value,
        "unit": unit,
        "confidence": confidence,
        "sublabel": sublabel,
    }


def _gap_card(key: str, module: str, route: str, reason: str) -> dict:
    """Doctrine-compliant INSUFFICIENT_EVIDENCE rollup card with a next step."""
    return {
        "key": key,
        "module": module,
        "route": route,
        "confidence": INSUFFICIENT,
        "headline": "Module rollup unavailable",
        "summary": reason,
        "kpis": [],
    }


def _fmt_usd_compact(n: float) -> str:
    n = float(n or 0)
    if n >= 1e9:
        return f"${n / 1e9:.2f}B"
    if n >= 1e6:
        return f"${n / 1e6:.1f}M"
    if n >= 1e3:
        return f"${n / 1e3:.0f}K"
    return f"${n:.0f}"


# ── Per-module rollup resolvers (in-process helper reuse, never HTTP) ──────────

def _card_sales_os(db: Session) -> dict:
    """Sales OS - pre-call federal-filing intelligence + pipeline."""
    from backend.routers import sales_os

    stats = sales_os.get_pipeline_stats()["data"]
    pipe = sales_os.get_pipeline(db)
    rows = pipe.get("data") or []
    accounts = int(pipe.get("count") or 0)
    source = pipe.get("source") or ""
    accounts_tier = CERTIFIED if source == "DB" else MODELED
    # Recompute recoverable from the served pipeline rows so the dollar figure
    # shares the same evidence basis as the account count above (no DB-count /
    # seed-dollar mixing). Stays MODELED: it is a high-estimate band, not booked.
    recoverable = sum(float(r.get("recoverable_high") or r.get("est_premium") or 0) for r in rows)
    return {
        "key": "sales-os",
        "module": "Sales OS",
        "route": "/sales-os",
        "confidence": MODELED,
        "headline": f"{accounts} accounts · {_fmt_usd_compact(recoverable)} recoverable capital identified",
        "summary": "Evidence briefings across commercial accounts with 100+ employees, sourced from six federal filing APIs.",
        "kpis": [
            _kpi("Pipeline Accounts", accounts, "", accounts_tier, f"Source: {source or 'n/a'}"),
            _kpi("Recoverable Capital", round(recoverable), "$", MODELED, f"High-estimate band ({source or 'modeled'})"),
            _kpi("Avg Broker Compensation Index", stats.get("avg_sbi_score"), "", MODELED, "Seed cohort mean"),
        ],
    }


def _card_opportunity_os() -> dict:
    """Opportunity OS - book-of-business revenue opportunity."""
    from backend.routers import opportunity_os

    dash = opportunity_os._build_dashboard()
    k = dash["kpis"]
    revenue = float(k.get("total_bb_revenue_opportunity") or 0)
    return {
        "key": "opportunity-os",
        "module": "Opportunity OS",
        "route": "/opportunity-os",
        "confidence": MODELED,
        "headline": f"{k.get('executives_evaluated', 0)} executives · {_fmt_usd_compact(revenue)} modeled revenue opportunity",
        "summary": "Weighted opportunity scores across the executive roster, mapped to the Kincaid Health product catalog.",
        "kpis": [
            _kpi("Executives Evaluated", k.get("executives_evaluated"), "", MODELED, "Roster size"),
            _kpi("Revenue Opportunity", round(revenue), "$", MODELED, "Modeled from book attributes"),
            _kpi("Tier 1 (Pursue Now)", k.get("tier_1_count"), "", MODELED, "Highest-priority accounts"),
        ],
    }


def _card_broker(db: Session, user: models.User) -> dict:
    """Sales IQ Console - broker book of business."""
    from backend.routers import saas_broker

    dash = saas_broker.broker_dashboard(db, user)
    s = dash["summary"]
    premium = float(s.get("total_premium_bor") or 0)
    return {
        "key": "sales-iq-console",
        "module": "Sales IQ Console",
        "route": "/saas/broker",
        "confidence": MODELED,
        "headline": f"{s.get('total_clients', 0)} clients · {_fmt_usd_compact(premium)} premium under BoR",
        "summary": "Live broker book: renewal timelines, risk scoring, and pending analysis across the client roster.",
        "kpis": [
            _kpi("Active Clients", s.get("active_clients"), "", MODELED, f"of {s.get('total_clients', 0)} total"),
            _kpi("Premium (BoR)", round(premium), "$", MODELED, "Broker of record"),
            _kpi("Renewals <30d", s.get("renewals_30d"), "", MODELED, "Near-term renewal window"),
        ],
    }


# ── Executive KPI strip ───────────────────────────────────────────────────────

def _executive_kpis(db: Session, user: models.User) -> List[dict]:
    kpis: List[dict] = []

    # Weighted pipeline value (Opportunity OS modeled revenue).
    try:
        from backend.routers import opportunity_os
        rev = float(opportunity_os._build_dashboard()["kpis"].get("total_bb_revenue_opportunity") or 0)
        kpis.append(_kpi("Weighted Pipeline Value", round(rev), "$", MODELED, "Opportunity OS modeled revenue"))
    except Exception as exc:
        logger.warning(f"[SalesCommand] pipeline value KPI failed: {exc}")
        kpis.append(_kpi("Weighted Pipeline Value", None, "$", INSUFFICIENT, "Opportunity OS rollup unavailable"))

    # Recoverable capital identified (Sales OS pre-call briefs).
    try:
        from backend.routers import sales_os
        rec = float(sales_os.get_pipeline_stats()["data"].get("total_recoverable_high") or 0)
        kpis.append(_kpi("Recoverable Capital", round(rec), "$", MODELED, "Sales OS pre-call briefs"))
    except Exception as exc:
        logger.warning(f"[SalesCommand] recoverable KPI failed: {exc}")
        kpis.append(_kpi("Recoverable Capital", None, "$", INSUFFICIENT, "Sales OS rollup unavailable"))

    # Active pipeline accounts (DB-backed count when present).
    try:
        from backend.routers import sales_os
        pipe = sales_os.get_pipeline(db)
        tier = CERTIFIED if pipe.get("source") == "DB" else MODELED
        kpis.append(_kpi("Active Pipeline Accounts", int(pipe.get("count") or 0), "", tier, f"Source: {pipe.get('source', 'n/a')}"))
    except Exception as exc:
        logger.warning(f"[SalesCommand] accounts KPI failed: {exc}")
        kpis.append(_kpi("Active Pipeline Accounts", None, "", INSUFFICIENT, "Pipeline unavailable"))

    # Broker book premium under BoR (Sales IQ Console).
    try:
        from backend.routers import saas_broker
        prem = float(saas_broker.broker_dashboard(db, user)["summary"].get("total_premium_bor") or 0)
        kpis.append(_kpi("Broker Book Premium", round(prem), "$", MODELED, "Sales IQ Console (BoR)"))
    except Exception as exc:
        logger.warning(f"[SalesCommand] broker premium KPI failed: {exc}")
        kpis.append(_kpi("Broker Book Premium", None, "$", INSUFFICIENT, "Broker console unavailable"))

    # AI interactions logged - a hard count of the platform AI audit log.
    try:
        ai_count = db.query(models.Log).count()
        kpis.append(_kpi("AI Interactions Logged", int(ai_count), "", CERTIFIED, "Platform AI audit log"))
    except Exception as exc:
        logger.warning(f"[SalesCommand] AI log KPI failed: {exc}")
        kpis.append(_kpi("AI Interactions Logged", None, "", INSUFFICIENT, "Audit log unavailable"))

    # Win rate - no closed-won/lost tracking yet, so this is a first-class gap.
    kpis.append(_kpi(
        "Win Rate", None, "%", INSUFFICIENT,
        "Unlocks when closed-won / closed-lost stages are tracked in the pipeline",
    ))

    return kpis


# ── Pipeline snapshot ─────────────────────────────────────────────────────────

def _pipeline_snapshot(db: Session) -> dict:
    from backend.routers import sales_os

    pipe = sales_os.get_pipeline(db)
    rows = pipe.get("data") or []
    dist: Dict[str, dict] = {}
    total_value = 0.0
    for r in rows:
        stage = r.get("stage") or r.get("status") or "Unqualified"
        stage = str(stage).replace("_", " ").title()
        val = float(r.get("est_premium") or r.get("recoverable_high") or 0)
        total_value += val
        bucket = dist.setdefault(stage, {"stage": stage, "count": 0, "value": 0.0})
        bucket["count"] += 1
        bucket["value"] += val
    stages = sorted(dist.values(), key=lambda s: s["value"], reverse=True)
    for s in stages:
        s["value"] = round(s["value"])
    return {
        "count": int(pipe.get("count") or 0),
        "total_value": round(total_value),
        "source": pipe.get("source"),
        "confidence": pipe.get("confidence", MODELED),
        "stages": stages,
    }


# ── CRM connection status (config-only - no live pings on the command center) ──

def _crm_status() -> List[dict]:
    from backend.routers import crm_sync

    hubspot = bool(crm_sync._hubspot_configured())
    salesforce = bool(crm_sync.SF_USERNAME and crm_sync.SF_PASSWORD)
    lightfield = bool(getattr(crm_sync, "LIGHTFIELD_API_KEY", ""))
    return [
        {"provider": "HubSpot", "configured": hubspot, "route": "/crm-sync"},
        {"provider": "Salesforce", "configured": salesforce, "route": "/crm-sync"},
        {"provider": "Lightfield", "configured": lightfield, "route": "/crm-sync"},
    ]


# ── AI agent roster ───────────────────────────────────────────────────────────

def _agents(db: Session) -> dict:
    from backend.routers.hios import AGENT_REGISTRY

    try:
        interactions = int(db.query(models.Log).count())
    except Exception:
        interactions = 0
    return {
        "total": len(AGENT_REGISTRY),
        "tier_1": sum(1 for a in AGENT_REGISTRY if a["tier"] == 1),
        "tier_2": sum(1 for a in AGENT_REGISTRY if a["tier"] == 2),
        "tier_3": sum(1 for a in AGENT_REGISTRY if a["tier"] == 3),
        "interactions_logged": interactions,
        "roster": AGENT_REGISTRY,
    }


# ── Navigational launchpad (links only - not findings) ────────────────────────

def _launchpad() -> List[dict]:
    return [
        {"key": "sales-os", "label": "Sales OS", "route": "/sales-os",
         "description": "Pre-call evidence briefings from six federal filing APIs.", "accent": "#D4AF37"},
        {"key": "opportunity-os", "label": "Opportunity OS", "route": "/opportunity-os",
         "description": "Book-of-business scoring and revenue opportunity mapping.", "accent": "#00D4FF"},
        {"key": "sales-iq-console", "label": "Sales IQ Console", "route": "/saas/broker",
         "description": "Broker book: renewals, risk scoring, pending analysis.", "accent": "#D4AF37"},
        {"key": "sales-iq-intel", "label": "Sales IQ Intelligence", "route": "/sales-iq-intel",
         "description": "50-state regulatory strictness and local sales angles.", "accent": "#A855F7"},
        {"key": "account-intel", "label": "Account Intel Hub", "route": "/account-intel",
         "description": "Cross-API account enrichment and contact discovery.", "accent": "#00FF94"},
        {"key": "shady-broker", "label": "Broker Compensation Index", "route": "/shady-broker-index",
         "description": "0-100 broker opacity and conflict-of-interest index.", "accent": "#FF6B1A"},
        {"key": "company-360", "label": "Company 360", "route": "/company-360",
         "description": "Every EIN-addressable module in one dossier.", "accent": "#4f7dff"},
        {"key": "crm-sync", "label": "CRM Sync", "route": "/crm-sync",
         "description": "Push accounts, contacts, and deals to HubSpot / Salesforce.", "accent": "#22c55e"},
    ]


@router.get("/health", summary="Sales Command health check")
def health():
    return {"ok": True, "service": "sales-command", "ts": _iso_now()}


@router.get("/overview", summary="Unified Sales OS command-center rollup")
def overview(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Fan out across every sales surface in-process and return one payload."""
    # Fixed-cardinality rollup cards; a failing resolver degrades to a gap card.
    resolvers: List[tuple] = [
        ("sales-os", "Sales OS", "/sales-os", lambda: _card_sales_os(db)),
        ("opportunity-os", "Opportunity OS", "/opportunity-os", _card_opportunity_os),
        ("sales-iq-console", "Sales IQ Console", "/saas/broker", lambda: _card_broker(db, user)),
    ]
    modules: List[dict] = []
    for key, label, route, resolve in resolvers:
        try:
            modules.append(resolve())
        except Exception as exc:  # never let one module break the command center
            logger.warning(f"[SalesCommand] module resolver '{key}' failed: {exc}")
            modules.append(_gap_card(key, label, route, "Module rollup temporarily unavailable."))

    confidence_mix: Dict[str, int] = {CERTIFIED: 0, MODELED: 0, INSUFFICIENT: 0}
    for m in modules:
        confidence_mix[m["confidence"]] = confidence_mix.get(m["confidence"], 0) + 1

    # Supplemental sections degrade to safe fallbacks rather than 500 the page.
    try:
        pipeline = _pipeline_snapshot(db)
    except Exception as exc:
        logger.warning(f"[SalesCommand] pipeline snapshot failed: {exc}")
        pipeline = {"count": 0, "total_value": 0, "source": None, "confidence": INSUFFICIENT, "stages": []}
    try:
        crm = _crm_status()
    except Exception as exc:
        logger.warning(f"[SalesCommand] crm status failed: {exc}")
        crm = []
    try:
        agents = _agents(db)
    except Exception as exc:
        logger.warning(f"[SalesCommand] agents roster failed: {exc}")
        agents = {"total": 0, "tier_1": 0, "tier_2": 0, "tier_3": 0, "interactions_logged": 0, "roster": []}

    return {
        "generated_at": _iso_now(),
        "executive_kpis": _executive_kpis(db, user),
        "modules": modules,
        "pipeline": pipeline,
        "crm": crm,
        "agents": agents,
        "launchpad": _launchpad(),
        "rollup": {
            "modules_with_findings": sum(1 for m in modules if m["confidence"] != INSUFFICIENT),
            "modules_total": len(modules),
            "confidence_mix": confidence_mix,
        },
    }
