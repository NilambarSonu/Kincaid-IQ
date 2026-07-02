import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { formatCurrency } from "@/lib/mockData";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Info } from "lucide-react";

const TAX_BRACKETS = [
  { min: 0, max: 731_200, rate: 37 },
];

export default function RothAnalyzer() {
  const [iraBalance, setIraBalance] = useState(4_800_000);
  const [conversionAmount, setConversionAmount] = useState(500_000);
  const [currentAge, setCurrentAge] = useState(51);
  const [retirementAge, setRetirementAge] = useState(65);
  const [taxRate, setTaxRate] = useState(37);
  const [retirementRate, setRetirementRate] = useState(32);
  const [growthRate, setGrowthRate] = useState(8.0);

  const years = retirementAge - currentAge;

  const scenarios = useMemo(() => {
    const amounts = [0, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000];
    return amounts.map((amt) => {
      const taxCost = amt * (taxRate / 100);
      const rothAtRetirement = amt * Math.pow(1 + growthRate / 100, years);
      const taxSavedAtRetirement = rothAtRetirement * (retirementRate / 100);
      const netBenefit = taxSavedAtRetirement - taxCost * Math.pow(1 + growthRate / 100, years);
      return { amount: amt, taxCost, rothAtRetirement, taxSavedAtRetirement, netBenefit };
    });
  }, [taxRate, retirementRate, growthRate, years]);

  const selected = scenarios.find(s => s.amount === conversionAmount) || scenarios[2];

  const projectionData = useMemo(() => {
    return Array.from({ length: years + 1 }, (_, i) => {
      const age = currentAge + i;
      const noConversion = iraBalance * Math.pow(1 + growthRate / 100, i);
      const withConversion = (iraBalance - conversionAmount) * Math.pow(1 + growthRate / 100, i);
      const rothValue = conversionAmount * Math.pow(1 + growthRate / 100, i);
      return { age, "Traditional IRA (No Conversion)": Math.round(noConversion / 1e6 * 100) / 100, "Post-Conversion IRA": Math.round(withConversion / 1e6 * 100) / 100, "Roth IRA": Math.round(rothValue / 1e6 * 100) / 100 };
    });
  }, [iraBalance, conversionAmount, growthRate, currentAge, years]);

  const breakeven = useMemo(() => {
    for (let yr = 1; yr <= 30; yr++) {
      const rothGrowth = conversionAmount * Math.pow(1 + growthRate / 100, yr);
      const traditionalGrowth = conversionAmount * Math.pow(1 + growthRate / 100, yr) * (1 - retirementRate / 100);
      const taxCost = conversionAmount * (taxRate / 100) * Math.pow(1 + growthRate / 100, yr);
      if (rothGrowth - taxCost > traditionalGrowth) return yr;
    }
    return null;
  }, [conversionAmount, growthRate, taxRate, retirementRate]);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Planning</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Roth Conversion Analyzer
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Year-by-year conversion optimizer — tax cost vs long-term Roth benefit at varying conversion amounts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="metric-card space-y-4" data-testid="card-roth-inputs">
          <p className="section-label">Parameters</p>
          {[
            { label: "Current IRA Balance", value: iraBalance, setter: setIraBalance, min: 0, max: 20_000_000, step: 100_000, fmt: formatCurrency },
            { label: "Conversion Amount (FY 2026)", value: conversionAmount, setter: setConversionAmount, min: 0, max: 2_000_000, step: 50_000, fmt: formatCurrency },
            { label: "Current Age", value: currentAge, setter: setCurrentAge, min: 40, max: 75, step: 1, fmt: (v: number) => `${v}` },
            { label: "Retirement Age", value: retirementAge, setter: setRetirementAge, min: 55, max: 80, step: 1, fmt: (v: number) => `${v}` },
            { label: "Current Tax Rate (%)", value: taxRate, setter: setTaxRate, min: 20, max: 45, step: 1, fmt: (v: number) => `${v}%` },
            { label: "Retirement Tax Rate (%)", value: retirementRate, setter: setRetirementRate, min: 15, max: 45, step: 1, fmt: (v: number) => `${v}%` },
            { label: "Annual Growth Rate (%)", value: growthRate, setter: setGrowthRate, min: 3, max: 15, step: 0.5, fmt: (v: number) => `${v}%` },
          ].map((p) => (
            <div key={p.label}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] text-muted-foreground">{p.label}</label>
                <span className="text-xs font-bold text-white">{p.fmt(p.value)}</span>
              </div>
              <input type="range" min={p.min} max={p.max} step={p.step} value={p.value}
                onChange={(e) => p.setter(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, rgba(0,168,255,0.6) ${((p.value - p.min)/(p.max - p.min))*100}%, rgba(255,255,255,0.1) ${((p.value - p.min)/(p.max - p.min))*100}%)` }}
                data-testid={`slider-${p.label.toLowerCase().replace(/\s+/g,"-").replace(/[()%]/g,"")}`}
              />
            </div>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Tax Cost Now", value: formatCurrency(selected.taxCost), color: "#FF4D6D", sub: `${taxRate}% rate on ${formatCurrency(conversionAmount)}` },
              { label: "Roth at Retirement", value: formatCurrency(selected.rothAtRetirement), color: "#00FF94", sub: `${years} yrs @ ${growthRate}% growth` },
              { label: "Tax Saved at Retire.", value: formatCurrency(selected.taxSavedAtRetirement), color: "#00A8FF", sub: `${retirementRate}% rate on Roth value` },
              { label: "Breakeven", value: breakeven ? `${breakeven} yrs` : ">30 yrs", color: "#FFB800", sub: breakeven ? `Age ${currentAge + breakeven}` : "Long payback period" },
            ].map((c) => (
              <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
                data-testid={`card-roth-${c.label.toLowerCase().replace(/\s+/g,"-").replace(/\./g,"")}`}>
                <p className="section-label mb-1">{c.label}</p>
                <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="metric-card" data-testid="card-roth-projection">
            <p className="section-label mb-4">IRA Balance Projection to Retirement (Age {retirementAge})</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={projectionData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  {[["tradGrad","#00A8FF"], ["postGrad","#FFB800"], ["rothGrad","#00FF94"]].map(([id, color]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="age" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} label={{ value: "Age", position: "insideBottom", fill: "rgba(130,150,200,0.4)", fontSize: 9 }} />
                <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}M`} width={40} />
                <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}M`, ""]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,140,255,0.2)", background: "rgba(8,10,40,0.95)", fontSize: 12 }} />
                <Area type="monotone" dataKey="Traditional IRA (No Conversion)" stroke="#00A8FF" strokeWidth={2} fill="url(#tradGrad)" strokeDasharray="5 3"  isAnimationActive={false} />
                <Area type="monotone" dataKey="Post-Conversion IRA" stroke="#FFB800" strokeWidth={2} fill="url(#postGrad)"  isAnimationActive={false} />
                <Area type="monotone" dataKey="Roth IRA" stroke="#00FF94" strokeWidth={2} fill="url(#rothGrad)"  isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-2 justify-center">
              {[["#00A8FF","Trad. IRA (no conversion)"], ["#FFB800","IRA after conversion"], ["#00FF94","Roth IRA balance"]].map(([c, l]) => (
                <div key={l} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-3 h-0.5 rounded" style={{ background: c }} />{l}
                </div>
              ))}
            </div>
          </div>

          <div className="metric-card" data-testid="card-roth-scenarios">
            <p className="section-label mb-3">Conversion Amount Scenarios</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Amount", "Tax Cost", "Roth at Retire.", "Tax Saved", "Net Benefit"].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 text-muted-foreground font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => {
                    const isSelected = s.amount === conversionAmount;
                    return (
                      <tr key={s.amount}
                        onClick={() => setConversionAmount(s.amount)}
                        className="cursor-pointer hover:bg-white/5 transition-colors"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: isSelected ? "rgba(0,168,255,0.05)" : undefined }}
                        data-testid={`row-scenario-${s.amount}`}>
                        <td className="py-2 pr-4 font-bold" style={{ color: isSelected ? "#00A8FF" : "white" }}>{s.amount === 0 ? "No conversion" : formatCurrency(s.amount)}</td>
                        <td className="py-2 pr-4" style={{ color: "#FF4D6D" }}>{formatCurrency(s.taxCost)}</td>
                        <td className="py-2 pr-4" style={{ color: "#00FF94" }}>{formatCurrency(s.rothAtRetirement)}</td>
                        <td className="py-2 pr-4" style={{ color: "#00A8FF" }}>{formatCurrency(s.taxSavedAtRetirement)}</td>
                        <td className="py-2 pr-4 font-bold" style={{ color: s.netBenefit > 0 ? "#00FF94" : "#FF4D6D" }}>{s.netBenefit > 0 ? "+" : ""}{formatCurrency(s.netBenefit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
