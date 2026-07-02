import { useState } from "react";
import { Layout } from "@/components/Layout";
import { scenarioSimulations, assetAllocation, formatCurrency } from "@/lib/mockData";
import { FlaskConical, TrendingDown, TrendingUp, Clock, Search, Plus, X, SlidersHorizontal, Zap } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const categoryColors: Record<string, { border: string; color: string; bg: string }> = {
  "Equity Shock": { bg: "rgba(255,60,60,0.07)", color: "hsl(0 90% 65%)", border: "rgba(255,60,60,0.2)" },
  "Rate Shock": { bg: "rgba(255,140,0,0.07)", color: "hsl(30 100% 60%)", border: "rgba(255,140,0,0.2)" },
  "Inflation": { bg: "rgba(255,184,0,0.07)", color: "hsl(44 100% 60%)", border: "rgba(255,184,0,0.2)" },
  "Currency": { bg: "rgba(0,140,255,0.07)", color: "hsl(207 100% 65%)", border: "rgba(0,140,255,0.2)" },
  "Geopolitical": { bg: "rgba(168,85,247,0.07)", color: "hsl(270 80% 70%)", border: "rgba(168,85,247,0.2)" },
  "Baseline": { bg: "rgba(0,255,148,0.07)", color: "hsl(150 100% 55%)", border: "rgba(0,255,148,0.2)" },
  "Custom": { bg: "rgba(0,229,255,0.07)", color: "hsl(190 100% 65%)", border: "rgba(0,229,255,0.2)" },
};

const liquidityColors: Record<string, string> = {
  None: "risk-none",
  Low: "risk-low",
  Medium: "risk-moderate",
  High: "risk-high",
};

const ASSET_CLASS_BETAS: Record<string, number> = {
  "Public Equities": 1.0,
  "Private Equity": 1.4,
  "Hedge Funds": 0.5,
  "Real Estate": 0.6,
  "Venture Capital": 1.8,
  "Private Credit": 0.3,
  "Real Assets": 0.8,
  "Cash & Treasury": -0.2,
  "Crypto Assets": 2.2,
  "Art & Collectibles": 0.1,
};

const TOTAL_PORTFOLIO = 2_410_000_000;

interface CustomScenario {
  id: string;
  name: string;
  equityShock: number;
  rateChangeBps: number;
  creditSpreadBps: number;
  commodityShock: number;
  timeHorizonMonths: number;
  portfolioImpact: number;
  impactValue: number;
  recoveryMonths: number;
}

function computeImpact(equityShock: number, rateChangeBps: number, creditSpreadBps: number, commodityShock: number): number {
  let totalImpact = 0;
  for (const a of assetAllocation) {
    const weight = a.pct / 100;
    const beta = ASSET_CLASS_BETAS[a.name] ?? 0.5;
    const equityContrib = (equityShock / 100) * beta * weight;
    const rateContrib = (rateChangeBps / 10000) * -0.08 * weight;
    const creditContrib = (creditSpreadBps / 10000) * -0.12 * weight;
    const commodContrib = (commodityShock / 100) * 0.15 * weight;
    totalImpact += equityContrib + rateContrib + creditContrib + commodContrib;
  }
  return totalImpact * 100;
}

