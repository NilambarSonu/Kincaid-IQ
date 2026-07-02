import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { creditData, formatCurrency } from "@/lib/mockData";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, Legend
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Activity, ExternalLink, CandlestickChart, Building2 } from "lucide-react";

export default function CreditMonitor() {
  const [, navigate] = useLocation();
  const { current, change1d, change1w, igHistory, hyHistory, cdxIgHistory, cdxHyHistory, sectorMatrix, kylesBook, watchlist } = creditData;

  const oasHistory = igHistory.map((item, i) => ({
    date: new Date(item.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ig: item.value,
    hy: hyHistory[i].value
  }));

  const cdxHistory = cdxIgHistory.map((item, i) => ({
    date: new Date(item.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    ig: item.value,
    hy: cdxHyHistory[i].value
  }));

  const metrics = [
    { label: "IG OAS", value: `${current.igOas}bps`, change: change1d.igOas, id: "ig-oas" },
    { label: "HY OAS", value: `${current.hyOas}bps`, change: change1d.hyOas, id: "hy-oas" },
    { label: "CDX IG 5Y", value: `${current.cdxIg}bps`, change: change1d.cdxIg, id: "cdx-ig" },
    { label: "CDX HY 5Y", value: `${current.cdxHy}bps`, change: change1d.cdxHy, id: "cdx-hy" },
  ];

  const getHeatmapColor = (val: number, type: 'ig' | 'hy') => {
    const min = type === 'ig' ? 60 : 250;
    const max = type === 'ig' ? 120 : 450;
    const ratio = (val - min) / (max - min);
    if (ratio < 0.3) return "rgba(0, 255, 148, 0.1)";
    if (ratio > 0.7) return "rgba(255, 77, 109, 0.1)";
    return "rgba(255, 184, 0, 0.1)";
  };

  const getHeatmapTextColor = (val: number, type: 'ig' | 'hy') => {
    const min = type === 'ig' ? 60 : 250;
    const max = type === 'ig' ? 120 : 450;
    const ratio = (val - min) / (max - min);
    if (ratio < 0.3) return "#00FF94";
    if (ratio > 0.7) return "#FF4D6D";
    return "#FFB800";
  };

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Risk Management</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Credit Monitor
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Corporate credit spreads, CDX indices, and private credit exposure</p>
      </div>

      <BloombergNav active="credit" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <div key={m.id} className="metric-card" data-testid={`card-${m.id}`}>
            <p className="section-label mb-1">{m.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>{m.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {m.change >= 0 ? <ArrowUpRight size={14} className="text-destructive" /> : <ArrowDownRight size={14} className="text-emerald-500" />}
              <span className={`text-xs font-semibold ${m.change >= 0 ? "text-destructive" : "text-emerald-500"}`}>
                {Math.abs(m.change)}bps
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">1D</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="chart-oas-history">
          <p className="section-label mb-4">IG vs HY OAS Spread (12M)</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={oasHistory}>
              <defs>
                <linearGradient id="colorIg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A8FF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00A8FF" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorHy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} unit="bps" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} unit="bps" />
              <Tooltip 
                contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
              />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="ig" name="IG OAS" stroke="#00A8FF" fillOpacity={1} fill="url(#colorIg)"  isAnimationActive={false} />
              <Area yAxisId="right" type="monotone" dataKey="hy" name="HY OAS" stroke="#A855F7" fillOpacity={1} fill="url(#colorHy)"  isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="chart-cdx-history">
          <p className="section-label mb-4">CDX IG and HY Index (12M)</p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cdxHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} unit="bps" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} unit="bps" />
              <Tooltip 
                contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
              />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="ig" name="CDX IG" stroke="#00FF94" fillOpacity={0.1} fill="#00FF94"  isAnimationActive={false} />
              <Area yAxisId="right" type="monotone" dataKey="hy" name="CDX HY" stroke="#FF8C00" fillOpacity={0.1} fill="#FF8C00"  isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="metric-card col-span-1 lg:col-span-1" data-testid="table-sector-matrix">
          <p className="section-label mb-4">Sector Credit Matrix</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 font-medium text-muted-foreground">Sector</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">IG OAS</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">HY OAS</th>
                </tr>
              </thead>
              <tbody>
                {sectorMatrix.map((s) => (
                  <tr key={s.sector} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 font-medium text-white">{s.sector}</td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-1 rounded-sm font-bold" style={{ background: getHeatmapColor(s.igOas, 'ig'), color: getHeatmapTextColor(s.igOas, 'ig') }}>
                        {s.igOas}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="px-2 py-1 rounded-sm font-bold" style={{ background: getHeatmapColor(s.hyOas, 'hy'), color: getHeatmapTextColor(s.hyOas, 'hy') }}>
                        {s.hyOas}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="metric-card col-span-1 lg:col-span-2" data-testid="table-jeremiah-credit">
          <p className="section-label mb-4">Jeremiah's Credit Exposure</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 font-medium text-muted-foreground">Position</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Sector</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Spread</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Rating</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Maturity</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Notional</th>
                </tr>
              </thead>
              <tbody>
                {kylesBook.map((b) => {
                  const equityTicker = b.name.split(" ")[0].replace(/[^A-Z]/g, "");
                  return (
                    <tr key={b.name} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                      data-testid={`row-credit-${b.name.replace(/\s+/g, "-").toLowerCase()}`}>
                      <td className="py-3 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {b.name}
                          <div className="hidden group-hover:flex items-center gap-1.5">
                            <button onClick={() => navigate(`/company?ticker=${equityTicker}`)}
                              className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
                              style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.2)", color: "#00A8FF" }}>
                              <Building2 size={9} /> Research
                            </button>
                            <button onClick={() => navigate(`/charts?ticker=${equityTicker}`)}
                              className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded transition-all"
                              style={{ background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)", color: "#00FF94" }}>
                              <CandlestickChart size={9} /> Chart
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">{b.sector}</td>
                      <td className="py-3 text-right font-mono text-primary">{b.spread}bps</td>
                      <td className="py-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          b.rating.startsWith('A') ? "bg-emerald-500/10 text-emerald-500" :
                          b.rating.startsWith('BBB') ? "bg-blue-500/10 text-blue-500" :
                          b.rating.startsWith('BB') ? "bg-amber-500/10 text-amber-500" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                          {b.rating}
                        </span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">{b.maturity}</td>
                      <td className="py-3 text-right font-bold text-white">{formatCurrency(b.notional)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="table-watchlist-credit">
        <p className="section-label mb-4">Credit Watchlist: Rising Stars & Fallen Angels</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {watchlist.map((w, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-white">{w.name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  w.potentialAction.includes('Rising') || w.potentialAction.includes('Upgrade') ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
                }`}>
                  {w.potentialAction}
                </span>
              </div>
              <div className="flex justify-between text-xs mb-3">
                <span className="text-muted-foreground">Current Rating</span>
                <span className="font-mono text-white">{w.currentRating}</span>
              </div>
              <div className="flex gap-2">
                 <Activity size={14} className="text-primary mt-0.5 shrink-0" />
                 <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                   "{w.rationale}"
                 </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
