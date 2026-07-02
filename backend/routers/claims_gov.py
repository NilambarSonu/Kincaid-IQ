from fastapi import APIRouter, HTTPException
from backend.service_container import container

router = APIRouter(prefix="/api/gov/claims", tags=["governance"])

@router.get("/")
def list_claims():
    return {"items": container.claims, "count": len(container.claims)}

@router.get("/{claim_id}")
def get_claim(claim_id: str):
    for item in container.claims:
        if item["claim_id"] == claim_id:
            return item
    raise HTTPException(status_code=404, detail="Claim not found")
