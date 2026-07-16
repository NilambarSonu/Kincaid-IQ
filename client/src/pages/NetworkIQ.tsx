import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import EmailReportModal from "@/components/EmailReportModal";
import { downloadPDF } from "@/lib/pdfReports";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";
import NetworkIQFullReport from "@/pages/NetworkIQFullReport";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";
import { useLocation } from "wouter";
import {
  MapPin, ShieldCheck, AlertTriangle, CheckCircle, XCircle,
  TrendingDown, TrendingUp, Activity, Users, DollarSign,
  Zap, Target, ClipboardList, BarChart3, Network, ChevronRight,
  RefreshCw, FileText, Building, Stethoscope, Brain, Heart,
  FileDown, Mail, Upload, FileSearch, Hash, Eye,
} from "lucide-react";

/* ─── TYPES ────────────────────────────────────────────────────────────────── */
interface NetworkData {
  summary: {
    network_adequacy_score: number;
    in_network_rate: number;
    leakage_pct: number;
    leakage_dollars: number;
    caa_score: number;
    disruption_risk: number;
    members_affected: number;
    annual_savings_opportunity: number;
  };
  adequacy_by_specialty: any[];
  pmpm_trend: any[];
  top_leakage_providers: any[];
  caa_compliance: any;
  disruption_risks: any[];
  benchmarks: any;
  action_plan: any[];
  geographic_gaps: any[];
}

/* ─── HELPERS ───────────────────────────────────────────────────────────────── */
const NEON = { green: "#00FF94", blue: "#00D4FF", gold: "#FFB800", red: "#FF4D6D", orange: "#FF6B1A", purple: "#A855F7", cyan: "#22D3EE" };

function scoreColor(s: number) { return s >= 80 ? NEON.green : s >= 60 ? NEON.gold : NEON.red; }
function riskColor(s: number) { return s >= 70 ? NEON.red : s >= 40 ? NEON.gold : NEON.green; }

function Gauge({ score, size = 80, color }: { score: number; size?: number; color?: string }) {
  const r = size * 0.38; const circ = 2 * Math.PI * r;
  const c = color ?? scoreColor(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff0a" strokeWidth={size * 0.075} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={size * 0.075}
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-[var(--kiq-ink)]" style={{ fontSize: size * 0.22 }}>{score}</span>
        <span className="text-[var(--kiq-ink)]/30" style={{ fontSize: size * 0.1 }}>/ 100</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    adequate: "bg-green-500/10 text-green-400 border-green-500/25",
    marginal: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    deficient: "bg-red-500/10 text-red-400 border-red-500/25",
    critically_deficient: "bg-red-600/15 text-red-300 border-red-600/30",
    PASS: "bg-green-500/10 text-green-400 border-green-500/25",
    FAIL: "bg-red-500/10 text-red-400 border-red-500/25",
    WARN: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  };
  return (
    <Badge className={`text-xs border ${map[status] ?? "bg-[var(--kiq-surface)]/5 text-[var(--kiq-ink)]/40 border-white/10"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`kiq-health-card rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color?: string; icon?: any }) {
  return (
    <div className="kiq-health-card rounded-xl p-4 flex flex-col gap-1">
      {Icon && <Icon size={14} className="mb-0.5" style={{ color: color ?? "#ffffff50" }} />}
      <p className="text-[var(--kiq-ink)]/40 text-xs">{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? "#ffffff" }}>{value}</p>
      {sub && <p className="text-xs text-[var(--kiq-ink)]/30">{sub}</p>}
    </div>
  );
}

