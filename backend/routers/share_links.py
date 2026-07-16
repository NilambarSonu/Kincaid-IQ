"""
Share Links — mint short branded links that restore a page's full view-state.

POST /api/share-links              create a link  → { short_id, page }
GET  /api/share-links/{short_id}   resolve a link → { short_id, page, state }
POST /api/share-links/{short_id}/email  email the link to a recipient

Links are unguessable (random short_id) but not access-controlled; the target
pages remain auth-gated. Creating/emailing requires auth; resolving is public so
the `/s/{short_id}` resolver can read it before the auth-gated page loads.
"""
import json
import html
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.routers.email_reports import EmailRequest, try_send_smtp

router = APIRouter(prefix="/api/share-links", tags=["share-links"])
logger = logging.getLogger(__name__)

VALID_PAGES = {"war-room", "benchmarking", "rx-defense", "broker-prospects", "sales-iq"}

PAGE_LABELS = {
    "war-room":         "CFO War Room",
    "benchmarking":     "Benefits Benchmarking",
    "rx-defense":       "PBM Contract Clarity 360™",
    "broker-prospects": "Broker Console",
}


class CreateShareIn(BaseModel):
    page: str
    state: dict = {}
    title: Optional[str] = None
    expires_in_hours: Optional[int] = None   # None / 0 / negative => never expires


class EmailShareIn(BaseModel):
    recipient: str
    note: Optional[str] = ""
    url: Optional[str] = None                  # full short URL as composed by the client
    sender_name: Optional[str] = "Kincaid Health"


def _gen_short_id(db: Session) -> str:
    """Generate a short, URL-safe, collision-free id."""
    for _ in range(10):
        sid = secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:8]
        if len(sid) >= 6 and not db.query(models.ShareLink).filter(models.ShareLink.short_id == sid).first():
            return sid
    # Extremely unlikely fallback
    return secrets.token_urlsafe(12).replace("-", "").replace("_", "")[:12]


def _build_share_email_html(url: str, note: str, sender_name: str) -> str:
    note_block = ""
    if (note or "").strip():
        safe_note = html.escape(note).replace(chr(10), "<br>")
        note_block = f"""
        <div style="margin:20px 0;padding:16px 20px;background:#F9FAFB;border-radius:8px;border-left:4px solid #6366F1;">
          <p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">{safe_note}</p>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#0c1a3a,#1a3a6e);border-radius:12px 12px 0 0;padding:32px 36px;">
          <span style="font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);">KINCAID HEALTH</span>
          <h1 style="font-size:22px;font-weight:800;color:white;margin:8px 0 4px;">A view has been shared with you</h1>
          <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">Fiduciary-Grade Healthcare Benefits Intelligence</p>
        </td></tr>
        <tr><td style="background:white;padding:32px 36px;">
          <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px;">
            <strong>{sender_name}</strong> shared a pre-loaded Kincaid Health view with you. Click below to open the
            exact dashboard, drill level, and filters they were looking at.
          </p>
          {note_block}
          <div style="text-align:center;margin:28px 0 8px;">
            <a href="{url}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:#6366F1;color:white;font-size:14px;font-weight:700;text-decoration:none;">Open the shared view →</a>
          </div>
          <p style="font-size:11px;color:#9CA3AF;margin:18px 0 0;line-height:1.6;word-break:break-all;">
            Or paste this link into your browser:<br>{url}
          </p>
        </td></tr>
        <tr><td style="background:#1F2937;border-radius:0 0 12px 12px;padding:20px 36px;">
          <p style="font-size:11px;color:rgba(255,255,255,0.5);margin:0;">Sent via the Kincaid Health platform</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


@router.post("")
def create_link(
    body: CreateShareIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if body.page not in VALID_PAGES:
        raise HTTPException(status_code=400, detail="Unknown page")
    sid = _gen_short_id(db)
    try:
        state_json = json.dumps(body.state or {})
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid state payload")
    expires_at = None
    if body.expires_in_hours and body.expires_in_hours > 0:
        expires_at = datetime.utcnow() + timedelta(hours=body.expires_in_hours)
    row = models.ShareLink(
        short_id=sid,
        page=body.page,
        state_json=state_json,
        title=body.title,
        created_by=getattr(user, "id", None),
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    logger.info(f"[ShareLink] created short_id={sid} page={body.page} expires_at={expires_at}")
    return {"short_id": sid, "page": body.page, "expires_at": expires_at.isoformat() if expires_at else None}


@router.get("")
def list_links(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """List share links created by the current user, newest first."""
    uid = getattr(user, "id", None)
    rows = (
        db.query(models.ShareLink)
        .filter(models.ShareLink.created_by == uid)
        .order_by(models.ShareLink.created_at.desc().nullslast(), models.ShareLink.id.desc())
        .all()
    )
    now = datetime.utcnow()
    out = []
    for row in rows:
        out.append({
            "short_id": row.short_id,
            "page": row.page,
            "page_label": PAGE_LABELS.get(row.page, "Kincaid Health"),
            "title": row.title,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "expires_at": row.expires_at.isoformat() if row.expires_at else None,
            "expired": bool(row.expires_at and row.expires_at < now),
        })
    return {"links": out}


@router.delete("/{short_id}")
def revoke_link(
    short_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Revoke (delete) a share link owned by the current user.

    After deletion the link resolves to the friendly "no longer available" state.
    """
    uid = getattr(user, "id", None)
    row = db.query(models.ShareLink).filter(models.ShareLink.short_id == short_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Share link not found")
    if row.created_by != uid:
        raise HTTPException(status_code=403, detail="Not your share link")
    db.delete(row)
    db.commit()
    logger.info(f"[ShareLink] revoked short_id={short_id} by user={uid}")
    return {"success": True, "short_id": short_id}


@router.get("/{short_id}")
def resolve_link(short_id: str, db: Session = Depends(get_db)):
    row = db.query(models.ShareLink).filter(models.ShareLink.short_id == short_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Share link not found")
    if row.expires_at and row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link expired")
    try:
        state = json.loads(row.state_json or "{}")
    except (TypeError, ValueError):
        state = {}
    return {
        "short_id": row.short_id,
        "page": row.page,
        "title": row.title,
        "state": state,
    }


@router.post("/{short_id}/email")
def email_link(
    short_id: str,
    body: EmailShareIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = db.query(models.ShareLink).filter(models.ShareLink.short_id == short_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Share link not found")
    if not (body.recipient or "").strip():
        raise HTTPException(status_code=400, detail="Recipient required")

    url = body.url or f"/s/{short_id}"
    label = PAGE_LABELS.get(row.page, "Kincaid Health")
    sender = body.sender_name or "Kincaid Health"
    subject = f"{sender} shared a {label} view with you"
    html = _build_share_email_html(url, body.note or "", sender)

    req = EmailRequest(
        report_type="share-link",
        recipients=[body.recipient.strip()],
        subject=subject,
        message=body.note or "",
        sender_name=sender,
        sender_title="Kincaid Health",
    )
    sent = try_send_smtp(req, html)
    logger.info(f"[ShareLink] email short_id={short_id} to={body.recipient} smtp_sent={sent}")
    return {
        "success": True,
        "smtp_sent": sent,
        "message": f"Link {'sent' if sent else 'queued'} for {body.recipient.strip()}.",
        "recipient": body.recipient.strip(),
    }
