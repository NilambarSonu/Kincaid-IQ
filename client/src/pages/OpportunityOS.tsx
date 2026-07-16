import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Layout } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain, Target, TrendingUp, Users, DollarSign, Shield, Award, MapPin,
  ChevronRight, ArrowLeft, Sparkles, Send, X, Layers, BookOpen, Gauge,
  Compass, Briefcase, AlertTriangle, Building2, Zap, ClipboardList, Loader2,
  Search, Plus, Trash2, Check, CalendarDays,
} from "lucide-react";

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg: "#F8FAFC",
  surface: "rgba(255,255,255,0.80)",
  surface2: "rgba(248,250,252,0.78)",
  border: "rgba(15,23,42,0.10)",
  gold: "#D4AF37",
  goldLight: "#f0d060",
  text: "#1e2f46",
  textLight: "#08111f",
  muted: "#3f516a",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
  yellow: "#eab308",
};

const CHART_COLORS = [T.gold, T.blue, T.purple, T.green, T.orange, T.cyan, T.red, T.yellow];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v?: number | null) => {
  if (v == null) return "n/a";
  if (Math.abs(v) >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtNum = (v?: number | null) => (v == null ? "n/a" : v.toLocaleString());
const scoreColor = (s: number) => (s >= 78 ? T.green : s >= 62 ? T.gold : T.orange);
const tierLabel = (t: string) =>
  t === "TIER_1" ? "TIER 1" : t === "TIER_2" ? "TIER 2" : "TIER 3";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Card {
  id: string; name: string; title: string; role_type: string; region: string;
  office: string; overall_score: number; priority_tier: string;
  revenue_responsibility: number; healthcare_spend_under_advisement: number;
  bb_revenue_opportunity: number; estimated_client_savings: number;
  top_solution: string | null; num_clients: number; self_funded_pct: number;
}
interface Dashboard {
  kpis: Record<string, number>;
  rankings: Card[];
  regions: { region: string; executives: number; bb_revenue_opportunity: number; client_savings: number; spend_under_advisement: number; avg_score: number }[];
  product_readiness: { key: string; name: string; category: string; executives: number; eligible_clients: number; client_savings: number; bb_revenue_opportunity: number }[];
  pipeline: { tier: string; label: string; executives: number; bb_revenue_opportunity: number }[];
  revenue_forecast: { period: string; bb_revenue: number; cumulative: number }[];
  methodology: string;
}
interface ExecFull {
  id: string;
  profile: any;
  book: any;
  needs: { challenge: string; severity: string; driver: string; addressed_by: string }[];
  solution_mapping: any[];
  scoring: { overall: number; priority_tier: string; components: Record<string, number>; components_detail: { key: string; label: string; score: number; weight: number }[]; weights: Record<string, number> };
  financial_summary: any;
  meta: any;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: T.muted, marginBottom: 12, textTransform: "uppercase" }}>
      {icon}{children}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = { CERTIFIED: T.green, MODELED: T.gold, INSUFFICIENT_EVIDENCE: T.red };
  const c = colors[tier] || T.muted;
  return (
    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: c, border: `1px solid ${c}40`, padding: "2px 6px", borderRadius: 3 }}>
      {tier}
    </span>
  );
}

