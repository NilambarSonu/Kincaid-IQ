import { useKiq, KiqProvider } from "@/context/KiqContext";
import {
  FileText, Brain, DollarSign, TrendingUp, ShieldAlert,
  Activity, CheckCircle2, AlertCircle, CircleDot,
} from "lucide-react";

const CARD   = "#0d1033";
const CARD2  = "#111540";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT1  = "#f0f4ff";
const TEXT2  = "#8b9dd4";
const GREEN  = "#22c55e";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";
const ROSE   = "#9B1C2E";
const TEAL   = "#06b6d4";
const PURPLE = "#8b5cf6";
const ACCENT = "#4f7dff";

const AGENTS = [
  { id: 1, key: "ingestion",      name: "Ingestion Layer",        icon: FileText,   color: TEAL,   msg: "Normalizing document structure, extracting entities…" },
  { id: 2, key: "extraction",     name: "Intelligence Extraction", icon: Brain,      color: PURPLE, msg: "Extracting risk signals, compliance gaps, cost drivers…" },
  { id: 3, key: "economic",       name: "Economic Impact Model",   icon: DollarSign, color: AMBER,  msg: "Quantifying financial exposure in dollar terms…" },
  { id: 4, key: "prioritization", name: "Decision Prioritization", icon: TrendingUp, color: ACCENT, msg: "Ranking actions by impact score, urgency, reversibility…" },
  { id: 5, key: "validation",     name: "Fiduciary Validation",    icon: ShieldAlert,color: GREEN,  msg: "Applying guardrail checks — audit-defensible output…" },
];

const SEV_COLOR: Record<string, string> = {
  HIGH: RED, ELEVATED: AMBER, MODERATE: PURPLE, LOW: GREEN,
};

