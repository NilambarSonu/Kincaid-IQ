"""
Kincaid IQ Verify ledger and RBAC, ported natively into FastAPI.

This module rebuilds the standalone BFF feature set inside the main app:
an append only SHA-256 hash chained evidence ledger that verifies from
genesis, the keyed metrics surface with the three confidence tiers, and the
8 role RBAC permission map. There is no second server: this runs in process
with the rest of the FastAPI app on port 5000.

No em dashes anywhere per the project constitution.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from backend import models

# Genesis hash for the first ledger entry.
GENESIS = "0" * 64

# Stable key for the Postgres transaction advisory lock that serializes ledger
# appends. Any constant works as long as every append path uses the same value.
_LEDGER_LOCK_KEY = 0x4B49514C  # "KIQL"

# Fixed demo tenant. The metrics below are demo figures, scoped to this org so
# they never collide with the real multi tenant organizations table.
DEMO_ORG = "org-demo"

# 8 role RBAC. The buyer is the CFO, the PE operating partner, the deal team,
# the board. The buyer is never HR. owner and admin administer; the consumer
# roles read and drill; auditor verifies the ledger; viewer is read only.
ROLES = [
    "owner",
    "admin",
    "cfo",
    "pe_operating_partner",
    "deal_team",
    "board_member",
    "auditor",
    "viewer",
]

PERMISSIONS = {
    "owner": ["*"],
    "admin": ["org:manage", "metrics:read", "metrics:write", "evidence:read", "evidence:verify", "export:create"],
    "cfo": ["metrics:read", "evidence:read", "evidence:verify", "export:create"],
    "pe_operating_partner": ["metrics:read", "evidence:read", "evidence:verify", "export:create"],
    "deal_team": ["metrics:read", "evidence:read", "export:create"],
    "board_member": ["metrics:read", "evidence:read"],
    "auditor": ["metrics:read", "evidence:read", "evidence:verify"],
    "viewer": ["metrics:read"],
}

# Confidence tiers are exactly three. INSUFFICIENT_EVIDENCE is a valid output,
# never a fallback used to pad a finding.
CONFIDENCE_TIERS = ("CERTIFIED", "MODELED", "INSUFFICIENT_EVIDENCE")

DEMO_METRICS = [
    {"key": "cei", "label": "Capital Efficiency Index", "value": 86.1, "unit": "index", "confidence": "CERTIFIED", "period": "2024"},
    {"key": "ebitda_drag", "label": "EBITDA Drag (Rx + Medical)", "value": 4920000, "unit": "usd", "confidence": "MODELED", "period": "2024"},
    {"key": "pmpm", "label": "Plan Cost PMPM", "value": 612.4, "unit": "usd_pmpm", "confidence": "CERTIFIED", "period": "2024"},
    {"key": "rx_leakage", "label": "Rx Leakage (annualized)", "value": 1380000, "unit": "usd", "confidence": "MODELED", "period": "2024"},
    {"key": "recovery_identified", "label": "Claim Recovery Identified", "value": 740000, "unit": "usd", "confidence": "CERTIFIED", "period": "2024"},
    {"key": "fiduciary_gaps", "label": "Fiduciary Gaps Open", "value": 7, "unit": "count", "confidence": "INSUFFICIENT_EVIDENCE", "period": "2024"},
]


def can(role: str, perm: str) -> bool:
    granted = PERMISSIONS.get(role, [])
    return "*" in granted or perm in granted


def canonical(value) -> str:
    """Deterministic, key sorted JSON so the same logical payload always hashes
    the same. Verify uses the same function, so the chain is internally
    consistent and tamper evident."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _hash_entry(prev_hash: str, core: dict) -> str:
    material = prev_hash + canonical({
        "id": core["id"],
        "ts": core["ts"],
        "actor": core["actor"],
        "action": core["action"],
        "subject": core["subject"],
        "payload": core["payload"],
    })
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def last_hash(db: Session) -> str:
    row = db.query(models.KiqLedgerEntry).order_by(models.KiqLedgerEntry.seq.desc()).first()
    return row.hash if row else GENESIS


def append_evidence(db: Session, actor: str, action: str, payload, subject: str | None = None) -> dict:
    # Serialize appends so two concurrent writers cannot read the same head and
    # fork the chain. The advisory lock is held until this transaction commits.
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LEDGER_LOCK_KEY})
    entry_id = str(uuid.uuid4())
    ts = datetime.now(timezone.utc).isoformat()
    prev = last_hash(db)
    h = _hash_entry(prev, {"id": entry_id, "ts": ts, "actor": actor, "action": action, "subject": subject, "payload": payload})
    db.add(models.KiqLedgerEntry(
        entry_id=entry_id,
        ts=ts,
        actor=actor,
        action=action,
        subject=subject,
        payload=canonical(payload),
        prev_hash=prev,
        hash=h,
    ))
    db.commit()
    return {"id": entry_id, "ts": ts, "hash": h, "prev_hash": prev}


def get_chain(db: Session) -> list[dict]:
    rows = db.query(models.KiqLedgerEntry).order_by(models.KiqLedgerEntry.seq.asc()).all()
    return [
        {
            "seq": r.seq,
            "id": r.entry_id,
            "ts": r.ts,
            "actor": r.actor,
            "action": r.action,
            "subject": r.subject,
            "payload": r.payload,
            "prev_hash": r.prev_hash,
            "hash": r.hash,
        }
        for r in rows
    ]


def verify_chain(db: Session) -> dict:
    """Replay the chain from genesis, recomputing every hash. Detects any
    tampering, reordering, or broken link."""
    rows = db.query(models.KiqLedgerEntry).order_by(models.KiqLedgerEntry.seq.asc()).all()
    prev = GENESIS
    for r in rows:
        if r.prev_hash != prev:
            return {"ok": False, "length": len(rows), "brokenAt": r.seq, "reason": "prev_hash mismatch", "head": None}
        recomputed = _hash_entry(prev, {
            "id": r.entry_id,
            "ts": r.ts,
            "actor": r.actor,
            "action": r.action,
            "subject": r.subject,
            "payload": json.loads(r.payload),
        })
        if recomputed != r.hash:
            return {"ok": False, "length": len(rows), "brokenAt": r.seq, "reason": "hash mismatch", "head": None}
        prev = r.hash
    return {"ok": True, "length": len(rows), "brokenAt": None, "reason": None, "head": prev if rows else None}


def seed_demo(db: Session) -> None:
    """Idempotent. Seeds the 6 demo metrics and an opening ledger entry only if
    they are absent, so a restart never duplicates rows or breaks the chain."""
    if db.query(models.KiqMetric).filter(models.KiqMetric.org_id == DEMO_ORG).count() == 0:
        for m in DEMO_METRICS:
            db.add(models.KiqMetric(
                id=f"metric-{m['key']}",
                org_id=DEMO_ORG,
                key=m["key"],
                label=m["label"],
                value=m["value"],
                unit=m["unit"],
                confidence=m["confidence"],
                period=m["period"],
            ))
        db.commit()
    if db.query(models.KiqLedgerEntry).count() == 0:
        append_evidence(db, actor="seed", action="seed.load", subject=DEMO_ORG, payload={"metrics": len(DEMO_METRICS), "roles": len(ROLES)})
