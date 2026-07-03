"""
EDGAR Intelligence Platform — Kincaid IQ
Phase 3: Autonomous Intelligence Layer

Endpoints:
  POST /api/edgar/lang-change      — Risk Factors language diff (original)
  POST /api/edgar/full-intel       — Full intelligence report (language + 8-K + XBRL + Deal Radar)
  GET  /api/edgar/8k-feed/{ticker} — Recent 8-K event classification
  GET  /api/edgar/xbrl/{ticker}    — XBRL financial time-series
  POST /api/edgar/watchlist/scan   — Batch scan multiple tickers
"""

import re
import difflib
import logging
import asyncio
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("kincaid.edgar_lang")

router = APIRouter(prefix="/api/edgar", tags=["edgar"])

EDGAR_HEADERS = {
    "User-Agent": "KincaidIQ contact@kincaidrmc.com",
    "Accept-Encoding": "gzip, deflate",
    "Accept": "application/json",
}

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class LangChangeRequest(BaseModel):
    ticker: str
    form_type: str = "10-K"

class FullIntelRequest(BaseModel):
    ticker: str
    form_type: str = "10-K"

class WatchlistScanRequest(BaseModel):
    tickers: list[str]

# ─── Keyword Escalation Patterns ─────────────────────────────────────────────

ESCALATION_PAIRS = [
    ("may", "will"),
    ("may", "expects to"),
    ("could", "will"),
    ("possible", "likely"),
    ("possible", "probable"),
    ("might", "will"),
    ("some risk", "significant risk"),
    ("risk", "material risk"),
    ("risk", "substantial risk"),
    ("adverse", "material adverse"),
    ("challenges", "risks"),
    ("uncertainty", "material uncertainty"),
    ("decline", "material decline"),
    ("exposure", "material exposure"),
]

SEVERITY_TERMS = [
    "investigation", "subpoena", "class action", "material adverse",
    "litigation", "regulatory action", "SEC inquiry", "DOJ", "grand jury",
    "going concern", "restatement", "impairment", "default",
    "bankruptcy", "insolvency", "breach of contract", "material weakness",
    "whistleblower", "criminal", "indictment",
]

REGULATORY_TERMS = [
    "FTC", "DOJ", "SEC", "CMS", "FDA", "OIG", "HHS", "ERISA",
    "antitrust", "regulatory", "enforcement", "compliance", "investigation",
    "penalty", "fine", "consent decree", "settlement",
]

LITIGATION_TERMS = [
    "lawsuit", "litigation", "class action", "complaint", "plaintiff",
    "defendant", "settlement", "damages", "judgment", "arbitration",
]

EXEC_TURNOVER_TERMS = [
    "chief executive officer", "chief financial officer", "ceo", "cfo",
    "resignation", "departed", "appointed", "effective immediately",
    "transition", "named", "successor",
]

# ─── 8-K Event Categories ─────────────────────────────────────────────────────

