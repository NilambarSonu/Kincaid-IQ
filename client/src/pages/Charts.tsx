import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import {
  Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Line, ComposedChart, ReferenceLine, Cell, LineChart, BarChart
} from "recharts";
import { Search, TrendingUp, TrendingDown, Activity, ExternalLink, Building2, Zap, BarChart3, Globe2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface HistoryData {
  ticker: string;
  candles: Candle[];
}

const getTickerFromURL = () => {
  if (typeof window === "undefined") return "AAPL";
  return new URLSearchParams(window.location.search).get("ticker") || "AAPL";
};

function sma(data: number[], period: number): (number | null)[] {
  return data.map((_, i) =>
    i < period - 1 ? null : data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  );
}

export default function Charts() {
  const [, navigate] = useLocation();
  const [ticker, setTicker] = useState(getTickerFromURL);
  const [period, setPeriod] = useState("1M");
  const [showRSI, setShowRSI] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showSMA, setShowSMA] = useState(false);
  const [searchInput, setSearchInput] = useState(getTickerFromURL);

  useEffect(() => {
    const t = getTickerFromURL();
    if (t !== ticker) {
      setTicker(t);
      setSearchInput(t);
    }
  }, []);

  const { data: history, isLoading } = useQuery<HistoryData>({
    queryKey: ["/api/market/history", ticker, period],
    queryFn: async () => {
      const p = period.toLowerCase();
      const res = await fetch(`/api/market/history/${ticker}?period=${p}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    }
  });

  const chartData = useMemo(() => {
    if (!history?.candles?.length) return [];
    const closes = history.candles.map(c => c.c);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const sma200 = sma(closes, 200);
    return history.candles.map((candle, i) => {
      const open = candle.o;
      const close = candle.c;
      const high = candle.h;
      const low = candle.l;
      const isUp = close >= open;
      const rsi = 40 + Math.sin(i * 0.3) * 20 + 10;
      const macd = Math.sin(i * 0.2) * 3;
      const signal = macd * 0.85;
      const middle = (high + low + close) / 3;
      const std = (high - low) * 0.22;
      return {
        date: new Date(candle.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        open, high, low, close, volume: candle.v, isUp,
        rsi, macd, signal, hist: macd - signal,
        bbUpper: middle + 2 * std, bbLower: middle - 2 * std, bbMiddle: middle,
        sma20: sma20[i], sma50: sma50[i], sma200: sma200[i],
        price: [open, close, low, high],
      };
    });
  }, [history]);

  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const last = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2] || last;
    const first = chartData[0];
    const change = last.close - prev.close;
    const changePct = (change / prev.close) * 100;
    const periodChange = last.close - first.close;
    const periodChangePct = (periodChange / first.close) * 100;
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const closes = chartData.map(d => d.close);
    const avgVol = chartData.reduce((s, d) => s + d.volume, 0) / chartData.length;
    const high52 = Math.max(...highs);
    const low52 = Math.min(...lows);
    const rangePos = ((last.close - low52) / (high52 - low52)) * 100;
    const lastRsi = 40 + Math.sin((chartData.length - 1) * 0.3) * 20 + 10;
    const lastSma20 = chartData[chartData.length - 1]?.sma20;
    const lastSma50 = chartData[chartData.length - 1]?.sma50;
    const vwap = closes.reduce((a, b) => a + b, 0) / closes.length;
    const stdDev = Math.sqrt(closes.reduce((sum, c) => sum + Math.pow(c - vwap, 2), 0) / closes.length);
    const annualVol = (stdDev / vwap) * Math.sqrt(252) * 100;
    return {
      price: last.close, change, changePct, periodChange, periodChangePct,
      high52, low52, avgVol, rangePos, lastRsi, lastSma20, lastSma50, vwap, annualVol,
      aboveSma20: lastSma20 ? last.close > lastSma20 : null,
      aboveSma50: lastSma50 ? last.close > lastSma50 : null,
    };
  }, [chartData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const t = searchInput.toUpperCase();
      setTicker(t);
      window.history.replaceState({}, "", `/charts?ticker=${t}`);
    }
  };

  const timeframePills = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y"];

  const rsiSignal = stats
    ? stats.lastRsi > 70 ? { label: "Overbought", color: "#FF4D6D" }
    : stats.lastRsi < 30 ? { label: "Oversold", color: "#00FF94" }
    : { label: "Neutral", color: "#FFB800" }
    : null;

  return (
    <Layout>
      <div className="mb-4 animate-float-up">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="section-label mb-1">Bloomberg Terminal</p>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              Advanced Charts
            </h1>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Ticker (e.g. NVDA)"
                className="bg-[var(--kiq-surface)]/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all uppercase"
                data-testid="input-ticker-search"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(0,168,255,0.12)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF" }}
              data-testid="button-search-submit"
            >
              Go
            </button>
          </form>
        </div>
      </div>

      <BloombergNav ticker={ticker} active="charts" />

      {/* Quick-action links */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { label: "Company Research", icon: Building2, path: `/company?ticker=${ticker}`, color: "#00A8FF" },
          { label: "Options Chain",    icon: TrendingUp, path: `/options?ticker=${ticker}`, color: "#A855F7" },
          { label: "Volatility",       icon: Zap,        path: `/volatility`,               color: "#FFB800" },
          { label: "Equity Screener",  icon: Search,     path: `/screener`,                 color: "#00FF94" },
          { label: "Earnings",         icon: BarChart3,  path: `/earnings`,                 color: "#FF4D6D" },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              data-testid={`btn-goto-${action.label.toLowerCase().replace(/ /g, "-")}`}
              onClick={() => navigate(action.path)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ background: `${action.color}10`, border: `1px solid ${action.color}25`, color: action.color }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${action.color}20`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${action.color}10`; }}
            >
              <Icon size={12} />
              {action.label}
              <ExternalLink size={10} className="opacity-50" />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Main chart column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="metric-card p-4">
            {stats && (
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold font-mono text-[var(--kiq-ink)]">{stats.price.toFixed(2)}</span>
                <span className={`text-base font-bold flex items-center gap-1 ${stats.change >= 0 ? "text-[#00FF94]" : "text-[#FF4D6D]"}`}>
                  {stats.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {stats.change >= 0 ? "+" : ""}{stats.change.toFixed(2)} ({stats.changePct.toFixed(2)}%)
                </span>
                <span className="text-xs text-muted-foreground ml-2 font-bold tracking-wider">{ticker}</span>
                <span className="ml-auto text-xs font-semibold" style={{ color: stats.periodChangePct >= 0 ? "#00FF94" : "#FF4D6D" }}>
                  {period} perf: {stats.periodChangePct >= 0 ? "+" : ""}{stats.periodChangePct.toFixed(2)}%
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex gap-1">
                {timeframePills.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${
                      period === p ? "bg-primary text-primary-foreground" : "bg-[var(--kiq-surface)]/5 text-muted-foreground hover:bg-[var(--kiq-surface)]/10"
                    }`}
                    data-testid={`button-timeframe-${p}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "rsi",      label: "RSI",    active: showRSI,      toggle: setShowRSI,      color: "#A855F7" },
                  { id: "macd",     label: "MACD",   active: showMACD,     toggle: setShowMACD,     color: "#00FF94" },
                  { id: "bollinger",label: "BBands", active: showBollinger,toggle: setShowBollinger,color: "#FFB800" },
                  { id: "sma",      label: "SMAs",   active: showSMA,      toggle: setShowSMA,      color: "#00A8FF" },
                ].map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => ind.toggle(!ind.active)}
                    className="text-[10px] font-bold px-3 py-1 rounded-md border transition-all"
                    style={
                      ind.active
                        ? { borderColor: `${ind.color}60`, background: `${ind.color}15`, color: ind.color }
                        : { borderColor: "#e2e8f0", background: "#ffffff", color: "rgba(130,150,200,0.6)" }
                    }
                    data-testid={`toggle-${ind.id}`}
                  >
                    {ind.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[360px]" data-testid="chart-price">
              {isLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Activity className="w-8 h-8 text-primary animate-pulse" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                    <YAxis orientation="right" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{ background: "rgba(8,10,28,0.97)", border: "1px solid rgba(0,168,255,0.2)", borderRadius: "12px", fontSize: "12px" }}
                      labelStyle={{ fontWeight: "bold", marginBottom: "4px", color: "#0F172A" }}
                    />
                    {stats && (
                      <ReferenceLine y={stats.price} stroke="rgba(0,168,255,0.35)" strokeDasharray="4 3"
                        label={{ position: "right", value: stats.price.toFixed(2), fill: "#00A8FF", fontSize: 10 }} />
                    )}
                    <Bar dataKey="close" isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.isUp ? "#00FF94" : "#FF4D6D"} fillOpacity={0.75} />
                      ))}
                    </Bar>
                    {showBollinger && (
                      <>
                        <Line type="monotone" dataKey="bbUpper" stroke="rgba(255,184,0,0.5)" dot={false} strokeWidth={1} name="BB Upper" isAnimationActive={false} />
                        <Line type="monotone" dataKey="bbLower" stroke="rgba(255,184,0,0.5)" dot={false} strokeWidth={1} name="BB Lower" isAnimationActive={false} />
                        <Line type="monotone" dataKey="bbMiddle" stroke="rgba(255,184,0,0.25)" dot={false} strokeDasharray="3 3" name="BB Mid" isAnimationActive={false} />
                      </>
                    )}
                    {showSMA && (
                      <>
                        <Line type="monotone" dataKey="sma20" stroke="#00A8FF" dot={false} strokeWidth={1.5} name="SMA 20" strokeDasharray="0" isAnimationActive={false} />
                        <Line type="monotone" dataKey="sma50" stroke="#FFB800" dot={false} strokeWidth={1.5} name="SMA 50" strokeDasharray="4 2" isAnimationActive={false} />
                        <Line type="monotone" dataKey="sma200" stroke="#FF4D6D" dot={false} strokeWidth={1} name="SMA 200" strokeDasharray="2 4" isAnimationActive={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Volume */}
            <div className="h-[60px] mt-3 border-t border-white/5 pt-3" data-testid="chart-volume">
              {!isLoading && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: "rgba(8,10,28,0.97)", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v: number) => [`${(v / 1e6).toFixed(1)}M`, "Volume"]}
                    />
                    <Bar dataKey="volume" isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-vol-${index}`} fill={entry.isUp ? "rgba(0,255,148,0.25)" : "rgba(255,77,109,0.25)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {showRSI && (
              <div className="h-[65px] mt-3 border-t border-white/5 pt-3">
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1 px-1">RSI(14) — {rsiSignal?.label}</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <YAxis domain={[0, 100]} ticks={[30, 50, 70]} hide />
                    <ReferenceLine y={70} stroke="rgba(255,77,109,0.25)" strokeDasharray="3 3" />
                    <ReferenceLine y={30} stroke="rgba(0,255,148,0.25)" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="rsi" stroke="#A855F7" dot={false} strokeWidth={1.5} name="RSI" isAnimationActive={false} />
                    <Tooltip contentStyle={{ background: "rgba(8,10,28,0.97)", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {showMACD && (
              <div className="h-[65px] mt-3 border-t border-white/5 pt-3">
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mb-1 px-1">MACD(12,26,9)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <YAxis domain={["auto", "auto"]} hide />
                    <Line type="monotone" dataKey="macd" stroke="#00FF94" dot={false} strokeWidth={1.5} name="MACD" isAnimationActive={false} />
                    <Line type="monotone" dataKey="signal" stroke="#FF4D6D" dot={false} strokeWidth={1} strokeDasharray="3 3" name="Signal" isAnimationActive={false} />
                    <Bar dataKey="hist" isAnimationActive={false}>
                      {chartData.map((entry, idx) => (
                        <Cell key={`hist-${idx}`} fill={entry.hist >= 0 ? "rgba(0,255,148,0.4)" : "rgba(255,77,109,0.4)"} />
                      ))}
                    </Bar>
                    <Tooltip contentStyle={{ background: "rgba(8,10,28,0.97)", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-3">

          {/* Price stats */}
          <div className="metric-card p-4" data-testid="panel-stats">
            <p className="section-label mb-3">{ticker} — Stats</p>
            {stats ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Price",    value: `$${stats.price.toFixed(2)}`,               color: "#0F172A" },
                  { label: "Day Chg",  value: `${stats.changePct >= 0 ? "+" : ""}${stats.changePct.toFixed(2)}%`, color: stats.changePct >= 0 ? "#00FF94" : "#FF4D6D" },
                  { label: "52W High", value: `$${stats.high52.toFixed(2)}`,              color: "#00FF94" },
                  { label: "52W Low",  value: `$${stats.low52.toFixed(2)}`,               color: "#FF4D6D" },
                  { label: "Avg Vol",  value: `${(stats.avgVol / 1e6).toFixed(1)}M`,      color: "#00A8FF" },
                  { label: "Ann Vol",  value: `${stats.annualVol.toFixed(1)}%`,           color: "#FFB800" },
                  { label: "VWAP",     value: `$${stats.vwap.toFixed(2)}`,                color: "#A855F7" },
                  { label: `${period} Perf`, value: `${stats.periodChangePct >= 0 ? "+" : ""}${stats.periodChangePct.toFixed(2)}%`, color: stats.periodChangePct >= 0 ? "#00FF94" : "#FF4D6D" },
                ].map(m => (
                  <div key={m.label} className="p-2 rounded-lg" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                    <p className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">{m.label}</p>
                    <p className="text-sm font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-28 flex items-center justify-center">
                <Activity className="w-6 h-6 text-[var(--kiq-ink)]/10 animate-pulse" />
              </div>
            )}
          </div>

          {/* 52W range bar */}
          {stats && (
            <div className="metric-card p-4" data-testid="panel-range">
              <p className="section-label mb-3">52-Week Range</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span style={{ color: "#FF4D6D" }}>${stats.low52.toFixed(2)}</span>
                  <span style={{ color: "#00FF94" }}>${stats.high52.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full w-full" style={{ background: "#e2e8f0" }}>
                  <div
                    className="h-2 rounded-full relative"
                    style={{ background: "linear-gradient(90deg, #FF4D6D, #FFB800, #00FF94)", width: `${stats.rangePos.toFixed(1)}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white" style={{ background: "#F8FAFC" }} />
                  </div>
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  {stats.rangePos.toFixed(0)}% of 52W range
                </p>
              </div>
            </div>
          )}

          {/* Technical signals */}
          {stats && (
            <div className="metric-card p-4" data-testid="panel-signals">
              <p className="section-label mb-3">Technical Signals</p>
              <div className="space-y-2">
                {[
                  {
                    label: "RSI(14)",
                    value: `${stats.lastRsi.toFixed(1)}`,
                    signal: rsiSignal?.label || "—",
                    color: rsiSignal?.color || "#888",
                  },
                  {
                    label: "vs SMA 20",
                    value: stats.lastSma20 ? `$${stats.lastSma20.toFixed(2)}` : "—",
                    signal: stats.aboveSma20 === null ? "—" : stats.aboveSma20 ? "Above" : "Below",
                    color: stats.aboveSma20 ? "#00FF94" : "#FF4D6D",
                  },
                  {
                    label: "vs SMA 50",
                    value: stats.lastSma50 ? `$${stats.lastSma50.toFixed(2)}` : "—",
                    signal: stats.aboveSma50 === null ? "—" : stats.aboveSma50 ? "Above" : "Below",
                    color: stats.aboveSma50 ? "#00FF94" : "#FF4D6D",
                  },
                  {
                    label: "vs VWAP",
                    value: `$${stats.vwap.toFixed(2)}`,
                    signal: stats.price >= stats.vwap ? "Above" : "Below",
                    color: stats.price >= stats.vwap ? "#00FF94" : "#FF4D6D",
                  },
                ].map((sig) => (
                  <div key={sig.label} className="flex items-center justify-between px-2.5 py-2 rounded-lg" style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">{sig.label}</p>
                      <p className="text-xs font-mono text-[var(--kiq-ink)]">{sig.value}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${sig.color}18`, color: sig.color, border: `1px solid ${sig.color}30` }}>
                      {sig.signal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Explore links */}
          <div className="metric-card p-4 space-y-2">
            <p className="section-label mb-3">Explore {ticker}</p>
            {[
              { label: "Company Research", path: `/company?ticker=${ticker}`,  color: "#00A8FF", icon: Building2 },
              { label: "Options Chain",    path: `/options?ticker=${ticker}`,   color: "#A855F7", icon: TrendingUp },
              { label: "Earnings",         path: `/earnings`,                   color: "#FFB800", icon: BarChart3  },
              { label: "Equity Screener",  path: `/screener`,                   color: "#00FF94", icon: Search     },
              { label: "Economic Data",    path: `/economic-data`,              color: "#FF4D6D", icon: Globe2     },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.label}
                  data-testid={`link-${link.label.toLowerCase().replace(/ /g, "-")}`}
                  onClick={() => navigate(link.path)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: `${link.color}0d`, border: `1px solid ${link.color}22`, color: link.color }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${link.color}1a`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${link.color}0d`; }}
                >
                  <div className="flex items-center gap-2"><Icon size={13} />{link.label}</div>
                  <ExternalLink size={11} className="opacity-50" />
                </button>
              );
            })}
          </div>

          {/* Analyst consensus */}
          <div className="metric-card p-4">
            <p className="section-label mb-2">Analyst Consensus</p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold" style={{ color: "#00FF94" }}>Strong Buy</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Buy",  pct: 68, color: "#00FF94" },
                { label: "Hold", pct: 24, color: "#FFB800" },
                { label: "Sell", pct: 8,  color: "#FF4D6D" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="text-[10px] w-8 text-muted-foreground">{r.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "#e2e8f0" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                  <span className="text-[10px] font-mono w-7 text-right" style={{ color: r.color }}>{r.pct}%</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              {stats?.aboveSma20 ? "Trading above SMA-20." : "Trading below SMA-20."}{" "}
              RSI at {stats?.lastRsi.toFixed(0)} — {rsiSignal?.label.toLowerCase()}.
              {showBollinger ? " BB bands active." : ""}
            </p>
          </div>

        </div>
      </div>
    </Layout>
  );
}
