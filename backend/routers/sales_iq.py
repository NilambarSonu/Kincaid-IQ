"""
Sales IQ Intelligence Module — Kincaid Health
Multi-state regulatory, pricing, and compliance intelligence across all 50 U.S. states.
California is the priority state with advanced SB-17 override logic.

Endpoints:
  GET  /api/sales-iq/states              — all states summary list
  GET  /api/sales-iq/states/{code}       — single state full detail
  POST /api/sales-iq/compare             — multi-state side-by-side
  POST /api/sales-iq/sales-angle         — Sales Angle Generator (AI or rule-based)
  GET  /api/sales-iq/alerts              — compliance alerts feed
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("kincaid.sales_iq")

router = APIRouter(prefix="/api/sales-iq", tags=["sales-iq"])

# ─── Models ──────────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    state_codes: list[str]

class SalesAngleRequest(BaseModel):
    state_code: str
    client_type: str = "self-funded"   # "self-funded" | "fully-insured" | "level-funded"
    employer_size: str = "mid-market"  # "small", "mid-market", "large", "jumbo"
    industry: Optional[str] = None


# ─── State Data ───────────────────────────────────────────────────────────────

# Regulatory strictness tiers:
#   TIER_1 (9-10): CA, NY — most aggressive enforcement
#   TIER_2 (7-8):  TX, FL, IL, WA, CO, MA, NJ, CT, OR, MN
#   TIER_3 (5-6):  Most mid-states
#   TIER_4 (1-4):  Low-regulation states

_STATE_DATA: dict[str, dict] = {
    "CA": {
        "code": "CA", "name": "California", "region": "West",
        "priority": "PRIORITY",  # Special CA flag
        "scores": {
            "transparency": 9.4,
            "pbm_risk": 7.8,
            "regulatory_strictness": 9.7,
            "broker_comp_visibility": 9.1,
        },
        "regulatory_rules": {
            "summary": "Most aggressive PBM regulatory state in the US. SB-17 mandates drug pricing transparency. AB-2080 restricts PBM spread pricing. Full fiduciary disclosure required.",
            "key_legislation": ["SB-17 (Drug Pricing Transparency)", "AB-2080 (PBM Reform)", "SB 1, 2023 (PBM Licensing)", "CA Health & Safety Code §1367.206"],
            "enforcement_body": "Department of Managed Health Care (DMHC) + CA AG",
            "filing_requirements": "Annual PBM cost report to DMHC; employer plan documents must disclose rebates",
            "penalties": "Up to $25,000/day for non-compliance; license revocation for PBMs",
        },
        "pbm_constraints": {
            "spread_pricing_allowed": False,
            "spread_pricing_status": "HIGH RISK — AB-2080 restricts spread pricing for Medi-Cal; SB-1 extends oversight",
            "rebate_passthrough_required": True,
            "mac_transparency_required": True,
            "auditing_rights": "Full audit rights required in all PBM contracts",
            "gag_clauses": "Prohibited under CA law",
        },
        "broker_comp_rules": {
            "disclosure_required": True,
            "disclosure_standard": "Full disclosure — all direct and indirect compensation",
            "fiduciary_requirement": "Fiduciary standard applies to health plan advisors",
            "erisa_overlay": "CA adds state-level requirements on top of federal ERISA",
        },
        "transparency_requirements": {
            "employer_disclosure_alerts": True,
            "drug_pricing_transparency": "Full — SB-17 mandates manufacturer price increase notices",
            "pbm_contract_visibility": "Employers have right to full contract terms",
            "rebate_reporting": "Required — rebates must be reported and passed through",
        },
        "rebate_handling_rules": {
            "pooled_rebates_allowed": False,
            "passthrough_model": "Required for public plans; strongly incentivized for private",
            "rebate_visibility_to_employer": "Full visibility required",
        },
        "market_norms": {
            "spread_prevalence_pct": 18,
            "passthrough_prevalence_pct": 82,
            "avg_broker_comp_disclosure": "Full",
            "dominant_pbm_model": "Pass-through",
            "employer_sophistication": "High",
        },
        "ca_specific_alerts": [
            {
                "type": "COMPLIANCE_RISK",
                "severity": "HIGH",
                "title": "SB-17 Drug Pricing Disclosure",
                "description": "Employer plans in CA must ensure PBM contracts comply with SB-17 drug price transparency mandates. Non-compliance triggers DMHC investigation.",
                "action": "Audit PBM contract for SB-17 compliance language",
            },
            {
                "type": "COMPLIANCE_RISK",
                "severity": "HIGH",
                "title": "AB-2080 Spread Pricing Alert",
                "description": "Spread pricing models are high-risk in California. AB-2080 extends restrictions beyond Medi-Cal. Any spread pricing arrangement should be flagged for legal review.",
                "action": "Flag spread pricing contracts — recommend pass-through conversion",
            },
            {
                "type": "OPPORTUNITY",
                "severity": "MEDIUM",
                "title": "Fiduciary Positioning Opportunity",
                "description": "CA employers are highly receptive to fiduciary advisors. The regulatory environment creates urgency for transparent, pass-through PBM models.",
                "action": "Lead with fiduciary value proposition and CA compliance expertise",
            },
        ],
        "sales_profile": {
            "difficulty": "HIGH",
            "opportunity": "VERY HIGH",
            "urgency_hook": "SB-17 and AB-2080 create immediate compliance urgency",
            "key_differentiator": "CA-specific PBM compliance expertise",
            "objection": "We have an existing PBM contract",
            "objection_response": "Existing contracts may be non-compliant with AB-2080 and SB-1. A contract audit is a fiduciary obligation, not optional.",
        },
    },

    "TX": {
        "code": "TX", "name": "Texas", "region": "South",
        "priority": "HIGH",
        "scores": {
            "transparency": 6.2,
            "pbm_risk": 6.8,
            "regulatory_strictness": 6.5,
            "broker_comp_visibility": 5.8,
        },
        "regulatory_rules": {
            "summary": "Moderate regulation with growing PBM oversight. HB-1919 passed in 2023 requires PBM transparency reporting. TDI has increased enforcement activity.",
            "key_legislation": ["HB-1919 (PBM Transparency, 2023)", "TX Ins. Code §1369", "SB-436 (Broker Comp Disclosure)"],
            "enforcement_body": "Texas Department of Insurance (TDI)",
            "filing_requirements": "Annual PBM registration with TDI; employer reporting for fully-insured plans",
            "penalties": "Administrative penalties up to $10,000/violation",
        },
        "pbm_constraints": {
            "spread_pricing_allowed": True,
            "spread_pricing_status": "WATCH — HB-1919 requires spread pricing disclosure; employer awareness increasing",
            "rebate_passthrough_required": False,
            "mac_transparency_required": True,
            "auditing_rights": "Limited — must be negotiated",
            "gag_clauses": "Not explicitly prohibited; TDI guidance discourages",
        },
        "broker_comp_rules": {
            "disclosure_required": True,
            "disclosure_standard": "Summary disclosure — total compensation range",
            "fiduciary_requirement": "No explicit fiduciary mandate; ERISA applies",
            "erisa_overlay": "Standard ERISA; state adds disclosure layer for insured plans",
        },
        "transparency_requirements": {
            "employer_disclosure_alerts": False,
            "drug_pricing_transparency": "Partial — manufacturer notices not required",
            "pbm_contract_visibility": "Limited — employers must negotiate audit rights",
            "rebate_reporting": "Not required but becoming norm in large markets",
        },
        "rebate_handling_rules": {
            "pooled_rebates_allowed": True,
            "passthrough_model": "Optional — market shifting toward pass-through in large employers",
            "rebate_visibility_to_employer": "Negotiable",
        },
        "market_norms": {
            "spread_prevalence_pct": 52,
            "passthrough_prevalence_pct": 48,
            "avg_broker_comp_disclosure": "Partial",
            "dominant_pbm_model": "Spread (legacy) shifting to hybrid",
            "employer_sophistication": "Medium-High in DFW/Houston; lower in rural markets",
        },
        "ca_specific_alerts": [],
        "sales_profile": {
            "difficulty": "MEDIUM",
            "opportunity": "HIGH",
            "urgency_hook": "HB-1919 creates new disclosure obligations — employers need guidance now",
            "key_differentiator": "HB-1919 compliance expertise + transparent PBM alternative",
            "objection": "Our broker handles all of this",
            "objection_response": "HB-1919 requires your broker to disclose all PBM-related compensation. Ask them to provide a full disclosure — most haven't.",
        },
    },

    "NY": {
        "code": "NY", "name": "New York", "region": "Northeast",
        "priority": "HIGH",
        "scores": {
            "transparency": 8.7,
            "pbm_risk": 7.2,
            "regulatory_strictness": 9.1,
            "broker_comp_visibility": 8.4,
        },
        "regulatory_rules": {
            "summary": "Among the strictest states alongside CA. DFS has broad authority over health insurance. PBM licensing law passed in 2021. Employer disclosure obligations are extensive.",
            "key_legislation": ["NY Pub. Health Law §280-a (PBM Licensing)", "NY Ins. Law §3224-f", "NY Executive Law §296-d (Anti-discrimination)", "NY 2021 PBM Reform Act"],
            "enforcement_body": "Department of Financial Services (DFS) + NY AG",
            "filing_requirements": "PBM annual reporting to DFS; broker compensation disclosure to clients",
            "penalties": "DFS can impose unlimited fines; AG has broad enforcement authority",
        },
        "pbm_constraints": {
            "spread_pricing_allowed": True,
            "spread_pricing_status": "WATCH — DFS scrutinizing spread arrangements; Medicaid banned spread",
            "rebate_passthrough_required": False,
            "mac_transparency_required": True,
            "auditing_rights": "Required in state contracts; negotiable in private",
            "gag_clauses": "Prohibited under DFS guidance",
        },
        "broker_comp_rules": {
            "disclosure_required": True,
            "disclosure_standard": "Full — DFS requires written disclosure of all compensation",
            "fiduciary_requirement": "Applies to certain plan types; growing DFS pressure",
            "erisa_overlay": "NY adds significant state requirements for insured plans",
        },
        "transparency_requirements": {
            "employer_disclosure_alerts": True,
            "drug_pricing_transparency": "High — DFS has broad authority to require disclosures",
            "pbm_contract_visibility": "Significant — NY law favors employer access to contract terms",
            "rebate_reporting": "Required for state plans; encouraged for private",
        },
        "rebate_handling_rules": {
            "pooled_rebates_allowed": True,
            "passthrough_model": "Preferred — DFS guidance favors pass-through",
            "rebate_visibility_to_employer": "Strongly encouraged; some plans require it",
        },
        "market_norms": {
            "spread_prevalence_pct": 28,
            "passthrough_prevalence_pct": 72,
            "avg_broker_comp_disclosure": "Full",
            "dominant_pbm_model": "Pass-through (large market); hybrid (mid-market)",
            "employer_sophistication": "Very High (NYC metro); Medium (upstate)",
        },
        "ca_specific_alerts": [],
        "sales_profile": {
            "difficulty": "HIGH",
            "opportunity": "VERY HIGH",
            "urgency_hook": "DFS enforcement activity at 10-year high; 2021 PBM Reform Act enforcement ramping up",
            "key_differentiator": "NY PBM licensing compliance + DFS-aligned contract structure",
            "objection": "We're already compliant",
            "objection_response": "DFS issued new guidance in 2023 that most plans haven't incorporated. Let us run a gap analysis at no cost.",
        },
    },

    "FL": {
        "code": "FL", "name": "Florida", "region": "South",
        "priority": "HIGH",
        "scores": {
            "transparency": 5.8,
            "pbm_risk": 7.4,
            "regulatory_strictness": 6.0,
            "broker_comp_visibility": 5.2,
        },
        "regulatory_rules": {
            "summary": "Growing regulatory environment. FL passed PBM reform in 2021 with annual reporting requirements. Large self-funded employer market creates strong advisor opportunity.",
            "key_legislation": ["FL SB-1 (PBM Reform, 2021)", "FL Stat §627.6572 (PBM Registration)", "FL Stat §626 (Broker Licensing)"],
            "enforcement_body": "Florida Office of Insurance Regulation (OIR)",
            "filing_requirements": "Annual PBM registration; employer plan documents must be filed for insured plans",
            "penalties": "Up to $5,000/day; license suspension",
        },
        "pbm_constraints": {
            "spread_pricing_allowed": True,
            "spread_pricing_status": "MODERATE RISK — Medicaid banned spread; private market still common",
            "rebate_passthrough_required": False,
            "mac_transparency_required": True,
            "auditing_rights": "Negotiable — not required by law",
            "gag_clauses": "Not prohibited; market pressure reducing prevalence",
        },
        "broker_comp_rules": {
            "disclosure_required": True,
            "disclosure_standard": "Summary — written disclosure of compensation",
            "fiduciary_requirement": "No explicit state mandate; ERISA governs",
            "erisa_overlay": "Standard federal ERISA framework",
        },
        "transparency_requirements": {
            "employer_disclosure_alerts": False,
            "drug_pricing_transparency": "Moderate — annual PBM reporting to OIR",
            "pbm_contract_visibility": "Limited — market-driven",
            "rebate_reporting": "Not required for private plans",
        },
        "rebate_handling_rules": {
            "pooled_rebates_allowed": True,
            "passthrough_model": "Optional — adoption growing in large employer segment",
            "rebate_visibility_to_employer": "Negotiable",
        },
        "market_norms": {
            "spread_prevalence_pct": 58,
            "passthrough_prevalence_pct": 42,
            "avg_broker_comp_disclosure": "Partial",
            "dominant_pbm_model": "Spread (dominant legacy model)",
            "employer_sophistication": "Medium — healthcare literacy growing",
        },
        "ca_specific_alerts": [],
        "sales_profile": {
            "difficulty": "MEDIUM-LOW",
            "opportunity": "HIGH",
            "urgency_hook": "FL SB-1 requires PBM annual reporting — employers should understand what's being reported about their plan",
            "key_differentiator": "Transparent PBM alternative in a spread-dominated market",
            "objection": "Switching PBMs is too disruptive",
            "objection_response": "Disruption is minimal when timed to renewal. The cost of inaction is continued spread extraction — typically 15-30% of pharmacy costs.",
        },
    },

    "IL": {
        "code": "IL", "name": "Illinois", "region": "Midwest",
        "priority": "MEDIUM",
        "scores": {"transparency": 7.2, "pbm_risk": 6.5, "regulatory_strictness": 7.4, "broker_comp_visibility": 6.8},
        "regulatory_rules": {"summary": "Strong PBM oversight. IL passed PBM reform in 2019, requiring licensing and transparency reporting.", "key_legislation": ["IL Public Act 101-0452 (PBM Reform)"], "enforcement_body": "IL Division of Insurance", "filing_requirements": "Annual PBM report", "penalties": "Up to $10,000/violation"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "WATCH", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Required in state contracts", "gag_clauses": "Discouraged"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Written summary", "fiduciary_requirement": "No state mandate", "erisa_overlay": "Standard"},
        "transparency_requirements": {"employer_disclosure_alerts": False, "drug_pricing_transparency": "Moderate", "pbm_contract_visibility": "Negotiable", "rebate_reporting": "Encouraged"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Optional", "rebate_visibility_to_employer": "Negotiable"},
        "market_norms": {"spread_prevalence_pct": 45, "passthrough_prevalence_pct": 55, "avg_broker_comp_disclosure": "Partial", "dominant_pbm_model": "Hybrid", "employer_sophistication": "High (Chicago metro)"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM", "opportunity": "HIGH", "urgency_hook": "IL PBM Reform Act increased employer obligations", "key_differentiator": "Compliance-aligned PBM strategy", "objection": "Costs too much to switch", "objection_response": "Pass-through models typically save 12-18% in Rx costs within year one."},
    },

    "WA": {
        "code": "WA", "name": "Washington", "region": "West",
        "priority": "MEDIUM",
        "scores": {"transparency": 8.1, "pbm_risk": 6.2, "regulatory_strictness": 8.0, "broker_comp_visibility": 7.5},
        "regulatory_rules": {"summary": "Progressive regulatory environment. WA has strong consumer protection laws and active OIC oversight of PBMs.", "key_legislation": ["WA SB-5520 (PBM Licensing)", "WA RCW 48.200"], "enforcement_body": "Office of the Insurance Commissioner (OIC)", "filing_requirements": "PBM licensure + annual report", "penalties": "Up to $25,000/violation"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "MODERATE RISK", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Negotiable", "gag_clauses": "Prohibited under OIC guidance"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Full written disclosure", "fiduciary_requirement": "Growing OIC pressure", "erisa_overlay": "Standard + WA additions"},
        "transparency_requirements": {"employer_disclosure_alerts": True, "drug_pricing_transparency": "High", "pbm_contract_visibility": "Significant", "rebate_reporting": "Encouraged"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Preferred", "rebate_visibility_to_employer": "Encouraged"},
        "market_norms": {"spread_prevalence_pct": 32, "passthrough_prevalence_pct": 68, "avg_broker_comp_disclosure": "Full", "dominant_pbm_model": "Pass-through", "employer_sophistication": "High"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM-HIGH", "opportunity": "HIGH", "urgency_hook": "WA employers expect transparency — any spread-pricing PBM is a liability", "key_differentiator": "Full transparency and OIC-aligned structure", "objection": "Our PBM is reputable", "objection_response": "Reputation doesn't equal transparency. Can your PBM show you every spread dollar extracted from your plan last year?"},
    },

    "CO": {
        "code": "CO", "name": "Colorado", "region": "West",
        "priority": "MEDIUM",
        "scores": {"transparency": 7.8, "pbm_risk": 6.0, "regulatory_strictness": 7.6, "broker_comp_visibility": 7.2},
        "regulatory_rules": {"summary": "Active regulatory environment. CO passed HB-1289 requiring PBM transparency. DORA oversees health insurance.", "key_legislation": ["HB-1289 (PBM Transparency)", "CO Revised Statutes Title 10"], "enforcement_body": "Division of Insurance (DORA)", "filing_requirements": "Annual PBM report to DORA", "penalties": "Up to $10,000/day"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "WATCH", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Negotiable", "gag_clauses": "Discouraged"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Written summary", "fiduciary_requirement": "No explicit mandate", "erisa_overlay": "Standard"},
        "transparency_requirements": {"employer_disclosure_alerts": False, "drug_pricing_transparency": "Moderate-High", "pbm_contract_visibility": "Negotiable", "rebate_reporting": "Encouraged"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Growing adoption", "rebate_visibility_to_employer": "Negotiable"},
        "market_norms": {"spread_prevalence_pct": 35, "passthrough_prevalence_pct": 65, "avg_broker_comp_disclosure": "Partial-Full", "dominant_pbm_model": "Hybrid shifting to pass-through", "employer_sophistication": "High"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM", "opportunity": "MEDIUM-HIGH", "urgency_hook": "HB-1289 compliance deadline approaching", "key_differentiator": "Pass-through expertise in a transitioning market", "objection": "We just renewed our PBM contract", "objection_response": "Most contracts have audit clauses. Let us audit the last 12 months at no cost — if we find nothing, you keep the contract. If we find spread, you have grounds to renegotiate."},
    },

    "MA": {
        "code": "MA", "name": "Massachusetts", "region": "Northeast",
        "priority": "MEDIUM",
        "scores": {"transparency": 8.3, "pbm_risk": 6.8, "regulatory_strictness": 8.5, "broker_comp_visibility": 8.0},
        "regulatory_rules": {"summary": "Progressive state with strong consumer protections. CHIA provides extensive healthcare cost data. DOI actively oversees PBMs.", "key_legislation": ["MA Chapter 176D", "MA G.L. c.175H (PBM)"], "enforcement_body": "Division of Insurance (DOI) + CHIA", "filing_requirements": "Annual data submission to CHIA; broker E&O required", "penalties": "Up to $10,000/violation"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "WATCH — DOI monitoring", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Standard negotiation", "gag_clauses": "Discouraged"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Full written disclosure", "fiduciary_requirement": "Strong market expectation if not legal mandate", "erisa_overlay": "Standard + MA additions"},
        "transparency_requirements": {"employer_disclosure_alerts": True, "drug_pricing_transparency": "High — CHIA data publicly available", "pbm_contract_visibility": "Significant", "rebate_reporting": "Encouraged"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Market preferred", "rebate_visibility_to_employer": "Expected"},
        "market_norms": {"spread_prevalence_pct": 25, "passthrough_prevalence_pct": 75, "avg_broker_comp_disclosure": "Full", "dominant_pbm_model": "Pass-through", "employer_sophistication": "Very High"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "HIGH", "opportunity": "HIGH", "urgency_hook": "CHIA public data means employers can benchmark their plan costs — don't let them find out the spread without you", "key_differentiator": "Data-driven, CHIA-benchmarked advisory", "objection": "We have a sophisticated benefits team", "objection_response": "Even sophisticated teams benefit from independent fiduciary audits. ERISA mandates prudent process, not just good intent."},
    },

    "NJ": {
        "code": "NJ", "name": "New Jersey", "region": "Northeast",
        "priority": "MEDIUM",
        "scores": {"transparency": 7.6, "pbm_risk": 6.5, "regulatory_strictness": 7.8, "broker_comp_visibility": 7.2},
        "regulatory_rules": {"summary": "Strong consumer protection framework. DOB has significant oversight authority. NJ passed PBM transparency in 2021.", "key_legislation": ["NJ A-4143 (PBM Transparency, 2021)", "NJ Stat §17B:26-2.1i"], "enforcement_body": "Department of Banking and Insurance (DOBI)", "filing_requirements": "PBM registration + annual report", "penalties": "Significant civil penalties"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "WATCH", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Negotiable", "gag_clauses": "Discouraged"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Written disclosure", "fiduciary_requirement": "No explicit mandate", "erisa_overlay": "Standard"},
        "transparency_requirements": {"employer_disclosure_alerts": False, "drug_pricing_transparency": "Moderate-High", "pbm_contract_visibility": "Negotiable", "rebate_reporting": "Encouraged"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Growing", "rebate_visibility_to_employer": "Negotiable"},
        "market_norms": {"spread_prevalence_pct": 38, "passthrough_prevalence_pct": 62, "avg_broker_comp_disclosure": "Partial", "dominant_pbm_model": "Hybrid", "employer_sophistication": "High"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM", "opportunity": "HIGH", "urgency_hook": "NJ PBM Transparency Act 2021 enforcement increasing", "key_differentiator": "Full fiduciary + pass-through expertise in NJ market", "objection": "Our insurer handles PBM oversight", "objection_response": "Insurers and PBMs are often affiliated entities. Independent oversight is your fiduciary obligation under ERISA."},
    },

    "OH": {
        "code": "OH", "name": "Ohio", "region": "Midwest",
        "priority": "MEDIUM",
        "scores": {"transparency": 6.5, "pbm_risk": 7.2, "regulatory_strictness": 6.8, "broker_comp_visibility": 6.0},
        "regulatory_rules": {"summary": "Ohio was ground zero for spread pricing scandal in Medicaid. ODI passed PBM licensing. Growing private employer awareness.", "key_legislation": ["OH HB-341 (PBM Reform)", "OH Rev. Code §3959"], "enforcement_body": "Ohio Department of Insurance (ODI)", "filing_requirements": "PBM licensure + reporting", "penalties": "Up to $10,000/violation"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "HIGH PROFILE — Ohio Medicaid scandal put spread pricing in public view; employer awareness high", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Negotiable", "gag_clauses": "Not prohibited"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Written summary", "fiduciary_requirement": "No state mandate", "erisa_overlay": "Standard"},
        "transparency_requirements": {"employer_disclosure_alerts": False, "drug_pricing_transparency": "Moderate", "pbm_contract_visibility": "Negotiable", "rebate_reporting": "Not required"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Growing post-scandal", "rebate_visibility_to_employer": "Negotiable"},
        "market_norms": {"spread_prevalence_pct": 48, "passthrough_prevalence_pct": 52, "avg_broker_comp_disclosure": "Partial", "dominant_pbm_model": "Transitioning", "employer_sophistication": "Medium-High"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM", "opportunity": "HIGH", "urgency_hook": "Ohio spread pricing scandal made headlines — employers here understand the risk", "key_differentiator": "Post-scandal credibility with transparent PBM model", "objection": "That was a Medicaid issue, not commercial", "objection_response": "The same PBMs operating in Medicaid run your commercial plan. The mechanics are identical — only the oversight differs."},
    },

    "GA": {
        "code": "GA", "name": "Georgia", "region": "South",
        "priority": "MEDIUM",
        "scores": {"transparency": 5.5, "pbm_risk": 7.0, "regulatory_strictness": 5.8, "broker_comp_visibility": 5.0},
        "regulatory_rules": {"summary": "Moderate oversight. OCI has limited PBM authority. Growing employer market in Atlanta metro.", "key_legislation": ["GA Code §33-50 (PBM Licensing)"], "enforcement_body": "Office of Insurance and Safety Fire Commissioner", "filing_requirements": "PBM registration", "penalties": "Administrative penalties"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "LOW SCRUTINY — spread prevalent", "rebate_passthrough_required": False, "mac_transparency_required": False, "auditing_rights": "Negotiable", "gag_clauses": "Not prohibited"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Summary only", "fiduciary_requirement": "No state mandate", "erisa_overlay": "Standard"},
        "transparency_requirements": {"employer_disclosure_alerts": False, "drug_pricing_transparency": "Low", "pbm_contract_visibility": "Market-driven", "rebate_reporting": "Not required"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Optional", "rebate_visibility_to_employer": "Negotiable"},
        "market_norms": {"spread_prevalence_pct": 65, "passthrough_prevalence_pct": 35, "avg_broker_comp_disclosure": "Partial", "dominant_pbm_model": "Spread", "employer_sophistication": "Medium"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM-LOW", "opportunity": "HIGH", "urgency_hook": "Federal CAA 2021 broker compensation disclosure requirements take effect — employers can now demand full comp transparency", "key_differentiator": "Only advisor in GA with fiduciary-grade PBM contract review", "objection": "We've had the same broker for years", "objection_response": "Loyalty is admirable. But federal law now requires that broker to disclose every dollar they earn. Ask them for a full CAA disclosure and review it together."},
    },

    "PA": {
        "code": "PA", "name": "Pennsylvania", "region": "Northeast",
        "priority": "MEDIUM",
        "scores": {"transparency": 6.8, "pbm_risk": 6.6, "regulatory_strictness": 7.0, "broker_comp_visibility": 6.5},
        "regulatory_rules": {"summary": "PID has growing PBM oversight. PA passed PBM transparency legislation. Large employer market in Philadelphia and Pittsburgh.", "key_legislation": ["PA SB-973 (PBM Transparency)"], "enforcement_body": "Pennsylvania Insurance Department (PID)", "filing_requirements": "PBM reporting + registration", "penalties": "Up to $5,000/violation"},
        "pbm_constraints": {"spread_pricing_allowed": True, "spread_pricing_status": "WATCH", "rebate_passthrough_required": False, "mac_transparency_required": True, "auditing_rights": "Negotiable", "gag_clauses": "Discouraged"},
        "broker_comp_rules": {"disclosure_required": True, "disclosure_standard": "Written disclosure", "fiduciary_requirement": "Market expectation growing", "erisa_overlay": "Standard"},
        "transparency_requirements": {"employer_disclosure_alerts": False, "drug_pricing_transparency": "Moderate", "pbm_contract_visibility": "Negotiable", "rebate_reporting": "Not required"},
        "rebate_handling_rules": {"pooled_rebates_allowed": True, "passthrough_model": "Growing", "rebate_visibility_to_employer": "Negotiable"},
        "market_norms": {"spread_prevalence_pct": 42, "passthrough_prevalence_pct": 58, "avg_broker_comp_disclosure": "Partial", "dominant_pbm_model": "Hybrid", "employer_sophistication": "High"},
        "ca_specific_alerts": [],
        "sales_profile": {"difficulty": "MEDIUM", "opportunity": "MEDIUM-HIGH", "urgency_hook": "PA PBM reporting requirements increasing employer awareness", "key_differentiator": "Fiduciary audit service + transparent PBM alternatives", "objection": "It seems complicated", "objection_response": "We handle the complexity. You sign off on the strategy. Most employers save $300-600 PEPM within 12 months."},
    },
}

# Generate minimal data for remaining states
_REMAINING_STATES = {
    "AK": ("Alaska", "West", 4.5, 5.0, 4.8, 4.2, 68, 32),
    "AL": ("Alabama", "South", 4.0, 6.5, 4.2, 3.8, 70, 30),
    "AR": ("Arkansas", "South", 4.2, 6.2, 4.5, 4.0, 65, 35),
    "AZ": ("Arizona", "West", 5.8, 6.0, 5.5, 5.2, 55, 45),
    "CT": ("Connecticut", "Northeast", 7.8, 6.5, 7.5, 7.2, 30, 70),
    "DC": ("District of Columbia", "Northeast", 8.5, 6.8, 8.2, 8.0, 22, 78),
    "DE": ("Delaware", "Northeast", 6.2, 6.0, 6.0, 5.8, 48, 52),
    "HI": ("Hawaii", "West", 7.5, 5.5, 7.2, 7.0, 28, 72),
    "IA": ("Iowa", "Midwest", 5.5, 5.8, 5.5, 5.2, 58, 42),
    "ID": ("Idaho", "West", 4.8, 5.5, 5.0, 4.5, 62, 38),
    "IN": ("Indiana", "Midwest", 5.5, 6.2, 5.8, 5.0, 55, 45),
    "KS": ("Kansas", "Midwest", 4.5, 5.5, 4.8, 4.2, 65, 35),
    "KY": ("Kentucky", "South", 5.2, 6.5, 5.5, 4.8, 60, 40),
    "LA": ("Louisiana", "South", 5.0, 6.8, 5.2, 4.8, 62, 38),
    "ME": ("Maine", "Northeast", 6.8, 5.8, 6.5, 6.2, 35, 65),
    "MI": ("Michigan", "Midwest", 6.5, 6.5, 6.8, 6.2, 42, 58),
    "MN": ("Minnesota", "Midwest", 7.5, 6.2, 7.2, 7.0, 32, 68),
    "MO": ("Missouri", "Midwest", 5.0, 6.0, 5.2, 4.8, 60, 40),
    "MS": ("Mississippi", "South", 3.8, 6.8, 4.0, 3.5, 72, 28),
    "MT": ("Montana", "West", 4.5, 5.2, 4.8, 4.2, 65, 35),
    "NC": ("North Carolina", "South", 6.0, 6.5, 6.2, 5.8, 48, 52),
    "ND": ("North Dakota", "Midwest", 4.8, 5.5, 5.0, 4.5, 62, 38),
    "NE": ("Nebraska", "Midwest", 5.2, 5.8, 5.5, 5.0, 58, 42),
    "NH": ("New Hampshire", "Northeast", 6.5, 6.0, 6.5, 6.2, 40, 60),
    "NM": ("New Mexico", "West", 5.8, 6.2, 5.8, 5.5, 52, 48),
    "NV": ("Nevada", "West", 6.2, 6.5, 6.0, 5.8, 50, 50),
    "OK": ("Oklahoma", "South", 4.5, 6.2, 4.8, 4.2, 65, 35),
    "OR": ("Oregon", "West", 7.8, 6.0, 7.5, 7.2, 28, 72),
    "RI": ("Rhode Island", "Northeast", 7.2, 6.2, 7.0, 6.8, 32, 68),
    "SC": ("South Carolina", "South", 4.8, 6.5, 5.0, 4.5, 65, 35),
    "SD": ("South Dakota", "Midwest", 4.2, 5.5, 4.5, 4.0, 65, 35),
    "TN": ("Tennessee", "South", 5.2, 6.5, 5.5, 5.0, 58, 42),
    "UT": ("Utah", "West", 5.8, 5.8, 5.8, 5.5, 50, 50),
    "VA": ("Virginia", "South", 6.5, 6.2, 6.5, 6.2, 45, 55),
    "VT": ("Vermont", "Northeast", 7.5, 5.8, 7.2, 7.0, 28, 72),
    "WI": ("Wisconsin", "Midwest", 6.2, 6.0, 6.2, 5.8, 45, 55),
    "WV": ("West Virginia", "South", 5.0, 6.8, 5.2, 4.8, 65, 35),
    "WY": ("Wyoming", "West", 4.0, 5.5, 4.2, 3.8, 70, 30),
}

for code, (name, region, transp, pbm_risk, reg, broker_comp, spread_pct, pass_pct) in _REMAINING_STATES.items():
    priority = "MEDIUM" if transp >= 7.0 else "STANDARD"
    _STATE_DATA[code] = {
        "code": code, "name": name, "region": region, "priority": priority,
        "scores": {
            "transparency": transp,
            "pbm_risk": pbm_risk,
            "regulatory_strictness": reg,
            "broker_comp_visibility": broker_comp,
        },
        "regulatory_rules": {
            "summary": f"{name} operates under standard ERISA framework with state insurance oversight. PBM oversight is moderate.",
            "key_legislation": ["ERISA (Federal)", "State Insurance Code"],
            "enforcement_body": f"{name} Department of Insurance",
            "filing_requirements": "Standard state filing requirements",
            "penalties": "Standard administrative penalties",
        },
        "pbm_constraints": {
            "spread_pricing_allowed": True,
            "spread_pricing_status": "LOW SCRUTINY" if spread_pct >= 60 else "MODERATE",
            "rebate_passthrough_required": False,
            "mac_transparency_required": transp >= 6.5,
            "auditing_rights": "Negotiable",
            "gag_clauses": "Not prohibited",
        },
        "broker_comp_rules": {
            "disclosure_required": True,
            "disclosure_standard": "Written summary",
            "fiduciary_requirement": "No state mandate",
            "erisa_overlay": "Standard federal ERISA",
        },
        "transparency_requirements": {
            "employer_disclosure_alerts": transp >= 8.0,
            "drug_pricing_transparency": "Low-Moderate",
            "pbm_contract_visibility": "Market-driven",
            "rebate_reporting": "Not required",
        },
        "rebate_handling_rules": {
            "pooled_rebates_allowed": True,
            "passthrough_model": "Optional",
            "rebate_visibility_to_employer": "Negotiable",
        },
        "market_norms": {
            "spread_prevalence_pct": spread_pct,
            "passthrough_prevalence_pct": pass_pct,
            "avg_broker_comp_disclosure": "Partial" if broker_comp >= 6.0 else "Minimal",
            "dominant_pbm_model": "Spread" if spread_pct >= 55 else "Hybrid",
            "employer_sophistication": "Medium",
        },
        "ca_specific_alerts": [],
        "sales_profile": {
            "difficulty": "MEDIUM-LOW",
            "opportunity": "MEDIUM",
            "urgency_hook": "Federal CAA 2021 broker disclosure requirements apply in all states",
            "key_differentiator": "Transparent PBM advisory where market still dominated by spread",
            "objection": "We're satisfied with our current plan",
            "objection_response": "Satisfaction is not the same as optimization. When did you last audit your PBM contract for spread pricing?",
        },
    }


# ─── Sales Angle Templates ────────────────────────────────────────────────────

_SALES_ANGLES: dict[str, dict] = {
    "self-funded": {
        "small": {
            "talking_points": [
                "As a self-funded employer, every dollar of PBM spread comes directly out of your plan — not the insurer's pocket, yours.",
                "Federal CAA 2021 gives you the legal right to full PBM cost transparency. Most small employers don't know this.",
                "Pass-through pricing models are now accessible to employers with 100+ employees — you don't need to be Fortune 500.",
            ],
            "objections": [
                ("We can't afford to self-fund", "Self-funding doesn't mean unlimited risk. Level-funded hybrids give you the savings of self-funding with stop-loss protection."),
                ("Our broker handles this", "Your broker is required under CAA 2021 to disclose what they earn from your PBM. Have they? If not, ask them today."),
            ],
            "urgency_hooks": [
                "CAA 2021 broker disclosure deadline has passed — non-compliant brokers expose you to fiduciary liability.",
                "PBM audits typically surface $300-600 PEPM in recoverable savings for self-funded plans.",
            ],
        },
        "mid-market": {
            "talking_points": [
                "Mid-market self-funded employers are the primary target of spread pricing — large enough to generate significant revenue, not large enough to audit.",
                "A pass-through PBM conversion typically saves 15-25% on total Rx spend in year one for 200-1,000 employee plans.",
                "ERISA requires fiduciary prudence — that includes annually benchmarking your PBM contract against market alternatives.",
            ],
            "objections": [
                ("Switching is too disruptive", "Transitions timed to renewal have minimal disruption. We handle the entire migration with zero out-of-pocket cost to you."),
                ("Our current PBM is a big brand", "Big brands extract the most spread. The three largest PBMs control 80% of the market and average 18-22% spread on generic drugs."),
            ],
            "urgency_hooks": [
                "Your contract renews in [X] months — that's your window. Miss it and you're locked in for another year.",
                "Specialty drug costs are rising 15-20% annually. Spread pricing on specialty is where the largest extraction occurs.",
            ],
        },
        "large": {
            "talking_points": [
                "Large self-funded plans have full negotiating leverage — and most are still leaving millions on the table through legacy spread contracts.",
                "Your fiduciary obligation under ERISA requires you to document that you shopped the market. A benchmark analysis is low-cost protection.",
                "Direct contracting with specialty manufacturers is now viable for plans above 3,000 lives — bypassing the PBM markup entirely.",
            ],
            "objections": [
                ("We have a dedicated benefits team", "Even sophisticated teams benefit from an independent audit. Internal teams have political constraints; we don't."),
                ("We already did a PBM RFP", "When? Market conditions change annually. PBMs renegotiate terms quarterly. A stale RFP is not a defense."),
            ],
            "urgency_hooks": [
                "DOL is increasing ERISA enforcement — documented prudent process is no longer optional.",
                "Your plan's specialty drug spend is the fastest-growing liability. We can show you exactly where the extraction is happening.",
            ],
        },
        "jumbo": {
            "talking_points": [
                "Jumbo self-funded plans have the leverage to demand full transparency, audit rights, and 100% rebate passthrough — few exercise it.",
                "Direct manufacturer relationships for GLP-1s and other high-cost specialty drugs can save $2,000-8,000 per member annually.",
                "Coalition purchasing with like-sized employers in your sector compounds your leverage without administrative complexity.",
            ],
            "objections": [
                ("We have a strategic PBM partner", "Partnership doesn't preclude transparency. If they're a true partner, they'll welcome an audit."),
                ("Our CFO is focused on other priorities", "Rx is typically your second-largest healthcare cost driver. A 20% reduction is a CFO conversation, not a benefits conversation."),
            ],
            "urgency_hooks": [
                "GLP-1 drug costs could represent 15-20% of your total Rx spend by 2026. Your current contract may have no protection against this.",
                "ERISA litigation against fiduciaries for imprudent plan management is at an all-time high. Document your process now.",
            ],
        },
    },
    "fully-insured": {
        "small": {
            "talking_points": [
                "Fully insured plans don't expose you to PBM spread directly, but your renewal rates are heavily influenced by it.",
                "Moving to level-funded or self-funded gives you visibility and control that fully insured simply cannot provide.",
                "Broker compensation transparency under CAA 2021 applies even to fully insured plans — ask your broker for a full disclosure.",
            ],
            "objections": [
                ("We like the predictability", "Level-funded plans offer the same premium predictability with the upside of self-funding when claims are favorable."),
                ("Our carrier handles everything", "Your carrier and their PBM are often the same company. Who's auditing the auditor?"),
            ],
            "urgency_hooks": [
                "Your next renewal will include PBM cost increases baked into the premium — you won't see the detail, just the bill.",
                "CAA 2021 gives you the right to your claims data even on fully insured plans. Most employers don't know to ask.",
            ],
        },
        "mid-market": {
            "talking_points": [
                "Fully insured at 200-500 lives means you're paying maximum margin to the carrier and PBM with zero transparency.",
                "A level-funded conversion could save 8-15% annually while giving you full claims and Rx visibility.",
                "Your broker is required to disclose what they earn from recommending your fully insured carrier. Request the CAA disclosure now.",
            ],
            "objections": [
                ("We've had stable rates", "Stability doesn't mean value. You may be stable at 20% above market. We can benchmark it."),
                ("We can't take on the risk", "Stop-loss covers catastrophic risk. Your expected claims savings more than offset the premium."),
            ],
            "urgency_hooks": [
                "Carriers are aggressively raising fully insured premiums. Self-funding is now your hedge against that trend.",
                "Level-funded products are now available with stop-loss as low as $15,000 individual/$500,000 aggregate — risk is manageable.",
            ],
        },
        "large": {
            "talking_points": [
                "Any employer above 500 lives on fully insured is significantly overpaying. The risk pool has long since justified self-funding.",
                "Converting 500+ lives to self-funded saves an average of $1.2-2.8M annually in carrier margin alone.",
                "You have leverage — use it. A conversion strategy with full stop-loss protection is a no-brainer at your size.",
            ],
            "objections": [
                ("The board won't approve the change", "Present it as risk management, not risk taking. Stop-loss eliminates catastrophic exposure."),
                ("Our incumbent carrier will push back", "Competition is healthy. Use the RFP process to force your carrier to bid competitively."),
            ],
            "urgency_hooks": [
                "At 500+ lives, every year on fully insured is $1M+ in recoverable savings left on the table.",
                "Self-funded plan assets belong to the employer under ERISA. Fully insured plan assets belong to the carrier.",
            ],
        },
        "jumbo": {
            "talking_points": [
                "Jumbo employers on fully insured are an anomaly — almost always the result of inertia, not strategy.",
                "The transition to self-funding at scale is complex but generates immediate, measurable ROI.",
                "Direct contracting with health systems and PBMs at your scale bypasses all intermediary margins.",
            ],
            "objections": [
                ("We have union contracts tied to the carrier", "Union agreements can be structured around self-funding. Many union plans have been self-funded for decades."),
                ("The transition is too complex", "We've managed this transition for employers of your size. Complexity is our differentiator."),
            ],
            "urgency_hooks": [
                "Every year of delay is $5-15M in recoverable margin paid to your carrier and PBM.",
                "Your competitors at your size are self-funded. You're funding their efficiency advantage.",
            ],
        },
    },
    "level-funded": {
        "mid-market": {
            "talking_points": [
                "Level-funded is the right first step — now optimize the PBM component, which is the largest variable cost in your Rx program.",
                "Most level-funded PBM arrangements still include embedded spread. A pass-through upgrade retains your premium predictability.",
                "You have claims data rights on level-funded. Use them — run an Rx analysis to see exactly where spend is going.",
            ],
            "objections": [
                ("We just converted to level-funded", "Great foundation. Now optimize what's inside it — the PBM is the next lever."),
                ("Our TPA handles the PBM", "TPAs often receive indirect PBM compensation. A full disclosure request will clarify the relationship."),
            ],
            "urgency_hooks": [
                "Level-funded with a non-transparent PBM is like a transparent door with a locked box behind it. Let us open the box.",
                "GLP-1 drugs could double your Rx costs in 24 months. Optimizing your PBM now is the hedge.",
            ],
        },
    },
}


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _get_state_or_404(code: str) -> dict:
    code = code.upper()
    if code not in _STATE_DATA:
        raise HTTPException(404, f"State '{code}' not found")
    return _STATE_DATA[code]


def _state_summary(s: dict) -> dict:
    """Return condensed state data for list/map views."""
    return {
        "code": s["code"],
        "name": s["name"],
        "region": s["region"],
        "priority": s["priority"],
        "scores": s["scores"],
        "spread_prevalence_pct": s["market_norms"]["spread_prevalence_pct"],
        "passthrough_prevalence_pct": s["market_norms"]["passthrough_prevalence_pct"],
        "dominant_pbm_model": s["market_norms"]["dominant_pbm_model"],
        "alert_count": len(s.get("ca_specific_alerts", [])),
    }


def _build_sales_angle_template(state: dict, client_type: str, employer_size: str, industry: Optional[str]) -> dict:
    """Rule-based Sales Angle Generator."""
    client_type_key = client_type.lower().replace("-", "_").replace(" ", "_")
    if "self" in client_type_key:
        client_type_key = "self-funded"
    elif "level" in client_type_key:
        client_type_key = "level-funded"
    else:
        client_type_key = "fully-insured"

    size_key = employer_size.lower().replace("-", "_").replace(" ", "_")
    if "small" in size_key:
        size_key = "small"
    elif "large" in size_key and "mid" not in size_key:
        size_key = "large" if "jumbo" not in size_key else "jumbo"
    elif "jumbo" in size_key:
        size_key = "jumbo"
    else:
        size_key = "mid-market"

    templates = _SALES_ANGLES.get(client_type_key, _SALES_ANGLES["self-funded"])
    angle = templates.get(size_key, templates.get("mid-market", {}))

    # Overlay state-specific urgency
    state_urgency = state["sales_profile"].get("urgency_hook", "")
    legislation = state["regulatory_rules"].get("key_legislation", [])
    spread_pct = state["market_norms"]["spread_prevalence_pct"]

    talking_points = list(angle.get("talking_points", []))
    if state["priority"] in ("PRIORITY", "HIGH"):
        talking_points.insert(0, f"{state['name']} has a regulatory strictness score of {state['scores']['regulatory_strictness']}/10 — among the highest in the U.S. Your clients here face active enforcement risk.")

    if spread_pct >= 55:
        talking_points.append(f"{state['name']}'s market is {spread_pct}% spread-pricing dominated — meaning most employers are overpaying and don't know it. You have a wide-open competitive window.")
    elif spread_pct <= 30:
        talking_points.append(f"{state['name']}'s market has already shifted to {state['market_norms']['passthrough_prevalence_pct']}% pass-through — clients here expect transparency. Anything less is a liability.")

    urgency_hooks = list(angle.get("urgency_hooks", []))
    if state_urgency:
        urgency_hooks.insert(0, state_urgency)
    if legislation:
        urgency_hooks.append(f"Key legislation in {state['name']}: {', '.join(legislation[:2])} — employers need guidance now.")

    industry_note = None
    if industry:
        industry_lower = industry.lower()
        if "health" in industry_lower or "medical" in industry_lower:
            industry_note = "Healthcare employers are under heightened scrutiny — their own benefit plans are subject to the same transparency standards they must meet for patients."
        elif "finance" in industry_lower or "bank" in industry_lower:
            industry_note = "Financial services employers understand fiduciary duty better than most. Lead with ERISA fiduciary language — it resonates immediately."
        elif "manufacturing" in industry_lower:
            industry_note = "Manufacturing employers often have high Rx utilization (musculoskeletal, pain management). PBM optimization has outsized impact on their plan costs."
        elif "tech" in industry_lower:
            industry_note = "Tech employers are analytically sophisticated — lead with data and benchmarks. They'll run the numbers themselves if you give them the right inputs."
        elif "retail" in industry_lower:
            industry_note = "Retail employers have high turnover and diverse demographic claims patterns. Rx cost volatility is a CFO-level conversation."

    # Rule-based email subject fallback
    strictness = state["scores"]["regulatory_strictness"]
    if strictness >= 8:
        email_subject = f"Is your {state['name']} benefit plan built for the new PBM rules?"
    elif state["priority"] in ("PRIORITY", "HIGH"):
        email_subject = f"What {state['name']} employers need to know about PBM costs"
    elif spread_pct >= 55:
        email_subject = f"Your {state['name']} PBM contract may be costing you more than you know"
    else:
        email_subject = f"How {state['name']} employers are cutting Rx costs in 2024"

    # Rule-based discovery questions fallback
    discovery_questions = [
        f"When did you last audit your PBM contract for spread pricing — and do you know what percentage of your Rx spend goes to the PBM versus actual drug costs in {state['name']}?",
        f"Are you currently receiving full rebate passthrough, or are rebates being pooled at the carrier level?",
        f"Has your broker disclosed their total compensation from your current PBM arrangement, including any volume bonuses or administrative fees?",
    ]

    return {
        "state": state["code"],
        "state_name": state["name"],
        "client_type": client_type,
        "employer_size": employer_size,
        "industry": industry,
        "talking_points": talking_points[:5],
        "objections": angle.get("objections", [])[:3],
        "urgency_hooks": urgency_hooks[:4],
        "key_differentiator": state["sales_profile"].get("key_differentiator", ""),
        "regulatory_context": {
            "strictness_score": state["scores"]["regulatory_strictness"],
            "key_legislation": legislation[:3],
            "pbm_status": state["pbm_constraints"]["spread_pricing_status"],
        },
        "industry_note": industry_note,
        "email_subject": email_subject,
        "discovery_questions": discovery_questions,
        "ai_generated": False,
    }


async def _claude_sales_angle(state: dict, client_type: str, employer_size: str, industry: Optional[str]) -> Optional[dict]:
    """Claude-powered Sales Angle Generator."""
    import os
    key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    try:
        from backend import anthropic_compat as anthropic
        client = anthropic.Anthropic(api_key=key)

        legislation = ", ".join(state["regulatory_rules"].get("key_legislation", [])[:3])
        spread = state["market_norms"]["spread_prevalence_pct"]
        strictness = state["scores"]["regulatory_strictness"]
        pbm_risk = state["scores"]["pbm_risk"]
        priority = state["priority"]
        broker_comp = state.get("broker_comp_rules", {}).get("disclosure_standard", "unknown")
        rebate_model = state.get("rebate_handling_rules", {}).get("passthrough_model", "unknown")
        sales_difficulty = state["sales_profile"].get("difficulty", "MEDIUM")
        sales_opportunity = state["sales_profile"].get("opportunity", "MEDIUM")
        key_differentiator = state["sales_profile"].get("key_differentiator", "")

        prompt = f"""You are a senior benefits consultant and sales strategist for a fiduciary PBM advisory firm (Kincaid Health).
