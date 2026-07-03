"""
Kincaid IQ · Contract Leakage Pipeline (DRAP reconciliation)
============================================================
The core sentence in code: DRAP = Sum(Paid - Allowable) across all claims,
computed per claim against an ingested contract fee schedule, rolled up by
category, breach-flagged against the contract tolerance (basis points), and
sealed into an immutable proof packet.

This is the deterministic, evidence-fixture port of the reference BFF pipeline
(§4.10). Everything is integer-cents arithmetic (no float drift), every
artifact carries a SHA-256 source hash, the run_hash is deterministic (identical
inputs, identical hash), and the proof packet ships a chain attestation over the
ordered claim source hashes.

Doctrine:
  - CERTIFIED: a claim reconciled against a matching fee schedule line.
  - INSUFFICIENT_EVIDENCE: a claim with no matching fee line. It never moves DRAP
    and is never coerced to zero (Hard Rule 04: narratives never outrun evidence).

Published benchmark, hand-derived and asserted exactly: on the 12-claim fixture
net DRAP is 2,860,500 cents ($28,605.00), gross overpaid 2,890,500, favorable
30,000. The War Room surface adds one orphan claim (NDC_UNKNOWN) so the
confidence census reads CERTIFIED 12 / INSUFFICIENT_EVIDENCE 1 without moving DRAP.

Prefix: /api/contract
"""
from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/contract", tags=["contract-leakage"])

CERTIFIED = "CERTIFIED"
INSUFFICIENT = "INSUFFICIENT_EVIDENCE"

DEMO_CONTRACT_ID = "CT_DEMO_PBM"

DEMO_TERMS: dict[str, Any] = {
    "vendor": "DEMO_PBM",
    "effective_date": "2026-01-01",
    "tolerance_bps": 200,
    "lines": [
        {"code_type": "NDC", "code": "NDC_A", "allowable_cents": 250000, "category": "SPREAD"},
        {"code_type": "NDC", "code": "NDC_B", "allowable_cents": 12000, "category": "SPREAD"},
        {"code_type": "ADMIN", "code": "ADMIN_PEPM", "allowable_cents": 4250, "category": "ADMIN_FEES"},
    ],
}

# The 12-claim published benchmark fixture: (code_type, code, qty, paid_cents).
DEMO_FIXTURE: list[tuple[str, str, int, int]] = [
    ("NDC", "NDC_A", 10, 280000), ("NDC", "NDC_A", 8, 291500), ("NDC", "NDC_A", 12, 275000), ("NDC", "NDC_A", 6, 305000),
    ("NDC", "NDC_B", 100, 13450), ("NDC", "NDC_B", 250, 12900), ("NDC", "NDC_B", 90, 14200), ("NDC", "NDC_B", 300, 12000), ("NDC", "NDC_B", 150, 11800),
    ("ADMIN", "ADMIN_PEPM", 1000, 4600), ("ADMIN", "ADMIN_PEPM", 1000, 4250), ("ADMIN", "ADMIN_PEPM", 980, 4975),
]
# One orphan claim with no matching fee schedule line: an INSUFFICIENT_EVIDENCE
# forensic signal that must never move DRAP nor be coerced to zero.
DEMO_ORPHAN: tuple[str, str, int, int] = ("NDC", "NDC_UNKNOWN", 40, 99000)

BENCHMARK = {"net_drap_cents": 2860500, "gross_overpaid_cents": 2890500, "favorable_cents": 30000}

CORE_SENTENCE = (
    "DRAP equals EBITDA leakage: net signed sum of paid minus allowable across all claims"
)


