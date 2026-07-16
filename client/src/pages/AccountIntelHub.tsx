import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Building2, Users, CheckCircle2, AlertTriangle, Lock,
  Loader2, ChevronRight, Database, Zap, Star,
  Mail, Globe, TrendingUp, BarChart3, Shield,
  Layers, Brain, Target, Cpu, Radar, ArrowUpRight,
  AlertOctagon, Trophy, Package,
} from "lucide-react";
import { SiLinkedin } from "react-icons/si";

const BB_CRIMSON = "#9B1C2E";
const UI = {
  surface: "rgba(255,255,255,0.82)",
  surface2: "rgba(248,250,252,0.84)",
  border: "rgba(15,23,42,0.10)",
  text: "#08111f",
  textSoft: "#1e2f46",
  muted: "#3f516a",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderInfo = {
  id: string; name: string; category: string; tier: string;
  configured: boolean; status: string; status_label: string;
  capabilities: string[]; description: string; pricing?: string;
  strengths?: string[]; weaknesses?: string[]; best_use?: string;
};

type IntelRank = {
  rank: number; provider: string; name: string; category: string;
  overall_score: number; scores: Record<string, number>;
  verdict: string; mvp: boolean; enterprise: boolean; configured: boolean;
};

type Contact = {
  name?: string; first_name?: string; last_name?: string;
  email?: string; title?: string; department?: string;
  linkedin?: string; linkedin_url?: string; city?: string; state?: string;
  confidence?: number; verified?: boolean; _source?: string;
};

type CompanyProfile = {
  name?: string; domain?: string; industry?: string; employee_count?: number;
  employee_range?: string; revenue?: number; city?: string; state?: string;
  description?: string; tech_stack?: string[]; founded?: number;
  linkedin?: string; duns?: string; crm_ids?: Record<string, string>;
};

type Signal = {
  type: string; source: string; severity: string;
  title: string; description: string; action?: string;
};

type EnrichResult = {
  query: { domain?: string; domain_raw?: string; company_name?: string; domain_was_invalid?: boolean; domain_was_guessed?: boolean };
  company_profile: CompanyProfile; contacts: Contact[];
  contact_count: number; provider_results: any[];
  summary: { live_providers: string[]; not_configured_providers: string[]; enterprise_providers: string[]; data_sources: number };
};

type TechStackResult = {
  domain: string; technology_count: number; all_technologies: string[];
  by_category: Record<string, string[]>;
  hr_benefits_tech: string[]; hiring_signals?: any;
  kiq_opportunity_signals: Signal[];
  sources_with_data: string[];
};

type SignalsResult = {
  domain: string; signal_count: number; high_priority_count: number;
  signals: Signal[]; crunchbase_data?: any; sources_status: Record<string, string>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Chip({ children, color = "#60a5fa", size = "sm" }: { children: React.ReactNode; color?: string; size?: "xs" | "sm" }) {
  const pad = size === "xs" ? "1px 6px" : "2px 9px";
  const fs = size === "xs" ? 8 : 9;
  return (
    <span style={{ display: "inline-block", padding: pad, borderRadius: 100, fontSize: fs, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" as const, background: `${color}18`, border: `1px solid ${color}35`, color, whiteSpace: "nowrap" as const }}>
      {children}
    </span>
  );
}

function StatRow({ label, value, color = UI.text }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${UI.border}` }}>
      <span style={{ fontSize: 10, color: UI.muted, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

function ScoreDot({ score }: { score: number }) {
  const color = score >= 8.5 ? "#10b981" : score >= 7 ? "#60a5fa" : score >= 5 ? "#f59e0b" : "#ef4444";
  return <span style={{ fontWeight: 900, color, fontSize: 14 }}>{score.toFixed(1)}</span>;
}

function ProviderDot({ configured, tier }: { configured: boolean; tier: string }) {
  const color = configured ? "#10b981" : tier === "enterprise" ? "#8b5cf6" : "#374151";
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

// ─── Signal Card ──────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: Signal }) {
  const sevColor = signal.severity === "HIGH" ? "#ef4444" : signal.severity === "MEDIUM" ? "#f59e0b" : "#10b981";
  const typeColors: Record<string, string> = {
    FUNDING: "#10b981", M_A: "#8b5cf6", M_AMP_A: "#8b5cf6", IPO: "#60a5fa",
    HIRING_SIGNAL: "#f97316", HR_HIRING: "#ef4444", KEYWORD_INTENT: "#60a5fa", OPPORTUNITY: "#10b981",
  };
  const typeColor = typeColors[signal.type] || sevColor;
  const srcColors: Record<string, string> = { Crunchbase: "#10b981", TheirStack: "#f97316", Apollo: "#f59e0b" };

  return (
    <div style={{ background: `${sevColor}06`, border: `1px solid ${sevColor}20`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <AlertTriangle size={13} color={sevColor} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{signal.title}</span>
            <Chip color={sevColor}>{signal.severity}</Chip>
            {signal.source && <Chip color={srcColors[signal.source] || "#60a5fa"} size="xs">{signal.source}</Chip>}
          </div>
          <p style={{ fontSize: 11, color: "#334155", margin: 0, lineHeight: 1.6 }}>{signal.description}</p>
        </div>
      </div>
      {signal.action && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, paddingLeft: 23 }}>
          <ChevronRight size={10} color={typeColor} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, lineHeight: 1.5 }}>{signal.action}</span>
        </div>
      )}
    </div>
  );
}

// ─── Intel Rank Card ──────────────────────────────────────────────────────────

function IntelRankCard({ item }: { item: IntelRank }) {
  const [expanded, setExpanded] = useState(false);
  const rankColors: Record<number, string> = { 1: "#f59e0b", 2: "#9ca3af", 3: "#cd7f32" };
  const rankColor = rankColors[item.rank] || "#94a3b8";
  const scoreColor = item.overall_score >= 8.5 ? "#10b981" : item.overall_score >= 7 ? "#60a5fa" : "#f59e0b";

  return (
    <div className="kiq-ops-card" style={{ background: UI.surface, border: item.configured ? "1px solid rgba(16,185,129,0.24)" : `1px solid ${UI.border}`, borderRadius: 14, marginBottom: 10, overflow: "hidden" }}>
      {item.configured && <div style={{ height: 2, background: "linear-gradient(90deg,#10b981,#059669)" }} />}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Rank badge */}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${rankColor}15`, border: `1px solid ${rankColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: rankColor }}>#{item.rank}</span>
          </div>

          {/* Name + category */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>{item.name}</span>
              {item.mvp && <Chip color="#10b981">MVP Stack</Chip>}
              {item.enterprise && !item.mvp && <Chip color="#8b5cf6">Enterprise</Chip>}
              {item.configured && <Chip color="#10b981" size="xs">✓ Live</Chip>}
            </div>
            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{item.category}</div>
          </div>

          {/* Score */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor }}>{item.overall_score.toFixed(1)}</div>
            <div style={{ fontSize: 8, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Score</div>
          </div>

          <button onClick={() => setExpanded(!expanded)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}>
            <ChevronRight size={14} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "0.15s" }} />
          </button>
        </div>

        {/* Verdict */}
        <div style={{ marginTop: 10, padding: "9px 12px", background: `${scoreColor}06`, border: `1px solid ${scoreColor}15`, borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 11, color: UI.textSoft, lineHeight: 1.6, fontWeight: 600 }}>{item.verdict}</p>
        </div>

        {expanded && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {Object.entries(item.scores).map(([key, val]) => (
                <div key={key} style={{ textAlign: "center", background: UI.surface2, border: `1px solid ${UI.border}`, borderRadius: 8, padding: "8px 6px" }}>
                  <ScoreDot score={val} />
                  <div style={{ fontSize: 8, color: "#64748b", marginTop: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {key.replace(/_/g, " ").replace("pricing value", "value")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contact Row ──────────────────────────────────────────────────────────────

function ContactRow({ c }: { c: Contact }) {
  const name = c.name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
  const linkedin = c.linkedin || c.linkedin_url;
  const srcColors: Record<string, string> = { apollo: "#f59e0b", hunter: "#10b981", hubspot: "#f97316", salesforce: "#60a5fa" };
  const srcColor = c._source ? (srcColors[c._source] || "#8b5cf6") : "#60a5fa";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${UI.border}` }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(155,28,46,0.15)", border: "1px solid rgba(155,28,46,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: BB_CRIMSON }}>{name.charAt(0).toUpperCase()}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 10, color: "#475569" }}>{c.title || c.department || "—"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
        {c.email && (
          <a href={`mailto:${c.email}`} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>
            <Mail size={10} />{c.email}
          </a>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {linkedin && <a href={linkedin} target="_blank" rel="noreferrer" style={{ color: "#0077b5" }}><SiLinkedin size={12} /></a>}
          {c.verified && <span style={{ fontSize: 8, color: "#10b981", fontWeight: 800 }}>✓ Verified</span>}
          {c._source && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${srcColor}15`, color: srcColor, fontWeight: 800 }}>{c._source}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Provider Status Grid ─────────────────────────────────────────────────────

function ProviderStatusCard({ p, result }: { p: ProviderInfo; result?: any }) {
  const hasData = result?.status === "ok";
  const borderColor = p.configured ? (hasData ? "#10b981" : "#3b82f6") : (p.tier === "enterprise" ? "#8b5cf6" : "#1f2937");

  return (
    <div className="kiq-ops-card" style={{ background: UI.surface, border: `1px solid ${borderColor}30`, borderRadius: 12, padding: 14, position: "relative" as const, overflow: "hidden" as const }}>
      {hasData && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#10b981" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>{p.name}</div>
          <div style={{ fontSize: 9, color: "#64748b" }}>{p.category}</div>
        </div>
        <Chip color={p.configured ? "#10b981" : p.tier === "enterprise" ? "#8b5cf6" : "#f59e0b"}>
          {p.configured ? "Live" : p.tier === "enterprise" ? "Enterprise" : "Needs Key"}
        </Chip>
      </div>
      <p style={{ fontSize: 10, color: "#475569", margin: "0 0 8px", lineHeight: 1.5 }}>{p.description}</p>
      {p.pricing && <div style={{ fontSize: 9, color: UI.muted, fontWeight: 700 }}>{p.pricing}</div>}
      {!p.configured && p.tier !== "enterprise" && (
        <div style={{ marginTop: 8, fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>
          Add {(p as any).key_names?.join(", ")} to activate
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "techstack", label: "Tech Stack", icon: Cpu },
  { id: "signals", label: "Signals", icon: Radar },
  { id: "intel-stack", label: "Intelligence Stack", icon: Trophy },
  { id: "providers", label: "All Providers", icon: Database },
];

const QUICK: { label: string; domain: string; company: string }[] = [
  { label: "CVS Health", domain: "cvshealth.com", company: "CVS Health" },
  { label: "UnitedHealth", domain: "unitedhealthgroup.com", company: "UnitedHealth Group" },
  { label: "Boeing", domain: "boeing.com", company: "Boeing" },
  { label: "Amazon", domain: "amazon.com", company: "Amazon" },
];

export default function AccountIntelHub() {
  const { toast } = useToast();
  const [domain, setDomain] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [searchedDomain, setSearchedDomain] = useState("");

  function cleanDomain(raw: string): string {
    let d = raw.trim();
    for (const prefix of ["https://www.", "http://www.", "https://", "http://", "www."]) {
      if (d.startsWith(prefix)) { d = d.slice(prefix.length); break; }
    }
    d = d.split("/")[0].split("?")[0].split("#")[0].toLowerCase();
    return d;
  }

  const domainCleaned = cleanDomain(domain);
  const domainValid = domainCleaned.includes(".");
  const domainWarning = domain.trim() && !domainValid
    ? `"${domain.trim()}" doesn't look like a domain. Try: ${domain.trim().toLowerCase().replace(/\s+/g, "")}.com`
    : null;

  const { data: providersData } = useQuery<{ providers: ProviderInfo[]; configured_count: number; total: number }>({
    queryKey: ["/api/account-intel/providers"],
  });

  const { data: intelStackData } = useQuery<{ ranked: IntelRank[]; mvp_stack: any; enterprise_stack: any; unified_schema: any; configured_count: number }>({
    queryKey: ["/api/account-intel/intel-stack"],
  });

  const { data: techStackData, isLoading: techLoading } = useQuery<TechStackResult>({
    queryKey: ["/api/account-intel/tech-stack", searchedDomain],
    enabled: !!searchedDomain && activeTab === "techstack",
  });

  const { data: signalsData, isLoading: signalsLoading } = useQuery<SignalsResult>({
    queryKey: ["/api/account-intel/signals", searchedDomain],
    enabled: !!searchedDomain && activeTab === "signals",
  });

  const enrichMutation = useMutation<EnrichResult, Error, { domain?: string; company_name?: string }>({
    mutationFn: async (body) => {
      const resp = await fetch("/api/account-intel/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, include_contacts: true }),
      });
      if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.detail || "Enrichment failed"); }
      return resp.json();
    },
    onSuccess: (data) => { setResult(data); setActiveTab("overview"); },
    onError: (e) => toast({ title: "Enrichment failed", description: e.message, variant: "destructive" }),
  });

  function runSearch(d?: string, c?: string) {
    const rawDomain = d ?? domain.trim();
    const _c = c ?? companyName.trim();
    if (!rawDomain && !_c) return;
    // Always clean the domain before sending
    const _d = rawDomain ? cleanDomain(rawDomain) : "";
    // If cleaned domain has a dot, use it for the tech-stack/signals queries
    if (_d && _d.includes(".")) setSearchedDomain(_d);
    else if (_c) setSearchedDomain(""); // no valid domain, clear it
    enrichMutation.mutate({
      domain: (_d && _d.includes(".")) ? _d : undefined,
      company_name: _c || undefined,
    });
  }

  const resultMap: Record<string, any> = {};
  result?.provider_results?.forEach(r => { if (r.provider) resultMap[r.provider] = r; });

  const profile = result?.company_profile || {};
  const configuredCount = providersData?.configured_count || 0;
  const totalProviders = providersData?.total || 14;

  // Tab label with count
  const tabLabel = (tab: typeof TABS[0]) => {
    if (tab.id === "contacts" && result) return `Contacts (${result.contact_count})`;
    if (tab.id === "signals" && signalsData) return `Signals (${signalsData.signal_count})`;
    if (tab.id === "techstack" && techStackData) return `Tech Stack (${techStackData.technology_count})`;
    return tab.label;
  };

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "100vh", padding: "24px 24px 80px", fontFamily: "var(--font-sans)" }}>

        {/* Header */}
        <div className="kiq-ops-header" style={{ marginBottom: 20, padding: 20, borderRadius: 18 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 100, padding: "4px 14px", marginBottom: 12 }}>
            <Database size={11} color={BB_CRIMSON} />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Kincaid Health · Account Intelligence Hub · 14 Providers</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", margin: "0 0 5px", letterSpacing: "-0.02em" }}>Account Intelligence Hub</h1>
          <p style={{ fontSize: 11, color: UI.muted, margin: 0, fontWeight: 600 }}>
            Firmographic · Technographic · Contact · Signal & Intent · All 14 providers in parallel
          </p>
        </div>

        {/* Provider status bar */}
        <div className="kiq-ops-card" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 16px", background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={13} color="#64748b" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b" }}>{configuredCount}/{totalProviders} providers live</span>
          </div>
          <div style={{ height: 12, width: 1, background: "#e2e8f0" }} />
          {providersData?.providers.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ProviderDot configured={p.configured} tier={p.tier} />
              <span style={{ fontSize: 9, fontWeight: 800, color: p.configured ? "#10b981" : "#64748b" }}>{p.name}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="kiq-ops-header" style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: UI.muted, marginBottom: 5 }}>Company Domain</div>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onPaste={e => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  setDomain(cleanDomain(pasted));
                }}
                onKeyDown={e => e.key === "Enter" && runSearch()}
                placeholder="e.g. cvshealth.com"
                data-testid="input-domain"
                style={{
                  width: "100%",
                  background: "#f8fafc",
                  border: domainWarning ? "1px solid rgba(245,158,11,0.6)" : "1px solid #e2e8f0",
                  borderRadius: 9, padding: "11px 14px", color: "#0F172A", fontSize: 13, outline: "none", boxSizing: "border-box" as const,
                }}
              />
              {domainWarning && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 5 }}>
                  <AlertTriangle size={10} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 9, color: "#f59e0b", lineHeight: 1.4 }}>{domainWarning}</span>
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: UI.muted, marginBottom: 5 }}>Company Name</div>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch()} placeholder="e.g. CVS Health" data-testid="input-company-name"
                style={{ width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: "11px 14px", color: "#0F172A", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={() => runSearch()} disabled={enrichMutation.isPending || (!domain.trim() && !companyName.trim())} data-testid="button-enrich"
                style={{ padding: "11px 22px", borderRadius: 9, fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", background: enrichMutation.isPending ? "rgba(155,28,46,0.15)" : `linear-gradient(135deg,${BB_CRIMSON},#7a1525)`, border: `1px solid ${BB_CRIMSON}40`, color: enrichMutation.isPending ? "#64748b" : "#fff", cursor: enrichMutation.isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" as const }}>
                {enrichMutation.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
                {enrichMutation.isPending ? "Enriching…" : "Enrich Account"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", alignSelf: "center", textTransform: "uppercase", letterSpacing: "0.1em" }}>Quick:</span>
            {QUICK.map(q => (
              <button key={q.label} onClick={() => { setDomain(q.domain); setCompanyName(q.company); runSearch(q.domain, q.company); }}
                style={{ padding: "4px 12px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer", background: "#ffffff", border: "1px solid #e2e8f0", color: "#334155" }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 2, marginBottom: 18, borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "none", border: "none", borderBottom: active ? `2px solid ${BB_CRIMSON}` : "2px solid transparent", color: active ? BB_CRIMSON : "#64748b", fontSize: 11, fontWeight: 800, cursor: "pointer", letterSpacing: "0.03em", marginBottom: -1 }}>
                <Icon size={12} />
                {tabLabel(tab)}
              </button>
            );
          })}
        </div>

        {/* Query context banners */}
        {result && result.query?.domain_was_guessed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, marginBottom: 12 }}>
            <AlertTriangle size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#1e293b" }}>
              No domain provided — used <strong style={{ color: "#f59e0b" }}>{result.query.domain}</strong> (guessed from company name). For best results, enter the exact domain like <em>cvshealth.com</em>.
            </span>
          </div>
        )}
        {result && result.query?.domain_was_invalid && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 12 }}>
            <AlertOctagon size={13} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#1e293b" }}>
              <strong style={{ color: "#ef4444" }}>"{result.query.domain_raw}"</strong> is not a valid domain. Searched by company name instead. Add a proper domain (e.g. <em>company.com</em>) for tech stack and contact data.
            </span>
          </div>
        )}
        {result && result.summary.live_providers.length === 0 && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 10, marginBottom: 12 }}>
            <Database size={14} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", marginBottom: 4 }}>No live data providers — add API keys to activate</div>
              <p style={{ fontSize: 10, color: "#475569", margin: "0 0 6px", lineHeight: 1.6 }}>
                Hunter.io is configured but needs a valid domain (e.g. <em>cvshealth.com</em>) to find contacts. All other providers need keys.
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { key: "CLEARBIT_API_KEY", label: "Clearbit → Firmographics" },
                  { key: "CRUNCHBASE_API_KEY", label: "Crunchbase → Signals" },
                  { key: "BUILTWITH_API_KEY", label: "BuiltWith → Tech Stack" },
                  { key: "APOLLO_API_KEY", label: "Apollo → Contacts" },
                ].map(k => (
                  <span key={k.key} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", fontWeight: 700 }}>
                    {k.key} → {k.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary row (when result present) */}
        {result && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
            {[
              { label: "Data Sources", value: result.summary.data_sources, color: "#10b981", icon: <Database size={13} color="#10b981" /> },
              { label: "Contacts", value: result.contact_count, color: "#60a5fa", icon: <Users size={13} color="#60a5fa" /> },
              { label: "Tech Technologies", value: techStackData?.technology_count ?? "—", color: "#8b5cf6", icon: <Cpu size={13} color="#8b5cf6" /> },
              { label: "Signals", value: signalsData?.signal_count ?? "—", color: "#f59e0b", icon: <Radar size={13} color="#f59e0b" /> },
            ].map(s => (
              <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 11, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>{s.icon}<span style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</span></div>
                <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Overview ── */}
        {activeTab === "overview" && result && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 size={22} color={BB_CRIMSON} />
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", marginBottom: 3 }}>{profile.name || "—"}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{profile.domain || "—"}</div>
                  {profile.linkedin && (
                    <a href={profile.linkedin} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10, color: "#0077b5", textDecoration: "none", fontWeight: 600 }}>
                      <SiLinkedin size={11} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
              {profile.description && (
                <p style={{ fontSize: 11, color: "#334155", marginBottom: 16, lineHeight: 1.6, borderLeft: `2px solid rgba(155,28,46,0.35)`, paddingLeft: 12 }}>
                  {profile.description.slice(0, 260)}{profile.description.length > 260 ? "…" : ""}
                </p>
              )}
              <StatRow label="Industry" value={profile.industry || "—"} color="#0f172a" />
              <StatRow label="Employees" value={profile.employee_count?.toLocaleString() || profile.employee_range || "—"} color="#60a5fa" />
              <StatRow label="Revenue" value={profile.revenue ? (profile.revenue >= 1e9 ? `$${(profile.revenue / 1e9).toFixed(1)}B` : `$${(profile.revenue / 1e6).toFixed(0)}M`) : "—"} color="#10b981" />
              <StatRow label="Founded" value={profile.founded?.toString() || "—"} color="#334155" />
              <StatRow label="Location" value={[profile.city, profile.state].filter(Boolean).join(", ") || "—"} color="#334155" />
              {profile.duns && <StatRow label="DUNS" value={profile.duns} color="#8b5cf6" />}
              {profile.crm_ids && Object.keys(profile.crm_ids).length > 0 && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 9 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>✓ In Your CRM</div>
                  {Object.entries(profile.crm_ids).map(([crm, id]) => (
                    <div key={crm} style={{ fontSize: 10, color: "#334155" }}><strong style={{ color: "#10b981" }}>{crm}:</strong> {id}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Quick nav to other tabs */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Deep Intelligence</div>
                {[
                  { tab: "techstack", label: `Tech Stack${techStackData ? ` — ${techStackData.technology_count} technologies` : " — run to load"}`, color: "#8b5cf6", icon: <Cpu size={13} /> },
                  { tab: "signals", label: `Buying Signals${signalsData ? ` — ${signalsData.signal_count} signals, ${signalsData.high_priority_count} HIGH` : " — run to load"}`, color: "#f59e0b", icon: <Radar size={13} /> },
                  { tab: "contacts", label: `Contacts — ${result.contact_count} discovered`, color: "#60a5fa", icon: <Users size={13} /> },
                ].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    style={{ width: "100%", marginBottom: 7, padding: "9px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", background: `${item.color}10`, border: `1px solid ${item.color}25`, color: item.color, textAlign: "left" as const, display: "flex", alignItems: "center", gap: 8 }}>
                    {item.icon}{item.label}
                    <ChevronRight size={12} style={{ marginLeft: "auto" }} />
                  </button>
                ))}
              </div>

              {/* Data sources */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                  Data Sources ({result.summary.data_sources} live)
                </div>
                {result.provider_results.map(r => {
                  const color = r.status === "ok" ? "#10b981" : r.status === "enterprise" ? "#8b5cf6" : r.status === "not_configured" ? "#374151" : "#374151";
                  const icon = r.status === "ok" ? "✓" : r.status === "enterprise" ? "🔒" : "—";
                  return (
                    <div key={r.provider} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: r.status === "ok" ? "#10b981" : "#64748b" }}>
                        <span style={{ color, marginRight: 6 }}>{icon}</span>{r.provider}
                      </span>
                      <span style={{ fontSize: 9, color: "#cbd5e1" }}>{r.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Contacts ── */}
        {activeTab === "contacts" && result && (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, maxWidth: 760 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
              {result.contact_count} Contacts Discovered
            </div>
            {result.contacts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: UI.muted, fontSize: 12, fontWeight: 600 }}>
                No contacts found. Configure Apollo.io or Hunter.io to discover contacts.
              </div>
            ) : result.contacts.map((c, i) => <ContactRow key={i} c={c} />)}
          </div>
        )}

        {/* ── Tab: Tech Stack ── */}
        {activeTab === "techstack" && (
          <div style={{ maxWidth: 900 }}>
            {!searchedDomain ? (
              <div style={{ textAlign: "center", padding: 60, color: "#64748b", fontSize: 13 }}>
                Search an account above to load technographic data
              </div>
            ) : techLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
                <Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : techStackData ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* HR/Benefits tech — opportunity signals */}
                {techStackData.hr_benefits_tech.length > 0 && (
                  <div style={{ gridColumn: "1 / -1", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: 18 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                      ✓ HR/Benefits Software Detected — Kincaid Health Opportunity Signals
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {techStackData.hr_benefits_tech.map(t => (
                        <span key={t} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 800, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981" }}>{t}</span>
                      ))}
                    </div>
                    {techStackData.kiq_opportunity_signals.map((s, i) => <SignalCard key={i} signal={s} />)}
                  </div>
                )}

                {/* Tech by category */}
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                    {techStackData.technology_count} Technologies by Category
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {Object.entries(techStackData.by_category).slice(0, 15).map(([cat, techs]) => (
                      <div key={cat}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{cat}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {(techs as string[]).map((t: string) => (
                            <span key={t} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source quality */}
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Data Sources</div>
                  {[
                    { id: "builtwith", label: "BuiltWith", color: "#60a5fa" },
                    { id: "wappalyzer", label: "Wappalyzer", color: "#10b981" },
                    { id: "theirstack", label: "TheirStack (Hiring Signals)", color: "#f97316" },
                  ].map(src => {
                    const srcData = techStackData.sources[src.id as keyof typeof techStackData.sources] as any;
                    const status = srcData?.status || "not_configured";
                    return (
                      <div key={src.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${UI.border}` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: status === "ok" ? "#10b981" : "#64748b" }}>{src.label}</span>
                        <Chip color={status === "ok" ? "#10b981" : "#f59e0b"}>{status === "ok" ? "Live Data" : status}</Chip>
                      </div>
                    );
                  })}
                  {!techStackData.sources_with_data.length && (
                    <p style={{ fontSize: 11, color: "#64748b", marginTop: 12, lineHeight: 1.6 }}>
                      Add <strong style={{ color: "#f59e0b" }}>WAPPALYZER_API_KEY</strong> (free) or <strong style={{ color: "#f59e0b" }}>BUILTWITH_API_KEY</strong> to activate technographic data.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Tab: Signals ── */}
        {activeTab === "signals" && (
          <div style={{ maxWidth: 760 }}>
            {!searchedDomain ? (
              <div style={{ textAlign: "center", padding: 60, color: "#64748b", fontSize: 13 }}>Search an account above to load signals</div>
            ) : signalsLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : signalsData ? (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
                  {[
                    { label: "Total Signals", value: signalsData.signal_count, color: "#60a5fa" },
                    { label: "High Priority", value: signalsData.high_priority_count, color: "#ef4444" },
                    { label: "Sources Active", value: Object.values(signalsData.sources_status).filter(s => s === "ok").length, color: "#10b981" },
                  ].map(s => (
                    <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: s.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {signalsData.signals.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
                    <p>No signals detected. Configure Crunchbase (funding/M&A) or TheirStack (hiring) for signal data.</p>
                    <p style={{ fontSize: 10, marginTop: 8 }}>Add: <strong style={{ color: "#f59e0b" }}>CRUNCHBASE_API_KEY</strong> · <strong style={{ color: "#f59e0b" }}>THEIRSTACK_API_KEY</strong></p>
                  </div>
                ) : (
                  signalsData.signals.map((s, i) => <SignalCard key={i} signal={s} />)
                )}

                {signalsData.crunchbase_data && (
                  <div style={{ marginTop: 20, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 14, padding: 18 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Crunchbase Profile</div>
                    <StatRow label="Total Funding" value={signalsData.crunchbase_data.total_funding_display || "—"} color="#10b981" />
                    <StatRow label="Funding Rounds" value={signalsData.crunchbase_data.funding_rounds || 0} />
                    <StatRow label="Last Round" value={`${signalsData.crunchbase_data.last_funding_type || "—"} (${(signalsData.crunchbase_data.last_funding_date || "").slice(0, 10)})`} />
                    <StatRow label="Acquisitions" value={signalsData.crunchbase_data.num_acquisitions || 0} />
                    <StatRow label="IPO Status" value={signalsData.crunchbase_data.ipo_status || "Private"} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Tab: Intelligence Stack ── */}
        {activeTab === "intel-stack" && intelStackData && (
          <div>

            {/* ── MVP Stack Hero ──────────────────────────────────────── */}
            <div style={{ marginBottom: 24, background: "linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(5,150,105,0.04) 100%)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, overflow: "hidden" }}>
              {/* Accent bar */}
              <div style={{ height: 3, background: "linear-gradient(90deg, #10b981, #059669, #047857)" }} />
              <div style={{ padding: "24px 28px" }}>

                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <Zap size={18} color="#10b981" />
                      <span style={{ fontSize: 20, fontWeight: 900, color: "#10b981", letterSpacing: "-0.02em" }}>MVP Stack</span>
                      <span style={{ padding: "3px 10px", borderRadius: 100, fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", color: "#10b981" }}>
                        {intelStackData.mvp_stack.tagline}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.6 }}>{intelStackData.mvp_stack.description}</p>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{intelStackData.mvp_stack.monthly_cost_range}</div>
                    <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase" as const }}>per month</div>
                    <div style={{ fontSize: 9, color: "#10b981", fontWeight: 700, marginTop: 4 }}>{intelStackData.mvp_stack.vs_enterprise}</div>
                  </div>
                </div>

                {/* 3-provider cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
                  {(intelStackData.mvp_stack.providers as string[]).map((pid: string) => {
                    const role = (intelStackData.mvp_stack.provider_roles as Record<string, string>)[pid] || "";
                    const roleTitle = role.split("—")[0].trim();
                    const roleDesc = role.split("—").slice(1).join("—").trim();
                    const providerLabels: Record<string, string> = { builtwith: "BuiltWith", clearbit: "Clearbit", crunchbase: "Crunchbase" };
                    const providerIcons: Record<string, JSX.Element> = {
                      builtwith: <Cpu size={16} color="#8b5cf6" />,
                      clearbit: <Building2 size={16} color="#60a5fa" />,
                      crunchbase: <TrendingUp size={16} color="#10b981" />,
                    };
                    const providerColors: Record<string, string> = { builtwith: "#8b5cf6", clearbit: "#60a5fa", crunchbase: "#10b981" };
                    const color = providerColors[pid] || "#10b981";
                    return (
                      <div key={pid} style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: 14, padding: "16px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          {providerIcons[pid]}
                          <span style={{ fontSize: 13, fontWeight: 900, color }}>{providerLabels[pid]}</span>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 5 }}>{roleTitle}</div>
                        <p style={{ fontSize: 10, color: "#475569", margin: 0, lineHeight: 1.6 }}>{roleDesc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Powers row — what this stack unlocks */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 12 }}>
                    Enough to power:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {(intelStackData.mvp_stack.powers as any[]).map((power: any) => {
                      const powerIcons: Record<string, JSX.Element> = {
                        TrendingUp: <TrendingUp size={14} color="#f59e0b" />,
                        BarChart3: <BarChart3 size={14} color="#f97316" />,
                        Shield: <Shield size={14} color="#ef4444" />,
                      };
                      const powerColors: Record<string, string> = { TrendingUp: "#f59e0b", BarChart3: "#f97316", Shield: "#ef4444" };
                      const color = powerColors[power.icon] || "#10b981";
                      return (
                        <div key={power.label} style={{ background: `${color}07`, border: `1px solid ${color}20`, borderRadius: 12, padding: "14px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                            {powerIcons[power.icon]}
                            <span style={{ fontSize: 12, fontWeight: 900, color }}>{power.label}</span>
                          </div>
                          <p style={{ fontSize: 10, color: UI.textSoft, margin: 0, lineHeight: 1.6, fontWeight: 600 }}>{power.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rationale + setup priority */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "start" }}>
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0, lineHeight: 1.7, borderLeft: "2px solid rgba(16,185,129,0.3)", paddingLeft: 12 }}>
                    {intelStackData.mvp_stack.rationale}
                  </p>
                  <div style={{ flexShrink: 0, textAlign: "right" as const }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: UI.muted, textTransform: "uppercase" as const, marginBottom: 6 }}>Setup Order</div>
                    {(intelStackData.mvp_stack.setup_priority as string[]).map((p: string, i: number) => (
                      <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 9, color: "#475569" }}>#{i + 1}</span>
                        <Chip color="#10b981" size="xs">{p}</Chip>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, fontSize: 9, color: UI.muted, fontWeight: 700 }}>
                      Then add → <span style={{ color: "#f59e0b" }}>{intelStackData.mvp_stack.add_next}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Enterprise + Ranked side-by-side header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {/* Enterprise Stack */}
              <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Trophy size={16} color="#8b5cf6" />
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#8b5cf6" }}>Enterprise Stack</span>
                </div>
                <p style={{ fontSize: 11, color: "#334155", marginBottom: 14, lineHeight: 1.6 }}>{intelStackData.enterprise_stack.description}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {(intelStackData.enterprise_stack.providers as string[]).map((p: string) => (
                    <Chip key={p} color="#8b5cf6">{p}</Chip>
                  ))}
                </div>
                <StatRow label="Monthly Cost" value={intelStackData.enterprise_stack.monthly_cost_range} color="#8b5cf6" />
                <StatRow label="Coverage" value={intelStackData.enterprise_stack.coverage} />
                <p style={{ fontSize: 10, color: "#475569", marginTop: 12, lineHeight: 1.6 }}>{intelStackData.enterprise_stack.rationale}</p>
              </div>

              {/* Quick summary */}
              <div style={{ background: "rgba(0,43,92,0.2)", border: "1px solid rgba(0,43,92,0.5)", borderRadius: 16, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Star size={15} color="#60a5fa" />
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#60a5fa" }}>Stack Comparison</span>
                </div>
                {[
                  { label: "MVP Cost", value: intelStackData.mvp_stack.monthly_cost_range, color: "#10b981" },
                  { label: "Enterprise Cost", value: intelStackData.enterprise_stack.monthly_cost_range, color: "#8b5cf6" },
                  { label: "MVP Value", value: "80% of enterprise intel", color: "#10b981" },
                  { label: "Providers Configured", value: `${intelStackData.configured_count} / ${intelStackData.total_providers} live`, color: "#60a5fa" },
                ].map(s => <StatRow key={s.label} label={s.label} value={s.value} color={s.color} />)}
                <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#10b981", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 4 }}>Recommended Starting Point</div>
                  <p style={{ fontSize: 10, color: "#475569", margin: 0, lineHeight: 1.6 }}>
                    Start with the MVP Stack. Add Apollo.io for contact enrichment. Upgrade to ZoomInfo + Bombora only when ACV justifies the cost.
                  </p>
                </div>
              </div>
            </div>

            {/* Ranked list */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Ranked API Stack — Best → Worst for Kincaid Health Use Case
              </div>
              {intelStackData.ranked.map(item => <IntelRankCard key={item.provider} item={item} />)}
            </div>

            {/* Unified Schema */}
            <div style={{ background: "rgba(0,43,92,0.2)", border: "1px solid rgba(0,43,92,0.4)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Brain size={15} color="#60a5fa" />
                <span style={{ fontSize: 13, fontWeight: 900, color: "#60a5fa" }}>Unified Account Intelligence Schema</span>
              </div>
              <p style={{ fontSize: 11, color: UI.textSoft, marginBottom: 16, lineHeight: 1.6, fontWeight: 600 }}>{intelStackData.unified_schema.description}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {Object.entries(intelStackData.unified_schema.fields).map(([field, desc]) => (
                  <div key={field} style={{ background: "#ffffff", border: "1px solid #f1f5f9", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#60a5fa", fontFamily: "monospace", marginBottom: 5 }}>{field}</div>
                    <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>
                      {typeof desc === "string" ? desc : (desc as any).description}
                    </div>
                    {typeof desc === "object" && (desc as any).components && (
                      <div style={{ marginTop: 8 }}>
                        {((desc as any).components as string[]).map((c: string, i: number) => (
                          <div key={i} style={{ fontSize: 9, color: "#64748b", lineHeight: 1.5, display: "flex", gap: 4 }}>
                            <span style={{ color: "#60a5fa", flexShrink: 0 }}>→</span>{c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: All Providers ── */}
        {activeTab === "providers" && providersData && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {providersData.providers.map(p => (
              <ProviderStatusCard key={p.id} p={p} result={resultMap[p.id]} />
            ))}
          </div>
        )}

        {/* Empty state — show intelligence stack by default */}
        {!result && activeTab === "overview" && (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Search any company above to run unified enrichment, or explore the
            </div>
            <button onClick={() => setActiveTab("intel-stack")}
              style={{ padding: "10px 22px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "rgba(155,28,46,0.15)", border: `1px solid rgba(155,28,46,0.4)`, color: "#0F172A", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Trophy size={14} color={BB_CRIMSON} /> View Intelligence Stack Rankings
            </button>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </Layout>
  );
}
