import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";
import {
  Send, Sparkles, GitBranch, LayoutGrid, Target, Shield,
  BarChart3, TrendingUp, Link, Crosshair, ChevronRight,
  Copy, Check, RotateCcw, BrainCircuit, Loader2, Paperclip, X,
} from "lucide-react";

const BG = "#F8FAFC";
const SURFACE = "#ffffff";
const BORDER = "#e2e8f0";
const ACCENT = "#4f7dff";

const ICON_MAP: Record<string, any> = {
  GitBranch, LayoutGrid, Target, Shield, BarChart3, TrendingUp, Link, Crosshair,
};

type Message = { role: "user" | "assistant"; content: string };

type Framework = {
  id: string;
  name: string;
  icon: string;
  description: string;
  prompt_prefix: string;
};

const STARTER_PROMPTS = [
  "Analyze our healthcare PBM contract for hidden cost drivers using MECE issue tree",
  "Apply Porter's Five Forces to the self-funded employer health plan market",
  "Build a BCG matrix for our service line portfolio — which to invest, hold, or exit?",
  "Use the Pyramid Principle to frame our ERISA compliance recommendation for the board",
  "Map our 3 Horizons of Growth for the next 36 months in healthcare analytics",
  "Perform a McKinsey 7-S analysis of our fiduciary governance structure",
];

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-base font-bold mt-4 mb-1" style={{ color: ACCENT }}>
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-lg font-bold mt-4 mb-1 text-[var(--kiq-ink)]">
              {line.replace("# ", "")}
            </h1>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-sm font-semibold mt-3 mb-1 text-[var(--kiq-ink)]">
              {line.replace("### ", "")}
            </h3>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <span style={{ color: ACCENT }} className="mt-0.5 text-xs flex-shrink-0">●</span>
              <span style={{ color: "#0f172a" }}>
                {line.replace(/^[-•]\s/, "")}
              </span>
            </div>
          );
        }
        if (line.match(/^\d+\.\s/)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2 items-start">
              <span style={{ color: ACCENT, minWidth: "20px" }} className="font-bold text-xs">{num}.</span>
              <span style={{ color: "#0f172a" }}>
                {line.replace(/^\d+\.\s/, "")}
              </span>
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-[var(--kiq-ink)]">
              {line.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} style={{ color: "rgba(255,255,255,0.75)" }}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="text-[var(--kiq-ink)] font-semibold">
                  {part.replace(/\*\*/g, "")}
                </strong>
              ) : part
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function McKinseyCoPilot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: frameworksData } = useQuery<{ frameworks: Framework[] }>({
    queryKey: ["/api/mckinsey/frameworks"],
  });

  const frameworks = frameworksData?.frameworks || [];

  const chatMutation = useMutation({
    mutationFn: async (msg: string) => {
      const docContext = uploadedDoc
        ? `\n\n[Attached Document: ${uploadedDoc.filename}]\n${uploadedDoc.text.slice(0, 12000)}`
        : undefined;
      const res = await apiRequest("POST", "/api/mckinsey/chat", {
        message: msg,
        history: messages,
        framework: selectedFramework,
        context: docContext,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    chatMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const activeFramework = frameworks.find((f) => f.id === selectedFramework);

  return (
    <Layout>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: BG, color: "#0F172A" }}
      >
        {/* Sidebar — Frameworks */}
        <div
          className="w-72 flex-shrink-0 flex flex-col border-r overflow-y-auto"
          style={{ borderColor: BORDER, background: "#ffffff" }}
        >
          <div className="p-4 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 mb-1">
              <BrainCircuit size={18} style={{ color: ACCENT }} />
              <span className="font-bold text-sm">McKinsey Co-Pilot</span>
              <Badge
                className="ml-auto text-xs"
                style={{ background: "rgba(79,125,255,0.15)", color: ACCENT, border: "none" }}
              >
                ENTERPRISE
              </Badge>
            </div>
            <p className="text-xs" style={{ color: "#475569" }}>
              Elite strategic advisor powered by McKinsey frameworks
            </p>
          </div>

          {/* Framework selector */}
          <div className="p-4">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#64748b" }}
            >
              Apply a Framework
            </p>
            <div className="space-y-1.5">
              <button
                data-testid="framework-none"
                onClick={() => setSelectedFramework(null)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all"
                style={{
                  background: !selectedFramework ? "rgba(79,125,255,0.15)" : "transparent",
                  border: `1px solid ${!selectedFramework ? "rgba(79,125,255,0.4)" : "transparent"}`,
                  color: !selectedFramework ? ACCENT : "#334155",
                }}
              >
                Free-form chat
              </button>
              {frameworks.map((fw) => {
                const Icon = ICON_MAP[fw.icon] || Sparkles;
                const active = selectedFramework === fw.id;
                return (
                  <button
                    key={fw.id}
                    data-testid={`framework-${fw.id}`}
                    onClick={() => setSelectedFramework(active ? null : fw.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                    style={{
                      background: active ? "rgba(79,125,255,0.15)" : "transparent",
                      border: `1px solid ${active ? "rgba(79,125,255,0.4)" : "transparent"}`,
                      color: active ? ACCENT : "#1e293b",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={13} />
                      <span className="text-xs font-medium">{fw.name}</span>
                    </div>
                    <p
                      className="text-xs mt-1 pl-5"
                      style={{ color: "#64748b" }}
                    >
                      {fw.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Starter prompts */}
          {messages.length === 0 && (
            <div className="p-4 border-t" style={{ borderColor: BORDER }}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#64748b" }}
              >
                Try These
              </p>
              <div className="space-y-2">
                {STARTER_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    data-testid={`starter-prompt-${i}`}
                    onClick={() => setInput(p)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all"
                    style={{
                      background: "#ffffff",
                      border: `1px solid ${BORDER}`,
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    <ChevronRight
                      size={10}
                      className="inline mr-1"
                      style={{ color: ACCENT }}
                    />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0"
            style={{ borderColor: BORDER }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `rgba(79,125,255,0.2)` }}
            >
              <BrainCircuit size={16} style={{ color: ACCENT }} />
            </div>
            <div>
              <div className="font-bold text-sm">McKinsey Co-Pilot™</div>
              <div className="text-xs" style={{ color: "#475569" }}>
                {activeFramework
                  ? `Framework: ${activeFramework.name} active`
                  : "Fiduciary-grade strategic intelligence · MECE · Hypothesis-led"}
              </div>
            </div>
            {messages.length > 0 && (
              <button
                data-testid="btn-clear-chat"
                onClick={() => setMessages([])}
                className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: "#f8fafc",
                  border: `1px solid ${BORDER}`,
                  color: "#475569",
                }}
              >
                <RotateCcw size={12} />
                New Session
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(79,125,255,0.1)", border: `1px solid rgba(79,125,255,0.2)` }}
                  >
                    <BrainCircuit size={32} style={{ color: ACCENT }} />
                  </div>
                  <h2 className="text-xl font-bold mb-2">McKinsey Co-Pilot</h2>
                  <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Your elite AI strategic advisor. Apply world-class consulting frameworks to your
                    healthcare, fiduciary, and portfolio challenges.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {["MECE Analysis", "Issue Trees", "BCG Matrix", "Pyramid Principle"].map((t) => (
                      <div
                        key={t}
                        className="px-3 py-2 rounded-lg text-xs"
                        style={{
                          background: "rgba(79,125,255,0.08)",
                          border: "1px solid rgba(79,125,255,0.15)",
                          color: ACCENT,
                        }}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-3`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: "rgba(79,125,255,0.2)" }}
                  >
                    <BrainCircuit size={13} style={{ color: ACCENT }} />
                  </div>
                )}
                <div
                  className="max-w-3xl rounded-2xl px-5 py-4 relative group"
                  style={
                    msg.role === "user"
                      ? {
                          background: "rgba(79,125,255,0.15)",
                          border: "1px solid rgba(79,125,255,0.25)",
                          color: "#0F172A",
                          borderBottomRightRadius: 4,
                        }
                      : {
                          background: SURFACE,
                          border: `1px solid ${BORDER}`,
                          borderBottomLeftRadius: 4,
                        }
                  }
                >
                  {msg.role === "assistant" ? (
                    <MarkdownText content={msg.content} />
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                  {msg.role === "assistant" && (
                    <button
                      data-testid={`btn-copy-${idx}`}
                      onClick={() => copyMessage(msg.content, idx)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                      style={{ color: "#64748b" }}
                    >
                      {copiedIdx === idx ? (
                        <Check size={13} style={{ color: "#22c55e" }} />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex justify-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(79,125,255,0.2)" }}
                >
                  <BrainCircuit size={13} style={{ color: ACCENT }} />
                </div>
                <div
                  className="px-5 py-4 rounded-2xl flex items-center gap-2"
                  style={{
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderBottomLeftRadius: 4,
                  }}
                >
                  <Loader2 size={14} className="animate-spin" style={{ color: ACCENT }} />
                  <span className="text-xs" style={{ color: "#475569" }}>
                    Applying McKinsey frameworks…
                  </span>
                </div>
              </div>
            )}

            {chatMutation.isError && (
              <div
                className="text-center py-3 px-4 rounded-lg text-sm"
                style={{
                  background: "rgba(217,119,6,0.1)",
                  border: "1px solid rgba(217,119,6,0.2)",
                  color: "#d97706",
                }}
              >
                Analysis failed. Please try again.
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="px-6 py-4 border-t flex-shrink-0"
            style={{ borderColor: BORDER, background: "rgba(255,255,255,0.01)" }}
          >
            {activeFramework && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs"
                style={{
                  background: "rgba(79,125,255,0.08)",
                  border: "1px solid rgba(79,125,255,0.2)",
                  color: ACCENT,
                }}
              >
                <Sparkles size={11} />
                <span>
                  Framework active: <strong>{activeFramework.name}</strong> — your query will be structured accordingly
                </span>
                <button
                  onClick={() => setSelectedFramework(null)}
                  className="ml-auto hover:opacity-70"
                >
                  ×
                </button>
              </div>
            )}
            {uploadedDoc && (
              <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(0,255,148,0.07)", border: "1px solid rgba(0,255,148,0.2)", color: "#00FF94" }}>
                <Paperclip size={11} />
                <span className="truncate flex-1">{uploadedDoc.filename}</span>
                <button onClick={() => setUploadedDoc(null)} className="hover:opacity-70">
                  <X size={11} />
                </button>
              </div>
            )}
            {showUpload && !uploadedDoc && (
              <div className="mb-3">
                <FileUploadZone
                  label="Attach a document to analyze"
                  hint="PDF, DOCX, TXT, CSV, or XLSX — the Co-Pilot will read and reference it"
                  onDocumentReady={(doc) => { setUploadedDoc(doc); setShowUpload(false); }}
                  compact={false}
                />
              </div>
            )}
            <div className="flex gap-3 items-end">
              <Textarea
                data-testid="input-mckinsey-chat"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeFramework
                    ? `Describe your topic for ${activeFramework.name} analysis…`
                    : "Ask any strategic question — MECE, frameworks, recommendations…"
                }
                className="flex-1 resize-none text-sm min-h-[52px] max-h-32"
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  color: "#0F172A",
                  borderRadius: 12,
                }}
                rows={2}
              />
              <button
                data-testid="btn-attach-mckinsey"
                onClick={() => setShowUpload(s => !s)}
                className="h-[52px] w-[42px] rounded-xl flex-shrink-0 flex items-center justify-center transition-all"
                style={{
                  background: showUpload ? "rgba(79,125,255,0.2)" : SURFACE,
                  border: `1px solid ${showUpload ? "rgba(79,125,255,0.4)" : BORDER}`,
                  color: showUpload ? ACCENT : "#64748b",
                }}
                title="Attach document"
              >
                <Paperclip size={16} />
              </button>
              <Button
                data-testid="btn-send-mckinsey"
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="h-[52px] w-[52px] rounded-xl flex-shrink-0"
                style={{ background: ACCENT }}
              >
                {chatMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </Button>
            </div>
            <p className="text-xs mt-2 text-center" style={{ color: "#94a3b8" }}>
              McKinsey Co-Pilot uses Claude claude-opus-4-5 with proprietary McKinsey frameworks · Enterprise only
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
