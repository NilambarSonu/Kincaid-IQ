from fastapi import APIRouter

router = APIRouter(prefix="/api/gov/policy", tags=["governance"])

@router.post("/evaluate")
def evaluate_policy(payload: dict):
    claim = payload.get("claim", {})
    return {
        "policy": {
            "policy_id": "p_demo",
            "scope": payload.get("scope", "RENDER"),
            "decision": "ALLOW",
            "allowed": True,
            "verified_status": claim.get("verified_status", "VERIFIED"),
            "freshness_status": claim.get("freshness_status", "GREEN"),
            "confidence_score": claim.get("confidence_score", 0.94),
            "reason_code": "OK",
            "reason_detail": "Policy conditions satisfied.",
            "evaluated_at": "2026-03-10T00:00:00Z",
            "violations": [],
            "thresholds": {"minimum_confidence_score": 0.85},
        }
    }
