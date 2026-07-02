import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  ShieldCheck, Upload, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Hash, X, ArrowLeft, Search, ChevronDown, History,
} from "lucide-react";

const GOLD  = "#FFB800";
const GREEN = "#10B981";
const RED   = "#FF4D6D";
const BLUE  = "#00D4FF";

type VerifyStatus = "match" | "mismatch" | "missing" | "extra";

type VerifyFileRow = {
  filename:        string;
  label:           string;
  expected_sha256: string | null;
  actual_sha256:   string | null;
  expected_size:   number | null;
  actual_size:     number | null;
  status:          VerifyStatus;
};

type ManifestComponent = {
  filename:    string;
  label?:      string;
  sha256?:     string;
  size_bytes?: number;
};

type Manifest = {
  generated_at?: string;
  generated_by?: string;
  client_name?:  string;
  requester?:    string;
  ein?:          string;
  hash_algorithm?: string;
  hard_rule?:    string;
  components?:   ManifestComponent[];
  [k: string]: unknown;
};

type VerifyResult = {
  ok:             boolean;
  manifest_found: boolean;
  manifest: (Omit<Manifest, "components"> & {
    component_count?:   number;
    uploaded_filename?: string;
    uploaded_size_kb?:  number;
  }) | null;
  files:    VerifyFileRow[];
  summary:  { total: number; matched: number; mismatched: number; missing: number; extra: number };
  error:    string | null;
};

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes  = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function verifyZipInBrowser(file: File): Promise<VerifyResult> {
  const empty = { total: 0, matched: 0, mismatched: 0, missing: 0, extra: 0 };
  const raw = await file.arrayBuffer();
  if (!raw.byteLength) {
    return { ok: false, manifest_found: false, manifest: null, files: [], summary: empty, error: "Uploaded file is empty." };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(raw);
  } catch {
    return { ok: false, manifest_found: false, manifest: null, files: [], summary: empty, error: "Not a valid ZIP archive." };
  }

  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const manifestName = names.find((n) => n.toLowerCase().endsWith("manifest.json"));
  if (!manifestName) {
    return {
      ok: false, manifest_found: false, manifest: null, files: [], summary: empty,
      error: "manifest.json not found — this ZIP is not a Kincaid IQ evidence package.",
    };
  }

  let manifest: Manifest;
  try {
    const text = await zip.files[manifestName].async("string");
    manifest = JSON.parse(text);
  } catch (e: any) {
    return {
      ok: false, manifest_found: true, manifest: null, files: [], summary: empty,
      error: `manifest.json is unreadable: ${e?.message || e}`,
    };
  }

  const expected = new Map<string, ManifestComponent>();
  for (const c of manifest.components || []) {
    if (c.filename) expected.set(c.filename, c);
  }

  const actual = new Map<string, { sha256: string; size: number }>();
  for (const n of names) {
    if (n === manifestName) continue;
    const data = await zip.files[n].async("arraybuffer");
    actual.set(n, { sha256: await sha256Hex(data), size: data.byteLength });
  }

  const results: VerifyFileRow[] = [];
  let matched = 0, mismatched = 0, missing = 0, extra = 0;

  for (const [fname, comp] of expected) {
    const expHash = comp.sha256 ?? null;
    const expSize = comp.size_bytes ?? null;
    const label   = comp.label || fname;
    const act = actual.get(fname);
    if (!act) {
      results.push({
        filename: fname, label,
        expected_sha256: expHash, actual_sha256: null,
        expected_size: expSize, actual_size: null,
        status: "missing",
      });
      missing++;
      continue;
    }
    const status: VerifyStatus = act.sha256 === expHash ? "match" : "mismatch";
    if (status === "match") matched++; else mismatched++;
    results.push({
      filename: fname, label,
      expected_sha256: expHash, actual_sha256: act.sha256,
      expected_size: expSize, actual_size: act.size,
      status,
    });
  }

  for (const [fname, act] of actual) {
    if (expected.has(fname)) continue;
    results.push({
      filename: fname, label: fname,
      expected_sha256: null, actual_sha256: act.sha256,
      expected_size: null, actual_size: act.size,
      status: "extra",
    });
    extra++;
  }

  const total = results.length;
  const ok = mismatched === 0 && missing === 0 && extra === 0 && matched > 0;

  const { components: _components, ...rest } = manifest;
  const manifestEcho = {
    ...rest,
    component_count:   expected.size,
    uploaded_filename: file.name,
    uploaded_size_kb:  Math.round((raw.byteLength / 1024) * 10) / 10,
  };

  return {
    ok, manifest_found: true, manifest: manifestEcho,
    files: results,
    summary: { total, matched, mismatched, missing, extra },
    error: null,
  };
}

type LookupSource = {
  origin:     "zip" | "manifest";
  filename:   string;
  components: ManifestComponent[];
  client_name?: string;
  generated_at?: string;
  // ISO timestamp of when this manifest was first ingested into the local
  // cache. Used to show a "loaded N days ago" freshness signal on the pill
  // and to amber-tint stale caches. Optional so payloads cached before this
  // field existed degrade gracefully (no badge, no crash).
  loaded_at?: string;
};

const LOOKUP_SOURCE_STORAGE_KEY = "kiq-verify-lookup-source-v1";
const LOOKUP_HISTORY_STORAGE_KEY = "kiq-verify-lookup-history-v1";
const LOOKUP_HISTORY_MAX = 5;
const LOOKUP_STALE_AFTER_DAYS = 30;

