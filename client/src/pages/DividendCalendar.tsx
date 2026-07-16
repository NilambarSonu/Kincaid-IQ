import { useState } from "react";
import { Layout } from "@/components/Layout";
import { dividendSchedule, formatCurrency } from "@/lib/mockData";
import { Calendar, TrendingUp, Banknote, Clock } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

type EventType = "Dividend" | "Rent" | "Distribution" | "Charitable";

const TYPE_COLORS: Record<EventType, { color: string; bg: string; border: string }> = {
  Dividend:     { color: "#00FF94", bg: "rgba(0,255,148,0.08)", border: "rgba(0,255,148,0.2)" },
  Rent:         { color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)" },
  Distribution: { color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.2)" },
  Charitable:   { color: "#A855F7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)" },
};

const MONTHS = ["Apr '26", "May '26", "Jun '26", "Jul '26", "Aug '26", "Sep '26", "Oct '26", "Nov '26", "Dec '26", "Jan '27", "Feb '27", "Mar '27"];
const MONTH_KEYS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];

export default function DividendCalendar() {
  const { open } = useDrillDown();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"All" | EventType>("All");

  const totalAnnual = dividendSchedule.reduce((s, e) => s + e.amount, 0);
  const totalDividends = dividendSchedule.filter((e) => e.type === "Dividend").reduce((s, e) => s + e.amount, 0);
  const totalDistributions = dividendSchedule.filter((e) => e.type === "Distribution").reduce((s, e) => s + e.amount, 0);
  const totalRent = dividendSchedule.filter((e) => e.type === "Rent").reduce((s, e) => s + e.amount, 0);

  const monthTotals = MONTH_KEYS.map((mk, i) => ({
    month: MONTHS[i],
    key: mk,
    total: dividendSchedule.filter((e) => e.date.startsWith(mk)).reduce((s, e) => s + e.amount, 0),
    events: dividendSchedule.filter((e) => e.date.startsWith(mk)),
  }));

  const maxMonth = Math.max(...monthTotals.map((m) => m.total));

  const filteredEvents = dividendSchedule.filter((e) => {
    const monthMatch = !selectedMonth || e.date.startsWith(selectedMonth);
    const typeMatch = filterType === "All" || e.type === filterType;
    return monthMatch && typeMatch;
  }).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Income Planning</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Income Calendar
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">12-month forward view of all expected dividends, distributions, and rental income</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Annual Income", value: formatCurrency(totalAnnual), color: "#00FF94", onClick: () => open("liquidity") },
          { label: "Dividends", value: formatCurrency(totalDividends), color: "#00A8FF" },
          { label: "Distributions", value: formatCurrency(totalDistributions), color: "#FFB800" },
          { label: "Rental Income", value: formatCurrency(totalRent), color: "#A855F7" },
        ].map((c) => (
          <div key={c.label} className="metric-card cursor-pointer" style={{ borderTop: `2px solid ${c.color}` }} onClick={c.onClick}
            data-testid={`card-cal-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="metric-card mb-6" data-testid="card-cal-monthly-bars">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">Monthly Income — Click to Filter</p>
          <button onClick={() => setSelectedMonth(null)} className="text-xs text-muted-foreground hover:text-[var(--kiq-ink)] transition-colors">Clear filter</button>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
          {monthTotals.map((m) => {
            const barH = maxMonth > 0 ? (m.total / maxMonth) * 100 : 0;
            const isSelected = selectedMonth === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMonth(isSelected ? null : m.key)}
                className="flex flex-col items-center gap-1 group"
                data-testid={`bar-cal-${m.key}`}
              >
                <div className="text-[9px] font-semibold text-[var(--kiq-ink)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {formatCurrency(m.total)}
                </div>
                <div className="w-full h-16 flex items-end rounded-lg overflow-hidden" style={{ background: "#ffffff" }}>
                  <div
                    className="w-full rounded-t-lg transition-all duration-300"
                    style={{
                      height: `${Math.max(barH, 4)}%`,
                      background: isSelected ? "#00FF94" : m.total > 5_000_000 ? "#FFB800" : "rgba(0,168,255,0.4)",
                      boxShadow: isSelected ? "0 0 8px rgba(0,255,148,0.5)" : undefined,
                    }}
                  />
                </div>
                <div className="text-[9px] text-muted-foreground whitespace-nowrap">{m.month.split(" ")[0]}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="metric-card" data-testid="card-cal-events">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">
            {selectedMonth ? `Events — ${MONTHS[MONTH_KEYS.indexOf(selectedMonth)]}` : "All Upcoming Events"}
          </p>
          <div className="flex gap-2">
            {(["All", "Dividend", "Distribution", "Rent", "Charitable"] as const).map((t) => {
              const c = t !== "All" ? TYPE_COLORS[t as EventType] : null;
              return (
                <button key={t} onClick={() => setFilterType(t as typeof filterType)}
                  className="text-[10px] px-2 py-1 rounded-lg capitalize transition-all"
                  style={{
                    background: filterType === t ? (c?.bg || "rgba(0,168,255,0.12)") : "#ffffff",
                    border: `1px solid ${filterType === t ? (c?.border || "rgba(0,168,255,0.3)") : "#f1f5f9"}`,
                    color: filterType === t ? (c?.color || "#00A8FF") : "rgba(150,170,210,0.5)",
                  }}
                  data-testid={`filter-cal-${t.toLowerCase()}`}
                >{t}</button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          {filteredEvents.map((event) => {
            const cs = TYPE_COLORS[event.type as EventType] || TYPE_COLORS.Dividend;
            const date = new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-[var(--kiq-surface)]/5 cursor-pointer"
                style={{ border: "1px solid #f8fafc" }}
                onClick={() => open("liquidity")}
                data-testid={`row-cal-${event.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
                    {event.type === "Rent" ? <Banknote size={13} style={{ color: cs.color }} /> :
                     event.type === "Distribution" ? <TrendingUp size={13} style={{ color: cs.color }} /> :
                     <Calendar size={13} style={{ color: cs.color }} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--kiq-ink)]">{event.source}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>{event.type}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={9} /> {date}</span>
                      <span className="text-xs text-muted-foreground">{event.frequency}</span>
                      <span className="text-xs text-muted-foreground">{event.yieldPct}% yield</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold" style={{ color: cs.color }}>{formatCurrency(event.amount)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
