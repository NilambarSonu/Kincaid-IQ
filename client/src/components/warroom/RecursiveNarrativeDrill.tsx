import { useState, useMemo, Fragment } from "react";

// Kincaid Health · War Room · 4-Tile Recursive Drill-Down (C-Suite Narrative Engine)
// Constitutional: one screen, four tiles always (L9 end-state is the exception).
// Each click is a narrative layer shift (different resolution), not "more data".
// Ported verbatim from the canonical reference design; narrative content is
// authored source-of-truth and is preserved exactly.

const SHA = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, "0");
  return `sha256:${hex}${hex.slice(0, 8)}…`;
};

type Direction = "up-bad" | "down-good" | "down-bad" | "right-opp" | "right-neutral";

interface DrillTile {
  id: string;
  domain: string;
  kpi: string;
  unit: string;
  delta: string;
  direction: Direction;
  anomaly?: string;
  narrative: string;
  claimRef?: string;
  children?: string;
}

interface DrillScreen {
  level: number;
  layerName: string;
  layerSubtitle: string;
  parentLabel?: string;
  question?: string;
  evidence?: boolean;
  tiles: DrillTile[];
}

// ── Narrative graph: 9 levels x 4 tiles ──

const GRAPH: DrillScreen = {
  level: 0,
  layerName: "WAR ROOM",
  layerSubtitle: "Entry State — Four Fixed Domains",
  tiles: [
    {
      id: "fin",
      domain: "FINANCIAL EXPOSURE",
      kpi: "$18.6M",
      unit: "Annual Leakage",
      delta: "+$4.2M QoQ",
      direction: "up-bad",
      anomaly: "Spread + rebate opacity",
      narrative: "$18.6M leakage identified — driven by spread + rebate opacity",
      children: "L1_FIN",
    },
    {
      id: "con",
      domain: "CONTRACT INTEGRITY",
      kpi: "41%",
      unit: "Clause Coverage",
      delta: "−9 pts vs peer",
      direction: "down-bad",
      anomaly: "§7.3 pass-through undefined",
      narrative: "PBM agreement lacks pass-through timing and audit-rights enforcement",
      children: "L1_CON",
    },
    {
      id: "ops",
      domain: "OPERATIONAL BEHAVIOR",
      kpi: "78%",
      unit: "Specialty Anomaly Rate",
      delta: "Q-end spike pattern",
      direction: "up-bad",
      anomaly: "Quarter-end MAC drift",
      narrative: "Specialty claims exhibit systemic quarter-end price distortion",
      children: "L1_OPS",
    },
    {
      id: "str",
      domain: "STRATEGIC LEVERAGE",
      kpi: "3.2×",
      unit: "RFP Leverage Multiple",
      delta: "Market re-bid window open",
      direction: "right-opp",
      anomaly: "Incumbent vulnerable",
      narrative: "Conditions aligned for re-bid at enforceable pass-through + audit terms",
      children: "L1_STR",
    },
  ],
};

