import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Target, TrendingUp, DollarSign, BarChart2, AlertTriangle,
  CheckCircle2, XCircle, Clock, ArrowRight, ChevronRight,
  Users, Building2, Zap, RefreshCw, Eye, Activity,
  AlertCircle, Award, FileSearch, Bell, BarChart3, Layers,
  TrendingDown, Shield, Star, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";

// ── Design tokens ─────────────────────────────────────────────────────────────
const GOLD   = "#FFB800";
const BLUE   = "#00D4FF";
const GREEN  = "#10B981";
const RED    = "#FF4D6D";
const PURPLE = "#A855F7";
const AMBER  = "#F59E0B";

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPIs {
  total_rfps: number;
  pipeline_count: number;
  pipeline_value: number;
  pipeline_value_fmt: string;
  forecasted_revenue: number;
  forecasted_revenue_fmt: string;
  avg_win_probability: number;
  win_rate: number;
  loss_rate: number;
  total_won: number;
  total_lost: number;
  total_closed: number;
  unread_alerts: number;
  re_engagement_count: number;
  deadlines_urgent: number;
  new_this_month: number;
  recent_won: number;
  recent_lost: number;
}

interface TopOpp {
  id: string;
  employer_name: string;
  industry: string | null;
  state: string | null;
  stage: string;
  score: number;
  score_tier: string;
  win_probability: number;
  estimated_value: number;
  estimated_value_fmt: string;
  forecasted_value: number;
  response_deadline: string | null;
  owner: string | null;
  priority: string;
}

interface ReEngagement {
  id: string;
  account_id: string | null;
  employer_name: string;
  ein: string | null;
  monitor_type: string;
  alert_count: number;
  latest_alert: string | null;
  created_at: string | null;
}

interface Alert5500 {
  id: string;
  ein: string;
  employer_name: string;
  filing_year: number;
  alert_type: string;
  summary: string;
  created_at: string | null;
}

interface Deadline {
  id: string;
  employer_name: string;
  deadline: string;
  days_left: number;
  stage: string;
  owner: string | null;
  priority: string;
}

interface ConsultantRanking {
  name: string;
  title: string | null;
  firm: string;
  role: string;
  opp_count: number;
}

interface ForecastTierEntry {
  count: number;
  value: number;
  forecasted: number;
  win_prob_pct: number;
}

interface CommandCenterData {
  kpis: KPIs;
  stage_distribution: Record<string, number>;
  top_opportunities: TopOpp[];
  re_engagement: ReEngagement[];
  form5500_alerts: Alert5500[];
  deadlines: Deadline[];
  consultant_rankings: ConsultantRanking[];
  forecast_method: {
    formula: string;
    tier_probs: Record<string, number>;
    basis: string;
    confidence: string;
    tier_breakdown: Record<string, ForecastTierEntry>;
  };
  win_loss_recent: any[];
  generated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function tierColor(tier: string): string {
  if (tier === "pursue_aggressively") return GREEN;
  if (tier === "pursue_selectively")  return BLUE;
  if (tier === "monitor")             return AMBER;
  return RED;
}

function tierLabel(tier: string): string {
  if (tier === "pursue_aggressively") return "Pursue";
  if (tier === "pursue_selectively")  return "Selective";
  if (tier === "monitor")             return "Monitor";
  return "Decline";
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    new: "New", qualifying: "Qualifying", drafting: "Drafting",
    submitted: "Submitted", decision: "Decision", won: "Won", lost: "Lost",
    no_bid: "No Bid", reviewing: "Reviewing", scoring: "Scoring",
    proposal: "Proposal", prospect: "Prospect", qualified: "Qualified",
    negotiation: "Negotiation",
  };
  return map[stage] || stage;
}

function priorityColor(priority: string): string {
  if (priority === "high")   return RED;
  if (priority === "medium") return AMBER;
  return BLUE;
}

function daysColor(days: number): string {
  if (days <= 3)  return RED;
  if (days <= 7)  return AMBER;
  if (days <= 14) return GOLD;
  return GREEN;
}

