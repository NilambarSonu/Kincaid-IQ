import { Bot, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";

interface ResultPanelProps {
  provider: "openai" | "anthropic" | "anthropic-kincaid";
  content: string;
  isPending: boolean;
}

export function ResultPanel({ provider, content, isPending }: ResultPanelProps) {
  const isOpenAI = provider === "openai";
  const isKincaid = provider === "anthropic-kincaid";

  const config = isKincaid
    ? { title: "Kincaid Health Engine", icon: <Bot size={16} />, accent: "#00A8FF", bg: "rgba(0,140,255,0.07)", border: "rgba(0,140,255,0.18)" }
    : isOpenAI
    ? { title: "OpenAI (ChatGPT)", icon: <Sparkles size={16} />, accent: "#00FF94", bg: "rgba(0,255,148,0.06)", border: "rgba(0,255,148,0.18)" }
    : { title: "Anthropic (Claude)", icon: <Bot size={16} />, accent: "#FFB800", bg: "rgba(255,184,0,0.06)", border: "rgba(255,184,0,0.18)" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{
        background: "rgba(5, 8, 40, 0.78)",
        backdropFilter: "blur(24px)",
        border: `1px solid ${config.border}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.08), 0 0 24px ${config.accent}12`,
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: `1px solid ${config.border}`, background: config.bg }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${config.accent}18`, border: `1px solid ${config.accent}30`, color: config.accent }}
          >
            {config.icon}
          </div>
          <h3 className="font-bold text-slate-900 text-sm" style={{ fontFamily: "var(--font-display)" }}>
            {config.title}
          </h3>
        </div>

        {isPending ? (
          <div
            className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: `${config.accent}12`, border: `1px solid ${config.accent}25`, color: config.accent }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: config.accent }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: config.accent }} />
            </span>
            Generating...
          </div>
        ) : content ? (
          <div
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "rgba(130,160,200,0.55)" }}
          >
            Complete
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto custom-scrollbar relative min-h-[300px] md:min-h-[460px]">
        {isPending ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: `${config.accent}35`, borderTopColor: config.accent }}
              />
              <p className="text-xs font-medium" style={{ color: `${config.accent}70` }}>
                Awaiting {config.title}...
              </p>
            </div>
          </div>
        ) : content ? (
          <div className="prose prose-sm max-w-none prose-invert prose-headings:font-semibold prose-a:text-blue-400">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm"
            style={{ color: "rgba(130,160,200,0.28)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
              style={{ background: `${config.accent}07`, color: `${config.accent}40` }}
            >
              {config.icon}
            </div>
            Ready for input
          </div>
        )}
      </div>
    </motion.div>
  );
}
