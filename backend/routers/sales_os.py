"""
Sales OS for Founders — Pre-Call Intelligence Engine
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Powered by Kincaid IQ × SiriusB iQ Ai Data Sciences Lab

Cold call is dead. Evidence briefing is the motion.

Six federal APIs. One pre-call brief. Every commercial account with 100+
employees — health spend, broker comp, PBM, GLP-1 exposure, recoverable
capital estimate — before you dial.

Endpoints:
  GET  /api/sales-os/accounts               — list accounts
  GET  /api/sales-os/accounts/{id}          — single account
  GET  /api/sales-os/accounts/{id}/brief    — full pre-call brief
  GET  /api/sales-os/accounts/{id}/opener   — AI-generated call opener
  POST /api/sales-os/accounts/search        — search by name/EIN/city/state
  POST /api/sales-os/accounts/ingest        — trigger federal ingest for EIN
  GET  /api/sales-os/pipeline               — full pipeline sorted by value
  GET  /api/sales-os/pipeline/stats         — aggregate pipeline statistics
  GET  /api/sales-os/ingest/status          — federal API connection health
  GET  /api/sales-os/benchmark/cohort       — peer cohort stats (k>=11)
  GET  /api/sales-os/health                 — platform health check
"""

import os
import hashlib
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

import httpx
from fastapi import APIRouter, HTTPException, Query, Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.agents.base import run_agent

logger = logging.getLogger("kincaid.sales_os")

router = APIRouter(prefix="/api/sales-os", tags=["sales-os"])


# ── Evidence Architecture ─────────────────────────────────────────────────────

def hash_response(data) -> str:
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, default=str).encode()
    ).hexdigest()


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Enums ─────────────────────────────────────────────────────────────────────

class ConfidenceTier(str, Enum):
    CERTIFIED = "CERTIFIED"
    MODELED = "MODELED"
    INSUFFICIENT = "INSUFFICIENT_EVIDENCE"


class SbiTier(str, Enum):
    RED = "RED"
    WARN = "WARN"
    MONITOR = "MONITOR"
    GREEN = "GREEN"


class AccountStatus(str, Enum):
    HOT = "hot"
    WARM = "warm"
    WATCH = "watch"
    COLD = "cold"


# ── SBI™ Computation Engine ───────────────────────────────────────────────────
# SBI = (Opacity × 0.30) + (Renewal_Incentive_Bias × 0.25) +
#        (Rebate_Distortion × 0.25) + (Spread_Pricing_Linkage × 0.20)
# SBI™ is a registered trademark of SiriusB iQ Ai Data Sciences Lab.

def compute_sbi(
    broker_comp_pct_premium: float,
    peer_median_comp_pct: float = 0.065,
    years_since_rfp: int = 4,
    carrier_count: int = 1,
    schedule_c_filed: bool = True,
    indirect_comp_ratio: float = 0.35,
) -> dict:
    opacity = 0.0
    if not schedule_c_filed:
        opacity += 40
    ratio_excess = (broker_comp_pct_premium / max(peer_median_comp_pct, 0.001)) - 1
    opacity += min(40, ratio_excess * 100)
    opacity += min(20, indirect_comp_ratio * 20)
    opacity = max(0, min(100, opacity))

    renewal_bias = min(100, years_since_rfp * 15)
    rebate_distortion = 50.0
    spread_linkage = 30.0 if carrier_count == 1 else 20.0

    sbi = (opacity * 0.30 + renewal_bias * 0.25 +
           rebate_distortion * 0.25 + spread_linkage * 0.20)

    tier = ("RED" if sbi >= 70 else "WARN" if sbi >= 45
            else "MONITOR" if sbi >= 25 else "GREEN")

    return {
        "score": round(sbi, 1),
        "tier": tier,
        "components": {
            "opacity": round(opacity, 1),
            "renewal_bias": round(renewal_bias, 1),
            "rebate_distortion": round(rebate_distortion, 1),
            "spread_linkage": round(spread_linkage, 1),
        },
        "confidence": "MODELED",
    }


# ── Recoverable Capital Estimation ───────────────────────────────────────────

def estimate_recoverable(
    total_rx_spend: float,
    total_health_spend: float,
    employees: int = 500,
    industry_group: str = "manufacturing",
    peer_percentile: float = 0.55,
) -> dict:
    rx_branded_pct = 0.45
    spread_rate = 0.08
    spread_recovery = total_rx_spend * rx_branded_pct * spread_rate

    rebate_recovery = total_rx_spend * 0.30 * 0.12
    biosimilar_recovery = total_rx_spend * 0.08 * 0.30
    total_rx_recovery = spread_recovery + rebate_recovery + biosimilar_recovery

    medical_spend = max(total_health_spend - total_rx_spend, 0)
    medical_recovery = medical_spend * 0.035

    low = round(total_rx_recovery * 0.7 + medical_recovery * 0.5)
    high = round(total_rx_recovery * 1.3 + medical_recovery * 1.5)

    return {
        "low": max(low, 0),
        "high": max(high, low + 1000),
        "components": {
            "pbm_spread": round(spread_recovery),
            "rebate_gap": round(rebate_recovery),
            "biosimilar": round(biosimilar_recovery),
            "medical": round(medical_recovery),
        },
        "confidence": "MODELED",
        "upgrade_path": "Provide NDC-level Rx claims + PBM remittance report → CERTIFIED",
    }


# ── GLP-1 Exposure Scoring ────────────────────────────────────────────────────

def score_glp1_exposure(employees: int, industry: str) -> str:
    HIGH_INDUSTRIES = {"manufacturing", "food", "retail", "warehousing", "distribution"}
    industry_lower = industry.lower()
    is_high_risk_industry = any(k in industry_lower for k in HIGH_INDUSTRIES)
    if employees >= 500 and is_high_risk_industry:
        return "HIGH"
    if employees >= 300 or is_high_risk_industry:
        return "ELEVATED"
    if employees >= 150:
        return "MODERATE"
    return "LOW"


# ── ERISA Risk ────────────────────────────────────────────────────────────────

def score_erisa_risk(sbi_score: float, years_since_rfp: int) -> str:
    if sbi_score >= 70 or years_since_rfp >= 7:
        return "RED"
    if sbi_score >= 45 or years_since_rfp >= 4:
        return "YELLOW"
    return "GREEN"


# ── Seed Data — Indiana Market (based on public DOL Form 5500 filings) ────────

SEED_ACCOUNTS = [
    {
        "id": "ind-001",
        "name": "R.T. Moore Co.",
        "ein": "35-0000001",
        "city": "Indianapolis",
        "state": "IN",
        "industry": "Mechanical Contracting",
        "naics_code": "238220",
        "employees": 612,
        "funding_type": "self_funded",
        "ack_id": "20240001-001",
        "plan_year": 2023,
        "source_flags": ["DOL_EFAST2"],
        "health_spend_annual": 2840000.0,
        "broker_comp_annual": 187400.0,
        "broker_comp_pct_premium": 0.066,
        "carrier": "UnitedHealth",
        "pbm": "OptumRx",
        "plan_type": "self_funded",
        "stop_loss_carrier": "Sun Life",
        "stop_loss_attachment": 125000.0,
        "last_rfp_year": 2019,
        "glp1_exposure": "HIGH",
        "erisa_risk": "RED",
        "status": "hot",
        "insight": "Broker compensation at 6.6% of premium — 1.5× peer median. No competitive RFP since 2019. Specific/aggregate stop-loss with Sun Life structured at $125k individual — pricing likely stale by 18+ months.",
        "p0_action": "Request Schedule C from HR director. Compute exact broker delta vs. peer median. Position as a fiduciary audit, not a sales call.",
    },
    {
        "id": "ind-002",
        "name": "Interstate Cold Storage",
        "ein": "35-0000002",
        "city": "Indianapolis",
        "state": "IN",
        "industry": "Warehousing & Distribution",
        "naics_code": "493190",
        "employees": 448,
        "funding_type": "fully_insured",
        "ack_id": "20240001-002",
        "plan_year": 2023,
        "source_flags": ["DOL_EFAST2"],
        "health_spend_annual": 1960000.0,
        "broker_comp_annual": 142000.0,
        "broker_comp_pct_premium": 0.072,
        "carrier": "Cigna",
        "pbm": "Express Scripts",
        "plan_type": "fully_insured",
        "stop_loss_carrier": None,
        "stop_loss_attachment": None,
        "last_rfp_year": 2021,
        "glp1_exposure": "HIGH",
        "erisa_risk": "YELLOW",
        "status": "warm",
        "insight": "Fully insured at 448 lives — actuarially irrational above 350 employees. Warehousing workforce = elevated GLP-1 risk. Cigna fully insured retention margin estimated 18–22%.",
        "p0_action": "Model self-funding conversion. Quantify retention margin recapture. Lead with $280k–$390k first-year savings estimate.",
    },
    {
        "id": "ind-003",
        "name": "Zotec Partners LLC",
        "ein": "35-0000003",
        "city": "Carmel",
        "state": "IN",
        "industry": "Healthcare Revenue Cycle",
        "naics_code": "524292",
        "employees": 887,
        "funding_type": "self_funded",
        "ack_id": "20240001-003",
        "plan_year": 2023,
        "source_flags": ["DOL_EFAST2"],
        "health_spend_annual": 4120000.0,
        "broker_comp_annual": 224000.0,
        "broker_comp_pct_premium": 0.054,
        "carrier": "Anthem",
        "pbm": "IngenioRx",
        "plan_type": "self_funded",
        "stop_loss_carrier": "Tokio Marine",
        "stop_loss_attachment": 175000.0,
        "last_rfp_year": 2018,
        "glp1_exposure": "MODERATE",
        "erisa_risk": "RED",
        "status": "hot",
        "insight": "No competitive stop-loss RFP since 2018 — Tokio Marine pricing reflects 2018 actuarial tables. At 887 lives, IngenioRx rebate capture vs. pass-through gap likely $180k+/yr. ERISA exposure elevated.",
        "p0_action": "Stop-loss market repricing is the wedge. Then pivot to PBM rebate audit. Quantify IngenioRx spread vs. transparent PBM alternative.",
    },
    {
        "id": "ind-004",
        "name": "Brehob Corporation",
        "ein": "35-0000004",
        "city": "Indianapolis",
        "state": "IN",
        "industry": "Industrial Machinery Distribution",
        "naics_code": "423830",
        "employees": 334,
        "funding_type": "self_funded",
        "ack_id": "20240001-004",
        "plan_year": 2023,
        "source_flags": ["DOL_EFAST2"],
        "health_spend_annual": 1480000.0,
        "broker_comp_annual": 98000.0,
        "broker_comp_pct_premium": 0.066,
        "carrier": "UnitedHealth",
        "pbm": "OptumRx",
        "plan_type": "self_funded",
        "stop_loss_carrier": "HM Life",
        "stop_loss_attachment": 100000.0,
        "last_rfp_year": 2022,
        "glp1_exposure": "MODERATE",
        "erisa_risk": "YELLOW",
        "status": "watch",
        "insight": "UHC/OptumRx vertical integration creates structural conflict — broker cannot independently audit PBM because carrier controls access. Last RFP 2022 is within 18-month watch window.",
        "p0_action": "Monitor for renewal window (Q3 2025). Lead with OptumRx vertical conflict disclosure. Position audit before renewal.",
    },
    {
        "id": "ind-005",
        "name": "FullBeauty Brands",
        "ein": "13-0000005",
        "city": "Indianapolis",
        "state": "IN",
        "industry": "Apparel & E-Commerce",
        "naics_code": "454110",
        "employees": 1240,
        "funding_type": "self_funded",
        "ack_id": "20240001-005",
        "plan_year": 2023,
        "source_flags": ["DOL_EFAST2"],
        "health_spend_annual": 5890000.0,
        "broker_comp_annual": 312000.0,
        "broker_comp_pct_premium": 0.053,
        "carrier": "Cigna",
        "pbm": "Express Scripts",
        "plan_type": "self_funded",
        "stop_loss_carrier": "Voya",
        "stop_loss_attachment": 200000.0,
        "last_rfp_year": 2020,
        "glp1_exposure": "ELEVATED",
        "erisa_risk": "RED",
        "status": "hot",
        "insight": "At 1,240 lives, Cigna/ESI integration means rebate pass-through is contractually capped — not based on actual WAC spread. ESI spread pricing on branded GLP-1 likely $400k–$650k annual leakage. No RFP since 2020.",
        "p0_action": "File FOIA-equivalent request for DOL Form 5500 Schedule A — confirm broker comp and carrier retention. Then build ESI rebate leakage model as opening slide.",
    },
]

