"""
Account Intelligence Hub — Kincaid IQ
Unified account enrichment from multiple data providers.

Providers (all run in parallel per request):
  FIRMOGRAPHIC & ENRICHMENT
  1. Apollo.io          — company + people search (APOLLO_API_KEY)
  2. Clearbit           — company firmographics (CLEARBIT_API_KEY)
  3. D&B Direct+        — DUNS, firmographics, financial health (DNB_CLIENT_KEY/SECRET)

  CONTACT DISCOVERY
  4. Hunter.io          — email discovery (HUNTER_API_KEY) [already available]
  5. HubSpot            — CRM company lookup (HUBSPOT_ACCESS_TOKEN)
  6. Salesforce         — CRM account lookup (SALESFORCE_USERNAME/PASSWORD/TOKEN)
  7. ZoomInfo           — B2B intel [enterprise — ZOOMINFO_API_KEY]
  8. Cognism            — GDPR-compliant B2B data [enterprise — COGNISM_API_KEY]
  9. LinkedIn Sales Nav — org chart [enterprise — LINKEDIN_SALESNAV_TOKEN]

  TECHNOGRAPHIC
  10. BuiltWith         — 50,000+ tech categories (BUILTWITH_API_KEY)
  11. Wappalyzer        — fast stack detection, free tier (WAPPALYZER_API_KEY)
  12. TheirStack        — hiring-signal driven tech intent (THEIRSTACK_API_KEY)

  SIGNAL / INTELLIGENCE
  13. Crunchbase        — funding rounds, events, investors (CRUNCHBASE_API_KEY)
  14. Bombora           — B2B intent data [enterprise — BOMBORA_CLIENT_ID/SECRET]

Endpoints:
  GET  /api/account-intel/providers              — all provider statuses + ranked stack
  GET  /api/account-intel/intel-stack            — ranked API evaluation (MVP + Enterprise)
  POST /api/account-intel/enrich                 — unified account enrichment
  POST /api/account-intel/find-contacts          — contact discovery across providers
  GET  /api/account-intel/tech-stack/{domain}    — technographic (BuiltWith + Wappalyzer)
  GET  /api/account-intel/signals/{domain}       — buying signals (Crunchbase + TheirStack)
"""

import os
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

logger = logging.getLogger("kincaid.account_intel")
router = APIRouter(prefix="/api/account-intel", tags=["account-intel"])

# ─── Keys ─────────────────────────────────────────────────────────────────────

def _key(name: str) -> str:
    return os.environ.get(name, "")

def _configured(name: str) -> bool:
    return bool(_key(name).strip())

def _multi_configured(*names: str) -> bool:
    return all(_configured(n) for n in names)


def _clean_domain(raw: Optional[str]) -> Optional[str]:
    """Normalize any domain/URL input to a bare domain like 'cvshealth.com'.
    Returns None if the input doesn't look like a real domain (no dot)."""
    if not raw:
        return None
    d = raw.strip()
    # Strip scheme
    for prefix in ("https://www.", "http://www.", "https://", "http://", "www."):
        if d.startswith(prefix):
            d = d[len(prefix):]
    # Strip path, query, fragment
    d = d.split("/")[0].split("?")[0].split("#")[0].strip().lower()
    # If no dot, it's not a valid domain (e.g. "CVSHealth" → invalid)
    if "." not in d:
        return None
    return d or None


def _company_to_domain_guess(company: Optional[str]) -> Optional[str]:
    """Best-effort domain guess from company name. Only used as fallback."""
    if not company:
        return None
    slug = company.lower().strip()
    slug = slug.replace(" inc", "").replace(" llc", "").replace(" corp", "").replace(" co", "").replace(",", "").replace(".", "")
    slug = "".join(c for c in slug if c.isalnum())
    if not slug:
        return None
    return f"{slug}.com"


# ─── Models ───────────────────────────────────────────────────────────────────

class EnrichRequest(BaseModel):
    domain: Optional[str] = None
    company_name: Optional[str] = None
    ein: Optional[str] = None
    ticker: Optional[str] = None
    include_contacts: bool = True

class ContactSearchRequest(BaseModel):
    domain: Optional[str] = None
    company_name: Optional[str] = None
    titles: list[str] = ["HR", "Benefits", "CFO", "Chief Human Resources", "VP Benefits"]
    limit: int = 20


# ─── Provider Registry ────────────────────────────────────────────────────────

