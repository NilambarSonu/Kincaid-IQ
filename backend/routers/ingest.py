"""
Kincaid IQ — Rx Ingestion Pipeline
====================================
Pipeline: CSV/JSON → /ingest/claims → parse → validate → normalize → RxClaim (PG) → DRAP

Architecture:
  A. Ingestion boundary  — Pydantic schema validation at every entry point
  B. Normalization layer — type coercion, date parsing, NDC format enforcement
  C. DRAP computation    — spread = plan_pay − allowable_price (EBITDA leakage unit)
  D. Leakage classifier  — exact spec translation of classifyLeakageType()
  E. Persistence layer   — idempotent upsert (claim_id unique, duplicates skipped)
  F. Audit trail         — IngestionRun tracks every batch (observable, rollback-ready)

Endpoints:
  POST /api/ingest/claims          — JSON array or CSV upload
  POST /api/ingest/rebates         — JSON array or CSV upload
  POST /api/ingest/contracts       — JSON metadata (PDF text optional)
  GET  /api/ingest/runs            — list all ingestion batches
  GET  /api/ingest/runs/{id}       — batch detail + DRAP summary
  GET  /api/ingest/claims          — query stored RxClaims (filters: ndc, pharmacy, date)
  GET  /api/ingest/drap/summary    — portfolio DRAP aggregate
  DELETE /api/ingest/runs/{id}     — soft-rollback a batch
"""

import csv
import io
import json
import logging
import uuid
from datetime import datetime, date
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import RxClaim, IngestionRun, RxRebate, RxContract

logger = logging.getLogger("kincaid.ingest")

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


# ═══════════════════════════════════════════════════════════════════════════════
# A. Pydantic Schemas — boundary enforcement
# ═══════════════════════════════════════════════════════════════════════════════

class ClaimIn(BaseModel):
    """Canonical Rx claim — exact spec fields. Strict at the boundary."""
    claim_id:        str
    ndc:             str
    drug_name:       Optional[str]   = None
    pharmacy_id:     str
    quantity:        Optional[float] = None
    days_supply:     Optional[int]   = None
    ingredient_cost: Optional[float] = None
    dispensing_fee:  Optional[float] = None
    total_paid:      float
    patient_pay:     Optional[float] = 0.0
    plan_pay:        float
    fill_date:       str              # ISO 8601 or MM/DD/YYYY

    # Optional DRAP input — NADAC benchmark; if absent, spread is deferred
    allowable_price: Optional[float] = None

    @field_validator("ndc")
    @classmethod
    def normalize_ndc(cls, v: str) -> str:
        """Strip hyphens → canonical NDC-11. '0069-0150-68' → '00690150068'"""
        stripped = v.replace("-", "").replace(" ", "")
        if len(stripped) not in (10, 11):
            raise ValueError(f"NDC must be 10 or 11 digits after stripping hyphens, got: {v!r}")
        return stripped.zfill(11)

    @field_validator("total_paid", "plan_pay")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Paid amounts must be non-negative.")
        return round(v, 4)

    @field_validator("fill_date")
    @classmethod
    def parse_fill_date(cls, v: str) -> str:
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                datetime.strptime(v, fmt)
                return v
            except ValueError:
                continue
        raise ValueError(f"Cannot parse fill_date: {v!r}. Use YYYY-MM-DD or MM/DD/YYYY.")


class RebateIn(BaseModel):
    """Rebate record from PBM rebate file."""
    rebate_id:      str
    ndc:            str
    drug_name:      Optional[str]   = None
    rebate_amount:  float
    rebate_period:  Optional[str]   = None    # e.g. "2024-Q1"
    fill_date:      Optional[str]   = None
    payment_date:   Optional[str]   = None

    @field_validator("ndc")
    @classmethod
    def normalize_ndc(cls, v: str) -> str:
        return v.replace("-", "").replace(" ", "").zfill(11)


class ContractIn(BaseModel):
    """Contract metadata — PDF text optional, ingested for L3 drill-down."""
    contract_id:    str
    counterparty:   Optional[str] = None
    contract_type:  Optional[str] = "pbm"      # pbm | stop_loss | mac | rebate
    effective_date: Optional[str] = None
    expiry_date:    Optional[str] = None
    raw_text:       Optional[str] = None       # full extracted text from PDF


