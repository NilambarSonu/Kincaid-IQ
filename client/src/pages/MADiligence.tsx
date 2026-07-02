import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  Search, Upload, FileText, AlertTriangle, CheckCircle2, XCircle,
  Shield, Pill, Building2, TrendingUp, Scale, Zap, BarChart3,
  ChevronDown, ChevronRight, Download, RefreshCw, Clock, DollarSign,
  Activity, Users, MapPin, ExternalLink, ShieldAlert, Target,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const CRIMSON = "#9B1C2E";
const RED     = "#EF4444";
const AMBER   = "#F59E0B";
const GREEN   = "#10B981";
const BLUE    = "#00D4FF";
const NAVY    = "#002B5C";
const PURPLE  = "#A855F7";
const GOLD    = "#FFB800";
const T1      = "#fff";
const T2      = "rgba(255,255,255,0.55)";
const T3      = "rgba(255,255,255,0.3)";
const BORDER  = "rgba(255,255,255,0.08)";

function fmt(v: number | undefined) {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}
function fmtN(v: number | undefined) {
  if (!v) return "—";
  return v.toLocaleString();
}
function scoreColor(s: number) {
  if (s >= 75) return GREEN;
  if (s >= 55) return AMBER;
  return RED;
}
function riskLabel(s: number) {
  if (s >= 75) return "LOW RISK";
  if (s >= 55) return "MODERATE";
  return "HIGH RISK";
}

interface DiligenceData {
  ein: string;
  company_name: string;
  city: string;
  state: string;
  sector: string;
  edgar: any;
  plan_count: number;
  has_welfare: boolean;
  has_pension: boolean;
  has_stop_loss: boolean;
  total_participants: number;
  total_income: number;
  total_expense: number;
  total_assets: number;
  total_liabilities: number;
  pmpm: number;
  mlr_est: number;
  year_history: { year: number; participants: number; income: number; expense: number }[];
  scores: {
    overall: number;
    stop_loss: number;
    rx_pbm: number;
    fiduciary: number;
    claims_financial: number;
    integration_risk: number;
    regulatory: number;
  };
  liabilities: {
    stop_loss_gap: number;
    rx_overcharge: number;
    fiduciary_exposure: number;
    total_quantified: number;
  };
  flags: {
    no_stop_loss: boolean;
    high_mlr: boolean;
    multi_plan: boolean;
    is_public: boolean;
    low_overall: boolean;
  };
  recommendation: string;
}

const DOC_TYPES = [
  { id: "census",      label: "Employee Census",         desc: "Current participant list with demographics", icon: Users   },
  { id: "plan_doc",    label: "Summary Plan Description", desc: "SPD / Plan document",                       icon: FileText },
  { id: "stop_loss",   label: "Stop-Loss Policy",        desc: "Specific & aggregate stop-loss contract",   icon: Shield  },
  { id: "pbm",         label: "PBM Contract",            desc: "Pharmacy benefit manager agreement",        icon: Pill    },
  { id: "tpa",         label: "TPA Agreement",           desc: "Third-party administrator contract",        icon: Building2 },
  { id: "claims",      label: "Claims Data (24 mo)",     desc: "Medical & Rx claims detail",                icon: BarChart3 },
  { id: "5500",        label: "Form 5500 (3 yrs)",       desc: "Annual benefit plan filings",               icon: FileText },
  { id: "invoices",    label: "Carrier Invoices",        desc: "Premium and admin fee statements",          icon: DollarSign },
];

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%",
        background: `conic-gradient(${c} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0a0a14",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: c }}>{score}</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 900, color: c, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          {riskLabel(score)}
        </div>
      </div>
    </div>
  );
}

function Flag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 4,
      background: `${color}15`, border: `1px solid ${color}30`, color,
      letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {text}
    </span>
  );
}

function GateCard({
  num, icon: Icon, label, score, color, findings, liability, children, defaultOpen
}: {
  num: number; icon: any; label: string; score: number; color: string;
  findings: string[]; liability?: number; children?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const c = scoreColor(score);
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${c}22`,
      borderLeft: `3px solid ${c}`, borderRadius: 14, overflow: "hidden", marginBottom: 10 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}18`,
          border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon style={{ width: 14, height: 14, color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: T3, letterSpacing: "0.14em" }}>GATE {num}</span>
            <Flag text={riskLabel(score)} color={c} />
            {liability !== undefined && liability > 0 && (
              <span style={{ fontSize: 9, fontWeight: 900, color: RED, background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, padding: "2px 7px" }}>
                {fmt(liability)} exposure
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T1, marginTop: 2 }}>{label}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 8, color: T3, textTransform: "uppercase", letterSpacing: "0.08em" }}>/ 100</div>
          </div>
          {open ? <ChevronDown style={{ width: 14, height: 14, color: T3 }} />
                : <ChevronRight style={{ width: 14, height: 14, color: T3 }} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${BORDER}` }}>
          <div style={{ paddingTop: 12, marginBottom: 12 }}>
            {findings.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ color: score >= 70 ? GREEN : score >= 50 ? AMBER : RED, marginTop: 1, fontSize: 11, flexShrink: 0 }}>
                  {score >= 70 ? "✓" : score >= 50 ? "⚠" : "✕"}
                </span>
                <span style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{f}</span>
              </div>
            ))}
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
    </div>
  );
}

