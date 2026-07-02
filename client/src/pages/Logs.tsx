import { Layout } from "@/components/Layout";
import { useLogs } from "@/hooks/use-logs";
import { format } from "date-fns";
import { Database, ShieldAlert, Bot, Sparkles, FileText, ChevronRight } from "lucide-react";
import { type Log } from "@shared/schema";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

export default function Logs() {
  const { data: logs, isLoading, error } = useLogs();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Group logs by prompt (rough heuristic assuming they were created at similar times)
  // For a true grouping we'd need a shared grouping ID in the DB, but we'll list them sequentially here for absolute transparency.
  
  return (
    <Layout>
      <div className="w-full max-w-5xl mx-auto space-y-8 pb-12">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="text-primary" size={28} />
              Transparency Log
            </h1>
            <p className="text-muted-foreground">
              Immutable record of all queries and AI responses for audit and evaluation purposes.
            </p>
          </div>
          <div
            className="px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium"
            style={{ background: "rgba(0,140,255,0.07)", border: "1px solid rgba(0,140,255,0.2)", color: "hsl(207 100% 65%)" }}
          >
            <ShieldAlert size={16} />
            Read-only Audit Trail
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/40 rounded-2xl border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-destructive/5 rounded-2xl border border-destructive/20 text-destructive">
            <p>Failed to load transparency logs.</p>
          </div>
        ) : !logs?.length ? (
          <div className="text-center py-24 glass-card rounded-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="text-muted-foreground" size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No records found</h3>
              <p className="text-muted-foreground">Submit a query on the home page to begin logging.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.slice().reverse().map((log: Log) => (
              <LogCard 
                key={log.id} 
                log={log} 
                isExpanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function LogCard({ log, isExpanded, onToggle }: { log: Log, isExpanded: boolean, onToggle: () => void }) {
  const isOpenAI = log.provider === 'openai';
  
  return (
    <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={onToggle}
        className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-shrink-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={isOpenAI
              ? { background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)", color: "hsl(150 100% 55%)" }
              : { background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.22)", color: "hsl(44 100% 62%)" }
            }
          >
            {isOpenAI ? <Sparkles size={18} /> : <Bot size={18} />}
          </div>
        </div>
        
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-6 items-center">
          <div className="md:col-span-2">
            <div className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider text-xs opacity-70">
              Prompt
            </div>
            <p className="text-sm font-medium text-foreground truncate pr-4">
              {log.prompt}
            </p>
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-6 text-sm text-muted-foreground">
            <div className="flex flex-col md:items-end">
              <span className="font-semibold text-foreground capitalize text-xs opacity-70">Provider</span>
              <span className="capitalize">{log.provider}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-semibold text-foreground capitalize text-xs opacity-70">Timestamp</span>
              <span>{format(new Date(log.createdAt), "MMM d, HH:mm")}</span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 self-start sm:self-center ml-auto">
          <div className={`p-2 rounded-full transition-transform duration-300 ${isExpanded ? 'rotate-90 bg-muted' : 'bg-transparent'}`}>
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="border-t"
          style={{ borderColor: "rgba(0,140,255,0.1)", background: "rgba(5,8,40,0.6)" }}
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText size={14} /> Full Prompt
                </h4>
                <div className="bg-muted/50 p-4 rounded-xl text-sm border border-border/50 whitespace-pre-wrap text-foreground/80 font-medium">
                  {log.prompt}
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  {isOpenAI ? <Sparkles size={14}/> : <Bot size={14}/>} 
                  Engine Response
                </h4>
                <div
                  className="p-5 rounded-xl text-sm overflow-x-auto"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,140,255,0.1)" }}
                >
                  <div className="prose prose-sm max-w-none prose-invert">
                    <ReactMarkdown>{log.response}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