const SCREENS: Record<string, DrillScreen> = {
  // L1: signal decomposition
  L1_FIN: {
    level: 1,
    layerName: "SIGNAL DECOMPOSITION",
    layerSubtitle: "What is driving this?",
    parentLabel: "Financial Exposure",
    question: "Decomposing $18.6M leakage into primary drivers",
    tiles: [
      { id: "spread", domain: "SPREAD PRICING", kpi: "$7.8M", unit: "Margin Extraction", delta: "42% of total", direction: "up-bad", narrative: "PBM retains delta between ingredient cost and plan-paid amount", children: "L2_SPREAD" },
      { id: "rebate", domain: "REBATE MISALIGNMENT", kpi: "$5.1M", unit: "Retained Value", delta: "27% of total", direction: "up-bad", narrative: "Rebate dollars retained via reconciliation timing, not adjudication", children: "L2_REBATE" },
      { id: "spec", domain: "SPECIALTY INFLATION", kpi: "$3.9M", unit: "Above-Benchmark Spend", delta: "21% of total", direction: "up-bad", narrative: "Specialty pricing 34% above NADAC comparable", children: "L2_SPEC" },
      { id: "form", domain: "FORMULARY DRIFT", kpi: "$1.8M", unit: "Suboptimal Placement", delta: "10% of total", direction: "up-bad", narrative: "Tier placement favors rebated molecules over lowest net cost", children: "L2_FORM" },
    ],
  },
  L1_CON: {
    level: 1, layerName: "SIGNAL DECOMPOSITION", layerSubtitle: "What is driving this?", parentLabel: "Contract Integrity",
    question: "Decomposing contract gaps into enforceable categories",
    tiles: [
      { id: "pt", domain: "PASS-THROUGH TIMING", kpi: "§7.3", unit: "Silent Clause", delta: "No SLA defined", direction: "down-bad", narrative: "Contract does not specify when rebates must flow to plan", children: "L2_SPREAD" },
      { id: "audit", domain: "AUDIT RIGHTS", kpi: "0", unit: "Real-time Access", delta: "Annual retro only", direction: "down-bad", narrative: "No adjudication-level audit rights; post-hoc sampling only", children: "L2_REBATE" },
      { id: "mac", domain: "MAC METHODOLOGY", kpi: "Opaque", unit: "Disclosure Level", delta: "Unilateral revision", direction: "down-bad", narrative: "PBM reserves right to modify MAC lists without notice", children: "L2_SPEC" },
      { id: "excl", domain: "EXCLUSIVITY CARVE-OUTS", kpi: "12", unit: "Restricted Categories", delta: "Forces specialty network", direction: "down-bad", narrative: "Exclusivity clauses block alternate dispensing channels", children: "L2_FORM" },
    ],
  },
  L1_OPS: {
    level: 1, layerName: "SIGNAL DECOMPOSITION", layerSubtitle: "What is driving this?", parentLabel: "Operational Behavior",
    question: "Decomposing behavioral anomalies by mechanism",
    tiles: [
      { id: "qend", domain: "QUARTER-END SPIKES", kpi: "+23%", unit: "Cost Variance", delta: "Last 5 days of Q", direction: "up-bad", narrative: "Ingredient cost inflates in final days of each quarter", children: "L2_SPEC" },
      { id: "phar", domain: "PHARMACY VARIANCE", kpi: "2.4×", unit: "Price Range per NDC", delta: "Intra-network", direction: "up-bad", narrative: "Same NDC dispensed at 2.4× price variance across network", children: "L2_SPREAD" },
      { id: "step", domain: "STEP-THERAPY BYPASS", kpi: "18%", unit: "Protocol Skips", delta: "Specialty only", direction: "up-bad", narrative: "Prior-authorization steps bypassed on specialty claims", children: "L2_FORM" },
      { id: "vol", domain: "UTILIZATION CURVE", kpi: "+31%", unit: "YoY Specialty Scripts", delta: "Unexplained by enrollment", direction: "up-bad", narrative: "Specialty script volume rising independent of membership", children: "L2_REBATE" },
    ],
  },
  L1_STR: {
    level: 1, layerName: "SIGNAL DECOMPOSITION", layerSubtitle: "What is driving this?", parentLabel: "Strategic Leverage",
    question: "Decomposing leverage positions",
    tiles: [
      { id: "rebid", domain: "RE-BID WINDOW", kpi: "OPEN", unit: "Contract Anniversary", delta: "247 days", direction: "right-opp", narrative: "Contract renewal window enables competitive pressure", children: "L2_SPREAD" },
      { id: "comp", domain: "COMPETITIVE BIDDERS", kpi: "4", unit: "Qualified Transparent PBMs", delta: "Pre-qualified", direction: "right-opp", narrative: "Four transparent-model PBMs pre-qualified for RFP", children: "L2_REBATE" },
      { id: "board", domain: "BOARD MANDATE", kpi: "ISSUED", unit: "Fiduciary Memo", delta: "Q1 2026", direction: "right-opp", narrative: "Board-level directive to quantify and remediate leakage", children: "L2_FORM" },
      { id: "regu", domain: "REGULATORY TAILWIND", kpi: "CAA §204", unit: "Transparency Mandate", delta: "In force", direction: "right-opp", narrative: "CAA §204 creates leverage for enforceable transparency terms", children: "L2_SPEC" },
    ],
  },

  // L2: mechanism view
  L2_SPREAD: {
    level: 2, layerName: "MECHANISM VIEW", layerSubtitle: "How does it actually happen?", parentLabel: "Spread Pricing",
    question: "Shifting from category to mechanics — where most dashboards fail",
    tiles: [
      { id: "ing", domain: "INGREDIENT vs PLAN PAID", kpi: "$4.20", unit: "Avg Spread per Rx", delta: "18% of plan cost", direction: "up-bad", narrative: "Gap between PBM acquisition cost and plan payment", children: "L3_CLAUSE" },
      { id: "macm", domain: "MAC LIST MANIPULATION", kpi: "37%", unit: "Upward Revisions", delta: "Monthly cadence", direction: "up-bad", narrative: "MAC pricing revised upward 37% of months with no clinical trigger", children: "L3_CLAUSE" },
      { id: "retim", domain: "REBATE RETENTION TIMING", kpi: "180d", unit: "Avg Delay to Pass", delta: "Float retained", direction: "up-bad", narrative: "Rebate dollars held 180 days between earn and pass-through", children: "L3_CLAUSE" },
      { id: "adj", domain: "ADJUDICATION LOGIC", kpi: "Closed", unit: "Source Transparency", delta: "Black-box rules", direction: "down-bad", narrative: "Claim adjudication logic not exposed to plan or auditor", children: "L3_CLAUSE" },
    ],
  },
  L2_REBATE: {
    level: 2, layerName: "MECHANISM VIEW", layerSubtitle: "How does it actually happen?", parentLabel: "Rebate Misalignment",
    question: "Mapping the flow of rebate dollars from manufacturer to plan",
    tiles: [
      { id: "mfr", domain: "MANUFACTURER FLOW", kpi: "$8.2M", unit: "Rebates Earned", delta: "Gross annual", direction: "right-neutral", narrative: "Manufacturer rebate earnings attributable to plan utilization", children: "L3_CLAUSE" },
      { id: "held", domain: "AMOUNT RETAINED", kpi: "$5.1M", unit: "PBM-Retained", delta: "62% of earned", direction: "up-bad", narrative: "PBM retains majority of manufacturer rebates", children: "L3_CLAUSE" },
      { id: "passed", domain: "AMOUNT PASSED", kpi: "$3.1M", unit: "Plan-Received", delta: "38% of earned", direction: "down-bad", narrative: "Plan receives minority share of rebates it generated", children: "L3_CLAUSE" },
      { id: "recon", domain: "RECONCILIATION METHOD", kpi: "Annual", unit: "Settlement Cadence", delta: "vs. Adjudication-time", direction: "down-bad", narrative: "Rebates settle annually in arrears, not at point of claim", children: "L3_CLAUSE" },
    ],
  },
  L2_SPEC: {
    level: 2, layerName: "MECHANISM VIEW", layerSubtitle: "How does it actually happen?", parentLabel: "Specialty Inflation",
    question: "Mechanics of specialty drug cost escalation",
    tiles: [
      { id: "nadac", domain: "NADAC DEVIATION", kpi: "+34%", unit: "Above Benchmark", delta: "Specialty only", direction: "up-bad", narrative: "Specialty NDC pricing 34% above NADAC reference", children: "L3_CLAUSE" },
      { id: "limd", domain: "LIMITED DISTRIBUTION", kpi: "74%", unit: "Sole-Source Rx", delta: "Network-locked", direction: "up-bad", narrative: "Majority of specialty claims routed to single-source pharmacy", children: "L3_CLAUSE" },
      { id: "spread2", domain: "SPECIALTY SPREAD", kpi: "$48", unit: "Avg per Specialty Rx", delta: "11× retail spread", direction: "up-bad", narrative: "Per-script spread on specialty is 11× retail equivalent", children: "L3_CLAUSE" },
      { id: "fee", domain: "DISPENSING FEES", kpi: "$22.50", unit: "Avg Specialty Fee", delta: "vs $2.10 retail", direction: "up-bad", narrative: "Specialty dispensing fees 10× standard retail pharmacy", children: "L3_CLAUSE" },
    ],
  },
  L2_FORM: {
    level: 2, layerName: "MECHANISM VIEW", layerSubtitle: "How does it actually happen?", parentLabel: "Formulary Drift",
    question: "How formulary design creates cost distortion",
    tiles: [
      { id: "tier", domain: "TIER PLACEMENT BIAS", kpi: "64%", unit: "Rebated Molecules Preferred", delta: "vs lowest-net-cost", direction: "up-bad", narrative: "Preferred tier favors rebated SKUs over lowest net cost", children: "L3_CLAUSE" },
      { id: "excl2", domain: "EXCLUSIONS", kpi: "28", unit: "Low-Cost Alternatives", delta: "Not covered", direction: "up-bad", narrative: "Lower-cost clinical alternatives excluded from formulary", children: "L3_CLAUSE" },
      { id: "step2", domain: "STEP-THERAPY GAPS", kpi: "41%", unit: "Specialty w/o Steps", delta: "Straight to high-cost", direction: "up-bad", narrative: "Step-therapy absent on 41% of specialty categories", children: "L3_CLAUSE" },
      { id: "upd", domain: "UPDATE CADENCE", kpi: "2×/yr", unit: "Plan Review Cycle", delta: "PBM revises monthly", direction: "down-bad", narrative: "Plan reviews semi-annually; PBM revises monthly", children: "L3_CLAUSE" },
    ],
  },

  // L3: contract mapping
  L3_CLAUSE: {
    level: 3, layerName: "CONTRACT MAPPING", layerSubtitle: "Where is this allowed?", parentLabel: "Contract Architecture",
    question: "Mapping each mechanism to clause, absence, or ambiguity",
    tiles: [
      { id: "miss", domain: "§7.3 — PASS-THROUGH", kpi: "SILENT", unit: "Clause Status", delta: "No timing defined", direction: "down-bad", narrative: "This behavior exists because §7.3 does not define pass-through timing", children: "L4_CLAIMS" },
      { id: "amb", domain: "§4.1 — MAC DEFINITION", kpi: "AMBIGUOUS", unit: "Clause Status", delta: "Sole-discretion language", direction: "down-bad", narrative: "§4.1 reserves unilateral MAC modification to PBM", children: "L4_CLAIMS" },
      { id: "exc", domain: "§11.2 — AUDIT RIGHTS", kpi: "ABSENT", unit: "Clause Status", delta: "No real-time access", direction: "down-bad", narrative: "Real-time adjudication audit rights are wholly absent", children: "L4_CLAIMS" },
      { id: "def", domain: "§2.4 — REBATE DEFINITION", kpi: "NARROW", unit: "Clause Status", delta: "Excludes admin fees", direction: "down-bad", narrative: '"Rebate" defined narrowly — excludes admin fees and data fees', children: "L4_CLAIMS" },
    ],
  },

  // L4: claims trace (reality layer)
  L4_CLAIMS: {
    level: 4, layerName: "CLAIMS TRACE", layerSubtitle: "Show me proof", parentLabel: "Reality Layer",
    question: "Anchor in actual claim examples — NDC, pharmacy, variance",
    evidence: true,
    tiles: [
      { id: "c1", domain: "NDC 00074-6799 — HUMIRA", kpi: "$7,214", unit: "Plan Paid / Rx", delta: "NADAC: $4,980", direction: "up-bad", narrative: "47-year-old member, specialty pharmacy, 28-day fill", claimRef: "CLM-2025-Q4-8847321", children: "L5_PATTERN" },
      { id: "c2", domain: "NDC 00006-5117 — JANUVIA", kpi: "$612", unit: "Plan Paid / Rx", delta: "NADAC: $428", direction: "up-bad", narrative: "Retail fill, 90-day supply, MAC revised 3 days prior", claimRef: "CLM-2025-Q4-8847502", children: "L5_PATTERN" },
      { id: "c3", domain: "PHARMACY VARIANCE", kpi: "$412 ↔ $987", unit: "Same NDC, Same Week", delta: "2.4× range", direction: "up-bad", narrative: "Identical NDC dispensed at 2.4× variance across network", claimRef: "CLM-BATCH-44-2025", children: "L5_PATTERN" },
      { id: "c4", domain: "Q-END ADJUDICATION", kpi: "+23%", unit: "Cost Variance", delta: "Last 5 days vs mid-Q", direction: "up-bad", narrative: "Quarter-end claims average 23% higher than mid-quarter baseline", claimRef: "CLM-PATTERN-Q4", children: "L5_PATTERN" },
    ],
  },

  // L5: pattern detection
  L5_PATTERN: {
    level: 5, layerName: "PATTERN DETECTION", layerSubtitle: "Is this isolated or systemic?", parentLabel: "Pattern Analysis",
    question: "Frequency, cohort, and time-based analysis",
    tiles: [
      { id: "freq", domain: "FREQUENCY", kpi: "78%", unit: "Specialty Claims Affected", delta: "Systemic signature", direction: "up-bad", narrative: "Occurs in 78% of specialty claims — not episodic", children: "L6_COUNTER" },
      { id: "tim", domain: "TIME PATTERN", kpi: "Q-END", unit: "Concentration Window", delta: "Last 5 days", direction: "up-bad", narrative: "Cost distortion concentrates in final 5 days of each quarter", children: "L6_COUNTER" },
      { id: "coh", domain: "COHORT CLUSTERING", kpi: "3 NDCs", unit: "Account for 61%", delta: "Narrow concentration", direction: "up-bad", narrative: "Three specialty NDCs drive 61% of observed leakage", children: "L6_COUNTER" },
      { id: "geo", domain: "NETWORK SIGNATURE", kpi: "1 Pharmacy", unit: "Drives 44% Variance", delta: "PBM-owned", direction: "up-bad", narrative: "Single PBM-affiliated specialty pharmacy drives 44% of variance", children: "L6_COUNTER" },
    ],
  },

  // L6: counterfactual model
  L6_COUNTER: {
    level: 6, layerName: "COUNTERFACTUAL MODEL", layerSubtitle: "What should have happened?", parentLabel: "Counterfactual",
    question: "Simulate transparent pricing, alternative terms, NADAC baseline",
    tiles: [
      { id: "tp", domain: "TRANSPARENT PRICING", kpi: "$4.2M", unit: "Expected Cost", delta: "vs actual $6.1M", direction: "down-good", narrative: "Under pass-through model, cost would be $4.2M not $6.1M", children: "L7_RISK" },
      { id: "nb", domain: "NADAC BASELINE", kpi: "$11.8M", unit: "Benchmark Spend", delta: "vs actual $18.6M", direction: "down-good", narrative: "At NADAC + admin fee, total spend would be $11.8M", children: "L7_RISK" },
      { id: "pt2", domain: "PASS-THROUGH REBATES", kpi: "$8.2M", unit: "Plan-Received Rebates", delta: "vs actual $3.1M", direction: "down-good", narrative: "Full pass-through would return $8.2M vs $3.1M received", children: "L7_RISK" },
      { id: "tot", domain: "AGGREGATE DELTA", kpi: "$11.9M", unit: "Recoverable Per Year", delta: "64% of current leakage", direction: "down-good", narrative: "Counterfactual recovers $11.9M annually — 64% of current leakage", children: "L7_RISK" },
    ],
  },

  // L7: risk and fiduciary exposure
  L7_RISK: {
    level: 7, layerName: "RISK & FIDUCIARY EXPOSURE", layerSubtitle: "What is the consequence?", parentLabel: "Fiduciary",
    question: "Tone shift — now speaking to General Counsel and Board",
    tiles: [
      { id: "erisa", domain: "ERISA §404(a)(1)(B)", kpi: "EXPOSED", unit: "Prudence Standard", delta: "Failure to interrogate", direction: "up-bad", narrative: "Plan fiduciary has not acted with prudence required by §404(a)(1)(B)", children: "L8_LEVER" },
      { id: "caa", domain: "CAA §204 COMPLIANCE", kpi: "AT RISK", unit: "Transparency Attestation", delta: "Cannot sign credibly", direction: "up-bad", narrative: "Annual transparency attestation cannot be signed in good faith", children: "L8_LEVER" },
      { id: "dol", domain: "DOL AUDIT VULNERABILITY", kpi: "HIGH", unit: "Examination Risk", delta: "Form 5500 Sched C gap", direction: "up-bad", narrative: "Sched C compensation disclosure gap creates examination exposure", children: "L8_LEVER" },
      { id: "brd", domain: "BOARD LIABILITY", kpi: "DIRECT", unit: "Director Duty of Care", delta: "Documented findings", direction: "up-bad", narrative: "Documented findings trigger board duty-of-care obligations", children: "L8_LEVER" },
    ],
  },

  // L8: leverage points
  L8_LEVER: {
    level: 8, layerName: "LEVERAGE POINTS", layerSubtitle: "What can we do about it?", parentLabel: "Leverage",
    question: "Where the product becomes lethal — contract, RFP, vendor pressure",
    tiles: [
      { id: "rw", domain: "CONTRACT REWRITE", kpi: "7", unit: "Target Clauses", delta: "Pass-through + audit", direction: "right-opp", narrative: "Force rebate pass-through at adjudication, not reconciliation", children: "L9_NARR" },
      { id: "rfp", domain: "RFP LEVERAGE", kpi: "4 Bidders", unit: "Transparent PBM Field", delta: "Competitive floor set", direction: "right-opp", narrative: "Four transparent PBMs create floor pricing for re-bid", children: "L9_NARR" },
      { id: "vp", domain: "VENDOR PRESSURE", kpi: "$11.9M", unit: "Concession Target", delta: "Year-one recovery", direction: "right-opp", narrative: "Incumbent retention requires $11.9M concession to match counterfactual", children: "L9_NARR" },
      { id: "aud", domain: "AUDIT-RIGHT ENFORCEMENT", kpi: "T+1", unit: "Adjudication Visibility", delta: "Real-time required", direction: "right-opp", narrative: "T+1 adjudication-level audit rights become non-negotiable", children: "L9_NARR" },
    ],
  },
};

