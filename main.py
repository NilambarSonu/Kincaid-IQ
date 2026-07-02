import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("kincaid")

from backend.config import settings
from backend.database import create_tables
from backend.routers import auth, logs, ai, github_router
from backend.routers.kiq_verify import router as kiq_verify_router
from backend.routers import market, watchlist, vault
from backend.routers import sec_data
from backend.routers import feeds
from backend.routers import live_feeds
from backend.routers import governance
from backend.routers.claims import router as claims_router
from backend.routers.policy import router as policy_router
from backend.routers.lineage import router as lineage_router
from backend.routers.receipts import router as receipts_router
from backend.routers.executive import router as executive_router
from backend.routers.dossier import router as dossier_router
from backend.routers.narrative import router as narrative_router
from backend.routers.kpi_library import router as kpi_library_router
from backend.routers.pipeline import router as pipeline_router
from backend.routers.provenance import router as provenance_router
from backend.routers.export_router import router as export_router
from backend.routers.intelligence import router as intelligence_router
from backend.routers.broker_commissions import router as broker_commissions_router, seed_broker_commissions
from backend.routers.admin import router as admin_router
from backend.routers.form_5500_search import router as f5500_router, ensure_tables as ensure_f5500_tables
from backend.routers.evidence import router as evidence_router
from backend.routers.claims_gov import router as claims_gov_router
from backend.routers.receipts_gov import router as receipts_gov_router
from backend.routers.executive_gov import router as executive_gov_router
from backend.routers.export_gov import router as export_gov_router
from backend.routers.policy_gov import router as policy_gov_router
from backend.routers.orgs import router as orgs_router
from backend.routers.billing import router as billing_router
from backend.routers.saas_fiduciary import router as saas_fiduciary_router
from backend.routers.saas_broker import router as saas_broker_router
from backend.routers.cross_intel import router as cross_intel_router
from backend.routers.commit_engine import router as commit_engine_router
from backend.routers.ma_diligence import router as ma_diligence_router
from backend.routers.actuarial import router as actuarial_router
from backend.routers.saas_stoploss import router as saas_stoploss_router
from backend.routers.saas_network import router as saas_network_router
from backend.routers.fiduciary_iq import router as fiduciary_iq_router
from backend.routers.stewardship import router as stewardship_router
from backend.routers.employer_health_score import router as employer_health_score_router
from backend.routers.claims_recovery import router as claims_recovery_router
from backend.routers.hios import router as hios_router
from backend.routers.email_reports import router as email_reports_router
from backend.routers.permissions import router as permissions_router
from backend.routers.mckinsey_copilot import router as mckinsey_router
from backend.routers.sms import router as sms_router
from backend.routers.documents import router as documents_router
from backend.routers.contact_intelligence import router as contact_intel_router
from backend.routers.crm_sync import router as crm_sync_router
from backend.routers.edgar_lang import router as edgar_lang_router
from backend.routers.sales_iq import router as sales_iq_router
from backend.routers.filing_intel import router as filing_intel_router
from backend.routers.filing_alerts import router as filing_alerts_router
from backend.routers.account_intel import router as account_intel_router
from backend.routers.federal_intel import router as federal_intel_router
from backend.routers.cms_intelligence import router as cms_intel_router
from backend.routers.market_intelligence import router as market_intel_router
from backend.routers.kiq_engine import router as kiq_engine_router
from backend.routers.sales_os import router as sales_os_router
from backend.routers.ingest import router as ingest_router
from backend.routers.ai_history import router as ai_history_router
from backend.routers.share_links import router as share_links_router
from backend.routers.company360 import router as company360_router

from compliance_engine.routers.controls import router as ce_controls_router
from compliance_engine.routers.evidence import router as ce_evidence_router
from compliance_engine.routers.audit import router as ce_audit_router
from compliance_engine.routers.assets import router as ce_assets_router
from compliance_engine.routers.findings import router as ce_findings_router
from compliance_engine.routers.reports import router as ce_reports_router
from compliance_engine.scheduler import start_scheduler, stop_scheduler

IS_PRODUCTION = os.environ.get("REPLIT_DEPLOYMENT", "") == "1"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["X-Download-Options"] = "noopen"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        if IS_PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "font-src 'self' data:; "
                "connect-src 'self' https:;"
            )
        return response


