import { useState, useRef, useEffect } from "react";
import {
  Brain, Zap, CheckCircle2, AlertCircle, FileText, DollarSign, Target,
  ShieldAlert, TrendingUp, Lock, RotateCcw, Upload, ChevronRight,
  Activity, BarChart3, ArrowRight, Cpu, Download, FileDown,
  Building2, Pill, Search, CircleDot, Layers, Crown, FlaskConical,
  Play, ShieldCheck, Stethoscope, BarChart2, Eye, EyeOff,
  ChevronDown, ChevronUp, Map, AlertTriangle, Lightbulb, Users,
  GitBranch, Maximize2, Swords, Flame, ScanSearch, TrendingDown,
  Scale, Calculator,
} from "lucide-react";
import { SAMPLE_BY_MODE, KiqSample } from "@/lib/kiqSamples";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const BG       = "#05070a";
const NAVY     = "#0b1220";
const GLASS    = "rgba(255,255,255,0.06)";
const GLASS2   = "rgba(10,14,42,0.92)";
const BORDER   = "rgba(255,255,255,0.10)";
const GLOW_B   = "rgba(100,150,255,0.15)";
const TEXT1    = "#e8eeff";
const TEXT2    = "#6b7fb5";
const TEXT3    = "#3d4d7a";
const ACCENT   = "#4f7dff";
const GREEN    = "#22c55e";
const AMBER    = "#f59e0b";
const RED      = "#ef4444";
const ROSE     = "#9B1C2E";
const TEAL     = "#06b6d4";
const PURPLE   = "#8b5cf6";
const CRIMSON  = "#be123c";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode        = "contract-xray" | "prior-auth" | "pe-diligence";
type AgentStatus = "idle" | "running" | "complete" | "error";
type RightTab    = "map" | "leakage" | "erisa" | "recs";

interface AgentState {
  status:      AgentStatus;
  output:      any;
  startedAt?:  number;
  completedAt?: number;
  elapsed?:    number;
}

interface KiqCase {
  id:      string;
  name:    string;
  sub:     string;
  mode:    Mode;
  icon:    any;
  color:   string;
  bullets: string[];
  tag:     string;
}

// ─── Intelligence Cases ───────────────────────────────────────────────────────
const CASES: KiqCase[] = [
  {
    id:      "midwest",
    name:    "Midwest Health Systems",
    sub:     "PBM Contract + GLP-1 Exposure",
    mode:    "contract-xray",
    icon:    Building2,
    color:   TEAL,
    bullets: ["50,000 member plan","GLP-1 formulary restriction","Non-guaranteed rebate structure","Audit rights: 24-month cap"],
    tag:     "PBM-GLP1-2026-A1",
  },
  {
    id:      "nationalcare",
    name:    "NationalCare PBM",
    sub:     "Prior Authorization Analysis",
    mode:    "prior-auth",
    icon:    Pill,
    color:   PURPLE,
    bullets: ["27% GLP-1 denial rate","62% appeal win rate","Step therapy bottleneck","3 active PA disputes"],
    tag:     "PA-NationalCare-GLP1",
  },
  {
    id:      "pe-target",
    name:    "PE Due Diligence Target",
    sub:     "Multi-Employer Operator Risk",
    mode:    "pe-diligence",
    icon:    Target,
    color:   AMBER,
    bullets: ["82,000 lives across 2 employers","GLP-1 + Specialty Oncology","2 PBMs: NationalCare + PrimeHealth","$70.3M annual Rx exposure"],
    tag:     "PE-MULTI-82K-2026",
  },
];

// ─── Pipeline Agents ──────────────────────────────────────────────────────────
const AGENTS = [
  { id:1, key:"ingestion",      name:"Ingestion Layer",        icon:FileText,    color:TEAL,     msg:"Parsing contract…" },
  { id:2, key:"extraction",     name:"Intelligence Extraction", icon:Brain,       color:PURPLE,   msg:"Extracting rebate logic…" },
  { id:3, key:"economic",       name:"Economic Impact Model",   icon:DollarSign,  color:AMBER,    msg:"Mapping financial exposure…" },
  { id:4, key:"prioritization", name:"Decision Prioritization", icon:TrendingUp,  color:ACCENT,   msg:"Ranking fiduciary actions…" },
  { id:5, key:"validation",     name:"Fiduciary Validation",    icon:ShieldAlert, color:GREEN,    msg:"Validating ERISA compliance…" },
  { id:6, key:"council",        name:"Elite Council (×7)",      icon:Users,       color:"#a78bfa",msg:"Stanford · Yale · Harvard · Chicago — running in parallel…" },
  { id:7, key:"synthesis",      name:"Orchestrator Synthesis",  icon:Cpu,         color:ROSE,     msg:"Synthesizing unified system model…" },
];

const BLANK_STATES = () =>
  Object.fromEntries(AGENTS.map(a => [a.key, { status: "idle" as AgentStatus, output: null }]));

const SEV_COLOR: Record<string,string> = { HIGH:RED, ELEVATED:AMBER, MODERATE:PURPLE, LOW:GREEN };
const URG_COLOR: Record<string,string> = { IMMEDIATE:RED, "48H":AMBER, "7_DAYS":PURPLE, "30_DAYS":TEAL, STRATEGIC:ACCENT };

const LENS_LABELS: Record<string,string> = {
  system_architect: "Stanford · Systems Architect",
  systems_engineer: "Yale · Systems Engineer",
  architect:        "Notre Dame · Master Architect",
  philosopher:      "Harvard · Philosopher",
  clinical:         "HMS · Clinical Strategist",
  erisa:            "HLS · ERISA Attorney",
  economist:        "Chicago · Economist",
};

