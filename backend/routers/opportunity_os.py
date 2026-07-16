"""
Brown & Brown Kincaid Health Opportunity Intelligence OS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Internal sales-enablement intelligence. Evaluates every healthcare-focused
Brown & Brown producer, consultant, practice leader, and regional executive to
determine where Kincaid Health can create the greatest measurable value.

This is a strategic consulting platform, not a CRM. It answers one question for
each executive: how can Kincaid Health help this person win more business, retain
more clients, grow consulting revenue, reduce fiduciary risk, and differentiate
Brown & Brown in the marketplace.

No authoritative Brown & Brown HR roster exists inside the platform, so the
executive population is a deterministic modeled roster (the same demo pattern
used by Stewardship, Broker Console, and Sales OS). Every dollar figure is a
MODELED estimate derived from the executive's book attributes; each names the
evidence that would upgrade it to CERTIFIED.

Endpoints:
  GET  /api/opportunity-os/dashboard                    - command center rollup
  GET  /api/opportunity-os/executives                   - roster (ranked cards)
  GET  /api/opportunity-os/executives/{exec_id}         - full 7-module profile
  GET  /api/opportunity-os/executives/{exec_id}/playbook - AI executive playbook
  POST /api/opportunity-os/copilot                      - AI co-pilot Q&A
  GET  /api/opportunity-os/health                       - health check
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.agents.base import run_agent
from backend.auth import get_current_user
from backend.duckdb import get_duck, duck_available

logger = logging.getLogger("kincaid.opportunity_os")

router = APIRouter(prefix="/api/opportunity-os", tags=["opportunity-os"])


# ── Helpers ─────────────────────────────────────────────────────────────────────

def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash(data) -> str:
    return hashlib.sha256(
        json.dumps(data, sort_keys=True, default=str).encode()
    ).hexdigest()


def _clamp(v: float) -> int:
    return int(max(0, min(100, round(v))))


class ConfidenceTier(str, Enum):
    CERTIFIED = "CERTIFIED"
    MODELED = "MODELED"
    INSUFFICIENT = "INSUFFICIENT_EVIDENCE"


# ── Kincaid Health product catalog ──────────────────────────────────────────────────
# savings_factor is applied to the relevant slice of healthcare spend under
# advisement; take_rate models the incremental consulting revenue Brown & Brown
# captures on the engagement. effort/visibility are qualitative labels.

PRODUCTS = {
    "rx_defense": {
        "name": "PBM Contract Clarity 360",
        "category": "Pharmacy",
        "savings_factor": 0.034,   # ~28% Rx share of spend x ~12% recoverable
        "take_rate": 0.09,
        "effort": "Medium",
        "visibility": "CFO",
        "differentiation": "PBM contract forensics no competitor can match",
        "eligible": lambda b: b["high_pharmacy_spend_clients"],
        "evidence": "PBM contract, claims file, and rebate remittance",
    },
    "pbm_xray": {
        "name": "PBM Contract X-Ray",
        "category": "Pharmacy",
        "savings_factor": 0.021,
        "take_rate": 0.10,
        "effort": "Low",
        "visibility": "CFO",
        "differentiation": "Clause-level fiduciary scoring of the PBM contract",
        "eligible": lambda b: b["high_pharmacy_spend_clients"],
        "evidence": "executed PBM contract and pricing exhibits",
    },
    "claims_recovery": {
        "name": "Claims Recovery IQ",
        "category": "Claims",
        "savings_factor": 0.019,
        "take_rate": 0.11,
        "effort": "Medium",
        "visibility": "CFO",
        "differentiation": "Overpayment recovery tied to remittance evidence",
        "eligible": lambda b: b["self_funded_clients"],
        "evidence": "835 and 837 claim and remittance files",
    },
    "stop_loss": {
        "name": "Stop Loss IQ",
        "category": "Risk",
        "savings_factor": 0.014,
        "take_rate": 0.08,
        "effort": "Low",
        "visibility": "CFO",
        "differentiation": "Attachment-point and laser optimization vs the market",
        "eligible": lambda b: b["self_funded_clients"],
        "evidence": "stop-loss policy, claims lag, and large-claimant file",
    },
    "erisa_fiduciary": {
        "name": "ERISA Fiduciary IQ",
        "category": "Governance",
        "savings_factor": 0.008,   # modeled risk avoidance, not cash savings
        "take_rate": 0.14,
        "effort": "Low",
        "visibility": "Board",
        "differentiation": "Post-CAA fiduciary defensibility file for the plan",
        "eligible": lambda b: b["fiduciary_complexity_accounts"],
        "evidence": "plan documents, committee minutes, and fee disclosures",
    },
    "network_iq": {
        "name": "Network IQ",
        "category": "Network",
        "savings_factor": 0.028,
        "take_rate": 0.08,
        "effort": "Medium",
        "visibility": "CFO",
        "differentiation": "Out-of-network leakage and adequacy scoring",
        "eligible": lambda b: max(1, round(b["num_clients"] * 0.5)),
        "evidence": "provider network file and paid-claims detail",
    },
    "stewardship": {
        "name": "Health Stewardship Reports",
        "category": "Reporting",
        "savings_factor": 0.006,
        "take_rate": 0.16,
        "effort": "Low",
        "visibility": "Board",
        "differentiation": "Board-grade annual stewardship narrative with receipts",
        "eligible": lambda b: b["large_employer_exposure"] + b["fiduciary_complexity_accounts"],
        "evidence": "prior-year plan financials and vendor scorecards",
    },
    "board_dashboards": {
        "name": "Executive Board Dashboards",
        "category": "Reporting",
        "savings_factor": 0.004,
        "take_rate": 0.13,
        "effort": "Low",
        "visibility": "Board",
        "differentiation": "One-screen four-tile board view, every number clickable",
        "eligible": lambda b: b["large_employer_exposure"],
        "evidence": "plan financial feed and KPI definitions",
    },
    "financial_intelligence": {
        "name": "Healthcare Financial Intelligence",
        "category": "Analytics",
        "savings_factor": 0.012,
        "take_rate": 0.12,
        "effort": "Medium",
        "visibility": "CFO",
        "differentiation": "Healthcare EBITDA and PEPY modeling for finance",
        "eligible": lambda b: b["large_employer_exposure"] + b["high_growth_accounts"],
        "evidence": "audited plan financials and enrollment history",
    },
    "predictive_modeling": {
        "name": "Predictive Cost Modeling",
        "category": "Analytics",
        "savings_factor": 0.011,
        "take_rate": 0.10,
        "effort": "High",
        "visibility": "CFO",
        "differentiation": "Forward cost and GLP-1 exposure simulation",
        "eligible": lambda b: b["self_funded_clients"],
        "evidence": "multi-year claims and eligibility history",
    },
    "form_5500": {
        "name": "5500 Intelligence",
        "category": "Analytics",
        "savings_factor": 0.005,
        "take_rate": 0.09,
        "effort": "Low",
        "visibility": "Producer",
        "differentiation": "Federal Form 5500 targeting and benchmarking",
        "eligible": lambda b: b["num_clients"],
        "evidence": "public DOL Form 5500 filings (already available)",
    },
    "health_intelligence": {
        "name": "Health Intelligence",
        "category": "Analytics",
        "savings_factor": 0.010,
        "take_rate": 0.10,
        "effort": "Medium",
        "visibility": "CFO",
        "differentiation": "Condition-level and specialty-drug exposure intelligence",
        "eligible": lambda b: b["high_pharmacy_spend_clients"] + b["high_growth_accounts"],
        "evidence": "medical and pharmacy claims with condition coding",
    },
}


# ── Scoring weights (Module 5) ──────────────────────────────────────────────────
# Fourteen weighted components, weights sum to 1.00. Disclosed for defensibility.

WEIGHTS = {
    "strategic_alignment": 0.10,
    "revenue_opportunity": 0.12,
    "healthcare_complexity": 0.08,
    "consulting_maturity": 0.07,
    "ai_readiness": 0.08,
    "innovation_readiness": 0.05,
    "cross_sell_potential": 0.08,
    "competitive_differentiation": 0.06,
    "relationship_strength": 0.06,
    "executive_sponsorship": 0.07,
    "implementation_readiness": 0.06,
    "expected_roi": 0.07,
    "expansion_potential": 0.05,
    "long_term_account_value": 0.05,
}

SCORE_LABELS = {
    "strategic_alignment": "Strategic Alignment",
    "revenue_opportunity": "Revenue Opportunity",
    "healthcare_complexity": "Healthcare Complexity",
    "consulting_maturity": "Consulting Maturity",
    "ai_readiness": "AI Readiness",
    "innovation_readiness": "Innovation Readiness",
    "cross_sell_potential": "Cross-Sell Potential",
    "competitive_differentiation": "Competitive Differentiation",
    "relationship_strength": "Relationship Strength",
    "executive_sponsorship": "Executive Sponsorship",
    "implementation_readiness": "Implementation Readiness",
    "expected_roi": "Expected ROI",
    "expansion_potential": "Expansion Potential",
    "long_term_account_value": "Long-Term Account Value",
}

INNOVATION_MAP = {"Visionary": 95, "Early Adopter": 82, "Pragmatist": 66, "Skeptic": 46, "Late Majority": 34}
AUTHORITY_MAP = {"Enterprise": 95, "High": 80, "Medium": 62, "Emerging": 48}
INFLUENCE_MAP = {"Enterprise": 95, "Regional": 80, "Office": 62, "Team": 48}


# ── Deterministic roster ────────────────────────────────────────────────────────
# Seed attributes are hand-authored per executive for realistic variety; all
# derived fields (component scores, solution mapping, dollar impact, discovered
# needs) are computed by the functions below so the numbers stay internally
# consistent and reproducible.

ROSTER = [
    {
        "id": "bb-marchetti",
        "name": "Daniel Marchetti",
        "title": "Regional President, Employee Benefits",
        "role_type": "Regional President",
        "region": "Southeast",
        "office": "Tampa, FL",
        "tenure_years": 21,
        "certifications": ["CEBS", "RHU", "GBA"],
        "communication_style": "Board-level, data-first",
        "innovation_profile": "Visionary",
        "decision_authority": "Enterprise",
        "leadership_influence": "Enterprise",
        "industry_specialization": ["Healthcare Systems", "Higher Education", "Manufacturing"],
        "employer_size_focus": "2,000 to 15,000 lives",
        "client_segmentation": "Large self-funded employers and health systems",
        "revenue_responsibility": 46_000_000,
        "healthcare_consulting_expertise": 92,
        "pbm_knowledge": 88,
        "erisa_knowledge": 84,
        "data_analytics_maturity": 80,
        "tech_adoption": 86,
        "strategic_priorities": [
            "Convert three health-system prospects with self-funded conversions",
            "Institutionalize fiduciary governance across the region",
            "Grow consulting revenue 18 percent without adding headcount",
        ],
        "growth_initiatives": ["Health-system vertical", "Captive expansion"],
        "relationship_network": "Sits on two hospital finance advisory boards",
        "book": {
            "num_clients": 38, "avg_client_size": 3100,
            "healthcare_spend_under_advisement": 1_240_000_000,
            "self_funded_pct": 76, "captive_participation": 7,
            "large_employer_exposure": 19, "pe_portfolio_exposure": 4,
            "high_growth_accounts": 8, "fiduciary_complexity_accounts": 14,
            "high_pharmacy_spend_clients": 16,
            "industry_mix": [
                {"industry": "Healthcare Systems", "pct": 34},
                {"industry": "Higher Education", "pct": 22},
                {"industry": "Manufacturing", "pct": 21},
                {"industry": "Public Sector", "pct": 13},
                {"industry": "Other", "pct": 10},
            ],
            "renewal_by_quarter": {"Q1": 15, "Q2": 6, "Q3": 5, "Q4": 12},
        },
    },
    {
        "id": "bb-okafor",
        "name": "Adaeze Okafor",
        "title": "Employee Benefits Practice Leader",
        "role_type": "Practice Leader",
        "region": "Mid-Atlantic",
        "office": "Washington, DC",
        "tenure_years": 15,
        "certifications": ["CEBS", "FLMI"],
        "communication_style": "Consultative, analytical",
        "innovation_profile": "Early Adopter",
        "decision_authority": "High",
        "leadership_influence": "Regional",
        "industry_specialization": ["Federal Contractors", "Professional Services", "Nonprofit"],
        "employer_size_focus": "500 to 5,000 lives",
        "client_segmentation": "Government contractors with fiduciary exposure",
        "revenue_responsibility": 28_500_000,
        "healthcare_consulting_expertise": 88,
        "pbm_knowledge": 74,
        "erisa_knowledge": 91,
        "data_analytics_maturity": 78,
        "tech_adoption": 80,
        "strategic_priorities": [
            "Lead with fiduciary governance after the CAA fee-disclosure wave",
            "Build a repeatable stewardship-report motion",
            "Displace two incumbent brokers on governance quality",
        ],
        "growth_initiatives": ["Fiduciary governance offering", "Federal vertical"],
        "relationship_network": "Chairs a regional ERISA practitioner forum",
        "book": {
            "num_clients": 31, "avg_client_size": 1650,
            "healthcare_spend_under_advisement": 540_000_000,
            "self_funded_pct": 61, "captive_participation": 3,
            "large_employer_exposure": 9, "pe_portfolio_exposure": 2,
            "high_growth_accounts": 5, "fiduciary_complexity_accounts": 18,
            "high_pharmacy_spend_clients": 9,
            "industry_mix": [
                {"industry": "Federal Contractors", "pct": 38},
                {"industry": "Professional Services", "pct": 27},
                {"industry": "Nonprofit", "pct": 19},
                {"industry": "Technology", "pct": 16},
            ],
            "renewal_by_quarter": {"Q1": 18, "Q2": 4, "Q3": 3, "Q4": 6},
        },
    },
    {
        "id": "bb-reyes",
        "name": "Marcus Reyes",
        "title": "Senior Producer, Benefits",
        "role_type": "Senior Producer",
        "region": "Southwest",
        "office": "Dallas, TX",
        "tenure_years": 12,
        "certifications": ["RHU", "REBC"],
        "communication_style": "Relationship-driven, high energy",
        "innovation_profile": "Early Adopter",
        "decision_authority": "High",
        "leadership_influence": "Office",
        "industry_specialization": ["Energy", "Construction", "Transportation"],
        "employer_size_focus": "300 to 3,000 lives",
        "client_segmentation": "Self-funded middle-market with high pharmacy trend",
        "revenue_responsibility": 19_800_000,
        "healthcare_consulting_expertise": 76,
        "pbm_knowledge": 90,
        "erisa_knowledge": 68,
        "data_analytics_maturity": 66,
        "tech_adoption": 74,
        "strategic_priorities": [
            "Attack specialty and GLP-1 trend in the energy book",
            "Win on PBM transparency against fully-insured incumbents",
            "Move five accounts to level-funded or self-funded",
        ],
        "growth_initiatives": ["Pharmacy carve-out plays", "Energy vertical"],
        "relationship_network": "Active in two energy HR roundtables",
        "book": {
            "num_clients": 27, "avg_client_size": 1200,
            "healthcare_spend_under_advisement": 360_000_000,
            "self_funded_pct": 58, "captive_participation": 4,
            "large_employer_exposure": 6, "pe_portfolio_exposure": 5,
            "high_growth_accounts": 7, "fiduciary_complexity_accounts": 6,
            "high_pharmacy_spend_clients": 15,
            "industry_mix": [
                {"industry": "Energy", "pct": 41},
                {"industry": "Construction", "pct": 26},
                {"industry": "Transportation", "pct": 21},
                {"industry": "Other", "pct": 12},
            ],
            "renewal_by_quarter": {"Q1": 9, "Q2": 5, "Q3": 4, "Q4": 9},
        },
    },
    {
        "id": "bb-lindqvist",
        "name": "Karin Lindqvist",
        "title": "Sales Vice President, Benefits",
        "role_type": "Sales VP",
        "region": "Midwest",
        "office": "Chicago, IL",
        "tenure_years": 18,
        "certifications": ["CEBS", "CLU"],
        "communication_style": "Executive, outcome-oriented",
        "innovation_profile": "Pragmatist",
        "decision_authority": "Enterprise",
        "leadership_influence": "Regional",
        "industry_specialization": ["Manufacturing", "Food & Beverage", "Logistics"],
        "employer_size_focus": "1,000 to 8,000 lives",
        "client_segmentation": "Industrial self-funded employers",
        "revenue_responsibility": 34_200_000,
        "healthcare_consulting_expertise": 82,
        "pbm_knowledge": 72,
        "erisa_knowledge": 76,
        "data_analytics_maturity": 70,
        "tech_adoption": 68,
        "strategic_priorities": [
            "Standardize stop-loss optimization across the region",
            "Introduce predictive cost modeling to top 10 accounts",
            "Coach producers on data-led renewals",
        ],
        "growth_initiatives": ["Stop-loss center of excellence", "Producer enablement"],
        "relationship_network": "Board member of a regional manufacturers association",
        "book": {
            "num_clients": 33, "avg_client_size": 2200,
            "healthcare_spend_under_advisement": 720_000_000,
            "self_funded_pct": 69, "captive_participation": 6,
            "large_employer_exposure": 12, "pe_portfolio_exposure": 3,
            "high_growth_accounts": 4, "fiduciary_complexity_accounts": 9,
            "high_pharmacy_spend_clients": 11,
            "industry_mix": [
                {"industry": "Manufacturing", "pct": 44},
                {"industry": "Food & Beverage", "pct": 24},
                {"industry": "Logistics", "pct": 20},
                {"industry": "Other", "pct": 12},
            ],
            "renewal_by_quarter": {"Q1": 14, "Q2": 7, "Q3": 4, "Q4": 8},
        },
    },
    {
        "id": "bb-nakamura",
        "name": "Grace Nakamura",
        "title": "Practice Leader, Data & Analytics",
        "role_type": "Practice Leader",
        "region": "West",
        "office": "San Francisco, CA",
        "tenure_years": 10,
        "certifications": ["ASA", "MAAA"],
        "communication_style": "Quantitative, precise",
        "innovation_profile": "Visionary",
        "decision_authority": "High",
        "leadership_influence": "Regional",
        "industry_specialization": ["Technology", "Life Sciences", "Venture-Backed Growth"],
        "employer_size_focus": "500 to 6,000 lives",
        "client_segmentation": "High-growth technology and life sciences employers",
        "revenue_responsibility": 24_600_000,
        "healthcare_consulting_expertise": 84,
        "pbm_knowledge": 80,
        "erisa_knowledge": 72,
        "data_analytics_maturity": 94,
        "tech_adoption": 95,
        "strategic_priorities": [
            "Make predictive modeling the default in every finalist meeting",
            "Quantify healthcare EBITDA impact for PE-backed clients",
            "Stand up a data-science-led consulting tier",
        ],
        "growth_initiatives": ["Predictive analytics tier", "PE portfolio motion"],
        "relationship_network": "Advises two venture healthcare funds",
        "book": {
            "num_clients": 26, "avg_client_size": 1400,
            "healthcare_spend_under_advisement": 430_000_000,
            "self_funded_pct": 64, "captive_participation": 2,
            "large_employer_exposure": 7, "pe_portfolio_exposure": 11,
            "high_growth_accounts": 13, "fiduciary_complexity_accounts": 7,
            "high_pharmacy_spend_clients": 12,
            "industry_mix": [
                {"industry": "Technology", "pct": 46},
                {"industry": "Life Sciences", "pct": 28},
                {"industry": "Financial Services", "pct": 14},
                {"industry": "Other", "pct": 12},
            ],
            "renewal_by_quarter": {"Q1": 11, "Q2": 8, "Q3": 3, "Q4": 4},
        },
    },
    {
        "id": "bb-donnelly",
        "name": "Sean Donnelly",
        "title": "Producer, Benefits",
        "role_type": "Producer",
        "region": "Northeast",
        "office": "Boston, MA",
        "tenure_years": 7,
        "certifications": ["RHU"],
        "communication_style": "Personable, developing gravitas",
        "innovation_profile": "Pragmatist",
        "decision_authority": "Medium",
        "leadership_influence": "Team",
        "industry_specialization": ["Professional Services", "Retail", "Hospitality"],
        "employer_size_focus": "150 to 1,500 lives",
        "client_segmentation": "Fully-insured and level-funded middle-market",
        "revenue_responsibility": 9_400_000,
        "healthcare_consulting_expertise": 62,
        "pbm_knowledge": 58,
        "erisa_knowledge": 55,
        "data_analytics_maturity": 52,
        "tech_adoption": 70,
        "strategic_priorities": [
            "Convert fully-insured accounts to level-funded",
            "Build a data story to defend renewals",
            "Establish a niche in hospitality",
        ],
        "growth_initiatives": ["Level-funded conversions", "Hospitality niche"],
        "relationship_network": "Emerging presence in local SHRM chapter",
        "book": {
            "num_clients": 22, "avg_client_size": 620,
            "healthcare_spend_under_advisement": 110_000_000,
            "self_funded_pct": 34, "captive_participation": 1,
            "large_employer_exposure": 2, "pe_portfolio_exposure": 1,
            "high_growth_accounts": 4, "fiduciary_complexity_accounts": 3,
            "high_pharmacy_spend_clients": 5,
            "industry_mix": [
                {"industry": "Professional Services", "pct": 40},
                {"industry": "Retail", "pct": 30},
                {"industry": "Hospitality", "pct": 22},
                {"industry": "Other", "pct": 8},
            ],
            "renewal_by_quarter": {"Q1": 12, "Q2": 3, "Q3": 2, "Q4": 5},
        },
    },
    {
        "id": "bb-alvarez",
        "name": "Priya Alvarez",
        "title": "Employee Benefits Consultant",
        "role_type": "Consultant",
        "region": "Southwest",
        "office": "Phoenix, AZ",
        "tenure_years": 14,
        "certifications": ["CEBS", "PHR"],
        "communication_style": "Advisory, HR-fluent",
        "innovation_profile": "Early Adopter",
        "decision_authority": "High",
        "leadership_influence": "Office",
        "industry_specialization": ["Public Sector", "Education", "Healthcare Systems"],
        "employer_size_focus": "1,000 to 12,000 lives",
        "client_segmentation": "Public entities and school districts",
        "revenue_responsibility": 22_100_000,
        "healthcare_consulting_expertise": 80,
        "pbm_knowledge": 70,
        "erisa_knowledge": 66,
        "data_analytics_maturity": 68,
        "tech_adoption": 72,
        "strategic_priorities": [
            "Bring stewardship reporting to every public-entity board",
            "Reduce pharmacy trend in large public plans",
            "Win two hospital district RFPs on transparency",
        ],
        "growth_initiatives": ["Public-entity stewardship", "Hospital districts"],
        "relationship_network": "Frequent speaker at public-sector benefits conferences",
        "book": {
            "num_clients": 24, "avg_client_size": 3600,
            "healthcare_spend_under_advisement": 610_000_000,
            "self_funded_pct": 71, "captive_participation": 2,
            "large_employer_exposure": 13, "pe_portfolio_exposure": 0,
            "high_growth_accounts": 3, "fiduciary_complexity_accounts": 11,
            "high_pharmacy_spend_clients": 10,
            "industry_mix": [
                {"industry": "Public Sector", "pct": 42},
                {"industry": "Education", "pct": 31},
                {"industry": "Healthcare Systems", "pct": 19},
                {"industry": "Other", "pct": 8},
            ],
            "renewal_by_quarter": {"Q1": 6, "Q2": 4, "Q3": 3, "Q4": 11},
        },
    },
    {
        "id": "bb-whitfield",
        "name": "Robert Whitfield",
        "title": "Producer, Benefits",
        "role_type": "Producer",
        "region": "Southeast",
        "office": "Atlanta, GA",
        "tenure_years": 26,
        "certifications": ["CLU", "ChFC"],
        "communication_style": "Traditional, relationship-first",
        "innovation_profile": "Skeptic",
        "decision_authority": "Medium",
        "leadership_influence": "Office",
        "industry_specialization": ["Manufacturing", "Distribution", "Family Business"],
        "employer_size_focus": "200 to 2,000 lives",
        "client_segmentation": "Long-tenured fully-insured relationships",
        "revenue_responsibility": 16_700_000,
        "healthcare_consulting_expertise": 58,
        "pbm_knowledge": 50,
        "erisa_knowledge": 60,
        "data_analytics_maturity": 40,
        "tech_adoption": 38,
        "strategic_priorities": [
            "Protect a loyal but under-consulted book from disruption",
            "Modernize renewals before a competitor brings data",
            "Transition relationships toward a successor producer",
        ],
        "growth_initiatives": ["Book modernization", "Succession planning"],
        "relationship_network": "Deep multi-decade client relationships",
        "book": {
            "num_clients": 29, "avg_client_size": 780,
            "healthcare_spend_under_advisement": 190_000_000,
            "self_funded_pct": 29, "captive_participation": 0,
            "large_employer_exposure": 3, "pe_portfolio_exposure": 1,
            "high_growth_accounts": 2, "fiduciary_complexity_accounts": 4,
            "high_pharmacy_spend_clients": 7,
            "industry_mix": [
                {"industry": "Manufacturing", "pct": 37},
                {"industry": "Distribution", "pct": 33},
                {"industry": "Family Business", "pct": 22},
                {"industry": "Other", "pct": 8},
            ],
            "renewal_by_quarter": {"Q1": 16, "Q2": 4, "Q3": 3, "Q4": 6},
        },
    },
    {
        "id": "bb-castellano",
        "name": "Elena Castellano",
        "title": "Regional President, Benefits",
        "role_type": "Regional President",
        "region": "West",
        "office": "Denver, CO",
        "tenure_years": 19,
        "certifications": ["CEBS", "RHU", "CLU"],
        "communication_style": "Strategic, board-ready",
        "innovation_profile": "Early Adopter",
        "decision_authority": "Enterprise",
        "leadership_influence": "Enterprise",
        "industry_specialization": ["Technology", "Healthcare Systems", "Public Sector"],
        "employer_size_focus": "1,500 to 20,000 lives",
        "client_segmentation": "Enterprise self-funded employers",
        "revenue_responsibility": 41_300_000,
        "healthcare_consulting_expertise": 90,
        "pbm_knowledge": 82,
        "erisa_knowledge": 80,
        "data_analytics_maturity": 84,
        "tech_adoption": 82,
        "strategic_priorities": [
            "Make Kincaid Health the regional finalist differentiator",
            "Grow the enterprise self-funded segment 20 percent",
            "Build a governance and analytics center of excellence",
        ],
        "growth_initiatives": ["Enterprise segment", "Analytics center of excellence"],
        "relationship_network": "Chairs the regional leadership council",
        "book": {
            "num_clients": 36, "avg_client_size": 4200,
            "healthcare_spend_under_advisement": 1_060_000_000,
            "self_funded_pct": 78, "captive_participation": 8,
            "large_employer_exposure": 18, "pe_portfolio_exposure": 5,
            "high_growth_accounts": 9, "fiduciary_complexity_accounts": 13,
            "high_pharmacy_spend_clients": 15,
            "industry_mix": [
                {"industry": "Technology", "pct": 33},
                {"industry": "Healthcare Systems", "pct": 27},
                {"industry": "Public Sector", "pct": 24},
                {"industry": "Other", "pct": 16},
            ],
            "renewal_by_quarter": {"Q1": 13, "Q2": 7, "Q3": 6, "Q4": 10},
        },
    },
    {
        "id": "bb-osei",
        "name": "Kwame Osei",
        "title": "Producer, Emerging Markets",
        "role_type": "Producer",
        "region": "Midwest",
        "office": "Minneapolis, MN",
        "tenure_years": 5,
        "certifications": ["RHU"],
        "communication_style": "Data-native, fast-moving",
        "innovation_profile": "Visionary",
        "decision_authority": "Emerging",
        "leadership_influence": "Team",
        "industry_specialization": ["Technology", "Healthcare Startups", "Professional Services"],
        "employer_size_focus": "100 to 1,200 lives",
        "client_segmentation": "Venture-backed and high-growth employers",
        "revenue_responsibility": 6_800_000,
        "healthcare_consulting_expertise": 60,
        "pbm_knowledge": 64,
        "erisa_knowledge": 50,
        "data_analytics_maturity": 82,
        "tech_adoption": 92,
        "strategic_priorities": [
            "Win new logos with an analytics-first pitch",
            "Grow a self-funded book from a fully-insured base",
            "Use predictive modeling to punch above tenure",
        ],
        "growth_initiatives": ["Analytics-first new business", "Startup vertical"],
        "relationship_network": "Plugged into the regional startup ecosystem",
        "book": {
            "num_clients": 18, "avg_client_size": 480,
            "healthcare_spend_under_advisement": 72_000_000,
            "self_funded_pct": 39, "captive_participation": 0,
            "large_employer_exposure": 1, "pe_portfolio_exposure": 6,
            "high_growth_accounts": 9, "fiduciary_complexity_accounts": 2,
            "high_pharmacy_spend_clients": 4,
            "industry_mix": [
                {"industry": "Technology", "pct": 49},
                {"industry": "Healthcare Startups", "pct": 27},
                {"industry": "Professional Services", "pct": 18},
                {"industry": "Other", "pct": 6},
            ],
            "renewal_by_quarter": {"Q1": 7, "Q2": 5, "Q3": 3, "Q4": 3},
        },
    },
]

_ROSTER_BY_ID = {e["id"]: e for e in ROSTER}


# ── Derivation: book normalization ──────────────────────────────────────────────

def _normalize_book(seed_book: dict) -> dict:
    """Return a book dict with derived counts the product catalog and scoring rely on."""
    b = dict(seed_book)
    b["fully_insured_pct"] = 100 - b["self_funded_pct"]
    b["self_funded_clients"] = max(0, round(b["num_clients"] * b["self_funded_pct"] / 100))
    b["fully_insured_clients"] = b["num_clients"] - b["self_funded_clients"]
    return b


# ── Derivation: Module 5 scoring ────────────────────────────────────────────────

def _component_scores(ex: dict, b: dict) -> dict:
    hce = ex["healthcare_consulting_expertise"]
    pbm = ex["pbm_knowledge"]
    erisa = ex["erisa_knowledge"]
    dam = ex["data_analytics_maturity"]
    tech = ex["tech_adoption"]
    sf = b["self_funded_pct"]
    tenure = ex["tenure_years"]
    spend = b["healthcare_spend_under_advisement"]
    n = max(1, b["num_clients"])

    inv = INNOVATION_MAP[ex["innovation_profile"]]
    auth = AUTHORITY_MAP[ex["decision_authority"]]
    infl = INFLUENCE_MAP[ex["leadership_influence"]]

    spend_score = _clamp(30 + (spend / 1_000_000_000) * 55)
    pharma_ratio = b["high_pharmacy_spend_clients"] / n
    fiduciary_ratio = b["fiduciary_complexity_accounts"] / n
    growth_ratio = b["high_growth_accounts"] / n
    large_ratio = b["large_employer_exposure"] / n
    tenure_score = min(100, tenure * 5)
    scale_score = min(100, n * 2.5)

    return {
        "strategic_alignment": _clamp(0.45 * sf + 0.35 * hce + 0.20 * inv),
        "revenue_opportunity": _clamp(0.50 * spend_score + 40 * pharma_ratio + 0.10 * hce),
        "healthcare_complexity": _clamp(0.40 * sf + 60 * fiduciary_ratio + 40 * pharma_ratio + 0.10 * erisa),
        "consulting_maturity": _clamp(0.50 * hce + 0.30 * erisa + 0.20 * dam),
        "ai_readiness": _clamp(0.45 * tech + 0.35 * dam + 0.20 * inv),
        "innovation_readiness": _clamp(0.70 * inv + 0.30 * tech),
        "cross_sell_potential": _clamp(0.40 * scale_score + 0.30 * hce + 0.30 * inv),
        "competitive_differentiation": _clamp(0.40 * hce + 0.30 * pbm + 0.30 * inv),
        "relationship_strength": _clamp(0.40 * tenure_score + 0.35 * auth + 0.25 * infl),
        "executive_sponsorship": _clamp(0.55 * auth + 0.45 * infl),
        "implementation_readiness": _clamp(0.45 * tech + 0.35 * dam + 0.20 * auth),
        "expected_roi": _clamp(0.50 * spend_score + 30 * pharma_ratio + 0.20 * hce),
        "expansion_potential": _clamp(0.45 * min(100, growth_ratio * 300) + 0.30 * spend_score + 0.25 * inv),
        "long_term_account_value": _clamp(0.50 * spend_score + 0.25 * tenure_score + 25 * large_ratio),
    }


def _overall_score(components: dict) -> int:
    return int(round(sum(components[k] * WEIGHTS[k] for k in WEIGHTS)))


def _priority_tier(overall: int) -> str:
    if overall >= 78:
        return "TIER_1"
    if overall >= 62:
        return "TIER_2"
    return "TIER_3"


# ── Derivation: Module 4 solution mapping + dollar impact ────────────────────────

def _relevant_products(ex: dict, b: dict) -> list:
    """Select the products worth pursuing for this executive's book, with rationale."""
    picks = []
    if b["high_pharmacy_spend_clients"] >= 5:
        picks += ["rx_defense", "pbm_xray", "health_intelligence"]
    if b["self_funded_clients"] >= 4:
        picks += ["claims_recovery", "stop_loss", "predictive_modeling"]
    if b["fiduciary_complexity_accounts"] >= 4:
        picks.append("erisa_fiduciary")
    if b["large_employer_exposure"] >= 5:
        picks += ["board_dashboards", "financial_intelligence"]
    if b["large_employer_exposure"] + b["fiduciary_complexity_accounts"] >= 6:
        picks.append("stewardship")
    if b["num_clients"] >= 10:
        picks += ["network_iq", "form_5500"]
    # de-dupe, preserve order
    seen, ordered = set(), []
    for p in picks:
        if p not in seen:
            seen.add(p)
            ordered.append(p)
    return ordered


