import { useState } from "react";
import { Layout } from "@/components/Layout";
import { advisorMessages, clientProfile } from "@/lib/mockData";
import { Mail, Paperclip, ChevronRight, Reply, Star, AlertCircle, Info, CheckCircle, Clock } from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";

const PRIORITY_STYLES: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  High:   { color: "#FF4D6D", bg: "rgba(255,77,109,0.08)", border: "rgba(255,77,109,0.2)", icon: AlertCircle },
  Medium: { color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.2)", icon: Info },
  Low:    { color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)", icon: CheckCircle },
};

function formatBody(body: string) {
  return body.split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-3" />;
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
        {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{part}</strong> : part)}
      </p>
    );
  });
}

export default function AdvisorMessages() {
  const { open } = useDrillDown();
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sentReplies, setSentReplies] = useState<Set<number>>(new Set());

  const selected = advisorMessages.find((m) => m.id === selectedId) || null;
  const unreadCount = advisorMessages.filter((m) => m.unread).length;

  const handleReply = () => {
    if (!replyText.trim() || !selectedId) return;
    setSentReplies((prev) => new Set(Array.from(prev).concat(selectedId as number)));
    setReplyText("");
    setReplyOpen(false);
  };

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Advisor Channel</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              Advisor Messaging
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Secure communications with your Kincaid RMC advisory team</p>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.2)" }}>
              <span className="text-sm font-bold" style={{ color: "#FF4D6D" }}>{unreadCount}</span>
              <span className="text-xs text-muted-foreground">unread</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 600 }}>
        <div className="space-y-2" data-testid="list-messages">
          {advisorMessages.map((msg) => {
            const ps = PRIORITY_STYLES[msg.priority];
            const PIcon = ps.icon;
            const isSelected = selectedId === msg.id;
            const replySent = sentReplies.has(msg.id);
            return (
              <button
                key={msg.id}
                onClick={() => { setSelectedId(msg.id); setReplyOpen(false); }}
                className="w-full text-left p-4 rounded-xl transition-all duration-200"
                style={{
                  background: isSelected ? "rgba(0,168,255,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSelected ? "rgba(0,168,255,0.25)" : "rgba(255,255,255,0.06)"}`,
                }}
                data-testid={`row-message-${msg.id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: ps.bg, border: `1px solid ${ps.border}`, color: ps.color }}
                  >
                    {msg.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-semibold truncate" style={{ color: msg.unread && !replySent ? "white" : "rgba(150,170,210,0.7)" }}>
                        {msg.from}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {msg.unread && !replySent && <div className="w-2 h-2 rounded-full" style={{ background: "#FF4D6D" }} />}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{msg.date.split("-").slice(1).join("/")}</span>
                      </div>
                    </div>
                    <p className="text-xs font-medium truncate mb-1" style={{ color: msg.unread && !replySent ? "rgba(200,220,255,0.9)" : "rgba(130,150,200,0.5)" }}>
                      {msg.subject}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                        <PIcon size={8} />{msg.priority}
                      </span>
                      {msg.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Paperclip size={8} />{msg.attachments.length}
                        </span>
                      )}
                      {replySent && <span className="text-[10px]" style={{ color: "#00FF94" }}>✓ Replied</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2" data-testid="panel-message-detail">
          {selected ? (
            <div className="metric-card h-full flex flex-col" style={{ minHeight: 500 }}>
              <div className="flex items-start justify-between mb-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: PRIORITY_STYLES[selected.priority].bg, border: `1px solid ${PRIORITY_STYLES[selected.priority].border}`, color: PRIORITY_STYLES[selected.priority].color }}
                  >
                    {selected.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-white">{selected.from}</p>
                    <p className="text-xs text-muted-foreground">{selected.role} · Kincaid RMC</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock size={9} /> {new Date(selected.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                    style={{ background: PRIORITY_STYLES[selected.priority].bg, color: PRIORITY_STYLES[selected.priority].color, border: `1px solid ${PRIORITY_STYLES[selected.priority].border}` }}>
                    {selected.priority} Priority
                  </span>
                </div>
              </div>

              <p className="text-base font-bold text-white mb-4">{selected.subject}</p>

              <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar pr-1">
                {formatBody(selected.body)}
              </div>

              {selected.attachments.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs text-muted-foreground mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.attachments.map((att) => (
                      <div key={att} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                        style={{ background: "rgba(0,168,255,0.07)", border: "1px solid rgba(0,168,255,0.15)", color: "#00A8FF" }}>
                        <Paperclip size={10} />
                        {att}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {!replyOpen ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setReplyOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: "rgba(0,168,255,0.10)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF" }}
                      data-testid="button-reply"
                    >
                      <Reply size={13} /> Reply
                    </button>
                    <button
                      onClick={() => open("net-worth")}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", color: "#FFB800" }}
                      data-testid="button-request-briefing"
                    >
                      <Star size={13} /> Request Meeting Brief
                    </button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to ${selected.from}…`}
                      rows={4}
                      className="w-full text-sm px-3 py-2.5 rounded-xl mb-3 resize-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,168,255,0.2)", color: "white" }}
                      data-testid="textarea-reply"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: replyText.trim() ? "rgba(0,255,148,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${replyText.trim() ? "rgba(0,255,148,0.25)" : "rgba(255,255,255,0.06)"}`, color: replyText.trim() ? "#00FF94" : "rgba(150,170,210,0.3)", cursor: replyText.trim() ? "pointer" : "not-allowed" }}
                        data-testid="button-send-reply"
                      >
                        Send Reply
                      </button>
                      <button
                        onClick={() => setReplyOpen(false)}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all text-muted-foreground hover:text-white"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        data-testid="button-cancel-reply"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="metric-card flex items-center justify-center h-full" style={{ minHeight: 400 }}>
              <div className="text-center">
                <Mail size={32} style={{ color: "rgba(0,168,255,0.2)", margin: "0 auto 12px" }} />
                <p className="text-muted-foreground text-sm">Select a message to read</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
