"""
Public Data Intelligence Feeds — Router
Proxies 8 government/public APIs:
  1. SEC EDGAR (filings search + company submissions)
  2. NADAC (drug acquisition costs, Medicaid)
  3. CMS Data API (Part D, provider datasets)
  4. CMS AB2D (bulk claims — enterprise plan sponsors)
  5. CMS PBM Spread (policy + reporting reference)
  6. USAspending (federal procurement transactions)
  7. SAM.gov (contract opportunities)
  8. GSA CALC+ (services labor rate benchmarks)
"""

import os
import httpx
import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/feeds", tags=["feeds"])

TIMEOUT = 12.0
SAM_API_KEY = os.environ.get("SAM_API_KEY", "")


BASE_HEADERS = {
    "User-Agent": "Kincaid Health research@kincaidrmc.com",
    "Accept": "application/json",
}


async def _get(url: str, params: dict | None = None, headers: dict | None = None) -> dict:
    try:
        merged = {**BASE_HEADERS, **(headers or {})}
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            r = await client.get(url, params=params, headers=merged)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {str(e)}")


# ─── 1. SEC EDGAR ─────────────────────────────────────────────────────────────

@router.get("/sec/search")
async def sec_search(
    q: str = Query(..., description="Full-text search query (company name or keyword)"),
    forms: str = Query("10-K,10-Q", description="Comma-separated form types"),
    limit: int = Query(10, le=40),
):
    """Search SEC EDGAR full-text for filings."""
    try:
        data = await _get(
            "https://efts.sec.gov/LATEST/search-index",
            params={"q": q, "forms": forms},
        )
        hits = data.get("hits", {}).get("hits", [])
        results = []
        for h in hits[:limit]:
            s = h.get("_source", {})
            results.append({
                "company": s.get("entity_name", ""),
                "form": s.get("file_type", ""),
                "filed": s.get("file_date", ""),
                "cik": s.get("entity_id", ""),
                "edgar_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={s.get('entity_id','')}&type={s.get('file_type','')}&dateb=&owner=include&count=10",
                "description": s.get("period_of_report", ""),
            })
        return {"query": q, "forms": forms, "count": len(results), "results": results}
    except Exception:
        pass
    # Fallback: SEC EDGAR company search
    try:
        data = await _get(
            "https://efts.sec.gov/LATEST/search-index",
            params={"q": f'"{q}"', "dateRange": "custom", "startdt": "2023-01-01"},
        )
        hits = data.get("hits", {}).get("hits", [])
        results = []
        for h in hits[:limit]:
            s = h.get("_source", {})
            results.append({
                "company": s.get("entity_name", ""),
                "form": s.get("file_type", ""),
                "filed": s.get("file_date", ""),
                "cik": s.get("entity_id", ""),
                "edgar_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={s.get('entity_id','')}&type={s.get('file_type','')}&dateb=&owner=include&count=10",
                "description": s.get("period_of_report", ""),
            })
        return {"query": q, "forms": forms, "count": len(results), "results": results}
    except Exception as e:
        return {
            "query": q, "forms": forms, "count": 0, "results": [],
            "note": f"SEC EDGAR API temporarily unavailable. Search directly at efts.sec.gov. Error: {str(e)[:100]}",
            "reference": f"https://efts.sec.gov/LATEST/search-index#q=%22{q}%22&dateRange=custom&startdt=2023-01-01",
        }


@router.get("/sec/filings/{ticker}")
async def sec_filings(ticker: str, limit: int = Query(10, le=40)):
    """Get recent filings for a company by ticker symbol."""
    search = await _get(
        "https://efts.sec.gov/LATEST/search-index",
        params={"q": ticker, "forms": "10-K,10-Q,8-K", "dateRange": "custom", "startdt": "2022-01-01"},
    )
    hits = search.get("hits", {}).get("hits", [])
    results = []
    for h in hits[:limit]:
        s = h.get("_source", {})
        results.append({
            "company": s.get("entity_name", ""),
            "form": s.get("file_type", ""),
            "filed": s.get("file_date", ""),
            "period": s.get("period_of_report", ""),
            "cik": s.get("entity_id", ""),
            "edgar_url": f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={s.get('entity_id','')}&type={s.get('file_type','')}&dateb=&owner=include&count=10",
        })
    return {"ticker": ticker.upper(), "count": len(results), "filings": results}


