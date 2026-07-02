import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export interface ManifestInfo {
  filename: string;
  sha256: string;
  sizeBytes: number | null;
}

let lastDownloadInfo: ManifestInfo | null = null;
const lastDownloadListeners = new Set<(info: ManifestInfo | null) => void>();

export function getLastDownload(): ManifestInfo | null {
  return lastDownloadInfo;
}

export function recordLastDownload(info: ManifestInfo) {
  lastDownloadInfo = info;
  lastDownloadListeners.forEach((fn) => fn(info));
}

export function subscribeLastDownload(fn: (info: ManifestInfo | null) => void): () => void {
  lastDownloadListeners.add(fn);
  return () => {
    lastDownloadListeners.delete(fn);
  };
}

export function useLastDownload(): ManifestInfo | null {
  const [info, setInfo] = useState<ManifestInfo | null>(() => getLastDownload());
  useEffect(() => subscribeLastDownload(setInfo), []);
  return info;
}

function parseFilename(res: Response, fallback?: string): string {
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return (m?.[1] && decodeURIComponent(m[1])) || fallback || "download";
}

export function formatBytes(n: number | null): string {
  if (n == null || isNaN(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function shortHash(sha: string): string {
  if (!sha) return "";
  return sha.length > 24 ? `${sha.slice(0, 12)}…${sha.slice(-6)}` : sha;
}

export function useManifestDownload() {
  const { toast } = useToast();

  function showManifestToast(info: ManifestInfo) {
    const { filename, sha256, sizeBytes } = info;
    recordLastDownload(info);
    const sizeLabel = formatBytes(sizeBytes);
    toast({
      title: `Downloaded · ${filename}`,
      description: sha256
        ? `${sizeLabel ? sizeLabel + " · " : ""}SHA-256 ${shortHash(sha256)}`
        : `${sizeLabel || "File saved"} · no evidence hash provided`,
      duration: 8000,
      action: sha256 ? (
        <ToastAction
          altText="Copy full SHA-256 hash"
          data-testid="copy-sha256"
          onClick={async () => {
            try {
              await navigator.clipboard?.writeText(sha256);
              toast({
                title: "SHA-256 copied",
                description: "Full evidence hash copied to clipboard.",
                duration: 4000,
              });
            } catch {
              toast({
                title: "Copy failed",
                description: sha256,
                duration: 8000,
              });
            }
          }}
        >
          Copy hash
        </ToastAction>
      ) : undefined,
    });
  }

  async function downloadWithManifest(
    url: string,
    opts: { filename?: string; init?: RequestInit } = {},
  ): Promise<ManifestInfo> {
    const res = await fetch(url, { credentials: "include", ...(opts.init || {}) });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const sha256 = res.headers.get("X-Kincaid-SHA256") || "";
    const sizeHeader = res.headers.get("X-Kincaid-Size-Bytes");
    const sizeBytes = sizeHeader ? parseInt(sizeHeader, 10) : blob.size;
    const filename = opts.filename || parseFilename(res, opts.filename);

    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objUrl);

    const info: ManifestInfo = { filename, sha256, sizeBytes };
    showManifestToast(info);
    return info;
  }

  return { downloadWithManifest, showManifestToast };
}