def _solution_mapping(ex: dict, b: dict) -> list:
    spend = b["healthcare_spend_under_advisement"]
    out = []
    for key in _relevant_products(ex, b):
        p = PRODUCTS[key]
        eligible = max(0, int(p["eligible"](b)))
        if eligible <= 0:
            continue
        # savings apply to the eligible slice of the book, proportional to spend
        slice_spend = spend * (eligible / max(1, b["num_clients"]))
        client_savings = int(round(slice_spend * p["savings_factor"]))
        bb_revenue = int(round(client_savings * p["take_rate"]))
        strategic_value = _clamp(
            {"Board": 90, "CFO": 80, "Producer": 66}[p["visibility"]] * 0.6
            + {"Low": 85, "Medium": 68, "High": 52}[p["effort"]] * 0.4
        )
        # every dollar figure is derived from the demo book, never reconciled
        # against a filing, contract, or remittance, so nothing certifies here
        tier = ConfidenceTier.MODELED.value
        out.append({
            "key": key,
            "name": p["name"],
            "category": p["category"],
            "eligible_clients": eligible,
            "estimated_client_savings": client_savings,
            "bb_revenue_opportunity": bb_revenue,
            "client_differentiation": p["differentiation"],
            "implementation_effort": p["effort"],
            "executive_visibility": p["visibility"],
            "strategic_value": strategic_value,
            "confidence": tier,
            "evidence_to_certify": p["evidence"],
        })
    out.sort(key=lambda r: r["estimated_client_savings"], reverse=True)
    return out


