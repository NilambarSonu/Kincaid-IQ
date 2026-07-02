"""Seed all compliance frameworks in a single call."""
import logging
from sqlalchemy.orm import Session

from compliance_engine.frameworks import FRAMEWORK_REGISTRY
from compliance_engine.models.controls import ComplianceControl, ControlCategory

logger = logging.getLogger("kincaid.compliance.seed")


def seed_all_frameworks(db: Session) -> dict:
    """Idempotently seed every registered framework into the database."""
    results = {}
    for framework, fw in FRAMEWORK_REGISTRY.items():
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
                description=ctrl.get("description"),
                test_procedure=ctrl.get("test_procedure"),
                risk_level=ctrl.get("risk_level", "medium"),
                evidence_required=ctrl.get("evidence_required"),
                automated=ctrl.get("automated", False),
                status="not_tested",
            )
            db.add(new_ctrl)
            seeded += 1

        results[framework] = seeded

    db.commit()
    total = sum(results.values())
    logger.info("seed_all_frameworks: seeded %d controls across %d frameworks", total, len(results))
    return {"seeded_by_framework": results, "total": total}
