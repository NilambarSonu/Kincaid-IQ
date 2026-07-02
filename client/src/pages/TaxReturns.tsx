import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Upload, FileText, Download, Trash2, BrainCircuit, X, ChevronDown, ChevronUp, Loader2, CheckCircle, AlertTriangle, Lock } from "lucide-react";

interface VaultDoc {
  id: number;
  filename: string;
  original_filename: string;
  category: string;
  description: string | null;
  linked_asset: string | null;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

interface AnalysisResult {
  doc_id: number;
  filename: string;
  tax_year: string | null;
  openai: string;
  anthropic: string;
  text_extracted: boolean;
}

const TAX_YEARS = ["FY 2025", "FY 2024", "FY 2023", "FY 2022", "FY 2021", "FY 2020", "FY 2019"];
const FILING_TYPES = [
  "Federal 1040", "Federal 1040 (MFJ)", "Indiana IT-40", "New York IT-201",
  "California 540", "Trust 1041", "Partnership 1065", "Corporate 1120S", "K-1 Schedule",
];

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-xs leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ") || line.startsWith("**") && line.endsWith("**")) {
          const content = line.replace(/^\#{1,3}\s*/, "").replace(/\*\*/g, "");
          return <p key={i} className="font-bold mt-3 mb-1 text-sm" style={{ color: "#00A8FF" }}>{content}</p>;
        }
        if (line.match(/^\*\*.*\*\*$/)) {
          return <p key={i} className="font-bold text-white mt-2">{line.replace(/\*\*/g, "")}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <p key={i} className="pl-3 flex gap-2"><span style={{ color: "rgba(0,168,255,0.5)" }}>·</span><span className="text-muted-foreground">{line.slice(2)}</span></p>;
        }
        if (line.match(/^\d+\.\s/)) {
          const content = line.replace(/^\d+\.\s/, "");
          const num = line.match(/^(\d+)\./)?.[1];
          return <p key={i} className="flex gap-2"><span className="font-bold flex-shrink-0" style={{ color: "#FFB800" }}>{num}.</span><span className="text-muted-foreground">{content}</span></p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        const boldified = line.replace(/\*\*([^*]+)\*\*/g, `<strong class="text-white">$1</strong>`);
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: boldified }} />;
      })}
    </div>
  );
}

