import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import {
  Search, Filter, Zap, BarChart3, Target, Brain, Globe, Database,
  ChevronRight, Plus, X, Trash2, Send, RefreshCw, ChevronDown,
  ArrowUpRight, Building2, Users, DollarSign, TrendingUp, Shield,
  FileSearch, Layers, AlertTriangle, CheckCircle, Clock, Star,
  MapPin, Settings, BookOpen, CheckSquare, Square, Menu, Bell, BellRing,
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

// ── US States ─────────────────────────────────────────────────────────────────
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (v?: number | null) => {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtPct = (v?: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const fmtNum = (v?: number | null) => (v == null ? "—" : v.toLocaleString());

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.15em", color: T.muted, marginBottom: 8, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    CERTIFIED: T.green, MODELED: T.gold, INSUFFICIENT_EVIDENCE: T.red,
  };
  const c = colors[tier] || T.muted;
  return (
    <span style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.1em", color: c, border: `1px solid ${c}40`, padding: "1px 5px", borderRadius: 3 }}>
      {tier}
    </span>
  );
}

function ScoreBadge({ score, tier }: { score: number; tier?: string }) {
  const color = tier === "green" ? T.green : tier === "yellow" ? T.gold : tier === "red" ? T.red
              : score >= 70 ? T.green : score >= 40 ? T.gold : T.red;
  const label = tier === "green" ? "HOT" : tier === "yellow" ? "WARM" : tier === "red" ? "COLD"
              : score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color }}>{score}</span>
      </div>
      <div>
        <div style={{ fontSize: 8, fontWeight: 700, color, letterSpacing: "0.12em" }}>{label}</div>
        <div style={{ fontSize: 7, color: T.muted }}>AI SCORE</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: T.surface2,
  border: `1px solid ${T.border}`,
  borderRadius: 5,
  padding: "7px 10px",
  color: T.text,
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fontWeight: 600,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  cursor: "pointer",
};

const btnStyle = (active = false): React.CSSProperties => ({
  background: active ? T.gold : "transparent",
  color: active ? "#000" : T.muted,
  border: `1px solid ${active ? T.gold : T.border}`,
  borderRadius: 5,
  padding: "6px 12px",
  fontFamily: "var(--font-sans)",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.1em",
  cursor: "pointer",
  transition: "all 0.15s",
});

