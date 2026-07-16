import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Loader2, X, Search, TrendingUp, Layers, Users, Mail, BarChart3,
  Crown, Award, Medal, Circle, ArrowRight, Building2, MapPin, Brain,
  AlertTriangle, Target, ChevronRight, DollarSign, Gauge, Network,
} from "lucide-react";

const BB_CRIMSON = "#9B1C2E";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreComponent = { label: string; score: number; max: number; detail: string };
type Routing = { region: string; vertical: string; team: string; primary_owner: string; secondary_owner: string; executive_sponsor: string };
type Lifecycle = { stage_num: number; stage: string; modeled: boolean };
type Filing = {
  ein: string; sponsor: string; state: string; city: string; form_year: number;
  participants: number; total_income: number; admin_fees: number; broker_commissions: number;
  carrier: string | null; score: number; tier: string; tier_action: string;
  opportunity_value: number; components: ScoreComponent[]; routing: Routing; lifecycle: Lifecycle;
};
type FeedResp = { filings: Filing[]; returned: number; matched: number };
type Stats = {
  filings_processed: number; opportunities_active: number;
  by_tier: Record<string, number>;
  by_state: { state: string; count: number }[];
  by_vertical: { vertical: string; count: number }[];
  lifecycle_funnel: { stage: string; count: number }[];
  total_opportunity_value: number; avg_score: number; assigned: number; funnel_modeled: boolean;
};
type CommandCenter = {
  filing: Filing;
  profile: { ein: string; sponsor: string; state: string; city: string; business_code: string; form_year: number; welfare_codes: string };
  benchmark: {
    admin_fees: number; industry: { p50: number; p75: number; p90: number };
    state: { admin_p50: number; admin_p75: number; admin_p90: number; broker_p50: number; broker_p75: number; plan_count: number } | null;
    broker_commissions: number; excess_admin: number; excess_pbm: number; total_savings_opportunity: number;
  };
  relationships: { carrier: string; years_on_file: number; last_year: number; premiums: number }[];
};
type Consultant = { rank: number; name: string; employers_represented: number; total_covered_lives: number; total_premiums: number; total_commissions: number; opportunity_value: number };
type AiBrief = {
  filing: Filing; ai_generated: boolean;
  opportunity_summary: string; risk_assessment: string; recommended_strategy: string;
  recommended_team: string; recommended_next_action: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  Platinum: "#e879f9", Gold: "#fbbf24", Silver: "#cbd5e1", Bronze: "#d4894f",
};
const TIER_ICON: Record<string, any> = { Platinum: Crown, Gold: Award, Silver: Medal, Bronze: Circle };
const STAGE_COLORS = ["#64748b", "#60a5fa", "#22d3ee", "#34d399", "#a3e635", "#fbbf24", "#fb923c", "#e879f9"];

function fmt$(n: number): string {
  if (!n) return "$0";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtN(n: number): string { return (n || 0).toLocaleString(); }

const SUB_TABS = [
  { id: "pipeline", label: "Filing Pipeline", icon: Layers },
  { id: "accountability", label: "Accountability", icon: BarChart3 },
  { id: "digest", label: "Executive Digest", icon: Mail },
  { id: "consultants", label: "Influencer Network", icon: Network },
];

const TIERS = ["All", "Platinum", "Gold", "Silver", "Bronze"];
const VERTICALS = ["All", "Healthcare", "Manufacturing", "Education", "Government", "Technology", "Retail", "General"];
const STATES_SHORT = ["All", "CA", "TX", "NY", "FL", "IL", "PA", "OH", "MI", "NJ", "MA", "WA", "CO", "GA", "TN", "IN"];

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier, small }: { tier: string; small?: boolean }) {
  const c = TIER_COLOR[tier] || "#94a3b8";
  const Icon = TIER_ICON[tier] || Circle;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: small ? "2px 8px" : "4px 11px", borderRadius: 100, fontSize: small ? 9 : 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", background: `${c}1a`, border: `1px solid ${c}55`, color: c, whiteSpace: "nowrap" }}>
      <Icon size={small ? 10 : 12} /> {tier}
    </span>
  );
}

