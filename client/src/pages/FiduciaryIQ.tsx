import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import EmailReportModal from "@/components/EmailReportModal";
import { downloadPDF } from "@/lib/pdfReports";
import { Badge } from "@/components/ui/badge";
import FiduciaryIQFullReport from "@/pages/FiduciaryIQFullReport";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, AlertTriangle, CheckCircle, XCircle, FileText,
  DollarSign, Users, ClipboardList, Target,
  Gavel, Activity, Search, Mail, FileSearch,
  Upload, Loader2, Sparkles, Trash2, X,
} from "lucide-react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip, ResponsiveContainer } from "recharts";

const ACCENT        = "#6366F1";
const ACCENT_BG     = "rgba(99,102,241,0.08)";
const ACCENT_BORDER = "rgba(99,102,241,0.25)";
const NEON = { green: "#00FF94", gold: "#FFB800", red: "#FF4D6D", purple: "#A855F7", blue: "#00D4FF", orange: "#FF6B1A", indigo: "#6366F1" };

function scoreColor(s: number) { return s >= 75 ? NEON.green : s >= 55 ? NEON.gold : NEON.red; }

/* ─── GAUGE ──────────────────────────────────────────────────────────────── */
function Gauge({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38; const circ = 2 * Math.PI * r; const c = scoreColor(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff0a" strokeWidth={size*0.075} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={size*0.075}
          strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-[var(--kiq-ink)]" style={{ fontSize: size*0.22 }}>{score}</span>
        <span className="text-[var(--kiq-ink)]/30" style={{ fontSize: size*0.1 }}>/ 100</span>
      </div>
    </div>
  );
}

/* ─── SCORE BADGE (header) ───────────────────────────────────────────────── */
function ScorePill({ score, riskLevel }: { score: number; riskLevel: string }) {
  const c = scoreColor(score);
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl"
      style={{ background: `${c}10`, border: `1px solid ${c}30` }}>
      <span className="text-2xl font-black" style={{ color: c }}>{score}</span>
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--kiq-ink)]/30">Fiduciary Risk</div>
        <div className="text-xs font-black" style={{ color: c }}>{riskLevel}</div>
      </div>
    </div>
  );
}

/* ─── STATUS / SEVERITY HELPERS ──────────────────────────────────────────── */
function StatusIcon({ s }: { s: string }) {
  if (s === "PASS" || s === "COMPLETE") return <CheckCircle size={14} className="text-green-400 flex-shrink-0" />;
  if (s === "FAIL" || s === "MISSING")  return <XCircle    size={14} className="text-red-400 flex-shrink-0" />;
  return <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />;
}

function SeverityBadge({ sev }: { sev: string }) {
  const map: Record<string, string> = {
    Critical: "bg-red-500/10 text-red-400 border-red-500/25",
    High:     "bg-amber-500/10 text-amber-400 border-amber-500/25",
    Medium:   "bg-blue-500/10 text-blue-400 border-blue-500/25",
    Low:      "bg-[var(--kiq-surface)]/5 text-[var(--kiq-ink)]/40 border-white/10",
  };
  return <Badge className={`text-xs border ${map[sev] ?? map.Low}`}>{sev}</Badge>;
}

/* ─── CARD / SECTION TITLE ───────────────────────────────────────────────── */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`kiq-health-card rounded-2xl p-5 ${className}`}>{children}</div>;
}

function SectionTitle({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--kiq-hairline)]/70">
      <Icon size={14} style={{ color }} /><h3 className="text-[var(--kiq-ink)] font-semibold text-sm">{label}</h3>
    </div>
  );
}

