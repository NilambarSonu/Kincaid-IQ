from fastapi import APIRouter, HTTPException
from backend.service_container import container

router = APIRouter(prefix="/api/gov/receipts", tags=["governance"])

@router.get("/{claim_id}")
def get_receipt(claim_id: str):
    for claim in container.claims:
        if claim["claim_id"] == claim_id:
            return {
                "receipt_id": "r_demo",
                "claim": claim,
                "policy": claim["policy"],
                "evidence": container.evidence,
                "transforms": container.transforms,
                "summary": {
                    "evidence_count": len(container.evidence),
                    "transform_count": len(container.transforms),
                    "missing_evidence_count": 0,
                    "missing_transform_count": 0,
                },
                "assembled_at": "2026-03-10T00:00:00Z",
                "receipt_hash": "sha256:receipt",
            }
    raise HTTPException(status_code=404, detail="Receipt not found")