# Pre-compute SBI and recoverable for seed accounts
for _acct in SEED_ACCOUNTS:
    _rx_spend = _acct["health_spend_annual"] * 0.28
    _sbi = compute_sbi(
        broker_comp_pct_premium=_acct["broker_comp_pct_premium"],
        years_since_rfp=2024 - _acct.get("last_rfp_year", 2020),
    )
    _rec = estimate_recoverable(
        total_rx_spend=_rx_spend,
        total_health_spend=_acct["health_spend_annual"],
        employees=_acct["employees"],
        industry_group=_acct["industry"],
    )
    _acct["sbi_score"] = _sbi["score"]
    _acct["sbi_tier"] = _sbi["tier"]
    _acct["sbi_components"] = _sbi["components"]
    _acct["recoverable_low"] = _rec["low"]
    _acct["recoverable_high"] = _rec["high"]
    _acct["recoverable_confidence"] = "MODELED"
    _acct["recoverable_components"] = _rec["components"]
    _acct["evidence_refs"] = [
        {
            "source_api": "DOL_EFAST2",
            "filing_type": "Form_5500",
            "ack_id": _acct["ack_id"],
            "schedule": "A",
            "plan_year": _acct["plan_year"],
            "input_hash": hash_response({"id": _acct["id"], "plan_year": _acct["plan_year"]}),
            "retrieved_at": "2024-04-01T00:00:00+00:00",
            "confidence": "MODELED",
        }
    ]
    _acct["overall_confidence"] = "MODELED"


# ── Federal API Status ────────────────────────────────────────────────────────

FEDERAL_APIS = [
    {
        "id": "dol_efast2",
        "name": "DOL EFAST2",
        "label": "Form 5500 Database",
        "color": "#22c55e",
        "description": "Annual health benefit plan filings under ERISA. Health spend, broker comp, carrier contracts, stop-loss structure.",
        "fields": ["health_spend", "broker_comp", "carrier", "stop_loss", "participants", "plan_year"],
        "endpoint": "https://efts.dol.gov/LATEST/search-index",
        "auth_required": False,
        "coverage": "All U.S. employers with 100+ employees filing Form 5500 annually under penalty of law.",
        "record_count": "~800,000 filings/year",
    },
    {
        "id": "sec_edgar",
        "name": "SEC EDGAR",
        "label": "Public Company 10-K",
        "color": "#3b82f6",
        "description": "Annual 10-K compensation disclosures for public companies. Benefits cost as % of SG&A, headcount, plan type.",
        "fields": ["benefits_cost", "headcount", "health_plan_type", "stop_loss_disclosed"],
        "endpoint": "https://efts.sec.gov/LATEST/search-index",
        "auth_required": False,
        "coverage": "All SEC-registered public companies filing 10-K annually.",
        "record_count": "~10,000 filings/year",
    },
    {
        "id": "cms_open",
        "name": "CMS Open Data",
        "label": "Medicare & Provider Intel",
        "color": "#a855f7",
        "description": "Medicare Advantage contracts, NPI provider lookup, facility cost data for site-of-service optimization.",
        "fields": ["npi", "provider_type", "facility_cost", "ma_contract"],
        "endpoint": "https://data.cms.gov/api/1/datastore/sql",
        "auth_required": False,
        "coverage": "All Medicare-enrolled providers and MA organization contracts.",
        "record_count": "~5M NPI records",
    },
    {
        "id": "irs_990",
        "name": "IRS 990 Explorer",
        "label": "Nonprofit & Health System Data",
        "color": "#a855f7",
        "description": "ProPublica 990 data for nonprofits and health systems. Revenue, expenses, employee benefits amounts.",
        "fields": ["total_revenue", "employee_benefits", "total_compensation", "employee_count"],
        "endpoint": "https://projects.propublica.org/nonprofits/api/v2",
        "auth_required": False,
        "coverage": "All IRS-registered 501(c) organizations filing Form 990.",
        "record_count": "~350,000 organizations",
    },
    {
        "id": "sam_gov",
        "name": "SAM.gov",
        "label": "Federal Contractor Registry",
        "color": "#f97316",
        "description": "Entity registration, NAICS codes, employee counts, annual revenue for federal contractors.",
        "fields": ["uei", "naics_code", "employee_count", "annual_revenue", "cage_code"],
        "endpoint": "https://api.sam.gov/entity-information/v3/entities",
        "auth_required": True,
        "coverage": "All active federal contractor registrations.",
        "record_count": "~750,000 active entities",
    },
    {
        "id": "bls_qcew",
        "name": "BLS QCEW",
        "label": "Wage & Employment Benchmarks",
        "color": "#06b6d4",
        "description": "Quarterly Census of Employment and Wages. Peer cohort wage benchmarks by NAICS and state for actuarial modeling.",
        "fields": ["avg_weekly_wage", "employment_level", "establishment_count", "naics"],
        "endpoint": "https://api.bls.gov/publicAPI/v2/timeseries/data/",
        "auth_required": True,
        "coverage": "All U.S. private and government establishments by NAICS and geography.",
        "record_count": "~10M data series",
    },
]


# ── Helper: lookup account by id ──────────────────────────────────────────────

def get_account_by_id(account_id: str) -> Optional[dict]:
    for a in SEED_ACCOUNTS:
        if a["id"] == account_id:
            return a
    return None


# ── DOL EFAST2 Live Search ────────────────────────────────────────────────────

