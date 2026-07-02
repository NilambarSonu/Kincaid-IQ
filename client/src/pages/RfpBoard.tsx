import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  KanbanSquare, Clock, AlertTriangle, ChevronDown, User, DollarSign,
  Calendar, Building2, Star, Plus, Filter, List, LayoutGrid,
  ArrowRight, CheckCircle2, XCircle, TrendingUp, Target, FileSearch,
  ChevronRight, X,
} from "lucide-react";

// ── Theme ──────────────────────────────────────────────────────────────────────
const T = {
  bg:      "#04060f",
  surface: "#080c1a",
  s2:      "#0d1020",
  border:  "#1a1f35",
  gold:    "#FBB724",
  goldDim: "rgba(251,183,36,0.12)",
  goldBorder: "rgba(251,183,36,0.28)",
  text:    "#ccd0e8",
  muted:   "#5a6080",
  green:   "#22c55e",
  red:     "#ef4444",
  blue:    "#3b82f6",
  amber:   "#f59e0b",
  purple:  "#a855f7",
  cyan:    "#06b6d4",
};

// ── Stage config ───────────────────────────────────────────────────────────────
const STAGES = [
  { key: "new",        label: "New",        color: T.blue,   bg: "rgba(59,130,246,0.12)"  },
  { key: "qualifying", label: "Qualifying", color: T.amber,  bg: "rgba(245,158,11,0.12)"  },
  { key: "drafting",   label: "Drafting",   color: T.purple, bg: "rgba(168,85,247,0.12)"  },
  { key: "submitted",  label: "Submitted",  color: T.cyan,   bg: "rgba(6,182,212,0.12)"   },
  { key: "decision",   label: "Decision",   color: T.gold,   bg: "rgba(251,183,36,0.12)"  },
  { key: "won",        label: "Won",        color: T.green,  bg: "rgba(34,197,94,0.12)"   },
  { key: "lost",       label: "Lost",       color: T.red,    bg: "rgba(239,68,68,0.12)"   },
] as const;

type StageKey = typeof STAGES[number]["key"];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<string, typeof STAGES[number]>;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  title: string | null;
  employer_name: string | null;
  industry: string | null;
  employer_size: string | null;
  covered_lives: number | null;
  estimated_contract_value: number | null;
  due_date: string | null;
  response_deadline: string | null;
  renewal_date: string | null;
  stage: string;
  score: number | null;
  owner: string | null;
  status: string;
  source: string;
  notes: string | null;
  plan_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt$(v?: number | null) {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtDate(s?: string | null) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return s; }
}

function deadlineStatus(deadline?: string | null): "overdue" | "atrisk" | "ok" | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (diff < 0) return "overdue";
  if (diff <= 7) return "atrisk";
  return "ok";
}

function daysUntil(deadline?: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / 86_400_000);
}

function getDeadline(o: Opportunity): string | null {
  return o.response_deadline || o.due_date || null;
}

function effectiveLabel(o: Opportunity): string {
  return o.title || o.employer_name || `RFP #${o.id.slice(0, 6)}`;
}

function scoreColor(s?: number | null): string {
  if (!s) return T.muted;
  if (s >= 80) return T.green;
  if (s >= 60) return T.amber;
  if (s >= 40) return T.gold;
  return T.red;
}

// ── Stage Badge ────────────────────────────────────────────────────────────────
function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_MAP[stage] || { label: stage, color: T.muted, bg: "rgba(90,96,128,0.12)" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "2px 8px", borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}30`,
    }}>{cfg.label}</span>
  );
}

// ── Deadline Badge ─────────────────────────────────────────────────────────────
function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const status = deadlineStatus(deadline);
  const days = daysUntil(deadline);
  if (!deadline || status === null) return <span style={{ fontSize: 10, color: T.muted }}>No deadline</span>;

  const color = status === "overdue" ? T.red : status === "atrisk" ? T.amber : T.muted;
  const label = status === "overdue"
    ? `${Math.abs(days!)}d overdue`
    : status === "atrisk"
    ? days === 0 ? "Due today" : `${days}d left`
    : fmtDate(deadline);

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color }}>
      {status !== "ok" && <AlertTriangle size={10} />}
      {!status.startsWith("at") && status !== "ok" ? <Clock size={10} /> : null}
      <span style={{ fontWeight: status !== "ok" ? 700 : 400 }}>{label}</span>
    </span>
  );
}

// ── Stage Dropdown ─────────────────────────────────────────────────────────────
function StageDropdown({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const moveMut = useMutation({
    mutationFn: async (stage: string) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${opp.id}`, { stage });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      onClose();
    },
    onError: () => toast({ title: "Failed to move card", variant: "destructive" }),
  });

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
        background: "#0a0c1a", border: `1px solid ${T.border}`, borderRadius: 10,
        padding: 6, minWidth: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: T.muted, padding: "4px 8px 6px" }}>
        Move to stage
      </div>
      {STAGES.map(s => (
        <button
          key={s.key}
          onClick={() => moveMut.mutate(s.key)}
          disabled={s.key === opp.stage}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "7px 10px", borderRadius: 7, border: "none", cursor: s.key === opp.stage ? "default" : "pointer",
            background: s.key === opp.stage ? `${s.color}18` : "transparent",
            color: s.key === opp.stage ? s.color : T.text, fontSize: 12, fontWeight: s.key === opp.stage ? 700 : 400,
          }}
          onMouseEnter={e => { if (s.key !== opp.stage) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { if (s.key !== opp.stage) e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
          {s.label}
          {s.key === opp.stage && <span style={{ marginLeft: "auto", fontSize: 9, color: s.color }}>current</span>}
        </button>
      ))}
    </div>
  );
}

