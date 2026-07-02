import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  Briefcase, 
  Landmark, 
  History,
  AlertTriangle,
  Calendar
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar
} from "recharts";
import { economicIndicators } from "@/lib/mockData";
import { Progress } from "@/components/ui/progress";

export default function EconomicDashboard() {
  const { current, gdp, cpi, coreCpi, nfp, unemployment, yields, fomc, recessionProb } = economicIndicators;

  const inflationData = cpi.map((item, i) => ({
    date: item.date,
    cpi: item.value,
    coreCpi: coreCpi[i]?.value
  }));

  const laborData = nfp.map((item, i) => ({
    date: item.date,
    nfp: item.value,
    unemployment: unemployment[i]?.value
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0a0a1a] border border-white/10 p-2 rounded-lg shadow-xl text-xs">
          <p className="text-white font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString()}
              {entry.name.toLowerCase().includes("rate") || entry.name === "CPI YoY" || entry.name === "Core CPI" || entry.name === "Unemployment Rate" ? "%" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="mb-6 animate-float-up">
        <p className="section-label mb-1">Macro Intelligence</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Economic Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Real-time macro indicators, labor markets, and Fed policy monitoring (ECOW)</p>
      </div>

      <BloombergNav active="economic-data" />

      {/* Hero Row: 6 large metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: "GDP Growth", value: `${current.gdpGrowth}%`, icon: TrendingUp, color: "#00FF94", testId: "card-gdp" },
          { label: "CPI YoY", value: `${current.cpi}%`, icon: Activity, color: "#FF4D6D", testId: "card-cpi" },
          { label: "Core PCE", value: `${current.corePce}%`, icon: Activity, color: "#FFB800", testId: "card-pce" },
          { label: "Unemployment", value: `${current.unemployment}%`, icon: Users, color: "#00A8FF", testId: "card-unemployment" },
          { label: "NFP Latest", value: `+${(current.nfpLatest / 1000).toFixed(0)}K`, icon: Briefcase, color: "#A855F7", testId: "card-nfp" },
          { label: "Fed Funds Rate", value: current.fedFundsRate, icon: Landmark, color: "#00E5FF", testId: "card-fed-rate" },
        ].map((m) => (
          <div key={m.label} className="metric-card" style={{ borderTop: `2px solid ${m.color}` }} data-testid={m.testId}>
            <div className="flex justify-between items-start mb-2">
              <p className="section-label">{m.label}</p>
              <m.icon size={14} style={{ color: m.color }} />
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* GDP Trend */}
        <div className="metric-card" data-testid="chart-gdp-trend">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[#00FF94]" />
            <h3 className="font-bold text-white">GDP Trend (Quarterly YoY)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gdp}>
                <defs>
                  <linearGradient id="colorGdp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF94" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00FF94" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="quarter" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="GDP Growth" stroke="#00FF94" fillOpacity={1} fill="url(#colorGdp)"  isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inflation Chart */}
        <div className="metric-card" data-testid="chart-inflation">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-[#FF4D6D]" />
            <h3 className="font-bold text-white">Inflation (CPI vs Core CPI)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={inflationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="cpi" name="CPI YoY" stroke="#FF4D6D" strokeWidth={2} dot={false}  isAnimationActive={false} />
                <Line type="monotone" dataKey="coreCpi" name="Core CPI" stroke="#FFB800" strokeWidth={2} dot={false}  isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Labor Market */}
        <div className="metric-card" data-testid="chart-labor">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-[#00A8FF]" />
            <h3 className="font-bold text-white">Labor Market (NFP & Unemployment)</h3>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={laborData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.3)" fontSize={10} unit="K" />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.3)" fontSize={10} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="nfp" name="NFP Change" fill="#00A8FF" radius={[4, 4, 0, 0]}  isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="unemployment" name="Unemployment Rate" stroke="#A855F7" strokeWidth={2} dot={false}  isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Yield Curve & Recession Gauge */}
        <div className="grid grid-cols-1 gap-6">
          <div className="metric-card" data-testid="chart-yield-curve-history">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#00E5FF]" />
                <h3 className="font-bold text-white">2s10s Spread History</h3>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-red-500" />
                <span className="text-[10px] font-bold text-red-500 uppercase">Yield Curve Inverted</span>
              </div>
            </div>
            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yields.spread2s10s}>
                  <defs>
                    <linearGradient id="colorSpread" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4D6D" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FF4D6D" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="value" name="2s10s Spread" stroke="#FF4D6D" fill="url(#colorSpread)"  isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="metric-card" data-testid="gauge-recession-prob">
              <p className="section-label mb-2">Recession Prob. (12M)</p>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>{recessionProb}%</p>
                <div className="flex-1 pb-2">
                  <Progress value={recessionProb} className="h-2 bg-white/5" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">NY Fed Model based on 10Y-3M spread</p>
            </div>

            <div className="metric-card" data-testid="card-fomc-calendar">
              <p className="section-label mb-2">Next FOMC Meeting</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00A8FF]/10 border border-[#00A8FF]/20 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-[#00A8FF] uppercase">Mar</span>
                  <span className="text-lg font-bold text-white leading-none">21</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Rate Decision</p>
                  <p className="text-[10px] text-muted-foreground">Market Implied: 84% Hold</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOMC Probabilities Table */}
      <div className="metric-card overflow-x-auto">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-[#00E5FF]" />
          <h3 className="font-bold text-white">FOMC Meeting Probabilities</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-white/5">
              <th className="text-left pb-2 font-medium">MEETING DATE</th>
              <th className="text-center pb-2 font-medium">CUT</th>
              <th className="text-center pb-2 font-medium">HOLD</th>
              <th className="text-center pb-2 font-medium">HIKE</th>
              <th className="text-right pb-2 font-medium">DECISION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {fomc.map((meeting) => (
              <tr key={meeting.date} className="hover:bg-white/5 transition-colors">
                <td className="py-2.5 text-white font-medium">{meeting.date}</td>
                <td className="py-2.5 text-center">
                  <span className={meeting.probability.cut > 50 ? "text-[#00FF94]" : "text-muted-foreground"}>{meeting.probability.cut}%</span>
                </td>
                <td className="py-2.5 text-center text-white">{meeting.probability.hold}%</td>
                <td className="py-2.5 text-center text-muted-foreground">{meeting.probability.hike}%</td>
                <td className="py-2.5 text-right font-mono text-[#00E5FF]">{meeting.decision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
