"""Broker Console — Kincaid IQ premium broker command center."""
import datetime
import math
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.services.edgar import edgar_enrich

router = APIRouter(prefix="/api/saas/broker", tags=["saas-broker"])

TODAY = datetime.date(2026, 3, 15)


def _days_until(date_str: str) -> int:
    try:
        d = datetime.date.fromisoformat(date_str)
        return (d - TODAY).days
    except Exception:
        return 999


def _timeline_stages(days_to_renewal: int):
    """Return all 9 renewal stages with status based on days remaining."""
    stages = [
        {"id": 1, "label": "Strategy Preparation",        "trigger": 180, "owner": "Broker",  "description": "Define renewal strategy, identify goals, review prior year claims experience."},
        {"id": 2, "label": "Document Request",            "trigger": 150, "owner": "Client",  "description": "Request current Rx contract, stop-loss policy, TPA agreement, and census data."},
        {"id": 3, "label": "Document Ingestion",          "trigger": 120, "owner": "Kincaid", "description": "Upload and scan all contracts. Run Rx Defense IQ™ and Stop-Loss IQ™ analyses."},
        {"id": 4, "label": "Market Analysis & Rx Review", "trigger": 90,  "owner": "Kincaid", "description": "Complete fiduciary scoring. Identify spread pricing, rebate gaps, laser risks, and exclusion issues."},
        {"id": 5, "label": "Stop-Loss Strategy",          "trigger": 60,  "owner": "Broker",  "description": "Develop stop-loss negotiation position. Request carrier alternatives. Evaluate aggregate exposure."},
        {"id": 6, "label": "Recommendation Package",      "trigger": 45,  "owner": "Broker",  "description": "Prepare executive recommendation. Quantify savings, risk mitigation, and negotiation roadmap."},
        {"id": 7, "label": "Decision Support",            "trigger": 30,  "owner": "Client",  "description": "Present recommendations to plan sponsor. Support vendor negotiation and decision process."},
        {"id": 8, "label": "Implementation Prep",         "trigger": 15,  "owner": "Broker",  "description": "Finalize new contracts, coordinate TPA transitions, prepare member communications."},
        {"id": 9, "label": "Renewal Complete",            "trigger": 0,   "owner": "Broker",  "description": "New contracts executed. Post-renewal review scheduled for 90 days out."},
    ]
    for s in stages:
        days_elapsed = s["trigger"] - days_to_renewal
        if days_to_renewal > s["trigger"]:
            s["status"] = "pending"
        elif days_elapsed >= 14:
            s["status"] = "complete"
        elif days_elapsed >= 0:
            s["status"] = "active"
        else:
            s["status"] = "complete"
    return stages


