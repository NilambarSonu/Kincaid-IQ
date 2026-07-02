"""
Rebel IQ Intelligence API (v1) — analytics engine + async job processor.

`process_ingestion_job(job_id)` runs as a FastAPI BackgroundTask: it validates the
records attached to a batch, marks rejects with reasons, updates the batch + job
status, then triggers a full recompute of the plan's intelligence cache.

`recompute_plan(plan_id, db)` computes every intelligence domain (cost benchmarks,
trends, compliance, FWA, member risk, forecast, stop-loss) from the plan's valid
ingested records and stores the result as JSON in KiqAnalyticsCache. The /v1
intelligence GET endpoints then serve straight from that cache.

PHI rules (§12) are enforced here: condition labels only (no raw ICD/CPT),
suppression of condition detail for plans under 50 members, hashed member IDs only.
"""
from __future__ import annotations

import re
import uuid
import logging
from collections import defaultdict
from datetime import datetime, timedelta, date, timezone

from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend import models

log = logging.getLogger("rebel_analytics")

SMALL_PLAN_THRESHOLD = 50            # §12 — suppress condition detail below this
ICD10_RE = re.compile(r"^[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?$", re.IGNORECASE)
# §12 — Rebel IQ de-identifies member IDs with HMAC-SHA256 before sending them.
# A compliant hashed ID is a hex digest (sha256 = 64 hex chars; allow other hash
# widths but require pure hex of at least 32 chars). Anything else risks being raw
# PII (name, SSN, email) and must be rejected at ingestion.
MEMBER_ID_HASH_RE = re.compile(r"^[0-9a-f]{32,128}$", re.IGNORECASE)


def _invalid_member_id_reason(member_id: str, label: str) -> str | None:
    """Return a rejection reason if member_id is missing or not a hashed (hex) ID."""
    if not member_id:
        return f"{label}: missing memberId"
    if not MEMBER_ID_HASH_RE.match(str(member_id).strip()):
        return (
            f"{label}: memberId is not a de-identified HMAC-SHA256 hash "
            "(expected 32–128 hex characters); raw member identifiers are rejected"
        )
    return None


def _now():
    return datetime.now(timezone.utc)


# ── ICD-10 → high-level condition label mapping (labels only — no codes returned) ─
def _condition_label(icd: str) -> str | None:
    if not icd:
        return None
    code = icd.upper().strip()
    head = code[:1]
    try:
        num = int(code[1:3])
    except (ValueError, IndexError):
        num = -1
    if head == "E" and 8 <= num <= 13:
        return "Diabetes — Type 2"
    if head == "N" and num == 18:
        return "End-Stage Renal Disease"
    if head == "I":
        return "Cardiovascular Disease"
    if head == "C" or (head == "D" and num <= 49):
        return "Oncology"
    if head == "F":
        return "Behavioral Health"
    if head == "J":
        return "Respiratory Disease"
    if head == "M":
        return "Musculoskeletal Disorder"
    if head == "K":
        return "Gastrointestinal Disorder"
    if head == "N":
        return "Renal / Urinary Disease"
    if head == "G":
        return "Neurological Disorder"
    if head == "Z":
        return None  # routine / factors influencing health status — not a condition
    return "Other Chronic Condition"


# ═══════════════════════════════════════════════════════════════════════════════
# JOB PROCESSING
# ═══════════════════════════════════════════════════════════════════════════════
def process_ingestion_job(job_id: str):
    """Background entrypoint — owns its own DB session."""
    db: Session = SessionLocal()
    try:
        job = db.query(models.KiqJob).filter(models.KiqJob.job_id == job_id).first()
        if not job:
            log.warning("process_ingestion_job: job %s not found", job_id)
            return
        batch = db.query(models.IngestionBatch).filter(
            models.IngestionBatch.batch_id == job.batch_id
        ).first()
        job.status = "processing"
        job.started_at = _now()
        if batch:
            batch.status = "processing"
        db.commit()

        rejected, reasons = _validate_batch(job, batch, db)
        processed = job.records_total - rejected

        job.records_processed = processed
        job.records_rejected = rejected
        job.rejection_reasons = reasons
        job.status = "complete"
        job.completed_at = _now()
        if batch:
            batch.records_processed = processed
            batch.records_rejected = rejected
            batch.rejection_reasons = reasons
            batch.status = "partial" if rejected else "processed"
            batch.processed_at = _now()
        db.commit()

        # Recompute intelligence from all valid records for the plan.
        recompute_plan(job.plan_id, db)

        plan = db.query(models.KincaidPlan).filter(
            models.KincaidPlan.kincaid_plan_id == job.plan_id
        ).first()
        if plan:
            plan.status = "active"
            db.commit()
    except Exception as exc:  # noqa: BLE001
        log.exception("Ingestion job %s failed", job_id)
        db.rollback()
        try:
            job = db.query(models.KiqJob).filter(models.KiqJob.job_id == job_id).first()
            if job:
                job.status = "failed"
                job.completed_at = _now()
                job.error = {
                    "type": "https://api.kincaidiq.com/errors/ingestion-failed",
                    "title": "Ingestion Processing Failed",
                    "detail": str(exc),
                    "retryable": True,
                }
                batch = db.query(models.IngestionBatch).filter(
                    models.IngestionBatch.batch_id == job.batch_id
                ).first()
                if batch:
                    batch.status = "failed"
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


