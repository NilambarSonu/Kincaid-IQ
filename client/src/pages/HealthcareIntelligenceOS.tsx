/**
 * HIOS — Healthcare Intelligence Operating System
 * Palantir Foundry × Bloomberg Terminal × NSA fusion center.
 *
 * 6 tabs · 4-tile doctrine command center · 3-tier multi-agent panel
 * Cross-wired to Claims Recovery, Rx Defense, Fiduciary IQ.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Brain, Briefcase, ChevronRight, Cpu, Download,
  Gauge, Gavel, Loader2, Network, Radio, Shield, Target, TrendingUp, Users,
  Zap, FileText, Eye, Pill, Building2, Server, Globe2, Clock,
  DollarSign, PiggyBank, Trophy, Flame, Bell, Command as CmdIcon, Search,
  Lock, MessageSquare, Send, AtSign, X, CornerDownLeft,
  Phone, Upload, BookOpen, CheckCircle2, XCircle, Award,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useManifestDownload } from "@/hooks/use-manifest-download";
import { Link } from "wouter";

const N = { green: "#00FF94", gold: "#FFB800", red: "#FF4D6D", orange: "#FF6B1A", blue: "#00D4FF", purple: "#A855F7" };

type Tab = "command" | "value" | "prior-auth" | "pbm" | "litigation" | "workforce" | "agents" | "enterprise";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "command",    label: "Command Center",     icon: Gauge },
  { id: "value",      label: "Value Ledger",       icon: DollarSign },
  { id: "prior-auth", label: "Prior Auth",         icon: Pill },
  { id: "pbm",        label: "PBM Forensics",      icon: Shield },
  { id: "litigation", label: "ERISA Litigation",   icon: Gavel },
  { id: "workforce",  label: "Workforce Impact",   icon: Users },
  { id: "agents",     label: "Agent Network",      icon: Brain },
  { id: "enterprise", label: "Enterprise Ops",     icon: Building2 },
];

/* ─── shared helpers ───────────────────────────────────────────────────────── */
const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `$${(n/1_000).toFixed(1)}K`     : `$${(n||0).toFixed(0)}`;

function CSVButton({ kind, label }: { kind: string; label?: string }) {
  return (
    <a href={`/api/hios/exports/${kind}.csv`} download
       data-testid={`csv-${kind}`}
       className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors"
       style={{ background: "rgba(0,212,255,0.10)", border: "1px solid rgba(0,212,255,0.28)", color: N.blue }}>
      <Download size={10} />
      {label ?? "CSV"}
    </a>
  );
}

const TIER_COLOR: Record<string, string> = {
  CERTIFIED: N.green, MODELED: N.gold, INSUFFICIENT_EVIDENCE: N.red,
  CRITICAL: N.red, HIGH: N.orange, MEDIUM: N.gold, LOW: N.blue,
  DEFINITIVE: N.green, STRONG: N.blue, MODERATE: N.gold, WEAK: N.orange,
};
const sevColor = (s: string) => TIER_COLOR[s] ?? "rgba(255,255,255,0.4)";

/* ─── DOCTRINE STRIP ────────────────────────────────────────────────────────── */
function DoctrineStrip({ data }: { data: any }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.03] to-transparent p-4 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: N.green }} />
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/55">
            HIOS · Healthcare Intelligence Operating System · LIVE
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-white/40">
          <span>{data?.system_health?.agents_online ?? 0} agents online</span>
          <span>·</span>
          <span>{data?.system_health?.ingestion_streams ?? 0} live streams</span>
          <span>·</span>
          <span>T1:{data?.system_health?.tier_1_active ?? 0} T2:{data?.system_health?.tier_2_active ?? 0} T3:{data?.system_health?.tier_3_active ?? 0}</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/50 leading-relaxed italic">
        "Every healthcare decision may eventually appear before a federal judge."
        &nbsp;— continuously operating as PBM forensic auditor, ERISA litigator, McKinsey strategist, and Chief Medical Officer, simultaneously.
      </p>
    </div>
  );
}

