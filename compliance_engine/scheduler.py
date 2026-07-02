"""APScheduler recurring compliance control checks."""
import hashlib
import json
import logging
import os
import socket
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.database import SessionLocal
from compliance_engine.models.controls import ComplianceControl
from compliance_engine.models.evidence import ComplianceEvidence
from compliance_engine.models.findings import ComplianceFinding

logger = logging.getLogger("kincaid.compliance.scheduler")

_scheduler: BackgroundScheduler | None = None


def _flag_overdue_controls():
    """Mark controls whose next_review_at has passed as needing attention."""
    db = SessionLocal()
    try:
        overdue = db.query(ComplianceControl).filter(
            ComplianceControl.next_review_at != None,
            ComplianceControl.next_review_at < datetime.utcnow(),
            ComplianceControl.status == "pass",
        ).all()
        for ctrl in overdue:
            ctrl.status = "not_tested"
            logger.info(f"[Scheduler] Control {ctrl.control_id} marked not_tested (review overdue)")
        if overdue:
            db.commit()
        logger.info(f"[Scheduler] Overdue control check done — {len(overdue)} controls reset")
    except Exception as e:
        logger.error(f"[Scheduler] Overdue control check failed: {e}")
    finally:
        db.close()


def _auto_close_false_positive_findings():
    """Auto-close findings marked as false positives."""
    db = SessionLocal()
    try:
        fp_findings = db.query(ComplianceFinding).filter(
            ComplianceFinding.false_positive == 1,
            ComplianceFinding.status == "open",
        ).all()
        for f in fp_findings:
            f.status = "false_positive"
            f.closed_at = datetime.utcnow()
        if fp_findings:
            db.commit()
        logger.info(f"[Scheduler] Auto-closed {len(fp_findings)} false-positive findings")
    except Exception as e:
        logger.error(f"[Scheduler] False positive cleanup failed: {e}")
    finally:
        db.close()


def _set_review_dates_for_new_controls():
    """Set next_review_at = 90 days from now for controls that don't have one."""
    db = SessionLocal()
    try:
        controls = db.query(ComplianceControl).filter(
            ComplianceControl.next_review_at == None,
            ComplianceControl.status == "pass",
        ).all()
        cutoff = datetime.utcnow() + timedelta(days=90)
        for ctrl in controls:
            ctrl.next_review_at = cutoff
        if controls:
            db.commit()
        logger.info(f"[Scheduler] Set review dates for {len(controls)} controls")
    except Exception as e:
        logger.error(f"[Scheduler] Review date setter failed: {e}")
    finally:
        db.close()


def _daily_automated_evidence_refresh():
    """
    Daily 6 AM job: collect automated evidence for every control
    that has automated=True.

    - Network scan: runs against COMPLIANCE_SCAN_TARGET env var (if set).
    - GitHub MFA / AWS IAM: skipped here; those collectors require
      per-user credentials supplied via the API. They can be triggered
      on-demand from the Auto-Collect tab in the Compliance Engine UI.
    """
    scan_target = os.environ.get("COMPLIANCE_SCAN_TARGET", "").strip()
    db = SessionLocal()
    collected = 0
    skipped = 0
    try:
        auto_controls = db.query(ComplianceControl).filter(
            ComplianceControl.automated == True  # noqa: E712
        ).all()

        for ctrl in auto_controls:
            try:
                if ctrl.domain and "network" in ctrl.domain.lower() and scan_target:
                    _run_tcp_scan_for_control(db, ctrl, scan_target)
                    collected += 1
                else:
                    skipped += 1
            except Exception as exc:
                logger.warning(
                    f"[Scheduler] Evidence collection failed for control {ctrl.control_id}: {exc}"
                )

        if collected:
            db.commit()
        logger.info(
            f"[Scheduler] Daily evidence refresh complete — "
            f"{collected} collected, {skipped} skipped (no target or not automated)"
        )
    except Exception as exc:
        logger.error(f"[Scheduler] Daily evidence refresh job failed: {exc}")
    finally:
        db.close()


