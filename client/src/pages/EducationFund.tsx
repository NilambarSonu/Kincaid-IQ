import { Layout } from "@/components/Layout";
import { educationData, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { GraduationCap, TrendingUp, BookOpen, Calendar } from "lucide-react";

export default function EducationFund() {
  const totalBalances = educationData.children.reduce((s, c) => s + c.plan529.balance, 0);
  const totalRemainingCosts = educationData.children.reduce((s, c) => s + c.totalCostRemaining + (c.gradSchoolPlan.planned ? c.gradSchoolPlan.estimatedCost : 0), 0);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Planning</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Education Funding
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">529 balances, tuition projections, gifting strategy — Mason & Olivia Shrack</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total 529 Assets", value: formatCurrency(totalBalances), color: "#00A8FF", sub: "Combined — Mason + Olivia" },
          { label: "Remaining Education Cost", value: formatCurrency(totalRemainingCosts), color: "#FFB800", sub: "Undergrad + grad school" },
          { label: "Total Gifted to Date", value: formatCurrency(educationData.giftingStrategy.totalGiftedToDate), color: "#00FF94", sub: "Since 529 inception" },
          { label: "Surplus / Buffer", value: formatCurrency(totalBalances - totalRemainingCosts), color: totalBalances > totalRemainingCosts ? "#00FF94" : "#FF4D6D", sub: "529 vs projected costs" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-edu-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {educationData.children.map((child) => {
          const totalCostIncGrad = child.totalCostRemaining + (child.gradSchoolPlan.planned ? child.gradSchoolPlan.estimatedCost : 0);
          const surplus = child.plan529.balance - totalCostIncGrad;
          const growthGain = child.plan529.balance - child.plan529.originalContributions;
          return (
            <div key={child.id} className="metric-card" style={{ borderTop: `2px solid ${child.color}` }}
              data-testid={`card-child-${child.id}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: `${child.color}12`, border: `1px solid ${child.color}25`, color: child.color }}>
                  {child.avatar}
                </div>
                <div>
                  <p className="font-bold text-white">{child.name}</p>
                  <p className="text-xs text-muted-foreground">{child.school} · {child.major}</p>
                  <p className="text-[10px] text-muted-foreground">Age {child.age} · Class of {child.gradYear} · {child.yearsRemaining} yr{child.yearsRemaining !== 1 ? "s" : ""} remaining</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl" style={{ background: `${child.color}08`, border: `1px solid ${child.color}15` }}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">529 Balance</p>
                  <p className="text-lg font-bold" style={{ color: child.color, fontFamily: "var(--font-display)" }}>{formatCurrency(child.plan529.balance)}</p>
                  <p className="text-[10px] text-muted-foreground">{child.plan529.institution}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Investment Growth</p>
                  <p className="text-lg font-bold" style={{ color: "#00FF94", fontFamily: "var(--font-display)" }}>+{formatCurrency(growthGain)}</p>
                  <p className="text-[10px] text-muted-foreground">YTD: +{child.plan529.ytdGrowth}%</p>
                </div>
              </div>

              <div className="space-y-1.5 mb-4">
                <p className="section-label mb-2">Annual Cost Breakdown</p>
                {Object.entries(child.annualCost).filter(([k]) => k !== "total").map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                    <span className="font-semibold text-white">{formatCurrency(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-white">Annual Total</span>
                  <span style={{ color: child.color }}>{formatCurrency(child.annualCost.total)}</span>
                </div>
              </div>

              {child.gradSchoolPlan.planned && (
                <div className="p-3 rounded-xl mb-3" style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <GraduationCap size={11} style={{ color: "#FFB800" }} />
                    <p className="text-xs font-semibold" style={{ color: "#FFB800" }}>Graduate School Planned</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{child.gradSchoolPlan.school}</p>
                  <p className="text-xs text-muted-foreground">{child.gradSchoolPlan.years} years · Start {child.gradSchoolPlan.startYear} · Est. {formatCurrency(child.gradSchoolPlan.estimatedCost)}</p>
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">529 vs Total Need</span>
                <span className="font-bold" style={{ color: surplus > 0 ? "#00FF94" : "#FF4D6D" }}>
                  {surplus > 0 ? "+" : ""}{formatCurrency(surplus)} surplus
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="metric-card" data-testid="card-edu-contributions">
          <p className="section-label mb-4">Annual 529 Contributions History</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={educationData.historicalContributions} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="year" tick={{ fill: "rgba(130,150,200,0.5)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(130,150,200,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} width={34} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), ""]} contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,140,255,0.2)", background: "rgba(8,10,40,0.95)", fontSize: 12 }} />
              <Bar dataKey="mason" fill="#00FF94" fillOpacity={0.7} radius={[3,3,0,0]} name="Mason"  isAnimationActive={false} />
              <Bar dataKey="olivia" fill="#A855F7" fillOpacity={0.7} radius={[3,3,0,0]} name="Olivia"  isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="metric-card" data-testid="card-edu-gifting">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={14} style={{ color: "#00FF94" }} />
            <p className="section-label">Gifting Strategy</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Annual Gift Exclusion (per child)</span>
              <span className="font-bold text-white">{formatCurrency(educationData.giftingStrategy.annualExclusion)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">YTD 2026 Gifts</span>
              <span className="font-bold" style={{ color: "#00FF94" }}>{formatCurrency(educationData.giftingStrategy.ytdGifts)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Gifted (All Time)</span>
              <span className="font-bold text-white">{formatCurrency(educationData.giftingStrategy.totalGiftedToDate)}</span>
            </div>
            {educationData.giftingStrategy.superfunding.available && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: "rgba(0,255,148,0.05)", border: "1px solid rgba(0,255,148,0.15)" }}>
                <p className="text-xs font-bold" style={{ color: "#00FF94" }}>Superfunding Available</p>
                <p className="text-xs text-muted-foreground mt-0.5">{educationData.giftingStrategy.superfunding.description}</p>
                <p className="text-xs font-semibold mt-1" style={{ color: "#00FF94" }}>Max: {formatCurrency(educationData.giftingStrategy.superfunding.maxAmount)} per child, per parent</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