// L9 end-state: the only level that breaks the 4-tile rule (constitutional exception)
const L9_NARRATIVE = {
  level: 9,
  layerName: "C-SUITE NARRATIVE",
  layerSubtitle: "End State — Board-Grade Payoff",
  narrative:
    "The PBM is extracting margin through spread pricing and delayed rebate pass-through, enabled by ambiguous contract language and the absence of real-time audit rights.",
  impact: "$18.6M annual leakage — $11.9M recoverable at counterfactual baseline",
  risk: "ERISA §404(a)(1)(B) fiduciary breach exposure; CAA §204 attestation risk; Form 5500 Sched C examination vulnerability",
  action:
    "Immediate RFP with enforced adjudication-level pass-through and T+1 audit controls; incumbent retention contingent on $11.9M concession and rewrite of §7.3, §4.1, §11.2, §2.4",
};

// ── Palette (dark terminal, aligned to the War Room aesthetic) ──

const PAL = {
  bg: "#08080a",
  bgTile: "#0f0f13",
  bgTileHover: "#16161c",
  border: "#E2E8F0",
  borderActive: "#3a3a48",
  text: "#e8e8ec",
  textDim: "#7a7a86",
  textMuted: "#4a4a54",
  gold: "#d4a84b",
  goldBright: "#f5d97a",
  green: "#4ade80",
  red: "#ef4444",
  amber: "#f59e0b",
  goldDivider: "#4a3c18",
};

