import { useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { formatCurrency, formatPct, portfolioStats, privateInvestments } from "@/lib/mockData";
import { FileDown, Loader2, BarChart2, TrendingUp, PieChart as PieIcon, CheckCircle } from "lucide-react";

const SECTIONS = [
  { id: "cover", label: "Cover Page", checked: true },
  { id: "summary", label: "Net Worth Summary", checked: true },
  { id: "allocation", label: "Asset Allocation", checked: true },
  { id: "performance", label: "YTD Performance", checked: true },
  { id: "private", label: "Private Investments", checked: true },
  { id: "tax", label: "Tax Highlights", checked: true },
  { id: "notes", label: "Advisor Commentary", checked: true },
];

export default function QuarterlyReport() {
  const [sections, setSections] = useState(SECTIONS.map(s => ({ ...s })));
  const [quarter, setQuarter] = useState("Q1 2026");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerated(false);
    await new Promise(r => setTimeout(r, 1200));
    setGenerating(false);
    setGenerated(true);

    const content = buildReportHTML(quarter, sections.filter(s => s.checked).map(s => s.id));

    const printWin = window.open("", "_blank", "width=900,height=1200");
    if (printWin) {
      printWin.document.write(content);
      printWin.document.close();
      setTimeout(() => { printWin.focus(); printWin.print(); }, 500);
    }
  };

  const allocationData = [
    { name: "Public Equities", value: 580, pct: 24.1, color: "#00A8FF" },
    { name: "Private Equity", value: 420, pct: 17.4, color: "#A855F7" },
    { name: "Venture Capital", value: 290, pct: 12.0, color: "#FF8C00" },
    { name: "Real Estate", value: 480, pct: 19.9, color: "#FFB800" },
    { name: "Private Credit", value: 130, pct: 5.4, color: "#00FF94" },
    { name: "Hedge Funds", value: 220, pct: 9.1, color: "#FF4D6D" },
    { name: "Cash & T-Bills", value: 290, pct: 12.0, color: "#00E5FF" },
  ];

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Reporting</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Quarterly Report Generator
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">One-click PDF — cover page, net worth summary, allocation, performance, and advisor commentary</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="metric-card" data-testid="card-report-config">
            <p className="section-label mb-4">Report Configuration</p>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground block mb-1">Reporting Period</label>
              <select value={quarter} onChange={e => setQuarter(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="select-quarter">
                {["Q1 2026", "Q4 2025", "Q3 2025", "Q2 2025", "Q1 2025"].map(q => <option key={q} value={q} style={{ background: "#0a0a1a" }}>{q}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Include Sections</p>
            <div className="space-y-2">
              {sections.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 cursor-pointer text-sm"
                  data-testid={`toggle-${s.id}`}>
                  <div onClick={() => toggleSection(s.id)}
                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: s.checked ? "rgba(0,168,255,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${s.checked ? "rgba(0,168,255,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                    {s.checked && <CheckCircle size={10} style={{ color: "#00A8FF" }} />}
                  </div>
                  <span style={{ color: s.checked ? "white" : "rgba(150,170,210,0.5)" }}>{s.label}</span>
                </label>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || sections.filter(s => s.checked).length === 0}
              className="w-full mt-5 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={{
                background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF",
                cursor: generating ? "not-allowed" : "pointer",
              }}
              data-testid="button-generate-report"
            >
              {generating ? <><Loader2 size={13} className="animate-spin" /> Generating PDF…</> : <><FileDown size={13} /> Generate & Download PDF</>}
            </button>

            {generated && (
              <div className="flex items-center gap-2 text-xs mt-3" style={{ color: "#00FF94" }}>
                <CheckCircle size={11} /> Report opened in print dialog
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4" data-testid="card-report-preview">
          <div className="metric-card" style={{ border: "1px solid rgba(0,168,255,0.1)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-white">Report Preview — {quarter}</p>
              <span className="text-[10px] text-muted-foreground">{sections.filter(s => s.checked).length} sections selected</span>
            </div>

            <div className="space-y-4">
              {sections.filter(s => s.checked).map((section) => (
                <div key={section.id} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-xs font-semibold text-white mb-2">{section.label}</p>
                  {section.id === "summary" && (
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      {[["Net Worth", "$2.41B", "#00A8FF"], ["YTD Return", "+14.7%", "#00FF94"], ["vs S&P 500", "+3.5%", "#FFB800"]].map(([l, v, c]) => (
                        <div key={l}><p className="text-muted-foreground">{l}</p><p className="font-bold" style={{ color: c }}>{v}</p></div>
                      ))}
                    </div>
                  )}
                  {section.id === "allocation" && (
                    <div className="flex flex-wrap gap-1.5">
                      {allocationData.map(a => <span key={a.name} className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${a.color}12`, color: a.color, border: `1px solid ${a.color}22` }}>{a.name} {a.pct}%</span>)}
                    </div>
                  )}
                  {section.id === "performance" && (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[["Portfolio", "+14.7%", "#00FF94"], ["S&P 500", "+11.2%", "#00A8FF"], ["60/40", "+7.8%", "#FFB800"], ["Alpha", "+3.5%", "#A855F7"]].map(([l, v, c]) => (
                        <div key={l}><p className="text-muted-foreground">{l}</p><p className="font-bold" style={{ color: c }}>{v}</p></div>
                      ))}
                    </div>
                  )}
                  {section.id === "notes" && <p className="text-xs text-muted-foreground">Advisor commentary will be populated by Sarah Chen and Michael Torres — Kincaid RMC.</p>}
                  {!["summary", "allocation", "performance", "notes"].includes(section.id) && <p className="text-xs text-muted-foreground">Section data will be included in generated PDF.</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function buildReportHTML(quarter: string, sections: string[]): string {
  return `<!DOCTYPE html>
<html>
<head>
<title>Kincaid RMC — ${quarter} Report — Jeremiah Shrack</title>
<style>
  body { font-family: 'Georgia', serif; margin: 0; padding: 40px; background: #fff; color: #111; }
  h1 { font-size: 28px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 24px 0 8px; border-bottom: 2px solid #1a1a4e; padding-bottom: 6px; color: #1a1a4e; }
  .header { background: #0a0a2e; color: white; padding: 32px; margin: -40px -40px 32px; }
  .header h1 { color: #FFB800; } .header p { color: rgba(255,255,255,0.6); font-size: 13px; margin: 4px 0; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
  .metric { background: #f8f9ff; border: 1px solid #e8eaf0; border-radius: 8px; padding: 12px; }
  .metric .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
  .metric .value { font-size: 22px; font-weight: bold; color: #1a1a4e; margin: 4px 0 2px; }
  .metric .sub { font-size: 11px; color: #888; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
  th { background: #f0f1f8; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  td { padding: 8px; border-bottom: 1px solid #f0f1f8; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e8eaf0; font-size: 10px; color: #aaa; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <p style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin:0 0 8px">Kincaid RMC · Confidential</p>
  <h1>Portfolio Review — ${quarter}</h1>
  <p>Jeremiah Shrack · Carmel, Indiana · Prepared ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
</div>

${sections.includes("summary") ? `<h2>Net Worth Summary</h2>
<div class="grid">
  <div class="metric"><div class="label">Total Net Worth</div><div class="value">$2.41B</div><div class="sub">As of ${quarter} end</div></div>
  <div class="metric"><div class="label">YTD Return</div><div class="value" style="color:#2a9d5c">+14.7%</div><div class="sub">vs S&P 500 +11.2%</div></div>
  <div class="metric"><div class="label">YTD Income</div><div class="value">$18.4M</div><div class="sub">Dividends + rent + interest</div></div>
  <div class="metric"><div class="label">Unrealized Gains</div><div class="value">$284M</div><div class="sub">Taxable accounts</div></div>
</div>` : ""}

${sections.includes("allocation") ? `<h2>Asset Allocation</h2>
<table><tr><th>Asset Class</th><th>Market Value</th><th>Allocation %</th></tr>
<tr><td>Public Equities</td><td>$580M</td><td>24.1%</td></tr>
<tr><td>Private Equity</td><td>$420M</td><td>17.4%</td></tr>
<tr><td>Real Estate</td><td>$480M</td><td>19.9%</td></tr>
<tr><td>Venture Capital</td><td>$290M</td><td>12.0%</td></tr>
<tr><td>Hedge Funds</td><td>$220M</td><td>9.1%</td></tr>
<tr><td>Private Credit</td><td>$130M</td><td>5.4%</td></tr>
<tr><td>Cash & T-Bills</td><td>$290M</td><td>12.0%</td></tr>
<tr style="font-weight:bold;background:#f8f9ff"><td>Total</td><td>$2,410M</td><td>100%</td></tr></table>` : ""}

${sections.includes("performance") ? `<h2>YTD Performance</h2>
<table><tr><th>Benchmark</th><th>YTD Return</th><th>vs Portfolio</th></tr>
<tr><td>Jeremiah Shrack Portfolio</td><td style="color:#2a9d5c;font-weight:bold">+14.7%</td><td>—</td></tr>
<tr><td>S&P 500</td><td>+11.2%</td><td style="color:#2a9d5c">+3.5% alpha</td></tr>
<tr><td>60/40 Portfolio</td><td>+7.8%</td><td style="color:#2a9d5c">+6.9% alpha</td></tr>
<tr><td>Yale Endowment Model</td><td>+9.4%</td><td style="color:#2a9d5c">+5.3% alpha</td></tr></table>` : ""}

${sections.includes("private") ? `<h2>Private Investments</h2>
<table><tr><th>Fund</th><th>Type</th><th>Vintage</th><th>NAV</th><th>TVPI</th><th>IRR</th></tr>
<tr><td>KKR Americas XII</td><td>Buyout</td><td>2021</td><td>$187M</td><td>1.68x</td><td>24.2%</td></tr>
<tr><td>Blackstone RE IX</td><td>Real Estate</td><td>2020</td><td>$154M</td><td>1.90x</td><td>18.7%</td></tr>
<tr><td>Sequoia Capital XVIII</td><td>Venture</td><td>2021</td><td>$142M</td><td>3.08x</td><td>44.8%</td></tr>
<tr><td>Apollo Buyout VIII</td><td>Buyout</td><td>2022</td><td>$89M</td><td>1.44x</td><td>31.2%</td></tr>
<tr><td>Apollo Global Credit</td><td>Private Credit</td><td>2022</td><td>$88M</td><td>1.81x</td><td>14.2%</td></tr></table>` : ""}

${sections.includes("tax") ? `<h2>Tax Highlights — FY 2025</h2>
<div class="grid">
  <div class="metric"><div class="label">Adjusted Gross Income</div><div class="value">$42.8M</div></div>
  <div class="metric"><div class="label">Federal Tax</div><div class="value">$15.5M</div><div class="sub">36.2% effective</div></div>
  <div class="metric"><div class="label">Est. Payments Made</div><div class="value">$14.2M</div></div>
  <div class="metric"><div class="label">Balance Due Apr 15</div><div class="value" style="color:#c0392b">$3.5M</div></div>
</div>` : ""}

${sections.includes("notes") ? `<h2>Advisor Commentary</h2>
<p style="font-size:13px;line-height:1.6;color:#444">Your portfolio delivered strong outperformance in ${quarter}, with +14.7% vs S&P 500's +11.2%. Private markets continue to drive alpha — Sequoia Capital XVIII reached 3.08x TVPI. Key focus areas for Q2: GRAT annuity payment optimization, Carlyle Europe V capital call timing, and Q1 estimated tax payment coordination with Deloitte. The Whitmore Dynasty Trust remains fully funded and on track for the 2026 GRAT zero-out event.</p>
<p style="font-size:11px;color:#888;margin-top:8px">— Sarah Chen, Lead Wealth Advisor &nbsp;·&nbsp; Michael Torres, Tax & Structuring &nbsp;·&nbsp; Kincaid RMC</p>` : ""}

<div class="footer">
  <p>This report is prepared exclusively for Jeremiah Shrack and is strictly confidential. Kincaid RMC | Carmel, Indiana | ${new Date().getFullYear()}</p>
  <p>Past performance is not indicative of future results. This document does not constitute investment advice.</p>
</div>
</body></html>`;
}
