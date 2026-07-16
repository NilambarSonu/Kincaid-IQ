import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { commoditiesData, commodityHistory } from "@/lib/mockData";
import { 
  Flame, 
  Dna, 
  Wheat, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Zap,
  BarChart3,
  Waves,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

type Commodity = typeof commoditiesData[0];

const CATEGORY_ICONS: Record<string, any> = {
  Energy: Flame,
  Metals: Zap,
  Agriculture: Wheat,
};

export default function Commodities() {
  const [selectedComm, setSelectedComm] = useState<Commodity>(commoditiesData[0]);

  const categories = ["Energy", "Metals", "Agriculture"];

  const historyData = useMemo(() => {
    return commodityHistory[selectedComm.id] || [];
  }, [selectedComm]);

  const termStructureData = useMemo(() => {
    return [
      { tenor: "Spot", price: selectedComm.spot },
      { tenor: "1M", price: selectedComm.fwd1m },
      { tenor: "3M", price: selectedComm.fwd3m },
      { tenor: "6M", price: selectedComm.fwd6m },
      { tenor: "12M", price: selectedComm.fwd12m },
    ];
  }, [selectedComm]);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Markets & Intelligence</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Commodities Board
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bloomberg CMD replacement — global energy, metals, and ag monitor</p>
      </div>

      <BloombergNav active="commodities" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-8">
          {categories.map(cat => (
            <section key={cat} data-testid={`section-${cat.toLowerCase()}`}>
              <div className="flex items-center gap-2 mb-4">
                {CATEGORY_ICONS[cat] && (() => {
                  const Icon = CATEGORY_ICONS[cat];
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
                <h2 className="text-lg font-bold tracking-tight">{cat}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {commoditiesData.filter(c => c.sector === cat).map(c => (
                  <Card 
                    key={c.name} 
                    className={`sidebar-metal-glass border-white/10 hover-elevate cursor-pointer transition-all ${selectedComm.name === c.name ? "ring-1 ring-primary border-primary/40" : ""}`}
                    onClick={() => setSelectedComm(c)}
                    data-testid={`card-commodity-${c.id.toUpperCase()}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase">{c.name}</span>
                        <Badge className={c.d1 >= 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                          {c.d1 >= 0 ? "+" : ""}{c.d1.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-mono font-bold">${c.spot.toFixed(2)}</span>
                        <span className="text-[10px] text-muted-foreground">USD</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-[9px] uppercase font-bold text-muted-foreground">
                        <div>1W: <span className={c.w1 >= 0 ? "text-green-400" : "text-red-400"}>{c.w1 >= 0 ? "+" : ""}{c.w1}%</span></div>
                        <div>YTD: <span className={c.ytd >= 0 ? "text-green-400" : "text-red-400"}>{c.ytd >= 0 ? "+" : ""}{c.ytd}%</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="sidebar-metal-glass border-white/10 sticky top-6">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-bold text-primary">{selectedComm.name}</CardTitle>
                <Activity className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">1-Year Price History</p>
            </CardHeader>
            <CardContent className="space-y-8">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={historyData} data-testid="chart-commodity-history">
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                  <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                    labelStyle={{ color: "#0F172A" }}
                  />
                  <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)"  isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Term Structure (Futures Curve)</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={termStructureData} data-testid="chart-term-structure">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis dataKey="tenor" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} />
                    <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#FFB800" 
                      strokeWidth={2} 
                      dot={{ r: 4, fill: "#FFB800" }} 
                      name="Price"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex justify-between items-center text-[9px] uppercase font-bold px-2">
                  <span className="text-muted-foreground">Market Regime:</span>
                  <span className={selectedComm.fwd1m > selectedComm.spot ? "text-amber-400" : "text-green-400"}>
                    {selectedComm.fwd1m > selectedComm.spot ? "Contango" : "Backwardation"}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase text-primary">AI Supply/Demand Signal</span>
                </div>
                <p className="text-xs italic leading-relaxed text-muted-foreground">
                  Supply tightness in {selectedComm.name} expected to persist through Q3 due to geopolitical risk premiums. Bullish signal.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
