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
    const query = prompt.trim() || "all of Kincaid IQ";
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
          prompt: `Pull Kincaid IQ: ${query}`,
          provider: 'anthropic-kincaid',
          response: data.code,
          createdAt: new Date()
        };
        setResults([kincaidLog]);
      }
    } catch (err) {
      console.error("Error pulling Kincaid IQ:", err);
    } finally {
      setPullingKincaid(false);
    }
  };

  const openAiResult = results?.find(r => r.provider === 'openai');
  const anthropicResult = results?.find(r => r.provider === 'anthropic' || r.provider === 'anthropic-kincaid');

  return (
    <Layout>
      <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 flex-1">
        
        {/* Header Section */}
        <div className="text-center space-y-4 pt-4 md:pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-sm font-medium mb-2">
            <Sparkles size={14} /> Fiduciary Grade Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            Dual-Engine Analysis
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Submit a query to evaluate responses across multiple frontier models simultaneously, or use Claude to pull Kincaid IQ code.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="relative z-20">
          <div className="relative glass-card rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your prompt here... (e.g. 'Pull all of Kincaid iQ')"
              className="w-full min-h-[140px] p-5 bg-transparent border-none resize-y text-foreground placeholder:text-muted-foreground/70 focus:outline-none custom-scrollbar text-base"
              disabled={isPending || pullingKincaid}
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handlePullKincaid}
                disabled={!prompt.trim() || pullingKincaid || isPending}
                className={`
                  px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2
                  transition-all duration-200 ease-out
                  ${prompt.trim() && !pullingKincaid
                    ? 'bg-secondary text-secondary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                {pullingKincaid ? "Pulling..." : "Pull Kincaid IQ"}
              </button>
              <button
                type="submit"
                disabled={!prompt.trim() || isPending || pullingKincaid}
                className={`
                  px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2
                  transition-all duration-200 ease-out
                  ${prompt.trim() && !isPending
                    ? 'bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }
                `}
              >
                {isPending ? "Analyzing..." : "Submit Query"}
                <Send size={16} className={isPending ? "animate-pulse" : ""} />
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-sm text-destructive flex items-center gap-2 bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20"
              >
                <AlertCircle size={16} />
                <span>{error.message || "An error occurred while processing the request."}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12 flex-1">
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
