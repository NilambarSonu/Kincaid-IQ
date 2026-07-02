---
name: Live-feed ingestion security
description: Non-obvious security constraints when persisting external-API pull results as provenance rows.
---

# Live-feed / external-API provenance security

Two constraints when a feature pulls external vendor/gov APIs and stores each pull as an audit/provenance row (e.g. IngestionRun), then surfaces it to the UI.

## 1. Redact API keys from error strings before persisting or returning
`httpx.HTTPStatusError` (and similar) embed the **full request URL in the exception message**, including any `?api_key=...` query param (SAM.gov, many gov APIs pass the key in the query string). If you store `str(e)` in an audit row's error/notes field or return it in an API response, the secret leaks into the DB and over the wire.

**Why:** discovered when SAM.gov 404'd and the raw error (with the live key) was written to the provenance row and returned by the refresh endpoint.

**How to apply:** run every externally-derived error message through a redactor before persist/return — replace the known key value AND regex-strip `api_key=[^&\s'"]+`. Prefer keys in headers over query params where the API allows it.

## 2. Frontend route-protection is NOT backend authorization
A page gated by a client-side `ProtectedRoute` does nothing to protect its backend endpoints — they are directly callable. Any new endpoint that exposes internal telemetry, or triggers work (external ingestion, mutations), needs a server-side auth dependency (`Depends(get_current_user)`), not just a protected page.

**Why:** a batch of new `/api/live-feeds/*` endpoints (internal usage telemetry + an ingestion-trigger POST) shipped auth-free because the page was behind ProtectedRoute; flagged as blocking in review.

**How to apply:** default new data/action routers to authenticated. Only leave a route public when it proxies genuinely public data with no side effects (the pattern the pre-existing `/api/feeds` gov proxies follow).
