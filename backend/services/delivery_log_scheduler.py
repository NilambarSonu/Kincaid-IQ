"""
Delivery-log auto-email scheduler.

Runs hourly via the shared APScheduler instance in
`compliance_engine.scheduler` (registered at app startup). On each tick we
load every enabled `ClientPackageDeliverySchedule` whose `next_run_at` has
passed, regenerate the same CSV produced by
`GET /api/export/client-package/history.csv` for that user, and email it
to the configured compliance recipients.

Falls back to "queued" status when SMTP env vars are not configured —
identical pattern to `POST /api/export/client-package/email`.
"""
from __future__ import annotations

import csv as _csv
import io
import json
import logging
import os
import smtplib
import zipfile
from datetime import datetime, timezone
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from sqlalchemy.orm import Session

import backend.models as models

logger = logging.getLogger("kincaid.delivery_log_scheduler")


def _decode(raw) -> list[str]:
    if not raw:
        return []
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except Exception:
        return []


# ─── Data dictionary (README) for the deliveries CSV ──────────────────────────
#
# Single source of truth for the column documentation bundled alongside the CSV
# in the export ZIP. Shared by the download endpoint
# (GET /api/export/client-package/history.csv) and the scheduled compliance
# email so reviewers always get the same authoritative reference.
#
# Each entry: (column_name, plain-English description).
_CSV_COLUMN_DOCS: list[tuple[str, str]] = [
    ("timestamp",
     "ISO-8601 UTC timestamp of when the delivery was recorded (e.g. "
     "2026-06-11T13:00:00+00:00). May be blank for legacy rows with no "
     "recorded send time."),
    ("source",
     "Origin of the send. 'manual' = a broker triggered the email from the "
     "Client Package page; 'scheduled' = the automated delivery-log scheduler "
     "sent it; 'diff' = an emailed executive-summary diff sent from the AI "
     "History panel's 'Send diff' button (a before/after comparison, not a "
     "packaged ZIP); 'download' = the broker downloaded the package locally "
     "rather than emailing it. Defaults to 'manual' for rows recorded before "
     "the source field existed."),
    ("recipient",
     "Primary To: recipient(s), comma-separated. Built from the stored "
     "recipients list; falls back to the single legacy recipient address when "
     "no list was captured."),
    ("cc",
     "Carbon-copy (Cc:) addresses, comma-separated. Blank when there were no "
     "Cc recipients."),
    ("bcc_recipients (count only)",
     "The NUMBER of blind-carbon-copy (Bcc:) recipients at send time — never "
     "the addresses themselves. Individual Bcc addresses are intentionally not "
     "stored (see Privacy model below). 0 when there were no Bcc recipients."),
    ("subject",
     "Email subject line as sent."),
    ("filename",
     "Name of the attached package file (the .zip or .csv that was emailed)."),
    ("size_bytes",
     "Size of the attachment in bytes. 0 when the size was not recorded."),
    ("component_count",
     "Number of artifacts bundled inside the package (e.g. Rx Defense redline, "
     "scorecard, benchmarking reports, board pack). 0 for delivery-log emails, "
     "which carry the audit CSV only and have no package components."),
    ("ein",
     "Employer Identification Number the package was scoped to. Blank when the "
     "send was not scoped to a single employer (e.g. scheduled delivery-log "
     "emails)."),
    ("client_name",
     "Client / employer display name supplied at send time. Blank when none "
     "was provided."),
    ("smtp_sent",
     "'true' when SMTP actually delivered the message; 'false' when it was "
     "queued (SMTP not configured in this environment) or the send failed."),
    ("rx_defense_id",
     "Identifier of the Rx Defense contract the package was generated from. "
     "Blank when the send was not tied to an Rx Defense contract."),
]

# Single source of truth for the CSV header row. Derived directly from
# _CSV_COLUMN_DOCS so the README data dictionary and the written CSV header can
# never drift apart: documenting a column and writing it are the same list.
# Both the download endpoint (export_router.client_package_history_csv) and the
# scheduled compliance email (_build_history_csv_for_user) MUST write this
# constant rather than an inline literal.
CSV_HEADER: list[str] = [name for name, _ in _CSV_COLUMN_DOCS]

