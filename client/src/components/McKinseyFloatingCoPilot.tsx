import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Send, BrainCircuit, X, Maximize2, Minimize2,
  ChevronDown, RotateCcw, Sparkles, Copy, Check, Loader2,
  GitBranch, LayoutGrid, Target, Shield, BarChart3, TrendingUp,
  Link, Crosshair, Navigation, Database, Eye, Radio, AlertTriangle, Zap,
} from "lucide-react";

const BG = "#07091c";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.09)";
const ACCENT = "#4f7dff";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  GitBranch, LayoutGrid, Target, Shield, BarChart3, TrendingUp, Link, Crosshair,
};

// ─── Full route map: path → { name, description } ───────────────────────────
const ROUTE_MAP: Record<string, { name: string; desc: string }> = {
  "/":                         { name: "Executive War Room",       desc: "Top-level executive dashboard with live KPI tiles, market data and alerts" },
  "/war-room":                 { name: "Executive War Room",       desc: "Top-level executive dashboard with live KPI tiles, market data and alerts" },
  "/portfolio":                { name: "Portfolio",                desc: "Full asset-class portfolio view with allocation charts" },
  "/liquidity":                { name: "Liquidity Manager",        desc: "Cash runway, liquidity buckets and near-term obligation tracking" },
  "/private-investments":      { name: "Private Investments",      desc: "PE/VC fund positions, IRR, TVPI and cash-flow waterfall" },
  "/real-estate":              { name: "Real Estate",              desc: "Property holdings, NOI, cap rates and valuation roll-up" },
  "/family-office":            { name: "Family Office",            desc: "Multi-entity family wealth summary and governance overview" },
  "/entity-map":               { name: "Entity Map",               desc: "Visual legal entity and ownership structure diagram" },
  "/beneficiaries":            { name: "Beneficiaries",            desc: "Beneficiary designations and legacy planning" },
  "/lifestyle":                { name: "Lifestyle Assets",         desc: "Non-financial assets: art, aircraft, yachts, collectibles" },
  "/staff-directory":          { name: "Staff Directory",          desc: "Family office staff contacts and role assignments" },
  "/key-dates":                { name: "Key Dates",                desc: "Critical filing deadlines, renewals and compliance dates" },
  "/insurance":                { name: "Insurance",                desc: "Policy inventory, coverage gaps and premium schedule" },
  "/succession":               { name: "Succession Planning",      desc: "Multi-generational succession roadmap and governance" },
  "/foundation":               { name: "Foundation",               desc: "Charitable foundation activity, grants and endowment" },
  "/scenarios":                { name: "Scenario Planner",         desc: "Stress-test portfolios across macro and custom scenarios" },
  "/deals":                    { name: "Deal Pipeline",            desc: "Active M&A and investment deal tracking" },
  "/cash-flow":                { name: "Cash Flow",                desc: "Projected inflows/outflows and cash position timeline" },
  "/watchlist":                { name: "Watchlist",                desc: "Tracked securities with price and signal alerts" },
  "/vault":                    { name: "Document Vault",           desc: "Secure document storage and retrieval" },
  "/advisory":                 { name: "Advisory",                 desc: "Advisor communications and meeting notes" },
  "/logs":                     { name: "AI Logs",                  desc: "Audit log of all AI model interactions" },
  "/tax-returns":              { name: "Tax Returns",              desc: "Historical tax filing archive and analysis" },
  "/tax-harvest":              { name: "Tax-Loss Harvesting",      desc: "Automated tax-loss harvesting opportunity scanner" },
  "/monte-carlo":              { name: "Monte Carlo",              desc: "Probability-weighted retirement and goal simulations" },
  "/cost-basis":               { name: "Cost Basis",               desc: "Lot-level cost basis tracker for all holdings" },
  "/pme":                      { name: "PME Analysis",             desc: "Public-market equivalent benchmarking for private funds" },
  "/dividend-calendar":        { name: "Dividend Calendar",        desc: "Upcoming dividend and distribution events" },
  "/charitable":               { name: "Charitable Giving",        desc: "DAF, QCD and charitable strategy optimizer" },
  "/estate-planning":          { name: "Estate Planning",          desc: "Estate tax projection and transfer strategy" },
  "/fx-hedging":               { name: "FX Hedging",               desc: "Currency exposure mapping and hedging strategies" },
  "/rate-sensitivity":         { name: "Rate Sensitivity",         desc: "Duration and rate-shock impact on fixed income" },
  "/advisor-messages":         { name: "Advisor Messages",         desc: "Secure advisor message center" },
  "/ask-portfolio":            { name: "Ask Portfolio",            desc: "AI natural-language queries over portfolio data" },
  "/market-briefing":          { name: "Market Briefing",          desc: "Daily macro and market intelligence digest" },
  "/deal-memo":                { name: "Deal Memo",                desc: "AI-generated deal memorandum builder" },
  "/capital-calls":            { name: "Capital Calls",            desc: "Upcoming and historical PE capital call tracker" },
  "/alternatives-map":         { name: "Alternatives Map",         desc: "Alternatives exposure heat map across strategies" },
  "/quarterly-report":         { name: "Quarterly Report",         desc: "Automated quarterly investor report generation" },
  "/tax-package":              { name: "Tax Package",              desc: "Year-end tax package compilation" },
  "/roth-analyzer":            { name: "Roth Analyzer",            desc: "Roth conversion opportunity modeler" },
  "/education-fund":           { name: "Education Fund",           desc: "529 and education savings goal tracker" },
  "/concierge":                { name: "Concierge",                desc: "AI lifestyle and service request center" },
  "/charts":                   { name: "Charts",                   desc: "Interactive charting and technical analysis" },
  "/screener":                 { name: "Screener",                 desc: "Multi-factor security screening tool" },
  "/options":                  { name: "Options Analytics",        desc: "Options chain, Greeks and strategy builder" },
  "/earnings":                 { name: "Earnings Tracker",         desc: "Upcoming earnings dates and surprise history" },
  "/commodities":              { name: "Commodities",              desc: "Commodity spot prices, curves and exposure" },
  "/fixed-income":             { name: "Fixed Income",             desc: "Bond portfolio analytics and credit quality" },
  "/volatility":               { name: "Volatility Monitor",       desc: "Implied vs realized volatility and VIX dashboard" },
  "/economic-data":            { name: "Economic Dashboard",       desc: "Key economic indicators and macro scoreboard" },
  "/company":                  { name: "Company Deep Dive",        desc: "Fundamental company analysis and peer comparison" },
  "/news":                     { name: "News Intelligence",        desc: "AI-curated news with portfolio impact tagging" },
  "/factor-analysis":          { name: "Factor Analysis",          desc: "Portfolio factor exposures: value, momentum, quality" },
  "/credit":                   { name: "Credit Monitor",           desc: "Credit spread tracker and default risk signals" },
  "/bloomberg":                { name: "Bloomberg Hub",            desc: "Bloomberg data integration and terminal bridge" },
  "/benefits-benchmarking":    { name: "Benefits Benchmarking",    desc: "DOL EFAST2 benchmarking — 191K employers, national & state percentiles for admin fees, commissions, PMPM" },
  "/data-feeds":               { name: "Data Intelligence",        desc: "Live data feed management and API connectors" },
  "/tech-stack":               { name: "Tech Stack",               desc: "Platform infrastructure and integration status" },
  "/admin":                    { name: "Admin",                    desc: "User management, roles and system settings" },
  "/governance":               { name: "Governance Engine",        desc: "Fiduciary governance scoring and policy tracker" },
  "/kpi-library":              { name: "KPI Library",              desc: "Curated KPI definitions and benchmarks" },
  "/executive-tiles":          { name: "Executive Tiles",          desc: "Customizable executive metric tile board" },
  "/board-pack":               { name: "Board Pack",               desc: "Auto-generated board presentation package" },
  "/policy-check":             { name: "Policy Check",             desc: "Investment policy statement compliance checker" },
  "/receipt-check":            { name: "Receipt Check",            desc: "Expense receipt OCR and validation" },
  "/claim-verification":       { name: "Claim Verification",       desc: "Healthcare claim authenticity verification" },
  "/export-generation":        { name: "Export Generation",        desc: "Bulk report and data export center" },
  "/audit-log":                { name: "Audit Log",                desc: "Full platform activity and change audit trail" },
  "/database":                 { name: "Database Explorer",        desc: "Direct SQL query interface to platform data" },
  "/pipeline":                 { name: "Pipeline Intelligence",    desc: "Sales pipeline and prospect conversion analytics" },
  "/broker-prospects":         { name: "Broker Prospects",         desc: "Tennessee prospecting engine with ranked targets" },
  "/cross-intel":              { name: "Cross Intelligence",       desc: "Cross-sell and relationship intelligence map" },
  "/commit-engine":            { name: "Commit Engine",            desc: "Strategic commitment and initiative tracking" },
  "/valuation":                { name: "Business Valuation",       desc: "DCF, comps and LBO valuation models" },
  "/governance-war-room":      { name: "Governance War Room",      desc: "Real-time governance risk and incident dashboard" },
  "/governance-claims":        { name: "Governance Claims",        desc: "ERISA claim fiduciary review workflow" },
  "/governance-dossier":       { name: "Governance Dossier",       desc: "Comprehensive fiduciary governance dossier" },
  "/drill/ebitda":             { name: "EBITDA Drill",             desc: "EBITDA variance drill-down by entity/period" },
  "/drill/provider":           { name: "Provider Drill",           desc: "Healthcare provider cost and quality drill-down" },
  "/drill/compliance":         { name: "Compliance Drill",         desc: "Compliance control status drill-down" },
  "/drill/yoy":                { name: "Year-over-Year Drill",     desc: "YoY performance comparison across metrics" },
  "/drill/pension":            { name: "Pension Drill",            desc: "Pension liability and funding status drill-down" },
  "/actuarial-broker":         { name: "Actuarial Broker",         desc: "Broker-facing actuarial analysis and pricing" },
  "/actuarial-engine":         { name: "Actuarial Engine IQ",      desc: "Full actuarial modeling engine for self-funded plans" },
  "/glp1-stress-test":         { name: "GLP-1 Stress Test",        desc: "GLP-1 drug cost impact stress testing for plans" },
  "/god-mode":                 { name: "God Mode",                 desc: "Super-admin platform override and diagnostics" },
  "/sbi-forensic":             { name: "SBI Forensic",             desc: "Stop-loss bill forensic analysis and dispute tools" },
  "/cei-engine":               { name: "CEI Engine",               desc: "Claims experience intelligence scoring engine" },
  "/capital-velocity":         { name: "Capital Velocity",         desc: "Capital deployment speed and opportunity pipeline" },
  "/lcnc-security":            { name: "LCNC Security",            desc: "Low-code/no-code security risk assessment" },
  "/mckinsey-copilot":         { name: "McKinsey Co-Pilot",        desc: "Full-screen McKinsey strategic advisor (this tool)" },
  "/sms-center":               { name: "SMS Center",               desc: "Twilio-powered SMS broadcast and alert center" },
  "/compliance-engine":        { name: "Compliance Engine",        desc: "Multi-framework compliance: SOC 2, ISO 27001, HIPAA, NIST, PCI DSS" },
  "/billing":                  { name: "Billing",                  desc: "Subscription plan management and Stripe billing" },
  "/saas/fiduciary":           { name: "Fiduciary SaaS",           desc: "Fiduciary intelligence SaaS module" },
  "/saas/broker":              { name: "Broker SaaS",              desc: "Broker intelligence SaaS module" },
  "/saas/stoploss":            { name: "Stop-Loss SaaS",           desc: "Stop-loss analytics SaaS module" },
  "/saas/network":             { name: "Network SaaS",             desc: "Network intelligence SaaS module" },
  "/network-iq":               { name: "Network IQ",               desc: "Provider network adequacy and disruption analysis" },
  "/fiduciary-iq":             { name: "Fiduciary IQ",             desc: "Fiduciary scoring and benchmarking dashboard" },
  "/stewardship":              { name: "Stewardship Builder",      desc: "Plan stewardship report builder for committees" },
  "/employer-health-score":    { name: "Employer Health Score",    desc: "Employer health plan performance composite score" },
  "/claims-recovery":          { name: "Claims Recovery",          desc: "Overpayment identification and recovery tracking" },
  "/network-iq/disruption-report": { name: "Disruption Report",   desc: "Network disruption scenario impact reporting" },
  "/saas/contract-xray":       { name: "Contract X-Ray",           desc: "AI contract clause analysis and risk flagging" },
  "/rx-pbm":                   { name: "RxPBM Intelligence",        desc: "Drug pricing benchmarks, PBM directory, and RFP question bank" },
  "/actuarial-workbench":      { name: "5500 Actuarial Workbench",  desc: "DOL Form 5500 Schedule H actuarial analysis — 191K employers, multi-year financials, percentile benchmarks, AI narrative" },
  "/rx-defense":               { name: "Rx Defense",               desc: "PBM contract and pharmacy benefit forensic review" },
  "/stop-loss":                { name: "Stop-Loss",                desc: "Stop-loss policy management and aggregate tracking" },
  "/cfo-war-room":             { name: "CFO War Room",             desc: "CFO-focused financial command center" },
  "/integrations":             { name: "Integrations Hub",         desc: "Third-party integration management: M365, QuickBooks, etc." },
  "/integrations/m365":        { name: "M365 Integration",         desc: "Microsoft 365 data connector and sync" },
  "/integrations/quickbooks":  { name: "QuickBooks Integration",   desc: "QuickBooks accounting data sync" },
};

