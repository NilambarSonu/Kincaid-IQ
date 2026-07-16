import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldCheck, AlertTriangle, FileCheck2 } from "lucide-react";

// Kincaid Health · War Room · Contract Leakage (DRAP Reconciliation)
// Supplemental strip (Hard Rule 01: not a board tile). Surfaces the deterministic
// DRAP pipeline: DRAP = Sum(Paid - Allowable) across every claim, reconciled
// against the ingested fee schedule, breach-flagged, category-rolled, and sealed
// into a proof packet. Unmatched claims read INSUFFICIENT_EVIDENCE, never zero.

const GOLD = "#F5A623";
const RED = "#FF4D6D";
const GREEN = "#10B981";
const BLUE = "#00D4FF";

interface Receipt {
  claim_id: string;
  code: string;
  code_type: string;
  qty: number;
  paid_cents: number;
  allowable_cents: number | null;
  variance_cents: number | null;
  unit_over_bps: number | null;
  breach: boolean;
  confidence: string;
  note?: string;
}

interface CategoryRoll {
  variance_cents: number;
  claims: number;
  breaches: number;
}

interface LeakageResponse {
  contract: {
    contract_id: string;
    vendor: string;
    effective_date: string;
    tolerance_bps: number;
    terms_source_hash: string;
    fee_lines: { line_id: string; code_type: string; code: string; allowable_cents: number; category: string }[];
  };
  reconciliation: {
    run_id: string;
    drap_cents: number;
    gross_overpaid_cents: number;
    favorable_cents: number;
    breach_count: number;
    unmatched_claims: number;
    categories: Record<string, CategoryRoll>;
    receipts: Receipt[];
    claimset_hash: string;
    run_hash: string;
    core_sentence: string;
  };
  proof_packet: {
    packet_id: string;
    content_hash: string;
    chain_head_hash: string;
    components: {
      confidence_census: { CERTIFIED: number; INSUFFICIENT_EVIDENCE: number };
      chain_attestation: { valid: boolean; events_checked: number; breaks: number; head_hash: string };
    };
  };
  benchmark: { net_drap_cents: number; gross_overpaid_cents: number; favorable_cents: number };
}

const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const shortHash = (h: string) => (h ? `${h.slice(0, 12)}…` : "·");

function ConfChip({ tier }: { tier: string }) {
  const certified = tier === "CERTIFIED";
  const color = certified ? GREEN : RED;
  return (
    <span
      className="text-[7.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
      style={{ color, background: `${color}14`, border: `1px solid ${color}33` }}
      data-testid={`leakage-chip-${tier.toLowerCase()}`}
    >
      {certified ? "Certified" : "Insufficient"}
    </span>
  );
}