# Top-of-file note explaining the bcc_recipients column, written as the first
# CSV row. BCC addresses are intentionally never persisted (privacy by design —
# see Task #86); only the *count* of BCC recipients at send time is retained.
CSV_BCC_NOTE_ROW: list[str] = [
    "# bcc_recipients (count only) — individual BCC addresses are intentionally "
    "not stored; this column is the number of BCC recipients at send time.",
]


def build_csv_data_row(r: "models.ClientPackageDelivery") -> list:
    """
    Build one CSV data row for a delivery record, in the exact column order of
    CSV_HEADER. Shared by the download endpoint and the scheduled compliance
    email so both write identical rows.

    Raises RuntimeError if the produced row does not have exactly one value per
    documented column. This makes column drift fail loudly: anyone who adds or
    removes a value here without updating _CSV_COLUMN_DOCS (and therefore
    CSV_HEADER) will trip this guard instead of silently shipping a CSV whose
    body no longer matches its documented header.
    """
    recipients = _decode(r.recipients)
    recipient_field = ", ".join(recipients) if recipients else (r.recipient or "")
    cc_list = _decode(r.cc)
    components = _decode(r.components)
    row = [
        r.created_at.isoformat() if r.created_at else "",
        getattr(r, "source", None) or "manual",
        recipient_field,
        ", ".join(cc_list),
        int(r.bcc_count or 0),
        r.subject or "",
        r.filename or "",
        r.size_bytes or 0,
        r.component_count or len(components),
        r.ein or "",
        r.client_name or "",
        "true" if r.smtp_sent else "false",
        r.rx_defense_id or "",
    ]
    if len(row) != len(CSV_HEADER):
        raise RuntimeError(
            "Delivery CSV row/column drift: build_csv_data_row produced "
            f"{len(row)} value(s) but _CSV_COLUMN_DOCS documents "
            f"{len(CSV_HEADER)} column(s). Update _CSV_COLUMN_DOCS and "
            "build_csv_data_row together."
        )
    return row


def build_history_readme() -> str:
    """
    Build the data-dictionary README.txt that ships alongside the deliveries
    CSV inside the export ZIP. Documents every column and the privacy model.
    """
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines: list[str] = []
    lines.append("Kincaid IQ — Client-Package Delivery Log")
    lines.append("Data Dictionary & Audit README")
    lines.append("=" * 56)
    lines.append("")
    lines.append(f"Generated: {generated}")
    lines.append("")
    lines.append(
        "This package contains a CSV export of client-package email "
        "deliveries for a single Kincaid IQ user, intended for compliance "
        "review, audits, and RFP responses. Each row in the CSV is one "
        "delivery — a manually emailed package, a scheduled delivery-log "
        "email, an emailed executive-summary diff, or a local download (see "
        "the 'source' column below). This README documents every column so "
        "reviewers have a single authoritative reference."
    )
    lines.append("")
    lines.append("COLUMNS")
    lines.append("-" * 56)
    for name, desc in _CSV_COLUMN_DOCS:
        lines.append(f"{name}")
        # Simple indented wrap so the README reads cleanly in any text viewer.
        for chunk in _wrap(desc, 72):
            lines.append(f"    {chunk}")
        lines.append("")
    lines.append("PRIVACY MODEL")
    lines.append("-" * 56)
    for chunk in _wrap(
        "BCC addresses are never persisted. Blind-carbon-copy recipients are "
        "private by design — storing them would defeat the purpose of using "
        "Bcc and would expand the audit surface to addresses the other "
        "recipients were never meant to see. Only the COUNT of Bcc recipients "
        "at send time is retained, which is enough to prove how many parties "
        "received a delivery without disclosing who they were.", 72,
    ):
        lines.append(chunk)
    lines.append("")
    for chunk in _wrap(
        "Some fields can be blank/null. Fields such as ein, client_name, and "
        "rx_defense_id are only populated when a send is scoped to a specific "
        "employer or Rx Defense contract. Scheduled delivery-log emails carry "
        "the audit CSV only, so they have no ein, client_name, rx_defense_id, "
        "or package components (component_count = 0). Legacy rows recorded "
        "before a field existed may also be blank.", 72,
    ):
        lines.append(chunk)
    lines.append("")
    for chunk in _wrap(
        "smtp_sent reflects actual delivery. When SMTP is not configured in "
        "an environment, messages are queued rather than sent and smtp_sent is "
        "'false'. A 'false' value therefore does not necessarily indicate a "
        "failure — check the originating environment's mail configuration.", 72,
    ):
        lines.append(chunk)
    lines.append("")
    return "\n".join(lines)


