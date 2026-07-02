import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, ChevronRight, Zap, Star, Clock, GripVertical, Building2 } from "lucide-react";
import { navSections, quickActions } from "@/lib/navConfig";
import { openFileVerifier } from "@/components/FileVerifierLauncher";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type FlatItem =
  | { kind: "action"; label: string; description: string; path: string; icon: any; badge?: string }
  | { kind: "page"; section: string; label: string; path: string; icon: any }
  | { kind: "company"; label: string; path: string; icon: any; sub: string; ein: string };

interface CompanyHit {
  ein: string;
  company: string;
  city: string;
  state: string;
  participants: number;
}

const PINS_STORAGE_KEY = "kiq:command-palette:pinned-paths";
const RECENT_STORAGE_KEY = "kiq:command-palette:recent-paths";
const RECENT_MAX = 8;

function loadPins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function savePins(pins: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
  } catch {
    /* ignore quota errors */
  }
}

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function recordRecentPage(path: string) {
  if (typeof window === "undefined") return;
  if (!path || typeof path !== "string") return;
  try {
    const current = loadRecent();
    const next = [path, ...current.filter((p) => p !== path)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function clearRecentPages() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function saveRecent(recent: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent));
  } catch {
    /* ignore quota errors */
  }
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => loadPins());
  const [recentPaths, setRecentPaths] = useState<string[]>(() => loadRecent());
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<CompanyHit[]>([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);

  const normalize = (s: string) => s.toLowerCase().replace(/[™®°]/g, "");

  const allPageItems: FlatItem[] = navSections.flatMap((sec) =>
    sec.items.map((item) => ({
      kind: "page" as const,
      section: sec.heading,
      label: item.label,
      path: item.path,
      icon: item.icon,
    }))
  );

  const actionItems: FlatItem[] = quickActions.map((qa) => ({
    kind: "action" as const,
    label: qa.label,
    description: qa.description,
    path: qa.path,
    icon: qa.icon,
    badge: qa.badge,
  }));

  const pinnedSet = new Set(pinnedPaths);
  const pageByPath = new Map(allPageItems.map((p) => [p.path, p as Extract<FlatItem, { kind: "page" }>]));
  const pinnedItems: FlatItem[] = pinnedPaths
    .map((path) => pageByPath.get(path))
    .filter((item): item is Extract<FlatItem, { kind: "page" }> => Boolean(item));

  const togglePin = useCallback((path: string) => {
    setPinnedPaths((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      savePins(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((path: string) => {
    setRecentPaths((prev) => {
      const next = prev.filter((p) => p !== path);
      saveRecent(next);
      return next;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentPaths([]);
    clearRecentPages();
  }, []);

  const movePin = useCallback((path: string, direction: -1 | 1) => {
    setPinnedPaths((prev) => {
      const idx = prev.indexOf(path);
      if (idx === -1) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      savePins(next);
      return next;
    });
  }, []);

  const [draggedPin, setDraggedPin] = useState<string | null>(null);
  const [dragOverPin, setDragOverPin] = useState<string | null>(null);
  const [keyboardGrabbed, setKeyboardGrabbed] = useState<string | null>(null);

  const reorderPinTo = useCallback((fromPath: string, toPath: string) => {
    if (fromPath === toPath) return;
    setPinnedPaths((prev) => {
      const from = prev.indexOf(fromPath);
      const to = prev.indexOf(toPath);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      savePins(next);
      return next;
    });
  }, []);

  const hasQuery = query.trim().length > 0;
  const q = normalize(query);

  const filteredActions = actionItems.filter((a) => normalize(a.label).includes(q) || normalize((a as any).description || "").includes(q));
  const filteredPages = allPageItems.filter((p) => normalize(p.label).includes(q) || p.path.includes(query.trim().toLowerCase()));

  const companyItems: FlatItem[] = companyResults.map((c) => ({
    kind: "company" as const,
    label: c.company,
    path: `/company-360/${c.ein}`,
    icon: Building2,
    sub: `${c.city}, ${c.state} · ${(c.participants || 0).toLocaleString()} participants`,
    ein: c.ein,
  }));

  type GroupedSection = { heading: string; isActions: boolean; isPinned?: boolean; isRecent?: boolean; isCompanies?: boolean; items: Array<{ item: FlatItem; flatIndex: number }> };
  const grouped: GroupedSection[] = [];
  let fi = 0;

  const recentItems: FlatItem[] = recentPaths
    .map((path) => pageByPath.get(path))
    .filter((item): item is Extract<FlatItem, { kind: "page" }> => Boolean(item));

  if (!hasQuery) {
    if (recentItems.length > 0) {
      grouped.push({
        heading: "Recent",
        isActions: false,
        isRecent: true,
        items: recentItems.map((item) => ({ item, flatIndex: fi++ })),
      });
    }
    if (pinnedItems.length > 0) {
      grouped.push({
        heading: "Pinned",
        isActions: false,
        isPinned: true,
        items: pinnedItems.map((item) => ({ item, flatIndex: fi++ })),
      });
    }
    grouped.push({
      heading: "Quick Actions",
      isActions: true,
      items: actionItems.map((item) => ({ item, flatIndex: fi++ })),
    });
    const sectionMap = new Map<string, GroupedSection>();
    for (const item of allPageItems) {
      const pageItem = item as Extract<FlatItem, { kind: "page" }>;
      if (!sectionMap.has(pageItem.section)) {
        const gs: GroupedSection = { heading: pageItem.section, isActions: false, items: [] };
        sectionMap.set(pageItem.section, gs);
        grouped.push(gs);
      }
      sectionMap.get(pageItem.section)!.items.push({ item, flatIndex: fi++ });
    }
  } else {
    if (companyItems.length > 0) {
      grouped.push({
        heading: "Companies",
        isActions: false,
        isCompanies: true,
        items: companyItems.map((item) => ({ item, flatIndex: fi++ })),
      });
    }
    const pinnedMatches = filteredPages.filter((p) => pinnedSet.has(p.path));
    if (pinnedMatches.length > 0) {
      grouped.push({
        heading: "Pinned",
        isActions: false,
        isPinned: true,
        items: pinnedMatches.map((item) => ({ item, flatIndex: fi++ })),
      });
    }
    if (filteredActions.length > 0) {
      grouped.push({
        heading: "Quick Actions",
        isActions: true,
        items: filteredActions.map((item) => ({ item, flatIndex: fi++ })),
      });
    }
    if (filteredPages.length > 0) {
      const sectionMap = new Map<string, GroupedSection>();
      for (const item of filteredPages) {
        const pageItem = item as Extract<FlatItem, { kind: "page" }>;
        if (!sectionMap.has(pageItem.section)) {
          const gs: GroupedSection = { heading: pageItem.section, isActions: false, items: [] };
          sectionMap.set(pageItem.section, gs);
          grouped.push(gs);
        }
        sectionMap.get(pageItem.section)!.items.push({ item, flatIndex: fi++ });
      }
    }
  }

  const totalItems = fi;

  const flatItems: FlatItem[] = grouped.flatMap((g) => g.items.map((gi) => gi.item));

  const handleSelect = useCallback(
    (path: string) => {
      if (path === "#verify-file") {
        openFileVerifier();
        onClose();
        return;
      }
      navigate(path);
      onClose();
    },
    [navigate, onClose]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setPinnedPaths(loadPins());
      setRecentPaths(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open || debouncedQuery.length < 2) {
      setCompanyResults([]);
      setSearchingCompanies(false);
      return;
    }
    const controller = new AbortController();
    setSearchingCompanies(true);
    fetch(`/api/company-360/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d) => {
        setCompanyResults(Array.isArray(d?.results) ? d.results : []);
        setSearchingCompanies(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setCompanyResults([]);
        setSearchingCompanies(false);
      });
    return () => controller.abort();
  }, [open, debouncedQuery]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndex];
        if (item) handleSelect(item.path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, activeIndex, totalItems, flatItems, handleSelect, onClose]);

  if (!open) return null;

  const totalPageCount = navSections.reduce((a, s) => a + s.items.length, 0);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="command-palette-overlay"
    >
      <div
        className="w-full max-w-[640px] mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, rgba(14,20,50,0.98) 0%, rgba(8,12,34,0.99) 100%)",
          border: "1px solid rgba(100,130,255,0.22)",
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px rgba(79,125,255,0.08)",
          maxHeight: "70vh",
        }}
        data-testid="command-palette-modal"
      >
        {/* Search row */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: "1px solid rgba(100,130,255,0.14)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <Search size={17} style={{ color: "rgba(150,170,255,0.5)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, pages, tools, and actions…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "rgba(220,230,255,0.92)", caretColor: "#4f7dff" }}
            data-testid="command-palette-input"
          />
          <div className="flex items-center gap-1.5">
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-0.5 rounded opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: "rgba(180,200,255,0.7)" }}
              >
                <X size={13} />
              </button>
            )}
            <kbd
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "rgba(130,150,220,0.5)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 5,
                padding: "2px 6px",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              ESC
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto custom-scrollbar" style={{ maxHeight: "calc(70vh - 108px)" }}>
          {hasQuery && totalItems === 0 ? (
            (searchingCompanies || query.trim() !== debouncedQuery) && query.trim().length >= 2 ? (
              <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(120,200,170,0.5)" }}>
                Searching companies…
              </div>
            ) : (
              <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(150,170,220,0.4)" }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            )
          ) : (
            grouped.map((section) => (
              <div key={section.heading}>
                <div
                  className="px-4 pt-3 pb-1 flex items-center gap-2"
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: section.isActions
                      ? "rgba(255,184,0,0.5)"
                      : section.isPinned
                      ? "rgba(255,210,90,0.65)"
                      : section.isRecent
                      ? "rgba(130,200,255,0.65)"
                      : section.isCompanies
                      ? "rgba(120,230,180,0.7)"
                      : "rgba(100,130,220,0.45)",
                  }}
                >
                  {section.isActions && <Zap size={9} style={{ color: "rgba(255,184,0,0.5)" }} />}
                  {section.isPinned && <Star size={9} style={{ color: "rgba(255,210,90,0.7)" }} fill="rgba(255,210,90,0.7)" />}
                  {section.isRecent && <Clock size={9} style={{ color: "rgba(130,200,255,0.7)" }} />}
                  {section.isCompanies && <Building2 size={9} style={{ color: "rgba(120,230,180,0.7)" }} />}
                  <span>{section.heading}</span>
                  {section.isRecent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllRecent();
                      }}
                      data-testid="button-clear-recent"
                      aria-label="Clear recent pages"
                      title="Clear recent"
                      className="ml-auto transition-opacity hover:opacity-100"
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "rgba(130,200,255,0.55)",
                        background: "rgba(130,200,255,0.06)",
                        border: "1px solid rgba(130,200,255,0.18)",
                        borderRadius: 4,
                        padding: "2px 6px",
                        cursor: "pointer",
                        opacity: 0.75,
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {section.items.map(({ item, flatIndex: idx }, sectionItemIdx) => {
                  const Icon = item.icon;
                  const isActive = activeIndex === idx;
                  const isAction = item.kind === "action";
                  const isPage = item.kind === "page";
                  const isCompany = item.kind === "company";
                  const isPinned = isPage && pinnedSet.has(item.path);
                  const showReorder = section.isPinned && !hasQuery && isPage;
                  const showRemoveRecent = section.isRecent && isPage;
                  const isDragging = showReorder && draggedPin === item.path;
                  const isDragOver = showReorder && dragOverPin === item.path && draggedPin && draggedPin !== item.path;
                  const isGrabbed = showReorder && keyboardGrabbed === item.path;

                  let rowBackground: string = "transparent";
                  if (isDragOver) {
                    rowBackground = "linear-gradient(90deg, rgba(255,210,90,0.18) 0%, rgba(255,210,90,0.05) 100%)";
                  } else if (isGrabbed) {
                    rowBackground = "linear-gradient(90deg, rgba(255,210,90,0.14) 0%, rgba(255,210,90,0.04) 100%)";
                  } else if (isActive) {
                    rowBackground = isAction
                      ? "linear-gradient(90deg, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.04) 100%)"
                      : "linear-gradient(90deg, rgba(79,125,255,0.16) 0%, rgba(79,125,255,0.06) 100%)";
                  }
                  const rowBorderLeft = isGrabbed || isDragOver
                    ? "2px solid rgba(255,210,90,0.8)"
                    : isActive
                    ? `2px solid ${isAction ? "rgba(255,184,0,0.6)" : "rgba(79,125,255,0.6)"}`
                    : "2px solid transparent";

                  return (
                    <div
                      key={item.path + item.label + section.heading}
                      data-active={isActive}
                      data-testid={`command-palette-item-${item.path.replace(/\//g, "-")}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      draggable={showReorder}
                      onDragStart={(e) => {
                        if (!showReorder) return;
                        setDraggedPin(item.path);
                        e.dataTransfer.effectAllowed = "move";
                        try {
                          e.dataTransfer.setData("text/plain", item.path);
                        } catch {
                          /* ignore */
                        }
                      }}
                      onDragOver={(e) => {
                        if (!showReorder || !draggedPin) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverPin !== item.path) setDragOverPin(item.path);
                      }}
                      onDragLeave={() => {
                        if (showReorder && dragOverPin === item.path) setDragOverPin(null);
                      }}
                      onDrop={(e) => {
                        if (!showReorder || !draggedPin) return;
                        e.preventDefault();
                        reorderPinTo(draggedPin, item.path);
                        setDraggedPin(null);
                        setDragOverPin(null);
                      }}
                      onDragEnd={() => {
                        setDraggedPin(null);
                        setDragOverPin(null);
                      }}
                      className="group w-full flex items-center gap-3 px-4 py-2 text-left transition-all duration-75 cursor-pointer"
                      style={{
                        background: rowBackground,
                        borderLeft: rowBorderLeft,
                        color: isActive ? "rgba(200,220,255,0.95)" : "rgba(160,180,230,0.65)",
                        opacity: isDragging ? 0.4 : 1,
                      }}
                      onClick={() => handleSelect(item.path)}
                    >
                      {showReorder && (
                        <button
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (!showReorder) return;
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              setKeyboardGrabbed((prev) => (prev === item.path ? null : item.path));
                            } else if (e.key === "Escape" && isGrabbed) {
                              e.preventDefault();
                              e.stopPropagation();
                              setKeyboardGrabbed(null);
                            } else if (isGrabbed && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                              e.preventDefault();
                              e.stopPropagation();
                              movePin(item.path, e.key === "ArrowUp" ? -1 : 1);
                            }
                          }}
                          data-testid={`button-pin-drag-${item.path.replace(/\//g, "-")}`}
                          aria-label={`Reorder ${item.label}. Press space to grab, arrow keys to move, escape to cancel.`}
                          aria-pressed={isGrabbed}
                          title={isGrabbed ? "Use ↑/↓ to move, space to drop" : "Drag to reorder (or press space)"}
                          className="p-0.5 -ml-1 rounded transition-opacity opacity-30 group-hover:opacity-80 focus:opacity-100"
                          style={{
                            color: isGrabbed ? "rgba(255,210,90,0.95)" : "rgba(180,200,255,0.8)",
                            cursor: "grab",
                            flexShrink: 0,
                            touchAction: "none",
                          }}
                        >
                          <GripVertical size={13} strokeWidth={1.8} />
                        </button>
                      )}
                      <Icon size={14} strokeWidth={1.8} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55 }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        {isAction && (item as any).description && (
                          <div
                            className="text-[10px] truncate mt-0.5"
                            style={{ color: "rgba(130,150,200,0.45)" }}
                          >
                            {(item as any).description}
                          </div>
                        )}
                        {isCompany && (item as any).sub && (
                          <div
                            className="text-[10px] truncate mt-0.5"
                            style={{ color: "rgba(120,200,170,0.5)" }}
                          >
                            {(item as any).sub}
                          </div>
                        )}
                      </div>
                      {isAction && (item as any).badge && (
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#FFB800",
                            background: "rgba(255,184,0,0.10)",
                            border: "1px solid rgba(255,184,0,0.22)",
                            borderRadius: 4,
                            padding: "1px 5px",
                            flexShrink: 0,
                          }}
                        >
                          {(item as any).badge}
                        </span>
                      )}
                      {isPage && (
                        <span
                          className="text-[10px] font-mono opacity-25 truncate max-w-[110px] hidden sm:block"
                          style={{ color: "rgba(140,160,220,0.6)" }}
                        >
                          {item.path}
                        </span>
                      )}
                      {isCompany && (
                        <span
                          className="text-[10px] font-mono opacity-40 truncate hidden sm:block"
                          style={{ color: "rgba(120,200,170,0.7)" }}
                        >
                          EIN {(item as any).ein}
                        </span>
                      )}
                      {showRemoveRecent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecent(item.path);
                          }}
                          data-testid={`button-remove-recent-${item.path.replace(/\//g, "-")}`}
                          aria-label={`Remove ${item.label} from recent`}
                          title="Remove from recent"
                          className="p-1 rounded transition-opacity opacity-0 group-hover:opacity-60 hover:!opacity-100"
                          style={{
                            color: "rgba(200,160,180,0.9)",
                            flexShrink: 0,
                          }}
                        >
                          <X size={13} strokeWidth={1.8} />
                        </button>
                      )}
                      {isPage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(item.path);
                          }}
                          data-testid={`button-pin-${item.path.replace(/\//g, "-")}`}
                          aria-label={isPinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                          title={isPinned ? "Unpin" : "Pin to top"}
                          className={`p-1 rounded transition-opacity ${
                            isPinned ? "opacity-90" : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                          }`}
                          style={{
                            color: isPinned ? "rgba(255,210,90,0.95)" : "rgba(180,200,255,0.8)",
                            flexShrink: 0,
                          }}
                        >
                          <Star
                            size={13}
                            strokeWidth={1.8}
                            fill={isPinned ? "rgba(255,210,90,0.95)" : "none"}
                          />
                        </button>
                      )}
                      {isActive && <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.5 }} />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 flex items-center gap-4"
          style={{
            borderTop: "1px solid rgba(100,130,255,0.10)",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          {[
            { keys: ["↑", "↓"], label: "navigate" },
            { keys: ["↵"], label: "go" },
            { keys: ["Esc"], label: "close" },
          ].map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              {keys.map((k) => (
                <kbd
                  key={k}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "rgba(140,160,220,0.5)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  {k}
                </kbd>
              ))}
              <span style={{ fontSize: 10, color: "rgba(130,150,200,0.4)" }}>{label}</span>
            </div>
          ))}
          <div className="flex-1" />
          <span style={{ fontSize: 10, color: "rgba(100,120,180,0.35)" }}>
            {totalPageCount} pages · {quickActions.length} actions
          </span>
        </div>
      </div>
    </div>
  );
}