const CHART_COLORS = [T.gold, T.blue, T.purple, T.green, T.orange, T.cyan, T.red, T.yellow];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontFamily: "var(--font-sans)", fontSize: 10, boxShadow: "0 12px 28px rgba(15,23,42,0.08)" }}>
      <div style={{ color: T.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color || T.gold }}>
          {p.name}: <strong>{typeof p.value === "number" && p.value > 10000 ? fmt$(p.value) : fmtNum(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard Panel — 8 Required KPIs ─────────────────────────────────────────
function DashboardPanel() {
  const { data: analyticsData } = useQuery<any>({ queryKey: ["/api/sales-os/analytics"] });
  const { data: kanbanData } = useQuery<any>({ queryKey: ["/api/sales-os/kanban"] });
  const { data: statsData } = useQuery<any>({ queryKey: ["/api/sales-os/pipeline/stats"] });

  const analytics = analyticsData?.data?.summary;
  const kanban: Record<string, any[]> = kanbanData?.data || {};
  const stats = statsData?.data;

  const allEntries: any[] = Object.values(kanban).flat();
  const totalPipelineAccounts = allEntries.length;
  const coveredLives = allEntries.reduce((s, e) => s + (e.participants || 0), 0);
  const estPremium = allEntries.reduce((s, e) => s + (e.welfare_premiums || 0), 0);
  const brokerCommVol = allEntries.reduce((s, e) => s + (e.broker_commissions || 0), 0);
  const estPharmacySpend = estPremium * 0.30;
  const estSavingsOpp = brokerCommVol * 0.03;
  const potentialRevenue = estPremium * 0.08;
  const avgDealSize = totalPipelineAccounts > 0 ? estPremium / totalPipelineAccounts : 0;

  const KPI = ({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }) => (
    <Card style={{ padding: "16px 18px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 12, right: 14, opacity: 0.12 }}>{icon}</div>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || T.textLight, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </Card>
  );

  return (
    <div style={{ padding: 24, fontFamily: "var(--font-sans)", overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.gold, letterSpacing: "0.06em" }}>SALES INTELLIGENCE DASHBOARD</div>
        <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>Real-time pipeline metrics · DOL Form 5500 intelligence · MODELED confidence</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        <KPI label="TOTAL PROSPECTS" value={analytics ? fmtNum(analytics.total_employers) : "—"} sub="DOL EFAST2 · 191K+ employers" color={T.textLight} icon={<Database size={32} />} />
        <KPI label="PIPELINE ACCOUNTS" value={String(totalPipelineAccounts)} sub={`${(kanban["closed_won"] || []).length} won · ${(kanban["proposal"] || []).length} proposals`} color={T.cyan} icon={<Layers size={32} />} />
        <KPI label="COVERED LIVES" value={fmtNum(coveredLives)} sub="Total participants across pipeline" color={T.blue} icon={<Users size={32} />} />
        <KPI label="EST. ANNUAL PREMIUM" value={fmt$(estPremium)} sub="Sum welfare premiums in pipeline" color={T.gold} icon={<DollarSign size={32} />} />
        <KPI label="EST. PHARMACY SPEND" value={fmt$(estPharmacySpend)} sub="~30% of annual premium · MODELED" color={T.purple} icon={<Shield size={32} />} />
        <KPI label="EST. SAVINGS OPP." value={fmt$(estSavingsOpp)} sub="3% commission reduction potential" color={T.green} icon={<TrendingUp size={32} />} />
        <KPI label="POTENTIAL REVENUE" value={fmt$(potentialRevenue)} sub="8% advisory fee on pipeline · MODELED" color={T.orange} icon={<Target size={32} />} />
        <KPI label="AVG DEAL SIZE" value={fmt$(avgDealSize)} sub="Average premium per pipeline account" color={T.textLight} icon={<BarChart3 size={32} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Card style={{ padding: "16px 18px", borderLeft: `3px solid ${T.gold}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.gold, marginBottom: 8 }}>EVIDENCE ARCHITECTURE</div>
          <div style={{ fontSize: 10, color: T.text, lineHeight: 1.6 }}>
            Every commercial employer with 100+ employees files a DOL Form 5500 under penalty of law.
            This filing discloses health spend, broker comp, and stop-loss structure — publicly accessible.
          </div>
          <div style={{ fontSize: 8, color: T.muted, marginTop: 8 }}>Zero proprietary data. Pure regulatory intelligence.</div>
        </Card>
        <Card style={{ padding: "16px 18px", borderLeft: `3px solid ${T.red}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.red, marginBottom: 8 }}>P0 ACTION PROTOCOL</div>
          <div style={{ fontSize: 10, color: T.text, lineHeight: 1.6 }}>
            Identify: 5+ year broker tenure + commission rate above 6% + no recent RFP.
            This is the trifecta of defensible displacement territory.
          </div>
          <div style={{ fontSize: 8, color: T.muted, marginTop: 8 }}>Cold call is dead. Evidence briefing is the motion.</div>
        </Card>
        <Card style={{ padding: "16px 18px", borderLeft: `3px solid ${T.blue}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.blue, marginBottom: 8 }}>AI OPPORTUNITY SCORE</div>
          <div style={{ fontSize: 10, color: T.text, lineHeight: 1.6 }}>
            7-dimension composite: Revenue Potential, Conversion Probability, PBM Risk,
            Fiduciary Risk, Savings Opportunity, Market Timing, Strategic Fit.
          </div>
          <div style={{ fontSize: 8, color: T.muted, marginTop: 8 }}>MODELED · SiriusB iQ Ai Data Sciences Lab</div>
        </Card>
      </div>
    </div>
  );
}

// ── Target Accounts Panel (enhanced ProspectsPanel) ───────────────────────────
function TargetAccountsPanel() {
  const qc = useQueryClient();
  const [state, setState] = useState("");
  const [q, setQ] = useState("");
  const [sizeMin, setSizeMin] = useState("");
  const [sizeMax, setSizeMax] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [minScore, setMinScore] = useState("");
  const [hasStopLoss, setHasStopLoss] = useState<string>("");
  const [dataSource, setDataSource] = useState("dol_efast2");
  const [selected, setSelected] = useState<any>(null);
  const [addingEin, setAddingEin] = useState<string | null>(null);
  const [selectedEins, setSelectedEins] = useState<Set<string>>(new Set());

  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (q) params.set("q", q);
  if (sizeMin) params.set("size_min", sizeMin);
  if (sizeMax) params.set("size_max", sizeMax);
  if (minSpend) params.set("min_spend", minSpend);
  if (sortBy) params.set("sort_by", sortBy);
  if (minScore) params.set("min_score", minScore);
  if (hasStopLoss !== "") params.set("has_stop_loss", hasStopLoss);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/sales-os/prospects", state, q, sizeMin, sizeMax, minSpend, sortBy, minScore, hasStopLoss],
    queryFn: async () => {
      const res = await fetch(`/api/sales-os/prospects?${params.toString()}&limit=100`, { credentials: "include" });
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async (prospect: any) => {
      const res = await fetch("/api/sales-os/kanban", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employer_ein: prospect.ein,
          employer_name: prospect.employer_name,
          state: prospect.state,
          city: prospect.city,
          industry: prospect.business_code,
          participants: prospect.max_participants,
          welfare_premiums: prospect.total_welfare_premiums,
          broker_commissions: prospect.total_broker_commissions,
          opportunity_score: prospect.opportunity_score,
          opportunity_tier: prospect.opportunity_tier,
          stage: "target",
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-os/kanban"] });
      setAddingEin(null);
    },
  });

  const addBatchMutation = useMutation({
    mutationFn: async (prospects: any[]) => {
      for (const p of prospects) {
        await fetch("/api/sales-os/kanban", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employer_ein: p.ein, employer_name: p.employer_name,
            state: p.state, city: p.city, industry: p.business_code,
            participants: p.max_participants, welfare_premiums: p.total_welfare_premiums,
            broker_commissions: p.total_broker_commissions,
            opportunity_score: p.opportunity_score, opportunity_tier: p.opportunity_tier,
            stage: "target",
          }),
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sales-os/kanban"] }); setSelectedEins(new Set()); },
  });

  const prospects: any[] = data?.data || [];

  const toggleEin = (ein: string) => {
    setSelectedEins((prev) => {
      const next = new Set(prev);
      if (next.has(ein)) next.delete(ein);
      else next.add(ein);
      return next;
    });
  };

  const selectTop = (n: number) => setSelectedEins(new Set(prospects.slice(0, n).map((p) => p.ein)));
  const selectAll = () => setSelectedEins(new Set(prospects.map((p) => p.ein)));
  const clearSel = () => setSelectedEins(new Set());

  const selectedProspects = prospects.filter((p) => selectedEins.has(p.ein));

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--font-sans)" }}>
      {/* Left control panel */}
      <div style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${T.border}`, padding: "16px 14px", overflowY: "auto", background: T.surface }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: "0.15em", marginBottom: 16 }}>FILTER CONTROLS</div>

        {/* Data source radio */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.12em", marginBottom: 6 }}>DATA SOURCE</div>
          {[["dol_efast2", "DOL EFAST2 (191K)"], ["all", "All Sources"]].map(([v, l]) => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 5 }}>
              <input type="radio" name="datasource" value={v} checked={dataSource === v} onChange={() => setDataSource(v)}
                style={{ accentColor: T.gold }} />
              <span style={{ fontSize: 8, color: dataSource === v ? T.gold : T.text }}>{l}</span>
            </label>
          ))}
        </div>

        {/* 50-state dropdown */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.12em", marginBottom: 4 }}>STATE</div>
          <select value={state} onChange={(e) => setState(e.target.value)} style={selectStyle} data-testid="select-state">
            <option value="">All States</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Text filters */}
        {[
          { label: "SEARCH (NAME / EIN / CITY)", value: q, set: setQ, placeholder: "Company or EIN…", testid: "input-search" },
          { label: "MIN EMPLOYEES", value: sizeMin, set: setSizeMin, placeholder: "100", testid: "input-size-min" },
          { label: "MAX EMPLOYEES", value: sizeMax, set: setSizeMax, placeholder: "5000", testid: "input-size-max" },
          { label: "MIN SPEND ($)", value: minSpend, set: setMinSpend, placeholder: "500000", testid: "input-min-spend" },
          { label: "MIN AI SCORE", value: minScore, set: setMinScore, placeholder: "50", testid: "input-min-score" },
        ].map((f) => (
          <div key={f.label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.12em", marginBottom: 4 }}>{f.label}</div>
            <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
              data-testid={f.testid} style={inputStyle} />
          </div>
        ))}

        {/* Stop-loss filter */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.12em", marginBottom: 4 }}>HAS STOP-LOSS</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["", "ALL"], ["true", "YES"], ["false", "NO"]].map(([v, l]) => (
              <button key={l} onClick={() => setHasStopLoss(v)} style={{ ...btnStyle(hasStopLoss === v), flex: 1, fontSize: 8, padding: "5px 4px" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.12em", marginBottom: 4 }}>SORT BY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["score", "AI SCORE"], ["spend", "SPEND"], ["participants", "SIZE"], ["commissions", "COMMISSIONS"]].map(([v, l]) => (
              <button key={v} onClick={() => setSortBy(v)} style={{ ...btnStyle(sortBy === v), textAlign: "left" }}>{l}</button>
            ))}
          </div>
        </div>

        <button onClick={() => refetch()} data-testid="button-search-prospects" style={{ ...btnStyle(true), width: "100%", marginBottom: 6 }}>
          SEARCH →
        </button>
        <div style={{ fontSize: 8, color: T.muted, textAlign: "center" }}>
          {data?.total ? `${fmtNum(data.total)} total matching` : ""}
        </div>
      </div>

      {/* Prospect list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
        {/* Multi-select toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.textLight }}>{prospects.length} ACCOUNTS</span>
            {selectedEins.size > 0 && (
              <span style={{ fontSize: 8, color: T.gold, border: `1px solid ${T.gold}40`, padding: "2px 8px", borderRadius: 3 }}>
                {selectedEins.size} SELECTED
              </span>
            )}
            {isLoading && <RefreshCw size={14} style={{ color: T.muted, animation: "spin 1s linear infinite" }} />}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={selectAll} style={{ ...btnStyle(false), fontSize: 8, padding: "4px 8px" }} data-testid="button-select-all">SELECT ALL</button>
            <button onClick={() => selectTop(100)} style={{ ...btnStyle(false), fontSize: 8, padding: "4px 8px" }} data-testid="button-select-top100">TOP 100</button>
            <button onClick={() => selectTop(500)} style={{ ...btnStyle(false), fontSize: 8, padding: "4px 8px" }} data-testid="button-select-top500">TOP 500</button>
            {selectedEins.size > 0 && (
              <>
                <button onClick={clearSel} style={{ ...btnStyle(false), fontSize: 8, padding: "4px 8px" }}>CLEAR</button>
                <button
                  onClick={() => addBatchMutation.mutate(selectedProspects)}
                  disabled={addBatchMutation.isPending}
                  style={{ ...btnStyle(true), fontSize: 8, padding: "4px 10px" }}
                  data-testid="button-add-selected-pipeline"
                >
                  <Plus size={10} style={{ display: "inline", marginRight: 3 }} />
                  ADD {selectedEins.size} TO PIPELINE
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {prospects.map((p: any) => (
            <Card
              key={p.ein}
              data-testid={`prospect-card-${p.ein}`}
              style={{ padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s", borderColor: selected?.ein === p.ein ? T.gold : selectedEins.has(p.ein) ? T.blue : T.border }}
              onClick={() => setSelected(selected?.ein === p.ein ? null : p)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                {/* Checkbox */}
                <div style={{ marginRight: 10, marginTop: 2, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); toggleEin(p.ein); }}>
                  {selectedEins.has(p.ein)
                    ? <CheckSquare size={14} style={{ color: T.blue }} />
                    : <Square size={14} style={{ color: T.muted }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.textLight, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.employer_name}
                  </div>
                  <div style={{ fontSize: 8, color: T.muted, marginBottom: 6 }}>
                    {p.city && p.state ? `${p.city}, ${p.state}` : p.state || "—"} · EIN: {p.ein} · {p.business_code || "—"}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, color: T.gold }}>{fmt$(p.total_welfare_premiums)} premium</span>
                    <span style={{ fontSize: 9, color: T.orange }}>{fmt$(p.total_broker_commissions)} broker comp</span>
                    <span style={{ fontSize: 9, color: T.muted }}>{fmtNum(p.max_participants)} lives</span>
                    {p.commission_rate > 0 && (
                      <span style={{ fontSize: 9, color: p.commission_rate > 6 ? T.red : T.muted }}>{fmtPct(p.commission_rate)} rate</span>
                    )}
                    {p.has_stop_loss && (
                      <span style={{ fontSize: 8, color: T.green, border: `1px solid ${T.green}40`, padding: "1px 5px", borderRadius: 3 }}>STOP-LOSS</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 12 }}>
                  <ScoreBadge score={p.opportunity_score || 0} tier={p.opportunity_tier} />
                  <button
                    data-testid={`btn-add-pipeline-${p.ein}`}
                    onClick={(e) => { e.stopPropagation(); setAddingEin(p.ein); addMutation.mutate(p); }}
                    disabled={addMutation.isPending && addingEin === p.ein}
                    style={{ ...btnStyle(true), fontSize: 8, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={10} />
                    {addMutation.isPending && addingEin === p.ein ? "ADDING…" : "PIPELINE"}
                  </button>
                </div>
              </div>

              {selected?.ein === p.ein && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      { label: "WELFARE PREMIUMS", value: fmt$(p.total_welfare_premiums) },
                      { label: "BROKER COMMISSIONS", value: fmt$(p.total_broker_commissions) },
                      { label: "ADMIN FEES", value: fmt$(p.total_admin_fees) },
                      { label: "TOTAL INCOME", value: fmt$(p.total_income) },
                      { label: "PARTICIPANTS", value: fmtNum(p.max_participants) },
                      { label: "LATEST YEAR", value: p.latest_year || "—" },
                      { label: "FILING COUNT", value: p.filing_count || "—" },
                      { label: "HAS HEALTH PLAN", value: p.has_health ? "YES" : "NO" },
                      { label: "HAS STOP-LOSS", value: p.has_stop_loss ? "YES" : "NO" },
                    ].map((kv) => (
                      <div key={kv.label}>
                        <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.1em" }}>{kv.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.textLight }}>{kv.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 8, color: T.muted, marginTop: 10 }}>Plan: {p.latest_plan_name || "—"}</div>
                  {/* Sub-scores */}
                  {p.sub_scores && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                      {Object.entries(p.sub_scores).map(([key, val]: [string, any]) => {
                        const pct = (val.score / val.max) * 100;
                        return (
                          <div key={key}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: T.muted, marginBottom: 2 }}>
                              <span>{key.replace(/_/g, " ").toUpperCase()}</span>
                              <span>{val.score}/{val.max}</span>
                            </div>
                            <div style={{ height: 3, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 70 ? T.green : pct >= 40 ? T.gold : T.orange, borderRadius: 2 }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
          {prospects.length === 0 && !isLoading && (
            <div style={{ color: T.muted, fontSize: 11, textAlign: "center", padding: 40 }}>
              No accounts match filters. Adjust controls and search again.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Pipeline ───────────────────────────────────────────────────────────
const KANBAN_STAGES = [
  { id: "target",       label: "TARGET",      color: T.muted   },
  { id: "research",     label: "RESEARCH",    color: T.cyan    },
  { id: "outreach",     label: "OUTREACH",    color: T.blue    },
  { id: "discovery",    label: "DISCOVERY",   color: T.purple  },
  { id: "proposal",     label: "PROPOSAL",    color: T.gold    },
  { id: "negotiation",  label: "NEGOTIATION", color: T.orange  },
  { id: "closed_won",   label: "CLOSED WON",  color: T.green   },
  { id: "closed_lost",  label: "CLOSED LOST", color: T.red     },
];

function KanbanPipeline() {
  const qc = useQueryClient();
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-os/kanban"],
    queryFn: async () => {
      const res = await fetch("/api/sales-os/kanban", { credentials: "include" });
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, stage, notes }: { id: number; stage?: string; notes?: string }) => {
      const res = await fetch(`/api/sales-os/kanban/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, notes }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sales-os/kanban"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sales-os/kanban/${id}`, { method: "DELETE", credentials: "include" });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sales-os/kanban"] }),
  });

  const grouped: Record<string, any[]> = data?.data || {};

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const entryId = parseInt(result.draggableId.replace("entry-", ""), 10);
    updateMutation.mutate({ id: entryId, stage: result.destination.droppableId });
  };

  const totalInPipeline = Object.values(grouped).reduce((acc: number, v: any) => acc + (v?.length || 0), 0);

  return (
    <div style={{ padding: "16px 18px", fontFamily: "var(--font-sans)", height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>PIPELINE — 8-STAGE KANBAN</div>
          <div style={{ fontSize: 9, color: T.muted }}>Drag cards between stages · {totalInPipeline} accounts · Add from Target Accounts</div>
        </div>
        {isLoading && <RefreshCw size={14} style={{ color: T.muted }} />}
      </div>

      {totalInPipeline === 0 && (
        <Card style={{ padding: "40px 20px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Pipeline is empty</div>
          <div style={{ fontSize: 10, color: `${T.muted}80` }}>Go to Target Accounts, score employers, and click + PIPELINE to add accounts here.</div>
        </Card>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, minHeight: 400 }}>
          {KANBAN_STAGES.map((stage) => {
            const cards: any[] = grouped[stage.id] || [];
            const stageTotal = cards.reduce((s: number, c: any) => s + (c.welfare_premiums || 0), 0);
            return (
              <div key={stage.id} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "8px 10px", background: `${stage.color}15`, border: `1px solid ${stage.color}30`, borderRadius: "6px 6px 0 0", marginBottom: 4 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: stage.color, letterSpacing: "0.12em" }}>{stage.label}</div>
                  <div style={{ fontSize: 8, color: T.muted }}>{cards.length} · {fmt$(stageTotal)}</div>
                </div>
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        flex: 1, minHeight: 120, padding: "6px 4px",
                        background: snapshot.isDraggingOver ? `${stage.color}08` : T.surface,
                        border: `1px solid ${snapshot.isDraggingOver ? stage.color : T.border}`,
                        borderTop: "none", borderRadius: "0 0 6px 6px", transition: "all 0.15s",
                      }}
                    >
                      {cards.map((card: any, index: number) => (
                        <Draggable key={card.id} draggableId={`entry-${card.id}`} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              data-testid={`kanban-card-${card.id}`}
                              style={{
                                ...prov.draggableProps.style,
                                background: snap.isDragging ? T.surface2 : T.bg,
                                border: `1px solid ${snap.isDragging ? T.gold : T.border}`,
                                borderRadius: 5, padding: "8px 9px", marginBottom: 6, cursor: "grab",
                              }}
                            >
                              <div style={{ fontSize: 9, fontWeight: 700, color: T.textLight, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {card.employer_name}
                              </div>
                              <div style={{ fontSize: 7, color: T.muted, marginBottom: 4 }}>
                                {card.state} · {fmtNum(card.participants)} lives
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <span style={{ fontSize: 8, color: T.gold }}>{fmt$(card.welfare_premiums)}</span>
                                <ScoreBadge score={card.opportunity_score || 0} tier={card.opportunity_tier} />
                              </div>
                              <textarea
                                value={notesDraft[card.id] ?? card.notes ?? ""}
                                onChange={(e) => setNotesDraft((prev) => ({ ...prev, [card.id]: e.target.value }))}
                                onBlur={() => {
                                  const draft = notesDraft[card.id];
                                  if (draft !== undefined && draft !== card.notes) updateMutation.mutate({ id: card.id, notes: draft });
                                }}
                                placeholder="Notes…"
                                onClick={(e) => e.stopPropagation()}
                                rows={2}
                                style={{ ...inputStyle, fontSize: 8, resize: "none", marginBottom: 4 }}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(card.id); }}
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: T.muted, padding: 0, display: "flex", alignItems: "center", gap: 3, fontSize: 7 }}
                              >
                                <Trash2 size={10} /> REMOVE
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────
function AnalyticsPanel() {
  const [filterState, setFilterState] = useState("");
  const params = filterState ? `?state=${filterState}` : "";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-os/analytics", filterState],
    queryFn: async () => {
      const res = await fetch(`/api/sales-os/analytics${params}`, { credentials: "include" });
      return res.json();
    },
  });

  const analytics = data?.data;

  return (
    <div style={{ padding: "16px 18px", fontFamily: "var(--font-sans)", overflowY: "auto", height: "100%" }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>MARKET ANALYTICS</div>
          <div style={{ fontSize: 9, color: T.muted }}>DOL Form 5500 · 191K employer universe · MODELED</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={{ ...selectStyle, width: 140 }}>
            <option value="">All States</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {isLoading && <RefreshCw size={14} style={{ color: T.muted }} />}
        </div>
      </div>

      {analytics?.summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "TOTAL EMPLOYERS", value: fmtNum(analytics.summary.total_employers) },
            { label: "TOTAL SPEND", value: fmt$(analytics.summary.total_spend) },
            { label: "TOTAL COMMISSIONS", value: fmt$(analytics.summary.total_commissions) },
            { label: "AVG SPEND", value: fmt$(analytics.summary.avg_spend) },
            { label: "WITH STOP-LOSS", value: fmtNum(analytics.summary.with_stop_loss) },
          ].map((kv) => (
            <Card key={kv.label} style={{ padding: "10px 12px" }}>
              <SectionLabel>{kv.label}</SectionLabel>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{kv.value}</div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: "14px 16px" }}>
          <SectionLabel>TOP STATES BY EMPLOYER COUNT</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(analytics?.states || []).slice(0, 12)} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="state" tick={{ fontSize: 8, fill: T.muted }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fontSize: 8, fill: T.muted }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={T.gold} name="Employers" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: "14px 16px" }}>
          <SectionLabel>EMPLOYERS BY SPEND TIER</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={analytics?.spend_tiers || []} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={80}
                label={({ tier, percent }: any) => `${tier} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(analytics?.spend_tiers || []).map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: "14px 16px" }}>
          <SectionLabel>BROKER COMMISSION RATE DISTRIBUTION</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics?.commission_rates || []} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 8, fill: T.muted }} />
              <YAxis type="category" dataKey="tier" tick={{ fontSize: 8, fill: T.muted }} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={T.orange} name="Employers" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: "14px 16px" }}>
          <SectionLabel>TOP INDUSTRY CODES (FORM 5500)</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {(analytics?.industries || []).map((ind: any, i: number) => {
              const max = analytics?.industries?.[0]?.count || 1;
              const pct = (ind.count / max) * 100;
              return (
                <div key={ind.code}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: T.text, marginBottom: 3 }}>
                    <span>{ind.code}</span>
                    <span style={{ color: T.muted }}>{fmtNum(ind.count)}</span>
                  </div>
                  <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: "14px 16px" }}>
          <SectionLabel>PIPELINE BY STAGE (LIVE)</SectionLabel>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={(analytics?.pipeline_by_stage || []).length > 0
                ? analytics.pipeline_by_stage
                : [{ stage: "target", count: 0 }, { stage: "proposal", count: 0 }, { stage: "closed_won", count: 0 }]}
              margin={{ top: 5, right: 5, left: -20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="stage" tick={{ fontSize: 7, fill: T.muted }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fontSize: 8, fill: T.muted }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Accounts" radius={[2, 2, 0, 0]}>
                {(analytics?.pipeline_by_stage || [{ stage: "target", count: 0 }]).map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ padding: "14px 16px" }}>
          <SectionLabel>PROJECTED REVENUE (8% ADVISORY FEE)</SectionLabel>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics?.projected_revenue || []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
              <XAxis dataKey="month" tick={{ fontSize: 8, fill: T.muted }} />
              <YAxis tick={{ fontSize: 8, fill: T.muted }} tickFormatter={(v) => fmt$(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="projected" stroke={T.green} fill={`${T.green}20`} name="Projected Revenue" />
            </AreaChart>
          </ResponsiveContainer>
          {(!analytics?.projected_revenue?.length || analytics.projected_revenue[0]?.projected === 0) && (
            <div style={{ fontSize: 9, color: T.muted, textAlign: "center", marginTop: 8 }}>Move accounts to Closed Won to see revenue projection</div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── States Panel ──────────────────────────────────────────────────────────────
function StatesPanel() {
  const [selectedState, setSelectedState] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-os/analytics", selectedState],
    queryFn: async () => {
      const url = selectedState ? `/api/sales-os/analytics?state=${selectedState}` : "/api/sales-os/analytics";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const analytics = data?.data;
  const states: any[] = analytics?.states || [];

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--font-sans)" }}>
      {/* State selector sidebar */}
      <div style={{ width: 180, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.surface, overflowY: "auto" }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: "0.12em" }}>SELECT STATE</div>
        </div>
        <div
          onClick={() => setSelectedState("")}
          style={{ padding: "9px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${!selectedState ? T.gold : "transparent"}`, background: !selectedState ? `${T.gold}08` : "transparent" }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textLight }}>ALL STATES</div>
          <div style={{ fontSize: 7, color: T.muted }}>National aggregate</div>
        </div>
        {US_STATES.map((s) => (
          <div
            key={s}
            onClick={() => setSelectedState(s)}
            data-testid={`state-item-${s}`}
            style={{ padding: "8px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${selectedState === s ? T.gold : "transparent"}`, background: selectedState === s ? `${T.gold}08` : "transparent" }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: T.textLight }}>{s}</span>
          </div>
        ))}
      </div>

      {/* State detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{selectedState || "NATIONAL"} MARKET INTELLIGENCE</div>
          <div style={{ fontSize: 9, color: T.muted }}>DOL Form 5500 · Employer census · MODELED</div>
        </div>

        {isLoading && <div style={{ color: T.muted, fontSize: 11 }}>Loading…</div>}

        {analytics?.summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "EMPLOYERS", value: fmtNum(analytics.summary.total_employers), color: T.textLight },
              { label: "TOTAL SPEND", value: fmt$(analytics.summary.total_spend), color: T.gold },
              { label: "COMMISSIONS", value: fmt$(analytics.summary.total_commissions), color: T.orange },
              { label: "WITH STOP-LOSS", value: fmtNum(analytics.summary.with_stop_loss), color: T.green },
            ].map((kv) => (
              <Card key={kv.label} style={{ padding: "12px 14px" }}>
                <SectionLabel>{kv.label}</SectionLabel>
                <div style={{ fontSize: 18, fontWeight: 800, color: kv.color }}>{kv.value}</div>
              </Card>
            ))}
          </div>
        )}

        {/* Top states bar chart (national view) or state top industries */}
        {!selectedState && states.length > 0 && (
          <Card style={{ padding: "14px 16px", marginBottom: 16 }}>
            <SectionLabel>EMPLOYER COUNT BY STATE (TOP 20)</SectionLabel>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={states.slice(0, 20)} margin={{ top: 5, right: 5, left: -20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="state" tick={{ fontSize: 8, fill: T.muted }} angle={-45} textAnchor="end" />
                <YAxis tick={{ fontSize: 8, fill: T.muted }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={T.gold} name="Employers" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {!selectedState && states.length > 0 && (
          <Card style={{ padding: "14px 16px" }}>
            <SectionLabel>TOTAL SPEND BY STATE (TOP 15)</SectionLabel>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={states.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 8, fill: T.muted }} tickFormatter={(v) => fmt$(v)} />
                <YAxis type="category" dataKey="state" tick={{ fontSize: 8, fill: T.muted }} width={28} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_spend" fill={T.cyan} name="Total Spend" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {selectedState && analytics?.summary && (
          <Card style={{ padding: "14px 16px" }}>
            <SectionLabel>{selectedState} MARKET SUMMARY</SectionLabel>
            <div style={{ fontSize: 10, color: T.text, lineHeight: 1.8 }}>
              <div>Employers in database: <strong style={{ color: T.gold }}>{fmtNum(analytics.summary.total_employers)}</strong></div>
              <div>Total welfare premiums: <strong style={{ color: T.gold }}>{fmt$(analytics.summary.total_spend)}</strong></div>
              <div>Total broker commissions: <strong style={{ color: T.orange }}>{fmt$(analytics.summary.total_commissions)}</strong></div>
              <div>Average spend per employer: <strong style={{ color: T.cyan }}>{fmt$(analytics.summary.avg_spend)}</strong></div>
              <div>Plans with stop-loss: <strong style={{ color: T.green }}>{fmtNum(analytics.summary.with_stop_loss)}</strong></div>
            </div>
            <div style={{ fontSize: 8, color: T.muted, marginTop: 10 }}>MODELED · DOL EFAST2 · Form 5500</div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── AI Copilot (Floating Drawer) ──────────────────────────────────────────────
const COPILOT_MODES = [
  { id: "outreach",  label: "OUTREACH EMAIL",   prompt: "Draft an evidence-anchored outreach email for this employer based on their DOL Form 5500 data." },
  { id: "summary",   label: "EXEC SUMMARY",     prompt: "Write a concise executive summary of this employer's benefits situation and our value proposition." },
  { id: "plan",      label: "ACCOUNT PLAN",     prompt: "Build a 90-day account plan for winning this employer, including discovery questions, proposal strategy, and stakeholder map." },
  { id: "meeting",   label: "MEETING BRIEF",    prompt: "Generate a pre-meeting brief covering key talking points, known objections, and an opening angle for this account." },
  { id: "renewal",   label: "RENEWAL STRATEGY", prompt: "Develop a renewal strategy for retaining or expanding this account, including benchmark positioning and talking points." },
];

function CopilotPanel({ onClose }: { onClose?: () => void }) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string; ts: string }>>([
    { role: "ai", text: "Sales Intelligence Copilot online. I can analyze employers, craft evidence-anchored outreach, interpret DOL Form 5500 data, and identify fiduciary arbitrage opportunities. What account are you working?", ts: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("outreach");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async (overrideMsg?: string) => {
    const userMsg = (overrideMsg || input).trim();
    if (!userMsg || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg, ts: new Date().toISOString() }]);
    setLoading(true);
    try {
      const res = await fetch("/api/sales-os/copilot", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, mode }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", text: data.response || "No response.", ts: data.generated_at || new Date().toISOString() }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "Copilot temporarily unavailable.", ts: new Date().toISOString() }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const PROMPTS = [
    "What is the typical broker commission structure for a 500-life self-funded employer?",
    "Generate a 30-word evidence-anchored cold email opener for a fully-insured employer at 400 lives.",
    "What are the three biggest GLP-1 arbitrage opportunities for a stop-loss carrier in 2026?",
    "Explain ERISA fiduciary liability exposure for an employer with a 7% broker commission rate.",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--font-sans)" }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.gold }}>AI SALES COPILOT</div>
            <div style={{ fontSize: 8, color: T.muted }}>Evidence-anchored · MODELED · Senior McKinsey + Stanford Actuary</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 8, color: T.green, border: `1px solid ${T.green}40`, padding: "2px 7px", borderRadius: 3 }}>● ONLINE</span>
            {onClose && (
              <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.muted, padding: 2 }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        {/* Mode selector */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.12em", marginBottom: 5 }}>MODE</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {COPILOT_MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{ ...btnStyle(mode === m.id), fontSize: 8, padding: "4px 10px" }} data-testid={`copilot-mode-${m.id}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => send(COPILOT_MODES.find((m) => m.id === mode)?.prompt)} style={{ ...btnStyle(true), fontSize: 8, marginBottom: 8, width: "100%" }} data-testid="button-copilot-mode-send">
          GENERATE {COPILOT_MODES.find((m) => m.id === mode)?.label} →
        </button>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {PROMPTS.map((p, i) => (
            <button key={i} onClick={() => setInput(p)} style={{ ...btnStyle(false), fontSize: 8, whiteSpace: "nowrap", flexShrink: 0 }}>
              {p.slice(0, 40)}…
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ maxWidth: "85%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start", background: msg.role === "user" ? `${T.gold}18` : T.surface2, border: `1px solid ${msg.role === "user" ? T.gold + "40" : T.border}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 7, color: T.muted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {msg.role === "user" ? "YOU" : "KIQ COPILOT"} · {msg.ts.slice(11, 16)}
            </div>
            <div style={{ fontSize: 10, color: T.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, color: T.muted }}>Analyzing… ▌</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 18px", borderTop: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about an employer, commission structure, ERISA exposure…"
            data-testid="input-copilot"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} data-testid="button-copilot-send" style={{ ...btnStyle(true), padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <Send size={12} /> SEND
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel() {
  const [activeSection, setActiveSection] = useState("apis");
  const APIS = [
    { id: "dol_efast2", name: "DOL EFAST2", label: "Form 5500 Database", color: T.green, description: "Annual health benefit plan filings under ERISA. Health spend, broker comp, carrier contracts, stop-loss structure.", fields: ["health_spend", "broker_comp", "carrier", "stop_loss", "participants", "plan_year"], coverage: "All U.S. employers with 100+ employees filing Form 5500 annually.", record_count: "~800,000 filings/year" },
    { id: "sec_edgar", name: "SEC EDGAR", label: "Public Company 10-K", color: T.blue, description: "Annual 10-K compensation disclosures for public companies.", fields: ["benefits_cost", "headcount", "health_plan_type"], coverage: "All SEC-registered public companies.", record_count: "~10,000 filings/year" },
    { id: "cms_open", name: "CMS Open Data", label: "Medicare & Provider Intel", color: T.purple, description: "Medicare Advantage contracts, NPI provider lookup, facility cost data.", fields: ["npi", "provider_type", "facility_cost"], coverage: "All Medicare-enrolled providers.", record_count: "~5M NPI records" },
    { id: "irs_990", name: "IRS 990 Explorer", label: "Nonprofit & Health System Data", color: T.purple, description: "ProPublica 990 data for nonprofits and health systems.", fields: ["total_revenue", "employee_benefits", "employee_count"], coverage: "All IRS-registered 501(c) organizations.", record_count: "~350,000 organizations" },
    { id: "sam_gov", name: "SAM.gov", label: "Federal Contractor Registry", color: T.orange, description: "Entity registration, NAICS codes, employee counts, annual revenue for federal contractors.", fields: ["uei", "naics_code", "employee_count", "annual_revenue"], coverage: "All active federal contractor registrations.", record_count: "~750,000 entities" },
    { id: "bls_qcew", name: "BLS QCEW", label: "Wage & Employment Benchmarks", color: T.cyan, description: "Quarterly Census of Employment and Wages.", fields: ["avg_weekly_wage", "employment_level", "naics"], coverage: "All U.S. private and government establishments.", record_count: "~10M data series" },
  ];

  const { data: statusData, isLoading: statusLoading } = useQuery<any>({ queryKey: ["/api/sales-os/ingest/status"], refetchInterval: 60000 });
  const statuses: any[] = statusData?.data || [];
  const getStatus = (id: string) => statuses.find((s: any) => s.id === id);

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--font-sans)" }}>
      {/* Settings nav */}
      <div style={{ width: 160, flexShrink: 0, borderRight: `1px solid ${T.border}`, background: T.surface }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: T.gold, letterSpacing: "0.12em" }}>SETTINGS</div>
        </div>
        {[["apis", "FEDERAL APIs"], ["ingest", "INGEST LOG"], ["benchmark", "BENCHMARK"]].map(([id, label]) => (
          <div key={id} onClick={() => setActiveSection(id)}
            style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${activeSection === id ? T.gold : "transparent"}`, background: activeSection === id ? `${T.gold}08` : "transparent" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: activeSection === id ? T.gold : T.text }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {activeSection === "apis" && (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.gold, marginBottom: 4 }}>FEDERAL API REGISTRY</div>
            <div style={{ fontSize: 9, color: T.muted, marginBottom: 20 }}>Six federal data sources · Zero proprietary vendors · Pure public regulatory intelligence</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {APIS.map((api) => {
                const live = getStatus(api.id);
                const sc = live?.status === "live" ? T.green : live?.status === "no_key" ? T.gold : live?.status === "unreachable" ? T.red : T.muted;
                const sl = live?.status?.toUpperCase().replace("_", " ") || "CHECKING";
                return (
                  <Card key={api.id} style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: api.color, boxShadow: `0 0 8px ${api.color}99`, display: "inline-block" }} />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 12, color: T.textLight }}>{api.name}</div>
                          <div style={{ fontSize: 8, color: T.muted }}>{api.label}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 7, fontWeight: 700, color: sc, border: `1px solid ${sc}`, padding: "2px 6px", borderRadius: 3 }}>
                        {statusLoading ? "CHECKING…" : sl}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: T.text, lineHeight: 1.6, marginBottom: 8 }}>{api.description}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {api.fields.map((f) => (
                        <span key={f} style={{ fontSize: 7, color: api.color, border: `1px solid ${api.color}40`, padding: "1px 6px", borderRadius: 3 }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 7, color: `${T.muted}80`, marginTop: 8 }}>{api.coverage} · {api.record_count}</div>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {activeSection === "ingest" && <IngestLogView />}
        {activeSection === "benchmark" && <BenchmarkView />}
      </div>
    </div>
  );
}

// ── Re-export backward-compat sub-views (used by SaasBroker.tsx) ───────────────

const SBI_CONFIG: Record<string, { color: string; label: string }> = {
  RED: { color: T.red, label: "RED — P0 HOT" },
  ORANGE: { color: T.orange, label: "ORANGE — WARM" },
  YELLOW: { color: T.yellow, label: "YELLOW — WATCH" },
  GREEN: { color: T.green, label: "GREEN — COLD" },
};
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  hot: { color: T.red, label: "HOT" },
  warm: { color: T.orange, label: "WARM" },
  watch: { color: T.yellow, label: "WATCH" },
  cold: { color: T.muted, label: "COLD" },
};

export function AccountBriefView() {
  const [selectedId, setSelectedId] = useState("ind-001");
  const [showOpener, setShowOpener] = useState(false);

  const { data: accountsData } = useQuery<any>({ queryKey: ["/api/sales-os/accounts"] });
  const accounts: any[] = accountsData?.data || [];

  const { data: briefData, isLoading: briefLoading } = useQuery({
    queryKey: ["/api/sales-os/accounts", selectedId, "brief"],
    queryFn: async () => {
      const res = await fetch(`/api/sales-os/accounts/${selectedId}/brief`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedId,
  });

  const { data: openerData, isLoading: openerLoading } = useQuery({
    queryKey: ["/api/sales-os/accounts", selectedId, "opener"],
    queryFn: async () => {
      const res = await fetch(`/api/sales-os/accounts/${selectedId}/opener`, { credentials: "include" });
      return res.json();
    },
    enabled: showOpener && !!selectedId,
  });

  const brief = briefData?.data;
  const acct = brief?.account;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: "var(--font-sans)" }}>
      <div style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${T.border}`, overflowY: "auto", background: T.surface }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}><SectionLabel>SELECT ACCOUNT</SectionLabel></div>
        {accounts.map((a: any) => {
          const sbi = SBI_CONFIG[a.sbi_tier] || SBI_CONFIG.GREEN;
          return (
            <div key={a.id} onClick={() => { setSelectedId(a.id); setShowOpener(false); }} data-testid={`account-item-${a.id}`}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${selectedId === a.id ? T.gold : "transparent"}`, background: selectedId === a.id ? `${T.gold}08` : "transparent" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.textLight, marginBottom: 2 }}>{a.name}</div>
              <div style={{ fontSize: 8, color: T.muted, marginBottom: 4 }}>{a.city}, {a.state}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 8, color: sbi.color, fontWeight: 700 }}>SBI™ {a.sbi_score}</span>
                <span style={{ fontSize: 7, color: a.status === "hot" ? T.red : T.muted, fontWeight: 700 }}>● {a.status?.toUpperCase()}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {briefLoading && <div style={{ color: T.muted, fontSize: 11 }}>Loading brief…</div>}
        {acct && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.textLight }}>{acct.name}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{acct.city}, {acct.state} · {acct.industry} · {acct.employees?.toLocaleString()} employees</div>
                <div style={{ fontSize: 8, color: T.muted, marginTop: 2 }}>EIN: {acct.ein} · {acct.funding_type} · Carrier: {acct.carrier}</div>
              </div>
              <TierBadge tier={brief.overall_confidence || "MODELED"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "HEALTH SPEND / YR", value: fmt$(acct.health_spend_annual), color: T.gold },
                { label: "BROKER COMP", value: `${fmt$(acct.broker_comp_annual)} (${(acct.broker_comp_pct_premium * 100).toFixed(1)}%)`, color: T.orange },
                { label: "SBI™ SCORE", value: `${acct.sbi_score} ${acct.sbi_tier}`, color: SBI_CONFIG[acct.sbi_tier]?.color || T.gold },
                { label: "RECOVERABLE", value: `${fmt$(acct.recoverable_low)}–${fmt$(acct.recoverable_high)}`, color: T.green },
                { label: "GLP-1 EXPOSURE", value: acct.glp1_exposure, color: acct.glp1_exposure === "HIGH" ? T.red : T.orange },
                { label: "ERISA RISK", value: acct.erisa_risk, color: acct.erisa_risk === "RED" ? T.red : T.yellow },
                { label: "LAST RFP", value: acct.last_rfp_year || "—", color: acct.last_rfp_year < 2021 ? T.red : T.muted },
                { label: "PBM", value: acct.pbm || "—", color: T.text },
              ].map((kv) => (
                <Card key={kv.label} style={{ padding: "10px 12px" }}>
                  <SectionLabel>{kv.label}</SectionLabel>
                  <div style={{ fontSize: 13, fontWeight: 800, color: kv.color }}>{kv.value}</div>
                </Card>
              ))}
            </div>
            <Card style={{ padding: "14px 16px", marginBottom: 12, borderLeft: `3px solid ${T.gold}` }}>
              <SectionLabel>STRATEGIC INSIGHT</SectionLabel>
              <div style={{ fontSize: 10, color: T.text, lineHeight: 1.7 }}>{acct.insight}</div>
            </Card>
            <Card style={{ padding: "14px 16px", marginBottom: 12, borderLeft: `3px solid ${T.red}` }}>
              <SectionLabel>P0 ACTION</SectionLabel>
              <div style={{ fontSize: 10, color: T.textLight, lineHeight: 1.6 }}>{acct.p0_action}</div>
            </Card>
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowOpener(true)} style={{ ...btnStyle(true), marginBottom: 8 }} data-testid="button-generate-opener">
                {openerLoading ? "GENERATING…" : showOpener ? "REGENERATE CALL OPENER" : "GENERATE AI CALL OPENER →"}
              </button>
              {showOpener && openerData && (
                <Card style={{ padding: "12px 14px", borderLeft: `3px solid ${T.blue}` }}>
                  <SectionLabel>AI-GENERATED CALL OPENER</SectionLabel>
                  <div style={{ fontSize: 11, color: T.textLight, lineHeight: 1.7, fontStyle: "italic" }}>{openerData.opener}</div>
                  <div style={{ fontSize: 7, color: T.muted, marginTop: 8 }}>{openerData.label}</div>
                </Card>
              )}
            </div>
            {acct.evidence_refs?.length > 0 && (
              <Card style={{ padding: "12px 14px" }}>
                <SectionLabel>EVIDENCE CHAIN</SectionLabel>
                {acct.evidence_refs.map((ref: any, i: number) => (
                  <div key={i} style={{ background: T.surface2, borderRadius: 5, padding: "8px 10px", marginBottom: 5, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.gold }}>{ref.source_api}</span>
                      <span style={{ fontSize: 9, color: T.muted }}>{ref.filing_type}</span>
                      {ref.schedule && <span style={{ fontSize: 9, color: T.muted }}>Sch {ref.schedule}</span>}
                      {ref.plan_year && <span style={{ fontSize: 9, color: T.muted }}>{ref.plan_year}</span>}
                      <TierBadge tier={ref.confidence || "MODELED"} />
                    </div>
                    <div style={{ fontSize: 8, color: T.muted, fontFamily: "monospace" }}>SHA-256: {ref.input_hash}</div>
                  </div>
                ))}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function PipelineView() {
  const { data: statsData } = useQuery<any>({ queryKey: ["/api/sales-os/pipeline/stats"] });
  const { data: pipelineData, isLoading } = useQuery<any>({ queryKey: ["/api/sales-os/pipeline"] });
  const stats = statsData?.data;
  const pipeline: any[] = pipelineData?.data || [];
  return (
    <div style={{ padding: 24, fontFamily: "var(--font-sans)" }}>
      <h2 style={{ color: T.gold, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>SEED ACCOUNT PIPELINE</h2>
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 16 }}>Pre-seeded accounts · SBI™ scored · Sorted by recoverable capital</div>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <Card style={{ padding: "12px 14px" }}><SectionLabel>ACCOUNTS</SectionLabel><div style={{ fontSize: 22, fontWeight: 800, color: T.textLight }}>{stats.total_accounts}</div></Card>
          <Card style={{ padding: "12px 14px" }}><SectionLabel>HOT P0</SectionLabel><div style={{ fontSize: 22, fontWeight: 800, color: T.red }}>{stats.hot_p0}</div></Card>
          <Card style={{ padding: "12px 14px" }}><SectionLabel>RECOVERABLE</SectionLabel><div style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>{fmt$(stats.total_recoverable_low)}–{fmt$(stats.total_recoverable_high)}</div></Card>
        </div>
      )}
      <Card>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["COMPANY", "INDUSTRY", "STATUS", "HEALTH SPEND", "RECOVERABLE", "SBI™", "LAST RFP"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: T.muted, fontWeight: 700, fontSize: 8, letterSpacing: "0.1em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 20, color: T.muted, textAlign: "center" }}>Loading…</td></tr>
              ) : pipeline.map((a: any, i: number) => {
                const sbi = SBI_CONFIG[a.sbi_tier] || SBI_CONFIG.GREEN;
                const st = STATUS_CONFIG[a.status] || STATUS_CONFIG.cold;
                return (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${T.border}`, background: i % 2 === 0 ? "transparent" : T.surface2 }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: 700, color: T.textLight }}>{a.name}</div>
                      <div style={{ fontSize: 8, color: T.muted }}>{a.city}, {a.state} · {a.employees?.toLocaleString()}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: T.muted, fontSize: 9 }}>{a.industry}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ color: st.color, fontWeight: 700, fontSize: 9 }}>● {st.label}</span></td>
                    <td style={{ padding: "10px 12px", color: T.gold, fontWeight: 700 }}>{fmt$(a.health_spend_annual)}</td>
                    <td style={{ padding: "10px 12px", color: T.goldLight, fontWeight: 700 }}>{fmt$(a.recoverable_low)}–{fmt$(a.recoverable_high)}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ color: sbi.color, fontWeight: 800 }}>{a.sbi_score}</span><span style={{ fontSize: 8, color: T.muted, marginLeft: 4 }}>{a.sbi_tier}</span></td>
                    <td style={{ padding: "10px 12px", color: a.last_rfp_year < 2021 ? T.red : T.muted }}>{a.last_rfp_year || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ApiRegistryView() {
  const { data: statusData, isLoading } = useQuery<any>({ queryKey: ["/api/sales-os/ingest/status"], refetchInterval: 60000 });
  const statuses: any[] = statusData?.data || [];
  const APIS = [
    { id: "dol_efast2", name: "DOL EFAST2", label: "Form 5500 Database", color: T.green, description: "Annual health benefit plan filings under ERISA.", fields: ["health_spend", "broker_comp", "carrier", "stop_loss", "participants", "plan_year"], endpoint: "https://efts.dol.gov/LATEST/search-index", coverage: "All U.S. employers with 100+ employees filing Form 5500 annually.", record_count: "~800,000 filings/year" },
    { id: "sec_edgar", name: "SEC EDGAR", label: "Public Company 10-K", color: T.blue, description: "Annual 10-K compensation disclosures for public companies.", fields: ["benefits_cost", "headcount", "health_plan_type"], endpoint: "https://efts.sec.gov/LATEST/search-index", coverage: "All SEC-registered public companies.", record_count: "~10,000 filings/year" },
    { id: "cms_open", name: "CMS Open Data", label: "Medicare & Provider Intel", color: T.purple, description: "Medicare Advantage contracts, NPI provider lookup, facility cost data.", fields: ["npi", "provider_type", "facility_cost"], endpoint: "https://data.cms.gov/api/1/datastore/sql", coverage: "All Medicare-enrolled providers.", record_count: "~5M NPI records" },
    { id: "irs_990", name: "IRS 990 Explorer", label: "Nonprofit & Health System Data", color: T.purple, description: "ProPublica 990 data for nonprofits and health systems.", fields: ["total_revenue", "employee_benefits", "employee_count"], endpoint: "https://projects.propublica.org/nonprofits/api/v2", coverage: "All IRS-registered 501(c) organizations.", record_count: "~350,000 organizations" },
    { id: "sam_gov", name: "SAM.gov", label: "Federal Contractor Registry", color: T.orange, description: "Entity registration, NAICS codes, employee counts for federal contractors.", fields: ["uei", "naics_code", "employee_count", "annual_revenue"], endpoint: "https://api.sam.gov/entity-information/v3/entities", coverage: "All active federal contractor registrations.", record_count: "~750,000 entities" },
    { id: "bls_qcew", name: "BLS QCEW", label: "Wage & Employment Benchmarks", color: T.cyan, description: "Quarterly Census of Employment and Wages.", fields: ["avg_weekly_wage", "employment_level", "naics"], endpoint: "https://api.bls.gov/publicAPI/v2/timeseries/data/", coverage: "All U.S. private and government establishments.", record_count: "~10M data series" },
  ];
  const getStatus = (id: string) => statuses.find((s: any) => s.id === id);
  return (
    <div style={{ padding: 24, fontFamily: "var(--font-sans)", maxWidth: 860 }}>
      <h2 style={{ color: T.gold, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>FEDERAL API REGISTRY</h2>
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 20 }}>Six federal data sources · Zero proprietary vendors · Pure public regulatory intelligence</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {APIS.map((api) => {
          const live = getStatus(api.id);
          const sc = live?.status === "live" ? T.green : live?.status === "no_key" ? T.gold : live?.status === "unreachable" ? T.red : T.muted;
          const sl = live?.status?.toUpperCase().replace("_", " ") || "CHECKING";
          return (
            <Card key={api.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: api.color, boxShadow: `0 0 8px ${api.color}99`, display: "inline-block" }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 12, color: T.textLight }}>{api.name}</div>
                    <div style={{ fontSize: 8, color: T.muted }}>{api.label}</div>
                  </div>
                </div>
                <span style={{ fontSize: 7, fontWeight: 700, color: sc, border: `1px solid ${sc}`, padding: "2px 6px", borderRadius: 3 }}>
                  {isLoading ? "CHECKING…" : sl}
                </span>
              </div>
              <div style={{ fontSize: 9, color: T.text, lineHeight: 1.6, marginBottom: 8 }}>{api.description}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {api.fields.map((f) => (
                  <span key={f} style={{ fontSize: 7, color: api.color, border: `1px solid ${api.color}40`, padding: "1px 6px", borderRadius: 3 }}>{f}</span>
                ))}
              </div>
              <div style={{ fontSize: 7, color: `${T.muted}80`, marginTop: 8 }}>{api.coverage} · {api.record_count}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function BenchmarkView() {
  const [state, setState] = useState("");
  const [sizeMin, setSizeMin] = useState("");
  const [sizeMax, setSizeMax] = useState("");
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (sizeMin) params.set("size_min", sizeMin);
  if (sizeMax) params.set("size_max", sizeMax);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/sales-os/benchmark/cohort", state, sizeMin, sizeMax],
    queryFn: async () => {
      const res = await fetch(`/api/sales-os/benchmark/cohort?${params.toString()}`, { credentials: "include" });
      return res.json();
    },
  });
  const cohort = data?.data;
  const PercentileBar = ({ label, stats, fmt: f }: { label: string; stats: any; fmt: (v: number) => string }) => (
    <Card style={{ padding: "12px 14px" }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
        {["p25", "median", "p75", "mean"].map((k) => (
          <div key={k}>
            <div style={{ fontSize: 7, color: T.muted }}>{k === "median" ? "P50" : k === "mean" ? "MEAN" : k.toUpperCase()}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: k === "median" ? T.gold : T.text }}>{f(stats[k])}</div>
          </div>
        ))}
      </div>
    </Card>
  );
  return (
    <div style={{ padding: 24, fontFamily: "var(--font-sans)", maxWidth: 860 }}>
      <h2 style={{ color: T.gold, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>BENCHMARK ENGINE</h2>
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 16 }}>Peer cohort statistics · k-anonymity enforced (minimum k=11) · MODELED</div>
      <Card style={{ padding: "14px 16px", marginBottom: 16 }}>
        <SectionLabel>COHORT SELECTOR</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
          {[{ label: "STATE", value: state, set: setState, ph: "e.g. IN" }, { label: "MIN EMPLOYEES", value: sizeMin, set: setSizeMin, ph: "100" }, { label: "MAX EMPLOYEES", value: sizeMax, set: setSizeMax, ph: "1000" }].map((f) => (
            <div key={f.label}>
              <div style={{ fontSize: 7, color: T.muted, marginBottom: 4 }}>{f.label}</div>
              <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} style={inputStyle} />
            </div>
          ))}
        </div>
        <button onClick={() => refetch()} style={btnStyle(true)} data-testid="button-run-benchmark">RUN BENCHMARK →</button>
      </Card>
      {isLoading && <div style={{ color: T.muted, fontSize: 10 }}>Computing cohort…</div>}
      {data?.confidence === "INSUFFICIENT_EVIDENCE" && (
        <div style={{ padding: "12px 14px", background: `${T.red}0a`, border: `1px solid ${T.red}30`, borderRadius: 6, color: T.red, fontSize: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>INSUFFICIENT EVIDENCE</div>{data.reason}
        </div>
      )}
      {cohort && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 9, color: T.muted }}>Cohort: <span style={{ color: T.gold }}>{cohort.cohort_size}</span> accounts · k-anon: {cohort.k_anon_satisfied ? "✓" : "✗"}</div>
          <PercentileBar label="HEALTH SPEND / YEAR" stats={cohort.health_spend_annual} fmt={fmt$} />
          <PercentileBar label="BROKER COMP (% OF PREMIUM)" stats={cohort.broker_comp_pct_premium} fmt={fmtPct} />
          <PercentileBar label="SBI™ SCORE" stats={cohort.sbi_score} fmt={(v) => v.toFixed(1)} />
          <PercentileBar label="EMPLOYEES" stats={cohort.employees} fmt={fmtNum} />
        </div>
      )}
    </div>
  );
}

export function IngestLogView() {
  const [ein, setEin] = useState("");
  const [company, setCompany] = useState("");
  const [ingestResult, setIngestResult] = useState<any>(null);
  const [ingesting, setIngesting] = useState(false);
  const { data: statusData, isLoading } = useQuery<any>({ queryKey: ["/api/sales-os/ingest/status"], refetchInterval: 30000 });
  const statuses: any[] = statusData?.data || [];
  const sc = (s: string) => s === "live" ? T.green : s === "no_key" ? T.gold : s === "unreachable" ? T.red : T.muted;

  const triggerIngest = async () => {
    if (!company && !ein) return;
    setIngesting(true); setIngestResult(null);
    try {
      const res = await fetch("/api/sales-os/accounts/ingest", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: company, ein }),
      });
      setIngestResult(await res.json());
    } catch (e) { setIngestResult({ error: String(e) }); }
    finally { setIngesting(false); }
  };

  return (
    <div style={{ padding: 24, fontFamily: "var(--font-sans)", maxWidth: 860 }}>
      <h2 style={{ color: T.gold, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>INGEST LOG</h2>
      <div style={{ fontSize: 9, color: T.muted, marginBottom: 16 }}>Federal API connection status · SHA-256 evidence fingerprinting on every record</div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${T.border}` }}><SectionLabel>FEDERAL API STATUS</SectionLabel></div>
        {isLoading ? <div style={{ padding: 14, color: T.muted, fontSize: 9 }}>Checking…</div> : statuses.map((api: any) => (
          <div key={api.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc(api.status), display: "inline-block" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: T.textLight }}>{api.name}</span>
              <span style={{ fontSize: 8, color: T.muted }}>{api.label}</span>
            </div>
            <span style={{ fontSize: 7, fontWeight: 700, color: sc(api.status), border: `1px solid ${sc(api.status)}`, padding: "2px 5px", borderRadius: 3 }}>{api.status?.toUpperCase().replace("_", " ")}</span>
          </div>
        ))}
      </Card>
      <Card style={{ padding: "14px 16px", marginBottom: 16 }}>
        <SectionLabel>TRIGGER FEDERAL INGEST</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 7, color: T.muted, marginBottom: 4 }}>COMPANY NAME</div>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. R.T. Moore Co." data-testid="input-ingest-company" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 7, color: T.muted, marginBottom: 4 }}>EIN (OPTIONAL)</div>
            <input value={ein} onChange={(e) => setEin(e.target.value)} placeholder="e.g. 35-1234567" data-testid="input-ingest-ein" style={inputStyle} />
          </div>
        </div>
        <button onClick={triggerIngest} disabled={ingesting || (!company && !ein)} data-testid="button-trigger-ingest" style={{ ...btnStyle(!ingesting && !!(company || ein)), opacity: ingesting ? 0.6 : 1 }}>
          {ingesting ? "INGESTING…" : "RUN FEDERAL INGEST →"}
        </button>
      </Card>
      {ingestResult && (
        <Card style={{ padding: "12px 14px" }}>
          <SectionLabel>INGEST RESULT</SectionLabel>
          {ingestResult.error ? <div style={{ color: T.red, fontSize: 10 }}>{ingestResult.error}</div> : (
            <>
              <div style={{ fontSize: 10, color: T.text, marginBottom: 8 }}>{ingestResult.message}</div>
              <div style={{ display: "flex", gap: 12 }}>
                {Object.entries(ingestResult.data?.sources || {}).map(([k, src]: [string, any]) => (
                  <div key={k} style={{ flex: 1, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 5, padding: "8px 10px" }}>
                    <div style={{ fontSize: 8, color: T.muted, marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: src.status === "success" ? T.green : T.muted }}>{src.status?.toUpperCase().replace("_", " ")}</div>
                    {src.records !== undefined && <div style={{ fontSize: 8, color: T.muted }}>{src.records} records</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Account Detail Page ────────────────────────────────────────────────────────
export function SalesOSAccountDetail() {
  const params = useParams<{ ein: string }>();
  const ein = params?.ein || "";
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/sales-os/account", ein],
    queryFn: async () => {
      const res = await fetch(`/api/sales-os/account/${encodeURIComponent(ein)}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!ein,
  });

  const acct = data?.data;

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "100vh", fontFamily: "var(--font-sans)", overflowY: "auto" }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setLocation("/sales-os/prospects")} style={{ ...btnStyle(false), fontSize: 8 }}>← BACK</button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.gold }}>ACCOUNT DETAIL</div>
            <div style={{ fontSize: 8, color: T.muted }}>DOL Form 5500 · 7-Dimension AI Score · MODELED confidence</div>
          </div>
        </div>
        {isLoading && <div style={{ padding: 40, color: T.muted, textAlign: "center" }}>Loading account intelligence…</div>}
        {acct && (
          <div style={{ padding: 24, maxWidth: 960 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.textLight }}>{acct.employer_name}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{acct.city}, {acct.state} · EIN {acct.ein} · Plan Year {acct.latest_year}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
              {[
                { label: "WELFARE PREMIUMS",   value: fmt$(acct.total_welfare_premiums),   color: T.gold    },
                { label: "BROKER COMMISSIONS", value: fmt$(acct.total_broker_commissions), color: T.orange  },
                { label: "ADMIN FEES",         value: fmt$(acct.total_admin_fees),         color: T.cyan    },
                { label: "COVERED LIVES",      value: fmtNum(acct.max_participants),       color: T.textLight },
              ].map((kv) => (
                <Card key={kv.label} style={{ padding: "14px 16px" }}>
                  <SectionLabel>{kv.label}</SectionLabel>
                  <div style={{ fontSize: 20, fontWeight: 800, color: kv.color }}>{kv.value}</div>
                </Card>
              ))}
            </div>

            {/* 7-Dimension AI Score */}
            {acct.sub_scores && (
              <Card style={{ padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <SectionLabel>AI OPPORTUNITY SCORE — 7 DIMENSIONS</SectionLabel>
                    <div style={{ fontSize: 24, fontWeight: 800, color: acct.opportunity_tier === "green" ? T.green : acct.opportunity_tier === "red" ? T.red : T.gold }}>
                      {acct.opportunity_score} / 100
                    </div>
                  </div>
                  <ScoreBadge score={acct.opportunity_score || 0} tier={acct.opportunity_tier} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(acct.sub_scores || {}).map(([key, val]: [string, any]) => {
                    const pct = (val.score / val.max) * 100;
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: T.text, marginBottom: 3 }}>
                          <span>{key.replace(/_/g, " ").toUpperCase()}</span>
                          <span style={{ color: T.muted }}>{val.score} / {val.max}</span>
                        </div>
                        <div style={{ height: 5, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 70 ? T.green : pct >= 40 ? T.gold : T.orange, borderRadius: 3, transition: "width 0.6s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Stage selector */}
            <Card style={{ padding: "14px 16px", marginBottom: 20 }}>
              <SectionLabel>ADD TO PIPELINE — SELECT STAGE</SectionLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["target","research","outreach","discovery","proposal","negotiation","closed_won","closed_lost"].map((stage) => (
                  <button
                    key={stage}
                    data-testid={`btn-stage-${stage}`}
                    onClick={async () => {
                      await fetch("/api/sales-os/kanban", {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          employer_ein: acct.ein, employer_name: acct.employer_name,
                          state: acct.state, city: acct.city, industry: acct.business_code,
                          participants: acct.max_participants, welfare_premiums: acct.total_welfare_premiums,
                          broker_commissions: acct.total_broker_commissions,
                          opportunity_score: acct.opportunity_score, opportunity_tier: acct.opportunity_tier,
                          stage,
                        }),
                      });
                    }}
                    style={{ ...btnStyle(false), fontSize: 8, textTransform: "uppercase" }}
                  >
                    + {stage.replace("_", " ")}
                  </button>
                ))}
              </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Card style={{ padding: "14px 16px" }}>
                <SectionLabel>PLAN DETAILS</SectionLabel>
                {[
                  { label: "Plan Name",     value: acct.latest_plan_name || "—"         },
                  { label: "Industry",      value: acct.business_code || "—"            },
                  { label: "Has Health",    value: acct.has_health ? "YES" : "NO"       },
                  { label: "Has Stop-Loss", value: acct.has_stop_loss ? "YES" : "NO"   },
                  { label: "Filing Count",  value: String(acct.filing_count || "—")     },
                  { label: "Total Income",  value: fmt$(acct.total_income)              },
                ].map((r) => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.border}`, fontSize: 9 }}>
                    <span style={{ color: T.muted }}>{r.label}</span>
                    <span style={{ color: T.textLight, fontWeight: 700 }}>{r.value}</span>
                  </div>
                ))}
              </Card>
              <Card style={{ padding: "14px 16px" }}>
                <SectionLabel>COMMISSION INTELLIGENCE</SectionLabel>
                <div style={{ fontSize: 9, color: T.text, lineHeight: 1.7 }}>
                  {acct.total_broker_commissions > 0 && acct.total_welfare_premiums > 0 ? (
                    <>
                      <div style={{ marginBottom: 6 }}>Broker commission rate: <strong style={{ color: T.orange }}>{fmtPct((acct.total_broker_commissions / acct.total_welfare_premiums) * 100)}</strong> of premium</div>
                      <div style={{ marginBottom: 6 }}>Annual broker comp: <strong style={{ color: T.gold }}>{fmt$(acct.total_broker_commissions)}</strong></div>
                      <div style={{ marginBottom: 6 }}>At 4% rate: savings of <strong style={{ color: T.green }}>{fmt$(acct.total_broker_commissions - acct.total_welfare_premiums * 0.04)}</strong>/yr</div>
                      <div style={{ fontSize: 8, color: T.muted, marginTop: 8 }}>MODELED · DOL Form 5500 Schedule A</div>
                    </>
                  ) : (
                    <div style={{ color: T.muted }}>No commission data available for this plan year.</div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Filing Alerts Panel ───────────────────────────────────────────────────────
// Standing watches for new Form 5500 filings by state (default Indiana).
// Live-scored against the DOL EFAST2 DuckDB corpus; NEW matches are flagged
// until acknowledged.
interface FilingWatch {
  id: string;
  label: string;
  state: string;
  min_participants: number | null;
  only_health: boolean;
  only_stop_loss: boolean;
  min_premium: number | null;
  active: boolean;
  seen_count: number;
  new_count: number | null;
  created_at: string | null;
  last_checked_at: string | null;
}

interface FilingAlert {
  ein: string;
  employer_name: string;
  city: string | null;
  state: string;
  latest_year: number | null;
  participants: number | null;
  welfare_premiums: number | null;
  broker_commissions: number | null;
  admin_fees: number | null;
  broker_comp_pct: number | null;
  has_health: boolean;
  has_stop_loss: boolean;
  filing_count: number | null;
  flags: string[];
  is_new: boolean;
}

const FLAG_META: Record<string, { label: string; color: string }> = {
  STOP_LOSS_GAP:    { label: "STOP-LOSS GAP",  color: T.red },
  HIGH_BROKER_COMP: { label: "HIGH BROKER $",  color: T.orange },
  LARGE_GROUP:      { label: "LARGE GROUP",    color: T.blue },
  STOP_LOSS:        { label: "STOP-LOSS",      color: T.cyan },
};

function FilingAlertsPanel() {
  const qc = useQueryClient();
  const [, setLoc] = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewOnly, setShowNewOnly] = useState(false);

  // New-watch form
  const [label, setLabel] = useState("");
  const [state, setState] = useState("IN");
  const [minPart, setMinPart] = useState("");
  const [minPrem, setMinPrem] = useState("");
  const [onlyHealth, setOnlyHealth] = useState(false);
  const [onlyStopLoss, setOnlyStopLoss] = useState(false);

  const watchesQuery = useQuery<{ data: FilingWatch[] }>({
    queryKey: ["/api/sales-os/alerts/watches"],
  });
  const watches = watchesQuery.data?.data ?? [];

  useEffect(() => {
    if (!selectedId && watches.length > 0) setSelectedId(watches[0].id);
    if (selectedId && watches.length && !watches.find((w) => w.id === selectedId)) {
      setSelectedId(watches[0]?.id ?? null);
    }
  }, [watches, selectedId]);

  const alertsQuery = useQuery<{ data: FilingAlert[]; new_count: number; watch: FilingWatch }>({
    queryKey: ["/api/sales-os/alerts/watches", selectedId, "alerts"],
    enabled: !!selectedId,
  });
  const alerts = alertsQuery.data?.data ?? [];
  const shown = showNewOnly ? alerts.filter((a) => a.is_new) : alerts;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sales-os/alerts/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: label.trim() || undefined,
          state,
          min_participants: minPart ? parseInt(minPart, 10) : null,
          min_premium: minPrem ? parseFloat(minPrem) : null,
          only_health: onlyHealth,
          only_stop_loss: onlyStopLoss,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      return res.json();
    },
    onSuccess: (w: FilingWatch) => {
      setLabel(""); setMinPart(""); setMinPrem(""); setOnlyHealth(false); setOnlyStopLoss(false);
      setSelectedId(w.id);
      qc.invalidateQueries({ queryKey: ["/api/sales-os/alerts/watches"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales-os/alerts/watches/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sales-os/alerts/watches"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/sales-os/alerts/watches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("toggle failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sales-os/alerts/watches"] }),
  });

  const ackMutation = useMutation({
    mutationFn: async ({ id, eins }: { id: string; eins?: string[] }) => {
      const res = await fetch(`/api/sales-os/alerts/watches/${id}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eins: eins ?? null }),
      });
      if (!res.ok) throw new Error("ack failed");
      return res.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/sales-os/alerts/watches"] });
      qc.invalidateQueries({ queryKey: ["/api/sales-os/alerts/watches", vars.id, "alerts"] });
    },
  });

  const pipelineMutation = useMutation({
    mutationFn: async (a: FilingAlert) => {
      const res = await fetch(`/api/sales-os/pipeline/${encodeURIComponent(a.ein)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stage: "target",
          sponsor_name: a.employer_name,
          state: a.state,
          est_premium: a.welfare_premiums,
          employees: a.participants,
        }),
      });
      if (!res.ok) throw new Error("pipeline failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sales-os/pipeline"] });
      qc.invalidateQueries({ queryKey: ["/api/sales-os/kanban"] });
    },
  });

  const selected = watches.find((w) => w.id === selectedId) || null;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* ── Watches sidebar ── */}
      <div style={{ width: 312, flexShrink: 0, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: T.surface, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
            <BellRing size={13} color={T.gold} />
            <span style={{ fontSize: 11, fontWeight: 800, color: T.textLight, letterSpacing: "0.06em" }}>FILING ALERTS</span>
          </div>
          <div style={{ fontSize: 8, color: T.muted, lineHeight: 1.5 }}>
            Standing watches for new Form 5500 filings. Live-scored against the DOL EFAST2 corpus.
          </div>
        </div>

        {/* New watch form */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
          <SectionLabel>New Watch</SectionLabel>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            data-testid="input-watch-label"
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <select value={state} onChange={(e) => setState(e.target.value)} data-testid="select-watch-state" style={{ ...selectStyle, flex: 1 }}>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              value={minPart}
              onChange={(e) => setMinPart(e.target.value.replace(/\D/g, ""))}
              placeholder="Min lives"
              data-testid="input-watch-min-participants"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <input
            value={minPrem}
            onChange={(e) => setMinPrem(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Min welfare premium ($)"
            data-testid="input-watch-min-premium"
            style={{ ...inputStyle, marginBottom: 6 }}
          />
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button
              onClick={() => setOnlyHealth(!onlyHealth)}
              data-testid="toggle-watch-health"
              style={{ ...btnStyle(onlyHealth), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              {onlyHealth ? <CheckSquare size={11} /> : <Square size={11} />} HEALTH
            </button>
            <button
              onClick={() => setOnlyStopLoss(!onlyStopLoss)}
              data-testid="toggle-watch-stoploss"
              style={{ ...btnStyle(onlyStopLoss), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              {onlyStopLoss ? <CheckSquare size={11} /> : <Square size={11} />} STOP-LOSS
            </button>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            data-testid="button-create-watch"
            style={{ ...btnStyle(true), width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
          >
            <Plus size={12} /> {createMutation.isPending ? "CREATING…" : "CREATE WATCH"}
          </button>
        </div>

        {/* Watch list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          {watchesQuery.isLoading && <div style={{ fontSize: 9, color: T.muted, padding: 8 }}>Loading watches…</div>}
          {!watchesQuery.isLoading && watches.length === 0 && (
            <div style={{ fontSize: 9, color: T.muted, padding: "12px 8px", lineHeight: 1.6 }}>
              No watches yet. Create one above — Indiana is preselected.
            </div>
          )}
          {watches.map((w) => {
            const isSel = w.id === selectedId;
            return (
              <div
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                data-testid={`card-watch-${w.id}`}
                style={{
                  padding: "9px 10px", marginBottom: 6, borderRadius: 6, cursor: "pointer",
                  background: isSel ? `${T.gold}14` : T.surface2,
                  border: `1px solid ${isSel ? T.gold : T.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: isSel ? T.gold : T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {w.label}
                    </span>
                    {!!w.new_count && w.new_count > 0 && (
                      <span data-testid={`badge-new-${w.id}`} style={{ fontSize: 7, fontWeight: 800, color: "#000", background: T.gold, padding: "1px 5px", borderRadius: 8, flexShrink: 0 }}>
                        {w.new_count} NEW
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(w.id); }}
                    data-testid={`button-delete-watch-${w.id}`}
                    style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", flexShrink: 0, padding: 0 }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 7, color: T.muted, border: `1px solid ${T.border}`, padding: "1px 4px", borderRadius: 3 }}>{w.state}</span>
                  {w.min_participants ? <span style={{ fontSize: 7, color: T.muted }}>≥{fmtNum(w.min_participants)} lives</span> : null}
                  {w.only_stop_loss ? <span style={{ fontSize: 7, color: T.cyan }}>STOP-LOSS</span> : null}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMutation.mutate({ id: w.id, active: !w.active }); }}
                    data-testid={`button-toggle-watch-${w.id}`}
                    style={{ marginLeft: "auto", fontSize: 7, fontWeight: 700, letterSpacing: "0.08em", background: "transparent", border: `1px solid ${w.active ? T.green : T.muted}`, color: w.active ? T.green : T.muted, borderRadius: 3, padding: "1px 5px", cursor: "pointer" }}
                  >
                    {w.active ? "ACTIVE" : "PAUSED"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Alert feed ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {!selected && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: T.muted }}>
            <Bell size={28} />
            <div style={{ fontSize: 10 }}>Create or select a watch to see matching filings.</div>
          </div>
        )}
        {selected && (
          <>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: T.surface }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.textLight }}>{selected.label}</div>
                <div style={{ fontSize: 8, color: T.muted, marginTop: 2 }}>
                  {selected.state} · {alertsQuery.data?.new_count ?? 0} new · {alerts.length} matching filings · source: DOL Form 5500
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => setShowNewOnly(!showNewOnly)}
                  data-testid="button-filter-new"
                  style={{ ...btnStyle(showNewOnly), display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Filter size={11} /> {showNewOnly ? "NEW ONLY" : "ALL"}
                </button>
                <button
                  onClick={() => alertsQuery.refetch()}
                  data-testid="button-refresh-alerts"
                  style={{ ...btnStyle(false), display: "flex", alignItems: "center", gap: 5 }}
                >
                  <RefreshCw size={11} /> RESCAN
                </button>
                <button
                  onClick={() => selectedId && ackMutation.mutate({ id: selectedId })}
                  disabled={ackMutation.isPending || (alertsQuery.data?.new_count ?? 0) === 0}
                  data-testid="button-ack-all"
                  style={{ ...btnStyle(true), display: "flex", alignItems: "center", gap: 5, opacity: (alertsQuery.data?.new_count ?? 0) === 0 ? 0.4 : 1 }}
                >
                  <CheckCircle size={11} /> MARK ALL READ
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
              {alertsQuery.isLoading && <div style={{ fontSize: 9, color: T.muted, padding: 8 }}>Scanning filing corpus…</div>}
              {!alertsQuery.isLoading && shown.length === 0 && (
                <div style={{ fontSize: 9, color: T.muted, padding: "16px 8px" }}>
                  {showNewOnly ? "No new filings — all caught up." : "No filings match this watch's criteria."}
                </div>
              )}
              {shown.map((a) => (
                <div
                  key={a.ein}
                  data-testid={`row-alert-${a.ein}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", marginBottom: 7, borderRadius: 7,
                    background: a.is_new ? `${T.gold}0d` : T.surface2,
                    border: `1px solid ${a.is_new ? `${T.gold}55` : T.border}`,
                  }}
                >
                  <div style={{ width: 6, alignSelf: "stretch", borderRadius: 4, background: a.is_new ? T.gold : "transparent", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {a.is_new && <span style={{ fontSize: 7, fontWeight: 800, color: "#000", background: T.gold, padding: "1px 5px", borderRadius: 3 }}>NEW</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, color: T.textLight }}>{a.employer_name}</span>
                      <span style={{ fontSize: 8, color: T.muted }}>{a.city ? `${a.city}, ` : ""}{a.state}</span>
                      <span style={{ fontSize: 8, color: T.muted }}>· EIN {a.ein}</span>
                      {a.latest_year && <span style={{ fontSize: 8, color: T.muted }}>· FY{a.latest_year}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                      {a.flags.map((f) => {
                        const m = FLAG_META[f];
                        if (!m) return null;
                        return (
                          <span key={f} style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.06em", color: m.color, border: `1px solid ${m.color}55`, padding: "1px 5px", borderRadius: 3 }}>
                            {m.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 18, flexShrink: 0, textAlign: "right" }}>
                    <div>
                      <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.08em" }}>LIVES</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.text }}>{fmtNum(a.participants)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.08em" }}>PREMIUM</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.text }}>{fmt$(a.welfare_premiums)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 7, color: T.muted, letterSpacing: "0.08em" }}>BROKER $</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: a.broker_comp_pct && a.broker_comp_pct >= 6.5 ? T.orange : T.text }}>
                        {fmt$(a.broker_commissions)}{a.broker_comp_pct != null ? ` · ${a.broker_comp_pct}%` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={() => setLoc(`/sales-os/account/${a.ein}`)}
                      data-testid={`button-brief-${a.ein}`}
                      style={{ ...btnStyle(false), padding: "4px 9px", fontSize: 7, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <FileSearch size={10} /> BRIEF
                    </button>
                    <button
                      onClick={() => pipelineMutation.mutate(a)}
                      data-testid={`button-pipeline-${a.ein}`}
                      style={{ ...btnStyle(false), padding: "4px 9px", fontSize: 7, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Plus size={10} /> PIPELINE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main SalesOS Shell ────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard", path: "/sales-os",           label: "DASHBOARD",        icon: <BarChart3 size={13} /> },
  { id: "targets",   path: "/sales-os/prospects", label: "TARGET ACCOUNTS",  icon: <Target size={13} /> },
  { id: "book",      path: null,                   label: "BOOK OF BUSINESS", icon: <BookOpen size={13} /> },
  { id: "states",    path: null,                   label: "STATES",           icon: <MapPin size={13} /> },
  { id: "pipeline",  path: "/sales-os/pipeline",  label: "PIPELINE",         icon: <Layers size={13} /> },
  { id: "alerts",    path: "/sales-os/alerts",    label: "FILING ALERTS",    icon: <Bell size={13} /> },
  { id: "analytics", path: "/sales-os/analytics", label: "ANALYTICS",        icon: <TrendingUp size={13} /> },
  { id: "settings",  path: null,                   label: "SETTINGS",         icon: <Settings size={13} /> },
];

export default function SalesOS() {
  const [location, setLocation] = useLocation();
  const [localTab, setLocalTab] = useState("book");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");

  const activeTab = (() => {
    if (location === "/sales-os/prospects") return "targets";
    if (location === "/sales-os/pipeline")  return "pipeline";
    if (location === "/sales-os/alerts")    return "alerts";
    if (location === "/sales-os/analytics") return "analytics";
    if (location.startsWith("/sales-os/account/")) return "targets";
    if (location === "/sales-os") return "dashboard";
    return localTab;
  })();

  const handleTabClick = (t: typeof TABS[0]) => {
    if (t.path) setLocation(t.path);
    else { setLocation("/sales-os"); setLocalTab(t.id); }
  };

  const displayTab = (() => {
    if (activeTab === "dashboard" && location === "/sales-os" && TABS.find((t) => t.id === localTab && !t.path)) return localTab;
    if (activeTab !== "dashboard" && TABS.find((t) => t.id === activeTab)?.path) return activeTab;
    if (location === "/sales-os" && !TABS.find((t) => t.id === localTab)?.path) return localTab;
    return activeTab;
  })();

  const handleHeaderSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && headerSearch.trim()) {
      setLocation("/sales-os/prospects");
      setLocalTab("targets");
    }
  };

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", position: "relative" }}>
        {/* Brand bar */}
        <div style={{ padding: "10px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface, flexShrink: 0, gap: 16 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.gold, letterSpacing: "0.08em" }}>KINCAID HEALTH VERIFY™</span>
              <span style={{ fontSize: 9, color: T.muted, letterSpacing: "0.12em" }}>SALES OS</span>
              <span style={{ fontSize: 7, color: T.green, border: `1px solid ${T.green}`, padding: "1px 5px", borderRadius: 3 }}>LIVE</span>
            </div>
            <div style={{ fontSize: 8, color: `${T.muted}99`, marginTop: 1, fontStyle: "italic" }}>
              Cold call is dead. Evidence briefing is the motion.
            </div>
          </div>

          {/* Universal search */}
          <div style={{ flex: 1, maxWidth: 360, position: "relative" }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
            <input
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              onKeyDown={handleHeaderSearch}
              placeholder="Search employers, EINs, cities… (Enter to search)"
              data-testid="input-universal-search"
              style={{ ...inputStyle, paddingLeft: 28, fontSize: 9 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: T.muted, textAlign: "right" }}>
              <div>191,887 employers · 6 federal APIs</div>
            </div>
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              data-testid="button-copilot-toggle"
              style={{ ...btnStyle(copilotOpen), display: "flex", alignItems: "center", gap: 5, padding: "7px 14px" }}
            >
              <Brain size={12} />
              AI COPILOT
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${T.border}`, background: T.surface, overflowX: "auto", flexShrink: 0 }}>
          {TABS.map((t) => {
            const isActive = t.id === "dashboard"
              ? (location === "/sales-os" && !TABS.find((x) => x.id === localTab && !x.path && localTab !== "book"))
                || (location === "/sales-os" && activeTab === "dashboard" && localTab === "book" && displayTab === "dashboard")
              : t.id === displayTab || (t.path && location.startsWith(t.path) && t.path !== "/sales-os");
            return (
              <button
                key={t.id}
                onClick={() => handleTabClick(t)}
                data-testid={`tab-${t.id}`}
                style={{
                  padding: "10px 16px", background: "transparent", border: "none",
                  borderBottom: isActive ? `2px solid ${T.gold}` : "2px solid transparent",
                  color: isActive ? T.gold : T.muted,
                  fontFamily: "var(--font-sans)", fontSize: 9, fontWeight: 800,
                  letterSpacing: "0.12em", cursor: "pointer", whiteSpace: "nowrap",
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Main content + Copilot drawer */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
          {/* Page content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {displayTab === "dashboard"  && <div style={{ flex: 1, overflowY: "auto" }}><DashboardPanel /></div>}
            {displayTab === "targets"    && <div style={{ flex: 1, overflow: "hidden", display: "flex" }}><TargetAccountsPanel /></div>}
            {displayTab === "book"       && <div style={{ flex: 1, overflow: "hidden", display: "flex" }}><AccountBriefView /></div>}
            {displayTab === "states"     && <div style={{ flex: 1, overflow: "hidden", display: "flex" }}><StatesPanel /></div>}
            {displayTab === "pipeline"   && <div style={{ flex: 1, overflowY: "auto" }}><KanbanPipeline /></div>}
            {displayTab === "alerts"     && <div style={{ flex: 1, overflow: "hidden", display: "flex" }}><FilingAlertsPanel /></div>}
            {displayTab === "analytics"  && <div style={{ flex: 1, overflowY: "auto" }}><AnalyticsPanel /></div>}
            {displayTab === "settings"   && <div style={{ flex: 1, overflow: "hidden", display: "flex" }}><SettingsPanel /></div>}
          </div>

          {/* Copilot drawer */}
          {copilotOpen && (
            <div className="kiq-ops-card" style={{ width: 420, flexShrink: 0, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: T.surface, overflow: "hidden", borderRadius: 0 }}>
              <CopilotPanel onClose={() => setCopilotOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
