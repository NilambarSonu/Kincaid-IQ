import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend import models as base_models
from backend.auth import get_current_user
from compliance_engine.models.controls import ComplianceControl, ControlCategory
from compliance_engine.schemas.audit_schema import ControlCreate, ControlUpdate, ControlOut
from compliance_engine.frameworks import FRAMEWORK_REGISTRY, list_frameworks

logger = logging.getLogger("kincaid.compliance.controls")
router = APIRouter(prefix="/api/compliance/controls", tags=["compliance"])

VALID_STATUSES = {"not_tested", "pass", "fail", "compensating", "na"}


@router.get("/frameworks")
def get_frameworks():
    return {"frameworks": list_frameworks()}


@router.post("/seed-all")
def seed_all(
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    """Seed every registered framework in one shot."""
    from compliance_engine.frameworks.seed import seed_all_frameworks
    return seed_all_frameworks(db)


@router.post("/seed/{framework}")
def seed_framework(
    framework: str,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    """Seed all controls for a given framework if they don't already exist."""
    fw = FRAMEWORK_REGISTRY.get(framework)
    if not fw:
        raise HTTPException(status_code=404, detail=f"Unknown framework: {framework}")

    seeded = 0
    for ctrl in fw["controls"]:
        existing = db.query(ComplianceControl).filter(
            ComplianceControl.framework == framework,
            ComplianceControl.control_id == ctrl["control_id"],
        ).first()
        if existing:
            continue

        cat = db.query(ControlCategory).filter(
            ControlCategory.framework == framework,
            ControlCategory.code == ctrl["category"],
        ).first()
        if not cat:
            cat = ControlCategory(
                framework=framework,
                name=ctrl["category_name"],
                code=ctrl["category"],
            )
            db.add(cat)
            db.flush()

        new_ctrl = ComplianceControl(
            framework=framework,
            category_id=cat.id,
            control_id=ctrl["control_id"],
            title=ctrl["title"],
            description=ctrl["description"],
            test_procedure=ctrl["test_procedure"],
            risk_level=ctrl.get("risk_level", "medium"),
            status="not_tested",
        )
        db.add(new_ctrl)
        seeded += 1

    db.commit()
    return {"framework": framework, "seeded": seeded, "message": f"Seeded {seeded} controls"}


@router.get("", response_model=List[ControlOut])
def list_controls(
    framework: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    q = db.query(ComplianceControl)
    if framework:
        q = q.filter(ComplianceControl.framework == framework)
    if status:
        q = q.filter(ComplianceControl.status == status)
    if risk_level:
        q = q.filter(ComplianceControl.risk_level == risk_level)
    return q.offset(skip).limit(limit).all()


@router.get("/stats")
def control_stats(
    framework: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    q = db.query(ComplianceControl)
    if framework:
        q = q.filter(ComplianceControl.framework == framework)
    controls = q.all()
    total = len(controls)
    by_status = {}
    by_risk = {}
    for c in controls:
        by_status[c.status] = by_status.get(c.status, 0) + 1
        by_risk[c.risk_level] = by_risk.get(c.risk_level, 0) + 1
    passed = by_status.get("pass", 0)
    tested = total - by_status.get("not_tested", 0) - by_status.get("na", 0)
    score = round((passed / tested) * 100, 1) if tested > 0 else 0.0
    return {
        "total": total,
        "by_status": by_status,
        "by_risk": by_risk,
        "score_pct": score,
        "tested": tested,
    }


@router.get("/{control_id}", response_model=ControlOut)
def get_control(
    control_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    ctrl = db.query(ComplianceControl).filter(ComplianceControl.id == control_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Control not found")
    return ctrl


@router.patch("/{control_id}", response_model=ControlOut)
def update_control(
    control_id: int,
    body: ControlUpdate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    ctrl = db.query(ComplianceControl).filter(ComplianceControl.id == control_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Control not found")
    if body.status and body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(ctrl, field, val)
    if body.status in {"pass", "fail", "compensating"}:
        from datetime import datetime
        ctrl.last_tested_at = datetime.utcnow()
    db.commit()
    db.refresh(ctrl)
    return ctrl
