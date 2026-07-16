import { useState } from "react";
import { Layout } from "@/components/Layout";
import { capitalCallsData, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Calendar, TrendingUp, ArrowDownLeft, Filter, ChevronDown, ChevronUp } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  Buyout: "#00A8FF", Venture: "#A855F7", "Real Estate": "#FFB800",
  "Private Credit": "#00FF94", Infrastructure: "#00E5FF", "Growth Equity": "#FF8C00",
};

export default function CapitalCalls() {
  const [view, setView] = useState<"funds" | "upcoming" | "distributions">("funds");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");

  const types = ["All", ...Array.from(new Set(capitalCallsData.funds.map(f => f.type)))];
  const filtered = typeFilter === "All" ? capitalCallsData.funds : capitalCallsData.funds.filter(f => f.type === typeFilter);

  const deploymentData = capitalCallsData.funds.map(f => ({
    name: f.name.split(" ").slice(-1)[0],
    committed: f.committed / 1e6,
    called: f.called / 1e6,
    uncalled: f.uncalled / 1e6,
    color: f.color,
  }));

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Portfolio & Risk</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Capital Call Tracker
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">12 fund commitments — called vs uncalled capital, upcoming calls, and distribution history</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Committed", value: formatCurrency(capitalCallsData.totalCommitted), color: "#00A8FF" },
          { label: "Capital Called", value: formatCurrency(capitalCallsData.totalCalled), color: "#FFB800" },
          { label: "Uncalled", value: formatCurrency(capitalCallsData.totalUncalled), color: "#FF4D6D", sub: `${((capitalCallsData.totalUncalled/capitalCallsData.totalCommitted)*100).toFixed(0)}% remaining` },
          { label: "Total NAV", value: formatCurrency(capitalCallsData.totalNAV), color: "#00FF94" },
          { label: "Distributions", value: formatCurrency(capitalCallsData.totalDistributions), color: "#A855F7" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-cc-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        {(["funds", "upcoming", "distributions"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className="text-xs px-4 py-2 rounded-xl font-semibold capitalize transition-all"
            style={{
              background: view === v ? "rgba(0,168,255,0.1)" : "#ffffff",
              border: `1px solid ${view === v ? "rgba(0,168,255,0.3)" : "#f1f5f9"}`,
              color: view === v ? "#00A8FF" : "rgba(150,170,210,0.5)",
            }}
            data-testid={`tab-${v}`}>{v === "funds" ? "All Funds" : v === "upcoming" ? `Upcoming Calls (${capitalCallsData.upcomingCalls.length})` : "Distribution Log"}</button>
        ))}
      </div>

      {view === "funds" && (
        <>
          <div className="flex gap-2 flex-wrap mb-4">
            {types.map((t) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className="text-xs px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: typeFilter === t ? "rgba(0,168,255,0.08)" : "#ffffff",
                  border: `1px solid ${typeFilter === t ? "rgba(0,168,255,0.25)" : "#f1f5f9"}`,
                  color: typeFilter === t ? "#00A8FF" : "rgba(150,170,210,0.5)",
                }}
                data-testid={`filter-type-${t.toLowerCase().replace(/\s+/g,"-")}`}>{t}</button>
            ))}
          </div>
          <div className="space-y-2" data-testid="list-funds">
            {filtered.map((fund) => {
              const color = TYPE_COLORS[fund.type] || "#00A8FF";
              const callPct = (fund.called / fund.committed) * 100;
              const isExpanded = expanded === fund.id;
              return (
                <div key={fund.id} className="metric-card" style={{ borderLeft: `3px solid ${color}`, cursor: "default" }}
                  data-testid={`row-fund-${fund.id}`}>
                  <button className="w-full flex items-center gap-4" onClick={() => setExpanded(isExpanded ? null : fund.id)}>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm text-[var(--kiq-ink)]">{fund.name}</p>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${color}12`, color, border: `1px solid ${color}22` }}>{fund.type}</span>
                        <span className="text-[9px] text-muted-foreground">Vintage {fund.vintage}</span>
                        {fund.currency !== "USD" && <span className="text-[9px] text-muted-foreground">{fund.currency}</span>}
                      </div>
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f8fafc", maxWidth: 200 }}>
                          <div className="h-full rounded-full" style={{ width: `${callPct}%`, background: color }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{callPct.toFixed(0)}% called</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right flex-shrink-0">
                      <div><p className="text-[9px] text-muted-foreground">Committed</p><p className="text-sm font-bold text-[var(--kiq-ink)]">{formatCurrency(fund.committed)}</p></div>
                      <div><p className="text-[9px] text-muted-foreground">NAV</p><p className="text-sm font-bold" style={{ color }}>{formatCurrency(fund.nav)}</p></div>
                      <div><p className="text-[9px] text-muted-foreground">TVPI</p><p className="text-sm font-bold" style={{ color: fund.tvpi >= 1.5 ? "#00FF94" : fund.tvpi >= 1.2 ? "#FFB800" : "#FF4D6D" }}>{fund.tvpi.toFixed(2)}x</p></div>
                      <div><p className="text-[9px] text-muted-foreground">IRR</p><p className="text-sm font-bold" style={{ color: fund.irr >= 20 ? "#00FF94" : fund.irr >= 12 ? "#FFB800" : "#FF4D6D" }}>{fund.irr.toFixed(1)}%</p></div>
                      {isExpanded ? <ChevronUp size={13} style={{ color: "rgba(130,150,200,0.4)" }} /> : <ChevronDown size={13} style={{ color: "rgba(130,150,200,0.4)" }} />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-3 pt-3 grid grid-cols-2 sm:grid-cols-5 gap-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                      {[
                        { l: "Called", v: formatCurrency(fund.called) }, { l: "Uncalled", v: formatCurrency(fund.uncalled) },
                        { l: "Distributions", v: formatCurrency(fund.distributions) }, { l: "DPI", v: `${fund.dpi.toFixed(2)}x` },
                        { l: "Manager", v: fund.manager },
                      ].map((r) => (
                        <div key={r.l}><p className="text-[9px] text-muted-foreground">{r.l}</p><p className="text-sm font-semibold text-[var(--kiq-ink)]">{r.v}</p></div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "upcoming" && (
        <div className="space-y-3" data-testid="list-upcoming-calls">
          {capitalCallsData.upcomingCalls.map((call) => {
            const daysUntil = Math.floor((new Date(call.expectedDate).getTime() - Date.now()) / (1000*60*60*24));
            const fund = capitalCallsData.funds.find(f => f.name === call.fund);
            const color = fund ? (TYPE_COLORS[fund.type] || "#00A8FF") : "#00A8FF";
            return (
              <div key={call.id} className="metric-card" style={{ borderLeft: `3px solid ${daysUntil <= 30 ? "#FF4D6D" : "#FFB800"}` }}
                data-testid={`row-call-${call.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-sm text-[var(--kiq-ink)]">{call.fund}</p>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>Call #{call.callNumber}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{call.notes}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold" style={{ color: "#FF4D6D", fontFamily: "var(--font-display)" }}>{formatCurrency(call.estimatedAmount)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(call.expectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    <p className="text-[10px] font-semibold mt-0.5" style={{ color: daysUntil <= 30 ? "#FF4D6D" : "#FFB800" }}>{daysUntil}d away</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="metric-card" style={{ background: "rgba(255,77,109,0.03)", border: "1px solid rgba(255,77,109,0.1)" }}>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-[var(--kiq-ink)]">Total Upcoming Calls</span>
              <span className="font-bold" style={{ color: "#FF4D6D" }}>{formatCurrency(capitalCallsData.upcomingCalls.reduce((s, c) => s + c.estimatedAmount, 0))}</span>
            </div>
          </div>
        </div>
      )}

      {view === "distributions" && (
        <div className="space-y-3" data-testid="list-distributions">
          {capitalCallsData.distributions.map((d) => {
            const fund = capitalCallsData.funds.find(f => f.name === d.fund);
            const color = fund ? (TYPE_COLORS[fund.type] || "#00FF94") : "#00FF94";
            return (
              <div key={d.id} className="metric-card" style={{ borderLeft: `3px solid #00FF94` }}
                data-testid={`row-dist-${d.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <ArrowDownLeft size={16} style={{ color: "#00FF94", flexShrink: 0, marginTop: 2 }} />
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-[var(--kiq-ink)]">{d.fund}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(0,255,148,0.08)", color: "#00FF94", border: "1px solid rgba(0,255,148,0.2)" }}>{d.type}</span>
                        <span className="text-xs text-muted-foreground">{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xl font-bold flex-shrink-0" style={{ color: "#00FF94", fontFamily: "var(--font-display)" }}>{formatCurrency(d.amount)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