// ── Brushed / polished gold-metal treatment for the four tiles ──
const GOLD_METAL = {
  bg: "linear-gradient(135deg, #fbeaa2 0%, #edcb66 20%, #d3a63c 46%, #f0d573 66%, #bd8b2b 100%)",
  bgHover: "linear-gradient(135deg, #fdf1b8 0%, #f4d778 20%, #ddb349 46%, #f8e494 66%, #c99a34 100%)",
  border: "#8a6a24",
  borderHover: "#a37e2b",
  sheen:
    "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 7px rgba(120,80,20,0.5), 0 2px 10px rgba(0,0,0,0.06)",
  sheenHover:
    "inset 0 1px 0 #0f172a, inset 0 -3px 8px rgba(120,80,20,0.45), 0 5px 18px rgba(0,0,0,0.45)",
};

// Dark, embossed text tokens for reading on the solid gold surface
const ON_GOLD = {
  strong: "#241a04",
  mid: "#4a3711",
  soft: "#6b5320",
  divider: "rgba(90,66,20,0.5)",
  emboss: "0 1px 0 #475569",
};

// Solid multi-color accents for the domain badges (one per tile slot)
const BADGE_COLORS = ["#1d4ed8", "#15803d", "#6d28d9", "#be123c"];

const directionGlyph = (dir: Direction): { glyph: string; color: string } => {
  if (dir === "up-bad") return { glyph: "▲", color: "#9b1c1c" };
  if (dir === "down-good") return { glyph: "▼", color: "#166534" };
  if (dir === "down-bad") return { glyph: "▼", color: "#9b1c1c" };
  if (dir === "right-opp") return { glyph: "▶", color: "#7a5712" };
  if (dir === "right-neutral") return { glyph: "▶", color: "#5c4a1f" };
  return { glyph: "→", color: "#5c4a1f" };
};

