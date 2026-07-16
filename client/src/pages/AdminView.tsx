import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { FileHashVerifier } from "@/components/FileHashVerifier";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Database, Cpu, Activity, Code2, Settings2,
  RefreshCw, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Terminal, Layers, Table2, Network, Lock, Zap, Bot, GitBranch,
  Globe, FileText, BarChart3, Users, Eye, Clock, AlertTriangle,
  Wrench, Package, Server, HardDrive, Hash, List, Filter,
  SlidersHorizontal, Save, RotateCcw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DBTable {
  name: string;
  totalSize: string;
  sizeBytes: number;
  colCount: number;
  rowCount: number;
}

interface PlatformStats {
  version: string;
  client: string;
  stack: string;
  uptimeHuman: string;
  serverTime: string;
  pythonVersion: string;
  dbSize: string;
  tableCount: number;
  totalRows: number;
  frontendRoutes: number;
  frontendPages: number;
  backendRouters: number;
  tableCounts: Record<string, number>;
  snapshotStorage?: SnapshotStorage;
}

interface SnapshotStorage {
  snapshotCount: number;
  snapshotBytes: number;
  retentionDays: number;
  maxPerRecipient: number;
}

interface APIRoute {
  path: string;
  methods: string[];
  name: string | null;
  tags: string[];
  manifestCompliant?: boolean;
}

interface ConfigData {
  environment: string;
  debug: string;
  variables: Record<string, string | null>;
  aiProviders: Record<string, boolean>;
  integrations: Record<string, boolean>;
}

interface LogEntry {
  id: number;
  prompt: string;
  provider: string;
  responseSnippet: string;
  createdAt: string | null;
}

interface RfpScoringHealth {
  status: "defaults" | "applied" | "invalid" | "error";
  override_present: boolean;
  source: string | null;
  override_keys: string[];
  problems: string[];
  message: string;
}

// ─── Frontend route registry ──────────────────────────────────────────────────

const FRONTEND_PAGES: { path: string; label: string; category: string }[] = [
  { path: "/dashboard",          label: "Executive Dashboard",          category: "Core" },
  { path: "/war-room",           label: "Executive War Room",           category: "Core" },
  { path: "/portfolio",          label: "Portfolio Intelligence",        category: "Portfolio" },
  { path: "/risk",               label: "Risk Monitor",                  category: "Risk" },
  { path: "/claims",             label: "Claims Intelligence",           category: "Claims" },
  { path: "/claims-analytics",   label: "Claims Analytics",             category: "Claims" },
  { path: "/pipeline",           label: "Data Pipeline",                 category: "Data" },
  { path: "/kpi-library",        label: "KPI Library",                   category: "Data" },
  { path: "/data-quality",       label: "Data Quality Gate",            category: "Data" },
  { path: "/evidence-vault",     label: "Evidence Vault",               category: "Data" },
  { path: "/provenance",         label: "Provenance Chain",             category: "Data" },
  { path: "/transforms",         label: "Transforms",                    category: "Data" },
  { path: "/derived-metrics",    label: "Derived Metrics",              category: "Data" },
  { path: "/benchmarks",         label: "Benchmark Intelligence",        category: "Analytics" },
  { path: "/actuarial",          label: "Actuarial Engine",             category: "Analytics" },
  { path: "/actuarial-broker",   label: "Actuarial Broker Commissions", category: "Analytics" },
  { path: "/valuation",          label: "Business Valuation",           category: "Analytics" },
  { path: "/population",         label: "Population Health",            category: "Analytics" },
  { path: "/pharmacy",           label: "Pharmacy Intelligence",        category: "Analytics" },
  { path: "/network",            label: "Network Analysis",             category: "Analytics" },
  { path: "/network-optimizer",  label: "Network Optimizer",            category: "Analytics" },
  { path: "/stop-loss",          label: "Stop-Loss Intelligence",        category: "Risk" },
  { path: "/reinsurance",        label: "Reinsurance Dashboard",         category: "Risk" },
  { path: "/watchlist",          label: "Watchlist",                    category: "Risk" },
  { path: "/scenario",           label: "Scenario Planner",             category: "Intelligence" },
  { path: "/intelligence",       label: "AI Intelligence Center",       category: "Intelligence" },
  { path: "/sec-intelligence",   label: "SEC Intelligence",             category: "Intelligence" },
  { path: "/advisory",           label: "Advisory Engine",              category: "Intelligence" },
  { path: "/document-analyzer",  label: "Document Analyzer",            category: "Intelligence" },
  { path: "/document-vault",     label: "Document Vault",               category: "Vault" },
  { path: "/vault",              label: "Secure Vault",                 category: "Vault" },
  { path: "/clients",            label: "Client Registry",              category: "Operations" },
  { path: "/reporting",          label: "Reporting Center",             category: "Operations" },
  { path: "/exports",            label: "Export Manager",               category: "Operations" },
  { path: "/compliance",         label: "Compliance Center",            category: "Operations" },
  { path: "/regulatory",         label: "Regulatory Monitor",           category: "Operations" },
  { path: "/governance",         label: "Governance Dashboard",         category: "Operations" },
  { path: "/audit",              label: "Audit Trail",                  category: "Operations" },
  { path: "/settings",           label: "Settings",                     category: "System" },
  { path: "/tech-stack",         label: "Platform Tech Stack",          category: "System" },
  { path: "/admin",              label: "Administration Panel",         category: "System" },
];

const PAGE_CATEGORIES = Array.from(new Set(FRONTEND_PAGES.map(p => p.category)));