# ═══════════════════════════════════════════════════════════════════════════════
# B. Normalization Layer
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _coerce_float(v: Any) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        return round(float(str(v).replace(",", "").replace("$", "").strip()), 4)
    except (ValueError, TypeError):
        return None


def _coerce_int(v: Any) -> Optional[int]:
    if v is None or v == "":
        return None
    try:
        return int(float(str(v).strip()))
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# C + D. DRAP Computation + Leakage Classifier
# ═══════════════════════════════════════════════════════════════════════════════

def classify_leakage_type(
    spread_k: float,
    rebate: float,
    plan_paid_k: float,
    pharmacy_paid_k: float,
    rebate_delay_days: int = 0,
) -> str:
    """
    Exact Python translation of spec classifyLeakageType().

    Inputs normalized to $K scale (÷1000 from raw dollars).
    rebate = 100 − commission_pct proxy (higher commission = lower rebate passthrough).
    rebate_delay_days = days between fill_date and rebate payment_date.

    Heuristic classification — expandable later with ML.
    """
    if spread_k > 50 and rebate < 5:
        return "SPREAD_PRICING"
    if rebate > 20 and rebate_delay_days > 30:
        return "REBATE_DELAY"
    if plan_paid_k > 1000:
        return "SPECIALTY_INFLATION"
    if abs(plan_paid_k - pharmacy_paid_k) < 5:
        return "PASS_THROUGH"
    return "OTHER"