PROVIDERS = [
    {
        "id": "apollo",
        "name": "Apollo.io",
        "category": "B2B Contact & Account Intelligence",
        "key_names": ["APOLLO_API_KEY"],
        "tier": "standard",
        "capabilities": ["company_enrichment", "contact_search", "intent_signals"],
        "description": "275M+ contacts, firmographics, org charts, intent signals",
        "setup_url": "https://developer.apollo.io",
    },
    {
        "id": "clearbit",
        "name": "Clearbit",
        "category": "Company Enrichment",
        "key_names": ["CLEARBIT_API_KEY"],
        "tier": "standard",
        "capabilities": ["company_enrichment", "contact_enrichment"],
        "description": "Company enrichment — size, funding, tech stack, revenue, headcount",
        "setup_url": "https://dashboard.clearbit.com/keys",
    },
    {
        "id": "hunter",
        "name": "Hunter.io",
        "category": "Email Discovery",
        "key_names": ["HUNTER_API_KEY"],
        "tier": "standard",
        "capabilities": ["contact_search", "email_verification"],
        "description": "Email discovery and verification for any domain",
        "setup_url": "https://hunter.io/api",
    },
    {
        "id": "hubspot",
        "name": "HubSpot",
        "category": "CRM",
        "key_names": ["HUBSPOT_ACCESS_TOKEN"],
        "tier": "standard",
        "capabilities": ["company_enrichment", "contact_search", "crm_sync"],
        "description": "CRM company and contact records with deal history",
        "setup_url": "https://app.hubspot.com/private-apps",
    },
    {
        "id": "salesforce",
        "name": "Salesforce",
        "category": "CRM",
        "key_names": ["SALESFORCE_USERNAME", "SALESFORCE_PASSWORD", "SALESFORCE_SECURITY_TOKEN"],
        "tier": "standard",
        "capabilities": ["company_enrichment", "contact_search", "crm_sync", "deal_tracking"],
        "description": "CRM accounts, contacts, opportunities, and activity history",
        "setup_url": "https://salesforce.com",
    },
    {
        "id": "dnb",
        "name": "D&B Direct+",
        "category": "Firmographic & Financial Intelligence",
        "key_names": ["DNB_CLIENT_KEY", "DNB_CLIENT_SECRET"],
        "tier": "standard",
        "capabilities": ["company_enrichment", "financial_health", "risk_scoring"],
        "description": "DUNS-based firmographics, financial health, credit risk",
        "setup_url": "https://developer.dnb.com",
    },
    {
        "id": "zoominfo",
        "name": "ZoomInfo",
        "category": "B2B Contact Intelligence",
        "key_names": ["ZOOMINFO_API_KEY"],
        "tier": "enterprise",
        "capabilities": ["contact_search", "company_enrichment", "intent_signals", "org_chart"],
        "description": "Enterprise B2B contact database with org charts and buyer signals",
        "setup_url": "https://www.zoominfo.com/solutions/data",
        "intel_rank": 2, "mvp": False, "enterprise_stack": True,
        "data_category": "contact",
        "us_coverage": "EXCELLENT", "realtime": False,
    },
    {
        "id": "linkedin_sn",
        "name": "LinkedIn Sales Navigator",
        "category": "Social Selling",
        "key_names": ["LINKEDIN_SALESNAV_TOKEN"],
        "tier": "enterprise",
        "capabilities": ["contact_search", "org_chart", "job_change_alerts"],
        "description": "Decision-maker mapping, org charts, job change signals",
        "setup_url": "https://business.linkedin.com/sales-solutions/sales-navigator",
        "intel_rank": 5, "mvp": False, "enterprise_stack": True,
        "data_category": "contact",
        "us_coverage": "EXCELLENT", "realtime": True,
    },
    {
        "id": "bombora",
        "name": "Bombora",
        "category": "Intent Data",
        "key_names": ["BOMBORA_CLIENT_ID", "BOMBORA_CLIENT_SECRET"],
        "tier": "enterprise",
        "capabilities": ["intent_signals"],
        "description": "B2B intent data — which companies are researching your topics",
        "setup_url": "https://bombora.com/data/company-surge",
        "intel_rank": 4, "mvp": False, "enterprise_stack": True,
        "data_category": "signals",
        "us_coverage": "EXCELLENT", "realtime": False,
    },
    # ── Technographic APIs ────────────────────────────────────────────────────
    {
        "id": "builtwith",
        "name": "BuiltWith",
        "category": "Technographic Intelligence",
        "key_names": ["BUILTWITH_API_KEY"],
        "tier": "standard",
        "capabilities": ["tech_stack", "technology_detection", "historical_tech"],
        "description": "50,000+ technology categories — deepest tech profiling available. Historical data back to 2007.",
        "setup_url": "https://api.builtwith.com",
        "intel_rank": 1, "mvp": True, "enterprise_stack": True,
        "data_category": "technographic",
        "us_coverage": "EXCELLENT", "realtime": False,
        "pricing": "$500–$2,500/mo",
        "strengths": ["Deepest tech coverage (50k+)", "Historical data", "Excellent US data", "Technology change alerts"],
        "weaknesses": ["Expensive", "No org chart", "No contact data", "Bulk lookup costs"],
        "best_use": "Tech stack fingerprinting — identify what HR/benefits software an employer uses before outreach",
    },
    {
        "id": "wappalyzer",
        "name": "Wappalyzer",
        "category": "Technographic Intelligence",
        "key_names": ["WAPPALYZER_API_KEY"],
        "tier": "standard",
        "capabilities": ["tech_stack", "technology_detection"],
        "description": "Fast tech stack detection across 1,000+ technologies. Free tier available.",
        "setup_url": "https://www.wappalyzer.com/api",
        "intel_rank": 2, "mvp": True, "enterprise_stack": True,
        "data_category": "technographic",
        "us_coverage": "GOOD", "realtime": True,
        "pricing": "Free tier → $99/mo",
        "strengths": ["Free tier", "Real-time detection", "Good API docs", "Fast response"],
        "weaknesses": ["1,000 technologies (vs BuiltWith's 50k)", "Less historical data", "Smaller category depth"],
        "best_use": "MVP tech stack lookup — fast, affordable, good enough for 80% of use cases",
    },
    {
        "id": "theirstack",
        "name": "TheirStack",
        "category": "Technographic + Intent Signals",
        "key_names": ["THEIRSTACK_API_KEY"],
        "tier": "standard",
        "capabilities": ["tech_stack", "hiring_signals", "intent_signals", "job_postings"],
        "description": "Intent signals derived from job postings — reveals what tech companies are actively adopting",
        "setup_url": "https://theirstack.com",
        "intel_rank": 3, "mvp": True, "enterprise_stack": True,
        "data_category": "technographic",
        "us_coverage": "GOOD", "realtime": True,
        "pricing": "Usage-based, ~$0.01/lookup",
        "strengths": ["Hiring signal = buying intent", "Real-time job data", "Find companies evaluating new tech", "Affordable"],
        "weaknesses": ["Newer, smaller coverage than BuiltWith", "Signal interpretation required", "Less granular tech detection"],
        "best_use": "Identify employers actively hiring HR/Benefits roles — highest buying intent signal",
    },
    # ── Signal & Intelligence APIs ──────────────────────────────────────────────
    {
        "id": "crunchbase",
        "name": "Crunchbase",
        "category": "Funding & Company Events",
        "key_names": ["CRUNCHBASE_API_KEY"],
        "tier": "standard",
        "capabilities": ["funding_signals", "company_events", "firmographic", "investor_data"],
        "description": "Funding rounds, investors, acquisitions, IPOs, key executive changes",
        "setup_url": "https://data.crunchbase.com/docs",
        "intel_rank": 1, "mvp": True, "enterprise_stack": True,
        "data_category": "signals",
        "us_coverage": "EXCELLENT", "realtime": True,
        "pricing": "Pro API: $500/mo+",
        "strengths": ["Best funding data", "M&A signals", "Executive change alerts", "Acquisition intelligence"],
        "weaknesses": ["Expensive Pro tier", "Rate limits", "Less contact data than Apollo/ZoomInfo"],
        "best_use": "Identify portfolio companies pre-acquisition (M&A Benefits Due Diligence) + funding-triggered outreach",
    },
    {
        "id": "cognism",
        "name": "Cognism",
        "category": "B2B Contact Intelligence (GDPR)",
        "key_names": ["COGNISM_API_KEY"],
        "tier": "enterprise",
        "capabilities": ["contact_search", "company_enrichment", "mobile_numbers", "gdpr_compliant"],
        "description": "GDPR-compliant B2B contact data — strongest EU/UK coverage, verified mobile numbers",
        "setup_url": "https://developer.cognism.com",
        "intel_rank": 6, "mvp": False, "enterprise_stack": True,
        "data_category": "contact",
        "us_coverage": "GOOD", "realtime": False,
        "pricing": "Enterprise contract only",
        "strengths": ["GDPR compliant", "Diamond-verified mobile numbers", "Strong EU/UK data"],
        "weaknesses": ["Enterprise pricing only", "Weaker US coverage vs Apollo", "No free tier"],
        "best_use": "Enterprise accounts with EU/international operations — GDPR-safe outreach",
    },
]


# ─── Intel Stack Rankings ─────────────────────────────────────────────────────

