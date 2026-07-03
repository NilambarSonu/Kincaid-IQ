import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldCheck, AlertTriangle, FileCheck2 } from "lucide-react";

// Kincaid IQ · War Room · Contract Leakage (DRAP Reconciliation)
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
      className="text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{ color, background: `${color}1a`, border: `1px solid ${color}40` }}
      data-testid={`leakage-chip-${tier.toLowerCase()}`}
    >
      {certified ? "Certified" : "Insufficient"}
    </span>
  );
}

function Stat({ label, value, color, testid }: { label: string; value: string; color: string; testid: string }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
      style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
      data-testid={testid}
    >
      <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
        {label}
      </span>
      <span className="text-[15px] font-black tabular-nums leading-none" style={{ color }}>
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
        <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
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
      className="mt-3 rounded-xl px-4 py-3"
      style={{ background: "rgba(245,166,35,0.04)", border: "1px solid rgba(245,166,35,0.15)" }}
      data-testid="leakage-panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <ShieldCheck className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Contract Leakage · DRAP Reconciliation
        </span>
        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.25)" }}>
          Supplemental · not a board tile
        </span>
        <span
          className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: BLUE, background: `${BLUE}14`, border: `1px solid ${BLUE}33` }}
          data-testid="leakage-demo-tag"
        >
          Demo fixture · not the loaded entity
        </span>
        <span
          className="ml-auto text-[8px] font-mono uppercase tracking-wider"
          style={{ color: "rgba(255,255,255,0.3)" }}
          data-testid="leakage-census"
        >
          {census.CERTIFIED} certified · {census.INSUFFICIENT_EVIDENCE} insufficient
        </span>
      </div>

      {/* Vendor line */}
      <div className="text-[8px] font-mono uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
        {contract.vendor} · effective {contract.effective_date} · tolerance {contract.tolerance_bps} bps · terms{" "}
        {shortHash(contract.terms_source_hash)}
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <Stat label="Net DRAP" value={usd(rec.drap_cents)} color={GOLD} testid="leakage-net" />
        <Stat label="Gross Overpaid" value={usd(rec.gross_overpaid_cents)} color={RED} testid="leakage-gross" />
        <Stat label="Favorable" value={usd(rec.favorable_cents)} color={GREEN} testid="leakage-favorable" />
        <Stat
          label="Tolerance Breaches"
          value={`${rec.breach_count} / ${rec.receipts.length}`}
          color={rec.breach_count > 0 ? RED : GREEN}
          testid="leakage-breaches"
        />
      </div>

      {/* Category rollups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        {catEntries.map(([cat, roll]) => (
          <div
            key={cat}
            className="rounded-lg px-3 py-2 flex items-center justify-between"
            style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
            data-testid={`leakage-cat-${cat.toLowerCase()}`}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: BLUE }}>
              {cat.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] font-black tabular-nums" style={{ color: "#e5e7eb" }}>
              {usd(roll.variance_cents)}
            </span>
            <span className="text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
              {roll.claims} claims · {roll.breaches} breach
            </span>
          </div>
        ))}
      </div>

      {/* Receipts table */}
      <div className="rounded-lg overflow-hidden mb-3" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full text-left" data-testid="leakage-receipts">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              {["Claim", "Code", "Qty", "Paid", "Allowable", "Variance", "Bps", "Conf"].map((h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-[7px] font-mono uppercase tracking-wider"
                  style={{ color: "rgba(255,255,255,0.4)" }}
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
                    background: orphan ? "rgba(255,77,109,0.06)" : r.breach ? "rgba(255,77,109,0.03)" : "transparent",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                  }}
                  data-testid={`leakage-row-${r.claim_id}`}
                >
                  <td className="px-2 py-1 text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {r.claim_id.replace("CLM_DEMO_", "#")}
                  </td>
                  <td className="px-2 py-1 text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {r.code}
                  </td>
                  <td className="px-2 py-1 text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {r.qty.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {usd(r.paid_cents)}
                  </td>
                  <td className="px-2 py-1 text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {r.allowable_cents == null ? "·" : usd(r.allowable_cents)}
                  </td>
                  <td
                    className="px-2 py-1 text-[8px] font-bold tabular-nums"
                    style={{
                      color:
                        r.variance_cents == null
                          ? "rgba(255,255,255,0.4)"
                          : r.variance_cents > 0
                          ? RED
                          : r.variance_cents < 0
                          ? GREEN
                          : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {r.variance_cents == null ? "·" : usd(r.variance_cents)}
                  </td>
                  <td className="px-2 py-1 text-[8px] tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {r.unit_over_bps == null ? "·" : r.unit_over_bps.toLocaleString()}
                  </td>
                  <td className="px-2 py-1">
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
        className="rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap"
        style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
        data-testid="leakage-packet"
      >
        <FileCheck2 className="w-3 h-3" style={{ color: GREEN }} />
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
          Proof Packet Sealed
        </span>
        <span className="text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
          {pkt.packet_id} · content {shortHash(pkt.content_hash)}
        </span>
        <span className="flex items-center gap-1 text-[8px] font-mono" style={{ color: attest.valid ? GREEN : RED }}>
          {attest.valid ? <ShieldCheck className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
          chain {attest.valid ? "verified" : "broken"} · {attest.events_checked} events · {attest.breaks} breaks
        </span>
        <span className="ml-auto text-[8px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
          DRAP = Σ(Paid − Allowable) · run {shortHash(rec.run_hash)}
        </span>
      </div>
    </div>
  );
}
