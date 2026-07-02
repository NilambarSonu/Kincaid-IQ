import { useState } from "react";
import { Send, Sparkles, AlertCircle, BrainCircuit, Zap } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ResultPanel } from "@/components/ResultPanel";
import { useSubmitPrompt } from "@/hooks/use-logs";
import { type Log } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

const examplePrompts = [
  "Analyze my portfolio concentration risk and suggest rebalancing",
  "What is the impact of a 200bps rate hike on my bond holdings?",
  "Evaluate the NovaCare Health Systems co-investment opportunity",
  "How should I think about liquidity management given my current burn rate?",
];

export default function Advisory() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<Log[] | null>(null);
  const { mutate: submitPrompt, isPending, error } = useSubmitPrompt();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isPending) return;
    submitPrompt(prompt, { onSuccess: (data) => setResults(data) });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const openAiResult = results?.find((r) => r.provider === "openai");
  const anthropicResult = results?.find((r) => r.provider === "anthropic" || r.provider === "anthropic-kincaid");

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Intelligence Layer</p>
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>
          AI <span className="gold-text-glow">Advisory</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Dual-engine fiduciary analysis · OpenAI + Anthropic Claude respond simultaneously
        </p>
      </div>

      {/* Engine Status */}
      <div
        className="flex items-center gap-3 mb-6 p-4 rounded-2xl"
        style={{
          background: "rgba(5, 8, 40, 0.7)",
          border: "1px solid rgba(0,140,255,0.12)",
        }}
      >
        <BrainCircuit size={18} style={{ color: "hsl(44 100% 65%)" }} />
        <span className="text-sm font-medium text-white">Dual-Engine Active</span>
        <div className="flex items-center gap-5 ml-auto">
          <div className="flex items-center gap-2">
            <div className="live-dot" style={{ background: "hsl(150 100% 50%)", boxShadow: "0 0 8px hsl(150 100% 50%)" }} />
            <span className="text-xs" style={{ color: "rgba(130,160,200,0.7)" }}>OpenAI GPT</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="live-dot" style={{ background: "#FFB800", boxShadow: "0 0 8px #FFB800" }} />
            <span className="text-xs" style={{ color: "rgba(130,160,200,0.7)" }}>Anthropic Claude</span>
          </div>
        </div>
      </div>

      {/* Example Prompts */}
      {!results && !isPending && (
        <div className="mb-5">
          <p className="section-label mb-3">Example Queries</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {examplePrompts.map((p, i) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="text-left text-sm px-4 py-3 rounded-xl transition-all duration-200 group"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(0,140,255,0.1)",
                  color: "rgba(160,190,230,0.7)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,140,255,0.07)";
                  e.currentTarget.style.borderColor = "rgba(0,160,255,0.22)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.borderColor = "rgba(0,140,255,0.1)";
                  e.currentTarget.style.color = "rgba(160,190,230,0.7)";
                }}
                data-testid={`button-example-prompt-${i}`}
              >
                <div className="flex items-start gap-2">
                  <Sparkles size={12} className="mt-0.5 flex-shrink-0" style={{ color: "rgba(255,184,0,0.5)" }} />
                  {p}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative z-20 mb-6">
        <div
          className="rounded-2xl overflow-hidden transition-all duration-200"
          style={{
            background: "rgba(5, 8, 40, 0.8)",
            border: "1px solid rgba(0,140,255,0.15)",
            boxShadow: "0 0 0 0 rgba(0,140,255,0)",
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = "rgba(0,160,255,0.3)"}
          onBlur={(e) => e.currentTarget.style.borderColor = "rgba(0,140,255,0.15)"}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your private banking advisor anything... (⌘+Enter to submit)"
            className="w-full min-h-[130px] p-5 bg-transparent border-none resize-none focus:outline-none text-base"
            style={{ color: "rgba(220,235,255,0.9)" }}
            disabled={isPending}
            data-testid="input-advisory-prompt"
          />
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "1px solid rgba(0,140,255,0.08)", background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-xs" style={{ color: "rgba(130,160,200,0.45)" }}>
              Fiduciary-grade · logged to transparency record
            </p>
            <button
              type="submit"
              disabled={!prompt.trim() || isPending}
              className="px-5 py-2 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all duration-200"
              style={{
                background: prompt.trim() && !isPending
                  ? "linear-gradient(135deg, rgba(0,140,255,0.3), rgba(0,100,200,0.2))"
                  : "rgba(255,255,255,0.04)",
                color: prompt.trim() && !isPending ? "hsl(207 100% 70%)" : "rgba(130,160,200,0.3)",
                border: prompt.trim() && !isPending
                  ? "1px solid rgba(0,160,255,0.28)"
                  : "1px solid rgba(255,255,255,0.05)",
                boxShadow: prompt.trim() && !isPending ? "0 0 16px rgba(0,140,255,0.15)" : "none",
                cursor: !prompt.trim() || isPending ? "not-allowed" : "pointer",
              }}
              data-testid="button-submit-advisory"
            >
              {isPending ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Submit Query
                  <Send size={13} />
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 text-sm flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{
                background: "rgba(255,60,60,0.07)",
                border: "1px solid rgba(255,60,60,0.18)",
                color: "hsl(0 90% 68%)",
              }}
            >
              <AlertCircle size={15} />
              <span>{(error as any)?.message || "An error occurred."}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResultPanel provider="openai" content={openAiResult?.response || ""} isPending={isPending} />
        <ResultPanel provider="anthropic" content={anthropicResult?.response || ""} isPending={isPending} />
      </div>
    </Layout>
  );
}
