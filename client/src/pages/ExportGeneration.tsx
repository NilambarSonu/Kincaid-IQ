import { useState } from "react";
import { Layout } from "@/components/Layout";
import { FileDown, ShieldCheck, Shield, Package2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ExportPanel,
  ExportEligibilityPanel,
  ExportGuard,
  BoardPackButton,
} from "@/features/export";

const TABS = [
  { id: "package",     label: "Export Package",  icon: FileDown,     desc: "Select claims · generate gated package" },
  { id: "eligibility", label: "Eligibility",     icon: ShieldCheck,  desc: "Per-claim gate breakdown" },
  { id: "guard",       label: "Guard",           icon: Shield,       desc: "Conditional gate wrapper" },
  { id: "board-pack",  label: "Board Pack",      icon: Package2,     desc: "One-click board pack generation" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ExportGeneration() {
  const [tab, setTab] = useState<TabId>("package");

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileDown className="w-5 h-5 text-[#A855F7]" />
              <h1 className="text-xl font-bold tracking-tight">Export Generation</h1>
            </div>
            <p className="text-xs text-zinc-500">
              Policy-gated claim export surface · 4-component export feature module
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1 mb-6 overflow-x-auto"
          data-testid="export-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              data-testid={`tab-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-mono font-semibold whitespace-nowrap transition-all",
                tab === id
                  ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "package" && (
          <ExportPanel defaultAudience="executive" defaultRequester="jeremiah.shrack" />
        )}

        {tab === "eligibility" && (
          <ExportEligibilityPanel audience="board" />
        )}

        {tab === "guard" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <p className="text-xs font-semibold text-zinc-200 mb-0.5">ExportGuard — Board Gate</p>
              <p className="text-[10px] text-zinc-500">
                Runs the policy gate on all claims. If all pass, the export surface is unlocked.
                If any fail, an ExportBlockedNotice is shown instead.
              </p>
            </div>
            <ExportGuard audience="board" autoCheck={false}>
              <div className="rounded-xl border border-[#00FF94]/20 bg-[#00FF94]/5 px-5 py-6 text-center">
                <ShieldCheck className="w-6 h-6 text-[#00FF94] mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#00FF94]">Export Surface Unlocked</p>
                <p className="text-[10px] text-zinc-500 mt-1">All claims passed the board gate</p>
              </div>
            </ExportGuard>
          </div>
        )}

        {tab === "board-pack" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <p className="text-xs font-semibold text-zinc-200 mb-0.5">BoardPackButton</p>
              <p className="text-[10px] text-zinc-500">
                Auto-discovers all board-grade claims, runs the 4-gate pipeline, generates a
                signed board pack with a DecisionReceipt and SHA3-256 manifest hash.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Full Variant</p>
                <BoardPackButton
                  requester="jeremiah.shrack"
                  variant="full"
                />
              </div>
              <div>
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Compact Variant</p>
                <BoardPackButton
                  requester="jeremiah.shrack"
                  variant="compact"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
