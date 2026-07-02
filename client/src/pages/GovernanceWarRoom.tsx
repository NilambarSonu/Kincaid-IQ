import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, CheckCircle2, AlertTriangle, Clock, Zap, FileText,
  TrendingUp, ChevronRight, Eye, Download, BarChart3, Lock,
  Database, Hash, ArrowRight, ExternalLink, Activity,
} from "lucide-react";

interface TrustSummary {
  total: number;
  verified_count: number;
  stale_count: number;
  low_confidence_count: number;
  export_ready: boolean;
}

interface Policy {
  policy_id: string;
  decision: string;
  allowed: boolean;
  verified_status: string;
  freshness_status: string;
  confidence_score: number;
  reason_code: string;
  reason_detail: string;
  violations: string[];
  scope?: string;
}

interface Claim {
  claim_id: string;
  kpi_key: string;
  title: string;
  value: number;
  unit: string;
  format: string;
  period: string;
  verified_status: string;
  freshness_status: string;
  confidence_score: number;
  policy: Policy;
}

interface Tile {
  id: string;
  title: string;
  severity: string;
  primaryClaim: Claim;
  drillPath: string;
}

interface Dashboard {
  dashboard_id: string;
  tile_count: number;
  tiles: Tile[];
  trust_summary: TrustSummary;
  assembled_at: string;
}

interface ExportCheck {
  allowed: boolean;
  mode: string;
  claim_count: number;
  results: any[];
}

function fmtValue(claim: Claim) {
  if (claim.format === "currency") {
    const v = claim.value;
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1_000) return "$" + (v / 1_000).toFixed(0) + "K";
    return "$" + v.toLocaleString();
  }
  return String(claim.value) + (claim.unit ? " " + claim.unit : "");
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "#00FF94" : pct >= 80 ? "#FFB800" : "#FF4D6D";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

function PolicyBadge({ policy }: { policy: Policy }) {
  const color = policy.allowed ? "#00FF94" : "#FF4D6D";
  const label = policy.allowed ? "ALLOW" : "DENY";
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded border"
      style={{ color, borderColor: color + "40", background: color + "12" }}>
      {policy.allowed ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

function FreshnessDot({ status }: { status: string }) {
  const c = status === "GREEN" ? "#00FF94" : status === "YELLOW" ? "#FFB800" : "#FF4D6D";
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: c }} />;
}