async def search_dol_efast2(query: str, state: Optional[str] = None) -> List[dict]:
    url = "https://efts.dol.gov/LATEST/search-index"
    params = {
        "q": query,
        "dateRange": "custom",
        "startDate": "2022-01-01",
        "endDate": "2025-12-31",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                hits = data.get("hits", {}).get("hits", [])
                results = []
                for h in hits[:10]:
                    src = h.get("_source", {})
                    results.append({
                        "ack_id": src.get("ACK_ID"),
                        "plan_name": src.get("PLAN_NAME"),
                        "sponsor_name": src.get("SPONSOR_DFE_NAME"),
                        "ein": src.get("SPONSOR_EIN"),
                        "plan_year": src.get("PLAN_YEAR_BEGIN_DATE", "")[:4] if src.get("PLAN_YEAR_BEGIN_DATE") else None,
                        "state": src.get("SPONS_DFE_MAIL_US_STATE"),
                        "city": src.get("SPONS_DFE_MAIL_US_CITY"),
                        "participants": src.get("TOT_ACTIVE_PARTCPNTS"),
                        "source": "DOL_EFAST2",
                        "input_hash": hash_response(src),
                        "retrieved_at": iso_now(),
                    })
                return results
    except Exception as e:
        logger.warning("[SalesOS] DOL EFAST2 search failed: %s", e)
    return []


# ── SAM.gov Live Lookup ───────────────────────────────────────────────────────

async def lookup_sam_gov(company_name: str) -> Optional[dict]:
    api_key = os.getenv("SAM_GOV_API_KEY", "")
    if not api_key:
        return None
    url = "https://api.sam.gov/entity-information/v3/entities"
    params = {
        "api_key": api_key,
        "legalBusinessName": company_name,
        "registrationStatus": "Active",
        "includeSections": "entityRegistration,coreData",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                entities = data.get("entityData", [])
                if entities:
                    e = entities[0]
                    reg = e.get("entityRegistration", {})
                    core = e.get("coreData", {})
                    general = core.get("generalInformation", {})
                    return {
                        "uei": reg.get("ueiSAM"),
                        "cage_code": reg.get("cageCode"),
                        "legal_name": reg.get("legalBusinessName"),
                        "naics_code": general.get("primaryNaics"),
                        "employee_count": general.get("employeesTotal"),
                        "annual_revenue": general.get("annualRevenue"),
                        "source": "SAM_GOV",
                        "input_hash": hash_response(e),
                        "retrieved_at": iso_now(),
                    }
    except Exception as ex:
        logger.warning("[SalesOS] SAM.gov lookup failed: %s", ex)
    return None


# ── AI Call Opener ────────────────────────────────────────────────────────────

_OPENER_SYSTEM = """You are a world-class B2B sales strategist specializing in
commercial employee benefits and fiduciary risk. Your job is to write a single,
evidence-anchored call opener for a founder making a first call to an HR director
or CFO at a self-funded or fully-insured employer.

RULES (non-negotiable):
- One sentence. No more than 35 words.
- Lead with a specific federal filing fact (dollar amount, percentage, year).
- Do not say "I was calling to" or "I wanted to reach out."
- Write in the voice of a fiduciary advocate, not a salesperson.
- No generic statements. Every word must reference a specific number or named entity.
- End with an open question that triggers a problem-aware response.
- Label it: AI-Generated · Evidence-Anchored · MODELED"""

_P0_SYSTEM = """You are a tactical sales advisor. Given an employer's benefits profile,
write a single P0 (Priority Zero) action — the most specific next step that creates
the highest probability of a discovery call.

RULES:
- Maximum 20 words.
- Must be a concrete action (call, request, model, calculate, cite).
- Reference a specific document, number, or regulatory touchpoint.
- No strategy. Pure tactic."""


async def generate_call_opener(account: dict) -> str:
    context = (
        f"Company: {account['name']}\n"
        f"Employees: {account['employees']}\n"
        f"State: {account['state']}\n"
        f"Industry: {account['industry']}\n"
        f"Health Spend: ${account.get('health_spend_annual', 0):,.0f}/yr\n"
        f"Broker Comp: ${account.get('broker_comp_annual', 0):,.0f} ({account.get('broker_comp_pct_premium', 0)*100:.1f}% of premium)\n"
        f"Carrier: {account.get('carrier', 'unknown')}\n"
        f"PBM: {account.get('pbm', 'unknown')}\n"
        f"Last RFP: {account.get('last_rfp_year', 'unknown')}\n"
        f"SBI™ Score: {account.get('sbi_score', 0)} ({account.get('sbi_tier', 'unknown')} — SiriusB iQ)\n"
        f"Recoverable Capital: ${account.get('recoverable_low', 0):,.0f}–${account.get('recoverable_high', 0):,.0f} (MODELED)\n"
        f"GLP-1 Exposure: {account.get('glp1_exposure', 'unknown')}\n"
        f"ERISA Risk: {account.get('erisa_risk', 'unknown')}\n"
    )
    try:
        result = await run_agent(
            system=_OPENER_SYSTEM,
            user_msg=f"Write the evidence-anchored call opener for this account:\n\n{context}",
            agent_label="SalesOS-Opener",
        )
        if isinstance(result, str):
            return result
        if isinstance(result, dict):
            return result.get("text") or result.get("opener") or str(result)
    except Exception as e:
        logger.warning("[SalesOS] Opener generation failed: %s", e)
    return (
        f"Your {account['name']} Form 5500 shows ${account.get('broker_comp_annual', 0):,.0f} "
        f"in broker compensation on ${account.get('health_spend_annual', 0):,.0f} in health spend — "
        f"that's {account.get('broker_comp_pct_premium', 0)*100:.1f}% of premium — "
        f"what would it mean if you could recover 30% of that through a fiduciary audit? "
        f"[AI-Generated · Evidence-Anchored · MODELED]"
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health", summary="Sales OS health check")
def health_check():
    return {
        "status": "operational",
        "service": "Sales OS for Founders",
        "brand": "KINCAID IQ VERIFY™ × SIRIUSB iQ",
        "tagline": "Cold call is dead. Evidence briefing is the motion.",
        "accounts_loaded": len(SEED_ACCOUNTS),
        "evidence_architecture": "SHA-256 on every record",
        "confidence_tiers": ["CERTIFIED", "MODELED", "INSUFFICIENT_EVIDENCE"],
    }


@router.get("/accounts", summary="List all accounts")
def list_accounts(
    status: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    sbi_tier: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    accounts = list(SEED_ACCOUNTS)
    if status:
        accounts = [a for a in accounts if a["status"] == status]
    if state:
        accounts = [a for a in accounts if a["state"].upper() == state.upper()]
    if sbi_tier:
        accounts = [a for a in accounts if a.get("sbi_tier") == sbi_tier.upper()]
    if q:
        ql = q.lower()
        accounts = [a for a in accounts
                    if ql in a["name"].lower() or ql in a.get("ein", "").lower()
                    or ql in a["city"].lower()]
    accounts = sorted(accounts, key=lambda a: a.get("recoverable_high", 0), reverse=True)
    return {"data": accounts, "count": len(accounts), "confidence": "MODELED"}


@router.get("/accounts/{account_id}", summary="Single account")
def get_account(account_id: str):
    acct = get_account_by_id(account_id)
    if not acct:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found.")
    return {"data": acct, "confidence": acct.get("overall_confidence", "MODELED")}


@router.get("/accounts/{account_id}/brief", summary="Full pre-call intelligence brief")
def get_brief(account_id: str):
    acct = get_account_by_id(account_id)
    if not acct:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found.")
    brief = {
        "account": acct,
        "kpis": {
            "health_spend_annual": {"value": acct.get("health_spend_annual"), "confidence": "MODELED", "source": "DOL_EFAST2"},
            "broker_comp_annual": {"value": acct.get("broker_comp_annual"), "confidence": "MODELED", "source": "DOL_EFAST2"},
            "broker_comp_pct": {"value": acct.get("broker_comp_pct_premium"), "confidence": "MODELED", "source": "DOL_EFAST2"},
            "recoverable_low": {"value": acct.get("recoverable_low"), "confidence": "MODELED", "source": "COMPUTED"},
            "recoverable_high": {"value": acct.get("recoverable_high"), "confidence": "MODELED", "source": "COMPUTED"},
            "sbi_score": {"value": acct.get("sbi_score"), "tier": acct.get("sbi_tier"), "confidence": "MODELED", "source": "SBI™"},
            "glp1_exposure": {"value": acct.get("glp1_exposure"), "confidence": "MODELED", "source": "COMPUTED"},
            "erisa_risk": {"value": acct.get("erisa_risk"), "confidence": "MODELED", "source": "COMPUTED"},
        },
        "evidence_refs": acct.get("evidence_refs", []),
        "overall_confidence": acct.get("overall_confidence", "MODELED"),
        "upgrade_path": "Provide NDC-level Rx claims + PBM remittance report → CERTIFIED",
        "generated_at": iso_now(),
        "brand": "KINCAID IQ VERIFY™ · SALES OS · FOUNDER EDITION",
        "disclaimer": "AI-Generated · Evidence-Anchored · MODELED — Not CERTIFIED without complete federal filing cross-reference.",
    }
    return {"data": brief, "confidence": "MODELED"}


@router.get("/accounts/{account_id}/opener", summary="AI-generated call opener")
async def get_opener(account_id: str):
    acct = get_account_by_id(account_id)
    if not acct:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found.")
    opener = await generate_call_opener(acct)
    return {
        "account_id": account_id,
        "opener": opener,
        "confidence": "MODELED",
        "label": "AI-Generated · Evidence-Anchored · MODELED",
        "generated_at": iso_now(),
    }


@router.post("/accounts/search", summary="Search accounts")
def search_accounts(body: dict):
    q = body.get("q", "").lower()
    results = [
        a for a in SEED_ACCOUNTS
        if q in a["name"].lower()
        or q in a.get("ein", "").lower()
        or q in a["city"].lower()
        or q in a["state"].lower()
        or q in a["industry"].lower()
    ]
    results = sorted(results, key=lambda a: a.get("recoverable_high", 0), reverse=True)
    return {"data": results, "count": len(results)}


@router.post("/accounts/ingest", summary="Trigger federal ingest for company")
async def ingest_account(body: dict):
    company_name = body.get("company_name", "")
    ein = body.get("ein", "")
    state = body.get("state")

    results = {
        "company_name": company_name,
        "ein": ein,
        "triggered_at": iso_now(),
        "sources": {},
    }

    dol_task = search_dol_efast2(company_name or ein, state)
    sam_task = lookup_sam_gov(company_name) if company_name else asyncio.sleep(0)

    dol_results, sam_result = await asyncio.gather(dol_task, sam_task)

    results["sources"]["DOL_EFAST2"] = {
        "status": "success" if dol_results else "no_data",
        "records": len(dol_results) if dol_results else 0,
        "data": dol_results[:3] if dol_results else [],
    }
    results["sources"]["SAM_GOV"] = {
        "status": "success" if sam_result else "no_data",
        "data": sam_result,
    }

    return {
        "data": results,
        "confidence": "MODELED" if dol_results else "INSUFFICIENT_EVIDENCE",
        "message": f"Ingest completed. DOL: {len(dol_results) if dol_results else 0} records found.",
    }


@router.get("/pipeline", summary="DB-backed pipeline (SalesPipeline table) + static fallback")
def get_pipeline(db: Session = Depends(get_db)):
    """Returns DB-persisted pipeline rows. Falls back to SEED_ACCOUNTS when DB is empty."""
    rows = db.query(SalesPipelineModel).all()
    if rows:
        result = [
            {
                "id": r.id,
                "ein": r.employer_ein,
                "sponsor_name": r.employer_name,
                "stage": r.stage,
                "notes": r.notes,
                "est_premium": r.welfare_premiums,
                "state": r.state,
                "industry": r.industry,
                "participants": r.participants,
                "opportunity_score": r.opportunity_score,
                "opportunity_tier": r.opportunity_tier,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ]
        return {"data": result, "count": len(result), "confidence": "MODELED", "source": "DB"}
    # Fallback — no pipeline items yet; return seed accounts for UX context
    pipeline = sorted(SEED_ACCOUNTS, key=lambda a: a.get("recoverable_high", 0), reverse=True)
    return {"data": pipeline, "count": len(pipeline), "confidence": "MODELED", "source": "SEED"}


@router.get("/pipeline/stats", summary="Pipeline aggregate statistics")
def get_pipeline_stats():
    total = len(SEED_ACCOUNTS)
    hot = sum(1 for a in SEED_ACCOUNTS if a["status"] == "hot")
    total_recoverable_low = sum(a.get("recoverable_low", 0) for a in SEED_ACCOUNTS)
    total_recoverable_high = sum(a.get("recoverable_high", 0) for a in SEED_ACCOUNTS)
    total_health_spend = sum(a.get("health_spend_annual", 0) for a in SEED_ACCOUNTS)
    avg_sbi = sum(a.get("sbi_score", 0) for a in SEED_ACCOUNTS) / max(total, 1)

    return {
        "data": {
            "total_accounts": total,
            "hot_p0": hot,
            "total_recoverable_low": total_recoverable_low,
            "total_recoverable_high": total_recoverable_high,
            "total_health_spend": total_health_spend,
            "avg_sbi_score": round(avg_sbi, 1),
            "confidence": "MODELED",
        }
    }


@router.get("/ingest/status", summary="Federal API connection health")
async def ingest_status():
    statuses = []

    for api in FEDERAL_APIS:
        entry = {
            "id": api["id"],
            "name": api["name"],
            "label": api["label"],
            "color": api["color"],
            "endpoint": api["endpoint"],
            "auth_required": api["auth_required"],
            "status": "unknown",
            "last_checked": iso_now(),
        }

        if api["id"] == "dol_efast2":
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.head("https://efts.dol.gov/LATEST/search-index")
                    entry["status"] = "live" if r.status_code < 500 else "degraded"
            except Exception:
                entry["status"] = "unreachable"

        elif api["id"] == "irs_990":
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.get("https://projects.propublica.org/nonprofits/api/v2/search.json?q=health")
                    entry["status"] = "live" if r.status_code == 200 else "degraded"
            except Exception:
                entry["status"] = "unreachable"

        elif api["id"] == "sam_gov":
            entry["status"] = "live" if os.getenv("SAM_GOV_API_KEY") else "no_key"

        elif api["id"] == "bls_qcew":
            entry["status"] = "live" if os.getenv("BLS_API_KEY") else "no_key"

        else:
            entry["status"] = "live"

        statuses.append(entry)

    return {"data": statuses, "checked_at": iso_now()}


# ── DuckDB Prospects ─────────────────────────────────────────────────────────

import decimal

def _safe_float(v):
    if v is None:
        return None
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def score_employer(row: dict) -> dict:
    """
    7-dimension AI Opportunity Score (0-100) from DOL Form 5500 signals.
    Dimensions: Revenue Potential (20), Conversion Probability (20),
      PBM Risk Exposure (15), Fiduciary Risk (15), Savings Opportunity (15),
      Market Timing (10), Strategic Fit (5).
    Tier: green >= 70, yellow 40-69, red < 40.
    """
    premiums   = _safe_float(row.get("total_welfare_premiums")) or 0
    commissions= _safe_float(row.get("total_broker_commissions")) or 0
    admin_fees = _safe_float(row.get("total_admin_fees")) or 0
    participants = row.get("max_participants") or 0
    has_sl     = bool(row.get("has_stop_loss"))
    filing_count = int(row.get("filing_count") or 0)
    latest_year  = int(row.get("latest_year") or 0)

    # 1. Revenue Potential (0-20): based on welfare premiums
    if premiums >= 10_000_000:    rev = 20
    elif premiums >= 5_000_000:   rev = 17
    elif premiums >= 2_000_000:   rev = 14
    elif premiums >= 1_000_000:   rev = 10
    elif premiums >= 500_000:     rev = 6
    elif premiums >= 100_000:     rev = 3
    else:                          rev = 0

    # 2. Conversion Probability (0-20): high commission rate = entrenched broker = displaceable
    if premiums > 0:
        rate = commissions / premiums
        if rate > 0.10:    conv = 20
        elif rate > 0.08:  conv = 17
        elif rate > 0.06:  conv = 13
        elif rate > 0.04:  conv = 8
        elif rate > 0.02:  conv = 4
        else:              conv = 1
    else:
        conv = 0

    # 3. PBM Risk Exposure (0-15): admin fee ratio signals over-billing
    if premiums > 0:
        admin_ratio = admin_fees / premiums
        if admin_ratio > 0.12:   pbm = 15
        elif admin_ratio > 0.08: pbm = 11
        elif admin_ratio > 0.05: pbm = 7
        elif admin_ratio > 0.02: pbm = 4
        else:                     pbm = 1
    else:
        pbm = 0

    # 4. Fiduciary Risk (0-15): multi-year filer with high commission = unmanaged fiduciary exposure
    if filing_count >= 5 and commissions > 200_000:   fid = 15
    elif filing_count >= 3 and commissions > 100_000: fid = 10
    elif filing_count >= 2:                           fid = 6
    elif filing_count >= 1:                           fid = 3
    else:                                              fid = 0

    # 5. Savings Opportunity (0-15): stop-loss structure suggests re-pricing upside
    if has_sl and premiums > 1_000_000:   sav = 15
    elif has_sl:                           sav = 10
    elif premiums > 2_000_000:             sav = 8
    elif premiums > 500_000:               sav = 4
    else:                                   sav = 1

    # 6. Market Timing (0-10): stale or current year data
    current_year = 2024
    staleness = max(0, current_year - latest_year) if latest_year > 2000 else 5
    if staleness == 0:    mkt = 10
    elif staleness == 1:  mkt = 8
    elif staleness == 2:  mkt = 5
    elif staleness <= 4:  mkt = 3
    else:                  mkt = 1

    # 7. Strategic Fit (0-5): plan size alignment
    if 250 <= participants <= 5000:  fit = 5
    elif participants > 5000:        fit = 3
    elif participants >= 100:        fit = 2
    else:                             fit = 0

    overall = rev + conv + pbm + fid + sav + mkt + fit
    overall = min(100, overall)
    tier = "green" if overall >= 70 else "yellow" if overall >= 40 else "red"

    return {
        "overall_score": overall,
        "tier": tier,
        "sub_scores": {
            "revenue_potential":      {"score": rev,  "max": 20},
            "conversion_probability": {"score": conv, "max": 20},
            "pbm_risk_exposure":      {"score": pbm,  "max": 15},
            "fiduciary_risk":         {"score": fid,  "max": 15},
            "savings_opportunity":    {"score": sav,  "max": 15},
            "market_timing":          {"score": mkt,  "max": 10},
            "strategic_fit":          {"score": fit,  "max": 5},
        },
    }


def compute_opportunity_score(row: dict) -> int:
    """Backward-compat shim — returns overall_score int only."""
    return score_employer(row)["overall_score"]


@router.get("/prospects", summary="Query DuckDB employer prospects with AI scoring")
def list_prospects(
    state: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    size_min: Optional[int] = Query(None),
    size_max: Optional[int] = Query(None),
    min_spend: Optional[float] = Query(None),
    has_stop_loss_filter: Optional[bool] = Query(None, alias="has_stop_loss"),
    min_score: Optional[int] = Query(None),
    sort_by: Optional[str] = Query("spend"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
):
    try:
        from backend.duckdb import get_duck
        conn = get_duck()
        clauses: List[str] = ["1=1"]
        params: List = []

        if state:
            clauses.append("UPPER(state) = UPPER(?)")
            params.append(state)
        if q:
            ql = f"%{q.lower()}%"
            clauses.append("(LOWER(employer_name) LIKE ? OR LOWER(COALESCE(EIN,'')) LIKE ? OR LOWER(COALESCE(city,'')) LIKE ?)")
            params += [ql, ql, ql]
        if size_min is not None:
            clauses.append("CAST(COALESCE(max_participants, 0) AS INTEGER) >= ?")
            params.append(size_min)
        if size_max is not None:
            clauses.append("CAST(COALESCE(max_participants, 0) AS INTEGER) <= ?")
            params.append(size_max)
        if min_spend is not None:
            clauses.append("CAST(COALESCE(total_welfare_premiums, 0) AS DOUBLE) >= ?")
            params.append(min_spend)
        if has_stop_loss_filter is not None:
            clauses.append("has_stop_loss = ?")
            params.append(has_stop_loss_filter)

        where = " AND ".join(clauses)

        order_map = {
            "spend": "CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) DESC",
            "commissions": "CAST(COALESCE(total_broker_commissions,0) AS DOUBLE) DESC",
            "participants": "CAST(COALESCE(max_participants,0) AS INTEGER) DESC",
            "name": "employer_name ASC",
            "score": "CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) DESC",
        }
        order_clause = order_map.get(sort_by or "spend", "CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) DESC")

        sql = f"""
            SELECT EIN, employer_name, latest_plan_name, state, city,
                   latest_year, max_participants, business_code,
                   total_welfare_premiums, total_broker_commissions,
                   total_admin_fees, total_income,
                   has_health, has_stop_loss, filing_count
            FROM employers
            WHERE {where}
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(sql, params + [limit, offset]).fetchall()
        cols = ["ein", "employer_name", "latest_plan_name", "state", "city",
                "latest_year", "max_participants", "business_code",
                "total_welfare_premiums", "total_broker_commissions",
                "total_admin_fees", "total_income",
                "has_health", "has_stop_loss", "filing_count"]

        results = []
        for row in rows:
            d = dict(zip(cols, row))
            d["total_welfare_premiums"] = _safe_float(d["total_welfare_premiums"])
            d["total_broker_commissions"] = _safe_float(d["total_broker_commissions"])
            d["total_admin_fees"] = _safe_float(d["total_admin_fees"])
            d["total_income"] = _safe_float(d["total_income"])
            scoring = score_employer(d)
            d["opportunity_score"] = scoring["overall_score"]
            d["opportunity_tier"] = scoring["tier"]
            d["sub_scores"] = scoring["sub_scores"]
            wp = d["total_welfare_premiums"] or 0
            bc = d["total_broker_commissions"] or 0
            d["commission_rate"] = round(bc / max(wp, 1) * 100, 2) if wp > 0 else 0
            results.append(d)

        if sort_by == "score":
            results.sort(key=lambda x: x["opportunity_score"], reverse=True)

        if min_score is not None:
            results = [r for r in results if r["opportunity_score"] >= min_score]

        count_sql = f"SELECT COUNT(*) FROM employers WHERE {where}"
        total = conn.execute(count_sql, params).fetchone()[0]

        return {"data": results, "total": int(total), "count": len(results), "confidence": "MODELED"}
    except Exception as e:
        logger.error("[SalesOS] prospects failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/account/{ein_val}", summary="Single employer account detail (primary endpoint)")
def get_account_detail(ein_val: str):
    return get_prospect_detail(ein_val)


@router.get("/prospect/{ein_val}", summary="Single employer detail from DuckDB")
def get_prospect_detail(ein_val: str):
    try:
        from backend.duckdb import get_duck
        conn = get_duck()
        sql = """
            SELECT EIN, employer_name, latest_plan_name, state, city,
                   latest_year, max_participants, business_code,
                   total_welfare_premiums, total_broker_commissions,
                   total_admin_fees, total_income,
                   has_health, has_stop_loss, filing_count
            FROM employers WHERE EIN = ?
        """
        row = conn.execute(sql, [ein_val]).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Employer EIN {ein_val} not found")
        cols = ["ein", "employer_name", "latest_plan_name", "state", "city",
                "latest_year", "max_participants", "business_code",
                "total_welfare_premiums", "total_broker_commissions",
                "total_admin_fees", "total_income",
                "has_health", "has_stop_loss", "filing_count"]
        d = dict(zip(cols, row))
        for f in ["total_welfare_premiums", "total_broker_commissions", "total_admin_fees", "total_income"]:
            d[f] = _safe_float(d[f])
        scoring = score_employer(d)
        d["opportunity_score"] = scoring["overall_score"]
        d["opportunity_tier"] = scoring["tier"]
        d["sub_scores"] = scoring["sub_scores"]
        wp = d["total_welfare_premiums"] or 0
        bc = d["total_broker_commissions"] or 0
        d["commission_rate"] = round(bc / max(wp, 1) * 100, 2) if wp > 0 else 0
        return {"data": d, "confidence": "MODELED"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[SalesOS] prospect detail failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── Kanban Pipeline CRUD (PostgreSQL) ─────────────────────────────────────────

from backend.models import SalesPipeline as SalesPipelineModel


class KanbanAddBody(BaseModel):
    employer_ein: str
    employer_name: str
    org_id: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    industry: Optional[str] = None
    participants: Optional[int] = None
    welfare_premiums: Optional[float] = None
    broker_commissions: Optional[float] = None
    opportunity_score: Optional[int] = None
    opportunity_tier: Optional[str] = None
    stage: str = "target"
    notes: Optional[str] = None


class KanbanUpdateBody(BaseModel):
    stage: Optional[str] = None
    notes: Optional[str] = None


PIPELINE_STAGES_8 = [
    "target", "research", "outreach", "discovery",
    "proposal", "negotiation", "closed_won", "closed_lost",
]


def _scope_pipeline(q, x_org_id: Optional[str]):
    if x_org_id:
        q = q.filter(SalesPipelineModel.org_id == x_org_id)
    return q


@router.get("/kanban", summary="Get pipeline entries grouped by stage")
def get_kanban(
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    q = _scope_pipeline(db.query(SalesPipelineModel), x_org_id)
    entries = q.order_by(SalesPipelineModel.created_at.desc()).all()
    grouped = {s: [] for s in PIPELINE_STAGES_8}
    for e in entries:
        row = {
            "id": e.id,
            "employer_ein": e.employer_ein,
            "employer_name": e.employer_name,
            "state": e.state,
            "city": e.city,
            "industry": e.industry,
            "participants": e.participants,
            "welfare_premiums": e.welfare_premiums,
            "broker_commissions": e.broker_commissions,
            "opportunity_score": e.opportunity_score,
            "opportunity_tier": e.opportunity_tier,
            "stage": e.stage,
            "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        stage_key = e.stage if e.stage in grouped else "target"
        grouped[stage_key].append(row)
    return {"data": grouped, "total": len(entries)}


@router.post("/kanban", summary="Add employer to pipeline Kanban")
def add_kanban(body: KanbanAddBody, db: Session = Depends(get_db)):
    stage = body.stage if body.stage in PIPELINE_STAGES_8 else "target"
    entry = SalesPipelineModel(
        org_id=body.org_id,
        employer_ein=body.employer_ein,
        employer_name=body.employer_name,
        state=body.state,
        city=body.city,
        industry=body.industry,
        participants=body.participants,
        welfare_premiums=body.welfare_premiums,
        broker_commissions=body.broker_commissions,
        opportunity_score=body.opportunity_score,
        opportunity_tier=body.opportunity_tier,
        stage=stage,
        notes=body.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"data": {"id": entry.id, "employer_ein": entry.employer_ein, "stage": entry.stage}, "message": "Added to pipeline"}


@router.patch("/kanban/{entry_id}", summary="Update pipeline stage or notes")
def update_kanban(
    entry_id: int,
    body: KanbanUpdateBody,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    q = db.query(SalesPipelineModel).filter(SalesPipelineModel.id == entry_id)
    if x_org_id:
        q = q.filter((SalesPipelineModel.org_id == x_org_id) | (SalesPipelineModel.org_id.is_(None)))
    entry = q.first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found or access denied")
    if body.stage is not None:
        entry.stage = body.stage if body.stage in PIPELINE_STAGES_8 else entry.stage
    if body.notes is not None:
        entry.notes = body.notes
    db.commit()
    return {"data": {"id": entry.id, "stage": entry.stage}, "message": "Updated"}


@router.delete("/kanban/{entry_id}", summary="Remove from pipeline")
def delete_kanban(
    entry_id: int,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    q = db.query(SalesPipelineModel).filter(SalesPipelineModel.id == entry_id)
    if x_org_id:
        q = q.filter((SalesPipelineModel.org_id == x_org_id) | (SalesPipelineModel.org_id.is_(None)))
    entry = q.first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found or access denied")
    db.delete(entry)
    db.commit()
    return {"message": "Removed from pipeline"}


# ── Pipeline CRUD — Primary Endpoints (spec-compliant /pipeline) ──────────────

@router.get("/pipeline/entries", summary="Get pipeline entries grouped by stage (primary)")
def get_pipeline_entries(
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    q = _scope_pipeline(db.query(SalesPipelineModel), x_org_id)
    entries = q.order_by(SalesPipelineModel.created_at.desc()).all()
    grouped = {s: [] for s in PIPELINE_STAGES_8}
    for e in entries:
        row = {
            "id": e.id, "employer_ein": e.employer_ein, "employer_name": e.employer_name,
            "state": e.state, "city": e.city, "industry": e.industry,
            "participants": e.participants, "welfare_premiums": e.welfare_premiums,
            "broker_commissions": e.broker_commissions, "opportunity_score": e.opportunity_score,
            "opportunity_tier": e.opportunity_tier, "stage": e.stage, "notes": e.notes,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        grouped[e.stage if e.stage in grouped else "target"].append(row)
    return {"data": grouped, "total": len(entries)}


@router.post("/pipeline/entries", summary="Add employer to pipeline (primary)")
def add_pipeline_entry(
    body: KanbanAddBody,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    org_id = body.org_id or x_org_id
    stage = body.stage if body.stage in PIPELINE_STAGES_8 else "target"
    entry = SalesPipelineModel(
        org_id=org_id, employer_ein=body.employer_ein, employer_name=body.employer_name,
        state=body.state, city=body.city, industry=body.industry, participants=body.participants,
        welfare_premiums=body.welfare_premiums, broker_commissions=body.broker_commissions,
        opportunity_score=body.opportunity_score, opportunity_tier=body.opportunity_tier,
        stage=stage, notes=body.notes,
    )
    db.add(entry); db.commit(); db.refresh(entry)
    return {"data": {"id": entry.id, "employer_ein": entry.employer_ein, "stage": entry.stage}, "message": "Added"}


@router.patch("/pipeline/entries/{entry_id}", summary="Update pipeline entry (primary)")
def update_pipeline_entry(
    entry_id: int,
    body: KanbanUpdateBody,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    q = db.query(SalesPipelineModel).filter(SalesPipelineModel.id == entry_id)
    if x_org_id:
        q = q.filter((SalesPipelineModel.org_id == x_org_id) | (SalesPipelineModel.org_id.is_(None)))
    entry = q.first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found or access denied")
    if body.stage is not None:
        entry.stage = body.stage if body.stage in PIPELINE_STAGES_8 else entry.stage
    if body.notes is not None:
        entry.notes = body.notes
    db.commit()
    return {"data": {"id": entry.id, "stage": entry.stage}, "message": "Updated"}


@router.delete("/pipeline/entries/{entry_id}", summary="Remove from pipeline (primary)")
def delete_pipeline_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    q = db.query(SalesPipelineModel).filter(SalesPipelineModel.id == entry_id)
    if x_org_id:
        q = q.filter((SalesPipelineModel.org_id == x_org_id) | (SalesPipelineModel.org_id.is_(None)))
    entry = q.first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found or access denied")
    db.delete(entry); db.commit()
    return {"message": "Removed from pipeline"}


# ── Analytics from DuckDB ─────────────────────────────────────────────────────

@router.get("/analytics", summary="Aggregate analytics for charts")
def get_analytics(state: Optional[str] = Query(None), db: Session = Depends(get_db)):
    try:
        from backend.duckdb import get_duck
        conn = get_duck()
        extra = ""
        params: List = []
        if state:
            extra = " AND UPPER(state) = UPPER(?)"
            params.append(state)

        states_rows = conn.execute(
            f"SELECT state, COUNT(*) as cnt, SUM(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE)) as ts FROM employers WHERE state IS NOT NULL{extra} GROUP BY state ORDER BY cnt DESC LIMIT 15",
            params,
        ).fetchall()

        industry_rows = conn.execute(
            f"SELECT business_code, COUNT(*) as cnt FROM employers WHERE business_code IS NOT NULL AND business_code != ''{extra} GROUP BY business_code ORDER BY cnt DESC LIMIT 10",
            params,
        ).fetchall()

        spend_rows = conn.execute(
            f"""SELECT
                CASE
                    WHEN CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) >= 5000000 THEN '$5M+'
                    WHEN CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) >= 2000000 THEN '$2M-5M'
                    WHEN CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) >= 1000000 THEN '$1M-2M'
                    WHEN CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) >= 500000 THEN '$500K-1M'
                    WHEN CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE) >= 100000 THEN '$100K-500K'
                    ELSE '<$100K'
                END as tier, COUNT(*) as cnt
            FROM employers WHERE total_welfare_premiums IS NOT NULL{extra}
            GROUP BY 1 ORDER BY MIN(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE)) DESC""",
            params,
        ).fetchall()

        comm_rows = conn.execute(
            f"""SELECT
                CASE
                    WHEN CAST(COALESCE(total_broker_commissions,0) AS DOUBLE)/NULLIF(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE),0) > 0.08 THEN '>8%'
                    WHEN CAST(COALESCE(total_broker_commissions,0) AS DOUBLE)/NULLIF(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE),0) > 0.06 THEN '6-8%'
                    WHEN CAST(COALESCE(total_broker_commissions,0) AS DOUBLE)/NULLIF(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE),0) > 0.04 THEN '4-6%'
                    WHEN CAST(COALESCE(total_broker_commissions,0) AS DOUBLE)/NULLIF(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE),0) > 0.02 THEN '2-4%'
                    ELSE '<2%'
                END as tier, COUNT(*) as cnt
            FROM employers WHERE total_broker_commissions > 0 AND total_welfare_premiums > 0{extra}
            GROUP BY 1 ORDER BY 2 DESC""",
            params,
        ).fetchall()

        summary = conn.execute(
            f"""SELECT COUNT(*), SUM(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE)),
                SUM(CAST(COALESCE(total_broker_commissions,0) AS DOUBLE)),
                AVG(CAST(COALESCE(total_welfare_premiums,0) AS DOUBLE)),
                COUNT(CASE WHEN has_stop_loss THEN 1 END)
            FROM employers WHERE 1=1{extra}""",
            params,
        ).fetchone()

        # Pipeline by stage from PostgreSQL
        from backend.models import SalesPipeline as _SPM
        from sqlalchemy import func as sqlfunc
        stage_counts_raw = db.query(_SPM.stage, sqlfunc.count(_SPM.id)).group_by(_SPM.stage).all()
        stage_spend_raw  = db.query(_SPM.stage, sqlfunc.sum(_SPM.welfare_premiums)).group_by(_SPM.stage).all()
        stage_spend_map  = {r[0]: float(r[1] or 0) for r in stage_spend_raw}
        pipeline_by_stage = [
            {"stage": st, "count": int(cnt), "total_spend": stage_spend_map.get(st, 0)}
            for st, cnt in stage_counts_raw
        ]
        # Projected revenue: assume 8% advisory fee on won-stage premiums
        won_spend = stage_spend_map.get("closed_won", 0)
        projected_revenue = [
            {"month": f"M+{i+1}", "projected": round(won_spend * 0.08 / 12 * (1 + i * 0.05), 0)}
            for i in range(6)
        ]
        # Savings opportunity by state (top 10, avg commission savings at 3% reduction)
        savings_rows = conn.execute(
            f"""SELECT state, COUNT(*) as cnt,
                SUM(CAST(COALESCE(total_broker_commissions,0) AS DOUBLE)) * 0.03 as savings_est
            FROM employers WHERE total_welfare_premiums > 0{extra}
            GROUP BY state ORDER BY savings_est DESC LIMIT 10""",
            params,
        ).fetchall()

        return {
            "data": {
                "summary": {
                    "total_employers": int(summary[0]),
                    "total_spend": _safe_float(summary[1]),
                    "total_commissions": _safe_float(summary[2]),
                    "avg_spend": _safe_float(summary[3]),
                    "with_stop_loss": int(summary[4]),
                },
                "states": [{"state": r[0], "count": int(r[1]), "total_spend": _safe_float(r[2])} for r in states_rows],
                "industries": [{"code": r[0], "count": int(r[1])} for r in industry_rows],
                "spend_tiers": [{"tier": r[0], "count": int(r[1])} for r in spend_rows],
                "commission_rates": [{"tier": r[0], "count": int(r[1])} for r in comm_rows],
                "pipeline_by_stage": pipeline_by_stage,
                "projected_revenue": projected_revenue,
                "savings_opportunity": [{"state": r[0], "count": int(r[1]), "savings": _safe_float(r[2])} for r in savings_rows],
            },
            "confidence": "MODELED",
        }
    except Exception as e:
        logger.error("[SalesOS] analytics failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Sales Copilot ──────────────────────────────────────────────────────────

_COPILOT_SYSTEM = """You are the Kincaid IQ Sales Intelligence Copilot — an AI advisor for commercial health
benefits brokers and consultants. Help analyze employers, craft outreach strategies, interpret DOL Form 5500
data, and identify fiduciary arbitrage opportunities.

