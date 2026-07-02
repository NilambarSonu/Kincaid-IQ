import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, BarChart3, Globe2, Building2, Search,
  Info, AlertCircle, CheckCircle2, ExternalLink, DollarSign,
  Activity, Users, MapPin, FileText
} from "lucide-react";

const BG    = "#07091c";
const CARD  = "#0d1033";
const CARD2 = "#111540";
const BORDER= "rgba(255,255,255,0.08)";
const TEXT1 = "#f0f4ff";
const TEXT2 = "#8b9dd4";
const ACCENT= "#4f7dff";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED   = "#ef4444";
const ROSE  = "#9B1C2E";
const NAVY  = "#002B5C";
const TEAL  = "#06b6d4";
const PURPLE= "#8b5cf6";

function Stat({ label, value, unit, change, note }: { label: string; value: number | undefined; unit?: string; change?: number; note?: string }) {
  const hasChange = change !== undefined && change !== null;
  const up = hasChange && change > 0;
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s+/g,"-")}`}
      style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>
        {label}
      </div>
      {value !== undefined && value !== null ? (
        <>
          <div style={{ color: TEXT1, fontSize: 24, fontWeight: 900, letterSpacing: "-0.02em" }}>
            {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
            {unit && <span style={{ fontSize: 13, fontWeight: 600, color: TEXT2, marginLeft: 3 }}>{unit}</span>}
          </div>
          {hasChange && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              {up ? <TrendingUp size={12} color={GREEN}/> : <TrendingDown size={12} color={RED}/>}
              <span style={{ color: up ? GREEN : RED, fontSize: 11, fontWeight: 700 }}>
                {up ? "+" : ""}{change?.toFixed(3)}
              </span>
              <span style={{ color: TEXT2, fontSize: 10 }}>vs prior</span>
            </div>
          )}
          {note && <div style={{ color: TEXT2, fontSize: 9, marginTop: 6, lineHeight: 1.4 }}>{note}</div>}
        </>
      ) : (
        <div style={{ color: TEXT2, fontSize: 13 }}>—</div>
      )}
    </div>
  );
}

function NoKeyBanner({ service, url, envVar }: { service: string; url: string; envVar: string }) {
  return (
    <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}30`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <AlertCircle size={16} color={AMBER}/>
        <span style={{ color: AMBER, fontWeight: 700, fontSize: 13 }}>{service} API Key Required</span>
      </div>
      <p style={{ color: TEXT2, fontSize: 12, margin: "0 0 10px" }}>
        Register for a free API key at{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>{url}</a>
        {" "}and add it as <code style={{ color: TEAL, background: `${TEAL}18`, padding: "1px 6px", borderRadius: 4 }}>{envVar}</code> to your environment secrets.
      </p>
      <div style={{ color: TEXT2, fontSize: 11 }}>
        Registration is free and takes about 2 minutes. No payment required.
      </div>
    </div>
  );
}

/* ── FRED Section ────────────────────────────────────────────────────────────── */
function FredSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/market-intel/fred"],
    queryFn: async () => {
      const r = await fetch("/api/market-intel/fred", { credentials: "include" });
      return r.json();
    },
  });

  const PRIORITY_SERIES = ["CPIMEDSL", "CPIHOSNS", "CPIUENS", "CPIAUCSL", "UNRATE", "DGS10", "DGS30"];

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
        {PRIORITY_SERIES.map(s => (
          <div key={s} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, height: 90, opacity: 0.4 }}/>
        ))}
      </div>
    );
  }

  if (data?.status === "NO_KEY") {
    return <NoKeyBanner service="FRED" url="https://fred.stlouisfed.org/docs/api/api_key.html" envVar="FRED_API_KEY"/>;
  }

  const series = data?.series || {};

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, marginBottom: 12 }}>
        {PRIORITY_SERIES.map(sid => {
          const s = series[sid];
          if (!s) return null;
          return (
            <Stat
              key={sid}
              label={s.label || sid}
              value={s.latest_value}
              unit={s.unit === "%" ? "%" : s.unit === "Index" ? "" : ""}
              change={s.change}
              note={s.note || s.latest_date}
            />
          );
        })}
      </div>
      <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>
          <strong style={{ color: TEXT1 }}>Benchmarking: </strong>
          Medical Care CPI is the primary benchmark for plan cost trend assumptions. Compare your plan's PMPM trend
          against CPIMEDSL. Rates above CPI growth for 3+ consecutive years warrant a vendor cost-structure review.
          10-Year Treasury (DGS10) is used by stop-loss carriers for reserve assumptions — rising yields tighten capacity.
        </p>
      </div>
    </>
  );
}

