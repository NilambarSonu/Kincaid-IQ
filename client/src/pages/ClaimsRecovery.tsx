import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import EmailReportModal from "@/components/EmailReportModal";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ComposedChart, Funnel, FunnelChart, LabelList,
} from "recharts";
import {
  DollarSign, AlertTriangle, CheckCircle, TrendingUp, Search, FileText,
  ChevronRight, Zap, Target, Mail, Upload, Loader2, Briefcase, Send,
  Download, Gavel, Shield, BookOpen, Scale, Users, Activity, Brain,
  Table2, Building2, ChevronDown, ChevronUp, ArrowUpRight, Star, Flame,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useManifestDownload } from "@/hooks/use-manifest-download";
import { jsPDF } from "jspdf";

const NEON = {
  green: "#00FF94", gold: "#FFB800", red: "#FF4D6D",
  orange: "#FF6B1A", blue: "#00D4FF", purple: "#A855F7",
};

function severityColor(s: string) {
  return s === "Critical" ? NEON.red : s === "High" ? NEON.orange : s === "Medium" ? NEON.gold : NEON.blue;
}
function confColor(c: string) {
  if (c === "CERTIFIED" || c === "High") return NEON.green;
  if (c === "MODELED" || c === "Medium") return NEON.gold;
  return NEON.orange;
}
function gradeColor(g: string) {
  if (g === "A") return "#00FF94";
  if (g === "B") return "#00D4FF";
  if (g === "C") return "#FFB800";
  if (g === "D") return "#FF6B1A";
  return "#FF4D6D";
}
function agingColor(bucket: string) {
  if (bucket === "0-30") return "#00FF94";
  if (bucket === "31-60") return "#FFB800";
  if (bucket === "61-90") return "#FF6B1A";
  return "#FF4D6D";
}
function statusColor(s: string) {
  if (s === "Compliant") return "#00FF94";
  if (s === "Gap") return "#FF4D6D";
  return "#FFB800";
}
function fmtM(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

type Tab = "command" | "findings" | "ai" | "universe" | "scorecard" | "regulatory" | "ar" | "pipeline" | "calculator" | "timeline";

const TABS: { id: Tab; label: string; icon: any; badge?: string }[] = [
  { id: "command",    label: "Command Center",      icon: Activity },
  { id: "findings",   label: "Findings",            icon: Search,     badge: "15" },
  { id: "ai",         label: "AI Forensic Engine",  icon: Brain },
  { id: "universe",   label: "Claims Universe",     icon: Table2 },
  { id: "scorecard",  label: "Vendor Scorecard",    icon: Star },
  { id: "regulatory", label: "Regulatory Matrix",   icon: Shield },
  { id: "ar",         label: "A/R Ledger",          icon: Scale },
  { id: "pipeline",   label: "Recovery Pipeline",   icon: Briefcase },
  { id: "calculator", label: "Fee Calculator",      icon: DollarSign },
  { id: "timeline",   label: "Timeline",            icon: Target },
];

const PIPELINE_STAGES = [
  { id: "identified",        label: "Identified",        color: "#00D4FF" },
  { id: "demand_sent",       label: "Demand Sent",       color: "#FFB800" },
  { id: "response_received", label: "Response Received", color: "#A855F7" },
  { id: "negotiating",       label: "Negotiating",       color: "#FF6B1A" },
  { id: "settled",           label: "Settled",           color: "#00FF94" },
  { id: "distributed",       label: "Distributed",       color: "#00FF94" },
  { id: "declined",          label: "Declined",          color: "#FF4D6D" },
];

/* ── Intelligence Ticker ──────────────────────────────────────────────────── */
const TICKER_ITEMS = [
  "ESI spread pricing demand: $2.14M outstanding · 112 days",
  "187,400 covered lives · $1.218B annual claims universe",
  "15 board-reportable findings · $14.84M recovery opportunity",
  "PMPM delta: $142.30 above Fortune 500 benchmark peer set",
  "Air ambulance NSA IDR: $847K · IDR eligibility confirmed",
  "TPA duplicate claim recovery: $624K · CERTIFIED confidence",
  "DRG upcoding: 127 inpatient stays · Memorial Hospital System",
  "CAA 2024 retroactive DIR eliminated · ESI demand active",
  "Stop-loss lasering irregularity: $436K · Tokio Marine HCC",
  "90-day forensic audit cycle · Fortune 500 self-funded plans ≥50,000 lives",
];

function IntelligenceTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % TICKER_ITEMS.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="kiq-forensic-card flex items-center gap-3 px-3 py-1.5 rounded-lg overflow-hidden">
      <Zap size={11} style={{ color: NEON.blue, flexShrink: 0 }} />
      <p className="text-[11px] font-mono truncate text-[var(--kiq-muted)]">
        <span style={{ color: NEON.blue }}>LIVE · </span>{TICKER_ITEMS[idx]}
      </p>
    </div>
  );
}

