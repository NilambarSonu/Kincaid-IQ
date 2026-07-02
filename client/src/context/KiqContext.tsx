import { createContext, useContext, useState, useRef, ReactNode } from "react";

export type KiqMode   = "contract-xray" | "prior-auth" | "pe-diligence";
export type AgentStatus = "idle" | "running" | "complete" | "error";

export interface AgentState {
  status:       AgentStatus;
  output:       any;
  startedAt?:   number;
  completedAt?: number;
  elapsed?:     number;
}

export interface KiqState {
  mode:          KiqMode;
  content:       string;
  loading:       boolean;
  agentStates:   Record<string, AgentState>;
  finalResult:   any;
  liveEntities:  any[];
  liveRisks:     any[];
  setMode:       (m: KiqMode) => void;
  setContent:    (s: string) => void;
  runPipeline:   () => Promise<void>;
  reset:         () => void;
}

const AGENT_KEYS = ["ingestion", "extraction", "economic", "prioritization", "validation"];
const BLANK_STATES = () =>
  Object.fromEntries(AGENT_KEYS.map(k => [k, { status: "idle" as AgentStatus, output: null }]));

const MODE_ENDPOINT: Record<KiqMode, string> = {
  "contract-xray": "/api/kiq-engine/contract-xray/stream",
  "prior-auth":    "/api/kiq-engine/prior-auth-intelligence/stream",
  "pe-diligence":  "/api/kiq-engine/pe-diligence/stream",
};

const KiqCtx = createContext<KiqState | null>(null);

export function KiqProvider({ children }: { children: ReactNode }) {
  const [mode,         setMode]         = useState<KiqMode>("contract-xray");
  const [content,      setContent]      = useState("");
  const [loading,      setLoading]      = useState(false);
  const [agentStates,  setAgentStates]  = useState<Record<string, AgentState>>(BLANK_STATES());
  const [finalResult,  setFinalResult]  = useState<any>(null);
  const [liveEntities, setLiveEntities] = useState<any[]>([]);
  const [liveRisks,    setLiveRisks]    = useState<any[]>([]);
  const timerRefs  = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const startTsRef = useRef<Record<string, number>>({});

  function markAgent(key: string, patch: Partial<AgentState>) {
    setAgentStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function startElapsedTimer(agentKey: string) {
    startTsRef.current[agentKey] = Date.now();
    timerRefs.current[agentKey]  = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTsRef.current[agentKey]) / 1000);
      markAgent(agentKey, { elapsed });
    }, 1000);
  }

  function stopElapsedTimer(agentKey: string) {
    if (timerRefs.current[agentKey]) {
      clearInterval(timerRefs.current[agentKey]);
      delete timerRefs.current[agentKey];
    }
  }

  function reset() {
    setAgentStates(BLANK_STATES());
    setFinalResult(null);
    setLiveEntities([]);
    setLiveRisks([]);
    setContent("");
    setLoading(false);
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current = {};
  }

  async function runPipeline() {
    if (content.trim().length < 20 || loading) return;
    reset();
    setLoading(true);

    try {
      const endpoint = MODE_ENDPOINT[mode];
      const res = await fetch(endpoint, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [{ type: "general", content: content.trim() }],
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.trim().split("\n");
          const eventLine = lines.find(l => l.startsWith("event:"));
          const dataLine  = lines.find(l => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace("event:", "").trim();
          let   data: any;
          try { data = JSON.parse(dataLine.replace("data:", "").trim()); }
          catch { continue; }

          if (event === "agent_start") {
            const key = AGENT_KEYS[(data.agent ?? 1) - 1];
            markAgent(key, { status: "running", startedAt: Date.now() });
            startElapsedTimer(key);
          }

          if (event === "agent_complete") {
            const key = AGENT_KEYS[(data.agent ?? 1) - 1];
            stopElapsedTimer(key);
            markAgent(key, { status: "complete", completedAt: Date.now(), output: data.output });

            if (key === "ingestion") {
              const entities = data.output?.entities ?? [];
              setLiveEntities(entities);
            }
            if (key === "extraction") {
              const sigs = data.output?.risk_signals ?? [];
              setLiveRisks(
                sigs.map((s: any) => typeof s === "string"
                  ? { severity: "ELEVATED", signal: s }
                  : s)
              );
            }
          }

          if (event === "pipeline_complete") {
            setFinalResult(data);
            setLoading(false);
          }

          if (event === "error") {
            setLoading(false);
            AGENT_KEYS.forEach(k => {
              setAgentStates(prev =>
                prev[k].status === "running"
                  ? { ...prev, [k]: { ...prev[k], status: "error" } }
                  : prev
              );
            });
          }
        }
      }
    } catch (err) {
      console.error("[KIQ] pipeline error", err);
      setLoading(false);
    }
  }

  return (
    <KiqCtx.Provider value={{
      mode, content, loading, agentStates, finalResult, liveEntities, liveRisks,
      setMode, setContent, runPipeline, reset,
    }}>
      {children}
    </KiqCtx.Provider>
  );
}

export function useKiq(): KiqState {
  const ctx = useContext(KiqCtx);
  if (!ctx) throw new Error("useKiq must be used within <KiqProvider>");
  return ctx;
}