def _wrap(text: str, width: int) -> list[str]:
    """Greedy word-wrap helper (no external deps) for README formatting."""
    words = text.split()
    out: list[str] = []
    cur = ""
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= width:
            cur += " " + w
        else:
            out.append(cur)
            cur = w
    if cur:
        out.append(cur)
    return out or [""]


def build_history_zip(csv_bytes: bytes, csv_filename: str) -> bytes:
    """
    Bundle the deliveries CSV and the data-dictionary README into a single ZIP.
    Shared by the download endpoint and the scheduled compliance email so both
    deliver the identical audit package.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(csv_filename, csv_bytes)
        zf.writestr("README.txt", build_history_readme().encode("utf-8"))
    return buf.getvalue()


def _build_history_csv_for_user(db: Session, user_id: str) -> tuple[bytes, int, dict[str, int]]:
    """
    Mirror of GET /api/export/client-package/history.csv (no filters).

    Returns the CSV bytes, the row count, and a per-source breakdown
    (e.g. {"manual": 4, "scheduled": 2, "diff": 1}) so callers — like the
    scheduled compliance email — can call out how many diff sends and other
    delivery types are included in the export.
    """
    rows = (
        db.query(models.ClientPackageDelivery)
        .filter(models.ClientPackageDelivery.user_id == user_id)
        .order_by(models.ClientPackageDelivery.created_at.desc())
        .all()
    )
    source_counts: dict[str, int] = {}
    for r in rows:
        key = getattr(r, "source", None) or "manual"
        source_counts[key] = source_counts.get(key, 0) + 1
    buf = io.StringIO()
    writer = _csv.writer(buf)
    writer.writerow(CSV_BCC_NOTE_ROW)
    writer.writerow(CSV_HEADER)
    for r in rows:
        writer.writerow(build_csv_data_row(r))
    return buf.getvalue().encode("utf-8"), len(rows), source_counts


def _freq_label(s: models.ClientPackageDeliverySchedule) -> str:
    if s.frequency == "monthly":
        return f"monthly (day {s.day_of_month or 1})"
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return f"weekly ({days[(s.day_of_week or 0) % 7]})"


def send_delivery_log_email_for_user(
    db: Session,
    user: models.User,
    schedule: models.ClientPackageDeliverySchedule,
    advance_next_run: bool = True,
) -> dict:
    """
    Build the CSV for `user`, attach it, and send to the schedule's recipients.
    Updates `last_run_at` / `last_status` / `last_error` / `last_row_count` and,
    if `advance_next_run`, recomputes `next_run_at` for the following period.
    Caller is responsible for committing the session.
    """
    # Local import to avoid a circular dependency with export_router.
    from backend.routers.export_router import _compute_next_run_at

    to_list = _decode(schedule.recipients)
    cc_list = _decode(schedule.cc)
    if not to_list:
        schedule.last_run_at = datetime.utcnow()
        schedule.last_status = "failed"
        schedule.last_error  = "No recipients configured"
        # No delivery row is written when there are no recipients — there is
        # nothing meaningful to surface in the audit log (the schedule's
        # `last_error` already captures the misconfiguration).
        return {"smtp_sent": False, "error": schedule.last_error, "row_count": 0}

    try:
        csv_bytes, row_count, source_counts = _build_history_csv_for_user(db, user.id)
    except Exception as e:
        logger.error(f"[DeliveryLog] CSV build failed for user={user.id}: {e}")
        schedule.last_run_at   = datetime.utcnow()
        schedule.last_status   = "failed"
        schedule.last_error    = f"CSV build failed: {e}"
        schedule.last_row_count = 0
        return {"smtp_sent": False, "error": schedule.last_error, "row_count": 0}

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    csv_filename = f"client-package-deliveries-{stamp}.csv"
    zip_bytes = build_history_zip(csv_bytes, csv_filename)
    filename = f"client-package-deliveries-{stamp}.zip"
    subject  = (schedule.subject or "").strip() or (
        f"[Kincaid IQ] {_freq_label(schedule).title()} client-package delivery log — {row_count} deliveries"
    )

    broker_label = getattr(user, "full_name", None) or getattr(user, "username", None) or getattr(user, "email", None) or "Broker"
    cadence      = _freq_label(schedule)
    breakdown_html = _source_breakdown_html(source_counts)
    html_body = (
        f"<!DOCTYPE html><html><body style='font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111;'>"
        f"<p>Attached is the <strong>{cadence}</strong> client-package delivery log for "
        f"<strong>{_html_escape(broker_label)}</strong>.</p>"
        f"<p style='color:#374151;font-size:13px;line-height:1.6;'>"
        f"The attached ZIP contains the delivery-log CSV produced by "
        f"<code>GET /api/export/client-package/history.csv</code> plus a "
        f"<code>README.txt</code> data dictionary documenting every column and "
        f"the privacy model. It contains <strong>{row_count}</strong> delivery record"
        f"{'s' if row_count != 1 else ''} as of "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}.</p>"
        f"{breakdown_html}"
        f"<p style='color:#9CA3AF;font-size:11px;'>Sent automatically by Kincaid IQ. "
        f"Manage this schedule on the Client Package page.</p>"
        f"</body></html>"
    )

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    smtp_sent = False
    error: Optional[str] = None

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"]    = f"Kincaid IQ <{smtp_user}>"
            msg["To"]      = ", ".join(to_list)
            if cc_list:
                msg["Cc"] = ", ".join(cc_list)

            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(html_body, "html"))
            msg.attach(alt)

            part = MIMEBase("application", "zip")
            part.set_payload(zip_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
                s.starttls()
                s.login(smtp_user, smtp_pass)
                s.sendmail(smtp_user, to_list + cc_list, msg.as_string())
            smtp_sent = True
        except Exception as e:
            logger.error(f"[DeliveryLog] SMTP failed for user={user.id}: {e}")
            error = str(e)
    else:
        error = "SMTP not configured — message queued for delivery."

    schedule.last_run_at    = datetime.utcnow()
    schedule.last_status    = "sent" if smtp_sent else ("queued" if smtp_host == "" else "failed")
    schedule.last_error     = None if smtp_sent else error
    schedule.last_row_count = row_count
    if advance_next_run:
        schedule.next_run_at = _compute_next_run_at(
            schedule.frequency,
            schedule.day_of_week,
            schedule.day_of_month,
            schedule.hour_utc,
            tz_name=getattr(schedule, "timezone", None) or "UTC",
        )

    # Write a ClientPackageDelivery audit row so the scheduled send shows up
    # in the broker's "Recent deliveries" panel alongside manual sends
    # (Task #104). `source='scheduled'` is what the UI keys off to render the
    # SCHEDULED badge and what the history endpoints expose as a filter.
    try:
        delivery = models.ClientPackageDelivery(
            user_id=user.id,
            recipient=to_list[0],
            recipients=json.dumps(to_list),
            cc=json.dumps(cc_list),
            bcc_count=0,
            subject=subject,
            filename=filename,
            size_bytes=len(zip_bytes),
            components=json.dumps([]),
            component_count=0,
            ein=None,
            rx_defense_id=None,
            client_name=None,
            smtp_sent=smtp_sent,
            source="scheduled",
        )
        db.add(delivery)
    except Exception as e:
        logger.error(f"[DeliveryLog] audit-row persist failed for user={user.id}: {e}")

    logger.info(
        f"[DeliveryLog] user={user.id} to={to_list} rows={row_count} "
        f"smtp_sent={smtp_sent} next={schedule.next_run_at}"
    )
    return {
        "smtp_sent": smtp_sent,
        "error":     error,
        "row_count": row_count,
        "filename":  filename,
        "recipients": to_list,
        "cc":         cc_list,
    }


def _html_escape(s: str) -> str:
    import html as _h
    return _h.escape(str(s or ""))


# Human-readable labels for each delivery `source` value, used in the
# scheduled compliance email's breakdown line so reviewers can see at a glance
# how many of the included rows are emailed executive-summary diffs vs.
# packaged sends.
_SOURCE_LABELS: dict[str, str] = {
    "manual":    "manual package email",
    "scheduled": "scheduled delivery-log email",
    "diff":      "emailed executive-summary diff",
    "download":  "local download",
    "resend":    "resent package email",
}


def _source_breakdown_html(source_counts: dict[str, int]) -> str:
    """
    Render a small "Includes:" line summarizing how many rows came from each
    source, e.g. "Includes: 4 manual package emails, 1 emailed executive-summary
    diff." Returns an empty string when there is nothing to break down so the
    email stays clean for single-source logs. Diff sends are always called out
    when present so compliance teams notice them in the audit export.
    """
    if not source_counts:
        return ""
    # Stable, meaningful ordering: known sources first, unknown sources after.
    order = ["manual", "scheduled", "diff", "download", "resend"]
    keys = [k for k in order if k in source_counts]
    keys += sorted(k for k in source_counts if k not in order)
    parts: list[str] = []
    for k in keys:
        n = source_counts[k]
        label = _SOURCE_LABELS.get(k, k)
        plural = "s" if n != 1 else ""
        parts.append(f"{n} {_html_escape(label)}{plural}")
    if not parts:
        return ""
    return (
        f"<p style='color:#374151;font-size:13px;line-height:1.6;'>"
        f"<strong>Includes:</strong> {', '.join(parts)}.</p>"
    )


def run_due_delivery_log_emails() -> dict:
    """
    APScheduler entry point. Fired hourly. Sends every schedule whose
    `enabled=True` and `next_run_at <= now`.
    """
    from backend.database import SessionLocal

    db = SessionLocal()
    fired = 0
    failed = 0
    try:
        now = datetime.utcnow()
        due = (
            db.query(models.ClientPackageDeliverySchedule)
            .filter(
                models.ClientPackageDeliverySchedule.enabled == True,  # noqa: E712
                models.ClientPackageDeliverySchedule.next_run_at != None,  # noqa: E711
                models.ClientPackageDeliverySchedule.next_run_at <= now,
            )
            .all()
        )
        for sched in due:
            user = db.query(models.User).filter(models.User.id == sched.user_id).first()
            if not user:
                # Orphaned schedule — disable so we don't keep retrying.
                sched.enabled    = False
                sched.last_status = "failed"
                sched.last_error = "Owner user no longer exists"
                failed += 1
                continue
            try:
                send_delivery_log_email_for_user(db, user, sched, advance_next_run=True)
                fired += 1
            except Exception as e:
                logger.error(f"[DeliveryLog] schedule id={sched.id} failed: {e}")
                sched.last_run_at = datetime.utcnow()
                sched.last_status = "failed"
                sched.last_error  = str(e)
                failed += 1
        if due:
            db.commit()
        logger.info(f"[DeliveryLog] hourly tick — {fired} sent, {failed} failed")
        return {"fired": fired, "failed": failed}
    except Exception as e:
        logger.error(f"[DeliveryLog] hourly tick crashed: {e}")
        db.rollback()
        return {"fired": fired, "failed": failed, "error": str(e)}
    finally:
        db.close()
