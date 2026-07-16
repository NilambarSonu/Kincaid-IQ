import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect, useRef, useMemo } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useExportProfile } from "@/hooks/use-export-profile";
import { AIHistoryPanel } from "@/components/AIHistoryPanel";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import { ClientPackageDrawer } from "@/components/ClientPackageDrawer";
import { FPSGauge } from "@/components/FPSGauge";
import { LiveRiskMeter } from "@/components/LiveRiskMeter";
import RecursiveNarrativeDrill from "@/components/warroom/RecursiveNarrativeDrill";
import ContractLeakagePanel from "@/components/warroom/ContractLeakagePanel";
import { apiRequest } from "@/lib/queryClient";
import { useCompanyHandoff } from "@/hooks/use-company-handoff";
import { useReducedMotion, enterMotion } from "@/hooks/use-reduced-motion";
import { ShareMenu } from "@/components/ShareMenu";
import { ENFORCEMENT_GATES, gateMeta, type Gate } from "@/components/Doctrine";
import {
  DollarSign, Shield, AlertTriangle, TrendingDown, TrendingUp,
  Zap, FileText, CheckCircle2, XCircle, Clock, ArrowRight,
  Activity, Target, Lock, Eye, ChevronRight, Building2,
  X, Database, BarChart3, Cpu, ChevronLeft, Layers,
  AlertCircle, Scale, Crosshair, GitBranch, Minus,
  Search, RefreshCw, ListOrdered, Gavel, BarChart2,
  GitCompare, ShieldAlert, Workflow, Download, Archive,
  Share2, Mail, Copy, Check,
} from "lucide-react";
import { downloadBoardBriefPDF, downloadPlaybookPDF, downloadSlideTablePDF, type PlaybookStep } from "@/lib/pdfReports";
import { runMonteCarlo, filterOpenOpps, getRevenue, type ForecastOpportunity } from "@/lib/pipelineForecast";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ComposedChart, Line,
} from "recharts";

// ─── Design Tokens ────────────────────────────────────────────────────────────

const GOLD   = "#F5A623";
const RED    = "#FF4D6D";
const GREEN  = "#10B981";
const BLUE   = "#00D4FF";
const PURPLE = "#BF5FFF";
const AMBER  = "#FFB800";

// ─── Level metadata ───────────────────────────────────────────────────────────

const LEVEL_META = [
  { level: 0, label: "War Room",             question: "Entry State",                    icon: Target,       color: "#888" },
  { level: 1, label: "Signal Decomposition", question: "What is driving this?",          icon: BarChart3,    color: RED    },
  { level: 2, label: "Mechanism View",        question: "How does it actually happen?",  icon: GitBranch,    color: AMBER  },
  { level: 3, label: "Contract Mapping",      question: "Where is this allowed?",        icon: FileText,     color: BLUE   },
  { level: 4, label: "Claims Trace",          question: "Show me proof",                 icon: Database,     color: PURPLE },
  { level: 5, label: "Pattern Detection",     question: "Is this isolated or systemic?", icon: Activity,     color: GREEN  },
  { level: 6, label: "Counterfactual Model",  question: "What should have happened?",    icon: Scale,        color: BLUE   },
  { level: 7, label: "Risk & Fiduciary",      question: "What is the consequence?",      icon: AlertCircle,  color: RED    },
  { level: 8, label: "Leverage Points",       question: "What can we do about it?",      icon: Crosshair,    color: GOLD   },
  { level: 9, label: "C-Suite Narrative",     question: "Executive Summary",             icon: Eye,          color: "#fff" },
];

// ─── 4 War Room Tiles (fixed) ─────────────────────────────────────────────────
// Constitutional invariant — Master Build Prompt §1, HARD RULE 01:
//   "One screen, four tiles always."
// Enforced at the type level as a 4-tuple. The compiler will reject any
// attempt to construct a tile list of length ≠ 4. Runtime assertion
// (assertTiles4) provides defense-in-depth against `as` casts.

interface WRTileData {
  id: string; title: string; color: string;
  value: string; anomaly: string; trend: "up" | "down" | "flat";
  narrative: string;
}

type Tiles4 = readonly [WRTileData, WRTileData, WRTileData, WRTileData];

function assertTiles4(tiles: readonly WRTileData[]): asserts tiles is Tiles4 {
  if (tiles.length !== 4) {
    // Rule 01 is constitutional — not a render bug we work around.
    throw new Error(
      `[HARD RULE 01] War Room must render exactly 4 tiles; got ${tiles.length}. ` +
      `This is a build-time invariant per Master Build Prompt §1.`
    );
  }
}

const BASE_TILES: Tiles4 = [
  {
    id: "financial_exposure", title: "Financial Exposure", color: RED,
    value: "$12.4M", anomaly: "Spread + Rebate", trend: "up",
    narrative: "Spread pricing driving variance",
  },
  {
    id: "contract_integrity", title: "Contract Integrity", color: BLUE,
    value: "23 Gaps", anomaly: "Clause Ambiguity", trend: "down",
    narrative: "23 clause gaps — none disclosed",
  },
  {
    id: "operational_behavior", title: "Operational Behavior", color: PURPLE,
    value: "78%", anomaly: "Quarter-End Spike", trend: "up",
    narrative: "78% spread-priced, Q4-concentrated",
  },
  {
    id: "strategic_leverage", title: "Strategic Leverage", color: GOLD,
    value: "3 Triggers", anomaly: "RFP Ready", trend: "up",
    narrative: "Contract rewrite + RFP ready",
  },
];

// ─── Build live tiles from Commit Engine data ─────────────────────────────────

