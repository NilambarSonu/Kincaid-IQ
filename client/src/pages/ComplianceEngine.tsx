import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileText, Download, Plus, RefreshCw, Database,
  Search, Filter, ChevronRight, Award, Zap, Github, Globe, Cloud,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Framework {
  id: string;
  label: string;
  control_count: number;
}

interface ControlStats {
  total: number;
  by_status: Record<string, number>;
  by_risk: Record<string, number>;
  score_pct: number;
  tested: number;
}

interface ComplianceControl {
  id: number;
  framework: string;
  control_id: string;
  title: string;
  description: string | null;
  test_procedure: string | null;
  status: string;
  risk_level: string;
  owner: string | null;
  compensating: boolean;
  notes: string | null;
  last_tested_at: string | null;
  created_at: string;
}

interface ComplianceAudit {
  id: number;
  name: string;
  framework: string;
  status: string;
  scope: string | null;
  auditor: string | null;
  started_at: string;
  completed_at: string | null;
  total_controls: number;
  passed: number;
  failed: number;
  not_tested: number;
  score_pct: number | null;
  summary: string | null;
  created_at: string;
}

interface AuditControlResult {
  result_id: number;
  control_id: number;
  control_ref: string | null;
  control_title: string | null;
  risk_level: string | null;
  result: string;
  notes: string | null;
  tested_at: string;
}

interface AuditDetail {
  audit: ComplianceAudit;
  results: AuditControlResult[];
}

interface ComplianceFinding {
  id: number;
  control_id: number | null;
  audit_id: number | null;
  title: string;
  description: string;
  severity: string;
  status: string;
  remediation: string | null;
  due_date: string | null;
  owner: string | null;
  risk_score: number | null;
  created_at: string;
}

interface FindingStats {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  open: number;
  critical_open: number;
}

interface ComplianceAsset {
  id: number;
  name: string;
  asset_type: string;
  description: string | null;
  owner: string | null;
  risk_level: string;
  in_scope: boolean;
  frameworks: string | null;
  criticality: string;
  created_at: string;
}

interface FrameworksResponse {
  frameworks: Framework[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAMEWORKS = [
  { id: "soc2",     label: "SOC 2 Type II",      icon: "🛡️" },
  { id: "iso27001", label: "ISO 27001:2022",      icon: "🔒" },
  { id: "nist_csf", label: "NIST CSF 2.0",        icon: "🏛️" },
  { id: "hipaa",    label: "HIPAA Security Rule",  icon: "⚕️" },
  { id: "pci_dss",  label: "PCI DSS v4.0",         icon: "💳" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pass:         { label: "Pass",         color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  fail:         { label: "Fail",         color: "bg-red-500/15 text-red-400 border-red-500/30",             icon: XCircle },
  compensating: { label: "Compensating", color: "bg-amber-500/15 text-amber-400 border-amber-500/30",       icon: AlertTriangle },
  not_tested:   { label: "Not Tested",   color: "bg-gray-500/15 text-gray-400 border-gray-500/30",          icon: Clock },
  na:           { label: "N/A",          color: "bg-blue-500/15 text-blue-400 border-blue-500/30",          icon: CheckCircle2 },
};

const SEVERITY_CONFIG: Record<string, string> = {
  high:   "bg-red-500/15 text-red-400 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const ASSET_TYPES = [
  "server","workstation","database","application","cloud_service",
  "network_device","storage","mobile_device","saas","api","other",
];

// ── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={110} height={110} className="-rotate-90">
        <circle cx={55} cy={55} r={r} fill="none" stroke="#1e293b" strokeWidth={10} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold" style={{ color }}>{score.toFixed(0)}%</div>
        <div className="text-xs text-muted-foreground">Score</div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ComplianceEngine() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeFramework, setActiveFramework] = useState("soc2");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null);
  const [newAuditOpen, setNewAuditOpen] = useState(false);
  const [newAuditName, setNewAuditName] = useState("");
  const [newAuditScope, setNewAuditScope] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingControl, setEditingControl] = useState<ComplianceControl | null>(null);
  const [controlStatus, setControlStatus] = useState("");
  const [controlNotes, setControlNotes] = useState("");
  const [newAssetOpen, setNewAssetOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("server");
  const [newAssetOwner, setNewAssetOwner] = useState("");
  const [newAssetRisk, setNewAssetRisk] = useState("medium");

  // Collect tab state
  const [collectControlId, setCollectControlId] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubOrg, setGithubOrg] = useState("");
  const [awsKey, setAwsKey] = useState("");
  const [awsSecret, setAwsSecret] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [scanTarget, setScanTarget] = useState("");
  const [scanPorts, setScanPorts] = useState("22,80,443,3306,5432,6379,8080,8443");

