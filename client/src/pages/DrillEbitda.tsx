import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  TrendingDown, TrendingUp, BarChart3, ArrowLeft,
  AlertTriangle, DollarSign, Activity, Zap,
} from "lucide-react";

const MOCK_EBITDA_SERIES = [
  { period: "Q1 2024", ebitda: 3_250_000, drag: 985_000, margin: 32.1 },
  { period: "Q2 2024", ebitda: 3_410_000, drag: 1_042_000, margin: 31.4 },
  { period: "Q3 2024", ebitda: 3_180_000, drag: 1_285_000, margin: 29.8 },
  { period: "Q4 2024", ebitda: 3_540_000, drag: 1_120_000, margin: 33.2 },
  { period: "Q1 2025", ebitda: 3_620_000, drag: 1_095_000, margin: 34.1 },
  { period: "Q2 2025", ebitda: 3_710_000, drag: 1_015_000, margin: 34.9 },
];

const DRAG_CATEGORIES = [
  { category: "Benefits Premium Overrun",   amount: 485_000, pct: 37.7, trend: "up" },
  { category: "Provider Network Leakage",   amount: 312_000, pct: 24.3, trend: "up" },
  { category: "Rx Utilization Excess",      amount: 228_000, pct: 17.7, trend: "down" },
  { category: "Admin & Overhead",           amount: 162_000, pct: 12.6, trend: "stable" },
  { category: "Stop-Loss Recovery Gap",     amount:  98_000, pct:  7.6, trend: "down" },
];

function fmtD(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

export default function DrillEbitda() {
  const [, navigate] = useLocation();

  const { data: claims } = useQuery<{ items: any[] }>({
    queryKey: ["/api/gov/claims/"],
  });

  const ebitdaClaim = claims?.items.find(c => c.kpi_key === "EBITDA_DRAG");
  const currentDrag = ebitdaClaim?.value ?? 1_285_000;
  const maxDrag = Math.max(...MOCK_EBITDA_SERIES.map(s => s.drag));

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/governance-war-room")}
            data-testid="btn-back-war-room"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-800/40 rounded-lg px-2.5 py-1.5 flex-shrink-0 mt-1">
            <ArrowLeft className="w-3 h-3" />
            War Room
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-[#FF4D6D]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF4D6D]">
                Drill Surface · EBITDA
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100">EBITDA Drag Analysis</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Benefit cost overruns · Provider leakage · Actuarial variance decomposition
            </p>
          </div>
        </div>

        {/* KPI banner */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Current EBITDA Drag", value: fmtD(currentDrag), color: "#FF4D6D", sub: "TTM period" },
            { label: "Q4 EBITDA",           value: fmtD(3_540_000),   color: "#00FF94", sub: "+11.3% QoQ" },
            { label: "Drag Margin",         value: "36.3%",            color: "#FFB800", sub: "of EBITDA" },
            { label: "Recovery Opportunity",value: fmtD(740_000),      color: "#A855F7", sub: "estimated" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
              <p className="text-xl font-black font-mono" style={{ color }}>{value}</p>
              <p className="text-[10px] text-zinc-700 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Trend bars */}
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">EBITDA Drag Trend — 6 Quarters</span>
          </div>
          <div className="flex items-end gap-3 h-40">
            {MOCK_EBITDA_SERIES.map(s => {
              const h = (s.drag / maxDrag) * 100;
              const color = s.drag > 1_200_000 ? "#FF4D6D" : s.drag > 1_050_000 ? "#FFB800" : "#00FF94";
              return (
                <div key={s.period} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[9px] font-mono" style={{ color }}>{fmtD(s.drag)}</span>
                  <div className="w-full rounded-t-md transition-all" style={{ height: `${h}%`, background: color + "50", border: `1px solid ${color}40` }} />
                  <span className="text-[9px] font-mono text-zinc-600 text-center">{s.period}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag decomposition */}
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800/40">
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF4D6D]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Drag Category Decomposition</span>
          </div>
          <div className="divide-y divide-zinc-900/60">
            {DRAG_CATEGORIES.map(d => (
              <div key={d.category} className="flex items-center gap-4 px-5 py-3.5"
                data-testid={`drag-row-${d.category.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="flex-1">
                  <p className="text-xs text-zinc-200 font-medium">{d.category}</p>
                  <div className="mt-1.5 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#FF4D6D]/60" style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-black font-mono text-[#FF4D6D]">{fmtD(d.amount)}</p>
                  <p className="text-[9px] font-mono text-zinc-600">{d.pct}%</p>
                </div>
                <div className="w-6 flex-shrink-0">
                  {d.trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-[#FF4D6D]" />}
                  {d.trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-[#00FF94]" />}
                  {d.trend === "stable" && <Activity className="w-3.5 h-3.5 text-zinc-600" />}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}