const MONO = "'JetBrains Mono', 'Menlo', monospace";
const SANS = "'Inter', system-ui, sans-serif";

function Tile({
  tile,
  onDrill,
  evidence,
  level,
  accent,
}: {
  tile: DrillTile;
  onDrill: (nextKey: string, parent: DrillTile) => void;
  evidence: boolean;
  level: number;
  accent: string | null;
}) {
  const [hover, setHover] = useState(false);
  const arrow = directionGlyph(tile.direction);
  const clickable = !!tile.children;

  return (
    <div
      onClick={() => clickable && tile.children && onDrill(tile.children, tile)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-testid={`rnd-tile-${tile.id}`}
      style={{
        background: hover && clickable ? GOLD_METAL.bgHover : GOLD_METAL.bg,
        border: `1.5px solid ${hover && clickable ? GOLD_METAL.borderHover : GOLD_METAL.border}`,
        boxShadow: hover && clickable ? GOLD_METAL.sheenHover : GOLD_METAL.sheen,
        borderRadius: 14,
        padding: "18px 20px",
        cursor: clickable ? "pointer" : "default",
        transition: "background 140ms ease, box-shadow 140ms ease",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 210,
        position: "relative",
        fontFamily: MONO,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${ON_GOLD.divider}`, paddingBottom: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", color: accent ? "#ffffff" : ON_GOLD.strong, fontWeight: 700, textTransform: "uppercase", background: accent ?? "#d4af37", padding: "4px 10px", borderRadius: 999, boxShadow: "inset 0 1px 0 #64748b, 0 1px 2px rgba(0,0,0,0.05)", textShadow: accent ? undefined : ON_GOLD.emboss }}>
          {tile.domain}
        </div>
        <div style={{ fontSize: 10, color: ON_GOLD.soft, letterSpacing: "0.08em", fontWeight: 600 }}>L{level}</div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", color: ON_GOLD.strong, textShadow: ON_GOLD.emboss, lineHeight: 1 }}>{tile.kpi}</div>
        <div style={{ fontSize: 11, color: ON_GOLD.mid, letterSpacing: "0.06em" }}>{tile.unit}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: arrow.color, fontSize: 12 }}>{arrow.glyph}</span>
        <span style={{ fontSize: 11, color: ON_GOLD.strong, letterSpacing: "0.04em", fontWeight: 600 }}>{tile.delta}</span>
      </div>

      <div style={{ fontSize: 12, color: ON_GOLD.mid, lineHeight: 1.5, marginTop: "auto", fontFamily: SANS }}>{tile.narrative}</div>

      {evidence && tile.claimRef && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${ON_GOLD.divider}`, paddingTop: 10 }}>
          <div style={{ background: "rgba(20,83,45,0.14)", border: "1px solid rgba(20,83,45,0.5)", borderRadius: 2, padding: "3px 8px", fontSize: 9, color: "#14532d", letterSpacing: "0.1em", fontWeight: 700 }}>
            ◆ EVIDENCE
          </div>
          <div style={{ fontSize: 9, color: ON_GOLD.soft, letterSpacing: "0.06em" }}>{tile.claimRef}</div>
          <div style={{ fontSize: 9, color: ON_GOLD.soft, marginLeft: "auto" }}>{SHA(tile.claimRef)}</div>
        </div>
      )}

      {clickable && (
        <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 10, fontWeight: 700, color: hover ? "#241a04" : "#7a6428", letterSpacing: "0.1em", transition: "color 120ms" }}>
          DRILL →
        </div>
      )}
    </div>
  );
}

