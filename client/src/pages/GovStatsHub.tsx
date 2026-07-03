import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, RefreshCw, Loader2, AlertTriangle,
  Activity, Pill, DollarSign, Building2, Globe, Landmark, Zap,
  CheckCircle2, AlertCircle, ExternalLink, Brain,
} from "lucide-react";

const NAVY   = "#020818";
const CARD   = "#080f24";
const BORDER = "rgba(255,255,255,0.07)";
const ACCENT = "#3b82f6";

const NEON = {
  blue:   "#00D4FF",
  green:  "#00FF94",
  gold:   "#FFB800",
  red:    "#FF4D6D",
  purple: "#BF5FFF",
  orange: "#FF6B1A",
};

const SOURCE_META: Record<string, { color: string; url: string; full: string }> = {
  BLS:                   { color: NEON.blue,   url: "https://bls.gov",            full: "Bureau of Labor Statistics" },
  "FDA openFDA":         { color: NEON.red,    url: "https://open.fda.gov",       full: "FDA openFDA" },
  "USASpending.gov":     { color: NEON.green,  url: "https://usaspending.gov",    full: "USASpending.gov" },
  "CMS Medicare Part D": { color: NEON.purple, url: "https://data.cms.gov",       full: "CMS Open Data" },
  "FRED (Federal Reserve)": { color: NEON.gold, url: "https://fred.stlouisfed.org", full: "Federal Reserve (FRED)" },
  "US Census Bureau":    { color: NEON.orange, url: "https://census.gov",         full: "US Census Bureau" },
};