export default function TaxReturns() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [taxYear, setTaxYear] = useState("FY 2024");
  const [filingType, setFilingType] = useState("Federal 1040");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [analysisPanel, setAnalysisPanel] = useState<AnalysisResult | null>(null);
  const [expandedEngine, setExpandedEngine] = useState<"openai" | "anthropic" | null>("anthropic");
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  const { data: allDocs = [], isLoading } = useQuery<VaultDoc[]>({
    queryKey: ["/api/vault"],
    enabled: isAuthenticated,
  });

  const taxDocs = allDocs.filter((d) => d.category === "Tax Return")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("category", "Tax Return");
      fd.append("linked_asset", taxYear);
      fd.append("description", [filingType, notes].filter(Boolean).join(" — "));
      const res = await fetch("/api/vault", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(e.detail || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vault"] });
      setSelectedFile(null);
      setNotes("");
      setTaxYear("FY 2024");
      setFilingType("Federal 1040");
      setUploadError(null);
    },
    onError: (e: any) => setUploadError(e.message || "Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/vault/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vault"] }),
  });

  const handleAnalyze = async (doc: VaultDoc) => {
    setAnalyzingId(doc.id);
    setAnalysisPanel(null);
    try {
      const res = await fetch(`/api/vault/${doc.id}/analyze`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(e.detail || "Analysis failed");
      }
      const data = await res.json();
      setAnalysisPanel(data);
      setExpandedEngine("anthropic");
    } catch (e: any) {
      alert(e.message || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Tax & Analytics</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Tax Return Analysis
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload client tax returns — dual AI engine (GPT-4o + Claude) reads and analyzes each return with fiduciary-grade commentary
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Returns Uploaded", value: `${taxDocs.length}`, color: "#FF4D6D", sub: "Tax Return category" },
          { label: "Years Covered", value: `${new Set(taxDocs.map(d => d.linked_asset).filter(Boolean)).size}`, color: "#FFB800", sub: "Unique tax years" },
          { label: "AI Engine", value: "Dual", color: "#00A8FF", sub: "GPT-4o + Claude" },
          { label: "PDF Extraction", value: "Active", color: "#00FF94", sub: "pypdf text extraction" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-taxr-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {!isAuthenticated && (
        <div className="flex items-center gap-3 p-4 rounded-xl mb-6"
          style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}>
          <Lock size={14} style={{ color: "#FFB800", flexShrink: 0 }} />
          <p className="text-sm text-muted-foreground">
            Sign in to upload and analyze tax returns. Your documents are stored securely in the encrypted vault.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="metric-card" style={{ border: "1px solid rgba(255,77,109,0.15)" }} data-testid="card-tax-upload">
            <div className="flex items-center gap-2 mb-4">
              <Upload size={14} style={{ color: "#FF4D6D" }} />
              <p className="font-bold text-sm text-white">Upload Tax Return</p>
            </div>

            <div
              className="border-2 border-dashed rounded-xl p-8 text-center mb-4 cursor-pointer transition-all duration-200"
              style={{
                borderColor: dragOver ? "rgba(255,77,109,0.5)" : selectedFile ? "rgba(255,77,109,0.35)" : "rgba(255,255,255,0.08)",
                background: dragOver ? "rgba(255,77,109,0.06)" : selectedFile ? "rgba(255,77,109,0.04)" : "transparent",
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              data-testid="dropzone-tax-upload"
            >
              {selectedFile ? (
                <div>
                  <FileText size={28} style={{ color: "#FF4D6D", margin: "0 auto 8px" }} />
                  <p className="text-sm font-semibold" style={{ color: "#FF4D6D" }}>{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatBytes(selectedFile.size)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="mt-2 text-xs text-muted-foreground hover:text-white transition-colors"
                    data-testid="button-clear-file"
                  >
                    Clear ×
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={24} style={{ color: "rgba(255,77,109,0.3)", margin: "0 auto 8px" }} />
                  <p className="text-sm text-muted-foreground">Drop file here or click to select</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT — max 20MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.doc"
                onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
                data-testid="input-tax-file"
              />
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tax Year *</label>
                <select
                  value={taxYear}
                  onChange={(e) => setTaxYear(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  data-testid="select-tax-year"
                >
                  {TAX_YEARS.map((y) => <option key={y} value={y} style={{ background: "#0a0a1a" }}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Filing Type *</label>
                <select
                  value={filingType}
                  onChange={(e) => setFilingType(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  data-testid="select-filing-type"
                >
                  {FILING_TYPES.map((t) => <option key={t} value={t} style={{ background: "#0a0a1a" }}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., includes Schedule K-1 from Sequoia fund"
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  data-testid="input-tax-notes"
                />
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-xs mb-3" style={{ color: "#FF4D6D" }}>
                <AlertTriangle size={11} /> {uploadError}
              </div>
            )}

            <button
              onClick={() => uploadMutation.mutate()}
              disabled={!selectedFile || !isAuthenticated || uploadMutation.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: !selectedFile || !isAuthenticated ? "rgba(255,77,109,0.04)" : "rgba(255,77,109,0.12)",
                border: "1px solid rgba(255,77,109,0.25)",
                color: !selectedFile || !isAuthenticated ? "rgba(255,77,109,0.3)" : "#FF4D6D",
                cursor: !selectedFile || !isAuthenticated ? "not-allowed" : "pointer",
              }}
              data-testid="button-upload-tax"
            >
              {uploadMutation.isPending ? (
                <span className="flex items-center justify-center gap-2"><Loader2 size={13} className="animate-spin" /> Uploading…</span>
              ) : (
                <span className="flex items-center justify-center gap-2"><Upload size={13} /> Upload to Vault</span>
              )}
            </button>

            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle size={10} style={{ color: "#00FF94" }} />
                <span>Documents stored encrypted in secure vault</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <CheckCircle size={10} style={{ color: "#00FF94" }} />
                <span>PDF text extracted automatically for AI analysis</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <CheckCircle size={10} style={{ color: "#00FF94" }} />
                <span>Analysis logged to Transparency Log</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />)}
            </div>
          ) : taxDocs.length === 0 ? (
            <div className="metric-card flex flex-col items-center justify-center py-16"
              style={{ border: "1px dashed rgba(255,77,109,0.15)" }} data-testid="empty-tax-returns">
              <FileText size={36} style={{ color: "rgba(255,77,109,0.2)", marginBottom: 12 }} />
              <p className="text-sm text-muted-foreground">No tax returns uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a PDF and click Analyze to get fiduciary-grade AI analysis</p>
            </div>
          ) : (
            <div className="space-y-3" data-testid="list-tax-returns">
              {taxDocs.map((doc) => {
                const isAnalyzing = analyzingId === doc.id;
                const isAnalyzed = analysisPanel?.doc_id === doc.id;
                const date = new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const [filingLabel, ...notesParts] = (doc.description || "").split(" — ");
                return (
                  <div key={doc.id} data-testid={`card-tax-${doc.id}`}>
                    <div className="metric-card" style={{ borderLeft: `3px solid ${isAnalyzed ? "#00A8FF" : "#FF4D6D"}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
                          <FileText size={15} style={{ color: "#FF4D6D" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white truncate">{doc.original_filename}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {doc.linked_asset && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,184,0,0.08)", color: "#FFB800", border: "1px solid rgba(255,184,0,0.2)" }}>
                                {doc.linked_asset}
                              </span>
                            )}
                            {filingLabel && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(255,77,109,0.07)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.18)" }}>
                                {filingLabel}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">{date}</span>
                            {doc.file_size && <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>}
                          </div>
                          {notesParts.length > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{notesParts.join(" — ")}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleAnalyze(doc)}
                            disabled={isAnalyzing || !isAuthenticated}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: isAnalyzed ? "rgba(0,168,255,0.1)" : "rgba(0,168,255,0.08)",
                              border: `1px solid ${isAnalyzed ? "rgba(0,168,255,0.35)" : "rgba(0,168,255,0.2)"}`,
                              color: isAuthenticated ? "#00A8FF" : "rgba(0,168,255,0.3)",
                              cursor: isAuthenticated ? "pointer" : "not-allowed",
                            }}
                            data-testid={`button-analyze-${doc.id}`}
                          >
                            {isAnalyzing
                              ? <><Loader2 size={10} className="animate-spin" /> Analyzing…</>
                              : <><BrainCircuit size={10} /> {isAnalyzed ? "Re-Analyze" : "Analyze"}</>}
                          </button>
                          <a href={`/api/vault/${doc.id}/download`} target="_blank" rel="noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                            style={{ color: "rgba(0,168,255,0.5)" }}
                            data-testid={`button-download-${doc.id}`}>
                            <Download size={13} />
                          </a>
                          <button
                            onClick={() => { if (analysisPanel?.doc_id === doc.id) setAnalysisPanel(null); deleteMutation.mutate(doc.id); }}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                            style={{ color: "rgba(255,77,109,0.4)" }}
                            data-testid={`button-delete-${doc.id}`}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isAnalyzed && analysisPanel && (
                      <div className="mt-2 rounded-xl overflow-hidden"
                        style={{ border: "1px solid rgba(0,168,255,0.15)", background: "rgba(0,168,255,0.02)" }}
                        data-testid="panel-analysis">
                        <div className="flex items-center justify-between px-4 py-3"
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="flex items-center gap-2">
                            <BrainCircuit size={13} style={{ color: "#00A8FF" }} />
                            <p className="text-sm font-bold text-white">AI Analysis — {analysisPanel.filename}</p>
                            {!analysisPanel.text_extracted && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: "rgba(255,184,0,0.08)", color: "#FFB800", border: "1px solid rgba(255,184,0,0.2)" }}>
                                Metadata-based
                              </span>
                            )}
                          </div>
                          <button onClick={() => setAnalysisPanel(null)}
                            className="text-muted-foreground hover:text-white transition-colors"
                            data-testid="button-close-analysis">
                            <X size={13} />
                          </button>
                        </div>

                        {(["anthropic", "openai"] as const).map((engine) => {
                          const label = engine === "openai" ? "GPT-4o (OpenAI)" : "Claude Opus (Anthropic)";
                          const engineColor = engine === "openai" ? "#00FF94" : "#00A8FF";
                          const isExpanded = expandedEngine === engine;
                          return (
                            <div key={engine} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <button
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                                onClick={() => setExpandedEngine(isExpanded ? null : engine)}
                                data-testid={`toggle-${engine}`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{ background: engineColor }} />
                                  <span className="text-xs font-semibold" style={{ color: engineColor }}>{label}</span>
                                </div>
                                {isExpanded ? <ChevronUp size={12} style={{ color: "rgba(130,150,200,0.4)" }} /> : <ChevronDown size={12} style={{ color: "rgba(130,150,200,0.4)" }} />}
                              </button>
                              {isExpanded && (
                                <div className="px-4 pb-4">
                                  <MarkdownText text={analysisPanel[engine]} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
