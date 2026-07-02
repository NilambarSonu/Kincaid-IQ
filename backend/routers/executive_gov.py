from fastapi import APIRouter
from backend.service_container import container

router = APIRouter(prefix="/api/gov/executive", tags=["governance"])

@router.get("/dashboard")
def get_dashboard():
    claim = container.claims[0]
    return {
        "dashboard_id": "d_demo",
        "tile_count": len(container.claims),
        "tiles": [
            {
                "id": f"tile_{c['claim_id']}",
                "title": c["title"],
                "severity": "GREEN",
                "primaryClaim": c,
                "trendClaim": None,
                "narrativePreview": [],
                "drillPath": f"/drill/ebitda",
                "policy": c["policy"],
                "evidence": [{"evidence_id": e} for e in c["evidence_ids"]],
                "transforms": [{"transform_id": t} for t in c["transform_ids"]],
            }
            for c in container.claims
        ],
        "trust_summary": {
            "total": len(container.claims),
            "verified_count": sum(1 for c in container.claims if c.get("verified_status") == "VERIFIED"),
            "stale_count": 0,
            "low_confidence_count": sum(1 for c in container.claims if c.get("confidence_score", 1) < 0.85),
            "export_ready": True,
        },
        "assembled_at": "2026-03-10T00:00:00Z",
    }