DEMO_CLIENTS = [
    {
        "id": "c1",
        "name": "Midwest Regional Hospital",
        "industry": "Healthcare",
        "employees": 820,
        "annual_spend": 9_800_000,
        "plan_type": "Self-Funded",
        "tpa": "Trustmark",
        "pbm": "Express Scripts",
        "sl_carrier": "Sun Life Financial",
        "renewal_date": "2026-04-14",
        "city": "Columbus",
        "state": "OH",
        "risk_score": 7.8,
        "health_score": 52,
        "tier": "platinum",
        "status": "active",
        "pmpm": 994.9,
        "mlr": 87.2,
        "yoy_trend": 8.4,
        "rx_status": "analyzed",
        "rx_score": 38,
        "sl_status": "analyzed",
        "sl_score": 44,
        "open_actions": 5,
        "docs_uploaded": 4,
        "docs_required": 6,
        "notes": "High-cost claimant flagged in Q3. Laser risk at renewal. Expedite negotiation timeline.",
        "contact_name": "Sandra Kowalski",
        "contact_title": "CFO",
        "contact_email": "skowalski@mrh.org",
    },
    {
        "id": "c2",
        "name": "Heritage Credit Union",
        "industry": "Financial Services",
        "employees": 420,
        "annual_spend": 3_800_000,
        "plan_type": "Self-Funded",
        "tpa": "HealthSCOPE Benefits",
        "pbm": "OptumRx",
        "sl_carrier": "Tokio Marine HCC",
        "renewal_date": "2026-04-30",
        "city": "Cleveland",
        "state": "OH",
        "risk_score": 8.9,
        "health_score": 44,
        "tier": "gold",
        "status": "active",
        "pmpm": 753.7,
        "mlr": 88.4,
        "yoy_trend": 12.6,
        "rx_status": "analyzed",
        "rx_score": 31,
        "sl_status": "pending",
        "sl_score": None,
        "open_actions": 4,
        "docs_uploaded": 2,
        "docs_required": 5,
        "notes": "Stop-loss upload needed urgently. MLR at 88% — aggregate attachment at risk.",
        "contact_name": "Michael Torres",
        "contact_title": "VP Operations",
        "contact_email": "mtorres@hcu.com",
    },
    {
        "id": "c3",
        "name": "Sun Valley School District",
        "industry": "Education",
        "employees": 1_240,
        "annual_spend": 14_200_000,
        "plan_type": "Self-Funded",
        "tpa": "Claims Management Inc",
        "pbm": "CVS Caremark",
        "sl_carrier": "Voya Financial",
        "renewal_date": "2026-05-14",
        "city": "Nashville",
        "state": "TN",
        "risk_score": 6.4,
        "health_score": 63,
        "tier": "platinum",
        "status": "active",
        "pmpm": 954.2,
        "mlr": 85.9,
        "yoy_trend": 9.2,
        "rx_status": "analyzed",
        "rx_score": 55,
        "sl_status": "analyzed",
        "sl_score": 60,
        "open_actions": 3,
        "docs_uploaded": 5,
        "docs_required": 6,
        "notes": "Rx Defense score improving but spread pricing still present. Stop-loss corridor confirmed at 125%.",
        "contact_name": "Patricia Nguyen",
        "contact_title": "Director of HR",
        "contact_email": "pnguyen@sunvalleysd.edu",
    },
    {
        "id": "c4",
        "name": "Pinnacle Retail Group",
        "industry": "Retail",
        "employees": 650,
        "annual_spend": 5_200_000,
        "plan_type": "Level-Funded",
        "tpa": "Sun Life",
        "pbm": "MedImpact",
        "sl_carrier": "Sun Life Financial",
        "renewal_date": "2026-05-30",
        "city": "Pittsburgh",
        "state": "PA",
        "risk_score": 5.8,
        "health_score": 71,
        "tier": "gold",
        "status": "active",
        "pmpm": 666.7,
        "mlr": 83.2,
        "yoy_trend": 6.9,
        "rx_status": "analyzed",
        "rx_score": 67,
        "sl_status": "analyzed",
        "sl_score": 72,
        "open_actions": 2,
        "docs_uploaded": 5,
        "docs_required": 5,
        "notes": "Good trajectory. Minor rebate pass-through gap identified. Recommend renewing current carrier.",
        "contact_name": "James Whitfield",
        "contact_title": "CEO",
        "contact_email": "jwhitfield@pinnacleretail.com",
    },
    {
        "id": "c5",
        "name": "Atlas Logistics LLC",
        "industry": "Transportation",
        "employees": 210,
        "annual_spend": 1_750_000,
        "plan_type": "Self-Funded",
        "tpa": "Allied Benefit Systems",
        "pbm": "Navitus Health Solutions",
        "sl_carrier": "HM Life Insurance",
        "renewal_date": "2026-06-13",
        "city": "Milwaukee",
        "state": "WI",
        "risk_score": 5.1,
        "health_score": 74,
        "tier": "silver",
        "status": "active",
        "pmpm": 694.4,
        "mlr": 76.3,
        "yoy_trend": 1.8,
        "rx_status": "analyzed",
        "rx_score": 72,
        "sl_status": "none",
        "sl_score": None,
        "open_actions": 1,
        "docs_uploaded": 3,
        "docs_required": 4,
        "notes": "Strong year. Lowest MLR in book. Explore stop-loss market for competitive quotes.",
        "contact_name": "Diana Park",
        "contact_title": "Controller",
        "contact_email": "dpark@atlaslogistics.com",
    },
    {
        "id": "c6",
        "name": "Lakeside Manufacturing Co.",
        "industry": "Manufacturing",
        "employees": 340,
        "annual_spend": 2_900_000,
        "plan_type": "Fully-Insured",
        "tpa": "BlueCross BlueShield",
        "pbm": "Express Scripts",
        "sl_carrier": "N/A",
        "renewal_date": "2026-07-01",
        "city": "Detroit",
        "state": "MI",
        "risk_score": 4.2,
        "health_score": 79,
        "tier": "gold",
        "status": "active",
        "pmpm": 710.8,
        "mlr": 78.1,
        "yoy_trend": 3.1,
        "rx_status": "none",
        "rx_score": None,
        "sl_status": "none",
        "sl_score": None,
        "open_actions": 1,
        "docs_uploaded": 1,
        "docs_required": 3,
        "notes": "Moving to self-funded at renewal — strategy memo drafted. Strong candidate for Kincaid IQ upgrade.",
        "contact_name": "Robert Chen",
        "contact_title": "President",
        "contact_email": "rchen@lakesidemanufacturing.com",
    },
    {
        "id": "c7",
        "name": "Cornerstone Law Group",
        "industry": "Legal Services",
        "employees": 95,
        "annual_spend": 940_000,
        "plan_type": "Level-Funded",
        "tpa": "Meritain Health",
        "pbm": "Prime Therapeutics",
        "sl_carrier": "Meritain / Aetna",
        "renewal_date": "2026-07-15",
        "city": "Chicago",
        "state": "IL",
        "risk_score": 3.1,
        "health_score": 85,
        "tier": "silver",
        "status": "active",
        "pmpm": 823.0,
        "mlr": 81.5,
        "yoy_trend": 5.7,
        "rx_status": "none",
        "rx_score": None,
        "sl_status": "analyzed",
        "sl_score": 78,
        "open_actions": 0,
        "docs_uploaded": 2,
        "docs_required": 3,
        "notes": "Smooth account. Stop-loss renewal early. Rx contract upload pending.",
        "contact_name": "Angela Morrison",
        "contact_title": "Managing Partner",
        "contact_email": "amorrison@cornerstonelaw.com",
    },
    {
        "id": "c8",
        "name": "Clearwater Tech Solutions",
        "industry": "Technology",
        "employees": 180,
        "annual_spend": 1_620_000,
        "plan_type": "Fully-Insured",
        "tpa": "Anthem",
        "pbm": "IngenioRx",
        "sl_carrier": "N/A",
        "renewal_date": "2026-08-01",
        "city": "Minneapolis",
        "state": "MN",
        "risk_score": 2.8,
        "health_score": 88,
        "tier": "silver",
        "status": "prospect",
        "pmpm": 750.0,
        "mlr": 79.0,
        "yoy_trend": 4.2,
        "rx_status": "none",
        "rx_score": None,
        "sl_status": "none",
        "sl_score": None,
        "open_actions": 1,
        "docs_uploaded": 0,
        "docs_required": 4,
        "notes": "New prospect — converting from Anthem fully-insured. First document request sent.",
        "contact_name": "Kevin O'Brien",
        "contact_title": "COO",
        "contact_email": "kobrien@clearwatertech.io",
    },
    {
        "id": "c9",
        "name": "Summit Hospitality Group",
        "industry": "Hospitality",
        "employees": 510,
        "annual_spend": 4_100_000,
        "plan_type": "Self-Funded",
        "tpa": "Symetra Life",
        "pbm": "CVS Caremark",
        "sl_carrier": "Berkley Accident & Health",
        "renewal_date": "2026-08-20",
        "city": "Denver",
        "state": "CO",
        "risk_score": 6.1,
        "health_score": 66,
        "tier": "gold",
        "status": "active",
        "pmpm": 670.0,
        "mlr": 84.0,
        "yoy_trend": 7.3,
        "rx_status": "pending",
        "rx_score": None,
        "sl_status": "none",
        "sl_score": None,
        "open_actions": 2,
        "docs_uploaded": 2,
        "docs_required": 5,
        "notes": "Rx contract submitted — analysis in progress. Stop-loss contract requested from broker.",
        "contact_name": "Laura Patel",
        "contact_title": "Director of Benefits",
        "contact_email": "lpatel@summithospitality.com",
    },
    {
        "id": "c10",
        "name": "Riverdale Medical System",
        "industry": "Healthcare",
        "employees": 960,
        "annual_spend": 11_500_000,
        "plan_type": "Self-Funded",
        "tpa": "Meritain Health",
        "pbm": "OptumRx",
        "sl_carrier": "Sun Life Financial",
        "renewal_date": "2026-09-10",
        "city": "Houston",
        "state": "TX",
        "risk_score": 5.5,
        "health_score": 70,
        "tier": "platinum",
        "status": "active",
        "pmpm": 997.2,
        "mlr": 83.6,
        "yoy_trend": 5.8,
        "rx_status": "none",
        "rx_score": None,
        "sl_status": "none",
        "sl_score": None,
        "open_actions": 2,
        "docs_uploaded": 0,
        "docs_required": 6,
        "notes": "Large account — strategy session scheduled. Beginning 180-day renewal journey.",
        "contact_name": "Thomas Gill",
        "contact_title": "CFO",
        "contact_email": "tgill@riverdalemed.org",
    },
]


def _enrich(c: dict) -> dict:
    c = dict(c)
    c["days_to_renewal"] = _days_until(c.get("renewal_date", "9999"))
    return c


def _get_all_clients():
    return [_enrich(c) for c in DEMO_CLIENTS]


DEMO_DOCUMENTS = {
    "c1": [
        {"id": "d1", "name": "ES_RxContract_2024.pdf", "type": "Rx Contract", "size": "1.4 MB", "uploaded": "2026-02-12", "status": "analyzed", "score": 38},
        {"id": "d2", "name": "SunLife_StopLoss_2025.pdf", "type": "Stop-Loss Policy", "size": "2.1 MB", "uploaded": "2026-02-18", "status": "analyzed", "score": 44},
        {"id": "d3", "name": "MRH_Census_2026.xlsx", "type": "Census", "size": "0.3 MB", "uploaded": "2026-02-20", "status": "complete", "score": None},
        {"id": "d4", "name": "Trustmark_TPA_Agreement.pdf", "type": "TPA Agreement", "size": "3.2 MB", "uploaded": "2026-02-22", "status": "complete", "score": None},
    ],
    "c2": [
        {"id": "d1", "name": "OptumRx_PBMContract.pdf", "type": "Rx Contract", "size": "2.0 MB", "uploaded": "2026-02-28", "status": "analyzed", "score": 31},
        {"id": "d2", "name": "HCU_Census_Q4_2025.xlsx", "type": "Census", "size": "0.2 MB", "uploaded": "2026-03-02", "status": "complete", "score": None},
    ],
    "c3": [
        {"id": "d1", "name": "Caremark_Contract_2024.pdf", "type": "Rx Contract", "size": "1.8 MB", "uploaded": "2026-01-15", "status": "analyzed", "score": 55},
        {"id": "d2", "name": "Voya_StopLoss_Renewal.pdf", "type": "Stop-Loss Policy", "size": "2.4 MB", "uploaded": "2026-01-20", "status": "analyzed", "score": 60},
        {"id": "d3", "name": "SVSD_TPA_Agreement.pdf", "type": "TPA Agreement", "size": "4.1 MB", "uploaded": "2026-01-22", "status": "complete", "score": None},
        {"id": "d4", "name": "SVSD_Census_Jan2026.xlsx", "type": "Census", "size": "0.5 MB", "uploaded": "2026-01-25", "status": "complete", "score": None},
        {"id": "d5", "name": "ClinicalReview_Summary.pdf", "type": "Clinical Report", "size": "0.8 MB", "uploaded": "2026-02-01", "status": "complete", "score": None},
    ],
    "c4": [
        {"id": "d1", "name": "MedImpact_PBM_2024.pdf", "type": "Rx Contract", "size": "1.6 MB", "uploaded": "2026-01-10", "status": "analyzed", "score": 67},
        {"id": "d2", "name": "SunLife_LevelFunded.pdf", "type": "Stop-Loss Policy", "size": "1.9 MB", "uploaded": "2026-01-12", "status": "analyzed", "score": 72},
        {"id": "d3", "name": "PRG_TPA_Agreement.pdf", "type": "TPA Agreement", "size": "2.8 MB", "uploaded": "2026-01-14", "status": "complete", "score": None},
        {"id": "d4", "name": "PRG_Census_2026.xlsx", "type": "Census", "size": "0.3 MB", "uploaded": "2026-01-16", "status": "complete", "score": None},
        {"id": "d5", "name": "RenewalProposal_2026.pdf", "type": "Proposal", "size": "0.9 MB", "uploaded": "2026-02-20", "status": "complete", "score": None},
    ],
}