function badge(label: string, color: string) {
  return (
    <span style={{ background: `${color}18`, color, border: `1px solid ${color}28`,
      borderRadius: 20, padding: "2px 8px", fontSize: 9, fontWeight: 800,
      letterSpacing: 0.3, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
      {label}
    </span>
  );
}

function IntelligenceViewInner() {
  const { agentStates, liveEntities, liveRisks, loading, finalResult } = useKiq();

  const complete = Object.values(agentStates).filter(a => a.status === "complete").length;
  const active   = loading || complete > 0;

  if (!active && !finalResult) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0", color: TEXT2 }}>
        <Brain size={32} color={`${TEXT2}50`} style={{ marginBottom: 12 }}/>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Agent pipeline idle</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Submit a document above to begin analysis</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Activity size={18} color={AMBER} style={loading ? { animation: "pulse 1s infinite" } : {}}/>
        <div>
          <h2 style={{ color: TEXT1, fontSize: 16, fontWeight: 900, margin: 0 }}>Intelligence Processing</h2>
          <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
            {complete === 5 ? "Pipeline complete — all 5 agents finished" : `${complete}/5 agents complete`}
          </p>
        </div>
        {loading && badge("running", AMBER)}
        {!loading && complete === 5 && badge("complete", GREEN)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>
        {/* Pipeline tracker */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 0.6, marginBottom: 14 }}>Agent Pipeline — 5 Sequential Layers</div>

          {/* Progress bar */}
          <div style={{ background: CARD2, borderRadius: 6, height: 5, marginBottom: 14, overflow: "hidden" }}>
            <div style={{ height: "100%", background: `linear-gradient(90deg,${ROSE},${ACCENT})`,
              width: `${complete * 20}%`, transition: "width 0.5s ease" }}/>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {AGENTS.map((agent, idx) => {
              const st   = agentStates[agent.key];
              const Icon = agent.icon;
              const timeTaken = st.status === "complete" && st.startedAt && st.completedAt
                ? ((st.completedAt - st.startedAt) / 1000).toFixed(1) : null;

              return (
                <div key={agent.id}>
                  <div data-testid={`agent-row-${agent.key}`} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: st.status === "running" ? `${agent.color}08` : CARD2,
                    border: `1px solid ${st.status === "running" ? agent.color : st.status === "complete" ? `${GREEN}30` : BORDER}`,
                    borderRadius: 10, padding: "10px 12px",
                    boxShadow: st.status === "running" ? `0 0 12px ${agent.color}18` : "none",
                    transition: "all 0.3s" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7,
                      background: st.status === "idle" ? `${TEXT2}10` : `${agent.color}18`,
                      border: `1px solid ${st.status === "idle" ? TEXT2 : agent.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {st.status === "running"  ? <Activity size={13} color={AMBER}/>
                        : st.status === "complete" ? <CheckCircle2 size={13} color={GREEN}/>
                        : st.status === "error"    ? <AlertCircle size={13} color={RED}/>
                        : <Icon size={13} color={TEXT2}/>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: st.status === "idle" ? TEXT2 : TEXT1, fontSize: 11, fontWeight: 700 }}>
                        Agent {agent.id} — {agent.name}
                      </div>
                      <div style={{ color: TEXT2, fontSize: 10, marginTop: 1 }}>
                        {st.status === "running"  ? agent.msg
                          : st.status === "complete" ? `Completed in ${timeTaken}s`
                          : st.status === "idle"     ? "Awaiting prior agent…" : "Error"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      {badge(st.status, st.status === "running" ? AMBER : st.status === "complete" ? GREEN : TEXT2)}
                      {timeTaken && <span style={{ color: TEXT2, fontSize: 9 }}>{timeTaken}s</span>}
                      {st.status === "running" && (st.elapsed ?? 0) > 0 && (
                        <span style={{ color: AMBER, fontSize: 9 }}>{st.elapsed}s…</span>
                      )}
                    </div>
                  </div>
                  {idx < AGENTS.length - 1 && (
                    <div style={{ display: "flex", justifyContent: "center", margin: "2px 0" }}>
                      <div style={{ width: 1, height: 8, background: BORDER }}/>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live feeds */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Entity stream */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <CircleDot size={11} color={TEAL}/>
              <span style={{ color: TEXT1, fontSize: 11, fontWeight: 700 }}>Entity Extraction</span>
              {agentStates.ingestion?.status === "running" && (
                <span style={{ color: AMBER, fontSize: 9 }}>● LIVE</span>
              )}
            </div>
            <div style={{ minHeight: 100, maxHeight: 160, overflowY: "auto" }}>
              {liveEntities.length === 0 ? (
                <div style={{ color: `${TEXT2}50`, fontSize: 11, textAlign: "center", padding: "20px 0" }}>
                  Awaiting Agent 1…
                </div>
              ) : liveEntities.map((e: any, i: number) => (
                <div key={i} data-testid={`entity-row-${i}`} style={{ display: "flex", gap: 7,
                  alignItems: "center", background: CARD2, borderRadius: 6, padding: "4px 9px", marginBottom: 4 }}>
                  <span style={{ color: TEAL, fontSize: 9, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>
                    {e.type}
                  </span>
                  <span style={{ color: TEXT1, fontSize: 10, fontWeight: 600, flex: 1 }}>{e.name}</span>
                  {e.role && <span style={{ color: TEXT2, fontSize: 9 }}>{e.role}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Risk signal feed */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <ShieldAlert size={11} color={RED}/>
              <span style={{ color: TEXT1, fontSize: 11, fontWeight: 700 }}>Risk Signal Feed</span>
              {agentStates.extraction?.status === "running" && (
                <span style={{ color: RED, fontSize: 9 }}>● LIVE</span>
              )}
            </div>
            <div style={{ minHeight: 100, maxHeight: 180, overflowY: "auto" }}>
              {liveRisks.length === 0 ? (
                <div style={{ color: `${TEXT2}50`, fontSize: 11, textAlign: "center", padding: "20px 0" }}>
                  Awaiting Agent 2…
                </div>
              ) : liveRisks.map((r: any, i: number) => (
                <div key={i} data-testid={`risk-row-${i}`} style={{ display: "flex", gap: 7,
                  alignItems: "flex-start", background: CARD2,
                  borderLeft: `3px solid ${SEV_COLOR[r.severity] || TEXT2}`,
                  borderRadius: "0 6px 6px 0", padding: "5px 9px", marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 2 }}>{badge(r.severity, SEV_COLOR[r.severity] || TEXT2)}</div>
                    <span style={{ color: TEXT2, fontSize: 10, lineHeight: 1.4 }}>{r.signal}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { IntelligenceViewInner };

export default function IntelligenceView() {
  return (
    <KiqProvider>
      <IntelligenceViewInner />
    </KiqProvider>
  );
}