function EINSearch({ onResult }: { onResult: (data: DiligenceData) => void }) {
  const [ein, setEin] = useState("");
  const [dealName, setDealName] = useState("");

  const { refetch, isFetching, error } = useQuery<DiligenceData>({
    queryKey: ["/api/ma/lookup", ein],
    queryFn: async () => {
      const res = await fetch(`/api/ma/lookup/${ein.replace(/\D/g,"")}`, { credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Lookup failed"); }
      return res.json();
    },
    enabled: false,
  });

  async function handleSearch() {
    const { data } = await refetch();
    if (data) onResult(data);
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 48 }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
          background: `${CRIMSON}18`, border: `1px solid ${CRIMSON}40`,
          borderRadius: 20, padding: "6px 18px", marginBottom: 18 }}>
          <ShieldAlert style={{ width: 12, height: 12, color: CRIMSON }} />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em",
            textTransform: "uppercase", color: CRIMSON }}>
            M&A Benefits Due Diligence™
          </span>
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: T1, marginBottom: 12, lineHeight: 1.2 }}>
          Benefits Plan Acquisition Intelligence
        </div>
        <div style={{ fontSize: 14, color: T2, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
          Enter the target company's EIN to instantly pull Form 5500 history, score
          stop-loss exposure, flag PBM contract risk, and quantify fiduciary liabilities —
          before you sign the LOI.
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${CRIMSON}30`,
        borderRadius: 18, padding: 28 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 900, color: T3, letterSpacing: "0.1em",
              textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Target Company EIN
            </label>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                width: 14, height: 14, color: T3 }} />
              <input
                data-testid="ma-ein-input"
                value={ein}
                onChange={e => setEin(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="XX-XXXXXXX"
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${CRIMSON}30`,
                  borderRadius: 10, padding: "12px 12px 12px 38px", color: T1, fontSize: 14,
                  fontWeight: 700, outline: "none", boxSizing: "border-box",
                  letterSpacing: "0.06em" }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, fontWeight: 900, color: T3, letterSpacing: "0.1em",
              textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Deal / Project Name (optional)
            </label>
            <input
              data-testid="ma-deal-name"
              value={dealName}
              onChange={e => setDealName(e.target.value)}
              placeholder="e.g. Project Atlas"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "12px", color: T1, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <button onClick={handleSearch} disabled={isFetching || ein.replace(/\D/g,"").length < 8}
          data-testid="ma-search-btn"
          style={{ width: "100%", padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 900,
            cursor: ein.replace(/\D/g,"").length < 8 ? "not-allowed" : "pointer",
            background: ein.replace(/\D/g,"").length >= 8
              ? `linear-gradient(135deg, ${CRIMSON}, #7B0D1E)`
              : "rgba(255,255,255,0.06)",
            border: "none", color: T1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: ein.replace(/\D/g,"").length < 8 ? 0.5 : 1 }}>
          {isFetching
            ? <><RefreshCw style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Pulling Form 5500 + EDGAR data…</>
            : <><ShieldAlert style={{ width: 15, height: 15 }} /> Run Benefits Diligence Analysis</>}
        </button>
        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: RED }}>
            {(error as Error).message}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 28 }}>
        {[
          { label: "Gates Analyzed", value: "8", color: CRIMSON, icon: Target },
          { label: "Data Sources", value: "Form 5500 + EDGAR", color: BLUE, icon: Database2 },
          { label: "Liability Flags", value: "3 Categories", color: AMBER, icon: AlertTriangle },
          { label: "Report Format", value: "PDF Export", color: GREEN, icon: Download },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: "14px", textAlign: "center" }}>
            <Icon style={{ width: 16, height: 16, color, margin: "0 auto 8px" }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: T1 }}>{value}</div>
            <div style={{ fontSize: 9, color: T3, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Database2(props: any) {
  return <BarChart3 {...props} />;
}

function DocumentVault({ ein }: { ein: string }) {
  const [uploads, setUploads] = useState<Record<string, { name: string; status: "uploading" | "done" | "error" }>>({});
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const mutation = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: string }) => {
      const fd = new FormData();
      fd.append("ein", ein);
      fd.append("doc_type", docType);
      fd.append("file", file);
      const res = await fetch("/api/ma/upload-doc", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: (_data, { docType }) => {
      setUploads(u => ({ ...u, [docType]: { ...u[docType], status: "done" } }));
    },
    onError: (_err, { docType }) => {
      setUploads(u => ({ ...u, [docType]: { ...u[docType], status: "error" } }));
    },
  });

  function handleFile(docType: string, file: File) {
    setUploads(u => ({ ...u, [docType]: { name: file.name, status: "uploading" } }));
    mutation.mutate({ file, docType });
  }

  const uploaded = Object.values(uploads).filter(u => u.status === "done").length;

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`,
      borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>Document Upload Vault</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>
            Upload plan documents to enrich the analysis — each doc unlocks deeper scoring
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: uploaded >= 4 ? GREEN : AMBER }}>
          {uploaded}/{DOC_TYPES.length} uploaded
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {DOC_TYPES.map(({ id, label, desc, icon: Icon }) => {
          const u = uploads[id];
          const isDone = u?.status === "done";
          const isUploading = u?.status === "uploading";
          return (
            <div key={id}>
              <input type="file" ref={el => { refs.current[id] = el; }} style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(id, f); }} />
              <button
                data-testid={`upload-${id}`}
                onClick={() => refs.current[id]?.click()}
                style={{ width: "100%", padding: "12px 10px",
                  background: isDone ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isDone ? "rgba(16,185,129,0.25)" : BORDER}`,
                  borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.12s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${CRIMSON}40`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isDone ? "rgba(16,185,129,0.25)" : BORDER; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {isDone
                    ? <CheckCircle2 style={{ width: 12, height: 12, color: GREEN, flexShrink: 0 }} />
                    : isUploading
                    ? <RefreshCw style={{ width: 12, height: 12, color: AMBER, flexShrink: 0, animation: "spin 1s linear infinite" }} />
                    : <Upload style={{ width: 12, height: 12, color: T3, flexShrink: 0 }} />}
                  <span style={{ fontSize: 10, fontWeight: 800, color: isDone ? GREEN : T2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isDone ? u.name : label}
                  </span>
                </div>
                {!isDone && <div style={{ fontSize: 9, color: T3, lineHeight: 1.4 }}>{desc}</div>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FederalRiskGate({ companyName, ein }: { companyName: string; ein: string }) {
  const { data, isLoading } = useQuery<{
    risk_score: number; risk_signal: string; risk_color: string;
    sources_flagged: number; sources_watch: number; sources_clear: number; total_hits: number;
    sources: Array<{ source: string; status: string; hits: number; authority: string }>;
  }>({
    queryKey: ["/api/federal-intel/scan", companyName, ein],
    queryFn: async () => {
      let url = `/api/federal-intel/scan?name=${encodeURIComponent(companyName)}`;
      if (ein) url += `&ein=${encodeURIComponent(ein)}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Federal scan failed");
      return r.json();
    },
    staleTime: 600_000,
  });

  const signalBg: Record<string, string> = { HIGH: "rgba(239,68,68,0.1)", ELEVATED: "rgba(245,158,11,0.1)", WATCH: "rgba(59,130,246,0.1)", CLEAR: "rgba(16,185,129,0.1)" };
  const signalBd: Record<string, string> = { HIGH: "rgba(239,68,68,0.3)", ELEVATED: "rgba(245,158,11,0.3)", WATCH: "rgba(59,130,246,0.3)", CLEAR: "rgba(16,185,129,0.3)" };
  const signalTx: Record<string, string> = { HIGH: "#ef4444", ELEVATED: "#f59e0b", WATCH: "#3b82f6", CLEAR: "#10b981" };

  if (isLoading) return (
    <div style={{ marginTop: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 14, height: 14, border: "2px solid #9B1C2E", borderTopColor: "transparent",
        borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
      <span style={{ fontSize: 11, color: T3 }}>Running 8-database federal scan for {companyName}…</span>
    </div>
  );

  if (!data) return null;

  const sig = data.risk_signal || "CLEAR";
  return (
    <div style={{ marginTop: 14, background: signalBg[sig] ?? "rgba(255,255,255,0.03)",
      border: `1px solid ${signalBd[sig] ?? BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 900, color: T3, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Federal Risk Intelligence™ — Auto Gate
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: signalTx[sig] ?? T2, lineHeight: 1 }}>{data.risk_score}</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: signalTx[sig] ?? T2 }}>{sig}</div>
            <div style={{ fontSize: 8, color: T3 }}>RISK SCORE / 100</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          { label: "Flagged", val: data.sources_flagged, color: data.sources_flagged > 0 ? RED : GREEN },
          { label: "Watch",   val: data.sources_watch,   color: data.sources_watch > 0 ? AMBER : GREEN },
          { label: "Clear",   val: data.sources_clear,   color: GREEN },
          { label: "Hits",    val: data.total_hits,      color: data.total_hits > 0 ? AMBER : GREEN },
        ].map(({ label, val, color }) => (
          <div key={label}>
            <div style={{ fontSize: 14, fontWeight: 900, color }}>{val}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: T3, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {data.sources?.map((src, i) => {
          const c = src.status === "FLAGGED" ? RED : src.status === "WATCH" ? AMBER : src.status === "CLEAR" ? GREEN : T3;
          return (
            <div key={i} style={{ fontSize: 9, background: `${c}14`, border: `1px solid ${c}30`,
              borderRadius: 12, padding: "2px 8px", color: c, fontWeight: 700 }}>
              {src.source} · {src.status}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: T3 }}>
        <a href="/federal-intelligence" style={{ color: "#4f7dff", textDecoration: "none" }}>
          → Open full Federal Risk Intelligence™ report ↗
        </a>
      </div>
    </div>
  );
}

function DiligenceReport({ data, onReset }: { data: DiligenceData; onReset: () => void }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function exportPDF() {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 1.5, backgroundColor: "#000" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const imgH = pw / ratio;
      let y = 0;
      while (y < canvas.height) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(canvas.height - y, canvas.width / (pw / ph));
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, -y);
        const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pw, Math.min(ph, (pageCanvas.height / canvas.width) * pw));
        y += pageCanvas.height;
      }
      pdf.save(`MA_Diligence_${data.company_name.replace(/\s+/g,"_")}_${new Date().toISOString().slice(0,10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const { scores, liabilities, flags, year_history } = data;
  const recColor = data.recommendation === "PROCEED" ? GREEN
    : data.recommendation.includes("CONDITIONS") ? AMBER : RED;

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={onReset} style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", color: T3, fontSize: 12, cursor: "pointer", padding: 0 }}>
          ← New Search
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={exportPDF} disabled={exporting} data-testid="ma-export-pdf"
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
            background: `${CRIMSON}18`, border: `1px solid ${CRIMSON}40`, borderRadius: 10,
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {exporting
            ? <RefreshCw style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
            : <Download style={{ width: 13, height: 13 }} />}
          Export M&A Report PDF
        </button>
      </div>

      <div ref={reportRef}>
        {/* Cover section */}
        <div style={{ background: `linear-gradient(135deg, ${NAVY}80, #0a0a14)`,
          border: `1px solid ${CRIMSON}30`, borderRadius: 18, padding: 28, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ padding: "4px 12px", background: `${CRIMSON}22`, border: `1px solid ${CRIMSON}40`,
                  borderRadius: 6, fontSize: 9, fontWeight: 900, letterSpacing: "0.15em",
                  textTransform: "uppercase", color: CRIMSON }}>
                  Confidential · Pre-Acquisition Due Diligence
                </div>
                {flags.is_public && (
                  <div style={{ padding: "4px 10px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)",
                    borderRadius: 6, fontSize: 9, fontWeight: 900, color: BLUE }}>📈 PUBLIC CO</div>
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: T1, marginBottom: 4 }}>
                {data.company_name}
              </div>
              <div style={{ fontSize: 12, color: T2, marginBottom: 12 }}>
                EIN {data.ein}
                {data.city && ` · ${data.city}, ${data.state}`}
                {data.sector && ` · ${data.sector}`}
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { label: "Plan Participants", value: fmtN(data.total_participants) },
                  { label: "Annual Benefits Cost", value: fmt(data.total_expense) },
                  { label: "PMPM", value: data.pmpm ? `$${data.pmpm}` : "—" },
                  { label: "Est. MLR", value: data.mlr_est ? `${data.mlr_est}%` : "—" },
                  { label: "Active Plans", value: String(data.plan_count) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: T1 }}>{value}</div>
                    <div style={{ fontSize: 9, color: T3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: T3, letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 8 }}>Overall Plan Risk Score</div>
              <div style={{ width: 100, height: 100, borderRadius: "50%", margin: "0 auto 10px",
                background: `conic-gradient(${scoreColor(scores.overall)} ${scores.overall * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#050510",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: scoreColor(scores.overall), lineHeight: 1 }}>
                    {scores.overall}
                  </div>
                  <div style={{ fontSize: 8, color: T3 }}>/100</div>
                </div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 900, color: recColor, background: `${recColor}15`,
                border: `1px solid ${recColor}30`, borderRadius: 20, padding: "4px 12px",
                letterSpacing: "0.08em" }}>
                {data.recommendation}
              </div>
              {data.edgar && (
                <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${data.edgar.cik}&type=10-K`}
                  target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 8,
                    fontSize: 10, color: BLUE, textDecoration: "none" }}>
                  <ExternalLink style={{ width: 10, height: 10 }} /> SEC EDGAR Filing
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quantified Liability Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Stop-Loss Gap Exposure", value: liabilities.stop_loss_gap, color: RED, flag: flags.no_stop_loss },
            { label: "Rx Overcharge Estimate", value: liabilities.rx_overcharge, color: AMBER, flag: true },
            { label: "Fiduciary Liability Risk", value: liabilities.fiduciary_exposure, color: PURPLE, flag: true },
            { label: "Total Quantified Exposure", value: liabilities.total_quantified, color: CRIMSON, flag: liabilities.total_quantified > 500000 },
          ].map(({ label, value, color, flag }) => (
            <div key={label} style={{ background: `${color}08`, border: `1px solid ${color}25`,
              borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -8, right: -8, width: 40, height: 40,
                borderRadius: "50%", background: `radial-gradient(circle, ${color}18, transparent)` }} />
              <div style={{ fontSize: 11, color: T3, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{fmt(value) || "$0"}</div>
              {flag && value > 0 && (
                <div style={{ fontSize: 8, color, marginTop: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  ⚑ FLAG
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Score summary bar */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: T3, letterSpacing: "0.12em",
            textTransform: "uppercase", marginBottom: 14 }}>6-Gate Score Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              { label: "Stop-Loss", score: scores.stop_loss },
              { label: "Rx / PBM", score: scores.rx_pbm },
              { label: "Fiduciary", score: scores.fiduciary },
              { label: "Claims & Financial", score: scores.claims_financial },
              { label: "Integration Risk", score: scores.integration_risk },
              { label: "Regulatory", score: scores.regulatory },
            ].map(({ label, score }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: T2 }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: scoreColor(score) }}>{score}</span>
                </div>
                <ProgressBar value={score} color={scoreColor(score)} />
              </div>
            ))}
          </div>
        </div>

        {/* Document Upload */}
        <DocumentVault ein={data.ein} />

        {/* 8 Audit Gates */}
        <div style={{ fontSize: 12, fontWeight: 900, color: T3, letterSpacing: "0.14em",
          textTransform: "uppercase", marginBottom: 12 }}>
          Benefit Plan Audit Gates
        </div>

        <GateCard num={1} icon={Shield} label="Stop-Loss Exposure Assessment"
          color={scoreColor(scores.stop_loss)} score={scores.stop_loss}
          liability={liabilities.stop_loss_gap} defaultOpen
          findings={[
            flags.no_stop_loss
              ? `No stop-loss coverage detected — ${fmtN(data.total_participants)} participants are self-insured with no catastrophic protection. Estimated exposure: ${fmt(liabilities.stop_loss_gap)}.`
              : "Stop-loss coverage confirmed via Form 5500 welfare benefit codes.",
            flags.high_mlr
              ? `Medical Loss Ratio is elevated at ${data.mlr_est}% — benchmark is 82-88% for self-funded plans. High-cost claimant risk is above average.`
              : `MLR of ${data.mlr_est}% is within acceptable range for self-funded employer of this size.`,
            data.total_participants > 1000
              ? "Employer size exceeds 1,000 lives — aggregate stop-loss corridor analysis required. Request last 3 years of stop-loss claims data."
              : "Plan size is below 1,000 lives — specific deductible adequacy is the primary stop-loss risk at this scale.",
            "Laser risk: Verify if any high-cost claimants have been lasered out of stop-loss coverage at renewal.",
          ]} />

        <GateCard num={2} icon={Pill} label="PBM & Rx Contract Intelligence"
          color={scoreColor(scores.rx_pbm)} score={scores.rx_pbm}
          liability={liabilities.rx_overcharge}
          findings={[
            "Spread pricing risk: PBM may be charging the plan more than it reimburses the pharmacy — common in non-pass-through contracts.",
            "Rebate pass-through language must be verified. Plans without 100% pass-through language lose an estimated $50-150 per member per year.",
            `Estimated Rx overcharge exposure for ${fmtN(data.total_participants)} participants: ${fmt(liabilities.rx_overcharge)} annually.`,
            "GLP-1 (Ozempic/Wegovy) formulary exposure requires specific assessment — 2024 market data shows this adds $200-800 PMPM for covered populations.",
            "CAA 2024 requires PBM transparency reporting — verify gag clause attestation has been filed.",
          ]} />

        <GateCard num={3} icon={Scale} label="Fiduciary & CAA Compliance"
          color={scoreColor(scores.fiduciary)} score={scores.fiduciary}
          liability={liabilities.fiduciary_exposure}
          findings={[
            `ERISA §404(a) requires prudent process documentation for all benefit plan decisions. Estimated fiduciary exposure: ${fmt(liabilities.fiduciary_exposure)}.`,
            "Gag Clause Attestation (CAA 2022): Verify annual attestation has been submitted to CMS. Non-compliance triggers DOL investigation.",
            "Plan committee meeting minutes required — document fiduciary decision process, especially for PBM and TPA selection.",
            "Fee reasonableness benchmarking: Admin fees must be documented as reasonable vs. industry peers. Excess fees create ERISA class action liability.",
            "Mental Health Parity (MHPAEA) compliance: Verify comparative analysis has been completed — DOL enforcement is actively increasing.",
          ]} />

        <GateCard num={4} icon={BarChart3} label="Claims & Financial Performance"
          color={scoreColor(scores.claims_financial)} score={scores.claims_financial}
          findings={[
            `Annual benefits cost: ${fmt(data.total_expense)} — PMPM of $${data.pmpm || "—"} vs. industry median of ~$750.`,
            data.mlr_est > 85
              ? `Elevated MLR of ${data.mlr_est}% indicates plan is paying out more than it collects in contributions. Trend correction needed.`
              : `MLR of ${data.mlr_est}% is manageable. Benchmark self-funded plans run 82-88%.`,
            "Year-over-year cost trend: Request 3-year claims data to validate trend rate. National average is 6-8% annual increase.",
            "PMPM benchmarking: Compare against DOL Form 5500 peer universe for same SIC code, size band, and geography.",
            ...(flags.multi_plan ? ["Multiple active plans detected — consolidation complexity adds integration cost and employee disruption risk."] : []),
          ]}>
          {year_history.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) 1fr 1fr 1fr", gap: 4,
                padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, marginBottom: 4 }}>
                {["Year", "Participants", "Income", "Expense"].map(h => (
                  <span key={h} style={{ fontSize: 8, fontWeight: 900, color: T3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</span>
                ))}
              </div>
              {year_history.slice(0, 4).map(r => (
                <div key={r.year} style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4,
                  padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.015)", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: T1, fontWeight: 700 }}>{r.year}</span>
                  <span style={{ fontSize: 11, color: T2 }}>{r.participants.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: GREEN }}>{fmt(r.income)}</span>
                  <span style={{ fontSize: 11, color: r.expense > r.income ? RED : T2 }}>{fmt(r.expense)}</span>
                </div>
              ))}
            </div>
          )}
        </GateCard>

        <GateCard num={5} icon={Building2} label="TPA & Carrier Assessment"
          color={72} score={72}
          findings={[
            "TPA contract terms: Verify performance guarantees, SLA minimums, and termination rights. Change-of-control clauses may trigger automatic termination.",
            "Network adequacy: Validate that carrier networks meet post-acquisition geography. M&A-driven workforce moves often create access gaps.",
            "Claims administration quality: Request paid claims accuracy report. Industry standard is 98%+ claims accuracy.",
            "Carrier financial strength: Confirm stop-loss carrier A.M. Best rating is A- or better.",
            "Upload TPA Agreement above to score contract terms quality.",
          ]} />

        <GateCard num={6} icon={Zap} label="M&A Integration Risk"
          color={scoreColor(scores.integration_risk)} score={scores.integration_risk}
          findings={[
            flags.multi_plan
              ? `${data.plan_count} active plans will require consolidation — each plan has its own TPA, PBM, and carrier contracts. Integration timeline: 12-18 months minimum.`
              : "Single active plan simplifies integration — transition requires carrier and TPA notification only.",
            "COBRA liability: All qualifying events triggered by the transaction (layoffs, workforce restructuring) create COBRA exposure. Cap may apply under transaction agreements.",
            "Change-of-control provisions: PBM and TPA contracts frequently contain change-of-control clauses allowing termination or renegotiation.",
            "Benefits harmonization: If acquirer has different plan design, harmonization creates employee relations risk. Richer plan must continue through next open enrollment.",
            "Post-close timeline: Benefits integration planning should begin Day 1 — delay increases compliance exposure and employee disruption.",
          ]} />

        <GateCard num={7} icon={Activity} label="Regulatory & Litigation Exposure"
          color={scoreColor(scores.regulatory)} score={scores.regulatory}
          findings={[
            `Form 5500 filing history: ${data.plan_count} plan filing(s) on record. Late or missing filings indicate governance issues and DOL audit risk.`,
            "ERISA class action risk: Plans with excessive fees, limited investment options, or opaque PBM contracts are primary targets for class action plaintiffs.",
            "ACA compliance: Verify employer mandate compliance, 1094/1095-C reporting, and affordability safe harbor elections.",
            "State mandates: Verify compliance with state-specific benefits mandates in all operating jurisdictions.",
            "DOL investigation history: Request disclosure of any prior DOL investigations, audits, or voluntary correction program filings.",
          ]}>
          <FederalRiskGate companyName={data.company_name} ein={data.ein}/>
        </GateCard>

        <GateCard num={8} icon={Target} label="Deal Structure Recommendations"
          color={recColor === GREEN ? 80 : recColor === AMBER ? 60 : 38}
          score={recColor === GREEN ? 80 : recColor === AMBER ? 60 : 38}
          findings={[
            `Overall plan health score: ${scores.overall}/100 — ${riskLabel(scores.overall)}.`,
            `Quantified benefit plan liability: ${fmt(liabilities.total_quantified)} — recommend ${fmt(liabilities.total_quantified)} escrow holdback or reps & warranties coverage.`,
            flags.no_stop_loss
              ? "CRITICAL: Stop-loss coverage must be secured as a closing condition. Acquirer assumes catastrophic self-insurance risk immediately at closing without it."
              : "Stop-loss coverage is in place — confirm transfer or replacement coverage is bound before closing.",
            "Recommend independent PBM audit as closing condition — recoverable overcharges are frequently material to deal economics.",
            "Request 90-day benefits transition plan from target management team prior to LOI execution.",
          ]}>
          <div style={{ marginTop: 12, padding: "14px 16px",
            background: `${recColor}10`, border: `1px solid ${recColor}30`, borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: recColor, letterSpacing: "0.12em",
              textTransform: "uppercase", marginBottom: 4 }}>Diligence Recommendation</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: T1 }}>{data.recommendation}</div>
            <div style={{ fontSize: 11, color: T2, marginTop: 4 }}>
              {data.recommendation === "PROCEED"
                ? "Plan structure is consistent with customary benefits due diligence findings for a transaction of this nature. Acquirer should incorporate into the definitive agreement standard ERISA representations and warranties, including without limitation: (i) no material undisclosed benefit plan liabilities; (ii) ERISA compliance in all material respects, including timely Form 5500 filings and §408(b)(2) fee disclosure; (iii) no pending or threatened DOL, IRS, or PBGC investigations, audits, or voluntary correction program filings; and (iv) no excess compensation or prohibited transactions under ERISA §§406–408. Recommend independent PBM contract review as a closing condition."
                : data.recommendation.includes("CONDITIONS")
                ? "The identified conditions precedent constitute negotiated protective mechanisms customary in ERISA-sensitive transactions. Closing should be contingent upon: (i) written confirmation that stop-loss coverage will be bound no later than the closing date, with evidence of A.M. Best A- or better carrier rating; (ii) grant of a contractual PBM audit right, exercisable within twenty-four (24) months post-closing, with recovery flowing to the plan; (iii) establishment of a funded escrow holdback in the amount of quantified benefit plan liability; and (iv) seller's delivery of complete §408(b)(2) fee disclosures for all covered service providers. ERISA-specific representations and warranties should include a defined survival period of not less than three (3) years from closing, with an indemnification cap equal to the quantified liability identified herein."
                : "Material, quantified benefit plan liabilities have been identified that present unacceptable transaction risk without structural remediation. Acquirer should not proceed to LOI execution or definitive agreement without independent ERISA counsel review of each identified exposure. Recommended protective mechanisms include: (i) purchase price adjustment in the full amount of quantified benefit plan liability; (ii) a fully funded escrow holdback with release triggers tied to resolution of identified exposures; (iii) seller indemnification with a survival period of not less than three (3) years and an indemnification cap no less than the gross quantified exposure; or (iv) representations and warranties insurance coverage with a specific ERISA and benefits liability endorsement. Acquirer assumes full successor liability for all pre-closing ERISA violations effective at closing absent explicit contractual remediation."}
            </div>
          </div>
        </GateCard>

        <div style={{ fontSize: 9, color: T3, textAlign: "center", padding: "16px 0",
          borderTop: `1px solid ${BORDER}`, marginTop: 8 }}>
          CONFIDENTIAL — PREPARED FOR AUTHORIZED TRANSACTION COUNSEL AND PRINCIPAL USE ONLY. This Benefits Due Diligence Report is prepared by Kincaid IQ™ and Kincaid RMC exclusively for the named acquirer, its authorized transaction counsel, financial advisors, and other advisors engaged in the identified transaction. This report does not constitute legal advice, tax advice, or actuarial opinion, and does not create an attorney-client relationship. Benefit plan liability estimates are derived from publicly available DOL Form 5500 data, SEC EDGAR filings, and industry actuarial benchmarks; they do not reflect actual plan experience and should not be substituted for independent actuarial analysis, legal due diligence, or plan document review. Kincaid IQ makes no representation or warranty, express or implied, regarding the accuracy, completeness, or fitness for a particular purpose of any estimate or finding herein. Acquirer's ERISA counsel should independently verify all material findings and negotiate appropriate representations, warranties, indemnification obligations, survival periods, and escrow or holdback provisions in the definitive purchase agreement. No portion of this report may be disclosed to the target company, its representatives, or any third party without the prior written consent of Kincaid IQ. Kincaid IQ's aggregate liability arising out of or related to this report shall not exceed the fees paid for this engagement. © Kincaid IQ · Kincaid RMC · M&A Benefits Due Diligence™ · Powered by DOL Form 5500 + SEC EDGAR ·
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>
    </div>
  );
}