function formatLoadedAgo(iso: string | undefined): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "loaded just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1)  return "loaded just now";
  if (minutes < 60) return `loaded ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return "loaded today";
  const days = Math.floor(hours / 24);
  if (days === 1)   return "loaded yesterday";
  if (days < 7)     return `loaded ${days} days ago`;
  if (days < 14)    return "loaded last week";
  if (days < 30)    return `loaded ${Math.floor(days / 7)} weeks ago`;
  if (days < 60)    return "loaded last month";
  const months = Math.floor(days / 30);
  if (months < 12)  return `loaded ${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "loaded last year" : `loaded ${years} years ago`;
}

function isLookupSourceStale(iso: string | undefined): boolean {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return (Date.now() - ts) / 86_400_000 > LOOKUP_STALE_AFTER_DAYS;
}

function lookupSourceKey(src: { filename: string; generated_at?: string }): string {
  return `${src.filename}|${src.generated_at || ""}`;
}

// We persist the recent-manifests history to localStorage so the dropdown
// survives tab close, mirroring the active-manifest behavior. We also mirror
// to sessionStorage as a fallback (Safari private mode, strict ITP) and to
// pick up entries from older tabs that pre-date the localStorage migration.
function parseStoredLookupHistory(raw: string | null): LookupSource[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (s): s is LookupSource =>
        !!s && typeof s.filename === "string" && Array.isArray(s.components),
    );
  } catch {
    return null;
  }
}

function readStoredLookupHistory(): LookupSource[] {
  if (typeof window === "undefined") return [];
  let local: LookupSource[] | null = null;
  try {
    local = parseStoredLookupHistory(
      window.localStorage.getItem(LOOKUP_HISTORY_STORAGE_KEY),
    );
  } catch {
    /* localStorage may be unavailable — fall through */
  }
  let session: LookupSource[] | null = null;
  try {
    session = parseStoredLookupHistory(
      window.sessionStorage.getItem(LOOKUP_HISTORY_STORAGE_KEY),
    );
  } catch {
    /* sessionStorage may be unavailable — non-fatal */
  }
  // Migration / merge: union localStorage + sessionStorage entries, keyed by
  // filename+generated_at, preserving local order first (most recent wins),
  // then any session-only entries (e.g. from a pre-migration tab).
  if (!local && !session) return [];
  const merged: LookupSource[] = [];
  const seen = new Set<string>();
  for (const src of [...(local ?? []), ...(session ?? [])]) {
    const key = lookupSourceKey(src);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(src);
    if (merged.length >= LOOKUP_HISTORY_MAX) break;
  }
  // If we recovered session-only entries, mirror them up to localStorage now
  // so the next fresh tab sees them without re-running the migration.
  if (!local && session && session.length > 0) {
    try {
      window.localStorage.setItem(
        LOOKUP_HISTORY_STORAGE_KEY,
        JSON.stringify(merged),
      );
    } catch {
      /* localStorage may be unavailable — non-fatal */
    }
  }
  return merged;
}

function writeStoredLookupHistory(history: LookupSource[]): void {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(history);
  try {
    window.localStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, serialized);
  } catch {
    /* localStorage may be unavailable — non-fatal */
  }
  try {
    window.sessionStorage.setItem(LOOKUP_HISTORY_STORAGE_KEY, serialized);
  } catch {
    /* sessionStorage may be unavailable — non-fatal */
  }
}

