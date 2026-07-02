"""
Claim Builder — constructs governed Claim objects from raw metric data.
Computes the evidence hash and returns a dict ready to be persisted.
Policy evaluation is not performed here; board-admissibility is derived
at query-time from the three canonical fields via policy_engine.
"""
import hashlib
import json
from typing import Optional, Union


def sha3(data: str) -> str:
    """First 16 hex chars of SHA3-256."""
    return hashlib.sha3_256(data.encode()).hexdigest()[:16]


def compute_evidence_hash(evidence_ids: list[str], transform_ids: list[str]) -> str:
    """
    Deterministic hash of the full evidence + transform provenance.
    Inputs are sorted so the hash is stable regardless of insertion order.
    """
    blob = json.dumps(
        {"evidence_ids": sorted(evidence_ids), "transform_ids": sorted(transform_ids)},
        sort_keys=True,
    )
    return sha3(blob)


def build_claim(
    *,
    kpi_key: str,
    title: str,
    value: Union[str, float, int],
    unit: Optional[str] = None,
    format: Optional[str] = None,
    period: Optional[str] = None,
    evidence_ids: list[str] | None = None,
    transform_ids: list[str] | None = None,
    verified_status: str = "UNVERIFIED",
    freshness_status: str = "GREEN",
    confidence_score: float = 0.0,
) -> dict:
    """
    Build a governed claim dict from raw inputs.
    Returns a dict ready to be passed as kwargs to a Claim model instance.
    Value is stored as a string in the DB; callers may pass numeric types.
    """
    evidence_ids = evidence_ids or []
    transform_ids = transform_ids or []
    evidence_hash = compute_evidence_hash(evidence_ids, transform_ids)

    return {
        "kpi_key": kpi_key,
        "title": title,
        "value": str(value),
        "unit": unit,
        "format": format,
        "period": period,
        "evidence_ids": json.dumps(evidence_ids),
        "transform_ids": json.dumps(transform_ids),
        "evidence_hash": evidence_hash,
        "verified_status": verified_status,
        "freshness_status": freshness_status,
        "confidence_score": float(confidence_score),
    }


def recompute_claim(claim_dict: dict) -> dict:
    """
    Recompute the evidence hash on an existing claim dict after a field update.
    Raises ValueError if the evidence_ids / transform_ids fields are unparseable,
    failing closed rather than silently rehashing empty provenance.
    """
    evidence_ids = _load_json_list_strict(claim_dict, "evidence_ids")
    transform_ids = _load_json_list_strict(claim_dict, "transform_ids")

    updated = build_claim(
        kpi_key=claim_dict.get("kpi_key", ""),
        title=claim_dict.get("title", ""),
        value=claim_dict.get("value", ""),
        unit=claim_dict.get("unit"),
        format=claim_dict.get("format"),
        period=claim_dict.get("period"),
        evidence_ids=evidence_ids,
        transform_ids=transform_ids,
        verified_status=claim_dict.get("verified_status", "UNVERIFIED"),
        freshness_status=claim_dict.get("freshness_status", "GREEN"),
        confidence_score=claim_dict.get("confidence_score", 0.0),
    )

    for k in ("id", "claim_id", "computed_at"):
        if k in claim_dict:
            updated[k] = claim_dict[k]
    return updated


def _load_json_list_strict(source: dict, key: str) -> list:
    """
    Parse a JSON-array field from a claim dict.
    Raises ValueError if the value is present but unparseable, so callers
    cannot accidentally rehash empty provenance on corrupt lineage data.
    """
    raw = source.get(key)
    if raw is None:
        return []
    if isinstance(raw, list):
        return raw
    try:
        result = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError(
            f"claim field '{key}' is not valid JSON: {raw!r}"
        ) from exc
    if not isinstance(result, list):
        raise ValueError(
            f"claim field '{key}' must be a JSON array, got {type(result).__name__}"
        )
    return result
