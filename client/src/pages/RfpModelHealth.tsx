import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, Gauge, Target, AlertTriangle, Copy, ArrowUpRight,
  ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, Send, TrendingUp,
} from "lucide-react";
import {
  runMonteCarlo, filterOpenOpps, type ForecastOpportunity,
} from "@/lib/pipelineForecast";

const GREEN = "#34d399";

function fmt$(v?: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
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

function Section({ title, icon: Icon, color, desc, children, action }: {
  title: string; icon: any; color: string; desc: string;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.72))", border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 18, padding: 20, marginBottom: 18,
      boxShadow: "0 18px 46px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.88)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center",
          background: `${color}1a`, border: `1px solid ${color}44`, color, flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 850, color: "#0f172a", margin: 0 }}>{title}</h3>
          <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0", fontWeight: 600 }}>{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.76)", border: "1px solid rgba(15,23,42,0.08)",
      borderRadius: 10, padding: "12px 14px", flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

// ── #1 Scoring validation ────────────────────────────────────────────────────
type Validation = {
  tier: string; n: number; n_won?: number; n_lost?: number;
  brier?: number | null; auc?: number | null; message?: string;
  calibration: { range: string; count: number; predicted: number | null; observed: number | null }[];
  method?: string;
};
function ScoringValidationCard() {
  const { data, isLoading } = useQuery<Validation>({ queryKey: ["/api/rfp/scoring/validation"] });
  return (
    <Section title="Score-the-Score Validation" icon={Gauge} color="#60a5fa"
      desc="How well the opportunity score predicts real wins — measured against closed deals."
      action={data ? <TierBadge tier={data.tier} /> : undefined}>
      {isLoading && <div style={{ color: "#8a8a92", fontSize: 13 }}>Loading…</div>}
      {data && data.tier === "INSUFFICIENT_EVIDENCE" && (
        <div data-testid="text-validation-insufficient" style={{ fontSize: 13, color: "#fbbf24" }}>{data.message}</div>
      )}
      {data && data.tier !== "INSUFFICIENT_EVIDENCE" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat label="Brier Score" value={data.brier?.toFixed(3) ?? "—"} sub="0 perfect · 0.25 coin flip" />
            <Stat label="AUC" value={data.auc?.toFixed(3) ?? "—"} sub="0.5 no skill · 0.7+ useful" />
            <Stat label="Decided Deals" value={String(data.n)} sub={`${data.n_won ?? 0} won · ${data.n_lost ?? 0} lost`} />
          </div>
          <div style={{ fontSize: 11, color: "#8a8a92", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Calibration</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
            {data.calibration.map((b) => (
              <div key={b.range} data-testid={`calib-${b.range}`} style={{
                background: "rgba(255,255,255,0.025)", border: "1px solid #e2e8f0",
                borderRadius: 8, padding: "8px 10px", opacity: b.count ? 1 : 0.4,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#cfcfd4" }}>{b.range}</div>
                <div style={{ fontSize: 11, color: "#8a8a92", marginTop: 3 }}>
                  pred {b.predicted != null ? `${(b.predicted * 100).toFixed(0)}%` : "—"} · obs {b.observed != null ? `${(b.observed * 100).toFixed(0)}%` : "—"}
                </div>
                <div style={{ fontSize: 10, color: "#6a6a72" }}>n={b.count}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ── #5 Bid elasticity ─────────────────────────────────────────────────────────
type AlphaFit = {
  tier: string; n: number; alpha?: number | null; base_win_prob?: number | null;
  log_loss?: number; message?: string;
  buckets: { label: string; count: number; win_rate: number | null }[];
};
function BidElasticityCard() {
  const { data, isLoading } = useQuery<AlphaFit>({ queryKey: ["/api/rfp/bid/alpha-fit"] });
  return (
    <Section title="Empirical Price Elasticity (α)" icon={TrendingUp} color="#f472b6"
      desc="Fits the bid model's price-sensitivity α from your real win/loss prices."
      action={data ? <TierBadge tier={data.tier} /> : undefined}>
      {isLoading && <div style={{ color: "#8a8a92", fontSize: 13 }}>Loading…</div>}
      {data && data.tier === "INSUFFICIENT_EVIDENCE" && (
        <div data-testid="text-alpha-insufficient" style={{ fontSize: 13, color: "#fbbf24" }}>{data.message}</div>
      )}
      {data && data.tier !== "INSUFFICIENT_EVIDENCE" && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Stat label="Fitted α" value={data.alpha?.toFixed(2) ?? "—"} sub="higher = price-sensitive" />
            <Stat label="Base Win Prob" value={data.base_win_prob != null ? `${(data.base_win_prob * 100).toFixed(0)}%` : "—"} />
            <Stat label="Log-Loss" value={data.log_loss?.toFixed(3) ?? "—"} sub={`${data.n} priced deals`} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
            {data.buckets.map((b) => (
              <div key={b.label} style={{
                background: "rgba(255,255,255,0.025)", border: "1px solid #e2e8f0",
                borderRadius: 8, padding: "8px 10px", opacity: b.count ? 1 : 0.4,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#cfcfd4" }}>{b.label}</div>
                <div style={{ fontSize: 11, color: "#8a8a92", marginTop: 3 }}>
                  win {b.win_rate != null ? `${(b.win_rate * 100).toFixed(0)}%` : "—"} · n={b.count}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

// ── #6 Stale pipeline (+ #2 HubSpot sync) ─────────────────────────────────────
type StaleItem = {
  id: string; employer_name: string; stage: string; owner?: string | null;
  opportunity_score?: number | null; estimated_value?: number | null;
  days_to_deadline?: number | null; days_idle?: number | null;
  severity: number; reasons: string[]; recommended_action: string;
};
function StalePipelineCard() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ count: number; items: StaleItem[] }>({ queryKey: ["/api/rfp/pipeline/stale"] });
  const sync = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/rfp/opportunities/${id}/hubspot-sync`).then((r) => r.json()),
    onSuccess: (r: any) => toast({
      title: r.demo ? "HubSpot demo receipt" : "Synced to HubSpot",
      description: r.demo ? r.message : `Deal "${r.deal_name}" created (${r.hubspot_deal_id}).`,
    }),
    onError: (e: any) => toast({ title: "Sync failed", description: String(e.message || e), variant: "destructive" }),
  });
  return (
    <Section title="Stale & Overdue Pipeline" icon={AlertTriangle} color="#fb923c"
      desc="High-value opportunities going cold, unassigned, or past their response deadline.">
      {isLoading && <div style={{ color: "#8a8a92", fontSize: 13 }}>Loading…</div>}
      {data && data.count === 0 && <div data-testid="text-stale-empty" style={{ fontSize: 13, color: GREEN }}>Pipeline is healthy — nothing stale or overdue.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data?.items.map((it) => (
          <div key={it.id} data-testid={`row-stale-${it.id}`} style={{
            background: "rgba(255,255,255,0.025)", border: `1px solid ${it.severity >= 4 ? "#f8717155" : "#e2e8f0"}`,
            borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f7" }}>{it.employer_name}</div>
              <div style={{ fontSize: 11, color: "#8a8a92", marginTop: 2 }}>
                {it.stage} · {it.owner || "unassigned"} · {it.opportunity_score != null ? `score ${it.opportunity_score}` : "unscored"} · {fmt$(it.estimated_value)}
              </div>
              <div style={{ fontSize: 11, color: "#fb923c", marginTop: 4 }}>{it.reasons.join(" · ")}</div>
            </div>
            <button
              data-testid={`button-hubspot-sync-${it.id}`}
              onClick={() => sync.mutate(it.id)}
              disabled={sync.isPending}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                color: "#ff7a59", background: "rgba(255,122,89,0.12)", border: "1px solid rgba(255,122,89,0.4)",
                borderRadius: 8, padding: "7px 12px", cursor: "pointer",
              }}>
              <Send size={13} /> Sync to HubSpot
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── #7 Duplicate accounts ──────────────────────────────────────────────────────
type DupCluster = {
  key: string; matched_on: string; canonical_name: string; variants: string[];
  members: { kind: string; id: string; name: string; ein?: string | null; state?: string | null }[];
  size: number;
};
function DuplicatesCard() {
  const { data, isLoading } = useQuery<{ count: number; clusters: DupCluster[] }>({ queryKey: ["/api/rfp/accounts/duplicates"] });
  return (
    <Section title="Entity Resolution — Duplicate Accounts" icon={Copy} color="#a78bfa"
      desc="Likely-duplicate employer records across accounts and opportunities, matched by EIN or normalized name.">
      {isLoading && <div style={{ color: "#8a8a92", fontSize: 13 }}>Loading…</div>}
      {data && data.count === 0 && <div data-testid="text-dupes-empty" style={{ fontSize: 13, color: GREEN }}>No duplicate accounts detected.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data?.clusters.map((c) => (
          <div key={c.key} data-testid={`row-dupe-${c.key}`} style={{
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(167,139,250,0.25)",
            borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f5f7" }}>{c.canonical_name}</span>
              <span style={{ fontSize: 10, color: "#a78bfa", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)", borderRadius: 4, padding: "1px 6px" }}>
                {c.size} records · matched on {c.matched_on}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#8a8a92", marginTop: 5 }}>
              {c.members.map((m) => `${m.name} (${m.kind})`).join("  ·  ")}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── #3 Promote to pipeline ─────────────────────────────────────────────────────
function PromoteCard() {
  const { toast } = useToast();
  const [form, setForm] = useState({ employer_name: "", ein: "", state: "", industry: "", covered_lives: "" });
  const promote = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rfp/accounts/promote", {
      employer_name: form.employer_name.trim(),
      ein: form.ein.trim() || undefined,
      state: form.state.trim() || undefined,
      industry: form.industry.trim() || undefined,
      covered_lives: form.covered_lives ? Number(form.covered_lives) : undefined,
    }).then((r) => r.json()),
    onSuccess: (r: any) => {
      toast({ title: "Promoted to pipeline", description: r.message });
      setForm({ employer_name: "", ein: "", state: "", industry: "", covered_lives: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rfp/pipeline/stale"] });
    },
    onError: (e: any) => toast({ title: "Promote failed", description: String(e.message || e), variant: "destructive" }),
  });
  const inputStyle: React.CSSProperties = {
    background: "#ffffff", border: "1px solid #cbd5e1",
    borderRadius: 8, padding: "8px 10px", color: "#f5f5f7", fontSize: 13, flex: 1, minWidth: 130,
  };
  return (
    <Section title="Promote Account → Pipeline" icon={ArrowUpRight} color={GREEN}
      desc="Turn a watched prospect or account into a scored, forecastable opportunity.">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input data-testid="input-promote-name" placeholder="Employer name *" value={form.employer_name}
          onChange={(e) => setForm({ ...form, employer_name: e.target.value })} style={inputStyle} />
        <input data-testid="input-promote-ein" placeholder="EIN" value={form.ein}
          onChange={(e) => setForm({ ...form, ein: e.target.value })} style={{ ...inputStyle, maxWidth: 120 }} />
        <input data-testid="input-promote-state" placeholder="State" value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ ...inputStyle, maxWidth: 90 }} />
        <input data-testid="input-promote-industry" placeholder="Industry" value={form.industry}
          onChange={(e) => setForm({ ...form, industry: e.target.value })} style={inputStyle} />
        <input data-testid="input-promote-lives" placeholder="Covered lives" type="number" value={form.covered_lives}
          onChange={(e) => setForm({ ...form, covered_lives: e.target.value })} style={{ ...inputStyle, maxWidth: 130 }} />
        <button data-testid="button-promote" disabled={!form.employer_name.trim() || promote.isPending}
          onClick={() => promote.mutate()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700,
            color: "#0a0a0a", background: GREEN, border: "none", borderRadius: 8, padding: "9px 16px",
            cursor: form.employer_name.trim() ? "pointer" : "not-allowed", opacity: form.employer_name.trim() ? 1 : 0.5,
          }}>
          <ArrowUpRight size={14} /> Promote
        </button>
      </div>
    </Section>
  );
}

// ── #4 Correlation-aware forecast ─────────────────────────────────────────────
function CorrelationForecastCard() {
  const [rho, setRho] = useState(0);
  const { data: opps, isLoading } = useQuery<ForecastOpportunity[]>({ queryKey: ["/api/rfp/opportunities"] });
  const result = useMemo(() => {
    if (!opps) return null;
    const open = filterOpenOpps(opps);
    if (open.length === 0) return null;
    return runMonteCarlo(open, 4000, 1, rho);
  }, [opps, rho]);
  const openCount = opps ? filterOpenOpps(opps).length : 0;
  return (
    <Section title="Correlated Pipeline Forecast" icon={Target} color="#22d3ee"
      desc="Monte Carlo revenue forecast with a market-correlation control — model systemic risk where deals move together.">
      {isLoading && <div style={{ color: "#8a8a92", fontSize: 13 }}>Loading…</div>}
      {!isLoading && openCount === 0 && <div data-testid="text-forecast-empty" style={{ fontSize: 13, color: "#fbbf24" }}>No open opportunities to forecast.</div>}
      {result && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Stat label="P10 (conservative)" value={fmt$(result.p10)} />
            <Stat label="P50 (expected)" value={fmt$(result.p50)} />
            <Stat label="P90 (upside)" value={fmt$(result.p90)} />
            <Stat label="Mean" value={fmt$(result.mean)} sub={`${openCount} open deals`} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 12, color: "#8a8a92", fontWeight: 600, whiteSpace: "nowrap" }}>
              Market correlation ρ = {rho.toFixed(2)}
            </span>
            <input
              data-testid="slider-correlation"
              type="range" min={0} max={0.9} step={0.05} value={rho}
              onChange={(e) => setRho(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#22d3ee" }}
            />
          </div>
          <p style={{ fontSize: 11, color: "#6a6a72", marginTop: 8 }}>
            ρ=0 treats every deal independently. Higher ρ makes deals win or lose together, widening the P10–P90 band to reflect systemic market risk.
          </p>
        </>
      )}
    </Section>
  );
}

export default function RfpModelHealth() {
  return (
    <div className="kiq-ops-shell kiq-readable-surface" style={{ minHeight: "100vh", padding: "28px 24px 60px" }} data-testid="page-rfp-model-health">
      <div className="kiq-ops-header" style={{ maxWidth: 1100, margin: "0 auto 18px", display: "flex", alignItems: "center", gap: 12, padding: 20, borderRadius: 24, flexWrap: "wrap" }}>
        <Activity size={24} color={GREEN} />
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: 0 }}>RFP Model Health</h1>
        <span style={{
          fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: GREEN,
          background: "rgba(52,211,153,0.15)", border: "1px solid rgba(52,211,153,0.30)", borderRadius: 3, padding: "2px 6px",
        }}>NEW</span>
      </div>
      <p style={{ maxWidth: 1100, fontSize: 13, color: "#475569", margin: "0 auto 22px", fontWeight: 600 }}>
        Diagnostics and hygiene for the RFP Intelligence OS — validate the scoring model against real outcomes,
        keep the pipeline clean, and push deals into your CRM.
      </p>

      <ScoringValidationCard />
      <CorrelationForecastCard />
      <BidElasticityCard />
      <StalePipelineCard />
      <DuplicatesCard />
      <PromoteCard />
    </div>
  );
}