INTEL_STACK_EVAL = {
    "ranked": [
        {
            "rank": 1, "provider": "apollo", "name": "Apollo.io",
            "category": "Firmographic + Contact",
            "overall_score": 9.2,
            "scores": {"us_coverage": 9.5, "data_depth": 8.8, "realtime": 8.0, "pricing_value": 9.5, "api_quality": 9.0},
            "verdict": "BEST ALL-AROUND — Start here. Firmographics + 275M contacts in one API. Free tier for MVP validation.",
            "mvp": True, "enterprise": True,
        },
        {
            "rank": 2, "provider": "hunter", "name": "Hunter.io",
            "category": "Email Discovery",
            "overall_score": 8.8,
            "scores": {"us_coverage": 9.0, "data_depth": 7.5, "realtime": 9.5, "pricing_value": 9.8, "api_quality": 9.5},
            "verdict": "MVP EMAIL ENGINE — Already configured. Free tier with verification. No other tool beats it for pure email discovery at this price.",
            "mvp": True, "enterprise": True,
        },
        {
            "rank": 3, "provider": "builtwith", "name": "BuiltWith",
            "category": "Technographic",
            "overall_score": 8.5,
            "scores": {"us_coverage": 9.5, "data_depth": 10.0, "realtime": 6.0, "pricing_value": 5.5, "api_quality": 8.5},
            "verdict": "TECHNOGRAPHIC GOLD STANDARD — Irreplaceable for tech stack intelligence. Use to identify employers running legacy benefits admin software (opportunity signal).",
            "mvp": True, "enterprise": True,
        },
        {
            "rank": 4, "provider": "crunchbase", "name": "Crunchbase",
            "category": "Signals & Events",
            "overall_score": 8.2,
            "scores": {"us_coverage": 9.0, "data_depth": 8.5, "realtime": 8.5, "pricing_value": 6.0, "api_quality": 8.0},
            "verdict": "M&A INTELLIGENCE — Critical for M&A Benefits Due Diligence™. Funding events = benefit re-evaluation trigger. Pairs with EDGAR Language Engine.",
            "mvp": True, "enterprise": True,
        },
        {
            "rank": 5, "provider": "wappalyzer", "name": "Wappalyzer",
            "category": "Technographic",
            "overall_score": 7.8,
            "scores": {"us_coverage": 8.0, "data_depth": 6.5, "realtime": 9.5, "pricing_value": 9.5, "api_quality": 9.0},
            "verdict": "MVP TECHNOGRAPHIC — Free tier makes this the ideal first technographic layer. Upgrade to BuiltWith when revenue justifies it.",
            "mvp": True, "enterprise": True,
        },
        {
            "rank": 6, "provider": "clearbit", "name": "Clearbit",
            "category": "Firmographic Enrichment",
            "overall_score": 7.6,
            "scores": {"us_coverage": 8.5, "data_depth": 8.0, "realtime": 7.0, "pricing_value": 6.5, "api_quality": 9.5},
            "verdict": "ENRICHMENT LAYER — Best for auto-filling company profiles from domain. Now part of HubSpot Breeze Intelligence — value increases if you're on HubSpot.",
            "mvp": True, "enterprise": True,
        },
        {
            "rank": 7, "provider": "theirstack", "name": "TheirStack",
            "category": "Intent via Hiring",
            "overall_score": 7.4,
            "scores": {"us_coverage": 8.0, "data_depth": 7.0, "realtime": 9.0, "pricing_value": 8.5, "api_quality": 7.5},
            "verdict": "DIFFERENTIATOR — Unique signal: companies hiring HR/Benefits roles = active benefits evaluation. No competitor sources this signal.",
            "mvp": False, "enterprise": True,
        },
        {
            "rank": 8, "provider": "dnb", "name": "D&B Direct+",
            "category": "Firmographic + Financial",
            "overall_score": 7.2,
            "scores": {"us_coverage": 10.0, "data_depth": 8.0, "realtime": 5.0, "pricing_value": 5.0, "api_quality": 7.0},
            "verdict": "FINANCIAL HEALTH LAYER — Best US coverage (DUNS is universal). Critical for risk scoring and ERISA fiduciary assessment of employer financial health.",
            "mvp": False, "enterprise": True,
        },
        {
            "rank": 9, "provider": "zoominfo", "name": "ZoomInfo",
            "category": "B2B Contact Intelligence",
            "overall_score": 8.9,
            "scores": {"us_coverage": 9.5, "data_depth": 9.5, "realtime": 7.5, "pricing_value": 4.0, "api_quality": 8.5},
            "verdict": "ENTERPRISE CONTACT STANDARD — Best data quality but $15k+ contracts. Only justified at enterprise sales volume. Best org chart coverage.",
            "mvp": False, "enterprise": True,
        },
        {
            "rank": 10, "provider": "bombora", "name": "Bombora",
            "category": "Intent Data",
            "overall_score": 7.8,
            "scores": {"us_coverage": 9.0, "data_depth": 8.5, "realtime": 6.0, "pricing_value": 4.5, "api_quality": 7.5},
            "verdict": "INTENT GOLD STANDARD — Identifies companies researching PBM reform, benefits transparency, and self-funding. Paired with Sales IQ = precise timing.",
            "mvp": False, "enterprise": True,
        },
        {
            "rank": 11, "provider": "linkedin_sn", "name": "LinkedIn Sales Navigator",
            "category": "Social Selling",
            "overall_score": 8.0,
            "scores": {"us_coverage": 10.0, "data_depth": 7.5, "realtime": 9.5, "pricing_value": 5.5, "api_quality": 6.5},
            "verdict": "RELATIONSHIP LAYER — Best for job change alerts and warm outreach. API access is complex (enterprise) but the underlying platform is essential for AEs.",
            "mvp": False, "enterprise": True,
        },
        {
            "rank": 12, "provider": "cognism", "name": "Cognism",
            "category": "GDPR-Compliant Contact",
            "overall_score": 6.8,
            "scores": {"us_coverage": 6.5, "data_depth": 7.5, "realtime": 6.0, "pricing_value": 4.0, "api_quality": 7.0},
            "verdict": "EU/INTERNATIONAL ONLY — Only add when expanding to international markets. Weaker US coverage than Apollo. GDPR compliance is its main differentiator.",
            "mvp": False, "enterprise": False,
        },
    ],
    "mvp_stack": {
        "tagline": "FAST + CHEAP + DEADLY",
        "description": "Minimum Viable Intelligence Stack — 3 APIs, covers 80% of enterprise intel value at a fraction of the cost.",
        "providers": ["builtwith", "clearbit", "crunchbase"],
        "provider_roles": {
            "builtwith": "Tech Stack — identify what HR/benefits software an employer runs. BuiltWith sees 50k+ technologies.",
            "clearbit": "Firmographics — company enrichment from domain alone. Industry, size, revenue, location. Now part of HubSpot Breeze.",
            "crunchbase": "Signals — funding rounds, M&A activity, IPO status. Post-funding = benefits re-evaluation trigger.",
        },
        "powers": [
            {
                "label": "Sales Insights",
                "description": "BuiltWith fingerprints incumbent HR/benefits vendors → tailor pitch to known platform. Clearbit fills CRM instantly on domain lookup.",
                "icon": "TrendingUp",
            },
            {
                "label": "Basic Scoring",
                "description": "Score accounts on: tech recency (BuiltWith), company maturity (Clearbit revenue/size), and event trigger proximity (Crunchbase last funding date).",
                "icon": "BarChart3",
            },
            {
                "label": "California Compliance Overlays",
                "description": "Clearbit state field → route CA accounts to SB-17/AB-2080 alert layer. Crunchbase CA-HQ filter → identify CA-domiciled employers for spread pricing risk flagging.",
                "icon": "Shield",
            },
        ],
        "monthly_cost_range": "$500–$3,000",
        "vs_enterprise": "80% of enterprise value at 15% of enterprise cost",
        "rationale": "BuiltWith is the gold standard for tech profiling ($500/mo, irreplaceable). Clearbit enriches company profiles from domain in one call — now accessible via HubSpot Breeze. Crunchbase Pro API unlocks the best M&A and funding signal layer available. Together: tech context + company context + event trigger = a complete sales intelligence picture without ZoomInfo or Bombora.",
        "setup_priority": ["clearbit", "crunchbase", "builtwith"],
        "add_next": "apollo",
    },
    "enterprise_stack": {
        "description": "Full Enterprise Intelligence Layer — 7 APIs, $2,000–$20,000/mo",
        "providers": ["apollo", "builtwith", "crunchbase", "zoominfo", "bombora", "linkedin_sn", "dnb"],
        "monthly_cost_range": "$2,000–$20,000",
        "coverage": "Complete account intelligence — firmographic, technographic, contact, signals, intent, financial health",
        "rationale": "Apollo for base contact/firmographic. BuiltWith for deep tech profiling. Crunchbase for M&A and funding signals. ZoomInfo for verified contact quality. Bombora for intent data to prioritize outreach. LinkedIn Sales Nav for relationship intelligence. D&B for financial health scoring.",
    },
    "unified_schema": {
        "description": "Normalized Account Intelligence Layer — all providers map to this schema",
        "fields": {
            "company_id": "UUID — internal Kincaid IQ identifier",
            "domain": "Primary domain (from Clearbit/Apollo/BuiltWith)",
            "duns": "DUNS number (D&B Direct+)",
            "state": "US state (from Apollo/Clearbit/D&B — used for Sales IQ regulatory overlay)",
            "tech_stack": "Array of technologies (BuiltWith + Wappalyzer merged, deduplicated)",
            "risk_signals": {
                "description": "Composite risk score from multiple signals",
                "components": [
                    "BuiltWith: legacy HR/benefits software detected (opportunity signal)",
                    "D&B: financial health score below threshold (risk signal)",
                    "TheirStack: high HR turnover (instability signal)",
                    "EDGAR: escalating risk factor language (deal radar signal)",
                ]
            },
            "growth_signals": {
                "description": "Composite growth signal from multiple sources",
                "components": [
                    "Crunchbase: new funding round (trigger = benefits review)",
                    "TheirStack: hiring for HR/Benefits roles (trigger = active evaluation)",
                    "LinkedIn SN: new CHRO/CFO hired (trigger = strategy reset)",
                    "Bombora: company researching PBM reform / self-funding topics (intent signal)",
                ]
            },
        }
    }
}


def _provider_status(p: dict) -> dict:
    configured = _multi_configured(*p["key_names"])
    return {
        **p,
        "configured": configured,
        "status": "configured" if configured else ("enterprise" if p["tier"] == "enterprise" else "needs_key"),
        "status_label": "Live" if configured else ("Enterprise — Contact Sales" if p["tier"] == "enterprise" else "Add API Key"),
    }


# ─── Provider Fetchers ────────────────────────────────────────────────────────

