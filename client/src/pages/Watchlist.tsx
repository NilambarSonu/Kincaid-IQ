import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useMarketData } from "@/lib/marketData";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Bell, BellOff, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface WatchlistItem {
  id: number;
  ticker: string;
  display_name: string;
  target_price: number | null;
  alert_threshold_pct: number | null;
  notes: string | null;
  created_at: string;
}

interface AddForm {
  ticker: string;
  display_name: string;
  target_price: string;
  alert_threshold_pct: string;
  notes: string;
}

const SUGGESTED = [
  { ticker: "AAPL", display_name: "Apple Inc." },
  { ticker: "NVDA", display_name: "NVIDIA Corp." },
  { ticker: "MSFT", display_name: "Microsoft" },
  { ticker: "BRK-B", display_name: "Berkshire Hathaway" },
  { ticker: "GLD", display_name: "Gold ETF" },
  { ticker: "BTC-USD", display_name: "Bitcoin" },
];

export default function Watchlist() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { data: quotes } = useMarketData();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddForm>({ ticker: "", display_name: "", target_price: "", alert_threshold_pct: "5", notes: "" });
  const [addError, setAddError] = useState<string | null>(null);

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
    enabled: isAuthenticated,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<AddForm, "target_price" | "alert_threshold_pct"> & { target_price?: number; alert_threshold_pct?: number }) =>
      apiRequest("POST", "/api/watchlist", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setShowAdd(false);
      setForm({ ticker: "", display_name: "", target_price: "", alert_threshold_pct: "5", notes: "" });
      setAddError(null);
    },
    onError: (e: any) => setAddError(e?.message || "Failed to add"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/watchlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/watchlist"] }),
  });

  const quoteMap = new Map(quotes?.map((q) => [q.ticker, q]) ?? []);

  const handleAdd = () => {
    if (!form.ticker.trim()) { setAddError("Ticker required"); return; }
    addMutation.mutate({
      ticker: form.ticker.trim().toUpperCase(),
      display_name: form.display_name.trim() || form.ticker.toUpperCase(),
      target_price: form.target_price ? parseFloat(form.target_price) : undefined,
      alert_threshold_pct: form.alert_threshold_pct ? parseFloat(form.alert_threshold_pct) : 5,
      notes: form.notes || "",
    });
  };

  const totalAlerts = watchlist.filter((item) => {
    const q = quoteMap.get(item.ticker);
    if (!q || !item.target_price) return false;
    const pctFromTarget = Math.abs((q.price - item.target_price) / item.target_price) * 100;
    return pctFromTarget <= (item.alert_threshold_pct || 5);
  }).length;

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Market Intelligence</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              Watchlist
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Track securities and get alerts when targets are reached</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "rgba(0,168,255,0.12)", border: "1px solid rgba(0,168,255,0.25)", color: "#00A8FF" }}
            data-testid="button-add-watchlist"
          >
            <Plus size={14} />
            Add Ticker
          </button>
        </div>
      </div>

      {totalAlerts > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-6"
          style={{ background: "rgba(255,184,0,0.07)", border: "1px solid rgba(255,184,0,0.2)" }}
          data-testid="alert-watchlist-banner"
        >
          <Bell size={16} style={{ color: "#FFB800" }} />
          <p className="text-sm" style={{ color: "#FFB800" }}>
            <span className="font-bold">{totalAlerts} alert{totalAlerts > 1 ? "s" : ""}</span> — securities near target price
          </p>
        </div>
      )}

      {showAdd && (
        <div
          className="metric-card mb-6"
          style={{ border: "1px solid rgba(0,168,255,0.2)" }}
          data-testid="panel-add-watchlist"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm">Add to Watchlist</p>
            <button onClick={() => setShowAdd(false)} data-testid="button-close-add-watchlist">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-2">Quick add</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => setForm((f) => ({ ...f, ticker: s.ticker, display_name: s.display_name }))}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all"
                  style={{
                    background: form.ticker === s.ticker ? "rgba(0,168,255,0.15)" : "#ffffff",
                    border: `1px solid ${form.ticker === s.ticker ? "rgba(0,168,255,0.3)" : "#e2e8f0"}`,
                    color: form.ticker === s.ticker ? "#00A8FF" : "rgba(150,170,210,0.7)",
                  }}
                  data-testid={`suggestion-${s.ticker}`}
                >
                  {s.ticker}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { key: "ticker", label: "Ticker *", placeholder: "e.g. AAPL" },
              { key: "display_name", label: "Name", placeholder: "e.g. Apple Inc." },
              { key: "target_price", label: "Target Price", placeholder: "e.g. 200.00" },
              { key: "alert_threshold_pct", label: "Alert % from Target", placeholder: "5" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                <input
                  type={key.includes("price") || key.includes("pct") ? "number" : "text"}
                  value={form[key as keyof AddForm]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0F172A" }}
                  data-testid={`input-watchlist-${key}`}
                />
              </div>
            ))}
          </div>
          {addError && <p className="text-xs text-red-400 mb-3">{addError}</p>}
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(0,255,148,0.12)", border: "1px solid rgba(0,255,148,0.25)", color: "#00FF94" }}
            data-testid="button-submit-watchlist"
          >
            {addMutation.isPending ? "Adding…" : "Add to Watchlist"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "#ffffff" }} />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ border: "1px dashed rgba(0,140,255,0.15)" }}
          data-testid="empty-watchlist"
        >
          <Star size={32} style={{ color: "rgba(0,168,255,0.2)" }} />
          <p className="text-muted-foreground mt-3 text-sm">Your watchlist is empty</p>
          <p className="text-xs text-muted-foreground mt-1">Add tickers to track prices and set alerts</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="list-watchlist">
          {watchlist.map((item) => {
            const q = quoteMap.get(item.ticker);
            const isPos = (q?.changePct ?? 0) >= 0;
            const atTarget = q && item.target_price
              ? Math.abs((q.price - item.target_price) / item.target_price) * 100 <= (item.alert_threshold_pct || 5)
              : false;

            return (
              <div
                key={item.id}
                className="metric-card"
                style={{ border: atTarget ? "1px solid rgba(255,184,0,0.3)" : undefined }}
                data-testid={`row-watchlist-${item.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-xs"
                      style={{ background: "rgba(0,168,255,0.08)", border: "1px solid rgba(0,168,255,0.12)", color: "#00A8FF" }}
                    >
                      {item.ticker.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{item.display_name}</p>
                      <p className="text-xs text-muted-foreground">{item.ticker}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    {q ? (
                      <>
                        <div className="text-right">
                          <p className="font-bold text-base" style={{ fontFamily: "var(--font-display)" }}>
                            {q.price >= 10_000 ? `$${Math.round(q.price).toLocaleString()}` : `$${q.price.toFixed(2)}`}
                          </p>
                          <p className="flex items-center gap-1 text-xs justify-end" style={{ color: isPos ? "#00FF94" : "#FF4D6D" }}>
                            {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {isPos ? "+" : ""}{q.changePct.toFixed(2)}%
                          </p>
                        </div>
                        {item.target_price && (
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">Target</p>
                            <p className="text-sm font-semibold" style={{ color: atTarget ? "#FFB800" : "rgba(150,170,210,0.7)" }}>
                              ${item.target_price.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Price loading…</p>
                      </div>
                    )}

                    {atTarget && (
                      <div
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(255,184,0,0.1)", color: "#FFB800", border: "1px solid rgba(255,184,0,0.2)" }}
                      >
                        <Bell size={10} /> ALERT
                      </div>
                    )}

                    <button
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                      style={{ color: "rgba(255,77,109,0.4)" }}
                      data-testid={`button-delete-watchlist-${item.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pl-14">{item.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
