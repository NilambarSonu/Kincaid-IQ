import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

export interface UploadedDocument {
  filename: string;
  doc_type: string;
  file_size_bytes: number;
  char_count: number;
  preview: string;
  text: string;
}

interface FileUploadZoneProps {
  onDocumentReady: (doc: UploadedDocument) => void;
  onClear?: () => void;
  accept?: string;
  label?: string;
  hint?: string;
  uploadedDoc?: UploadedDocument | null;
  className?: string;
  compact?: boolean;
}

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv", ".xlsx"];
const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word Document",
  doc: "Word Document",
  csv: "CSV Data",
  xlsx: "Excel Spreadsheet",
  txt: "Text File",
};

function formatBytes(b: number) {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(0)} KB`;
  return `${b} B`;
}

export default function FileUploadZone({
  onDocumentReady,
  onClear,
  accept = ".pdf,.docx,.txt,.csv,.xlsx",
  label = "Upload Document",
  hint,
  uploadedDoc,
  className = "",
  compact = false,
}: FileUploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      const data: UploadedDocument = await res.json();
      onDocumentReady(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [onDocumentReady]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }, [upload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleClear = () => {
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    onClear?.();
  };

  if (uploadedDoc) {
    return (
      <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-3 ${className}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{uploadedDoc.filename}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
              {TYPE_LABELS[uploadedDoc.doc_type] || uploadedDoc.doc_type.toUpperCase()}
            </span>
            <span className="text-xs text-zinc-500">{formatBytes(uploadedDoc.file_size_bytes)} · {uploadedDoc.char_count.toLocaleString()} chars</span>
          </div>
          {uploadedDoc.preview && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{uploadedDoc.preview}</p>
          )}
        </div>
        <button
          onClick={handleClear}
          className="text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
          data-testid="upload-clear-btn"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={className}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
          data-testid="upload-file-input"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 transition-all text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          data-testid="upload-compact-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {loading ? "Processing…" : label}
        </button>
        {error && (
          <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
        data-testid="upload-file-input"
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !loading && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragging
            ? "border-blue-400 bg-blue-500/10"
            : "border-white/15 hover:border-white/30 bg-white/[0.02] hover:bg-white/[0.04]"
          }
          ${loading ? "pointer-events-none" : ""}
        `}
        data-testid="upload-dropzone"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
            <p className="text-sm text-zinc-400">Extracting content…</p>
          </div>
        ) : (
          <>
            <Upload className={`w-7 h-7 mx-auto mb-2 ${dragging ? "text-blue-400" : "text-zinc-500"}`} />
            <p className="text-sm font-medium text-zinc-300">{label}</p>
            {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
            <p className="text-xs text-zinc-600 mt-2">
              {ACCEPTED_EXTENSIONS.join(" · ")} · up to 20 MB
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
