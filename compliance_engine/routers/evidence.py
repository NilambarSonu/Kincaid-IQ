import io
import json
import socket
import hashlib
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models as base_models
from backend.auth import get_current_user
from compliance_engine.models.controls import ComplianceControl
from compliance_engine.models.evidence import ComplianceEvidence
from compliance_engine.schemas.audit_schema import EvidenceOut

logger = logging.getLogger("kincaid.compliance.evidence")
router = APIRouter(prefix="/api/compliance/evidence", tags=["compliance"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(data: bytes, filename: str) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(data))
            return "\n".join(p.extract_text() or "" for p in reader.pages)[:20000]
        except Exception:
            return ""
    elif name.endswith(".docx"):
        try:
            import docx
            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())[:20000]
        except Exception:
            return ""
    else:
        return data.decode("utf-8", errors="ignore")[:20000]


def _make_evidence(
    *,
    control_id: int,
    filename: str,
    content: str,
    evidence_type: str,
    collection_method: str,
    uploaded_by: str,
) -> ComplianceEvidence:
    content_bytes = content.encode("utf-8")
    return ComplianceEvidence(
        control_id=control_id,
        filename=filename,
        original_name=filename,
        file_type="application/json",
        file_size=len(content_bytes),
        description=f"Auto-collected via {collection_method}",
        uploaded_by=uploaded_by,
        file_content=content,
        source="automated",
        collection_method=collection_method,
        evidence_type=evidence_type,
        hash_val=hashlib.sha256(content_bytes).hexdigest(),
    )


def _resolve_control(db: Session, control_id: int) -> ComplianceControl:
    ctrl = db.query(ComplianceControl).filter(ComplianceControl.id == control_id).first()
    if not ctrl:
        raise HTTPException(status_code=404, detail="Control not found")
    return ctrl


# ---------------------------------------------------------------------------
# Manual upload
# ---------------------------------------------------------------------------

