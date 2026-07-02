import { TrendingUp, TrendingDown } from "lucide-react";
import { useMarketData } from "@/lib/marketData";

export function MarketTicker() {
  const { data: quotes, isLoading } = useMarketData();

  if (isLoading || !quotes) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-2 overflow-hidden"
        style={{ borderBottom: "1px solid rgba(0,140,255,0.08)", background: "rgba(0,0,8,0.6)" }}
      >
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide flex-shrink-0"
      style={{ borderBottom: "1px solid rgba(0,140,255,0.08)", background: "rgba(0,0,8,0.6)" }}
      data-testid="market-ticker"
    >
      {quotes.map((q) => {
        const isPos = q.changePct >= 0;
        const color = isPos ? "#00FF94" : "#FF4D6D";
        return (
          <div
            key={q.ticker}
            className="flex items-center gap-2 px-3 py-1 rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            data-testid={`ticker-${q.ticker.replace("^", "").replace("-", "")}`}
          >
            <span className="text-[10px] font-bold tracking-wider" style={{ color: "rgba(150,170,210,0.7)" }}>
              {q.ticker.replace("^", "")}
            </span>
            <span className="text-xs font-semibold text-white">
              {q.price >= 10_000
                ? `$${Math.round(q.price).toLocaleString()}`
                : q.price >= 100
                ? `$${q.price.toFixed(2)}`
                : `$${q.price.toFixed(2)}`}
            </span>
            <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color }}>
              {isPos ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {isPos ? "+" : ""}{q.changePct.toFixed(2)}%
            </span>
            {!q.live && (
              <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.2)" }}>~</span>
            )}
          </div>
        );
      })}
      <div className="flex-shrink-0 flex items-center gap-1 ml-2" style={{ color: "rgba(130,150,180,0.3)" }}>
        <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
        <span className="text-[9px]">LIVE</span>
      </div>
    </div>
  );
}