// ─── Build navigation context string sent with every message ─────────────────
function buildNavContext(currentPath: string): string {
  const current = ROUTE_MAP[currentPath];
  const currentLabel = current ? `${current.name} (${currentPath})` : currentPath;

  const pageList = Object.entries(ROUTE_MAP)
    .map(([path, { name, desc }]) => `  ${path} — ${name}: ${desc}`)
    .join("\n");

  return (
    `NAVIGATION CONTEXT\n` +
    `Current page: ${currentLabel}\n\n` +
    `Available pages in this platform:\n${pageList}\n\n` +
    `When the user asks where something is, what a feature does, or how to get somewhere, ` +
    `use the exact route paths above. Format navigation links as: [Page Name](/path) — ` +
    `the frontend will render these as clickable navigation buttons automatically.`
  );
}

// ─── Detect [Label](/path) markdown links and render as nav buttons ───────────
function parseNavLinks(
  text: string,
  navigate: (path: string) => void,
  onClose: () => void
): React.ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]+\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
    if (match) {
      const [, label, path] = match;
      const known = ROUTE_MAP[path];
      return (
        <button
          key={i}
          onClick={() => { navigate(path); onClose(); }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold mx-0.5 transition-all hover:opacity-80"
          style={{
            background: "rgba(79,125,255,0.2)",
            border: "1px solid rgba(79,125,255,0.4)",
            color: ACCENT,
            verticalAlign: "middle",
          }}
          title={known?.desc ?? path}
        >
          <Navigation size={9} />
          {label}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Markdown renderer with nav-link support ──────────────────────────────────
function MarkdownText({
  content,
  navigate,
  onClose,
}: {
  content: string;
  navigate: (path: string) => void;
  onClose: () => void;
}) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ") || line.startsWith("### ")) {
          return (
            <p key={i} className="font-bold mt-2" style={{ color: ACCENT }}>
              {parseNavLinks(line.replace(/^#{2,3}\s/, ""), navigate, onClose)}
            </p>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <p key={i} className="font-bold mt-2 text-white">
              {parseNavLinks(line.replace("# ", ""), navigate, onClose)}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-1.5 items-start">
              <span style={{ color: ACCENT }} className="mt-0.5 flex-shrink-0">●</span>
              <span style={{ color: "rgba(255,255,255,0.8)" }}>
                {parseNavLinks(line.replace(/^[-•]\s/, ""), navigate, onClose)}
              </span>
            </div>
          );
        }
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-1.5 items-start">
              <span style={{ color: ACCENT, minWidth: 16 }} className="font-bold flex-shrink-0">
                {num}.
              </span>
              <span style={{ color: "rgba(255,255,255,0.8)" }}>
                {parseNavLinks(line.replace(/^\d+\.\s/, ""), navigate, onClose)}
              </span>
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-1" />;

        // Bold + nav links inline
        const processInline = (raw: string): React.ReactNode[] => {
          const segments = raw.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)]+\))/g);
          return segments.map((seg, j) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              return (
                <strong key={j} className="text-white font-semibold">
                  {seg.replace(/\*\*/g, "")}
                </strong>
              );
            }
            const navMatch = seg.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
            if (navMatch) {
              const [, label, path] = navMatch;
              const known = ROUTE_MAP[path];
              return (
                <button
                  key={j}
                  onClick={() => { navigate(path); onClose(); }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold mx-0.5 transition-all hover:opacity-80"
                  style={{
                    background: "rgba(79,125,255,0.2)",
                    border: "1px solid rgba(79,125,255,0.4)",
                    color: ACCENT,
                    verticalAlign: "middle",
                  }}
                  title={known?.desc ?? path}
                >
                  <Navigation size={9} />
                  {label}
                </button>
              );
            }
            return <span key={j} style={{ color: "rgba(255,255,255,0.75)" }}>{seg}</span>;
          });
        };

        return <p key={i}>{processInline(line)}</p>;
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  content: string;
  benchmarkUsed?: boolean;
  benchmarkCompany?: string | null;
  isBrief?: boolean;
  briefPage?: string;
};

