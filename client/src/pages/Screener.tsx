import { useState, useMemo, Fragment } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { screenerStocks } from "@/lib/mockData";
import {
  Search, Filter, ArrowUpDown, ChevronDown, ChevronUp, Sparkles,
  BarChart3, CandlestickChart, TrendingUp, Building2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Stock = typeof screenerStocks[0];

const SECTORS = ["All", ...Array.from(new Set(screenerStocks.map(s => s.sector)))];
const PREBUILT_SCREENS = [
  { id: "high-dividend", label: "High Dividend" },
  { id: "value", label: "Value (Low P/E)" },
  { id: "growth", label: "Growth Momentum" },
  { id: "quality", label: "Quality" },
  { id: "low-beta", label: "Low Beta" },
  { id: "tech", label: "Tech Leaders" },
];

export default function Screener() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState("All");
  const [peRange, setPeRange] = useState([0, 100]);
  const [divYieldRange, setDivYieldRange] = useState([0, 10]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Stock; direction: "asc" | "desc" } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [aiRanking, setAiRanking] = useState<string | null>(null);

  const aiRankMutation = useMutation({
    mutationFn: async (stocks: Stock[]) => {
      const res = await apiRequest("POST", "/api/ask-portfolio", {
        prompt: `Rank these top 10 stocks for Jeremiah Shrack's UHNW portfolio (net worth $2.4B, heavy tech exposure). Provide concise reasoning for each pick: ${JSON.stringify(stocks.slice(0, 10).map(s => ({ ticker: s.ticker, name: s.name, sector: s.sector, pe: s.pe, divYield: s.divYield })))}`
      });
      return res.json();
    },
    onSuccess: (data) => { setAiRanking(data.response); },
    onError: () => { toast({ title: "AI Ranking Failed", variant: "destructive" }); }
  });

  const filteredStocks = useMemo(() => screenerStocks.filter(stock => {
    const matchSearch = stock.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        stock.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSector = selectedSector === "All" || stock.sector === selectedSector;
    const matchPe = stock.pe >= peRange[0] && stock.pe <= peRange[1];
    const matchDiv = stock.divYield >= divYieldRange[0] && stock.divYield <= divYieldRange[1];
    return matchSearch && matchSector && matchPe && matchDiv;
  }), [searchTerm, selectedSector, peRange, divYieldRange]);

  const sortedStocks = useMemo(() => {
    if (!sortConfig) return filteredStocks;
    return [...filteredStocks].sort((a, b) => {
      const av = a[sortConfig.key]; const bv = b[sortConfig.key];
      return sortConfig.direction === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }, [filteredStocks, sortConfig]);

  const handleSort = (key: keyof Stock) => {
    setSortConfig(cur => cur?.key === key
      ? { key, direction: cur.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "desc" });
  };

  const applyPreset = (id: string) => {
    setSelectedSector("All"); setSearchTerm("");
    switch (id) {
      case "high-dividend": setPeRange([0, 100]); setDivYieldRange([3, 10]); handleSort("divYield"); break;
      case "value": setPeRange([0, 20]); setDivYieldRange([0, 10]); handleSort("pe"); break;
      case "growth": setPeRange([0, 100]); setDivYieldRange([0, 10]); handleSort("mom12m"); break;
      case "quality": setPeRange([0, 100]); setDivYieldRange([0, 10]); handleSort("roe"); break;
      case "low-beta": setPeRange([0, 100]); setDivYieldRange([0, 10]); setSortConfig({ key: "beta", direction: "asc" }); break;
      case "tech": setSelectedSector("Technology"); setPeRange([0, 100]); setDivYieldRange([0, 10]); handleSort("marketCap"); break;
    }
  };

  const SortHeader = ({ label, col }: { label: string; col: keyof Stock }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => handleSort(col)}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      </div>
    </TableHead>
  );

  return (
    <Layout>
      <div className="mb-4 animate-float-up">
        <p className="section-label mb-1">Bloomberg Terminal</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Equity Screener
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bloomberg EQS replacement — {screenerStocks.length} institutional-grade equities</p>
      </div>

      <BloombergNav active="screener" />

      {/* Preset screens */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PREBUILT_SCREENS.map(screen => (
          <Button key={screen.id} variant="outline" size="sm" onClick={() => applyPreset(screen.id)}
            className="rounded-xl border-white/10 bg-[var(--kiq-surface)]/5 hover:bg-[var(--kiq-surface)]/10" data-testid={`button-screen-${screen.id}`}>
            <BarChart3 className="mr-2 h-3 w-3" />{screen.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filter sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="sidebar-metal-glass border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Ticker or Name…" className="pl-9 bg-black/20 border-white/10"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Sector</label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger className="bg-black/20 border-white/10" data-testid="select-sector">
                    <SelectValue placeholder="All Sectors" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">P/E Ratio</label>
                  <span className="text-[10px] font-mono text-primary">{peRange[0]}–{peRange[1]}x</span>
                </div>
                <Slider value={peRange} min={0} max={100} step={1} onValueChange={setPeRange} className="py-2" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Div Yield</label>
                  <span className="text-[10px] font-mono text-primary">{divYieldRange[0]}–{divYieldRange[1]}%</span>
                </div>
                <Slider value={divYieldRange} min={0} max={10} step={0.1} onValueChange={setDivYieldRange} className="py-2" />
              </div>
              <Button
                className="w-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/25"
                onClick={() => aiRankMutation.mutate(sortedStocks)}
                disabled={aiRankMutation.isPending}
                data-testid="button-ai-rank"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {aiRankMutation.isPending ? "Ranking…" : "AI Rank Results"}
              </Button>
            </CardContent>
          </Card>

          {aiRanking && (
            <Card className="border-primary/20 bg-primary/5" data-testid="card-ai-ranking">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> AI Investment Reasoning
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs leading-relaxed text-muted-foreground italic">{aiRanking}</p>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-[10px] h-7" onClick={() => setAiRanking(null)}>Dismiss</Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main table */}
        <div className="lg:col-span-3">
          <Card className="sidebar-metal-glass border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-[var(--kiq-surface)]/5">
              <Badge variant="outline" className="text-[10px] font-mono bg-black/40 border-white/10">
                {sortedStocks.length} / {screenerStocks.length} stocks
              </Badge>
              <span className="text-[10px] text-muted-foreground">Click a row to expand — use action buttons to drill in</span>
            </div>
            <div className="overflow-x-auto">
              <Table data-testid="table-screener">
                <TableHeader className="bg-black/20">
                  <TableRow className="hover:bg-transparent border-white/10 text-[10px]">
                    <SortHeader label="Ticker" col="ticker" />
                    <SortHeader label="Name" col="name" />
                    <SortHeader label="Sector" col="sector" />
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("marketCap")}>Mkt Cap <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" /></TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("pe")}>P/E <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" /></TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("divYield")}>Yield <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" /></TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("mom12m")}>12M Mom <ArrowUpDown className="inline h-3 w-3 ml-1 opacity-40" /></TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStocks.map(stock => (
                    <Fragment key={stock.ticker}>
                      <TableRow
                        className={`border-white/5 hover:bg-[var(--kiq-surface)]/5 cursor-pointer transition-colors ${expandedRow === stock.ticker ? "bg-primary/5" : ""}`}
                        onClick={() => setExpandedRow(expandedRow === stock.ticker ? null : stock.ticker)}
                        data-testid={`row-stock-${stock.ticker}`}
                      >
                        <TableCell className="font-black text-primary font-mono">{stock.ticker}</TableCell>
                        <TableCell className="text-sm font-medium">{stock.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[9px] bg-[var(--kiq-surface)]/5">{stock.sector}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">${(stock.marketCap / 1e12).toFixed(2)}T</TableCell>
                        <TableCell className="text-right text-xs font-mono">{stock.pe.toFixed(1)}x</TableCell>
                        <TableCell className="text-right text-xs font-mono">{stock.divYield.toFixed(2)}%</TableCell>
                        <TableCell className={`text-right text-xs font-mono ${stock.mom12m >= 0 ? "text-[#00FF94]" : "text-[#FF4D6D]"}`}>
                          {stock.mom12m >= 0 ? "+" : ""}{stock.mom12m.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {expandedRow === stock.ticker
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                      </TableRow>

                      {expandedRow === stock.ticker && (
                        <TableRow className="bg-primary/3 hover:bg-primary/5 border-white/10">
                          <TableCell colSpan={8} className="p-0">
                            <div className="p-4 animate-in slide-in-from-top-2 duration-200 space-y-4">
                              {/* Fundamental stats */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {[
                                  { label: "Rev Growth", value: `+${stock.revGrowth}%`, color: "#00FF94" },
                                  { label: "EPS Growth", value: `+${stock.epsGrowth}%`, color: "#00FF94" },
                                  { label: "ROE", value: `${stock.roe}%`, color: "#00A8FF" },
                                  { label: "Debt/Equity", value: `${stock.debtEquity}`, color: "#FFB800" },
                                  { label: "Beta", value: `${stock.beta}`, color: "#A855F7" },
                                ].map(m => (
                                  <div key={m.label} className="p-2.5 rounded-lg" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold mb-0.5">{m.label}</p>
                                    <p className="text-sm font-bold" style={{ color: m.color }}>{m.value}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Click-through action buttons */}
                              <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
                                <button
                                  data-testid={`btn-chart-${stock.ticker}`}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/charts?ticker=${stock.ticker}`); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                  style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF" }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,168,255,0.2)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,168,255,0.1)"; }}
                                >
                                  <CandlestickChart size={12} /> View Chart
                                </button>
                                <button
                                  data-testid={`btn-research-${stock.ticker}`}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/company?ticker=${stock.ticker}`); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                  style={{ background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)", color: "#00FF94" }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,255,148,0.16)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,255,148,0.08)"; }}
                                >
                                  <Building2 size={12} /> Company Research
                                </button>
                                <button
                                  data-testid={`btn-options-${stock.ticker}`}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/options?ticker=${stock.ticker}`); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                  style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "#A855F7" }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.16)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.08)"; }}
                                >
                                  <TrendingUp size={12} /> Options Chain
                                </button>
                                <button
                                  data-testid={`btn-earnings-${stock.ticker}`}
                                  onClick={(e) => { e.stopPropagation(); navigate(`/earnings`); }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                  style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)", color: "#FFB800" }}
                                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,184,0,0.16)"; }}
                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,184,0,0.08)"; }}
                                >
                                  <ExternalLink size={12} /> Earnings
                                </button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
