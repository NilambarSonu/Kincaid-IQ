import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, MapPin, TrendingUp } from "lucide-react";

function AdequacyBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    adequate: "bg-green-500/10 text-green-400 border-green-500/20",
    marginal: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    deficient: "bg-red-500/10 text-red-400 border-red-500/20",
    critically_deficient: "bg-red-600/15 text-red-300 border-red-600/30",
  };
  return <Badge className={`text-xs border capitalize ${map[status] || "bg-white/5 text-white/40"}`}>{status.replace("_", " ")}</Badge>;
}

function CaaIcon({ status }: { status: string }) {
  if (status === "PASS") return <CheckCircle className="w-4 h-4 text-green-400" />;
  if (status === "FAIL") return <XCircle className="w-4 h-4 text-red-400" />;
  return <AlertTriangle className="w-4 h-4 text-amber-400" />;
}

export default function SaasNetwork() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/saas/network/dashboard"] });
  const summary = data?.summary;

  const scoreColor = (s: number) => s >= 80 ? "#00FF94" : s >= 60 ? "#FFB800" : "#FF4D6D";

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <MapPin className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Provider Network Analyzer</h1>
        </div>
        <p className="text-white/40 text-sm">Adequacy scoring · In-network leakage · CAA transparency compliance</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/3 border border-white/8 p-4 flex flex-col items-center" data-testid="tile-adequacy-score">
          <p className="text-white/40 text-xs mb-2">Network Adequacy Score</p>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#ffffff10" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke={scoreColor(summary?.network_adequacy_score || 0)} strokeWidth="6"
                strokeDasharray={`${((summary?.network_adequacy_score || 0) / 100) * 163} 163`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{summary?.network_adequacy_score || "—"}</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-white/3 border border-white/8 p-4" data-testid="tile-in-network-rate">
          <p className="text-white/40 text-xs mb-1">In-Network Rate</p>
          <p className="text-2xl font-bold text-green-400">{summary?.in_network_rate}%</p>
          <p className="text-xs text-white/30 mt-1">↓ {summary?.leakage_pct}% OON leakage</p>
        </div>
        <div className="rounded-xl bg-white/3 border border-white/8 p-4" data-testid="tile-leakage-dollars">
          <p className="text-white/40 text-xs mb-1">Leakage ($)</p>
          <p className="text-2xl font-bold text-red-400">${((summary?.leakage_dollars || 0) / 1000).toFixed(0)}K</p>
          <p className="text-xs text-white/30 mt-1">Recoverable with network fix</p>
        </div>
        <div className="rounded-xl bg-white/3 border border-white/8 p-4" data-testid="tile-caa-score">
          <p className="text-white/40 text-xs mb-2">CAA Transparency Score</p>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#ffffff10" strokeWidth="6" />
              <circle cx="32" cy="32" r="26" fill="none" stroke={scoreColor(summary?.caa_score || 0)} strokeWidth="6"
                strokeDasharray={`${((summary?.caa_score || 0) / 100) * 163} 163`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-white">{summary?.caa_score || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Adequacy by specialty + PMPM trend */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
          <h2 className="text-white font-semibold mb-4">Network Adequacy by Specialty</h2>
          <div className="space-y-3">
            {(data?.adequacy_by_specialty || []).map((s: any) => (
              <div key={s.specialty} className="flex items-center justify-between p-2 rounded-lg bg-white/2 border border-white/5 hover:border-white/10 transition-colors" data-testid={`adequacy-${s.specialty.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 text-right">
                    <span className={`text-sm font-bold ${s.ratio < 0.5 ? "text-red-400" : s.ratio < 0.9 ? "text-amber-400" : "text-green-400"}`}>{s.ratio.toFixed(2)}x</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/80">{s.specialty}</p>
                    <p className="text-xs text-white/30">{s.providers_in_network}/{s.providers_needed} providers · {s.drive_time_min}min avg drive</p>
                  </div>
                </div>
                <AdequacyBadge status={s.adequacy} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
          <h2 className="text-white font-semibold mb-4">PMPM Trend — In vs. Out of Network</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data?.pmpm_trend || []}>
              <XAxis dataKey="month" tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#0a0f1e", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="in_network" stroke="#00FF94" strokeWidth={2} dot={false} name="In-Network" />
              <Line type="monotone" dataKey="out_of_network" stroke="#FF4D6D" strokeWidth={2} dot={false} name="Out-of-Network" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-green-400 rounded" /><span className="text-white/50">In-Network</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-red-400 rounded" /><span className="text-white/50">Out-of-Network</span></div>
          </div>
        </div>
      </div>

      {/* Leakage providers */}
      <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
        <h2 className="text-white font-semibold mb-4">Top Out-of-Network Leakage Providers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                {["Provider", "Specialty", "OON Claims", "OON Spend", "Avg Allowed", "INN Equiv.", "Leakage", "Reason"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-white/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.top_leakage_providers || []).map((p: any, i: number) => (
                <tr key={i} className="border-b border-white/3 hover:bg-white/2 transition-colors" data-testid={`leakage-provider-${i}`}>
                  <td className="py-3 px-3 text-white font-medium">{p.provider}</td>
                  <td className="py-3 px-3 text-white/50">{p.specialty}</td>
                  <td className="py-3 px-3 text-white/60">{p.oon_claims}</td>
                  <td className="py-3 px-3 text-red-400 font-medium">${(p.oon_spend/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3 text-white/60">${p.avg_allowed.toLocaleString()}</td>
                  <td className="py-3 px-3 text-white/60">${(p.network_equiv_cost/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3 text-amber-400 font-medium">${(p.leakage/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3"><Badge className="bg-white/5 text-white/40 border-white/10 text-xs capitalize">{p.reason.replace("_", " ")}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CAA compliance */}
      <div className="rounded-2xl bg-white/3 border border-white/8 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">CAA Transparency Compliance</h2>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm">Score:</span>
            <span className="text-xl font-bold" style={{ color: scoreColor(data?.caa_compliance?.score || 0) }}>{data?.caa_compliance?.score}</span>
            <span className="text-white/30">/ 100 ({data?.caa_compliance?.grade})</span>
          </div>
        </div>
        <div className="space-y-2">
          {(data?.caa_compliance?.items || []).map((item: any) => (
            <div key={item.requirement} className={`flex items-start justify-between p-3 rounded-lg border ${item.status === "FAIL" ? "border-red-500/20 bg-red-500/3" : item.status === "WARN" ? "border-amber-500/20 bg-amber-500/3" : "border-white/5 bg-white/1"}`} data-testid={`caa-${item.requirement.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}>
              <div className="flex items-start gap-3 flex-1">
                <CaaIcon status={item.status} />
                <div>
                  <p className="text-sm font-medium text-white/80">{item.requirement}</p>
                  {item.gap && <p className="text-xs text-white/40 mt-0.5">{item.gap}</p>}
                  {item.deadline && <p className="text-xs text-white/30">Deadline: {item.deadline}</p>}
                </div>
              </div>
              <Badge className={`text-xs ml-3 flex-shrink-0 border ${item.status === "PASS" ? "bg-green-500/10 text-green-400 border-green-500/20" : item.status === "FAIL" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
