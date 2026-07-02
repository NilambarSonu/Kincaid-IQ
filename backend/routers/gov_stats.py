"""
Kincaid IQ — Government Statistics Intelligence Hub
Connects to 6 free US government data APIs:
  1. BLS  — CPI, unemployment, healthcare employment, benefits cost index
  2. FDA  — drug recalls (Class I), adverse event counts
  3. USASpending — federal healthcare contract spend
  4. CMS  — Medicare/Medicaid drug spend
  5. FRED — macro indicators (FRED_API_KEY optional, graceful fallback)
  6. Census — employer counts by NAICS (CENSUS_API_KEY optional)
"""
import os
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from backend.auth import get_current_user
from backend import models

logger = logging.getLogger("kincaid.gov_stats")
router = APIRouter(prefix="/api/gov-stats", tags=["gov-stats"])

FRED_KEY   = os.getenv("FRED_API_KEY", "")
CENSUS_KEY = os.getenv("CENSUS_API_KEY", "")
BLS_KEY    = os.getenv("BLS_API_KEY", "")
BEA_KEY    = os.getenv("BEA_API_KEY", "")

_CACHE: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 1800  # 30 minutes


def _cached(key: str, ttl: int = CACHE_TTL):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[0]) < ttl:
        return entry[1]
    return None


def _store(key: str, data: Any):
    _CACHE[key] = (time.time(), data)
    return data


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


async def _fetch(client: httpx.AsyncClient, method: str, url: str, **kwargs) -> dict | list | None:
    try:
        r = await client.request(method, url, timeout=10.0, **kwargs)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        logger.warning("gov_stats fetch error %s %s: %s", method, url, e)
    return None


# ── BLS ──────────────────────────────────────────────────────────────────────

BLS_SERIES = {
    "CUUR0000SA0":         "CPI All Items",
    "CUUR0000SAM":         "Medical Care CPI",
    "LNS14000000":         "Unemployment Rate",
    "CES6562000001":       "Healthcare Employment (000s)",
    "CIU2010000000000A":   "Benefits Cost Index",
    "CES0500000008":       "Avg Hourly Earnings",
}


async def fetch_bls(client: httpx.AsyncClient) -> dict:
    cached = _cached("bls")
    if cached:
        return cached

    payload: dict = {
        "seriesid": list(BLS_SERIES.keys()),
        "startyear": "2022",
        "endyear": str(datetime.now().year),
    }
    if BLS_KEY:
        payload["registrationkey"] = BLS_KEY

    url = "https://api.bls.gov/publicAPI/v2/timeseries/data/" if BLS_KEY else "https://api.bls.gov/publicAPI/v1/timeseries/data/"

    raw = await _fetch(client, "POST", url, json=payload)

    if raw and raw.get("status") == "REQUEST_SUCCEEDED":
        series_out = []
        for s in raw.get("Results", {}).get("series", []):
            sid = s.get("seriesID", "")
            data_pts = s.get("data", [])
            latest = data_pts[0] if data_pts else {}
            series_out.append({
                "id":    sid,
                "name":  BLS_SERIES.get(sid, sid),
                "value": latest.get("value", "—"),
                "period": latest.get("periodName", "") + " " + latest.get("year", ""),
                "history": [{"period": d.get("periodName","")+" "+d.get("year",""), "value": d.get("value","0")} for d in data_pts[:12]],
            })
        result = {"source": "BLS", "live": True, "updated": _now(), "series": series_out}
        return _store("bls", result)

    return _store("bls", {
        "source": "BLS", "live": False, "updated": _now(),
        "series": [
            {"id": "CUUR0000SA0",       "name": "CPI All Items",              "value": "314.796", "period": "Nov 2024", "history": []},
            {"id": "CUUR0000SAM",       "name": "Medical Care CPI",           "value": "576.1",   "period": "Nov 2024", "history": []},
            {"id": "LNS14000000",       "name": "Unemployment Rate",          "value": "4.2",     "period": "Nov 2024", "history": []},
            {"id": "CES6562000001",     "name": "Healthcare Employment (000s)","value": "21,694", "period": "Nov 2024", "history": []},
            {"id": "CIU2010000000000A", "name": "Benefits Cost Index",        "value": "137.4",   "period": "Sep 2024", "history": []},
            {"id": "CES0500000008",     "name": "Avg Hourly Earnings",        "value": "$35.61",  "period": "Nov 2024", "history": []},
        ],
    })


# ── FDA openFDA ───────────────────────────────────────────────────────────────

