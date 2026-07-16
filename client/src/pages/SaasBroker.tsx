import { ProspectsView } from "./BrokerProspects";
import { AccountBriefView, PipelineView, ApiRegistryView, BenchmarkView, IngestLogView } from "./SalesOS";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Layout } from "@/components/Layout";
import {
  Building2, Users, Calendar, AlertTriangle, TrendingUp, FileText,
  ChevronRight, Search, Pill, Activity, CheckCircle2, Clock, Circle,
  Upload, Star, Zap, Shield, BarChart3, Bell, ArrowUpRight,
  ArrowDownRight, Minus, LayoutDashboard, BookOpen, Briefcase,
  RefreshCw, Download, Plus, MapPin, Calculator
} from "lucide-react";

/* ─── TYPES ─────────────────────────────────────────────────────────────── */
interface Client {
  id: string; name: string; industry: string; employees: number;
  annual_spend: number; plan_type: string; tpa: string; pbm: string;
  sl_carrier: string; renewal_date: string; city: string; state: string;
  risk_score: number; health_score: number; tier: "platinum" | "gold" | "silver";
  status: string; pmpm: number; mlr: number; yoy_trend: number;
  rx_status: "none" | "pending" | "analyzed"; rx_score: number | null;
  sl_status: "none" | "pending" | "analyzed"; sl_score: number | null;
  open_actions: number; docs_uploaded: number; docs_required: number;
  days_to_renewal: number; notes: string;
  contact_name: string; contact_title: string; contact_email: string;
  timeline?: TimelineStage[]; documents?: Document[];
}
interface TimelineStage {
  id: number; label: string; trigger: number; owner: string;
  description: string; status: "complete" | "active" | "pending";
}
interface Document {
  id: string; name: string; type: string; size: string;
  uploaded: string; status: string; score: number | null;
}
interface ActivityItem { time: string; type: string; client: string; msg: string }
interface DashboardData {
  broker: { name: string; firm: string; title: string; account: string };
  summary: Record<string, number>;
  clients: Client[];
  revenue_trend: { month: string; commission: number }[];
  risk_distribution: { band: string; count: number; pct: number }[];
  activity_feed: ActivityItem[];
}

/* ─── PALETTE ────────────────────────────────────────────────────────────── */
const GOLD   = "#FFB800";
const BLUE   = "#00D4FF";
const GREEN  = "#00FF94";
const RED    = "#FF4D6D";
const ORANGE = "#FF6B1A";
const PURPLE = "#A855F7";

/* ─── TICKER DATA ────────────────────────────────────────────────────────── */
const BASE_TICKERS = [
  { label: "EST. PORTFOLIO PREMIUM", value: "$56.8M", delta: "+3.2%", up: true },
  { label: "ACTIVE ACCOUNTS", value: "10", delta: "1 prospect", up: null },
  { label: "AVG PMPM", value: "$821", delta: "+$14", up: true },
  { label: "AVG MLR", value: "83.2%", delta: "-0.8%", up: true },
  { label: "RX FIDUCIARY AVG", value: "55/100", delta: "2 critical", up: false },
  { label: "STOP-LOSS AVG", value: "64/100", delta: "+8 pts", up: true },
  { label: "RENEWALS ≤30d", value: "2", delta: "URGENT", up: false },
  { label: "RENEWALS ≤60d", value: "4", delta: "ATTENTION", up: null },
  { label: "PENDING UPLOADS", value: "6 docs", delta: "3 clients", up: false },
  { label: "OPEN ACTIONS", value: "21", delta: "across book", up: null },
  { label: "CAA 2026 COMPLIANCE", value: "REQUIRED", delta: "Q2 2026", up: null },
  { label: "SPREAD PRICING FLAGS", value: "3 clients", delta: "HIGH EXPOSURE", up: false },
  { label: "AGGREGATE RISK", value: "2 plans", delta: "≥85% MLR", up: false },
  { label: "EST. NEGOTIATION ROI", value: "$4.1M", delta: "portfolio", up: true },
  { label: "KINCAID HEALTH™", value: "LIVE", delta: "v2026.1", up: null },
];

/* ─── TICKER BAR ─────────────────────────────────────────────────────────── */
function TickerBar() {
  const [ticks, setTicks] = useState(BASE_TICKERS);
  const [offset, setOffset] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setOffset(o => o - 1);
    }, 24);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!tickerRef.current) return;
    const w = tickerRef.current.scrollWidth / 2;
    if (Math.abs(offset) >= w) setOffset(0);
  }, [offset]);

  const items = [...ticks, ...ticks];

  return (
    <div style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.72) 50%, rgba(255,255,255,0.92) 100%)", borderBottom: "1px solid rgba(15,23,42,0.08)", overflow: "hidden",
      height: 36, display: "flex", alignItems: "center", position: "relative" }}>
      {/* Gradient fade edges */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 60, zIndex: 2,
        background: "linear-gradient(90deg, rgba(255,255,255,0.98) 0%, transparent 100%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 60, zIndex: 2,
        background: "linear-gradient(270deg, rgba(255,255,255,0.98) 0%, transparent 100%)", pointerEvents: "none" }} />

      <div ref={tickerRef} style={{ display: "flex", alignItems: "center", gap: 0,
        transform: `translateX(${offset}px)`, whiteSpace: "nowrap", willChange: "transform" }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 24px",
            borderRight: "1px solid rgba(15,23,42,0.08)" }}>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase" }}>
              {t.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 900, color: GOLD }}>{t.value}</span>
            {t.delta && (
              <span style={{ fontSize: 9, fontWeight: 700,
                color: t.up === true ? GREEN : t.up === false ? RED : "#64748b" }}>
                {t.up === true ? "▲" : t.up === false ? "▼" : "●"} {t.delta}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}
function fmtDate(s: string): string {
  try { return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return s; }
}

type TierKey = "platinum" | "gold" | "silver";
const TIER_CFG: Record<TierKey, { color: string; bg: string; border: string }> = {
  platinum: { color: BLUE,   bg: "rgba(0,212,255,0.08)",  border: "rgba(0,212,255,0.2)"  },
  gold:     { color: GOLD,   bg: "rgba(255,184,0,0.08)",  border: "rgba(255,184,0,0.2)"  },
  silver:   { color: "#aaa", bg: "rgba(180,180,180,0.08)", border: "rgba(180,180,180,0.2)" },
};

function UrgencyChip({ days }: { days: number }) {
  if (days <= 30)  return <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(255,77,109,0.15)", color: RED,    border: `1px solid ${RED}30`,    borderRadius: 4, padding: "1px 6px", letterSpacing: "0.1em" }}>URGENT</span>;
  if (days <= 60)  return <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(255,107,26,0.12)", color: ORANGE, border: `1px solid ${ORANGE}30`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.1em" }}>ATTENTION</span>;
  if (days <= 90)  return <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(255,184,0,0.12)", color: GOLD,   border: `1px solid ${GOLD}30`,   borderRadius: 4, padding: "1px 6px", letterSpacing: "0.1em" }}>MONITOR</span>;
  return <span style={{ fontSize: 9, fontWeight: 900, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 4, padding: "1px 6px", letterSpacing: "0.1em" }}>TRACKING</span>;
}

function StatusDot({ status }: { status: "analyzed" | "pending" | "none" | string }) {
  const color = status === "analyzed" ? GREEN : status === "pending" ? GOLD : "#cbd5e1";
  return (
    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color,
      boxShadow: status === "pending" ? `0 0 6px ${GOLD}` : status === "analyzed" ? `0 0 6px ${GREEN}` : "none" }} />
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 75 ? GREEN : score >= 55 ? GOLD : score >= 35 ? ORANGE : RED;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 60, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 900, color }}>{score}</span>
    </div>
  );
}