  const { data: _frameworksData } = useQuery<FrameworksResponse>({
    queryKey: ["/api/compliance/controls/frameworks"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ControlStats>({
    queryKey: ["/api/compliance/controls/stats", activeFramework],
    queryFn: () =>
      fetch(`/api/compliance/controls/stats?framework=${activeFramework}`, { credentials: "include" })
        .then(r => r.json()) as Promise<ControlStats>,
  });

  const { data: controls, isLoading: ctrlLoading } = useQuery<ComplianceControl[]>({
    queryKey: ["/api/compliance/controls", activeFramework, statusFilter],
    queryFn: () => {
      let url = `/api/compliance/controls?framework=${activeFramework}&limit=200`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      return fetch(url, { credentials: "include" }).then(r => r.json()) as Promise<ComplianceControl[]>;
    },
  });

  const { data: audits } = useQuery<ComplianceAudit[]>({
    queryKey: ["/api/compliance/audits", activeFramework],
    queryFn: () =>
      fetch(`/api/compliance/audits?framework=${activeFramework}`, { credentials: "include" })
        .then(r => r.json()) as Promise<ComplianceAudit[]>,
  });

  const { data: findings } = useQuery<ComplianceFinding[]>({
    queryKey: ["/api/compliance/findings"],
    queryFn: () =>
      fetch(`/api/compliance/findings?status=open`, { credentials: "include" })
        .then(r => r.json()) as Promise<ComplianceFinding[]>,
  });

  const { data: findingStats } = useQuery<FindingStats>({
    queryKey: ["/api/compliance/findings/stats"],
  });

  const { data: assets } = useQuery<ComplianceAsset[]>({
    queryKey: ["/api/compliance/assets"],
  });

  const { data: auditDetail } = useQuery<AuditDetail>({
    queryKey: ["/api/compliance/audits", selectedAuditId, "results"],
    queryFn: () =>
      fetch(`/api/compliance/audits/${selectedAuditId}/results`, { credentials: "include" })
        .then(r => r.json()) as Promise<AuditDetail>,
    enabled: !!selectedAuditId,
  });

  const seedMut = useMutation({
    mutationFn: (fw: string) => apiRequest("POST", `/api/compliance/controls/seed/${fw}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls"] });
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls/stats"] });
      toast({ title: "Controls seeded", description: `${activeFramework.toUpperCase()} library loaded` });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  const createAuditMut = useMutation({
    mutationFn: (body: { name: string; framework: string; scope?: string }) =>
      apiRequest("POST", "/api/compliance/audits", body).then(r => r.json() as Promise<ComplianceAudit>),
    onSuccess: (data: ComplianceAudit) => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/audits"] });
      setNewAuditOpen(false);
      setSelectedAuditId(data.id);
      setActiveTab("audits");
      toast({ title: "Audit created", description: data.name });
    },
    onError: () => toast({ title: "Failed to create audit", variant: "destructive" }),
  });

  const updateControlMut = useMutation({
    mutationFn: (payload: { id: number; status: string; notes: string }) =>
      apiRequest("PATCH", `/api/compliance/controls/${payload.id}`, { status: payload.status, notes: payload.notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls"] });
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls/stats"] });
      setEditingControl(null);
      toast({ title: "Control updated" });
    },
  });

  const updateResultMut = useMutation({
    mutationFn: (payload: { auditId: number; resultId: number; result: string }) =>
      apiRequest("PATCH", `/api/compliance/audits/${payload.auditId}/results/${payload.resultId}`, {
        result: payload.result,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/audits", selectedAuditId, "results"] });
      qc.invalidateQueries({ queryKey: ["/api/compliance/audits"] });
      toast({ title: "Result recorded" });
    },
  });

  const createAssetMut = useMutation({
    mutationFn: (body: { name: string; asset_type: string; owner?: string; risk_level: string }) =>
      apiRequest("POST", "/api/compliance/assets", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/assets"] });
      setNewAssetOpen(false);
      toast({ title: "Asset added" });
    },
  });

  const closeFindingMut = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/compliance/findings/${id}`, { status: "closed" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/findings"] });
      qc.invalidateQueries({ queryKey: ["/api/compliance/findings/stats"] });
      toast({ title: "Finding closed" });
    },
  });

  const seedAllMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/compliance/controls/seed-all", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls"] });
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls/stats"] });
      toast({ title: "All frameworks seeded", description: "Controls loaded for every framework" });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  interface EvidenceResult { id: number; filename: string; evidence_type: string | null; source: string | null; hash_val: string | null; }

  const githubMfaMut = useMutation({
    mutationFn: (body: { control_id: number; github_token: string; org_name: string }) =>
      apiRequest("POST", "/api/compliance/evidence/collect/github-mfa", body).then(r => r.json() as Promise<EvidenceResult>),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls"] });
      toast({ title: "GitHub MFA evidence collected", description: `Saved as ${data.filename}` });
    },
    onError: (e: unknown) => toast({ title: "Collection failed", description: e instanceof Error ? e.message : "GitHub MFA check failed", variant: "destructive" }),
  });

