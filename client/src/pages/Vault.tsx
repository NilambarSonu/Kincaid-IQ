import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderLock, Upload, FileText, Trash2, Download, X, ChevronDown, Filter } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/mockData";

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

const CATEGORIES = ["K-1", "Statement", "Trust Document", "Deal Document", "Tax Return", "Legal", "Other"];
const ASSETS = ["Sequoia Capital Fund XVIII", "KKR Americas XII", "432 Park Avenue Penthouse", "Mayfair Office Complex", "Helios Energy Partners", "NovaCare Health Systems", "Whitmore Family Irrevocable Trust", "Other"];

const CATEGORY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  "K-1":              { color: "#00FF94", bg: "rgba(0,255,148,0.07)", border: "rgba(0,255,148,0.2)" },
  "Statement":        { color: "#00A8FF", bg: "rgba(0,168,255,0.07)", border: "rgba(0,168,255,0.2)" },
  "Trust Document":   { color: "#A855F7", bg: "rgba(168,85,247,0.07)", border: "rgba(168,85,247,0.2)" },
  "Deal Document":    { color: "#FFB800", bg: "rgba(255,184,0,0.07)", border: "rgba(255,184,0,0.2)" },
  "Tax Return":       { color: "#FF4D6D", bg: "rgba(255,77,109,0.07)", border: "rgba(255,77,109,0.2)" },
  "Legal":            { color: "#00E5FF", bg: "rgba(0,229,255,0.07)", border: "rgba(0,229,255,0.2)" },
  "Other":            { color: "rgba(150,170,210,0.7)", bg: "rgba(150,170,210,0.05)", border: "rgba(150,170,210,0.15)" },
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function Vault() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Statement");
  const [description, setDescription] = useState("");
  const [linkedAsset, setLinkedAsset] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery<VaultDoc[]>({
    queryKey: ["/api/vault"],
    enabled: isAuthenticated,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("category", category);
      if (description) fd.append("description", description);
      if (linkedAsset) fd.append("linked_asset", linkedAsset);
      const res = await fetch("/api/vault", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(e.detail || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/vault"] });
      setShowUpload(false);
      setSelectedFile(null);
      setDescription("");
      setLinkedAsset("");
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

  const filteredDocs = filterCategory === "All" ? docs : docs.filter((d) => d.category === filterCategory);
  const categoryCounts = CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: docs.filter((d) => d.category === c).length }), {} as Record<string, number>);

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Document Management</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              Document Vault
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Secure storage for K-1s, statements, trust docs, and deal documents</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: "#A855F7" }}
            data-testid="button-upload-document"
          >
            <Upload size={14} />
            Upload Document
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="metric-card" style={{ borderTop: "2px solid #A855F7" }} data-testid="card-vault-total">
          <p className="section-label mb-2">Total Documents</p>
          <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "#A855F7" }}>{docs.length}</p>
        </div>
        {["K-1", "Statement", "Tax Return"].map((cat, i) => {
          const colors = ["#00FF94", "#00A8FF", "#FF4D6D"];
          return (
            <div key={cat} className="metric-card" style={{ borderTop: `2px solid ${colors[i]}` }}>
              <p className="section-label mb-2">{cat}s</p>
              <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: colors[i] }}>
                {categoryCounts[cat] || 0}
              </p>
            </div>
          );
        })}
      </div>

      {showUpload && (
        <div className="metric-card mb-6" style={{ border: "1px solid rgba(168,85,247,0.2)" }} data-testid="panel-upload">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm">Upload Document</p>
            <button onClick={() => setShowUpload(false)} data-testid="button-close-upload"><X size={14} className="text-muted-foreground" /></button>
          </div>
          <div
            className="border-2 border-dashed rounded-xl p-8 text-center mb-4 cursor-pointer transition-all"
            style={{ borderColor: selectedFile ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.08)", background: selectedFile ? "rgba(168,85,247,0.05)" : "transparent" }}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <Upload size={24} style={{ color: selectedFile ? "#A855F7" : "rgba(130,150,200,0.3)" }} className="mx-auto mb-2" />
            {selectedFile ? (
              <div>
                <p className="text-sm font-semibold" style={{ color: "#A855F7" }}>{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatBytes(selectedFile.size)}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">Click to select a file</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX, images — max 20MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
              data-testid="input-file-upload"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="select-category"
              >
                {CATEGORIES.map((c) => <option key={c} value={c} style={{ background: "#0a0a1a" }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Linked Asset</label>
              <select
                value={linkedAsset}
                onChange={(e) => setLinkedAsset(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="select-linked-asset"
              >
                <option value="" style={{ background: "#0a0a1a" }}>None</option>
                {ASSETS.map((a) => <option key={a} value={a} style={{ background: "#0a0a1a" }}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes"
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-description"
              />
            </div>
          </div>
          {uploadError && <p className="text-xs text-red-400 mb-3">{uploadError}</p>}
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || uploadMutation.isPending}
            className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: !selectedFile ? "rgba(168,85,247,0.05)" : "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.25)",
              color: !selectedFile ? "rgba(168,85,247,0.3)" : "#A855F7",
              cursor: !selectedFile ? "not-allowed" : "pointer",
            }}
            data-testid="button-submit-upload"
          >
            {uploadMutation.isPending ? "Uploading…" : "Upload to Vault"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={13} style={{ color: "rgba(130,150,200,0.4)" }} />
        {["All", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className="text-xs px-3 py-1 rounded-lg transition-all"
            style={{
              background: filterCategory === cat ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${filterCategory === cat ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: filterCategory === cat ? "#A855F7" : "rgba(150,170,210,0.6)",
            }}
            data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {cat}{cat !== "All" && categoryCounts[cat] ? ` (${categoryCounts[cat]})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />)}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl" style={{ border: "1px dashed rgba(168,85,247,0.15)" }} data-testid="empty-vault">
          <FolderLock size={32} style={{ color: "rgba(168,85,247,0.2)" }} />
          <p className="text-muted-foreground mt-3 text-sm">No documents {filterCategory !== "All" ? `in "${filterCategory}"` : "yet"}</p>
          <p className="text-xs text-muted-foreground mt-1">Upload K-1s, statements, trust docs and more</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="list-vault">
          {filteredDocs.map((doc) => {
            const cs = CATEGORY_COLORS[doc.category] || CATEGORY_COLORS["Other"];
            const date = new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            return (
              <div key={doc.id} className="metric-card" data-testid={`row-vault-${doc.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: cs.bg, border: `1px solid ${cs.border}` }}>
                      <FileText size={14} style={{ color: cs.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{doc.original_filename}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                          {doc.category}
                        </span>
                        {doc.linked_asset && <span className="text-xs text-muted-foreground">{doc.linked_asset}</span>}
                        <span className="text-xs text-muted-foreground">{date}</span>
                        {doc.file_size && <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>}
                      </div>
                      {doc.description && <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/api/vault/${doc.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg transition-colors hover:bg-blue-500/10"
                      style={{ color: "rgba(0,168,255,0.5)" }}
                      data-testid={`button-download-${doc.id}`}
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: "rgba(255,77,109,0.4)" }}
                      data-testid={`button-delete-vault-${doc.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
