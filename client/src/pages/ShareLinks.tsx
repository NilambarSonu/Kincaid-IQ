import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link2, Trash2, Check, Loader2, Share2, Clock, AlertTriangle } from "lucide-react";

type ShareLinkRow = {
  short_id: string;
  page: string;
  page_label: string;
  title: string | null;
  created_at: string | null;
  expires_at: string | null;
  expired: boolean;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function ShareLinks() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ links: ShareLinkRow[] }>({
    queryKey: ["/api/share-links"],
  });

  const revoke = useMutation({
    mutationFn: async (shortId: string) => {
      await apiRequest("DELETE", `/api/share-links/${shortId}`);
      return shortId;
    },
    onMutate: (shortId: string) => setPendingRevoke(shortId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/share-links"] });
      toast({ title: "Link revoked", description: "The shared view is no longer available." });
    },
    onError: (e: any) => {
      toast({ title: "Couldn't revoke link", description: e?.message ?? "Please try again.", variant: "destructive" });
    },
    onSettled: () => setPendingRevoke(null),
  });

  async function handleCopy(shortId: string) {
    const url = `${window.location.origin}/s/${shortId}`;
    await copyToClipboard(url);
    setCopiedId(shortId);
    toast({ title: "Link copied", description: "A shareable link is on your clipboard." });
    setTimeout(() => setCopiedId((c) => (c === shortId ? null : c)), 1800);
  }

  const links = data?.links ?? [];

  return (
    <Layout>
      <div data-testid="page-share-links">
        <div className="flex items-center gap-3 mb-1.5">
          <div
            style={{
              width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(191,95,255,0.12)", border: "1px solid rgba(191,95,255,0.3)",
            }}
          >
            <Share2 style={{ width: 20, height: 20, color: "#BF5FFF" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--kiq-ink)] tracking-tight">Shared Links</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Review the share links you've created and revoke any that should no longer be open.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center gap-3 py-16 justify-center" style={{ color: "#334155" }}>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading your share links…</span>
            </div>
          ) : isError ? (
            <div
              className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl"
              style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}
            >
              <AlertTriangle className="w-8 h-8" style={{ color: "#FFB800" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                Couldn't load your share links. Please refresh and try again.
              </p>
            </div>
          ) : links.length === 0 ? (
            <div
              data-testid="empty-share-links"
              className="flex flex-col items-center text-center gap-3 py-16 rounded-2xl"
              style={{ background: "#ffffff", border: "1px solid #f1f5f9" }}
            >
              <div
                style={{
                  width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(191,95,255,0.1)", border: "1px solid rgba(191,95,255,0.25)",
                }}
              >
                <Link2 className="w-6 h-6" style={{ color: "#BF5FFF" }} />
              </div>
              <h2 className="text-base font-bold text-[var(--kiq-ink)]">No share links yet</h2>
              <p className="text-sm max-w-md" style={{ color: "rgba(255,255,255,0.45)" }}>
                Use the Share button on War Room, Benefits Benchmarking, PBM Contract Clarity 360, or the Broker Console to
                create a branded link. They'll show up here so you can manage and revoke them.
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
            >
              <div
                className="hidden md:grid items-center px-5 py-3 text-[10px] font-bold uppercase tracking-wider"
                style={{ gridTemplateColumns: "1fr 160px 130px 130px 150px", color: "#475569", borderBottom: "1px solid #f1f5f9" }}
              >
                <span>View</span>
                <span>Page</span>
                <span>Created</span>
                <span>Expiry</span>
                <span className="text-right">Actions</span>
              </div>

              {links.map((link) => {
                const busy = pendingRevoke === link.short_id;
                return (
                  <div
                    key={link.short_id}
                    data-testid={`row-share-link-${link.short_id}`}
                    className="grid items-center px-5 py-4 gap-y-2"
                    style={{
                      gridTemplateColumns: "1fr 160px 130px 130px 150px",
                      borderBottom: "1px solid #ffffff",
                      opacity: link.expired ? 0.6 : 1,
                    }}
                  >
                    <div className="min-w-0 pr-4">
                      <div className="text-sm font-semibold text-[var(--kiq-ink)] truncate" data-testid={`text-title-${link.short_id}`}>
                        {link.title || link.page_label}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: "#64748b" }}>
                        /s/{link.short_id}
                      </div>
                    </div>

                    <div className="text-xs" style={{ color: "#1e293b" }} data-testid={`text-page-${link.short_id}`}>
                      {link.page_label}
                    </div>

                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }} data-testid={`text-created-${link.short_id}`}>
                      {fmtDate(link.created_at)}
                    </div>

                    <div className="text-xs flex items-center gap-1.5" data-testid={`text-expiry-${link.short_id}`}>
                      {link.expired ? (
                        <span className="flex items-center gap-1" style={{ color: "#FF6B6B" }}>
                          <Clock className="w-3 h-3" /> Expired
                        </span>
                      ) : link.expires_at ? (
                        <span style={{ color: "rgba(255,255,255,0.55)" }}>{fmtDate(link.expires_at)}</span>
                      ) : (
                        <span style={{ color: "#64748b" }}>Never</span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        data-testid={`button-copy-${link.short_id}`}
                        onClick={() => handleCopy(link.short_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          background: "rgba(191,95,255,0.1)", border: "1px solid rgba(191,95,255,0.28)", color: "#BF5FFF",
                        }}
                        title="Copy link"
                      >
                        {copiedId === link.short_id ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                        {copiedId === link.short_id ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        data-testid={`button-revoke-${link.short_id}`}
                        disabled={busy}
                        onClick={() => revoke.mutate(link.short_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", color: "#FF4D6D",
                          cursor: busy ? "wait" : "pointer",
                        }}
                        title="Revoke link"
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Revoke
                      </button>
                    </div>
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