def _validate_batch(job, batch, db: Session) -> tuple[int, list[str]]:
    """Mark invalid records (valid=False + reason). Returns (rejected_count, reasons)."""
    reasons: list[str] = []
    rejected = 0
    btype = batch.type if batch else job.type.replace("-ingestion", "")

    if btype == "claims":
        records = db.query(models.IngestedClaim).filter(
            models.IngestedClaim.batch_id == job.batch_id
        ).all()
        for c in records:
            reason = _invalid_member_id_reason(c.member_id, f"Claim {c.claim_id}")
            if reason is None:
                if not c.provider_id:
                    reason = f"Claim {c.claim_id}: missing NPI"
                elif c.plan_paid_amount > c.billed_amount and c.billed_amount > 0:
                    reason = f"Claim {c.claim_id}: planPaidAmount exceeds billedAmount"
                elif c.diagnosis_codes and not all(ICD10_RE.match(str(d)) for d in c.diagnosis_codes):
                    reason = f"Claim {c.claim_id}: diagnosisCodes values are not valid ICD-10-CM format"
            if reason:
                c.valid = False
                c.rejection_reason = reason
                rejected += 1
                if len(reasons) < 50:
                    reasons.append(reason)
    elif btype == "members":
        records = db.query(models.IngestedMember).filter(
            models.IngestedMember.batch_id == job.batch_id
        ).all()
        for m in records:
            reason = _invalid_member_id_reason(m.member_id, "Member record")
            if reason:
                m.valid = False
                m.rejection_reason = reason
                rejected += 1
                if len(reasons) < 50:
                    reasons.append(reason)
    elif btype == "rx":
        records = db.query(models.IngestedRxClaim).filter(
            models.IngestedRxClaim.batch_id == job.batch_id
        ).all()
        for r in records:
            reason = _invalid_member_id_reason(r.member_id, f"Rx claim {r.claim_id}")
            if reason is None and r.plan_paid_amount > r.billed_amount and r.billed_amount > 0:
                reason = f"Rx claim {r.claim_id}: planPaidAmount exceeds billedAmount"
            if reason:
                r.valid = False
                r.rejection_reason = reason
                rejected += 1
                if len(reasons) < 50:
                    reasons.append(reason)
    db.commit()
    return rejected, reasons


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS ENGINE
# ═══════════════════════════════════════════════════════════════════════════════
def _months_in_period(claims, members) -> int:
    dates = []
    for c in claims:
        if c.service_date:
            dates.append(c.service_date)
    if not dates:
        return 1
    try:
        lo = min(datetime.fromisoformat(d) for d in dates if d)
        hi = max(datetime.fromisoformat(d) for d in dates if d)
        months = (hi.year - lo.year) * 12 + (hi.month - lo.month) + 1
        return max(1, months)
    except Exception:
        return 1


def _peer_benchmark_total_pmpm(plan) -> tuple[float, str]:
    """
    Derive a peer-cohort total PMPM from the DOL Form 5500 DuckDB welfare-premium
    data when available (segmented by state + industry); otherwise fall back to a
    national modeled benchmark. Returns (benchmark_total_pmpm, cohort_label).
    """
    cohort = f"Self-funded, ~{plan.member_count} members"
    if plan.state:
        cohort += f", {plan.state}"
    if plan.industry_code:
        cohort += f", industry {plan.industry_code}"
    try:
        from backend.duckdb import duck_available, get_duck
        if duck_available():
            con = get_duck()
            naics2 = (plan.industry_code or "")[:2]
            row = con.execute(
                """
                SELECT SUM(total_welfare_premiums) AS sum_premiums,
                       SUM(max_participants) AS sum_part,
                       COUNT(*) AS n
                FROM employers
                WHERE max_participants BETWEEN 100 AND 5000
                  AND (? = '' OR state = ?)
                  AND (? = '' OR substr(business_code, 1, 2) = ?)
                  AND total_welfare_premiums > 0 AND max_participants > 0
                """,
                [plan.state or "", plan.state or "", naics2, naics2],
            ).fetchone()
            if row and row[0] and row[1]:
                sum_premiums = float(row[0])
                sum_part = float(row[1])
                n = int(row[2] or 0)
                # welfare premiums per participant per month → total PMPM proxy
                pmpm = (sum_premiums / sum_part) / 12.0
                if 100 <= pmpm <= 3000 and n >= 5:
                    return round(pmpm, 2), cohort + f" (DOL 5500 cohort, n={n})"
    except Exception as exc:  # noqa: BLE001
        log.info("Peer benchmark DuckDB lookup unavailable: %s", exc)
    # National modeled fallback (self-funded employer-sponsored avg total PMPM).
    return 534.20, cohort + " (national modeled benchmark)"


def _category(claim) -> str:
    pt = (claim.provider_type or "").lower()
    if pt == "behavioral":
        return "behavioral"
    if pt == "pharmacy":
        return "pharmacy"
    return "medical"


