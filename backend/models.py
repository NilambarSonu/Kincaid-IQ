from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, LargeBinary, func, ForeignKey, UniqueConstraint, Index, JSON, CheckConstraint
from backend.database import Base


# ─── User Module Permissions ──────────────────────────────────────────────────

class UserPermission(Base):
    """Grants a user view/edit access to a named module."""
    __tablename__ = "user_permissions"
    __table_args__ = (UniqueConstraint("user_id", "module", name="uq_user_module"),)

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    module     = Column(String, nullable=False, index=True)
    can_view   = Column(Boolean, nullable=False, default=True)
    can_edit   = Column(Boolean, nullable=False, default=False)
    granted_by = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


# ─── SaaS Multi-Tenancy ───────────────────────────────────────────────────────

class Organization(Base):
    """A tenant — employer group, broker firm, or consulting practice."""
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    plan = Column(String, nullable=False, default="trial")          # trial|fiduciary|broker|enterprise
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status = Column(String, default="trialing")        # trialing|active|past_due|canceled
    trial_ends_at = Column(DateTime, nullable=True)
    # Plan metadata
    org_type = Column(String, default="employer")                   # employer|broker|consultant|tpa
    employees = Column(Integer, nullable=True)
    ein = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    annual_premium = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class OrganizationMember(Base):
    """Maps users to organizations with roles."""
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_member"),)

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, default="analyst")                        # owner|admin|analyst|viewer
    created_at = Column(DateTime, server_default=func.now())


class PlanClient(Base):
    """A client employer plan managed by a broker/consultant org."""
    __tablename__ = "plan_clients"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    org_id = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    ein = Column(String, nullable=True)
    plan_type = Column(String, nullable=True)                       # self-funded|fully-insured|level-funded
    funding_type = Column(String, nullable=True)
    employees = Column(Integer, nullable=True)
    annual_spend = Column(Float, nullable=True)
    tpa = Column(String, nullable=True)
    carrier = Column(String, nullable=True)
    broker_of_record = Column(String, nullable=True)
    renewal_date = Column(String, nullable=True)
    state = Column(String, nullable=True)
    sic_code = Column(String, nullable=True)
    risk_score = Column(Float, nullable=True)
    status = Column(String, default="active")                       # active|prospect|churned
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True, index=True)
    hashed_password = Column(String, name="password", nullable=True)
    oauth_provider = Column(String, nullable=True)
    oauth_sub = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class UserPreference(Base):
    """
    Per-user (optionally per-org) key/value preference store.
    Lets tuned UI settings — e.g. the Benefits Benchmarking "fees rising at
    rank" divergence thresholds — follow a broker across devices and browsers
    instead of living only in localStorage. org_id is captured best-effort so a
    firm can later standardize sensitivity across analysts.
    """
    __tablename__ = "user_preferences"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_user_pref_key"),)

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id     = Column(String, nullable=True, index=True)
    key        = Column(String, nullable=False, index=True)
    value      = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    prompt = Column(Text, nullable=False)
    provider = Column(String, nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


# ─── Immutable Audit Log ──────────────────────────────────────────────────────

class AuditLog(Base):
    """
    Fiduciary-grade immutable audit trail.
    Every row is tamper-evident: the hash covers user + action + tenant +
    timestamp + detail so any post-write mutation is detectable.

    Satisfies:
    - SOC 2 Type II — CC6.1 logical access, CC7.2 event monitoring
    - HIPAA § 164.312(b) — audit controls
    - ERISA § 404(a) — prudent fiduciary documentation
    """
    __tablename__ = "audit_logs"

    id         = Column(Integer, primary_key=True, index=True)
    user       = Column(String, nullable=False, index=True)   # actor username / "system"
    action     = Column(String, nullable=False, index=True)   # verb: uploaded_contract, login, etc.
    tenant     = Column(String, nullable=True,  index=True)   # org_id / employer_id / "system"
    category   = Column(String, nullable=False, index=True)   # AUTH | EXPORT | UPLOAD | …
    resource   = Column(String, nullable=True)                # what was acted on
    detail     = Column(Text, nullable=True)                  # JSON blob — supplemental context
    ip         = Column(String, nullable=True)
    success    = Column(Boolean, nullable=False, default=True)
    hash       = Column(String, nullable=False)               # SHA-256(canonical payload)
    timestamp  = Column(DateTime, server_default=func.now(), index=True)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    ticker = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    target_price = Column(Float, nullable=True)
    alert_threshold_pct = Column(Float, nullable=True, default=5.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class VaultDocument(Base):
    __tablename__ = "vault_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    linked_asset = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    file_type = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


# ─── Governance Spine ─────────────────────────────────────────────────────────

class Claim(Base):
    """A governed claim object — every displayed KPI/metric with full evidence lineage."""
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(String, nullable=False, unique=True, index=True)   # e.g. CLM-2025-001
    kpi_key = Column(String, nullable=False, index=True)                  # e.g. "cost_trend_stress"
    title = Column(String, nullable=False)
    value = Column(String, nullable=False)                                # serialised numeric or string value
    unit = Column(String, nullable=True)                                  # "%", "$", "bps", etc.
    format = Column(String, nullable=True)                                # display format hint e.g. "currency"
    period = Column(String, nullable=True)                                # e.g. "2024-Q4", "FY2024"

    # Evidence lineage
    evidence_ids = Column(Text, nullable=False, default="[]")             # JSON array of EvidenceArtifact IDs
    transform_ids = Column(Text, nullable=False, default="[]")            # JSON array of TransformStep IDs
    evidence_hash = Column(String, nullable=False, default="")            # SHA3-256 of all evidence IDs

    # Governance envelope
    verified_status = Column(String, nullable=False, default="UNVERIFIED")  # VERIFIED | UNVERIFIED | DISPUTED
    freshness_status = Column(String, nullable=False, default="GREEN")       # GREEN | YELLOW | RED
    confidence_score = Column(Float, nullable=False, default=0.0)            # 0.0–1.0

    computed_at = Column(DateTime, server_default=func.now())


# ─── Provenance Chain ─────────────────────────────────────────────────────────

class EvidenceArtifact(Base):
    """
    Level 1 of the provenance chain.
    A raw source datum — the atomic unit of proof behind every governed claim.
    """
    __tablename__ = "evidence_artifacts"

    id          = Column(Integer, primary_key=True, index=True)
    evidence_id = Column(String, nullable=False, unique=True, index=True)  # EV-YYYY-NNNN
    source_type = Column(String, nullable=False)   # SPREADSHEET | API | DOCUMENT | DATABASE | MANUAL
    source_uri  = Column(Text,   nullable=False)   # URL, filename, query key, etc.
    source_hash = Column(String, nullable=False)   # SHA3-256 of raw payload content
    description = Column(Text,   nullable=True)
    received_at = Column(DateTime, server_default=func.now())


class Transform(Base):
    """
    Level 2 of the provenance chain.
    A deterministic computation applied to one or more EvidenceArtifacts
    that produces a DerivedMetric.
    """
    __tablename__ = "transforms"

    id           = Column(Integer, primary_key=True, index=True)
    transform_id = Column(String, nullable=False, unique=True, index=True)  # TX-YYYY-NNNN
    name         = Column(String, nullable=False)    # e.g. "ROIC Calculation"
    formula      = Column(Text,   nullable=True)     # e.g. "nopat / invested_capital"
    input_hashes = Column(Text,   nullable=False, default="[]")  # JSON: [EV-*, ...]
    output_kpi_key = Column(String, nullable=False, index=True)  # links to Claim.kpi_key
    output_hash  = Column(String, nullable=False)    # SHA3-256(name+formula+sorted inputs)
    executed_at  = Column(DateTime, server_default=func.now())
    code_version = Column(String, nullable=True)     # version tag of the transform code
    executor     = Column(String, nullable=True)     # system/user that ran the transform


class DerivedMetric(Base):
    """
    Level 3 of the provenance chain.
    The typed, period-stamped output of a Transform — the value that
    a RenderedClaim will be built from.
    """
    __tablename__ = "derived_metrics"

    id           = Column(Integer, primary_key=True, index=True)
    metric_id    = Column(String, nullable=False, unique=True, index=True)  # DM-YYYY-NNNN
    transform_id = Column(String, nullable=False, index=True)  # references Transform.transform_id
    kpi_key      = Column(String, nullable=False, index=True)  # links to Claim.kpi_key
    value        = Column(String, nullable=False)               # serialised numeric or string
    unit         = Column(String, nullable=True)
    period       = Column(String, nullable=True)                # e.g. "2024-Q4"
    computed_at  = Column(DateTime, server_default=func.now())


class DecisionReceipt(Base):
    """A cryptographically-stamped record of every system recommendation or action."""
    __tablename__ = "decision_receipts"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(String, nullable=False, unique=True, index=True)  # e.g. DRP-2025-001
    action = Column(String, nullable=False)                                # recommended action
    rationale = Column(Text, nullable=False)                               # why — human-readable
    claim_ids = Column(Text, nullable=True)                                # JSON array of claim_ids used
    policy_state = Column(Text, nullable=True)                             # JSON snapshot of policy at generation time
    confidence = Column(Float, nullable=True)                              # aggregate confidence
    model_path = Column(String, nullable=True)                             # model/transform chain used
    export_allowed = Column(Boolean, nullable=False, default=False)
    board_grade = Column(Boolean, nullable=False, default=False)
    generated_by = Column(String, nullable=True)                           # "system" | user_id
    generated_at = Column(DateTime, server_default=func.now())


class PbmContract(Base):
    __tablename__ = "pbm_contracts"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pbm_name = Column(String, nullable=True)
    contract_filename = Column(String, nullable=False)
    contract_text = Column(Text, nullable=True)
    status = Column(String, default="pending")          # pending|analyzing|complete|error
    error_message = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=True)
    rating = Column(String, nullable=True)              # excellent|good|fair|concern|red_flag
    provision_scores = Column(Text, nullable=True)      # JSON array
    quick_look = Column(Text, nullable=True)            # JSON array
    negotiation_guide = Column(Text, nullable=True)     # JSON array
    key_findings = Column(Text, nullable=True)          # JSON array
    compare_contract_id = Column(String, nullable=True) # id of contract to compare with
    compare_result = Column(Text, nullable=True)        # JSON comparison result
    created_at = Column(DateTime, server_default=func.now())


class StopLossContract(Base):
    __tablename__ = "stop_loss_contracts"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    carrier_name = Column(String, nullable=True)
    contract_filename = Column(String, nullable=False)
    contract_text = Column(Text, nullable=True)
    status = Column(String, default="pending")
    error_message = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=True)
    rating = Column(String, nullable=True)
    provision_scores = Column(Text, nullable=True)
    quick_look = Column(Text, nullable=True)
    negotiation_guide = Column(Text, nullable=True)
    key_findings = Column(Text, nullable=True)
    compare_contract_id = Column(String, nullable=True)
    compare_result = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class RxDefenseContract(Base):
    __tablename__ = "rx_defense_contracts"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pbm_name = Column(String, nullable=True)
    contract_filename = Column(String, nullable=False)
    contract_text = Column(Text, nullable=True)
    status = Column(String, default="pending")
    error_message = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=True)
    rating = Column(String, nullable=True)
    provision_scores = Column(Text, nullable=True)
    quick_look = Column(Text, nullable=True)
    negotiation_guide = Column(Text, nullable=True)
    key_findings = Column(Text, nullable=True)
    compare_contract_id = Column(String, nullable=True)
    compare_result = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class TpaIqContract(Base):
    """TPA IQ — Third-Party Administrator agreement forensic analysis."""
    __tablename__ = "tpa_iq_contracts"

    id = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tpa_name = Column(String, nullable=True)
    contract_filename = Column(String, nullable=False)
    contract_text = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending|analyzing|complete|error
    error_message = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=True)
    rating = Column(String, nullable=True)        # excellent|good|fair|concern|red_flag
    grade = Column(String, nullable=True)         # fiduciary|institutional|commercial|substandard|litigation_sensitive
    provision_scores = Column(Text, nullable=True)   # JSON string
    key_findings = Column(Text, nullable=True)       # JSON string
    framework_scores = Column(Text, nullable=True)   # JSON string — 7 final-decision scores
    verdict = Column(Text, nullable=True)            # JSON string — fiduciary conclusion + rationale
    created_at = Column(DateTime, server_default=func.now())


