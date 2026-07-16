import { useState, useRef } from "react";
import {
  Upload, Play, ArrowRight, Search, Pill, Building2,
  Activity, CheckCircle2, AlertCircle, Cpu, FlaskConical,
} from "lucide-react";
import { KiqProvider, useKiq, KiqMode } from "@/context/KiqContext";
import { SAMPLE_BY_MODE } from "@/lib/kiqSamples";

const BG     = "#F8FAFC";
const CARD   = "#0d1033";
const CARD2  = "#111540";
const BORDER = "#e2e8f0";
const TEXT1  = "#f0f4ff";
const TEXT2  = "#8b9dd4";
const GREEN  = "#22c55e";
const AMBER  = "#f59e0b";
const RED    = "#ef4444";
const ROSE   = "#9B1C2E";
const TEAL   = "#06b6d4";
const PURPLE = "#8b5cf6";

const MODES = [
  {
    id: "contract-xray" as KiqMode,
    label: "Contract X-Ray™",
    icon: Search,
    color: TEAL,
    sub: "PBM Contract Analysis Engine",
    desc: "Detect spread pricing, rebate misalignment, audit restrictions, MAC manipulation, and fiduciary exposure.",
    doc_hint: "Paste PBM contract language, pricing addendum, rebate schedule, or carrier agreement…",
  },
  {
    id: "prior-auth" as KiqMode,
    label: "PA Intelligence™",
    icon: Pill,
    color: PURPLE,
    sub: "Prior Authorization Optimization Engine",
    desc: "Analyze denial logs, detect parity violations, and build appeal intelligence for GLP-1s and specialty Rx.",
    doc_hint: "Paste PA denial logs, authorization criteria, EOBs, or clinical policy language…",
  },
  {
    id: "pe-diligence" as KiqMode,
    label: "PE Fiduciary Scan™",
    icon: Building2,
    color: AMBER,
    sub: "Operator + Target Risk Scoring Engine",
    desc: "Score pre-acquisition operator risk across benefits, ERISA compliance, OIG exclusions, and stop-loss exposure.",
    doc_hint: "Paste diligence notes, benefits summaries, 5500 data, credentialing findings, or financial data…",
  },
];

function DropZone({ onText, color }: { onText: (t: string) => void; color: string }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus]     = useState<"idle" | "reading" | "done" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    setFileName(file.name);
    setStatus("reading");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result?.trim()) { onText(result); setStatus("done"); }
      else setStatus("error");
    };
    reader.onerror = () => setStatus("error");
    ext === "pdf" ? reader.readAsText(file, "latin1") : reader.readAsText(file, "utf-8");
  }

  const borderColor = dragging ? color : status === "done" ? GREEN : status === "error" ? RED : BORDER;
  const bgColor     = dragging ? `${color}08` : status === "done" ? `${GREEN}06` : CARD2;

  return (
    <div
      data-testid="dropzone-document"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
      onClick={() => inputRef.current?.click()}
      style={{ background: bgColor, border: `2px dashed ${borderColor}`, borderRadius: 10,
        padding: "14px 18px", marginBottom: 10, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}>
      <input ref={inputRef} type="file" accept=".txt,.csv,.md,.pdf,.json,.log"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); }} />
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0,
        background: status === "done" ? `${GREEN}15` : `${color}12`,
        border: `1px solid ${status === "done" ? GREEN : color}30`,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {status === "reading" ? <Activity size={15} color={AMBER}/>
          : status === "done" ? <CheckCircle2 size={15} color={GREEN}/>
          : status === "error" ? <AlertCircle size={15} color={RED}/>
          : <Upload size={15} color={color}/>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: TEXT1, fontSize: 12, fontWeight: 700 }}>
          {status === "idle"    && "Drop document here or click to browse"}
          {status === "reading" && `Reading ${fileName}…`}
          {status === "done"    && `✓ ${fileName} loaded`}
          {status === "error"   && `Could not read ${fileName} — paste text below`}
        </div>
        <div style={{ color: TEXT2, fontSize: 10, marginTop: 2 }}>
          {status === "idle" && "Supports: .txt  .csv  .pdf  .md  .json  .log"}
          {status === "done" && <span style={{ color: GREEN }}>Content populated below — review and run</span>}
        </div>
      </div>
      {status === "done" && (
        <button onClick={e => { e.stopPropagation(); setFileName(null); setStatus("idle"); onText(""); }}
          style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6,
            color: TEXT2, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>
          Clear
        </button>
      )}
    </div>
  );
}