function SliderField({ label, value, onChange, min, max, unit, color }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; unit: string; color: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-sm font-bold" style={{ color, fontFamily: "var(--font-display)" }}>
          {value >= 0 && min < 0 ? "+" : ""}{value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
          accentColor: color,
        }}
        data-testid={`slider-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5 opacity-50">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function Scenarios() {
  const { open } = useDrillDown();
  const [showBuilder, setShowBuilder] = useState(false);
  const [customName, setCustomName] = useState("My Scenario");
  const [equityShock, setEquityShock] = useState(-20);
  const [rateChangeBps, setRateChangeBps] = useState(100);
  const [creditSpreadBps, setCreditSpreadBps] = useState(200);
  const [commodityShock, setCommodityShock] = useState(-10);
  const [timeHorizon, setTimeHorizon] = useState(12);
  const [customScenarios, setCustomScenarios] = useState<CustomScenario[]>([]);

  const baseCase = scenarioSimulations.find((s) => s.category === "Baseline");
  const worstCase = scenarioSimulations.reduce((worst, s) => s.portfolioImpact < worst.portfolioImpact ? s : worst);

  const liveImpactPct = computeImpact(equityShock, rateChangeBps, creditSpreadBps, commodityShock);
  const liveImpactValue = (liveImpactPct / 100) * TOTAL_PORTFOLIO;
  const liveRecovery = Math.round(Math.abs(liveImpactPct) * 1.8);

  const handleSaveScenario = () => {
    const newScenario: CustomScenario = {
      id: `custom-${Date.now()}`,
      name: customName || "Custom Scenario",
      equityShock,
      rateChangeBps,
      creditSpreadBps,
      commodityShock,
      timeHorizonMonths: timeHorizon,
      portfolioImpact: Math.round(liveImpactPct * 10) / 10,
      impactValue: Math.round(liveImpactValue),
      recoveryMonths: liveRecovery,
    };
    setCustomScenarios((prev) => [newScenario, ...prev]);
    setShowBuilder(false);
  };

  return (
    <Layout>
      <div className="mb-8">
        <p className="section-label mb-1">Risk Analysis</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              Scenario Simulator
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Stress-test your portfolio across market, macro, and geopolitical events</p>
          </div>
          <button
            onClick={() => setShowBuilder((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: showBuilder ? "rgba(0,229,255,0.12)" : "rgba(0,229,255,0.08)",
              border: "1px solid rgba(0,229,255,0.25)",
              color: "#00E5FF",
            }}
            data-testid="button-custom-scenario"
          >
            {showBuilder ? <X size={14} /> : <Plus size={14} />}
            Build Custom Scenario
          </button>
        </div>
      </div>

      {showBuilder && (
        <div
          className="metric-card mb-6"
          style={{ border: "1px solid rgba(0,229,255,0.2)" }}
          data-testid="panel-scenario-builder"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.15)" }}>
              <SlidersHorizontal size={15} style={{ color: "#00E5FF" }} />
            </div>
            <div>
              <p className="font-bold text-sm">Custom Scenario Builder</p>
              <p className="text-xs text-muted-foreground">Real-time portfolio impact calculation</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Scenario Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Fed Shock + China Tensions"
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-scenario-name"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Time Horizon</label>
              <div className="flex gap-2">
                {[3, 6, 12, 24].map((m) => (
                  <button
                    key={m}
                    onClick={() => setTimeHorizon(m)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: timeHorizon === m ? "rgba(0,229,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${timeHorizon === m ? "rgba(0,229,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                      color: timeHorizon === m ? "#00E5FF" : "rgba(150,170,210,0.5)",
                    }}
                    data-testid={`horizon-${m}`}
                  >
                    {m}mo
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
            <SliderField label="Equity Shock" value={equityShock} onChange={setEquityShock} min={-80} max={30} unit="%" color="#FF4D6D" />
            <SliderField label="Rate Change" value={rateChangeBps} onChange={setRateChangeBps} min={-300} max={500} unit="bps" color="#FFB800" />
            <SliderField label="Credit Spread" value={creditSpreadBps} onChange={setCreditSpreadBps} min={0} max={1000} unit="bps" color="#FF8C00" />
            <SliderField label="Commodity Shock" value={commodityShock} onChange={setCommodityShock} min={-60} max={60} unit="%" color="#A855F7" />
          </div>

          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: liveImpactPct >= 0 ? "rgba(0,255,148,0.05)" : "rgba(255,77,109,0.05)", border: `1px solid ${liveImpactPct >= 0 ? "rgba(0,255,148,0.2)" : "rgba(255,77,109,0.2)"}` }}
            data-testid="card-live-impact"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap size={10} style={{ color: "#00E5FF" }} /> Live Portfolio Impact
              </p>
              <p className="text-xs text-muted-foreground">{timeHorizon}-month horizon</p>
            </div>
            <div className="flex items-baseline gap-4">
              <p
                className="text-3xl font-bold"
                style={{ fontFamily: "var(--font-display)", color: liveImpactPct >= 0 ? "#00FF94" : "#FF4D6D" }}
                data-testid="text-impact-pct"
              >
                {liveImpactPct >= 0 ? "+" : ""}{liveImpactPct.toFixed(2)}%
              </p>
              <p className="text-lg font-semibold" style={{ color: liveImpactPct >= 0 ? "#00FF94" : "#FF4D6D" }}>
                {liveImpactPct >= 0 ? "+" : ""}{formatCurrency(liveImpactValue)}
              </p>
            </div>
            {liveImpactPct < 0 && (
              <p className="text-xs text-muted-foreground mt-1">Est. recovery: ~{liveRecovery} months</p>
            )}
          </div>

          <button
            onClick={handleSaveScenario}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,229,255,0.12)", border: "1px solid rgba(0,229,255,0.25)", color: "#00E5FF" }}
            data-testid="button-save-scenario"
          >
            Save to Scenario Grid
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {baseCase && (
          <div className="rounded-2xl p-6" style={{ background: "hsl(var(--primary))" }} data-testid="card-base-case">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} style={{ color: "hsl(38 65% 60%)" }} />
              <p className="text-sm font-medium" style={{ color: "hsl(38 20% 70%)" }}>Base Case (Soft Landing)</p>
            </div>
            <p className="text-3xl font-bold text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
              +{baseCase.portfolioImpact}%
            </p>
            <p className="text-sm mt-1" style={{ color: "hsl(38 40% 60%)" }}>+{formatCurrency(baseCase.impactValue)} projected gain</p>
          </div>
        )}
        {worstCase && (
          <div className="metric-card" data-testid="card-worst-case">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown size={16} className="text-red-500" />
              <p className="section-label">Worst Case ({worstCase.name})</p>
            </div>
            <p className="text-3xl font-bold value-negative" style={{ fontFamily: "var(--font-display)" }}>
              {worstCase.portfolioImpact}%
            </p>
            <p className="text-sm text-muted-foreground mt-1">{formatCurrency(Math.abs(worstCase.impactValue))} potential loss</p>
          </div>
        )}
      </div>

      {customScenarios.length > 0 && (
        <div className="mb-4">
          <p className="section-label mb-3">Custom Scenarios</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="grid-custom-scenarios">
            {customScenarios.map((s) => {
              const isPos = s.portfolioImpact > 0;
              const c = categoryColors["Custom"];
              return (
                <div key={s.id} className="metric-card" style={{ border: `1px solid ${c.border}` }} data-testid={`card-custom-${s.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(0,229,255,0.08)" }}>
                      <SlidersHorizontal size={15} style={{ color: c.color }} />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                      Custom
                    </span>
                  </div>
                  <h3 className="font-bold text-sm mb-1">{s.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{s.timeHorizonMonths}mo horizon · Equity: {s.equityShock > 0 ? "+" : ""}{s.equityShock}% · Rates: {s.rateChangeBps > 0 ? "+" : ""}{s.rateChangeBps}bps</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Portfolio Impact</span>
                      <span className={`text-sm font-bold ${isPos ? "value-positive" : "value-negative"}`}>{isPos ? "+" : ""}{s.portfolioImpact}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Value Change</span>
                      <span className={`text-sm font-semibold ${isPos ? "value-positive" : "value-negative"}`}>{isPos ? "+" : ""}{formatCurrency(s.impactValue)}</span>
                    </div>
                    {s.portfolioImpact < 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-border/40">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> Est. Recovery</span>
                        <span className="text-xs font-semibold">{s.recoveryMonths} months</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="section-label mb-3">Preset Scenarios</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="grid-scenarios">
        {scenarioSimulations.map((scenario) => {
          const isPositive = scenario.portfolioImpact > 0;
          return (
            <div
              key={scenario.id}
              className="metric-card hover:shadow-md transition-shadow cursor-pointer"
              data-testid={`card-scenario-${scenario.id}`}
              onClick={() => open("scenario-crash")}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <FlaskConical size={16} style={{ color: categoryColors[scenario.category]?.color || "rgba(130,160,200,0.6)" }} />
                </div>
                {(() => {
                  const c = categoryColors[scenario.category];
                  return (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={c ? { background: c.bg, color: c.color, border: `1px solid ${c.border}` } : {}}>
                      {scenario.category}
                    </span>
                  );
                })()}
              </div>
              <h3 className="font-bold text-sm mb-1">{scenario.name}</h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{scenario.description}</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Portfolio Impact</span>
                  <span className={`text-sm font-bold ${isPositive ? "value-positive" : "value-negative"}`}>
                    {isPositive ? "+" : ""}{scenario.portfolioImpact}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Value Change</span>
                  <span className={`text-sm font-semibold ${isPositive ? "value-positive" : "value-negative"}`}>
                    {isPositive ? "+" : ""}{formatCurrency(scenario.impactValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Liquidity Risk</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${liquidityColors[scenario.liquidityRisk] || ""}`}>
                    {scenario.liquidityRisk}
                  </span>
                </div>
                {scenario.recoveryMonths > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/40">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> Recovery Time</span>
                    <span className="text-xs font-semibold">{scenario.recoveryMonths} months</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
