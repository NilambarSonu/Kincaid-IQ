"""
SEC EDGAR enrichment service for the Broker IQ Prospect Console.

Enriches Form 5500 prospects with public-company intelligence:
  - Is the employer publicly traded?
  - What is their ticker symbol?
  - Have they filed a material 8-K event in the last 180 days?
  - What type of trigger event (M&A, leadership change, restructuring)?

Uses only free, public SEC APIs. No auth required.
Rate limit: ≤10 requests/second per SEC fair-use policy.
"""

import re
import asyncio
import logging
from datetime import datetime, timedelta

import httpx

logger = logging.getLogger("kincaid.edgar")

EDGAR_HEADERS = {
    "User-Agent": "KincaidIQ contact@kincaidrmc.com",
    "Accept-Encoding": "gzip, deflate",
    "Accept": "application/json",
}

# In-memory caches
_company_tickers: dict[str, dict] = {}   # normalized_name -> {cik, ticker, title}
_ticker_loaded: bool = False
_filing_cache: dict[str, dict | None] = {}  # cik -> filing result or None

# 8-K item codes that matter to a benefits broker
_ITEM_MAP: list[tuple[str, str, str]] = [
    ("2.01", "acquisition",   "Completed Acquisition or Merger"),
    ("1.01", "ma",            "Material Agreement Signed"),
    ("1.02", "ma",            "Material Agreement Terminated"),
    ("5.02", "leadership",    "Executive / Director Change"),
    ("2.05", "restructuring", "Employee Departures / Reduction in Force"),
    ("2.03", "debt",          "New Direct Financial Obligation"),
    ("2.02", "financial",     "Results of Operations Reported"),
    ("7.01", "ma",            "Regulation FD — M&A Signal"),
    ("8.01", "other",         "Other Material Event"),
]

_TRIGGER_PRIORITY: dict[str, int] = {
    "acquisition": 5, "ma": 4, "leadership": 3,
    "restructuring": 3, "debt": 2, "financial": 1, "other": 0,
}


def _normalize(name: str) -> str:
    name = name.upper().strip()
    for sfx in [
        " INC", " INCORPORATED", " LLC", " L.L.C.", " L.L.C",
        " CORP", " CORPORATION", " LTD", " LIMITED", " CO",
        " COMPANY", " GROUP", " HOLDINGS", " HOLDING", " THE",
        " SERVICES", " SOLUTIONS", " ENTERPRISES", " ENTERPRISE",
    ]:
        if name.endswith(sfx):
            name = name[: -len(sfx)].strip()
    name = re.sub(r"[.,&'/\-]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


async def _load_tickers() -> None:
    global _company_tickers, _ticker_loaded
    if _ticker_loaded:
        return
    try:
        async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=30) as client:
            resp = await client.get(
                "https://www.sec.gov/files/company_tickers.json"
            )
            resp.raise_for_status()
            data: dict = resp.json()

        for entry in data.values():
            title: str = entry.get("title") or ""
            norm = _normalize(title)
            if norm:
                _company_tickers[norm] = {
                    "cik": str(entry.get("cik_str", "")).zfill(10),
                    "ticker": entry.get("ticker", ""),
                    "title": title,
                }
        _ticker_loaded = True
        logger.info("[EDGAR] Loaded %d public-company names", len(_company_tickers))
    except Exception as exc:
        logger.warning("[EDGAR] Failed to load company tickers: %s", exc)


def _classify_items(items: str) -> dict:
    best: dict = {"type": "filing", "label": "Recent SEC Filing", "priority": -1}
    for code, ttype, label in _ITEM_MAP:
        if code in items:
            pri = _TRIGGER_PRIORITY.get(ttype, 0)
            if pri > best["priority"]:
                best = {"type": ttype, "label": label, "priority": pri}
    return best


async def _get_8k(cik: str) -> dict | None:
    if cik in _filing_cache:
        return _filing_cache[cik]
    cutoff = (datetime.now() - timedelta(days=180)).strftime("%Y-%m-%d")
    try:
        async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=15) as client:
            resp = await client.get(
                f"https://data.sec.gov/submissions/CIK{cik}.json"
            )
            resp.raise_for_status()
            data = resp.json()

        recent = data.get("filings", {}).get("recent", {})
        forms: list = recent.get("form", [])
        dates: list = recent.get("filingDate", [])
        items_list: list = recent.get("items", [])

        found: list[dict] = []
        for i, form in enumerate(forms):
            if form != "8-K":
                continue
            date = dates[i] if i < len(dates) else ""
            if date < cutoff:
                continue
            raw_items = items_list[i] if i < len(items_list) else ""
            classified = _classify_items(str(raw_items))
            found.append({
                "filing_date":   date,
                "trigger_type":  classified["type"],
                "trigger_label": classified["label"],
                "priority":      classified["priority"],
                "item_codes":    raw_items,
            })

        result: dict | None = None
        if found:
            found.sort(key=lambda x: (x["priority"], x["filing_date"]), reverse=True)
            best = found[0]
            result = {
                "trigger_type":  best["trigger_type"],
                "trigger_label": best["trigger_label"],
                "trigger_date":  best["filing_date"],
            }

        _filing_cache[cik] = result
        return result

    except Exception as exc:
        logger.debug("[EDGAR] 8-K lookup failed cik=%s: %s", cik, exc)
        _filing_cache[cik] = None
        return None


async def edgar_enrich(names: list[str]) -> dict[str, dict]:
    """
    Given a list of Form 5500 sponsor names, return EDGAR enrichment for any
    that match a publicly-traded company.

    Returns:
        { original_name: { is_public, ticker, cik, legal_name, [trigger_*] } }
    """
    if not names:
        return {}

    await _load_tickers()

    # Match names → CIKs
    matched: list[tuple[str, str]] = []  # (original_name, cik)
    for name in names:
        norm = _normalize(name)
        hit = _company_tickers.get(norm)
        if hit:
            matched.append((name, hit["cik"]))

    if not matched:
        return {}

    # Fetch 8-K filings concurrently, throttled to avoid SEC rate limit
    semaphore = asyncio.Semaphore(5)

    async def fetch_throttled(cik: str) -> dict | None:
        async with semaphore:
            return await _get_8k(cik)

    filing_results = await asyncio.gather(
        *[fetch_throttled(cik) for _, cik in matched],
        return_exceptions=True,
    )

    out: dict[str, dict] = {}
    for (name, cik), filing in zip(matched, filing_results):
        norm = _normalize(name)
        meta = _company_tickers[norm]
        enrichment: dict = {
            "is_public":  True,
            "ticker":     meta["ticker"],
            "cik":        cik,
            "legal_name": meta["title"],
        }
        if isinstance(filing, dict) and filing:
            enrichment["trigger_type"]  = filing["trigger_type"]
            enrichment["trigger_label"] = filing["trigger_label"]
            enrichment["trigger_date"]  = filing["trigger_date"]
        out[name] = enrichment

    logger.info(
        "[EDGAR] Enriched %d/%d prospects as public companies (%d with triggers)",
        len(out), len(names),
        sum(1 for v in out.values() if "trigger_type" in v),
    )
    return out