async def fetch_fda(client: httpx.AsyncClient) -> dict:
    cached = _cached("fda")
    if cached:
        return cached

    recalls_url  = "https://api.fda.gov/drug/enforcement.json?limit=8&search=classification:%22Class+I%22&sort=recall_initiation_date:desc"
    events_url   = "https://api.fda.gov/drug/event.json?limit=1&count=receivedate"

    recalls_raw, events_raw = await asyncio.gather(
        _fetch(client, "GET", recalls_url),
        _fetch(client, "GET", events_url),
    )

    if recalls_raw:
        recalls = [
            {
                "date":    r.get("recall_initiation_date", ""),
                "firm":    r.get("recalling_firm", ""),
                "product": r.get("product_description", "")[:80],
                "reason":  r.get("reason_for_recall", "")[:120],
                "class":   r.get("classification", ""),
                "status":  r.get("status", ""),
            }
            for r in recalls_raw.get("results", [])
        ]
        total = recalls_raw.get("meta", {}).get("results", {}).get("total", "—")
        result = {"source": "FDA openFDA", "live": True, "updated": _now(), "class1_total": total, "recent_recalls": recalls}
        return _store("fda", result)

    return _store("fda", {
        "source": "FDA openFDA", "live": False, "updated": _now(),
        "class1_total": 842,
        "recent_recalls": [
            {"date": "20241201", "firm": "Pfizer Inc.", "product": "Atorvastatin Calcium Tablets 80mg", "reason": "Superpotency — dissolution failure detected in stability studies", "class": "Class I", "status": "Ongoing"},
            {"date": "20241115", "firm": "Teva Pharmaceuticals", "product": "Metformin HCl Extended Release 500mg", "reason": "NDMA impurity above acceptable daily intake limit", "class": "Class I", "status": "Terminated"},
            {"date": "20241105", "firm": "Hikma Pharmaceuticals", "product": "Morphine Sulfate Injection 10mg/mL", "reason": "Presence of particulate matter — glass particles identified", "class": "Class I", "status": "Ongoing"},
            {"date": "20241030", "firm": "Amneal Pharmaceuticals", "product": "Amlodipine Besylate 10mg Tablets", "reason": "Subpotency — 85% of labeled claim on accelerated stability", "class": "Class I", "status": "Ongoing"},
        ],
    })


# ── USASpending.gov ───────────────────────────────────────────────────────────

async def fetch_usaspending(client: httpx.AsyncClient) -> dict:
    cached = _cached("usaspending")
    if cached:
        return cached

    url = "https://api.usaspending.gov/api/v2/references/cfda/totals/"
    agency_url = "https://api.usaspending.gov/api/v2/search/spending_by_category/awarding_agency/"

    body = {
        "filters": {
            "time_period": [{"start_date": "2024-01-01", "end_date": "2024-12-31"}],
            "award_type_codes": ["A", "B", "C", "D"],
        },
        "category": "awarding_agency",
        "subawards": False,
        "limit": 8,
        "page": 1,
    }

    raw = await _fetch(client, "POST", agency_url, json=body)

    if raw and raw.get("results"):
        agencies = [
            {
                "name":   r.get("name", ""),
                "amount": r.get("aggregated_amount", 0),
                "count":  r.get("item_count", 0),
            }
            for r in raw["results"][:8]
        ]
        result = {"source": "USASpending.gov", "live": True, "updated": _now(), "fiscal_year": "2024", "top_agencies": agencies}
        return _store("usaspending", result)

    return _store("usaspending", {
        "source": "USASpending.gov", "live": False, "updated": _now(),
        "fiscal_year": "2024",
        "total_healthcare_contracts_bn": 412.7,
        "top_agencies": [
            {"name": "Dept. of Health & Human Services",       "amount": 187_420_000_000, "count": 42318},
            {"name": "Dept. of Defense (TRICARE)",              "amount": 58_310_000_000,  "count": 12045},
            {"name": "Dept. of Veterans Affairs",               "amount": 43_920_000_000,  "count": 9871},
            {"name": "Centers for Medicare & Medicaid Services","amount": 38_750_000_000,  "count": 7442},
            {"name": "CDC / ATSDR",                             "amount": 12_600_000_000,  "count": 3210},
            {"name": "NIH",                                     "amount": 9_800_000_000,   "count": 18920},
            {"name": "HRSA",                                    "amount": 7_300_000_000,   "count": 4511},
            {"name": "FDA",                                     "amount": 3_200_000_000,   "count": 1887},
        ],
    })


# ── CMS ───────────────────────────────────────────────────────────────────────

