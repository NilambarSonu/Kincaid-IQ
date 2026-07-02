import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShareMenu } from "@/components/ShareMenu";
import { FilingIntelligence } from "./FilingIntelligence";
import {
  Map, BarChart3, Zap, AlertTriangle, CheckCircle2, Shield,
  TrendingUp, Target, ChevronRight, X, ArrowUpRight, Info,
  Loader2, Star, AlertOctagon, RefreshCw, Users, FileText, Brain,
  Search, Building2, DollarSign, Calculator, Kanban, Plus, Trash2,
  ChevronDown, ChevronUp, Copy, Download, ArrowRight, Clock,
  Phone, Mail, Linkedin, Calendar, Trophy, TrendingDown, Edit2,
  GripVertical, CheckSquare, Circle, MoreHorizontal, Gauge,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";

// ─── Types ────────────────────────────────────────────────────────────────────

type StateScores = { transparency: number; pbm_risk: number; regulatory_strictness: number; broker_comp_visibility: number };
type StateSummary = { code: string; name: string; region: string; priority: string; scores: StateScores; spread_prevalence_pct: number; passthrough_prevalence_pct: number; dominant_pbm_model: string; alert_count: number };
type StateAlert = { type: string; severity: string; title: string; description: string; action: string };
type StateDetail = {
  code: string; name: string; region: string; priority: string;
  scores: StateScores;
  regulatory_rules: { summary: string; key_legislation: string[]; enforcement_body: string; filing_requirements: string; penalties: string };
  pbm_constraints: { spread_pricing_allowed: boolean; spread_pricing_status: string; rebate_passthrough_required: boolean; mac_transparency_required: boolean; auditing_rights: string; gag_clauses: string };
  broker_comp_rules: { disclosure_required: boolean; disclosure_standard: string; fiduciary_requirement: string; erisa_overlay: string };
  transparency_requirements: { employer_disclosure_alerts: boolean; drug_pricing_transparency: string; pbm_contract_visibility: string; rebate_reporting: string };
  rebate_handling_rules: { pooled_rebates_allowed: boolean; passthrough_model: string; rebate_visibility_to_employer: string };
  market_norms: { spread_prevalence_pct: number; passthrough_prevalence_pct: number; avg_broker_comp_disclosure: string; dominant_pbm_model: string; employer_sophistication: string };
  ca_specific_alerts: StateAlert[];
  sales_profile: { difficulty: string; opportunity: string; urgency_hook: string; key_differentiator: string; objection: string; objection_response: string };
};

type SalesAngle = {
  state: string; state_name: string; client_type: string; employer_size: string;
  talking_points: string[]; objections: [string, string][]; urgency_hooks: string[];
  key_differentiator?: string; regulatory_context: { strictness_score: number; key_legislation: string[]; pbm_status: string };
  industry_note?: string; ai_generated: boolean;
  opening_hook?: string; top_objection?: string; objection_response?: string; urgency_hook?: string; closing_ask?: string;
  email_subject?: string; linkedin_opener?: string; discovery_questions?: string[];
};

type Alert = { type: string; severity: string; title: string; description: string; action: string; state: string; state_name: string };

type QualAccount = { id: string; name: string; state: string; fundingType: string; size: string; industry: string };
type QualStatus = "qualified" | "watch" | "not-qualified";
type QualResult = QualAccount & { score: number; status: QualStatus; signals: string[]; stateData?: StateSummary };

// ─── All 50 states + DC ───────────────────────────────────────────────────────

const ALL_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DC", name: "District of Columbia" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

const INDUSTRY_PRESETS = [
  "Healthcare", "Manufacturing", "Financial Services", "Retail", "Tech",
  "Education", "Government", "Hospitality", "Construction", "Nonprofit",
];

// ─── FIPS → State code map ────────────────────────────────────────────────────

const FIPS_TO_STATE: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC",
  "12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY",
  "22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT",
  "31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH",
  "40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT",
  "50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY",
};

// ─── Score color helpers ──────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 6.5) return "#f59e0b";
  if (score >= 5) return "#60a5fa";
  return "#10b981";
}
function mapFillColor(state: StateSummary | undefined): string {
  if (!state) return "rgba(255,255,255,0.06)";
  if (state.priority === "PRIORITY") return "#9B1C2E";
  if (state.priority === "HIGH") return "#c2410c";
  const s = state.scores.regulatory_strictness;
  if (s >= 8) return "#7c3aed";
  if (s >= 6.5) return "#1d4ed8";
  if (s >= 5) return "#0369a1";
  return "#164e63";
}

// ─── Small components ─────────────────────────────────────────────────────────

function ScoreBadge({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const color = scoreColor(value);
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function Chip({ children, color = "#60a5fa" }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 100, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, background: `${color}18`, border: `1px solid ${color}35`, color, whiteSpace: "nowrap" as const }}>
      {children}
    </span>
  );
}

function AlertCard({ alert }: { alert: StateAlert & { state?: string; state_name?: string } }) {
  const sevColor = alert.severity === "HIGH" ? "#ef4444" : alert.severity === "MEDIUM" ? "#f59e0b" : "#10b981";
  const typeColor = alert.type === "COMPLIANCE_RISK" || alert.type === "FEDERAL" ? sevColor : "#8b5cf6";
  return (
    <div style={{ background: `${sevColor}08`, border: `1px solid ${sevColor}25`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <AlertTriangle size={14} color={sevColor} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{alert.title}</span>
            <Chip color={sevColor}>{alert.severity}</Chip>
            {alert.state && alert.state !== "ALL" && <Chip color={typeColor}>{alert.state}</Chip>}
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: 0, lineHeight: 1.6 }}>{alert.description}</p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 24 }}>
        <ChevronRight size={11} color={sevColor} />
        <span style={{ fontSize: 10, fontWeight: 700, color: sevColor }}>{alert.action}</span>
      </div>
    </div>
  );
}

// ─── Map Color Legend ─────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
      {[
        { color: BB_CRIMSON, label: "Priority (CA)" },
        { color: "#c2410c", label: "High Priority" },
        { color: "#7c3aed", label: "Strict (8+)" },
        { color: "#1d4ed8", label: "Moderate (6.5+)" },
        { color: "#0369a1", label: "Standard (5+)" },
        { color: "#164e63", label: "Low Scrutiny" },
      ].map(l => (
        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
          {l.label}
        </div>
      ))}
    </div>
  );
}

// ─── State Detail Panel ───────────────────────────────────────────────────────