function PriorityBadge({ tier }: { tier: string }) {
  const c = tier === "TIER_1" ? T.green : tier === "TIER_2" ? T.gold : T.orange;
  return (
    <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", color: "#000", background: c, padding: "2px 7px", borderRadius: 3 }}>
      {tierLabel(tier)}
    </span>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const c = scoreColor(score);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `3px solid ${c}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.32, fontWeight: 800, color: c, lineHeight: 1 }}>{score}</span>
      <span style={{ fontSize: 6, color: T.muted, letterSpacing: "0.1em" }}>/ 100</span>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color || scoreColor(value);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: T.text }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{value}</span>
      </div>
      <div style={{ height: 6, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: c, borderRadius: 3 }} />
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "rgba(255,255,255,0.96)", border: `1px solid ${T.border}`, borderRadius: 10,
  fontSize: 11, color: T.textLight, boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
};

// ── KPI tiles ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <Panel style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: T.muted, textTransform: "uppercase" }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.textLight, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>{sub}</div>}
    </Panel>
  );
}

// ── Dashboard view ──────────────────────────────────────────────────────────────
function DashboardView({ data, loading, onSelect }: { data?: Dashboard; loading: boolean; onSelect: (id: string) => void }) {
  if (loading || !data) {
    return <div style={{ padding: 60, textAlign: "center", color: T.muted, fontSize: 13 }} data-testid="status-dashboard-loading">Loading opportunity intelligence…</div>;
  }
  const k = data.kpis;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiTile label="Executives Evaluated" value={fmtNum(k.executives_evaluated)} sub={`${k.tier_1_count} Tier 1 priorities`} icon={<Users size={16} />} color={T.blue} />
        <KpiTile label="B&B Revenue Opportunity" value={fmt$(k.total_bb_revenue_opportunity)} sub="Modeled incremental consulting" icon={<DollarSign size={16} />} color={T.gold} />
        <KpiTile label="Client Savings Potential" value={fmt$(k.total_client_savings)} sub="Across all books" icon={<TrendingUp size={16} />} color={T.green} />
        <KpiTile label="Spend Under Advisement" value={fmt$(k.total_spend_under_advisement)} sub="Total healthcare spend" icon={<Briefcase size={16} />} color={T.purple} />
        <KpiTile label="AI Readiness Index" value={String(k.ai_readiness_index)} sub="Roster average" icon={<Brain size={16} />} color={T.cyan} />
        <KpiTile label="Complexity Index" value={String(k.healthcare_complexity_index)} sub="Roster average" icon={<Layers size={16} />} color={T.orange} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
        {/* Rankings */}
        <Panel>
          <SectionLabel icon={<Award size={12} />}>Executive Opportunity Rankings</SectionLabel>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ color: T.muted, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Score</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Executive</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Region</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>B&B Rev</th>
                  <th style={{ padding: "6px 8px", fontWeight: 600 }}>Lead Solution</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    data-testid={`row-executive-${c.id}`}
                    style={{ cursor: "pointer", borderTop: `1px solid ${T.border}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = T.surface2)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "8px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", border: `2px solid ${scoreColor(c.overall_score)}`, color: scoreColor(c.overall_score), fontWeight: 800, fontSize: 11 }} data-testid={`text-score-${c.id}`}>{c.overall_score}</span>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ color: T.textLight, fontWeight: 600 }}>{c.name}</div>
                      <div style={{ color: T.muted, fontSize: 9 }}>{c.title}</div>
                    </td>
                    <td style={{ padding: "8px", color: T.text }}>{c.region}</td>
                    <td style={{ padding: "8px", textAlign: "right", color: T.gold, fontWeight: 700 }}>{fmt$(c.bb_revenue_opportunity)}</td>
                    <td style={{ padding: "8px", color: T.text, fontSize: 10 }}>{c.top_solution || "n/a"}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}><ChevronRight size={14} color={T.muted} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Pipeline + forecast */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Panel>
            <SectionLabel icon={<Target size={12} />}>Priority Pipeline</SectionLabel>
            {data.pipeline.map((p) => {
              const c = p.tier === "TIER_1" ? T.green : p.tier === "TIER_2" ? T.gold : T.orange;
              return (
                <div key={p.tier} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${T.border}` }} data-testid={`row-pipeline-${p.tier}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                    <span style={{ fontSize: 11, color: T.text }}>{p.label}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textLight }}>{p.executives} execs</div>
                    <div style={{ fontSize: 9, color: T.muted }}>{fmt$(p.bb_revenue_opportunity)}</div>
                  </div>
                </div>
              );
            })}
          </Panel>
          <Panel>
            <SectionLabel icon={<TrendingUp size={12} />}>Revenue Capture Forecast</SectionLabel>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.revenue_forecast} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.gold} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="period" tick={{ fill: T.muted, fontSize: 10 }} />
                <YAxis tickFormatter={(v) => fmt$(v)} tick={{ fill: T.muted, fontSize: 9 }} width={44} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt$(v)} />
                <Area type="monotone" dataKey="cumulative" stroke={T.gold} fill="url(#revGrad)" strokeWidth={2} name="Cumulative" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Regional heat map */}
        <Panel>
          <SectionLabel icon={<MapPin size={12} />}>Regional Opportunity Heat Map</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.regions} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => fmt$(v)} tick={{ fill: T.muted, fontSize: 9 }} />
              <YAxis type="category" dataKey="region" tick={{ fill: T.text, fontSize: 10 }} width={80} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt$(v)} />
              <Bar dataKey="bb_revenue_opportunity" name="B&B Revenue" radius={[0, 4, 4, 0]}>
                {data.regions.map((r, i) => (
                  <Cell key={r.region} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Product readiness */}
        <Panel>
          <SectionLabel icon={<Layers size={12} />}>Kincaid Health Product Adoption Readiness</SectionLabel>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {data.product_readiness.map((p) => (
              <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${T.border}` }} data-testid={`row-product-${p.key}`}>
                <div>
                  <div style={{ fontSize: 11, color: T.textLight, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: T.muted }}>{p.executives} execs · {fmtNum(p.eligible_clients)} eligible clients</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.gold }}>{fmt$(p.bb_revenue_opportunity)}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div style={{ fontSize: 9, color: T.muted, lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 8 }}>
        <TierBadge tier="MODELED" />
        <span>{data.methodology}</span>
      </div>
    </div>
  );
}

// ── Executive detail ─────────────────────────────────────────────────────────────
const TABS = [
  { key: "intel", label: "Executive Intelligence", icon: <Compass size={13} /> },
  { key: "book", label: "Book of Business", icon: <Briefcase size={13} /> },
  { key: "needs", label: "Client Needs", icon: <AlertTriangle size={13} /> },
  { key: "solutions", label: "Solution Mapping", icon: <Layers size={13} /> },
  { key: "scoring", label: "Opportunity Scoring", icon: <Gauge size={13} /> },
  { key: "playbook", label: "Sales Playbook", icon: <BookOpen size={13} /> },
];

function ExecutiveDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [tab, setTab] = useState("intel");
  const q = useQuery<ExecFull>({ queryKey: ["/api/opportunity-os/executives", id] });

  if (q.isLoading || !q.data) {
    return <div style={{ padding: 60, textAlign: "center", color: T.muted }} data-testid="status-executive-loading">Loading executive profile…</div>;
  }
  const ex = q.data;
  const p = ex.profile;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button onClick={onBack} data-testid="button-back" style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
        <ArrowLeft size={14} /> Back to command center
      </button>

      {/* Exec header */}
      <Panel style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <ScoreRing score={ex.scoring.overall} size={72} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: T.textLight }} data-testid="text-exec-name">{p.name}</span>
            <PriorityBadge tier={ex.scoring.priority_tier} />
          </div>
          <div style={{ fontSize: 12, color: T.text }}>{p.title}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{p.office} · {p.region} · {p.tenure_years} yrs tenure</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.1em" }}>B&B REVENUE OPP</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>{fmt$(ex.financial_summary.bb_revenue_opportunity)}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.1em" }}>CLIENT SAVINGS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>{fmt$(ex.financial_summary.estimated_client_savings)}</div>
          </div>
        </div>
      </Panel>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: tab === t.key ? T.gold : "transparent",
              color: tab === t.key ? "#000" : T.muted,
              border: `1px solid ${tab === t.key ? T.gold : T.border}`,
              borderRadius: 6, padding: "7px 12px", fontSize: 10, fontWeight: 700,
              letterSpacing: "0.05em", cursor: "pointer",
            }}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "intel" && <IntelTab p={p} />}
      {tab === "book" && <BookTab book={ex.book} />}
      {tab === "needs" && <NeedsTab needs={ex.needs} />}
      {tab === "solutions" && <SolutionsTab mapping={ex.solution_mapping} />}
      {tab === "scoring" && <ScoringTab scoring={ex.scoring} />}
      {tab === "playbook" && <PlaybookTab id={id} name={p.name} />}
    </div>
  );
}

function IntelTab({ p }: { p: any }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <Panel>
        <SectionLabel icon={<Compass size={12} />}>Profile</SectionLabel>
        {[
          ["Role", p.role_type],
          ["Client segmentation", p.client_segmentation],
          ["Employer size focus", p.employer_size_focus],
          ["Decision authority", p.decision_authority],
          ["Leadership influence", p.leadership_influence],
          ["Innovation profile", p.innovation_profile],
          ["Communication style", p.communication_style],
          ["Book revenue", fmt$(p.revenue_responsibility)],
          ["Certifications", (p.certifications || []).join(", ")],
          ["Specialization", (p.industry_specialization || []).join(", ")],
          ["Network", p.relationship_network],
        ].map(([label, val]) => (
          <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0", borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 10, color: T.muted }}>{label}</span>
            <span style={{ fontSize: 11, color: T.textLight, textAlign: "right", maxWidth: "60%" }}>{val}</span>
          </div>
        ))}
      </Panel>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Panel>
          <SectionLabel icon={<Brain size={12} />}>Consulting Capability</SectionLabel>
          <Meter label="Healthcare consulting expertise" value={p.healthcare_consulting_expertise} />
          <Meter label="PBM knowledge" value={p.pbm_knowledge} />
          <Meter label="ERISA knowledge" value={p.erisa_knowledge} />
          <Meter label="Data analytics maturity" value={p.data_analytics_maturity} />
          <Meter label="Technology adoption" value={p.tech_adoption} />
        </Panel>
        <Panel>
          <SectionLabel icon={<Target size={12} />}>Strategic Priorities</SectionLabel>
          {(p.strategic_priorities || []).map((s: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 11, color: T.text }}>
              <span style={{ color: T.gold }}>▸</span>{s}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function BookTab({ book }: { book: any }) {
  const renewals = Object.entries(book.renewal_by_quarter || {}).map(([period, count]) => ({ period, count }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        <KpiTile label="Clients" value={fmtNum(book.num_clients)} icon={<Building2 size={15} />} color={T.blue} />
        <KpiTile label="Avg Client Size" value={`${fmtNum(book.avg_client_size)} lives`} icon={<Users size={15} />} color={T.purple} />
        <KpiTile label="Spend Under Advisement" value={fmt$(book.healthcare_spend_under_advisement)} icon={<DollarSign size={15} />} color={T.gold} />
        <KpiTile label="Self-Funded" value={`${book.self_funded_pct}%`} sub={`${book.fully_insured_pct}% fully insured`} icon={<Shield size={15} />} color={T.green} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Panel>
          <SectionLabel icon={<Layers size={12} />}>Industry Mix</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={book.industry_mix} dataKey="pct" nameKey="industry" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.pct}%`}>
                {book.industry_mix.map((_: any, i: number) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 10, color: T.text }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <SectionLabel icon={<ClipboardList size={12} />}>Renewal Timing</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={renewals}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="period" tick={{ fill: T.muted, fontSize: 10 }} />
              <YAxis tick={{ fill: T.muted, fontSize: 9 }} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={T.cyan} radius={[4, 4, 0, 0]} name="Renewals" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel>
        <SectionLabel icon={<Zap size={12} />}>Book Composition Signals</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          {[
            ["Self-funded accounts", book.self_funded_clients],
            ["Large employers", book.large_employer_exposure],
            ["Fiduciary complexity", book.fiduciary_complexity_accounts],
            ["High pharmacy spend", book.high_pharmacy_spend_clients],
            ["High-growth accounts", book.high_growth_accounts],
            ["PE-backed accounts", book.pe_portfolio_exposure],
            ["Captive participation", book.captive_participation],
          ].map(([label, val]) => (
            <div key={label as string}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.textLight }}>{fmtNum(val as number)}</div>
              <div style={{ fontSize: 9, color: T.muted }}>{label}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function NeedsTab({ needs }: { needs: any[] }) {
  const sevColor = (s: string) => (s === "High" ? T.red : s === "Medium" ? T.gold : T.blue);
  return (
    <Panel>
      <SectionLabel icon={<AlertTriangle size={12} />}>Discovered Client Needs</SectionLabel>
      {needs.map((n, i) => (
        <div key={i} data-testid={`row-need-${i}`} style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 8, fontWeight: 800, color: sevColor(n.severity), border: `1px solid ${sevColor(n.severity)}40`, padding: "2px 6px", borderRadius: 3, height: "fit-content", letterSpacing: "0.08em" }}>{n.severity.toUpperCase()}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.textLight }}>{n.challenge}</div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{n.driver}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: T.muted }}>ADDRESSED BY</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.gold }}>{n.addressed_by}</div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function SolutionsTab({ mapping }: { mapping: any[] }) {
  return (
    <Panel>
      <SectionLabel icon={<Layers size={12} />}>Kincaid Health Solution Mapping</SectionLabel>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ color: T.muted, textAlign: "left" }}>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Solution</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Eligible</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>Client Savings</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>B&B Revenue</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Effort</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Visibility</th>
              <th style={{ padding: "6px 8px", fontWeight: 600 }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => (
              <tr key={m.key} data-testid={`row-solution-${m.key}`} style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: "10px 8px" }}>
                  <div style={{ color: T.textLight, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ color: T.muted, fontSize: 9, maxWidth: 240 }}>{m.client_differentiation}</div>
                </td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: T.text }}>{fmtNum(m.eligible_clients)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: T.green, fontWeight: 700 }}>{fmt$(m.estimated_client_savings)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: T.gold, fontWeight: 700 }}>{fmt$(m.bb_revenue_opportunity)}</td>
                <td style={{ padding: "10px 8px", color: T.text }}>{m.implementation_effort}</td>
                <td style={{ padding: "10px 8px", color: T.text }}>{m.executive_visibility}</td>
                <td style={{ padding: "10px 8px" }}><TierBadge tier={m.confidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ScoringTab({ scoring }: { scoring: ExecFull["scoring"] }) {
  const radar = scoring.components_detail.map((c) => ({ label: c.label.replace(/ /g, "\n"), score: c.score }));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <Panel>
        <SectionLabel icon={<Gauge size={12} />}>14-Factor Score Profile</SectionLabel>
        <ResponsiveContainer width="100%" height={340}>
          <RadarChart data={radar} outerRadius={120}>
            <PolarGrid stroke={T.border} />
            <PolarAngleAxis dataKey="label" tick={{ fill: T.muted, fontSize: 8 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: T.muted, fontSize: 8 }} />
            <Radar dataKey="score" stroke={T.gold} fill={T.gold} fillOpacity={0.35} />
            <Tooltip contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel>
        <SectionLabel icon={<Award size={12} />}>Weighted Score Breakdown</SectionLabel>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: scoreColor(scoring.overall) }}>{scoring.overall}</span>
          <span style={{ fontSize: 12, color: T.muted }}>/ 100 weighted composite</span>
          <span style={{ marginLeft: "auto" }}><TierBadge tier="MODELED" /></span>
        </div>
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {scoring.components_detail.map((c) => (
            <div key={c.key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: T.text }}>{c.label} <span style={{ color: T.muted }}>({Math.round(c.weight * 100)}%)</span></span>
                <span style={{ fontSize: 10, fontWeight: 700, color: scoreColor(c.score) }}>{c.score}</span>
              </div>
              <div style={{ height: 5, background: T.surface2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${c.score}%`, height: "100%", background: scoreColor(c.score) }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function PlaybookTab({ id, name }: { id: string; name: string }) {
  const mut = useMutation({
    mutationFn: async (regen: boolean) => {
      const res = await apiRequest("GET", `/api/opportunity-os/executives/${id}/playbook${regen ? "?regenerate=true" : ""}`);
      return res.json();
    },
  });
  const pb = mut.data;

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <SectionLabel icon={<BookOpen size={12} />}>AI Sales Playbook</SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {pb && <span style={{ alignSelf: "center" }}><TierBadge tier={pb.ai_generated ? "MODELED" : "MODELED"} /></span>}
          <button
            onClick={() => mut.mutate(!!pb)}
            data-testid="button-generate-playbook"
            disabled={mut.isPending}
            style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, color: "#000", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 10, fontWeight: 700, cursor: mut.isPending ? "wait" : "pointer" }}
          >
            {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {pb ? "Regenerate" : "Generate Playbook"}
          </button>
        </div>
      </div>

      {!pb && !mut.isPending && (
        <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 12 }}>
          Generate an AI-authored sales playbook for {name}, grounded in this executive's book and modeled opportunity.
        </div>
      )}
      {mut.isPending && (
        <div style={{ padding: 40, textAlign: "center", color: T.muted, fontSize: 12 }} data-testid="status-playbook-loading">Composing the playbook…</div>
      )}

      {pb && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="text-playbook">
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.12em", marginBottom: 6 }}>EXECUTIVE BRIEFING</div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{pb.executive_briefing}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <PbList title="Discovery Questions" items={pb.discovery_questions} />
            <PbList title="Industry Talking Points" items={pb.industry_talking_points} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.12em", marginBottom: 6 }}>VALUE NARRATIVE</div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{pb.value_narrative}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <PbList title="Presentation Outline" items={pb.presentation_outline} ordered />
            <PbList title="Implementation Roadmap" items={pb.implementation_roadmap} ordered />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <PbList title="Meeting Agenda" items={pb.meeting_agenda} ordered />
            <PbList title="Cross-Sell Recommendations" items={pb.cross_sell_recommendations} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.12em", marginBottom: 6 }}>FOLLOW-UP STRATEGY</div>
            <div style={{ fontSize: 12, color: T.text, lineHeight: 1.6 }}>{pb.follow_up_strategy}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function PbList({ title, items, ordered }: { title: string; items?: string[]; ordered?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.12em", marginBottom: 6 }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(items || []).map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, color: T.text, lineHeight: 1.5 }}>
            <span style={{ color: T.gold, fontWeight: 700, flexShrink: 0 }}>{ordered ? `${i + 1}.` : "▸"}</span>{it}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Co-Pilot drawer ───────────────────────────────────────────────────────────
const SUGGESTED = [
  "Which executives should I prioritize this quarter?",
  "Who has the greatest PBM and pharmacy opportunity?",
  "Which executives are most ready to adopt AI analytics?",
  "Where is the largest fiduciary and ERISA exposure?",
  "Which region carries the most revenue opportunity?",
];

function CoPilotDrawer({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");

  const mut = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/opportunity-os/copilot", { question });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((m) => [...m, { role: "ai", text: data.answer }]);
    },
    onError: () => {
      setMessages((m) => [...m, { role: "ai", text: "The co-pilot is unavailable right now. Please try again." }]);
    },
  });

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || mut.isPending) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    mut.mutate(q);
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "90vw", background: T.surface, borderLeft: `1px solid ${T.border}`, zIndex: 60, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.08)" }} data-testid="drawer-copilot">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color={T.gold} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textLight }}>Opportunity Co-Pilot</span>
        </div>
        <button onClick={onClose} data-testid="button-close-copilot" style={{ background: "transparent", border: "none", cursor: "pointer", color: T.muted }}><X size={18} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Ask about the roster. Answers are grounded only in the modeled executive data.
            </div>
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => ask(s)} data-testid="button-suggested-question" style={{ display: "block", width: "100%", textAlign: "left", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 11px", marginBottom: 8, color: T.text, fontSize: 11, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? T.gold : T.surface2, color: m.role === "user" ? "#000" : T.text, border: m.role === "user" ? "none" : `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", fontSize: 11, lineHeight: 1.55, whiteSpace: "pre-wrap" }} data-testid={`message-${m.role}-${i}`}>
            {m.text}
          </div>
        ))}
        {mut.isPending && <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: 11 }}><Loader2 size={13} className="animate-spin" /> Analyzing roster…</div>}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
          placeholder="Ask the co-pilot…"
          data-testid="input-copilot"
          style={{ flex: 1, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 11px", color: T.text, fontSize: 11, outline: "none" }}
        />
        <button onClick={() => ask(input)} data-testid="button-send-copilot" disabled={mut.isPending} style={{ background: T.gold, color: "#000", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── My Book: live 5500 talk-box builder ─────────────────────────────────────────
interface AccountHit {
  ein: string;
  name: string;
  plan_name?: string | null;
  state?: string | null;
  city?: string | null;
  latest_year?: number | null;
  participants: number;
  welfare_premiums: number;
  broker_commissions: number;
  admin_fees: number;
  est_annual_spend: number;
  confidence: string;
}

const BOOK_KEY = "oiq_my_book_v1";
const MAX_ACCOUNTS = 25;

function loadBook(): AccountHit[] {
  try {
    const raw = localStorage.getItem(BOOK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ACCOUNTS) : [];
  } catch {
    return [];
  }
}

const locLabel = (a: AccountHit) =>
  [a.city, a.state].filter(Boolean).join(", ") || "Location n/a";

function BookBuilderView() {
  const [book, setBook] = useState<AccountHit[]>(() => loadBook());
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 220);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOK_KEY, JSON.stringify(book));
    } catch {
      /* ignore quota / private-mode failures */
    }
  }, [book]);

  const query = debounced.trim();
  const search = useQuery<{ results: AccountHit[]; data_available: boolean }>({
    queryKey: ["/api/opportunity-os/account-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/opportunity-os/account-search?q=${encodeURIComponent(query)}`,
      );
      return res.json();
    },
  });

  const inBook = (ein: string) => book.some((a) => a.ein === ein);
  const atMax = book.length >= MAX_ACCOUNTS;

  const add = (a: AccountHit) =>
    setBook((b) => (b.some((x) => x.ein === a.ein) || b.length >= MAX_ACCOUNTS ? b : [...b, a]));
  const remove = (ein: string) => setBook((b) => b.filter((a) => a.ein !== ein));
  const clearAll = () => setBook([]);

  const totalLives = book.reduce((s, a) => s + (a.participants || 0), 0);
  const totalSpend = book.reduce((s, a) => s + (a.est_annual_spend || 0), 0);
  const freshest = book.length ? Math.max(...book.map((a) => a.latest_year || 0)) : 0;

  const results = search.data?.results ?? [];
  const dataUnavailable = search.data?.data_available === false;
  const showDropdown = focused && query.length >= 2;

  return (
    <div>
      <Panel style={{ padding: 18, marginBottom: 18 }}>
        <SectionLabel icon={<Search size={12} />}>Build Your Top 25 Book</SectionLabel>
        <div style={{ fontSize: 11, color: T.muted, margin: "2px 0 14px", lineHeight: 1.5, maxWidth: 720 }}>
          Start typing an employer name. Matches come live from the DOL Form 5500 filing universe, ranked by covered lives. Add up to 25 accounts to model your book&apos;s spend under advisement.
        </div>

        <div style={{ position: "relative", maxWidth: 640 }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color={T.muted} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 160)}
              placeholder={atMax ? "Book is full. Remove an account to add more" : "Type an account name, e.g. Marriott"}
              disabled={atMax}
              data-testid="input-account-search"
              style={{
                width: "100%", boxSizing: "border-box", background: T.surface2,
                border: `1px solid ${T.border}`, borderRadius: 10, color: T.textLight,
                padding: "12px 40px", fontSize: 13, outline: "none", opacity: atMax ? 0.5 : 1,
              }}
            />
            {search.isFetching && (
              <Loader2 size={16} color={T.gold} className="animate-spin" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }} />
            )}
          </div>

          {showDropdown && (
            <div
              data-testid="dropdown-account-results"
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
                background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
                boxShadow: "0 20px 48px rgba(0,0,0,0.6)", maxHeight: 340, overflowY: "auto",
              }}
            >
              {dataUnavailable ? (
                <div style={{ padding: 16, fontSize: 12, color: T.muted }}>Form 5500 data source is offline right now.</div>
              ) : search.isLoading ? (
                <div style={{ padding: 16, fontSize: 12, color: T.muted }}>Searching the filing universe…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: 16, fontSize: 12, color: T.muted }}>No employers match &quot;{query}&quot;.</div>
              ) : (
                results.map((a) => {
                  const already = inBook(a.ein);
                  return (
                    <button
                      key={a.ein}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => add(a)}
                      disabled={already || atMax}
                      data-testid={`result-account-${a.ein}`}
                      style={{
                        width: "100%", textAlign: "left", display: "flex", alignItems: "center",
                        gap: 12, background: "transparent", border: "none",
                        borderBottom: `1px solid ${T.border}`, padding: "11px 14px",
                        cursor: already || atMax ? "default" : "pointer",
                        opacity: already || atMax ? 0.55 : 1,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.textLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <span><MapPin size={9} style={{ verticalAlign: -1 }} /> {locLabel(a)}</span>
                          <span><Users size={9} style={{ verticalAlign: -1 }} /> {fmtNum(a.participants)} lives</span>
                          {a.latest_year && <span style={{ color: T.cyan }}>FY{a.latest_year}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>{fmt$(a.est_annual_spend)}</div>
                        <div style={{ fontSize: 9.5, color: T.muted }}>modeled spend</div>
                      </div>
                      {already ? <Check size={16} color={T.green} /> : <Plus size={16} color={atMax ? T.muted : T.gold} />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 10.5, color: atMax ? T.orange : T.muted }} data-testid="text-book-count">
          {book.length} / {MAX_ACCOUNTS} accounts selected{atMax ? " · book full" : ""}
        </div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
        <KpiTile label="Accounts In Book" value={`${book.length}`} sub={`of ${MAX_ACCOUNTS} max`} icon={<Building2 size={15} />} color={T.blue} />
        <KpiTile label="Covered Lives" value={fmtNum(totalLives)} sub="Total participants" icon={<Users size={15} />} color={T.purple} />
        <KpiTile label="Spend Under Advisement" value={fmt$(totalSpend)} sub="Modeled annual" icon={<DollarSign size={15} />} color={T.gold} />
        <KpiTile label="Data Through" value={freshest ? `FY${freshest}` : "n/a"} sub="Latest filing year" icon={<CalendarDays size={15} />} color={T.cyan} />
      </div>

      <Panel>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel icon={<BookOpen size={12} />}>My Top 25 Accounts</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TierBadge tier="MODELED" />
            {book.length > 0 && (
              <button onClick={clearAll} data-testid="button-clear-book" style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 7, padding: "5px 10px", fontSize: 10.5, cursor: "pointer" }}>
                <Trash2 size={11} /> Clear all
              </button>
            )}
          </div>
        </div>

        {book.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: T.muted }}>
            <Search size={26} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: 13, marginTop: 10, color: T.text }}>Your book is empty.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Use the talk box above to add your first account from the live Form 5500 database.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: T.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Employer</th>
                  <th style={{ textAlign: "left", padding: 8, fontWeight: 600 }}>Location</th>
                  <th style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>Lives</th>
                  <th style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>Modeled Spend</th>
                  <th style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>Broker Comp</th>
                  <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>FY</th>
                  <th style={{ padding: 8 }} />
                </tr>
              </thead>
              <tbody>
                {book.map((a, i) => (
                  <tr key={a.ein} data-testid={`row-book-${a.ein}`} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: "10px 8px", color: T.muted }}>{i + 1}</td>
                    <td style={{ padding: "10px 8px", color: T.textLight, fontWeight: 600 }}>{a.name}</td>
                    <td style={{ padding: "10px 8px", color: T.text }}>{locLabel(a)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: T.text }}>{fmtNum(a.participants)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: T.gold, fontWeight: 700 }}>{fmt$(a.est_annual_spend)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right", color: T.text }}>{fmt$(a.broker_commissions)}</td>
                    <td style={{ padding: "10px 8px", textAlign: "center", color: T.cyan }}>{a.latest_year ? `'${String(a.latest_year).slice(2)}` : "n/a"}</td>
                    <td style={{ padding: "10px 8px", textAlign: "right" }}>
                      <button onClick={() => remove(a.ein)} data-testid={`button-remove-${a.ein}`} title="Remove" style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function OpportunityOS() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [view, setView] = useState<"dashboard" | "book">("dashboard");
  const dash = useQuery<Dashboard>({ queryKey: ["/api/opportunity-os/dashboard"] });

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "calc(100vh - 56px)", padding: 24, color: T.text, fontFamily: "var(--font-sans)" }} data-testid="page-opportunity-os">
        {/* Header */}
        <div className="kiq-ops-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap", borderRadius: 24, padding: "20px 22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={20} color={T.gold} />
              <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textLight, margin: 0, letterSpacing: "-0.04em", fontFamily: "var(--font-display)" }}>Opportunity Intelligence OS</h1>
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
              Brown &amp; Brown x Kincaid Health. Where can Kincaid Health create the most measurable value across the sales organization. Every dollar figure is a modeled estimate derived from each executive's book, not real HR data.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div className="kiq-ops-control" style={{ display: "flex", background: "rgba(255,255,255,0.72)", border: `1px solid ${T.border}`, borderRadius: 999, padding: 4 }}>
              {([["dashboard", "Command Center"], ["book", "My Book"]] as const).map(([v, label]) => {
                const active = view === v && !selectedId;
                return (
                  <button
                    key={v}
                    onClick={() => { setSelectedId(null); setView(v); }}
                    data-testid={`button-view-${v}`}
                    style={{
                      background: active ? T.gold : "transparent",
                      color: active ? "#08111f" : T.text,
                      border: "none", borderRadius: 999, padding: "7px 14px",
                      fontSize: 11.5, fontWeight: 800, cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCopilotOpen(true)}
              data-testid="button-open-copilot"
              style={{ display: "flex", alignItems: "center", gap: 8, background: T.gold, color: "#08111f", border: "none", borderRadius: 999, padding: "10px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 12px 28px rgba(212,175,55,0.20)" }}
            >
              <Brain size={16} /> AI Co-Pilot
            </button>
          </div>
        </div>

        {selectedId
          ? <ExecutiveDetail id={selectedId} onBack={() => setSelectedId(null)} />
          : view === "book"
            ? <BookBuilderView />
            : <DashboardView data={dash.data} loading={dash.isLoading} onSelect={setSelectedId} />}

        {copilotOpen && <CoPilotDrawer onClose={() => setCopilotOpen(false)} />}
      </div>
    </Layout>
  );
}
