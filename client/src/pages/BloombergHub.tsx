import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  CandlestickChart, Filter, TrendingUp, BarChart3, Wheat,
  Globe2, Building, Newspaper, LineChart, Layers, CreditCard,
  Zap, ArrowRight, Activity
} from "lucide-react";


const quickLaunch = [
  {
    path: "/charts",
    label: "Advanced Charts",
    icon: CandlestickChart,
    desc: "OHLCV · RSI · MACD · Bollinger",
    color: "#00A8FF",
    gradient: "linear-gradient(135deg, rgba(0,168,255,0.18) 0%, rgba(0,168,255,0.06) 100%)",
    border: "rgba(0,168,255,0.35)",
  },
  {
    path: "/screener",
    label: "Equity Screener",
    icon: Filter,
    desc: "80 stocks · AI ranking · 6 presets",
    color: "#00FF94",
    gradient: "linear-gradient(135deg, rgba(0,255,148,0.18) 0%, rgba(0,255,148,0.06) 100%)",
    border: "rgba(0,255,148,0.35)",
  },
  {
    path: "/options",
    label: "Options Analytics",
    icon: TrendingUp,
    desc: "Greeks · IV surface · P&L payoff",
    color: "#FFB800",
    gradient: "linear-gradient(135deg, rgba(255,184,0,0.18) 0%, rgba(255,184,0,0.06) 100%)",
    border: "rgba(255,184,0,0.35)",
  },
  {
    path: "/earnings",
    label: "Earnings Tracker",
    icon: BarChart3,
    desc: "Calendar · beats/misses · 8Q history",
    color: "#A855F7",
    gradient: "linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(168,85,247,0.06) 100%)",
    border: "rgba(168,85,247,0.35)",
  },
  {
    path: "/commodities",
    label: "Commodities Board",
    icon: Wheat,
    desc: "Energy · Metals · Agriculture · Curves",
    color: "#FF4D6D",
    gradient: "linear-gradient(135deg, rgba(255,77,109,0.18) 0%, rgba(255,77,109,0.06) 100%)",
    border: "rgba(255,77,109,0.35)",
  },
];

const features = [
  {
    category: "Markets",
    color: "#00A8FF",
    items: [
      { path: "/charts",      label: "Advanced Charts",     icon: CandlestickChart, desc: "Live OHLCV candlestick charts for any ticker. RSI, MACD, Bollinger Bands. 1D–5Y timeframes." },
      { path: "/screener",    label: "Equity Screener",     icon: Filter,           desc: "80-stock universe. Filter by P/E, yield, momentum, beta. 6 preset screens. AI ranking." },
      { path: "/options",     label: "Options Analytics",   icon: TrendingUp,       desc: "Full options chain with Greeks (Delta, Gamma, Theta, Vega). Volatility skew chart." },
      { path: "/earnings",    label: "Earnings Tracker",    icon: BarChart3,        desc: "Calendar & list view. EPS estimates vs actuals, beat/miss, 8-quarter history per stock." },
      { path: "/commodities", label: "Commodities Board",   icon: Wheat,            desc: "Energy, Metals, Agriculture. Spot prices, term structure curves, 1Y history charts." },
    ],
  },
  {
    category: "Macro & Research",
    color: "#A855F7",
    items: [
      { path: "/economic-data", label: "Economic Dashboard",   icon: Globe2,    desc: "GDP, CPI, PCE, NFP, Fed Funds. FOMC calendar with cut/hold probabilities. Recession gauge." },
      { path: "/company",       label: "Company Deep Dive",    icon: Building,  desc: "Ticker → GPT-4o generates full equity research note. Financials, valuation, bull/bear cases." },
      { path: "/news",          label: "News Intelligence",    icon: Newspaper, desc: "Claude generates 10-item personalized feed mapped to your holdings. Sentiment + impact scores." },
      { path: "/fixed-income",  label: "Fixed Income",         icon: LineChart, desc: "Treasury yield curve, bond pricer (YTM, duration, DV01), IG vs HY spread history." },
      { path: "/watchlist",     label: "Watchlist",            icon: Activity,  desc: "Track your monitored tickers with live quotes, alerts, and quick-jump to charts or options." },
    ],
  },
  {
    category: "Risk & Quantitative",
    color: "#00FF94",
    items: [
      { path: "/factor-analysis",   label: "Factor Analysis",    icon: Layers,     desc: "7-factor portfolio decomposition. Return attribution waterfall. Morningstar style box." },
      { path: "/credit",            label: "Credit Monitor",     icon: CreditCard, desc: "IG/HY OAS, CDX IG/HY indices. Sector credit matrix. Jeremiah's private credit book." },
      { path: "/volatility",        label: "Volatility Monitor", icon: Zap,        desc: "VIX term structure, vol surface, SPX skew smirk, portfolio volatility contribution." },
      { path: "/monte-carlo",       label: "Monte Carlo",        icon: BarChart3,  desc: "10,000-path simulation of portfolio outcomes. Confidence intervals. Drawdown analysis." },
      { path: "/rate-sensitivity",  label: "Rate Sensitivity",   icon: LineChart,  desc: "Duration, DV01, and convexity of your fixed-income book. Parallel & twist shock scenarios." },
    ],
  },
];

