import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Grid3x3,
  Crosshair,
  Wrench,
  FileSearch,
  Presentation,
  Rows3,
  Square,
  Terminal,
  Printer,
  Check,
  ChevronDown,
} from "lucide-react";

export type ViewMode =
  | "default"
  | "bridge"
  | "cockpit"
  | "workbench"
  | "receipts"
  | "presentation"
  | "compact"
  | "comfortable"
  | "terminal"
  | "brief";

type ViewDef = {
  id: ViewMode;
  label: string;
  hint: string;
  Icon: typeof LayoutDashboard;
  accent: string;
};

const VIEWS: ViewDef[] = [
  { id: "default", label: "Default", hint: "Standard fiduciary view", Icon: LayoutDashboard, accent: "#00D4FF" },
  { id: "bridge", label: "Bridge", hint: "Four tiles · one screen · doctrine mode", Icon: Grid3x3, accent: "#00FF94" },
  { id: "cockpit", label: "Cockpit", hint: "Single-tile drill, 6 widgets max", Icon: Crosshair, accent: "#FFB800" },
  { id: "workbench", label: "Workbench", hint: "Action-first — appeals, redlines, filings", Icon: Wrench, accent: "#FF6B1A" },
  { id: "receipts", label: "Receipts", hint: "Evidence trail · 7-gate provenance", Icon: FileSearch, accent: "#A855F7" },
  { id: "presentation", label: "Presentation", hint: "Full-screen, board-ready type", Icon: Presentation, accent: "#FF4D6D" },
  { id: "compact", label: "Compact", hint: "Dense tables, more rows per pane", Icon: Rows3, accent: "#8AB4F8" },
  { id: "comfortable", label: "Comfortable", hint: "Generous spacing, larger touch targets", Icon: Square, accent: "#00FF94" },
  { id: "terminal", label: "Terminal", hint: "Bloomberg-style mono · neon on black", Icon: Terminal, accent: "#FFB800" },
  { id: "brief", label: "Brief", hint: "Print/export ready · serif · light", Icon: Printer, accent: "#FFFFFF" },
];

const STORAGE_KEY = "kiq.viewMode";

function getInitial(): ViewMode {
  if (typeof window === "undefined") return "default";
  const v = window.localStorage.getItem(STORAGE_KEY) as ViewMode | null;
  return v && VIEWS.some((x) => x.id === v) ? v : "default";
}

export function applyViewMode(mode: ViewMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-view-mode", mode);
}

export function ViewSwitcher() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>(() => getInitial());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyViewMode(mode);
    window.localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent("kiq:viewmode", { detail: mode }));
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = VIEWS.find((v) => v.id === mode) ?? VIEWS[0];
  const CurrentIcon = current.Icon;

  return (
    <div ref={ref} className="relative" data-testid="view-switcher">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-center gap-2 px-3 h-9 rounded-lg transition-all"
        style={{
          background:
            "linear-gradient(180deg, rgba(28,34,68,0.85) 0%, rgba(14,18,42,0.85) 100%)",
          border: `1px solid ${open ? current.accent + "55" : "rgba(255,255,255,0.08)"}`,
          boxShadow: open
            ? `0 0 0 1px ${current.accent}33, 0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)`
            : "0 1px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          color: "rgba(220,230,250,0.95)",
        }}
        data-testid="button-view-switcher"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            color: current.accent,
            filter: `drop-shadow(0 0 6px ${current.accent}66)`,
          }}
        >
          <CurrentIcon size={14} strokeWidth={2.25} />
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.14em] font-semibold"
          style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
        >
          {current.label}
        </span>
        <ChevronDown
          size={12}
          className="transition-transform"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "rgba(180,200,230,0.6)",
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="View mode"
          className="absolute right-0 mt-2 w-[320px] overflow-hidden z-50"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,26,54,0.98) 0%, rgba(8,12,30,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            backdropFilter: "blur(28px)",
            boxShadow:
              "0 24px 64px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            animation: "kiq-vs-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          data-testid="view-switcher-menu"
        >
          <style>{`
            @keyframes kiq-vs-in {
              from { opacity: 0; transform: translateY(-6px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
          `}</style>

          <div
            className="px-3 py-2 flex items-center justify-between"
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)",
            }}
          >
            <span
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: "rgba(160,180,210,0.7)" }}
            >
              View Mode
            </span>
            <span
              className="text-[9px] uppercase tracking-[0.16em]"
              style={{ color: "rgba(120,140,170,0.6)" }}
            >
              {VIEWS.length} options
            </span>
          </div>

          <div className="py-1 max-h-[420px] overflow-y-auto custom-scrollbar">
            {VIEWS.map((v) => {
              const Icon = v.Icon;
              const active = v.id === mode;
              return (
                <button
                  key={v.id}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setMode(v.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left"
                  style={{
                    background: active
                      ? `linear-gradient(90deg, ${v.accent}18 0%, transparent 70%)`
                      : "transparent",
                    borderLeft: `2px solid ${active ? v.accent : "transparent"}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "rgba(255,255,255,0.03)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }
                  }}
                  data-testid={`view-option-${v.id}`}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: `${v.accent}14`,
                      border: `1px solid ${v.accent}33`,
                      color: v.accent,
                      filter: active ? `drop-shadow(0 0 8px ${v.accent}66)` : "none",
                    }}
                  >
                    <Icon size={14} strokeWidth={2.25} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className="block text-[12px] font-semibold tracking-tight"
                      style={{ color: active ? "#FFFFFF" : "rgba(230,235,250,0.95)" }}
                    >
                      {v.label}
                    </span>
                    <span
                      className="block text-[10.5px] truncate"
                      style={{ color: "rgba(160,180,210,0.65)" }}
                    >
                      {v.hint}
                    </span>
                  </span>
                  {active && (
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      style={{ color: v.accent, flexShrink: 0 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="px-3 py-2 text-[9.5px] uppercase tracking-[0.18em]"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(120,140,170,0.55)",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            Persists across sessions · ⌘K for full nav
          </div>
        </div>
      )}
    </div>
  );
}
