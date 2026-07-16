import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { Landmark, Calculator, TrendingUp, AlertTriangle, ShieldCheck, DollarSign } from "lucide-react";
import { creditData } from "@/lib/mockData";

const yieldCurveData = [
  { name: "3M", rate: 5.38 },
  { name: "6M", rate: 5.18 },
  { name: "1Y", rate: 4.92 },
  { name: "2Y", rate: 4.71 },
  { name: "3Y", rate: 4.52 },
  { name: "5Y", rate: 4.32 },
  { name: "7Y", rate: 4.30 },
  { name: "10Y", rate: 4.28 },
  { name: "20Y", rate: 4.38 },
  { name: "30Y", rate: 4.41 },
];

const spread2s10s = 4.28 - 4.71;
const isInverted = spread2s10s < 0;

const benchmarkBonds = [
  { name: "2Y UST",  coupon: 4.75, maturity: "Mar 2026", price: 99.84, ytm: 4.71, dur: 1.9,  rating: "AAA" },
  { name: "5Y UST",  coupon: 4.25, maturity: "Mar 2029", price: 98.62, ytm: 4.32, dur: 4.6,  rating: "AAA" },
  { name: "10Y UST", coupon: 4.00, maturity: "Feb 2034", price: 96.84, ytm: 4.28, dur: 8.4,  rating: "AAA" },
  { name: "30Y UST", coupon: 4.25, maturity: "Feb 2054", price: 96.12, ytm: 4.41, dur: 18.2, rating: "AAA" },
  { name: "AAPL 3Y", coupon: 4.90, maturity: "Sep 2026", price: 100.24, ytm: 4.84, dur: 2.8,  rating: "AA+" },
  { name: "MSFT 5Y", coupon: 4.45, maturity: "Aug 2028", price: 99.18, ytm: 4.62, dur: 4.4,  rating: "AAA" },
  { name: "JPM 7Y",  coupon: 5.10, maturity: "Mar 2031", price: 101.24, ytm: 4.94, dur: 5.9, rating: "A+" },
];

