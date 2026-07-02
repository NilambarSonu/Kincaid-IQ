"""
Rebel IQ Intelligence API (v1) — Data ingestion (§9).

    POST /v1/plans/:kincaidPlanId/ingestion/claims
    POST /v1/plans/:kincaidPlanId/ingestion/members
    POST /v1/plans/:kincaidPlanId/ingestion/rx
    GET  /v1/plans/:kincaidPlanId/ingestion/history

Each batch is idempotent via a caller-provided globally-unique batchId. Ingestion
is accepted synchronously (202) and processed asynchronously by a background job —
poll GET /v1/jobs/:jobId.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.routers.rebel_api_auth import authenticate
from backend.routers.rebel_plans import get_owned_plan
from backend.routers.rebel_common import (
    ProblemDetail, success, iso, ERR_CONFLICT, ERR_VALIDATION,
)
from backend.services.rebel_analytics import process_ingestion_job

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────
class ClaimIn(BaseModel):
    claimId: str
    memberId: str
    providerId: Optional[str] = None
    providerType: Optional[str] = None
    serviceDate: Optional[str] = None
    paidDate: Optional[str] = None
    diagnosisCodes: list[str] = []
    procedureCodes: list[str] = []
    billedAmount: float = 0.0
    allowedAmount: float = 0.0
    paidAmount: float = 0.0
    planPaidAmount: float = 0.0
    memberCostShare: float = 0.0
    claimType: Optional[str] = None
    placeOfService: Optional[str] = None
    isHighCost: bool = False


class ClaimsBatch(BaseModel):
    batchId: str
    periodStart: Optional[str] = None
    periodEnd: Optional[str] = None
    claims: list[ClaimIn]


class MemberIn(BaseModel):
    memberId: str
    relationshipType: Optional[str] = None
    ageRange: Optional[str] = None
    gender: Optional[str] = None
    region: Optional[str] = None
    coverageTier: Optional[str] = None
    isActive: bool = True


class MembersBatch(BaseModel):
    batchId: str
    snapshotDate: Optional[str] = None
    members: list[MemberIn]


class RxIn(BaseModel):
    claimId: str
    memberId: str
    dispensedDate: Optional[str] = None
    ndc: Optional[str] = None
    drugName: Optional[str] = None
    drugCategory: Optional[str] = None
    isSpecialty: bool = False
    isBrand: bool = False
    daysSupply: Optional[int] = None
    billedAmount: float = 0.0
    planPaidAmount: float = 0.0
    memberCostShare: float = 0.0


class RxBatch(BaseModel):
    batchId: str
    periodStart: Optional[str] = None
    periodEnd: Optional[str] = None
    rxClaims: list[RxIn]


# ── Helpers ───────────────────────────────────────────────────────────────────
def _check_batch_unique(batch_id: str, db: Session):
    existing = db.query(models.IngestionBatch).filter(
        models.IngestionBatch.batch_id == batch_id
    ).first()
    if existing:
        raise ProblemDetail(
            409, ERR_CONFLICT,
            f"Ingestion batch '{batch_id}' has already been submitted (idempotency conflict).",
            extra={"jobId": existing.job_id, "existingStatus": existing.status},
        )


def _create_job_and_batch(plan_id: str, batch_id: str, batch_type: str,
                          record_count: int, db: Session, *,
                          period_start=None, period_end=None, snapshot_date=None):
    job_id = "kiq-job-" + uuid.uuid4().hex
    job = models.KiqJob(
        job_id=job_id, plan_id=plan_id, batch_id=batch_id,
        type=f"{batch_type}-ingestion", status="queued",
        records_total=record_count,
    )
    batch = models.IngestionBatch(
        batch_id=batch_id, plan_id=plan_id, job_id=job_id, type=batch_type,
        status="queued", records_received=record_count,
        period_start=period_start, period_end=period_end, snapshot_date=snapshot_date,
    )
    db.add(job)
    db.add(batch)
    plan = db.query(models.KincaidPlan).filter(
        models.KincaidPlan.kincaid_plan_id == plan_id
    ).first()
    if plan and plan.status == "registered":
        plan.status = "ingesting"
    return job_id


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/plans/{plan_id}/ingestion/claims")
async def ingest_claims(
    plan_id: str, body: ClaimsBatch, request: Request,
    background: BackgroundTasks,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    plan = get_owned_plan(plan_id, tenant, db)
    if not body.claims:
        raise ProblemDetail(400, ERR_VALIDATION, "claims array must not be empty.")
    _check_batch_unique(body.batchId, db)
    for c in body.claims:
        db.add(models.IngestedClaim(
            plan_id=plan_id, batch_id=body.batchId, claim_id=c.claimId,
            member_id=c.memberId, provider_id=c.providerId, provider_type=c.providerType,
            service_date=c.serviceDate, paid_date=c.paidDate,
            diagnosis_codes=c.diagnosisCodes, procedure_codes=c.procedureCodes,
            billed_amount=c.billedAmount, allowed_amount=c.allowedAmount,
            paid_amount=c.paidAmount, plan_paid_amount=c.planPaidAmount,
            member_cost_share=c.memberCostShare, claim_type=c.claimType,
            place_of_service=c.placeOfService, is_high_cost=c.isHighCost,
        ))
    job_id = _create_job_and_batch(plan_id, body.batchId, "claims", len(body.claims), db,
                                   period_start=body.periodStart, period_end=body.periodEnd)
    db.commit()
    background.add_task(process_ingestion_job, job_id)
    return success(request, {
        "batchId": body.batchId, "jobId": job_id, "status": "queued",
        "claimsReceived": len(body.claims),
    }, status_code=202)


@router.post("/plans/{plan_id}/ingestion/members")
async def ingest_members(
    plan_id: str, body: MembersBatch, request: Request,
    background: BackgroundTasks,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    plan = get_owned_plan(plan_id, tenant, db)
    if not body.members:
        raise ProblemDetail(400, ERR_VALIDATION, "members array must not be empty.")
    _check_batch_unique(body.batchId, db)
    for m in body.members:
        db.add(models.IngestedMember(
            plan_id=plan_id, batch_id=body.batchId, member_id=m.memberId,
            relationship_type=m.relationshipType, age_range=m.ageRange, gender=m.gender,
            region=m.region, coverage_tier=m.coverageTier, is_active=m.isActive,
        ))
    job_id = _create_job_and_batch(plan_id, body.batchId, "members", len(body.members), db,
                                   snapshot_date=body.snapshotDate)
    db.commit()
    background.add_task(process_ingestion_job, job_id)
    return success(request, {
        "batchId": body.batchId, "jobId": job_id, "status": "queued",
        "membersReceived": len(body.members),
    }, status_code=202)


@router.post("/plans/{plan_id}/ingestion/rx")
async def ingest_rx(
    plan_id: str, body: RxBatch, request: Request,
    background: BackgroundTasks,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    plan = get_owned_plan(plan_id, tenant, db)
    if not body.rxClaims:
        raise ProblemDetail(400, ERR_VALIDATION, "rxClaims array must not be empty.")
    _check_batch_unique(body.batchId, db)
    for r in body.rxClaims:
        db.add(models.IngestedRxClaim(
            plan_id=plan_id, batch_id=body.batchId, claim_id=r.claimId, member_id=r.memberId,
            dispensed_date=r.dispensedDate, ndc=r.ndc, drug_name=r.drugName,
            drug_category=r.drugCategory, is_specialty=r.isSpecialty, is_brand=r.isBrand,
            days_supply=r.daysSupply, billed_amount=r.billedAmount,
            plan_paid_amount=r.planPaidAmount, member_cost_share=r.memberCostShare,
        ))
    job_id = _create_job_and_batch(plan_id, body.batchId, "rx", len(body.rxClaims), db,
                                   period_start=body.periodStart, period_end=body.periodEnd)
    db.commit()
    background.add_task(process_ingestion_job, job_id)
    return success(request, {
        "batchId": body.batchId, "jobId": job_id, "status": "queued",
        "rxClaimsReceived": len(body.rxClaims),
    }, status_code=202)


@router.get("/plans/{plan_id}/ingestion/history")
async def ingestion_history(
    plan_id: str, request: Request,
    tenant: models.RebelTenant = Depends(authenticate),
    db: Session = Depends(get_db),
):
    plan = get_owned_plan(plan_id, tenant, db)
    batches = db.query(models.IngestionBatch).filter(
        models.IngestionBatch.plan_id == plan_id
    ).order_by(models.IngestionBatch.submitted_at.desc()).all()
    return success(request, {
        "batches": [{
            "batchId": b.batch_id,
            "type": b.type,
            "status": b.status,
            "claimsReceived": b.records_received,
            "claimsProcessed": b.records_processed,
            "claimsRejected": b.records_rejected,
            "rejectionReasons": b.rejection_reasons or [],
            "submittedAt": iso(b.submitted_at),
            "processedAt": iso(b.processed_at),
        } for b in batches]
    })
