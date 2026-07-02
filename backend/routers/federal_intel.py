"""
Federal Intelligence Layer — Kincaid IQ  v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8 federal databases, all free/public. Parallel async queries.

Sources
-------
1.  OIG LEIE          — HHS exclusions (42 U.S.C. § 1320a-7)
2.  SAM.gov           — Federal debarment/suspension (FAR 9.405) [SAM_GOV_API_KEY]
3.  CourtListener     — Federal court dockets / PACER (28 U.S.C. § 1746)
4.  DOL Enforcement   — WHD, OSHA, EBSA, MSHA actions (29 U.S.C. § 211)
5.  OpenSanctions     — OFAC SDN + 40 sanctions lists (50 U.S.C. § 1701)
6.  openFDA           — Drug recalls & enforcement actions (21 U.S.C. § 335)
7.  SEC EDGAR         — Litigation releases & enforcement (15 U.S.C. § 77q)
8.  FINRA BrokerCheck — Broker/adviser misconduct (15 U.S.C. § 78o)
"""
import os
import math
import logging
import asyncio
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/federal-intel", tags=["federal-intel"])
logger = logging.getLogger("kincaid.federal_intel")

SAM_KEY = os.getenv("SAM_GOV_API_KEY", "")

_HEADERS = {
    "User-Agent": "KincaidIQ/2.0 (compliance-intelligence; contact@kincaidrmc.com)",
    "Accept": "application/json",
}

_TIMEOUT_FAST = 12
_TIMEOUT_SLOW = 20


# ─── Risk scoring ─────────────────────────────────────────────────────────────

def _risk_score(sources: list) -> int:
    """0–100 composite risk score. FLAGGED=20pts, WATCH=8pts, +hit volume bonus."""
    flagged = sum(1 for s in sources if s.get("status") == "FLAGGED")
    watch   = sum(1 for s in sources if s.get("status") == "WATCH")
    hits    = sum(s.get("hits", 0) for s in sources)
    raw = flagged * 20 + watch * 8 + min(20, hits)
    return min(100, raw)


def _risk_signal(score: int) -> tuple[str, str]:
    if score >= 46:  return "HIGH",     "#ef4444"
    if score >= 25:  return "ELEVATED", "#f59e0b"
    if score >= 10:  return "WATCH",    "#3b82f6"
    return "CLEAR", "#22c55e"


# ─── Source 1: OIG LEIE ──────────────────────────────────────────────────────

