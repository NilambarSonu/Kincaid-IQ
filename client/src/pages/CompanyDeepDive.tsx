import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { 
  Search, 
  BrainCircuit, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  PieChart, 
  BarChart3, 
  Target, 
  Info,
  Building,
  Globe,
  Users,
  Calendar,
  CandlestickChart,
  Zap,
  ExternalLink
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie,
  Legend
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const DEFAULT_TICKER = "NVDA";

const MOCK_FINANCIALS = {
  incomeStatement: [
    { label: "Revenue", lastYear: 60922, twoYearsAgo: 26974, threeYearsAgo: 26914 },
    { label: "Gross Profit", lastYear: 44301, twoYearsAgo: 15356, threeYearsAgo: 17475 },
    { label: "EBITDA", lastYear: 34480, twoYearsAgo: 7123, threeYearsAgo: 11216 },
    { label: "Net Income", lastYear: 29760, twoYearsAgo: 4368, threeYearsAgo: 9752 },
    { label: "EPS", lastYear: 11.93, twoYearsAgo: 1.74, threeYearsAgo: 3.85 },
  ],
  revenueByRegion: [
    { name: "United States", value: 44, color: "#00A8FF" },
    { name: "Taiwan", value: 22, color: "#00FF94" },
    { name: "China", value: 17, color: "#FFB800" },
    { name: "Other", value: 17, color: "#A855F7" },
  ],
  revenueBySegment: [
    { name: "Data Center", value: 78, color: "#00A8FF" },
    { name: "Gaming", value: 13, color: "#00FF94" },
    { name: "Professional Viz", value: 5, color: "#FFB800" },
    { name: "Auto & Robotics", value: 4, color: "#A855F7" },
  ],
  valuationComps: [
    { category: "P/E", company: 34.2, sector: 24.8, sp500: 21.4 },
    { category: "EV/EBITDA", company: 28.6, sector: 18.2, sp500: 14.8 },
    { category: "P/S", company: 22.1, sector: 8.4, sp500: 2.8 },
    { category: "P/B", company: 38.6, sector: 12.4, sp500: 4.2 },
  ],
  epsTrend: [
    { quarter: "Q1 '24", actual: 1.09, estimate: 0.92 },
    { quarter: "Q2 '24", actual: 2.70, estimate: 2.09 },
    { quarter: "Q3 '24", actual: 4.02, estimate: 3.37 },
    { quarter: "Q4 '24", actual: 5.16, estimate: 4.64 },
    { quarter: "Q1 '25", actual: 6.12, estimate: 5.58 },
    { quarter: "Q2 '25", actual: 0.68, estimate: 0.64 }, // After split
    { quarter: "Q3 '25", actual: 0.81, estimate: 0.75 },
    { quarter: "Q4 '25", actual: 0.92, estimate: 0.88 },
  ],
  revenueEbitda: [
    { year: "2021", revenue: 26914, ebitda: 11216 },
    { year: "2022", revenue: 26974, ebitda: 7123 },
    { year: "2023", revenue: 60922, ebitda: 34480 },
    { year: "2024", revenue: 96000, ebitda: 58000 },
    { year: "2025", revenue: 124000, ebitda: 76000 },
  ]
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (line.match(/^#{1,3}\s/)) return <p key={i} className="font-bold text-white mt-4 mb-1 text-base" style={{ color: "#00A8FF" }}>{line.replace(/^#{1,3}\s/, "")}</p>;
        if (line.match(/^\*\*.*\*\*:/)) return <p key={i} className="font-semibold text-white mt-2" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<span style="color:#FFB800">$1</span>') }} />;
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 flex gap-2 text-muted-foreground"><span style={{ color: "rgba(0,168,255,0.5)" }}>·</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} /></p>;
        if (line.match(/^\d+\.\s/)) { const content = line.replace(/^\d+\.\s/, ""); const num = line.match(/^(\d+)\./)?.[1]; return <p key={i} className="flex gap-2 text-muted-foreground"><span className="font-bold flex-shrink-0" style={{ color: "#00FF94" }}>{num}.</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} /></p>; }
        if (line.trim() === "---" || line.trim() === "***") return <div key={i} className="my-3 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} />;
      })}
    </div>
  );
}