ACTIVITY_FEED = [
    {"time": "2h ago",  "type": "analysis",  "client": "Midwest Regional Hospital",   "msg": "Rx Defense IQ™ analysis complete — score 38/100"},
    {"time": "4h ago",  "type": "upload",    "client": "Summit Hospitality Group",     "msg": "Rx contract uploaded and queued for analysis"},
    {"time": "6h ago",  "type": "alert",     "client": "Heritage Credit Union",        "msg": "Renewal in 46 days — stop-loss contract not yet uploaded"},
    {"time": "1d ago",  "type": "milestone", "client": "Sun Valley School District",   "msg": "Stage 5 complete: Stop-Loss Strategy finalized"},
    {"time": "1d ago",  "type": "analysis",  "client": "Heritage Credit Union",        "msg": "Rx Defense IQ™ score 31/100 — 3 critical provisions missing"},
    {"time": "2d ago",  "type": "upload",    "client": "Cornerstone Law Group",        "msg": "Stop-loss policy uploaded — analysis complete"},
    {"time": "2d ago",  "type": "milestone", "client": "Midwest Regional Hospital",    "msg": "Decision Support meeting scheduled for March 28"},
    {"time": "3d ago",  "type": "alert",     "client": "Pinnacle Retail Group",        "msg": "Rebate pass-through gap identified — negotiation memo issued"},
    {"time": "3d ago",  "type": "upload",    "client": "Lakeside Manufacturing Co.",   "msg": "Strategy memo uploaded — self-funded transition plan ready"},
    {"time": "5d ago",  "type": "analysis",  "client": "Sun Valley School District",   "msg": "Stop-Loss IQ™ score 60/100 — 125% corridor confirmed"},
]


