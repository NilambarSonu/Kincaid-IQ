"""
Narrative router — claim-bound, citation-bound, policy-checked AI narratives.
No free-floating AI text is permitted on fiduciary surfaces.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.narrative_guard import validate_narrative_request, stamp_narrative

router = APIRouter(prefix="/api/narrative", tags=["narrative"])


class NarrativeRequest(BaseModel):
    claim_ids: list[str]
    prompt: str
    audience: str = "executive"  # board | executive | analyst | internal
    max_tokens: int = 500
    model: str = "gemini-2.5-flash"
    generated_by: str = "system"


class StampRequest(BaseModel):
    narrative_text: str
    claim_ids: list[str]
    model_used: str = "gemini-2.5-flash"
    generated_by: str = "system"


@router.post("/preflight")
def preflight(claim_ids: list[str], audience: str = "executive",
              db: Session = Depends(get_db)):
    """
    Pre-flight check before narrative generation.
    Returns allowed=True only if all claim_ids pass policy for the target audience.
    """
    return validate_narrative_request(db, claim_ids, audience)


@router.post("/generate")
def generate_narrative(req: NarrativeRequest, db: Session = Depends(get_db)):
    """
    Generate a policy-checked, claim-bound narrative.
    Calls preflight — if blocked, returns the blocking reasons without calling AI.
    Stamps the result with a decision receipt.
    """
    from backend.models import Claim
    import json

    preflight = validate_narrative_request(db, req.claim_ids, req.audience)
    if not preflight["allowed"]:
        return {
            "allowed": False,
            "narrative": None,
            "claim_citations": [],
            "receipt_id": None,
            "policy_blocked": True,
            "block_reason": f"{len(preflight['blocking_claims'])} claim(s) blocked: " +
                            "; ".join(b["reason"] for b in preflight["blocking_claims"][:3]),
            "generated_at": preflight["pre_flight_at"],
        }

    # Build context from claims
    claims_context = []
    for cid in req.claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if c:
            claims_context.append(f"- {c.title}: {c.value} {c.unit or ''} "
                                   f"(confidence {(c.confidence_score or 0)*100:.0f}%, {c.verified_status})")

    # Attempt AI generation via OpenAI if available
    narrative_text = None
    try:
        from backend.gemini_compat import SyncGeminiClient
        client = SyncGeminiClient()
        system = (
            f"You are a fiduciary-grade financial intelligence analyst for Kincaid Health. "
            f"You are writing for a {req.audience} audience. "
            f"Every factual claim you make MUST cite one of the provided governed data points. "
            f"Do not hallucinate or introduce facts not present in the evidence. "
            f"Keep to {req.max_tokens} tokens max."
        )
        evidence_block = "Governed evidence:\n" + "\n".join(claims_context)
        resp = client.chat.completions.create(
            model=req.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"{req.prompt}\n\n{evidence_block}"},
            ],
            max_tokens=req.max_tokens,
        )
        narrative_text = resp.choices[0].message.content
    except Exception as e:
        narrative_text = (
            f"[AI generation unavailable: {str(e)[:60]}]\n\n"
            "Based on governed data:\n" + "\n".join(claims_context)
        )

    # Stamp and create receipt
    result = stamp_narrative(
        db, narrative_text or "", req.claim_ids, req.model, req.generated_by
    )
    return {**result, "allowed": True, "policy_blocked": False, "block_reason": None}


@router.post("/stamp")
def stamp(req: StampRequest, db: Session = Depends(get_db)):
    """Stamp an externally-generated narrative with claim citations and a decision receipt."""
    return stamp_narrative(db, req.narrative_text, req.claim_ids, req.model_used, req.generated_by)
