import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Download,
  Search,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Eye,
  History,
  Zap,
  Activity,
  ShieldAlert,
  Target,
  ChevronDown,
  ArrowRight,
  Cpu,
  Bookmark,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = "surface" | "structure" | "incentive" | "failure";
type Severity  = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Dir       = "good" | "bad" | "neutral" | "up" | "down";

interface KPI         { label: string; value: string; delta: string; dir: Dir; }
interface ChartPoint  { label: string; value: number; }
interface RiskFactor  { label: string; severity: Severity; }

interface DrillNode {
  id: string;
  level: number;
  category: Category;
  title: string;
  description: string;
  score?: number;
  kpis?: KPI[];
  chart_data?: ChartPoint[];
  findings?: string[];
  risk_factors?: RiskFactor[];
  action?: string;
}

// A single "screen": the tile that was clicked to arrive here + its 4 children
interface DrillScreen {
  parentTile: DrillNode | null;   // null = root screen
  children: DrillNode[];
}

interface SavedPath { topic: string; path: DrillNode[]; savedAt: string; }

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = "kiq_drill_paths";
function savePath(topic: string, path: DrillNode[]) {
  const ex: SavedPath[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  ex.unshift({ topic, path, savedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ex.slice(0, 20)));
}
function loadPaths(): SavedPath[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

// ── Category config ───────────────────────────────────────────────────────────

const CAT: Record<Category, {
  label: string; icon: typeof Eye;
  color: string; border: string; glow: string; badge: string; accent: string;
}> = {
  surface:   { label: "Surface",   icon: Eye,           color: "from-blue-500/15 to-blue-600/5",    border: "border-blue-500/30",   glow: "hover:shadow-[0_0_32px_rgba(79,125,255,0.2)]",   badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",    accent: "#3b82f6" },
  structure: { label: "Structure", icon: Layers,        color: "from-amber-500/15 to-amber-600/5",  border: "border-amber-500/30",  glow: "hover:shadow-[0_0_32px_rgba(245,158,11,0.2)]",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/30", accent: "#f59e0b" },
  incentive: { label: "Incentive", icon: TrendingUp,    color: "from-emerald-500/15 to-emerald-600/5", border: "border-emerald-500/30", glow: "hover:shadow-[0_0_32px_rgba(34,197,94,0.2)]", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", accent: "#22c55e" },
  failure:   { label: "Failure",   icon: AlertTriangle, color: "from-rose-700/15 to-rose-800/5",    border: "border-rose-600/30",   glow: "hover:shadow-[0_0_32px_rgba(155,28,46,0.3)]",   badge: "bg-rose-700/15 text-rose-300 border-rose-600/30",    accent: "#9B1C2E" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreBar  = (s: number) => s >= 86 ? "#f87171" : s >= 61 ? "#fb923c" : s >= 31 ? "#fbbf24" : "#34d399";
const scoreLbl  = (s: number) => s >= 86 ? "CRITICAL" : s >= 61 ? "HIGH" : s >= 31 ? "MOD" : "LOW";
const scoreTxt  = (s: number) => s >= 86 ? "text-red-400" : s >= 61 ? "text-orange-400" : s >= 31 ? "text-amber-400" : "text-emerald-400";
const sevCls    = (s: Severity) =>
  s === "CRITICAL" ? "text-red-400 bg-red-500/10 border-red-500/30"
  : s === "HIGH"   ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
  : s === "MEDIUM" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
  :                  "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
const dirCls    = (d: Dir) => d === "good" || d === "up" ? "text-emerald-400" : d === "bad" || d === "down" ? "text-red-400" : "text-[var(--kiq-ink)]/35";
function DirIcon({ dir }: { dir: Dir }) {
  if (dir === "good" || dir === "up")   return <TrendingUp  size={10} className="text-emerald-400" />;
  if (dir === "bad"  || dir === "down") return <TrendingDown size={10} className="text-red-400" />;
  return <Minus size={10} className="text-[var(--kiq-ink)]/25" />;
}

// ── Mini bar chart (SVG) ──────────────────────────────────────────────────────

function MiniBar({ data, accent }: { data: ChartPoint[]; accent: string }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 300; const H = 68;
  const bw = Math.floor((W - (data.length - 1) * 3) / data.length);
  return (
    <div className="rounded-lg p-3" style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Activity size={10} className="text-[var(--kiq-ink)]/25" />
        <span className="text-[9px] font-mono text-[var(--kiq-ink)]/25 uppercase tracking-widest">Trend Index</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {data.map((pt, i) => {
          const bh = Math.max(3, (pt.value / max) * (H - 16));
          const x  = i * (bw + 3);
          const y  = H - 14 - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={bh} rx={2} fill={accent} opacity={0.25 + (i / data.length) * 0.6} />
              <text x={x + bw / 2} y={H - 1} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.28)" fontFamily="monospace">{pt.label}</text>
              <text x={x + bw / 2} y={y - 2}  textAnchor="middle" fontSize={7} fill="#334155"  fontFamily="monospace">{pt.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Score gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, category }: { score: number; category: Category }) {
  const fill = scoreBar(score);
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <svg width={68} height={40} viewBox="0 0 72 42">
        <path d="M 6 38 A 30 30 0 0 1 66 38" fill="none" stroke="#f1f5f9" strokeWidth={7} strokeLinecap="round" />
        <path d="M 6 38 A 30 30 0 0 1 66 38" fill="none" stroke={fill} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 94.2} 94.2`} opacity={0.85} />
        <text x={36} y={36} textAnchor="middle" fontSize={13} fontWeight="bold" fill="white" fontFamily="monospace">{score}</text>
      </svg>
      <span className={`text-[9px] font-mono font-bold mt-0.5 ${scoreTxt(score)}`}>{scoreLbl(score)}</span>
    </div>
  );
}

// ── Depth breadcrumb ─────────────────────────────────────────────────────────

function Breadcrumb({ screens }: { screens: DrillScreen[] }) {
  const path = screens.slice(1).map((s) => s.parentTile).filter(Boolean) as DrillNode[];
  if (path.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {path.map((n, i) => {
        const cfg = CAT[n.category];
        return (
          <div key={n.id} className="flex items-center gap-1">
            {i > 0 && <ArrowRight size={9} className="text-[var(--kiq-ink)]/15" />}
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border truncate max-w-[110px]"
              style={{ color: cfg.accent, borderColor: `${cfg.accent}28`, background: `${cfg.accent}0c` }}
              title={n.title}>
              L{n.level} {n.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Depth dots ───────────────────────────────────────────────────────────────

function DepthDots({ depth }: { depth: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-1 rounded-full transition-all duration-300"
          style={{
            width: i < depth ? 16 : 6,
            background: i < depth
              ? i >= 7 ? "#f87171" : i >= 5 ? "#fb923c" : i >= 3 ? "#fbbf24" : "#3b82f6"
              : "#e2e8f0",
          }} />
      ))}
      <span className="text-[9px] font-mono text-[var(--kiq-ink)]/25 ml-1">L{depth}/9</span>
    </div>
  );
}

// ── Skeleton grid ─────────────────────────────────────────────────────────────

function SkeletonGrid() {
  const cats: Category[] = ["surface", "structure", "incentive", "failure"];
  return (
    <div className="grid grid-cols-2 gap-4">
      {cats.map((c) => (
        <div key={c} className={`rounded-2xl border p-5 animate-pulse ${CAT[c].border}`}
          style={{ background: "rgba(255,255,255,0.025)" }}>
          <div className="h-3 w-16 rounded bg-[var(--kiq-surface)]/10 mb-3" />
          <div className="h-0.5 w-full bg-[var(--kiq-surface)]/5 rounded mb-3" />
          <div className="h-3.5 w-4/5 rounded bg-[var(--kiq-surface)]/10 mb-2" />
          <div className="h-2.5 w-full rounded bg-[var(--kiq-surface)]/7 mb-1.5" />
          <div className="h-2.5 w-3/4 rounded bg-[var(--kiq-surface)]/7" />
        </div>
      ))}
    </div>
  );
}

// ── Rich detail panel (parent tile context) ──────────────────────────────────

function ParentDetail({ tile }: { tile: DrillNode }) {
  const cfg = CAT[tile.category];
  const kpis     = tile.kpis?.slice(0, 4)        || [];
  const findings = tile.findings?.slice(0, 3)    || [];
  const risks    = tile.risk_factors?.slice(0, 3) || [];
  const chart    = tile.chart_data?.slice(0, 8)  || [];

  return (
    <div className="rounded-2xl border overflow-hidden mb-6"
      style={{ background: "#ffffff", borderColor: `${cfg.accent}30` }}>

      {/* Header */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-4"
        style={{ borderColor: `${cfg.accent}18`, background: `${cfg.accent}08` }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${cfg.badge}`}>
              {cfg.label.toUpperCase()} ANALYSIS
            </span>
            <span className="text-[9px] font-mono text-[var(--kiq-ink)]/20">L{tile.level}</span>
          </div>
          <h2 className="text-[var(--kiq-ink)] font-bold text-base leading-snug mb-1">{tile.title}</h2>
          <p className="text-[var(--kiq-ink)]/60 text-sm leading-relaxed">{tile.description}</p>
        </div>
        {tile.score != null && <ScoreGauge score={tile.score} category={tile.category} />}
      </div>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="px-5 py-4 border-b grid grid-cols-2 gap-3 sm:grid-cols-4"
          style={{ borderColor: "#f8fafc" }}>
          {kpis.map((kpi, i) => (
            <div key={i} className="rounded-xl p-3"
              style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
              <div className="flex items-center gap-1 mb-1.5">
                <DirIcon dir={kpi.dir} />
                <span className="text-[9px] font-mono text-[var(--kiq-ink)]/30 uppercase tracking-wider truncate">{kpi.label}</span>
              </div>
              <div className="text-xl font-bold font-mono leading-none mb-1" style={{ color: cfg.accent }}>{kpi.value}</div>
              <div className={`text-[9px] font-mono truncate ${dirCls(kpi.dir)}`}>{kpi.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart + Findings */}
      <div className="px-5 py-4 border-b grid gap-4 sm:grid-cols-2"
        style={{ borderColor: "#f8fafc" }}>
        {chart.length > 0 && <MiniBar data={chart} accent={cfg.accent} />}
        {findings.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Target size={10} className="text-[var(--kiq-ink)]/25" />
              <span className="text-[9px] font-mono text-[var(--kiq-ink)]/25 uppercase tracking-widest">Intelligence Findings</span>
            </div>
            <ul className="space-y-2">
              {findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: cfg.accent, opacity: 0.7 }} />
                  <span className="text-xs text-[var(--kiq-ink)]/65 leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Risk + Action */}
      <div className="px-5 py-4 flex flex-col sm:flex-row gap-4">
        {risks.length > 0 && (
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert size={10} className="text-[var(--kiq-ink)]/25" />
              <span className="text-[9px] font-mono text-[var(--kiq-ink)]/25 uppercase tracking-widest">Risk Factors</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {risks.map((r, i) => (
                <span key={i} className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${sevCls(r.severity)}`}>
                  {r.severity} · {r.label}
                </span>
              ))}
            </div>
          </div>
        )}
        {tile.action && (
          <div className="flex-1 rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{ background: `${cfg.accent}10`, border: `1px solid ${cfg.accent}28` }}>
            <Zap size={12} className="mt-0.5 flex-shrink-0" style={{ color: cfg.accent }} />
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider mb-1 block" style={{ color: cfg.accent, opacity: 0.65 }}>Next Action</span>
              <span className="text-xs text-[var(--kiq-ink)]/80 leading-relaxed">{tile.action}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Child tile card (the 4 drill-into options) ────────────────────────────────

function ChildTile({
  node,
  onClick,
  loading,
}: {
  node: DrillNode;
  onClick: () => void;
  loading: boolean;
}) {
  const cfg = CAT[node.category];
  const Icon = cfg.icon;
  const isFinal = node.level >= 9;

  return (
    <motion.div
      whileHover={loading ? {} : { scale: 1.015 }}
      whileTap={loading ? {} : { scale: 0.98 }}
      onClick={loading ? undefined : onClick}
      data-testid={`drill-tile-${node.category}-l${node.level}`}
      className={`
        relative cursor-pointer rounded-2xl border p-5 transition-colors duration-200
        bg-gradient-to-br ${cfg.color} ${cfg.border} ${cfg.glow}
        ${loading ? "opacity-50 cursor-wait" : ""}
      `}
      style={{ background: "rgba(255,255,255,0.035)" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${cfg.badge}`}>
          <Icon size={9} />
          {cfg.label.toUpperCase()}
        </span>
        {node.score != null && (
          <span className={`text-xs font-mono font-bold ${scoreTxt(node.score)}`}>
            {node.score}<span className="opacity-50 text-[9px] font-normal"> {scoreLbl(node.score)}</span>
          </span>
        )}
      </div>

      {/* Score bar */}
      {node.score != null && (
        <div className="w-full h-0.5 rounded-full bg-[var(--kiq-surface)]/5 mb-3">
          <div className="h-0.5 rounded-full" style={{ width: `${node.score}%`, background: scoreBar(node.score) }} />
        </div>
      )}

      <h3 className="text-[var(--kiq-ink)] font-semibold text-sm leading-snug mb-2">{node.title}</h3>
      <p className="text-[var(--kiq-ink)]/50 text-xs leading-relaxed line-clamp-3">{node.description}</p>

      {/* Click hint */}
      {!isFinal && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[9px] font-mono text-[var(--kiq-ink)]/20">tap to drill deeper</span>
          <div className="flex items-center gap-1">
            <ChevronRight size={13} className="text-[var(--kiq-ink)]/20" />
          </div>
        </div>
      )}
      {isFinal && (
        <span className="mt-3 inline-block text-[9px] font-mono text-[var(--kiq-ink)]/25 border border-white/10 px-1.5 py-0.5 rounded">FINAL L9</span>
      )}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function DrillEngine() {
  const [topic,      setTopic]      = useState("");
  const [inputValue, setInputValue] = useState("");
  const [started,    setStarted]    = useState(false);
  const [fileText,   setFileText]   = useState<string | null>(null);
  const [fileName,   setFileName]   = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>(() => loadPaths());
  const [showSaved,  setShowSaved]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [loadingId,  setLoadingId]  = useState<string | null>(null);
  // direction: "forward" = new screen slides in from right; "back" = from left
  const [direction,  setDirection]  = useState<"forward" | "back">("forward");
  const [screenStack, setScreenStack] = useState<DrillScreen[]>([]);
  const [screenKey,   setScreenKey]   = useState(0); // for AnimatePresence key

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentScreen = screenStack[screenStack.length - 1] ?? null;
  const depth = screenStack.length; // 0 = not started, 1 = L1, 2 = L2, etc.

  // The path of tiles selected so far
  const selectedPath: DrillNode[] = screenStack
    .slice(1)
    .map((s) => s.parentTile)
    .filter(Boolean) as DrillNode[];

  // ── File upload ─────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setExtracting(true);
    setFileName(file.name);
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    if (!inputValue.trim()) setInputValue(baseName);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/kiq-engine/extract-text", {
        method: "POST", credentials: "include", body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFileText(data.text);
    } catch {
      setFileText(null); setFileName(null);
    } finally {
      setExtracting(false);
    }
  };

  // ── API call helper ──────────────────────────────────────────────────────
  const fetchTiles = async (path: DrillNode[], level: number): Promise<DrillNode[]> => {
    const res = await apiRequest("POST", "/api/kiq-engine/drill", {
      topic,
      path,
      level,
      file_text: fileText ?? null,
    });
    const data = await res.json();
    return data.tiles || [];
  };

  // ── Start exploration ────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!inputValue.trim()) return;
    const t = inputValue.trim();
    setTopic(t);
    setStarted(true);
    setLoading(true);
    setScreenStack([]);
    setDirection("forward");
    setScreenKey((k) => k + 1);
    try {
      const res = await apiRequest("POST", "/api/kiq-engine/drill", {
        topic: t, path: [], level: 1, file_text: fileText ?? null,
      });
      const data = await res.json();
      setScreenStack([{ parentTile: null, children: data.tiles || [] }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Click a child tile → navigate forward ────────────────────────────────
  const handleChildClick = async (tile: DrillNode) => {
    if (tile.level >= 9 || loading) return;
    setLoadingId(tile.id);
    const newPath = [...selectedPath, tile];
    const nextLevel = tile.level + 1;
    try {
      const tiles = await fetchTiles(newPath, nextLevel);
      setDirection("forward");
      setScreenKey((k) => k + 1);
      setScreenStack((prev) => [...prev, { parentTile: tile, children: tiles }]);
    } finally {
      setLoadingId(null);
    }
  };

  // ── Navigate back ────────────────────────────────────────────────────────
  const handleBack = () => {
    if (depth <= 1) return;
    setDirection("back");
    setScreenKey((k) => k + 1);
    setScreenStack((prev) => prev.slice(0, -1));
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setStarted(false);
    setTopic("");
    setInputValue("");
    setScreenStack([]);
    setFileText(null);
    setFileName(null);
  };

  // ── Save + Export ────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!topic || selectedPath.length === 0) return;
    savePath(topic, selectedPath);
    setSavedPaths(loadPaths());
  };

  const handleExport = () => {
    const lines = [
      "KINCAID HEALTH — DRILL-DOWN INTELLIGENCE REPORT",
      `Topic: ${topic}`,
      `Generated: ${new Date().toISOString()}`,
      `Depth: L${depth}`,
      "",
      "REASONING PATH:",
      ...selectedPath.map((n) => `  L${n.level} [${n.category.toUpperCase()}] ${n.title}`),
      "",
      "FINDINGS BY LEVEL:",
      ...selectedPath.map((n) => [
        "",
        `[L${n.level} · ${n.category.toUpperCase()}] ${n.title}`,
        n.description,
        n.action ? `→ ACTION: ${n.action}` : "",
        ...(n.findings || []).map((f) => `  • ${f}`),
      ].filter(Boolean).join("\n")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `kiq-drill-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Slide variants ───────────────────────────────────────────────────────
  const slideVariants = {
    enter: (dir: "forward" | "back") => ({ x: dir === "forward" ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:  (dir: "forward" | "back") => ({ x: dir === "forward" ? "-40%" : "40%", opacity: 0 }),
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen text-[var(--kiq-ink)] overflow-x-hidden" style={{ background: "#F8FAFC" }}>

      {/* ── Persistent top bar (always visible) ── */}
      <div className="sticky top-0 z-30 border-b border-white/6 backdrop-blur-md"
        style={{ background: "rgba(5,7,10,0.92)" }}>
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            {started && depth > 1 && (
              <button
                onClick={handleBack}
                data-testid="button-drill-back"
                className="flex items-center gap-1 text-[var(--kiq-ink)]/40 hover:text-[var(--kiq-ink)]/80 transition-colors text-xs font-mono"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center"
                style={{ background: "rgba(155,28,46,0.35)", border: "1px solid rgba(155,28,46,0.5)" }}>
                <Cpu size={11} className="text-rose-400" />
              </div>
              <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Orbitron', monospace" }}>
                DRILL ENGINE
              </span>
              {started && (
                <span className="text-[9px] font-mono text-[var(--kiq-ink)]/25 hidden sm:inline">
                  {topic.length > 28 ? topic.slice(0, 28) + "…" : topic}
                </span>
              )}
            </div>
          </div>

          {/* Right: depth + controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {started && <DepthDots depth={depth} />}
            {started && selectedPath.length > 0 && (
              <button onClick={handleSave} data-testid="button-save-path"
                className="flex items-center gap-1 text-[var(--kiq-ink)]/30 hover:text-[var(--kiq-ink)]/70 transition-colors">
                <Bookmark size={12} />
              </button>
            )}
            {started && selectedPath.length > 0 && (
              <button onClick={handleExport} data-testid="button-export-drill"
                className="flex items-center gap-1 text-[var(--kiq-ink)]/30 hover:text-[var(--kiq-ink)]/70 transition-colors">
                <Download size={12} />
              </button>
            )}
            {started && (
              <button onClick={handleReset} data-testid="button-reset-drill"
                className="flex items-center gap-1 text-[var(--kiq-ink)]/30 hover:text-[var(--kiq-ink)]/70 transition-colors">
                <RotateCcw size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb strip under top bar */}
        {started && selectedPath.length > 0 && (
          <div className="max-w-5xl mx-auto px-5 pb-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[8px] font-mono text-[var(--kiq-ink)]/20 uppercase tracking-widest">Path:</span>
            <Breadcrumb screens={screenStack} />
          </div>
        )}
      </div>

      {/* ── Screen content ── */}
      <div className="relative overflow-hidden">
        {/* Start screen */}
        {!started && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto px-5 py-10"
          >
            <div className="mb-8">
              <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Orbitron', monospace" }}>
                KIQ DRILL ENGINE
              </h1>
              <p className="text-[var(--kiq-ink)]/40 text-sm leading-relaxed">
                Click a tile → get a flood of KPIs, charts, findings &amp; risk data.
                Then click through to the next screen — up to 9 levels deep.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 p-7" style={{ background: "rgba(255,255,255,0.035)" }}>
              {/* Quick topics */}
              <p className="text-[var(--kiq-ink)]/35 text-xs font-mono uppercase tracking-widest mb-3">Quick Topics</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  "PBM spread pricing",
                  "Stop-loss contract terms",
                  "ERISA fiduciary breach",
                  "Prior authorization denial",
                  "Rebate retention by PBM",
                  "Network disruption risk",
                  "GLP-1 formulary exposure",
                  "Biosimilar substitution gaps",
                ].map((t) => (
                  <button key={t}
                    onClick={() => setInputValue(t)}
                    data-testid={`quick-topic-${t.replace(/\s+/g, "-").toLowerCase()}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/12 text-[var(--kiq-ink)]/45
                               hover:border-white/30 hover:text-[var(--kiq-ink)]/75 transition-all">
                    {t}
                  </button>
                ))}
              </div>

              {/* Doc upload */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-document"
                className={`mb-5 rounded-xl border-2 border-dashed px-5 py-4 cursor-pointer text-center transition-all
                  ${dragOver ? "border-rose-500/55 bg-rose-900/8" : fileText ? "border-emerald-500/35 bg-emerald-900/8" : "border-white/8 hover:border-white/20 bg-[var(--kiq-surface)]/[0.015]"}`}>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                {extracting ? (
                  <p className="text-xs text-[var(--kiq-ink)]/40">Extracting…</p>
                ) : fileText ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-emerald-400 text-xs font-mono">✓ {fileName}</span>
                    <span className="text-[var(--kiq-ink)]/20 text-xs">·</span>
                    <span className="text-[var(--kiq-ink)]/30 text-xs">{Math.round(fileText.length / 1000)}k chars</span>
                    <button onClick={(e) => { e.stopPropagation(); setFileText(null); setFileName(null); }}
                      className="ml-2 text-[var(--kiq-ink)]/20 hover:text-[var(--kiq-ink)]/50 text-xs">✕</button>
                  </div>
                ) : (
                  <>
                    <p className="text-[var(--kiq-ink)]/30 text-xs font-mono">DROP CONTRACT OR DOCUMENT HERE</p>
                    <p className="text-[var(--kiq-ink)]/18 text-[10px] mt-0.5">PDF · TXT · MD — AI drills into specific clauses and figures</p>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
                  placeholder="e.g. PBM spread pricing, ERISA fiduciary breach…"
                  data-testid="input-drill-topic"
                  className="flex-1 bg-[var(--kiq-surface)]/4 border-white/12 text-[var(--kiq-ink)] placeholder:text-[var(--kiq-ink)]/22 text-sm focus:border-rose-500/45"
                />
                <Button onClick={handleStart} disabled={!inputValue.trim() || loading}
                  data-testid="button-start-drill"
                  className="px-6 font-semibold" style={{ background: "#9B1C2E", color: "#0F172A" }}>
                  <Search size={13} className="mr-2" />
                  Begin
                </Button>
              </div>

              {/* Saved paths */}
              {savedPaths.length > 0 && (
                <div className="mt-5 pt-4 border-t border-white/6">
                  <button onClick={() => setShowSaved((v) => !v)}
                    className="flex items-center gap-2 text-xs text-[var(--kiq-ink)]/25 hover:text-[var(--kiq-ink)]/55 transition-colors">
                    <History size={11} />
                    {savedPaths.length} saved path{savedPaths.length !== 1 ? "s" : ""}
                    <ChevronDown size={10} className={`transition-transform ${showSaved ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {showSaved && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-1.5 overflow-hidden">
                        {savedPaths.slice(0, 5).map((sp, i) => (
                          <button key={i} onClick={() => setInputValue(sp.topic)}
                            className="w-full text-left rounded-lg border border-white/6 px-3 py-2 hover:border-white/16 transition-all"
                            style={{ background: "rgba(255,255,255,0.025)" }}>
                            <span className="text-[var(--kiq-ink)]/55 text-xs font-medium">{sp.topic}</span>
                            <span className="text-[var(--kiq-ink)]/20 text-[9px] ml-2 font-mono">
                              {sp.path.length} levels · {new Date(sp.savedAt).toLocaleDateString()}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Loading first screen */}
        {started && loading && screenStack.length === 0 && (
          <div className="max-w-5xl mx-auto px-5 py-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-rose-500/60 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <span className="text-xs font-mono text-[var(--kiq-ink)]/30">Generating Level 1 intelligence…</span>
            </div>
            <SkeletonGrid />
          </div>
        )}

        {/* Active screen stack */}
        {started && currentScreen && (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={screenKey}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="max-w-5xl mx-auto px-5 py-8"
            >
              {/* Level label */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold"
                    style={{ background: "rgba(155,28,46,0.3)", border: "1px solid rgba(155,28,46,0.4)", color: "#f87171" }}>
                    {depth}
                  </div>
                  <span className="text-[10px] font-mono text-[var(--kiq-ink)]/30">
                    LEVEL {depth}
                    {depth === 1 ? " — STRATEGIC LANDSCAPE"
                      : depth <= 3 ? " — STRUCTURAL DIAGNOSIS"
                      : depth <= 5 ? " — QUANTIFIED EXPOSURE"
                      : depth <= 7 ? " — EXPLOIT MAPPING"
                      : " — FINAL WEAPON"}
                  </span>
                </div>
                <div className="flex-1 h-px" style={{ background: "#ffffff" }} />
                <Badge variant="outline" className="text-[9px] border-white/12 text-[var(--kiq-ink)]/25 font-mono">
                  {currentScreen.children.length} tiles
                </Badge>
              </div>

              {/* Parent tile detail (shown on L2+ screens) */}
              {currentScreen.parentTile && (
                <ParentDetail tile={currentScreen.parentTile} />
              )}

              {/* Section label for child tiles */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[9px] font-mono text-[var(--kiq-ink)]/25 uppercase tracking-widest">
                  {currentScreen.parentTile
                    ? `Drill deeper — select a lens to continue`
                    : `Select an analytical lens to begin your investigation`}
                </span>
                <div className="flex-1 h-px" style={{ background: "#ffffff" }} />
              </div>

              {/* 4 child tile cards */}
              <div className="grid grid-cols-2 gap-4">
                {currentScreen.children.map((tile) => (
                  <ChildTile
                    key={tile.id}
                    node={tile}
                    onClick={() => handleChildClick(tile)}
                    loading={loadingId !== null}
                  />
                ))}
              </div>

              {/* Loading overlay for next screen */}
              <AnimatePresence>
                {loadingId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 flex items-center gap-3 justify-center py-4 rounded-xl border border-white/6"
                    style={{ background: "#ffffff" }}
                  >
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-rose-500/50 animate-pulse"
                          style={{ animationDelay: `${i * 120}ms` }} />
                      ))}
                    </div>
                    <span className="text-xs font-mono text-[var(--kiq-ink)]/30">Drilling deeper…</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Final depth */}
              {currentScreen.children.some((t) => t.level >= 9) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mt-6 rounded-2xl border border-white/8 p-5 text-center"
                  style={{ background: "rgba(155,28,46,0.05)" }}>
                  <div className="text-rose-400 text-[10px] font-mono mb-1">MAXIMUM DEPTH — L9</div>
                  <p className="text-[var(--kiq-ink)]/40 text-sm mb-4">Final intelligence artifacts unlocked.</p>
                  <Button onClick={handleExport} style={{ background: "#9B1C2E", color: "#0F172A" }}
                    data-testid="button-export-final" size="sm">
                    <Download size={12} className="mr-2" />
                    Export Full Report
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
