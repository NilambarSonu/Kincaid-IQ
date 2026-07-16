import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { FileHashVerifier } from "./FileHashVerifier";
import { useLastDownload, shortHash } from "@/hooks/use-manifest-download";

const openListeners = new Set<() => void>();

export function openFileVerifier() {
  openListeners.forEach((fn) => fn());
}

export function FileVerifierLauncher() {
  const [open, setOpen] = useState(false);
  const lastDownload = useLastDownload();

  useEffect(() => {
    const fn = () => setOpen(true);
    openListeners.add(fn);
    return () => {
      openListeners.delete(fn);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="kiq-floating-icon-button fixed bottom-[5.25rem] right-6 z-40 transition-all duration-200 active:scale-95"
        style={{
          cursor: "pointer",
        }}
        title="Verify a file you downloaded against its SHA-256 evidence record"
        data-testid="button-open-file-verifier"
      >
        <ShieldCheck size={22} />
        <span className="kiq-floating-label is-above">Verify a file</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] no-print"
          style={{ background: "rgba(15,23,42,0.32)", backdropFilter: "blur(18px)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          data-testid="file-verifier-overlay"
        >
          <div
            className="w-full max-w-[520px] mx-4 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.72) 100%)",
              border: "1px solid rgba(15,23,42,0.10)",
              boxShadow:
                "0 34px 90px rgba(15,23,42,0.22), 0 0 0 1px rgba(255,255,255,0.72) inset, 0 0 60px rgba(0,255,148,0.12)",
              maxHeight: "76vh",
            }}
            data-testid="file-verifier-modal"
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{
                borderBottom: "1px solid rgba(15,23,42,0.08)",
                background: "rgba(255,255,255,0.78)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} style={{ color: "rgba(0,255,148,0.85)" }} />
                <div>
                  <div className="text-sm font-bold text-slate-900">Verify a Downloaded File</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                    Hard Rule #03 · Evidence Manifest
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-zinc-500 hover:text-slate-700 transition-colors"
                data-testid="button-close-file-verifier"
                aria-label="Close verifier"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar p-5">
              {lastDownload?.sha256 && (
                <div
                  className="mb-4 flex items-center gap-2 rounded-lg border border-[#00FF94]/25 bg-[#00FF94]/5 px-3 py-2"
                  data-testid="text-prefilled-from-last-download"
                >
                  <ShieldCheck size={13} className="text-[#00FF94] flex-shrink-0" />
                  <span className="text-[11px] font-mono text-zinc-400">
                    Pre-filled from your last download:{" "}
                    <span className="text-slate-700">{lastDownload.filename}</span> ·{" "}
                    {shortHash(lastDownload.sha256)}
                  </span>
                </div>
              )}
              <FileHashVerifier
                key={lastDownload?.sha256 || "empty"}
                defaultExpected={lastDownload?.sha256 || ""}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
