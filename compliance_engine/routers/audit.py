import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend import models as base_models
from backend.auth import get_current_user
from compliance_engine.models.audit import ComplianceAudit, AuditControlResult
from compliance_engine.models.controls import ComplianceControl
from compliance_engine.models.findings import ComplianceFinding
from compliance_engine.schemas.audit_schema import (
    AuditCreate, AuditOut, AuditControlResultUpdate, FindingOut
)

logger = logging.getLogger("kincaid.compliance.audit")
router = APIRouter(prefix="/api/compliance/audits", tags=["compliance"])


@router.post("", response_model=AuditOut)
def create_audit(
    body: AuditCreate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    controls = db.query(ComplianceControl).filter(
        ComplianceControl.framework == body.framework
    ).all()
    if not controls:
        raise HTTPException(
            status_code=400,
            detail=f"No controls found for framework '{body.framework}'. Run /api/compliance/controls/seed/{body.framework} first."
        )

    audit = ComplianceAudit(
        name=body.name,
        framework=body.framework,
        scope=body.scope,
        auditor=body.auditor or user.email,
        total_controls=len(controls),
        not_tested=len(controls),
    )
    db.add(audit)
    db.flush()

    for ctrl in controls:
        result = AuditControlResult(
            audit_id=audit.id,
            control_id=ctrl.id,
            result="not_tested",
        )
        db.add(result)

    db.commit()
    db.refresh(audit)
    return audit


@router.get("", response_model=List[AuditOut])
def list_audits(
    framework: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    q = db.query(ComplianceAudit)
    if framework:
        q = q.filter(ComplianceAudit.framework == framework)
    return q.order_by(ComplianceAudit.created_at.desc()).limit(50).all()


@router.get("/{audit_id}", response_model=AuditOut)
def get_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    audit = db.query(ComplianceAudit).filter(ComplianceAudit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return audit


@router.get("/{audit_id}/results")
def get_audit_results(
    audit_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    audit = db.query(ComplianceAudit).filter(ComplianceAudit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    results = db.query(AuditControlResult).filter(
        AuditControlResult.audit_id == audit_id
    ).all()
    controls = {
        c.id: c for c in db.query(ComplianceControl).filter(
            ComplianceControl.framework == audit.framework
        ).all()
    }
    out = []
    for r in results:
        ctrl = controls.get(r.control_id)
        out.append({
            "result_id": r.id,
            "control_id": r.control_id,
            "control_ref": ctrl.control_id if ctrl else None,
            "control_title": ctrl.title if ctrl else None,
            "risk_level": ctrl.risk_level if ctrl else None,
            "result": r.result,
            "notes": r.notes,
            "tested_at": r.tested_at,
        })
    return {"audit": AuditOut.model_validate(audit), "results": out}


@router.patch("/{audit_id}/results/{result_id}")
def update_result(
    audit_id: int,
    result_id: int,
    body: AuditControlResultUpdate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    valid = {"pass", "fail", "compensating", "not_tested", "na"}
    if body.result not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid result. Must be one of: {valid}")

    result = db.query(AuditControlResult).filter(
        AuditControlResult.id == result_id,
        AuditControlResult.audit_id == audit_id,
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    result.result = body.result
    result.notes = body.notes
    result.tested_at = datetime.utcnow()

    audit = db.query(ComplianceAudit).filter(ComplianceAudit.id == audit_id).first()
    all_results = db.query(AuditControlResult).filter(AuditControlResult.audit_id == audit_id).all()
    passed = sum(1 for r in all_results if r.result == "pass")
    failed = sum(1 for r in all_results if r.result == "fail")
    not_tested = sum(1 for r in all_results if r.result == "not_tested")
    tested = len(all_results) - not_tested
    audit.passed = passed
    audit.failed = failed
    audit.not_tested = not_tested
    audit.score_pct = round((passed / tested) * 100, 1) if tested > 0 else 0.0

    if failed > 0:
        ctrl = db.query(ComplianceControl).filter(
            ComplianceControl.id == result.control_id
        ).first()
        if ctrl and body.result == "fail":
            existing_finding = db.query(ComplianceFinding).filter(
                ComplianceFinding.control_id == result.control_id,
                ComplianceFinding.audit_id == audit_id,
                ComplianceFinding.status == "open",
            ).first()
            if not existing_finding:
                finding = ComplianceFinding(
                    control_id=result.control_id,
                    audit_id=audit_id,
                    title=f"Control Failed: {ctrl.control_id} — {ctrl.title[:100]}",
                    description=f"Control {ctrl.control_id} failed during audit '{audit.name}'. {body.notes or ''}",
                    severity=ctrl.risk_level,
                    status="open",
                    remediation=ctrl.test_procedure,
                )
                db.add(finding)

    db.commit()
    return {"result": body.result, "audit_score_pct": audit.score_pct}


@router.post("/{audit_id}/complete")
def complete_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    audit = db.query(ComplianceAudit).filter(ComplianceAudit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    audit.status = "completed"
    audit.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(audit)
    return AuditOut.model_validate(audit)
