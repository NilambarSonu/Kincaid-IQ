import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { BrainCircuit, Send, User, Loader2, Sparkles, RotateCcw } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTED = [
  "What's my current effective tax rate and biggest tax exposure?",
  "Which positions have the most unrealized gain — and how much?",
  "How does my portfolio compare to the Yale endowment model?",
  "What's my net liquidity position if markets drop 30%?",
  "What's my uncalled capital commitment and when is it likely due?",
  "How much income am I generating annually across all sources?",
  "What's the estate tax exposure if I die tomorrow?",
  "Which PE fund has the best current TVPI and why?",
];

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (line.match(/^#{1,3}\s/)) return <p key={i} className="font-bold text-white mt-3">{line.replace(/^#{1,3}\s/, "")}</p>;
        if (line.match(/^\*\*.*\*\*$/)) return <p key={i} className="font-semibold text-white mt-2">{line.replace(/\*\*/g, "")}</p>;
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 flex gap-2 text-muted-foreground"><span style={{ color: "rgba(0,168,255,0.5)" }}>·</span>{line.slice(2)}</p>;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} />;
      })}
    </div>
  );
}

export default function AskPortfolio() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (question?: string) => {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/ask-portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: messages }),
        credentials: "include",
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.answer || data.detail || "No response." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Connection error — please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6 animate-float-up">
        <p className="section-label mb-1">AI Intelligence</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Ask My Portfolio
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Natural language Q&A — powered by GPT-4o with full portfolio context</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: 480 }}>
          <div className="metric-card flex-1 overflow-y-auto custom-scrollbar mb-3" style={{ minHeight: 0 }}
            data-testid="chat-messages">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(0,168,255,0.08)", border: "1px solid rgba(0,168,255,0.15)" }}>
                  <BrainCircuit size={24} style={{ color: "#00A8FF" }} />
                </div>
                <p className="font-bold text-white mb-1">Ask anything about your portfolio</p>
                <p className="text-xs text-muted-foreground mb-6 text-center max-w-sm">
                  Full context: $2.41B net worth, 12 PE/VC funds, 4 properties, 6 legal entities, tax position, liquidity
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                  {SUGGESTED.slice(0, 4).map((q) => (
                    <button key={q} onClick={() => send(q)}
                      className="text-left px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-white transition-all"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                      data-testid="suggestion-button">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 p-1">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${m.role}`}>
                    {m.role === "assistant" && (
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.2)" }}>
                        <BrainCircuit size={13} style={{ color: "#00A8FF" }} />
                      </div>
                    )}
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${m.role === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                      style={{
                        background: m.role === "user" ? "rgba(0,168,255,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${m.role === "user" ? "rgba(0,168,255,0.2)" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      {m.role === "user"
                        ? <p className="text-sm text-white">{m.content}</p>
                        : <MarkdownText text={m.content} />}
                    </div>
                    {m.role === "user" && (
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.2)" }}>
                        <User size={13} style={{ color: "#FFB800" }} />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-3" data-testid="loading-indicator">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.2)" }}>
                      <BrainCircuit size={13} style={{ color: "#00A8FF" }} />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <Loader2 size={12} className="animate-spin" style={{ color: "#00A8FF" }} />
                      <span className="text-xs text-muted-foreground">Analyzing your portfolio…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask anything about your portfolio…"
              className="flex-1 text-sm px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
              data-testid="input-question"
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="px-4 py-3 rounded-xl transition-all"
              style={{
                background: input.trim() ? "rgba(0,168,255,0.12)" : "rgba(0,168,255,0.04)",
                border: "1px solid rgba(0,168,255,0.25)",
                color: input.trim() ? "#00A8FF" : "rgba(0,168,255,0.3)",
              }}
              data-testid="button-send"
            >
              <Send size={15} />
            </button>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])}
                className="px-3 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(150,170,210,0.4)" }}
                title="Clear chat" data-testid="button-clear-chat">
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="metric-card" data-testid="card-suggested-questions">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={12} style={{ color: "#FFB800" }} />
              <p className="section-label">Suggested Questions</p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTED.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-lg text-muted-foreground hover:text-white transition-all hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.04)" }}
                  data-testid="sidebar-suggestion">
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="metric-card" data-testid="card-portfolio-context">
            <p className="section-label mb-3">Context Active</p>
            {[
              { label: "Net Worth", value: "$2.41B" },
              { label: "Asset Classes", value: "7" },
              { label: "PE/VC Funds", value: "12" },
              { label: "Legal Entities", value: "6" },
              { label: "Properties", value: "4" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-xs py-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-semibold text-white">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