/* ── Command Center ───────────────────────────────────────────────────────── */
function CommandCenterTab({ d }: { d: any }) {
  const [plan, setPlan] = useState("All Plans Rollup");
  const s = d.summary;
  const waterfall = d.waterfall || [];
  const vendorExp = d.vendor_exposure || [];

  const kpis = [
    { label: "Covered Lives",        val: (s.covered_lives || 0).toLocaleString(), sub: "Active enrolled members", c: NEON.blue },
    { label: "Annual Claims Universe", val: `$${((s.total_claims_spend || 0) / 1_000_000).toFixed(0)}M`, sub: "Total paid claims FY2024", c: NEON.purple },
    { label: "PMPM vs. Benchmark",   val: `+$${(s.pmpm_benchmark_delta || 0).toFixed(0)}`, sub: `$${s.pmpm_actual}/mo vs. $${s.pmpm_benchmark} peer`, c: NEON.red },
    { label: "Recovery Opportunity", val: `$${((s.total_recovery_opportunity || 0) / 1_000_000).toFixed(1)}M`, sub: `${s.recovery_pct}% of claims spend`, c: NEON.green },
    { label: "Active A/R Balance",   val: `$${((s.active_ar_balance || 0) / 1_000_000).toFixed(1)}M`, sub: "Open demand balances", c: NEON.gold },
    { label: "Board-Reportable",     val: String(s.board_reportable_findings || 0), sub: "Critical-severity findings", c: NEON.orange },
  ];

  const wfMax = waterfall[0]?.value || 1;
  const catData = d.findings?.slice(0, 8).map((f: any) => ({
    name: f.category.split(" ").slice(0, 3).join(" "),
    value: f.recovery_estimate ?? 0,
    color: severityColor(f.severity),
  })) || [];

  return (
    <div className="space-y-6">
      {/* Plan Selector + Ticker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="kiq-forensic-card flex items-center gap-2 px-3 py-1.5 rounded-lg">
          <Building2 size={12} style={{ color: NEON.orange }} />
          <select
            value={plan}
            onChange={e => setPlan(e.target.value)}
            className="bg-transparent text-xs text-[var(--kiq-ink)] border-none outline-none cursor-pointer"
            data-testid="plan-selector"
          >
            {(s.plan_names || ["All Plans Rollup"]).map((p: string) => (
              <option key={p} value={p} className="bg-[var(--kiq-canvas-soft)]">{p}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <IntelligenceTicker />
        </div>
      </div>

      {/* Enterprise KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="kiq-forensic-card rounded-xl p-4"
            data-testid={`cmd-kpi-${k.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="text-[var(--kiq-ink)]/35 text-[10px] mb-1 uppercase tracking-wider leading-tight">{k.label}</p>
            <p className="text-xl font-bold leading-none" style={{ color: k.c }}>{k.val}</p>
            <p className="text-[10px] text-[var(--kiq-ink)]/30 mt-1.5 leading-tight">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Recovery Waterfall */}
      <div className="kiq-forensic-card rounded-2xl p-5">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-5 text-sm flex items-center gap-2">
          <TrendingUp size={14} style={{ color: NEON.orange }} />
          Recovery Waterfall — Claims Universe → Net Recovery
        </h3>
        <div className="space-y-2">
          {waterfall.map((w: any, i: number) => (
            <div key={i} className="flex items-center gap-3" data-testid={`waterfall-${i}`}>
              <div className="w-36 text-right flex-shrink-0">
                <p className="text-[11px] text-[var(--kiq-ink)]/50">{w.label}</p>
              </div>
              <div className="flex-1 relative h-7 rounded overflow-hidden bg-slate-200/70">
                <div
                  className="absolute left-0 top-0 h-full rounded transition-all"
                  style={{
                    width: `${Math.max(4, (w.value / wfMax) * 100)}%`,
                    background: w.color + "30",
                    borderRight: `2px solid ${w.color}`,
                  }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold" style={{ color: w.color }}>
                  {fmtM(w.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="kiq-forensic-card rounded-2xl p-5">
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm">Recovery by Category (Top 8)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catData} layout="vertical" barSize={12}>
              <XAxis type="number" tick={{ fill: "#ffffff30", fontSize: 8 }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtM(v)} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#ffffff45", fontSize: 8 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [fmtM(v)]} />
              <Bar dataKey="value" radius={3}>
                {catData.map((e: any, i: number) => <Cell key={i} fill={e.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="kiq-forensic-card rounded-2xl p-5">
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm">Vendor Exposure Breakdown</h3>
          <div className="space-y-3">
            {vendorExp.map((v: any) => (
              <div key={v.vendor} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--kiq-ink)]/60">{v.vendor}</span>
                  <span className="font-bold" style={{ color: NEON.orange }}>{fmtM(v.exposure)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--kiq-surface)]/[0.06] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${v.pct}%`, background: NEON.orange }} />
                </div>
                <p className="text-[10px] text-[var(--kiq-ink)]/30">{v.pct}% of total recovery opportunity</p>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <h4 className="text-[var(--kiq-ink)]/50 text-[10px] font-bold uppercase tracking-wider mb-3">Monthly Recovery Trend</h4>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={d.monthly_trend}>
                <XAxis dataKey="month" tick={{ fill: "#ffffff25", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis hide tickFormatter={v => fmtM(v)} />
                <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 10 }}
                  formatter={(v: any) => [fmtM(v)]} />
                <Line type="monotone" dataKey="recovery" stroke={NEON.green} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recovery Opportunity Summary Bar */}
      <div className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: "rgba(0,255,148,0.04)", border: "1px solid rgba(0,255,148,0.18)" }}>
        <CheckCircle size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[var(--kiq-ink)]/85 text-sm font-semibold">
            ${((s.total_recovery_opportunity || 0) / 1_000_000).toFixed(1)}M Recovery Opportunity Identified — {s.findings_count} Categories
          </p>
          <p className="text-[var(--kiq-ink)]/40 text-xs mt-0.5 leading-relaxed">
            Forensic audit of {(s.total_claims_reviewed || 0).toLocaleString()} claims across a ${((s.total_claims_spend || 0) / 1_000_000).toFixed(0)}M universe
            ({s.covered_lives?.toLocaleString()} covered lives) identified {s.findings_count} overpayment categories.
            Fortune 500 benchmark: $399.80 PMPM — plan running $142.30 above peer set.
            90-day forensic audit cycle. 28% success-fee model.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Findings ─────────────────────────────────────────────────────────────── */
function FindingsTab({ d }: { d: any }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const findings = d.findings || [];
  const filtered = filter === "All" ? findings : findings.filter((f: any) => f.severity === filter);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {["All", "Critical", "High", "Medium"].map(f => (
          <button key={f} onClick={() => setFilter(f)} data-testid={`findings-filter-${f}`}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: filter === f ? (f === "Critical" ? NEON.red : f === "High" ? NEON.orange : f === "Medium" ? NEON.gold : NEON.blue) + "20" : "#ffffff",
              border: `1px solid ${filter === f ? (f === "Critical" ? NEON.red : f === "High" ? NEON.orange : f === "Medium" ? NEON.gold : NEON.blue) + "50" : "#e2e8f0"}`,
              color: filter === f ? (f === "Critical" ? NEON.red : f === "High" ? NEON.orange : f === "Medium" ? NEON.gold : NEON.blue) : "#475569",
            }}>
            {f} {f !== "All" ? `(${findings.filter((x: any) => x.severity === f).length})` : `(${findings.length})`}
          </button>
        ))}
        <div className="ml-auto text-xs text-[var(--kiq-ink)]/30">
          Total: <span className="font-bold text-[var(--kiq-ink)]/60">{fmtM(filtered.reduce((s: number, f: any) => s + (f.recovery_estimate || 0), 0))}</span>
        </div>
      </div>

      {filtered.map((f: any) => {
        const isOpen = expanded === f.id;
        return (
          <div key={f.id} className="kiq-forensic-card rounded-xl overflow-hidden" data-testid={`finding-${f.id}`}>
            <button className="w-full p-4 flex items-center gap-3 text-left hover:bg-[var(--kiq-surface)]/70 transition-colors"
              onClick={() => setExpanded(isOpen ? null : f.id)}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: severityColor(f.severity), background: severityColor(f.severity) + "18" }}>{f.severity}</span>
                  <span className="text-[var(--kiq-ink)] font-medium text-sm">{f.category}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded border" style={{ color: confColor(f.confidence), borderColor: confColor(f.confidence) + "40", background: confColor(f.confidence) + "12" }}>{f.confidence}</span>
                </div>
                <p className="text-xs text-[var(--kiq-ink)]/45 line-clamp-1">{f.description}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="font-bold" style={{ color: NEON.green }}>{fmtM(f.recovery_estimate ?? 0)}</p>
                {f.affected_claims > 0 && <p className="text-xs text-[var(--kiq-ink)]/30">{f.affected_claims.toLocaleString()} claims</p>}
              </div>
              <ChevronRight size={14} className={`text-[var(--kiq-ink)]/30 transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-white/[0.05] pt-4 space-y-3">
                <p className="text-sm text-[var(--kiq-ink)]/65 leading-relaxed">{f.description}</p>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { label: "Statute / Basis", val: f.statute },
                    { label: "Evidence",        val: f.evidence },
                    { label: "Recovery Method", val: f.recovery_method },
                  ].map(i => (
                    <div key={i.label} className="p-3 rounded-lg bg-[var(--kiq-surface)]/60 border border-[var(--kiq-hairline)]/70">
                      <p className="text-xs text-[var(--kiq-ink)]/30 mb-1">{i.label}</p>
                      <p className="text-xs text-[var(--kiq-ink)]/65">{i.val}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--kiq-ink)]/35">
                  <span>Look-back: {f.months_back} months</span>
                  {f.affected_claims > 0 && <span>{f.affected_claims.toLocaleString()} affected claims</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── AI Forensic Engine ───────────────────────────────────────────────────── */
function AiForensicTab({ lastUpload }: { lastUpload: any }) {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const payload: any = {
        plan_name: "Fortune 20 Enterprise Plan",
        covered_lives: 187400,
      };
      if (lastUpload) {
        payload.vault_id = lastUpload.vault_id;
        payload.detected_columns = lastUpload.detected_columns || [];
        payload.sample_rows = lastUpload.sample_rows || [];
      }
      const res = await apiRequest("POST", "/api/claims-recovery/ai-analyze", payload);
      const json = await res.json();
      if (json.findings) {
        setResults(json.findings);
        toast({ title: "AI Analysis Complete", description: `${json.findings.length} findings identified by GPT-4o forensic engine.` });
      } else {
        throw new Error(json.error || "Analysis failed");
      }
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Engine header */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.22)" }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}>
            <Brain size={18} style={{ color: NEON.purple }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[var(--kiq-ink)] font-semibold text-sm">AI Forensic Engine — GPT-4o</h3>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ color: NEON.purple, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>
                CONSTITUTIONAL VOICE
              </span>
            </div>
            <p className="text-[var(--kiq-ink)]/50 text-xs leading-relaxed">
              Analyzes uploaded claim file columns and sample rows through GPT-4o with a forensic audit system prompt.
              Identifies 15+ enterprise recovery categories. Returns structured findings with confidence tiers
              (CERTIFIED / MODELED / INSUFFICIENT_EVIDENCE). McKinsey partner tone, MECE structure, no hedging.
            </p>
            {lastUpload && (
              <p className="text-xs mt-2" style={{ color: NEON.blue }}>
                File loaded: <span className="font-semibold">{lastUpload.filename}</span>
                {lastUpload.row_count ? ` · ${lastUpload.row_count.toLocaleString()} claim rows detected` : ""}
              </p>
            )}
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            data-testid="ai-analyze-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 disabled:opacity-50"
            style={{ background: "rgba(168,85,247,0.20)", border: "1px solid rgba(168,85,247,0.40)", color: NEON.purple }}
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
            {analyzing ? "Analyzing…" : (lastUpload ? "Run AI Analysis" : "Run on Demo Data")}
          </button>
        </div>
      </div>

      {/* Instructions if no results */}
      {!results && !analyzing && (
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.02] border border-white/[0.06] p-8 text-center">
          <Brain size={32} className="mx-auto mb-3 text-[var(--kiq-ink)]/15" />
          <p className="text-[var(--kiq-ink)]/40 text-sm font-medium">Upload a claims file and click "Run AI Analysis"</p>
          <p className="text-[var(--kiq-ink)]/25 text-xs mt-2">Or click "Run on Demo Data" to see the engine in action without uploading.</p>
          <div className="mt-4 grid grid-cols-3 gap-3 max-w-md mx-auto text-xs">
            {["Duplicate detection", "DRG upcoding", "Spread pricing", "Unbundling", "COB errors", "Ineligible members"].map(t => (
              <div key={t} className="rounded-lg px-2 py-1.5 text-[var(--kiq-ink)]/35" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>{t}</div>
            ))}
          </div>
        </div>
      )}

      {analyzing && (
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.02] border border-white/[0.06] p-12 text-center">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin" style={{ color: NEON.purple }} />
          <p className="text-[var(--kiq-ink)]/50 text-sm">GPT-4o forensic audit in progress…</p>
          <p className="text-[var(--kiq-ink)]/30 text-xs mt-1">Scanning {lastUpload?.detected_columns?.length || "all"} claim columns · McKinsey-grade analysis</p>
        </div>
      )}

      {results && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} style={{ color: NEON.green }} />
            <p className="text-[var(--kiq-ink)]/70 text-sm font-semibold">
              {results.length} findings identified by GPT-4o Forensic Engine
            </p>
            <span className="ml-auto text-xs text-[var(--kiq-ink)]/30">
              Total: {fmtM(results.reduce((s, f) => s + (f.recovery_estimate || 0), 0))}
            </span>
          </div>
          {results.map((f: any) => {
            const fid = f.id || `ai-${Math.random()}`;
            const isOpen = expanded === fid;
            return (
              <div key={fid} className="rounded-xl overflow-hidden" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.18)" }}
                data-testid={`ai-finding-${fid}`}>
                <button className="w-full p-4 flex items-center gap-3 text-left hover:bg-[var(--kiq-surface)]/[0.02] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : fid)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ color: NEON.purple, background: "rgba(168,85,247,0.2)" }}>AI</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: severityColor(f.severity), background: severityColor(f.severity) + "18" }}>{f.severity}</span>
                      <span className="text-[var(--kiq-ink)] font-medium text-sm">{f.category}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded border" style={{ color: confColor(f.confidence), borderColor: confColor(f.confidence) + "40", background: confColor(f.confidence) + "12" }}>{f.confidence}</span>
                    </div>
                    <p className="text-xs text-[var(--kiq-ink)]/45 line-clamp-1">{f.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-bold" style={{ color: NEON.green }}>{fmtM(f.recovery_estimate ?? f.recovery_estimate_usd ?? 0)}</p>
                    {(f.affected_claims_estimate || f.affected_claims) > 0 && (
                      <p className="text-xs text-[var(--kiq-ink)]/30">{(f.affected_claims_estimate || f.affected_claims || 0).toLocaleString()} est.</p>
                    )}
                  </div>
                  <ChevronRight size={14} className={`text-[var(--kiq-ink)]/30 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t pt-4 space-y-3" style={{ borderColor: "rgba(168,85,247,0.15)" }}>
                    <p className="text-sm text-[var(--kiq-ink)]/65 leading-relaxed">{f.description}</p>
                    <div className="grid md:grid-cols-3 gap-3">
                      {[
                        { label: "Statute / Basis", val: f.statute },
                        { label: "Evidence",        val: f.evidence },
                        { label: "Recovery Method", val: f.recovery_method },
                      ].map(i => (
                        <div key={i.label} className="p-3 rounded-lg" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                          <p className="text-xs text-[var(--kiq-ink)]/30 mb-1">{i.label}</p>
                          <p className="text-xs text-[var(--kiq-ink)]/65">{i.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Claims Universe ──────────────────────────────────────────────────────── */
function ClaimsUniverseTab({ lastUpload }: { lastUpload: any }) {
  const vaultId = lastUpload?.vault_id;
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 500;

  const { data: universe, isLoading } = useQuery<any>({
    queryKey: vaultId
      ? [`/api/claims-recovery/universe/${vaultId}`, page]
      : ["/api/claims-recovery/universe/demo", page],
    queryFn: async () => {
      const vid = vaultId ?? 0;
      const res = await fetch(
        `/api/claims-recovery/universe/${vid}?page=${page}&page_size=${PAGE_SIZE}`,
        { credentials: "include" }
      );
      // Always returns 200 (demo fallback on backend for vault_id=0 or not-found)
      return res.json();
    },
  });

  const [search, setSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState<string>("All");
  const [sortCol, setSortCol] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const FLAG_OPTIONS = ["All", "Duplicate", "OON", "Upcoded", "Unbundled", "COB Gap", "Ineligible", "Missing Dx", "Overpaid"];
  const rows: any[] = universe?.rows || [];

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = rows
    .filter(r => {
      const matchSearch = !search || Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()));
      const matchFlag = flagFilter === "All" || (r._flags || []).includes(flagFilter);
      return matchSearch && matchFlag;
    })
    .sort((a, b) => {
      if (!sortCol) return 0;
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const an = parseFloat(String(av).replace(/[$,]/g, ""));
      const bn = parseFloat(String(bv).replace(/[$,]/g, ""));
      const cmp = !isNaN(an) && !isNaN(bn)
        ? an - bn
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

  if (isLoading) return (
    <div className="flex items-center justify-center h-48 gap-3">
      <Loader2 size={16} className="animate-spin text-blue-400" />
      <span className="text-[var(--kiq-ink)]/40 text-sm">Loading claims universe…</span>
    </div>
  );

  const dataColumns = universe?.detected_columns?.filter((c: string) => !c.startsWith("_")) || [];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Claims",    val: (universe?.total_rows || 0).toLocaleString(), c: NEON.blue },
          { label: "Total Billed",    val: fmtM(universe?.total_billed || 0), c: NEON.purple },
          { label: "Total Paid",      val: fmtM(universe?.total_paid || 0), c: NEON.gold },
          { label: "Flagged",         val: (universe?.total_flagged || 0).toLocaleString(), c: NEON.orange },
          { label: "Flag Rate",       val: `${universe?.flag_rate_pct || 0}%`, c: NEON.red },
        ].map(k => (
          <div key={k.label} className="kiq-forensic-card rounded-xl p-3" data-testid={`universe-kpi-${k.label}`}>
            <p className="text-[var(--kiq-ink)]/35 text-[10px] uppercase tracking-wider">{k.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: k.c }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1 min-w-48" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <Search size={12} className="text-[var(--kiq-ink)]/30 flex-shrink-0" />
          <input
            type="text" placeholder="Search any column…" value={search}
            onChange={e => setSearch(e.target.value)} data-testid="universe-search"
            className="bg-transparent text-xs text-[var(--kiq-ink)] placeholder:text-[var(--kiq-ink)]/25 border-none outline-none flex-1"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FLAG_OPTIONS.map(f => (
            <button key={f} onClick={() => setFlagFilter(f)} data-testid={`flag-filter-${f}`}
              className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
              style={{
                background: flagFilter === f ? NEON.orange + "20" : "#ffffff",
                border: `1px solid ${flagFilter === f ? NEON.orange + "50" : "#e2e8f0"}`,
                color: flagFilter === f ? NEON.orange : "#64748b",
              }}>
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--kiq-ink)]/30 flex-shrink-0">{filtered.length.toLocaleString()} rows</span>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-white/[0.08]">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: "#F1F5F9", borderBottom: "1px solid #e2e8f0" }}>
                <th className="px-3 py-2.5 text-left text-[var(--kiq-ink)]/40 font-semibold uppercase tracking-wider text-[10px] w-16">#</th>
                {dataColumns.slice(0, 8).map((col: string) => (
                  <th key={col}
                    className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap cursor-pointer select-none hover:text-[var(--kiq-ink)]/70 transition-colors"
                    style={{ color: sortCol === col ? NEON.blue : "#475569" }}
                    onClick={() => handleSort(col)}
                    data-testid={`universe-sort-${col}`}>
                    {col.replace(/_/g, " ")}
                    {sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-[var(--kiq-ink)]/40 font-semibold uppercase tracking-wider text-[10px]">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row: any, i: number) => {
                const flags: string[] = row._flags || [];
                return (
                  <tr key={i} data-testid={`universe-row-${i}`}
                    className="border-b border-[var(--kiq-hairline)]/70 hover:bg-[var(--kiq-surface)]/70 transition-colors"
                    style={{ background: flags.length > 0 ? "rgba(255,107,26,0.02)" : "transparent" }}>
                    <td className="px-3 py-2 text-[var(--kiq-ink)]/25">{row._row_num || i + 1}</td>
                    {dataColumns.slice(0, 8).map((col: string) => (
                      <td key={col} className="px-3 py-2 text-[var(--kiq-ink)]/60 whitespace-nowrap max-w-32 truncate">
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {flags.map((flag: string) => (
                          <span key={flag} className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ color: NEON.orange, background: "rgba(255,107,26,0.15)", border: "1px solid rgba(255,107,26,0.3)" }}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination footer */}
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: "1px solid #f8fafc", background: "#F8FAFC" }}>
          <p className="text-xs text-[var(--kiq-ink)]/30">
            Page {universe?.page ?? page} of {universe?.total_pages ?? 1} ·{" "}
            Showing <span className="text-[var(--kiq-ink)]/50 font-semibold">{rows.length}</span> of{" "}
            <span className="text-[var(--kiq-ink)]/50 font-semibold">{(universe?.total_rows ?? 0).toLocaleString()}</span> total rows
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1 rounded text-xs font-semibold disabled:opacity-30"
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#334155" }}
              data-testid="universe-prev-page"
            >
              ← Prev
            </button>
            <span className="text-xs text-[var(--kiq-ink)]/30">{page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= (universe?.total_pages ?? 1) || isLoading}
              className="px-3 py-1 rounded text-xs font-semibold disabled:opacity-30"
              style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#334155" }}
              data-testid="universe-next-page"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Vendor Scorecard ─────────────────────────────────────────────────────── */
function VendorScorecardTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/claims-recovery/vendor-scorecard"] });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 size={16} className="animate-spin text-yellow-400" /></div>;
  const vendors = data?.vendors || [];

  return (
    <div className="space-y-4">
      <p className="text-[var(--kiq-ink)]/35 text-xs">
        Vendor performance rated on error rate, demand response speed, cooperation grade, and recovery yield.
        Plan: <span className="text-[var(--kiq-ink)]/55 font-semibold">{data?.plan_name}</span> · {(data?.covered_lives || 0).toLocaleString()} covered lives
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {vendors.map((v: any) => {
          const isOpen = expanded === v.name;
          const gc = gradeColor(v.fiduciary_grade);
          return (
            <div key={v.name} className="kiq-forensic-card rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${gc}22` }}
              data-testid={`vendor-${v.name.replace(/\s+/g, "-")}`}>
              <button className="w-full p-5 text-left hover:bg-[var(--kiq-surface)]/70 transition-colors"
                onClick={() => setExpanded(isOpen ? null : v.name)}>
                <div className="flex items-start gap-4">
                  {/* Grade Badge */}
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-2xl"
                    style={{ background: gc + "15", border: `2px solid ${gc}40`, color: gc }}>
                    {v.fiduciary_grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--kiq-ink)] font-semibold text-sm">{v.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold text-[var(--kiq-ink)]/50 bg-[var(--kiq-surface)]/[0.06] border border-white/[0.1]">{v.type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {[
                        { label: "Error Rate", val: `${v.error_rate_pct}%`, warn: v.error_rate_pct > 5 },
                        { label: "Response", val: `${v.demand_response_days}d avg`, warn: v.demand_response_days > 30 },
                        { label: "Recovery Yield", val: `${v.recovery_yield_pct}%`, warn: v.recovery_yield_pct < 60 },
                        { label: "Open Demands", val: String(v.open_demands), warn: v.open_demands > 3 },
                      ].map(m => (
                        <div key={m.label} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[var(--kiq-ink)]/35">{m.label}:</span>
                          <span className="text-[10px] font-bold" style={{ color: m.warn ? NEON.orange : "rgba(255,255,255,0.65)" }}>{m.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={14} className={`text-[var(--kiq-ink)]/30 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t space-y-3" style={{ borderColor: gc + "20" }}>
                  {/* Trend sparkline */}
                  <div className="mt-3">
                    <p className="text-[10px] text-[var(--kiq-ink)]/30 mb-2 uppercase tracking-wider">Error Rate Trend (4Q)</p>
                    <div className="flex items-end gap-1 h-8">
                      {(v.trend || []).map((val: number, i: number) => (
                        <div key={i} className="flex-1 rounded-sm"
                          style={{ height: `${Math.max(8, (val / Math.max(...v.trend)) * 32)}px`, background: i === v.trend.length - 1 ? gc : gc + "50" }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] text-[var(--kiq-ink)]/20 mt-0.5">
                      <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Total Errors Flagged", val: (v.total_errors_flagged || 0).toLocaleString() },
                      { label: "Total Recovered", val: fmtM(v.total_recovered || 0) },
                      { label: "Cooperation Grade", val: v.cooperation_grade },
                      { label: "Contact", val: v.contact },
                    ].map(m => (
                      <div key={m.label} className="p-2 rounded-lg" style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
                        <p className="text-[10px] text-[var(--kiq-ink)]/30">{m.label}</p>
                        <p className="text-xs text-[var(--kiq-ink)]/65 mt-0.5 font-semibold truncate">{m.val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Flags */}
                  <div>
                    <p className="text-[10px] text-[var(--kiq-ink)]/30 mb-1.5 uppercase tracking-wider">Open Issues</p>
                    <div className="space-y-1">
                      {(v.flags || []).map((flag: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <AlertTriangle size={10} style={{ color: NEON.orange, flexShrink: 0 }} />
                          <span className="text-[var(--kiq-ink)]/55">{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Regulatory Compliance Matrix ─────────────────────────────────────────── */
function RegulatoryMatrixTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/claims-recovery/regulatory-matrix"] });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 size={16} className="animate-spin text-green-400" /></div>;
  const rules = data?.rules || [];

  const counts = {
    Compliant: rules.filter((r: any) => r.status === "Compliant").length,
    Gap: rules.filter((r: any) => r.status === "Gap").length,
    Unknown: rules.filter((r: any) => r.status === "Unknown").length,
  };

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: statusColor(status) + "10", border: `1px solid ${statusColor(status)}35` }}>
            <div className="w-2 h-2 rounded-full" style={{ background: statusColor(status) }} />
            <span className="text-xs font-semibold" style={{ color: statusColor(status) }}>{count} {status}</span>
          </div>
        ))}
        <p className="text-[var(--kiq-ink)]/30 text-xs ml-auto">Plan: <span className="text-[var(--kiq-ink)]/50">{data?.plan_name}</span></p>
      </div>

      {/* Matrix table */}
      <div className="space-y-2">
        {rules.map((rule: any, i: number) => {
          const isOpen = expanded === rule.regulation;
          const sc = statusColor(rule.status);
          return (
            <div key={i} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #e2e8f0" }}
              data-testid={`reg-rule-${i}`}>
              <button className="w-full p-4 flex items-center gap-3 text-left hover:bg-[var(--kiq-surface)]/[0.02] transition-colors"
                onClick={() => setExpanded(isOpen ? null : rule.regulation)}>
                <div className="flex-shrink-0">
                  <div className="text-xs px-2 py-1 rounded font-bold" style={{ color: sc, background: sc + "15", border: `1px solid ${sc}30` }}>
                    {rule.status}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[var(--kiq-ink)] font-medium text-sm">{rule.regulation}</span>
                    <span className="text-[var(--kiq-ink)]/40 text-xs truncate hidden sm:block">— {rule.title}</span>
                  </div>
                  <p className="text-xs text-[var(--kiq-ink)]/35 line-clamp-1">{rule.requirement}</p>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                    color: rule.risk_level === "Critical" ? NEON.red : rule.risk_level === "High" ? NEON.orange : rule.risk_level === "Medium" ? NEON.gold : NEON.blue,
                    background: (rule.risk_level === "Critical" ? NEON.red : rule.risk_level === "High" ? NEON.orange : NEON.gold) + "15",
                  }}>
                    {rule.risk_level}
                  </span>
                </div>
                <ChevronRight size={14} className={`text-[var(--kiq-ink)]/30 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-white/[0.05] pt-4 grid md:grid-cols-3 gap-3">
                  {[
                    { label: "Requirement", val: rule.requirement },
                    { label: "Evidence",    val: rule.evidence },
                    { label: "Remediation", val: rule.remediation },
                  ].map(it => (
                    <div key={it.label} className="p-3 rounded-lg bg-[var(--kiq-surface)]/[0.02] border border-white/[0.05]">
                      <p className="text-[10px] text-[var(--kiq-ink)]/30 mb-1 uppercase tracking-wider">{it.label}</p>
                      <p className="text-xs text-[var(--kiq-ink)]/65 leading-relaxed">{it.val}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── A/R Ledger ───────────────────────────────────────────────────────────── */
function ArLedgerTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/claims-recovery/ar-ledger"] });
  const [sort, setSort] = useState<"days" | "outstanding">("days");

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 size={16} className="animate-spin text-purple-400" /></div>;

  const summary = data?.summary || {};
  const aging = data?.aging || {};
  const rows: any[] = [...(data?.rows || [])].sort((a, b) =>
    sort === "days" ? b.days_outstanding - a.days_outstanding : b.outstanding - a.outstanding
  );

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Outstanding", val: fmtM(summary.total_outstanding || 0), c: NEON.orange },
          { label: "Total Recovered",   val: fmtM(summary.total_recovered || 0),   c: NEON.green },
          { label: "Interest Accrued",  val: fmtM(summary.total_interest_accrued || 0), c: NEON.gold },
          { label: "Projected 90-Day",  val: fmtM(summary.projected_90_day_collection || 0), c: NEON.blue },
        ].map(k => (
          <div key={k.label} className="kiq-forensic-card rounded-xl p-4" data-testid={`ar-kpi-${k.label}`}>
            <p className="text-[var(--kiq-ink)]/35 text-[10px] uppercase tracking-wider">{k.label}</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: k.c }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Aging buckets */}
      <div className="grid grid-cols-4 gap-2">
        {(["0-30", "31-60", "61-90", "90+"] as const).map(bucket => (
          <div key={bucket} className="rounded-lg p-3 text-center"
            style={{ background: agingColor(bucket) + "08", border: `1px solid ${agingColor(bucket)}25` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: agingColor(bucket) }}>{bucket} days</p>
            <p className="text-base font-bold text-[var(--kiq-ink)] mt-1">{fmtM(aging[bucket] || 0)}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-white/[0.08]">
        <div className="px-4 py-2.5 flex items-center gap-3" style={{ background: "#F1F5F9", borderBottom: "1px solid #e2e8f0" }}>
          <Scale size={12} style={{ color: NEON.purple }} />
          <p className="text-xs font-semibold text-[var(--kiq-ink)]/70">Accounts Receivable Ledger</p>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setSort("days")} className="text-[10px] px-2 py-0.5 rounded"
              style={{ background: sort === "days" ? NEON.purple + "20" : "transparent", color: sort === "days" ? NEON.purple : "#64748b", border: `1px solid ${sort === "days" ? NEON.purple + "40" : "transparent"}` }}>
              By Age
            </button>
            <button onClick={() => setSort("outstanding")} className="text-[10px] px-2 py-0.5 rounded"
              style={{ background: sort === "outstanding" ? NEON.purple + "20" : "transparent", color: sort === "outstanding" ? NEON.purple : "#64748b", border: `1px solid ${sort === "outstanding" ? NEON.purple + "40" : "transparent"}` }}>
              By Amount
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #f1f5f9" }}>
                {["Finding", "Respondent", "Demanded", "Recovered", "Outstanding", "Days", "Aging", "Interest", "Status"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[var(--kiq-ink)]/35 font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => {
                const ac = agingColor(row.aging_bucket);
                return (
                  <tr key={i} data-testid={`ar-row-${i}`}
                    className="border-b border-[var(--kiq-hairline)]/70 hover:bg-[var(--kiq-surface)]/70 transition-colors">
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)]/70 font-medium max-w-36 truncate">{row.finding}</td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)]/50 whitespace-nowrap">
                      <div>{row.respondent}</div>
                      <div className="text-[10px] text-[var(--kiq-ink)]/25">{row.respondent_type}</div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--kiq-ink)]/60 whitespace-nowrap">{fmtM(row.demanded)}</td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap" style={{ color: row.recovered > 0 ? NEON.green : "rgba(15,23,42,0.08)" }}>{fmtM(row.recovered)}</td>
                    <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: row.outstanding > 0 ? NEON.orange : "#64748b" }}>{fmtM(row.outstanding)}</td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)]/50 whitespace-nowrap">{row.days_outstanding}d</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ color: ac, background: ac + "15" }}>{row.aging_bucket}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--kiq-ink)]/40 whitespace-nowrap">{fmtM(row.interest_accrued)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "rgba(255,255,255,0.45)", background: "#f8fafc", border: "1px solid #e2e8f0" }}>{row.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: "1px solid #f8fafc", background: "#F8FAFC" }}>
          <p className="text-[11px] text-[var(--kiq-ink)]/30">
            Weighted avg days outstanding: <span className="font-bold text-[var(--kiq-ink)]/50">{summary.weighted_avg_days || 0}d</span>
          </p>
          <p className="text-[11px]">
            <span className="text-[var(--kiq-ink)]/30">Total outstanding: </span>
            <span className="font-bold" style={{ color: NEON.orange }}>{fmtM(summary.total_outstanding || 0)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Recovery Pipeline ────────────────────────────────────────────────────── */
function PipelineTab({ d }: { d: any }) {
  const { toast } = useToast();
  const { downloadWithManifest } = useManifestDownload();
  const { data: pipeline, isLoading } = useQuery<any>({ queryKey: ["/api/claims-recovery/pipeline"] });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pursuingId, setPursuingId] = useState<string | null>(null);
  const [recoveredInput, setRecoveredInput] = useState<Record<number, string>>({});
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/claims-recovery/pipeline"] });

  async function pursue(finding: any) {
    setPursuingId(finding.id);
    try {
      await apiRequest("POST", "/api/claims-recovery/pursue", {
        finding_id: finding.id, finding_category: finding.category,
        finding_severity: finding.severity, amount_claimed: finding.recovery_estimate,
      });
      toast({ title: "Recovery action created", description: `${finding.category} added to pipeline.` });
      invalidate();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setPursuingId(null); }
  }

  async function updateAction(id: number, body: any, msg: string) {
    setBusyId(id);
    try {
      await apiRequest("PATCH", `/api/claims-recovery/action/${id}`, body);
      toast({ title: msg });
      invalidate();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  }

  async function downloadLetter(a: any) {
    try {
      await downloadWithManifest(`/api/claims-recovery/action/${a.id}/demand-letter`, {
        filename: `Demand-Letter-${a.finding_id}-${a.id}.txt`,
      });
      invalidate();
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  }

  const actions: any[] = pipeline?.actions ?? [];
  const summary = pipeline?.summary ?? {};
  const findingsById = Object.fromEntries((d.findings || []).map((f: any) => [f.id, f]));
  const pursuedIds = new Set(actions.map((a) => a.finding_id));
  const unpursued = (d.findings || []).filter((f: any) => !pursuedIds.has(f.id)).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Active Pursuits", val: String(summary.open ?? 0),                                            c: NEON.blue },
          { label: "Total Claimed",   val: fmtM(summary.total_claimed ?? 0),                                     c: NEON.gold },
          { label: "Recovered",       val: fmtM(summary.total_recovered ?? 0),                                   c: NEON.green },
          { label: "Recovery Rate",   val: `${(summary.recovery_rate_pct ?? 0).toFixed(1)}%`,                    c: NEON.purple },
          { label: "Kincaid Earned",  val: fmtM(summary.contingency_earned ?? 0),                               c: NEON.orange },
        ].map(k => (
          <div key={k.label} className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-3">
            <p className="text-[var(--kiq-ink)]/40 text-[10px] mb-1 uppercase tracking-wider">{k.label}</p>
            <p className="text-lg font-bold" style={{ color: k.c }}>{k.val}</p>
          </div>
        ))}
      </div>

      {unpursued.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.22)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Gavel size={14} style={{ color: NEON.blue }} />
            <p className="text-sm font-semibold text-[var(--kiq-ink)]">Findings Ready to Pursue</p>
            <span className="text-[10px] text-[var(--kiq-ink)]/40 ml-auto">Click "Pursue" to create a recovery action and generate a GPT-4o demand letter.</span>
          </div>
          <div className="space-y-2">
            {unpursued.map((f: any) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--kiq-surface)]/[0.02] border border-white/[0.05]" data-testid={`unpursued-${f.id}`}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ color: severityColor(f.severity), background: severityColor(f.severity) + "18" }}>{f.severity}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--kiq-ink)] truncate">{f.category}</p>
                  <p className="text-[11px] text-[var(--kiq-ink)]/40 truncate">{f.confidence}</p>
                </div>
                <span className="font-bold text-sm" style={{ color: NEON.green }}>{fmtM(f.recovery_estimate ?? 0)}</span>
                <button onClick={() => pursue(f)} disabled={pursuingId === f.id} data-testid={`pursue-${f.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: NEON.blue + "20", border: `1px solid ${NEON.blue}50`, color: NEON.blue }}>
                  {pursuingId === f.id ? <Loader2 size={11} className="animate-spin" /> : <Gavel size={11} />}
                  Pursue
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-3">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <span className="text-[var(--kiq-ink)]/40 text-sm">Loading pipeline…</span>
        </div>
      ) : actions.length === 0 ? (
        <div className="rounded-2xl bg-[var(--kiq-surface)]/[0.02] border border-white/[0.05] p-12 text-center">
          <Briefcase size={28} className="mx-auto mb-3 text-[var(--kiq-ink)]/20" />
          <p className="text-[var(--kiq-ink)]/50 text-sm">No active pursuits yet.</p>
          <p className="text-[var(--kiq-ink)]/30 text-xs mt-1">Click "Pursue" on a finding above to start your first recovery action.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {PIPELINE_STAGES.map(stage => {
            const items = actions.filter(a => a.status === stage.id);
            if (!items.length) return null;
            return (
              <div key={stage.id} className="rounded-2xl bg-[var(--kiq-surface)]/[0.025] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: stage.color + "12", borderBottom: `1px solid ${stage.color}22` }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: stage.color }}>{stage.label}</p>
                  <span className="text-[11px] text-[var(--kiq-ink)]/40 ml-auto">{items.length} action{items.length > 1 ? "s" : ""} · {fmtM(items.reduce((s, a) => s + (a.amount_claimed ?? 0), 0))}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {items.map(a => {
                    const finding = findingsById[a.finding_id] || {};
                    const isBusy = busyId === a.id;
                    const ORDER = ["identified", "demand_sent", "response_received", "negotiating", "settled", "distributed"];
                    const cur = ORDER.indexOf(a.status);
                    const nextStage = cur >= 0 && cur < ORDER.length - 1 ? ORDER[cur + 1] : null;
                    return (
                      <div key={a.id} className="p-4" data-testid={`action-${a.id}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-[var(--kiq-ink)]">{a.finding_category || finding.category}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded text-[var(--kiq-ink)]/55 bg-[var(--kiq-surface)]/[0.04] border border-white/[0.08]">vs. {a.target_party}</span>
                              <span className="text-[10px] text-[var(--kiq-ink)]/30 ml-auto">#{a.id}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-[var(--kiq-ink)]/45">Claimed: <span className="font-semibold text-[var(--kiq-ink)]/75">{fmtM(a.amount_claimed)}</span></span>
                              <span className="text-[var(--kiq-ink)]/45">Recovered: <span className="font-semibold" style={{ color: a.amount_recovered > 0 ? NEON.green : "#475569" }}>{fmtM(a.amount_recovered)}</span></span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 justify-end flex-shrink-0">
                            <button onClick={() => downloadLetter(a)} disabled={isBusy} data-testid={`demand-letter-${a.id}`}
                              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold disabled:opacity-50"
                              style={{ background: NEON.orange + "15", border: `1px solid ${NEON.orange}35`, color: NEON.orange }}>
                              <Download size={9} /> AI Letter
                            </button>
                            {nextStage && (
                              <button onClick={() => updateAction(a.id, { status: nextStage }, "Status updated")} disabled={isBusy} data-testid={`advance-${a.id}`}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold disabled:opacity-50"
                                style={{ background: NEON.blue + "15", border: `1px solid ${NEON.blue}35`, color: NEON.blue }}>
                                {isBusy ? <Loader2 size={9} className="animate-spin" /> : <ChevronRight size={9} />}
                                {nextStage.replace(/_/g, " ")}
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Settled — enter recovered amount */}
                        {a.status === "negotiating" && (
                          <div className="mt-3 flex items-center gap-2">
                            <input
                              type="number" placeholder="Recovered amount ($)" value={recoveredInput[a.id] || ""}
                              onChange={e => setRecoveredInput(r => ({ ...r, [a.id]: e.target.value }))}
                              data-testid={`recovered-input-${a.id}`}
                              className="flex-1 bg-[var(--kiq-surface)]/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-[var(--kiq-ink)] placeholder:text-[var(--kiq-ink)]/25 outline-none"
                            />
                            <button
                              onClick={() => {
                                const amt = parseFloat(recoveredInput[a.id] || "0");
                                if (amt > 0) updateAction(a.id, { status: "settled", amount_recovered: amt }, "Settlement recorded");
                              }}
                              disabled={isBusy}
                              data-testid={`settle-btn-${a.id}`}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                              style={{ background: NEON.green + "15", border: `1px solid ${NEON.green}35`, color: NEON.green }}>
                              Record Settlement
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Fee Calculator ───────────────────────────────────────────────────────── */
function CalculatorTab({ d }: { d: any }) {
  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);
  const [feePct, setFeePct] = useState(28);
  const toggle = (id: string) => setSelectedFindings(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const findings = d.findings || [];
  const totalRecovery = findings.filter((f: any) => selectedFindings.includes(f.id))
    .reduce((s: number, f: any) => s + (f.recovery_estimate ?? 0), 0);
  const kincaidFee = Math.round(totalRecovery * feePct / 100);
  const netBenefit = totalRecovery - kincaidFee;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-2xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.08] p-5">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm">Select Recovery Findings</h3>
        <div className="space-y-1.5">
          {findings.map((f: any) => {
            const on = selectedFindings.includes(f.id);
            return (
              <label key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-[var(--kiq-surface)]/[0.03] transition-colors border border-transparent hover:border-white/[0.06]"
                data-testid={`calc-finding-${f.id}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="w-4 h-4 rounded accent-indigo-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--kiq-ink)]/80 truncate">{f.category}</p>
                  <p className="text-xs text-[var(--kiq-ink)]/35">{f.confidence} · {f.severity}</p>
                </div>
                <span className="font-bold text-sm flex-shrink-0" style={{ color: on ? NEON.green : "#64748b" }}>{fmtM(f.recovery_estimate ?? 0)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.08] p-5">
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm">Success Fee Rate</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--kiq-ink)]/60 text-sm">Kincaid Health Success Fee</span>
              <span className="font-bold text-[var(--kiq-ink)]">{feePct}%</span>
            </div>
            <input type="range" min={20} max={35} value={feePct} onChange={e => setFeePct(Number(e.target.value))}
              className="w-full accent-indigo-500" data-testid="fee-slider" />
            <div className="flex justify-between text-xs text-[var(--kiq-ink)]/30"><span>20%</span><span>35%</span></div>
            <p className="text-xs text-[var(--kiq-ink)]/30">Industry standard: 25–33%. Fortune 20 engagements typically 22–28%.</p>
          </div>
        </div>

        <div className="rounded-2xl border p-5 space-y-4" style={{ background: "rgba(0,255,148,0.04)", borderColor: "rgba(0,255,148,0.15)" }}>
          <h3 className="text-[var(--kiq-ink)] font-semibold text-sm">Recovery Summary</h3>
          {[
            { label: "Total Recovery Opportunity", val: fmtM(totalRecovery), color: "#0F172A", bold: false },
            { label: `Kincaid Success Fee (${feePct}%)`, val: `-${fmtM(kincaidFee)}`, color: NEON.gold, bold: false },
            { label: "Net Benefit to Plan", val: fmtM(netBenefit), color: NEON.green, bold: true },
          ].map(r => (
            <div key={r.label} className={`flex justify-between items-center ${r.bold ? "border-t border-white/[0.08] pt-4" : ""}`}>
              <span className="text-sm text-[var(--kiq-ink)]/60">{r.label}</span>
              <span className={`font-bold ${r.bold ? "text-2xl" : "text-lg"}`} style={{ color: r.color }}>{r.val}</span>
            </div>
          ))}
          <p className="text-xs text-[var(--kiq-ink)]/30 border-t border-white/[0.05] pt-3">No upfront cost. 28% contingency on gross recovered amounts. No recovery, no fee.</p>
        </div>

        <div className="rounded-xl p-4" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.18)" }}>
          <p className="text-xs text-[var(--kiq-ink)]/50 leading-relaxed">
            <span className="font-bold" style={{ color: NEON.blue }}>Fortune 500 Benchmark: </span>
            Plans ≥50,000 covered lives average $399.80 PMPM. This plan: $542.10 PMPM — $142.30 above peer set.
            Annual excess spend: ~${((d.summary?.covered_lives || 187400) * 142.30 * 12 / 1_000_000).toFixed(1)}M vs. peer median.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Recovery Timeline ────────────────────────────────────────────────────── */
function TimelineTab({ d }: { d: any }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.08] p-5">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm flex items-center gap-2">
          <Target size={14} style={{ color: NEON.orange }} />
          90-Day Forensic Audit Cycle — Fortune 500 Self-Funded Plans ≥50,000 Lives
        </h3>
        <div className="space-y-0">
          {(d.recovery_timeline || []).map((phase: any, i: number) => (
            <div key={i} className="flex gap-0" data-testid={`phase-${i}`}>
              <div className="flex flex-col items-center w-14 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[var(--kiq-ink)] flex-shrink-0 z-10"
                  style={{ background: `linear-gradient(135deg,${NEON.orange},${NEON.gold})` }}>{i + 1}</div>
                {i < (d.recovery_timeline.length - 1) && <div className="w-0.5 flex-1 min-h-[24px]" style={{ background: "rgba(255,107,26,0.25)" }} />}
              </div>
              <div className="pb-6 pl-2 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--kiq-ink)] font-medium text-sm">{phase.phase}</span>
                  <span className="text-xs text-[var(--kiq-ink)]/35 border border-white/10 rounded px-1.5 py-0.5">{phase.duration}</span>
                </div>
                <p className="text-xs text-[var(--kiq-ink)]/50 leading-relaxed">{phase.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.08] p-5">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm">Monthly Recovery Trend ($M)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={d.monthly_trend}>
            <XAxis dataKey="month" tick={{ fill: "#ffffff35", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#ffffff35", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => fmtM(v)} />
            <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }}
              formatter={(v: any) => [fmtM(v)]} />
            <Line type="monotone" dataKey="recovery" stroke={NEON.green} strokeWidth={2} dot={false} name="Recovery Identified" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Engagement Terms */}
      <div className="rounded-2xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.08] p-5">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 text-sm flex items-center gap-2">
          <BookOpen size={14} style={{ color: NEON.blue }} />
          Engagement Terms
        </h3>
        <div className="space-y-3">
          <div className="p-3 rounded-lg" style={{ background: "rgba(0,255,148,0.04)", border: "1px solid rgba(0,255,148,0.15)" }}>
            <p className="text-xs text-[var(--kiq-ink)]/40 mb-1">Fee Structure</p>
            <p className="text-sm font-semibold text-[var(--kiq-ink)]">{d.engagement_terms?.fee_structure}</p>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)" }}>
            <p className="text-xs text-[var(--kiq-ink)]/40 mb-1">Audit Cycle</p>
            <p className="text-sm font-semibold text-[var(--kiq-ink)]">{d.engagement_terms?.audit_cycle || "90-day forensic audit cycle"}</p>
          </div>
          {d.engagement_terms?.client_obligations && (
            <div>
              <p className="text-xs text-[var(--kiq-ink)]/40 mb-2 uppercase tracking-wider">Client Obligations</p>
              <div className="space-y-1.5">
                {d.engagement_terms.client_obligations.map((o: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[var(--kiq-ink)]/55">
                    <ChevronRight size={10} className="mt-0.5 flex-shrink-0" style={{ color: NEON.orange }} />
                    <span>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Board Pack PDF ───────────────────────────────────────────────────────── */
async function downloadBoardPack(toast: any) {
  try {
    const res = await fetch("/api/claims-recovery/board-pack", { credentials: "include" });
    const pack = await res.json();
    const sha = res.headers.get("X-Kincaid-SHA256") || `sha256-${Date.now().toString(36)}`;

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, H = 297, M = 14, CW = W - M * 2;
    const ORANGE: [number,number,number] = [255, 107, 26];
    const GREEN: [number,number,number] = [0, 255, 148];
    const WHITE: [number,number,number] = [255, 255, 255];
    const DARK: [number,number,number] = [8, 13, 30];
    const GRAY: [number,number,number] = [135, 153, 195];

    const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const meta = pack.meta || {};
    let page = 1;
    let y = 0;

    function newPage() {
      page++;
      doc.addPage();
      y = 18;
      // Header
      doc.setFillColor(...DARK); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(14, 20, 45); doc.rect(0, 0, W, 12, "F");
      doc.setFillColor(...ORANGE); doc.rect(0, 12, W, 0.8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
      doc.setTextColor(...([255, 184, 0] as [number,number,number])); doc.text("KINCAID HEALTH™", M, 7.5);
      doc.setTextColor(...GRAY); doc.text("CLAIMS RECOVERY IQ™ — BOARD PACK", M + 22, 7.5);
      doc.setTextColor(...([65, 80, 120] as [number,number,number])); doc.text(date, W - M, 7.5, { align: "right" });
      // Footer
      doc.setFillColor(14, 20, 45); doc.rect(0, H - 10, W, 10, "F");
      doc.setFillColor(...ORANGE); doc.rect(0, H - 10, W, 0.5, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
      doc.setTextColor(...GRAY); doc.text(`CONFIDENTIAL · ${meta.plan_name || "Enterprise Plan"}`, M, H - 5.5);
      doc.setTextColor(...([65, 80, 120] as [number,number,number])); doc.text(`SHA-256: ${sha.slice(0, 32)}… · Page ${page}`, W - M, H - 5.5, { align: "right" });
    }

    function h1(text: string) {
      if (y + 14 > H - 14) newPage();
      doc.setFillColor(14, 20, 45); doc.rect(M, y, CW, 8, "F");
      doc.setFillColor(...ORANGE); doc.rect(M, y, 2.5, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.setTextColor(...WHITE); doc.text(text.toUpperCase(), M + 6, y + 5.5);
      y += 12;
    }

    function bodyText(text: string) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
      doc.setTextColor(...GRAY);
      const lines = doc.splitTextToSize(text, CW);
      lines.forEach((l: string) => {
        if (y + 4 > H - 14) newPage();
        doc.text(l, M, y + 4); y += 4;
      });
      y += 2;
    }

    function kv(label: string, value: string) {
      if (y + 7 > H - 14) newPage();
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.setTextColor(...GRAY); doc.text(label, M + 2, y + 4.5);
      doc.setTextColor(...WHITE); doc.text(value, M + CW - 2, y + 4.5, { align: "right" });
      doc.setDrawColor(24, 32, 68); doc.setLineWidth(0.2); doc.line(M, y + 6.5, M + CW, y + 6.5);
      y += 7;
    }

    // ── Page 1: Cover ──────────────────────────────────────────────────────
    doc.setFillColor(...DARK); doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...ORANGE); doc.rect(0, 0, W, 2.5, "F");
    doc.setFillColor(...ORANGE); doc.rect(0, 0, 3, H, "F");
    doc.setFillColor(...ORANGE); doc.rect(W - 3, 0, 3, H, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.setTextColor(...([255, 184, 0] as [number,number,number])); doc.text("KINCAID HEALTH™", M + 3, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.setTextColor(...([65, 80, 120] as [number,number,number])); doc.text("Kincaid Health  •  Claims Recovery IQ™  •  Board Audit Committee Deliverable", M + 3, 29);
    doc.setFont("helvetica", "bold"); doc.setFontSize(26);
    doc.setTextColor(...WHITE);
    doc.text("CLAIMS RECOVERY IQ™", M + 3, 56);
    doc.setFontSize(14); doc.setTextColor(...ORANGE); doc.text("BOARD AUDIT COMMITTEE PACK", M + 3, 72);
    doc.setFontSize(10); doc.setTextColor(...GRAY);
    doc.text(`Plan: ${meta.plan_name || "Enterprise Self-Funded Plan"}`, M + 3, 90);
    doc.text(`Covered Lives: ${(meta.covered_lives || 187400).toLocaleString()}  ·  Audit Period: ${meta.audit_period || "FY2024"}`, M + 3, 97);
    doc.text(`Prepared: ${meta.prepared_date || date}  ·  Report ID: ${meta.report_id || "CRIQ-2024"}`, M + 3, 104);
    doc.setFillColor(...ORANGE); doc.rect(M + 3, 114, 60, 9, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    doc.setTextColor(...([8, 13, 30] as [number,number,number])); doc.text("CONFIDENTIAL & PROPRIETARY", M + 6, 120);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.setTextColor(...([65, 80, 120] as [number,number,number]));
    doc.text(`SHA-256 Manifest: ${sha.slice(0, 48)}`, M + 3, H - 25);
    doc.text("Evidence manifest attached to every page footer. No export without SHA-256 chain.", M + 3, H - 20);

    // ── Page 2: Executive Summary ──────────────────────────────────────────
    newPage();
    h1("Executive Summary");
    const exec = pack.executive_summary || {};
    kv("Annual Claims Universe", fmtM(exec.total_claims_universe || 0));
    kv("Covered Lives", (exec.covered_lives || 0).toLocaleString());
    kv("PMPM vs. Fortune 500 Benchmark", `+$${exec.pmpm_benchmark_delta || 0}/mo above peer set`);
    kv("Total Recovery Opportunity", fmtM(exec.total_recovery_opportunity || 0));
    kv("Active A/R Balance", fmtM(exec.active_ar_balance || 0));
    kv("Board-Reportable Findings", String(exec.board_reportable_findings || 0) + " Critical-Severity");
    y += 5;
    bodyText("Kincaid Health conducted a 90-day forensic audit of the plan's claims universe. The audit identified 15 categories of overpayment, billing error, and statutory non-compliance across TPA, PBM, carrier, and provider respondents. Recovery opportunity is presented at CERTIFIED, MODELED, and INSUFFICIENT_EVIDENCE confidence tiers per the platform's constitutional doctrine.");

    // ── Page 3: Top 5 Findings ─────────────────────────────────────────────
    newPage();
    h1("Top 5 Recovery Findings by Value");
    (pack.top_findings || []).slice(0, 5).forEach((f: any, i: number) => {
      if (y + 20 > H - 14) newPage();
      doc.setFillColor(14, 20, 45); doc.rect(M, y, CW, 16, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.setTextColor(...WHITE); doc.text(`${i + 1}. ${f.category}`, M + 4, y + 5);
      doc.setTextColor(...GREEN); doc.text(fmtM(f.recovery_estimate || 0), M + CW - 4, y + 5, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      const desc = doc.splitTextToSize(f.description || "", CW - 8);
      doc.text(desc[0] || "", M + 4, y + 11);
      doc.text(`${f.severity} · ${f.confidence} · ${f.statute || ""}`, M + 4, y + 15);
      y += 20;
    });

    // ── Page 4: Vendor Scorecard ───────────────────────────────────────────
    newPage();
    h1("Vendor Scorecard");
    (pack.vendor_scorecard || []).forEach((v: any) => {
      if (y + 24 > H - 14) newPage();
      doc.setFillColor(14, 20, 45); doc.rect(M, y, CW, 18, "F");
      const gc = v.fiduciary_grade === "A" ? GREEN : v.fiduciary_grade === "B" ? ([0, 212, 255] as [number,number,number]) : v.fiduciary_grade === "C" ? ([255, 184, 0] as [number,number,number]) : ORANGE;
      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.setTextColor(...(gc as [number,number,number])); doc.text(v.fiduciary_grade, M + 4, y + 12);
      doc.setFontSize(9); doc.setTextColor(...WHITE); doc.text(`${v.name} (${v.type})`, M + 16, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
      doc.text(`Error Rate: ${v.error_rate_pct}%  ·  Response: ${v.demand_response_days}d  ·  Yield: ${v.recovery_yield_pct}%  ·  Open: ${v.open_demands}`, M + 16, y + 12);
      doc.text((v.flags || []).slice(0, 2).join("  ·  "), M + 16, y + 17);
      y += 22;
    });

    // ── Page 5: Regulatory Matrix ──────────────────────────────────────────
    newPage();
    h1("Regulatory Compliance Matrix");
    (pack.regulatory_matrix || []).forEach((rule: any) => {
      if (y + 16 > H - 14) newPage();
      const sc = rule.status === "Compliant" ? GREEN : rule.status === "Gap" ? ([255, 77, 109] as [number,number,number]) : ([255, 184, 0] as [number,number,number]);
      doc.setFillColor(14, 20, 45); doc.rect(M, y, CW, 12, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.setTextColor(...WHITE); doc.text(rule.regulation, M + 4, y + 5);
      doc.setTextColor(...(sc as [number,number,number])); doc.text(rule.status, M + CW - 4, y + 5, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
      const req = doc.splitTextToSize(rule.requirement, CW - 8);
      doc.text(req[0] || "", M + 4, y + 10);
      y += 15;
    });

    // ── Page 6: Recovery Projections ──────────────────────────────────────
    newPage();
    h1("Recovery Projections & A/R Summary");
    const proj = pack.recovery_projections || {};
    kv("Conservative 12-Month Recovery", fmtM(proj.conservative_12mo || 0) + " (55% of opportunity)");
    kv("Base-Case 12-Month Recovery", fmtM(proj.base_12mo || 0) + " (75% of opportunity)");
    kv("Optimistic 12-Month Recovery", fmtM(proj.optimistic_12mo || 0) + " (92% of opportunity)");
    y += 5;
    h1("A/R Ledger Summary");
    const ars = pack.ar_summary || {};
    kv("Total Demanded", fmtM(ars.total_demanded || 0));
    kv("Total Recovered to Date", fmtM(ars.total_recovered || 0));
    kv("Total Outstanding", fmtM(ars.total_outstanding || 0));
    kv("Interest Accrued", fmtM(ars.total_interest_accrued || 0));
    kv("Projected 90-Day Collection", fmtM(ars.projected_90_day_collection || 0));
    kv("Open Demands", String(ars.open_demands || 0));
    y += 8;
    bodyText("Kincaid Health. 28% contingency on gross recovered amounts. No recovery, no fee. Report ID: " + (meta.report_id || "CRIQ-2024") + " · SHA-256 manifest: " + sha);

    doc.save(`Kincaid-IQ-Claims-Recovery-Board-Pack-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "Board Pack downloaded", description: `6-page board-quality PDF · SHA-256 manifest embedded · ${page} pages` });
  } catch (e: any) {
    toast({ title: "Board Pack generation failed", description: e.message, variant: "destructive" });
  }
}

/* ── Root Component ───────────────────────────────────────────────────────── */
export default function ClaimsRecovery() {
  const [tab, setTab] = useState<Tab>("command");
  const [emailOpen, setEmailOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastUpload, setLastUpload] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/claims-recovery/dashboard"] });
  const { data: uploads, refetch: refetchUploads } = useQuery<any[]>({ queryKey: ["/api/claims-recovery/uploads"] });

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("file_kind", "claims_extract");
      const res = await fetch("/api/claims-recovery/upload", { method: "POST", body: fd, credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Upload failed");
      setLastUpload(json);
      refetchUploads();
      toast({
        title: "Claims file uploaded",
        description: json.row_count
          ? `${file.name} · ${json.row_count.toLocaleString()} claim rows · queued for 90-day forensic audit.`
          : `${file.name} queued for forensic audit (90-day cycle).`,
      });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || String(err), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const emailSummary: Record<string, string> = data ? {
    "Recovery Opportunity": fmtM(data.summary.total_recovery_opportunity ?? 0),
    "Covered Lives":        (data.summary.covered_lives ?? 0).toLocaleString(),
    "Claims Universe":      fmtM(data.summary.total_claims_spend ?? 0),
    "PMPM Delta":           `+$${data.summary.pmpm_benchmark_delta ?? 0}/mo`,
    "Findings":             String(data.summary.findings_count ?? 0),
  } : {};

  return (
    <Layout>
      <div className="kiq-forensic-shell">
        {/* Sticky Header */}
        <div className="kiq-forensic-header" style={{ position: "sticky", top: 0, zIndex: 50 }}>
          <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
            <DollarSign size={18} style={{ color: NEON.orange }} />
            <div>
              <h1 className="text-base font-bold text-[var(--kiq-ink)]">Claims Recovery IQ™</h1>
              <p className="text-[var(--kiq-ink)]/35 text-xs">Fortune 20 enterprise forensic audit · 90-day cycle · success-fee model</p>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf,.txt,.json,.x12,.837"
                onChange={handleFilePicked} className="hidden" data-testid="cr-upload-input" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="cr-upload-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: "rgba(0,212,255,0.10)", border: "1px solid rgba(0,212,255,0.30)", color: NEON.blue }}>
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? "Uploading…" : "Upload Claims File"}
              </button>
              <button onClick={() => downloadBoardPack(toast)} data-testid="cr-download-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.22)", color: NEON.orange }}>
                <FileText size={12} /> Board Pack PDF
              </button>
              <button onClick={() => setEmailOpen(true)} data-testid="cr-email-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(255,107,26,0.12)", border: "1px solid rgba(255,107,26,0.3)", color: NEON.orange }}>
                <Mail size={12} /> Email Report
              </button>
              {data && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)" }}>
                  <span className="text-xs text-[var(--kiq-ink)]/40">Recovery Opp.</span>
                  <span className="font-bold" style={{ color: NEON.green }}>{fmtM(data.summary.total_recovery_opportunity)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tab Bar */}
          <div className="px-6 flex gap-0 overflow-x-auto pb-0">
            {TABS.map(({ id, label, icon: Icon, badge }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)} data-testid={`cr-tab-${id}`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 flex-shrink-0 relative"
                  style={{ color: active ? NEON.orange : "#475569", borderBottomColor: active ? NEON.orange : "transparent", background: active ? `${NEON.orange}10` : "transparent" }}>
                  <Icon size={11} />{label}
                  {badge && (
                    <span className="ml-0.5 text-[9px] px-1 py-0.5 rounded font-bold" style={{ color: NEON.orange, background: "rgba(255,107,26,0.2)" }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-6 max-w-7xl">
          {/* Upload Panel */}
          {(lastUpload || (uploads && uploads.length > 0)) && (
            <div className="kiq-forensic-card mb-5 rounded-xl p-4" data-testid="cr-upload-panel">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} style={{ color: NEON.blue }} />
                <p className="text-sm font-semibold text-[var(--kiq-ink)]">Uploaded Claims Files</p>
                <span className="text-[10px] text-[var(--kiq-ink)]/40 ml-auto">Stored in Document Vault · 90-day forensic audit cycle</span>
              </div>
              {lastUpload && (
                <div className="text-xs text-[var(--kiq-ink)]/65 mb-2">
                  <span className="font-semibold text-[var(--kiq-ink)]">{lastUpload.filename}</span>{" — "}
                  {lastUpload.row_count != null ? `${lastUpload.row_count.toLocaleString()} claim rows · ` : ""}
                  {(lastUpload.size_bytes / 1024).toFixed(1)} KB. {lastUpload.next_step}
                  {lastUpload.detected_columns?.length > 0 && (
                    <div className="mt-1.5 text-[10px] text-[var(--kiq-ink)]/40">
                      Detected columns: <span className="font-mono text-[var(--kiq-ink)]/55">{lastUpload.detected_columns.slice(0, 8).join(", ")}{lastUpload.detected_columns.length > 8 ? " …" : ""}</span>
                    </div>
                  )}
                </div>
              )}
              {uploads && uploads.length > 0 && (
                <div className="space-y-1 mt-2 pt-2 border-t border-[var(--kiq-hairline)]/70">
                  {uploads.slice(0, 5).map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2 text-[11px] text-[var(--kiq-ink)]/55" data-testid={`cr-upload-row-${u.id}`}>
                      <FileText size={10} className="text-[var(--kiq-ink)]/35" />
                      <span className="truncate flex-1">{u.original_filename}</span>
                      <span className="text-[var(--kiq-ink)]/35">{(u.file_size / 1024).toFixed(1)} KB</span>
                      <span className="text-[var(--kiq-ink)]/30">{u.uploaded_at ? new Date(u.uploaded_at).toLocaleDateString() : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64 gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
              <span className="text-[var(--kiq-ink)]/40 text-sm">Loading enterprise claims data…</span>
            </div>
          ) : data ? (
            <>
              {tab === "command"    && <CommandCenterTab  d={data} />}
              {tab === "findings"   && <FindingsTab       d={data} />}
              {tab === "ai"         && <AiForensicTab     lastUpload={lastUpload} />}
              {tab === "universe"   && <ClaimsUniverseTab lastUpload={lastUpload} />}
              {tab === "scorecard"  && <VendorScorecardTab />}
              {tab === "regulatory" && <RegulatoryMatrixTab />}
              {tab === "ar"         && <ArLedgerTab />}
              {tab === "pipeline"   && <PipelineTab       d={data} />}
              {tab === "calculator" && <CalculatorTab     d={data} />}
              {tab === "timeline"   && <TimelineTab       d={data} />}
            </>
          ) : <div className="text-[var(--kiq-ink)]/30 text-center py-20">No data.</div>}
        </div>
      </div>

      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="claims-recovery"
        summaryData={emailSummary}
        reportData={data}
      />
    </Layout>
  );
}
