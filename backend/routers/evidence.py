from fastapi import APIRouter, HTTPException
from backend.service_container import container

router = APIRouter(prefix="/api/evidence", tags=["evidence"])

@router.get("/")
def list_evidence():
    return {"items": container.evidence, "count": len(container.evidence)}

@router.get("/{evidence_id}")
def get_evidence(evidence_id: str):
    for item in container.evidence:
        if item["evidence_id"] == evidence_id:
            return item
    raise HTTPException(status_code=404, detail="Evidence not found")
