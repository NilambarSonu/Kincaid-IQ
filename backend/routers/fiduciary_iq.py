"""ERISA Fiduciary IQ™ — 408(b)(2) tracking, fiduciary risk scoring, DOL audit prep."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/fiduciary-iq", tags=["fiduciary-iq"])


# ─── DEMO DATA ────────────────────────────────────────────────────────────────

def _dashboard_data(plan_name: str = "Employer Health Plan", org_name: str | None = None, participants: int = 500):
    org = org_name or plan_name
    return {
        "fiduciary_risk_score": 61,
        "risk_grade": "C+",
        "risk_level": "Elevated",
        "org_name": org,
        "plan_name": plan_name,
        "participants": participants,
        "summary": {
            "critical_gaps": 4,
            "high_gaps": 3,
            "disclosures_missing": 3,
            "meetings_documented": 2,
            "meetings_required": 4,
            "audit_readiness_score": 54,
            "total_undisclosed_fees": 184_200,
        },
        "duty_scores": [
            {"duty": "Prudent Expert Standard",    "score": 58, "weight": 25,
             "description": "Acting with the care, skill, prudence and diligence of a knowledgeable person",
             "gaps": ["No documented investment policy statement", "Vendor benchmarking incomplete for 3 of 6 vendors"]},
            {"duty": "Exclusive Benefit / Loyalty", "score": 44, "weight": 25,
             "description": "Acting solely in the interest of plan participants and beneficiaries",
             "gaps": ["PBM rebate pass-through not verified", "Carrier fee disclosure incomplete", "No conflict-of-interest policy on file"]},
            {"duty": "Plan Document Compliance",    "score": 82, "weight": 20,
             "description": "Operating plan in accordance with plan documents and governing law",
             "gaps": ["SPD last updated 2022 — CAA updates not incorporated"]},
            {"duty": "Monitoring & Oversight",     "score": 55, "weight": 20,
             "description": "Continuously monitoring service providers and plan performance",
             "gaps": ["No formal vendor scorecard", "Fiduciary committee met only 2 of 4 required times in 2024"]},
            {"duty": "Diversification / Prudence", "score": 71, "weight": 10,
             "description": "Prudent selection and diversification of plan service providers",
             "gaps": ["Stop-loss carrier benchmarked — no competitive bid in 3 years"]},
        ],
        "disclosures_408b2": [
            {"vendor": "BlueCross BlueShield Indiana", "type": "Carrier / ASO",
             "annual_compensation": 312_000, "fee_basis": "% of premium",
             "disclosure_received": True, "disclosure_date": "2024-01-15",
             "disclosure_complete": True, "notes": None},
            {"vendor": "OptumRx", "type": "PBM",
             "annual_compensation": 284_000, "fee_basis": "Admin fee + retained rebates",
             "disclosure_received": True, "disclosure_date": "2024-02-01",
             "disclosure_complete": False,
             "notes": "Disclosure does not quantify retained manufacturer revenue — incomplete under CAA §204"},
            {"vendor": "Trustmark Stop Loss", "type": "Stop-Loss Carrier",
             "annual_compensation": 98_400, "fee_basis": "Fixed premium",
             "disclosure_received": True, "disclosure_date": "2024-01-20",
             "disclosure_complete": True, "notes": None},
            {"vendor": "Kincaid RMC", "type": "Broker / Consultant",
             "annual_compensation": 142_000, "fee_basis": "Commission + consulting fee",
             "disclosure_received": True, "disclosure_date": "2024-01-10",
             "disclosure_complete": True, "notes": "Disclosed per ERISA 408(b)(2) and CAA §202"},
            {"vendor": "Meritain Health (TPA)", "type": "Third-Party Administrator",
             "annual_compensation": 84_600, "fee_basis": "PEPM",
             "disclosure_received": False, "disclosure_date": None,
             "disclosure_complete": False,
             "notes": "Disclosure requested 90 days ago — no response. Prohibited transaction risk."},
            {"vendor": "Northwood Network Access", "type": "Network Access / Rental",
             "annual_compensation": 61_800, "fee_basis": "Per-claim access fee",
             "disclosure_received": False, "disclosure_date": None,
             "disclosure_complete": False,
             "notes": "No disclosure on file. Network access fees must be disclosed under CAA."},
            {"vendor": "Hirequest EAP", "type": "EAP Provider",
             "annual_compensation": 18_400, "fee_basis": "PEPM",
             "disclosure_received": False, "disclosure_date": None,
             "disclosure_complete": False, "notes": "Below ERISA threshold but CAA disclosure recommended."},
        ],
        "erisa_checklist": [
            {"category": "Plan Document Compliance", "items": [
                {"task": "Summary Plan Description (SPD) distributed to all participants", "statute": "ERISA §102", "status": "PASS", "due": None},
                {"task": "SPD updated for CAA 2021 changes (price transparency, NSA)", "statute": "ERISA §102 / CAA", "status": "FAIL", "due": "2025-01-01", "severity": "High"},
                {"task": "Summary of Material Modification (SMM) issued for plan changes", "statute": "ERISA §104(b)", "status": "WARN", "due": "2025-03-01", "severity": "Medium"},
                {"task": "Form 5500 filed timely with accurate data", "statute": "ERISA §104", "status": "PASS", "due": None},
                {"task": "Claims and appeals procedures comply with ERISA §503", "statute": "ERISA §503", "status": "PASS", "due": None},
            ]},
            {"category": "Fee Disclosure (408b2)", "items": [
                {"task": "All covered service providers have filed 408(b)(2) disclosure", "statute": "29 CFR 2550.408b-2", "status": "FAIL", "due": "Ongoing", "severity": "Critical"},
                {"task": "Disclosures reviewed and confirmed reasonable compensation", "statute": "ERISA §404(a)", "status": "FAIL", "due": "Ongoing", "severity": "Critical"},
                {"task": "Written request sent to non-compliant vendors", "statute": "29 CFR 2550.408b-2(c)(1)(iv)", "status": "WARN", "due": "30 days", "severity": "High"},
                {"task": "Compensation benchmarked against market rates", "statute": "ERISA §404(a)(1)(A)", "status": "WARN", "due": "Annual", "severity": "Medium"},
            ]},
            {"category": "Fiduciary Governance", "items": [
                {"task": "Named fiduciary identified in plan document", "statute": "ERISA §402(a)", "status": "PASS", "due": None},
                {"task": "Fiduciary committee meets at least quarterly", "statute": "ERISA §404", "status": "FAIL", "due": "Quarterly", "severity": "High"},
                {"task": "Committee meeting minutes documented and retained", "statute": "ERISA §404", "status": "WARN", "due": "Ongoing", "severity": "Medium"},
                {"task": "Fiduciary liability insurance in place", "statute": "ERISA §410", "status": "PASS", "due": None},
                {"task": "Conflict-of-interest policy adopted and documented", "statute": "ERISA §406", "status": "FAIL", "due": "2025-06-01", "severity": "High"},
            ]},
            {"category": "CAA 2021 Compliance", "items": [
                {"task": "Gag clause prohibition attestation filed with DOL/HHS", "statute": "CAA §201(b)", "status": "PASS", "due": None},
                {"task": "Machine-readable files (MRF) published", "statute": "CAA §201", "status": "PASS", "due": None},
                {"task": "Advanced EOB implemented for scheduled services", "statute": "CAA §107", "status": "FAIL", "due": "Past due", "severity": "Critical"},
                {"task": "Broker compensation disclosed to plan sponsor in writing", "statute": "CAA §202", "status": "PASS", "due": None},
                {"task": "Mental Health Parity (MHPAEA) comparative analysis documented", "statute": "MHPAEA / CAA §203", "status": "FAIL", "due": "2025-01-01", "severity": "Critical"},
                {"task": "Rx drug spend reporting (RxDC) submitted", "statute": "CAA §204", "status": "PASS", "due": None},
            ]},
            {"category": "Participant Rights", "items": [
                {"task": "COBRA notices sent within required timeframes", "statute": "ERISA §606", "status": "PASS", "due": None},
                {"task": "HIPAA special enrollment rights disclosed", "statute": "HIPAA §2704", "status": "PASS", "due": None},
                {"task": "WHCRA (mastectomy) notice in SPD", "statute": "WHCRA", "status": "WARN", "due": "Next SPD update", "severity": "Low"},
                {"task": "Newborns' Act notice in SPD", "statute": "Newborns' Act", "status": "PASS", "due": None},
                {"task": "CHIPRA model notice issued (if applicable)", "statute": "CHIPRA", "status": "PASS", "due": None},
            ]},
        ],
        "dol_audit_readiness": {
            "score": 54,
            "grade": "D+",
            "documents": [
                {"doc": "Current SPD",                        "status": "PARTIAL", "notes": "On file but not updated for CAA changes"},
                {"doc": "Form 5500 (last 3 years)",           "status": "COMPLETE", "notes": None},
                {"doc": "All 408(b)(2) Disclosures",          "status": "MISSING",  "notes": "3 of 7 vendors not on file"},
                {"doc": "Fiduciary Committee Meeting Minutes", "status": "PARTIAL",  "notes": "Only 2 of 4 2024 meetings documented"},
                {"doc": "Vendor Fee Benchmarking Analysis",   "status": "MISSING",  "notes": "Never performed — high audit exposure"},
                {"doc": "MHPAEA Comparative Analysis (NQTL)", "status": "MISSING",  "notes": "Required — not on file"},
                {"doc": "Gag Clause Attestation",             "status": "COMPLETE", "notes": "Filed 2024-12-01"},
                {"doc": "Conflict-of-Interest Policy",        "status": "MISSING",  "notes": "No written policy on file"},
                {"doc": "Investment Policy Statement",        "status": "MISSING",  "notes": "N/A for health plan but recommended"},
                {"doc": "Vendor Contracts (all service providers)", "status": "PARTIAL", "notes": "EAP and network access contracts not on file"},
                {"doc": "RxDC Reporting Submission",          "status": "COMPLETE", "notes": "2024 submission confirmed"},
                {"doc": "Fiduciary Liability Insurance Certificate", "status": "COMPLETE", "notes": "Active through 12/31/2025"},
            ],
        },
        "action_plan": [
            {"priority": "Critical", "title": "Obtain Missing 408(b)(2) Disclosures",
             "desc": "Send formal written request to Meritain, Northwood, and Hirequest. Failure to obtain = prohibited transaction. Document all outreach.", "timeline": "30 days", "owner": "HR / Broker"},
            {"priority": "Critical", "title": "Complete MHPAEA Comparative Analysis",
             "desc": "Document NQTL comparative analysis for all mental health vs. medical/surgical benefit limitations. DOL audit target #1.", "timeline": "60 days", "owner": "TPA + Broker"},
            {"priority": "Critical", "title": "Update SPD for CAA Requirements",
             "desc": "Incorporate price transparency, NSA protections, and updated EOB rights. Distribute updated SPD to all participants within 90 days.", "timeline": "60 days", "owner": "Plan Sponsor / TPA"},
            {"priority": "High", "title": "Schedule Remaining 2025 Fiduciary Committee Meetings",
             "desc": "At minimum quarterly meetings required. Calendar Q2, Q3, Q4. Prepare agenda templates and document minutes.", "timeline": "2 weeks", "owner": "Plan Sponsor"},
            {"priority": "High", "title": "Adopt Written Conflict-of-Interest Policy",
             "desc": "Draft and execute written COI policy for all plan fiduciaries. Required for audit readiness and ERISA §406 compliance.", "timeline": "45 days", "owner": "Plan Sponsor"},
            {"priority": "High", "title": "Benchmark All Vendor Compensation",
             "desc": "Compare each service provider's compensation against market data. Document analysis in fiduciary file.", "timeline": "90 days", "owner": "Broker / Consultant"},
            {"priority": "Medium", "title": "Implement Advanced EOB for Scheduled Services",
             "desc": "Coordinate with TPA to provide real-time cost estimates before scheduled procedures. CAA §107 past deadline.", "timeline": "90 days", "owner": "TPA"},
            {"priority": "Medium", "title": "Obtain Missing Vendor Contracts",
             "desc": "Collect signed agreements for EAP and network access vendor. All contracts must be on file in fiduciary document vault.", "timeline": "30 days", "owner": "HR / Broker"},
        ],
    }


# ─── REQUEST MODELS ───────────────────────────────────────────────────────────

class CreateDemoRequest(BaseModel):
    plan_name: Optional[str] = "Employer Health Plan"
    org_name: Optional[str] = None
    participants: Optional[int] = 500
    plan_year: Optional[int] = 2024


class UploadRequest(BaseModel):
    filename: str
    content_type: str = "application/pdf"
    data_b64: str
    plan_name: Optional[str] = None
    org_name: Optional[str] = None
    participants: Optional[int] = 500
    plan_year: Optional[int] = 2024


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.post("/demo")
def create_demo(
    body: CreateDemoRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    plan_id = str(uuid.uuid4())
    db.execute(text("""
        INSERT INTO fiduciary_plans (id, user_id, plan_name, org_name, participants, plan_year, status)
        VALUES (:id, :uid, :name, :org, :par, :yr, 'complete')
    """), {
        "id": plan_id, "uid": user.id,
        "name": body.plan_name or "Employer Health Plan",
        "org": body.org_name,
        "par": body.participants or 500,
        "yr": body.plan_year or 2024,
    })
    db.commit()
    return {"id": plan_id}


@router.post("/upload")
def upload_plan(
    body: UploadRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    plan_id = str(uuid.uuid4())
    plan_name = body.plan_name or body.filename.rsplit(".", 1)[0].replace("_", " ") or "Uploaded Plan"
    db.execute(text("""
        INSERT INTO fiduciary_plans (id, user_id, plan_name, org_name, participants, plan_year, status)
        VALUES (:id, :uid, :name, :org, :par, :yr, 'complete')
    """), {
        "id": plan_id, "uid": user.id,
        "name": plan_name,
        "org": body.org_name,
        "par": body.participants or 500,
        "yr": body.plan_year or 2024,
    })
    db.commit()
    return {"id": plan_id}


@router.get("/plans")
def list_plans(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT id, plan_name, org_name, participants, plan_year, status, created_at
        FROM fiduciary_plans
        WHERE user_id = :uid
        ORDER BY created_at DESC
    """), {"uid": user.id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/plans/{plan_id}")
def get_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.execute(text("""
        SELECT * FROM fiduciary_plans WHERE id = :id AND user_id = :uid
    """), {"id": plan_id, "uid": user.id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    d = dict(row._mapping)
    return {
        **_dashboard_data(d["plan_name"], d.get("org_name"), d.get("participants") or 500),
        "plan_meta": {
            "id": d["id"],
            "plan_name": d["plan_name"],
            "org_name": d.get("org_name"),
            "participants": d.get("participants"),
            "plan_year": d.get("plan_year"),
            "status": d["status"],
        },
    }


@router.delete("/plans/{plan_id}")
def delete_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.execute(text(
        "DELETE FROM fiduciary_plans WHERE id = :id AND user_id = :uid"
    ), {"id": plan_id, "uid": user.id})
    db.commit()
    return {"ok": True}


# ─── LEGACY ───────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return _dashboard_data()