EK_CATEGORIES = {
    "MA_ACTIVITY": {
        "keywords": ["merger", "acquisition", "definitive agreement", "tender offer", "combination", "transaction", "purchase price"],
        "label": "M&A Activity", "color": "#8b5cf6", "impact": "HIGH", "signal": "STRATEGIC",
    },
    "CEO_CHANGE": {
        "keywords": ["chief executive officer", "ceo", "resign", "appoint", "named", "transition", "president"],
        "label": "Executive Change", "color": "#f59e0b", "impact": "HIGH", "signal": "WATCH",
    },
    "LAWSUIT": {
        "keywords": ["lawsuit", "litigation", "class action", "complaint", "plaintiff", "settlement", "damages"],
        "label": "Legal/Litigation", "color": "#ef4444", "impact": "MEDIUM", "signal": "NEGATIVE",
    },
    "MATERIAL_AGREEMENT": {
        "keywords": ["material agreement", "credit facility", "amendment", "waiver", "contract", "agreement"],
        "label": "Material Agreement", "color": "#60a5fa", "impact": "MEDIUM", "signal": "NEUTRAL",
    },
    "EARNINGS": {
        "keywords": ["earnings", "revenue", "guidance", "outlook", "quarterly", "results"],
        "label": "Earnings / Guidance", "color": "#10b981", "impact": "MEDIUM", "signal": "VARIES",
    },
    "DEBT_FINANCING": {
        "keywords": ["notes", "senior notes", "bonds", "debt", "credit agreement", "revolving", "term loan"],
        "label": "Debt / Financing", "color": "#f97316", "impact": "MEDIUM", "signal": "WATCH",
    },
    "REGULATORY": {
        "keywords": ["sec", "ftc", "doj", "fda", "cms", "investigation", "subpoena", "inquiry", "penalty"],
        "label": "Regulatory Action", "color": "#ef4444", "impact": "HIGH", "signal": "NEGATIVE",
    },
    "DIVIDEND": {
        "keywords": ["dividend", "share repurchase", "buyback", "distribution"],
        "label": "Dividend / Buyback", "color": "#10b981", "impact": "LOW", "signal": "POSITIVE",
    },
}

# ─── CIK Lookup ───────────────────────────────────────────────────────────────

_ticker_cache: dict[str, dict] = {}
_tickers_loaded = False


async def _load_tickers() -> None:
    global _ticker_cache, _tickers_loaded
    if _tickers_loaded:
        return
    async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=30) as client:
        resp = await client.get("https://www.sec.gov/files/company_tickers.json")
        resp.raise_for_status()
        data = resp.json()
    for entry in data.values():
        t = (entry.get("ticker") or "").upper().strip()
        if t:
            _ticker_cache[t] = {
                "cik": str(entry.get("cik_str", "")).zfill(10),
                "title": entry.get("title", ""),
                "ticker": t,
            }
    _tickers_loaded = True
    logger.info("[EDGAR] Loaded %d tickers", len(_ticker_cache))


async def _get_cik(ticker: str) -> tuple[str, str]:
    await _load_tickers()
    hit = _ticker_cache.get(ticker.upper())
    if not hit:
        raise HTTPException(404, f"Ticker '{ticker}' not found in SEC EDGAR")
    return hit["cik"], hit["title"]


# ─── Fetch Recent Filings ─────────────────────────────────────────────────────

async def _get_recent_filings(cik: str, form_type: str, count: int = 3) -> list[dict]:
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=20) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    dates = recent.get("filingDate", [])
    primary_docs = recent.get("primaryDocument", [])
    report_dates = recent.get("reportDate", [])
    descriptions = recent.get("primaryDocDescription", [])

    results = []
    for i, form in enumerate(forms):
        if form == form_type and len(results) < count:
            acc_clean = accessions[i].replace("-", "") if i < len(accessions) else ""
            results.append({
                "accession": accessions[i] if i < len(accessions) else "",
                "accession_clean": acc_clean,
                "filing_date": dates[i] if i < len(dates) else "",
                "report_date": report_dates[i] if i < len(report_dates) else "",
                "primary_doc": primary_docs[i] if i < len(primary_docs) else "",
                "description": descriptions[i] if i < len(descriptions) else "",
                "form": form,
            })

    if len(results) < 2:
        raise HTTPException(422, f"Not enough {form_type} filings found (need 2, found {len(results)})")

    return results


async def _get_all_recent_filings(cik: str, form_types: list[str], count: int = 10) -> list[dict]:
    """Fetch recent filings across multiple form types."""
    url = f"https://data.sec.gov/submissions/CIK{cik}.json"
    async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=20) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accessions = recent.get("accessionNumber", [])
    dates = recent.get("filingDate", [])
    primary_docs = recent.get("primaryDocument", [])
    report_dates = recent.get("reportDate", [])
    descriptions = recent.get("primaryDocDescription", [])

    results = []
    for i, form in enumerate(forms):
        if form in form_types and len(results) < count:
            acc_clean = accessions[i].replace("-", "") if i < len(accessions) else ""
            results.append({
                "accession": accessions[i] if i < len(accessions) else "",
                "accession_clean": acc_clean,
                "filing_date": dates[i] if i < len(dates) else "",
                "report_date": report_dates[i] if i < len(report_dates) else "",
                "primary_doc": primary_docs[i] if i < len(primary_docs) else "",
                "description": descriptions[i] if i < len(descriptions) else "",
                "form": form,
            })

    return results