/* ─── ACTIVITY FEED ──────────────────────────────────────────────────────── */
function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const TYPE_CFG: Record<string, { color: string; icon: typeof Zap }> = {
    analysis:  { color: BLUE,   icon: BarChart3  },
    upload:    { color: PURPLE, icon: Upload      },
    alert:     { color: RED,    icon: AlertTriangle },
    milestone: { color: GREEN,  icon: CheckCircle2  },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item, i) => {
        const cfg = TYPE_CFG[item.type] || TYPE_CFG.milestone;
        const Icon = cfg.icon;
        return (
          <div key={i} style={{ display: "flex", gap: 10, padding: "11px 0",
            borderBottom: i < items.length - 1 ? "1px solid #f8fafc" : "none" }}>
            <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, display: "flex",
              alignItems: "center", justifyContent: "center", background: `${cfg.color}12`,
              border: `1px solid ${cfg.color}25`, marginTop: 1 }}>
              <Icon style={{ width: 11, height: 11, color: cfg.color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>{item.msg}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                <span style={{ color: GOLD, fontWeight: 700 }}>{item.client}</span> · {item.time}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── COMMAND CENTER HERO ─────────────────────────────────────────────────── */
function CommandCenterHero({ data, onWarRoom }: { data: DashboardData; onWarRoom: () => void }) {
  const s = data.summary;
  const urgent = data.clients.filter(c => c.days_to_renewal <= 30);
  const rxContracts   = data.clients.filter(c => c.rx_status === "analyzed" || c.rx_status === "pending").length;
  const slFiles       = data.clients.filter(c => c.sl_status === "analyzed" || c.sl_status === "pending").length;
  const bestOpening   = urgent[0]
    ? `${urgent[0].name} renews in ${urgent[0].days_to_renewal} days and shows the highest renewal-window disruption opportunity in your book.`
    : "Your book is stable. Best opportunity this week: stop-loss readiness plus Rx contract governance for Tennessee manufacturing groups.";
  const bestAngle     = urgent[0]?.notes
    || "Lead with stop-loss aggregate analysis and Rx spread-pricing evidence — strongest CFO-level disruption angle in the current market.";

  const quickStats = [
    { label: "Live Accounts",     value: String(s.total_clients)  },
    { label: "Rx Contracts",      value: String(rxContracts)       },
    { label: "Stop-Loss Files",   value: String(slFiles)           },
    { label: "Action Queue",      value: String(s.open_actions), highlight: true },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.55fr 0.9fr", gap: 16, marginBottom: 24 }}>
      {/* Left — welcome card */}
      <div style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        border: "1px solid rgba(2,132,199,0.15)", borderRadius: 20, padding: "26px 28px", position: "relative", overflow: "hidden",
        boxShadow: "0 10px 25px -5px rgba(2,132,199,0.05), inset 0 0 60px rgba(255,255,255,0.4)" }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(2,132,199,0.06) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -40, width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(3,105,161,0.04) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: "#0369a1", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
          <span>✦</span> Kincaid Health™ Broker Command Center
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#0F172A", lineHeight: 1.2, marginBottom: 8 }}>
          Good morning, Jeremiah.
        </div>
        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6, maxWidth: 520, marginBottom: 20 }}>
          Your book is active, your renewal windows are tightening, and {s.open_actions} accounts need stewardship action this week.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {quickStats.map(q => (
            <div key={q.label} style={{ borderRadius: 14,
              border: `1px solid ${q.highlight ? "rgba(212,175,55,0.3)" : "rgba(2,132,199,0.15)"}`,
              background: "#ffffff",
              padding: "12px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 9, color: q.highlight ? "#d97706" : "#0284c7", marginBottom: 6, letterSpacing: "0.06em", fontWeight: 800 }}>{q.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: q.highlight ? "#d97706" : "#0284c7" }}>{q.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Broker Intelligence card */}
      <div style={{ background: "linear-gradient(145deg, rgba(251,191,36,0.06) 0%, rgba(249,115,22,0.02) 100%)",
        border: "1px solid rgba(251,191,36,0.25)", borderRadius: 20, padding: "22px 22px", display: "flex", flexDirection: "column", gap: 14,
        boxShadow: "0 10px 25px -5px rgba(251,191,36,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>Broker Intelligence</div>
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 5, padding: "2px 7px", textTransform: "uppercase" }}>Live</span>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 12, padding: "13px 15px", fontSize: 12, color: "#334155", lineHeight: 1.65, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          {bestOpening}
        </div>
        <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 12, padding: "13px 15px", fontSize: 12, color: "#334155", lineHeight: 1.65, boxShadow: "0 2px 6px rgba(0,0,0,0.02)" }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d97706" }}>Best Opening Angle</span><br />
          {bestAngle}
        </div>
        <div style={{ background: "rgba(2,132,199,0.04)", border: "1px solid rgba(2,132,199,0.15)", borderRadius: 12, padding: "13px 15px", fontSize: 12, color: "#334155", lineHeight: 1.65 }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#0284c7" }}>Tennessee Whitespace Signal</span><br />
          Prospect cluster detected in Middle Tennessee logistics corridor — 4 self-funded employers over 250 lives with no incumbent stop-loss broker visibility.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onWarRoom} data-testid="launch-war-room"
            style={{ flex: 1, padding: "10px", borderRadius: 12, fontSize: 11, fontWeight: 900, cursor: "pointer",
              background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)", border: "none", color: "#ffffff", boxShadow: "0 4px 10px rgba(217,119,6,0.2)" }}>
            Launch Renewal War Room
          </button>
          <button data-testid="upload-contract-batch"
            style={{ padding: "10px 14px", borderRadius: 12, fontSize: 11, fontWeight: 900, cursor: "pointer",
              background: "#ffffff", border: "1px solid #cbd5e1", color: "#475569",
              display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
            <Upload style={{ width: 12, height: 12 }} /> Batch Upload
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── LIVE MARKET BOARD ──────────────────────────────────────────────────── */
function LiveMarketBoard({ clients }: { clients: Client[] }) {
  const alerts = clients.filter(c => c.days_to_renewal <= 30 || c.risk_score >= 8).length;
  const renewalLoad = clients.filter(c => c.days_to_renewal <= 90).length;
  const panels = [
    { label: "Rx Trend",          value: "+4.8%",                 sub: "PBM rebate yield",         color: GREEN  },
    { label: "Stop-Loss Market",  value: "Firming",               sub: "Moderate rate hardening",  color: GOLD   },
    { label: "Renewal Load",      value: `${renewalLoad} Active`, sub: "inside 90-day window",     color: BLUE   },
    { label: "Critical Alerts",   value: `${alerts} Critical`,    sub: "requires immediate action", color: RED    },
  ];
  return (
    <div style={{ background: `linear-gradient(135deg, ${BLUE}07 0%, ${PURPLE}05 100%)`, border: `1px solid ${BLUE}28`, borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: BLUE, marginBottom: 14 }}>Live Market Board</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {panels.map(p => (
          <div key={p.label} style={{ background: `linear-gradient(135deg, ${p.color}12 0%, rgba(0,0,0,0.2) 100%)`,
              border: `1px solid ${p.color}35`, borderRadius: 12, padding: "13px 14px",
              boxShadow: `0 0 16px ${p.color}12` }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: `${p.color}90`, marginBottom: 6, letterSpacing:"0.08em" }}>{p.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: p.color, textShadow: `0 0 12px ${p.color}55` }}>{p.value}</div>
            <div style={{ fontSize: 9, color: "#475569", marginTop: 3 }}>{p.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── DASHBOARD TAB ──────────────────────────────────────────────────────── */
function DashboardTab({ data, onSelectClient }: { data: DashboardData; onSelectClient: (id: string) => void }) {
  const s = data.summary;
  const urgentClients = data.clients.filter(c => c.days_to_renewal <= 60).slice(0, 4);

  const statCards = [
    { label: "Total Clients",        value: s.total_clients,    sub: `${s.active_clients} active`,                    color: BLUE,   icon: Users },
    { label: "Portfolio Premium",     value: fmtMoney(s.total_premium_bor), sub: `${s.avg_pmpm.toFixed(0)} avg PMPM`, color: GOLD,   icon: TrendingUp },
    { label: "Renewals Next 30d",     value: s.renewals_30d,    sub: `${s.renewals_60d} in 60d`,                      color: RED,    icon: Calendar },
    { label: "Pending Documents",     value: s.pending_docs,    sub: `${s.pending_analysis} pending analysis`,        color: ORANGE, icon: FileText },
    { label: "Open Action Items",     value: s.open_actions,    sub: "across portfolio",                              color: PURPLE, icon: Zap },
    { label: "Avg Account Health",    value: `${s.avg_health_score}`,  sub: "0–100 composite",                        color: GREEN,  icon: Shield },
  ];

  return (
    <div>
      <CommandCenterHero data={data} onWarRoom={() => onSelectClient(urgentClients[0]?.id || data.clients[0]?.id)} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
      {/* Left column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {statCards.map(({ label, value, sub, color, icon: Icon }) => (
            <div key={label} data-testid={`broker-stat-${label.toLowerCase().replace(/\s+/g,"-")}`}
              style={{ background: `linear-gradient(135deg, ${color}0E 0%, rgba(0,0,0,0.2) 100%)`,
                border: `1px solid ${color}35`, borderRadius: 16,
                padding: "18px 20px", cursor: "default", position: "relative", overflow: "hidden",
                boxShadow: `0 0 24px ${color}12` }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%",
                background: `radial-gradient(circle, ${color}28 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${color}25`, border: `1px solid ${color}55`, boxShadow: `0 0 10px ${color}20` }}>
                  <Icon style={{ width: 13, height: 13, color }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b" }}>{label}</span>
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Workflow cards */}
        {(() => {
          const totalDocs    = data.clients.reduce((sum, c) => sum + (c.docs_uploaded || 0), 0);
          const openMilestones = data.clients.reduce((sum, c) => sum + (c.open_actions || 0), 0) * 3;
          const wfCards = [
            { label: "Document Vault",      value: `${totalDocs}`,       sub: "active PDFs across book",     color: BLUE,   icon: FileText      },
            { label: "Renewal Milestones",  value: `${openMilestones}`,  sub: "open service stages",         color: GOLD,   icon: Calendar      },
            { label: "Indiana Prospects",   value: "1,100+",             sub: "recommended targets",         color: GREEN,  icon: MapPin        },
            { label: "Concierge Tasks",     value: `${data.summary.open_actions}`, sub: "white-glove actions", color: PURPLE, icon: Zap          },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {wfCards.map(({ label, value, sub, color, icon: Icon }) => (
                <div key={label} style={{ background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.15) 100%)`,
                    border: `1px solid ${color}40`, borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
                    boxShadow: `0 0 18px ${color}10` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${color}25`, border: `1px solid ${color}55`, boxShadow: `0 0 10px ${color}25`, flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Actuarial Engine IQ™ Spotlight Card ────────────────────────────── */}
        <div style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(92,172,255,0.06) 50%, rgba(0,0,0,0.1) 100%)",
          border: "1px solid rgba(0,212,255,0.28)", borderRadius: 18, padding: "20px 24px",
          display: "flex", alignItems: "center", gap: 24, boxShadow: "0 0 32px rgba(0,212,255,0.08)" }}>
          {/* Icon */}
          <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 16, display: "flex", alignItems: "center",
            justifyContent: "center", background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
            boxShadow: "0 0 16px rgba(0,212,255,0.15)" }}>
            <Calculator style={{ width: 22, height: 22, color: "#00D4FF" }} />
          </div>
          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase",
              color: "#00D4FF", marginBottom: 5 }}>◈ MODULE · ERISA §430/436 · Schedule SB</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", marginBottom: 5 }}>
              Actuarial Engine IQ™
            </div>
            <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6, maxWidth: 520 }}>
              Funded status · AFTAP · At-risk liability · Contribution gap · IRC §436 restrictions · Segment rates ·
              Actuary concentration · SHA-256 sealed evidence spine across 81,280 Schedule SB rows.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {[["84.7%","Funded Ratio","rgba(255,176,32,0.8)"],["82.3%","AFTAP","rgba(255,61,96,0.8)"],["$2.84M","At-Risk","rgba(255,61,96,0.8)"],["$1.64M","MRC Gap","rgba(255,176,32,0.8)"]].map(([val,lbl,col]) => (
                <div key={lbl} style={{ padding: "4px 10px", borderRadius: 8,
                  background: "#ffffff", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: String(col) }}>{val}</div>
                  <div style={{ fontSize: 8, color: "#64748b", letterSpacing: "0.08em" }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
          {/* CTA */}
          <div style={{ flexShrink: 0 }}>
            <a href="/actuarial-engine" data-testid="actuarial-engine-cta"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px",
                background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.4)",
                borderRadius: 12, fontSize: 12, fontWeight: 900, color: "#00D4FF", textDecoration: "none",
                whiteSpace: "nowrap", boxShadow: "0 0 16px rgba(0,212,255,0.12)", transition: "all 0.15s" }}>
              <Calculator style={{ width: 14, height: 14 }} />
              Open Actuarial Engine →
            </a>
            <div style={{ fontSize: 9, color: "rgba(15,23,42,0.08)", textAlign: "center", marginTop: 6 }}>
              AFTAP · §436 · Segment Rates
            </div>
          </div>
        </div>

        {/* Urgent renewals */}
        {urgentClients.length > 0 && (
          <div style={{ background: `linear-gradient(135deg, ${RED}0C 0%, rgba(0,0,0,0.15) 100%)`, border: `1px solid ${RED}40`, borderRadius: 16, padding: "20px 22px", boxShadow: `0 0 30px ${RED}0C` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: RED, boxShadow: `0 0 8px ${RED}` }} />
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: RED }}>
                Renewals Requiring Immediate Attention
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
              {urgentClients.map(c => (
                <button key={c.id} onClick={() => onSelectClient(c.id)}
                  data-testid={`urgent-client-${c.id}`}
                  style={{ background: "#ffffff", border: `1px solid ${c.days_to_renewal <= 30 ? RED + "30" : ORANGE + "25"}`, borderRadius: 12,
                    padding: "14px 16px", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{c.name}</span>
                    <UrgencyChip days={c.days_to_renewal} />
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{c.industry} · {c.employees} lives</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: c.days_to_renewal <= 30 ? RED : ORANGE }}>
                      {c.days_to_renewal}d
                    </span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>to renewal · {fmtDate(c.renewal_date)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#475569" }}>
                      <Pill style={{ width: 10, height: 10, color: c.rx_status === "analyzed" ? GREEN : c.rx_status === "pending" ? GOLD : "#94a3b8" }} />
                      Rx {c.rx_score !== null ? `${c.rx_score}/100` : c.rx_status}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#475569" }}>
                      <Activity style={{ width: 10, height: 10, color: c.sl_status === "analyzed" ? GREEN : c.sl_status === "pending" ? GOLD : "#94a3b8" }} />
                      S/L {c.sl_score !== null ? `${c.sl_score}/100` : c.sl_status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Revenue trend */}
        <div style={{ background: `linear-gradient(135deg, ${GOLD}07 0%, rgba(0,0,0,0.15) 100%)`, border: `1px solid ${GOLD}30`, borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <TrendingUp style={{ width: 14, height: 14, color: GOLD }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#334155" }}>Commission Revenue · Rolling 7 Months</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.revenue_trend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={46} />
              <Tooltip formatter={(v: any) => [`$${(v / 1000).toFixed(1)}K`]} contentStyle={{
                background: "#F8FAFC", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="commission" fill={GOLD} radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right column — activity feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Portfolio health */}
        <div style={{ background: `linear-gradient(135deg, ${RED}07 0%, ${GOLD}05 50%, rgba(0,0,0,0.1) 100%)`, border: `1px solid #e2e8f0`, borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 14 }}>Portfolio Risk Profile</div>
          {data.risk_distribution.map((r, i) => {
            const colors = [GREEN, GOLD, RED];
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#334155" }}>{r.band}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: colors[i] }}>{r.count} clients</span>
                </div>
                <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r.pct}%`, height: "100%", background: colors[i], borderRadius: 3,
                    boxShadow: `0 0 6px ${colors[i]}55` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity feed */}
        <div style={{ background: `linear-gradient(135deg, ${PURPLE}07 0%, rgba(0,0,0,0.15) 100%)`, border: `1px solid ${PURPLE}25`, borderRadius: 16, padding: "18px 20px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Bell style={{ width: 13, height: 13, color: PURPLE }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569" }}>Live Activity Feed</span>
            <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
          </div>
          <ActivityFeed items={data.activity_feed.slice(0, 8)} />
        </div>
        <LiveMarketBoard clients={data.clients} />

        {/* Prospect signals */}
        <div style={{ background: `linear-gradient(135deg, ${GREEN}09 0%, rgba(0,0,0,0.15) 100%)`, border: `1px solid ${GREEN}35`, borderRadius: 16, padding: "18px 20px", boxShadow: `0 0 20px ${GREEN}08` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <MapPin style={{ width: 13, height: 13, color: GREEN }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569" }}>Top Prospect Signals</span>
            <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
          </div>
          {[
            { company: "Cumberland Freight Systems",  fit: 93, region: "Nashville Metro",       wedge: "Stop-Loss" },
            { company: "Volunteer Tool & Die",        fit: 89, region: "Chattanooga",            wedge: "Rx Savings" },
            { company: "Beacon Health Partners",      fit: 86, region: "Knoxville",              wedge: "Full Renewal" },
          ].map((p, i) => {
            const fitColor = p.fit >= 90 ? GREEN : p.fit >= 80 ? GOLD : ORANGE;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                background: "rgba(0,0,0,0.2)", border: "1px solid #e2e8f0", borderRadius: 11, marginBottom: 8 }}>
                <div style={{ flexShrink: 0, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: fitColor, lineHeight: 1 }}>{p.fit}</div>
                  <div style={{ fontSize: 7, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.08)" }}>fit</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.company}</div>
                  <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{p.region}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase",
                  color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}25`, borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>{p.wedge}</span>
              </div>
            );
          })}
          <a href="/broker/prospects" style={{ display: "block", textAlign: "center", fontSize: 10, fontWeight: 700, color: GREEN,
            padding: "8px", borderRadius: 8, background: `${GREEN}08`, border: `1px solid ${GREEN}18`, textDecoration: "none", marginTop: 4 }}>
            View all Tennessee prospects →
          </a>
        </div>
      </div>
    </div>
    </div>
  );
}

/* ─── BOOK OF BUSINESS ───────────────────────────────────────────────────── */
function ClientRow({ c, onSelect }: { c: Client; onSelect: (id: string) => void }) {
  const tierCfg = TIER_CFG[c.tier] || TIER_CFG.silver;
  return (
    <button key={c.id} onClick={() => onSelect(c.id)}
      data-testid={`client-row-${c.id}`}
      style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 90px 90px 80px 80px 60px",
        gap: 8, padding: "12px 16px",
        background: c.days_to_renewal <= 30 ? `${RED}07` : c.days_to_renewal <= 60 ? `${ORANGE}06` : "#ffffff",
        border: `1px solid ${c.days_to_renewal <= 30 ? RED+"30" : c.days_to_renewal <= 60 ? ORANGE+"25" : "#e2e8f0"}`,
        borderLeft: `3px solid ${c.days_to_renewal <= 30 ? RED : c.days_to_renewal <= 60 ? ORANGE : c.tier === "platinum" ? BLUE : c.tier === "gold" ? GOLD : "#cbd5e1"}`,
        borderRadius: 12, cursor: "pointer", textAlign: "left", alignItems: "center", transition: "all 0.12s", width: "100%" }}
      onMouseEnter={e => { e.currentTarget.style.background = c.days_to_renewal <= 30 ? `${RED}12` : `rgba(255,184,0,0.06)`; e.currentTarget.style.borderColor = `${GOLD}35`; }}
      onMouseLeave={e => { e.currentTarget.style.background = c.days_to_renewal <= 30 ? `${RED}07` : "#ffffff"; e.currentTarget.style.borderColor = c.days_to_renewal <= 30 ? `${RED}30` : "#e2e8f0"; }}>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{c.name}</div>
          <span style={{ fontSize: 8, fontWeight: 900, color: tierCfg.color, background: tierCfg.bg, border: `1px solid ${tierCfg.border}`,
            borderRadius: 4, padding: "1px 5px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{c.tier}</span>
          {c.open_actions > 0 && (
            <span style={{ fontSize: 9, fontWeight: 900, background: "rgba(168,85,247,0.12)", color: PURPLE,
              border: `1px solid ${PURPLE}25`, borderRadius: 4, padding: "1px 6px" }}>{c.open_actions} actions</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
          {(c.employees ?? 0).toLocaleString()} lives · {c.city}, {c.state} · {c.tpa}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{c.industry}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{c.plan_type}</div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <UrgencyChip days={c.days_to_renewal} />
        </div>
        <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
          {fmtDate(c.renewal_date)} · <span style={{ fontWeight: 700, color: c.days_to_renewal <= 30 ? RED : c.days_to_renewal <= 60 ? ORANGE : "#334155" }}>{c.days_to_renewal}d</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot status={c.rx_status} />
        <span style={{ fontSize: 11, color: c.rx_score !== null ? (c.rx_score < 50 ? RED : c.rx_score < 70 ? GOLD : GREEN) : "#64748b" }}>
          {c.rx_score !== null ? `${c.rx_score}/100` : c.rx_status === "pending" ? "…" : "—"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StatusDot status={c.sl_status} />
        <span style={{ fontSize: 11, color: c.sl_score !== null ? (c.sl_score < 50 ? RED : c.sl_score < 70 ? GOLD : GREEN) : "#64748b" }}>
          {c.sl_score !== null ? `${c.sl_score}/100` : c.sl_status === "pending" ? "…" : "—"}
        </span>
      </div>

      <HealthBar score={c.health_score} />
      <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{fmtMoney(c.annual_spend)}</div>
      <ChevronRight style={{ width: 14, height: 14, color: "#94a3b8" }} />
    </button>
  );
}

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama", AK:"Alaska", AZ:"Arizona", AR:"Arkansas", CA:"California",
  CO:"Colorado", CT:"Connecticut", DE:"Delaware", FL:"Florida", GA:"Georgia",
  HI:"Hawaii", ID:"Idaho", IL:"Illinois", IN:"Indiana", IA:"Iowa",
  KS:"Kansas", KY:"Kentucky", LA:"Louisiana", ME:"Maine", MD:"Maryland",
  MA:"Massachusetts", MI:"Michigan", MN:"Minnesota", MS:"Mississippi",
  MO:"Missouri", MT:"Montana", NE:"Nebraska", NV:"Nevada", NH:"New Hampshire",
  NJ:"New Jersey", NM:"New Mexico", NY:"New York", NC:"North Carolina",
  ND:"North Dakota", OH:"Ohio", OK:"Oklahoma", OR:"Oregon", PA:"Pennsylvania",
  RI:"Rhode Island", SC:"South Carolina", SD:"South Dakota", TN:"Tennessee",
  TX:"Texas", UT:"Utah", VT:"Vermont", VA:"Virginia", WA:"Washington",
  WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming",
};

function BookOfBusiness({ clients, onSelect }: { clients: Client[]; onSelect: (id: string) => void }) {
  const [, navigate] = useLocation();
  const [search, setSearch]         = useState("");
  const [sort, setSort]             = useState<"renewal" | "risk" | "health" | "premium">("renewal");
  const [groupBy, setGroupBy]       = useState<"none" | "state" | "city">("none");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});

  const allStates = Array.from(new Set(clients.map(c => c.state))).sort();

  const filtered = clients
    .filter(c => {
      if (stateFilter !== "ALL" && c.state !== stateFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q)
        || c.industry.toLowerCase().includes(q)
        || c.state.toLowerCase().includes(q)
        || (c.city || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sort === "renewal") return a.days_to_renewal - b.days_to_renewal;
      if (sort === "risk")    return b.risk_score - a.risk_score;
      if (sort === "health")  return a.health_score - b.health_score;
      if (sort === "premium") return b.annual_spend - a.annual_spend;
      return 0;
    });

  const SortBtn = ({ val, label }: { val: typeof sort; label: string }) => (
    <button onClick={() => setSort(val)}
      style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
        background: sort === val ? `${GOLD}18` : "transparent",
        border: sort === val ? `1px solid ${GOLD}40` : "1px solid transparent",
        color: sort === val ? GOLD : "#475569" }}>
      {label}
    </button>
  );

  const GeoBtn = ({ val, label }: { val: typeof groupBy; label: string }) => (
    <button onClick={() => setGroupBy(g => g === val ? "none" : val)}
      data-testid={`groupby-${val}`}
      style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
        background: groupBy === val ? `${BLUE}22` : "transparent",
        border: groupBy === val ? `1px solid ${BLUE}50` : "1px solid transparent",
        color: groupBy === val ? BLUE : "#475569",
        display: "flex", alignItems: "center", gap: 4 }}>
      <MapPin style={{ width: 10, height: 10 }} /> {label}
    </button>
  );

  const tableHeader = (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 90px 90px 80px 80px 60px",
      gap: 8, padding: "8px 16px", marginBottom: 4 }}>
      {["Client", "Industry", "Plan Type", "Renewal", "Rx", "Stop-Loss", "Health", "Premium", ""].map(h => (
        <span key={h} style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,23,42,0.08)" }}>{h}</span>
      ))}
    </div>
  );

  const renderGrouped = (groupKey: "state" | "city") => {
    const groups: Record<string, Client[]> = {};
    filtered.forEach(c => {
      const key = groupKey === "state" ? c.state : `${c.city}, ${c.state}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    const keys = Object.keys(groups).sort();

    return keys.map(key => {
      const group = groups[key];
      const totalPremium = group.reduce((s, c) => s + c.annual_spend, 0);
      const totalLives   = group.reduce((s, c) => s + (c.employees ?? 0), 0);
      const isOpen = !collapsed[key];
      const stateCode = groupKey === "state" ? key : key.split(", ")[1];
      const stateName = STATE_NAMES[stateCode] || stateCode;
      const label = groupKey === "state" ? `${stateName} (${key})` : key;

      return (
        <div key={key} style={{ marginBottom: 12 }}>
          <button
            data-testid={`geo-group-${key}`}
            onClick={() => setCollapsed(p => ({ ...p, [key]: !p[key] }))}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
              background: `${BLUE}0D`, border: `1px solid ${BLUE}25`, borderRadius: 10,
              padding: "10px 16px", cursor: "pointer", marginBottom: isOpen ? 6 : 0 }}>
            <MapPin style={{ width: 13, height: 13, color: BLUE, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", flex: 1, textAlign: "left" }}>{label}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginRight: 4 }}>
              {group.length} account{group.length !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 10, color: "#64748b", marginRight: 4 }}>
              {totalLives.toLocaleString()} lives
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginRight: 8 }}>
              {fmtMoney(totalPremium)}
            </span>
            <ChevronRight style={{ width: 13, height: 13, color: "#64748b",
              transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {isOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
              {group.map(c => <ClientRow key={c.id} c={c} onSelect={onSelect} />)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div>
      {/* Toolbar row 1 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#64748b" }} />
          <input
            data-testid="broker-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by client, city, state, industry…"
            style={{ width: "100%", background: "#ffffff", border: "1px solid #e2e8f0",
              borderRadius: 10, padding: "8px 12px 8px 34px", color: "#0F172A", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* State filter */}
        <select
          data-testid="state-filter"
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 10,
            padding: "8px 12px", color: stateFilter === "ALL" ? "#475569" : "#fff",
            fontSize: 12, cursor: "pointer", outline: "none", minWidth: 110 }}>
          <option value="ALL">All States</option>
          {allStates.map(s => (
            <option key={s} value={s} style={{ background: "#1a1a2e" }}>
              {STATE_NAMES[s] || s} ({s})
            </option>
          ))}
        </select>

        {/* Sort buttons */}
        <div style={{ display: "flex", gap: 4, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4 }}>
          <SortBtn val="renewal" label="Renewal" />
          <SortBtn val="risk"    label="Risk" />
          <SortBtn val="health"  label="Health" />
          <SortBtn val="premium" label="Premium" />
        </div>

        {/* Geography group buttons */}
        <div style={{ display: "flex", gap: 4, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4 }}>
          <GeoBtn val="state" label="By State" />
          <GeoBtn val="city"  label="By City" />
        </div>

        <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{filtered.length} accounts</span>
      </div>

      {/* State filter active chip */}
      {stateFilter !== "ALL" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: "#475569" }}>Filtered to:</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
            background: `${BLUE}18`, border: `1px solid ${BLUE}35`, borderRadius: 20, padding: "3px 10px", color: BLUE }}>
            <MapPin style={{ width: 9, height: 9 }} />
            {STATE_NAMES[stateFilter] || stateFilter} ({stateFilter})
            <button onClick={() => setStateFilter("ALL")} data-testid="clear-state-filter"
              style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", padding: 0, marginLeft: 2, fontSize: 12, lineHeight: 1 }}>×</button>
          </span>
        </div>
      )}

      {groupBy !== "none" ? (
        <div>{renderGrouped(groupBy)}</div>
      ) : (
        <>
          {tableHeader}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(c => <ClientRow key={c.id} c={c} onSelect={onSelect} />)}
          </div>
        </>
      )}

      {/* Generate Leads CTA */}
      {(() => {
        const bookStates = Array.from(new Set(filtered.map(c => c.state))).filter(Boolean);
        const bookIndustries = Array.from(new Set(filtered.map(c => c.industry))).filter(Boolean).slice(0, 3);
        const targetState = stateFilter !== "ALL" ? stateFilter : bookStates[0] || null;
        const navUrl = targetState ? `/contact-intel?state=${targetState}` : "/contact-intel";
        return (
          <div style={{ marginTop: 28 }}>
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,184,0,0.2), transparent)", marginBottom: 24 }} />
            <div style={{ background: "linear-gradient(135deg, rgba(255,184,0,0.05) 0%, rgba(255,184,0,0.02) 100%)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 16, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                    Find Similar Prospects
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", lineHeight: 1.5 }}>
                    Based on your {filtered.length} account{filtered.length !== 1 ? "s" : ""}
                    {bookIndustries.length > 0 && ` in ${bookIndustries.join(", ")}`}
                    {targetState ? ` · Prospecting ${STATE_NAMES[targetState] || targetState}` : ` across ${bookStates.length} state${bookStates.length !== 1 ? "s" : ""}`}
                    {" "}— discover new Form 5500 plan sponsors to target with AI-powered outreach.
                  </div>
                </div>
                <button
                  data-testid="btn-generate-leads"
                  onClick={() => navigate(navUrl)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "12px 22px", borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${GOLD} 0%, #e6a000 100%)`,
                    border: "none", color: "#0a0a14", fontSize: 12, fontWeight: 900,
                    letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer",
                    boxShadow: `0 4px 20px ${GOLD}30`,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 28px ${GOLD}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 4px 20px ${GOLD}30`; }}
                >
                  <Zap style={{ width: 14, height: 14 }} />
                  Generate Leads
                </button>
              </div>
              {bookStates.length > 1 && stateFilter === "ALL" && (
                <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(15,23,42,0.08)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Quick state prospecting:</span>
                  {bookStates.slice(0, 6).map(st => (
                    <button
                      key={st}
                      data-testid={`lead-state-${st}`}
                      onClick={() => navigate(`/contact-intel?state=${st}`)}
                      style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", color: GOLD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ─── TIMELINE VISUAL ────────────────────────────────────────────────────── */
function RenewalTimeline({ stages, daysToRenewal }: { stages: TimelineStage[]; daysToRenewal: number }) {
  const active = stages.find(s => s.status === "active");
  const complete = stages.filter(s => s.status === "complete").length;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#334155" }}>{complete} of {stages.length} stages complete</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{daysToRenewal} days to renewal</span>
        </div>
        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${(complete / stages.length) * 100}%`, height: "100%",
            background: `linear-gradient(90deg, ${GREEN}bb, ${GREEN})`, borderRadius: 3 }} />
        </div>
      </div>

      {/* Stage list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1;
          const cfg = stage.status === "complete"
            ? { lineColor: GREEN,  dotBg: `${GREEN}20`, dotBorder: GREEN,  dotFill: GREEN,  textColor: "rgba(255,255,255,0.55)", labelColor: "rgba(255,255,255,0.55)" }
            : stage.status === "active"
            ? { lineColor: GOLD,   dotBg: `${GOLD}15`,  dotBorder: GOLD,   dotFill: GOLD,   textColor: "#0f172a",  labelColor: "#fff" }
            : { lineColor: "#e2e8f0", dotBg: "#ffffff", dotBorder: "#cbd5e1", dotFill: "transparent", textColor: "#64748b", labelColor: "#64748b" };

          return (
            <div key={stage.id} style={{ display: "flex", gap: 0 }}>
              {/* Dot + line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 16, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: cfg.dotBg, border: `2px solid ${cfg.dotBorder}`, zIndex: 1, flexShrink: 0 }}>
                  {stage.status === "complete"
                    ? <CheckCircle2 style={{ width: 14, height: 14, color: GREEN }} />
                    : stage.status === "active"
                    ? <div style={{ width: 10, height: 10, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
                    : <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#cbd5e1" }} />}
                </div>
                {!isLast && <div style={{ width: 2, flex: 1, minHeight: 24, background: cfg.lineColor, opacity: 0.3, marginTop: 2 }} />}
              </div>

              {/* Content */}
              <div style={{ paddingBottom: isLast ? 0 : 20, paddingTop: 2, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: cfg.labelColor }}>{stage.label}</span>
                  <span style={{ fontSize: 9, fontWeight: 900, color: cfg.dotBorder, background: `${cfg.dotBorder}12`,
                    border: `1px solid ${cfg.dotBorder}25`, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {stage.status === "complete" ? "✓ Done" : stage.status === "active" ? "In Progress" : `${stage.trigger}d out`}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(15,23,42,0.08)", marginLeft: "auto" }}>Owner: {stage.owner}</span>
                </div>
                <div style={{ fontSize: 11, color: cfg.textColor, lineHeight: 1.6 }}>{stage.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── DOCUMENT VAULT ─────────────────────────────────────────────────────── */
function DocumentVault({ docs, docsUploaded, docsRequired }: { docs: Document[]; docsUploaded: number; docsRequired: number }) {
  const TYPE_COLORS: Record<string, string> = {
    "Rx Contract":    BLUE,
    "Stop-Loss Policy": PURPLE,
    "TPA Agreement":  GOLD,
    "Census":         GREEN,
    "Proposal":       ORANGE,
    "Clinical Report": "#aaa",
  };
  const needed = Math.max(0, docsRequired - docsUploaded);

  return (
    <div>
      {/* Progress */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{docsUploaded} of {docsRequired} documents uploaded</span>
          {needed > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: ORANGE }}>{needed} still needed</span>}
        </div>
        <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${(docsUploaded / Math.max(docsRequired, 1)) * 100}%`, height: "100%",
            background: docsUploaded >= docsRequired ? GREEN : GOLD, borderRadius: 3 }} />
        </div>
      </div>

      {/* Document list */}
      {docs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map(doc => {
            const typeColor = TYPE_COLORS[doc.type] || "#475569";
            return (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center",
                  justifyContent: "center", background: `${typeColor}12`, border: `1px solid ${typeColor}25`, flexShrink: 0 }}>
                  <FileText style={{ width: 16, height: 16, color: typeColor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 2 }}>{doc.name}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 900, color: typeColor, background: `${typeColor}12`,
                      border: `1px solid ${typeColor}25`, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{doc.type}</span>
                    <span style={{ fontSize: 10, color: "#64748b" }}>{doc.size} · {fmtDate(doc.uploaded)}</span>
                  </div>
                </div>
                {doc.score !== null && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: doc.score < 50 ? RED : doc.score < 70 ? GOLD : GREEN }}>{doc.score}/100</div>
                    <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Fiduciary Score</div>
                  </div>
                )}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <StatusDot status={doc.status} />
                    <span style={{ fontSize: 9, color: "#475569", textTransform: "capitalize" }}>{doc.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "#ffffff", border: "1px dashed #e2e8f0", borderRadius: 12 }}>
          <Upload style={{ width: 28, height: 28, color: "#94a3b8", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 12, color: "#64748b" }}>No documents uploaded yet</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Upload Rx contract and stop-loss policy to begin analysis</div>
        </div>
      )}

      {/* Upload CTA */}
      <button data-testid="doc-upload-btn"
        style={{ width: "100%", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px", borderRadius: 10, background: "rgba(0,212,255,0.06)", border: "1px dashed rgba(0,212,255,0.25)",
          color: BLUE, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        <Plus style={{ width: 13, height: 13 }} /> Upload Document
      </button>
    </div>
  );
}

/* ─── RX DEFENSE WORKSPACE TAB ───────────────────────────────────────────── */
function RxDefenseTab({ c }: { c: Client }) {
  const score = c.rx_score;
  const scoreColor = score !== null ? (score < 50 ? RED : score < 70 ? GOLD : GREEN) : BLUE;

  const signals = [
    { flag: "Spread Pricing Detected",    risk: "HIGH",    desc: "PBM may be charging plan more than it pays pharmacy. Request spread disclosure immediately.", color: RED    },
    { flag: "Rebate Guarantee Terms",     risk: "REVIEW",  desc: "Rebate guarantee language may leave value on table vs. pass-through model.", color: ORANGE },
    { flag: "Formulary Exclusions",       risk: "MONITOR", desc: "7 high-utilization drugs excluded from formulary. Review clinical alternatives.", color: GOLD   },
    { flag: "CAA Transparency Filing",    risk: "DUE Q2",  desc: "2026 CAA broker compensation disclosure required for renewal.", color: BLUE    },
  ];

  const actions = [
    c.rx_status === "none"     && "Upload Rx/PBM contract for PBM Contract Clarity 360™ analysis",
    c.rx_status === "pending"  && "Analysis in progress — review will complete within 24 hours",
    score !== null && score < 50 && "Critical: Rx fiduciary score below threshold — schedule CFO conversation",
    score !== null && score < 70 && "Request PBM contract exhibits and spread-pricing disclosure",
    true                        && "Prepare Rx savings narrative for renewal package",
  ].filter(Boolean) as string[];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Score card */}
        <div style={{ background: `${scoreColor}07`, border: `1px solid ${scoreColor}22`, borderRadius: 16, padding: "20px 22px", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
              {score !== null ? score : "—"}
            </div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginTop: 4 }}>PBM Contract Clarity 360™ Score</div>
            <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, marginTop: 10, overflow: "hidden", width: 100 }}>
              <div style={{ width: `${score ?? 0}%`, height: "100%", background: scoreColor, borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Rx Fiduciary Status</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "PBM",          value: c.pbm         },
                { label: "Plan Type",    value: c.plan_type   },
                { label: "Status",       value: c.rx_status   },
                { label: "Employees",    value: `${(c.employees ?? 0).toLocaleString()} lives` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "rgba(0,0,0,0.05)", borderRadius: 9, padding: "8px 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.08)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk signals */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569", marginBottom: 14 }}>Rx Risk Signals & Contract Flags</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signals.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: `${s.color}06`, border: `1px solid ${s.color}18`, borderLeft: `3px solid ${s.color}`, borderRadius: 10 }}>
                <div style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: s.color, background: `${s.color}12`, border: `1px solid ${s.color}25`, borderRadius: 3, padding: "2px 5px" }}>{s.risk}</span>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>{s.flag}</div>
                  <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <a href="/rx-defense" data-testid="rx-fullreport-cta"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, fontSize: 12, fontWeight: 900, cursor: "pointer",
            background: `${PURPLE}14`, border: `1px solid ${PURPLE}35`, color: PURPLE, textDecoration: "none" }}>
          Open Full PBM Contract Clarity 360™ Report →
        </a>
      </div>

      {/* Right — action items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#ffffff", border: `1px solid ${PURPLE}20`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: PURPLE, marginBottom: 12 }}>Action Items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 12px", background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.12)", borderRadius: 9 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: PURPLE, flexShrink: 0, marginTop: 4 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>{a}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>CAA 2026 Rx Checklist</div>
          {[
            ["Broker compensation disclosed",         true  ],
            ["PBM spread-pricing disclosure obtained", false ],
            ["Formulary alternatives reviewed",       false ],
            ["Rebate pass-through analyzed",          false ],
            ["Plan sponsor advised of fiduciary duty", true  ],
          ].map(([label, done]) => (
            <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #ffffff" }}>
              <span style={{ fontSize: 12, color: done ? GREEN : "#94a3b8" }}>{done ? "✓" : "○"}</span>
              <span style={{ fontSize: 11, color: done ? "#1e293b" : "#64748b" }}>{String(label)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── STOP-LOSS WORKSPACE TAB ────────────────────────────────────────────── */
function StopLossTab({ c }: { c: Client }) {
  const score = c.sl_score;
  const scoreColor = score !== null ? (score < 50 ? RED : score < 70 ? GOLD : GREEN) : ORANGE;

  const signals = [
    { flag: "Aggregate Threshold Alignment",     risk: "REVIEW",  desc: "Current aggregate deductible may exceed 125% of expected claims. Run actuarial stress test.", color: ORANGE },
    { flag: "Specific Deductible Optimization",  risk: "MONITOR", desc: "Specific limit set at $100K — evaluate against prior large claimant run-out.", color: GOLD   },
    { flag: "Lasered Claimants",                 risk: "HIGH",    desc: "2 claimants likely lasered at renewal. Coordinate concurrent review strategy.", color: RED    },
    { flag: "Market Comparison",                 risk: "PENDING", desc: "Current carrier has not provided renewal terms. Competing market should be sourced.", color: BLUE   },
  ];

  const actions = [
    c.sl_status === "none"    && "Upload stop-loss policy for Stop-Loss IQ™ analysis",
    c.sl_status === "pending" && "Analysis in progress — review will complete within 24 hours",
    score !== null && score < 50 && "Critical: Stop-loss gap score below threshold — schedule war room",
    score !== null && score < 70 && "Request renewal terms from carrier immediately",
    true                          && "Prepare stop-loss renewal recommendation package",
  ].filter(Boolean) as string[];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Score card */}
        <div style={{ background: `${scoreColor}07`, border: `1px solid ${scoreColor}22`, borderRadius: 16, padding: "20px 22px", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
              {score !== null ? score : "—"}
            </div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginTop: 4 }}>Stop-Loss IQ™ Score</div>
            <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, marginTop: 10, overflow: "hidden", width: 100 }}>
              <div style={{ width: `${score ?? 0}%`, height: "100%", background: scoreColor, borderRadius: 3 }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginBottom: 6 }}>Stop-Loss Policy Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Carrier",      value: c.sl_carrier || "Unassigned"     },
                { label: "Plan Type",    value: c.plan_type                       },
                { label: "Status",       value: c.sl_status                       },
                { label: "Lives",        value: `${(c.employees ?? 0).toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "rgba(0,0,0,0.05)", borderRadius: 9, padding: "8px 12px" }}>
                  <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.08)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "capitalize" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Signals */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#475569", marginBottom: 14 }}>Stop-Loss Risk Signals</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signals.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: `${s.color}06`, border: `1px solid ${s.color}18`, borderLeft: `3px solid ${s.color}`, borderRadius: 10 }}>
                <div style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: s.color, background: `${s.color}12`, border: `1px solid ${s.color}25`, borderRadius: 3, padding: "2px 5px" }}>{s.risk}</span>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 3 }}>{s.flag}</div>
                  <div style={{ fontSize: 11, color: "#334155", lineHeight: 1.55 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <a href="/stop-loss" data-testid="sl-fullreport-cta"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, fontSize: 12, fontWeight: 900, cursor: "pointer",
            background: `${ORANGE}12`, border: `1px solid ${ORANGE}35`, color: ORANGE, textDecoration: "none" }}>
          Open Full Stop-Loss IQ™ Report →
        </a>
      </div>

      {/* Right — action items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#ffffff", border: `1px solid ${ORANGE}20`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: ORANGE, marginBottom: 12 }}>Action Items</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 12px", background: "rgba(255,107,26,0.05)", border: "1px solid rgba(255,107,26,0.12)", borderRadius: 9 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ORANGE, flexShrink: 0, marginTop: 4 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.55 }}>{a}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Stop-Loss Renewal Checklist</div>
          {[
            ["Renewal terms received from carrier",    false ],
            ["Competing markets quoted",               false ],
            ["Aggregate threshold stress-tested",      false ],
            ["Laser claimant strategy prepared",       false ],
            ["Run-out liability assessed",             false ],
            ["Client advised on specific limit",       true  ],
          ].map(([label, done]) => (
            <div key={String(label)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #ffffff" }}>
              <span style={{ fontSize: 12, color: done ? GREEN : "#94a3b8" }}>{done ? "✓" : "○"}</span>
              <span style={{ fontSize: 11, color: done ? "#1e293b" : "#64748b" }}>{String(label)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── CLIENT WORKSPACE ───────────────────────────────────────────────────── */
function ClientWorkspace({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [tab, setTab] = useState<"overview" | "rx" | "stoploss" | "timeline" | "documents" | "notes">("overview");
  const { data: c, isLoading } = useQuery<Client>({ queryKey: ["/api/saas/broker/clients", clientId] });

  if (isLoading || !c) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <div style={{ fontSize: 13, color: "#64748b" }}>Loading client…</div>
    </div>
  );

  const tierCfg = TIER_CFG[c.tier] || TIER_CFG.silver;
  const TABS = [
    { id: "overview",   label: "Overview",     icon: LayoutDashboard },
    { id: "rx",         label: "PBM Contract Clarity 360",   icon: Pill            },
    { id: "stoploss",   label: "Stop-Loss",    icon: Activity        },
    { id: "timeline",   label: "Timeline",     icon: Calendar        },
    { id: "documents",  label: "Documents",    icon: FileText        },
    { id: "notes",      label: "Notes",        icon: BookOpen        },
  ] as const;

  const kpis = [
    { label: "Annual Spend",    value: fmtMoney(c.annual_spend),  color: GOLD },
    { label: "PMPM",            value: `$${c.pmpm.toFixed(0)}`,   color: BLUE },
    { label: "MLR",             value: `${c.mlr}%`,               color: c.mlr > 85 ? RED : c.mlr > 78 ? GOLD : GREEN },
    { label: "YoY Trend",       value: `+${c.yoy_trend}%`,        color: c.yoy_trend > 8 ? RED : GOLD },
    { label: "Risk Score",      value: `${c.risk_score}/10`,      color: c.risk_score >= 7 ? RED : c.risk_score >= 4 ? ORANGE : GREEN },
    { label: "Account Health",  value: `${c.health_score}/100`,   color: c.health_score >= 75 ? GREEN : c.health_score >= 55 ? GOLD : RED },
  ];

  return (
    <div>
      {/* Back + breadcrumb */}
      <button onClick={onBack} data-testid="client-back-btn"
        style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, background: "none", border: "none",
          color: "#475569", fontSize: 12, cursor: "pointer", padding: 0 }}>
        ← Book of Business <ChevronRight style={{ width: 12, height: 12 }} /> <span style={{ color: GOLD }}>{c.name}</span>
      </button>

      {/* Client hero */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0",
        borderRadius: 20, padding: "24px 28px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}10 0%, transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{c.name}</div>
              <span style={{ fontSize: 9, fontWeight: 900, color: tierCfg.color, background: tierCfg.bg,
                border: `1px solid ${tierCfg.border}`, borderRadius: 4, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {c.tier}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: c.status === "active" ? GREEN : "#64748b",
                background: c.status === "active" ? `${GREEN}10` : "#ffffff", border: `1px solid ${c.status === "active" ? GREEN + "30" : "#e2e8f0"}`,
                borderRadius: 4, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {c.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
              {c.industry} · {(c.employees ?? 0).toLocaleString()} employees · {c.city}, {c.state} · {c.plan_type}
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              {[
                { label: "PBM", value: c.pbm, icon: Pill },
                { label: "Stop-Loss", value: c.sl_carrier, icon: Activity },
                { label: "TPA", value: c.tpa, icon: Building2 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon style={{ width: 12, height: 12, color: "#64748b" }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>{label}:</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Renewal countdown */}
          <div style={{ flexShrink: 0, textAlign: "center", padding: "16px 24px",
            background: c.days_to_renewal <= 30 ? "rgba(255,77,109,0.08)" : c.days_to_renewal <= 60 ? "rgba(255,107,26,0.08)" : "rgba(255,184,0,0.06)",
            border: `1px solid ${c.days_to_renewal <= 30 ? RED + "30" : c.days_to_renewal <= 60 ? ORANGE + "30" : GOLD + "25"}`,
            borderRadius: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1,
              color: c.days_to_renewal <= 30 ? RED : c.days_to_renewal <= 60 ? ORANGE : GOLD,
              textShadow: `0 0 20px ${c.days_to_renewal <= 30 ? RED : GOLD}40` }}>
              {c.days_to_renewal}
            </div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginTop: 4 }}>days to renewal</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>{fmtDate(c.renewal_date)}</div>
            <div style={{ marginTop: 8 }}><UrgencyChip days={c.days_to_renewal} /></div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginTop: 20,
          paddingTop: 20, borderTop: "1px solid #f1f5f9" }}>
          {kpis.map(({ label, value, color }) => (
            <div key={label}>
              <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract scores */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "PBM Contract Clarity 360™", icon: Pill, status: c.rx_status, score: c.rx_score, color: c.rx_status === "analyzed" ? (c.rx_score !== null && c.rx_score < 50 ? RED : GOLD) : BLUE },
          { label: "Stop-Loss IQ™",  icon: Activity, status: c.sl_status, score: c.sl_score, color: c.sl_status === "analyzed" ? (c.sl_score !== null && c.sl_score < 50 ? RED : GOLD) : BLUE },
        ].map(({ label, icon: Icon, status, score, color }) => (
          <div key={label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              background: `${color}12`, border: `1px solid ${color}25` }}>
              <Icon style={{ width: 18, height: 18, color }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#1e293b", marginBottom: 2 }}>{label}</div>
              {score !== null
                ? <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{score}<span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>/100</span></div>
                : <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                    {status === "pending" ? "Analysis in progress…" : "Contract not yet uploaded"}
                  </div>}
            </div>
            <StatusDot status={status} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 4, marginBottom: 20 }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const isRx = id === "rx";    const isSL = id === "stoploss";
          const badgeVal = isRx ? (c.rx_score !== null ? c.rx_score : null) : isSL ? (c.sl_score !== null ? c.sl_score : null) : null;
          const badgeColor = badgeVal !== null ? (badgeVal < 50 ? RED : badgeVal < 70 ? GOLD : GREEN) : null;
          const tabColor = tab === id ? (isRx ? PURPLE : isSL ? ORANGE : GOLD) : "#475569";
          const activeBg = isRx ? `${PURPLE}12` : isSL ? `${ORANGE}10` : `${GOLD}15`;
          const activeBorder = isRx ? `${PURPLE}30` : isSL ? `${ORANGE}30` : `${GOLD}35`;
          return (
            <button key={id} onClick={() => setTab(id as any)} data-testid={`workspace-tab-${id}`}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 12px",
                borderRadius: 9, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.12s",
                background: tab === id ? activeBg : "transparent",
                border: tab === id ? `1px solid ${activeBorder}` : "1px solid transparent",
                color: tab === id ? tabColor : "#475569" }}>
              <Icon style={{ width: 12, height: 12 }} />
              {label}
              {badgeVal !== null && (
                <span style={{ fontSize: 8, fontWeight: 900, color: badgeColor!, background: `${badgeColor}15`, border: `1px solid ${badgeColor}30`, borderRadius: 4, padding: "1px 4px" }}>{badgeVal}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Open actions */}
            {c.open_actions > 0 && (
              <div style={{ background: "rgba(168,85,247,0.06)", border: `1px solid ${PURPLE}20`, borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: PURPLE, marginBottom: 10 }}>
                  {c.open_actions} Open Action Items
                </div>
                {[
                  c.docs_uploaded < c.docs_required && `Upload ${c.docs_required - c.docs_uploaded} remaining document(s)`,
                  c.rx_status === "none" && "Upload Rx/PBM contract for PBM Contract Clarity 360™ analysis",
                  c.sl_status === "none" && "Upload stop-loss policy for Stop-Loss IQ™ analysis",
                  c.rx_status === "analyzed" && c.rx_score !== null && c.rx_score < 50 && "Review critical Rx fiduciary gaps — score below 50",
                  c.sl_status === "analyzed" && c.sl_score !== null && c.sl_score < 50 && "Review critical stop-loss gaps — score below 50",
                  c.days_to_renewal <= 60 && "Prepare recommendation package — renewal approaching",
                ].filter(Boolean).slice(0, c.open_actions).map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0",
                    borderBottom: i < c.open_actions - 1 ? "1px solid rgba(168,85,247,0.1)" : "none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: PURPLE, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{action as string}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Plan details */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 14 }}>Plan Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Plan Type", value: c.plan_type },
                  { label: "TPA", value: c.tpa },
                  { label: "PBM", value: c.pbm },
                  { label: "Stop-Loss Carrier", value: c.sl_carrier },
                  { label: "Location", value: `${c.city}, ${c.state}` },
                  { label: "Employees", value: (c.employees ?? 0).toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(15,23,42,0.08)", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#0f172a" }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Broker notes */}
            {c.notes && (
              <div style={{ background: "#ffffff", border: `1px solid ${GOLD}15`, borderRadius: 14, padding: "16px 20px", borderLeft: `3px solid ${GOLD}` }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>Broker Notes</div>
                <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.7 }}>{c.notes}</div>
              </div>
            )}
          </div>

          {/* Contact + doc summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Primary Contact</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>{c.contact_name}</div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{c.contact_title}</div>
              <div style={{ fontSize: 11, color: BLUE }}>{c.contact_email}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 12 }}>Document Status</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: c.docs_uploaded >= c.docs_required ? GREEN : GOLD }}>
                {c.docs_uploaded}<span style={{ fontSize: 14, color: "#64748b", fontWeight: 400 }}>/{c.docs_required}</span>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>documents uploaded</div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginTop: 12 }}>
                <div style={{ width: `${Math.min((c.docs_uploaded / Math.max(c.docs_required, 1)) * 100, 100)}%`, height: "100%",
                  background: c.docs_uploaded >= c.docs_required ? GREEN : GOLD, borderRadius: 3 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "rx"       && <RxDefenseTab  c={c} />}
      {tab === "stoploss" && <StopLossTab   c={c} />}

      {tab === "timeline" && c.timeline && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px 28px" }}>
          <RenewalTimeline stages={c.timeline} daysToRenewal={c.days_to_renewal} />
        </div>
      )}

      {tab === "documents" && (
        <DocumentVault docs={c.documents || []} docsUploaded={c.docs_uploaded} docsRequired={c.docs_required} />
      )}

      {tab === "notes" && (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px 28px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#64748b", marginBottom: 16 }}>Broker Notes & Service Log</div>
          {c.notes && (
            <div style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>Latest Note</div>
              <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.7 }}>{c.notes}</div>
              <div style={{ fontSize: 10, color: "rgba(15,23,42,0.08)", marginTop: 8 }}>Jeremiah Shrack · Kincaid Health</div>
            </div>
          )}
          <div style={{ background: "rgba(0,0,0,0.05)", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", minHeight: 100, color: "rgba(15,23,42,0.08)", fontSize: 12, fontStyle: "italic" }}>
            Add new note…
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ROOT PAGE ──────────────────────────────────────────────────────────── */
export default function SaasBroker() {
  const [view, setView] = useState<"dashboard" | "book" | "client" | "prospects" | "intelligence">("dashboard");
  const [intelSubView, setIntelSubView] = useState<"brief" | "pipeline" | "registry" | "benchmark" | "ingest">("brief");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/saas/broker/dashboard"] });

  function openClient(id: string) {
    setSelectedClientId(id);
    setView("client");
  }

  const broker = data?.broker;

  const INTEL_GOLD = "#D4AF37";
  const NAV_ITEMS = [
    { id: "dashboard",    label: "Dashboard",          icon: LayoutDashboard, color: BLUE,       glow: "#00D4FF" },
    { id: "book",         label: "Book of Business",   icon: Briefcase,       color: GOLD,       glow: "#FFB800" },
    { id: "prospects",    label: "Indiana Prospects",  icon: MapPin,          color: GREEN,      glow: "#00FF94" },
    { id: "intelligence", label: "Pre-Call Intel™",    icon: Zap,             color: INTEL_GOLD, glow: "#D4AF37" },
  ] as const;

  return (
    <Layout>
      <div style={{ background: "#F8FAFC", minHeight: "100vh", color: "#0F172A" }}>
        {/* ── BROKER IQ CONSOLE — Sticky top bar ── */}
        <div style={{ position: "sticky", top: 0, zIndex: 100,
          background: "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,250,252,0.70))", backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
          padding: "0 32px", display: "flex", alignItems: "center", gap: 12, height: 38 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7,
            background: `linear-gradient(90deg, ${GOLD}16, ${GOLD}06)`,
            border: `1px solid ${GOLD}35`, borderRadius: 7, padding: "3px 11px 3px 9px" }}>
            <span style={{ fontSize: 10, color: GOLD }}>◈</span>
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: GOLD }}>
              Sales IQ Console
            </span>
          </div>
          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${GOLD}18, transparent)` }} />
          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)" }}>Kincaid Health · Fiduciary Grade · SHRACK-7742</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px",
            background: "rgba(0,255,148,0.07)", border: "1px solid rgba(0,255,148,0.18)", borderRadius: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, boxShadow: `0 0 5px ${GREEN}` }} />
            <span style={{ fontSize: 8, fontWeight: 800, color: GREEN, letterSpacing: "0.1em" }}>LIVE</span>
          </div>
        </div>

        {/* Live ticker */}
        <TickerBar />

        {/* Broker hero header */}
        <div style={{ padding: "20px 32px 0", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* Avatar */}
              <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}10)`, border: `1px solid ${GOLD}40`, flexShrink: 0 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>JS</span>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                    {broker?.name || "Jeremiah Shrack"}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 900, background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}30`,
                    borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    SHRACK-7742
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                  {broker?.title || "Chief Executive Officer"} · {broker?.firm || "Kincaid Health"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                background: "rgba(0,255,148,0.06)", border: "1px solid rgba(0,255,148,0.15)", borderRadius: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: GREEN }}>LIVE</span>
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Nav tabs */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 0 }}>
            {NAV_ITEMS.map(({ id, label, icon: Icon, color, glow }) => {
              const isActive = view === id || (view === "client" && id === "book");
              return (
                <button key={id} onClick={() => setView(id as any)} data-testid={`broker-nav-${id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: isActive ? "11px 20px" : "9px 18px",
                    fontSize: isActive ? 13 : 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    background: isActive
                      ? `linear-gradient(135deg, ${color}28, ${color}12)`
                      : `${color}08`,
                    border: `1px solid ${color}${isActive ? "60" : "25"}`,
                    borderBottom: isActive ? `3px solid ${color}` : `1px solid ${color}25`,
                    borderRadius: "10px 10px 0 0",
                    color: isActive ? color : `${color}99`,
                    boxShadow: isActive ? `0 -2px 16px ${glow}22, inset 0 1px 0 ${color}18` : "none",
                    transition: "all 0.15s",
                    position: "relative",
                    minWidth: 140,
                    justifyContent: "center",
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = `${color}14`;
                      e.currentTarget.style.color = `${color}cc`;
                      e.currentTarget.style.borderColor = `${color}45`;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = `${color}08`;
                      e.currentTarget.style.color = `${color}99`;
                      e.currentTarget.style.borderColor = `${color}25`;
                    }
                  }}>
                  <Icon style={{ width: isActive ? 15 : 14, height: isActive ? 15 : 14, flexShrink: 0 }} />
                  {label}
                  {isActive && (
                    <span style={{ position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                      width: 32, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                      borderRadius: 2 }} />
                  )}
                </button>
              );
            })}
            {view === "client" && selectedClientId && data?.clients && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
                fontSize: 12, fontWeight: 700, color: GOLD, background: `${GOLD}08`,
                border: `1px solid ${GOLD}25`, borderBottom: `3px solid ${GOLD}`,
                borderRadius: "10px 10px 0 0", marginLeft: 4 }}>
                <ChevronRight style={{ width: 12, height: 12, opacity: 0.5 }} />
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {data.clients.find(c => c.id === selectedClientId)?.name || "Client"}
                </span>
              </div>
            )}

            {/* Actuarial Engine IQ — always visible as nav tab */}
            <div style={{ marginLeft: "auto" }}>
              <button onClick={() => navigate("/actuarial-engine")}
                data-testid="broker-nav-actuarial"
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", background: `${BLUE}06`,
                  border: `1px solid ${BLUE}20`, borderBottom: "1px solid transparent",
                  borderRadius: "10px 10px 0 0",
                  color: "rgba(0,212,255,0.6)", transition: "all 0.12s" }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = "#00D4FF";
                  e.currentTarget.style.background = `${BLUE}14`;
                  e.currentTarget.style.borderColor = `${BLUE}40`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = "rgba(0,212,255,0.6)";
                  e.currentTarget.style.background = `${BLUE}06`;
                  e.currentTarget.style.borderColor = `${BLUE}20`;
                }}>
                <Calculator style={{ width: 13, height: 13 }} />
                Actuarial Engine IQ™
              </button>
            </div>
          </div>
        </div>

        {/* Pre-Call Intel™ Sub-Nav */}
        {view === "intelligence" && (
          <div style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid rgba(212,175,55,0.18)",
            background: "rgba(212,175,55,0.04)",
            overflowX: "auto",
            padding: "0 32px",
          }}>
            {[
              { id: "brief",     label: "ACCOUNT BRIEF",       badge: "SBI™" },
              { id: "pipeline",  label: "PIPELINE",             badge: null },
              { id: "registry",  label: "FEDERAL API REGISTRY", badge: "6 API" },
              { id: "benchmark", label: "BENCHMARK",            badge: "k≥11" },
              { id: "ingest",    label: "INGEST LOG",           badge: null },
            ].map((sv) => {
              const isActive = intelSubView === sv.id;
              return (
                <button
                  key={sv.id}
                  onClick={() => setIntelSubView(sv.id as any)}
                  data-testid={`intel-sub-${sv.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom: isActive ? "2px solid #D4AF37" : "2px solid transparent",
                    color: isActive ? "#D4AF37" : "rgba(212,175,55,0.5)",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {sv.label}
                  {sv.badge && (
                    <span style={{
                      fontSize: 7,
                      color: isActive ? "#000" : "#D4AF37",
                      background: isActive ? "#D4AF37" : "rgba(212,175,55,0.12)",
                      border: "1px solid rgba(212,175,55,0.30)",
                      borderRadius: 3,
                      padding: "1px 4px",
                      letterSpacing: "0.08em",
                    }}>
                      {sv.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 8px" }}>
              <span style={{ fontSize: 8, color: "rgba(212,175,55,0.4)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em", fontStyle: "italic" }}>
                Cold call is dead. Evidence briefing is the motion.
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{
          padding: view === "intelligence" ? 0 : "28px 32px",
          maxWidth: view === "intelligence" ? "none" : 1400,
          margin: "0 auto",
        }}>
          {view !== "intelligence" && isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <RefreshCw style={{ width: 22, height: 22, color: GOLD, animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 12, color: "#64748b" }}>Loading broker console…</span>
              </div>
            </div>
          ) : view === "intelligence" ? (
            <>
              {intelSubView === "brief"     && <AccountBriefView />}
              {intelSubView === "pipeline"  && <PipelineView />}
              {intelSubView === "registry"  && <ApiRegistryView />}
              {intelSubView === "benchmark" && <BenchmarkView />}
              {intelSubView === "ingest"    && <IngestLogView />}
            </>
          ) : !data ? null : (
            <>
              {view === "dashboard" && (
                <DashboardTab data={data} onSelectClient={openClient} />
              )}
              {(view === "book") && (
                <BookOfBusiness clients={data.clients} onSelect={openClient} />
              )}
              {view === "client" && selectedClientId && (
                <ClientWorkspace clientId={selectedClientId} onBack={() => setView("book")} />
              )}
              {view === "prospects" && (
                <ProspectsView />
              )}
            </>
          )}
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </Layout>
  );
}
