import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  BookOpen, Database, Layers, Hash, CheckCircle2,
  Shield, ChevronDown, ChevronUp, Lock,
} from "lucide-react";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";

interface Claim {
  claim_id: string;
  kpi_key: string;
  title: string;
  value: number;
  format: string;
  unit: string;
  period: string;
  confidence_score: number;
  verified_status: string;
  freshness_status: string;
  evidence_ids: string[];
  transform_ids: string[];
  policy: any;
}

interface Receipt {
  receipt_id: string;
  claim: Claim;
  evidence: any[];
  transforms: any[];
  summary: { evidence_count: number; transform_count: number };
  receipt_hash: string;
}

function fmtValue(claim: Claim) {
  if (claim.format === "currency") {
    const v = claim.value;
    if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
    if (v >= 1_000) return "$" + (v / 1_000).toFixed(0) + "K";
    return "$" + v.toLocaleString();
  }
  return String(claim.value);
}

function DossierCard({ claim }: { claim: Claim }) {
  const [expanded, setExpanded] = useState(false);

  const { data: receipt } = useQuery<Receipt>({
    queryKey: ["/api/gov/receipts", claim.claim_id],
    queryFn: () => fetch(`/api/gov/receipts/${claim.claim_id}`).then(r => r.json()),
    enabled: expanded,
  });

  const confColor = claim.confidence_score >= 0.9 ? "#00FF94" : claim.confidence_score >= 0.8 ? "#FFB800" : "#FF4D6D";

  return (
    <div className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/40 rounded-2xl overflow-hidden">
      <div
        className="flex items-start gap-4 p-5 cursor-pointer hover:bg-[var(--kiq-canvas-soft)]/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
        data-testid={`dossier-expand-${claim.claim_id}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-mono text-[#A855F7] bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/40 rounded px-1.5 py-0.5">
              {claim.kpi_key}
            </span>
            <span className="text-[9px] font-mono text-zinc-600">{claim.period}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--kiq-ink-soft)] mb-2">{claim.title}</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-2xl font-black font-mono" style={{ color: confColor }}>{fmtValue(claim)}</span>
            <div>
              <div className="h-1 w-20 bg-[var(--kiq-surface)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.round(claim.confidence_score * 100)}%`, background: confColor }} />
              </div>
              <span className="text-[9px] text-zinc-600">{Math.round(claim.confidence_score * 100)}% confidence</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end mb-1">
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: claim.freshness_status === "GREEN" ? "#00FF94" : "#FFB800" }} />
              <span className="text-[9px] font-mono text-zinc-600">{claim.freshness_status}</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-600">{claim.verified_status}</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--kiq-hairline)]/40 p-5 space-y-4 bg-[var(--kiq-canvas-soft)]/20">
          {/* Evidence */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-3.5 h-3.5 text-[#00A8FF]" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                Evidence Chain · {receipt?.summary.evidence_count ?? claim.evidence_ids.length} item(s)
              </span>
            </div>
            {receipt ? (
              receipt.evidence.map((ev: any) => (
                <div key={ev.evidence_id}
                  className="bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/40 rounded-xl p-4 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--kiq-ink-soft)] mb-1">{ev.title}</p>
                      <p className="text-[10px] font-mono text-zinc-600 truncate">{ev.source_uri}</p>
                    </div>
                    <div className="flex-shrink-0 flex gap-2">
                      <span className="text-[9px] font-mono text-zinc-600">{ev.source_type}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                        style={{ color: "#00FF94", borderColor: "#00FF9430", background: "#00FF9410" }}>
                        {ev.validation_state}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-12 bg-[var(--kiq-canvas-soft)]/40 rounded-xl animate-pulse" />
            )}
          </div>

          {/* Transforms */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-3.5 h-3.5 text-[#A855F7]" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                Transform Chain · {receipt?.summary.transform_count ?? claim.transform_ids.length} step(s)
              </span>
            </div>
            {receipt ? (
              receipt.transforms.map((tr: any) => (
                <div key={tr.transform_id}
                  className="bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/40 rounded-xl p-4 mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-mono text-zinc-400 mb-1">{tr.transform_id}</p>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-zinc-600">Type: <span className="text-[#A855F7]">{tr.transform_type}</span></span>
                        <span className="text-zinc-600">v<span className="text-zinc-400">{tr.code_version}</span></span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-700 max-w-[160px] truncate">{tr.output_hash}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-12 bg-[var(--kiq-canvas-soft)]/40 rounded-xl animate-pulse" />
            )}
          </div>

          {/* Receipt hash */}
          {receipt && (
            <div className="flex items-start gap-2 bg-[var(--kiq-canvas-soft)]/40 rounded-xl p-4">
              <Lock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">Immutable Receipt Hash</p>
                <p className="text-[10px] font-mono text-zinc-500 break-all">{receipt.receipt_hash}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GovernanceDossier() {
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const { data, isLoading } = useQuery<{ items: Claim[]; count: number }>({
    queryKey: ["/api/gov/claims/"],
  });

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-[#FFB800]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFB800]">
              Governed Audit Surface
            </span>
          </div>
          <h1 className="text-2xl font-black text-[var(--kiq-ink)]">Plan Dossier</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Full claim review with evidence lineage, transform chains, and immutable receipt hashes
          </p>
        </div>

        <FileUploadZone
          uploadedDoc={uploadedDoc ?? undefined}
          onDocumentReady={setUploadedDoc}
          onClear={() => setUploadedDoc(null)}
          label="Upload Governance Document"
          hint="Attach a plan document, audit report, or governance policy (PDF, DOCX, TXT) for reference alongside dossier claims"
          accept=".pdf,.docx,.txt"
        />

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Live Claims",    value: data?.count ?? 0,
              sub: "loaded from governance engine", color: "#00A8FF" },
            { label: "Receipt Chains", value: data?.count ?? 0,
              sub: "assembleable on demand",         color: "#A855F7" },
            { label: "Evidence Items", value: data?.count ?? 0,
              sub: "per claim average",              color: "#FFB800" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/50 rounded-xl p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
              <p className="text-2xl font-black font-mono" style={{ color }}>{value}</p>
              <p className="text-[10px] text-zinc-700 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading
            ? [...Array(2)].map((_, i) => (
                <div key={i} className="bg-[var(--kiq-canvas-soft)]/40 border border-[var(--kiq-hairline)]/30 rounded-2xl h-28 animate-pulse" />
              ))
            : (data?.items ?? []).map(c => (
                <DossierCard key={c.claim_id} claim={c} />
              ))
          }
        </div>
      </div>
    </Layout>
  );
}