def _run_tcp_scan_for_control(db: SessionLocal, ctrl: ComplianceControl, target: str):  # type: ignore[valid-type]
    """Run a TCP port scan and store the result as a ComplianceEvidence record."""
    ports = [22, 80, 443, 3306, 5432, 6379, 8080, 8443]
    results = []
    for port in ports:
        status = "closed"
        try:
            with socket.create_connection((target, port), timeout=2):
                status = "open"
        except (socket.timeout, ConnectionRefusedError, OSError):
            pass
        results.append({"port": port, "status": status})

    open_ports = [r["port"] for r in results if r["status"] == "open"]
    payload = {
        "target": target,
        "ports_scanned": ports,
        "results": results,
        "open_ports": open_ports,
        "open_count": len(open_ports),
        "evidence_type": "vuln_scan_report",
        "collector": "scheduled-tcp-scan",
        "collected_at": datetime.utcnow().isoformat(),
    }
    content = json.dumps(payload, indent=2)
    content_bytes = content.encode("utf-8")
    ev = ComplianceEvidence(
        control_id=ctrl.id,
        filename=f"scheduled_scan_{target.replace('.', '_')}.json",
        original_name=f"scheduled_scan_{target.replace('.', '_')}.json",
        file_type="application/json",
        file_size=len(content_bytes),
        description=f"Scheduled daily TCP scan of {target}",
        uploaded_by="scheduler",
        file_content=content,
        source="automated",
        collection_method="scheduled-tcp-scan",
        evidence_type="vuln_scan_report",
        hash_val=hashlib.sha256(content_bytes).hexdigest(),
    )
    db.add(ev)
    logger.info(
        f"[Scheduler] TCP scan evidence stored for control {ctrl.control_id} "
        f"— {len(open_ports)} open port(s) on {target}"
    )