export default function FixedIncome() {
  const [faceValue, setFaceValue] = useState(1000);
  const [couponRate, setCouponRate] = useState(5);
  const [yearsToMaturity, setYearsToMaturity] = useState(10);
  const [creditSpread, setCreditSpread] = useState(120);

  const bondMetrics = useMemo(() => {
    const r = (4.28 + creditSpread / 100) / 100;
    const c = (couponRate / 100) * faceValue;
    const n = yearsToMaturity;
    const cleanPrice = c * (1 - Math.pow(1 + r, -n)) / r + faceValue / Math.pow(1 + r, n);
    const modDuration = n - (n * (couponRate / 100) * faceValue) / (cleanPrice * r * (Math.pow(1 + r, n) - 1) + cleanPrice * r);
    const macDuration = modDuration * (1 + r);
    const convexity = +(macDuration * (macDuration + 1) / Math.pow(1 + r, 2)).toFixed(1);
    const dv01 = +(cleanPrice * modDuration / 10000).toFixed(4);
    const ytm = r * 100;
    return {
      cleanPrice: +cleanPrice.toFixed(2),
      dirtyPrice: +cleanPrice.toFixed(2),
      ytm: +ytm.toFixed(2),
      duration: +macDuration.toFixed(1),
      modDuration: +modDuration.toFixed(1),
      convexity,
      dv01,
    };
  }, [faceValue, couponRate, yearsToMaturity, creditSpread]);

  const { igHistory, hyHistory } = creditData;
  const spreadData = igHistory.slice(-12).map((ig, i) => {
    const d = new Date(ig.t);
    return {
      month: `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear().toString().slice(2)}`,
      ig: ig.value,
      hy: hyHistory[hyHistory.length - 12 + i]?.value ?? 0,
    };
  });

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Macro & Research</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Fixed Income Analytics
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bloomberg FI replacement — yield curve, bond pricer, spread analysis</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Fed Funds Rate", value: "5.25–5.50%", color: "#FFB800", sub: "Target range" },
          { label: "10Y UST",        value: "4.28%",       color: "#00A8FF", sub: "Benchmark" },
          { label: "2s10s Spread",   value: `${spread2s10s.toFixed(0)} bps`, color: isInverted ? "#FF4D6D" : "#00FF94", sub: isInverted ? "Inverted" : "Normal" },
          { label: "IG OAS",         value: `${creditData.current.igOas} bps`, color: "#00FF94", sub: "Investment Grade" },
        ].map((m) => (
          <div key={m.label} className="metric-card p-4" data-testid={`card-fi-${m.label.replace(/\s+/g, "-").toLowerCase()}`}>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">{m.label}</p>
            <p className="text-xl font-bold font-mono" style={{ color: m.color }}>{m.value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card p-5" data-testid="card-yield-curve">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark size={16} className="text-primary" />
              <p className="section-label">US Treasury Yield Curve</p>
            </div>
            {isInverted && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-bold">
                <AlertTriangle size={12} /> INVERTED
              </div>
            )}
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yieldCurveData}>
                <defs>
                  <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A8FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00A8FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[4, 5.8]} />
                <Tooltip contentStyle={{ background: "rgba(8,10,28,0.95)", border: "1px solid #e2e8f0", borderRadius: "12px" }} formatter={(v: number) => [`${v.toFixed(2)}%`, "Yield"]} />
                <Area type="monotone" dataKey="rate" stroke="#00A8FF" strokeWidth={2.5} fill="url(#yieldGrad)" name="Yield"  isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-[var(--kiq-surface)]/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">2s10s Spread</p>
              <p className={`text-xl font-bold font-mono ${isInverted ? "text-destructive" : "text-[#00FF94]"}`}>
                {spread2s10s.toFixed(0)} bps
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground max-w-[200px] text-right">
              {isInverted ? "Yield curve inversion — historical 12–18M recession indicator." : "Normal slope — supportive credit conditions."}
            </p>
          </div>
        </div>

        <div className="metric-card p-5" data-testid="card-bond-pricer">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={16} className="text-primary" />
            <p className="section-label">Bond Pricer</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Face Value ($)",      value: faceValue,       setter: setFaceValue,       min: 100, max: 10000, step: 100, testId: "input-face-value" },
              { label: "Coupon Rate (%)",     value: couponRate,      setter: setCouponRate,      min: 0,   max: 20,    step: 0.1, testId: "input-coupon-rate" },
              { label: "Years to Maturity",   value: yearsToMaturity, setter: setYearsToMaturity, min: 1,   max: 50,    step: 1,   testId: "input-years-maturity" },
              { label: "Credit Spread (bps)", value: creditSpread,    setter: setCreditSpread,    min: 0,   max: 1000,  step: 5,   testId: "input-credit-spread" },
            ].map((inp) => (
              <div key={inp.label}>
                <label className="text-[10px] text-muted-foreground uppercase mb-1 block tracking-wide">{inp.label}</label>
                <input
                  type="number"
                  value={inp.value}
                  onChange={(e) => inp.setter(Number(e.target.value))}
                  min={inp.min} max={inp.max} step={inp.step}
                  className="w-full bg-[var(--kiq-surface)]/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-[var(--kiq-ink)] focus:outline-none focus:ring-1 focus:ring-primary/40"
                  data-testid={inp.testId}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Clean Price",    value: `$${bondMetrics.cleanPrice.toFixed(2)}`,  testId: "text-clean-price", color: "#00A8FF" },
              { label: "Dirty Price",    value: `$${bondMetrics.dirtyPrice.toFixed(2)}`,  color: "#00A8FF" },
              { label: "YTM",            value: `${bondMetrics.ytm.toFixed(2)}%`,         testId: "text-ytm",        color: "#FFB800" },
              { label: "Mac. Duration",  value: `${bondMetrics.duration} yrs`,             testId: "text-duration",   color: "#00FF94" },
              { label: "Mod. Duration",  value: `${bondMetrics.modDuration} yrs`,          color: "#00FF94" },
              { label: "DV01",           value: `$${bondMetrics.dv01.toFixed(3)}`,         color: "#A855F7" },
            ].map((m) => (
              <div key={m.label} className="p-2.5 rounded-lg bg-[var(--kiq-surface)]/5 border border-white/5">
                <p className="text-[9px] text-muted-foreground uppercase mb-0.5 tracking-wide">{m.label}</p>
                <p className="text-sm font-bold font-mono" style={{ color: m.color }} data-testid={m.testId}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="metric-card p-5 mb-6" data-testid="card-spread-analysis">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={16} className="text-primary" />
          <p className="section-label">Credit Spread History — IG vs HY OAS (bps)</p>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spreadData}>
              <defs>
                <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A8FF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00A8FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="hyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF4D6D" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FF4D6D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "rgba(8,10,28,0.95)", border: "1px solid #e2e8f0", borderRadius: "12px" }} />
              <Area type="monotone" dataKey="ig" name="IG OAS" stroke="#00A8FF" fill="url(#igGrad)" strokeWidth={2}  isAnimationActive={false} />
              <Area type="monotone" dataKey="hy" name="HY OAS" stroke="#FF4D6D" fill="url(#hyGrad)" strokeWidth={2}  isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="metric-card p-5" data-testid="card-benchmark-bonds">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={16} className="text-primary" />
          <p className="section-label">Benchmark Bond Monitor</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-muted-foreground uppercase tracking-wider border-b border-white/10 text-[10px]">
                <th className="pb-3 pr-4 font-semibold">Bond</th>
                <th className="pb-3 pr-4 font-semibold text-right">Coupon</th>
                <th className="pb-3 pr-4 font-semibold text-right">Price</th>
                <th className="pb-3 pr-4 font-semibold text-right">YTM</th>
                <th className="pb-3 pr-4 font-semibold text-right">Duration</th>
                <th className="pb-3 font-semibold text-center">Rating</th>
              </tr>
            </thead>
            <tbody>
              {benchmarkBonds.map((b) => (
                <tr key={b.name} className="border-b border-white/5 hover:bg-[var(--kiq-surface)]/5 transition-colors">
                  <td className="py-2.5 pr-4">
                    <p className="font-bold text-[var(--kiq-ink)]">{b.name}</p>
                    <p className="text-[9px] text-muted-foreground">{b.maturity}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono">{b.coupon.toFixed(2)}%</td>
                  <td className="py-2.5 pr-4 text-right font-mono">${b.price.toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-[#00A8FF]">{b.ytm.toFixed(2)}%</td>
                  <td className="py-2.5 pr-4 text-right font-mono">{b.dur.toFixed(1)}y</td>
                  <td className="py-2.5 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                      {b.rating}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