# ── Derivation: Module 3 client-needs discovery ─────────────────────────────────

def _discover_needs(ex: dict, b: dict) -> list:
    n = max(1, b["num_clients"])
    needs = []

    def add(challenge, severity, driver, product):
        needs.append({
            "challenge": challenge,
            "severity": severity,
            "driver": driver,
            "addressed_by": product,
            "confidence": ConfidenceTier.MODELED.value,
        })

    if b["high_pharmacy_spend_clients"] / n >= 0.35:
        add("Rising specialty and GLP-1 drug costs", "High",
            f"{b['high_pharmacy_spend_clients']} of {b['num_clients']} accounts carry heavy pharmacy trend",
            "PBM Contract Clarity 360")
    if b["high_pharmacy_spend_clients"] >= 5:
        add("PBM contract opacity and spread pricing", "High",
            "Pharmacy-heavy book exposed to non-transparent PBM terms", "PBM Contract X-Ray")
    if b["self_funded_clients"] >= 4:
        add("Stop-loss attachment and laser inefficiency", "Medium",
            f"{b['self_funded_clients']} self-funded accounts renewing stop-loss annually", "Stop Loss IQ")
        add("Claims payment accuracy and overpayment leakage", "Medium",
            "Self-funded plans lack independent claims audit", "Claims Recovery IQ")
    if b["fiduciary_complexity_accounts"] >= 4:
        add("ERISA governance and CAA fee-disclosure exposure", "High",
            f"{b['fiduciary_complexity_accounts']} accounts with fiduciary complexity post-CAA", "ERISA Fiduciary IQ")
    if b["large_employer_exposure"] >= 5:
        add("Board-level financial visibility and reporting", "Medium",
            f"{b['large_employer_exposure']} large employers needing board-grade reporting", "Executive Board Dashboards")
        add("Healthcare EBITDA and cost-trend forecasting", "Medium",
            "Finance leaders need forward cost modeling", "Healthcare Financial Intelligence")
    if b["fully_insured_pct"] >= 45:
        add("Limited data visibility on fully-insured plans", "Medium",
            f"{b['fully_insured_pct']} percent of the book is fully insured", "Predictive Cost Modeling")
    if b["high_growth_accounts"] >= 5:
        add("Fast-scaling accounts outgrowing their plan design", "Medium",
            f"{b['high_growth_accounts']} high-growth accounts with volatile enrollment", "Predictive Cost Modeling")
    if b["pe_portfolio_exposure"] >= 3:
        add("Private-equity portfolio value-creation pressure", "Medium",
            f"{b['pe_portfolio_exposure']} PE-backed accounts with EBITDA scrutiny", "Healthcare Financial Intelligence")
    # every book benefits from vendor accountability and retention defense
    add("Vendor accountability and competitive displacement risk", "Medium",
        "Incumbent vendors rarely audited; renewal is a displacement window", "Health Stewardship Reports")
    return needs