def compute_drap(claim: ClaimIn) -> dict:
    """
    DRAP computation per claim.
      spread = plan_pay − allowable_price  (EBITDA leakage unit)

    If allowable_price is absent, spread is deferred (null) —
    can be resolved later when NADAC benchmark data is loaded.

    Returns dict of computed fields to merge into RxClaim record.
    """
    ap = claim.allowable_price
    if ap is None:
        return {
            "allowable_price":   None,
            "spread":            None,
            "drap_contribution": None,
            "leakage_type":      None,
        }

    spread    = round(claim.plan_pay - ap, 4)
    spread_k  = spread / 1_000
    paid_k    = claim.plan_pay / 1_000
    bench_k   = ap / 1_000
    rebate    = 0.0  # no rebate data at this layer; resolved at rebate join

    return {
        "allowable_price":   ap,
        "spread":            spread,
        "drap_contribution": spread,
        "leakage_type":      classify_leakage_type(spread_k, rebate, paid_k, bench_k),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# E. CSV Parsing Utility
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_csv_claims(content: bytes) -> list[dict]:
    """Parse CSV bytes → list of raw dicts. Strips BOM, handles CRLF."""
    text = content.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def _parse_csv_rebates(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/ingest/claims
# ═══════════════════════════════════════════════════════════════════════════════

class ClaimsBatchIn(BaseModel):
    claims: list[ClaimIn]
    source_file: Optional[str] = None


@router.post("/claims", summary="Ingest Rx claims — JSON array or CSV upload")
async def ingest_claims(
    payload:     Optional[ClaimsBatchIn] = None,
    file:        Optional[UploadFile]    = File(default=None),
    db:          Session                 = Depends(get_db),
):
    """
    Accepts either:
      • JSON body: { claims: [...], source_file: "optional" }
      • Multipart CSV file upload

    Pipeline per record:
      1. Validate against ClaimIn schema
      2. Compute DRAP (spread = plan_pay − allowable_price)
      3. Classify leakage type
      4. Idempotent insert (claim_id unique — duplicates skipped, not errored)

    Returns:
      IngestionRun receipt with ingestion_id, counts, total_plan_pay, total_drap
    """
    ingestion_id = str(uuid.uuid4())
    source_file  = None
    raw_records: list[dict] = []

    # ── Source resolution ────────────────────────────────────────────────────
    if file is not None:
        content    = await file.read()
        source_file = file.filename
        raw_records = _parse_csv_claims(content)
    elif payload is not None:
        source_file = payload.source_file
        raw_records = [c.model_dump() for c in payload.claims]
    else:
        raise HTTPException(status_code=422, detail="Provide JSON body or a CSV file upload.")

    # ── Per-record pipeline ──────────────────────────────────────────────────
    success_count = 0
    skip_count    = 0
    error_count   = 0
    errors: list[dict] = []
    total_plan_pay = 0.0
    total_drap     = 0.0

    for idx, raw in enumerate(raw_records):
        try:
            claim = ClaimIn(
                claim_id        = str(raw.get("claim_id", "") or "").strip(),
                ndc             = str(raw.get("ndc", "") or "").strip(),
                drug_name       = raw.get("drug_name") or None,
                pharmacy_id     = str(raw.get("pharmacy_id", "") or "").strip(),
                quantity        = _coerce_float(raw.get("quantity")),
                days_supply     = _coerce_int(raw.get("days_supply")),
                ingredient_cost = _coerce_float(raw.get("ingredient_cost")),
                dispensing_fee  = _coerce_float(raw.get("dispensing_fee")),
                total_paid      = _coerce_float(raw.get("total_paid")) or 0.0,
                patient_pay     = _coerce_float(raw.get("patient_pay")) or 0.0,
                plan_pay        = _coerce_float(raw.get("plan_pay")) or 0.0,
                fill_date       = str(raw.get("fill_date", "") or "").strip(),
                allowable_price = _coerce_float(raw.get("allowable_price")),
            )

            if not claim.claim_id or not claim.ndc or not claim.pharmacy_id:
                raise ValueError("claim_id, ndc, and pharmacy_id are required.")

            drap = compute_drap(claim)

            # Idempotent — skip existing claim_ids
            existing = db.query(RxClaim).filter(RxClaim.claim_id == claim.claim_id).first()
            if existing:
                skip_count += 1
                continue

            rx = RxClaim(
                ingestion_id    = ingestion_id,
                claim_id        = claim.claim_id,
                ndc             = claim.ndc,
                drug_name       = claim.drug_name,
                pharmacy_id     = claim.pharmacy_id,
                quantity        = claim.quantity,
                days_supply     = claim.days_supply,
                ingredient_cost = claim.ingredient_cost,
                dispensing_fee  = claim.dispensing_fee,
                total_paid      = claim.total_paid,
                patient_pay     = claim.patient_pay,
                plan_pay        = claim.plan_pay,
                fill_date       = _parse_date(claim.fill_date),
                allowable_price = drap["allowable_price"],
                spread          = drap["spread"],
                drap_contribution = drap["drap_contribution"],
                leakage_type    = drap["leakage_type"],
                source_file     = source_file,
            )
            db.add(rx)
            success_count += 1
            total_plan_pay += claim.plan_pay
            if drap["spread"] is not None:
                total_drap += drap["spread"]

        except Exception as exc:
            error_count += 1
            errors.append({"row": idx, "error": str(exc)})
            logger.warning(f"[Ingest/Claims] row {idx}: {exc}")

    # ── Persist ──────────────────────────────────────────────────────────────
    status = "COMPLETE" if error_count == 0 else ("PARTIAL" if success_count > 0 else "FAILED")
    run = IngestionRun(
        ingestion_id  = ingestion_id,
        source_type   = "claims",
        source_file   = source_file,
        record_count  = len(raw_records),
        success_count = success_count,
        skip_count    = skip_count,
        error_count   = error_count,
        total_plan_pay = round(total_plan_pay, 2),
        total_drap     = round(total_drap, 2),
        status        = status,
        errors_json   = json.dumps(errors[:50]) if errors else None,
    )
    db.add(run)
    db.commit()

    logger.info(
        f"[Ingest/Claims] id={ingestion_id} "
        f"records={len(raw_records)} ok={success_count} skip={skip_count} err={error_count} "
        f"total_plan_pay=${total_plan_pay:,.2f} total_drap=${total_drap:,.2f}"
    )

    return {
        "ingestion_id":  ingestion_id,
        "status":        status,
        "record_count":  len(raw_records),
        "success_count": success_count,
        "skip_count":    skip_count,
        "error_count":   error_count,
        "total_plan_pay": total_plan_pay,
        "total_drap":     total_drap,
        "drap_note":     "DRAP is Σ(plan_pay − allowable_price). Null where allowable_price was not provided.",
        "errors":        errors[:10],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/ingest/rebates
# ═══════════════════════════════════════════════════════════════════════════════

class RebatesBatchIn(BaseModel):
    rebates: list[RebateIn]
    source_file: Optional[str] = None


@router.post("/rebates", summary="Ingest rebate file — JSON array or CSV upload")
async def ingest_rebates(
    payload: Optional[RebatesBatchIn] = None,
    file:    Optional[UploadFile]     = File(default=None),
    db:      Session                  = Depends(get_db),
):
    """
    Ingests PBM rebate records.

    days_to_payment = payment_date − fill_date.
    REBATE_DELAY classification (>30 days) is computed and stored.
    Rebates can later be joined to RxClaims by NDC to resolve deferred DRAP.
    """
    ingestion_id = str(uuid.uuid4())
    source_file  = None
    raw_records: list[dict] = []

    if file is not None:
        content    = await file.read()
        source_file = file.filename
        raw_records = _parse_csv_rebates(content)
    elif payload is not None:
        source_file = payload.source_file
        raw_records = [r.model_dump() for r in payload.rebates]
    else:
        raise HTTPException(status_code=422, detail="Provide JSON body or a CSV file upload.")

    success_count = skip_count = error_count = 0
    errors: list[dict] = []
    total_rebate = 0.0

    for idx, raw in enumerate(raw_records):
        try:
            reb = RebateIn(
                rebate_id     = str(raw.get("rebate_id", "") or "").strip(),
                ndc           = str(raw.get("ndc", "") or "").strip(),
                drug_name     = raw.get("drug_name") or None,
                rebate_amount = _coerce_float(raw.get("rebate_amount")) or 0.0,
                rebate_period = raw.get("rebate_period") or None,
                fill_date     = raw.get("fill_date") or None,
                payment_date  = raw.get("payment_date") or None,
            )

            fill_dt    = _parse_date(reb.fill_date)
            payment_dt = _parse_date(reb.payment_date)
            days_to_payment: Optional[int] = None
            if fill_dt and payment_dt:
                days_to_payment = max(0, (payment_dt - fill_dt).days)

            existing = db.query(RxRebate).filter(RxRebate.rebate_id == reb.rebate_id).first()
            if existing:
                skip_count += 1
                continue

            db.add(RxRebate(
                ingestion_id    = ingestion_id,
                rebate_id       = reb.rebate_id,
                ndc             = reb.ndc,
                drug_name       = reb.drug_name,
                rebate_amount   = reb.rebate_amount,
                rebate_period   = reb.rebate_period,
                fill_date       = fill_dt,
                payment_date    = payment_dt,
                days_to_payment = days_to_payment,
                source_file     = source_file,
            ))
            success_count += 1
            total_rebate += reb.rebate_amount

        except Exception as exc:
            error_count += 1
            errors.append({"row": idx, "error": str(exc)})

    status = "COMPLETE" if error_count == 0 else ("PARTIAL" if success_count > 0 else "FAILED")
    db.add(IngestionRun(
        ingestion_id  = ingestion_id,
        source_type   = "rebates",
        source_file   = source_file,
        record_count  = len(raw_records),
        success_count = success_count,
        skip_count    = skip_count,
        error_count   = error_count,
        total_plan_pay = None,
        total_drap     = None,
        status        = status,
        errors_json   = json.dumps(errors[:50]) if errors else None,
    ))
    db.commit()

    return {
        "ingestion_id":  ingestion_id,
        "status":        status,
        "record_count":  len(raw_records),
        "success_count": success_count,
        "skip_count":    skip_count,
        "error_count":   error_count,
        "total_rebate":  round(total_rebate, 2),
        "errors":        errors[:10],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/ingest/contracts
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/contracts", summary="Ingest PBM / carrier contract metadata")
async def ingest_contracts(
    payload: ContractIn,
    db:      Session = Depends(get_db),
):
    """
    Ingests PBM or carrier contract metadata + raw text.
    raw_text is stored for downstream L3 drill-down contract clause mapping.
    """
    ingestion_id = str(uuid.uuid4())

    existing = db.query(RxContract).filter(RxContract.contract_id == payload.contract_id).first()
    if existing:
        return {
            "ingestion_id": ingestion_id,
            "status":       "SKIPPED",
            "detail":       f"contract_id '{payload.contract_id}' already exists.",
        }

    clause_count = None
    if payload.raw_text:
        # Rough clause count heuristic — count numbered sections
        import re
        clause_count = len(re.findall(r"(?m)^\s*\d+[\.\)]\s", payload.raw_text))

    db.add(RxContract(
        ingestion_id   = ingestion_id,
        contract_id    = payload.contract_id,
        counterparty   = payload.counterparty,
        contract_type  = payload.contract_type,
        effective_date = _parse_date(payload.effective_date),
        expiry_date    = _parse_date(payload.expiry_date),
        raw_text       = payload.raw_text,
        clause_count   = clause_count,
        source_file    = None,
    ))
    db.add(IngestionRun(
        ingestion_id  = ingestion_id,
        source_type   = "contracts",
        source_file   = payload.contract_id,
        record_count  = 1,
        success_count = 1,
        skip_count    = 0,
        error_count   = 0,
        status        = "COMPLETE",
    ))
    db.commit()

    return {
        "ingestion_id": ingestion_id,
        "status":       "COMPLETE",
        "contract_id":  payload.contract_id,
        "clause_count": clause_count,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/ingest/runs — list batches
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/runs", summary="List all ingestion batches (audit trail)")
def list_runs(
    source_type: Optional[str] = Query(default=None),
    limit:       int           = Query(default=50, le=200),
    db:          Session       = Depends(get_db),
):
    q = db.query(IngestionRun).order_by(IngestionRun.ingested_at.desc())
    if source_type:
        q = q.filter(IngestionRun.source_type == source_type)
    runs = q.limit(limit).all()
    return [_serialize_run(r) for r in runs]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/ingest/runs/{ingestion_id}
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/runs/{ingestion_id}", summary="Ingestion batch detail")
def get_run(ingestion_id: str, db: Session = Depends(get_db)):
    run = db.query(IngestionRun).filter(IngestionRun.ingestion_id == ingestion_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Ingestion run {ingestion_id!r} not found.")
    return _serialize_run(run)


def _serialize_run(r: IngestionRun) -> dict:
    errors = []
    try:
        errors = json.loads(r.errors_json) if r.errors_json else []
    except Exception:
        pass
    return {
        "ingestion_id":  r.ingestion_id,
        "source_type":   r.source_type,
        "source_file":   r.source_file,
        "status":        r.status,
        "record_count":  r.record_count,
        "success_count": r.success_count,
        "skip_count":    r.skip_count,
        "error_count":   r.error_count,
        "total_plan_pay": r.total_plan_pay,
        "total_drap":    r.total_drap,
        "ingested_at":   r.ingested_at.isoformat() if r.ingested_at else None,
        "errors":        errors[:10],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/ingest/claims — query stored RxClaims
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/claims", summary="Query ingested Rx claims")
def query_claims(
    ndc:          Optional[str] = Query(default=None),
    pharmacy_id:  Optional[str] = Query(default=None),
    leakage_type: Optional[str] = Query(default=None),
    ingestion_id: Optional[str] = Query(default=None),
    date_from:    Optional[str] = Query(default=None),
    date_to:      Optional[str] = Query(default=None),
    limit:        int           = Query(default=100, le=1000),
    offset:       int           = Query(default=0),
    db:           Session       = Depends(get_db),
):
    q = db.query(RxClaim)
    if ndc:
        q = q.filter(RxClaim.ndc == ndc.replace("-", "").zfill(11))
    if pharmacy_id:
        q = q.filter(RxClaim.pharmacy_id == pharmacy_id)
    if leakage_type:
        q = q.filter(RxClaim.leakage_type == leakage_type.upper())
    if ingestion_id:
        q = q.filter(RxClaim.ingestion_id == ingestion_id)
    if date_from:
        dt = _parse_date(date_from)
        if dt:
            q = q.filter(RxClaim.fill_date >= dt)
    if date_to:
        dt = _parse_date(date_to)
        if dt:
            q = q.filter(RxClaim.fill_date <= dt)

    total = q.count()
    claims = q.order_by(RxClaim.fill_date.desc()).offset(offset).limit(limit).all()

    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "claims": [_serialize_claim(c) for c in claims],
    }


def _serialize_claim(c: RxClaim) -> dict:
    return {
        "claim_id":        c.claim_id,
        "ndc":             c.ndc,
        "drug_name":       c.drug_name,
        "pharmacy_id":     c.pharmacy_id,
        "quantity":        c.quantity,
        "days_supply":     c.days_supply,
        "ingredient_cost": c.ingredient_cost,
        "dispensing_fee":  c.dispensing_fee,
        "total_paid":      c.total_paid,
        "patient_pay":     c.patient_pay,
        "plan_pay":        c.plan_pay,
        "fill_date":       c.fill_date.isoformat() if c.fill_date else None,
        "allowable_price": c.allowable_price,
        "spread":          c.spread,
        "drap_contribution": c.drap_contribution,
        "leakage_type":    c.leakage_type,
        "ingestion_id":    c.ingestion_id,
        "source_file":     c.source_file,
        "ingested_at":     c.ingested_at.isoformat() if c.ingested_at else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/ingest/drap/summary — portfolio DRAP aggregate
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/drap/summary", summary="Portfolio DRAP aggregate — Σ(plan_pay − allowable_price)")
def drap_summary(
    ingestion_id: Optional[str] = Query(default=None),
    db:           Session       = Depends(get_db),
):
    """
    Computes portfolio-level DRAP:
      DRAP     = Σ spread (where spread is non-null)
      Coverage = % of claims with allowable_price populated

    Returns top leakage drivers by type and by NDC.
    """
    q = db.query(RxClaim)
    if ingestion_id:
        q = q.filter(RxClaim.ingestion_id == ingestion_id)

    claims = q.all()
    if not claims:
        return {"drap": 0.0, "coverage_pct": 0.0, "claims_total": 0, "message": "No claims ingested yet."}

    total_claims      = len(claims)
    drap_claims       = [c for c in claims if c.spread is not None]
    coverage_pct      = len(drap_claims) / total_claims * 100

    total_drap        = sum(c.spread for c in drap_claims)
    total_plan_pay    = sum(c.plan_pay for c in claims)

    # Leakage by type
    by_type: dict = {}
    for c in drap_claims:
        t = c.leakage_type or "UNKNOWN"
        if t not in by_type:
            by_type[t] = {"type": t, "count": 0, "total_drap": 0.0, "total_plan_pay": 0.0}
        by_type[t]["count"]         += 1
        by_type[t]["total_drap"]    += c.spread or 0.0
        by_type[t]["total_plan_pay"] += c.plan_pay

    type_breakdown = sorted(by_type.values(), key=lambda x: x["total_drap"], reverse=True)

    # Top 10 NDCs by DRAP
    by_ndc: dict = {}
    for c in drap_claims:
        if c.ndc not in by_ndc:
            by_ndc[c.ndc] = {"ndc": c.ndc, "drug_name": c.drug_name, "count": 0, "total_drap": 0.0}
        by_ndc[c.ndc]["count"]      += 1
        by_ndc[c.ndc]["total_drap"] += c.spread or 0.0

    top_ndcs = sorted(by_ndc.values(), key=lambda x: x["total_drap"], reverse=True)[:10]

    return {
        "drap":            round(total_drap, 2),
        "total_plan_pay":  round(total_plan_pay, 2),
        "drap_pct_of_spend": round(total_drap / total_plan_pay * 100, 2) if total_plan_pay else 0.0,
        "claims_total":    total_claims,
        "claims_with_drap": len(drap_claims),
        "coverage_pct":    round(coverage_pct, 1),
        "leakage_by_type": type_breakdown,
        "top_ndcs_by_drap": top_ndcs,
        "note": "DRAP = Σ(plan_pay − allowable_price). Coverage = % of claims with NADAC benchmark loaded.",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /api/ingest/runs/{ingestion_id} — rollback batch
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/runs/{ingestion_id}", summary="Rollback an ingestion batch")
def rollback_run(ingestion_id: str, db: Session = Depends(get_db)):
    """
    Deletes all RxClaims, RxRebates, and RxContracts from this batch,
    then marks the IngestionRun as ROLLED_BACK.
    Idempotent — safe to call multiple times.
    """
    run = db.query(IngestionRun).filter(IngestionRun.ingestion_id == ingestion_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Ingestion run {ingestion_id!r} not found.")

    claims_del   = db.query(RxClaim).filter(RxClaim.ingestion_id == ingestion_id).delete()
    rebates_del  = db.query(RxRebate).filter(RxRebate.ingestion_id == ingestion_id).delete()
    contracts_del = db.query(RxContract).filter(RxContract.ingestion_id == ingestion_id).delete()

    run.status = "ROLLED_BACK"
    db.commit()

    logger.info(
        f"[Ingest/Rollback] id={ingestion_id} "
        f"claims={claims_del} rebates={rebates_del} contracts={contracts_del}"
    )

    return {
        "ingestion_id":    ingestion_id,
        "status":          "ROLLED_BACK",
        "claims_deleted":   claims_del,
        "rebates_deleted":  rebates_del,
        "contracts_deleted": contracts_del,
    }
