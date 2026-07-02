import { useLocation } from "wouter";
import {
  CandlestickChart, TrendingUp, Building, BarChart3, Wheat,
  Globe2, Newspaper, LineChart, Layers, CreditCard, Zap, Filter
} from "lucide-react";

interface BloombergNavProps {
  ticker?: string;
  active: "charts" | "screener" | "options" | "earnings" | "commodities" |
          "economic-data" | "company" | "news" | "fixed-income" | "factor-analysis" |
          "credit" | "volatility" | "bloomberg";
}

const LINKS = [
  { id: "charts",         label: "Charts",       icon: CandlestickChart, path: "/charts",         usesTicker: true },
  { id: "screener",       label: "Screener",     icon: Filter,           path: "/screener",        usesTicker: false },
  { id: "options",        label: "Options",      icon: TrendingUp,       path: "/options",         usesTicker: true },
  { id: "earnings",       label: "Earnings",     icon: BarChart3,        path: "/earnings",        usesTicker: false },
  { id: "company",        label: "Research",     icon: Building,         path: "/company",         usesTicker: true },
  { id: "news",           label: "News",         icon: Newspaper,        path: "/news",            usesTicker: false },
  { id: "commodities",    label: "Commodities",  icon: Wheat,            path: "/commodities",     usesTicker: false },
  { id: "economic-data",  label: "Macro",        icon: Globe2,           path: "/economic-data",   usesTicker: false },
  { id: "fixed-income",   label: "Fixed Inc.",   icon: LineChart,        path: "/fixed-income",    usesTicker: false },
  { id: "factor-analysis",label: "Factors",      icon: Layers,           path: "/factor-analysis", usesTicker: false },
  { id: "credit",         label: "Credit",       icon: CreditCard,       path: "/credit",          usesTicker: false },
  { id: "volatility",     label: "Volatility",   icon: Zap,              path: "/volatility",      usesTicker: false },
];

export function BloombergNav({ ticker, active }: BloombergNavProps) {
  const [, navigate] = useLocation();

  const handleNav = (link: typeof LINKS[0]) => {
    if (link.usesTicker && ticker) {
      navigate(`${link.path}?ticker=${ticker}`);
    } else {
      navigate(link.path);
    }
  };

  return (
    <div
      className="mb-5 flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      {ticker && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mr-2 flex-shrink-0"
          style={{ background: "rgba(0,168,255,0.12)", border: "1px solid rgba(0,168,255,0.25)" }}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(0,168,255,0.6)" }}>
            TKR
          </span>
          <span className="text-sm font-black tracking-wider" style={{ color: "#00A8FF", fontFamily: "var(--font-mono)" }}>
            {ticker}
          </span>
        </div>
      )}

      {LINKS.map((link) => {
        const Icon = link.icon;
        const isActive = link.id === active;
        return (
          <button
            key={link.id}
            data-testid={`bloomberg-nav-${link.id}`}
            onClick={() => handleNav(link)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0 transition-all"
            style={
              isActive
                ? { background: "rgba(0,168,255,0.15)", color: "#00A8FF", border: "1px solid rgba(0,168,255,0.3)" }
                : { background: "transparent", color: "rgba(140,160,200,0.55)", border: "1px solid transparent" }
            }
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.color = "rgba(200,220,255,0.8)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(140,160,200,0.55)";
              }
            }}
          >
            <Icon size={12} />
            {link.label}
          </button>
        );
      })}
    </div>
  );
}
