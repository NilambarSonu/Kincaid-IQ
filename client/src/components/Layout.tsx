import { ReactNode, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Bell,
  ChevronRight,
  CircleCheck,
  Command,
  LogIn,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { CommandPalette, recordRecentPage } from "@/components/CommandPalette";
import { ExportButton } from "@/components/ExportButton";
import { FileVerifierLauncher } from "@/components/FileVerifierLauncher";
import { MarketTicker } from "@/components/MarketTicker";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { useAuth } from "@/hooks/use-auth";
import { clientProfile } from "@/lib/mockData";
import { navSections } from "@/lib/navConfig";

type AppShellProps = {
  children: ReactNode;
  fullBleed?: boolean;
};

function isActivePath(location: string, path: string) {
  if (path === "/") return location === "/";
  return location === path || location.startsWith(`${path}/`);
}

function getPageLabel(location: string) {
  const match = navSections
    .flatMap((section) => section.items.map((item) => ({ ...item, section: section.heading })))
    .find((item) => isActivePath(location, item.path));

  return {
    title: match?.label ?? "Kincaid Health",
    section: match?.section ?? "Enterprise Intelligence",
  };
}

/* ─── Brand Mark ──────────────────────────────────────────────────────────── */
function KincaidMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="kiq-brand-mark" aria-hidden="true" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
        <img src="/icon.png" alt="Kincaid Health Logo" className="w-full h-full object-contain drop-shadow-sm" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <div
            className="truncate font-semibold leading-none"
            style={{ fontSize: 14, letterSpacing: "-0.02em", color: "var(--kiq-ink)" }}
          >
            Kincaid Health
          </div>
          <div
            className="mt-[3px] truncate font-semibold uppercase"
            style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--kiq-subtle)" }}
          >
            Enterprise Health OS
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── User Dock ───────────────────────────────────────────────────────────── */
function UserDock({ compact = false }: { compact?: boolean }) {
  const { user, isAuthenticated, logout } = useAuth();
  const displayName = user?.full_name || user?.username || clientProfile.name;
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/auth"
        className="kiq-user-dock"
        title="Sign in"
        data-testid="link-signin"
      >
        <div className="kiq-avatar">{clientProfile.initials}</div>
        {!compact && (
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-semibold"
              style={{ fontSize: 13, letterSpacing: "-0.01em", color: "var(--kiq-ink)" }}
            >
              {clientProfile.name}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 11, color: "var(--kiq-muted)" }}
            >
              Sign in required
            </div>
          </div>
        )}
        {!compact && <LogIn size={14} style={{ color: "var(--kiq-subtle)" }} />}
      </Link>
    );
  }

  return (
    <div className="kiq-user-dock">
      <div className="kiq-avatar">
        {user.avatar_url ? <img src={user.avatar_url} alt={displayName} /> : initials}
      </div>
      {!compact && (
        <>
          <div className="min-w-0 flex-1">
            <div
              className="truncate font-semibold"
              style={{ fontSize: 13, letterSpacing: "-0.01em", color: "var(--kiq-ink)" }}
            >
              {displayName}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 11, color: "var(--kiq-muted)" }}
            >
              {user.oauth_provider ? `via ${user.oauth_provider}` : "Authenticated"}
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="kiq-icon-button"
            style={{ minWidth: 30, minHeight: 30 }}
            title="Sign out"
            data-testid="button-logout"
          >
            <LogOut size={14} />
          </button>
        </>
      )}
    </div>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({
  compact,
  onClose,
  onOpenPalette,
  onToggleCompact,
}: {
  compact: boolean;
  onClose?: () => void;
  onOpenPalette: () => void;
  onToggleCompact?: () => void;
}) {
  const [location] = useLocation();
  const [width, setWidth] = useState(280);
  const isResizing = useRef(false);
  const navScrollRef = useRef<HTMLElement | null>(null);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    isResizing.current = true;
    
    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(600, mouseMoveEvent.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  const prioritySections = useMemo(() => navSections, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const savedScroll = Number(window.sessionStorage.getItem("kiq:sidebar-scroll") || "0");
    if (savedScroll > 0) el.scrollTop = savedScroll;
  }, []);

  const rememberNavScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    window.sessionStorage.setItem("kiq:sidebar-scroll", String(event.currentTarget.scrollTop));
  }, []);

  return (
    <aside 
      className={`kiq-sidebar ${compact ? "is-compact" : ""}`}
      style={!compact ? { width: `${width}px`, transition: isResizing.current ? "none" : undefined } : undefined}
    >
      {!compact && (
        <div
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-[var(--kiq-primary)] hover:opacity-50 opacity-0 transition-opacity"
          style={{ transform: "translateX(50%)" }}
        />
      )}
      {/* Header */}
      <div className="kiq-sidebar-header">
        {compact && onToggleCompact ? (
          <button
            className="kiq-brand-button"
            onClick={onToggleCompact}
            title="Open navigation"
            data-testid="button-open-sidebar-from-logo"
          >
            <KincaidMark compact />
            <PanelLeftOpen className="kiq-brand-open-cue" size={14} />
          </button>
        ) : (
          <KincaidMark compact={compact} />
        )}
        <div className="flex items-center gap-1">
          {onToggleCompact && !compact && (
            <button
              className="kiq-icon-button hidden lg:inline-flex"
              onClick={onToggleCompact}
              title="Collapse navigation"
              data-testid="button-collapse-sidebar"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
          {onClose && (
            <button
              className="kiq-icon-button lg:hidden"
              onClick={onClose}
              title="Close navigation"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Command Palette Trigger */}
      <div style={{ padding: "0 10px 10px" }}>
        <button
          onClick={onOpenPalette}
          className="kiq-command-trigger"
          title="Command palette (Ctrl K)"
          data-testid="button-command-palette"
        >
          <Search size={13} style={{ color: "var(--kiq-subtle)", flexShrink: 0 }} />
          {!compact && (
            <span
              className="min-w-0 flex-1 text-left truncate"
              style={{ fontSize: 12.5, color: "var(--kiq-muted)" }}
            >
              Search pages, reports, engines
            </span>
          )}
          {!compact && <kbd>Ctrl K</kbd>}
        </button>
      </div>

      {/* Navigation */}
      <nav
        ref={navScrollRef}
        onScroll={rememberNavScroll}
        className="kiq-nav-scroll custom-scrollbar"
        aria-label="Primary navigation"
      >
        {prioritySections.map((section) => (
          <section key={section.heading} className="kiq-nav-section">
            {!compact && (
              <div className="kiq-nav-heading">{section.heading}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(location, item.path);
                return (
                  <Link
                    key={`${section.heading}-${item.path}-${item.label}`}
                    href={item.path}
                    onClick={onClose}
                    title={compact ? item.label : undefined}
                    data-testid={`nav-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className={`sidebar-nav-item ${active ? "active" : ""}`}
                  >
                    <Icon
                      size={15}
                      strokeWidth={active ? 2 : 1.75}
                      style={{ flexShrink: 0 }}
                      className="sidebar-nav-icon"
                    />
                    {!compact && (
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                    )}
                    {!compact && item.badge && (
                      <span className="kiq-nav-badge">{item.badge}</span>
                    )}
                    {!compact && active && (
                      <ChevronRight
                        size={12}
                        style={{ opacity: 0.4, flexShrink: 0 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {/* Footer */}
      <div className="kiq-sidebar-footer">
        <div
          className="kiq-trust-strip"
          title="Verified evidence controls"
        >
          <ShieldCheck size={13} />
          {!compact && <span>Verified evidence controls</span>}
        </div>
        <UserDock compact={compact} />
      </div>
    </aside>
  );
}

/* ─── Layout Shell ────────────────────────────────────────────────────────── */
export function Layout({ children, fullBleed = false }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [location] = useLocation();
  const page = getPageLabel(location);

  useEffect(() => {
    recordRecentPage(location);
  }, [location]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="kiq-shell">
      {/* Ambient gradient mesh */}
      <div className="kiq-shell-ambient" aria-hidden="true" />

      {/* Command Palette */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block no-print">
        <Sidebar
          compact={sidebarCompact}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleCompact={() => setSidebarCompact((c) => !c)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <button
            className="fixed inset-0"
            style={{ background: "rgba(13,37,61,0.36)", backdropFilter: "blur(10px)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation overlay"
          />
          {/* Drawer */}
          <div
            className="relative"
            style={{
              width: "min(88vw, 300px)",
              boxShadow: "24px 0 64px rgba(0,0,0,0.18)",
              animation: "kincaid-slide-right 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            <Sidebar
              compact={false}
              onClose={() => setMobileOpen(false)}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Main workspace */}
      <div className="kiq-workspace">
        {/* ── Topbar ── */}
        <header className="kiq-topbar no-print">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="kiq-icon-button lg:hidden"
            data-testid="button-mobile-menu"
            title="Open navigation"
          >
            <Menu size={18} />
          </button>

          {/* Page title & context */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2 mb-[3px]">
              <span className="kiq-context-pill">
                <Sparkles size={11} />
                <span className="truncate">{page.section}</span>
              </span>
              <span className="kiq-context-pill is-muted hidden sm:inline-flex">
                <CircleCheck size={11} />
                Evidence-grade
              </span>
            </div>
            <h1
              className="truncate"
              style={{
                fontSize: 16,
                fontWeight: 600,
                lineHeight: 1.2,
                letterSpacing: "-0.025em",
                color: "var(--kiq-ink)",
                margin: 0,
              }}
            >
              {page.title}
            </h1>
          </div>

          {/* System status — desktop only */}
          <div className="kiq-system-status hidden xl:flex" aria-label="System status">
            <div>
              <span>Latency</span>
              <strong>42ms</strong>
            </div>
            <div>
              <span>Controls</span>
              <strong>Live</strong>
            </div>
          </div>

          {/* Command search */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="kiq-topbar-search hidden md:flex"
            data-testid="button-topbar-search"
          >
            <Command size={13} style={{ color: "var(--kiq-subtle)" }} />
            <span style={{ fontSize: 12.5, color: "var(--kiq-muted)" }}>Command</span>
            <kbd style={{
              border: "1px solid rgba(var(--kiq-shadow-blue),0.1)",
              borderRadius: 5,
              background: "rgba(246,249,252,0.9)",
              padding: "2px 6px",
              color: "var(--kiq-subtle)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: 1.4,
              marginLeft: 2,
            }}>
              Ctrl K
            </kbd>
          </button>

          {/* Notifications */}
          <button
            className="kiq-icon-button hidden sm:inline-flex"
            title="Operational alerts"
          >
            <Bell size={15} />
          </button>

          {/* Health chip */}
          <div className="kiq-health-chip hidden lg:flex">
            <Activity size={13} />
            <span>Healthy</span>
          </div>

          <ViewSwitcher />
        </header>

        {/* Market ticker */}
        <div className="no-print">
          <MarketTicker />
        </div>

        {/* Page content */}
        <main className="kiq-main custom-scrollbar">
          {fullBleed ? (
            children
          ) : (
            <div className="kiq-page-frame">
              <div className="kiq-page-content">{children}</div>
            </div>
          )}
        </main>
      </div>

      {/* Floating tools */}
      <div className="no-print">
        <FileVerifierLauncher />
        <ExportButton />
      </div>
    </div>
  );
}