function StateDetailPanel({ state, onClose }: { state: StateDetail; onClose: () => void }) {
  const isCA = state.code === "CA";
  const spread = state.market_norms.spread_prevalence_pct;
  const pass = state.market_norms.passthrough_prevalence_pct;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{state.name}</span>
            {isCA && (
              <span style={{ fontSize: 9, fontWeight: 900, padding: "3px 10px", borderRadius: 100, background: `${BB_CRIMSON}25`, border: `1px solid ${BB_CRIMSON}50`, color: BB_CRIMSON, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                ★ Priority State
              </span>
            )}
            {!isCA && state.priority === "HIGH" && <Chip color="#f59e0b">High Priority</Chip>}
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{state.region} · {state.regulatory_rules.enforcement_body}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Regulatory summary */}
      <div style={{ background: isCA ? "rgba(155,28,46,0.08)" : "rgba(255,255,255,0.03)", border: isCA ? `1px solid rgba(155,28,46,0.3)` : "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Regulatory Overview</div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "0 0 10px", lineHeight: 1.7 }}>{state.regulatory_rules.summary}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {state.regulatory_rules.key_legislation.map(l => (
            <Chip key={l} color={isCA ? BB_CRIMSON : "#60a5fa"}>{l}</Chip>
          ))}
        </div>
      </div>

      {/* Scores */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Intelligence Scores</div>
        <ScoreBadge label="Transparency Score" value={state.scores.transparency} />
        <ScoreBadge label="Regulatory Strictness" value={state.scores.regulatory_strictness} />
        <ScoreBadge label="PBM Risk Score" value={state.scores.pbm_risk} />
        <ScoreBadge label="Broker Comp Visibility" value={state.scores.broker_comp_visibility} />
      </div>

      {/* Market Norms */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Market Norms</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: spread >= 55 ? "#ef4444" : "#f59e0b" }}>{spread}%</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>SPREAD PRICING</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: pass >= 65 ? "#10b981" : "#60a5fa" }}>{pass}%</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>PASS-THROUGH</div>
          </div>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${spread}%`, height: "100%", background: "#ef4444", borderRadius: "99px 0 0 99px" }} />
        </div>
        {[
          ["Dominant Model", state.market_norms.dominant_pbm_model],
          ["Broker Comp Disclosure", state.market_norms.avg_broker_comp_disclosure],
          ["Employer Sophistication", state.market_norms.employer_sophistication],
          ["Spread Pricing", state.pbm_constraints.spread_pricing_status],
          ["Gag Clauses", state.pbm_constraints.gag_clauses],
          ["Audit Rights", state.pbm_constraints.auditing_rights],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{k}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", maxWidth: 180, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* CA Specific Alerts */}
      {state.ca_specific_alerts.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: BB_CRIMSON, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            ⚠ Compliance Risk Alerts
          </div>
          {state.ca_specific_alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      )}

      {/* Sales Profile */}
      <div style={{ background: "linear-gradient(135deg, rgba(0,43,92,0.3), rgba(155,28,46,0.08))", border: "1px solid rgba(0,43,92,0.35)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Sales Profile</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Difficulty", value: state.sales_profile.difficulty, color: state.sales_profile.difficulty.includes("HIGH") ? "#ef4444" : "#f59e0b" },
            { label: "Opportunity", value: state.sales_profile.opportunity, color: state.sales_profile.opportunity.includes("HIGH") ? "#10b981" : "#60a5fa" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, marginBottom: 10 }}>
          <span style={{ fontWeight: 700, color: "#f59e0b" }}>Urgency: </span>{state.sales_profile.urgency_hook}
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>COMMON OBJECTION</div>
          <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>"{state.sales_profile.objection}"</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{state.sales_profile.objection_response}</div>
        </div>
        <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600 }}>💡 {state.sales_profile.key_differentiator}</div>
      </div>
    </div>
  );
}

// ─── Sales Angle Generator ─────────────────────────────────────────────────────

function SalesAngleGenerator({ selectedState, statesData }: { selectedState: string | null; statesData: { states: StateSummary[] } | undefined }) {
  const { toast } = useToast();
  const [stateCode, setStateCode] = useState(selectedState || "CA");
  const [clientType, setClientType] = useState("self-funded");
  const [employerSize, setEmployerSize] = useState("mid-market");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState("");
  const [result, setResult] = useState<SalesAngle | null>(null);

  const stateMap = useMemo(() => {
    const m: Record<string, StateSummary> = {};
    statesData?.states.forEach(s => { m[s.code] = s; });
    return m;
  }, [statesData]);

  const selectedStateSummary = stateMap[stateCode];
  const effectiveIndustry = industry || customIndustry || null;

  const mutation = useMutation<SalesAngle, Error, void>({
    mutationFn: async () => {
      const resp = await fetch("/api/sales-iq/sales-angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_code: stateCode, client_type: clientType, employer_size: employerSize, industry: effectiveIndustry }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || "Failed"); }
      return resp.json();
    },
    onSuccess: (data) => setResult(data),
    onError: (e) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  function copyFullPlaybook() {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`SALES PLAYBOOK — ${result.state_name} · ${result.client_type} · ${result.employer_size}`);
    lines.push("=".repeat(60));
    if (result.email_subject) { lines.push("\nEMAIL SUBJECT LINE"); lines.push(result.email_subject); }
    if (result.linkedin_opener) { lines.push("\nLINKEDIN OPENER"); lines.push(result.linkedin_opener); }
    if (result.opening_hook) { lines.push("\nOPENING HOOK"); lines.push(`"${result.opening_hook}"`); }
    if (result.talking_points?.length) {
      lines.push("\nKEY TALKING POINTS");
      result.talking_points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    }
    if (result.urgency_hooks?.length) {
      lines.push("\nURGENCY HOOKS");
      result.urgency_hooks.forEach(h => lines.push(`• ${h}`));
    }
    if (result.top_objection && result.objection_response) {
      lines.push("\nOBJECTION HANDLING");
      lines.push(`Q: "${result.top_objection}"`);
      lines.push(`A: ${result.objection_response}`);
    }
    if (result.discovery_questions?.length) {
      lines.push("\nDISCOVERY QUESTIONS");
      result.discovery_questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    }
    if (result.closing_ask) { lines.push("\nCLOSING ASK"); lines.push(result.closing_ask); }
    if (result.industry_note) { lines.push("\nINDUSTRY INSIGHT"); lines.push(result.industry_note); }
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast({ title: "Playbook copied!", description: "Full playbook copied to clipboard." }),
      () => toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" }),
    );
  }


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Zap size={16} color={BB_CRIMSON} />
        <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Sales Angle Generator</span>
        {result?.ai_generated && <Chip color="#8b5cf6">AI-Generated</Chip>}
      </div>

      {/* Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* State dropdown */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>State</div>
          <select
            data-testid="dropdown-state"
            value={stateCode}
            onChange={e => setStateCode(e.target.value)}
            style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box", cursor: "pointer", appearance: "auto" }}
          >
            {ALL_STATES.map(s => (
              <option key={s.code} value={s.code} style={{ background: "#0d1526", color: "#fff" }}>
                {s.name} — {s.code}
              </option>
            ))}
          </select>
        </div>

        {/* Industry chips + custom fallback */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Industry (Optional)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7 }}>
            {INDUSTRY_PRESETS.map(preset => (
              <button key={preset} data-testid={`chip-industry-${preset}`}
                onClick={() => { setIndustry(industry === preset ? "" : preset); setCustomIndustry(""); }}
                style={{ padding: "4px 10px", borderRadius: 100, fontSize: 9, fontWeight: 800, cursor: "pointer", letterSpacing: "0.06em", background: industry === preset ? "rgba(155,28,46,0.25)" : "rgba(255,255,255,0.04)", border: industry === preset ? "1px solid rgba(155,28,46,0.5)" : "1px solid rgba(255,255,255,0.08)", color: industry === preset ? "#fff" : "rgba(255,255,255,0.4)" }}>
                {preset}
              </button>
            ))}
          </div>
          {!industry && (
            <input value={customIndustry} onChange={e => setCustomIndustry(e.target.value)} placeholder="Or type custom industry…"
              data-testid="input-industry-custom"
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "7px 10px", color: "#fff", fontSize: 11, outline: "none", boxSizing: "border-box" }} />
          )}
        </div>
      </div>

      {/* State risk snapshot strip */}
      {selectedStateSummary && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Reg. Strictness</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(selectedStateSummary.scores.regulatory_strictness) }}>{selectedStateSummary.scores.regulatory_strictness.toFixed(1)}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>/10</span></div>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>PBM Risk</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: scoreColor(selectedStateSummary.scores.pbm_risk) }}>{selectedStateSummary.scores.pbm_risk.toFixed(1)}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>/10</span></div>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Priority Tier</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: selectedStateSummary.priority === "PRIORITY" ? BB_CRIMSON : selectedStateSummary.priority === "HIGH" ? "#f59e0b" : "#60a5fa", marginTop: 2 }}>{selectedStateSummary.priority}</div>
          </div>
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Spread Pricing</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: selectedStateSummary.spread_prevalence_pct >= 55 ? "#ef4444" : "#f59e0b" }}>{selectedStateSummary.spread_prevalence_pct}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>%</span></div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Client Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["self-funded", "Self-Funded"], ["fully-insured", "Fully Insured"], ["level-funded", "Level-Funded"]].map(([val, label]) => (
              <button key={val} data-testid={`btn-clienttype-${val}`} onClick={() => setClientType(val)}
                style={{ padding: "8px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", background: clientType === val ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: clientType === val ? `1px solid rgba(155,28,46,0.45)` : "1px solid rgba(255,255,255,0.07)", color: clientType === val ? "#fff" : "rgba(255,255,255,0.4)" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Employer Size</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[["small", "Small (<100)"], ["mid-market", "Mid-Market (100–999)"], ["large", "Enterprise (1,000–4,999)"], ["jumbo", "Enterprise Plus (5,000+)"]].map(([val, label]) => (
              <button key={val} data-testid={`btn-empsize-${val}`} onClick={() => setEmployerSize(val)}
                style={{ padding: "8px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left", background: employerSize === val ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: employerSize === val ? `1px solid rgba(155,28,46,0.45)` : "1px solid rgba(255,255,255,0.07)", color: employerSize === val ? "#fff" : "rgba(255,255,255,0.4)" }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button data-testid="btn-generate-angle" onClick={() => mutation.mutate()} disabled={mutation.isPending || !stateCode.trim()}
        style={{ padding: "11px 0", borderRadius: 9, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", background: mutation.isPending || !stateCode ? "rgba(155,28,46,0.15)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${mutation.isPending || !stateCode ? "rgba(155,28,46,0.15)" : BB_CRIMSON}`, color: mutation.isPending || !stateCode ? "rgba(255,255,255,0.25)" : "#fff", cursor: mutation.isPending || !stateCode ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {mutation.isPending ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><Zap size={13} /> Generate Sales Angle</>}
      </button>

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Copy + Regenerate action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button data-testid="btn-copy-playbook" onClick={copyFullPlaybook}
              style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.25)", color: "#60a5fa", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <FileText size={12} /> Copy Full Playbook
            </button>
            <button data-testid="btn-regenerate" onClick={() => mutation.mutate()} disabled={mutation.isPending}
              style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: mutation.isPending ? "not-allowed" : "pointer", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: mutation.isPending ? "rgba(139,92,246,0.4)" : "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <RefreshCw size={12} style={mutation.isPending ? { animation: "spin 1s linear infinite" } : {}} /> Regenerate
            </button>
          </div>

          {/* Email Subject Line */}
          {result.email_subject && (
            <div style={{ background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Email Subject Line</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: "0.01em" }}>{result.email_subject}</div>
            </div>
          )}

          {/* LinkedIn Opener */}
          {result.linkedin_opener && (
            <div style={{ background: "rgba(14,118,168,0.08)", border: "1px solid rgba(14,118,168,0.28)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>LinkedIn Opener</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{result.linkedin_opener}</div>
            </div>
          )}

          {result.opening_hook && (
            <div style={{ background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: BB_CRIMSON, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Opening Hook</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.5, fontStyle: "italic" }}>"{result.opening_hook}"</div>
            </div>
          )}

          {result.talking_points.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Key Talking Points</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.talking_points.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(155,28,46,0.2)", border: "1px solid rgba(155,28,46,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: BB_CRIMSON }}>{i + 1}</span>
                    </div>
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.urgency_hooks.length > 0 && (
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Urgency Hooks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {result.urgency_hooks.map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                    <AlertTriangle size={11} color="#f59e0b" style={{ flexShrink: 0, marginTop: 3 }} />
                    {h}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(result.objections?.length > 0 || result.top_objection) && (
            <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.18)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Objection Handling</div>
              {result.top_objection && result.objection_response && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>"{result.top_objection}"</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, lineHeight: 1.6 }}>{result.objection_response}</div>
                </div>
              )}
              {result.objections?.map(([obj, resp], i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>"{obj}"</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600, lineHeight: 1.6 }}>{resp}</div>
                </div>
              ))}
            </div>
          )}

          {result.closing_ask && (
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Closing Ask</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>{result.closing_ask}</div>
            </div>
          )}

          {/* Discovery Questions */}
          {result.discovery_questions && result.discovery_questions.length > 0 && (
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Discovery Questions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.discovery_questions.map((q, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: "#f59e0b" }}>{i + 1}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{q}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.industry_note && (
            <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#8b5cf6", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>Industry Insight</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{result.industry_note}</div>
            </div>
          )}

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>Regulatory Context — {result.state_name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              Strictness: <strong style={{ color: scoreColor(result.regulatory_context.strictness_score) }}>{result.regulatory_context.strictness_score}/10</strong>
              {" · "}{result.regulatory_context.pbm_status}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({ states }: { states: StateSummary[] }) {
  const metrics = [
    { label: "Transparency Score", key: "transparency" as keyof StateScores },
    { label: "Regulatory Strictness", key: "regulatory_strictness" as keyof StateScores },
    { label: "PBM Risk Score", key: "pbm_risk" as keyof StateScores },
    { label: "Broker Comp Visibility", key: "broker_comp_visibility" as keyof StateScores },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Metric</th>
            {states.map(s => (
              <th key={s.code} style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, fontWeight: 800, color: s.priority === "PRIORITY" ? BB_CRIMSON : "#fff" }}>
                {s.code}
                {s.priority === "PRIORITY" && <span style={{ fontSize: 8, color: BB_CRIMSON }}> ★</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => (
            <tr key={m.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <td style={{ padding: "8px 14px", fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{m.label}</td>
              {states.map(s => {
                const val = s.scores[m.key];
                const best = Math.max(...states.map(st => st.scores[m.key]));
                const isBest = val === best;
                return (
                  <td key={s.code} style={{ padding: "8px 14px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor(val) }}>{val.toFixed(1)}</span>
                    {isBest && <span style={{ fontSize: 8, color: "#10b981", marginLeft: 3 }}>▲</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <td style={{ padding: "8px 14px", fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>Spread Pricing %</td>
            {states.map(s => (
              <td key={s.code} style={{ padding: "8px 14px", textAlign: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: s.spread_prevalence_pct >= 55 ? "#ef4444" : "#10b981" }}>{s.spread_prevalence_pct}%</span>
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ padding: "8px 14px", fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>Dominant Model</td>
            {states.map(s => (
              <td key={s.code} style={{ padding: "8px 14px", textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
                {s.dominant_pbm_model.split(" ")[0]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 (new): PROSPECT DEEP DIVE
// ─────────────────────────────────────────────────────────────────────────────

type EmpResult = {
  ein: string; employer_name: string; state: string; city: string;
  latest_plan_name: string; max_participants: number; business_code: string;
  total_welfare_premiums: number; total_broker_commissions: number;
  total_admin_fees: number; total_income: number;
  has_health: boolean; has_stop_loss: boolean; filing_count: number; latest_year: number;
};
type BenchResult = {
  employer: EmpResult;
  percentiles: { admin_fees: number; broker_commissions: number; total_income: number };
  nationalBenchmark: { p50_admin: number; p75_admin: number; p90_admin: number; p50_broker: number; p75_broker: number };
  stateContext: { state: string; employers_in_state: number };
};

function fmt$(n: number | undefined | null): string {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
function fmtPct(n: number | undefined | null): string { return n ? `${n}th` : "—"; }
function pctColor(p: number): string {
  if (p >= 90) return "#ef4444";
  if (p >= 75) return "#f59e0b";
  if (p >= 50) return "#60a5fa";
  return "#10b981";
}

function ProspectDeepDive() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<EmpResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDebouncedQ(val); setShowResults(true); }, 350);
    if (!val) { setSelected(null); setShowResults(false); }
  }

  const { data: searchData, isLoading: searchLoading } = useQuery<{ results: EmpResult[] }>({
    queryKey: ["/api/benchmark/lookup", debouncedQ],
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
  });

  const { data: bench, isLoading: benchLoading } = useQuery<BenchResult>({
    queryKey: ["/api/benchmark/employer", selected?.ein],
    enabled: !!selected?.ein,
    staleTime: 300_000,
  });

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function generateInsight() {
    if (!bench) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const e = bench.employer;
      const p = bench.percentiles;
      const nb = bench.nationalBenchmark;
      const prompt = `You are a fiduciary benefits advisor doing pre-call research. Here is what you know about this prospect from DOL Form 5500 data:

Company: ${e.employer_name} (${e.city}, ${e.state})
Plan: ${e.latest_plan_name}
Employees on plan: ${e.max_participants?.toLocaleString()}
Annual premiums/welfare spend: ${fmt$(e.total_welfare_premiums)}
Broker commissions paid: ${fmt$(e.total_broker_commissions)} — ${fmtPct(p.broker_commissions)} nationally
Admin fees paid: ${fmt$(e.total_admin_fees)} — ${fmtPct(p.admin_fees)} nationally
Has stop-loss: ${e.has_stop_loss ? "Yes" : "No"}
Years filing: ${e.filing_count}

National benchmarks (per plan): P50 admin: ${fmt$(nb.p50_admin)}, P75 admin: ${fmt$(nb.p75_admin)}, P50 broker: ${fmt$(nb.p50_broker)}

Write a concise pre-call intelligence brief (3 short paragraphs): 1) What the data reveals about this employer's plan health and pain points 2) The strongest opening wedge based on their data vs benchmarks 3) The single best discovery question to ask. Be specific to their actual numbers.`;

      const res = await fetch("/api/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 500, temperature: 0.5 }),
      });
      const json = await res.json();
      setAiInsight(json.choices?.[0]?.message?.content || json.content || "");
    } catch (err: any) {
      toast({ title: "AI error", description: err.message, variant: "destructive" });
    } finally { setAiLoading(false); }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Prospect Deep Dive</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Search 191,000+ employers from DOL Form 5500 filings — see their real plan costs, broker commissions, and how they benchmark before you call.</div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 18 }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none" }} />
          <input
            data-testid="input-deepdive-search"
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Search by company name or EIN…"
            style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "11px 12px 11px 36px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
          />
          {searchLoading && <Loader2 size={13} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", animation: "spin 1s linear infinite" }} />}
        </div>
        {/* Dropdown */}
        {showResults && searchData && searchData.results.length > 0 && !selected && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, zIndex: 50, maxHeight: 280, overflowY: "auto", marginTop: 4 }}>
            {searchData.results.map(emp => (
              <button key={emp.ein} data-testid={`btn-emp-${emp.ein}`}
                onClick={() => { setSelected(emp); setQuery(emp.employer_name); setShowResults(false); }}
                style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", textAlign: "left", cursor: "pointer", color: "#fff" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{emp.employer_name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                  {emp.city}, {emp.state} · EIN {emp.ein} · {emp.max_participants?.toLocaleString() ?? "—"} participants · {fmt$(emp.total_welfare_premiums)} premiums
                </div>
              </button>
            ))}
          </div>
        )}
        {showResults && !searchLoading && searchData?.results.length === 0 && debouncedQ.length >= 2 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, zIndex: 50, padding: "14px", marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
            No employers found for "{debouncedQ}"
          </div>
        )}
      </div>

      {/* Selected employer full profile */}
      {selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Header card */}
          <div style={{ background: "rgba(155,28,46,0.08)", border: "1px solid rgba(155,28,46,0.25)", borderRadius: 14, padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{selected.employer_name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
                  {selected.city}, {selected.state} · EIN {selected.ein} · Filed {selected.filing_count}x · Latest {selected.latest_year}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{selected.latest_plan_name}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {selected.has_health && <span style={{ fontSize: 8, fontWeight: 900, padding: "2px 8px", borderRadius: 4, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", letterSpacing: "0.1em" }}>HEALTH</span>}
                {selected.has_stop_loss && <span style={{ fontSize: 8, fontWeight: 900, padding: "2px 8px", borderRadius: 4, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b", letterSpacing: "0.1em" }}>STOP-LOSS</span>}
                <button onClick={() => { setSelected(null); setQuery(""); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 8px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 10 }}><X size={11} /></button>
              </div>
            </div>
          </div>

          {benchLoading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <Loader2 size={24} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {bench && !benchLoading && (
            <>
              {/* Key metrics grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[
                  { label: "Participants", value: bench.employer.max_participants?.toLocaleString() ?? "—", color: "#60a5fa" },
                  { label: "Welfare Premiums", value: fmt$(bench.employer.total_welfare_premiums), color: "#8b5cf6" },
                  { label: "Broker Commissions", value: fmt$(bench.employer.total_broker_commissions), color: "#f59e0b" },
                  { label: "Admin Fees", value: fmt$(bench.employer.total_admin_fees), color: "#ef4444" },
                ].map(m => (
                  <div key={m.label} style={{ background: `${m.color}08`, border: `1px solid ${m.color}20`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: m.color, marginBottom: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Percentile benchmarks */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>National Percentile Rankings</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Admin Fees", pct: bench.percentiles.admin_fees, p50: bench.nationalBenchmark.p50_admin, p75: bench.nationalBenchmark.p75_admin, p90: bench.nationalBenchmark.p90_admin, val: bench.employer.total_admin_fees },
                    { label: "Broker Commissions", pct: bench.percentiles.broker_commissions, p50: bench.nationalBenchmark.p50_broker, p75: bench.nationalBenchmark.p75_broker, p90: null, val: bench.employer.total_broker_commissions },
                    { label: "Total Income", pct: bench.percentiles.total_income, p50: null, p75: null, p90: null, val: bench.employer.total_income },
                  ].map(row => (
                    <div key={row.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{row.label}</span>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{fmt$(row.val)}</span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: pctColor(row.pct) }}>{fmtPct(row.pct)} percentile</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(row.pct, 100)}%`, height: "100%", background: pctColor(row.pct), borderRadius: 3, transition: "width 0.6s ease" }} />
                      </div>
                      {(row.p50 || row.p75) && (
                        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                          {row.p50 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>P50: {fmt$(row.p50)}</span>}
                          {row.p75 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>P75: {fmt$(row.p75)}</span>}
                          {row.p90 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>P90: {fmt$(row.p90)}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Opening wedge flags */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bench.percentiles.broker_commissions >= 75 && (
                  <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10 }}>
                    <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b" }}>High Broker Commission — {fmtPct(bench.percentiles.broker_commissions)} nationally</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Paying {fmt$(bench.employer.total_broker_commissions)} vs. P50 of {fmt$(bench.nationalBenchmark.p50_broker)}. Strong wedge for a fee-transparent approach.</div>
                    </div>
                  </div>
                )}
                {bench.percentiles.admin_fees >= 75 && (
                  <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10 }}>
                    <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444" }}>Above-Benchmark Admin Fees — {fmtPct(bench.percentiles.admin_fees)} nationally</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>Admin fees at {fmt$(bench.employer.total_admin_fees)} vs. P50 of {fmt$(bench.nationalBenchmark.p50_admin)}. Ask: "Has anyone audited your plan admin fees recently?"</div>
                    </div>
                  </div>
                )}
                {!selected.has_stop_loss && (bench.employer.max_participants ?? 0) >= 100 && (
                  <div style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10 }}>
                    <Shield size={13} color="#8b5cf6" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6" }}>No Stop-Loss Coverage Detected</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>A {bench.employer.max_participants?.toLocaleString()}-life plan without stop-loss carries significant catastrophic claim exposure.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Pre-Call Brief */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aiInsight ? 12 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)" }}>AI Pre-Call Intelligence Brief</div>
                  <button data-testid="btn-deepdive-ai" onClick={generateInsight} disabled={aiLoading}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: aiLoading ? "rgba(155,28,46,0.1)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: aiLoading ? "rgba(255,255,255,0.3)" : "#fff", fontSize: 11, fontWeight: 800, cursor: aiLoading ? "not-allowed" : "pointer" }}>
                    {aiLoading ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={11} />}
                    {aiLoading ? "Analyzing…" : "Generate Brief"}
                  </button>
                </div>
                {aiInsight && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{aiInsight}</div>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 (new): EMAIL SEQUENCE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const SEQUENCE_TOUCHES = [
  { day: 0,  channel: "email",    label: "Day 0 — First Touch",     icon: Mail,     color: "#60a5fa" },
  { day: 3,  channel: "linkedin", label: "Day 3 — LinkedIn Connect", icon: Linkedin, color: "#0ea5e9" },
  { day: 7,  channel: "email",    label: "Day 7 — Value Drop",      icon: Mail,     color: "#8b5cf6" },
  { day: 14, channel: "call",     label: "Day 14 — Phone Follow-up", icon: Phone,    color: "#f59e0b" },
  { day: 30, channel: "email",    label: "Day 30 — Break-up Email",  icon: Mail,     color: "#ef4444" },
];

type SequenceTouch = {
  day: number; channel: string; label: string;
  subject?: string; body?: string; note?: string;
};

function EmailSequenceBuilder({ statesData }: { statesData: { states: StateSummary[] } | undefined }) {
  const { toast } = useToast();
  const [stateCode, setStateCode] = useState("CA");
  const [clientType, setClientType] = useState("self-funded");
  const [employerSize, setEmployerSize] = useState("mid-market");
  const [industry, setIndustry] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [sequence, setSequence] = useState<SequenceTouch[]>([]);
  const [generating, setGenerating] = useState(false);
  const [activeTouch, setActiveTouch] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);

  async function buildSequence() {
    setGenerating(true);
    setSequence([]);
    try {
      const stateMap: Record<string, StateSummary> = {};
      statesData?.states.forEach(s => { stateMap[s.code] = s; });
      const sd = stateMap[stateCode];

      const prompt = `You are a fiduciary benefits broker sales expert. Build a 5-touch outreach sequence for the following prospect:

Prospect: ${prospectName || "a mid-market employer"}
State: ${stateCode} (Reg. strictness: ${sd?.scores.regulatory_strictness.toFixed(1) ?? "N/A"}/10, Spread pricing: ${sd?.spread_prevalence_pct ?? "N/A"}%)
Client type: ${clientType}
Employer size: ${employerSize}
Industry: ${industry || "general"}

Return ONLY a JSON array of exactly 5 touch objects with this structure:
[
  { "day": 0, "channel": "email", "label": "Day 0 — First Touch", "subject": "...", "body": "...", "note": "..." },
  { "day": 3, "channel": "linkedin", "label": "Day 3 — LinkedIn Connect", "subject": null, "body": "...", "note": "..." },
  { "day": 7, "channel": "email", "label": "Day 7 — Value Drop", "subject": "...", "body": "...", "note": "..." },
  { "day": 14, "channel": "call", "label": "Day 14 — Phone Follow-up", "subject": null, "body": "...", "note": "..." },
  { "day": 30, "channel": "email", "label": "Day 30 — Break-up Email", "subject": "...", "body": "...", "note": "..." }
]

Rules:
- Day 0 email: compelling subject line with state/regulatory urgency, 3-paragraph body referencing specific ${stateCode} laws/risks
- Day 3 LinkedIn: short, human 2-sentence connection request referencing their industry
- Day 7: value-add email with a specific insight (benchmark stat, compliance risk, etc.) — no hard sell
- Day 14: voicemail script they can read — 30 seconds, conversational
- Day 30: honest break-up email that still leaves the door open with a soft CTA
- All copy must feel personal, fiduciary-focused, not generic insurance sales
- Note field: brief coaching tip for when/how to use this touch
Return only valid JSON, no markdown.`;

      const res = await fetch("/api/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 2000, temperature: 0.65 }),
      });
      const json = await res.json();
      const raw = json.choices?.[0]?.message?.content || json.content || "[]";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed: SequenceTouch[] = JSON.parse(cleaned);
      setSequence(parsed);
      setActiveTouch(0);
    } catch (err: any) {
      toast({ title: "Sequence generation failed", description: err.message, variant: "destructive" });
    } finally { setGenerating(false); }
  }

  function copyTouch(idx: number) {
    const t = sequence[idx];
    const text = [t.subject ? `SUBJECT: ${t.subject}\n` : "", t.body].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function copyAll() {
    const text = sequence.map(t => {
      const lines = [`── ${t.label} ──`];
      if (t.subject) lines.push(`Subject: ${t.subject}`);
      if (t.body) lines.push(t.body);
      if (t.note) lines.push(`[Tip: ${t.note}]`);
      return lines.join("\n");
    }).join("\n\n");
    navigator.clipboard.writeText(text).then(() => toast({ title: "Full sequence copied!" }));
  }

  const touchMeta = [
    { color: "#60a5fa", icon: Mail },
    { color: "#0ea5e9", icon: Linkedin },
    { color: "#8b5cf6", icon: Mail },
    { color: "#f59e0b", icon: Phone },
    { color: "#ef4444", icon: Mail },
  ];

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Email Sequence Builder</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Generate a full 5-touch outreach sequence (Day 0 → 30) tailored to state regulation, employer type, and industry — ready to copy into your CRM.</div>
      </div>

      {/* Config */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Prospect Name (optional)</div>
            <input value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="e.g. Acme Manufacturing"
              data-testid="input-seq-prospect"
              style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>State</div>
            <select value={stateCode} onChange={e => setStateCode(e.target.value)} data-testid="dropdown-seq-state"
              style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
              {ALL_STATES.map(s => <option key={s.code} value={s.code} style={{ background: "#0d1526" }}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Industry</div>
            <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Manufacturing, Healthcare…"
              data-testid="input-seq-industry"
              style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Client Type</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["self-funded","Self-Funded"],["level-funded","Level-Funded"],["fully-insured","Fully Insured"]].map(([v,l]) => (
                <button key={v} onClick={() => setClientType(v)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: clientType === v ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: clientType === v ? `1px solid rgba(155,28,46,0.4)` : "1px solid rgba(255,255,255,0.07)", color: clientType === v ? "#fff" : "rgba(255,255,255,0.4)" }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Employer Size</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["small","<100"],["mid-market","100–999"],["large","1k–4.9k"],["jumbo","5k+"]].map(([v,l]) => (
                <button key={v} onClick={() => setEmployerSize(v)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: employerSize === v ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: employerSize === v ? `1px solid rgba(155,28,46,0.4)` : "1px solid rgba(255,255,255,0.07)", color: employerSize === v ? "#fff" : "rgba(255,255,255,0.4)" }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <button data-testid="btn-build-sequence" onClick={buildSequence} disabled={generating}
          style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", background: generating ? "rgba(155,28,46,0.15)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${generating ? "rgba(155,28,46,0.15)" : BB_CRIMSON}`, color: generating ? "rgba(255,255,255,0.3)" : "#fff", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {generating ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Building 5-Touch Sequence…</> : <><Zap size={13} /> Build Sequence</>}
        </button>
      </div>

      {/* Sequence output */}
      {sequence.length > 0 && (
        <div>
          {/* Touch selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {sequence.map((t, i) => {
              const m = touchMeta[i] || touchMeta[0];
              const active = activeTouch === i;
              return (
                <button key={i} onClick={() => setActiveTouch(i)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 100, fontSize: 10, fontWeight: 800, cursor: "pointer", background: active ? `${m.color}20` : "rgba(255,255,255,0.03)", border: `1px solid ${active ? m.color + "50" : "rgba(255,255,255,0.08)"}`, color: active ? m.color : "rgba(255,255,255,0.4)" }}>
                  <span style={{ fontSize: 9, fontWeight: 900, background: active ? m.color : "rgba(255,255,255,0.1)", color: active ? "#000" : "rgba(255,255,255,0.4)", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>D{t.day}</span>
                  {t.channel === "email" ? "Email" : t.channel === "linkedin" ? "LinkedIn" : "Call"}
                </button>
              );
            })}
            <button onClick={copyAll} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 100, fontSize: 10, fontWeight: 700, cursor: "pointer", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa" }}>
              <Copy size={11} /> Copy All
            </button>
          </div>

          {/* Active touch card */}
          {(() => {
            const t = sequence[activeTouch];
            const m = touchMeta[activeTouch] || touchMeta[0];
            const MIcon = m.icon;
            return (
              <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${m.color}30`, borderRadius: 14, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${m.color}15`, border: `1px solid ${m.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <MIcon size={13} style={{ color: m.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{t.label}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t.channel}</div>
                    </div>
                  </div>
                  <button onClick={() => copyTouch(activeTouch)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, background: copied === activeTouch ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${copied === activeTouch ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`, color: copied === activeTouch ? "#10b981" : "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    {copied === activeTouch ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                    {copied === activeTouch ? "Copied!" : "Copy"}
                  </button>
                </div>
                {t.subject && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: 3 }}>Subject Line</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{t.subject}</div>
                  </div>
                )}
                {t.body && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: t.note ? 12 : 0 }}>{t.body}</div>
                )}
                {t.note && (
                  <div style={{ marginTop: 12, background: `${m.color}08`, border: `1px solid ${m.color}20`, borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8 }}>
                    <Info size={11} style={{ color: m.color, flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}><strong style={{ color: m.color }}>Coach tip:</strong> {t.note}</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 (new): ROI CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

function ROICalculator({ statesData }: { statesData: { states: StateSummary[] } | undefined }) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState("250");
  const [avgPremiumPPPM, setAvgPremiumPPPM] = useState("650");
  const [stateCode, setStateCode] = useState("CA");
  const [fundingType, setFundingType] = useState("self-funded");
  const [rxSpendPMPM, setRxSpendPMPM] = useState("85");
  const [brokerCompPct, setBrokerCompPct] = useState("5");
  const [roiResult, setRoiResult] = useState<any>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const stateMap = useMemo(() => {
    const m: Record<string, StateSummary> = {};
    statesData?.states.forEach(s => { m[s.code] = s; });
    return m;
  }, [statesData]);

  function calculate() {
    const emp = parseFloat(employees) || 0;
    const prem = parseFloat(avgPremiumPPPM) || 0;
    const rx = parseFloat(rxSpendPMPM) || 0;
    const bkrPct = parseFloat(brokerCompPct) || 0;
    const sd = stateMap[stateCode];

    const annualPremiums = emp * prem * 12;
    const annualRx = emp * rx * 12;

    // Spread pricing savings: 8–22% of premiums depending on state exposure
    const spreadExposurePct = (sd?.spread_prevalence_pct ?? 50) / 100;
    const spreadSavingsPct = fundingType === "self-funded" ? 0.09 * spreadExposurePct + 0.04 : fundingType === "level-funded" ? 0.05 : 0.02;
    const spreadSavings = annualPremiums * spreadSavingsPct;

    // Rebate recapture: ~12–18% of Rx spend often kept by PBM
    const rebateRecapturePct = sd?.scores.pbm_risk >= 7 ? 0.16 : sd?.scores.pbm_risk >= 5 ? 0.12 : 0.09;
    const rebateSavings = annualRx * rebateRecapturePct;

    // Admin fee reduction: ~8–15% of admin fees if currently at P75+
    const adminFeeBase = annualPremiums * 0.12; // rough admin = 12% of premiums
    const adminSavingsPct = sd?.scores.regulatory_strictness >= 7 ? 0.13 : 0.09;
    const adminSavings = adminFeeBase * adminSavingsPct;

    // Broker comp transparency savings (eliminating hidden comp)
    const hiddenBrokerComp = annualPremiums * (bkrPct / 100) * 0.35; // ~35% of broker comp is often hidden

    const totalSavings = spreadSavings + rebateSavings + adminSavings + hiddenBrokerComp;
    const perEmployeeSavings = emp > 0 ? totalSavings / emp : 0;
    const roiMultiple = totalSavings / (annualPremiums * 0.015); // vs ~1.5% advisory fee

    setRoiResult({
      annualPremiums, annualRx, spreadSavings, rebateSavings, adminSavings,
      hiddenBrokerComp, totalSavings, perEmployeeSavings, roiMultiple,
      stateData: sd, employees: emp, stateCode,
    });
    setCalculated(true);
    setAiNarrative(null);
  }

  async function generateNarrative() {
    if (!roiResult) return;
    setAiLoading(true);
    try {
      const sd = roiResult.stateData;
      const prompt = `Write a 3-paragraph CFO-ready business case for switching to a fiduciary benefits advisor. Use these numbers:

Employer: ${employees} employees in ${stateCode}
Total annual premiums: ${fmt$(roiResult.annualPremiums)}
Projected savings breakdown:
- Spread pricing elimination: ${fmt$(roiResult.spreadSavings)} (${((roiResult.spreadSavings / roiResult.annualPremiums) * 100).toFixed(1)}% of premiums)
- Rx rebate recapture: ${fmt$(roiResult.rebateSavings)}
- Admin fee reduction: ${fmt$(roiResult.adminSavings)}
- Hidden broker comp elimination: ${fmt$(roiResult.hiddenBrokerComp)}
Total projected savings: ${fmt$(roiResult.totalSavings)} per year (${fmt$(roiResult.perEmployeeSavings)}/employee)
ROI multiple: ${roiResult.roiMultiple.toFixed(1)}x
State context: ${sd?.name} — regulatory strictness ${sd?.scores.regulatory_strictness?.toFixed(1)}/10, ${sd?.spread_prevalence_pct}% spread pricing prevalence

Paragraph 1: The current cost reality and why status quo is expensive.
Paragraph 2: Specific savings opportunities unique to their state/funding type.
Paragraph 3: The ask — "Here's what we do next" — concrete next step.
Write in first person as the advisor. Be specific, not generic. No bullet lists.`;

      const res = await fetch("/api/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 600, temperature: 0.6 }),
      });
      const json = await res.json();
      setAiNarrative(json.choices?.[0]?.message?.content || json.content || "");
    } catch (err: any) {
      toast({ title: "AI error", description: err.message, variant: "destructive" });
    } finally { setAiLoading(false); }
  }

  function copyROI() {
    if (!roiResult) return;
    const lines = [
      `ROI ANALYSIS — ${roiResult.employees} Employees · ${roiResult.stateCode}`,
      "=".repeat(50),
      `Annual Premiums:          ${fmt$(roiResult.annualPremiums)}`,
      ``,
      `PROJECTED SAVINGS`,
      `Spread Pricing:           ${fmt$(roiResult.spreadSavings)}`,
      `Rx Rebate Recapture:      ${fmt$(roiResult.rebateSavings)}`,
      `Admin Fee Reduction:      ${fmt$(roiResult.adminSavings)}`,
      `Hidden Broker Comp:       ${fmt$(roiResult.hiddenBrokerComp)}`,
      `─────────────────────────────────────────────`,
      `TOTAL ANNUAL SAVINGS:     ${fmt$(roiResult.totalSavings)}`,
      `Per Employee:             ${fmt$(roiResult.perEmployeeSavings)}`,
      `ROI Multiple:             ${roiResult.roiMultiple.toFixed(1)}x`,
      aiNarrative ? `\nBUSINESS CASE\n${aiNarrative}` : "",
    ].filter(l => l !== undefined).join("\n");
    navigator.clipboard.writeText(lines).then(() => toast({ title: "ROI summary copied!" }));
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4 }}>ROI Calculator</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Generate a dollar-value business case for switching to fiduciary benefits advisory — ready to present to a CFO or HR Director.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Inputs */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Plan Inputs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Total Employees on Plan", val: employees, set: setEmployees, placeholder: "250", testid: "input-roi-employees" },
              { label: "Avg Premium PMPM ($)", val: avgPremiumPPPM, set: setAvgPremiumPPPM, placeholder: "650", testid: "input-roi-premium" },
              { label: "Avg Rx Spend PMPM ($)", val: rxSpendPMPM, set: setRxSpendPMPM, placeholder: "85", testid: "input-roi-rx" },
              { label: "Current Broker Comp (% of premium)", val: brokerCompPct, set: setBrokerCompPct, placeholder: "5", testid: "input-roi-broker" },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{f.label}</div>
                <input data-testid={f.testid} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type="number"
                  style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>State</div>
              <select value={stateCode} onChange={e => setStateCode(e.target.value)} data-testid="dropdown-roi-state"
                style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                {ALL_STATES.map(s => <option key={s.code} value={s.code} style={{ background: "#0d1526" }}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Funding Type</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["self-funded","Self-Funded"],["level-funded","Level-Funded"],["fully-insured","Fully Insured"]].map(([v,l]) => (
                  <button key={v} onClick={() => setFundingType(v)}
                    style={{ flex: 1, padding: "7px 4px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: fundingType === v ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: fundingType === v ? `1px solid rgba(155,28,46,0.4)` : "1px solid rgba(255,255,255,0.07)", color: fundingType === v ? "#fff" : "rgba(255,255,255,0.4)" }}>{l}</button>
                ))}
              </div>
            </div>
            <button data-testid="btn-roi-calculate" onClick={calculate}
              style={{ padding: "11px 0", borderRadius: 9, fontSize: 12, fontWeight: 800, background: `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: "#fff", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Calculator size={13} /> Calculate ROI
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!calculated && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 32, textAlign: "center" }}>
              <Calculator size={28} style={{ color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} />
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Fill in the plan details and click Calculate ROI</div>
            </div>
          )}
          {roiResult && (
            <>
              {/* Total savings hero */}
              <div style={{ background: `linear-gradient(135deg,rgba(155,28,46,0.15),rgba(155,28,46,0.05))`, border: "1px solid rgba(155,28,46,0.3)", borderRadius: 14, padding: "20px 22px", textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Projected Annual Savings</div>
                <div style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{fmt$(roiResult.totalSavings)}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{fmt$(roiResult.perEmployeeSavings)} per employee · {roiResult.roiMultiple.toFixed(1)}x ROI</div>
              </div>

              {/* Breakdown */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Savings Breakdown</div>
                {[
                  { label: "Spread Pricing Elimination", val: roiResult.spreadSavings, color: "#f59e0b", pct: roiResult.totalSavings > 0 ? (roiResult.spreadSavings / roiResult.totalSavings) * 100 : 0 },
                  { label: "Rx Rebate Recapture", val: roiResult.rebateSavings, color: "#8b5cf6", pct: roiResult.totalSavings > 0 ? (roiResult.rebateSavings / roiResult.totalSavings) * 100 : 0 },
                  { label: "Admin Fee Reduction", val: roiResult.adminSavings, color: "#ef4444", pct: roiResult.totalSavings > 0 ? (roiResult.adminSavings / roiResult.totalSavings) * 100 : 0 },
                  { label: "Hidden Broker Comp Eliminated", val: roiResult.hiddenBrokerComp, color: "#10b981", pct: roiResult.totalSavings > 0 ? (roiResult.hiddenBrokerComp / roiResult.totalSavings) * 100 : 0 },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: row.color }}>{fmt$(row.val)}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                      <div style={{ width: `${row.pct}%`, height: "100%", background: row.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* AI narrative */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aiNarrative ? 12 : 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)" }}>CFO Business Case Narrative</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {aiNarrative && <button onClick={copyROI} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}><Copy size={10} /> Copy</button>}
                    <button data-testid="btn-roi-narrative" onClick={generateNarrative} disabled={aiLoading}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, background: aiLoading ? "rgba(155,28,46,0.08)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: aiLoading ? "rgba(255,255,255,0.3)" : "#fff", fontSize: 10, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer" }}>
                      {aiLoading ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={10} />}
                      {aiLoading ? "Writing…" : "Write Brief"}
                    </button>
                  </div>
                </div>
                {aiNarrative && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiNarrative}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 (new): DEAL PIPELINE TRACKER
// ─────────────────────────────────────────────────────────────────────────────

type DealStage = "identified" | "contacted" | "discovery" | "proposal" | "won" | "lost";
type Deal = {
  id: string; name: string; state: string; size: string; industry: string;
  fundingType: string; value: number; stage: DealStage;
  nextAction: string; probability: number; notes: string;
  createdAt: string; updatedAt: string;
};

const STAGES: { id: DealStage; label: string; color: string; defaultProb: number }[] = [
  { id: "identified", label: "Identified",  color: "#60a5fa", defaultProb: 10 },
  { id: "contacted",  label: "Contacted",   color: "#a78bfa", defaultProb: 20 },
  { id: "discovery",  label: "Discovery",   color: "#f59e0b", defaultProb: 45 },
  { id: "proposal",   label: "Proposal",    color: "#f97316", defaultProb: 65 },
  { id: "won",        label: "Won",         color: "#10b981", defaultProb: 100 },
  { id: "lost",       label: "Lost",        color: "#6b7280", defaultProb: 0 },
];

function newDeal(partial: Partial<Deal>): Deal {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: "", state: "CA", size: "mid-market", industry: "", fundingType: "self-funded",
    value: 0, stage: "identified", nextAction: "", probability: 10, notes: "",
    createdAt: new Date().toLocaleDateString(), updatedAt: new Date().toLocaleDateString(),
    ...partial,
  };
}

const DEMO_DEALS: Deal[] = [
  newDeal({ name: "Acme Manufacturing", state: "CA", size: "large", industry: "Manufacturing", fundingType: "self-funded", value: 48000, stage: "proposal", probability: 65, nextAction: "Send redlined PBM analysis by Friday" }),
  newDeal({ name: "Greenfield Medical Group", state: "TX", size: "mid-market", industry: "Healthcare", fundingType: "self-funded", value: 22000, stage: "discovery", probability: 40, nextAction: "Discovery call — ask about current broker comp disclosure" }),
  newDeal({ name: "Sunrise Logistics LLC", state: "FL", size: "mid-market", industry: "Transportation", fundingType: "level-funded", value: 18500, stage: "contacted", probability: 20, nextAction: "Follow up on LinkedIn — Day 3 touch" }),
  newDeal({ name: "Pacific Tech Ventures", state: "CA", size: "jumbo", industry: "Technology", fundingType: "self-funded", value: 120000, stage: "identified", probability: 10, nextAction: "Research Form 5500 data before first outreach" }),
  newDeal({ name: "Heartland Foods Co.", state: "IL", size: "large", industry: "Food & Beverage", fundingType: "fully-insured", value: 35000, stage: "won", probability: 100, nextAction: "Onboarding — schedule implementation kickoff" }),
];

function DealPipeline() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>(DEMO_DEALS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingDeal, setAddingDeal] = useState(false);
  const [newDealForm, setNewDealForm] = useState<Partial<Deal>>({});
  const [aiSuggestion, setAiSuggestion] = useState<{ id: string; text: string } | null>(null);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  function updateDeal(id: string, patch: Partial<Deal>) {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...patch, updatedAt: new Date().toLocaleDateString() } : d));
  }
  function deleteDeal(id: string) { setDeals(prev => prev.filter(d => d.id !== id)); }
  function advanceStage(id: string) {
    const d = deals.find(x => x.id === id);
    if (!d) return;
    const order: DealStage[] = ["identified","contacted","discovery","proposal","won"];
    const idx = order.indexOf(d.stage);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      const prob = STAGES.find(s => s.id === next)?.defaultProb ?? d.probability;
      updateDeal(id, { stage: next, probability: prob });
    }
  }

  async function getAISuggestion(deal: Deal) {
    setAiLoadingId(deal.id);
    setAiSuggestion(null);
    try {
      const prompt = `A benefits broker has a deal in their pipeline. Give them ONE specific, actionable next-step recommendation (2-3 sentences max):

Deal: ${deal.name} (${deal.size}, ${deal.industry}, ${deal.state})
Stage: ${deal.stage} | Probability: ${deal.probability}%
Funding type: ${deal.fundingType}
Current next action: "${deal.nextAction}"
Notes: "${deal.notes || "none"}"
Estimated annual value: $${deal.value?.toLocaleString()}

Give a sharp, direct coaching suggestion for what to do next to advance this deal. Reference their specific stage and context.`;

      const res = await fetch("/api/ai/chat", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 200, temperature: 0.6 }),
      });
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content || json.content || "";
      setAiSuggestion({ id: deal.id, text });
    } catch (err: any) {
      toast({ title: "AI error", description: err.message, variant: "destructive" });
    } finally { setAiLoadingId(null); }
  }

  const totalPipelineValue = deals.filter(d => d.stage !== "lost").reduce((s, d) => s + (d.value || 0), 0);
  const weightedValue = deals.filter(d => d.stage !== "lost").reduce((s, d) => s + (d.value || 0) * (d.probability / 100), 0);
  const wonValue = deals.filter(d => d.stage === "won").reduce((s, d) => s + (d.value || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== "won" && d.stage !== "lost").length;

  return (
    <div>
      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Pipeline Value", value: fmt$(totalPipelineValue), color: "#60a5fa" },
          { label: "Weighted Value", value: fmt$(weightedValue), color: "#8b5cf6" },
          { label: "Won (YTD)", value: fmt$(wonValue), color: "#10b981" },
          { label: "Active Deals", value: activeDeals.toString(), color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 11, padding: "12px 14px" }}>
            <div style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: s.color, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: 3 }}>
          {[["kanban","Kanban"],["list","List"]].map(([v,l]) => (
            <button key={v} onClick={() => setViewMode(v as any)}
              style={{ padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", background: viewMode === v ? "rgba(255,255,255,0.1)" : "none", border: "none", color: viewMode === v ? "#fff" : "rgba(255,255,255,0.35)" }}>{l}</button>
          ))}
        </div>
        <button data-testid="btn-add-deal" onClick={() => { setNewDealForm({}); setAddingDeal(true); }}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={12} /> Add Deal
        </button>
      </div>

      {/* Add deal form */}
      {addingDeal && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(155,28,46,0.3)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[
              { label: "Company Name", key: "name", placeholder: "Acme Corp" },
              { label: "Industry", key: "industry", placeholder: "Manufacturing" },
              { label: "Annual Value ($)", key: "value", placeholder: "25000", type: "number" },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{f.label}</div>
                <input type={f.type || "text"} placeholder={f.placeholder}
                  value={(newDealForm as any)[f.key] || ""}
                  onChange={e => setNewDealForm(p => ({ ...p, [f.key]: f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
                  style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Next Action</div>
              <input placeholder="e.g. Send intro email" value={newDealForm.nextAction || ""}
                onChange={e => setNewDealForm(p => ({ ...p, nextAction: e.target.value }))}
                style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>State</div>
              <select value={newDealForm.state || "CA"} onChange={e => setNewDealForm(p => ({ ...p, state: e.target.value }))}
                style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box", cursor: "pointer" }}>
                {ALL_STATES.map(s => <option key={s.code} value={s.code} style={{ background: "#0d1526" }}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { if (newDealForm.name) { setDeals(p => [...p, newDeal(newDealForm)]); setAddingDeal(false); } }}
              style={{ padding: "8px 18px", borderRadius: 8, background: `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Add to Pipeline</button>
            <button onClick={() => setAddingDeal(false)}
              style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, overflowX: "auto" }}>
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id);
            const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
            return (
              <div key={stage.id} style={{ minWidth: 160 }}>
                {/* Column header */}
                <div style={{ background: `${stage.color}10`, border: `1px solid ${stage.color}25`, borderRadius: "10px 10px 0 0", padding: "8px 10px", marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: stage.color, letterSpacing: "0.06em" }}>{stage.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{stageDeals.length} deal{stageDeals.length !== 1 ? "s" : ""} · {fmt$(stageValue)}</div>
                </div>
                {/* Deal cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {stageDeals.map(deal => (
                    <div key={deal.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${stage.color}20`, borderRadius: 10, padding: "10px 10px 8px" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", marginBottom: 3, lineHeight: 1.3 }}>{deal.name}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>{deal.state} · {deal.size}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: stage.color }}>{fmt$(deal.value)}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>{deal.probability}%</span>
                      </div>
                      {deal.nextAction && (
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.03)", borderRadius: 5, padding: "4px 6px", marginBottom: 6, lineHeight: 1.4 }}>
                          → {deal.nextAction.length > 50 ? deal.nextAction.slice(0, 50) + "…" : deal.nextAction}
                        </div>
                      )}
                      {aiSuggestion?.id === deal.id && (
                        <div style={{ fontSize: 9, color: "#a78bfa", background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, padding: "5px 7px", marginBottom: 6, lineHeight: 1.4 }}>
                          <Brain size={8} style={{ display: "inline", marginRight: 4 }} />{aiSuggestion.text}
                        </div>
                      )}
                      {/* Actions */}
                      <div style={{ display: "flex", gap: 4 }}>
                        {stage.id !== "won" && stage.id !== "lost" && (
                          <button onClick={() => advanceStage(deal.id)} title="Advance stage"
                            style={{ flex: 1, padding: "4px 0", borderRadius: 5, background: `${stage.color}15`, border: `1px solid ${stage.color}30`, color: stage.color, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                            <ArrowRight size={9} style={{ display: "inline", marginRight: 2 }} />Next
                          </button>
                        )}
                        <button onClick={() => getAISuggestion(deal)} title="AI next step" disabled={aiLoadingId === deal.id}
                          style={{ padding: "4px 6px", borderRadius: 5, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", fontSize: 9, cursor: "pointer" }}>
                          {aiLoadingId === deal.id ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={9} />}
                        </button>
                        <button onClick={() => deleteDeal(deal.id)} title="Remove"
                          style={{ padding: "4px 6px", borderRadius: 5, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>
                          <X size={9} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Company","Stage","Value","Prob.","Next Action",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const stage = STAGES.find(s => s.id === deal.stage)!;
                return (
                  <tr key={deal.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{deal.name}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{deal.state} · {deal.industry}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 100, background: `${stage.color}15`, border: `1px solid ${stage.color}30`, color: stage.color }}>{stage.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 800, color: "#fff" }}>{fmt$(deal.value)}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                          <div style={{ width: `${deal.probability}%`, height: "100%", background: stage.color, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: stage.color }}>{deal.probability}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 10, color: "rgba(255,255,255,0.5)", maxWidth: 220 }}>{deal.nextAction || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {deal.stage !== "won" && deal.stage !== "lost" && (
                          <button onClick={() => advanceStage(deal.id)}
                            style={{ padding: "4px 8px", borderRadius: 6, background: `${stage.color}15`, border: `1px solid ${stage.color}30`, color: stage.color, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                            <ArrowRight size={9} style={{ display: "inline" }} />
                          </button>
                        )}
                        <button onClick={() => getAISuggestion(deal)} disabled={aiLoadingId === deal.id}
                          style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa", fontSize: 9, cursor: "pointer" }}>
                          {aiLoadingId === deal.id ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={9} />}
                        </button>
                        <button onClick={() => deleteDeal(deal.id)}
                          style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 9, cursor: "pointer" }}>
                          <Trash2 size={9} />
                        </button>
                      </div>
                      {aiSuggestion?.id === deal.id && (
                        <div style={{ marginTop: 4, fontSize: 9, color: "#a78bfa", background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6, padding: "4px 8px", lineHeight: 1.4 }}>
                          {aiSuggestion.text}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "filings",    label: "Filing Intelligence",   icon: Gauge },
  { id: "map",        label: "Intelligence Map",      icon: Map },
  { id: "compare",    label: "Multi-State Compare",   icon: BarChart3 },
  { id: "qualifier",  label: "Account Qualifier",     icon: Users },
  { id: "angle",      label: "Sales Angle Generator", icon: Zap },
  { id: "alerts",     label: "Compliance Alerts",     icon: AlertTriangle },
  { id: "deepdive",   label: "Prospect Deep Dive",    icon: Search },
  { id: "sequence",   label: "Email Sequence",        icon: Mail },
  { id: "roi",        label: "ROI Calculator",        icon: Calculator },
  { id: "pipeline",   label: "Deal Pipeline",         icon: Kanban },
];

const QUICK_COMPARE = ["CA", "TX", "NY", "FL"];

const FUNDING_TYPES = [
  { id: "all",          label: "All Types" },
  { id: "self-funded",  label: "Self-Funded" },
  { id: "level-funded", label: "Level-Funded" },
  { id: "fully-insured",label: "Fully Insured" },
];

const PRIORITY_FILTERS = [
  { id: "all",      label: "All Tiers" },
  { id: "priority", label: "Priority Only" },
  { id: "high",     label: "High+" },
  { id: "standard", label: "Standard" },
];

const REGION_FILTERS = [
  { id: "all",       label: "All Regions" },
  { id: "northeast", label: "Northeast" },
  { id: "southeast", label: "Southeast" },
  { id: "midwest",   label: "Midwest" },
  { id: "south",     label: "South" },
  { id: "west",      label: "West" },
];

const SORT_OPTIONS = [
  { id: "strictness", label: "Reg. Strictness" },
  { id: "pbm_risk",   label: "PBM Risk" },
  { id: "spread",     label: "Spread Pricing %" },
  { id: "alerts",     label: "Alert Count" },
];

const NORTHEAST_STATES = ["CT","ME","MA","NH","NJ","NY","PA","RI","VT","DC","DE","MD"];
const SOUTHEAST_STATES  = ["AL","AR","FL","GA","KY","LA","MS","NC","SC","TN","VA","WV"];
const MIDWEST_STATES    = ["IL","IN","IA","KS","MI","MN","MO","NE","ND","OH","SD","WI"];
const SOUTH_STATES      = ["TX","OK","AZ","NM","CO"];
const WEST_STATES       = ["AK","CA","HI","ID","MT","NV","OR","UT","WA","WY"];

export default function SalesIQModule() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && TABS.some(tab => tab.id === t)) return t;
    }
    return "map";
  });
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [compareSet, setCompareSet] = useState<string[]>(QUICK_COMPARE);

  // Prospect filters
  const [fundingType, setFundingType]       = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [regionFilter, setRegionFilter]     = useState("all");
  const [sortBy, setSortBy]                 = useState("strictness");

  // Account Qualifier
  const [accounts, setAccounts]         = useState<QualAccount[]>([]);
  const [qualForm, setQualForm]         = useState({ name: "", state: "CA", fundingType: "self-funded", size: "mid-market", industry: "" });
  const [qualThreshold, setQualThreshold] = useState(60);
  const [qualFundingFilter, setQualFundingFilter] = useState("all");
  const [qualRun, setQualRun]           = useState(false);
  const [pasteText, setPasteText]       = useState("");
  const [showPaste, setShowPaste]       = useState(false);

  // Quick Qualify wizard
  const [qualMode, setQualMode]           = useState<"quick" | "batch">("quick");
  const [qqName, setQqName]               = useState("");
  const [qqState, setQqState]             = useState("CA");
  const [qqAnswers, setQqAnswers]         = useState<Record<string, string>>({});
  const [qqAiAngle, setQqAiAngle]         = useState<string | null>(null);
  const [qqAiLoading, setQqAiLoading]     = useState(false);

  const { data: statesData, isLoading: statesLoading } = useQuery<{ states: StateSummary[] }>({
    queryKey: ["/api/sales-iq/states"],
  });

  const { data: selectedStateDetail, isLoading: detailLoading } = useQuery<StateDetail>({
    queryKey: ["/api/sales-iq/states", selectedStateCode],
    enabled: !!selectedStateCode,
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<{ alerts: Alert[] }>({
    queryKey: ["/api/sales-iq/alerts"],
  });

  const compareMutation = useMutation<any, Error, string[]>({
    mutationFn: async (codes) => {
      const resp = await fetch("/api/sales-iq/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_codes: codes }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || "Failed"); }
      return resp.json();
    },
    onError: (e) => toast({ title: "Compare failed", description: e.message, variant: "destructive" }),
  });

  // Restore full view-state from a short share link (?tab/state/compare/funding/...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && TABS.some(t => t.id === tabParam)) setActiveTab(tabParam);
    const stateParam = params.get("state");
    if (stateParam) setSelectedStateCode(stateParam.toUpperCase());
    const compareParam = params.get("compare");
    if (compareParam) {
      const codes = compareParam.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
      if (codes.length) setCompareSet(codes);
    }
    const fundingParam = params.get("funding");
    if (fundingParam && FUNDING_TYPES.some(f => f.id === fundingParam)) setFundingType(fundingParam);
    const priorityParam = params.get("priority");
    if (priorityParam && PRIORITY_FILTERS.some(p => p.id === priorityParam)) setPriorityFilter(priorityParam);
    const regionParam = params.get("region");
    if (regionParam && REGION_FILTERS.some(r => r.id === regionParam)) setRegionFilter(regionParam);
    const sortParam = params.get("sort");
    if (sortParam && SORT_OPTIONS.some(s => s.id === sortParam)) setSortBy(sortParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialize the Sales IQ Console view-state for short share links.
  function getShareState(): Record<string, any> {
    const state: Record<string, any> = { tab: activeTab };
    if (selectedStateCode) state.state = selectedStateCode;
    if (compareSet.length) state.compare = compareSet.join(",");
    if (fundingType !== "all") state.funding = fundingType;
    if (priorityFilter !== "all") state.priority = priorityFilter;
    if (regionFilter !== "all") state.region = regionFilter;
    if (sortBy !== "strictness") state.sort = sortBy;
    return state;
  }

  const stateMap = useMemo(() => {
    const m: Record<string, StateSummary> = {};
    statesData?.states.forEach(s => { m[s.code] = s; });
    return m;
  }, [statesData]);

  const compareStates = useMemo(() =>
    compareSet.map(c => stateMap[c]).filter(Boolean),
    [compareSet, stateMap]
  );

  // Filtered + sorted prospect state list
  const filteredStates = useMemo(() => {
    if (!statesData?.states) return [];
    let list = [...statesData.states];

    // Funding type filter
    if (fundingType === "self-funded")   list = list.filter(s => s.spread_prevalence_pct >= 50);
    if (fundingType === "level-funded")  list = list.filter(s => s.spread_prevalence_pct >= 30 && s.spread_prevalence_pct < 60);
    if (fundingType === "fully-insured") list = list.filter(s => s.passthrough_prevalence_pct >= 50);

    // Priority filter
    if (priorityFilter === "priority") list = list.filter(s => s.priority === "PRIORITY");
    if (priorityFilter === "high")     list = list.filter(s => s.priority === "PRIORITY" || s.priority === "HIGH");
    if (priorityFilter === "standard") list = list.filter(s => s.priority !== "PRIORITY" && s.priority !== "HIGH");

    // Region filter
    if (regionFilter === "northeast") list = list.filter(s => NORTHEAST_STATES.includes(s.code));
    if (regionFilter === "southeast") list = list.filter(s => SOUTHEAST_STATES.includes(s.code));
    if (regionFilter === "midwest")   list = list.filter(s => MIDWEST_STATES.includes(s.code));
    if (regionFilter === "south")     list = list.filter(s => SOUTH_STATES.includes(s.code));
    if (regionFilter === "west")      list = list.filter(s => WEST_STATES.includes(s.code));

    // Sort
    list.sort((a, b) => {
      if (sortBy === "strictness") return b.scores.regulatory_strictness - a.scores.regulatory_strictness;
      if (sortBy === "pbm_risk")   return b.scores.pbm_risk - a.scores.pbm_risk;
      if (sortBy === "spread")     return b.spread_prevalence_pct - a.spread_prevalence_pct;
      if (sortBy === "alerts")     return b.alert_count - a.alert_count;
      return 0;
    });

    return list;
  }, [statesData, fundingType, priorityFilter, regionFilter, sortBy]);

  const activeFilterCount = [
    fundingType !== "all", priorityFilter !== "all", regionFilter !== "all",
  ].filter(Boolean).length;

  // Account Qualifier — score each account against Sales IQ state data
  const qualResults = useMemo<QualResult[]>(() => {
    if (!qualRun || accounts.length === 0) return [];
    return accounts.map(acc => {
      const sd = stateMap[acc.state];
      const signals: string[] = [];
      let score = 0;

      if (sd) {
        // Regulatory strictness (0–10 → 0–25 pts)
        const strictPts = (sd.scores.regulatory_strictness / 10) * 25;
        score += strictPts;
        if (sd.scores.regulatory_strictness >= 7) signals.push(`High reg. strictness (${sd.scores.regulatory_strictness.toFixed(1)})`);

        // PBM risk (0–10 → 0–25 pts)
        const pbmPts = (sd.scores.pbm_risk / 10) * 25;
        score += pbmPts;
        if (sd.scores.pbm_risk >= 7) signals.push(`Elevated PBM risk (${sd.scores.pbm_risk.toFixed(1)})`);

        // Spread prevalence (0–100% → 0–20 pts)
        const spreadPts = (sd.spread_prevalence_pct / 100) * 20;
        score += spreadPts;
        if (sd.spread_prevalence_pct >= 55) signals.push(`High spread pricing (${sd.spread_prevalence_pct}%)`);

        // Alert count (each alert adds 4 pts, max 12)
        const alertPts = Math.min(sd.alert_count * 4, 12);
        score += alertPts;
        if (sd.alert_count > 0) signals.push(`${sd.alert_count} active compliance alert${sd.alert_count > 1 ? "s" : ""}`);

        // Priority bonus
        if (sd.priority === "PRIORITY") { score += 10; signals.push("Priority state (CA)"); }
        else if (sd.priority === "HIGH") { score += 5; signals.push("High-priority state"); }
      } else {
        score = 45; // no data → neutral
      }

      // Funding type multiplier
      if (acc.fundingType === "self-funded" && (sd?.spread_prevalence_pct ?? 0) >= 50) {
        score = Math.min(score * 1.1, 100);
        signals.push("Self-funded × high spread = strong wedge");
      }
      if (acc.fundingType === "level-funded") { score = Math.min(score * 1.05, 100); }

      // Employer size signal
      if (acc.size === "jumbo" || acc.size === "large") signals.push("Large employer — high impact");

      score = Math.round(Math.min(score, 100));
      const status: QualStatus = score >= qualThreshold ? "qualified" : score >= qualThreshold - 15 ? "watch" : "not-qualified";

      return { ...acc, score, status, signals, stateData: sd };
    }).sort((a, b) => b.score - a.score);
  }, [qualRun, accounts, stateMap, qualThreshold]);

  function addAccount() {
    if (!qualForm.name.trim()) return;
    setAccounts(prev => [...prev, { ...qualForm, id: Date.now().toString() }]);
    setQualForm(f => ({ ...f, name: "", industry: "" }));
    setQualRun(false);
  }

  function removeAccount(id: string) {
    setAccounts(prev => prev.filter(a => a.id !== id));
    setQualRun(false);
  }

  function parsePaste() {
    const lines = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
    const newAccounts: QualAccount[] = lines.map(name => ({
      id: Date.now().toString() + Math.random(),
      name,
      state: qualForm.state,
      fundingType: qualForm.fundingType,
      size: qualForm.size,
      industry: qualForm.industry,
    }));
    setAccounts(prev => [...prev, ...newAccounts]);
    setPasteText("");
    setShowPaste(false);
    setQualRun(false);
  }

  function handleStateClick(geo: any) {
    const fips = geo.id as string;
    const code = FIPS_TO_STATE[fips];
    if (code) {
      setSelectedStateCode(code);
      setActiveTab("map");
    }
  }

  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#060b18 0%,#080d1e 50%,#060a16 100%)", padding: "24px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 100, padding: "4px 14px", marginBottom: 12 }}>
              <Target size={11} color={BB_CRIMSON} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Kincaid IQ · Sales IQ Intelligence Module</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "0 0 5px", letterSpacing: "-0.02em" }}>Multi-State Regulatory Intelligence</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, maxWidth: 600 }}>
              50-state PBM regulatory framework · Transparency & risk scoring · Sales Angle Generator · California priority enforcement
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <ShareMenu
              page="sales-iq"
              getState={getShareState}
              getTitle={() => {
                const tabLabel = TABS.find(t => t.id === activeTab)?.label || "Sales IQ";
                return selectedStateCode ? `${tabLabel} · ${selectedStateCode}` : tabLabel;
              }}
              accent={BB_CRIMSON}
              testIdPrefix="share-sales-iq"
            />
          </div>
        </div>

        {/* Summary stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "States Tracked", value: "50", color: "#60a5fa", icon: <Map size={14} color="#60a5fa" /> },
            { label: "Priority State", value: "CA", color: BB_CRIMSON, icon: <Star size={14} color={BB_CRIMSON} /> },
            { label: "High Priority States", value: statesData?.high_priority?.length?.toString() || "—", color: "#f59e0b", icon: <AlertTriangle size={14} color="#f59e0b" /> },
            { label: "Active Alerts", value: alertsData?.alerts?.length?.toString() || "—", color: "#ef4444", icon: <AlertOctagon size={14} color="#ef4444" /> },
          ].map(s => (
            <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 11, padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                {s.icon}
                <span style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", background: "none", border: "none", borderBottom: active ? `2px solid ${BB_CRIMSON}` : "2px solid transparent", color: active ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em", marginBottom: -1 }}>
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab: Intelligence Map ── */}
        {activeTab === "map" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedStateCode ? "1fr 380px" : "1fr", gap: 18, alignItems: "start" }}>
            {/* Map + legend */}
            <div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Click any state · or use the dropdown
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Map size={12} color="rgba(255,255,255,0.3)" />
                    <select
                      data-testid="dropdown-map-state"
                      value={selectedStateCode || ""}
                      onChange={e => setSelectedStateCode(e.target.value || null)}
                      style={{ background: "#0d1526", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 12px", color: selectedStateCode ? "#fff" : "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, outline: "none", cursor: "pointer", minWidth: 200 }}
                    >
                      <option value="" style={{ background: "#0d1526", color: "rgba(255,255,255,0.5)" }}>— Select a State —</option>
                      {ALL_STATES.map(s => (
                        <option key={s.code} value={s.code} style={{ background: "#0d1526", color: "#fff" }}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                    {selectedStateCode && (
                      <button
                        data-testid="btn-clear-map-state"
                        onClick={() => setSelectedStateCode(null)}
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "5px 8px", color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <X size={11} /> Clear
                      </button>
                    )}
                  </div>
                </div>
                {statesLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                ) : (
                  <ComposableMap projection="geoAlbersUsa" style={{ width: "100%", height: "auto" }}>
                    <Geographies geography={GEO_URL}>
                      {({ geographies }) =>
                        geographies.map(geo => {
                          const fips = geo.id as string;
                          const code = FIPS_TO_STATE[fips];
                          const stateInfo = code ? stateMap[code] : undefined;
                          const isSelected = code === selectedStateCode;
                          const fill = mapFillColor(stateInfo);
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              onClick={() => handleStateClick(geo)}
                              style={{
                                default: { fill: isSelected ? "#fff" : fill, stroke: "#0a0f1c", strokeWidth: 0.7, outline: "none" },
                                hover: { fill: isSelected ? "#fff" : `${fill}cc`, stroke: "#fff", strokeWidth: 1, outline: "none", cursor: "pointer" },
                                pressed: { fill: "#fff", outline: "none" },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ComposableMap>
                )}
                <MapLegend />
              </div>

              {/* ── Prospect Filter Bar ── */}
              {!selectedStateCode && statesData && (
                <div style={{ marginTop: 16 }}>
                  {/* Filter controls */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Target size={13} color={BB_CRIMSON} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Prospect Filters</span>
                      {activeFilterCount > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 900, padding: "2px 8px", borderRadius: 100, background: `${BB_CRIMSON}25`, border: `1px solid ${BB_CRIMSON}50`, color: BB_CRIMSON }}>
                          {activeFilterCount} active
                        </span>
                      )}
                      {activeFilterCount > 0 && (
                        <button data-testid="btn-clear-filters"
                          onClick={() => { setFundingType("all"); setPriorityFilter("all"); setRegionFilter("all"); setSortBy("strictness"); }}
                          style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                          Clear all
                        </button>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                      {/* Funding Type */}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Prospect Type</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {FUNDING_TYPES.map(f => (
                            <button key={f.id} data-testid={`filter-funding-${f.id}`}
                              onClick={() => setFundingType(f.id)}
                              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "left", background: fundingType === f.id ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: fundingType === f.id ? `1px solid rgba(155,28,46,0.5)` : "1px solid rgba(255,255,255,0.06)", color: fundingType === f.id ? "#fff" : "rgba(255,255,255,0.4)" }}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Priority Tier */}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Priority Tier</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {PRIORITY_FILTERS.map(p => (
                            <button key={p.id} data-testid={`filter-priority-${p.id}`}
                              onClick={() => setPriorityFilter(p.id)}
                              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "left", background: priorityFilter === p.id ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: priorityFilter === p.id ? `1px solid rgba(155,28,46,0.5)` : "1px solid rgba(255,255,255,0.06)", color: priorityFilter === p.id ? "#fff" : "rgba(255,255,255,0.4)" }}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Region */}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Region</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {REGION_FILTERS.map(r => (
                            <button key={r.id} data-testid={`filter-region-${r.id}`}
                              onClick={() => setRegionFilter(r.id)}
                              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "left", background: regionFilter === r.id ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.03)", border: regionFilter === r.id ? `1px solid rgba(155,28,46,0.5)` : "1px solid rgba(255,255,255,0.06)", color: regionFilter === r.id ? "#fff" : "rgba(255,255,255,0.4)" }}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sort By */}
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Sort By</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {SORT_OPTIONS.map(o => (
                            <button key={o.id} data-testid={`filter-sort-${o.id}`}
                              onClick={() => setSortBy(o.id)}
                              style={{ padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", textAlign: "left", background: sortBy === o.id ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.03)", border: sortBy === o.id ? `1px solid rgba(96,165,250,0.4)` : "1px solid rgba(255,255,255,0.06)", color: sortBy === o.id ? "#60a5fa" : "rgba(255,255,255,0.4)" }}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results count + grid */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
                      {filteredStates.length} state{filteredStates.length !== 1 ? "s" : ""} match
                      {activeFilterCount > 0 ? "ing your filters" : " · click to explore"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                    {filteredStates.map(s => {
                      const isPriority = s.priority === "PRIORITY";
                      const isHigh = s.priority === "HIGH";
                      const primaryVal = sortBy === "strictness" ? s.scores.regulatory_strictness
                        : sortBy === "pbm_risk" ? s.scores.pbm_risk
                        : sortBy === "spread"   ? s.spread_prevalence_pct
                        : s.alert_count;
                      const primaryLabel = sortBy === "strictness" ? "Strictness"
                        : sortBy === "pbm_risk" ? "PBM Risk"
                        : sortBy === "spread"   ? "Spread %"
                        : "Alerts";
                      const primaryColor = sortBy === "spread"
                        ? (s.spread_prevalence_pct >= 55 ? "#ef4444" : "#f59e0b")
                        : sortBy === "alerts"
                        ? (s.alert_count >= 3 ? "#ef4444" : "#f59e0b")
                        : scoreColor(primaryVal as number);
                      return (
                        <button key={s.code} data-testid={`state-card-${s.code}`}
                          onClick={() => setSelectedStateCode(s.code)}
                          style={{ background: isPriority ? "rgba(155,28,46,0.06)" : "rgba(255,255,255,0.03)", border: isPriority ? `1px solid rgba(155,28,46,0.35)` : isHigh ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: isPriority ? BB_CRIMSON : isHigh ? "#f59e0b" : "#fff" }}>{s.code}</span>
                            {isPriority && <Star size={10} color={BB_CRIMSON} />}
                            {!isPriority && isHigh && <AlertTriangle size={9} color="#f59e0b" />}
                          </div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginBottom: 3 }}>{primaryLabel}</div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: primaryColor }}>
                            {typeof primaryVal === "number" && !Number.isInteger(primaryVal) ? primaryVal.toFixed(1) : primaryVal}
                            {sortBy === "spread" ? "%" : ""}
                          </div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                            {s.dominant_pbm_model}
                          </div>
                        </button>
                      );
                    })}
                    {filteredStates.length === 0 && (
                      <div style={{ gridColumn: "1 / -1", padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
                        No states match the selected filters — try broadening your criteria.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* State detail panel */}
            {selectedStateCode && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20, maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
                {detailLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                    <Loader2 size={24} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
                  </div>
                ) : selectedStateDetail ? (
                  <StateDetailPanel state={selectedStateDetail} onClose={() => setSelectedStateCode(null)} />
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Multi-State Compare ── */}
        {activeTab === "compare" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* State grid picker */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Select States (max 6)</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                    <span style={{ color: BB_CRIMSON }}>■</span> Priority · <span style={{ color: "#f59e0b" }}>■</span> High · Click to toggle
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>{compareSet.length}/6 selected</span>
                  <button data-testid="btn-compare-run" onClick={() => compareMutation.mutate(compareSet)} disabled={compareMutation.isPending || compareSet.length < 2}
                    style={{ padding: "8px 16px", borderRadius: 8, background: compareSet.length < 2 ? "rgba(155,28,46,0.1)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${compareSet.length < 2 ? "rgba(155,28,46,0.2)" : BB_CRIMSON}`, color: compareSet.length < 2 ? "rgba(255,255,255,0.25)" : "#fff", fontSize: 11, fontWeight: 800, cursor: compareSet.length < 2 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    {compareMutation.isPending ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <BarChart3 size={12} />}
                    Compare
                  </button>
                </div>
              </div>
              {/* 50-state chip grid */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {ALL_STATES.map(({ code }) => {
                  const s = stateMap[code];
                  const isPriority = s?.priority === "PRIORITY";
                  const isHigh = s?.priority === "HIGH";
                  const isSelected = compareSet.includes(code);
                  const isMaxed = compareSet.length >= 6 && !isSelected;
                  let bgColor = isSelected
                    ? (isPriority ? BB_CRIMSON : isHigh ? "#c2410c" : "#1d4ed8")
                    : (isPriority ? "rgba(155,28,46,0.18)" : isHigh ? "rgba(194,65,12,0.15)" : "rgba(255,255,255,0.04)");
                  let borderColor = isSelected
                    ? (isPriority ? BB_CRIMSON : isHigh ? "#c2410c" : "#3b82f6")
                    : (isPriority ? "rgba(155,28,46,0.45)" : isHigh ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)");
                  let textColor = isSelected ? "#fff" : (isPriority ? BB_CRIMSON : isHigh ? "#f59e0b" : "rgba(255,255,255,0.45)");
                  return (
                    <button key={code} data-testid={`chip-compare-${code}`}
                      onClick={() => {
                        if (isSelected) setCompareSet(compareSet.filter(c => c !== code));
                        else if (!isMaxed) setCompareSet([...compareSet, code]);
                      }}
                      disabled={isMaxed}
                      title={ALL_STATES.find(s => s.code === code)?.name}
                      style={{ padding: "5px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: isMaxed ? "not-allowed" : "pointer", background: bgColor, border: `1px solid ${borderColor}`, color: textColor, opacity: isMaxed ? 0.35 : 1, letterSpacing: "0.04em", minWidth: 36, textAlign: "center" }}>
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick compare presets */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "CA vs TX vs FL", states: ["CA", "TX", "FL"] },
                { label: "Northeast Corridor", states: ["NY", "NJ", "MA", "CT"] },
                { label: "Sunbelt", states: ["TX", "FL", "GA", "AZ"] },
                { label: "Big 4", states: ["CA", "TX", "NY", "FL"] },
              ].map(preset => (
                <button key={preset.label} onClick={() => { setCompareSet(preset.states); compareMutation.mutate(preset.states); }}
                  style={{ padding: "6px 12px", borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Comparison table */}
            {compareStates.length >= 2 && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Multi-State Intelligence Comparison</div>
                </div>
                <div style={{ padding: 18 }}>
                  <ComparisonTable states={compareStates} />
                </div>

                {compareMutation.data && (
                  <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Strictest Regulation", value: compareMutation.data.comparison.strictest, color: "#ef4444" },
                        { label: "Most Spread Pricing", value: compareMutation.data.comparison.most_spread, color: "#f59e0b" },
                        { label: "Best Sales Opportunity", value: compareMutation.data.comparison.best_opportunity, color: "#10b981" },
                      ].map(s => (
                        <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Account Qualifier ── */}
        {activeTab === "qualifier" && (() => {
          // ── Quick Qualify scoring constants ──────────────────────────────
          const QQ_QUESTIONS = [
            {
              id: "size", label: "How many lives are on the plan?",
              icon: "👥",
              options: [
                { id: "under-50",    label: "Under 50",   pts: 2  },
                { id: "50-99",       label: "50–99",      pts: 8  },
                { id: "100-499",     label: "100–499",    pts: 15 },
                { id: "500-plus",    label: "500+",       pts: 20 },
              ],
            },
            {
              id: "funding", label: "What is their current funding arrangement?",
              icon: "💰",
              options: [
                { id: "fully-insured",  label: "Fully Insured",   pts: 3  },
                { id: "level-funded",   label: "Level-Funded",    pts: 12 },
                { id: "self-funded",    label: "Self-Funded",     pts: 22 },
                { id: "unknown",        label: "Unknown",         pts: 7  },
              ],
            },
            {
              id: "renewal", label: "When is their plan renewal?",
              icon: "📅",
              options: [
                { id: "over-6mo",   label: "6+ months out",   pts: 3  },
                { id: "3-to-6mo",   label: "3–6 months",      pts: 11 },
                { id: "under-90d",  label: "Under 90 days",   pts: 20 },
                { id: "unknown",    label: "Unknown",         pts: 7  },
              ],
            },
            {
              id: "broker", label: "What's their current broker comp situation?",
              icon: "🤝",
              options: [
                { id: "has-independent",    label: "Already has fee-only advisor",    pts: 0  },
                { id: "claims-transparent", label: "Claims transparency — unverified", pts: 10 },
                { id: "never-asked",        label: "Never been asked / doesn't know", pts: 22 },
              ],
            },
            {
              id: "pain", label: "What pain signals have you detected?",
              icon: "⚠️",
              options: [
                { id: "no-pain",       label: "No known pain",           pts: 0  },
                { id: "costs-rising",  label: "Costs rising year-over-year", pts: 5 },
                { id: "caa-exposure",  label: "CAA / compliance exposure", pts: 7 },
                { id: "multiple",      label: "Multiple pain signals",    pts: 10 },
              ],
            },
            {
              id: "access", label: "What is your current decision-maker access?",
              icon: "🎯",
              options: [
                { id: "no-access",   label: "No access yet",             pts: 0 },
                { id: "gatekeeper",  label: "Working through gatekeeper", pts: 3 },
                { id: "direct",      label: "Direct to CFO / HR Director", pts: 6 },
              ],
            },
          ] as const;

          const qqScore = Object.entries(qqAnswers).reduce((sum, [qId, aId]) => {
            const q = QQ_QUESTIONS.find(x => x.id === qId);
            const opt = (q?.options as readonly { id: string; pts: number }[])?.find(o => o.id === aId);
            return sum + (opt?.pts ?? 0);
          }, 0);
          const qqAnswered = Object.keys(qqAnswers).length;
          const qqComplete = qqAnswered === QQ_QUESTIONS.length;
          const qqVerdict = qqScore >= 65 ? "qualified" : qqScore >= 45 ? "watch" : "not-qualified";
          const qqVerdictColor = qqVerdict === "qualified" ? "#10b981" : qqVerdict === "watch" ? "#f59e0b" : "#ef4444";
          const qqVerdictLabel = qqVerdict === "qualified" ? "Qualified" : qqVerdict === "watch" ? "Watch List" : "Not Qualified";

          const qqStateData = stateMap[qqState];

          async function runQqAi() {
            setQqAiLoading(true);
            setQqAiAngle(null);
            try {
              const answers = QQ_QUESTIONS.map(q => {
                const opt = (q.options as readonly { id: string; pts: number; label: string }[]).find(o => o.id === qqAnswers[q.id]);
                return `${q.label}: ${opt?.label ?? "N/A"}`;
              }).join("\n");
              const sd = qqStateData;
              const prompt = `A fiduciary benefits broker is qualifying a prospect. Here is what they know:

Prospect: ${qqName || "Unknown company"}
State: ${qqState}${sd ? ` (Reg. strictness: ${sd.scores.regulatory_strictness.toFixed(1)}/10, Spread pricing: ${sd.spread_prevalence_pct}%, PBM risk: ${sd.scores.pbm_risk.toFixed(1)}/10, ${sd.alert_count} active alerts)` : ""}

Qualification answers:
${answers}

Qualification score: ${qqScore}/100 — ${qqVerdictLabel}

Write a 3-sentence opening angle / first message strategy for this specific prospect. Be direct, reference their specific signals, and give the broker one concrete thing to say or ask that will open the conversation. No generic insurance pitch.`;

              const res = await fetch("/api/ai/chat", {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.6 }),
              });
              const json = await res.json();
              setQqAiAngle(json.choices?.[0]?.message?.content || json.content || "");
            } catch { setQqAiAngle("AI unavailable — try again shortly."); }
            finally { setQqAiLoading(false); }
          }

          return (
          <div>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 4, marginBottom: 18, width: "fit-content" }}>
              {([["quick","⚡ Quick Qualify"],["batch","📋 Batch Qualifier"]] as const).map(([m, l]) => (
                <button key={m} onClick={() => setQualMode(m)}
                  style={{ padding: "7px 18px", borderRadius: 7, fontSize: 11, fontWeight: 800, cursor: "pointer", border: "none", background: qualMode === m ? BB_CRIMSON : "none", color: qualMode === m ? "#fff" : "rgba(255,255,255,0.35)", transition: "all 0.15s" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── QUICK QUALIFY WIZARD ── */}
            {qualMode === "quick" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

                {/* Left: questions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Prospect name + state */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Prospect Name (optional)</div>
                      <input value={qqName} onChange={e => setQqName(e.target.value)} placeholder="e.g. Acme Manufacturing"
                        data-testid="input-qq-name"
                        style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>State</div>
                      <select value={qqState} onChange={e => { setQqState(e.target.value); setQqAiAngle(null); }}
                        data-testid="select-qq-state"
                        style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px 10px", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer" }}>
                        {ALL_STATES.map(s => <option key={s.code} value={s.code} style={{ background: "#0d1526" }}>{s.name} ({s.code})</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Question cards */}
                  {QQ_QUESTIONS.map((q, qi) => {
                    const answered = !!qqAnswers[q.id];
                    return (
                      <div key={q.id} style={{ background: answered ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)", border: `1px solid ${answered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)"}`, borderRadius: 12, padding: "14px 16px", transition: "border-color 0.2s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, width: 18, height: 18, borderRadius: "50%", background: answered ? BB_CRIMSON : "rgba(255,255,255,0.08)", color: answered ? "#fff" : "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{qi + 1}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{q.label}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {(q.options as readonly { id: string; label: string; pts: number }[]).map(opt => {
                            const sel = qqAnswers[q.id] === opt.id;
                            return (
                              <button key={opt.id}
                                data-testid={`btn-qq-${q.id}-${opt.id}`}
                                onClick={() => { setQqAnswers(p => ({ ...p, [q.id]: opt.id })); setQqAiAngle(null); }}
                                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: sel ? "rgba(155,28,46,0.2)" : "rgba(255,255,255,0.04)", border: sel ? `1px solid rgba(155,28,46,0.5)` : "1px solid rgba(255,255,255,0.08)", color: sel ? "#fff" : "rgba(255,255,255,0.5)", transition: "all 0.12s" }}>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Reset */}
                  {qqAnswered > 0 && (
                    <button onClick={() => { setQqAnswers({}); setQqAiAngle(null); }} style={{ alignSelf: "flex-start", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>
                      Reset answers
                    </button>
                  )}
                </div>

                {/* Right: live score + verdict */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 24 }}>

                  {/* Score meter */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Qualification Score</div>
                    {/* Big number */}
                    <div style={{ textAlign: "center", marginBottom: 14 }}>
                      <div style={{ fontSize: 56, fontWeight: 900, color: qqAnswered > 0 ? qqVerdictColor : "rgba(255,255,255,0.12)", lineHeight: 1, transition: "color 0.3s" }}>
                        {qqAnswered > 0 ? qqScore : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>{qqAnswered > 0 ? `out of 100 · ${qqAnswered}/6 answered` : "Answer questions to score"}</div>
                    </div>
                    {/* Bar */}
                    <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: `${qqAnswered > 0 ? qqScore : 0}%`, background: qqVerdictColor, borderRadius: 4, transition: "width 0.4s ease, background 0.3s" }} />
                    </div>
                    {/* Threshold markers */}
                    <div style={{ position: "relative", height: 12, marginBottom: 6 }}>
                      {[{ pos: 45, label: "45" }, { pos: 65, label: "65" }].map(m => (
                        <div key={m.pos} style={{ position: "absolute", left: `${m.pos}%`, top: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{ width: 1, height: 6, background: "rgba(255,255,255,0.2)" }} />
                          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>{m.label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>
                      <span style={{ color: "#ef4444" }}>Not Qualified</span>
                      <span style={{ color: "#f59e0b" }}>Watch</span>
                      <span style={{ color: "#10b981" }}>Qualified</span>
                    </div>
                  </div>

                  {/* Verdict card (shown when complete) */}
                  {qqComplete && (
                    <div style={{ background: `${qqVerdictColor}10`, border: `1px solid ${qqVerdictColor}35`, borderRadius: 14, padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${qqVerdictColor}20`, border: `1px solid ${qqVerdictColor}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {qqVerdict === "qualified" ? <CheckCircle2 size={14} color={qqVerdictColor} /> : qqVerdict === "watch" ? <AlertTriangle size={14} color={qqVerdictColor} /> : <X size={14} color={qqVerdictColor} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: qqVerdictColor }}>{qqVerdictLabel}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{qqName || "This prospect"} · {qqState}</div>
                        </div>
                      </div>

                      {/* Signals summary */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                        {QQ_QUESTIONS.map(q => {
                          const opt = (q.options as readonly { id: string; label: string; pts: number }[]).find(o => o.id === qqAnswers[q.id]);
                          if (!opt) return null;
                          const strong = opt.pts >= 15;
                          return (
                            <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: strong ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)" }}>{opt.label}</span>
                              <span style={{ fontSize: 10, fontWeight: 800, color: strong ? qqVerdictColor : "rgba(255,255,255,0.2)" }}>+{opt.pts}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* State context */}
                      {qqStateData && (
                        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px", marginBottom: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: 5 }}>{qqStateData.name} State Context</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                            {[
                              { label: "Reg. Strictness", val: `${qqStateData.scores.regulatory_strictness.toFixed(1)}/10` },
                              { label: "Spread Pricing", val: `${qqStateData.spread_prevalence_pct}%` },
                              { label: "PBM Risk", val: `${qqStateData.scores.pbm_risk.toFixed(1)}/10` },
                              { label: "Active Alerts", val: String(qqStateData.alert_count) },
                            ].map(m => (
                              <div key={m.label}>
                                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)" }}>{m.label}</div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{m.val}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Opening Angle */}
                      <button data-testid="btn-qq-ai-angle" onClick={runQqAi} disabled={qqAiLoading}
                        style={{ width: "100%", padding: "10px", borderRadius: 9, background: qqAiLoading ? "rgba(155,28,46,0.1)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: qqAiLoading ? "rgba(255,255,255,0.3)" : "#fff", fontSize: 11, fontWeight: 800, cursor: qqAiLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, letterSpacing: "0.04em" }}>
                        {qqAiLoading ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Generating angle…</> : <><Brain size={12} /> Generate Opening Angle</>}
                      </button>

                      {qqAiAngle && (
                        <div style={{ marginTop: 10, background: "rgba(155,28,46,0.06)", border: "1px solid rgba(155,28,46,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: BB_CRIMSON, marginBottom: 6 }}>Recommended Opening Angle</div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{qqAiAngle}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nudge when not complete */}
                  {!qqComplete && qqAnswered > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{QQ_QUESTIONS.length - qqAnswered} question{QQ_QUESTIONS.length - qqAnswered !== 1 ? "s" : ""} remaining</div>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 8 }}>
                        {QQ_QUESTIONS.map(q => (
                          <div key={q.id} style={{ width: 6, height: 6, borderRadius: "50%", background: qqAnswers[q.id] ? BB_CRIMSON : "rgba(255,255,255,0.15)" }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {qqAnswered === 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 16px", textAlign: "center" }}>
                      <Target size={22} style={{ color: "rgba(255,255,255,0.12)", margin: "0 auto 10px" }} />
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>Answer the 6 questions to get a real-time qualification score and AI opening angle.</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BATCH QUALIFIER (existing) ── */}
            {qualMode === "batch" && (
          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, alignItems: "start" }}>

            {/* Left: Account Input + Criteria */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Qualification Criteria */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
                  <Shield size={13} color={BB_CRIMSON} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Qualification Criteria</span>
                </div>

                {/* Min Score */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Minimum Qual Score</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: qualThreshold >= 70 ? "#10b981" : qualThreshold >= 55 ? "#f59e0b" : "#ef4444" }}>{qualThreshold}</span>
                  </div>
                  <input type="range" min={30} max={90} value={qualThreshold} onChange={e => { setQualThreshold(+e.target.value); setQualRun(false); }}
                    data-testid="slider-qual-threshold"
                    style={{ width: "100%", accentColor: BB_CRIMSON, cursor: "pointer" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 3 }}>
                    <span>Lenient (30)</span><span>Strict (90)</span>
                  </div>
                </div>

                {/* Funding type preference */}
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Funding Type Focus</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {FUNDING_TYPES.map(f => (
                      <button key={f.id} data-testid={`qual-funding-${f.id}`}
                        onClick={() => { setQualFundingFilter(f.id); setQualRun(false); }}
                        style={{ padding: "4px 10px", borderRadius: 100, fontSize: 9, fontWeight: 800, cursor: "pointer", background: qualFundingFilter === f.id ? `${BB_CRIMSON}25` : "rgba(255,255,255,0.04)", border: qualFundingFilter === f.id ? `1px solid ${BB_CRIMSON}60` : "1px solid rgba(255,255,255,0.08)", color: qualFundingFilter === f.id ? BB_CRIMSON : "rgba(255,255,255,0.4)" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Account Form */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Users size={13} color="#60a5fa" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Add Accounts</span>
                  </div>
                  <button data-testid="btn-toggle-paste" onClick={() => setShowPaste(p => !p)}
                    style={{ fontSize: 9, fontWeight: 700, color: "#60a5fa", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                    {showPaste ? "← Form" : "Paste list"}
                  </button>
                </div>

                {showPaste ? (
                  <div>
                    <textarea
                      data-testid="textarea-paste-accounts"
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={"One company name per line:\nAcme Corp\nBeta Industries\nGamma LLC"}
                      rows={6}
                      style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 11, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
                    />
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 8, marginTop: 4 }}>
                      State, funding type & size default to the form values below.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Default State</div>
                        <select value={qualForm.state} onChange={e => setQualForm(f => ({ ...f, state: e.target.value }))}
                          style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                          {ALL_STATES.map(s => <option key={s.code} value={s.code} style={{ background: "#0d1526" }}>{s.name} ({s.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Funding Type</div>
                        <select value={qualForm.fundingType} onChange={e => setQualForm(f => ({ ...f, fundingType: e.target.value }))}
                          style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                          {[["self-funded","Self-Funded"],["level-funded","Level-Funded"],["fully-insured","Fully Insured"]].map(([v,l]) => <option key={v} value={v} style={{ background: "#0d1526" }}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <button data-testid="btn-parse-paste" onClick={parsePaste} disabled={!pasteText.trim()}
                      style={{ width: "100%", padding: "9px", borderRadius: 8, background: pasteText.trim() ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${pasteText.trim() ? "rgba(96,165,250,0.4)" : "rgba(255,255,255,0.06)"}`, color: pasteText.trim() ? "#60a5fa" : "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 800, cursor: pasteText.trim() ? "pointer" : "not-allowed" }}>
                      Import {pasteText.trim().split("\n").filter(Boolean).length} Account{pasteText.trim().split("\n").filter(Boolean).length !== 1 ? "s" : ""}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input
                      data-testid="input-account-name"
                      value={qualForm.name}
                      onChange={e => setQualForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && addAccount()}
                      placeholder="Company name…"
                      style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>State</div>
                        <select data-testid="select-account-state" value={qualForm.state} onChange={e => setQualForm(f => ({ ...f, state: e.target.value }))}
                          style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                          {ALL_STATES.map(s => <option key={s.code} value={s.code} style={{ background: "#0d1526" }}>{s.name} ({s.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Funding Type</div>
                        <select data-testid="select-account-funding" value={qualForm.fundingType} onChange={e => setQualForm(f => ({ ...f, fundingType: e.target.value }))}
                          style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                          {[["self-funded","Self-Funded"],["level-funded","Level-Funded"],["fully-insured","Fully Insured"]].map(([v,l]) => <option key={v} value={v} style={{ background: "#0d1526" }}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Employer Size</div>
                        <select data-testid="select-account-size" value={qualForm.size} onChange={e => setQualForm(f => ({ ...f, size: e.target.value }))}
                          style={{ width: "100%", background: "#0d1526", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
                          {[["small","Small (<100)"],["mid-market","Mid-Market (100–999)"],["large","Enterprise (1k–4.9k)"],["jumbo","Enterprise Plus (5k+)"]].map(([v,l]) => <option key={v} value={v} style={{ background: "#0d1526" }}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Industry</div>
                        <input data-testid="input-account-industry" value={qualForm.industry} onChange={e => setQualForm(f => ({ ...f, industry: e.target.value }))}
                          placeholder="Optional…"
                          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <button data-testid="btn-add-account" onClick={addAccount} disabled={!qualForm.name.trim()}
                      style={{ padding: "9px", borderRadius: 8, background: qualForm.name.trim() ? `linear-gradient(135deg,${BB_CRIMSON},#7a1525)` : "rgba(155,28,46,0.1)", border: `1px solid ${qualForm.name.trim() ? BB_CRIMSON : "rgba(155,28,46,0.2)"}`, color: qualForm.name.trim() ? "#fff" : "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 800, cursor: qualForm.name.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <Users size={12} /> Add Account
                    </button>
                  </div>
                )}
              </div>

              {/* Account list */}
              {accounts.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>{accounts.length} Account{accounts.length !== 1 ? "s" : ""} Added</span>
                    <button onClick={() => { setAccounts([]); setQualRun(false); }}
                      style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear all</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 220, overflowY: "auto" }}>
                    {accounts.map(a => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "7px 10px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                            {a.state} · {a.fundingType} · {a.size}
                          </div>
                        </div>
                        <button onClick={() => removeAccount(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)", padding: 2 }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button data-testid="btn-run-qualifier"
                    onClick={() => setQualRun(true)}
                    style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 9, background: `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}`, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, letterSpacing: "0.06em" }}>
                    <CheckCircle2 size={13} /> Run Qualification
                  </button>
                </div>
              )}
            </div>

            {/* Right: Results */}
            <div>
              {!qualRun && accounts.length === 0 && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "48px 32px", textAlign: "center" }}>
                  <Users size={32} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 16px" }} />
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Add your accounts on the left</div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0, maxWidth: 380, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
                    Enter company names one by one or paste a list, set your qualification threshold and funding focus, then click <strong style={{ color: "rgba(255,255,255,0.4)" }}>Run Qualification</strong> to score each account against live Sales IQ state intelligence.
                  </p>
                </div>
              )}

              {!qualRun && accounts.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "36px 32px", textAlign: "center" }}>
                  <CheckCircle2 size={28} color={BB_CRIMSON} style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{accounts.length} account{accounts.length !== 1 ? "s" : ""} ready</div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>Click <strong style={{ color: BB_CRIMSON }}>Run Qualification</strong> to score them.</p>
                </div>
              )}

              {qualRun && qualResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Summary strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { label: "Qualified", count: qualResults.filter(r => r.status === "qualified").length, color: "#10b981" },
                      { label: "Watch List", count: qualResults.filter(r => r.status === "watch").length, color: "#f59e0b" },
                      { label: "Not Qualified", count: qualResults.filter(r => r.status === "not-qualified").length, color: "#ef4444" },
                    ].map(s => (
                      <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 11, padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.count}</div>
                      </div>
                    ))}
                  </div>

                  {/* Result cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {qualResults
                      .filter(r => qualFundingFilter === "all" || r.fundingType === qualFundingFilter)
                      .map((r, i) => {
                        const statusColor = r.status === "qualified" ? "#10b981" : r.status === "watch" ? "#f59e0b" : "#ef4444";
                        const statusLabel = r.status === "qualified" ? "Qualified" : r.status === "watch" ? "Watch" : "Not Qualified";
                        const statusIcon = r.status === "qualified" ? <CheckCircle2 size={12} color={statusColor} /> : r.status === "watch" ? <AlertTriangle size={12} color={statusColor} /> : <X size={12} color={statusColor} />;
                        return (
                          <div key={r.id} data-testid={`qual-result-${i}`}
                            style={{ background: `${statusColor}06`, border: `1px solid ${statusColor}20`, borderRadius: 12, padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                              {/* Rank + score */}
                              <div style={{ textAlign: "center", minWidth: 44 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>#{i + 1}</div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: statusColor, lineHeight: 1 }}>{r.score}</div>
                                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>/ 100</div>
                              </div>
                              {/* Details */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{r.name}</span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 100, background: `${statusColor}18`, border: `1px solid ${statusColor}35`, color: statusColor }}>
                                    {statusIcon}{statusLabel}
                                  </span>
                                </div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                                  {ALL_STATES.find(s => s.code === r.state)?.name || r.state} · {r.fundingType} · {r.size}{r.industry ? ` · ${r.industry}` : ""}
                                </div>
                                {r.signals.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                    {r.signals.map((sig, si) => (
                                      <span key={si} style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                                        {sig}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {r.stateData && (
                                  <button data-testid={`btn-view-state-${r.state}`}
                                    onClick={() => { setSelectedStateCode(r.state); setActiveTab("map"); }}
                                    style={{ marginTop: 8, fontSize: 9, fontWeight: 700, color: "#60a5fa", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                                    <ArrowUpRight size={10} /> View {r.state} state intelligence
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
            )}
          </div>
          );
        })()}

        {/* ── Tab: Sales Angle Generator ── */}
        {activeTab === "angle" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
              <SalesAngleGenerator selectedState={selectedStateCode} statesData={statesData} />
            </div>
          </div>
        )}

        {/* ── Tab: Compliance Alerts ── */}
        {activeTab === "alerts" && (
          <div style={{ maxWidth: 760 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Active Compliance Risk Alerts</div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>California priority alerts first · Federal requirements · State-specific enforcement actions</p>
            </div>
            {alertsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              alertsData?.alerts.map((a, i) => <AlertCard key={i} alert={a} />)
            )}
          </div>
        )}

        {/* ── Tab: Prospect Deep Dive ── */}
        {activeTab === "deepdive" && (
          <ProspectDeepDive />
        )}

        {/* ── Tab: Email Sequence Builder ── */}
        {activeTab === "sequence" && (
          <EmailSequenceBuilder statesData={statesData} />
        )}

        {/* ── Tab: ROI Calculator ── */}
        {activeTab === "roi" && (
          <ROICalculator statesData={statesData} />
        )}

        {/* ── Tab: Deal Pipeline ── */}
        {activeTab === "pipeline" && (
          <DealPipeline />
        )}

        {/* ── Tab: Filing Intelligence (Module 11) ── */}
        {activeTab === "filings" && (
          <FilingIntelligence />
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </Layout>
  );
}