def recompute_plan(plan_id: str, db: Session) -> dict:
    """Compute all intelligence domains and persist to KiqAnalyticsCache."""
    plan = db.query(models.KincaidPlan).filter(
        models.KincaidPlan.kincaid_plan_id == plan_id
    ).first()
    if not plan:
        return {}

    claims = db.query(models.IngestedClaim).filter(
        models.IngestedClaim.plan_id == plan_id, models.IngestedClaim.valid == True  # noqa: E712
    ).all()
    rx = db.query(models.IngestedRxClaim).filter(
        models.IngestedRxClaim.plan_id == plan_id, models.IngestedRxClaim.valid == True  # noqa: E712
    ).all()
    members = db.query(models.IngestedMember).filter(
        models.IngestedMember.plan_id == plan_id, models.IngestedMember.valid == True  # noqa: E712
    ).all()

    member_count = plan.member_count or len([m for m in members if m.is_active]) or 1
    months = _months_in_period(claims, members)

    data = {
        "computedAt": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "costs": _compute_costs(plan, claims, rx, member_count, months),
        "trends": _compute_trends(claims, rx, member_count),
        "compliance": _compute_compliance(plan),
        "fwa": _compute_fwa(claims),
        "members": _compute_member_risk(plan, claims, rx, members),
        "stopLoss": _compute_stop_loss(plan, claims),
    }
    data["forecast"] = _compute_forecast(plan, data, member_count, months)
    data["insights"] = _compute_insights(plan, data)

    # Persist alerts to the DB (insights/alerts endpoint reads from the table).
    _materialize_alerts(plan, data, db)

    cache = db.query(models.KiqAnalyticsCache).filter(
        models.KiqAnalyticsCache.plan_id == plan_id
    ).first()
    if cache is None:
        cache = models.KiqAnalyticsCache(plan_id=plan_id, data=data, data_as_of=_now())
        db.add(cache)
    else:
        cache.data = data
        cache.data_as_of = _now()
    db.commit()
    return data


# ── Costs ─────────────────────────────────────────────────────────────────────
def _compute_costs(plan, claims, rx, member_count, months) -> dict:
    cat_paid = defaultdict(float)
    for c in claims:
        cat_paid[_category(c)] += c.plan_paid_amount
    pharmacy_paid = sum(r.plan_paid_amount for r in rx)
    cat_paid["pharmacy"] += pharmacy_paid

    mm = member_count * months  # member-months
    def pmpm(v):
        return round(v / mm, 2) if mm else 0.0

    benchmark_total, cohort = _peer_benchmark_total_pmpm(plan)
    # Category mix of the benchmark (typical self-funded distribution).
    bench_mix = {"medical": 0.70, "pharmacy": 0.22, "behavioral": 0.05}

    benchmarks = []
    total_plan = 0.0
    for cat in ("medical", "pharmacy", "behavioral"):
        plan_pmpm = pmpm(cat_paid.get(cat, 0.0))
        total_plan += plan_pmpm
        bench_pmpm = round(benchmark_total * bench_mix[cat], 2)
        variance = round(((plan_pmpm - bench_pmpm) / bench_pmpm) * 100, 1) if bench_pmpm else 0.0
        trend = "worsening" if variance > 5 else ("improving" if variance < -5 else "stable")
        benchmarks.append({
            "category": cat,
            "planCostPmpm": plan_pmpm,
            "benchmarkCostPmpm": bench_pmpm,
            "variancePct": variance,
            "trend": trend,
            "insight": _cost_insight(cat, plan_pmpm, bench_pmpm, variance),
        })
    total_variance = round(((total_plan - benchmark_total) / benchmark_total) * 100, 1) if benchmark_total else 0.0
    benchmarks.append({
        "category": "total",
        "planCostPmpm": round(total_plan, 2),
        "benchmarkCostPmpm": benchmark_total,
        "variancePct": total_variance,
        "trend": "worsening" if total_variance > 5 else ("improving" if total_variance < -5 else "stable"),
        "insight": _cost_insight("total", total_plan, benchmark_total, total_variance),
    })
    return {
        "planYear": plan.plan_year,
        "benchmarkCohort": cohort,
        "benchmarks": benchmarks,
        "totalPmpm": round(total_plan, 2),
        "benchmarkTotalPmpm": benchmark_total,
    }


def _cost_insight(cat, plan_pmpm, bench_pmpm, variance) -> str:
    label = cat.capitalize() if cat != "total" else "Total"
    if variance > 5:
        return f"{label} PMPM is {variance}% above benchmark and is a priority area for intervention."
    if variance < -5:
        return f"{label} PMPM is {abs(variance)}% below benchmark. Verify this reflects plan design rather than access barriers."
    return f"{label} PMPM is in line with benchmark ({variance}% variance)."