@router.get("/dashboard")
def broker_dashboard(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    clients = _get_all_clients()
    total_lives = sum(c["employees"] for c in clients)
    total_premium = sum(c["annual_spend"] for c in clients)
    avg_risk = round(sum(c.get("risk_score", 0) for c in clients) / max(len(clients), 1), 1)
    renewals_30d = [c for c in clients if 0 < c["days_to_renewal"] <= 30]
    renewals_60d = [c for c in clients if 30 < c["days_to_renewal"] <= 60]
    renewals_90d = [c for c in clients if 60 < c["days_to_renewal"] <= 90]
    pending_docs = sum(1 for c in clients if c["docs_uploaded"] < c["docs_required"])
    pending_analysis = sum(1 for c in clients if c["rx_status"] == "pending" or c["sl_status"] == "pending")
    open_actions = sum(c.get("open_actions", 0) for c in clients)

    return {
        "broker": {
            "name": "Jeremiah Shrack",
            "firm": "Kincaid RMC",
            "title": "Senior Benefits Consultant",
            "account": "SHRACK-7742",
        },
        "summary": {
            "total_clients": len(clients),
            "active_clients": len([c for c in clients if c.get("status") == "active"]),
            "total_lives": total_lives,
            "total_premium_bor": total_premium,
            "avg_risk_score": avg_risk,
            "renewals_30d": len(renewals_30d),
            "renewals_60d": len(renewals_60d),
            "renewals_90d": len(renewals_90d),
            "pending_docs": pending_docs,
            "pending_analysis": pending_analysis,
            "open_actions": open_actions,
            "avg_pmpm": round(total_premium / max(total_lives * 12, 1), 2),
            "avg_health_score": round(sum(c.get("health_score", 75) for c in clients) / max(len(clients), 1)),
        },
        "clients": sorted(clients, key=lambda c: c.get("days_to_renewal", 999)),
        "revenue_trend": [
            {"month": "Sep 25", "commission": 52_100},
            {"month": "Oct 25", "commission": 54_800},
            {"month": "Nov 25", "commission": 51_200},
            {"month": "Dec 25", "commission": 57_400},
            {"month": "Jan 26", "commission": 61_000},
            {"month": "Feb 26", "commission": 58_700},
            {"month": "Mar 26", "commission": 63_200},
        ],
        "risk_distribution": [
            {"band": "Low Risk (0–3.9)",    "count": len([c for c in clients if c["risk_score"] < 4]),   "pct": round(len([c for c in clients if c["risk_score"] < 4]) / len(clients) * 100)},
            {"band": "Medium Risk (4–6.9)", "count": len([c for c in clients if 4 <= c["risk_score"] < 7]), "pct": round(len([c for c in clients if 4 <= c["risk_score"] < 7]) / len(clients) * 100)},
            {"band": "High Risk (7+)",      "count": len([c for c in clients if c["risk_score"] >= 7]),  "pct": round(len([c for c in clients if c["risk_score"] >= 7]) / len(clients) * 100)},
        ],
        "activity_feed": ACTIVITY_FEED,
    }


@router.get("/clients/{client_id}")
def get_client(client_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    client = next((c for c in DEMO_CLIENTS if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    c = _enrich(dict(client))
    c["timeline"] = _timeline_stages(c["days_to_renewal"])
    c["documents"] = DEMO_DOCUMENTS.get(client_id, [])
    return c


# ─── NAICS → INDUSTRY LABEL ──────────────────────────────────────────────────

NAICS_MAP = {
    "11": "Agriculture / Forestry",
    "21": "Mining / Oil & Gas",
    "22": "Utilities",
    "23": "Construction",
    "31": "Manufacturing",
    "32": "Manufacturing",
    "33": "Manufacturing",
    "42": "Wholesale Trade",
    "44": "Retail",
    "45": "Retail",
    "48": "Transportation",
    "49": "Transportation / Warehousing",
    "51": "Information Technology",
    "52": "Finance & Insurance",
    "53": "Real Estate",
    "54": "Professional Services",
    "55": "Management",
    "56": "Administrative Services",
    "61": "Education",
    "62": "Healthcare / Social Assistance",
    "71": "Arts & Entertainment",
    "72": "Hospitality / Food Service",
    "81": "Other Services / Nonprofit",
    "92": "Government",
}

NAICS_DETAIL = {
    "611000": "Educational Services",
    "621111": "Physician Offices",
    "621610": "Home Health Services",
    "622000": "Hospitals",
    "623000": "Nursing & Residential Care",
    "624100": "Social Assistance",
    "326100": "Plastics Manufacturing",
    "336300": "Motor Vehicle Parts Mfg",
    "332900": "Fabricated Metal Mfg",
    "339900": "Miscellaneous Manufacturing",
    "321900": "Wood Product Manufacturing",
    "441110": "Auto Dealers",
    "441300": "Auto Parts & Accessories",
    "238220": "Plumbing & HVAC Contractors",
    "238210": "Electrical Contractors",
    "238900": "Specialty Trade Contractors",
    "236200": "Commercial Construction",
    "541600": "Management Consulting",
    "541330": "Engineering Services",
    "541990": "Other Professional Services",
    "813000": "Religious / Civic Organizations",
}

INDUSTRY_QUIZ_MAP = {
    "healthcare":     ["62"],
    "manufacturing":  ["31", "32", "33"],
    "education":      ["61"],
    "professional":   ["54", "55", "56"],
    "retail":         ["44", "45"],
    "construction":   ["23"],
    "nonprofit":      ["81"],
    "government":     ["92"],
    "finance":        ["52"],
    "hospitality":    ["72"],
    "tech":           ["51"],
    "transportation": ["48", "49"],
}

# ─── TENNESSEE METRO REGIONS ─────────────────────────────────────────────────

METRO_REGIONS = {
    "nashville": {
        "label": "Nashville Metro",
        "cities": [
            "NASHVILLE","BRENTWOOD","HENDERSONVILLE","GALLATIN","MT. JULIET",
            "LEBANON","ANTIOCH","MADISON","GOODLETTSVILLE","OLD HICKORY",
            "WHITES CREEK","HERMITAGE","DONELSON","BERRY HILL","FOREST HILLS",
        ],
        "map_x": 185, "map_y": 200,
    },
    "memphis": {
        "label": "Memphis",
        "cities": [
            "MEMPHIS","GERMANTOWN","BARTLETT","COLLIERVILLE","CORDOVA",
            "MILLINGTON","ARLINGTON","LAKELAND","SOUTHAVEN","HORN LAKE",
        ],
        "map_x": 52, "map_y": 215,
    },
    "knoxville": {
        "label": "Knoxville",
        "cities": [
            "KNOXVILLE","OAK RIDGE","MARYVILLE","ALCOA","MORRISTOWN",
            "SEVIERVILLE","LENOIR CITY","CLINTON","FARRAGUT","POWELL",
        ],
        "map_x": 310, "map_y": 185,
    },
    "chattanooga": {
        "label": "Chattanooga",
        "cities": [
            "CHATTANOOGA","CLEVELAND","SODDY-DAISY","HIXSON","COLLEGEDALE",
            "EAST RIDGE","RED BANK","SIGNAL MOUNTAIN","OOLTEWAH","RINGGOLD",
        ],
        "map_x": 282, "map_y": 295,
    },
    "tricities": {
        "label": "Tri-Cities",
        "cities": [
            "JOHNSON CITY","KINGSPORT","BRISTOL","ELIZABETHTON","GREENEVILLE",
            "JONESBOROUGH","ROGERSVILLE","ERWIN","MOUNTAIN CITY",
        ],
        "map_x": 338, "map_y": 128,
    },
    "clarksville": {
        "label": "Clarksville",
        "cities": [
            "CLARKSVILLE","ADAMS","ASHLAND CITY","DICKSON","ERIN","DOVER",
            "SPRINGFIELD","PORTLAND","WHITE HOUSE",
        ],
        "map_x": 128, "map_y": 118,
    },
    "jackson": {
        "label": "Jackson",
        "cities": [
            "JACKSON","DYERSBURG","BROWNSVILLE","HUMBOLDT","UNION CITY",
            "MARTIN","PARIS","MILAN","BOLIVAR","TRENTON","JACKSON",
        ],
        "map_x": 95, "map_y": 215,
    },
    "murfreesboro": {
        "label": "Murfreesboro / Franklin",
        "cities": [
            "MURFREESBORO","FRANKLIN","SPRING HILL","SMYRNA","LA VERGNE",
            "SHELBYVILLE","TULLAHOMA","LAWRENCEBURG","WAVERLY","COLUMBIA",
        ],
        "map_x": 215, "map_y": 248,
    },
}

METRO_CITIES: dict[str, str] = {}
for _mk, _mv in METRO_REGIONS.items():
    for _c in _mv["cities"]:
        METRO_CITIES[_c] = _mk


def _city_to_metro(city: str) -> str:
    return METRO_CITIES.get((city or "").upper().strip(), "other")


def _metro_label(metro_key: str) -> str:
    region = METRO_REGIONS.get(metro_key)
    return region["label"] if region else "Other Tennessee"


def _naics_label(code: str) -> str:
    if not code:
        return "General Industry"
    detail = NAICS_DETAIL.get(str(code), "")
    if detail:
        return detail
    prefix = str(code)[:2]
    return NAICS_MAP.get(prefix, "General Industry")


# ─── BOOK PROFILE ─────────────────────────────────────────────────────────────

def _book_profile():
    """Derive a broker profile from the demo book of business."""
    clients = _get_all_clients()
    avg_employees = round(sum(c["employees"] for c in clients) / len(clients))
    industries_raw = [c["industry"] for c in clients]

    # Map demo industry labels → NAICS prefixes
    industry_naics = {
        "Healthcare": "62", "Education": "61", "Manufacturing": "33",
        "Financial Services": "52", "Transportation": "48",
        "Retail": "44", "Technology": "51", "Legal Services": "54",
        "Hospitality": "72",
    }
    top_naics = list({industry_naics.get(i, "54") for i in industries_raw})

    plan_type_majority = "Self-Funded"
    avg_mlr = round(sum(c["mlr"] for c in clients) / len(clients), 1)
    avg_risk = round(sum(c["risk_score"] for c in clients) / len(clients), 1)

    return {
        "avg_employees": avg_employees,
        "min_employees": int(avg_employees * 0.3),
        "max_employees": int(avg_employees * 2.5),
        "top_naics": top_naics,
        "plan_type": plan_type_majority,
        "avg_mlr": avg_mlr,
        "avg_risk": avg_risk,
        "total_clients": len(clients),
    }


# ─── 6-FACTOR PROSPECT SCORING ENGINE ────────────────────────────────────────

LARGE_CARRIERS = {
    "ANTHEM", "BLUE CROSS", "BCBS", "CIGNA", "AETNA", "UNITED",
    "HUMANA", "KAISER", "MOLINA", "CENTENE", "WELLPOINT", "HIGHMARK",
}

SIZE_BANDS = {
    "small":      (50, 199),
    "midmarket":  (200, 499),
    "large":      (500, 999),
    "enterprise": (1000, 9999),
}


def _is_large_carrier(carriers: list) -> bool:
    for c in (carriers or []):
        for k in LARGE_CARRIERS:
            if k in (c or "").upper():
                return True
    return False


def _size_component(participants: int, target_sizes: list) -> float:
    """25% weight — how well participant count matches target size bands."""
    if not target_sizes or "any" in target_sizes:
        return 75.0
    for band in target_sizes:
        lo, hi = SIZE_BANDS.get(band, (0, 9999))
        if lo <= participants <= hi:
            return 100.0
    # Partial credit for adjacent bands
    best = 0.0
    for band in target_sizes:
        lo, hi = SIZE_BANDS.get(band, (0, 9999))
        if participants < lo:
            gap = lo - participants
            best = max(best, max(0, 70 - (gap / lo) * 60))
        else:
            gap = participants - hi
            best = max(best, max(0, 70 - (gap / hi) * 60))
    return best


def _industry_component(naics_prefix: str, target_naics: list) -> float:
    """20% weight — industry alignment."""
    if not target_naics:
        return 65.0
    if naics_prefix in target_naics:
        return 100.0
    # Check 1-digit similarity
    if any(naics_prefix[0] == n[0] for n in target_naics):
        return 50.0
    return 30.0


def _geo_component(metro: str, target_metros: list) -> float:
    """15% weight — Tennessee geography alignment."""
    if not target_metros or "any" in target_metros:
        return 70.0
    if metro in target_metros:
        return 100.0
    if metro == "other":
        return 35.0
    return 45.0


def _renewal_component(form_year: int, sales_motion: str) -> float:
    """15% weight — renewal timing fit."""
    # 2022 filer → ~2024-2025 renewal cycle: may be in market NOW
    # 2023 filer → ~2025-2026 renewal cycle: 6-12 months out
    if sales_motion == "quickwins":
        return 95.0 if form_year == 2022 else 60.0
    elif sales_motion == "strategic":
        return 90.0 if form_year == 2023 else 65.0
    elif sales_motion == "disruption":
        # Disruption works on any renewal cycle
        return 78.0
    return 70.0


def _service_component(welfare_codes: str, has_sl: bool, carriers: list, service_wedge: str) -> float:
    """15% weight — service fit with stated wedge."""
    has_health = bool(welfare_codes and "4A" in welfare_codes)
    has_rx_code = bool(welfare_codes and ("4Q" in welfare_codes or "4D" in welfare_codes))
    big_carrier = _is_large_carrier(carriers)

    if service_wedge == "rx":
        if has_health and has_rx_code:
            return 95.0
        if has_health:
            return 80.0  # Rx likely embedded
        return 40.0
    elif service_wedge == "stoploss":
        if has_health and not has_sl:
            return 100.0  # Perfect gap
        if has_health and has_sl:
            return 50.0   # Incumbent to displace
        return 30.0
    elif service_wedge == "fullrenewal":
        return 85.0 if has_health else 30.0
    elif service_wedge == "plandesign":
        return 90.0 if big_carrier else 70.0
    return 70.0  # any


def _whitespace_component(naics_prefix: str, participants: int, profile: dict) -> float:
    """10% weight — adjacency / whitespace opportunity."""
    book_naics = profile.get("top_naics", [])
    avg_emp = profile.get("avg_employees", 400)

    # Bonus for adjacent industries not already in book
    if naics_prefix not in book_naics:
        adjacency = 85.0  # Whitespace!
    else:
        adjacency = 65.0  # Proven segment but already penetrated

    # Bonus for larger accounts than current book avg
    if participants > avg_emp * 1.5:
        adjacency = min(adjacency + 10, 100)

    return adjacency


def _score_prospect(
    participants: int, naics_prefix: str, metro: str,
    welfare_codes: str, has_sl: bool, carriers: list,
    form_year: int, target_sizes: list, target_naics: list,
    target_metros: list, service_wedge: str, sales_motion: str, profile: dict,
) -> tuple[int, dict]:
    s = _size_component(participants, target_sizes)         * 0.25
    i = _industry_component(naics_prefix, target_naics)    * 0.20
    g = _geo_component(metro, target_metros)                * 0.15
    r = _renewal_component(form_year, sales_motion)         * 0.15
    sv = _service_component(welfare_codes, has_sl, carriers, service_wedge) * 0.15
    w = _whitespace_component(naics_prefix, participants, profile)           * 0.10

    total = s + i + g + r + sv + w
    breakdown = {
        "size_match":    round(s / 0.25),
        "industry_match": round(i / 0.20),
        "geography":     round(g / 0.15),
        "renewal_timing": round(r / 0.15),
        "service_fit":   round(sv / 0.15),
        "whitespace":    round(w / 0.10),
    }
    return int(min(total, 99)), breakdown


def _fit_flags(
    participants: int, welfare_codes: str, has_sl: bool,
    carriers: list, form_year: int, service_wedge: str,
) -> list[str]:
    flags = []
    if welfare_codes and "4A" in welfare_codes and not has_sl:
        flags.append("stop_loss_gap")
    if welfare_codes and ("4Q" in welfare_codes or "4D" in welfare_codes):
        flags.append("rx_opportunity")
    elif welfare_codes and "4A" in welfare_codes:
        flags.append("rx_opportunity")  # Rx likely embedded, not separately brokered
    if participants >= 500:
        flags.append("high_value_strategic")
    if _is_large_carrier(carriers):
        flags.append("disruption_target")
    if form_year == 2022:
        flags.append("likely_fast_close")
    if welfare_codes and len(welfare_codes) > 8:
        flags.append("full_renewal_support")
    return flags


def _opening_angle(
    welfare_codes: str, has_sl: bool, carriers: list,
    participants: int, industry: str, service_wedge: str, form_year: int,
) -> str:
    if not has_sl and welfare_codes and "4A" in welfare_codes:
        return (
            "Lead with stop-loss gap — active health plan with no stop-loss carrier on Schedule A filing. "
            "Frame conversation around ERISA fiduciary exposure and CAA 2026 aggregate protection requirements."
        )
    if _is_large_carrier(carriers):
        carrier = next((c for c in carriers if any(k in c.upper() for k in LARGE_CARRIERS)), carriers[0] if carriers else "incumbent carrier")
        return (
            f"Benchmark against {carrier} — large national carrier contracts typically carry 12–22% administrative "
            "overhead that self-funded structures eliminate. Lead with a side-by-side cost comparison."
        )
    if welfare_codes and ("4Q" in welfare_codes or "4D" in welfare_codes):
        return (
            "Open with Rx fiduciary review — prescription drug benefit code present but no separate Rx contract "
            "filed. Spread pricing and rebate pass-through gaps are likely unexamined. Position Rx Defense IQ™ "
            "as a complimentary compliance audit."
        )
    if form_year == 2022:
        return (
            "Renewal window intelligence suggests this account is actively in renewal discussions based on filing "
            "cycle. Introduce yourself as an independent fiduciary advisor with a complimentary CAA 2026 readiness review."
        )
    return (
        "Position as independent fiduciary advisor — offer a complimentary CAA 2026 compliance review "
        f"targeting the {industry} segment. Request current renewal terms to frame a benchmarking conversation."
    )


def _why_this_account(
    participants: int, naics_prefix: str, metro: str,
    welfare_codes: str, has_sl: bool, carriers: list,
    score: int, breakdown: dict, target_sizes: list, target_naics: list,
    target_metros: list, service_wedge: str, profile: dict,
) -> list[str]:
    reasons = []
    industry = NAICS_MAP.get(naics_prefix, "General Industry")
    avg_emp = profile.get("avg_employees", 400)

    # Size
    if breakdown.get("size_match", 0) >= 80:
        size_label = "small" if participants < 200 else "mid-market" if participants < 500 else "large"
        reasons.append(
            f"Matches your target size band — {participants:,} participants aligns with your stated focus on "
            f"{size_label} accounts (closest to your book avg of {avg_emp:,})."
        )

    # Industry
    if breakdown.get("industry_match", 0) >= 80:
        reasons.append(
            f"Industry alignment: {industry} segment is within your stated focus area — "
            "proven delivery track record and referral network apply."
        )
    elif breakdown.get("industry_match", 0) >= 50:
        reasons.append(
            f"Adjacent industry opportunity: {industry} is close to your current book mix — "
            "transferable expertise with whitespace upside."
        )

    # Geography
    metro_label = _metro_label(metro)
    if metro != "other" and breakdown.get("geography", 0) >= 80:
        reasons.append(
            f"Tennessee geography match: {metro_label} — within your preferred service territory "
            "and existing relationship network."
        )

    # Service gaps
    if not has_sl and welfare_codes and "4A" in welfare_codes:
        reasons.append(
            "Stop-Loss Opportunity Signal: active health plan with no stop-loss carrier on Schedule A. "
            "SiriusB Stop-Loss IQ™ review likely to surface immediate value."
        )

    if welfare_codes and ("4Q" in welfare_codes or "4A" in welfare_codes):
        reasons.append(
            "Rx Opportunity Signal: health/prescription benefit codes present — "
            "Rx Defense IQ™ PBM audit likely to identify spread pricing and rebate gaps."
        )

    # Large carrier disruption
    if _is_large_carrier(carriers):
        carrier = next((c for c in carriers if any(k in c.upper() for k in LARGE_CARRIERS)), "incumbent carrier")
        reasons.append(
            f"Disruption opportunity: currently with {carrier}, a large national carrier. "
            "These contracts routinely contain 12–22% overhead that self-funded structures eliminate."
        )

    # Renewal timing
    if breakdown.get("renewal_timing", 0) >= 85:
        reasons.append(
            "Renewal window intelligence: based on Form 5500 filing year, this account is likely "
            "entering a renewal window in the next 90–180 days — ideal outreach timing."
        )

    return reasons[:5]


# ─── PROSPECTS ENDPOINT (v2 — 6-Factor) ──────────────────────────────────────

@router.get("/prospects")
async def get_prospects(
    mode: str = Query("book"),
    min_size: int = Query(50),
    max_size: int = Query(5000),
    industries: str = Query(""),
    metros: str = Query(""),
    service_wedge: str = Query("any"),
    sales_motion: str = Query("any"),
    plan_focus: str = Query("any"),
    limit: int = Query(20, ge=5, le=500),
    state: str = Query("TN"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    profile = _book_profile()

    if mode == "book":
        q_min = profile["min_employees"]
        q_max = profile["max_employees"]
        target_naics = profile["top_naics"]
        target_metros = []   # all metros in book mode
        t_service = "any"
        t_motion = "any"
        target_sizes = []
    else:
        q_min = max(min_size, 30)
        q_max = max_size
        target_naics = [x.strip() for x in industries.split(",") if x.strip()]
        target_metros = [x.strip() for x in metros.split(",") if x.strip()]
        t_service = service_wedge
        t_motion = sales_motion
        target_sizes = []

    state = (state or "TN").strip().upper()[:2]
    sql = text("""
        SELECT DISTINCT ON (ein)
            sponsor_name, city, ein, business_code,
            participants, welfare_benefit_codes, form_year, ack_id
        FROM f5500_filings
        WHERE state = :state
          AND form_year IN (2022, 2023)
          AND welfare_benefit_codes IS NOT NULL
          AND welfare_benefit_codes LIKE '%4A%'
          AND participants IS NOT NULL
          AND participants BETWEEN :min_p AND :max_p
          AND participants <= 15000
        ORDER BY ein, form_year DESC, participants DESC
        LIMIT 2500
    """)
    rows = db.execute(sql, {"min_p": q_min, "max_p": q_max, "state": state}).fetchall()

    if not rows:
        return {"prospects": [], "profile": profile, "total_found": 0, "metro_distribution": []}

    ack_ids = [r.ack_id for r in rows if r.ack_id]
    sch_a_map: dict[str, dict] = {}
    if ack_ids:
        sch_sql = text("""
            SELECT ack_id,
                   array_agg(DISTINCT carrier_name) FILTER (WHERE carrier_name IS NOT NULL) AS carriers,
                   bool_or(is_stop_loss)  AS has_sl,
                   COALESCE(MAX(broker_commissions), 0) AS broker_comm
            FROM f5500_schedule_a
            WHERE ack_id = ANY(:ids)
            GROUP BY ack_id
        """)
        for sr in db.execute(sch_sql, {"ids": ack_ids}).fetchall():
            sch_a_map[sr.ack_id] = {
                "carriers":    sr.carriers or [],
                "has_sl":      sr.has_sl or False,
                "broker_comm": float(sr.broker_comm or 0),
            }

    existing_eins: set = set()
    metro_tally: dict[str, list] = {}
    prospects_raw = []

    for r in rows:
        naics_prefix = str(r.business_code or "")[:2]
        metro = _city_to_metro(r.city or "")

        if r.ein in existing_eins:
            continue
        if target_naics and naics_prefix not in target_naics:
            continue
        # For Tennessee use metro-region keys; for other states treat metros as city names
        if target_metros and "any" not in target_metros:
            if state == "TN":
                if metro not in target_metros:
                    continue
            else:
                if (r.city or "").upper().strip() not in [m.upper() for m in target_metros]:
                    continue

        sch = sch_a_map.get(r.ack_id or "", {})
        has_sl   = sch.get("has_sl", False)
        carriers = sch.get("carriers", [])
        broker_comm = sch.get("broker_comm", 0.0)

        if plan_focus == "stop_loss_gap" and has_sl:
            continue

        # For non-TN states, city filtering already done above; pass "any" to geo scorer
        score_metros = target_metros if state == "TN" else (["any"] if target_metros else [])
        score, breakdown = _score_prospect(
            participants=r.participants or 100,
            naics_prefix=naics_prefix,
            metro=metro,
            welfare_codes=r.welfare_benefit_codes or "",
            has_sl=has_sl,
            carriers=carriers,
            form_year=r.form_year or 2023,
            target_sizes=target_sizes,
            target_naics=target_naics,
            target_metros=score_metros,
            service_wedge=t_service,
            sales_motion=t_motion,
            profile=profile,
        )

        flags = _fit_flags(r.participants or 100, r.welfare_benefit_codes or "", has_sl, carriers, r.form_year or 2023, t_service)
        industry_label = _naics_label(str(r.business_code or ""))
        angle = _opening_angle(r.welfare_benefit_codes or "", has_sl, carriers, r.participants or 100, industry_label, t_service, r.form_year or 2023)
        why_list = _why_this_account(
            participants=r.participants or 100,
            naics_prefix=naics_prefix,
            metro=metro,
            welfare_codes=r.welfare_benefit_codes or "",
            has_sl=has_sl,
            carriers=carriers,
            score=score,
            breakdown=breakdown,
            target_sizes=target_sizes,
            target_naics=target_naics,
            target_metros=target_metros,
            service_wedge=t_service,
            profile=profile,
        )

        est_comm = broker_comm if broker_comm > 500 else round((r.participants or 100) * 65 * (1 + (score - 50) / 100), -2)

        prospect = {
            "sponsor_name":   r.sponsor_name,
            "city":           r.city or state,
            "state":          state,
            "ein":            r.ein,
            "industry":       industry_label,
            "naics_code":     str(r.business_code or ""),
            "participants":   r.participants,
            "form_year":      r.form_year,
            "metro_region":   metro,
            "metro_label":    _metro_label(metro),
            "welfare_codes":  r.welfare_benefit_codes or "",
            "carriers":       carriers[:3],
            "has_stop_loss":  has_sl,
            "match_score":    score,
            "score_breakdown": breakdown,
            "fit_flags":      flags,
            "opening_angle":  angle,
            "why_this_account": why_list,
            "est_commission": int(est_comm),
            "broker_comm_actual": int(broker_comm) if broker_comm > 500 else 0,
        }
        prospects_raw.append(prospect)

        # Track metro distribution
        if metro not in metro_tally:
            metro_tally[metro] = []
        metro_tally[metro].append(score)

    prospects_raw.sort(key=lambda x: x["participants"] or 0, reverse=True)
    prospects_out = prospects_raw[:limit]

    # Enrich with EDGAR public-company + trigger intelligence
    try:
        sponsor_names = [p["sponsor_name"] for p in prospects_out if p.get("sponsor_name")]
        edgar_data = await edgar_enrich(sponsor_names)
        for p in prospects_out:
            p["edgar"] = edgar_data.get(p["sponsor_name"], {"is_public": False})
    except Exception as _e:
        for p in prospects_out:
            p.setdefault("edgar", {"is_public": False})

    metro_distribution = []
    for mk, scores in sorted(metro_tally.items(), key=lambda x: -len(x[1])):
        region = METRO_REGIONS.get(mk, {})
        metro_distribution.append({
            "key":    mk,
            "label":  _metro_label(mk),
            "count":  len(scores),
            "avg_score": round(sum(scores) / len(scores)),
            "map_x":  region.get("map_x", 185),
            "map_y":  region.get("map_y", 245),
        })

    total_opp = sum(p["est_commission"] for p in prospects_out)
    sl_gaps   = sum(1 for p in prospects_out if "stop_loss_gap" in p["fit_flags"])
    rx_opps   = sum(1 for p in prospects_out if "rx_opportunity" in p["fit_flags"])

    return {
        "prospects":         prospects_out,
        "profile":           profile,
        "total_found":       len(prospects_raw),
        "metro_distribution": metro_distribution,
        "summary": {
            "shown":           len(prospects_out),
            "total_opportunity": total_opp,
            "stop_loss_gaps":  sl_gaps,
            "rx_opportunities": rx_opps,
            "avg_match_score": round(sum(p["match_score"] for p in prospects_out) / max(len(prospects_out), 1)),
        },
    }


# ─── OVERVIEW ────────────────────────────────────────────────────────────────

STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}

@router.get("/overview")
def get_overview(
    state: str = Query("TN"),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    state = (state or "TN").strip().upper()[:2]
    state_name = STATE_NAMES.get(state, state)

    sql = text("""
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN participants >= 100 THEN 1 ELSE 0 END) AS recommended
        FROM f5500_filings
        WHERE state = :state
          AND form_year IN (2022, 2023)
          AND welfare_benefit_codes IS NOT NULL
          AND welfare_benefit_codes LIKE '%%4A%%'
          AND participants IS NOT NULL
    """)
    row = db.execute(sql, {"state": state}).fetchone()
    total_prospects = row.total if row else 0
    recommended = row.recommended if row else 0

    renewal_sql = text("""
        SELECT COUNT(*) AS cnt
        FROM f5500_filings
        WHERE state = :state
          AND form_year IN (2022, 2023)
          AND welfare_benefit_codes IS NOT NULL
          AND welfare_benefit_codes LIKE '%%4A%%'
          AND participants IS NOT NULL
          AND participants >= 50
    """)
    renewal_row = db.execute(renewal_sql, {"state": state}).fetchone()
    renewal_window_targets = min(int((renewal_row.cnt if renewal_row else 0) * 0.18), 999)

    sl_sql = text("""
        SELECT COUNT(DISTINCT f.ein) AS cnt
        FROM f5500_filings f
        LEFT JOIN f5500_schedule_a sa ON f.ack_id = sa.ack_id
        WHERE f.state = :state
          AND f.form_year IN (2022, 2023)
          AND f.welfare_benefit_codes LIKE '%%4A%%'
          AND f.participants >= 50
          AND (sa.is_stop_loss IS NULL OR sa.is_stop_loss = FALSE)
    """)
    sl_row = db.execute(sl_sql, {"state": state}).fetchone()
    sl_targets = sl_row.cnt if sl_row else 0

    rx_targets = int(total_prospects * 0.32)

    ticker_phrases = [
        f"{state_name} renewal watch: {renewal_window_targets} accounts inside 120-day window",
        f"{rx_targets} employers with potential Rx fiduciary exposure",
        f"{sl_targets} groups showing stop-loss coverage gaps",
        f"{total_prospects:,} {state_name} employers tracked in Form 5500 database",
        f"{recommended:,} accounts recommended for outreach this quarter",
        f"Healthcare vertical: high-complexity, high-value fiduciary opportunity",
        f"Self-funded plans dominate {state_name} mid-market — broker advisory gap detected",
    ]

    return {
        "total_prospects": total_prospects,
        "recommended": recommended,
        "renewal_window_targets": renewal_window_targets,
        "rx_targets": rx_targets,
        "sl_targets": sl_targets,
        "ticker_phrases": ticker_phrases,
        "state": state,
        "state_name": state_name,
    }


# ─── BOOK ANALYSIS ──────────────────────────────────────────────────────────

INDUSTRY_NAICS_MAP = {
    "Healthcare": "62", "Education": "61", "Manufacturing": "33",
    "Financial Services": "52", "Finance": "52", "Transportation": "48",
    "Retail": "44", "Technology": "51", "Legal Services": "54",
    "Professional Services": "54", "Hospitality": "72", "Food Service": "72",
    "Construction": "23", "Nonprofit": "81",
}

from pydantic import BaseModel

class BookClient(BaseModel):
    clientName: str
    industry: str
    employees: int
    annualSpend: int = 0
    planType: str = "Self-Funded"
    metro: str = "nashville"
    renewalMonth: int = 1

class BookAnalyzeRequest(BaseModel):
    clients: List[BookClient]


@router.post("/book/analyze")
def analyze_book(
    body: BookAnalyzeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    clients = body.clients
    if not clients:
        raise HTTPException(status_code=400, detail="At least one client is required")

    db.execute(text("DELETE FROM broker_books WHERE broker_id = 1"))
    for c in clients:
        db.execute(text("""
            INSERT INTO broker_books (broker_id, client_name, industry, employees, annual_spend, plan_type, metro, renewal_month)
            VALUES (1, :name, :industry, :employees, :spend, :plan_type, :metro, :renewal_month)
        """), {
            "name": c.clientName, "industry": c.industry, "employees": c.employees,
            "spend": c.annualSpend, "plan_type": c.planType, "metro": c.metro,
            "renewal_month": c.renewalMonth,
        })
    db.commit()

    total = len(clients)
    avg_employees = round(sum(c.employees for c in clients) / total)

    industry_counts: dict[str, int] = {}
    metro_counts: dict[str, int] = {}
    plan_counts: dict[str, int] = {}
    renewal_counts = [0] * 12

    for c in clients:
        industry_counts[c.industry] = industry_counts.get(c.industry, 0) + 1
        metro_counts[c.metro] = metro_counts.get(c.metro, 0) + 1
        plan_counts[c.planType] = plan_counts.get(c.planType, 0) + 1
        if 1 <= c.renewalMonth <= 12:
            renewal_counts[c.renewalMonth - 1] += 1

    industry_distribution = [
        {"name": name, "value": count, "pct": round(count / total * 100)}
        for name, count in sorted(industry_counts.items(), key=lambda x: -x[1])
    ]

    size_bands = [
        {"band": "Small (50-199)", "min": 50, "max": 199},
        {"band": "Mid-Market (200-499)", "min": 200, "max": 499},
        {"band": "Large (500-999)", "min": 500, "max": 999},
        {"band": "Enterprise (1000+)", "min": 1000, "max": 99999},
    ]
    size_distribution = [
        {"band": b["band"], "count": sum(1 for c in clients if b["min"] <= c.employees <= b["max"])}
        for b in size_bands
    ]

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    renewal_distribution = [{"month": months[i], "count": renewal_counts[i]} for i in range(12)]

    plan_type_breakdown = [{"type": t, "count": c} for t, c in plan_counts.items()]

    top_industries = [d["name"] for d in industry_distribution[:3]]
    top_metros = sorted(metro_counts.items(), key=lambda x: -x[1])[:2]
    top_metro_labels = [_metro_label(m[0]) for m in top_metros]

    all_metros = ["nashville", "memphis", "knoxville", "chattanooga", "tricities", "clarksville", "jackson", "murfreesboro"]
    underserved_metros = [m for m in all_metros if m not in metro_counts][:2]
    all_industries = ["Healthcare", "Manufacturing", "Construction", "Transportation", "Professional Services", "Finance", "Education", "Retail"]
    underserved_industries = [i for i in all_industries if i not in industry_counts][:2]

    insights = [
        {
            "type": "strength",
            "text": f"You win well in Tennessee self-funded accounts around {avg_employees} employees — {', '.join(top_industries)} {'are' if len(top_industries) > 1 else 'is'} your proven vertical{'s' if len(top_industries) > 1 else ''}.",
        },
        {
            "type": "gap",
            "text": (
                f"Your book has no presence in {' or '.join(_metro_label(m) for m in underserved_metros)} — significant untapped employer volume in these corridors."
                if underserved_metros else
                f"Your geographic coverage is broad — consider deepening penetration in your strongest metro: {', '.join(top_metro_labels)}."
            ),
        },
        {
            "type": "next",
            "text": f"Your next best target: a self-funded {underserved_industries[0].lower() if underserved_industries else top_industries[0].lower() if top_industries else 'manufacturing'} employer, {round(avg_employees * 0.8)}–{round(avg_employees * 1.3)} employees, renewing in the next 120 days{', ' + _metro_label(underserved_metros[0]) if underserved_metros else ''}.",
        },
    ]

    return {
        "profile": {
            "avgEmployees": avg_employees,
            "industries": industry_counts,
            "metros": metro_counts,
            "planTypes": plan_counts,
            "totalClients": total,
        },
        "industryDistribution": industry_distribution,
        "sizeDistribution": size_distribution,
        "renewalDistribution": renewal_distribution,
        "planTypeBreakdown": plan_type_breakdown,
        "insights": insights,
        "avgEmployees": avg_employees,
        "totalClients": total,
    }


# ─── SAVED LISTS ─────────────────────────────────────────────────────────────

def _ensure_saved_list_tables(db: Session):
    pass

class CreateListRequest(BaseModel):
    name: str

class RenameListRequest(BaseModel):
    name: str

class AddListItemRequest(BaseModel):
    prospectEin: str
    sponsorName: str = ""
    city: str = ""
    industry: str = ""
    participants: int = 0
    metroLabel: str = ""
    matchScore: int = 0
    notes: str = ""
    priority: str = "medium"


@router.get("/lists")
def get_saved_lists(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    lists = db.execute(text("""
        SELECT id, name, created_at FROM saved_prospect_lists
        WHERE broker_id = 1 ORDER BY created_at DESC
    """)).fetchall()

    result = []
    for l in lists:
        items = db.execute(text("""
            SELECT id, prospect_id, notes, priority, added_at,
                   sponsor_name, city, industry, participants, metro_label, ein, match_score, est_commission
            FROM saved_prospect_list_items
            WHERE list_id = :lid ORDER BY added_at DESC
        """), {"lid": l.id}).fetchall()

        item_data = []
        for item in items:
            item_data.append({
                "id": item.id,
                "prospectId": item.prospect_id,
                "notes": item.notes or "",
                "priority": item.priority or "medium",
                "addedAt": str(item.added_at) if item.added_at else None,
                "sponsorName": item.sponsor_name or "",
                "city": item.city or "",
                "industry": item.industry or "",
                "participants": item.participants or 0,
                "metroLabel": item.metro_label or "",
                "ein": item.ein or "",
                "matchScore": item.match_score or 0,
                "estCommission": item.est_commission or 0,
            })

        result.append({
            "id": l.id,
            "name": l.name,
            "createdAt": str(l.created_at) if l.created_at else None,
            "itemCount": len(item_data),
            "items": item_data,
        })

    return result


@router.post("/lists")
def create_saved_list(
    body: CreateListRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    result = db.execute(text("""
        INSERT INTO saved_prospect_lists (broker_id, name) VALUES (1, :name) RETURNING id, name, created_at
    """), {"name": body.name})
    db.commit()
    row = result.fetchone()
    return {"id": row.id, "name": row.name, "createdAt": str(row.created_at) if row.created_at else None, "itemCount": 0, "items": []}


@router.patch("/lists/{list_id}")
def rename_saved_list(
    list_id: int,
    body: RenameListRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    existing = db.execute(text("SELECT id FROM saved_prospect_lists WHERE id = :id AND broker_id = 1"), {"id": list_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="List not found")
    db.execute(text("UPDATE saved_prospect_lists SET name = :name WHERE id = :id AND broker_id = 1"), {"name": body.name, "id": list_id})
    db.commit()
    return {"id": list_id, "name": body.name}


@router.post("/lists/{list_id}/items")
def add_list_item(
    list_id: int,
    body: AddListItemRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    existing = db.execute(text("SELECT id FROM saved_prospect_lists WHERE id = :id AND broker_id = 1"), {"id": list_id}).fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="List not found")
    result = db.execute(text("""
        INSERT INTO saved_prospect_list_items
            (list_id, prospect_id, notes, priority, sponsor_name, city, industry,
             participants, metro_label, ein, match_score, est_commission)
        VALUES (:lid, 0, :notes, :priority, :sponsor_name, :city, :industry,
                :participants, :metro_label, :ein, :match_score, :est_commission)
        RETURNING id, added_at
    """), {
        "lid": list_id, "notes": body.notes, "priority": body.priority,
        "sponsor_name": body.sponsorName, "city": body.city, "industry": body.industry,
        "participants": body.participants, "metro_label": body.metroLabel,
        "ein": body.prospectEin, "match_score": body.matchScore,
        "est_commission": body.matchScore * 100,
    })
    db.commit()
    row = result.fetchone()

    return {
        "id": row.id,
        "listId": list_id,
        "notes": body.notes,
        "priority": body.priority,
        "sponsorName": body.sponsorName,
        "city": body.city,
        "industry": body.industry,
        "participants": body.participants,
        "metroLabel": body.metroLabel,
        "ein": body.prospectEin,
        "matchScore": body.matchScore,
        "addedAt": str(row.added_at) if row.added_at else None,
    }


@router.delete("/lists/{list_id}/items/{item_id}")
def delete_list_item(
    list_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    db.execute(text("DELETE FROM saved_prospect_list_items WHERE id = :id AND list_id = :lid"), {"id": item_id, "lid": list_id})
    db.commit()
    return {"success": True}


from backend.manifest_utils import register_manifest_path as _reg_manifest_path  # noqa: E402
_reg_manifest_path("/api/saas/broker/lists/{list_id}/export")


@router.get("/lists/{list_id}/export")
def export_list_csv(
    list_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    import io

    items = db.execute(text("""
        SELECT notes, priority, sponsor_name, city, industry,
               participants, metro_label, ein, est_commission
        FROM saved_prospect_list_items
        WHERE list_id = :lid
        ORDER BY added_at DESC
    """), {"lid": list_id}).fetchall()

    output = io.StringIO()
    output.write("Sponsor Name,City,Industry,Participants,Metro,EIN,Est Commission,Notes,Priority\n")
    for item in items:
        row = [
            f'"{(item.sponsor_name or "").replace(chr(34), chr(34)+chr(34))}"',
            f'"{item.city or ""}"',
            f'"{item.industry or ""}"',
            str(item.participants or 0),
            f'"{item.metro_label or ""}"',
            f'"{item.ein or ""}"',
            str(item.est_commission or 0),
            f'"{(item.notes or "").replace(chr(34), chr(34)+chr(34))}"',
            f'"{item.priority or "medium"}"',
        ]
        output.write(",".join(row) + "\n")

    from backend.manifest_utils import manifest_headers

    raw = output.getvalue().encode("utf-8")
    return StreamingResponse(
        io.BytesIO(raw),
        media_type="text/csv",
        headers=manifest_headers(raw, filename=f"prospect-list-{list_id}.csv"),
    )
