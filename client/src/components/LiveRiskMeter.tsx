import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import type { ConfidenceTier } from "./Doctrine";

/**
 * LiveRiskIndex meter — OS-13 Continuous Verification (Phase 3 Day 90).
 *
 * Risk = 0.45·UnverifiedRate + 0.30·StaleRate + 0.25·LowConfidenceRate
 *
 * Counterpart to FPSGauge: FPS is *posture* (higher = better),
 * LiveRiskIndex is *exposure* (higher = worse). Renders as a horizontal
 * meter (full) with the top DriftFinding[] below, or as a compact pill.
 */

interface DriftFinding {
  claim_id: string;
  kpi_key: string;
  title: string;
  verified: string;
  freshness: string;
  confidence: number;
  drift_reason: "UNVERIFIED" | "STALE" | "LOW_CONFIDENCE";
}

interface LiveRiskResponse {
  scope: { ein: string | null; total_claims: number };
  risk_index: number;
  tier: ConfidenceTier;
  unverified_rate: number;
  stale_rate: number;
  low_confidence_rate: number;
  drift_findings: DriftFinding[];
  rationale: string;
  weights: { unverified: number; stale: number; low_conf: number };
}

// Risk colors are *inverted* from FPS: high risk == red.
function riskColor(risk: number): string {
  if (risk >= 50) return "#FF4D6D";
  if (risk >= 20) return "#F59E0B";
  return "#10B981";
}

function riskIcon(risk: number): typeof Activity {
  if (risk >= 50) return ShieldAlert;
  if (risk >= 20) return AlertTriangle;
  return Activity;
}

export function LiveRiskMeter({
  ein,
  variant = "full",
}: {
  ein?: string | null;
  variant?: "full" | "compact";
}) {
  const { data, isLoading, isError } = useQuery<LiveRiskResponse>({
    queryKey: ["/api/governance/live-risk", ein ?? "global"],
    queryFn: async () => {
      const url = ein
        ? `/api/governance/live-risk?ein=${encodeURIComponent(ein)}`
        : "/api/governance/live-risk";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`LiveRisk fetch failed: ${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Fail-closed per Hard Rule 04.
  const effective: LiveRiskResponse | null = data ?? (isError ? {
    scope: { ein: ein ?? null, total_claims: 0 },
    risk_index: 0,
    tier: "INSUFFICIENT_EVIDENCE" as const,
    unverified_rate: 0,
    stale_rate: 0,
    low_confidence_rate: 0,
    drift_findings: [],
    rationale: "LiveRiskIndex endpoint unreachable — surveillance offline.",
    weights: { unverified: 0.45, stale: 0.30, low_conf: 0.25 },
  } : null);

  if (isLoading || !effective) {
    if (variant === "compact") {
      return (
        <div
          data-testid="live-risk-loading"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 6,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            color: "#475569",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          RISK · —
        </div>
      );
    }
    return (
      <div
        data-testid="live-risk-loading"
        style={{ height: 108, borderRadius: 8, background: "#ffffff" }}
      />
    );
  }

  const risk = effective.risk_index;
  const color = riskColor(risk);
  const Icon = riskIcon(risk);

  if (variant === "compact") {
    return (
      <span
        data-testid="live-risk-compact"
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
        RISK · {risk.toFixed(0)}
      </span>
    );
  }

  return (
    <div
      data-testid="live-risk-meter"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon style={{ width: 14, height: 14, color }} />
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "var(--kiq-muted)",
            textTransform: "uppercase",
          }}
        >
          OS-13 · Live Risk Index
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>
          {risk.toFixed(0)}
          <span style={{ fontSize: 10, color: "var(--kiq-muted)", marginLeft: 4 }}>
            /100
          </span>
        </div>
      </div>

      {/* Composite bar with three colored segments showing the contribution mix */}
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          background: "#e2e8f0",
        }}
      >
        <div
          style={{
            width: `${effective.unverified_rate * effective.weights.unverified * 100}%`,
            background: "#FF4D6D",
            transition: "width 0.4s ease",
          }}
          title={`Unverified contribution: ${(effective.unverified_rate * effective.weights.unverified * 100).toFixed(1)} pts`}
        />
        <div
          style={{
            width: `${effective.stale_rate * effective.weights.stale * 100}%`,
            background: "#F59E0B",
            transition: "width 0.4s ease",
          }}
          title={`Stale contribution: ${(effective.stale_rate * effective.weights.stale * 100).toFixed(1)} pts`}
        />
        <div
          style={{
            width: `${effective.low_confidence_rate * effective.weights.low_conf * 100}%`,
            background: "#BF5FFF",
            transition: "width 0.4s ease",
          }}
          title={`Low-confidence contribution: ${(effective.low_confidence_rate * effective.weights.low_conf * 100).toFixed(1)} pts`}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 9.5,
          color: "var(--kiq-muted)",
          letterSpacing: "0.05em",
        }}
      >
        <Legend dot="#FF4D6D" label={`Unverified ${Math.round(effective.unverified_rate * 100)}%`} />
        <Legend dot="#F59E0B" label={`Stale ${Math.round(effective.stale_rate * 100)}%`} />
        <Legend dot="#BF5FFF" label={`Low-Conf ${Math.round(effective.low_confidence_rate * 100)}%`} />
      </div>

      {effective.drift_findings.length > 0 && (
        <div
          style={{
            marginTop: 4,
            padding: 8,
            borderRadius: 6,
            background: "rgba(255, 77, 109, 0.03)",
            border: "1px solid rgba(255, 77, 109, 0.22)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#FF4D6D",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            Drift Findings · top {effective.drift_findings.length}
          </div>
          {effective.drift_findings.map(f => (
            <div
              key={f.claim_id}
              data-testid={`drift-finding-${f.claim_id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 10,
                color: "var(--kiq-ink-soft)",
                fontFamily: "ui-sans-serif, system-ui",
              }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color:
                    f.drift_reason === "UNVERIFIED" ? "#FF4D6D"
                    : f.drift_reason === "STALE" ? "#F59E0B"
                    : "#BF5FFF",
                  padding: "1px 6px",
                  borderRadius: 3,
                  border: `1px solid ${
                    f.drift_reason === "UNVERIFIED" ? "rgba(255, 77, 109, 0.3)"
                    : f.drift_reason === "STALE" ? "rgba(245, 158, 11, 0.3)"
                    : "rgba(191, 95, 255, 0.3)"
                  }`,
                  background: "#ffffff",
                  flexShrink: 0,
                  width: 88,
                  textAlign: "center",
                }}
              >
                {f.drift_reason}
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.title}
              </span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 9, color: "var(--kiq-muted)" }}>
                conf {f.confidence.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, display: "inline-block" }} />
      {label}
    </span>
  );
}