# ── Trends ────────────────────────────────────────────────────────────────────
def _compute_trends(claims, rx, member_count) -> dict:
    buckets = defaultdict(lambda: {"medical": 0.0, "pharmacy": 0.0, "behavioral": 0.0})
    for c in claims:
        if not c.service_date:
            continue
        period = c.service_date[:7]
        buckets[period][_category(c)] += c.plan_paid_amount
    for r in rx:
        if not r.dispensed_date:
            continue
        period = r.dispensed_date[:7]
        buckets[period]["pharmacy"] += r.plan_paid_amount

    points = []
    for period in sorted(buckets):
        b = buckets[period]
        total = b["medical"] + b["pharmacy"] + b["behavioral"]
        points.append({
            "period": period,
            "totalCost": round(total, 2),
            "medicalCost": round(b["medical"], 2),
            "pharmacyCost": round(b["pharmacy"], 2),
            "behavioralCost": round(b["behavioral"], 2),
            "memberCount": member_count,
            "pmpm": round(total / member_count, 2) if member_count else 0.0,
        })

    annualized = 0.0
    direction = "stable"
    if len(points) >= 2:
        first = points[0]["pmpm"] or 1
        last = points[-1]["pmpm"]
        span_months = max(1, len(points) - 1)
        monthly_growth = (last - first) / first / span_months if first else 0
        annualized = round(monthly_growth * 12 * 100, 1)
        direction = "worsening" if annualized > 2 else ("improving" if annualized < -2 else "stable")
    insight = (
        f"Plan costs are trending {annualized}% year-over-year."
        if points else "Insufficient monthly data to establish a trend."
    )
    return {
        "dataPoints": points,
        "trendDirection": direction,
        "annualizedTrendPct": annualized,
        "insight": insight,
    }


# ── Compliance ────────────────────────────────────────────────────────────────
def _next_occurrence(base: date) -> date:
    today = _now().date()
    while base < today:
        base = date(base.year + 1, base.month, base.day)
    return base


def _compute_compliance(plan) -> dict:
    today = _now().date()
    py_end = date(plan.plan_year, 12, 31)
    requires_5500 = plan.member_count >= 100

    items = []

    def add(title, desc, ftype, due, priority, penalty, url=None):
        days = (due - today).days
        status = "upcoming"
        if days < 0:
            status = "overdue"
        elif days <= 30:
            status = "dueSoon"
        item = {
            "itemId": str(uuid.uuid4()),
            "title": title, "description": desc, "filingType": ftype,
            "dueDate": due.isoformat(), "daysUntilDue": days,
            "status": status, "priority": priority, "penaltyForMissing": penalty,
        }
        if url:
            item["filingUrl"] = url
        items.append(item)

    if requires_5500:
        due_5500 = _next_occurrence(date(plan.plan_year + 1, 7, 31))
        add("Form 5500 Annual Report Filing",
            "Annual report filed with the Department of Labor. Required for plans with 100+ participants.",
            "form5500", due_5500, "high",
            "$250 per day, up to $150,000 per filing per DOL penalty schedule",
            "https://www.efast.dol.gov")
        due_sar = _next_occurrence(date(plan.plan_year + 1, 9, 30))
        add("Summary Annual Report Distribution",
            "Distribute SAR to all plan participants within 9 months of plan year end.",
            "sar", due_sar, "medium",
            "Up to $110 per participant per day for failure to furnish")
    due_spd = _next_occurrence(date(plan.plan_year, 3, 1))
    add("Summary Plan Description Distribution",
        "Provide updated SPD to participants reflecting current plan terms.",
        "spdDistribution", due_spd, "medium",
        "Up to $110 per participant per day; loss of safe-harbor protections")
    due_fid = _next_occurrence(date(plan.plan_year, 6, 30))
    add("Annual Fiduciary Review",
        "Document the plan committee's annual review of fees, vendors, and plan performance.",
        "fiduciaryReview", due_fid, "medium",
        "Personal fiduciary liability under ERISA §404 for imprudent administration")
    due_ndt = _next_occurrence(date(plan.plan_year, 12, 1))
    add("Nondiscrimination Testing",
        "Perform §125 / §105(h) nondiscrimination testing for the plan year.",
        "nondiscriminationTesting", due_ndt, "low",
        "Loss of pre-tax treatment for highly compensated employees")

    items.sort(key=lambda x: x["daysUntilDue"])

    # ERISA / DOL status derived from calendar.
    dol_issues = []
    next_5500 = next((i for i in items if i["filingType"] == "form5500"), None)
    if next_5500 and next_5500["daysUntilDue"] <= 60:
        dol_issues.append(
            f"Form 5500 filing due in {next_5500['daysUntilDue']} days. Filing has not been initiated."
        )
    overdue = [i for i in items if i["status"] == "overdue"]
    for o in overdue:
        dol_issues.append(f"{o['title']} is overdue by {abs(o['daysUntilDue'])} days.")

    dol_status = "attentionRequired" if dol_issues else "compliant"
    overall = "attentionRequired" if dol_issues else "compliant"
    return {
        "overallStatus": overall,
        "erisa": {"status": "compliant", "openIssueCount": 0, "issues": []},
        "dol": {"status": dol_status, "openIssueCount": len(dol_issues), "issues": dol_issues},
        "planDocumentStatus": "reviewNeeded",
        "planDocumentNotes": "Confirm the Summary Plan Description reflects the most recent plan amendments.",
        "lastAuditedAt": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "calendar": {"items": items, "total": len(items)},
    }


# ── FWA ───────────────────────────────────────────────────────────────────────
HIGH_COMPLEXITY = {"99215", "99205", "99245", "99255"}