/* ─── COMMAND CENTER ────────────────────────────────────────────────────────── */
function CommandCenter() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/command"] });
  const { data: feedData } = useQuery<any>({ queryKey: ["/api/hios/intelligence-feed"], refetchInterval: 15_000 });

  if (isLoading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <DoctrineStrip data={data} />

      {/* 4-TILE DOCTRINE ROW — Hard Rule #1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.tiles?.map((t: any) => (
          <div
            key={t.id}
            data-testid={`tile-${t.id}`}
            className="rounded-2xl p-5 border relative overflow-hidden group cursor-pointer hover-elevate"
            style={{ background: `linear-gradient(180deg, ${t.color}10 0%, transparent 80%)`, borderColor: `${t.color}30` }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/45">{t.label}</p>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: TIER_COLOR[t.tier], background: TIER_COLOR[t.tier] + "15" }}>{t.tier}</span>
            </div>
            <p className="text-3xl font-bold text-white tracking-tight" style={{ color: t.color }}>{t.primary}</p>
            <p className="text-[11px] text-white/55 mt-1 truncate">{t.secondary}</p>
            <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-wider text-white/35">GATE · {t.gate}</span>
              <Eye size={11} className="text-white/30 group-hover:text-white/70 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {/* CROSS-MODULE WIRING ROW */}
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55">Cross-Module Intelligence</p>
            <p className="text-[11px] text-white/35 mt-0.5">HIOS draws live signal from every Kincaid IQ subsystem.</p>
          </div>
          <Network size={14} className="text-white/30" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Claims Recovery Pursuits Open", val: data.cross_module?.recovery_actions_open ?? 0,                                     href: "/claims-recovery", icon: Briefcase, c: N.orange },
            { label: "Dollars Recovered",             val: `$${((data.cross_module?.recovery_dollars_returned ?? 0)/1000).toFixed(1)}K`,      href: "/claims-recovery", icon: TrendingUp, c: N.green  },
            { label: "Rx Defense Contracts Analyzed", val: data.cross_module?.rx_defense_contracts_analyzed ?? 0,                             href: "/rx-defense",      icon: FileText,  c: N.purple },
            { label: "Fiduciary Plans Under Mgmt",    val: data.cross_module?.fiduciary_plans_under_management ?? 0,                          href: "/fiduciary-iq",    icon: Shield,    c: N.blue   },
          ].map((c) => (
            <Link key={c.label} href={c.href}>
              <a className="block p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.15] transition-colors group cursor-pointer" data-testid={`xmod-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon size={11} style={{ color: c.c }} />
                  <span className="text-[10px] text-white/40 uppercase tracking-wider truncate">{c.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold" style={{ color: c.c }}>{c.val}</p>
                  <ChevronRight size={12} className="text-white/20 group-hover:text-white/60" />
                </div>
              </a>
            </Link>
          ))}
        </div>
      </div>

      {/* LIVE INTELLIGENCE FEED */}
      <IntelligenceFeed events={feedData?.events ?? []} />

      {/* DOCTRINE CARD */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={12} style={{ color: N.gold }} />
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/55">Constitutional Doctrine — Four Hard Rules</p>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {data.doctrine?.hard_rules?.map((r: string, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02]">
              <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: N.gold + "20", color: N.gold }}>{i + 1}</span>
              <p className="text-xs text-white/65">{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── LIVE INTELLIGENCE FEED ────────────────────────────────────────────────── */
function IntelligenceFeed({ events }: { events: any[] }) {
  const lvlColor: Record<string, string> = {
    ALERT: N.red, FLAG: N.orange, ACTION: N.blue, INTEL: N.purple,
    MODEL: N.gold, GAP: N.red, TREND: N.green, CERT: N.green, ORCH: N.blue,
  };
  return (
    <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] overflow-hidden">
      <div className="px-5 py-3 flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02]">
        <Radio size={11} className="animate-pulse" style={{ color: N.green }} />
        <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/65">Live Intelligence Stream</p>
        <span className="ml-auto text-[10px] text-white/35">Auto-refresh · 15s</span>
      </div>
      <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
        {events.map((e, i) => (
          <div key={i} className="px-5 py-2.5 hover:bg-white/[0.02] transition-colors flex items-start gap-3" data-testid={`feed-event-${i}`}>
            <span className="text-[9px] font-mono text-white/30 w-12 flex-shrink-0 mt-0.5">T{e.tier}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5" style={{ color: lvlColor[e.level] ?? "#fff", background: (lvlColor[e.level] ?? "#fff") + "18" }}>{e.level}</span>
            <p className="text-xs text-white/70 flex-1">{e.msg}</p>
            <span className="text-[9px] text-white/25 flex-shrink-0 mt-0.5">{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PRIOR AUTH TAB ────────────────────────────────────────────────────────── */
function PriorAuthTab() {
  const { toast } = useToast();
  const { downloadWithManifest } = useManifestDownload();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/prior-auth/queue"] });
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [intakeOpen, setIntakeOpen] = useState<any | null>(null);
  const [intakePrefill, setIntakePrefill] = useState<any | null>(null);
  const [parseOpen, setParseOpen] = useState(false);
  const [p2pCase, setP2pCase] = useState<any | null>(null);
  const [outcomeCase, setOutcomeCase] = useState<any | null>(null);
  const [playbookCase, setPlaybookCase] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data: outcomes } = useQuery<any>({ queryKey: ["/api/hios/prior-auth/outcomes"] });

  async function generateAppeal(caseId: string) {
    setBusy(caseId);
    try {
      await downloadWithManifest("/api/hios/prior-auth/appeal", {
        filename: `Appeal-${caseId}.txt`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pa_case_id: caseId }),
        },
      });
    } catch (e: any) {
      toast({ title: "Appeal failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (isLoading || !data) return <Loading />;
  const cases: any[] = data.cases ?? [];
  const s = data.summary ?? {};

  const filtered = cases.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!q) return true;
    const hay = `${c.id} ${c.drug} ${c.indication} ${c.payer} ${c.patient_ref}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const statusCounts: Record<string, number> = {};
  cases.forEach((c) => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });
  const statuses = ["all", "denied", "pending_denial", "pending_review", "step_therapy"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { l: "Total in Queue",       v: s.total,                       c: N.blue   },
          { l: "Pending",              v: s.pending,                     c: N.gold   },
          { l: "Denied",               v: s.denied,                      c: N.red    },
          { l: "High-Prob. Denial",    v: s.high_probability_denial,     c: N.orange },
          { l: "Modeled Appeal Wins",  v: s.predicted_appeal_wins,       c: N.green  },
          { l: "Annual $ at Risk",     v: `$${(s.total_annual_cost/1000).toFixed(0)}K`, c: N.purple },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{k.l}</p>
            <p className="text-lg font-bold" style={{ color: k.c }}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* WALL OF WINS — actual outcomes (from recovery_actions) */}
      {outcomes && outcomes.total > 0 && (
        <div className="rounded-xl p-4 flex items-center gap-6 flex-wrap" style={{ background: `linear-gradient(90deg, ${N.green}10, ${N.gold}08)`, border: `1px solid ${N.green}30` }}>
          <div className="flex items-center gap-2">
            <Award size={16} style={{ color: N.green }} />
            <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: N.green }}>Wall of Wins · Actual Outcomes</span>
          </div>
          <Stat label="Won"        v={outcomes.won}                                                color={N.green} />
          <Stat label="Lost"       v={outcomes.lost}                                               color={N.red} />
          <Stat label="Pending"    v={outcomes.pending}                                            color={N.gold} />
          <Stat label="Win Rate"   v={`${(outcomes.win_rate * 100).toFixed(0)}%`}                  color={N.blue} />
          <Stat label="Recovered"  v={`$${(outcomes.dollars_recovered/1000).toFixed(1)}K`}         color={N.gold} />
          <Stat label="Contingency"v={`$${(outcomes.contingency_earned/1000).toFixed(1)}K`}        color={N.purple} />
          <span className="text-[10px] text-white/40 ml-auto">Written to <span className="font-mono text-white/60">recovery_actions</span> · feeds Value Ledger</span>
        </div>
      )}

      {/* SEARCH + FILTER + PARSE-DENIAL */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setParseOpen(true)}
          data-testid="pa-parse-denial"
          className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold"
          style={{ background: N.gold + "15", border: `1px solid ${N.gold}40`, color: N.gold }}
        >
          <Upload size={11} /> Parse Denial Letter
        </button>
        <div className="flex items-center gap-2 px-3 h-9 rounded-lg flex-1 min-w-[260px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Search size={12} className="text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search case ID, drug, indication, payer, member..."
            className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-white/30"
            data-testid="pa-search"
          />
          {q && <button onClick={() => setQ("")} className="text-white/40 hover:text-white/80"><X size={12} /></button>}
        </div>
        <div className="flex items-center gap-1">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              data-testid={`pa-filter-${st}`}
              className="px-2.5 h-9 rounded-lg text-[10px] font-semibold tracking-wider uppercase transition-colors"
              style={{
                background: statusFilter === st ? N.blue + "20" : "rgba(255,255,255,0.03)",
                border: `1px solid ${statusFilter === st ? N.blue + "50" : "rgba(255,255,255,0.08)"}`,
                color: statusFilter === st ? N.blue : "rgba(255,255,255,0.55)",
              }}
            >
              {st.replace(/_/g, " ")} {st !== "all" && statusCounts[st] ? `· ${statusCounts[st]}` : st === "all" ? `· ${cases.length}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2">
          <Pill size={11} style={{ color: N.purple }} />
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/65">Prior Authorization Queue</p>
          <span className="ml-auto text-[10px] text-white/35">
            {filtered.length} of {cases.length} · <span style={{ color: N.blue }}>Guided Appeal</span> = best output (structured intake → GPT-drafted) · <span style={{ color: N.purple }}>Quick Appeal</span> = one-click template
          </span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-white/40">No cases match. Try clearing search or filter.</div>
          )}
          {filtered.map((c) => {
            const daysLeft = Math.max(0, 180 - (c.days_in_queue || 0));
            const deadlineColor = daysLeft <= 14 ? N.red : daysLeft <= 60 ? N.orange : N.green;
            return (
              <div key={c.id} className="p-4 hover:bg-white/[0.02] transition-colors" data-testid={`pa-case-${c.id}`}>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <button
                    onClick={() => copyId(c.id)}
                    className="font-mono text-[10px] text-white/45 hover:text-white/80 flex items-center gap-1 group"
                    title="Copy ID"
                    data-testid={`pa-copy-${c.id}`}
                  >
                    {c.id}
                    <span className="opacity-0 group-hover:opacity-100 text-[9px]" style={{ color: copiedId === c.id ? N.green : "rgba(255,255,255,0.4)" }}>
                      {copiedId === c.id ? "✓ copied" : "copy"}
                    </span>
                  </button>
                  <span className="text-sm font-semibold text-white">{c.drug}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: sevColor(c.clinical_strength), background: sevColor(c.clinical_strength) + "18" }}>{c.clinical_strength}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: deadlineColor, background: deadlineColor + "12", border: `1px solid ${deadlineColor}30` }} title="Appeal deadline (180-day default ERISA window)">
                    {daysLeft}d to file
                  </span>
                  <span className="text-[10px] text-white/35 ml-auto">{c.payer}</span>
                  <span className="text-sm font-bold" style={{ color: N.gold }}>${c.annual_cost.toLocaleString()}/yr</span>
                </div>
                <p className="text-xs text-white/55 mb-3">{c.indication}</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <DenialBar label="Denial Probability" pct={c.denial_probability * 100} color={c.denial_probability >= 0.7 ? N.red : c.denial_probability >= 0.4 ? N.gold : N.green} />
                  <DenialBar label="Modeled Appeal Win" pct={c.appeal_win_rate * 100} color={N.green} />
                  <div className="text-xs text-white/45 flex flex-col justify-center">
                    <span>Status: <span className="text-white/80 font-semibold">{c.status.replace(/_/g, " ")}</span></span>
                    <span>Days in queue: <span className="text-white/80">{c.days_in_queue}</span></span>
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10px] text-white/35">Routed to <span className="font-mono text-white/55">{c.agent}</span></span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setPlaybookCase(c.payer)}
                      data-testid={`pa-playbook-${c.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}
                      title="Payer-specific playbook"
                    >
                      <BookOpen size={11} /> Playbook
                    </button>
                    <button
                      onClick={() => setP2pCase(c)}
                      data-testid={`pa-p2p-${c.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: N.orange + "15", border: `1px solid ${N.orange}40`, color: N.orange }}
                    >
                      <Phone size={11} /> P2P Script
                    </button>
                    <button
                      onClick={() => setOutcomeCase(c)}
                      data-testid={`pa-outcome-${c.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: N.green + "15", border: `1px solid ${N.green}40`, color: N.green }}
                    >
                      <Trophy size={11} /> Log Outcome
                    </button>
                    <button
                      onClick={() => setIntakeOpen(c)}
                      data-testid={`appeal-intake-${c.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: N.blue + "20", border: `1px solid ${N.blue}50`, color: N.blue }}
                    >
                      <FileText size={11} />
                      Guided Appeal
                    </button>
                    <button
                      onClick={() => generateAppeal(c.id)}
                      disabled={busy === c.id}
                      data-testid={`appeal-${c.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: N.purple + "15", border: `1px solid ${N.purple}40`, color: N.purple }}
                    >
                      {busy === c.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                      Quick
                    </button>
                  </div>
                </div>
                <CommentsBlock findingId={c.id} />
              </div>
            );
          })}
        </div>
      </div>

      {intakeOpen && <AppealIntakeDrawer paCase={intakeOpen} prefill={intakePrefill} onClose={() => { setIntakeOpen(null); setIntakePrefill(null); }} />}
      {parseOpen && <ParseDenialModal onClose={() => setParseOpen(false)} onParsed={(p) => {
        const matchedCase = cases.find((c) => p.drug_or_service && c.drug.toLowerCase().includes(String(p.drug_or_service).toLowerCase())) || cases.find((c) => p.payer_name && c.payer.toLowerCase().includes(String(p.payer_name).toLowerCase())) || cases[0];
        setIntakePrefill(p);
        setIntakeOpen(matchedCase);
        setParseOpen(false);
      }} />}
      {p2pCase && <P2PModal paCase={p2pCase} onClose={() => setP2pCase(null)} />}
      {outcomeCase && <OutcomeModal paCase={outcomeCase} onClose={() => setOutcomeCase(null)} />}
      {playbookCase && <PayerPlaybookModal payer={playbookCase} onClose={() => setPlaybookCase(null)} />}
    </div>
  );
}

