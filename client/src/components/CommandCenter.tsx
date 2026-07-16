import { useState } from "react";
import GlassCard, { FindingCard } from "@/components/GlassCard";
import { runContractXRay, ContractXRayResult } from "@/lib/mockEngine";
import { Scan, AlertTriangle } from "lucide-react";

export default function CommandCenter() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ContractXRayResult | null>(null);

  const analyze = () => {
    if (!input.trim()) return;
    const res = runContractXRay(input);
    setResult(res);
  };

  const scoreColor =
    !result ? "var(--kiq-muted)"
    : result.score >= 80 ? "#22c55e"
    : result.score >= 60 ? "#f59e0b"
    : "#ef4444";

  return (
    <div className="kiq-public-container grid grid-cols-1 gap-5 pb-20 md:grid-cols-2">

      {/* ── Input ── */}
      <GlassCard glow={false} className="flex flex-col gap-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">
          Contract X-Ray Input
        </h2>

        <textarea
          className="min-h-[220px] w-full resize-none rounded-[var(--kiq-radius-md)] border border-[rgba(13,37,61,0.1)] bg-white/78 p-4 text-sm leading-6 text-[color:var(--kiq-ink)] outline-none transition-all placeholder:text-[color:var(--kiq-subtle)] focus:border-[color:var(--kiq-primary)] focus:bg-white focus:ring-2 focus:ring-ring/35"
          style={{
            fontFamily: "Inter, sans-serif",
          }}
          placeholder="Paste PBM contract language, benefit language, or claims data here..."
          rows={8}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          data-testid="input-contract-xray"
        />

        <button
          onClick={analyze}
          disabled={!input.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--kiq-primary)_70%,white)] bg-[linear-gradient(135deg,var(--kiq-primary),var(--kiq-primary-deep))] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(83,58,253,0.22),inset_0_1px_0_rgba(255,255,255,0.24)] transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="btn-run-xray"
        >
          <Scan size={14} />
          Run Analysis
        </button>
      </GlassCard>

      {/* ── Output ── */}
      <GlassCard glow={!!result} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">
            KIQ Output
          </h2>
          {result && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[color:var(--kiq-muted)]">Risk Score</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor, fontVariantNumeric: "tabular-nums" }}>
                {result.score}
              </span>
              <span className="text-[11px] font-semibold text-[color:var(--kiq-muted)]">/100</span>
            </div>
          )}
        </div>

        {!result && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-[color:var(--kiq-muted)] opacity-60">
            <AlertTriangle size={32} />
            <span className="text-sm">No analysis yet. Paste a contract and run X-Ray.</span>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-[color:var(--kiq-muted)]">{result.summary}</p>
            <div className="flex flex-col gap-2 mt-2">
              {result.findings.map((f, i) => (
                <FindingCard
                  key={i}
                  issue={f.issue}
                  impact={f.impact}
                  severity={f.severity}
                />
              ))}
            </div>
          </div>
        )}
      </GlassCard>

    </div>
  );
}
