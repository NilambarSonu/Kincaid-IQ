import { useState, useRef, useCallback } from "react";
import { FileCheck2, Upload, CheckCircle2, XCircle, Loader2, Copy, X } from "lucide-react";

function normalizeHash(s: string): string {
  return s.trim().toLowerCase().replace(/^sha-?256[:\s]*/i, "").replace(/\s+/g, "");
}

async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "hashing" }
  | { kind: "done"; computed: string }
  | { kind: "error"; message: string };

export function FileHashVerifier({ defaultExpected = "" }: { defaultExpected?: string } = {}) {
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const [expected, setExpected] = useState(defaultExpected);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setFileSize(file.size);
    setState({ kind: "hashing" });
    try {
      if (!crypto?.subtle?.digest) {
        throw new Error("Web Crypto unavailable — open over HTTPS or localhost.");
      }
      const computed = await sha256OfFile(file);
      setState({ kind: "done", computed });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message || "Failed to hash file." });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const reset = () => {
    setState({ kind: "idle" });
    setFileName(null);
    setFileSize(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const computed = state.kind === "done" ? state.computed : "";
  const expectedNorm = normalizeHash(expected);
  const hasExpected = expectedNorm.length > 0;
  const match = computed && hasExpected && computed === expectedNorm;
  const mismatch = computed && hasExpected && computed !== expectedNorm;

  const fmtSize = (n: number | null) => {
    if (n == null) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4" data-testid="file-hash-verifier">
      <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
        Drop a file you downloaded earlier and paste the SHA-256 we showed when you
        exported it. Your browser hashes the file locally — nothing is uploaded — and
        confirms it still matches the platform's evidence record (Hard Rule #03).
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`kiq-dropzone-glow cursor-pointer rounded-2xl border border-dashed px-4 py-8 text-center transition-all ${
          dragOver
            ? "is-dragging border-[#00A8FF] bg-[#00A8FF]/10 shadow-[0_0_34px_rgba(0,168,255,0.18)]"
            : "border-slate-200/80 bg-white/58 hover:border-[#00A8FF]/50 hover:bg-white/76"
        }`}
        data-testid="dropzone-verify-file"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          data-testid="input-verify-file"
        />
        {fileName ? (
          <div className="flex items-center justify-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#00A8FF]" />
            <span className="text-xs font-mono text-slate-700" data-testid="text-verify-filename">
              {fileName}
            </span>
            <span className="text-[10px] font-mono text-zinc-600">{fmtSize(fileSize)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              className="ml-1 text-zinc-500 hover:text-slate-500"
              data-testid="button-clear-verify-file"
              title="Choose a different file"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Upload className="w-6 h-6 text-[#533afd]" />
            <span className="text-xs font-mono text-slate-600 font-semibold">
              Drop a file here, or click to browse
            </span>
          </div>
        )}
      </div>

      {/* Expected hash input */}
      <div>
        <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">
          Expected SHA-256
        </label>
        <input
          type="text"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="Paste the SHA-256 from the download toast / manifest…"
          className="mt-1.5 w-full bg-white/72 border border-slate-200/80 rounded-xl px-3 py-2.5 text-[11px] font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#533afd] focus:ring-4 focus:ring-[#533afd]/10"
          data-testid="input-expected-hash"
          spellCheck={false}
        />
      </div>

      {/* Status / result */}
      {state.kind === "hashing" && (
        <div
          className="flex items-center gap-2 text-xs font-mono text-zinc-400"
          data-testid="status-verify-hashing"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Computing SHA-256…
        </div>
      )}

      {state.kind === "error" && (
        <div
          className="flex items-center gap-2 rounded-lg border border-[#FF4D6D]/30 bg-[#FF4D6D]/10 px-3 py-2 text-xs font-mono text-[#FF4D6D]"
          data-testid="status-verify-error"
        >
          <XCircle className="w-3.5 h-3.5" />
          {state.message}
        </div>
      )}

      {state.kind === "done" && (
        <div className="space-y-3">
          {/* Verdict */}
          {hasExpected && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
                match
                  ? "border-[#00FF94]/40 bg-[#00FF94]/10 text-[#00FF94]"
                  : "border-[#FF4D6D]/40 bg-[#FF4D6D]/10 text-[#FF4D6D]"
              }`}
              data-testid="status-verify-verdict"
            >
              {match ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                {match ? "Match — file is authentic" : "Mismatch — file does not match"}
              </span>
            </div>
          )}
          {!hasExpected && (
            <p
              className="text-[11px] font-mono text-zinc-500"
              data-testid="status-verify-need-expected"
            >
              Paste an expected hash above to compare.
            </p>
          )}

          {/* Computed hash */}
          <div className="rounded-lg border border-slate-200/60 bg-slate-50/40 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Computed SHA-256
              </span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(computed);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    /* noop */
                  }
                }}
                className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-slate-500"
                data-testid="button-copy-computed-hash"
              >
                <Copy className="w-3 h-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p
              className={`text-[11px] font-mono break-all ${
                mismatch ? "text-[#FF4D6D]" : match ? "text-[#00FF94]" : "text-slate-500"
              }`}
              data-testid="text-computed-hash"
            >
              {computed}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