async def _fetch_apollo(company_name: Optional[str], domain: Optional[str], include_contacts: bool) -> dict:
    key = _key("APOLLO_API_KEY")
    if not key:
        return {"provider": "apollo", "status": "not_configured", "data": None}
    try:
        # Apollo v1 API authenticates via x-api-key header (body api_key is legacy and 401s on new keys)
        headers = {"x-api-key": key, "Content-Type": "application/json", "accept": "application/json"}
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            results = {}

            # Company / organization search
            if company_name or domain:
                body: dict = {"page": 1, "per_page": 1}
                if domain:
                    body["q_organization_domains"] = [domain]
                if company_name:
                    body["q_organization_name"] = company_name
                r = await client.post("https://api.apollo.io/api/v1/mixed_companies/search", json=body)
                logger.debug("[Apollo] Company search %s → %s", domain or company_name, r.status_code)
                if r.status_code == 200:
                    orgs = r.json().get("organizations", [])
                    if orgs:
                        org = orgs[0]
                        results["company"] = {
                            "name": org.get("name"),
                            "domain": org.get("primary_domain"),
                            "industry": org.get("industry"),
                            "employee_count": org.get("estimated_num_employees"),
                            "revenue_range": org.get("annual_revenue_printed"),
                            "city": org.get("city"),
                            "state": org.get("state"),
                            "country": org.get("country"),
                            "linkedin_url": org.get("linkedin_url"),
                            "founded_year": org.get("founded_year"),
                            "keywords": (org.get("keywords") or [])[:8],
                            "technologies": (org.get("technology_names") or [])[:8],
                            "apollo_id": org.get("id"),
                        }
                elif r.status_code == 401:
                    logger.warning("[Apollo] 401 Unauthorized — check APOLLO_API_KEY")
                    return {"provider": "apollo", "status": "auth_error",
                            "error": "Invalid API key — verify APOLLO_API_KEY in secrets", "data": None}

            # Contact / people search
            if include_contacts:
                contact_body: dict = {
                    "page": 1, "per_page": 10,
                    "person_titles": ["HR Director", "VP Benefits", "Chief Human Resources Officer",
                                      "CFO", "VP Human Resources", "Director Benefits", "Benefits Manager"],
                }
                if domain:
                    contact_body["q_organization_domains"] = [domain]
                if company_name:
                    contact_body["q_organization_name"] = company_name
                cr = await client.post("https://api.apollo.io/api/v1/mixed_people/search", json=contact_body)
                logger.debug("[Apollo] People search %s → %s", domain or company_name, cr.status_code)
                if cr.status_code == 200:
                    people = cr.json().get("people", [])
                    results["contacts"] = [{
                        "name": p.get("name"),
                        "title": p.get("title"),
                        "email": p.get("email"),
                        "linkedin_url": p.get("linkedin_url"),
                        "city": p.get("city"),
                        "state": p.get("state"),
                        "seniority": p.get("seniority"),
                        "phone": (p.get("sanitized_phone") or p.get("phone_numbers") or [None])[0] if isinstance(p.get("phone_numbers"), list) else p.get("sanitized_phone"),
                    } for p in people]

            if not results:
                return {"provider": "apollo", "status": "no_data", "data": None}
            return {"provider": "apollo", "status": "ok", "data": results}
    except Exception as e:
        logger.warning("[Apollo] Error: %s", e)
        return {"provider": "apollo", "status": "error", "error": str(e), "data": None}


async def _fetch_clearbit(domain: Optional[str], company_name: Optional[str]) -> dict:
    key = _key("CLEARBIT_API_KEY")
    if not key:
        return {"provider": "clearbit", "status": "not_configured", "data": None}
    if not domain and not company_name:
        return {"provider": "clearbit", "status": "no_input", "data": None}
    try:
        async with httpx.AsyncClient(timeout=12, auth=(key, "")) as client:
            params: dict = {}
            if domain:
                params["domain"] = domain
            elif company_name:
                params["name"] = company_name
            r = await client.get("https://company.clearbit.com/v2/companies/find", params=params)
            if r.status_code in (200, 201):
                c = r.json()
                return {"provider": "clearbit", "status": "ok", "data": {
                    "name": c.get("name"),
                    "domain": c.get("domain"),
                    "description": c.get("description"),
                    "industry": c.get("category", {}).get("industry"),
                    "sector": c.get("category", {}).get("sector"),
                    "employee_count": c.get("metrics", {}).get("employees"),
                    "employee_range": c.get("metrics", {}).get("employeesRange"),
                    "revenue": c.get("metrics", {}).get("estimatedAnnualRevenue"),
                    "raised": c.get("metrics", {}).get("raised"),
                    "market_cap": c.get("metrics", {}).get("marketCap"),
                    "fiscal_year_end": c.get("metrics", {}).get("fiscalYearEnd"),
                    "alexa_rank": c.get("metrics", {}).get("alexaGlobalRank"),
                    "founded": c.get("foundedYear"),
                    "type": c.get("type"),
                    "tags": c.get("tags", [])[:8],
                    "tech": c.get("tech", [])[:10],
                    "logo": c.get("logo"),
                    "linkedin_handle": c.get("linkedin", {}).get("handle"),
                    "twitter_handle": c.get("twitter", {}).get("handle"),
                    "location": {
                        "city": c.get("geo", {}).get("city"),
                        "state": c.get("geo", {}).get("state"),
                        "country": c.get("geo", {}).get("country"),
                    },
                }}
            elif r.status_code == 404:
                return {"provider": "clearbit", "status": "not_found", "data": None}
            else:
                return {"provider": "clearbit", "status": "api_error", "error": r.text[:200], "data": None}
    except Exception as e:
        logger.warning("[Clearbit] Error: %s", e)
        return {"provider": "clearbit", "status": "error", "error": str(e), "data": None}


async def _fetch_hunter(domain: Optional[str], company_name: Optional[str]) -> dict:
    key = _key("HUNTER_API_KEY")
    if not key:
        return {"provider": "hunter", "status": "not_configured", "data": None}
    try:
        # Always clean the domain — never send bare company names to the domain-search endpoint
        clean = _clean_domain(domain)
        async with httpx.AsyncClient(timeout=12) as client:
            # Use limit=10 — free plan max; paid plans support higher
            params: dict = {"api_key": key, "limit": 10}
            if clean:
                params["domain"] = clean
            elif company_name:
                params["company"] = company_name
            else:
                return {"provider": "hunter", "status": "no_input", "data": None}
            r = await client.get("https://api.hunter.io/v2/domain-search", params=params)
            raw = r.json()
            if r.status_code == 200:
                d = raw.get("data", {})
                emails = d.get("emails", []) or []
                return {"provider": "hunter", "status": "ok", "data": {
                    "domain": d.get("domain"),
                    "organization": d.get("organization"),
                    "email_count": len(emails),
                    "total_results": (d.get("meta") or {}).get("total"),
                    "pattern": d.get("pattern"),
                    "contacts": [{
                        "first_name": e.get("first_name"),
                        "last_name": e.get("last_name"),
                        "email": e.get("value"),
                        "title": e.get("position"),
                        "department": e.get("department"),
                        "confidence": e.get("confidence"),
                        "linkedin": e.get("linkedin"),
                        "verified": (e.get("verification") or {}).get("status") == "valid",
                    } for e in emails[:10]],
                }}
            # Handle known plan limit error — still parse any partial data
            errors = raw.get("errors", [])
            pagination_err = any(e.get("id") == "pagination_error" for e in errors)
            if pagination_err:
                logger.warning("[Hunter] Plan limit hit — domain=%s, trying without limit param", clean or company_name)
                # Retry without limit param
                params.pop("limit", None)
                r2 = await client.get("https://api.hunter.io/v2/domain-search", params=params)
                if r2.status_code == 200:
                    d = r2.json().get("data", {})
                    emails = d.get("emails", []) or []
                    return {"provider": "hunter", "status": "ok", "data": {
                        "domain": d.get("domain"),
                        "organization": d.get("organization"),
                        "email_count": len(emails),
                        "total_results": (d.get("meta") or {}).get("total"),
                        "pattern": d.get("pattern"),
                        "contacts": [{
                            "first_name": e.get("first_name"),
                            "last_name": e.get("last_name"),
                            "email": e.get("value"),
                            "title": e.get("position"),
                            "department": e.get("department"),
                            "confidence": e.get("confidence"),
                            "linkedin": e.get("linkedin"),
                            "verified": (e.get("verification") or {}).get("status") == "valid",
                        } for e in emails[:10]],
                    }}
            return {"provider": "hunter", "status": "api_error",
                    "error": "; ".join(e.get("details", e.get("id", "")) for e in errors) or r.text[:200],
                    "data": None}
    except Exception as e:
        logger.warning("[Hunter] Error: %s", e)
        return {"provider": "hunter", "status": "error", "error": str(e), "data": None}


