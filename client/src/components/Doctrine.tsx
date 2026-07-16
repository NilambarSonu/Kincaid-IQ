import { useState } from "react";
import { ShieldCheck, Receipt, FileLock2, BookOpen, ChevronDown, Package } from "lucide-react";
import { ClientPackageDrawer } from "./ClientPackageDrawer";
import { FPSGauge } from "./FPSGauge";
import { LiveRiskMeter } from "./LiveRiskMeter";

export type ConfidenceTier = "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";

// Canonical 7-gate enforcement chain (docs/CONSTITUTION.md). The former DEFINE..RENDER
// pipeline shorthand is retired; these enforcement gates are the single source of truth,
// shared by the War Room drill and every page's DoctrineBar.
export const ENFORCEMENT_GATES = [
  { n: 1, key: "EVIDENCE_EXISTENCE",    name: "Evidence Existence",    fail: "EVIDENCE_MISSING",                  effect: "Cannot compute." },
  { n: 2, key: "EVIDENCE_FRESHNESS",    name: "Evidence Freshness",    fail: "EVIDENCE_STALE",                    effect: "Tile blocked." },
  { n: 3, key: "EVIDENCE_VERIFICATION", name: "Evidence Verification", fail: "EVIDENCE_UNVERIFIED",               effect: "Amber or blocked." },
  { n: 4, key: "KPI_LIFECYCLE",         name: "KPI Lifecycle",         fail: "KPI_NOT_PRODUCTION",                effect: "No War Room render." },
  { n: 5, key: "DEPENDENCY_RESOLUTION", name: "Dependency Resolution", fail: "KPI_DEPENDENCY_FAILED",             effect: "Blocked until parent KPIs resolve." },
  { n: 6, key: "THRESHOLD_EVALUATION",  name: "Threshold Evaluation",  fail: "INFO / WARNING / CRITICAL / BLOCK", effect: "Badges, alerts, or suppression." },
  { n: 7, key: "DEBT_SCORE_CHECK",      name: "Debt Score Check",      fail: "DEBT_SCORE",                        effect: "Over 25 blocks production. Over 15 blocks render." },
] as const;

export type Gate = (typeof ENFORCEMENT_GATES)[number]["key"];

export function gateMeta(gate: Gate) {
  return ENFORCEMENT_GATES.find(g => g.key === gate)!;
}

export const VOICE_CONTRACT =
  "University of Chicago PhD Economist + PhD Computer Scientist — industrial organization, agency theory, " +
  "information economics, causal inference — overlaid on a McKinsey senior partner's board-room directness. " +
  "Do not summarize — investigate. Do not speculate — prove. Do not report observations — quantify consequences. " +
  "Every assertion justified by a structural property and a dollar figure, never a preference.";

export const HARD_RULES: { num: string; title: string; body: string; icon: typeof ShieldCheck }[] = [
  {
    num: "RULE 01",
    title: "One screen, four tiles always.",
    body: "Executive surface architecturally constrained to four tiles — enforced at the type level as a 4-tuple.",
    icon: ShieldCheck,
  },
  {
    num: "RULE 02",
    title: "Every number clickable into receipts.",
    body: "No KPI is rendered without a drill path to its EvidenceRef. The drill is a first-class affordance.",
    icon: Receipt,
  },
  {
    num: "RULE 03",
    title: "No export without receipts.",
    body: "Every PDF / CSV / JSON carries a SHA-256 manifest. Exports without it are rejected at RENDER.",
    icon: FileLock2,
  },
  {
    num: "RULE 04",
    title: "Narratives never outrun evidence.",
    body: "Generative language is gated behind deterministic computation. INSUFFICIENT_EVIDENCE is a valid finding.",
    icon: BookOpen,
  },
];

const TIER_STYLE: Record<ConfidenceTier, { fg: string; bg: string; border: string; label: string }> = {
  CERTIFIED:             { fg: "#10B981", bg: "#10B98115", border: "#10B98140", label: "CERTIFIED" },
  MODELED:               { fg: "#F59E0B", bg: "#F59E0B15", border: "#F59E0B40", label: "MODELED" },
  INSUFFICIENT_EVIDENCE: { fg: "#FF4D6D", bg: "#FF4D6D15", border: "#FF4D6D40", label: "INSUFFICIENT" },
};

