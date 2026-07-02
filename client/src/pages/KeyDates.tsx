import { useState } from "react";
import { Layout } from "@/components/Layout";
import { keyDates } from "@/lib/mockData";
import { AlertTriangle, Calendar, Shield, FileText, Users, Clock, CheckCircle } from "lucide-react";

const CATEGORY_STYLES: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  Tax:         { color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.2)", icon: FileText },
  Trust:       { color: "#00FF94", bg: "rgba(0,255,148,0.08)", border: "rgba(0,255,148,0.2)", icon: Shield },
  Compliance:  { color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)", icon: CheckCircle },
  Governance:  { color: "#A855F7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)", icon: Users },
  Beneficiary: { color: "#FF8C00", bg: "rgba(255,140,0,0.08)", border: "rgba(255,140,0,0.2)", icon: Users },
};
const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#FF4D6D", High: "#FFB800", Medium: "#00A8FF", Low: "rgba(150,170,210,0.5)",
};

export default function KeyDates() {
  const [filter, setFilter] = useState<string>("All");
  const categories = ["All", "Tax", "Trust", "Compliance", "Governance", "Beneficiary"];

  const upcoming30 = keyDates.filter(d => d.daysUntil <= 30).length;
  const critical = keyDates.filter(d => d.priority === "Critical").length;
  const highPriority = keyDates.filter(d => d.priority === "High").length;

  const filtered = keyDates.filter(d => filter === "All" || d.category === filter)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Key Dates & Compliance
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Trust anniversaries, GRAT zeroing dates, tax deadlines, and governance milestones</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Due in 30 Days", value: `${upcoming30}`, color: "#FF4D6D", sub: "Immediate action" },
          { label: "Critical", value: `${critical}`, color: "#FFB800", sub: "High-impact events" },
          { label: "High Priority", value: `${highPriority}`, color: "#00A8FF", sub: "This quarter" },
          { label: "Total Tracked", value: `${keyDates.length}`, color: "rgba(150,170,210,0.6)", sub: "Compliance items" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-dates-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {upcoming30 > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl mb-6"
          style={{ background: "rgba(255,77,109,0.05)", border: "1px solid rgba(255,77,109,0.15)" }}
          data-testid="alert-upcoming-dates">
          <AlertTriangle size={14} style={{ color: "#FF4D6D", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#FF4D6D" }}>{upcoming30} item{upcoming30>1?"s":""} due within 30 days</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {keyDates.filter(d => d.daysUntil <= 30).map(d => d.title).join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-4">
        {categories.map((cat) => {
          const cs = cat !== "All" ? CATEGORY_STYLES[cat] : null;
          return (
            <button key={cat} onClick={() => setFilter(cat)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                background: filter === cat ? (cs?.bg || "rgba(0,168,255,0.1)") : "rgba(255,255,255,0.03)",
                border: `1px solid ${filter === cat ? (cs?.border || "rgba(0,168,255,0.25)") : "rgba(255,255,255,0.06)"}`,
                color: filter === cat ? (cs?.color || "#00A8FF") : "rgba(150,170,210,0.5)",
              }}
              data-testid={`filter-dates-${cat.toLowerCase()}`}>{cat}</button>
          );
        })}
      </div>

      <div className="space-y-3" data-testid="list-key-dates">
        {filtered.map((item) => {
          const cs = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Compliance;
          const Icon = cs.icon;
          const priorityColor = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.Low;
          const isUrgent = item.daysUntil <= 30;
          const dateStr = new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          return (
            <div key={item.id}
              className="metric-card"
              style={{
                cursor: "default",
                borderLeft: `3px solid ${isUrgent ? "#FF4D6D" : item.priority === "Critical" ? "#FFB800" : cs.color}`,
              }}
              data-testid={`row-date-${item.id}`}>
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
                  <Icon size={14} style={{ color: cs.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="font-bold text-sm text-white">{item.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: priorityColor, background: `${priorityColor}12`, border: `1px solid ${priorityColor}25` }}>
                        {item.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{item.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                      {item.category}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar size={9} /> {dateStr}
                    </span>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: isUrgent ? "#FF4D6D" : item.daysUntil <= 90 ? "#FFB800" : "rgba(150,170,210,0.6)" }}>
                      <Clock size={9} />
                      {item.daysUntil <= 0 ? "Today" : `${item.daysUntil}d`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