function fmtShort(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function buildTilesFromData(data: any, companyName: string): Tiles4 {
  const fcr        = data.fcr  ?? {};
  const glp1       = data.glp1 ?? {};
  const risk       = data.risk ?? {};
  const gates      = data.gates ?? {};
  const dol        = data.dol  ?? {};
  const opportunity = data.opportunity ?? {};

  const totalExposure = (fcr.recoverable ?? 0) + (glp1.annual_exposure ?? 0);
  const contractGaps  = [
    !dol.has_stop_loss && dol.participants > 200,
    !dol.has_health,
    !dol.has_drug,
    risk.carrier_risk === "High",
    fcr.verdict === "Excessive",
    (fcr.fcr_pct ?? 0) > (fcr.sector_median_fcr ?? 0) * 1.5,
  ].filter(Boolean).length;

  const operationalPct = fcr.fcr_pct ?? 0;
  const sectorPct      = fcr.sector_median_fcr ?? 0;

  const goCount = Object.values(gates as Record<string, { status: string }>)
    .filter(g => g?.status === "GO").length;

  const shortName = companyName.length > 22 ? companyName.slice(0, 20) + "…" : companyName;

  return [
    {
      id: "financial_exposure", title: "Financial Exposure", color: RED,
      value: fmtShort(totalExposure),
      anomaly: fcr.verdict === "Excessive" ? "Fees Excessive" : fcr.verdict === "Elevated" ? "Fees Elevated" : "Spread + Rebate",
      trend: totalExposure > 0 ? "up" : "flat",
      narrative: `${shortName}: ${fmtShort(fcr.recoverable ?? 0)} recoverable fees · ${fmtShort(glp1.annual_exposure ?? 0)} GLP-1 exposure`,
    },
    {
      id: "contract_integrity", title: "Contract Integrity", color: BLUE,
      value: `${contractGaps} Gap${contractGaps !== 1 ? "s" : ""}`,
      anomaly: risk.carrier_risk === "High" ? "High Carrier Risk" : risk.carrier_risk === "Moderate" ? "Moderate Risk" : "Clause Ambiguity",
      trend: contractGaps > 3 ? "down" : contractGaps > 1 ? "flat" : "up",
      narrative: `${shortName}: ${contractGaps} plan gap${contractGaps !== 1 ? "s" : ""} — ${risk.has_stop_loss_gap ? "stop-loss exposure, " : ""}${dol.carriers?.length ?? 0} carrier${(dol.carriers?.length ?? 0) !== 1 ? "s" : ""} on file`,
    },
    {
      id: "operational_behavior", title: "Operational Behavior", color: PURPLE,
      value: `${operationalPct.toFixed(1)}%`,
      anomaly: operationalPct > sectorPct * 1.3 ? "Above Sector 130%" : operationalPct > sectorPct ? "Above Sector Avg" : "Quarter-End Spike",
      trend: operationalPct > sectorPct ? "up" : "flat",
      narrative: `${shortName} FCR ${operationalPct.toFixed(1)}% vs ${sectorPct.toFixed(1)}% sector median · ${dol.fee_per_participant ? `$${dol.fee_per_participant}/participant` : "spread-priced"}`,
    },
    {
      id: "strategic_leverage", title: "Strategic Leverage", color: GOLD,
      value: `${goCount} Trigger${goCount !== 1 ? "s" : ""}`,
      anomaly: gates.gate7_commit?.status === "GO" ? "RFP Ready" : "Qualifying",
      trend: goCount >= 4 ? "up" : "flat",
      narrative: `${shortName}: ${goCount}/7 gates cleared · ${fmtShort(opportunity.total_first_year ?? 0)} first-year opportunity`,
    },
  ];
}

// ─── Build company-specific L1 signals from Commit Engine data ───────────────
// When a real company is loaded, the L1 "Signal Decomposition" drill should
// reflect that company's actual plan profile (real carrier names, real FCR %,
// real GLP-1 eligible count, real fees) instead of the generic demo signals in
// L1_SIGNALS. Returns a Record keyed by tile id, parallel to L1_SIGNALS, so the
// caller can fall back to L1_SIGNALS when no company is loaded.
function buildL1SignalsFromData(data: any, companyName: string): Record<string, DrillItem[]> {
  const fcr         = data.fcr  ?? {};
  const glp1        = data.glp1 ?? {};
  const risk        = data.risk ?? {};
  const gates       = data.gates ?? {};
  const dol         = data.dol  ?? {};
  const opportunity = data.opportunity ?? {};
  const history     = (data.history ?? []) as Array<{ year: number; fees: number; participants: number; fee_delta_pct?: number }>;

  const filingYear   = dol.latest_year ? `FY${dol.latest_year}` : "latest filing";
  const fcrPct       = fcr.fcr_pct ?? 0;
  const sectorPct    = fcr.sector_median_fcr ?? 0;
  const recoverable  = fcr.recoverable ?? 0;
  const ppp          = dol.fee_per_participant ?? 0;
  const carriers     = (dol.carriers ?? []) as string[];
  const carrierLabel = carriers.length ? carriers.slice(0, 2).join(", ") + (carriers.length > 2 ? ` +${carriers.length - 2}` : "") : "none on file";
  const participants = dol.participants ?? 0;
  const broker       = dol.broker_commissions ?? 0;
  const goCount      = Object.values(gates as Record<string, { status: string }>).filter(g => g?.status === "GO").length;
  const totalGates   = Object.keys(gates).length || 7;

  const last2 = history.slice(-2);
  const feeTrendPct = last2.length === 2 && last2[0].fees
    ? Math.round(((last2[1].fees - last2[0].fees) / last2[0].fees) * 100)
    : (history.length ? (history[history.length - 1].fee_delta_pct ?? 0) : 0);
  const partTrend = last2.length === 2 && last2[0].participants
    ? Math.round(((last2[1].participants - last2[0].participants) / last2[0].participants) * 100)
    : 0;

  const pctDeltaStr = sectorPct > 0
    ? `${fcrPct >= sectorPct ? "+" : ""}${Math.round((fcrPct / sectorPct - 1) * 100)}% vs sector`
    : "no peer median";

  // ── Financial Exposure ─────────────────────────────────────────────────────
  const financial: DrillItem[] = [];
  financial.push({
    id: "recoverable_fees", label: "Recoverable Plan Fees", value: fmtShort(recoverable),
    delta: pctDeltaStr, color: recoverable > 0 ? RED : BLUE,
    severity: fcr.verdict === "Excessive" ? "CRITICAL" : fcr.verdict === "Elevated" ? "HIGH" : "MEDIUM",
    desc: `${companyName} reports a fee-to-revenue ratio of ${fcrPct.toFixed(2)}% versus a sector median of ${sectorPct.toFixed(2)}% (${filingYear}). Verdict: ${fcr.verdict ?? "Aligned"}.`,
    findings: [
      `Total plan fees ${fmtShort(dol.total_fees ?? 0)} across ${dol.plan_count ?? 0} plan${(dol.plan_count ?? 0) !== 1 ? "s" : ""}`,
      `Admin ${fmtShort(dol.admin_fees ?? 0)} · Investment ${fmtShort(dol.invest_fees ?? 0)} · Legal ${fmtShort(dol.legal_fees ?? 0)}`,
      `${fmtShort(recoverable)} modeled as recoverable via pass-through repricing`,
    ],
    action: "Demand ingredient-cost pass-through and benchmark plan fees against sector median at renewal.",
  });
  financial.push({
    id: "glp1_exposure", label: "GLP-1 Exposure", value: fmtShort(glp1.annual_exposure ?? 0),
    delta: `${(glp1.eligible_members ?? 0).toLocaleString()} eligible`, color: AMBER,
    severity: (glp1.risk_score ?? 0) >= 80 ? "CRITICAL" : (glp1.risk_score ?? 0) >= 65 ? "HIGH" : "MEDIUM",
    desc: `${companyName} carries a GLP-1 risk score of ${glp1.risk_score ?? 0}/100 (${glp1.risk_tier ?? "Moderate"} tier) with ${(glp1.eligible_members ?? 0).toLocaleString()} eligible members.`,
    findings: [
      `${(glp1.eligible_members ?? 0).toLocaleString()} GLP-1-eligible members estimated from ${participants.toLocaleString()} participants`,
      `${fmtShort(glp1.annual_exposure ?? 0)} annual exposure · ${fmtShort(glp1.exposure_3yr ?? 0)} over 3 years`,
      `${fmtShort(glp1.intervention_savings ?? 0)} recoverable via clinical intervention program`,
    ],
    action: "Implement specialty PA criteria and a GLP-1 clinical intervention protocol with NADAC benchmark anchors.",
  });
  if (broker > 0) {
    financial.push({
      id: "broker_commissions", label: "Broker Commissions", value: fmtShort(broker),
      delta: `${(risk.commission_pct ?? 0).toFixed(1)}% of income`, color: risk.carrier_risk === "High" ? RED : AMBER,
      severity: risk.carrier_risk === "High" ? "HIGH" : "MEDIUM",
      desc: `Broker commissions of ${fmtShort(broker)} represent ${(risk.commission_pct ?? 0).toFixed(1)}% of plan income — carrier risk classified ${risk.carrier_risk ?? "Low"}.`,
      findings: [
        `Carriers on file: ${carrierLabel}`,
        `Commission load ${(risk.commission_pct ?? 0).toFixed(1)}% of plan income`,
        `Carrier concentration risk: ${risk.carrier_risk ?? "Low"}`,
      ],
      action: "Require commission disclosure under §408(b)(2) and competitively bid carrier placement.",
    });
  }
  financial.push({
    id: "fee_load", label: "Fee Per Participant", value: ppp ? `$${ppp.toLocaleString()}` : "—",
    delta: `${participants.toLocaleString()} participants`, color: BLUE, severity: "MEDIUM",
    desc: `Plan-level fee load of ${ppp ? `$${ppp.toLocaleString()}` : "—"} per participant across ${participants.toLocaleString()} covered lives (${filingYear}).`,
    findings: [
      `${participants.toLocaleString()} participants on ${filingYear} filing`,
      `${fmtShort(dol.total_fees ?? 0)} total fees ÷ ${participants.toLocaleString()} participants`,
      `Welfare premiums ${fmtShort(dol.welfare_premiums ?? 0)}`,
    ],
    action: "Itemize fee-for-service schedule and eliminate bundled PMPM admin loads.",
  });

  // ── Contract Integrity ──────────────────────────────────────────────────────
  const contract: DrillItem[] = [];
  if (risk.has_stop_loss_gap) {
    contract.push({
      id: "stoploss_gap", label: "Stop-Loss Coverage", value: "ABSENT", delta: "Critical Gap", color: RED, severity: "CRITICAL",
      desc: `${companyName} covers ${participants.toLocaleString()} participants with no stop-loss coverage on file — catastrophic claim exposure is unhedged.`,
      findings: [
        `${participants.toLocaleString()} participants exposed with no specific/aggregate stop-loss`,
        "No stop-loss benefit reported on Schedule A",
        "Single catastrophic claim could breach plan reserves",
      ],
      action: "Obtain specific + aggregate stop-loss quotes immediately; bind coverage before renewal.",
    });
  }
  contract.push({
    id: "carrier_concentration", label: "Carrier Concentration", value: `${carriers.length} Carrier${carriers.length !== 1 ? "s" : ""}`,
    delta: risk.carrier_risk === "High" ? "High Risk" : risk.carrier_risk === "Moderate" ? "Moderate Risk" : "Low Risk",
    color: risk.carrier_risk === "High" ? RED : risk.carrier_risk === "Moderate" ? AMBER : BLUE,
    severity: risk.carrier_risk === "High" ? "HIGH" : "MEDIUM",
    desc: `${companyName} places coverage with ${carrierLabel}. Carrier risk classified ${risk.carrier_risk ?? "Low"} based on commission concentration.`,
    findings: [
      `Carriers on file: ${carrierLabel}`,
      `Carrier risk: ${risk.carrier_risk ?? "Low"}`,
      `Broker commissions ${fmtShort(broker)} (${(risk.commission_pct ?? 0).toFixed(1)}% of income)`,
    ],
    action: "Competitively bid carrier placement and demand full commission disclosure.",
  });
  if (!dol.has_health) {
    contract.push({
      id: "health_gap", label: "Health Benefit Filing", value: "MISSING", delta: "Schedule A Gap", color: AMBER, severity: "HIGH",
      desc: `No health benefit appears on ${companyName}'s ${filingYear} Schedule A — a filing or coverage gap that limits fiduciary visibility.`,
      findings: ["Health benefit not reported on Schedule A", "Reduces fee transparency", "May indicate self-funded arrangement off-Schedule"],
      action: "Reconcile Schedule A filings; confirm health benefit funding and fee disclosure.",
    });
  }
  if (!dol.has_drug) {
    contract.push({
      id: "drug_gap", label: "Drug Benefit Filing", value: "MISSING", delta: "Schedule A Gap", color: AMBER, severity: "HIGH",
      desc: `No drug/PBM benefit appears on ${companyName}'s ${filingYear} Schedule A — PBM fees and rebates are not visible in the filing.`,
      findings: ["Drug benefit not reported on Schedule A", "PBM spread and rebate retention not disclosed", "Limits pass-through enforcement"],
      action: "Demand 408(b)(2) PBM fee disclosure and reconcile drug benefit to Schedule A.",
    });
  }
  if (fcr.verdict === "Excessive" || fcrPct > sectorPct * 1.5) {
    contract.push({
      id: "fee_clause", label: "Fee Reasonableness", value: fcr.verdict === "Excessive" ? "EXCESSIVE" : "ELEVATED",
      delta: pctDeltaStr, color: RED, severity: "HIGH",
      desc: `Plan fees at ${fcrPct.toFixed(2)}% of revenue exceed the ${sectorPct.toFixed(2)}% sector median — implicating ERISA §404 duty of prudence.`,
      findings: [
        `FCR ${fcrPct.toFixed(2)}% vs ${sectorPct.toFixed(2)}% sector median`,
        `${fmtShort(recoverable)} recoverable via repricing`,
        "No documented fee-reasonableness review on file",
      ],
      action: "Document a fee-reasonableness review and renegotiate to pass-through pricing.",
    });
  }

  // ── Operational Behavior ────────────────────────────────────────────────────
  const operational: DrillItem[] = [];
  operational.push({
    id: "fcr_ratio", label: "Fee-to-Revenue Ratio", value: `${fcrPct.toFixed(2)}%`, delta: pctDeltaStr,
    color: fcrPct > sectorPct * 1.3 ? RED : fcrPct > sectorPct ? AMBER : GREEN,
    severity: fcrPct > sectorPct * 1.3 ? "CRITICAL" : fcrPct > sectorPct ? "HIGH" : "LOW",
    desc: `${companyName}'s fee-to-revenue ratio is ${fcrPct.toFixed(2)}% versus a sector median of ${sectorPct.toFixed(2)}% (${filingYear}).`,
    findings: [
      `FCR ${fcrPct.toFixed(2)}% vs ${sectorPct.toFixed(2)}% sector median`,
      `Sector benchmark drawn from ${fcr.sector_plans ?? 0} peer plans`,
      `${fmtShort(fcr.fcr_excess ?? 0)} excess over sector-median fee level`,
    ],
    action: "Benchmark line-item fees against pass-through peers and demand disclosure.",
  });
  operational.push({
    id: "fee_per_part_op", label: "Fee Per Participant", value: ppp ? `$${ppp.toLocaleString()}` : "—",
    delta: `${participants.toLocaleString()} lives`, color: BLUE, severity: "MEDIUM",
    desc: `Per-participant fee load of ${ppp ? `$${ppp.toLocaleString()}` : "—"} across ${participants.toLocaleString()} covered lives.`,
    findings: [
      `${fmtShort(dol.total_fees ?? 0)} total fees ÷ ${participants.toLocaleString()} participants`,
      `Admin ${fmtShort(dol.admin_fees ?? 0)} · Investment ${fmtShort(dol.invest_fees ?? 0)}`,
      `${dol.plan_count ?? 0} active plan${(dol.plan_count ?? 0) !== 1 ? "s" : ""}`,
    ],
    action: "Audit per-participant admin loads against benchmarked pass-through peers.",
  });
  if (history.length >= 2) {
    operational.push({
      id: "fee_trend", label: "Fee Trend (YoY)", value: `${feeTrendPct >= 0 ? "+" : ""}${feeTrendPct}%`,
      delta: `${history.length}-yr filing`, color: feeTrendPct > 10 ? RED : feeTrendPct > 0 ? AMBER : GREEN,
      severity: feeTrendPct > 15 ? "HIGH" : feeTrendPct > 0 ? "MEDIUM" : "LOW",
      desc: `Plan fees moved ${feeTrendPct >= 0 ? "up" : "down"} ${Math.abs(feeTrendPct)}% year-over-year while participants moved ${partTrend >= 0 ? "+" : ""}${partTrend}%.`,
      findings: [
        `Fees ${feeTrendPct >= 0 ? "+" : ""}${feeTrendPct}% YoY`,
        `Participants ${partTrend >= 0 ? "+" : ""}${partTrend}% YoY`,
        `${history.length} years of filing history on record`,
      ],
      action: "Flag fee growth outpacing enrollment for renewal renegotiation.",
      chart: history.map(h => ({ year: h.year, fees: h.fees, participants: h.participants })),
    });
  }
  operational.push({
    id: "broker_behavior", label: "Commission Load", value: `${(risk.commission_pct ?? 0).toFixed(1)}%`,
    delta: fmtShort(broker), color: risk.carrier_risk === "High" ? RED : AMBER,
    severity: risk.carrier_risk === "High" ? "HIGH" : "MEDIUM",
    desc: `Broker commissions equal ${(risk.commission_pct ?? 0).toFixed(1)}% of plan income — carrier risk ${risk.carrier_risk ?? "Low"}.`,
    findings: [
      `${fmtShort(broker)} broker commissions`,
      `${(risk.commission_pct ?? 0).toFixed(1)}% of plan income`,
      `Carriers: ${carrierLabel}`,
    ],
    action: "Require commission disclosure and competitively bid carrier placement.",
  });

  // ── Strategic Leverage ──────────────────────────────────────────────────────
  const strategic: DrillItem[] = [];
  strategic.push({
    id: "commit_gates", label: "Commit Gates Cleared", value: `${goCount}/${totalGates}`,
    delta: gates.gate7_commit?.status === "GO" ? "RFP Ready" : "Qualifying", color: goCount >= 4 ? GOLD : BLUE,
    severity: goCount >= 4 ? "HIGH" : "MEDIUM",
    desc: `${companyName} has cleared ${goCount} of ${totalGates} commit gates. ${gates.gate7_commit?.note ?? ""}`.trim(),
    findings: Object.entries(gates as Record<string, { status: string; note: string }>)
      .filter(([, g]) => g?.status === "GO").slice(0, 4).map(([, g]) => g.note),
    action: "Advance qualifying gates and assemble the executive proposal package.",
  });
  strategic.push({
    id: "first_year_opp", label: "First-Year Opportunity", value: fmtShort(opportunity.total_first_year ?? 0),
    delta: `${fmtShort(opportunity.three_year_value ?? 0)} 3-yr`, color: GOLD, severity: "HIGH",
    desc: `Modeled first-year opportunity of ${fmtShort(opportunity.total_first_year ?? 0)} for ${companyName}, ${fmtShort(opportunity.three_year_value ?? 0)} over three years.`,
    findings: [
      `${fmtShort(opportunity.fee_recovery_commission ?? 0)} from fee recovery`,
      `${fmtShort(opportunity.glp1_commission ?? 0)} from GLP-1 intervention`,
      `${fmtShort(opportunity.three_year_value ?? 0)} three-year value`,
    ],
    action: "Lock pass-through terms with audit rights and performance guarantees.",
  });
  strategic.push({
    id: "fee_recovery_lever", label: "Fee Recovery Lever", value: fmtShort(recoverable),
    delta: pctDeltaStr, color: recoverable > 0 ? GOLD : BLUE, severity: recoverable > 0 ? "HIGH" : "MEDIUM",
    desc: `${fmtShort(recoverable)} recoverable via repricing at ${companyName}, given FCR ${fcrPct.toFixed(2)}% vs ${sectorPct.toFixed(2)}% sector median.`,
    findings: [
      `${fmtShort(recoverable)} recoverable plan fees`,
      `${fmtShort(fcr.fcr_excess ?? 0)} excess over sector median`,
      "Pass-through repricing is the primary recovery mechanism",
    ],
    action: "Issue §408(b)(2) demand, then RFP with mandatory pass-through pricing.",
  });
  strategic.push({
    id: "rfp_trigger", label: "RFP Readiness", value: gates.gate7_commit?.status === "GO" ? "Ready" : "Qualifying",
    delta: `${goCount}/${totalGates} gates`, color: gates.gate7_commit?.status === "GO" ? GREEN : BLUE,
    severity: gates.gate7_commit?.status === "GO" ? "HIGH" : "MEDIUM",
    desc: `${companyName} is ${gates.gate7_commit?.status === "GO" ? "RFP-ready" : "still qualifying"} — ${goCount} of ${totalGates} gates cleared.`,
    findings: [
      `Commit gate verdict: ${gates.gate7_commit?.status ?? "REVIEW"}`,
      `${fmtShort(opportunity.total_first_year ?? 0)} first-year opportunity`,
      gates.gate6_opportunity?.note ?? "Opportunity sizing complete",
    ],
    action: "Issue PBM RFP with pass-through pricing as a mandatory requirement.",
  });

  return {
    financial_exposure: financial,
    contract_integrity: contract.length ? contract : L1_SIGNALS.contract_integrity,
    operational_behavior: operational,
    strategic_leverage: strategic,
  };
}

// ─── Build a compact company-context block for deeper drill/narrative levels ──
// The first drill level (L1) renders company-specific signals locally. When the
// user drills deeper (L2 mechanism → L9 synthesis), the drill/narrative APIs need
// the same real plan profile so depth 2–8 stay grounded in the loaded company's
// actual numbers (EIN, carriers, FCR %, GLP-1 counts, fees) instead of drifting
// back to generic demo content. Returns "" when no real company is loaded so the
// backend falls back to its existing generic behavior.
function buildCompanyContext(data: any, companyName: string, ein: string): string {
  if (!data || !ein) return "";
  const fcr         = data.fcr  ?? {};
  const glp1        = data.glp1 ?? {};
  const risk        = data.risk ?? {};
  const dol         = data.dol  ?? {};
  const opportunity = data.opportunity ?? {};
  const history     = (data.history ?? []) as Array<{ year: number; fees: number; participants: number }>;

  const filingYear   = dol.latest_year ? `FY${dol.latest_year}` : "latest filing";
  const carriers     = (dol.carriers ?? []) as string[];
  const carrierLabel = carriers.length ? carriers.join(", ") : "none on file";
  const lines: string[] = [];

  lines.push(`COMPANY: ${companyName} (EIN ${ein}) · ${filingYear} DOL Form 5500`);
  lines.push(`PARTICIPANTS: ${(dol.participants ?? 0).toLocaleString()} covered lives across ${dol.plan_count ?? 0} plan(s)`);
  lines.push(`CARRIERS ON FILE: ${carrierLabel}`);
  lines.push(`FEE-TO-REVENUE RATIO: ${(fcr.fcr_pct ?? 0).toFixed(2)}% vs ${(fcr.sector_median_fcr ?? 0).toFixed(2)}% sector median (verdict: ${fcr.verdict ?? "Aligned"})`);
  lines.push(`PLAN FEES: ${fmtShort(dol.total_fees ?? 0)} total · admin ${fmtShort(dol.admin_fees ?? 0)} · investment ${fmtShort(dol.invest_fees ?? 0)} · legal ${fmtShort(dol.legal_fees ?? 0)}`);
  lines.push(`RECOVERABLE FEES: ${fmtShort(fcr.recoverable ?? 0)} (${fmtShort(fcr.fcr_excess ?? 0)} excess over sector median)`);
  lines.push(`GLP-1 EXPOSURE: ${(glp1.eligible_members ?? 0).toLocaleString()} eligible members · ${fmtShort(glp1.annual_exposure ?? 0)}/yr · risk score ${glp1.risk_score ?? 0}/100 (${glp1.risk_tier ?? "Moderate"})`);
  lines.push(`BROKER COMMISSIONS: ${fmtShort(dol.broker_commissions ?? 0)} (${(risk.commission_pct ?? 0).toFixed(1)}% of plan income) · carrier risk ${risk.carrier_risk ?? "Low"}`);
  lines.push(`STOP-LOSS COVERAGE: ${risk.has_stop_loss_gap ? "ABSENT — catastrophic claim exposure unhedged" : "on file"}`);
  if (opportunity.total_first_year) {
    lines.push(`MODELED OPPORTUNITY: ${fmtShort(opportunity.total_first_year)} first-year · ${fmtShort(opportunity.three_year_value ?? 0)} three-year`);
  }
  if (history.length >= 2) {
    const f = history[0], l = history[history.length - 1];
    lines.push(`FILING HISTORY: ${history.length} years (${f.year}–${l.year}); fees ${fmtShort(f.fees)} → ${fmtShort(l.fees)}, participants ${(f.participants ?? 0).toLocaleString()} → ${(l.participants ?? 0).toLocaleString()}`);
  }

  return lines.join("\n");
}

// ─── Board Brief real-data mapping (Commit Engine → BoardBriefData) ─────────
// When the War Room has a real company loaded, the L9 Board Brief PDF should
// render the actual financial exposure / contract gaps / commit triggers for
// the loaded company instead of the hardcoded demo placeholders. This helper
// converts the `/api/commit/analyze/{ein}` payload into the per-tile fields
// expected by `BoardBriefData`.
function realBoardBriefForTile(tileId: string, data: any): {
  impactValue?: string;
  impactDetail?: string;
  riskLabel?: string;
  riskDetail?: string;
  actionLabel?: string;
  actionDetail?: string;
} {
  if (!data) return {};
  const fcr         = data.fcr  ?? {};
  const glp1        = data.glp1 ?? {};
  const risk        = data.risk ?? {};
  const gates       = data.gates ?? {};
  const dol         = data.dol  ?? {};
  const opportunity = data.opportunity ?? {};
  const filingYear  = dol.latest_year ? `FY${dol.latest_year}` : "latest filing";

  switch (tileId) {
    case "financial_exposure": {
      const recoverable = fcr.recoverable ?? 0;
      const glp1Exp     = glp1.annual_exposure ?? 0;
      const total       = recoverable + glp1Exp;
      const fcrPct      = fcr.fcr_pct ?? 0;
      const sectorPct   = fcr.sector_median_fcr ?? 0;
      return {
        impactValue:  fmtShort(total),
        impactDetail: `${fmtShort(recoverable)} recoverable PBM fees + ${fmtShort(glp1Exp)} GLP-1 exposure (${filingYear})`,
        riskLabel:    fcr.verdict === "Excessive" ? "Excessive Fee — ERISA §404 Breach Risk" : "ERISA Fiduciary Exposure",
        riskDetail:   `FCR ${fcrPct.toFixed(1)}% vs ${sectorPct.toFixed(1)}% sector median — duty of prudence implicated`,
        actionLabel:  fcr.verdict === "Excessive" ? "Immediate RFP" : "Fee Renegotiation",
        actionDetail: `Pursue pass-through pricing; ${fmtShort(opportunity.total_first_year ?? 0)} first-year recapture modeled`,
      };
    }
    case "contract_integrity": {
      const participants = dol.participants ?? 0;
      const gapList = [
        !dol.has_stop_loss && participants > 200 ? "stop-loss coverage missing" : null,
        !dol.has_health ? "health benefit not on Schedule A" : null,
        !dol.has_drug ? "drug benefit not on Schedule A" : null,
        risk.carrier_risk === "High" ? "high carrier concentration" : null,
        fcr.verdict === "Excessive" ? "fees exceed sector median" : null,
      ].filter(Boolean) as string[];
      const gapCount = gapList.length;
      const carrierCount = dol.carriers?.length ?? 0;
      return {
        impactValue:  `${gapCount} Gap${gapCount !== 1 ? "s" : ""}`,
        impactDetail: gapCount > 0
          ? gapList.join(" · ")
          : "All filed contracts pass integrity checks",
        riskLabel:    risk.has_stop_loss_gap ? "Catastrophic Claim Exposure" : "Carrier Risk",
        riskDetail:   `${carrierCount} carrier${carrierCount !== 1 ? "s" : ""} on file; carrier risk classified ${risk.carrier_risk ?? "Unknown"}`,
        actionLabel:  risk.has_stop_loss_gap ? "Bind Stop-Loss" : "Contract Audit",
        actionDetail: "Close filing gaps and obtain specific + aggregate stop-loss quotes",
      };
    }
    case "operational_behavior": {
      const fcrPct    = fcr.fcr_pct ?? 0;
      const sectorPct = fcr.sector_median_fcr ?? 0;
      const ppp       = dol.fee_per_participant;
      return {
        impactValue:  `${fcrPct.toFixed(1)}%`,
        impactDetail: `Fee-to-claims ratio ${fcrPct.toFixed(1)}% vs ${sectorPct.toFixed(1)}% sector median (${filingYear})${ppp ? ` · $${ppp}/participant` : ""}`,
        riskLabel:    fcrPct > sectorPct * 1.3 ? "Excessive Operational Cost" : "Operational Drift",
        riskDetail:   `${dol.participants ?? 0} participants exposed to above-median pricing structure`,
        actionLabel:  "Spread Audit",
        actionDetail: "Demand line-item disclosure; benchmark against pass-through peers",
      };
    }
    case "strategic_leverage": {
      const gateEntries = Object.values(gates as Record<string, { status?: string }>);
      const goCount     = gateEntries.filter(g => g?.status === "GO").length;
      const totalGates  = gateEntries.length || 7;
      const opp         = opportunity.total_first_year ?? 0;
      const commitReady = (gates as any).gate7_commit?.status === "GO";
      return {
        impactValue:  fmtShort(opp),
        impactDetail: `${goCount}/${totalGates} commit gates cleared · ${fmtShort(opp)} first-year opportunity modeled`,
        riskLabel:    commitReady ? "Window Closing" : "Engagement Risk",
        riskDetail:   commitReady ? "RFP-ready — incumbent renewal cycle approaching" : "Qualifying gates not yet cleared",
        actionLabel:  commitReady ? "Issue RFP" : "Advance Gates",
        actionDetail: "Lock pass-through terms with audit rights and performance guarantees",
      };
    }
    default:
      return {};
  }
}

// ─── Pre-defined L1 signals per tile ─────────────────────────────────────────

interface DrillItem {
  id: string; label: string; value: string; delta: string; color: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  desc: string; findings?: string[]; action?: string;
  kpis?: { label: string; value: string; up: boolean }[];
  meta?: string;
  chart?: { year: number; fees: number; participants: number }[];
}

// Lightweight node persisted for the drill trail — enough to re-register the
// item (breadcrumb label + drill context) before per-level data is re-derived.
interface DrillNodeLite { id: string; label: string; value: string; color: string }

// Persisted drill state — scoped to the loaded company + tile so a stale trail
// is never restored against a different company/tile.
interface SavedDrill { ein: string; tile: string; depth: number; nodes: DrillNodeLite[] }

// Confidence tier — constitutional, exactly three labels (Master Build Prompt §4).
type ConfidenceTier = "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";

// Structured narrative entry from KIQ Narrative Engine™
type NarrativeEntry =
  | { type: "level";     insight: string; anomaly: string; implication: string; tier?: ConfidenceTier }
  | { type: "executive"; brief: string; tier?: ConfidenceTier }
  | { type: "loading" };

// ─── Kincaid IQ Verify™ V10.0 — Doctrine constants ───────────────────────────
// Source of record: Kincaid IQ Verify™ V10.0 (see replit.md Constitutional Doctrine).
// Canonical copy lives in components/Doctrine.tsx; kept in sync here.
// These constants are surfaced in the DoctrineStrip at the top of the War Room.

const VOICE_CONTRACT =
  "University of Chicago PhD Economist + PhD Computer Scientist — industrial organization, agency theory, " +
  "information economics, causal inference — overlaid on a McKinsey senior partner's board-room directness. " +
  "Do not summarize — investigate. Do not speculate — prove. Do not report observations — quantify consequences. " +
  "Every assertion justified by a structural property and a dollar figure, never a preference.";

const HARD_RULES: { num: string; title: string; body: string }[] = [
  { num: "RULE 01", title: "One screen, four tiles always.",
    body: "The executive surface is architecturally constrained to four tiles. Prevents the false precision of information overload — enforced at the type level as a 4-tuple." },
  { num: "RULE 02", title: "Every number clickable into receipts.",
    body: "No KPI is rendered without a drill path to its EvidenceRef. The drill is a first-class affordance, not a tooltip. Routed deep-link, never a modal." },
  { num: "RULE 03", title: "No export without receipts.",
    body: "Every PDF, CSV, or JSON export carries a cryptographic manifest — SHA-256 of every cited EvidenceRef. Exports without it are rejected at the RENDER gate." },
  { num: "RULE 04", title: "Narratives never outrun evidence.",
    body: "Generative language is gated behind deterministic computation. If math returns INSUFFICIENT_EVIDENCE, the narrative says so — it does not paper over the gap." },
];

// Each drill level materially exercises one of the canonical enforcement gates,
// imported from Doctrine (the single source of truth). The DEFINE..RENDER pipeline
// shorthand is retired.
const LEVEL_TO_GATE: Record<number, Gate> = {
  0: "EVIDENCE_EXISTENCE",     // entry state: evidence must exist
  1: "EVIDENCE_FRESHNESS",     // signal decomposition: freshness of bound sources
  2: "EVIDENCE_VERIFICATION",  // mechanism view: hash and verify the evidence
  3: "KPI_LIFECYCLE",          // contract mapping: admit the KPI to production
  4: "DEPENDENCY_RESOLUTION",  // claims trace: parent KPIs and claim lines resolved
  5: "DEPENDENCY_RESOLUTION",  // pattern detection: still the dependency layer
  6: "THRESHOLD_EVALUATION",   // counterfactual: threshold adjudication
  7: "THRESHOLD_EVALUATION",   // risk / fiduciary: threshold adjudication
  8: "DEBT_SCORE_CHECK",       // leverage points: debt gate before render
  9: "DEBT_SCORE_CHECK",       // c-suite narrative: debt score over 15 blocks render
};

// ─── Canonical constitution surfaces (docs/CONSTITUTION.md) ────────────────────
// The four core primitives, the canonical enforcement gates (with fail codes), and
// the zero-trust governance event taxonomy. Surfaced verbatim in the DoctrineStrip
// so the War Room shows the governance substance it enforces, not just the voice,
// the four hard rules, and the tiers.

const CORE_PRIMITIVES: { name: string; fields: string; purpose: string }[] = [
  { name: "EvidenceRef",
    fields: "evidence_id · source_hash (SHA-256) · received_at_epoch · sensitivity_tags · uri",
    purpose: "Content-addressed evidence pointer. Tamper detection and freshness computation." },
  { name: "TransformRef",
    fields: "transform_hash · code_version · params_hash · executed_at_epoch",
    purpose: "Computation fingerprint. Same code plus same params guarantees the same output." },
  { name: "PolicyResult",
    fields: "allowed · verified_status · freshness_status · confidence_score · reason_code · violations[]",
    purpose: "Governance verdict. Status is VERIFIED, UNVERIFIED, or DISPUTED." },
  { name: "Claim",
    fields: "claim_id · kpi_key · kpi_version · value · unit · period · evidence[] · transform · policy",
    purpose: "The atomic unit. A versioned, evidence-backed, policy-evaluated, cryptographically fingerprinted assertion." },
];

const DETERMINISTIC_CACHE_KEY =
  "(kpi_key, kpi_version, evidence_set_hash, transform_hash). A cache match guarantees byte-identical output.";

// ENFORCEMENT_GATES is imported from Doctrine (the single source of truth) and
// rendered below with its fail codes and effects.

const GOVERNANCE_EVENTS: { type: string; severity: "INFO" | "WARNING" | "CRITICAL"; meaning: string }[] = [
  { type: "GATE_PASS",           severity: "INFO",     meaning: "Computation cleared all seven gates." },
  { type: "GATE_BLOCK",          severity: "WARNING",  meaning: "Export or render blocked on an unverified artifact." },
  { type: "AGENT_BLOCKED",       severity: "CRITICAL", meaning: "Generative agent attempted action beyond its authority." },
  { type: "HASH_VERIFIED",       severity: "INFO",     meaning: "Evidence artifact SHA-256 hash confirmed." },
  { type: "POLICY_BREACH",       severity: "WARNING",  meaning: "Contract clause breach detected in evidence." },
  { type: "AGENT_GOVERNED",      severity: "INFO",     meaning: "Agent draft reviewed and approved by a human." },
  { type: "DETERMINISTIC_CHECK", severity: "INFO",     meaning: "Transform reproducibility verified." },
  { type: "FRESHNESS_ALERT",     severity: "WARNING",  meaning: "Evidence artifact freshness degraded." },
];

// ─── Stanford register: empirical validation (STANFORD_PHD_SETUP.md) ───────────
// The fourth register in the Kincaid IQ intellectual stack. Harvard argues it, MIT
// proves it, Stanford tests it and ships it, Notre Dame asks who it serves. This
// register governs methodology, benchmarks, and validation: the answer to "how do
// you know?" It is surfaced in the DoctrineStrip so the War Room states its
// empirical posture, not just its voice and its gates.

const INTELLECTUAL_STACK: { register: string; contribution: string; question: string }[] = [
  { register: "Harvard MBA",  contribution: "The boardroom argument: capital, margin, fiduciary duty, category economics.",           question: "Why does this matter to the people who allocate capital?" },
  { register: "MIT PhD (CS)", contribution: "The formal proof: primitives, gates, hash chains, determinism as a property of the system.", question: "Why is this guaranteed true by construction?" },
  { register: "Stanford PhD", contribution: "The empirical validation: benchmarks, replication, ablation, research shipped as product.", question: "How do we know it is true in practice?" },
  { register: "Notre Dame",   contribution: "The conscience: who is served, and who is harmed when the system fails.",              question: "Why is this worth doing beyond the return?" },
];

const STANFORD_DISCIPLINE: { rule: string; body: string }[] = [
  { rule: "Falsifiable claims",
    body: "A claim is a hypothesis until it survives contact with data. Define the metric before running the test, and report the result whether or not it flatters the thesis." },
  { rule: "Benchmarks over adjectives",
    body: "\"Fast\" is a Harvard word. \"Sub-second OLAP over 3.9M rows, p95 under 400ms\" is a Stanford sentence. If a number cannot be benchmarked yet, state the benchmark and when it will exist." },
  { rule: "Ablation thinking",
    body: "When a result improves, know which component did it. When quantifying leakage, know which clause, channel, or formulary tier carried the effect, not just the total." },
  { rule: "Replication is the standard of proof",
    body: "A finding another party can reproduce from the packet is a finding. Anything else is an anecdote with confidence. Replication packets are first-class deliverables." },
  { rule: "Report the null result",
    body: "INSUFFICIENT_EVIDENCE is the null result reported rather than hidden. Reporting the null result is a deeply empirical act." },
  { rule: "Research-to-product distance",
    body: "The gap between what the engine proved and what the customer receives is itself a metric. State it, and treat it as backlog rather than embarrassment." },
];

// The published replication benchmark from the determinism harness on the fixed
// demo seed (per STANFORD_PHD_SETUP.md). These are the reference values every build
// must reproduce byte-for-byte on identical inputs; they are scoped to the fixed
// demo seed, NOT to any live per-employer computation surfaced elsewhere.
const REPLICATION_BENCHMARK: {
  seed: string; method: string; source: string; falsification: string;
  metrics: { key: string; label: string; value: string }[];
} = {
  seed: "Fixed demo seed",
  method: "Determinism harness: identical inputs produce byte-identical result_json, verified across repeated runs.",
  source: "STANFORD_PHD_SETUP.md",
  falsification: "Any build that deviates on identical inputs has failed replication.",
  metrics: [
    { key: "DRAP", label: "Delta Realized vs Allowable Pricing", value: "$6,230,840" },
    { key: "PEPM", label: "Blended PEPM",                         value: "$1,055" },
  ],
};

// The three confidence tiers, read as epistemic states (STANFORD_PHD_SETUP.md):
// CERTIFIED is a replicated result, MODELED is a disclosed-assumption hypothesis,
// INSUFFICIENT_EVIDENCE is the null result reported not hidden.
const TIER_EPISTEMICS: { tier: ConfidenceTier; gloss: string }[] = [
  { tier: "CERTIFIED",             gloss: "A replicated result." },
  { tier: "MODELED",               gloss: "A stated hypothesis with disclosed assumptions." },
  { tier: "INSUFFICIENT_EVIDENCE", gloss: "The null result, reported not hidden." },
];

// Dimensional transformation at each level — what new lens is introduced
const LEVEL_DIMENSION: Record<number, string> = {
  1: "surface_signal",
  2: "mechanism_discovery",
  3: "contract_evidence",
  4: "claims_proof",
  5: "systemic_pattern",
  6: "counterfactual_model",
  7: "fiduciary_consequence",
  8: "leverage_point",
  9: "executive_synthesis",
};

// ─── DrillDownEngine ──────────────────────────────────────────────────────────
// 9-level recursive intelligence engine. Each level has a dedicated processing
// method that introduces a NEW analytical dimension — not just filtered data.
// Matches the spec pattern exactly:
//   engine.process(level, context)  →  switch → level0_summary / level1_decompose / …

type DrillContext = {
  tile: string;
  pathLabels: string[];
  pathNodes: Array<{ id: string; title: string; level: number; category: string }>;
  ein?: string;
};

type LevelFetcher = (topic: string, ctx: DrillContext, level: number) => Promise<DrillItem[]>;

class DrillDownEngine {
  constructor(
    private readonly tileLabel: string,
    private readonly fetch: LevelFetcher,
  ) {}

  async process(level: number, ctx: DrillContext): Promise<DrillItem[]> {
    switch (level) {
      case 0: return this.level0_summary(ctx);
      case 1: return this.level1_decompose(ctx);
      case 2: return this.level2_mechanisms(ctx);
      case 3: return this.level3_contractMap(ctx);
      case 4: return this.level4_claimTrace(ctx);
      case 5: return this.level5_patterns(ctx);
      case 6: return this.level6_counterfactual(ctx);
      case 7: return this.level7_risk(ctx);
      case 8: return this.level8_leverage(ctx);
      case 9: return this.level9_narrative(ctx);
      default: return [];
    }
  }

  // Assigns colors to items from the backend (which don't carry a color field)
  private addColors(items: Omit<DrillItem, "color">[]): DrillItem[] {
    const palette = [RED, AMBER, BLUE, PURPLE, GREEN, GOLD];
    return items.map((item, i) => ({ ...item, color: palette[i % palette.length] } as DrillItem));
  }

  // L0 — computed intelligence: totalLeakage, anomalyScore, topDriver from real data
  // Falls back to L1_SIGNALS if the endpoint is unavailable
  private async level0_summary(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const res  = await fetch(`/api/kiq-engine/l0-summary/${ctx.tile}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through */}
    return L1_SIGNALS[ctx.tile] ?? [];
  }

  // L1 — groupBy(claims, 'leakage_type'): group real data by leakage category
  // Falls back to AI KIQ Engine if real-data endpoint is unavailable
  private async level1_decompose(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const res  = await fetch(`/api/kiq-engine/l1-decompose/${ctx.tile}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 1,
      "Decompose the primary signal into its 4 root drivers. " +
      "Identify the component sources of financial exposure — named, quantified, categorized.");
  }

  // L2 — claims.map(c => ({ spread: planPaid-pharmacyPaid, rebateDelay: rebateDate-fillDate }))
  // Maps real data per entity to the two core mechanism fields.
  // Falls back to AI KIQ Engine if real-data endpoint unavailable.
  private async level2_mechanisms(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const res  = await fetch(`/api/kiq-engine/l2-mechanisms/${ctx.tile}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 2,
      "Map the operational mechanisms. Show HOW each driver manifests in the real system — " +
      "which actors, what transactions, what information asymmetry enables it.");
  }

  // L3 — mechanisms.map(m => ({...m, clause: matchClause(m), gap: detectAmbiguity(m)}))
  // Tries real contract-map endpoint first; falls back to AI KIQ Engine.
  private async level3_contractMap(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const url = new URL(`/api/kiq-engine/l3-contract-map/${ctx.tile}`, window.location.origin);
      if (ctx.ein) url.searchParams.set("ein", ctx.ein);
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 3,
      "Map each mechanism to its contractual basis. Show WHERE each driver is permitted, " +
      "silently absent, or ambiguously defined in the contract — cite specific clause numbers and exact language gaps.");
  }

  // L4 — claims.filter(c => c.anomalyScore > threshold)
  // When a company (EIN) is loaded, tries the real claim-trace endpoint first
  // (adjudicated rx_claims → DOL Schedule A evidence). With no company loaded,
  // skips straight to AI synthesis — the backend emits no fabricated rows.
  private async level4_claimTrace(ctx: DrillContext): Promise<DrillItem[]> {
    if (ctx.ein) {
      try {
        const url = new URL(`/api/kiq-engine/l4-claim-trace/${ctx.tile}`, window.location.origin);
        url.searchParams.set("ein", ctx.ein);
        const res  = await fetch(url.toString());
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json() as { items: Omit<DrillItem, "color">[] };
        if (data.items?.length) return this.addColors(data.items);
      } catch {/* fall through to AI */}
    }
    return this._call(ctx, 4,
      "Trace each mechanism to adjudicated claims data. Show NDC-level pricing variance, " +
      "anomaly scores per record, spread patterns per claim. Evidence first, conclusions second.");
  }

  // L5 — { frequency: calcFrequency(), clusters: clusterClaims(), timing: analyzeTimeSeries() }
  // Tries real pattern-detection endpoint first; falls back to AI KIQ Engine.
  private async level5_patterns(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const url = new URL(`/api/kiq-engine/l5-patterns/${ctx.tile}`, window.location.origin);
      if (ctx.ein) url.searchParams.set("ein", ctx.ein);
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 5,
      "Detect behavioral patterns. Is this isolated or systemic? " +
      "Show frequency (calcFrequency), geographic/entity clusters (clusterClaims), and time-series trend (analyzeTimeSeries). Verdict last.");
  }

  // L6 — claims.map(c => ({actual: c.planPaid, expected: nadacPrice(c), delta: c.planPaid - nadacPrice(c)}))
  // Tries real counterfactual endpoint first; falls back to AI KIQ Engine.
  private async level6_counterfactual(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const url = new URL(`/api/kiq-engine/l6-counterfactual/${ctx.tile}`, window.location.origin);
      if (ctx.ein) url.searchParams.set("ein", ctx.ein);
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 6,
      "Model the counterfactual. For each record: actual = planPaid, expected = nadacPrice (benchmark), delta = actual − expected. " +
      "Quantify exact recoverable delta in dollars. Aggregate total at the end.");
  }

  // L7 — { fiduciaryRisk: scoreERISAExposure(), auditFailureProbability: modelAuditRisk() }
  // scoreERISAExposure(): §404 liability = delta × years_uncorrected × 1.5
  //                       §406 excise    = delta × 0.20
  // modelAuditRisk():     P(failure) = anomalyScore × freq × recency_factor
  // Tries real endpoint first; falls back to AI KIQ Engine.
  private async level7_risk(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const url = new URL(`/api/kiq-engine/l7-risk/${ctx.tile}`, window.location.origin);
      if (ctx.ein) url.searchParams.set("ein", ctx.ein);
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 7,
      "Assess fiduciary risk and legal exposure using two scores: " +
      "(1) scoreERISAExposure() — §404 duty-of-prudence liability (delta × years × 1.5) and §406 prohibited-transaction excise (delta × 20%). " +
      "(2) modelAuditRisk() — P(DOL audit failure) = anomalyScore × frequency × recency_factor. " +
      "Return dollar figures for §404 exposure, §406 excise, audit probability %, expected penalty, and total risk verdict.");
  }

  // L8 — { contractFixes: generateClauses(), rfpTriggers: identifyTriggers(), negotiationPoints: buildPlaybook() }
  // generateClauses():     ranked clause rewrites by financial unlock fraction
  // identifyTriggers():    4-condition RFP readiness check → triggers_met/4
  // buildPlaybook():       demand→audit→RFP→renegotiation sequenced with timing + $
  // Tries real endpoint first; falls back to AI KIQ Engine.
  private async level8_leverage(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const url = new URL(`/api/kiq-engine/l8-leverage/${ctx.tile}`, window.location.origin);
      if (ctx.ein) url.searchParams.set("ein", ctx.ein);
      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 8,
      "Identify strategic leverage points using three functions: " +
      "(1) generateClauses() — list the specific contract clauses to rewrite, ranked by dollar unlock, with exact replacement language. " +
      "(2) identifyTriggers() — evaluate 4 RFP conditions: quantified leakage, contract weakness, market alternatives, contract timing. Return triggers_met/4. " +
      "(3) buildPlaybook() — sequence 4 actions with timing: demand letter (Day 0–30), NDC audit request (Day 30–60), RFP issuance (Day 60–90), contract renegotiation (Renewal). Dollar recovery per step.");
  }

  // L9 — generateExecutiveBrief({ financialImpact, rootCause, risk, action })
  // Aggregates all prior levels into 4 C-Suite brief fields:
  //   financialImpact: total_delta + §404 ERISA exposure + expected penalty
  //   rootCause:       top mechanism (L1) + enabling clause gap (L3)
  //   risk:            P(audit failure) + §404/§406 statute citations
  //   action:          3-step 90-day sequence with per-step $ recovery
  // Tries real endpoint first; falls back to AI KIQ Engine.
  private async level9_narrative(ctx: DrillContext): Promise<DrillItem[]> {
    try {
      const res  = await fetch(`/api/kiq-engine/l9-synthesis/${ctx.tile}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { items: Omit<DrillItem, "color">[] };
      if (data.items?.length) return this.addColors(data.items);
    } catch {/* fall through to AI */}
    return this._call(ctx, 9,
      "Generate an executive brief with exactly 4 fields using generateExecutiveBrief(): " +
      "(1) financialImpact — total recoverable delta, §404 ERISA exposure (delta × years × 1.5), §406 excise (delta × 20%), expected penalty. Dollar-specific. " +
      "(2) rootCause — the top mechanism by dollar magnitude, the specific contract clause that permits it, and the exact language gap. " +
      "(3) risk — DOL audit failure probability, ERISA §404(a)(1)(B) and §406(a) statute citations, years uncorrected. " +
      "(4) action — 3-step 90-day sequence: §408(b)(2) demand (Day 0–30), NDC audit request (Day 30–60), RFP issuance (Day 60–90). Per-step dollar recovery. Non-negotiable, no hedging.");
  }

  // Shared fetch — builds a dimension-enriched topic string and calls the API
  private _call(ctx: DrillContext, level: number, instruction: string): Promise<DrillItem[]> {
    const dimension = LEVEL_DIMENSION[level] ?? "analysis";
    const pathStr   = ctx.pathLabels.length ? ctx.pathLabels.join(" → ") : "root";
    const topic     = `${this.tileLabel} · ${pathStr} [L${level}: ${dimension.toUpperCase()}] — ${instruction}`;
    return this.fetch(topic, ctx, level);
  }
}

const L1_SIGNALS: Record<string, DrillItem[]> = {
  financial_exposure: [
    { id: "spread",   label: "Spread Pricing",        value: "$7.2M", delta: "+31%",  color: RED,    severity: "CRITICAL", desc: "PBM retaining difference between ingredient cost and plan-paid price — not disclosed, not contractually defined.", findings: ["MAC list not linked to published benchmark", "Avg 12–18% spread above NADAC on 40+ generics", "No contractual spread elimination clause"], action: "Demand ingredient cost passthrough at adjudication. Add MAC anchor clause at renewal." },
    { id: "rebate",   label: "Rebate Misalignment",   value: "$3.1M", delta: "+18%",  color: AMBER,  severity: "HIGH",     desc: "Rebates retained by PBM, not passed through at adjudication — delayed 90–120 days with no reconciliation audit right.", findings: ["Rebate timing undefined in contract", "No per-claim rebate visibility", "Reconciliation settlement allows retention of timing gains"], action: "Force rebate passthrough at adjudication, not reconciliation. Add per-claim rebate reporting." },
    { id: "specialty", label: "Specialty Inflation",   value: "$1.6M", delta: "+44%",  color: AMBER,  severity: "HIGH",     desc: "Specialty drug costs exceeding NADAC and WAC benchmarks — no formulary management protocol in contract.", findings: ["Specialty PMPM above peer benchmark by 44%", "No step therapy or PA criteria for specialty class", "GLP-1 driving disproportionate spend concentration"], action: "Implement specialty formulary PA criteria. Add NADAC benchmark anchor for specialty class." },
    { id: "admin",    label: "Admin Fee Leakage",      value: "$0.5M", delta: "+12%",  color: BLUE,   severity: "MEDIUM",   desc: "Undisclosed administrative fees embedded in claims processing and remittance — not visible in 408(b)(2) disclosure.", findings: ["Admin fees bundled into PMPM — not itemized", "No fee-for-service schedule in contract", "408(b)(2) disclosure incomplete on admin components"], action: "Demand itemized fee-for-service schedule. File 408(b)(2) disclosure demand." },
    { id: "dir",      label: "DIR Fee Retention",      value: "$0.9M", delta: "+27%",  color: AMBER,  severity: "HIGH",     desc: "Direct & Indirect Remuneration fees clawed back from pharmacies post-adjudication — retained by PBM rather than passed through to plan.", findings: ["DIR fees not contractually defined as plan asset", "$0.9M retained over trailing 12 months — confirmed via 5500 Schedule A", "No DIR reconciliation report delivered to plan sponsor"], action: "Reclassify DIR fees as plan assets in contract amendment. Demand quarterly DIR reconciliation report with full pharmacy-level detail." },
  ],
  contract_integrity: [
    { id: "passthrough", label: "Pass-Through Definition", value: "ABSENT",    delta: "Critical Gap",  color: RED,    severity: "CRITICAL", desc: "Contract does not define or mandate real-time rebate passthrough — enabling PBM to retain timing arbitrage.", findings: ["No pass-through definition in §3 or §7", "Reconciliation clause allows 120-day delay", "No consequence for non-pass-through"], action: "Add explicit passthrough language: 'Rebates shall pass through at point of adjudication, not reconciliation.'" },
    { id: "audit",       label: "Audit Rights",          value: "LIMITED",   delta: "High Risk",     color: AMBER,  severity: "HIGH",     desc: "Audit rights restricted to summary data — no NDC-level access, no formulary management visibility, no rebate reconciliation audit right.", findings: ["Audit limited to aggregate summary reports", "NDC-level claim audit not permitted under current contract", "Rebate reconciliation not subject to independent audit"], action: "Demand full NDC-level audit right. Add independent auditor provision with 36-month lookback." },
    { id: "formulary",   label: "Formulary Control",     value: "AMBIGUOUS", delta: "Medium Risk",    color: AMBER,  severity: "HIGH",     desc: "Formulary management rights unclear — PBM retains unilateral control of tier placement, PA criteria, and specialty formulary.", findings: ["Plan sponsor formulary approval right not in contract", "PA criteria set by PBM — no fiduciary review clause", "Specialty tier placement changed without notice in prior year"], action: "Add formulary governance clause. Require plan sponsor approval for specialty tier changes." },
    { id: "rebatetime",  label: "Rebate Timing Clause",  value: "MISSING",   delta: "Critical",      color: RED,    severity: "CRITICAL", desc: "No defined timing for rebate reconciliation or passthrough — allowing PBM to retain float and timing gains indefinitely.", findings: ["No rebate settlement timing in contract", "Industry standard: 30-day post-quarter settlement", "Estimated $180K/yr in timing arbitrage retained by PBM"], action: "Add §X.Y: 'Rebates shall be settled no later than 30 days following each calendar quarter.'" },
    { id: "termination", label: "Termination Rights",    value: "PUNITIVE",  delta: "Renewal Trap",   color: AMBER,  severity: "HIGH",     desc: "Termination-without-cause clause requires 18-month notice plus run-out fees — designed to block competitive RFP execution.", findings: ["18-month termination notice — 3× industry standard", "Run-out claims fee structure favors PBM retention", "No mid-term termination right for material performance breach"], action: "Renegotiate to 90-day termination right plus standard run-out. Add performance-breach termination trigger tied to passthrough and audit clauses." },
  ],
  operational_behavior: [
    { id: "qespike",   label: "Quarter-End Spike",          value: "78%",    delta: "+23pp vs avg",  color: RED,    severity: "CRITICAL", desc: "Spread pricing concentration peaks at quarter-end across specialty claims — consistent with PBM revenue optimization behavior.", findings: ["78% of specialty spread claims occur in final 2 weeks of quarter", "Pattern consistent across 4 quarters", "No clinical driver — purely administrative"], action: "Flag quarter-end claim clusters for audit. Demand explanation from PBM account manager." },
    { id: "specialty", label: "Specialty Concentration",    value: "$6.1M",  delta: "49% of spend",  color: AMBER,  severity: "HIGH",     desc: "Specialty drug spend disproportionate to plan size — concentrated in 12 NDCs representing 49% of total pharmacy budget.", findings: ["Top 12 NDCs = 49% of Rx spend", "No biosimilar substitution protocol active", "Specialty concentration 2.1× peer benchmark"], action: "Implement biosimilar substitution protocol. Require specialty PA criteria for top-12 NDCs." },
    { id: "network",   label: "Pharmacy Network Variance",  value: "2.1×",   delta: "vs avg",        color: AMBER,  severity: "HIGH",     desc: "Retail vs. mail-order pricing gap exceeds peer benchmarks by 2.1× — indicating network design or reimbursement structure issues.", findings: ["Mail vs. retail PMPM variance 2.1× industry average", "No mail-order mandate for maintenance drugs", "Preferred pharmacy designation not contractually enforced"], action: "Mandate 90-day mail-order for maintenance drugs. Add preferred pharmacy reimbursement schedule." },
    { id: "pa",        label: "Prior Auth Manipulation",    value: "34%",    delta: "Override rate",  color: PURPLE, severity: "MEDIUM",   desc: "34% of specialty prior auth denials overridden by prescriber appeal — indicating PA criteria designed to generate appeal volume.", findings: ["34% PA override rate — 3× industry norm", "Overrides concentrated in GLP-1 and specialty oncology", "No clinical override documentation required"], action: "Audit PA criteria against clinical guidelines. Require structured override documentation." },
    { id: "mailorder", label: "Mail-Order Channel Steering", value: "62%",   delta: "+19pp vs peers", color: BLUE,   severity: "MEDIUM",   desc: "Members aggressively steered toward PBM-owned mail-order pharmacy regardless of clinical or cost benefit — pricing premium captured invisibly.", findings: ["62% of maintenance scripts auto-routed to PBM mail-order", "Mail-order pricing 14% above retail-equivalent benchmark", "Member opt-out workflow buried — 8 clicks vs. industry 2"], action: "Require channel-neutral pricing parity. Add member opt-out simplification clause with single-click defaults." },
  ],
  strategic_leverage: [
    { id: "rewrite",  label: "Contract Rewrite Targets",  value: "11 Clauses", delta: "High value",  color: GOLD,   severity: "HIGH",    desc: "11 specific contract provisions identified as requiring renegotiation — each with quantified financial and fiduciary impact.", findings: ["3 CRITICAL clauses (missing: passthrough, audit, timing)", "5 HIGH clauses (ambiguous: formulary, PA, benchmarks)", "3 MEDIUM clauses (inadequate: reporting, termination, indemnity)"], action: "Prioritize 3 CRITICAL clauses for immediate demand letter. Package remaining 8 for renewal negotiation." },
    { id: "rfp",      label: "RFP Trigger Points",        value: "3 Active",  delta: "Ready now",   color: GREEN,  severity: "HIGH",    desc: "3 market conditions met that justify immediate PBM RFP issuance — competitive market, contract weakness, and quantified leakage.", findings: ["PBM market: 4 national alternatives with pass-through models", "Current contract expires within 18 months", "$12.4M annual leakage creates strong competitive negotiation position"], action: "Issue PBM RFP immediately. Require pass-through pricing model as mandatory RFP requirement." },
    { id: "vendor",   label: "Vendor Pressure Points",    value: "5 Levers",  delta: "Identified",  color: BLUE,   severity: "MEDIUM",  desc: "5 audit demands and disclosure requests that create immediate negotiating leverage without requiring contract termination.", findings: ["§408(b)(2) disclosure demand — legally required within 30 days", "NDC-level audit request — creates claim-level accountability", "Rebate reconciliation demand — forces PBM to document retention"], action: "Issue 3-letter demand sequence: disclosure → audit → reconciliation. Creates PBM accountability without litigation." },
    { id: "audit",    label: "Audit Demand Levers",       value: "$18.6M",   delta: "Recoverable",  color: GOLD,   severity: "HIGH",    desc: "Total recoverable value if all audit rights, renegotiation targets, and leverage points are executed with Kincaid IQ methodology.", findings: ["$7.2M spread pricing (recoverable via contract rewrite)", "$3.1M rebate realignment (recoverable via RFP)", "$8.3M residual from formulary + admin + timing gaps"], action: "Initiate 90-day Kincaid IQ recovery sequence: demand → audit → RFP → negotiation → settlement." },
    { id: "coalition", label: "Coalition Negotiation Power", value: "4 Peers", delta: "Cohort ready", color: PURPLE, severity: "MEDIUM",  desc: "4 peer plan sponsors with identical PBM and comparable spend profile identified — coalition RFP achieves enterprise pricing tier unavailable to single-employer issuance.", findings: ["Coalition cohort: 4 peers, combined 28,000 lives, $84M combined Rx spend", "Enterprise tier pricing typically 9–14% better than single-employer", "Coalition RFP shortens vendor evaluation cycle by ~6 weeks"], action: "Convene coalition kickoff within 14 days. Issue joint RFP with shared evaluation framework. Negotiate as cohort while retaining single-employer contracting flexibility." },
  ],
};

// ─── Narrative scripts per tile + level ──────────────────────────────────────

const NARRATIVE: Record<string, string[]> = {
  financial_exposure: [
    "Select a tile to begin the intelligence drill.",
    "Financial Exposure Detected. The plan is bleeding money across four distinct mechanisms — spread pricing, rebate misalignment, specialty inflation, and embedded admin fees. Each operates independently, but together they represent a coordinated extraction architecture.",
    "Now we see the mechanics. Spread pricing works by the PBM paying pharmacies less than they charge the plan — pocketing the difference invisibly. Rebate misalignment delays passthrough by 90–120 days to retain float. These are not accidents. They are features of PBM contract design.",
    "The contract is the permission slip. Every extraction mechanism identified traces back to language that either permits the behavior, fails to prohibit it, or deliberately obscures it. §3 has no passthrough definition. §7 has no audit right. This is structural, not accidental.",
    "Here are the claims. These are real transactions — NDC codes, pharmacies, paid amounts, benchmark comparisons. The spread isn't theoretical. Walgreens filled this specialty Rx at $4,200. The plan paid $4,200. NADAC says it costs $1,900. The PBM kept the difference.",
    "This is systemic, not isolated. 78% of specialty claims show this pattern. It spikes at quarter-end every quarter for 4 years. This isn't a data error. It's a revenue optimization strategy running inside your health plan.",
    "What should have happened. Under a transparent pricing model, total annual spend would have been $9.2M. Actual spend: $12.4M. The $3.2M gap is the model — the counterfactual that makes this recoverable and defensible in front of a board.",
    "The legal consequence. ERISA §404 requires fiduciaries to act in the sole interest of plan participants. Allowing undisclosed PBM extraction — when evidence is available — creates personal liability for plan trustees. The GC needs to see this slide.",
    "Three levers create immediate pressure: (1) §408(b)(2) demand — legally required within 30 days. (2) NDC audit request — creates claim-level accountability. (3) RFP issuance — the market has 4 pass-through PBMs ready to bid.",
    "The PBM is extracting $12.4M annually through spread pricing and delayed rebate passthrough, enabled by ambiguous contract language and no audit rights.\n\nImpact: $18.6M 3-year exposure\nRisk: ERISA fiduciary breach if not remediated\nAction: Immediate RFP with mandatory pass-through pricing model",
  ],
  contract_integrity: [
    "Select a tile to begin the intelligence drill.",
    "Contract Integrity at Risk. 23 contractual gaps identified — 4 critical, 11 high, 8 medium. Each gap is a permission structure enabling PBM extraction. None were disclosed during contracting.",
    "The mechanism is silence. Contracts don't authorize extraction explicitly — they simply fail to prohibit it. No passthrough definition = PBM can retain spread. No audit right = no way to prove it. No timing clause = float is free money.",
    "Clause-by-clause. §3.2: no passthrough defined. §7.1: audit right limited to summary. §9.4: rebate settlement timing unspecified. These aren't oversights. They're drafted this way by PBM legal teams who write thousands of these contracts per year.",
    "Contract gaps in practice. This claim was filed under a formulary tier the PBM changed without notice. This is legal under the current contract — §11 gives PBM unilateral formulary control. The cost difference: $240 per claim, $180K annually.",
    "These gaps recur systematically. Every PBM contract in our database with no passthrough definition shows the same spread pricing pattern. Causation confirmed: missing clause → extraction behavior → quantified leakage.",
    "What the contract should say. 'Rebates shall pass through at adjudication.' 'Audit rights extend to NDC-level claim data.' 'PBM shall not retain spread between ingredient cost and plan-paid price.' Six sentences eliminate $12.4M in leakage.",
    "Fiduciary consequence. A plan trustee who executes a contract with known gap clauses — when evidence of extraction is available — may have breached their duty of prudence under ERISA §404(a)(1)(B). Board disclosure is recommended.",
    "Contract rewrite is the lever. 11 clauses, ranked by value. Three can be demanded immediately via letter. Eight can be negotiated at renewal. RFP creates competitive pressure that makes the PBM agree.",
    "The contract has 23 gaps enabling $12.4M annual extraction. Critical missing clauses: rebate passthrough, audit rights, timing definition.\n\nImpact: $18.6M recoverable over 3 years\nRisk: Fiduciary breach — known gaps, no remediation\nAction: Demand letter → contract rewrite → RFP as leverage",
  ],
  operational_behavior: [
    "Select a tile to begin the intelligence drill.",
    "Operational Anomalies Detected. The behavioral data reveals a pattern that isn't clinical — it's financial. Quarter-end spikes, specialty concentration, and prior auth override rates all point to a single source: PBM revenue optimization running inside plan operations.",
    "The mechanism is timing. PBM administrative systems are designed to maximize revenue per quarter. Specialty claims are held and released in patterns that maximize spread capture. This is operational, not clinical — the drug didn't change, only the processing timing.",
    "The contract allows it. No prohibition on claim timing manipulation. No requirement for real-time processing. No penalty for quarter-end concentration. The operational behavior is enabled by the same contract gaps that allow financial extraction.",
    "Real claim timing evidence. February 14: specialty Rx filled. February 28: claim submitted. March 31: claim adjudicated. The 45-day delay is not accidental — it places this claim in Q1 end-of-quarter concentration window. $3,400 spread captured.",
    "Quarter-end spike confirmed as systemic. 78% of specialty spread claims occur in the final 2 weeks of each quarter — every quarter, for 4 years. Frequency: 312 claims/quarter in the spike window. Statistical significance: p < 0.001. This is not random.",
    "Counterfactual: real-time processing model. If claims were processed within 3 business days of fill date (industry standard), total spread impact drops by 34%. The timing game is worth $2.4M annually to the PBM — and nothing to the plan.",
    "Operational manipulation = fiduciary exposure. When a vendor deliberately times plan transactions to maximize their own revenue at the plan's expense, this meets the ERISA §406 definition of prohibited transaction if the plan trustee is aware and takes no action.",
    "The operational levers: (1) Require real-time claim adjudication in contract (within 3 business days). (2) Add quarter-end concentration audit trigger. (3) Demand prior-quarter claim timing report as standing deliverable.",
    "The PBM is timing specialty claim adjudication to maximize quarterly spread capture — generating $2.4M in timing-related extraction annually.\n\nImpact: $2.4M annual timing leakage\nRisk: Prohibited transaction exposure under ERISA §406\nAction: Require real-time adjudication + add quarter-end audit trigger",
  ],
  strategic_leverage: [
    "Select a tile to begin the intelligence drill.",
    "Three Leverage Triggers Identified. The market is ready for an RFP. The contract has documented weaknesses. The leakage is quantified. These three conditions rarely align — when they do, a plan sponsor with the right intelligence can recover years of extraction in a single negotiation cycle.",
    "Leverage works through credibility. The PBM negotiates with hundreds of plan sponsors. Most arrive without data. You arrive with NDC-level proof, clause-by-clause gap analysis, and a quantified leakage figure. That changes the dynamic entirely.",
    "The contract is your first leverage tool. A demand letter citing specific clause deficiencies — with legal authority and quantified impact — forces the PBM to respond. It creates a documented record that protects the fiduciary and positions the plan for recovery.",
    "Here is what a leverage conversation looks like in claims. You show the PBM account manager this claim: NDC X, paid $4,200, NADAC $1,900, spread $2,300, clause reference: none. Their options are: (1) admit the spread, (2) dispute the methodology, (3) fix the contract. All three serve the plan.",
    "Leverage is most powerful when it's systemic. One anomalous claim can be explained. 78% quarter-end concentration across 4 years, confirmed with NDC-level audit data, cannot be explained. That's the difference between a negotiating tactic and a fiduciary intervention.",
    "The RFP counterfactual. If this plan had issued an RFP 24 months ago with pass-through as a mandatory requirement, the winning bid would have eliminated spread pricing. Conservative estimate: $7.2M recovered over 24 months. The cost of the RFP: zero.",
    "Leverage creates legal protection. Executing the §408(b)(2) demand, the audit request, and the RFP creates a documented fiduciary process record. Even if the PBM doesn't move, the board is protected by demonstrated prudent process.",
    "The leverage sequence. Week 1: §408(b)(2) demand. Week 3: NDC audit request. Week 6: RFP issuance. Week 12: competitive bids in hand. Week 16: renegotiation from position of strength. Week 24: new contract with passthrough. Estimated recovery: $18.6M.",
    "Three triggers are live: market competition, contract weakness, quantified leakage. $18.6M is recoverable.\n\nImpact: $18.6M over 3 years\nRisk: Inaction = continued fiduciary exposure\nAction: Issue demand letter, audit request, and RFP within 30 days",
  ],
};

// ─── CommitResult type ────────────────────────────────────────────────────────

interface CommitResult {
  ein: string;
  edgar: { name: string; sic: number; state: string; city: string; revenue: number; net_income: number; assets: number; employees: number; period: string; sector: string };
  dol: { latest_year: number; plan_count: number; participants: number; total_income: number; total_fees: number; broker_commissions: number; welfare_premiums: number; carriers: string[]; has_health: boolean; has_stop_loss: boolean; has_drug: boolean; fee_per_participant: number; invest_fees: number; admin_fees: number; legal_fees: number; plan_details: any[] };
  fcr: { fcr_pct: number; sector_median_fcr: number; fcr_excess: number; recoverable: number; fee_per_participant: number; verdict: string };
  glp1: { risk_score: number; eligible_members: number; annual_exposure: number; exposure_3yr: number; intervention_savings: number; risk_tier: string };
  risk: { has_stop_loss_gap: boolean; carrier_risk: string; commission_pct: number };
  opportunity: { fee_recovery_commission: number; glp1_commission: number; total_first_year: number; three_year_value: number };
  gates: Record<string, { status: string; score: number; note: string }>;
  go_count: number; composite_score: number;
  history: { year: number; participants: number; fees: number; broker: number; plan_count: number; fee_delta_pct?: number }[];
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ─── Ticker tape ──────────────────────────────────────────────────────────────

interface MarketQuote { symbol: string; price: number; change_pct: number; name: string }

function TickerTape({ quotes }: { quotes: MarketQuote[] }) {
  const items = [...quotes, ...quotes, ...quotes];
  return (
    <div className="relative overflow-hidden h-8 flex items-center shadow-sm"
      style={{ background: "rgba(255, 255, 255, 0.8)", borderBottom: "1px solid rgba(0, 37, 80, 0.08)" }}>
      <div className="absolute left-0 z-10 h-full w-16 pointer-events-none"
        style={{ background: "linear-gradient(to right, #ffffff, transparent)" }} />
      <div className="absolute right-0 z-10 h-full w-16 pointer-events-none"
        style={{ background: "linear-gradient(to left, #ffffff, transparent)" }} />
      <div className="flex gap-8 animate-[ticker_40s_linear_infinite] whitespace-nowrap px-4">
        {items.map((q, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-[var(--kiq-muted)] font-semibold">{q.symbol}</span>
            <span className="text-[var(--kiq-ink-soft)] font-medium">{q.price.toFixed(2)}</span>
            <span style={{ color: q.change_pct >= 0 ? GREEN : RED }} className="font-bold">
              {q.change_pct >= 0 ? "▲" : "▼"} {Math.abs(q.change_pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-33.333%) } }`}</style>
    </div>
  );
}

// ─── Severity chip ────────────────────────────────────────────────────────────

function SevChip({ s }: { s: DrillItem["severity"] }) {
  const cls = s === "CRITICAL" ? "text-red-700 bg-red-50/80 border-red-200/60"
    : s === "HIGH"     ? "text-orange-700 bg-orange-50/80 border-orange-200/60"
    : s === "MEDIUM"   ? "text-amber-700 bg-amber-50/80 border-amber-200/60"
    : "text-emerald-700 bg-emerald-50/80 border-emerald-200/60";
  return <span className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded border ${cls}`}>{s}</span>;
}

// ─── Level badge ──────────────────────────────────────────────────────────────

function LevelBadge({ level, active }: { level: number; active?: boolean }) {
  const m = LEVEL_META[level];
  return (
    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
      style={{ background: active ? `${m.color}15` : "rgba(0, 37, 80, 0.03)", color: active ? m.color : "var(--kiq-subtle)", border: `1px solid ${active ? m.color + "30" : "rgba(0, 37, 80, 0.08)"}` }}>
      L{level}
    </span>
  );
}

// ─── Path ─────────────────────────────────────────────────────────────────────
// Breadcrumb showing the full drill path: Financial → Spread → MAC → Clause 7.3
// Each segment is clickable — navigates back to that level.

function Path({
  tileId, pathLabels, depth, onGoToLevel, onClose,
}: {
  tileId: string | null; pathLabels: string[]; depth: number;
  onGoToLevel: (idx: number) => void; onClose: () => void;
}) {
  if (!tileId) return null;
  const tile = BASE_TILES.find(t => t.id === tileId)!;

  // All segments: tile title + each drill label
  const segments = [tile.title, ...pathLabels];

  return (
    <div className="flex items-center gap-0 flex-wrap py-3 px-5 border-b"
      style={{ borderColor: "rgba(0, 37, 80, 0.08)", background: "rgba(0, 37, 80, 0.02)" }}>

      {/* Close */}
      <button onClick={onClose} className="text-[var(--kiq-muted)] hover:text-[var(--kiq-ink-soft)] transition-colors mr-3">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Path: Segment → Segment → … */}
      {segments.map((seg, i) => {
        const isCurrent = i === depth;
        const isLast    = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center">
            <button
              onClick={() => onGoToLevel(i)}
              className="text-[10px] font-mono font-bold uppercase tracking-wider transition-colors hover:text-[var(--kiq-ink-soft)] truncate max-w-[140px]"
              style={{ color: isCurrent ? tile.color : "var(--kiq-muted)" }}>
              {seg}
            </button>
            {!isLast && (
              <span className="mx-2 text-[10px] font-mono select-none text-[var(--kiq-subtle)]">→</span>
            )}
          </span>
        );
      })}

      {/* Right: level label + dots + badge */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[9px] font-mono text-[var(--kiq-muted)]">{LEVEL_META[depth]?.label}</span>
        <div className="flex gap-1">
          {LEVEL_META.slice(1).map((m, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ background: i + 1 <= depth ? tile.color : "rgba(0, 37, 80, 0.08)", opacity: i + 1 === depth ? 1 : 0.4 }} />
          ))}
        </div>
        <LevelBadge level={depth} active />
        <span className="text-[8px] font-mono text-[var(--kiq-muted)]">/ 9</span>
      </div>
    </div>
  );
}

// ─── MiniHistoryChart ─────────────────────────────────────────────────────────
// Compact multi-year plan-history visual: fees as bars, participants as an
// overlaid line on a secondary axis. Renders the real Form 5500 filing history
// returned by the Commit Engine. Falls back to null when there is no history.

function MiniHistoryChart({
  data,
  color,
  height = 96,
}: {
  data: { year: number; fees: number; participants: number }[];
  color: string;
  height?: number;
}) {
  if (!data || data.length < 2) return null;

  const fmtAxis = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B`
      : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M`
      : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K`
      : `$${n}`;

  return (
    <div data-testid="chart-fee-history" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#71717a", fontSize: 9, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="fees"
            tick={{ fill: "#71717a", fontSize: 8, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={fmtAxis}
            width={40}
          />
          <YAxis yAxisId="part" orientation="right" hide />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "rgba(12,12,14,0.96)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              fontSize: 10,
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(val: number, name: string) =>
              name === "fees"
                ? [fmtAxis(val), "Total Fees"]
                : [val.toLocaleString(), "Participants"]
            }
          />
          <Bar yAxisId="fees" dataKey="fees" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={color} fillOpacity={0.35 + (0.5 * i) / Math.max(1, data.length - 1)} />
            ))}
          </Bar>
          <Line
            yAxisId="part"
            type="monotone"
            dataKey="participants"
            stroke="#00d4ff"
            strokeWidth={1.5}
            dot={{ r: 2, fill: "#00d4ff" }}
            activeDot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-3 mt-1">
        <span className="flex items-center gap-1 text-[8px] font-mono text-zinc-500">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} /> Fees
        </span>
        <span className="flex items-center gap-1 text-[8px] font-mono text-zinc-500">
          <span className="inline-block w-2.5 h-px" style={{ background: "#00d4ff" }} /> Participants
        </span>
      </div>
    </div>
  );
}

// ─── Drill Canvas — level-specific renderers ──────────────────────────────────

// ─── DrillNode ────────────────────────────────────────────────────────────────
// Canonical clickable node used throughout the drill canvas.
// Props: label (item.label), value (item.value), onClick — plus DrillItem data.
// variant="grid"  → 2-column L1 card layout  (large value, Investigate CTA)
// variant="list"  → full-width list layout   (inline value+label, chevron)

function DrillNode({ item, onClick, depth = 1, variant = "list" }: {
  item: DrillItem;
  onClick: () => void;
  depth?: number;
  variant?: "grid" | "list";
}) {
  const { label, value, color, severity, delta, desc, action } = item;

  if (variant === "grid") {
    return (
      <motion.button
        data-testid={`drill-l1-${item.id}`}
        onClick={onClick}
        whileHover={{ y: -2, scale: 1.005 }}
        whileTap={{ scale: 0.98 }}
        className="text-left rounded-xl p-4 transition-all shadow-sm"
        style={{ background: "#ffffff", border: `1px solid rgba(0, 37, 80, 0.08)` }}>
        <div className="flex items-center justify-between mb-2.5">
          <SevChip s={severity} />
          <span className="text-[9px] font-mono" style={{ color: `${color}bb` }}>{delta}</span>
        </div>
        <div className="text-2xl font-semibold mb-1 tabular-nums" style={{ color: "var(--kiq-ink)", fontFamily: "var(--font-sans)" }}>{value}</div>
        <div className="text-[11px] font-semibold text-[var(--kiq-ink-soft)] mb-1.5">{label}</div>
        <div className="text-[10px] text-[var(--kiq-muted)] leading-relaxed line-clamp-2 mb-3">{desc}</div>
        {item.chart && item.chart.length >= 2 && (
          <div className="mb-3 -mx-1">
            <div className="text-[8px] font-mono text-[var(--kiq-subtle)] uppercase tracking-[0.18em] mb-1 px-1">
              Plan Filing History — {item.chart[0].year}–{item.chart[item.chart.length - 1].year}
            </div>
            <MiniHistoryChart data={item.chart} color={color} />
          </div>
        )}
        <div className="flex items-center gap-1 text-[9px] font-mono font-bold" style={{ color }}>
          <ChevronRight className="w-3 h-3" /> Investigate
        </div>
      </motion.button>
    );
  }

  return (
    <motion.button
      data-testid={`drill-l${depth}-${item.id}`}
      onClick={onClick}
      whileHover={{ x: 2, background: "rgba(255, 255, 255, 0.95)" }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{ background: "rgba(255, 255, 255, 0.7)", border: "1px solid rgba(0, 37, 80, 0.06)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <SevChip s={severity} />
            <span className="text-[9px] font-mono" style={{ color: `${color}bb` }}>{delta}</span>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--kiq-ink)" }}>{value}</span>
            <span className="text-[11px] font-semibold text-[var(--kiq-ink-soft)]">{label}</span>
          </div>
          <div className="text-[10px] text-[var(--kiq-muted)] leading-relaxed">{desc}</div>
          {action && depth >= 7 && (
            <div className="mt-2 text-[10px] font-medium rounded px-2.5 py-1.5 inline-block"
              style={{ background: `${color}12`, color, border: `1px solid ${color}25` }}>
              {action}
            </div>
          )}
        </div>
        {depth < 9 && (
          <div className="flex-shrink-0 mt-1">
            <ChevronRight className="w-4 h-4" style={{ color: `${color}77` }} />
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── L1 Canvas ────────────────────────────────────────────────────────────────

function L1Canvas({ items, onSelect, tileColor }: { items: DrillItem[]; onSelect: (item: DrillItem) => void; tileColor: string }) {
  return (
    <div>
      <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em] mb-4 px-1">
        Signal Decomposition — click a driver to drill deeper
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const spanFull = isLast && items.length % 2 === 1;
          return (
            <div key={item.id} className={spanFull ? "col-span-2" : ""}>
              <DrillNode item={item} onClick={() => onSelect(item)} depth={1} variant="grid" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared loading skeleton ──────────────────────────────────────────────────

function LevelLoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "rgba(255,255,255,0.04)", height: 72 }} />
      ))}
    </div>
  );
}

function LevelEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <Cpu className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
      <div className="text-xs text-zinc-600 font-mono">KIQ Engine generating {label} analysis…</div>
    </div>
  );
}

function LevelHeader({ depth }: { depth: number }) {
  const meta = LEVEL_META[depth];
  const LIcon = meta?.icon ?? Target;
  return (
    <div className="flex items-center gap-2 mb-5 px-1">
      <LIcon className="w-3.5 h-3.5" style={{ color: meta?.color }} />
      <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
        {meta?.label} — {meta?.question}
      </span>
    </div>
  );
}

// ─── Copy-as-Slide shared utilities ───────────────────────────────────────────
// Every drill level can be exported to a board deck as a rich HTML table (with a
// markdown fallback). The clipboard logic, button UI, and slide builder are
// factored here so each LevelCanvas reuses them instead of duplicating per level.

type SlideColumn = { header: string; get: (item: DrillItem, idx: number) => string };

function buildDrillSlide(opts: {
  title: string;
  items: DrillItem[];
  columns: SlideColumn[];
  accent: string;
  footer?: string;
}): { markdown: string; html: string } {
  const { title, items, columns, accent, footer } = opts;
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const cell = (it: DrillItem, c: SlideColumn, idx: number) => (c.get(it, idx) ?? "").trim();

  const headerRow = `| ${columns.map(c => c.header).join(" | ")} |`;
  const sepRow = `| ${columns.map(() => "---").join(" | ")} |`;
  const bodyRows = items
    .map((it, idx) => `| ${columns.map(c => cell(it, c, idx).replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`)
    .join("\n");

  const markdown =
    `# ${title}\n` +
    `_Kincaid IQ — CFO War Room · ${dateStr}_\n\n` +
    `${headerRow}\n${sepRow}\n${bodyRows}` +
    (footer ? `\n\n---\n${footer}` : "");

  const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:900px;color:#1a1a1a">` +
    `<h1 style="margin:0 0 4px;font-size:22px;color:#1a1a1a">${esc(title)}</h1>` +
    `<div style="font-size:11px;color:#888;margin-bottom:16px">Kincaid IQ — CFO War Room · ${esc(dateStr)}</div>` +
    `<table style="width:100%;border-collapse:collapse;font-size:12px">` +
    `<thead><tr style="background:${accent};color:#1a1a1a">` +
    columns.map(c => `<th style="text-align:left;padding:8px;border:1px solid rgba(0,0,0,0.12)">${esc(c.header)}</th>`).join("") +
    `</tr></thead><tbody>` +
    items
      .map((it, idx) =>
        `<tr style="background:${idx % 2 ? "#faf7f0" : "#ffffff"}">` +
        columns.map(c => `<td style="padding:8px;border:1px solid #eee;vertical-align:top">${esc(cell(it, c, idx))}</td>`).join("") +
        `</tr>`)
      .join("") +
    `</tbody></table>` +
    (footer ? `<div style="margin-top:12px;font-size:11px;color:#888">${esc(footer)}</div>` : "") +
    `</div>`;

  return { markdown, html };
}

// Per-level slide schema — picks the columns/title/footer that best summarize
// each drill canvas for a board deck.
// Per-level slide spec — title, the level's table columns, and footer.
// Shared by the clipboard slide (buildLevelSlide) and the PDF export so both
// stay in lockstep with one column definition per drill level.
function getLevelSlideSpec(depth: number, items: DrillItem[]): { title: string; columns: SlideColumn[]; footer: string } {
  const meta = LEVEL_META[depth];
  const title = meta?.label ?? `Drill Level ${depth}`;
  const footer = `${items.length} item${items.length !== 1 ? "s" : ""}${meta?.question ? ` · ${meta.question}` : ""}`;
  const joinDetail = (it: DrillItem) => [it.desc, it.findings?.[0]].filter(Boolean).join(" ");

  let columns: SlideColumn[];
  switch (depth) {
    case 2: // Mechanism View
      columns = [
        { header: "#", get: (_it, idx) => String(idx + 1) },
        { header: "Mechanism", get: it => it.label },
        { header: "Severity", get: it => it.severity },
        { header: "Value", get: it => [it.value, it.delta].filter(Boolean).join(" ") },
        { header: "How It Happens", get: joinDetail },
      ];
      break;
    case 3: // Contract Mapping
      columns = [
        { header: "Clause / Provision", get: it => it.label },
        { header: "Status", get: it => it.value },
        { header: "Gap Description", get: it => it.desc },
        { header: "Risk", get: it => it.severity },
      ];
      break;
    case 4: // Claims Trace
      columns = [
        { header: "Claim / Drug", get: it => it.label },
        { header: "Plan Paid", get: it => it.value },
        { header: "Benchmark", get: it => it.kpis?.[0]?.value ?? "NADAC" },
        { header: "Variance", get: it => it.delta || "—" },
        { header: "Severity", get: it => it.severity },
      ];
      break;
    case 5: // Pattern Detection
      columns = [
        { header: "Pattern Cluster", get: it => it.label },
        { header: "Frequency / Value", get: it => it.value },
        { header: "Severity", get: it => it.severity },
        { header: "Detail", get: it => it.desc },
      ];
      break;
    case 6: // Counterfactual Model
      columns = [
        { header: "Item", get: it => it.label },
        { header: "Actual", get: it => it.kpis?.[0]?.value ?? "—" },
        { header: "Expected", get: it => it.kpis?.[1]?.value ?? "Benchmark" },
        { header: "Recoverable Delta", get: it => it.value },
        { header: "Severity", get: it => it.severity },
      ];
      break;
    case 7: // Risk & Fiduciary
      columns = [
        { header: "Risk", get: it => it.label },
        { header: "Exposure", get: it => it.value },
        { header: "Severity", get: it => it.severity },
        { header: "Consequence", get: it => [it.desc, it.delta].filter(Boolean).join(" ") },
      ];
      break;
    default:
      columns = [
        { header: "Item", get: it => it.label },
        { header: "Value", get: it => [it.value, it.delta].filter(Boolean).join(" ") },
        { header: "Severity", get: it => it.severity },
        { header: "Detail", get: it => it.desc },
      ];
  }

  return { title, columns, footer };
}

function buildLevelSlide(depth: number, items: DrillItem[]): { markdown: string; html: string } {
  const { title, columns, footer } = getLevelSlideSpec(depth, items);
  return buildDrillSlide({ title, items, columns, accent: GOLD, footer });
}

function useCopySlide() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copySlide = async (slide: { markdown: string; html: string }) => {
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([slide.html], { type: "text/html" }),
            "text/plain": new Blob([slide.markdown], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(slide.markdown);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied as slide", description: "Paste into your board deck (rich formatting preserved)." });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };
  return { copied, copySlide };
}

function CopySlideButton({ depth, copied, onClick }: { depth: number; copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`button-copy-slide-l${depth}`}
      title="Copy this drill level as a slide for board decks"
      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold font-mono uppercase tracking-wider transition-all hover-elevate"
      style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}40` }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy as Slide"}
    </button>
  );
}

// Download the current drill level as a single-page branded PDF slide.
// Mirrors the level's clipboard slide (title + the level's table columns).
function LevelDownloadButton({ depth, items, companyName }: { depth: number; items: DrillItem[]; companyName?: string }) {
  const { toast } = useToast();
  const onClick = () => {
    try {
      const { title, columns, footer } = getLevelSlideSpec(depth, items);
      const accent = LEVEL_META[depth]?.color ?? GOLD;
      const rows = items.map((it, idx) => columns.map(c => (c.get(it, idx) ?? "").trim()));
      const date = new Date().toISOString().slice(0, 10);
      downloadSlideTablePDF({
        title,
        subtitle: `CFO War Room — ${title}${LEVEL_META[depth]?.question ? ` · ${LEVEL_META[depth].question}` : ""}`,
        columns: columns.map(c => c.header),
        rows,
        footer,
        companyName,
        accent,
        filename: `war-room-l${depth}-${date}.pdf`,
      });
      toast({ title: "Slide PDF downloaded", description: "Saved as a single-page slide — attach or archive it." });
    } catch {
      toast({ title: "Download failed", description: "Could not generate the slide PDF.", variant: "destructive" });
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`button-download-slide-l${depth}`}
      title={`Download this drill level as a PDF slide`}
      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold font-mono uppercase tracking-wider transition-all hover-elevate"
      style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}40` }}>
      <Download className="w-3 h-3" />
      Download PDF
    </button>
  );
}