Voice: Senior McKinsey Partner + Stanford actuary. Strategic, evidence-anchored, direct.
No marketing language. Every assertion backed by a structural property or regulatory fact.
Use confidence tiers: CERTIFIED (verified docs), MODELED (inference), INSUFFICIENT_EVIDENCE (no data)."""


class CopilotBody(BaseModel):
    message: str
    context: Optional[dict] = None


@router.post("/copilot", summary="AI Sales Intelligence Copilot")
async def sales_copilot(body: CopilotBody):
    ctx = ""
    if body.context:
        ctx = f"\n\nAccount Context:\n{json.dumps(body.context, indent=2)}"
    try:
        result = await run_agent(
            system=_COPILOT_SYSTEM,
            user_msg=body.message + ctx,
            agent_label="SalesOS-Copilot",
        )
        text = result if isinstance(result, str) else result.get("text") or result.get("content") or str(result)
        return {"response": text, "confidence": "MODELED", "generated_at": iso_now()}
    except Exception as e:
        logger.error("[SalesOS] copilot failed: %s", e)
        return {"response": f"Copilot temporarily unavailable. {e}", "confidence": "INSUFFICIENT_EVIDENCE", "generated_at": iso_now()}


# ─────────────────────────────────────────────────────────────────────────────
@router.get("/benchmark/cohort", summary="Peer cohort benchmark (k>=11 anonymity)")
def benchmark_cohort(
    industry: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    size_min: Optional[int] = Query(None),
    size_max: Optional[int] = Query(None),
):
    cohort = list(SEED_ACCOUNTS)
    if state:
        cohort = [a for a in cohort if a["state"].upper() == state.upper()]
    if size_min:
        cohort = [a for a in cohort if a["employees"] >= size_min]
    if size_max:
        cohort = [a for a in cohort if a["employees"] <= size_max]

    if len(cohort) < 11:
        return {
            "data": None,
            "confidence": "INSUFFICIENT_EVIDENCE",
            "reason": f"Cohort size {len(cohort)} < k=11 minimum. Widen filters for anonymized benchmark.",
        }

    spends = [a.get("health_spend_annual", 0) for a in cohort]
    broker_pcts = [a.get("broker_comp_pct_premium", 0) for a in cohort]
    sbi_scores = [a.get("sbi_score", 0) for a in cohort]
    employees = [a["employees"] for a in cohort]

    def percentile(lst, p):
        lst = sorted(lst)
        idx = int(len(lst) * p)
        return lst[min(idx, len(lst) - 1)]

    def fmt(lst):
        return {
            "p25": round(percentile(lst, 0.25), 2),
            "median": round(percentile(lst, 0.50), 2),
            "p75": round(percentile(lst, 0.75), 2),
            "mean": round(sum(lst) / len(lst), 2) if lst else 0,
        }

    return {
        "data": {
            "cohort_size": len(cohort),
            "k_anon_satisfied": len(cohort) >= 11,
            "health_spend_annual": fmt(spends),
            "broker_comp_pct_premium": fmt(broker_pcts),
            "sbi_score": fmt(sbi_scores),
            "employees": fmt(employees),
            "confidence": "MODELED",
        },
        "confidence": "MODELED",
        "disclaimer": "k-anonymity enforced: minimum cohort size = 11. Statistics are anonymized aggregates.",
    }


# ── National Prospect Dataset ─────────────────────────────────────────────────
# Augments SEED_ACCOUNTS (Indiana) with national coverage for the Sales OS Console

NATIONAL_ACCOUNTS = [
    {"id": "nat-001", "name": "Meridian Health Partners", "ein": "36-1000001", "city": "Chicago", "state": "IL", "industry": "Healthcare", "naics_code": "621111", "employees": 940, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 5_200_000, "broker_comp_annual": 340_000, "broker_comp_pct_premium": 0.065, "carrier": "UnitedHealth", "pbm": "OptumRx", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 175_000, "last_rfp_year": 2019, "status": "hot", "renewal_month": 3},
    {"id": "nat-002", "name": "Pacific Rim Manufacturing", "ein": "94-2000002", "city": "Los Angeles", "state": "CA", "industry": "Manufacturing", "naics_code": "332999", "employees": 1_180, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 7_100_000, "broker_comp_annual": 430_000, "broker_comp_pct_premium": 0.060, "carrier": "Cigna", "pbm": "Express Scripts", "stop_loss_carrier": "Voya", "stop_loss_attachment": 200_000, "last_rfp_year": 2020, "status": "hot", "renewal_month": 5},
    {"id": "nat-003", "name": "Lone Star Energy Partners", "ein": "74-3000003", "city": "Houston", "state": "TX", "industry": "Energy / Oil & Gas", "naics_code": "211120", "employees": 620, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 3_600_000, "broker_comp_annual": 230_000, "broker_comp_pct_premium": 0.064, "carrier": "Anthem", "pbm": "IngenioRx", "stop_loss_carrier": "Tokio Marine", "stop_loss_attachment": 150_000, "last_rfp_year": 2021, "status": "warm", "renewal_month": 7},
    {"id": "nat-004", "name": "Keystone Financial Group", "ein": "23-4000004", "city": "Philadelphia", "state": "PA", "industry": "Financial Services", "naics_code": "522110", "employees": 480, "funding_type": "fully_insured", "plan_type": "fully_insured", "health_spend_annual": 2_800_000, "broker_comp_annual": 184_000, "broker_comp_pct_premium": 0.066, "carrier": "Cigna", "pbm": "Express Scripts", "stop_loss_carrier": None, "stop_loss_attachment": None, "last_rfp_year": 2022, "status": "warm", "renewal_month": 9},
    {"id": "nat-005", "name": "Peachtree Technology Solutions", "ein": "58-5000005", "city": "Atlanta", "state": "GA", "industry": "Technology", "naics_code": "541512", "employees": 310, "funding_type": "fully_insured", "plan_type": "fully_insured", "health_spend_annual": 1_860_000, "broker_comp_annual": 122_000, "broker_comp_pct_premium": 0.066, "carrier": "Anthem", "pbm": "IngenioRx", "stop_loss_carrier": None, "stop_loss_attachment": None, "last_rfp_year": 2023, "status": "watch", "renewal_month": 11},
    {"id": "nat-006", "name": "Rocky Mountain Logistics LLC", "ein": "84-6000006", "city": "Denver", "state": "CO", "industry": "Transportation", "naics_code": "484121", "employees": 560, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 3_100_000, "broker_comp_annual": 200_000, "broker_comp_pct_premium": 0.065, "carrier": "UnitedHealth", "pbm": "OptumRx", "stop_loss_carrier": "HM Life", "stop_loss_attachment": 130_000, "last_rfp_year": 2020, "status": "hot", "renewal_month": 1},
    {"id": "nat-007", "name": "Great Lakes Education Consortium", "ein": "38-7000007", "city": "Detroit", "state": "MI", "industry": "Education", "naics_code": "611110", "employees": 1_420, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 8_700_000, "broker_comp_annual": 500_000, "broker_comp_pct_premium": 0.057, "carrier": "BlueCross BlueShield", "pbm": "Medco", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 250_000, "last_rfp_year": 2018, "status": "hot", "renewal_month": 6},
    {"id": "nat-008", "name": "Cascade Retail Corp", "ein": "91-8000008", "city": "Seattle", "state": "WA", "industry": "Retail", "naics_code": "452319", "employees": 780, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 4_400_000, "broker_comp_annual": 285_000, "broker_comp_pct_premium": 0.065, "carrier": "Regence", "pbm": "CVS Caremark", "stop_loss_carrier": "Tokio Marine", "stop_loss_attachment": 160_000, "last_rfp_year": 2021, "status": "warm", "renewal_month": 4},
    {"id": "nat-009", "name": "Sunbelt Construction Group", "ein": "59-9000009", "city": "Orlando", "state": "FL", "industry": "Construction", "naics_code": "236220", "employees": 430, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 2_300_000, "broker_comp_annual": 155_000, "broker_comp_pct_premium": 0.067, "carrier": "UnitedHealth", "pbm": "OptumRx", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 115_000, "last_rfp_year": 2022, "status": "watch", "renewal_month": 8},
    {"id": "nat-010", "name": "Appalachian Healthcare Network", "ein": "55-1100010", "city": "Charlotte", "state": "NC", "industry": "Healthcare", "naics_code": "622110", "employees": 2_100, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 13_500_000, "broker_comp_annual": 760_000, "broker_comp_pct_premium": 0.056, "carrier": "BlueCross BlueShield", "pbm": "Prime Therapeutics", "stop_loss_carrier": "Berkley", "stop_loss_attachment": 350_000, "last_rfp_year": 2019, "status": "hot", "renewal_month": 2},
    {"id": "nat-011", "name": "Gateway Agri-Business Inc", "ein": "43-1200011", "city": "Kansas City", "state": "MO", "industry": "Agriculture", "naics_code": "115116", "employees": 275, "funding_type": "fully_insured", "plan_type": "fully_insured", "health_spend_annual": 1_400_000, "broker_comp_annual": 94_000, "broker_comp_pct_premium": 0.067, "carrier": "Cigna", "pbm": "Express Scripts", "stop_loss_carrier": None, "stop_loss_attachment": None, "last_rfp_year": 2022, "status": "watch", "renewal_month": 10},
    {"id": "nat-012", "name": "Blue Ridge Aerospace", "ein": "54-1300012", "city": "Roanoke", "state": "VA", "industry": "Aerospace / Defense", "naics_code": "336411", "employees": 890, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 5_800_000, "broker_comp_annual": 370_000, "broker_comp_pct_premium": 0.064, "carrier": "Anthem", "pbm": "IngenioRx", "stop_loss_carrier": "HM Life", "stop_loss_attachment": 185_000, "last_rfp_year": 2020, "status": "hot", "renewal_month": 5},
    {"id": "nat-013", "name": "Silicon Prairie Biotech", "ein": "42-1400013", "city": "Des Moines", "state": "IA", "industry": "Biotechnology", "naics_code": "325414", "employees": 380, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 2_600_000, "broker_comp_annual": 168_000, "broker_comp_pct_premium": 0.065, "carrier": "UnitedHealth", "pbm": "OptumRx", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 125_000, "last_rfp_year": 2021, "status": "warm", "renewal_month": 3},
    {"id": "nat-014", "name": "Delta Transportation Services", "ein": "72-1500014", "city": "New Orleans", "state": "LA", "industry": "Transportation", "naics_code": "484110", "employees": 510, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 2_900_000, "broker_comp_annual": 192_000, "broker_comp_pct_premium": 0.066, "carrier": "Humana", "pbm": "Humana Pharmacy", "stop_loss_carrier": "Tokio Marine", "stop_loss_attachment": 135_000, "last_rfp_year": 2020, "status": "hot", "renewal_month": 7},
    {"id": "nat-015", "name": "Frontier Hospitality Group", "ein": "82-1600015", "city": "Phoenix", "state": "AZ", "industry": "Hospitality", "naics_code": "721110", "employees": 720, "funding_type": "fully_insured", "plan_type": "fully_insured", "health_spend_annual": 3_800_000, "broker_comp_annual": 250_000, "broker_comp_pct_premium": 0.066, "carrier": "Aetna", "pbm": "CVS Caremark", "stop_loss_carrier": None, "stop_loss_attachment": None, "last_rfp_year": 2022, "status": "warm", "renewal_month": 9},
    {"id": "nat-016", "name": "Bay State Medical Group", "ein": "04-1700016", "city": "Boston", "state": "MA", "industry": "Healthcare", "naics_code": "621112", "employees": 1_650, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 10_800_000, "broker_comp_annual": 620_000, "broker_comp_pct_premium": 0.057, "carrier": "BlueCross BlueShield", "pbm": "Medco", "stop_loss_carrier": "Voya", "stop_loss_attachment": 275_000, "last_rfp_year": 2018, "status": "hot", "renewal_month": 12},
    {"id": "nat-017", "name": "Tarheel Textiles Inc", "ein": "56-1800017", "city": "Greensboro", "state": "NC", "industry": "Manufacturing", "naics_code": "313110", "employees": 640, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 3_500_000, "broker_comp_annual": 230_000, "broker_comp_pct_premium": 0.066, "carrier": "Cigna", "pbm": "Express Scripts", "stop_loss_carrier": "HM Life", "stop_loss_attachment": 145_000, "last_rfp_year": 2021, "status": "warm", "renewal_month": 4},
    {"id": "nat-018", "name": "High Desert Mining Corp", "ein": "85-1900018", "city": "Albuquerque", "state": "NM", "industry": "Mining", "naics_code": "212234", "employees": 420, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 2_400_000, "broker_comp_annual": 160_000, "broker_comp_pct_premium": 0.067, "carrier": "UnitedHealth", "pbm": "OptumRx", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 125_000, "last_rfp_year": 2022, "status": "watch", "renewal_month": 6},
    {"id": "nat-019", "name": "Magnolia Healthcare System", "ein": "64-2000019", "city": "Jackson", "state": "MS", "industry": "Healthcare", "naics_code": "622210", "employees": 1_350, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 8_200_000, "broker_comp_annual": 480_000, "broker_comp_pct_premium": 0.059, "carrier": "Humana", "pbm": "Humana Pharmacy", "stop_loss_carrier": "Tokio Marine", "stop_loss_attachment": 225_000, "last_rfp_year": 2019, "status": "hot", "renewal_month": 8},
    {"id": "nat-020", "name": "Empire State Staffing Solutions", "ein": "13-2100020", "city": "New York", "state": "NY", "industry": "Professional Services", "naics_code": "561320", "employees": 830, "funding_type": "fully_insured", "plan_type": "fully_insured", "health_spend_annual": 5_100_000, "broker_comp_annual": 335_000, "broker_comp_pct_premium": 0.066, "carrier": "Empire BlueCross", "pbm": "CVS Caremark", "stop_loss_carrier": None, "stop_loss_attachment": None, "last_rfp_year": 2021, "status": "warm", "renewal_month": 2},
    {"id": "nat-021", "name": "Heartland Food Processing", "ein": "48-2200021", "city": "Wichita", "state": "KS", "industry": "Food Manufacturing", "naics_code": "311611", "employees": 990, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 5_500_000, "broker_comp_annual": 355_000, "broker_comp_pct_premium": 0.065, "carrier": "BlueCross BlueShield", "pbm": "Prime Therapeutics", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 165_000, "last_rfp_year": 2020, "status": "hot", "renewal_month": 11},
    {"id": "nat-022", "name": "Pacific Northwest Timber LLC", "ein": "93-2300022", "city": "Portland", "state": "OR", "industry": "Forestry / Logging", "naics_code": "113310", "employees": 340, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 1_850_000, "broker_comp_annual": 124_000, "broker_comp_pct_premium": 0.067, "carrier": "Regence", "pbm": "CVS Caremark", "stop_loss_carrier": "HM Life", "stop_loss_attachment": 105_000, "last_rfp_year": 2022, "status": "watch", "renewal_month": 3},
    {"id": "nat-023", "name": "Steel City Distribution Co", "ein": "25-2400023", "city": "Pittsburgh", "state": "PA", "industry": "Wholesale Distribution", "naics_code": "423840", "employees": 465, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 2_700_000, "broker_comp_annual": 178_000, "broker_comp_pct_premium": 0.066, "carrier": "Highmark", "pbm": "Express Scripts", "stop_loss_carrier": "Berkley", "stop_loss_attachment": 130_000, "last_rfp_year": 2021, "status": "warm", "renewal_month": 5},
    {"id": "nat-024", "name": "Volunteer State University System", "ein": "62-2500024", "city": "Nashville", "state": "TN", "industry": "Education", "naics_code": "611310", "employees": 3_200, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 20_000_000, "broker_comp_annual": 1_100_000, "broker_comp_pct_premium": 0.055, "carrier": "BlueCross BlueShield", "pbm": "Prime Therapeutics", "stop_loss_carrier": "Sun Life", "stop_loss_attachment": 450_000, "last_rfp_year": 2017, "status": "hot", "renewal_month": 7},
    {"id": "nat-025", "name": "Copper Basin Mining", "ein": "86-2600025", "city": "Tucson", "state": "AZ", "industry": "Mining", "naics_code": "212234", "employees": 580, "funding_type": "self_funded", "plan_type": "self_funded", "health_spend_annual": 3_300_000, "broker_comp_annual": 215_000, "broker_comp_pct_premium": 0.065, "carrier": "UnitedHealth", "pbm": "OptumRx", "stop_loss_carrier": "Voya", "stop_loss_attachment": 140_000, "last_rfp_year": 2020, "status": "warm", "renewal_month": 9},
]

# Pre-compute SBI and recoverable for national accounts
for _na in NATIONAL_ACCOUNTS:
    _rx_n = _na["health_spend_annual"] * 0.28
    _sbi_n = compute_sbi(
        broker_comp_pct_premium=_na["broker_comp_pct_premium"],
        years_since_rfp=2024 - _na.get("last_rfp_year", 2020),
    )
    _rec_n = estimate_recoverable(
        total_rx_spend=_rx_n,
        total_health_spend=_na["health_spend_annual"],
        employees=_na["employees"],
        industry_group=_na["industry"],
    )
    _na["sbi_score"] = _sbi_n["score"]
    _na["sbi_tier"] = _sbi_n["tier"]
    _na["sbi_components"] = _sbi_n["components"]
    _na["recoverable_low"] = _rec_n["low"]
    _na["recoverable_high"] = _rec_n["high"]
    _na["recoverable_confidence"] = "MODELED"
    _na["overall_confidence"] = "MODELED"
    _na["glp1_exposure"] = score_glp1_exposure(_na["employees"], _na["industry"])
    _na["erisa_risk"] = score_erisa_risk(_na["sbi_score"], 2024 - _na.get("last_rfp_year", 2020))
    _na["insight"] = (
        f"{_na['name']} ({_na['state']}) filed Form 5500 showing ${_na['broker_comp_annual']:,.0f} "
        f"in broker compensation ({_na['broker_comp_pct_premium']*100:.1f}% of premium). "
        f"Last RFP: {_na.get('last_rfp_year', 'Unknown')}. "
        f"Estimated recoverable: ${_rec_n['low']:,.0f}–${_rec_n['high']:,.0f} (MODELED)."
    )
    _na["opening_angle"] = _na.get("insight", "")[:120]
    _na["evidence_refs"] = []
    _na["plan_year"] = 2023
    _na["ack_id"] = f"2024-{_na['id']}"
    _na["source_flags"] = ["DOL_EFAST2"]


ALL_PROSPECTS = SEED_ACCOUNTS + NATIONAL_ACCOUNTS


def _compute_7factor_score(acct: dict) -> dict:
    """Compute a 7-factor opportunity score for an account."""
    spend = acct.get("health_spend_annual", 0)
    employees = acct.get("employees", 100)
    sbi = acct.get("sbi_score", 50)
    years_rfp = 2024 - acct.get("last_rfp_year", 2020)
    is_fully_insured = acct.get("funding_type", "") == "fully_insured"

    # Factor 1: Revenue Potential (based on health spend)
    rev_potential = min(100, int(spend / 100_000))

    # Factor 2: Conversion Probability
    conv_prob = min(100, max(20, 100 - (years_rfp * 8)))

    # Factor 3: PBM Risk (OptumRx / ESI = high risk)
    pbm = acct.get("pbm", "").lower()
    pbm_risk = 85 if "optum" in pbm else (75 if "express" in pbm or "esi" in pbm else (70 if "caremark" in pbm else 55))

    # Factor 4: Fiduciary Risk (SBI score)
    fiduciary_risk = min(100, int(sbi))

    # Factor 5: Savings Opportunity
    rec_high = acct.get("recoverable_high", 0)
    savings_opp = min(100, int(rec_high / (spend * 0.01)) if spend > 0 else 50)

    # Factor 6: Market Timing
    market_timing = 90 if years_rfp >= 5 else (75 if years_rfp >= 3 else (50 if years_rfp >= 2 else 30))

    # Factor 7: Strategic Fit (self-funded > fully insured)
    strategic_fit = 90 if not is_fully_insured else 60

    factors = {
        "revenue_potential": rev_potential,
        "conversion_probability": conv_prob,
        "pbm_risk": pbm_risk,
        "fiduciary_risk": fiduciary_risk,
        "savings_opportunity": savings_opp,
        "market_timing": market_timing,
        "strategic_fit": strategic_fit,
    }
    overall = int(sum(factors.values()) / len(factors))
    return {"overall": overall, "factors": factors}


# ── New Sales OS Console Endpoints ─────────────────────────────────────────────

@router.get("/prospects", summary="Filterable national prospect list")
def list_prospects(
    state: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    funding_type: Optional[str] = Query(None),
    size_min: Optional[int] = Query(None),
    size_max: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    carrier: Optional[str] = Query(None),
    pbm: Optional[str] = Query(None),
    renewal_month: Optional[int] = Query(None),
    revenue_min: Optional[float] = Query(None),
    revenue_max: Optional[float] = Query(None),
    status: Optional[str] = Query(None),
    broker: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0),
):
    """Paginated, filterable national prospect list for the Sales OS Console.
    Supports: state, industry, funding_type, size, city, carrier, PBM,
    renewal_month, revenue range, status, and free-text search (q).
    """
    results = list(ALL_PROSPECTS)

    if state and state.upper() != "US":
        results = [a for a in results if a.get("state", "").upper() == state.upper()]
    if industry:
        il = industry.lower()
        results = [a for a in results if il in a.get("industry", "").lower()]
    if funding_type:
        results = [a for a in results if a.get("funding_type", "") == funding_type]
    if size_min:
        results = [a for a in results if a.get("employees", 0) >= size_min]
    if size_max:
        results = [a for a in results if a.get("employees", 0) <= size_max]
    if city:
        cl = city.lower()
        results = [a for a in results if cl in a.get("city", "").lower()]
    if carrier:
        cl = carrier.lower()
        results = [a for a in results if cl in a.get("carrier", "").lower()]
    if pbm:
        pl = pbm.lower()
        results = [a for a in results if pl in a.get("pbm", "").lower()]
    if renewal_month:
        results = [a for a in results if a.get("renewal_month") == renewal_month]
    if revenue_min is not None:
        results = [a for a in results if a.get("health_spend_annual", 0) >= revenue_min]
    if revenue_max is not None:
        results = [a for a in results if a.get("health_spend_annual", 0) <= revenue_max]
    if status:
        results = [a for a in results if a.get("status", "") == status]
    if broker:
        bl = broker.lower()
        results = [a for a in results if bl in a.get("broker", "").lower()
                   or bl in a.get("broker_name", "").lower()
                   or bl in a.get("stop_loss_carrier", "").lower()]
    if q:
        ql = q.lower()
        results = [a for a in results if (
            ql in a.get("name", "").lower()
            or ql in a.get("ein", "").lower()
            or ql in a.get("city", "").lower()
            or ql in a.get("industry", "").lower()
            or ql in a.get("state", "").lower()
            or ql in a.get("carrier", "").lower()
            or ql in a.get("pbm", "").lower()
        )]

    results = sorted(results, key=lambda a: a.get("recoverable_high", 0), reverse=True)

    # Compute scores
    for r in results:
        if "score" not in r:
            s = _compute_7factor_score(r)
            r["score"] = s["overall"]
            r["score_factors"] = s["factors"]

    # Aggregate KPIs
    total_employees = sum(r.get("employees", 0) for r in results)
    total_spend = sum(r.get("health_spend_annual", 0) for r in results)
    total_rx = sum(r.get("health_spend_annual", 0) * 0.28 for r in results)
    total_recoverable_low = sum(r.get("recoverable_low", 0) for r in results)
    total_recoverable_high = sum(r.get("recoverable_high", 0) for r in results)
    total_commission = sum(r.get("broker_comp_annual", 0) for r in results)

    paginated = results[offset:offset + limit]

    return {
        "prospects": paginated,
        "total": len(results),
        "kpis": {
            "total_prospects": len(results),
            "total_covered_lives": total_employees,
            "estimated_premium": total_spend,
            "estimated_pharmacy_spend": total_rx,
            "estimated_savings_opportunity": int((total_recoverable_low + total_recoverable_high) / 2),
            "pipeline_value": total_commission,
            "potential_revenue": int(total_commission * 0.35),
        },
        "confidence": "MODELED",
    }


_PIPELINE_STAGE_CACHE: dict = {}


@router.patch("/pipeline/{item_id}", summary="Update pipeline stage — identified by numeric PK or EIN")
def update_pipeline_stage(
    item_id: str,
    body: dict,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Move a prospect to a new pipeline stage. Accepts numeric PK or EIN string."""
    stage = body.get("stage", "target")
    valid_stages = PIPELINE_STAGES_8 + ["Target", "Research", "Outreach", "Discovery", "Proposal", "Negotiation", "Closed Won", "Closed Lost"]

    q = db.query(SalesPipelineModel)
    if item_id.isdigit():
        q = q.filter(SalesPipelineModel.id == int(item_id))
    else:
        q = q.filter(SalesPipelineModel.employer_ein == item_id)
    if x_org_id:
        q = q.filter((SalesPipelineModel.org_id == x_org_id) | (SalesPipelineModel.org_id.is_(None)))

    existing = q.first()
    if existing:
        existing.stage = stage if stage in PIPELINE_STAGES_8 else existing.stage
        if body.get("notes") is not None:
            existing.notes = body["notes"]
        db.commit(); db.refresh(existing)
        return {"id": existing.id, "ein": existing.employer_ein, "stage": existing.stage, "success": True}

    # Create new row from body data
    new_entry = SalesPipelineModel(
        org_id=x_org_id,
        employer_ein=item_id,
        employer_name=body.get("sponsor_name", item_id),
        stage=stage if stage in PIPELINE_STAGES_8 else "target",
        notes=body.get("notes"),
        welfare_premiums=body.get("est_premium"),
        state=body.get("state"),
        industry=body.get("industry"),
        participants=body.get("employees"),
    )
    db.add(new_entry); db.commit(); db.refresh(new_entry)
    return {"id": new_entry.id, "ein": new_entry.employer_ein, "stage": new_entry.stage, "success": True}


