import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  PiggyBank, ArrowLeft, TrendingUp, TrendingDown,
  BarChart3, DollarSign, Users, Percent,
} from "lucide-react";

const PENSION_DATA = {
  planType: "Defined Contribution (401k)",
  totalAssets: 42_850_000,
  participantCount: 1_842,
  matchFormula: "100% match on first 4% of compensation",
  averageBalance: 23_261,
  vestingSchedule: "3-year cliff",
  ytdReturn: 12.4,
  benchmarkReturn: 11.8,
  expenseRatio: 0.38,
  eligibilityRate: 94.2,
};

const ASSET_ALLOCATION = [
  { category: "US Equity",         pct: 38.2, value: 16_369_000, color: "#00A8FF" },
  { category: "International Eq.", pct: 18.5, value:  7_927_000, color: "#A855F7" },
  { category: "Fixed Income",      pct: 24.1, value: 10_327_000, color: "#00FF94" },
  { category: "Target Date",       pct: 12.8, value:  5_485_000, color: "#FFB800" },
  { category: "Money Market",      pct:  4.2, value:  1_800_000, color: "#6B7280" },
  { category: "Company Stock",     pct:  2.2, value:    943_000, color: "#FF4D6D" },
];

const DEFERRAL_BANDS = [
  { band: "0%",      count: 98,  color: "#FF4D6D" },
  { band: "1–3%",    count: 312, color: "#FFB800" },
  { band: "4–6%",    count: 580, color: "#00A8FF" },
  { band: "7–10%",   count: 492, color: "#00FF94" },
  { band: ">10%",    count: 360, color: "#A855F7" },
];

function fmtD(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

export default function DrillPension() {
  const [, navigate] = useLocation();
  const maxCount = Math.max(...DEFERRAL_BANDS.map(d => d.count));

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] p-6 space-y-6">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/governance-war-room")}
            data-testid="btn-back-pension"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-[var(--kiq-muted)] border border-[var(--kiq-hairline)]/40 rounded-lg px-2.5 py-1.5 flex-shrink-0 mt-1">
            <ArrowLeft className="w-3 h-3" />
            War Room
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PiggyBank className="w-4 h-4 text-[#FFB800]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFB800]">Drill Surface · Pension</span>
            </div>
            <h1 className="text-2xl font-black text-[var(--kiq-ink)]">Retirement Plan Intelligence</h1>
            <p className="text-xs text-zinc-500 mt-1">401(k) assets · Allocation · Participation · Performance</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Assets",       value: fmtD(PENSION_DATA.totalAssets),   color: "#FFB800" },
            { label: "Participants",        value: PENSION_DATA.participantCount.toLocaleString(), color: "#00A8FF" },
            { label: "YTD Return",          value: PENSION_DATA.ytdReturn + "%",      color: "#00FF94" },
            { label: "Avg Balance",         value: fmtD(PENSION_DATA.averageBalance), color: "#A855F7" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/50 rounded-xl p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
              <p className="text-xl font-black font-mono" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Asset allocation */}
          <div className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-3.5 h-3.5 text-[#00A8FF]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Asset Allocation</span>
            </div>
            <div className="space-y-3">
              {ASSET_ALLOCATION.map(a => (
                <div key={a.category} data-testid={`asset-${a.category.replace(/\s+/g, "-").toLowerCase()}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[var(--kiq-muted)]">{a.category}</span>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold" style={{ color: a.color }}>{a.pct}%</span>
                      <span className="text-[10px] font-mono text-zinc-600 ml-2">{fmtD(a.value)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--kiq-surface)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: a.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deferral distribution */}
          <div className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Percent className="w-3.5 h-3.5 text-[#A855F7]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Deferral Rate Distribution</span>
            </div>
            <div className="flex items-end gap-3 h-36">
              {DEFERRAL_BANDS.map(d => {
                const h = (d.count / maxCount) * 100;
                return (
                  <div key={d.band} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-mono text-zinc-500">{d.count}</span>
                    <div className="w-full rounded-t-md"
                      style={{ height: `${h}%`, background: d.color + "50", border: `1px solid ${d.color}40` }} />
                    <span className="text-[9px] font-mono text-zinc-600 text-center">{d.band}</span>
                  </div>
                );
              })}
            </div>

            {/* Plan details */}
            <div className="mt-4 pt-4 border-t border-[var(--kiq-hairline)]/40 space-y-2 text-xs">
              {[
                ["Plan Type", PENSION_DATA.planType],
                ["Match Formula", PENSION_DATA.matchFormula],
                ["Vesting", PENSION_DATA.vestingSchedule],
                ["Expense Ratio", PENSION_DATA.expenseRatio + "%"],
                ["Eligible Enrolled", PENSION_DATA.eligibilityRate + "%"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-zinc-600">{k}</span>
                  <span className="text-[var(--kiq-muted)] text-right max-w-[55%]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