function StageTag({ life }: { life: Lifecycle }) {
  const c = STAGE_COLORS[life.stage_num - 1] || "#64748b";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: c }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />
      {life.stage_num}. {life.stage}
    </span>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color = "#08111f", testId }: { label: string; value: string; sub?: string; color?: string; testId?: string }) {
  return (
    <div className="kiq-ops-card" data-testid={testId} style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 9, fontWeight: 900, color: "#3f516a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#3f516a", marginTop: 6, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ─── Filing card ──────────────────────────────────────────────────────────────

function FilingCard({ f, onOpen }: { f: Filing; onOpen: (ein: string) => void }) {
  const c = TIER_COLOR[f.tier] || "#94a3b8";
  return (
    <button
      data-testid={`card-filing-${f.ein}`}
      onClick={() => onOpen(f.ein)}
      className="kiq-ops-card"
      style={{ textAlign: "left", width: "100%", cursor: "pointer", background: "rgba(255,255,255,0.82)", border: `1px solid ${c}33`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10, transition: "border-color .15s" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${c}77`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = `${c}33`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.sponsor}</div>
          <div style={{ fontSize: 10, color: "#475569", display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            <MapPin size={10} /> {f.city ? `${f.city}, ` : ""}{f.state} · {f.routing.vertical} · FY{f.form_year}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{f.score}</div>
          <div style={{ fontSize: 8, color: "#64748b", letterSpacing: "0.1em" }}>OI SCORE</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <TierBadge tier={f.tier} small />
        <span style={{ fontSize: 9, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.tier_action}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          ["Covered Lives", fmtN(f.participants)],
          ["Plan Income", fmt$(f.total_income)],
          ["Recoverable", fmt$(f.opportunity_value)],
        ].map(([k, v]) => (
          <div key={k} style={{ background: "rgba(248,250,252,0.90)", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ fontSize: 8, color: "#64748b", letterSpacing: "0.06em", textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: k === "Recoverable" ? "#059669" : "#08111f", marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #f8fafc" }}>
        <StageTag life={f.lifecycle} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#334155", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {f.routing.team} <ChevronRight size={12} />
        </span>
      </div>
    </button>
  );
}

// ─── Command Center drawer ────────────────────────────────────────────────────

function CommandCenter({ ein, onClose }: { ein: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<CommandCenter>({
    queryKey: ["/api/filing-intel/filing", ein],
  });
  const briefMut = useMutation<AiBrief, Error, void>({
    mutationFn: async () => {
      const r = await fetch("/api/filing-intel/ai-brief", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ein }), credentials: "include",
      });
      if (!r.ok) throw new Error("AI brief failed");
      return r.json();
    },
  });

  const f = data?.filing;
  const bench = data?.benchmark;
  const c = f ? TIER_COLOR[f.tier] : "#94a3b8";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", width: "min(680px, 100%)", height: "100%", background: "#F8FAFC", borderLeft: "1px solid #e2e8f0", overflowY: "auto", padding: 24 }}>
        <button data-testid="button-close-command" onClick={onClose} style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: "#475569", cursor: "pointer" }}>
          <X size={18} />
        </button>

        {isLoading || !f || !bench ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Header */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Filing Command Center</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{f.sponsor}</div>
              <div style={{ fontSize: 11, color: "#3f516a", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontWeight: 600 }}>
                <MapPin size={11} /> {f.city ? `${f.city}, ` : ""}{f.state} · EIN {f.ein} · {f.routing.vertical} · FY{f.form_year}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
                <TierBadge tier={f.tier} />
                <span style={{ fontSize: 24, fontWeight: 900, color: c }}>{f.score}<span style={{ fontSize: 12, color: "#64748b" }}>/100</span></span>
                <StageTag life={f.lifecycle} />
              </div>
            </div>

            {/* Routing */}
            <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Territory Assignment</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["Opportunity Team", f.routing.team],
                  ["Region", f.routing.region],
                  ["Primary Owner", f.routing.primary_owner],
                  ["Secondary Owner", f.routing.secondary_owner],
                  ["Executive Sponsor", f.routing.executive_sponsor],
                  ["Vertical", f.routing.vertical],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score breakdown */}
            <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Opportunity Score — Explainable Breakdown</div>
              {f.components.map(comp => {
                const pct = (comp.score / comp.max) * 100;
                const cc = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
                return (
                  <div key={comp.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#1e2f46" }}>{comp.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: cc }}>{comp.score}/{comp.max}</span>
                    </div>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: cc, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>{comp.detail}</div>
                  </div>
                );
              })}
            </div>

            {/* Benchmark analysis */}
            <div style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#34d399", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Benchmark Analysis — Excess Cost vs Peers</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <StatTile label="Excess Admin" value={fmt$(bench.excess_admin)} color="#f87171" />
                <StatTile label="Excess PBM/Rx" value={fmt$(bench.excess_pbm)} color="#fbbf24" />
                <StatTile label="Total Savings Opp" value={fmt$(bench.total_savings_opportunity)} color="#34d399" />
              </div>
              <div style={{ fontSize: 10, color: "#334155", marginBottom: 6 }}>
                Admin fees <b style={{ color: "#0F172A" }}>{fmt$(bench.admin_fees)}</b> vs industry median <b style={{ color: "#0F172A" }}>{fmt$(bench.industry.p50)}</b> · P75 {fmt$(bench.industry.p75)} · P90 {fmt$(bench.industry.p90)}
              </div>
              {bench.state && (
                <div style={{ fontSize: 10, color: "#334155" }}>
                  Geographic peers ({f.state}, {bench.state.plan_count} plans): admin median {fmt$(bench.state.admin_p50)} · P75 {fmt$(bench.state.admin_p75)}
                </div>
              )}
            </div>

            {/* Relationships */}
            {data.relationships.length > 0 && (
              <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Carrier & Consultant Relationships</div>
                {data.relationships.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < data.relationships.length - 1 ? "1px solid #f8fafc" : "none" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>{r.carrier}</span>
                    <span style={{ fontSize: 10, color: "#3f516a", fontWeight: 600 }}>{r.premiums > 0 ? fmt$(r.premiums) + " · " : ""}{r.years_on_file}y · last {r.last_year}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI brief */}
            <div style={{ background: "linear-gradient(135deg, rgba(0,43,92,0.35), rgba(155,28,46,0.12))", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: "#c4b5fd", letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                  <Brain size={13} /> AI Prioritization & Recommendation
                </div>
                {!briefMut.data && (
                  <button data-testid="button-ai-brief" onClick={() => briefMut.mutate()} disabled={briefMut.isPending}
                    style={{ background: BB_CRIMSON, border: "none", borderRadius: 8, padding: "7px 14px", color: "#0F172A", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {briefMut.isPending ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={12} />}
                    Generate Brief
                  </button>
                )}
              </div>
              {briefMut.data ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    ["Why This Account Matters", briefMut.data.opportunity_summary, Target, "#34d399"],
                    ["Risk Assessment", briefMut.data.risk_assessment, AlertTriangle, "#f87171"],
                    ["Recommended Strategy", briefMut.data.recommended_strategy, TrendingUp, "#60a5fa"],
                    ["Recommended Next Action", briefMut.data.recommended_next_action, ArrowRight, "#fbbf24"],
                  ].map(([t, body, Icon, col]: any) => (
                    <div key={t}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: col, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon size={12} /> {t}
                      </div>
                      <div style={{ fontSize: 12, color: "#1e2f46", lineHeight: 1.6, fontWeight: 600 }}>{body}</div>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: "#475569" }}>
                    Recommended team: <b style={{ color: "#0F172A" }}>{briefMut.data.recommended_team}</b> · {briefMut.data.ai_generated ? "AI-generated" : "Rule-based"}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#3f516a", lineHeight: 1.6, fontWeight: 600 }}>
                  Generate a board-room-quality strategic brief: opportunity rationale, barriers, engagement path, recommended team, and the specific next action.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pipeline view ────────────────────────────────────────────────────────────

function PipelineView({ onOpen }: { onOpen: (ein: string) => void }) {
  const [tier, setTier] = useState("All");
  const [vertical, setVertical] = useState("All");
  const [state, setState] = useState("All");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");

  const url = useMemo(() => {
    const p = new URLSearchParams({ limit: "40" });
    if (tier !== "All") p.set("tier", tier);
    if (vertical !== "All") p.set("vertical", vertical);
    if (state !== "All") p.set("state", state);
    if (search.trim()) p.set("q", search.trim());
    return `/api/filing-intel/feed?${p.toString()}`;
  }, [tier, vertical, state, search]);

  const { data, isLoading } = useQuery<FeedResp>({ queryKey: [url] });

  const selStyle: React.CSSProperties = { background: "#F8FAFC", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", color: "#0F172A", fontSize: 11, fontWeight: 700, outline: "none", cursor: "pointer" };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <form onSubmit={e => { e.preventDefault(); setSearch(q); }} style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={13} color="#64748b" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input data-testid="input-filing-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search employer name…"
            style={{ ...selStyle, width: "100%", paddingLeft: 32, boxSizing: "border-box", cursor: "text" }} />
        </form>
        <select data-testid="filter-tier" value={tier} onChange={e => setTier(e.target.value)} style={selStyle}>
          {TIERS.map(t => <option key={t} value={t} style={{ background: "#F8FAFC" }}>{t === "All" ? "All Tiers" : t}</option>)}
        </select>
        <select data-testid="filter-vertical" value={vertical} onChange={e => setVertical(e.target.value)} style={selStyle}>
          {VERTICALS.map(v => <option key={v} value={v} style={{ background: "#F8FAFC" }}>{v === "All" ? "All Verticals" : v}</option>)}
        </select>
        <select data-testid="filter-state" value={state} onChange={e => setState(e.target.value)} style={selStyle}>
          {STATES_SHORT.map(s => <option key={s} value={s} style={{ background: "#F8FAFC" }}>{s === "All" ? "All States" : s}</option>)}
        </select>
      </div>

      {data && (
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>
          Showing <b style={{ color: "#0F172A" }}>{data.returned}</b> of {data.matched} matched opportunities · sorted by Opportunity Intelligence Score
        </div>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {data?.filings.map(f => <FilingCard key={f.ein} f={f} onOpen={onOpen} />)}
        </div>
      )}
      {data && data.filings.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#475569", fontSize: 12 }}>No filings match these filters.</div>
      )}
    </div>
  );
}

// ─── Accountability view ──────────────────────────────────────────────────────

function AccountabilityView() {
  const { data, isLoading } = useQuery<Stats>({ queryKey: ["/api/filing-intel/stats"] });
  if (isLoading || !data) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} /></div>;
  }
  const maxFunnel = Math.max(...data.lifecycle_funnel.map(s => s.count), 1);
  const maxState = Math.max(...data.by_state.map(s => s.count), 1);
  const tierTotal = Object.values(data.by_tier).reduce((a, b) => a + b, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <StatTile testId="stat-processed" label="Filings Processed" value={fmtN(data.filings_processed)} sub="distinct sponsors w/ financials" />
        <StatTile testId="stat-active" label="Active Opportunities" value={fmtN(data.opportunities_active)} color="#60a5fa" />
        <StatTile testId="stat-assigned" label="Assigned (Plat+Gold)" value={fmtN(data.assigned)} color="#fbbf24" />
        <StatTile testId="stat-value" label="Revenue Potential" value={fmt$(data.total_opportunity_value)} color="#34d399" sub="modeled recoverable" />
        <StatTile testId="stat-avg" label="Avg OI Score" value={`${data.avg_score}`} color="#e879f9" />
      </div>

      {/* Tier distribution */}
      <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Opportunity Tier Distribution</div>
        <div style={{ display: "flex", height: 14, borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
          {["Platinum", "Gold", "Silver", "Bronze"].map(t => {
            const w = ((data.by_tier[t] || 0) / tierTotal) * 100;
            return w > 0 ? <div key={t} style={{ width: `${w}%`, background: TIER_COLOR[t] }} title={`${t}: ${data.by_tier[t]}`} /> : null;
          })}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {["Platinum", "Gold", "Silver", "Bronze"].map(t => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: TIER_COLOR[t] }} />
              <span style={{ fontSize: 11, color: "#1e293b", fontWeight: 700 }}>{t}</span>
              <span style={{ fontSize: 11, color: "#0F172A", fontWeight: 900 }}>{data.by_tier[t] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
        {/* Lifecycle funnel */}
        <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Opportunity Lifecycle Funnel</div>
          {data.funnel_modeled && <div style={{ fontSize: 9, color: "#64748b", marginBottom: 12 }}>Stages 3–8 are a modeled pipeline projection</div>}
          {data.lifecycle_funnel.map((s, i) => (
            <div key={s.stage} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "#1e293b", fontWeight: 700 }}>{i + 1}. {s.stage}</span>
                <span style={{ fontSize: 10, color: "#0F172A", fontWeight: 800 }}>{s.count}</span>
              </div>
              <div style={{ height: 6, background: "#f8fafc", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${(s.count / maxFunnel) * 100}%`, height: "100%", background: STAGE_COLORS[i], borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>

        {/* By state */}
        <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Performance by State</div>
          {data.by_state.map(s => (
            <div key={s.state} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "#1e293b", fontWeight: 700 }}>{s.state}</span>
                <span style={{ fontSize: 10, color: "#0F172A", fontWeight: 800 }}>{s.count}</span>
              </div>
              <div style={{ height: 6, background: "#f8fafc", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${(s.count / maxState) * 100}%`, height: "100%", background: BB_CRIMSON, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By vertical */}
      <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Performance by Vertical</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {data.by_vertical.map(v => (
            <div key={v.vertical} style={{ background: "#ffffff", borderRadius: 10, padding: "10px 14px", flex: "1 1 130px" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#60a5fa" }}>{v.count}</div>
              <div style={{ fontSize: 10, color: "#334155", fontWeight: 700 }}>{v.vertical}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Digest view ──────────────────────────────────────────────────────────────

function DigestView({ onOpen }: { onOpen: (ein: string) => void }) {
  const { data, isLoading } = useQuery<{ daily: any; weekly: any; monthly: any }>({ queryKey: ["/api/filing-intel/digest"] });
  if (isLoading || !data) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} /></div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 880 }}>
      {/* Daily */}
      <div style={{ background: "linear-gradient(135deg, rgba(0,43,92,0.3), rgba(155,28,46,0.08))", border: "1px solid rgba(0,43,92,0.4)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#0F172A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Mail size={15} color={BB_CRIMSON} /> Daily Executive Digest
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
          <StatTile label="New Filings" value={fmtN(data.daily.new_filings)} />
          <StatTile label="Platinum" value={fmtN(data.daily.platinum)} color={TIER_COLOR.Platinum} />
          <StatTile label="Gold" value={fmtN(data.daily.gold)} color={TIER_COLOR.Gold} />
          <StatTile label="Pipeline Value" value={fmt$(data.daily.total_opportunity_value)} color="#34d399" />
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Highest-Scoring Accounts</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.daily.top_accounts.map((a: any) => (
            <button key={a.ein} data-testid={`digest-account-${a.ein}`} onClick={() => onOpen(a.ein)}
              style={{ textAlign: "left", cursor: "pointer", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sponsor}</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{a.state} · {a.team}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#34d399" }}>{fmt$(a.opportunity_value)}</span>
                <TierBadge tier={a.tier} small />
                <span style={{ fontSize: 16, fontWeight: 900, color: TIER_COLOR[a.tier] }}>{a.score}</span>
              </div>
            </button>
          ))}
        </div>
        {data.daily.new_pbm_opportunities.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", margin: "16px 0 10px" }}>New PBM Opportunities</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {data.daily.new_pbm_opportunities.map((p: any) => (
                <button key={p.ein} onClick={() => onOpen(p.ein)} style={{ cursor: "pointer", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "6px 11px", color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>
                  {p.sponsor} · {fmt$(p.value)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Weekly + Monthly */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#0F172A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Weekly Market Intelligence</div>
          {[["States Active", data.weekly.states_active], ["Verticals Active", data.weekly.verticals_active], ["Avg OI Score", data.weekly.avg_score]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
              <span style={{ fontSize: 11, color: "#334155" }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="kiq-ops-card" style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(15,23,42,0.10)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#0F172A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Monthly Executive Report</div>
          {[["Opportunities Generated", fmtN(data.monthly.opportunities_generated)], ["Opportunities Assigned", fmtN(data.monthly.opportunities_assigned)], ["Revenue Potential", fmt$(data.monthly.revenue_potential)]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
              <span style={{ fontSize: 11, color: "#334155" }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#34d399" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Consultants view ─────────────────────────────────────────────────────────

function ConsultantsView() {
  const { data, isLoading } = useQuery<{ consultants: Consultant[] }>({ queryKey: ["/api/filing-intel/consultants"] });
  if (isLoading || !data) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} /></div>;
  }
  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 14 }}>
        Carrier & consultant influence network ranked by covered lives represented across all filings.
      </div>
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr", gap: 10, padding: "10px 16px", background: "#ffffff", fontSize: 9, fontWeight: 800, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <span>#</span><span>Influencer</span><span style={{ textAlign: "right" }}>Employers</span><span style={{ textAlign: "right" }}>Covered Lives</span><span style={{ textAlign: "right" }}>Premiums</span><span style={{ textAlign: "right" }}>Opp Value</span>
        </div>
        {data.consultants.map(c => (
          <div key={c.rank} data-testid={`consultant-${c.rank}`} style={{ display: "grid", gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr", gap: 10, padding: "11px 16px", borderTop: "1px solid #f8fafc", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: c.rank <= 3 ? "#fbbf24" : "#475569" }}>{c.rank}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
            <span style={{ fontSize: 11, color: "#0f172a", textAlign: "right" }}>{fmtN(c.employers_represented)}</span>
            <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700, textAlign: "right" }}>{fmtN(c.total_covered_lives)}</span>
            <span style={{ fontSize: 11, color: "#0f172a", textAlign: "right" }}>{fmt$(c.total_premiums)}</span>
            <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700, textAlign: "right" }}>{fmt$(c.opportunity_value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────

export function FilingIntelligence() {
  const [sub, setSub] = useState("pipeline");
  const [openEin, setOpenEin] = useState<string | null>(null);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <Gauge size={18} color={BB_CRIMSON} />
          <span style={{ fontSize: 16, fontWeight: 900, color: "#0F172A" }}>Form 5500 Intelligence — Opportunity Management</span>
          <span style={{ fontSize: 8, fontWeight: 900, padding: "3px 9px", borderRadius: 100, background: `${BB_CRIMSON}22`, border: `1px solid ${BB_CRIMSON}50`, color: BB_CRIMSON, letterSpacing: "0.12em", textTransform: "uppercase" }}>Module 11</span>
        </div>
        <p style={{ fontSize: 11, color: "#475569", margin: 0, maxWidth: 760, lineHeight: 1.6 }}>
          Every Form 5500 filing scored, routed, and tracked like a qualified investment opportunity — Ingest → Score → Route → Distribute → Track. No filing enters without accountability.
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          const active = sub === t.id;
          return (
            <button key={t.id} data-testid={`subtab-${t.id}`} onClick={() => setSub(t.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, border: active ? `1px solid ${BB_CRIMSON}` : "1px solid #e2e8f0", background: active ? `${BB_CRIMSON}1f` : "transparent", color: active ? BB_CRIMSON : "#334155", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === "pipeline" && <PipelineView onOpen={setOpenEin} />}
      {sub === "accountability" && <AccountabilityView />}
      {sub === "digest" && <DigestView onOpen={setOpenEin} />}
      {sub === "consultants" && <ConsultantsView />}

      {openEin && <CommandCenter ein={openEin} onClose={() => setOpenEin(null)} />}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
