import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { optionsData } from "@/lib/mockData";
import { Search, Activity, TrendingUp, TrendingDown, CandlestickChart, Building2, ExternalLink, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, AreaChart, Area
} from "recharts";

const TICKERS = ["AAPL", "NVDA", "MSFT", "AMZN", "META"];
const EXPIRATIONS = ["Weekly", "Monthly", "Quarterly"];
const STRATEGIES = ["Covered Call", "Cash-Secured Put", "Bull Call Spread", "Bear Put Spread", "Long Straddle"];

const getTickerFromURL = () => {
  if (typeof window === "undefined") return "AAPL";
  return new URLSearchParams(window.location.search).get("ticker") || "AAPL";
};

export default function OptionsAnalytics() {
  const [, navigate] = useLocation();
  const [ticker, setTicker] = useState(getTickerFromURL);
  const [expiration, setExpiration] = useState("Monthly");
  const [strategy, setStrategy] = useState("Covered Call");
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);

  useEffect(() => {
    const t = getTickerFromURL();
    if (t !== ticker) setTicker(t);
  }, []);

  const handleTickerChange = (t: string) => {
    setTicker(t.toUpperCase());
    window.history.replaceState({}, "", `/options?ticker=${t.toUpperCase()}`);
  };

  const currentTickerData = optionsData[ticker] || optionsData["AAPL"];
  const currentOptions = currentTickerData.calls_puts;
  const atmStrike = currentTickerData.spot;

  const skewData = useMemo(() => {
    return [...currentOptions]
      .sort((a, b) => a.strike - b.strike)
      .map(opt => ({ strike: opt.strike, callIV: opt.callIV, putIV: opt.putIV }));
  }, [currentOptions]);

  // Generate payoff diagram for selected strategy
  const payoffData = useMemo(() => {
    const spot = atmStrike;
    const strike = selectedStrike || Math.round(spot / 10) * 10;
    const points = Array.from({ length: 30 }, (_, i) => {
      const price = spot * (0.7 + i * 0.02);
      let pnl = 0;
      const premium = spot * 0.04;
      switch (strategy) {
        case "Covered Call":
          pnl = Math.min(strike - spot, price - spot) + premium; break;
        case "Cash-Secured Put":
          pnl = -Math.max(0, strike - price) + premium * 0.8; break;
        case "Bull Call Spread": {
          const lowerStrike = spot * 0.98;
          const upperStrike = spot * 1.05;
          pnl = Math.max(0, Math.min(price - lowerStrike, upperStrike - lowerStrike)) - premium * 0.5; break;
        }
        case "Bear Put Spread": {
          const lowerStrike = spot * 0.95;
          const upperStrike = spot;
          pnl = Math.max(0, Math.min(upperStrike - price, upperStrike - lowerStrike)) - premium * 0.5; break;
        }
        case "Long Straddle":
          pnl = Math.abs(price - spot) - premium * 1.8; break;
      }
      return { price: parseFloat(price.toFixed(2)), pnl: parseFloat(pnl.toFixed(2)) };
    });
    return points;
  }, [strategy, selectedStrike, atmStrike]);

  const ivTermStructure = useMemo(() => [
    { tenor: "1W", iv: 22.4 }, { tenor: "2W", iv: 25.1 }, { tenor: "1M", iv: 28.6 },
    { tenor: "2M", iv: 27.2 }, { tenor: "3M", iv: 26.4 }, { tenor: "6M", iv: 25.8 },
    { tenor: "1Y", iv: 24.9 },
  ], []);

  const maxProfit = Math.max(...payoffData.map(d => d.pnl));
  const maxLoss = Math.min(...payoffData.map(d => d.pnl));

  return (
    <Layout>
      <div className="mb-4 animate-float-up">
        <p className="section-label mb-1">Bloomberg Terminal</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Options Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bloomberg OMON — options chain, vol surface, strategy P&L, Greeks</p>
      </div>

      <BloombergNav ticker={ticker} active="options" />

      {/* Quick-action nav */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: "View Chart", icon: CandlestickChart, path: `/charts?ticker=${ticker}`, color: "#00A8FF" },
          { label: "Company Research", icon: Building2, path: `/company?ticker=${ticker}`, color: "#00FF94" },
          { label: "Volatility Monitor", icon: Zap, path: `/volatility`, color: "#FFB800" },
        ].map(a => {
          const Icon = a.icon;
          return (
            <button key={a.label} data-testid={`btn-options-nav-${a.label.toLowerCase().replace(/ /g, "-")}`}
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

      {/* Header cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card className="sidebar-metal-glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Ticker</CardTitle>
          </CardHeader>
          <CardContent>
            <Input value={ticker} onChange={(e) => handleTickerChange(e.target.value)}
              className="bg-black/20 border-white/10 uppercase font-mono text-base font-bold" data-testid="input-options-ticker" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TICKERS.map(t => (
                <Badge key={t} variant={ticker === t ? "default" : "outline"}
                  className="cursor-pointer text-[10px]" onClick={() => handleTickerChange(t)}>{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="sidebar-metal-glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Spot Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-[var(--kiq-ink)]" data-testid="text-options-spot">${currentTickerData.spot.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{ticker} · NASDAQ</p>
          </CardContent>
        </Card>

        <Card className="sidebar-metal-glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">ATM IV</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-primary" data-testid="text-options-atm-iv">
              {(currentOptions.find(o => o.isATM)?.callIV ?? currentOptions[Math.floor(currentOptions.length / 2)]?.callIV ?? 0).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">IV Percentile: <span className="text-green-400 font-bold">82nd</span></p>
          </CardContent>
        </Card>

        <Card className="sidebar-metal-glass border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">P/C Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-amber-400">0.74</p>
            <p className="text-[10px] text-muted-foreground mt-1">Expiration: <span className="text-[var(--kiq-ink)] font-bold">{expiration}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Options chain */}
      <Card className="sidebar-metal-glass border-white/10 overflow-hidden mb-6">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Options Chain — {ticker}</CardTitle>
          <Tabs value={expiration} onValueChange={setExpiration} data-testid="tabs-expiration">
            <TabsList className="bg-black/40 border-white/10 h-8">
              {EXPIRATIONS.map(exp => (
                <TabsTrigger key={exp} value={exp} className="text-[10px] px-3">{exp}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-testid="table-options-chain">
              <TableHeader className="bg-black/40">
                <TableRow className="hover:bg-transparent border-white/10">
                  <TableHead colSpan={6} className="text-center border-r border-white/10 text-primary uppercase font-black text-[9px] tracking-widest py-2">CALLS</TableHead>
                  <TableHead className="text-center bg-[var(--kiq-surface)]/5 font-black text-[9px] uppercase tracking-widest">STRIKE</TableHead>
                  <TableHead colSpan={6} className="text-center border-l border-white/10 text-orange-400 uppercase font-black text-[9px] tracking-widest">PUTS</TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent border-white/10 text-[9px] uppercase font-bold text-muted-foreground">
                  <TableHead className="text-right">OI</TableHead>
                  <TableHead className="text-right">Vol</TableHead>
                  <TableHead className="text-right">IV</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="text-right">Last</TableHead>
                  <TableHead className="text-right border-r border-white/10">Bid/Ask</TableHead>
                  <TableHead className="text-center bg-[var(--kiq-surface)]/5 text-[9px]"></TableHead>
                  <TableHead className="text-left border-l border-white/10">Bid/Ask</TableHead>
                  <TableHead className="text-left">Last</TableHead>
                  <TableHead className="text-left">Δ</TableHead>
                  <TableHead className="text-left">IV</TableHead>
                  <TableHead className="text-left">Vol</TableHead>
                  <TableHead className="text-left">OI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentOptions.map(opt => {
                  const isITMCall = opt.strike < atmStrike;
                  const isITMPut = opt.strike > atmStrike;
                  const isATM = opt.isATM;
                  return (
                    <TableRow key={opt.strike}
                      className={`border-white/5 hover:bg-[var(--kiq-surface)]/5 cursor-pointer transition-colors h-9 ${isATM ? "bg-amber-500/8" : ""} ${selectedStrike === opt.strike ? "ring-1 ring-primary/30" : ""}`}
                      onClick={() => setSelectedStrike(selectedStrike === opt.strike ? null : opt.strike)}
                      data-testid={`row-option-${opt.strike}`}
                    >
                      <TableCell className={`text-right text-[10px] font-mono ${isITMCall ? "bg-primary/5 text-white" : "text-muted-foreground"}`}>{opt.callOI.toLocaleString()}</TableCell>
                      <TableCell className={`text-right text-[10px] font-mono ${isITMCall ? "bg-primary/5 text-white" : "text-muted-foreground"}`}>{opt.callVolume.toLocaleString()}</TableCell>
                      <TableCell className={`text-right text-[10px] font-mono ${isITMCall ? "bg-primary/5" : ""}`}>{opt.callIV.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right text-[10px] font-mono text-green-400 ${isITMCall ? "bg-primary/5" : ""}`}>{opt.callDelta.toFixed(2)}</TableCell>
                      <TableCell className={`text-right text-[10px] font-mono font-bold text-white ${isITMCall ? "bg-primary/5" : ""}`}>${opt.callLast.toFixed(2)}</TableCell>
                      <TableCell className={`text-right text-[10px] font-mono border-r border-white/10 text-muted-foreground ${isITMCall ? "bg-primary/5" : ""}`}>{opt.callBid}/{opt.callAsk}</TableCell>
                      <TableCell className={`text-center font-bold text-sm bg-[var(--kiq-surface)]/5 ${isATM ? "text-amber-400" : "text-[var(--kiq-ink)]"}`}>{opt.strike}</TableCell>
                      <TableCell className={`text-left text-[10px] font-mono border-l border-white/10 text-muted-foreground ${isITMPut ? "bg-orange-500/5" : ""}`}>{opt.putBid}/{opt.putAsk}</TableCell>
                      <TableCell className={`text-left text-[10px] font-mono font-bold text-[var(--kiq-ink)] ${isITMPut ? "bg-orange-500/5" : ""}`}>${opt.putLast.toFixed(2)}</TableCell>
                      <TableCell className={`text-left text-[10px] font-mono text-red-400 ${isITMPut ? "bg-orange-500/5" : ""}`}>{opt.putDelta.toFixed(2)}</TableCell>
                      <TableCell className={`text-left text-[10px] font-mono ${isITMPut ? "bg-orange-500/5" : ""}`}>{opt.putIV.toFixed(1)}%</TableCell>
                      <TableCell className={`text-left text-[10px] font-mono ${isITMPut ? "bg-orange-500/5 text-[var(--kiq-ink)]" : "text-muted-foreground"}`}>{opt.putVolume.toLocaleString()}</TableCell>
                      <TableCell className={`text-left text-[10px] font-mono ${isITMPut ? "bg-orange-500/5 text-[var(--kiq-ink)]" : "text-muted-foreground"}`}>{opt.putOI.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Strategy P&L Diagram */}
        <Card className="sidebar-metal-glass border-white/10 lg:col-span-2" data-testid="panel-payoff">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Strategy P&L Diagram
              </CardTitle>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="text-[11px] font-bold px-2 py-1 rounded-lg border bg-black/30 text-[var(--kiq-ink)]"
                style={{ borderColor: "#cbd5e1" }}
                data-testid="select-strategy"
              >
                {STRATEGIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-3">
              <span>Max Profit: <strong className="text-green-400">${maxProfit.toFixed(2)}</strong></span>
              <span>Max Loss: <strong className="text-red-400">${maxLoss.toFixed(2)}</strong></span>
              <span>Strike: <strong className="text-amber-400">${selectedStrike || Math.round(atmStrike / 10) * 10}</strong></span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={payoffData}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF94" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00FF94" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D6D" stopOpacity={0} />
                    <stop offset="95%" stopColor="#FF4D6D" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} />
                <XAxis dataKey="price" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false}
                  tickFormatter={(v) => `$${v}`} />
                <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false}
                  tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "P&L"]} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 3" />
                <ReferenceLine x={atmStrike} stroke="rgba(255,184,0,0.4)" strokeDasharray="4 3"
                  label={{ value: "Spot", position: "top", fill: "#FFB800", fontSize: 10 }} />
                <Area type="monotone" dataKey="pnl" stroke="#00A8FF" strokeWidth={2} fillOpacity={1}
                  fill={`url(#${payoffData.some(d => d.pnl < 0) ? "lossGrad" : "profitGrad"})`} name="P&L" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Greeks + Skew */}
        <div className="space-y-4">
          <Card className="sidebar-metal-glass border-white/10" data-testid="panel-greeks">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Greeks (Portfolio)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Delta", value: "+452.1", color: "#00FF94" },
                  { label: "Gamma", value: "+12.4", color: "#00A8FF" },
                  { label: "Theta", value: "-1,240", color: "#FF4D6D" },
                  { label: "Vega", value: "+840", color: "#A855F7" },
                  { label: "Rho", value: "+124", color: "#FFB800" },
                  { label: "Charm", value: "-0.04", color: "#FF6B6B" },
                ].map(g => (
                  <div key={g.label} className="p-2 rounded-lg" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">{g.label}</p>
                    <p className="text-sm font-mono font-bold" style={{ color: g.color }}>{g.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="sidebar-metal-glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" /> IV Term Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={ivTermStructure}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} />
                  <XAxis dataKey="tenor" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false}
                    tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="iv" stroke="#FFB800" strokeWidth={2}
                    dot={{ fill: "#FFB800", r: 4 }} name="IV" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Vol Skew */}
      <Card className="sidebar-metal-glass border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Volatility Skew — {ticker}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={skewData} data-testid="chart-vol-skew">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" vertical={false} />
              <XAxis dataKey="strike" tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} />
              <YAxis tick={{ fill: "#475569", fontSize: 10 }} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
              <ReferenceLine x={atmStrike} stroke="rgba(255,184,0,0.4)" strokeDasharray="4 3"
                label={{ value: "ATM", position: "top", fill: "#FFB800", fontSize: 10 }} />
              <Line type="monotone" dataKey="callIV" stroke="#00A8FF" strokeWidth={2} dot={{ fill: "#00A8FF", r: 3 }} name="Call IV" />
              <Line type="monotone" dataKey="putIV" stroke="#FF4D6D" strokeWidth={2} dot={{ fill: "#FF4D6D", r: 3 }} name="Put IV" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Layout>
  );
}