def _sha256(obj: Any) -> str:
    return hashlib.sha256(
        json.dumps(obj, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _round_half_up(x: float) -> int:
    """Half-up rounding to match the reference Math.round (not banker's rounding)."""
    return int(math.floor(x + 0.5)) if x >= 0 else int(math.ceil(x - 0.5))


def _terms_source_hash() -> str:
    return _sha256(DEMO_TERMS)


def _fee_lines() -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for i, line in enumerate(DEMO_TERMS["lines"]):
        lines.append({"line_id": f"FSL_{i + 1:02d}", "basis": "PER_UNIT", **line})
    return lines


def _demo_claims(include_orphan: bool = True) -> list[dict[str, Any]]:
    rows: list[tuple[str, str, int, int]] = list(DEMO_FIXTURE)
    if include_orphan:
        rows = rows + [DEMO_ORPHAN]
    claims: list[dict[str, Any]] = []
    for i, (ct, code, qty, paid) in enumerate(rows):
        source_hash = _sha256({"ct": ct, "code": code, "d": "2026-01-15", "q": qty, "p": paid, "i": i})
        claims.append({
            "claim_id": f"CLM_DEMO_{i + 1:02d}",
            "code_type": ct, "code": code, "service_date": "2026-01-15",
            "qty": qty, "paid_cents": paid, "source_hash": source_hash,
        })
    return claims


def _reconcile(terms: dict[str, Any], fee_lines: list[dict[str, Any]], claims: list[dict[str, Any]]) -> dict[str, Any]:
    tolerance_bps = int(terms["tolerance_bps"])
    index = {f'{l["code_type"]}|{l["code"]}': l for l in fee_lines}

    net = gross_over = favorable = breach_count = unmatched = 0
    categories: dict[str, dict[str, int]] = {}
    receipts: list[dict[str, Any]] = []

    for c in claims:
        line = index.get(f'{c["code_type"]}|{c["code"]}')
        if not line:
            unmatched += 1
            receipts.append({
                "claim_id": c["claim_id"], "code": c["code"], "code_type": c["code_type"],
                "qty": c["qty"], "paid_cents": c["paid_cents"],
                "allowable_cents": None, "variance_cents": None, "unit_over_bps": None,
                "breach": False, "confidence": INSUFFICIENT,
                "note": "no fee schedule line matches this claim; missing terms are a forensic signal, not a zero",
                "claim_source_hash": c["source_hash"],
            })
            continue

        allowable = int(line["allowable_cents"])
        variance = (int(c["paid_cents"]) - allowable) * int(c["qty"])
        net += variance
        if variance > 0:
            gross_over += variance
        if variance < 0:
            favorable += -variance
        unit_over_bps = _round_half_up(((int(c["paid_cents"]) - allowable) / allowable) * 10000) if allowable > 0 else 0
        is_breach = unit_over_bps > tolerance_bps
        if is_breach:
            breach_count += 1
        cat = line["category"]
        roll = categories.setdefault(cat, {"variance_cents": 0, "claims": 0, "breaches": 0})
        roll["variance_cents"] += variance
        roll["claims"] += 1
        if is_breach:
            roll["breaches"] += 1
        receipts.append({
            "claim_id": c["claim_id"], "code": c["code"], "code_type": c["code_type"],
            "qty": c["qty"], "paid_cents": c["paid_cents"],
            "allowable_cents": allowable, "variance_cents": variance, "unit_over_bps": unit_over_bps,
            "breach": is_breach, "confidence": CERTIFIED,
            "claim_source_hash": c["source_hash"], "fee_line_id": line["line_id"],
        })

    claimset_hash = _sha256([c["source_hash"] for c in claims])
    run_hash = _sha256({
        "terms": _terms_source_hash(),
        "claimset": claimset_hash,
        "receipts": [{"id": r["claim_id"], "v": r["variance_cents"], "b": r["breach"]} for r in receipts],
    })
    return {
        "run_id": f"RECON_{run_hash[:12]}",
        "contract_id": DEMO_CONTRACT_ID,
        "drap_cents": net,
        "gross_overpaid_cents": gross_over,
        "favorable_cents": favorable,
        "breach_count": breach_count,
        "unmatched_claims": unmatched,
        "categories": categories,
        "receipts": receipts,
        "claimset_hash": claimset_hash,
        "run_hash": run_hash,
        "core_sentence": CORE_SENTENCE,
    }


def _proof_packet(terms: dict[str, Any], recon: dict[str, Any], fee_lines: list[dict[str, Any]]) -> dict[str, Any]:
    receipts = recon["receipts"]
    certified = sum(1 for r in receipts if r["confidence"] == CERTIFIED)
    insufficient = sum(1 for r in receipts if r["confidence"] == INSUFFICIENT)

    # Honest integrity chain over every ordered evidence artifact actually chained:
    # the terms hash, each fee schedule line, then each claim source hash. events_checked
    # counts only what genuinely enters the chain (Hard Rule 3 posture, no inflation).
    artifacts = (
        [_terms_source_hash()]
        + [_sha256({"line": l["line_id"], "code": f'{l["code_type"]}|{l["code"]}', "allowable": l["allowable_cents"]}) for l in fee_lines]
        + [r["claim_source_hash"] for r in receipts]
    )
    head = ""
    for artifact in artifacts:
        head = _sha256({"prev": head, "artifact": artifact})

    components = {
        "contract_reference": {
            "contract_id": DEMO_CONTRACT_ID, "vendor": terms["vendor"],
            "effective_date": terms["effective_date"], "terms_source_hash": _terms_source_hash(),
            "tolerance_bps": terms["tolerance_bps"],
        },
        "claimset_reference": {"claimset_hash": recon["claimset_hash"], "claims": len(receipts)},
        "drap": {
            "net_cents": recon["drap_cents"],
            "gross_overpaid_cents": recon["gross_overpaid_cents"],
            "favorable_cents": recon["favorable_cents"],
            "formula": "DRAP = sum over claims of (paid_cents minus allowable_cents) times qty",
        },
        "category_rollups": recon["categories"],
        "confidence_census": {
            "CERTIFIED": certified, "INSUFFICIENT_EVIDENCE": insufficient,
            "note": "CERTIFIED is relative to the ingested artifacts; provenance is stated in the contract and claim source hashes",
        },
        "breach_summary": {"breach_count": recon["breach_count"], "tolerance_bps": terms["tolerance_bps"]},
        "chain_attestation": {
            "valid": True, "events_checked": len(artifacts), "breaks": 0, "head_hash": head,
            "note": "integrity chain computed over the fixture artifacts (terms, fee lines, claims); deterministic demo, not an external ledger verification",
        },
    }
    content_hash = _sha256({
        "run_hash": recon["run_hash"], "drap": recon["drap_cents"],
        "receipts": [r["claim_id"] for r in receipts],
    })
    return {
        "packet_id": f"PKT_{content_hash[:12]}",
        "run_id": recon["run_id"],
        "components": components,
        "content_hash": content_hash,
        "chain_head_hash": head,
    }


class ReconcileReq(BaseModel):
    contract_id: Optional[str] = DEMO_CONTRACT_ID
    include_orphan: bool = True


class ProofReq(BaseModel):
    run_id: Optional[str] = None
    include_orphan: bool = True


@router.get("/leakage/demo")
def leakage_demo(user: models.User = Depends(get_current_user)) -> dict[str, Any]:
    """One-shot War Room surface: seed terms + fixture, reconcile, and seal the packet."""
    fee_lines = _fee_lines()
    claims = _demo_claims(include_orphan=True)
    recon = _reconcile(DEMO_TERMS, fee_lines, claims)
    packet = _proof_packet(DEMO_TERMS, recon, fee_lines)
    return {
        "contract": {
            "contract_id": DEMO_CONTRACT_ID, "vendor": DEMO_TERMS["vendor"],
            "effective_date": DEMO_TERMS["effective_date"], "tolerance_bps": DEMO_TERMS["tolerance_bps"],
            "terms_source_hash": _terms_source_hash(), "fee_lines": fee_lines,
        },
        "reconciliation": recon,
        "proof_packet": packet,
        "benchmark": BENCHMARK,
    }


@router.post("/demo/seed")
def demo_seed(user: models.User = Depends(get_current_user)) -> dict[str, Any]:
    return {"contract_id": DEMO_CONTRACT_ID, "claims": len(DEMO_FIXTURE), "benchmark": BENCHMARK}


@router.post("/reconcile")
def reconcile(body: Optional[ReconcileReq] = None, user: models.User = Depends(get_current_user)) -> dict[str, Any]:
    body = body or ReconcileReq()
    fee_lines = _fee_lines()
    claims = _demo_claims(include_orphan=body.include_orphan)
    return _reconcile(DEMO_TERMS, fee_lines, claims)


@router.post("/proof-packet")
def proof_packet(body: Optional[ProofReq] = None, user: models.User = Depends(get_current_user)) -> dict[str, Any]:
    body = body or ProofReq()
    fee_lines = _fee_lines()
    claims = _demo_claims(include_orphan=body.include_orphan)
    recon = _reconcile(DEMO_TERMS, fee_lines, claims)
    return _proof_packet(DEMO_TERMS, recon, fee_lines)
