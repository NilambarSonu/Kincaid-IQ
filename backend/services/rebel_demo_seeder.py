"""
Demo seeder for the Rebel IQ Intelligence API (v1).

Creates a demo tenant (with known API keys + signing secret), a registered plan,
and a realistic batch of de-identified claims / members / rx records — then runs
the analytics recompute so every intelligence endpoint returns live data. Enables
an end-to-end smoke test without a real Rebel IQ integration.
"""
from __future__ import annotations

import uuid
import random
import hashlib
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend import models
from backend.services.rebel_analytics import recompute_plan

DEMO_TENANT_ID = "rebel-demo-tenant"
DEMO_API_KEY = "rbl_demo_key_primary_0000000000"
DEMO_API_KEY_SECONDARY = "rbl_demo_key_secondary_0000000000"
DEMO_SIGNING_SECRET = "rbl_demo_signing_secret_change_me"


def _hashed_member(i: int) -> str:
    # Mirrors Rebel IQ's §12 obligation: members are de-identified as full
    # HMAC-SHA256 hex digests (64 hex chars) before being sent to Kincaid IQ.
    return hashlib.sha256(f"demo-member-{i}".encode()).hexdigest()


def seed_rebel_demo(db: Session) -> dict:
    rng = random.Random(42)

    # ── Tenant ────────────────────────────────────────────────────────────────
    tenant = db.query(models.RebelTenant).filter(
        models.RebelTenant.id == DEMO_TENANT_ID
    ).first()
    if tenant is None:
        tenant = models.RebelTenant(id=DEMO_TENANT_ID, name="Rebel IQ (Demo)")
        db.add(tenant)
    tenant.api_key_primary = DEMO_API_KEY
    tenant.api_key_primary_active = True
    tenant.api_key_secondary = DEMO_API_KEY_SECONDARY
    tenant.api_key_secondary_active = True
    tenant.signing_secret = DEMO_SIGNING_SECRET
    tenant.rate_limit_get = 300
    tenant.rate_limit_post = 60
    tenant.status = "active"
    db.commit()

    # ── Remove any prior demo plans for this tenant (idempotent reseed) ─────────
    old_plans = db.query(models.KincaidPlan).filter(
        models.KincaidPlan.tenant_id == DEMO_TENANT_ID
    ).all()
    for p in old_plans:
        pid = p.kincaid_plan_id
        db.query(models.IngestedClaim).filter(models.IngestedClaim.plan_id == pid).delete()
        db.query(models.IngestedMember).filter(models.IngestedMember.plan_id == pid).delete()
        db.query(models.IngestedRxClaim).filter(models.IngestedRxClaim.plan_id == pid).delete()
        db.query(models.IngestionBatch).filter(models.IngestionBatch.plan_id == pid).delete()
        db.query(models.KiqJob).filter(models.KiqJob.plan_id == pid).delete()
        db.query(models.KiqAlert).filter(models.KiqAlert.plan_id == pid).delete()
        db.query(models.KiqAnalyticsCache).filter(models.KiqAnalyticsCache.plan_id == pid).delete()
        db.delete(p)
    db.commit()

    # ── Plan ────────────────────────────────────────────────────────────────────
    plan_year = datetime.now(timezone.utc).year
    plan_id = "kiq_" + uuid.uuid4().hex
    member_count = 850
    spec_ded = 150000.0
    plan = models.KincaidPlan(
        kincaid_plan_id=plan_id, tenant_id=DEMO_TENANT_ID,
        rebel_plan_id=str(uuid.uuid4()), name="Acme Corp Health Plan (Demo)",
        plan_year=plan_year, member_count=member_count, state="TX",
        industry_code="541511", tpa_name="Meritain Health", pbm_name="CVS Caremark",
        stop_loss_carrier="Sun Life", specific_deductible=spec_ded,
        aggregate_attachment_point=4200000.0, aggregate_factor=125.0,
        plan_features={"hasHSA": True, "isHDHP": True, "hasBehavioralBenefit": True,
                       "hasTelemedicine": True},
        status="active",
    )
    db.add(plan)
    db.commit()

    # ── Generate de-identified claims across the past 12 months ─────────────────
    n_members = 220
    member_ids = [_hashed_member(i) for i in range(n_members)]
    providers = [f"{rng.randint(1000000000, 1999999999)}" for _ in range(40)]
    today = datetime.now(timezone.utc).date()
    period_start = (today - timedelta(days=365)).isoformat()
    period_end = today.isoformat()

    claims_batch_id = f"rebel-batch-claims-{uuid.uuid4()}"
    members_batch_id = f"rebel-batch-members-{uuid.uuid4()}"
    rx_batch_id = f"rebel-batch-rx-{uuid.uuid4()}"

    icd_pool = ["E11.9", "I10", "I25.10", "N18.5", "J45.909", "M54.5", "F41.1",
                "K21.9", "C50.911", "Z00.00"]
    em_codes = ["99213", "99214", "99215", "99203", "99204", "99205"]

    claims = []
    # A high-cost member who approaches the specific deductible.
    high_cost_member = member_ids[0]
    for _ in range(38):
        sd = today - timedelta(days=rng.randint(0, 120))
        paid = rng.uniform(2500, 6500)
        claims.append(models.IngestedClaim(
            plan_id=plan_id, batch_id=claims_batch_id,
            claim_id=f"TPA-CLM-{uuid.uuid4().hex[:8]}", member_id=high_cost_member,
            provider_id=rng.choice(providers), provider_type="facility",
            service_date=sd.isoformat(), paid_date=(sd + timedelta(days=10)).isoformat(),
            diagnosis_codes=["N18.5", "E11.9", "I25.10"],
            procedure_codes=["99285"], billed_amount=round(paid * 1.6, 2),
            allowed_amount=round(paid * 1.1, 2), paid_amount=round(paid, 2),
            plan_paid_amount=round(paid, 2), member_cost_share=round(paid * 0.05, 2),
            claim_type="institutional", is_high_cost=True,
        ))

    # An upcoding provider billing mostly 99215. Use a dedicated NPI that is NOT
    # in the general provider pool, so its high-complexity share isn't diluted by
    # general-population claims and stays above the spec's >80% threshold.
    upcoder = "1900000001"
    for _ in range(30):
        sd = today - timedelta(days=rng.randint(0, 180))
        code = "99215" if rng.random() < 0.9 else "99214"
        paid = rng.uniform(180, 320)
        claims.append(models.IngestedClaim(
            plan_id=plan_id, batch_id=claims_batch_id,
            claim_id=f"TPA-CLM-{uuid.uuid4().hex[:8]}", member_id=rng.choice(member_ids),
            provider_id=upcoder, provider_type="physician",
            service_date=sd.isoformat(), paid_date=(sd + timedelta(days=7)).isoformat(),
            diagnosis_codes=[rng.choice(icd_pool)], procedure_codes=[code],
            billed_amount=round(paid * 1.5, 2), allowed_amount=round(paid * 1.1, 2),
            paid_amount=round(paid, 2), plan_paid_amount=round(paid, 2),
            member_cost_share=round(paid * 0.2, 2), claim_type="professional",
        ))

    # General population claims.
    for _ in range(2600):
        sd = today - timedelta(days=rng.randint(0, 365))
        mid = rng.choice(member_ids)
        ptype = rng.choices(["physician", "facility", "behavioral", "ancillary"],
                            weights=[55, 25, 8, 12])[0]
        base = {"physician": 220, "facility": 1400, "behavioral": 180, "ancillary": 320}[ptype]
        paid = rng.uniform(base * 0.4, base * 2.2)
        claims.append(models.IngestedClaim(
            plan_id=plan_id, batch_id=claims_batch_id,
            claim_id=f"TPA-CLM-{uuid.uuid4().hex[:8]}", member_id=mid,
            provider_id=rng.choice(providers), provider_type=ptype,
            service_date=sd.isoformat(), paid_date=(sd + timedelta(days=9)).isoformat(),
            diagnosis_codes=[rng.choice(icd_pool)],
            procedure_codes=[rng.choice(em_codes)] if ptype == "physician" else ["G0000"],
            billed_amount=round(paid * 1.6, 2), allowed_amount=round(paid * 1.1, 2),
            paid_amount=round(paid, 2), plan_paid_amount=round(paid, 2),
            member_cost_share=round(paid * 0.15, 2),
            claim_type="institutional" if ptype == "facility" else "professional",
        ))

    # A duplicate claim pair — the SAME claimId submitted twice (spec §10.4).
    dup_member = member_ids[5]
    dup_provider = providers[3]
    dup_date = (today - timedelta(days=40)).isoformat()
    dup_claim_id = f"TPA-CLM-{uuid.uuid4().hex[:8]}"
    for _ in range(2):
        claims.append(models.IngestedClaim(
            plan_id=plan_id, batch_id=claims_batch_id,
            claim_id=dup_claim_id, member_id=dup_member,
            provider_id=dup_provider, provider_type="facility",
            service_date=dup_date, paid_date=dup_date,
            diagnosis_codes=["M54.5"], procedure_codes=["72148"],
            billed_amount=6200.00, allowed_amount=4100.00, paid_amount=4100.00,
            plan_paid_amount=4100.00, member_cost_share=200.00, claim_type="institutional",
        ))

    db.bulk_save_objects(claims)

    # ── Members roster ──────────────────────────────────────────────────────────
    age_bands = ["25-34", "35-44", "45-54", "55-64"]
    tiers = ["employee-only", "employee-plus-spouse", "employee-plus-family"]
    rels = ["subscriber", "spouse", "dependent"]
    member_records = []
    for i, mid in enumerate(member_ids):
        member_records.append(models.IngestedMember(
            plan_id=plan_id, batch_id=members_batch_id, member_id=mid,
            relationship_type=rng.choice(rels), age_range=rng.choice(age_bands),
            gender=rng.choice(["M", "F", "U"]), region="TX",
            coverage_tier=rng.choice(tiers), is_active=True,
        ))
    db.bulk_save_objects(member_records)

    # ── Rx claims (specialty-driven pharmacy spend) ─────────────────────────────
    rx_records = []
    specialty_members = member_ids[:3]
    for mid in specialty_members:
        for _ in range(11):
            sd = today - timedelta(days=rng.randint(0, 330))
            paid = rng.uniform(8000, 14000)
            rx_records.append(models.IngestedRxClaim(
                plan_id=plan_id, batch_id=rx_batch_id, claim_id=f"RX-{uuid.uuid4().hex[:8]}",
                member_id=mid, dispensed_date=sd.isoformat(), ndc="00071-0155-23",
                drug_name="Specialty Therapy", drug_category="specialty",
                is_specialty=True, is_brand=True, days_supply=30,
                billed_amount=round(paid * 1.2, 2), plan_paid_amount=round(paid, 2),
                member_cost_share=150.00,
            ))
    for _ in range(1400):
        sd = today - timedelta(days=rng.randint(0, 365))
        paid = rng.uniform(20, 280)
        rx_records.append(models.IngestedRxClaim(
            plan_id=plan_id, batch_id=rx_batch_id, claim_id=f"RX-{uuid.uuid4().hex[:8]}",
            member_id=rng.choice(member_ids), dispensed_date=sd.isoformat(),
            ndc="00069-0150-68", drug_name="Generic Maintenance", drug_category="maintenance",
            is_specialty=False, is_brand=rng.random() < 0.3, days_supply=rng.choice([30, 90]),
            billed_amount=round(paid * 1.3, 2), plan_paid_amount=round(paid, 2),
            member_cost_share=round(paid * 0.25, 2),
        ))
    db.bulk_save_objects(rx_records)

    # ── Ingestion batches + completed jobs (for history/job polling) ────────────
    now = datetime.now(timezone.utc)
    for bid, btype, count, ps, pe, snap in [
        (claims_batch_id, "claims", len(claims), period_start, period_end, None),
        (members_batch_id, "members", len(member_records), None, None, today.isoformat()),
        (rx_batch_id, "rx", len(rx_records), period_start, period_end, None),
    ]:
        job_id = "kiq-job-" + uuid.uuid4().hex
        db.add(models.KiqJob(
            job_id=job_id, plan_id=plan_id, batch_id=bid, type=f"{btype}-ingestion",
            status="complete", records_total=count, records_processed=count,
            records_rejected=0, rejection_reasons=[], started_at=now, completed_at=now,
        ))
        db.add(models.IngestionBatch(
            batch_id=bid, plan_id=plan_id, job_id=job_id, type=btype, status="processed",
            records_received=count, records_processed=count, records_rejected=0,
            rejection_reasons=[], period_start=ps, period_end=pe, snapshot_date=snap,
            processed_at=now,
        ))
    db.commit()

    # ── Recompute intelligence ──────────────────────────────────────────────────
    recompute_plan(plan_id, db)

    return {
        "tenantId": DEMO_TENANT_ID,
        "apiKey": DEMO_API_KEY,
        "apiKeySecondary": DEMO_API_KEY_SECONDARY,
        "signingSecret": DEMO_SIGNING_SECRET,
        "kincaidPlanId": plan_id,
        "planYear": plan_year,
        "memberCount": member_count,
        "claimsIngested": len(claims),
        "membersIngested": len(member_records),
        "rxIngested": len(rx_records),
        "message": "Demo tenant + plan seeded. Use the API key and signing secret to call /v1 endpoints.",
    }