// ── Pulse dot ────────────────────────────────────────────────────────────────
function Pulse({ color }: { color: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%", background: color,
        display: "block",
        boxShadow: `0 0 0 0 ${color}`,
        animation: "pulse-ring 2s ease-out infinite",
      }} />
    </span>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  icon: Icon, label, value, sub, color, trend, onClick,
}: {
  icon: any; label: string; value: string | number; sub?: string;
  color: string; trend?: "up" | "down" | "flat"; onClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -1 }}
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.62) 100%)",
        border: `1px solid ${color}30`,
        borderRadius: 16,
        padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        overflow: "hidden",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 48px rgba(15,23,42,0.08)",
        backdropFilter: "blur(18px)",
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at top left, ${color}08 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, position: "relative" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: `${color}18`, flexShrink: 0,
        }}>
          <Icon size={16} color={color} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{sub}</div>}
        </div>
        {trend && trend !== "flat" && (
          <div style={{ color: trend === "up" ? GREEN : RED }}>
            {trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, color, badge }: { icon: any; title: string; color: string; badge?: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <Icon size={15} color={color} strokeWidth={1.8} />
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase", color }}>{title}</span>
      {badge !== undefined && badge !== 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700, background: `${color}20`,
          border: `1px solid ${color}40`, borderRadius: 4,
          padding: "1px 6px", color,
        }}>{badge}</span>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "24px 16px",
      color: "rgba(15,23,42,0.08)", fontSize: 12,
      border: "1px dashed #e2e8f0", borderRadius: 8,
    }}>{message}</div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RfpCommandCenter() {
  const [, setLocation] = useLocation();
  const [showForecastMethod, setShowForecastMethod] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<CommandCenterData>({
    queryKey: ["/api/rfp/command-center"],
    refetchInterval: 60_000,
  });

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    padding: "18px 20px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 52px rgba(15,23,42,0.08)",
    backdropFilter: "blur(20px)",
  };

  const STAGE_COLORS: Record<string, string> = {
    new: "#888", qualifying: BLUE, drafting: PURPLE,
    submitted: AMBER, decision: GOLD, reviewing: BLUE,
    scoring: PURPLE, proposal: AMBER, prospect: "#888",
    qualified: GREEN, negotiation: GOLD,
  };

  // Build stage distribution chart data
  const stageDist = data?.stage_distribution || {};
  const stageChartData = Object.entries(stageDist).map(([s, c]) => ({
    stage: stageLabel(s), count: c, color: STAGE_COLORS[s] || "#888",
  }));

  // Forecast tier chart data
  const tierBreakdown = data?.forecast_method.tier_breakdown || {};
  const tierChartData = Object.entries(tierBreakdown).map(([tier, entry]) => ({
    tier: tierLabel(tier),
    forecasted: Math.round((entry as ForecastTierEntry).forecasted / 1000),
    color: tierColor(tier),
  })).filter(d => d.forecasted > 0);

  return (
    <Layout>
      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 currentColor; }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .cmd-row-hover:hover { background: rgba(255,255,255,0.82) !important; box-shadow: 0 10px 26px rgba(15,23,42,0.07); }
      `}</style>

      <div className="kiq-ops-shell" style={{
        minHeight: "calc(100vh - 56px)",
        padding: "28px 32px",
        fontFamily: "'Inter', sans-serif",
      }}>

        {/* ── Header ── */}
        <div className="kiq-ops-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, borderRadius: 24, padding: "20px 22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Target size={20} color={GOLD} strokeWidth={1.8} />
              <span style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.035em" }}>
                RFP Executive Command Center
              </span>
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: "0.14em",
                textTransform: "uppercase", color: GOLD,
                background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.3)",
                borderRadius: 4, padding: "2px 6px", marginLeft: 4,
              }}>LIVE</span>
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Kincaid Health · Leadership intelligence · {data ? new Date(data.generated_at).toLocaleString() : "—"}
            </div>
          </div>
          <button
            onClick={() => refetch()}
            data-testid="button-refresh-command-center"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.72)", border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 8, padding: "7px 14px", color: "#1e293b",
              fontSize: 12, cursor: "pointer",
            }}
          >
            <RefreshCw size={13} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#64748b", gap: 10 }}>
            <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
            Loading command center…
          </div>
        ) : !data ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: 60 }}>
            No data available. Ingest your first RFP to activate the Command Center.
          </div>
        ) : (
          <>
            {/* ── Row 1: KPI Tiles (9 tiles, first row 5 / second row 4) ── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 12, marginBottom: 12,
            }}>
              <KpiTile icon={FileSearch}   label="Total RFPs"        value={data.kpis.total_rfps}              color={BLUE}   sub={`${data.kpis.new_this_month} new this month`} />
              <KpiTile icon={Layers}       label="Pipeline"          value={data.kpis.pipeline_value_fmt}       color={GOLD}   sub={`${data.kpis.pipeline_count} active opps`}    trend="up" />
              <KpiTile icon={TrendingUp}   label="Forecasted Rev."   value={data.kpis.forecasted_revenue_fmt}   color={GREEN}  sub={`${data.kpis.avg_win_probability.toFixed(1)}% avg win prob`} trend="up" onClick={() => setShowForecastMethod(v => !v)} />
              <KpiTile icon={CheckCircle2} label="Win Rate"          value={`${data.kpis.win_rate}%`}           color={data.kpis.win_rate >= 50 ? GREEN : AMBER} sub={`${data.kpis.total_won} won of ${data.kpis.total_closed} closed`} trend={data.kpis.win_rate >= 50 ? "up" : "flat"} />
              <KpiTile icon={XCircle}      label="Loss Rate"         value={`${data.kpis.loss_rate}%`}          color={data.kpis.loss_rate > 50 ? RED : AMBER} sub={`${data.kpis.total_lost} lost of ${data.kpis.total_closed} closed`} trend={data.kpis.loss_rate > 50 ? "down" : "flat"} />
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12, marginBottom: 20,
            }}>
              <KpiTile icon={AlertTriangle} label="Urgent Deadlines" value={data.kpis.deadlines_urgent}        color={data.kpis.deadlines_urgent > 0 ? RED : GREEN} sub="Due ≤7 days" />
              <KpiTile icon={Bell}         label="Unread Alerts"     value={data.kpis.unread_alerts}            color={data.kpis.unread_alerts > 0 ? AMBER : GREEN} sub="5500 + monitoring" />
              <KpiTile icon={RefreshCw}    label="Re-engagement"     value={data.kpis.re_engagement_count}      color={PURPLE} sub="monitored accounts" />
              <KpiTile icon={Users}        label="Won (30d)"         value={data.kpis.recent_won}               color={GREEN}  sub={`${data.kpis.recent_lost} lost`} trend={data.kpis.recent_won > data.kpis.recent_lost ? "up" : "flat"} />
            </div>

            {/* ── Forecasted Revenue Method (expandable) ── */}
            <AnimatePresence>
              {showForecastMethod && (
                <motion.div
                  key="forecast-method"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden", marginBottom: 16 }}
                >
                  <div style={{
                    ...card,
                    border: `1px solid ${GREEN}30`,
                    background: `rgba(16,185,129,0.04)`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Eye size={13} color={GREEN} />
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: GREEN }}>Forecast Method — Transparent Calculation</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
                        background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)",
                        borderRadius: 3, padding: "1px 5px", color: GREEN, textTransform: "uppercase",
                      }}>MODELED</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#334155", marginBottom: 10, fontFamily: "monospace" }}>
                      {data.forecast_method.formula}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                      {Object.entries(data.forecast_method.tier_breakdown).map(([tier, entry]) => {
                        const e = entry as ForecastTierEntry;
                        return (
                          <div key={tier} style={{
                            background: "#ffffff",
                            border: `1px solid ${tierColor(tier)}25`,
                            borderRadius: 8, padding: "10px 12px",
                          }}>
                            <div style={{ fontSize: 10, color: tierColor(tier), fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{tierLabel(tier)}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{e.count} opps</div>
                            <div style={{ fontSize: 11, color: "#475569" }}>{e.win_prob_pct}% win prob</div>
                            <div style={{ fontSize: 12, color: GREEN, fontWeight: 600, marginTop: 2 }}>
                              ${Math.round(e.forecasted / 1000)}K forecast
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {data.forecast_method.basis}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Row 2: Top Opportunities + Pipeline Distribution ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>

              {/* Top Opportunities */}
              <div style={card}>
                <SectionHeader icon={Star} title="Top Strategic Opportunities" color={GOLD} badge={data.top_opportunities.length} />
                {data.top_opportunities.length === 0 ? (
                  <EmptyState message="No pipeline opportunities yet. Ingest an RFP to get started." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {data.top_opportunities.map((opp, i) => (
                      <motion.div
                        key={opp.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="cmd-row-hover"
                        onClick={() => setLocation(`/rfp-intelligence?tab=pipeline&opp=${opp.id}`)}
                        data-testid={`row-opp-${opp.id}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "28px 1fr auto auto auto",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        {/* Rank */}
                        <div style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: i < 3 ? `${GOLD}20` : "#f8fafc",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700,
                          color: i < 3 ? GOLD : "#64748b",
                        }}>#{i + 1}</div>

                        {/* Name + meta */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {opp.employer_name}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {[opp.industry, opp.state].filter(Boolean).join(" · ")} · {stageLabel(opp.stage)}
                          </div>
                        </div>

                        {/* Score */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: tierColor(opp.score_tier),
                            background: `${tierColor(opp.score_tier)}15`,
                            border: `1px solid ${tierColor(opp.score_tier)}30`,
                            borderRadius: 4, padding: "2px 6px",
                          }}>{opp.score}/100</div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{opp.win_probability}% win</div>
                        </div>

                        {/* Value */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{opp.estimated_value_fmt}</div>
                          <div style={{ fontSize: 10, color: GREEN }}>${Math.round(opp.forecasted_value / 1000)}K fcst</div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={13} color="#94a3b8" />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pipeline Distribution */}
              <div style={card}>
                <SectionHeader icon={BarChart3} title="Pipeline Distribution" color={BLUE} />
                {stageChartData.length === 0 ? (
                  <EmptyState message="No pipeline data yet." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={stageChartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }} barSize={16}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                        <XAxis dataKey="stage" tick={{ fontSize: 9, fill: "#475569" }} />
                        <YAxis tick={{ fontSize: 9, fill: "#475569" }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => [`${v} opps`, "Count"]}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {stageChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Stage legend */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                      {stageChartData.slice(0, 5).map(({ stage, count, color }) => (
                        <div key={stage} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                            <span style={{ fontSize: 11, color: "#334155" }}>{stage}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#0F172A" }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Row 3: Deadlines + Re-engagement + Alerts ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>

              {/* Urgent Deadlines */}
              <div style={card}>
                <SectionHeader icon={Clock} title="Urgent Deadlines" color={RED} badge={data.deadlines.length} />
                {data.deadlines.length === 0 ? (
                  <EmptyState message="No deadlines in the next 21 days." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.deadlines.map((d) => (
                      <motion.div
                        key={d.id}
                        whileHover={{ x: 2 }}
                        className="cmd-row-hover"
                        onClick={() => setLocation(`/rfp-intelligence?tab=pipeline&opp=${d.id}`)}
                        data-testid={`row-deadline-${d.id}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 8px", borderRadius: 7, cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        <div style={{
                          minWidth: 40, height: 40, borderRadius: 8,
                          background: `${daysColor(d.days_left)}15`,
                          border: `1px solid ${daysColor(d.days_left)}30`,
                          display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: daysColor(d.days_left), lineHeight: 1 }}>{d.days_left}</span>
                          <span style={{ fontSize: 8, color: "#475569", textTransform: "uppercase" }}>days</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.employer_name}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{stageLabel(d.stage)} · {d.owner || "Unassigned"}</div>
                        </div>
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: priorityColor(d.priority),
                        }} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Re-engagement Queue */}
              <div style={card}>
                <SectionHeader icon={RefreshCw} title="Re-engagement Queue" color={PURPLE} badge={data.re_engagement.length} />
                {data.re_engagement.length === 0 ? (
                  <EmptyState message="No re-engagement accounts monitored yet." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.re_engagement.map((r) => (
                      <motion.div
                        key={r.id}
                        whileHover={{ x: 2 }}
                        className="cmd-row-hover"
                        onClick={() => setLocation(`/rfp-intelligence?tab=watchlist${r.ein ? `&ein=${r.ein}` : ""}`)}
                        data-testid={`row-reeng-${r.id}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 8px", borderRadius: 7, cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: "rgba(168,85,247,0.12)",
                          border: "1px solid rgba(168,85,247,0.25)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Building2 size={14} color={PURPLE} strokeWidth={1.8} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.employer_name}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>
                            {r.monitor_type.replace("_", " ")}
                            {r.latest_alert && ` · ${r.latest_alert.slice(0, 32)}…`}
                          </div>
                        </div>
                        {r.alert_count > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700,
                            background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)",
                            borderRadius: 4, padding: "1px 5px", color: PURPLE,
                          }}>{r.alert_count}</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form 5500 Alerts */}
              <div style={card}>
                <SectionHeader icon={Bell} title="Form 5500 Alerts" color={AMBER} badge={data.form5500_alerts.length} />
                {data.form5500_alerts.length === 0 ? (
                  <EmptyState message="No new 5500 filing alerts. Add employers to your watchlist." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.form5500_alerts.map((a) => (
                      <motion.div
                        key={a.id}
                        whileHover={{ x: 2 }}
                        className="cmd-row-hover"
                        onClick={() => setLocation(`/rfp-intelligence?tab=watchlist&ein=${a.ein}`)}
                        data-testid={`row-alert-${a.id}`}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 8,
                          padding: "7px 8px", borderRadius: 7, cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        <AlertCircle size={14} color={AMBER} style={{ marginTop: 2, flexShrink: 0 }} strokeWidth={1.8} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.employer_name}</div>
                          <div style={{ fontSize: 10, color: "#475569" }}>{a.summary} · FY{a.filing_year}</div>
                        </div>
                        <Pulse color={AMBER} />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 4: Consultant Rankings + Forecast Chart ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 16 }}>

              {/* Consultant / Broker Influence Rankings */}
              <div style={card}>
                <SectionHeader icon={Award} title="Consultant Influence Rankings" color={GOLD} />
                {data.consultant_rankings.length === 0 ? (
                  <EmptyState message="No consultant/broker contacts recorded yet. Add contacts to opportunities to build influence data." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {data.consultant_rankings.map((c, i) => (
                      <div
                        key={c.name}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "28px 1fr auto",
                          alignItems: "center",
                          gap: 10, padding: "8px 10px", borderRadius: 7,
                        }}
                      >
                        <div style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: i < 3 ? `${GOLD}20` : "#f8fafc",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700,
                          color: i < 3 ? GOLD : "#64748b",
                        }}>#{i + 1}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{c.firm} · {c.role}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{c.opp_count} opp{c.opp_count !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Forecasted Revenue by Tier */}
              <div style={card}>
                <SectionHeader icon={TrendingUp} title="Forecast by Scoring Tier" color={GREEN} />
                {tierChartData.length === 0 ? (
                  <EmptyState message="Score your opportunities to populate the forecast chart." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={tierChartData} margin={{ top: 4, right: 4, left: -10, bottom: 4 }} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                        <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "#475569" }} />
                        <YAxis tick={{ fontSize: 9, fill: "#475569" }} unit="K" />
                        <Tooltip
                          contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => [`$${v}K`, "Forecasted"]}
                        />
                        <Bar dataKey="forecasted" radius={[5, 5, 0, 0]}>
                          {tierChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} fillOpacity={0.9} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Total Forecasted</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: GREEN }}>{data.kpis.forecasted_revenue_fmt}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>Pipeline Value</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{data.kpis.pipeline_value_fmt}</span>
                      </div>
                      <div style={{
                        marginTop: 8,
                        fontSize: 10, color: "#64748b",
                        fontStyle: "italic",
                      }}>
                        Click "Forecasted Rev." tile above to view calculation method.
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Row 5: Recent Win/Loss ── */}
            {data.win_loss_recent.length > 0 && (
              <div style={card}>
                <SectionHeader icon={Activity} title="Recent Win / Loss Outcomes" color={BLUE} badge={data.win_loss_recent.length} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {data.win_loss_recent.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: "10px 12px",
                        background: r.outcome === "won" ? "rgba(16,185,129,0.06)" : "rgba(255,77,109,0.06)",
                        border: `1px solid ${r.outcome === "won" ? GREEN : RED}20`,
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        {r.outcome === "won"
                          ? <CheckCircle2 size={13} color={GREEN} />
                          : <XCircle size={13} color={RED} />}
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.outcome === "won" ? GREEN : RED, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          {r.outcome}
                        </span>
                      </div>
                      {r.contract_value && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                          ${(r.contract_value / 1000).toFixed(0)}K
                        </div>
                      )}
                      {r.winning_competitor && (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>vs {r.winning_competitor}</div>
                      )}
                      {r.decision_date && (
                        <div style={{ fontSize: 10, color: "rgba(15,23,42,0.08)", marginTop: 2 }}>{r.decision_date}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{
              marginTop: 24, padding: "12px 0",
              borderTop: "1px solid #f1f5f9",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                All forecast figures are MODELED — tier-based win-probability, not actuarial data.
              </span>
              <button
                onClick={() => setLocation("/rfp-intelligence")}
                data-testid="button-goto-rfp-intelligence"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.25)",
                  borderRadius: 7, padding: "7px 14px", color: GOLD,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                Open RFP Intelligence OS <ArrowRight size={12} />
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