# ─── À-la-carte Module Subscriptions ─────────────────────────────────────────

class ModuleSubscription(Base):
    """Tracks an individual product/module subscription purchased via Stripe."""
    __tablename__ = "module_subscriptions"

    id                      = Column(String, primary_key=True, index=True)
    user_id                 = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    org_id                  = Column(String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    product_id              = Column(String, nullable=False)
    modules_json            = Column(Text, nullable=False)
    stripe_customer_id      = Column(String, nullable=True, index=True)
    stripe_subscription_id  = Column(String, nullable=True, index=True)
    stripe_session_id       = Column(String, nullable=True)
    status                  = Column(String, default="active")
    current_period_end      = Column(DateTime, nullable=True)
    created_at              = Column(DateTime, server_default=func.now())


class RxDefenseCredit(Base):
    """A pre-paid Rx Defense IQ™ analysis credit — $999 per report."""
    __tablename__ = "rx_defense_credits"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stripe_session_id = Column(String, nullable=True, unique=True)
    contract_id       = Column(String, nullable=True)
    used              = Column(Boolean, default=False, nullable=False)
    created_at        = Column(DateTime, server_default=func.now())


class DiscoveredContact(Base):
    """A prospect contact discovered via Contact Intelligence™ (Hunter.io + Claude)."""
    __tablename__ = "discovered_contacts"

    id                  = Column(Integer, primary_key=True, index=True)
    ein                 = Column(String, nullable=True, index=True)
    employer_name       = Column(String, nullable=False)
    plan_name           = Column(String, nullable=True)
    city                = Column(String, nullable=True)
    state               = Column(String, nullable=True, index=True)
    participants        = Column(Integer, nullable=True)
    welfare_premiums    = Column(Float, nullable=True)
    domain              = Column(String, nullable=True)
    first_name          = Column(String, nullable=True)
    last_name           = Column(String, nullable=True)
    email               = Column(String, nullable=False, index=True)
    position            = Column(String, nullable=True)
    confidence          = Column(Integer, nullable=True)
    verification_result = Column(String, nullable=True)
    verification_score  = Column(Integer, nullable=True)
    outreach_subject    = Column(String, nullable=True)
    outreach_body       = Column(Text, nullable=True)
    status              = Column(String, nullable=False, default="new", index=True)
    notes               = Column(Text, nullable=True)
    discovered_at       = Column(DateTime, server_default=func.now())


# ─── Usage Metering ───────────────────────────────────────────────────────────

class UsageRecord(Base):
    """
    Monthly usage ledger per tenant.
    Powers calculateBill():
        contracts  × $120.00
        claims     × $0.02
        api_calls  × $0.001

    One row per (tenant_id, billing_period). Upserted on every metered event.
    """
    __tablename__ = "usage_records"
    __table_args__ = (UniqueConstraint("tenant_id", "billing_period", name="uq_usage_period"),)

    id             = Column(Integer, primary_key=True, index=True)
    tenant_id      = Column(String, nullable=False, index=True)   # org_id
    billing_period = Column(String, nullable=False, index=True)   # "2026-04" (YYYY-MM)
    contracts      = Column(Integer, nullable=False, default=0)   # contracts analyzed
    claims         = Column(Integer, nullable=False, default=0)   # claim events processed
    api_calls      = Column(Integer, nullable=False, default=0)   # intelligence API calls
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ─── KIQ Intelligence Events ──────────────────────────────────────────────────

class IntelligenceEvent(Base):
    """
    Persists every pipeline result triggered by the webhook event router.
    Each row = one analyzed event (claim denial, contract change, etc.)
    Maps to guide's intelligence_events table schema.
    """
    __tablename__ = "intelligence_events"

    id               = Column(Integer, primary_key=True, index=True)
    employer_id      = Column(String, nullable=True, index=True)
    event_type       = Column(String, nullable=False, index=True)   # CLAIM_DENIAL | CONTRACT_CHANGE | …
    pipeline         = Column(String, nullable=True)                 # pbm_contract | prior_auth | pe_diligence
    risk_score       = Column(Float,  nullable=True)
    financial_impact = Column(Float,  nullable=True)                 # USD — direct_cost + downstream
    legal_exposure   = Column(Text,   nullable=True)                 # ERISA citations + severity summary
    clinical_risk    = Column(Text,   nullable=True)                 # patient impact description
    summary          = Column(Text,   nullable=True)                 # orchestrator executive summary
    raw_result       = Column(Text,   nullable=True)                 # full JSON pipeline output
    timestamp        = Column(DateTime, server_default=func.now(), index=True)


# ─── Meeting Intelligence™ ────────────────────────────────────────────────────

class MeetingSession(Base):
    """
    White-label client meeting note-taker.
    Captures transcript, AI analysis, action items, and fiduciary summary.
    """
    __tablename__ = "meeting_sessions"

    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String, nullable=False, default="New Meeting")
    client_name   = Column(String, nullable=False, default="")
    meeting_type  = Column(String, nullable=False, default="advisory")   # advisory|quarterly|planning|onboarding|review
    date          = Column(String, nullable=False)                        # ISO date string
    duration_mins = Column(Integer, nullable=True)
    status        = Column(String, nullable=False, default="draft")       # draft|complete|analyzing|analyzed
    transcript    = Column(Text, nullable=True)
    ai_analysis   = Column(Text, nullable=True)                          # JSON stored as text
    created_at    = Column(DateTime, server_default=func.now(), index=True)
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════════════════════
# Rx Ingestion Pipeline — Data Layer
# Pipeline: CSV/JSON → /ingest/claims → normalize → RxClaim (PG) → DRAP
# Separate from Claim (KPI governance). This is the raw Rx claims data store.
# ═══════════════════════════════════════════════════════════════════════════════