# ─── Fetch & Extract Filing Text ──────────────────────────────────────────────

_TEXT_CACHE: dict[str, str] = {}


async def _fetch_filing_text(cik: str, filing: dict) -> str:
    key = filing["accession_clean"]
    if key in _TEXT_CACHE:
        return _TEXT_CACHE[key]

    primary_doc = filing["primary_doc"]
    acc_clean = filing["accession_clean"]

    url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_clean}/{primary_doc}"

    async with httpx.AsyncClient(
        headers={**EDGAR_HEADERS, "Accept": "text/html,*/*"},
        timeout=40,
        follow_redirects=True,
    ) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            idx_url = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc_clean}/"
            resp = await client.get(idx_url)
            resp.raise_for_status()

    content = resp.text

    try:
        from bs4 import BeautifulSoup  # type: ignore
        soup = BeautifulSoup(content, "lxml")
        for tag in soup(["script", "style", "head"]):
            tag.decompose()
        text = soup.get_text(separator="\n")
    except ImportError:
        text = re.sub(r"<[^>]+>", " ", content)

    text = re.sub(r"\s{3,}", "\n\n", text)
    _TEXT_CACHE[key] = text
    return text


def _extract_risk_factors(text: str) -> str:
    start_patterns = [
        r"ITEM\s+1A[\.\s]*RISK\s+FACTORS",
        r"Item\s+1A[\.\s]*Risk\s+Factors",
        r"RISK\s+FACTORS",
    ]
    end_patterns = [
        r"ITEM\s+1B",
        r"Item\s+1B",
        r"ITEM\s+2[\.\s]",
        r"Item\s+2[\.\s]",
        r"UNRESOLVED\s+STAFF\s+COMMENTS",
    ]

    start_idx = -1
    for pat in start_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            start_idx = m.start()
            break

    if start_idx == -1:
        return text[:8000]

    end_idx = len(text)
    for pat in end_patterns:
        m = re.search(pat, text[start_idx + 200:], re.IGNORECASE)
        if m:
            end_idx = start_idx + 200 + m.start()
            break

    section = text[start_idx:end_idx]
    return section[:15000]


# ─── Diff Analysis ────────────────────────────────────────────────────────────

def _split_sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z•\-])", text)
    return [s.strip() for s in sentences if len(s.strip()) > 30]


def _compute_diff_v2(old_text: str, new_text: str) -> dict:
    """Sentence-level diff with NEW / MODIFIED / REMOVED categorization."""
    old_sents = _split_sentences(old_text)
    new_sents = _split_sentences(new_text)

    matcher = difflib.SequenceMatcher(None, old_sents, new_sents, autojunk=False)

    added_raw = []
    removed_raw = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "insert":
            added_raw.extend(new_sents[j1:j2])
        elif tag == "delete":
            removed_raw.extend(old_sents[i1:i2])
        elif tag == "replace":
            old_chunk = old_sents[i1:i2]
            new_chunk = new_sents[j1:j2]
            # Try to pair up modified sentences
            min_len = min(len(old_chunk), len(new_chunk))
            for k in range(min_len):
                ratio = difflib.SequenceMatcher(None, old_chunk[k], new_chunk[k]).ratio()
                if ratio >= 0.45:
                    # Treat as MODIFIED (include in added with label)
                    added_raw.append(new_chunk[k])
                else:
                    removed_raw.append(old_chunk[k])
                    added_raw.append(new_chunk[k])
            # Excess
            removed_raw.extend(old_chunk[min_len:])
            added_raw.extend(new_chunk[min_len:])

    return {
        "added": added_raw[:40],
        "removed": removed_raw[:40],
        "total_old": len(old_sents),
        "total_new": len(new_sents),
        "added_count": len(added_raw),
        "removed_count": len(removed_raw),
    }