# ── Full profile assembly ───────────────────────────────────────────────────────

def _build_executive(ex: dict) -> dict:
    b = _normalize_book(ex["book"])
    components = _component_scores(ex, b)
    overall = _overall_score(components)
    mapping = _solution_mapping(ex, b)
    needs = _discover_needs(ex, b)

    total_client_savings = sum(m["estimated_client_savings"] for m in mapping)
    total_bb_revenue = sum(m["bb_revenue_opportunity"] for m in mapping)

    scores_detail = [
        {"key": k, "label": SCORE_LABELS[k], "score": components[k], "weight": WEIGHTS[k]}
        for k in WEIGHTS
    ]
    scores_detail.sort(key=lambda s: s["score"], reverse=True)

    return {
        "id": ex["id"],
        # Module 1: Executive Intelligence
        "profile": {
            "name": ex["name"],
            "title": ex["title"],
            "role_type": ex["role_type"],
            "region": ex["region"],
            "office": ex["office"],
            "tenure_years": ex["tenure_years"],
            "certifications": ex["certifications"],
            "communication_style": ex["communication_style"],
            "innovation_profile": ex["innovation_profile"],
            "decision_authority": ex["decision_authority"],
            "leadership_influence": ex["leadership_influence"],
            "industry_specialization": ex["industry_specialization"],
            "employer_size_focus": ex["employer_size_focus"],
            "client_segmentation": ex["client_segmentation"],
            "revenue_responsibility": ex["revenue_responsibility"],
            "healthcare_consulting_expertise": ex["healthcare_consulting_expertise"],
            "pbm_knowledge": ex["pbm_knowledge"],
            "erisa_knowledge": ex["erisa_knowledge"],
            "data_analytics_maturity": ex["data_analytics_maturity"],
            "tech_adoption": ex["tech_adoption"],
            "strategic_priorities": ex["strategic_priorities"],
            "growth_initiatives": ex["growth_initiatives"],
            "relationship_network": ex["relationship_network"],
        },
        # Module 2: Book of Business Analysis
        "book": b,
        # Module 3: Client Needs Discovery
        "needs": needs,
        # Module 4: Kincaid Health Solution Mapping
        "solution_mapping": mapping,
        # Module 5: Executive Opportunity Scoring
        "scoring": {
            "overall": overall,
            "priority_tier": _priority_tier(overall),
            "components": components,
            "components_detail": scores_detail,
            "weights": WEIGHTS,
            "confidence": ConfidenceTier.MODELED.value,
        },
        "financial_summary": {
            "estimated_client_savings": total_client_savings,
            "bb_revenue_opportunity": total_bb_revenue,
            "healthcare_spend_under_advisement": b["healthcare_spend_under_advisement"],
            "confidence": ConfidenceTier.MODELED.value,
        },
        "meta": {
            "confidence": ConfidenceTier.MODELED.value,
            "basis": "Modeled from role and book attributes. Dollar figures upgrade to "
                     "CERTIFIED when client claims, contracts, and remittances are ingested.",
            "generated_at": iso_now(),
        },
    }


