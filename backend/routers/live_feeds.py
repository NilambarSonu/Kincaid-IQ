"""
Live Feeds — control plane for the platform's real-time data feeds.

Complements the on-demand `/api/feeds` government proxies and the market
router by adding the *live* layer the platform was missing:

  1. Market ticks            → SSE  (served by backend/routers/market.py:/api/market/stream)
  2. Firmographic & intent   → polling (served by /api/account-intel/*)
  3. Usage telemetry         → polling (this router: /api/live-feeds/usage)
  4. Government / regulatory → scheduled ingestion (this router + APScheduler)

Every scheduled pull writes an `IngestionRun` row so each number keeps a
receipt (provenance), consistent with the platform's evidence doctrine.
"""

import os
import re
import json
import uuid
import logging
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from backend.database import SessionLocal
from backend import models
from backend.auth import get_current_user

log = logging.getLogger("kincaid.live_feeds")
router = APIRouter(prefix="/api/live-feeds", tags=["live-feeds"])

_SAM_KEY = os.environ.get("SAM_GOV_API_KEY") or os.environ.get("SAM_API_KEY", "")
_INGEST_SOURCE_PREFIX = "live"
_UA = {"User-Agent": "Kincaid RMC research@kincaidrmc.com", "Accept": "application/json"}


# ─── Provenance writer ────────────────────────────────────────────────────────

def _redact(text: str) -> str:
    """Strip any API key material from a message before it is stored/returned."""
    if not text:
        return text
    t = str(text)
    if _SAM_KEY:
        t = t.replace(_SAM_KEY, "***")
    return re.sub(r"(api_key=)[^&\s'\"]+", r"\1***", t)


def _write_run(db, source_key: str, label: str, records: int,
               status: str, highlights: list | None = None, note: str = "") -> dict:
    """Persist an IngestionRun row for a single feed pull."""
    note = _redact(note)
    payload = {"highlights": (highlights or [])[:5]}
    if note:
        payload["note"] = note
    run = models.IngestionRun(
        ingestion_id=uuid.uuid4().hex,
        source_type=f"{_INGEST_SOURCE_PREFIX}:{source_key}",
        source_file=label,
        record_count=records,
        success_count=records if status == "success" else 0,
        skip_count=0,
        error_count=1 if status == "error" else 0,
        status=status,
        errors_json=json.dumps(payload),
        ingested_at=datetime.utcnow(),
    )
    db.add(run)
    return {
        "source": source_key,
        "label": label,
        "records": records,
        "status": status,
        "highlights": payload["highlights"],
        "note": note,
    }


# ─── The scheduled ingest (also callable on-demand) ───────────────────────────

def _pull_sec_edgar() -> tuple[int, str, list, str]:
    """SEC EDGAR full-text — recent PBM-related filings (no key)."""
    try:
        r = httpx.get(
            "https://efts.sec.gov/LATEST/search-index",
            params={"q": '"pharmacy benefit manager"', "forms": "8-K,10-K,10-Q"},
            headers=_UA, timeout=12.0, follow_redirects=True,
        )
        r.raise_for_status()
        hits = (r.json().get("hits", {}) or {}).get("hits", []) or []
        highlights = [
            {
                "company": (h.get("_source", {}) or {}).get("entity_name", ""),
                "form": (h.get("_source", {}) or {}).get("file_type", ""),
                "filed": (h.get("_source", {}) or {}).get("file_date", ""),
            }
            for h in hits[:5]
        ]
        return len(hits), "success", highlights, ""
    except Exception as e:
        return 0, "error", [], str(e)[:160]


def _pull_usaspending() -> tuple[int, str, list, str]:
    """USAspending — recent federal healthcare-benefit awards (no key)."""
    payload = {
        "filters": {
            "keywords": ["pharmacy benefit"],
            "time_period": [{"start_date": "2023-01-01", "end_date": "2025-12-31"}],
            "award_type_codes": ["A", "B", "C", "D"],
        },
        "fields": ["Recipient Name", "Award Amount", "Awarding Agency", "Start Date"],
        "page": 1, "limit": 10, "sort": "Award Amount", "order": "desc", "subawards": False,
    }
    try:
        r = httpx.post(
            "https://api.usaspending.gov/api/v2/search/spending_by_award/",
            json=payload,
            headers={"Content-Type": "application/json", **_UA}, timeout=12.0,
        )
        r.raise_for_status()
        data = r.json()
        results = data.get("results", []) or []
        total = (data.get("page_metadata", {}) or {}).get("total", len(results))
        highlights = [
            {
                "recipient": x.get("Recipient Name", ""),
                "amount": x.get("Award Amount", 0),
                "agency": x.get("Awarding Agency", ""),
            }
            for x in results[:5]
        ]
        return int(total or 0), "success", highlights, ""
    except Exception as e:
        return 0, "error", [], str(e)[:160]