async def _fetch_hubspot(company_name: Optional[str], domain: Optional[str]) -> dict:
    token = _key("HUBSPOT_ACCESS_TOKEN")
    if not token:
        return {"provider": "hubspot", "status": "not_configured", "data": None}
    try:
        async with httpx.AsyncClient(timeout=12, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}) as client:
            # Search companies
            query = domain or company_name
            if not query:
                return {"provider": "hubspot", "status": "no_input", "data": None}

            search_body = {
                "filterGroups": [],
                "query": query,
                "limit": 3,
                "properties": ["name", "domain", "industry", "numberofemployees", "annualrevenue",
                               "city", "state", "createdate", "hs_lastmodifieddate",
                               "description", "linkedin_company_page", "website", "phone"],
            }
            r = await client.post("https://api.hubapi.com/crm/v3/objects/companies/search", json=search_body)
            if r.status_code == 200:
                results = r.json().get("results", [])
                if results:
                    c = results[0]["properties"]
                    return {"provider": "hubspot", "status": "ok", "data": {
                        "hs_id": results[0]["id"],
                        "name": c.get("name"),
                        "domain": c.get("domain"),
                        "industry": c.get("industry"),
                        "employee_count": c.get("numberofemployees"),
                        "annual_revenue": c.get("annualrevenue"),
                        "city": c.get("city"),
                        "state": c.get("state"),
                        "description": c.get("description"),
                        "linkedin": c.get("linkedin_company_page"),
                        "website": c.get("website"),
                        "phone": c.get("phone"),
                        "last_modified": c.get("hs_lastmodifieddate"),
                        "total_results": r.json().get("total", 0),
                        "in_crm": True,
                    }}
                return {"provider": "hubspot", "status": "not_found", "data": {"in_crm": False, "total_results": 0}}
            return {"provider": "hubspot", "status": "api_error", "error": r.text[:200], "data": None}
    except Exception as e:
        logger.warning("[HubSpot] Error: %s", e)
        return {"provider": "hubspot", "status": "error", "error": str(e), "data": None}


async def _fetch_salesforce(company_name: Optional[str]) -> dict:
    sf_user = _key("SALESFORCE_USERNAME")
    sf_pass = _key("SALESFORCE_PASSWORD")
    sf_token = _key("SALESFORCE_SECURITY_TOKEN")
    if not all([sf_user, sf_pass, sf_token]):
        return {"provider": "salesforce", "status": "not_configured", "data": None}
    try:
        from simple_salesforce import Salesforce
        sf = Salesforce(username=sf_user, password=sf_pass, security_token=sf_token)
        if not company_name:
            return {"provider": "salesforce", "status": "no_input", "data": None}
        safe_name = company_name.replace("'", "\\'")
        result = sf.query(
            f"SELECT Id, Name, Industry, AnnualRevenue, NumberOfEmployees, BillingCity, BillingState, Website, Phone, Description "
            f"FROM Account WHERE Name LIKE '%{safe_name}%' LIMIT 3"
        )
        records = result.get("records", [])
        if records:
            a = records[0]
            return {"provider": "salesforce", "status": "ok", "data": {
                "sf_id": a.get("Id"),
                "name": a.get("Name"),
                "industry": a.get("Industry"),
                "annual_revenue": a.get("AnnualRevenue"),
                "employee_count": a.get("NumberOfEmployees"),
                "city": a.get("BillingCity"),
                "state": a.get("BillingState"),
                "website": a.get("Website"),
                "phone": a.get("Phone"),
                "description": a.get("Description"),
                "in_crm": True,
                "total_results": len(records),
            }}
        return {"provider": "salesforce", "status": "not_found", "data": {"in_crm": False}}
    except Exception as e:
        logger.warning("[Salesforce] Error: %s", e)
        return {"provider": "salesforce", "status": "error", "error": str(e), "data": None}


async def _fetch_dnb(company_name: Optional[str], domain: Optional[str]) -> dict:
    client_key = _key("DNB_CLIENT_KEY")
    client_secret = _key("DNB_CLIENT_SECRET")
    if not all([client_key, client_secret]):
        return {"provider": "dnb", "status": "not_configured", "data": None}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Get access token
            token_r = await client.post(
                "https://plus.dnb.com/v2/token",
                headers={"Content-Type": "application/json"},
                json={"grant_type": "client_credentials"},
                auth=(client_key, client_secret),
            )
            if token_r.status_code != 200:
                return {"provider": "dnb", "status": "auth_error", "data": None}
            access_token = token_r.json().get("access_token")

            # Company typeahead search
            query = company_name or domain
            search_r = await client.get(
                "https://plus.dnb.com/v1/search/typeahead",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"searchTerm": query, "searchType": "company", "pageSize": 3},
            )
            if search_r.status_code == 200:
                candidates = search_r.json().get("searchCandidates", [])
                if candidates:
                    c = candidates[0].get("organization", {})
                    duns = c.get("duns")

                    # Get full record if DUNS found
                    detail = {}
                    if duns:
                        detail_r = await client.get(
                            f"https://plus.dnb.com/v1/data/duns/{duns}",
                            headers={"Authorization": f"Bearer {access_token}"},
                            params={"productId": "cmpelk", "versionId": "v1"},
                        )
                        if detail_r.status_code == 200:
                            org = detail_r.json().get("organization", {})
                            detail = {
                                "duns": duns,
                                "primary_name": org.get("primaryName"),
                                "tradestyle_names": [n.get("name") for n in org.get("tradeStyleNames", [])[:3]],
                                "industry_codes": [i.get("description") for i in org.get("industryCodes", [])[:3]],
                                "employee_count": org.get("numberOfEmployees", [{}])[0].get("value") if org.get("numberOfEmployees") else None,
                                "annual_revenue": org.get("financials", [{}])[0].get("yearlyRevenue", [{}])[0].get("value") if org.get("financials") else None,
                                "address": {
                                    "street": org.get("primaryAddress", {}).get("streetAddress", {}).get("line1"),
                                    "city": org.get("primaryAddress", {}).get("addressLocality", {}).get("name"),
                                    "state": org.get("primaryAddress", {}).get("addressRegion", {}).get("abbreviatedName"),
                                    "postal_code": org.get("primaryAddress", {}).get("postalCode"),
                                    "country": org.get("primaryAddress", {}).get("addressCountry", {}).get("name"),
                                },
                                "is_global_ultimate": org.get("corporateLinkage", {}).get("isGlobalUltimate"),
                                "global_ultimate_duns": org.get("corporateLinkage", {}).get("globalUltimate", {}).get("duns"),
                                "business_entity_type": org.get("businessEntityType", {}).get("description"),
                                "registration_date": org.get("registrationNumbers", [{}])[0].get("registrationNumber") if org.get("registrationNumbers") else None,
                            }
                    return {"provider": "dnb", "status": "ok", "data": {
                        "name": c.get("primaryName"),
                        "duns": duns,
                        "country": c.get("primaryAddress", {}).get("addressCountry", {}).get("name"),
                        **detail,
                    }}
            return {"provider": "dnb", "status": "not_found", "data": None}
    except Exception as e:
        logger.warning("[D&B] Error: %s", e)
        return {"provider": "dnb", "status": "error", "error": str(e), "data": None}


def _enterprise_stub(provider_id: str, name: str) -> dict:
    return {
        "provider": provider_id,
        "status": "enterprise",
        "data": None,
        "message": f"{name} requires an enterprise license. Add your API key/token as a secret to activate.",
    }


# ─── Technographic Fetchers ───────────────────────────────────────────────────

async def _fetch_builtwith(domain: str) -> dict:
    key = _key("BUILTWITH_API_KEY")
    if not key:
        return {"provider": "builtwith", "status": "not_configured", "data": None}
    try:
        clean_domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://api.builtwith.com/v20/api.json",
                params={"KEY": key, "LOOKUP": clean_domain, "HIDETEXT": 1, "HIDEDL": 1},
            )
            if r.status_code == 200:
                data = r.json()
                results = data.get("Results", [{}])[0] if data.get("Results") else {}
                paths = results.get("Result", {}).get("Paths", [{}])[0] if results.get("Result", {}).get("Paths") else {}
                technologies = paths.get("Technologies", []) if paths else []

                # Group by category
                by_category: dict[str, list[str]] = {}
                for tech in technologies:
                    cat = tech.get("Tag", "Other")
                    name = tech.get("Name", "")
                    if name:
                        by_category.setdefault(cat, []).append(name)

                all_tech = [t.get("Name") for t in technologies if t.get("Name")]
                return {"provider": "builtwith", "status": "ok", "data": {
                    "domain": clean_domain,
                    "technology_count": len(technologies),
                    "tech_by_category": by_category,
                    "all_technologies": all_tech[:50],
                    "top_categories": list(by_category.keys())[:10],
                }}
            return {"provider": "builtwith", "status": "api_error", "error": r.text[:200], "data": None}
    except Exception as e:
        logger.warning("[BuiltWith] Error: %s", e)
        return {"provider": "builtwith", "status": "error", "error": str(e), "data": None}