def _executive_card(full: dict) -> dict:
    p = full["profile"]
    top = full["solution_mapping"][0]["name"] if full["solution_mapping"] else None
    return {
        "id": full["id"],
        "name": p["name"],
        "title": p["title"],
        "role_type": p["role_type"],
        "region": p["region"],
        "office": p["office"],
        "overall_score": full["scoring"]["overall"],
        "priority_tier": full["scoring"]["priority_tier"],
        "revenue_responsibility": p["revenue_responsibility"],
        "healthcare_spend_under_advisement": full["book"]["healthcare_spend_under_advisement"],
        "bb_revenue_opportunity": full["financial_summary"]["bb_revenue_opportunity"],
        "estimated_client_savings": full["financial_summary"]["estimated_client_savings"],
        "top_solution": top,
        "num_clients": full["book"]["num_clients"],
        "self_funded_pct": full["book"]["self_funded_pct"],
        "confidence": ConfidenceTier.MODELED.value,
    }


def _all_full() -> list:
    return [_build_executive(e) for e in ROSTER]


# ── Dashboard rollup ────────────────────────────────────────────────────────────

def _build_dashboard() -> dict:
    fulls = _all_full()
    cards = [_executive_card(f) for f in fulls]
    cards.sort(key=lambda c: c["overall_score"], reverse=True)

    total_bb_revenue = sum(c["bb_revenue_opportunity"] for c in cards)
    total_client_savings = sum(c["estimated_client_savings"] for c in cards)
    total_spend = sum(c["healthcare_spend_under_advisement"] for c in cards)

    # regional heat map
    region_map = {}
    for f in fulls:
        r = f["profile"]["region"]
        rm = region_map.setdefault(r, {
            "region": r, "executives": 0, "bb_revenue_opportunity": 0,
            "client_savings": 0, "spend_under_advisement": 0, "score_sum": 0,
        })
        rm["executives"] += 1
        rm["bb_revenue_opportunity"] += f["financial_summary"]["bb_revenue_opportunity"]
        rm["client_savings"] += f["financial_summary"]["estimated_client_savings"]
        rm["spend_under_advisement"] += f["book"]["healthcare_spend_under_advisement"]
        rm["score_sum"] += f["scoring"]["overall"]
    regions_out = []
    for rm in region_map.values():
        rm["avg_score"] = int(round(rm["score_sum"] / max(1, rm["executives"])))
        del rm["score_sum"]
        regions_out.append(rm)
    regions_out.sort(key=lambda r: r["bb_revenue_opportunity"], reverse=True)

    # product adoption readiness (aggregate across roster)
    product_agg = {}
    for f in fulls:
        for m in f["solution_mapping"]:
            pa = product_agg.setdefault(m["key"], {
                "key": m["key"], "name": m["name"], "category": m["category"],
                "executives": 0, "eligible_clients": 0,
                "client_savings": 0, "bb_revenue_opportunity": 0,
            })
            pa["executives"] += 1
            pa["eligible_clients"] += m["eligible_clients"]
            pa["client_savings"] += m["estimated_client_savings"]
            pa["bb_revenue_opportunity"] += m["bb_revenue_opportunity"]
    products_out = sorted(product_agg.values(), key=lambda p: p["bb_revenue_opportunity"], reverse=True)

    # indices
    def _avg(key_path):
        vals = []
        for f in fulls:
            vals.append(f["scoring"]["components"][key_path])
        return int(round(sum(vals) / max(1, len(vals))))

    ai_readiness_index = _avg("ai_readiness")
    complexity_index = _avg("healthcare_complexity")
    implementation_index = _avg("implementation_readiness")

    # pipeline by priority tier
    tiers = {"TIER_1": 0, "TIER_2": 0, "TIER_3": 0}
    tier_revenue = {"TIER_1": 0, "TIER_2": 0, "TIER_3": 0}
    for c in cards:
        tiers[c["priority_tier"]] += 1
        tier_revenue[c["priority_tier"]] += c["bb_revenue_opportunity"]
    pipeline = [
        {"tier": t, "label": {"TIER_1": "Tier 1 - Pursue now",
                              "TIER_2": "Tier 2 - Develop",
                              "TIER_3": "Tier 3 - Nurture"}[t],
         "executives": tiers[t], "bb_revenue_opportunity": tier_revenue[t]}
        for t in ("TIER_1", "TIER_2", "TIER_3")
    ]

    # revenue forecast: staged capture of the modeled opportunity over 4 quarters
    capture_curve = [0.18, 0.30, 0.28, 0.24]
    forecast, cumulative = [], 0
    for i, frac in enumerate(capture_curve):
        q_val = int(round(total_bb_revenue * frac))
        cumulative += q_val
        forecast.append({
            "period": f"Q{i + 1}",
            "bb_revenue": q_val,
            "cumulative": cumulative,
        })

    return {
        "generated_at": iso_now(),
        "kpis": {
            "executives_evaluated": len(cards),
            "total_bb_revenue_opportunity": total_bb_revenue,
            "total_client_savings": total_client_savings,
            "total_spend_under_advisement": total_spend,
            "tier_1_count": tiers["TIER_1"],
            "ai_readiness_index": ai_readiness_index,
            "healthcare_complexity_index": complexity_index,
            "implementation_readiness_index": implementation_index,
        },
        "rankings": cards,
        "regions": regions_out,
        "product_readiness": products_out,
        "pipeline": pipeline,
        "revenue_forecast": forecast,
        "confidence": ConfidenceTier.MODELED.value,
        "methodology": "Opportunity scores are weighted composites of fourteen disclosed "
                       "components. Dollar figures are MODELED from book attributes and the "
                       "Kincaid Health product catalog; they upgrade to CERTIFIED when client "
                       "claims, contracts, and remittances are ingested.",
    }


