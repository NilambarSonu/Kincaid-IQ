"""
Rebel IQ Intelligence API (v1) — Async job polling (§11).

    GET /v1/jobs/:jobId
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.routers.rebel_api_auth import authenticate
from backend.routers.rebel_common import (
    ProblemDetail, success, iso, ERR_NOT_FOUND, ERR_FORBIDDEN,
)

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, request: Request,
                  tenant=Depends(authenticate), db: Session = Depends(get_db)):
    job = db.query(models.KiqJob).filter(models.KiqJob.job_id == job_id).first()
    if job is None:
        raise ProblemDetail(404, ERR_NOT_FOUND, f"Job '{job_id}' not found.")
    plan = db.query(models.KincaidPlan).filter(
        models.KincaidPlan.kincaid_plan_id == job.plan_id
    ).first()
    if plan is None or plan.tenant_id != tenant.id:
        raise ProblemDetail(403, ERR_FORBIDDEN, "Your API key is not authorized for this job.")

    pct = 0
    if job.records_total:
        pct = round(job.records_processed / job.records_total * 100)

    payload = {
        "jobId": job.job_id,
        "type": job.type,
        "status": job.status,
        "progress": {
            "recordsTotal": job.records_total,
            "recordsProcessed": job.records_processed,
            "percentComplete": 100 if job.status == "complete" else pct,
        },
        "submittedAt": iso(job.submitted_at),
        "estimatedCompletionAt": iso(job.completed_at) if job.completed_at else None,
    }
    if job.status == "complete":
        payload["result"] = {
            "recordsProcessed": job.records_processed,
            "recordsRejected": job.records_rejected,
            "rejectionReasons": job.rejection_reasons or [],
        }
        payload["completedAt"] = iso(job.completed_at)
    elif job.status == "failed":
        payload["error"] = job.error or {
            "type": "https://api.kincaidiq.com/errors/ingestion-failed",
            "title": "Ingestion Processing Failed",
            "detail": "The ingestion job failed during processing.",
            "retryable": True,
        }
        payload["completedAt"] = iso(job.completed_at)
    return success(request, payload)
