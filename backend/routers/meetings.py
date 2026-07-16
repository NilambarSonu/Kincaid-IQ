import json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend import models
from backend.routers.ai import call_anthropic

logger = logging.getLogger("kincaid.meetings")
router = APIRouter(prefix="/api/meetings", tags=["meetings"])


class MeetingCreate(BaseModel):
    title: str
    client_name: str
    meeting_type: str = "advisory"
    date: str
    duration_mins: Optional[int] = None


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    transcript: Optional[str] = None
    duration_mins: Optional[int] = None
    status: Optional[str] = None


def _serialize(session: models.MeetingSession) -> dict:
    analysis = None
    if session.ai_analysis:
        try:
            analysis = json.loads(session.ai_analysis)
        except Exception:
            analysis = None
    return {
        "id": session.id,
        "title": session.title,
        "client_name": session.client_name,
        "meeting_type": session.meeting_type,
        "date": session.date,
        "duration_mins": session.duration_mins,
        "status": session.status,
        "transcript": session.transcript,
        "ai_analysis": analysis,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "updated_at": session.updated_at.isoformat() if session.updated_at else None,
    }


@router.get("")
async def list_meetings(db: Session = Depends(get_db)):
    rows = (
        db.query(models.MeetingSession)
        .order_by(models.MeetingSession.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in rows]


@router.post("")
async def create_meeting(payload: MeetingCreate, db: Session = Depends(get_db)):
    session = models.MeetingSession(
        title=payload.title,
        client_name=payload.client_name,
        meeting_type=payload.meeting_type,
        date=payload.date,
        duration_mins=payload.duration_mins,
        status="draft",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    logger.info(f"[Meetings] Created session #{session.id} — {session.client_name}")
    return _serialize(session)


@router.patch("/{session_id}")
async def update_meeting(
    session_id: int, payload: MeetingUpdate, db: Session = Depends(get_db)
):
    session = (
        db.query(models.MeetingSession)
        .filter(models.MeetingSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if payload.title is not None:
        session.title = payload.title
    if payload.client_name is not None:
        session.client_name = payload.client_name
    if payload.transcript is not None:
        session.transcript = payload.transcript
    if payload.duration_mins is not None:
        session.duration_mins = payload.duration_mins
    if payload.status is not None:
        session.status = payload.status
    db.commit()
    db.refresh(session)
    return _serialize(session)


@router.post("/{session_id}/analyze")
async def analyze_meeting(session_id: int, db: Session = Depends(get_db)):
    session = (
        db.query(models.MeetingSession)
        .filter(models.MeetingSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if not session.transcript or len(session.transcript.strip()) < 20:
        raise HTTPException(
            status_code=400,
            detail="Transcript must be at least 20 characters before analysis",
        )

    session.status = "analyzing"
    db.commit()

    prompt = f"""You are a fiduciary intelligence analyst for Kincaid Health, a Private Banking & Healthcare Fiduciary Intelligence Platform. Analyze the following client meeting transcript.

Meeting Details:
- Client: {session.client_name}
- Meeting Type: {session.meeting_type}
- Date: {session.date}

Transcript:
{session.transcript}

Return a JSON object (no markdown, no extra text):
{{
  "sentiment": "bullish" or "neutral" or "cautious" or "bearish" or "concerned",
  "sentiment_reason": "one concise sentence explaining the sentiment",
  "kiq_score": <integer 0-100, meeting quality / advisor effectiveness>,
  "key_topics": ["up to 6 short topic labels discussed in the meeting"],
  "action_items": [
    {{"item": "specific action", "assignee": "Advisor" or "Client" or "Both", "priority": "high" or "medium" or "low", "due": "timeframe string"}}
  ],
  "portfolio_signals": [
    {{"signal": "brief description", "type": "risk" or "opportunity" or "rebalance" or "liquidity" or "tax", "urgency": "immediate" or "near-term" or "long-term"}}
  ],
  "follow_up_recommendations": ["up to 4 recommended follow-up actions for the advisor"],
  "fiduciary_summary": "2-3 paragraph professional meeting summary suitable for compliance and fiduciary records. Include key decisions, recommendations discussed, and agreed next steps."
}}"""

    try:
        raw = await call_anthropic(prompt)
        raw = raw.strip()
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                if part.startswith("json"):
                    raw = part[4:].strip()
                    break
                elif "{" in part:
                    raw = part.strip()
                    break
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            raw = raw[start:end]
        analysis = json.loads(raw)
    except Exception as e:
        logger.warning(f"[Meetings] AI analysis fallback for #{session_id}: {e}")
        analysis = {
            "sentiment": "neutral",
            "sentiment_reason": "Analysis could not be completed at this time.",
            "kiq_score": 70,
            "key_topics": ["Meeting recorded"],
            "action_items": [],
            "portfolio_signals": [],
            "follow_up_recommendations": ["Review transcript manually", "Schedule follow-up"],
            "fiduciary_summary": (
                f"Meeting with {session.client_name} on {session.date} was recorded. "
                "Transcript has been logged for compliance review. "
                "Manual review recommended to extract action items and follow-up requirements."
            ),
        }

    session.ai_analysis = json.dumps(analysis)
    session.status = "analyzed"
    db.commit()
    db.refresh(session)
    logger.info(f"[Meetings] Analysis complete for #{session_id} — KIQ Score: {analysis.get('kiq_score')}")
    return _serialize(session)


@router.delete("/{session_id}")
async def delete_meeting(session_id: int, db: Session = Depends(get_db)):
    session = (
        db.query(models.MeetingSession)
        .filter(models.MeetingSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(session)
    db.commit()
    return {"status": "deleted", "id": session_id}
