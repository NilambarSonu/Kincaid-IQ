"""
Rebel IQ Intelligence API (v1) — shared helpers.

Centralizes: RFC 9457 problem+json construction, ISO-8601 time formatting,
standard error type URIs (§7), request-id generation, and the canonical
JSON-success response used across the /v1 sub-application.
"""
from __future__ import annotations

import uuid
import json
from datetime import datetime, timezone, date
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse


# ── Standard error type URIs (§7 of the API Design Document) ──────────────────
ERROR_BASE = "https://api.kincaidiq.com/errors"

ERR_VALIDATION    = f"{ERROR_BASE}/validation"
ERR_UNAUTHORIZED  = f"{ERROR_BASE}/unauthorized"
ERR_FORBIDDEN     = f"{ERROR_BASE}/forbidden"
ERR_NOT_FOUND     = f"{ERROR_BASE}/not-found"
ERR_CONFLICT      = f"{ERROR_BASE}/conflict"
ERR_RATE_LIMITED  = f"{ERROR_BASE}/rate-limited"
ERR_PLAN_NOT_READY = f"{ERROR_BASE}/plan-not-ready"
ERR_INTERNAL      = f"{ERROR_BASE}/internal"
ERR_UNAVAILABLE   = f"{ERROR_BASE}/unavailable"
ERR_INGESTION_FAILED = f"{ERROR_BASE}/ingestion-failed"

_TITLES = {
    ERR_VALIDATION:    "Validation Error",
    ERR_UNAUTHORIZED:  "Unauthorized",
    ERR_FORBIDDEN:     "Forbidden",
    ERR_NOT_FOUND:     "Not Found",
    ERR_CONFLICT:      "Conflict",
    ERR_RATE_LIMITED:  "Rate Limit Exceeded",
    ERR_PLAN_NOT_READY: "Plan Not Ready",
    ERR_INTERNAL:      "Internal Server Error",
    ERR_UNAVAILABLE:   "Service Unavailable",
    ERR_INGESTION_FAILED: "Ingestion Processing Failed",
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime | date]) -> Optional[str]:
    """Serialize a datetime/date as an ISO-8601 string with a trailing Z for UTC."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return dt.isoformat()


def new_request_id() -> str:
    return "req_" + uuid.uuid4().hex


def get_request_id(request: Request) -> str:
    rid = getattr(request.state, "kincaid_request_id", None)
    if not rid:
        rid = new_request_id()
        try:
            request.state.kincaid_request_id = rid
        except Exception:
            pass
    return rid


class ProblemDetail(Exception):
    """
    Raise anywhere inside the /v1 sub-app to emit an RFC 9457 problem+json
    response. The sub-app's exception handler renders it with the correct
    Content-Type and the X-Kincaid-Request-Id correlation header.
    """

    def __init__(
        self,
        status_code: int,
        type_uri: str,
        detail: str,
        *,
        title: Optional[str] = None,
        extra: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ):
        self.status_code = status_code
        self.type_uri = type_uri
        self.detail = detail
        self.title = title or _TITLES.get(type_uri, "Error")
        self.extra = extra or {}
        self.headers = headers or {}
        super().__init__(detail)


def problem_response(
    request: Request,
    status_code: int,
    type_uri: str,
    detail: str,
    *,
    title: Optional[str] = None,
    extra: Optional[dict[str, Any]] = None,
    headers: Optional[dict[str, str]] = None,
) -> JSONResponse:
    rid = get_request_id(request)
    body: dict[str, Any] = {
        "type": type_uri,
        "title": title or _TITLES.get(type_uri, "Error"),
        "status": status_code,
        "detail": detail,
        "instance": request.url.path,
        "kincaidRequestId": rid,
    }
    if extra:
        body.update(extra)
    resp_headers = {"X-Kincaid-Request-Id": rid}
    if headers:
        resp_headers.update(headers)
    return JSONResponse(
        status_code=status_code,
        content=body,
        media_type="application/problem+json",
        headers=resp_headers,
    )


def success(
    request: Request,
    payload: dict[str, Any],
    *,
    status_code: int = 200,
    data_as_of: Optional[datetime] = None,
    extra_headers: Optional[dict[str, str]] = None,
) -> JSONResponse:
    """Standard success response — attaches request-id and (optionally) data-as-of headers."""
    rid = get_request_id(request)
    headers = {"X-Kincaid-Request-Id": rid}
    if data_as_of is not None:
        headers["X-Kincaid-Data-As-Of"] = iso(data_as_of)
    if extra_headers:
        headers.update(extra_headers)
    return JSONResponse(status_code=status_code, content=payload, headers=headers)
