"""Stop-Loss Intelligence — attachment point optimization and catastrophic claim prediction."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/saas/stoploss", tags=["saas-stoploss"])


@router.get("/dashboard")
def stoploss_dashboard(
    employees: Optional[int] = Query(None),
    annual_claims: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    n = employees or 450
    claims = annual_claims or 4_100_000
    pmpm = claims / (n * 12)

    attachment = round(pmpm * 12 * 3.2, -3)
    agg_attachment = round(claims * 1.15, -3)

    return {
        "plan_profile": {
            "employees": n, "annual_claims": claims, "pmpm": round(pmpm, 2),
            "current_attachment": attachment,
            "recommended_attachment": round(attachment * 0.95, -3),
            "agg_attachment": agg_attachment,
        },
        "attachment_analysis": [
            {"attachment": 50_000, "stop_loss_premium": 312_000, "max_exposure": 50_000 * n,
             "expected_recoveries": 580_000, "net_cost": claims - 580_000 + 312_000, "tier": "aggressive"},
            {"attachment": 75_000, "stop_loss_premium": 228_000, "max_exposure": 75_000 * n,
             "expected_recoveries": 390_000, "net_cost": claims - 390_000 + 228_000, "tier": "balanced"},
            {"attachment": 100_000, "stop_loss_premium": 178_000, "max_exposure": 100_000 * n,
             "expected_recoveries": 250_000, "net_cost": claims - 250_000 + 178_000, "tier": "conservative"},
            {"attachment": 150_000, "stop_loss_premium": 118_000, "max_exposure": 150_000 * n,
             "expected_recoveries": 140_000, "net_cost": claims - 140_000 + 118_000, "tier": "high-deductible"},
        ],
        "catastrophic_claims": [
            {"member": "M-0047", "diagnosis": "Leukemia (AML)", "ytd_cost": 1_240_000,
             "projected_runout": 1_840_000, "attachment_breach": True, "recovery_est": 990_000,
             "months_remaining": 8, "severity": "critical"},
            {"member": "M-0183", "diagnosis": "Premature Birth (32 weeks)", "ytd_cost": 480_000,
             "projected_runout": 620_000, "attachment_breach": True, "recovery_est": 370_000,
             "months_remaining": 3, "severity": "high"},
            {"member": "M-0291", "diagnosis": "Spinal Fusion (3-level)", "ytd_cost": 210_000,
             "projected_runout": 240_000, "attachment_breach": False, "recovery_est": 0,
             "months_remaining": 2, "severity": "medium"},
            {"member": "M-0312", "diagnosis": "Hepatitis C (Harvoni)", "ytd_cost": 89_000,
             "projected_runout": 184_000, "attachment_breach": False, "recovery_est": 0,
             "months_remaining": 4, "severity": "watch"},
            {"member": "M-0401", "diagnosis": "ESRD — Dialysis", "ytd_cost": 68_000,
             "projected_runout": 272_000, "attachment_breach": True, "recovery_est": 172_000,
             "months_remaining": 12, "severity": "high"},
        ],
        "runout_reserve": {
            "total_incurred": claims,
            "ibnr_estimate": round(claims * 0.083, 0),
            "runout_months": 3.2,
            "recommended_reserve": round(claims * 1.083 * 3.2 / 12, 0),
            "current_reserve": round(claims * 0.9, 0),
            "reserve_gap": round(claims * 1.083 * 3.2 / 12 - claims * 0.9, 0),
        },
        "risk_heatmap": [
            {"specialty": "Oncology", "claims": 1_420_000, "members": 3, "risk": "critical"},
            {"specialty": "Neonatology", "claims": 480_000, "members": 1, "risk": "high"},
            {"specialty": "Orthopedics", "claims": 380_000, "members": 12, "risk": "medium"},
            {"specialty": "Nephrology", "claims": 310_000, "members": 4, "risk": "high"},
            {"specialty": "Cardiology", "claims": 270_000, "members": 8, "risk": "medium"},
            {"specialty": "Mental Health", "claims": 190_000, "members": 34, "risk": "watch"},
        ],
    }


@router.get("/carriers")
def carrier_comparison(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return {
        "quotes": [
            {"carrier": "Sun Life Financial", "specific_attachment": 75_000, "agg_factor": 115,
             "premium": 228_400, "rated_claims": 4_180_000, "am_best": "A+", "market_share": 18.2},
            {"carrier": "HM Life Insurance", "specific_attachment": 75_000, "agg_factor": 115,
             "premium": 241_200, "rated_claims": 4_050_000, "am_best": "A", "market_share": 11.4},
            {"carrier": "Symetra Life", "specific_attachment": 75_000, "agg_factor": 120,
             "premium": 218_800, "rated_claims": 4_320_000, "am_best": "A", "market_share": 9.7},
            {"carrier": "Voya Financial", "specific_attachment": 80_000, "agg_factor": 115,
             "premium": 201_600, "rated_claims": 4_240_000, "am_best": "A-", "market_share": 7.8},
            {"carrier": "Tokio Marine HCC", "specific_attachment": 75_000, "agg_factor": 110,
             "premium": 265_000, "rated_claims": 3_980_000, "am_best": "A++", "market_share": 14.1},
        ],
    }