async def _fetch_wappalyzer(domain: str) -> dict:
    key = _key("WAPPALYZER_API_KEY")
    if not key:
        return {"provider": "wappalyzer", "status": "not_configured", "data": None}
    try:
        clean_domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
        url = f"https://{clean_domain}"
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                "https://api.wappalyzer.com/lookup/v2/",
                params={"urls": url, "apiKey": key},
            )
            if r.status_code == 200:
                raw = r.json()
                entry = raw[0] if isinstance(raw, list) and raw else {}
                technologies = entry.get("technologies", [])

                by_category: dict[str, list[str]] = {}
                for tech in technologies:
                    cats = tech.get("categories", [{}])
                    cat_name = cats[0].get("name", "Other") if cats else "Other"
                    by_category.setdefault(cat_name, []).append(tech.get("name", ""))

                return {"provider": "wappalyzer", "status": "ok", "data": {
                    "domain": clean_domain,
                    "technology_count": len(technologies),
                    "tech_by_category": by_category,
                    "all_technologies": [t.get("name") for t in technologies if t.get("name")][:40],
                    "top_categories": list(by_category.keys())[:10],
                }}
            return {"provider": "wappalyzer", "status": "api_error", "error": r.text[:200], "data": None}
    except Exception as e:
        logger.warning("[Wappalyzer] Error: %s", e)
        return {"provider": "wappalyzer", "status": "error", "error": str(e), "data": None}


async def _fetch_theirstack(domain: Optional[str], company_name: Optional[str]) -> dict:
    key = _key("THEIRSTACK_API_KEY")
    if not key:
        return {"provider": "theirstack", "status": "not_configured", "data": None}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            body: dict = {
                "page": 0, "limit": 10,
                "order_by": [{"desc": True, "field": "job_count_7d"}],
            }
            if domain:
                clean = domain.replace("https://", "").replace("http://", "").split("/")[0]
                body["company_domain_or"] = [clean]
            elif company_name:
                body["company_name_or"] = [company_name]
            else:
                return {"provider": "theirstack", "status": "no_input", "data": None}

            r = await client.post(
                "https://api.theirstack.com/v1/companies/search",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=body,
            )
            if r.status_code == 200:
                raw = r.json()
                companies = raw.get("data", [])
                if companies:
                    c = companies[0]
                    return {"provider": "theirstack", "status": "ok", "data": {
                        "name": c.get("name"),
                        "domain": c.get("domain"),
                        "employee_count": c.get("employee_count"),
                        "tech_stack": c.get("technologies", [])[:20],
                        "hiring_signals": {
                            "total_jobs_7d": c.get("job_count_7d", 0),
                            "total_jobs_30d": c.get("job_count_30d", 0),
                            "top_hiring_roles": c.get("top_job_titles", [])[:5],
                        },
                        "intent_score": min(10, (c.get("job_count_7d", 0) or 0) / 5),
                    }}
                return {"provider": "theirstack", "status": "not_found", "data": None}
            return {"provider": "theirstack", "status": "api_error", "error": r.text[:200], "data": None}
    except Exception as e:
        logger.warning("[TheirStack] Error: %s", e)
        return {"provider": "theirstack", "status": "error", "error": str(e), "data": None}


# ─── Signal Fetchers ──────────────────────────────────────────────────────────

async def _fetch_crunchbase(company_name: Optional[str], domain: Optional[str]) -> dict:
    key = _key("CRUNCHBASE_API_KEY")
    if not key:
        return {"provider": "crunchbase", "status": "not_configured", "data": None}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            query = company_name or (domain.split(".")[0] if domain else None)
            if not query:
                return {"provider": "crunchbase", "status": "no_input", "data": None}

            # Search organizations
            r = await client.post(
                "https://api.crunchbase.com/api/v4/searches/organizations",
                params={"user_key": key},
                json={
                    "field_ids": ["identifier", "short_description", "funding_total", "last_funding_type",
                                  "last_funding_at", "num_funding_rounds", "rank_org", "employee_count",
                                  "revenue_range", "founded_on", "website_url", "location_identifiers",
                                  "categories", "num_acquisitions", "ipo_status", "investor_identifiers"],
                    "query": [{"type": "predicate", "field_id": "facet_ids", "operator_id": "includes", "values": ["company"]}],
                    "order": [{"field_id": "rank_org", "sort": "asc"}],
                    "limit": 3,
                    "after_id": None,
                    "field_aggregators": [],
                },
            )

            if r.status_code == 200:
                results = r.json().get("entities", [])
                if results:
                    p = results[0].get("properties", {})
                    funding = p.get("funding_total", {})
                    return {"provider": "crunchbase", "status": "ok", "data": {
                        "name": p.get("identifier", {}).get("value"),
                        "description": p.get("short_description"),
                        "total_funding_usd": funding.get("value_usd") if funding else None,
                        "total_funding_display": funding.get("value") if funding else None,
                        "last_funding_type": p.get("last_funding_type"),
                        "last_funding_date": p.get("last_funding_at"),
                        "funding_rounds": p.get("num_funding_rounds", 0),
                        "employee_range": p.get("employee_count"),
                        "revenue_range": p.get("revenue_range"),
                        "founded": str(p.get("founded_on", {}).get("value", ""))[:4] if p.get("founded_on") else None,
                        "ipo_status": p.get("ipo_status"),
                        "num_acquisitions": p.get("num_acquisitions", 0),
                        "categories": [c.get("value") for c in (p.get("categories") or [])[:5]],
                        "location": [l.get("value") for l in (p.get("location_identifiers") or [])[:2]],
                        "website": p.get("website_url"),
                        "signals": _extract_crunchbase_signals(p),
                    }}
                return {"provider": "crunchbase", "status": "not_found", "data": None}
            return {"provider": "crunchbase", "status": "api_error", "error": r.text[:300], "data": None}
    except Exception as e:
        logger.warning("[Crunchbase] Error: %s", e)
        return {"provider": "crunchbase", "status": "error", "error": str(e), "data": None}


def _extract_crunchbase_signals(props: dict) -> list[dict]:
    signals = []
    if props.get("last_funding_at"):
        signals.append({"type": "FUNDING", "severity": "HIGH",
                        "title": f"Recent funding — {props.get('last_funding_type', 'Round')}",
                        "description": "Post-funding companies re-evaluate benefits and vendor relationships. High priority outreach window.",
                        "date": props.get("last_funding_at")})
    if (props.get("num_acquisitions") or 0) > 0:
        signals.append({"type": "M&A", "severity": "HIGH",
                        "title": f"{props.get('num_acquisitions')} acquisitions recorded",
                        "description": "M&A activity triggers benefits harmonization. Ideal entry point for M&A Benefits Due Diligence™."})
    if props.get("ipo_status") == "ipo":
        signals.append({"type": "IPO", "severity": "MEDIUM",
                        "title": "Public company — IPO completed",
                        "description": "Post-IPO benefit plan compliance and executive compensation changes create advisor opportunity."})
    return signals


# ─── Unified Enrichment ───────────────────────────────────────────────────────

async def _run_all_providers(req: EnrichRequest) -> list[dict]:
    # ── Firmographic + Contact (parallel) ────────────────────────────────────
    live_tasks = [
        _fetch_apollo(req.company_name, req.domain, req.include_contacts),
        _fetch_clearbit(req.domain, req.company_name),
        _fetch_hunter(req.domain, req.company_name),
        _fetch_hubspot(req.company_name, req.domain),
        _fetch_salesforce(req.company_name),
        _fetch_dnb(req.company_name, req.domain),
        _fetch_crunchbase(req.company_name, req.domain),
        _fetch_theirstack(req.domain, req.company_name),
    ]

    # Add technographic tasks if domain is available
    if req.domain:
        live_tasks.extend([
            _fetch_builtwith(req.domain),
            _fetch_wappalyzer(req.domain),
        ])
    else:
        # No domain — return no_domain stubs for tech providers

        async def _builtwith_stub() -> dict:
            return {"provider": "builtwith", "status": "no_domain", "data": None}

        async def _wappalyzer_stub() -> dict:
            return {"provider": "wappalyzer", "status": "no_domain", "data": None}

        live_tasks.extend([_builtwith_stub(), _wappalyzer_stub()])

    # ── Enterprise stubs ─────────────────────────────────────────────────────
    enterprise_results = [
        _enterprise_stub("zoominfo", "ZoomInfo"),
        _enterprise_stub("linkedin_sn", "LinkedIn Sales Navigator"),
        _enterprise_stub("bombora", "Bombora"),
        _enterprise_stub("cognism", "Cognism"),
    ]

    if _configured("ZOOMINFO_API_KEY"):
        enterprise_results[0] = {"provider": "zoominfo", "status": "configured_no_impl", "data": None}
    if _configured("LINKEDIN_SALESNAV_TOKEN"):
        enterprise_results[1] = {"provider": "linkedin_sn", "status": "configured_no_impl", "data": None}
    if _multi_configured("BOMBORA_CLIENT_ID", "BOMBORA_CLIENT_SECRET"):
        enterprise_results[2] = {"provider": "bombora", "status": "configured_no_impl", "data": None}
    if _configured("COGNISM_API_KEY"):
        enterprise_results[3] = {"provider": "cognism", "status": "configured_no_impl", "data": None}

    live_results = await asyncio.gather(*live_tasks, return_exceptions=True)

    final = []
    for r in live_results:
        if isinstance(r, Exception):
            final.append({"provider": "unknown", "status": "error", "error": str(r), "data": None})
        else:
            final.append(r)
    final.extend(enterprise_results)
    return final


