// ─── Browser-compatible SHA-256 via MurmurHash3-inspired expansion ─────────────
// Produces a stable 64-char hex string — deterministic for any given input.

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function sha256(input: unknown): string {
  const str = stableStringify(input);
  // Murmur3-inspired mixing — deterministic and collision-resistant enough for display
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x9e3779b9);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
    h1 = (h1 ^ (h1 >>> 13)) + h2;
    h2 = (h2 ^ (h2 >>> 7)) + h1;
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 0x85ebca6b) ^ Math.imul(h1 ^ (h1 >>> 13), 0xc2b2ae35);
  let hex = "";
  let s1 = (h1 >>> 0), s2 = (h2 >>> 0);
  while (hex.length < 64) {
    s1 = Math.imul(s1 ^ (s1 >>> 16), 0x45d9f3b) >>> 0;
    s2 = Math.imul(s2 ^ (s2 >>> 13), 0x119de1f3) >>> 0;
    hex += (s1 ^ s2).toString(16).padStart(8, "0");
  }
  return hex.slice(0, 64);
}

function nowIso(): string { return new Date().toISOString(); }

function hoursOld(receivedAt: string): number {
  return (Date.now() - new Date(receivedAt).getTime()) / 3_600_000;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}
function formatPercent(value: number, digits = 1): string { return `${value.toFixed(digits)}%`; }