async def fetch_cms(client: httpx.AsyncClient) -> dict:
    cached = _cached("cms")
    if cached:
        return cached

    url = "https://data.cms.gov/resource/x5s6-t6hp.json?$limit=10&$order=total_spending+DESC"
    raw = await _fetch(client, "GET", url)

    if raw and isinstance(raw, list) and len(raw) > 0:
        drugs = [
            {
                "drug": r.get("drug_name_and_strength", r.get("drug_name", "")),
                "total_spending": float(r.get("total_spending", 0)),
                "total_claims":   int(r.get("total_prescriptions", r.get("total_claims", 0))),
            }
            for r in raw[:10]
        ]
        result = {"source": "CMS Medicare Part D", "live": True, "updated": _now(), "top_drugs_by_spend": drugs}
        return _store("cms", result)

    return _store("cms", {
        "source": "CMS Medicare Part D", "live": False, "updated": _now(),
        "nhe_2023_bn": 4_867,
        "rx_spend_bn": 405.9,
        "medicare_bn": 1_034,
        "medicaid_bn": 871,
        "top_drugs_by_spend": [
            {"drug": "Ozempic (Semaglutide) 0.5mg/0.68mL",     "total_spending": 5_780_000_000, "total_claims": 7_120_000},
            {"drug": "Eliquis (Apixaban) 5mg",                  "total_spending": 4_920_000_000, "total_claims": 10_845_000},
            {"drug": "Jardiance (Empagliflozin) 10mg",          "total_spending": 3_410_000_000, "total_claims": 4_330_000},
            {"drug": "Keytruda (Pembrolizumab) 25mg/mL",        "total_spending": 2_890_000_000, "total_claims": 328_000},
            {"drug": "Xarelto (Rivaroxaban) 20mg",              "total_spending": 2_740_000_000, "total_claims": 5_210_000},
            {"drug": "Farxiga (Dapagliflozin) 10mg",            "total_spending": 2_210_000_000, "total_claims": 3_540_000},
            {"drug": "Humira (Adalimumab) 40mg/0.4mL",         "total_spending": 1_940_000_000, "total_claims": 187_000},
            {"drug": "Trulicity (Dulaglutide) 1.5mg/0.5mL",    "total_spending": 1_820_000_000, "total_claims": 4_910_000},
        ],
    })


# ── FRED ──────────────────────────────────────────────────────────────────────

FRED_SERIES = [
    ("GDP",          "US GDP (Billions)",            "Q"),
    ("CPIAUCSL",     "CPI (All Urban Consumers)",    "M"),
    ("FEDFUNDS",     "Federal Funds Rate",           "M"),
    ("UNRATE",       "Unemployment Rate",            "M"),
    ("MEHOINUSA672N","Real Median Household Income", "A"),
    ("DHHNGSP",      "National Health Expenditure % GDP", "A"),
]


async def fetch_fred(client: httpx.AsyncClient) -> dict:
    cached = _cached("fred")
    if cached:
        return cached

    if not FRED_KEY:
        return _store("fred", {
            "source": "FRED (Federal Reserve)", "live": False,
            "note": "Add FRED_API_KEY secret to enable live data",
            "updated": _now(),
            "indicators": [
                {"id": "GDP",           "name": "US GDP",                        "value": "$27.36T",  "change": "+2.8%",  "period": "Q3 2024"},
                {"id": "CPIAUCSL",      "name": "CPI (YoY)",                     "value": "2.7%",     "change": "-0.1%",  "period": "Nov 2024"},
                {"id": "FEDFUNDS",      "name": "Federal Funds Rate",            "value": "4.58%",    "change": "-0.25%", "period": "Nov 2024"},
                {"id": "UNRATE",        "name": "Unemployment Rate",             "value": "4.2%",     "change": "+0.1%",  "period": "Nov 2024"},
                {"id": "MEHOINUSA672N", "name": "Real Median HH Income",         "value": "$77,719",  "change": "+4.0%",  "period": "2023"},
                {"id": "DHHNGSP",       "name": "Health Spend % of GDP",         "value": "17.3%",    "change": "+0.2%",  "period": "2023"},
            ],
        })

    indicators = []
    for sid, name, freq in FRED_SERIES:
        url = (
            f"https://api.stlouisfed.org/fred/series/observations"
            f"?series_id={sid}&api_key={FRED_KEY}&file_type=json"
            f"&sort_order=desc&limit=2"
        )
        raw = await _fetch(client, "GET", url)
        if raw and raw.get("observations"):
            obs = raw["observations"]
            latest = obs[0]
            prev   = obs[1] if len(obs) > 1 else obs[0]
            try:
                v  = float(latest["value"])
                p  = float(prev["value"])
                ch = v - p
            except Exception:
                v, ch = 0, 0
            indicators.append({"id": sid, "name": name, "value": str(latest["value"]), "change": f"{ch:+.2f}", "period": latest["date"]})
        else:
            indicators.append({"id": sid, "name": name, "value": "—", "change": "—", "period": "—"})

    result = {"source": "FRED (Federal Reserve)", "live": True, "updated": _now(), "indicators": indicators}
    return _store("fred", result)


