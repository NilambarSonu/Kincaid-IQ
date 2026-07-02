import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useMutation } from "@tanstack/react-query";
import { Newspaper, Loader2, RefreshCw, Calendar, BrainCircuit } from "lucide-react";

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (line.match(/^#{1,3}\s/)) return <p key={i} className="font-bold text-white mt-4 mb-1 text-base" style={{ color: "#00A8FF" }}>{line.replace(/^#{1,3}\s/, "")}</p>;
        if (line.match(/^\*\*.*\*\*:/)) return <p key={i} className="font-semibold text-white mt-2" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<span style="color:#FFB800">$1</span>') }} />;
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 flex gap-2 text-muted-foreground"><span style={{ color: "rgba(0,168,255,0.5)" }}>·</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} /></p>;
        if (line.match(/^\d+\.\s/)) { const content = line.replace(/^\d+\.\s/, ""); const num = line.match(/^(\d+)\./)?.[1]; return <p key={i} className="flex gap-2 text-muted-foreground"><span className="font-bold flex-shrink-0" style={{ color: "#00FF94" }}>{num}.</span><span dangerouslySetInnerHTML={{ __html: content.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} /></p>; }
        if (line.trim() === "---" || line.trim() === "***") return <div key={i} className="my-3 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />;
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>') }} />;
      })}
    </div>
  );
}

export default function MarketBriefing() {
  const [briefing, setBriefing] = useState<{ text: string; date: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/market-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate briefing");
      return res.json();
    },
    onSuccess: (data) => setBriefing({ text: data.briefing, date: data.date }),
  });

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">AI Intelligence</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Daily Market Briefing
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          AI-generated morning brief — macro analysis personalized to Jeremiah's portfolio by GPT-4o
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Today", value: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "#00A8FF", sub: today.split(",")[0] },
          { label: "Portfolio Context", value: "$2.41B", color: "#00FF94", sub: "Full AUM in context" },
          { label: "AI Engine", value: "GPT-4o", color: "#FFB800", sub: "Kincaid RMC Advisor" },
          { label: "Coverage", value: "7 Areas", color: "#A855F7", sub: "Macro + portfolio impact" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-briefing-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {!briefing && !mutation.isPending && (
        <div className="metric-card flex flex-col items-center justify-center py-20"
          style={{ border: "1px dashed rgba(0,168,255,0.15)" }} data-testid="empty-briefing">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "rgba(0,168,255,0.08)", border: "1px solid rgba(0,168,255,0.15)" }}>
            <Newspaper size={28} style={{ color: "#00A8FF" }} />
          </div>
          <p className="font-bold text-white mb-1">Generate Today's Market Briefing</p>
          <p className="text-xs text-muted-foreground mb-6 text-center max-w-sm">
            GPT-4o analyzes current macro conditions and translates them into portfolio-specific implications for Jeremiah Shrack
          </p>
          <button
            onClick={() => mutation.mutate()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
            style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF" }}
            data-testid="button-generate-briefing"
          >
            <BrainCircuit size={15} /> Generate Briefing
          </button>
        </div>
      )}

      {mutation.isPending && (
        <div className="metric-card flex flex-col items-center justify-center py-20" data-testid="loading-briefing">
          <Loader2 size={32} className="animate-spin mb-4" style={{ color: "#00A8FF" }} />
          <p className="font-bold text-white mb-1">Generating your personalized briefing…</p>
          <p className="text-xs text-muted-foreground">GPT-4o is analyzing macro conditions and portfolio implications</p>
        </div>
      )}

      {briefing && (
        <div className="metric-card" data-testid="card-briefing-content"
          style={{ border: "1px solid rgba(0,168,255,0.12)" }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.2)" }}>
                <Newspaper size={15} style={{ color: "#00A8FF" }} />
              </div>
              <div>
                <p className="font-bold text-white">Kincaid RMC Intelligence Brief</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar size={9} /> {briefing.date}
                  <span className="mx-1">·</span>
                  <BrainCircuit size={9} /> GPT-4o
                </div>
              </div>
            </div>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(150,170,210,0.6)" }}
              data-testid="button-regenerate"
            >
              <RefreshCw size={10} /> Regenerate
            </button>
          </div>
          <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <MarkdownText text={briefing.text} />
          </div>
        </div>
      )}
    </Layout>
  );
}
