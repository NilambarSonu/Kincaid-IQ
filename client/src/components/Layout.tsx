import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import {
  LayoutDashboard,
  PieChart,
  Droplets,
  Briefcase,
  Building2,
  Users,
  FlaskConical,
  Handshake,
  BrainCircuit,
  ShieldCheck,
  Wrench,
  Menu,
  X,
  TrendingUp,
  ChevronRight,
  LogIn,
  LogOut,
  Banknote,
  Star,
  FolderLock,
  Leaf,
  Sigma,
  Calculator,
  BarChart2,
  CalendarDays,
  Heart,
  Landmark,
  Globe,
  Activity,
  MessageSquare,
  GitBranch,
  UserCheck,
  Home,
  BookUser,
  CalendarCheck,
  Shield,
  Pill,
  Crown,
  HeartHandshake,
  Gauge,
  FileSearch,
  Newspaper,
  Wallet,
  Map,
  GraduationCap,
  PiggyBank,
  ScrollText,
  BookText,
  PhoneCall,
  Sparkles,
  Target,
  Plane,
  CandlestickChart,
  Filter,
  TrendingUp as TrendingUpIcon,
  BarChart3,
  Wheat,
  Globe2,
  Building,
  Newspaper as NewspaperIcon,
  TrendingDown,
  LineChart,
  Layers,
  CreditCard,
  Zap,
  Database,
  Crosshair,
  LayoutGrid,
  Package2,
  ShieldAlert,
  FileDown,
  DollarSign,
  TableProperties,
  MapPin,
  Network,
  Upload,
  Tag,
  Mail,
  Link2,
  Cpu,
  Mic,
  Share2,
} from "lucide-react";
import { clientProfile } from "@/lib/mockData";
import { useAuth } from "@/hooks/use-auth";
import { MarketTicker } from "@/components/MarketTicker";
import { ExportButton } from "@/components/ExportButton";
import { FileVerifierLauncher } from "@/components/FileVerifierLauncher";
import { CommandPalette, recordRecentPage } from "@/components/CommandPalette";
import { navSections } from "@/lib/navConfig";

type NavItem = { path: string; label: string; icon: any };
type NavSection = { heading: string; items: NavItem[] };

