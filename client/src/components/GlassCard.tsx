import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  glowCrimson?: boolean;
  pulse?: boolean;
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = "",
  glow = true,
  glowCrimson = false,
  pulse = false,
  onClick,
}: GlassCardProps) {
  const glowClass = glowCrimson
    ? "glow-crimson"
    : glow
    ? "glow"
    : "";

  const pulseClass = pulse ? "glow-pulse" : "";

  return (
    <div
      className={`glass ${glowClass} ${pulseClass} p-4 ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {children}
    </div>
  );
}

/* ── Severity-aware finding card ──────────────────────────────────────────── */

const SEVERITY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: "CRITICAL", color: "#ff4d4d", bg: "rgba(255,77,77,0.12)" },
  HIGH:     { label: "HIGH",     color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  MEDIUM:   { label: "MEDIUM",   color: "#4f7dff", bg: "rgba(79,125,255,0.12)" },
  LOW:      { label: "LOW",      color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

interface FindingCardProps {
  issue: string;
  impact: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export function FindingCard({ issue, impact, severity }: FindingCardProps) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW;

  return (
    <GlassCard glow={false} className="flex items-start gap-3">
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: s.color,
          background: s.bg,
          border: `1px solid ${s.color}40`,
          borderRadius: 6,
          padding: "2px 8px",
          whiteSpace: "nowrap",
          marginTop: 2,
        }}
      >
        {s.label}
      </span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eeff" }}>{issue}</div>
        <div style={{ fontSize: 12, color: "#6b7fb5", marginTop: 2 }}>{impact}</div>
      </div>
    </GlassCard>
  );
}