// LevelHeader + Copy-as-Slide button row — used by every drill canvas (L2–L8).
function CanvasHeader({ depth, items, loading, buildSlide, extraActions }: {
  depth: number;
  items: DrillItem[];
  loading: boolean;
  buildSlide?: () => { markdown: string; html: string };
  extraActions?: React.ReactNode;
}) {
  const { copied, copySlide } = useCopySlide();
  return (
    <div className="flex items-center justify-between gap-2 mb-1">
      <div className="flex-1"><LevelHeader depth={depth} /></div>
      {!loading && items.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2">
          <CopySlideButton
            depth={depth}
            copied={copied}
            onClick={() => copySlide(buildSlide ? buildSlide() : buildLevelSlide(depth, items))}
          />
          {/* L8 supplies its own playbook PDF via extraActions; every other level
              gets the generic single-page slide PDF export. */}
          {extraActions ?? <LevelDownloadButton depth={depth} items={items} />}
        </div>
      )}
    </div>
  );
}

// ─── L2 Canvas — Mechanism View: step-flow ────────────────────────────────────
// Numbered vertical steps with connector lines, showing HOW each mechanism operates.

function L2Canvas({ items, loading, onSelect }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void }) {
  const reduced = useReducedMotion();
  return (
    <div>
      <CanvasHeader depth={2} items={items} loading={loading} />
      {loading ? <LevelLoadingSkeleton /> : items.length === 0 ? <LevelEmpty label="Mechanism View" /> : (
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-10 bottom-10 w-px"
            style={{ background: "linear-gradient(to bottom, rgba(255,184,0,0.4), rgba(0,212,255,0.1))" }} />
          <div className="space-y-3">
            {items.map((item, idx) => (
              <motion.button
                key={item.id}
                data-testid={`drill-l2-${item.id}`}
                onClick={() => onSelect(item)}
                {...enterMotion(reduced, {
                  initial: { opacity: 0, x: -16 },
                  animate: { opacity: 1, x: 0 },
                  transition: { delay: idx * 0.05, duration: 0.32, ease: [0.4, 0, 0.2, 1] },
                })}
                whileHover={reduced ? undefined : { x: 4 }}
                className="w-full text-left flex items-start gap-4 rounded-xl p-4 transition-all"
                style={{ background: `${item.color}0a`, border: `1px solid ${item.color}22` }}>
                {/* Step number badge */}
                <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-sm z-10"
                  style={{ background: `${item.color}20`, border: `2px solid ${item.color}55`, color: item.color }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-black text-white/90">{item.label}</span>
                    <SevChip s={item.severity} />
                    <span className="text-[9px] font-mono ml-auto" style={{ color: `${item.color}88` }}>{item.value}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{item.desc}</p>
                  {item.findings?.[0] && (
                    <div className="mt-2 text-[9px] font-mono px-2 py-1 rounded inline-block"
                      style={{ background: `${item.color}10`, color: `${item.color}bb`, border: `1px solid ${item.color}20` }}>
                      ↳ {item.findings[0]}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0 mt-2.5" style={{ color: `${item.color}44` }} />
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── L3 Canvas — Contract Mapping: clause table ───────────────────────────────
// Columns: Clause | Status badge | Gap description | Risk

function StatusBadge({ val }: { val: string }) {
  const upper = val.toUpperCase();
  const cfg = upper === "ABSENT"  ? { bg: "rgba(255,77,109,0.15)",  border: "rgba(255,77,109,0.4)",  text: "#FF4D6D" }
            : upper === "MISSING" ? { bg: "rgba(255,77,109,0.15)",  border: "rgba(255,77,109,0.4)",  text: "#FF4D6D" }
            : upper === "LIMITED" ? { bg: "rgba(255,184,0,0.12)",   border: "rgba(255,184,0,0.4)",   text: "#FFB800" }
            : upper === "AMBIGUOUS" ? { bg: "rgba(245,166,35,0.12)", border: "rgba(245,166,35,0.4)", text: "#F5A623" }
            : upper === "PRESENT" || upper === "DEFINED" ? { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.4)", text: "#10B981" }
            : { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.15)", text: "#aaa" };
  return (
    <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
      {val}
    </span>
  );
}

function L3Canvas({ items, loading, onSelect }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void }) {
  const reduced = useReducedMotion();
  return (
    <div>
      <CanvasHeader depth={3} items={items} loading={loading} />
      {loading ? <LevelLoadingSkeleton rows={5} /> : items.length === 0 ? <LevelEmpty label="Contract Mapping" /> : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_1fr_80px] gap-0 px-4 py-2.5"
            style={{ background: "rgba(0,212,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {["Clause / Provision", "Status", "Gap Description", "Risk"].map(h => (
              <span key={h} className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600">{h}</span>
            ))}
          </div>
          {/* Rows */}
          {items.map((item, idx) => (
            <motion.button
              key={item.id}
              data-testid={`drill-l3-${item.id}`}
              onClick={() => onSelect(item)}
              {...enterMotion(reduced, {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: idx * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] },
              })}
              whileHover={{ backgroundColor: `${item.color}0d` }}
              className="w-full text-left grid grid-cols-[1fr_100px_1fr_80px] gap-0 px-4 py-3 transition-all"
              style={{
                borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                background: "transparent",
              }}>
              <div>
                <div className="text-[11px] font-bold" style={{ color: item.color }}>{item.label}</div>
                {item.action && (
                  <div className="text-[9px] text-zinc-600 mt-0.5 truncate max-w-[180px]">{item.action.slice(0, 50)}…</div>
                )}
              </div>
              <div className="pt-0.5"><StatusBadge val={item.value} /></div>
              <div className="text-[9px] text-zinc-500 leading-relaxed pr-3">{item.desc.slice(0, 90)}{item.desc.length > 90 ? "…" : ""}</div>
              <div className="pt-0.5"><SevChip s={item.severity} /></div>
            </motion.button>
          ))}
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="mt-3 text-[9px] font-mono text-zinc-700 px-1">
          {items.filter(i => ["ABSENT","MISSING"].includes(i.value.toUpperCase())).length} critical gaps · click any row to drill into the claim record
        </div>
      )}
    </div>
  );
}

// ─── L4 Canvas — Claims Trace: evidence table ────────────────────────────────
// Columns: Claim / Drug | Paid | Benchmark | Variance | Severity

function L4Canvas({ items, loading, onSelect }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void }) {
  const reduced = useReducedMotion();
  return (
    <div>
      <CanvasHeader depth={4} items={items} loading={loading} />
      {loading ? <LevelLoadingSkeleton rows={5} /> : items.length === 0 ? <LevelEmpty label="Claims Trace" /> : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Table header */}
          <div className="grid grid-cols-[1.5fr_90px_90px_90px_80px] gap-0 px-4 py-2.5"
            style={{ background: "rgba(191,95,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {["Claim / Drug", "Plan Paid", "Benchmark", "Variance", "Severity"].map(h => (
              <span key={h} className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600">{h}</span>
            ))}
          </div>
          {/* Rows */}
          {items.map((item, idx) => {
            const isNeg = item.delta?.startsWith("+") || item.delta?.includes("above");
            return (
              <motion.button
                key={item.id}
                data-testid={`drill-l4-${item.id}`}
                onClick={() => onSelect(item)}
                {...enterMotion(reduced, {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: idx * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                })}
                whileHover={{ backgroundColor: `${item.color}0d` }}
                className="w-full text-left grid grid-cols-[1.5fr_90px_90px_90px_80px] gap-0 px-4 py-3 transition-all"
                style={{ borderBottom: idx < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: "transparent" }}>
                <div>
                  <div className="text-[11px] font-bold text-white/90">{item.label}</div>
                  <div className="text-[9px] text-zinc-600 mt-0.5 truncate max-w-[180px]">{item.findings?.[0] ?? item.desc.slice(0, 45)}</div>
                </div>
                <div className="text-[11px] font-mono font-bold" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[11px] font-mono text-zinc-400">{item.kpis?.[0]?.value ?? "NADAC"}</div>
                <div className="text-[11px] font-mono font-bold" style={{ color: isNeg ? RED : GREEN }}>
                  {item.delta || "—"}
                </div>
                <div className="pt-0.5"><SevChip s={item.severity} /></div>
              </motion.button>
            );
          })}
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="mt-3 flex items-center gap-4 text-[9px] font-mono text-zinc-700 px-1">
          <span>{items.filter(i => i.severity === "CRITICAL").length} critical anomalies</span>
          <span>·</span>
          <span>{items.length} records traced</span>
          <span>·</span>
          <span className="text-zinc-600">click any row to examine pattern</span>
        </div>
      )}
    </div>
  );
}