def _load_persisted_rfp_scoring():
    """Re-apply the active RFP scoring config (env override > persisted admin
    override file > defaults) on boot and notify listeners so the derived scorer
    constants reflect the last-saved tuning. The config is already loaded at
    import time; this re-runs it once all modules (and their listeners) are
    registered."""
    try:
        from backend import config as app_config
        # Tables exist by now, so let the resolver consult the Postgres-backed
        # admin override (survives restarts on ephemeral-filesystem hosts).
        app_config.enable_db_override()
        app_config._apply_in_place(app_config._load_rfp_scoring())
        if app_config.get_rfp_scoring_override() is not None:
            print("[Kincaid IQ] RFP scoring override applied (DB/admin file) ✓")
    except Exception as e:
        logger.warning(f"[Kincaid IQ] Could not load persisted RFP scoring override: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    ensure_f5500_tables()
    ensure_account_intel_columns()
    ensure_rfp_opportunity_columns()
    _load_persisted_rfp_scoring()
    # Create compliance engine tables
    from backend.database import Base, engine
    from compliance_engine.models import (
        ComplianceControl, ControlCategory, ComplianceEvidence,
        ComplianceAsset, ComplianceFinding, ComplianceAudit, AuditControlResult,
    )
    Base.metadata.create_all(bind=engine, checkfirst=True)
    start_scheduler()
    print("[Kincaid IQ] Database ready ✓")
    from backend.database import SessionLocal
    from backend import models
    with SessionLocal() as _db:
        from backend import kiq_verify as _kiq_verify
        _kiq_verify.seed_demo(_db)
        print("[Kincaid IQ] Kincaid IQ Verify ledger ready ✓")
        seeded = seed_broker_commissions(_db)
        if seeded:
            print(f"[Kincaid IQ] Broker commissions seeded: {seeded} records ✓")
        # Seed Eric Dreyfus — Rx Defense IQ, can_view + can_edit
        eric = _db.query(models.User).filter(models.User.username == "eric.dreyfus").first()
        if eric:
            existing = (
                _db.query(models.UserPermission)
                .filter(
                    models.UserPermission.user_id == eric.id,
                    models.UserPermission.module == "rx-defense",
                )
                .first()
            )
            if not existing:
                _db.add(models.UserPermission(
                    user_id    = eric.id,
                    module     = "rx-defense",
                    can_view   = True,
                    can_edit   = True,
                    granted_by = "system",
                ))
                _db.commit()
                print("[Kincaid IQ] Eric Dreyfus → rx-defense (view + edit) granted ✓")
    yield
    stop_scheduler()


app = FastAPI(
    title="Kincaid IQ",
    description="Kincaid RMC Private Banking Intelligence Platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-KIQ-Role"],
)

app.include_router(auth.router)
app.include_router(kiq_verify_router)
app.include_router(logs.router)
app.include_router(ai.router)
app.include_router(github_router.router)
app.include_router(market.router)
app.include_router(watchlist.router)
app.include_router(vault.router)
app.include_router(sec_data.router)
app.include_router(feeds.router)
app.include_router(live_feeds.router)
app.include_router(governance.router)
app.include_router(claims_router)
app.include_router(policy_router)
app.include_router(lineage_router)
app.include_router(receipts_router)
app.include_router(executive_router)
app.include_router(dossier_router)
app.include_router(narrative_router)
app.include_router(kpi_library_router)
app.include_router(pipeline_router)
app.include_router(provenance_router)
app.include_router(export_router)
app.include_router(intelligence_router)
app.include_router(broker_commissions_router)
app.include_router(admin_router)
app.include_router(f5500_router)
app.include_router(evidence_router)
app.include_router(claims_gov_router)
app.include_router(receipts_gov_router)
app.include_router(executive_gov_router)
app.include_router(export_gov_router)
app.include_router(policy_gov_router)
app.include_router(orgs_router)
app.include_router(billing_router)
app.include_router(saas_fiduciary_router)
app.include_router(saas_broker_router)
app.include_router(cross_intel_router)
app.include_router(commit_engine_router)
app.include_router(ma_diligence_router)
app.include_router(actuarial_router)
app.include_router(saas_stoploss_router)
app.include_router(saas_network_router)
app.include_router(fiduciary_iq_router)
app.include_router(stewardship_router)
app.include_router(employer_health_score_router)
app.include_router(claims_recovery_router)
app.include_router(hios_router)
app.include_router(email_reports_router)
app.include_router(permissions_router)
app.include_router(mckinsey_router)
app.include_router(sms_router)
app.include_router(documents_router)
app.include_router(contact_intel_router)
app.include_router(crm_sync_router)
app.include_router(edgar_lang_router)
app.include_router(sales_iq_router)
app.include_router(filing_intel_router)
app.include_router(filing_alerts_router)
app.include_router(account_intel_router)
app.include_router(federal_intel_router)
app.include_router(cms_intel_router)
app.include_router(market_intel_router)
app.include_router(kiq_engine_router)
app.include_router(sales_os_router)

