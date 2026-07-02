"""
RFP Intelligence OS — Executive Command Center
Aggregation endpoint that rolls up all RFP OS modules into a single
leadership cockpit payload.

GET /api/rfp/command-center
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db

logger = logging.getLogger("kincaid.rfp_command_center")
router = APIRouter(prefix="/api/rfp", tags=["rfp-command-center"])

# ── Win-probability by scoring tier ───────────────────────────────────────────
# MODELED: derived from SCORE_WEIGHTS win_probability factor structure.
TIER_WIN_PROB = {
    "pursue_aggressively": 0.72,
    "pursue_selectively":  0.48,
    "monitor":             0.22,
    "decline":             0.05,
}

# Stages that are "in pipeline" (not yet closed)
PIPELINE_STAGES = {"new", "qualifying", "drafting", "submitted", "decision",
                   "reviewing", "scoring", "proposal", "prospect",
                   "qualified", "negotiation"}

CLOSED_WON   = {"won"}
CLOSED_LOST  = {"lost", "no_bid"}


def _safe_json(text: Optional[str]) -> Any:
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _fmt_short(n: float) -> str:
    if n >= 1_000_000_000:
        return f"${n / 1_000_000_000:.1f}B"
    if n >= 1_000_000:
        return f"${n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"${n / 1_000:.0f}K"
    return f"${n:.0f}"


@router.get("/command-center")
def rfp_command_center(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    uid = user.id

    # ── 1. All opportunities for this user ────────────────────────────────────
    opps = db.query(models.RfpOpportunity).filter(
        models.RfpOpportunity.user_id == uid
    ).all()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Segment by lifecycle stage
    pipeline_opps = [o for o in opps if o.stage in PIPELINE_STAGES]
    won_opps      = [o for o in opps if o.stage in CLOSED_WON]
    lost_opps     = [o for o in opps if o.stage in CLOSED_LOST]
    closed_opps   = won_opps + lost_opps

    total_rfps      = len(opps)
    total_pipeline  = len(pipeline_opps)
    total_won       = len(won_opps)
    total_lost      = len(lost_opps)
    total_closed    = len(closed_opps)

    # Win / loss rate
    win_rate  = round(total_won  / total_closed * 100) if total_closed else 0
    loss_rate = round(total_lost / total_closed * 100) if total_closed else 0

    # Pipeline value — sum estimated_value for in-pipeline opps
    pipeline_value = sum(
        (o.estimated_value or o.estimated_contract_value or 0)
        for o in pipeline_opps
    )

    # Forecasted revenue — pipeline_value × tier-based win-probability
    # Method: each opportunity's win-probability is drawn from its score_tier;
    # if unscored, we use "monitor" (0.22) as a conservative default (MODELED).
    forecast_by_tier: dict[str, float] = {}
    forecasted_revenue = 0.0
    for o in pipeline_opps:
        tier = o.score_tier or "monitor"
        wp   = TIER_WIN_PROB.get(tier, 0.22)
        ev   = o.estimated_value or o.estimated_contract_value or 0
        contrib = ev * wp
        forecasted_revenue += contrib
        forecast_by_tier[tier] = forecast_by_tier.get(tier, 0.0) + contrib

    # Average win-probability across pipeline (weighted by value)
    avg_win_prob = (forecasted_revenue / pipeline_value * 100) if pipeline_value else 22.0

    # ── 2. Top strategic opportunities ────────────────────────────────────────
    top_opps_raw = sorted(
        pipeline_opps,
        key=lambda o: (
            o.opportunity_score or o.score or 0,
            o.estimated_value or o.estimated_contract_value or 0,
        ),
        reverse=True,
    )[:8]

    top_opportunities = []
    for o in top_opps_raw:
        ev   = o.estimated_value or o.estimated_contract_value or 0
        tier = o.score_tier or "monitor"
        top_opportunities.append({
            "id":            o.id,
            "employer_name": o.employer_name or o.title or "Unnamed",
            "industry":      o.industry,
            "state":         o.employer_state or o.geographic_footprint,
            "stage":         o.stage,
            "score":         round(o.opportunity_score or o.score or 0),
            "score_tier":    tier,
            "win_probability": round(TIER_WIN_PROB.get(tier, 0.22) * 100),
            "estimated_value": ev,
            "estimated_value_fmt": _fmt_short(ev) if ev else "—",
            "forecasted_value": round(ev * TIER_WIN_PROB.get(tier, 0.22)),
            "response_deadline": o.response_deadline or o.due_date,
            "owner":         o.owner,
            "priority":      o.priority or "medium",
        })

    # ── 3. Win/Loss outcomes ──────────────────────────────────────────────────
    wl_records = db.query(models.RfpWinLoss).filter(
        models.RfpWinLoss.user_id == uid
    ).order_by(models.RfpWinLoss.created_at.desc()).limit(20).all()

    # Stage pipeline distribution
    stage_distribution: dict[str, int] = {}
    for o in pipeline_opps:
        s = o.stage or "new"
        stage_distribution[s] = stage_distribution.get(s, 0) + 1

    # ── 4. Re-engagement queue ────────────────────────────────────────────────
    # Monitoring subscriptions that are active — these are lost accounts enrolled
    # for re-engagement when a new filing or renewal window is detected.
    mon_subs = db.query(models.RfpMonitoringSubscription).filter(
        models.RfpMonitoringSubscription.user_id == uid,
        models.RfpMonitoringSubscription.active == True,
    ).all()

    # RfpMonitoringAlerts — unread firing events
    mon_alerts = db.query(models.RfpMonitoringAlert).filter(
        models.RfpMonitoringAlert.user_id == uid,
        models.RfpMonitoringAlert.read == False,
    ).order_by(models.RfpMonitoringAlert.created_at.desc()).limit(10).all()

    re_engagement = []
    for sub in mon_subs[:8]:
        # Find matching unread alerts
        alerts_for_sub = [a for a in mon_alerts if a.subscription_id == sub.id]
        re_engagement.append({
            "id":             sub.id,
            "account_id":     sub.account_id,
            "employer_name":  sub.employer_name,
            "ein":            sub.ein,
            "monitor_type":   sub.monitor_type,
            "alert_count":    len(alerts_for_sub),
            "latest_alert":   alerts_for_sub[0].summary if alerts_for_sub else None,
            "created_at":     sub.created_at.isoformat() if sub.created_at else None,
        })

    # ── 5. Form 5500 / watchlist alerts ───────────────────────────────────────
    # RfpAlert (filing-based watchlist alerts) — "queued" = not yet sent/dismissed
    watchlist_alerts_raw = db.query(models.RfpAlert).filter(
        models.RfpAlert.user_id == uid,
        models.RfpAlert.status == "queued",
    ).order_by(models.RfpAlert.created_at.desc()).limit(10).all()

    form5500_alerts = []
    for a in watchlist_alerts_raw:
        h = _safe_json(a.highlights) or {}
        form5500_alerts.append({
            "id":            a.id,
            "ein":           a.ein,
            "employer_name": a.employer_name,
            "filing_year":   a.filing_year,
            "alert_type":    a.alert_type,
            "summary":       h.get("summary") or a.alert_type.replace("_", " ").title(),
            "created_at":    a.created_at.isoformat() if a.created_at else None,
        })

    # Combine monitoring + watchlist unread count
    total_unread_alerts = len(mon_alerts) + len(watchlist_alerts_raw)

    # ── 6. Consultant influence rankings ─────────────────────────────────────
    # RfpContact records with role = 'consultant' | 'broker'
    contacts = db.query(models.RfpContact).filter(
        models.RfpContact.user_id == uid,
        models.RfpContact.role.in_(["consultant", "broker"]),
    ).all()

    # Count how many opportunities link to each contact's account
    account_opp_count: dict[str, int] = {}
    for o in opps:
        if o.account_id:
            account_opp_count[o.account_id] = account_opp_count.get(o.account_id, 0) + 1

    consultant_map: dict[str, dict] = {}
    for c in contacts:
        key = f"{c.first_name or ''} {c.last_name or ''}".strip() or c.email or c.id
        firm = c.firm or "Independent"
        if key not in consultant_map:
            consultant_map[key] = {
                "name": key,
                "title": c.title,
                "firm": firm,
                "role": c.role,
                "opp_count": 0,
                "account_ids": [],
            }
        consultant_map[key]["opp_count"] += account_opp_count.get(c.account_id or "", 0)
        if c.account_id:
            consultant_map[key]["account_ids"].append(c.account_id)

    consultant_rankings = sorted(
        consultant_map.values(),
        key=lambda x: x["opp_count"],
        reverse=True,
    )[:8]

    # ── 7. Deadlines / urgency queue ──────────────────────────────────────────
    deadlines = []
    for o in pipeline_opps:
        dl = o.response_deadline or o.due_date
        if not dl:
            continue
        try:
            dl_dt = datetime.fromisoformat(dl)
            days_left = (dl_dt - now).days
            if days_left <= 21:
                deadlines.append({
                    "id":            o.id,
                    "employer_name": o.employer_name or o.title or "Unnamed",
                    "deadline":      dl,
                    "days_left":     days_left,
                    "stage":         o.stage,
                    "owner":         o.owner,
                    "priority":      o.priority or "medium",
                })
        except Exception:
            pass
    deadlines.sort(key=lambda x: x["days_left"])

    # ── 8. Recent activity (last 30d) ─────────────────────────────────────────
    cutoff = now - timedelta(days=30)
    recent_won  = [o for o in won_opps  if o.updated_at and o.updated_at >= cutoff]
    recent_lost = [o for o in lost_opps if o.updated_at and o.updated_at >= cutoff]
    new_this_month = [o for o in opps if o.created_at and o.created_at >= cutoff]

    # ── 9. Transparent forecast method ───────────────────────────────────────
    # Surfaces the exact formula so leadership can challenge the number.
    forecast_method = {
        "formula":      "Σ( opportunity_estimated_value × tier_win_probability )",
        "tier_probs":   TIER_WIN_PROB,
        "basis":        "MODELED — tier win-probabilities drawn from SCORE_WEIGHTS win_probability factor; not actuarial data.",
        "confidence":   "MODELED",
        "tier_breakdown": {
            tier: {
                "count": sum(1 for o in pipeline_opps if (o.score_tier or "monitor") == tier),
                "value": round(sum(
                    (o.estimated_value or o.estimated_contract_value or 0)
                    for o in pipeline_opps if (o.score_tier or "monitor") == tier
                )),
                "forecasted": round(forecast_by_tier.get(tier, 0.0)),
                "win_prob_pct": round(TIER_WIN_PROB.get(tier, 0.22) * 100),
            }
            for tier in TIER_WIN_PROB
        },
    }

    # ── 10. KPI summary tiles ─────────────────────────────────────────────────
    return {
        "kpis": {
            "total_rfps":           total_rfps,
            "pipeline_count":       total_pipeline,
            "pipeline_value":       round(pipeline_value),
            "pipeline_value_fmt":   _fmt_short(pipeline_value),
            "forecasted_revenue":   round(forecasted_revenue),
            "forecasted_revenue_fmt": _fmt_short(forecasted_revenue),
            "avg_win_probability":  round(avg_win_prob, 1),
            "win_rate":             win_rate,
            "loss_rate":            loss_rate,
            "total_won":            total_won,
            "total_lost":           total_lost,
            "total_closed":         total_closed,
            "unread_alerts":        total_unread_alerts,
            "re_engagement_count":  len(mon_subs),
            "deadlines_urgent":     len([d for d in deadlines if d["days_left"] <= 7]),
            "new_this_month":       len(new_this_month),
            "recent_won":           len(recent_won),
            "recent_lost":          len(recent_lost),
        },
        "stage_distribution": stage_distribution,
        "top_opportunities":  top_opportunities,
        "re_engagement":      re_engagement,
        "form5500_alerts":    form5500_alerts,
        "deadlines":          deadlines[:6],
        "consultant_rankings": consultant_rankings,
        "forecast_method":    forecast_method,
        "win_loss_recent": [
            {
                "id":             r.id,
                "opportunity_id": r.opportunity_id,
                "outcome":        r.outcome,
                "contract_value": r.contract_value,
                "winning_competitor": r.winning_competitor,
                "decision_date":  r.decision_date,
                "created_at":     r.created_at.isoformat() if r.created_at else None,
            }
            for r in wl_records[:10]
        ],
        "generated_at": now.isoformat(),
    }