class RxClaim(Base):
    """
    Canonical Rx pharmacy claim object — ingestion layer.

    Distinct from Claim (KPI governance provenance). This is the raw claim
    record produced by the PBM adjudication system and ingested via the
    data pipeline (/ingest/claims).

    DRAP computation:
      spread            = plan_pay − allowable_price   (per-claim EBITDA leakage)
      drap_contribution = spread                       (DRAP unit)
      DRAP              = Σ drap_contribution          (portfolio-level leakage)
    """
    __tablename__ = "rx_claims"

    id              = Column(Integer, primary_key=True, index=True)
    ingestion_id    = Column(String, nullable=False, index=True)         # batch UUID

    # ── Canonical claim fields (spec) ─────────────────────────────────────────
    claim_id        = Column(String, nullable=False, unique=True, index=True)
    ndc             = Column(String, nullable=False, index=True)         # NDC-11
    drug_name       = Column(String, nullable=True)
    pharmacy_id     = Column(String, nullable=False, index=True)
    quantity        = Column(Float, nullable=True)
    days_supply     = Column(Integer, nullable=True)
    ingredient_cost = Column(Float, nullable=True)
    dispensing_fee  = Column(Float, nullable=True)
    total_paid      = Column(Float, nullable=False)
    patient_pay     = Column(Float, nullable=True, default=0.0)
    plan_pay        = Column(Float, nullable=False)
    fill_date       = Column(DateTime, nullable=False)

    # ── DRAP computation layer ────────────────────────────────────────────────
    allowable_price   = Column(Float, nullable=True)   # NADAC or contractual benchmark
    spread            = Column(Float, nullable=True)   # plan_pay − allowable_price
    drap_contribution = Column(Float, nullable=True)   # EBITDA leakage unit (= spread)
    leakage_type      = Column(String, nullable=True)  # SPREAD_PRICING | REBATE_DELAY |
                                                       # SPECIALTY_INFLATION | PASS_THROUGH | OTHER

    # ── Provenance ────────────────────────────────────────────────────────────
    source_file  = Column(String, nullable=True)       # original filename
    ingested_at  = Column(DateTime, server_default=func.now())


class IngestionRun(Base):
    """
    Audit trail for every pipeline ingestion batch.

    Each call to /ingest/claims, /ingest/rebates, or /ingest/contracts
    produces one IngestionRun — the observable unit of the data pipeline.
    Enables rollback, auditing, and DRAP reconciliation by batch.
    """
    __tablename__ = "ingestion_runs"

    id            = Column(Integer, primary_key=True, index=True)
    ingestion_id  = Column(String, nullable=False, unique=True, index=True)  # UUID
    source_type   = Column(String, nullable=False)   # claims | rebates | contracts
    source_file   = Column(String, nullable=True)    # original filename
    record_count  = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    skip_count    = Column(Integer, nullable=False, default=0)   # duplicates skipped
    error_count   = Column(Integer, nullable=False, default=0)
    total_plan_pay = Column(Float, nullable=True)    # Σ plan_pay ingested
    total_drap     = Column(Float, nullable=True)    # Σ spread (where computable)
    status        = Column(String, nullable=False, default="COMPLETE")  # COMPLETE|PARTIAL|FAILED
    errors_json   = Column(Text, nullable=True)      # JSON [{row, error}]
    ingested_at   = Column(DateTime, server_default=func.now())
    ingested_by   = Column(String, nullable=True)    # user_id (optional)


class RxRebate(Base):
    """
    Rebate record ingested from PBM rebate file (/ingest/rebates).

    rebate_delay_days = payment_date − fill_date.
    REBATE_DELAY classification fires when this exceeds 30 days.
    """
    __tablename__ = "rx_rebates"

    id              = Column(Integer, primary_key=True, index=True)
    ingestion_id    = Column(String, nullable=False, index=True)
    rebate_id       = Column(String, nullable=False, unique=True, index=True)
    ndc             = Column(String, nullable=False, index=True)
    drug_name       = Column(String, nullable=True)
    rebate_amount   = Column(Float, nullable=False)
    rebate_period   = Column(String, nullable=True)     # e.g. "2024-Q1"
    fill_date       = Column(DateTime, nullable=True)
    payment_date    = Column(DateTime, nullable=True)
    days_to_payment = Column(Integer, nullable=True)    # rebate_delay_days
    source_file     = Column(String, nullable=True)
    ingested_at     = Column(DateTime, server_default=func.now())


class RxContract(Base):
    """
    PBM / carrier contract ingested via /ingest/contracts.

    Stores extracted metadata + raw text for downstream contract analysis
    (L3 drill-down: mechanism → contract clause mapping).
    """
    __tablename__ = "rx_contracts"

    id             = Column(Integer, primary_key=True, index=True)
    ingestion_id   = Column(String, nullable=False, index=True)
    contract_id    = Column(String, nullable=False, unique=True, index=True)
    counterparty   = Column(String, nullable=True)      # PBM / carrier name
    contract_type  = Column(String, nullable=True)      # pbm | stop_loss | mac | rebate
    effective_date = Column(DateTime, nullable=True)
    expiry_date    = Column(DateTime, nullable=True)
    raw_text       = Column(Text, nullable=True)        # full extracted text
    clause_count   = Column(Integer, nullable=True)     # number of clauses parsed
    source_file    = Column(String, nullable=True)
    ingested_at    = Column(DateTime, server_default=func.now())


class AiOutputHistory(Base):
    """
    Lightweight history log for AI-generated outputs.
    Keyed by user_id + tool + entity_id. Last 20 entries per (user, entity) retained.
    Supports before/after comparison of analyses over time.
    user_id is nullable for backward compatibility but always set on new rows.
    """
    __tablename__ = "ai_output_history"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    tool         = Column(String, nullable=False, index=True)   # rx_defense | war_room | benchmarking
    entity_id    = Column(String, nullable=False, index=True)   # contract_id | EIN | tile_id
    label        = Column(String, nullable=True)                # user-provided label
    output_json  = Column(Text, nullable=False)                 # full JSON AI result
    score_snapshot = Column(Float, nullable=True)               # score at generation time (for quick diff)
    generated_at = Column(DateTime, server_default=func.now(), index=True)