export default function CompanyDeepDive() {
  const [, navigate] = useLocation();
  const urlTicker = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("ticker") || DEFAULT_TICKER)
    : DEFAULT_TICKER;
  const [ticker, setTicker] = useState(urlTicker);
  const [analysis, setAnalysis] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async (t: string) => {
      const res = await apiRequest("POST", "/api/company/analyze", { ticker: t, company_name: t });
      return res.json();
    },
    onSuccess: (data) => setAnalysis(data),
  });

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("ticker") || DEFAULT_TICKER;
    setTicker(t);
    if (!mutation.isPending) mutation.mutate(t);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker) {
      window.history.replaceState({}, "", `/company?ticker=${ticker}`);
      mutation.mutate(ticker);
    }
  };

  const data = analysis || {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    sector: "Technology",
    exchange: "NASDAQ",
    marketCap: "2.8T",
    price: 875.40,
    change: +14.2,
    changePct: 1.65
  };

  return (
    <Layout>
      <div className="mb-6 animate-float-up">
        <p className="section-label mb-1">Company Intelligence</p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
            Company Deep Dive
          </h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Enter Ticker (e.g. AAPL)"
                className="pl-9 pr-4 py-2 rounded-xl text-sm w-[200px]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-company-ticker"
              />
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.2)", color: "#00A8FF" }}
              data-testid="button-analyze-company"
            >
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Analyze"}
            </button>
          </form>
        </div>
      </div>

      <BloombergNav ticker={ticker} active="company" />

      {/* Quick-nav buttons for this ticker */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: "View Chart", icon: CandlestickChart, path: `/charts?ticker=${ticker}`, color: "#00A8FF" },
          { label: "Options Chain", icon: Zap, path: `/options?ticker=${ticker}`, color: "#A855F7" },
          { label: "Earnings History", icon: BarChart3, path: `/earnings`, color: "#FFB800" },
          { label: "Screener", icon: Search, path: `/screener`, color: "#00FF94" },
        ].map(a => {
          const Icon = a.icon;
          return (
            <button key={a.label} data-testid={`btn-company-nav-${a.label.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => navigate(a.path)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: `${a.color}10`, border: `1px solid ${a.color}25`, color: a.color }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${a.color}20`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${a.color}10`; }}>
              <Icon size={12} />{a.label}<ExternalLink size={10} className="opacity-50" />
            </button>
          );
        })}
      </div>

      <div className="metric-card mb-6" data-testid="card-company-header">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Company</p>
            <h2 className="text-2xl font-bold text-white leading-none">{data.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-[#00A8FF] font-bold">{data.ticker}</span>
              <span>{data.exchange}</span>
              <span className="mx-1">·</span>
              <span>{data.sector}</span>
            </div>
          </div>
          <div className="h-10 w-px bg-white/5 hidden md:block" />
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Price</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">${data.price}</span>
              <span className={`text-sm font-bold flex items-center ${data.change >= 0 ? "text-[#00FF94]" : "text-[#FF4D6D]"}`}>
                {data.change >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                {Math.abs(data.change)} ({data.changePct}%)
              </span>
            </div>
          </div>
          <div className="h-10 w-px bg-white/5 hidden md:block" />
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Market Cap</p>
            <p className="text-2xl font-bold text-white">${data.marketCap}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white/5 p-1 border border-white/10 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-[#00A8FF]/10 data-[state=active]:text-[#00A8FF]" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="financials" className="rounded-lg data-[state=active]:bg-[#00A8FF]/10 data-[state=active]:text-[#00A8FF]" data-testid="tab-financials">Financials</TabsTrigger>
          <TabsTrigger value="valuation" className="rounded-lg data-[state=active]:bg-[#00A8FF]/10 data-[state=active]:text-[#00A8FF]" data-testid="tab-valuation">Valuation</TabsTrigger>
          <TabsTrigger value="ai-analysis" className="rounded-lg data-[state=active]:bg-[#FFB800]/10 data-[state=active]:text-[#FFB800]" data-testid="tab-ai-analysis">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 metric-card">
              <div className="flex items-center gap-2 mb-4">
                <Info size={16} className="text-[#00A8FF]" />
                <h3 className="font-bold text-white">Business Description</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                NVIDIA Corporation is the world leader in visual computing technologies and the inventor of the GPU, a high-performance processor which generates breathtaking, interactive graphics on workstations, personal computers, game consoles, and mobile devices. NVIDIA GPUs are also essential for modern artificial intelligence, powering the deep learning models that drive scientific research, autonomous vehicles, and generative AI.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                {[
                  { label: "Headquarters", value: "Santa Clara, CA", icon: Building },
                  { label: "Founded", value: "1993", icon: Calendar },
                  { label: "Employees", value: "29,600", icon: Users },
                  { label: "Exchange", value: "NASDAQ", icon: Globe },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <item.icon size={12} className="text-muted-foreground mb-2" />
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{item.label}</p>
                    <p className="text-xs font-bold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <PieChart size={16} className="text-[#00FF94]" />
                <h3 className="font-bold text-white">Revenue by Segment</h3>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={MOCK_FINANCIALS.revenueBySegment}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {MOCK_FINANCIALS.revenueBySegment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="financials" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="metric-card" data-testid="chart-revenue-ebitda">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-[#00A8FF]" />
                <h3 className="font-bold text-white">Revenue & EBITDA (5Y)</h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_FINANCIALS.revenueEbitda}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="year" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} unit="M" />
                    <Tooltip />
                    <Bar dataKey="revenue" name="Revenue" fill="#00A8FF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ebitda" name="EBITDA" fill="#00FF94" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="metric-card" data-testid="chart-eps-trend">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={16} className="text-[#A855F7]" />
                <h3 className="font-bold text-white">EPS Trend (8Q)</h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_FINANCIALS.epsTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="quarter" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="actual" name="Actual EPS" fill="#A855F7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="estimate" name="Estimate" fill="rgba(168, 85, 247, 0.3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="metric-card overflow-x-auto">
            <h3 className="font-bold text-white mb-4">Income Statement Summary</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-white/5">
                  <th className="text-left pb-2 font-medium">METRIC</th>
                  <th className="text-right pb-2 font-medium">LTM</th>
                  <th className="text-right pb-2 font-medium">FY 2023</th>
                  <th className="text-right pb-2 font-medium">FY 2022</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {MOCK_FINANCIALS.incomeStatement.map((row) => (
                  <tr key={row.label} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-white font-medium">{row.label}</td>
                    <td className="py-3 text-right font-mono text-white">
                      {row.label === "EPS" ? `$${row.lastYear}` : `${(row.lastYear / 1000).toFixed(1)}B`}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      {row.label === "EPS" ? `$${row.twoYearsAgo}` : `${(row.twoYearsAgo / 1000).toFixed(1)}B`}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      {row.label === "EPS" ? `$${row.threeYearsAgo}` : `${(row.threeYearsAgo / 1000).toFixed(1)}B`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="valuation" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 metric-card" data-testid="chart-valuation-comps">
              <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-[#FFB800]" />
                <h3 className="font-bold text-white">Valuation Comps</h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_FINANCIALS.valuationComps} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <YAxis dataKey="category" type="category" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip />
                    <Legend iconType="circle" />
                    <Bar dataKey="company" name={data.ticker} fill="#FFB800" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="sector" name="Sector Median" fill="rgba(255, 184, 0, 0.4)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="sp500" name="S&P 500" fill="rgba(255, 255, 255, 0.1)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-[#00FF94]" />
                <h3 className="font-bold text-white">Analyst Price Targets</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-xs text-muted-foreground">Bull Case</p>
                  <p className="text-lg font-bold text-[#00FF94]">$1,200.00</p>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-xs text-muted-foreground">Consensus</p>
                  <p className="text-2xl font-bold text-white">$1,025.00</p>
                </div>
                <div className="relative h-2 bg-white/5 rounded-full mt-2">
                  <div className="absolute left-[30%] h-full w-[40%] bg-gradient-to-r from-red-500/50 via-[#00A8FF]/50 to-green-500/50 rounded-full" />
                  <div className="absolute left-[65%] top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-xs text-muted-foreground">Bear Case</p>
                  <p className="text-lg font-bold text-[#FF4D6D]">$680.00</p>
                </div>
                <div className="pt-4 border-t border-white/5 mt-4">
                  <div className="flex justify-between text-xs py-1">
                    <span className="text-muted-foreground">Analyst Ratings</span>
                    <span className="text-white font-bold">58 Buy · 4 Hold · 1 Sell</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai-analysis">
          {mutation.isPending ? (
            <div className="metric-card flex flex-col items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin mb-4 text-[#FFB800]" />
              <p className="font-bold text-white">GPT-4o is generating analysis…</p>
              <p className="text-xs text-muted-foreground mt-1">Synthesizing financial statements, market trends, and competitive risks</p>
            </div>
          ) : analysis?.analysis ? (
            <div className="metric-card" data-testid="card-ai-analysis">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20 flex items-center justify-center">
                  <BrainCircuit size={20} className="text-[#FFB800]" />
                </div>
                <div>
                  <h3 className="font-bold text-white">AI Financial Deep Dive</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Powered by GPT-4o · Professional Grade</p>
                </div>
              </div>
              <div className="prose prose-invert max-w-none">
                <MarkdownText text={analysis.analysis} />
              </div>
            </div>
          ) : (
            <div className="metric-card flex flex-col items-center justify-center py-20 border-dashed">
              <p className="text-muted-foreground text-sm">No analysis generated yet. Click 'Analyze' to begin.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
