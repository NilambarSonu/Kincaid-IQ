import {
  Activity,
  Banknote,
  BarChart2,
  BarChart3,
  BookText,
  BookUser,
  BrainCircuit,
  Briefcase,
  Building2,
  Calculator,
  CalendarCheck,
  Cloud,
  ClipboardCheck,
  Command,
  Cpu,
  CreditCard,
  Crosshair,
  Database,
  DollarSign,
  Eye,
  FileDown,
  FileSearch,
  Fingerprint,
  FlaskConical,
  Globe,
  Globe2,
  GitBranch,
  Heart,
  HeartHandshake,
  HeartPulse,
  KanbanSquare,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Link2,
  LockKeyhole,
  Mail,
  Map,
  Network,
  Newspaper,
  Package2,
  Pill,
  Plug,
  Radar,
  ReceiptText,
  Rocket,
  ScrollText,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  TableProperties,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";

export type NavItem = {
  path: string;
  label: string;
  icon: any;
  badge?: string;
};

export type NavSection = {
  heading: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    heading: "Sales OS",
    items: [
      { path: "/cfo-war-room", label: "CFO War Room", icon: LayoutDashboard, badge: "CFO" },
      { path: "/sales-os", label: "Sales OS", icon: Rocket, badge: "NEW" },
      { path: "/saas/broker", label: "Sales IQ Console", icon: Building2, badge: "PIN" },
      { path: "/sales-iq-intel", label: "Sales IQ Intelligence", icon: Target, badge: "50ST" },
      { path: "/account-intel", label: "Account Intel Hub", icon: Database, badge: "9 API" },
      { path: "/shady-broker-index", label: "Shady Broker Report", icon: ShieldAlert, badge: "0-100" },
    ],
  },
  {
    heading: "Rx / PBM",
    items: [
      { path: "/rx-defense", label: "Rx Defense IQ™", icon: Pill },
      { path: "/rx-defense-pro", label: "Rx Defense Pro™", icon: ShieldCheck },
      { path: "/rx-pbm", label: "RxPBM Intelligence", icon: FlaskConical },
    ],
  },
  {
    heading: "Core",
    items: [
      { path: "/hios", label: "HIOS — Intelligence OS", icon: BrainCircuit },
      { path: "/operating-systems", label: "Operating Systems", icon: LayoutGrid, badge: "4" },
      { path: "/claims-recovery", label: "Claims Recovery IQ™", icon: DollarSign },
      { path: "/dashboard", label: "Command Center", icon: Command },
      { path: "/stop-loss", label: "Stop-Loss IQ™", icon: Activity },
      { path: "/network-iq", label: "Network IQ™", icon: Network },
      { path: "/fiduciary-iq", label: "Fiduciary IQ™", icon: Shield },
    ],
  },
  {
    heading: "RFP Intelligence OS",
    items: [
      { path: "/rfp-os", label: "RFP Intelligence OS", icon: Radar },
      { path: "/rfp-command-center", label: "Command Center", icon: ClipboardCheck },
      { path: "/rfp-intelligence", label: "RFP Intelligence OS™", icon: ScrollText, badge: "NEW" },
      { path: "/rfp-resource-allocator", label: "Resource Allocator", icon: Users },
      { path: "/rfp-model-health", label: "Model Health", icon: BarChart3 },
      { path: "/battlecards", label: "Battlecards", icon: Swords },
      { path: "/5500-monitor", label: "5500 Monitor", icon: CalendarCheck, badge: "LIVE" },
      { path: "/digest-preferences", label: "Intelligence Digest", icon: Newspaper },
    ],
  },
  {
    heading: "Data Intelligence",
    items: [
      { path: "/company-360", label: "Company 360", icon: Briefcase },
      { path: "/plan-metrics", label: "Plan Metrics IQ", icon: BarChart2 },
      { path: "/gov-stats", label: "Gov Stats Hub", icon: Globe2 },
      { path: "/pricing", label: "Solution Value & Pricing", icon: Tag },
      { path: "/commit-engine", label: "KincaidCommit Engine™", icon: GitBranch, badge: "PIN" },
      { path: "/federal-intelligence", label: "Federal Risk Intelligence™", icon: Landmark, badge: "PIN" },
      { path: "/drill-engine", label: "KIQ Drill Engine™", icon: Cpu, badge: "KIQ" },
      { path: "/contact-intel", label: "Contact Intelligence™", icon: Mail, badge: "NEW" },
      { path: "/contacts-db", label: "Contacts Database", icon: BookUser },
      { path: "/crm-sync", label: "CRM Sync", icon: Link2, badge: "NEW" },
      { path: "/edgar-intelligence", label: "EDGAR Language Engine™", icon: BookText, badge: "NEW" },
      { path: "/ma-diligence", label: "M&A Due Diligence™", icon: TrendingUp, badge: "PIN" },
      { path: "/cross-intel", label: "DOL × EDGAR Intelligence", icon: Layers },
      { path: "/actuarial-engine", label: "Actuarial Engine IQ™", icon: Calculator },
      { path: "/indiana-5500-upload", label: "Tennessee 5500 Upload", icon: Upload },
    ],
  },
  {
    heading: "Client Integrations",
    items: [
      { path: "/integrations", label: "Integrations Hub", icon: Plug, badge: "19" },
      { path: "/integrations/m365", label: "Microsoft 365", icon: Cloud, badge: "DEMO" },
      { path: "/integrations/quickbooks", label: "QuickBooks Online", icon: ReceiptText, badge: "DEMO" },
    ],
  },
  {
    heading: "Advanced Intelligence",
    items: [
      { path: "/glp1-stress-test", label: "GLP-1 Stress Test", icon: HeartPulse },
      { path: "/sbi-forensic", label: "SBI Forensic Composite", icon: Eye },
      { path: "/cei-engine", label: "CEI Confidence Engine", icon: Fingerprint },
      { path: "/capital-velocity", label: "Capital Velocity Index", icon: LineChart },
      { path: "/lcnc-security", label: "LCNC / AI Security", icon: LockKeyhole },
      { path: "/god-mode", label: "God Mode ⚡", icon: Zap },
      { path: "/stewardship", label: "Stewardship Reports", icon: HeartHandshake },
      { path: "/employer-health-score", label: "Employer Health IQ", icon: Heart },
      { path: "/share-links", label: "Shared Links", icon: Share2 },
    ],
  },
  {
    heading: "Operations",
    items: [
      { path: "/kiq-verify", label: "Kincaid Health Verify", icon: FileSearch },
      { path: "/board-pack", label: "Board Pack", icon: Package2 },
      { path: "/export-generation", label: "Export Generation", icon: FileDown },
      { path: "/audit-log", label: "Audit Log", icon: Banknote },
      { path: "/governance", label: "Governance Engine", icon: Crosshair },
      { path: "/tech-stack", label: "Technology Architecture", icon: TableProperties },
      { path: "/admin", label: "Administration Panel", icon: Wrench },
    ],
  },
];

export type QuickAction = {
  label: string;
  description: string;
  path: string;
  icon: any;
  badge?: string;
};

export const quickActions: QuickAction[] = [
  {
    label: "Go to War Room",
    description: "CFO command center with live plan metrics",
    path: "/",
    icon: LayoutDashboard,
    badge: "CFO",
  },
  {
    label: "Open Sales OS",
    description: "Pipeline, account intelligence, and prospect motion",
    path: "/sales-os",
    icon: Rocket,
    badge: "NEW",
  },
  {
    label: "Open RFP Intelligence OS",
    description: "Pursuit command center, model health, and resource allocation",
    path: "/rfp-os",
    icon: Radar,
    badge: "RFP",
  },
  {
    label: "New Rx Defense Analysis",
    description: "Upload and score a PBM contract",
    path: "/rx-defense",
    icon: Pill,
    badge: "RX",
  },
  {
    label: "Open KIQ Drill Engine",
    description: "Deep evidence trail for any metric",
    path: "/drill-engine",
    icon: Cpu,
    badge: "KIQ",
  },
  {
    label: "Verify a Downloaded File",
    description: "Check a file's SHA-256 against its evidence record",
    path: "#verify-file",
    icon: ShieldCheck,
    badge: "SHA",
  },
];