def _rfp_new_filing_alarm(user_id: int | None = None) -> list[dict]:
    """
    Detect new Form 5500 filings for watched EINs.
    Compares each watch's last_seen_year against the latest year in DuckDB.
    Writes RfpAlert records and sends email if SMTP is configured.
    Degrades gracefully when DuckDB or SMTP is unavailable.

    Runs nightly across all watches (user_id=None), or on-demand for a single
    user's watches when user_id is supplied (the "Check Now" button). Returns a
    list of newly-detected filing dicts so callers can render results inline.
    """
    from backend.database import SessionLocal
    from backend import models
    from backend.duckdb import get_duck, duck_available
    import smtplib, os

    if not duck_available():
        logger.info("[RFP Alarm] DuckDB not available — skipping")
        return []

    detected: list[dict] = []
    db = SessionLocal()
    try:
        watch_q = db.query(models.RfpWatchlistEntry)
        if user_id is not None:
            watch_q = watch_q.filter(models.RfpWatchlistEntry.user_id == user_id)
        watches = watch_q.all()
        if not watches:
            return detected

        duck = get_duck()
        alerted = 0

        for watch in watches:
            try:
                # Primary freshness check: f5500_filings (PostgreSQL) — matches the canonical
                # import pipeline and avoids DuckDB staleness. DuckDB used only for $ highlights.
                from sqlalchemy import text as _sql
                pg_row = db.execute(_sql(
                    "SELECT form_year, sponsor_name FROM f5500_filings "
                    "WHERE ein = :ein ORDER BY form_year DESC LIMIT 1"
                ), {"ein": watch.ein}).fetchone()

                if not pg_row:
                    # Fall back to DuckDB if EIN not yet in PostgreSQL filings table
                    drow = duck.execute("""
                        SELECT FORM_YEAR, SPONS_DFE_NAME FROM sch_h_2024
                        WHERE EIN = ? ORDER BY FORM_YEAR DESC LIMIT 1
                    """, [watch.ein]).fetchone()
                    if not drow:
                        watch.last_checked_at = datetime.utcnow()
                        continue
                    latest_year = int(drow[0])
                else:
                    latest_year = int(pg_row[0])

                if watch.last_seen_year and latest_year <= watch.last_seen_year:
                    watch.last_checked_at = datetime.utcnow()
                    continue

                # New filing detected — get $ details from DuckDB Schedule H
                ddetail = duck.execute("""
                    SELECT PLAN_NAME_LS, SPONS_DFE_NAME,
                           TOTAL_INCOME_AMT, ADMIN_SERVICE_FEES_AMT,
                           BROKER_COMMISSIONS, PARTICIPANTS
                    FROM sch_h_2024
                    WHERE EIN = ? AND FORM_YEAR = ?
                    LIMIT 1
                """, [watch.ein, latest_year]).fetchone()

                highlights = {
                    "plan_name": (ddetail[0] if ddetail else None) or (pg_row[1] if pg_row else None) or watch.employer_name,
                    "form_year": latest_year,
                    "total_income":       float(ddetail[2] or 0) if ddetail else 0,
                    "admin_fees":         float(ddetail[3] or 0) if ddetail else 0,
                    "broker_commissions": float(ddetail[4] or 0) if ddetail else 0,
                    "participants":       int(ddetail[5]   or 0) if ddetail else 0,
                }

                alert = models.RfpAlert(
                    watch_id=watch.id,
                    user_id=watch.user_id,
                    ein=watch.ein,
                    employer_name=watch.employer_name,
                    filing_year=latest_year,
                    alert_type="new_filing",
                    status="queued",
                    highlights=json.dumps(highlights),
                )
                db.add(alert)

                # Attempt email send — reuses try_send_smtp from email_reports
                user = db.query(models.User).filter(models.User.id == watch.user_id).first()
                if user and user.email:
                    try:
                        from backend.routers.email_reports import try_send_smtp, EmailRequest
                        income_fmt = f"${highlights['total_income']:,.0f}"
                        broker_fmt = f"${highlights['broker_commissions']:,.0f}"
                        html = f"""<html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:linear-gradient(135deg,#0c1a3a,#1a3a6e);padding:28px 32px;">
    <p style="font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin:0 0 8px;">KINCAID IQ — RFP INTELLIGENCE OS</p>
    <h2 style="color:white;font-size:20px;margin:0 0 6px;">New Form 5500 Filing Detected</h2>
    <div style="width:40px;height:3px;background:#FFB800;border-radius:2px;margin-top:16px;"></div>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">A new DOL Form 5500 filing has been detected for a watched employer on your RFP Intelligence OS watchlist.</p>
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr style="background:#f3f4f6;"><td style="padding:10px 14px;font-size:12px;color:#6b7280;font-weight:700;">Employer</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#111827;">{watch.employer_name}</td></tr>
      <tr><td style="padding:10px 14px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">EIN</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#111827;border-top:1px solid #f3f4f6;">{watch.ein}</td></tr>
      <tr style="background:#f3f4f6;"><td style="padding:10px 14px;font-size:12px;color:#6b7280;">Filing Year</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#FFB800;">{latest_year}</td></tr>
      <tr><td style="padding:10px 14px;font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;">Plan Income</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#111827;border-top:1px solid #f3f4f6;">{income_fmt}</td></tr>
      <tr style="background:#f3f4f6;"><td style="padding:10px 14px;font-size:12px;color:#6b7280;">Broker Commissions</td><td style="padding:10px 14px;font-size:13px;font-weight:700;color:#ef4444;">{broker_fmt}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">Log in to Kincaid IQ to view the full profile and generate talking points:</p>
    <a href="https://kincaid-iq.replit.app/rfp-intelligence" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#0c1a3a;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;">Open RFP Intelligence OS →</a>
  </div>
</div></body></html>"""
                        req = EmailRequest(
                            report_type="rfp-alert",
                            recipients=[user.email],
                            subject=f"[RFP Alert] New 5500 filing: {watch.employer_name} ({latest_year})",
                            message=f"New DOL Form 5500 filing detected for {watch.employer_name} (EIN {watch.ein}), filing year {latest_year}.",
                        )
                        sent = try_send_smtp(req, html)
                        if sent:
                            alert.status = "sent"
                            logger.info(f"[RFP Alarm] Alert email sent: {watch.employer_name} ({watch.ein}) year={latest_year} → {user.email}")
                        else:
                            logger.info(f"[RFP Alarm] SMTP not configured — alert queued for {watch.employer_name}")
                    except Exception as email_err:
                        logger.warning(f"[RFP Alarm] Email send failed for {watch.ein}: {email_err}")

                watch.last_seen_year = latest_year
                watch.last_checked_at = datetime.utcnow()
                alerted += 1
                detected.append({
                    "ein": watch.ein,
                    "employer_name": watch.employer_name,
                    "filing_year": latest_year,
                    "highlights": highlights,
                })

            except Exception as watch_err:
                logger.warning(f"[RFP Alarm] Error checking {watch.ein}: {watch_err}")

        db.commit()
        logger.info(f"[RFP Alarm] Filing check complete — {len(watches)} watched, {alerted} new filings detected")

    except Exception as exc:
        logger.error(f"[RFP Alarm] Job failed: {exc}")
    finally:
        db.close()

    return detected