  const awsIamMut = useMutation({
    mutationFn: (body: { control_id: number; aws_access_key: string; aws_secret_key: string; aws_region: string }) =>
      apiRequest("POST", "/api/compliance/evidence/collect/aws-iam", body).then(r => r.json() as Promise<EvidenceResult>),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls"] });
      toast({ title: "AWS IAM evidence collected", description: `Saved as ${data.filename}` });
    },
    onError: (e: unknown) => toast({ title: "Collection failed", description: e instanceof Error ? e.message : "AWS IAM pull failed", variant: "destructive" }),
  });

  const networkScanMut = useMutation({
    mutationFn: (body: { control_id: number; target: string; ports: string }) =>
      apiRequest("POST", "/api/compliance/evidence/collect/network-scan", body).then(r => r.json() as Promise<EvidenceResult>),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/compliance/controls"] });
      toast({ title: "Network scan evidence collected", description: `Saved as ${data.filename}` });
    },
    onError: (e: unknown) => toast({ title: "Scan failed", description: e instanceof Error ? e.message : "Network scan failed", variant: "destructive" }),
  });

  const filteredControls = (controls || []).filter(c =>
    !searchTerm ||
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.control_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedFw = FRAMEWORKS.find(f => f.id === activeFramework);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Compliance Engine</h1>
                <p className="text-sm text-muted-foreground">SOC 2 · ISO 27001 · NIST CSF · HIPAA · PCI DSS</p>
              </div>
            </div>
            <Dialog open={newAuditOpen} onOpenChange={setNewAuditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2" data-testid="button-new-audit">
                  <Plus className="h-4 w-4" /> New Audit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Audit — {selectedFw?.label}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Audit Name</label>
                    <Input
                      data-testid="input-audit-name"
                      placeholder={`${selectedFw?.label} Audit Q2 2026`}
                      value={newAuditName}
                      onChange={e => setNewAuditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">Scope</label>
                    <Textarea
                      data-testid="input-audit-scope"
                      placeholder="Describe the scope of this audit..."
                      rows={3}
                      value={newAuditScope}
                      onChange={e => setNewAuditScope(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-create-audit"
                    className="w-full"
                    disabled={!newAuditName || createAuditMut.isPending}
                    onClick={() => createAuditMut.mutate({
                      name: newAuditName,
                      framework: activeFramework,
                      scope: newAuditScope || undefined,
                    })}
                  >
                    {createAuditMut.isPending ? "Creating..." : "Create Audit"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {FRAMEWORKS.map(fw => (
              <button
                key={fw.id}
                data-testid={`button-framework-${fw.id}`}
                onClick={() => { setActiveFramework(fw.id); setStatusFilter("all"); setSearchTerm(""); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  activeFramework === fw.id
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                    : "bg-card border-border text-muted-foreground hover:border-blue-500/30 hover:text-foreground"
                }`}
              >
                {fw.icon} {fw.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6" data-testid="tabs-compliance">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="controls" data-testid="tab-controls">Controls</TabsTrigger>
              <TabsTrigger value="audits" data-testid="tab-audits">Audits</TabsTrigger>
              <TabsTrigger value="findings" data-testid="tab-findings">
                Findings{findingStats && findingStats.open > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                    {findingStats.open}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="assets" data-testid="tab-assets">Assets</TabsTrigger>
              <TabsTrigger value="collect" data-testid="tab-collect">
                <Zap className="h-3.5 w-3.5 mr-1" />
                Auto-Collect
              </TabsTrigger>
            </TabsList>

            {/* Dashboard */}
            <TabsContent value="dashboard">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                  <CardHeader><CardTitle className="text-sm">Compliance Score</CardTitle></CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    {statsLoading ? (
                      <div className="h-28 w-28 rounded-full border-8 border-muted animate-pulse" />
                    ) : (
                      <ScoreRing score={stats?.score_pct ?? 0} />
                    )}
                    <div className="w-full space-y-2">
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                        const count = stats?.by_status?.[key] ?? 0;
                        const Icon = cfg.icon;
                        return (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">{cfg.label}</span>
                            </div>
                            <span className="font-medium text-foreground" data-testid={`status-count-${key}`}>{count}</span>
                          </div>
                        );
                      })}
                      <div className="pt-1 border-t border-border flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Total Controls</span>
                        <span data-testid="status-count-total">{stats?.total ?? 0}</span>
                      </div>
                    </div>
                    {!controls?.length ? (
                      <Button
                        size="sm" className="w-full gap-2"
                        disabled={seedMut.isPending}
                        onClick={() => seedMut.mutate(activeFramework)}
                        data-testid="button-load-controls"
                      >
                        {seedMut.isPending ? "Loading..." : `Load ${selectedFw?.label} Library`}
                      </Button>
                    ) : (
                      <Button
                        size="sm" variant="outline" className="w-full gap-2"
                        disabled={seedMut.isPending}
                        onClick={() => seedMut.mutate(activeFramework)}
                        data-testid="button-seed-controls"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Reseed Controls
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Audits — {selectedFw?.label}</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => setNewAuditOpen(true)} data-testid="button-new-audit-dashboard">
                      <Plus className="h-3.5 w-3.5 mr-1" /> New
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!audits?.length ? (
                      <div className="py-10 text-center text-muted-foreground text-sm">
                        No audits yet. Start your first audit for {selectedFw?.label}.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {audits.map(audit => (
                          <div
                            key={audit.id}
                            data-testid={`card-audit-${audit.id}`}
                            className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-blue-500/30 cursor-pointer transition-all"
                            onClick={() => { setSelectedAuditId(audit.id); setActiveTab("audits"); }}
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{audit.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {audit.total_controls} controls · {audit.passed} passed · {audit.failed} failed
                              </div>
                            </div>
                            <div className="flex items-center gap-3 ml-3 shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-semibold" style={{
                                  color: (audit.score_pct ?? 0) >= 80 ? "#10b981" :
                                         (audit.score_pct ?? 0) >= 60 ? "#f59e0b" : "#ef4444"
                                }}>
                                  {(audit.score_pct ?? 0).toFixed(1)}%
                                </div>
                                <div className="text-xs text-muted-foreground capitalize">{audit.status}</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Risk Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(["high", "medium", "low"] as const).map(k => {
                        const label = k === "high" ? "High Risk" : k === "medium" ? "Medium Risk" : "Low Risk";
                        const count = stats?.by_risk?.[k] ?? 0;
                        const total = stats?.total ?? 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={k}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium" data-testid={`risk-count-${k}`}>{count}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: k === "high" ? "#ef4444" : k === "medium" ? "#f59e0b" : "#10b981",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-sm">Open Findings</CardTitle></CardHeader>
                  <CardContent>
                    {!findings?.length ? (
                      <div className="py-6 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        No open findings
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {findings.slice(0, 5).map(f => (
                          <div key={f.id} data-testid={`card-finding-${f.id}`}
                            className="flex items-start gap-3 p-2.5 rounded-lg border border-border">
                            <Badge className={`mt-0.5 shrink-0 text-xs ${SEVERITY_CONFIG[f.severity] ?? ""}`}>
                              {f.severity}
                            </Badge>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">{f.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{f.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Controls */}
            <TabsContent value="controls">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-search-controls"
                      className="pl-9"
                      placeholder="Search controls..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40" data-testid="select-status-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="not_tested">Not Tested</SelectItem>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                      <SelectItem value="compensating">Compensating</SelectItem>
                      <SelectItem value="na">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                  {!controls?.length && (
                    <Button size="sm" onClick={() => seedMut.mutate(activeFramework)} disabled={seedMut.isPending}
                      data-testid="button-seed-controls-tab">
                      {seedMut.isPending ? "Loading..." : "Load Framework"}
                    </Button>
                  )}
                </div>

                {ctrlLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : !filteredControls.length ? (
                  <div className="py-16 text-center text-muted-foreground">
                    {!controls?.length
                      ? `Click "Load Framework" to import the ${selectedFw?.label} control library`
                      : "No controls match your filters"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredControls.map(ctrl => {
                      const scfg = STATUS_CONFIG[ctrl.status] ?? STATUS_CONFIG.not_tested;
                      const Icon = scfg.icon;
                      return (
                        <div
                          key={ctrl.id}
                          data-testid={`card-control-${ctrl.id}`}
                          className="flex items-center gap-4 p-3.5 rounded-lg border border-border hover:border-blue-500/30 bg-card transition-all cursor-pointer"
                          onClick={() => {
                            setEditingControl(ctrl);
                            setControlStatus(ctrl.status);
                            setControlNotes(ctrl.notes ?? "");
                          }}
                        >
                          <div className="shrink-0">
                            <Icon className={`h-5 w-5 ${
                              ctrl.status === "pass" ? "text-emerald-400" :
                              ctrl.status === "fail" ? "text-red-400" :
                              ctrl.status === "compensating" ? "text-amber-400" :
                              "text-muted-foreground"
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{ctrl.control_id}</span>
                              <span className="text-sm font-medium truncate">{ctrl.title}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-xs ${SEVERITY_CONFIG[ctrl.risk_level] ?? ""}`}>
                              {ctrl.risk_level}
                            </Badge>
                            <Badge className={`text-xs ${scfg.color}`}>
                              {scfg.label}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Dialog open={!!editingControl} onOpenChange={v => { if (!v) setEditingControl(null); }}>
                {editingControl && (
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-sm font-mono">{editingControl.control_id}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-1">
                      <p className="text-sm font-medium">{editingControl.title}</p>
                      {editingControl.description && (
                        <p className="text-sm text-muted-foreground">{editingControl.description}</p>
                      )}
                      {editingControl.test_procedure && (
                        <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground border border-border">
                          <div className="text-xs font-semibold text-foreground mb-1">Test Procedure</div>
                          {editingControl.test_procedure}
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <Select value={controlStatus} onValueChange={setControlStatus}>
                          <SelectTrigger data-testid="select-control-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_tested">Not Tested</SelectItem>
                            <SelectItem value="pass">Pass</SelectItem>
                            <SelectItem value="fail">Fail</SelectItem>
                            <SelectItem value="compensating">Compensating Control</SelectItem>
                            <SelectItem value="na">Not Applicable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Notes</label>
                        <Textarea
                          data-testid="input-control-notes"
                          rows={3}
                          value={controlNotes}
                          onChange={e => setControlNotes(e.target.value)}
                          placeholder="Add testing notes, evidence references..."
                        />
                      </div>
                      <Button
                        data-testid="button-save-control"
                        className="w-full"
                        disabled={updateControlMut.isPending}
                        onClick={() => updateControlMut.mutate({
                          id: editingControl.id,
                          status: controlStatus,
                          notes: controlNotes,
                        })}
                      >
                        {updateControlMut.isPending ? "Saving..." : "Save Control"}
                      </Button>
                    </div>
                  </DialogContent>
                )}
              </Dialog>
            </TabsContent>

            {/* Audits */}
            <TabsContent value="audits">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Audits</h3>
                    <Button size="sm" variant="outline" onClick={() => setNewAuditOpen(true)}
                      data-testid="button-new-audit-tab">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {!audits?.length ? (
                    <div className="py-8 text-center text-muted-foreground text-sm border border-dashed border-border rounded-lg">
                      No audits yet
                    </div>
                  ) : (
                    audits.map(audit => (
                      <div
                        key={audit.id}
                        data-testid={`card-audit-list-${audit.id}`}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedAuditId === audit.id
                            ? "border-blue-500/50 bg-blue-500/10"
                            : "border-border hover:border-blue-500/30"
                        }`}
                        onClick={() => setSelectedAuditId(audit.id)}
                      >
                        <div className="font-medium text-sm truncate">{audit.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground capitalize">{audit.status}</span>
                          <span className="text-sm font-semibold" style={{
                            color: (audit.score_pct ?? 0) >= 80 ? "#10b981" :
                                   (audit.score_pct ?? 0) >= 60 ? "#f59e0b" : "#ef4444"
                          }}>
                            {(audit.score_pct ?? 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="lg:col-span-2">
                  {!selectedAuditId ? (
                    <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                      Select an audit to view results
                    </div>
                  ) : !auditDetail ? (
                    <div className="py-16 text-center text-muted-foreground">Loading...</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{auditDetail.audit?.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {auditDetail.audit?.total_controls} controls · Score: {(auditDetail.audit?.score_pct ?? 0).toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="gap-2" data-testid="button-download-pdf"
                            onClick={() => window.open(`/api/compliance/reports/${selectedAuditId}/pdf`, "_blank")}>
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2" data-testid="button-download-excel"
                            onClick={() => window.open(`/api/compliance/reports/${selectedAuditId}/excel`, "_blank")}>
                            <Download className="h-3.5 w-3.5" /> Excel
                          </Button>
                          <Button size="sm" variant="outline" className="gap-2" data-testid="button-download-cert"
                            onClick={() => window.open(`/api/compliance/reports/${selectedAuditId}/certificate`, "_blank")}>
                            <Award className="h-3.5 w-3.5" /> Certificate
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                        {auditDetail.results.map(r => {
                          const scfg = STATUS_CONFIG[r.result] ?? STATUS_CONFIG.not_tested;
                          const Icon = scfg.icon;
                          return (
                            <div key={r.result_id} data-testid={`card-audit-result-${r.result_id}`}
                              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                              <Icon className={`h-4 w-4 shrink-0 ${
                                r.result === "pass" ? "text-emerald-400" :
                                r.result === "fail" ? "text-red-400" :
                                r.result === "compensating" ? "text-amber-400" : "text-muted-foreground"
                              }`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{r.control_ref}</span>
                                  <span className="text-sm truncate">{r.control_title}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge className={`text-xs ${SEVERITY_CONFIG[r.risk_level ?? "medium"] ?? ""}`}>
                                  {r.risk_level}
                                </Badge>
                                <Select
                                  value={r.result}
                                  onValueChange={val => updateResultMut.mutate({
                                    auditId: selectedAuditId,
                                    resultId: r.result_id,
                                    result: val,
                                  })}
                                >
                                  <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-result-${r.result_id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_tested">Not Tested</SelectItem>
                                    <SelectItem value="pass">Pass</SelectItem>
                                    <SelectItem value="fail">Fail</SelectItem>
                                    <SelectItem value="compensating">Compensating</SelectItem>
                                    <SelectItem value="na">N/A</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Findings */}
            <TabsContent value="findings">
              <div className="space-y-4">
                {findingStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Total Findings", value: findingStats.total, color: "text-foreground" },
                      { label: "Open", value: findingStats.open, color: "text-red-400" },
                      { label: "Critical Open", value: findingStats.critical_open, color: "text-red-400" },
                      { label: "Closed", value: findingStats.by_status?.closed ?? 0, color: "text-emerald-400" },
                    ].map((s, i) => (
                      <Card key={i}>
                        <CardContent className="pt-4 pb-3">
                          <div className={`text-2xl font-bold ${s.color}`} data-testid={`finding-stat-${i}`}>{s.value}</div>
                          <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {!findings?.length ? (
                  <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                    <div>No open findings. Everything looks good.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {findings.map(f => (
                      <Card key={f.id} data-testid={`card-finding-detail-${f.id}`}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <Badge className={`mt-0.5 shrink-0 text-xs ${SEVERITY_CONFIG[f.severity] ?? ""}`}>
                                {f.severity}
                              </Badge>
                              <div>
                                <div className="font-medium text-sm">{f.title}</div>
                                <div className="text-sm text-muted-foreground mt-1">{f.description}</div>
                                {f.remediation && (
                                  <div className="mt-2 p-2 rounded bg-muted/30 text-xs text-muted-foreground border border-border">
                                    <span className="font-semibold text-foreground">Remediation: </span>
                                    {f.remediation}
                                  </div>
                                )}
                                {f.due_date && (
                                  <div className="text-xs text-muted-foreground mt-2">Due: {f.due_date}</div>
                                )}
                              </div>
                            </div>
                            <Button size="sm" variant="outline"
                              data-testid={`button-close-finding-${f.id}`}
                              onClick={() => closeFindingMut.mutate(f.id)}
                              disabled={closeFindingMut.isPending}>
                              Close
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Assets */}
            <TabsContent value="assets">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">
                    In-Scope Assets ({(assets || []).filter(a => a.in_scope).length})
                  </h3>
                  <Dialog open={newAssetOpen} onOpenChange={setNewAssetOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2" data-testid="button-add-asset">
                        <Plus className="h-4 w-4" /> Add Asset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <Input data-testid="input-asset-name" placeholder="Asset name"
                          value={newAssetName} onChange={e => setNewAssetName(e.target.value)} />
                        <Select value={newAssetType} onValueChange={setNewAssetType}>
                          <SelectTrigger data-testid="select-asset-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASSET_TYPES.map(t => (
                              <SelectItem key={t} value={t}>{t.replace("_", " ").toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input data-testid="input-asset-owner" placeholder="Owner"
                          value={newAssetOwner} onChange={e => setNewAssetOwner(e.target.value)} />
                        <Select value={newAssetRisk} onValueChange={setNewAssetRisk}>
                          <SelectTrigger data-testid="select-asset-risk"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Risk</SelectItem>
                            <SelectItem value="medium">Medium Risk</SelectItem>
                            <SelectItem value="low">Low Risk</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button className="w-full" data-testid="button-save-asset"
                          disabled={!newAssetName || createAssetMut.isPending}
                          onClick={() => createAssetMut.mutate({
                            name: newAssetName,
                            asset_type: newAssetType,
                            owner: newAssetOwner || undefined,
                            risk_level: newAssetRisk,
                          })}>
                          {createAssetMut.isPending ? "Adding..." : "Add Asset"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {!assets?.length ? (
                  <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                    No assets added. Add your systems, services, and data stores to scope.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assets.map(asset => (
                      <Card key={asset.id} data-testid={`card-asset-${asset.id}`}
                        className={asset.in_scope ? "" : "opacity-50"}>
                        <CardContent className="pt-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{asset.name}</span>
                            </div>
                            <Badge className={`text-xs ${SEVERITY_CONFIG[asset.risk_level] ?? ""}`}>
                              {asset.risk_level}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            {asset.asset_type.replace("_", " ").toUpperCase()}
                            {asset.owner && <> · {asset.owner}</>}
                          </div>
                          {!asset.in_scope && (
                            <div className="text-xs text-amber-400 mt-1">Out of scope</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Auto-Collect */}
            <TabsContent value="collect">
              <div className="space-y-6 max-w-3xl">

                {/* Seed All */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Database className="h-4 w-4 text-blue-400" />
                      Seed All Frameworks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Load all 142 controls across SOC 2, ISO 27001, NIST CSF, HIPAA, and PCI DSS in one shot.
                      Existing controls are skipped — this operation is safe to run multiple times.
                    </p>
                    <Button
                      data-testid="btn-seed-all"
                      onClick={() => seedAllMut.mutate()}
                      disabled={seedAllMut.isPending}
                    >
                      {seedAllMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                      Seed All Frameworks
                    </Button>
                  </CardContent>
                </Card>

                {/* Shared control ID selector */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground font-normal">
                      Target Control ID (used by all collectors below)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      data-testid="input-collect-control-id"
                      placeholder="e.g. 42 (numeric DB id of the control)"
                      value={collectControlId}
                      onChange={e => setCollectControlId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Find the control ID on the Controls tab.</p>
                  </CardContent>
                </Card>

                {/* GitHub MFA */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Github className="h-4 w-4 text-purple-400" />
                      GitHub — MFA Enforcement Check
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Verifies whether your GitHub organisation enforces two-factor authentication.
                      Maps to <strong>SOC 2 CC6.1</strong>.
                    </p>
                    <Input
                      data-testid="input-github-token"
                      type="password"
                      placeholder="GitHub personal access token (read:org scope)"
                      value={githubToken}
                      onChange={e => setGithubToken(e.target.value)}
                    />
                    <Input
                      data-testid="input-github-org"
                      placeholder="GitHub organisation name"
                      value={githubOrg}
                      onChange={e => setGithubOrg(e.target.value)}
                    />
                    <Button
                      data-testid="btn-collect-github-mfa"
                      disabled={githubMfaMut.isPending || !githubToken || !githubOrg || !collectControlId}
                      onClick={() => githubMfaMut.mutate({
                        control_id: parseInt(collectControlId, 10),
                        github_token: githubToken,
                        org_name: githubOrg,
                      })}
                    >
                      {githubMfaMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Github className="h-4 w-4 mr-2" />}
                      Collect GitHub MFA Evidence
                    </Button>
                  </CardContent>
                </Card>

                {/* AWS IAM */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Cloud className="h-4 w-4 text-orange-400" />
                      AWS — IAM Policy &amp; MFA Audit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Pulls the AWS account password policy and lists users without MFA devices.
                      Maps to <strong>SOC 2 CC6.1</strong>, <strong>HIPAA §164.312(d)</strong>, <strong>NIST PR.AC-1</strong>.
                    </p>
                    <Input
                      data-testid="input-aws-key"
                      type="password"
                      placeholder="AWS Access Key ID"
                      value={awsKey}
                      onChange={e => setAwsKey(e.target.value)}
                    />
                    <Input
                      data-testid="input-aws-secret"
                      type="password"
                      placeholder="AWS Secret Access Key"
                      value={awsSecret}
                      onChange={e => setAwsSecret(e.target.value)}
                    />
                    <Input
                      data-testid="input-aws-region"
                      placeholder="AWS Region (default: us-east-1)"
                      value={awsRegion}
                      onChange={e => setAwsRegion(e.target.value)}
                    />
                    <Button
                      data-testid="btn-collect-aws-iam"
                      disabled={awsIamMut.isPending || !awsKey || !awsSecret || !collectControlId}
                      onClick={() => awsIamMut.mutate({
                        control_id: parseInt(collectControlId, 10),
                        aws_access_key: awsKey,
                        aws_secret_key: awsSecret,
                        aws_region: awsRegion || "us-east-1",
                      })}
                    >
                      {awsIamMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
                      Collect AWS IAM Evidence
                    </Button>
                  </CardContent>
                </Card>

                {/* Network Scan */}
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Globe className="h-4 w-4 text-green-400" />
                      Network — TCP Port Exposure Scan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Probes a target host for open TCP ports and saves the results as evidence.
                      Maps to <strong>SOC 2 CC7.2</strong>, <strong>NIST DE.CM-1</strong>, <strong>PCI DSS 11.4</strong>.
                    </p>
                    <Input
                      data-testid="input-scan-target"
                      placeholder="Target hostname or IP (e.g. 192.168.1.1)"
                      value={scanTarget}
                      onChange={e => setScanTarget(e.target.value)}
                    />
                    <Input
                      data-testid="input-scan-ports"
                      placeholder="Comma-separated ports"
                      value={scanPorts}
                      onChange={e => setScanPorts(e.target.value)}
                    />
                    <Button
                      data-testid="btn-collect-network-scan"
                      disabled={networkScanMut.isPending || !scanTarget || !collectControlId}
                      onClick={() => networkScanMut.mutate({
                        control_id: parseInt(collectControlId, 10),
                        target: scanTarget,
                        ports: scanPorts,
                      })}
                    >
                      {networkScanMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
                      Run Network Scan
                    </Button>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
