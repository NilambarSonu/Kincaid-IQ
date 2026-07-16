/**
 * Kincaid Health — Sample Documents
 * One-click demo inputs for each analysis mode.
 * Used by UploadDashboard and KiqEngine Screen 1.
 */

export interface KiqSample {
  mode:    "contract-xray" | "prior-auth" | "pe-diligence";
  label:   string;
  tag:     string;
  content: string;
}

// ── Contract X-Ray™ — PBM GLP-1 Contract ─────────────────────────────────────
const PBM_CONTRACT_SAMPLE = JSON.stringify(
  {
    contract_id: "PBM-GLP1-2026-A1",
    employer: "Midwest Health Systems",
    plan_type: "self_funded",
    rebate_structure: {
      glp1_drugs: {
        rebate_rate: "18%",
        guaranteed_rebate: false,
        rebate_delay_days: 120,
        exclusions: ["weight_loss_indication_variability"],
      },
    },
    formulary_rules: {
      GLP1: {
        coverage_status: "conditional",
        step_therapy_required: true,
        prior_auth_required: true,
      },
    },
    pricing_logic: {
      list_price_index: 1.0,
      spread_allowed: true,
      dispensing_fee: 4.75,
    },
    audit_limitations: {
      claims_visibility: "aggregated_only",
      rebate_transparency: "partial",
      audit_rights: "restricted_to_24_months",
    },
  },
  null,
  2
);

// ── PA Intelligence™ — GLP-1 Denial Log ──────────────────────────────────────
const PA_DENIAL_SAMPLE = JSON.stringify(
  {
    payer: "NationalCare PBM",
    drug_class: "GLP-1",
    denials: [
      {
        claim_id: "PA-10021",
        reason: "step_therapy_not_completed",
        clinical_notes: "No documented metformin trial",
        outcome: "denied",
        appeal_status: "successful",
        appeal_time_days: 14,
      },
      {
        claim_id: "PA-10022",
        reason: "not_medically_necessary",
        clinical_notes: "BMI threshold not met per policy",
        outcome: "denied",
        appeal_status: "pending",
        appeal_time_days: null,
      },
      {
        claim_id: "PA-10023",
        reason: "formulary_exclusion",
        clinical_notes: "Drug excluded under plan tier 3 restrictions",
        outcome: "denied",
        appeal_status: "failed",
        appeal_time_days: 21,
      },
    ],
  },
  null,
  2
);

// ── PE Fiduciary Scan™ — Multi-Employer PBM System (10X Scale) ────────────────
const PE_DILIGENCE_SAMPLE = JSON.stringify(
  {
    employers: [
      {
        name: "Midwest Health Systems",
        lives: 50000,
        pbm: "NationalCare PBM",
        denial_rate: 0.27,
        appeal_success_rate: 0.62,
        monthly_rx_spend: 3738000,
        glp1_monthly_scripts: 4200,
      },
      {
        name: "Great Lakes Manufacturing",
        lives: 32000,
        pbm: "PrimeHealth Solutions",
        denial_rate: 0.19,
        appeal_success_rate: 0.54,
        monthly_rx_spend: 2116800,
        glp1_monthly_scripts: 2688,
      },
    ],
    drugs: {
      GLP1: {
        utilization_growth: "18-24%",
        avg_cost_per_member: 890,
        combined_annual_exposure: 69655200,
      },
      Specialty_Oncology: {
        utilization_growth: "12%",
        avg_cost_per_member: 2100,
        combined_annual_exposure: 214200000,
      },
    },
    pbms: [
      {
        name: "NationalCare PBM",
        denial_rate: 0.27,
        primary_driver: "step_therapy",
        appeal_success_rate: 0.62,
        audit_rights: "restricted_24_months",
        rebate_transparency: "partial",
      },
      {
        name: "PrimeHealth Solutions",
        denial_rate: 0.21,
        primary_driver: "formulary_exclusion",
        appeal_success_rate: 0.54,
        audit_rights: "aggregated_only",
        rebate_transparency: "opaque",
      },
    ],
    portfolio_summary: {
      total_lives: 82000,
      total_monthly_rx_spend: 5854800,
      total_annual_rx_exposure: 70257600,
      pbm_count: 2,
      combined_denial_rate: 0.24,
      high_risk_drug_classes: ["GLP-1", "Specialty_Oncology"],
    },
  },
  null,
  2
);

export const KIQ_SAMPLES: KiqSample[] = [
  {
    mode:    "contract-xray",
    label:   "PBM GLP-1 Contract",
    tag:     "PBM-GLP1-2026-A1",
    content: PBM_CONTRACT_SAMPLE,
  },
  {
    mode:    "prior-auth",
    label:   "GLP-1 PA Denial Log",
    tag:     "PA-NationalCare-GLP1",
    content: PA_DENIAL_SAMPLE,
  },
  {
    mode:    "pe-diligence",
    label:   "Multi-Employer PBM Portfolio (10X)",
    tag:     "PE-MULTI-82K-2026",
    content: PE_DILIGENCE_SAMPLE,
  },
];

export const SAMPLE_BY_MODE: Record<string, KiqSample | undefined> = Object.fromEntries(
  KIQ_SAMPLES.map(s => [s.mode, s])
);