# ── Compliance Engine ──────────────────────────────────────────────────────────
app.include_router(ce_controls_router)
app.include_router(ce_evidence_router)
app.include_router(ce_audit_router)
app.include_router(ce_assets_router)
app.include_router(ce_findings_router)
app.include_router(ce_reports_router)

from backend.routers.pbm_contract import router as pbm_contract_router
app.include_router(pbm_contract_router)

from backend.routers.rx_defense import router as rx_defense_router
app.include_router(rx_defense_router)
from backend.routers.tpa_iq import router as tpa_iq_router
app.include_router(tpa_iq_router)
from backend.routers.stop_loss import router as stop_loss_router
app.include_router(stop_loss_router)

from backend.routers.verify_war_room import router as verify_war_room_router
app.include_router(verify_war_room_router)

from backend.routers.kiq_routes import router as kiq_router
app.include_router(kiq_router)

from backend.routers.prospect_reports import router as prospect_reports_router
app.include_router(prospect_reports_router)
from backend.routers.shady_broker import router as shady_broker_router
app.include_router(shady_broker_router)

from backend.routers.integrations_hub import router as integrations_hub_router
app.include_router(integrations_hub_router)

from backend.routers.m365 import router as m365_router
app.include_router(m365_router)

from backend.routers.quickbooks import router as quickbooks_router
app.include_router(quickbooks_router)

from backend.routers.benchmarking import router as benchmarking_router
app.include_router(benchmarking_router)

from backend.routers.gov_stats import router as gov_stats_router
app.include_router(gov_stats_router)

from backend.routers.meetings import router as meetings_router
app.include_router(meetings_router)

# Rx Ingestion Pipeline — /api/ingest/claims, /rebates, /contracts
app.include_router(ingest_router)
app.include_router(ai_history_router)
app.include_router(share_links_router)
app.include_router(company360_router)

from backend.routers.rfp_intake import router as rfp_intake_router
app.include_router(rfp_intake_router)
from backend.routers.rfp_intelligence import router as rfp_intelligence_router
app.include_router(rfp_intelligence_router)
from backend.routers.rfp_digest import router as rfp_digest_router
app.include_router(rfp_digest_router)
from backend.routers.rfp_command_center import router as rfp_command_center_router
app.include_router(rfp_command_center_router)
from backend.routers.rfp_enhancements import router as rfp_enhancements_router
app.include_router(rfp_enhancements_router)
from backend.routers.plan_metrics import router as plan_metrics_router
app.include_router(plan_metrics_router)

from backend.routers.form_5500_monitor import router as f5500_monitor_router, ensure_account_intel_columns, ensure_rfp_opportunity_columns
app.include_router(f5500_monitor_router)

# Rebel IQ Intelligence API (v1) — machine-to-machine sub-application mounted at
# /v1 with its own RFC 9457 problem+json handlers, auth, and rate-limit middleware.
from backend.routers.rebel_app import v1_app  # noqa: E402
app.mount("/v1", v1_app)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Return clean JSON for HTTP errors; never expose internals."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return structured validation errors without stack traces."""
    errors = [
        {"field": ".".join(str(l) for l in err["loc"]), "message": err["msg"]}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch-all: log the real error server-side, return opaque 500 to client."""
    logger.exception(f"[UNHANDLED] {request.method} {request.url.path} → {type(exc).__name__}: {exc}")
    if IS_PRODUCTION:
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal server error occurred. Ref: KIQ-500"},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {str(exc)}"},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "stack": "FastAPI + React 19 + PostgreSQL"}


STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist", "public")

if os.path.exists(STATIC_DIR):
    assets_dir = os.path.join(STATIC_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str, request: Request):
        if full_path.startswith("api/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        index_file = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "Frontend not built"}
else:
    @app.get("/")
    async def root():
        return {
            "message": "Kincaid IQ API is running",
            "note": "Run npm run build to serve the frontend",
        }

    @app.get("/{full_path:path}")
    async def catch_all(full_path: str):
        return {"message": "Frontend not yet built — API is running"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=not IS_PRODUCTION)