function LiveBadge({ live, note }: { live: boolean; note?: string }) {
  return (
    <span title={note}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 800,
        letterSpacing: "0.1em", textTransform: "uppercase",
        background: live ? "rgba(0,255,148,0.10)" : "rgba(255,184,0,0.10)",
        border: `1px solid ${live ? "rgba(0,255,148,0.3)" : "rgba(255,184,0,0.3)"}`,
        color: live ? NEON.green : NEON.gold,
        cursor: note ? "help" : "default",
      }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: live ? NEON.green : NEON.gold }} />
      {live ? "LIVE" : "DEMO"}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: color || "#fff", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function PanelHeader({ icon: Icon, title, source, live, note, color }: {
  icon: typeof Activity; title: string; source: string; live: boolean; note?: string; color: string;
}) {
  const meta = SOURCE_META[source];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} style={{ color }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{title}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
            {meta ? (
              <a href={meta.url} target="_blank" rel="noreferrer"
                style={{ color: color, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                {meta.full} <ExternalLink size={8} />
              </a>
            ) : source}
          </div>
        </div>
      </div>
      <LiveBadge live={live} note={note} />
    </div>
  );
}

function BLSPanel({ data }: { data: any }) {
  const series = data.series || [];
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <PanelHeader icon={Activity} title="Labor & Employment" source="BLS" live={data.live} color={NEON.blue} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {series.map((s: any) => (
          <div key={s.id} style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{s.name}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: NEON.blue }}>{s.value}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{s.period}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
        Updated: {data.updated}
      </div>
    </div>
  );
}

function FDAPanel({ data }: { data: any }) {
  const recalls = data.recent_recalls || [];
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <PanelHeader icon={Pill} title="Drug Safety & Recalls" source="FDA openFDA" live={data.live} color={NEON.red} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
        <StatCard label="Class I Recall Total" value={typeof data.class1_total === "number" ? data.class1_total.toLocaleString() : String(data.class1_total)} color={NEON.red} />
        <StatCard label="Severity" value="Class I" sub="Most serious — may cause death" color={NEON.orange} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Recent Recalls</div>
        {recalls.map((r: any, i: number) => (
          <div key={i} style={{ background: "rgba(255,77,109,0.04)", border: "1px solid rgba(255,77,109,0.12)", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", flex: 1, minWidth: 0 }}>{r.firm}</div>
              <span style={{ fontSize: 8, fontWeight: 800, color: NEON.red, background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.25)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>{r.status}</span>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.product}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{r.reason}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>Updated: {data.updated}</div>
    </div>
  );
}

function USASpendingPanel({ data }: { data: any }) {
  const agencies = data.top_agencies || [];
  const maxAmt = agencies.length > 0 ? Math.max(...agencies.map((a: any) => a.amount || 0)) : 1;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <PanelHeader icon={DollarSign} title="Federal Contract Spend" source="USASpending.gov" live={data.live} color={NEON.green} />
      {data.total_healthcare_contracts_bn && (
        <StatCard label={`FY${data.fiscal_year} Total Healthcare Contracts`} value={`$${data.total_healthcare_contracts_bn.toLocaleString()}B`} color={NEON.green} />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Top Awarding Agencies</div>
        {agencies.map((a: any, i: number) => {
          const pct = maxAmt > 0 ? (a.amount / maxAmt) * 100 : 0;
          const amt = a.amount >= 1e9 ? `$${(a.amount / 1e9).toFixed(1)}B` : a.amount >= 1e6 ? `$${(a.amount / 1e6).toFixed(0)}M` : `$${a.amount?.toLocaleString() ?? "—"}`;
          return (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: NEON.green, flexShrink: 0, marginLeft: 8 }}>{amt}</span>
              </div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${NEON.green}80, ${NEON.green})`, borderRadius: 2, transition: "width 0.6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>Updated: {data.updated}</div>
    </div>
  );
}

function CMSPanel({ data }: { data: any }) {
  const drugs = data.top_drugs_by_spend || [];
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <PanelHeader icon={Landmark} title="Medicare Part D Drug Spend" source="CMS Medicare Part D" live={data.live} color={NEON.purple} />
      {data.nhe_2023_bn && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          <StatCard label="NHE 2023" value={`$${(data.nhe_2023_bn / 1000).toFixed(1)}T`} color={NEON.purple} />
          <StatCard label="Rx Spend" value={`$${data.rx_spend_bn}B`} color={NEON.purple} />
          <StatCard label="Medicare" value={`$${data.medicare_bn}B`} color={NEON.purple} />
        </div>
      )}
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Top Drugs by Spend</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Drug", "Annual Spend", "Claims"].map(h => (
                <th key={h} style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", padding: "3px 6px", textAlign: h === "Drug" ? "left" : "right", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drugs.slice(0, 6).map((d: any, i: number) => (
              <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <td style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", padding: "5px 6px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.drug}</td>
                <td style={{ fontSize: 9, fontWeight: 800, color: NEON.purple, padding: "5px 6px", textAlign: "right" }}>
                  {d.total_spending >= 1e9 ? `$${(d.total_spending / 1e9).toFixed(1)}B` : `$${(d.total_spending / 1e6).toFixed(0)}M`}
                </td>
                <td style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", padding: "5px 6px", textAlign: "right" }}>
                  {d.total_claims >= 1e6 ? `${(d.total_claims / 1e6).toFixed(1)}M` : d.total_claims?.toLocaleString() ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>Updated: {data.updated}</div>
    </div>
  );
}

function FREDPanel({ data }: { data: any }) {
  const indicators = data.indicators || [];
  const hasKey = !data.note;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <PanelHeader icon={TrendingUp} title="Macro Economic Indicators" source="FRED (Federal Reserve)" live={data.live} note={data.note} color={NEON.gold} />
      {!hasKey && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(255,184,0,0.07)", border: "1px solid rgba(255,184,0,0.2)", borderRadius: 8, padding: "8px 10px" }}>
          <AlertCircle size={12} style={{ color: NEON.gold, flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: NEON.gold }}>FRED_API_KEY not configured</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Add a free FRED API key at fred.stlouisfed.org to enable live data. Showing benchmark reference values.</div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {indicators.map((ind: any) => {
          const isPos = ind.change && parseFloat(ind.change) > 0;
          const isNeg = ind.change && parseFloat(ind.change) < 0;
          return (
            <div key={ind.id} style={{ background: "rgba(255,184,0,0.03)", border: "1px solid rgba(255,184,0,0.10)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{ind.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: NEON.gold }}>{ind.value}</div>
                {ind.change && ind.change !== "—" && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: isPos ? NEON.green : isNeg ? NEON.red : "rgba(255,255,255,0.4)" }}>
                    {isPos ? "▲" : isNeg ? "▼" : ""} {ind.change}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{ind.period}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>Updated: {data.updated}</div>
    </div>
  );
}

function CensusPanel({ data }: { data: any }) {
  const stats = data.employer_stats || [];
  const hasKey = !data.note;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <PanelHeader icon={Building2} title="Employer Demographics" source="US Census Bureau" live={data.live} note={data.note} color={NEON.orange} />
      {!hasKey && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(255,107,26,0.07)", border: "1px solid rgba(255,107,26,0.2)", borderRadius: 8, padding: "8px 10px" }}>
          <AlertCircle size={12} style={{ color: NEON.orange, flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: NEON.orange }}>CENSUS_API_KEY not configured</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Add a free Census API key at api.census.gov/data/key_signup.html. Showing 2022 Census reference data.</div>
          </div>
        </div>
      )}
      {data.total_employer_firms && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <StatCard label="Total US Employer Firms" value={`${(data.total_employer_firms / 1e6).toFixed(1)}M`} color={NEON.orange} sub={`Year ${data.data_year}`} />
          <StatCard label="Healthcare Establishments" value={stats[0] ? `${(stats[0].establishments / 1e6).toFixed(1)}M` : "—"} color={NEON.orange} sub="NAICS 62" />
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Sector", "Estab.", "Employees", "Payroll"].map(h => (
              <th key={h} style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", padding: "3px 6px", textAlign: h === "Sector" ? "left" : "right", borderBottom: `1px solid ${BORDER}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s: any, i: number) => (
            <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <td style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", padding: "5px 6px" }}>{s.sector}</td>
              <td style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", padding: "5px 6px", textAlign: "right" }}>{(s.establishments / 1000).toFixed(0)}K</td>
              <td style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", padding: "5px 6px", textAlign: "right" }}>{(s.employees / 1e6).toFixed(1)}M</td>
              <td style={{ fontSize: 9, fontWeight: 700, color: NEON.orange, padding: "5px 6px", textAlign: "right" }}>${s.payroll_bn?.toFixed(0)}B</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>Updated: {data.updated}</div>
    </div>
  );
}

export default function GovStatsHub() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/gov-stats/all"],
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gov-stats/refresh", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gov-stats/all"] });
      toast({ title: "Refreshing", description: "All government data caches cleared. Fetching live data…" });
    },
  });

  async function runAISynthesis() {
    if (!data) return;
    setAiLoading(true);
    setAiSummary(null);
    try {
      const payload = {
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are Kincaid IQ's senior economist and healthcare intelligence analyst. 
Analyze the following government data snapshots and provide a concise, actionable intelligence brief for an employer benefits advisor or CFO. 
Focus on: healthcare cost trends, drug spend implications, labor market context, and macro risk factors.
Write in 4-5 short paragraphs, professional tone, no bullet lists. End with one key action item.`,
          },
          {
            role: "user",
            content: `Government Data Snapshot — ${data.fetched_at}\n\n` +
              `BLS LABOR: ${JSON.stringify(data.sources?.bls?.series?.slice(0, 4))}\n\n` +
              `FDA RECALLS: ${data.sources?.fda?.class1_total} Class I recalls. Recent: ${data.sources?.fda?.recent_recalls?.slice(0, 2).map((r: any) => r.firm + " — " + r.product).join("; ")}\n\n` +
              `CMS DRUG SPEND: ${data.sources?.cms?.nhe_2023_bn ? `NHE $${data.sources.cms.nhe_2023_bn}B, Rx $${data.sources.cms.rx_spend_bn}B` : ""}. Top drugs: ${data.sources?.cms?.top_drugs_by_spend?.slice(0, 3).map((d: any) => d.drug + " $" + (d.total_spending / 1e9).toFixed(1) + "B").join("; ")}\n\n` +
              `FRED MACRO: ${data.sources?.fred?.indicators?.map((i: any) => i.name + ": " + i.value).join(", ")}\n\n` +
              `FEDERAL CONTRACTS: ${JSON.stringify(data.sources?.usaspending?.top_agencies?.slice(0, 3))}\n\n` +
              `CENSUS EMPLOYERS: ${data.sources?.census?.total_employer_firms?.toLocaleString()} employer firms, ${data.sources?.census?.employer_stats?.[0]?.sector}: ${data.sources?.census?.employer_stats?.[0]?.employees?.toLocaleString()} employees`,
          },
        ],
        max_tokens: 600,
        temperature: 0.6,
      };

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setAiSummary(json.choices?.[0]?.message?.content || json.content || json.response || JSON.stringify(json));
    } catch (e: any) {
      toast({ title: "AI error", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  const sources = data?.sources ?? {};
  const liveCount = data?.live_count ?? 0;
  const apiKeys = data?.api_keys_configured ?? {};

  return (
    <Layout fullBleed>
      <div style={{ background: NAVY, minHeight: "100vh", color: "#fff", fontFamily: "system-ui, sans-serif" }}>

        {/* ── Header ── */}
        <div style={{ background: "#040c22", borderBottom: `1px solid ${BORDER}`, padding: "18px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Globe size={18} style={{ color: ACCENT }} />
                <h1 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>Government Statistics Intelligence Hub</h1>
                <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 6, padding: "2px 8px", letterSpacing: "0.08em" }}>KINCAID IQ</span>
              </div>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "4px 0 0" }}>
                Live feeds from 6 free US government APIs — BLS · FDA · USASpending · CMS · FRED · Census
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* API Key status chips */}
              <div style={{ display: "flex", gap: 6 }}>
                {Object.entries(apiKeys).map(([key, configured]) => (
                  <span key={key} title={configured ? `${key} configured` : `Add ${key} to enable live data`}
                    style={{
                      fontSize: 8, fontWeight: 800, letterSpacing: "0.1em",
                      padding: "2px 6px", borderRadius: 4,
                      background: configured ? "rgba(0,255,148,0.08)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${configured ? "rgba(0,255,148,0.2)" : "rgba(255,255,255,0.08)"}`,
                      color: configured ? NEON.green : "rgba(255,255,255,0.2)",
                      cursor: "help",
                    }}>
                    {configured ? <CheckCircle2 size={8} style={{ display: "inline", marginRight: 3 }} /> : ""}
                    {key.replace("_API_KEY", "").replace("_KEY", "")}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", borderLeft: `1px solid ${BORDER}`, paddingLeft: 10 }}>
                {isLoading ? "Loading…" : `${liveCount}/6 live`}
              </div>
              <button
                data-testid="btn-gov-refresh"
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending || isLoading}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 9,
                  background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
                  color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>
                <RefreshCw size={12} style={{ animation: (refresh.isPending || isLoading) ? "spin 1s linear infinite" : undefined }} />
                Refresh All
              </button>
              <button
                data-testid="btn-gov-ai-synthesis"
                onClick={runAISynthesis}
                disabled={aiLoading || !data}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 9,
                  background: aiLoading ? "rgba(59,130,246,0.15)" : `linear-gradient(135deg, #3b82f6, #1d4ed8)`,
                  border: "1px solid rgba(59,130,246,0.4)",
                  color: "#fff", fontSize: 11, fontWeight: 800, cursor: aiLoading ? "not-allowed" : "pointer",
                }}>
                {aiLoading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Brain size={12} />}
                AI Synthesis
              </button>
            </div>
          </div>

          {/* AI Synthesis output */}
          {(aiSummary || aiLoading) && (
            <div style={{ marginTop: 14, background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Zap size={12} style={{ color: ACCENT }} />
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: ACCENT }}>AI Intelligence Brief</span>
              </div>
              {aiLoading
                ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Synthesizing data across all 6 government sources…</div>
                : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiSummary}</div>
              }
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "24px 28px" }}>
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
              <Loader2 size={32} style={{ color: ACCENT, animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Fetching live data from 6 government APIs…</div>
            </div>
          )}

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
              <AlertTriangle size={16} style={{ color: NEON.red }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: NEON.red }}>Could not load government data</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{(error as Error).message}</div>
              </div>
            </div>
          )}

          {data && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <BLSPanel        data={sources.bls         ?? {}} />
              <FDAPanel        data={sources.fda         ?? {}} />
              <USASpendingPanel data={sources.usaspending ?? {}} />
              <CMSPanel        data={sources.cms         ?? {}} />
              <FREDPanel       data={sources.fred        ?? {}} />
              <CensusPanel     data={sources.census      ?? {}} />
            </div>
          )}

          {/* Footer note */}
          {data && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)" }}>Data Sources</div>
                {[
                  { label: "BLS", url: "https://api.bls.gov/publicAPI/v1", note: "No key required" },
                  { label: "FDA openFDA", url: "https://api.fda.gov", note: "No key required" },
                  { label: "USASpending.gov", url: "https://api.usaspending.gov/api/v2", note: "No key required" },
                  { label: "CMS Open Data", url: "https://data.cms.gov", note: "No key required" },
                  { label: "FRED", url: "https://fred.stlouisfed.org", note: "Free key: fred.stlouisfed.org" },
                  { label: "US Census", url: "https://api.census.gov", note: "Free key: api.census.gov/data/key_signup.html" },
                ].map(s => (
                  <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
                    title={s.note}
                    style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}>
                    {s.label} <ExternalLink size={7} />
                  </a>
                ))}
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>Last fetch: {data.fetched_at}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
