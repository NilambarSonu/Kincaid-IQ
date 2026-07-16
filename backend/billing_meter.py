"""
Kincaid Health — Usage Billing Meter
Implements the guide's calculateBill() formula:

    contracts  × $120.00   (per contract run through KIQ Engine)
    claims     × $0.02     (per claim event processed by webhook router)
    api_calls  × $0.001    (per intelligence API call)

Usage is metered monthly per tenant. One UsageRecord row per (tenant, YYYY-MM).
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger("kincaid.billing_meter")

# ── Rate table (matches guide formula exactly) ────────────────────────────────
RATE_CONTRACT  = 120.00    # per contract analyzed
RATE_CLAIM     = 0.02      # per claim event
RATE_API_CALL  = 0.001     # per API call to intelligence endpoints


def calculate_bill(usage: dict) -> float:
    """
    Guide's calculateBill() implemented in Python.

        return (
            usage.contracts * 120 +
            usage.claims    * 0.02 +
            usage.apiCalls  * 0.001
        )

    Accepts both camelCase (apiCalls) and snake_case (api_calls) keys.
    Returns total USD as a float rounded to 2 decimal places.
    """
    contracts = usage.get("contracts", usage.get("contracts", 0))
    claims    = usage.get("claims", 0)
    api_calls = usage.get("apiCalls", usage.get("api_calls", 0))

    total = (
        contracts * RATE_CONTRACT +
        claims    * RATE_CLAIM +
        api_calls * RATE_API_CALL
    )
    return round(total, 2)


def _billing_period(dt: Optional[datetime] = None) -> str:
    """Return current billing period as 'YYYY-MM'."""
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m")


def _get_or_create_record(db: Session, tenant_id: str, period: str):
    """Fetch or create the UsageRecord for (tenant, period)."""
    from backend.models import UsageRecord
    record = db.query(UsageRecord).filter_by(
        tenant_id=tenant_id, billing_period=period
    ).first()
    if not record:
        record = UsageRecord(
            tenant_id=tenant_id,
            billing_period=period,
            contracts=0,
            claims=0,
            api_calls=0,
        )
        db.add(record)
        db.flush()
    return record


def record_contract(db: Session, tenant_id: str, count: int = 1):
    """Increment contracts_analyzed for tenant in current billing period."""
    try:
        period = _billing_period()
        rec = _get_or_create_record(db, tenant_id, period)
        rec.contracts += count
        db.commit()
        logger.debug(f"[METER] {tenant_id} +{count} contract(s) → {rec.contracts} in {period}")
    except Exception as exc:
        logger.error(f"[METER] record_contract failed: {exc}")
        db.rollback()


def record_claim(db: Session, tenant_id: str, count: int = 1):
    """Increment claims_processed for tenant in current billing period."""
    try:
        period = _billing_period()
        rec = _get_or_create_record(db, tenant_id, period)
        rec.claims += count
        db.commit()
        logger.debug(f"[METER] {tenant_id} +{count} claim(s) → {rec.claims} in {period}")
    except Exception as exc:
        logger.error(f"[METER] record_claim failed: {exc}")
        db.rollback()


def record_api_call(db: Session, tenant_id: str, count: int = 1):
    """Increment api_calls for tenant in current billing period."""
    try:
        period = _billing_period()
        rec = _get_or_create_record(db, tenant_id, period)
        rec.api_calls += count
        db.commit()
        logger.debug(f"[METER] {tenant_id} +{count} api_call(s) → {rec.api_calls} in {period}")
    except Exception as exc:
        logger.error(f"[METER] record_api_call failed: {exc}")
        db.rollback()


def get_usage(db: Session, tenant_id: str, period: Optional[str] = None) -> dict:
    """Return usage dict + bill preview for a tenant's billing period."""
    from backend.models import UsageRecord
    period = period or _billing_period()
    rec = db.query(UsageRecord).filter_by(
        tenant_id=tenant_id, billing_period=period
    ).first()

    usage = {
        "tenant_id":      tenant_id,
        "billing_period": period,
        "contracts":      rec.contracts  if rec else 0,
        "claims":         rec.claims     if rec else 0,
        "api_calls":      rec.api_calls  if rec else 0,
    }
    usage["bill_usd"]    = calculate_bill(usage)
    usage["bill_detail"] = {
        "contracts": round(usage["contracts"] * RATE_CONTRACT, 2),
        "claims":    round(usage["claims"]    * RATE_CLAIM,    2),
        "api_calls": round(usage["api_calls"] * RATE_API_CALL, 2),
    }
    usage["rates"] = {
        "contract_per_unit":  RATE_CONTRACT,
        "claim_per_unit":     RATE_CLAIM,
        "api_call_per_unit":  RATE_API_CALL,
    }
    return usage
