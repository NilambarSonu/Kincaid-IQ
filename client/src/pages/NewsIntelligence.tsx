import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import {
  Newspaper, BrainCircuit, Loader2, RefreshCw,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  Globe2, Calendar, Briefcase, ExternalLink
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const CATEGORY_MAP: Record<string, string[]> = {
  market:      ["market", "equity", "stocks", "market moving"],
  portfolio:   ["portfolio", "holdings", "position"],
  macro:       ["macro", "fed", "fomc", "inflation", "gdp", "rate"],
  geopolitical:["geopolitical", "geopolitics", "trade", "tariff", "conflict", "war"],
  earnings:    ["earnings", "eps", "revenue", "quarterly"],
};

function matchesTab(item: any, tab: string): boolean {
  if (tab === "all") return true;
  const haystack = `${item.category ?? ""} ${item.headline ?? ""} ${item.summary ?? ""}`.toLowerCase();
  return (CATEGORY_MAP[tab] || []).some(kw => haystack.includes(kw));
}

export default function NewsIntelligence() {
  const [, navigate] = useLocation();
  const [news, setNews] = useState<any[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/news/generate", {
        holdings: ["AAPL", "NVDA", "MSFT", "AMZN", "META"]
      });
      return res.json();
    },
    onSuccess: (data) => {
      setNews(data.news);
      setUpdatedAt(new Date().toLocaleTimeString());
    },
  });

  useEffect(() => {
    if (news.length === 0 && !mutation.isPending) mutation.mutate();
  }, []);

  const filteredNews = useMemo(() => news.filter(item => matchesTab(item, activeTab)), [news, activeTab]);

  const tabCounts = useMemo(() => {
    const keys = ["all", "market", "portfolio", "macro", "geopolitical", "earnings"];
    return Object.fromEntries(keys.map(k => [k, news.filter(i => matchesTab(i, k)).length]));
  }, [news]);

  const getSentimentColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case "positive": return "#00FF94";
      case "negative": return "#FF4D6D";
      default: return "#A855F7";
    }
  };

  const getSentimentBg = (s: string) => {
    switch (s?.toLowerCase()) {
      case "positive": return "rgba(0,255,148,0.1)";
      case "negative": return "rgba(255,77,109,0.1)";
      default: return "rgba(168,85,247,0.1)";
    }
  };

  const NewsCard = ({ item, i }: { item: any; i: number }) => (
    <div key={i} className="metric-card hover:bg-white/5 transition-colors cursor-pointer" data-testid={`card-news-${i}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-[#00A8FF] bg-[#00A8FF]/10 px-1.5 py-0.5 rounded border border-[#00A8FF]/20 uppercase">
            {item.category}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            {item.source} · {item.publishedAt}
          </span>
        </div>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/5 uppercase flex-shrink-0"
          style={{ color: getSentimentColor(item.sentiment), background: getSentimentBg(item.sentiment) }}
          data-testid="chip-sentiment"
        >
          {item.sentiment}
        </span>
      </div>
      <h3 className="text-base font-bold text-white mb-1.5 leading-tight hover:text-[#00A8FF] transition-colors">
        {item.headline}
      </h3>
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.summary}</p>
      {item.impactedHoldings?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.impactedHoldings.map((h: string, j: number) => (
            <button
              key={j}
              onClick={(e) => { e.stopPropagation(); navigate(`/company?ticker=${h}`); }}
              className="text-[10px] font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-lg text-white hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1"
              data-testid="chip-holding-impact"
            >
              {h} <ExternalLink size={9} className="opacity-50" />
            </button>
          ))}
          {item.relevance && (
            <span className="text-[10px] font-bold bg-[#FFB800]/10 border border-[#FFB800]/20 px-1.5 py-0.5 rounded-lg text-[#FFB800]">
              Relevance: {item.relevance}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const tabDefs = [
    { id: "all",          label: "All News",        icon: Newspaper },
    { id: "market",       label: "Market Moving",   icon: TrendingUp },
    { id: "portfolio",    label: "Portfolio Impact", icon: Briefcase },
    { id: "macro",        label: "Macro",           icon: Globe2 },
    { id: "geopolitical", label: "Geopolitical",    icon: AlertTriangle },
    { id: "earnings",     label: "Earnings",        icon: Calendar },
  ];

  return (
    <Layout>
      <div className="mb-4 animate-float-up">
        <p className="section-label mb-1">AI Intelligence</p>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              News Intelligence
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Claude-synthesized personalized news feed — click any holding to view Company Research</p>
          </div>
          <div className="flex items-center gap-4">
            {updatedAt && <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Updated: {updatedAt}</p>}
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.2)", color: "#00A8FF" }}
              data-testid="button-generate-feed"
            >
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Generate Feed
            </button>
          </div>
        </div>
      </div>

      <BloombergNav active="news" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-white/5 p-1 border border-white/10 rounded-xl flex-wrap h-auto gap-1">
              {tabDefs.map(tab => {
                const Icon = tab.icon;
                const count = tabCounts[tab.id] ?? 0;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-lg data-[state=active]:bg-[#00A8FF]/10 data-[state=active]:text-[#00A8FF] flex items-center gap-1.5"
                    data-testid={`filter-${tab.id}`}
                  >
                    <Icon size={12} />
                    {tab.label}
                    {count > 0 && news.length > 0 && (
                      <span className="ml-1 text-[9px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full">{count}</span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {tabDefs.map(tab => (
              <TabsContent key={tab.id} value={tab.id} className="space-y-4">
                {mutation.isPending && (
                  <div className="metric-card py-20 flex flex-col items-center justify-center">
                    <Loader2 size={32} className="animate-spin mb-4 text-[#00A8FF]" />
                    <p className="font-bold text-white">Claude is synthesizing your intelligence feed…</p>
                    <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">
                      Scanning macro data, earnings transcripts, and geopolitics for Jeremiah's $2.41B portfolio
                    </p>
                  </div>
                )}
                {!mutation.isPending && filteredNews.length === 0 && news.length > 0 && (
                  <div className="metric-card py-12 flex flex-col items-center justify-center opacity-60">
                    <tab.icon size={24} className="mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No {tab.label.toLowerCase()} stories in this feed</p>
                    <button onClick={() => mutation.mutate()} className="mt-3 text-[11px] text-primary underline">Regenerate feed</button>
                  </div>
                )}
                {!mutation.isPending && filteredNews.map((item, i) => (
                  <NewsCard key={i} item={item} i={i} />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="space-y-4">
          <div className="metric-card" data-testid="card-portfolio-impact-score">
            <p className="section-label mb-3">Portfolio Impact Score</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-[#00FF94]" style={{ fontFamily: "var(--font-display)" }}>+14</span>
              <span className="text-xs text-muted-foreground mb-2">Neutral/Positive</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              Claude projects a net positive impact on your portfolio based on recent tech sector strength and macro stability.
            </p>
          </div>

          <div className="metric-card">
            <p className="section-label mb-3">Trending Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {["Fed Funds", "Nvidia Earnings", "China Stimulus", "OPEC+", "Big Tech", "Inflation", "Yield Curve", "Credit Spreads", "M&A Activity"].map(topic => (
                <span key={topic} className="text-[10px] font-bold bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <div className="metric-card">
            <p className="section-label mb-3">Impact Breakdown</p>
            <div className="space-y-2.5">
              {[
                { label: "Technology", impact: "High Positive", color: "#00FF94" },
                { label: "Energy", impact: "Moderate Negative", color: "#FF4D6D" },
                { label: "Financials", impact: "Neutral", color: "#A855F7" },
                { label: "Real Estate", impact: "Slight Positive", color: "#00FF94" },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-bold" style={{ color: item.color }}>{item.impact}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="metric-card">
            <p className="section-label mb-3">Quick Research</p>
            <p className="text-[10px] text-muted-foreground mb-2 leading-relaxed">Click any holding tag in a news card to open Company Research for that ticker.</p>
            <div className="flex flex-wrap gap-1.5">
              {["AAPL", "NVDA", "MSFT", "AMZN", "META"].map(t => (
                <button
                  key={t}
                  onClick={() => navigate(`/company?ticker=${t}`)}
                  className="text-[10px] font-bold bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg text-primary hover:bg-primary/20 transition-all"
                  data-testid={`quick-research-${t}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