def start_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _flag_overdue_controls,
        CronTrigger(hour=1, minute=0),
        id="overdue_controls",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        _auto_close_false_positive_findings,
        CronTrigger(hour=2, minute=0),
        id="false_positive_cleanup",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        _set_review_dates_for_new_controls,
        CronTrigger(hour=3, minute=0),
        id="set_review_dates",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        _daily_automated_evidence_refresh,
        CronTrigger(hour=6, minute=0),
        id="daily_evidence_refresh",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Hourly: fire any due client-package delivery-log auto-emails. See
    # backend/services/delivery_log_scheduler.py.
    from backend.services.delivery_log_scheduler import run_due_delivery_log_emails
    _scheduler.add_job(
        run_due_delivery_log_emails,
        CronTrigger(minute=5),  # 5 past every hour
        id="delivery_log_auto_email",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    # Nightly: check watched EINs for new Form 5500 filings → RFP alert + email.
    _scheduler.add_job(
        _rfp_new_filing_alarm,
        CronTrigger(hour=5, minute=0),  # 5 AM UTC nightly
        id="rfp_new_filing_alarm",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # Daily 4 AM: prune old client-package snapshot blobs so the
    # client_package_snapshots bytea table cannot bloat the database. The
    # delivery audit rows are kept; only the heavy reproducible artifacts are
    # purged. See backend/services/snapshot_retention.py.
    from backend.services.snapshot_retention import prune_client_package_snapshots
    _scheduler.add_job(
        prune_client_package_snapshots,
        CronTrigger(hour=4, minute=0),
        id="snapshot_retention_prune",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    # Hourly: send scheduled RFP Intelligence Digest emails for due users.
    from backend.routers.rfp_digest import run_due_rfp_digests
    _scheduler.add_job(
        run_due_rfp_digests,
        CronTrigger(minute=15),  # :15 past every hour
        id="rfp_digest_auto_email",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    # Every 30 min: pull government/regulatory live feeds (SEC EDGAR, USAspending,
    # SAM.gov) and record a provenance IngestionRun per source. See
    # backend/routers/live_feeds.py.
    from backend.routers.live_feeds import run_regulatory_ingest
    _scheduler.add_job(
        run_regulatory_ingest,
        CronTrigger(minute="*/30"),
        id="live_feed_regulatory_ingest",
        replace_existing=True,
        misfire_grace_time=600,
    )
    _scheduler.start()
    logger.info("[Scheduler] Compliance scheduler started (9 jobs)")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Compliance scheduler stopped")
