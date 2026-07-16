import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  Users, Clock, TrendingUp, Target, Zap, DollarSign, BarChart3,
  AlertTriangle, CheckCircle2, XCircle, Activity, ChevronRight,
  ArrowUpDown, Minus, Plus, Info, RefreshCw, Sliders,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:      "#F8FAFC",
  surface: "rgba(255,255,255,0.78)",
  s2:      "rgba(255,255,255,0.62)",
  s3:      "rgba(248,250,252,0.88)",
  border:  "rgba(15,23,42,0.10)",
  gold:    "#FBB724",
  goldDim: "rgba(251,183,36,0.13)",
  goldBdr: "rgba(251,183,36,0.28)",
  text:    "#0F172A",
  muted:   "#64748B",
  green:   "#22c55e",
  red:     "#ef4444",
  blue:    "#3b82f6",
  amber:   "#f59e0b",
  purple:  "#a855f7",
  cyan:    "#06b6d4",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(v?: number | null) {
  if (v == null || v === 0) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtK$(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function pct(v: number) { return `${Math.round(v)}%`; }

// ── Tier config ───────────────────────────────────────────────────────────────
const TIER: Record<string, { label: string; color: string; bg: string; defaultHrs: number; priorityRank: number }> = {
  pursue_aggressively: { label: "Pursue Aggressively", color: T.green,  bg: "rgba(34,197,94,0.12)",   defaultHrs: 40, priorityRank: 1 },
  pursue_selectively:  { label: "Pursue Selectively",  color: T.gold,   bg: "rgba(251,183,36,0.12)",  defaultHrs: 28, priorityRank: 2 },
  monitor:             { label: "Monitor",              color: T.amber,  bg: "rgba(245,158,11,0.12)",  defaultHrs: 16, priorityRank: 3 },
  decline:             { label: "Decline",              color: T.red,    bg: "rgba(239,68,68,0.12)",   defaultHrs: 0,  priorityRank: 4 },
};
function tierCfg(t?: string) { return TIER[t ?? ""] ?? { label: t ?? "Unscored", color: T.muted, bg: "rgba(90,96,128,0.12)", defaultHrs: 20, priorityRank: 5 }; }

// ── EV computation ─────────────────────────────────────────────────────────────
// EV = P(win) × Contract Value
// P(win) derived from opportunity_score → win_probability breakdown factor
// Contract value estimated from covered_lives if not explicit
function computeEV(opp: Opportunity): number {
  const winProb = (opp.score_breakdown?.win_probability ?? 50) / 100;
  let cv = opp.estimated_contract_value ?? 0;
  if (!cv && opp.covered_lives) {
    // Conservative estimate: lives × $300 PMPM × 12mo × 15% consulting commission
    cv = opp.covered_lives * 300 * 12 * 0.15;
  }
  return Math.round(winProb * cv);
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  employer_name?: string;
  industry?: string;
  covered_lives?: number;
  estimated_contract_value?: number;
  due_date?: string;
  stage: string;
  opportunity_score?: number;
  score_tier?: string;
  score_breakdown?: Record<string, number>;
  score_factors?: Record<string, string>;
}

interface AllocationRow {
  opp: Opportunity;
  ev: number;
  effortHrs: number;
  roi: number;           // $/hr EV
  tierRank: number;
  decision: "in" | "out" | "locked-out";
  reason: string;
  hoursUsedAfter: number;
}

// ── Optimizer ─────────────────────────────────────────────────────────────────
// Greedy by ROI (EV/effort). Decline tier is excluded unless manually overridden.
// Pursue Aggressively gets a 1.5× ROI multiplier to reflect strategic priority.
function runOptimizer(
  opps: Opportunity[],
  effortMap: Record<string, number>,
  capacityHrs: number,
  declineLockout: boolean,
): AllocationRow[] {
  type Candidate = { opp: Opportunity; ev: number; effortHrs: number; effectiveRoi: number; tierRank: number };

  const candidates: Candidate[] = opps
    .filter(o => o.opportunity_score !== undefined)
    .map(o => {
      const ev = computeEV(o);
      const cfg = tierCfg(o.score_tier);
      const hrs = effortMap[o.id] ?? cfg.defaultHrs;
      const baseRoi = hrs > 0 ? ev / hrs : 0;
      const effectiveRoi = o.score_tier === "pursue_aggressively" ? baseRoi * 1.5
        : o.score_tier === "decline" ? baseRoi * 0.1
        : baseRoi;
      return { opp: o, ev, effortHrs: hrs, effectiveRoi, tierRank: cfg.priorityRank };
    });

  // Sort by effective ROI descending
  candidates.sort((a, b) => b.effectiveRoi - a.effectiveRoi);

  let hoursUsed = 0;
  const rows: AllocationRow[] = candidates.map(c => {
    const hrs = c.effortHrs;
    const roi = hrs > 0 ? c.ev / hrs : 0;
    const cfg = tierCfg(c.opp.score_tier);
    const score = c.opp.opportunity_score ?? 0;

    let decision: AllocationRow["decision"];
    let reason: string;

    if (declineLockout && c.opp.score_tier === "decline") {
      decision = "locked-out";
      reason = `Decline tier (score ${score}) — excluded by policy. Override by disabling tier lockout.`;
    } else if (hrs === 0) {
      decision = "locked-out";
      reason = "Zero effort allocated — set effort hours to include.";
    } else if (hoursUsed + hrs <= capacityHrs) {
      decision = "in";
      hoursUsed += hrs;
      reason = `${fmtK$(c.ev)} EV · ${fmt$(roi)}/hr ROI · ${cfg.label} tier · ${hrs} hrs allocated`;
    } else {
      decision = "out";
      reason = `Capacity exceeded (${Math.round(hoursUsed)}/${capacityHrs} hrs used) · ${fmt$(roi)}/hr ROI — deprioritized`;
    }

    return { opp: c.opp, ev: c.ev, effortHrs: hrs, roi, tierRank: c.tierRank, decision, reason, hoursUsedAfter: hoursUsed };
  });

  // Re-sort for display: IN first (by ROI), then OUT, then locked-out
  rows.sort((a, b) => {
    const ord = { in: 0, out: 1, "locked-out": 2 };
    if (ord[a.decision] !== ord[b.decision]) return ord[a.decision] - ord[b.decision];
    return b.roi - a.roi;
  });

  return rows;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────
function Pill({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      color, background: bg, border: `1px solid ${color}40`, borderRadius: 4, padding: "2px 7px",
    }}>{label}</span>
  );
}

function DecisionBadge({ d }: { d: AllocationRow["decision"] }) {
  if (d === "in") return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.green }}>
      <CheckCircle2 size={13} /> STAFFED
    </span>
  );
  if (d === "out") return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.amber }}>
      <Minus size={13} /> DEFERRED
    </span>
  );
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.muted }}>
      <XCircle size={13} /> EXCLUDED
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <Icon size={14} color={color} strokeWidth={1.8} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RfpResourceAllocator() {
  // ── Capacity inputs
  const [teamSize, setTeamSize] = useState(3);
  const [hrsPerPerson, setHrsPerPerson] = useState(20);
  const [whatIfTeam, setWhatIfTeam] = useState<number | null>(null);
  const [whatIfHrs, setWhatIfHrs] = useState<number | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [declineLockout, setDeclineLockout] = useState(true);

  // ── Per-opportunity effort overrides
  const [effortMap, setEffortMap] = useState<Record<string, number>>({});

  // ── Sort
  const [sortBy, setSortBy] = useState<"ev" | "roi" | "score" | "tier">("roi");

  // ── Fetch opportunities
  const { data: opps = [], isLoading, refetch } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
  });

  // ── Filter to scorable (skip pending/parsing/error)
  const scoredOpps = useMemo(() => opps.filter(o => o.opportunity_score !== undefined), [opps]);
  const unscoredCount = opps.length - scoredOpps.length;

  // ── Capacity
  const activeTeam = (showWhatIf && whatIfTeam != null) ? whatIfTeam : teamSize;
  const activeHrs  = (showWhatIf && whatIfHrs  != null) ? whatIfHrs  : hrsPerPerson;
  const capacityHrs = activeTeam * activeHrs;

  // ── Resolve effort map with defaults
  const resolvedEffort = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const o of scoredOpps) {
      out[o.id] = effortMap[o.id] ?? tierCfg(o.score_tier).defaultHrs;
    }
    return out;
  }, [scoredOpps, effortMap]);

  // ── Run optimizer
  const rows = useMemo(
    () => runOptimizer(scoredOpps, resolvedEffort, capacityHrs, declineLockout),
    [scoredOpps, resolvedEffort, capacityHrs, declineLockout],
  );

  // ── What-if rows (for comparison)
  const whatIfRows = useMemo(() => {
    if (!showWhatIf) return null;
    const wiTeam = whatIfTeam ?? teamSize;
    const wiHrs  = whatIfHrs  ?? hrsPerPerson;
    return runOptimizer(scoredOpps, resolvedEffort, wiTeam * wiHrs, declineLockout);
  }, [showWhatIf, whatIfTeam, whatIfHrs, teamSize, hrsPerPerson, scoredOpps, resolvedEffort, declineLockout]);

  // ── Summary stats
  const inRows  = rows.filter(r => r.decision === "in");
  const outRows = rows.filter(r => r.decision === "out");
  const totalEV = inRows.reduce((s, r) => s + r.ev, 0);
  const totalHrs = inRows.reduce((s, r) => s + r.effortHrs, 0);
  const capacityUtil = capacityHrs > 0 ? Math.min((totalHrs / capacityHrs) * 100, 100) : 0;

  // ── Sort display rows
  const displayRows = useMemo(() => {
    const r = [...rows];
    switch (sortBy) {
      case "ev":    r.sort((a, b) => b.ev - a.ev); break;
      case "roi":   r.sort((a, b) => b.roi - a.roi); break;
      case "score": r.sort((a, b) => (b.opp.opportunity_score ?? 0) - (a.opp.opportunity_score ?? 0)); break;
      case "tier":  r.sort((a, b) => a.tierRank - b.tierRank); break;
    }
    // Keep group order (in → out → locked)
    const inG  = r.filter(x => x.decision === "in");
    const outG = r.filter(x => x.decision === "out");
    const locG = r.filter(x => x.decision === "locked-out");
    return [...inG, ...outG, ...locG];
  }, [rows, sortBy]);

  // ── Chart data
  const chartData = inRows.slice(0, 8).map(r => ({
    name: (r.opp.employer_name ?? r.opp.id).slice(0, 16),
    ev: r.ev,
    hrs: r.effortHrs,
    roi: Math.round(r.roi),
  }));

  // ── Demo seed when no opportunities exist
  const isEmpty = scoredOpps.length === 0;

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "calc(100vh - 56px)", color: T.text, padding: "28px 32px 60px" }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="kiq-ops-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, borderRadius: 24, padding: "20px 22px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: T.goldDim, border: `1px solid ${T.goldBdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart3 size={18} color={T.gold} strokeWidth={1.8} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: T.text, margin: 0, letterSpacing: "-0.035em" }}>
                  Resource Allocation Optimizer
                </h1>
                <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                  Rank active RFPs by expected value · Staff the right opportunities
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              data-testid="btn-toggle-whatif"
              onClick={() => setShowWhatIf(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 7, border: `1px solid ${showWhatIf ? T.cyan : T.border}`,
                background: showWhatIf ? "rgba(6,182,212,0.12)" : T.surface,
                color: showWhatIf ? T.cyan : T.muted, cursor: "pointer", fontSize: 12, fontWeight: 600,
              }}>
              <Sliders size={13} strokeWidth={1.8} /> What-If
            </button>
            <button
              data-testid="btn-refresh-opps"
              onClick={() => refetch()}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.68)", color: T.muted, cursor: "pointer", fontSize: 12 }}>
              <RefreshCw size={13} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* ── Config row ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>

          {/* Capacity panel */}
          <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 20px", minWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 14 }}>
              Team Capacity
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
              {/* Team size */}
              <div>
                <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>
                  <Users size={11} style={{ marginRight: 4 }} />People
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button data-testid="btn-team-minus" onClick={() => setTeamSize(v => Math.max(1, v - 1))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${T.border}`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", minWidth: 28, textAlign: "center" }}>{teamSize}</span>
                  <button data-testid="btn-team-plus" onClick={() => setTeamSize(v => Math.min(20, v + 1))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${T.border}`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>+</button>
                </div>
              </div>
              {/* Hrs/person */}
              <div>
                <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>
                  <Clock size={11} style={{ marginRight: 4 }} />Hrs / person
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button data-testid="btn-hrs-minus" onClick={() => setHrsPerPerson(v => Math.max(4, v - 4))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${T.border}`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", minWidth: 36, textAlign: "center" }}>{hrsPerPerson}</span>
                  <button data-testid="btn-hrs-plus" onClick={() => setHrsPerPerson(v => Math.min(80, v + 4))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid ${T.border}`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>+</button>
                </div>
              </div>
              {/* Total */}
              <div style={{ borderLeft: `1px solid ${T.border}`, paddingLeft: 20 }}>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>Total Capacity</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{capacityHrs} hrs</div>
              </div>
            </div>
            {/* Utilization bar */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.muted }}>Allocated {totalHrs} / {capacityHrs} hrs</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: capacityUtil > 95 ? T.red : capacityUtil > 75 ? T.amber : T.green }}>
                  {pct(capacityUtil)} utilized
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, transition: "width 0.4s", width: `${capacityUtil}%`, background: capacityUtil > 95 ? T.red : capacityUtil > 75 ? T.amber : T.green }} />
              </div>
            </div>
            {/* Policy toggle */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <button
                data-testid="btn-decline-lockout"
                onClick={() => setDeclineLockout(v => !v)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                  background: declineLockout ? T.gold : "#e2e8f0", position: "relative", transition: "background 0.2s",
                }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 7, background: "#fff",
                  position: "absolute", top: 3, left: declineLockout ? 19 : 3, transition: "left 0.2s",
                }} />
              </button>
              <span style={{ fontSize: 11, color: T.muted }}>Lock out Decline-tier opportunities</span>
            </div>
          </div>

          {/* What-if panel */}
          {showWhatIf && (
            <div style={{ background: "rgba(6,182,212,0.06)", border: `1px solid rgba(6,182,212,0.22)`, borderRadius: 10, padding: "16px 20px", minWidth: 280 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.cyan, marginBottom: 14 }}>
                What-If Scenario
              </div>
              <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>People</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button data-testid="btn-wi-team-minus" onClick={() => setWhatIfTeam(v => Math.max(1, (v ?? teamSize) - 1))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid rgba(6,182,212,0.3)`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.cyan, minWidth: 28, textAlign: "center" }}>{whatIfTeam ?? teamSize}</span>
                    <button data-testid="btn-wi-team-plus" onClick={() => setWhatIfTeam(v => Math.min(20, (v ?? teamSize) + 1))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid rgba(6,182,212,0.3)`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>+</button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 5 }}>Hrs / person</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button data-testid="btn-wi-hrs-minus" onClick={() => setWhatIfHrs(v => Math.max(4, (v ?? hrsPerPerson) - 4))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid rgba(6,182,212,0.3)`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 800, color: T.cyan, minWidth: 36, textAlign: "center" }}>{whatIfHrs ?? hrsPerPerson}</span>
                    <button data-testid="btn-wi-hrs-plus" onClick={() => setWhatIfHrs(v => Math.min(80, (v ?? hrsPerPerson) + 4))} style={{ width: 26, height: 26, borderRadius: 5, border: `1px solid rgba(6,182,212,0.3)`, background: T.s2, color: T.text, cursor: "pointer", fontSize: 14 }}>+</button>
                  </div>
                </div>
                <div style={{ borderLeft: `1px solid rgba(6,182,212,0.2)`, paddingLeft: 20 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 5 }}>Scenario Capacity</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.cyan }}>
                    {(whatIfTeam ?? teamSize) * (whatIfHrs ?? hrsPerPerson)} hrs
                  </div>
                </div>
              </div>
              {whatIfRows && (
                <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    <span style={{ color: T.cyan, fontWeight: 700 }}>{whatIfRows.filter(r => r.decision === "in").length}</span> staffed ·{" "}
                    <span style={{ color: T.cyan, fontWeight: 700 }}>{fmtK$(whatIfRows.filter(r => r.decision === "in").reduce((s, r) => s + r.ev, 0))}</span> EV
                  </div>
                  {whatIfRows.filter(r => r.decision === "in").length !== inRows.length && (
                    <span style={{ fontSize: 11, color: whatIfRows.filter(r => r.decision === "in").length > inRows.length ? T.green : T.amber, fontWeight: 700 }}>
                      {whatIfRows.filter(r => r.decision === "in").length > inRows.length ? "+" : ""}{whatIfRows.filter(r => r.decision === "in").length - inRows.length} vs baseline
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Summary stats */}
          <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
            <StatCard icon={CheckCircle2} label="Staffed"    value={`${inRows.length}`}       sub={`of ${scoredOpps.length} scored`} color={T.green}  />
            <StatCard icon={DollarSign}  label="Total EV"   value={fmtK$(totalEV)}            sub="expected pipeline value"          color={T.gold}   />
            <StatCard icon={Clock}       label="Hrs Needed"  value={`${totalHrs}`}             sub={`${capacityHrs - totalHrs} remaining`} color={T.blue} />
            <StatCard icon={TrendingUp}  label="Avg ROI"    value={inRows.length ? fmtK$(totalEV / Math.max(totalHrs, 1)) : "—"}  sub="EV per effort hour"       color={T.purple} />
          </div>
        </div>

        {/* ── EV chart (when data exists) ────────────────────────────────────── */}
        {inRows.length > 0 && (
          <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.muted, marginBottom: 16 }}>
              Expected Value by Staffed Opportunity
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
                <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "rgba(255,255,255,0.96)", border: `1px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 11, boxShadow: "0 16px 40px rgba(15,23,42,0.12)" }}
                  formatter={(v: number) => [fmtK$(v), "Expected Value"]}
                />
                <Bar dataKey="ev" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={[T.green, T.gold, T.blue, T.purple, T.cyan, T.amber, T.green, T.gold][i % 8]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Loading / empty state ─────────────────────────────────────────── */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
            <RefreshCw size={28} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <p>Loading opportunities…</p>
          </div>
        )}

        {!isLoading && opps.length === 0 && (
          <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, padding: "48px 32px", textAlign: "center" }}>
            <BarChart3 size={36} style={{ margin: "0 auto 14px", color: T.muted, opacity: 0.5 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>No opportunities in the pipeline</p>
            <p style={{ fontSize: 12, color: T.muted, maxWidth: 400, margin: "0 auto 20px" }}>
              Upload or receive RFPs in the RFP Intelligence OS to populate the optimizer.
              Once scored, they will appear here ranked by expected value.
            </p>
            <a href="/rfp-os" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, background: T.goldDim, border: `1px solid ${T.goldBdr}`, color: T.gold, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              Go to RFP Intake <ChevronRight size={14} />
            </a>
          </div>
        )}

        {!isLoading && opps.length > 0 && scoredOpps.length === 0 && (
          <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "24px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AlertTriangle size={18} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.amber, margin: "0 0 4px" }}>
                {opps.length} opportunit{opps.length !== 1 ? "ies" : "y"} found but none scored yet
              </p>
              <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                Open each opportunity in RFP Intake and run the Scoring Engine to generate scores. The optimizer requires an opportunity score to compute expected value.
              </p>
            </div>
          </div>
        )}

        {/* ── Rank table ────────────────────────────────────────────────────── */}
        {scoredOpps.length > 0 && (
          <>
            {unscoredCount > 0 && (
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={12} />
                {unscoredCount} opportunit{unscoredCount !== 1 ? "ies" : "y"} not yet scored — excluded from optimizer.
              </div>
            )}

            {/* Sort controls */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: T.muted, alignSelf: "center", marginRight: 4 }}>Sort:</span>
              {(["roi", "ev", "score", "tier"] as const).map(s => (
                <button
                  key={s}
                  data-testid={`btn-sort-${s}`}
                  onClick={() => setSortBy(s)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, border: `1px solid ${sortBy === s ? T.goldBdr : T.border}`,
                    background: sortBy === s ? T.goldDim : T.surface, color: sortBy === s ? T.gold : T.muted,
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                  {s === "roi" ? "ROI (EV/hr)" : s === "ev" ? "Expected Value" : s === "score" ? "Opp Score" : "Tier Priority"}
                </button>
              ))}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowUpDown size={12} color={T.muted} />
                <span style={{ fontSize: 11, color: T.muted }}>{displayRows.length} opportunities ranked</span>
              </div>
            </div>

            {/* Table */}
            <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18, overflow: "hidden" }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 90px 90px 80px 80px 80px 1fr 110px",
                gap: 0, padding: "10px 16px",
                background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))", borderBottom: `1px solid ${T.border}`,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted,
              }}>
                <div>Opportunity</div>
                <div style={{ textAlign: "right" }}>Opp Score</div>
                <div style={{ textAlign: "right" }}>Win Prob</div>
                <div style={{ textAlign: "right" }}>EV</div>
                <div style={{ textAlign: "right" }}>Effort Hrs</div>
                <div style={{ textAlign: "right" }}>ROI</div>
                <div>Tier / Reason</div>
                <div style={{ textAlign: "center" }}>Decision</div>
              </div>

              {displayRows.map((row, idx) => {
                const cfg = tierCfg(row.opp.score_tier);
                const isIn  = row.decision === "in";
                const isOut = row.decision === "out";
                const effortVal = resolvedEffort[row.opp.id] ?? cfg.defaultHrs;

                // Compare to what-if
                const wiRow = whatIfRows?.find(r => r.opp.id === row.opp.id);
                const wiChanged = wiRow && wiRow.decision !== row.decision;

                return (
                  <div
                    key={row.opp.id}
                    data-testid={`alloc-row-${row.opp.id}`}
                    style={{
                      display: "grid", gridTemplateColumns: "2fr 90px 90px 80px 80px 80px 1fr 110px",
                      gap: 0, padding: "12px 16px",
                      borderBottom: idx < displayRows.length - 1 ? `1px solid ${T.border}` : "none",
                      background: isIn ? "rgba(34,197,94,0.03)" : isOut ? "transparent" : "transparent",
                      opacity: row.decision === "locked-out" ? 0.45 : 1,
                      alignItems: "center",
                    }}>
                    {/* Name + industry */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                        {row.opp.employer_name ?? `Opportunity ${row.opp.id.slice(0, 8)}`}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted }}>
                        {row.opp.industry ?? "—"}
                        {row.opp.covered_lives ? ` · ${row.opp.covered_lives.toLocaleString()} lives` : ""}
                      </div>
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: "right" }}>
                      <span style={{
                        fontSize: 15, fontWeight: 800,
                        color: (row.opp.opportunity_score ?? 0) >= 78 ? T.green : (row.opp.opportunity_score ?? 0) >= 58 ? T.gold : (row.opp.opportunity_score ?? 0) >= 38 ? T.amber : T.red,
                      }}>
                        {row.opp.opportunity_score ?? "—"}
                      </span>
                    </div>

                    {/* Win prob */}
                    <div style={{ textAlign: "right", fontSize: 13, color: T.text }}>
                      {pct(row.opp.score_breakdown?.win_probability ?? 50)}
                    </div>

                    {/* EV */}
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: row.ev > 0 ? T.gold : T.muted }}>
                        {row.ev > 0 ? fmtK$(row.ev) : "—"}
                      </span>
                    </div>

                    {/* Effort (editable) */}
                    <div style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        <button
                          data-testid={`btn-effort-minus-${row.opp.id}`}
                          onClick={() => setEffortMap(m => ({ ...m, [row.opp.id]: Math.max(0, effortVal - 4) }))}
                          style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.72)", color: T.muted, cursor: "pointer", fontSize: 11, lineHeight: 1 }}>
                          −
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text, minWidth: 26, textAlign: "center" }}>
                          {effortVal}
                        </span>
                        <button
                          data-testid={`btn-effort-plus-${row.opp.id}`}
                          onClick={() => setEffortMap(m => ({ ...m, [row.opp.id]: effortVal + 4 }))}
                          style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.72)", color: T.muted, cursor: "pointer", fontSize: 11, lineHeight: 1 }}>
                          +
                        </button>
                      </div>
                    </div>

                    {/* ROI */}
                    <div style={{ textAlign: "right", fontSize: 12, color: row.roi > 0 ? T.purple : T.muted, fontWeight: 600 }}>
                      {row.roi > 0 ? `${fmtK$(row.roi)}/hr` : "—"}
                    </div>

                    {/* Tier + reason */}
                    <div style={{ paddingLeft: 8 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Pill color={cfg.color} bg={cfg.bg} label={cfg.label} />
                        {wiChanged && wiRow && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: T.cyan }}>
                            WI: {wiRow.decision === "in" ? "↑ IN" : "↓ OUT"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
                        {row.reason}
                      </div>
                    </div>

                    {/* Decision */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <DecisionBadge d={row.decision} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Allocation summary ──────────────────────────────────────────── */}
            <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* In scope */}
              <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                  <CheckCircle2 size={15} color={T.green} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Staffed — {inRows.length} Opportunit{inRows.length !== 1 ? "ies" : "y"}
                  </span>
                </div>
                {inRows.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.muted }}>No opportunities staffed. Increase capacity or adjust effort estimates.</p>
                ) : (
                  inRows.map(r => (
                    <div key={r.opp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(34,197,94,0.1)" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                          {r.opp.employer_name ?? r.opp.id.slice(0, 12)}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>{r.effortHrs} hrs · {tierCfg(r.opp.score_tier).label}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{fmtK$(r.ev)}</div>
                        <div style={{ fontSize: 10, color: T.muted }}>EV</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Out of scope */}
              <div className="kiq-ops-card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                  <Minus size={15} color={T.amber} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.amber, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Deferred — {outRows.length} Opportunit{outRows.length !== 1 ? "ies" : "y"}
                  </span>
                </div>
                {outRows.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.muted }}>All scored opportunities fit within current capacity.</p>
                ) : (
                  outRows.map(r => (
                    <div key={r.opp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                          {r.opp.employer_name ?? r.opp.id.slice(0, 12)}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>{r.effortHrs} hrs needed · {fmtK$(r.ev)} EV foregone</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>{pct(r.opp.score_breakdown?.win_probability ?? 50)} win</div>
                        <div style={{ fontSize: 10, color: T.muted }}>prob</div>
                      </div>
                    </div>
                  ))
                )}
                {outRows.length > 0 && (
                  <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <div style={{ fontSize: 11, color: T.amber, fontWeight: 600 }}>
                      {fmtK$(outRows.reduce((s, r) => s + r.ev, 0))} EV left on the table
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
                      Add {outRows.reduce((s, r) => s + r.effortHrs, 0)} hrs of capacity to capture all deferred opportunities.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