# ─── 2. NADAC Drug Pricing ────────────────────────────────────────────────────

def _recent_nadac_urls() -> list[str]:
    """Generate download URLs for the last 8 Wednesdays."""
    from datetime import date, timedelta
    today = date.today()
    # Rewind to most recent Wednesday (weekday 2)
    days_back = (today.weekday() - 2) % 7
    wednesday = today - timedelta(days=days_back)
    urls = []
    for i in range(8):
        d = wednesday - timedelta(weeks=i)
        fname = f"nadac-comparison-{d.month:02d}-{d.day:02d}-{d.year}.csv"
        urls.append(f"https://download.medicaid.gov/data/{fname}")
    return urls


@router.get("/nadac/search")
async def nadac_search(
    drug: str = Query(..., description="Drug name (partial match)"),
    limit: int = Query(20, le=100),
):
    """Search NADAC (National Average Drug Acquisition Cost) for drug pricing benchmarks.
    Downloads the latest weekly comparison CSV from download.medicaid.gov."""
    import csv, io
    keyword = drug.upper()
    csv_text: str | None = None

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for url in _recent_nadac_urls():
            try:
                r = await client.get(url, headers=BASE_HEADERS)
                if r.status_code == 200:
                    csv_text = r.text
                    break
            except Exception:
                continue

    if not csv_text:
        return {
            "drug": drug, "count": 0, "results": [],
            "note": "NADAC weekly file not yet available. CMS publishes every Wednesday. Please try again later.",
            "reference": "https://data.medicaid.gov/datasets?theme=Drug%20Pricing%20and%20Payment",
        }

    reader = csv.DictReader(io.StringIO(csv_text))
    results = []
    for row in reader:
        desc = row.get("NDC Description", "").upper()
        if keyword in desc:
            old_price = row.get("Old NADAC Per Unit", row.get("NADAC Per Unit", ""))
            new_price = row.get("New NADAC Per Unit", old_price)
            results.append({
                "ndc": row.get("NDC", ""),
                "drug": row.get("NDC Description", ""),
                "old_nadac_per_unit": old_price,
                "new_nadac_per_unit": new_price,
                "percent_change": row.get("Percent Change", ""),
                "primary_reason": row.get("Primary Reason", ""),
                "effective_date": row.get("Effective Date", ""),
                "start_date": row.get("Start Date", ""),
                "classification": row.get("Classification for Rate Setting", ""),
            })
            if len(results) >= limit:
                break

    return {"drug": drug, "count": len(results), "results": results}


# ─── 3. CMS Data API ─────────────────────────────────────────────────────────

@router.get("/cms/datasets")
async def cms_datasets(
    keyword: str = Query("", description="Filter datasets by keyword"),
    limit: int = Query(12, le=50),
):
    """Browse CMS open datasets via the data.cms.gov data catalog (data.json)."""
    try:
        data = await _get("https://data.cms.gov/data.json")
        all_datasets: list = data.get("dataset", [])
    except Exception as e:
        return {
            "keyword": keyword, "count": 0, "datasets": [],
            "note": f"CMS catalog unavailable. Error: {str(e)[:100]}",
            "reference": "https://data.cms.gov",
        }

    kw_lower = keyword.lower()
    results = []
    for ds in all_datasets:
        title = ds.get("title", "")
        desc = ds.get("description", "") or ""
        if kw_lower and kw_lower not in title.lower() and kw_lower not in desc.lower():
            continue
        # Prefer downloadable distribution URL
        dist_url = ""
        for dist in (ds.get("distribution") or []):
            if isinstance(dist, dict) and dist.get("downloadURL"):
                dist_url = dist["downloadURL"]
                break
        results.append({
            "title": title,
            "identifier": ds.get("identifier", ""),
            "description": desc[:200],
            "modified": ds.get("modified", ""),
            "theme": [t.get("prefLabel", t) if isinstance(t, dict) else t for t in (ds.get("theme") or [])],
            "url": ds.get("landingPage", dist_url or f"https://data.cms.gov/search?q={title[:40]}"),
        })
        if len(results) >= limit:
            break

    return {"keyword": keyword, "total_available": len(all_datasets), "count": len(results), "datasets": results}


