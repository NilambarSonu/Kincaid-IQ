import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, LinkIcon, AlertTriangle } from "lucide-react";

const PAGE_PATHS: Record<string, string> = {
  "war-room": "/war-room",
  "benchmarking": "/benefits-benchmarking",
  "rx-defense": "/rx-defense",
  "broker-prospects": "/broker-prospects",
  "sales-iq": "/sales-iq-intel",
};

/**
 * Resolves a `/s/:shortId` short link: fetches the saved view-state from the
 * backend, then redirects into the correct page with that state applied via
 * query params. Unresolved/expired links land on a friendly message.
 */
export default function ShareResolver() {
  const [, params] = useRoute("/s/:shortId");
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const shortId = params?.shortId;
    if (!shortId) { setStatus("error"); return; }
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`/api/share-links/${encodeURIComponent(shortId)}`, { credentials: "include" });
        if (!r.ok) { if (!cancelled) setStatus("error"); return; }
        const data = await r.json();
        const path = PAGE_PATHS[data?.page];
        if (!path) { if (!cancelled) setStatus("error"); return; }

        const qs = new URLSearchParams();
        const state = data.state || {};
        Object.keys(state).forEach((k) => {
          const v = state[k];
          if (v === null || v === undefined || v === "") return;
          qs.set(k, typeof v === "string" ? v : String(v));
        });
        const target = qs.toString() ? `${path}?${qs.toString()}` : path;
        if (!cancelled) navigate(target, { replace: true });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.shortId]);

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg,#F8FAFC 0%,#FFFFFF 50%,#F8FAFC 100%)", fontFamily: "system-ui,sans-serif" }}>
        <div style={{ maxWidth: 460, padding: "44px 36px", background: "#ffffff",
          border: "1px solid #e2e8f0", borderRadius: 20, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.3)" }}>
            <AlertTriangle style={{ width: 26, height: 26, color: "#FFB800" }} />
          </div>
          <h1 style={{ color: "#0F172A", fontSize: 20, fontWeight: 800, marginBottom: 10 }}>This link is no longer available</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6, marginBottom: 26 }}>
            The shared view you're trying to open has expired or the link is invalid. Ask the sender for a fresh link.
          </p>
          <button
            data-testid="share-error-home"
            onClick={() => navigate("/")}
            style={{ padding: "11px 22px", borderRadius: 10, background: "rgba(0,168,255,0.15)",
              border: "1px solid rgba(0,168,255,0.3)", color: "#00a8ff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg,#F8FAFC 0%,#FFFFFF 50%,#F8FAFC 100%)", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(191,95,255,0.12)", border: "1px solid rgba(191,95,255,0.3)" }}>
          <LinkIcon style={{ width: 22, height: 22, color: "#BF5FFF" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#1e293b", fontSize: 13 }}>
          <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
          Opening shared view…
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