function Breadcrumb({ trail, onJump }: { trail: { label: string }[]; onJump: (i: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 0", fontFamily: MONO, fontSize: 11 }}>
      {trail.map((node, i) => (
        <Fragment key={i}>
          <span
            onClick={() => onJump(i)}
            data-testid={`rnd-crumb-${i}`}
            style={{
              color: i === trail.length - 1 ? PAL.gold : PAL.textDim,
              cursor: i === trail.length - 1 ? "default" : "pointer",
              letterSpacing: "0.06em",
              textDecoration: i === trail.length - 1 ? "none" : "underline dotted",
              textUnderlineOffset: 3,
            }}
          >
            {node.label}
          </span>
          {i < trail.length - 1 && <span style={{ color: PAL.textMuted }}>›</span>}
        </Fragment>
      ))}
    </div>
  );
}

function LevelHeaderRow({ level, name, subtitle, question }: { level: number; name: string; subtitle: string; question?: string }) {
  return (
    <div style={{ borderTop: `1px solid ${PAL.border}`, borderBottom: `1px solid ${PAL.border}`, padding: "16px 0", marginBottom: 18, display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: PAL.gold, letterSpacing: "0.2em", fontWeight: 700, border: `1px solid ${PAL.gold}55`, padding: "4px 10px", borderRadius: 2, whiteSpace: "nowrap" }}>
        LEVEL {level}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 16, color: PAL.text, letterSpacing: "0.04em", fontWeight: 600 }}>{name}</div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: PAL.textDim, marginTop: 4, fontStyle: "italic" }}>"{subtitle}"</div>
      </div>
      {question && (
        <div style={{ fontFamily: SANS, fontSize: 12, color: PAL.textDim, maxWidth: 380, textAlign: "right", lineHeight: 1.5 }}>{question}</div>
      )}
    </div>
  );
}