def _merge_company_profile(results: list[dict]) -> dict:
    """Best-value merge across all provider results."""
    profile: dict = {}

    def _pick(*keys, from_result: dict) -> any:
        data = from_result.get("data") or {}
        for k in keys:
            if data.get(k):
                return data[k]
        return None

    for r in results:
        if r.get("status") != "ok" or not r.get("data"):
            continue
        d = r["data"]
        # Name
        if not profile.get("name"):
            profile["name"] = d.get("name") or d.get("primary_name")
        # Domain
        if not profile.get("domain"):
            profile["domain"] = d.get("domain")
        # Industry
        if not profile.get("industry"):
            profile["industry"] = d.get("industry") or d.get("sector")
        # Size
        if not profile.get("employee_count"):
            profile["employee_count"] = d.get("employee_count")
        if not profile.get("employee_range"):
            profile["employee_range"] = d.get("employee_range")
        # Revenue
        if not profile.get("revenue"):
            profile["revenue"] = d.get("revenue") or d.get("annual_revenue") or d.get("annualrevenue")
        # Location
        if not profile.get("city"):
            addr = d.get("address") or {}
            profile["city"] = d.get("city") or addr.get("city")
        if not profile.get("state"):
            addr = d.get("address") or {}
            profile["state"] = d.get("state") or addr.get("state")
        # DUNS
        if not profile.get("duns"):
            profile["duns"] = d.get("duns")
        # CRM presence
        if d.get("in_crm"):
            if not profile.get("crm_ids"):
                profile["crm_ids"] = {}
            if r.get("provider") == "hubspot":
                profile["crm_ids"]["hubspot"] = d.get("hs_id")
            elif r.get("provider") == "salesforce":
                profile["crm_ids"]["salesforce"] = d.get("sf_id")
        # Description
        if not profile.get("description"):
            profile["description"] = d.get("description")
        # Tech
        if not profile.get("tech_stack"):
            profile["tech_stack"] = d.get("tech") or d.get("technologies")
        # Founded
        if not profile.get("founded"):
            profile["founded"] = d.get("founded") or d.get("founded_year")
        # LinkedIn
        if not profile.get("linkedin"):
            profile["linkedin"] = (d.get("linkedin_handle") and f"https://linkedin.com/company/{d.get('linkedin_handle')}") or d.get("linkedin_url") or d.get("linkedin")

    return profile


def _merge_contacts(results: list[dict]) -> list[dict]:
    """Deduplicate contacts across providers by email."""
    seen_emails: set = set()
    contacts: list[dict] = []
    for r in results:
        if r.get("status") != "ok" or not r.get("data"):
            continue
        d = r["data"]
        provider_contacts = d.get("contacts", [])
        for c in provider_contacts:
            email = (c.get("email") or "").lower().strip()
            if email and email in seen_emails:
                continue
            if email:
                seen_emails.add(email)
            c["_source"] = r.get("provider")
            contacts.append(c)
    return contacts[:30]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/providers")
async def get_providers():
    """All provider statuses — which are configured, which need keys."""
    statuses = [_provider_status(p) for p in PROVIDERS]
    configured_count = sum(1 for p in statuses if p["configured"])
    return {
        "providers": statuses,
        "configured_count": configured_count,
        "total": len(statuses),
        "live_data_available": configured_count > 0,
    }


@router.post("/enrich")
async def enrich_account(req: EnrichRequest):
    """
    Unified account enrichment.
    Runs all configured providers in parallel and returns merged company profile + contacts.
    Domain is cleaned before any provider receives it. If company_name is provided without
    a valid domain, a domain is guessed and used as a soft hint (not sent to APIs directly).
    """
    if not any([req.domain, req.company_name, req.ein, req.ticker]):
        raise HTTPException(422, "Provide at least one of: domain, company_name, ein, ticker")

    # ── Clean + validate domain ───────────────────────────────────────────────
    cleaned_domain = _clean_domain(req.domain)
    domain_was_invalid = bool(req.domain and not cleaned_domain)

    # If no valid domain but we have a company name, try to guess
    if not cleaned_domain and req.company_name:
        cleaned_domain = _company_to_domain_guess(req.company_name)

    # Rebuild the request with the cleaned domain
    cleaned_req = EnrichRequest(
        domain=cleaned_domain,
        company_name=req.company_name,
        ein=req.ein,
        ticker=req.ticker,
        include_contacts=req.include_contacts,
    )

    results = await _run_all_providers(cleaned_req)

    company_profile = _merge_company_profile(results)
    contacts = _merge_contacts(results) if req.include_contacts else []

    # Summary stats
    live_providers = [r["provider"] for r in results if r.get("status") == "ok"]
    not_configured = [r["provider"] for r in results if r.get("status") == "not_configured"]
    enterprise = [r["provider"] for r in results if r.get("status") == "enterprise"]
    errors = [r["provider"] for r in results if r.get("status") == "error"]

    return {
        "query": {
            "domain_raw": req.domain,
            "domain": cleaned_domain,
            "company_name": req.company_name,
            "ein": req.ein,
            "ticker": req.ticker,
            "domain_was_invalid": domain_was_invalid,
            "domain_was_guessed": bool(not _clean_domain(req.domain) and req.company_name and cleaned_domain),
        },
        "company_profile": company_profile,
        "contacts": contacts,
        "contact_count": len(contacts),
        "provider_results": results,
        "summary": {
            "live_providers": live_providers,
            "not_configured_providers": not_configured,
            "enterprise_providers": enterprise,
            "error_providers": errors,
            "data_sources": len(live_providers),
        },
    }


@router.post("/find-contacts")
async def find_contacts(req: ContactSearchRequest):
    """Contact discovery across all configured providers."""
    enrich_req = EnrichRequest(
        domain=req.domain,
        company_name=req.company_name,
        include_contacts=True,
    )
    results = await _run_all_providers(enrich_req)
    contacts = _merge_contacts(results)

    # Filter by title keywords if specified
    if req.titles:
        title_lower = [t.lower() for t in req.titles]
        filtered = [c for c in contacts if any(kw in (c.get("title") or "").lower() for kw in title_lower)]
        # If filter returns nothing, return all
        contacts = filtered if filtered else contacts

    return {
        "contacts": contacts[:req.limit],
        "total": len(contacts),
        "sources": list({c.get("_source") for c in contacts if c.get("_source")}),
    }


@router.get("/intent-signals/{domain}")
async def get_intent_signals(domain: str):
    """Buying intent signals for a domain (Bombora stub + Apollo signals)."""
    apollo_result = await _fetch_apollo(None, domain, False)
    signals = []

    if apollo_result.get("status") == "ok":
        company = (apollo_result.get("data") or {}).get("company", {})
        keywords = company.get("keywords", [])
        if keywords:
            signals.extend([{"source": "Apollo", "signal": f"Keyword match: {kw}", "strength": "MEDIUM"} for kw in keywords[:5]])

    bombora_configured = _multi_configured("BOMBORA_CLIENT_ID", "BOMBORA_CLIENT_SECRET")
    if not bombora_configured:
        signals.append({"source": "Bombora", "signal": "Intent data unavailable — Bombora enterprise license required", "strength": "N/A"})

    return {
        "domain": domain,
        "signals": signals,
        "bombora_configured": bombora_configured,
        "signal_count": len([s for s in signals if s["strength"] != "N/A"]),
    }


