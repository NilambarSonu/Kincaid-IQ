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
    ? "kiq-glow-ruby"
    : glow
    ? "kiq-glow-indigo"
    : "";

  const pulseClass = pulse ? "kiq-glow-pulse" : "";

  return (
    <div
      className={`glass-card ${glowClass} ${pulseClass} p-4 ${className}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {children}
    </div>
  );
}

/* ── Severity-aware finding card ──────────────────────────────────────────── */

const SEVERITY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  CRITICAL: { label: "CRITICAL", color: "#b42318", bg: "rgba(234,34,97,0.09)" },
  HIGH:     { label: "HIGH",     color: "#a8560b", bg: "rgba(255,137,36,0.1)" },
  MEDIUM:   { label: "MEDIUM",   color: "#4434d4", bg: "rgba(83,58,253,0.08)" },
  LOW:      { label: "LOW",      color: "#64748d", bg: "rgba(100,116,141,0.08)" },
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
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--kiq-ink)" }}>{issue}</div>
        <div style={{ fontSize: 12, color: "var(--kiq-muted)", marginTop: 2 }}>{impact}</div>
      </div>
    </GlassCard>
  );
}
