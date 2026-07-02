import { useState } from "react";
import { Layout } from "@/components/Layout";
import { taxPackageData, formatCurrency } from "@/lib/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { FileText, CheckCircle, Clock, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: any }> = {
  Received: { color: "#00FF94", bg: "rgba(0,255,148,0.08)", icon: CheckCircle },
  Pending: { color: "#FFB800", bg: "rgba(255,184,0,0.08)", icon: Clock },
};

export default function TaxPackage() {
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const totalIncome = taxPackageData.income.reduce((s, i) => s + i.amount, 0);
  const totalDeductions = taxPackageData.deductions.reduce((s, d) => s + d.amount, 0);
  const k1Received = taxPackageData.k1Status.filter(k => k.status === "Received").length;

  return (
    <Layout>
      <div className="mb-6 animate-float-up">
        <p className="section-label mb-1">Reporting</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Year-End Tax Package
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          FY {taxPackageData.taxYear} · {taxPackageData.filingStatus} · Preparer: {taxPackageData.preparer}
        </p>
      </div>

      <FileUploadZone
        uploadedDoc={uploadedDoc ?? undefined}
        onDocumentReady={setUploadedDoc}
        onClear={() => setUploadedDoc(null)}
        label="Upload Tax Documents"
        hint="Attach K-1s, brokerage statements, prior-year returns, or any tax source document (PDF, XLSX, CSV)"
        accept=".pdf,.docx,.txt,.csv,.xlsx"
        className="mb-6"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Adjusted Gross Income", value: formatCurrency(taxPackageData.agi), color: "#00A8FF", sub: `vs ${formatCurrency(taxPackageData.priorYear.agi)} prior year` },
          { label: "Federal Tax", value: formatCurrency(taxPackageData.totalTaxFederal), color: "#FF4D6D", sub: `${taxPackageData.effectiveRateFederal}% effective rate` },
          { label: "Balance Due", value: formatCurrency(taxPackageData.balanceDue), color: "#FFB800", sub: "After estimated payments" },
          { label: "K-1 Status", value: `${k1Received}/${taxPackageData.k1Status.length}`, color: k1Received === taxPackageData.k1Status.length ? "#00FF94" : "#FFB800", sub: "Returns received" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-tax-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-income-breakdown">
          <p className="section-label mb-4">Income by Source</p>
          <div className="space-y-2.5">
            {taxPackageData.income.map((item) => {
              const pct = (item.amount / totalIncome) * 100;
              return (
                <div key={item.type}>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="text-muted-foreground">{item.type}</span>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-[10px]" style={{ color: item.yoy >= 0 ? "#00FF94" : "#FF4D6D" }}>
                        {item.yoy >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {item.yoy >= 0 ? "+" : ""}{item.yoy.toFixed(1)}%
                      </span>
                      <span className="font-bold text-white">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#00A8FF", opacity: 0.6 }} />
                  </div>
                </div>
              );
            })}
            <div className="flex justify-between text-sm font-bold pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-white">Total Income</span>
              <span style={{ color: "#00A8FF" }}>{formatCurrency(totalIncome)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="metric-card" data-testid="card-tax-rates">
            <p className="section-label mb-3">Tax Rate Summary</p>
            {[
              { label: "Federal Effective Rate", value: `${taxPackageData.effectiveRateFederal}%`, color: "#FF4D6D", yoy: taxPackageData.effectiveRateFederal - taxPackageData.priorYear.effectiveRate },
              { label: "All-In Rate (Fed + State)", value: `${taxPackageData.effectiveRateAll}%`, color: "#FFB800" },
              { label: "Estimated Payments", value: formatCurrency(taxPackageData.estimatedPayments), color: "#00A8FF" },
              { label: "Balance Due Apr 15", value: formatCurrency(taxPackageData.balanceDue), color: "#FFB800" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <div className="flex items-center gap-2">
                  {r.yoy !== undefined && (
                    <span className="text-[10px]" style={{ color: r.yoy > 0 ? "#FF4D6D" : "#00FF94" }}>
                      {r.yoy > 0 ? "+" : ""}{r.yoy.toFixed(1)}pp
                    </span>
                  )}
                  <span className="text-sm font-bold" style={{ color: r.color }}>{r.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="metric-card" data-testid="card-deductions">
            <p className="section-label mb-3">Itemized Deductions</p>
            {taxPackageData.deductions.map((d) => (
              <div key={d.type} className="flex justify-between items-start py-1.5 text-xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="min-w-0">
                  <p className="text-white">{d.type}</p>
                  <p className="text-muted-foreground text-[10px]">{d.notes}</p>
                </div>
                <span className="font-bold flex-shrink-0 ml-4" style={{ color: "#00FF94" }}>{formatCurrency(d.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-2">
              <span className="text-white">Total Deductions</span>
              <span style={{ color: "#00FF94" }}>{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-k1-tracker">
        <div className="flex items-center gap-3 mb-4">
          <FileText size={14} style={{ color: "#A855F7" }} />
          <p className="section-label">K-1 Status Tracker</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ml-auto`}
            style={k1Received === taxPackageData.k1Status.length
              ? { background: "rgba(0,255,148,0.08)", color: "#00FF94", border: "1px solid rgba(0,255,148,0.2)" }
              : { background: "rgba(255,184,0,0.08)", color: "#FFB800", border: "1px solid rgba(255,184,0,0.2)" }}>
            {k1Received}/{taxPackageData.k1Status.length} Received
          </span>
        </div>
        <div className="space-y-2">
          {taxPackageData.k1Status.map((k, i) => {
            const ss = STATUS_STYLES[k.status];
            const Icon = ss.icon;
            return (
              <div key={i} className="flex items-center gap-4 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                data-testid={`row-k1-${i}`}>
                <Icon size={12} style={{ color: ss.color, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{k.fund}</p>
                  <p className="text-[10px] text-muted-foreground">{k.type}{k.date ? ` · Received ${new Date(k.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</p>
                </div>
                {k.status === "Received" && (
                  <div className="flex gap-4 text-xs text-right">
                    <div><p className="text-[9px] text-muted-foreground">Ordinary Inc.</p><p className="font-bold text-white">{formatCurrency(k.ordinaryIncome)}</p></div>
                    {k.capitalGains > 0 && <div><p className="text-[9px] text-muted-foreground">Cap. Gains</p><p className="font-bold" style={{ color: "#00FF94" }}>{formatCurrency(k.capitalGains)}</p></div>}
                  </div>
                )}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: ss.bg, color: ss.color }}>{k.status}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