def _detect_escalations(old_text: str, new_text: str) -> list[dict]:
    results = []
    old_lower = old_text.lower()
    new_lower = new_text.lower()

    for soft, hard in ESCALATION_PAIRS:
        old_soft = old_lower.count(soft)
        new_soft = new_lower.count(soft)
        old_hard = old_lower.count(hard)
        new_hard = new_lower.count(hard)

        if old_soft > 0 and new_hard > old_hard:
            results.append({
                "type": "escalation",
                "from_term": soft,
                "to_term": hard,
                "from_count": old_soft,
                "to_count": new_hard,
                "description": f'Soft language "{soft}" may now appear as stronger "{hard}" ({old_soft}→{new_hard})',
            })

    for term in SEVERITY_TERMS:
        old_count = old_lower.count(term.lower())
        new_count = new_lower.count(term.lower())
        if new_count > old_count:
            results.append({
                "type": "new_severity",
                "from_term": term,
                "to_term": term,
                "from_count": old_count,
                "to_count": new_count,
                "description": f'Severity term "{term}" increased ({old_count}→{new_count})',
            })

    results.sort(key=lambda x: x["to_count"] - x["from_count"], reverse=True)
    return results[:15]


def _compute_risk_score_breakdown(
    diff: dict, escalations: list, new_text: str, old_text: str
) -> dict:
    """Multi-factor risk score with component breakdown."""
    new_lower = new_text.lower()
    old_lower = old_text.lower()
    total = max(diff["total_old"], diff["total_new"], 1)

    # Component 1: New language volume (max 30)
    new_risk_score = min(30, int((diff["added_count"] / total) * 60))

    # Component 2: Severity language (max 25)
    sev_count = sum(1 for t in SEVERITY_TERMS if new_lower.count(t.lower()) > old_lower.count(t.lower()))
    severity_score = min(25, sev_count * 5)

    # Component 3: Regulatory term density (max 20)
    reg_new = sum(new_lower.count(t.lower()) for t in REGULATORY_TERMS)
    reg_old = sum(old_lower.count(t.lower()) for t in REGULATORY_TERMS)
    reg_delta = max(0, reg_new - reg_old)
    regulatory_score = min(20, reg_delta * 2)

    # Component 4: Litigation signals (max 15)
    lit_new = sum(new_lower.count(t.lower()) for t in LITIGATION_TERMS)
    lit_old = sum(old_lower.count(t.lower()) for t in LITIGATION_TERMS)
    lit_delta = max(0, lit_new - lit_old)
    litigation_score = min(15, lit_delta * 3)

    # Component 5: Escalation magnitude (max 10)
    escalation_score = min(10, len(escalations) * 2)

    total_score = min(100, new_risk_score + severity_score + regulatory_score + litigation_score + escalation_score)

    return {
        "total": total_score,
        "components": {
            "new_risk_language": new_risk_score,
            "severity_terms": severity_score,
            "regulatory_exposure": regulatory_score,
            "litigation_signals": litigation_score,
            "keyword_escalation": escalation_score,
        },
        "grade": "HIGH" if total_score >= 70 else "MODERATE" if total_score >= 40 else "LOW",
    }


# ─── 8-K Event Intelligence ───────────────────────────────────────────────────

def _classify_8k(text: str) -> dict:
    """Rule-based 8-K classification."""
    text_lower = text.lower()
    scores = {}
    for cat_id, cat in EK_CATEGORIES.items():
        score = sum(1 for kw in cat["keywords"] if kw in text_lower)
        if score > 0:
            scores[cat_id] = score

    if not scores:
        return {
            "event_type": "OTHER",
            "label": "Other Filing",
            "color": "#94a3b8",
            "impact": "LOW",
            "signal": "NEUTRAL",
            "confidence": "LOW",
        }

    best = max(scores, key=lambda k: scores[k])
    cat = EK_CATEGORIES[best]
    conf = "HIGH" if scores[best] >= 3 else "MEDIUM" if scores[best] >= 2 else "LOW"
    return {
        "event_type": best,
        "label": cat["label"],
        "color": cat["color"],
        "impact": cat["impact"],
        "signal": cat["signal"],
        "confidence": conf,
    }


