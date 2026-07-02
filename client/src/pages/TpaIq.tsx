import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileSearch, Upload, Loader2, ShieldAlert, Scale, Gavel, DollarSign,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight, Trash2,
  RotateCcw, Sparkles, ListChecks, Landmark, FileText,
} from "lucide-react";

type Rating = "excellent" | "good" | "fair" | "concern" | "red_flag";

interface Issue {
  text: string;
  found: boolean;
  status?: string;
  severity?: string;
  confidence?: number;
  quote: string | null;
  gap: string | null;
  explanation?: string | null;
  financial_impact?: string | null;
}
interface Litigation { plaintiff_theory: string; defense_theory: string; erisa_section: string; }
interface Negotiation { gap_summary: string; model_language: string; talking_point: string; }
interface ProvisionScore {
  id: number; name: string; score: number; rating: Rating;
  quick_look: string; incentive_alignment?: number;
  issues: Issue[]; litigation?: Litigation; negotiation?: Negotiation;
}
interface KeyFinding { severity: "critical" | "warning" | "positive"; text: string; }
interface Verdict { grade?: string; conclusion?: string; rationale?: string; }
interface FrameworkScores { [k: string]: number; }
interface ContractListItem {
  id: string; tpa_name: string | null; contract_filename: string;
  status: string; overall_score: number | null; rating: string | null; grade: string | null; created_at: string | null;
}
interface ContractDetail extends ContractListItem {
  error_message: string | null;
  provision_scores: ProvisionScore[];
  key_findings: KeyFinding[];
  framework_scores: FrameworkScores;
  verdict: Verdict;
}

const FRAMEWORK_LABELS: Record<string, string> = {
  contract_risk: "Contract Risk",
  litigation_risk: "Litigation Risk",
  economic_leakage: "Economic Leakage",
  fiduciary_governance: "Fiduciary Governance Risk",
  information_asymmetry: "Information Asymmetry",
  data_lock_in: "Data Lock-In",
  operational_risk: "Operational Risk",
};

const GRADE_LABELS: Record<string, string> = {
  fiduciary: "Fiduciary-Grade",
  institutional: "Institutional",
  commercial: "Commercial",
  substandard: "Substandard",
  litigation_sensitive: "Litigation-Sensitive",
};

const CONCLUSION_LABELS: Record<string, string> = {
  yes: "YES — Execute",
  yes_with_modifications: "YES — With Modifications",
  no: "NO — Do Not Execute As-Is",
};

function ratingColor(rating?: string): string {
  switch (rating) {
    case "excellent": return "hsl(142 70% 45%)";
    case "good": return "hsl(142 60% 50%)";
    case "fair": return "hsl(45 90% 55%)";
    case "concern": return "hsl(30 90% 55%)";
    default: return "hsl(0 80% 60%)";
  }
}
function severityColor(sev?: string): string {
  switch ((sev || "").toLowerCase()) {
    case "critical": return "hsl(0 80% 60%)";
    case "high": return "hsl(20 90% 58%)";
    case "medium": return "hsl(45 90% 55%)";
    default: return "hsl(210 10% 60%)";
  }
}