// ─── L5 Canvas — Pattern Detection: bar chart + frequency badges ──────────────

function parseNumber(v: string): number {
  const cleaned = v.replace(/[$,%M KBm]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  if (v.includes("M")) return n;
  if (v.includes("K")) return n / 1000;
  if (v.includes("B")) return n * 1000;
  return n;
}

function L5Canvas({ items, loading, onSelect }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void }) {
  const reduced = useReducedMotion();
  const chartData = items.map(item => ({
    name: item.label.length > 18 ? item.label.slice(0, 16) + "…" : item.label,
    value: parseNumber(item.value),
    color: item.color,
    raw: item,
  }));

  return (
    <div>
      <CanvasHeader depth={5} items={items} loading={loading} />
      {loading ? <LevelLoadingSkeleton rows={3} /> : items.length === 0 ? <LevelEmpty label="Pattern Detection" /> : (
        <div className="space-y-5">
          {/* Bar chart */}
          <div className="rounded-xl p-4" style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.12)" }}>
            <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-4">Frequency Distribution</div>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#444", fontSize: 8, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10, fontFamily: "monospace" }}
                    labelStyle={{ color: "#999" }}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}
                    isAnimationActive={!reduced} animationBegin={120} animationDuration={reduced ? 0 : 750} animationEasing="ease-out">
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Frequency badges — clickable to drill */}
          <div>
            <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-3 px-1">Pattern Clusters</div>
            <div className="flex flex-wrap gap-2">
              {items.map((item, idx) => (
                <motion.button
                  key={item.id}
                  data-testid={`drill-l5-${item.id}`}
                  onClick={() => onSelect(item)}
                  {...enterMotion(reduced, {
                    initial: { opacity: 0, scale: 0.8 },
                    animate: { opacity: 1, scale: 1 },
                    transition: { delay: 0.25 + idx * 0.05, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] },
                  })}
                  whileHover={reduced ? undefined : { scale: 1.04 }}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-left"
                  style={{ background: `${item.color}12`, border: `1px solid ${item.color}30` }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.label}</span>
                  <span className="text-[9px] font-mono text-zinc-500">{item.value}</span>
                  <SevChip s={item.severity} />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Systemic verdict */}
          {items.some(i => i.severity === "CRITICAL") && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(255,77,109,0.07)", border: "1px solid rgba(255,77,109,0.2)" }}>
              <Activity className="w-4 h-4 flex-shrink-0" style={{ color: RED }} />
              <div>
                <div className="text-[10px] font-bold" style={{ color: RED }}>Pattern Verdict: SYSTEMIC</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">
                  Multiple CRITICAL signals across {items.length} pattern clusters — statistically non-random distribution
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── L6 Canvas — Counterfactual: before/after comparison panel ────────────────

function L6Canvas({ items, loading, onSelect }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void }) {
  const reduced = useReducedMotion();
  const aggItem = items.find(i => i.id.includes("agg") || i.label.toLowerCase().includes("total")) ?? items[items.length - 1];

  return (
    <div>
      <CanvasHeader depth={6} items={items} loading={loading} />
      {loading ? <LevelLoadingSkeleton rows={3} /> : items.length === 0 ? <LevelEmpty label="Counterfactual Model" /> : (
        <div className="space-y-4">
          {/* Hero comparison panel */}
          {aggItem && (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,212,255,0.2)" }}>
              <div className="grid grid-cols-3 divide-x" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <motion.div className="p-5" style={{ background: "rgba(255,77,109,0.06)" }}
                  {...enterMotion(reduced, {
                    initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 },
                    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                  })}>
                  <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-2">Actual (Plan Paid)</div>
                  <div className="text-2xl font-black" style={{ color: RED }}>
                    {aggItem.kpis?.[0]?.value ?? aggItem.delta?.split("vs")?.[0]?.trim() ?? "—"}
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-1">current contract terms</div>
                </motion.div>
                <motion.div className="p-5" style={{ background: "rgba(16,185,129,0.06)" }}
                  {...enterMotion(reduced, {
                    initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 },
                    transition: { delay: 0.12, duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                  })}>
                  <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-2">Expected (Benchmark)</div>
                  <div className="text-2xl font-black" style={{ color: GREEN }}>
                    {aggItem.kpis?.[1]?.value ?? aggItem.delta?.split("vs")?.[1]?.trim() ?? "NADAC"}
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-1">transparent pricing model</div>
                </motion.div>
                <motion.div className="p-5" style={{ background: "rgba(0,212,255,0.06)" }}
                  {...enterMotion(reduced, {
                    initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0 },
                    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                  })}>
                  <div className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-600 mb-2">Recoverable Delta</div>
                  <div className="text-2xl font-black" style={{ color: BLUE }}>{aggItem.value}</div>
                  <div className="text-[9px] text-zinc-600 mt-1">annual extraction above benchmark</div>
                </motion.div>
              </div>
            </div>
          )}

          {/* Per-item deltas */}
          <div className="space-y-2">
            {items.filter(i => i !== aggItem).map((item, idx) => (
              <motion.button
                key={item.id}
                data-testid={`drill-l6-${item.id}`}
                onClick={() => onSelect(item)}
                {...enterMotion(reduced, {
                  initial: { opacity: 0, y: 10 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: 0.3 + idx * 0.05, duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                })}
                whileHover={reduced ? undefined : { x: 3 }}
                className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-4 transition-all"
                style={{ background: `${item.color}08`, border: `1px solid ${item.color}1a` }}>
                {/* Actual → Expected arrow */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="text-right">
                    <div className="text-[8px] font-mono text-zinc-600 mb-0.5">Actual</div>
                    <div className="text-sm font-black" style={{ color: RED }}>
                      {item.kpis?.[0]?.value ?? "—"}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                  <div>
                    <div className="text-[8px] font-mono text-zinc-600 mb-0.5">Expected</div>
                    <div className="text-sm font-black" style={{ color: GREEN }}>
                      {item.kpis?.[1]?.value ?? "Benchmark"}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[8px] font-mono text-zinc-600 mb-0.5">Delta</div>
                  <div className="text-sm font-black" style={{ color: item.color }}>{item.value}</div>
                </div>
                <div className="flex-shrink-0">
                  <div className="text-[11px] font-bold text-white/80 mb-0.5">{item.label}</div>
                  <SevChip s={item.severity} />
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: `${item.color}44` }} />
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── L7 Canvas — Risk & Fiduciary: ERISA exposure matrix ─────────────────────

function L7Canvas({ items, loading, onSelect }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void }) {
  const reduced = useReducedMotion();
  return (
    <div>
      <CanvasHeader depth={7} items={items} loading={loading} />
      {loading ? <LevelLoadingSkeleton rows={4} /> : items.length === 0 ? <LevelEmpty label="Risk & Fiduciary" /> : (
        <div className="space-y-4">
          {/* ERISA statute badges row */}
          <div className="flex flex-wrap gap-2 px-1">
            {["ERISA §404", "ERISA §406", "DOL Audit Risk", "Fiduciary Breach"].map((badge, i) => (
              <span key={badge} className="text-[8px] font-mono font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: i < 2 ? "rgba(255,77,109,0.12)" : i === 2 ? "rgba(255,184,0,0.12)" : "rgba(191,95,255,0.12)",
                  border: `1px solid ${i < 2 ? "rgba(255,77,109,0.35)" : i === 2 ? "rgba(255,184,0,0.35)" : "rgba(191,95,255,0.35)"}`,
                  color: i < 2 ? RED : i === 2 ? AMBER : PURPLE,
                }}>
                {badge}
              </span>
            ))}
          </div>

          {/* Risk cards grid */}
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => {
              const isHighRisk = item.severity === "CRITICAL" || item.severity === "HIGH";
              return (
                <motion.button
                  key={item.id}
                  data-testid={`drill-l7-${item.id}`}
                  onClick={() => onSelect(item)}
                  {...enterMotion(reduced, {
                    initial: { opacity: 0, scale: 0.92, y: 10 },
                    animate: { opacity: 1, scale: 1, y: 0 },
                    transition: { delay: idx * 0.06, duration: 0.32, ease: [0.4, 0, 0.2, 1] },
                  })}
                  whileHover={reduced ? undefined : { scale: 1.02 }}
                  className="text-left rounded-xl p-4 transition-all"
                  style={{ background: `${item.color}0d`, border: `1px solid ${item.color}28` }}>
                  <div className="flex items-start justify-between mb-3">
                    <SevChip s={item.severity} />
                    <ShieldAlert className="w-3.5 h-3.5" style={{ color: `${item.color}66` }} />
                  </div>
                  {/* Risk value — probability or dollar */}
                  <div className="text-xl font-black mb-1" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-[11px] font-bold text-white/80 mb-1.5">{item.label}</div>
                  <div className="text-[9px] text-zinc-500 leading-relaxed line-clamp-2">{item.desc}</div>
                  {item.delta && (
                    <div className="mt-3 text-[8px] font-mono px-2 py-1 rounded"
                      style={{ background: `${item.color}10`, color: `${item.color}aa`, border: `1px solid ${item.color}20` }}>
                      {item.delta}
                    </div>
                  )}
                  {isHighRisk && item.action && (
                    <div className="mt-2 text-[9px] font-medium text-zinc-400 line-clamp-1">{item.action.slice(0, 60)}…</div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Total exposure callout */}
          {items.some(i => i.severity === "CRITICAL") && (
            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: "rgba(255,77,109,0.07)", border: "1px solid rgba(255,77,109,0.25)" }}>
              <Gavel className="w-4 h-4 flex-shrink-0" style={{ color: RED }} />
              <div className="flex-1">
                <div className="text-[10px] font-bold" style={{ color: RED }}>Fiduciary Action Required</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">
                  ERISA §404(a)(1)(B) duty of prudence implicated — board disclosure recommended
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── L8 Canvas — Leverage Points: sequenced action playbook ──────────────────

const PLAYBOOK_TIMING = ["Day 0–30", "Day 30–60", "Day 60–90", "Renewal"];
const PLAYBOOK_ICONS  = [FileText, Database, BarChart2, CheckCircle2];

// L8's slide keeps a bespoke 90-day playbook schema (timing + recovery columns).
function buildPlaybookSlide(items: DrillItem[]): { markdown: string; html: string } {
  const steps = items.slice(0, 4);
  const columns: SlideColumn[] = [
    { header: "#", get: (_it, idx) => String(idx + 1) },
    { header: "Action", get: it => [it.label, [it.desc, it.action].filter(Boolean).join(" ")].filter(Boolean).join(" — ") },
    { header: "Timing", get: (_it, idx) => PLAYBOOK_TIMING[idx] ?? `Step ${idx + 1}` },
    { header: "Recovery", get: it => [it.value, it.delta].filter(Boolean).join(" ") },
  ];
  return buildDrillSlide({
    title: "90-Day Leverage Playbook",
    items: steps,
    columns,
    accent: GOLD,
    footer: `Total Leverage Sequence: ${items.length} action${items.length !== 1 ? "s" : ""} · 90-day execution window`,
  });
}

function PlaybookDownloadButton({ items, companyName }: { items: DrillItem[]; companyName?: string }) {
  const { toast } = useToast();
  const onClick = () => {
    try {
      const steps: PlaybookStep[] = items.slice(0, 4).map((it, idx) => ({
        timing: PLAYBOOK_TIMING[idx] ?? `Step ${idx + 1}`,
        label: it.label,
        desc: it.desc,
        action: it.action,
        recovery: [it.value, it.delta].filter(Boolean).join(" "),
        evidence: it.findings?.find(f => f && f.trim()),
        severity: it.severity,
        color: it.color,
      }));
      downloadPlaybookPDF({ steps, totalCount: items.length, companyName });
      toast({ title: "Playbook PDF downloaded", description: "Saved as a single-page slide — attach or archive it." });
    } catch {
      toast({ title: "Download failed", description: "Could not generate the playbook PDF.", variant: "destructive" });
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="button-download-playbook-pdf"
      title="Download the 90-day leverage playbook as a PDF slide"
      className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-bold font-mono uppercase tracking-wider transition-all hover-elevate"
      style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}40` }}>
      <Download className="w-3 h-3" />
      Download PDF
    </button>
  );
}

function L8Canvas({ items, loading, onSelect, companyName }: { items: DrillItem[]; loading: boolean; onSelect: (item: DrillItem) => void; companyName?: string }) {
  const reduced = useReducedMotion();
  return (
    <div>
      <CanvasHeader
        depth={8}
        items={items}
        loading={loading}
        buildSlide={() => buildPlaybookSlide(items)}
        extraActions={!loading && items.length > 0 ? <PlaybookDownloadButton items={items} companyName={companyName} /> : undefined}
      />
      {loading ? <LevelLoadingSkeleton rows={4} /> : items.length === 0 ? <LevelEmpty label="Leverage Points" /> : (
        <div className="space-y-4">
          {/* Timeline header */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)` }}>
            {items.slice(0, 4).map((_, i) => (
              <motion.div key={i} className="flex flex-col items-center"
                {...enterMotion(reduced, {
                  initial: { opacity: 0 }, animate: { opacity: 1 },
                  transition: { delay: i * 0.12, duration: 0.25 },
                })}>
                <div className="text-[8px] font-mono text-zinc-700 mb-1">{PLAYBOOK_TIMING[i] ?? `Step ${i + 1}`}</div>
                <motion.div className="w-full h-0.5 rounded-full origin-left" style={{ background: `rgba(245,166,35,${0.15 + i * 0.2})` }}
                  {...enterMotion(reduced, {
                    initial: { scaleX: 0 }, animate: { scaleX: 1 },
                    transition: { delay: i * 0.12, duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                  })} />
              </motion.div>
            ))}
          </div>

          {/* Action cards */}
          <div className="space-y-3">
            {items.map((item, idx) => {
              const StepIcon = PLAYBOOK_ICONS[idx] ?? Workflow;
              return (
                <motion.button
                  key={item.id}
                  data-testid={`drill-l8-${item.id}`}
                  onClick={() => onSelect(item)}
                  {...enterMotion(reduced, {
                    initial: { opacity: 0, x: -24 },
                    animate: { opacity: 1, x: 0 },
                    transition: { delay: 0.15 + idx * 0.1, duration: 0.35, ease: [0.4, 0, 0.2, 1] },
                  })}
                  whileHover={reduced ? undefined : { x: 4 }}
                  className="w-full text-left rounded-xl p-4 flex items-start gap-4 transition-all"
                  style={{ background: `${item.color}0a`, border: `1px solid ${item.color}25` }}>
                  {/* Step icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${item.color}18`, border: `1px solid ${item.color}35` }}>
                    <StepIcon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded"
                        style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}30` }}>
                        {PLAYBOOK_TIMING[idx] ?? `Step ${idx + 1}`}
                      </span>
                      <SevChip s={item.severity} />
                    </div>
                    <div className="text-[11px] font-black text-white/90 mb-1">{item.label}</div>
                    <div className="text-[10px] text-zinc-500 leading-relaxed">{item.desc}</div>
                    {item.action && (
                      <div className="mt-2 text-[9px] font-medium text-zinc-400 leading-relaxed">{item.action}</div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-[8px] font-mono text-zinc-600 mb-0.5">Recovery</div>
                    <div className="text-sm font-black" style={{ color: item.color }}>{item.value}</div>
                    {item.delta && <div className="text-[9px] font-mono mt-0.5" style={{ color: `${item.color}88` }}>{item.delta}</div>}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Total leverage summary */}
          <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
            style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4" style={{ color: GOLD }} />
              <div className="text-[10px] font-bold" style={{ color: GOLD }}>Total Leverage Sequence</div>
            </div>
            <div className="text-[9px] font-mono text-zinc-500">
              {items.length} action{items.length !== 1 ? "s" : ""} · 90-day execution window
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LevelCanvas — dispatcher ─────────────────────────────────────────────────
// Routes each drill depth to its purpose-built renderer.

function LevelCanvas({ items, loading, depth, onSelect, companyName }: {
  items: DrillItem[]; loading: boolean; depth: number; onSelect: (item: DrillItem) => void; companyName?: string;
}) {
  switch (depth) {
    case 2: return <L2Canvas items={items} loading={loading} onSelect={onSelect} />;
    case 3: return <L3Canvas items={items} loading={loading} onSelect={onSelect} />;
    case 4: return <L4Canvas items={items} loading={loading} onSelect={onSelect} />;
    case 5: return <L5Canvas items={items} loading={loading} onSelect={onSelect} />;
    case 6: return <L6Canvas items={items} loading={loading} onSelect={onSelect} />;
    case 7: return <L7Canvas items={items} loading={loading} onSelect={onSelect} />;
    case 8: return <L8Canvas items={items} loading={loading} onSelect={onSelect} companyName={companyName} />;
    default: return <GenericCanvas items={items} loading={loading} depth={depth} onSelect={onSelect} />;
  }
}

// ─── Generic Canvas (fallback) ────────────────────────────────────────────────

function GenericCanvas({ items, loading, depth, onSelect }: { items: DrillItem[]; loading: boolean; depth: number; onSelect: (item: DrillItem) => void }) {
  const meta = LEVEL_META[depth];
  const LIcon = meta?.icon ?? Target;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-1">
        <LIcon className="w-3.5 h-3.5" style={{ color: meta?.color }} />
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
          {meta?.label} — {meta?.question}
        </span>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "rgba(255,255,255,0.04)", height: 80 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Cpu className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
          <div className="text-xs text-zinc-600 font-mono">KIQ Engine generating {meta?.label} analysis…</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <DrillNode key={item.id} item={item} onClick={() => onSelect(item)} depth={depth} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
}

function L9Canvas({ tileId, pathItems, tileColor, companyName, companyEin, commitData }: { tileId: string; pathItems: DrillItem[]; tileColor: string; companyName?: string; companyEin?: string; commitData?: any }) {
  const { toast } = useToast();
  const narrative = NARRATIVE[tileId]?.[9] ?? "";
  const [impact, risk, action] = narrative.split("\n").filter(l => l.trim());

  // Parse structured Impact/Risk/Action lines from the narrative
  const lines        = narrative.split("\n").map(l => l.trim()).filter(Boolean);
  const narrativeText = lines[0] ?? "";
  const impactLine    = lines.find(l => l.startsWith("Impact:"))  ?? "";
  const riskLine      = lines.find(l => l.startsWith("Risk:"))    ?? "";
  const actionLine    = lines.find(l => l.startsWith("Action:"))  ?? "";

  const realBrief    = realBoardBriefForTile(tileId, commitData);
  const hasRealData  = !!commitData;
  const impactValue  = realBrief.impactValue
    ?? pathItems.find(p => p.value?.includes("$"))?.value
    ?? "$18.6M (Demo)";
  const tileTitle    = BASE_TILES.find(t => t.id === tileId)?.title ?? tileId;

  const [exporting, setExporting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const defaultDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const exportProfile = useExportProfile();
  const [formCompany, setFormCompany] = useState(companyName ?? "");
  const [formAnalyst, setFormAnalyst] = useState(exportProfile.analystName);
  const [formDate, setFormDate] = useState(defaultDate);
  const [formLogo, setFormLogo] = useState<string | undefined>(
    exportProfile.logoDataUrl || undefined
  );
  const [formLogoName, setFormLogoName] = useState<string>(exportProfile.logoName);

  useEffect(() => {
    setFormCompany(companyName ?? "");
  }, [companyName]);

  // When the dialog opens, refresh fields from the saved export profile so the
  // most recent analyst / logo defaults are pre-filled (without overwriting an
  // in-progress edit the user is making in the same session).
  useEffect(() => {
    if (!exportDialogOpen) return;
    if (!formAnalyst) setFormAnalyst(exportProfile.analystName);
    if (!formLogo && exportProfile.logoDataUrl) {
      setFormLogo(exportProfile.logoDataUrl);
      setFormLogoName(exportProfile.logoName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportDialogOpen]);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
      setFormLogo(undefined);
      setFormLogoName("Unsupported format — use PNG or JPG");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
      setFormLogo(dataUrl);
      setFormLogoName(file.name);
      if (dataUrl) exportProfile.setLogo(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  }

  function handleResetExportDefaults() {
    exportProfile.reset();
    setFormAnalyst("");
    setFormLogo(undefined);
    setFormLogoName("");
    toast({
      title: "Export defaults cleared",
      description: "Analyst name and saved logo have been reset.",
    });
  }

  // Auto-save narrative snapshot to history on first render (generation time)
  useEffect(() => {
    if (!narrativeText) return;
    apiRequest("POST", `/api/history/war_room/${tileId}`, {
      output_json: {
        type: "board_brief",
        tile_title: tileTitle,
        narrative: narrativeText,
        impact_value: impactValue,
        impact_detail: impactLine.replace(/^Impact:\s*/i, "") || "",
        risk_detail: riskLine.replace(/^Risk:\s*/i, "") || "",
        action_detail: actionLine.replace(/^Action:\s*/i, "") || "",
        path_items: pathItems.map(p => ({ label: p.label, value: p.value })),
      },
      label: `${tileTitle} narrative`,
    }).catch(() => { /* non-critical */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileId]);

  function buildShareUrl(): string {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("tile", tileId);
    if (companyEin) url.searchParams.set("ein", companyEin);
    const cname = formCompany.trim() || companyName || "";
    if (cname) url.searchParams.set("company", cname);
    const encoded = pathItems.map(p => ({
      id: p.id,
      label: p.label,
      value: p.value ?? "",
      color: p.color ?? tileColor,
    }));
    const dpath = btoa(unescape(encodeURIComponent(JSON.stringify(encoded))));
    url.searchParams.set("dpath", dpath);
    return url.toString();
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(buildShareUrl());
      toast({
        title: "Link copied to clipboard",
        description: "Share this URL to deep-link colleagues into this Board Brief.",
      });
    } catch {
      toast({
        title: "Unable to copy link",
        description: "Clipboard access was denied by the browser.",
        variant: "destructive",
      });
    }
  }

  function handleEmailShareLink() {
    const recipient = (window.prompt(
      "Send this Board Brief to (email address — leave blank to open your mail client without a recipient):",
      ""
    ) ?? "").trim();
    // Cancel returns null; prompt returning empty string proceeds without a To: address.
    const shareUrl = buildShareUrl();
    const cname = formCompany.trim() || companyName || "";
    const summary = narrativeText
      || impactLine.replace(/^Impact:\s*/i, "")
      || `${tileTitle} — ${impactValue}`;
    const subject = `Kincaid IQ Board Brief — ${tileTitle}`;
    const bodyLines = [
      cname ? `Board Brief for ${cname}: ${tileTitle}` : `Board Brief: ${tileTitle}`,
      "",
      summary,
      "",
      `Open in Kincaid IQ: ${shareUrl}`,
    ];
    const mailto =
      `mailto:${encodeURIComponent(recipient)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = mailto;
    toast({
      title: "Opening your email client",
      description: recipient
        ? `Pre-filled message to ${recipient} with the Board Brief link.`
        : "Pre-filled message with the Board Brief link.",
    });
  }

  async function handleExport() {
    setExporting(true);
    setExportDialogOpen(false);
    // Persist analyst name (and ensure logo is saved) so subsequent exports
    // pre-fill from these values without the user re-entering them.
    const trimmedAnalyst = formAnalyst.trim();
    if (trimmedAnalyst !== exportProfile.analystName) {
      exportProfile.setAnalystName(trimmedAnalyst);
    }
    if (formLogo && formLogo !== exportProfile.logoDataUrl) {
      exportProfile.setLogo(formLogo, formLogoName);
    }
    try {
      // Prefer real Commit Engine values when a company is loaded; the demo
      // strings below are clearly tagged so reviewers can spot unloaded exports.
      const narrativeImpact = impactLine.replace(/^Impact:\s*/i, "");
      const narrativeRisk   = riskLine.replace(/^Risk:\s*/i, "");
      const narrativeAction = actionLine.replace(/^Action:\s*/i, "");
      downloadBoardBriefPDF({
        tileTitle,
        tileColor,
        narrativeText,
        impactValue,
        impactDetail:  realBrief.impactDetail
                       ?? narrativeImpact
                       ?? (hasRealData ? "Annual leakage identified" : "Annual leakage identified (Demo)"),
        riskLabel:     realBrief.riskLabel
                       ?? (hasRealData ? "ERISA Fiduciary Exposure" : "ERISA Fiduciary Exposure (Demo)"),
        riskDetail:    realBrief.riskDetail
                       ?? narrativeRisk
                       ?? (hasRealData ? "Potential breach of §404 duty of prudence"
                                       : "Potential breach of §404 duty of prudence (Demo)"),
        actionLabel:   realBrief.actionLabel
                       ?? (hasRealData ? "Immediate RFP" : "Immediate RFP (Demo)"),
        actionDetail:  realBrief.actionDetail
                       ?? narrativeAction
                       ?? (hasRealData ? "Enforced pass-through + audit controls"
                                       : "Enforced pass-through + audit controls (Demo)"),
        pathItems:     pathItems.map(p => ({ label: p.label, color: p.color, value: p.value })),
        companyName:   formCompany.trim() || companyName || (hasRealData ? undefined : "Demo Sponsor"),
        analystName:   formAnalyst.trim() || undefined,
        dateOverride:  formDate.trim() || undefined,
        logoDataUrl:   formLogo,
      });
      // Save narrative snapshot to history on every export
      try {
        await apiRequest("POST", `/api/history/war_room/${tileId}`, {
          output_json: {
            type: "board_brief",
            tile_title: tileTitle,
            narrative: narrativeText,
            impact_value: impactValue,
            impact_detail: impactLine.replace(/^Impact:\s*/i, "") || "",
            risk_detail: riskLine.replace(/^Risk:\s*/i, "") || "",
            action_detail: actionLine.replace(/^Action:\s*/i, "") || "",
            path_items: pathItems.map(p => ({ label: p.label, value: p.value })),
          },
          label: "Board Brief export",
        });
      } catch {
        // non-critical — export already succeeded
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <AIHistoryPanel
        tool="war_room"
        entityId={tileId}
        entityLabel={`${tileTitle} — C-Suite Narrative`}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        accentColor={tileColor}
      />

      {exportDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13, 37, 61, 0.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setExportDialogOpen(false)}
          data-testid="overlay-board-brief-export"
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ background: "#ffffff", border: "1px solid rgba(0, 37, 80, 0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: `${tileColor}` }}>
                  Customize Export
                </div>
                <div className="text-sm font-bold text-[var(--kiq-ink-soft)] mt-1">Board Brief — {tileTitle}</div>
              </div>
              <button
                data-testid="button-close-export-dialog"
                onClick={() => setExportDialogOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--kiq-subtle)] hover:text-[var(--kiq-ink-soft)] hover:bg-[var(--kiq-canvas-soft)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--kiq-muted)] mb-1.5">
                  Company / Entity Name
                </label>
                <input
                  data-testid="input-export-company"
                  type="text"
                  value={formCompany}
                  onChange={e => setFormCompany(e.target.value)}
                  placeholder="Client Confidential"
                  className="w-full px-3 py-2 rounded-lg text-sm text-[var(--kiq-ink-soft)] bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--kiq-muted)] mb-1.5">
                  Analyst / Prepared By
                </label>
                <input
                  data-testid="input-export-analyst"
                  type="text"
                  value={formAnalyst}
                  onChange={e => setFormAnalyst(e.target.value)}
                  placeholder="Kincaid IQ™ — War Room Intelligence"
                  className="w-full px-3 py-2 rounded-lg text-sm text-[var(--kiq-ink-soft)] bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--kiq-muted)] mb-1.5">
                  Report Date
                </label>
                <input
                  data-testid="input-export-date"
                  type="text"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  placeholder={defaultDate}
                  className="w-full px-3 py-2 rounded-lg text-sm text-[var(--kiq-ink-soft)] bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-mono uppercase tracking-widest text-[var(--kiq-muted)] mb-1.5">
                  Client Logo (optional · PNG or JPG)
                </label>
                <div className="flex items-center gap-3">
                  <label
                    className="px-3 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] hover:bg-[var(--kiq-canvas-parchment)] transition-colors"
                  >
                    Choose file
                    <input
                      data-testid="input-export-logo"
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={onPickLogo}
                      className="hidden"
                    />
                  </label>
                  {formLogo && (
                    <img src={formLogo} alt="logo preview" className="h-8 max-w-[100px] object-contain" />
                  )}
                  <span className="text-[10px] text-[var(--kiq-muted)] truncate flex-1" data-testid="text-export-logo-name">
                    {formLogoName || "No file selected"}
                  </span>
                  {formLogo && (
                    <button
                      data-testid="button-clear-logo"
                      onClick={() => { setFormLogo(undefined); setFormLogoName(""); }}
                      className="text-[10px] text-[var(--kiq-muted)] hover:text-[var(--kiq-ink-soft)] underline transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {exportProfile.hasSavedDefaults && (
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-mono text-[var(--kiq-muted)]">
                <span className="truncate">
                  Pre-filled from your last export.
                </span>
                <button
                  data-testid="button-reset-export-defaults"
                  onClick={handleResetExportDefaults}
                  className="uppercase tracking-wider text-[var(--kiq-subtle)] hover:text-[var(--kiq-muted)] underline-offset-2 hover:underline transition-colors"
                >
                  Reset to default
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                data-testid="button-cancel-export"
                onClick={() => setExportDialogOpen(false)}
                className="px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--kiq-subtle)] hover:text-[var(--kiq-ink-soft)] transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="button-confirm-export"
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
                style={{
                  background: `${tileColor}15`,
                  border: `1px solid ${tileColor}40`,
                  color: tileColor,
                  opacity: exporting ? 0.6 : 1,
                }}
              >
                <Download className="w-3 h-3" />
                {exporting ? "Generating…" : "Generate PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-6 px-1">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" style={{ color: tileColor }} />
          <span className="text-[10px] font-mono text-[var(--kiq-muted)] uppercase tracking-[0.2em]">C-Suite Narrative — Executive Summary</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-war-room-history"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: `${tileColor}0d`,
              border: `1px solid ${tileColor}25`,
              color: tileColor,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}18`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}0d`; }}
          >
            <Clock className="w-3 h-3" />
            History
          </button>
          <button
            data-testid="button-email-board-brief"
            onClick={handleEmailShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: `${tileColor}0d`,
              border: `1px solid ${tileColor}25`,
              color: tileColor,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}18`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}0d`; }}
            title="Email a deep link to this Board Brief"
          >
            <Mail className="w-3 h-3" />
            Email
          </button>
          <button
            data-testid="button-share-board-brief"
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: `${tileColor}0d`,
              border: `1px solid ${tileColor}25`,
              color: tileColor,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}18`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}0d`; }}
            title="Copy a deep link to this Board Brief"
          >
            <Share2 className="w-3 h-3" />
            Copy Link
          </button>
          <button
            data-testid="button-export-board-brief"
            onClick={() => {
              setFormCompany(companyName ?? "");
              setFormDate(defaultDate);
              setExportDialogOpen(true);
            }}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all"
            style={{
              background: `${tileColor}18`,
              border: `1px solid ${tileColor}40`,
              color: tileColor,
              opacity: exporting ? 0.6 : 1,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}30`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${tileColor}18`; }}
          >
            <Download className="w-3 h-3" />
            {exporting ? "Generating…" : "Export Board Brief"}
          </button>
        </div>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
        {/* Narrative */}
        <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Narrative</div>
          <p className="text-sm text-white/90 leading-relaxed font-medium">{impact}</p>
        </div>
        {/* 3-column impact/risk/action */}
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="p-5">
            <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Impact</div>
            <div className="text-xl font-black" style={{ color: tileColor }}>
              {pathItems.find(p => p.value.includes("$"))?.value ?? "$18.6M"}
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">annual leakage identified</div>
          </div>
          <div className="p-5">
            <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Risk</div>
            <div className="text-xs font-bold text-red-400">ERISA Fiduciary Exposure</div>
            <div className="text-[10px] text-zinc-500 mt-1">potential breach of §404 duty of prudence</div>
          </div>
          <div className="p-5">
            <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Action</div>
            <div className="text-xs font-bold text-white/80">Immediate RFP</div>
            <div className="text-[10px] text-zinc-500 mt-1">enforced pass-through + audit controls</div>
          </div>
        </div>
        {/* Path summary */}
        {pathItems.length > 0 && (
          <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Intelligence Path Traveled</div>
            <div className="flex flex-wrap gap-2">
              {pathItems.map((item, i) => (
                <span key={i} className="text-[9px] font-mono px-2 py-0.5 rounded"
                  style={{ background: `${item.color}12`, color: item.color, border: `1px solid ${item.color}25` }}>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── generateNarrative(level, items, tileId) ─────────────────────────────────
// Deterministic, synchronous narrative derived from real DrillItem data.
// Takes priority over the Claude KIQ Engine for levels 0, 1, 3, 6, and 9.
// Returns null for all other levels → Claude handles those.
//
// Spec pattern:
//   case 0:  "Leakage of $${totalLeakage} detected, driven by ${topDriver}"
//   case 3:  "Behavior enabled by contract ambiguity in ${clause}"
//   case 6:  "Expected cost deviates by $${delta} from benchmark"
//   case 9:  { summary, impact, risk, action }  → executive brief

function generateNarrative(
  level: number,
  items: DrillItem[],
  _tileId: string,
): NarrativeEntry | null {
  if (!items.length) return null;

  const top = items[0];

  switch (level) {
    // L0 / L1 — "Leakage of $X detected, driven by <topDriver>"
    case 0:
    case 1: {
      const criticalItem = items.find(i => i.severity === "CRITICAL") ?? top;
      const totalLeakage = criticalItem.value;
      const topDriver    = criticalItem.label;
      return {
        type:        "level",
        insight:     `Leakage of ${totalLeakage} detected, driven by ${topDriver}.`,
        anomaly:     criticalItem.delta ? `${criticalItem.delta} above benchmark across ${items.length} signal${items.length > 1 ? "s" : ""}.` : criticalItem.desc,
        implication: criticalItem.action ?? `Address ${topDriver} to recover ${totalLeakage}.`,
      };
    }

    // L3 — "Behavior enabled by contract ambiguity in <clause>"
    case 3: {
      const clause    = top.value;   // value holds the §clause reference (e.g. "§3 — Pricing Definition")
      const gapLine   = top.findings?.[1] ?? top.desc;
      const excessLine = top.findings?.[2] ?? top.delta;
      return {
        type:        "level",
        insight:     `Behavior enabled by contract ambiguity in ${clause}.`,
        anomaly:     gapLine,
        implication: `${excessLine} — ${top.action ?? "Rewrite this clause immediately."}`,
      };
    }

    // L6 — "Expected cost deviates by $<delta> from benchmark"
    case 6: {
      // The aggregate item (id ends in -agg) carries the total counterfactual summary
      const aggItem = items.find(i => i.id.includes("agg")) ?? items[items.length - 1];
      const delta   = aggItem.value;   // e.g. "Δ $12.4M total"
      return {
        type:        "level",
        insight:     `Expected cost deviates by ${delta} from benchmark.`,
        anomaly:     aggItem.delta,    // "actual $X vs expected $Y"
        implication: aggItem.action ?? `Total delta of ${delta} is recoverable via contract rewrite and RFP.`,
      };
    }

    // L9 — { summary, impact, risk, action } → executive brief
    case 9: {
      const impactItem = items.find(i => i.id.includes("impact"));
      const causeItem  = items.find(i => i.id.includes("cause"));
      const riskItem   = items.find(i => i.id.includes("risk"));
      const actionItem = items.find(i => i.id.includes("action"));

      if (!impactItem && !causeItem) return null; // no structured data

      const summary = causeItem
        ? `Root cause: ${causeItem.value} via ${causeItem.delta}.`
        : top.desc;
      const impact  = impactItem
        ? `Financial impact: ${impactItem.value} recoverable. Total ERISA exposure: ${impactItem.delta}.`
        : "";
      const risk    = riskItem
        ? `Risk: ${riskItem.value}. ${riskItem.delta}.`
        : "";
      const action  = actionItem
        ? `Action: ${actionItem.value}. ${actionItem.findings?.slice(0, 3).join(" ") ?? ""}`
        : "";

      const brief = [summary, impact, risk, action].filter(Boolean).join("\n\n");
      return { type: "executive", brief };
    }

    default:
      return null;
  }
}

// ─── Narrative Panel ──────────────────────────────────────────────────────────
// Props: level, insight, implication — flat strings, no NarrativeEntry union type.
// anomaly card removed. lastItem / Current Focus section removed.
// L9 executive brief flows through insight (multi-paragraph string).

function NarrativePanel({ level, insight, implication, tileId, tileColor, isLoading, tier }: {
  level: number; insight: string; implication: string;
  tileId: string | null; tileColor: string; isLoading: boolean;
  tier?: ConfidenceTier;
}) {
  const meta = LEVEL_META[level];
  const gate = LEVEL_TO_GATE[level];
  const gateInfo = gate ? gateMeta(gate) : null;

  return (
    <div className="h-full flex flex-col" style={{ background: "rgba(255, 255, 255, 0.65)", borderLeft: "1px solid rgba(0, 37, 80, 0.08)" }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "rgba(0, 37, 80, 0.08)" }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: tileId ? tileColor : "#888" }} />
            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.25em] text-[var(--kiq-subtle)] truncate">KIQ Narrative Engine™</span>
          </div>
          {tileId && tier && !isLoading && <ConfidenceChip tier={tier} compact />}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: tileId ? `${tileColor}dd` : "#888" }}>
          <span className="truncate">{meta?.label ?? "War Room"} · {meta?.question ?? "Select a tile"}</span>
          {tileId && gateInfo && (
            <span className="ml-auto px-1.5 py-0.5 rounded font-bold tracking-[0.18em]"
              style={{ background: "rgba(155, 104, 41, 0.08)", color: "var(--kiq-gold)", border: "1px solid rgba(155, 104, 41, 0.2)", fontSize: 8 }}>
              GATE {gateInfo.n} · {gateInfo.name}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-5 overflow-y-auto space-y-3">
        <AnimatePresence mode="wait">
          <motion.div key={`narr-${tileId}-${level}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}>

            {/* Empty state */}
            {!tileId && (
              <p className="text-xs text-[var(--kiq-muted)] leading-relaxed italic">
                Click any War Room tile to begin. Each click descends one layer deeper — from signal to mechanism to proof to action.
              </p>
            )}

            {/* Loading skeleton */}
            {tileId && isLoading && (
              <div className="space-y-3">
                {[80, 65].map((w, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0, 37, 80, 0.04)" }}>
                    <div className="h-2 rounded mb-2 animate-pulse" style={{ background: "rgba(0,0,0,0.06)", width: "40%" }} />
                    <div className="h-3 rounded animate-pulse" style={{ background: "rgba(0,0,0,0.04)", width: `${w}%` }} />
                    <div className="h-3 rounded animate-pulse mt-1" style={{ background: "rgba(0,0,0,0.03)", width: "55%" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Insight + Implication */}
            {tileId && !isLoading && (insight || implication) && (
              <div className="space-y-2.5">
                {insight && (
                  <div className="rounded-xl p-4" style={{ background: `${tileColor}08`, border: `1px solid ${tileColor}20` }}>
                    <div className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: tileColor }}>
                      ● Insight
                    </div>
                    <p className="text-[11px] text-[var(--kiq-ink-soft)] leading-relaxed whitespace-pre-line">{insight}</p>
                  </div>
                )}
                {implication && (
                  <div className="rounded-xl p-4" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20` }}>
                    <div className="text-[8px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
                      → Implication
                    </div>
                    <p className="text-[11px] text-[var(--kiq-ink-soft)] leading-relaxed">{implication}</p>
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Descent Path — level continuity map */}
      <div className="px-5 pb-5 pt-4 border-t" style={{ borderColor: "rgba(0, 37, 80, 0.08)" }}>
        <div className="text-[8px] font-mono text-[var(--kiq-subtle)] uppercase tracking-widest mb-2">Descent Path</div>
        <div className="relative">
          <div className="absolute left-[2.5px] top-2 bottom-2 w-px" style={{ background: "linear-gradient(to bottom, rgba(0, 37, 80, 0.08), transparent)" }} />
          <div className="space-y-0.5 pl-4">
            {LEVEL_META.slice(1).map((m, i) => {
              const lvl     = i + 1;
              const reached = lvl <= level;
              const current = lvl === level;
              return (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 absolute left-0"
                    style={{ background: reached ? m.color : "rgba(0, 37, 80, 0.08)", boxShadow: current ? `0 0 6px ${m.color}` : "none" }} />
                  <span className="text-[8.5px] font-mono truncate transition-colors"
                    style={{ color: current ? "var(--kiq-ink)" : reached ? "var(--kiq-muted)" : "var(--kiq-subtle)" }}>
                    {current ? "▶ " : ""}{m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confidence Chip ──────────────────────────────────────────────────────────
// Three labels, no fourth. Constitutional per §4 of the Master Build Prompt.

function ConfidenceChip({ tier, compact = false }: { tier: ConfidenceTier; compact?: boolean }) {
  const meta = {
    CERTIFIED:             { color: GREEN, label: "CERTIFIED" },
    MODELED:               { color: AMBER, label: "MODELED" },
    INSUFFICIENT_EVIDENCE: { color: RED,   label: "INSUFFICIENT" },
  }[tier];
  return (
    <span
      data-testid={`chip-confidence-${tier.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-bold uppercase tracking-[0.14em] ${compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"}`}
      style={{ color: meta.color, background: `${meta.color}12`, border: `1px solid ${meta.color}38` }}>
      <span className="w-1 h-1 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
      {meta.label}
    </span>
  );
}

// ── RFP Pipeline Forecast Bar ─────────────────────────────────────────────────
// Feeds from /api/rfp/forecast — surfaces expected P50 bookings in the War Room.
// Hard Rule 01 four-tile invariant is untouched; this is a supplemental info strip.

interface RfpForecastData {
  open_count: number;
  closed_won_count: number;
  total_pipeline_value: number;
  total_expected_value: number;
  p50_proxy: number;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function RfpForecastBar() {
  const { data } = useQuery<RfpForecastData>({
    queryKey: ["/api/rfp/forecast"],
    retry: false,
  });

  if (!data || data.open_count === 0) return null;

  const pctEV = data.total_pipeline_value > 0
    ? Math.round((data.total_expected_value / data.total_pipeline_value) * 100)
    : 0;

  return (
    <div className="mt-3 rounded-xl px-4 py-2.5 flex items-center gap-5"
      style={{ background: "rgba(251,183,36,0.04)", border: "1px solid rgba(251,183,36,0.15)" }}
      data-testid="rfp-forecast-bar">
      <div className="flex items-center gap-2 shrink-0">
        <BarChart2 className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          RFP Pipeline Forecast
        </span>
      </div>
      <div className="flex gap-5 flex-1 flex-wrap">
        {[
          { label: "Open Opps",     value: String(data.open_count),                     color: "#94a3b8" },
          { label: "Pipeline",      value: fmtCompact(data.total_pipeline_value),        color: "#3b82f6" },
          { label: "Expected Value", value: fmtCompact(data.total_expected_value),       color: GOLD },
          { label: "Avg Win Prob",  value: `~${pctEV}%`,                                 color: data.p50_proxy > 0 ? "#22c55e" : "#ef4444" },
        ].map(m => (
          <div key={m.label} className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-black tabular-nums" style={{ color: m.color }}>{m.value}</span>
            <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>{m.label}</span>
          </div>
        ))}
      </div>
      <a href="/rfp-os/command"
        className="text-[9px] font-bold px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1"
        style={{ background: "rgba(251,183,36,0.10)", border: "1px solid rgba(251,183,36,0.22)",
          color: GOLD, textDecoration: "none" }}>
        Full Forecast →
      </a>
    </div>
  );
}

// ── Metrics Canon Strip ───────────────────────────────────────────────────────
// Surfaces the five load-bearing canon metrics (DRAP, PEPM, PWI, SBI, GLP-1) from
// /api/plan-metrics/canon. Supplemental to the four-tile board (Hard Rule 01 intact).
// Each cell shows its confidence tier; DRAP and PWI stay INSUFFICIENT_EVIDENCE with
// the unlocking ingestion named (Hard Rule 04: narratives never outrun evidence).

type CanonMetric = {
  key: string;
  label: string;
  formula: string;
  tier: ConfidenceTier;
  value: number | string | null;
  unit?: string;
  note?: string;
  components?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  dollar_exposure?: string;
};

type CanonResponse = {
  ein: string;
  metrics: CanonMetric[];
  coverage: { certified: number; modeled: number; insufficient: number };
};

function fmtCanonValue(m: CanonMetric): string {
  if (m.tier === "INSUFFICIENT_EVIDENCE" || m.value == null) return "INSUFFICIENT_EVIDENCE";
  if (m.key === "PEPM") return `$${Number(m.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (m.key === "GLP1") return `${m.value}%`;
  if (m.key === "SBI") return `${m.value} / 100`;
  return String(m.value);
}

function MetricsCanonStrip({ ein }: { ein: string }) {
  const target = ein || "ENTITY_001";
  const { data, isLoading } = useQuery<CanonResponse>({
    queryKey: ["/api/plan-metrics/canon", target],
    queryFn: async () => {
      const r = await fetch(`/api/plan-metrics/canon/${encodeURIComponent(target)}`, { credentials: "include" });
      if (!r.ok) throw new Error("canon fetch failed");
      return r.json();
    },
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mt-3 rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={{ background: "rgba(251,183,36,0.04)", border: "1px solid rgba(251,183,36,0.15)" }}
        data-testid="metrics-canon-loading">
        <Activity className="w-3 h-3 animate-pulse" style={{ color: GOLD }} />
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
          Loading metrics canon…
        </span>
      </div>
    );
  }
  if (!data || !data.metrics?.length) return null;

  return (
    <div className="mt-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(245, 166, 35, 0.05)", border: "1px solid rgba(245, 166, 35, 0.2)" }}
      data-testid="metrics-canon-strip">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Metrics Canon
        </span>
        <span className="text-[8px] font-mono uppercase tracking-wider text-[var(--kiq-muted)]">
          Supplemental · not a board tile
        </span>
        <span className="ml-auto text-[8px] font-mono uppercase tracking-wider text-[var(--kiq-subtle)]">
          {data.coverage.modeled} modeled · {data.coverage.insufficient} insufficient
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {data.metrics.map(m => {
          const insufficient = m.tier === "INSUFFICIENT_EVIDENCE" || m.value == null;
          return (
            <div key={m.key} data-testid={`canon-metric-${m.key.toLowerCase()}`}
              className="rounded-lg px-3 py-2.5 flex flex-col gap-1.5 shadow-sm"
              style={{ background: "var(--kiq-surface)", border: "1px solid rgba(0, 37, 80, 0.08)" }}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black tracking-[0.08em]" style={{ color: "var(--kiq-gold)" }}>{m.key}</span>
                <ConfidenceChip tier={m.tier} compact />
              </div>
              <div className="text-[8px] font-mono uppercase tracking-wider leading-tight text-[var(--kiq-subtle)]">
                {m.label}
              </div>
              <div className="font-bold tabular-nums leading-tight break-words"
                style={{ color: insufficient ? "#ef4444" : "var(--kiq-ink)", fontSize: insufficient ? 9 : 13 }}
                data-testid={`canon-value-${m.key.toLowerCase()}`}>
                {fmtCanonValue(m)}
              </div>
              <div className="text-[8px] font-mono leading-tight break-words text-[var(--kiq-subtle)]">
                {m.formula}
              </div>
              {m.note && (
                <div className="text-[8px] leading-tight break-words text-[var(--kiq-subtle)]">
                  {m.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Commit Engine · RFP Intelligence OS ───────────────────────────────────────
// Unifies the KincaidCommit Engine (7-gate qualification) with the RFP Intelligence
// OS (opportunity lifecycle) as a single operational surface inside the War Room.
// Left rail = the loaded company's live commit-gate readiness (from commitData,
// already fetched via /api/commit/analyze). Right rail = the live open-opportunity
// roster from /api/rfp/opportunities. Supplemental to the four-tile board so the
// Hard Rule 01 invariant stays intact.

// Structurally the served /api/rfp/opportunities payload (rfp_intake._serialize):
// extends ForecastOpportunity (stage/status/estimated_contract_value/covered_lives)
// with the display fields the roster renders.
interface RfpOpportunity extends ForecastOpportunity {
  id: string;
  employer_name?: string | null;
  title?: string | null;
  industry?: string | null;
  score_tier?: string | null;
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  new:        { label: "New",        color: "#94a3b8" },
  scoring:    { label: "Scoring",    color: BLUE },
  qualifying: { label: "Qualifying", color: BLUE },
  reviewing:  { label: "Reviewing",  color: BLUE },
  proposal:   { label: "Proposal",   color: GOLD },
  submitted:  { label: "Submitted",  color: GOLD },
  decision:   { label: "Decision",   color: PURPLE },
  won:        { label: "Won",        color: GREEN },
  lost:       { label: "Lost",       color: RED },
  no_bid:     { label: "No Bid",     color: "#64748b" },
};

// Dot color from the opportunity's live score tier (rfp_intake TIER_THRESHOLDS).
const TIER_COLOR: Record<string, string> = {
  pursue_aggressively: GREEN,
  pursue_selectively:  GOLD,
  monitor:             BLUE,
  decline:             RED,
};

function CommitRfpOsPanel({ ein, name, commitData }: { ein: string; name: string; commitData: any }) {
  const { data: opps } = useQuery<RfpOpportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
    retry: false,
    staleTime: 60_000,
  });

  const gates       = (commitData?.gates ?? {}) as Record<string, { status?: string; note?: string }>;
  const gateVals    = Object.values(gates);
  const totalGates  = gateVals.length || 7;
  const goCount     = gateVals.filter(g => g?.status === "GO").length;
  const commitReady = gates.gate7_commit?.status === "GO";
  const opportunity = (commitData?.opportunity ?? {}) as { total_first_year?: number; three_year_value?: number };

  const openOpps = filterOpenOpps(opps ?? []);
  const topOpps  = [...openOpps]
    .sort((a, b) => getRevenue(b) - getRevenue(a))
    .slice(0, 4);
  const pipelineValue = openOpps.reduce((s, o) => s + getRevenue(o), 0);

  return (
    <div className="mt-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(245, 166, 35, 0.05)", border: "1px solid rgba(245, 166, 35, 0.2)" }}
      data-testid="commit-rfp-os-panel">
      <div className="flex items-center gap-2 mb-2.5">
        <Workflow className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Commit Engine · RFP Intelligence OS
        </span>
        <span className="text-[8px] font-mono uppercase tracking-wider text-[var(--kiq-muted)]">
          Supplemental · not a board tile
        </span>
        <span className="ml-auto text-[8px] font-mono uppercase tracking-wider text-[var(--kiq-subtle)]">
          {openOpps.length} open · {fmtCompact(pipelineValue)} pipeline
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
        {/* Commit readiness rail */}
        <div className="rounded-lg px-3 py-2.5 flex flex-col gap-2 shadow-sm"
          style={{ background: "var(--kiq-surface)", border: "1px solid rgba(0, 37, 80, 0.08)" }}
          data-testid="commit-readiness-rail">
          <div className="flex items-center gap-1.5">
            <Target className="w-3 h-3" style={{ color: GOLD }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Commit Readiness</span>
          </div>
          {ein && commitData ? (
            <>
              <div className="text-[11px] font-bold text-[var(--kiq-ink-soft)] leading-tight truncate" data-testid="commit-company">
                {commitData?.edgar?.name ?? name ?? "Loaded company"}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums" style={{ color: goCount >= 4 ? GOLD : BLUE }} data-testid="commit-gate-count">
                  {goCount}/{totalGates}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-[var(--kiq-subtle)]">gates cleared</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: commitReady ? "rgba(16,185,129,0.08)" : "rgba(0,212,255,0.08)",
                    color: commitReady ? "var(--kiq-health)" : "var(--kiq-blue)" }} data-testid="commit-rfp-status">
                  {commitReady ? "RFP Ready" : "Qualifying"}
                </span>
                {opportunity.total_first_year ? (
                  <span className="text-[9px] font-mono text-[var(--kiq-muted)]">
                    {fmtShort(opportunity.total_first_year)} first-year
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="text-[10px] leading-relaxed text-[var(--kiq-muted)]">
              Load a company above to score its 7-gate commit readiness.
            </div>
          )}
          <a href="/commit-engine"
            className="mt-auto text-[9px] font-bold px-2.5 py-1.5 rounded-md flex items-center justify-center gap-1 shadow-sm"
            style={{ background: "#ffffff", border: "1px solid rgba(251,183,36,0.3)", color: GOLD, textDecoration: "none" }}
            data-testid="link-commit-engine">
            Qualify in Commit Engine <ArrowRight className="w-3 h-3" />
          </a>
        </div>

        {/* Opportunity roster rail */}
        <div className="rounded-lg px-3 py-2.5 flex flex-col gap-2 shadow-sm"
          style={{ background: "var(--kiq-surface)", border: "1px solid rgba(0, 37, 80, 0.08)" }}
          data-testid="rfp-opportunity-roster">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3" style={{ color: GOLD }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Top Opportunities</span>
            <a href="/rfp-os/command"
              className="ml-auto text-[9px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm"
              style={{ background: "#ffffff", border: "1px solid rgba(251,183,36,0.3)", color: GOLD, textDecoration: "none" }}
              data-testid="link-rfp-os">
              Open RFP Intelligence OS <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          {topOpps.length === 0 ? (
            <div className="text-[10px] leading-relaxed py-2 text-[var(--kiq-muted)]">
              No open opportunities yet. Intake an RFP in the RFP Intelligence OS to start scoring the pipeline.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {topOpps.map(o => {
                const sm  = STAGE_META[o.stage] ?? { label: o.stage || "Stage", color: "#94a3b8" };
                const dot = TIER_COLOR[o.score_tier ?? ""] ?? "#94a3b8";
                return (
                  <a key={o.id} href="/rfp-os/scoring"
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--kiq-canvas-soft)] transition-colors"
                    style={{ background: "rgba(0, 37, 80, 0.02)", border: "1px solid rgba(0, 37, 80, 0.06)", textDecoration: "none" }}
                    data-testid={`rfp-opp-${o.id}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                    <span className="text-[10px] font-semibold text-[var(--kiq-ink-soft)] truncate flex-1">{o.employer_name || o.title || "Untitled RFP"}</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: `${sm.color}14`, color: sm.color }}>{sm.label}</span>
                    <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: "var(--kiq-gold)" }}>
                      {fmtCompact(getRevenue(o))}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// War Room: voice contract, four hard rules, 7-gate chain, three tiers.
// Open/closed state persists via localStorage.

function DoctrineStrip({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div data-testid="doctrine-strip" className="mx-6 mt-3 mb-4 rounded-2xl overflow-hidden"
      style={{ background: "rgba(245, 166, 35, 0.04)", border: "1px solid rgba(245, 166, 35, 0.22)", backdropFilter: "blur(10px)" }}>

      {/* Toggle row */}
      <button data-testid="btn-toggle-doctrine" onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left">
        <Scale className="w-4 h-4" style={{ color: GOLD }} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.22em]" style={{ color: GOLD }}>
          Constitutional Doctrine
        </span>
        <span className="text-[10px] font-mono italic text-[var(--kiq-muted)]">
          {open ? "" : "voice contract · four hard rules · four primitives · seven-gate chain · governance events · three tiers · four registers · empirical validation"}
        </span>
        <ChevronRight className="w-3.5 h-3.5 ml-auto transition-transform" style={{ color: GOLD, transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}>
            <div className="px-5 pb-5 space-y-4">

              {/* Voice Contract */}
              <div className="rounded-xl px-4 py-3 shadow-sm"
                style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.18)" }}>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: GOLD }}>
                  Voice Contract for the Narrative Engine
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--kiq-ink-soft)] font-medium">
                  {VOICE_CONTRACT}
                </p>
              </div>

              {/* Four Hard Rules */}
              <div>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
                  § 0 · Four Hard Rules
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {HARD_RULES.map(r => (
                    <div key={r.num} data-testid={`hard-rule-${r.num.toLowerCase().replace(" ", "-")}`}
                      className="rounded-lg px-3 py-2.5 shadow-sm"
                      style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.12)" }}>
                      <div className="text-[9px] font-mono font-bold tracking-[0.16em]" style={{ color: GOLD }}>{r.num}</div>
                      <div className="text-[11px] font-semibold text-[var(--kiq-ink-soft)] my-1">{r.title}</div>
                      <div className="text-[10px] leading-relaxed text-[var(--kiq-muted)]">{r.body}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7-Gate Chain + Tier legend */}
              <div className="grid grid-cols-[1fr_auto] gap-4 items-stretch">
                <div className="rounded-xl px-4 py-3 shadow-sm"
                  style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.15)" }}>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
                    § 3 · 7-Gate Enforcement Chain
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    {ENFORCEMENT_GATES.map((g, i) => (
                      <div key={g.key} className="flex items-center gap-1 flex-1">
                        <div className="flex-1 text-center">
                          <div className="text-[9px] font-mono font-bold tracking-[0.12em]" style={{ color: GOLD }}>GATE {g.n}</div>
                          <div className="text-[8px] font-mono mt-0.5 text-[var(--kiq-subtle)]">{g.name}</div>
                        </div>
                        {i < ENFORCEMENT_GATES.length - 1 && <span className="text-[10px]" style={{ color: `${GOLD}66` }}>→</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl px-4 py-3 flex flex-col gap-2 justify-center shadow-sm"
                  style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.15)" }}>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
                    § 4 · Tiers
                  </div>
                  <div className="flex flex-col gap-1">
                    <ConfidenceChip tier="CERTIFIED" />
                    <ConfidenceChip tier="MODELED" />
                    <ConfidenceChip tier="INSUFFICIENT_EVIDENCE" />
                  </div>
                </div>
              </div>

              {/* Four Core Primitives */}
              <div>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
                  Four Core Primitives
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CORE_PRIMITIVES.map(p => (
                    <div key={p.name} data-testid={`primitive-${p.name.toLowerCase()}`}
                      className="rounded-lg px-3 py-2.5 shadow-sm"
                      style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.12)" }}>
                      <div className="text-[11px] font-mono font-bold tracking-[0.06em]" style={{ color: GOLD }}>{p.name}</div>
                      <div className="text-[9px] font-mono mt-1 leading-relaxed break-words text-[var(--kiq-muted)]">{p.fields}</div>
                      <div className="text-[10px] leading-relaxed text-[var(--kiq-muted)] mt-1">{p.purpose}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-mono mt-2 leading-relaxed text-[var(--kiq-subtle)]">
                  Deterministic cache key: <span className="font-bold text-[var(--kiq-muted)]">{DETERMINISTIC_CACHE_KEY}</span>
                </div>
              </div>

              {/* Canonical Enforcement Gates */}
              <div className="rounded-xl px-4 py-3 shadow-sm"
                style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.15)" }}>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
                  Canonical Enforcement Gates
                </div>
                <div className="flex flex-col gap-1">
                  {ENFORCEMENT_GATES.map(g => (
                    <div key={g.n} data-testid={`enforcement-gate-${g.n}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2.5 py-1.5"
                      style={{ background: "rgba(0, 37, 80, 0.02)" }}>
                      <span className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: GOLD }}>GATE {g.n}</span>
                      <span className="text-[11px] font-semibold text-[var(--kiq-ink-soft)]">
                        {g.name}
                        <span className="text-[10px] font-normal text-[var(--kiq-muted)]"> · {g.effect}</span>
                      </span>
                      <span className="text-[8px] font-mono px-2 py-0.5 rounded whitespace-nowrap"
                        style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                        {g.fail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zero-Trust Governance Events */}
              <div>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-2" style={{ color: GOLD }}>
                  Zero-Trust Governance Events
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {GOVERNANCE_EVENTS.map(e => {
                    const sc = e.severity === "CRITICAL" ? "#ef4444" : e.severity === "WARNING" ? "#f5a623" : "#10b981";
                    return (
                      <div key={e.type} data-testid={`gov-event-${e.type.toLowerCase()}`}
                        className="flex items-start gap-2 rounded-lg px-3 py-2 shadow-sm"
                        style={{ background: "#ffffff", border: `1px solid ${sc}22` }}>
                        <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc, boxShadow: `0 0 6px ${sc}` }} />
                        <div>
                          <div className="text-[10px] font-mono font-bold" style={{ color: sc }}>{e.type}</div>
                          <div className="text-[10px] leading-relaxed text-[var(--kiq-muted)]">{e.meaning}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* § 5 · Stanford Register: Empirical Validation */}
              <div data-testid="stanford-register" className="rounded-xl px-4 py-3 shadow-sm"
                style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.15)" }}>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] mb-1" style={{ color: GOLD }}>
                  § 5 · Stanford Register: Empirical Validation
                </div>
                <p className="text-[10px] font-mono italic leading-relaxed mb-3 text-[var(--kiq-muted)]">
                  Four registers · Harvard argues it · MIT proves it · Stanford tests it and ships it · Notre Dame asks who it serves. The Stanford register answers the question "how do you know?"
                </p>

                {/* The four-register stack */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {INTELLECTUAL_STACK.map(r => {
                    const isStanford = r.register === "Stanford PhD";
                    return (
                      <div key={r.register} data-testid={`register-${r.register.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                        className="rounded-lg px-3 py-2.5"
                        style={{
                          background: isStanford ? "rgba(245,166,35,0.07)" : "rgba(0, 37, 80, 0.01)",
                          border: `1px solid ${isStanford ? "rgba(245,166,35,0.3)" : "rgba(0, 37, 80, 0.08)"}`,
                        }}>
                        <div className="text-[10px] font-mono font-bold tracking-[0.08em]" style={{ color: isStanford ? GOLD : "#8a96a8" }}>{r.register}</div>
                        <div className="text-[10px] leading-relaxed text-[var(--kiq-muted)] mt-1">{r.contribution}</div>
                        <div className="text-[9px] italic leading-relaxed mt-1 text-[var(--kiq-subtle)]">{r.question}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Stanford discipline */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {STANFORD_DISCIPLINE.map(d => (
                    <div key={d.rule} data-testid={`stanford-rule-${d.rule.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                      className="rounded-lg px-3 py-2 shadow-sm"
                      style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.12)" }}>
                      <div className="text-[10px] font-semibold text-[var(--kiq-ink-soft)]">{d.rule}</div>
                      <div className="text-[9px] leading-relaxed text-[var(--kiq-muted)] mt-0.5">{d.body}</div>
                    </div>
                  ))}
                </div>

                {/* Replication benchmark + tier epistemics */}
                <div className="grid grid-cols-[1fr_auto] gap-3 items-stretch">
                  <div data-testid="replication-benchmark" className="rounded-lg px-3 py-2.5"
                    style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="text-[9px] font-mono font-bold uppercase tracking-[0.16em]" style={{ color: "#F59E0B" }}>Published Reference Benchmark</div>
                      <ConfidenceChip tier="MODELED" compact />
                      <span className="text-[8px] font-mono ml-auto text-[var(--kiq-subtle)]">external harness · {REPLICATION_BENCHMARK.seed}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mb-1.5">
                      {REPLICATION_BENCHMARK.metrics.map(m => (
                        <div key={m.key} data-testid={`benchmark-${m.key.toLowerCase()}`}>
                          <div className="text-lg font-black leading-none" style={{ color: "#F59E0B" }}>{m.value}</div>
                          <div className="text-[8px] font-mono mt-0.5 text-[var(--kiq-subtle)]">{m.key} · {m.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[9px] leading-relaxed text-[var(--kiq-muted)]">
                      Cited reference, not reproduced in this environment. {REPLICATION_BENCHMARK.method}
                    </div>
                    <div className="text-[9px] leading-relaxed mt-1 text-red-600">
                      Falsification: {REPLICATION_BENCHMARK.falsification}
                    </div>
                    <div className="text-[8px] font-mono mt-1 text-[var(--kiq-subtle)]">source · {REPLICATION_BENCHMARK.source}</div>
                  </div>
                  <div className="rounded-lg px-3 py-2.5 flex flex-col gap-1.5 justify-center shadow-sm"
                    style={{ background: "#ffffff", border: "1px solid rgba(245,166,35,0.12)" }}>
                    <div className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] mb-0.5" style={{ color: GOLD }}>Tiers as epistemics</div>
                    {TIER_EPISTEMICS.map(t => (
                      <div key={t.tier} className="flex items-center gap-2">
                        <ConfidenceChip tier={t.tier} compact />
                        <span className="text-[9px] leading-tight text-[var(--kiq-muted)]">{t.gloss}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── War Room Tile ────────────────────────────────────────────────────────────

function WRTile({ tile, isActive, onClick, tier }: {
  tile: WRTileData; isActive: boolean; onClick: () => void; tier: ConfidenceTier;
}) {
  const DirIcon = tile.trend === "up" ? TrendingUp : tile.trend === "down" ? TrendingDown : Minus;
  return (
    <motion.button
      data-testid={`tile-${tile.id}`}
      onClick={onClick}
      className={`kiq-wr-tile ${isActive ? "ring-1 ring-inset shadow-md" : ""}`}
      style={{
        background: isActive ? "rgba(255, 255, 255, 0.95)" : undefined,
        borderColor: isActive ? tile.color + "cc" : undefined,
        boxShadow: isActive
          ? `0 12px 30px ${tile.color}12, 0 4px 12px rgba(0, 37, 80, 0.03), inset 0 1px 0 #fff`
          : undefined,
      }}>
      {/* Watermark icon — extremely faint */}
      <div className="absolute right-4 bottom-3 opacity-[0.03]" style={{ color: tile.color }}>
        <DirIcon className="w-12 h-12" />
      </div>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: tile.color, opacity: isActive ? 1 : 0.4 }} />

      <div className="flex items-center justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: tile.color }} />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] truncate" style={{ color: "var(--kiq-muted)" }}>{tile.title}</span>
        </div>
        <ConfidenceChip tier={tier} compact />
      </div>

      <div className="text-3xl font-semibold mb-1 tracking-tight text-[var(--kiq-ink)] leading-none" style={{ fontFamily: "var(--font-sans)" }}>
        {tile.value}
      </div>

      <div className="flex items-center gap-1.5 mb-2.5">
        <DirIcon className="w-3 h-3" style={{ color: tile.color }} />
        <span className="text-[10px] font-mono font-medium" style={{ color: tile.color }}>{tile.anomaly}</span>
      </div>

      <p className="text-[11px] font-sans leading-relaxed text-[var(--kiq-muted)] pr-4">{tile.narrative}</p>
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CfoWarRoom() {
  const reduced = useReducedMotion();
  const [, navigate] = useLocation();
  const { data: auth } = useQuery<{ id: number; email: string; role: string }>({ queryKey: ["/api/auth/me"] });
  const { data: marketData } = useQuery<{ quotes: MarketQuote[] }>({ queryKey: ["/api/market/quotes"], staleTime: 60_000 });

  // ── EIN Company Selector ─────────────────────────────────────────────────────
  const [einSearch, setEinSearch]     = useState("");
  const [einDeferred, setEinDeferred] = useState("");
  const [selectedEin, setSelectedEin] = usePersistentState<string>("warroom:ein", "", { urlParam: "ein" });
  const [selectedName, setSelectedName] = usePersistentState<string>("warroom:name", "");
  const { sendTo: sendCompanyTo } = useCompanyHandoff();
  const [searchOpen, setSearchOpen]   = useState(false);

  const { data: searchResults, isFetching: searchFetching } = useQuery<{ results: any[] }>({
    queryKey: ["/api/commit/search", einDeferred],
    queryFn: async () => {
      const r = await fetch(`/api/commit/search?q=${encodeURIComponent(einDeferred)}`, { credentials: "include" });
      return r.json();
    },
    enabled: einDeferred.length >= 2,
    staleTime: 60_000,
  });

  const { data: commitData, isLoading: commitLoading } = useQuery<any>({
    queryKey: ["/api/commit/analyze", selectedEin],
    queryFn: async () => {
      const r = await fetch(`/api/commit/analyze/${selectedEin}`, { credentials: "include" });
      if (!r.ok) throw new Error("Analysis failed");
      return r.json();
    },
    enabled: !!selectedEin,
    staleTime: 300_000,
  });

  // ── Pipeline Forecast snapshot (Strategic Leverage) ──────────────────────────
  // Echoes the RFP OS Monte Carlo revenue forecast into the War Room so CFO users
  // see open-pipeline health on the Strategic Leverage tile + its L1 drill without
  // leaving for the RFP module. Reuses identical math via @/lib/pipelineForecast.
  // Numbers refresh whenever the underlying opportunities change (react-query).
  const { data: rfpOpps = [] } = useQuery<ForecastOpportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
    staleTime: 60_000,
  });
  const pipelineForecast = useMemo(() => {
    const open = filterOpenOpps(rfpOpps);
    if (open.length === 0) return null;
    return { mc: runMonteCarlo(open, 3000, 1.0), count: open.length };
  }, [rfpOpps]);
  const pipelineForecastItem: DrillItem | null = useMemo(() => {
    if (!pipelineForecast) return null;
    const { mc, count } = pipelineForecast;
    return {
      id: "pipeline_forecast",
      label: "Pipeline Revenue Forecast",
      value: fmtShort(mc.p50),
      delta: `${fmtShort(mc.p10)}–${fmtShort(mc.p90)} band`,
      color: GREEN,
      severity: "HIGH",
      desc: `Monte Carlo forecast across ${count} open RFP opportunit${count !== 1 ? "ies" : "y"} (3,000 simulations). P50 median bookings of ${fmtShort(mc.p50)}, with a P10–P90 confidence band of ${fmtShort(mc.p10)} to ${fmtShort(mc.p90)}.`,
      findings: [
        `P50 median: ${fmtShort(mc.p50)} expected bookings`,
        `P10 downside: ${fmtShort(mc.p10)} · P90 upside: ${fmtShort(mc.p90)}`,
        `Mean ${fmtShort(mc.mean)} across ${count} open opportunit${count !== 1 ? "ies" : "y"} · ${(mc.probZero * 100).toFixed(0)}% chance of zero close`,
      ],
      action: "Open the full Monte Carlo forecast — confidence factor slider, histogram, and accuracy panel — in the RFP OS Command Center →",
      kpis: [
        { label: "P10", value: fmtShort(mc.p10), up: false },
        { label: "P50", value: fmtShort(mc.p50), up: true },
        { label: "P90", value: fmtShort(mc.p90), up: true },
      ],
      meta: `Sourced from ${count} open RFP opportunit${count !== 1 ? "ies" : "y"} · refreshes live`,
    };
  }, [pipelineForecast]);

  function handleEinInput(v: string) {
    setEinSearch(v);
    setSearchOpen(true);
    clearTimeout((handleEinInput as any)._t);
    (handleEinInput as any)._t = setTimeout(() => setEinDeferred(v), 350);
  }

  function selectCompany(ein: string, name: string) {
    setSelectedEin(ein);
    setSelectedName(name);
    setEinSearch("");
    setEinDeferred("");
    setSearchOpen(false);
    setActiveTile(null);
    setDepthLevel(0);
    setPath([]);
    setDataContext({});
    setNarrative({});
    itemRegistry.current = {};
  }

  function clearCompany() {
    setSelectedEin("");
    setSelectedName("");
    setEinSearch("");
    setEinDeferred("");
    setSearchOpen(false);
    // Reset the drill view + persisted trail so a cleared company never
    // restores a stale drill path on return.
    setActiveTile(null);
    setDepthLevel(0);
    setPath([]);
    setDataContext({});
    setNarrative({});
    setSavedDrill(null);
    itemRegistry.current = {};
  }

  const displayTiles: Tiles4 = (commitData && selectedEin)
    ? buildTilesFromData(commitData, selectedName)
    : BASE_TILES;
  // Runtime defense-in-depth — fail fast if anything ever bypasses the
  // type-level 4-tuple constraint (e.g. via `as any`).
  assertTiles4(displayTiles);

  // Company-specific L1 signals — when a real company is loaded, the L1
  // "Signal Decomposition" drill reflects that company's actual plan profile.
  // Falls back to the generic L1_SIGNALS demo data when no company is selected.
  const liveL1Signals: Record<string, DrillItem[]> | null = (commitData && selectedEin)
    ? buildL1SignalsFromData(commitData, commitData?.edgar?.name ?? selectedName ?? "This company")
    : null;
  const l1SignalsFor = (tileId: string): DrillItem[] => {
    const base = liveL1Signals?.[tileId] ?? L1_SIGNALS[tileId] ?? [];
    // Surface the open-pipeline Monte Carlo forecast as the lead Strategic
    // Leverage signal so executives see P50 + P10–P90 bookings without leaving
    // for the RFP module. Prepended (not a new tile) to respect HARD RULE 01.
    if (tileId === "strategic_leverage" && pipelineForecastItem) {
      return [pipelineForecastItem, ...base];
    }
    return base;
  };

  // ── State shape (matches spec exactly) ───────────────────────────────────────
  // { activeTile, depthLevel, path, dataContext, narrative }
  const [doctrineOpen, setDoctrineOpen]     = usePersistentState<boolean>("warroom:doctrine", false);
  const [activeTile, setActiveTile]         = usePersistentState<string | null>("warroom:tile", null);
  const [depthLevel, setDepthLevel]         = useState(0);
  const [path, setPath]                     = useState<string[]>([]);       // node IDs only
  const [dataContext, setDataContext]       = useState<Record<number, DrillItem[]>>({});
  // Persisted drill trail — remembers how deep the user drilled into a tile so
  // returning to the War Room reopens it at the exact same level. Scoped to the
  // company (ein) + tile so a switch to a different company/tile never restores
  // a stale path. The per-level data is re-derived from the cached commit
  // analysis on restore; only the lightweight node trail is persisted.
  const [savedDrill, setSavedDrill] = usePersistentState<SavedDrill | null>("warroom:drill", null);
  const drillReadyRef = useRef(false);
  const [narrative, setNarrative]           = useState<Record<number, NarrativeEntry | null>>({});
  const [loadingLevel, setLoadingLevel]     = useState<number | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  // ── Cross-app company handoff (reads ?ein=&company= from URL) ────────────────
  const [handoffEin, setHandoffEin] = useState<string | null>(null);
  const [handoffCompany, setHandoffCompany] = useState<string | null>(null);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const [clientPkgOpen, setClientPkgOpen] = useState(false);
  // Tracks a Board Brief restored from a shared deep-link (?tile=&dpath=).
  // While set, the L9 view shows a "Viewing a shared Board Brief" banner.
  // Cleared when the user navigates to a different tile or clicks the banner's
  // "Clear shared view" action.
  const [sharedView, setSharedView] = useState<{ tile: string; company: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ein = params.get("ein");
    // Accept ?name (Commit Engine contract) or ?company (handoff convention).
    const company = params.get("name") || params.get("company");
    if (ein) { setHandoffEin(ein); setHandoffCompany(company || ein); }
  }, []);

  // ── Stale drill reset on cross-company deep-link (?ein) ─────────────────────
  // selectedEin is pre-loaded from ?ein (URL wins in usePersistentState), but the
  // active tile + drill path restore from localStorage and may still reflect the
  // previously-loaded company. If the deep-link's ?ein differs from the persisted
  // warroom:ein, the restored drill session belongs to a different company — so
  // reset to the 4-tile overview. Skipped when a shared link carries ?tile (that
  // restoration owns its own drill state) so full view-state shares are unchanged.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const einParam = params.get("ein");
    if (!einParam) return;                 // no deep-link company → nothing to reset
    if (params.get("tile")) return;        // shared full view-state → leave to its own restore
    let storedEin: string | null = null;
    try { storedEin = JSON.parse(localStorage.getItem("warroom:ein") ?? "null"); } catch {}
    if (storedEin === einParam) return;    // same company restored → in-session state is valid
    // Different company arrived via URL → drop the stale drill view.
    setActiveTile(null);
    setDepthLevel(0);
    setPath([]);
    setDataContext({});
    setNarrative({});
    itemRegistry.current = {};
    // Sync localStorage to the deep-linked company so a later reload of this same
    // URL is recognised as the same in-session company and is NOT reset again.
    setSelectedEin(einParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Deep-link company name restoration (?ein=&name=/&company=) ───────────────
  // selectedEin is pre-loaded from ?ein by usePersistentState, but selectedName
  // is not URL-synced — so a deep-link from Commit Engine / Benchmarking would
  // otherwise show a stale (or empty) company name until the analysis returns.
  // Read ?name first (Commit Engine deep-link contract), falling back to
  // ?company (the handoff convention used by Benchmarking / Broker Prospects).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const einParam = params.get("ein");
    const nameParam = params.get("name") || params.get("company");
    if (einParam && nameParam) setSelectedName(nameParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Board Brief deep-link restoration (?tile=&dpath=) ────────────────────────
  // Reads tile + base64-encoded drill path from the URL and restores the L9
  // Board Brief view so shared links render the same intelligence the sender saw.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tileParam = params.get("tile");
    const dpathParam = params.get("dpath");
    // Every War Room share link carries an explicit `doctrine` param, so its
    // presence reliably signals "this load came from a shared link".
    const isSharedLink = params.has("doctrine");
    if (!tileParam) {
      // Shared link with no tile → restore the base 4-tile view, overriding any
      // tile the recipient may have persisted locally so they see exactly what
      // the sender saw.
      if (isSharedLink) {
        setActiveTile(null);
        setDepthLevel(0);
        setPath([]);
      }
      return;
    }
    if (!BASE_TILES.find(t => t.id === tileParam)) return;
    try {
      // Always register the tile's L1 signals so the tile renders and
      // back-navigation works, then activate the tile.
      registerItems(L1_SIGNALS[tileParam] ?? []);
      setActiveTile(tileParam);

      // Optional drill path: decode and restore the deeper view when present.
      let restoredDepth = 1;
      if (dpathParam) {
        const decodedJson = decodeURIComponent(escape(atob(dpathParam)));
        const decoded = JSON.parse(decodedJson) as Array<{
          id?: string; label: string; value?: string; color?: string;
        }>;
        if (Array.isArray(decoded) && decoded.length > 0) {
          const ids: string[] = [];
          decoded.forEach((node, i) => {
            const id = node.id || `share-${i}`;
            const synthetic: DrillItem = {
              id,
              label: node.label,
              value: node.value ?? "",
              delta: "",
              color: node.color ?? GOLD,
              severity: "HIGH",
              desc: "",
              findings: [],
              action: "",
              kpis: [],
            };
            itemRegistry.current[id] = synthetic;
            ids.push(id);
          });
          setPath(ids);
          restoredDepth = Math.min(decoded.length, 9);
        }
      }
      setDepthLevel(restoredDepth);
      const companyParam = params.get("name") || params.get("company") || params.get("ein") || "";
      const tileTitle = BASE_TILES.find(t => t.id === tileParam)?.title ?? tileParam;
      setSharedView({ tile: tileParam, company: companyParam || tileTitle });
    } catch {
      /* malformed link — ignore */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Doctrine strip + company restoration (shared links) ─────────────────────
  // Share links always carry an explicit doctrine flag ("1"/"0"), so restore
  // the strip to the exact sender state (forcing it closed when "0", overriding
  // any locally-persisted preference). A shared link with no company clears any
  // locally-persisted company so the recipient sees the sender's exact view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("doctrine");
    if (d === "1") setDoctrineOpen(true);
    else if (d === "0") setDoctrineOpen(false);
    if (params.has("doctrine") && !params.get("ein")) {
      setSelectedEin("");
      setSelectedName("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialize the full War Room view-state for short share links. Captures the
  // loaded company, active tile, drill path (same base64 dpath encoding the
  // Board Brief uses), and doctrine strip state.
  function getShareState(): Record<string, any> {
    const state: Record<string, any> = {};
    if (selectedEin) state.ein = selectedEin;
    if (selectedName) state.name = selectedName;
    if (activeTile) state.tile = activeTile;
    // Always serialize doctrine state explicitly ("1"/"0") so a shared link
    // forces both open and closed, regardless of the recipient's saved setting.
    state.doctrine = doctrineOpen ? "1" : "0";
    if (activeTile && path.length) {
      const encoded = path.map((id, i) => {
        const it = itemRegistry.current[id];
        return {
          id,
          label: it?.label ?? id,
          value: it?.value ?? "",
          color: it?.color ?? GOLD,
        };
      });
      state.dpath = btoa(unescape(encodeURIComponent(JSON.stringify(encoded))));
    }
    return state;
  }

  // Dismiss the shared-Board-Brief banner the moment the user navigates
  // away from the restored tile (selects another, deselects, or clears).
  useEffect(() => {
    if (sharedView && activeTile !== sharedView.tile) {
      setSharedView(null);
    }
  }, [activeTile, sharedView]);

  function clearSharedView() {
    const url = new URL(window.location.href);
    ["tile", "dpath", "company", "name", "ein"].forEach(p => url.searchParams.delete(p));
    window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : "") + url.hash);
    setSharedView(null);
    setActiveTile(null);
    setDepthLevel(0);
    setPath([]);
    setDataContext({});
    setNarrative({});
    itemRegistry.current = {};
  }

  const { data: handoffProfile, isLoading: handoffLoading } = useQuery<any>({
    queryKey: ["/api/benchmark/employer", handoffEin],
    enabled: !!handoffEin && !handoffDismissed,
    queryFn: () =>
      fetch(`/api/benchmark/employer/${handoffEin}?year=2023`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }).then(r => r.json()),
  });

  // Item registry — looks up any DrillItem by its ID across all levels
  const itemRegistry = useRef<Record<string, DrillItem>>({});
  function registerItems(items: DrillItem[]) {
    items.forEach(item => { itemRegistry.current[item.id] = item; });
  }

  // Derived
  const activeTileData = BASE_TILES.find(t => t.id === activeTile) ?? null;
  const tileColor      = activeTileData?.color ?? GOLD;
  const lastItemId     = path[path.length - 1] ?? null;
  const lastItem       = lastItemId ? (itemRegistry.current[lastItemId] ?? null) : null;

  // ── fetchNarrative(state) — KIQ Narrative Engine™ ───────────────────────────
  // Async — calls /api/kiq-engine/narrative to generate structured intelligence.
  // Returns NarrativeEntry: { type:"level", insight, anomaly, implication }
  //                    or   { type:"executive", brief }
  async function fetchNarrative(state: {
    activeTile: string;
    depthLevel: number;
    path: string[];
  }): Promise<NarrativeEntry> {
    const dimension   = LEVEL_DIMENSION[state.depthLevel] ?? "analysis";
    const pathLabels  = state.path.map(id => itemRegistry.current[id]?.label ?? id);
    const currentItems = (dataContext[state.depthLevel] ?? [])
      .map(item => `${item.label}: ${item.value} (${item.severity})`).join("; ");
    // Ground deeper levels in the loaded company's real plan profile so the
    // narrative stays company-specific past L1. Empty when no company is loaded.
    const companyContext = (commitData && selectedEin)
      ? buildCompanyContext(commitData, commitData?.edgar?.name ?? selectedName ?? "This company", selectedEin)
      : "";

    try {
      const res  = await apiRequest("POST", "/api/kiq-engine/narrative", {
        tile:            state.activeTile,
        level:           state.depthLevel,
        dimension,
        path_labels:     pathLabels,
        data_summary:    currentItems,
        company_context: companyContext,
      });
      const data = await res.json();
      const tier: ConfidenceTier | undefined =
        data.tier === "CERTIFIED" || data.tier === "MODELED" || data.tier === "INSUFFICIENT_EVIDENCE"
          ? data.tier : undefined;
      if (data.type === "executive") {
        return { type: "executive", brief: data.brief ?? "", tier };
      }
      return { type: "level", insight: data.insight ?? "", anomaly: data.anomaly ?? "", implication: data.implication ?? "", tier };
    } catch {
      return { type: "level", insight: "Intelligence analysis in progress.", anomaly: "", implication: "", tier: "INSUFFICIENT_EVIDENCE" };
    }
  }

  // ── transformData(state) ─────────────────────────────────────────────────────
  // Instantiates DrillDownEngine and delegates to the per-level named method.
  // Spec pattern: engine.process(level, context) → switch → levelN_methodName
  async function transformData(state: {
    activeTile: string; depthLevel: number; path: string[];
    dataContext: Record<number, DrillItem[]>;
  }): Promise<Record<number, DrillItem[]>> {
    const nextLevel = state.depthLevel + 1;
    if (nextLevel > 9 || state.dataContext[nextLevel]) return state.dataContext; // cached or max depth

    const colors     = [RED, AMBER, BLUE, PURPLE, GREEN, GOLD];
    const tileLabel  = BASE_TILES.find(t => t.id === state.activeTile)?.title ?? "";
    const pathLabels = state.path.map(id => itemRegistry.current[id]?.label ?? id);
    const pathNodes  = state.path.map((id, i) => ({
      id, title: itemRegistry.current[id]?.label ?? id, level: i + 1, category: "failure",
    }));

    // Ground deeper drill levels in the loaded company's real plan profile so
    // depth 2–8 reference the same EIN, carriers, FCR %, and GLP-1 figures as L1
    // instead of drifting back to generic content. Empty when no company loaded.
    const companyContext = (commitData && selectedEin)
      ? buildCompanyContext(commitData, commitData?.edgar?.name ?? selectedName ?? "This company", selectedEin)
      : "";

    // LevelFetcher — injected into the engine, called by each level's named method
    const levelFetcher: LevelFetcher = async (topic, _ctx, level) => {
      const res  = await apiRequest("POST", "/api/kiq-engine/drill", { topic, path: pathNodes, level, file_text: "", company_context: companyContext });
      const data = await res.json();
      if (!data?.tiles?.length) return [];
      return data.tiles.map((t: any, i: number): DrillItem => ({
        id:       `l${level}-${i}`,
        label:    t.title ?? `Item ${i + 1}`,
        value:    t.kpis?.[0]?.value ?? (t.score != null ? `${t.score}/100` : "—"),
        delta:    t.kpis?.[0]?.delta ?? "",
        color:    colors[i % colors.length],
        severity: t.score != null ? (t.score >= 75 ? "CRITICAL" : t.score >= 50 ? "HIGH" : t.score >= 25 ? "MEDIUM" : "LOW") : "HIGH",
        desc:     t.description ?? "",
        findings: t.findings ?? [],
        action:   t.action ?? "",
        kpis:     t.kpis ?? [],
        meta:     t.category,
      }));
    };

    // Instantiate engine and delegate to the per-level named method
    const engine  = new DrillDownEngine(tileLabel, levelFetcher);
    const ctx: DrillContext = { tile: state.activeTile, pathLabels, pathNodes, ein: selectedEin || undefined };

    try {
      const newItems = await engine.process(nextLevel, ctx);
      if (newItems.length) {
        registerItems(newItems);
        return { ...state.dataContext, [nextLevel]: newItems };
      }
    } catch {/* silent */}
    return state.dataContext;
  }

  // ── onClick(node) ────────────────────────────────────────────────────────────
  // Spec order:
  //   state.depthLevel += 1
  //   state.path.push(node.id)
  //   state.dataContext = transformData(state)   ← parallel
  //   state.narrative   = generateNarrative(state) ← parallel (fetchNarrative)
  async function onClick(node: DrillItem) {
    if (depthLevel >= 9) return;

    // Pipeline Revenue Forecast signal is a click-through, not a drill: jump
    // straight into the full Monte Carlo module (confidence slider, histogram,
    // accuracy panel) in the RFP OS Command Center. Uses wouter — no reload.
    if (node.id === "pipeline_forecast") {
      navigate("/rfp-os/command?focus=forecast");
      return;
    }

    itemRegistry.current[node.id] = node;

    // 1. state.depthLevel += 1  |  state.path.push(node.id)
    const newDepthLevel = depthLevel + 1;
    const newPath       = [...path, node.id];
    setDepthLevel(newDepthLevel);
    setPath(newPath);

    // Show loading states for both canvas and narrative panel
    setLoadingLevel(newDepthLevel + 1);
    setNarrativeLoading(true);
    setNarrative(prev => ({ ...prev, [newDepthLevel]: { type: "loading" } }));

    // 2 & 3: transformData + fetchNarrative in parallel
    const [newDataContext, aiNarrativeEntry] = await Promise.all([
      transformData({ activeTile: activeTile!, depthLevel: newDepthLevel, path: newPath, dataContext }),
      fetchNarrative({ activeTile: activeTile!, depthLevel: newDepthLevel, path: newPath }),
    ]);

    // generateNarrative() — deterministic, data-driven narrative from real DrillItem values.
    // Handles levels 0, 1, 3, 6, 9 synchronously from the returned items.
    // Takes priority over the AI narrative for those levels; Claude handles all others.
    const levelItems    = newDataContext[newDepthLevel] ?? [];
    const dataNarrative = generateNarrative(newDepthLevel, levelItems, activeTile!);
    // Preserve tier from the AI response even when deterministic synthesis wins —
    // the deterministic path computes structure, but tier is a governance signal
    // owned by the Narrative Engine. Drops would violate Hard Rule #4.
    const aiTier = (aiNarrativeEntry.type === "level" || aiNarrativeEntry.type === "executive")
      ? aiNarrativeEntry.tier
      : undefined;
    const narrativeEntry: NarrativeEntry = dataNarrative
      ? (dataNarrative.type === "loading"
          ? dataNarrative
          : { ...dataNarrative, tier: dataNarrative.tier ?? aiTier ?? (levelItems.length ? "MODELED" : "INSUFFICIENT_EVIDENCE") })
      : aiNarrativeEntry;

    setDataContext(newDataContext);
    setLoadingLevel(null);
    setNarrative(prev => ({ ...prev, [newDepthLevel]: narrativeEntry }));
    setNarrativeLoading(false);
  }

  // ── restoreDrill(saved) — replay a persisted drill trail ──────────────────────
  // Re-derives per-level data level-by-level from the cached commit analysis so
  // the tile reopens at exactly the depth the user left it, with the same
  // breadcrumb and canvas. Mirrors onClick's data/narrative pipeline.
  async function restoreDrill(saved: SavedDrill) {
    const tile = saved.tile;
    const depth = Math.min(saved.depth, 9);
    if (!tile || depth <= 0 || saved.nodes.length === 0) return;

    // Register real L1 signals first (correct labels for the first breadcrumb).
    registerItems(l1SignalsFor(tile));
    // Re-register persisted path nodes as fallbacks for any not yet in registry.
    saved.nodes.forEach(n => {
      if (!itemRegistry.current[n.id]) {
        itemRegistry.current[n.id] = {
          id: n.id, label: n.label, value: n.value, delta: "", color: n.color,
          severity: "HIGH", desc: "", findings: [], action: "", kpis: [],
        };
      }
    });

    const ids = saved.nodes.map(n => n.id);
    setActiveTile(tile);
    setPath(ids);
    setDepthLevel(depth);
    if (depth >= 1 && depth < 9) setLoadingLevel(depth + 1);

    // Rebuild dataContext for each visited level from the cached analysis.
    let ctx: Record<number, DrillItem[]> = {};
    for (let k = 1; k <= depth; k++) {
      ctx = await transformData({ activeTile: tile, depthLevel: k, path: ids.slice(0, k), dataContext: ctx });
    }
    setDataContext(ctx);
    setLoadingLevel(null);

    // Restore the current level's narrative (deterministic synthesis + AI),
    // following the same precedence as onClick.
    setNarrativeLoading(true);
    setNarrative(prev => ({ ...prev, [depth]: { type: "loading" } }));
    const levelItems   = ctx[depth] ?? [];
    const dataNarrative = generateNarrative(depth, levelItems, tile);
    const aiNarrativeEntry = await fetchNarrative({ activeTile: tile, depthLevel: depth, path: ids });
    const aiTier = (aiNarrativeEntry.type === "level" || aiNarrativeEntry.type === "executive")
      ? aiNarrativeEntry.tier : undefined;
    let narrativeEntry: NarrativeEntry;
    if (dataNarrative && dataNarrative.type !== "loading") {
      const tier = dataNarrative.tier ?? aiTier ?? (levelItems.length ? "MODELED" : "INSUFFICIENT_EVIDENCE");
      narrativeEntry = { ...dataNarrative, tier };
    } else {
      narrativeEntry = aiNarrativeEntry;
    }
    setNarrative(prev => ({ ...prev, [depth]: narrativeEntry }));
    setNarrativeLoading(false);
  }

  // ── Restore persisted drill depth on return ───────────────────────────────────
  // Runs once. Bails for shared links (those restore their own view from the URL)
  // and only restores when the saved trail matches the currently loaded company
  // and tile. Waits for the commit analysis when a real company is loaded so the
  // per-level data is re-derived from real evidence, not synthetic placeholders.
  useEffect(() => {
    if (drillReadyRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("doctrine")) { drillReadyRef.current = true; return; }
    if (!savedDrill || savedDrill.depth <= 0 || savedDrill.nodes.length === 0) { drillReadyRef.current = true; return; }
    if (!activeTile || activeTile !== savedDrill.tile) { drillReadyRef.current = true; return; }
    if ((savedDrill.ein || "") !== (selectedEin || "")) { drillReadyRef.current = true; return; }
    if (selectedEin && !commitData) return; // wait for analysis before re-deriving
    drillReadyRef.current = true;
    void restoreDrill(savedDrill);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTile, savedDrill, selectedEin, commitData]);

  // ── Persist the live drill trail ──────────────────────────────────────────────
  // Only writes after the one-shot restore has settled so it never clobbers the
  // saved trail before it can be replayed. Clears the trail whenever the user
  // returns to the tile surface (depth 0) or closes the tile.
  useEffect(() => {
    if (!drillReadyRef.current) return;
    if (!activeTile || depthLevel <= 0) { setSavedDrill(null); return; }
    setSavedDrill({
      ein: selectedEin || "",
      tile: activeTile,
      depth: depthLevel,
      nodes: path.map(id => {
        const it = itemRegistry.current[id];
        return { id, label: it?.label ?? id, value: it?.value ?? "", color: it?.color ?? GOLD };
      }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depthLevel, path, activeTile, selectedEin]);

  // ── Tile selection ────────────────────────────────────────────────────────────
  function selectTileAction(tileId: string) {
    if (activeTile === tileId) {
      setActiveTile(null); setDepthLevel(0); setPath([]); setDataContext({}); setNarrative({});
      itemRegistry.current = {};
      return;
    }
    // Register L1 items into the registry immediately — company-specific when a
    // real company is loaded, otherwise the generic demo signals.
    const l1 = l1SignalsFor(tileId);
    registerItems(l1);

    setActiveTile(tileId);
    setDepthLevel(0);
    setPath([]);
    setDataContext({});
    setNarrative({});           // narrative is AI-generated on first node click
    setNarrativeLoading(false);
  }

  // ── goToLevel ─────────────────────────────────────────────────────────────────
  function goToLevel(targetDepth: number) {
    setPath(prev => prev.slice(0, targetDepth));
    setDepthLevel(targetDepth);
  }

  return (
    <Layout>
      <div className="min-h-screen flex flex-col kiq-ops-shell kiq-readable-surface" style={{ background: "var(--kiq-canvas)" }}>

        {/* Ticker */}
        {marketData?.quotes && <TickerTape quotes={marketData.quotes} />}

        {/* Header */}
        <div className="px-4 sm:px-6 pt-6 pb-4">
          <div className="kiq-ops-header flex flex-col xl:flex-row xl:items-end justify-between gap-4 rounded-[24px] p-5">
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em]" style={{ color: "var(--kiq-muted)" }}>Kincaid IQ™</span>
              </div>
              <h1 className="text-2xl font-semibold text-[var(--kiq-ink)] tracking-tight" style={{ fontFamily: "var(--font-sans)", letterSpacing: "-0.025em" }}>CFO War Room</h1>
              <p className="text-xs text-[var(--kiq-muted)] mt-1">4-Tile Recursive Drill-Down · 9 Levels of Intelligence</p>
            </div>

            {/* Company Selector */}
            <div className="flex-1 max-w-md relative" onClick={e => e.stopPropagation()}>
              {selectedEin && !einSearch ? (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
                  style={{ background: "var(--kiq-surface)", border: "1px solid rgba(0, 37, 80, 0.08)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                  <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[var(--kiq-ink-soft)] truncate">{selectedName}</div>
                    <div className="text-[10px] font-mono text-[var(--kiq-subtle)]">EIN {selectedEin}</div>
                  </div>
                  {commitLoading && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: GOLD }} />}
                  <button data-testid="btn-clear-company" onClick={clearCompany}
                    className="p-1 rounded-full hover:bg-[var(--kiq-canvas-parchment)] transition-colors flex-shrink-0">
                    <X className="w-3 h-3 text-[var(--kiq-subtle)]" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--kiq-subtle)] pointer-events-none" />
                  <input
                    data-testid="input-war-room-ein"
                    value={einSearch}
                    onChange={e => handleEinInput(e.target.value)}
                    onFocus={() => setSearchOpen(true)}
                    placeholder="Search company to load real plan data…"
                    className="w-full text-xs text-[var(--kiq-ink-soft)] placeholder:text-[var(--kiq-subtle)] rounded-xl pl-9 pr-4 py-2.5 outline-none"
                    style={{ background: "var(--kiq-surface)", border: "1px solid rgba(0, 37, 80, 0.08)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.01)" }}
                  />
                  {searchFetching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-[var(--kiq-subtle)]" />}
                </div>
              )}
              {/* Dropdown */}
              {searchOpen && !selectedEin && (searchResults?.results?.length ?? 0) > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 shadow-lg"
                  style={{ background: "#ffffff", border: "1px solid rgba(0, 37, 80, 0.08)", maxHeight: 280, overflowY: "auto" }}>
                  {searchResults!.results.map((r: any) => (
                    <button key={r.ein} data-testid={`btn-wr-company-${r.ein}`}
                      onClick={() => selectCompany(r.ein, r.name)}
                      className="w-full text-left px-4 py-3 text-xs hover:bg-[var(--kiq-canvas-soft)] transition-colors border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--kiq-ink-soft)] truncate">{r.name}</div>
                        <div className="text-[10px] text-[var(--kiq-subtle)] mt-0.5">{r.sector} · {r.city}, {r.state} · EIN {r.ein}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 text-[var(--kiq-subtle)]" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="px-3 py-1.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider"
                style={{ background: "rgba(11,159,106,0.08)", color: "var(--kiq-health)", border: "1px solid rgba(11,159,106,0.18)" }}>
                ● {selectedEin && commitData ? "Live Data" : "Demo"}
              </div>
              {selectedEin && selectedName && (
                <button
                  onClick={() => sendCompanyTo("benchmarking", selectedEin, selectedName)}
                  data-testid="btn-war-room-benchmarking"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-[9px] uppercase tracking-wider transition-all shadow-sm"
                  style={{ background: "#ffffff", border: "1px solid rgba(155, 104, 41, 0.25)", color: "var(--kiq-gold)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(155, 104, 41, 0.05)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ffffff"; }}
                >
                  <BarChart2 className="w-3 h-3" />
                  Benefits Benchmarking
                </button>
              )}
              <button
                onClick={() => setClientPkgOpen(true)}
                data-testid="btn-war-room-client-package"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-[9px] uppercase tracking-wider transition-all shadow-sm"
                style={{ background: "#ffffff", border: "1px solid rgba(255, 184, 0, 0.3)", color: "var(--kiq-gold)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 184, 0, 0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ffffff"; }}
              >
                <Archive className="w-3 h-3" />
                Build Package
              </button>
              <ShareMenu page="war-room" getState={getShareState} getTitle={() => selectedName || "CFO War Room"} accent="#F5A623" testIdPrefix="share-warroom" />
              {auth && (
                <span className="text-[10px] text-[var(--kiq-subtle)] font-mono">{auth.email}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Constitutional Doctrine (Master Build Prompt) ───────────────── */}
        <DoctrineStrip open={doctrineOpen} onToggle={() => setDoctrineOpen(v => !v)} />

        {/* ── Company Handoff Banner ──────────────────────────────────────── */}
        {handoffEin && !handoffDismissed && (
          <div className="mx-6 mb-4 rounded-xl px-5 py-3 flex items-center gap-4"
            style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.28)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)" }}>
              <Building2 className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm" style={{ color: GOLD }}>
                {handoffLoading ? `Loading ${handoffCompany}…` : handoffCompany}
              </div>
              <div className="text-[10px] font-mono" style={{ color: "#475569" }}>
                {handoffLoading
                  ? "Fetching DOL EFAST2 benchmark data…"
                  : <>EIN {handoffEin}
                    {handoffProfile?.employer && (
                      <>
                        {" · "}{handoffProfile.employer.city}, {handoffProfile.employer.state}
                        {" · "}{handoffProfile.employer.maxParticipants?.toLocaleString()} lives
                        {handoffProfile.employerPmpm && ` · $${handoffProfile.employerPmpm}/mo PMPM`}
                      </>
                    )}
                  </>
                }
              </div>
            </div>
            {handoffProfile?.percentiles && (
              <div className="flex gap-4 shrink-0">
                {[
                  { label: "Admin", val: handoffProfile.percentiles.adminFees },
                  { label: "Comm", val: handoffProfile.percentiles.brokerCommissions },
                  { label: "Income", val: handoffProfile.percentiles.totalIncome },
                ].filter(d => d.val != null).map(d => (
                  <div key={d.label} className="text-center">
                    <div className="text-sm font-black" style={{ color: d.val >= 75 ? RED : d.val >= 50 ? AMBER : GREEN }}>
                      P{d.val}
                    </div>
                    <div className="text-[9px]" style={{ color: "#64748b" }}>{d.label}</div>
                  </div>
                ))}
              </div>
            )}
            <a href={`/benefits-benchmarking?ein=${handoffEin}&company=${encodeURIComponent(handoffCompany || "")}`}
              className="text-[10px] font-bold px-3 py-1.5 rounded-md shrink-0"
              style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", color: GOLD, textDecoration: "none" }}>
              Full Benchmark →
            </a>
            <button onClick={() => setHandoffDismissed(true)} data-testid="dismiss-handoff-banner"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 War Room Tiles */}
        <div className="px-4 sm:px-6 mb-4" onClick={() => { if (searchOpen) setSearchOpen(false); }}>
          {commitLoading && selectedEin && (
            <div className="flex items-center gap-2 mb-3 text-[10px] font-mono" style={{ color: GOLD }}>
              <RefreshCw className="w-3 h-3 animate-spin" />
              Pulling real plan data for {selectedName}…
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {displayTiles.map(tile => {
              // CERTIFIED when real DOL plan data backs the tile; MODELED for demo seed.
              const tileTier: ConfidenceTier = (selectedEin && commitData) ? "CERTIFIED" : "MODELED";
              return (
                <WRTile key={tile.id} tile={tile} tier={tileTier}
                  isActive={activeTile === tile.id} onClick={() => selectTileAction(tile.id)} />
              );
            })}
          </div>

          {/* OS-08 Posture + OS-13 Risk — Phase 3 Day 90 surveillance pair. */}
          <div
            className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4"
            data-testid="warroom-posture-row"
          >
            <div
              className="lg:col-span-2 p-3 rounded-xl shadow-sm"
              data-testid="warroom-fps-panel"
              style={{
                background: "var(--kiq-surface)",
                border: "1px solid rgba(0, 37, 80, 0.08)",
              }}
            >
              <FPSGauge ein={selectedEin || null} size={108} />
            </div>
            <div
              className="lg:col-span-2 p-3 rounded-xl shadow-sm"
              data-testid="warroom-risk-panel"
              style={{
                background: "var(--kiq-surface)",
                border: "1px solid rgba(255, 77, 109, 0.18)",
              }}
            >
              <LiveRiskMeter ein={selectedEin || null} />
            </div>
          </div>
          {selectedEin && commitData && (
            <div className="mt-2.5 text-[9px] font-mono text-[var(--kiq-subtle)] text-right">
              KPIs sourced from DOL Form 5500 + EDGAR · {commitData.dol?.latest_year} filing year
            </div>
          )}

          {/* RFP Pipeline Forecast — feeds from /api/rfp/forecast */}
          <RfpForecastBar />

          {/* Metrics Canon: supplemental strip (Hard Rule 01, not a board tile) */}
          <MetricsCanonStrip ein={selectedEin} />

          {/* Commit Engine · RFP Intelligence OS: qualification + opportunity roster */}
          <CommitRfpOsPanel ein={selectedEin} name={selectedName} commitData={commitData} />

          {/* Recursive Narrative Drill: 4-tile x 9-level C-Suite narrative engine */}
          <RecursiveNarrativeDrill />

          {/* Contract Leakage: DRAP = Sum(Paid - Allowable) reconciliation + proof packet */}
          <ContractLeakagePanel />
        </div>

        {/* Drill Area */}
        <AnimatePresence>
          {activeTile && (
            <motion.div
              key={activeTile}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex-1 mx-4 sm:mx-6 mb-6 rounded-2xl overflow-hidden flex flex-col shadow-sm"
              style={{ border: "1px solid rgba(0, 37, 80, 0.08)", background: "rgba(255, 255, 255, 0.85)", minHeight: 480 }}>

              {/* Path — Financial → Spread → MAC → Clause 7.3 */}
              <Path
                tileId={activeTile}
                pathLabels={path.map(id => itemRegistry.current[id]?.label ?? id)}
                depth={depthLevel === 0 ? 1 : depthLevel + 1}
                onGoToLevel={(idx) => {
                  if (idx === 0) goToLevel(0);
                  else goToLevel(idx - 1);
                }}
                onClose={() => {
                  setActiveTile(null); setDepthLevel(0); setPath([]);
                  setDataContext({}); setNarrative({});
                  setNarrativeLoading(false);
                  itemRegistry.current = {};
                }}
              />

              {/* Split: Canvas + Narrative */}
              <div className="flex flex-col xl:flex-row flex-1 overflow-hidden">

                {/* Left: Drill Canvas */}
                <div className="flex-1 overflow-y-auto p-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`canvas-${depthLevel}`}
                      {...enterMotion(reduced, {
                        initial: { opacity: 0, scale: 0.94, y: 14, filter: "blur(3px)" },
                        animate: { opacity: 1, scale: 1,    y: 0,  filter: "blur(0px)" },
                        exit:    { opacity: 0, scale: 1.04, y: -10, filter: "blur(3px)" },
                        transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                      })}>

                      {/* depthLevel=0 → show L1 signals (company-specific when loaded) */}
                      {depthLevel === 0 && (
                        <L1Canvas
                          items={l1SignalsFor(activeTile)}
                          onSelect={onClick}
                          tileColor={tileColor}
                        />
                      )}

                      {/* depthLevel 1–8 → purpose-built renderer per level */}
                      {depthLevel >= 1 && depthLevel < 9 && (
                        <LevelCanvas
                          items={dataContext[depthLevel + 1] ?? []}
                          loading={loadingLevel === depthLevel + 1}
                          depth={depthLevel + 1}
                          onSelect={depthLevel + 1 < 9 ? onClick : () => {}}
                          companyName={commitData?.edgar?.name ?? selectedName ?? undefined}
                        />
                      )}

                      {/* depthLevel=9 → C-Suite Narrative */}
                      {depthLevel >= 9 && sharedView && (
                        <div
                          data-testid="banner-shared-board-brief"
                          className="mb-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs"
                          style={{
                            borderColor: "rgba(245,166,35,0.35)",
                            background: "rgba(245,166,35,0.08)",
                            color: "rgba(255,255,255,0.85)",
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Share2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: GOLD }} />
                            <span className="font-mono truncate">
                              Viewing a shared Board Brief — <span className="font-bold text-white">{sharedView.company}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={clearSharedView}
                            data-testid="button-clear-shared-view"
                            className="flex-shrink-0 flex items-center gap-1 rounded border px-2 py-1 font-mono uppercase tracking-wider hover:bg-[var(--kiq-surface)]/10 transition-colors"
                            style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}
                          >
                            <X className="w-3 h-3" />
                            Clear shared view
                          </button>
                        </div>
                      )}
                      {depthLevel >= 9 && (
                        <L9Canvas
                          tileId={activeTile!}
                          pathItems={path.map(id => itemRegistry.current[id]).filter(Boolean) as DrillItem[]}
                          tileColor={tileColor}
                          companyName={commitData?.edgar?.name ?? selectedName ?? undefined}
                          companyEin={selectedEin || undefined}
                          commitData={(selectedEin && commitData) ? commitData : undefined}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Right: Narrative Panel — KIQ Narrative Engine™ */}
                <div className="w-full xl:w-80 flex-shrink-0">
                  {(() => {
                    const entry = narrative[depthLevel] ?? null;
                    const insight     = entry?.type === "level"     ? entry.insight
                                      : entry?.type === "executive" ? entry.brief
                                      : "";
                    const implication = entry?.type === "level" ? entry.implication : "";
                    const entryTier   = (entry?.type === "level" || entry?.type === "executive") ? entry.tier : undefined;
                    return (
                      <NarrativePanel
                        level={depthLevel === 0 ? 1 : depthLevel + 1}
                        insight={insight}
                        implication={implication}
                        tileId={activeTile}
                        tileColor={tileColor}
                        isLoading={narrativeLoading}
                        tier={entryTier}
                      />
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state when no tile selected */}
        {!activeTile && (
          <div className="flex-1 flex items-center justify-center pb-16 text-center">
            <div>
              <div className="w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto mb-4 shadow-sm"
                style={{ borderColor: "rgba(0, 37, 80, 0.08)", background: "rgba(255, 255, 255, 0.8)" }}>
                <Target className="w-5 h-5 text-[var(--kiq-subtle)]" />
              </div>
              <p className="text-[var(--kiq-muted)] text-sm font-mono">Select a War Room tile to begin the intelligence drill</p>
              <p className="text-[var(--kiq-subtle)] text-xs mt-1.5 font-mono">Each click converts ambiguity → decision-grade clarity</p>
            </div>
          </div>
        )}

      </div>

      <ClientPackageDrawer
        open={clientPkgOpen}
        onOpenChange={setClientPkgOpen}
        initialEin={selectedEin}
        initialEinName={selectedName}
      />
    </Layout>
  );
}
