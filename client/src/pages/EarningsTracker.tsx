import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { BloombergNav } from "@/components/BloombergNav";
import { earningsData } from "@/lib/mockData";
import {
  Calendar as CalendarIcon, List, BarChart3, TrendingUp, TrendingDown,
  Clock, CandlestickChart, Building2, Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line
} from "recharts";

type EarningsEvent = typeof earningsData[0];
const FILTERS = ["All", "Upcoming", "Beats", "Misses", "In-Line"];

export default function EarningsTracker() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"calendar" | "list">("list");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedStock, setSelectedStock] = useState<EarningsEvent | null>(earningsData[0]);

  const stats = useMemo(() => {
    const reported = earningsData.filter(d => d.epsActual !== null);
    const beats = reported.filter(d => d.surprise && d.surprise > 0).length;
    const revBeats = reported.filter(d => d.revActual && d.revActual > d.revEst).length;
    return {
      beatRate: (beats / reported.length) * 100,
      revBeatRate: (revBeats / reported.length) * 100,
      avgSurprise: reported.reduce((acc, cur) => acc + (cur.surprisePct || 0), 0) / reported.length,
      totalReported: reported.length,
      totalBeats: beats,
    };
  }, []);

  const filteredEarnings = useMemo(() => {
    switch (activeFilter) {
      case "Upcoming": return earningsData.filter(d => d.epsActual === null);
      case "Beats": return earningsData.filter(d => d.surprisePct && d.surprisePct > 0);
      case "Misses": return earningsData.filter(d => d.surprisePct && d.surprisePct < 0);
      case "In-Line": return earningsData.filter(d => d.surprisePct && Math.abs(d.surprisePct) < 1);
      default: return earningsData;
    }
  }, [activeFilter]);

  // 8-quarter mock history per selected stock
  const epsHistory = useMemo(() => {
    if (!selectedStock) return [];
    const base = selectedStock.epsEst;
    return ["Q4'23","Q1'24","Q2'24","Q3'24","Q4'24","Q1'25","Q2'25","Q3'25"].map((q, i) => ({
      q,
      est: parseFloat((base * (0.7 + i * 0.06)).toFixed(2)),
      act: parseFloat((base * (0.72 + i * 0.065 + (Math.random() - 0.4) * 0.08)).toFixed(2)),
    }));
  }, [selectedStock]);

  const revHistory = useMemo(() => {
    if (!selectedStock) return [];
    const base = selectedStock.revEst / 1e9;
    return ["Q4'23","Q1'24","Q2'24","Q3'24","Q4'24","Q1'25","Q2'25","Q3'25"].map((q, i) => ({
      q,
      rev: parseFloat((base * (0.75 + i * 0.04)).toFixed(2)),
    }));
  }, [selectedStock]);

  return (
    <Layout>
      <div className="mb-4 animate-float-up">
        <p className="section-label mb-1">Bloomberg Terminal</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Earnings Tracker
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Bloomberg ERN replacement — earnings calendar, EPS vs. actuals, 8-quarter history</p>
      </div>

      <BloombergNav active="earnings" />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "EPS Beat Rate", value: `${stats.beatRate.toFixed(1)}%`, sub: `${stats.totalBeats}/${stats.totalReported} reported`, color: "#00FF94" },
          { label: "Revenue Beat Rate", value: `${stats.revBeatRate.toFixed(1)}%`, sub: "vs S&P 500 avg 74%", color: "#00A8FF" },
          { label: "Avg EPS Surprise", value: `+${stats.avgSurprise.toFixed(1)}%`, sub: "blended portfolio", color: "#00FF94" },
          { label: "Upcoming Reports", value: `${earningsData.filter(d => !d.epsActual).length}`, sub: "next 30 days", color: "#FFB800" },
        ].map(m => (
          <Card key={m.label} className="sidebar-metal-glass border-white/10" data-testid={`card-${m.label.toLowerCase().replace(/ /g, "-")}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">{m.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold" style={{ color: m.color }}>{m.value}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-3/5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}
                className="rounded-xl border-white/10" data-testid="toggle-calendar">
                <CalendarIcon className="h-4 w-4 mr-2" /> Calendar
              </Button>
              <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}
                className="rounded-xl border-white/10" data-testid="toggle-list">
                <List className="h-4 w-4 mr-2" /> List
              </Button>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {FILTERS.map(f => (
                <Badge key={f} variant={activeFilter === f ? "default" : "outline"}
                  className="cursor-pointer whitespace-nowrap text-[10px]" onClick={() => setActiveFilter(f)}>
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          {view === "list" ? (
            <Card className="sidebar-metal-glass border-white/10 overflow-hidden">
              <Table data-testid="table-earnings-list">
                <TableHeader className="bg-black/40">
                  <TableRow className="hover:bg-transparent border-white/10">
                    <TableHead className="text-[10px] font-bold uppercase">Company</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Date / Time</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">EPS Est.</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Actual</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Surprise</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Rev Est.</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Rev Act.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEarnings.map(event => (
                    <TableRow
                      key={event.ticker}
                      className={`border-white/5 hover:bg-[var(--kiq-surface)]/5 cursor-pointer transition-colors ${selectedStock?.ticker === event.ticker ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedStock(event)}
                      data-testid={`row-earnings-${event.ticker}`}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black text-primary font-mono">{event.ticker}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{event.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs">{event.reportDate}</span>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {event.time}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">${event.epsEst.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold">
                        {event.epsActual ? `$${event.epsActual.toFixed(2)}` : <span className="text-muted-foreground text-[10px]">Pending</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {event.surprisePct ? (
                          <Badge className={`text-[9px] ${event.surprisePct > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                            {event.surprisePct > 0 ? "+" : ""}{event.surprisePct.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">${(event.revEst / 1e9).toFixed(1)}B</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {event.revActual
                          ? <span className={event.revActual > event.revEst ? "text-green-400" : "text-red-400"}>${(event.revActual / 1e9).toFixed(1)}B</span>
                          : <span className="text-muted-foreground text-[10px]">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="grid grid-cols-7 gap-1.5" data-testid="grid-earnings-calendar">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                <div key={d} className="text-center text-[9px] font-bold text-muted-foreground uppercase py-1">{d}</div>
              ))}
              {Array.from({ length: 35 }).map((_, i) => {
                const day = i - 3;
                const events = earningsData.filter(e => parseInt(e.reportDate.split("-")[2]) === day);
                return (
                  <div key={i} className="min-h-[80px] p-1.5 rounded-lg bg-[var(--kiq-surface)]/5 border border-white/10 flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-muted-foreground">{day > 0 && day <= 31 ? day : ""}</span>
                    {events.map(e => (
                      <div key={e.ticker}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold cursor-pointer truncate ${
                          e.epsActual === null ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                          e.surprisePct! > 0 ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                          "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                        onClick={() => { setSelectedStock(e); setView("list"); }}
                      >
                        {e.ticker}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:w-2/5">
          {selectedStock && (
            <Card className="sidebar-metal-glass border-white/10 sticky top-6" data-testid="panel-earnings-detail">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-black text-primary font-mono">{selectedStock.ticker}</CardTitle>
                    <p className="text-xs text-muted-foreground">{selectedStock.name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="bg-black/40 text-[10px]">{selectedStock.reportDate}</Badge>
                    <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                      <Clock size={9} /> {selectedStock.time}
                    </p>
                  </div>
                </div>

                {/* Click-through buttons */}
                <div className="flex gap-2 pt-3 border-t border-white/10 mt-2">
                  <button
                    data-testid={`btn-chart-detail-${selectedStock.ticker}`}
                    onClick={() => navigate(`/charts?ticker=${selectedStock.ticker}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-1 justify-center"
                    style={{ background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,168,255,0.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,168,255,0.1)"; }}
                  >
                    <CandlestickChart size={12} /> Chart
                  </button>
                  <button
                    data-testid={`btn-research-detail-${selectedStock.ticker}`}
                    onClick={() => navigate(`/company?ticker=${selectedStock.ticker}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-1 justify-center"
                    style={{ background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)", color: "#00FF94" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,255,148,0.16)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,255,148,0.08)"; }}
                  >
                    <Building2 size={12} /> Research
                  </button>
                  <button
                    data-testid={`btn-options-detail-${selectedStock.ticker}`}
                    onClick={() => navigate(`/options?ticker=${selectedStock.ticker}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-1 justify-center"
                    style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)", color: "#A855F7" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.16)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.08)"; }}
                  >
                    <Zap size={12} /> Options
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* EPS / Rev summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold mb-1">EPS Est.</p>
                    <p className="text-xl font-mono font-bold">${selectedStock.epsEst.toFixed(2)}</p>
                    {selectedStock.epsActual && (
                      <p className={`text-[10px] font-bold mt-0.5 ${selectedStock.epsActual > selectedStock.epsEst ? "text-green-400" : "text-red-400"}`}>
                        Act: ${selectedStock.epsActual.toFixed(2)}
                        {selectedStock.surprisePct && ` (${selectedStock.surprisePct > 0 ? "+" : ""}${selectedStock.surprisePct.toFixed(1)}%)`}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                    <p className="text-[9px] text-muted-foreground uppercase font-bold mb-1">Rev Est.</p>
                    <p className="text-xl font-mono font-bold">${(selectedStock.revEst / 1e9).toFixed(1)}B</p>
                    {selectedStock.revActual && (
                      <p className={`text-[10px] font-bold mt-0.5 ${selectedStock.revActual > selectedStock.revEst ? "text-green-400" : "text-red-400"}`}>
                        Act: ${(selectedStock.revActual / 1e9).toFixed(1)}B
                      </p>
                    )}
                  </div>
                </div>

                {/* 8Q EPS history */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <BarChart3 size={10} /> EPS History (8Q)
                  </h4>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={epsHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" />
                      <XAxis dataKey="q" tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} />
                      <YAxis tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
                      <Bar dataKey="est" fill="#e2e8f0" radius={[2, 2, 0, 0]} name="Estimate" />
                      <Bar dataKey="act" fill="#00A8FF" radius={[2, 2, 0, 0]} name="Actual" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue trend */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <TrendingUp size={10} /> Revenue Trend (8Q)
                  </h4>
                  <ResponsiveContainer width="100%" height={110}>
                    <LineChart data={revHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" />
                      <XAxis dataKey="q" tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} />
                      <YAxis tick={{ fill: "#475569", fontSize: 9 }} axisLine={false} tickFormatter={(v) => `$${v}B`} />
                      <Tooltip contentStyle={{ background: "#F8FAFC", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
                      <Line type="monotone" dataKey="rev" stroke="#00FF94" strokeWidth={2} dot={{ r: 3, fill: "#00FF94" }} name="Revenue ($B)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
