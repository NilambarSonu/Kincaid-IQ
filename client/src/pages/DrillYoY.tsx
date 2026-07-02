import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { TrendingUp, TrendingDown, ArrowLeft, BarChart3, Activity } from "lucide-react";

const YOY_DATA = [
  { metric: "Total Premium",         y2022: 4_820_000, y2023: 5_110_000, y2024: 5_480_000, unit: "$" },
  { metric: "Employer Contribution", y2022: 3_856_000, y2023: 4_088_000, y2024: 4_384_000, unit: "$" },
  { metric: "Employee Contribution", y2022:   964_000, y2023: 1_022_000, y2024: 1_096_000, unit: "$" },
  { metric: "Claims Paid",           y2022: 4_120_000, y2023: 4_430_000, y2024: 4_810_000, unit: "$" },
  { metric: "Loss Ratio",            y2022: 85.5,      y2023: 86.7,      y2024: 87.8,      unit: "%" },
  { metric: "Admin Cost",            y2022:   382_000, y2023:   401_000, y2024:   422_000, unit: "$" },
  { metric: "Stop-Loss Recovery",    y2022:   210_000, y2023:   185_000, y2024:   245_000, unit: "$" },
  { metric: "Members Enrolled",      y2022: 1_842,     y2023: 1_910,     y2024: 1_988,     unit: "n" },
  { metric: "PMPM",                  y2022: 218.5,     y2023: 223.1,     y2024: 229.8,     unit: "$" },
  { metric: "Rx Cost",               y2022:   920_000, y2023: 1_050_000, y2024: 1_185_000, unit: "$" },
];

function pct(a: number, b: number) {
  return ((b - a) / Math.abs(a) * 100).toFixed(1);
}

function fmtVal(v: number, unit: string) {
  if (unit === "%") return v.toFixed(1) + "%";
  if (unit === "n") return v.toLocaleString();
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1_000) return "$" + (v / 1_000).toFixed(0) + "K";
  return "$" + v.toFixed(0);
}

export default function DrillYoY() {
  const [, navigate] = useLocation();

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6 space-y-6">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/governance-war-room")}
            data-testid="btn-back-yoy"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 border border-zinc-800/40 rounded-lg px-2.5 py-1.5 flex-shrink-0 mt-1">
            <ArrowLeft className="w-3 h-3" />
            War Room
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-[#00FF94]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00FF94]">Drill Surface · YoY</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100">Year-over-Year Analysis</h1>
            <p className="text-xs text-zinc-500 mt-1">2022 · 2023 · 2024 benefit plan cost trend</p>
          </div>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/40">
                {["Metric", "2022", "2023", "YoY 22→23", "2024", "YoY 23→24", "3-yr Δ"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[9px] font-mono uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YOY_DATA.map((row, i) => {
                const d1 = parseFloat(pct(row.y2022, row.y2023));
                const d2 = parseFloat(pct(row.y2023, row.y2024));
                const d3 = parseFloat(pct(row.y2022, row.y2024));

                const dColor = (d: number) => d > 5 ? "#FF4D6D" : d > 0 ? "#FFB800" : "#00FF94";
                const DIcon = (d: number) => d > 0
                  ? <TrendingUp className="w-3 h-3 inline mr-0.5" />
                  : <TrendingDown className="w-3 h-3 inline mr-0.5" />;

                return (
                  <tr key={i} className="border-b border-zinc-900/40 hover:bg-zinc-900/20"
                    data-testid={`yoy-row-${i}`}>
                    <td className="px-4 py-3 font-medium text-zinc-200">{row.metric}</td>
                    <td className="px-4 py-3 font-mono text-zinc-500">{fmtVal(row.y2022, row.unit)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{fmtVal(row.y2023, row.unit)}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: dColor(d1) }}>
                      {DIcon(d1)}{d1 > 0 ? "+" : ""}{d1}%
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-zinc-200">{fmtVal(row.y2024, row.unit)}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: dColor(d2) }}>
                      {DIcon(d2)}{d2 > 0 ? "+" : ""}{d2}%
                    </td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: dColor(d3) }}>
                      {DIcon(d3)}{d3 > 0 ? "+" : ""}{d3}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </Layout>
  );
}
