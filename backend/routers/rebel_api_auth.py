"""
Rebel IQ Intelligence API (v1) — authentication, rate limiting, and middleware.

Implements §3 (Authentication) and §6 (Rate Limits) of the API Design Document:
  - X-Kincaid-Api-Key   → identifies the tenant; matched against two
                           simultaneously-valid keys for zero-downtime rotation.
  - X-Kincaid-Timestamp → Unix seconds; requests older than 300s are rejected
                           (replay protection).
  - X-Kincaid-Signature → HMAC-SHA256(signing_secret, "{timestamp}.{body}")
                           required on POST/PATCH, optional on GET.

Plus an ASGI middleware that stamps every response with X-Kincaid-Request-Id and
the X-RateLimit-* headers, enforcing per-tenant token buckets.
"""
from __future__ import annotations

import time
import hmac
import hashlib
from collections import defaultdict
from threading import Lock
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from backend.database import SessionLocal
from backend import models
from backend.routers.rebel_common import (
    ProblemDetail, problem_response, get_request_id, new_request_id,
    ERR_UNAUTHORIZED, ERR_VALIDATION, ERR_RATE_LIMITED,
)

TIMESTAMP_TOLERANCE_SECONDS = 300

# Default per-minute limits used to stamp X-RateLimit-* headers on responses that
# never reached the authenticated rate-check path (e.g. auth failures). These
# mirror the model defaults (RebelTenant.rate_limit_get / rate_limit_post).
DEFAULT_RATE_LIMIT_GET = 300
DEFAULT_RATE_LIMIT_POST = 60

# ── Version lifecycle / deprecation registry (§5) ─────────────────────────────
# Map a route path (as seen by the /v1 sub-app, i.e. without the /v1 prefix) to
# its sunset date (ISO 8601). Deprecated endpoints get a `Deprecation: true` and
# `Sunset: <date>` header so Rebel IQ is warned before a breaking change lands.
# Empty today — no endpoint is deprecated in v1 — but the mechanism is wired so a
# future deprecation is a one-line change here.
DEPRECATED_ROUTES: dict[str, str] = {}


# ── Per-tenant sliding-window rate limiter ────────────────────────────────────
# { f"{tenant_id}:{bucket}": [timestamps...] }
_rate_store: dict[str, list[float]] = defaultdict(list)
_rate_lock = Lock()


def _check_rate(tenant_id: str, bucket: str, limit_per_min: int) -> tuple[int, int, int]:
    """
    Sliding 60-second window. Returns (limit, remaining, reset_epoch).
    Raises ProblemDetail(429) when the limit is exhausted.
    """
    key = f"{tenant_id}:{bucket}"
    now = time.time()
    window = 60.0
    with _rate_lock:
        hits = [t for t in _rate_store[key] if now - t < window]
        reset = int(now + window) if not hits else int(hits[0] + window)
        if len(hits) >= limit_per_min:
            retry_after = max(1, reset - int(now))
            _rate_store[key] = hits
            raise ProblemDetail(
                429, ERR_RATE_LIMITED,
                f"Rate limit of {limit_per_min} requests/minute exceeded for this tenant.",
                extra={"retryable": True},
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(limit_per_min),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset),
                },
            )
        hits.append(now)
        _rate_store[key] = hits
        remaining = max(0, limit_per_min - len(hits))
        return limit_per_min, remaining, reset


def _lookup_tenant(db: Session, api_key: str) -> Optional[models.RebelTenant]:
    if not api_key:
        return None
    t = (
        db.query(models.RebelTenant)
        .filter(models.RebelTenant.api_key_primary == api_key)
        .first()
    )
    if t and t.api_key_primary_active:
        return t
    t2 = (
        db.query(models.RebelTenant)
        .filter(models.RebelTenant.api_key_secondary == api_key)
        .first()
    )
    if t2 and t2.api_key_secondary_active:
        return t2
    return None


