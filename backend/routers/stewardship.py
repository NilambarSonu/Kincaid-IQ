"""Stewardship Report Builder — annual client value documentation."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/stewardship", tags=["stewardship"])


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return {
        "clients": [
            {"id": "CLI-001", "name": "Lakeland Manufacturing Co.", "employees": 312, "plan_year": "2024", "renewal_date": "Jan 1, 2026"},
            {"id": "CLI-002", "name": "Heritage Credit Union",     "employees": 148, "plan_year": "2024", "renewal_date": "Jul 1, 2025"},
            {"id": "CLI-003", "name": "Midwest Logistics Group",   "employees": 487, "plan_year": "2024", "renewal_date": "Jan 1, 2026"},
            {"id": "CLI-004", "name": "Delphi Dental Partners",    "employees": 94,  "plan_year": "2024", "renewal_date": "Oct 1, 2025"},
            {"id": "CLI-005", "name": "Cornerstone Church Network","employees": 218, "plan_year": "2024", "renewal_date": "Jan 1, 2026"},
        ],
    }


@router.get("/report/{client_id}")
def report(client_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    clients = {
        "CLI-001": {"name": "Lakeland Manufacturing Co.", "employees": 312, "industry": "Manufacturing", "plan_year": "2024", "renewal_date": "Jan 1, 2026", "annual_premium": 3_890_000},
        "CLI-002": {"name": "Heritage Credit Union",     "employees": 148, "industry": "Financial Services", "plan_year": "2024", "renewal_date": "Jul 1, 2025", "annual_premium": 1_820_000},
        "CLI-003": {"name": "Midwest Logistics Group",   "employees": 487, "industry": "Logistics", "plan_year": "2024", "renewal_date": "Jan 1, 2026", "annual_premium": 5_940_000},
        "CLI-004": {"name": "Delphi Dental Partners",    "employees": 94,  "industry": "Healthcare", "plan_year": "2024", "renewal_date": "Oct 1, 2025", "annual_premium": 1_140_000},
        "CLI-005": {"name": "Cornerstone Church Network","employees": 218, "industry": "Non-Profit", "plan_year": "2024", "renewal_date": "Jan 1, 2026", "annual_premium": 2_620_000},
    }
    client = clients.get(client_id, clients["CLI-001"])
    base = client["annual_premium"]

    return {
        "client": client,
        "report_period": "January 1, 2024 – December 31, 2024",
        "prepared_by": "Jeremiah Shrack, CEO · Kincaid RMC",
        "scores": {
            "rx_defense":  {"current": 68, "prior": 42, "delta": 26},
            "network_iq":  {"current": 71, "prior": 58, "delta": 13},
            "stop_loss":   {"current": 79, "prior": 71, "delta": 8},
            "fiduciary":   {"current": 61, "prior": 44, "delta": 17},
            "overall":     {"current": 72, "prior": 54, "delta": 18},
        },
        "savings_documented": [
            {"category": "PBM Renegotiation",          "description": "Eliminated spread pricing, added pass-through rebates", "gross_savings": round(base * 0.058), "verified": True},
            {"category": "Stop-Loss Restructure",       "description": "Lowered specific deductible, added laser protection", "gross_savings": round(base * 0.021), "verified": True},
            {"category": "Network Leakage Reduction",   "description": "Steerage program reduced OON spend by 18%",  "gross_savings": round(base * 0.031), "verified": True},
            {"category": "Rx Formulary Optimization",  "description": "Generic conversion program — 94 brand switches", "gross_savings": round(base * 0.018), "verified": True},
            {"category": "CAA Compliance Avoidance",    "description": "Avoided 2 potential DOL penalties via proactive disclosure", "gross_savings": 48_000, "verified": False},
            {"category": "Renewal Rate Containment",    "description": "Negotiated carrier renewal at 4.2% vs. 9.8% initial ask", "gross_savings": round(base * 0.056), "verified": True},
        ],
        "actions_completed": [
            {"quarter": "Q1 2024", "action": "PBM contract renegotiation completed", "impact": "High", "status": "Done"},
            {"quarter": "Q1 2024", "action": "408(b)(2) disclosures obtained from all vendors", "impact": "High", "status": "Done"},
            {"quarter": "Q2 2024", "action": "Fiduciary committee established and first meeting held", "impact": "Medium", "status": "Done"},
            {"quarter": "Q2 2024", "action": "Network adequacy audit completed — 3 specialty gaps identified", "impact": "High", "status": "Done"},
            {"quarter": "Q3 2024", "action": "Mental health network expansion (added 8 providers)", "impact": "High", "status": "Done"},
            {"quarter": "Q3 2024", "action": "Rx generic conversion program launched", "impact": "Medium", "status": "Done"},
            {"quarter": "Q4 2024", "action": "Stop-loss laser protection added for 2 high-cost claimants", "impact": "High", "status": "Done"},
            {"quarter": "Q4 2024", "action": "2025 carrier renewal negotiated and executed", "impact": "High", "status": "Done"},
            {"quarter": "Q4 2024", "action": "Gag clause attestation filed with DOL/HHS", "impact": "Medium", "status": "Done"},
            {"quarter": "Q4 2024", "action": "Member communication plan deployed for network changes", "impact": "Medium", "status": "Done"},
        ],
        "compliance_wins": [
            {"item": "Gag Clause Attestation filed on time", "statute": "CAA §201(b)", "risk_avoided": "DOL enforcement action"},
            {"item": "All 408(b)(2) disclosures obtained and reviewed", "statute": "ERISA 408(b)(2)", "risk_avoided": "Prohibited transaction + personal liability"},
            {"item": "COBRA notices 100% compliant — 0 late notices", "statute": "ERISA §606", "risk_avoided": "$110/day/participant penalty"},
            {"item": "Form 5500 filed timely", "statute": "ERISA §104", "risk_avoided": "$250/day penalty"},
            {"item": "Network adequacy documented for CAA", "statute": "CAA §116", "risk_avoided": "CMS compliance review"},
        ],
        "year_over_year": {
            "premium_trend": [
                {"year": "2021", "pmpm": 712, "benchmark": 768},
                {"year": "2022", "pmpm": 748, "benchmark": 798},
                {"year": "2023", "pmpm": 791, "benchmark": 828},
                {"year": "2024", "pmpm": 823, "benchmark": 862},
            ],
            "rx_cost_trend": [
                {"year": "2021", "pmpm": 142}, {"year": "2022", "pmpm": 156},
                {"year": "2023", "pmpm": 201}, {"year": "2024", "pmpm": 187},
            ],
        },
        "recommendations_2025": [
            {"priority": "High",   "rec": "Complete MHPAEA comparative analysis before Q2 DOL audit season"},
            {"priority": "High",   "rec": "Implement advanced EOB — CAA §107 deadline passed"},
            {"priority": "Medium", "rec": "Launch chronic disease management program to address top cost drivers"},
            {"priority": "Medium", "rec": "Benchmark stop-loss market — no competitive RFP in 2 years"},
            {"priority": "Low",    "rec": "Add teledermatology to address gap county network access"},
        ],
    }
