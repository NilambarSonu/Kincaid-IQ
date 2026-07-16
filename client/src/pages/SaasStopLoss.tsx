import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, TrendingUp, Shield, DollarSign, Activity } from "lucide-react";

function SeverityBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/30",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    watch: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return <Badge className={`text-xs border ${map[s] || "bg-[var(--kiq-surface)]/5 text-[var(--kiq-ink)]/40"}`}>{s}</Badge>;
}

export default function SaasStopLoss() {
  const [employees, setEmployees] = useState("450");
  const [claims, setClaims] = useState("4100000");
  const [applied, setApplied] = useState(false);

  const queryKey = applied
    ? [`/api/saas/stoploss/dashboard?employees=${employees}&annual_claims=${claims}`]
    : ["/api/saas/stoploss/dashboard"];

  const { data, isLoading, refetch } = useQuery<any>({ queryKey });
  const { data: carriers } = useQuery<any>({ queryKey: ["/api/saas/stoploss/carriers"] });

  const profile = data?.plan_profile;
  const attachments = data?.attachment_analysis || [];
  const bestAttachment = attachments.find((a: any) => a.tier === "balanced");

  const tierColor = (tier: string) => ({
    aggressive: "#00A8FF", balanced: "#00FF94", conservative: "#FFB800", "high-deductible": "#A855F7"
  }[tier] || "#ffffff30");

  return (
    <div className="kiq-health-shell p-6 space-y-6 max-w-7xl">
      <div className="kiq-command-hero flex items-center justify-between px-6 py-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold text-[var(--kiq-ink)]">Stop-Loss Intelligence</h1>
          </div>
          <p className="text-[var(--kiq-ink)]/40 text-sm">Attachment point optimizer · Catastrophic claim predictor · Carrier comparison</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="kiq-health-card rounded-2xl p-5">
        <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Plan Parameters</h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label className="text-[var(--kiq-ink)]/40 text-xs mb-1 block">Employees</Label>
            <Input value={employees} onChange={e => setEmployees(e.target.value)} className="bg-[var(--kiq-surface)]/70 border-[var(--kiq-hairline)] text-[var(--kiq-ink)] w-32" data-testid="input-employees" />
          </div>
          <div>
            <Label className="text-[var(--kiq-ink)]/40 text-xs mb-1 block">Annual Claims ($)</Label>
            <Input value={claims} onChange={e => setClaims(e.target.value)} className="bg-[var(--kiq-surface)]/70 border-[var(--kiq-hairline)] text-[var(--kiq-ink)] w-40" data-testid="input-claims" />
          </div>
          <Button className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20" onClick={() => { setApplied(true); refetch(); }} data-testid="btn-run">
            Run Analysis
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      {profile && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "PMPM", value: `$${profile.pmpm?.toFixed(2)}`, icon: Activity, color: "text-blue-400" },
            { label: "Recommended Attachment", value: `$${(profile.recommended_attachment || 0).toLocaleString()}`, icon: Shield, color: "text-green-400" },
            { label: "Agg. Attachment", value: `$${(profile.agg_attachment / 1_000_000).toFixed(2)}M`, icon: TrendingUp, color: "text-amber-400" },
            { label: "Best Net Cost", value: bestAttachment ? `$${(bestAttachment.net_cost / 1_000_000).toFixed(2)}M` : "—", icon: DollarSign, color: "text-purple-400" },
          ].map((card, i) => (
            <div key={i} className="kiq-health-card rounded-xl p-4" data-testid={`stoploss-kpi-${i}`}>
              <p className="text-[var(--kiq-ink)]/40 text-xs mb-1">{card.label}</p>
              <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Attachment analysis */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Attachment Point Analysis</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={attachments}>
              <XAxis dataKey="attachment" tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <YAxis tick={{ fill: "#ffffff40", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(v: any) => [`$${(v/1_000_000).toFixed(2)}M`]} contentStyle={{ background: "#F8FAFC", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="net_cost" radius={[4, 4, 0, 0]}>
                {attachments.map((a: any, i: number) => <Cell key={i} fill={tierColor(a.tier)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-2">
            {attachments.map((a: any) => (
              <div key={a.tier} className="flex items-center justify-between p-2 rounded-lg bg-[var(--kiq-surface)]/60 border border-[var(--kiq-hairline)]/70 text-xs" data-testid={`attachment-tier-${a.tier}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: tierColor(a.tier) }} />
                  <span className="text-[var(--kiq-ink)]/70 capitalize">{a.tier}</span>
                </div>
                <span className="text-[var(--kiq-ink)]/40">${(a.attachment/1000).toFixed(0)}K attach</span>
                <span className="text-[var(--kiq-ink)] font-medium">${(a.net_cost/1_000_000).toFixed(2)}M net</span>
                <span className="text-[var(--kiq-ink)]/40">${(a.stop_loss_premium/1000).toFixed(0)}K premium</span>
              </div>
            ))}
          </div>
        </div>

        {/* Catastrophic claims */}
        <div className="kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Catastrophic Claim Watch List</h2>
          <div className="space-y-3">
            {(data?.catastrophic_claims || []).map((claim: any) => (
              <div key={claim.member} className="p-3 rounded-xl bg-[var(--kiq-surface)]/60 border border-[var(--kiq-hairline)]/70 hover:border-purple-400/25 transition-colors" data-testid={`catastrophic-${claim.member}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium text-[var(--kiq-ink)] text-sm">{claim.diagnosis}</p>
                    <p className="text-[var(--kiq-ink)]/40 text-xs">{claim.member}</p>
                  </div>
                  <SeverityBadge s={claim.severity} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[var(--kiq-ink)]/30">YTD Cost</p>
                    <p className="text-[var(--kiq-ink)] font-medium">${(claim.ytd_cost/1000).toFixed(0)}K</p>
                  </div>
                  <div>
                    <p className="text-[var(--kiq-ink)]/30">Projected Runout</p>
                    <p className="text-amber-400 font-medium">${(claim.projected_runout/1000).toFixed(0)}K</p>
                  </div>
                  <div>
                    <p className="text-[var(--kiq-ink)]/30">SL Recovery Est.</p>
                    <p className={`font-medium ${claim.attachment_breach ? "text-green-400" : "text-[var(--kiq-ink)]/30"}`}>
                      {claim.attachment_breach ? `$${(claim.recovery_est/1000).toFixed(0)}K` : "None"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Runout reserve */}
      {data?.runout_reserve && (
        <div className="kiq-health-card rounded-2xl p-5">
          <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">IBNR Runout Reserve Analysis</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: "Total Incurred Claims", value: `$${(data.runout_reserve.total_incurred/1_000_000).toFixed(2)}M` },
              { label: "IBNR Estimate", value: `$${(data.runout_reserve.ibnr_estimate/1000).toFixed(0)}K` },
              { label: "Runout Months", value: `${data.runout_reserve.runout_months}mo` },
              { label: "Recommended Reserve", value: `$${(data.runout_reserve.recommended_reserve/1000).toFixed(0)}K`, highlight: true },
              { label: "Reserve Gap", value: `$${(data.runout_reserve.reserve_gap/1000).toFixed(0)}K`, danger: true },
            ].map((item, i) => (
              <div key={i} className={`p-3 rounded-xl border text-center ${item.highlight ? "border-green-500/20 bg-green-500/5" : item.danger ? "border-red-500/20 bg-red-500/5" : "border-[var(--kiq-hairline)] bg-[var(--kiq-surface)]/60"}`} data-testid={`reserve-${i}`}>
                <p className="text-xs text-[var(--kiq-ink)]/40 mb-1">{item.label}</p>
                <p className={`text-lg font-bold ${item.highlight ? "text-green-400" : item.danger ? "text-red-400" : "text-[var(--kiq-ink)]"}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Carrier comparison */}
      <div className="kiq-health-card rounded-2xl p-5">
        <h2 className="text-[var(--kiq-ink)] font-semibold mb-4">Carrier Market Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--kiq-hairline)]/70">
                {["Carrier", "Attachment", "Agg Factor", "Annual Premium", "Rated Claims", "AM Best", "Market Share"].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[var(--kiq-ink)]/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(carriers?.quotes || []).map((q: any, i: number) => (
                <tr key={i} className="border-b border-[var(--kiq-hairline)]/70 hover:bg-[var(--kiq-surface)]/70 transition-colors" data-testid={`carrier-row-${i}`}>
                  <td className="py-3 px-3 text-[var(--kiq-ink)] font-medium">{q.carrier}</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/60">${(q.specific_attachment/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/60">{q.agg_factor}%</td>
                  <td className="py-3 px-3 text-amber-400 font-medium">${(q.premium/1000).toFixed(0)}K</td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/60">${(q.rated_claims/1_000_000).toFixed(2)}M</td>
                  <td className="py-3 px-3"><Badge className={`text-xs ${q.am_best === "A++" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>{q.am_best}</Badge></td>
                  <td className="py-3 px-3 text-[var(--kiq-ink)]/60">{q.market_share}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
