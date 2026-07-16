"""
Market Intelligence Layer — Kincaid Health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5 free public APIs for economic benchmarking and market intelligence.

1. FRED (Federal Reserve)    — Medical CPI, general CPI, unemployment, treasury yields
2. BLS (Bureau of Labor)     — Healthcare employment & wages by sector
3. Census Bureau ACS         — Geographic demographics & income (requires free key)
4. USASpending.gov           — Federal contract & grant history by company
5. SEC EDGAR XBRL            — Structured company financials (public companies, no key)
"""
import os
import logging
import asyncio
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/market-intel", tags=["market-intelligence"])
logger = logging.getLogger("kincaid.market_intel")

FRED_KEY   = os.getenv("FRED_API_KEY", "")
BLS_KEY    = os.getenv("BLS_API_KEY", "")
CENSUS_KEY = os.getenv("CENSUS_API_KEY", "")

_HEADERS = {
    "User-Agent": "KincaidIQ/2.0 (compliance-intelligence; contact@kincaidrmc.com)",
    "Accept": "application/json",
}
_TIMEOUT = 15

# ── FRED series of interest for benefits/healthcare intelligence ───────────────
FRED_SERIES = {
    "CPIMEDSL":  {"label": "Medical Care CPI",           "unit": "Index",   "note": "Core benchmark for plan cost trend assumptions"},
    "CPIHOSNS":  {"label": "Hospital & Related CPI",     "unit": "Index",   "note": "Hospital services price inflation"},
    "CPIUENS":   {"label": "Health Insurance CPI",       "unit": "Index",   "note": "Premium inflation benchmark"},
    "CPIAUCSL":  {"label": "All Items CPI",              "unit": "Index",   "note": "General inflation reference"},
    "UNRATE":    {"label": "Unemployment Rate",          "unit": "%",       "note": "Labor market conditions"},
    "DGS10":     {"label": "10-Year Treasury Yield",     "unit": "%",       "note": "Discount rate for actuarial assumptions"},
    "DGS30":     {"label": "30-Year Treasury Yield",     "unit": "%",       "note": "Long-duration pension liability discount rate"},
    "PCE":       {"label": "Personal Consumption Exp.",  "unit": "Bil.$",   "note": "Consumer spending benchmark"},
}

# ── BLS series for healthcare sector ──────────────────────────────────────────
BLS_SERIES = {
    "CEU6562000001": "Ambulatory Health Services — Employment (thousands)",
    "CEU6562000008": "Ambulatory Health Services — Avg Hourly Earnings ($)",
    "CEU6561000001": "Hospitals — Employment (thousands)",
    "CEU6561000008": "Hospitals — Avg Hourly Earnings ($)",
    "CEU6500000001": "All Healthcare & Social Assistance — Employment (thousands)",
    "CEU6500000008": "All Healthcare & Social Assistance — Avg Hourly Earnings ($)",
}

# ── Census ACS variables ───────────────────────────────────────────────────────
_ACS_VARS = "B19013_001E,B23025_004E,B23025_002E,B01003_001E,B25077_001E,B27001_001E"
_ACS_NAMES = {
    "B19013_001E": "Median Household Income ($)",
    "B23025_004E": "Employed Civilians",
    "B23025_002E": "Total Labor Force",
    "B01003_001E": "Total Population",
    "B25077_001E": "Median Home Value ($)",
    "B27001_001E": "Health Insurance Coverage (Total)",
}


# ─── 1. FRED Economic Indicators ──────────────────────────────────────────────