function ReceiptDrawer({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const { data: receipt } = useQuery<any>({
    queryKey: ["/api/gov/receipts", claim.claim_id],
    queryFn: () => fetch(`/api/gov/receipts/${claim.claim_id}`).then(r => r.json()),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-[680px] max-w-full h-full bg-zinc-950 border-l border-zinc-800/60 overflow-y-auto flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-zinc-800/40 sticky top-0 bg-zinc-950 z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-4 h-4 text-[#A855F7]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A855F7]">
                Governed Proof Surface
              </span>
            </div>
            <h2 className="text-lg font-black text-zinc-100">Receipt Chain</h2>
          </div>
          <button onClick={onClose} data-testid="btn-close-drawer"
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-800/50 rounded-lg px-3 py-1.5 transition-colors">
            Close
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Claim */}
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
            <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-2">Claim</p>
            <p className="text-base font-bold text-zinc-100 mb-3">{claim.title}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-zinc-600">Value:</span> <span className="font-mono text-[#00A8FF]">{fmtValue(claim)}</span></div>
              <div><span className="text-zinc-600">Period:</span> <span className="font-mono text-zinc-300">{claim.period}</span></div>
              <div><span className="text-zinc-600">KPI:</span> <span className="font-mono text-zinc-400">{claim.kpi_key}</span></div>
              <div><span className="text-zinc-600">Confidence:</span> <span className="font-mono text-[#00FF94]">{Math.round(claim.confidence_score * 100)}%</span></div>
            </div>
          </div>

          {/* Policy */}
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Policy Evaluation</p>
              <PolicyBadge policy={claim.policy} />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <FreshnessDot status={claim.policy.freshness_status} />
                <span className="text-zinc-500">Freshness: {claim.policy.freshness_status}</span>
              </div>
              <div><span className="text-zinc-600">Reason:</span> <span className="text-zinc-300">{claim.policy.reason_detail}</span></div>
              <div><span className="text-zinc-600">Scope:</span> <span className="font-mono text-zinc-400">{claim.policy.scope}</span></div>
            </div>
          </div>

          {/* Evidence */}
          {receipt && (
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-3">
                Evidence Chain · {receipt.summary?.evidence_count} item{receipt.summary?.evidence_count !== 1 ? "s" : ""}
              </p>
              {receipt.evidence?.map((ev: any) => (
                <div key={ev.evidence_id}
                  className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-4 mb-2 text-xs">
                  <p className="font-medium text-zinc-200 mb-1">{ev.title}</p>
                  <p className="text-zinc-600 font-mono text-[10px] truncate">{ev.source_uri}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-zinc-600">Type: <span className="text-zinc-400">{ev.source_type}</span></span>
                    <span className="text-zinc-600">State: <span className="text-[#00FF94]">{ev.validation_state}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Transforms */}
          {receipt && receipt.transforms?.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-3">
                Transform Chain · {receipt.summary?.transform_count} step{receipt.summary?.transform_count !== 1 ? "s" : ""}
              </p>
              {receipt.transforms.map((tr: any) => (
                <div key={tr.transform_id}
                  className="bg-zinc-950/60 border border-zinc-800/40 rounded-xl p-4 mb-2 text-xs">
                  <p className="font-mono text-zinc-400 text-[10px] mb-1">{tr.transform_id}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-600">Type: <span className="text-[#A855F7]">{tr.transform_type}</span></span>
                    <span className="text-zinc-600">Version: <span className="text-zinc-400">{tr.code_version}</span></span>
                  </div>
                  <p className="text-[9px] font-mono text-zinc-700 mt-2 truncate">Hash: {tr.output_hash}</p>
                </div>
              ))}
            </div>
          )}

          {/* Receipt hash */}
          {receipt && (
            <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-3 h-3 text-zinc-600" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">Receipt Hash</span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 break-all">{receipt.receipt_hash}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GovernanceWarRoom() {
  const [, navigate] = useLocation();
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ["/api/gov/executive/dashboard"],
  });

  const { data: exportCheck } = useQuery<ExportCheck>({
    queryKey: ["/api/gov/export/check-export"],
    queryFn: () => apiRequest("POST", "/api/gov/export/check", {
      mode: "EXPORT",
      claims: dashboard?.tiles.map(t => t.primaryClaim) ?? [],
    }).then(r => r.json()),
    enabled: !!dashboard,
  });

  const { data: boardPackCheck } = useQuery<ExportCheck>({
    queryKey: ["/api/gov/export/check-board"],
    queryFn: () => apiRequest("POST", "/api/gov/export/check", {
      mode: "BOARD_PACK",
      claims: dashboard?.tiles.map(t => t.primaryClaim) ?? [],
    }).then(r => r.json()),
    enabled: !!dashboard,
  });

  const { mutate: generateBoardPack, isPending: isBoardPackPending } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gov/export/board-pack", {
      claims: dashboard?.tiles.map(t => t.primaryClaim) ?? [],
    }),
  });

  const activeClaim = dashboard?.tiles.find(t => t.primaryClaim.claim_id === activeClaimId)?.primaryClaim ?? null;
  const ts = dashboard?.trust_summary;

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-[#A855F7]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A855F7]">
                SiriusB · Fiduciary Intelligence Layer
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-100 tracking-tight">Governance War Room</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Live evidence lineage · Policy-gated export · Board-grade claim verification
            </p>
          </div>
          <button
            onClick={() => generateBoardPack()}
            disabled={isBoardPackPending || !boardPackCheck?.allowed}
            data-testid="btn-generate-board-pack"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all disabled:opacity-40"
            style={{ background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.35)", color: "#FFB800" }}>
            <Download className={`w-3.5 h-3.5 ${isBoardPackPending ? "animate-bounce" : ""}`} />
            {isBoardPackPending ? "Assembling…" : "Board Pack"}
          </button>
        </div>

        {/* Trust KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total Tiles",    value: ts?.total ?? 0,              icon: BarChart3,    color: "#00A8FF" },
              { label: "Verified",       value: ts?.verified_count ?? 0,     icon: CheckCircle2, color: "#00FF94" },
              { label: "Stale",          value: ts?.stale_count ?? 0,        icon: Clock,        color: "#FFB800" },
              { label: "Low Confidence", value: ts?.low_confidence_count ?? 0, icon: AlertTriangle, color: "#FF4D6D" },
              { label: "Export Ready",   value: ts?.export_ready ? "Yes" : "No", icon: Shield,   color: "#A855F7", string: true },
            ].map(({ label, value, icon: Icon, color, string }) => (
              <div key={label} className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3" style={{ color }} />
                  <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">{label}</p>
                </div>
                <p className="text-2xl font-black font-mono" style={{ color }}>
                  {string ? value : Number(value)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Governance Gates */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Export Governance", check: exportCheck, mode: "EXPORT",      color: "#00FF94" },
            { label: "Board Pack Gate",   check: boardPackCheck, mode: "BOARD_PACK", color: "#FFB800" },
          ].map(({ label, check, mode, color }) => (
            <div key={mode} className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" style={{ color }} />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
                </div>
                {check && (
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border"
                    style={{ color, borderColor: color + "40", background: color + "15" }}>
                    {check.allowed ? "ALLOWED" : "BLOCKED"}
                  </span>
                )}
              </div>
              {check ? (
                <div className="text-xs space-y-1">
                  <div><span className="text-zinc-600">Mode:</span> <span className="font-mono text-zinc-300">{check.mode}</span></div>
                  <div><span className="text-zinc-600">Claims checked:</span> <span className="font-mono text-zinc-300">{check.claim_count}</span></div>
                  <div><span className="text-zinc-600">Results:</span> <span className="font-mono text-zinc-400">{check.results?.length ?? 0} commits evaluated</span></div>
                </div>
              ) : (
                <div className="h-12 animate-pulse bg-zinc-900/50 rounded-lg" />
              )}
            </div>
          ))}
        </div>

        {/* Claim Tiles */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-3.5 h-3.5 text-[#00A8FF]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Intelligence Tiles</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {isLoading
              ? [...Array(2)].map((_, i) => (
                  <div key={i} className="bg-zinc-900/40 border border-zinc-800/30 rounded-2xl p-6 animate-pulse h-48" />
                ))
              : dashboard?.tiles.map(tile => {
                  const c = tile.primaryClaim;
                  const severe = c.confidence_score >= 0.9 ? "#00FF94" : c.confidence_score >= 0.8 ? "#FFB800" : "#FF4D6D";
                  return (
                    <div key={tile.id}
                      className="bg-zinc-950/80 border border-zinc-800/40 rounded-2xl p-6 hover:border-zinc-700/60 transition-all group cursor-pointer"
                      onClick={() => setActiveClaimId(c.claim_id)}
                      data-testid={`tile-${tile.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{c.kpi_key}</p>
                          <p className="text-sm font-semibold text-zinc-200">{c.title}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <PolicyBadge policy={c.policy} />
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-zinc-800"
                            onClick={e => { e.stopPropagation(); setActiveClaimId(c.claim_id); }}>
                            <Eye className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                        </div>
                      </div>

                      <p className="text-3xl font-black font-mono mb-4" style={{ color: severe }}>
                        {fmtValue(c)}
                        <span className="text-sm font-normal text-zinc-600 ml-2">{c.period}</span>
                      </p>

                      <ConfidenceBar score={c.confidence_score} />

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800/40">
                        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                          <span className="flex items-center gap-1">
                            <FreshnessDot status={c.freshness_status} />
                            {c.freshness_status}
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {c.verified_status}
                          </span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); navigate(tile.drillPath); }}
                          className="flex items-center gap-1 text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
                          data-testid={`btn-drill-${tile.id}`}>
                          Drill
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Evidence Feed */}
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-zinc-800/40">
            <Database className="w-3.5 h-3.5 text-[#A855F7]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Evidence Registry</span>
          </div>
          <EvidenceFeed />
        </div>

      </div>

      {/* Receipt Drawer */}
      {activeClaim && (
        <ReceiptDrawer claim={activeClaim} onClose={() => setActiveClaimId(null)} />
      )}
    </Layout>
  );
}

function EvidenceFeed() {
  const { data } = useQuery<{ items: any[]; count: number }>({
    queryKey: ["/api/evidence/"],
  });
  const items = data?.items ?? [];
  return (
    <div className="divide-y divide-zinc-900/60">
      {items.length === 0 ? (
        <div className="px-5 py-6 text-xs text-zinc-600 text-center">No evidence items loaded.</div>
      ) : items.map(ev => (
        <div key={ev.evidence_id} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-900/20">
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: ev.freshness_status === "GREEN" ? "#00FF94" : "#FFB800" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-200 font-medium truncate">{ev.title}</p>
            <p className="text-[10px] font-mono text-zinc-600 truncate">{ev.source_uri}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[9px] font-mono text-zinc-600">{ev.source_type}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{ color: "#00FF94", borderColor: "#00FF9430", background: "#00FF9410" }}>
              {ev.validation_state}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