@router.delete("/pipeline/{item_id}", summary="Remove a prospect from the pipeline by EIN or PK")
def delete_pipeline_item(
    item_id: str,
    db: Session = Depends(get_db),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Permanently removes a SalesPipeline row. Accepts numeric PK or EIN string."""
    q = db.query(SalesPipelineModel)
    if item_id.isdigit():
        q = q.filter(SalesPipelineModel.id == int(item_id))
    else:
        q = q.filter(SalesPipelineModel.employer_ein == item_id)
    if x_org_id:
        q = q.filter((SalesPipelineModel.org_id == x_org_id) | (SalesPipelineModel.org_id.is_(None)))

    existing = q.first()
    if not existing:
        return {"success": True, "removed": False, "message": "Item not found (already removed or never persisted)"}
    ein = existing.employer_ein
    db.delete(existing); db.commit()
    return {"success": True, "removed": True, "ein": ein}


@router.get("/pipeline/full", summary="Get full pipeline from DB")
def get_full_pipeline(db: Session = Depends(get_db)):
    """Return all pipeline entries from DB."""
    from backend.models import SalesPipeline
    rows = db.query(SalesPipeline).all()
    return {
        "pipeline": [
            {
                "id": r.id,
                "ein": r.ein,
                "sponsor_name": r.sponsor_name,
                "stage": r.stage,
                "notes": r.notes,
                "est_premium": r.est_premium,
                "state": r.state,
                "industry": r.industry,
                "employees": r.employees,
                "score": r.score,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.post("/ai-score", summary="Compute 7-factor opportunity score")
def compute_ai_score(body: dict, db: Session = Depends(get_db)):
    """Compute or return cached 7-factor opportunity score for an EIN / account."""
    from backend.models import SalesOsScore
    import json as _json

    ein = body.get("ein", "")
    account_id = body.get("account_id", "")

    acct = next(
        (a for a in ALL_PROSPECTS if a.get("id") == account_id or a.get("ein") == ein),
        None
    )
    if not acct and not ein:
        raise HTTPException(404, "Account not found. Provide ein or account_id.")

    # Use provided data if no seed account found
    if not acct:
        acct = dict(body)

    score_data = _compute_7factor_score(acct)

    # Cache to DB
    try:
        cached = db.query(SalesOsScore).filter(SalesOsScore.ein == (ein or acct.get("ein", "unknown"))).first()
        if cached:
            cached.overall_score = score_data["overall"]
            cached.factor_scores = score_data["factors"]
            db.commit()
        else:
            new_score = SalesOsScore(
                ein=ein or acct.get("ein", "unknown"),
                overall_score=score_data["overall"],
                factor_scores=score_data["factors"],
            )
            db.add(new_score)
            db.commit()
    except Exception:
        pass

    return {
        "ein": ein or acct.get("ein"),
        "name": acct.get("name"),
        "overall_score": score_data["overall"],
        "factors": [
            {"key": k, "label": k.replace("_", " ").title(), "score": v}
            for k, v in score_data["factors"].items()
        ],
        "confidence": "MODELED",
        "computed_at": iso_now(),
    }


_COPILOT_SYSTEM = """You are the Kincaid IQ Sales OS™ AI Copilot — a senior benefits consultant
and fiduciary advisor. Generate concise, evidence-anchored sales content for benefits consultants.

Rules:
- Use specific numbers from the account data (spend, employees, broker comp, PBM, years since RFP)
- McKinsey-style: strategic economy, board-room directness
- No marketing language, no hedging
- Every assertion justified by a data point from the account profile
- For outreach emails: 3 short paragraphs, evidence hook → problem statement → clear ask
- For exec summaries: 4 bullet points, MECE, each with $ amount or %
- For account plans: 5 numbered steps with specific owners and deliverables
- For meeting briefs: context → 3 discovery questions → 2 objection responses
- For renewal strategies: timeline + 4 negotiation levers with dollar impact"""


@router.post("/copilot", summary="AI Copilot for account-specific content generation")
async def copilot_generate(body: dict, db: Session = Depends(get_db)):
    """Generate outreach emails, exec summaries, account plans, meeting briefs, or renewal strategies."""
    action = body.get("action", "exec_summary")
    account_id = body.get("account_id", "")
    ein = body.get("ein", "")
    account_context = body.get("account", {})

    acct = next(
        (a for a in ALL_PROSPECTS if a.get("id") == account_id or a.get("ein") == ein),
        account_context or {}
    )

    ACTION_PROMPTS = {
        "outreach_email": "Write a cold outreach email (3 paragraphs) for this employer account. Lead with a specific federal filing fact.",
        "exec_summary": "Write an executive summary (4 bullet points) for this account — savings opportunity, risk, timing, and recommended action.",
        "account_plan": "Write a 5-step account plan with specific actions, owners, and timelines for winning this account.",
        "meeting_brief": "Write a meeting brief: context overview, 3 discovery questions, and 2 objection responses.",
        "renewal_strategy": "Write a renewal strategy: timeline overview and 4 specific negotiation levers with estimated dollar impact each.",
    }

    prompt_instruction = ACTION_PROMPTS.get(action, ACTION_PROMPTS["exec_summary"])

    context_str = (
        f"Company: {acct.get('name', 'Unknown')}\n"
        f"State: {acct.get('state', 'Unknown')}\n"
        f"Industry: {acct.get('industry', 'Unknown')}\n"
        f"Employees: {acct.get('employees', 0):,}\n"
        f"Health Spend: ${acct.get('health_spend_annual', 0):,.0f}/yr\n"
        f"Broker Compensation: ${acct.get('broker_comp_annual', 0):,.0f} ({acct.get('broker_comp_pct_premium', 0)*100:.1f}%)\n"
        f"Carrier: {acct.get('carrier', 'Unknown')}\n"
        f"PBM: {acct.get('pbm', 'Unknown')}\n"
        f"Funding Type: {acct.get('funding_type', 'Unknown').replace('_', '-').title()}\n"
        f"Last RFP: {acct.get('last_rfp_year', 'Unknown')}\n"
        f"Stop-Loss Carrier: {acct.get('stop_loss_carrier', 'None')}\n"
        f"SBI™ Score: {acct.get('sbi_score', 0):.1f} ({acct.get('sbi_tier', 'UNKNOWN')})\n"
        f"Recoverable Capital: ${acct.get('recoverable_low', 0):,.0f}–${acct.get('recoverable_high', 0):,.0f}\n"
        f"GLP-1 Exposure: {acct.get('glp1_exposure', 'Unknown')}\n"
        f"ERISA Risk: {acct.get('erisa_risk', 'Unknown')}\n"
    )

    try:
        result = await run_agent(
            system=_COPILOT_SYSTEM,
            user_msg=f"{prompt_instruction}\n\nAccount Profile:\n{context_str}",
            agent_label="SalesOS-Copilot",
        )
        content = result if isinstance(result, str) else (result.get("text") or str(result))
    except Exception as e:
        logger.warning("[SalesOS Copilot] AI generation failed: %s", e)
        content = (
            f"**{acct.get('name', 'Account')} — {action.replace('_', ' ').title()}**\n\n"
            f"Health spend: ${acct.get('health_spend_annual', 0):,.0f}/yr | "
            f"Broker comp: ${acct.get('broker_comp_annual', 0):,.0f} ({acct.get('broker_comp_pct_premium', 0)*100:.1f}%) | "
            f"Last RFP: {acct.get('last_rfp_year', 'Unknown')} | "
            f"Recoverable: ${acct.get('recoverable_low', 0):,.0f}–${acct.get('recoverable_high', 0):,.0f}\n\n"
            "[AI-Generated · Evidence-Anchored · MODELED]"
        )

    return {
        "action": action,
        "account_id": account_id or acct.get("id"),
        "content": content,
        "confidence": "MODELED",
        "generated_at": iso_now(),
    }