def _pull_sam() -> tuple[int, str, list, str]:
    """SAM.gov — federal contract opportunities (needs SAM_GOV_API_KEY)."""
    if not _SAM_KEY:
        return 0, "skipped", [], "SAM_GOV_API_KEY not set"
    try:
        today = datetime.utcnow()
        posted_from = (today - timedelta(days=364)).strftime("%m/%d/%Y")
        posted_to = today.strftime("%m/%d/%Y")
        r = httpx.get(
            "https://api.sam.gov/opportunities/v2/search",
            params={
                "api_key": _SAM_KEY, "keywords": "pharmacy benefit",
                "limit": 10, "postedFrom": posted_from, "postedTo": posted_to,
            },
            headers=_UA, timeout=12.0, follow_redirects=True,
        )
        r.raise_for_status()
        data = r.json()
        opps = data.get("opportunitiesData", []) or []
        highlights = [
            {
                "title": o.get("title", ""),
                "agency": o.get("departmentName", ""),
                "deadline": o.get("responseDeadLine", ""),
            }
            for o in opps[:5]
        ]
        return int(data.get("totalRecords", len(opps)) or 0), "success", highlights, ""
    except Exception as e:
        return 0, "error", [], str(e)[:160]


def run_regulatory_ingest() -> dict:
    """
    Pull the government/regulatory feeds and persist an IngestionRun per source.
    Runs on a schedule (APScheduler) and on-demand via POST /regulatory/refresh.
    Degrades gracefully — a failing source is recorded, never fatal.
    """
    db = SessionLocal()
    results = []
    try:
        for key, label, fn in [
            ("sec_edgar", "SEC EDGAR — PBM filings", _pull_sec_edgar),
            ("usaspending", "USAspending — pharmacy benefit awards", _pull_usaspending),
            ("sam_gov", "SAM.gov — PBM opportunities", _pull_sam),
        ]:
            try:
                count, status, highlights, note = fn()
            except Exception as e:  # pragma: no cover - defensive
                count, status, highlights, note = 0, "error", [], str(e)[:160]
            results.append(_write_run(db, key, label, count, status, highlights, note))
        db.commit()
        ok = sum(1 for r in results if r["status"] == "success")
        log.info("[Live Feeds] Regulatory ingest complete — %d/%d sources succeeded", ok, len(results))
    except Exception as e:
        db.rollback()
        log.error("[Live Feeds] Regulatory ingest failed: %s", e)
    finally:
        db.close()
    return {"ran_at": datetime.utcnow().isoformat() + "Z", "sources": results}


# ─── Endpoints ────────────────────────────────────────────────────────────────

def _latest_regulatory_runs(db, limit_per_source: int = 1) -> list[dict]:
    """Latest IngestionRun per live:* source."""
    try:
        rows = (
            db.query(models.IngestionRun)
            .filter(models.IngestionRun.source_type.like(f"{_INGEST_SOURCE_PREFIX}:%"))
            .order_by(models.IngestionRun.ingested_at.desc())
            .limit(60)
            .all()
        )
    except Exception:
        return []
    seen: dict[str, int] = {}
    out: list[dict] = []
    for r in rows:
        key = r.source_type
        seen[key] = seen.get(key, 0) + 1
        if seen[key] > limit_per_source:
            continue
        try:
            parsed = json.loads(r.errors_json or "{}")
        except Exception:
            parsed = {}
        out.append({
            "source": (r.source_type or "").split(":", 1)[-1],
            "label": r.source_file,
            "records": r.record_count or 0,
            "status": r.status,
            "highlights": parsed.get("highlights", []),
            "note": parsed.get("note", ""),
            "ran_at": (r.ingested_at.isoformat() + "Z") if r.ingested_at else None,
        })
    return out