/* ─── OVERVIEW TAB ───────────────────────────────────────────────────────── */
function OverviewTab({ d }: { d: any }) {
  const s = d.summary;
  const radarData = d.duty_scores.map((dt: any) => ({ duty: dt.duty.split(" ")[0], score: dt.score, benchmark: 65 }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4 flex flex-col items-center gap-2">
          <p className="text-[var(--kiq-ink)]/40 text-xs">Fiduciary Risk Score</p>
          <Gauge score={d.fiduciary_risk_score} size={76} />
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ color: NEON.gold, background: "rgba(255,184,0,0.12)" }}>{d.risk_level}</span>
        </div>
        {[
          { label: "Critical Gaps",         val: s.critical_gaps,          color: NEON.red,    icon: XCircle },
          { label: "Undisclosed Fees",       val: `$${(s.total_undisclosed_fees/1000).toFixed(0)}K`, color: NEON.orange, icon: DollarSign },
          { label: "DOL Audit Readiness",    val: `${s.audit_readiness_score}/100`,  color: scoreColor(s.audit_readiness_score), icon: Shield },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4">
            <k.icon size={13} style={{ color: k.color }} className="mb-2" />
            <p className="text-[var(--kiq-ink)]/40 text-xs mb-1">{k.label}</p>
            <p className="text-xl font-bold" style={{ color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={Shield} label="Fiduciary Duty Radar" color={NEON.indigo} />
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#ffffff10" />
              <PolarAngleAxis dataKey="duty" tick={{ fill: "#ffffff45", fontSize: 10 }} />
              <Radar name="Your Score" dataKey="score" stroke={NEON.indigo} fill={NEON.indigo} fillOpacity={0.18} strokeWidth={2} />
              <Radar name="Benchmark"  dataKey="benchmark" stroke={NEON.gold} fill={NEON.gold} fillOpacity={0.06} strokeWidth={1.5} strokeDasharray="4 2" />
              <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs justify-center mt-1">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.indigo }} /><span className="text-[var(--kiq-ink)]/40">Your Plan</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.gold }} /><span className="text-[var(--kiq-ink)]/40">Benchmark</span></div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Target} label="Immediate Action Items" color={NEON.red} />
          <div className="space-y-2">
            {d.action_plan.slice(0, 5).map((a: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${a.priority === "Critical" ? "border-red-500/25 bg-red-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.03]"}`}
                data-testid={`action-${i}`}>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${a.priority === "Critical" ? "text-red-400 bg-red-500/15" : "text-amber-400 bg-amber-500/15"}`}>{a.priority}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--kiq-ink)]/80 font-medium truncate">{a.title}</p>
                  <p className="text-xs text-[var(--kiq-ink)]/35 mt-0.5">{a.timeline} · {a.owner}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {[
          { label: "Fiduciary Meetings (2024)", val: `${d.summary.meetings_documented} / ${d.summary.meetings_required}`, color: d.summary.meetings_documented < d.summary.meetings_required ? NEON.red : NEON.green, sub: "Required quarterly" },
          { label: "Disclosures Received",      val: `${7 - d.summary.disclosures_missing} / 7`,  color: d.summary.disclosures_missing > 0 ? NEON.gold : NEON.green, sub: `${d.summary.disclosures_missing} still missing` },
          { label: "High + Critical Gaps",      val: `${d.summary.critical_gaps + d.summary.high_gaps}`, color: NEON.red, sub: "Require remediation" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4">
            <p className="text-[var(--kiq-ink)]/40 text-xs mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</p>
            <p className="text-xs text-[var(--kiq-ink)]/30 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 408(b)(2) TRACKER ──────────────────────────────────────────────────── */
function Disclosure408Tab({ d }: { d: any }) {
  const totalComp = d.disclosures_408b2.reduce((s: number, v: any) => s + v.annual_compensation, 0);
  const missing   = d.disclosures_408b2.filter((v: any) => !v.disclosure_received);
  const incomplete= d.disclosures_408b2.filter((v: any) => v.disclosure_received && !v.disclosure_complete);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Vendor Compensation", val: `$${(totalComp/1000).toFixed(0)}K`, color: NEON.blue },
          { label: "Disclosures Received",      val: `${d.disclosures_408b2.filter((v: any) => v.disclosure_received).length} / ${d.disclosures_408b2.length}`, color: NEON.green },
          { label: "Missing Disclosures",       val: String(missing.length),  color: missing.length > 0 ? NEON.red : NEON.green },
          { label: "Incomplete Disclosures",    val: String(incomplete.length), color: incomplete.length > 0 ? NEON.gold : NEON.green },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4">
            <p className="text-[var(--kiq-ink)]/40 text-xs mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/[0.05] flex items-start gap-3">
          <AlertTriangle size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[var(--kiq-ink)]/85 text-sm font-semibold">Prohibited Transaction Risk — Immediate Action Required</p>
            <p className="text-[var(--kiq-ink)]/45 text-xs mt-0.5">Under ERISA 408(b)(2), failure to obtain required fee disclosures from covered service providers is a prohibited transaction. Personal liability attaches to plan fiduciaries. Issue written demand letters to {missing.map((v: any) => v.vendor).join(", ")} immediately.</p>
          </div>
        </div>
      )}

      <Card>
        <SectionTitle icon={DollarSign} label="Service Provider Fee Disclosure Registry" color={NEON.indigo} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Vendor", "Type", "Annual Compensation", "Fee Basis", "Disclosure", "Received", "Complete", "Notes"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[var(--kiq-ink)]/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.disclosures_408b2.map((v: any, i: number) => (
                <tr key={i}
                  className={`border-b border-white/[0.03] hover:bg-[var(--kiq-surface)]/[0.02] transition-colors ${!v.disclosure_received ? "bg-red-500/[0.03]" : !v.disclosure_complete ? "bg-amber-500/[0.02]" : ""}`}
                  data-testid={`vendor-row-${i}`}>
                  <td className="py-3 px-3 text-[var(--kiq-ink)] font-medium">{v.vendor}</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/50 text-xs">{v.type}</td>
                  <td className="py-3 px-3 font-bold" style={{ color: NEON.blue }}>${v.annual_compensation.toLocaleString()}</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/45 text-xs">{v.fee_basis}</td>
                  <td className="py-3 px-3 text-xs text-[var(--kiq-ink)]/50">{v.disclosure_date ?? <span className="text-red-400 font-bold">NOT RECEIVED</span>}</td>
                  <td className="py-3 px-3">{v.disclosure_received ? <CheckCircle size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}</td>
                  <td className="py-3 px-3">{v.disclosure_complete ? <CheckCircle size={14} className="text-green-400" /> : v.disclosure_received ? <AlertTriangle size={14} className="text-amber-400" /> : <XCircle size={14} className="text-red-400" />}</td>
                  <td className="py-3 px-3 text-xs text-[var(--kiq-ink)]/35 max-w-xs">{v.notes ?? <span className="text-green-400/60">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ─── FIDUCIARY RISK TAB ─────────────────────────────────────────────────── */
function RiskTab({ d }: { d: any }) {
  return (
    <div className="space-y-4">
      <p className="text-[var(--kiq-ink)]/40 text-xs">ERISA §404 establishes four core fiduciary duties. Each is scored based on documented evidence of compliance. Gaps create personal liability for named plan fiduciaries.</p>
      {d.duty_scores.map((duty: any) => {
        const col = scoreColor(duty.score);
        return (
          <Card key={duty.duty}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[var(--kiq-ink)] font-semibold text-sm">{duty.duty}</span>
                  <span className="text-xs text-[var(--kiq-ink)]/30">Weight: {duty.weight}%</span>
                </div>
                <p className="text-[var(--kiq-ink)]/40 text-xs">{duty.description}</p>
              </div>
              <div className="text-right ml-4 flex-shrink-0">
                <span className="text-2xl font-bold" style={{ color: col }}>{duty.score}</span>
                <span className="text-[var(--kiq-ink)]/30 text-xs">/100</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--kiq-surface)]/[0.06] mb-3">
              <div className="h-full rounded-full" style={{ width: `${duty.score}%`, background: col }} />
            </div>
            {duty.gaps.length > 0 && (
              <div className="space-y-1.5">
                {duty.gaps.map((g: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-[var(--kiq-ink)]/55" data-testid={`gap-${i}`}>
                    <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    {g}
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ─── ERISA CHECKLIST TAB ────────────────────────────────────────────────── */
function ChecklistTab({ d }: { d: any }) {
  const allItems = d.erisa_checklist.flatMap((c: any) => c.items);
  const passes = allItems.filter((i: any) => i.status === "PASS").length;
  const fails  = allItems.filter((i: any) => i.status === "FAIL").length;
  const warns  = allItems.filter((i: any) => i.status === "WARN").length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-green-500/[0.06] border border-green-500/20 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{passes}</p>
          <p className="text-xs text-[var(--kiq-ink)]/40 mt-1">Compliant</p>
        </div>
        <div className="rounded-xl bg-red-500/[0.06] border border-red-500/20 p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{fails}</p>
          <p className="text-xs text-[var(--kiq-ink)]/40 mt-1">Non-Compliant</p>
        </div>
        <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{warns}</p>
          <p className="text-xs text-[var(--kiq-ink)]/40 mt-1">Needs Attention</p>
        </div>
      </div>
      {d.erisa_checklist.map((cat: any) => (
        <Card key={cat.category}>
          <SectionTitle icon={ClipboardList} label={cat.category} color={NEON.indigo} />
          <div className="space-y-2">
            {cat.items.map((item: any, i: number) => (
              <div key={i}
                className={`flex items-start justify-between p-3 rounded-lg border transition-colors ${item.status === "FAIL" ? "border-red-500/20 bg-red-500/[0.04]" : item.status === "WARN" ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-white/[0.05] bg-[var(--kiq-surface)]/[0.01]"}`}
                data-testid={`checklist-${i}`}>
                <div className="flex items-start gap-3 flex-1">
                  <StatusIcon s={item.status} />
                  <div>
                    <p className="text-sm text-[var(--kiq-ink)]/80">{item.task}</p>
                    <p className="text-xs text-[var(--kiq-ink)]/30 mt-0.5">{item.statute}{item.due ? ` · Due: ${item.due}` : ""}</p>
                  </div>
                </div>
                {item.severity && <SeverityBadge sev={item.severity} />}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ─── DOL AUDIT PREP TAB ─────────────────────────────────────────────────── */
function AuditTab({ d }: { d: any }) {
  const docs = d.dol_audit_readiness.documents;
  const complete = docs.filter((d: any) => d.status === "COMPLETE").length;
  const missing  = docs.filter((d: any) => d.status === "MISSING").length;
  const partial  = docs.filter((d: any) => d.status === "PARTIAL").length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4 flex flex-col items-center gap-2">
          <p className="text-[var(--kiq-ink)]/40 text-xs">Audit Readiness</p>
          <Gauge score={d.dol_audit_readiness.score} size={72} />
          <span className="text-xs text-[var(--kiq-ink)]/30">Grade: {d.dol_audit_readiness.grade}</span>
        </div>
        <div className="rounded-xl bg-green-500/[0.06] border border-green-500/20 p-4 text-center"><p className="text-2xl font-bold text-green-400">{complete}</p><p className="text-xs text-white/40 mt-1">Documents Complete</p></div>
        <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-4 text-center"><p className="text-2xl font-bold text-amber-400">{partial}</p><p className="text-xs text-white/40 mt-1">Partial / Outdated</p></div>
        <div className="rounded-xl bg-red-500/[0.06] border border-red-500/20 p-4 text-center"><p className="text-2xl font-bold text-red-400">{missing}</p><p className="text-xs text-white/40 mt-1">Missing</p></div>
      </div>

      <div className="p-4 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.05] flex items-start gap-3">
        <Gavel size={15} className="text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-[var(--kiq-ink)]/65 text-xs leading-relaxed">DOL enforcement activity under ERISA is accelerating. Plans with inadequate documentation face civil penalties of $100–$110/day per violation under ERISA §502(c). Preparing these documents before an audit saves an estimated $40,000–$200,000 in response costs and penalties.</p>
      </div>

      <Card>
        <SectionTitle icon={FileText} label="DOL Audit Document Checklist" color={NEON.indigo} />
        <div className="space-y-2">
          {docs.map((doc: any, i: number) => (
            <div key={i}
              className={`flex items-center justify-between p-3 rounded-lg border ${doc.status === "COMPLETE" ? "border-white/[0.05]" : doc.status === "MISSING" ? "border-red-500/20 bg-red-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.03]"}`}
              data-testid={`audit-doc-${i}`}>
              <div className="flex items-center gap-3 flex-1">
                <StatusIcon s={doc.status} />
                <div>
                  <p className="text-sm text-[var(--kiq-ink)]/80">{doc.doc}</p>
                  {doc.notes && <p className="text-xs text-[var(--kiq-ink)]/35 mt-0.5">{doc.notes}</p>}
                </div>
              </div>
              <Badge className={`text-xs border ml-3 flex-shrink-0 ${doc.status === "COMPLETE" ? "bg-green-500/10 text-green-400 border-green-500/25" : doc.status === "MISSING" ? "bg-red-500/10 text-red-400 border-red-500/25" : "bg-amber-500/10 text-amber-400 border-amber-500/25"}`}>
                {doc.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── TABS ───────────────────────────────────────────────────────────────── */
type Tab = "overview" | "408b2" | "risk" | "checklist" | "audit";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview",  label: "Overview",          icon: Activity },
  { id: "408b2",     label: "408(b)(2) Tracker", icon: DollarSign },
  { id: "risk",      label: "Fiduciary Risk",     icon: Shield },
  { id: "checklist", label: "ERISA Checklist",    icon: ClipboardList },
  { id: "audit",     label: "DOL Audit Prep",     icon: Search },
];

/* ─── UPLOAD ZONE ────────────────────────────────────────────────────────── */
function FiqUploadZone({ onUploaded }: { onUploaded: (id: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [planName, setPlanName] = useState("");
  const [orgName, setOrgName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const uploadMut = useMutation({
    mutationFn: async ({ file, name, org }: { file: File; name: string; org: string }) => {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const res = await apiRequest("POST", "/api/fiduciary-iq/upload", {
        filename: file.name,
        content_type: file.type || "application/pdf",
        data_b64: b64,
        plan_name: name || file.name.replace(/\.[^.]+$/, ""),
        org_name: org || null,
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/fiduciary-iq/plans"] });
      onUploaded(data.id);
      toast({ title: "Plan uploaded", description: "Loading fiduciary analysis…" });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const demoMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fiduciary-iq/demo", {
        plan_name: planName || "Employer Health Plan",
        org_name: orgName || null,
        participants: 500,
        plan_year: 2024,
      });
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/fiduciary-iq/plans"] });
      onUploaded(data.id);
      toast({ title: "Demo loaded", description: "Sample ERISA fiduciary analysis ready." });
    },
    onError: () => toast({ title: "Failed to load demo", variant: "destructive" }),
  });

  const handleFile = useCallback((file: File) => {
    uploadMut.mutate({ file, name: planName, org: orgName });
  }, [planName, orgName, uploadMut]);

  const isPending = uploadMut.isPending || demoMut.isPending;

  return (
    <div className="space-y-2.5">
      <div
        data-testid="fiq-upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !isPending && fileRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all"
        style={{ borderColor: dragging ? ACCENT : "#e2e8f0", background: dragging ? ACCENT_BG : "#ffffff" }}
      >
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {isPending ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
            <p className="text-xs text-zinc-400">Loading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-5 h-5" style={{ color: ACCENT }} />
            <p className="text-xs text-[var(--kiq-ink)] font-medium">Drop plan documents here</p>
            <p className="text-[10px] text-zinc-600">SPD · Form 5500 · 408(b)(2) · PDF · DOCX</p>
          </div>
        )}
      </div>

      <input
        data-testid="fiq-input-planname"
        className="w-full bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-lg px-3 py-1.5 text-xs text-[var(--kiq-ink)] placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        placeholder="Plan name (optional)"
        value={planName}
        onChange={(e) => setPlanName(e.target.value)}
      />
      <input
        data-testid="fiq-input-orgname"
        className="w-full bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-lg px-3 py-1.5 text-xs text-[var(--kiq-ink)] placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        placeholder="Organization name (optional)"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
      />

      <button data-testid="fiq-button-demo" onClick={() => demoMut.mutate()} disabled={isPending}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
        style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", color: NEON.gold }}>
        <Sparkles className="w-3 h-3" /> Run Demo Analysis
      </button>
    </div>
  );
}

/* ─── PLAN LIST ──────────────────────────────────────────────────────────── */
function FiqPlanList({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: plans = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/fiduciary-iq/plans"] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/fiduciary-iq/plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/fiduciary-iq/plans"] }); toast({ title: "Deleted" }); },
  });

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-700" /></div>;
  if (!plans.length) return <p className="text-zinc-600 text-xs text-center py-4">No analyses yet.</p>;

  return (
    <div className="space-y-1.5">
      {plans.map((p) => {
        const isSelected = p.id === selected;
        return (
          <div key={p.id} data-testid={`fiq-plan-item-${p.id}`}
            onClick={() => onSelect(p.id)}
            className="group flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all"
            style={{
              background: isSelected ? ACCENT_BG : "transparent",
              border: `1px solid ${isSelected ? ACCENT_BORDER : "#f8fafc"}`,
            }}>
            <Shield className="w-3.5 h-3.5 flex-shrink-0 text-zinc-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--kiq-ink)] truncate font-medium">{p.plan_name}</p>
              {p.org_name && <p className="text-[10px] text-zinc-600 truncate">{p.org_name}</p>}
            </div>
            <button data-testid={`fiq-delete-${p.id}`}
              onClick={(e) => { e.stopPropagation(); deleteMut.mutate(p.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-zinc-700 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── LANDING STATE ──────────────────────────────────────────────────────── */
function FiqLanding() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-12 py-16">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto"
          style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, boxShadow: `0 0 40px rgba(99,102,241,0.12)` }}>
          <Shield className="w-10 h-10" style={{ color: ACCENT }} />
        </div>
      </div>
      <h2 className="text-3xl font-black text-[var(--kiq-ink)] mb-3">Fiduciary IQ™</h2>
      <p className="text-zinc-400 max-w-md mb-1 text-sm leading-relaxed">
        Upload your plan documents or run the demo. We evaluate <span className="font-black text-[var(--kiq-ink)]">5 core ERISA duties</span>, score 408(b)(2) disclosures, and generate a DOL audit readiness report.
      </p>
      <p className="text-zinc-700 text-xs mb-10 uppercase tracking-widest">ERISA § 404 · CAA 2026 · DOL EBSA</p>

      <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { range: "75–100", label: "Compliant",  color: NEON.green,  bg: "rgba(0,255,148,0.07)",  border: "rgba(0,255,148,0.25)" },
          { range: "55–74",  label: "Elevated",   color: NEON.gold,   bg: "rgba(255,184,0,0.07)",  border: "rgba(255,184,0,0.25)" },
          { range: "0–54",   label: "At Risk",    color: NEON.red,    bg: "rgba(255,77,109,0.07)", border: "rgba(255,77,109,0.25)" },
        ].map(r => (
          <div key={r.label} className="rounded-xl p-3 text-center" style={{ background: r.bg, border: `1px solid ${r.border}` }}>
            <p className="text-xl font-black" style={{ color: r.color }}>{r.range}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: `${r.color}aa` }}>{r.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 w-full max-w-lg" style={{ borderTop: "1px solid #f8fafc" }}>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-700 mb-4">ERISA Fiduciary Duties Evaluated</p>
        <div className="space-y-2 text-left">
          {["Prudent Expert Standard · §404(a)(1)(B)", "Exclusive Benefit & Loyalty · §404(a)(1)(A)", "Plan Document Compliance · §404(a)(1)(D)", "Monitoring & Oversight · §404(a)", "Diversification / Prudence · §404(a)(1)(C)"].map(d => (
            <div key={d} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ACCENT }} />
              <span className="text-zinc-600 text-xs">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT EXPORT ────────────────────────────────────────────────────────── */
export default function FiduciaryIQ() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [emailOpen, setEmailOpen] = useState(false);
  const [fullReportOpen, setFullReportOpen] = useState(false);
  const mainPanelRef = useRef<HTMLDivElement>(null);

  const { data: plan, isLoading: planLoading } = useQuery<any>({
    queryKey: ["/api/fiduciary-iq/plans", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/fiduciary-iq/plans/${selectedId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedId,
  });

  const isComplete = !!plan && !planLoading;

  const emailSummary: Record<string, string> = plan ? {
    "Fiduciary Risk Score": `${plan.fiduciary_risk_score}/100 (${plan.risk_level})`,
    "Critical Gaps":        String(plan.summary.critical_gaps),
    "Undisclosed Fees":     `$${(plan.summary.total_undisclosed_fees / 1000).toFixed(0)}K`,
    "DOL Audit Readiness":  `${plan.summary.audit_readiness_score}/100`,
    "Disclosures Missing":  String(plan.summary.disclosures_missing),
  } : {};

  function handleUploaded(id: string) {
    setSelectedId(id);
    setTab("overview");
    if (mainPanelRef.current) mainPanelRef.current.scrollTop = 0;
  }

  return (
    <Layout fullBleed>
      <div className="kiq-health-shell flex h-full overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="w-64 flex-shrink-0 flex flex-col" style={{ background: "#F8FAFC", borderRight: "1px solid #f1f5f9" }}>

          {/* Brand header */}
          <div className="px-4 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <div className="flex items-center gap-2 mb-0.5">
              <Shield className="w-4 h-4" style={{ color: ACCENT }} />
              <span className="text-[var(--kiq-ink)] font-black text-sm">Fiduciary IQ™</span>
            </div>
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest">ERISA Plan Intelligence</p>
            {isComplete && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                <button onClick={() => setFullReportOpen(true)} data-testid="fiq-fullreport-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full justify-center"
                  style={{ background: ACCENT_BG, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}>
                  <FileSearch size={11} /> Full Report
                </button>
                <button onClick={() => downloadPDF("fiduciary-iq", plan ?? {})} data-testid="fiq-download-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full justify-center"
                  style={{ background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.18)", color: ACCENT }}>
                  <FileText size={11} /> Download PDF
                </button>
                <button onClick={() => setEmailOpen(true)} data-testid="fiq-email-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold w-full justify-center"
                  style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.22)", color: ACCENT }}>
                  <Mail size={11} /> Email Report
                </button>
              </div>
            )}
          </div>

          {/* Upload zone */}
          <div className="px-4 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <FiqUploadZone onUploaded={handleUploaded} />
          </div>

          {/* Analyzed plans list */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-700 mb-3">Analyzed Plans</p>
            <FiqPlanList selected={selectedId} onSelect={setSelectedId} />
          </div>

          {/* Footer disclaimer */}
          <div className="px-4 py-3" style={{ borderTop: "1px solid #f8fafc" }}>
            <p className="text-[9px] text-zinc-700 leading-relaxed">
              ERISA §404 fiduciary standards · CAA 2026 aligned · DOL EBSA guidance. For plan sponsor and advisor use.
            </p>
          </div>
        </div>

        {/* ── Main report panel ── */}
        <div ref={mainPanelRef} className="flex-1 overflow-y-auto" style={{ background: "#F8FAFC" }}>
          {!selectedId ? (
            <FiqLanding />
          ) : planLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
            </div>
          ) : plan ? (
            <div>
              {/* Sticky report header + tab bar */}
              <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(20px) saturate(155%)", borderBottom: "1px solid rgba(99,102,241,0.12)", boxShadow: "0 12px 34px rgba(15,23,42,0.06)" }}>
                <div className="px-8 py-3 flex items-center gap-4">
                  <Shield size={18} style={{ color: ACCENT }} />
                  <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-black text-[var(--kiq-ink)] truncate">{plan.plan_meta?.plan_name ?? "Employer Health Plan"}</h1>
                    <p className="text-[var(--kiq-ink)]/35 text-xs">
                      {plan.plan_meta?.org_name ? `${plan.plan_meta.org_name} · ` : ""}
                      408(b)(2) · Fiduciary Risk · DOL Audit
                      {plan.plan_meta?.plan_year ? ` · Plan Year ${plan.plan_meta.plan_year}` : ""}
                    </p>
                  </div>
                  <ScorePill score={plan.fiduciary_risk_score} riskLevel={plan.risk_level} />
                </div>
                <div className="px-8 flex gap-0.5 overflow-x-auto">
                  {TABS.map(({ id, label, icon: Icon }) => {
                    const active = tab === id;
                    return (
                      <button key={id} onClick={() => setTab(id)} data-testid={`fiq-tab-${id}`}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 flex-shrink-0"
                        style={{
                          color: active ? ACCENT : "#475569",
                          borderBottomColor: active ? ACCENT : "transparent",
                          background: active ? ACCENT_BG : "transparent",
                        }}>
                        <Icon size={12} />{label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab content */}
              <div className="px-8 py-6 max-w-5xl">
                {tab === "overview"  && <OverviewTab d={plan} />}
                {tab === "408b2"     && <Disclosure408Tab d={plan} />}
                {tab === "risk"      && <RiskTab d={plan} />}
                {tab === "checklist" && <ChecklistTab d={plan} />}
                {tab === "audit"     && <AuditTab d={plan} />}
              </div>
            </div>
          ) : (
            <div className="text-[var(--kiq-ink)]/30 text-center py-20">Plan not found.</div>
          )}
        </div>
      </div>

      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="fiduciary-iq"
        summaryData={emailSummary}
        reportData={plan}
      />
      {fullReportOpen && plan && (
        <FiduciaryIQFullReport data={plan} onClose={() => setFullReportOpen(false)} />
      )}
    </Layout>
  );
}