async def _fetch_one_fred(client: httpx.AsyncClient, series_id: str, meta: dict) -> dict:
    if not FRED_KEY:
        return {
            "series_id": series_id,
            "label": meta["label"],
            "unit": meta["unit"],
            "note": meta["note"],
            "status": "NO_KEY",
        }
    try:
        resp = await client.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params={
                "series_id": series_id,
                "api_key": FRED_KEY,
                "file_type": "json",
                "limit": 24,
                "sort_order": "desc",
            },
            headers=_HEADERS,
        )
        if resp.status_code == 200:
            obs_raw = [o for o in resp.json().get("observations", []) if o.get("value", ".") != "."]
            if obs_raw:
                latest   = obs_raw[0]
                prev     = obs_raw[1] if len(obs_raw) > 1 else obs_raw[0]
                lv       = float(latest["value"])
                pv       = float(prev["value"])
                chg      = round(lv - pv, 4)
                chg_pct  = round(chg / pv * 100, 3) if pv else 0
                trend = [{"date": o["date"], "value": float(o["value"])} for o in reversed(obs_raw[:13])]
                return {
                    "series_id":      series_id,
                    "label":          meta["label"],
                    "unit":           meta["unit"],
                    "note":           meta["note"],
                    "latest_value":   lv,
                    "latest_date":    latest["date"],
                    "previous_value": pv,
                    "change":         chg,
                    "change_pct":     chg_pct,
                    "trend":          trend,
                    "status":         "OK",
                }
        return {"series_id": series_id, "label": meta["label"], "status": "ERROR", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"series_id": series_id, "label": meta["label"], "status": "ERROR", "error": str(e)}


@router.get("/fred")
async def fred_indicators(series_ids: Optional[str] = None):
    """
    FRED economic data — medical CPI, unemployment, treasury yields, and more.
    Requires free FRED_API_KEY from fred.stlouisfed.org/docs/api/api_key.html
    """
    target = {}
    if series_ids:
        for sid in series_ids.split(","):
            sid = sid.strip().upper()
            target[sid] = FRED_SERIES.get(sid, {"label": sid, "unit": "", "note": ""})
    else:
        target = FRED_SERIES

    if not FRED_KEY:
        return {
            "status": "NO_KEY",
            "message": (
                "FRED API key required. Register for free at "
                "https://fred.stlouisfed.org/docs/api/api_key.html "
                "then add FRED_API_KEY to your Replit environment secrets."
            ),
            "series": {
                sid: {"series_id": sid, **meta, "status": "NO_KEY"}
                for sid, meta in target.items()
            },
        }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        tasks = [_fetch_one_fred(client, sid, meta) for sid, meta in target.items()]
        results = await asyncio.gather(*tasks)

    return {
        "status": "OK",
        "series": {r["series_id"]: r for r in results},
        "source": "Federal Reserve Bank of St. Louis — FRED®",
        "fred_key_info": "Registered FRED_API_KEY active.",
    }


# ─── 2. BLS Employment & Wages ────────────────────────────────────────────────