/* ── BLS Section ─────────────────────────────────────────────────────────────── */
function BlsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/market-intel/bls"],
    queryFn: async () => {
      const r = await fetch("/api/market-intel/bls", { credentials: "include" });
      return r.json();
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, height: 90, opacity: 0.4 }}/>
        ))}
      </div>
    );
  }

  if (data?.status === "ERROR") {
    return (
      <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}30`, borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ color: AMBER, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>BLS API Unavailable</div>
        <div style={{ color: TEXT2, fontSize: 11 }}>
          {data.error || "BLS API temporarily unavailable. The v1 keyless API is rate limited to 25 queries/day."}
          {" "}Add <code style={{ color: TEAL }}>BLS_API_KEY</code> (free at bls.gov/developers) for reliable access.
        </div>
      </div>
    );
  }

  const series = data?.series || {};
  const KEY_SERIES = [
    "CEU6500000001", "CEU6500000008",
    "CEU6562000001", "CEU6562000008",
    "CEU6561000001", "CEU6561000008",
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginBottom: 12 }}>
        {KEY_SERIES.map(sid => {
          const s = series[sid];
          if (!s) return null;
          const isWage = sid.endsWith("0008");
          return (
            <Stat
              key={sid}
              label={s.label?.replace(" — ", "\n").split("—")[0]?.trim() || sid}
              value={s.latest_value}
              unit={isWage ? "$/hr" : "K"}
              change={s.change}
              note={s.latest_period}
            />
          );
        })}
      </div>
      <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>
          <strong style={{ color: TEXT1 }}>API Tier: </strong>
          {data?.api_tier || "BLS v1 keyless"}. {data?.note}
          {" "}Healthcare average hourly earnings are used to benchmark plan administrative cost allocations.
          Significant deviations in admin cost per employee above sector wages warrant scrutiny.
        </p>
      </div>
    </>
  );
}

/* ── USASpending Section ─────────────────────────────────────────────────────── */
function UsaSpendingSection() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["/api/market-intel/usaspending", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/market-intel/usaspending?name=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const EXAMPLES = ["CVS Health", "UnitedHealth", "Humana", "McKesson", "Cigna", "Aetna"];

  return (
    <div>
      <div style={{ background: `${TEAL}12`, border: `1px solid ${TEAL}28`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Info size={13} color={TEAL}/>
          <span style={{ color: TEAL, fontSize: 11, fontWeight: 700 }}>USASpending.gov — 31 U.S.C. § 6101 (FFATA) — No Key Required</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          Search any company's federal contract and grant history. Terminated-for-default contracts are a
          material risk signal for ERISA § 408(b)(2) covered service provider vetting.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT2 }}/>
          <input
            data-testid="input-usaspending-company"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && query.trim() && setSearch(query.trim())}
            placeholder="Company or organization name…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 13 }}
          />
        </div>
        <button
          data-testid="button-usaspending-search"
          onClick={() => query.trim() && setSearch(query.trim())}
          disabled={isFetching}
          style={{ height: 40, padding: "0 20px", background: TEAL, border: "none", borderRadius: 8,
            color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isFetching ? "…" : "Search"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); setSearch(ex); }}
            data-testid={`button-usa-example-${ex.toLowerCase().replace(/\s+/g,"-")}`}
            style={{ background: `${TEAL}12`, border: `1px solid ${TEAL}28`, borderRadius: 20,
              color: TEAL, fontSize: 11, fontWeight: 600, padding: "4px 12px", cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      {data && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ color: TEAL, fontSize: 22, fontWeight: 800 }}>{data.total_awards?.toLocaleString() || "0"}</div>
              <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>Total Federal Awards</div>
            </div>
            <div style={{ flex: 1, background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ color: AMBER, fontSize: 22, fontWeight: 800 }}>
                {data.total_amount > 0 ? `$${(data.total_amount / 1e6).toFixed(1)}M` : "$0"}
              </div>
              <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>Total Award Value</div>
            </div>
          </div>

          {data.records?.length > 0 && (
            <div style={{ overflowX: "auto", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["Award ID", "Recipient", "Amount", "Agency", "Type", "Start", "End"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", color: TEXT2, fontWeight: 700, textAlign: "left",
                        fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.records.map((r: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "transparent" : `${CARD2}80` }}>
                      <td style={{ padding: "8px 12px", color: TEAL, fontFamily: "monospace", fontSize: 10 }}>{r.award_id || "—"}</td>
                      <td style={{ padding: "8px 12px", color: TEXT1 }}>{r.recipient || "—"}</td>
                      <td style={{ padding: "8px 12px", color: AMBER, fontWeight: 700 }}>
                        {r.amount > 0 ? `$${r.amount.toLocaleString(undefined, {maximumFractionDigits:0})}` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.agency || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ background: `${ACCENT}18`, color: ACCENT, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>
                          {r.award_type || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.start_date || "—"}</td>
                      <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.end_date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.total_awards === 0 && (
            <div style={{ textAlign: "center", padding: "30px 20px", color: TEXT2 }}>
              <CheckCircle2 size={32} color={GREEN} style={{ marginBottom: 8 }}/>
              <div style={{ color: TEXT1, fontWeight: 700, marginBottom: 4 }}>No Federal Contracts Found</div>
              <div style={{ fontSize: 11 }}>"{data.query}" has no federal contract awards on record.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── EDGAR XBRL Section ──────────────────────────────────────────────────────── */
function EdgarXbrlSection() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["/api/market-intel/edgar-xbrl", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/market-intel/edgar-xbrl?ticker=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const EXAMPLES = ["CVS", "UNH", "HUM", "CI", "MCK", "ABC"];

  function fmt(v: number | undefined, isMoney = true) {
    if (v === null || v === undefined) return "N/A";
    if (isMoney) {
      if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
      if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
      return `$${v.toLocaleString()}`;
    }
    return v.toLocaleString();
  }

  return (
    <div>
      <div style={{ background: `${PURPLE}12`, border: `1px solid ${PURPLE}28`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <FileText size={13} color={PURPLE}/>
          <span style={{ color: PURPLE, fontSize: 11, fontWeight: 700 }}>SEC EDGAR XBRL — Structured Company Financials — No Key Required</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          Pull structured 10-K financial data (revenue, net income, employees, debt, cash) for any US public company.
          Richer than free text search — machine-readable XBRL from official SEC EDGAR submissions.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT2 }}/>
          <input
            data-testid="input-edgar-ticker"
            value={query}
            onChange={e => setQuery(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && query.trim() && setSearch(query.trim())}
            placeholder="Ticker symbol (e.g. CVS, UNH, MCK)…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 13, fontFamily: "monospace" }}
          />
        </div>
        <button
          data-testid="button-edgar-search"
          onClick={() => query.trim() && setSearch(query.trim())}
          disabled={isFetching}
          style={{ height: 40, padding: "0 20px", background: PURPLE, border: "none", borderRadius: 8,
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isFetching ? "…" : "Pull Financials"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); setSearch(ex); }}
            data-testid={`button-edgar-example-${ex.toLowerCase()}`}
            style={{ background: `${PURPLE}12`, border: `1px solid ${PURPLE}28`, borderRadius: 20,
              color: PURPLE, fontSize: 11, fontWeight: 700, padding: "4px 14px", cursor: "pointer", fontFamily: "monospace" }}>
            {ex}
          </button>
        ))}
      </div>

      {data && !data.found && (
        <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}30`, borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ color: AMBER, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Ticker Not Found</div>
          <div style={{ color: TEXT2, fontSize: 11 }}>{data.error || `"${data.ticker}" was not found in SEC EDGAR. Try the exact NYSE/NASDAQ ticker symbol.`}</div>
        </div>
      )}

      {data?.found && (
        <>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ color: TEXT1, fontWeight: 900, fontSize: 18 }}>{data.company_name}</div>
                <div style={{ color: TEXT2, fontSize: 11, marginTop: 2 }}>
                  {data.ticker} · CIK: {data.cik} · {data.sic_description} (SIC {data.sic}) · {data.state_of_incorporation}
                </div>
              </div>
              <a href={data.edgar_url} target="_blank" rel="noopener noreferrer"
                style={{ color: PURPLE, fontSize: 11, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <ExternalLink size={12}/> SEC EDGAR
              </a>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
              {[
                { label: "Revenue",      key: "revenues",          color: GREEN },
                { label: "Net Income",   key: "net_income",        color: TEAL },
                { label: "Total Assets", key: "total_assets",      color: ACCENT },
                { label: "LT Debt",      key: "long_term_debt",    color: RED },
                { label: "Cash",         key: "cash",              color: GREEN },
                { label: "Equity",       key: "equity",            color: PURPLE },
                { label: "Op. Income",   key: "operating_income",  color: AMBER },
                { label: "Benefits Exp", key: "benefits_expense",  color: ROSE },
                { label: "Employees",    key: "employees",         color: TEAL, nonMoney: true },
              ].map(m => {
                const fin = data.financials?.[m.key];
                return (
                  <div key={m.key} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{m.label}</div>
                    <div style={{ color: fin?.value !== undefined && fin?.value !== null ? m.color : TEXT2, fontSize: 16, fontWeight: 800 }}>
                      {fin?.value !== undefined && fin?.value !== null
                        ? fmt(fin.value, !m.nonMoney)
                        : "N/A"}
                    </div>
                    {fin?.period_end && (
                      <div style={{ color: TEXT2, fontSize: 9, marginTop: 4 }}>{fin.period_end} · {fin.form}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>
              <strong style={{ color: TEXT1 }}>Source: </strong>
              SEC EDGAR XBRL Company Facts. Data sourced from official SEC 10-K annual filings.
              Financial figures may lag by 1–3 months pending filing dates. Verify at{" "}
              <a href={data.edgar_url} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT }}>SEC EDGAR</a> before use in M&A diligence.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Census Section ──────────────────────────────────────────────────────────── */
function CensusSection() {
  const { data } = useQuery({
    queryKey: ["/api/market-intel/census"],
    queryFn: async () => {
      const r = await fetch("/api/market-intel/census", { credentials: "include" });
      return r.json();
    },
  });

  if (!data) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, height: 90, opacity: 0.4 }}/>
        ))}
      </div>
    );
  }

  if (data.status === "ERROR") {
    return (
      <div style={{ background: `${RED}12`, border: `1px solid ${RED}30`, borderRadius: 10, padding: "14px 16px" }}>
        <div style={{ color: RED, fontWeight: 700, fontSize: 12 }}>Census API Error</div>
        <div style={{ color: TEXT2, fontSize: 11, marginTop: 4 }}>{data.error}</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ color: TEXT2, fontSize: 11, marginBottom: 12 }}>{data.geography} · ACS 5-Year {data.year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 10 }}>
        {Object.entries(data.data || {}).map(([key, d]: any) => (
          <div key={key} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              {d.label}
            </div>
            <div style={{ color: TEXT1, fontSize: 20, fontWeight: 800 }}>
              {d.value !== null ? d.value.toLocaleString() : "N/A"}
            </div>
          </div>
        ))}
        {data.employment_rate_pct && (
          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Employment Rate (%)
            </div>
            <div style={{ color: GREEN, fontSize: 20, fontWeight: 800 }}>{data.employment_rate_pct}%</div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
const SECTIONS = [
  { id: "fred",        label: "Economic Indicators",  icon: TrendingUp,   color: TEAL,   desc: "FRED — Medical CPI, unemployment, treasury yields" },
  { id: "bls",         label: "Labor Market",         icon: Users,        color: ACCENT, desc: "BLS — Healthcare employment & average hourly wages" },
  { id: "usaspending", label: "Federal Spending",     icon: DollarSign,   color: AMBER,  desc: "USASpending.gov — Federal contract & grant history by company" },
  { id: "edgar",       label: "Company Financials",   icon: FileText,     color: PURPLE, desc: "SEC EDGAR XBRL — Structured 10-K financials by ticker" },
  { id: "census",      label: "Demographics",         icon: MapPin,       color: GREEN,  desc: "Census ACS — Geographic income & employment data" },
];

export default function MarketIntelligence() {
  const [activeSection, setActiveSection] = useState("fred");

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "28px 24px", color: TEXT1 }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${TEAL}18`,
              border: `1px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={20} color={TEAL}/>
            </div>
            <div>
              <h1 style={{ color: TEXT1, fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                Market Intelligence™
              </h1>
              <p style={{ color: TEXT2, fontSize: 12, margin: 0, marginTop: 2 }}>
                FRED · BLS · USASpending · SEC EDGAR XBRL · Census Bureau — Free Economic APIs
              </p>
            </div>
          </div>

          {/* Source chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {[
              { label: "FRED (Fed Reserve)", color: TEAL },
              { label: "BLS (Labor Stats)", color: ACCENT },
              { label: "USASpending.gov", color: AMBER },
              { label: "SEC EDGAR XBRL", color: PURPLE },
              { label: "Census Bureau ACS", color: GREEN },
            ].map(s => (
              <span key={s.label} style={{
                background: `${s.color}14`, color: s.color, border: `1px solid ${s.color}30`,
                borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.4
              }}>{s.label}</span>
            ))}
          </div>
        </div>

        {/* Section Nav */}
        <div style={{ display: "flex", gap: 4, background: CARD, borderRadius: 12,
          border: `1px solid ${BORDER}`, padding: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {SECTIONS.map(s => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                data-testid={`tab-market-${s.id}`}
                onClick={() => setActiveSection(s.id)}
                style={{
                  flex: 1, minWidth: 90, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? `${s.color}20` : "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  transition: "all 0.15s",
                }}
              >
                <s.icon size={16} color={active ? s.color : TEXT2}/>
                <span style={{ color: active ? TEXT1 : TEXT2, fontSize: 11, fontWeight: active ? 700 : 500 }}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Section description */}
        <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: "8px 14px", marginBottom: 18 }}>
          <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
            {SECTIONS.find(s => s.id === activeSection)?.desc}
          </p>
        </div>

        {/* Active content */}
        {activeSection === "fred"        && <FredSection />}
        {activeSection === "bls"         && <BlsSection />}
        {activeSection === "usaspending" && <UsaSpendingSection />}
        {activeSection === "edgar"       && <EdgarXbrlSection />}
        {activeSection === "census"      && <CensusSection />}

        {/* Footer */}
        <div style={{ marginTop: 28, padding: "16px 0", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ color: TEXT2, fontSize: 10, margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: TEXT1 }}>Data Sources: </strong>
            Federal Reserve Bank of St. Louis (FRED® API) · U.S. Bureau of Labor Statistics · USASpending.gov
            (31 U.S.C. § 6101) · SEC EDGAR XBRL Company Facts (15 U.S.C. § 78l) · U.S. Census Bureau ACS 5-Year.
            FRED and Census require free API keys. All other sources require no registration.
            Data is provided for informational purposes only. Independent verification required before use in
            actuarial assumptions, plan design, or investment decisions.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            {[
              { label: "Get FRED Key (required)",       url: "https://fred.stlouisfed.org/docs/api/api_key.html" },
              { label: "Get BLS Key (higher limits)",   url: "https://data.bls.gov/registrationEngine/" },
              { label: "Get Census Key (higher limits)",url: "https://api.census.gov/data/key_signup.html" },
            ].map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ color: ACCENT, fontSize: 10, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink size={10}/> {link.label} (free)
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
