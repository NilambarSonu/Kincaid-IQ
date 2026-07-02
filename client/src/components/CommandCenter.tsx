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
    !result ? "#6b7fb5"
    : result.score >= 80 ? "#22c55e"
    : result.score >= 60 ? "#f59e0b"
    : "#ef4444";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-8">

      {/* ── Input ── */}
      <GlassCard glow={false} className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-white/80 tracking-wide uppercase"
            style={{ letterSpacing: "0.08em", fontSize: 11 }}>
          Contract X-Ray Input
        </h2>

        <textarea
          className="w-full rounded-xl p-3 text-sm resize-none focus:outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#e8eeff",
            minHeight: 200,
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
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all"
          style={{
            background: input.trim() ? "#9B1C2E" : "rgba(155,28,46,0.25)",
            color: input.trim() ? "#fff" : "rgba(255,255,255,0.35)",
            cursor: input.trim() ? "pointer" : "not-allowed",
            border: "none",
          }}
          data-testid="btn-run-xray"
        >
          <Scan size={14} />
          Run Analysis
        </button>
      </GlassCard>

      {/* ── Output ── */}
      <GlassCard glow={!!result} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white/80 tracking-wide uppercase"
              style={{ letterSpacing: "0.08em", fontSize: 11 }}>
            KIQ Output
          </h2>
          {result && (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: "#6b7fb5" }}>Risk Score</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor, fontVariantNumeric: "tabular-nums" }}>
                {result.score}
              </span>
              <span style={{ fontSize: 11, color: "#6b7fb5" }}>/100</span>
            </div>
          )}
        </div>

        {!result && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-30">
            <AlertTriangle size={32} />
            <span className="text-sm">No analysis yet. Paste a contract and run X-Ray.</span>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-white/50 leading-relaxed">{result.summary}</p>
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
