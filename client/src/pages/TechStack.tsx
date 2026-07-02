import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  Radio, Network, Lock, BrainCircuit, ShieldCheck,
  FlaskConical, LayoutDashboard, Puzzle,
  ChevronDown, ChevronUp, Zap, Database, GitBranch,
  Cpu, Eye, Globe, Code2, Activity,
} from "lucide-react";

// ─── Layer Data ───────────────────────────────────────────────────────────────

interface StackLayer {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  philosophy: string;
  accent: string;
  glow: string;
  border: string;
  from: string;
  via: string;
  icon: React.ElementType;
  components: { label: string; desc: string; tag?: string }[];
  metrics?: { label: string; value: string }[];
}

const LAYERS: StackLayer[] = [
  {
    id: "ingestion",
    number: "01",
    title: "Ingestion & Telemetry",
    subtitle: "The Nervous System",
    philosophy: "High-velocity, format-agnostic ingestion",
    accent: "#00A8FF",
    glow: "rgba(0,168,255,0.3)",
    border: "border-blue-700/40",
    from: "from-blue-950/70",
    via: "via-sky-950/50",
    icon: Radio,
    components: [
      { label: "Kafka Streaming Telemetry", desc: "Millions of claims and IoT biometric events ingested in real-time", tag: "Real-time" },
      { label: "Bidirectional API Gateways", desc: "Direct ERP, HRIS, and transparent PBM connectivity — no batch-file delays", tag: "Live" },
      { label: "IoT Biometric Ingestion", desc: "Wearable and device data streams for clinical population analytics", tag: "Streaming" },
      { label: "Format Normalization Engine", desc: "EDI 837/835, HL7 FHIR, CSV, JSON → unified canonical schema", tag: "Auto" },
    ],
    metrics: [
      { label: "Events/sec", value: "4.2M" },
      { label: "Latency", value: "<12ms" },
      { label: "Formats", value: "47" },
    ],
  },
  {
    id: "semantic",
    number: "02",
    title: "Semantic & Identity",
    subtitle: "The Translator",
    philosophy: "Bringing order to chaos through deterministic mapping",
    accent: "#A855F7",
    glow: "rgba(168,85,247,0.3)",
    border: "border-purple-700/40",
    from: "from-purple-950/70",
    via: "via-violet-950/50",
    icon: Network,
    components: [
      { label: "Semantic Ontology Engine", desc: "Maps all data to unified standards: NPI, NDC, ICD-10/11, CPT, DRG", tag: "Standard" },
      { label: "Entity Resolution Engine", desc: "Deterministic matching stitches fragmented provider and member identities", tag: "ML" },
      { label: "Property Graph Database", desc: "Maps hidden relationships and potential fraud rings between entities", tag: "Graph" },
      { label: "Clinical Terminology Alignment", desc: "SNOMED CT, LOINC, RxNorm cross-walks for clinical interoperability", tag: "FHIR R4" },
    ],
    metrics: [
      { label: "Entity Match Rate", value: "99.3%" },
      { label: "NDC Coverage", value: "100%" },
      { label: "Fraud Rings ID'd", value: "217" },
    ],
  },
  {
    id: "cryptographic",
    number: "03",
    title: "Cryptographic Evidence Spine",
    subtitle: "The Bedrock",
    philosophy: "Absolute immutability and mathematical proof",
    accent: "#00FF94",
    glow: "rgba(0,255,148,0.3)",
    border: "border-emerald-700/40",
    from: "from-emerald-950/70",
    via: "via-green-950/50",
    icon: Lock,
    components: [
      { label: "Quantum-Resistant Evidence Vault", desc: "Cryptographic hash of every source artifact: claims, contracts, policies — SHA-3 + CRYSTALS-Kyber", tag: "Post-Quantum" },
      { label: "Zero-Knowledge Proofs", desc: "Verify computations were done correctly without exposing underlying PHI", tag: "ZKP" },
      { label: "Immutable Audit Ledger", desc: "Every state transition is signed and chained — board-defensible chain of custody", tag: "Immutable" },
      { label: "Evidence Receipt System", desc: "Each KPI stamped with source hash, transform hash, confidence score, and DQ tests", tag: "Live" },
    ],
    metrics: [
      { label: "Hash Algorithm", value: "SHA-3" },
      { label: "Audit Integrity", value: "100%" },
      { label: "ZK Proof Time", value: "~8ms" },
    ],
  },
  {
    id: "actuarial",
    number: "04",
    title: "Actuarial Computation Engine",
    subtitle: "The Brain",
    philosophy: "Massive parallel simulation and probabilistic forecasting",
    accent: "#FFB800",
    glow: "rgba(255,184,0,0.3)",
    border: "border-amber-700/40",
    from: "from-amber-950/70",
    via: "via-yellow-950/50",
    icon: BrainCircuit,
    components: [
      { label: "DuckDB Distributed Query Engine", desc: "In-process OLAP engine over Parquet data lake — terabyte-scale ad hoc queries in seconds", tag: "DuckDB" },
      { label: "Monte Carlo Simulation Core", desc: "Millions of stochastic models assessing long-tail risk at CVaR99 confidence intervals", tag: "1M+ sims" },
      { label: "Bayesian Network Inference", desc: "Causal inference engine isolating cost drivers beyond correlation to true causation", tag: "Causal AI" },
      { label: "Reinforcement Learning Plan Optimizer", desc: "Discovers optimal plan designs automatically — maximizes EBITDA while preserving employee NPS", tag: "RL" },
    ],
    metrics: [
      { label: "Sim Throughput", value: "2.4M/s" },
      { label: "CVaR Confidence", value: "99%" },
      { label: "Query p95", value: "1.2s" },
    ],
  },
  {
    id: "governance",
    number: "05",
    title: "Governance & Compliance Pipeline",
    subtitle: "The Shield",
    philosophy: "Translating legal code into executable machine code",
    accent: "#FF4D6D",
    glow: "rgba(255,77,109,0.3)",
    border: "border-red-700/40",
    from: "from-red-950/70",
    via: "via-rose-950/50",
    icon: ShieldCheck,
    components: [
      { label: "ERISA/SPD LLM Compiler", desc: "Domain-specific LLMs ingest complex plan documents and convert them into deterministic machine rules", tag: "LLM" },
      { label: "7-Stage Governance Pipeline", desc: "Every transaction passes intake → schema → DQ → compliance → actuarial → evidence → output", tag: "7 Stages" },
      { label: "HIPAA Safe Harbor Engine", desc: "Continuous k-Anonymity enforcement — PHI de-identification before every computation", tag: "HIPAA" },
      { label: "Continuous Auditing Framework", desc: "Real-time audit feeds to legal, compliance, and board — no post-hoc reconstruction", tag: "Real-time" },
    ],
    metrics: [
      { label: "Compliance Rate", value: "100%" },
      { label: "HIPAA Violations", value: "0" },
      { label: "Audit Coverage", value: "100%" },
    ],
  },
  {
    id: "clinical",
    number: "06",
    title: "Clinical & Financial Intelligence",
    subtitle: "The Applications",
    philosophy: "Translating data into immediate financial action",
    accent: "#06B6D4",
    glow: "rgba(6,182,212,0.3)",
    border: "border-cyan-700/40",
    from: "from-cyan-950/70",
    via: "via-sky-950/50",
    icon: FlaskConical,
    components: [
      { label: "Drug Shock Early Warning System", desc: "Detects NDC pricing anomalies vs. NADAC benchmark in real-time — triggers alert at >15% deviation", tag: "EWS" },
      { label: "Stop-Loss Fair Value Calculator", desc: "Actuarially prices specific and aggregate stop-loss with credibility-weighted trend factors", tag: "Actuarial" },
      { label: "Clinical Efficacy Scoring Engine", desc: "Scores drugs and interventions by evidence quality, utilization pattern, and cost-effectiveness", tag: "HEOR" },
      { label: "Carrier Adjudication Shadow", desc: "Shadows carrier adjudication in real-time — catches payment errors the millisecond they occur", tag: "Real-time" },
    ],
    metrics: [
      { label: "Error Catch Rate", value: "99.7%" },
      { label: "NADAC Coverage", value: "100%" },
      { label: "Avg Recovery/Yr", value: "$2.1M" },
    ],
  },
  {
    id: "control-plane",
    number: "07",
    title: "Executive Control Plane",
    subtitle: "The UI/UX",
    philosophy: "Consumer-grade simplicity masking military-grade complexity",
    accent: "#F97316",
    glow: "rgba(249,115,22,0.3)",
    border: "border-orange-700/40",
    from: "from-orange-950/70",
    via: "via-amber-950/50",
    icon: LayoutDashboard,
    components: [
      { label: "Conversational AI NL Interface", desc: "Query complex financials in plain English — zero SQL required, 100% cryptographically verified answers", tag: "GPT-4o" },
      { label: "Predictive Scenario Planning UI", desc: "Dynamic sliders for plan design changes — instant EBITDA, claims, and NPS impact projections", tag: "Live" },
      { label: "Custom KPI Builder", desc: "Drag-and-drop metric composer with McKinsey/Bain/Gartner framework templates", tag: "No-code" },
      { label: "Board-Level Presentation Mode", desc: "One-click certified data compilation into C-Suite and board-ready decks with evidence receipts", tag: "Certified" },
    ],
    metrics: [
      { label: "Query Response", value: "<2s" },
      { label: "Scenarios/Run", value: "1M+" },
      { label: "Pages Built", value: "57" },
    ],
  },
  {
    id: "extensibility",
    number: "08",
    title: "Ecosystem Extensibility",
    subtitle: "The Future",
    philosophy: "Kincaid IQ as the central hub of a new economy",
    accent: "#8B5CF6",
    glow: "rgba(139,92,246,0.3)",
    border: "border-violet-700/40",
    from: "from-violet-950/70",
    via: "via-purple-950/50",
    icon: Puzzle,
    components: [
      { label: "Actuarial Data Science Workbench", desc: "Integrated Jupyter notebooks with full access to certified data lake — no data science team needed", tag: "Jupyter" },
      { label: "Open-Source Contribution Protocol", desc: "Community-vetted actuarial models submitted, peer-reviewed, and promoted to production", tag: "Open" },
      { label: "Developer Community API Layer", desc: "Third parties build clinical and financial apps on top of Kincaid IQ certified data foundation", tag: "REST/gRPC" },
      { label: "Mobile War Room App", desc: "Critical alerts, KPI snapshots, and one-tap board escalation — iOS and Android", tag: "Mobile" },
    ],
    metrics: [
      { label: "API Endpoints", value: "340+" },
      { label: "Partner Apps", value: "Coming" },
      { label: "SDK Languages", value: "6" },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function LayerCard({ layer, index }: { layer: StackLayer; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = layer.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-r
        ${layer.from} ${layer.via} to-zinc-900/40 ${layer.border}
        transition-all duration-300 cursor-pointer
        hover:scale-[1.005] hover:shadow-2xl`}
      style={{ boxShadow: `0 0 0 1px ${layer.accent}15` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 32px ${layer.glow}, 0 0 0 1px ${layer.accent}30`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${layer.accent}15`; }}
      onClick={() => setExpanded(v => !v)}
      data-testid={`layer-card-${layer.id}`}
    >
      {/* Layer number watermark */}
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[96px] font-black opacity-[0.04] leading-none select-none"
        style={{ color: layer.accent }}>
        {layer.number}
      </div>

      {/* Orb */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 animate-pulse"
        style={{ background: layer.accent }} />

      {/* Main row */}
      <div className="relative z-10 p-5 flex items-center gap-5">
        {/* Icon + number */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${layer.accent}15`, border: `1px solid ${layer.accent}30` }}>
            <Icon size={22} style={{ color: layer.accent }} />
          </div>
          <span className="text-[10px] font-mono font-bold" style={{ color: `${layer.accent}80` }}>
            L{layer.number}
          </span>
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-zinc-100">{layer.title}</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: `${layer.accent}15`, color: layer.accent, border: `1px solid ${layer.accent}30` }}>
              {layer.subtitle}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 italic">"{layer.philosophy}"</p>
          {/* Metrics row */}
          {layer.metrics && (
            <div className="flex gap-4 mt-2 flex-wrap">
              {layer.metrics.map(m => (
                <div key={m.label} className="flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{m.label}</span>
                  <span className="text-sm font-bold" style={{ color: layer.accent }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-600 transition-colors"
          data-testid={`expand-${layer.id}`}
        >
          {expanded
            ? <ChevronUp size={14} className="text-zinc-400" />
            : <ChevronDown size={14} className="text-zinc-400" />}
        </button>
      </div>

      {/* Expanded components */}
      {expanded && (
        <div className="relative z-10 px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-zinc-800/60">
          {layer.components.map((c, i) => (
            <div key={i} className="rounded-xl p-3 bg-zinc-900/50 border border-zinc-800/60">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-zinc-200 leading-snug">{c.label}</span>
                {c.tag && (
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                    style={{ background: `${layer.accent}15`, color: layer.accent, border: `1px solid ${layer.accent}25` }}>
                    {c.tag}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TechStack() {
  const [allExpanded, setAllExpanded] = useState(false);

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
                Kincaid IQ Technology Architecture
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Deterministic Financial Operating System · Zero-Trust Fiduciary Intelligence · 8-Layer Stack
              </p>
            </div>
            <button
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-all"
              onClick={() => setAllExpanded(v => !v)}
              data-testid="expand-all-btn"
            >
              {allExpanded ? "Collapse All" : "Expand All Layers"}
            </button>
          </div>

          {/* Architecture summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { icon: Zap, label: "Immutable at Bottom", color: "#00FF94" },
              { icon: Database, label: "Infinitely Scalable", color: "#00A8FF" },
              { icon: Eye, label: "Effortlessly Simple", color: "#FFB800" },
              { icon: ShieldCheck, label: "Board-Defensible Truth", color: "#A855F7" },
            ].map(p => (
              <div key={p.label}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800/60 bg-zinc-900/40">
                <p.icon size={14} style={{ color: p.color }} />
                <span className="text-xs font-semibold text-zinc-300">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stack diagram label */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Stack Layers — click any to expand</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        </div>

        {/* Layer cards — stacked bottom-up visually by reversing index for z-depth feel */}
        <div className="space-y-3" data-testid="stack-layers">
          {LAYERS.map((layer, i) => (
            <LayerCard key={layer.id} layer={layer} index={i} />
          ))}
        </div>

        {/* Footer note */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-4 flex gap-3 items-start">
          <Code2 size={16} className="text-zinc-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-zinc-400 leading-relaxed">
            <span className="text-zinc-200 font-semibold">Design principle:</span>{" "}
            The stack is immutable at the bottom (cryptographic evidence spine), infinitely scalable in the middle
            (actuarial computation + governance pipeline), and effortlessly simple at the top (executive control plane).
            Every calculation is cryptographically verifiable. Every KPI is stamped with a source hash, transform hash,
            DQ test results, and a confidence score — making Kincaid IQ the only platform producing
            board-defensible fiduciary intelligence.
          </p>
        </div>
      </div>
    </Layout>
  );
}