def _compute_fwa(claims) -> dict:
    detections = []

    # Upcoding: provider billing a high share of top-complexity E/M codes.
    by_provider = defaultdict(list)
    for c in claims:
        if c.provider_id:
            by_provider[c.provider_id].append(c)
    for npi, pclaims in by_provider.items():
        em = [c for c in pclaims if any(p.startswith("992") for p in (c.procedure_codes or []))]
        if len(em) >= 8:
            high = [c for c in em if any(p in HIGH_COMPLEXITY for p in (c.procedure_codes or []))]
            share = len(high) / len(em)
            # Spec §10.4: flag providers billing >80% of E/M visits at the highest
            # complexity level (vs ~12% national average).
            if share > 0.8:
                savings = round(sum(c.plan_paid_amount for c in high) * 0.35, 2)
                detections.append({
                    "detectionId": str(uuid.uuid4()),
                    "type": "upcoding",
                    "severity": "critical" if share >= 0.95 else "high",
                    "status": "open",
                    "description": (
                        f"Provider NPI {npi} billed {round(share*100)}% of evaluation & "
                        f"management visits at the highest complexity level over the period — "
                        f"significantly above the ~12% national average for similar specialties."
                    ),
                    "estimatedSavings": savings,
                    "claimIds": [c.claim_id for c in high[:25]],
                    "memberId": None,
                    "providerId": npi,
                    "recommendedAction": (
                        "Request itemized records from this provider for a sample of "
                        "highest-complexity claims. Engage your TPA's SIU if records do not "
                        "support the billed complexity."
                    ),
                    "detectedAt": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "modelConfidence": round(min(0.95, 0.6 + share * 0.35), 2),
                })

    # Duplicate claims: the same claimId submitted more than once (spec §10.4).
    by_claim_id = defaultdict(list)
    for c in claims:
        if c.claim_id:
            by_claim_id[c.claim_id].append(c)
    for cid, group in by_claim_id.items():
        if len(group) > 1:
            dup_amount = round(sum(c.plan_paid_amount for c in group[1:]), 2)
            if dup_amount <= 0:
                continue
            detections.append({
                "detectionId": str(uuid.uuid4()),
                "type": "duplicateClaim",
                "severity": "medium",
                "status": "open",
                "description": (
                    f"Claim ID {cid} was submitted {len(group)} times in the batch — a "
                    f"likely duplicate submission resulting in overpayment."
                ),
                "estimatedSavings": dup_amount,
                "claimIds": [cid],
                "memberId": group[0].member_id,
                "providerId": group[0].provider_id,
                "recommendedAction": (
                    "Confirm with your TPA whether these represent distinct services. "
                    "Recover overpayment if the duplicate is confirmed."
                ),
                "detectedAt": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "modelConfidence": 0.92,
            })

    # Unusual utilization: a member with abnormally high visit frequency.
    by_member = defaultdict(list)
    for c in claims:
        by_member[c.member_id].append(c)
    counts = {m: len(cl) for m, cl in by_member.items()}
    if counts:
        avg = sum(counts.values()) / len(counts)
        for m, n in counts.items():
            if n >= max(20, avg * 3):
                spend = round(sum(c.plan_paid_amount for c in by_member[m]), 2)
                detections.append({
                    "detectionId": str(uuid.uuid4()),
                    "type": "unusualUtilization",
                    "severity": "medium",
                    "status": "open",
                    "description": (
                        f"Member shows {n} claims in the period — roughly "
                        f"{round(n/avg, 1)}x the plan average. Review for medically "
                        f"unnecessary or potentially abusive utilization."
                    ),
                    "estimatedSavings": round(spend * 0.20, 2),
                    "claimIds": [c.claim_id for c in by_member[m][:25]],
                    "memberId": m,
                    "providerId": None,
                    "recommendedAction": (
                        "Refer to care management for review. High utilization may also "
                        "indicate an emerging high-cost claimant for stop-loss monitoring."
                    ),
                    "detectedAt": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "modelConfidence": 0.74,
                })

    detections.sort(key=lambda d: d["estimatedSavings"], reverse=True)

    savings_by_type = defaultdict(float)
    for d in detections:
        savings_by_type[d["type"]] += d["estimatedSavings"]
    top = sorted(savings_by_type, key=savings_by_type.get, reverse=True)
    return {
        "detections": detections,
        "summary": {
            "openDetections": len([d for d in detections if d["status"] == "open"]),
            "criticalDetections": len([d for d in detections if d["severity"] == "critical"]),
            "totalEstimatedSavings": round(sum(d["estimatedSavings"] for d in detections), 2),
            "recoveredToDate": 0.0,
            "topCategories": top[:3],
            "savingsByType": {k: round(v, 2) for k, v in savings_by_type.items()},
        },
    }