async def _fetch_and_classify_8ks(cik: str, company: str, n: int = 8) -> list[dict]:
    """Fetch recent 8-K filings and classify each one."""
    filings = await _get_all_recent_filings(cik, ["8-K", "8-K/A"], count=n)
    if not filings:
        return []

    async def _process_one(f: dict) -> dict:
        try:
            text = await _fetch_filing_text(cik, f)
            # Use first 3000 chars for classification speed
            snippet = text[:3000]
            classification = _classify_8k(snippet)
            # Extract a brief summary (first ~200 chars of substantive text)
            lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 40]
            summary = lines[2] if len(lines) > 2 else lines[0] if lines else ""
            summary = summary[:200]
            return {
                "filing_date": f["filing_date"],
                "accession": f["accession"],
                "form": f["form"],
                **classification,
                "summary": summary,
            }
        except Exception as e:
            logger.warning("[EDGAR 8K] Failed to process %s: %s", f["accession"], e)
            return {
                "filing_date": f["filing_date"],
                "accession": f["accession"],
                "form": f["form"],
                "event_type": "OTHER",
                "label": "Other Filing",
                "color": "#94a3b8",
                "impact": "LOW",
                "signal": "NEUTRAL",
                "confidence": "LOW",
                "summary": "",
            }

    results = await asyncio.gather(*[_process_one(f) for f in filings])
    return list(results)


# ─── XBRL Financial Intelligence ──────────────────────────────────────────────

XBRL_CONCEPTS = {
    "revenue": ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"],
    "net_income": ["NetIncomeLoss", "ProfitLoss"],
    "gross_profit": ["GrossProfit"],
    "operating_income": ["OperatingIncomeLoss"],
    "total_debt": ["LongTermDebtAndCapitalLeaseObligations", "LongTermDebt", "DebtCurrent"],
    "total_assets": ["Assets"],
    "operating_cash_flow": ["NetCashProvidedByUsedInOperatingActivities"],
    "eps": ["EarningsPerShareDiluted"],
}


async def _fetch_xbrl_financials(cik: str) -> dict:
    """Pull key financial metrics from SEC EDGAR companyfacts API."""
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    try:
        async with httpx.AsyncClient(headers=EDGAR_HEADERS, timeout=25) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {}
            data = resp.json()
    except Exception as e:
        logger.warning("[EDGAR XBRL] Fetch failed: %s", e)
        return {}

    us_gaap = data.get("facts", {}).get("us-gaap", {})
    result = {}

    for metric, concepts in XBRL_CONCEPTS.items():
        for concept in concepts:
            if concept not in us_gaap:
                continue
            units = us_gaap[concept].get("units", {})
            # Prefer USD, fallback to USD/shares for EPS
            vals_raw = units.get("USD", units.get("USD/shares", []))
            # Filter to annual (10-K) filings only, last 6 periods
            annual = [
                v for v in vals_raw
                if v.get("form") == "10-K" and v.get("val") is not None
            ]
            # Deduplicate by end date, keep latest filed
            by_end: dict[str, dict] = {}
            for v in annual:
                end = v.get("end", "")
                if end not in by_end or v.get("filed", "") > by_end[end].get("filed", ""):
                    by_end[end] = v
            sorted_vals = sorted(by_end.values(), key=lambda x: x.get("end", ""), reverse=True)[:6]
            if sorted_vals:
                result[metric] = [
                    {"period": v.get("end", ""), "value": v.get("val"), "filed": v.get("filed", "")}
                    for v in reversed(sorted_vals)
                ]
                break  # Found a working concept

    return result


