import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle, Download } from "lucide-react";
import { DoctrineBar } from "@/components/Doctrine";

function KpiCard({ kpi }: { kpi: any }) {
  const statusColor = kpi.status === "green" ? "text-green-400 border-green-500/20 bg-green-500/5"
    : kpi.status === "yellow" ? "text-amber-400 border-amber-500/20 bg-amber-500/5"
    : "text-red-400 border-red-500/20 bg-red-500/5";
  const isOver = kpi.variance_pct > 0;
  return (
    <div className="kiq-health-card rounded-xl p-4 hover:border-cyan-400/25 transition-colors" data-testid={`kpi-${kpi.key}`}>
      <p className="text-[var(--kiq-muted)] text-xs mb-2">{kpi.label}</p>
      <p className="text-2xl font-bold text-[var(--kiq-ink)] mb-1">
        {kpi.format === "currency" ? `$${kpi.value.toFixed(0)}` : kpi.format === "percent" ? `${kpi.value}%` : kpi.value}
      </p>
      <div className="flex items-center justify-between">
        <p className="text-[var(--kiq-muted)] text-xs">
          Benchmark: {kpi.format === "currency" ? `$${kpi.benchmark}` : kpi.format === "percent" ? `${kpi.benchmark}%` : kpi.benchmark}
        </p>
        <Badge className={`text-xs border ${statusColor}`}>
          {isOver ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {Math.abs(kpi.variance_pct)}% {isOver ? "above" : "below"}
        </Badge>
      </div>
    </div>
  );
}

function ComplianceItem({ item }: { item: any }) {
  const icon = item.status === "PASS" ? <CheckCircle className="w-4 h-4 text-green-400" />
    : item.status === "FAIL" ? <XCircle className="w-4 h-4 text-red-400" />
    : <AlertTriangle className="w-4 h-4 text-amber-400" />;
  const bg = item.status === "PASS" ? "border-green-500/10"
    : item.status === "FAIL" ? "border-red-500/20 bg-red-500/3"
    : "border-amber-500/20 bg-amber-500/3";
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${bg}`} data-testid={`compliance-${item.rule.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm text-[var(--kiq-ink)]/80 font-medium">{item.rule}</p>
          {item.due && <p className="text-xs text-[var(--kiq-ink)]/40">Due: {item.due}</p>}
        </div>
      </div>
      <Badge className={`text-xs ${item.status === "PASS" ? "bg-green-500/10 text-green-400 border-green-500/20" : item.status === "FAIL" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
        {item.status}
      </Badge>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-lg p-3 text-xs shadow-md">
      <p className="text-[var(--kiq-muted)] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: ${(p.value / 1000).toFixed(0)}K</p>
      ))}
    </div>
  );
};

export default function SaasFiduciary() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/saas/fiduciary/dashboard"] });
  const { data: bench } = useQuery<any>({ queryKey: ["/api/saas/fiduciary/benchmarks"] });

  if (isLoading) return (
    <div className="p-6 space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="kiq-health-card h-24 animate-pulse" />)}
    </div>
  );

  const compliance = data?.erisa_compliance;

  return (
    <div className="kiq-health-shell p-6 space-y-6 max-w-7xl">
      <DoctrineBar
        gate="THRESHOLD_EVALUATION"
        tier={compliance?.score >= 80 ? "CERTIFIED" : compliance?.score >= 60 ? "MODELED" : "INSUFFICIENT_EVIDENCE"}
        einName={data?.org?.name}
      />
      {/* Header */}
      <div className="kiq-command-hero flex items-center justify-between px-6 py-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-[var(--kiq-ink)]">Plan Fiduciary Dashboard</h1>
          </div>
          <p className="text-[var(--kiq-ink)]/40 text-sm">{data?.org?.name} · ERISA §404 Fiduciary Intelligence</p>
        </div>
        <Button variant="outline" size="sm" className="kiq-command-control text-[var(--kiq-ink-soft)] gap-2 hover:bg-[var(--kiq-surface)]/80" data-testid="btn-export">
          <Download className="w-4 h-4" /> Export Report
        </Button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.kpis?.map((kpi: any) => <KpiCard key={kpi.key} kpi={kpi} />)}
      </div>

      {/* Cost trend + compliance */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cost trend */}
        <div className="lg:col-span-2 kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">12-Month Cost Trend vs. Budget</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.cost_trend}>
              <XAxis dataKey="period" tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="actual" stroke="#00A8FF" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="budget" stroke="#FFB800" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Budget" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ERISA compliance gauge */}
        <div className="kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">ERISA Compliance Score</h2>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff10" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={compliance?.score >= 80 ? "#00FF94" : compliance?.score >= 60 ? "#FFB800" : "#FF4D6D"} strokeWidth="12"
                  strokeDasharray={`${(compliance?.score / 100) * 314} 314`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-[var(--kiq-ink)]">{compliance?.score}</span>
                <span className="text-[var(--kiq-ink)]/40 text-sm">{compliance?.grade}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {compliance?.items?.slice(0, 4).map((item: any) => (
              <div key={item.rule} className="flex items-center justify-between py-1">
                <span className="text-xs text-[var(--kiq-ink)]/50 truncate">{item.rule}</span>
                <Badge className={`text-xs ml-2 flex-shrink-0 ${item.status === "PASS" ? "bg-green-500/10 text-green-400 border-green-500/20" : item.status === "FAIL" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost drivers + benchmarks */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cost drivers */}
        <div className="kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Cost Drivers by Category</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.cost_drivers} layout="vertical">
              <XAxis type="number" tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <YAxis dataKey="category" type="category" tick={{ fill: "#ffffff60", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip formatter={(v: any) => [`$${(v/1000).toFixed(0)}K`, "Spend"]} contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                {data?.cost_drivers?.map((_: any, i: number) => {
                  const colors = ["#00A8FF", "#00FF94", "#FFB800", "#A855F7", "#FF4D6D", "#00BCD4"];
                  return <Cell key={i} fill={colors[i % colors.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Benchmarks */}
        <div className="kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Benchmark Comparison</h2>
          <div className="text-xs text-[var(--kiq-ink)]/40 mb-3">
            Cohort: {bench?.cohort?.industry} · {bench?.cohort?.region} · {bench?.cohort?.size_band} employees
          </div>
          <div className="space-y-3">
            {bench?.benchmarks?.map((b: any) => {
              const pos = Math.min(Math.max((b.your_value - b.p25) / (b.p75 - b.p25) * 100, 0), 100);
              return (
                <div key={b.metric} data-testid={`bench-${b.metric.replace(/\s+/g, "-").toLowerCase()}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--kiq-ink)]/60">{b.metric}</span>
                    <span className="text-[var(--kiq-ink)] font-medium">{b.your_value}</span>
                  </div>
                  <div className="relative h-2 bg-slate-200/70 rounded-full">
                    <div className="absolute h-full bg-gradient-to-r from-green-500/40 via-amber-500/40 to-red-500/40 rounded-full w-full" />
                    <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--kiq-surface)] border border-[#020409] shadow" style={{ left: `calc(${pos}% - 5px)` }} />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--kiq-ink)]/20 mt-0.5">
                    <span>P25: {b.p25}</span><span>P50: {b.p50}</span><span>P75: {b.p75}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full compliance table */}
      <div className="kiq-health-card rounded-2xl p-5">
        <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Full ERISA Compliance Matrix</h2>
        <div className="grid md:grid-cols-2 gap-2">
          {compliance?.items?.map((item: any) => <ComplianceItem key={item.rule} item={item} />)}
        </div>
      </div>
    </div>
  );
}