// ── Owner Popover ──────────────────────────────────────────────────────────────
function OwnerPopover({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [val, setVal] = useState(opp.owner || "");

  const saveMut = useMutation({
    mutationFn: async (owner: string) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${opp.id}`, { owner: owner || null });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      onClose();
    },
    onError: () => toast({ title: "Failed to assign owner", variant: "destructive" }),
  });

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
        background: "#0a0c1a", border: `1px solid ${T.border}`, borderRadius: 10,
        padding: 10, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>
        Assign owner
      </div>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder="Name or email..."
        autoFocus
        onKeyDown={e => { if (e.key === "Enter") saveMut.mutate(val.trim()); if (e.key === "Escape") onClose(); }}
        style={{
          width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
          borderRadius: 7, padding: "7px 10px", color: T.text, fontSize: 12, outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          onClick={() => saveMut.mutate(val.trim())}
          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", background: T.goldDim, color: T.gold, fontWeight: 700, fontSize: 11 }}
        >
          Assign
        </button>
        {opp.owner && (
          <button
            onClick={() => saveMut.mutate("")}
            style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, cursor: "pointer", background: "transparent", color: T.muted, fontSize: 11 }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Deadline Popover ───────────────────────────────────────────────────────────
function DeadlinePopover({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const current = getDeadline(opp);
  const [val, setVal] = useState(current ? current.slice(0, 10) : "");

  const saveMut = useMutation({
    mutationFn: async (date: string) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${opp.id}`, { response_deadline: date || null });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      onClose();
    },
    onError: () => toast({ title: "Failed to update deadline", variant: "destructive" }),
  });

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
        background: "#0a0c1a", border: `1px solid ${T.border}`, borderRadius: 10,
        padding: 10, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>
        Response deadline
      </div>
      <input
        type="date"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") saveMut.mutate(val); if (e.key === "Escape") onClose(); }}
        style={{
          width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
          borderRadius: 7, padding: "7px 10px", color: T.text, fontSize: 12, outline: "none",
          boxSizing: "border-box", colorScheme: "dark",
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          onClick={() => saveMut.mutate(val)}
          style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", background: T.goldDim, color: T.gold, fontWeight: 700, fontSize: 11 }}
        >
          Set Deadline
        </button>
        {current && (
          <button
            onClick={() => saveMut.mutate("")}
            style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${T.border}`, cursor: "pointer", background: "transparent", color: T.muted, fontSize: 11 }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────────────────
function KanbanCard({ opp }: { opp: Opportunity }) {
  const [stageOpen, setStageOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const deadline = getDeadline(opp);
  const dStatus = deadlineStatus(deadline);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setStageOpen(false); setOwnerOpen(false); setDeadlineOpen(false);
      }
    }
    if (stageOpen || ownerOpen || deadlineOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [stageOpen, ownerOpen, deadlineOpen]);

  const borderColor = dStatus === "overdue" ? T.red : dStatus === "atrisk" ? T.amber : T.border;

  return (
    <div
      ref={cardRef}
      data-testid={`kanban-card-${opp.id}`}
      style={{
        background: T.surface, border: `1px solid ${borderColor}`,
        borderRadius: 12, padding: 14, marginBottom: 8, position: "relative",
        transition: "border-color 0.15s",
      }}
    >
      {/* Overdue pulse dot */}
      {dStatus === "overdue" && (
        <div style={{
          position: "absolute", top: 10, right: 10, width: 8, height: 8,
          borderRadius: "50%", background: T.red, boxShadow: `0 0 6px ${T.red}`,
        }} />
      )}

      {/* Title */}
      <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4, lineHeight: 1.35, paddingRight: dStatus === "overdue" ? 16 : 0 }}>
        {effectiveLabel(opp)}
      </div>
      {opp.industry && (
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 10 }}>{opp.industry}</div>
      )}

      {/* Metrics row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {opp.score != null && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: `${scoreColor(opp.score)}18`, color: scoreColor(opp.score), border: `1px solid ${scoreColor(opp.score)}30` }}>
            ★ {opp.score.toFixed(0)}
          </span>
        )}
        {opp.estimated_contract_value && (
          <span style={{ fontSize: 10, color: T.gold, fontWeight: 600 }}>
            {fmt$(opp.estimated_contract_value)}/yr
          </span>
        )}
        {opp.covered_lives && (
          <span style={{ fontSize: 10, color: T.muted }}>
            {opp.covered_lives.toLocaleString()} lives
          </span>
        )}
      </div>

      {/* Stage & move */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <button
            onClick={e => { e.stopPropagation(); setStageOpen(v => !v); setOwnerOpen(false); setDeadlineOpen(false); }}
            data-testid={`stage-btn-${opp.id}`}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 7,
              border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)", cursor: "pointer",
              color: T.muted, fontSize: 10,
            }}
          >
            <StageBadge stage={opp.stage} />
            <ChevronDown size={10} style={{ color: T.muted, flexShrink: 0 }} />
          </button>
          {stageOpen && <StageDropdown opp={opp} onClose={() => setStageOpen(false)} />}
        </div>
      </div>

      {/* Owner & deadline */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {/* Owner */}
        <div style={{ position: "relative" }}>
          <button
            onClick={e => { e.stopPropagation(); setOwnerOpen(v => !v); setStageOpen(false); setDeadlineOpen(false); }}
            data-testid={`owner-btn-${opp.id}`}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6,
              border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)", cursor: "pointer",
              color: opp.owner ? T.text : T.muted, fontSize: 10,
            }}
          >
            <User size={9} />
            <span>{opp.owner || "Assign"}</span>
          </button>
          {ownerOpen && <OwnerPopover opp={opp} onClose={() => setOwnerOpen(false)} />}
        </div>

        {/* Deadline */}
        <div style={{ position: "relative" }}>
          <button
            onClick={e => { e.stopPropagation(); setDeadlineOpen(v => !v); setStageOpen(false); setOwnerOpen(false); }}
            data-testid={`deadline-btn-${opp.id}`}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6,
              border: `1px solid ${dStatus === "overdue" ? `${T.red}50` : dStatus === "atrisk" ? `${T.amber}50` : T.border}`,
              background: dStatus === "overdue" ? `${T.red}08` : dStatus === "atrisk" ? `${T.amber}08` : "rgba(255,255,255,0.03)",
              cursor: "pointer",
            }}
          >
            <DeadlineBadge deadline={deadline} />
          </button>
          {deadlineOpen && <DeadlinePopover opp={opp} onClose={() => setDeadlineOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Column ──────────────────────────────────────────────────────────────
function KanbanColumn({ stage, opps }: { stage: typeof STAGES[number]; opps: Opportunity[] }) {
  const totalValue = opps.reduce((s, o) => s + (o.estimated_contract_value || 0), 0);
  const overdueCount = opps.filter(o => deadlineStatus(getDeadline(o)) === "overdue").length;
  const atriskCount = opps.filter(o => deadlineStatus(getDeadline(o)) === "atrisk").length;

  return (
    <div style={{
      minWidth: 260, maxWidth: 280, flex: "0 0 260px",
      background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`,
      borderRadius: 14, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 240px)",
    }}>
      {/* Column header */}
      <div style={{
        padding: "12px 14px 10px", borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, position: "sticky", top: 0, zIndex: 1,
        background: "rgba(10,12,26,0.95)", borderRadius: "14px 14px 0 0",
        backdropFilter: "blur(8px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: 12, color: T.text }}>{stage.label}</span>
          <span style={{
            marginLeft: "auto", fontSize: 10, fontWeight: 700,
            background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30`,
            padding: "1px 7px", borderRadius: 99,
          }}>{opps.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalValue > 0 && (
            <span style={{ fontSize: 9, color: T.gold, fontWeight: 600 }}>{fmt$(totalValue)}</span>
          )}
          {overdueCount > 0 && (
            <span style={{ fontSize: 9, color: T.red, fontWeight: 700 }}>⚠ {overdueCount} overdue</span>
          )}
          {atriskCount > 0 && (
            <span style={{ fontSize: 9, color: T.amber, fontWeight: 700 }}>⚑ {atriskCount} at risk</span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ padding: 10, overflowY: "auto", flex: 1 }}>
        {opps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 12px", color: T.muted, fontSize: 11 }}>
            No opportunities
          </div>
        ) : (
          opps.map(o => <KanbanCard key={o.id} opp={o} />)
        )}
      </div>
    </div>
  );
}

// ── Deadline List View ─────────────────────────────────────────────────────────
function DeadlineView({ opps }: { opps: Opportunity[] }) {
  const withDeadline = opps
    .filter(o => getDeadline(o))
    .sort((a, b) => {
      const da = new Date(getDeadline(a)!).getTime();
      const db2 = new Date(getDeadline(b)!).getTime();
      return da - db2;
    });

  const noDeadline = opps.filter(o => !getDeadline(o));

  const overdue  = withDeadline.filter(o => deadlineStatus(getDeadline(o)) === "overdue");
  const atrisk   = withDeadline.filter(o => deadlineStatus(getDeadline(o)) === "atrisk");
  const upcoming = withDeadline.filter(o => deadlineStatus(getDeadline(o)) === "ok");

  function Group({ title, color, items }: { title: string; color: string; items: Opportunity[] }) {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 3, height: 16, background: color, borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color }}>{title}</span>
          <span style={{ fontSize: 10, color: T.muted }}>({items.length})</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map(o => <DeadlineRow key={o.id} opp={o} />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Group title="Overdue" color={T.red} items={overdue} />
      <Group title="Due This Week" color={T.amber} items={atrisk} />
      <Group title="Upcoming" color={T.green} items={upcoming} />
      {noDeadline.length > 0 && (
        <Group title="No Deadline Set" color={T.muted} items={noDeadline} />
      )}
      {opps.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
          <Calendar size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontSize: 13 }}>No opportunities in the pipeline yet.</p>
          <p style={{ fontSize: 11, marginTop: 4 }}>Upload RFPs via the Intake tab to get started.</p>
        </div>
      )}
    </div>
  );
}

function DeadlineRow({ opp }: { opp: Opportunity }) {
  const deadline = getDeadline(opp);
  const dStatus = deadlineStatus(deadline);
  const stage = STAGE_MAP[opp.stage] || { label: opp.stage, color: T.muted };
  const days = daysUntil(deadline);

  const qc = useQueryClient();
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setOwnerOpen(false); setDeadlineOpen(false);
      }
    }
    if (ownerOpen || deadlineOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ownerOpen, deadlineOpen]);

  return (
    <div
      ref={rowRef}
      data-testid={`deadline-row-${opp.id}`}
      style={{
        background: T.surface, border: `1px solid ${dStatus === "overdue" ? `${T.red}40` : dStatus === "atrisk" ? `${T.amber}35` : T.border}`,
        borderRadius: 10, padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}
    >
      {/* Deadline indicator */}
      <div style={{ flexShrink: 0, textAlign: "center", minWidth: 56 }}>
        {deadline ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 900, color: dStatus === "overdue" ? T.red : dStatus === "atrisk" ? T.amber : T.green, lineHeight: 1 }}>
              {days === 0 ? "!" : days != null ? (days < 0 ? `-${Math.abs(days)}` : `+${days}`) : "—"}
            </div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: "0.05em" }}>
              {days === 0 ? "TODAY" : days != null && days < 0 ? "DAYS OVER" : "DAYS"}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>None</div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 3 }}>
          {effectiveLabel(opp)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <StageBadge stage={opp.stage} />
          {opp.owner && (
            <span style={{ fontSize: 10, color: T.muted, display: "flex", alignItems: "center", gap: 3 }}>
              <User size={9} /> {opp.owner}
            </span>
          )}
          {opp.industry && <span style={{ fontSize: 10, color: T.muted }}>{opp.industry}</span>}
        </div>
      </div>

      <div style={{ flexShrink: 0, textAlign: "right" }}>
        {opp.estimated_contract_value && (
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{fmt$(opp.estimated_contract_value)}</div>
        )}
        {deadline && (
          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{fmtDate(deadline)}</div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ position: "relative" }}>
        <button
          onClick={e => { e.stopPropagation(); setDeadlineOpen(v => !v); setOwnerOpen(false); }}
          style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", color: T.muted }}
          title="Set deadline"
        >
          <Calendar size={11} />
        </button>
        {deadlineOpen && <DeadlinePopover opp={opp} onClose={() => setDeadlineOpen(false)} />}
      </div>
      <div style={{ position: "relative" }}>
        <button
          onClick={e => { e.stopPropagation(); setOwnerOpen(v => !v); setDeadlineOpen(false); }}
          style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${T.border}`, background: "transparent", cursor: "pointer", color: T.muted }}
          title="Assign owner"
        >
          <User size={11} />
        </button>
        {ownerOpen && <OwnerPopover opp={opp} onClose={() => setOwnerOpen(false)} />}
      </div>
    </div>
  );
}

// ── Summary Stats Bar ──────────────────────────────────────────────────────────
function StatsBar({ opps }: { opps: Opportunity[] }) {
  const total = opps.length;
  const overdue = opps.filter(o => deadlineStatus(getDeadline(o)) === "overdue").length;
  const atrisk = opps.filter(o => deadlineStatus(getDeadline(o)) === "atrisk").length;
  const totalValue = opps.reduce((s, o) => s + (o.estimated_contract_value || 0), 0);
  const activeStages = ["new", "qualifying", "drafting", "submitted", "decision"];
  const activeCount = opps.filter(o => activeStages.includes(o.stage)).length;

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
      {[
        { label: "Total RFPs", value: total, color: T.text },
        { label: "Active", value: activeCount, color: T.blue },
        { label: "Overdue", value: overdue, color: T.red },
        { label: "At Risk", value: atrisk, color: T.amber },
        { label: "Pipeline Value", value: fmt$(totalValue), color: T.gold, wide: true },
      ].map(stat => (
        <div
          key={stat.label}
          style={{
            background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: "10px 16px", minWidth: stat.wide ? 140 : 90, textAlign: "center",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: stat.color, fontVariantNumeric: "tabular-nums" }}>
            {stat.value}
          </div>
          <div style={{ fontSize: 9, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RfpBoard() {
  const [view, setView] = useState<"board" | "deadlines">("board");
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const { data: opps = [], isLoading } = useQuery<Opportunity[]>({
    queryKey: ["/api/rfp/opportunities"],
    refetchInterval: 15_000,
  });

  const filtered = stageFilter ? opps.filter(o => o.stage === stageFilter) : opps;

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.key] = opps.filter(o => o.stage === stage.key);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  return (
    <Layout>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 4 }}>
              RFP Intelligence OS
            </p>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#e8eaf6", lineHeight: 1.2, margin: 0 }}>
              Workflow Board
            </h1>
            <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
              Track deadlines, move opportunities, and keep the pipeline moving.
            </p>
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 6, background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 4 }}>
            {[
              { id: "board", label: "Board", icon: LayoutGrid },
              { id: "deadlines", label: "Deadlines", icon: Clock },
            ].map(v => {
              const Icon = v.icon;
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id as any)}
                  data-testid={`view-toggle-${v.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 7,
                    border: "none", cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400,
                    background: active ? T.goldDim : "transparent",
                    color: active ? T.gold : T.muted,
                    transition: "all 0.12s",
                  }}
                >
                  <Icon size={13} /> {v.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <StatsBar opps={opps} />

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${T.border}`, borderTop: `2px solid ${T.gold}`, borderRadius: "50%", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
          <p>Loading pipeline…</p>
        </div>
      )}

      {!isLoading && opps.length === 0 && (
        <div style={{
          textAlign: "center", padding: "80px 0",
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
        }}>
          <KanbanSquare size={40} style={{ color: T.gold, marginBottom: 14, opacity: 0.7 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text, margin: "0 0 8px" }}>No RFPs in the pipeline yet</h3>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>
            Upload RFPs via the Intake tab. Once parsed, they'll appear here for tracking.
          </p>
          <a
            href="/rfp-os"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px",
              background: T.goldDim, border: `1px solid ${T.goldBorder}`, borderRadius: 10,
              color: T.gold, fontWeight: 700, fontSize: 13, textDecoration: "none",
            }}
          >
            <FileSearch size={14} /> Go to RFP Intake <ArrowRight size={12} />
          </a>
        </div>
      )}

      {!isLoading && opps.length > 0 && (
        <>
          {view === "board" && (
            <div style={{ overflowX: "auto", paddingBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, minWidth: "max-content", alignItems: "flex-start" }}>
                {STAGES.map(stage => (
                  <KanbanColumn key={stage.key} stage={stage} opps={grouped[stage.key] || []} />
                ))}
              </div>
            </div>
          )}

          {view === "deadlines" && <DeadlineView opps={opps} />}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </Layout>
  );
}
