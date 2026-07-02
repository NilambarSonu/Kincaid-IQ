import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import { ConfidenceChip, type ConfidenceTier } from "./Doctrine";

/**
 * Fiduciary Posture Score gauge — OS-08 Governance, Phase 3 Day 90.
 *
 * Composite 0–100 score:
 *   FPS = 0.40·DeterministicCoverage + 0.35·EvidenceFreshness + 0.25·GovernanceCompliance
 *
 * Renders as a circular SVG gauge with the three weighted sub-components
 * broken out below. Per Master Build Prompt §3 (Phase 3), the gauge
 * lives on War Room Tile 4 and rides along inside the shared DoctrineBar
 * so every page surfaces the same fiduciary posture indicator.
 */

interface FPSResponse {
  scope: { ein: string | null; total_claims: number };
  fps_score: number;
  tier: ConfidenceTier;
  deterministic_coverage: number;
  evidence_freshness: number;
  governance_compliance: number;
  rationale: string;
  weights: { det_cov: number; freshness: number; compliance: number };
}

const TIER_COLOR: Record<ConfidenceTier, string> = {
  CERTIFIED:             "#10B981",
  MODELED:               "#F59E0B",
  INSUFFICIENT_EVIDENCE: "#FF4D6D",
};

const TIER_ICON: Record<ConfidenceTier, typeof ShieldCheck> = {
  CERTIFIED:             ShieldCheck,
  MODELED:               AlertTriangle,
  INSUFFICIENT_EVIDENCE: XCircle,
};

export function FPSGauge({
  ein,
  size = 120,
  variant = "full",
}: {
  ein?: string | null;
  size?: number;
  variant?: "full" | "compact";
}) {
  const { data, isLoading, isError } = useQuery<FPSResponse>({
    queryKey: ["/api/governance/fps", ein ?? "global"],
    queryFn: async () => {
      const url = ein ? `/api/governance/fps?ein=${encodeURIComponent(ein)}` : "/api/governance/fps";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`FPS fetch failed: ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Fail-closed per Hard Rule 04: when the FPS endpoint cannot be reached
  // we surface INSUFFICIENT_EVIDENCE rather than hanging on a skeleton.
  const effective: FPSResponse | null = data ?? (isError ? {
    scope: { ein: ein ?? null, total_claims: 0 },
    fps_score: 0,
    tier: "INSUFFICIENT_EVIDENCE" as const,
    deterministic_coverage: 0,
    evidence_freshness: 0,
    governance_compliance: 0,
    rationale: "FPS endpoint unreachable — posture not computable.",
    weights: { det_cov: 0.40, freshness: 0.35, compliance: 0.25 },
  } : null);

  if (isLoading || !effective) {
    if (variant === "compact") {
      return (
        <div
          data-testid="fps-gauge-loading"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.4)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          FPS · —
        </div>
      );
    }
    return (
      <div
        data-testid="fps-gauge-loading"
        style={{ width: size, height: size, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }}
      />
    );
  }

  const score = effective.fps_score;
  const tier = effective.tier;
  const color = TIER_COLOR[tier];
  const Icon = TIER_ICON[tier];

  // Compact pill — for DoctrineBar
  if (variant === "compact") {
    return (
      <span
        data-testid="fps-gauge-compact"
        title={effective.rationale}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 6,
          background: `${color}12`,
          border: `1px solid ${color}40`,
          color,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <Icon style={{ width: 10, height: 10 }} />
        FPS · {score.toFixed(0)}
      </span>
    );
  }

  // Full radial gauge
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;

  return (
    <div
      data-testid="fps-gauge"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={8}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${c}`}
              style={{ transition: "stroke-dasharray 0.5s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: size * 0.27, fontWeight: 900, color, lineHeight: 1 }}>
              {score.toFixed(0)}
            </div>
            <div
              style={{
                fontSize: 8,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.15em",
                marginTop: 2,
              }}
            >
              FPS · 0–100
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
              }}
            >
              Fiduciary Posture
            </div>
            <ConfidenceChip tier={tier} compact />
          </div>
          <SubBar
            label="Det. Coverage"
            value={effective.deterministic_coverage}
            weight={effective.weights.det_cov}
            color={color}
          />
          <SubBar
            label="Evidence Freshness"
            value={effective.evidence_freshness}
            weight={effective.weights.freshness}
            color={color}
          />
          <SubBar
            label="Gov. Compliance"
            value={effective.governance_compliance}
            weight={effective.weights.compliance}
            color={color}
          />
        </div>
      </div>

      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.35)",
          lineHeight: 1.45,
          fontFamily: "ui-sans-serif, system-ui",
        }}
      >
        {effective.rationale}
      </div>
    </div>
  );
}

function SubBar({
  label,
  value,
  weight,
  color,
}: {
  label: string;
  value: number;
  weight: number;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          fontSize: 9,
          color: "rgba(255,255,255,0.45)",
          flex: "0 0 110px",
          letterSpacing: "0.05em",
        }}
      >
        {label} ·{" "}
        <span style={{ color: "rgba(255,255,255,0.30)" }}>{Math.round(weight * 100)}%</span>
      </div>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color, width: 26, textAlign: "right" }}>
        {pct}%
      </div>
    </div>
  );
}
