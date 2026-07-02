import { useState } from "react";
import { Layout } from "@/components/Layout";
import { charitableStrategies, formatCurrency } from "@/lib/mockData";
import { Heart, CheckCircle, XCircle, ArrowRight, TrendingUp } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

type StrategyKey = "daf" | "appreciatedStock" | "clat" | "privateFoundation";

const STRATEGY_COLORS: Record<StrategyKey, string> = {
  daf: "#00FF94",
  appreciatedStock: "#00A8FF",
  clat: "#FFB800",
  privateFoundation: "#A855F7",
};

const STRATEGY_LABELS: Record<StrategyKey, string> = {
  daf: "Donor-Advised Fund",
  appreciatedStock: "Appreciated Stock Gift",
  clat: "Charitable Lead Annuity Trust",
  privateFoundation: "Private Foundation",
};

const STRATEGY_ICONS: Record<StrategyKey, string> = {
  daf: "DAF",
  appreciatedStock: "STK",
  clat: "CLAT",
  privateFoundation: "FDN",
};

export default function Charitable() {
  const { open } = useDrillDown();
  const [selected, setSelected] = useState<StrategyKey>("daf");
  const [giftAmount, setGiftAmount] = useState(10_000_000);

  const strategy = charitableStrategies[selected];
  const scale = giftAmount / 10_000_000;
  const scaledDeduction = strategy.immediateDeduction * scale;
  const scaledSavings = strategy.estimatedTaxSaving * scale;
  const scaledGivingPower = strategy.fiveYearGivingPower * scale;

  const strategies = Object.entries(charitableStrategies) as [StrategyKey, typeof charitableStrategies.daf & any][];

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Philanthropic Planning</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Charitable Giving Optimizer
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Model the optimal strategy to maximize charitable impact and tax efficiency</p>
      </div>

      <div className="metric-card mb-6" data-testid="card-charitable-amount">
        <div className="flex items-center justify-between mb-4">
          <p className="section-label">Gift Amount</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#00FF94" }}>{formatCurrency(giftAmount)}</p>
        </div>
        <input
          type="range"
          min={1_000_000}
          max={100_000_000}
          step={1_000_000}
          value={giftAmount}
          onChange={(e) => setGiftAmount(parseInt(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #00FF94 ${((giftAmount - 1_000_000) / 99_000_000) * 100}%, rgba(255,255,255,0.08) ${((giftAmount - 1_000_000) / 99_000_000) * 100}%)`, accentColor: "#00FF94" }}
          data-testid="slider-gift-amount"
        />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1 opacity-50">
          <span>$1M</span><span>$100M</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {strategies.map(([key, s]) => {
          const color = STRATEGY_COLORS[key];
          const sc = giftAmount / 10_000_000;
          const isSelected = selected === key;
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className="text-left metric-card transition-all duration-200"
              style={{
                borderTop: `2px solid ${color}`,
                boxShadow: isSelected ? `0 0 20px ${color}15` : undefined,
                background: isSelected ? `rgba(${color.slice(1).match(/.{2}/g)!.map(h=>parseInt(h,16)).join(",")},0.05)` : undefined,
              }}
              data-testid={`card-strategy-${key}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}>
                  {STRATEGY_ICONS[key]}
                </div>
                {isSelected && <CheckCircle size={14} style={{ color }} />}
              </div>
              <p className="font-bold text-sm text-white mb-1">{STRATEGY_LABELS[key]}</p>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{s.description}</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Tax Saving</span>
                  <span className="font-bold" style={{ color }}>{formatCurrency(s.estimatedTaxSaving * sc)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Setup Time</span>
                  <span className="text-white">{s.setupTime}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Complexity</span>
                  <span className="text-white">{s.grantFlexibility} flex</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card" style={{ borderTop: `2px solid ${STRATEGY_COLORS[selected]}` }} data-testid="card-charitable-detail">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ background: `${STRATEGY_COLORS[selected]}12`, border: `1px solid ${STRATEGY_COLORS[selected]}25`, color: STRATEGY_COLORS[selected] }}>
              {STRATEGY_ICONS[selected]}
            </div>
            <div>
              <p className="font-bold text-white">{STRATEGY_LABELS[selected]}</p>
              <p className="text-xs text-muted-foreground">Strategy Analysis</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{strategy.description}</p>

          <div className="space-y-3">
            {[
              { label: "Immediate Deduction", value: formatCurrency(scaledDeduction), color: STRATEGY_COLORS[selected] },
              { label: "Estimated Tax Savings", value: formatCurrency(scaledSavings), color: "#00FF94" },
              { label: "5-Year Giving Power", value: formatCurrency(scaledGivingPower), color: "#00A8FF" },
              { label: "Deduction Rate", value: `${strategy.deductionPct}% of AGI`, color: "rgba(150,170,210,0.7)" },
              { label: "Setup Time", value: strategy.setupTime, color: "rgba(150,170,210,0.7)" },
              { label: "Grant Flexibility", value: strategy.grantFlexibility, color: "rgba(150,170,210,0.7)" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-bold" style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="metric-card" data-testid="card-charitable-comparison">
          <p className="section-label mb-4">Strategy Comparison — Tax Savings</p>
          <div className="space-y-3">
            {strategies.map(([key, s]) => {
              const color = STRATEGY_COLORS[key];
              const sc = giftAmount / 10_000_000;
              const savings = s.estimatedTaxSaving * sc;
              const maxSavings = Math.max(...strategies.map(([,s2]) => s2.estimatedTaxSaving)) * sc;
              const barPct = (savings / maxSavings) * 100;
              return (
                <button key={key} onClick={() => setSelected(key)} className="w-full text-left">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: selected === key ? color : "rgba(150,170,210,0.7)" }} className="font-semibold">{STRATEGY_LABELS[key]}</span>
                    <span className="font-bold" style={{ color }}>{formatCurrency(savings)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barPct}%`, background: color, opacity: selected === key ? 1 : 0.4 }} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-4 rounded-xl" style={{ background: "rgba(0,255,148,0.05)", border: "1px solid rgba(0,255,148,0.12)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Heart size={13} style={{ color: "#00FF94" }} />
              <p className="text-xs font-semibold" style={{ color: "#00FF94" }}>Philanthropic Impact</p>
            </div>
            <p className="text-xs text-muted-foreground">
              With the <strong className="text-white">{STRATEGY_LABELS[selected]}</strong> strategy, your{" "}
              <strong className="text-white">{formatCurrency(giftAmount)}</strong> gift generates{" "}
              <strong style={{ color: "#00FF94" }}>{formatCurrency(scaledSavings)}</strong> in tax savings,{" "}
              giving you an effective giving cost of{" "}
              <strong className="text-white">{formatCurrency(giftAmount - scaledSavings)}</strong>.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