Generate a Sales Angle for the following scenario:

State: {state['name']} ({state['code']})
Priority Tier: {priority}
State Regulatory Strictness: {strictness}/10
PBM Risk Score: {pbm_risk}/10
Key Legislation: {legislation}
Market Spread Prevalence: {spread}%
PBM Status in {state['name']}: {state['pbm_constraints']['spread_pricing_status']}
Broker Comp Disclosure Standard: {broker_comp}
Rebate Handling Model: {rebate_model}
Sales Difficulty: {sales_difficulty}
Sales Opportunity: {sales_opportunity}
Key Differentiator: {key_differentiator}
Client Type: {client_type}
Employer Size: {employer_size}
Industry: {industry or 'Not specified'}

Respond in this EXACT JSON format (no other text):
{{
  "opening_hook": "One powerful opening sentence for a cold call or email",
  "talking_points": ["Point 1", "Point 2", "Point 3", "Point 4"],
  "top_objection": "The most likely objection from this type of employer in this state",
  "objection_response": "The exact response — direct, confident, data-driven",
  "urgency_hook": "State-specific regulatory or market urgency — one sentence",
  "closing_ask": "The specific next step to propose",
  "email_subject": "A cold outreach subject line tied to this state's regulatory environment — 8 words or fewer, no clickbait",
  "linkedin_opener": "A 300-character LinkedIn connection request or InMail opener — conversational, state-specific, no jargon overload",
  "discovery_questions": ["Question 1 — diagnostic, first-meeting quality", "Question 2", "Question 3"]
}}"""

        msg = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=900,
            messages=[{"role": "user", "content": prompt}],
        )
        import json
        raw = msg.content[0].text.strip()
        parsed = json.loads(raw)
        parsed["ai_generated"] = True
        return parsed
    except Exception as e:
        logger.warning("[SalesIQ] Claude angle generation failed: %s", e)
        return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/states")
async def list_states():
    """All 50 states summary (for map view and comparison grid)."""
    return {
        "states": [_state_summary(s) for s in _STATE_DATA.values()],
        "total": len(_STATE_DATA),
        "priority_states": [s["code"] for s in _STATE_DATA.values() if s["priority"] == "PRIORITY"],
        "high_priority": [s["code"] for s in _STATE_DATA.values() if s["priority"] == "HIGH"],
    }


@router.get("/states/{code}")
async def get_state(code: str):
    """Full state detail — all regulatory, scoring, and sales intelligence."""
    return _get_state_or_404(code)


@router.post("/compare")
async def compare_states(req: CompareRequest):
    """Multi-state side-by-side comparison."""
    if len(req.state_codes) > 6:
        raise HTTPException(422, "Maximum 6 states per comparison")
    if len(req.state_codes) < 2:
        raise HTTPException(422, "Provide at least 2 state codes to compare")

    states = [_get_state_or_404(code) for code in req.state_codes]

    # Build comparison matrix
    comparison = {
        "states": [s["code"] for s in states],
        "names": [s["name"] for s in states],
        "scores": {
            s["code"]: s["scores"] for s in states
        },
        "market_norms": {
            s["code"]: s["market_norms"] for s in states
        },
        "pbm_risk": {
            s["code"]: s["pbm_constraints"]["spread_pricing_status"] for s in states
        },
        "legislation_count": {
            s["code"]: len(s["regulatory_rules"].get("key_legislation", [])) for s in states
        },
        "alert_count": {
            s["code"]: len(s.get("ca_specific_alerts", [])) for s in states
        },
        "strictest": max(states, key=lambda s: s["scores"]["regulatory_strictness"])["code"],
        "most_spread": max(states, key=lambda s: s["market_norms"]["spread_prevalence_pct"])["code"],
        "best_opportunity": max(states, key=lambda s: {"VERY HIGH": 4, "HIGH": 3, "MEDIUM-HIGH": 2, "MEDIUM": 1, "MEDIUM-LOW": 0}.get(s["sales_profile"]["opportunity"], 0))["code"],
    }

    return {
        "comparison": comparison,
        "states_detail": {s["code"]: _state_summary(s) for s in states},
    }


@router.post("/sales-angle")
async def generate_sales_angle(req: SalesAngleRequest):
    """
    Sales Angle Generator.
    Input: state + client type + employer size + industry.
    Output: talking points, objection handling, regulatory urgency, closing ask.
    Uses Claude if available, falls back to rule-based templates.
    """
    state = _get_state_or_404(req.state_code)

    # Try Claude first
    claude_result = await _claude_sales_angle(state, req.client_type, req.employer_size, req.industry)
    if claude_result:
        claude_result.update({
            "state": state["code"],
            "state_name": state["name"],
            "client_type": req.client_type,
            "employer_size": req.employer_size,
            "industry": req.industry,
            "regulatory_context": {
                "strictness_score": state["scores"]["regulatory_strictness"],
                "key_legislation": state["regulatory_rules"].get("key_legislation", [])[:3],
                "pbm_status": state["pbm_constraints"]["spread_pricing_status"],
            },
        })
        return claude_result

    # Fallback to template
    return _build_sales_angle_template(state, req.client_type, req.employer_size, req.industry)


@router.get("/alerts")
async def get_alerts():
    """Compliance alerts feed — prioritized by severity, CA first."""
    alerts = []

    # CA alerts always first
    ca = _STATE_DATA.get("CA", {})
    for alert in ca.get("ca_specific_alerts", []):
        alerts.append({**alert, "state": "CA", "state_name": "California"})

    # Other high-priority states
    for code, state in _STATE_DATA.items():
        if code == "CA":
            continue
        if state.get("priority") in ("HIGH", "PRIORITY") and state.get("ca_specific_alerts"):
            for alert in state["ca_specific_alerts"]:
                alerts.append({**alert, "state": code, "state_name": state["name"]})

    # Global alerts applicable everywhere
    alerts.append({
        "type": "FEDERAL",
        "severity": "HIGH",
        "title": "CAA 2021 Broker Compensation Disclosure — All States",
        "description": "The Consolidated Appropriations Act 2021 requires covered service providers (brokers, consultants) to disclose all direct and indirect compensation. This applies nationwide regardless of state law.",
        "action": "Request CAA 2021 compensation disclosure from all benefit advisors",
        "state": "ALL",
        "state_name": "All States (Federal)",
    })
    alerts.append({
        "type": "FEDERAL",
        "severity": "MEDIUM",
        "title": "ERISA Fiduciary Prudent Process — All States",
        "description": "ERISA requires plan fiduciaries to document prudent process in selecting and monitoring service providers. PBM contract reviews and benchmarking are now considered baseline fiduciary duty.",
        "action": "Document annual PBM contract review in plan records",
        "state": "ALL",
        "state_name": "All States (Federal)",
    })

    return {"alerts": alerts, "total": len(alerts)}