/* ─── GUIDED APPEAL INTAKE DRAWER ──────────────────────────────────────────── */
function AppealIntakeDrawer({ paCase, prefill, onClose }: { paCase: any; prefill?: any; onClose: () => void }) {
  const { toast } = useToast();
  const { downloadWithManifest } = useManifestDownload();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    denial_reason: prefill?.denial_reason || "not_medically_necessary",
    denial_reason_text: prefill?.denial_reason_text || "",
    denial_date: prefill?.denial_date || new Date().toISOString().slice(0, 10),
    appeal_deadline: prefill?.appeal_deadline || new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    icd10: prefill?.icd10 || "",
    prior_therapies: (prefill?.recommended_prior_therapies_to_document || []).join("\n"),
    clinical_notes: "",
    evidence_refs: (prefill?.recommended_evidence || []).join("\n"),
    provider_name: "",
    provider_npi: "",
    member_id: prefill?.member_id || paCase.patient_ref || "",
    group_number: prefill?.group_number || "",
    urgent: false,
  });

  function set<K extends keyof typeof form>(k: K, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    try {
      await downloadWithManifest(`/api/hios/prior-auth/${paCase.id}/appeal-intake`, {
        filename: `Appeal-${paCase.id}-guided.txt`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            prior_therapies: form.prior_therapies.split("\n").map((s: string) => s.trim()).filter(Boolean),
            evidence_refs:   form.evidence_refs.split("\n").map((s: string) => s.trim()).filter(Boolean),
          }),
        },
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Draft failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const reasons = [
    { v: "not_medically_necessary", l: "Not medically necessary" },
    { v: "step_therapy",            l: "Step therapy required" },
    { v: "non_formulary",           l: "Non-formulary" },
    { v: "experimental",            l: "Experimental / investigational" },
    { v: "quantity_limit",          l: "Quantity limit exceeded" },
    { v: "other",                   l: "Other / unspecified" },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-end" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} onClick={onClose} data-testid="appeal-intake-drawer">
      <div className="w-full max-w-[640px] h-full overflow-y-auto" style={{ background: "#070707", borderLeft: "1px solid rgba(255,255,255,0.10)" }} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-white/[0.08] flex items-center gap-3" style={{ background: "#070707" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: N.blue + "15", border: `1px solid ${N.blue}40` }}>
            <FileText size={15} style={{ color: N.blue }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/45">Guided Appeal Intake</p>
            <p className="text-sm font-semibold text-white">{paCase.drug} · <span className="text-white/55 font-normal">{paCase.payer}</span></p>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-white" data-testid="appeal-intake-close"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* CASE SUMMARY */}
          <div className="rounded-lg p-3 text-[11px]" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-white/40">Case</span><span className="text-white/80 font-mono ml-2">{paCase.id}</span></div>
              <div><span className="text-white/40">Annual cost</span><span className="font-bold ml-2" style={{ color: N.gold }}>${paCase.annual_cost.toLocaleString()}</span></div>
              <div><span className="text-white/40">Indication</span><span className="text-white/80 ml-2">{paCase.indication}</span></div>
              <div><span className="text-white/40">Modeled win</span><span className="font-bold ml-2" style={{ color: N.green }}>{(paCase.appeal_win_rate * 100).toFixed(0)}%</span></div>
            </div>
          </div>

          {/* DENIAL */}
          <SectionLabel>1 · Denial</SectionLabel>
          <Field label="Denial reason category">
            <select value={form.denial_reason} onChange={(e) => set("denial_reason", e.target.value)} data-testid="intake-reason" className="form-input">
              {reasons.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Field>
          <Field label="Exact denial language from letter (paste verbatim)">
            <textarea rows={2} value={form.denial_reason_text} onChange={(e) => set("denial_reason_text", e.target.value)} placeholder='e.g. "Member has not tried preferred step-1 agents..."' data-testid="intake-reason-text" className="form-input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Denial date">
              <input type="date" value={form.denial_date} onChange={(e) => set("denial_date", e.target.value)} data-testid="intake-denial-date" className="form-input" />
            </Field>
            <Field label="Appeal deadline">
              <input type="date" value={form.appeal_deadline} onChange={(e) => set("appeal_deadline", e.target.value)} data-testid="intake-deadline" className="form-input" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
            <input type="checkbox" checked={form.urgent} onChange={(e) => set("urgent", e.target.checked)} data-testid="intake-urgent" />
            <Flame size={11} style={{ color: N.red }} />
            File as expedited 72-hour review (urgent care exception, 29 CFR 2560.503-1(f)(2)(i))
          </label>

          {/* CLINICAL */}
          <SectionLabel>2 · Clinical case</SectionLabel>
          <Field label="ICD-10 diagnosis code">
            <input value={form.icd10} onChange={(e) => set("icd10", e.target.value)} placeholder="e.g. M06.9" data-testid="intake-icd10" className="form-input" />
          </Field>
          <Field label="Prior therapies tried & failed (one per line)">
            <textarea rows={3} value={form.prior_therapies} onChange={(e) => set("prior_therapies", e.target.value)} placeholder={"Methotrexate 25mg/wk × 6mo — inadequate response\nSulfasalazine 2g/d × 3mo — GI intolerance"} data-testid="intake-prior" className="form-input" />
          </Field>
          <Field label="Clinical notes / prescriber rationale">
            <textarea rows={3} value={form.clinical_notes} onChange={(e) => set("clinical_notes", e.target.value)} placeholder="Disease severity, labs, progression, why this therapy now..." data-testid="intake-notes" className="form-input" />
          </Field>
          <Field label="Evidence citations (one per line)">
            <textarea rows={2} value={form.evidence_refs} onChange={(e) => set("evidence_refs", e.target.value)} placeholder={"FDA label — Humira (adalimumab), 2024\nACR Guideline for RA Management 2021"} data-testid="intake-evidence" className="form-input" />
          </Field>

          {/* PROVIDER + COVERAGE */}
          <SectionLabel>3 · Provider &amp; coverage</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prescribing provider">
              <input value={form.provider_name} onChange={(e) => set("provider_name", e.target.value)} placeholder="Dr. Jane Smith" data-testid="intake-provider" className="form-input" />
            </Field>
            <Field label="NPI">
              <input value={form.provider_npi} onChange={(e) => set("provider_npi", e.target.value)} placeholder="1234567890" data-testid="intake-npi" className="form-input" />
            </Field>
            <Field label="Member ID">
              <input value={form.member_id} onChange={(e) => set("member_id", e.target.value)} data-testid="intake-member" className="form-input" />
            </Field>
            <Field label="Group number">
              <input value={form.group_number} onChange={(e) => set("group_number", e.target.value)} placeholder="GRP-12345" data-testid="intake-group" className="form-input" />
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-6 px-6 py-4 border-t border-white/[0.08] flex items-center gap-3" style={{ background: "#070707" }}>
            <p className="text-[10px] text-white/40 flex-1">GPT-drafted · ERISA §503 + denial-reason citations auto-injected · SHA-256 manifest sidecar</p>
            <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-semibold text-white/60 hover:text-white" data-testid="intake-cancel">Cancel</button>
            <button
              onClick={submit}
              disabled={busy}
              data-testid="intake-submit"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ background: N.blue + "20", border: `1px solid ${N.blue}50`, color: N.blue }}
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {busy ? "Drafting…" : "Draft & Download Appeal"}
            </button>
          </div>
        </div>

        <style>{`
          .form-input {
            width: 100%;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 8px;
            padding: 8px 10px;
            font-size: 12px;
            color: rgba(255,255,255,0.9);
            outline: none;
            resize: vertical;
          }
          .form-input:focus { border-color: rgba(0,212,255,0.4); }
          .form-input::placeholder { color: rgba(255,255,255,0.25); }
          select.form-input { appearance: auto; }
        `}</style>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: any }) {
  return <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/55 pt-2">{children}</p>;
}
function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, v, color }: { label: string; v: any; color: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="text-base font-bold" style={{ color }}>{v}</p>
    </div>
  );
}

