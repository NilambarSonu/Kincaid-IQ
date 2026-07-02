import { useEffect, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Activity, Radio, Building2, Landmark, Gauge, RefreshCw,
  TrendingUp, TrendingDown, Search, CheckCircle2, XCircle, Zap,
} from "lucide-react";

type Quote = {
  ticker: string; price: number; change: number; changePct: number;
  name: string; live: boolean;
};

const ACCENT = {
  market: "#00A8FF",
  firmo: "#00FF94",
  usage: "#A855F7",
  reg: "#FFB800",
};

function Panel({
  title, subtitle, icon: Icon, color, transport, children, action,
}: {
  title: string; subtitle: string; icon: any; color: string;
  transport: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      data-testid={`panel-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}1a`, color }}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0"
          style={{ background: `${color}1a`, color }}
        >
          {transport}
        </span>
      </div>
      {action}
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── 1. Market ticks (SSE) ────────────────────────────────────────────────────

function MarketPanel() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastTs, setLastTs] = useState<number | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/market/stream");
    es.addEventListener("quotes", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setQuotes(data.quotes || []);
        setLastTs(data.ts || Date.now());
        setConnected(true);
      } catch { /* ignore malformed frame */ }
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return (
    <Panel
      title="Market Ticks" subtitle="Live equity, rate, gold, crypto & volatility"
      icon={Radio} color={ACCENT.market} transport="SSE"
      action={
        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: connected ? "#00FF94" : "#6b7280", boxShadow: connected ? "0 0 8px #00FF94" : "none" }}
            data-testid="status-market-connection"
          />
          <span className="text-[11px] text-muted-foreground">
            {connected ? "Streaming" : "Connecting…"}
            {lastTs ? ` · ${new Date(lastTs).toLocaleTimeString()}` : ""}
          </span>
        </div>
      }
    >
      <div className="space-y-1.5">
        {quotes.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">Awaiting first tick…</p>
        )}
        {quotes.map((q) => {
          const up = q.change >= 0;
          return (
            <div
              key={q.ticker}
              className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: "hsl(var(--muted))" }}
              data-testid={`row-quote-${q.ticker}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-foreground w-16 shrink-0">{q.ticker}</span>
                <span className="text-[11px] text-muted-foreground truncate">{q.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-semibold text-foreground tabular-nums">
                  {q.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span
                  className="text-[11px] font-semibold tabular-nums flex items-center gap-0.5 w-20 justify-end"
                  style={{ color: up ? "#00FF94" : "#FF4D6D" }}
                >
                  {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {up ? "+" : ""}{q.changePct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── 2. Firmographic & intent (polling) ───────────────────────────────────────

function FirmographicPanel({ connected }: { connected?: Record<string, boolean> }) {
  const [input, setInput] = useState("");
  const [domain, setDomain] = useState("");

  const { data, isFetching } = useQuery<any>({
    queryKey: ["/api/account-intel/signals", domain],
    enabled: domain.length > 3,
    refetchInterval: domain.length > 3 ? 60_000 : false,
  });

  const signals = (data?.signals || []) as any[];

  return (
    <Panel
      title="Firmographic & Intent" subtitle="Apollo · Crunchbase · TheirStack, by domain"
      icon={Building2} color={ACCENT.firmo} transport="polling"
      action={
        <>
          <div className="flex items-center gap-2 mb-2">
            {connected && Object.entries(connected).map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ background: v ? "#00FF9415" : "hsl(var(--muted))", color: v ? "#00FF94" : "#6b7280" }}
                data-testid={`vendor-${k}`}
              >
                {v ? <CheckCircle2 size={10} /> : <XCircle size={10} />}{k}
              </span>
            ))}
          </div>
          <form
            className="flex gap-2 mb-3"
            onSubmit={(e) => { e.preventDefault(); setDomain(input.trim()); }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="company.com"
              className="flex-1 text-xs px-3 py-2 rounded-lg border bg-transparent text-foreground outline-none"
              style={{ borderColor: "hsl(var(--border))" }}
              data-testid="input-firmographic-domain"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1"
              style={{ background: ACCENT.firmo, color: "#04140b" }}
              data-testid="button-firmographic-lookup"
            >
              <Search size={13} /> Scan
            </button>
          </form>
        </>
      }
    >
      <div className="space-y-1.5">
        {!domain && <p className="text-xs text-muted-foreground py-6 text-center">Enter a domain to pull live buying signals.</p>}
        {domain && isFetching && signals.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Scanning {domain}…</p>}
        {domain && !isFetching && signals.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">No live signals for {domain}.</p>
        )}
        {signals.map((s, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded-lg"
            style={{ background: "hsl(var(--muted))" }}
            data-testid={`row-signal-${i}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground truncate">{s.title}</span>
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                style={{
                  background: s.severity === "HIGH" ? "#FF4D6D20" : s.severity === "MEDIUM" ? "#FFB80020" : "#6b728020",
                  color: s.severity === "HIGH" ? "#FF4D6D" : s.severity === "MEDIUM" ? "#FFB800" : "#9ca3af",
                }}
              >
                {s.severity || s.source}
              </span>
            </div>
            {s.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── 3. Usage telemetry (polling) ─────────────────────────────────────────────

function UsagePanel() {
  const { data } = useQuery<any>({
    queryKey: ["/api/live-feeds/usage"],
    refetchInterval: 15_000,
  });
  const counts = data?.counts || {};
  const events = (data?.recent_events || []) as any[];

  const stats = [
    { label: "Ingestion Runs", value: counts.ingestion_runs },
    { label: "Intel Events", value: counts.intelligence_events },
    { label: "AI Generations", value: counts.ai_generations },
    { label: "Usage Records", value: counts.usage_records },
  ];

  return (
    <Panel
      title="Usage Telemetry" subtitle="Live platform activity — refreshes every 15s"
      icon={Gauge} color={ACCENT.usage} transport="polling"
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="px-3 py-2.5 rounded-lg"
            style={{ background: "hsl(var(--muted))" }}
            data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          >
            <div className="text-lg font-bold text-foreground tabular-nums" style={{ color: ACCENT.usage }}>
              {(s.value ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {events.length === 0 && <p className="text-[11px] text-muted-foreground py-2 text-center">No recent intelligence events.</p>}
        {events.map((ev, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]" data-testid={`event-${i}`}>
            <Zap size={11} style={{ color: ACCENT.usage }} className="shrink-0" />
            <span className="text-foreground font-medium truncate">{ev.event_type}</span>
            <span className="text-muted-foreground truncate flex-1">{ev.summary}</span>
            {ev.impact_dollars > 0 && (
              <span className="text-muted-foreground tabular-nums shrink-0">${Math.round(ev.impact_dollars).toLocaleString()}</span>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── 4. Regulatory (scheduled ingestion) ──────────────────────────────────────

function RegulatoryPanel() {
  const { data } = useQuery<any>({
    queryKey: ["/api/live-feeds/regulatory/latest"],
    refetchInterval: 30_000,
  });
  const sources = (data?.sources || []) as any[];

  const refresh = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/live-feeds/regulatory/refresh")).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/live-feeds/regulatory/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/live-feeds/registry"] });
    },
  });

  const statusColor = (s: string) =>
    s === "success" ? "#00FF94" : s === "skipped" ? "#FFB800" : "#FF4D6D";

  return (
    <Panel
      title="Government / Regulatory" subtitle="SEC EDGAR · USAspending · SAM.gov — every 30m"
      icon={Landmark} color={ACCENT.reg} transport="scheduled"
      action={
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          className="mb-3 self-start px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: `${ACCENT.reg}1a`, color: ACCENT.reg }}
          data-testid="button-regulatory-refresh"
        >
          <RefreshCw size={13} className={refresh.isPending ? "animate-spin" : ""} />
          {refresh.isPending ? "Ingesting…" : "Refresh now"}
        </button>
      }
    >
      <div className="space-y-2">
        {sources.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">No ingest yet — runs on the half-hour, or refresh now.</p>
        )}
        {sources.map((s, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded-lg"
            style={{ background: "hsl(var(--muted))" }}
            data-testid={`row-regulatory-${s.source}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground truncate">{s.label || s.source}</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full" style={{ background: statusColor(s.status) }} />
                <span className="text-[11px] font-semibold text-foreground tabular-nums">{(s.records ?? 0).toLocaleString()}</span>
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-muted-foreground">
                {s.note ? s.note : s.highlights?.[0]?.company || s.highlights?.[0]?.recipient || s.highlights?.[0]?.title || "records"}
              </span>
              {s.ran_at && (
                <span className="text-[10px] text-muted-foreground">{new Date(s.ran_at).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function LiveFeeds() {
  const { data: registry } = useQuery<any>({
    queryKey: ["/api/live-feeds/registry"],
    refetchInterval: 30_000,
  });
  const firmo = registry?.feeds?.find((f: any) => f.id === "firmographic");

  return (
    <Layout>
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Activity size={22} style={{ color: ACCENT.market }} />
            <h1 className="text-xl font-bold text-foreground">Live Feeds</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            The platform's real-time data plane — four feeds, four transports. Streaming ticks over SSE,
            polled firmographic intent, live usage telemetry, and scheduled regulatory ingestion with a
            provenance receipt on every pull.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketPanel />
          <FirmographicPanel connected={firmo?.connected} />
          <UsagePanel />
          <RegulatoryPanel />
        </div>
      </div>
    </Layout>
  );
}