const CATEGORY_COLORS: Record<string, string> = {
  Core: "#00A8FF",
  Portfolio: "#00FF94",
  Risk: "#FF4D6D",
  Claims: "#FFB800",
  Data: "#A855F7",
  Analytics: "#00A8FF",
  Intelligence: "#00FF94",
  Vault: "#FFB800",
  Operations: "#A855F7",
  System: "#6B7280",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TABLE_LABELS: Record<string, string> = {
  kpi_library:        "KPI Library",
  broker_commissions: "Broker Commissions",
  claims:             "Claims",
  evidence_artifacts: "Evidence Artifacts",
  transforms:         "Transforms",
  derived_metrics:    "Derived Metrics",
  decision_receipts:  "Decision Receipts",
  logs:               "AI Logs",
  users:              "Users",
  watchlist_items:    "Watchlist Items",
  vault_documents:    "Vault Documents",
  sec_submissions:    "SEC Submissions",
  sec_numeric:        "SEC Numeric Data",
  sec_presentations:  "SEC Presentations",
  sec_tags:           "SEC Tags",
  sec_ingestion_log:  "SEC Ingestion Log",
  client_package_snapshots: "Delivery Snapshots",
  client_package_deliveries: "Delivery Log",
};

const TABLE_ICONS: Record<string, string> = {
  kpi_library: "#FFB800", broker_commissions: "#00A8FF", claims: "#FF4D6D",
  evidence_artifacts: "#A855F7", transforms: "#00FF94", derived_metrics: "#00A8FF",
  decision_receipts: "#00FF94", logs: "#6B7280", users: "#FFB800",
  watchlist_items: "#FF4D6D", vault_documents: "#A855F7",
  sec_submissions: "#00A8FF", sec_numeric: "#00FF94",
  sec_presentations: "#FFB800", sec_tags: "#A855F7", sec_ingestion_log: "#6B7280",
};

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function fmtBytes(n: number) {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(2) + " GB";
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + " MB";
  if (n >= 1_024) return (n / 1_024).toFixed(1) + " KB";
  return n.toLocaleString() + " B";
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "text-[#00FF94] bg-[#00FF94]/10 border-[#00FF94]/30",
    POST: "text-[#FFB800] bg-[#FFB800]/10 border-[#FFB800]/30",
    PUT: "text-[#00A8FF] bg-[#00A8FF]/10 border-[#00A8FF]/30",
    PATCH: "text-[#A855F7] bg-[#A855F7]/10 border-[#A855F7]/30",
    DELETE: "text-[#FF4D6D] bg-[#FF4D6D]/10 border-[#FF4D6D]/30",
  };
  return (
    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${colors[method] ?? "text-zinc-400 bg-[var(--kiq-surface)] border-[var(--kiq-hairline)]"}`}>
      {method}
    </span>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, accent, children }: {
  title: string; icon: React.ElementType; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--kiq-hairline)]/60">
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
        <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: accent }}>
          {title}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/50 rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-2xl font-black mt-1 font-mono" style={{ color: accent }}>
        {typeof value === "number" ? fmtNum(value) : value}
      </p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-[#00FF94]" : "bg-[#FF4D6D]"}`} />
  );
}

function TableRow({ t }: { t: DBTable }) {
  const accent = TABLE_ICONS[t.name] ?? "#6B7280";
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-900/60 last:border-0"
      data-testid={`table-row-${t.name}`}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent }} />
      <span className="flex-1 text-xs font-mono text-[var(--kiq-ink-soft)]">{TABLE_LABELS[t.name] ?? t.name}</span>
      <span className="text-[10px] font-mono text-zinc-500 w-16 text-right">{fmtNum(t.rowCount)} rows</span>
      <span className="text-[10px] font-mono text-zinc-600 w-12 text-right">{t.totalSize}</span>
      <span className="text-[10px] font-mono text-zinc-700 w-6 text-right">{t.colCount}c</span>
    </div>
  );
}

// ─── Route Group ─────────────────────────────────────────────────────────────