@router.get("/cms/partd")
async def cms_partd(limit: int = Query(20, le=100)):
    """Get Medicare Part D spending data."""
    try:
        data = await _get(
            "https://data.cms.gov/data-api/v1/dataset/9552e9d4-9fa7-46a5-9e14-b87bf336a093/data",
            params={"size": limit, "offset": 0},
        )
        records = data if isinstance(data, list) else data.get("data", [])
        return {"count": len(records), "records": records[:limit]}
    except Exception:
        return {"count": 0, "records": [], "note": "Part D dataset unavailable — try CMS datasets browser"}


# ─── 4. CMS AB2D (Enterprise Plan Sponsors) ───────────────────────────────────

@router.get("/cms/ab2d/info")
async def cms_ab2d_info():
    """Return information about the CMS AB2D bulk claims API."""
    return {
        "name": "CMS AB2D API",
        "description": "Bulk Medicare Part A and B claims data for eligible plan sponsors (PDPs, MA-PDs). Enables enterprise-level utilization analytics.",
        "eligibility": "Medicare Prescription Drug Plan (PDP) or Medicare Advantage-Prescription Drug (MA-PD) sponsors only.",
        "auth": "OAuth 2.0 — credentials issued by CMS after sponsor agreement",
        "endpoints": {
            "sandbox": "https://sandbox.ab2d.cms.gov/api/v2/fhir/Patient/$export",
            "production": "https://api.ab2d.cms.gov/api/v2/fhir/Patient/$export",
        },
        "data_format": "NDJSON / FHIR R4",
        "documentation": "https://ab2d.cms.gov",
        "use_cases": [
            "Utilization analytics for plan sponsors",
            "Drug spend benchmarking",
            "Member-level claims analysis",
            "Cost-of-care reporting",
        ],
    }


# ─── 5. CMS PBM Spread / Rebate Reporting ─────────────────────────────────────

@router.get("/cms/pbm/policy")
async def cms_pbm_policy():
    """Return CMS PBM spread and rebate reporting policy reference."""
    return {
        "name": "CMS PBM Pricing & Spread Reporting",
        "regulatory_basis": "42 CFR Part 423 — Medicare Prescription Drug Benefit",
        "reporting_requirements": [
            {
                "item": "Spread Pricing",
                "definition": "Difference between amount PBM charges the plan and amount PBM pays the pharmacy",
                "cms_requirement": "PDPs must report spread amounts to CMS annually via DIR reporting",
            },
            {
                "item": "Direct and Indirect Remuneration (DIR)",
                "definition": "Post-point-of-sale price concessions including rebates, fees, and price protection",
                "cms_requirement": "Must be reported on PDE records and reconciled annually",
            },
            {
                "item": "Rebate Pass-Through",
                "definition": "Portion of manufacturer rebates passed from PBM to plan sponsor",
                "cms_requirement": "Plans must report aggregate rebates; 2024 rule requires point-of-sale rebates for low-income subsidy",
            },
            {
                "item": "Network Pharmacy Rates",
                "definition": "Contracted reimbursement rates paid by PBM to network pharmacies",
                "cms_requirement": "Included in DIR; subject to audit under Part D program",
            },
        ],
        "key_rules": [
            "IRA 2022: Inflation rebates required for drugs exceeding CPI-U",
            "2024 DIR Rule: Retroactive DIR fees eliminated; move to point-of-sale discounts",
            "NADAC benchmarking: CMS uses NADAC as pharmacy acquisition cost reference",
        ],
        "references": [
            {"title": "CMS DIR Guidance", "url": "https://www.cms.gov/medicare/prescription-drug-coverage/prescriptiondrugcovcontra/dir"},
            {"title": "Part D Reporting Requirements", "url": "https://www.cms.gov/medicare/prescription-drug-coverage/prescriptiondrugcovgenin"},
        ],
    }


# ─── 6. USAspending ──────────────────────────────────────────────────────────