export default function BloombergHub() {
  const [, navigate] = useLocation();

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-8">

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(0,168,255,0.2), rgba(168,85,247,0.2))", border: "1px solid rgba(0,168,255,0.3)" }}
            >
              <Activity size={20} style={{ color: "#00A8FF" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--foreground))" }}>
                Bloomberg Terminal
              </h1>
              <p className="text-sm" style={{ color: "rgba(140,170,220,0.6)" }}>
                Professional market intelligence — 12 institutional-grade modules
              </p>
            </div>
          </div>
        </div>

        {/* Quick Launch Row */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(140,170,220,0.4)", letterSpacing: "0.18em" }}>
            Quick Launch
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {quickLaunch.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  data-testid={`quick-launch-${item.path.replace("/", "")}`}
                  onClick={() => navigate(item.path)}
                  className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    background: item.gradient,
                    border: `1px solid ${item.border}`,
                    backdropFilter: "blur(16px)",
                    boxShadow: "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${item.color}22`;
                    (e.currentTarget as HTMLElement).style.border = `1px solid ${item.color}66`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.border = `1px solid ${item.border}`;
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}
                  >
                    <Icon size={22} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm leading-tight text-[var(--kiq-ink)] mb-1">{item.label}</p>
                    <p className="text-[11px] leading-snug" style={{ color: "rgba(180,200,230,0.55)" }}>{item.desc}</p>
                  </div>
                  <ArrowRight
                    size={13}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: item.color }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Module Sections */}
        {features.map((group) => (
          <div key={group.category} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${group.color}44, transparent)` }} />
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: group.color, letterSpacing: "0.18em" }}
              >
                {group.category}
              </span>
              <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${group.color}44)` }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    data-testid={`card-bloomberg-${item.path.replace("/", "")}`}
                    onClick={() => navigate(item.path)}
                    className="group text-left rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
                    style={{
                      background: `linear-gradient(135deg, ${group.color}0a 0%, #ffffff 100%)`,
                      border: `1px solid ${group.color}28`,
                      backdropFilter: "blur(12px)",
                      boxShadow: "none",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.border = `1px solid ${group.color}66`;
                      (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${group.color}18 0%, #ffffff 100%)`;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${group.color}18`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.border = `1px solid ${group.color}28`;
                      (e.currentTarget as HTMLElement).style.background = `linear-gradient(135deg, ${group.color}0a 0%, #ffffff 100%)`;
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-110"
                          style={{ background: `${group.color}22`, border: `1px solid ${group.color}44` }}
                        >
                          <Icon size={16} style={{ color: group.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm leading-tight mb-1" style={{ color: "hsl(var(--foreground))" }}>
                            {item.label}
                          </div>
                          <div className="text-xs leading-relaxed" style={{ color: "rgba(140,170,220,0.55)" }}>
                            {item.desc}
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex-shrink-0 mt-1 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100"
                        style={{ background: `${group.color}22`, border: `1px solid ${group.color}44` }}
                      >
                        <ArrowRight size={12} style={{ color: group.color }} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div
          className="rounded-xl p-4 text-center"
          style={{ background: "#ffffff", border: "1px solid #f8fafc" }}
        >
          <p className="text-xs" style={{ color: "rgba(140,170,220,0.4)" }}>
            Bloomberg Terminal subscription: $24,000/yr per seat &nbsp;·&nbsp; Kincaid Health: included with your Kincaid Health Platinum account
          </p>
        </div>

      </div>
    </Layout>
  );
}