class ClientPackageDelivery(Base):
    """
    Audit log of client-package email deliveries.
    One row per POST /api/export/client-package/email call (whether SMTP succeeded or queued).
    """
    __tablename__ = "client_package_deliveries"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    recipient       = Column(String, nullable=False)
    recipients      = Column(Text, nullable=True)        # JSON-encoded list
    cc              = Column(Text, nullable=True)        # JSON-encoded list
    bcc_count       = Column(Integer, nullable=True, default=0)  # count only — addresses never stored
    subject         = Column(String, nullable=True)
    filename        = Column(String, nullable=True)
    size_bytes      = Column(Integer, nullable=True)
    components      = Column(Text, nullable=True)        # JSON-encoded list
    component_count = Column(Integer, nullable=True)
    # Raw markdown body of an emailed executive-summary diff (source == 'diff').
    # Persisted so a broker can re-fire the exact same diff from the delivery log
    # without rebuilding it in the AI History panel. NULL for packaged-ZIP rows.
    body_markdown   = Column(Text, nullable=True)
    ein             = Column(String, nullable=True, index=True)
    rx_defense_id   = Column(String, nullable=True, index=True)
    client_name     = Column(String, nullable=True)
    smtp_sent       = Column(Boolean, default=False)
    # 'manual'    — broker clicked Send on the Client Package page
    # 'scheduled' — fired by the delivery-log auto-email scheduler
    source          = Column(String, nullable=False, default="manual", index=True)
    created_at      = Column(DateTime, server_default=func.now(), index=True)


class ClientPackageSnapshot(Base):
    """
    Point-in-time snapshot of a single client-package component, captured the
    moment a delivery was sent. Lets the audit drawer show *exactly* what the
    client received (byte-identical) months later, instead of rebuilding from
    current EIN / contract / benchmark data which may have since changed.
    One row per component per delivery.
    """
    __tablename__ = "client_package_snapshots"

    id           = Column(Integer, primary_key=True, index=True)
    delivery_id  = Column(Integer, ForeignKey("client_package_deliveries.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    component_id = Column(String, nullable=False)   # rx_redline | rx_scorecard | benchmarking_employer | benchmarking_summary | board_pack
    label        = Column(String, nullable=True)
    filename     = Column(String, nullable=True)
    kind         = Column(String, nullable=True)    # docx | pdf | json
    sha256       = Column(String, nullable=True)
    size_bytes   = Column(Integer, nullable=True)
    data         = Column(LargeBinary, nullable=False)
    created_at   = Column(DateTime, server_default=func.now())


class ClientPackageDeliverySchedule(Base):
    """
    Recurring auto-email of the client-package delivery log CSV to compliance.

    One row per user (uniqueness enforced at the application layer in the
    upsert endpoint). When `enabled`, a background job runs hourly and any
    schedule whose `next_run_at <= now` is fired: the same CSV produced by
    `GET /api/export/client-package/history.csv` is generated and emailed
    to `recipients` (+ optional `cc`).
    """
    __tablename__ = "client_package_delivery_schedules"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    enabled         = Column(Boolean, nullable=False, default=True)
    frequency       = Column(String, nullable=False, default="weekly")  # 'weekly' | 'monthly'
    day_of_week     = Column(Integer, nullable=True)   # 0=Mon..6=Sun (weekly only)
    day_of_month    = Column(Integer, nullable=True)   # 1..28 (monthly only)
    hour_utc        = Column(Integer, nullable=False, default=13)  # 0..23, local-time hour expressed in `timezone` (column name retained for back-compat)
    timezone        = Column(String, nullable=False, default="UTC")  # IANA zone, e.g. 'America/New_York'
    recipients      = Column(Text, nullable=False)     # JSON-encoded list of emails
    cc              = Column(Text, nullable=True)      # JSON-encoded list of emails
    subject         = Column(String, nullable=True)
    last_run_at     = Column(DateTime, nullable=True)
    last_status     = Column(String, nullable=True)    # 'sent' | 'queued' | 'failed'
    last_error      = Column(Text, nullable=True)
    last_row_count  = Column(Integer, nullable=True)
    next_run_at     = Column(DateTime, nullable=True, index=True)
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RecoveryAction(Base):
    """
    Recovery Operator — tracks pursuit of a Claims Recovery finding from
    Identified → Demand Sent → Response Received → Settled → Distributed.
    Each row is a billable contingency event for Kincaid RMC.
    """
    __tablename__ = "recovery_actions"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    finding_id        = Column(String, nullable=False, index=True)
    finding_category  = Column(String, nullable=True)
    finding_severity  = Column(String, nullable=True)
    target_party      = Column(String, nullable=True)  # PBM / TPA / Carrier / Provider
    status            = Column(String, nullable=False, default="identified", index=True)
                        # identified | demand_sent | response_received | negotiating | settled | distributed | declined
    amount_claimed    = Column(Float, nullable=True)
    amount_recovered  = Column(Float, nullable=True, default=0.0)
    contingency_pct   = Column(Float, nullable=False, default=28.0)
    contingency_fee   = Column(Float, nullable=True, default=0.0)
    demand_letter_path = Column(String, nullable=True)
    demand_sent_at    = Column(DateTime, nullable=True)
    response_at       = Column(DateTime, nullable=True)
    settled_at        = Column(DateTime, nullable=True)
    distributed_at    = Column(DateTime, nullable=True)
    notes             = Column(Text, nullable=True)
    created_at        = Column(DateTime, server_default=func.now(), index=True)
    updated_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())


class HIOSAuditLog(Base):
    """HIOS enterprise audit trail — every handoff, export, alert.
    Indexed for fast per-org queries at fleet scale (10K+ orgs)."""
    __tablename__ = "hios_audit_log"
    __table_args__ = (
        Index("ix_hios_audit_org_ts", "org_id", "ts"),
        Index("ix_hios_audit_action", "action"),
    )

    id        = Column(Integer, primary_key=True, index=True)
    org_id    = Column(String, nullable=True, index=True)
    user_id   = Column(String, nullable=True, index=True)
    action    = Column(String, nullable=False)            # pbm_pursue | lit_pursue | appeal_draft | export | alert
    subject_id = Column(String, nullable=True)            # flag_id / sig_id / case_id
    target    = Column(String, nullable=True)             # PBM name / payer / etc
    amount    = Column(Float, nullable=True, default=0.0)
    severity  = Column(String, nullable=True)
    ts        = Column(DateTime, server_default=func.now(), index=True)
    ip        = Column(String, nullable=True)
    meta      = Column(Text, nullable=True)


class HIOSComment(Base):
    """Comments + @mentions on HIOS findings (PBM flags, lit signals, PA cases)."""
    __tablename__ = "hios_comments"
    __table_args__ = (
        Index("ix_hios_comments_finding_ts", "finding_id", "created_at"),
        Index("ix_hios_comments_org", "org_id"),
    )
    id          = Column(Integer, primary_key=True, index=True)
    org_id      = Column(String, nullable=True, index=True)
    user_id     = Column(String, nullable=False, index=True)
    finding_id  = Column(String, nullable=False, index=True)  # e.g. PBM-FLAG-001 / LIT-003
    body        = Column(Text, nullable=False)
    mentioned   = Column(Text, nullable=True)  # JSON list of user_ids/emails @mentioned
    created_at  = Column(DateTime, server_default=func.now(), index=True)


class HIOSReadMarker(Base):
    """Per-user notification read cursor for HIOS audit/activity feed."""
    __tablename__ = "hios_read_markers"
    user_id        = Column(String, primary_key=True)
    last_read_at   = Column(DateTime, server_default=func.now())


class SalesOsScore(Base):
    """Sales OS™ — cached 7-factor opportunity scores per EIN."""
    __tablename__ = "sales_os_scores"
    __table_args__ = (UniqueConstraint("ein", name="uq_sales_os_ein"),)

    id           = Column(Integer, primary_key=True, index=True)
    ein          = Column(String, nullable=False, unique=True, index=True)
    overall_score = Column(Integer, nullable=False, default=0)
    factor_scores = Column(JSON, nullable=False, default=dict)
    computed_at  = Column(DateTime, server_default=func.now())


class FiduciaryPlan(Base):
    """ERISA Fiduciary IQ™ — plan analysis record."""
    __tablename__ = "fiduciary_plans"

    id           = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_name    = Column(String, nullable=False, default="Employer Health Plan")
    org_name     = Column(String, nullable=True)
    participants = Column(Integer, nullable=True, default=500)
    plan_year    = Column(Integer, nullable=True, default=2024)
    status       = Column(String, default="complete")
    created_at   = Column(DateTime, server_default=func.now())


# ─── Share Links ──────────────────────────────────────────────────────────────

class ShareLink(Base):
    """
    A short branded share link that captures the full view-state of an analysis
    page so a recipient can open `/s/{short_id}` and land on the exact same view.

    Links are unguessable (random short_id) but NOT access-controlled — the target
    pages themselves remain auth-gated. `state_json` is an opaque, page-specific
    serialized view-state object re-applied by the page on load.
    """
    __tablename__ = "share_links"

    id         = Column(Integer, primary_key=True, index=True)
    short_id   = Column(String, nullable=False, unique=True, index=True)
    page       = Column(String, nullable=False)   # war-room | benchmarking | rx-defense | broker-prospects
    state_json = Column(Text, nullable=False, default="{}")
    title      = Column(String, nullable=True)     # human label for the shared view
    created_by = Column(String, nullable=True, index=True)   # user id (optional)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)


# ─── RFP Intelligence OS ──────────────────────────────────────────────────────

class RfpAccount(Base):
    """Employer account — source of truth for prospects and won clients."""
    __tablename__ = "rfp_accounts"

    id           = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name         = Column(String, nullable=False)
    ein          = Column(String, nullable=True, index=True)
    industry     = Column(String, nullable=True)
    state        = Column(String, nullable=True)
    city         = Column(String, nullable=True)
    employees    = Column(Integer, nullable=True)
    annual_premium = Column(Float, nullable=True)
    plan_type    = Column(String, nullable=True)   # self-funded|fully-insured|level-funded
    tpa          = Column(String, nullable=True)
    pbm          = Column(String, nullable=True)
    carrier      = Column(String, nullable=True)
    renewal_date = Column(String, nullable=True)
    website      = Column(String, nullable=True)
    relationship_status = Column(String, nullable=True, default="prospect", index=True)
                         # prospect | client | lost | inactive
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())


