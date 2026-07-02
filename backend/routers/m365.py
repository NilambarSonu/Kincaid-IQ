from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/api/m365", tags=["m365"])

# ── DEMO DATA ─────────────────────────────────────────────────────────────────
DEMO_TENANT = {
    "id": "a8f3c2e1-4b72-4d8a-9c1f-3e7b5a2d6f09",
    "name": "Human Capital Concepts LLC",
    "domain": "humancapitalconcepts.com",
    "country": "US",
    "plan": "Microsoft 365 Business Premium",
    "licensed_users": 312,
    "connected_at": "2025-03-01T09:00:00Z",
}

DEMO_USERS = [
    {"id": "u001", "name": "Kara Mitchell", "title": "Plan Administrator", "dept": "HR Benefits", "email": "k.mitchell@humancapitalconcepts.com", "active": True},
    {"id": "u002", "name": "Harlan Schafir", "title": "CEO / DFE Trustee", "dept": "Executive", "email": "h.schafir@humancapitalconcepts.com", "active": True},
    {"id": "u003", "name": "Denise Palermo", "title": "Benefits Coordinator", "dept": "HR Benefits", "email": "d.palermo@humancapitalconcepts.com", "active": True},
    {"id": "u004", "name": "Tyler Rourke", "title": "CFO", "dept": "Finance", "email": "t.rourke@humancapitalconcepts.com", "active": True},
    {"id": "u005", "name": "Angela Vonn", "title": "Payroll Director", "dept": "HR Payroll", "email": "a.vonn@humancapitalconcepts.com", "active": True},
]

DEMO_DEPARTMENTS = [
    {"name": "HR Benefits", "headcount": 18, "benefit_eligible": 18},
    {"name": "HR Payroll", "headcount": 14, "benefit_eligible": 14},
    {"name": "Operations", "headcount": 487, "benefit_eligible": 421},
    {"name": "Client Services", "headcount": 612, "benefit_eligible": 558},
    {"name": "IT", "headcount": 43, "benefit_eligible": 43},
    {"name": "Finance", "headcount": 29, "benefit_eligible": 29},
    {"name": "Executive", "headcount": 11, "benefit_eligible": 11},
    {"name": "Sales", "headcount": 198, "benefit_eligible": 167},
    {"name": "Field Staff", "headcount": 729, "benefit_eligible": 880},
]

DEMO_CALENDAR = [
    {"id": "c001", "subject": "Guardian Life — 2025 Renewal Review", "organizer": "k.mitchell@humancapitalconcepts.com", "attendees": ["guardian.rep@guardianlife.com", "h.schafir@humancapitalconcepts.com"], "date": "2025-07-14T14:00:00Z", "flag": "RENEWAL", "flag_color": "amber"},
    {"id": "c002", "subject": "Q2 Benefits Committee Meeting", "organizer": "h.schafir@humancapitalconcepts.com", "attendees": ["k.mitchell@humancapitalconcepts.com", "t.rourke@humancapitalconcepts.com"], "date": "2025-06-30T10:00:00Z", "flag": "COMMITTEE", "flag_color": "blue"},
    {"id": "c003", "subject": "PBM Contract Review — OptumRx", "organizer": "k.mitchell@humancapitalconcepts.com", "attendees": ["optum.account@optumrx.com"], "date": "2025-06-15T13:00:00Z", "flag": "PBM", "flag_color": "red"},
    {"id": "c004", "subject": "DOL Audit Prep — ERISA §408(b)(2)", "organizer": "h.schafir@humancapitalconcepts.com", "attendees": ["legal@hcclegal.com", "k.mitchell@humancapitalconcepts.com"], "date": "2025-06-05T09:00:00Z", "flag": "DOL", "flag_color": "red"},
    {"id": "c005", "subject": "Lincoln National — Exit Meeting (Historical)", "organizer": "k.mitchell@humancapitalconcepts.com", "attendees": ["account@lfg.com"], "date": "2021-09-22T11:00:00Z", "flag": "CARRIER_CHANGE", "flag_color": "purple"},
    {"id": "c006", "subject": "Annual Enrollment Kickoff 2025", "organizer": "a.vonn@humancapitalconcepts.com", "attendees": ["k.mitchell@humancapitalconcepts.com", "d.palermo@humancapitalconcepts.com"], "date": "2025-08-01T08:30:00Z", "flag": "ENROLLMENT", "flag_color": "green"},
]