@router.get("/registry")
def registry(current_user=Depends(get_current_user)):
    """The four live feeds and their current status — powers the control panel."""
    firmo_keys = {
        "apollo": bool(os.environ.get("APOLLO_API_KEY")),
        "crunchbase": bool(os.environ.get("CRUNCHBASE_API_KEY")),
        "hunter": bool(os.environ.get("HUNTER_API_KEY")),
        "theirstack": bool(os.environ.get("THEIRSTACK_API_KEY")),
    }
    db = SessionLocal()
    try:
        regulatory = _latest_regulatory_runs(db)
    finally:
        db.close()

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "feeds": [
            {
                "id": "market",
                "label": "Market Ticks",
                "transport": "SSE",
                "endpoint": "/api/market/stream",
                "live": True,
                "cadence": "5s push",
                "detail": "Real-time equity, rate, gold, crypto and volatility quotes streamed over Server-Sent Events.",
            },
            {
                "id": "firmographic",
                "label": "Firmographic & Intent",
                "transport": "polling",
                "endpoint": "/api/account-intel/signals/{domain}",
                "live": any(firmo_keys.values()),
                "cadence": "on lookup / 60s",
                "connected": firmo_keys,
                "detail": "Buying-intent, hiring-velocity and funding signals from Apollo, Crunchbase and TheirStack, keyed by company domain.",
            },
            {
                "id": "usage",
                "label": "Usage Telemetry",
                "transport": "polling",
                "endpoint": "/api/live-feeds/usage",
                "live": True,
                "cadence": "15s",
                "detail": "Live platform activity — ingestion runs, intelligence events, AI generations and tenant usage.",
            },
            {
                "id": "regulatory",
                "label": "Government / Regulatory",
                "transport": "scheduled",
                "endpoint": "/api/live-feeds/regulatory/latest",
                "live": True,
                "cadence": "every 30m",
                "detail": "Scheduled ingestion of SEC EDGAR, USAspending and SAM.gov, each pull recorded with a provenance receipt.",
                "sources": regulatory,
            },
        ],
    }


@router.get("/usage")
def usage_telemetry(current_user=Depends(get_current_user)):
    """Live internal telemetry aggregated from the platform's own tables."""
    db = SessionLocal()

    def _count(model):
        try:
            return db.query(model).count()
        except Exception:
            return 0

    try:
        counts = {
            "ingestion_runs": _count(models.IngestionRun),
            "intelligence_events": _count(models.IntelligenceEvent),
            "ai_generations": _count(getattr(models, "AiOutputHistory", None)) if hasattr(models, "AiOutputHistory") else 0,
            "usage_records": _count(getattr(models, "UsageRecord", None)) if hasattr(models, "UsageRecord") else 0,
        }

        recent_events = []
        try:
            for ev in (
                db.query(models.IntelligenceEvent)
                .order_by(models.IntelligenceEvent.processed_at.desc())
                .limit(6)
                .all()
            ):
                recent_events.append({
                    "employer_id": ev.employer_id,
                    "event_type": ev.event_type,
                    "severity": ev.severity,
                    "summary": (ev.summary or "")[:140],
                    "impact_dollars": float(ev.impact_dollars or 0),
                    "at": (ev.processed_at.isoformat() + "Z") if ev.processed_at else None,
                })
        except Exception:
            pass

        recent_ai = []
        if hasattr(models, "AiOutputHistory"):
            try:
                for a in (
                    db.query(models.AiOutputHistory)
                    .order_by(models.AiOutputHistory.generated_at.desc())
                    .limit(6)
                    .all()
                ):
                    recent_ai.append({
                        "tool": a.tool,
                        "label": a.label,
                        "entity_id": a.entity_id,
                        "at": (a.generated_at.isoformat() + "Z") if a.generated_at else None,
                    })
            except Exception:
                pass

        return {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "counts": counts,
            "recent_events": recent_events,
            "recent_ai": recent_ai,
        }
    finally:
        db.close()


@router.get("/regulatory/latest")
def regulatory_latest(current_user=Depends(get_current_user)):
    """Most recent scheduled regulatory ingest per source, with provenance."""
    db = SessionLocal()
    try:
        return {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "sources": _latest_regulatory_runs(db),
        }
    finally:
        db.close()


@router.post("/regulatory/refresh")
async def regulatory_refresh(current_user=Depends(get_current_user)):
    """Run the regulatory ingest now (same job the scheduler runs every 30m)."""
    return await run_in_threadpool(run_regulatory_ingest)
