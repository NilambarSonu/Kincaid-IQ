import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package2, CheckCircle2, AlertTriangle, Clock, XCircle,
  Download, Loader2, FileText, BarChart2, Pill, Building2,
  ChevronLeft, RefreshCw, Archive, Hash, Mail, Send,
  Search, ChevronDown, X, Plus, Trash2, Users, ShieldCheck, Upload,
  Eye, GitCompare, Maximize2, ChevronRight, ZoomIn, ZoomOut, RotateCcw,
  Paperclip,
} from "lucide-react";


const GOLD   = "#FFB800";
const GREEN  = "#10B981";
const RED    = "#FF4D6D";
const BLUE   = "#00D4FF";
const PURPLE = "#BF5FFF";

type ReadinessStatus = "ready" | "incomplete" | "no_data";

interface Component {
  id:        string;
  label:     string;
  desc:      string;
  icon:      React.ElementType;
  color:     string;
  status:    ReadinessStatus;
  tooltip?:  string;
  key?:      string;
  preview?:  string | null;
  previewLoading?: boolean;
}

// Static catalogue of component ids → display metadata. Used both by the
// live builder (which augments each entry with status + preview) and by the
// historical "View delivery" drawer, which only knows the stored component
// id strings from the audit log row.
const COMPONENT_META: Record<string, { label: string; desc: string; icon: React.ElementType; color: string }> = {
  rx_redline: {
    label: "PBM Contract Clarity 360 — Redline (.docx)",
    desc:  "Word doc with model contract language for all weak provisions",
    icon:  Pill,
    color: GREEN,
  },
  rx_scorecard: {
    label: "PBM Contract Clarity 360 — Scorecard (JSON)",
    desc:  "Machine-readable provision scores, findings, and risk flags",
    icon:  FileText,
    color: PURPLE,
  },
  benchmarking_employer: {
    label: "Benchmarking Employer Report (JSON)",
    desc:  "EIN-level plan data: admin fees, broker commissions, filing history",
    icon:  Building2,
    color: BLUE,
  },
  benchmarking_summary: {
    label: "Benefits Benchmarking Summary (JSON)",
    desc:  "National P50/P75/P90 peer comparison for admin fees & broker commissions",
    icon:  BarChart2,
    color: GOLD,
  },
  board_pack: {
    label: "War Room Fiduciary Intelligence Brief (HTML)",
    desc:  "Printable board-grade claims report — open in browser, print to PDF",
    icon:  Package2,
    color: PURPLE,
  },
};

function statusMeta(s: ReadinessStatus) {
  return {
    ready:      { icon: CheckCircle2, color: GREEN, label: "Ready",      bg: `${GREEN}12`   },
    incomplete: { icon: Clock,        color: GOLD,  label: "Incomplete", bg: `${GOLD}10`    },
    no_data:    { icon: XCircle,      color: RED,   label: "No data",    bg: `${RED}10`     },
  }[s];
}