def _compute_deal_radar(
    risk_score: dict,
    escalations: list,
    xbrl: dict,
    events_8k: list,
) -> dict:
    """Combine signals to produce a Deal Radar output."""
    signals = []
    score = 0

    # Risk language
    if risk_score["total"] >= 70:
        signals.append("High language change score — rising risk disclosures")
        score += 3
    elif risk_score["total"] >= 40:
        signals.append("Moderate risk language increase")
        score += 1

    # Regulatory/litigation escalation
    reg_escs = [e for e in escalations if e["type"] == "new_severity"]
    if len(reg_escs) >= 3:
        signals.append(f"{len(reg_escs)} new severity terms (litigation/regulatory)")
        score += 2

    # Leadership change from 8-K
    leadership_events = [e for e in events_8k if e.get("event_type") == "CEO_CHANGE"]
    if leadership_events:
        signals.append(f"Executive change detected ({leadership_events[0]['filing_date']})")
        score += 3

    # Regulatory events
    reg_events = [e for e in events_8k if e.get("event_type") == "REGULATORY"]
    if reg_events:
        signals.append("Regulatory action filed with SEC")
        score += 2

    # M&A activity from 8-K
    ma_events = [e for e in events_8k if e.get("event_type") == "MA_ACTIVITY"]
    if ma_events:
        signals.append("M&A activity — recent material agreement filed")
        score += 1

    # Financial stress signals from XBRL
    if "net_income" in xbrl and len(xbrl["net_income"]) >= 2:
        recent = xbrl["net_income"][-1]["value"]
        prior = xbrl["net_income"][-2]["value"]
        if recent is not None and prior is not None and prior != 0:
            pct_change = (recent - prior) / abs(prior)
            if pct_change < -0.20:
                signals.append(f"Net income declined {abs(pct_change)*100:.0f}% year-over-year")
                score += 3
            elif pct_change < -0.05:
                signals.append(f"Net income down {abs(pct_change)*100:.0f}% — margin pressure")
                score += 1

    if "revenue" in xbrl and len(xbrl["revenue"]) >= 2:
        recent = xbrl["revenue"][-1]["value"]
        prior = xbrl["revenue"][-2]["value"]
        if recent is not None and prior is not None and prior != 0:
            pct_change = (recent - prior) / abs(prior)
            if pct_change < -0.10:
                signals.append(f"Revenue declined {abs(pct_change)*100:.0f}% — top-line stress")
                score += 2

    # Map score to label
    if score >= 8:
        radar_signal = "RED"
        label = "High-Alert Situation"
        desc = "Multiple converging stress signals — monitor closely or investigate for exposure"
    elif score >= 5:
        radar_signal = "YELLOW"
        label = "Potential Acquisition Target / Stress"
        desc = "Rising risk indicators, leadership or financial instability — worth tracking"
    elif score >= 2:
        radar_signal = "BLUE"
        label = "Strategic Watch"
        desc = "Some signals of interest — low urgency but worth monitoring"
    else:
        radar_signal = "GREEN"
        label = "Stable"
        desc = "No significant converging stress signals detected"

    return {
        "signal": radar_signal,
        "label": label,
        "description": desc,
        "signals": signals,
        "score": score,
    }


# ─── Claude AI Layer ──────────────────────────────────────────────────────────