# ── Member risk ───────────────────────────────────────────────────────────────
def _compute_member_risk(plan, claims, rx, members) -> dict:
    member_count = plan.member_count or len(members) or 1
    suppress_conditions = member_count < SMALL_PLAN_THRESHOLD

    spend = defaultdict(float)
    visits = defaultdict(int)
    conditions = defaultdict(set)
    for c in claims:
        spend[c.member_id] += c.plan_paid_amount
        visits[c.member_id] += 1
        for icd in (c.diagnosis_codes or []):
            lbl = _condition_label(icd)
            if lbl:
                conditions[c.member_id].add(lbl)
    for r in rx:
        spend[r.member_id] += r.plan_paid_amount

    all_member_ids = set(spend) | {m.member_id for m in members}
    if not all_member_ids:
        return {"members": [], "riskDistribution": {"critical": 0, "high": 0, "moderate": 0, "low": 0}}

    max_spend = max(spend.values()) if spend else 1.0
    spec_ded = plan.specific_deductible or 0

    profiles = []
    dist = {"critical": 0, "high": 0, "moderate": 0, "low": 0}
    for mid in all_member_ids:
        s = spend.get(mid, 0.0)
        v = visits.get(mid, 0)
        cond_count = len(conditions.get(mid, set()))
        # Composite 0-100 score: spend (60), chronic burden (25), utilization (15).
        score = (
            60 * (s / max_spend if max_spend else 0)
            + 25 * min(1.0, cond_count / 3)
            + 15 * min(1.0, v / 30)
        )
        score = round(min(100, score))
        if score >= 85:
            tier = "critical"
        elif score >= 65:
            tier = "high"
        elif score >= 40:
            tier = "moderate"
        else:
            tier = "low"
        dist[tier] += 1

        predicted = round(s * (12.0 / max(1, _annualization_months(claims))), 2)
        stop_loss_relevant = bool(spec_ded) and s >= spec_ded * 0.5
        intervention = round(s * 0.18, 2) if tier in ("critical", "high") else 0.0
        prof = {
            "memberId": mid,
            "riskTier": tier,
            "riskScore": score,
            "predictedAnnualCost": predicted,
            "primaryConditions": (
                [] if suppress_conditions else sorted(conditions.get(mid, set()))[:5]
            ),
            "careManagementOpportunity": tier in ("critical", "high"),
            "interventionPotentialSavings": intervention,
            "stopLossRelevant": stop_loss_relevant,
            "currentStopLossAccumulation": round(s, 2),
        }
        profiles.append(prof)

    profiles.sort(key=lambda p: p["riskScore"], reverse=True)
    return {
        "members": profiles,
        "riskDistribution": dist,
        "conditionsSuppressed": suppress_conditions,
    }


def _annualization_months(claims) -> int:
    return _months_in_period(claims, None)


# ── Stop-loss ─────────────────────────────────────────────────────────────────
def _compute_stop_loss(plan, claims) -> dict:
    spec_ded = plan.specific_deductible or 0
    agg_point = plan.aggregate_attachment_point or 0
    today = _now().date()
    py_end = date(plan.plan_year, 12, 31)
    months_remaining = max(0.5, ((py_end - today).days) / 30.4)

    accum = defaultdict(float)
    recent = defaultdict(float)  # last-60-day plan paid for breach projection
    cutoff = today - timedelta(days=60)
    for c in claims:
        accum[c.member_id] += c.plan_paid_amount
        if c.service_date:
            try:
                if datetime.fromisoformat(c.service_date).date() >= cutoff:
                    recent[c.member_id] += c.plan_paid_amount
            except Exception:
                pass

    alerts = []
    spec_count = 0
    if spec_ded:
        for mid, total in accum.items():
            pct = total / spec_ded * 100
            if pct < 50:
                continue
            spec_count += 1
            daily = recent.get(mid, 0.0) / 60.0
            remaining = max(0.0, spec_ded - total)
            breach_date = None
            if daily > 0 and remaining > 0:
                days = int(remaining / daily)
                breach_date = (today + timedelta(days=min(days, 3650))).isoformat()
            elif remaining <= 0:
                breach_date = today.isoformat()
            severity = "critical" if pct >= 90 else ("high" if pct >= 75 else "medium")
            exposure = round(max(0.0, total - spec_ded) + daily * 30 * 3, 2) if daily else round(max(0.0, total - spec_ded), 2)
            notif_required = pct >= 50
            notif_deadline = (today + timedelta(days=14)).isoformat() if notif_required else None
            alerts.append({
                "alertId": str(uuid.uuid4()),
                "type": "specific",
                "severity": severity,
                "memberId": mid,
                "currentAccumulation": round(total, 2),
                "threshold": float(spec_ded),
                "percentOfThreshold": round(pct, 1),
                "projectedBreachDate": breach_date,
                "estimatedExposure": exposure,
                "carrierNotificationRequired": notif_required,
                "notificationDeadline": notif_deadline,
                "recommendedAction": (
                    f"Notify {plan.stop_loss_carrier or 'your stop-loss carrier'} of this member "
                    "immediately. Most stop-loss policies require notification within 30 days of "
                    "the member reaching 50% of the specific deductible. Document the notification "
                    "in the fiduciary action log."
                ),
            })

    agg_alert_count = 0
    if agg_point:
        total_paid = sum(accum.values())
        pct = total_paid / agg_point * 100
        elapsed_months = max(0.5, 12 - months_remaining)
        monthly_rate = total_paid / elapsed_months if elapsed_months else 0
        breach_date = None
        if monthly_rate > 0 and total_paid < agg_point:
            months_to_breach = (agg_point - total_paid) / monthly_rate
            breach_date = (today + timedelta(days=int(months_to_breach * 30.4))).isoformat()
        agg_alert_count = 1
        alerts.append({
            "alertId": str(uuid.uuid4()),
            "type": "aggregate",
            "severity": "high" if pct >= 85 else ("medium" if pct >= 60 else "low"),
            "memberId": None,
            "currentAccumulation": round(total_paid, 2),
            "threshold": float(agg_point),
            "percentOfThreshold": round(pct, 1),
            "projectedBreachDate": breach_date,
            "estimatedExposure": None,
            "carrierNotificationRequired": False,
            "recommendedAction": (
                f"Aggregate accumulation is at {round(pct,1)}% with {round(months_remaining,1)} "
                "months remaining in the plan year. Monitor monthly. Begin carrier dialogue if "
                "accumulation exceeds 85%."
            ),
        })

    alerts.sort(key=lambda a: a["percentOfThreshold"], reverse=True)
    total_exposure = round(sum(a["estimatedExposure"] or 0 for a in alerts), 2)
    return {
        "alerts": alerts,
        "specificAlertCount": spec_count,
        "aggregateAlertCount": agg_alert_count,
        "totalEstimatedExposure": total_exposure,
    }