function RouteGroup({ prefix, routes }: { prefix: string; routes: APIRoute[] }) {
  const [open, setOpen] = useState(false);
  const manifestCount = routes.filter(r => r.manifestCompliant).length;
  return (
    <div className="border border-[var(--kiq-hairline)]/50 rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-[var(--kiq-canvas-soft)]/50 hover:bg-[var(--kiq-surface)]/40 transition-colors"
        data-testid={`route-group-${prefix.replace(/\//g, "-")}`}
      >
        <span className="text-xs font-mono text-[#00A8FF] flex-1 text-left">{prefix}</span>
        {manifestCount > 0 && (
          <span
            className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            title={`${manifestCount} export endpoint(s) ship a SHA-256 evidence manifest (Hard Rule #03)`}
            data-testid={`badge-manifest-count-${prefix.replace(/\//g, "-")}`}
          >
            {manifestCount} · SHA-256
          </span>
        )}
        <span className="text-[10px] font-mono text-zinc-500">{routes.length} endpoints</span>
        {open ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
      </button>
      {open && (
        <div className="bg-[var(--kiq-surface)]/60 divide-y divide-zinc-900/40">
          {routes.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2">
              <div className="flex gap-1 flex-shrink-0">
                {r.methods.map(m => <MethodBadge key={m} method={m} />)}
              </div>
              <span className="text-[11px] font-mono text-[var(--kiq-muted)] flex-1">{r.path}</span>
              {r.manifestCompliant && (
                <span
                  className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  title="Hard Rule #03 — export carries a SHA-256 evidence manifest (in-zip manifest.json or X-Kincaid-SHA256 sidecar header)"
                  data-testid={`badge-manifest-${r.path.replace(/[^a-z0-9]/gi, "-")}`}
                >
                  SHA-256
                </span>
              )}
              {r.name && <span className="text-[9px] font-mono text-zinc-600">{r.name}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Seed Control ─────────────────────────────────────────────────────────────

function SeedButton({ label, endpoint, accent }: {
  label: string; endpoint: string; accent: string;
}) {
  const qc = useQueryClient();
  const { mutate, isPending, isSuccess, isError } = useMutation({
    mutationFn: () => apiRequest("POST", endpoint),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/tables"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });
  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--kiq-canvas-soft)]/50 border border-[var(--kiq-hairline)]/50 rounded-xl px-4 py-3">
      <div>
        <p className="text-xs font-mono text-[var(--kiq-ink-soft)]">{label}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{endpoint}</p>
      </div>
      <div className="flex items-center gap-2">
        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF94]" />}
        {isError && <XCircle className="w-3.5 h-3.5 text-[#FF4D6D]" />}
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest border transition-all hover:opacity-80 disabled:opacity-40"
          style={{ color: accent, borderColor: `${accent}40`, background: `${accent}10` }}
          data-testid={`btn-seed-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <RefreshCw className={`w-3 h-3 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Seeding…" : "Reseed"}
        </button>
      </div>
    </div>
  );
}

// ─── Snapshot Retention Card ─────────────────────────────────────────────────

function SnapshotRetentionCard({ s }: { s?: SnapshotStorage }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/snapshot-retention/prune"),
    onSuccess: async (res: any) => {
      const purged = res?.deleted_total ?? 0;
      toast({ title: "Snapshot prune complete", description: `${purged} snapshot blob(s) purged.` });
      qc.invalidateQueries({ queryKey: ["/api/admin/tables"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (e: any) => toast({ title: "Prune failed", description: String(e?.message ?? e), variant: "destructive" }),
  });

  return (
    <div className="mt-4 border-t border-[var(--kiq-hairline)]/40 pt-4" data-testid="card-snapshot-retention">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">Delivery Snapshot Storage</p>
          <p className="text-xs font-mono text-[var(--kiq-muted)]">
            <span data-testid="text-snapshot-count">{fmtNum(s?.snapshotCount ?? 0)}</span> snapshot blobs ·{" "}
            <span data-testid="text-snapshot-bytes">{fmtBytes(s?.snapshotBytes ?? 0)}</span>
          </p>
          <p className="text-[10px] text-zinc-600 mt-1">
            Retention: keep last {s?.maxPerRecipient ?? "—"} per recipient · purge older than {s?.retentionDays ?? "—"} days · auto-prunes daily 04:00 UTC
          </p>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest border transition-all hover:opacity-80 disabled:opacity-40"
          style={{ color: "#FF4D6D", borderColor: "#FF4D6D40", background: "#FF4D6D10" }}
          data-testid="btn-prune-snapshots"
        >
          <RefreshCw className={`w-3 h-3 ${isPending ? "animate-spin" : ""}`} />
          {isPending ? "Pruning…" : "Prune Now"}
        </button>
      </div>
    </div>
  );
}

// ─── User Management Component ───────────────────────────────────────────────

interface UserRow { id: string; username: string; email: string | null; full_name: string | null; created_at: string | null; is_admin: boolean }

function UserManagement() {
  const [showCreate, setShowCreate] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", email: "", full_name: "", password: "" });
  const [newPass, setNewPass] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery<UserRow[]>({ queryKey: ["/api/admin/users"] });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiRequest("POST", "/api/admin/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowCreate(false);
      setForm({ username: "", email: "", full_name: "", password: "" });
      toast({ title: "User created", description: `${form.username} can now log in.` });
    },
    onError: async (e: any) => {
      const msg = await e.response?.text?.() || "Failed to create user";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User deleted" }); },
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/reset-password`, { new_password: password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setResetUserId(null);
      setNewPass("");
      toast({ title: "Password reset", description: "User can now log in with the new password." });
    },
    onError: () => toast({ title: "Reset failed", variant: "destructive" }),
  });

  return (
    <SectionCard title={`User Management — ${users.length} accounts`} icon={Users} accent="#00A8FF">
      <div className="space-y-4">
        {/* Create User Button */}
        <div className="flex justify-between items-center">
          <p className="text-xs text-zinc-500">Only you can create accounts. Public registration is disabled.</p>
          <button
            data-testid="button-create-user"
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#00A8FF]/10 hover:bg-[#00A8FF]/20 border border-[#00A8FF]/30 rounded-lg text-xs text-[#00A8FF] font-medium transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            {showCreate ? "Cancel" : "Create User"}
          </button>
        </div>

        {/* Create User Form */}
        {showCreate && (
          <div className="bg-[var(--kiq-canvas-soft)] rounded-xl p-4 border border-[var(--kiq-hairline)] space-y-3">
            <p className="text-sm font-semibold text-[var(--kiq-ink)] mb-2">New User Account</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Username *</label>
                <input data-testid="input-new-username"
                  className="w-full bg-[var(--kiq-surface)] border border-zinc-600 rounded-lg px-3 py-2 text-sm text-[var(--kiq-ink)] placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]"
                  placeholder="jane.smith" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Full Name</label>
                <input data-testid="input-new-fullname"
                  className="w-full bg-[var(--kiq-surface)] border border-zinc-600 rounded-lg px-3 py-2 text-sm text-[var(--kiq-ink)] placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]"
                  placeholder="Jane Smith" value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Email</label>
                <input data-testid="input-new-email"
                  type="email"
                  className="w-full bg-[var(--kiq-surface)] border border-zinc-600 rounded-lg px-3 py-2 text-sm text-[var(--kiq-ink)] placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]"
                  placeholder="jane@company.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Password *</label>
                <input data-testid="input-new-password"
                  type="password"
                  className="w-full bg-[var(--kiq-surface)] border border-zinc-600 rounded-lg px-3 py-2 text-sm text-[var(--kiq-ink)] placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]"
                  placeholder="Temporary password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
            <button
              data-testid="button-submit-create-user"
              onClick={() => createMutation.mutate(form)}
              disabled={!form.username || !form.password || createMutation.isPending}
              className="w-full py-2 bg-[#00A8FF] hover:bg-[#00A8FF]/80 disabled:opacity-40 rounded-lg text-sm font-semibold text-[var(--kiq-ink)] transition-colors"
            >
              {createMutation.isPending ? "Creating…" : "Create Account"}
            </button>
          </div>
        )}

        {/* User List */}
        {isLoading ? (
          <p className="text-xs text-zinc-500">Loading users…</p>
        ) : (
          <div className="space-y-1">
            {users.map((u) => (
              <div key={u.id} data-testid={`user-row-${u.username}`}
                className="flex items-center gap-3 bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50 group">
                <div className="w-7 h-7 rounded-full bg-[var(--kiq-surface)] flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0">
                  {(u.full_name || u.username).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--kiq-ink)] font-medium">{u.username}</span>
                    {u.is_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#FFB800]/10 text-[#FFB800] border border-[#FFB800]/20 rounded-full font-semibold">ADMIN</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{u.full_name || u.email || "—"}</p>
                </div>
                <p className="text-xs text-zinc-600 hidden sm:block">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                </p>
                {!u.is_admin && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      data-testid={`button-reset-${u.username}`}
                      onClick={() => { setResetUserId(u.id); setNewPass(""); }}
                      className="px-2 py-1 text-xs bg-[var(--kiq-surface)] hover:bg-zinc-700 border border-[var(--kiq-hairline)] rounded-lg text-zinc-400 transition-colors"
                    >
                      Reset PW
                    </button>
                    <button
                      data-testid={`button-delete-user-${u.username}`}
                      onClick={() => { if (confirm(`Delete ${u.username}?`)) deleteMutation.mutate(u.id); }}
                      className="px-2 py-1 text-xs bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 rounded-lg text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Password Reset Modal */}
        {resetUserId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-[var(--kiq-canvas-soft)] rounded-2xl p-6 border border-[var(--kiq-hairline)] w-full max-w-sm space-y-4">
              <p className="text-[var(--kiq-ink)] font-semibold">Reset Password</p>
              <p className="text-xs text-zinc-500">Enter a new password for this user.</p>
              <input
                data-testid="input-reset-password"
                type="password"
                className="w-full bg-[var(--kiq-surface)] border border-zinc-600 rounded-lg px-3 py-2 text-sm text-[var(--kiq-ink)] placeholder-zinc-600 focus:outline-none focus:border-[#00A8FF]"
                placeholder="New password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={() => setResetUserId(null)}
                  className="flex-1 py-2 bg-[var(--kiq-surface)] hover:bg-zinc-700 rounded-lg text-sm text-zinc-400 transition-colors">
                  Cancel
                </button>
                <button
                  data-testid="button-confirm-reset"
                  disabled={!newPass || resetMutation.isPending}
                  onClick={() => resetMutation.mutate({ id: resetUserId!, password: newPass })}
                  className="flex-1 py-2 bg-[#00A8FF] hover:bg-[#00A8FF]/80 disabled:opacity-40 rounded-lg text-sm font-semibold text-[var(--kiq-ink)] transition-colors">
                  {resetMutation.isPending ? "Resetting…" : "Set Password"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── RFP Scoring Config Editor ───────────────────────────────────────────────

interface RfpScoringData {
  active: Record<string, any>;
  defaults: Record<string, any>;
  override: Record<string, any> | null;
  envOverrideActive: boolean;
  overridePath: string;
  weightSumTolerance: number;
}

const SCORING_SECTION_LABELS: Record<string, string> = {
  weights: "Composite Weights (must sum to ~1.0)",
  tier_thresholds: "Tier Thresholds (strictly descending)",
  high_value_industries: "High-Value Industries",
  complex_plan_types: "Complex Plan Types",
  revenue: "Revenue Potential — Band Cutoffs",
  strategic_value: "Strategic Value",
  win_probability: "Win Probability",
  relationship_strength: "Relationship Strength",
  competitive_intensity: "Competitive Intensity",
  data_availability: "Data Availability",
  implementation_complexity: "Implementation Complexity",
  confidence: "Confidence Gate",
};

const SCORING_SECTION_ORDER = [
  "weights", "tier_thresholds", "high_value_industries", "complex_plan_types",
  "revenue", "strategic_value", "win_probability", "relationship_strength",
  "competitive_intensity", "data_availability", "implementation_complexity",
  "confidence",
];

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function getPath(obj: any, path: (string | number)[]): any {
  return path.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function setPath(obj: any, path: (string | number)[], value: any): any {
  const next = deepClone(obj);
  let cur = next;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
  return next;
}

function ScoringNumberField({ value, onChange, testId }: {
  value: number; onChange: (n: number) => void; testId: string;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  useEffect(() => {
    if (Number(text) !== value) setText(Number.isFinite(value) ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const bad = text.trim() === "" || Number.isNaN(Number(text));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={e => {
        setText(e.target.value);
        const n = e.target.value.trim() === "" ? NaN : Number(e.target.value);
        onChange(n);
      }}
      data-testid={testId}
      className={`w-full bg-[var(--kiq-canvas-soft)]/60 border rounded-md px-2 py-1 text-[11px] font-mono text-[var(--kiq-ink-soft)] focus:outline-none ${
        bad ? "border-[#FF4D6D]/70 focus:border-[#FF4D6D]" : "border-[var(--kiq-hairline)]/60 focus:border-zinc-600"
      }`}
    />
  );
}

function ScoringListField({ value, onChange, testId }: {
  value: string[]; onChange: (v: string[]) => void; testId: string;
}) {
  const [text, setText] = useState((value || []).join(", "));
  useEffect(() => {
    const parsed = text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (JSON.stringify(parsed) !== JSON.stringify(value)) setText((value || []).join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <textarea
      rows={2}
      value={text}
      onChange={e => {
        setText(e.target.value);
        onChange(e.target.value.split(/[,\n]/).map(s => s.trim()).filter(Boolean));
      }}
      data-testid={testId}
      placeholder="comma-separated values"
      className="w-full bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/60 rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--kiq-ink-soft)] placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-y"
    />
  );
}

function ScoringFields({ node, path, draft, onChange }: {
  node: any; path: (string | number)[]; draft: any; onChange: (path: (string | number)[], v: any) => void;
}) {
  const entries = Object.entries(node);
  const numberEntries = entries.filter(([, v]) => typeof v === "number");
  const listEntries = entries.filter(([, v]) => Array.isArray(v));
  const dictEntries = entries.filter(([, v]) => v && typeof v === "object" && !Array.isArray(v));

  return (
    <div className="space-y-3">
      {numberEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
          {numberEntries.map(([k]) => {
            const p = [...path, k];
            const tid = p.join("-");
            return (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-zinc-500 truncate" title={k}>{k}</span>
                <ScoringNumberField
                  value={getPath(draft, p)}
                  onChange={n => onChange(p, n)}
                  testId={`input-scoring-${tid}`}
                />
              </label>
            );
          })}
        </div>
      )}
      {listEntries.map(([k]) => {
        const p = [...path, k];
        return (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-[9px] font-mono text-zinc-500">{k}</span>
            <ScoringListField
              value={getPath(draft, p)}
              onChange={v => onChange(p, v)}
              testId={`input-scoring-${p.join("-")}`}
            />
          </label>
        );
      })}
      {dictEntries.map(([k, v]) => (
        <div key={k} className="border-l border-[var(--kiq-hairline)]/50 pl-3">
          <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-2">{k}</p>
          <ScoringFields node={v} path={[...path, k]} draft={draft} onChange={onChange} />
        </div>
      ))}
    </div>
  );
}

function ScoringEditor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<RfpScoringData>({ queryKey: ["/api/admin/rfp-scoring"] });

  const [draft, setDraft] = useState<Record<string, any> | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed the draft from the active config once it loads.
  useEffect(() => {
    if (data?.active && draft === null) setDraft(deepClone(data.active));
  }, [data, draft]);

  const tolerance = data?.weightSumTolerance ?? 0.01;

  const weightSum = useMemo(() => {
    const w = draft?.weights ?? {};
    return Object.values(w).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  }, [draft]);
  const weightSumOk = Math.abs(weightSum - 1.0) <= tolerance + 1e-9;

  const isDirty = useMemo(
    () => !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.active),
    [draft, data]
  );

  // Live (server-side) validation — same rules as startup — debounced.
  useEffect(() => {
    if (!draft) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest("POST", "/api/admin/rfp-scoring/validate", { config: draft });
        const json = await res.json();
        setProblems(json?.problems ?? []);
      } catch {
        /* network hiccup — keep last known problems */
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/admin/rfp-scoring", { config: draft });
      return res.json();
    },
    onSuccess: (json: any) => {
      toast({ title: "Scoring config saved", description: "Applied live — no restart needed." });
      setProblems([]);
      if (json?.active) setDraft(deepClone(json.active));
      qc.invalidateQueries({ queryKey: ["/api/admin/rfp-scoring"] });
    },
    onError: (e: any) => {
      // apiRequest throws Error("<status>: <body>"); body is FastAPI {detail:{...}}
      let detail: any = null;
      const msg = String(e?.message ?? e);
      const json = msg.slice(msg.indexOf(":") + 1).trim();
      try { detail = JSON.parse(json)?.detail; } catch { /* not JSON */ }
      const probs = detail?.problems;
      if (Array.isArray(probs)) setProblems(probs);
      toast({ title: "Save rejected", description: detail?.message ?? msg, variant: "destructive" });
    },
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/rfp-scoring/reset");
      return res.json();
    },
    onSuccess: (json: any) => {
      toast({ title: "Reset to defaults", description: "Override cleared and reloaded live." });
      setProblems([]);
      if (json?.active) setDraft(deepClone(json.active));
      qc.invalidateQueries({ queryKey: ["/api/admin/rfp-scoring"] });
    },
    onError: (e: any) => toast({ title: "Reset failed", description: String(e?.message ?? e), variant: "destructive" }),
  });

  if (isLoading || !draft || !data) {
    return <p className="text-xs text-zinc-600 text-center py-6">Loading scoring config…</p>;
  }

  const hasProblems = problems.length > 0;
  const sections = SCORING_SECTION_ORDER.filter(k => k in draft)
    .concat(Object.keys(draft).filter(k => !SCORING_SECTION_ORDER.includes(k)));

  return (
    <div className="space-y-4" data-testid="rfp-scoring-editor">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="status-weight-sum"
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
              weightSumOk
                ? "text-[#00FF94] border-[#00FF94]/40 bg-[#00FF94]/10"
                : "text-[#FF4D6D] border-[#FF4D6D]/40 bg-[#FF4D6D]/10"
            }`}
          >
            weights Σ = {weightSum.toFixed(4)} {weightSumOk ? "✓" : `(need 1.0 ±${tolerance})`}
          </span>
          <span
            data-testid="status-validation"
            className={`text-[10px] font-mono px-2 py-1 rounded-full border ${
              hasProblems
                ? "text-[#FF4D6D] border-[#FF4D6D]/40 bg-[#FF4D6D]/10"
                : "text-[#00FF94] border-[#00FF94]/40 bg-[#00FF94]/10"
            }`}
          >
            {hasProblems ? `${problems.length} issue(s)` : "valid"}
          </span>
          {data.override && (
            <span className="text-[10px] font-mono px-2 py-1 rounded-full border text-[#FFB800] border-[#FFB800]/40 bg-[#FFB800]/10">
              admin override active
            </span>
          )}
          {isDirty && (
            <span className="text-[10px] font-mono px-2 py-1 rounded-full border text-[#00A8FF] border-[#00A8FF]/40 bg-[#00A8FF]/10">
              unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            data-testid="btn-scoring-reset"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest border transition-all hover:opacity-80 disabled:opacity-40 text-zinc-400 border-[var(--kiq-hairline)] bg-[var(--kiq-surface)]/40"
          >
            <RotateCcw className={`w-3 h-3 ${resetMut.isPending ? "animate-spin" : ""}`} />
            Reset to Defaults
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || hasProblems || !isDirty}
            data-testid="btn-scoring-save"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest border transition-all hover:opacity-80 disabled:opacity-40"
            style={{ color: "#00FF94", borderColor: "#00FF9440", background: "#00FF9410" }}
          >
            <Save className="w-3 h-3" />
            {saveMut.isPending ? "Saving…" : "Save & Reload"}
          </button>
        </div>
      </div>

      {data.envOverrideActive && (
        <div className="flex items-start gap-2 text-[10px] font-mono text-[#FFB800] bg-[#FFB800]/10 border border-[#FFB800]/30 rounded-lg px-3 py-2" data-testid="warn-env-override">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            An <span className="font-bold">RFP_SCORING_CONFIG</span> env var is set — it takes precedence on restart.
            Edits apply live now but will be shadowed by the env var after a restart.
          </span>
        </div>
      )}

      {hasProblems && (
        <div className="text-[10px] font-mono text-[#FF4D6D] bg-[#FF4D6D]/10 border border-[#FF4D6D]/30 rounded-lg px-3 py-2 space-y-0.5" data-testid="list-scoring-problems">
          {problems.map((p, i) => <div key={i}>• {p}</div>)}
        </div>
      )}

      {/* Editable sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map(key => (
          <div key={key} className="bg-[var(--kiq-canvas-soft)]/40 border border-[var(--kiq-hairline)]/50 rounded-xl p-4" data-testid={`scoring-section-${key}`}>
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mb-3">
              {SCORING_SECTION_LABELS[key] ?? key}
            </p>
            {Array.isArray(draft[key]) ? (
              <ScoringListField
                value={draft[key]}
                onChange={v => setDraft(d => setPath(d, [key], v))}
                testId={`input-scoring-${key}`}
              />
            ) : typeof draft[key] === "object" && draft[key] !== null ? (
              <ScoringFields
                node={draft[key]}
                path={[key]}
                draft={draft}
                onChange={(p, v) => setDraft(d => setPath(d, p, v))}
              />
            ) : (
              <ScoringNumberField
                value={draft[key]}
                onChange={n => setDraft(d => setPath(d, [key], n))}
                testId={`input-scoring-${key}`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminView() {
  const [routeFilter, setRouteFilter] = useState("");
  const [pageCategory, setPageCategory] = useState("All");

  const { data: stats } = useQuery<PlatformStats>({ queryKey: ["/api/admin/stats"] });
  const { data: tables = [] } = useQuery<DBTable[]>({ queryKey: ["/api/admin/tables"] });
  const { data: routes = [] } = useQuery<APIRoute[]>({ queryKey: ["/api/admin/routes"] });
  const { data: config } = useQuery<ConfigData>({ queryKey: ["/api/admin/config"] });
  const { data: rfpHealth } = useQuery<RfpScoringHealth>({ queryKey: ["/api/admin/rfp-scoring-health"] });
  const { data: logs = [] } = useQuery<LogEntry[]>({ queryKey: ["/api/admin/logs"] });
  const { data: health } = useQuery<{ status: string; database: { ok: boolean } }>({
    queryKey: ["/api/admin/health"],
    refetchInterval: 15_000,
  });

  // Group API routes by prefix
  const routeGroups: Record<string, APIRoute[]> = {};
  routes.forEach(r => {
    if (routeFilter && !r.path.toLowerCase().includes(routeFilter.toLowerCase())) return;
    const parts = r.path.split("/");
    const prefix = parts.slice(0, 3).join("/") || "/";
    (routeGroups[prefix] ??= []).push(r);
  });

  // Filter frontend pages
  const filteredPages = FRONTEND_PAGES.filter(
    p => pageCategory === "All" || p.category === pageCategory
  );

  const totalDbRows = tables.reduce((s, t) => s + Math.max(0, t.rowCount), 0);

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-[#A855F7]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A855F7]">
                Administration Panel
              </span>
              {health && (
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ml-2 ${health.status === "healthy"
                  ? "text-[#00FF94] border-[#00FF94]/40 bg-[#00FF94]/10"
                  : "text-[#FF4D6D] border-[#FF4D6D]/40 bg-[#FF4D6D]/10"
                }`}>
                  {health.status.toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-[var(--kiq-ink)] tracking-tight">Kincaid Health Control Room</h1>
            <p className="text-xs text-zinc-500 mt-1">
              {stats?.client} · Platform v{stats?.version ?? "2.0.0"} · Uptime {stats?.uptimeHuman ?? "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-zinc-600">{stats?.serverTime?.slice(0, 19).replace("T", " ")} UTC</p>
            <p className="text-[10px] font-mono text-zinc-700 mt-0.5">{stats?.stack}</p>
          </div>
        </div>

        {/* ── Top Stats Strip ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatTile label="Frontend Routes"  value={stats?.frontendRoutes  ?? 73}  accent="#00A8FF" />
          <StatTile label="Frontend Pages"   value={stats?.frontendPages   ?? 75}  accent="#00FF94" />
          <StatTile label="Backend Routers"  value={stats?.backendRouters  ?? 23}  accent="#A855F7" />
          <StatTile label="DB Tables"        value={stats?.tableCount      ?? 16}  accent="#FFB800" />
          <StatTile label="Total DB Rows"    value={totalDbRows || stats?.totalRows || 0} accent="#00FF94" sub="across all tables" />
          <StatTile label="Database Size"    value={stats?.dbSize          ?? "—"} accent="#00A8FF" />
          <StatTile label="Python"           value={`v${stats?.pythonVersion ?? "3.x"}`} accent="#6B7280" />
        </div>

        {/* ── System Health + AI Providers ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="System Health" icon={Activity} accent="#00FF94">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50" data-testid="health-database">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#00A8FF]" />
                  <span className="text-xs font-mono text-[var(--kiq-muted)]">PostgreSQL</span>
                </div>
                <StatusDot ok={health?.database.ok ?? true} />
              </div>
              <div className="flex items-center justify-between bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50" data-testid="health-backend">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#A855F7]" />
                  <span className="text-xs font-mono text-[var(--kiq-muted)]">FastAPI</span>
                </div>
                <StatusDot ok={true} />
              </div>
              <div className="flex items-center justify-between bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50" data-testid="health-frontend">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#00FF94]" />
                  <span className="text-xs font-mono text-[var(--kiq-muted)]">Vite Frontend</span>
                </div>
                <StatusDot ok={true} />
              </div>
              <div className="flex items-center justify-between bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-3 border border-[var(--kiq-hairline)]/50" data-testid="health-session">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#FFB800]" />
                  <span className="text-xs font-mono text-[var(--kiq-muted)]">Session Auth</span>
                </div>
                <StatusDot ok={true} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="AI Providers & Integrations" icon={Bot} accent="#A855F7">
            <div className="space-y-2">
              {[
                { label: "OpenAI GPT-4",     key: "openai",    icon: Zap,        accent: "#00FF94", from: config?.aiProviders },
                { label: "Anthropic Claude",  key: "anthropic", icon: Bot,        accent: "#A855F7", from: config?.aiProviders },
                { label: "GitHub OAuth",      key: "github",    icon: GitBranch,  accent: "#6B7280", from: config?.integrations },
                { label: "PostgreSQL DB",     key: "database",  icon: Database,   accent: "#00A8FF", from: config?.integrations },
              ].map(({ label, key, icon: Icon, accent, from }) => (
                <div key={key}
                  className="flex items-center justify-between bg-[var(--kiq-canvas-soft)]/50 rounded-xl px-4 py-2.5 border border-[var(--kiq-hairline)]/50"
                  data-testid={`provider-${key}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                    <span className="text-xs font-mono text-[var(--kiq-muted)]">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot ok={from ? from[key] : false} />
                    <span className={`text-[10px] font-mono ${from?.[key] ? "text-[#00FF94]" : "text-zinc-600"}`}>
                      {from?.[key] ? "CONFIGURED" : "NOT SET"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── User Management ────────────────────────────────────────────── */}
        <UserManagement />

        {/* ── Database Tables ────────────────────────────────────────────── */}
        <SectionCard title="Database Tables" icon={Database} accent="#FFB800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
            {tables.length > 0
              ? tables.map(t => <TableRow key={t.name} t={t} />)
              : (
                <div className="col-span-2 text-center text-zinc-600 text-xs py-6">
                  Loading table metadata…
                </div>
              )
            }
          </div>
          <div className="mt-4 flex items-center gap-6 border-t border-[var(--kiq-hairline)]/40 pt-4">
            <span className="text-[10px] font-mono text-zinc-600">
              {tables.length} tables · {fmtNum(totalDbRows)} total rows · {stats?.dbSize ?? "—"} on disk
            </span>
          </div>
          <SnapshotRetentionCard s={stats?.snapshotStorage} />
        </SectionCard>

        {/* ── Environment & Config ───────────────────────────────────────── */}
        <SectionCard title="Environment & Config" icon={Settings2} accent="#00A8FF">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">Environment Variables</p>
              <div className="space-y-1.5">
                {config ? Object.entries(config.variables).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-zinc-900/40 last:border-0"
                    data-testid={`env-var-${k.toLowerCase()}`}>
                    <span className="text-[10px] font-mono text-zinc-500">{k}</span>
                    <span className={`text-[10px] font-mono ${v ? "text-[#00FF94]" : "text-[#FF4D6D]"}`}>
                      {v ?? "— not set —"}
                    </span>
                  </div>
                )) : <p className="text-[10px] text-zinc-600">Loading…</p>}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-3">Seeding Controls</p>
              <div className="space-y-2">
                <SeedButton
                  label="KPI Library"
                  endpoint="/api/kpi-library/reseed"
                  accent="#FFB800"
                />
                <SeedButton
                  label="Broker Commissions"
                  endpoint="/api/admin/seed/broker-commissions"
                  accent="#00A8FF"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── RFP Opportunity Scoring Editor ─────────────────────────────── */}
        <SectionCard title="RFP Opportunity Scoring — Live Tuning" icon={SlidersHorizontal} accent="#A855F7">
          <ScoringEditor />
        </SectionCard>

        {/* ── RFP Scoring Config Health ──────────────────────────────────── */}
        <SectionCard title="RFP Scoring Configuration" icon={Wrench} accent="#A855F7">
          {!rfpHealth ? (
            <p className="text-[10px] text-zinc-600">Loading…</p>
          ) : (() => {
            const ok = rfpHealth.status === "applied";
            const isDefaults = rfpHealth.status === "defaults";
            const color = ok ? "#00FF94" : isDefaults ? "#FFB800" : "#FF4D6D";
            const label = ok
              ? "Custom override ACTIVE"
              : isDefaults
                ? "Built-in defaults"
                : "Override REJECTED — using defaults";
            return (
              <div className="space-y-4" data-testid="rfp-scoring-health">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className="text-xs font-mono font-semibold tracking-wide"
                    style={{ color }}
                    data-testid="text-rfp-scoring-status"
                  >
                    {label}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400" data-testid="text-rfp-scoring-message">
                  {rfpHealth.message}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 py-1 border-b border-zinc-900/40">
                    <span className="text-[10px] font-mono text-zinc-500">SOURCE</span>
                    <span className="text-[10px] font-mono text-[var(--kiq-muted)]">
                      {rfpHealth.source ?? "— none —"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-1 border-b border-zinc-900/40">
                    <span className="text-[10px] font-mono text-zinc-500">OVERRIDE PRESENT</span>
                    <span className={`text-[10px] font-mono ${rfpHealth.override_present ? "text-[#00FF94]" : "text-zinc-500"}`}>
                      {rfpHealth.override_present ? "yes" : "no"}
                    </span>
                  </div>
                </div>
                {rfpHealth.override_keys.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                      Overridden Keys
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {rfpHealth.override_keys.map(k => (
                        <span
                          key={k}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/60 text-[var(--kiq-muted)]"
                          data-testid={`rfp-override-key-${k}`}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {rfpHealth.problems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#FF4D6D] mb-2">
                      Problems ({rfpHealth.problems.length}) — offending keys
                    </p>
                    <ul className="space-y-1">
                      {rfpHealth.problems.map((p, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[11px] font-mono text-[#FF4D6D]"
                          data-testid={`rfp-problem-${i}`}
                        >
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </SectionCard>

        {/* ── API Route Registry ─────────────────────────────────────────── */}
        <SectionCard title={`API Route Registry — ${routes.length} endpoints`} icon={Network} accent="#00FF94">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={routeFilter}
              onChange={e => setRouteFilter(e.target.value)}
              placeholder="Filter routes…"
              className="flex-1 bg-[var(--kiq-canvas-soft)]/60 border border-[var(--kiq-hairline)]/60 rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--kiq-ink-soft)] placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              data-testid="input-route-filter"
            />
            {routeFilter && (
              <button onClick={() => setRouteFilter("")}
                className="text-[10px] font-mono text-zinc-500 hover:text-[var(--kiq-muted)]">
                ✕ clear
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto pr-1">
            {Object.keys(routeGroups).length > 0
              ? Object.entries(routeGroups)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([prefix, rs]) => (
                    <RouteGroup key={prefix} prefix={prefix} routes={rs} />
                  ))
              : <p className="text-xs text-zinc-600 text-center py-6">No routes match filter.</p>
            }
          </div>
        </SectionCard>

        {/* ── File Hash Verifier ──────────────────────────────────────────── */}
        <SectionCard title="Verify a Downloaded File — SHA-256 (Hard Rule #03)" icon={Hash} accent="#00FF94">
          <FileHashVerifier />
        </SectionCard>

        {/* ── Frontend Page Registry ──────────────────────────────────────── */}
        <SectionCard title={`Frontend Page Registry — ${FRONTEND_PAGES.length} pages`} icon={Layers} accent="#00A8FF">
          <div className="flex flex-wrap gap-2 mb-4">
            {["All", ...PAGE_CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setPageCategory(cat)}
                data-testid={`filter-category-${cat.toLowerCase()}`}
                className="text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all"
                style={pageCategory === cat
                  ? { color: CATEGORY_COLORS[cat] ?? "#00A8FF", borderColor: (CATEGORY_COLORS[cat] ?? "#00A8FF") + "60", background: (CATEGORY_COLORS[cat] ?? "#00A8FF") + "18" }
                  : { color: "#6B7280", borderColor: "#3f3f4620" }
                }
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredPages.map(p => (
              <div key={p.path}
                className="flex items-center gap-3 bg-[var(--kiq-canvas-soft)]/40 border border-[var(--kiq-hairline)]/40 rounded-xl px-3 py-2"
                data-testid={`page-item-${p.path.replace(/\//g, "").replace(/-/g, "_")}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: CATEGORY_COLORS[p.category] ?? "#6B7280" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-[var(--kiq-ink-soft)] truncate">{p.label}</p>
                  <p className="text-[9px] font-mono text-zinc-600">{p.path}</p>
                </div>
                <span className="text-[9px] font-mono text-zinc-700 flex-shrink-0">{p.category}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── AI Query Log ──────────────────────────────────────────────────── */}
        <SectionCard title="AI Query Log" icon={Terminal} accent="#A855F7">
          {logs.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">No AI queries logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {logs.map(l => (
                <div key={l.id}
                  className="bg-[var(--kiq-canvas-soft)]/50 border border-[var(--kiq-hairline)]/40 rounded-xl px-4 py-3"
                  data-testid={`log-entry-${l.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-[#A855F7] uppercase">{l.provider}</span>
                    <span className="text-[9px] font-mono text-zinc-600">
                      {l.createdAt?.slice(0, 19).replace("T", " ")} UTC
                    </span>
                  </div>
                  {l.prompt && (
                    <p className="text-[11px] text-zinc-400 font-mono truncate">
                      Q: {l.prompt.slice(0, 120)}{l.prompt.length > 120 ? "…" : ""}
                    </p>
                  )}
                  {l.responseSnippet && (
                    <p className="text-[10px] text-zinc-600 mt-0.5 truncate">
                      A: {l.responseSnippet.slice(0, 150)}{l.responseSnippet.length > 150 ? "…" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

      </div>
    </Layout>
  );
}
