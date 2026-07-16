import { useState } from "react";
import { Send, Sparkles, AlertCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ResultPanel } from "@/components/ResultPanel";
import { useSubmitPrompt } from "@/hooks/use-logs";
import { type Log } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<Log[] | null>(null);
  const { mutate: submitPrompt, isPending, error } = useSubmitPrompt();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isPending) return;

    submitPrompt(prompt, {
      onSuccess: (data) => {
        setResults(data);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const [pullingKincaid, setPullingKincaid] = useState(false);

  const handlePullKincaid = async () => {
    const query = prompt.trim() || "all of Kincaid Health";
    setPullingKincaid(true);
    try {
      const response = await fetch("/api/pull-kincaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: query }),
      });
      const data = await response.json();
      if (data.code) {
        const kincaidLog: Log = {
          id: Date.now(),
          prompt: `Pull Kincaid Health: ${query}`,
          provider: 'anthropic-kincaid',
          response: data.code,
          createdAt: new Date()
        };
        setResults([kincaidLog]);
      }
    } catch (err) {
      console.error("Error pulling Kincaid Health:", err);
    } finally {
      setPullingKincaid(false);
    }
  };

  const openAiResult = results?.find(r => r.provider === 'openai');
  const anthropicResult = results?.find(r => r.provider === 'anthropic' || r.provider === 'anthropic-kincaid');

  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 flex-1 py-8 px-4 font-sans text-[var(--kiq-ink-soft)]">
        
        {/* Header Section */}
        <div className="text-center space-y-4 pt-4 md:pt-8 animate-kincaid-slide-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/5 border border-red-500/10 text-red-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles size={13} className="text-red-600 animate-pulse" /> Fiduciary Grade Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--kiq-ink)] tracking-tight font-display">
            Dual-Engine Analysis
          </h1>
          <p className="text-base text-[var(--kiq-muted)] max-w-2xl mx-auto leading-relaxed">
            Submit a query to evaluate responses across multiple frontier models simultaneously, or use Claude to pull Kincaid Health code.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative z-20 animate-kincaid-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="relative glass-3d bg-[var(--kiq-surface)] rounded-2xl overflow-hidden shadow-glass border border-[var(--kiq-hairline)]/50 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500/40 transition-all duration-300">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your prompt here... (e.g. 'Pull all of Kincaid Health')"
              className="w-full min-h-[140px] p-5 bg-transparent border-none resize-y text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)] focus:outline-none custom-scrollbar text-base font-medium"
              disabled={isPending || pullingKincaid}
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handlePullKincaid}
                disabled={!prompt.trim() || pullingKincaid || isPending}
                className={`
                  px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-xs uppercase tracking-wider
                  transition-all duration-200 ease-out border cursor-pointer
                  ${prompt.trim() && !pullingKincaid
                    ? 'bg-[var(--kiq-canvas-soft)] hover:bg-[var(--kiq-canvas-parchment)] text-[var(--kiq-ink-soft)] border-[var(--kiq-hairline)] shadow-sm' 
                    : 'bg-[var(--kiq-canvas-parchment)] text-[var(--kiq-subtle)] border-transparent cursor-not-allowed'
                  }
                `}
              >
                {pullingKincaid ? "Pulling..." : "Pull Kincaid Health"}
              </button>
              <button
                type="submit"
                disabled={!prompt.trim() || isPending || pullingKincaid}
                className={`
                  px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-xs uppercase tracking-wider
                  transition-all duration-200 ease-out border-none cursor-pointer
                  ${prompt.trim() && !isPending
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/10' 
                    : 'bg-[var(--kiq-canvas-parchment)] text-[var(--kiq-subtle)] cursor-not-allowed'
                  }
                `}
              >
                {isPending ? "Analyzing..." : "Submit Query"}
                <Send size={13} className={isPending ? "animate-pulse" : ""} />
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-sm text-red-700 flex items-center gap-2 bg-red-50 px-4 py-3 rounded-xl border border-red-150"
              >
                <AlertCircle size={15} className="text-red-600" />
                <span>{error.message || "An error occurred while processing the request."}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12 flex-1 animate-kincaid-slide-up" style={{ animationDelay: "200ms" }}>
          <ResultPanel 
            provider="openai" 
            content={openAiResult?.response || ""} 
            isPending={isPending} 
          />
          <ResultPanel 
            provider="anthropic" 
            content={anthropicResult?.response || ""} 
            isPending={isPending} 
          />
        </div>

      </div>
    </Layout>
  );
}