/* ─── TAB: OVERVIEW ─────────────────────────────────────────────────────────── */
function OverviewTab({ data }: { data: NetworkData }) {
  const s = data.summary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4 flex flex-col items-center gap-2" data-testid="kpi-adequacy">
          <p className="text-[var(--kiq-ink)]/40 text-xs">Network Adequacy</p>
          <Gauge score={s.network_adequacy_score} size={72} />
        </div>
        <Kpi label="In-Network Rate" value={`${s.in_network_rate}%`} sub={`${s.leakage_pct}% OON leakage`} color={NEON.green} icon={CheckCircle} />
        <Kpi label="Leakage Exposure" value={`$${(s.leakage_dollars/1000).toFixed(0)}K`} sub="Recoverable annually" color={NEON.red} icon={DollarSign} />
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4 flex flex-col items-center gap-2" data-testid="kpi-caa">
          <p className="text-[var(--kiq-ink)]/40 text-xs">CAA Compliance</p>
          <Gauge score={s.caa_score} size={72} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Disruption Risk" value={`${s.disruption_risk}%`} sub="Providers at risk of exit" color={riskColor(s.disruption_risk)} icon={AlertTriangle} />
        <Kpi label="Members Affected" value={s.members_affected.toLocaleString()} sub="by network gaps" color={NEON.blue} icon={Users} />
        <Kpi label="Savings Opportunity" value={`$${(s.annual_savings_opportunity/1000).toFixed(0)}K`} sub="With full network fix" color={NEON.gold} icon={TrendingUp} />
        <Kpi label="Action Items" value={`${data.action_plan.length}`} sub="prioritized recommendations" color={NEON.purple} icon={ClipboardList} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 flex items-center gap-2"><TrendingDown size={14} className="text-red-400" />PMPM Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.pmpm_trend}>
              <XAxis dataKey="month" tick={{ fill: "#ffffff35", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff35", fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="in_network" stroke={NEON.green} strokeWidth={2} dot={false} name="In-Network PMPM" />
              <Line type="monotone" dataKey="out_of_network" stroke={NEON.red} strokeWidth={2} dot={false} name="OON PMPM" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.green }} /><span className="text-[var(--kiq-ink)]/40">In-Network</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.red }} /><span className="text-[var(--kiq-ink)]/40">Out-of-Network</span></div>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-400" />Critical Alerts</h3>
          <div className="space-y-2">
            {[
              { sev: "critical", msg: "Mental Health: 0.39x ratio — MHPAEA parity violation risk", icon: Brain },
              { sev: "critical", msg: "Endocrinology: 0.50x ratio — 4 counties with zero access", icon: Activity },
              { sev: "warn",     msg: "OON spend trending +18% YoY — action required Q2", icon: TrendingUp },
              { sev: "warn",     msg: "3 CAA requirements due in 90 days", icon: ShieldCheck },
              { sev: "info",     msg: "Primary Care adequacy exceeds benchmark by 1.2x", icon: CheckCircle },
            ].map((a, i) => {
              const colors = { critical: "border-red-500/25 bg-red-500/5", warn: "border-amber-500/25 bg-amber-500/5", info: "border-green-500/25 bg-green-500/5" };
              const tc = { critical: "text-red-400", warn: "text-amber-400", info: "text-green-400" };
              return (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${colors[a.sev as keyof typeof colors]}`} data-testid={`alert-${i}`}>
                  <a.icon size={14} className={`mt-0.5 flex-shrink-0 ${tc[a.sev as keyof typeof tc]}`} />
                  <p className="text-sm text-[var(--kiq-ink)]/70">{a.msg}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ─── TAB: ADEQUACY ─────────────────────────────────────────────────────────── */
function AdequacyTab({ data }: { data: NetworkData }) {
  const specs = data.adequacy_by_specialty;
  return (
    <div className="space-y-6">
      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-1">Specialty Adequacy Scorecard</h3>
        <p className="text-[var(--kiq-ink)]/35 text-xs mb-5">CMS time/distance standards · provider-to-member ratio · appointment availability</p>
        <div className="space-y-3">
          {specs.map((s: any) => {
            const pct = Math.min(100, (s.ratio / 1.5) * 100);
            const col = s.ratio < 0.5 ? NEON.red : s.ratio < 0.9 ? NEON.gold : NEON.green;
            return (
              <div key={s.specialty} className="p-4 rounded-xl bg-[var(--kiq-surface)]/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors" data-testid={`adequacy-${s.specialty.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--kiq-ink)]/80 text-sm font-medium">{s.specialty}</span>
                    <StatusBadge status={s.adequacy} />
                  </div>
                  <span className="font-bold text-sm" style={{ color: col }}>{s.ratio.toFixed(2)}x ratio</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[var(--kiq-surface)]/[0.06] mb-2">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: col }} />
                </div>
                <div className="flex gap-6 text-xs text-[var(--kiq-ink)]/35">
                  <span>{s.providers_in_network} in-network / {s.providers_needed} needed</span>
                  <span>{s.drive_time_min}min avg drive</span>
                  {s.gap_counties > 0 && <span className="text-red-400">{s.gap_counties} gap county{s.gap_counties > 1 ? "ies" : ""}</span>}
                </div>
                {s.recommendation && (
                  <p className="text-xs text-[var(--kiq-ink)]/40 mt-2 border-t border-white/[0.05] pt-2 italic">
                    Rec: {s.recommendation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 flex items-center gap-2"><MapPin size={14} className="text-cyan-400" />Geographic Access Gaps</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {(data.geographic_gaps || []).map((g: any, i: number) => (
            <div key={i} className="p-3 rounded-lg border border-red-500/20 bg-red-500/[0.04]" data-testid={`geo-gap-${i}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[var(--kiq-ink)]/80 text-sm font-medium">{g.county}, {g.state}</p>
                  <p className="text-xs text-[var(--kiq-ink)]/40 mt-0.5">{g.specialty} · {g.members_affected} members</p>
                </div>
                <span className="text-xs text-red-400 font-bold">{g.drive_miles}mi nearest</span>
              </div>
              <p className="text-xs text-[var(--kiq-ink)]/30 mt-2">{g.action}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: LEAKAGE ──────────────────────────────────────────────────────────── */
function LeakageTab({ data }: { data: NetworkData }) {
  const reasonColors: Record<string, string> = {
    not_contracted: NEON.red,
    inadequate_network: NEON.orange,
    patient_preference: NEON.gold,
    emergency: NEON.blue,
    referral_gap: NEON.purple,
  };
  const byReason = Object.entries(
    data.top_leakage_providers.reduce((acc: any, p: any) => {
      acc[p.reason] = (acc[p.reason] || 0) + p.leakage; return acc;
    }, {})
  ).map(([reason, total]) => ({ reason, total }));

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-4">
        <Kpi label="Total OON Leakage" value={`$${(data.summary.leakage_dollars/1000).toFixed(0)}K`} sub="Trailing 12 months" color={NEON.red} icon={DollarSign} />
        <Kpi label="Leakage Rate" value={`${data.summary.leakage_pct}%`} sub="of total claims spend" color={NEON.orange} icon={TrendingDown} />
        <Kpi label="Recoverable" value={`$${(data.summary.annual_savings_opportunity/1000).toFixed(0)}K`} sub="with targeted network fixes" color={NEON.green} icon={Target} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Leakage by Root Cause</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byReason} layout="vertical" barSize={12}>
              <XAxis type="number" tick={{ fill: "#ffffff35", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="reason" tick={{ fill: "#ffffff50", fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v.replace(/_/g, " ")} width={110} />
              <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => [`$${(v/1000).toFixed(0)}K`, "Leakage"]} />
              <Bar dataKey="total" radius={4}>
                {byReason.map((entry, i) => (
                  <Cell key={i} fill={Object.values(reasonColors)[i % 5]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Recovery Actions</h3>
          <div className="space-y-2">
            {[
              { action: "Contract Dr. Martinez & Dr. Kim (Cardiology)", impact: "$42K", effort: "Low", urgency: "High" },
              { action: "Add behavioral health telehealth network", impact: "$38K", effort: "Low", urgency: "Critical" },
              { action: "Negotiate single-case agreements for Oncology", impact: "$35K", effort: "Med", urgency: "High" },
              { action: "Member steerage campaign for Orthopedics", impact: "$23K", effort: "Low", urgency: "Medium" },
              { action: "Add endocrinology group practice to network", impact: "$19K", effort: "High", urgency: "Medium" },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--kiq-surface)]/[0.02] border border-white/[0.06]" data-testid={`recovery-${i}`}>
                <div className="flex-1">
                  <p className="text-sm text-[var(--kiq-ink)]/80">{r.action}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-[var(--kiq-ink)]/35">Effort: {r.effort}</span>
                    <span className={`text-xs ${r.urgency === "Critical" ? "text-red-400" : r.urgency === "High" ? "text-amber-400" : "text-[var(--kiq-ink)]/40"}`}>
                      {r.urgency}
                    </span>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-sm ml-4">{r.impact}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Top Out-of-Network Providers</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Provider", "Specialty", "OON Claims", "OON Spend", "INN Equiv.", "Leakage", "Root Cause", "Fix"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[var(--kiq-ink)]/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.top_leakage_providers.map((p: any, i: number) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-[var(--kiq-surface)]/[0.02] transition-colors" data-testid={`leakage-row-${i}`}>
                  <td className="py-3 px-3 text-[var(--kiq-ink)] font-medium">{p.provider}</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/50">{p.specialty}</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/60">{p.oon_claims}</td>
                  <td className="py-3 px-3 font-medium" style={{ color: NEON.red }}>${(p.oon_spend/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/50">${(p.network_equiv_cost/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3 font-bold" style={{ color: NEON.gold }}>${(p.leakage/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3">
                    <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: reasonColors[p.reason] ?? "#ffffff50", borderColor: (reasonColors[p.reason] ?? "#ffffff50") + "40", background: (reasonColors[p.reason] ?? "#ffffff20") + "18" }}>
                      {p.reason.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-[var(--kiq-ink)]/35">{p.fix ?? "Contract"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: DISRUPTION ───────────────────────────────────────────────────────── */
function DisruptionTab({ data }: { data: NetworkData }) {
  const risks = data.disruption_risks || [];
  const riskLevelColor = (l: string) => l === "High" ? NEON.red : l === "Medium" ? NEON.gold : NEON.green;
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      {/* Generate Report CTA */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06]">
        <div className="flex items-start gap-3">
          <FileDown size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[var(--kiq-ink)]/85 text-sm font-semibold">Network Disruption Report — Client Deliverable</p>
            <p className="text-[var(--kiq-ink)]/40 text-xs mt-0.5">CAA-compliant, print-ready report with member notice template, risk register, and action checklist</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/network-iq/disruption-report")}
          data-testid="generate-disruption-report-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 ml-4 transition-all hover:opacity-90"
          style={{ background: "rgba(34,211,238,0.18)", border: "1px solid rgba(34,211,238,0.4)", color: "#22D3EE" }}
        >
          <FileDown size={13} /> Generate Report
        </button>
      </div>

      <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] flex items-start gap-3">
        <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[var(--kiq-ink)]/80 text-sm font-medium">Renewal Disruption Window Active</p>
          <p className="text-[var(--kiq-ink)]/45 text-xs mt-0.5">Network contracts expiring or under re-negotiation in the next 180 days. Members using these providers are at risk of disruption at plan renewal.</p>
        </div>
      </div>

      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 flex items-center gap-2"><RefreshCw size={14} className="text-orange-400" />Provider Disruption Risk Register</h3>
        <div className="space-y-3">
          {risks.map((r: any, i: number) => (
            <div key={i} className="p-4 rounded-xl bg-[var(--kiq-surface)]/[0.02] border border-white/[0.06] hover:border-white/[0.10] transition-colors" data-testid={`disruption-${i}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[var(--kiq-ink)] font-medium text-sm">{r.provider}</p>
                  <p className="text-[var(--kiq-ink)]/40 text-xs mt-0.5">{r.specialty} · {r.members_using} members using</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: riskLevelColor(r.risk_level), background: riskLevelColor(r.risk_level) + "18", border: `1px solid ${riskLevelColor(r.risk_level)}30` }}>
                    {r.risk_level} Risk
                  </span>
                  <p className="text-xs text-[var(--kiq-ink)]/30 mt-1">Contract exp: {r.contract_expiry}</p>
                </div>
              </div>
              <p className="text-xs text-[var(--kiq-ink)]/50 mb-2">{r.reason}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--kiq-ink)]/30">Replacement options: <span className="text-[var(--kiq-ink)]/60">{r.alternatives} in-network alternatives</span></span>
                <span className="text-amber-400">Est. impact: ${(r.financial_impact/1000).toFixed(0)}K leakage if lost</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Disruption Communication Plan</h3>
        <div className="space-y-2">
          {[
            { step: "1", title: "Identify affected members", desc: "Pull claims for members who saw at-risk providers in last 12 months", due: "30 days before renewal", status: "pending" },
            { step: "2", title: "Identify in-network alternatives", desc: "Map comparable providers accepting new patients within 30-min drive", due: "45 days before renewal", status: "pending" },
            { step: "3", title: "Send member notices", desc: "CAA-compliant 60-day advance written notice to affected members", due: "60 days before renewal", status: "pending" },
            { step: "4", title: "Set up care transition support", desc: "Assign dedicated care coordinator for complex/chronic care patients", due: "Renewal date", status: "pending" },
            { step: "5", title: "Update provider directory", desc: "Remove departed providers from all plan materials within 30 days", due: "30 days post-renewal", status: "pending" },
          ].map((s, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg bg-[var(--kiq-surface)]/[0.02] border border-white/[0.05]" data-testid={`comm-step-${i}`}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: NEON.cyan + "20", color: NEON.cyan, border: `1px solid ${NEON.cyan}30` }}>{s.step}</div>
              <div className="flex-1">
                <p className="text-sm text-[var(--kiq-ink)]/80 font-medium">{s.title}</p>
                <p className="text-xs text-[var(--kiq-ink)]/40 mt-0.5">{s.desc}</p>
                <p className="text-xs text-amber-400 mt-1">Due: {s.due}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: BENCHMARKS ───────────────────────────────────────────────────────── */
function BenchmarksTab({ data }: { data: NetworkData }) {
  const bm = data.benchmarks;
  const radarData = [
    { metric: "Adequacy", you: bm?.adequacy_score ?? 71, peer: 78, best: 91 },
    { metric: "In-Network Rate", you: bm?.in_network_rate ?? 89, peer: 85, best: 94 },
    { metric: "CAA Score", you: bm?.caa_score ?? 74, peer: 68, best: 92 },
    { metric: "Access Score", you: bm?.access_score ?? 65, peer: 72, best: 88 },
    { metric: "Cost Efficiency", you: bm?.cost_efficiency ?? 58, peer: 63, best: 81 },
  ];

  const comparisons = [
    { carrier: "Anthem BCBS (Indiana)", adequacy: 82, inn_rate: 91, caa: 79, leakage_pct: 7.2, benchmark: true },
    { carrier: "UnitedHealth Choice Plus", adequacy: 78, inn_rate: 89, caa: 83, leakage_pct: 8.5, benchmark: false },
    { carrier: "Aetna Open Choice", adequacy: 74, inn_rate: 87, caa: 71, leakage_pct: 10.1, benchmark: false },
    { carrier: "Cigna Open Access Plus", adequacy: 80, inn_rate: 90, caa: 77, leakage_pct: 8.0, benchmark: false },
    { carrier: "Your Plan (Current)", adequacy: data.summary.network_adequacy_score, inn_rate: data.summary.in_network_rate, caa: data.summary.caa_score, leakage_pct: data.summary.leakage_pct, benchmark: false, highlight: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Multi-Dimension Benchmark Radar</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#ffffff10" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#ffffff50", fontSize: 10 }} />
              <Radar name="Your Plan" dataKey="you" stroke={NEON.cyan} fill={NEON.cyan} fillOpacity={0.15} strokeWidth={2} />
              <Radar name="Peer Avg" dataKey="peer" stroke={NEON.gold} fill={NEON.gold} fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 2" />
              <Radar name="Best in Class" dataKey="best" stroke={NEON.green} fill={NEON.green} fillOpacity={0.06} strokeWidth={1} strokeDasharray="2 2" />
              <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 text-xs justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.cyan }} /><span className="text-[var(--kiq-ink)]/40">Your Plan</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.gold }} /><span className="text-[var(--kiq-ink)]/40">Peer Avg</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ background: NEON.green }} /><span className="text-[var(--kiq-ink)]/40">Best in Class</span></div>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Key Gaps vs. Benchmarks</h3>
          <div className="space-y-3">
            {[
              { metric: "Network Adequacy Score", yours: data.summary.network_adequacy_score, peer: 78, best: 91, unit: "" },
              { metric: "In-Network Utilization", yours: data.summary.in_network_rate, peer: 87, best: 94, unit: "%" },
              { metric: "CAA Transparency Score", yours: data.summary.caa_score, peer: 73, best: 92, unit: "" },
              { metric: "OON Leakage Rate", yours: data.summary.leakage_pct, peer: 9.1, best: 5.2, unit: "%", invert: true },
            ].map((m, i) => {
              const gap = m.invert ? m.peer - m.yours : m.yours - m.peer;
              const col = m.invert ? (gap >= 0 ? NEON.green : NEON.red) : (gap >= 0 ? NEON.green : NEON.red);
              return (
                <div key={i} className="p-3 rounded-lg bg-[var(--kiq-surface)]/[0.02] border border-white/[0.06]" data-testid={`benchmark-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--kiq-ink)]/70">{m.metric}</span>
                    <span className="text-xs font-bold" style={{ color: col }}>{gap >= 0 ? "+" : ""}{gap.toFixed(1)}{m.unit} vs peer</span>
                  </div>
                  <div className="flex gap-4 text-xs text-[var(--kiq-ink)]/35">
                    <span>Yours: <b className="text-[var(--kiq-ink)]/60">{m.yours}{m.unit}</b></span>
                    <span>Peer avg: <b className="text-[var(--kiq-ink)]/60">{m.peer}{m.unit}</b></span>
                    <span>Best: <b style={{ color: NEON.green }}>{m.best}{m.unit}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Indiana Market Carrier Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Carrier / Network", "Adequacy Score", "In-Network Rate", "CAA Score", "OON Leakage"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[var(--kiq-ink)]/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c: any, i: number) => (
                <tr key={i}
                  className={`border-b border-white/[0.03] transition-colors ${c.highlight ? "bg-cyan-500/[0.06] border-l-2 border-l-cyan-500/50" : "hover:bg-[var(--kiq-surface)]/[0.02]"}`}
                  data-testid={`carrier-row-${i}`}
                >
                  <td className="py-3 px-3 font-medium" style={{ color: c.highlight ? NEON.cyan : "#ffffffcc" }}>
                    {c.carrier} {c.highlight && <span className="text-xs text-cyan-400/60 ml-1">(you)</span>}
                  </td>
                  <td className="py-3 px-3"><span style={{ color: scoreColor(c.adequacy) }} className="font-bold">{c.adequacy}</span></td>
                  <td className="py-3 px-3"><span style={{ color: scoreColor(c.inn_rate) }} className="font-bold">{c.inn_rate}%</span></td>
                  <td className="py-3 px-3"><span style={{ color: scoreColor(c.caa) }} className="font-bold">{c.caa}</span></td>
                  <td className="py-3 px-3"><span style={{ color: riskColor(c.leakage_pct * 3) }} className="font-bold">{c.leakage_pct}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: CAA COMPLIANCE ───────────────────────────────────────────────────── */
function CaaTab({ data }: { data: NetworkData }) {
  const caa = data.caa_compliance;
  const passes = (caa?.items || []).filter((i: any) => i.status === "PASS").length;
  const fails  = (caa?.items || []).filter((i: any) => i.status === "FAIL").length;
  const warns  = (caa?.items || []).filter((i: any) => i.status === "WARN").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[var(--kiq-surface)]/[0.03] border border-white/[0.07] p-4 flex flex-col items-center gap-2">
          <p className="text-[var(--kiq-ink)]/40 text-xs">CAA Score</p>
          <Gauge score={caa?.score ?? 0} size={72} />
          <p className="text-[var(--kiq-ink)]/30 text-xs">Grade: {caa?.grade}</p>
        </div>
        <Kpi label="Requirements Passed" value={`${passes}`} color={NEON.green} icon={CheckCircle} sub="Full compliance" />
        <Kpi label="Failures" value={`${fails}`} color={NEON.red} icon={XCircle} sub="Immediate action needed" />
        <Kpi label="Warnings" value={`${warns}`} color={NEON.gold} icon={AlertTriangle} sub="Remediation in progress" />
      </div>

      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--kiq-ink)] font-semibold">CAA Transparency Requirements</h3>
          <span className="text-xs text-[var(--kiq-ink)]/30">Consolidated Appropriations Act, 2021</span>
        </div>
        <div className="space-y-2">
          {(caa?.items || []).map((item: any, i: number) => (
            <div key={i}
              className={`flex items-start justify-between p-4 rounded-xl border transition-colors ${item.status === "FAIL" ? "border-red-500/25 bg-red-500/[0.04]" : item.status === "WARN" ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-white/[0.05] bg-[var(--kiq-surface)]/[0.01]"}`}
              data-testid={`caa-item-${i}`}
            >
              <div className="flex items-start gap-3 flex-1">
                {item.status === "PASS" ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> :
                  item.status === "FAIL" ? <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" /> :
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className="text-sm font-medium text-[var(--kiq-ink)]/85">{item.requirement}</p>
                  {item.gap && <p className="text-xs text-[var(--kiq-ink)]/45 mt-1">{item.gap}</p>}
                  {item.deadline && <p className="text-xs text-amber-400/70 mt-1">Deadline: {item.deadline}</p>}
                  {item.citation && <p className="text-xs text-[var(--kiq-ink)]/25 mt-1">Cite: {item.citation}</p>}
                </div>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: ACTION PLAN ──────────────────────────────────────────────────────── */
function ActionPlanTab({ data }: { data: NetworkData }) {
  const plans = data.action_plan || [];
  const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sorted = [...plans].sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));
  const priorityStyle: Record<string, { border: string; bg: string; text: string }> = {
    Critical: { border: "border-red-500/30",    bg: "bg-red-500/[0.05]",    text: "text-red-400" },
    High:     { border: "border-amber-500/30",  bg: "bg-amber-500/[0.05]",  text: "text-amber-400" },
    Medium:   { border: "border-blue-500/25",   bg: "bg-blue-500/[0.04]",   text: "text-blue-400" },
    Low:      { border: "border-white/[0.06]",  bg: "bg-[var(--kiq-surface)]/[0.02]",      text: "text-[var(--kiq-ink)]/40" },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {["Critical", "High", "Medium", "Low"].map(p => {
          const count = sorted.filter(a => a.priority === p).length;
          const totalImpact = sorted.filter(a => a.priority === p).reduce((s: number, a: any) => s + (a.savings_impact || 0), 0);
          return (
            <div key={p} className={`rounded-xl border p-4 ${priorityStyle[p].border} ${priorityStyle[p].bg}`} data-testid={`action-priority-${p.toLowerCase()}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${priorityStyle[p].text}`}>{p}</p>
              <p className="text-2xl font-bold text-[var(--kiq-ink)] mt-1">{count}</p>
              <p className="text-xs text-[var(--kiq-ink)]/30">~${(totalImpact/1000).toFixed(0)}K impact</p>
            </div>
          );
        })}
      </div>

      <SectionCard>
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-4 flex items-center gap-2"><Target size={14} className="text-purple-400" />Prioritized Network Action Plan</h3>
        <div className="space-y-3">
          {sorted.map((a: any, i: number) => {
            const ps = priorityStyle[a.priority] ?? priorityStyle.Low;
            return (
              <div key={i} className={`p-4 rounded-xl border ${ps.border} ${ps.bg}`} data-testid={`action-item-${i}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ps.border} ${ps.text} bg-[var(--kiq-surface)]/[0.03]`}>{a.priority}</span>
                      <span className="text-sm font-medium text-[var(--kiq-ink)]">{a.title}</span>
                    </div>
                    <p className="text-xs text-[var(--kiq-ink)]/45 mb-2">{a.description}</p>
                    <div className="flex gap-4 text-xs text-[var(--kiq-ink)]/30">
                      <span>Owner: <span className="text-[var(--kiq-ink)]/50">{a.owner}</span></span>
                      <span>Timeline: <span className="text-[var(--kiq-ink)]/50">{a.timeline}</span></span>
                      <span>Category: <span className="text-[var(--kiq-ink)]/50">{a.category}</span></span>
                    </div>
                  </div>
                  {a.savings_impact > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-[var(--kiq-ink)]/30">Est. Savings</p>
                      <p className="font-bold" style={{ color: NEON.green }}>${(a.savings_impact/1000).toFixed(0)}K</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

/* ─── TAB: UPLOAD DATA ──────────────────────────────────────────────────────── */
function UploadTab({
  doc,
  onDocumentReady,
  onClear,
}: {
  doc: UploadedDocument | null;
  onDocumentReady: (d: UploadedDocument) => void;
  onClear: () => void;
}) {
  const [preview, setPreview] = useState(false);

  function formatBytes(b: number) {
    if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
    if (b >= 1_024) return `${(b / 1_024).toFixed(0)} KB`;
    return `${b} B`;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Instructions */}
      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.03] p-5">
        <h3 className="text-[var(--kiq-ink)] font-semibold mb-1 flex items-center gap-2">
          <Upload size={14} style={{ color: NEON.cyan }} />
          Upload Network Data
        </h3>
        <p className="text-[var(--kiq-ink)]/45 text-sm">
          Upload provider directories, claims exports, EOB files, or any network-related document.
          The extracted text becomes available alongside the live analytics for AI co-pilot context.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Provider Directory (PDF)", "Claims Export (CSV)", "EOB Report (PDF)", "Network Roster (XLSX)", "Adequacy Study (DOCX)"].map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full text-xs border border-white/[0.08] text-[var(--kiq-ink)]/35">{t}</span>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <FileUploadZone
        onDocumentReady={onDocumentReady}
        onClear={onClear}
        uploadedDoc={doc}
        label="Drop your network data file here"
        hint="PDF, DOCX, CSV, XLSX, TXT — max 20 MB"
        accept=".pdf,.docx,.txt,.csv,.xlsx"
      />

      {/* Parsed summary */}
      {doc && (
        <div className="rounded-2xl border border-white/[0.08] bg-[var(--kiq-surface)]/[0.02] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[var(--kiq-ink)]/80 font-semibold text-sm flex items-center gap-2">
              <FileSearch size={14} style={{ color: NEON.green }} />
              Parsed Document
            </h4>
            <button
              data-testid="niq-toggle-preview"
              onClick={() => setPreview(p => !p)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-white/[0.1] text-[var(--kiq-ink)]/40 hover:text-[var(--kiq-ink)]/70 transition-colors"
            >
              <Eye size={11} /> {preview ? "Hide" : "Show"} text
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-[var(--kiq-surface)]/[0.02] p-3 text-center" data-testid="niq-upload-filename">
              <p className="text-xs text-[var(--kiq-ink)]/30 mb-1">Filename</p>
              <p className="text-[var(--kiq-ink)]/80 text-xs font-medium truncate">{doc.filename}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[var(--kiq-surface)]/[0.02] p-3 text-center" data-testid="niq-upload-size">
              <p className="text-xs text-[var(--kiq-ink)]/30 mb-1">File Size</p>
              <p className="text-[var(--kiq-ink)]/80 text-sm font-bold">{formatBytes(doc.file_size_bytes)}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[var(--kiq-surface)]/[0.02] p-3 text-center" data-testid="niq-upload-chars">
              <p className="text-xs text-[var(--kiq-ink)]/30 mb-1 flex items-center justify-center gap-1"><Hash size={10} />Characters</p>
              <p className="text-[var(--kiq-ink)]/80 text-sm font-bold">{doc.char_count.toLocaleString()}</p>
            </div>
          </div>

          {doc.preview && (
            <div className="rounded-xl border border-white/[0.06] bg-[var(--kiq-surface)]/[0.015] p-3">
              <p className="text-xs text-[var(--kiq-ink)]/30 mb-1">Preview</p>
              <p className="text-[var(--kiq-ink)]/55 text-xs leading-relaxed font-mono">{doc.preview}</p>
            </div>
          )}

          {preview && doc.text && (
            <div className="rounded-xl border border-cyan-400/10 bg-cyan-400/[0.02] p-4 max-h-96 overflow-y-auto">
              <p className="text-xs text-[var(--kiq-ink)]/30 mb-2">Full extracted text</p>
              <pre className="text-[var(--kiq-ink)]/45 text-xs leading-relaxed whitespace-pre-wrap font-mono">{doc.text}</pre>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-green-400/70">
            <CheckCircle size={12} />
            Document ready — use this data as context in McKinsey Co-Pilot for network analysis
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── TABS CONFIG ───────────────────────────────────────────────────────────── */
type TabId = "overview" | "adequacy" | "leakage" | "disruption" | "benchmarks" | "caa" | "actions" | "upload";
const TABS: { id: TabId; label: string; icon: any; color: string }[] = [
  { id: "overview",    label: "Overview",     icon: BarChart3,     color: NEON.cyan   },
  { id: "adequacy",    label: "Adequacy",     icon: Stethoscope,   color: NEON.green  },
  { id: "leakage",     label: "Leakage",      icon: DollarSign,    color: NEON.red    },
  { id: "disruption",  label: "Disruption",   icon: RefreshCw,     color: NEON.orange },
  { id: "benchmarks",  label: "Benchmarks",   icon: TrendingUp,    color: NEON.gold   },
  { id: "caa",         label: "CAA Compliance", icon: ShieldCheck, color: NEON.purple },
  { id: "actions",     label: "Action Plan",  icon: Target,        color: NEON.blue   },
  { id: "upload",      label: "Upload Data",  icon: Upload,        color: NEON.gold   },
];

/* ─── ROOT PAGE ─────────────────────────────────────────────────────────────── */
export default function NetworkIQ() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [emailOpen, setEmailOpen] = useState(false);
  const [fullReportOpen, setFullReportOpen] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const { data, isLoading } = useQuery<NetworkData>({ queryKey: ["/api/saas/network/dashboard"] });
  const emailSummary: Record<string, string> = data ? {
    "Adequacy Score":    `${data.summary.network_adequacy_score}/100`,
    "Providers In-Net":  `${data.summary.in_network_rate}%`,
    "Network Leakage":   `$${(data.summary.leakage_dollars/1000).toFixed(0)}K`,
    "Disruption Risk":   String(data.summary.disruption_risk),
    "CAA Compliance":    `${data.summary.caa_score}%`,
  } : {};

  return (
    <Layout>
      <div className="kiq-health-shell">

        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(20px) saturate(160%)",
          borderBottom: "1px solid rgba(34,211,238,0.12)",
          boxShadow: "0 12px 34px rgba(15,23,42,0.06)",
        }}>
          <div className="px-6 py-3 flex items-center gap-3">
            <Network size={18} style={{ color: NEON.cyan }} />
            <div>
              <h1 className="text-base font-bold text-[var(--kiq-ink)] leading-tight">Network IQ™</h1>
              <p className="text-[var(--kiq-ink)]/35 text-xs leading-tight">Provider network adequacy · Leakage analysis · CAA compliance</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {data && (
                <button onClick={() => setFullReportOpen(true)} data-testid="niq-fullreport-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.45)", color: NEON.cyan }}>
                  <FileSearch size={12} /> Full Report
                </button>
              )}
              <button onClick={() => downloadPDF("network-iq", data ?? {})} data-testid="niq-download-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.22)", color: NEON.cyan }}>
                <FileText size={12} /> Download PDF
              </button>
              <button onClick={() => setEmailOpen(true)} data-testid="niq-email-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: NEON.cyan }}>
                <Mail size={12} /> Email Report
              </button>
              {uploadedDoc && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-400/80" data-testid="niq-upload-indicator">
                  <Upload size={10} /> {uploadedDoc.filename}
                </span>
              )}
              <span className="text-xs text-[var(--kiq-ink)]/25">Data as of Q4 2024</span>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: NEON.cyan }} />
            </div>
          </div>

          {/* Tab bar */}
          <div className="px-6 flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
            {TABS.map(({ id, label, icon: Icon, color }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  data-testid={`network-tab-${id}`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all border-b-2 flex-shrink-0"
                  style={{
                    color: active ? color : "#475569",
                    borderBottomColor: active ? color : "transparent",
                    background: active ? `${color}10` : "transparent",
                  }}
                >
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-w-7xl">
          {activeTab === "upload" ? (
            <UploadTab
              doc={uploadedDoc}
              onDocumentReady={setUploadedDoc}
              onClear={() => setUploadedDoc(null)}
            />
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64 gap-3">
              <div className="w-5 h-5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              <span className="text-[var(--kiq-ink)]/40 text-sm">Loading network data…</span>
            </div>
          ) : data ? (
            <>
              {activeTab === "overview"   && <OverviewTab   data={data} />}
              {activeTab === "adequacy"   && <AdequacyTab   data={data} />}
              {activeTab === "leakage"    && <LeakageTab    data={data} />}
              {activeTab === "disruption" && <DisruptionTab data={data} />}
              {activeTab === "benchmarks" && <BenchmarksTab data={data} />}
              {activeTab === "caa"        && <CaaTab        data={data} />}
              {activeTab === "actions"    && <ActionPlanTab data={data} />}
            </>
          ) : (
            <div className="text-[var(--kiq-ink)]/30 text-center py-20">No network data available.</div>
          )}
        </div>
      </div>
      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="network-iq"
        summaryData={emailSummary}
        reportData={data}
      />
      {fullReportOpen && data && (
        <NetworkIQFullReport data={data} onClose={() => setFullReportOpen(false)} />
      )}
    </Layout>
  );
}