async def _oig_search(name: str) -> dict:
    source = {
        "source": "OIG LEIE",
        "full_name": "HHS OIG — List of Excluded Individuals/Entities",
        "source_url": "https://exclusions.oig.hhs.gov",
        "authority": "42 U.S.C. § 1320a-7",
        "description": (
            "Federal exclusion from Medicare, Medicaid, and all federal healthcare programs. "
            "Contracting with an excluded entity exposes the plan sponsor to ERISA § 502(l) civil money penalties."
        ),
        "severity_weight": 20,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://exclusions.oig.hhs.gov/api/exclusions",
                params={"name": name, "page": 1, "size": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data if isinstance(data, list) else data.get("results", data.get("exclusions", []))
                records = [{
                    "entity_name": r.get("name", ""),
                    "npi": r.get("npi", ""),
                    "exclusion_type": r.get("exclusionType", ""),
                    "exclusion_date": r.get("exclusionDate", ""),
                    "reinstatement_date": r.get("reinstatementDate", ""),
                    "state": r.get("state", ""),
                    "specialty": r.get("specialty", ""),
                } for r in results[:8]]
                n = len(records)
                return {**source, "hits": n, "records": records, "status": "CLEAR" if n == 0 else "FLAGGED"}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[OIG] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 2: SAM.gov ───────────────────────────────────────────────────────

async def _sam_search(name: str) -> dict:
    source = {
        "source": "SAM.gov Exclusions",
        "full_name": "System for Award Management — Federal Exclusions",
        "source_url": "https://sam.gov/search/?index=ei",
        "authority": "FAR 9.405; EPAAR 1009.470",
        "description": (
            "Federal Acquisition Regulation mandatory exclusion — debarment, suspension, "
            "and proposed debarment determinations for federal contractors and grant recipients."
        ),
        "severity_weight": 20,
    }
    if not SAM_KEY:
        return {**source, "hits": 0, "records": [], "status": "NO_KEY",
                "error": "Add free SAM_GOV_API_KEY (register at api.data.gov) to enable."}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://api.sam.gov/exclusions/v1/api",
                params={"api_key": SAM_KEY, "q": name, "limit": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("exclusionDetails", data.get("results", data.get("data", [])))
                records = [{
                    "entity_name": r.get("entityName", r.get("name", "")),
                    "cage_code": r.get("cageCode", ""),
                    "sam_id": r.get("uniqueEntityId", ""),
                    "exclusion_type": r.get("exclusionType", ""),
                    "exclusion_program": r.get("exclusionProgram", ""),
                    "active_date": r.get("activationDate", ""),
                    "termination_date": r.get("terminationDate", ""),
                    "agency": r.get("agencyName", ""),
                    "state": r.get("state", ""),
                } for r in results[:8]]
                n = len(records)
                return {**source, "hits": n, "records": records, "status": "CLEAR" if n == 0 else "FLAGGED"}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[SAM] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 3: CourtListener / PACER ─────────────────────────────────────────

async def _courtlistener_search(name: str) -> dict:
    source = {
        "source": "CourtListener / PACER",
        "full_name": "Federal Court Dockets — PACER Aggregator",
        "source_url": "https://www.courtlistener.com",
        "authority": "28 U.S.C. § 1746",
        "description": (
            "Federal civil, criminal, and bankruptcy court dockets sourced from PACER. "
            "Covers U.S. District Courts, Courts of Appeals, and Bankruptcy Courts nationwide."
        ),
        "severity_weight": 15,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SLOW) as client:
            resp = await client.get(
                "https://www.courtlistener.com/api/rest/v3/dockets/",
                params={"q": name, "order_by": "-date_filed", "type": "b", "page_size": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                total = data.get("count", len(results))
                records = [{
                    "case_name": r.get("case_name", ""),
                    "docket_number": r.get("docket_number", ""),
                    "court": r.get("court", ""),
                    "date_filed": r.get("date_filed", ""),
                    "date_terminated": r.get("date_terminated", ""),
                    "cause": r.get("cause", ""),
                    "nature_of_suit": r.get("nature_of_suit", ""),
                    "url": f"https://www.courtlistener.com{r.get('absolute_url', '')}",
                } for r in results[:8]]
                status = "FLAGGED" if total > 20 else "WATCH" if total > 0 else "CLEAR"
                return {**source, "hits": total, "records": records, "status": status}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[CourtListener] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 4: DOL Enforcement ───────────────────────────────────────────────

async def _dol_search(name: str) -> dict:
    source = {
        "source": "DOL Enforcement",
        "full_name": "Department of Labor — Enforcement Actions",
        "source_url": "https://enforcements.dol.gov",
        "authority": "29 U.S.C. § 211 (FLSA); 29 U.S.C. § 657 (OSH Act); ERISA § 502(a)",
        "description": (
            "DOL WHD wage-and-hour violations, OSHA citations and penalties, "
            "EBSA prohibited transaction findings, and MSHA safety enforcement actions."
        ),
        "severity_weight": 15,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://enforcements.dol.gov/api/search",
                params={"q": name, "size": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                raw = data.get("results", data.get("hits", {}).get("hits", []))
                records = []
                for item in raw[:8]:
                    r = item.get("_source", item)
                    records.append({
                        "agency": r.get("agency", ""),
                        "trade_name": r.get("trade_name", r.get("employer_name", "")),
                        "violation_type": r.get("violation_type", r.get("case_type", "")),
                        "penalty_amount": r.get("penalty_amount", r.get("civil_money_penalty", 0)),
                        "case_date": r.get("date_concluded", r.get("case_date", "")),
                        "state": r.get("state", ""),
                    })
                n = len(records)
                return {**source, "hits": n, "records": records, "status": "CLEAR" if n == 0 else "FLAGGED"}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[DOL] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 5: OpenSanctions (OFAC SDN + 40+ sanctions lists) ────────────────

async def _sanctions_search(name: str) -> dict:
    source = {
        "source": "OFAC Sanctions / OpenSanctions",
        "full_name": "OFAC SDN + 40 Global Sanctions Lists — OpenSanctions Aggregator",
        "source_url": "https://www.opensanctions.org",
        "authority": "50 U.S.C. § 1701 (IEEPA); 31 C.F.R. § 501 (OFAC)",
        "description": (
            "Treasury OFAC Specially Designated Nationals (SDN), EU sanctions, UN consolidated list, "
            "and 40+ additional sanctions regimes. Contracting with an SDN entity carries criminal penalties "
            "up to $1M and 20 years imprisonment under 50 U.S.C. § 1705."
        ),
        "severity_weight": 25,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://api.opensanctions.org/search/default",
                params={"q": name, "schema": "Company", "limit": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                records = []
                for r in results[:8]:
                    props = r.get("properties", {})
                    datasets = r.get("datasets", [])
                    records.append({
                        "entity_name": r.get("caption", ""),
                        "datasets": ", ".join(datasets[:4]),
                        "countries": ", ".join(props.get("country", [])[:3]),
                        "topics": ", ".join(r.get("topics", [])[:4]),
                        "sanctioned_since": props.get("createdAt", [""])[0][:10] if props.get("createdAt") else "",
                        "score": round(r.get("score", 0), 2),
                    })
                n = len(records)
                # Only flag high-confidence matches (score > 0.7)
                high_conf = [r for r in records if r.get("score", 0) > 0.7]
                status = "FLAGGED" if high_conf else ("WATCH" if records else "CLEAR")
                return {**source, "hits": n, "records": records, "status": status}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[Sanctions] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 6: openFDA Drug Enforcement ──────────────────────────────────────

async def _fda_search(name: str) -> dict:
    source = {
        "source": "FDA Drug Enforcement",
        "full_name": "FDA — Drug Recall & Enforcement Actions (openFDA)",
        "source_url": "https://open.fda.gov/apis/drug/enforcement/",
        "authority": "21 U.S.C. § 335 (FD&C Act); 21 U.S.C. § 399d",
        "description": (
            "FDA drug recall and enforcement actions. Class I recalls indicate a reasonable probability "
            "of serious adverse health consequences. Relevant for PBM contract vetting and formulary risk under "
            "ERISA § 404(a)(1)(B) prudent expert standard."
        ),
        "severity_weight": 12,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://api.fda.gov/drug/enforcement.json",
                params={"search": f'recalling_firm:"{name}"', "limit": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                records = [{
                    "recalling_firm": r.get("recalling_firm", ""),
                    "product_description": r.get("product_description", "")[:120],
                    "recall_class": r.get("classification", ""),
                    "reason": r.get("reason_for_recall", "")[:100],
                    "recall_date": r.get("recall_initiation_date", ""),
                    "status": r.get("status", ""),
                    "state": r.get("state", ""),
                } for r in results[:8]]
                n = len(records)
                class1 = [r for r in records if "Class I" in r.get("recall_class", "")]
                status = "FLAGGED" if class1 else ("WATCH" if records else "CLEAR")
                return {**source, "hits": n, "records": records, "status": status}
            elif resp.status_code == 404:
                return {**source, "hits": 0, "records": [], "status": "CLEAR"}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[FDA] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 7: SEC EDGAR Litigation Releases ─────────────────────────────────

async def _sec_search(name: str) -> dict:
    source = {
        "source": "SEC Enforcement / EDGAR",
        "full_name": "SEC — Litigation Releases & Enforcement Actions (EDGAR)",
        "source_url": "https://efts.sec.gov/LATEST/search-index",
        "authority": "15 U.S.C. § 77q (Securities Act § 17); 15 U.S.C. § 78j (Exchange Act § 10(b))",
        "description": (
            "SEC litigation releases, administrative proceedings, and enforcement orders from EDGAR. "
            "Covers securities fraud, accounting violations, insider trading, and investment adviser misconduct "
            "relevant to ERISA § 408(b)(2) covered service provider vetting."
        ),
        "severity_weight": 18,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SLOW) as client:
            resp = await client.get(
                "https://efts.sec.gov/LATEST/search-index",
                params={
                    "q": f'"{name}"',
                    "forms": "LR,34-1",
                    "dateRange": "custom",
                    "startdt": "2018-01-01",
                },
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                hits_data = data.get("hits", {})
                total = hits_data.get("total", {}).get("value", 0) if isinstance(hits_data.get("total"), dict) else 0
                results = hits_data.get("hits", [])
                records = []
                for r in results[:8]:
                    src = r.get("_source", {})
                    records.append({
                        "entity_name": src.get("display_names", [""])[0] if src.get("display_names") else "",
                        "form_type": src.get("form_type", ""),
                        "filed_at": src.get("file_date", ""),
                        "description": src.get("period_of_report", ""),
                        "url": f"https://www.sec.gov/Archives/edgar/data/{src.get('entity_id', '')}/",
                    })
                status = "FLAGGED" if total > 5 else ("WATCH" if total > 0 else "CLEAR")
                return {**source, "hits": total, "records": records, "status": status}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[SEC] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 8: FINRA BrokerCheck ─────────────────────────────────────────────

async def _finra_search(name: str) -> dict:
    source = {
        "source": "FINRA BrokerCheck",
        "full_name": "FINRA — BrokerCheck Firm & Adviser Database",
        "source_url": "https://brokercheck.finra.org",
        "authority": "15 U.S.C. § 78o; FINRA Rule 8312",
        "description": (
            "FINRA registration status, broker misconduct, and disciplinary history. "
            "Relevant when vetting registered investment advisers, broker-dealers, and TPAs "
            "serving as ERISA § 3(38) fiduciaries or § 408(b)(2) covered service providers."
        ),
        "severity_weight": 15,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://api.brokercheck.finra.org/search/firm",
                params={
                    "query": name,
                    "hl": "true",
                    "includePrevious": "true",
                    "nrows": "10",
                    "start": "0",
                    "wt": "json",
                },
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                hits_data = data.get("hits", {})
                results = hits_data.get("hits", [])
                total = hits_data.get("total", len(results))
                records = []
                for r in results[:8]:
                    src = r.get("_source", {})
                    basic = src.get("bc_scope", src)
                    records.append({
                        "firm_name": src.get("bc_firm_name", basic.get("firm_name", "")),
                        "crd_number": src.get("bc_firm_crd_number", ""),
                        "firm_status": src.get("bc_firm_registration_status", ""),
                        "disclosure_count": src.get("bc_disclosure_flag", ""),
                        "state": src.get("bc_firm_state_registration", ""),
                    })
                has_disclosures = any(r.get("disclosure_count") == "Y" for r in records)
                status = "FLAGGED" if has_disclosures else ("WATCH" if records else "CLEAR")
                return {**source, "hits": total, "records": records, "status": status}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[FINRA] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 9: USASpending.gov ────────────────────────────────────────────────

async def _usaspending_search(name: str) -> dict:
    source = {
        "source": "USASpending.gov",
        "full_name": "USASpending.gov — Federal Contract & Grant Award History",
        "source_url": "https://www.usaspending.gov",
        "authority": "31 U.S.C. § 6101 (Federal Funding Accountability and Transparency Act)",
        "description": (
            "Complete federal spending database covering all contract awards, grants, loans, and other assistance. "
            "Terminated-for-default contracts signal serious performance or compliance failures and are material "
            "for ERISA § 408(b)(2) covered service provider due diligence."
        ),
        "severity_weight": 10,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SLOW) as client:
            payload = {
                "filters": {
                    "recipient_search_text": [name],
                    "award_type_codes": ["A", "B", "C", "D"],
                },
                "fields": ["Award ID", "Recipient Name", "Award Amount", "Start Date", "End Date", "Awarding Agency", "Award Type"],
                "page": 1,
                "limit": 10,
                "sort": "Award Amount",
                "order": "desc",
            }
            resp = await client.post(
                "https://api.usaspending.gov/api/v2/search/spending_by_award/",
                json=payload,
                headers={**_HEADERS, "Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                total = data.get("page_metadata", {}).get("total", len(results))
                records = [{
                    "award_id":   r.get("Award ID", ""),
                    "recipient":  r.get("Recipient Name", ""),
                    "amount":     float(r.get("Award Amount", 0) or 0),
                    "start_date": r.get("Start Date", ""),
                    "end_date":   r.get("End Date", ""),
                    "agency":     r.get("Awarding Agency", ""),
                    "award_type": r.get("Award Type", ""),
                } for r in results[:8]]
                status = "WATCH" if records else "CLEAR"
                return {**source, "hits": total, "records": records, "status": status}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[USASpending] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Source 10: NPI Registry (NPPES) ──────────────────────────────────────────

async def _npi_search(name: str) -> dict:
    source = {
        "source": "NPI Registry (NPPES)",
        "full_name": "CMS — National Provider Identifier Registry",
        "source_url": "https://npiregistry.cms.hhs.gov",
        "authority": "42 U.S.C. § 1320d-2 (HIPAA Administrative Simplification)",
        "description": (
            "National Provider Identifier (NPI) registry for all healthcare providers and organizations. "
            "Confirms whether an entity is a registered healthcare provider and verifies their taxonomy "
            "(specialty). Used to cross-reference against OIG LEIE exclusion records and PECOS enrollment status."
        ),
        "severity_weight": 6,
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_FAST) as client:
            resp = await client.get(
                "https://npiregistry.cms.hhs.gov/api/",
                params={"organization_name": name, "version": "2.1", "limit": 10},
                headers=_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                total = data.get("result_count", len(results))
                records = []
                for r in results[:8]:
                    basic = r.get("basic", {})
                    addr = (r.get("addresses", [{}]) or [{}])[0]
                    tax = next((t for t in r.get("taxonomies", []) if t.get("primary")),
                               (r.get("taxonomies", [{}]) or [{}])[0])
                    records.append({
                        "npi":          r.get("number", ""),
                        "name":         basic.get("organization_name", ""),
                        "status":       basic.get("status", ""),
                        "taxonomy":     tax.get("desc", ""),
                        "state":        addr.get("state", ""),
                        "city":         addr.get("city", ""),
                        "enum_date":    basic.get("enumeration_date", ""),
                    })
                active = [r for r in records if r.get("status", "").upper() == "A"]
                status = "WATCH" if active else "CLEAR"
                return {**source, "hits": total, "records": records, "status": status}
            return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[NPI] %s: %s", name, e)
        return {**source, "hits": 0, "records": [], "status": "UNAVAILABLE", "error": str(e)}


# ─── Aggregate scan endpoint ──────────────────────────────────────────────────

@router.get("/scan")
async def federal_scan(name: str, ein: Optional[str] = None):
    """
    Parallel scan across all 10 federal databases.
    Returns aggregate risk_score (0–100), risk_signal, and per-source results.
    """
    name = (name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Company name required (minimum 2 characters).")

    results = await asyncio.gather(
        _oig_search(name),
        _sam_search(name),
        _courtlistener_search(name),
        _dol_search(name),
        _sanctions_search(name),
        _fda_search(name),
        _sec_search(name),
        _finra_search(name),
        _usaspending_search(name),
        _npi_search(name),
    )

    sources = list(results)
    score = _risk_score(sources)
    risk_signal, risk_color = _risk_signal(score)

    flagged = sum(1 for s in sources if s.get("status") == "FLAGGED")
    watch   = sum(1 for s in sources if s.get("status") == "WATCH")
    clear   = sum(1 for s in sources if s.get("status") == "CLEAR")
    unavail = sum(1 for s in sources if s.get("status") in ("UNAVAILABLE", "NO_KEY"))
    total_hits = sum(s.get("hits", 0) for s in sources)

    return {
        "company": name,
        "ein": ein,
        "risk_score": score,
        "risk_signal": risk_signal,
        "risk_color": risk_color,
        "total_hits": total_hits,
        "sources_flagged": flagged,
        "sources_watch": watch,
        "sources_clear": clear,
        "sources_unavailable": unavail,
        "sources": sources,
        "scanned_at": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()),
        "legal_note": (
            "Federal database results are provided for informational purposes only under 5 U.S.C. § 552 "
            "(Freedom of Information Act) and applicable federal open-data mandates. Results do not constitute "
            "legal advice. Kincaid RMC disclaims all liability for reliance on automated federal database queries "
            "without independent verification by qualified legal counsel. OFAC screening results must be "
            "independently verified before any compliance determination is made."
        ),
    }


@router.get("/sources")
async def list_sources():
    """Metadata for all 10 configured federal intelligence sources."""
    return {
        "sources": [
            {"id": "oig",          "name": "OIG LEIE",                  "requires_key": False, "enabled": True,          "authority": "42 U.S.C. § 1320a-7"},
            {"id": "sam",          "name": "SAM.gov Exclusions",        "requires_key": True,  "enabled": bool(SAM_KEY), "authority": "FAR 9.405",            "key_source": "api.data.gov (free)"},
            {"id": "courts",       "name": "CourtListener / PACER",     "requires_key": False, "enabled": True,          "authority": "28 U.S.C. § 1746"},
            {"id": "dol",          "name": "DOL Enforcement",           "requires_key": False, "enabled": True,          "authority": "29 U.S.C. § 211"},
            {"id": "sanctions",    "name": "OFAC Sanctions",            "requires_key": False, "enabled": True,          "authority": "50 U.S.C. § 1701"},
            {"id": "fda",          "name": "FDA Drug Enforcement",      "requires_key": False, "enabled": True,          "authority": "21 U.S.C. § 335"},
            {"id": "sec",          "name": "SEC Enforcement / EDGAR",   "requires_key": False, "enabled": True,          "authority": "15 U.S.C. § 77q"},
            {"id": "finra",        "name": "FINRA BrokerCheck",         "requires_key": False, "enabled": True,          "authority": "15 U.S.C. § 78o"},
            {"id": "usaspending",  "name": "USASpending.gov",           "requires_key": False, "enabled": True,          "authority": "31 U.S.C. § 6101"},
            {"id": "npi",          "name": "NPI Registry (NPPES)",      "requires_key": False, "enabled": True,          "authority": "42 U.S.C. § 1320d-2"},
        ]
    }