/* ─── PARSE DENIAL LETTER MODAL ────────────────────────────────────────────── */
function ParseDenialModal({ onClose, onParsed }: { onClose: () => void; onParsed: (p: any) => void }) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function readFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => setText(String(e.target?.result || ""));
    reader.readAsText(f);
  }

  async function submit() {
    if (text.trim().length < 30) {
      toast({ title: "Need more text", description: "Paste the full denial letter (>30 chars).", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/hios/prior-auth/parse-denial", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Parse failed (${res.status})`);
      const data = await res.json();
      toast({ title: "Denial parsed", description: `Reason: ${data.parsed?.denial_reason || "unknown"} · pre-filling intake form` });
      onParsed(data.parsed);
    } catch (e: any) {
      toast({ title: "Parse failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} onClick={onClose} data-testid="parse-denial-modal">
      <div className="w-full max-w-[680px] rounded-2xl overflow-hidden" style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.10)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: N.gold + "15", border: `1px solid ${N.gold}40` }}>
            <Upload size={15} style={{ color: N.gold }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/45">Parse Denial Letter</p>
            <p className="text-sm font-semibold text-white">Paste or upload → GPT extracts reason, codes, deadline, member ID</p>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-white/60 cursor-pointer px-3 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <input type="file" accept=".txt,.eml,.html" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} data-testid="parse-file" />
              Upload .txt / .eml
            </label>
            <span className="text-[10px] text-white/35">— or paste the letter text below</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste the full denial letter text here. GPT will extract: denial reason, exact denial language, denial date, appeal deadline, member ID, group #, ICD-10, drug name, payer, and recommend evidence to cite."
            data-testid="parse-text"
            className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.10] rounded-lg p-3 text-xs text-white/90 outline-none focus:border-[#FFB80060] resize-vertical font-mono"
          />
          <p className="text-[10px] text-white/40">PDFs: open in your PDF viewer → copy all → paste here. (Native PDF OCR coming next.)</p>
        </div>
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center gap-3">
          <p className="text-[10px] text-white/40 flex-1">{text.length} characters · audit-logged</p>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-semibold text-white/60 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="parse-submit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: N.gold + "20", border: `1px solid ${N.gold}50`, color: N.gold }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
            {busy ? "Parsing…" : "Parse & Pre-fill Intake"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PEER-TO-PEER SCRIPT MODAL ────────────────────────────────────────────── */
function P2PModal({ paCase, onClose }: { paCase: any; onClose: () => void }) {
  const { toast } = useToast();
  const { showManifestToast } = useManifestDownload();
  const [script, setScript] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [sha, setSha] = useState("");

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/hios/prior-auth/${paCase.id}/peer-to-peer`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!res.ok) throw new Error(`P2P failed (${res.status})`);
      const blob = await res.blob();
      setSha(res.headers.get("X-Kincaid-SHA256") || "");
      setScript(await blob.text());
    } catch (e: any) {
      toast({ title: "P2P script failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  function download() {
    const blob = new Blob([script], { type: "text/plain" });
    const filename = `P2P-${paCase.id}.txt`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    showManifestToast({ filename, sha256: sha, sizeBytes: blob.size });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} onClick={onClose} data-testid="p2p-modal">
      <div className="w-full max-w-[720px] max-h-[88vh] rounded-2xl overflow-hidden flex flex-col" style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.10)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: N.orange + "15", border: `1px solid ${N.orange}40` }}>
            <Phone size={15} style={{ color: N.orange }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/45">Peer-to-Peer Call Script</p>
            <p className="text-sm font-semibold text-white">{paCase.drug} · {paCase.payer}</p>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {!script && !busy && (
            <div className="text-center py-16">
              <Phone size={32} className="mx-auto mb-3" style={{ color: N.orange }} />
              <p className="text-sm text-white/70 mb-1">Generate a tactical P2P call script</p>
              <p className="text-[11px] text-white/45 mb-5">Opening · the case in 3 bullets · 5 likely payer rebuttals + counters · escalation tree · closing ask</p>
              <button onClick={generate} data-testid="p2p-generate" className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{ background: N.orange + "20", border: `1px solid ${N.orange}50`, color: N.orange }}>
                <Brain size={12} className="inline mr-1.5" /> Generate Script
              </button>
            </div>
          )}
          {busy && <div className="text-center py-16 text-white/50"><Loader2 size={20} className="inline mr-2 animate-spin" /> Drafting…</div>}
          {script && (
            <pre className="text-[11px] text-white/85 whitespace-pre-wrap font-mono leading-relaxed">{script}</pre>
          )}
        </div>
        {script && (
          <div className="px-6 py-4 border-t border-white/[0.08] flex items-center gap-3">
            <p className="text-[10px] text-white/40 flex-1">SHA-256 {sha.slice(0, 16)}…</p>
            <button onClick={download} data-testid="p2p-download" className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: N.orange + "20", border: `1px solid ${N.orange}50`, color: N.orange }}>
              <Download size={12} /> Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── OUTCOME LOGGER MODAL ─────────────────────────────────────────────────── */
function OutcomeModal({ paCase, onClose }: { paCase: any; onClose: () => void }) {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<"won" | "lost" | "withdrawn" | "pending">("won");
  const [dollars, setDollars] = useState<number>(paCase.annual_cost);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const options: { v: any; l: string; c: string; icon: any }[] = [
    { v: "won",       l: "Won — appeal approved",  c: N.green,  icon: CheckCircle2 },
    { v: "lost",      l: "Lost — denial upheld",   c: N.red,    icon: XCircle },
    { v: "withdrawn", l: "Withdrawn",              c: N.gold,   icon: X },
    { v: "pending",   l: "Pending decision",       c: N.blue,   icon: Clock },
  ];

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/hios/prior-auth/${paCase.id}/outcome`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, dollars_saved: outcome === "won" ? dollars : 0, notes }),
      });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      toast({
        title: `Outcome logged: ${outcome.toUpperCase()}`,
        description: outcome === "won"
          ? `$${data.dollars_saved.toLocaleString()} recovered · contingency $${data.contingency_fee.toLocaleString()} · recovery_action #${data.recovery_action_id}`
          : `Logged to recovery_actions #${data.recovery_action_id}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hios/prior-auth/outcomes"] });
      onClose();
    } catch (e: any) {
      toast({ title: "Log failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} onClick={onClose} data-testid="outcome-modal">
      <div className="w-full max-w-[520px] rounded-2xl overflow-hidden" style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.10)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: N.green + "15", border: `1px solid ${N.green}40` }}>
            <Trophy size={15} style={{ color: N.green }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/45">Log Appeal Outcome</p>
            <p className="text-sm font-semibold text-white">{paCase.drug} · {paCase.id}</p>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => {
              const Icon = o.icon;
              const active = outcome === o.v;
              return (
                <button key={o.v} onClick={() => setOutcome(o.v)} data-testid={`outcome-${o.v}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: active ? o.c + "20" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${active ? o.c + "60" : "rgba(255,255,255,0.10)"}`,
                    color: active ? o.c : "rgba(255,255,255,0.65)",
                  }}>
                  <Icon size={12} /> {o.l}
                </button>
              );
            })}
          </div>
          {outcome === "won" && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1">Dollars saved (annual)</label>
              <input type="number" value={dollars} onChange={(e) => setDollars(Number(e.target.value))} data-testid="outcome-dollars"
                className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.10] rounded-lg p-2 text-sm text-white outline-none focus:border-[#00FF9460]" />
              <p className="text-[10px] text-white/40 mt-1">Default: case annual cost. Contingency = 28% = <span className="font-bold" style={{ color: N.purple }}>${(dollars * 0.28).toLocaleString()}</span></p>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1">Notes (optional)</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="outcome-notes"
              placeholder="Reviewer name, decision rationale, peer-to-peer outcome..."
              className="w-full bg-[rgba(255,255,255,0.03)] border border-white/[0.10] rounded-lg p-2 text-xs text-white/90 outline-none focus:border-[#00FF9460] resize-vertical" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center gap-3">
          <p className="text-[10px] text-white/40 flex-1">Writes to <span className="font-mono text-white/60">recovery_actions</span> · feeds Wall of Wins + Value Ledger</p>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-semibold text-white/60 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="outcome-submit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: N.green + "20", border: `1px solid ${N.green}50`, color: N.green }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {busy ? "Logging…" : "Log Outcome"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── PAYER PLAYBOOK MODAL ─────────────────────────────────────────────────── */
function PayerPlaybookModal({ payer, onClose }: { payer: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/prior-auth/payer-playbook", payer] });
  const pb = data?.playbook;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} onClick={onClose} data-testid="playbook-modal">
      <div className="w-full max-w-[560px] rounded-2xl overflow-hidden" style={{ background: "#070707", border: "1px solid rgba(255,255,255,0.10)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <BookOpen size={15} className="text-white/80" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/45">Payer Playbook</p>
            <p className="text-sm font-semibold text-white">{data?.payer || payer}</p>
          </div>
          <button onClick={onClose} className="text-white/45 hover:text-white"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4 text-xs">
          {isLoading || !pb ? <Loading /> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <PBField l="Appeal fax"     v={pb.appeal_fax} />
                <PBField l="Appeal window"  v={`${pb.internal_appeal_window_days} days`} />
                <PBField l="Expedited"      v={`${pb.expedited_decision_hours} hours`} />
                <PBField l="Internal win rate" v={`${(pb.internal_win_rate * 100).toFixed(0)}%`} c={N.green} />
              </div>
              <PBField l="Appeal portal"  v={pb.appeal_portal} mono />
              <PBField l="Appeal address" v={pb.appeal_address} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-1.5">Common denial patterns</p>
                <ul className="space-y-1.5">
                  {pb.common_denial_patterns.map((p: string, i: number) => (
                    <li key={i} className="text-[11px] text-white/75 flex gap-2"><span style={{ color: N.orange }}>•</span> {p}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg p-3" style={{ background: N.blue + "10", border: `1px solid ${N.blue}30` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: N.blue }}>Language that works</p>
                <p className="text-[11px] text-white/85 leading-relaxed">{pb.language_tips}</p>
              </div>
              <p className="text-[9px] text-white/30">{data?.source}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function PBField({ l, v, c, mono }: { l: string; v: string; c?: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45 mb-0.5">{l}</p>
      <p className={`text-[12px] ${mono ? "font-mono" : "font-semibold"}`} style={{ color: c || "rgba(255,255,255,0.85)" }}>{v}</p>
    </div>
  );
}

function DenialBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1"><span className="text-[10px] text-white/40">{label}</span><span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span></div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ─── PBM FORENSICS ─────────────────────────────────────────────────────────── */
function PBMTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/pbm-forensics"] });
  const [busy, setBusy] = useState<string | null>(null);

  async function pushToRecovery(flagId: string, pbm: string) {
    setBusy(flagId);
    try {
      const res = await apiRequest("POST", `/api/hios/pbm-forensics/${flagId}/pursue`, {});
      const json = await res.json();
      toast({
        title: json.created ? "Pushed to Claims Recovery" : "Already in pipeline",
        description: `${pbm} · Action #${json.action_id} (${json.status}). Open Claims Recovery → Pipeline.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hios/pbm-forensics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hios/command"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims-recovery/pipeline"] });
    } catch (e: any) {
      toast({ title: "Handoff failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <Loading />;
  const flags: any[] = data.flags ?? [];
  const s = data.summary ?? {};
  const breakdown = Object.entries(s.pbm_breakdown ?? {}).map(([pbm, exp]) => ({ pbm, exp: exp as number }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-white/40">PBM Forensic Flags · {flags.length} active</p>
        <CSVButton kind="pbm" label="Export flags CSV" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { l: "Total Forensic Flags", v: s.total_flags,                                       c: N.orange },
          { l: "Aggregate Exposure",   v: `$${(s.total_exposure/1_000_000).toFixed(2)}M`,       c: N.gold   },
          { l: "CERTIFIED Findings",   v: s.certified_count,                                    c: N.green  },
          { l: "Peak Anomaly Score",   v: `${s.highest_anomaly}/100`,                           c: N.red    },
          { l: "Pushed to Recovery",   v: `${s.pushed_to_recovery ?? 0}/${s.total_flags}`,      c: N.blue   },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{k.l}</p>
            <p className="text-lg font-bold" style={{ color: k.c }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {flags.map((f) => (
            <div key={f.id} className="rounded-xl bg-white/[0.025] border border-white/[0.07] p-4" data-testid={`pbm-flag-${f.id}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-mono text-white/40">{f.id}</span>
                <span className="text-sm font-semibold text-white">{f.pbm}</span>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: N.orange, background: N.orange + "18" }}>{f.category}</span>
                <span className="text-[10px] px-2 py-0.5 rounded ml-auto" style={{ color: TIER_COLOR[f.confidence], background: TIER_COLOR[f.confidence] + "18" }}>{f.confidence}</span>
                <span className="text-base font-bold" style={{ color: N.gold }}>${f.estimated_exposure.toLocaleString()}</span>
              </div>
              <p className="text-xs text-white/60 mb-2">{f.evidence}</p>
              <div className="flex items-center justify-between text-[10px] mb-3">
                <span className="text-white/40">Drug Class: <span className="text-white/65">{f.drug_class}</span></span>
                <span className="text-white/40">Statutory: <span className="text-white/65">{f.regulatory_basis}</span></span>
                <span className="font-bold" style={{ color: f.anomaly_score >= 85 ? N.red : f.anomaly_score >= 70 ? N.orange : N.gold }}>Anomaly {f.anomaly_score}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                {f.recovery_action_id ? (
                  <Link href="/claims-recovery">
                    <a className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: N.green }} data-testid={`pbm-pushed-${f.id}`}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: N.green }} />
                      In Recovery Pipeline · Action #{f.recovery_action_id} · {f.recovery_status?.replace(/_/g, " ")}
                      <ChevronRight size={11} />
                    </a>
                  </Link>
                ) : <span className="text-[10px] text-white/30">Not yet pursued</span>}
                <button
                  onClick={() => pushToRecovery(f.id, f.pbm)}
                  disabled={busy === f.id || !!f.recovery_action_id}
                  data-testid={`pbm-pursue-${f.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40"
                  style={{ background: N.orange + "18", border: `1px solid ${N.orange}40`, color: N.orange }}
                >
                  {busy === f.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  {f.recovery_action_id ? "Already Pushed" : "Push to Claims Recovery"}
                </button>
              </div>
              <CommentsBlock findingId={f.id} />
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-4">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55 mb-3">Exposure by PBM</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={breakdown} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="pbm" type="category" stroke="#fff5" fontSize={10} width={90} />
              <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #fff2", fontSize: 11 }} formatter={(v: any) => `$${(v/1000).toFixed(0)}K`} />
              <Bar dataKey="exp" radius={[0, 4, 4, 0]}>
                {breakdown.map((_, i) => <Cell key={i} fill={[N.red, N.orange, N.gold][i % 3]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <Link href="/rx-defense"><a className="text-[11px] font-semibold flex items-center gap-1" style={{ color: N.blue }} data-testid="link-rx-defense">
              Open Rx Defense for full PBM contract scoring → <ChevronRight size={11} />
            </a></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LITIGATION RISK ───────────────────────────────────────────────────────── */
function LitigationTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/litigation-risk"] });
  const [busy, setBusy] = useState<string | null>(null);

  async function pushToRecovery(sigId: string, category: string) {
    setBusy(sigId);
    try {
      const res = await apiRequest("POST", `/api/hios/litigation-risk/${sigId}/pursue`, {});
      const json = await res.json();
      toast({
        title: json.created ? "Pushed to Claims Recovery" : "Already in pipeline",
        description: `${category} · Action #${json.action_id} (${json.status})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hios/litigation-risk"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hios/command"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims-recovery/pipeline"] });
    } catch (e: any) {
      toast({ title: "Handoff failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <Loading />;
  const signals: any[] = data.signals ?? [];
  const s = data.summary ?? {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-white/40">ERISA Litigation Risk Signals · {signals.length} active</p>
        <CSVButton kind="litigation" label="Export signals CSV" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "CRITICAL Triggers",   v: s.critical,                  c: N.red    },
          { l: "HIGH Severity",       v: s.high,                      c: N.orange },
          { l: "MEDIUM Severity",     v: s.medium,                    c: N.gold   },
          { l: "Avg Discovery Risk",  v: `${s.avg_discovery_risk}/100`, c: N.purple },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{k.l}</p>
            <p className="text-lg font-bold" style={{ color: k.c }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {signals.map((sig) => (
          <div key={sig.id} className="rounded-xl bg-white/[0.025] border border-white/[0.07] p-4" data-testid={`lit-${sig.id}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-mono text-white/40">{sig.id}</span>
              <span className="text-sm font-semibold text-white">{sig.category}</span>
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ color: sevColor(sig.severity), background: sevColor(sig.severity) + "18" }}>{sig.severity}</span>
              <span className="ml-auto text-base font-bold" style={{ color: N.gold }}>{sig.exposure_band}</span>
            </div>
            <p className="text-xs text-white/65 mb-2">{sig.trigger}</p>
            <div className="flex items-center justify-between text-[10px] pt-2 border-t border-white/[0.05] mb-3">
              <span className="text-white/40">Precedent: <span className="italic text-white/65">{sig.precedent}</span></span>
              <span className="text-white/40">Routed to <span className="font-mono text-white/55">{sig.agent}</span></span>
              <span className="font-bold" style={{ color: sig.discovery_risk >= 85 ? N.red : N.orange }}>Discovery Risk {sig.discovery_risk}/100</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
              {sig.recovery_action_id ? (
                <Link href="/claims-recovery">
                  <a className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: N.green }} data-testid={`lit-pushed-${sig.id}`}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: N.green }} />
                    In Recovery Pipeline · Action #{sig.recovery_action_id} · {sig.recovery_status?.replace(/_/g, " ")}
                    <ChevronRight size={11} />
                  </a>
                </Link>
              ) : <span className="text-[10px] text-white/30">Not yet pursued</span>}
              <button
                onClick={() => pushToRecovery(sig.id, sig.category)}
                disabled={busy === sig.id || !!sig.recovery_action_id}
                data-testid={`lit-pursue-${sig.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40"
                style={{ background: N.red + "18", border: `1px solid ${N.red}40`, color: N.red }}
              >
                {busy === sig.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                {sig.recovery_action_id ? "Already Pushed" : "Push to Claims Recovery"}
              </button>
            </div>
            <CommentsBlock findingId={sig.id} />
          </div>
        ))}
      </div>

      <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: N.purple + "10", border: `1px solid ${N.purple}30` }}>
        <Gavel size={14} style={{ color: N.purple }} />
        <p className="text-xs text-white/65 flex-1">Every signal above maps to a real federal precedent. The Litigation Preparedness Agent continuously cross-references these against your documented governance evidence.</p>
        <Link href="/fiduciary-iq"><a className="text-[11px] font-semibold flex items-center gap-1" style={{ color: N.purple }} data-testid="link-fiduciary-iq">Open Fiduciary IQ → <ChevronRight size={11} /></a></Link>
      </div>
    </div>
  );
}

/* ─── WORKFORCE IMPACT ──────────────────────────────────────────────────────── */
function WorkforceTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/workforce"] });
  if (isLoading || !data) return <Loading />;
  const w = data;
  const friction = [{ name: "Friction Index", val: w.friction_index, fill: w.friction_index >= 70 ? N.red : w.friction_index >= 50 ? N.orange : N.green }];

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/45 mb-3">Workforce Friction Index</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={friction} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="val" cornerRadius={10} background={{ fill: "#ffffff10" }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-center text-3xl font-bold -mt-32 mb-32" style={{ color: friction[0].fill }}>{w.friction_index}</p>
          <p className="text-center text-[10px] text-white/40 mt-2">Composite of resolution time, attrition, abandonment, and downstream ER utilization.</p>
        </div>

        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {[
            { l: "Total Employees",              v: w.total_employees.toLocaleString(),                             c: N.blue   },
            { l: "Active PA Cases",              v: w.employees_with_active_PA,                                     c: N.purple },
            { l: "Avg Days to PA Resolution",    v: `${w.avg_days_to_resolution}d`,                                 c: N.orange },
            { l: "Productivity Hrs Lost / Mo",   v: w.productivity_hours_lost_monthly.toLocaleString(),             c: N.gold   },
            { l: "Annualized Productivity Cost", v: `$${(w.annualized_productivity_cost/1_000_000).toFixed(2)}M`,    c: N.red    },
            { l: "Healthcare-Driven Attrition",  v: `${w.healthcare_driven_attrition_pct}%`,                        c: N.red    },
            { l: "Attrition Replacement Cost",   v: `$${(w.attrition_replacement_cost/1_000_000).toFixed(2)}M`,      c: N.gold   },
            { l: "Medication Abandonment Rate",  v: `${w.medication_abandonment_rate}%`,                            c: N.orange },
          ].map((k) => (
            <div key={k.l} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{k.l}</p>
              <p className="text-lg font-bold" style={{ color: k.c }}>{k.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-5" style={{ background: N.red + "08", border: `1px solid ${N.red}25` }}>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/55 mb-2">Composite Annualized Workforce Cost</p>
        <p className="text-4xl font-bold tracking-tight" style={{ color: N.red }}>${(w.composite_annual_cost / 1_000_000).toFixed(2)}M</p>
        <p className="text-xs text-white/45 mt-2">Sum of productivity loss, attrition replacement, and downstream ER cost attributable to healthcare friction. Tracks against fiduciary prudent-oversight standard.</p>
      </div>
    </div>
  );
}

/* ─── AGENT NETWORK ─────────────────────────────────────────────────────────── */
function AgentTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/hios/agents"] });
  if (isLoading || !data) return <Loading />;

  const tiers = [
    { id: 1, label: "Tier 1 · Executive Orchestration",  desc: "Coordinates, escalates, prepares governance documentation", agents: data.by_tier?.tier_1_executive ?? [] },
    { id: 2, label: "Tier 2 · Operational Intelligence", desc: "Resolves cases, flags anomalies, models impact",            agents: data.by_tier?.tier_2_operational ?? [] },
    { id: 3, label: "Tier 3 · National Pattern Detection", desc: "Monitors industry, regulation, and litigation trends",   agents: data.by_tier?.tier_3_national ?? [] },
  ];

  return (
    <div className="space-y-6">
      {tiers.map((t) => (
        <div key={t.id} className="rounded-2xl bg-white/[0.025] border border-white/[0.07] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/65">{t.label}</p>
              <span className="text-[10px] text-white/35">{t.agents.length} agent{t.agents.length === 1 ? "" : "s"} online</span>
            </div>
            <p className="text-[11px] text-white/40 mt-0.5">{t.desc}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.04]">
            {t.agents.map((a: any) => (
              <div key={a.id} className="p-4 bg-[#0a0a0a]" data-testid={`agent-${a.id}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Cpu size={11} style={{ color: a.color }} />
                  <p className="text-sm font-semibold text-white">{a.name}</p>
                  <div className="w-1.5 h-1.5 rounded-full ml-auto animate-pulse" style={{ background: N.green }} />
                </div>
                <p className="text-[11px] text-white/55 leading-relaxed">{a.role}</p>
                <p className="mt-2 text-[9px] font-mono text-white/30">{a.id}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: N.blue + "10", border: `1px solid ${N.blue}25` }}>
        <Brain size={14} style={{ color: N.blue }} className="mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-white mb-1">Multi-Agent Architecture</p>
          <p className="text-[11px] text-white/60 leading-relaxed">Agents communicate through an event-driven message bus. Tier-1 agents synthesize cross-system signals from Tier-2 operators, escalating only what survives the 7-Gate enforcement chain (DEFINE → WIRE → VALIDATE → PROMOTE → COMPUTE → GATE → RENDER). Tier-3 agents continuously calibrate the model against national pattern shifts.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── SHARED ────────────────────────────────────────────────────────────────── */
function Loading() {
  return (
    <div className="flex items-center justify-center h-64 gap-3">
      <Loader2 size={16} className="animate-spin" style={{ color: N.blue }} />
      <span className="text-white/40 text-sm">Initializing intelligence subsystems…</span>
    </div>
  );
}

/* ─── PAGE ──────────────────────────────────────────────────────────────────── */
export default function HealthcareIntelligenceOS() {
  const [tab, setTab] = useState<Tab>("command");
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => { document.title = "HIOS — Healthcare Intelligence OS · Kincaid IQ"; }, []);

  return (
    <div className="min-h-screen text-white" style={{ background: "linear-gradient(180deg, #050505 0%, #0a0a0a 100%)" }}>
      <div className="max-w-[1600px] mx-auto px-6 lg:px-10 py-8">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${N.blue}25, ${N.purple}15)`, border: `1px solid ${N.blue}40` }}>
              <Activity size={22} style={{ color: N.blue }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">HIOS</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider" style={{ color: N.green, background: N.green + "15", border: `1px solid ${N.green}30` }}>LIVE</span>
              </div>
              <p className="text-xs text-white/50">Healthcare Intelligence Operating System · Prior Auth · PBM Forensics · ERISA Defense · Workforce Impact</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CommandPaletteTrigger onOpen={() => setPaletteOpen(true)} />
            <NotificationsBell />
            <PlanBadge />
            <div className="hidden xl:block text-right text-[10px] text-white/35">
              <p className="font-bold tracking-wider uppercase text-white/55">Constitutional Doctrine</p>
              <p>4 Hard Rules · 3 Tiers · 7-Gate</p>
            </div>
          </div>
        </div>

        {paletteOpen && <CommandPalette tabs={TABS} setTab={setTab} onClose={() => setPaletteOpen(false)} />}

        {/* TABS */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
                style={{
                  background: active ? "rgba(0,212,255,0.12)" : "transparent",
                  border: `1px solid ${active ? "rgba(0,212,255,0.35)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? N.blue : "rgba(255,255,255,0.55)",
                }}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        {tab === "command"    && <CommandCenter />}
        {tab === "prior-auth" && <PriorAuthTab />}
        {tab === "pbm"        && <PBMTab />}
        {tab === "litigation" && <LitigationTab />}
        {tab === "workforce"  && <WorkforceTab />}
        {tab === "value"      && <ValueLedgerTab />}
        {tab === "agents"     && <AgentTab />}
        {tab === "enterprise" && <EnterpriseTab />}
      </div>
    </div>
  );
}

/* ─── VALUE LEDGER — CFO-grade dollar attribution ─────────────────────────── */
function ValueLedgerTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hios/value-ledger"],
    refetchInterval: 30000,
  });
  if (isLoading || !data) return <Loading />;

  const h = data.headline ?? {};
  const r = data.realized ?? {};
  const p = data.pipeline ?? {};
  const pbm = data.pbm ?? {};
  const lit = data.litigation ?? {};
  const wf = data.workforce ?? {};
  const quarters: any[] = data.quarters ?? [];
  const wins: any[] = data.top_wins ?? [];
  const nba: any[] = data.next_best_actions ?? [];

  const roiColor =
    (h.roi_multiple ?? 0) >= 10 ? N.green :
    (h.roi_multiple ?? 0) >= 3  ? N.gold  : N.orange;

  return (
    <div className="space-y-6">
      {/* ROI HEADLINE STRIP */}
      <div className="rounded-2xl border p-5"
           style={{ background: `linear-gradient(135deg, ${roiColor}14, transparent 60%)`, borderColor: roiColor + "33" }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-bold" style={{ color: roiColor }}>
              Renewal Defense Exhibit · Updated {new Date(data.generated_at).toLocaleTimeString()}
            </p>
            <h2 className="text-2xl font-bold text-white mt-1">
              <span style={{ color: roiColor }}>{h.roi_multiple}×</span> ROI on Kincaid IQ {h.plan}
            </h2>
            <p className="text-sm text-white/55 mt-1">
              {fmtMoney(h.total_value_captured)} captured against {fmtMoney(h.subscription_cost)} annual subscription
              {h.payback_days && ` · paid back in ${h.payback_days} days`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-wider uppercase text-white/45">Capture Rate</p>
            <p className="text-3xl font-bold" style={{ color: roiColor }}>{h.capture_rate_pct}%</p>
            <p className="text-[10px] text-white/40">of {fmtMoney(h.total_value_at_play)} at play</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Realized Recoveries",  v: fmtMoney(r.recoveries),         c: N.green,  icon: PiggyBank, sub: `${r.recovery_count} settled` },
            { l: "Contingency Earned",   v: fmtMoney(r.contingency_earned), c: N.gold,   icon: Trophy,    sub: "28% split" },
            { l: "Open Pipeline",        v: fmtMoney(p.open_claims),        c: N.blue,   icon: Activity,  sub: `${p.open_count} claims` },
            { l: "Workforce Preserved",  v: fmtMoney(wf.value_preserved),   c: N.purple, icon: Users,     sub: `${wf.estimated_recovery_pct}% of risk` },
          ].map((k) => (
            <div key={k.l} className="rounded-xl bg-black/30 border border-white/[0.06] p-3" data-testid={`headline-${k.l}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wider text-white/45">{k.l}</p>
                <k.icon size={12} style={{ color: k.c }} />
              </div>
              <p className="text-xl font-bold" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[10px] text-white/35 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TWO-COLUMN: Quarterly waterfall + Top wins */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55 mb-4">Quarterly Capture Waterfall</p>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quarters} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10}
                       tickFormatter={(v) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: "1px solid #222", fontSize: 11 }}
                  formatter={(v: any, n: any) => [fmtMoney(v), n === "recovered" ? "Recovered" : "Claimed"]}
                />
                <Bar dataKey="claimed"   fill={N.blue + "55"} radius={[4, 4, 0, 0]} />
                <Bar dataKey="recovered" fill={N.green}       radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-white/55">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded" style={{ background: N.blue + "55" }} /> Claimed</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded" style={{ background: N.green }} /> Recovered</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55 mb-3">Top 5 Recoveries</p>
          {wins.length === 0 ? (
            <p className="text-xs text-white/35">No closed recoveries yet. Push a PBM flag or litigation signal to start the pipeline.</p>
          ) : (
            <div className="space-y-2">
              {wins.map((w) => (
                <div key={w.id} className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-2.5" data-testid={`win-${w.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: N.green }}>{w.category}</span>
                    <span className="text-sm font-bold" style={{ color: N.green }}>{fmtMoney(w.amount_recovered)}</span>
                  </div>
                  <p className="text-[10px] text-white/60 mt-0.5 truncate">{w.target}</p>
                  <p className="text-[10px] text-white/35">Fee: {fmtMoney(w.contingency_fee)} · {w.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* THREE-COLUMN: Value still at play */}
      <div className="grid lg:grid-cols-3 gap-4">
        {[
          { title: "PBM Exposure Remaining", color: N.orange, data: pbm, pursuedKey: "exposure_pursued", remainingKey: "exposure_remaining", totalKey: "exposure_total", countKey: "flags_remaining", label: "flags" },
          { title: "Litigation Risk Remaining", color: N.red, data: lit, pursuedKey: "low_band_avoided", remainingKey: "low_band_remaining", totalKey: "low_band_total", countKey: "signals_remaining", label: "signals" },
          { title: "Workforce Productivity",  color: N.purple, data: { exposure_pursued: wf.value_preserved, exposure_remaining: (wf.annualized_productivity_at_risk||0) - (wf.value_preserved||0), exposure_total: wf.annualized_productivity_at_risk, flags_remaining: "—" }, pursuedKey: "exposure_pursued", remainingKey: "exposure_remaining", totalKey: "exposure_total", countKey: "flags_remaining", label: "" },
        ].map((card: any) => {
          const total = card.data[card.totalKey] || 0;
          const captured = card.data[card.pursuedKey] || 0;
          const remaining = card.data[card.remainingKey] || 0;
          const pct = total ? Math.round((captured / total) * 100) : 0;
          return (
            <div key={card.title} className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-white/55 mb-3">{card.title}</p>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{fmtMoney(remaining)}</p>
              <p className="text-[10px] text-white/40 mb-3">{card.data[card.countKey]} {card.label} unaddressed</p>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                <div className="h-full" style={{ width: `${pct}%`, background: card.color }} />
              </div>
              <div className="flex justify-between text-[10px] mt-1.5">
                <span className="text-white/45">Captured: <span className="font-semibold" style={{ color: card.color }}>{pct}%</span></span>
                <span className="text-white/45">Total: {fmtMoney(total)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* NEXT BEST ACTIONS — ranked by dollar impact */}
      <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame size={14} style={{ color: N.gold }} />
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55">Next 5 Best Actions · Ranked by Dollar Impact</p>
          </div>
          <span className="text-[10px] text-white/35">Total opportunity: {fmtMoney(nba.reduce((a: number, n: any) => a + (n.amount || 0), 0))}</span>
        </div>
        {nba.length === 0 ? (
          <p className="text-xs text-white/35">All available flags and signals have been pushed to recovery. Nice work.</p>
        ) : (
          <div className="space-y-2">
            {nba.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] p-3"
                   data-testid={`nba-${a.id}`}>
                <span className="text-[10px] font-bold w-5 text-center" style={{ color: i === 0 ? N.gold : "rgba(255,255,255,0.4)" }}>#{i + 1}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: a.color + "20", color: a.color }}>{a.kind}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{a.label}</p>
                  <p className="text-[10px] text-white/40">{a.id} · {a.confidence}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: a.color }}>{fmtMoney(a.amount)}</span>
                <ChevronRight size={14} className="text-white/30" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SUBSCRIPTION ECONOMICS STRIP */}
      <div className="rounded-xl p-4" style={{ background: roiColor + "08", border: `1px solid ${roiColor}25` }}>
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: roiColor }}>Subscription Economics</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
          <div><span className="text-white/45">Plan</span><br/><span className="text-white/80 font-semibold capitalize">{h.plan}</span></div>
          <div><span className="text-white/45">Annual Cost</span><br/><span className="text-white/80 font-semibold">{fmtMoney(h.subscription_cost)}</span></div>
          <div><span className="text-white/45">Value Captured</span><br/><span className="font-semibold" style={{ color: roiColor }}>{fmtMoney(h.total_value_captured)}</span></div>
          <div><span className="text-white/45">ROI Multiple</span><br/><span className="font-semibold" style={{ color: roiColor }}>{h.roi_multiple}×</span></div>
          <div><span className="text-white/45">Payback</span><br/><span className="text-white/80 font-semibold">{h.payback_days ? `${h.payback_days} days` : "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── ENTERPRISE OPS — 10K-location fleet command ─────────────────────────── */
function EnterpriseTab() {
  const { data: ent, isLoading: lEnt } = useQuery<any>({
    queryKey: ["/api/hios/enterprise"],
    refetchInterval: 20000,
  });
  const { data: health, isLoading: lH } = useQuery<any>({
    queryKey: ["/api/hios/health"],
    refetchInterval: 10000,
  });
  const { data: audit, isLoading: lA } = useQuery<any>({
    queryKey: ["/api/hios/audit", "limit=50"],
    queryFn: async () => {
      const r = await fetch("/api/hios/audit?limit=50", { credentials: "include" });
      return r.json();
    },
    refetchInterval: 15000,
  });

  if (lEnt || lH || !ent || !health) return <Loading />;

  const fleet = ent.fleet ?? {};
  const tp = ent.throughput ?? {};
  const perf = ent.performance ?? {};
  const subs = health.subsystems ?? {};
  const sla = ent.sla ?? {};
  const topOrgs: any[] = ent.top_orgs ?? [];
  const entries: any[] = audit?.entries ?? [];

  const subsystems = [
    { name: "Database",     k: "database",     icon: Server,  desc: `${subs.database?.latency_ms ?? 0}ms ping` },
    { name: "TTL Cache",    k: "cache",        icon: Cpu,     desc: `${subs.cache?.entries ?? 0} entries · ${Math.round((subs.cache?.hit_rate ?? 0) * 100)}% hit` },
    { name: "Rate Limiter", k: "rate_limiter", icon: Shield,  desc: `${subs.rate_limiter?.active_buckets ?? 0} active · ${subs.rate_limiter?.rejected_total ?? 0} rejected` },
    { name: "Agent Mesh",   k: "agents",       icon: Brain,   desc: `${subs.agents?.online ?? 0} online · T1 ${subs.agents?.tier_1 ?? 0}` },
    { name: "Job Queue",    k: "queue",        icon: Activity,desc: `depth ${subs.queue?.depth ?? 0}` },
  ];

  const fmtDollar = (n: number) =>
    n >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` :
    n >= 1_000     ? `$${(n/1_000).toFixed(1)}K`     : `$${n.toFixed(0)}`;

  return (
    <div className="space-y-6">
      {/* SLA STRIP */}
      <div className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-4"
           style={{ background: "linear-gradient(90deg, rgba(0,212,255,0.06), transparent)", borderColor: "rgba(0,212,255,0.18)" }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: N.green }} />
          <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-white/55">Enterprise SLA · Multi-Region · Auto-Scaling</p>
        </div>
        <div className="flex items-center gap-6 text-[11px]">
          <span className="text-white/60">Capacity: <span className="font-bold text-white">{fleet.concurrent_capacity}</span></span>
          <span className="text-white/60">Target p95: <span className="font-bold" style={{ color: N.green }}>≤{sla.target_p95_ms}ms</span></span>
          <span className="text-white/60">Uptime SLA: <span className="font-bold" style={{ color: N.green }}>{sla.target_uptime_pct}%</span></span>
          <span className="text-white/60 flex items-center gap-1"><Globe2 size={11} />
            {(sla.regions ?? []).join(" · ")}
          </span>
        </div>
      </div>

      {/* FLEET KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { l: "Locations Onboarded",  v: fleet.locations,                                c: N.blue,   icon: Building2 },
          { l: "Active (Paying)",      v: fleet.active_locations,                         c: N.green,  icon: TrendingUp },
          { l: "Total Seats",          v: fleet.seats,                                    c: N.purple, icon: Users },
          { l: "Plan Clients Tracked", v: fleet.plan_clients,                             c: N.gold,   icon: Briefcase },
          { l: "Handoffs (24h)",       v: tp.handoffs_24h,                                c: N.orange, icon: Zap },
          { l: "Exposure Routed",      v: fmtDollar(tp.exposure_routed ?? 0),             c: N.red,    icon: Target },
        ].map((k) => (
          <div key={k.l} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3" data-testid={`ent-kpi-${k.l}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-wider text-white/40">{k.l}</p>
              <k.icon size={12} style={{ color: k.c }} />
            </div>
            <p className="text-xl font-bold" style={{ color: k.c }}>{k.v?.toLocaleString?.() ?? k.v}</p>
          </div>
        ))}
      </div>

      {/* TWO-COLUMN: subsystem health + performance ring */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55 mb-4">Subsystem Health</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {subsystems.map((s) => {
              const healthy = subs[s.k]?.healthy ?? false;
              const color = healthy ? N.green : N.red;
              return (
                <div key={s.name} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3 flex items-center gap-3"
                     data-testid={`subsys-${s.k}`}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
                    <s.icon size={15} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white">{s.name}</p>
                    <p className="text-[10px] text-white/45">{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                      {healthy ? "Healthy" : "Down"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55 mb-4">Performance Ring</p>
          <div className="space-y-3">
            {[
              { l: "p50 latency",     v: `${perf.latency?.p50 ?? 0}ms`,                 c: N.green  },
              { l: "p95 latency",     v: `${perf.latency?.p95 ?? 0}ms`,                 c: (perf.latency?.p95 ?? 0) <= sla.target_p95_ms ? N.green : N.orange },
              { l: "p99 latency",     v: `${perf.latency?.p99 ?? 0}ms`,                 c: N.gold   },
              { l: "Samples",         v: `${perf.latency?.count ?? 0}`,                 c: N.blue   },
              { l: "Cache hit rate",  v: `${Math.round((perf.cache?.hit_rate ?? 0) * 100)}%`, c: N.green  },
              { l: "Rate rejections", v: `${perf.rate_limiter?.rejected_total ?? 0}`,   c: N.red    },
              { l: "Uptime",          v: `${Math.floor((perf.uptime_seconds ?? 0) / 60)}m`,    c: N.purple },
            ].map((m) => (
              <div key={m.l} className="flex items-center justify-between text-[11px]">
                <span className="text-white/55">{m.l}</span>
                <span className="font-bold" style={{ color: m.c }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOP ORGS + AUDIT TAIL */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55">Top Locations by Exposure Routed</p>
            <span className="text-[10px] text-white/35">Top 10 of {fleet.locations}</span>
          </div>
          {topOrgs.length === 0 ? (
            <p className="text-xs text-white/35">No fleet handoffs recorded yet. Push a flag from PBM Forensics or Litigation to populate the leaderboard.</p>
          ) : (
            <div className="space-y-2">
              {topOrgs.map((o, i) => (
                <div key={o.org_id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5"
                     data-testid={`top-org-${o.org_id}`}>
                  <span className="text-[10px] font-bold w-5 text-center" style={{ color: i < 3 ? N.gold : "rgba(255,255,255,0.35)" }}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{o.org_name}</p>
                    <p className="text-[10px] text-white/40">{o.handoffs} handoffs</p>
                  </div>
                  <span className="text-sm font-bold" style={{ color: N.gold }}>{fmtDollar(o.exposure)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/55">Live Audit Trail</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/35 flex items-center gap-1">
                <Clock size={9} />
                {audit?.scope?.org_name ?? "Personal scope"} · {entries.length} events
              </span>
              <CSVButton kind="audit" label="CSV" />
            </div>
          </div>
          {lA ? <Loading /> : entries.length === 0 ? (
            <p className="text-xs text-white/35">No audit events yet. Every push, export, and alert is logged here with IP + actor.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {entries.map((e) => {
                const c = e.action === "pbm_pursue" ? N.orange :
                          e.action === "lit_pursue" ? N.red    :
                          e.action === "appeal_draft" ? N.purple : N.blue;
                return (
                  <div key={e.id} className="text-[10.5px] flex items-start gap-2 py-1.5 border-b border-white/[0.03]" data-testid={`audit-${e.id}`}>
                    <span className="font-mono text-white/35 shrink-0">{e.ts?.slice(11, 19) ?? ""}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0"
                          style={{ background: c + "18", color: c }}>{e.action}</span>
                    <span className="text-white/65 truncate flex-1">
                      {e.target}{e.amount ? ` · ${fmtDollar(e.amount)}` : ""}
                    </span>
                    <span className="text-white/30 shrink-0">{e.ip ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ARCHITECTURE STRIP */}
      <div className="rounded-xl p-4" style={{ background: N.blue + "08", border: `1px solid ${N.blue}25` }}>
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: N.blue }}>Enterprise Architecture</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <div><span className="text-white/45">Multi-tenancy</span><br/><span className="text-white/80 font-semibold">Org-scoped queries · row-level isolation</span></div>
          <div><span className="text-white/45">Caching</span><br/><span className="text-white/80 font-semibold">Per-org TTL · 30s read · 1s bust on write</span></div>
          <div><span className="text-white/45">Rate limiting</span><br/><span className="text-white/80 font-semibold">120 burst · 2 req/s sustained per org</span></div>
          <div><span className="text-white/45">Idempotency</span><br/><span className="text-white/80 font-semibold">Stable finding_id keys · dedupe on write</span></div>
          <div><span className="text-white/45">Audit</span><br/><span className="text-white/80 font-semibold">Indexed by org_id+ts · IP-stamped</span></div>
          <div><span className="text-white/45">Observability</span><br/><span className="text-white/80 font-semibold">p50/p95/p99 ring buffer · /health probe</span></div>
          <div><span className="text-white/45">Concurrency</span><br/><span className="text-white/80 font-semibold">Thread-safe locks · async-ready</span></div>
          <div><span className="text-white/45">Failover</span><br/><span className="text-white/80 font-semibold">Cache-bust on push · org fallback</span></div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICATIONS BELL — unread audit/mention feed
   ═══════════════════════════════════════════════════════════════════════════ */
function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<any>({
    queryKey: ["/api/hios/notifications"],
    refetchInterval: 20000,
  });
  const unread = data?.unread ?? 0;
  const items: any[] = data?.items ?? [];

  async function markRead() {
    try {
      await apiRequest("POST", "/api/hios/notifications/mark-read", {});
      queryClient.invalidateQueries({ queryKey: ["/api/hios/notifications"] });
    } catch {}
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open && unread > 0) markRead(); }}
        data-testid="hios-bell"
        className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
        style={{ background: open ? N.blue + "20" : "rgba(255,255,255,0.04)", border: `1px solid ${open ? N.blue + "50" : "rgba(255,255,255,0.08)"}` }}
        title="Notifications"
      >
        <Bell size={14} style={{ color: unread > 0 ? N.blue : "rgba(255,255,255,0.55)" }} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center" style={{ background: N.red, color: "white" }}>
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[420px] max-h-[540px] overflow-y-auto rounded-2xl z-50 shadow-2xl" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div className="sticky top-0 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between" style={{ background: "#0a0a0a" }}>
              <p className="text-xs font-bold tracking-[0.16em] uppercase text-white/65">Activity Feed</p>
              <span className="text-[10px] text-white/40">{data?.total ?? 0} events</span>
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-[11px] text-white/40">No activity yet. Pursue a flag or post a comment to start the audit trail.</div>
            ) : items.map((it) => (
              <div key={it.id} className="px-4 py-2.5 border-b border-white/[0.04] flex items-start gap-3 hover:bg-white/[0.02]">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: it.unread ? (it.severity === "HIGH" || it.severity === "CRITICAL" ? N.red : N.blue) : "transparent", border: it.unread ? "none" : "1px solid rgba(255,255,255,0.15)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-bold uppercase tracking-wider" style={{ color: it.kind === "mention" ? N.purple : N.blue }}>{it.action.replace(/_/g, " ")}</span>
                    {it.subject && <span className="font-mono text-white/45">{it.subject}</span>}
                    {it.amount > 0 && <span className="ml-auto font-bold" style={{ color: N.gold }}>{fmtMoney(it.amount)}</span>}
                  </div>
                  {it.target && <p className="text-[11px] text-white/65 mt-0.5 line-clamp-2">{it.target}</p>}
                  <p className="text-[9px] text-white/30 mt-0.5">{it.ts ? new Date(it.ts).toLocaleString() : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ⌘K COMMAND PALETTE
   ═══════════════════════════════════════════════════════════════════════════ */
function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      data-testid="hios-cmdk-trigger"
      className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg text-[11px] transition-colors"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}
      title="Command palette (⌘K)"
    >
      <Search size={12} />
      <span>Quick jump</span>
      <kbd className="ml-2 px-1.5 py-0.5 rounded font-mono text-[9px]" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>⌘K</kbd>
    </button>
  );
}

function CommandPalette({ tabs, setTab, onClose }: { tabs: any[]; setTab: (id: any) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const actions = [
    ...tabs.map((t) => ({ kind: "Tab",      label: t.label, hint: "Open tab", run: () => { setTab(t.id); onClose(); } })),
    { kind: "Export", label: "Download PBM forensics CSV",     hint: "csv_export", run: () => { window.location.href = "/api/hios/exports/pbm.csv"; onClose(); } },
    { kind: "Export", label: "Download Litigation signals CSV", hint: "csv_export", run: () => { window.location.href = "/api/hios/exports/litigation.csv"; onClose(); } },
    { kind: "Export", label: "Download Audit trail CSV",        hint: "csv_export", run: () => { window.location.href = "/api/hios/exports/audit.csv"; onClose(); } },
    { kind: "Export", label: "Download Prior Auth queue CSV",   hint: "csv_export", run: () => { window.location.href = "/api/hios/exports/prior-auth.csv"; onClose(); } },
    { kind: "Jump",   label: "Open Claims Recovery pipeline",   hint: "/claims-recovery", run: () => { window.location.href = "/claims-recovery"; onClose(); } },
    { kind: "Jump",   label: "Open Rx Defense",                  hint: "/rx-defense",      run: () => { window.location.href = "/rx-defense"; onClose(); } },
    { kind: "Jump",   label: "Open Fiduciary IQ",                hint: "/fiduciary-iq",    run: () => { window.location.href = "/fiduciary-iq"; onClose(); } },
    { kind: "Admin",  label: "Flush HIOS cache",                 hint: "ops",     run: async () => { await apiRequest("POST", "/api/hios/cache/flush", {}); onClose(); } },
  ];
  const filtered = q ? actions.filter((a) => (a.label + " " + a.kind).toLowerCase().includes(q.toLowerCase())) : actions;
  const safeCursor = Math.min(cursor, Math.max(0, filtered.length - 1));

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[15vh] px-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose} data-testid="hios-cmdk-modal">
      <div className="w-full max-w-[620px] rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08]">
          <CmdIcon size={14} style={{ color: N.blue }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter")     { e.preventDefault(); filtered[safeCursor]?.run(); }
            }}
            placeholder="Type to jump · tabs, exports, links, admin..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
            data-testid="hios-cmdk-input"
          />
          <kbd className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)" }}>ESC</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-white/40">No matches.</div>
          ) : filtered.map((a, i) => (
            <button
              key={a.label}
              onClick={() => a.run()}
              onMouseEnter={() => setCursor(i)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
              style={{ background: i === safeCursor ? "rgba(0,212,255,0.10)" : "transparent" }}
              data-testid={`hios-cmdk-item-${i}`}
            >
              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded" style={{ color: a.kind === "Tab" ? N.blue : a.kind === "Export" ? N.gold : a.kind === "Admin" ? N.red : N.purple, background: (a.kind === "Tab" ? N.blue : a.kind === "Export" ? N.gold : a.kind === "Admin" ? N.red : N.purple) + "15", minWidth: 54, textAlign: "center" }}>{a.kind}</span>
              <span className="flex-1 text-sm text-white/85">{a.label}</span>
              {i === safeCursor && <CornerDownLeft size={12} style={{ color: N.blue }} />}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-3 text-[9px] text-white/35">
          <span>↑↓ navigate</span><span>↵ run</span><span>esc close</span>
          <span className="ml-auto">{filtered.length} of {actions.length}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PLAN BADGE — current tier indicator
   ═══════════════════════════════════════════════════════════════════════════ */
function PlanBadge() {
  const { data } = useQuery<any>({ queryKey: ["/api/hios/plan-gates"] });
  const plan: string = data?.plan ?? "trial";
  const color = plan === "enterprise" ? N.purple : plan === "broker" ? N.gold : plan === "fiduciary" ? N.blue : "rgba(255,255,255,0.45)";
  return (
    <Link href="/billing">
      <a className="hidden md:flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors" style={{ background: color + "12", border: `1px solid ${color}40`, color }} data-testid="hios-plan-badge" title="View billing">
        {plan === "trial" ? <Lock size={11} /> : <Shield size={11} />}
        {plan}
      </a>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMMENTS BLOCK — collapsible, lazy-loaded per finding
   ═══════════════════════════════════════════════════════════════════════════ */
function CommentsBlock({ findingId }: { findingId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/hios/comments", findingId],
    enabled: open,
  });
  const comments: any[] = data?.comments ?? [];

  async function submit() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await apiRequest("POST", `/api/hios/comments/${findingId}`, { body });
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/hios/comments", findingId] });
      queryClient.invalidateQueries({ queryKey: ["/api/hios/notifications"] });
      toast({ title: "Comment posted", description: "Audit-trailed. Mentions notified." });
    } catch (e: any) {
      toast({ title: "Failed to post", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  }

  function renderBody(text: string) {
    return text.split(/(@[A-Za-z0-9_.+-]+)/g).map((part, i) =>
      part.startsWith("@") ? <span key={i} className="font-semibold" style={{ color: N.purple }}>{part}</span> : <span key={i}>{part}</span>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.04]">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid={`hios-comments-toggle-${findingId}`}
        className="flex items-center gap-2 text-[10px] font-semibold tracking-wider uppercase text-white/50 hover:text-white/80 transition-colors"
      >
        <MessageSquare size={11} />
        Comments {comments.length > 0 && <span className="text-white/70">({comments.length})</span>}
        <ChevronRight size={10} className="transition-transform" style={{ transform: open ? "rotate(90deg)" : "none" }} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="text-[10px] text-white/30">Loading…</div>
          ) : comments.length === 0 ? (
            <div className="text-[10px] text-white/30 italic">No comments yet. Use @name to mention a teammate.</div>
          ) : comments.map((c) => (
            <div key={c.id} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2 mb-1 text-[10px]">
                <AtSign size={9} style={{ color: N.blue }} />
                <span className="font-semibold text-white/75">{c.author}</span>
                <span className="text-white/30 ml-auto">{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
              </div>
              <p className="text-[11px] text-white/75 leading-relaxed">{renderBody(c.body)}</p>
            </div>
          ))}

          <div className="flex items-start gap-2 pt-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
              placeholder="Add a note · @mention to notify · ⌘↵ to send"
              rows={2}
              data-testid={`hios-comments-input-${findingId}`}
              className="flex-1 rounded-lg px-3 py-2 text-[11px] bg-white/[0.03] border border-white/[0.08] text-white/85 placeholder:text-white/30 outline-none focus:border-white/[0.18] resize-none"
            />
            <button
              onClick={submit}
              disabled={posting || !body.trim()}
              data-testid={`hios-comments-submit-${findingId}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-40"
              style={{ background: N.blue + "20", border: `1px solid ${N.blue}40`, color: N.blue }}
            >
              {posting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
