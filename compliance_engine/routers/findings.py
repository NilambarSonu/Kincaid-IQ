import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend import models as base_models
from backend.auth import get_current_user
from compliance_engine.models.findings import ComplianceFinding
from compliance_engine.schemas.audit_schema import FindingCreate, FindingUpdate, FindingOut

logger = logging.getLogger("kincaid.compliance.findings")
router = APIRouter(prefix="/api/compliance/findings", tags=["compliance"])


@router.get("", response_model=List[FindingOut])
def list_findings(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    audit_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    q = db.query(ComplianceFinding)
    if status:
        q = q.filter(ComplianceFinding.status == status)
    if severity:
        q = q.filter(ComplianceFinding.severity == severity)
    if audit_id:
        q = q.filter(ComplianceFinding.audit_id == audit_id)
    return q.order_by(ComplianceFinding.created_at.desc()).limit(200).all()


@router.post("", response_model=FindingOut)
def create_finding(
    body: FindingCreate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    finding = ComplianceFinding(**body.model_dump())
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return finding


@router.patch("/{finding_id}", response_model=FindingOut)
def update_finding(
    finding_id: int,
    body: FindingUpdate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    finding = db.query(ComplianceFinding).filter(ComplianceFinding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(finding, field, val)
    if body.status == "closed":
        finding.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(finding)
    return finding


@router.get("/stats")
def finding_stats(
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    findings = db.query(ComplianceFinding).all()
    by_severity = {}
    by_status = {}
    for f in findings:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        by_status[f.status] = by_status.get(f.status, 0) + 1
    return {
        "total": len(findings),
        "by_severity": by_severity,
        "by_status": by_status,
        "open": by_status.get("open", 0),
        "critical_open": sum(1 for f in findings if f.severity == "high" and f.status == "open"),
    }