function Stat({ label, value, color, testid }: { label: string; value: string; color: string; testid: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col gap-1 shadow-sm"
      style={{ background: "#ffffff", border: "1px solid rgba(0, 37, 80, 0.08)" }}
      data-testid={testid}
    >
      <span className="text-[9px] font-mono uppercase tracking-[0.12em]" style={{ color: "var(--kiq-muted)" }}>
        {label}
      </span>
      <span className="text-[18px] font-bold tabular-nums leading-none mt-1" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function ContractLeakagePanel() {
  const { data, isLoading, isError } = useQuery<LeakageResponse>({
    queryKey: ["/api/contract/leakage/demo"],
    queryFn: async () => {
      const r = await fetch("/api/contract/leakage/demo", { credentials: "include" });
      if (!r.ok) throw new Error("leakage fetch failed");
      return r.json();
    },
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div
        className="mt-3 rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={{ background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.15)" }}
        data-testid="leakage-loading"
      >
        <Activity className="w-3 h-3 animate-pulse" style={{ color: GOLD }} />
        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
          Reconciling contract leakage…
        </span>
      </div>
    );
  }
  if (isError || !data) return null;

  const { contract, reconciliation: rec, proof_packet: pkt } = data;
  const census = pkt.components.confidence_census;
  const attest = pkt.components.chain_attestation;
  const catEntries = Object.entries(rec.categories);

  return (
    <div
      className="mt-3 rounded-xl px-4 py-4"
      style={{ background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.22)" }}
      data-testid="leakage-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        <ShieldCheck className="w-3.5 h-3.5" style={{ color: GOLD }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Contract Leakage · DRAP Reconciliation
        </span>
        <span className="text-[8.5px] font-mono uppercase tracking-wider text-slate-400">
          Supplemental · not a board tile
        </span>
        <span
          className="text-[8.5px] font-mono uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ color: "var(--kiq-primary)", background: "rgba(83, 58, 253, 0.08)", border: "1px solid rgba(83, 58, 253, 0.2)" }}
          data-testid="leakage-demo-tag"
        >
          Demo fixture · not the loaded entity
        </span>
        <span
          className="ml-auto text-[8.5px] font-mono uppercase tracking-wider text-slate-500"
          data-testid="leakage-census"
        >
          {census.CERTIFIED} certified · {census.INSUFFICIENT_EVIDENCE} insufficient
        </span>
      </div>

      {/* Vendor line */}
      <div className="text-[9px] font-mono uppercase tracking-wider mb-3 text-slate-500">
        {contract.vendor} · effective {contract.effective_date} · tolerance {contract.tolerance_bps} bps · terms{" "}
        {shortHash(contract.terms_source_hash)}
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-3.5">
        <Stat label="Net DRAP" value={usd(rec.drap_cents)} color="var(--kiq-gold)" testid="leakage-net" />
        <Stat label="Gross Overpaid" value={usd(rec.gross_overpaid_cents)} color={RED} testid="leakage-gross" />
        <Stat label="Favorable" value={usd(rec.favorable_cents)} color="var(--kiq-health)" testid="leakage-favorable" />
        <Stat
          label="Tolerance Breaches"
          value={`${rec.breach_count} / ${rec.receipts.length}`}
          color={rec.breach_count > 0 ? RED : "var(--kiq-health)"}
          testid="leakage-breaches"
        />
      </div>

      {/* Category rollups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3.5">
        {catEntries.map(([cat, roll]) => (
          <div
            key={cat}
            className="rounded-xl px-4 py-3 flex items-center justify-between shadow-sm"
            style={{ background: "#ffffff", border: "1px solid rgba(0, 37, 80, 0.08)" }}
            data-testid={`leakage-cat-${cat.toLowerCase()}`}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600">
              {cat.replace(/_/g, " ")}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-slate-900">
              {usd(roll.variance_cents)}
            </span>
            <span className="text-[9px] font-mono text-slate-400">
              {roll.claims} claims · {roll.breaches} breach
            </span>
          </div>
        ))}
      </div>

      {/* Receipts table */}
      <div className="rounded-xl overflow-hidden mb-3.5 shadow-sm" style={{ border: "1px solid rgba(0, 37, 80, 0.08)" }}>
        <table className="w-full text-left" data-testid="leakage-receipts">
          <thead>
            <tr style={{ background: "rgba(0, 37, 80, 0.02)" }}>
              {["Claim", "Code", "Qty", "Paid", "Allowable", "Variance", "Bps", "Conf"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-[9px] font-mono uppercase tracking-wider text-slate-500 border-b border-slate-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rec.receipts.map((r) => {
              const orphan = r.confidence !== "CERTIFIED";
              return (
                <tr
                  key={r.claim_id}
                  style={{
                    background: orphan ? "rgba(255,77,109,0.04)" : r.breach ? "rgba(255,77,109,0.015)" : "transparent",
                  }}
                  className="border-b border-slate-100/50 hover:bg-slate-50/40 transition-colors"
                  data-testid={`leakage-row-${r.claim_id}`}
                >
                  <td className="px-3 py-1.5 text-[10px] font-mono text-slate-400">
                    {r.claim_id.replace("CLM_DEMO_", "#")}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] font-mono text-slate-800">
                    {r.code}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-slate-500">
                    {r.qty.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-slate-800 font-medium">
                    {usd(r.paid_cents)}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-slate-600">
                    {r.allowable_cents == null ? "·" : usd(r.allowable_cents)}
                  </td>
                  <td
                    className="px-3 py-1.5 text-[10px] font-semibold tabular-nums"
                    style={{
                      color:
                        r.variance_cents == null
                          ? "var(--kiq-muted)"
                          : r.variance_cents > 0
                          ? RED
                          : r.variance_cents < 0
                          ? GREEN
                          : "var(--kiq-muted)",
                    }}
                  >
                    {r.variance_cents == null ? "·" : usd(r.variance_cents)}
                  </td>
                  <td className="px-3 py-1.5 text-[10px] tabular-nums text-slate-600">
                    {r.unit_over_bps == null ? "·" : r.unit_over_bps.toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5">
                    <ConfChip tier={r.confidence} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Proof packet footer */}
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm"
        style={{ background: "#ffffff", border: "1px solid rgba(0, 37, 80, 0.08)" }}
        data-testid="leakage-packet"
      >
        <FileCheck2 className="w-3.5 h-3.5" style={{ color: "var(--kiq-health)" }} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-800">
          Proof Packet Sealed
        </span>
        <span className="text-[9px] font-mono text-slate-400">
          {pkt.packet_id} · content {shortHash(pkt.content_hash)}
        </span>
        <span className="flex items-center gap-1 text-[9px] font-mono" style={{ color: attest.valid ? "var(--kiq-health)" : RED }}>
          {attest.valid ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          chain {attest.valid ? "verified" : "broken"} · {attest.events_checked} events · {attest.breaks} breaks
        </span>
        <span className="ml-auto text-[9px] font-mono text-slate-400">
          DRAP = Σ(Paid − Allowable) · run {shortHash(rec.run_hash)}
        </span>
      </div>
    </div>
  );
}