function UploadDashboardInner() {
  const { mode, setMode, content, setContent, loading, runPipeline } = useKiq();
  const m = MODES.find(x => x.id === mode)!;

  return (
    <div style={{ background: BG, minHeight: "100%", padding: 0 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10,
          background: `${ROSE}12`, border: `1px solid ${ROSE}30`, borderRadius: 12,
          padding: "7px 16px", marginBottom: 14 }}>
          <Cpu size={14} color={ROSE}/>
          <span style={{ color: ROSE, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>
            KIQ Intelligence Engine™ — 5-Agent Pipeline
          </span>
        </div>
        <h2 style={{ color: TEXT1, fontSize: 22, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
          Upload &amp; Analyze
        </h2>
        <p style={{ color: TEXT2, fontSize: 12, margin: 0 }}>
          Select analysis mode → paste or drop document → receive audit-defensible intelligence
        </p>
      </div>

      {/* Mode cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 22 }}>
        {MODES.map(mx => {
          const Icon   = mx.icon;
          const active = mode === mx.id;
          return (
            <button key={mx.id} data-testid={`button-mode-${mx.id}`}
              onClick={() => setMode(mx.id)}
              style={{ background: active ? `${mx.color}12` : CARD,
                border: `2px solid ${active ? mx.color : BORDER}`,
                borderRadius: 12, padding: "16px 14px", cursor: "pointer", textAlign: "left",
                boxShadow: active ? `0 0 18px ${mx.color}20` : "none", transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8,
                  background: active ? `${mx.color}22` : `${TEXT2}12`,
                  border: `1px solid ${active ? mx.color : TEXT2}30`,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} color={active ? mx.color : TEXT2}/>
                </div>
                <div>
                  <div style={{ color: active ? TEXT1 : TEXT2, fontSize: 12, fontWeight: 800 }}>{mx.label}</div>
                  <div style={{ color: active ? mx.color : TEXT2, fontSize: 9, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: 0.4 }}>{mx.sub}</div>
                </div>
              </div>
              <p style={{ color: active ? TEXT2 : `${TEXT2}80`, fontSize: 10, margin: 0, lineHeight: 1.6 }}>
                {mx.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Document input */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
        padding: 18, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Upload size={12} color={m.color}/>
            <span style={{ color: TEXT1, fontSize: 12, fontWeight: 700 }}>Document Input</span>
            <span style={{ color: TEXT2, fontSize: 10 }}>— paste text or drop a file</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {SAMPLE_BY_MODE[mode] && (
              <button
                data-testid="button-load-sample"
                onClick={() => {
                  const s = SAMPLE_BY_MODE[mode]!;
                  setContent(s.content);
                }}
                style={{ display: "flex", alignItems: "center", gap: 5,
                  background: `${m.color}10`, border: `1px solid ${m.color}30`,
                  borderRadius: 6, color: m.color, fontSize: 10, fontWeight: 700,
                  padding: "4px 10px", cursor: "pointer", letterSpacing: 0.2 }}>
                <FlaskConical size={10}/> Try Sample
              </button>
            )}
            <span style={{ color: TEXT2, fontSize: 10 }}>{content.length} chars</span>
          </div>
        </div>

        <DropZone onText={setContent} color={m.color}/>

        <textarea
          data-testid="textarea-document-content"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={m.doc_hint}
          rows={7}
          style={{ width: "100%", padding: "12px 14px", background: CARD2,
            border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT1,
            fontSize: 12, resize: "vertical", lineHeight: 1.7,
            fontFamily: "inherit", boxSizing: "border-box" }}
        />
      </div>

      <button
        data-testid="button-run-pipeline"
        onClick={runPipeline}
        disabled={content.trim().length < 20 || loading}
        style={{ width: "100%", height: 48, border: "none", borderRadius: 12, color: "#0F172A",
          fontSize: 13, fontWeight: 800, cursor: content.trim().length > 20 ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10, letterSpacing: 0.3,
          background: content.trim().length > 20 ? ROSE : `${ROSE}40`, transition: "background 0.2s" }}>
        <Play size={15}/>
        {loading ? "Running Pipeline…" : `Begin ${m.label} Analysis`}
        {!loading && <ArrowRight size={14} style={{ marginLeft: 4 }}/>}
      </button>
    </div>
  );
}

export { UploadDashboardInner as UploadDashboardInner };

export default function UploadDashboard() {
  return (
    <KiqProvider>
      <UploadDashboardInner />
    </KiqProvider>
  );
}
