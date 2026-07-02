import { Layout } from "@/components/Layout";
import { privateInvestments, formatCurrency, formatPct } from "@/lib/mockData";
import { useDrillDown } from "@/hooks/useDrillDown";

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  Active: { bg: "rgba(0,255,148,0.08)", color: "#00FF94", border: "rgba(0,255,148,0.25)" },
  Harvesting: { bg: "rgba(255,184,0,0.08)", color: "#FFB800", border: "rgba(255,184,0,0.25)" },
  Realized: { bg: "rgba(130,150,200,0.08)", color: "rgba(160,190,230,0.7)", border: "rgba(130,150,200,0.2)" },
};

function StatusBadge({ status, onClick }: { status: string; onClick?: (e: { stopPropagation: () => void }) => void }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Realized;
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full border cursor-pointer"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
      onClick={onClick}
    >
      {status}
    </span>
  );
}

export default function PrivateInvestments() {
  const { open } = useDrillDown();
  const totalNAV = privateInvestments.reduce((s, i) => s + i.nav, 0);
  const totalCommitted = privateInvestments.reduce((s, i) => s + i.committed, 0);
  const avgIRR = privateInvestments.reduce((s, i) => s + i.irr, 0) / privateInvestments.length;

  return (
    <Layout>
      <div className="mb-8">
        <p className="section-label mb-1">Alternatives</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Private Investment Tracker
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">PE, venture, private credit, co-investments, and SPVs</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="metric-card" data-testid="card-pi-total-nav">
          <p className="section-label mb-2">Total NAV</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{formatCurrency(totalNAV)}</p>
        </div>
        <div className="metric-card" data-testid="card-pi-committed">
          <p className="section-label mb-2">Total Committed</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{formatCurrency(totalCommitted)}</p>
        </div>
        <div className="metric-card" data-testid="card-pi-avg-irr">
          <p className="section-label mb-2">Portfolio Avg IRR</p>
          <p className="text-2xl font-bold value-positive" style={{ fontFamily: "var(--font-display)" }}>{avgIRR.toFixed(1)}%</p>
        </div>
      </div>

      {/* Investments Table */}
      <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden" data-testid="table-private-investments">
        <div className="px-6 py-4 border-b border-border/40">
          <h2 className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>Active Positions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40">
                {["Fund / Investment", "Type", "Vintage", "Committed", "NAV", "IRR", "TVPI", "DPI", "Status"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {privateInvestments.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/20 last:border-0 hover:bg-white/5 transition-colors cursor-pointer"
                  data-testid={`row-investment-${inv.id}`}
                  onClick={() => open("ytd-return")}
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-sm">{inv.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium text-muted-foreground">{inv.type}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{inv.vintage}</td>
                  <td className="px-5 py-4 text-sm font-medium">{formatCurrency(inv.committed)}</td>
                  <td className="px-5 py-4 text-sm font-bold">{formatCurrency(inv.nav)}</td>
                  <td className="px-5 py-4">
                    <span className="value-positive text-sm">{inv.irr.toFixed(1)}%</span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold">{inv.tvpi.toFixed(2)}x</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">{inv.dpi.toFixed(2)}x</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={inv.status} onClick={(e) => { e.stopPropagation(); open("status-active"); }} />
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
