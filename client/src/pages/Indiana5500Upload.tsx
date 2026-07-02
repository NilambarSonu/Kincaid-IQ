import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, X, Sparkles, Loader2, AlertTriangle,
  XCircle, Eye, ArrowLeft, Building2,
  DollarSign, Users, TrendingUp, Shield, BarChart3,
  Flag, ChevronRight, Hash, Info, RotateCcw,
  BadgeAlert
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface UploadedFiling {
  filename: string;
  employer_name: string | null;
  ein: string | null;
  plan_year: number | null;
  participants_beginning: number;
  participants_end: number;
  total_welfare_premiums: number;
  total_broker_commissions: number;
  total_admin_fees: number;
  total_income: number;
  has_stop_loss: boolean;
  has_health_coverage: boolean;
  plan_name: string | null;
  carrier_name: string | null;
  broker_pct: number | null;
  admin_pct: number | null;
  pmpm: number | null;
  vs_in_broker_median_pct: number | null;
  notes: string | null;
}

interface UploadResult {
  filings: UploadedFiling[];
  indiana_benchmark: {
    employer_count: number;
    avg_participants: number;
    median_premiums: number;
    median_commissions: number;
    median_admin_fees: number;
    avg_broker_pct: number;
    avg_admin_pct: number;
  };
  narrative: string;
  file_count: number;
  generated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtPct = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)}%` : "—";

function riskScore(filings: UploadedFiling[], bench: UploadResult["indiana_benchmark"]): number {
  if (!filings.length) return 0;
  let score = 100;
  filings.forEach(f => {
    if (f.broker_pct != null && f.broker_pct > bench.avg_broker_pct * 1.5) score -= 20;
    else if (f.broker_pct != null && f.broker_pct > bench.avg_broker_pct) score -= 10;
    if (f.admin_pct != null && f.admin_pct > bench.avg_admin_pct * 1.5) score -= 15;
    if (!f.has_stop_loss) score -= 10;
    if (f.vs_in_broker_median_pct != null && f.vs_in_broker_median_pct > 75) score -= 10;
  });
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskLabel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 80) return { label: "LOW RISK", color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.30)" };
  if (score >= 55) return { label: "MODERATE", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" };
  return { label: "HIGH RISK", color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)" };
}

function brokerVerdict(f: UploadedFiling, bench: UploadResult["indiana_benchmark"]): { label: string; color: string } {
  if (f.broker_pct == null) return { label: "No Data", color: "#71717a" };
  if (f.broker_pct > bench.avg_broker_pct * 1.5) return { label: "Elevated — Review Required", color: "#ef4444" };
  if (f.broker_pct > bench.avg_broker_pct) return { label: "Above Tennessee Average", color: "#f59e0b" };
  return { label: "Within Benchmark", color: "#10b981" };
}

// ── Gauge component ──────────────────────────────────────────────────────────
function PercentileGauge({ value, label, p50, p75, p90, color }: {
  value: number | null; label: string; p50: number; p75: number; p90: number; color: string;
}) {
  const max = p90 * 1.4;
  const pct = value != null ? Math.min((value / max) * 100, 100) : 0;
  const p50pct = (p50 / max) * 100;
  const p75pct = (p75 / max) * 100;
  const p90pct = (p90 / max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-black font-mono" style={{ color }}>{fmtPct(value)}</span>
      </div>
      <div className="relative h-2.5 bg-zinc-800 rounded-full overflow-hidden">
        {/* Track zones */}
        <div className="absolute inset-y-0 left-0 rounded-full opacity-20" style={{ width: `${p50pct}%`, background: "#10b981" }} />
        <div className="absolute inset-y-0 rounded-full opacity-15" style={{ left: `${p50pct}%`, width: `${p75pct - p50pct}%`, background: "#f59e0b" }} />
        <div className="absolute inset-y-0 rounded-full opacity-15" style={{ left: `${p75pct}%`, width: `${p90pct - p75pct}%`, background: "#ef4444" }} />
        {/* Value bar */}
        {value != null && (
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        )}
      </div>
      <div className="flex items-center justify-between text-[9px] text-zinc-700">
        <span>P50 {fmtPct(p50)}</span>
        <span>P75 {fmtPct(p75)}</span>
        <span>P90 {fmtPct(p90)}</span>
      </div>
    </div>
  );
}

// ── Narrative renderer ───────────────────────────────────────────────────────
function NarrativeProse({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return (
            <div key={i} className="flex items-center gap-2 pt-5 pb-1 first:pt-0">
              <div className="w-1 h-4 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">{line.replace("## ", "")}</h3>
            </div>
          );
        if (line.startsWith("### "))
          return <h4 key={i} className="text-[11px] font-bold text-zinc-300 mt-3 mb-1">{line.replace("### ", "")}</h4>;
        if (line.startsWith("- "))
          return (
            <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
              <ChevronRight className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{line.replace("- ", "")}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-xs text-zinc-400 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ── Report header watermark ──────────────────────────────────────────────────
const DIVIDER = "linear-gradient(90deg,transparent,rgba(255,255,255,0.07) 20%,rgba(255,255,255,0.12) 50%,rgba(255,255,255,0.07) 80%,transparent)";

// ── Main Component ───────────────────────────────────────────────────────────
export default function Indiana5500Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async (toUpload: File[]) => {
      const fd = new FormData();
      toUpload.forEach(f => fd.append("files", f));
      const res = await fetch("/api/actuarial/upload-indiana", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: data => { setResult(data); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const addFiles = (incoming: File[]) => {
    const pdfs = incoming.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    setFiles(prev => [...prev, ...pdfs].slice(0, 6));
  };

  const reset = () => { setFiles([]); setResult(null); setError(null); mutation.reset(); };

  const step = result ? 3 : mutation.isPending ? 2 : files.length > 0 ? 1 : 0;

  return (
    <Layout>
      <div className="min-h-full text-zinc-100" style={{ background: "#04060f" }}>

        {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(4,6,20,0.98)" }}>
          <div className="max-w-5xl mx-auto px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/actuarial-workbench">
                <button data-testid="btn-back-workbench" className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div>
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <h1 className="text-sm font-black tracking-tight text-white">Form 5500 Actuarial Analysis</h1>
                  <span className="px-2 py-px rounded text-[9px] font-black tracking-widest uppercase" style={{ background: "rgba(79,125,255,0.15)", color: "#4f7dff", border: "1px solid rgba(79,125,255,0.25)" }}>
                    Tennessee · DOL Benchmarked
                  </span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Upload 1–6 Form 5500 PDFs · Claude extracts financials · Benchmarked vs {result?.indiana_benchmark.employer_count.toLocaleString() ?? "3,232"} Tennessee DOL employers
                </p>
              </div>
            </div>

            {/* Step tracker */}
            <div className="hidden md:flex items-center gap-1">
              {[{ n: 1, label: "Upload" }, { n: 2, label: "Analyze" }, { n: 3, label: "Report" }].map((s, i, arr) => (
                <div key={s.n} className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all" style={{
                    background: step >= s.n ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                    color: step >= s.n ? "#10b981" : "rgba(255,255,255,0.25)",
                    border: `1px solid ${step >= s.n ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black" style={{
                      background: step >= s.n ? "#10b981" : "rgba(255,255,255,0.08)",
                      color: step >= s.n ? "#fff" : "rgba(255,255,255,0.3)",
                    }}>{s.n}</span>
                    {s.label}
                  </div>
                  {i < arr.length - 1 && <div className="w-5 h-px" style={{ background: step > s.n ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.06)" }} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">

          {/* ── STEP 0/1: Upload zone ────────────────────────────────────── */}
          {!result && !mutation.isPending && (
            <>
              <div
                data-testid="dropzone-5500"
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-2xl border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-16 px-8 text-center transition-all"
                style={{
                  borderColor: dragging ? "rgba(16,185,129,0.6)" : "rgba(255,255,255,0.08)",
                  background: dragging ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                }}
              >
                <input ref={fileInputRef} type="file" multiple accept=".pdf" className="hidden"
                  onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all" style={{
                  background: dragging ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${dragging ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}>
                  <Upload className="w-7 h-7" style={{ color: dragging ? "#10b981" : "rgba(255,255,255,0.25)" }} />
                </div>
                <p className="text-base font-black text-white mb-1">{dragging ? "Release to add files" : "Drop Form 5500 PDFs here"}</p>
                <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>or click to browse</p>
                <div className="flex items-center gap-3 text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {["PDF only", "1–6 filings", "Tennessee employers", "Claude AI parsing"].map((t, i, a) => (
                    <span key={t} className="flex items-center gap-3">
                      {t}
                      {i < a.length - 1 && <span className="w-px h-3 inline-block" style={{ background: "rgba(255,255,255,0.1)" }} />}
                    </span>
                  ))}
                </div>
                {files.length > 0 && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                    {files.length} / 6 queued
                  </div>
                )}
              </div>

              {files.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>Queued Filings</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {files.map((f, i) => (
                      <div key={i} data-testid={`file-card-${i}`} className="relative rounded-xl p-4 flex flex-col gap-2 transition-all"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <button data-testid={`btn-remove-file-${i}`}
                          onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                          className="absolute top-2.5 right-2.5 w-5 h-5 rounded flex items-center justify-center transition-colors"
                          style={{ color: "rgba(255,255,255,0.2)" }}
                          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.background = "transparent"; }}>
                          <X className="w-3 h-3" />
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                          <FileText className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white truncate pr-4 leading-tight">{f.name.replace(".pdf", "")}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{(f.size / 1024).toFixed(0)} KB · PDF</p>
                        </div>
                      </div>
                    ))}
                    {files.length < 6 && (
                      <div onClick={() => fileInputRef.current?.click()}
                        className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[88px] transition-all"
                        style={{ background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(255,255,255,0.06)" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
                        <div className="w-6 h-6 rounded flex items-center justify-center text-lg leading-none" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>+</div>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Add more</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-400 mb-0.5">Analysis Failed</p>
                    <p className="text-xs" style={{ color: "rgba(239,68,68,0.65)" }}>{error}</p>
                  </div>
                </div>
              )}

              {files.length > 0 && (
                <div className="flex items-center gap-4">
                  <Button data-testid="btn-analyze-uploads" onClick={() => mutation.mutate(files)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 h-11 rounded-xl text-sm tracking-wide">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze {files.length} Filing{files.length !== 1 ? "s" : ""} vs Tennessee Benchmarks
                  </Button>
                  <button data-testid="btn-clear-all" onClick={() => setFiles([])}
                    className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.25)" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}>
                    Clear all
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── STEP 2: Processing ───────────────────────────────────────── */}
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center py-28 gap-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Sparkles className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#04060f", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                </div>
              </div>
              <div>
                <p className="text-xl font-black text-white mb-2">Generating Actuarial Report</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Extracting financials from {files.length} filing{files.length !== 1 ? "s" : ""} · benchmarking against 3,232 Tennessee employers
                </p>
              </div>
              <div className="flex items-center gap-8 mt-2">
                {["PDF extraction", "Financial parsing", "TN benchmarking", "AI narrative"].map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDelay: `${i * 0.25}s` }} />
                    </div>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              STEP 3: ACTUARIAL ANALYSIS REPORT TEMPLATE
          ══════════════════════════════════════════════════════════════════ */}
          {result && (() => {
            const score = riskScore(result.filings, result.indiana_benchmark);
            const risk = riskLabel(score);
            const bench = result.indiana_benchmark;
            const avgBrokerPct = bench.avg_broker_pct;
            const avgAdminPct = bench.avg_admin_pct;
            const totalPremiums = result.filings.reduce((s, f) => s + f.total_welfare_premiums, 0);
            const totalCommissions = result.filings.reduce((s, f) => s + f.total_broker_commissions, 0);
            const totalAdmin = result.filings.reduce((s, f) => s + f.total_admin_fees, 0);
            const totalParticipants = result.filings.reduce((s, f) => s + (f.participants_end || f.participants_beginning || 0), 0);
            const flaggedFilings = result.filings.filter(f => f.broker_pct != null && f.broker_pct > avgBrokerPct * 1.5);

            return (
              <div className="space-y-0">

                {/* ── REPORT COVER ─────────────────────────────────────────── */}
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "linear-gradient(160deg,rgba(16,185,129,0.06) 0%,rgba(4,6,20,0.95) 60%)" }}>
                  {/* Top brand strip */}
                  <div className="flex items-center justify-between px-7 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
                        <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>Kincaid IQ · Actuarial Intelligence Report</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                        Generated {new Date(result.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
                      <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>DOL 5500 · Tennessee</span>
                    </div>
                  </div>

                  {/* Cover content */}
                  <div className="px-7 py-7 grid grid-cols-3 gap-8 items-start">
                    {/* Left: title block */}
                    <div className="col-span-2 space-y-4">
                      <div>
                        <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: "rgba(16,185,129,0.7)" }}>Form 5500 Actuarial Analysis</p>
                        <h2 className="text-2xl font-black leading-tight text-white">
                          {result.file_count === 1
                            ? (result.filings[0]?.employer_name ?? "Employer Analysis")
                            : `${result.file_count}-Employer Comparative Analysis`}
                        </h2>
                        <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {result.filings.map(f => f.plan_year).filter(Boolean).join(", ") || "Plan Year Analysis"} · Tennessee DOL Benchmarks
                        </p>
                      </div>

                      {/* Summary stat row */}
                      <div className="grid grid-cols-4 gap-3 pt-2">
                        {[
                          { label: "Total Premiums", val: fmt$(totalPremiums), icon: DollarSign, accent: "#4f7dff" },
                          { label: "Total Participants", val: totalParticipants.toLocaleString(), icon: Users, accent: "#4f7dff" },
                          { label: "Broker Commissions", val: fmt$(totalCommissions), icon: TrendingUp, accent: "#f59e0b" },
                          { label: "Admin Fees", val: fmt$(totalAdmin), icon: Shield, accent: "#a855f7" },
                        ].map((s, i) => (
                          <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <s.icon className="w-3 h-3" style={{ color: s.accent }} />
                              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                            </div>
                            <p className="text-base font-black text-white font-mono">{s.val}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Risk scorecard */}
                    <div className="rounded-2xl p-5 text-center flex flex-col items-center gap-3" style={{ background: risk.bg, border: `1px solid ${risk.border}` }}>
                      <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: risk.color }}>Fiduciary Risk Score</p>
                      <div className="relative">
                        <div className="text-5xl font-black font-mono" style={{ color: risk.color }}>{score}</div>
                        <div className="text-[10px] font-bold" style={{ color: risk.color }}>/100</div>
                      </div>
                      <div className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest" style={{ background: risk.bg, border: `1px solid ${risk.border}`, color: risk.color }}>
                        {risk.label}
                      </div>
                      <div className="w-full h-px mt-1" style={{ background: risk.border }} />
                      <div className="space-y-1.5 w-full text-left">
                        {[
                          { label: "Filings analyzed", val: result.file_count },
                          { label: "Flagged employers", val: flaggedFilings.length },
                          { label: "Stop-loss coverage", val: `${result.filings.filter(f => f.has_stop_loss).length}/${result.file_count}` },
                        ].map(r => (
                          <div key={r.label} className="flex items-center justify-between text-[10px]">
                            <span style={{ color: "rgba(255,255,255,0.4)" }}>{r.label}</span>
                            <span className="font-bold" style={{ color: risk.color }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── SECTION DIVIDER ───────────────────────────────────────── */}
                <div className="py-6 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: DIVIDER }} />
                  <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.15)" }}>Tennessee DOL Benchmarks</span>
                  <div className="flex-1 h-px" style={{ background: DIVIDER }} />
                </div>

                {/* ── TENNESSEE BENCHMARK BAND ──────────────────────────────── */}
                <div className="rounded-2xl p-6" style={{ background: "rgba(79,125,255,0.04)", border: "1px solid rgba(79,125,255,0.15)" }}>
                  <div className="flex items-center gap-2 mb-5">
                    <Hash className="w-3.5 h-3.5" style={{ color: "#4f7dff" }} />
                    <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#4f7dff" }}>
                      Tennessee DOL Reference Pool · {bench.employer_count.toLocaleString()} Employers
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Median Commissions", val: fmt$(bench.median_commissions), sub: "50th percentile" },
                      { label: "Median Admin Fees", val: fmt$(bench.median_admin_fees), sub: "50th percentile" },
                      { label: "Avg Broker %", val: fmtPct(bench.avg_broker_pct), sub: "of premium" },
                      { label: "Avg Admin %", val: fmtPct(bench.avg_admin_pct), sub: "of premium" },
                    ].map((s, i) => (
                      <div key={i} className="space-y-0.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,125,255,0.6)" }}>{s.label}</p>
                        <p className="text-xl font-black font-mono" style={{ color: "#4f7dff" }}>{s.val}</p>
                        <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>{s.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── SECTION DIVIDER ───────────────────────────────────────── */}
                <div className="py-6 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: DIVIDER }} />
                  <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.15)" }}>Per-Employer Analysis</span>
                  <div className="flex-1 h-px" style={{ background: DIVIDER }} />
                </div>

                {/* ── PER-FILING CARDS ──────────────────────────────────────── */}
                <div className="space-y-5">
                  {result.filings.map((f, i) => {
                    const brokerHigh = f.broker_pct != null && f.broker_pct > avgBrokerPct * 1.5;
                    const brokerMid = f.broker_pct != null && !brokerHigh && f.broker_pct > avgBrokerPct;
                    const adminHigh = f.admin_pct != null && f.admin_pct > avgAdminPct * 1.5;
                    const brokerColor = brokerHigh ? "#ef4444" : brokerMid ? "#f59e0b" : "#10b981";
                    const verdict = brokerVerdict(f, bench);
                    const vsMedian = f.vs_in_broker_median_pct;

                    return (
                      <div key={i} data-testid={`card-filing-${i}`} className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>

                        {/* Card header */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                              <Building2 className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-white leading-tight">{f.employer_name ?? f.filename.replace(".pdf", "")}</p>
                                {brokerHigh && <BadgeAlert className="w-3.5 h-3.5 text-red-400" />}
                              </div>
                              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                                {f.ein ? `EIN ${f.ein}` : "EIN unknown"}
                                {f.plan_year ? ` · Plan Year ${f.plan_year}` : ""}
                                {f.plan_name ? ` · ${f.plan_name}` : ""}
                                {f.carrier_name ? ` · ${f.carrier_name}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {f.has_stop_loss
                              ? <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}><Shield className="w-2.5 h-2.5" />Stop-Loss ✓</span>
                              : <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}><XCircle className="w-2.5 h-2.5" />No Stop-Loss</span>
                            }
                            <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                              Filing {i + 1} of {result.file_count}
                            </span>
                          </div>
                        </div>

                        {/* Main body */}
                        <div className="p-6 grid grid-cols-3 gap-6">

                          {/* Col 1: Key metrics */}
                          <div className="space-y-4">
                            <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>Plan Financials</p>
                            <div className="space-y-2">
                              {[
                                { label: "Participants", val: (f.participants_end || f.participants_beginning || 0).toLocaleString() },
                                { label: "Total Premiums", val: fmt$(f.total_welfare_premiums) },
                                { label: "PMPM Cost", val: f.pmpm ? fmt$(f.pmpm) : "—" },
                                { label: "Total Income", val: fmt$(f.total_income) },
                              ].map(r => (
                                <div key={r.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</span>
                                  <span className="text-xs font-black text-white font-mono">{r.val}</span>
                                </div>
                              ))}
                            </div>
                            {/* Coverage flags */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {f.has_health_coverage && <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.08)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>Health</span>}
                              {f.has_stop_loss && <span className="text-[9px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(79,125,255,0.08)", color: "#4f7dff", border: "1px solid rgba(79,125,255,0.2)" }}>Stop-Loss</span>}
                            </div>
                          </div>

                          {/* Col 2: Benchmark gauges */}
                          <div className="space-y-4">
                            <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>Benchmark Position</p>
                            <PercentileGauge
                              value={f.broker_pct}
                              label="Broker Commission %"
                              p50={avgBrokerPct * 0.9}
                              p75={avgBrokerPct * 1.2}
                              p90={avgBrokerPct * 1.6}
                              color={brokerColor}
                            />
                            <PercentileGauge
                              value={f.admin_pct}
                              label="Admin Fee %"
                              p50={avgAdminPct * 0.9}
                              p75={avgAdminPct * 1.2}
                              p90={avgAdminPct * 1.6}
                              color={adminHigh ? "#ef4444" : "#a855f7"}
                            />
                            {/* vs IN Median badge */}
                            {vsMedian !== null && (
                              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{
                                background: vsMedian > 50 ? "rgba(239,68,68,0.06)" : vsMedian > 0 ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)",
                                border: `1px solid ${vsMedian > 50 ? "rgba(239,68,68,0.2)" : vsMedian > 0 ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
                              }}>
                                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>vs TN Median Broker</span>
                                <span className="text-sm font-black font-mono" style={{ color: vsMedian > 50 ? "#ef4444" : vsMedian > 0 ? "#f59e0b" : "#10b981" }}>
                                  {vsMedian > 0 ? "+" : ""}{vsMedian.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Col 3: Dollar breakdown + verdict */}
                          <div className="space-y-4">
                            <p className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>Cost Breakdown</p>
                            <div className="space-y-3">
                              <div className="rounded-xl p-3.5" style={{ background: "rgba(79,125,255,0.05)", border: "1px solid rgba(79,125,255,0.14)" }}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(79,125,255,0.6)" }}>Broker Commissions</span>
                                  <span className="text-[10px] font-black font-mono" style={{ color: brokerColor }}>{fmtPct(f.broker_pct)}</span>
                                </div>
                                <p className="text-base font-black text-white font-mono">{fmt$(f.total_broker_commissions)}</p>
                                <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>TN avg: {fmtPct(avgBrokerPct)}</p>
                              </div>
                              <div className="rounded-xl p-3.5" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.14)" }}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(168,85,247,0.6)" }}>Admin Fees</span>
                                  <span className="text-[10px] font-black font-mono" style={{ color: adminHigh ? "#ef4444" : "#a855f7" }}>{fmtPct(f.admin_pct)}</span>
                                </div>
                                <p className="text-base font-black text-white font-mono">{fmt$(f.total_admin_fees)}</p>
                                <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>TN avg: {fmtPct(avgAdminPct)}</p>
                              </div>
                            </div>

                            {/* Fiduciary verdict */}
                            <div className="rounded-xl p-3 flex items-start gap-2" style={{
                              background: brokerHigh ? "rgba(239,68,68,0.06)" : brokerMid ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)",
                              border: `1px solid ${brokerHigh ? "rgba(239,68,68,0.2)" : brokerMid ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}`,
                            }}>
                              <Flag className="w-3 h-3 mt-0.5 shrink-0" style={{ color: verdict.color }} />
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: verdict.color }}>Actuarial Verdict</p>
                                <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{verdict.label}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Notes strip */}
                        {f.notes && (
                          <div className="px-6 py-3 flex items-start gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                            <Info className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-zinc-500 leading-relaxed">{f.notes}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── SECTION DIVIDER ───────────────────────────────────────── */}
                <div className="py-6 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: DIVIDER }} />
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3" style={{ color: "#10b981" }} />
                    <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.15)" }}>Actuarial Intelligence Report</span>
                  </div>
                  <div className="flex-1 h-px" style={{ background: DIVIDER }} />
                </div>

                {/* ── AI NARRATIVE REPORT ───────────────────────────────────── */}
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(16,185,129,0.15)", background: "rgba(16,185,129,0.02)" }}>
                  {/* Report header */}
                  <div className="flex items-center justify-between px-7 py-4" style={{ borderBottom: "1px solid rgba(16,185,129,0.10)", background: "rgba(16,185,129,0.04)" }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400">Claude Actuarial Intelligence · Tennessee DOL Benchmarked</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>claude-sonnet · {bench.employer_count.toLocaleString()} employer pool</span>
                      <span className="text-[9px] px-2 py-0.5 rounded font-bold" style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.20)" }}>FIDUCIARY GRADE</span>
                    </div>
                  </div>

                  {/* Narrative body */}
                  <div className="px-7 py-6">
                    <NarrativeProse text={result.narrative} />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-7 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                    <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                      Generated by Kincaid IQ · Benchmarked vs {bench.employer_count.toLocaleString()} Tennessee DOL employers · For informational purposes only — not legal or investment advice
                    </p>
                    <button data-testid="btn-new-analysis" onClick={reset}
                      className="flex items-center gap-1.5 text-[10px] font-bold transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                      <RotateCcw className="w-3 h-3" />
                      New Analysis
                    </button>
                  </div>
                </div>

              </div>
            );
          })()}

        </div>
      </div>
    </Layout>
  );
}

