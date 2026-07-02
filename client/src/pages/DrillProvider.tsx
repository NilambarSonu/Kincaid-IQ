import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  Building2, ArrowLeft, TrendingUp, TrendingDown,
  MapPin, Users, DollarSign, Activity, BarChart3,
} from "lucide-react";

const PROVIDERS = [
  { name: "Advocate Health",           network: "In-Net", claims: 1_842, pmpm: 312, variance: +18.4, state: "IL" },
  { name: "Northwestern Medicine",     network: "In-Net", claims: 1_210, pmpm: 394, variance: +31.2, state: "IL" },
  { name: "Rush University Medical",   network: "In-Net", claims:   980, pmpm: 287, variance:  -4.1, state: "IL" },
  { name: "DuPage Medical Group",      network: "In-Net", claims:   742, pmpm: 261, variance:  -9.8, state: "IL" },
  { name: "NorthShore University HS",  network: "Out-Net", claims:  418, pmpm: 521, variance: +74.3, state: "IL" },
  { name: "Midwest Specialty Group",   network: "Out-Net", claims:  305, pmpm: 489, variance: +63.0, state: "IN" },
  { name: "Edward-Elmhurst Health",    network: "In-Net", claims:  891, pmpm: 274, variance:  -8.7, state: "IL" },
  { name: "OSF HealthCare",            network: "In-Net", claims:  623, pmpm: 299, variance:  +0.3, state: "IL" },
];

function fmtD(n: number) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(0) + "K";
  return "$" + n.toFixed(0);
}

export default function DrillProvider() {
  const [, navigate] = useLocation();
  const avgPmpm = Math.round(PROVIDERS.reduce((a, p) => a + p.pmpm, 0) / PROVIDERS.length);
  const totalClaims = PROVIDERS.reduce((a, p) => a + p.claims, 0);
  const outNetCount = PROVIDERS.filter(p => p.network === "Out-Net").length;

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6 space-y-6">

        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/governance-war-room")}
            data-testid="btn-back-provider"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 border border-zinc-800/40 rounded-lg px-2.5 py-1.5 flex-shrink-0 mt-1">
            <ArrowLeft className="w-3 h-3" />
            War Room
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-[#00A8FF]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#00A8FF]">Drill Surface · Provider</span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100">Provider Network Analysis</h1>
            <p className="text-xs text-zinc-500 mt-1">In-network utilization · Out-of-network leakage · PMPM variance</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Providers",    value: PROVIDERS.length, color: "#00A8FF", fmt: "n" },
            { label: "Total Claims",       value: totalClaims,      color: "#A855F7", fmt: "n" },
            { label: "Avg PMPM",           value: avgPmpm,          color: "#FFB800", fmt: "$" },
            { label: "Out-of-Network",     value: outNetCount,      color: "#FF4D6D", fmt: "n" },
          ].map(({ label, value, color, fmt }) => (
            <div key={label} className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
              <p className="text-2xl font-black font-mono" style={{ color }}>
                {fmt === "$" ? "$" + value : value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800/40">
            <BarChart3 className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Provider Utilization & Variance</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800/30">
                {["Provider", "State", "Network", "Claims", "PMPM", "Variance"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[9px] font-mono uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p, i) => {
                const vColor = p.variance > 20 ? "#FF4D6D" : p.variance > 0 ? "#FFB800" : "#00FF94";
                return (
                  <tr key={i} className="border-b border-zinc-900/40 hover:bg-zinc-900/20"
                    data-testid={`provider-row-${i}`}>
                    <td className="px-4 py-3 font-medium text-zinc-200">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-zinc-500">{p.state}</td>
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
                        style={p.network === "In-Net"
                          ? { color: "#00FF94", borderColor: "#00FF9430", background: "#00FF9412" }
                          : { color: "#FF4D6D", borderColor: "#FF4D6D30", background: "#FF4D6D12" }}>
                        {p.network}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">{p.claims.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#00A8FF]">${p.pmpm}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.variance > 0
                          ? <TrendingUp className="w-3 h-3" style={{ color: vColor }} />
                          : <TrendingDown className="w-3 h-3" style={{ color: vColor }} />}
                        <span className="font-mono font-bold" style={{ color: vColor }}>
                          {p.variance > 0 ? "+" : ""}{p.variance}%
                        </span>
                      </div>
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
