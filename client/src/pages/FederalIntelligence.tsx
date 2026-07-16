import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Shield, AlertTriangle, CheckCircle2, XCircle, ExternalLink,
  RefreshCw, ChevronDown, ChevronRight, Info, Building2, Gavel,
  FileSearch, Scale, Landmark, AlertCircle, Download, Hash,
  Activity, BookOpen, Layers, List
} from "lucide-react";
import FederalIntelReport from "./FederalIntelReport";

const BG    = "transparent";
const CARD  = "rgba(255,255,255,0.82)";
const CARD2 = "rgba(248,250,252,0.82)";
const BORDER= "rgba(15,23,42,0.10)";
const TEXT1 = "#08111f";
const TEXT2 = "#3f516a";
const ACCENT= "#4f7dff";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED   = "#ef4444";
const BLUE  = "#3b82f6";
const PURPLE= "#8b5cf6";
const CYAN  = "#06b6d4";
const ROSE  = "#f43f5e";

type SourceStatus = "CLEAR" | "WATCH" | "FLAGGED" | "UNAVAILABLE" | "NO_KEY";

interface SourceResult {
  source: string;
  full_name: string;
  source_url: string;
  authority: string;
  description: string;
  hits: number;
  records: Record<string, unknown>[];
  status: SourceStatus;
  error?: string;
}

interface ScanResult {
  company: string;
  ein?: string;
  risk_score: number;
  risk_signal: "CLEAR" | "WATCH" | "ELEVATED" | "HIGH";
  risk_color: string;
  total_hits: number;
  sources_flagged: number;
  sources_watch: number;
  sources_clear: number;
  sources_unavailable: number;
  sources: SourceResult[];
  legal_note: string;
  scanned_at: string;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function statusColor(s: SourceStatus) {
  if (s === "CLEAR")       return GREEN;
  if (s === "WATCH")       return BLUE;
  if (s === "FLAGGED")     return RED;
  if (s === "UNAVAILABLE") return TEXT2;
  if (s === "NO_KEY")      return AMBER;
  return TEXT2;
}

function SourceIcon({ source }: { source: string }) {
  if (source.includes("OIG"))     return <Shield size={17} color={ROSE}/>;
  if (source.includes("SAM"))     return <Landmark size={17} color={PURPLE}/>;
  if (source.includes("Court"))   return <Gavel size={17} color={CYAN}/>;
  if (source.includes("DOL"))     return <Scale size={17} color={AMBER}/>;
  if (source.includes("Sanction") || source.includes("OFAC")) return <AlertCircle size={17} color={RED}/>;
  if (source.includes("FDA"))     return <Activity size={17} color="#10b981"/>;
  if (source.includes("SEC"))     return <BookOpen size={17} color="#a78bfa"/>;
  if (source.includes("FINRA"))   return <Layers size={17} color="#38bdf8"/>;
  return <FileSearch size={17} color={ACCENT}/>;
}

function StatusBadge({ status }: { status: SourceStatus }) {
  const color = statusColor(status);
  const label = status === "NO_KEY" ? "KEY REQUIRED" : status;
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 10px", fontSize: 10, fontWeight: 800, letterSpacing: 1,
    }}>{label}</span>
  );
}