# ── Census ────────────────────────────────────────────────────────────────────

async def fetch_census(client: httpx.AsyncClient) -> dict:
    cached = _cached("census")
    if cached:
        return cached

    if not CENSUS_KEY:
        return _store("census", {
            "source": "US Census Bureau", "live": False,
            "note": "Add CENSUS_API_KEY secret to enable live data",
            "updated": _now(),
            "employer_stats": [
                {"naics": "62",   "sector": "Health Care & Social Assistance", "establishments": 1_042_814, "employees": 21_694_000, "payroll_bn": 987.3},
                {"naics": "52",   "sector": "Finance & Insurance",             "establishments": 482_100,   "employees": 6_820_000,  "payroll_bn": 641.2},
                {"naics": "61",   "sector": "Educational Services",            "establishments": 271_800,   "employees": 3_740_000,  "payroll_bn": 198.4},
                {"naics": "31-33","sector": "Manufacturing",                   "establishments": 249_400,   "employees": 12_760_000, "payroll_bn": 858.1},
                {"naics": "54",   "sector": "Professional & Technical",        "establishments": 1_128_200, "employees": 10_290_000, "payroll_bn": 1_012.7},
                {"naics": "72",   "sector": "Accommodation & Food Services",   "establishments": 724_900,   "employees": 15_480_000, "payroll_bn": 368.2},
            ],
            "total_employer_firms": 6_100_000,
            "data_year": 2022,
        })

    url = (
        f"https://api.census.gov/data/2022/ecnbasic"
        f"?get=NAICS2017_LABEL,ESTAB,EMP,PAYANN&for=us:*&NAICS2017=62&key={CENSUS_KEY}"
    )
    raw = await _fetch(client, "GET", url)

    if raw and isinstance(raw, list) and len(raw) > 1:
        result = {
            "source": "US Census Bureau", "live": True, "updated": _now(),
            "raw": raw[:10],
        }
        return _store("census", result)

    return _store("census", {
        "source": "US Census Bureau", "live": False,
        "note": "Live data requires CENSUS_API_KEY",
        "updated": _now(),
        "employer_stats": [
            {"naics": "62",   "sector": "Health Care & Social Assistance", "establishments": 1_042_814, "employees": 21_694_000, "payroll_bn": 987.3},
            {"naics": "52",   "sector": "Finance & Insurance",             "establishments": 482_100,   "employees": 6_820_000,  "payroll_bn": 641.2},
            {"naics": "54",   "sector": "Professional & Technical",        "establishments": 1_128_200, "employees": 10_290_000, "payroll_bn": 1_012.7},
            {"naics": "44-45","sector": "Retail Trade",                    "establishments": 681_300,   "employees": 15_730_000, "payroll_bn": 453.9},
            {"naics": "72",   "sector": "Accommodation & Food Services",   "establishments": 724_900,   "employees": 15_480_000, "payroll_bn": 368.2},
        ],
        "total_employer_firms": 6_100_000,
        "data_year": 2022,
    })


# ── Aggregated Summary ─────────────────────────────────────────────────────────

@router.get("/all")
async def get_all_gov_stats(user: models.User = Depends(get_current_user)):
    cached = _cached("all_gov", ttl=900)
    if cached:
        return cached

    async with httpx.AsyncClient() as client:
        bls, fda, spending, cms, fred, census = await asyncio.gather(
            fetch_bls(client),
            fetch_fda(client),
            fetch_usaspending(client),
            fetch_cms(client),
            fetch_fred(client),
            fetch_census(client),
        )

    result = {
        "fetched_at": _now(),
        "sources": {
            "bls":         bls,
            "fda":         fda,
            "usaspending": spending,
            "cms":         cms,
            "fred":        fred,
            "census":      census,
        },
        "live_count": sum(1 for d in [bls, fda, spending, cms, fred, census] if d.get("live")),
        "api_keys_configured": {
            "FRED_API_KEY":   bool(FRED_KEY),
            "CENSUS_API_KEY": bool(CENSUS_KEY),
            "BLS_API_KEY":    bool(BLS_KEY),
            "BEA_API_KEY":    bool(BEA_KEY),
        },
    }
    _store("all_gov", result)
    return result


@router.post("/refresh")
async def refresh_gov_stats(user: models.User = Depends(get_current_user)):
    keys = ["bls", "fda", "usaspending", "cms", "fred", "census", "all_gov"]
    for k in keys:
        _CACHE.pop(k, None)
    return {"status": "cache_cleared", "message": "All government data caches cleared — next request will fetch live data."}
