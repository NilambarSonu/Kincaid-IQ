"""
Rebel IQ Intelligence API (v1) — sub-application assembly.

Builds a standalone FastAPI app (mounted at /v1 by main.py) so the machine-to-
machine intelligence API is cleanly separated from the human-facing /api surface:
its own RFC 9457 problem+json exception handlers, its own middleware (request-id
+ rate-limit headers), and its own router set.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.routers.rebel_api_auth import RebelApiMiddleware
from backend.routers.rebel_common import (
    ProblemDetail, problem_response,
    ERR_VALIDATION, ERR_NOT_FOUND, ERR_INTERNAL,
)
from backend.routers import (
    rebel_plans, rebel_ingestion, rebel_intelligence, rebel_jobs,
)

log = logging.getLogger("rebel_api")


def create_v1_app() -> FastAPI:
    app = FastAPI(
        title="Kincaid Health Intelligence API",
        version="1.0.0",
        description="Machine-to-machine intelligence API for Rebel IQ.",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    app.add_middleware(RebelApiMiddleware)

    @app.exception_handler(ProblemDetail)
    async def _problem_handler(request: Request, exc: ProblemDetail):
        return problem_response(
            request, exc.status_code, exc.type_uri, exc.detail,
            title=exc.title, extra=exc.extra, headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            loc = ".".join(str(p) for p in e.get("loc", []) if p != "body")
            errors.append({"field": loc, "message": e.get("msg")})
        return problem_response(
            request, 400, ERR_VALIDATION,
            "Request body or query parameters failed validation.",
            extra={"errors": errors},
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_handler(request: Request, exc: StarletteHTTPException):
        type_uri = ERR_NOT_FOUND if exc.status_code == 404 else ERR_INTERNAL
        return problem_response(
            request, exc.status_code, type_uri, str(exc.detail or "Error"),
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(request: Request, exc: Exception):
        log.exception("Unhandled error in /v1 API")
        return problem_response(
            request, 500, ERR_INTERNAL,
            "An unexpected error occurred while processing the request.",
        )

    app.include_router(rebel_plans.router)
    app.include_router(rebel_ingestion.router)
    app.include_router(rebel_intelligence.router)
    app.include_router(rebel_jobs.router)
    return app


v1_app = create_v1_app()