type LiveAlert = {
  ein: string; name: string; state: string; year: number;
  commission_pct: number; broker_commissions: number;
  welfare_premiums: number; industry_p75: number;
};
type Framework = {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompt_prefix: string;
};

export default function McKinseyFloatingCoPilot() {
  const { isAuthenticated } = useAuth();
  const [location, navigate] = useLocation();

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [showFrameworks, setShowFrameworks] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [lastBriefedPage, setLastBriefedPage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: frameworksData } = useQuery<{ frameworks: Framework[] }>({
    queryKey: ["/api/mckinsey/frameworks"],
    enabled: isAuthenticated,
  });
  const frameworks = frameworksData?.frameworks ?? [];

  const { data: alertsData } = useQuery<{ alerts: LiveAlert[]; total_flags: number }>({
    queryKey: ["/api/mckinsey/live-alerts"],
    enabled: isAuthenticated,
    refetchInterval: 120_000,
  });
  const liveAlerts = alertsData?.alerts ?? [];
  const totalFlags = alertsData?.total_flags ?? 0;

  const navContext = buildNavContext(location);

  const chatMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await apiRequest("POST", "/api/mckinsey/chat", {
        message: msg,
        history: messages,
        framework: selectedFramework,
        context: navContext,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply,
        benchmarkUsed: data.benchmark_used ?? false,
        benchmarkCompany: data.benchmark_company ?? null,
      }]);
    },
  });

  const briefMutation = useMutation({
    mutationFn: async ({ route, pageName }: { route: string; pageName: string }) => {
      const prompt =
        `You are watching over the user's shoulder on the "${pageName}" page. ` +
        `Give a proactive 3-bullet situational brief — what should they know right now, ` +
        `what actions to consider, and any data-driven alerts relevant to this view. ` +
        `Be specific, concise, and fiduciary-focused. No filler.`;
      const res = await apiRequest("POST", "/api/mckinsey/chat", {
        message: prompt,
        history: [],
        framework: null,
        context: navContext,
      });
      return res.json();
    },
    onSuccess: (data, variables) => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply,
        isBrief: true,
        briefPage: variables.pageName,
        benchmarkUsed: data.benchmark_used ?? false,
        benchmarkCompany: data.benchmark_company ?? null,
      }]);
      setLastBriefedPage(variables.route);
    },
  });

  const briefMutateRef = useRef(briefMutation.mutate);
  briefMutateRef.current = briefMutation.mutate;

  const fireBrief = useCallback((route: string) => {
    const info = ROUTE_MAP[route];
    if (!info) return;
    briefMutateRef.current({ route, pageName: info.name });
  }, []);

  const openRef = useRef(open);
  openRef.current = open;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const lastBriefedPageRef = useRef(lastBriefedPage);
  lastBriefedPageRef.current = lastBriefedPage;

  useEffect(() => {
    if (open && messagesRef.current.length === 0 && lastBriefedPageRef.current !== location) {
      fireBrief(location);
    }
  }, [open, fireBrief, location]);

  useEffect(() => {
    if (openRef.current && lastBriefedPageRef.current !== null && lastBriefedPageRef.current !== location) {
      fireBrief(location);
    }
  }, [location, fireBrief]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    chatMutation.mutate(text);
  }, [input, chatMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 120);
  }, [open]);

  if (!isAuthenticated) return null;

  const activeFramework = frameworks.find((f) => f.id === selectedFramework);
  const panelW = expanded ? 560 : 390;
  const panelH = expanded ? 700 : 540;
  const currentPageInfo = ROUTE_MAP[location];

  return createPortal(
    <>
      {/* Floating trigger */}
      {!open && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999 }}>
          {totalFlags > 0 && (
            <div className="absolute -top-2 -left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(217,119,6,0.9)", border: "1px solid rgba(217,119,6,0.6)", zIndex: 1 }}>
              <AlertTriangle size={8} color="white" />
              <span className="text-[9px] font-black text-white">{totalFlags.toLocaleString()}</span>
            </div>
          )}
          <button
            data-testid="mckinsey-copilot-open"
            onClick={() => setOpen(true)}
            className="flex flex-col items-start shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #2a3fa8 0%, #4f7dff 100%)",
              border: "1px solid rgba(79,125,255,0.5)",
              boxShadow: "0 0 24px rgba(79,125,255,0.35), 0 4px 20px rgba(0,0,0,0.5)",
              color: "white",
            }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5">
              <BrainCircuit size={16} />
              <span className="text-xs font-bold tracking-wide">McKinsey Co-Pilot</span>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4fffb0" }} />
            </div>
            {currentPageInfo && (
              <div className="flex items-center gap-1.5 px-4 pb-2 -mt-1">
                <Eye size={9} style={{ color: "rgba(255,255,255,0.45)" }} />
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Monitoring: <span style={{ color: "rgba(255,255,255,0.7)" }}>{currentPageInfo.name}</span>
                </span>
              </div>
            )}
          </button>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div
          data-testid="mckinsey-copilot-panel"
          className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 9999,
            width: panelW,
            height: panelH,
            background: BG,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 0 40px rgba(79,125,255,0.2), 0 20px 60px rgba(0,0,0,0.7)",
            transition: "width 0.22s ease, height 0.22s ease",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }}
          >
            <BrainCircuit size={15} style={{ color: ACCENT }} />
            <span className="font-bold text-xs text-white tracking-wide">McKinsey Co-Pilot</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full ml-1 font-semibold"
              style={{ background: "rgba(79,125,255,0.15)", color: ACCENT }}
            >
              ENTERPRISE
            </span>
            {(briefMutation.isPending) && (
              <span className="flex items-center gap-1 text-[9px] font-semibold animate-pulse"
                style={{ color: "#4fffb0" }}>
                <Radio size={8} />BRIEFING
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  data-testid="mckinsey-copilot-reset"
                  onClick={() => { setMessages([]); setSelectedFramework(null); setLastBriefedPage(null); }}
                  className="p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity text-white"
                  title="New conversation"
                >
                  <RotateCcw size={12} />
                </button>
              )}
              <button
                data-testid="mckinsey-copilot-resize"
                onClick={() => setExpanded((e) => !e)}
                className="p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity text-white"
                title={expanded ? "Compact" : "Expand"}
              >
                {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
              <button
                data-testid="mckinsey-copilot-close"
                onClick={handleClose}
                className="p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity text-white"
                title="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Monitoring bar */}
          <div className="px-4 pt-2 pb-1 flex-shrink-0 flex items-center gap-2"
            style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4fffb0" }} />
              <Eye size={9} style={{ color: "#4fffb0" }} />
              <span className="text-[9px] font-bold" style={{ color: "#4fffb0" }}>MONITORING</span>
              {currentPageInfo && (
                <span className="text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  — {currentPageInfo.name}
                </span>
              )}
            </div>
            {totalFlags > 0 && (
              <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.25)" }}>
                <AlertTriangle size={8} style={{ color: "#d97706" }} />
                <span className="text-[9px] font-bold" style={{ color: "#d97706" }}>{totalFlags.toLocaleString()} flags</span>
              </div>
            )}
            {currentPageInfo && (
              <button
                data-testid="btn-manual-brief"
                onClick={() => fireBrief(location)}
                disabled={briefMutation.isPending}
                className="ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-opacity hover:opacity-80 disabled:opacity-30"
                style={{ background: "rgba(79,125,255,0.12)", border: "1px solid rgba(79,125,255,0.25)", color: ACCENT }}
                title="Request situational brief">
                <Zap size={8} />Brief me
              </button>
            )}
          </div>

          {/* Framework pill */}
          <div className="px-3 pt-1 pb-1 flex-shrink-0">
            <button
              data-testid="mckinsey-framework-toggle"
              onClick={() => setShowFrameworks((s) => !s)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
              style={{
                background: selectedFramework ? "rgba(79,125,255,0.15)" : SURFACE,
                border: `1px solid ${selectedFramework ? "rgba(79,125,255,0.4)" : BORDER}`,
                color: selectedFramework ? ACCENT : "rgba(255,255,255,0.4)",
              }}
            >
              <Sparkles size={10} />
              {activeFramework ? activeFramework.name : "Free-form chat"}
              <ChevronDown
                size={10}
                style={{
                  transform: showFrameworks ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}
              />
            </button>
          </div>

          {/* Framework dropdown */}
          {showFrameworks && (
            <div
              className="mx-3 mb-2 rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.03)" }}
            >
              <div className="p-2 grid grid-cols-2 gap-1">
                <button
                  data-testid="fw-none"
                  onClick={() => { setSelectedFramework(null); setShowFrameworks(false); }}
                  className="px-2 py-1.5 rounded-lg text-left text-[10px] transition-all"
                  style={{
                    background: !selectedFramework ? "rgba(79,125,255,0.15)" : "transparent",
                    color: !selectedFramework ? ACCENT : "rgba(255,255,255,0.5)",
                    border: `1px solid ${!selectedFramework ? "rgba(79,125,255,0.3)" : "transparent"}`,
                  }}
                >
                  Free-form
                </button>
                {frameworks.map((fw) => {
                  const Icon = ICON_MAP[fw.icon] || Sparkles;
                  const active = selectedFramework === fw.id;
                  return (
                    <button
                      key={fw.id}
                      data-testid={`fw-${fw.id}`}
                      onClick={() => { setSelectedFramework(active ? null : fw.id); setShowFrameworks(false); }}
                      className="px-2 py-1.5 rounded-lg text-left transition-all flex items-center gap-1.5"
                      style={{
                        background: active ? "rgba(79,125,255,0.15)" : "transparent",
                        color: active ? ACCENT : "rgba(255,255,255,0.55)",
                        border: `1px solid ${active ? "rgba(79,125,255,0.3)" : "transparent"}`,
                      }}
                    >
                      <Icon size={10} />
                      <span className="text-[10px] font-medium truncate">{fw.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3" style={{ minHeight: 0 }}>
            {messages.length === 0 && (
              <div className="h-full flex flex-col px-3 py-2 gap-3 overflow-y-auto">
                {/* Briefing loading state */}
                {briefMutation.isPending && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl"
                    style={{ background: "rgba(79,255,176,0.04)", border: "1px solid rgba(79,255,176,0.15)" }}>
                    <Loader2 size={11} className="animate-spin" style={{ color: "#4fffb0" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "#4fffb0" }}>
                      Generating situational brief for {currentPageInfo?.name ?? "this page"}…
                    </span>
                  </div>
                )}

                {/* Live DOL Intel Alerts */}
                {liveAlerts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle size={9} style={{ color: "#d97706" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#d97706" }}>
                        Live DOL Alerts · {totalFlags.toLocaleString()} flagged employers
                      </span>
                    </div>
                    <div className="space-y-1">
                      {liveAlerts.slice(0, 5).map((a) => (
                        <button key={a.ein}
                          onClick={() => {
                            setInput(`Analyze ${a.name} (EIN ${a.ein}) broker commission of ${a.commission_pct}% vs industry P75`);
                            setTimeout(() => textareaRef.current?.focus(), 50);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg transition-all"
                          style={{ background: "rgba(217,119,6,0.04)", border: "1px solid rgba(217,119,6,0.18)" }}
                          data-testid={`alert-${a.ein}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-white truncate">{a.name}</span>
                            <span className="text-[9px] font-black shrink-0" style={{ color: "#d97706" }}>
                              {a.commission_pct}% comm.
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                              {a.state} · {a.year} · EIN {a.ein}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* DOL Benchmarking quick prompts */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Database size={9} style={{ color: "#10b981" }} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#10b981" }}>DOL Benchmarking</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 w-full">
                    {[
                      "Benchmark Walmart",
                      "How does Amazon compare to peers in benefits?",
                      "Show me General Electric admin fees vs industry",
                      "What are Boeing broker commissions vs national P50?",
                    ].map((q) => (
                      <button key={q}
                        onClick={() => { setInput(q); setTimeout(() => textareaRef.current?.focus(), 50); }}
                        className="text-left px-2.5 py-1.5 rounded-lg text-[10px] transition-all"
                        style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)", color: "rgba(255,255,255,0.45)" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navigation quick prompts */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Navigation size={9} style={{ color: "rgba(79,125,255,0.6)" }} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(79,125,255,0.6)" }}>Navigate & Analyze</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 w-full">
                    {["Where is the compliance engine?", "How do I run a GLP-1 stress test?"].map((q) => (
                      <button key={q}
                        onClick={() => { setInput(q); setTimeout(() => textareaRef.current?.focus(), 50); }}
                        className="text-left px-2.5 py-1.5 rounded-lg text-[10px] transition-all"
                        style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.45)" }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={msg.isBrief
                      ? { background: "rgba(79,255,176,0.15)", border: "1px solid rgba(79,255,176,0.3)" }
                      : { background: "rgba(79,125,255,0.2)", border: "1px solid rgba(79,125,255,0.3)" }}
                  >
                    {msg.isBrief
                      ? <Eye size={10} style={{ color: "#4fffb0" }} />
                      : <BrainCircuit size={10} style={{ color: ACCENT }} />}
                  </div>
                )}
                <div
                  className="max-w-[87%] rounded-xl px-3 py-2 group relative"
                  style={
                    msg.role === "user"
                      ? { background: "rgba(79,125,255,0.18)", border: "1px solid rgba(79,125,255,0.25)" }
                      : msg.isBrief
                        ? { background: "rgba(79,255,176,0.03)", border: "1px solid rgba(79,255,176,0.18)" }
                        : { background: SURFACE, border: `1px solid ${BORDER}` }
                  }
                >
                  {msg.isBrief && (
                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b"
                      style={{ borderColor: "rgba(79,255,176,0.15)" }}>
                      <Radio size={8} style={{ color: "#4fffb0" }} />
                      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4fffb0" }}>
                        Intel Brief
                      </span>
                      {msg.briefPage && (
                        <>
                          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
                          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.45)" }}>{msg.briefPage}</span>
                        </>
                      )}
                    </div>
                  )}
                  {msg.role === "user" ? (
                    <p className="text-xs text-white">{msg.content}</p>
                  ) : (
                    <>
                      {msg.benchmarkUsed && msg.benchmarkCompany && !msg.isBrief && (
                        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b" style={{ borderColor: "rgba(79,125,255,0.2)" }}>
                          <div className="w-3.5 h-3.5 rounded flex items-center justify-center" style={{ background: "rgba(16,185,129,0.2)" }}>
                            <Database size={8} style={{ color: "#10b981" }} />
                          </div>
                          <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#10b981" }}>
                            DOL EFAST2 Live Data
                          </span>
                          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
                          <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.5)" }}>{msg.benchmarkCompany}</span>
                        </div>
                      )}
                      <MarkdownText content={msg.content} navigate={navigate} onClose={handleClose} />
                    </>
                  )}
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => copyMessage(msg.content, i)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {copiedIdx === i ? <Check size={10} style={{ color: "#4fffb0" }} /> : <Copy size={10} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {chatMutation.isPending && (() => {
              const lastMsg = messages[messages.length - 1]?.content ?? "";
              const isBenchmark = /benchmark|compare|admin fees|broker commission|dol data|form 5500|pmpm|paying for benefits/i.test(lastMsg);
              return (
                <div className="flex gap-2 justify-start">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: isBenchmark ? "rgba(16,185,129,0.2)" : "rgba(79,125,255,0.2)",
                      border: `1px solid ${isBenchmark ? "rgba(16,185,129,0.3)" : "rgba(79,125,255,0.3)"}`,
                    }}
                  >
                    {isBenchmark
                      ? <Database size={10} style={{ color: "#10b981" }} />
                      : <BrainCircuit size={10} style={{ color: ACCENT }} />
                    }
                  </div>
                  <div className="rounded-xl px-3 py-2" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
                    <div className="flex gap-1 items-center">
                      <Loader2 size={11} className="animate-spin" style={{ color: isBenchmark ? "#10b981" : ACCENT }} />
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {isBenchmark ? "Searching DOL records…" : "Analyzing…"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {chatMutation.isError && (
              <p className="text-center text-[10px]" style={{ color: "#ff6b6b" }}>
                Connection error — please try again.
              </p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${BORDER}` }}>
            <div
              className="flex gap-2 items-end rounded-xl px-3 py-2"
              style={{ background: SURFACE, border: `1px solid ${BORDER}` }}
            >
              <textarea
                ref={textareaRef}
                data-testid="mckinsey-copilot-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeFramework
                    ? `Apply ${activeFramework.name}…`
                    : "Ask where to find anything or get strategic analysis…"
                }
                rows={2}
                className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 resize-none outline-none leading-relaxed"
                style={{ maxHeight: 80 }}
              />
              <button
                data-testid="mckinsey-copilot-send"
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="p-1.5 rounded-lg transition-all flex-shrink-0 disabled:opacity-30"
                style={{
                  background: input.trim() ? "rgba(79,125,255,0.25)" : "transparent",
                  color: ACCENT,
                }}
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-center text-[9px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