class RfpContact(Base):
    """Decision-maker, consultant, or broker tied to an employer account."""
    __tablename__ = "rfp_contacts"

    id         = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    account_id = Column(String, ForeignKey("rfp_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role       = Column(String, nullable=False, default="decision_maker")
                 # decision_maker | consultant | broker | other
    first_name = Column(String, nullable=True)
    last_name  = Column(String, nullable=True)
    title      = Column(String, nullable=True)
    email      = Column(String, nullable=True)
    phone      = Column(String, nullable=True)
    firm       = Column(String, nullable=True)
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class RfpOpportunity(Base):
    """
    A single RFP — the central record of the RFP Intelligence OS.
    Populated by upload (PDF/Word/text) or inbound email webhook.
    AI extracts structured fields; missing ones are flagged in needs_review_fields.
    """
    __tablename__ = "rfp_opportunities"

    id           = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id   = Column(String, ForeignKey("rfp_accounts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Source
    source              = Column(String, nullable=False, default="upload")   # upload | email
    source_filename     = Column(String, nullable=True)
    source_email_from   = Column(String, nullable=True)
    source_email_subject= Column(String, nullable=True)
    raw_text            = Column(Text, nullable=True)

    # AI-extracted fields — null = not found in document
    title                          = Column(String, nullable=True)
    employer_name                  = Column(String, nullable=True)
    industry                       = Column(String, nullable=True)
    employer_size                  = Column(String, nullable=True)   # "500-1,000 employees"
    covered_lives                  = Column(Integer, nullable=True)
    geographic_footprint           = Column(String, nullable=True)
    pbm_structure                  = Column(String, nullable=True)   # carve-in|carve-out|embedded
    benefit_consulting_relationship= Column(String, nullable=True)
    renewal_date                   = Column(String, nullable=True)   # ISO date string
    due_date                       = Column(String, nullable=True)
    estimated_contract_value       = Column(Float, nullable=True)    # USD/yr
    plan_type                      = Column(String, nullable=True)
    states_covered                 = Column(Text, nullable=True)     # JSON array
    key_requirements               = Column(Text, nullable=True)     # JSON array of strings

    # 5500 benchmark linkage — set by user or auto-matched
    ein                 = Column(String, nullable=True, index=True)   # employer EIN for DOL 5500 lookup
    benchmark_snapshot  = Column(Text, nullable=True)                 # JSON: cached benchmark result

    # Parse status
    status              = Column(String, nullable=False, default="pending", index=True)
                          # pending | parsing | complete | error
    parse_confidence    = Column(Float, nullable=True)               # 0–100
    needs_review_fields = Column(Text, nullable=True)                # JSON array of field names
    error_message       = Column(Text, nullable=True)

    # Workflow
    stage       = Column(String, nullable=False, default="new", index=True)
                  # new | qualifying | drafting | submitted | decision | won | lost | no_bid
                  # (legacy: reviewing | scoring | proposal | prospect | qualified | negotiation)
    score       = Column(Float, nullable=True)                       # legacy single score
    notes       = Column(Text, nullable=True)

    # Deadline & assignment (board workflow)
    owner             = Column(String, nullable=True)                # assignee name / email
    response_deadline = Column(String, nullable=True)                # ISO date — when response is due

    # RFP Intelligence OS extra fields
    org_id            = Column(String, nullable=True, index=True)    # multi-tenant org scope
    employer_ein      = Column(String, nullable=True, index=True)
    employer_state    = Column(String, nullable=True)
    employer_city     = Column(String, nullable=True)
    participants      = Column(Integer, nullable=True)
    estimated_value   = Column(Float, nullable=True)                 # estimated annual commission $
    close_date        = Column(String, nullable=True)                # ISO date string
    priority          = Column(String, default="medium")             # low|medium|high
    rx_contract_id    = Column(String, nullable=True)                # RxDefenseContract.id
    ai_talking_points = Column(Text, nullable=True)                  # JSON array
    ai_response_draft = Column(Text, nullable=True)                  # AI-drafted competitive response
    known_competitor  = Column(String, nullable=True)                # manually-tagged likely competitor (pre-decision)

    created_at  = Column(DateTime, server_default=func.now(), index=True)
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Opportunity Scoring Engine
    opportunity_score   = Column(Float, nullable=True)               # 0–100 composite weighted score
    score_tier          = Column(String, nullable=True)              # pursue_aggressively|pursue_selectively|monitor|decline
    score_breakdown     = Column(Text, nullable=True)                # JSON: {factor: score} per factor (0–100)
    score_factors       = Column(Text, nullable=True)                # JSON: {factor: "rationale string"}
    score_confidence    = Column(String, nullable=True)              # CERTIFIED|MODELED|INSUFFICIENT_EVIDENCE
    scored_at           = Column(DateTime, nullable=True)


class RfpWinLoss(Base):
    """
    Outcome record for a closed RFP opportunity — structured loss debrief.
    Feeds the adaptive scoring loop: factor weights are recalibrated as patterns
    emerge across accumulated outcomes.
    """
    __tablename__ = "rfp_win_loss"

    id             = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    opportunity_id = Column(String, ForeignKey("rfp_opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id        = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Outcome — 4 states
    outcome        = Column(String, nullable=False, index=True)   # won | lost | no_decision | deferred
    decision_date  = Column(String, nullable=True)
    contract_value = Column(Float, nullable=True)    # final contract value at close (USD/yr)

    # Structured loss debrief (used for adaptive scoring recalibration)
    winning_competitor  = Column(String, nullable=True)           # competitor who won the bid
    pricing_factor      = Column(Boolean, nullable=True)          # pricing was a loss factor
    relationship_factor = Column(Boolean, nullable=True)          # relationship/incumbent was a loss factor
    product_gaps        = Column(Text, nullable=True)             # JSON array of capability gap strings
    procurement_observations = Column(Text, nullable=True)        # notes on procurement process
    lessons_learned     = Column(Text, nullable=True)             # freeform lessons

    # Legacy single field — kept for backward compat
    loss_reason    = Column(String, nullable=True)
    notes          = Column(Text, nullable=True)

    # Handoff flag: on loss, enroll account in monitoring workflow
    monitoring_enrolled = Column(Boolean, nullable=False, default=False)

    # ── ROI / Outcome Economics ────────────────────────────────────────────────
    # Realized revenue: the actual annual contract revenue (vs estimated_value at scoring time)
    realized_revenue  = Column(Float, nullable=True)        # USD/yr — entered post-close

    # Pursuit cost: effort and direct dollar spend to win or lose this deal
    pursuit_hours     = Column(Float, nullable=True)        # total staff-hours spent
    pursuit_cost_usd  = Column(Float, nullable=True)        # $USD direct cost (hours×rate or manual)
    hourly_rate_usd   = Column(Float, nullable=True)        # $/hr used to compute pursuit_cost

    created_at     = Column(DateTime, server_default=func.now())


class RfpScoringWeights(Base):
    """
    Persisted scoring-factor weights for the adaptive scoring loop.
    One active row per user (latest row wins). Each recalibration appends a new
    row so the full adjustment history is preserved for transparency.
    Weights are applied by compute_opportunity_score() at scoring time.
    """
    __tablename__ = "rfp_scoring_weights"

    id         = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id    = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    weights    = Column(Text, nullable=False)     # JSON: {factor: weight} — must sum to 1.0
    adjustments= Column(Text, nullable=True)      # JSON: {factor: delta} — what changed vs. prior row
    trigger    = Column(String, nullable=True)    # "manual" | "auto_{N}_outcomes"
    outcome_count = Column(Integer, nullable=False, default=0)  # number of outcomes that drove this
    summary    = Column(Text, nullable=True)      # human-readable explanation of what changed
    created_at = Column(DateTime, server_default=func.now(), index=True)


class RfpForecastAccuracy(Base):
    """
    Snapshot of the model's forecast for an opportunity, captured the moment it
    closed (won/lost). Lets the Command Center compute MAPE over recent closes
    and auto-calibrate the win-probability multiplier against realized outcomes.
    One row per opportunity (upserted if a deal is re-closed).
    """
    __tablename__ = "rfp_forecast_accuracy"

    id              = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    opportunity_id  = Column(String, ForeignKey("rfp_opportunities.id", ondelete="CASCADE"),
                             nullable=False, index=True, unique=True)
    user_id         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id          = Column(String, nullable=True, index=True)

    employer_name   = Column(String, nullable=True)
    outcome         = Column(String, nullable=False)   # won | lost
    opportunity_score = Column(Float, nullable=True)

    predicted_win_prob = Column(Float, nullable=False)  # base win prob at multiplier 1.0
    revenue_estimate   = Column(Float, nullable=False)  # revenue basis (at stake) at close time
    predicted_value    = Column(Float, nullable=False)  # EV = predicted_win_prob × revenue_estimate
    actual_value       = Column(Float, nullable=False)  # revenue_estimate if won, else 0

    closed_at       = Column(DateTime, server_default=func.now(), index=True)
    created_at      = Column(DateTime, server_default=func.now())


class RfpBidScenario(Base):
    """
    A user-named, saved set of Bid/Pricing Optimizer overrides for a single
    opportunity. Lets brokers persist a market-specific scenario (e.g.
    "aggressive Q4 renewal") and re-apply or compare it against the model
    baseline across sessions. Scoped per user + opportunity.
    """
    __tablename__ = "rfp_bid_scenarios"

    id             = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    opportunity_id = Column(String, ForeignKey("rfp_opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id        = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name           = Column(String, nullable=False)   # user-given scenario name

    # The override set the curve scales from
    anchor         = Column(Float, nullable=False)     # anchor price (USD/yr)
    p_base         = Column(Float, nullable=False)     # base win probability (percent, 0–100)
    alpha          = Column(Float, nullable=False)     # price elasticity

    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RfpMonitoringSubscription(Base):
    """Employer account being watched for RFP / renewal events."""
    __tablename__ = "rfp_monitoring_subscriptions"

    id            = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id       = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id    = Column(String, ForeignKey("rfp_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    ein           = Column(String, nullable=True, index=True)
    employer_name = Column(String, nullable=False)
    monitor_type  = Column(String, nullable=False, default="renewal")   # renewal | new_rfp | 5500_change
    active        = Column(Boolean, nullable=False, default=True)
    created_at    = Column(DateTime, server_default=func.now())


class RfpMonitoringAlert(Base):
    """An alert fired by a monitoring subscription."""
    __tablename__ = "rfp_monitoring_alerts"

    id              = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    subscription_id = Column(String, ForeignKey("rfp_monitoring_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type      = Column(String, nullable=False)   # renewal_window | new_rfp | form_5500_filed
    summary         = Column(String, nullable=False)
    detail          = Column(Text, nullable=True)
    read            = Column(Boolean, nullable=False, default=False)
    created_at      = Column(DateTime, server_default=func.now(), index=True)


class FilingWatch(Base):
    """
    A standing watch for new Form 5500 filings matching state + filter criteria.
    Powers the Sales OS "Filing Alerts" inbox. Alerts are computed live from the
    DOL EFAST2 DuckDB corpus; `seen_eins` records which filings the broker has
    already acknowledged so re-scans surface only NEW matches.
    """
    __tablename__ = "filing_watches"

    id               = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    owner_key        = Column(String, nullable=False, index=True)   # user.id when authed, else "demo"
    label            = Column(String, nullable=False)
    state            = Column(String, nullable=False, default="TN", index=True)
    min_participants = Column(Integer, nullable=True)
    only_health      = Column(Boolean, nullable=False, default=False)
    only_stop_loss   = Column(Boolean, nullable=False, default=False)
    min_premium      = Column(Float, nullable=True)
    active           = Column(Boolean, nullable=False, default=True)
    seen_eins        = Column(Text, nullable=False, default="[]")   # JSON array of acknowledged EINs
    created_at       = Column(DateTime, server_default=func.now())
    last_checked_at  = Column(DateTime, nullable=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Rebel IQ Intelligence API (v1)
# Machine-to-machine API: Rebel IQ pushes plan config + de-identified claims/member
# data; Kincaid IQ returns structured intelligence. See the API Design Document.
# ═══════════════════════════════════════════════════════════════════════════════

class RebelTenant(Base):
    """
    An external Rebel IQ tenant authorized to call the /v1 intelligence API.
    Two API keys are supported simultaneously for zero-downtime key rotation.
    The signing_secret is the shared HMAC-SHA256 secret used to verify request
    signatures (see §3 of the API Design Document).
    """
    __tablename__ = "rebel_tenants"

    id              = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    name            = Column(String, nullable=False)
    # Two simultaneously-valid keys; either may be active/inactive.
    api_key_primary       = Column(String, nullable=True, unique=True, index=True)
    api_key_primary_active   = Column(Boolean, nullable=False, default=True)
    api_key_secondary     = Column(String, nullable=True, unique=True, index=True)
    api_key_secondary_active = Column(Boolean, nullable=False, default=False)
    signing_secret  = Column(String, nullable=False)
    rate_limit_get  = Column(Integer, nullable=False, default=300)   # GET req/min
    rate_limit_post = Column(Integer, nullable=False, default=60)    # POST req/min
    status          = Column(String, nullable=False, default="active")  # active|suspended
    created_at      = Column(DateTime, server_default=func.now())


class KincaidPlan(Base):
    """A self-funded health plan registered by a Rebel IQ tenant (§8)."""
    __tablename__ = "kincaid_plans"

    kincaid_plan_id = Column(String, primary_key=True, index=True)   # "kiq_<uuid>"
    tenant_id       = Column(String, ForeignKey("rebel_tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    rebel_plan_id   = Column(String, nullable=False, index=True)
    name            = Column(String, nullable=False)
    plan_year       = Column(Integer, nullable=False)
    member_count    = Column(Integer, nullable=False, default=0)
    state           = Column(String, nullable=True)
    industry_code   = Column(String, nullable=True)
    tpa_name        = Column(String, nullable=True)
    pbm_name        = Column(String, nullable=True)
    # Stop-loss config
    stop_loss_carrier            = Column(String, nullable=True)
    specific_deductible          = Column(Float, nullable=True)
    aggregate_attachment_point   = Column(Float, nullable=True)
    aggregate_factor             = Column(Float, nullable=True)
    # Plan feature flags
    plan_features   = Column(JSON, nullable=False, default=dict)
    status          = Column(String, nullable=False, default="registered")  # registered|ingesting|active|stale
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())


class IngestionBatch(Base):
    """A single ingestion batch — idempotency anchor via globally-unique batch_id (§9)."""
    __tablename__ = "kiq_ingestion_batches"

    id                = Column(Integer, primary_key=True, index=True)
    batch_id          = Column(String, nullable=False, unique=True, index=True)  # caller-provided
    plan_id           = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), nullable=False, index=True)
    job_id            = Column(String, nullable=True, index=True)
    type              = Column(String, nullable=False)   # claims|members|rx
    status            = Column(String, nullable=False, default="queued")  # queued|processing|processed|failed|partial
    records_received  = Column(Integer, nullable=False, default=0)
    records_processed = Column(Integer, nullable=False, default=0)
    records_rejected  = Column(Integer, nullable=False, default=0)
    rejection_reasons = Column(JSON, nullable=False, default=list)
    period_start      = Column(String, nullable=True)
    period_end        = Column(String, nullable=True)
    snapshot_date     = Column(String, nullable=True)
    submitted_at      = Column(DateTime, server_default=func.now())
    processed_at      = Column(DateTime, nullable=True)


class IngestedClaim(Base):
    """A raw medical claim record ingested from a TPA feed (§9). Hashed member IDs only."""
    __tablename__ = "kiq_ingested_claims"
    __table_args__ = (Index("ix_kiq_claims_plan_member", "plan_id", "member_id"),)

    id               = Column(Integer, primary_key=True, index=True)
    plan_id          = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id         = Column(String, nullable=False, index=True)
    claim_id         = Column(String, nullable=False, index=True)
    member_id        = Column(String, nullable=False, index=True)   # hashed
    provider_id      = Column(String, nullable=True)
    provider_type    = Column(String, nullable=True)
    service_date     = Column(String, nullable=True)
    paid_date        = Column(String, nullable=True)
    diagnosis_codes  = Column(JSON, nullable=False, default=list)
    procedure_codes  = Column(JSON, nullable=False, default=list)
    billed_amount    = Column(Float, nullable=False, default=0.0)
    allowed_amount   = Column(Float, nullable=False, default=0.0)
    paid_amount      = Column(Float, nullable=False, default=0.0)
    plan_paid_amount = Column(Float, nullable=False, default=0.0)
    member_cost_share = Column(Float, nullable=False, default=0.0)
    claim_type       = Column(String, nullable=True)
    place_of_service = Column(String, nullable=True)
    is_high_cost     = Column(Boolean, nullable=False, default=False)
    valid            = Column(Boolean, nullable=False, default=True)
    rejection_reason = Column(String, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())


class IngestedMember(Base):
    """A roster/eligibility record ingested from a TPA file (§9). De-identified."""
    __tablename__ = "kiq_ingested_members"
    __table_args__ = (Index("ix_kiq_members_plan_member", "plan_id", "member_id"),)

    id                = Column(Integer, primary_key=True, index=True)
    plan_id           = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id          = Column(String, nullable=False, index=True)
    member_id         = Column(String, nullable=False, index=True)   # hashed
    relationship_type = Column(String, nullable=True)
    age_range         = Column(String, nullable=True)
    gender            = Column(String, nullable=True)
    region            = Column(String, nullable=True)
    coverage_tier     = Column(String, nullable=True)
    is_active         = Column(Boolean, nullable=False, default=True)
    valid             = Column(Boolean, nullable=False, default=True)
    rejection_reason  = Column(String, nullable=True)
    created_at        = Column(DateTime, server_default=func.now())


class IngestedRxClaim(Base):
    """A raw pharmacy (PBM) claim record (§9). Hashed member IDs only."""
    __tablename__ = "kiq_ingested_rx"
    __table_args__ = (Index("ix_kiq_rx_plan_member", "plan_id", "member_id"),)

    id               = Column(Integer, primary_key=True, index=True)
    plan_id          = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id         = Column(String, nullable=False, index=True)
    claim_id         = Column(String, nullable=False, index=True)
    member_id        = Column(String, nullable=False, index=True)   # hashed
    dispensed_date   = Column(String, nullable=True)
    ndc              = Column(String, nullable=True)
    drug_name        = Column(String, nullable=True)
    drug_category    = Column(String, nullable=True)
    is_specialty     = Column(Boolean, nullable=False, default=False)
    is_brand         = Column(Boolean, nullable=False, default=False)
    days_supply      = Column(Integer, nullable=True)
    billed_amount    = Column(Float, nullable=False, default=0.0)
    plan_paid_amount = Column(Float, nullable=False, default=0.0)
    member_cost_share = Column(Float, nullable=False, default=0.0)
    valid            = Column(Boolean, nullable=False, default=True)
    rejection_reason = Column(String, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())


class KiqJob(Base):
    """An async processing job (§11). Poll via GET /v1/jobs/:jobId."""
    __tablename__ = "kiq_jobs"

    job_id            = Column(String, primary_key=True, index=True)   # "kiq-job-<uuid>"
    plan_id           = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id          = Column(String, nullable=True, index=True)
    type              = Column(String, nullable=False)   # claims-ingestion|members-ingestion|rx-ingestion
    status            = Column(String, nullable=False, default="queued")  # queued|processing|complete|failed|cancelled
    records_total     = Column(Integer, nullable=False, default=0)
    records_processed = Column(Integer, nullable=False, default=0)
    records_rejected  = Column(Integer, nullable=False, default=0)
    rejection_reasons = Column(JSON, nullable=False, default=list)
    error             = Column(JSON, nullable=True)
    submitted_at      = Column(DateTime, server_default=func.now())
    started_at        = Column(DateTime, nullable=True)
    completed_at      = Column(DateTime, nullable=True)


class KiqAlert(Base):
    """A generated intelligence alert for a plan, across any domain (§10.1)."""
    __tablename__ = "kiq_alerts"

    alert_id        = Column(String, primary_key=True, index=True)
    plan_id         = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), nullable=False, index=True)
    domain          = Column(String, nullable=False, index=True)   # cost|compliance|fwa|memberRisk|stopLoss
    severity        = Column(String, nullable=False, index=True)   # critical|high|medium|low
    title           = Column(String, nullable=False)
    description     = Column(Text, nullable=True)
    action_required = Column(Text, nullable=True)
    member_id       = Column(String, nullable=True)
    due_date        = Column(String, nullable=True)
    estimated_impact = Column(String, nullable=True)
    status          = Column(String, nullable=False, default="open")  # open|reviewed|dismissed|escalated
    created_at      = Column(DateTime, server_default=func.now())


class KiqAnalyticsCache(Base):
    """
    The computed intelligence cache for a plan — one row per plan. The async job
    processor recomputes and stores the full domain intelligence payload here;
    the synchronous /v1 intelligence GET endpoints read straight from it.
    """
    __tablename__ = "kiq_analytics_cache"

    plan_id     = Column(String, ForeignKey("kincaid_plans.kincaid_plan_id", ondelete="CASCADE"), primary_key=True, index=True)
    data        = Column(JSON, nullable=False, default=dict)
    data_as_of  = Column(DateTime, server_default=func.now())
    computed_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RfpWatchlistEntry(Base):
    """An employer EIN being watched for new Form 5500 filings."""
    __tablename__ = "rfp_watchlist"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id          = Column(String, nullable=True, index=True)
    ein             = Column(String, nullable=False, index=True)
    employer_name   = Column(String, nullable=False)
    employer_state  = Column(String, nullable=True)
    industry        = Column(String, nullable=True)
    # Filing tracker
    last_seen_year  = Column(Integer, nullable=True)         # most recent form_year we notified on
    last_checked_at = Column(DateTime, nullable=True)
    notes           = Column(Text, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    __table_args__ = (UniqueConstraint("user_id", "ein", name="uq_rfp_watchlist_user_ein"),)


class RfpAlert(Base):
    """Log of new-filing alerts sent (or queued) for watched EINs."""
    __tablename__ = "rfp_alerts"

    id              = Column(Integer, primary_key=True, index=True)
    watch_id        = Column(Integer, ForeignKey("rfp_watchlist.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id         = Column(String, nullable=False, index=True)
    ein             = Column(String, nullable=False, index=True)
    employer_name   = Column(String, nullable=False)
    filing_year     = Column(Integer, nullable=False)
    alert_type      = Column(String, default="new_filing")   # new_filing
    status          = Column(String, default="queued")       # queued|sent|failed
    highlights      = Column(Text, nullable=True)            # JSON highlights
    created_at      = Column(DateTime, server_default=func.now())


class RfpDigestPreference(Base):
    """
    Per-user preferences for the RFP Intelligence Digest email.
    One row per user (uniqueness enforced at app layer via upsert).
    """
    __tablename__ = "rfp_digest_preferences"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, unique=True)
    enabled              = Column(Boolean, nullable=False, default=True)
    frequency            = Column(String, nullable=False, default="weekly")   # "daily" | "weekly"
    day_of_week          = Column(Integer, nullable=True, default=1)          # 0=Mon..6=Sun (weekly only)
    hour_utc             = Column(Integer, nullable=False, default=8)         # 0..23
    recipients           = Column(Text, nullable=True, default="[]")          # JSON list of extra CC emails
    sections_new_rfps    = Column(Boolean, nullable=False, default=True)
    sections_alerts_5500 = Column(Boolean, nullable=False, default=True)
    sections_top_opps    = Column(Boolean, nullable=False, default=True)
    sections_deadlines   = Column(Boolean, nullable=False, default=True)
    last_sent_at         = Column(DateTime, nullable=True)
    next_run_at          = Column(DateTime, nullable=True, index=True)
    last_attempt_at      = Column(DateTime, nullable=True)        # set on every send attempt
    last_error           = Column(Text,     nullable=True)        # SMTP error message if last attempt failed
    updated_at           = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_at           = Column(DateTime, server_default=func.now())


class ProposalLibraryItem(Base):
    """
    Reusable proposal section stored in the broker's content library.
    Feeds the Proposal Co-pilot draft generator — retrieved by section type and tags
    to ground each AI-generated section in real past wins, not generic boilerplate.
    """
    __tablename__ = "proposal_library_items"

    id           = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id      = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title        = Column(String, nullable=False)                   # e.g. "Executive Introduction"
    section_type = Column(String, nullable=False, index=True)       # intro|value_prop|capability|case_study|differentiator|closing|methodology|pricing|team|custom
    content      = Column(Text, nullable=False)
    tags         = Column(Text, nullable=False, default="[]")       # JSON array of strings
    source_filename  = Column(String, nullable=True)                # source document name
    win_context      = Column(String, nullable=True)                # brief note on the winning deal this came from
    times_used       = Column(Integer, nullable=False, default=0)
    is_winning       = Column(Boolean, nullable=False, default=False)  # marked from a won proposal
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ProposalDraft(Base):
    """
    A versioned AI-drafted proposal response for a single RFP opportunity.
    Each regeneration creates a new version row so brokers can compare revisions.
    sections is a JSON array of {section_type, title, content, library_source_ids, citations}.
    """
    __tablename__ = "proposal_drafts"

    id             = Column(String, primary_key=True, server_default=func.gen_random_uuid(), index=True)
    user_id        = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("rfp_opportunities.id", ondelete="CASCADE"), nullable=False, index=True)

    version        = Column(Integer, nullable=False, default=1)
    title          = Column(String, nullable=False, default="Draft v1")
    sections       = Column(Text, nullable=False, default="[]")     # JSON array of section objects
    status         = Column(String, nullable=False, default="draft") # draft|editing|final
    model_used     = Column(String, nullable=True)                   # AI model tag
    library_ids_used = Column(Text, nullable=True, default="[]")    # JSON array of ProposalLibraryItem IDs cited
    requirements_addressed = Column(Text, nullable=True, default="[]") # JSON array
    overall_notes  = Column(Text, nullable=True)                     # broker freeform notes on this version
    created_at     = Column(DateTime, server_default=func.now(), index=True)
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RfpScoringOverride(Base):
    """
    Persisted admin override for the RFP opportunity-scoring config.

    A singleton row (key='active') holding the full edited scoring config as
    JSON. When present at startup it is deep-merged onto RFP_SCORING_DEFAULTS
    (plus any env override) so non-engineers can retune weights, tier
    thresholds, factor band cutoffs, and the national-incumbent firm list live
    from the Administration Panel — no redeploy, no env-var change. Deleting the
    row reverts the scorer to RFP_SCORING_DEFAULTS.
    """
    __tablename__ = "rfp_scoring_overrides"

    key        = Column(String, primary_key=True, default="active")
    config     = Column(JSON, nullable=False, default=dict)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SalesPipeline(Base):
    """
    Sales OS Kanban pipeline — one row per employer account tracked by a broker/analyst.
    Stages: target → research → outreach → discovery → proposal → negotiation → closed_won → closed_lost
    org_id scopes records to a user/organization for multi-tenant isolation.
    """
    __tablename__ = "sales_pipeline"

    id                  = Column(Integer, primary_key=True, index=True)
    org_id              = Column(String, nullable=True, index=True)
    employer_ein        = Column(String, nullable=False, index=True)
    employer_name       = Column(String, nullable=False)
    state               = Column(String, nullable=True)
    city                = Column(String, nullable=True)
    industry            = Column(String, nullable=True)
    participants        = Column(Integer, nullable=True)
    welfare_premiums    = Column(Float, nullable=True)
    broker_commissions  = Column(Float, nullable=True)
    opportunity_score   = Column(Integer, nullable=True)
    opportunity_tier    = Column(String, nullable=True)
    stage               = Column(String, nullable=False, default="target")
    notes               = Column(Text, nullable=True)
    added_by            = Column(String, nullable=True)
    created_at          = Column(DateTime, server_default=func.now())
    updated_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ─── Kincaid IQ Verify (ported BFF: ledger + keyed metrics) ────────────────────

class KiqMetric(Base):
    """Keyed metric carrying one of exactly three confidence tiers."""
    __tablename__ = "kiq_metrics"
    __table_args__ = (
        CheckConstraint(
            "confidence IN ('CERTIFIED','MODELED','INSUFFICIENT_EVIDENCE')",
            name="ck_kiq_metric_confidence",
        ),
        Index("ix_kiq_metric_org_key", "org_id", "key"),
    )

    id         = Column(String, primary_key=True)
    org_id     = Column(String, nullable=False, index=True)
    key        = Column(String, nullable=False)
    label      = Column(String, nullable=False)
    value      = Column(Float, nullable=False)
    unit       = Column(String, nullable=False)
    confidence = Column(String, nullable=False)
    period     = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class KiqLedgerEntry(Base):
    """Append only, SHA-256 hash chained evidence ledger. seq is the monotonic
    chain order; hash links to prev_hash back to the genesis value."""
    __tablename__ = "kiq_ledger"

    seq        = Column(Integer, primary_key=True, autoincrement=True)
    entry_id   = Column(String, nullable=False, unique=True, index=True)
    ts         = Column(String, nullable=False)
    actor      = Column(String, nullable=False)
    action     = Column(String, nullable=False)
    subject    = Column(String, nullable=True)
    payload    = Column(Text, nullable=False)
    prev_hash  = Column(String, nullable=False)
    hash       = Column(String, nullable=False)