@router.get("/bls")
async def bls_data(series_ids: Optional[str] = None, years: int = 2):
    """
    BLS healthcare sector employment & wages.
    Keyless v1 API (25 queries/day). Add BLS_API_KEY for v2 (500/day).
    """
    target_ids = list(BLS_SERIES.keys()) if not series_ids else series_ids.split(",")
    target_ids = [s.strip() for s in target_ids[:6]]

    async def _fetch_one_bls(client: httpx.AsyncClient, sid: str) -> dict:
        try:
            r = await client.get(
                f"https://api.bls.gov/publicAPI/v1/timeseries/data/{sid}",
                headers=_HEADERS,
            )
            if r.status_code == 200:
                data = r.json()
                obs = data.get("Results", {}).get("series", [{}])[0].get("data", [])
                if obs:
                    latest = obs[0]
                    prev   = obs[1] if len(obs) > 1 else obs[0]
                    lv = float(latest.get("value", 0))
                    pv = float(prev.get("value", 0))
                    return {
                        "series_id": sid,
                        "label": BLS_SERIES.get(sid, sid),
                        "latest_value": lv,
                        "latest_period": f"{latest.get('periodName','')} {latest.get('year','')}".strip(),
                        "previous_value": pv,
                        "change": round(lv - pv, 3),
                        "trend": obs[:13],
                        "status": "OK",
                    }
        except Exception as e:
            logger.debug("[BLS v1] %s: %s", sid, e)
        return {"series_id": sid, "label": BLS_SERIES.get(sid, sid), "status": "ERROR"}

    try:
        series_results = {}
        async with httpx.AsyncClient(timeout=25) as client:
            if BLS_KEY:
                payload = {
                    "seriesid": target_ids,
                    "startyear": str(max(2020, 2025 - years)),
                    "endyear": "2025",
                    "registrationkey": BLS_KEY,
                    "calculations": True,
                    "annualaverage": False,
                }
                resp = await client.post(
                    "https://api.bls.gov/publicAPI/v2/timeseries/data/",
                    json=payload,
                    headers={**_HEADERS, "Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    for s in resp.json().get("Results", {}).get("series", []):
                        sid = s.get("seriesID", "")
                        obs = s.get("data", [])
                        if obs:
                            latest = obs[0]
                            prev = obs[1] if len(obs) > 1 else obs[0]
                            lv = float(latest.get("value", 0))
                            pv = float(prev.get("value", 0))
                            series_results[sid] = {
                                "series_id": sid,
                                "label": BLS_SERIES.get(sid, sid),
                                "latest_value": lv,
                                "latest_period": f"{latest.get('periodName','')} {latest.get('year','')}".strip(),
                                "previous_value": pv,
                                "change": round(lv - pv, 3),
                                "trend": obs[:13],
                                "status": "OK",
                            }
            else:
                # v1: one series per request — fetch all in parallel
                tasks = [_fetch_one_bls(client, sid) for sid in target_ids]
                results = await asyncio.gather(*tasks)
                for r in results:
                    if r.get("status") == "OK":
                        series_results[r["series_id"]] = r

        return {
            "status": "OK",
            "series": series_results,
            "source": "U.S. Bureau of Labor Statistics",
            "api_tier": "v2 (registered key)" if BLS_KEY else "v1 (keyless, 25 requests/day limit)",
            "note": "" if BLS_KEY else "Add BLS_API_KEY (free at bls.gov/developers) for v2 access and higher rate limits.",
        }
    except Exception as e:
        logger.warning("[BLS] %s", e)
        return {"status": "ERROR", "error": str(e), "series": {}}


# ─── 3. Census Bureau Demographics ────────────────────────────────────────────

@router.get("/census")
async def census_demographics(state: Optional[str] = None, county: Optional[str] = None):
    """
    Census ACS 5-Year — demographic & income data by state or county.
    Works without a key (rate-limited). Add CENSUS_API_KEY for higher limits.
    """
    params: dict = {"get": _ACS_VARS}
    if CENSUS_KEY:
        params["key"] = CENSUS_KEY
    if state and county:
        params["for"] = f"county:{county.zfill(3)}"
        params["in"] = f"state:{state.zfill(2)}"
        geo = f"County {county}, State {state}"
    elif state:
        params["for"] = f"state:{state.zfill(2)}"
        geo = f"State FIPS {state}"
    else:
        params["for"] = "us:1"
        geo = "United States (National)"

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get("https://api.census.gov/data/2022/acs/acs5", params=params, headers=_HEADERS)

        if resp.status_code == 200:
            rows = resp.json()
            if len(rows) >= 2:
                hdrs, vals = rows[0], rows[1]
                result = {}
                for i, h in enumerate(hdrs):
                    if h in _ACS_NAMES and i < len(vals):
                        try:
                            v = int(vals[i]) if vals[i] and vals[i] != "-666666666" else None
                        except (ValueError, TypeError):
                            v = None
                        result[h] = {"label": _ACS_NAMES[h], "value": v}

                emp = (result.get("B23025_004E") or {}).get("value")
                lf  = (result.get("B23025_002E") or {}).get("value")
                emp_rate = round(emp / lf * 100, 1) if emp and lf else None

                return {
                    "status": "OK",
                    "geography": geo,
                    "year": 2022,
                    "data": result,
                    "employment_rate_pct": emp_rate,
                    "source": "U.S. Census Bureau — American Community Survey 5-Year Estimates (2022)",
                    "authority": "13 U.S.C. § 141 (Census Mandate)",
                }

        return {"status": "ERROR", "error": f"Census API returned HTTP {resp.status_code}", "data": {}}
    except Exception as e:
        logger.warning("[Census] %s", e)
        return {"status": "ERROR", "error": str(e), "data": {}}


# ─── 4. USASpending Federal Contracts ─────────────────────────────────────────

@router.get("/usaspending")
async def usaspending_search(name: str, limit: int = 15):
    """
    USASpending.gov — federal contract & grant history by recipient name.
    Completely free, no API key required. Identifies terminated-for-default contracts.
    """
    if not name or len(name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Company name required.")
    name = name.strip()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            payload = {
                "filters": {
                    "recipient_search_text": [name],
                    "award_type_codes": ["A", "B", "C", "D", "02", "03", "04", "05"],
                },
                "fields": [
                    "Award ID", "Recipient Name", "Award Amount",
                    "Start Date", "End Date", "Awarding Agency",
                    "Award Type", "Description",
                ],
                "page": 1,
                "limit": min(limit, 25),
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
            total   = data.get("page_metadata", {}).get("total", len(results))
            total_amt = 0.0
            records = []
            for r in results:
                amt = float(r.get("Award Amount", 0) or 0)
                total_amt += amt
                records.append({
                    "award_id":   r.get("Award ID", ""),
                    "recipient":  r.get("Recipient Name", ""),
                    "amount":     amt,
                    "start_date": r.get("Start Date", ""),
                    "end_date":   r.get("End Date", ""),
                    "agency":     r.get("Awarding Agency", ""),
                    "award_type": r.get("Award Type", ""),
                    "description": (r.get("Description", "") or "")[:120],
                })
            return {
                "query":        name,
                "total_awards": total,
                "total_amount": round(total_amt, 2),
                "records":      records,
                "source":       "USASpending.gov — Federal Procurement Data System",
                "authority":    "31 U.S.C. § 6101 (Federal Funding Accountability and Transparency Act)",
            }

        return {"query": name, "total_awards": 0, "total_amount": 0, "records": [],
                "note": f"USASpending returned HTTP {resp.status_code}"}
    except Exception as e:
        logger.warning("[USASpending] %s: %s", name, e)
        return {"query": name, "error": str(e), "total_awards": 0, "records": []}


# ─── 5. SEC EDGAR XBRL Company Financials ─────────────────────────────────────

@router.get("/edgar-xbrl")
async def edgar_xbrl(ticker: str):
    """
    SEC EDGAR XBRL Company Facts — structured financial data for any US public company.
    No API key required. Revenue, net income, employees, debt, cash, equity.
    """
    if not ticker or len(ticker.strip()) < 1:
        raise HTTPException(status_code=400, detail="Ticker symbol required.")
    ticker = ticker.strip().upper()

    edgar_headers = {**_HEADERS, "User-Agent": "KincaidIQ/2.0 contact@kincaidrmc.com"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r_tickers = await client.get(
                "https://data.sec.gov/submissions/company_tickers.json",
                headers=edgar_headers,
            )

        cik_str = None
        company_name = ""
        if r_tickers.status_code == 200:
            for _, val in r_tickers.json().items():
                if str(val.get("ticker", "")).upper() == ticker:
                    cik_str = str(val.get("cik_str", "")).zfill(10)
                    company_name = val.get("title", "")
                    break

        if not cik_str:
            return {"ticker": ticker, "found": False, "error": "Ticker not found in SEC EDGAR."}

        async with httpx.AsyncClient(timeout=20) as client:
            r_sub, r_facts = await asyncio.gather(
                client.get(f"https://data.sec.gov/submissions/CIK{cik_str}.json", headers=edgar_headers),
                client.get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik_str}.json", headers=edgar_headers),
            )

        if r_sub.status_code == 200:
            sub_data = r_sub.json()
            company_name = sub_data.get("name", company_name)
            sic = sub_data.get("sic", "")
            sic_desc = sub_data.get("sicDescription", "")
            state = sub_data.get("stateOfIncorporation", "")
            fiscal_year_end = sub_data.get("fiscalYearEnd", "")
        else:
            sic = sic_desc = state = fiscal_year_end = ""

        if r_facts.status_code != 200:
            return {
                "ticker": ticker, "company_name": company_name, "cik": cik_str,
                "found": True, "financials": {},
                "error": "XBRL facts not available for this company.",
            }

        us_gaap = r_facts.json().get("facts", {}).get("us-gaap", {})

        def _latest(concept: str, fallback: Optional[str] = None) -> dict:
            data = us_gaap.get(concept) or (us_gaap.get(fallback) if fallback else None) or {}
            units = data.get("units", {})
            usd = units.get("USD", units.get("shares", []))
            if not usd:
                return {}
            annual = [u for u in usd if u.get("form") in ("10-K", "10-K/A")] or usd
            annual.sort(key=lambda x: x.get("end", ""), reverse=True)
            if annual:
                rec = annual[0]
                return {
                    "value":      rec.get("val"),
                    "period_end": rec.get("end"),
                    "form":       rec.get("form"),
                    "filed":      rec.get("filed"),
                }
            return {}

        financials = {
            "revenues":          _latest("Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"),
            "net_income":        _latest("NetIncomeLoss"),
            "total_assets":      _latest("Assets"),
            "total_liabilities": _latest("Liabilities"),
            "equity":            _latest("StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"),
            "long_term_debt":    _latest("LongTermDebt", "LongTermDebtNoncurrent"),
            "cash":              _latest("CashAndCashEquivalentsAtCarryingValue", "Cash"),
            "operating_income":  _latest("OperatingIncomeLoss"),
            "employees":         _latest("EntityNumberOfEmployees"),
            "benefits_expense":  _latest("EmployeeBenefitsAndShareBasedCompensation", "LaborAndRelatedExpense"),
        }

        return {
            "ticker":                ticker,
            "company_name":          company_name,
            "cik":                   cik_str,
            "sic":                   sic,
            "sic_description":       sic_desc,
            "state_of_incorporation": state,
            "fiscal_year_end":       fiscal_year_end,
            "found":                 True,
            "financials":            financials,
            "source":                "SEC EDGAR XBRL Company Facts",
            "authority":             "15 U.S.C. § 78l (Securities Exchange Act § 12)",
            "edgar_url":             f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik_str}&type=10-K",
        }
    except Exception as e:
        logger.warning("[EDGAR-XBRL] %s: %s", ticker, e)
        return {"ticker": ticker, "found": False, "error": str(e)}


# ─── 6. Economic Snapshot (combined) ──────────────────────────────────────────

@router.get("/snapshot")
async def economic_snapshot():
    """
    Combined economic snapshot for benefits benchmarking dashboard.
    Returns curated FRED indicators + BLS healthcare sector data in one call.
    """
    fred_task  = fred_indicators()
    bls_task   = bls_data(years=1)
    fred_result, bls_result = await asyncio.gather(fred_task, bls_task)

    return {
        "source": "Kincaid Health Market Intelligence — FRED® + BLS",
        "fred":   fred_result,
        "bls":    bls_result,
        "benchmarks": {
            "medical_inflation":  "Compare plan PMPM trend against Medical Care CPI (CPIMEDSL).",
            "wage_benchmark":     "Compare plan admin costs against BLS healthcare avg hourly earnings.",
            "stop_loss_reserves": "Monitor 10-Year Treasury (DGS10) for stop-loss carrier investment assumptions.",
            "pension_discount":   "Use 30-Year Treasury (DGS30) as proxy for DB plan liability discount rate.",
        },
        "key_registrations": {
            "FRED":   "https://fred.stlouisfed.org/docs/api/api_key.html (free)",
            "BLS":    "https://data.bls.gov/registrationEngine/ (free)",
            "Census": "https://api.census.gov/data/key_signup.html (free)",
        },
    }
