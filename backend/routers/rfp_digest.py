"""
RFP Intelligence OS — Intelligence Digest Email

Endpoints:
  GET  /api/rfp/digest/preferences   — read per-user digest preferences
  PUT  /api/rfp/digest/preferences   — upsert per-user digest preferences
  GET  /api/rfp/digest/preview       — assemble digest content (no send)
  POST /api/rfp/digest/send-now      — send digest immediately via SMTP

The digest contains up to four sections (each togglable):
  1. new_rfps       — RfpOpportunity rows ingested since last digest
  2. alerts_5500    — RfpMonitoringAlert rows not yet read
  3. top_opps       — top 5 opportunities by estimated_value
  4. deadlines      — opportunities with response_deadline within 14 days
"""
from __future__ import annotations

import json
import logging
import os
import smtplib
from base64 import b64decode
from datetime import datetime, timedelta
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user
from backend.database import get_db, SessionLocal

logger = logging.getLogger("kincaid.rfp_digest")
router = APIRouter(prefix="/api/rfp/digest", tags=["rfp-digest"])

from backend.config import settings as _kiq_settings

APP_BASE_URL = (os.environ.get("APP_BASE_URL") or _kiq_settings.base_url).rstrip("/")
GOLD = "#FBB724"
DARK = "#0c1a3a"


# ── Next-run scheduling helper (matches export_router._compute_next_run_at) ───

def _compute_next_run_at(frequency: str, day_of_week: Optional[int], hour_utc: int,
                         after: Optional[datetime] = None) -> datetime:
    """Return next UTC datetime when the digest should fire."""
    from datetime import timezone
    now = after or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    hour = max(0, min(23, int(hour_utc or 8)))
    base = now.replace(minute=0, second=0, microsecond=0, hour=hour)
    if frequency == "daily":
        candidate = base
        if candidate <= now:
            candidate = candidate + timedelta(days=1)
    else:
        dow = max(0, min(6, int(day_of_week or 1)))
        days_ahead = (dow - now.weekday()) % 7
        candidate = base + timedelta(days=days_ahead)
        if candidate <= now:
            candidate = candidate + timedelta(days=7)
    return candidate.replace(tzinfo=None)  # store as naive UTC


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class DigestPreferencesIn(BaseModel):
    enabled: bool = True
    frequency: str = "weekly"          # "daily" | "weekly"
    day_of_week: Optional[int] = 1     # 0=Mon..6=Sun (weekly only)
    hour_utc: int = 8                  # 0..23
    recipients: List[str] = []         # extra CC recipients
    sections_new_rfps: bool = True
    sections_alerts_5500: bool = True
    sections_top_opps: bool = True
    sections_deadlines: bool = True


class DigestPreferencesOut(DigestPreferencesIn):
    id: int
    user_id: str
    last_sent_at: Optional[datetime]
    next_run_at: Optional[datetime]
    last_attempt_at: Optional[datetime]
    last_error: Optional[str]
    updated_at: Optional[datetime]


# ── Helper: get-or-create preferences row ─────────────────────────────────────

