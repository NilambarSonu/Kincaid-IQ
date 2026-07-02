import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Layers, PieChart, Users, TrendingUp, Network, Pill, ShieldAlert,
  Coins, HeartPulse, Building2, BarChart3, Search, ShieldCheck,
  ShieldQuestion, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Cell,
} from "recharts";

const DEFAULT_EIN = "231352204";

function fmt$(v?: number | null): string {
  if (v == null) return "—";
  const n = Math.abs(v);
  if (n >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtN(v?: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString();
}

function TierBadge({ tier }: { tier?: string }) {
  const map: Record<string, { c: string; Icon: any; label: string }> = {
    CERTIFIED: { c: "#34d399", Icon: ShieldCheck, label: "CERTIFIED" },
    MODELED: { c: "#fbbf24", Icon: ShieldAlert, label: "MODELED" },
    INSUFFICIENT_EVIDENCE: { c: "#f87171", Icon: ShieldQuestion, label: "INSUFFICIENT EVIDENCE" },
  };
  const m = map[tier || ""] || map.INSUFFICIENT_EVIDENCE;
  const Icon = m.Icon;
  return (
    <span data-testid={`badge-tier-${m.label}`} style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 800,
      letterSpacing: "0.1em", textTransform: "uppercase", color: m.c,
      background: `${m.c}1a`, border: `1px solid ${m.c}55`, borderRadius: 4, padding: "2px 7px",
    }}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

function Section({ title, icon: Icon, color, desc, tier, children }: {
  title: string; icon: any; color: string; desc: string;
  tier?: string; children: React.ReactNode;
}) {
  return (
    <div data-testid={`section-${title.replace(/\s+/g, "-").toLowerCase()}`} style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: 20, marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center",
          background: `${color}1a`, border: `1px solid ${color}44`, color, flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f7", margin: 0 }}>{title}</h3>
          <p style={{ fontSize: 12, color: "#8a8a92", margin: "3px 0 0" }}>{desc}</p>
        </div>
        {tier && <TierBadge tier={tier} />}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10, padding: "12px 14px", flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: 10, color: "#8a8a92", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || "#f5f5f7", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#8a8a92", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Note({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: 11, color: "#6e6e76", margin: "12px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>{text}</p>
  );
}

const RowStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 4,
};

const PCT_COLORS: Record<string, string> = {
  "≤P50": "#34d399", "P50–P75": "#fbbf24", "P75–P90": "#fb923c", ">P90": "#f87171", "n/a": "#6e6e76",
};

type MetricsResp = {
  ein: string;
  employer: { name: string; state: string; city: string; business_code: string; latest_year: number; participants: number; filing_count: number };
  sections: Record<string, any>;
  coverage: { certified: number; modeled: number; insufficient: number };
};

type SearchHit = { ein: string; name: string; state: string; city: string; business_code: string; participants: number };

export default function PlanMetricsLab() {
  const [ein, setEin] = useState(DEFAULT_EIN);
  const [q, setQ] = useState("");

  const { data, isLoading, isError } = useQuery<MetricsResp>({
    queryKey: ["/api/plan-metrics", ein],
  });
  const { data: hits } = useQuery<SearchHit[]>({
    queryKey: [`/api/plan-metrics/search?q=${encodeURIComponent(q.trim())}`],
    enabled: q.trim().length >= 2,
  });

  const s = data?.sections || {};

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 22px 80px" }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={22} style={{ color: "#4f7dff" }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f5f5f7", margin: 0 }}>Plan Metrics Intelligence</h1>
        </div>
        <p style={{ fontSize: 13, color: "#8a8a92", margin: "6px 0 0" }}>
          Eleven employer-level intelligence sections computed live from DOL Form 5500 filings.
          Every finding carries a confidence tier — no number outruns its evidence.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px" }}>
          <Search size={16} style={{ color: "#8a8a92" }} />
          <input
            data-testid="input-employer-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employer by name or EIN…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f5f5f7", fontSize: 14 }}
          />
        </div>
        {hits && hits.length > 0 && q.trim().length >= 2 && (
          <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, background: "#16161a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", maxHeight: 320, overflowY: "auto" }}>
            {hits.map((h) => (
              <button
                key={h.ein}
                data-testid={`result-employer-${h.ein}`}
                onClick={() => { setEin(h.ein); setQ(""); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#f5f5f7", cursor: "pointer" }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.name}</div>
                <div style={{ fontSize: 11, color: "#8a8a92" }}>{h.city}, {h.state} · EIN {h.ein} · {fmtN(h.participants)} participants</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && <div style={{ color: "#8a8a92", padding: 40, textAlign: "center" }}>Computing intelligence sections…</div>}
      {isError && <div style={{ color: "#f87171", padding: 40, textAlign: "center" }}>No Form 5500 filings found for this employer.</div>}

      {data && (
        <>
          {/* Employer header + coverage */}
          <div style={{ background: "linear-gradient(135deg, rgba(79,125,255,0.10), rgba(79,125,255,0.02))", border: "1px solid rgba(79,125,255,0.25)", borderRadius: 14, padding: 18, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div data-testid="text-employer-name" style={{ fontSize: 18, fontWeight: 800, color: "#f5f5f7" }}>{data.employer.name}</div>
                <div style={{ fontSize: 12, color: "#8a8a92", marginTop: 3 }}>
                  {data.employer.city}, {data.employer.state} · EIN {data.ein} · NAICS {data.employer.business_code} · {fmtN(data.employer.participants)} participants · {data.employer.filing_count} filings
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>{data.coverage.certified} certified</span>
                <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700 }}>{data.coverage.modeled} modeled</span>
                <span style={{ fontSize: 11, color: "#f87171", fontWeight: 700 }}>{data.coverage.insufficient} gaps</span>
              </div>
            </div>
          </div>

          {/* #1 Funding type */}
          <Section title="Funding Type" icon={Layers} color="#4f7dff" tier={s.funding_type?.tier}
            desc="Self-insured vs fully-insured, inferred from premium / carrier / stop-loss signals.">
            {s.funding_type?.summary && (
              <div style={RowStyle}>
                <Stat label="Self-insured" value={String(s.funding_type.summary.self_insured)} color="#fbbf24" />
                <Stat label="Fully-insured" value={String(s.funding_type.summary.fully_insured)} color="#34d399" />
                <Stat label="Indeterminate" value={String(s.funding_type.summary.indeterminate)} />
              </div>
            )}
            {s.funding_type?.plans?.map((p: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                <span style={{ color: "#c7c7cf" }}>{p.plan} {p.carrier ? `· ${p.carrier}` : ""}</span>
                <span style={{ color: p.funding === "Self-insured" ? "#fbbf24" : p.funding === "Fully-insured" ? "#34d399" : "#8a8a92", fontWeight: 700 }}>{p.funding}</span>
              </div>
            ))}
            <Note text={s.funding_type?.note} />
          </Section>

          {/* #2 Benefit lines */}
          <Section title="Benefit-Line Breakdown" icon={PieChart} color="#22d3ee" tier={s.benefit_lines?.tier}
            desc="Coverage composition and estimated per-line PMPM (Rx bundled within Health).">
            {s.benefit_lines?.total_pmpm != null && (
              <div style={RowStyle}>
                <Stat label="Total PMPM" value={`$${s.benefit_lines.total_pmpm}`} />
                <Stat label="Total Premium" value={fmt$(s.benefit_lines.total_premium)} />
                <Stat label="Lines Present" value={String(s.benefit_lines.lines_present?.length || 0)} />
              </div>
            )}
            {s.benefit_lines?.estimated_split?.map((b: any) => (
              <div key={b.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12 }}>
                <span style={{ width: 130, color: "#c7c7cf" }}>{b.label}</span>
                <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${b.share_pct}%`, height: "100%", background: "#22d3ee" }} />
                </div>
                <span style={{ width: 60, textAlign: "right", color: "#8a8a92" }}>{b.share_pct}%</span>
                <span style={{ width: 70, textAlign: "right", color: "#c7c7cf" }}>${b.est_pmpm}</span>
              </div>
            ))}
            <Note text={s.benefit_lines?.note} />
          </Section>

          {/* #3 Participant detail */}
          <Section title="Participant Detail" icon={Users} color="#a78bfa" tier={s.participant_detail?.tier}
            desc="Active / retired / separated-vested split.">
            <Stat label="Total Participants" value={fmtN(s.participant_detail?.total_participants)} />
            <Note text={s.participant_detail?.note} />
          </Section>

          {/* #4 Trends */}
          <Section title="Multi-Year Trend & Volatility" icon={TrendingUp} color="#34d399" tier={s.trends?.tier}
            desc="Year-over-year fee trajectory and stability per line.">
            {s.trends?.series && (
              <div style={{ height: 220, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.trends.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="year" stroke="#8a8a92" fontSize={11} />
                    <YAxis stroke="#8a8a92" fontSize={11} tickFormatter={(v) => fmt$(v)} width={52} />
                    <Tooltip contentStyle={{ background: "#16161a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmt$(v)} />
                    <Line type="monotone" dataKey="admin" name="Admin" stroke="#34d399" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="broker" name="Broker" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="premium" name="Premium" stroke="#4f7dff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {s.trends?.metrics && (
              <div style={{ ...RowStyle, marginTop: 12 }}>
                {Object.entries(s.trends.metrics).map(([k, m]: [string, any]) => (
                  <Stat key={k} label={k} value={`${m.trend_pct > 0 ? "+" : ""}${m.trend_pct}%`}
                    sub={`vol ${m.volatility_cv}`} color={m.trend_pct >= 10 && m.volatility_cv < 0.5 ? "#fb923c" : "#f5f5f7"} />
                ))}
              </div>
            )}
            {s.trends?.creeping_fee_flags?.length > 0 && (
              <p style={{ fontSize: 12, color: "#fb923c", marginTop: 10 }}>⚠ Creeping fee lines: {s.trends.creeping_fee_flags.join(", ")}</p>
            )}
            <Note text={s.trends?.note} />
          </Section>

          {/* #5 Provider leakage */}
          <Section title="Provider Leakage Map" icon={Network} color="#fb7185" tier={s.provider_leakage?.tier}
            desc="Carrier-level compensation; indirect Schedule C comp flagged where unavailable.">
            {s.provider_leakage?.providers?.map((p: any, i: number) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: i ? "1px solid rgba(255,255,255,0.05)" : "none", fontSize: 12 }}>
                <span style={{ color: "#c7c7cf", flex: 1 }}>{p.carrier}{p.flag && <span style={{ color: "#f87171", marginLeft: 8, fontSize: 10 }}>⚑ {p.flag}</span>}</span>
                <span style={{ color: "#8a8a92" }}>broker {fmt$(p.broker_comm)}</span>
                <span style={{ color: "#8a8a92" }}>admin {fmt$(p.admin_fees)}</span>
              </div>
            ))}
            <Note text={s.provider_leakage?.note} />
          </Section>

          {/* #6 PBM exposure */}
          <Section title="Rx / PBM Exposure" icon={Pill} color="#f472b6" tier={s.pbm_exposure?.tier}
            desc="Modeled pharmacy spend and spread exposure band.">
            {s.pbm_exposure?.est_annual_rx_spend != null && (
              <div style={RowStyle}>
                <Stat label="Est. Annual Rx Spend" value={fmt$(s.pbm_exposure.est_annual_rx_spend)} />
                <Stat label="Spread Exposure" value={`${fmt$(s.pbm_exposure.est_spread_exposure_low)}–${fmt$(s.pbm_exposure.est_spread_exposure_high)}`} color="#fb923c" />
                <Stat label="Rebate Retention" value="N/A" sub="needs PBM contract" />
              </div>
            )}
            <Note text={s.pbm_exposure?.note} />
          </Section>

          {/* #7 Catastrophic */}
          <Section title="Catastrophic Claim & IBNR" icon={ShieldAlert} color="#f59e0b" tier={s.catastrophic?.tier}
            desc="Modeled high-cost claimant projection and reserve estimate.">
            {s.catastrophic?.expected_catastrophic_cost != null && (
              <div style={RowStyle}>
                <Stat label="Expected Claimants" value={fmtN(s.catastrophic.expected_catastrophic_claimants)} />
                <Stat label="Expected Cat. Cost" value={fmt$(s.catastrophic.expected_catastrophic_cost)} color="#f59e0b" />
                <Stat label="IBNR Reserve" value={fmt$(s.catastrophic.ibnr_reserve_estimate)} />
              </div>
            )}
            <Note text={s.catastrophic?.note} />
          </Section>

          {/* #8 Recoverable bands */}
          <Section title="Recoverable Fees (Bands)" icon={Coins} color="#fbbf24" tier={s.recoverable_bands?.tier}
            desc="Recoverable fees as a disclosed P10 / P50 / P90 range.">
            {s.recoverable_bands?.recoverable_bands && (
              <div style={RowStyle}>
                <Stat label="P10 (conservative)" value={fmt$(s.recoverable_bands.recoverable_bands.p10)} />
                <Stat label="P50 (base case)" value={fmt$(s.recoverable_bands.recoverable_bands.p50)} color="#fbbf24" />
                <Stat label="P90 (aggressive)" value={fmt$(s.recoverable_bands.recoverable_bands.p90)} />
                <Stat label="Excess vs Median" value={fmt$(s.recoverable_bands.excess_over_benchmark)} />
              </div>
            )}
            <Note text={s.recoverable_bands?.note} />
          </Section>

          {/* #9 Condition exposure */}
          <Section title="Multi-Condition Exposure" icon={HeartPulse} color="#f87171" tier={s.condition_exposure?.tier}
            desc="Workforce health exposure modeled across high-cost conditions.">
            {s.condition_exposure?.conditions && (
              <div style={{ height: 240, marginTop: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.condition_exposure.conditions} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="#8a8a92" fontSize={11} tickFormatter={(v) => fmt$(v)} />
                    <YAxis type="category" dataKey="condition" stroke="#8a8a92" fontSize={11} width={130} />
                    <Tooltip contentStyle={{ background: "#16161a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmt$(v)} />
                    <Bar dataKey="annual_cost_exposure" name="Annual Exposure" radius={[0, 4, 4, 0]}>
                      {s.condition_exposure.conditions.map((_: any, i: number) => (
                        <Cell key={i} fill={["#f87171", "#fb7185", "#fb923c", "#f59e0b", "#fbbf24", "#a78bfa"][i % 6]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {s.condition_exposure?.total_exposure != null && (
              <div style={{ marginTop: 12 }}><Stat label="Total Modeled Exposure" value={fmt$(s.condition_exposure.total_exposure)} color="#f87171" /></div>
            )}
            <Note text={s.condition_exposure?.note} />
          </Section>

          {/* #10 EBITDA / XBRL */}
          <Section title="EBITDA Impact (SEC XBRL)" icon={Building2} color="#60a5fa" tier={s.ebitda_xbrl?.tier}
            desc="Plan fees as a share of SEC-derived EBITDA (public employers only).">
            {s.ebitda_xbrl?.ebitda_impact_pct != null ? (
              <div style={RowStyle}>
                <Stat label="Company" value={s.ebitda_xbrl.company || "—"} />
                <Stat label="Est. EBITDA" value={fmt$(s.ebitda_xbrl.ebitda_est)} />
                <Stat label="Plan Fees" value={fmt$(s.ebitda_xbrl.plan_fees)} />
                <Stat label="EBITDA Impact" value={`${s.ebitda_xbrl.ebitda_impact_pct}%`} color="#60a5fa" />
              </div>
            ) : null}
            <Note text={s.ebitda_xbrl?.note} />
          </Section>

          {/* #11 Peer cohorts */}
          <Section title="Peer Cohorts" icon={BarChart3} color="#2dd4bf" tier={s.peer_cohorts?.tier}
            desc="Percentile placement vs national-industry and state cohorts.">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              {["national", "state_cohort"].map((key) => {
                const c = s.peer_cohorts?.[key];
                if (!c) return null;
                return (
                  <div key={key} style={{ flex: 1, minWidth: 240, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#8a8a92", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
                      {key === "national" ? "National Industry" : "State Cohort"} · {fmtN(c.plan_count)} plans
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                      <span style={{ color: "#c7c7cf" }}>Admin fees</span>
                      <span style={{ color: PCT_COLORS[c.admin_percentile] || "#c7c7cf", fontWeight: 700 }}>{c.admin_percentile}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                      <span style={{ color: "#c7c7cf" }}>Broker comm.</span>
                      <span style={{ color: PCT_COLORS[c.broker_percentile] || "#c7c7cf", fontWeight: 700 }}>{c.broker_percentile}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#6e6e76", marginTop: 6 }}>P50 {fmt$(c.p50_admin_fees)} · P75 {fmt$(c.p75_admin_fees)} · P90 {fmt$(c.p90_admin_fees)}</div>
                  </div>
                );
              })}
            </div>
            <Note text={s.peer_cohorts?.note} />
          </Section>
        </>
      )}
    </div>
  );
}