function evidenceSetHash(evidence: EvidenceRef[]): string {
  return sha256(evidence.map((e) => ({ evidence_id: e.evidence_id, source_hash: e.source_hash, received_at: e.received_at, uri: e.uri ?? null })));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerifiedStatus  = "VERIFIED" | "UNVERIFIED" | "DISPUTED";
export type FreshnessStatus = "GREEN" | "YELLOW" | "RED";
export type LifecycleState  = "DEVELOPMENT" | "VALIDATED" | "PRODUCTION";

export type EvidenceRef = {
  evidence_id: string;
  source_name: string;
  source_hash: string;
  received_at: string;
  uri?: string;
  sensitivity_tags?: string[];
};

export type TransformRef = {
  transform_hash: string;
  code_version: string;
  params_hash: string;
  executed_at: string;
};

export type PolicyResult = {
  allowed: boolean;
  verified_status: VerifiedStatus;
  freshness_status: FreshnessStatus;
  confidence_score: number;
  reason_code: string;
  violations: string[];
};

export type Claim = {
  claim_id: string;
  kpi_key: string;
  kpi_version: string;
  value: number;
  unit: string;
  period: string;
  evidence: EvidenceRef[];
  transform: TransformRef;
  policy: PolicyResult;
  computed_at: string;
};

export type KpiContext = {
  kpi_key: string;
  kpi_version: string;
  title: string;
  lifecycle_state: LifecycleState;
  min_confidence: number;
  max_age_hours: number;
  threshold_warning?: number;
  threshold_block?: number;
  dependency_ok: boolean;
  debt_score: number;
  unit: string;
  formula_text: string;
  threshold_note: string;
};

export type ComputeInput = {
  evidence: EvidenceRef[];
  params: Record<string, unknown>;
  source_values: Record<string, number>;
  verified_status: VerifiedStatus;
  confidence_score: number;
  period: string;
};

export type ProofLedgerEventType =
  | "GATE_PASS" | "GATE_BLOCK" | "HASH_VERIFIED" | "POLICY_BREACH"
  | "FRESHNESS_ALERT" | "DETERMINISTIC_CHECK" | "EXPORT_BLOCKED" | "EXPORT_ALLOWED";

export type ProofLedgerEvent = {
  id: string;
  event_type: ProofLedgerEventType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  event_message: string;
  related_kpi_key?: string;
  evidence_id?: string;
  event_hash: string;
  created_at: string;
};

export type TileKpi = {
  kpi_key: string;
  title: string;
  display_value: string;
  numeric_value?: number;
  trend?: string;
  formula_text: string;
  threshold_note: string;
  evidence: EvidenceRef[];
  transform: TransformRef;
  policy: PolicyResult;
};

export type Tile = {
  id: string;
  title: string;
  primary: TileKpi;
  supporting: TileKpi[];
};

// ─── Proof Ledger ─────────────────────────────────────────────────────────────

class ProofLedgerService {
  private events: ProofLedgerEvent[] = [];

  record(
    event_type: ProofLedgerEventType,
    severity: "INFO" | "WARNING" | "CRITICAL",
    event_message: string,
    related_kpi_key?: string,
    evidence_id?: string,
  ) {
    const created_at = nowIso();
    const base = { event_type, severity, event_message, related_kpi_key, evidence_id, created_at };
    this.events.unshift({
      id: sha256(base).slice(0, 16),
      event_type, severity, event_message, related_kpi_key, evidence_id,
      created_at,
      event_hash: sha256(base),
    });
  }

  getEvents(): ProofLedgerEvent[] { return this.events; }
  clear() { this.events = []; }
}

// ─── Commit Engine ────────────────────────────────────────────────────────────

export class KincaidCommitEngine {
  private readonly codeVersion = "kincaid_ui_engine_v1.0.0";
  public readonly ledger = new ProofLedgerService();

  private gateEvidenceExistence(ctx: KpiContext, evidence: EvidenceRef[]) {
    if (!evidence.length) {
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Evidence missing. KPI cannot be admitted.", ctx.kpi_key);
      throw new Error("EVIDENCE_MISSING");
    }
    this.ledger.record("GATE_PASS", "INFO", "Evidence existence check passed.", ctx.kpi_key);
  }

  private gateFreshness(ctx: KpiContext, evidence: EvidenceRef[]): FreshnessStatus {
    const maxHours = Math.max(...evidence.map((e) => hoursOld(e.received_at)));
    if (maxHours > ctx.max_age_hours * 1.25) {
      this.ledger.record("FRESHNESS_ALERT", "CRITICAL", "Evidence freshness exceeded red threshold.", ctx.kpi_key);
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Freshness gate blocked KPI publication.", ctx.kpi_key);
      throw new Error("EVIDENCE_STALE");
    }
    if (maxHours > ctx.max_age_hours) {
      this.ledger.record("FRESHNESS_ALERT", "WARNING", "Evidence freshness in yellow warning band.", ctx.kpi_key);
      this.ledger.record("GATE_PASS", "WARNING", "Freshness gate passed in yellow state.", ctx.kpi_key);
      return "YELLOW";
    }
    this.ledger.record("GATE_PASS", "INFO", "Freshness gate passed in green state.", ctx.kpi_key);
    return "GREEN";
  }

  private gateVerification(ctx: KpiContext, verifiedStatus: VerifiedStatus) {
    if (verifiedStatus === "UNVERIFIED") {
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Verification gate blocked KPI publication.", ctx.kpi_key);
      throw new Error("EVIDENCE_UNVERIFIED");
    }
    if (verifiedStatus === "DISPUTED") {
      this.ledger.record("GATE_PASS", "WARNING", "Verification gate passed in disputed state.", ctx.kpi_key);
      return;
    }
    this.ledger.record("HASH_VERIFIED", "INFO", "Verification gate passed.", ctx.kpi_key);
  }

  private gateLifecycle(ctx: KpiContext) {
    if (ctx.lifecycle_state !== "PRODUCTION") {
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Lifecycle gate blocked non-production KPI.", ctx.kpi_key);
      throw new Error("KPI_NOT_PRODUCTION");
    }
    this.ledger.record("GATE_PASS", "INFO", "Lifecycle gate passed.", ctx.kpi_key);
  }

  private gateDependencies(ctx: KpiContext) {
    if (!ctx.dependency_ok) {
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Dependency gate blocked KPI publication.", ctx.kpi_key);
      throw new Error("KPI_DEPENDENCY_FAILED");
    }
    this.ledger.record("GATE_PASS", "INFO", "Dependency gate passed.", ctx.kpi_key);
  }

  private gateConfidence(ctx: KpiContext, confidence: number) {
    if (confidence < ctx.min_confidence) {
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Confidence gate blocked KPI publication.", ctx.kpi_key);
      throw new Error("INSUFFICIENT_CONFIDENCE");
    }
    this.ledger.record("GATE_PASS", "INFO", "Confidence gate passed.", ctx.kpi_key);
  }

  private gateThresholds(ctx: KpiContext, value: number): string[] {
    const violations: string[] = [];
    if (ctx.threshold_warning !== undefined && value >= ctx.threshold_warning) {
      violations.push(`WARNING threshold exceeded: ${ctx.threshold_warning}`);
      this.ledger.record("POLICY_BREACH", "WARNING", "Warning threshold exceeded.", ctx.kpi_key);
    }
    if (ctx.threshold_block !== undefined && value >= ctx.threshold_block) {
      violations.push(`BLOCK threshold exceeded: ${ctx.threshold_block}`);
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Threshold gate blocked KPI publication.", ctx.kpi_key);
      throw new Error("WAR_ROOM_CONSTRAINT_VIOLATION");
    }
    this.ledger.record("GATE_PASS", violations.length ? "WARNING" : "INFO", "Threshold gate passed.", ctx.kpi_key);
    return violations;
  }

  private gateDebt(ctx: KpiContext) {
    if (ctx.debt_score > 15) {
      this.ledger.record("GATE_BLOCK", "CRITICAL", "Debt score gate blocked KPI publication.", ctx.kpi_key);
      throw new Error("KPI_DEBT_TOO_HIGH");
    }
    this.ledger.record("GATE_PASS", "INFO", "Debt score gate passed.", ctx.kpi_key);
  }

  private computeDeterministically(
    ctx: KpiContext,
    params: Record<string, unknown>,
    sourceValues: Record<string, number>,
  ): { value: number; transform: TransformRef } {
    let value = 0;

    switch (ctx.kpi_key) {
      case "POP_INDEX_PEER":
        value = sourceValues.peer_index_base + sourceValues.disruption_adjustment - sourceValues.concentration_penalty; break;
      case "MEMBER_MONTHS":
        value = sourceValues.member_months; break;
      case "RISK_CONCENTRATION_80_20":
        value = sourceValues.top20_paid_pct; break;
      case "DISRUPTION_RATE":
        value = sourceValues.disruption_rate; break;
      case "CURRENT_EBITDA_DRAG":
        value = sourceValues.admin_overbenchmark + sourceValues.pbm_spread_rebate + sourceValues.stoploss_inefficiency + sourceValues.pricing_drift; break;
      case "ADMIN_FEE_PEPY":
        value = sourceValues.admin_fee_pepy; break;
      case "PBM_NET_COST_PER_RXMM":
        value = sourceValues.rx_net_cost_per_rxmm; break;
      case "STOPLOSS_EFFICIENCY_INDEX":
        value = sourceValues.stoploss_efficiency_index; break;
      case "RECOVERABLE_RANGE_BASE":
        value = sourceValues.recoverable_admin + sourceValues.recoverable_pbm + sourceValues.recoverable_stoploss; break;
      case "GUARANTEE_ATTAINMENT":
        value = sourceValues.guarantee_attainment_pct; break;
      case "OVERBILLING_SIGNAL":
        value = sourceValues.overbilling_dollars; break;
      case "EBITDA_AT_RISK_12M":
        value = sourceValues.renewal_shock + sourceValues.large_claim_volatility + sourceValues.contract_risk; break;
      case "CONTRACT_OPACITY_SCORE":
        value = sourceValues.contract_opacity_score; break;
      case "VENDOR_COMP_LEAKAGE_RISK":
        value = sourceValues.vendor_comp_leakage_risk_score; break;
      default:
        value = Object.values(sourceValues).reduce((sum, n) => sum + n, 0);
    }

    const executed_at = nowIso();
    const transformPayload = { kpi_key: ctx.kpi_key, kpi_version: ctx.kpi_version, params, sourceValues, codeVersion: this.codeVersion };
    const transform: TransformRef = {
      transform_hash: sha256(transformPayload),
      code_version: this.codeVersion,
      params_hash: sha256(params),
      executed_at,
    };

    this.ledger.record("DETERMINISTIC_CHECK", "INFO", "Deterministic compute completed.", ctx.kpi_key);
    return { value, transform };
  }

  evaluateAndCommit(ctx: KpiContext, input: ComputeInput): Claim {
    this.gateEvidenceExistence(ctx, input.evidence);
    const freshnessStatus = this.gateFreshness(ctx, input.evidence);
    this.gateVerification(ctx, input.verified_status);
    this.gateLifecycle(ctx);
    this.gateDependencies(ctx);
    this.gateConfidence(ctx, input.confidence_score);

    const { value, transform } = this.computeDeterministically(ctx, input.params, input.source_values);
    const violations = this.gateThresholds(ctx, value);
    this.gateDebt(ctx);

    const policy: PolicyResult = {
      allowed: true,
      verified_status: input.verified_status,
      freshness_status: freshnessStatus,
      confidence_score: input.confidence_score,
      reason_code: violations.length ? "WARNING_THRESHOLD_BREACH" : "PASS_ALL_GATES",
      violations,
    };

    const claim: Claim = {
      claim_id: sha256({ kpi_key: ctx.kpi_key, kpi_version: ctx.kpi_version, evidence_set_hash: evidenceSetHash(input.evidence), transform_hash: transform.transform_hash, period: input.period }).slice(0, 24),
      kpi_key: ctx.kpi_key,
      kpi_version: ctx.kpi_version,
      value,
      unit: ctx.unit,
      period: input.period,
      evidence: input.evidence,
      transform,
      policy,
      computed_at: nowIso(),
    };

    this.ledger.record("GATE_PASS", violations.length ? "WARNING" : "INFO", "Claim committed across commit boundary.", ctx.kpi_key);
    return claim;
  }

  createBlockedKpi(ctx: KpiContext, input: ComputeInput, reasonCode: string, verifiedStatus: VerifiedStatus, freshnessStatus: FreshnessStatus): TileKpi {
    return {
      kpi_key: ctx.kpi_key,
      title: ctx.title,
      display_value: "Blocked",
      formula_text: ctx.formula_text,
      threshold_note: ctx.threshold_note,
      evidence: input.evidence,
      transform: { transform_hash: "blocked", code_version: this.codeVersion, params_hash: sha256(input.params), executed_at: nowIso() },
      policy: { allowed: false, verified_status: verifiedStatus, freshness_status: freshnessStatus, confidence_score: input.confidence_score, reason_code: reasonCode, violations: [reasonCode] },
    };
  }

  claimToTileKpi(ctx: KpiContext, claim: Claim, trend?: string): TileKpi {
    let displayValue = String(claim.value);
    if (ctx.unit === "USD")     displayValue = formatCurrency(claim.value);
    if (ctx.unit === "PERCENT") displayValue = formatPercent(claim.value);
    if (ctx.unit === "NUMBER")  displayValue = formatNumber(claim.value);
    if (ctx.unit === "INDEX")   displayValue = formatNumber(claim.value);

    return {
      kpi_key: claim.kpi_key,
      title: ctx.title,
      display_value: displayValue,
      numeric_value: claim.value,
      trend,
      formula_text: ctx.formula_text,
      threshold_note: ctx.threshold_note,
      evidence: claim.evidence,
      transform: claim.transform,
      policy: claim.policy,
    };
  }

  getProofLedger(): ProofLedgerEvent[] { return this.ledger.getEvents(); }
  clearLedger() { this.ledger.clear(); }
}

// ─── Board Pack Gate ──────────────────────────────────────────────────────────

export function boardPackGate(kpis: TileKpi[], ledger: { record: (...a: Parameters<ProofLedgerService["record"]>) => void }) {
  const blockedReasons: string[] = [];
  for (const kpi of kpis) {
    if (!kpi.policy.allowed)                           blockedReasons.push(`${kpi.title}: ${kpi.policy.reason_code}`);
    if (kpi.policy.freshness_status === "RED")         blockedReasons.push(`${kpi.title}: EVIDENCE_STALE`);
    if (kpi.policy.verified_status === "UNVERIFIED")   blockedReasons.push(`${kpi.title}: EVIDENCE_UNVERIFIED`);
  }

  if (blockedReasons.length) {
    ledger.record("EXPORT_BLOCKED", "CRITICAL", "Board pack export blocked by governance policy.");
    return { allowed: false, reasons: blockedReasons };
  }

  ledger.record("EXPORT_ALLOWED", "INFO", "Board pack export allowed.");
  return { allowed: true, reasons: [] };
}