# ── AI: Module 6 executive playbook ─────────────────────────────────────────────

_PLAYBOOK_CACHE: dict = {}   # exec_id -> {"fingerprint": str, "result": dict}


def _playbook_fingerprint(full: dict) -> str:
    return _hash({
        "id": full["id"],
        "overall": full["scoring"]["overall"],
        "top_products": [m["key"] for m in full["solution_mapping"][:5]],
        "needs": [n["challenge"] for n in full["needs"][:6]],
        "bb_rev": full["financial_summary"]["bb_revenue_opportunity"],
    })


def _fallback_playbook(full: dict) -> dict:
    p = full["profile"]
    top = full["solution_mapping"][:3]
    top_names = [m["name"] for m in top]
    lead = top_names[0] if top_names else "Health Stewardship Reports"
    needs = [n["challenge"] for n in full["needs"][:4]]
    rev = full["financial_summary"]["bb_revenue_opportunity"]
    savings = full["financial_summary"]["estimated_client_savings"]
    return {
        "executive_briefing": (
            f"{p['name']} ({p['title']}, {p['region']}) manages a "
            f"{p['client_segmentation'].lower()} book with "
            f"{full['book']['num_clients']} accounts and "
            f"{full['book']['self_funded_pct']} percent self-funded concentration. "
            f"The modeled Kincaid Health opportunity is a {full['scoring']['overall']} of 100, "
            f"with an estimated {savings:,} dollars of client savings and {rev:,} dollars "
            f"of incremental Brown & Brown consulting revenue. Lead with {lead}."
        ),
        "discovery_questions": [
            "How are you quantifying pharmacy and specialty trend for your largest accounts today?",
            "When a CFO asks you to prove the plan is well managed, what do you hand them?",
            "How confident are you that your self-funded clients are not overpaying claims?",
            "Where has an incumbent vendor gone un-audited for more than two renewal cycles?",
            "What would it change if you could show a board-grade cost story in every finalist?",
        ],
        "industry_talking_points": [
            f"Specialty and GLP-1 trend is the dominant driver in the {p['region']} market.",
            "Post-CAA fiduciary exposure is now a board-level question, not an HR one.",
            "Transparency wins finalists; incumbents rarely produce receipts.",
        ],
        "value_narrative": (
            f"Kincaid Health turns {p['name']}'s book into an evidence engine: every recommendation "
            f"carries a dollar figure and a receipt. Across this book that is roughly "
            f"{savings:,} dollars of defensible client savings and {rev:,} dollars of new "
            f"consulting revenue, while raising retention through demonstrable stewardship."
        ),
        "presentation_outline": [
            "The market: healthcare cost and fiduciary pressure",
            f"Your book at a glance: {full['book']['num_clients']} accounts, "
            f"{full['book']['self_funded_pct']} percent self-funded",
            f"Where Kincaid Health creates value: {', '.join(top_names) or 'stewardship and analytics'}",
            "The numbers: modeled savings and consulting revenue",
            "The proof: receipts, not slideware",
            "The plan: 30, 90, and 180 day roadmap",
        ],
        "implementation_roadmap": [
            "Days 1-30: select two flagship accounts and ingest claims and contracts",
            "Days 31-90: deliver the first stewardship report and PBM contract review",
            "Days 91-180: expand to the top decile of the book and quantify captured value",
        ],
        "meeting_agenda": [
            "Confirm the two or three accounts with the most exposure",
            f"Walk the modeled opportunity ({rev:,} dollars of consulting revenue)",
            "Agree on the first flagship engagement and evidence to ingest",
        ],
        "follow_up_strategy": (
            "Send a one-page modeled opportunity summary within 24 hours, then schedule the "
            "first flagship account review within two weeks."
        ),
        "cross_sell_recommendations": needs,
        "confidence": ConfidenceTier.MODELED.value,
    }


