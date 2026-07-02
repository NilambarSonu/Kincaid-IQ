import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { factorData, formatPct } from "@/lib/mockData";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, CartesianGrid, LineChart, Line, PieChart, Pie, Legend
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";

export default function FactorAnalysis() {
  const { exposures, attribution, sectorWeights, styleBox, riskDecomp, rollingExposures } = factorData;

  const styleBoxData = [
    { name: 'Value', small: styleBox.valueWeight * 0.1, mid: styleBox.valueWeight * 0.3, large: styleBox.valueWeight * 0.6 },
    { name: 'Blend', small: styleBox.blendWeight * 0.1, mid: styleBox.blendWeight * 0.3, large: styleBox.blendWeight * 0.6 },
    { name: 'Growth', small: styleBox.growthWeight * 0.1, mid: styleBox.growthWeight * 0.3, large: styleBox.growthWeight * 0.6 },
  ];

  const riskData = [
    { name: 'Systematic', value: riskDecomp.systematic, color: '#00A8FF' },
    { name: 'Idiosyncratic', value: riskDecomp.idiosyncratic, color: '#FF4D6D' },
  ];

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Risk Management</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Factor Analysis
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Portfolio factor exposures, attribution, and risk decomposition</p>
      </div>

      <BloombergNav active="factor-analysis" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="chart-factor-exposure">
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Factor Exposure</p>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Portfolio active exposure vs. S&P 500 benchmark</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={exposures} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
              <YAxis dataKey="factor" type="category" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} width={80} />
              <Tooltip 
                contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
                itemStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="active" radius={[0, 4, 4, 0]}>
                {exposures.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.active >= 0 ? "#00A8FF" : "#FF4D6D"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="chart-factor-attribution">
          <p className="section-label mb-4">Return Attribution (YTD +14.7%)</p>
          <p className="text-xs text-muted-foreground mb-4">Contribution to total portfolio return by factor and strategy</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attribution} layout="vertical" margin={{ left: 40, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} unit="%" />
              <YAxis dataKey="name" type="category" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} width={120} />
              <Tooltip 
                contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
                itemStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {attribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.value >= 0 ? "#00FF94" : "#FF4D6D"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="metric-card col-span-1 lg:col-span-2" data-testid="chart-sector-attribution">
          <p className="section-label mb-4">Sector Active Weights</p>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={sectorWeights} layout="vertical" margin={{ left: 60, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} unit="%" />
              <YAxis dataKey="sector" type="category" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} width={120} />
              <Tooltip 
                contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
                itemStyle={{ fontSize: "12px" }}
              />
              <Bar dataKey="active" radius={[0, 4, 4, 0]}>
                {sectorWeights.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.active >= 0 ? "#00FF94" : "#FFB800"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="grid-style-box">
          <p className="section-label mb-6">Equity Style Box</p>
          <div className="grid grid-cols-4 gap-1 aspect-square relative border border-white/10 p-1 bg-white/5 rounded-md">
            <div className="col-span-1"></div>
            <div className="text-[10px] text-center text-muted-foreground uppercase">Value</div>
            <div className="text-[10px] text-center text-muted-foreground uppercase">Blend</div>
            <div className="text-[10px] text-center text-muted-foreground uppercase">Growth</div>
            
            <div className="text-[10px] flex items-center justify-end text-muted-foreground uppercase pr-2">Large</div>
            <div className="bg-white/5 rounded-sm border border-white/5 flex items-center justify-center">
               {styleBox.largeCapWeight > 0.5 && styleBox.valueWeight > 0.4 && <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />}
            </div>
            <div className="bg-white/5 rounded-sm border border-white/5 flex items-center justify-center">
               {styleBox.largeCapWeight > 0.5 && styleBox.blendWeight > 0.4 && <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />}
            </div>
            <div className="bg-white/10 rounded-sm border border-primary/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,168,255,0.3)]">
               {styleBox.largeCapWeight > 0.5 && styleBox.growthWeight > 0.4 && <div className="w-4 h-4 rounded-full bg-primary" />}
            </div>

            <div className="text-[10px] flex items-center justify-end text-muted-foreground uppercase pr-2">Mid</div>
            <div className="bg-white/5 rounded-sm border border-white/5"></div>
            <div className="bg-white/5 rounded-sm border border-white/5"></div>
            <div className="bg-white/5 rounded-sm border border-white/5"></div>

            <div className="text-[10px] flex items-center justify-end text-muted-foreground uppercase pr-2">Small</div>
            <div className="bg-white/5 rounded-sm border border-white/5"></div>
            <div className="bg-white/5 rounded-sm border border-white/5"></div>
            <div className="bg-white/5 rounded-sm border border-white/5"></div>
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Large Cap Growth</span>
              <span className="font-bold text-white">{(styleBox.largeCapWeight * styleBox.growthWeight * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${styleBox.largeCapWeight * styleBox.growthWeight * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card" data-testid="chart-factor-trend">
          <p className="section-label mb-4">Rolling Factor Exposure (12M)</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={rollingExposures}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
              <Tooltip 
                contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Line type="monotone" dataKey="market" stroke="#00A8FF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="growth" stroke="#FFB800" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="momentum" stroke="#A855F7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="chart-risk-decomp">
          <p className="section-label mb-4">Risk Decomposition</p>
          <div className="flex items-center justify-center h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ background: "rgba(8,10,40,0.95)", border: "1px solid rgba(0,140,255,0.2)", borderRadius: "8px" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