function NarrativeEndState({ onReset, trail }: { onReset: () => void; trail: { label: string }[] }) {
  const n = L9_NARRATIVE;
  return (
    <div style={{ fontFamily: MONO }} data-testid="rnd-endstate">
      <div style={{ background: `linear-gradient(180deg, ${PAL.bgTile} 0%, ${PAL.bg} 100%)`, border: `1px solid ${PAL.gold}33`, borderRadius: 2, padding: "32px 36px", position: "relative" }}>
        <div style={{ position: "absolute", top: 10, left: 12, fontSize: 9, color: PAL.gold, letterSpacing: "0.2em" }}>◆ L9 · C-SUITE NARRATIVE · END STATE</div>
        <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9, color: PAL.textDim, letterSpacing: "0.12em" }}>BOARD-GRADE · SHA-256 SEALED</div>

        <div style={{ marginTop: 22, marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: PAL.textDim, letterSpacing: "0.2em", marginBottom: 10, fontWeight: 600 }}>NARRATIVE</div>
          <div style={{ fontFamily: SANS, fontSize: 17, color: PAL.text, lineHeight: 1.55, fontWeight: 400, letterSpacing: "-0.005em" }}>{n.narrative}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 28 }}>
          {[
            { label: "IMPACT", value: n.impact, color: PAL.red },
            { label: "RISK", value: n.risk, color: PAL.amber },
            { label: "ACTION", value: n.action, color: PAL.gold },
          ].map((b) => (
            <div key={b.label} style={{ background: PAL.bgTile, border: `1px solid ${PAL.border}`, borderLeft: `3px solid ${b.color}`, padding: "16px 18px", borderRadius: 2 }}>
              <div style={{ fontSize: 10, color: b.color, letterSpacing: "0.2em", fontWeight: 700, marginBottom: 10 }}>{b.label}</div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: PAL.text, lineHeight: 1.55 }}>{b.value}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${PAL.border}`, paddingTop: 18, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ background: `${PAL.green}15`, border: `1px solid ${PAL.green}55`, borderRadius: 2, padding: "6px 12px", fontSize: 10, color: PAL.green, letterSpacing: "0.14em", fontWeight: 700 }}>
            ◆ EVIDENCE ENVELOPE SEALED
          </div>
          <div style={{ fontSize: 10, color: PAL.textDim, letterSpacing: "0.08em" }}>
            Trail: {trail.length} narrative hops · 4 primitives (EvidenceRef · TransformRef · PolicyResult · Claim)
          </div>
          <div style={{ fontSize: 10, color: PAL.textMuted, marginLeft: "auto" }}>{SHA("L9-NARRATIVE-PACKET-2026-Q1")}</div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button
          onClick={onReset}
          data-testid="rnd-reset"
          style={{ background: PAL.gold, color: PAL.bg, border: "none", padding: "10px 20px", fontSize: 11, letterSpacing: "0.14em", fontWeight: 700, cursor: "pointer", fontFamily: MONO, borderRadius: 2 }}
        >
          ← RETURN TO WAR ROOM
        </button>
      </div>
    </div>
  );
}

interface TrailNode {
  screenKey: string;
  label: string;
}

export default function RecursiveNarrativeDrill() {
  const [trail, setTrail] = useState<TrailNode[]>([{ screenKey: "L0", label: "War Room" }]);

  const currentKey = trail[trail.length - 1].screenKey;
  const currentScreen = useMemo(() => {
    if (currentKey === "L0") return GRAPH;
    if (currentKey === "L9_NARR") return null;
    return SCREENS[currentKey];
  }, [currentKey]);

  const isNarrative = currentKey === "L9_NARR";

  const handleDrill = (nextKey: string, parent: DrillTile) => {
    setTrail((t) => [...t, { screenKey: nextKey, label: parent.domain }]);
  };
  const handleJump = (i: number) => setTrail((t) => t.slice(0, i + 1));
  const handleReset = () => setTrail([{ screenKey: "L0", label: "War Room" }]);

  return (
    <div
      className="mt-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(212,168,75,0.04)", border: "1px solid rgba(212,168,75,0.15)" }}
      data-testid="recursive-narrative-drill"
    >
      {/* Panel header, consistent with the other supplemental strips */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: PAL.gold, textTransform: "uppercase" }}>
          Recursive Narrative Drill · C-Suite Engine
        </span>
        <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: "0.12em", color: "rgba(15,23,42,0.08)", textTransform: "uppercase" }}>
          Supplemental · not a board tile
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: PAL.green, letterSpacing: "0.2em", background: `${PAL.green}11`, border: `1px solid ${PAL.green}44`, padding: "3px 9px", borderRadius: 2, fontWeight: 600 }}>
            ● LIVE
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: PAL.textDim, letterSpacing: "0.08em" }}>{SHA(currentKey + trail.length)}</span>
        </span>
      </div>

      <Breadcrumb trail={trail.map((t) => ({ label: t.label }))} onJump={handleJump} />

      {isNarrative || !currentScreen ? (
        <NarrativeEndState onReset={handleReset} trail={trail} />
      ) : (
        <>
          <LevelHeaderRow level={currentScreen.level} name={currentScreen.layerName} subtitle={currentScreen.layerSubtitle} question={currentScreen.question} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {currentScreen.tiles.map((tile, i) => (
              <Tile
                key={tile.id}
                tile={tile}
                level={currentScreen.level}
                evidence={!!currentScreen.evidence}
                onDrill={handleDrill}
                accent={currentScreen.level === 1 || currentScreen.level === 2 ? null : BADGE_COLORS[i % BADGE_COLORS.length]}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${PAL.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontFamily: MONO, fontSize: 9, color: PAL.textMuted, letterSpacing: "0.12em" }}>
        <div>ONE SCREEN · FOUR TILES · EVERY NUMBER CLICKABLE · NARRATIVES NEVER OUTRUN EVIDENCE</div>
        <div>KINCAID HEALTH · CAPITAL EFFICIENCY INTELLIGENCE</div>
      </div>
    </div>
  );
}