# ── Forecast ──────────────────────────────────────────────────────────────────
def _compute_forecast(plan, data, member_count, months) -> dict:
    costs = data["costs"]
    total_pmpm = costs["totalPmpm"]
    annual_total = total_pmpm * member_count * 12
    medical = next((b["planCostPmpm"] for b in costs["benchmarks"] if b["category"] == "medical"), 0)
    pharmacy = next((b["planCostPmpm"] for b in costs["benchmarks"] if b["category"] == "pharmacy"), 0)
    behavioral = next((b["planCostPmpm"] for b in costs["benchmarks"] if b["category"] == "behavioral"), 0)
    trend_pct = data["trends"]["annualizedTrendPct"] or 0
    growth = 1 + (trend_pct / 100.0)

    projected = round(annual_total * growth, 2)
    return {
        "forecastYear": plan.plan_year,
        "projectedTotalCost": projected,
        "projectedMedicalCost": round(medical * member_count * 12 * growth, 2),
        "projectedPharmacyCost": round(pharmacy * member_count * 12 * growth, 2),
        "projectedBehavioralCost": round(behavioral * member_count * 12 * growth, 2),
        "confidenceIntervalLow": round(projected * 0.91, 2),
        "confidenceIntervalHigh": round(projected * 1.11, 2),
        "projectedPmpm": round(total_pmpm * growth, 2),
        "yearOverYearChangePct": trend_pct,
        "keyAssumptions": [
            f"Member count stable at {member_count}",
            "No changes to plan design or provider network",
            f"Cost trend continues at {trend_pct}% annualized",
            (f"Stop-loss specific deductible renewal at current ${int(plan.specific_deductible):,} level"
             if plan.specific_deductible else "No stop-loss specific deductible configured"),
        ],
        "riskFactors": _forecast_risks(data),
        "scenarios": {
            "optimistic": {
                "projectedTotalCost": round(projected * 0.94, 2),
                "description": "Care management interventions effective; specialty drug members transition to biosimilars.",
            },
            "pessimistic": {
                "projectedTotalCost": round(projected * 1.17, 2),
                "description": "Stop-loss breach unreported; new specialty drug members; no care management.",
            },
        },
        "generatedAt": _now().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _forecast_risks(data) -> list[str]:
    risks = []
    sl = data["stopLoss"]
    crit = [a for a in sl["alerts"] if a["type"] == "specific" and a["severity"] == "critical"]
    if crit:
        risks.append(
            f"{len(crit)} critical-risk member(s) may breach the specific deductible — could add "
            "significant net plan cost if stop-loss notification requirements are not met."
        )
    fwa = data["fwa"]["summary"]
    if fwa["totalEstimatedSavings"] > 0:
        risks.append(
            f"${fwa['totalEstimatedSavings']:,.0f} in identified FWA exposure pending review and recovery."
        )
    pharmacy = next((b for b in data["costs"]["benchmarks"] if b["category"] == "pharmacy"), None)
    if pharmacy and pharmacy["variancePct"] > 10:
        risks.append(
            f"Pharmacy PMPM is {pharmacy['variancePct']}% above benchmark — specialty drug trend is a key uncertainty."
        )
    if not risks:
        risks.append("No material risk factors identified beyond normal cost trend.")
    return risks


# ── Insights aggregation ──────────────────────────────────────────────────────
def _status_for_variance(v) -> str:
    if v > 10:
        return "critical"
    if v > 5:
        return "attention"
    return "healthy"


def _compute_insights(plan, data) -> dict:
    domains = {}

    # Cost
    total_b = next((b for b in data["costs"]["benchmarks"] if b["category"] == "total"), None)
    cost_var = total_b["variancePct"] if total_b else 0
    cost_status = _status_for_variance(cost_var)
    domains["cost"] = {
        "status": cost_status,
        "summary": f"Total PMPM is {cost_var}% vs benchmark.",
        "alertCount": sum(1 for b in data["costs"]["benchmarks"] if b["category"] != "total" and b["variancePct"] > 5),
    }

    # Compliance
    comp = data["compliance"]
    comp_status = "healthy" if comp["overallStatus"] == "compliant" else "attention"
    next_5500 = next((i for i in comp["calendar"]["items"] if i["filingType"] == "form5500"), None)
    comp_summary = "Plan is ERISA and DOL compliant."
    if next_5500:
        comp_summary += f" Form 5500 due in {next_5500['daysUntilDue']} days."
    domains["compliance"] = {
        "status": comp_status,
        "summary": comp_summary,
        "alertCount": comp["dol"]["openIssueCount"],
    }

    # FWA
    fwa = data["fwa"]["summary"]
    fwa_status = "critical" if fwa["criticalDetections"] else ("attention" if fwa["openDetections"] else "healthy")
    domains["fwa"] = {
        "status": fwa_status,
        "summary": f"{fwa['openDetections']} open FWA detection(s) with ${fwa['totalEstimatedSavings']:,.0f} in estimated savings.",
        "alertCount": fwa["openDetections"],
    }

    # Member risk
    dist = data["members"]["riskDistribution"]
    mr_status = "critical" if dist["critical"] else ("attention" if dist["high"] else "healthy")
    domains["memberRisk"] = {
        "status": mr_status,
        "summary": f"{dist['critical']} critical-risk and {dist['high']} high-risk members identified.",
        "alertCount": dist["critical"] + dist["high"],
    }

    # Stop-loss
    sl = data["stopLoss"]
    sl_specific = [a for a in sl["alerts"] if a["type"] == "specific"]
    sl_status = "healthy"
    if any(a["severity"] == "critical" for a in sl_specific):
        sl_status = "critical"
    elif sl_specific:
        sl_status = "attention"
    top_sl = max(sl_specific, key=lambda a: a["percentOfThreshold"], default=None)
    sl_summary = "No members approaching the specific deductible."
    if top_sl:
        sl_summary = f"1 member at {top_sl['percentOfThreshold']}% of specific deductible."
        if top_sl.get("projectedBreachDate"):
            sl_summary += f" Breach projected {top_sl['projectedBreachDate']}."
    domains["stopLoss"] = {
        "status": sl_status,
        "summary": sl_summary,
        "alertCount": len(sl_specific),
    }

    statuses = [d["status"] for d in domains.values()]
    overall = "critical" if "critical" in statuses else ("attention" if "attention" in statuses else "healthy")
    open_alerts = sum(d["alertCount"] for d in domains.values())
    critical_alerts = sum(1 for d in domains.values() if d["status"] == "critical")
    return {
        "overallStatus": overall,
        "domains": domains,
        "openAlertCount": open_alerts,
        "criticalAlertCount": critical_alerts,
    }


# ── Alert materialization ─────────────────────────────────────────────────────
def _materialize_alerts(plan, data, db: Session):
    """Rebuild the plan's alert table from the freshly computed intelligence."""
    db.query(models.KiqAlert).filter(models.KiqAlert.plan_id == plan.kincaid_plan_id).delete()

    sev_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    # Stop-loss alerts
    for a in data["stopLoss"]["alerts"]:
        if a["type"] == "specific" and a["percentOfThreshold"] >= 75:
            db.add(models.KiqAlert(
                alert_id=a["alertId"], plan_id=plan.kincaid_plan_id, domain="stopLoss",
                severity=a["severity"],
                title="Member approaching specific deductible breach",
                description=(
                    f"Member {a['memberId']} has accumulated ${a['currentAccumulation']:,.0f} of a "
                    f"${a['threshold']:,.0f} specific deductible ({a['percentOfThreshold']}%)."
                ),
                action_required=a["recommendedAction"],
                member_id=a["memberId"], due_date=a.get("notificationDeadline"),
                estimated_impact=(f"${a['estimatedExposure']:,.0f} estimated exposure"
                                  if a.get("estimatedExposure") else None),
            ))

    # FWA alerts
    for d in data["fwa"]["detections"]:
        if d["severity"] in ("critical", "high"):
            db.add(models.KiqAlert(
                alert_id=d["detectionId"], plan_id=plan.kincaid_plan_id, domain="fwa",
                severity=d["severity"], title=f"FWA detection: {d['type']}",
                description=d["description"], action_required=d["recommendedAction"],
                member_id=d.get("memberId"),
                estimated_impact=f"${d['estimatedSavings']:,.0f} estimated savings",
            ))

    # Compliance alerts
    for issue in data["compliance"]["dol"]["issues"]:
        db.add(models.KiqAlert(
            alert_id=str(uuid.uuid4()), plan_id=plan.kincaid_plan_id, domain="compliance",
            severity="high", title="DOL compliance attention required",
            description=issue, action_required="Initiate the required filing and document progress.",
        ))

    # Cost alerts
    for b in data["costs"]["benchmarks"]:
        if b["category"] != "total" and b["variancePct"] > 15:
            db.add(models.KiqAlert(
                alert_id=str(uuid.uuid4()), plan_id=plan.kincaid_plan_id, domain="cost",
                severity="high" if b["variancePct"] > 25 else "medium",
                title=f"{b['category'].capitalize()} cost above benchmark",
                description=b["insight"],
                action_required="Review cost drivers and engage vendor / network management.",
                estimated_impact=f"{b['variancePct']}% above benchmark PMPM",
            ))

    # Member-risk alerts
    for m in data["members"]["members"]:
        if m["riskTier"] == "critical":
            db.add(models.KiqAlert(
                alert_id=str(uuid.uuid4()), plan_id=plan.kincaid_plan_id, domain="memberRisk",
                severity="high", title="Critical-risk member identified",
                description=f"Member {m['memberId']} has a risk score of {m['riskScore']}.",
                action_required="Refer to care management for proactive intervention.",
                member_id=m["memberId"],
                estimated_impact=f"${m['predictedAnnualCost']:,.0f} predicted annual cost",
            ))
    db.commit()
