"""
Rebel IQ Intelligence API (v1) — Plan registration & status (§8).

    POST   /v1/plans
    PATCH  /v1/plans/:kincaidPlanId
    GET    /v1/plans/:kincaidPlanId
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.routers.rebel_api_auth import authenticate
from backend.routers.rebel_common import (
    ProblemDetail, success, iso, now_utc,
    ERR_NOT_FOUND, ERR_FORBIDDEN, ERR_VALIDATION,
)

router = APIRouter()

STALE_HOURS = 48


# ── Schemas ───────────────────────────────────────────────────────────────────
class StopLossIn(BaseModel):
    carrier: Optional[str] = None
    specificDeductible: Optional[float] = None
    aggregateAttachmentPoint: Optional[float] = None
    aggregateFactor: Optional[float] = None


class PlanCreate(BaseModel):
    rebelPlanId: str
    name: str
    planYear: int
    memberCount: int
    state: Optional[str] = None
    industryCode: Optional[str] = None
    tpaName: Optional[str] = None
    pbmName: Optional[str] = None
    stopLoss: Optional[StopLossIn] = None
    planFeatures: Optional[dict] = None


class PlanUpdate(BaseModel):
    rebelPlanId: Optional[str] = None
    name: Optional[str] = None
    planYear: Optional[int] = None
    memberCount: Optional[int] = None
    state: Optional[str] = None
    industryCode: Optional[str] = None
    tpaName: Optional[str] = None
    pbmName: Optional[str] = None
    stopLoss: Optional[StopLossIn] = None
    planFeatures: Optional[dict] = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_owned_plan(plan_id: str, tenant: models.RebelTenant, db: Session) -> models.KincaidPlan:
    plan = db.query(models.KincaidPlan).filter(
        models.KincaidPlan.kincaid_plan_id == plan_id
    ).first()
    if plan is None:
        raise ProblemDetail(404, ERR_NOT_FOUND, f"Plan '{plan_id}' not found.")
    if plan.tenant_id != tenant.id:
        raise ProblemDetail(403, ERR_FORBIDDEN, "Your API key is not authorized for this plan.")
    return plan


def derive_status(plan: models.KincaidPlan, db: Session) -> str:
    """registered (no data) | ingesting | active | stale (>48h since last ingest)."""
    if plan.status == "registered":
        # Check whether any data has arrived since registration.
        has_data = db.query(models.IngestionBatch).filter(
            models.IngestionBatch.plan_id == plan.kincaid_plan_id
        ).first()
        return "registered" if not has_data else plan.status
    last = db.query(models.IngestionBatch).filter(
        models.IngestionBatch.plan_id == plan.kincaid_plan_id,
        models.IngestionBatch.status.in_(["processed", "partial"]),
    ).order_by(models.IngestionBatch.processed_at.desc()).first()
    if last is None:
        # Data submitted but not processed yet.
        any_batch = db.query(models.IngestionBatch).filter(
            models.IngestionBatch.plan_id == plan.kincaid_plan_id
        ).first()
        return "ingesting" if any_batch else "registered"
    if last.processed_at:
        age_hours = (now_utc() - last.processed_at.replace(tzinfo=now_utc().tzinfo)).total_seconds() / 3600
        if age_hours > STALE_HOURS:
            return "stale"
    return "active"


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/plans")
async def register_plan(
    body: PlanCreate,
    request: Request,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    if body.memberCount < 0:
        raise ProblemDetail(400, ERR_VALIDATION, "memberCount must be non-negative.")
    plan_id = "kiq_" + uuid.uuid4().hex
    sl = body.stopLoss or StopLossIn()
    plan = models.KincaidPlan(
        kincaid_plan_id=plan_id,
        tenant_id=tenant.id,
        rebel_plan_id=body.rebelPlanId,
        name=body.name,
        plan_year=body.planYear,
        member_count=body.memberCount,
        state=body.state,
        industry_code=body.industryCode,
        tpa_name=body.tpaName,
        pbm_name=body.pbmName,
        stop_loss_carrier=sl.carrier,
        specific_deductible=sl.specificDeductible,
        aggregate_attachment_point=sl.aggregateAttachmentPoint,
        aggregate_factor=sl.aggregateFactor,
        plan_features=body.planFeatures or {},
        status="registered",
    )
    db.add(plan)
    db.commit()
    return success(request, {
        "kincaidPlanId": plan_id,
        "rebelPlanId": body.rebelPlanId,
        "status": "registered",
        "message": "Plan registered. Ingest claims and member data before querying intelligence.",
    }, status_code=201)


@router.patch("/plans/{plan_id}")
async def update_plan(
    plan_id: str,
    body: PlanUpdate,
    request: Request,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    plan = get_owned_plan(plan_id, tenant, db)
    data = body.model_dump(exclude_unset=True)
    field_map = {
        "rebelPlanId": "rebel_plan_id", "name": "name", "planYear": "plan_year",
        "memberCount": "member_count", "state": "state", "industryCode": "industry_code",
        "tpaName": "tpa_name", "pbmName": "pbm_name", "planFeatures": "plan_features",
    }
    for k, col in field_map.items():
        if k in data and data[k] is not None:
            setattr(plan, col, data[k])
    if "stopLoss" in data and data["stopLoss"] is not None:
        sl = data["stopLoss"]
        if sl.get("carrier") is not None: plan.stop_loss_carrier = sl["carrier"]
        if sl.get("specificDeductible") is not None: plan.specific_deductible = sl["specificDeductible"]
        if sl.get("aggregateAttachmentPoint") is not None: plan.aggregate_attachment_point = sl["aggregateAttachmentPoint"]
        if sl.get("aggregateFactor") is not None: plan.aggregate_factor = sl["aggregateFactor"]
    db.commit()
    db.refresh(plan)
    return success(request, _plan_object(plan, db))


@router.get("/plans/{plan_id}")
async def get_plan(
    plan_id: str,
    request: Request,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    plan = get_owned_plan(plan_id, tenant, db)
    status = derive_status(plan, db)

    # Data readiness summary
    def _readiness(batch_type: str):
        batches = db.query(models.IngestionBatch).filter(
            models.IngestionBatch.plan_id == plan.kincaid_plan_id,
            models.IngestionBatch.type == batch_type,
            models.IngestionBatch.status.in_(["processed", "partial"]),
        ).all()
        if not batches:
            return None
        last = max(batches, key=lambda b: b.processed_at or b.submitted_at)
        total = sum(b.records_processed for b in batches)
        info = {
            "lastIngestedAt": iso(last.processed_at or last.submitted_at),
            "recordsProcessed": total,
        }
        froms = [b.period_start for b in batches if b.period_start]
        tos = [b.period_end for b in batches if b.period_end]
        if froms and tos:
            info["coveragePeriod"] = {"from": min(froms), "to": max(tos)}
        return info

    cache = db.query(models.KiqAnalyticsCache).filter(
        models.KiqAnalyticsCache.plan_id == plan.kincaid_plan_id
    ).first()

    readiness = {
        "claims": _readiness("claims"),
        "members": _readiness("members"),
        "rx": _readiness("rx"),
        "intelligenceReady": bool(cache) and status == "active",
    }
    return success(request, {
        "kincaidPlanId": plan.kincaid_plan_id,
        "rebelPlanId": plan.rebel_plan_id,
        "status": status,
        "dataReadiness": readiness,
    })


def _plan_object(plan: models.KincaidPlan, db: Session) -> dict:
    return {
        "kincaidPlanId": plan.kincaid_plan_id,
        "rebelPlanId": plan.rebel_plan_id,
        "name": plan.name,
        "planYear": plan.plan_year,
        "memberCount": plan.member_count,
        "state": plan.state,
        "industryCode": plan.industry_code,
        "tpaName": plan.tpa_name,
        "pbmName": plan.pbm_name,
        "stopLoss": {
            "carrier": plan.stop_loss_carrier,
            "specificDeductible": plan.specific_deductible,
            "aggregateAttachmentPoint": plan.aggregate_attachment_point,
            "aggregateFactor": plan.aggregate_factor,
        },
        "planFeatures": plan.plan_features or {},
        "status": derive_status(plan, db),
    }