export default function MADiligence() {
  const [result, setResult] = useState<DiligenceData | null>(null);

  return (
    <Layout>
      <div style={{ background: "#000", minHeight: "100vh", color: T1 }}>
        {/* Sticky header */}
        <div style={{ position: "sticky", top: 0, zIndex: 100,
          background: "rgba(0,0,0,0.94)", backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${CRIMSON}30`, padding: "0 32px",
          display: "flex", alignItems: "center", gap: 12, height: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7,
            background: `${CRIMSON}18`, border: `1px solid ${CRIMSON}40`,
            borderRadius: 7, padding: "3px 12px 3px 10px" }}>
            <ShieldAlert style={{ width: 12, height: 12, color: CRIMSON }} />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em",
              textTransform: "uppercase", color: CRIMSON }}>
              M&A Benefits Due Diligence™
            </span>
          </div>
          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${CRIMSON}25, transparent)` }} />
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.18)" }}>
            Kincaid RMC · Fiduciary Grade · Pre-Acquisition Intelligence
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px",
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 6 }}>
            <Shield style={{ width: 9, height: 9, color: RED }} />
            <span style={{ fontSize: 8, fontWeight: 800, color: RED, letterSpacing: "0.1em" }}>
              CONFIDENTIAL
            </span>
          </div>
        </div>

        <div style={{ padding: "0 32px 48px", maxWidth: 1100, margin: "0 auto" }}>
          {result
            ? <DiligenceReport data={result} onReset={() => setResult(null)} />
            : <EINSearch onResult={setResult} />}
        </div>
      </div>
    </Layout>
  );
}
