import { Layout } from "@/components/Layout";
import { cashFlowProjection, formatCurrency } from "@/lib/mockData";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { Banknote, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const INFLOW_KEYS = ["dividends", "rent", "distributions", "interest"] as const;
const OUTFLOW_KEYS = ["livingExpenses", "taxes", "capitalCalls", "charitable"] as const;

const INFLOW_COLORS: Record<string, string> = {
  dividends: "#00FF94",
  rent: "#00A8FF",
  distributions: "#A855F7",
  interest: "#00E5FF",
};
const OUTFLOW_COLORS: Record<string, string> = {
  livingExpenses: "#FF4D6D",
  taxes: "#FF8C00",
  capitalCalls: "#FFB800",
  charitable: "#F472B6",
};

const LABELS: Record<string, string> = {
  dividends: "Dividends",
  rent: "Rental Income",
  distributions: "Fund Distributions",
  interest: "Interest",
  livingExpenses: "Living Expenses",
  taxes: "Taxes",
  capitalCalls: "Capital Calls",
  charitable: "Charitable",
};

interface TooltipProps { active?: boolean; payload?: any[]; label?: string; }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs" style={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", minWidth: 180 }}>
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.fill || p.stroke }}>{LABELS[p.dataKey] || p.dataKey}</span>
          <span className="font-semibold text-white">{formatCurrency(Math.abs(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export default function CashFlow() {
  const { open } = useDrillDown();

  const processed = cashFlowProjection.map((m) => {
    const totalInflow = INFLOW_KEYS.reduce((s, k) => s + m[k], 0);
    const totalOutflow = OUTFLOW_KEYS.reduce((s, k) => s + Math.abs(m[k]), 0);
    const net = totalInflow - totalOutflow;
    return { ...m, totalInflow, totalOutflow, net };
  });

  let cumulative = 0;
  const cumulativeData = processed.map((m) => {
    cumulative += m.net;
    return { month: m.month, net: m.net, cumulative };
  });

  const annualInflow = processed.reduce((s, m) => s + m.totalInflow, 0);
  const annualOutflow = processed.reduce((s, m) => s + m.totalOutflow, 0);
  const annualNet = annualInflow - annualOutflow;
  const peakMonth = processed.reduce((best, m) => m.net > best.net ? m : best);
  const biggestCallMonth = processed.reduce((worst, m) => Math.abs(m.capitalCalls) > Math.abs(worst.capitalCalls) ? m : worst);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Forecasting</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Cash Flow Projection
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">12-month forward view of all inflows and outflows across the portfolio</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div
          className="metric-card cursor-pointer group"
          style={{ borderTop: "2px solid #00FF94" }}
          onClick={() => open("ytd-return")}
          data-testid="card-annual-net"
        >
          <p className="section-label mb-2">Annual Net Cash Flow</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: annualNet >= 0 ? "#00FF94" : "#FF4D6D" }}>
            {annualNet >= 0 ? "+" : ""}{formatCurrency(annualNet)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">12-month projection</p>
        </div>
        <div className="metric-card" style={{ borderTop: "2px solid #00A8FF" }} data-testid="card-annual-inflow">
          <p className="section-label mb-2">Total Inflows</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#00A8FF" }}>
            {formatCurrency(annualInflow)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Dividends, rent, distributions</p>
        </div>
        <div className="metric-card" style={{ borderTop: "2px solid #FF4D6D" }} data-testid="card-annual-outflow">
          <p className="section-label mb-2">Total Outflows</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#FF4D6D" }}>
            {formatCurrency(annualOutflow)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Expenses, taxes, calls</p>
        </div>
        <div className="metric-card" style={{ borderTop: "2px solid #FFB800" }} data-testid="card-peak-month">
          <div className="flex items-center gap-2 mb-2">
            {biggestCallMonth && Math.abs(biggestCallMonth.capitalCalls) > 3_000_000 ? (
              <AlertTriangle size={12} style={{ color: "#FFB800" }} />
            ) : null}
            <p className="section-label">Largest Capital Call</p>
          </div>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#FFB800" }}>
            {formatCurrency(Math.abs(biggestCallMonth?.capitalCalls || 0))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{biggestCallMonth?.month} — plan liquidity</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-cashflow-bar">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-label mb-0.5">Monthly Cash Flow</p>
              <p className="text-xs text-muted-foreground">Stacked inflows vs outflows</p>
            </div>
            <Banknote size={16} style={{ color: "rgba(0,168,255,0.4)" }} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={processed} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} />
              {INFLOW_KEYS.map((k) => <Bar key={k} dataKey={k} stackId="in" fill={INFLOW_COLORS[k]}  isAnimationActive={false} />)}
              {OUTFLOW_KEYS.map((k) => <Bar key={k} dataKey={k} stackId="out" fill={OUTFLOW_COLORS[k]}  isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-cashflow-cumulative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-label mb-0.5">Cumulative Cash Position</p>
              <p className="text-xs text-muted-foreground">Running net cash flow balance</p>
            </div>
            <TrendingUp size={16} style={{ color: "rgba(0,255,148,0.4)" }} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={cumulativeData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
              <Line dataKey="net" stroke="#00A8FF" strokeWidth={2} dot={{ fill: "#00A8FF", r: 3 }} name="Monthly Net"  isAnimationActive={false} />
              <Line dataKey="cumulative" stroke="#00FF94" strokeWidth={2.5} dot={false} name="Cumulative"  isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="metric-card" data-testid="card-cashflow-breakdown">
        <p className="section-label mb-4">Monthly Breakdown</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Month", "Dividends", "Rent", "Distributions", "Interest", "Expenses", "Taxes", "Cap Calls", "Charitable", "Net"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processed.map((m) => (
                <tr
                  key={m.month}
                  className="hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onClick={() => open("liquidity")}
                  data-testid={`row-cashflow-${m.month.toLowerCase()}`}
                >
                  <td className="px-3 py-2 font-semibold">{m.month}</td>
                  <td className="px-3 py-2 value-positive">{formatCurrency(m.dividends)}</td>
                  <td className="px-3 py-2 value-positive">{formatCurrency(m.rent)}</td>
                  <td className="px-3 py-2" style={{ color: m.distributions > 0 ? "#00FF94" : "rgba(130,150,200,0.4)" }}>
                    {m.distributions > 0 ? formatCurrency(m.distributions) : "—"}
                  </td>
                  <td className="px-3 py-2 value-positive">{formatCurrency(m.interest)}</td>
                  <td className="px-3 py-2 value-negative">{formatCurrency(Math.abs(m.livingExpenses))}</td>
                  <td className="px-3 py-2 value-negative">{formatCurrency(Math.abs(m.taxes))}</td>
                  <td className="px-3 py-2" style={{ color: Math.abs(m.capitalCalls) > 3_000_000 ? "#FFB800" : "rgba(255,77,109,0.7)" }}>
                    {m.capitalCalls < 0 ? formatCurrency(Math.abs(m.capitalCalls)) : "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "rgba(244,114,182,0.7)" }}>
                    {m.charitable < 0 ? formatCurrency(Math.abs(m.charitable)) : "—"}
                  </td>
                  <td className="px-3 py-2 font-bold" style={{ color: m.net >= 0 ? "#00FF94" : "#FF4D6D" }}>
                    {m.net >= 0 ? "+" : ""}{formatCurrency(m.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