async def _claude_tone(
    ticker: str, company: str, form_type: str,
    filing_current: dict, filing_prior: dict,
    diff: dict, escalations: list,
) -> Optional[str]:
    import os
    key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    try:
        from backend import anthropic_compat as anthropic  # type: ignore
        client = anthropic.Anthropic(api_key=key)

        added_sample = "\n".join(f"+ {s}" for s in diff["added"][:10])
        removed_sample = "\n".join(f"- {s}" for s in diff["removed"][:10])
        esc_sample = "\n".join(f"  [{e['type']}] {e['description']}" for e in escalations[:8])

        prompt = f"""You are a senior M&A analyst reviewing SEC filing language changes for {company} ({ticker}).

FILING COMPARISON:
  Type: {form_type}
  Prior:   {filing_prior['filing_date']} (period: {filing_prior['report_date']})
  Current: {filing_current['filing_date']} (period: {filing_current['report_date']})

LANGUAGE CHANGES IN RISK FACTORS:
  Sentences added ({diff['added_count']}):
{added_sample}

  Sentences removed ({diff['removed_count']}):
{removed_sample}

KEYWORD ESCALATIONS DETECTED:
{esc_sample or "  None detected"}

Write a concise 3-paragraph analyst briefing (max 250 words total):
1. Overall tone shift — is the company becoming more cautious, more aggressive, or stable?
2. The 2-3 most significant changes and what they signal operationally or financially
3. What a fiduciary advisor or M&A buyer should watch next

Be direct, use professional financial language. Do NOT include headers or bullet points — pure prose only."""

        msg = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as e:
        logger.warning("[EDGAR] Claude tone analysis failed: %s", e)
        return None


async def _claude_classify_8k(text: str, company: str, filing_date: str) -> Optional[dict]:
    """Use Claude to classify and summarize a single 8-K filing."""
    import os
    key = os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    try:
        from backend import anthropic_compat as anthropic  # type: ignore
        client = anthropic.Anthropic(api_key=key)
        snippet = text[:4000]

        prompt = f"""You are an investment analyst reviewing an 8-K SEC filing for {company} filed on {filing_date}.

Filing excerpt:
{snippet}

Respond in this EXACT JSON format (no other text):
{{
  "event_type": "M&A_ACTIVITY|CEO_CHANGE|LAWSUIT|MATERIAL_AGREEMENT|EARNINGS|DEBT_FINANCING|REGULATORY|DIVIDEND|OTHER",
  "impact": "HIGH|MEDIUM|LOW",
  "signal": "POSITIVE|NEGATIVE|NEUTRAL|STRATEGIC|WATCH|VARIES",
  "headline": "One-line description under 80 characters",
  "summary": "2 sentence analyst summary"
}}"""

        msg = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        import json
        raw = msg.content[0].text.strip()
        parsed = json.loads(raw)
        return parsed
    except Exception as e:
        logger.warning("[EDGAR] Claude 8-K classification failed: %s", e)
        return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/lang-change")
async def language_change(req: LangChangeRequest):
    """Original language change endpoint — Risk Factors diff."""
    ticker = req.ticker.upper().strip()
    form_type = req.form_type.upper().strip()

    if form_type not in ("10-K", "10-Q"):
        raise HTTPException(422, "form_type must be '10-K' or '10-Q'")

    cik, company_title = await _get_cik(ticker)
    filings = await _get_recent_filings(cik, form_type, count=2)
    filing_current, filing_prior = filings[0], filings[1]

    text_current, text_prior = await asyncio.gather(
        _fetch_filing_text(cik, filing_current),
        _fetch_filing_text(cik, filing_prior),
    )

    rf_current = _extract_risk_factors(text_current)
    rf_prior = _extract_risk_factors(text_prior)
    diff = _compute_diff_v2(rf_prior, rf_current)
    escalations = _detect_escalations(rf_prior, rf_current)
    risk_score = _compute_risk_score_breakdown(diff, escalations, rf_current, rf_prior)
    tone = await _claude_tone(ticker, company_title, form_type, filing_current, filing_prior, diff, escalations)

    return {
        "ticker": ticker,
        "company": company_title,
        "cik": cik,
        "form_type": form_type,
        "current_filing": filing_current,
        "prior_filing": filing_prior,
        "change_score": risk_score["total"],
        "risk_score": risk_score,
        "diff": diff,
        "escalations": escalations,
        "tone_analysis": tone,
    }