function StatusBadge({ status }: { status: ReadinessStatus }) {
  const m = statusMeta(status);
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-[0.12em] text-[9px]"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}35` }}>
      <Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

function ComponentCard({
  comp, checked, onToggle, onView,
}: { comp: Component; checked: boolean; onToggle: () => void; onView: () => void }) {
  const Icon = comp.icon;
  const enabled = comp.status === "ready";

  return (
    <motion.div
      data-testid={`component-card-${comp.id}`}
      whileHover={enabled ? { scale: 1.01 } : {}}
      onClick={enabled ? onToggle : undefined}
      role={enabled ? "button" : undefined}
      tabIndex={enabled ? 0 : -1}
      onKeyDown={enabled ? (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
      } : undefined}
      className="w-full text-left rounded-2xl p-4 transition-all relative"
      style={{
        background: checked ? `${comp.color}12` : "#ffffff",
        border: `1px solid ${checked ? comp.color + "50" : "#e2e8f0"}`,
        opacity: enabled ? 1 : 0.45,
        cursor: enabled ? "pointer" : "not-allowed",
      }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${comp.color}14`, border: `1px solid ${comp.color}28` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: comp.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[12px] font-bold text-[var(--kiq-ink)]/90">{comp.label}</span>
            <StatusBadge status={comp.status} />
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">{comp.tooltip ?? comp.desc}</p>
          {enabled && (
            <div
              data-testid={`component-preview-${comp.id}`}
              className="mt-1.5 flex items-start gap-1.5"
            >
              {comp.previewLoading ? (
                <span
                  className="inline-block h-2 rounded animate-pulse"
                  style={{ background: "#f1f5f9", width: 140 }}
                />
              ) : comp.preview ? (
                <span
                  className="text-[10px] font-mono leading-snug"
                  style={{ color: `${comp.color}CC` }}
                >
                  <span className="opacity-50">▸ </span>
                  {comp.preview}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 mt-0.5 flex items-center gap-2">
          {enabled && (
            <button
              type="button"
              data-testid={`btn-view-${comp.id}`}
              onClick={(e) => { e.stopPropagation(); onView(); }}
              title={`Preview ${comp.label}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono font-bold uppercase tracking-[0.14em] transition-colors"
              style={{
                color:      comp.color,
                background: `${comp.color}10`,
                border:     `1px solid ${comp.color}35`,
              }}
            >
              <Eye className="w-3 h-3" />
              View
            </button>
          )}
          <div className="w-4 h-4 rounded border transition-colors flex items-center justify-center"
            style={{
              background: checked && enabled ? comp.color : "transparent",
              borderColor: checked && enabled ? comp.color : "rgba(255,255,255,0.18)",
            }}>
            {checked && enabled && <span className="text-black text-[8px] font-black">✓</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type PreviewPayload = {
  ok: boolean;
  kind?: "json" | "text" | "docx" | "pdf";
  filename?: string;
  body?: string;
  data_url?: string;
  component_url?: string;
  size_bytes?: number;
  error?: string;
  snapshot?: boolean;
  snapshot_at?: string | null;
  sha256?: string;
};

// Stored deliveries record component *labels* (e.g. "PBM Contract Clarity 360 Redline
// (.docx)"); the preview / snapshot endpoints and COMPONENT_META are keyed by
// component *ids* (e.g. "rx_redline"). Normalize so both work.
const _COMPONENT_LABEL_TO_ID: Record<string, string> = {
  "PBM Contract Clarity 360 Redline (.docx)":           "rx_redline",
  "PBM Contract Clarity 360 Scorecard (JSON)":          "rx_scorecard",
  // Legacy labels persisted before the "Rx Defense" to "PBM Contract Clarity 360" rename.
  "Rx Defense Redline (.docx)":           "rx_redline",
  "Rx Defense Scorecard (JSON)":          "rx_scorecard",
  "Benchmarking Employer Report (JSON)":  "benchmarking_employer",
  "Benefits Benchmarking Summary (JSON)": "benchmarking_summary",
};
function normalizeComponentId(raw: string): string {
  if (COMPONENT_META[raw]) return raw;
  if (_COMPONENT_LABEL_TO_ID[raw]) return _COMPONENT_LABEL_TO_ID[raw];
  if (raw && raw.startsWith("War Room Fiduciary Intelligence Brief")) return "board_pack";
  return raw;
}

// Full-viewport overlay for reading a PDF or Word deliverable properly. The
// 720px drawer is fine for a sanity check but cramped for a multi-page board
// pack or a long redline. This renders the same bytes — PDF in the browser
// viewer, .docx via docx-preview — edge to edge so the user can review the
// deliverable at full size before sending. Reusable from any preview surface.
function FullScreenPreview({
  payload, title, onClose,
}: {
  payload: PreviewPayload | null;
  title: string;
  onClose: () => void;
}) {
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [docxRendering, setDocxRendering] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  const open = !!payload?.ok && (payload.kind === "pdf" || payload.kind === "docx");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  useEffect(() => {
    if (!open || payload?.kind !== "docx" || !payload.component_url) return;
    let cancelled = false;
    setDocxRendering(true);
    setDocxError(null);
    (async () => {
      try {
        const res = await fetch(payload.component_url!, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const container = docxContainerRef.current;
        if (!container) throw new Error("Preview container unavailable");
        container.innerHTML = "";
        const { renderAsync } = await import("docx-preview");
        await renderAsync(buf, container, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          experimental: true,
          useBase64URL: true,
        });
        if (cancelled) return;
      } catch (e: any) {
        if (!cancelled) setDocxError(e?.message || "Could not render Word document");
      } finally {
        if (!cancelled) setDocxRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, payload?.kind, payload?.component_url]);

  return (
    <AnimatePresence>
      {open && payload && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex flex-col"
          style={{ background: "#F8FAFC" }}
          data-testid="fullscreen-preview"
        >
          <header
            className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0"
            style={{ borderColor: "#e2e8f0" }}
          >
            <FileText className="w-4 h-4 flex-shrink-0" style={{ color: BLUE }} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-[var(--kiq-ink)] truncate">{title}</div>
              <div className="text-[10px] font-mono text-zinc-500 truncate">
                {payload.filename || ""}
                {payload.kind ? ` · ${payload.kind.toUpperCase()} · full screen` : ""}
              </div>
            </div>
            {payload.data_url && payload.filename && (
              <a
                href={payload.data_url}
                download={payload.filename}
                data-testid="btn-fullscreen-download"
                title="Download this component file"
                className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-colors"
                style={{ color: GOLD, background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}
              >
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              data-testid="btn-fullscreen-close"
              title="Exit full screen (Esc)"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] hover:bg-[var(--kiq-surface)]/5 transition-colors"
              style={{ color: "#9CA3AF", border: "1px solid #cbd5e1" }}
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden">
            {payload.kind === "pdf" && (payload.component_url || payload.data_url) && (
              <iframe
                src={payload.component_url || payload.data_url}
                title={payload.filename || "PDF preview"}
                data-testid="fullscreen-pdf"
                className="w-full h-full"
                style={{ background: "white", border: "none" }}
              />
            )}
            {payload.kind === "docx" && (
              <div className="w-full h-full flex flex-col">
                {docxRendering && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 px-5 py-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Rendering Word document…
                  </div>
                )}
                {docxError && payload.body ? (
                  <pre
                    className="flex-1 overflow-auto text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-words p-6"
                    style={{ color: "#E4E4E7" }}
                  >
                    {payload.body}
                  </pre>
                ) : (
                  <div
                    ref={docxContainerRef}
                    className="docx-preview-host flex-1"
                    data-testid="fullscreen-docx-render"
                    style={{ background: "#525659", overflow: "auto", padding: "24px 0" }}
                  />
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ComponentPreviewDrawer({
  viewingId, onClose, components, contractId, ein, clientName,
}: {
  viewingId: string | null;
  onClose: () => void;
  components: Component[];
  contractId: string;
  ein: string;
  clientName: string;
}) {
  const comp = components.find(c => c.id === viewingId) || null;
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [docxRendered, setDocxRendered] = useState(false);
  const [docxRendering, setDocxRendering] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [docxPageCount, setDocxPageCount] = useState(0);
  const [docxCurrentPage, setDocxCurrentPage] = useState(1);
  const [docxFitScale, setDocxFitScale] = useState(1);
  const [docxZoom, setDocxZoom] = useState(1);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const docxWrapperRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (viewingId) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [viewingId, onClose]);

  useEffect(() => {
    if (!viewingId || !comp) {
      setPayload(null);
      setDocxRendered(false);
      setDocxError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPayload(null);
    setDocxRendered(false);
    setDocxError(null);
    setFullscreen(false);
    (async () => {
      try {
        const body: Record<string, unknown> = {
          component_id: viewingId,
          client_name: clientName,
        };
        if (contractId) body.rx_defense_id = contractId;
        if (ein)        body.ein = ein;
        const res = await apiRequest("POST", "/api/export/client-package/preview", body);
        const json: PreviewPayload = await res.json().catch(() => ({ ok: false, error: "Invalid response" }));
        if (!cancelled) setPayload(json);
      } catch (e: any) {
        if (!cancelled) setPayload({ ok: false, error: e?.message || "Preview failed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [viewingId, comp, contractId, ein, clientName]);

  // For .docx components, fetch the raw bytes via the per-component endpoint
  // and render the underlying OOXML faithfully with docx-preview. Unlike a
  // plain HTML conversion, this reproduces the real Word styling — colored
  // headings, paragraph shading (green model-language blocks), borders,
  // indentation, margins and page layout — so the in-app preview is a
  // pixel-level match for the .docx that ships in the ZIP.
  useEffect(() => {
    if (!payload?.ok || payload.kind !== "docx" || !payload.component_url) return;
    let cancelled = false;
    setDocxRendering(true);
    setDocxRendered(false);
    setDocxError(null);
    (async () => {
      try {
        const res = await fetch(payload.component_url!, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const container = docxContainerRef.current;
        if (!container) throw new Error("Preview container unavailable");
        container.innerHTML = "";
        const { renderAsync } = await import("docx-preview");
        await renderAsync(buf, container, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          experimental: true,
          useBase64URL: true,
        });
        if (cancelled) return;
        // Scale each rendered page to fit the drawer width so the faithful
        // Letter-width layout never forces a horizontal scrollbar. The fit
        // scale is the baseline; the user zoom multiplier is applied on top
        // by a dedicated effect so page-nav + zoom controls can override it.
        const wrapper = container.querySelector<HTMLElement>(".docx-wrapper");
        const page = container.querySelector<HTMLElement>(".docx");
        const pages = container.querySelectorAll<HTMLElement>("section.docx");
        docxWrapperRef.current = wrapper;
        let fit = 1;
        if (wrapper && page) {
          const avail = container.clientWidth - 4;
          const natural = page.offsetWidth;
          if (natural > 0 && avail > 0) {
            fit = Math.min(1, avail / natural);
          }
        }
        setDocxFitScale(fit);
        setDocxZoom(1);
        setDocxPageCount(pages.length);
        setDocxCurrentPage(1);
        setDocxRendered(true);
      } catch (e: any) {
        if (!cancelled) setDocxError(e?.message || "Could not render Word document");
      } finally {
        if (!cancelled) setDocxRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [payload?.ok, payload?.kind, payload?.component_url]);

  // Apply the effective scale (auto-fit baseline × user zoom) to the rendered
  // docx wrapper whenever either input changes.
  useEffect(() => {
    const wrapper = docxWrapperRef.current;
    if (!wrapper) return;
    (wrapper.style as any).zoom = String(docxFitScale * docxZoom);
  }, [docxFitScale, docxZoom, docxRendered]);

  // Track which page is in view as the user scrolls the canvas.
  function onDocxScroll() {
    const c = docxContainerRef.current;
    if (!c || docxPageCount <= 1) return;
    const pages = c.querySelectorAll<HTMLElement>("section.docx");
    if (!pages.length) return;
    const cTop = c.getBoundingClientRect().top;
    const threshold = c.clientHeight / 3;
    let cur = 1;
    pages.forEach((pg, i) => {
      if (pg.getBoundingClientRect().top - cTop <= threshold) cur = i + 1;
    });
    setDocxCurrentPage(cur);
  }

  function goToDocxPage(p: number) {
    const c = docxContainerRef.current;
    if (!c) return;
    const target = Math.min(docxPageCount, Math.max(1, p));
    const pages = c.querySelectorAll<HTMLElement>("section.docx");
    const el = pages[target - 1];
    if (!el) return;
    const offset = el.getBoundingClientRect().top - c.getBoundingClientRect().top;
    c.scrollTo({ top: c.scrollTop + offset - 8, behavior: "smooth" });
    setDocxCurrentPage(target);
  }

  function zoomIn()    { setDocxZoom(z => Math.min(3,  +(z + 0.15).toFixed(2))); }
  function zoomOut()   { setDocxZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2))); }
  function zoomReset() { setDocxZoom(1); }

  const open = !!viewingId && !!comp;

  function copyBody() {
    if (payload?.body) {
      navigator.clipboard.writeText(payload.body).catch(() => {});
    }
  }

  function fmtBytes(n?: number): string {
    if (!n || n <= 0) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} KB`;
    return `${n} B`;
  }

  return (
    <AnimatePresence>
      {open && comp && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.6)" }}
            data-testid="component-preview-backdrop"
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed top-0 right-0 bottom-0 z-[61] flex flex-col"
            style={{
              width: "min(720px, 96vw)",
              background: "#F8FAFC",
              borderLeft: "1px solid #e2e8f0",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.55)",
            }}
            data-testid="component-preview-drawer"
          >
            <header
              className="flex items-start gap-3 px-5 py-4 border-b"
              style={{ borderColor: "#f1f5f9" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${comp.color}14`, border: `1px solid ${comp.color}28` }}>
                <comp.icon className="w-4.5 h-4.5" style={{ color: comp.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[var(--kiq-ink)]">{comp.label}</div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {payload?.filename || comp.id}
                  {payload?.kind ? ` · ${payload.kind.toUpperCase()} preview` : ""}
                  {payload?.size_bytes ? ` · ${fmtBytes(payload.size_bytes)}` : ""}
                </div>
              </div>
              {payload?.ok && (payload.kind === "pdf" || payload.kind === "docx") && (
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  data-testid="btn-preview-fullscreen"
                  title="Open full screen"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-colors"
                  style={{ color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}35` }}
                >
                  <Maximize2 className="w-3 h-3" />
                  Full screen
                </button>
              )}
              {payload?.body && (
                <button
                  type="button"
                  onClick={copyBody}
                  data-testid="btn-preview-copy"
                  title="Copy contents to clipboard"
                  className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-colors"
                  style={{ color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}35` }}
                >
                  Copy
                </button>
              )}
              {payload?.data_url && payload.filename && (
                <a
                  href={payload.data_url}
                  download={payload.filename}
                  data-testid="btn-preview-download"
                  title="Download this component file"
                  className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-colors"
                  style={{ color: GOLD, background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}
                >
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                data-testid="btn-preview-close"
                title="Close preview"
                className="p-1.5 rounded-md hover:bg-[var(--kiq-surface)]/5 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4" data-testid="component-preview-body">
              {loading && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400" data-testid="preview-loading">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Building {comp.label} from server…
                </div>
              )}
              {!loading && payload && !payload.ok && (
                <div
                  className="rounded-lg p-4 text-[11px] font-mono"
                  style={{ color: "#FCA5A5", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}
                  data-testid="preview-error"
                >
                  {payload.error || "Preview unavailable."}
                </div>
              )}
              {!loading && payload?.ok && payload.kind === "pdf" && (payload.component_url || payload.data_url) && (
                <div
                  className="docx-preview-host rounded-lg"
                  data-testid="preview-pdf-canvas"
                  style={{
                    background: "#525659",
                    border: "1px solid #f1f5f9",
                    minHeight: "calc(100vh - 220px)",
                    maxHeight: "calc(100vh - 160px)",
                    overflow: "auto",
                    padding: "12px",
                  }}
                >
                  <iframe
                    src={`${payload.component_url || payload.data_url}#toolbar=0&navpanes=0&view=FitH`}
                    title={payload.filename || "PDF preview"}
                    data-testid="preview-pdf"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "calc(100vh - 244px)",
                      background: "white",
                      border: "none",
                      borderRadius: "2px",
                      boxShadow: "0 6px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  />
                </div>
              )}
              {!loading && payload?.ok && payload.kind === "docx" && (
                <div data-testid="preview-docx">
                  {docxRendering && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 mb-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Rendering Word document…
                    </div>
                  )}
                  {docxError && (
                    <div
                      className="rounded-lg p-3 mb-3 text-[11px] font-mono"
                      style={{ color: "#FCA5A5", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}
                    >
                      Word renderer failed ({docxError}) — falling back to extracted text.
                    </div>
                  )}
                  {docxError && payload.body ? (
                    <pre
                      className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words rounded-lg p-4"
                      style={{
                        color: "#E4E4E7",
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      {payload.body}
                    </pre>
                  ) : (
                    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                      {docxRendered && docxPageCount > 0 && (
                        <div
                          className="flex items-center justify-between px-2.5 py-1.5"
                          style={{ background: "#1A1D24", borderBottom: "1px solid #f1f5f9" }}
                          data-testid="docx-toolbar"
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => goToDocxPage(docxCurrentPage - 1)}
                              disabled={docxCurrentPage <= 1}
                              data-testid="btn-docx-prev-page"
                              title="Previous page"
                              className="p-1 rounded-md hover:bg-[var(--kiq-surface)]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ChevronLeft className="w-3.5 h-3.5 text-[var(--kiq-muted)]" />
                            </button>
                            <span
                              className="text-[10px] font-mono tabular-nums text-[var(--kiq-muted)] px-1 select-none"
                              data-testid="text-docx-page"
                            >
                              {docxCurrentPage} / {docxPageCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => goToDocxPage(docxCurrentPage + 1)}
                              disabled={docxCurrentPage >= docxPageCount}
                              data-testid="btn-docx-next-page"
                              title="Next page"
                              className="p-1 rounded-md hover:bg-[var(--kiq-surface)]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ChevronRight className="w-3.5 h-3.5 text-[var(--kiq-muted)]" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={zoomOut}
                              disabled={docxZoom <= 0.3}
                              data-testid="btn-docx-zoom-out"
                              title="Zoom out"
                              className="p-1 rounded-md hover:bg-[var(--kiq-surface)]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ZoomOut className="w-3.5 h-3.5 text-[var(--kiq-muted)]" />
                            </button>
                            <button
                              type="button"
                              onClick={zoomReset}
                              data-testid="btn-docx-zoom-reset"
                              title="Reset zoom (fit width)"
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[var(--kiq-surface)]/10 transition-colors"
                            >
                              <span className="text-[10px] font-mono tabular-nums text-[var(--kiq-muted)] select-none" data-testid="text-docx-zoom">
                                {Math.round(docxFitScale * docxZoom * 100)}%
                              </span>
                              <RotateCcw className="w-3 h-3 text-zinc-400" />
                            </button>
                            <button
                              type="button"
                              onClick={zoomIn}
                              disabled={docxZoom >= 3}
                              data-testid="btn-docx-zoom-in"
                              title="Zoom in"
                              className="p-1 rounded-md hover:bg-[var(--kiq-surface)]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ZoomIn className="w-3.5 h-3.5 text-[var(--kiq-muted)]" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div
                        ref={docxContainerRef}
                        onScroll={onDocxScroll}
                        className="docx-preview-host"
                        data-testid="preview-docx-render"
                        style={{
                          background: "#525659",
                          minHeight: "calc(100vh - 220px)",
                          maxHeight: "calc(100vh - 160px)",
                          overflow: "auto",
                          padding: "12px 0",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              {!loading && payload?.ok && payload.kind !== "pdf" && payload.kind !== "docx" && payload.body && (
                <pre
                  className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words rounded-lg p-4"
                  style={{
                    color: "#E4E4E7",
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid #f1f5f9",
                  }}
                  data-testid={`preview-${payload.kind}`}
                >
                  {payload.body}
                </pre>
              )}
            </div>

            <footer
              className="px-5 py-3 border-t text-[9px] font-mono text-zinc-600 flex items-center gap-2"
              style={{ borderColor: "#f1f5f9" }}
            >
              <FileText className="w-3 h-3" />
              <span>
                Built by the same generator that assembles the final ZIP{payload?.kind === "docx" && docxRendered ? " · Word document rendered faithfully from real .docx bytes" : payload?.kind === "docx" && docxError ? " · Word document shown as extracted text" : payload?.kind === "docx" ? " · rendering Word document" : payload?.kind === "pdf" ? " · PDF served as inline bytes" : ""}
              </span>
            </footer>
          </motion.aside>
          <FullScreenPreview
            payload={fullscreen ? payload : null}
            title={comp.label}
            onClose={() => setFullscreen(false)}
          />
        </>
      )}
    </AnimatePresence>
  );
}


type DeliveryForPreview = {
  id: number;
  recipient: string;
  recipients?: string[];
  subject?: string | null;
  filename?: string | null;
  components: string[];
  ein?: string | null;
  rx_defense_id?: string | null;
  client_name?: string | null;
  created_at?: string | null;
  snapshot_components?: string[];
  snapshot_at?: string | null;
};

// Drawer variant for the audit log: shows the components that were included
// in a historical delivery, each previewable inline. Reuses the same
// /client-package/preview endpoint as the live builder but pulls
// ein / rx_defense_id / client_name from the stored delivery row so the
// preview reflects what actually went out.
function DeliveryPreviewDrawer({
  delivery, onClose,
}: {
  delivery: DeliveryForPreview | null;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (delivery) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [delivery, onClose]);

  // Normalized component ids for this delivery (stored values may be labels).
  const compIds: string[] = [];
  for (const raw of delivery?.components || []) {
    const id = normalizeComponentId(raw);
    if (!compIds.includes(id)) compIds.push(id);
  }
  const snapshotIds = delivery?.snapshot_components || [];

  // Auto-select the first component when a delivery is opened so the user
  // immediately sees content instead of a list-only state.
  useEffect(() => {
    if (delivery && compIds.length > 0) {
      setActiveId(compIds[0]);
    } else {
      setActiveId(null);
      setPayload(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery]);

  useEffect(() => {
    if (!delivery || !activeId) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPayload(null);
    const preferSnapshot = (delivery.snapshot_components || []).includes(activeId);
    (async () => {
      try {
        let json: PreviewPayload;
        if (preferSnapshot) {
          // Prefer the byte-identical snapshot captured the day this delivery
          // was sent. Fall back to a live rebuild if the snapshot read fails.
          const res = await fetch(
            `/api/export/client-package/snapshot/${delivery.id}/${encodeURIComponent(activeId)}`,
            { credentials: "include" },
          );
          json = await res.json().catch(() => ({ ok: false }) as PreviewPayload);
          if (!json?.ok) {
            json = await fetchLivePreview(delivery, activeId);
          }
        } else {
          json = await fetchLivePreview(delivery, activeId);
        }
        if (!cancelled) setPayload(json);
      } catch (e: any) {
        if (!cancelled) setPayload({ ok: false, error: e?.message || "Preview failed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [delivery, activeId]);

  async function fetchLivePreview(d: DeliveryForPreview, componentId: string): Promise<PreviewPayload> {
    const body: Record<string, unknown> = {
      component_id: componentId,
      client_name:  d.client_name || "Client",
    };
    if (d.rx_defense_id) body.rx_defense_id = d.rx_defense_id;
    if (d.ein)           body.ein           = d.ein;
    const res = await apiRequest("POST", "/api/export/client-package/preview", body);
    return res.json().catch(() => ({ ok: false, error: "Invalid response" }) as PreviewPayload);
  }

  function fmtBytes(n?: number): string {
    if (!n || n <= 0) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} KB`;
    return `${n} B`;
  }

  const open = !!delivery;
  const activeMeta = activeId ? COMPONENT_META[activeId] : null;
  const when = delivery?.created_at ? new Date(delivery.created_at) : null;
  const whenLabel = when
    ? when.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
  const toLabel = delivery
    ? (delivery.recipients && delivery.recipients.length > 0 ? delivery.recipients.join(", ") : delivery.recipient)
    : "";

  return (
    <AnimatePresence>
      {open && delivery && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60]"
            style={{ background: "rgba(0,0,0,0.6)" }}
            data-testid="delivery-preview-backdrop"
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed top-0 right-0 bottom-0 z-[61] flex flex-col"
            style={{
              width: "min(880px, 98vw)",
              background: "#F8FAFC",
              borderLeft: "1px solid #e2e8f0",
              boxShadow: "-20px 0 60px rgba(0,0,0,0.55)",
            }}
            data-testid="delivery-preview-drawer"
          >
            <header
              className="flex items-start gap-3 px-5 py-4 border-b"
              style={{ borderColor: "#f1f5f9" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}28` }}>
                <Archive className="w-4.5 h-4.5" style={{ color: GOLD }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[var(--kiq-ink)] truncate" data-testid="delivery-preview-title">
                  Delivery #{delivery.id} · {toLabel}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {whenLabel}
                  {delivery.client_name ? ` · ${delivery.client_name}` : ""}
                  {delivery.ein ? ` · EIN ${delivery.ein}` : ""}
                  {delivery.filename ? ` · ${delivery.filename}` : ""}
                </div>
                {delivery.subject && (
                  <div className="text-[10px] text-zinc-600 truncate mt-0.5">Subject: {delivery.subject}</div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                data-testid="btn-delivery-preview-close"
                title="Close preview"
                className="p-1.5 rounded-md hover:bg-[var(--kiq-surface)]/5 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </header>

            <div className="flex-1 overflow-hidden flex min-h-0">
              {/* Components list */}
              <div
                className="w-[260px] flex-shrink-0 overflow-y-auto border-r py-2"
                style={{ borderColor: "#f1f5f9" }}
                data-testid="delivery-preview-components"
              >
                <div className="px-3 pb-2 text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-600">
                  {compIds.length} component{compIds.length === 1 ? "" : "s"} sent
                </div>
                {compIds.map((cid) => {
                  const meta = COMPONENT_META[cid];
                  const Icon = meta?.icon || FileText;
                  const color = meta?.color || "#888";
                  const isActive = activeId === cid;
                  const hasSnapshot = snapshotIds.includes(cid);
                  return (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => setActiveId(cid)}
                      data-testid={`delivery-preview-pick-${cid}`}
                      className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors"
                      style={{
                        background: isActive ? `${color}12` : "transparent",
                        borderLeft: `2px solid ${isActive ? color : "transparent"}`,
                      }}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-[var(--kiq-ink-soft)] leading-tight flex items-center gap-1.5">
                          <span className="truncate">{meta?.label || cid}</span>
                          {hasSnapshot && (
                            <Archive
                              className="w-2.5 h-2.5 flex-shrink-0"
                              style={{ color: GOLD }}
                              aria-label="Snapshot available"
                            />
                          )}
                        </div>
                        {meta?.desc && (
                          <div className="text-[9px] font-mono text-zinc-600 leading-snug mt-0.5">
                            {meta.desc}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {compIds.length === 0 && (
                  <div className="px-3 py-4 text-[10px] font-mono text-zinc-600 text-center">
                    No components recorded for this delivery.
                  </div>
                )}
              </div>

              {/* Preview pane */}
              <div className="flex-1 overflow-y-auto px-5 py-4 min-w-0" data-testid="delivery-preview-body">
                {activeMeta && (
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: "#f1f5f9" }}>
                    <div className="text-[11px] font-bold text-[var(--kiq-ink)]">{activeMeta.label}</div>
                    {payload?.ok && (
                      payload.snapshot ? (
                        <span
                          data-testid="delivery-preview-snapshot-badge"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-[0.12em] text-[9px]"
                          style={{ color: GOLD, background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}
                          title="Byte-identical copy captured the day this delivery was sent"
                        >
                          <Archive className="w-2.5 h-2.5" />
                          Snapshot · sent {whenLabel}
                        </span>
                      ) : (
                        <span
                          data-testid="delivery-preview-live-badge"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-[0.12em] text-[9px]"
                          style={{ color: "#9CA3AF", background: "#ffffff", border: "1px solid #cbd5e1" }}
                          title="Rebuilt from current data — no snapshot stored for this component"
                        >
                          Live rebuild
                        </span>
                      )
                    )}
                    <div className="text-[9px] font-mono text-zinc-600 ml-auto">
                      {payload?.filename || activeId}
                      {payload?.kind ? ` · ${payload.kind.toUpperCase()}` : ""}
                      {payload?.size_bytes ? ` · ${fmtBytes(payload.size_bytes)}` : ""}
                    </div>
                    {payload?.data_url && payload.filename && (
                      <a
                        href={payload.data_url}
                        download={payload.filename}
                        data-testid="btn-delivery-preview-download"
                        title="Download this component file"
                        className="px-2 py-1 rounded-md text-[9px] font-mono font-bold uppercase tracking-[0.14em] transition-colors"
                        style={{ color: GOLD, background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}
                      >
                        Download
                      </a>
                    )}
                  </div>
                )}
                {loading && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400" data-testid="delivery-preview-loading">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {activeId && snapshotIds.includes(activeId)
                      ? `Loading sent snapshot of ${activeMeta?.label || activeId}…`
                      : `Rebuilding ${activeMeta?.label || activeId} from server…`}
                  </div>
                )}
                {!loading && payload && !payload.ok && (
                  <div
                    className="rounded-lg p-4 text-[11px] font-mono"
                    style={{ color: "#FCA5A5", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.3)" }}
                    data-testid="delivery-preview-error"
                  >
                    {payload.error || "Preview unavailable."}
                  </div>
                )}
                {!loading && payload?.ok && payload.kind === "pdf" && payload.data_url && (
                  <iframe
                    src={payload.data_url}
                    title={payload.filename || "PDF preview"}
                    data-testid="delivery-preview-pdf"
                    className="w-full rounded-lg"
                    style={{
                      height: "calc(100vh - 240px)",
                      background: "white",
                      border: "1px solid #f1f5f9",
                    }}
                  />
                )}
                {!loading && payload?.ok && payload.kind !== "pdf" && payload.body && (
                  <pre
                    className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words rounded-lg p-4"
                    style={{
                      color: "#E4E4E7",
                      background: "rgba(255,255,255,0.025)",
                      border: "1px solid #f1f5f9",
                    }}
                    data-testid={`delivery-preview-${payload.kind}`}
                  >
                    {payload.body}
                  </pre>
                )}
                {!loading && !payload && !activeId && (
                  <div className="text-[11px] font-mono text-zinc-600" data-testid="delivery-preview-empty">
                    Pick a component on the left to preview what was sent.
                  </div>
                )}
              </div>
            </div>

            <footer
              className="px-5 py-3 border-t text-[9px] font-mono text-zinc-600 flex items-center gap-2"
              style={{ borderColor: "#f1f5f9" }}
            >
              <FileText className="w-3 h-3" />
              <span>
                Components marked with a snapshot icon show the byte-identical copy captured the day this delivery was sent. Others are rebuilt live from the stored EIN, contract id, and client name — structure mirrors what was sent, numbers reflect current data.
              </span>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}


export default function ClientPackage() {
  const params = new URLSearchParams(window.location.search);

  const urlContract = params.get("contract");
  const urlEin      = params.get("ein");
  const urlName     = params.get("name");

  const [contractId, setContractId] = useState<string>(
    urlContract || localStorage.getItem("rxd:id") || ""
  );
  const [ein, setEin] = useState<string>(
    urlEin || localStorage.getItem("warroom:ein") || ""
  );
  const [einName, setEinName] = useState<string>(
    urlName || localStorage.getItem("warroom:name") || ""
  );
  const [clientName, setClientName] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [lastPackage, setLastPackage] = useState<{ filename: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email delivery state
  const [emailOpen, setEmailOpen]         = useState(false);
  const [emailTo, setEmailTo]             = useState<string[]>([""]);
  const [emailCc, setEmailCc]             = useState<string[]>([]);
  const [emailBcc, setEmailBcc]           = useState<string[]>([]);
  const [emailMessage, setEmailMessage]   = useState("");
  const [emailSubject, setEmailSubject]   = useState("");
  const [emailSending, setEmailSending]   = useState(false);
  const [emailResult, setEmailResult]     = useState<{
    ok: boolean; smtp_sent: boolean; recipients?: string[]; cc?: string[]; bcc_count?: number; message: string; filename?: string; size_bytes?: number;
  } | null>(null);

  // Verify-package state — drag a previously-downloaded ZIP back in and
  // recompute SHA-256 for every file against the embedded manifest.json.
  type VerifyFileRow = {
    filename: string;
    label: string;
    expected_sha256: string | null;
    actual_sha256: string | null;
    expected_size: number | null;
    actual_size: number | null;
    status: "match" | "mismatch" | "missing" | "extra";
  };
  type VerifyResponse = {
    ok: boolean;
    manifest_found: boolean;
    manifest: Record<string, any> | null;
    files: VerifyFileRow[];
    summary: { total: number; matched: number; mismatched: number; missing: number; extra: number };
    error: string | null;
  };
  const verifyInputRef = useRef<HTMLInputElement | null>(null);
  const verifyDropzoneRef = useRef<HTMLDivElement | null>(null);
  const [verifyDragOver, setVerifyDragOver] = useState(false);
  const [verifyLoading, setVerifyLoading]   = useState(false);
  const [verifyFile, setVerifyFile]         = useState<{ name: string; size: number } | null>(null);
  const [verifyResult, setVerifyResult]     = useState<VerifyResponse | null>(null);
  const [verifyError, setVerifyError]       = useState<string | null>(null);
  const [expectedVerifyFilename, setExpectedVerifyFilename] = useState<string | null>(null);
  const [verifyFilenameMismatch, setVerifyFilenameMismatch] = useState<string | null>(null);

  function primeVerifyFromDelivery(filename: string | null | undefined) {
    setExpectedVerifyFilename(filename || null);
    setVerifyFilenameMismatch(null);
    setVerifyResult(null);
    setVerifyError(null);
    setVerifyFile(null);
    if (verifyInputRef.current) verifyInputRef.current.value = "";
    requestAnimationFrame(() => {
      const el = verifyDropzoneRef.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
    });
  }

  async function runVerify(f: File) {
    setVerifyLoading(true);
    setVerifyResult(null);
    setVerifyError(null);
    setVerifyFile({ name: f.name, size: f.size });
    if (expectedVerifyFilename && f.name !== expectedVerifyFilename) {
      setVerifyFilenameMismatch(
        `Uploaded "${f.name}" doesn't match the expected "${expectedVerifyFilename}" from the delivery row. Verifying anyway.`,
      );
    } else {
      setVerifyFilenameMismatch(null);
    }
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/export/verify-package", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!r.ok) {
        setVerifyError(`Server returned ${r.status}`);
        return;
      }
      const json: VerifyResponse = await r.json();
      setVerifyResult(json);
    } catch (e: any) {
      setVerifyError(e?.message || "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  }

  function handleVerifyDrop(e: React.DragEvent) {
    e.preventDefault();
    setVerifyDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) runVerify(f);
  }

  function clearVerify() {
    setVerifyFile(null);
    setVerifyResult(null);
    setVerifyError(null);
    setExpectedVerifyFilename(null);
    setVerifyFilenameMismatch(null);
    if (verifyInputRef.current) verifyInputRef.current.value = "";
  }

  const defaultEmailSubject = `Kincaid Health Client Package — ${clientName || einName || "Client"}`;
  useEffect(() => {
    setEmailSubject(defaultEmailSubject);
  }, [clientName, einName, contractId]);

  const validTo = emailTo.map(s => s.trim()).filter(s => s.includes("@"));
  const validCc  = emailCc.map(s => s.trim()).filter(s => s.includes("@"));
  const validBcc = emailBcc.map(s => s.trim()).filter(s => s.includes("@"));
  const hasInvalidTo  = emailTo.some(s => s.trim() !== "" && !s.trim().includes("@"));
  const hasInvalidCc  = emailCc.some(s => s.trim() !== "" && !s.trim().includes("@"));
  const hasInvalidBcc = emailBcc.some(s => s.trim() !== "" && !s.trim().includes("@"));
  const canSendEmail = validTo.length > 0 && !hasInvalidTo && !hasInvalidCc && !hasInvalidBcc;

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingDelivery, setViewingDelivery] = useState<DeliveryForPreview | null>(null);

  const [checked, setChecked] = useState<Record<string, boolean>>({
    rx_redline:             true,
    rx_scorecard:           true,
    benchmarking_employer:  true,
    benchmarking_summary:   true,
    board_pack:             true,
  });

  const { data: contract, isLoading: contractLoading } = useQuery<any>({
    queryKey: ["/api/rx-defense/contracts", contractId],
    enabled: !!contractId,
    retry: false,
  });

  // ── Recent deliveries: audit log of past client-package emails ────────────
  // Scope filter: "all" | "company" (current EIN) | "contract" (current rx_defense_id).
  // Auto-disabled when the underlying selection is missing.
  const [historyScope, setHistoryScope] = useState<"all" | "company" | "contract">("all");
  useEffect(() => {
    if (historyScope === "company" && !ein) setHistoryScope("all");
    if (historyScope === "contract" && !contractId) setHistoryScope("all");
  }, [historyScope, ein, contractId]);

  const historyFilter = {
    ein:           historyScope === "company"  ? ein        : "",
    rx_defense_id: historyScope === "contract" ? contractId : "",
  };

  // Source filter: "all" | "manual" | "scheduled". Scheduled rows are written
  // by the delivery-log auto-email scheduler (Task #104) so compliance teams
  // can prove the recurring CSV actually went out, not just that `last_run_at`
  // moved.
  const [historySource, setHistorySource] = useState<"all" | "manual" | "scheduled" | "diff" | "bid">("all");

  // Format sub-filter for diff sends: "all" | "pdf" | "text". Diff sends can go
  // out either as a polished PDF attachment or as plain-text Markdown in the
  // email body (see the per-row format badge). This lets a broker audit which
  // clients got which. Only meaningful while the Diff source is active, so it's
  // reset whenever the source moves away from "diff".
  const [historyFormat, setHistoryFormat] = useState<"all" | "pdf" | "text">("all");

  // Free-text search across recipients (To/Cc) and subject. Debounced so we
  // don't hammer the backend on every keystroke. Applies on top of scope.
  const [historySearch, setHistorySearch] = useState("");
  const [historySearchDebounced, setHistorySearchDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setHistorySearchDebounced(historySearch.trim()), 250);
    return () => clearTimeout(t);
  }, [historySearch]);

  // Pagination: load 10 most-recent rows via useQuery; brokers can pull older
  // rows by clicking "Load more", which fetches the next offset window and
  // appends to a local `extraDeliveries` buffer. The buffer resets whenever
  // scope/search changes so we always re-anchor at the most recent batch.
  const HISTORY_PAGE_SIZE = 10;
  type DeliveryRow = {
    id: number;
    recipient: string;
    recipients: string[];
    cc: string[];
    bcc_count?: number;
    subject?: string | null;
    filename?: string | null;
    size_bytes?: number | null;
    components: string[];
    component_count: number;
    ein?: string | null;
    rx_defense_id?: string | null;
    client_name?: string | null;
    smtp_sent: boolean;
    source?: "manual" | "scheduled" | string | null;
    created_at?: string | null;
    snapshot_available?: boolean;
    snapshot_components?: string[];
    original_available?: boolean;
    snapshot_at?: string | null;
  };

  const [extraDeliveries, setExtraDeliveries] = useState<DeliveryRow[]>([]);
  const [loadMoreBusy,    setLoadMoreBusy]    = useState(false);
  const [loadMoreError,   setLoadMoreError]   = useState<string | null>(null);
  // Collapsed date-group headers. Brokers with many sends per day can collapse
  // a day to a one-line summary (count only) so they can jump between days
  // faster. Keyed by the same `dayKey` used to bucket rows below.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupCollapsed = (key: string) =>
    setCollapsedGroups((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  // Whenever filters change we discard appended rows so the new query result
  // is shown standalone and pagination restarts from the first page.
  useEffect(() => {
    setExtraDeliveries([]);
    setLoadMoreError(null);
  }, [historyFilter.ein, historyFilter.rx_defense_id, historySearchDebounced, historySource, historyFormat]);

  // The format sub-filter only applies to diff sends; collapse it back to "all"
  // whenever the source moves away from "diff" so a stale pdf/text filter can't
  // silently keep hiding rows under another source.
  useEffect(() => {
    if (historySource !== "diff" && historyFormat !== "all") setHistoryFormat("all");
  }, [historySource, historyFormat]);

  const { data: historyData, isFetching: historyFetching } = useQuery<{ total?: number; deliveries: DeliveryRow[] }>({
    queryKey: ["/api/export/client-package/history", historyFilter.ein, historyFilter.rx_defense_id, historySearchDebounced, historySource, historyFormat],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE), offset: "0" });
      if (historyFilter.ein)           qs.set("ein", historyFilter.ein);
      if (historyFilter.rx_defense_id) qs.set("rx_defense_id", historyFilter.rx_defense_id);
      if (historySearchDebounced)      qs.set("q", historySearchDebounced);
      if (historySource !== "all")     qs.set("source", historySource);
      if (historySource === "diff" && historyFormat !== "all") qs.set("format", historyFormat);
      const r = await fetch(`/api/export/client-package/history?${qs.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error(`History fetch failed: ${r.status}`);
      return r.json();
    },
    retry: false,
    staleTime: 15_000,
  });
  // Refetching the first page (e.g. after a new send invalidates the query)
  // can introduce a row that's now also present in `extraDeliveries`. Dedupe
  // by id, keeping the most-recent-first ordering.
  const firstPage = historyData?.deliveries ?? [];
  const seenIds = new Set<number>();
  const deliveries: DeliveryRow[] = [];
  for (const r of [...firstPage, ...extraDeliveries]) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    deliveries.push(r);
  }
  const deliveriesTotal = historyData?.total ?? deliveries.length;

  // ── Group deliveries by calendar day so long histories are scannable ──────
  // Rows arrive newest-first; we bucket consecutive rows under a date header
  // (Today / Yesterday / "Mar 12, 2026"). Headers respect whatever scope /
  // source / search filter is active because they're derived from `deliveries`,
  // and "Load more" rows slot under the correct header automatically since we
  // re-group on every render.
  const dayKey = (iso: string | null | undefined): string => {
    if (!iso) return "unknown";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "unknown";
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const dayLabel = (iso: string | null | undefined): string => {
    if (!iso) return "Unknown date";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Unknown date";
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  const deliveryGroups: { key: string; label: string; rows: DeliveryRow[] }[] = [];
  for (const d of deliveries) {
    const k = dayKey(d.created_at);
    const last = deliveryGroups[deliveryGroups.length - 1];
    if (last && last.key === k) last.rows.push(d);
    else deliveryGroups.push({ key: k, label: dayLabel(d.created_at), rows: [d] });
  }

  async function loadMoreDeliveries() {
    if (loadMoreBusy) return;
    setLoadMoreBusy(true);
    setLoadMoreError(null);
    try {
      const qs = new URLSearchParams({
        limit:  String(HISTORY_PAGE_SIZE),
        offset: String(deliveries.length),
      });
      if (historyFilter.ein)           qs.set("ein", historyFilter.ein);
      if (historyFilter.rx_defense_id) qs.set("rx_defense_id", historyFilter.rx_defense_id);
      if (historySearchDebounced)      qs.set("q", historySearchDebounced);
      if (historySource !== "all")     qs.set("source", historySource);
      if (historySource === "diff" && historyFormat !== "all") qs.set("format", historyFormat);
      const r = await fetch(`/api/export/client-package/history?${qs.toString()}`, { credentials: "include" });
      if (!r.ok) {
        setLoadMoreError(`Couldn't load older deliveries (server returned ${r.status}).`);
        return;
      }
      const json: { total?: number; deliveries?: DeliveryRow[] } = await r.json();
      const next = json.deliveries ?? [];
      if (next.length === 0) {
        setLoadMoreError("No more deliveries to load.");
        return;
      }
      setExtraDeliveries((cur) => [...cur, ...next]);
    } catch (e: any) {
      setLoadMoreError(e?.message || "Couldn't load older deliveries.");
    } finally {
      setLoadMoreBusy(false);
    }
  }

  // ── Recurring auto-email of the delivery log CSV to compliance ────────────
  // Brokers opt in once; the backend re-runs `history.csv` and emails it on
  // a weekly or monthly cadence. UI lives inside the Recent deliveries panel.
  type ScheduleResp = {
    schedule: null | {
      id: number;
      enabled: boolean;
      frequency: "weekly" | "monthly";
      day_of_week: number | null;
      day_of_month: number | null;
      hour_utc: number;
      timezone: string;
      recipients: string[];
      cc: string[];
      subject: string | null;
      last_run_at: string | null;
      last_status: string | null;
      last_error: string | null;
      last_row_count: number | null;
      next_run_at: string | null;
      updated_at: string | null;
    };
  };
  const { data: scheduleData } = useQuery<ScheduleResp>({
    queryKey: ["/api/export/client-package/schedule"],
    retry: false,
    staleTime: 30_000,
  });
  const schedule = scheduleData?.schedule ?? null;

  // Default to the broker's browser zone so "every Monday at 9am" means 9am
  // *for them*, not 9am UTC. Falls back to UTC on the (rare) browsers where
  // Intl can't resolve a zone.
  const browserTz = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
    catch { return "UTC"; }
  })();

  const [scheduleOpen, setScheduleOpen]   = useState(false);
  const [schedDraftFrequency, setSchedDraftFrequency] = useState<"weekly" | "monthly">("weekly");
  const [schedDraftDow,       setSchedDraftDow]       = useState<number>(0);
  const [schedDraftDom,       setSchedDraftDom]       = useState<number>(1);
  const [schedDraftHour,      setSchedDraftHour]      = useState<number>(9);
  const [schedDraftTz,        setSchedDraftTz]        = useState<string>(browserTz);
  const [schedDraftRecipients,setSchedDraftRecipients]= useState<string>("");
  const [schedDraftCc,        setSchedDraftCc]        = useState<string>("");
  const [schedDraftSubject,   setSchedDraftSubject]   = useState<string>("");
  const [schedBusy,           setSchedBusy]           = useState<"save" | "delete" | "run" | null>(null);
  const [schedMsg,            setSchedMsg]            = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (schedule) {
      setSchedDraftFrequency(schedule.frequency);
      setSchedDraftDow(schedule.day_of_week ?? 0);
      setSchedDraftDom(schedule.day_of_month ?? 1);
      setSchedDraftHour(schedule.hour_utc);
      setSchedDraftTz(schedule.timezone || browserTz);
      setSchedDraftRecipients(schedule.recipients.join(", "));
      setSchedDraftCc(schedule.cc.join(", "));
      setSchedDraftSubject(schedule.subject ?? "");
    }
  }, [schedule?.id, schedule?.updated_at]);

  // Common business zones surfaced at the top; the broker's browser zone is
  // always included so the default selection is selectable even if it isn't
  // in the curated list.
  const TZ_OPTIONS: string[] = Array.from(new Set([
    browserTz,
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Toronto",
    "America/Mexico_City",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Zurich",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Australia/Sydney",
  ]));

  const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function tzAbbrev(tz: string): string {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(new Date());
      const name = parts.find(p => p.type === "timeZoneName")?.value;
      return name || tz;
    } catch {
      return tz;
    }
  }
  function cadenceLabel(s: NonNullable<ScheduleResp["schedule"]>): string {
    const t = `${String(s.hour_utc).padStart(2, "0")}:00 ${tzAbbrev(s.timezone || "UTC")}`;
    if (s.frequency === "monthly") return `Monthly · day ${s.day_of_month ?? 1} · ${t}`;
    return `Weekly · ${DOW_LABELS[(s.day_of_week ?? 0) % 7]} · ${t}`;
  }
  function parseEmails(raw: string): string[] {
    return raw.split(/[\s,;]+/).map(s => s.trim()).filter(s => s.includes("@"));
  }

  async function saveSchedule(enabled: boolean) {
    setSchedBusy("save");
    setSchedMsg(null);
    try {
      const recipients = parseEmails(schedDraftRecipients);
      if (enabled && recipients.length === 0) {
        setSchedMsg({ ok: false, text: "At least one recipient email is required." });
        setSchedBusy(null);
        return;
      }
      const res = await apiRequest("PUT", "/api/export/client-package/schedule", {
        enabled,
        frequency:    schedDraftFrequency,
        day_of_week:  schedDraftFrequency === "weekly"  ? schedDraftDow : null,
        day_of_month: schedDraftFrequency === "monthly" ? schedDraftDom : null,
        hour_utc:     schedDraftHour,
        timezone:     schedDraftTz || "UTC",
        recipients,
        cc:           parseEmails(schedDraftCc),
        subject:      schedDraftSubject.trim() || null,
      });
      const json = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/export/client-package/schedule"] });
      const s = json?.schedule;
      setSchedMsg({
        ok: true,
        text: s?.enabled
          ? `Scheduled · next run ${s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "—"}`
          : "Schedule disabled.",
      });
    } catch (e: any) {
      setSchedMsg({ ok: false, text: e?.message || "Failed to save schedule" });
    } finally {
      setSchedBusy(null);
    }
  }

  async function deleteSchedule() {
    setSchedBusy("delete");
    setSchedMsg(null);
    try {
      await apiRequest("DELETE", "/api/export/client-package/schedule");
      queryClient.invalidateQueries({ queryKey: ["/api/export/client-package/schedule"] });
      setSchedMsg({ ok: true, text: "Schedule removed." });
    } catch (e: any) {
      setSchedMsg({ ok: false, text: e?.message || "Failed to remove schedule" });
    } finally {
      setSchedBusy(null);
    }
  }

  async function runScheduleNow() {
    setSchedBusy("run");
    setSchedMsg(null);
    try {
      const res = await apiRequest("POST", "/api/export/client-package/schedule/run-now");
      const json = await res.json();
      const r = json?.result;
      queryClient.invalidateQueries({ queryKey: ["/api/export/client-package/schedule"] });
      setSchedMsg({
        ok: !!r?.smtp_sent || r?.error?.includes("queued"),
        text: r?.smtp_sent
          ? `Sent · ${r.row_count} row${r.row_count === 1 ? "" : "s"} to ${(r.recipients ?? []).join(", ")}`
          : `${r?.error || "Send failed"} (${r?.row_count ?? 0} rows built)`,
      });
    } catch (e: any) {
      setSchedMsg({ ok: false, text: e?.message || "Run failed" });
    } finally {
      setSchedBusy(null);
    }
  }

  // Resend / re-download a past delivery in one click. Reuses the stored
  // recipients, cc, subject, company/contract context, and component list —
  // no need to rebuild the form.
  const [rowBusy, setRowBusy] = useState<Record<number, "resend" | "download" | "original" | null>>({});
  const [rowMsg, setRowMsg]   = useState<Record<number, { ok: boolean; text: string } | null>>({});

  async function handleResendDelivery(deliveryId: number, isDiff = false) {
    setRowBusy(b => ({ ...b, [deliveryId]: "resend" }));
    setRowMsg(m => ({ ...m, [deliveryId]: null }));
    try {
      const endpoint = isDiff
        ? `/api/export/client-package/resend-diff/${deliveryId}`
        : `/api/export/client-package/resend/${deliveryId}`;
      const res = await apiRequest("POST", endpoint);
      const json = await res.json();
      if (json?.success) {
        setRowMsg(m => ({
          ...m,
          [deliveryId]: {
            ok: true,
            text: json.smtp_sent
              ? `Re-sent · ${json.recipients?.join(", ") ?? json.recipient ?? "delivered"}`
              : `Re-queued · ${json.message || "package built"}`,
          },
        }));
        queryClient.invalidateQueries({ queryKey: ["/api/export/client-package/history"] });
      } else {
        setRowMsg(m => ({ ...m, [deliveryId]: { ok: false, text: json?.error || "Resend failed" } }));
      }
    } catch (e: any) {
      setRowMsg(m => ({ ...m, [deliveryId]: { ok: false, text: e?.message || "Resend failed" } }));
    } finally {
      setRowBusy(b => ({ ...b, [deliveryId]: null }));
    }
  }

  async function handleRedownloadDelivery(deliveryId: number) {
    setRowBusy(b => ({ ...b, [deliveryId]: "download" }));
    setRowMsg(m => ({ ...m, [deliveryId]: null }));
    try {
      const res = await apiRequest("POST", `/api/export/client-package/redownload/${deliveryId}`);
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `kiq_client_package_${deliveryId}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setRowMsg(m => ({ ...m, [deliveryId]: { ok: true, text: `Downloaded · ${filename}` } }));
    } catch (e: any) {
      setRowMsg(m => ({ ...m, [deliveryId]: { ok: false, text: e?.message || "Download failed" } }));
    } finally {
      setRowBusy(b => ({ ...b, [deliveryId]: null }));
    }
  }

  async function handleDownloadOriginal(deliveryId: number) {
    setRowBusy(b => ({ ...b, [deliveryId]: "original" }));
    setRowMsg(m => ({ ...m, [deliveryId]: null }));
    try {
      const res = await apiRequest("POST", `/api/export/client-package/redownload-original/${deliveryId}`);
      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `kiq_original_${deliveryId}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      setRowMsg(m => ({ ...m, [deliveryId]: { ok: true, text: `Original recovered · ${filename}` } }));
    } catch (e: any) {
      // apiRequest throws "<status>: <body>" — surface the backend's clear
      // message (e.g. the 409 "predates byte-identical capture" fallback).
      const raw = e?.message || "Original download failed";
      const text = raw.replace(/^\d+:\s*/, "");
      setRowMsg(m => ({ ...m, [deliveryId]: { ok: false, text } }));
    } finally {
      setRowBusy(b => ({ ...b, [deliveryId]: null }));
    }
  }

  // ── Contract picker: list all of the user's PBM Contract Clarity 360 contracts ──────────
  const { data: contractList, isLoading: contractListLoading } = useQuery<any[]>({
    queryKey: ["/api/rx-defense/contracts"],
    retry: false,
    staleTime: 30_000,
  });
  const [contractPickerOpen, setContractPickerOpen] = useState(false);
  const contractPickerRef = useRef<HTMLDivElement | null>(null);

  // ── Company search: reuse the War Room EIN typeahead (/api/commit/search) ─
  const [companySearch, setCompanySearch]     = useState("");
  const [companyDeferred, setCompanyDeferred] = useState("");
  const [companyOpen, setCompanyOpen]         = useState(false);
  const companyRef = useRef<HTMLDivElement | null>(null);
  const companyDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: companyResults, isFetching: companySearching } = useQuery<{ results: any[] }>({
    queryKey: ["/api/commit/search", companyDeferred],
    queryFn: async () => {
      const r = await fetch(`/api/commit/search?q=${encodeURIComponent(companyDeferred)}`, { credentials: "include" });
      return r.json();
    },
    enabled: companyDeferred.trim().length >= 2,
    staleTime: 60_000,
  });

  function handleCompanyInput(v: string) {
    setCompanySearch(v);
    setCompanyOpen(true);
    if (companyDebounce.current) clearTimeout(companyDebounce.current);
    companyDebounce.current = setTimeout(() => setCompanyDeferred(v), 350);
  }

  // Close popovers on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (contractPickerRef.current && !contractPickerRef.current.contains(t)) setContractPickerOpen(false);
      if (companyRef.current && !companyRef.current.contains(t)) setCompanyOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Persist + sync to URL whenever the user changes selection
  function syncUrl(nextContract: string, nextEin: string, nextName: string) {
    const url = new URL(window.location.href);
    if (nextContract) url.searchParams.set("contract", nextContract); else url.searchParams.delete("contract");
    if (nextEin)      url.searchParams.set("ein", nextEin);           else url.searchParams.delete("ein");
    if (nextName)     url.searchParams.set("name", nextName);         else url.searchParams.delete("name");
    window.history.replaceState(null, "", url.toString());
  }

  function pickContract(id: string) {
    setContractId(id);
    localStorage.setItem("rxd:id", id);
    setContractPickerOpen(false);
    syncUrl(id, ein, einName);
  }
  function clearContract() {
    setContractId("");
    localStorage.removeItem("rxd:id");
    syncUrl("", ein, einName);
  }
  function pickCompany(nextEin: string, nextName: string) {
    setEin(nextEin);
    setEinName(nextName);
    localStorage.setItem("warroom:ein", nextEin);
    localStorage.setItem("warroom:name", nextName);
    setCompanySearch("");
    setCompanyDeferred("");
    setCompanyOpen(false);
    syncUrl(contractId, nextEin, nextName);
  }
  function clearCompany() {
    setEin("");
    setEinName("");
    localStorage.removeItem("warroom:ein");
    localStorage.removeItem("warroom:name");
    syncUrl(contractId, "", "");
  }

  const contractReady = contract?.status === "complete";
  const contractStatus: ReadinessStatus = !contractId
    ? "incomplete"
    : contractLoading
    ? "incomplete"
    : contractReady
    ? "ready"
    : "incomplete";

  // Benchmark employer detail — used to preview the benchmarking + board pack components
  const { data: benchEmployer, isFetching: benchEmployerLoading } = useQuery<any>({
    queryKey: ["/api/benchmark/employer", ein],
    queryFn: () => fetch(`/api/benchmark/employer/${encodeURIComponent(ein)}`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    enabled: !!ein,
    retry: false,
    staleTime: 60_000,
  });

  const { data: benchCheck } = useQuery<{ found: boolean; status: string; employer_name?: string }>({
    queryKey: ["/api/export/benchmarking-check", ein],
    queryFn: () => fetch(`/api/export/benchmarking-check?ein=${encodeURIComponent(ein)}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!ein,
    retry: false,
    staleTime: 60_000,
  });

  const einStatus: ReadinessStatus = !ein
    ? "incomplete"
    : !benchCheck
    ? "incomplete"
    : benchCheck.status === "ready"
    ? "ready"
    : benchCheck.status === "error"
    ? "incomplete"
    : "no_data";

  // Board pack shares the same DuckDB EIN source as benchmarking — no separate query needed
  const packStatus: ReadinessStatus = einStatus;

  // ── Component previews — 1–2 line summaries drawn from the same endpoints used to build the package ──
  const provisionScores: any[] = Array.isArray(contract?.provision_scores) ? contract.provision_scores : [];
  const weakProvisions = provisionScores.filter(
    p => p?.rating === "red_flag" || p?.rating === "concern" || (typeof p?.score === "number" && p.score < 6)
  );
  const keyFindings: any[] = Array.isArray(contract?.key_findings) ? contract.key_findings : [];

  const rxRedlinePreview = contractStatus === "ready"
    ? (provisionScores.length > 0
        ? `${weakProvisions.length} weak provision${weakProvisions.length === 1 ? "" : "s"} flagged · ~${Math.max(4, weakProvisions.length * 2)} pages of model language`
        : "Model contract language for any weak provisions")
    : null;

  const criticalCount = keyFindings.filter(f => (f?.severity || "").toLowerCase() === "critical").length;
  const rxScorecardPreview = contractStatus === "ready"
    ? `Score ${Math.round(contract?.overall_score ?? 0)}/100 · 13 provisions · ${keyFindings.length} key finding${keyFindings.length === 1 ? "" : "s"}${criticalCount > 0 ? ` (${criticalCount} critical)` : ""}`
    : null;

  const pct = (n: any) => (typeof n === "number" ? `P${Math.round(n)}` : "—");
  const money = (n: any) => {
    if (typeof n !== "number" || !isFinite(n) || n <= 0) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  };

  const benchEmployerPreview = einStatus === "ready"
    ? (benchEmployer?.employer
        ? (() => {
            const e = benchEmployer.employer;
            const yr = e.latestYear || e.latest_year;
            const adminFees = e.totalAdminFees ?? e.total_admin_fees;
            const brokerComm = e.totalBrokerCommissions ?? e.total_broker_commissions;
            const parts = e.maxParticipants ?? e.max_participants;
            return `${money(adminFees)} admin · ${money(brokerComm)} broker comm · ${parts ? parts.toLocaleString() + " members" : "—"}${yr ? ` (${yr})` : ""}`;
          })()
        : "Loading employer filing detail…")
    : null;

  const benchSummaryPreview = einStatus === "ready"
    ? (benchEmployer?.percentiles
        ? `${pct(benchEmployer.percentiles.adminFees)} admin fees · ${pct(benchEmployer.percentiles.brokerCommissions)} broker comm vs national peers${benchEmployer.employerPmpm ? ` · $${benchEmployer.employerPmpm} PMPM` : ""}`
        : "National P50/P75/P90 peer comparison")
    : null;

  const boardPackPreview = packStatus === "ready"
    ? (benchEmployer?.employer
        ? (() => {
            const e = benchEmployer.employer;
            const loc = [e.city, e.state].filter(Boolean).join(", ");
            const ind = e.industryLabel || e.industry_label || "";
            return `${loc || "—"}${ind ? ` · ${ind}` : ""} · admin/broker vs P50/P75/P90`;
          })()
        : "Board-grade claims brief · admin + broker comm vs P50/P75/P90")
    : null;

  const benchPreviewLoading = einStatus === "ready" && benchEmployerLoading && !benchEmployer;
  const rxPreviewLoading = !!contractId && contractLoading;

  const components: Component[] = [
    {
      id:     "rx_redline",
      label:  "PBM Contract Clarity 360 — Redline (.docx)",
      desc:   "Word doc with model contract language for all weak provisions",
      icon:   Pill,
      color:  GREEN,
      status: contractStatus,
      key:    "rx_redline",
      preview: rxRedlinePreview,
      previewLoading: rxPreviewLoading,
      tooltip: contractId
        ? contractReady
          ? `${contract?.pbm_name || contractId} — Score ${Math.round(contract?.overall_score ?? 0)}/100`
          : contractLoading
          ? "Checking contract status…"
          : "Contract analysis not complete — run PBM Contract Clarity 360 first"
        : "No PBM Contract Clarity 360 contract selected — open PBM Contract Clarity 360 and analyze a contract first",
    },
    {
      id:     "rx_scorecard",
      label:  "PBM Contract Clarity 360 — Scorecard (JSON)",
      desc:   "Machine-readable provision scores, findings, and risk flags",
      icon:   FileText,
      color:  PURPLE,
      status: contractStatus,
      key:    "rx_scorecard",
      preview: rxScorecardPreview,
      previewLoading: rxPreviewLoading,
      tooltip: contractId
        ? contractReady
          ? `13 provisions · ${contract?.key_findings?.length ?? 0} key findings`
          : "Contract analysis not complete"
        : "No PBM Contract Clarity 360 contract selected",
    },
    {
      id:     "benchmarking_employer",
      label:  "Benchmarking Employer Report (JSON)",
      desc:   "EIN-level plan data: admin fees, broker commissions, filing history",
      icon:   Building2,
      color:  BLUE,
      status: einStatus,
      key:    "benchmarking_employer",
      preview: benchEmployerPreview,
      previewLoading: benchPreviewLoading,
      tooltip: ein
        ? `EIN ${ein}${einName ? ` — ${einName}` : ""} · employer filing detail`
        : "No company selected — open the War Room and load a company first",
    },
    {
      id:     "benchmarking_summary",
      label:  "Benefits Benchmarking Summary (JSON)",
      desc:   "National P50/P75/P90 peer comparison for admin fees & broker commissions",
      icon:   BarChart2,
      color:  GOLD,
      status: einStatus,
      key:    "benchmarking_summary",
      preview: benchSummaryPreview,
      previewLoading: benchPreviewLoading,
      tooltip: ein
        ? `EIN ${ein} vs national/state peers`
        : "No company selected — open the War Room first",
    },
    {
      id:     "board_pack",
      label:  "War Room Fiduciary Intelligence Brief (HTML)",
      desc:   "Printable board-grade claims report — open in browser, print to PDF",
      icon:   Package2,
      color:  PURPLE,
      status: packStatus,
      key:    "board_pack",
      preview: boardPackPreview,
      previewLoading: benchPreviewLoading,
      tooltip: !ein
        ? "No company selected — open the War Room first"
        : packStatus === "ready"
          ? `${benchCheck?.employer_name ?? ein} · Admin fees + broker commissions vs national P50/P75/P90 · Print to PDF`
          : packStatus === "incomplete"
            ? "Checking company data…"
            : `EIN ${ein} not found in benefits database`,
    },
  ];

  const readyCount  = components.filter(c => c.status === "ready").length;
  const checkedIds  = components.filter(c => checked[c.id] && c.status === "ready").map(c => c.id);
  const canDownload = checkedIds.length > 0 && !downloading;

  function toggleAll() {
    const allChecked = components.filter(c => c.status === "ready").every(c => checked[c.id]);
    const next: Record<string, boolean> = { ...checked };
    components.filter(c => c.status === "ready").forEach(c => { next[c.id] = !allChecked; });
    setChecked(next);
  }

  async function handleSendEmail() {
    if (validTo.length === 0) {
      setEmailResult({ ok: false, smtp_sent: false, message: "Add at least one valid recipient email address." });
      return;
    }
    if (hasInvalidTo || hasInvalidCc || hasInvalidBcc) {
      setEmailResult({ ok: false, smtp_sent: false, message: "One or more email addresses are invalid." });
      return;
    }
    if (checkedIds.length === 0) {
      setEmailResult({ ok: false, smtp_sent: false, message: "Select at least one ready component first." });
      return;
    }

    setEmailSending(true);
    setEmailResult(null);

    try {
      const body: Record<string, unknown> = {
        recipient:            validTo[0],
        recipients:           validTo,
        cc:                   validCc,
        bcc:                  validBcc,
        subject:              emailSubject.trim() || undefined,
        message:              emailMessage.trim() || undefined,
        client_name:          clientName || einName || "Client",
        requester:            "kincaid-iq",
        include_rx_redline:             !!checked.rx_redline             && contractStatus === "ready",
        include_rx_scorecard:           !!checked.rx_scorecard           && contractStatus === "ready",
        include_benchmarking_employer:  !!checked.benchmarking_employer  && einStatus === "ready",
        include_benchmarking_summary:   !!checked.benchmarking_summary   && einStatus === "ready",
        include_board_pack:             !!checked.board_pack             && packStatus === "ready",
      };
      if (contractId && contractStatus === "ready") body.rx_defense_id = contractId;
      if (ein && einStatus === "ready") body.ein = ein;

      const res  = await apiRequest("POST", "/api/export/client-package/email", body);
      const json = await res.json().catch(() => ({}));

      if (!res.ok || json.success === false) {
        setEmailResult({
          ok: false, smtp_sent: false,
          message: json.error || json.message || "Email delivery failed",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/export/client-package/history"] });
        setEmailResult({
          ok: true,
          smtp_sent: !!json.smtp_sent,
          recipients: Array.isArray(json.recipients) && json.recipients.length > 0
            ? json.recipients
            : (json.recipient ? [json.recipient] : validTo),
          cc: Array.isArray(json.cc) ? json.cc : validCc,
          bcc_count: typeof json.bcc_count === "number" ? json.bcc_count : validBcc.length,
          message: json.message || "Package emailed.",
          filename: json.filename,
          size_bytes: json.size_bytes,
        });
      }
    } catch (e: any) {
      setEmailResult({ ok: false, smtp_sent: false, message: e?.message || "Email delivery failed" });
    } finally {
      setEmailSending(false);
    }
  }

  async function handleDownload() {
    if (!canDownload) return;
    setDownloading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        client_name:          clientName || einName || "Client",
        requester:            "kincaid-iq",
        include_rx_redline:             !!checked.rx_redline             && contractStatus === "ready",
        include_rx_scorecard:           !!checked.rx_scorecard           && contractStatus === "ready",
        include_benchmarking_employer:  !!checked.benchmarking_employer  && einStatus === "ready",
        include_benchmarking_summary:   !!checked.benchmarking_summary   && einStatus === "ready",
        include_board_pack:             !!checked.board_pack             && packStatus === "ready",
      };
      if (contractId && contractStatus === "ready") body.rx_defense_id = contractId;
      if (ein && einStatus === "ready") body.ein = ein;

      const res = await apiRequest("POST", "/api/export/client-package", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? "Package generation failed");
      }

      const blob = await res.blob();
      const filename = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `kiq_client_package_${Date.now()}.zip`;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setLastPackage({ filename, size: blob.size });
    } catch (e: any) {
      setError(e.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <a href="/quarterly-report" className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 hover:text-zinc-400 mb-5 transition-colors">
            <ChevronLeft className="w-3 h-3" /> Back to Reporting
          </a>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}30` }}>
              <Archive className="w-5 h-5" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--kiq-ink)]">Client Package Builder</h1>
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                Unified deliverable · multi-tool export
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed mt-3">
            Assemble a single ZIP from PBM Contract Clarity 360, Benefits Benchmarking, and War Room data.
            Select which components to include and download them as one package.
          </p>
        </div>

        {/* Data source pickers — contract + company, no need to leave the builder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {/* PBM Contract Clarity 360 contract picker */}
          <div ref={contractPickerRef} className="relative">
            <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1.5 block">
              PBM Contract Clarity 360 Contract
            </label>
            <button
              data-testid="btn-pick-contract"
              type="button"
              onClick={() => setContractPickerOpen(o => !o)}
              className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-left outline-none"
              style={{ background: "#ffffff", border: `1px solid ${contractId ? GREEN + "40" : "rgba(15,23,42,0.03)"}` }}
            >
              <Pill className="w-3.5 h-3.5 flex-shrink-0" style={{ color: contractId ? GREEN : "#64748b" }} />
              <div className="flex-1 min-w-0">
                {contractId ? (
                  <>
                    <div className="text-xs font-semibold text-[var(--kiq-ink)] truncate">
                      {contract?.pbm_name || contract?.contract_filename || contractId}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-500 truncate">
                      {contractReady
                        ? `Score ${Math.round(contract?.overall_score ?? 0)}/100 · ${contract?.rating ?? ""}`
                        : contractLoading ? "Loading…" : (contract?.status ?? "select contract")}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-500">Select an analyzed contract…</div>
                )}
              </div>
              {contractId && (
                <button
                  data-testid="btn-clear-contract"
                  onClick={(e) => { e.stopPropagation(); clearContract(); }}
                  className="p-1 rounded-full hover:bg-[var(--kiq-surface)]/10 flex-shrink-0">
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            </button>

            <AnimatePresence>
              {contractPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl z-50 overflow-hidden"
                  style={{ background: "#F8FAFC", border: "1px solid #e2e8f0", maxHeight: 320, overflowY: "auto" }}
                >
                  {contractListLoading ? (
                    <div className="px-4 py-3 text-[11px] text-zinc-500 flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Loading contracts…
                    </div>
                  ) : !contractList || contractList.length === 0 ? (
                    <div className="px-4 py-3 text-[11px] text-zinc-500">
                      No PBM Contract Clarity 360 contracts yet — <a href="/rx-defense" className="underline hover:text-[var(--kiq-muted)]">analyze one</a> first.
                    </div>
                  ) : (
                    contractList.map((c: any) => {
                      const ready  = c.status === "complete";
                      const active = c.id === contractId;
                      return (
                        <button
                          key={c.id}
                          data-testid={`btn-contract-option-${c.id}`}
                          onClick={() => pickContract(c.id)}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--kiq-surface)]/5 transition-colors border-b border-white/5 flex items-center gap-2"
                          style={{ background: active ? "rgba(16,185,129,0.06)" : "transparent" }}
                        >
                          <Pill className="w-3 h-3 flex-shrink-0" style={{ color: ready ? GREEN : GOLD }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[var(--kiq-ink)] truncate font-semibold">
                              {c.pbm_name || c.contract_filename || c.id}
                            </div>
                            <div className="text-[9px] font-mono text-zinc-500 truncate">
                              {ready
                                ? `Score ${Math.round(c.overall_score ?? 0)}/100 · ${c.rating ?? ""}`
                                : (c.status ?? "—")}
                              {c.created_at ? ` · ${new Date(c.created_at).toLocaleDateString()}` : ""}
                            </div>
                          </div>
                          {!ready && <span className="text-[8px] font-mono uppercase text-zinc-600">{c.status}</span>}
                          {active  && <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: GREEN }} />}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Company (EIN) typeahead */}
          <div ref={companyRef} className="relative">
            <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1.5 block">
              Company (EIN)
            </label>
            {ein && !companySearch ? (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: "#ffffff", border: `1px solid ${BLUE}40` }}>
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BLUE }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--kiq-ink)] truncate">{einName || ein}</div>
                  <div className="text-[9px] font-mono text-zinc-500">EIN {ein}</div>
                </div>
                <button
                  data-testid="btn-clear-company"
                  onClick={clearCompany}
                  className="p-1 rounded-full hover:bg-[var(--kiq-surface)]/10 flex-shrink-0">
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                <input
                  data-testid="input-company-search"
                  value={companySearch}
                  onChange={e => handleCompanyInput(e.target.value)}
                  onFocus={() => setCompanyOpen(true)}
                  placeholder="Search company by name or EIN…"
                  className="w-full text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl pl-9 pr-9 py-2.5 outline-none"
                  style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)" }}
                />
                {companySearching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-zinc-600" />
                )}
              </div>
            )}

            <AnimatePresence>
              {companyOpen && !ein && (companyResults?.results?.length ?? 0) > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl z-50 overflow-hidden"
                  style={{ background: "#F8FAFC", border: "1px solid #e2e8f0", maxHeight: 320, overflowY: "auto" }}
                >
                  {companyResults!.results.map((r: any) => (
                    <button
                      key={r.ein}
                      data-testid={`btn-company-option-${r.ein}`}
                      onClick={() => pickCompany(r.ein, r.name)}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--kiq-surface)]/5 transition-colors border-b border-white/5"
                    >
                      <div className="text-[var(--kiq-ink)] font-semibold truncate">{r.name}</div>
                      <div className="text-[9px] font-mono text-zinc-500 truncate">
                        {[r.sector, [r.city, r.state].filter(Boolean).join(", "), `EIN ${r.ein}`].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
              {companyOpen && !ein && companyDeferred.trim().length >= 2 && !companySearching && (companyResults?.results?.length ?? 0) === 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl z-50 px-4 py-3 text-[11px] text-zinc-500"
                  style={{ background: "#F8FAFC", border: "1px solid #e2e8f0" }}
                >
                  No matches for “{companyDeferred}”.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Client name field */}
        <div className="mb-6">
          <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1.5 block">
            Client / Recipient Name (optional)
          </label>
          <input
            data-testid="input-client-name"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            placeholder={einName || "e.g. Acme Corp, Attention: Benefits Team"}
            className="w-full text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none"
            style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)" }}
          />
        </div>

        {/* Ready count + select all */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.2em]">
            {readyCount} of {components.length} components available
          </div>
          {readyCount > 0 && (
            <button data-testid="btn-toggle-all" onClick={toggleAll}
              className="text-[9px] font-mono text-zinc-500 hover:text-[var(--kiq-muted)] transition-colors">
              {components.filter(c => c.status === "ready").every(c => checked[c.id]) ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {/* Component list */}
        <div className="space-y-2.5 mb-6">
          {components.map(comp => (
            <ComponentCard
              key={comp.id}
              comp={comp}
              checked={!!checked[comp.id]}
              onToggle={() => setChecked(prev => ({ ...prev, [comp.id]: !prev[comp.id] }))}
              onView={() => setViewingId(comp.id)}
            />
          ))}
        </div>

        {/* No-data nudge — only when both pickers are empty */}
        {!contractId && !ein && (
          <div className="rounded-xl p-4 mb-6" style={{ background: "rgba(255,184,0,0.04)", border: "1px solid rgba(255,184,0,0.15)" }}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
              <div>
                <div className="text-[11px] font-bold text-[var(--kiq-ink)]/80 mb-1">No data sources selected</div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Pick a PBM Contract Clarity 360 contract or search a company above. New contract?
                  Analyze one in <a href="/rx-defense" className="underline hover:text-[var(--kiq-muted)]">PBM Contract Clarity 360</a>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl p-4 mb-4 flex items-start gap-2.5"
              style={{ background: `${RED}08`, border: `1px solid ${RED}28` }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: RED }} />
              <div>
                <div className="text-[11px] font-bold mb-0.5" style={{ color: RED }}>Package generation failed</div>
                <p className="text-[10px] text-zinc-500">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {lastPackage && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl p-4 mb-4 flex items-start gap-2.5"
              style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}28` }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: GREEN }} />
              <div>
                <div className="text-[11px] font-bold mb-0.5" style={{ color: GREEN }}>Package downloaded</div>
                <p className="text-[10px] font-mono text-zinc-500">
                  {lastPackage.filename} · {(lastPackage.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delivery actions: Download + Send via Email */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
          <button
            data-testid="btn-download-package"
            onClick={handleDownload}
            disabled={!canDownload}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 font-bold text-sm transition-all"
            style={{
              background: canDownload ? `linear-gradient(135deg, ${GOLD}18, ${GOLD}08)` : "#ffffff",
              border: canDownload ? `1px solid ${GOLD}50` : "1px solid #e2e8f0",
              color: canDownload ? GOLD : "#94a3b8",
              cursor: canDownload ? "pointer" : "not-allowed",
              boxShadow: canDownload ? `0 0 32px ${GOLD}18` : "none",
            }}>
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Building package…</>
              : <><Download className="w-4 h-4" /> Download Package ({checkedIds.length} component{checkedIds.length !== 1 ? "s" : ""})</>
            }
          </button>

          <button
            data-testid="btn-toggle-email"
            onClick={() => { setEmailOpen(o => !o); setEmailResult(null); }}
            disabled={checkedIds.length === 0}
            className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-bold text-sm transition-all"
            style={{
              background: checkedIds.length > 0
                ? (emailOpen ? `${BLUE}18` : "#ffffff")
                : "#ffffff",
              border: `1px solid ${checkedIds.length > 0 ? BLUE + "50" : "#e2e8f0"}`,
              color: checkedIds.length > 0 ? BLUE : "#94a3b8",
              cursor: checkedIds.length > 0 ? "pointer" : "not-allowed",
            }}>
            <Mail className="w-4 h-4" /> Send via Email
          </button>
        </div>

        {checkedIds.length > 0 && !downloading && !emailOpen && (
          <p className="text-center text-[9px] font-mono text-zinc-700 mt-2">
            ZIP includes cover sheet + {checkedIds.length} selected component{checkedIds.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Email composer panel */}
        <AnimatePresence>
          {emailOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="rounded-2xl p-5"
                style={{ background: `${BLUE}06`, border: `1px solid ${BLUE}25` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="w-3.5 h-3.5" style={{ color: BLUE }} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]" style={{ color: BLUE }}>
                    Email Delivery
                  </span>
                </div>

                {/* To recipients */}
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 flex items-center gap-1.5">
                    <Users className="w-3 h-3" /> To
                  </label>
                  <button
                    type="button"
                    data-testid="btn-add-recipient"
                    onClick={() => setEmailTo(arr => [...arr, ""])}
                    className="flex items-center gap-1 text-[9px] font-bold rounded-md px-2 py-0.5"
                    style={{ color: BLUE, border: `1px solid ${BLUE}30`, background: `${BLUE}10` }}
                  >
                    <Plus className="w-2.5 h-2.5" /> Add
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 mb-3">
                  {emailTo.map((addr, i) => {
                    const invalid = addr.trim() !== "" && !addr.trim().includes("@");
                    return (
                      <div key={i} className="flex gap-1.5">
                        <input
                          data-testid={`input-email-to-${i}`}
                          type="email"
                          value={addr}
                          onChange={e => setEmailTo(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                          placeholder="recipient@company.com"
                          className="flex-1 text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none"
                          style={{
                            background: "#ffffff",
                            border: `1px solid ${invalid ? RED + "55" : "rgba(15,23,42,0.03)"}`,
                          }}
                        />
                        {emailTo.length > 1 && (
                          <button
                            type="button"
                            data-testid={`btn-remove-recipient-${i}`}
                            onClick={() => setEmailTo(arr => arr.filter((_, j) => j !== i))}
                            className="flex items-center justify-center rounded-xl flex-shrink-0"
                            style={{ width: 38, border: `1px solid ${RED}25`, background: `${RED}08`, color: RED }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* CC recipients */}
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600">
                    CC <span className="text-zinc-700 normal-case tracking-normal">(optional)</span>
                  </label>
                  <button
                    type="button"
                    data-testid="btn-add-cc"
                    onClick={() => setEmailCc(arr => [...arr, ""])}
                    className="flex items-center gap-1 text-[9px] font-bold rounded-md px-2 py-0.5 text-zinc-500"
                    style={{ border: "1px solid #cbd5e1", background: "#ffffff" }}
                  >
                    <Plus className="w-2.5 h-2.5" /> Add CC
                  </button>
                </div>
                {emailCc.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3">
                    {emailCc.map((addr, i) => {
                      const invalid = addr.trim() !== "" && !addr.trim().includes("@");
                      return (
                        <div key={i} className="flex gap-1.5">
                          <input
                            data-testid={`input-email-cc-${i}`}
                            type="email"
                            value={addr}
                            onChange={e => setEmailCc(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                            placeholder="cc@company.com"
                            className="flex-1 text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none"
                            style={{
                              background: "#ffffff",
                              border: `1px solid ${invalid ? RED + "55" : "#e2e8f0"}`,
                            }}
                          />
                          <button
                            type="button"
                            data-testid={`btn-remove-cc-${i}`}
                            onClick={() => setEmailCc(arr => arr.filter((_, j) => j !== i))}
                            className="flex items-center justify-center rounded-xl flex-shrink-0"
                            style={{ width: 38, border: `1px solid ${RED}25`, background: `${RED}08`, color: RED }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* BCC recipients — envelope-only, never echoed back */}
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600">
                    BCC <span className="text-zinc-700 normal-case tracking-normal">(hidden from To/CC)</span>
                  </label>
                  <button
                    type="button"
                    data-testid="btn-add-bcc"
                    onClick={() => setEmailBcc(arr => [...arr, ""])}
                    className="flex items-center gap-1 text-[9px] font-bold rounded-md px-2 py-0.5 text-zinc-500"
                    style={{ border: "1px solid #cbd5e1", background: "#ffffff" }}
                  >
                    <Plus className="w-2.5 h-2.5" /> Add BCC
                  </button>
                </div>
                {emailBcc.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-3" data-testid="bcc-list">
                    {emailBcc.map((addr, i) => {
                      const invalid = addr.trim() !== "" && !addr.trim().includes("@");
                      return (
                        <div key={i} className="flex gap-1.5">
                          <input
                            data-testid={`input-email-bcc-${i}`}
                            type="email"
                            value={addr}
                            onChange={e => setEmailBcc(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                            placeholder="bcc@company.com"
                            className="flex-1 text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none"
                            style={{
                              background: "#ffffff",
                              border: `1px solid ${invalid ? RED + "55" : "#e2e8f0"}`,
                            }}
                          />
                          <button
                            type="button"
                            data-testid={`btn-remove-bcc-${i}`}
                            onClick={() => setEmailBcc(arr => arr.filter((_, j) => j !== i))}
                            className="flex items-center justify-center rounded-xl flex-shrink-0"
                            style={{ width: 38, border: `1px solid ${RED}25`, background: `${RED}08`, color: RED }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1.5 block">
                  Subject
                </label>
                <input
                  data-testid="input-email-subject"
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder={defaultEmailSubject}
                  className="w-full text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none mb-3 font-sans"
                  style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)" }}
                />

                <label className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1.5 block">
                  Optional message
                </label>
                <textarea
                  data-testid="input-email-message"
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a short note for the recipient…"
                  className="w-full text-xs text-[var(--kiq-ink)] placeholder:text-zinc-700 rounded-xl px-4 py-2.5 outline-none mb-3 resize-y font-sans"
                  style={{ background: "#ffffff", border: "1px solid rgba(15,23,42,0.03)", lineHeight: 1.6 }}
                />

                <button
                  data-testid="btn-send-email"
                  onClick={handleSendEmail}
                  disabled={emailSending || checkedIds.length === 0 || !canSendEmail}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-all"
                  style={{
                    background: (emailSending || !canSendEmail)
                      ? "#ffffff"
                      : `linear-gradient(135deg, ${BLUE}28, ${BLUE}10)`,
                    border: `1px solid ${BLUE}55`,
                    color: (emailSending || !canSendEmail) ? "#475569" : BLUE,
                    cursor: (emailSending || !canSendEmail) ? "not-allowed" : "pointer",
                  }}>
                  {emailSending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                    : <>
                        <Send className="w-4 h-4" />
                        Send Package
                        {(validTo.length + validCc.length + validBcc.length) > 0
                          ? ` to ${validTo.length + validCc.length + validBcc.length} recipient${(validTo.length + validCc.length + validBcc.length) !== 1 ? "s" : ""}`
                          : ""}
                      </>
                  }
                </button>

                <AnimatePresence>
                  {emailResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      data-testid="email-result"
                      className="mt-3 rounded-xl p-3 flex items-start gap-2.5"
                      style={{
                        background: emailResult.ok ? `${GREEN}08` : `${RED}08`,
                        border: `1px solid ${emailResult.ok ? GREEN + "28" : RED + "28"}`,
                      }}>
                      {emailResult.ok
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: GREEN }} />
                        : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: RED }} />
                      }
                      <div>
                        <div className="text-[11px] font-bold mb-0.5" style={{ color: emailResult.ok ? GREEN : RED }}>
                          {emailResult.ok
                            ? (emailResult.smtp_sent ? "Email delivered" : "Package built — delivery queued")
                            : "Email delivery failed"}
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">{emailResult.message}</p>
                        {emailResult.ok && emailResult.recipients && emailResult.recipients.length > 0 && (
                          <p
                            data-testid="email-recipients-summary"
                            className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed"
                          >
                            <span className="font-bold text-[var(--kiq-muted)]">To:</span> {emailResult.recipients.join(", ")}
                            {emailResult.cc && emailResult.cc.length > 0 && (
                              <>
                                {" · "}
                                <span className="font-bold text-[var(--kiq-muted)]">CC:</span> {emailResult.cc.join(", ")}
                              </>
                            )}
                            {typeof emailResult.bcc_count === "number" && emailResult.bcc_count > 0 && (
                              <>
                                {" · "}
                                <span
                                  className="font-bold text-[var(--kiq-muted)]"
                                  data-testid="email-bcc-count"
                                >
                                  BCC:
                                </span>{" "}
                                {emailResult.bcc_count} hidden recipient
                                {emailResult.bcc_count !== 1 ? "s" : ""}
                              </>
                            )}
                          </p>
                        )}
                        {emailResult.ok && emailResult.filename && (
                          <p className="text-[9px] font-mono text-zinc-600 mt-1">
                            {emailResult.filename}
                            {emailResult.size_bytes ? ` · ${(emailResult.size_bytes / 1024).toFixed(1)} KB` : ""}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent deliveries — audit log of past client-package emails.
            Always rendered so the compliance auto-email schedule card is
            reachable even for brokers who haven't sent any packages yet. */}
        {true && (
          <div className="mt-8" data-testid="recent-deliveries">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                Recent deliveries
              </h3>
              <span
                className="text-[9px] font-mono text-zinc-600"
                data-testid="text-deliveries-count"
                title={
                  historyScope === "all"
                    ? `${deliveriesTotal} total deliveries across all companies`
                    : historyScope === "company"
                      ? `${deliveriesTotal} historic ${deliveriesTotal === 1 ? "delivery" : "deliveries"} for EIN ${ein}`
                      : `${deliveriesTotal} historic ${deliveriesTotal === 1 ? "delivery" : "deliveries"} for this contract`
                }
              >
                {deliveriesTotal > deliveries.length
                  ? `· showing ${deliveries.length} of ${deliveriesTotal}`
                  : `· last ${deliveries.length}`}
              </span>
              <a
                href={(() => {
                  const qs = new URLSearchParams();
                  if (historyFilter.ein)           qs.set("ein", historyFilter.ein);
                  if (historyFilter.rx_defense_id) qs.set("rx_defense_id", historyFilter.rx_defense_id);
                  if (historySearchDebounced)      qs.set("q", historySearchDebounced);
                  if (historySource !== "all")     qs.set("source", historySource);
                  const q = qs.toString();
                  return `/api/export/client-package/history.csv${q ? `?${q}` : ""}`;
                })()}
                data-testid="button-download-history-csv"
                title="Download full delivery history as a ZIP (CSV + README data dictionary, for audits & RFP responses)"
                className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded transition-colors"
                style={{
                  color:      GOLD,
                  background: `${GOLD}14`,
                  border:     `1px solid ${GOLD}40`,
                }}
              >
                Download ZIP
              </a>
              <div className="flex items-center gap-1 ml-auto" data-testid="delivery-scope-filter">
                {([
                  { key: "all",      label: "All",          enabled: true,         title: "Show all recent deliveries" },
                  { key: "company",  label: ein ? `EIN ${ein}` : "This company",  enabled: !!ein,        title: ein ? `Filter to deliveries for EIN ${ein}` : "Select a company above to filter" },
                  { key: "contract", label: "This contract", enabled: !!contractId, title: contractId ? `Filter to deliveries for contract ${contractId}` : "Select a PBM Contract Clarity 360 contract above to filter" },
                ] as const).map(opt => {
                  const active = historyScope === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      data-testid={`scope-chip-${opt.key}`}
                      disabled={!opt.enabled}
                      onClick={() => setHistoryScope(opt.key)}
                      title={opt.title}
                      className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        color:      active ? GOLD              : "rgba(255,255,255,0.55)",
                        background: active ? `${GOLD}14`       : "#ffffff",
                        border:     `1px solid ${active ? `${GOLD}40` : "rgba(15,23,42,0.03)"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Source filter — Manual vs Scheduled (Task #104). Scheduled rows
                are written by the delivery-log auto-email scheduler, so this
                lets compliance pull just the recurring sends when auditing. */}
            <div className="flex items-center gap-1 mb-3" data-testid="delivery-source-filter">
              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600 mr-1">
                Source
              </span>
              {([
                { key: "all",       label: "All",       title: "Show manual, scheduled, diff and bid sends" },
                { key: "manual",    label: "Manual",    title: "Only deliveries you sent from this page" },
                { key: "scheduled", label: "Scheduled", title: "Only recurring compliance auto-emails" },
                { key: "diff",      label: "Diff",      title: "Only emailed executive-summary diffs" },
                { key: "bid",       label: "Bid",       title: "Only emailed Bid Optimizer recommendations" },
              ] as const).map(opt => {
                const active = historySource === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    data-testid={`source-chip-${opt.key}`}
                    onClick={() => setHistorySource(opt.key)}
                    title={opt.title}
                    className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded transition-colors"
                    style={{
                      color:      active ? GOLD              : "rgba(255,255,255,0.55)",
                      background: active ? `${GOLD}14`       : "#ffffff",
                      border:     `1px solid ${active ? `${GOLD}40` : "rgba(15,23,42,0.03)"}`,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* Format sub-filter — only meaningful for diff sends, which can go
                out as a polished PDF attachment or as plain-text Markdown. Lets
                a broker audit which clients got which. Mirrors the per-row
                format badge's "(pdf)" components-label / .pdf filename signal,
                applied server-side so pagination and totals stay correct. */}
            {historySource === "diff" && (
              <div className="flex items-center gap-1 mb-3" data-testid="delivery-format-filter">
                <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-600 mr-1">
                  Format
                </span>
                {([
                  { key: "all",  label: "All",  title: "Show diffs sent as PDF and as plain text" },
                  { key: "pdf",  label: "PDF",  title: "Only diffs sent as a polished PDF attachment" },
                  { key: "text", label: "Text", title: "Only diffs sent as plain-text Markdown in the email body" },
                ] as const).map(opt => {
                  const active = historyFormat === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      data-testid={`format-chip-${opt.key}`}
                      onClick={() => setHistoryFormat(opt.key)}
                      title={opt.title}
                      className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded transition-colors"
                      style={{
                        color:      active ? GOLD              : "rgba(255,255,255,0.55)",
                        background: active ? `${GOLD}14`       : "#ffffff",
                        border:     `1px solid ${active ? `${GOLD}40` : "rgba(15,23,42,0.03)"}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mb-3 relative" data-testid="delivery-search-wrap">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search recipient email or subject…"
                data-testid="input-delivery-search"
                className="w-full text-[11px] font-mono pl-7 pr-7 py-1.5 rounded-md outline-none transition-colors"
                style={{
                  background: "#F8FAFC",
                  border: `1px solid ${historySearch ? `${GOLD}40` : "rgba(15,23,42,0.03)"}`,
                  color: "rgba(255,255,255,0.85)",
                }}
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch("")}
                  data-testid="button-delivery-search-clear"
                  title="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[var(--kiq-ink-soft)] text-[10px] font-mono"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Recurring compliance auto-email of the delivery log CSV */}
            <div
              className="mb-3 rounded-xl overflow-hidden"
              style={{ background: "#F8FAFC", border: `1px solid ${schedule?.enabled ? `${GREEN}40` : "rgba(15,23,42,0.03)"}` }}
              data-testid="schedule-card"
            >
              <button
                type="button"
                onClick={() => setScheduleOpen(o => !o)}
                data-testid="button-schedule-toggle"
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left"
              >
                <Mail
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: schedule?.enabled ? GREEN : "rgba(255,255,255,0.45)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-[var(--kiq-ink-soft)] uppercase tracking-[0.12em]">
                      Auto-email log to compliance
                    </span>
                    {schedule?.enabled ? (
                      <span
                        className="text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                        style={{ color: GREEN, background: `${GREEN}14`, border: `1px solid ${GREEN}40` }}
                        data-testid="schedule-status-on"
                      >
                        On
                      </span>
                    ) : (
                      <span
                        className="text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                        style={{ color: "rgba(255,255,255,0.55)", background: "#ffffff", border: "1px solid #cbd5e1" }}
                        data-testid="schedule-status-off"
                      >
                        Off
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5 truncate" data-testid="schedule-summary">
                    {schedule?.enabled
                      ? `${cadenceLabel(schedule)} → ${schedule.recipients.join(", ")}${
                          schedule.next_run_at ? ` · next ${new Date(schedule.next_run_at).toLocaleString()}` : ""
                        }`
                      : "Have the same CSV emailed to compliance every week or month — no manual export needed."}
                  </p>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${scheduleOpen ? "rotate-180" : ""}`}
                />
              </button>

              {scheduleOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-zinc-900/80" data-testid="schedule-body">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {/* Cadence */}
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        Cadence
                      </label>
                      <div className="flex items-center gap-1">
                        {(["weekly", "monthly"] as const).map(f => (
                          <button
                            key={f}
                            type="button"
                            data-testid={`schedule-freq-${f}`}
                            onClick={() => setSchedDraftFrequency(f)}
                            className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] px-2 py-1 rounded transition-colors"
                            style={{
                              color:      schedDraftFrequency === f ? GOLD              : "rgba(255,255,255,0.55)",
                              background: schedDraftFrequency === f ? `${GOLD}14`       : "#ffffff",
                              border:     `1px solid ${schedDraftFrequency === f ? `${GOLD}40` : "rgba(15,23,42,0.03)"}`,
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Day */}
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        {schedDraftFrequency === "weekly" ? "Day of week" : "Day of month"}
                      </label>
                      {schedDraftFrequency === "weekly" ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {DOW_LABELS.map((d, i) => (
                            <button
                              key={d}
                              type="button"
                              data-testid={`schedule-dow-${i}`}
                              onClick={() => setSchedDraftDow(i)}
                              className="text-[10px] font-mono font-bold uppercase tracking-[0.12em] px-2 py-1 rounded transition-colors"
                              style={{
                                color:      schedDraftDow === i ? GOLD              : "rgba(255,255,255,0.55)",
                                background: schedDraftDow === i ? `${GOLD}14`       : "#ffffff",
                                border:     `1px solid ${schedDraftDow === i ? `${GOLD}40` : "rgba(15,23,42,0.03)"}`,
                              }}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <select
                          value={schedDraftDom}
                          onChange={e => setSchedDraftDom(parseInt(e.target.value, 10))}
                          data-testid="schedule-dom"
                          className="text-[11px] font-mono px-2 py-1 rounded outline-none"
                          style={{ background: "#F8FAFC", border: "1px solid #cbd5e1", color: "rgba(255,255,255,0.85)" }}
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>Day {d}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Hour */}
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        Send time
                      </label>
                      <select
                        value={schedDraftHour}
                        onChange={e => setSchedDraftHour(parseInt(e.target.value, 10))}
                        data-testid="schedule-hour"
                        className="text-[11px] font-mono px-2 py-1 rounded outline-none w-full"
                        style={{ background: "#F8FAFC", border: "1px solid #cbd5e1", color: "rgba(255,255,255,0.85)" }}
                      >
                        {Array.from({ length: 24 }, (_, h) => h).map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                        ))}
                      </select>
                    </div>

                    {/* Timezone */}
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        Timezone <span className="text-zinc-600 normal-case tracking-normal">· {tzAbbrev(schedDraftTz)}</span>
                      </label>
                      <select
                        value={schedDraftTz}
                        onChange={e => setSchedDraftTz(e.target.value)}
                        data-testid="schedule-timezone"
                        className="text-[11px] font-mono px-2 py-1 rounded outline-none w-full"
                        style={{ background: "#F8FAFC", border: "1px solid #cbd5e1", color: "rgba(255,255,255,0.85)" }}
                      >
                        {TZ_OPTIONS.map(tz => (
                          <option key={tz} value={tz}>
                            {tz === browserTz ? `${tz} (your zone)` : tz}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subject (optional) */}
                    <div>
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        Subject (optional)
                      </label>
                      <input
                        type="text"
                        value={schedDraftSubject}
                        onChange={e => setSchedDraftSubject(e.target.value)}
                        placeholder="Auto-generated if left blank"
                        data-testid="schedule-subject"
                        className="w-full text-[11px] font-mono px-2 py-1 rounded outline-none"
                        style={{ background: "#F8FAFC", border: "1px solid #cbd5e1", color: "rgba(255,255,255,0.85)" }}
                      />
                    </div>

                    {/* Recipients */}
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        Compliance recipients (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={schedDraftRecipients}
                        onChange={e => setSchedDraftRecipients(e.target.value)}
                        placeholder="compliance@firm.com, audit@firm.com"
                        data-testid="schedule-recipients"
                        className="w-full text-[11px] font-mono px-2 py-1.5 rounded outline-none"
                        style={{ background: "#F8FAFC", border: "1px solid #cbd5e1", color: "rgba(255,255,255,0.85)" }}
                      />
                    </div>

                    {/* CC */}
                    <div className="md:col-span-2">
                      <label className="block text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-500 mb-1">
                        CC (optional)
                      </label>
                      <input
                        type="text"
                        value={schedDraftCc}
                        onChange={e => setSchedDraftCc(e.target.value)}
                        placeholder="cc@firm.com"
                        data-testid="schedule-cc"
                        className="w-full text-[11px] font-mono px-2 py-1.5 rounded outline-none"
                        style={{ background: "#F8FAFC", border: "1px solid #cbd5e1", color: "rgba(255,255,255,0.85)" }}
                      />
                    </div>
                  </div>

                  {schedule?.last_run_at && (
                    <div className="mt-3 text-[10px] font-mono text-zinc-500" data-testid="schedule-last-run">
                      Last run {new Date(schedule.last_run_at).toLocaleString()}
                      {schedule.last_status ? ` · ${schedule.last_status}` : ""}
                      {schedule.last_row_count != null ? ` · ${schedule.last_row_count} row${schedule.last_row_count === 1 ? "" : "s"}` : ""}
                      {schedule.last_error ? <span style={{ color: RED }}> · {schedule.last_error}</span> : null}
                    </div>
                  )}

                  {schedMsg && (
                    <p
                      data-testid="schedule-msg"
                      className="mt-2 text-[10px] font-mono"
                      style={{ color: schedMsg.ok ? GREEN : RED }}
                    >
                      {schedMsg.text}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => saveSchedule(true)}
                      disabled={schedBusy === "save"}
                      data-testid="button-schedule-save"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                      style={{ color: GREEN, background: `${GREEN}14`, border: `1px solid ${GREEN}40` }}
                    >
                      {schedBusy === "save" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {schedule?.enabled ? "Update schedule" : "Enable schedule"}
                    </button>
                    {schedule && (
                      <>
                        <button
                          type="button"
                          onClick={runScheduleNow}
                          disabled={schedBusy === "run"}
                          data-testid="button-schedule-run-now"
                          title="Fire this schedule immediately as a test (does not change next run time)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                          style={{ color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}35` }}
                        >
                          {schedBusy === "run" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send test now
                        </button>
                        {schedule.enabled && (
                          <button
                            type="button"
                            onClick={() => saveSchedule(false)}
                            disabled={schedBusy === "save"}
                            data-testid="button-schedule-disable"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                            style={{ color: GOLD, background: `${GOLD}10`, border: `1px solid ${GOLD}35` }}
                          >
                            Pause
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={deleteSchedule}
                          disabled={schedBusy === "delete"}
                          data-testid="button-schedule-delete"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ml-auto"
                          style={{ color: RED, background: `${RED}10`, border: `1px solid ${RED}35` }}
                        >
                          {schedBusy === "delete" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {deliveries.length === 0 && (
              <div
                data-testid="delivery-empty"
                className="rounded-xl border border-dashed border-zinc-900 px-4 py-6 text-center text-[10px] font-mono text-zinc-600"
                style={{ background: "#F8FAFC" }}
              >
                {historySearchDebounced
                  ? <>No deliveries match <span className="text-zinc-400">“{historySearchDebounced}”</span>.</>
                  : <>No deliveries yet for this {historyScope === "contract" ? "contract" : "company"}.</>}
              </div>
            )}
            {deliveries.length > 0 && (
            <div className="rounded-xl border border-zinc-900" style={{ background: "#F8FAFC" }}>
              {deliveryGroups.map((group, gi) => {
                const collapsed = collapsedGroups.has(group.key);
                return (
                <div key={group.key} data-testid={`delivery-group-${group.key}`}>
                  <button
                    type="button"
                    data-testid={`delivery-group-header-${group.key}`}
                    onClick={() => toggleGroupCollapsed(group.key)}
                    aria-expanded={!collapsed}
                    title={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                    className={`w-full sticky top-0 z-10 px-4 py-1.5 flex items-center gap-2 text-left transition-colors hover:bg-[var(--kiq-surface)]/[0.03] ${gi > 0 ? "border-t border-zinc-900" : "rounded-t-xl"}`}
                    style={{ background: "rgba(10,13,20,0.94)", backdropFilter: "blur(6px)" }}
                  >
                    <ChevronDown
                      className={`w-3 h-3 text-zinc-500 flex-shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-400">
                      {group.label}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-600">
                      · {group.rows.length} {group.rows.length === 1 ? "delivery" : "deliveries"}
                    </span>
                  </button>
              {!collapsed && group.rows.map((d, i) => {
                const when = d.created_at ? new Date(d.created_at) : null;
                const highlight = (text: string | null | undefined) => {
                  const s = text ?? "";
                  const q = historySearchDebounced;
                  if (!q || !s) return s;
                  const lc = s.toLowerCase();
                  const lq = q.toLowerCase();
                  const out: Array<JSX.Element | string> = [];
                  let idx = 0;
                  let key = 0;
                  while (idx < s.length) {
                    const found = lc.indexOf(lq, idx);
                    if (found === -1) { out.push(s.slice(idx)); break; }
                    if (found > idx) out.push(s.slice(idx, found));
                    out.push(
                      <mark
                        key={key++}
                        className="font-bold rounded-sm px-0.5"
                        style={{ background: `${GOLD}40`, color: GOLD }}
                      >
                        {s.slice(found, found + q.length)}
                      </mark>
                    );
                    idx = found + q.length;
                  }
                  return <>{out}</>;
                };
                const whenLabel = when
                  ? when.toLocaleString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })
                  : "—";
                const toLabel = (d.recipients && d.recipients.length > 0) ? d.recipients.join(", ") : d.recipient;
                return (
                  <div
                    key={d.id}
                    data-testid={`delivery-row-${d.id}`}
                    className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-zinc-900" : ""}`}
                  >
                    <div className="mt-0.5">
                      {d.smtp_sent
                        ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: GREEN }} />
                        : <Clock className="w-3.5 h-3.5" style={{ color: GOLD }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-[var(--kiq-ink-soft)] truncate" data-testid={`delivery-recipient-${d.id}`}>
                          {highlight(toLabel)}
                        </span>
                        {d.cc && d.cc.length > 0 && (
                          <span className="text-[9px] font-mono text-zinc-600" data-testid={`delivery-cc-${d.id}`}>
                            cc: {highlight(d.cc.join(", "))}
                          </span>
                        )}
                        {(d.bcc_count ?? 0) > 0 && (
                          <span
                            className="text-[9px] font-mono text-zinc-500"
                            title="Hidden recipients (count only — addresses not stored)"
                            data-testid={`delivery-bcc-count-${d.id}`}
                          >
                            + {d.bcc_count} bcc
                          </span>
                        )}
                        <span
                          className="text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                          style={{
                            color:      d.smtp_sent ? GREEN : GOLD,
                            background: `${d.smtp_sent ? GREEN : GOLD}12`,
                            border:     `1px solid ${d.smtp_sent ? GREEN : GOLD}30`,
                          }}
                        >
                          {d.smtp_sent ? "Delivered" : "Queued"}
                        </span>
                        {d.source === "scheduled" && (
                          <span
                            data-testid={`delivery-source-badge-${d.id}`}
                            title="Sent automatically by the compliance auto-email scheduler (not a manual send)"
                            className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                            style={{
                              color:      PURPLE,
                              background: `${PURPLE}12`,
                              border:     `1px solid ${PURPLE}35`,
                            }}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            Scheduled
                          </span>
                        )}
                        {d.source === "diff" && (
                          <span
                            data-testid={`delivery-source-badge-${d.id}`}
                            title="Emailed executive-summary diff from the AI History panel"
                            className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                            style={{
                              color:      "#38BDF8",
                              background: "#38BDF812",
                              border:     "1px solid #38BDF835",
                            }}
                          >
                            <GitCompare className="w-2.5 h-2.5" />
                            Diff
                          </span>
                        )}
                        {d.source === "bid" && (
                          <span
                            data-testid={`delivery-source-badge-${d.id}`}
                            title="Emailed Bid Optimizer recommendation PDF"
                            className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                            style={{
                              color:      GOLD,
                              background: `${GOLD}12`,
                              border:     `1px solid ${GOLD}35`,
                            }}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            Bid PDF
                          </span>
                        )}
                        {d.source === "diff" && (() => {
                          const sentAsPdf =
                            (d.components || []).some(c => /\(pdf\)/i.test(c)) ||
                            (d.filename || "").toLowerCase().endsWith(".pdf");
                          return (
                            <span
                              data-testid={`delivery-diff-format-badge-${d.id}`}
                              title={sentAsPdf
                                ? "Recipient received a polished PDF attachment"
                                : "Recipient received the diff as plain-text Markdown in the email body"}
                              className="inline-flex items-center gap-1 text-[8px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
                              style={{
                                color:      sentAsPdf ? GOLD : "#94A3B8",
                                background: sentAsPdf ? `${GOLD}12` : "#94A3B812",
                                border:     `1px solid ${sentAsPdf ? `${GOLD}35` : "#94A3B835"}`,
                              }}
                            >
                              {sentAsPdf
                                ? <Paperclip className="w-2.5 h-2.5" />
                                : <FileText className="w-2.5 h-2.5" />}
                              {sentAsPdf ? "PDF" : "Text"}
                            </span>
                          );
                        })()}
                      </div>
                      {d.subject && (
                        <p className="text-[10px] text-zinc-500 mt-1 truncate" data-testid={`delivery-subject-${d.id}`}>
                          {highlight(d.subject)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-zinc-600 flex-wrap">
                        <span data-testid={`delivery-time-${d.id}`}>{whenLabel}</span>
                        <span>·</span>
                        <span data-testid={`delivery-components-${d.id}`}>
                          {d.component_count} component{d.component_count === 1 ? "" : "s"}
                        </span>
                        {d.client_name && (<><span>·</span><span>{d.client_name}</span></>)}
                        {d.ein && (<><span>·</span><span>EIN {d.ein}</span></>)}
                        {d.filename && (
                          <>
                            <span>·</span>
                            <span className="truncate">
                              {d.filename}
                              {d.size_bytes ? ` (${(d.size_bytes / 1024).toFixed(1)} KB)` : ""}
                            </span>
                          </>
                        )}
                      </div>
                      {rowMsg[d.id] && (
                        <p
                          data-testid={`delivery-rowmsg-${d.id}`}
                          className="text-[10px] mt-1.5"
                          style={{ color: rowMsg[d.id]!.ok ? GREEN : RED }}
                        >
                          {rowMsg[d.id]!.text}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        data-testid={`button-view-delivery-${d.id}`}
                        onClick={() => setViewingDelivery({
                          id:            d.id,
                          recipient:     d.recipient,
                          recipients:    d.recipients,
                          subject:       d.subject,
                          filename:      d.filename,
                          components:    d.components || [],
                          ein:           d.ein,
                          rx_defense_id: d.rx_defense_id,
                          client_name:   d.client_name,
                          created_at:    d.created_at,
                          snapshot_components: d.snapshot_components || [],
                          snapshot_at:   d.snapshot_at,
                        })}
                        disabled={!d.components || d.components.length === 0 || d.source === "diff" || d.source === "bid"}
                        title={d.source === "diff"
                          ? "Emailed diffs have no packaged components to preview"
                          : d.source === "bid"
                          ? "Emailed bid recommendations are audit records — the PDF is rendered at send time"
                          : d.components && d.components.length > 0
                          ? `Preview the ${d.component_count} component${d.component_count === 1 ? "" : "s"} included in this delivery`
                          : "No components recorded for this delivery"}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          color:      PURPLE,
                          background: `${PURPLE}10`,
                          border:     `1px solid ${PURPLE}35`,
                        }}
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      <button
                        type="button"
                        data-testid={`button-resend-${d.id}`}
                        onClick={() => handleResendDelivery(d.id, d.source === "diff")}
                        disabled={!!rowBusy[d.id] || d.source === "scheduled" || d.source === "bid" || (d.source !== "diff" && (!d.components || d.components.length === 0))}
                        title={d.source === "scheduled"
                          ? "Scheduled compliance auto-emails can't be resent from here — manage cadence in the Auto-email log card above"
                          : d.source === "bid"
                          ? "Bid recommendations are rendered at send time — re-send from the Bid Optimizer"
                          : d.source === "diff"
                          ? `Re-send this diff to ${(d.recipients?.length ? d.recipients : [d.recipient]).join(", ")}`
                          : `Re-send to ${(d.recipients?.length ? d.recipients : [d.recipient]).join(", ")}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          color:      GOLD,
                          background: `${GOLD}10`,
                          border:     `1px solid ${GOLD}35`,
                        }}
                      >
                        {rowBusy[d.id] === "resend"
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Send className="w-3 h-3" />}
                        Resend
                      </button>
                      <button
                        type="button"
                        data-testid={`button-redownload-${d.id}`}
                        onClick={() => handleRedownloadDelivery(d.id)}
                        disabled={!!rowBusy[d.id] || d.source === "scheduled" || d.source === "diff" || d.source === "bid" || !d.components || d.components.length === 0}
                        title={d.source === "scheduled"
                          ? "Scheduled rows are CSV log emails, not packaged ZIPs — nothing to rebuild"
                          : d.source === "diff"
                          ? "Emailed diffs are audit records, not packaged ZIPs — nothing to rebuild"
                          : d.source === "bid"
                          ? "Emailed bid recommendations are audit records, not packaged ZIPs — nothing to rebuild"
                          : "Rebuild and download this package as a ZIP"}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50"
                        style={{
                          color:      BLUE,
                          background: `${BLUE}10`,
                          border:     `1px solid ${BLUE}35`,
                        }}
                      >
                        {rowBusy[d.id] === "download"
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Download className="w-3 h-3" />}
                        Download
                      </button>
                      <button
                        type="button"
                        data-testid={`button-download-original-${d.id}`}
                        onClick={() => handleDownloadOriginal(d.id)}
                        disabled={!!rowBusy[d.id] || !d.original_available}
                        title={d.original_available
                          ? "Recover the EXACT original ZIP that was sent — byte-identical stored bytes, no rebuild"
                          : "The exact original ZIP wasn't captured for this delivery — it predates byte-identical archiving"}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          color:      GREEN,
                          background: `${GREEN}10`,
                          border:     `1px solid ${GREEN}35`,
                        }}
                      >
                        {rowBusy[d.id] === "original"
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Archive className="w-3 h-3" />}
                        Original
                      </button>
                      <button
                        type="button"
                        data-testid={`button-verify-${d.id}`}
                        onClick={() => primeVerifyFromDelivery(d.filename)}
                        title={d.filename
                          ? `Jump to Verify panel and prime it with ${d.filename}`
                          : "Jump to Verify panel"}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors"
                        style={{
                          color:      GREEN,
                          background: `${GREEN}10`,
                          border:     `1px solid ${GREEN}35`,
                        }}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Verify
                      </button>
                    </div>
                  </div>
                );
              })}
                </div>
                );
              })}
            </div>
            )}
            {deliveries.length > 0 && deliveriesTotal > deliveries.length && (
              <div className="mt-3 flex flex-col items-center gap-2">
                <button
                  type="button"
                  data-testid="button-load-more-deliveries"
                  onClick={loadMoreDeliveries}
                  disabled={loadMoreBusy || historyFetching}
                  title={`Load the next ${Math.min(HISTORY_PAGE_SIZE, deliveriesTotal - deliveries.length)} older deliveries`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
                  style={{
                    color:      GOLD,
                    background: `${GOLD}10`,
                    border:     `1px solid ${GOLD}35`,
                  }}
                >
                  {loadMoreBusy
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <ChevronDown className="w-3 h-3" />}
                  Load {Math.min(HISTORY_PAGE_SIZE, deliveriesTotal - deliveries.length)} more
                  <span className="font-mono opacity-70">
                    ({deliveries.length}/{deliveriesTotal})
                  </span>
                </button>
                {loadMoreError && (
                  <p
                    data-testid="text-load-more-error"
                    className="text-[10px] font-mono"
                    style={{ color: RED }}
                  >
                    {loadMoreError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Verify package — recompute SHA-256 against embedded manifest.json */}
        <div className="mt-8" data-testid="verify-package-section">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: BLUE }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              Verify package
            </h3>
            <span className="text-[9px] font-mono text-zinc-600">
              · drag a downloaded ZIP back in to confirm it hasn't been tampered with
            </span>
          </div>

          {expectedVerifyFilename && (
            <div
              data-testid="verify-expected-hint"
              className="mb-2 rounded-md px-3 py-2 text-[10px] font-mono flex items-center justify-between gap-3"
              style={{ background: `${GREEN}0F`, border: `1px solid ${GREEN}40`, color: "#D4D4D8" }}
            >
              <span className="truncate">
                <span style={{ color: GREEN }} className="font-bold uppercase tracking-[0.12em] mr-2">Expected</span>
                {expectedVerifyFilename}
              </span>
              <button
                type="button"
                data-testid="verify-expected-clear"
                onClick={(e) => { e.stopPropagation(); setExpectedVerifyFilename(null); setVerifyFilenameMismatch(null); }}
                className="text-zinc-500 hover:text-[var(--kiq-muted)] flex-shrink-0"
                aria-label="Clear expected filename"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            ref={verifyDropzoneRef}
            tabIndex={-1}
            data-testid="verify-dropzone"
            onDragOver={(e) => { e.preventDefault(); setVerifyDragOver(true); }}
            onDragLeave={() => setVerifyDragOver(false)}
            onDrop={handleVerifyDrop}
            onClick={() => verifyInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-offset-0"
            style={{
              background:  verifyDragOver ? `${BLUE}10` : "#ffffff",
              borderColor: verifyDragOver
                ? `${BLUE}80`
                : expectedVerifyFilename
                  ? `${GREEN}55`
                  : "rgba(15,23,42,0.06)",
            }}
          >
            <input
              ref={verifyInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              data-testid="verify-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runVerify(f);
              }}
            />
            <div className="flex flex-col items-center gap-2">
              {verifyLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: BLUE }} />
              ) : (
                <Upload className="w-5 h-5" style={{ color: verifyDragOver ? BLUE : "#71717A" }} />
              )}
              <div className="text-[11px] font-bold text-[var(--kiq-muted)]">
                {verifyLoading
                  ? "Recomputing SHA-256 hashes…"
                  : verifyFile
                  ? verifyFile.name
                  : "Drop a kiq_package_*.zip here, or click to browse"}
              </div>
              {verifyFile && !verifyLoading && (
                <div className="text-[9px] font-mono text-zinc-600">
                  {(verifyFile.size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
          </div>

          {verifyFilenameMismatch && (
            <div
              className="mt-3 rounded-xl p-3 flex items-start gap-2"
              data-testid="verify-filename-mismatch"
              style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}40` }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
              <span className="text-[11px] text-[var(--kiq-muted)]">{verifyFilenameMismatch}</span>
            </div>
          )}

          {verifyError && (
            <div
              className="mt-3 rounded-xl p-3 flex items-start gap-2"
              data-testid="verify-error"
              style={{ background: `${RED}10`, border: `1px solid ${RED}30` }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: RED }} />
              <span className="text-[11px] text-[var(--kiq-muted)]">{verifyError}</span>
            </div>
          )}

          {verifyResult && (
            <div className="mt-3 space-y-3" data-testid="verify-result">
              {/* PASS / FAIL banner */}
              {(() => {
                const ok = verifyResult.ok;
                const color = ok ? GREEN : RED;
                const Icon  = ok ? CheckCircle2 : XCircle;
                const label = ok ? "PASS — package integrity verified" : "FAIL — package has been altered";
                return (
                  <div
                    data-testid="verify-banner"
                    data-verify-status={ok ? "pass" : "fail"}
                    className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: `${color}12`, border: `1px solid ${color}50` }}
                  >
                    <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
                        {label}
                      </div>
                      <div className="mt-1 text-[10px] font-mono text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span data-testid="verify-summary-matched">
                          <span style={{ color: GREEN }}>✓</span> {verifyResult.summary.matched} matched
                        </span>
                        {verifyResult.summary.mismatched > 0 && (
                          <span data-testid="verify-summary-mismatched">
                            <span style={{ color: RED }}>✗</span> {verifyResult.summary.mismatched} altered
                          </span>
                        )}
                        {verifyResult.summary.missing > 0 && (
                          <span data-testid="verify-summary-missing">
                            <span style={{ color: GOLD }}>−</span> {verifyResult.summary.missing} missing
                          </span>
                        )}
                        {verifyResult.summary.extra > 0 && (
                          <span data-testid="verify-summary-extra">
                            <span style={{ color: GOLD }}>+</span> {verifyResult.summary.extra} unexpected
                          </span>
                        )}
                        {verifyResult.manifest?.generated_at && (
                          <span>· manifest @ {String(verifyResult.manifest.generated_at)}</span>
                        )}
                      </div>
                      {verifyResult.error && (
                        <div className="mt-1 text-[10px] text-zinc-400">{verifyResult.error}</div>
                      )}
                    </div>
                    <button
                      onClick={clearVerify}
                      className="text-zinc-500 hover:text-[var(--kiq-muted)]"
                      data-testid="verify-clear"
                      aria-label="Clear verification result"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()}

              {/* Per-file results table */}
              {verifyResult.files.length > 0 && (
                <div
                  className="rounded-xl border border-zinc-900 overflow-hidden"
                  style={{ background: "#F8FAFC" }}
                  data-testid="verify-files-table"
                >
                  <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 border-b border-zinc-900 text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-600">
                    <span>File · expected → actual</span>
                    <span>Size</span>
                    <span>Status</span>
                  </div>
                  {verifyResult.files.map((f, i) => {
                    const statusColor =
                      f.status === "match"    ? GREEN :
                      f.status === "mismatch" ? RED   :
                      f.status === "missing"  ? RED   : GOLD;
                    const StatusIcon =
                      f.status === "match" ? CheckCircle2 :
                      f.status === "extra" ? AlertTriangle : XCircle;
                    return (
                      <div
                        key={`${f.filename}-${i}`}
                        data-testid={`verify-row-${f.filename}`}
                        data-verify-row-status={f.status}
                        className={`grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 items-start ${i > 0 ? "border-t border-zinc-900" : ""}`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[var(--kiq-ink-soft)] truncate">
                            {f.filename}
                          </div>
                          {f.label && f.label !== f.filename && (
                            <div className="text-[9px] text-zinc-600">{f.label}</div>
                          )}
                          <div className="mt-1 text-[9px] font-mono text-zinc-500 break-all leading-tight">
                            {f.expected_sha256 && (
                              <div>
                                <span className="text-zinc-700">expected</span>{" "}
                                <span style={{ color: GREEN }}>{f.expected_sha256}</span>
                              </div>
                            )}
                            {f.actual_sha256 && (
                              <div>
                                <span className="text-zinc-700">actual&nbsp;&nbsp;</span>{" "}
                                <span style={{ color: f.status === "match" ? GREEN : RED }}>
                                  {f.actual_sha256}
                                </span>
                              </div>
                            )}
                            {f.status === "missing" && (
                              <div className="text-zinc-600 italic">— file not present in uploaded ZIP —</div>
                            )}
                          </div>
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 whitespace-nowrap text-right">
                          {f.expected_size != null && (
                            <div>{f.expected_size.toLocaleString()} B</div>
                          )}
                          {f.actual_size != null && f.actual_size !== f.expected_size && (
                            <div style={{ color: f.status === "match" ? GREEN : RED }}>
                              {f.actual_size.toLocaleString()} B
                            </div>
                          )}
                        </div>
                        <div>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-[0.12em] text-[9px]"
                            style={{
                              color:      statusColor,
                              background: `${statusColor}12`,
                              border:     `1px solid ${statusColor}35`,
                            }}
                          >
                            <StatusIcon className="w-2.5 h-2.5" />
                            {f.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Component preview drawer */}
        <ComponentPreviewDrawer
          viewingId={viewingId}
          onClose={() => setViewingId(null)}
          components={components}
          contractId={contractId}
          ein={ein}
          clientName={clientName || einName || "Client"}
        />

        {/* Delivery preview drawer — opens from a Recent Deliveries row */}
        <DeliveryPreviewDrawer
          delivery={viewingDelivery}
          onClose={() => setViewingDelivery(null)}
        />

        {/* Footer note */}
        <div className="mt-8 pt-6 border-t border-zinc-900">
          <div className="flex items-start gap-2 text-[9px] font-mono text-zinc-700">
            <Hash className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Every download includes a machine-readable <code>manifest.json</code> with a SHA-256 hash and byte size for each file,
              plus a matching Integrity Verification section in <code>cover_sheet.html</code>. Tamper-proof per Hard Rule #03.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
