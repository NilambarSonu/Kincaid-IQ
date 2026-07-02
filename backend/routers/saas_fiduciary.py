"""Plan Fiduciary Dashboard — org-scoped healthcare plan analytics."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/saas/fiduciary", tags=["saas-fiduciary"])


def _get_user_org(user, db):
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id).first()
    if not membership:
        return None
    return db.query(models.Organization).filter_by(id=membership.org_id).first()


@router.get("/dashboard")
def fiduciary_dashboard(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    org = _get_user_org(user, db)
    org_name = org.name if org else "Demo Org"
    employees = (org.employees if org else None) or 450
    annual_premium = (org.annual_premium if org else None) or 4_200_000

    pmpm = round(annual_premium / (employees * 12), 2)
    benchmark_pmpm = 812.40
    variance_pct = round((pmpm - benchmark_pmpm) / benchmark_pmpm * 100, 1)

    return {
        "org": {"id": org.id if org else None, "name": org_name},
        "kpis": [
            {"key": "pmpm", "label": "PMPM Cost", "value": pmpm, "format": "currency",
             "benchmark": benchmark_pmpm, "variance_pct": variance_pct,
             "status": "red" if variance_pct > 10 else "yellow" if variance_pct > 0 else "green"},
            {"key": "mlr", "label": "Medical Loss Ratio", "value": 84.7, "format": "percent",
             "benchmark": 80.0, "variance_pct": 5.9, "status": "yellow"},
            {"key": "rx_pmpm", "label": "Rx PMPM", "value": 187.30, "format": "currency",
             "benchmark": 160.00, "variance_pct": 17.1, "status": "red"},
            {"key": "er_utilization", "label": "ER Utilization / 1000", "value": 142, "format": "number",
             "benchmark": 110, "variance_pct": 29.1, "status": "red"},
            {"key": "generic_dispense", "label": "Generic Dispense Rate", "value": 88.2, "format": "percent",
             "benchmark": 90.0, "variance_pct": -2.0, "status": "green"},
            {"key": "preventive_rate", "label": "Preventive Visit Rate", "value": 62.4, "format": "percent",
             "benchmark": 72.0, "variance_pct": -13.3, "status": "red"},
        ],
        "cost_trend": [
            {"period": "Jan 24", "actual": 328400, "budget": 315000, "benchmark_pmpm": 812},
            {"period": "Feb 24", "actual": 341200, "budget": 315000, "benchmark_pmpm": 812},
            {"period": "Mar 24", "actual": 356800, "budget": 320000, "benchmark_pmpm": 815},
            {"period": "Apr 24", "actual": 334100, "budget": 320000, "benchmark_pmpm": 815},
            {"period": "May 24", "actual": 362700, "budget": 325000, "benchmark_pmpm": 820},
            {"period": "Jun 24", "actual": 378900, "budget": 325000, "benchmark_pmpm": 820},
            {"period": "Jul 24", "actual": 389200, "budget": 330000, "benchmark_pmpm": 822},
            {"period": "Aug 24", "actual": 371500, "budget": 330000, "benchmark_pmpm": 822},
            {"period": "Sep 24", "actual": 395400, "budget": 335000, "benchmark_pmpm": 825},
            {"period": "Oct 24", "actual": 412100, "budget": 335000, "benchmark_pmpm": 825},
            {"period": "Nov 24", "actual": 398600, "budget": 340000, "benchmark_pmpm": 828},
            {"period": "Dec 24", "actual": 421300, "budget": 340000, "benchmark_pmpm": 828},
        ],
        "erisa_compliance": {
            "score": 74,
            "grade": "C+",
            "items": [
                {"rule": "SPD Distribution", "status": "PASS", "due": None},
                {"rule": "Form 5500 Filing", "status": "PASS", "due": None},
                {"rule": "CAA Transparency Disclosure", "status": "FAIL", "due": "2025-01-01", "severity": "high"},
                {"rule": "MHPAEA Parity Analysis", "status": "FAIL", "due": "2024-12-31", "severity": "high"},
                {"rule": "Gag Clause Attestation", "status": "PASS", "due": None},
                {"rule": "RxDC Reporting", "status": "PASS", "due": None},
                {"rule": "Broker Fee Disclosure", "status": "WARN", "due": "2025-03-01", "severity": "medium"},
                {"rule": "NQF Reporting", "status": "PASS", "due": None},
                {"rule": "COBRA Notices", "status": "PASS", "due": None},
                {"rule": "HIPAA Privacy Training", "status": "WARN", "due": "2025-06-01", "severity": "low"},
            ],
        },
        "cost_drivers": [
            {"category": "Inpatient", "spend": 1_420_000, "pct": 33.8, "yoy": 8.2},
            {"category": "Outpatient", "spend": 890_000, "pct": 21.2, "yoy": 5.1},
            {"category": "Rx", "spend": 760_000, "pct": 18.1, "yoy": 14.7},
            {"category": "Professional", "spend": 680_000, "pct": 16.2, "yoy": 3.9},
            {"category": "ER", "spend": 280_000, "pct": 6.7, "yoy": 11.4},
            {"category": "Mental Health", "spend": 170_000, "pct": 4.0, "yoy": 22.1},
        ],
    }


@router.get("/benchmarks")
def benchmarks(
    industry: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    size_band: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return {
        "cohort": {"industry": industry or "Healthcare", "region": region or "Midwest", "size_band": size_band or "250-500"},
        "benchmarks": [
            {"metric": "PMPM", "p25": 720, "p50": 812, "p75": 940, "your_value": 877.80},
            {"metric": "MLR", "p25": 75, "p50": 80, "p75": 86, "your_value": 84.7},
            {"metric": "Rx PMPM", "p25": 140, "p50": 160, "p75": 195, "your_value": 187.30},
            {"metric": "ER / 1000", "p25": 85, "p50": 110, "p75": 148, "your_value": 142},
            {"metric": "Generic Rate %", "p25": 85, "p50": 90, "p75": 94, "your_value": 88.2},
            {"metric": "Network Leakage %", "p25": 3, "p50": 7, "p75": 14, "your_value": 11.4},
        ],
    }