function fmt(n: number | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n/1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function badge(label: string, color: string, sz = 9) {
  return (
    <span style={{ background:`${color}18`, color, border:`1px solid ${color}28`,
      borderRadius:20, padding:"2px 8px", fontSize:sz, fontWeight:800, letterSpacing:0.3,
      textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>
      {label}
    </span>
  );
}

// ─── Pipeline Stage Map ───────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  {
    id:      "parse",
    label:   "PARSE",
    sub:     "Ingest & tokenize",
    agents:  ["ingestion"],
    color:   TEAL,
    icon:    "⬡",
  },
  {
    id:      "structure",
    label:   "STRUCTURE",
    sub:     "Extract signals",
    agents:  ["extraction"],
    color:   PURPLE,
    icon:    "⬡",
  },
  {
    id:      "analyze",
    label:   "ANALYZE",
    sub:     "Model exposure",
    agents:  ["economic","prioritization"],
    color:   AMBER,
    icon:    "⬡",
  },
  {
    id:      "score",
    label:   "SCORE",
    sub:     "Validate & council",
    agents:  ["validation","council"],
    color:   RED,
    icon:    "⬡",
  },
  {
    id:      "output",
    label:   "OUTPUT",
    sub:     "Synthesize verdict",
    agents:  ["synthesis"],
    color:   ROSE,
    icon:    "⬡",
  },
];

// ─── Keyframe CSS ─────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.18);opacity:0.3} }
  @keyframes glow-throb { 0%,100%{opacity:0.7} 50%{opacity:1} }
  @keyframes flow-dash  { to{stroke-dashoffset:-24} }
  @keyframes float-up   { 0%{transform:translateY(0);opacity:0.6} 100%{transform:translateY(-40px);opacity:0} }
  @keyframes scan-line  { 0%{top:0%} 100%{top:100%} }
  @keyframes fade-in    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes node-appear{ from{opacity:0;transform:scale(0.6)} to{opacity:1;transform:scale(1)} }
  @keyframes crimson-pulse{ 0%,100%{box-shadow:0 0 0 0 ${ROSE}40} 60%{box-shadow:0 0 0 12px ${ROSE}00} }
  @keyframes stage-enter  { from{opacity:0;transform:scale(0.9) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes connector-flow { 0%{stroke-dashoffset:32} 100%{stroke-dashoffset:0} }
  @keyframes data-packet { 0%{offset-distance:0%} 100%{offset-distance:100%} }
`;

// ─── Pipeline Flow Strip ──────────────────────────────────────────────────────
function PipelineFlow({ agentStates }: { agentStates: Record<string, AgentState> }) {
  function stageStatus(stage: typeof PIPELINE_STAGES[0]) {
    const statuses = stage.agents.map(k => agentStates[k]?.status || "idle");
    if (statuses.every(s => s === "complete"))  return "complete";
    if (statuses.some(s => s === "running"))    return "running";
    if (statuses.some(s => s === "complete"))   return "partial";
    return "idle";
  }

  return (
    <div style={{ width:"100%", padding:"14px 0 10px", position:"relative" }}>
      {/* Label */}
      <div style={{ color:TEXT3, fontSize:8, fontWeight:800, textTransform:"uppercase",
        letterSpacing:1.4, marginBottom:12, textAlign:"center" }}>
        Intelligence Pipeline
      </div>

      {/* Main flow row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0 }}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const st = stageStatus(stage);
          const isLast = idx === PIPELINE_STAGES.length - 1;
          const isRunning  = st === "running";
          const isComplete = st === "complete" || st === "partial";
          const nodeColor  = isComplete || isRunning ? stage.color : TEXT3;
          const bgColor    = isRunning   ? `${stage.color}18`
                           : isComplete  ? `${stage.color}10`
                           : `${TEXT3}08`;

          return (
            <div key={stage.id} style={{ display:"flex", alignItems:"center" }}>
              {/* Stage node */}
              <div data-testid={`stage-${stage.id}`}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                  animation: isRunning ? "stage-enter 0.4s ease" : "none" }}>

                {/* Hex node */}
                <div style={{ position:"relative", width:52, height:52,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>

                  {/* Outer glow ring when running */}
                  {isRunning && (
                    <div style={{ position:"absolute", inset:-5, borderRadius:"50%",
                      border:`1px solid ${stage.color}50`,
                      animation:"pulse-ring 1.4s ease-in-out infinite" }}/>
                  )}

                  {/* Main node circle */}
                  <div style={{ width:44, height:44, borderRadius:"50%",
                    background: bgColor,
                    border:`1.5px solid ${isRunning || isComplete ? stage.color : `${TEXT3}25`}`,
                    display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", gap:1, transition:"all 0.4s ease",
                    boxShadow: isRunning  ? `0 0 20px ${stage.color}50, 0 0 40px ${stage.color}20`
                               : isComplete ? `0 0 10px ${stage.color}30`
                               : "none" }}>

                    {/* Status indicator dot */}
                    <div style={{ width:5, height:5, borderRadius:"50%",
                      background: isComplete ? GREEN : isRunning ? stage.color : `${TEXT3}40`,
                      boxShadow: isRunning ? `0 0 6px ${stage.color}` : isComplete ? `0 0 4px ${GREEN}` : "none",
                      animation: isRunning ? "glow-throb 0.7s ease-in-out infinite" : "none",
                      transition:"all 0.3s" }}/>

                    <div style={{ color: nodeColor, fontSize:8, fontWeight:900,
                      letterSpacing:0.4, lineHeight:1, transition:"color 0.3s" }}>
                      {stage.label}
                    </div>
                  </div>
                </div>

                {/* Sub-label */}
                <div style={{ color: isRunning ? stage.color : isComplete ? `${stage.color}90` : TEXT3,
                  fontSize:7.5, fontWeight:700, textAlign:"center", whiteSpace:"nowrap",
                  letterSpacing:0.2, transition:"color 0.3s" }}>
                  {stage.sub}
                </div>
              </div>

              {/* Connector arrow between stages */}
              {!isLast && (() => {
                const nextSt   = stageStatus(PIPELINE_STAGES[idx+1]);
                const flowActive = st === "complete" || (st === "running");
                const connColor  = flowActive ? stage.color : `${TEXT3}20`;
                return (
                  <div style={{ display:"flex", alignItems:"center", paddingBottom:20, margin:"0 2px" }}>
                    <svg width="36" height="16" viewBox="0 0 36 16" style={{ overflow:"visible" }}>
                      {/* Background line */}
                      <line x1="0" y1="8" x2="28" y2="8"
                        stroke={`${TEXT3}20`} strokeWidth="1.5"/>
                      {/* Active flow line */}
                      <line x1="0" y1="8" x2="28" y2="8"
                        stroke={connColor}
                        strokeWidth={flowActive ? 1.5 : 0}
                        strokeDasharray="4 4"
                        style={flowActive ? { animation:"flow-dash 0.5s linear infinite" } : {}}
                        opacity={flowActive ? 1 : 0}
                      />
                      {/* Arrow head */}
                      <polyline points="24,4 30,8 24,12"
                        fill="none"
                        stroke={connColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Core Engines ─────────────────────────────────────────────────────────────
const CORE_ENGINES_DEF = [
  {
    id:     "clause",
    label:  "Clause Detection",
    sub:    "Contract clause parser",
    icon:   ScanSearch,
    color:  PURPLE,
    agents: ["extraction"],
  },
  {
    id:     "pricing",
    label:  "Pricing Anomaly",
    sub:    "Spread & leakage scanner",
    icon:   TrendingDown,
    color:  AMBER,
    agents: ["economic"],
  },
  {
    id:     "erisa",
    label:  "ERISA Rule Engine",
    sub:    "§§ 402–408 enforcer",
    icon:   Scale,
    color:  RED,
    agents: ["validation"],
  },
  {
    id:     "model",
    label:  "Financial Model",
    sub:    "Dollar exposure calculator",
    icon:   Calculator,
    color:  TEAL,
    agents: ["economic", "prioritization"],
  },
];

function CoreEngines({ agentStates }: { agentStates: Record<string, AgentState> }) {
  function engineStatus(eng: typeof CORE_ENGINES_DEF[0]) {
    const statuses = eng.agents.map(k => agentStates[k]?.status || "idle");
    if (statuses.every(s => s === "complete")) return "complete";
    if (statuses.some(s => s === "running"))   return "running";
    return "idle";
  }

  return (
    <div style={{ width:"100%", marginBottom:4 }}>
      <div style={{ color:TEXT3, fontSize:8, fontWeight:800, textTransform:"uppercase",
        letterSpacing:1.4, marginBottom:8, textAlign:"center" }}>
        Core Engines
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6 }}>
        {CORE_ENGINES_DEF.map(eng => {
          const Icon = eng.icon;
          const st   = engineStatus(eng);
          const isRunning  = st === "running";
          const isComplete = st === "complete";
          const col = isRunning || isComplete ? eng.color : TEXT3;
          return (
            <div key={eng.id} data-testid={`engine-${eng.id}`}
              style={{ background: isRunning ? `${eng.color}12` : isComplete ? `${eng.color}08` : `${NAVY}40`,
                border:`1px solid ${isRunning || isComplete ? `${eng.color}35` : `${TEXT3}18`}`,
                borderRadius:10, padding:"10px 8px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                transition:"all 0.4s ease",
                boxShadow: isRunning  ? `0 0 16px ${eng.color}30, inset 0 1px 0 ${eng.color}15`
                           : isComplete ? `0 0 8px ${eng.color}15` : "none",
                animation: isRunning ? "stage-enter 0.3s ease" : "none" }}>

              {/* Icon with glow */}
              <div style={{ width:28, height:28, borderRadius:8,
                background: isRunning ? `${eng.color}20` : isComplete ? `${eng.color}12` : `${TEXT3}10`,
                border:`1px solid ${isRunning || isComplete ? `${eng.color}30` : `${TEXT3}18`}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: isRunning ? `0 0 10px ${eng.color}40` : "none",
                animation: isRunning ? "glow-throb 0.8s ease-in-out infinite" : "none",
                transition:"all 0.3s" }}>
                <Icon size={12} color={col}/>
              </div>

              {/* Label */}
              <div style={{ color:col, fontSize:8, fontWeight:800, textAlign:"center",
                lineHeight:1.3, letterSpacing:0.2, transition:"color 0.3s" }}>
                {eng.label}
              </div>

              {/* Status pill */}
              <div style={{ background: isRunning ? `${eng.color}20` : isComplete ? `${GREEN}15` : `${TEXT3}10`,
                border:`1px solid ${isRunning ? `${eng.color}40` : isComplete ? `${GREEN}30` : `${TEXT3}15`}`,
                borderRadius:4, padding:"1px 6px",
                color: isRunning ? eng.color : isComplete ? GREEN : TEXT3,
                fontSize:7, fontWeight:800, letterSpacing:0.4,
                animation: isRunning ? "glow-throb 0.8s infinite" : "none" }}>
                {isRunning ? "ACTIVE" : isComplete ? "DONE" : "STANDBY"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Engine SVG Visualization ─────────────────────────────────────────────────
function EngineViz({ agentStates, running }: { agentStates: Record<string, AgentState>; running: boolean }) {
  const cx = 200, cy = 200, R = 130;
  const nodeCount = 7;

  // compute positions on a circle
  const nodes = AGENTS.map((a, i) => {
    const angle = (i / nodeCount) * Math.PI * 2 - Math.PI / 2;
    return {
      ...a,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      state: agentStates[a.key] || { status:"idle", output:null },
    };
  });

  function nodeGlow(s: AgentStatus, color: string) {
    if (s === "running")  return `0 0 0 2px ${color}60, 0 0 18px ${color}80, 0 0 36px ${color}30`;
    if (s === "complete") return `0 0 0 2px ${color}40, 0 0 10px ${color}40`;
    return "none";
  }

  function lineColor(s: AgentStatus, color: string) {
    if (s === "running")  return color;
    if (s === "complete") return `${color}80`;
    return `${color}18`;
  }

  return (
    <svg width="400" height="400" viewBox="0 0 400 400" style={{ overflow:"visible" }}>
      <defs>
        <radialGradient id="core-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={ROSE} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={ROSE} stopOpacity="0"/>
        </radialGradient>
        <filter id="glow-f" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background radial field */}
      <circle cx={cx} cy={cy} r={R+40} fill="url(#core-grad)" opacity="0.5"/>

      {/* Orbit rings */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`${TEXT3}30`} strokeWidth="0.5" strokeDasharray="3 8"/>
      <circle cx={cx} cy={cy} r={R*0.5} fill="none" stroke={`${TEXT3}20`} strokeWidth="0.5" strokeDasharray="2 12"/>

      {/* Connection lines from center to each node */}
      {nodes.map((n) => {
        const s = n.state.status;
        const col = lineColor(s, n.color);
        return (
          <line key={n.id}
            x1={cx} y1={cy} x2={n.x} y2={n.y}
            stroke={col}
            strokeWidth={s === "running" ? 1.5 : 0.8}
            strokeDasharray={s === "running" ? "4 6" : s === "complete" ? "none" : "2 10"}
            style={s === "running" ? { animation:"flow-dash 0.6s linear infinite" } : {}}
          />
        );
      })}

      {/* Data flow particles for running agents */}
      {nodes.filter(n => n.state.status === "running").map((n) => {
        const pct = 0.5;
        return (
          <circle key={`p-${n.id}`}
            cx={cx + (n.x - cx)*pct} cy={cy + (n.y - cy)*pct}
            r={2.5} fill={n.color} opacity={0.8}
            style={{ animation:`glow-throb 0.8s ease-in-out infinite` }}
          />
        );
      })}

      {/* Agent nodes */}
      {nodes.map((n) => {
        const s = n.state.status;
        const Icon = n.icon;
        return (
          <g key={n.id} filter={s === "running" ? "url(#glow-f)" : ""}>
            {s === "running" && (
              <circle cx={n.x} cy={n.y} r={22}
                fill="none" stroke={n.color} strokeWidth="1"
                opacity="0.5"
                style={{ animation:"pulse-ring 1.2s ease-in-out infinite" }}
              />
            )}
            <circle cx={n.x} cy={n.y} r={16}
              fill={s === "idle" ? `${NAVY}` : s === "running" ? `${n.color}22` : `${n.color}18`}
              stroke={s === "idle" ? `${TEXT3}50` : n.color}
              strokeWidth={s === "running" ? 1.5 : 1}
            />
            {/* Status indicator */}
            {s === "complete" && (
              <circle cx={n.x+11} cy={n.y-11} r={5} fill={GREEN}/>
            )}
            {s === "running" && (
              <circle cx={n.x+11} cy={n.y-11} r={5} fill={AMBER}
                style={{ animation:"glow-throb 0.6s ease-in-out infinite" }}
              />
            )}
            {/* ID label */}
            <text x={n.x} y={n.y+4} textAnchor="middle"
              fill={s === "idle" ? TEXT3 : TEXT1} fontSize="9" fontWeight="700">
              {n.id}
            </text>
            {/* Name below */}
            <text x={n.x} y={n.y+30} textAnchor="middle"
              fill={s === "idle" ? TEXT3 : s === "running" ? n.color : `${n.color}a0`}
              fontSize="7.5" fontWeight="700">
              {n.name.split(" ")[0]}
            </text>
          </g>
        );
      })}

      {/* Central Core node */}
      {running && (
        <circle cx={cx} cy={cy} r={44}
          fill="none" stroke={ROSE} strokeWidth="1"
          opacity="0.4"
          style={{ animation:"pulse-ring 2s ease-in-out infinite" }}
        />
      )}
      <circle cx={cx} cy={cy} r={34}
        fill={NAVY}
        stroke={running ? ROSE : `${TEXT3}40`}
        strokeWidth={running ? 1.5 : 1}
      />
      <text x={cx} y={cy-6} textAnchor="middle" fill={TEXT1} fontSize="8" fontWeight="900" letterSpacing="0.5">KIQ</text>
      <text x={cx} y={cy+6} textAnchor="middle" fill={TEXT1} fontSize="8" fontWeight="900" letterSpacing="0.5">CORE</text>
      <text x={cx} y={cy+18} textAnchor="middle" fill={running ? ROSE : TEXT3} fontSize="6.5" fontWeight="700">
        {running ? "ACTIVE" : "STANDBY"}
      </text>
    </svg>
  );
}

// ─── Left Panel — Input ────────────────────────────────────────────────────────
function LeftPanel({ selectedCase, setSelectedCase, content, setContent, onRun, running,
  dominanceMode, setDominanceMode }:
  { selectedCase: KiqCase|null; setSelectedCase:(c:KiqCase)=>void;
    content:string; setContent:(s:string)=>void; onRun:()=>void; running:boolean;
    dominanceMode:boolean; setDominanceMode:(v:boolean)=>void }) {

  function selectCase(c: KiqCase) {
    setSelectedCase(c);
    const s = SAMPLE_BY_MODE[c.mode];
    if (s) setContent(s.content);
  }

  const ready = !!selectedCase && content.trim().length >= 20 && !running;

  return (
    <div style={{ width:260, flexShrink:0, display:"flex", flexDirection:"column", gap:10, height:"100%" }}>
      {/* Header */}
      <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 16px",
        backdropFilter:"blur(12px)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:ROSE,
            boxShadow:`0 0 8px ${ROSE}`, animation:"glow-throb 2s infinite" }}/>
          <span style={{ color:ROSE, fontSize:9, fontWeight:900, letterSpacing:1.2,
            textTransform:"uppercase" }}>KIQ Intelligence Engine™</span>
        </div>
        <div style={{ color:TEXT2, fontSize:10, fontWeight:600 }}>
          7-Agent Fiduciary Pipeline · Elite Council OS
        </div>
      </div>

      {/* Case selection */}
      <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 16px",
        backdropFilter:"blur(12px)", flex:1, overflowY:"auto" }}>
        <div style={{ color:TEXT2, fontSize:9, fontWeight:800, textTransform:"uppercase",
          letterSpacing:0.8, marginBottom:12 }}>Select Intelligence Case</div>

        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {CASES.map(c => {
            const Icon = c.icon;
            const active = selectedCase?.id === c.id;
            return (
              <button key={c.id}
                data-testid={`button-case-${c.id}`}
                onClick={() => !running && selectCase(c)}
                style={{ background: active ? `${c.color}12` : `${NAVY}80`,
                  border:`1px solid ${active ? c.color : BORDER}`,
                  borderRadius:10, padding:"10px 12px", cursor:running?"not-allowed":"pointer",
                  textAlign:"left", transition:"all 0.2s",
                  boxShadow: active ? `0 0 16px ${c.color}25` : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:`${c.color}18`,
                    border:`1px solid ${c.color}30`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Icon size={11} color={c.color}/>
                  </div>
                  <div>
                    <div style={{ color:TEXT1, fontSize:10, fontWeight:800, lineHeight:1.2 }}>{c.name}</div>
                    <div style={{ color:c.color, fontSize:8.5, fontWeight:700 }}>{c.tag}</div>
                  </div>
                </div>
                <div style={{ color:TEXT2, fontSize:9, marginBottom:6 }}>{c.sub}</div>
                {active && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                    {c.bullets.map((b,i) => (
                      <span key={i} style={{ background:`${c.color}10`, color:c.color,
                        border:`1px solid ${c.color}20`, borderRadius:4, padding:"1px 6px", fontSize:8 }}>
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Input area */}
        <div style={{ marginTop:14 }}>
          <div style={{ color:TEXT2, fontSize:9, fontWeight:800, textTransform:"uppercase",
            letterSpacing:0.8, marginBottom:8 }}>Document Input</div>
          <textarea
            data-testid="input-document-content"
            value={content}
            onChange={e => !running && setContent(e.target.value)}
            placeholder="Paste contract text, claims data, or PA logs…"
            style={{ width:"100%", minHeight:100, background:`${NAVY}80`,
              border:`1px solid ${BORDER}`, borderRadius:8, color:TEXT1,
              fontSize:9.5, padding:"10px 12px", resize:"vertical",
              fontFamily:"'Courier New', monospace", lineHeight:1.6,
              boxSizing:"border-box", outline:"none" }}
          />
          {selectedCase && content.trim().length > 20 && (
            <div style={{ color:GREEN, fontSize:8.5, marginTop:4, display:"flex", gap:4, alignItems:"center" }}>
              <CheckCircle2 size={9}/> {(content.trim().length/1000).toFixed(1)}K chars loaded
            </div>
          )}
        </div>
      </div>

      {/* Weaponized Output Toggle */}
      <button
        data-testid="button-dominance-mode"
        onClick={() => !running && setDominanceMode(!dominanceMode)}
        style={{ width:"100%", padding:"11px 14px",
          background: dominanceMode
            ? `linear-gradient(135deg, ${CRIMSON}22, #1a0008)`
            : `${TEXT3}08`,
          border:`1.5px solid ${dominanceMode ? CRIMSON : `${TEXT3}25`}`,
          borderRadius:12, cursor:running?"not-allowed":"pointer",
          display:"flex", alignItems:"center", gap:10, transition:"all 0.25s",
          boxShadow: dominanceMode ? `0 0 24px ${CRIMSON}30, inset 0 1px 0 ${CRIMSON}15` : "none",
          animation: dominanceMode ? "crimson-pulse 3s infinite" : "none" }}>
        <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
          background: dominanceMode ? `${CRIMSON}25` : `${TEXT3}12`,
          border:`1px solid ${dominanceMode ? `${CRIMSON}50` : `${TEXT3}20`}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow: dominanceMode ? `0 0 12px ${CRIMSON}50` : "none",
          transition:"all 0.3s" }}>
          <Swords size={13} color={dominanceMode ? CRIMSON : TEXT3}/>
        </div>
        <div style={{ flex:1, textAlign:"left" }}>
          <div style={{ color: dominanceMode ? CRIMSON : TEXT3,
            fontSize:10, fontWeight:900, letterSpacing:0.6,
            textTransform:"uppercase", lineHeight:1.2 }}>
            Weaponized Output
          </div>
          <div style={{ color: dominanceMode ? `${CRIMSON}80` : `${TEXT3}60`,
            fontSize:8, marginTop:2 }}>
            {dominanceMode ? "DOMINANCE MODE ACTIVE" : "Outperform Deloitte · Accenture · EY"}
          </div>
        </div>
        {/* Toggle indicator */}
        <div style={{ width:32, height:18, borderRadius:9, position:"relative", flexShrink:0,
          background: dominanceMode ? CRIMSON : `${TEXT3}25`,
          border:`1px solid ${dominanceMode ? CRIMSON : `${TEXT3}30`}`,
          transition:"background 0.25s",
          boxShadow: dominanceMode ? `0 0 8px ${CRIMSON}60` : "none" }}>
          <div style={{ position:"absolute", top:2, left: dominanceMode ? 15 : 2,
            width:12, height:12, borderRadius:"50%", background:"#fff",
            transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.4)" }}/>
        </div>
      </button>

      {/* Run Button */}
      <button
        data-testid="button-run-pipeline"
        onClick={onRun}
        disabled={!ready}
        style={{ width:"100%", height:48, background: ready
          ? dominanceMode
            ? `linear-gradient(135deg, ${CRIMSON}, ${ROSE})`
            : `linear-gradient(135deg, ${ROSE}, #c0392b)`
          : `${TEXT3}20`,
          border:`1px solid ${ready ? (dominanceMode ? CRIMSON : ROSE) : BORDER}`, borderRadius:12,
          color: ready ? "#fff" : TEXT3, fontSize:12, fontWeight:900,
          cursor: ready ? "pointer" : "not-allowed", letterSpacing:0.5,
          display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          transition:"all 0.2s",
          boxShadow: ready ? `0 0 20px ${dominanceMode ? CRIMSON : ROSE}40, 0 4px 20px ${dominanceMode ? CRIMSON : ROSE}25` : "none",
          animation: ready ? "crimson-pulse 2.5s infinite" : "none" }}>
        {running
          ? <><Activity size={14} style={{ animation:"glow-throb 0.6s infinite" }}/> RUNNING…</>
          : dominanceMode
          ? <><Swords size={14}/> DEPLOY INTELLIGENCE</>
          : <><Zap size={14}/> RUN INTELLIGENCE</>}
      </button>
    </div>
  );
}

// ─── Center Panel — Engine + Agent Progress ────────────────────────────────────
function CenterPanel({ agentStates, running, selectedCase, liveEntities, liveRisks, traceLines }:
  { agentStates:Record<string,AgentState>; running:boolean; selectedCase:KiqCase|null;
    liveEntities:any[]; liveRisks:any[]; traceLines:string[] }) {

  const complete = Object.values(agentStates).filter(s => s.status === "complete").length;
  const pct = (complete / 7) * 100;
  const activeAgent = AGENTS.find(a => agentStates[a.key]?.status === "running");

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, minWidth:0 }}>
      {/* Engine Viz Card */}
      <div style={{ background:GLASS, border:`1px solid ${running ? `${ROSE}30` : BORDER}`,
        borderRadius:16, padding:"18px 20px", backdropFilter:"blur(16px)",
        boxShadow: running ? `0 0 32px ${ROSE}12, inset 0 1px 0 rgba(255,255,255,0.05)` : "none",
        display:"flex", flexDirection:"column", alignItems:"center", position:"relative", overflow:"hidden" }}>

        {/* Scan line when running */}
        {running && (
          <div style={{ position:"absolute", left:0, right:0, height:1,
            background:`linear-gradient(90deg, transparent, ${ROSE}60, transparent)`,
            animation:"scan-line 2s linear infinite" }}/>
        )}

        {/* Case label */}
        {selectedCase && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, alignSelf:"flex-start" }}>
            {badge(selectedCase.tag, selectedCase.color, 8)}
            <span style={{ color:TEXT2, fontSize:9 }}>{selectedCase.name}</span>
          </div>
        )}

        {/* Pipeline flow: Parse → Structure → Analyze → Score → Output */}
        <PipelineFlow agentStates={agentStates}/>

        {/* Divider */}
        <div style={{ width:"100%", height:1, background:`linear-gradient(90deg, transparent, ${BORDER}, transparent)`,
          marginBottom:12 }}/>

        {/* Core Engines: Clause Detection | Pricing Anomaly | ERISA Rule Engine | Financial Model */}
        <CoreEngines agentStates={agentStates}/>

        {/* Divider */}
        <div style={{ width:"100%", height:1, background:`linear-gradient(90deg, transparent, ${BORDER}, transparent)`,
          margin:"8px 0" }}/>

        <EngineViz agentStates={agentStates} running={running}/>

        {/* Progress bar */}
        {(running || complete > 0) && (
          <div style={{ width:"100%", marginTop:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ color:TEXT2, fontSize:9, fontWeight:700 }}>
                {activeAgent ? activeAgent.name : complete === 7 ? "Analysis Complete" : "Initializing…"}
              </span>
              <span style={{ color:ROSE, fontSize:9, fontWeight:800 }}>{complete}/7</span>
            </div>
            <div style={{ height:3, background:`${TEXT3}30`, borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, borderRadius:4, transition:"width 0.6s ease",
                background:`linear-gradient(90deg, ${ROSE}, ${ACCENT})` }}/>
            </div>
            {activeAgent && (
              <div style={{ color:activeAgent.color, fontSize:8.5, marginTop:5, fontStyle:"italic" }}>
                {activeAgent.msg}
              </div>
            )}
          </div>
        )}

        {!running && complete === 0 && (
          <div style={{ color:TEXT3, fontSize:11, textAlign:"center", marginTop:8, fontWeight:600 }}>
            Select a case and run to activate the engine
          </div>
        )}
      </div>

      {/* Agent pipeline status */}
      <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:14,
        padding:"14px 16px", backdropFilter:"blur(12px)" }}>
        <div style={{ color:TEXT2, fontSize:9, fontWeight:800, textTransform:"uppercase",
          letterSpacing:0.8, marginBottom:10 }}>7-Agent Pipeline</div>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {AGENTS.map(a => {
            const s = agentStates[a.key] || { status:"idle", output:null };
            const Icon = a.icon;
            return (
              <div key={a.id} data-testid={`row-agent-${a.key}`}
                style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 8px",
                  background: s.status === "running" ? `${a.color}08` : "transparent",
                  border:`1px solid ${s.status === "running" ? `${a.color}25` : "transparent"}`,
                  borderRadius:7, transition:"all 0.3s",
                  animation: s.status === "running" ? "fade-in 0.3s ease" : "none" }}>
                <div style={{ width:20, height:20, borderRadius:5, flexShrink:0,
                  background: s.status === "idle" ? `${TEXT3}15` : `${a.color}15`,
                  border:`1px solid ${s.status === "idle" ? `${TEXT3}25` : a.color}30`,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon size={9} color={s.status === "idle" ? TEXT3 : a.color}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color: s.status === "idle" ? TEXT3 : s.status === "running" ? a.color : TEXT1,
                    fontSize:9.5, fontWeight:700, transition:"color 0.2s" }}>{a.name}</div>
                </div>
                {s.status === "running" && (
                  <div style={{ display:"flex", gap:2 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width:3, height:3, borderRadius:"50%", background:a.color,
                        animation:`glow-throb 0.6s ${i*0.2}s ease-in-out infinite` }}/>
                    ))}
                  </div>
                )}
                {s.status === "complete" && <CheckCircle2 size={10} color={GREEN}/>}
                {s.elapsed !== undefined && s.status === "running" && (
                  <span style={{ color:TEXT3, fontSize:8 }}>{s.elapsed}s</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live entity stream */}
      {liveEntities.length > 0 && (
        <div style={{ background:GLASS, border:`1px solid ${TEAL}20`, borderRadius:12,
          padding:"12px 14px", backdropFilter:"blur(12px)" }}>
          <div style={{ color:TEAL, fontSize:9, fontWeight:800, textTransform:"uppercase",
            letterSpacing:0.8, marginBottom:8 }}>Live Entity Stream</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {liveEntities.slice(0,16).map((e:any, i:number) => (
              <span key={i} style={{ background:`${TEAL}10`, color:TEAL, border:`1px solid ${TEAL}20`,
                borderRadius:4, padding:"2px 7px", fontSize:8.5, fontWeight:700,
                animation:"node-appear 0.3s ease" }}>
                {e.name || e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Live Agent Trace Feed */}
      {traceLines.length > 0 && (
        <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:12,
          padding:"12px 14px", backdropFilter:"blur(12px)" }}>
          <div style={{ color:TEXT2, fontSize:9, fontWeight:800, textTransform:"uppercase",
            letterSpacing:0.8, marginBottom:8 }}>Agent Trace</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {traceLines.map((line, i) => {
              const [agent, ...rest] = line.split(" → ");
              const msg = rest.join(" → ");
              const isLast = i === traceLines.length - 1;
              return (
                <div key={i} style={{ display:"flex", alignItems:"baseline", gap:8,
                  animation:"fade-in 0.3s ease", opacity: isLast ? 1 : 0.5 }}>
                  <span style={{ fontFamily:"'Orbitron', monospace", fontSize:8, fontWeight:800,
                    color: isLast ? ACCENT : TEXT3, letterSpacing:"0.06em", whiteSpace:"nowrap",
                    minWidth:140 }}>
                    {agent}
                  </span>
                  <span style={{ color:"#3d4d7a", fontSize:9 }}>→</span>
                  <span style={{ fontSize:9, color: isLast ? TEXT1 : TEXT2, letterSpacing:"0.01em" }}>
                    {msg}
                  </span>
                </div>
              );
            })}
            {running && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                <div style={{ display:"flex", gap:3 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ width:3, height:3, borderRadius:"50%",
                      background:ACCENT, display:"inline-block",
                      animation:`glow-throb 1s ${i*0.2}s ease-in-out infinite` }}/>
                  ))}
                </div>
                <span style={{ fontSize:8, color:TEXT3 }}>processing…</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Panel — Tabbed Results + Agent View ────────────────────────────────
function RightPanel({ result, agentStates, running, selectedCase, liveRisks, onReset, onExport }:
  { result:any; agentStates:Record<string,AgentState>; running:boolean;
    selectedCase:KiqCase|null; liveRisks:any[]; onReset:()=>void; onExport:()=>void }) {

  const [tab,         setTab]         = useState<RightTab>("map");
  const [agentView,   setAgentView]   = useState(false);
  const [expandedExp, setExpandedExp] = useState<string|null>(null);

  const a1 = agentStates.ingestion?.output      || {};
  const a2 = agentStates.extraction?.output     || {};
  const a3 = agentStates.economic?.output       || {};
  const a4 = agentStates.prioritization?.output || {};
  const a5 = agentStates.validation?.output     || {};
  const synthesis = result?.synthesis           || {};
  const councilSignals: any[] = result?.council?.council_signals || [];
  const complete = Object.values(agentStates).filter(s => s.status === "complete").length;

  const TABS: { key:RightTab; label:string; icon:any; color:string; count?:number }[] = [
    { key:"map",     label:"System Map",        icon:Map,          color:TEAL    },
    { key:"leakage", label:"Financial Leakage", icon:DollarSign,   color:AMBER   },
    { key:"erisa",   label:"ERISA Risk",        icon:ShieldAlert,  color:RED     },
    { key:"recs",    label:"Recommendations",   icon:Lightbulb,    color:ACCENT  },
  ];

  function Section({ title, color, children }: { title:string; color:string; children:any }) {
    return (
      <div style={{ marginBottom:14 }}>
        <div style={{ color, fontSize:9, fontWeight:800, textTransform:"uppercase",
          letterSpacing:0.8, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:12, height:1.5, background:color }}/>
          {title}
        </div>
        {children}
      </div>
    );
  }

  function EmptyState({ msg }: { msg:string }) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", height:200, gap:8 }}>
        <Activity size={20} color={TEXT3}/>
        <div style={{ color:TEXT3, fontSize:11, textAlign:"center" }}>{msg}</div>
      </div>
    );
  }

  // ── Tab: System Map ──────────────────────────────────────────────────────────
  function TabSystemMap() {
    const entities   = a1.entities        || [];
    const systemFrame = a1.system_frame   || "";
    const sysModel   = synthesis.unified_system_model || "";
    const findings   = a2.structural_findings || a2.key_findings || [];
    const hasData = entities.length || sysModel || findings.length;

    if (!hasData && !running)
      return <EmptyState msg="Run the pipeline to generate the system map"/>;
    return (
      <div style={{ animation:"fade-in 0.4s ease" }}>
        {sysModel && (
          <Section title="Unified System Model" color={TEAL}>
            <div style={{ background:`${TEAL}08`, border:`1px solid ${TEAL}18`,
              borderRadius:10, padding:"12px 14px" }}>
              <p style={{ color:TEXT1, fontSize:11, lineHeight:1.8, margin:0 }}>{sysModel}</p>
            </div>
          </Section>
        )}
        {systemFrame && !sysModel && (
          <Section title="System Frame" color={TEAL}>
            <p style={{ color:TEXT1, fontSize:11, lineHeight:1.8 }}>{systemFrame}</p>
          </Section>
        )}
        {findings.length > 0 && (
          <Section title="Structural Findings" color={PURPLE}>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {(findings as any[]).slice(0,8).map((f:any, i:number) => (
                <div key={i} style={{ background:`${PURPLE}08`, border:`1px solid ${PURPLE}18`,
                  borderRadius:8, padding:"9px 12px" }}>
                  <div style={{ color:TEXT1, fontSize:10, fontWeight:700, marginBottom:2 }}>
                    {f.title || f.finding || f}
                  </div>
                  {f.severity && (
                    <span style={{ color:SEV_COLOR[f.severity]||TEXT2, fontSize:8, fontWeight:800 }}>
                      {f.severity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
        {entities.length > 0 && (
          <Section title={`Extracted Entities (${entities.length})`} color={TEAL}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {entities.slice(0,24).map((e:any,i:number) => (
                <span key={i} style={{ background:`${TEAL}10`, color:TEAL, border:`1px solid ${TEAL}20`,
                  borderRadius:4, padding:"2px 8px", fontSize:8.5 }}>
                  {e.name || e}
                </span>
              ))}
            </div>
          </Section>
        )}
        {running && !hasData && (
          <div style={{ display:"flex", alignItems:"center", gap:8, color:TEXT2, fontSize:11 }}>
            <Activity size={14} style={{ animation:"glow-throb 0.8s infinite" }}/>
            Building system map…
          </div>
        )}
      </div>
    );
  }

  // ── Tab: Financial Leakage ───────────────────────────────────────────────────
  function TabFinancialLeakage() {
    const totalExposure  = a3.total_exposure  || a3.total_financial_exposure;
    const directCost     = a3.direct_cost     || a3.direct_waste;
    const downstreamCost = a3.downstream_cost || a3.downstream_medical_cost;
    const rebateLeak     = a3.rebate_leakage;
    const adminCost      = a3.admin_cost      || a3.denial_admin_cost;
    const economist      = councilSignals.find(s => s.lens === "economist");
    const hasData = totalExposure || directCost;

    if (!hasData && !running)
      return <EmptyState msg="Run the pipeline to model financial leakage"/>;
    return (
      <div style={{ animation:"fade-in 0.4s ease" }}>
        {totalExposure && (
          <div style={{ background:`linear-gradient(135deg, ${CRIMSON}12, ${ROSE}08)`,
            border:`1px solid ${ROSE}25`, borderRadius:14, padding:"16px 18px", marginBottom:14 }}>
            <div style={{ color:ROSE, fontSize:9, fontWeight:800, textTransform:"uppercase",
              letterSpacing:0.8, marginBottom:6 }}>Total Financial Exposure</div>
            <div style={{ color:"#ff6b6b", fontSize:28, fontWeight:900,
              letterSpacing:"-0.04em" }}>{fmt(totalExposure)}</div>
            <div style={{ color:TEXT2, fontSize:9, marginTop:4 }}>Annual estimated leakage</div>
          </div>
        )}
        <Section title="Leakage Breakdown" color={AMBER}>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {[
              { label:"Direct Cost / Waste",      val:directCost,     color:RED    },
              { label:"Downstream Medical Cost",   val:downstreamCost, color:AMBER  },
              { label:"Rebate Leakage",            val:rebateLeak,     color:PURPLE },
              { label:"Admin / Denial Cost",       val:adminCost,      color:TEAL   },
            ].filter(r => r.val).map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"7px 10px", background:`${r.color}08`, border:`1px solid ${r.color}15`,
                borderRadius:8 }}>
                <span style={{ color:TEXT1, fontSize:10 }}>{r.label}</span>
                <span style={{ color:r.color, fontSize:11, fontWeight:900 }}>{fmt(r.val)}</span>
              </div>
            ))}
          </div>
        </Section>
        {economist && (
          <Section title="Chicago Economist Signal" color={AMBER}>
            <div style={{ background:`${AMBER}08`, border:`1px solid ${AMBER}20`,
              borderRadius:10, padding:"12px 14px" }}>
              <p style={{ color:TEXT1, fontSize:10, lineHeight:1.7, margin:"0 0 6px" }}>{economist.finding}</p>
              {economist.dollar_signal > 0 && (
                <span style={{ color:AMBER, fontSize:12, fontWeight:900 }}>{fmt(economist.dollar_signal)}</span>
              )}
              {economist.recommendation && (
                <p style={{ color:TEXT2, fontSize:9.5, lineHeight:1.6, margin:"8px 0 0" }}>
                  → {economist.recommendation}
                </p>
              )}
            </div>
          </Section>
        )}
        {(a3.waste_categories || []).length > 0 && (
          <Section title="Waste Categories" color={RED}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {a3.waste_categories.map((w:any, i:number) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between",
                  padding:"6px 10px", background:`${NAVY}60`, borderRadius:7 }}>
                  <span style={{ color:TEXT1, fontSize:9.5 }}>{w.category || w.name}</span>
                  {w.amount && <span style={{ color:RED, fontSize:9.5, fontWeight:800 }}>{fmt(w.amount)}</span>}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  // ── Tab: ERISA Risk ──────────────────────────────────────────────────────────
  function TabErisaRisk() {
    const riskSignals  = liveRisks.length ? liveRisks : (a2.risk_signals || []);
    const compGaps     = a5.compliance_gaps  || [];
    const authority    = a5.authority_basis  || a4.authority_basis || [];
    const eriasExpert  = councilSignals.find(s => s.lens === "erisa");
    const clinicalExp  = councilSignals.find(s => s.lens === "clinical");
    const quantRisks   = synthesis.quantified_risks || [];
    const hasData = riskSignals.length || compGaps.length || eriasExpert;

    if (!hasData && !running)
      return <EmptyState msg="Run the pipeline to analyze ERISA exposure"/>;
    return (
      <div style={{ animation:"fade-in 0.4s ease" }}>
        {eriasExpert && (
          <div style={{ background:`linear-gradient(135deg, ${RED}10, ${CRIMSON}08)`,
            border:`1px solid ${RED}25`, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
            <div style={{ color:RED, fontSize:9, fontWeight:800, textTransform:"uppercase",
              letterSpacing:0.8, marginBottom:6 }}>HLS ERISA Attorney</div>
            <p style={{ color:TEXT1, fontSize:10.5, lineHeight:1.7, margin:"0 0 6px" }}>
              {eriasExpert.finding}
            </p>
            {eriasExpert.legal_flag && (
              <div style={{ color:AMBER, fontSize:9, fontWeight:700 }}>{eriasExpert.legal_flag}</div>
            )}
            {eriasExpert.recommendation && (
              <p style={{ color:TEXT2, fontSize:9.5, lineHeight:1.6, margin:"8px 0 0", borderTop:`1px solid ${RED}20`, paddingTop:8 }}>
                → {eriasExpert.recommendation}
              </p>
            )}
          </div>
        )}
        {riskSignals.length > 0 && (
          <Section title={`Risk Signals (${riskSignals.length})`} color={RED}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {riskSignals.slice(0,8).map((r:any, i:number) => (
                <div key={i} style={{ background:`${SEV_COLOR[r.severity]||RED}08`,
                  border:`1px solid ${SEV_COLOR[r.severity]||RED}20`,
                  borderRadius:8, padding:"8px 12px", animation:"fade-in 0.3s ease" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ color:TEXT1, fontSize:10, fontWeight:700, flex:1, paddingRight:8 }}>
                      {r.signal || r.finding || r.risk}
                    </div>
                    {r.severity && (
                      <span style={{ color:SEV_COLOR[r.severity]||RED, fontSize:8, fontWeight:900,
                        background:`${SEV_COLOR[r.severity]||RED}12`, padding:"1px 6px", borderRadius:4,
                        flexShrink:0 }}>{r.severity}</span>
                    )}
                  </div>
                  {r.financial_impact > 0 && (
                    <div style={{ color:RED, fontSize:9, fontWeight:800, marginTop:3 }}>
                      {fmt(r.financial_impact)}
                    </div>
                  )}
                  {r.statute && (
                    <div style={{ color:TEAL, fontSize:8, marginTop:3, fontFamily:"monospace" }}>{r.statute}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
        {quantRisks.length > 0 && (
          <Section title="Quantified Risk Register" color={AMBER}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {quantRisks.slice(0,6).map((r:any, i:number) => (
                <div key={i} style={{ padding:"7px 10px", background:`${AMBER}08`,
                  border:`1px solid ${AMBER}18`, borderRadius:7 }}>
                  <div style={{ color:TEXT1, fontSize:9.5, fontWeight:700 }}>{r.risk || r.title}</div>
                  {r.exposure && <div style={{ color:AMBER, fontSize:9, fontWeight:800 }}>{fmt(r.exposure)}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}
        {authority.length > 0 && (
          <Section title="Statutory Authority" color={TEAL}>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {authority.map((a:string, i:number) => (
                <span key={i} style={{ background:`${TEAL}0d`, color:TEAL, border:`1px solid ${TEAL}25`,
                  borderRadius:4, padding:"3px 8px", fontSize:8.5, fontFamily:"monospace" }}>
                  {a}
                </span>
              ))}
            </div>
          </Section>
        )}
        {clinicalExp && (
          <Section title="HMS Clinical Perspective" color={PURPLE}>
            <div style={{ background:`${PURPLE}08`, border:`1px solid ${PURPLE}20`,
              borderRadius:8, padding:"10px 12px" }}>
              <p style={{ color:TEXT1, fontSize:10, lineHeight:1.7, margin:0 }}>{clinicalExp.finding}</p>
            </div>
          </Section>
        )}
      </div>
    );
  }

  // ── Tab: Recommendations ─────────────────────────────────────────────────────
  function TabRecommendations() {
    const rankings   = a4.decision_rankings    || [];
    const stratRecs  = synthesis.strategic_recommendations || [];
    const verdict    = synthesis.orchestrator_verdict || "";
    const weaponized = a4.weaponized_strategy  || "";
    const hardTruth  = a4.hard_truth || a2.hard_truth || "";
    const hasData    = rankings.length || stratRecs.length || verdict;

    if (!hasData && !running)
      return <EmptyState msg="Run the pipeline to generate recommendations"/>;
    return (
      <div style={{ animation:"fade-in 0.4s ease" }}>
        {verdict && (
          <div style={{ background:`linear-gradient(135deg, ${ROSE}12, #0d1033)`,
            border:`1px solid ${ROSE}30`, borderRadius:14, padding:"14px 18px", marginBottom:14 }}>
            <div style={{ color:ROSE, fontSize:9, fontWeight:900, textTransform:"uppercase",
              letterSpacing:0.8, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              <Crown size={10}/> Orchestrator Verdict
            </div>
            <p style={{ color:TEXT1, fontSize:11, lineHeight:1.8, margin:0 }}>{verdict}</p>
          </div>
        )}
        {rankings.length > 0 && (
          <Section title="Priority Actions" color={ROSE}>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {rankings.slice(0,6).map((d:any, i:number) => (
                <div key={i} style={{ display:"flex", gap:10, padding:"9px 12px",
                  background:`${ROSE}06`, border:`1px solid ${ROSE}18`, borderRadius:9 }}>
                  <div style={{ width:20, height:20, borderRadius:5, background:`${ROSE}20`,
                    border:`1px solid ${ROSE}30`, display:"flex", alignItems:"center",
                    justifyContent:"center", flexShrink:0, color:ROSE, fontSize:9, fontWeight:900 }}>
                    {i+1}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:TEXT1, fontSize:10.5, fontWeight:700, marginBottom:2 }}>
                      {d.action}
                    </div>
                    {d.impact > 0 && (
                      <span style={{ color:RED, fontSize:10, fontWeight:900 }}>{fmt(d.impact)}</span>
                    )}
                    {d.urgency && (
                      <span style={{ color:URG_COLOR[d.urgency]||TEXT2, fontSize:8.5,
                        marginLeft:8, fontWeight:700 }}>{d.urgency}</span>
                    )}
                    {d.owner && (
                      <div style={{ color:TEXT2, fontSize:8.5, marginTop:2 }}>{d.owner}</div>
                    )}
                  </div>
                  {(d.priority_score || d.priority) > 0 && (
                    <div style={{ color:ACCENT, fontSize:10, fontWeight:800, alignSelf:"center" }}>
                      {d.priority_score || d.priority}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
        {stratRecs.length > 0 && (
          <Section title="Strategic Recommendations" color={ACCENT}>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {(stratRecs as any[]).map((r:any, i:number) => (
                <div key={i} style={{ padding:"8px 12px", background:`${ACCENT}08`,
                  border:`1px solid ${ACCENT}18`, borderRadius:8,
                  borderLeft:`3px solid ${ACCENT}`, paddingLeft:12 }}>
                  <p style={{ color:TEXT1, fontSize:10, lineHeight:1.7, margin:0 }}>
                    {typeof r === "string" ? r : r.recommendation || r.text || JSON.stringify(r)}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}
        {hardTruth && (
          <Section title="Hard Truth" color={CRIMSON}>
            <div style={{ background:`${CRIMSON}08`, border:`1px solid ${CRIMSON}25`,
              borderRadius:10, padding:"12px 14px", borderLeft:`3px solid ${CRIMSON}` }}>
              <p style={{ color:TEXT1, fontSize:11, lineHeight:1.8, margin:0 }}>{hardTruth}</p>
            </div>
          </Section>
        )}
        {weaponized && (
          <Section title="Weaponized Strategy" color={AMBER}>
            <div style={{ background:`${AMBER}08`, border:`1px solid ${AMBER}20`,
              borderRadius:10, padding:"12px 14px" }}>
              <p style={{ color:TEXT1, fontSize:10, lineHeight:1.7, margin:0 }}>{weaponized}</p>
            </div>
          </Section>
        )}
      </div>
    );
  }

  // ── Agent View Panel ─────────────────────────────────────────────────────────
  function AgentViewPanel() {
    const councilData = result?.council || {};
    const perAgent    = councilData.council || {};

    return (
      <div style={{ animation:"fade-in 0.3s ease" }}>
        <div style={{ color:TEXT2, fontSize:9, fontWeight:800, textTransform:"uppercase",
          letterSpacing:0.8, marginBottom:12 }}>
          7 Expert Council — Parallel Analysis
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {councilSignals.length > 0 ? councilSignals.map((sig:any, i:number) => {
            const expanded = expandedExp === sig.lens;
            return (
              <div key={i} data-testid={`card-council-${sig.lens}`}
                style={{ background:`${NAVY}60`, border:`1px solid rgba(139,92,246,0.2)`,
                  borderRadius:10, overflow:"hidden", transition:"all 0.2s",
                  animation:"node-appear 0.3s ease" }}>
                <button
                  onClick={() => setExpandedExp(expanded ? null : sig.lens)}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
                    padding:"10px 12px", background:"transparent", border:"none",
                    cursor:"pointer", textAlign:"left" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                    background:"#a78bfa", boxShadow:"0 0 8px #a78bfa50" }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#a78bfa", fontSize:9, fontWeight:800 }}>
                      {LENS_LABELS[sig.lens] || sig.lens}
                    </div>
                    <div style={{ color:TEXT2, fontSize:8.5, marginTop:1 }}>
                      {sig.finding?.substring(0,70)}{sig.finding?.length > 70 ? "…" : ""}
                    </div>
                  </div>
                  {sig.dollar_signal > 0 && (
                    <span style={{ color:RED, fontSize:9.5, fontWeight:900, flexShrink:0 }}>
                      {fmt(sig.dollar_signal)}
                    </span>
                  )}
                  {expanded ? <ChevronUp size={10} color={TEXT2}/> : <ChevronDown size={10} color={TEXT2}/>}
                </button>
                {expanded && (
                  <div style={{ padding:"0 12px 12px", borderTop:`1px solid rgba(139,92,246,0.1)`,
                    paddingTop:10 }}>
                    <p style={{ color:TEXT1, fontSize:10, lineHeight:1.7, margin:"0 0 8px" }}>
                      {sig.finding}
                    </p>
                    {sig.recommendation && (
                      <p style={{ color:"#a78bfa", fontSize:9.5, lineHeight:1.6, margin:0,
                        borderTop:"1px solid rgba(139,92,246,0.15)", paddingTop:8 }}>
                        → {sig.recommendation}
                      </p>
                    )}
                    {sig.legal_flag && (
                      <div style={{ color:AMBER, fontSize:9, marginTop:6 }}>{sig.legal_flag}</div>
                    )}
                  </div>
                )}
              </div>
            );
          }) : AGENTS.map((a, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px",
              background:`${NAVY}60`, border:`1px solid ${BORDER}`, borderRadius:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:TEXT3 }}/>
              <div style={{ color:TEXT3, fontSize:9.5 }}>
                {LENS_LABELS[Object.keys(LENS_LABELS)[i]] || a.name}
              </div>
              <div style={{ marginLeft:"auto", color:TEXT3, fontSize:8 }}>AWAITING</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column", gap:10, height:"100%" }}>
      {/* Status bar */}
      <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:12,
        padding:"10px 14px", backdropFilter:"blur(12px)",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:6, height:6, borderRadius:"50%",
            background: running ? AMBER : complete === 7 ? GREEN : TEXT3,
            boxShadow: running ? `0 0 6px ${AMBER}` : complete === 7 ? `0 0 6px ${GREEN}` : "none",
            animation: running ? "glow-throb 0.6s infinite" : "none" }}/>
          <span style={{ color:TEXT1, fontSize:10, fontWeight:700 }}>
            {running ? "PROCESSING" : complete === 7 ? "COMPLETE" : "STANDBY"}
          </span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {result && (
            <>
              <button onClick={onExport}
                data-testid="button-export"
                style={{ background:`${ACCENT}12`, border:`1px solid ${ACCENT}25`,
                  borderRadius:6, padding:"4px 10px", color:ACCENT, fontSize:9,
                  fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                <Download size={9}/> EXPORT
              </button>
              <button onClick={onReset}
                data-testid="button-reset"
                style={{ background:`${TEXT3}10`, border:`1px solid ${BORDER}`,
                  borderRadius:6, padding:"4px 10px", color:TEXT2, fontSize:9,
                  fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                <RotateCcw size={9}/> RESET
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar + Agent View toggle */}
      <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:12,
        padding:"12px 14px", backdropFilter:"blur(12px)" }}>
        <div style={{ display:"flex", gap:4, marginBottom:12, flexWrap:"wrap" }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key && !agentView;
            return (
              <button key={t.key}
                data-testid={`tab-${t.key}`}
                onClick={() => { setTab(t.key); setAgentView(false); }}
                style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 8px",
                  background: active ? `${t.color}15` : "transparent",
                  border:`1px solid ${active ? t.color : BORDER}`,
                  borderRadius:7, cursor:"pointer", transition:"all 0.15s" }}>
                <Icon size={9} color={active ? t.color : TEXT3}/>
                <span style={{ color: active ? t.color : TEXT3, fontSize:9, fontWeight:700 }}>
                  {t.label}
                </span>
              </button>
            );
          })}

          {/* Agent View Toggle */}
          <button
            data-testid="button-agent-view"
            onClick={() => setAgentView(!agentView)}
            style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 8px",
              background: agentView ? `${"#a78bfa"}15` : "transparent",
              border:`1px solid ${agentView ? "#a78bfa" : BORDER}`,
              borderRadius:7, cursor:"pointer", transition:"all 0.15s", marginLeft:"auto" }}>
            {agentView ? <EyeOff size={9} color="#a78bfa"/> : <Eye size={9} color={TEXT3}/>}
            <span style={{ color: agentView ? "#a78bfa" : TEXT3, fontSize:9, fontWeight:700 }}>
              AGENTS
            </span>
          </button>
        </div>

        {/* Tab content */}
        <div style={{ maxHeight:"calc(100vh - 340px)", overflowY:"auto",
          paddingRight:2 }}>
          {agentView
            ? <AgentViewPanel/>
            : tab === "map"     ? <TabSystemMap/>
            : tab === "leakage" ? <TabFinancialLeakage/>
            : tab === "erisa"   ? <TabErisaRisk/>
            :                     <TabRecommendations/>
          }
        </div>
      </div>

      {/* Intelligence grade + confidence */}
      {result && (() => {
        const a = result;
        return (
          <div style={{ background:GLASS, border:`1px solid ${BORDER}`, borderRadius:12,
            padding:"12px 14px", backdropFilter:"blur(12px)",
            display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ color:TEXT2, fontSize:8.5, fontWeight:700,
                textTransform:"uppercase", letterSpacing:0.6 }}>KIQ Grade</div>
              <div style={{ color:GREEN, fontSize:22, fontWeight:900, lineHeight:1 }}>
                {a.intelligence_grade || "—"}
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:TEXT2, fontSize:8.5, fontWeight:700,
                textTransform:"uppercase", letterSpacing:0.6 }}>Confidence</div>
              <div style={{ color:TEAL, fontSize:22, fontWeight:900, lineHeight:1 }}>
                {a.confidence_score || "—"}
                {a.confidence_score && <span style={{ fontSize:10, color:TEXT2 }}>/100</span>}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:TEXT2, fontSize:8.5, fontWeight:700,
                textTransform:"uppercase", letterSpacing:0.6 }}>Pipeline</div>
              <div style={{ color:ACCENT, fontSize:12, fontWeight:900 }}>7-AGENT</div>
              <div style={{ color:TEXT3, fontSize:7.5 }}>ERISA Validated</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Print Overlay ─────────────────────────────────────────────────────────────
function PrintOverlay({ result, selectedCase, onClose }:
  { result:any; selectedCase:KiqCase|null; onClose:()=>void }) {

  const a = result || {};
  const synthesis = a.synthesis || {};

  return (
    <>
      <div id="kiq-print-overlay" style={{ display:"none",
        fontFamily:"'Georgia', serif", padding:40, color:"#111", background:"white" }}>
        <div style={{ borderBottom:"3px solid #9B1C2E", paddingBottom:16, marginBottom:24 }}>
          <div style={{ fontSize:10, fontWeight:800, color:"#9B1C2E", letterSpacing:1.5, textTransform:"uppercase" }}>
            KINCAID IQ — FIDUCIARY INTELLIGENCE REPORT
          </div>
          <h1 style={{ fontSize:24, fontWeight:900, margin:"8px 0 4px", color:"#002B5C" }}>
            {selectedCase?.name || "Intelligence Analysis"}
          </h1>
          <div style={{ fontSize:11, color:"#666" }}>
            {selectedCase?.tag} · KIQ Grade {a.intelligence_grade} · Confidence {a.confidence_score}/100 ·
            Generated {new Date().toLocaleDateString()}
          </div>
        </div>
        {a.fiduciary_summary && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#9B1C2E", marginBottom:8 }}>FIDUCIARY SUMMARY</div>
            <p style={{ fontSize:12, lineHeight:1.9 }}>{a.fiduciary_summary}</p>
          </div>
        )}
        {synthesis.orchestrator_verdict && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#9B1C2E", marginBottom:8 }}>ORCHESTRATOR VERDICT</div>
            <p style={{ fontSize:12, lineHeight:1.9 }}>{synthesis.orchestrator_verdict}</p>
          </div>
        )}
        {(a.decision_rankings || []).length > 0 && (
          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#9B1C2E", marginBottom:8 }}>PRIORITY ACTIONS</div>
            {a.decision_rankings.map((d:any, i:number) => (
              <div key={i} style={{ marginBottom:10, paddingLeft:16, borderLeft:"3px solid #9B1C2E" }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{i+1}. {d.action}</div>
                {d.impact > 0 && (
                  <div style={{ fontSize:10, fontWeight:700, color:"#c0392b" }}>
                    Impact: ${d.impact.toLocaleString()}
                  </div>
                )}
                {d.urgency && <div style={{ fontSize:9, color:"#888" }}>Urgency: {d.urgency}</div>}
              </div>
            ))}
          </div>
        )}
        <div style={{ borderTop:"1px solid #ddd", paddingTop:12, fontSize:8.5, color:"#999", marginTop:32 }}>
          Kincaid IQ Intelligence Engine™ — 7-Agent Orchestrated Fiduciary Pipeline.
          Audit-defensible. Not legal advice.
          Authority: ERISA §§ 402-408, 503 · ACA §§ 2701-2719 · 29 C.F.R. § 2560.503-1
        </div>
      </div>
      <style>{`@media print { body > * { display:none!important } #kiq-print-overlay { display:block!important } }`}</style>

      {/* Export modal */}
      <div style={{ position:"fixed", inset:0, background:"rgba(4,6,16,0.92)",
        backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center",
        justifyContent:"center", animation:"fade-in 0.2s ease" }}>
        <div style={{ background:GLASS2, border:`1px solid ${BORDER}`,
          borderRadius:20, padding:"28px 30px", width:380, boxShadow:`0 32px 80px rgba(0,0,0,0.6)` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
            <Crown size={18} color={ROSE}/>
            <div>
              <div style={{ color:TEXT1, fontSize:16, fontWeight:900 }}>Executive Export</div>
              <div style={{ color:TEXT2, fontSize:11, marginTop:2 }}>
                {selectedCase?.name} · Grade {a.intelligence_grade}
              </div>
            </div>
          </div>
          {a.fiduciary_summary && (
            <div style={{ background:`${ROSE}0d`, border:`1px solid ${ROSE}28`,
              borderRadius:10, padding:"12px 14px", marginBottom:18 }}>
              <p style={{ color:TEXT1, fontSize:11, lineHeight:1.8, margin:0 }}>
                {a.fiduciary_summary}
              </p>
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>
            {[
              { id:"exec",    label:"Executive Fiduciary Brief",    sub:"One-page summary for plan sponsor",    icon:FileText,  color:TEAL   },
              { id:"full",    label:"Full Intelligence Report",     sub:"Comprehensive audit-ready analysis",   icon:BarChart3, color:ACCENT },
              { id:"erisa",   label:"ERISA Compliance Brief",      sub:"Regulatory enforcement roadmap",       icon:ShieldAlert, color:RED  },
            ].map(btn => {
              const Icon = btn.icon;
              return (
                <button key={btn.id}
                  data-testid={`button-export-${btn.id}`}
                  onClick={() => window.print()}
                  style={{ background:`${btn.color}0e`, border:`1px solid ${btn.color}30`,
                    borderRadius:12, padding:"14px 16px", cursor:"pointer",
                    display:"flex", alignItems:"center", gap:12, transition:"all 0.15s" }}>
                  <div style={{ width:38, height:38, borderRadius:9, flexShrink:0,
                    background:`${btn.color}18`, border:`1px solid ${btn.color}30`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Icon size={16} color={btn.color}/>
                  </div>
                  <div style={{ flex:1, textAlign:"left" }}>
                    <div style={{ color:TEXT1, fontSize:12, fontWeight:800 }}>{btn.label}</div>
                    <div style={{ color:TEXT2, fontSize:10, marginTop:2 }}>{btn.sub}</div>
                  </div>
                  <ChevronRight size={14} color={btn.color}/>
                </button>
              );
            })}
          </div>
          <button onClick={onClose}
            data-testid="button-close-export"
            style={{ width:"100%", height:40, background:"transparent",
              border:`1px solid ${BORDER}`, borderRadius:10, color:TEXT2, fontSize:12,
              cursor:"pointer", fontWeight:600 }}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function KiqEngine() {
  function buildTraceLine(key: string, output: any): string {
    const labels: Record<string, string> = {
      ingestion:      "INGESTION",
      extraction:     "CLAUSE DETECT",
      economic:       "ECONOMICS",
      prioritization: "PRIORITIZATION",
      validation:     "ERISA AGENT",
      council:        "ELITE COUNCIL",
      synthesis:      "SYNTHESIS",
    };
    const label = labels[key] ?? key.toUpperCase();
    switch (key) {
      case "ingestion":      return `${label} → contract parsed, ${output?.entities?.length ?? 0} entities extracted`;
      case "extraction":     return `${label} → ${output?.risk_signals?.length ?? 0} risk signals identified`;
      case "economic":       return `${label} → margin extraction detected, leakage modeled`;
      case "prioritization": return `${label} → ${output?.recommendations?.length ?? 0} fiduciary actions ranked`;
      case "validation":     return `${label} → ${output?.violations?.length ?? output?.risk_score ? `risk score ${output.risk_score}` : "ERISA review complete"}`;
      case "council":        return `${label} → ${Object.keys(output ?? {}).length} expert lenses synthesized`;
      case "synthesis":      return `${label} → system model complete, decision memo ready`;
      default:               return `${label} → complete`;
    }
  }

  const [selectedCase, setSelectedCase] = useState<KiqCase|null>(null);
  const [content,      setContent]      = useState("");
  const [agentStates,  setAgentStates]  = useState<Record<string, AgentState>>(BLANK_STATES());
  const [finalResult,  setFinalResult]  = useState<any>(null);
  const [liveEntities, setLiveEntities] = useState<any[]>([]);
  const [liveRisks,    setLiveRisks]    = useState<any[]>([]);
  const [traceLines,   setTraceLines]   = useState<string[]>([]);
  const [running,       setRunning]       = useState(false);
  const [showExport,    setShowExport]    = useState(false);
  const [dominanceMode, setDominanceMode] = useState(false);
  const timerRefs  = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  const startTsRef = useRef<Record<number, number>>({});

  function resetAll() {
    setSelectedCase(null);
    setContent("");
    setAgentStates(BLANK_STATES());
    setFinalResult(null);
    setLiveEntities([]);
    setLiveRisks([]);
    setTraceLines([]);
    setRunning(false);
    setShowExport(false);
    Object.values(timerRefs.current).forEach(clearInterval);
    timerRefs.current  = {};
    startTsRef.current = {};
  }

  function startTimer(agentId: number) {
    startTsRef.current[agentId] = Date.now();
    timerRefs.current[agentId]  = setInterval(() => {
      const el = Math.floor((Date.now() - startTsRef.current[agentId]) / 1000);
      setAgentStates(s => ({
        ...s, [AGENTS[agentId-1].key]: { ...s[AGENTS[agentId-1].key], elapsed: el },
      }));
    }, 500);
  }

  function stopTimer(agentId: number) {
    clearInterval(timerRefs.current[agentId]);
    delete timerRefs.current[agentId];
  }

  async function runPipeline() {
    if (!selectedCase || content.trim().length < 20 || running) return;
    setAgentStates(BLANK_STATES());
    setFinalResult(null);
    setLiveEntities([]);
    setLiveRisks([]);
    setTraceLines([]);
    setRunning(true);

    const endpoint = selectedCase.mode === "contract-xray"
      ? "/api/kiq-engine/contract-xray/stream"
      : selectedCase.mode === "prior-auth"
      ? "/api/kiq-engine/prior-auth-intelligence/stream"
      : "/api/kiq-engine/pe-diligence/stream";

    try {
      const resp = await fetch(endpoint, {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ documents:[{ type:selectedCase.mode, content }], dominance_mode: dominanceMode }),
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf   = "";
      let event = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream:true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) { event = line.slice(7).trim(); continue; }
          if (!line.startsWith("data: "))  continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (event === "agent_start") {
              const agent = AGENTS.find(a => a.id === data.agent);
              if (agent) {
                startTimer(agent.id);
                setAgentStates(s => ({
                  ...s, [agent.key]:{ status:"running", output:null, startedAt:Date.now() },
                }));
              }
            } else if (event === "agent_complete") {
              const agent = AGENTS.find(a => a.id === data.agent);
              if (agent) {
                stopTimer(agent.id);
                setAgentStates(s => ({
                  ...s, [agent.key]:{ ...s[agent.key], status:"complete", output:data.output, completedAt:Date.now() },
                }));
                if (agent.key === "ingestion" && data.output?.entities)
                  setLiveEntities(data.output.entities.slice(0,20));
                if (agent.key === "extraction" && data.output?.risk_signals)
                  setLiveRisks(data.output.risk_signals.slice(0,12));
                setTraceLines(prev => [...prev, buildTraceLine(agent.key, data.output)]);
              }
            } else if (event === "pipeline_complete") {
              setFinalResult(data);
              setRunning(false);
            }
          } catch { /* skip */ }
          event = "";
        }
      }
    } catch (err) {
      console.error("[KIQ Engine]", err);
      setRunning(false);
    }
  }

  return (
    <div className="kiq-command-bg" style={{ minHeight:"100vh", color:TEXT1, overflow:"hidden" }}>
      <style>{KEYFRAMES}</style>

      {/* Top bar */}
      <div style={{ height:48, background:`${NAVY}90`, borderBottom:`1px solid ${BORDER}`,
        backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 24px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:ROSE,
              boxShadow:`0 0 10px ${ROSE}`, animation:"glow-throb 2s infinite" }}/>
            <span style={{ color:TEXT1, fontSize:13, fontWeight:900, letterSpacing:"-0.02em" }}>
              Kincaid IQ
            </span>
          </div>
          <div style={{ width:1, height:20, background:BORDER }}/>
          <span style={{ color:TEXT2, fontSize:10, fontWeight:700, letterSpacing:0.5 }}>
            KIQ INTELLIGENCE ENGINE™
          </span>
          {badge("ELITE COUNCIL OS", "#a78bfa", 8)}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {dominanceMode && (
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px",
              background:`${CRIMSON}15`, border:`1px solid ${CRIMSON}40`, borderRadius:6,
              animation:"crimson-pulse 2.5s infinite" }}>
              <Swords size={9} color={CRIMSON}/>
              <span style={{ color:CRIMSON, fontSize:9, fontWeight:900, letterSpacing:0.6 }}>
                WEAPONIZED OUTPUT
              </span>
            </div>
          )}
          {running && (
            <div style={{ display:"flex", alignItems:"center", gap:6, color:AMBER, fontSize:10, fontWeight:700 }}>
              <Activity size={11} style={{ animation:"glow-throb 0.6s infinite" }}/>
              PIPELINE ACTIVE
            </div>
          )}
          {finalResult && !running && (
            <div style={{ display:"flex", alignItems:"center", gap:6, color:GREEN, fontSize:10, fontWeight:700 }}>
              <CheckCircle2 size={11}/>
              ANALYSIS COMPLETE
            </div>
          )}
          <span style={{ color:TEXT3, fontSize:9 }}>
            ERISA §§ 402-408 · ACA §§ 2701-2719 · HIPAA
          </span>
        </div>
      </div>

      {/* 3-column command center */}
      <div style={{ display:"flex", gap:12, padding:"14px 16px",
        height:"calc(100vh - 48px)", boxSizing:"border-box" }}>
        <LeftPanel
          selectedCase={selectedCase}
          setSelectedCase={setSelectedCase}
          content={content}
          setContent={setContent}
          onRun={runPipeline}
          running={running}
          dominanceMode={dominanceMode}
          setDominanceMode={setDominanceMode}
        />
        <CenterPanel
          agentStates={agentStates}
          running={running}
          selectedCase={selectedCase}
          liveEntities={liveEntities}
          liveRisks={liveRisks}
          traceLines={traceLines}
        />
        <RightPanel
          result={finalResult}
          agentStates={agentStates}
          running={running}
          selectedCase={selectedCase}
          liveRisks={liveRisks}
          onReset={resetAll}
          onExport={() => setShowExport(true)}
        />
      </div>

      {/* Export modal */}
      {showExport && finalResult && (
        <PrintOverlay
          result={finalResult}
          selectedCase={selectedCase}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
