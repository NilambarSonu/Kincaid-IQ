"""Employer Health Score™ — benefits diagnostic scoring for prospect/client outreach."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/employer-health-score", tags=["employer-health-score"])


class ScoreRequest(BaseModel):
    company_name: str
    industry: str
    employee_count: int
    state: str
    plan_type: str
    pmpm: Optional[float] = None
    generic_dispense_rate: Optional[float] = None
    in_network_rate: Optional[float] = None
    has_stop_loss: Optional[bool] = None
    last_pbm_review: Optional[str] = None
    has_fiduciary_committee: Optional[bool] = None
    last_plan_audit: Optional[str] = None
    caa_attestation_filed: Optional[bool] = None


@router.post("/score")
def calculate_score(req: ScoreRequest, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    benchmarks = {
        "pmpm_benchmark": 862,
        "generic_rate_benchmark": 90.0,
        "in_network_benchmark": 87.0,
    }
    pmpm            = req.pmpm or 890
    generic_rate    = req.generic_dispense_rate or 82.0
    in_network_rate = req.in_network_rate or 84.0

    # Dimension scoring
    rx_score       = min(100, max(0, int(100 - ((pmpm - benchmarks["pmpm_benchmark"]) / benchmarks["pmpm_benchmark"]) * 100 + (generic_rate - 85) * 2)))
    network_score  = min(100, max(0, int((in_network_rate - 75) / (95 - 75) * 100)))
    stoploss_score = 85 if req.has_stop_loss else 32
    fiduciary_score= 72 if req.has_fiduciary_committee else 28
    fiduciary_score= min(100, fiduciary_score + (15 if req.caa_attestation_filed else 0))
    pbm_score      = 45 if req.last_pbm_review in ["0-1 year", "1-2 years"] else 25
    compliance_score = 60 if req.last_plan_audit in ["0-1 year", "1-2 years"] else 35

    overall = round((rx_score * 0.25 + network_score * 0.20 + stoploss_score * 0.20 + fiduciary_score * 0.20 + pbm_score * 0.10 + compliance_score * 0.05))

    grade = "A" if overall >= 90 else "B" if overall >= 80 else "C" if overall >= 65 else "D" if overall >= 50 else "F"

    annual_spend = pmpm * req.employee_count * 1.4 * 12
    savings_opportunity = round(annual_spend * (0.12 if overall < 50 else 0.08 if overall < 65 else 0.05))

    return {
        "company_name": req.company_name,
        "industry": req.industry,
        "employee_count": req.employee_count,
        "state": req.state,
        "overall_score": overall,
        "grade": grade,
        "annual_spend_estimate": round(annual_spend),
        "savings_opportunity": savings_opportunity,
        "dimensions": [
            {"name": "Rx & PBM Efficiency",     "score": rx_score,        "weight": 25, "benchmark": 72,
             "status": "concern" if rx_score < 55 else "good" if rx_score >= 70 else "fair",
             "insight": f"Generic dispense rate {generic_rate}% vs {benchmarks['generic_rate_benchmark']}% benchmark. PMPM ${pmpm:.0f} vs ${benchmarks['pmpm_benchmark']:.0f} peer avg."},
            {"name": "Network Adequacy",         "score": network_score,   "weight": 20, "benchmark": 71,
             "status": "concern" if network_score < 55 else "good" if network_score >= 70 else "fair",
             "insight": f"In-network utilization {in_network_rate}% vs {benchmarks['in_network_benchmark']}% benchmark. OON leakage drives 11-18% excess cost."},
            {"name": "Stop-Loss Protection",     "score": stoploss_score,  "weight": 20, "benchmark": 78,
             "status": "concern" if not req.has_stop_loss else "good",
             "insight": "Self-funded plans without stop-loss face catastrophic exposure. A single $800K claim can devastate the plan." if not req.has_stop_loss else "Stop-loss in place. Review specific deductible adequacy and laser provisions annually."},
            {"name": "Fiduciary Governance",     "score": fiduciary_score, "weight": 20, "benchmark": 61,
             "status": "concern" if fiduciary_score < 45 else "good" if fiduciary_score >= 65 else "fair",
             "insight": "CAA 2021 creates new fiduciary obligations. Plans without documented governance face DOL audit exposure and personal liability for plan administrators."},
            {"name": "PBM Contract Quality",     "score": pbm_score,       "weight": 10, "benchmark": 52,
             "status": "concern" if pbm_score < 40 else "fair",
             "insight": "PBM contracts older than 2 years typically have 8-14% excess cost vs market. Spread pricing, rebate retention, and MAC manipulation erode plan value invisibly."},
            {"name": "Compliance Posture",       "score": compliance_score,"weight": 5,  "benchmark": 58,
             "status": "concern" if compliance_score < 45 else "fair",
             "insight": "Plans without recent audit or compliance review carry undisclosed regulatory exposure. CAA penalties and DOL investigations are rising."},
        ],
        "top_risks": [
            r for r in [
                ("Rx spend 3.3% above Indiana peer benchmark — PBM review overdue" if pmpm > benchmarks["pmpm_benchmark"] else None),
                ("No stop-loss — catastrophic claim exposure is unmitigated" if not req.has_stop_loss else None),
                ("No fiduciary committee — personal liability for HR/CFO" if not req.has_fiduciary_committee else None),
                ("Generic dispense rate below 87% — formulary management gap" if generic_rate < 87 else None),
                ("CAA gag clause attestation not filed — immediate compliance action needed" if not req.caa_attestation_filed else None),
                ("OON leakage above 13% — network steerage opportunity" if in_network_rate < 87 else None),
            ] if r
        ],
        "next_steps": [
            "Schedule a complimentary 45-minute benefits diagnostic call with Kincaid Health",
            "Request a full PBM contract audit (no cost, no obligation)",
            "Review stop-loss program structure with our actuarial team",
            "Complete ERISA fiduciary readiness assessment",
        ],
    }


@router.get("/sample")
def sample_score(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Returns a pre-calculated sample score for demo purposes."""
    return {
        "company_name": "Sample Employer (Demo)",
        "industry": "Manufacturing",
        "employee_count": 250,
        "state": "IN",
        "overall_score": 49,
        "grade": "D",
        "annual_spend_estimate": 3_780_000,
        "savings_opportunity": 302_400,
        "dimensions": [
            {"name": "Rx & PBM Efficiency",  "score": 38, "weight": 25, "benchmark": 72, "status": "concern",
             "insight": "Generic rate 79% vs 90% benchmark. PMPM $912 vs $862 peer avg. PBM contract last reviewed 4 years ago."},
            {"name": "Network Adequacy",      "score": 61, "weight": 20, "benchmark": 71, "status": "fair",
             "insight": "In-network rate 84.2% — 2.8 points below benchmark. Mental health network critically deficient at 0.41x ratio."},
            {"name": "Stop-Loss Protection",  "score": 85, "weight": 20, "benchmark": 78, "status": "good",
             "insight": "Stop-loss in place. Specific deductible at $150K — recommend review against current high-cost claimant profile."},
            {"name": "Fiduciary Governance",  "score": 28, "weight": 20, "benchmark": 61, "status": "concern",
             "insight": "No fiduciary committee. No 408(b)(2) disclosures on file. No COI policy. Significant personal liability exposure for HR Director and CFO."},
            {"name": "PBM Contract Quality",  "score": 24, "weight": 10, "benchmark": 52, "status": "concern",
             "insight": "Contract not reviewed in 4+ years. Spread pricing language present. Rebate transparency clause missing. Estimated $180-340K annual excess cost."},
            {"name": "Compliance Posture",    "score": 35, "weight": 5,  "benchmark": 58, "status": "concern",
             "insight": "Gag clause attestation not filed. SPD not updated for CAA. MHPAEA analysis not on file."},
        ],
        "top_risks": [
            "PBM spread pricing costing estimated $180-340K/year — no transparency clause in contract",
            "No fiduciary committee — HR Director and CFO personally liable under ERISA §409",
            "Generic dispense rate 11 points below benchmark — formulary management gap",
            "Gag clause attestation not filed — immediate DOL exposure",
            "Mental health parity violation risk — NQTL analysis not documented",
        ],
        "next_steps": [
            "Schedule a complimentary 45-minute benefits diagnostic call with Kincaid Health",
            "Request a full PBM contract audit (no cost, no obligation)",
            "Complete ERISA fiduciary readiness assessment",
            "Review stop-loss specific deductible vs. current claims profile",
        ],
    }
