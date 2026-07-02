"""
Client-package snapshot retention.

Every sent (or downloaded) client package persists a byte-identical snapshot of
each component (PDF/DOCX/JSON) in `client_package_snapshots.data` (a Postgres
`bytea` column) so the audit drawer can show exactly what a client received,
months later. Those raw blobs are the single largest growth driver of that
table, and with frequent sends the table can bloat the database without bound.

This module enforces a retention policy on the *blobs* while leaving the
`ClientPackageDelivery` audit rows untouched — the delivery log (who/when/what
was sent) is small and is the system of record; only the heavy reproducible
artifacts are pruned.

Two independent limits are applied (either can be disabled by setting its env
var to 0):

  * SNAPSHOT_RETENTION_DAYS              (default 365)
      Purge any snapshot older than this many days.
  * SNAPSHOT_RETENTION_MAX_PER_RECIPIENT (default 50)
      Per recipient, keep snapshots only for the most-recent N deliveries;
      purge snapshots belonging to older deliveries for that recipient.

The prune runs daily via the shared APScheduler instance
(`compliance_engine.scheduler`).
"""
from __future__ import annotations

import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

import backend.models as models

logger = logging.getLogger("kincaid.snapshot_retention")

DEFAULT_RETENTION_DAYS = 365
DEFAULT_MAX_PER_RECIPIENT = 50


def _int_env(name: str, default: int) -> int:
    """Read a non-negative integer env var, falling back to `default` on any
    parse error. 0 is a valid value and disables that particular limit."""
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        v = int(raw)
        return v if v >= 0 else default
    except (TypeError, ValueError):
        return default


def retention_config() -> dict:
    """The effective retention configuration (for observability / admin)."""
    return {
        "retention_days": _int_env("SNAPSHOT_RETENTION_DAYS", DEFAULT_RETENTION_DAYS),
        "max_per_recipient": _int_env(
            "SNAPSHOT_RETENTION_MAX_PER_RECIPIENT", DEFAULT_MAX_PER_RECIPIENT
        ),
    }


def prune_client_package_snapshots(db: Optional[Session] = None) -> dict:
    """
    Apply the snapshot retention policy. Deletes snapshot blob rows only; the
    parent `ClientPackageDelivery` audit rows are never touched.

    Safe to call repeatedly (idempotent). Caller may pass an existing session;
    otherwise a short-lived one is opened and closed here.
    """
    own_session = db is None
    if own_session:
        from backend.database import SessionLocal
        db = SessionLocal()

    cfg = retention_config()
    retention_days = cfg["retention_days"]
    max_per_recipient = cfg["max_per_recipient"]
    deleted_by_age = 0
    deleted_by_cap = 0

    try:
        # 1) Age-based purge — drop anything older than the window.
        if retention_days > 0:
            cutoff = datetime.utcnow() - timedelta(days=retention_days)
            deleted_by_age = (
                db.query(models.ClientPackageSnapshot)
                .filter(models.ClientPackageSnapshot.created_at < cutoff)
                .delete(synchronize_session=False)
            )

        # 2) Per-recipient cap — keep snapshots for only the most-recent N
        #    deliveries per recipient; purge the older ones.
        if max_per_recipient > 0:
            rows = (
                db.query(
                    models.ClientPackageSnapshot.delivery_id,
                    models.ClientPackageDelivery.recipient,
                    models.ClientPackageDelivery.created_at,
                )
                .join(
                    models.ClientPackageDelivery,
                    models.ClientPackageSnapshot.delivery_id
                    == models.ClientPackageDelivery.id,
                )
                .distinct()
                .all()
            )

            by_recipient: dict[str, list[tuple[datetime, int]]] = defaultdict(list)
            for delivery_id, recipient, created_at in rows:
                by_recipient[recipient or ""].append(
                    (created_at or datetime.min, delivery_id)
                )

            delivery_ids_to_purge: list[int] = []
            for items in by_recipient.values():
                if len(items) <= max_per_recipient:
                    continue
                items.sort(key=lambda x: x[0], reverse=True)
                delivery_ids_to_purge.extend(did for _, did in items[max_per_recipient:])

            if delivery_ids_to_purge:
                # Chunk the IN-list to keep individual statements bounded.
                CHUNK = 500
                for i in range(0, len(delivery_ids_to_purge), CHUNK):
                    chunk = delivery_ids_to_purge[i : i + CHUNK]
                    deleted_by_cap += (
                        db.query(models.ClientPackageSnapshot)
                        .filter(models.ClientPackageSnapshot.delivery_id.in_(chunk))
                        .delete(synchronize_session=False)
                    )

        if deleted_by_age or deleted_by_cap:
            db.commit()

        result = {
            "deleted_by_age": deleted_by_age,
            "deleted_by_cap": deleted_by_cap,
            "deleted_total": deleted_by_age + deleted_by_cap,
            "retention_days": retention_days,
            "max_per_recipient": max_per_recipient,
        }
        logger.info(
            f"[SnapshotRetention] prune done — {result['deleted_total']} snapshot(s) "
            f"purged ({deleted_by_age} by age, {deleted_by_cap} by per-recipient cap)"
        )
        return result
    except Exception as e:
        logger.error(f"[SnapshotRetention] prune failed: {e}")
        db.rollback()
        return {
            "deleted_by_age": deleted_by_age,
            "deleted_by_cap": deleted_by_cap,
            "deleted_total": deleted_by_age + deleted_by_cap,
            "error": str(e),
        }
    finally:
        if own_session:
            db.close()


def snapshot_storage_stats(db: Session) -> dict:
    """
    Observability helper for the admin panel. Returns the current snapshot
    blob footprint plus the effective retention configuration.
    """
    cfg = retention_config()
    try:
        count = db.query(models.ClientPackageSnapshot).count()
    except Exception:
        count = -1
    try:
        from sqlalchemy import func as _func

        total_bytes = (
            db.query(_func.coalesce(_func.sum(models.ClientPackageSnapshot.size_bytes), 0)).scalar()
            or 0
        )
    except Exception:
        total_bytes = 0
    return {
        "snapshotCount": count,
        "snapshotBytes": int(total_bytes),
        "retentionDays": cfg["retention_days"],
        "maxPerRecipient": cfg["max_per_recipient"],
    }
