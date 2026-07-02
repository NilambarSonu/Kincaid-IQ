import os
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from backend.database import get_db
from backend import models
from backend.auth import get_current_user

logger = logging.getLogger("kincaid.sms")

router = APIRouter(prefix="/api/sms", tags=["sms"])

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.environ.get("TWILIO_PHONE_NUMBER", "")


def _get_twilio_client():
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return None
    try:
        from twilio.rest import Client
        return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except ImportError:
        logger.error("Twilio package not installed")
        return None
    except Exception as e:
        logger.error(f"Twilio init error: {e}")
        return None


class SMSRequest(BaseModel):
    to: str
    message: str
    category: Optional[str] = "general"


class BulkSMSRequest(BaseModel):
    recipients: List[str]
    message: str
    category: Optional[str] = "general"


class SMSTemplateRequest(BaseModel):
    template: str
    to: str
    variables: Optional[dict] = {}


SMS_TEMPLATES = {
    "alert_high_cost": "⚠️ Kincaid IQ Alert: High healthcare cost detected — {amount} flagged in {category}. Log in to review: {link}",
    "compliance_deadline": "📋 Kincaid IQ: ERISA compliance deadline approaching — {deadline} for {requirement}. Action required.",
    "audit_ready": "✅ Kincaid IQ: Your DOL audit readiness score has been updated to {score}%. View your report: {link}",
    "claim_approved": "✔️ Kincaid IQ: Claim #{claim_id} has been approved for {amount}. Decision receipt available in your portal.",
    "renewal_reminder": "🔔 Kincaid IQ: Your {plan_name} plan renews on {date}. Review your coverage options: {link}",
    "weekly_digest": "📊 Kincaid IQ Weekly: EBITDA impact {ebitda}, Recoverable waste {waste}, Audit score {score}. Full report inside.",
    "security_alert": "🔐 Kincaid IQ Security: New login detected from {location} at {time}. If this wasn't you, contact support immediately.",
    "rx_savings": "💊 Kincaid IQ Rx Defense: Potential PBM savings of {savings} identified in your contract analysis. View now: {link}",
}


def _send_sms_sync(to: str, body: str) -> dict:
    client = _get_twilio_client()
    if not client:
        return {
            "success": False,
            "error": "Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to enable SMS.",
            "demo_mode": True,
            "would_send_to": to,
            "would_send_body": body,
        }

    if not TWILIO_PHONE_NUMBER:
        return {"success": False, "error": "TWILIO_PHONE_NUMBER not configured"}

    try:
        message = client.messages.create(
            body=body,
            from_=TWILIO_PHONE_NUMBER,
            to=to,
        )
        return {
            "success": True,
            "sid": message.sid,
            "status": message.status,
            "to": to,
        }
    except Exception as e:
        logger.error(f"SMS send failed to {to}: {e}")
        return {"success": False, "error": str(e), "to": to}


@router.get("/status")
def sms_status():
    configured = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER)
    return {
        "configured": configured,
        "from_number": TWILIO_PHONE_NUMBER if configured else None,
        "message": "Twilio SMS ready" if configured else "Add Twilio credentials to enable SMS sending",
    }


@router.get("/templates")
def get_templates(user: models.User = Depends(get_current_user)):
    return {
        "templates": [
            {"id": k, "preview": v[:80] + "..."}
            for k, v in SMS_TEMPLATES.items()
        ]
    }


@router.post("/send")
def send_sms(
    body: SMSRequest,
    user: models.User = Depends(get_current_user),
):
    result = _send_sms_sync(body.to, body.message)
    if result.get("success"):
        logger.info(f"SMS sent by {user.username} to {body.to} [{body.category}]")
    return result


@router.post("/send-bulk")
def send_bulk_sms(
    body: BulkSMSRequest,
    user: models.User = Depends(get_current_user),
):
    if len(body.recipients) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 recipients per bulk send")

    results = []
    for recipient in body.recipients:
        result = _send_sms_sync(recipient, body.message)
        results.append(result)

    success_count = sum(1 for r in results if r.get("success"))
    logger.info(f"Bulk SMS: {success_count}/{len(body.recipients)} sent by {user.username}")
    return {
        "total": len(body.recipients),
        "success": success_count,
        "failed": len(body.recipients) - success_count,
        "results": results,
    }


@router.post("/send-template")
def send_template_sms(
    body: SMSTemplateRequest,
    user: models.User = Depends(get_current_user),
):
    template = SMS_TEMPLATES.get(body.template)
    if not template:
        raise HTTPException(status_code=400, detail=f"Unknown template: {body.template}")

    try:
        message = template.format(**body.variables)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing template variable: {e}")

    result = _send_sms_sync(body.to, message)
    return result