DEMO_SHAREPOINT = [
    {"id": "sp001", "name": "Guardian_Life_2024_Contract.pdf", "folder": "Carrier Contracts", "modified": "2024-11-15", "size_kb": 842, "flag": "CONTRACT"},
    {"id": "sp002", "name": "Form5500_2023_Final_Signed.pdf", "folder": "DOL Filings", "modified": "2025-04-25", "size_kb": 1240, "flag": "DOL_FILING"},
    {"id": "sp003", "name": "Lincoln_National_Termination_2021.pdf", "folder": "Carrier Contracts", "modified": "2021-10-01", "size_kb": 318, "flag": "TERMINATION"},
    {"id": "sp004", "name": "Broker_Services_Agreement_2022.pdf", "folder": "Broker Agreements", "modified": "2022-01-12", "size_kb": 567, "flag": "BROKER"},
    {"id": "sp005", "name": "Benefits_Summary_PlanYear2024.xlsx", "folder": "Plan Documents", "modified": "2024-12-01", "size_kb": 1120, "flag": "PLAN_DOC"},
    {"id": "sp006", "name": "ERISA_408b2_Disclosure_2023.pdf", "folder": "Compliance", "modified": "2023-11-30", "size_kb": 234, "flag": "COMPLIANCE"},
    {"id": "sp007", "name": "OptumRx_PBM_Proposal_2025.pdf", "folder": "Vendor RFPs", "modified": "2025-05-20", "size_kb": 1876, "flag": "PBM"},
]

@router.get("/status")
def get_status():
    return {"connected": True, "demo_mode": True, "tenant": DEMO_TENANT}

@router.get("/headcount")
def get_headcount():
    depts = DEMO_DEPARTMENTS
    total_employees = sum(d["headcount"] for d in depts)
    total_eligible = sum(d["benefit_eligible"] for d in depts)
    dol_participants = 2141
    discrepancy = total_eligible - dol_participants
    return {
        "departments": depts,
        "totals": {
            "total_employees": total_employees,
            "benefit_eligible": total_eligible,
            "dol_5500_participants": dol_participants,
            "discrepancy": discrepancy,
            "discrepancy_pct": round((discrepancy / dol_participants) * 100, 1),
            "flag": "HIGH" if abs(discrepancy) > 200 else "MODERATE" if abs(discrepancy) > 50 else "CLEAR",
        },
        "kincaid_finding": (
            f"M365 directory shows {total_eligible:,} benefit-eligible employees vs "
            f"{dol_participants:,} reported on the 2023 Form 5500 — a discrepancy of "
            f"{discrepancy:+,} lives. This gap may indicate unreported participants or "
            f"an outdated enrollment roster submitted to the DOL."
        )
    }

@router.get("/calendar")
def get_calendar():
    return {
        "events": DEMO_CALENDAR,
        "renewal_window_detected": True,
        "next_renewal": "2025-07-14",
        "kincaid_finding": (
            "Guardian Life renewal meeting detected on calendar (July 14, 2025). "
            "PBM review with OptumRx scheduled June 15. DOL audit prep meeting "
            "scheduled June 5 — indicating active compliance awareness."
        )
    }

@router.get("/sharepoint")
def get_sharepoint():
    return {
        "documents": DEMO_SHAREPOINT,
        "kincaid_finding": (
            "§408(b)(2) disclosure document found (2023) — last updated Nov 2023. "
            "Broker Services Agreement (2022) predates 2022 carrier switch to Guardian. "
            "No updated broker agreement on file post-carrier change — potential gap."
        )
    }

@router.get("/users")
def get_users():
    return {"users": DEMO_USERS, "total": len(DEMO_USERS)}

@router.get("/summary")
def get_summary():
    return {
        "tenant": DEMO_TENANT,
        "kpi": {
            "total_employees": 2141,
            "benefit_eligible": 2141,
            "dol_participants": 2141,
            "discrepancy": 0,
            "documents_indexed": len(DEMO_SHAREPOINT),
            "renewal_events_detected": 1,
            "compliance_documents": 1,
            "broker_agreements_on_file": 1,
        },
        "alerts": [
            {"level": "HIGH", "message": "Broker Services Agreement (2022) not updated post-carrier switch"},
            {"level": "MEDIUM", "message": "§408(b)(2) disclosure last filed Nov 2023 — approaching annual renewal"},
            {"level": "LOW", "message": "Guardian Life renewal meeting Jul 14 — engagement window open"},
        ]
    }