@router.get("/tech-stack/{domain:path}")
async def get_tech_stack(domain: str):
    """
    Technographic intelligence — runs BuiltWith + Wappalyzer + TheirStack in parallel.
    Returns merged, deduplicated tech stack with category grouping.
    """
    clean_domain = _clean_domain(domain)
    if not clean_domain:
        raise HTTPException(422, f"'{domain}' is not a valid domain. Use format: company.com")
    domain = clean_domain
    bw_task = _fetch_builtwith(clean_domain)
    wap_task = _fetch_wappalyzer(clean_domain)
    ts_task = _fetch_theirstack(clean_domain, None)

    bw, wap, ts = await asyncio.gather(bw_task, wap_task, ts_task, return_exceptions=True)

    # Merge tech stacks
    all_tech: set[str] = set()
    merged_by_cat: dict[str, list[str]] = {}
    sources_with_data = []

    for result in [bw, wap]:
        if isinstance(result, Exception) or not isinstance(result, dict):
            continue
        if result.get("status") == "ok" and result.get("data"):
            d = result["data"]
            sources_with_data.append(result["provider"])
            for tech in d.get("all_technologies", []):
                if tech:
                    all_tech.add(tech)
            for cat, techs in d.get("tech_by_category", {}).items():
                existing = set(merged_by_cat.get(cat, []))
                existing.update(techs)
                merged_by_cat[cat] = list(existing)

    # TheirStack adds hiring-derived tech + signals
    hiring_signals = None
    ts_tech = []
    if not isinstance(ts, Exception) and isinstance(ts, dict) and ts.get("status") == "ok" and ts.get("data"):
        ts_data = ts["data"]
        ts_tech = ts_data.get("tech_stack", [])
        hiring_signals = ts_data.get("hiring_signals")
        for t in ts_tech:
            all_tech.add(t)

    # HR/Benefits software detection (opportunity signals for Kincaid IQ)
    hr_tech_keywords = ["workday", "bamboo", "adp", "paylocity", "paychex", "gusto", "zenefits",
                        "benefitfocus", "bswift", "businessolver", "benefitsync", "luminos",
                        "fidelity", "voya", "empower", "principal", "lincoln", "unum"]
    detected_hr_tech = [t for t in all_tech if any(kw in t.lower() for kw in hr_tech_keywords)]

    # Security / analytics tech categories as qualifications
    kiq_signals = []
    if detected_hr_tech:
        kiq_signals.append({
            "type": "OPPORTUNITY",
            "title": f"HR/Benefits Software Detected: {', '.join(detected_hr_tech[:3])}",
            "description": "Employer is using identifiable benefits administration software — enables targeted conversation about plan performance and PBM contract alignment.",
            "action": "Lead with platform-specific benchmarking offer",
        })
    if hiring_signals and (hiring_signals.get("total_jobs_7d", 0) or 0) > 5:
        kiq_signals.append({
            "type": "HIRING_SIGNAL",
            "title": f"Active Hiring — {hiring_signals.get('total_jobs_7d', 0)} jobs in last 7 days",
            "description": "High hiring activity signals growth phase — benefits expansion and PBM contract review are common during growth inflection.",
            "action": "Reference hiring growth in outreach — frame benefits optimization as a talent retention tool",
        })

    return {
        "domain": clean_domain,
        "technology_count": len(all_tech),
        "all_technologies": sorted(list(all_tech)),
        "by_category": merged_by_cat,
        "hr_benefits_tech": detected_hr_tech,
        "hiring_signals": hiring_signals,
        "kiq_opportunity_signals": kiq_signals,
        "sources": {
            "builtwith": bw if not isinstance(bw, Exception) else {"status": "error"},
            "wappalyzer": wap if not isinstance(wap, Exception) else {"status": "error"},
            "theirstack": ts if not isinstance(ts, Exception) else {"status": "error"},
        },
        "sources_with_data": sources_with_data,
    }


@router.get("/signals/{domain:path}")
async def get_company_signals(domain: str):
    """
    Buying signal intelligence — Crunchbase + TheirStack + Apollo signals in parallel.
    Returns ranked signals with Kincaid IQ-specific interpretations.
    """
    clean_domain = _clean_domain(domain)
    if not clean_domain:
        raise HTTPException(422, f"'{domain}' is not a valid domain. Use format: company.com")
    clean = clean_domain
    company_name = clean.split(".")[0].capitalize()

    cb_task = _fetch_crunchbase(company_name, clean_domain)
    ts_task = _fetch_theirstack(clean_domain, None)
    ap_task = _fetch_apollo(company_name, clean_domain, False)

    cb, ts, ap = await asyncio.gather(cb_task, ts_task, ap_task, return_exceptions=True)

    all_signals: list[dict] = []

    # Crunchbase signals
    if not isinstance(cb, Exception) and isinstance(cb, dict) and cb.get("status") == "ok" and cb.get("data"):
        for sig in cb["data"].get("signals", []):
            all_signals.append({**sig, "source": "Crunchbase"})

    # TheirStack hiring signals
    if not isinstance(ts, Exception) and isinstance(ts, dict) and ts.get("status") == "ok" and ts.get("data"):
        ts_d = ts["data"]
        jobs_7d = (ts_d.get("hiring_signals") or {}).get("total_jobs_7d", 0) or 0
        jobs_30d = (ts_d.get("hiring_signals") or {}).get("total_jobs_30d", 0) or 0
        if jobs_7d > 0:
            strength = "HIGH" if jobs_7d > 20 else "MEDIUM" if jobs_7d > 5 else "LOW"
            all_signals.append({
                "type": "HIRING_SIGNAL",
                "source": "TheirStack",
                "severity": strength,
                "title": f"Active Hiring — {jobs_7d} jobs posted (7d) / {jobs_30d} jobs (30d)",
                "description": "Hiring velocity is a leading indicator of company growth and pending benefits expansion. High hiring = active benefits re-evaluation window.",
                "action": "Time outreach to align with hiring surge — frame as benefits optimization for talent acquisition",
            })
        top_roles = (ts_d.get("hiring_signals") or {}).get("top_hiring_roles", [])
        hr_roles = [r for r in top_roles if any(k in str(r).lower() for k in ["hr", "benefit", "people", "human resources", "talent", "chro"])]
        if hr_roles:
            all_signals.append({
                "type": "HR_HIRING",
                "source": "TheirStack",
                "severity": "HIGH",
                "title": f"HR/Benefits Roles Actively Hiring: {', '.join(str(r) for r in hr_roles[:3])}",
                "description": "Hiring for HR and Benefits roles is the #1 indicator of active benefit plan evaluation. This company is in-market.",
                "action": "PRIORITY OUTREACH — Employer is actively building HR/Benefits capability. Maximum buying intent.",
            })

    # Apollo intent signals
    if not isinstance(ap, Exception) and isinstance(ap, dict) and ap.get("status") == "ok" and ap.get("data"):
        ap_company = ap["data"].get("company", {})
        keywords = ap_company.get("keywords", [])
        kiq_keywords = [k for k in keywords if any(kw in str(k).lower() for kw in ["health", "benefit", "insurance", "pharma", "wellness", "hr", "people"])]
        if kiq_keywords:
            all_signals.append({
                "type": "KEYWORD_INTENT",
                "source": "Apollo",
                "severity": "MEDIUM",
                "title": f"Relevant Keywords: {', '.join(kiq_keywords[:4])}",
                "description": "Company's self-identified keywords indicate benefits/healthcare relevance.",
                "action": "Reference industry context in outreach messaging",
            })

    # Sort by severity
    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    all_signals.sort(key=lambda s: severity_order.get(s.get("severity", "LOW"), 3))

    return {
        "domain": clean_domain,
        "signal_count": len(all_signals),
        "high_priority_count": sum(1 for s in all_signals if s.get("severity") == "HIGH"),
        "signals": all_signals,
        "crunchbase_data": (cb.get("data") if not isinstance(cb, Exception) and isinstance(cb, dict) else None),
        "sources_status": {
            "crunchbase": (cb.get("status") if not isinstance(cb, Exception) and isinstance(cb, dict) else "error"),
            "theirstack": (ts.get("status") if not isinstance(ts, Exception) and isinstance(ts, dict) else "error"),
            "apollo": (ap.get("status") if not isinstance(ap, Exception) and isinstance(ap, dict) else "error"),
        },
    }


@router.get("/intel-stack")
async def get_intel_stack():
    """
    Ranked API Intelligence Stack evaluation — MVP and Enterprise recommendations.
    Returns full analysis of all 14 providers with Kincaid IQ-specific use cases.
    """
    provider_statuses = {_provider_status(p)["id"]: _provider_status(p)["configured"] for p in PROVIDERS}

    ranked = []
    for item in INTEL_STACK_EVAL["ranked"]:
        provider_id = item["provider"]
        ranked.append({
            **item,
            "configured": provider_statuses.get(provider_id, False),
        })

    return {
        "ranked": ranked,
        "mvp_stack": INTEL_STACK_EVAL["mvp_stack"],
        "enterprise_stack": INTEL_STACK_EVAL["enterprise_stack"],
        "unified_schema": INTEL_STACK_EVAL["unified_schema"],
        "configured_count": sum(1 for v in provider_statuses.values() if v),
        "total_providers": len(PROVIDERS),
    }