export default function TpaIq() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [openProvision, setOpenProvision] = useState<number | null>(null);

  const { data: contracts = [] } = useQuery<ContractListItem[]>({
    queryKey: ["/api/tpa-iq/contracts"],
    refetchInterval: (q) => {
      const list = (q.state.data as ContractListItem[]) || [];
      return list.some((c) => c.status === "pending" || c.status === "analyzing") ? 2500 : false;
    },
  });

  const activeId = selectedId || contracts[0]?.id || null;

  const { data: detail } = useQuery<ContractDetail>({
    queryKey: ["/api/tpa-iq/contracts", activeId],
    enabled: !!activeId,
    refetchInterval: (q) => {
      const d = q.state.data as ContractDetail | undefined;
      return d && (d.status === "pending" || d.status === "analyzing") ? 2500 : false;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tpa-iq/contracts"] });
  };

  const demoMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/tpa-iq/demo")).json(),
    onSuccess: (data: { id: string }) => {
      setSelectedId(data.id);
      setActiveTab("overview");
      invalidate();
      toast({ title: "Demo analysis started", description: "Forensic examination of a sample TPA agreement is running." });
    },
    onError: (e: any) => toast({ title: "Could not start demo", description: String(e?.message || e), variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const data_b64 = btoa(bin);
      return (await apiRequest("POST", "/api/tpa-iq/upload", {
        filename: file.name, content_type: file.type || "application/octet-stream", data_b64,
      })).json();
    },
    onSuccess: (data: { id: string }) => {
      setSelectedId(data.id);
      setActiveTab("overview");
      invalidate();
      toast({ title: "Contract uploaded", description: "Forensic analysis is running — this takes a few moments." });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/tpa-iq/contracts/${id}/retry`)).json(),
    onSuccess: () => { invalidate(); toast({ title: "Re-running analysis" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/tpa-iq/contracts/${id}`),
    onSuccess: () => {
      if (activeId === selectedId) setSelectedId(null);
      invalidate();
      toast({ title: "Analysis deleted" });
    },
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const isBusy = uploadMutation.isPending || demoMutation.isPending;
  const analyzing = detail && (detail.status === "pending" || detail.status === "analyzing");

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,168,255,0.12)" }}>
                <FileSearch className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">TPA IQ™</h1>
                <p className="text-sm text-muted-foreground">Fiduciary-grade forensic examination of Third-Party Administrator agreements</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={onPickFile} data-testid="input-upload" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isBusy} data-testid="button-upload">
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload TPA Agreement
            </Button>
            <Button onClick={() => demoMutation.mutate()} disabled={isBusy} data-testid="button-demo">
              {demoMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Run Demo Analysis
            </Button>
          </div>
        </div>

        {/* Saved analyses */}
        {contracts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contracts.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedId(c.id); setActiveTab("overview"); }}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors"
                style={{
                  borderColor: activeId === c.id ? "hsl(var(--primary))" : "hsl(var(--border))",
                  background: activeId === c.id ? "rgba(0,168,255,0.08)" : "transparent",
                }}
                data-testid={`tab-contract-${c.id}`}
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="max-w-[180px] truncate">{c.tpa_name || c.contract_filename}</span>
                {c.status === "complete" && c.overall_score != null && (
                  <Badge variant="outline" style={{ borderColor: ratingColor(c.rating || undefined), color: ratingColor(c.rating || undefined) }}>
                    {Math.round(c.overall_score)}
                  </Badge>
                )}
                {(c.status === "pending" || c.status === "analyzing") && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-delete-${c.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!activeId && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <FileSearch className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No TPA agreement analyzed yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Upload a Third-Party Administrator agreement (PDF, DOCX, or TXT) for a fiduciary-grade forensic
                  examination — or run a demo analysis on a sample contract.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isBusy}>
                  <Upload className="w-4 h-4 mr-2" /> Upload
                </Button>
                <Button onClick={() => demoMutation.mutate()} disabled={isBusy}>
                  <Sparkles className="w-4 h-4 mr-2" /> Run Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analyzing state */}
        {analyzing && (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto animate-spin" style={{ color: "hsl(var(--primary))" }} />
              <h3 className="text-lg font-semibold">Forensic analysis in progress…</h3>
              <p className="text-sm text-muted-foreground">Deconstructing the agreement across 13 provision systems, ERISA fiduciary duties, and economic incentive structures.</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {detail && detail.status === "complete" && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="overview" data-testid="tab-overview">Executive Overview</TabsTrigger>
              <TabsTrigger value="provisions" data-testid="tab-provisions">Provision Deep-Dive</TabsTrigger>
              <TabsTrigger value="framework" data-testid="tab-framework">Decision Framework</TabsTrigger>
              <TabsTrigger value="litigation" data-testid="tab-litigation">ERISA Litigation</TabsTrigger>
              <TabsTrigger value="negotiation" data-testid="tab-negotiation">Negotiation & Redline</TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-1">
                  <CardContent className="py-6 flex flex-col items-center justify-center text-center">
                    <div className="text-5xl font-bold" style={{ color: ratingColor(detail.rating || undefined) }} data-testid="text-overall-score">
                      {Math.round(detail.overall_score || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Fiduciary Alignment Score / 100</p>
                    <Badge className="mt-3" variant="outline" style={{ borderColor: ratingColor(detail.rating || undefined), color: ratingColor(detail.rating || undefined) }}>
                      {GRADE_LABELS[detail.grade || ""] || detail.grade || detail.rating}
                    </Badge>
                  </CardContent>
                </Card>
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Gavel className="w-4 h-4" /> Prudent-Fiduciary Verdict
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge
                      className="text-sm"
                      style={{
                        background: detail.verdict?.conclusion === "yes" ? "hsl(142 60% 45%)"
                          : detail.verdict?.conclusion === "yes_with_modifications" ? "hsl(45 90% 50%)"
                          : "hsl(0 80% 58%)",
                        color: detail.verdict?.conclusion === "yes_with_modifications" ? "#1a1a1a" : "white",
                      }}
                      data-testid="badge-verdict"
                    >
                      {CONCLUSION_LABELS[detail.verdict?.conclusion || ""] || "Pending"}
                    </Badge>
                    <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-verdict-rationale">
                      {detail.verdict?.rationale || "No rationale available."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {detail.error_message && (
                <div className="flex items-start gap-2 text-xs p-3 rounded-lg" style={{ background: "rgba(255,180,0,0.08)" }}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-yellow-500 shrink-0" />
                  <span className="text-muted-foreground">{detail.error_message}</span>
                </div>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><ListChecks className="w-4 h-4" /> Key Findings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {detail.key_findings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" data-testid={`finding-${i}`}>
                      {f.severity === "critical" ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(0 80% 60%)" }} />
                        : f.severity === "warning" ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(40 90% 55%)" }} />
                        : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(142 60% 50%)" }} />}
                      <span className="text-muted-foreground">{f.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Provisions ── */}
            <TabsContent value="provisions" className="space-y-3 mt-4">
              {detail.provision_scores.map((p) => (
                <Card key={p.id}>
                  <button
                    className="w-full flex items-center justify-between p-4 text-left"
                    onClick={() => setOpenProvision(openProvision === p.id ? null : p.id)}
                    data-testid={`provision-${p.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {openProvision === p.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-semibold text-sm">{p.id}. {p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {typeof p.incentive_alignment === "number" && (
                        <Badge variant="outline" title="Incentive Alignment (-10 to +10)">
                          IAS {p.incentive_alignment > 0 ? "+" : ""}{p.incentive_alignment}
                        </Badge>
                      )}
                      <Badge variant="outline" style={{ borderColor: ratingColor(p.rating), color: ratingColor(p.rating) }}>
                        {p.score.toFixed(1)}/10
                      </Badge>
                    </div>
                  </button>
                  {openProvision === p.id && (
                    <CardContent className="space-y-3 border-t pt-4">
                      {p.issues.map((iss, i) => (
                        <div key={i} className="text-sm space-y-1 pb-3 border-b last:border-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" style={{ borderColor: severityColor(iss.severity), color: severityColor(iss.severity) }}>
                              {iss.severity || "—"}
                            </Badge>
                            <span className="font-medium">{iss.text}</span>
                            {iss.status && <span className="text-xs text-muted-foreground">· {iss.status}</span>}
                            {iss.financial_impact && (
                              <span className="text-xs flex items-center gap-1" style={{ color: "hsl(30 90% 55%)" }}>
                                <DollarSign className="w-3 h-3" />{iss.financial_impact} <span className="text-muted-foreground">(modeled)</span>
                              </span>
                            )}
                          </div>
                          {iss.quote && <p className="text-xs italic text-muted-foreground pl-1 border-l-2 ml-1" style={{ borderColor: "hsl(var(--border))" }}>“{iss.quote}”</p>}
                          {iss.gap && <p className="text-xs"><span className="font-medium">Gap:</span> {iss.gap}</p>}
                          {iss.explanation && <p className="text-xs text-muted-foreground">{iss.explanation}</p>}
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              ))}
            </TabsContent>

            {/* ── Framework ── */}
            <TabsContent value="framework" className="space-y-6 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Scale className="w-4 h-4" /> Final Decision Framework</CardTitle>
                  <p className="text-xs text-muted-foreground">Seven risk dimensions, each scored 0–100 (higher = greater risk to the plan sponsor).</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(FRAMEWORK_LABELS).map(([key, label]) => {
                    const val = detail.framework_scores?.[key] ?? 0;
                    const color = val >= 70 ? "hsl(0 80% 60%)" : val >= 50 ? "hsl(30 90% 55%)" : val >= 35 ? "hsl(45 90% 55%)" : "hsl(142 60% 50%)";
                    return (
                      <div key={key} className="space-y-1" data-testid={`framework-${key}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{label}</span>
                          <span className="font-semibold" style={{ color }}>{Math.round(val)}</span>
                        </div>
                        <Progress value={val} className="h-2" />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Litigation ── */}
            <TabsContent value="litigation" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> ERISA litigation attack &amp; defense vectors per provision, mapped to the implicated statutory section.</p>
              {detail.provision_scores.filter((p) => p.litigation).map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{p.id}. {p.name}</span>
                      {p.litigation?.erisa_section && p.litigation.erisa_section !== "none" && (
                        <Badge variant="outline">ERISA §{p.litigation.erisa_section}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-lg" style={{ background: "rgba(255,80,80,0.06)" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "hsl(0 75% 62%)" }}>Plaintiff Theory</p>
                      <p className="text-xs text-muted-foreground">{p.litigation?.plaintiff_theory}</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: "rgba(0,168,255,0.06)" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "hsl(var(--primary))" }}>Defense Theory</p>
                      <p className="text-xs text-muted-foreground">{p.litigation?.defense_theory}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* ── Negotiation ── */}
            <TabsContent value="negotiation" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Provision-level redline: the embedded distortion, model contract language to close it, and the leverage to demand it.</p>
              {detail.provision_scores.filter((p) => p.negotiation).map((p) => (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{p.id}. {p.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-xs"><span className="font-semibold">Gap:</span> <span className="text-muted-foreground">{p.negotiation?.gap_summary}</span></p>
                    <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(0,168,255,0.06)" }}>
                      <p className="font-semibold mb-1" style={{ color: "hsl(var(--primary))" }}>Model Language</p>
                      <p className="text-muted-foreground">{p.negotiation?.model_language}</p>
                    </div>
                    <p className="text-xs"><span className="font-semibold">Talking Point:</span> <span className="text-muted-foreground">{p.negotiation?.talking_point}</span></p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}

        {/* Error state */}
        {detail && detail.status === "error" && (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <XCircle className="w-10 h-10 mx-auto" style={{ color: "hsl(0 80% 60%)" }} />
              <h3 className="text-lg font-semibold">Analysis failed</h3>
              <p className="text-sm text-muted-foreground">{detail.error_message || "An unexpected error occurred."}</p>
              <Button variant="outline" onClick={() => retryMutation.mutate(detail.id)} disabled={retryMutation.isPending}>
                <RotateCcw className="w-4 h-4 mr-2" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