// We persist the loaded manifest to localStorage so a recipient who comes
// back tomorrow to check another hash from the same board deck doesn't have
// to re-upload. We also mirror to sessionStorage so old tabs that pre-date
// the localStorage migration keep working, and so we still have a fallback
// when localStorage is unavailable (Safari private mode, strict ITP, etc.).
function readStoredLookupSource(): LookupSource | null {
  if (typeof window === "undefined") return null;
  const tryParse = (raw: string | null): LookupSource | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as LookupSource;
      if (!parsed || !Array.isArray(parsed.components)) return null;
      return parsed;
    } catch {
      return null;
    }
  };
  try {
    const local = tryParse(window.localStorage.getItem(LOOKUP_SOURCE_STORAGE_KEY));
    if (local) return local;
  } catch {
    /* localStorage may be unavailable — fall through */
  }
  try {
    return tryParse(window.sessionStorage.getItem(LOOKUP_SOURCE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredLookupSource(src: LookupSource | null): void {
  if (typeof window === "undefined") return;
  const serialized = src ? JSON.stringify(src) : null;
  try {
    if (serialized) {
      window.localStorage.setItem(LOOKUP_SOURCE_STORAGE_KEY, serialized);
    } else {
      window.localStorage.removeItem(LOOKUP_SOURCE_STORAGE_KEY);
    }
  } catch {
    /* localStorage may be unavailable — non-fatal */
  }
  try {
    if (serialized) {
      window.sessionStorage.setItem(LOOKUP_SOURCE_STORAGE_KEY, serialized);
    } else {
      window.sessionStorage.removeItem(LOOKUP_SOURCE_STORAGE_KEY);
    }
  } catch {
    /* sessionStorage may be unavailable (private mode) — non-fatal */
  }
}

type LookupOutcome =
  | { status: "pass"; component: ManifestComponent; filenameMatches: boolean; expectedFilename: string | null }
  | { status: "fail"; reason: string; suggestedComponent?: ManifestComponent };

function normalizeHash(s: string): string {
  return s.trim().toLowerCase().replace(/^0x/, "").replace(/[^0-9a-f]/g, "");
}

function isValidSha256(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s);
}

export default function VerifyPackagePublic() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const manifestInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [file, setFile]         = useState<{ name: string; size: number } | null>(null);
  const [result, setResult]     = useState<VerifyResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // Hash-lookup mode. Restore any manifest we cached on a prior visit so that a
  // recipient who scans a per-file QR code (deep-link with sha256= & file=) can
  // be auto-checked without re-uploading the ZIP.
  const [lookupSource, setLookupSource] = useState<LookupSource | null>(() => readStoredLookupSource());
  const [lookupHistory, setLookupHistory] = useState<LookupSource[]>(() => readStoredLookupHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyMenuRef = useRef<HTMLDivElement | null>(null);
  const [lookupSourceError, setLookupSourceError] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState("");
  const [filenameHint, setFilenameHint] = useState("");
  const [lookupOutcome, setLookupOutcome] = useState<LookupOutcome | null>(null);
  const [deepLinkNotice, setDeepLinkNotice] = useState<string | null>(null);

  function ingestManifest(origin: "zip" | "manifest", filename: string, manifest: Manifest) {
    const components = (manifest.components || []).filter((c) => c && c.filename);
    const next: LookupSource = {
      origin,
      filename,
      components,
      client_name:  manifest.client_name,
      generated_at: manifest.generated_at,
      loaded_at:    new Date().toISOString(),
    };
    setLookupSource(next);
    writeStoredLookupSource(next);
    setLookupHistory((prev) => {
      const key = lookupSourceKey(next);
      const deduped = prev.filter((s) => lookupSourceKey(s) !== key);
      const updated = [next, ...deduped].slice(0, LOOKUP_HISTORY_MAX);
      writeStoredLookupHistory(updated);
      return updated;
    });
    setLookupSourceError(null);
    setLookupOutcome(null);
  }

  function selectFromHistory(entry: LookupSource) {
    // Stamp a fresh loaded_at so the dropdown's "loaded N min ago" reflects
    // the user's most recent interaction, not the original ingestion time.
    const refreshed: LookupSource = { ...entry, loaded_at: new Date().toISOString() };
    setLookupSource(refreshed);
    writeStoredLookupSource(refreshed);
    setLookupHistory((prev) => {
      const key = lookupSourceKey(refreshed);
      const deduped = prev.filter((s) => lookupSourceKey(s) !== key);
      const updated = [refreshed, ...deduped].slice(0, LOOKUP_HISTORY_MAX);
      writeStoredLookupHistory(updated);
      return updated;
    });
    setLookupSourceError(null);
    setLookupOutcome(null);
    setHistoryOpen(false);
  }

  function removeFromHistory(entry: LookupSource) {
    const key = lookupSourceKey(entry);
    setLookupHistory((prev) => {
      const updated = prev.filter((s) => lookupSourceKey(s) !== key);
      writeStoredLookupHistory(updated);
      return updated;
    });
    if (lookupSource && lookupSourceKey(lookupSource) === key) {
      setLookupSource(null);
      writeStoredLookupSource(null);
      setLookupOutcome(null);
    }
  }

  async function runVerify(f: File) {
    setLoading(true);
    setResult(null);
    setError(null);
    setFile({ name: f.name, size: f.size });
    try {
      const r = await verifyZipInBrowser(f);
      setResult(r);
      // Re-derive the full manifest (with components) from the ZIP so we can
      // power the paste-a-hash lookup mode without re-uploading.
      try {
        const raw = await f.arrayBuffer();
        const zip = await JSZip.loadAsync(raw);
        const manifestName = Object.keys(zip.files).find(
          (n) => !zip.files[n].dir && n.toLowerCase().endsWith("manifest.json"),
        );
        if (manifestName) {
          const text = await zip.files[manifestName].async("string");
          const manifest: Manifest = JSON.parse(text);
          ingestManifest("zip", f.name, manifest);
        }
      } catch {
        /* swallow — main verification result is the authoritative answer */
      }
    } catch (e: any) {
      setError(e?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function runManifestUpload(f: File) {
    setLookupSourceError(null);
    setLookupOutcome(null);
    try {
      const text = await f.text();
      const manifest: Manifest = JSON.parse(text);
      if (!manifest || !Array.isArray(manifest.components)) {
        setLookupSourceError("That file does not look like a Kincaid IQ manifest.json (no components array).");
        return;
      }
      ingestManifest("manifest", f.name, manifest);
    } catch (e: any) {
      setLookupSourceError(`Could not read manifest.json: ${e?.message || e}`);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) runVerify(f);
  }

  function clearAll() {
    setFile(null);
    setResult(null);
    setError(null);
    setLookupSource(null);
    writeStoredLookupSource(null);
    setLookupSourceError(null);
    setLookupOutcome(null);
    setHashInput("");
    setFilenameHint("");
    setDeepLinkNotice(null);
    setHistoryOpen(false);
    if (inputRef.current) inputRef.current.value = "";
    if (manifestInputRef.current) manifestInputRef.current.value = "";
  }

  useEffect(() => {
    if (!historyOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!historyMenuRef.current) return;
      if (!historyMenuRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [historyOpen]);

  const normalizedHash = useMemo(() => normalizeHash(hashInput), [hashInput]);
  const hashValid      = isValidSha256(normalizedHash);

  function runHashLookup() {
    setLookupOutcome(null);
    if (!lookupSource) {
      setLookupOutcome({ status: "fail", reason: "Load a manifest first (verify a ZIP above, or upload a manifest.json)." });
      return;
    }
    if (!hashValid) {
      setLookupOutcome({ status: "fail", reason: "Paste a full 64-character SHA-256 hex string." });
      return;
    }
    const hint = filenameHint.trim().toLowerCase();
    const matches = lookupSource.components.filter(
      (c) => (c.sha256 || "").toLowerCase() === normalizedHash,
    );
    if (matches.length === 0) {
      // Did the user paste a filename that exists but with a different hash?
      let suggested: ManifestComponent | undefined;
      if (hint) {
        suggested = lookupSource.components.find(
          (c) => c.filename.toLowerCase() === hint || (c.filename.toLowerCase().endsWith("/" + hint)),
        );
      }
      setLookupOutcome({
        status: "fail",
        reason: hint
          ? `No component in this manifest has that SHA-256.${suggested ? " The manifest does contain a file with that name, but its hash is different — see below." : ""}`
          : "No component in this manifest has that SHA-256.",
        suggestedComponent: suggested,
      });
      return;
    }
    // Prefer a match whose filename also lines up with the hint, if a hint was given.
    let chosen = matches[0];
    let filenameMatches = true;
    let expectedFilename: string | null = null;
    if (hint) {
      const exact = matches.find(
        (c) => c.filename.toLowerCase() === hint || c.filename.toLowerCase().endsWith("/" + hint),
      );
      if (exact) {
        chosen = exact;
        filenameMatches = true;
      } else {
        filenameMatches = false;
        expectedFilename = chosen.filename;
      }
    }
    setLookupOutcome({ status: "pass", component: chosen, filenameMatches, expectedFilename });
  }

  function clearLookupSource() {
    setLookupSource(null);
    writeStoredLookupSource(null);
    setLookupSourceError(null);
    setLookupOutcome(null);
    if (manifestInputRef.current) manifestInputRef.current.value = "";
  }

  // Deep-link handling: cover_sheet.html prints a QR code next to every hash.
  // Scanning it lands here with `?sha256=...&file=...`, so we pre-fill the
  // hash-lookup inputs and — if we already have a cached manifest — run the
  // check automatically. The URL is then cleaned so a refresh doesn't repeat it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawHash = params.get("sha256") || params.get("hash") || "";
    const rawFile = params.get("file") || "";
    if (!rawHash && !rawFile) return;
    if (rawHash) setHashInput(rawHash);
    if (rawFile) setFilenameHint(rawFile);

    const cached = readStoredLookupSource();
    const normalized = normalizeHash(rawHash);
    if (cached && isValidSha256(normalized)) {
      setDeepLinkNotice(
        `Deep link detected — checking ${rawFile || "this hash"} against the manifest you previously loaded (${cached.filename}).`,
      );
      // Defer one tick so the input state is committed before scrolling/clicking.
      window.setTimeout(() => {
        const hint = rawFile.trim().toLowerCase();
        const matches = cached.components.filter(
          (c) => (c.sha256 || "").toLowerCase() === normalized,
        );
        if (matches.length === 0) {
          let suggested: ManifestComponent | undefined;
          if (hint) {
            suggested = cached.components.find(
              (c) => c.filename.toLowerCase() === hint || c.filename.toLowerCase().endsWith("/" + hint),
            );
          }
          setLookupOutcome({
            status: "fail",
            reason: hint
              ? `No component in this manifest has that SHA-256.${suggested ? " The manifest does contain a file with that name, but its hash is different — see below." : ""}`
              : "No component in this manifest has that SHA-256.",
            suggestedComponent: suggested,
          });
        } else {
          let chosen = matches[0];
          let filenameMatches = true;
          let expectedFilename: string | null = null;
          if (hint) {
            const exact = matches.find(
              (c) => c.filename.toLowerCase() === hint || c.filename.toLowerCase().endsWith("/" + hint),
            );
            if (exact) {
              chosen = exact;
            } else {
              filenameMatches = false;
              expectedFilename = chosen.filename;
            }
          }
          setLookupOutcome({ status: "pass", component: chosen, filenameMatches, expectedFilename });
        }
      }, 0);
    } else {
      setDeepLinkNotice(
        cached
          ? "Deep link detected — the SHA-256 in the URL is incomplete. Paste the full 64-character hash below to check it."
          : "Deep link detected — load the package manifest (verify a ZIP, or upload manifest.json) and the check will run automatically.",
      );
    }

    // Strip the query string so a manual refresh doesn't re-trigger the toast.
    try {
      const cleaned = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleaned);
    } catch {
      /* non-fatal */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen text-zinc-200"
      style={{ background: "#06070A" }}
      data-testid="verify-public-page"
    >
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${BLUE}18`, border: `1px solid ${BLUE}40` }}
          >
            <ShieldCheck className="w-5 h-5" style={{ color: BLUE }} />
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500">
              Kincaid IQ™ · Public verifier
            </div>
            <h1 className="text-xl font-bold text-white leading-tight">
              Verify a Kincaid IQ evidence package
            </h1>
          </div>
        </div>

        <p className="text-[12px] text-zinc-400 max-w-2xl mb-2">
          Drop a <code className="font-mono text-zinc-300">kiq_package_*.zip</code> below.
          Every file is hashed in your browser with SHA-256 and compared against the embedded{" "}
          <code className="font-mono text-zinc-300">manifest.json</code>. Nothing is uploaded
          to Kincaid IQ — verification runs entirely on this device. No account required.
        </p>
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-600 mb-8">
          Hard Rule #03 — every export carries a SHA-256 evidence manifest.
        </div>

        {/* Dropzone */}
        <div
          data-testid="verify-public-dropzone"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl border-2 border-dashed cursor-pointer transition-colors p-8 text-center"
          style={{
            background:  dragOver ? `${BLUE}10` : "rgba(255,255,255,0.02)",
            borderColor: dragOver ? `${BLUE}80` : "rgba(255,255,255,0.10)",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            data-testid="verify-public-file-input"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) runVerify(f);
            }}
          />
          <div className="flex items-center justify-center gap-3">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: BLUE }} />
            ) : (
              <Upload className="w-6 h-6" style={{ color: dragOver ? BLUE : "#71717A" }} />
            )}
            <span className="text-[13px] text-zinc-200">
              {loading
                ? "Hashing files in your browser…"
                : file
                ? file.name
                : "Drop a kiq_package_*.zip here, or click to choose"}
            </span>
          </div>
          {file && !loading && (
            <div className="mt-2 text-[10px] font-mono text-zinc-500">
              {(file.size / 1024).toFixed(1)} KB
            </div>
          )}
        </div>

        {/* Browser support note */}
        {typeof window !== "undefined" && !window.crypto?.subtle && (
          <div className="mt-4 p-3 rounded-lg border text-[11px]"
               style={{ background: `${RED}10`, borderColor: `${RED}40`, color: "#FECACA" }}>
            This browser does not expose <code>window.crypto.subtle</code>. Public verification
            requires a secure context (HTTPS or localhost). Please open this page over HTTPS.
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="mt-4 flex items-start gap-2 p-3 rounded-lg border"
            style={{ background: `${RED}10`, borderColor: `${RED}40` }}
            data-testid="verify-public-error"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: RED }} />
            <span className="text-[12px] text-zinc-200">{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4" data-testid="verify-public-result">
            {(() => {
              const ok = result.ok;
              const color = ok ? GREEN : RED;
              return (
                <div
                  className="flex items-start justify-between gap-3 p-4 rounded-xl border"
                  style={{ background: `${color}10`, borderColor: `${color}40` }}
                  data-testid="verify-public-banner"
                  data-verify-status={ok ? "pass" : "fail"}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle2 className="w-5 h-5" style={{ color: GREEN }} />
                        : <XCircle      className="w-5 h-5" style={{ color: RED }} />}
                      <span className="text-[13px] font-bold uppercase tracking-[0.14em]"
                            style={{ color }}>
                        {ok ? "PASS — every hash matches" : "FAIL — package integrity broken"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-300">
                      <span data-testid="verify-public-summary-matched">
                        <span style={{ color: GREEN }}>✓</span> {result.summary.matched} matched
                      </span>
                      {result.summary.mismatched > 0 && (
                        <span data-testid="verify-public-summary-mismatched">
                          <span style={{ color: RED }}>✗</span> {result.summary.mismatched} altered
                        </span>
                      )}
                      {result.summary.missing > 0 && (
                        <span data-testid="verify-public-summary-missing">
                          <span style={{ color: GOLD }}>−</span> {result.summary.missing} missing
                        </span>
                      )}
                      {result.summary.extra > 0 && (
                        <span data-testid="verify-public-summary-extra">
                          <span style={{ color: GOLD }}>+</span> {result.summary.extra} unexpected
                        </span>
                      )}
                      {result.manifest?.generated_at && (
                        <span>· manifest @ {String(result.manifest.generated_at)}</span>
                      )}
                      {result.manifest?.client_name && (
                        <span>· {String(result.manifest.client_name)}</span>
                      )}
                    </div>
                    {result.error && (
                      <div className="mt-1 text-[10px] text-zinc-400">{result.error}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors"
                    data-testid="verify-public-clear"
                    aria-label="Clear verification result"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}

            {result.files.length > 0 && (
              <div
                className="rounded-xl border border-zinc-900 overflow-hidden"
                style={{ background: "#0A0D14" }}
                data-testid="verify-public-files-table"
              >
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 border-b border-zinc-900 text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-zinc-600">
                  <span>File · expected → actual</span>
                  <span>Size</span>
                  <span>Status</span>
                </div>
                {result.files.map((f, i) => {
                  const statusColor =
                    f.status === "match"    ? GREEN :
                    f.status === "mismatch" ? RED   :
                    f.status === "missing"  ? RED   : GOLD;
                  const StatusIcon =
                    f.status === "match" ? CheckCircle2 :
                    f.status === "extra" ? AlertTriangle : XCircle;
                  return (
                    <div
                      key={`${f.filename}-${i}`}
                      data-testid={`verify-public-row-${f.filename}`}
                      data-verify-row-status={f.status}
                      className={`grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 items-start ${i > 0 ? "border-t border-zinc-900" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-zinc-200 truncate">{f.filename}</div>
                        {f.label && f.label !== f.filename && (
                          <div className="text-[9px] text-zinc-600">{f.label}</div>
                        )}
                        <div className="mt-1 text-[9px] font-mono text-zinc-500 break-all leading-tight">
                          {f.expected_sha256 && (
                            <div>
                              <span className="text-zinc-700">expected</span>{" "}
                              <span style={{ color: GREEN }}>{f.expected_sha256}</span>
                            </div>
                          )}
                          {f.actual_sha256 && (
                            <div>
                              <span className="text-zinc-700">actual&nbsp;&nbsp;</span>{" "}
                              <span style={{ color: f.status === "match" ? GREEN : RED }}>
                                {f.actual_sha256}
                              </span>
                            </div>
                          )}
                          {f.status === "missing" && (
                            <div className="text-zinc-600 italic">— file not present in uploaded ZIP —</div>
                          )}
                        </div>
                      </div>
                      <div className="text-[9px] font-mono text-zinc-500 whitespace-nowrap text-right">
                        {f.expected_size != null && (
                          <div>{f.expected_size.toLocaleString()} B</div>
                        )}
                        {f.actual_size != null && f.actual_size !== f.expected_size && (
                          <div style={{ color: f.status === "match" ? GREEN : RED }}>
                            {f.actual_size.toLocaleString()} B
                          </div>
                        )}
                      </div>
                      <div>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-[0.12em] text-[9px]"
                          style={{
                            color:      statusColor,
                            background: `${statusColor}12`,
                            border:     `1px solid ${statusColor}35`,
                          }}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {f.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Paste-a-hash lookup mode
            For recipients who only want to confirm one SHA-256 printed on
            a deck or cover sheet, without re-uploading the whole ZIP.
           ───────────────────────────────────────────────────────────── */}
        <div className="mt-10" data-testid="verify-public-lookup-section">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40` }}
            >
              <Search className="w-3.5 h-3.5" style={{ color: GOLD }} />
            </div>
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                Alternate mode · No ZIP required
              </div>
              <h2 className="text-[14px] font-bold text-white leading-tight">
                Verify a single SHA-256 against a manifest
              </h2>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 max-w-2xl mb-4">
            Paste a SHA-256 hash printed on a cover sheet, board deck, or email
            footer — or scan the QR code next to that hash with your phone camera.
            We check it against the <code className="font-mono text-zinc-300">manifest.json</code>{" "}
            of a Kincaid IQ package — either the one you just verified above, or
            a standalone <code className="font-mono text-zinc-300">manifest.json</code> you upload here.
          </p>

          {deepLinkNotice && (
            <div
              className="mb-3 flex items-start gap-2 p-3 rounded-lg border"
              style={{ background: `${BLUE}10`, borderColor: `${BLUE}40` }}
              data-testid="verify-public-deep-link-notice"
            >
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BLUE }} />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em]" style={{ color: BLUE }}>
                  Scan-to-verify deep link
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-200">{deepLinkNotice}</div>
              </div>
              <button
                type="button"
                onClick={() => setDeepLinkNotice(null)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors flex-shrink-0"
                aria-label="Dismiss deep-link notice"
                data-testid="verify-public-deep-link-dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Manifest source row */}
          <div
            className="rounded-xl border p-4 mb-3"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
            data-testid="verify-public-lookup-source"
          >
            {lookupSource ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />
                    <span className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: GREEN }}>
                      Manifest loaded · {lookupSource.origin === "zip" ? "from verified ZIP" : "uploaded manifest.json"}
                    </span>
                    {(() => {
                      const ago = formatLoadedAgo(lookupSource.loaded_at);
                      if (!ago) return null;
                      const stale = isLookupSourceStale(lookupSource.loaded_at);
                      return (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.12em]"
                          style={
                            stale
                              ? {
                                  background: "rgba(245,158,11,0.10)",
                                  border:     "1px solid rgba(245,158,11,0.35)",
                                  color:      "#F59E0B",
                                }
                              : {
                                  background: "rgba(255,255,255,0.04)",
                                  border:     "1px solid rgba(255,255,255,0.10)",
                                  color:      "#A1A1AA",
                                }
                          }
                          title={
                            stale
                              ? `This cached manifest was loaded more than ${LOOKUP_STALE_AFTER_DAYS} days ago. If the deck has been re-issued, re-upload the ZIP or manifest.json to refresh it.`
                              : `Cached on this device at ${new Date(lookupSource.loaded_at!).toLocaleString()}`
                          }
                          data-testid="verify-public-lookup-loaded-ago"
                          data-stale={stale ? "true" : "false"}
                        >
                          {ago}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-300 truncate">
                    {lookupSource.filename}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono text-zinc-500">
                    <span data-testid="verify-public-lookup-component-count">
                      {lookupSource.components.length} components indexed
                    </span>
                    {lookupSource.client_name && <span>· {lookupSource.client_name}</span>}
                    {lookupSource.generated_at && <span>· {lookupSource.generated_at}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500 hidden sm:inline"
                    data-testid="verify-public-lookup-retention-note"
                  >
                    kept on this device until you clear it
                  </span>
                  {lookupHistory.length > 0 && (
                    <div className="relative" ref={historyMenuRef}>
                      <button
                        type="button"
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-300 hover:text-white transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.10)",
                        }}
                        data-testid="verify-public-lookup-history-toggle"
                        aria-haspopup="menu"
                        aria-expanded={historyOpen}
                        title="Switch between recently loaded manifests"
                      >
                        <History className="w-3 h-3" />
                        Recent ({lookupHistory.length})
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {historyOpen && (
                        <div
                          className="absolute right-0 mt-1 w-80 rounded-lg shadow-2xl z-20 overflow-hidden"
                          style={{
                            background: "#0B0D12",
                            border: "1px solid rgba(255,255,255,0.12)",
                          }}
                          role="menu"
                          data-testid="verify-public-lookup-history-menu"
                        >
                          <div className="px-3 py-2 text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-500 border-b border-zinc-800">
                            Recent manifests · last {LOOKUP_HISTORY_MAX}
                          </div>
                          <ul className="max-h-72 overflow-y-auto">
                            {lookupHistory.map((entry) => {
                              const key = lookupSourceKey(entry);
                              const isActive = !!lookupSource && lookupSourceKey(lookupSource) === key;
                              return (
                                <li
                                  key={key}
                                  className="flex items-start gap-2 px-3 py-2 hover:bg-white/5 border-b border-zinc-900 last:border-b-0"
                                  data-testid={`verify-public-lookup-history-item-${key}`}
                                  data-active={isActive ? "true" : "false"}
                                >
                                  <button
                                    type="button"
                                    onClick={() => selectFromHistory(entry)}
                                    className="flex-1 min-w-0 text-left"
                                    data-testid="verify-public-lookup-history-select"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {isActive && (
                                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: GREEN }} />
                                      )}
                                      <span className="text-[11px] text-zinc-100 truncate">
                                        {entry.filename}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] font-mono text-zinc-500">
                                      <span>{entry.components.length} components</span>
                                      {entry.client_name && <span>· {entry.client_name}</span>}
                                      {entry.generated_at && <span>· {entry.generated_at}</span>}
                                      {(() => {
                                        const ago = formatLoadedAgo(entry.loaded_at);
                                        if (!ago) return null;
                                        const stale = isLookupSourceStale(entry.loaded_at);
                                        return (
                                          <span
                                            style={stale ? { color: "#F59E0B" } : undefined}
                                            className={stale ? undefined : "text-zinc-400"}
                                            title={
                                              stale
                                                ? `This cached manifest was loaded more than ${LOOKUP_STALE_AFTER_DAYS} days ago. If the deck has been re-issued, re-upload the ZIP or manifest.json to refresh it.`
                                                : `Cached on this device at ${new Date(entry.loaded_at!).toLocaleString()}`
                                            }
                                            data-testid="verify-public-lookup-history-loaded-ago"
                                            data-stale={stale ? "true" : "false"}
                                          >
                                            · {ago}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeFromHistory(entry); }}
                                    className="text-zinc-600 hover:text-zinc-200 transition-colors flex-shrink-0 mt-0.5"
                                    aria-label={`Remove ${entry.filename} from recent manifests`}
                                    title="Remove from recent manifests"
                                    data-testid="verify-public-lookup-history-remove"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={clearLookupSource}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors"
                    data-testid="verify-public-lookup-clear-source"
                    aria-label="Clear loaded manifest"
                    title="Clear loaded manifest (kept on this device until you clear it)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[11px] text-zinc-400">
                  No manifest loaded yet. Verify a ZIP above, or upload a{" "}
                  <code className="font-mono text-zinc-300">manifest.json</code> on its own.
                </div>
                <button
                  type="button"
                  onClick={() => manifestInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono uppercase tracking-[0.12em] transition-colors"
                  style={{
                    background:  `${BLUE}14`,
                    border:      `1px solid ${BLUE}40`,
                    color:       BLUE,
                  }}
                  data-testid="verify-public-lookup-upload-manifest"
                >
                  <Upload className="w-3 h-3" />
                  Upload manifest.json
                </button>
              </div>
            )}
            <input
              ref={manifestInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              data-testid="verify-public-lookup-manifest-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runManifestUpload(f);
              }}
            />
            {lookupSourceError && (
              <div
                className="mt-3 flex items-start gap-2 p-2 rounded-lg border"
                style={{ background: `${RED}10`, borderColor: `${RED}40` }}
                data-testid="verify-public-lookup-source-error"
              >
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5" style={{ color: RED }} />
                <span className="text-[11px] text-zinc-200">{lookupSourceError}</span>
              </div>
            )}
          </div>

          {/* Hash + filename inputs */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div>
              <label
                htmlFor="verify-public-hash-input"
                className="block text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-500 mb-1"
              >
                SHA-256 hash (64 hex characters)
              </label>
              <textarea
                id="verify-public-hash-input"
                data-testid="verify-public-hash-input"
                value={hashInput}
                onChange={(e) => { setHashInput(e.target.value); setLookupOutcome(null); }}
                placeholder="e.g. 9f4c3a8b6d2e1f0a7c5b4e3d2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f"
                rows={2}
                className="w-full px-3 py-2 rounded-lg font-mono text-[11px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-1 break-all resize-none"
                style={{
                  background:  "#06070A",
                  border:      `1px solid ${hashInput && !hashValid ? RED + "60" : "rgba(255,255,255,0.10)"}`,
                }}
              />
              <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono text-zinc-600">
                <span data-testid="verify-public-hash-validity">
                  {hashInput
                    ? hashValid
                      ? <span style={{ color: GREEN }}>valid SHA-256 format</span>
                      : <span style={{ color: RED }}>{normalizedHash.length}/64 hex chars — keep going</span>
                    : <span>Whitespace, "0x", and uppercase are normalized automatically.</span>}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="verify-public-filename-hint"
                className="block text-[9px] font-mono uppercase tracking-[0.14em] text-zinc-500 mb-1"
              >
                Filename (optional — e.g. cover_sheet.html, board_pack.pdf)
              </label>
              <input
                id="verify-public-filename-hint"
                data-testid="verify-public-filename-hint"
                type="text"
                value={filenameHint}
                onChange={(e) => { setFilenameHint(e.target.value); setLookupOutcome(null); }}
                placeholder="cover_sheet.html"
                className="w-full px-3 py-2 rounded-lg font-mono text-[11px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
                style={{
                  background:  "#06070A",
                  border:      "1px solid rgba(255,255,255,0.10)",
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={runHashLookup}
                disabled={!lookupSource || !hashValid}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background:  `${GOLD}18`,
                  border:      `1px solid ${GOLD}60`,
                  color:       GOLD,
                }}
                data-testid="verify-public-hash-check"
              >
                <Search className="w-3.5 h-3.5" />
                Check hash against manifest
              </button>
              {(hashInput || filenameHint || lookupOutcome) && (
                <button
                  type="button"
                  onClick={() => { setHashInput(""); setFilenameHint(""); setLookupOutcome(null); }}
                  className="text-[10px] font-mono uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-300"
                  data-testid="verify-public-hash-reset"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Outcome */}
            {lookupOutcome && (() => {
              const isPass = lookupOutcome.status === "pass";
              const color  = isPass ? (lookupOutcome.filenameMatches ? GREEN : GOLD) : RED;
              return (
                <div
                  className="mt-2 p-3 rounded-lg border"
                  style={{ background: `${color}10`, borderColor: `${color}40` }}
                  data-testid="verify-public-hash-outcome"
                  data-hash-outcome={isPass ? (lookupOutcome.filenameMatches ? "pass" : "pass-filename-mismatch") : "fail"}
                >
                  <div className="flex items-center gap-2">
                    {isPass
                      ? <CheckCircle2 className="w-4 h-4" style={{ color }} />
                      : <XCircle      className="w-4 h-4" style={{ color }} />}
                    <span className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color }}>
                      {isPass
                        ? lookupOutcome.filenameMatches
                          ? "PASS — hash matches a component in this manifest"
                          : "PASS (with warning) — hash matches, but filename differs"
                        : "FAIL — no matching hash in this manifest"}
                    </span>
                  </div>
                  {lookupOutcome.status === "pass" ? (
                    <div className="mt-2 text-[11px] text-zinc-200 space-y-0.5">
                      <div>
                        <span className="text-zinc-500 font-mono uppercase tracking-[0.12em] text-[9px]">Component&nbsp;&nbsp;</span>
                        <span className="font-bold" data-testid="verify-public-hash-match-filename">
                          {lookupOutcome.component.filename}
                        </span>
                      </div>
                      {lookupOutcome.component.label && lookupOutcome.component.label !== lookupOutcome.component.filename && (
                        <div className="text-[11px] text-zinc-400">
                          <span className="text-zinc-600 font-mono uppercase tracking-[0.12em] text-[9px]">Label&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                          <span data-testid="verify-public-hash-match-label">{lookupOutcome.component.label}</span>
                        </div>
                      )}
                      {lookupOutcome.component.size_bytes != null && (
                        <div className="text-[10px] font-mono text-zinc-500">
                          {lookupOutcome.component.size_bytes.toLocaleString()} bytes
                        </div>
                      )}
                      {!lookupOutcome.filenameMatches && lookupOutcome.expectedFilename && (
                        <div className="mt-1 text-[10px] text-zinc-400">
                          You typed <code className="font-mono text-zinc-300">{filenameHint}</code>, but
                          this hash actually belongs to{" "}
                          <code className="font-mono text-zinc-300">{lookupOutcome.expectedFilename}</code>.
                          The hash is authentic, but confirm you're looking at the right document.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-zinc-300">
                      {lookupOutcome.reason}
                      {lookupOutcome.suggestedComponent && (
                        <div className="mt-2 p-2 rounded border text-[10px] font-mono break-all"
                             style={{ background: "#06070A", borderColor: "rgba(255,255,255,0.08)" }}>
                          <div className="text-zinc-500 uppercase tracking-[0.12em] text-[9px] mb-1">
                            Expected hash for {lookupOutcome.suggestedComponent.filename}
                          </div>
                          <div style={{ color: GREEN }}>{lookupOutcome.suggestedComponent.sha256 || "—"}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-zinc-900">
          <div className="flex items-start gap-2 text-[10px] font-mono text-zinc-600">
            <Hash className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              Hashing runs locally via the browser's <code>SubtleCrypto</code> API and{" "}
              <code>JSZip</code>. Your file never leaves this device. Compare any value here
              against the SHA-256 column inside <code>cover_sheet.html</code> or{" "}
              <code>manifest.json</code>.
            </span>
          </div>
          <a
            href="/landing"
            className="mt-4 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300"
            data-testid="link-public-landing"
          >
            <ArrowLeft className="w-3 h-3" />
            About Kincaid IQ
          </a>
        </div>
      </div>
    </div>
  );
}