@router.post("", response_model=EvidenceOut)
async def upload_evidence(
    control_id: int = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    _resolve_control(db, control_id)
    data = await file.read()
    text = _extract_text(data, file.filename or "file")
    ev = ComplianceEvidence(
        control_id=control_id,
        filename=file.filename or "evidence",
        original_name=file.filename or "evidence",
        file_type=file.content_type,
        file_size=len(data),
        description=description,
        uploaded_by=user.email,
        file_content=text,
        source="manual",
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.get("/{control_id}", response_model=List[EvidenceOut])
def list_evidence(
    control_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    return db.query(ComplianceEvidence).filter(
        ComplianceEvidence.control_id == control_id
    ).all()


@router.delete("/{evidence_id}")
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    ev = db.query(ComplianceEvidence).filter(ComplianceEvidence.id == evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    db.delete(ev)
    db.commit()
    return {"deleted": evidence_id}


# ---------------------------------------------------------------------------
# Automated evidence collectors
# ---------------------------------------------------------------------------

class GithubMfaRequest(BaseModel):
    control_id: int
    github_token: str
    org_name: str


class AwsIamRequest(BaseModel):
    control_id: int
    aws_access_key: str
    aws_secret_key: str
    aws_region: str = "us-east-1"


class NetworkScanRequest(BaseModel):
    control_id: int
    target: str
    ports: str = "22,80,443,3306,5432,6379,8080,8443"


@router.post("/collect/github-mfa", response_model=EvidenceOut)
async def collect_github_mfa(
    body: GithubMfaRequest,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    """
    Query the GitHub API to confirm whether MFA is enforced for an organisation.
    Maps to SOC 2 CC6.1 and similar access-control requirements.
    """
    _resolve_control(db, body.control_id)

    import httpx
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                f"https://api.github.com/orgs/{body.org_name}",
                headers={
                    "Authorization": f"token {body.github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
        if r.status_code == 401:
            raise HTTPException(status_code=400, detail="GitHub token is invalid or expired")
        if r.status_code == 404:
            raise HTTPException(status_code=400, detail=f"GitHub org '{body.org_name}' not found")
        r.raise_for_status()
        data = r.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"GitHub API unreachable: {exc}")

    mfa_required = bool(data.get("two_factor_requirement_enabled", False))
    payload = {
        "org": body.org_name,
        "mfa_required": mfa_required,
        "members_count": data.get("members", 0),
        "default_repository_permission": data.get("default_repository_permission"),
        "members_can_create_repositories": data.get("members_can_create_repositories"),
        "evidence_type": "mfa_screenshot",
        "collector": "github-mfa",
    }
    content = json.dumps(payload, indent=2)

    ev = _make_evidence(
        control_id=body.control_id,
        filename=f"github_mfa_{body.org_name}.json",
        content=content,
        evidence_type="mfa_screenshot",
        collection_method="github-mfa-api",
        uploaded_by=user.email,
    )
    db.add(ev)

    if mfa_required:
        ctrl = db.query(ComplianceControl).filter(ComplianceControl.id == body.control_id).first()
        if ctrl and ctrl.status == "not_tested":
            ctrl.status = "pass"

    db.commit()
    db.refresh(ev)
    return ev


@router.post("/collect/aws-iam", response_model=EvidenceOut)
async def collect_aws_iam(
    body: AwsIamRequest,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    """
    Pull the AWS account password policy and list IAM users without MFA via boto3.
    Maps to SOC 2 CC6.1, HIPAA §164.312(d), NIST PR.AC-1.
    """
    _resolve_control(db, body.control_id)

    try:
        import boto3
        from botocore.exceptions import ClientError, BotoCoreError

        iam = boto3.client(
            "iam",
            aws_access_key_id=body.aws_access_key,
            aws_secret_access_key=body.aws_secret_key,
            region_name=body.aws_region,
        )

        password_policy: dict = {}
        try:
            pp = iam.get_account_password_policy()
            password_policy = pp.get("PasswordPolicy", {})
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchEntity":
                password_policy = {"error": "No password policy configured"}
            else:
                raise

        users_without_mfa: list = []
        try:
            paginator = iam.get_paginator("list_users")
            for page in paginator.paginate():
                for u in page.get("Users", []):
                    mfa_devices = iam.list_mfa_devices(UserName=u["UserName"])
                    if not mfa_devices.get("MFADevices"):
                        users_without_mfa.append(u["UserName"])
        except ClientError:
            users_without_mfa = ["<could not enumerate — insufficient iam:ListUsers permission>"]

        payload = {
            "account_password_policy": password_policy,
            "users_without_mfa": users_without_mfa,
            "users_without_mfa_count": len(users_without_mfa),
            "evidence_type": "iam_policy",
            "collector": "aws-iam",
        }
        content = json.dumps(payload, indent=2)

    except (ImportError,) as exc:
        raise HTTPException(status_code=500, detail=f"boto3 not available: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AWS API error: {exc}")

    ev = _make_evidence(
        control_id=body.control_id,
        filename="aws_iam_policy.json",
        content=content,
        evidence_type="iam_policy",
        collection_method="aws-iam-api",
        uploaded_by=user.email,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.post("/collect/network-scan", response_model=EvidenceOut)
async def collect_network_scan(
    body: NetworkScanRequest,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    """
    Perform a TCP port connectivity check against a target host.
    Maps to SOC 2 CC7.2, NIST DE.CM-1, PCI DSS 11.4.
    """
    _resolve_control(db, body.control_id)

    port_list = [int(p.strip()) for p in body.ports.split(",") if p.strip().isdigit()]
    results: list = []

    for port in port_list:
        status = "closed"
        try:
            with socket.create_connection((body.target, port), timeout=2):
                status = "open"
        except (socket.timeout, ConnectionRefusedError, OSError):
            pass
        results.append({"port": port, "status": status})

    open_ports = [r["port"] for r in results if r["status"] == "open"]

    payload = {
        "target": body.target,
        "ports_scanned": port_list,
        "results": results,
        "open_ports": open_ports,
        "open_count": len(open_ports),
        "evidence_type": "vuln_scan_report",
        "collector": "network-scan",
    }
    content = json.dumps(payload, indent=2)

    ev = _make_evidence(
        control_id=body.control_id,
        filename=f"network_scan_{body.target.replace('.', '_')}.json",
        content=content,
        evidence_type="vuln_scan_report",
        collection_method="tcp-port-scan",
        uploaded_by=user.email,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev
