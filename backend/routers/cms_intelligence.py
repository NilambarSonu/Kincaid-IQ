"""
CMS & Healthcare Intelligence Layer — Kincaid IQ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6 free public APIs — no key required for any endpoint.

1. RxNorm (NIH/NLM)         — Drug lookup, generics, biosimilars, NDC codes
2. CMS Open Payments        — Sunshine Act manufacturer payments to providers
3. Medicare Drug Spending   — Part D spending benchmark by drug
4. NPI Registry (NPPES)     — Provider identity & enrollment verification
5. PECOS Enrollment         — Medicare enrollment status by provider
6. PBGC Terminations        — Pension Benefit Guaranty Corporation plan data
"""
import logging
import asyncio
import json
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from anthropic import AsyncAnthropic
from backend.config import settings

router = APIRouter(prefix="/api/cms", tags=["cms-intelligence"])
logger = logging.getLogger("kincaid.cms_intel")

_anthropic = AsyncAnthropic(
    api_key=settings.anthropic_api_key,
    base_url=settings.anthropic_base_url,
)

_PA_SYSTEM_PROMPT = """You are Kincaid IQ — a fiduciary-grade prior authorization intelligence engine.

You function as a hybrid of:
- MIT-level systems engineer (data modeling, causal reasoning, structured systems)
- Stanford MBA (enterprise value creation, GTM logic, financial impact framing)
- Big 4 consulting partner (EY / Deloitte / Accenture-level enterprise analysis)
- Healthcare claims, PBM, and ERISA fiduciary intelligence engine

CORE MISSION: Transform prior authorization scenarios into structured, economically quantified, audit-defensible decision intelligence.

You are NOT a chatbot. You are a deterministic fiduciary intelligence layer.

RESPONSE PROTOCOL — You MUST respond with valid JSON in EXACTLY this structure:
{
  "problem_definition": {
    "headline": "One sentence structural failure summary",
    "structural_failure": "2-3 sentence description of the underlying structural failure",
    "misalignment": "Contract vs policy vs execution misalignment description"
  },
  "economic_impact": {
    "direct_spend_leakage": "Dollar range or specific figure",
    "administrative_cost": "Dollar estimate",
    "downstream_consequences": "Description of downstream financial consequences",
    "total_exposure_range": "Total dollar risk range",
    "fiduciary_risk_level": "HIGH | ELEVATED | MODERATE | LOW",
    "erisa_exposure": "Specific ERISA section exposure if applicable"
  },
  "root_cause": {
    "contractual_logic": "Contractual failure point",
    "policy_enforcement": "Policy enforcement gap",
    "operational_gap": "Operational execution failure"
  },
  "intelligence_output": {
    "risk_signals": ["signal 1", "signal 2", "signal 3"],
    "denial_pattern_category": "Category name",
    "denial_pattern_description": "Pattern description",
    "pbm_conflict_flags": ["flag 1", "flag 2"],
    "appeal_leverage_points": ["point 1", "point 2", "point 3"],
    "regulatory_hooks": ["statute or regulation 1", "statute or regulation 2"]
  },
  "prioritized_decisions": [
    {
      "rank": 1,
      "action": "Action title",
      "rationale": "Why this is #1 priority",
      "urgency": "IMMEDIATE | 48H | 7 DAYS | 30 DAYS",
      "financial_impact": "Dollar impact of action",
      "reversibility": "HIGH | MEDIUM | LOW"
    }
  ],
  "recommended_actions": {
    "immediate_steps": ["Step 1", "Step 2"],
    "appeal_strategy": "Full appeal strategy description",
    "negotiation_levers": ["Lever 1", "Lever 2"],
    "documentation_required": ["Document 1", "Document 2"],
    "escalation_path": "Escalation description"
  },
  "intelligence_grade": "A | B | C | D",
  "confidence_level": "HIGH | MEDIUM | LOW",
  "analysis_note": "Brief note on data quality or limitations"
}

PRIOR AUTHORIZATION MODULE RULES:
- Normalize denial reasons into structured categories (Step Therapy, Medical Necessity, Non-Formulary, Administrative, NDC Block, Quantity Limit, Age/Gender, Site-of-Care, DAW/Brand Mandate)
- Identify systemic denial patterns vs one-off administrative errors
- Map policy vs contract vs execution mismatch precisely
- Quantify financial impact in dollar ranges — never leave economic section vague
- GLP-1 denials: flag potential ERISA § 702 wellness discrimination if plan covers obesity-adjacent conditions
- Specialty drugs: always flag biosimilar substitution opportunity if applicable
- Step therapy: cite 29 C.F.R. § 2590.716 (CURES Act step therapy exception) when applicable
- Mental health parity: flag 29 C.F.R. § 2590.712 if behavioral health PA criteria differ from medical/surgical
- Always provide at least 3 prioritized decisions ranked by financial impact
- Appeal strategy must cite specific regulatory authority (ERISA § 503, 29 C.F.R. § 2560.503-1, ACA § 2719)"""

_HEADERS = {
    "User-Agent": "KincaidIQ/2.0 (compliance-intelligence; contact@kincaidrmc.com)",
    "Accept": "application/json",
}
_TIMEOUT = 15


# ─── 1. RxNorm Drug Lookup (NIH/NLM) ─────────────────────────────────────────

@router.get("/rxnorm")
async def rxnorm_lookup(drug: str):
    """
    NIH RxNorm — canonical drug name, RxCUI, generic equivalents, brand names, NDC codes.
    Completely free, no API key required.
    """
    if not drug or len(drug.strip()) < 2:
        raise HTTPException(status_code=400, detail="Drug name required (minimum 2 characters).")
    drug = drug.strip()

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r1, r_spell = await asyncio.gather(
                client.get("https://rxnav.nlm.nih.gov/REST/drugs.json", params={"name": drug}, headers=_HEADERS),
                client.get("https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json", params={"name": drug}, headers=_HEADERS),
            )

        drug_group = r1.json().get("drugGroup", {}) if r1.status_code == 200 else {}
        concept_groups = drug_group.get("conceptGroup", [])

        found_drugs, rxcui = [], None
        for cg in concept_groups:
            for cp in cg.get("conceptProperties", []):
                found_drugs.append({
                    "rxcui":   cp.get("rxcui", ""),
                    "name":    cp.get("name", ""),
                    "synonym": cp.get("synonym", ""),
                    "tty":     cp.get("tty", ""),
                })
                if not rxcui:
                    rxcui = cp.get("rxcui")

        spelling_suggestions = []
        if r_spell.status_code == 200:
            spelling_suggestions = r_spell.json().get("suggestionGroup", {}).get("suggestionList", {}).get("suggestion", [])[:5]

        if not rxcui:
            return {
                "found": False,
                "query": drug,
                "message": "No RxNorm match found.",
                "spelling_suggestions": spelling_suggestions,
            }

        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r_related, r_ndcs, r_history = await asyncio.gather(
                client.get(f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related.json",
                           params={"tty": "IN+BN+MIN+PIN"}, headers=_HEADERS),
                client.get(f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/ndcs.json", headers=_HEADERS),
                client.get(f"https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/historystatus.json", headers=_HEADERS),
            )

        generics, brands = [], []
        if r_related.status_code == 200:
            for cg in r_related.json().get("relatedGroup", {}).get("conceptGroup", []):
                tty = cg.get("tty", "")
                for cp in cg.get("conceptProperties", []):
                    n = cp.get("name", "")
                    if tty in ("IN", "MIN", "PIN"):
                        generics.append(n)
                    elif tty == "BN":
                        brands.append(n)

        ndcs = []
        if r_ndcs.status_code == 200:
            ndcs = r_ndcs.json().get("ndcGroup", {}).get("ndcList", {}).get("ndc", [])[:15]

        status_info = {}
        if r_history.status_code == 200:
            status_info = r_history.json().get("rxcuiStatusHistory", {}).get("status", {})

        return {
            "found": True,
            "query": drug,
            "rxcui": rxcui,
            "drugs": found_drugs[:10],
            "generics": sorted(set(generics))[:12],
            "brand_names": sorted(set(brands))[:12],
            "ndc_codes": ndcs,
            "rxcui_status": status_info,
            "biosimilar_note": "Check FDA Purple Book at purplebooksearch.fda.gov for licensed biosimilars.",
            "rxnav_url": f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}",
            "source": "NIH National Library of Medicine — RxNorm",
            "authority": "NLM RxNorm API (public domain, no key required)",
        }
    except Exception as e:
        logger.warning("[RxNorm] %s: %s", drug, e)
        raise HTTPException(status_code=502, detail=f"RxNorm API error: {e}")


# ─── 2. CMS Open Payments (Sunshine Act) ─────────────────────────────────────

@router.get("/open-payments")
async def open_payments_search(name: str, limit: int = 20):
    """
    CMS Open Payments — manufacturer payments to physicians/teaching hospitals (42 U.S.C. § 1320a-7h).
    Uses data.cms.gov SOCRATA API — no key required.
    """
    if not name or len(name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Entity name required.")
    name = name.strip()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://openpaymentsdata.cms.gov/resource/ezrc-l2wg.json",
                params={
                    "$where": f"upper(applicable_manufacturer_or_applicable_gpo_making_payment_name) LIKE upper('%{name}%')",
                    "$limit": min(limit, 50),
                    "$order": "total_amount_of_payment_usdollars DESC",
                },
                headers=_HEADERS,
            )

        if resp.status_code == 200:
            results = resp.json()
            if isinstance(results, list):
                records = []
                total_amount = 0.0
                natures: dict = {}
                for r in results:
                    amt = float(r.get("total_amount_of_payment_usdollars", 0) or 0)
                    total_amount += amt
                    nature = r.get("nature_of_payment_or_transfer_of_value", "")
                    natures[nature] = natures.get(nature, 0) + amt
                    records.append({
                        "manufacturer": r.get("applicable_manufacturer_or_applicable_gpo_making_payment_name", ""),
                        "recipient_name": f"{r.get('physician_first_name','')} {r.get('physician_last_name','')}".strip() or r.get("teaching_hospital_name", ""),
                        "recipient_type": r.get("recipient_type", ""),
                        "payment_nature": nature,
                        "amount_usd": amt,
                        "payment_date": r.get("date_of_payment", ""),
                        "drug_or_device": r.get("name_of_drug_or_biological_or_device_or_medical_supply_1", ""),
                        "related_product_indicator": r.get("related_product_indicator", ""),
                        "recipient_state": r.get("recipient_state", ""),
                        "physician_specialty": r.get("physician_specialty", ""),
                    })
                return {
                    "query": name,
                    "total_records": len(records),
                    "total_payment_amount_usd": round(total_amount, 2),
                    "payment_breakdown_by_nature": {k: round(v, 2) for k, v in sorted(natures.items(), key=lambda x: -x[1])},
                    "records": records,
                    "source": "CMS Open Payments — Sunshine Act",
                    "authority": "42 U.S.C. § 1320a-7h (Physician Payments Sunshine Act)",
                    "note": "Data is reported annually. Search openpaymentsdata.cms.gov for the most current data.",
                }

        return {
            "query": name,
            "total_records": 0,
            "total_payment_amount_usd": 0.0,
            "records": [],
            "source": "CMS Open Payments (Sunshine Act)",
            "note": "No payment records found for this entity, or API temporarily unavailable.",
        }
    except Exception as e:
        logger.warning("[OpenPayments] %s: %s", name, e)
        return {"query": name, "error": str(e), "total_records": 0, "records": []}


# ─── 3. Medicare Part D Drug Spending ─────────────────────────────────────────

@router.get("/drug-spending")
async def medicare_drug_spending(drug: str):
    """
    CMS Medicare Part D Drug Spending — annual unit cost, total spend, total claims per drug.
    Best free benchmark for plan formulary pricing vs Medicare rates.
    """
    if not drug or len(drug.strip()) < 2:
        raise HTTPException(status_code=400, detail="Drug name required.")
    drug = drug.strip()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://data.cms.gov/resource/4eev-bgf7.json",
                params={
                    "$where": f"upper(brnd_name) LIKE upper('%{drug}%') OR upper(gnrc_name) LIKE upper('%{drug}%')",
                    "$limit": 20,
                    "$order": "tot_spndng DESC",
                },
                headers=_HEADERS,
            )

        if resp.status_code == 200:
            results = resp.json()
            if isinstance(results, list):
                records = []
                for r in results[:15]:
                    records.append({
                        "brand_name": r.get("brnd_name", ""),
                        "generic_name": r.get("gnrc_name", ""),
                        "manufacturer": r.get("mftr_name", ""),
                        "year": r.get("year", ""),
                        "total_spending": float(r.get("tot_spndng", 0) or 0),
                        "total_claims": int(float(r.get("tot_clms", 0) or 0)),
                        "total_beneficiaries": int(float(r.get("tot_benes", 0) or 0)),
                        "avg_spend_per_claim": float(r.get("avg_spnd_per_clm", 0) or 0),
                        "avg_spend_per_beneficiary": float(r.get("avg_spnd_per_bene", 0) or 0),
                        "avg_annual_beneficiary_cost": float(r.get("avg_annual_bene_cost_shr", 0) or 0),
                    })
                return {
                    "query": drug,
                    "total_results": len(records),
                    "records": records,
                    "source": "CMS Medicare Part D Drug Spending",
                    "authority": "42 U.S.C. § 1395w-102 (Medicare Prescription Drug Benefit)",
                    "benchmarking_note": (
                        "Medicare Part D costs represent the government-negotiated benchmark. "
                        "Plan formulary costs significantly above these values warrant a PBM pricing audit."
                    ),
                }

        return {
            "query": drug,
            "total_results": 0,
            "records": [],
            "source": "CMS Medicare Part D Drug Spending",
            "note": "Drug not found in Part D database, or API temporarily unavailable.",
        }
    except Exception as e:
        logger.warning("[DrugSpending] %s: %s", drug, e)
        return {"query": drug, "error": str(e), "total_results": 0, "records": []}


# ─── 4. NPI Registry (NPPES) ─────────────────────────────────────────────────

@router.get("/npi")
async def npi_lookup(name: Optional[str] = None, npi: Optional[str] = None, state: Optional[str] = None):
    """
    CMS NPPES — National Provider Identifier lookup by name or NPI number.
    Verifies provider identity, specialty, and enrollment date. No key required.
    """
    if not name and not npi:
        raise HTTPException(status_code=400, detail="Organization name or NPI number required.")

    params: dict = {"version": "2.1", "limit": 10}
    if npi:
        params["number"] = npi.strip()
    else:
        params["organization_name"] = name.strip()
        if state:
            params["state"] = state.strip().upper()

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get("https://npiregistry.cms.hhs.gov/api/", params=params, headers=_HEADERS)

        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            total = data.get("result_count", len(results))
            records = []
            for r in results[:10]:
                basic = r.get("basic", {})
                addrs = r.get("addresses", [{}])
                addr = addrs[0] if addrs else {}
                taxes = r.get("taxonomies", [{}])
                tax = next((t for t in taxes if t.get("primary")), taxes[0] if taxes else {})
                org_name = basic.get("organization_name", "")
                if not org_name:
                    org_name = f"{basic.get('first_name','')} {basic.get('last_name','')}".strip()
                records.append({
                    "npi": r.get("number", ""),
                    "enumeration_type": r.get("enumeration_type", ""),
                    "organization_name": org_name,
                    "status": basic.get("status", ""),
                    "enumeration_date": basic.get("enumeration_date", ""),
                    "last_updated": basic.get("last_updated", ""),
                    "taxonomy_code": tax.get("code", ""),
                    "taxonomy_desc": tax.get("desc", ""),
                    "state": addr.get("state", ""),
                    "city": addr.get("city", ""),
                    "zip": (addr.get("postal_code", "") or "")[:5],
                })
            return {
                "query": name or npi,
                "total_results": total,
                "records": records,
                "source": "CMS NPPES — National Provider Identifier Registry",
                "authority": "42 U.S.C. § 1320d-2 (HIPAA Administrative Simplification)",
            }
        return {
            "query": name or npi,
            "total_results": 0,
            "records": [],
            "error": f"NPPES returned HTTP {resp.status_code}",
        }
    except Exception as e:
        logger.warning("[NPI] %s: %s", name or npi, e)
        return {"query": name or npi, "error": str(e), "total_results": 0, "records": []}


# ─── 5. PECOS Medicare Enrollment ────────────────────────────────────────────

@router.get("/pecos")
async def pecos_check(name: str):
    """
    CMS PECOS — Medicare Provider Enrollment status check.
    Identifies terminated enrollments which may signal exclusion or revocation risk.
    """
    if not name or len(name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Provider name required.")
    name = name.strip()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://data.cms.gov/resource/mj5m-pzi6.json",
                params={
                    "$where": f"upper(prvdr_org_name) LIKE upper('%{name}%')",
                    "$limit": 10,
                },
                headers=_HEADERS,
            )

        if resp.status_code == 200:
            results = resp.json()
            if isinstance(results, list):
                records = []
                for r in results[:10]:
                    records.append({
                        "provider_name": r.get("prvdr_org_name", ""),
                        "npi": r.get("npi", ""),
                        "provider_type": r.get("prvdr_ctgry_desc", ""),
                        "state": r.get("state_cd", ""),
                        "city": r.get("city_name", ""),
                        "zip": r.get("zip_cd", ""),
                        "certification_date": r.get("crtfctn_dt", ""),
                        "termination_date": r.get("trmntn_dt", ""),
                        "terminated": bool(r.get("trmntn_dt")),
                    })
                terminated = [r for r in records if r.get("terminated")]
                return {
                    "query": name,
                    "total_results": len(records),
                    "terminated_count": len(terminated),
                    "records": records,
                    "has_terminated_enrollments": bool(terminated),
                    "source": "CMS PECOS — Provider Enrollment, Chain and Ownership System",
                    "authority": "42 C.F.R. § 424.500 (Medicare Enrollment Requirements)",
                }

        return {
            "query": name,
            "total_results": 0,
            "records": [],
            "source": "CMS PECOS",
            "note": "No records found, or API temporarily unavailable.",
        }
    except Exception as e:
        logger.warning("[PECOS] %s: %s", name, e)
        return {"query": name, "error": str(e), "total_results": 0, "records": []}


# ─── 6. PBGC Pension Terminations ────────────────────────────────────────────

@router.get("/pbgc")
async def pbgc_check(name: str):
    """
    PBGC — Pension Benefit Guaranty Corporation terminated pension plan data.
    Identifies distressed and involuntarily terminated defined benefit plans.
    Critical for M&A due diligence on targets with legacy DB plans.
    """
    if not name or len(name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Company name required.")
    name = name.strip()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://data.pbgc.gov/resource/tqek-ygty.json",
                params={
                    "$where": f"upper(company_name) LIKE upper('%{name}%')",
                    "$limit": 10,
                },
                headers=_HEADERS,
            )

        if resp.status_code == 200:
            results = resp.json()
            if isinstance(results, list):
                records = []
                for r in results[:10]:
                    term_type = r.get("termination_type", r.get("type_of_termination", ""))
                    records.append({
                        "company_name": r.get("company_name", ""),
                        "plan_name": r.get("plan_name", ""),
                        "termination_date": r.get("termination_date", r.get("plan_year_ending_date", "")),
                        "termination_type": term_type,
                        "state": r.get("state", ""),
                        "participants": r.get("plan_year_participants", r.get("number_of_participants", "")),
                        "pbgc_trusteed": "involuntary" in str(term_type).lower() or "distress" in str(term_type).lower(),
                    })
                distressed = [r for r in records if r.get("pbgc_trusteed")]
                return {
                    "query": name,
                    "total_results": len(records),
                    "distressed_count": len(distressed),
                    "has_distressed_terminations": bool(distressed),
                    "records": records,
                    "source": "PBGC — Pension Benefit Guaranty Corporation",
                    "authority": "29 U.S.C. § 1342 (ERISA § 4042 — PBGC Plan Termination Authority)",
                    "erisa_note": (
                        "Involuntary or distress terminations create ERISA successor liability risk in M&A. "
                        "PBGC has priority claim status above unsecured creditors under 29 U.S.C. § 1368."
                    ),
                }

        return {
            "query": name,
            "total_results": 0,
            "records": [],
            "source": "PBGC",
            "note": "No terminated plans found, or API temporarily unavailable.",
        }
    except Exception as e:
        logger.warning("[PBGC] %s: %s", name, e)
        return {"query": name, "error": str(e), "total_results": 0, "records": []}