function Sidebar({ onClose, onOpenPalette }: { onClose?: () => void; onOpenPalette?: () => void }) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  const displayName = user?.full_name || user?.username || clientProfile.name;
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="sidebar-metal-glass flex flex-col h-full">
      <div
        className="flex items-center justify-between px-5 h-16 flex-shrink-0"
        style={{
          background: "linear-gradient(180deg, rgba(40,46,80,0.6) 0%, rgba(18,20,50,0.4) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 10px rgba(155,28,46,0.35)" }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>KIQ</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-tight tracking-wide" style={{ color: "#ffffff", letterSpacing: "0.02em" }}>
              Kincaid IQ
            </div>
            <div className="text-[9px] tracking-widest uppercase" style={{ color: "#ffffff", letterSpacing: "0.18em" }}>
              Intelligence Platform
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onOpenPalette && (
            <button
              onClick={onOpenPalette}
              title="Command palette (⌘K)"
              data-testid="button-command-palette"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-opacity hover:opacity-80"
              style={{
                background: "rgba(79,125,255,0.10)",
                border: "1px solid rgba(79,125,255,0.22)",
                color: "rgba(130,160,255,0.65)",
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", fontFamily: "system-ui, sans-serif" }}>⌘K</span>
            </button>
          )}
          {onClose && (
            <button onClick={onClose} style={{ color: "rgba(130,160,200,0.5)" }} className="hover:opacity-80">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar pb-2">
        {/* Pinned quick-access tools */}
        <div className="pt-3 pb-1 space-y-1.5">
          {/* ── FILING INTELLIGENCE — top pinned ── */}
          <Link
            href="/sales-iq-intel?tab=filings"
            onClick={onClose}
            data-testid="nav-filing-intelligence-pinned"
            className={`sidebar-nav-item ${location.startsWith("/sales-iq-intel") ? "active" : ""}`}
            style={{
              color: "#9B1C2E",
              background: "linear-gradient(90deg, rgba(155,28,46,0.16) 0%, rgba(155,28,46,0.05) 100%)",
              border: "1px solid rgba(155,28,46,0.35)",
              boxShadow: "0 0 10px rgba(155,28,46,0.10)",
            }}
          >
            <Gauge size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Filing Intelligence</span>
            {location.startsWith("/sales-iq-intel") && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          {/* ── CFO WAR ROOM — top pinned ── */}
          <Link
            href="/"
            onClick={onClose}
            data-testid="nav-cfo-war-room-pinned"
            className={`sidebar-nav-item ${location === "/" ? "active" : ""}`}
            style={{
              color: "#F5A623",
              background: "linear-gradient(90deg, rgba(245,166,35,0.12) 0%, rgba(245,166,35,0.05) 100%)",
              border: "1px solid rgba(245,166,35,0.28)",
              boxShadow: "0 0 10px rgba(245,166,35,0.07)",
            }}
          >
            <Target size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">CFO War Room</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "#F5A623",
              background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>CFO</span>
          </Link>

          {/* ── HIOS — Healthcare Intelligence OS — top pinned ── */}
          <Link
            href="/hios"
            onClick={onClose}
            data-testid="nav-hios-pinned"
            className={`sidebar-nav-item ${location === "/hios" ? "active" : ""}`}
            style={{
              color: "#00D4FF",
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.22)",
            }}
          >
            <Activity size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">HIOS — Intelligence OS</span>
            {location === "/hios" && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          {/* ── OPERATING SYSTEMS — overview hub ── */}
          <Link
            href="/operating-systems"
            onClick={onClose}
            data-testid="nav-operating-systems"
            className={`sidebar-nav-item ${location.startsWith("/operating-systems") ? "active" : ""}`}
            style={location.startsWith("/operating-systems") ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Layers size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Operating Systems</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(180,210,255,0.75)",
              background: "rgba(100,150,255,0.1)", border: "1px solid rgba(100,150,255,0.22)",
              borderRadius: 3, padding: "1px 5px",
            }}>4</span>
          </Link>

          {/* ── CLAIMS RECOVERY IQ — top pinned ── */}
          <Link
            href="/claims-recovery"
            onClick={onClose}
            data-testid="nav-claims-recovery-pinned"
            className={`sidebar-nav-item ${location === "/claims-recovery" ? "active" : ""}`}
            style={{
              color: "#FF6B1A",
              background: "rgba(255,107,26,0.08)",
              border: "1px solid rgba(255,107,26,0.22)",
            }}
          >
            <DollarSign size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Claims Recovery IQ™</span>
            {location === "/claims-recovery" && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          {/* ── COMMAND CENTER ── */}
          <Link
            href="/dashboard"
            onClick={onClose}
            data-testid="nav-command-center-pinned"
            className={`sidebar-nav-item ${location === "/dashboard" ? "active" : ""}`}
            style={{
              color: "rgba(180,210,255,0.75)",
              background: "rgba(100,150,255,0.06)",
              border: "1px solid rgba(100,150,255,0.16)",
            }}
          >
            <LayoutDashboard size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Command Center</span>
            {location === "/dashboard" && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          {/* ── BROKER IQ CONSOLE — pinned + highlighted ── */}
          <Link
            href="/saas/broker"
            onClick={onClose}
            data-testid="nav-broker-iq-console-pinned"
            className={`sidebar-nav-item ${location === "/saas/broker" ? "active" : ""}`}
            style={{
              color: "#FFB800",
              background: "linear-gradient(90deg, rgba(255,184,0,0.12) 0%, rgba(255,184,0,0.05) 100%)",
              border: "1px solid rgba(255,184,0,0.30)",
              boxShadow: "0 0 10px rgba(255,184,0,0.08)",
            }}
          >
            <Building2 size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Sales IQ Console</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "#FFB800",
              background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>PIN</span>
          </Link>
          {/* ── ACCOUNT INTELLIGENCE HUB ── */}
          <Link
            href="/account-intel"
            onClick={onClose}
            data-testid="nav-account-intel"
            className={`sidebar-nav-item ${location === "/account-intel" ? "active" : ""}`}
            style={location === "/account-intel" ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Database size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Account Intel Hub</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#10b981",
              background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 3, padding: "1px 5px",
            }}>9 API</span>
          </Link>

          {/* ── SALES IQ INTELLIGENCE — 50-state module ── */}
          <Link
            href="/sales-iq-intel"
            onClick={onClose}
            data-testid="nav-sales-iq-intel"
            className={`sidebar-nav-item ${location === "/sales-iq-intel" ? "active" : ""}`}
            style={location === "/sales-iq-intel" ? {} : {
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <Target size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Sales IQ Intelligence</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#9B1C2E",
              background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.3)",
              borderRadius: 3, padding: "1px 5px",
            }}>50ST</span>
          </Link>

          {/* ── SALES OS — Full AI Sales Intelligence Module ── */}
          <Link
            href="/sales-os"
            onClick={onClose}
            data-testid="nav-sales-os"
            className={`sidebar-nav-item ${location === "/sales-os" ? "active" : ""}`}
            style={{
              color: "#D4AF37",
              background: "rgba(212,175,55,0.06)",
              border: "1px solid rgba(212,175,55,0.18)",
            }}
          >
            <Zap size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Sales OS</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#D4AF37",
              background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.28)",
              borderRadius: 3, padding: "1px 5px",
            }}>NEW</span>
          </Link>

          <Link
            href="/shady-broker-index"
            onClick={onClose}
            data-testid="nav-shady-broker-index"
            className={`sidebar-nav-item ${location === "/shady-broker-index" ? "active" : ""}`}
            style={{
              color: "#FF4D6D",
              background: "rgba(255,77,109,0.07)",
              border: "1px solid rgba(255,77,109,0.22)",
            }}
          >
            <ShieldAlert size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Shady Broker Report</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#FF4D6D",
              background: "rgba(255,77,109,0.14)", border: "1px solid rgba(255,77,109,0.32)",
              borderRadius: 3, padding: "1px 5px",
            }}>0-100</span>
          </Link>

          <Link
            href="/rx-defense"
            onClick={onClose}
            data-testid="nav-rx-defense-pinned"
            className={`sidebar-nav-item ${location === "/rx-defense" ? "active" : ""}`}
            style={{
              color: "#10B981",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.22)",
            }}
          >
            <Pill size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Rx Defense IQ™</span>
            {location === "/rx-defense" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/rx-defense-pro"
            onClick={onClose}
            data-testid="nav-rx-defense-pro-pinned"
            className={`sidebar-nav-item ${location === "/rx-defense-pro" ? "active" : ""}`}
            style={{
              color: "#9B1C2E",
              background: "rgba(155,28,46,0.08)",
              border: "1px solid rgba(155,28,46,0.22)",
            }}
          >
            <Pill size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Rx Defense Pro™</span>
            {location === "/rx-defense-pro" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/rx-pbm"
            onClick={onClose}
            data-testid="nav-rx-pbm-pinned"
            className={`sidebar-nav-item ${location === "/rx-pbm" ? "active" : ""}`}
            style={{
              color: "#34D399",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.22)",
            }}
          >
            <Pill size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">RxPBM Intelligence</span>
            {location === "/rx-pbm" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/stop-loss"
            onClick={onClose}
            data-testid="nav-stop-loss-pinned"
            className={`sidebar-nav-item ${location === "/stop-loss" ? "active" : ""}`}
            style={{
              color: "#A855F7",
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.22)",
            }}
          >
            <Activity size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Stop-Loss IQ™</span>
            {location === "/stop-loss" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/network-iq"
            onClick={onClose}
            data-testid="nav-network-iq-pinned"
            className={`sidebar-nav-item ${location === "/network-iq" ? "active" : ""}`}
            style={{
              color: "#22D3EE",
              background: "rgba(34,211,238,0.08)",
              border: "1px solid rgba(34,211,238,0.22)",
            }}
          >
            <Network size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Network IQ™</span>
            {location === "/network-iq" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/fiduciary-iq"
            onClick={onClose}
            data-testid="nav-fiduciary-iq-pinned"
            className={`sidebar-nav-item ${location === "/fiduciary-iq" ? "active" : ""}`}
            style={{
              color: "#6366F1",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.22)",
            }}
          >
            <ShieldAlert size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Fiduciary IQ™</span>
            {location === "/fiduciary-iq" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          {/* ── RFP INTELLIGENCE OS ── */}
          <div style={{ margin: "8px 0 3px", paddingLeft: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(251,191,36,0.6)" }}>RFP Intelligence OS</span>
          </div>
          <Link
            href="/rfp-command-center"
            onClick={onClose}
            data-testid="nav-rfp-command-center"
            className={`sidebar-nav-item ${location === "/rfp-command-center" ? "active" : ""}`}
            style={{
              color: "#FFB800",
              background: location === "/rfp-command-center"
                ? "linear-gradient(90deg, rgba(255,184,0,0.16) 0%, rgba(255,184,0,0.06) 100%)"
                : "transparent",
              border: location === "/rfp-command-center" ? "1px solid rgba(255,184,0,0.35)" : "1px solid transparent",
            }}
          >
            <Target size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Command Center</span>
            {location === "/rfp-command-center" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/rfp-os"
            onClick={onClose}
            data-testid="nav-rfp-os"
            className={`sidebar-nav-item ${location.startsWith("/rfp-os") ? "active" : ""}`}
            style={{
              color: "#FBB724",
              background: "linear-gradient(90deg, rgba(251,183,36,0.12) 0%, rgba(251,183,36,0.05) 100%)",
              border: "1px solid rgba(251,183,36,0.30)",
              boxShadow: "0 0 10px rgba(251,183,36,0.07)",
            }}
          >
            <FileSearch size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">RFP Intelligence OS™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#FBB724",
              background: "rgba(251,183,36,0.15)", border: "1px solid rgba(251,183,36,0.30)",
              borderRadius: 3, padding: "1px 5px",
            }}>NEW</span>
          </Link>
          <Link
            href="/rfp-resource-allocator"
            onClick={onClose}
            data-testid="nav-rfp-resource-allocator"
            className={`sidebar-nav-item ${location === "/rfp-resource-allocator" ? "active" : ""}`}
            style={{
              color: "#a78bfa",
              background: location === "/rfp-resource-allocator"
                ? "linear-gradient(90deg, rgba(167,139,250,0.14) 0%, rgba(167,139,250,0.06) 100%)"
                : "transparent",
              border: location === "/rfp-resource-allocator" ? "1px solid rgba(167,139,250,0.30)" : "1px solid transparent",
            }}
          >
            <BarChart3 size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Resource Allocator</span>
            {location === "/rfp-resource-allocator" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/rfp-model-health"
            onClick={onClose}
            data-testid="nav-rfp-model-health"
            className={`sidebar-nav-item ${location === "/rfp-model-health" ? "active" : ""}`}
            style={{
              color: "#34d399",
              background: location === "/rfp-model-health"
                ? "linear-gradient(90deg, rgba(52,211,153,0.14) 0%, rgba(52,211,153,0.06) 100%)"
                : "transparent",
              border: location === "/rfp-model-health" ? "1px solid rgba(52,211,153,0.30)" : "1px solid transparent",
            }}
          >
            <Activity size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Model Health</span>
            {location === "/rfp-model-health" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/battlecards"
            onClick={onClose}
            data-testid="nav-battlecards"
            className={`sidebar-nav-item ${location === "/battlecards" ? "active" : ""}`}
            style={{
              color: "#FF4D6D",
              background: location === "/battlecards"
                ? "linear-gradient(90deg, rgba(255,77,109,0.14) 0%, rgba(255,77,109,0.06) 100%)"
                : "transparent",
              border: location === "/battlecards" ? "1px solid rgba(255,77,109,0.30)" : "1px solid transparent",
            }}
          >
            <Crosshair size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Battlecards</span>
            {location === "/battlecards" && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          <Link
            href="/5500-monitor"
            onClick={onClose}
            data-testid="nav-5500-monitor"
            className={`sidebar-nav-item ${location === "/5500-monitor" ? "active" : ""}`}
            style={location === "/5500-monitor" ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Activity size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">5500 Monitor</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "#FBB724",
              background: "rgba(251,183,36,0.12)", border: "1px solid rgba(251,183,36,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>LIVE</span>
          </Link>

          <Link
            href="/digest-preferences"
            onClick={onClose}
            data-testid="nav-digest-preferences"
            className={`sidebar-nav-item ${location === "/digest-preferences" ? "active" : ""}`}
            style={location === "/digest-preferences" ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Mail size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Intelligence Digest</span>
          </Link>

          {/* ── DATA INTELLIGENCE GROUP ── */}
          <div style={{ margin: "6px 0 3px", paddingLeft: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(79,125,255,0.5)" }}>Data Intelligence</span>
          </div>
          <Link
            href="/company-360"
            onClick={onClose}
            data-testid="nav-company-360"
            className={`sidebar-nav-item ${location.startsWith("/company-360") ? "active" : ""}`}
            style={location.startsWith("/company-360") ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Building2 size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Company 360</span>
            {location.startsWith("/company-360") && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/plan-metrics"
            onClick={onClose}
            data-testid="nav-plan-metrics"
            className={`sidebar-nav-item ${location === "/plan-metrics" ? "active" : ""}`}
            style={location === "/plan-metrics" ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Layers size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Plan Metrics IQ</span>
            {location === "/plan-metrics" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/gov-stats"
            onClick={onClose}
            data-testid="nav-gov-stats-hub"
            className={`sidebar-nav-item ${location === "/gov-stats" ? "active" : ""}`}
            style={{
              color: "#00D4FF",
              background: "linear-gradient(90deg, rgba(0,212,255,0.10) 0%, rgba(0,212,255,0.04) 100%)",
              border: "1px solid rgba(0,212,255,0.22)",
            }}
          >
            <Globe size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Gov Stats Hub</span>
            {location === "/gov-stats" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/pricing"
            onClick={onClose}
            data-testid="nav-pricing-pinned"
            className={`sidebar-nav-item ${location === "/pricing" ? "active" : ""}`}
            style={{
              color: "#22d3ee",
              background: "linear-gradient(90deg, rgba(34,211,238,0.10) 0%, rgba(34,211,238,0.04) 100%)",
              border: "1px solid rgba(34,211,238,0.22)",
            }}
          >
            <Tag size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">À-la-carte Pricing</span>
            {location === "/pricing" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/commit-engine"
            onClick={onClose}
            data-testid="nav-commit-engine-pinned"
            className={`sidebar-nav-item ${location === "/commit-engine" ? "active" : ""}`}
            style={{
              color: "#4f7dff",
              background: "linear-gradient(90deg, rgba(79,125,255,0.14) 0%, rgba(79,125,255,0.06) 100%)",
              border: "1px solid rgba(79,125,255,0.35)",
              boxShadow: "0 0 10px rgba(79,125,255,0.08)",
            }}
          >
            <Zap size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">KincaidCommit Engine™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#4f7dff", background: "rgba(79,125,255,0.12)", border: "1px solid rgba(79,125,255,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>PIN</span>
          </Link>
          <Link
            href="/federal-intelligence"
            onClick={onClose}
            data-testid="nav-federal-intel-pinned"
            className={`sidebar-nav-item ${location === "/federal-intelligence" ? "active" : ""}`}
            style={{
              color: "#f43f5e",
              background: "linear-gradient(90deg, rgba(244,63,94,0.12) 0%, rgba(244,63,94,0.04) 100%)",
              border: "1px solid rgba(244,63,94,0.28)",
              boxShadow: "0 0 10px rgba(244,63,94,0.06)",
            }}
          >
            <Shield size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Federal Risk Intelligence™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#f43f5e", background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>PIN</span>
          </Link>
          <Link
            href="/drill-engine"
            onClick={onClose}
            data-testid="nav-drill-engine-pinned"
            className={`sidebar-nav-item ${location === "/drill-engine" ? "active" : ""}`}
            style={{
              color: "#9B1C2E",
              background: "linear-gradient(90deg, rgba(155,28,46,0.14) 0%, rgba(155,28,46,0.06) 100%)",
              border: "1px solid rgba(155,28,46,0.35)",
              boxShadow: "0 0 10px rgba(155,28,46,0.08)",
            }}
          >
            <Cpu size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">KIQ Drill Engine™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#9B1C2E", background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.28)",
              borderRadius: 3, padding: "1px 5px",
            }}>KIQ</span>
          </Link>
          <Link
            href="/contact-intel"
            onClick={onClose}
            data-testid="nav-contact-intel-pinned"
            className={`sidebar-nav-item ${location === "/contact-intel" ? "active" : ""}`}
            style={{
              color: "#34d399",
              background: "linear-gradient(90deg, rgba(52,211,153,0.12) 0%, rgba(52,211,153,0.05) 100%)",
              border: "1px solid rgba(52,211,153,0.28)",
              boxShadow: "0 0 10px rgba(52,211,153,0.06)",
            }}
          >
            <Mail size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Contact Intelligence™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#34d399", background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>NEW</span>
          </Link>
          <Link
            href="/contacts-db"
            onClick={onClose}
            data-testid="nav-contacts-db-pinned"
            className={`sidebar-nav-item ${location === "/contacts-db" ? "active" : ""}`}
            style={{
              color: "#a78bfa",
              background: "linear-gradient(90deg, rgba(167,139,250,0.1) 0%, rgba(167,139,250,0.04) 100%)",
              border: "1px solid rgba(167,139,250,0.22)",
            }}
          >
            <Database size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Contacts Database</span>
          </Link>
          <Link
            href="/crm-sync"
            onClick={onClose}
            data-testid="nav-crm-sync-pinned"
            className={`sidebar-nav-item ${location === "/crm-sync" ? "active" : ""}`}
            style={{
              color: "#fb923c",
              background: "linear-gradient(90deg, rgba(251,146,60,0.1) 0%, rgba(251,146,60,0.04) 100%)",
              border: "1px solid rgba(251,146,60,0.22)",
            }}
          >
            <Link2 size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">CRM Sync</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#fb923c", background: "rgba(251,146,60,0.10)", border: "1px solid rgba(251,146,60,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>NEW</span>
          </Link>
          <Link
            href="/edgar-intelligence"
            onClick={onClose}
            data-testid="nav-edgar-intelligence-pinned"
            className={`sidebar-nav-item ${location === "/edgar-intelligence" ? "active" : ""}`}
            style={{
              color: "#60a5fa",
              background: "linear-gradient(90deg, rgba(96,165,250,0.1) 0%, rgba(96,165,250,0.04) 100%)",
              border: "1px solid rgba(96,165,250,0.22)",
            }}
          >
            <FileSearch size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">EDGAR Language Engine™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#60a5fa", background: "rgba(96,165,250,0.10)", border: "1px solid rgba(96,165,250,0.25)",
              borderRadius: 3, padding: "1px 5px",
            }}>NEW</span>
          </Link>
          <Link
            href="/ma-diligence"
            onClick={onClose}
            data-testid="nav-ma-diligence-pinned"
            className={`sidebar-nav-item ${location === "/ma-diligence" ? "active" : ""}`}
            style={{
              color: "#9B1C2E",
              background: "linear-gradient(90deg, rgba(155,28,46,0.14) 0%, rgba(155,28,46,0.06) 100%)",
              border: "1px solid rgba(155,28,46,0.40)",
              boxShadow: "0 0 10px rgba(155,28,46,0.10)",
            }}
          >
            <ShieldAlert size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">M&A Due Diligence™</span>
            <span style={{
              fontSize: 7, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#9B1C2E", background: "rgba(155,28,46,0.14)", border: "1px solid rgba(155,28,46,0.30)",
              borderRadius: 3, padding: "1px 5px",
            }}>PIN</span>
          </Link>
          <Link
            href="/cross-intel"
            onClick={onClose}
            data-testid="nav-cross-intel-pinned"
            className={`sidebar-nav-item ${location === "/cross-intel" ? "active" : ""}`}
            style={{
              color: "#00D4FF",
              background: "rgba(0,212,255,0.07)",
              border: "1px solid rgba(0,212,255,0.20)",
            }}
          >
            <Database size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">DOL × EDGAR Intelligence</span>
            {location === "/cross-intel" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/actuarial-engine"
            onClick={onClose}
            data-testid="nav-actuarial-engine-pinned"
            className={`sidebar-nav-item ${location === "/actuarial-engine" ? "active" : ""}`}
            style={{
              color: "#A855F7",
              background: "rgba(168,85,247,0.07)",
              border: "1px solid rgba(168,85,247,0.20)",
            }}
          >
            <Calculator size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Actuarial Engine IQ™</span>
            {location === "/actuarial-engine" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          {/* ── INDIANA 5500 UPLOAD — sub-item under Actuarial Engine ── */}
          <Link
            href="/indiana-5500-upload"
            onClick={onClose}
            data-testid="nav-indiana-5500-upload-pinned"
            className={`sidebar-nav-item ${location === "/indiana-5500-upload" ? "active" : ""}`}
            style={{
              color: "#10B981",
              background: location === "/indiana-5500-upload"
                ? "linear-gradient(90deg, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0.05) 100%)"
                : "rgba(16,185,129,0.05)",
              border: "1px solid rgba(16,185,129,0.22)",
              marginLeft: 14,
              paddingLeft: 10,
            }}
          >
            <Upload size={13} strokeWidth={1.8} />
            <span className="flex-1 text-sm">Tennessee 5500 Upload</span>
            {location === "/indiana-5500-upload" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          {/* ── CLIENT INTEGRATIONS GROUP ── */}
          <div style={{ margin: "8px 0 3px", paddingLeft: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(34,197,94,0.5)" }}>Client Integrations</span>
          </div>
          <Link
            href="/integrations"
            onClick={onClose}
            data-testid="nav-integrations-hub"
            className={`sidebar-nav-item ${location === "/integrations" ? "active" : ""}`}
            style={{ color: "#4f7dff", background: "rgba(79,125,255,0.10)", border: "1px solid rgba(79,125,255,0.28)", marginBottom: 4 }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#4f7dff" strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            </svg>
            <span className="flex-1 text-sm font-semibold">Integrations Hub</span>
            <span style={{ fontSize: 7, fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.28)", borderRadius: 3, padding: "1px 6px" }}>19</span>
          </Link>
          <Link
            href="/integrations/m365"
            onClick={onClose}
            data-testid="nav-m365-pinned"
            className={`sidebar-nav-item ${location === "/integrations/m365" ? "active" : ""}`}
            style={{ color: "#0078d4", background: "rgba(0,120,212,0.08)", border: "1px solid rgba(0,120,212,0.22)" }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" style={{ flexShrink: 0 }}>
              <rect x="2" y="2" width="9" height="9" fill="#f25022"/>
              <rect x="13" y="2" width="9" height="9" fill="#7fba00"/>
              <rect x="2" y="13" width="9" height="9" fill="#00a4ef"/>
              <rect x="13" y="13" width="9" height="9" fill="#ffb900"/>
            </svg>
            <span className="flex-1 text-sm font-semibold">Microsoft 365</span>
            <span style={{ fontSize: 7, fontWeight: 700, color: "#0078d4", background: "rgba(0,120,212,0.12)", border: "1px solid rgba(0,120,212,0.2)", borderRadius: 3, padding: "1px 5px" }}>DEMO</span>
          </Link>
          <Link
            href="/integrations/quickbooks"
            onClick={onClose}
            data-testid="nav-quickbooks-pinned"
            className={`sidebar-nav-item ${location === "/integrations/quickbooks" ? "active" : ""}`}
            style={{ color: "#2CA01C", background: "rgba(44,160,28,0.08)", border: "1px solid rgba(44,160,28,0.22)" }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="11" fill="#2CA01C"/>
              <text x="12" y="16" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">QB</text>
            </svg>
            <span className="flex-1 text-sm font-semibold">QuickBooks Online</span>
            <span style={{ fontSize: 7, fontWeight: 700, color: "#2CA01C", background: "rgba(44,160,28,0.12)", border: "1px solid rgba(44,160,28,0.2)", borderRadius: 3, padding: "1px 5px" }}>DEMO</span>
          </Link>
          <Link
            href="/glp1-stress-test"
            onClick={onClose}
            data-testid="nav-glp1-pinned"
            className={`sidebar-nav-item ${location === "/glp1-stress-test" ? "active" : ""}`}
            style={{ color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}
          >
            <Activity size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">GLP-1 Stress Test</span>
            {location === "/glp1-stress-test" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/sbi-forensic"
            onClick={onClose}
            data-testid="nav-sbi-pinned"
            className={`sidebar-nav-item ${location === "/sbi-forensic" ? "active" : ""}`}
            style={{ color: "#FFB800", background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.22)" }}
          >
            <Target size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">SBI Forensic Composite</span>
            {location === "/sbi-forensic" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/cei-engine"
            onClick={onClose}
            data-testid="nav-cei-pinned"
            className={`sidebar-nav-item ${location === "/cei-engine" ? "active" : ""}`}
            style={{ color: "#4f7dff", background: "rgba(79,125,255,0.08)", border: "1px solid rgba(79,125,255,0.22)" }}
          >
            <Crosshair size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">CEI Confidence Engine</span>
            {location === "/cei-engine" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/capital-velocity"
            onClick={onClose}
            data-testid="nav-cvi-pinned"
            className={`sidebar-nav-item ${location === "/capital-velocity" ? "active" : ""}`}
            style={{ color: "#FF6B1A", background: "rgba(255,107,26,0.08)", border: "1px solid rgba(255,107,26,0.22)" }}
          >
            <TrendingUp size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Capital Velocity Index</span>
            {location === "/capital-velocity" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/lcnc-security"
            onClick={onClose}
            data-testid="nav-lcnc-pinned"
            className={`sidebar-nav-item ${location === "/lcnc-security" ? "active" : ""}`}
            style={{ color: "#A855F7", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.22)" }}
          >
            <Shield size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">LCNC / AI Security</span>
            {location === "/lcnc-security" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/god-mode"
            onClick={onClose}
            data-testid="nav-god-mode-pinned"
            className={`sidebar-nav-item ${location === "/god-mode" ? "active" : ""}`}
            style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.22)" }}
          >
            <Zap size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">God Mode ⚡</span>
            {location === "/god-mode" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
          <Link
            href="/stewardship"
            onClick={onClose}
            data-testid="nav-stewardship-pinned"
            className={`sidebar-nav-item ${location === "/stewardship" ? "active" : ""}`}
            style={{
              color: "#FFB800",
              background: "rgba(255,184,0,0.08)",
              border: "1px solid rgba(255,184,0,0.22)",
            }}
          >
            <ScrollText size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Stewardship Reports</span>
            {location === "/stewardship" && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          {/* ── EMPLOYER HEALTH IQ — bottom pinned ── */}
          <Link
            href="/employer-health-score"
            onClick={onClose}
            data-testid="nav-employer-health-iq-pinned"
            className={`sidebar-nav-item ${location === "/employer-health-score" ? "active" : ""}`}
            style={{
              color: "#10B981",
              background: "linear-gradient(90deg, rgba(16,185,129,0.14) 0%, rgba(16,185,129,0.05) 100%)",
              border: "1px solid rgba(16,185,129,0.30)",
              boxShadow: "0 0 10px rgba(16,185,129,0.08)",
            }}
          >
            <HeartHandshake size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Employer Health IQ</span>
            {location === "/employer-health-score" && <ChevronRight size={12} className="opacity-40" />}
          </Link>

          {/* ── SHARED LINKS — manage & revoke ── */}
          <Link
            href="/share-links"
            onClick={onClose}
            data-testid="nav-share-links"
            className={`sidebar-nav-item ${location === "/share-links" ? "active" : ""}`}
            style={location === "/share-links" ? {} : { color: "rgba(255,255,255,0.6)" }}
          >
            <Share2 size={15} strokeWidth={1.8} />
            <span className="flex-1 text-sm font-semibold">Shared Links</span>
            {location === "/share-links" && <ChevronRight size={12} className="opacity-40" />}
          </Link>
        </div>

      </nav>

      <div
        className="mx-4 my-2"
        style={{
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 20%, rgba(200,215,255,0.12) 50%, rgba(255,255,255,0.06) 80%, transparent 100%)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
        }}
      />

      <div
        className="px-4 py-3 flex-shrink-0"
        style={{
          background: "linear-gradient(0deg, rgba(8,10,28,0.9) 0%, rgba(14,18,42,0.5) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: "linear-gradient(145deg, rgba(0,80,160,0.4) 0%, rgba(0,40,100,0.6) 100%)",
                border: "1px solid rgba(0,160,255,0.2)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px rgba(0,140,255,0.1)",
                color: "hsl(207 100% 70%)",
              }}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={displayName} className="w-8 h-8 rounded-xl object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate text-white">{displayName}</div>
              <div className="text-[10px] truncate" style={{ color: "rgba(0, 200, 255, 0.45)" }}>
                {user.oauth_provider ? `via ${user.oauth_provider}` : "Authenticated"}
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="flex-shrink-0 p-1.5 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: "rgba(130,160,200,0.4)" }}
              title="Sign out"
              data-testid="button-logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 gold-shimmer-text"
              style={{
                background: "linear-gradient(145deg, rgba(80,60,5,0.7) 0%, rgba(50,38,3,0.85) 100%)",
                border: "1px solid rgba(255,195,0,0.22)",
                boxShadow: "inset 0 1px 0 rgba(255,225,80,0.14), 0 0 8px rgba(255,185,0,0.08)",
              }}
            >
              {clientProfile.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate text-white">{clientProfile.name}</div>
              <div className="text-[10px] truncate" style={{ color: "rgba(130,160,200,0.4)" }}>
                {clientProfile.location}
              </div>
            </div>
            <Link
              href="/login"
              className="flex-shrink-0 p-1.5 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: "rgba(0,180,255,0.5)" }}
              title="Sign in"
              data-testid="link-signin"
            >
              <LogIn size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function Layout({ children, fullBleed = false }: { children: ReactNode; fullBleed?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    recordRecentPage(location);
  }, [location]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div className="hidden lg:flex flex-col w-60 flex-shrink-0 no-print">
        <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative w-60 flex-shrink-0">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div
          className="lg:hidden flex items-center justify-between px-4 h-14 flex-shrink-0"
          style={{
            background: "linear-gradient(180deg, rgba(22,26,56,0.97) 0%, rgba(8,10,28,0.99) 100%)",
            backdropFilter: "blur(32px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg"
            style={{ color: "rgba(130,170,220,0.7)" }}
            data-testid="button-mobile-menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div style={{ width: 24, height: 24, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#fff" }}>KIQ</span>
            </div>
            <span
              className="font-bold text-sm text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Kincaid IQ
            </span>
          </div>
          <div className="no-print"><ViewSwitcher /></div>
        </div>

        <div
          className="hidden lg:flex items-center justify-end px-6 h-12 flex-shrink-0 no-print"
          style={{
            background: "linear-gradient(180deg, rgba(14,18,42,0.85) 0%, rgba(8,10,28,0.85) 100%)",
            backdropFilter: "blur(24px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
          }}
        >
          <ViewSwitcher />
        </div>

        <div className="no-print"><MarketTicker /></div>

        <main className="flex-1 overflow-hidden custom-scrollbar">
          {fullBleed ? children : (
            <div className="h-full overflow-y-auto custom-scrollbar">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            </div>
          )}
        </main>
      </div>

      <div className="no-print">
        <FileVerifierLauncher />
        <ExportButton />
      </div>
    </div>
  );
}