class CopilotRequest(BaseModel):
    question: str


# ── Endpoints ───────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "ok", "executives": len(ROSTER), "generated_at": iso_now()}


@router.get("/dashboard")
def dashboard(user=Depends(get_current_user)):
    return _build_dashboard()


@router.get("/executives")
def executives(user=Depends(get_current_user)):
    cards = [_executive_card(_build_executive(e)) for e in ROSTER]
    cards.sort(key=lambda c: c["overall_score"], reverse=True)
    return {"executives": cards, "count": len(cards), "confidence": ConfidenceTier.MODELED.value}


@router.get("/executives/{exec_id}")
def executive(exec_id: str, user=Depends(get_current_user)):
    ex = _ROSTER_BY_ID.get(exec_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Executive not found")
    return _build_executive(ex)


# ── Rep book builder (live 5500 typeahead) ──────────────────────────────────────
# National average total healthcare cost per covered life, used when an employer's
# most recent filing reports no (or implausibly small) welfare premiums, which is
# common for large self-funded groups that carry only ancillary premiums.
_ANNUAL_COST_PER_LIFE = 14_000
# Reported premiums below this per-participant floor are treated as partial/ancillary
# and replaced by the modeled per-life estimate so large self-funded books are not
# understated by an order of magnitude.
_MIN_PLAUSIBLE_PEPY = 1_000


def _num(v, default: float = 0.0) -> float:
    """DuckDB hands back decimal.Decimal / None; coerce to a plain float."""
    try:
        return default if v is None else float(v)
    except (TypeError, ValueError):
        return default


@router.get("/account-search")
def account_search(q: str, limit: int = 8, user=Depends(get_current_user)):
    """Typeahead over the live DOL Form 5500 employer universe so a rep can
    assemble their own top-25 book by name. Every figure comes from each
    employer's most recent filing; latest_year is the freshness signal the rep
    sees in the talk box. Dollar figures are MODELED, never reconciled."""
    term = (q or "").strip()
    if len(term) < 2:
        return {"results": [], "query": term, "count": 0, "data_available": duck_available()}
    if not duck_available():
        return {"results": [], "query": term, "count": 0, "data_available": False}

    limit = max(1, min(int(limit or 8), 15))
    clean = term.replace("-", "")
    con = get_duck()
    rows = con.execute(
        """
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
               max_participants, total_welfare_premiums,
               total_broker_commissions, total_admin_fees
        FROM employers
        WHERE UPPER(employer_name) LIKE UPPER(?)
           OR EIN = ?
        ORDER BY max_participants DESC NULLS LAST
        LIMIT ?
        """,
        [f"%{term}%", clean, limit],
    ).fetchall()

    results = []
    for r in rows:
        participants = int(_num(r[6]))
        premiums = _num(r[7])
        if participants > 0:
            floor = participants * _MIN_PLAUSIBLE_PEPY
            est_spend = premiums if premiums >= floor else participants * _ANNUAL_COST_PER_LIFE
        else:
            est_spend = premiums
        results.append({
            "ein": r[0],
            "name": r[1],
            "plan_name": r[2],
            "state": r[3],
            "city": r[4],
            "latest_year": int(r[5]) if r[5] is not None else None,
            "participants": participants,
            "welfare_premiums": round(premiums),
            "broker_commissions": round(_num(r[8])),
            "admin_fees": round(_num(r[9])),
            "est_annual_spend": round(est_spend),
            "confidence": ConfidenceTier.MODELED.value,
        })
    return {"results": results, "query": term, "count": len(results), "data_available": True}


@router.get("/executives/{exec_id}/playbook")
async def playbook(exec_id: str, regenerate: bool = False, user=Depends(get_current_user)):
    ex = _ROSTER_BY_ID.get(exec_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Executive not found")
    full = _build_executive(ex)
    fp = _playbook_fingerprint(full)

    if not regenerate:
        cached = _PLAYBOOK_CACHE.get(exec_id)
        if cached and cached.get("fingerprint") == fp and cached["result"].get("ai_generated"):
            return cached["result"]

    p = full["profile"]
    brief = {
        "name": p["name"], "title": p["title"], "region": p["region"],
        "role_type": p["role_type"], "tenure_years": p["tenure_years"],
        "communication_style": p["communication_style"],
        "innovation_profile": p["innovation_profile"],
        "client_segmentation": p["client_segmentation"],
        "industry_specialization": p["industry_specialization"],
        "num_clients": full["book"]["num_clients"],
        "self_funded_pct": full["book"]["self_funded_pct"],
        "spend_under_advisement": full["book"]["healthcare_spend_under_advisement"],
        "overall_score": full["scoring"]["overall"],
        "top_components": full["scoring"]["components_detail"][:4],
        "top_solutions": [
            {"name": m["name"], "eligible_clients": m["eligible_clients"],
             "client_savings": m["estimated_client_savings"],
             "bb_revenue": m["bb_revenue_opportunity"]}
            for m in full["solution_mapping"][:5]
        ],
        "top_needs": [n["challenge"] for n in full["needs"][:6]],
        "bb_revenue_opportunity": full["financial_summary"]["bb_revenue_opportunity"],
        "estimated_client_savings": full["financial_summary"]["estimated_client_savings"],
    }

    system = (
        "You are a Brown & Brown national sales strategist and healthcare economics advisor "
        "producing an internal executive sales playbook for a single Brown & Brown producer. "
        "The goal is to help this producer use Kincaid Health to win more business, retain more "
        "clients, grow consulting revenue, and reduce client fiduciary risk. Write like a "
        "McKinsey senior partner briefing a top producer: specific, evidence-based, and "
        "quantified. Never invent a figure that is not in the brief. Do not use marketing "
        "language and do not use em dashes. Respond ONLY with JSON of this exact shape: "
        '{"executive_briefing": "one tight paragraph", '
        '"discovery_questions": ["q1","q2","q3","q4","q5"], '
        '"industry_talking_points": ["t1","t2","t3"], '
        '"value_narrative": "one paragraph tying the numbers to outcomes", '
        '"presentation_outline": ["s1","s2","s3","s4","s5","s6"], '
        '"implementation_roadmap": ["30 day","90 day","180 day"], '
        '"meeting_agenda": ["a1","a2","a3"], '
        '"follow_up_strategy": "one or two sentences", '
        '"cross_sell_recommendations": ["c1","c2","c3"]}'
    )
    user_msg = (
        "Write the executive sales playbook using only these figures and facts:\n"
        + json.dumps(brief, default=str)
        + "\n\nGround every recommendation in the executive's book. Quantify the opportunity "
        "in dollars where the brief provides figures."
    )

    result = await run_agent(system, user_msg, "B&B Executive Playbook")
    if not isinstance(result, dict) or result.get("error") or not result.get("executive_briefing"):
        result = _fallback_playbook(full)
        result["ai_generated"] = False
    else:
        result.setdefault("confidence", ConfidenceTier.MODELED.value)
        result["ai_generated"] = True

    result["fingerprint"] = fp
    result["generated_at"] = iso_now()
    result["executive"] = {"id": full["id"], "name": p["name"], "title": p["title"]}

    if result.get("ai_generated"):
        _PLAYBOOK_CACHE[exec_id] = {"fingerprint": fp, "result": result}

    return result


def _copilot_context() -> list:
    ctx = []
    for f in _all_full():
        p = f["profile"]
        ctx.append({
            "id": f["id"], "name": p["name"], "title": p["title"],
            "role_type": p["role_type"], "region": p["region"], "office": p["office"],
            "overall_score": f["scoring"]["overall"],
            "priority_tier": f["scoring"]["priority_tier"],
            "num_clients": f["book"]["num_clients"],
            "self_funded_pct": f["book"]["self_funded_pct"],
            "spend_under_advisement": f["book"]["healthcare_spend_under_advisement"],
            "high_pharmacy_clients": f["book"]["high_pharmacy_spend_clients"],
            "fiduciary_accounts": f["book"]["fiduciary_complexity_accounts"],
            "ai_readiness": f["scoring"]["components"]["ai_readiness"],
            "bb_revenue_opportunity": f["financial_summary"]["bb_revenue_opportunity"],
            "top_solutions": [m["name"] for m in f["solution_mapping"][:3]],
        })
    return ctx


def _fallback_copilot(question: str, ctx: list) -> dict:
    q = question.lower()
    ranked = sorted(ctx, key=lambda c: c["overall_score"], reverse=True)

    if any(w in q for w in ("self-funded", "self funded", "largest", "biggest")):
        picks = sorted(ctx, key=lambda c: c["spend_under_advisement"], reverse=True)[:3]
        headline = "Executives managing the largest self-funded healthcare spend."
    elif any(w in q for w in ("pbm", "pharmacy", "rx", "drug")):
        picks = sorted(ctx, key=lambda c: c["high_pharmacy_clients"], reverse=True)[:3]
        headline = "Executives with the greatest PBM and pharmacy exposure in their books."
    elif any(w in q for w in ("ai", "adopt", "readiness", "innovat", "technology")):
        picks = sorted(ctx, key=lambda c: c["ai_readiness"], reverse=True)[:3]
        headline = "Executives most ready to adopt AI-driven analytics."
    elif any(w in q for w in ("fiduciary", "erisa", "governance", "compliance")):
        picks = sorted(ctx, key=lambda c: c["fiduciary_accounts"], reverse=True)[:3]
        headline = "Executives whose books carry the most fiduciary and ERISA exposure."
    elif any(w in q for w in ("revenue", "opportunity", "forecast", "value")):
        picks = sorted(ctx, key=lambda c: c["bb_revenue_opportunity"], reverse=True)[:3]
        headline = "Executives with the largest modeled Brown & Brown revenue opportunity."
    elif any(w in q for w in ("region", "office", "geograph")):
        by_region = {}
        for c in ctx:
            by_region[c["region"]] = by_region.get(c["region"], 0) + c["bb_revenue_opportunity"]
        top_region = max(by_region, key=by_region.get)
        picks = [c for c in ranked if c["region"] == top_region][:3]
        headline = f"The {top_region} region carries the largest modeled opportunity."
    else:
        picks = ranked[:3]
        headline = "Highest-priority executives to pursue this quarter by opportunity score."

    lines = [
        f"{c['name']} ({c['title']}, {c['region']}): score {c['overall_score']}, "
        f"{c['num_clients']} accounts, {c['self_funded_pct']} percent self-funded, "
        f"modeled B&B revenue {c['bb_revenue_opportunity']:,} dollars. "
        f"Lead with {', '.join(c['top_solutions']) or 'stewardship'}."
        for c in picks
    ]
    return {
        "answer": headline + "\n\n" + "\n".join(lines),
        "referenced_executives": [{"id": c["id"], "name": c["name"]} for c in picks],
        "ai_generated": False,
        "confidence": ConfidenceTier.MODELED.value,
        "generated_at": iso_now(),
    }


@router.post("/copilot")
async def copilot(req: CopilotRequest, user=Depends(get_current_user)):
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    ctx = _copilot_context()

    system = (
        "You are the AI Co-Pilot for the Brown & Brown Kincaid Health Opportunity Intelligence OS. "
        "You advise Brown & Brown sales leadership on where Kincaid Health can create the most "
        "measurable value across their executive roster. Answer only from the roster context "
        "provided. Be specific, name executives, and quantify with the figures given. Do not "
        "invent executives or numbers. Do not use marketing language and do not use em dashes. "
        "Respond ONLY with JSON of this exact shape: "
        '{"answer": "a direct, evidence-based answer in plain prose", '
        '"referenced_executives": [{"id": "exec id", "name": "exec name"}]}'
    )
    user_msg = (
        "Roster context (the only executives and figures you may cite):\n"
        + json.dumps(ctx, default=str)
        + f"\n\nQuestion: {question}"
    )

    result = await run_agent(system, user_msg, "B&B Opportunity Co-Pilot")
    if not isinstance(result, dict) or result.get("error") or not result.get("answer"):
        return _fallback_copilot(question, ctx)

    result["ai_generated"] = True
    result.setdefault("referenced_executives", [])
    result.setdefault("confidence", ConfidenceTier.MODELED.value)
    result["generated_at"] = iso_now()
    return result
