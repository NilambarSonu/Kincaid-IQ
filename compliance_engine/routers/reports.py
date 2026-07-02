import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend import models as base_models
from backend.auth import get_current_user
from compliance_engine.models.audit import ComplianceAudit, AuditControlResult
from compliance_engine.models.controls import ComplianceControl
from compliance_engine.models.findings import ComplianceFinding
from compliance_engine.generators.pdf_report import generate_audit_pdf
from compliance_engine.generators.excel_matrix import generate_control_matrix
from compliance_engine.generators.certification_letter import generate_certification_letter

logger = logging.getLogger("kincaid.compliance.reports")
router = APIRouter(prefix="/api/compliance/reports", tags=["compliance"])


def _build_report_data(audit_id: int, db: Session):
    audit = db.query(ComplianceAudit).filter(ComplianceAudit.id == audit_id).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    results = db.query(AuditControlResult).filter(
        AuditControlResult.audit_id == audit_id
    ).all()
    controls_map = {
        c.id: c for c in db.query(ComplianceControl).filter(
            ComplianceControl.framework == audit.framework
        ).all()
    }
    controls_out = []
    for r in results:
        ctrl = controls_map.get(r.control_id)
        controls_out.append({
            "result_id": r.id,
            "control_id": r.control_id,
            "control_ref": ctrl.control_id if ctrl else "—",
            "control_title": ctrl.title if ctrl else "—",
            "risk_level": ctrl.risk_level if ctrl else "medium",
            "result": r.result,
            "notes": r.notes,
            "tested_at": r.tested_at,
        })

    findings = db.query(ComplianceFinding).filter(
        ComplianceFinding.audit_id == audit_id
    ).all()
    findings_out = [
        {
            "id": f.id,
            "title": f.title,
            "description": f.description,
            "severity": f.severity,
            "status": f.status,
            "remediation": f.remediation,
            "due_date": str(f.due_date) if f.due_date else None,
            "owner": f.owner,
        }
        for f in findings
    ]
    return audit, controls_out, findings_out


@router.get("/{audit_id}/pdf")
def download_pdf(
    audit_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    audit, controls, findings = _build_report_data(audit_id, db)
    audit_dict = {
        "id": audit.id,
        "name": audit.name,
        "framework": audit.framework,
        "auditor": audit.auditor,
        "status": audit.status,
        "total_controls": audit.total_controls,
        "passed": audit.passed,
        "failed": audit.failed,
        "not_tested": audit.not_tested,
        "score_pct": audit.score_pct,
        "started_at": str(audit.started_at)[:10] if audit.started_at else None,
    }
    try:
        pdf_bytes = generate_audit_pdf(audit_dict, controls, findings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="audit_{audit_id}_{audit.framework}.pdf"'},
    )


@router.get("/{audit_id}/excel")
def download_excel(
    audit_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    audit, controls, findings = _build_report_data(audit_id, db)
    audit_dict = {
        "id": audit.id,
        "name": audit.name,
        "framework": audit.framework,
        "auditor": audit.auditor,
        "status": audit.status,
        "total_controls": audit.total_controls,
        "passed": audit.passed,
        "failed": audit.failed,
        "not_tested": audit.not_tested,
        "score_pct": audit.score_pct,
    }
    try:
        xlsx_bytes = generate_control_matrix(audit_dict, controls, findings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {e}")
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="audit_{audit_id}_{audit.framework}.xlsx"'},
    )


@router.get("/{audit_id}/certificate")
def download_certificate(
    audit_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    audit, controls, findings = _build_report_data(audit_id, db)
    audit_dict = {
        "id": audit.id,
        "name": audit.name,
        "framework": audit.framework,
        "auditor": audit.auditor,
        "status": audit.status,
        "total_controls": audit.total_controls,
        "passed": audit.passed,
        "failed": audit.failed,
        "not_tested": audit.not_tested,
        "score_pct": audit.score_pct,
    }
    try:
        cert_bytes = generate_certification_letter(audit_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Certificate generation failed: {e}")
    return Response(
        content=cert_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="certificate_{audit_id}_{audit.framework}.pdf"'},
    )