def _compute_signature(signing_secret: str, timestamp: str, body: bytes) -> str:
    payload = f"{timestamp}.".encode("utf-8") + (body or b"")
    return hmac.new(signing_secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


async def authenticate(request: Request) -> models.RebelTenant:
    """
    FastAPI dependency. Validates API key (always), and timestamp + signature
    (on POST/PATCH). Enforces the per-tenant rate limit and records the
    rate-limit headers on request.state for the middleware to surface.
    Returns the authenticated RebelTenant.
    """
    api_key = request.headers.get("X-Kincaid-Api-Key", "")
    db: Session = SessionLocal()
    try:
        tenant = _lookup_tenant(db, api_key)
        if tenant is None:
            raise ProblemDetail(401, ERR_UNAUTHORIZED, "Missing or invalid API key.")
        if tenant.status != "active":
            raise ProblemDetail(403, ERR_UNAUTHORIZED, "Tenant is not active.")

        method = request.method.upper()
        is_write = method in ("POST", "PATCH", "PUT", "DELETE")

        # ── Timestamp + signature (required for writes) ──────────────────────
        timestamp = request.headers.get("X-Kincaid-Timestamp", "")
        signature = request.headers.get("X-Kincaid-Signature", "")

        if is_write or timestamp or signature:
            if not timestamp:
                raise ProblemDetail(
                    401, ERR_UNAUTHORIZED,
                    "X-Kincaid-Timestamp header is required for this request.",
                )
            try:
                ts_val = int(float(timestamp))
            except (ValueError, TypeError):
                raise ProblemDetail(
                    400, ERR_VALIDATION,
                    "X-Kincaid-Timestamp must be a Unix timestamp in seconds.",
                )
            drift = abs(time.time() - ts_val)
            if drift > TIMESTAMP_TOLERANCE_SECONDS:
                raise ProblemDetail(
                    401, ERR_UNAUTHORIZED,
                    f"Request timestamp is outside the {TIMESTAMP_TOLERANCE_SECONDS}s "
                    "tolerance window (possible replay).",
                )
            if is_write:
                if not signature:
                    raise ProblemDetail(
                        401, ERR_UNAUTHORIZED,
                        "X-Kincaid-Signature header is required for POST/PATCH requests.",
                    )
                body = await request.body()
                expected = _compute_signature(tenant.signing_secret, timestamp, body)
                if not hmac.compare_digest(expected, signature):
                    raise ProblemDetail(
                        401, ERR_UNAUTHORIZED,
                        "HMAC signature verification failed.",
                    )
            elif signature:
                # Optional GET signature — verify if supplied.
                body = await request.body()
                expected = _compute_signature(tenant.signing_secret, timestamp, body)
                if not hmac.compare_digest(expected, signature):
                    raise ProblemDetail(
                        401, ERR_UNAUTHORIZED,
                        "HMAC signature verification failed.",
                    )

        # ── Rate limit (per tenant, per bucket) ──────────────────────────────
        bucket = "post" if is_write else "get"
        limit = tenant.rate_limit_post if is_write else tenant.rate_limit_get
        rl_limit, rl_remaining, rl_reset = _check_rate(tenant.id, bucket, limit)
        request.state.rate_limit_headers = {
            "X-RateLimit-Limit": str(rl_limit),
            "X-RateLimit-Remaining": str(rl_remaining),
            "X-RateLimit-Reset": str(rl_reset),
        }
        request.state.tenant_id = tenant.id
        return tenant
    finally:
        db.close()


class RebelApiMiddleware(BaseHTTPMiddleware):
    """
    Stamps X-Kincaid-Request-Id on every /v1 response, and copies the
    per-tenant rate-limit headers that `authenticate` recorded on request.state.
    """

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Kincaid-Request-Id") or new_request_id()
        request.state.kincaid_request_id = rid
        response = await call_next(request)
        response.headers["X-Kincaid-Request-Id"] = rid

        # Rate-limit headers on EVERY response (§6). If the request reached the
        # authenticated rate-check path, use the per-tenant values it recorded;
        # otherwise (auth/validation failures, unknown routes) stamp the default
        # limits so the contract holds for all /v1 responses.
        rl = getattr(request.state, "rate_limit_headers", None)
        if not rl:
            is_write = request.method.upper() in ("POST", "PATCH", "PUT", "DELETE")
            default_limit = DEFAULT_RATE_LIMIT_POST if is_write else DEFAULT_RATE_LIMIT_GET
            rl = {
                "X-RateLimit-Limit": str(default_limit),
                "X-RateLimit-Remaining": str(default_limit),
                "X-RateLimit-Reset": str(int(time.time()) + 60),
            }
        for k, v in rl.items():
            response.headers.setdefault(k, v)

        # Deprecation signaling (§5): warn Rebel IQ when a route is sunsetting.
        sunset = DEPRECATED_ROUTES.get(request.scope.get("path", ""))
        if sunset:
            response.headers.setdefault("Deprecation", "true")
            response.headers.setdefault("Sunset", sunset)

        return response
