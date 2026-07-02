import { useState, useRef, useEffect } from "react";
import { Share2, Link2, Mail, Check, X, Loader2, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type SharePage = "war-room" | "benchmarking" | "rx-defense" | "broker-prospects" | "sales-iq";

type ExpiryOption = { label: string; hours: number | null };

const EXPIRY_OPTIONS: ExpiryOption[] = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
  { label: "Never", hours: null },
];

interface ShareMenuProps {
  /** Which page this share link points back to. */
  page: SharePage;
  /** Returns the page's full serialized view-state as a plain object. */
  getState: () => Record<string, any>;
  /** Optional human label stored with the link. */
  getTitle?: () => string | undefined;
  /** Button label. Defaults to "Share". */
  label?: string;
  /** Accent color (hex) for the control. Defaults to a violet. */
  accent?: string;
  /** Menu alignment relative to the button. */
  align?: "left" | "right";
  /** data-testid prefix. */
  testIdPrefix?: string;
}

/**
 * Reusable Share control. Renders a button that opens a small menu with two
 * actions: Copy link and Email link. Both mint a short branded link
 * (`/s/{shortId}`) via the backend, capturing the page's current view-state.
 */
export function ShareMenu({
  page,
  getState,
  getTitle,
  label = "Share",
  accent = "#BF5FFF",
  align = "right",
  testIdPrefix = "share",
}: ShareMenuProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [expiryHours, setExpiryHours] = useState<number | null>(EXPIRY_OPTIONS[1].hours);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEmailMode(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function mintLink(): Promise<string> {
    const res = await apiRequest("POST", "/api/share-links", {
      page,
      state: getState() || {},
      title: getTitle?.(),
      expires_in_hours: expiryHours,
    });
    const data = await res.json();
    if (!data?.short_id) throw new Error("No link returned");
    return data.short_id as string;
  }

  function fullUrl(shortId: string): string {
    return `${window.location.origin}/s/${shortId}`;
  }

  async function handleCopy() {
    setBusy(true);
    try {
      const shortId = await mintLink();
      const url = fullUrl(shortId);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Fallback for browsers/contexts without clipboard API
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({ title: "Link copied", description: "A shareable link is on your clipboard." });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Couldn't create link", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmail() {
    if (!recipient.trim()) {
      toast({ title: "Recipient required", description: "Enter an email address.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const shortId = await mintLink();
      const url = fullUrl(shortId);
      await apiRequest("POST", `/api/share-links/${shortId}/email`, {
        recipient: recipient.trim(),
        note: note.trim(),
        url,
      });
      toast({ title: "Link sent", description: `Shared view emailed to ${recipient.trim()}.` });
      setOpen(false);
      setEmailMode(false);
      setRecipient("");
      setNote("");
    } catch (e: any) {
      toast({ title: "Couldn't send link", description: e?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const menuPos = align === "right" ? { right: 0 } : { left: 0 };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        data-testid={`${testIdPrefix}-button`}
        onClick={() => { setOpen(o => !o); setEmailMode(false); }}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
        style={{
          background: `${accent}1F`,
          border: `1px solid ${accent}59`,
          color: accent,
          boxShadow: `0 0 20px ${accent}1A`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}33`; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}1F`; }}
      >
        <Share2 className="w-3.5 h-3.5" />
        {label}
      </button>

      {open && (
        <div
          data-testid={`${testIdPrefix}-menu`}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            ...menuPos,
            zIndex: 70,
            width: emailMode ? 300 : 230,
            background: "#0d0d16",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            padding: 8,
          }}
        >
          {!emailMode ? (
            <>
              <div style={{ padding: "4px 8px 8px" }}>
                <div
                  className="flex items-center gap-1.5 mb-2"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Link expires</span>
                </div>
                <div
                  data-testid={`${testIdPrefix}-expiry`}
                  className="grid grid-cols-2 gap-1.5"
                >
                  {EXPIRY_OPTIONS.map((opt) => {
                    const selected = opt.hours === expiryHours;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        data-testid={`${testIdPrefix}-expiry-${opt.hours ?? "never"}`}
                        onClick={() => setExpiryHours(opt.hours)}
                        className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                        style={{
                          background: selected ? `${accent}26` : "rgba(255,255,255,0.04)",
                          border: `1px solid ${selected ? `${accent}59` : "rgba(255,255,255,0.08)"}`,
                          color: selected ? accent : "rgba(255,255,255,0.6)",
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "0 4px 6px" }} />
              <button
                type="button"
                data-testid={`${testIdPrefix}-copy`}
                disabled={busy}
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{ background: "transparent", color: "rgba(255,255,255,0.85)", cursor: busy ? "wait" : "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} /> : <Link2 className="w-4 h-4" style={{ color: accent }} />}
                <div>
                  <div className="text-[13px] font-bold">Copy link</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Short branded URL to this view</div>
                </div>
              </button>
              <button
                type="button"
                data-testid={`${testIdPrefix}-email`}
                disabled={busy}
                onClick={() => setEmailMode(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                style={{ background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Mail className="w-4 h-4" style={{ color: accent }} />
                <div>
                  <div className="text-[13px] font-bold">Email link</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Send the link to someone</div>
                </div>
              </button>
            </>
          ) : (
            <div style={{ padding: 4 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>Email link</span>
                <button type="button" onClick={() => setEmailMode(false)} style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                data-testid={`${testIdPrefix}-email-recipient`}
                type="email"
                placeholder="recipient@example.com"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="w-full mb-2 px-3 py-2 rounded-lg text-[13px]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", outline: "none" }}
              />
              <textarea
                data-testid={`${testIdPrefix}-email-note`}
                placeholder="Add a note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="w-full mb-2 px-3 py-2 rounded-lg text-[12px] resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", outline: "none" }}
              />
              <button
                type="button"
                data-testid={`${testIdPrefix}-email-send`}
                disabled={busy}
                onClick={handleSendEmail}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all"
                style={{ background: `${accent}26`, border: `1px solid ${accent}59`, color: accent, cursor: busy ? "wait" : "pointer" }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Send link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