# ─── 7. PA IQ — Prior Authorization Intelligence ──────────────────────────────

class PAAnalyzeRequest(BaseModel):
    drug_name: str
    diagnosis: str
    denial_reason: Optional[str] = None
    pbm_name: Optional[str] = None
    plan_type: Optional[str] = None
    patient_age: Optional[str] = None
    plan_state: Optional[str] = None
    additional_context: Optional[str] = None
    annual_drug_cost: Optional[str] = None
    employees_affected: Optional[str] = None


@router.post("/pa-analyze")
async def pa_analyze(req: PAAnalyzeRequest):
    """
    PA IQ — AI-powered prior authorization intelligence using the Kincaid IQ fiduciary engine.
    Produces structured 6-section analysis: Problem Definition, Economic Impact, Root Cause,
    Intelligence Output, Prioritized Decisions, and Recommended Actions.
    """
    scenario_lines = [
        f"DRUG / THERAPY: {req.drug_name}",
        f"CLINICAL DIAGNOSIS (ICD-10 or description): {req.diagnosis}",
    ]
    if req.denial_reason:
        scenario_lines.append(f"DENIAL REASON / PA STATUS: {req.denial_reason}")
    if req.pbm_name:
        scenario_lines.append(f"PBM / CARRIER: {req.pbm_name}")
    if req.plan_type:
        scenario_lines.append(f"PLAN TYPE: {req.plan_type}")
    if req.patient_age:
        scenario_lines.append(f"PATIENT AGE / DEMOGRAPHICS: {req.patient_age}")
    if req.plan_state:
        scenario_lines.append(f"STATE / JURISDICTION: {req.plan_state}")
    if req.annual_drug_cost:
        scenario_lines.append(f"ANNUAL DRUG COST: {req.annual_drug_cost}")
    if req.employees_affected:
        scenario_lines.append(f"ESTIMATED MEMBERS AFFECTED: {req.employees_affected}")
    if req.additional_context:
        scenario_lines.append(f"ADDITIONAL CONTEXT: {req.additional_context}")

    user_message = (
        "PRIOR AUTHORIZATION SCENARIO FOR ANALYSIS:\n\n"
        + "\n".join(scenario_lines)
        + "\n\nGenerate the full fiduciary intelligence analysis. "
        + "Respond ONLY with the JSON structure — no preamble, no markdown fences, no explanation outside the JSON."
    )

    try:
        resp = await _anthropic.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            temperature=0.1,
            system=_PA_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = resp.content[0].text if resp.content else ""

        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        analysis = json.loads(raw)
        return {
            "status": "OK",
            "drug_name": req.drug_name,
            "diagnosis": req.diagnosis,
            "denial_reason": req.denial_reason,
            "pbm_name": req.pbm_name,
            "analysis": analysis,
            "model": "claude-sonnet-4-6",
            "authority": (
                "ERISA § 503 (29 U.S.C. § 1133), 29 C.F.R. § 2560.503-1, "
                "ACA § 2719 (42 U.S.C. § 300gg-19), 29 C.F.R. § 2590.716 (CURES Act)"
            ),
        }
    except json.JSONDecodeError as e:
        logger.warning("[PA-IQ] JSON parse error: %s | raw: %s", e, raw[:300])
        return {
            "status": "ERROR",
            "error": "AI response was not valid JSON. Please retry.",
            "raw_response": raw[:1000],
        }
    except Exception as e:
        logger.warning("[PA-IQ] %s", e)
        return {"status": "ERROR", "error": str(e)}