def _get_or_create_prefs(user_id: str, db: Session) -> models.RfpDigestPreference:
    row = db.query(models.RfpDigestPreference).filter_by(user_id=user_id).first()
    if not row:
        row = models.RfpDigestPreference(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


# ── Digest content assembly ────────────────────────────────────────────────────

def _assemble_digest(user_id: str, prefs: models.RfpDigestPreference, db: Session) -> dict:
    """Build the digest data dict. Returns sections as lists of dicts."""
    since: datetime = prefs.last_sent_at or (datetime.utcnow() - timedelta(days=7))
    now = datetime.utcnow()

    sections: dict = {}

    # ── 1. New RFPs ────────────────────────────────────────────────────────────
    if prefs.sections_new_rfps:
        rows = (
            db.query(models.RfpOpportunity)
            .filter(
                models.RfpOpportunity.user_id == user_id,
                models.RfpOpportunity.created_at >= since,
            )
            .order_by(desc(models.RfpOpportunity.created_at))
            .limit(10)
            .all()
        )
        sections["new_rfps"] = [
            {
                "id": r.id,
                "title": r.title or r.employer_name or "Untitled RFP",
                "employer": r.employer_name or "Unknown",
                "score": r.opportunity_score,
                "tier": r.score_tier,
                "stage": r.stage,
                "due": r.due_date or r.response_deadline,
                "value": r.estimated_value or r.estimated_contract_value,
                "url": f"{APP_BASE_URL}/rfp-os?opp={r.id}",
            }
            for r in rows
        ]

    # ── 2. 5500 Monitoring Alerts ──────────────────────────────────────────────
    if prefs.sections_alerts_5500:
        alert_rows = (
            db.query(models.RfpMonitoringAlert)
            .filter(
                models.RfpMonitoringAlert.user_id == user_id,
                models.RfpMonitoringAlert.read == False,
            )
            .order_by(desc(models.RfpMonitoringAlert.created_at))
            .limit(10)
            .all()
        )
        sections["alerts_5500"] = [
            {
                "id": r.id,
                "type": r.alert_type,
                "summary": r.summary,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "url": f"{APP_BASE_URL}/5500-monitor?alert={r.id}",
            }
            for r in alert_rows
        ]

    # ── 3. Top Opportunities by Expected Value ─────────────────────────────────
    if prefs.sections_top_opps:
        top_rows = (
            db.query(models.RfpOpportunity)
            .filter(
                models.RfpOpportunity.user_id == user_id,
                models.RfpOpportunity.stage.notin_(["won", "lost", "no_bid"]),
            )
            .order_by(desc(models.RfpOpportunity.estimated_value))
            .limit(5)
            .all()
        )
        sections["top_opps"] = [
            {
                "id": r.id,
                "title": r.title or r.employer_name or "Untitled",
                "employer": r.employer_name or "Unknown",
                "value": r.estimated_value or r.estimated_contract_value,
                "score": r.opportunity_score,
                "tier": r.score_tier,
                "stage": r.stage,
                "url": f"{APP_BASE_URL}/rfp-os?opp={r.id}",
            }
            for r in top_rows
        ]

    # ── 4. Upcoming Deadlines ──────────────────────────────────────────────────
    if prefs.sections_deadlines:
        cutoff = (now + timedelta(days=14)).date().isoformat()
        today_iso = now.date().isoformat()
        deadline_rows = (
            db.query(models.RfpOpportunity)
            .filter(
                models.RfpOpportunity.user_id == user_id,
                models.RfpOpportunity.response_deadline != None,
                models.RfpOpportunity.response_deadline >= today_iso,
                models.RfpOpportunity.response_deadline <= cutoff,
                models.RfpOpportunity.stage.notin_(["won", "lost", "no_bid"]),
            )
            .order_by(models.RfpOpportunity.response_deadline)
            .limit(10)
            .all()
        )
        sections["deadlines"] = [
            {
                "id": r.id,
                "title": r.title or r.employer_name or "Untitled",
                "employer": r.employer_name or "Unknown",
                "deadline": r.response_deadline,
                "stage": r.stage,
                "value": r.estimated_value or r.estimated_contract_value,
                "url": f"{APP_BASE_URL}/rfp-os?opp={r.id}",
            }
            for r in deadline_rows
        ]

    has_content = any(bool(v) for v in sections.values())
    return {"sections": sections, "since": since.isoformat(), "has_content": has_content}


# ── HTML email builder ─────────────────────────────────────────────────────────

def _fmt_val(v: Optional[float]) -> str:
    if v is None:
        return "—"
    if v >= 1_000_000:
        return f"${v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"${v/1_000:.0f}K"
    return f"${v:,.0f}"


def _tier_badge(tier: Optional[str]) -> str:
    colors = {
        "pursue_aggressively": ("#10B981", "PURSUE"),
        "pursue_selectively":  ("#3B82F6", "SELECTIVE"),
        "monitor":             ("#F59E0B", "MONITOR"),
        "decline":             ("#EF4444", "DECLINE"),
    }
    col, label = colors.get(tier or "", ("#6B7280", "—"))
    return (
        f'<span style="display:inline-block;padding:1px 7px;border-radius:4px;'
        f'font-size:10px;font-weight:800;letter-spacing:0.1em;'
        f'background:{col}22;color:{col};border:1px solid {col}44;">{label}</span>'
    )


def _build_digest_html(digest: dict, frequency: str) -> str:
    sections = digest.get("sections", {})
    since_str = digest.get("since", "")[:10]
    freq_label = "Daily" if frequency == "daily" else "Weekly"

    # ── New RFPs section ───────────────────────────────────────────────────────
    new_rfps_html = ""
    new_rfps = sections.get("new_rfps", [])
    if new_rfps:
        rows_html = ""
        for item in new_rfps:
            score_str = f"{item['score']:.0f}" if item["score"] is not None else "—"
            rows_html += f"""
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;">
                <a href="{item['url']}" style="color:#FBB724;font-weight:700;font-size:13px;text-decoration:none;">{item['title']}</a>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">{item['employer']}</div>
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:center;">{_tier_badge(item['tier'])}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:right;font-size:12px;font-weight:700;color:#FBB724;">{score_str}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:right;font-size:12px;color:rgba(255,255,255,0.6);">{item['due'] or '—'}</td>
            </tr>"""
        new_rfps_html = f"""
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:4px;height:18px;background:#FBB724;border-radius:2px;"></div>
            <span style="font-size:13px;font-weight:800;color:#FBB724;letter-spacing:0.06em;text-transform:uppercase;">
              New RFPs Ingested ({len(new_rfps)})
            </span>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#0d1929;border-radius:8px;overflow:hidden;border:1px solid #1e2a45;">
            <thead>
              <tr style="background:#111f36;">
                <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">RFP</th>
                <th style="padding:8px 14px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Tier</th>
                <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Score</th>
                <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Due</th>
              </tr>
            </thead>
            <tbody>{rows_html}</tbody>
          </table>
        </div>"""

    # ── 5500 Alerts section ────────────────────────────────────────────────────
    alerts_html = ""
    alerts = sections.get("alerts_5500", [])
    if alerts:
        items_html = ""
        for a in alerts:
            items_html += f"""
            <div style="padding:10px 14px;border-bottom:1px solid #1e2a45;display:flex;align-items:flex-start;gap:10px;">
              <div style="width:6px;height:6px;border-radius:50%;background:#00D4FF;margin-top:5px;flex-shrink:0;"></div>
              <div>
                <div style="font-size:12px;color:rgba(255,255,255,0.85);">{a['summary']}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">{(a['created_at'] or '')[:10]}</div>
              </div>
              <a href="{a['url']}" style="margin-left:auto;font-size:10px;color:#00D4FF;font-weight:700;text-decoration:none;white-space:nowrap;">View →</a>
            </div>"""
        alerts_html = f"""
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:4px;height:18px;background:#00D4FF;border-radius:2px;"></div>
            <span style="font-size:13px;font-weight:800;color:#00D4FF;letter-spacing:0.06em;text-transform:uppercase;">
              5500 Monitoring Alerts ({len(alerts)} unread)
            </span>
          </div>
          <div style="background:#0d1929;border-radius:8px;overflow:hidden;border:1px solid #1e2a45;">{items_html}</div>
        </div>"""

    # ── Top Opportunities section ──────────────────────────────────────────────
    top_html = ""
    top_opps = sections.get("top_opps", [])
    if top_opps:
        rows_html = ""
        for i, item in enumerate(top_opps, 1):
            score_str = f"{item['score']:.0f}" if item["score"] is not None else "—"
            rows_html += f"""
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;font-size:12px;font-weight:700;color:rgba(255,255,255,0.3);width:28px;">#{i}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;">
                <a href="{item['url']}" style="color:white;font-weight:700;font-size:13px;text-decoration:none;">{item['title']}</a>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">{item['employer']}</div>
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:center;">{_tier_badge(item['tier'])}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:right;font-size:13px;font-weight:800;color:#10B981;">{_fmt_val(item['value'])}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:right;font-size:12px;font-weight:700;color:#FBB724;">{score_str}</td>
            </tr>"""
        top_html = f"""
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:4px;height:18px;background:#10B981;border-radius:2px;"></div>
            <span style="font-size:13px;font-weight:800;color:#10B981;letter-spacing:0.06em;text-transform:uppercase;">
              Top Opportunities by Expected Value
            </span>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#0d1929;border-radius:8px;overflow:hidden;border:1px solid #1e2a45;">
            <thead>
              <tr style="background:#111f36;">
                <th style="padding:8px 14px;font-size:10px;color:rgba(255,255,255,0.35);">#</th>
                <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Opportunity</th>
                <th style="padding:8px 14px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Tier</th>
                <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Value</th>
                <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Score</th>
              </tr>
            </thead>
            <tbody>{rows_html}</tbody>
          </table>
        </div>"""

    # ── Upcoming Deadlines section ─────────────────────────────────────────────
    deadlines_html = ""
    deadlines = sections.get("deadlines", [])
    if deadlines:
        items_html = ""
        for d in deadlines:
            days_left = "—"
            if d["deadline"]:
                try:
                    delta = (datetime.strptime(d["deadline"], "%Y-%m-%d") - datetime.utcnow()).days
                    days_left = f"{delta}d" if delta >= 0 else "OVERDUE"
                    color = "#EF4444" if delta <= 3 else "#F59E0B" if delta <= 7 else "#10B981"
                except Exception:
                    color = "#6B7280"
            else:
                color = "#6B7280"
            items_html += f"""
            <tr>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;">
                <a href="{d['url']}" style="color:white;font-weight:700;font-size:13px;text-decoration:none;">{d['title']}</a>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">{d['employer']}</div>
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:center;font-size:11px;color:rgba(255,255,255,0.6);">{d['deadline'] or '—'}</td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:center;">
                <span style="font-size:12px;font-weight:800;color:{color};">{days_left}</span>
              </td>
              <td style="padding:10px 14px;border-bottom:1px solid #1e2a45;text-align:right;font-size:12px;color:#10B981;font-weight:700;">{_fmt_val(d['value'])}</td>
            </tr>"""
        deadlines_html = f"""
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:4px;height:18px;background:#EF4444;border-radius:2px;"></div>
            <span style="font-size:13px;font-weight:800;color:#EF4444;letter-spacing:0.06em;text-transform:uppercase;">
              Upcoming Response Deadlines (Next 14 Days)
            </span>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#0d1929;border-radius:8px;overflow:hidden;border:1px solid #1e2a45;">
            <thead>
              <tr style="background:#111f36;">
                <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">RFP</th>
                <th style="padding:8px 14px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Deadline</th>
                <th style="padding:8px 14px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Days Left</th>
                <th style="padding:8px 14px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.1em;text-transform:uppercase;">Value</th>
              </tr>
            </thead>
            <tbody>{items_html}</tbody>
          </table>
        </div>"""

    body_content = new_rfps_html + alerts_html + top_html + deadlines_html

    if not body_content.strip():
        body_content = """
        <div style="padding:32px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;">
          Nothing new to report this period — your pipeline is quiet.
        </div>"""

    today_str = datetime.utcnow().strftime("%B %d, %Y")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#060d1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#060d1e;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0c1a3a 0%,#091528 100%);border-radius:12px 12px 0 0;padding:32px 36px;border-bottom:2px solid {GOLD}22;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <span style="font-size:9px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.35);">KINCAID IQ · RFP INTELLIGENCE OS</span>
              <h1 style="font-size:22px;font-weight:800;color:white;margin:8px 0 4px;">{freq_label} Intelligence Digest</h1>
              <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0;">{today_str} · Coverage from {since_str}</p>
            </div>
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(251,183,36,0.12);border:1px solid rgba(251,183,36,0.3);display:flex;align-items:center;justify-content:center;">
              <span style="font-size:22px;">📡</span>
            </div>
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#0d1929;padding:28px 36px;">
          {body_content}
          <div style="margin-top:24px;padding:16px 20px;background:rgba(251,183,36,0.06);border-radius:8px;border:1px solid rgba(251,183,36,0.15);text-align:center;">
            <a href="{APP_BASE_URL}/rfp-os" style="display:inline-block;padding:10px 28px;border-radius:8px;background:{GOLD};color:#060d1e;font-size:13px;font-weight:800;text-decoration:none;letter-spacing:0.04em;">
              Open RFP Intelligence OS →
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#070e1e;border-radius:0 0 12px 12px;padding:18px 36px;border-top:1px solid rgba(255,255,255,0.06);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);margin:0;">Kincaid IQ · RFP Intelligence OS™</p>
                <p style="font-size:10px;color:rgba(255,255,255,0.25);margin:3px 0 0;">
                  You're receiving this because you opted into {freq_label.lower()} digests.
                  <a href="{APP_BASE_URL}/digest-preferences" style="color:{GOLD};text-decoration:none;">Manage preferences →</a>
                </p>
              </td>
              <td align="right">
                <span style="font-size:9px;color:rgba(255,255,255,0.2);letter-spacing:0.1em;">KINCAID IQ™</span>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── SMTP sender (reuses env vars from email_reports.py) ───────────────────────

def _try_send(to_email: str, extra_recipients: List[str], subject: str, html: str) -> bool:
    host = os.environ.get("SMTP_HOST", "")
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    pwd  = os.environ.get("SMTP_PASS", "")
    if not (host and user and pwd):
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Kincaid IQ <{user}>"
        msg["To"]      = to_email
        all_recipients = list({to_email} | set(extra_recipients))
        if len(all_recipients) > 1:
            msg["Cc"] = ", ".join(all_recipients[1:])
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(host, port, timeout=15) as s:
            s.starttls()
            s.login(user, pwd)
            s.sendmail(user, all_recipients, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"[DigestEmail] SMTP failed: {e}")
        return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/preferences", response_model=DigestPreferencesOut)
def get_preferences(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = _get_or_create_prefs(user.id, db)
    return DigestPreferencesOut(
        id=row.id,
        user_id=row.user_id,
        enabled=row.enabled,
        frequency=row.frequency,
        day_of_week=row.day_of_week,
        hour_utc=row.hour_utc,
        recipients=json.loads(row.recipients or "[]"),
        sections_new_rfps=row.sections_new_rfps,
        sections_alerts_5500=row.sections_alerts_5500,
        sections_top_opps=row.sections_top_opps,
        sections_deadlines=row.sections_deadlines,
        last_sent_at=row.last_sent_at,
        next_run_at=row.next_run_at,
        last_attempt_at=row.last_attempt_at,
        last_error=row.last_error,
        updated_at=row.updated_at,
    )


@router.put("/preferences", response_model=DigestPreferencesOut)
def update_preferences(
    body: DigestPreferencesIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    row = _get_or_create_prefs(user.id, db)
    row.enabled              = body.enabled
    row.frequency            = body.frequency
    row.day_of_week          = body.day_of_week
    row.hour_utc             = body.hour_utc
    row.recipients           = json.dumps(body.recipients)
    row.sections_new_rfps    = body.sections_new_rfps
    row.sections_alerts_5500 = body.sections_alerts_5500
    row.sections_top_opps    = body.sections_top_opps
    row.sections_deadlines   = body.sections_deadlines
    if body.enabled:
        row.next_run_at = _compute_next_run_at(body.frequency, body.day_of_week, body.hour_utc)
    else:
        row.next_run_at = None
    db.commit()
    db.refresh(row)
    return DigestPreferencesOut(
        id=row.id,
        user_id=row.user_id,
        enabled=row.enabled,
        frequency=row.frequency,
        day_of_week=row.day_of_week,
        hour_utc=row.hour_utc,
        recipients=json.loads(row.recipients or "[]"),
        sections_new_rfps=row.sections_new_rfps,
        sections_alerts_5500=row.sections_alerts_5500,
        sections_top_opps=row.sections_top_opps,
        sections_deadlines=row.sections_deadlines,
        last_sent_at=row.last_sent_at,
        next_run_at=row.next_run_at,
        last_attempt_at=row.last_attempt_at,
        last_error=row.last_error,
        updated_at=row.updated_at,
    )


@router.get("/preview")
def preview_digest(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Return digest content as JSON (no email sent)."""
    prefs = _get_or_create_prefs(user.id, db)
    digest = _assemble_digest(user.id, prefs, db)
    return {
        "ok": True,
        "frequency": prefs.frequency,
        "enabled": prefs.enabled,
        "digest": digest,
    }


@router.post("/send-now")
def send_now(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Assemble and immediately send the digest to the authenticated user."""
    prefs = _get_or_create_prefs(user.id, db)

    if not user.email:
        raise HTTPException(status_code=400, detail="User has no email address configured.")

    digest = _assemble_digest(user.id, prefs, db)
    html   = _build_digest_html(digest, prefs.frequency)

    freq_label = "Daily" if prefs.frequency == "daily" else "Weekly"
    today_str  = datetime.utcnow().strftime("%B %d, %Y")
    subject    = f"RFP Intelligence Digest — {today_str}"

    extra = json.loads(prefs.recipients or "[]")
    now_utc = datetime.utcnow()
    sent  = _try_send(user.email, extra, subject, html)

    prefs.last_attempt_at = now_utc
    if sent:
        prefs.last_sent_at = now_utc
        prefs.last_error   = None
        if prefs.enabled:
            prefs.next_run_at = _compute_next_run_at(
                prefs.frequency, prefs.day_of_week, prefs.hour_utc,
                after=now_utc,
            )
    else:
        prefs.last_error = "SMTP not configured or send failed — window preserved for retry"
    db.commit()

    logger.info(
        f"[DigestEmail] user={user.id} smtp_sent={sent} "
        f"has_content={digest['has_content']} sections={list(digest['sections'].keys())}"
    )

    return {
        "ok": True,
        "smtp_sent": sent,
        "has_content": digest["has_content"],
        "subject": subject,
        "to": user.email,
        "sections_sent": list(digest["sections"].keys()),
        "message": (
            f"Digest sent to {user.email}." if sent
            else "SMTP not configured — digest assembled but not delivered. Configure SMTP_HOST, SMTP_USER, SMTP_PASS to enable delivery."
        ),
    }


# ── Scheduled background job (called by APScheduler hourly) ───────────────────

def run_due_rfp_digests() -> None:
    """
    Scan rfp_digest_preferences for rows where next_run_at <= now and enabled=True,
    then send each user's digest and advance next_run_at.

    Called by compliance_engine/scheduler.py on a CronTrigger(minute=15) — every
    hour at :15, so it runs after the delivery-log auto-email at :05.
    """
    from datetime import timezone

    db = SessionLocal()
    try:
        now_utc = datetime.utcnow()
        due_rows = (
            db.query(models.RfpDigestPreference)
            .filter(
                models.RfpDigestPreference.enabled == True,
                models.RfpDigestPreference.next_run_at != None,
                models.RfpDigestPreference.next_run_at <= now_utc,
            )
            .all()
        )
        logger.info(f"[DigestScheduler] found {len(due_rows)} due digest(s)")
        for row in due_rows:
            try:
                user = db.query(models.User).filter_by(id=row.user_id).first()
                if not user or not user.email:
                    logger.warning(f"[DigestScheduler] user {row.user_id} has no email, skipping")
                    row.next_run_at = _compute_next_run_at(
                        row.frequency, row.day_of_week, row.hour_utc, after=now_utc
                    )
                    db.commit()
                    continue

                digest  = _assemble_digest(row.user_id, row, db)
                html    = _build_digest_html(digest, row.frequency)
                today_str = now_utc.strftime("%B %d, %Y")
                subject = f"RFP Intelligence Digest — {today_str}"
                extra   = json.loads(row.recipients or "[]")
                sent    = _try_send(user.email, extra, subject, html)

                row.last_attempt_at = now_utc
                if sent:
                    row.last_sent_at = now_utc
                    row.last_error   = None
                    row.next_run_at  = _compute_next_run_at(
                        row.frequency, row.day_of_week, row.hour_utc, after=now_utc
                    )
                else:
                    row.last_error = "SMTP not configured or send failed — window preserved for retry"
                db.commit()
                logger.info(
                    f"[DigestScheduler] user={row.user_id} email={user.email} smtp={sent} "
                    f"sections={list(digest['sections'].keys())} "
                    f"next_run_at={row.next_run_at.isoformat() if row.next_run_at else 'None'}"
                )
            except Exception as exc:
                logger.error(f"[DigestScheduler] failed for user {row.user_id}: {exc}")
                db.rollback()
    except Exception as exc:
        logger.error(f"[DigestScheduler] scan failed: {exc}")
    finally:
        db.close()