export function ConfidenceChip({ tier, compact = false }: { tier: ConfidenceTier; compact?: boolean }) {
  const s = TIER_STYLE[tier];
  return (
    <span
      data-testid={`confidence-chip-${tier.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: compact ? "2px 6px" : "3px 8px",
        borderRadius: 6,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.fg,
        fontSize: compact ? 9 : 10,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.fg }} />
      {s.label}
    </span>
  );
}

export function GateBadge({ gate }: { gate: Gate }) {
  const g = gateMeta(gate);
  return (
    <span
      data-testid={`gate-badge-${gate.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 6,
        background: "rgba(155, 28, 46, 0.10)",
        border: "1px solid rgba(155, 28, 46, 0.40)",
        color: "#FFB800",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <span style={{ color: "#475569", fontWeight: 700 }}>GATE {g.n}/7 ·</span>
      {g.name}
    </span>
  );
}

interface DoctrineBarProps {
  gate: Gate;
  tier?: ConfidenceTier;
  ein?: string | null;
  einName?: string | null;
  contractId?: string | null;
}

/**
 * Compact horizontal doctrine strip — Voice contract + Four Hard Rules
 * (expandable) + current Gate + Confidence + Build Package action.
 *
 * Surfaces the same constitutional doctrine that the CFO War Room shows,
 * across every page in the platform — so the user always knows which
 * gate they are inside and can drop into the unified client-package
 * builder with the page's EIN / contract context pre-loaded.
 */
export function DoctrineBar(props: DoctrineBarProps) {
  const { gate, tier, ein, einName, contractId } = props;
  const [expanded, setExpanded] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);

  return (
    <>
      <div
        data-testid="doctrine-bar"
        style={{
          background: "linear-gradient(180deg, rgba(155,28,46,0.06) 0%, rgba(10,15,30,0.4) 100%)",
          border: "1px solid rgba(255, 184, 0, 0.15)",
          borderRadius: 10,
          padding: "8px 12px",
          marginBottom: 16,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        {/* Top row — always visible */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            data-testid="doctrine-bar-toggle"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: "#FFB800",
              cursor: "pointer",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: 0,
            }}
          >
            <ShieldCheck style={{ width: 12, height: 12 }} />
            KIQ DOCTRINE
            <ChevronDown
              style={{
                width: 11,
                height: 11,
                transform: expanded ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.15s",
              }}
            />
          </button>

          <GateBadge gate={gate} />
          {tier && <ConfidenceChip tier={tier} />}
          <FPSGauge ein={ein} variant="compact" />
          <LiveRiskMeter ein={ein} variant="compact" />

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={() => setPkgOpen(true)}
            data-testid="doctrine-bar-build-package"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 6,
              background: "rgba(255, 184, 0, 0.10)",
              border: "1px solid rgba(255, 184, 0, 0.35)",
              color: "#FFB800",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Package style={{ width: 12, height: 12 }} />
            Build Package
          </button>
        </div>

        {/* Expanded panel — voice contract + four hard rules */}
        {expanded && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid rgba(255, 184, 0, 0.12)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.55)",
                fontFamily: "ui-sans-serif, system-ui",
              }}
            >
              <span style={{ color: "#FFB800", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Voice Contract ·{" "}
              </span>
              {VOICE_CONTRACT}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {HARD_RULES.map(rule => {
                const Icon = rule.icon;
                return (
                  <div
                    key={rule.num}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: "0.14em",
                        color: "#FFB800",
                      }}
                    >
                      <Icon style={{ width: 10, height: 10 }} />
                      {rule.num}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.85)",
                        marginBottom: 3,
                        fontFamily: "ui-sans-serif, system-ui",
                      }}
                    >
                      {rule.title}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        lineHeight: 1.45,
                        color: "rgba(255,255,255,0.45)",
                        fontFamily: "ui-sans-serif, system-ui",
                      }}
                    >
                      {rule.body}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                fontSize: 9,
                color: "rgba(15,23,42,0.10)",
                letterSpacing: "0.10em",
                textTransform: "uppercase",
              }}
            >
              7-Gate Enforcement Chain · {ENFORCEMENT_GATES.map((g, i) => (
                <span key={g.key} style={{ color: g.key === gate ? "#FFB800" : "rgba(15,23,42,0.10)" }}>
                  {g.name}{i < ENFORCEMENT_GATES.length - 1 ? " → " : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ClientPackageDrawer
        open={pkgOpen}
        onOpenChange={setPkgOpen}
        initialContractId={contractId ?? undefined}
        initialEin={ein ?? undefined}
        initialEinName={einName ?? undefined}
      />
    </>
  );
}
