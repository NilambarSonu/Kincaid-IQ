"""
Rebel IQ Intelligence API (v1) — Intelligence endpoints (§10).

All synchronous GETs served from the precomputed KiqAnalyticsCache. The
X-Kincaid-Data-As-Of response header reflects when the data was last computed.
Returns 422 plan-not-ready when no intelligence has been computed yet.

    GET /v1/plans/:id/insights
    GET /v1/plans/:id/insights/alerts
    GET /v1/plans/:id/compliance/status
    GET /v1/plans/:id/compliance/calendar
    GET /v1/plans/:id/costs/benchmarks
    GET /v1/plans/:id/costs/trends
    GET /v1/plans/:id/fwa/detections
    GET /v1/plans/:id/fwa/summary
    GET /v1/plans/:id/members/risk
    GET /v1/plans/:id/forecast
    GET /v1/plans/:id/stop-loss/alerts
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.routers.rebel_api_auth import authenticate
from backend.routers.rebel_plans import get_owned_plan
from backend.routers.rebel_common import (
    ProblemDetail, success, iso, ERR_PLAN_NOT_READY, ERR_VALIDATION,
)

router = APIRouter()


def _load_cache(plan_id: str, tenant, db: Session):
    plan = get_owned_plan(plan_id, tenant, db)
    cache = db.query(models.KiqAnalyticsCache).filter(
        models.KiqAnalyticsCache.plan_id == plan_id
    ).first()
    if cache is None or not cache.data:
        raise ProblemDetail(
            422, ERR_PLAN_NOT_READY,
            "Plan is registered but no intelligence has been computed yet. "
            "Ingest claims and member data, then poll the ingestion job until complete.",
        )
    return plan, cache


def _paginate(items: list, page: int, page_size: int):
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    start = (page - 1) * page_size
    end = start + page_size
    return items[start:end], len(items), page, page_size, end < len(items)


# ── 10.1 Insights ─────────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/insights")
async def insights(plan_id: str, request: Request,
                   tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    ins = cache.data["insights"]
    return success(request, {
        "kincaidPlanId": plan_id,
        "overallStatus": ins["overallStatus"],
        "domains": ins["domains"],
        "openAlertCount": ins["openAlertCount"],
        "criticalAlertCount": ins["criticalAlertCount"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


@router.get("/plans/{plan_id}/insights/alerts")
async def insights_alerts(plan_id: str, request: Request,
                          severity: Optional[str] = Query(None),
                          domain: Optional[str] = Query(None),
                          page: int = Query(1), pageSize: int = Query(25),
                          tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    q = db.query(models.KiqAlert).filter(models.KiqAlert.plan_id == plan_id)
    if severity:
        q = q.filter(models.KiqAlert.severity == severity)
    if domain:
        q = q.filter(models.KiqAlert.domain == domain)
    alerts = q.all()
    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    alerts.sort(key=lambda a: (sev_rank.get(a.severity, 9), a.created_at or 0))
    page_items, total, page, page_size, has_more = _paginate(alerts, page, pageSize)
    return success(request, {
        "alerts": [{
            "alertId": a.alert_id,
            "domain": a.domain,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "actionRequired": a.action_required,
            "dueDate": a.due_date,
            "estimatedImpact": a.estimated_impact,
            "memberId": a.member_id,
            "createdAt": iso(a.created_at),
        } for a in page_items],
        "total": total, "page": page, "pageSize": page_size, "hasMore": has_more,
    }, data_as_of=cache.data_as_of)


# ── 10.2 Compliance ───────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/compliance/status")
async def compliance_status(plan_id: str, request: Request,
                            tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    comp = cache.data["compliance"]
    return success(request, {
        "kincaidPlanId": plan_id,
        "overallStatus": comp["overallStatus"],
        "erisa": comp["erisa"],
        "dol": comp["dol"],
        "planDocumentStatus": comp["planDocumentStatus"],
        "planDocumentNotes": comp["planDocumentNotes"],
        "lastAuditedAt": comp["lastAuditedAt"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


@router.get("/plans/{plan_id}/compliance/calendar")
async def compliance_calendar(plan_id: str, request: Request,
                              tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    cal = cache.data["compliance"]["calendar"]
    return success(request, {
        "items": cal["items"],
        "total": cal["total"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


# ── 10.3 Costs ────────────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/costs/benchmarks")
async def costs_benchmarks(plan_id: str, request: Request,
                           tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    costs = cache.data["costs"]
    return success(request, {
        "planYear": costs["planYear"],
        "benchmarkCohort": costs["benchmarkCohort"],
        "benchmarks": costs["benchmarks"],
        "totalPmpm": costs["totalPmpm"],
        "benchmarkTotalPmpm": costs["benchmarkTotalPmpm"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


@router.get("/plans/{plan_id}/costs/trends")
async def costs_trends(plan_id: str, request: Request,
                       months: int = Query(12),
                       tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    months = max(1, min(36, months))
    trends = cache.data["trends"]
    points = trends["dataPoints"][-months:]
    return success(request, {
        "dataPoints": points,
        "trendDirection": trends["trendDirection"],
        "annualizedTrendPct": trends["annualizedTrendPct"],
        "insight": trends["insight"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


# ── 10.4 FWA ──────────────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/fwa/detections")
async def fwa_detections(plan_id: str, request: Request,
                         status: Optional[str] = Query(None),
                         severity: Optional[str] = Query(None),
                         page: int = Query(1), pageSize: int = Query(25),
                         tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    detections = cache.data["fwa"]["detections"]
    if status:
        detections = [d for d in detections if d["status"] == status]
    if severity:
        detections = [d for d in detections if d["severity"] == severity]
    page_items, total, page, page_size, has_more = _paginate(detections, page, pageSize)
    return success(request, {
        "detections": page_items,
        "total": total, "page": page, "pageSize": page_size, "hasMore": has_more,
    }, data_as_of=cache.data_as_of)


@router.get("/plans/{plan_id}/fwa/summary")
async def fwa_summary(plan_id: str, request: Request,
                      tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    s = cache.data["fwa"]["summary"]
    return success(request, {
        "kincaidPlanId": plan_id,
        "planYear": plan.plan_year,
        "openDetections": s["openDetections"],
        "criticalDetections": s["criticalDetections"],
        "totalEstimatedSavings": s["totalEstimatedSavings"],
        "recoveredToDate": s["recoveredToDate"],
        "topCategories": s["topCategories"],
        "savingsByType": s["savingsByType"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


# ── 10.5 Member risk ──────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/members/risk")
async def members_risk(plan_id: str, request: Request,
                       riskTier: Optional[str] = Query(None),
                       page: int = Query(1), pageSize: int = Query(25),
                       tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    mdata = cache.data["members"]
    members = mdata["members"]
    if riskTier:
        members = [m for m in members if m["riskTier"] == riskTier]
    page_items, total, page, page_size, has_more = _paginate(members, page, pageSize)
    return success(request, {
        "members": page_items,
        "total": total, "page": page, "pageSize": page_size, "hasMore": has_more,
        "riskDistribution": mdata["riskDistribution"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)


# ── 10.6 Forecast ─────────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/forecast")
async def forecast(plan_id: str, request: Request,
                   tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    f = dict(cache.data["forecast"])
    f["kincaidPlanId"] = plan_id
    f["dataAsOf"] = iso(cache.data_as_of)
    return success(request, f, data_as_of=cache.data_as_of)


# ── 10.7 Stop-loss ────────────────────────────────────────────────────────────
@router.get("/plans/{plan_id}/stop-loss/alerts")
async def stop_loss_alerts(plan_id: str, request: Request,
                           tenant=Depends(authenticate), db: Session = Depends(get_db)):
    plan, cache = _load_cache(plan_id, tenant, db)
    sl = cache.data["stopLoss"]
    return success(request, {
        "alerts": sl["alerts"],
        "total": len(sl["alerts"]),
        "specificAlertCount": sl["specificAlertCount"],
        "aggregateAlertCount": sl["aggregateAlertCount"],
        "totalEstimatedExposure": sl["totalEstimatedExposure"],
        "dataAsOf": iso(cache.data_as_of),
    }, data_as_of=cache.data_as_of)