/* ── Risk Score Gauge ─────────────────────────────────────────────────────── */
function RiskGauge({ score, signal, color }: { score: number; signal: string; color: string }) {
  const pct = Math.min(100, score);
  const r = 44, cx = 56, cy = 56;
  const circ = 2 * Math.PI * r;
  const dashArr = circ * 0.75;
  const dashOff = dashArr * (1 - pct / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={112} height={80} viewBox="0 0 112 80">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth={8}
          strokeDasharray={`${dashArr} ${circ}`} strokeDashoffset={-circ * 0.125}
          strokeLinecap="round" transform="rotate(135, 56, 56)"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dashArr - dashOff} ${circ}`} strokeDashoffset={-circ * 0.125}
          strokeLinecap="round" transform="rotate(135, 56, 56)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}/>
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={22} fontWeight={900}>{score}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={TEXT2} fontSize={8} letterSpacing={1}>RISK SCORE</text>
      </svg>
      <div style={{ color, fontSize: 13, fontWeight: 900, letterSpacing: 1, marginTop: -8 }}>{signal}</div>
    </div>
  );
}


/* ── Record Table ─────────────────────────────────────────────────────────── */
function RecordTable({ records, source }: { records: Record<string,unknown>[]; source: string }) {
  if (!records || records.length === 0) return null;
  const renderValue = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "number") return v.toLocaleString();
    return String(v).slice(0, 80);
  };
  const allKeys = Array.from(new Set(records.flatMap(r => Object.keys(r)))).filter(k => k !== "url");
  return (
    <div style={{ overflowX: "auto", marginTop: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>{allKeys.map(k => (
            <th key={k} style={{ padding: "6px 10px", textAlign: "left", color: TEXT2, fontWeight: 700,
              fontSize: 10, letterSpacing: 0.5, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap",
              textTransform: "uppercase" }}>{k.replace(/_/g, " ")}</th>
          ))}
          {(source.includes("Court") || source.includes("SEC")) && <th style={{ padding: "6px 10px", color: TEXT2, fontSize: 10 }}>LINK</th>}
          </tr>
        </thead>
        <tbody>{records.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(15,23,42,0.025)" }}>
            {allKeys.map(k => (
              <td key={k} style={{ padding: "7px 10px",
                color: (k.includes("name") || k.includes("Name") || k.includes("firm")) ? TEXT1 : TEXT2,
                fontWeight: (k.includes("name") || k.includes("Name")) ? 600 : 400,
                borderBottom: `1px solid ${BORDER}`, maxWidth: 200, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {renderValue(r[k])}
              </td>
            ))}
            {(source.includes("Court") || source.includes("SEC")) && (
              <td style={{ padding: "7px 10px", borderBottom: `1px solid ${BORDER}` }}>
                {r.url ? (
                  <a href={String(r.url)} target="_blank" rel="noopener noreferrer"
                    style={{ color: ACCENT, display: "flex", alignItems: "center", gap: 4 }}>
                    <ExternalLink size={12}/> View
                  </a>
                ) : "—"}
              </td>
            )}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* ── Source Card ──────────────────────────────────────────────────────────── */
function SourceCard({ source: src }: { source: SourceResult }) {
  const [expanded, setExpanded] = useState(src.status === "FLAGGED" || src.status === "WATCH");
  const sc = statusColor(src.status);
  return (
    <div style={{
      background: CARD2,
      border: `1px solid ${src.status === "FLAGGED" ? `${RED}44` : src.status === "WATCH" ? `${BLUE}33` : BORDER}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      <div onClick={() => setExpanded(e => !e)} style={{
        display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", cursor: "pointer",
        background: src.status === "FLAGGED" ? `${RED}08` : "transparent",
      }}>
        <SourceIcon source={src.source}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700 }}>{src.source}</span>
            <StatusBadge status={src.status}/>
            {src.hits > 0 && (
              <span style={{ color: sc, fontSize: 11, fontWeight: 600 }}>
                {src.hits.toLocaleString()} {src.hits === 1 ? "record" : "records"}
              </span>
            )}
          </div>
          <div style={{ color: TEXT2, fontSize: 10, marginTop: 2 }}>{src.authority}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {src.source_url && (
            <a href={src.source_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()} style={{ color: TEXT2, display: "flex" }}>
              <ExternalLink size={12}/>
            </a>
          )}
          {expanded ? <ChevronDown size={15} color={TEXT2}/> : <ChevronRight size={15} color={TEXT2}/>}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 20px 16px", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ color: TEXT2, fontSize: 12, lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
            {src.description}
          </p>
          {src.status === "NO_KEY" && (
            <div style={{ marginTop: 10, background: `${AMBER}12`, border: `1px solid ${AMBER}33`,
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: AMBER }}>
              {src.error}
            </div>
          )}
          {src.status === "UNAVAILABLE" && src.error && (
            <div style={{ marginTop: 10, background: `${RED}10`, border: `1px solid ${RED}22`,
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: TEXT2 }}>
              Source temporarily unavailable: {src.error}
            </div>
          )}
          {src.records && src.records.length > 0 && <RecordTable records={src.records} source={src.source}/>}
          {src.status === "CLEAR" && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 12 }}>
              <CheckCircle2 size={13}/> No records found in this database.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Watchlist Batch Scan ─────────────────────────────────────────────────── */