@router.post("/full-intel")
async def full_intelligence(req: FullIntelRequest):
    """
    Full intelligence report:
      - Language diff (Risk Factors)
      - Multi-factor risk score breakdown
      - 8-K event classification feed
      - XBRL financial time-series
      - Deal Radar signal
      - Claude analyst briefing
    """
    ticker = req.ticker.upper().strip()
    form_type = req.form_type.upper().strip()

    if form_type not in ("10-K", "10-Q"):
        raise HTTPException(422, "form_type must be '10-K' or '10-Q'")

    logger.info("[EDGAR full-intel] Starting %s %s", ticker, form_type)

    cik, company_title = await _get_cik(ticker)

    # Kick off all fetches concurrently
    filings_task = asyncio.create_task(_get_recent_filings(cik, form_type, count=2))
    xbrl_task = asyncio.create_task(_fetch_xbrl_financials(cik))

    filings = await filings_task
    filing_current, filing_prior = filings[0], filings[1]

    # Fetch filing texts + XBRL concurrently
    text_current, text_prior, xbrl = await asyncio.gather(
        _fetch_filing_text(cik, filing_current),
        _fetch_filing_text(cik, filing_prior),
        xbrl_task,
    )

    # Language analysis
    rf_current = _extract_risk_factors(text_current)
    rf_prior = _extract_risk_factors(text_prior)
    diff = _compute_diff_v2(rf_prior, rf_current)
    escalations = _detect_escalations(rf_prior, rf_current)
    risk_score = _compute_risk_score_breakdown(diff, escalations, rf_current, rf_prior)

    # Fetch 8-K events + Claude tone concurrently
    events_8k, tone = await asyncio.gather(
        _fetch_and_classify_8ks(cik, company_title, n=8),
        _claude_tone(ticker, company_title, form_type, filing_current, filing_prior, diff, escalations),
    )

    # Deal Radar
    deal_radar = _compute_deal_radar(risk_score, escalations, xbrl, events_8k)

    return {
        "ticker": ticker,
        "company": company_title,
        "cik": cik,
        "form_type": form_type,
        "current_filing": filing_current,
        "prior_filing": filing_prior,
        "risk_score": risk_score,
        "diff": diff,
        "escalations": escalations,
        "events_8k": events_8k,
        "xbrl": xbrl,
        "deal_radar": deal_radar,
        "tone_analysis": tone,
    }


@router.get("/8k-feed/{ticker}")
async def get_8k_feed(ticker: str):
    """Recent 8-K events for a given ticker, classified by event type."""
    ticker = ticker.upper().strip()
    cik, company_title = await _get_cik(ticker)
    events = await _fetch_and_classify_8ks(cik, company_title, n=10)
    return {
        "ticker": ticker,
        "company": company_title,
        "cik": cik,
        "events": events,
    }


@router.get("/xbrl/{ticker}")
async def get_xbrl(ticker: str):
    """XBRL financial time-series for a given ticker."""
    ticker = ticker.upper().strip()
    cik, company_title = await _get_cik(ticker)
    xbrl = await _fetch_xbrl_financials(cik)
    return {
        "ticker": ticker,
        "company": company_title,
        "cik": cik,
        "financials": xbrl,
    }


@router.post("/watchlist/scan")
async def watchlist_scan(req: WatchlistScanRequest):
    """
    Filing Watchtower — scan multiple tickers for latest filings.
    Returns most recent filing metadata per company.
    """
    if len(req.tickers) > 10:
        raise HTTPException(422, "Maximum 10 tickers per scan")

    await _load_tickers()

    async def _scan_one(raw_ticker: str) -> dict:
        t = raw_ticker.upper().strip()
        try:
            cik, company = await _get_cik(t)
            filings = await _get_all_recent_filings(cik, ["10-K", "10-Q", "8-K", "8-K/A"], count=3)
            latest = filings[0] if filings else None
            return {
                "ticker": t,
                "company": company,
                "cik": cik,
                "latest_filing": latest,
                "status": "ok",
            }
        except Exception as e:
            return {"ticker": t, "status": "error", "error": str(e)}

    results = await asyncio.gather(*[_scan_one(t) for t in req.tickers])
    return {"results": list(results), "count": len(results)}