@router.get("/usaspending/search")
async def usaspending_search(
    keyword: str = Query(..., description="Keyword to search federal spending"),
    limit: int = Query(10, le=25),
):
    """Search federal spending transactions via USAspending.gov."""
    payload = {
        "filters": {
            "keywords": [keyword],
            "time_period": [{"start_date": "2023-01-01", "end_date": "2025-12-31"}],
            "award_type_codes": ["A", "B", "C", "D"],
        },
        "fields": [
            "Award ID", "Recipient Name", "Award Amount",
            "Awarding Agency", "Award Type", "Start Date", "Description",
        ],
        "page": 1,
        "limit": limit,
        "sort": "Award Amount",
        "order": "desc",
        "subawards": False,
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                "https://api.usaspending.gov/api/v2/search/spending_by_award/",
                json=payload,
                headers={"Content-Type": "application/json", "User-Agent": "Kincaid Health research@kincaidrmc.com"},
            )
            r.raise_for_status()
            data = r.json()
        results = data.get("results", [])
        return {
            "keyword": keyword,
            "total": data.get("page_metadata", {}).get("total", 0),
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        return {
            "keyword": keyword, "total": 0, "count": 0, "results": [],
            "note": f"USAspending API unavailable. Browse at usaspending.gov. Error: {str(e)[:120]}",
            "reference": f"https://www.usaspending.gov/search/?query={keyword}",
        }


@router.get("/usaspending/agency/{agency_code}")
async def usaspending_agency(agency_code: str, fiscal_year: int = 2024):
    """Get spending overview for a federal agency."""
    data = await _get(
        f"https://api.usaspending.gov/api/v2/agency/{agency_code}/",
        params={"fiscal_year": fiscal_year},
    )
    return data


# ─── 7. SAM.gov Contract Opportunities ────────────────────────────────────────

@router.get("/sam/opportunities")
async def sam_opportunities(
    keyword: str = Query(..., description="Search keyword for contract opportunities"),
    limit: int = Query(10, le=25),
):
    """Search SAM.gov for federal contract opportunities."""
    if not SAM_API_KEY:
        return {
            "keyword": keyword,
            "count": 0,
            "results": [],
            "note": "SAM_API_KEY environment variable not set. Register at api.sam.gov to get a free key.",
            "register_url": "https://open.gsa.gov/api/opportunities-api/",
        }
    data = await _get(
        "https://api.sam.gov/opportunities/v2/search",
        params={
            "api_key": SAM_API_KEY,
            "keywords": keyword,
            "limit": limit,
            "postedFrom": "01/01/2024",
            "postedTo": "12/31/2025",
        },
    )
    opps = data.get("opportunitiesData", [])
    results = []
    for o in opps:
        results.append({
            "title": o.get("title", ""),
            "solicitation_number": o.get("solicitationNumber", ""),
            "naics": o.get("naicsCode", ""),
            "agency": o.get("departmentName", ""),
            "office": o.get("subtierName", ""),
            "type": o.get("type", ""),
            "posted": o.get("postedDate", ""),
            "response_deadline": o.get("responseDeadLine", ""),
            "url": f"https://sam.gov/opp/{o.get('noticeId','')}/view",
        })
    return {
        "keyword": keyword,
        "total": data.get("totalRecords", 0),
        "count": len(results),
        "results": results,
    }


# ─── 8. GSA CALC+ Labor Rates ─────────────────────────────────────────────────

@router.get("/gsa/rates")
async def gsa_rates(
    q: str = Query(..., description="Occupation / labor category search"),
    min_experience: int = Query(0),
    max_experience: int = Query(30),
    education: str = Query("", description="Education level filter (e.g. Bachelors, Masters)"),
    limit: int = Query(20, le=100),
):
    """Get GSA CALC+ SIN 541 labor rate benchmarks."""
    params: dict = {
        "q": q,
        "min_experience": min_experience,
        "max_experience": max_experience,
        "limit": limit,
        "page": 1,
    }
    if education:
        params["education"] = education
    data = await _get("https://calc.gsa.gov/api/rates/", params=params)
    results = data.get("results", [])
    formatted = []
    for r in results:
        formatted.append({
            "labor_category": r.get("labor_category", ""),
            "price_year_1": r.get("price_year_1", ""),
            "education": r.get("education_level", ""),
            "min_years_experience": r.get("min_years_experience", ""),
            "max_years_experience": r.get("max_years_experience", ""),
            "schedule": r.get("schedule", ""),
            "sin": r.get("sin", ""),
            "vendor": r.get("vendor_name", ""),
        })
    return {
        "query": q,
        "education": education or "all",
        "experience": f"{min_experience}–{max_experience} years",
        "total": data.get("count", 0),
        "count": len(formatted),
        "results": formatted,
    }
