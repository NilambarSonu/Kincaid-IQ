import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { monteCarloParams, monteCarloResults, formatCurrency } from "@/lib/mockData";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { TrendingUp, Shield, AlertTriangle, Zap } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const PERCENTILE_COLORS = {
  p90: "#00FF94",
  p75: "#00A8FF",
  p50: "#FFB800",
  p25: "#A855F7",
  p10: "#FF4D6D",
};

interface TooltipProps { active?: boolean; payload?: any[]; label?: string | number; }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const LABELS: Record<string, string> = { p90: "90th pct", p75: "75th pct", p50: "Median", p25: "25th pct", p10: "10th pct" };
  return (
    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", minWidth: 200 }}>
      <p className="font-bold text-[var(--kiq-ink)] mb-2">{label}</p>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.fill || p.stroke }}>{LABELS[p.dataKey] || p.dataKey}</span>
          <span className="font-semibold text-[var(--kiq-ink)]">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MonteCarlo() {
  const { open } = useDrillDown();
  const [annualReturn, setAnnualReturn] = useState(monteCarloParams.expectedReturn);
  const [volatility, setVolatility] = useState(monteCarloParams.volatility);
  const [withdrawal, setWithdrawal] = useState(18);

  const scale = (annualReturn / monteCarloParams.expectedReturn) * ((100 - volatility) / (100 - monteCarloParams.volatility));
  const adjustedMedian = monteCarloResults.percentile50[monteCarloResults.percentile50.length - 1].value * scale;
  const adjustedSuccess = Math.min(99.9, Math.max(40, 97.6 * scale * (18 / withdrawal)));

  const chartData = useMemo(() => monteCarloResults.percentile50.map((pt, i) => ({
    year: pt.year,
    p90: monteCarloResults.percentile90[i].value,
    p75: monteCarloResults.percentile75[i].value,
    p50: pt.value,
    p25: monteCarloResults.percentile25[i].value,
    p10: monteCarloResults.percentile10[i].value,
  })), []);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Probabilistic Planning</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Monte Carlo Forecast
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">1,000-simulation wealth projection across percentile outcomes — 30-year horizon</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Median 30yr Wealth", value: formatCurrency(adjustedMedian), color: "#FFB800", icon: <TrendingUp size={14} />, onClick: () => open("net-worth") },
          { label: "Success Probability", value: `${adjustedSuccess.toFixed(1)}%`, color: "#00FF94", icon: <Shield size={14} />, onClick: () => open("sharpe") },
          { label: "Prob. of Ruin", value: `${(100 - adjustedSuccess).toFixed(1)}%`, color: (100 - adjustedSuccess) < 5 ? "#00FF94" : "#FF4D6D", icon: <AlertTriangle size={14} /> },
          { label: "Annual Withdrawal", value: `$${withdrawal}M`, color: "#00A8FF", icon: <Zap size={14} /> },
        ].map((c) => (
          <div
            key={c.label}
            className="metric-card cursor-pointer"
            style={{ borderTop: `2px solid ${c.color}` }}
            onClick={c.onClick}
            data-testid={`card-mc-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: c.color }}>{c.icon}</span>
              <p className="section-label">{c.label}</p>
            </div>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="metric-card lg:col-span-2" data-testid="card-mc-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-label mb-0.5">Simulation Results</p>
              <h2 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>Wealth Projection Fan Chart</h2>
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              {(Object.entries(PERCENTILE_COLORS) as [string, string][]).map(([k, color]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 rounded" style={{ background: color }} />
                  <span style={{ color }}>{k.replace("p", "")}th pct</span>
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                {(Object.entries(PERCENTILE_COLORS) as [string, string][]).map(([k, color]) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" />
              <XAxis dataKey="year" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1e9).toFixed(0)}B`} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={monteCarloParams.currentNetWorth} stroke="#e2e8f0" strokeDasharray="4 4" label={{ value: "Today", fill: "rgba(150,170,210,0.4)", fontSize: 9 }} />
              <Area type="monotone" dataKey="p90" stroke={PERCENTILE_COLORS.p90} strokeWidth={1.5} fill="url(#grad-p90)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="p75" stroke={PERCENTILE_COLORS.p75} strokeWidth={1.5} fill="url(#grad-p75)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="p50" stroke={PERCENTILE_COLORS.p50} strokeWidth={2.5} fill="url(#grad-p50)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="p25" stroke={PERCENTILE_COLORS.p25} strokeWidth={1.5} fill="url(#grad-p25)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="p10" stroke={PERCENTILE_COLORS.p10} strokeWidth={1.5} fill="url(#grad-p10)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-mc-params">
          <p className="section-label mb-4">Scenario Parameters</p>
          <div className="space-y-5">
            {[
              { label: "Expected Annual Return", value: annualReturn, set: setAnnualReturn, min: 2, max: 14, unit: "%", color: "#00FF94" },
              { label: "Annual Volatility", value: volatility, set: setVolatility, min: 4, max: 28, unit: "%", color: "#FF4D6D" },
              { label: "Annual Withdrawal ($M)", value: withdrawal, set: setWithdrawal, min: 5, max: 60, unit: "M", color: "#FFB800" },
            ].map(({ label, value, set, min, max, unit, color }) => {
              const pct = ((value - min) / (max - min)) * 100;
              return (
                <div key={label}>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <span className="text-sm font-bold" style={{ color, fontFamily: "var(--font-display)" }}>{value}{unit}</span>
                  </div>
                  <input type="range" min={min} max={max} step={unit === "M" ? 1 : 0.2} value={value}
                    onChange={(e) => set(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, ${color} ${pct}%, #e2e8f0 ${pct}%)` }}
                    data-testid={`slider-mc-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-6 space-y-2">
            <p className="section-label mb-3">Percentile Outcomes (30yr)</p>
            {[
              { label: "Best 10%", value: chartData[chartData.length-1].p90, color: "#00FF94" },
              { label: "Best 25%", value: chartData[chartData.length-1].p75, color: "#00A8FF" },
              { label: "Median", value: chartData[chartData.length-1].p50, color: "#FFB800" },
              { label: "Worst 25%", value: chartData[chartData.length-1].p25, color: "#A855F7" },
              { label: "Worst 10%", value: chartData[chartData.length-1].p10, color: "#FF4D6D" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-bold" style={{ color: r.color }}>{formatCurrency(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