function WatchlistScanner({ onSelect }: { onSelect: (name: string) => void }) {
  const TARGETS = [
    "CVS Health", "McKesson Corporation", "UnitedHealth Group", "Humana", "Cigna",
    "Aetna", "Anthem", "Centene", "Molina Healthcare", "WellCare Health Plans",
    "Express Scripts", "OptumRx", "Caremark", "Medco Health Solutions",
    "Magellan Health", "Accolade", "HealthSmart", "MedCost", "Allied Benefit Systems",
  ];
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer",
      }}>
        <List size={15} color={ACCENT}/>
        <span style={{ color: TEXT1, fontSize: 13, fontWeight: 700, flex: 1 }}>Watchlist Batch Scan</span>
        <span style={{ color: TEXT2, fontSize: 11 }}>
          {TARGETS.length} entities — click any to scan instantly
        </span>
        {open ? <ChevronDown size={14} color={TEXT2}/> : <ChevronRight size={14} color={TEXT2}/>}
      </div>
      {open && (
        <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ color: TEXT2, fontSize: 11, marginTop: 10, marginBottom: 12 }}>
            Pre-loaded with major PBMs, carriers, TPAs, and managed care organizations.
            Click any entity to run a full 8-database federal scan.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TARGETS.map(t => (
              <button key={t} onClick={() => onSelect(t)} style={{
                background: `${ACCENT}10`, border: `1px solid ${ACCENT}25`,
                borderRadius: 20, color: TEXT2, fontSize: 11, fontWeight: 500,
                padding: "5px 12px", cursor: "pointer",
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */
export default function FederalIntelligence() {
  const [inputName, setInputName] = useState("");
  const [inputEin,  setInputEin]  = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchEin,  setSearchEin]  = useState("");
  const [showReport, setShowReport] = useState(false);

  const { data, isLoading, error } = useQuery<ScanResult>({
    queryKey: ["/api/federal-intel/scan", searchName, searchEin],
    queryFn: async () => {
      let url = `/api/federal-intel/scan?name=${encodeURIComponent(searchName)}`;
      if (searchEin) url += `&ein=${encodeURIComponent(searchEin)}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || "Scan failed"); }
      return r.json();
    },
    enabled: !!searchName,
    staleTime: 600_000,
  });

  const { data: sourcesData } = useQuery<{ sources: Array<{id:string;name:string;enabled:boolean;requires_key:boolean;key_source?:string}> }>({
    queryKey: ["/api/federal-intel/sources"],
    queryFn: async () => {
      const r = await fetch("/api/federal-intel/sources", { credentials: "include" });
      return r.json();
    },
  });

  const handleSearch = (name = inputName, ein = inputEin) => {
    const n = name.trim();
    if (n.length < 2) return;
    setSearchName(n);
    setSearchEin(ein.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const enabledCount = sourcesData?.sources?.filter(s => s.enabled).length ?? 7;

  return (
    <>
    {showReport && data && (
      <FederalIntelReport data={data} onClose={() => setShowReport(false)}/>
    )}
    <div className="kiq-ops-shell" style={{ minHeight: "100vh", background: BG, padding: "28px 24px", color: TEXT1, fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div className="kiq-ops-header" style={{ marginBottom: 24, padding: 20, borderRadius: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ background: `${ROSE}22`, border: `1px solid ${ROSE}44`, borderRadius: 10, padding: 10 }}>
              <Shield size={22} color={ROSE}/>
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: TEXT1, margin: 0 }}>
                Federal Risk Intelligence™
              </h1>
              <p style={{ color: TEXT2, fontSize: 12, margin: "3px 0 0" }}>
                Parallel real-time scan across {enabledCount} federal databases — OIG · SAM.gov · PACER · DOL · OFAC · FDA · SEC · FINRA
              </p>
            </div>
          </div>

          {sourcesData && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {sourcesData.sources.map(s => (
                <div key={s.id} style={{
                  background: s.enabled ? `${GREEN}10` : `${AMBER}10`,
                  border: `1px solid ${s.enabled ? GREEN : AMBER}28`,
                  borderRadius: 20, padding: "3px 10px", fontSize: 10,
                  color: s.enabled ? GREEN : AMBER,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {s.enabled ? <CheckCircle2 size={9}/> : <AlertTriangle size={9}/>}
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="kiq-ops-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 240, position: "relative" }}>
              <Search size={14} color={TEXT2} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}/>
              <input data-testid="input-federal-intel-name"
                value={inputName} onChange={e => setInputName(e.target.value)} onKeyDown={handleKey}
                placeholder="Company or entity name (e.g. CVS Health, McKesson…)"
                style={{ width: "100%", background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: "10px 12px 10px 32px", color: TEXT1, fontSize: 13, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <div style={{ flex: 1, minWidth: 150, position: "relative" }}>
              <Hash size={13} color={TEXT2} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}/>
              <input data-testid="input-federal-intel-ein"
                value={inputEin} onChange={e => setInputEin(e.target.value)} onKeyDown={handleKey}
                placeholder="EIN (optional)"
                style={{ width: "100%", background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: "10px 12px 10px 28px", color: TEXT1, fontSize: 13, outline: "none", boxSizing: "border-box" }}/>
            </div>
            <button data-testid="button-federal-intel-search" onClick={() => handleSearch()}
              disabled={isLoading || inputName.trim().length < 2}
              style={{
                background: isLoading || inputName.trim().length < 2 ? `${ROSE}44` : ROSE,
                border: "none", borderRadius: 8, color: "#0F172A", fontSize: 13, fontWeight: 700,
                padding: "10px 22px", cursor: isLoading || inputName.trim().length < 2 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 7,
              }}>
              {isLoading ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }}/> : <Shield size={13}/>}
              {isLoading ? "Scanning 8 databases…" : "Run Federal Scan"}
            </button>
          </div>
          <p style={{ color: TEXT2, fontSize: 10, margin: "8px 0 0" }}>
            All 8 sources query in parallel. EIN improves match precision for DOL and SAM.gov lookups.
          </p>
        </div>

        {/* Watchlist */}
        <div style={{ marginBottom: 20 }}>
          <WatchlistScanner onSelect={name => { setInputName(name); handleSearch(name, inputEin); }}/>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: `${RED}12`, border: `1px solid ${RED}33`, borderRadius: 10,
            padding: 14, color: RED, fontSize: 13, marginBottom: 18 }}>
            Scan failed: {(error as Error).message}
          </div>
        )}

        {/* Results */}
        {data && (
          <div>
            {/* Summary bar */}
            <div style={{
              background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
              padding: "20px 24px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
            }}>
              <RiskGauge score={data.risk_score} signal={data.risk_signal} color={data.risk_color}/>

              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ color: TEXT1, fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{data.company}</div>
                {data.ein && <div style={{ color: TEXT2, fontSize: 11, marginBottom: 10 }}>EIN: {data.ein}</div>}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Stat label="Total Hits"      value={String(data.total_hits)}       color={data.total_hits > 0 ? RED : GREEN}/>
                  <Stat label="Flagged Sources" value={String(data.sources_flagged)}  color={data.sources_flagged > 0 ? RED : GREEN}/>
                  <Stat label="Watch Sources"   value={String(data.sources_watch)}    color={data.sources_watch > 0 ? AMBER : GREEN}/>
                  <Stat label="Clear Sources"   value={String(data.sources_clear)}    color={GREEN}/>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button data-testid="button-federal-intel-full-report" onClick={() => setShowReport(true)}
                  style={{
                    background: ROSE, border: "none", borderRadius: 8, color: "#0F172A",
                    fontSize: 12, fontWeight: 700, padding: "9px 18px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                  }}>
                  <Download size={13}/>
                  Full Report / PDF
                </button>
                {data.scanned_at && (
                  <div style={{ color: TEXT2, fontSize: 10, textAlign: "center" }}>
                    Scanned {new Date(data.scanned_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Source cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {data.sources.map((s, i) => <SourceCard key={i} source={s}/>)}
            </div>

            {/* Legal note */}
            <div style={{ background: `${AMBER}08`, border: `1px solid ${AMBER}22`, borderRadius: 10,
              padding: "12px 16px", display: "flex", gap: 10 }}>
              <Info size={13} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }}/>
              <p style={{ color: TEXT2, fontSize: 11, lineHeight: 1.6, margin: 0 }}>{data.legal_note}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!data && !isLoading && !error && (
          <div style={{ textAlign: "center", paddingTop: 48 }}>
            <Building2 size={44} color={TEXT2} style={{ opacity: 0.3, marginBottom: 14 }}/>
            <div style={{ color: TEXT1, fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              8-Database Federal Intelligence Scan
            </div>
            <div style={{ color: TEXT2, fontSize: 12, maxWidth: 500, margin: "0 auto 24px" }}>
              Enter a company name or EIN above. Queries OIG LEIE, SAM.gov, federal courts,
              DOL enforcement, OFAC sanctions, FDA recalls, SEC litigation, and FINRA BrokerCheck in parallel.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {["CVS Health", "McKesson", "UnitedHealth Group", "Humana", "Cigna", "Express Scripts"].map(n => (
                <button key={n} data-testid={`button-example-${n.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => { setInputName(n); handleSearch(n, ""); }}
                  style={{ background: `${ROSE}12`, border: `1px solid ${ROSE}28`, borderRadius: 20,
                    color: ROSE, fontSize: 11, fontWeight: 600, padding: "5px 14px", cursor: "pointer" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ color, fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
