import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Mail, CheckCircle2, XCircle, AlertCircle, Copy,
  Building2, Users, DollarSign, Globe, ChevronRight, Loader2,
  Star, Shield, Zap, MailOpen, MapPin, X,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";

const FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

const ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "D.C.", FL: "Florida",
  GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

// Center [lon, lat] + scale for geoMercator zoom into each state
const STATE_GEO: Record<string, { center: [number, number]; scale: number }> = {
  AL: { center: [-86.7, 32.8], scale: 4500 },
  AK: { center: [-153.0, 64.2], scale: 800 },
  AZ: { center: [-111.7, 34.3], scale: 3800 },
  AR: { center: [-92.4, 34.9], scale: 5000 },
  CA: { center: [-119.5, 37.3], scale: 2600 },
  CO: { center: [-105.7, 39.0], scale: 4000 },
  CT: { center: [-72.7, 41.6], scale: 17000 },
  DE: { center: [-75.5, 39.0], scale: 20000 },
  DC: { center: [-77.0, 38.9], scale: 80000 },
  FL: { center: [-81.6, 27.7], scale: 3600 },
  GA: { center: [-83.4, 32.7], scale: 4000 },
  HI: { center: [-157.8, 20.3], scale: 3000 },
  ID: { center: [-114.5, 44.4], scale: 3000 },
  IL: { center: [-89.2, 40.0], scale: 4200 },
  IN: { center: [-86.3, 39.8], scale: 5500 },
  IA: { center: [-93.1, 42.0], scale: 4800 },
  KS: { center: [-98.4, 38.5], scale: 4500 },
  KY: { center: [-84.9, 37.5], scale: 5000 },
  LA: { center: [-91.8, 31.1], scale: 5000 },
  ME: { center: [-69.4, 45.4], scale: 4200 },
  MD: { center: [-76.6, 39.0], scale: 8000 },
  MA: { center: [-71.8, 42.2], scale: 9000 },
  MI: { center: [-84.5, 44.3], scale: 3600 },
  MN: { center: [-94.7, 46.4], scale: 3800 },
  MS: { center: [-89.7, 32.7], scale: 5000 },
  MO: { center: [-92.5, 38.4], scale: 4400 },
  MT: { center: [-110.4, 46.9], scale: 2800 },
  NE: { center: [-99.9, 41.5], scale: 4200 },
  NV: { center: [-116.7, 39.0], scale: 3200 },
  NH: { center: [-71.6, 43.7], scale: 7500 },
  NJ: { center: [-74.5, 40.1], scale: 10000 },
  NM: { center: [-106.1, 34.5], scale: 3600 },
  NY: { center: [-75.5, 42.8], scale: 3800 },
  NC: { center: [-79.4, 35.5], scale: 4800 },
  ND: { center: [-100.5, 47.5], scale: 4800 },
  OH: { center: [-82.8, 40.3], scale: 5200 },
  OK: { center: [-97.5, 35.5], scale: 4200 },
  OR: { center: [-120.5, 43.9], scale: 3600 },
  PA: { center: [-77.2, 40.9], scale: 5200 },
  RI: { center: [-71.5, 41.7], scale: 24000 },
  SC: { center: [-80.9, 33.8], scale: 5500 },
  SD: { center: [-100.2, 44.4], scale: 4200 },
  TN: { center: [-86.3, 35.8], scale: 5200 },
  TX: { center: [-99.3, 31.5], scale: 2600 },
  UT: { center: [-111.0, 39.4], scale: 3800 },
  VT: { center: [-72.7, 44.0], scale: 7500 },
  VA: { center: [-79.4, 37.5], scale: 4800 },
  WA: { center: [-120.4, 47.4], scale: 3800 },
  WV: { center: [-80.6, 38.9], scale: 5500 },
  WI: { center: [-89.8, 44.5], scale: 4800 },
  WY: { center: [-107.6, 43.0], scale: 3800 },
};

type Employer = {
  ein: string; name: string; plan: string; state: string; city: string;
  year: number; participants: number; welfare_premiums: number;
  has_health: boolean; has_stop_loss: boolean; inferred_domain: string;
};

type VerifiedEmail = {
  email: string; first_name: string; last_name: string; position: string;
  confidence: number; result: string; score: number; disposable: boolean; mx_records: boolean;
};

type DiscoverResult = {
  employer: { name: string; plan_name: string; participants: number; welfare_premiums: number; domain: string };
  hunter_meta: { total_emails_found: number; organization: string };
  candidates: { email: string; first_name: string; last_name: string; position: string; confidence: number; sources: number }[];
  verified: VerifiedEmail[];
  best_contact: VerifiedEmail | null;
  outreach: { subject_lines: string[]; email_body: string };
};

function VerificationBadge({ result }: { result: string }) {
  if (result === "deliverable") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
      <CheckCircle2 size={11} /> Deliverable
    </span>
  );
  if (result === "invalid") return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
      <XCircle size={11} /> Invalid
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
      <AlertCircle size={11} /> {result || "Unknown"}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.min(100, score);
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 64, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}

function stateColor(count: number, max: number, isSelected: boolean, isHovered: boolean): string {
  if (isSelected) return BB_CRIMSON;
  if (isHovered) return "#c0253a";
  if (!count || max === 0) return "rgba(255,255,255,0.06)";
  const t = Math.min(count / max, 1);
  const r = Math.round(0 + t * 155);
  const g = Math.round(43 * (1 - t));
  const b = Math.round(92 * (1 - t));
  return `rgba(${r},${g},${b},${0.3 + t * 0.65})`;
}

export default function ContactIntelligence() {
  const { toast } = useToast();
  const [location] = useLocation();

  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [stateProspects, setStateProspects] = useState<Employer[]>([]);
  const [loadingState, setLoadingState] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Employer[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Employer | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DiscoverResult | null>(null);
  const [copiedSubject, setCopiedSubject] = useState<number | null>(null);
  const [copiedBody, setCopiedBody] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/contact-intel/state-summary")
      .then(r => r.json())
      .then(setStateCounts)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get("state");
    if (stateParam && ABBR_TO_NAME[stateParam.toUpperCase()]) {
      handleStateClick(stateParam.toUpperCase());
    }
  }, []);

  async function handleStateClick(abbr: string) {
    if (selectedState === abbr) {
      setSelectedState(null);
      setStateProspects([]);
      setSelectedCity(null);
      return;
    }
    setSelectedState(abbr);
    setSelectedCity(null);
    setSelected(null);
    setResult(null);
    setQuery("");
    setSearchResults([]);
    setLoadingState(true);
    try {
      const resp = await fetch(`/api/contact-intel/state-prospects?state=${abbr}&limit=30`);
      if (resp.ok) setStateProspects(await resp.json());
    } finally {
      setLoadingState(false);
    }
  }

  async function handleSearch(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const resp = await fetch(`/api/contact-intel/search-employers?q=${encodeURIComponent(q)}&limit=10`);
        if (resp.ok) setSearchResults(await resp.json());
      } finally { setSearching(false); }
    }, 350);
  }

  function selectEmployer(emp: Employer) {
    setSelected(emp);
    setSearchResults([]);
    setQuery(emp.name);
    setResult(null);
    if (emp.state && emp.state !== selectedState) {
      setSelectedState(emp.state);
    }
  }

  async function runDiscovery() {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    try {
      const resp = await fetch("/api/contact-intel/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ein: selected.ein,
          employer_name: selected.name,
          plan_name: selected.plan,
          participants: selected.participants || 0,
          welfare_premiums: selected.welfare_premiums || 0,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${resp.status}`);
      }
      setResult(await resp.json());
    } catch (e: any) {
      toast({ title: "Discovery failed", description: e.message, variant: "destructive" });
    } finally { setRunning(false); }
  }

  function copyText(text: string, onDone: () => void) {
    navigator.clipboard.writeText(text).then(onDone);
    setTimeout(onDone, 2000);
  }

  // Derive cities from stateProspects, sorted by frequency
  const cityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    stateProspects.forEach(e => {
      if (e.city) map[e.city] = (map[e.city] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [stateProspects]);

  const maxCount = Math.max(...Object.values(stateCounts), 1);

  const baseList = query.trim().length >= 2 ? searchResults : stateProspects;
  const displayList = selectedCity && !query.trim()
    ? baseList.filter(e => e.city === selectedCity)
    : baseList;

  const stateGeo = selectedState ? STATE_GEO[selectedState] : null;

  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#060b18 0%,#080d1e 50%,#060a16 100%)", padding: "32px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 100, padding: "5px 16px", marginBottom: 14 }}>
            <Mail size={12} color={BB_CRIMSON} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Kincaid IQ · Contact Intelligence</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Prospect Contact Discovery
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", margin: 0, maxWidth: 620 }}>
            Click any state on the map — an enlarged view with city filter appears instantly. Select a plan sponsor and run AI-powered email discovery.
          </p>
        </div>

        {/* Main 3-col when state selected, 2-col otherwise */}
        <div style={{
          display: "grid",
          gridTemplateColumns: selectedState ? "340px 280px 1fr" : "460px 1fr",
          gap: 20,
          alignItems: "start",
          transition: "grid-template-columns 0.25s ease",
        }}>

          {/* ── COL 1: US Map + Search + Controls ─────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* US Map */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "14px 14px 6px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                  {selectedState ? `${ABBR_TO_NAME[selectedState] || selectedState} selected` : "Select State"}
                </div>
                {selectedState && (
                  <button
                    onClick={() => { setSelectedState(null); setStateProspects([]); setSelected(null); setResult(null); setSelectedCity(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)", fontSize: 10, cursor: "pointer" }}
                  >
                    <X size={10} /> Clear
                  </button>
                )}
              </div>

              <ComposableMap projection="geoAlbersUsa" style={{ width: "100%", height: "auto" }}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const fips = geo.id as string;
                      const abbr = FIPS_TO_ABBR[fips] || "";
                      const count = stateCounts[abbr] || 0;
                      const isSelected = selectedState === abbr;
                      const isHovered = hoveredState === abbr;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          data-testid={`state-${abbr}`}
                          onClick={() => abbr && handleStateClick(abbr)}
                          onMouseEnter={() => setHoveredState(abbr)}
                          onMouseLeave={() => setHoveredState(null)}
                          style={{
                            default: {
                              fill: stateColor(count, maxCount, isSelected, false),
                              stroke: isSelected ? "#fff" : "rgba(255,255,255,0.12)",
                              strokeWidth: isSelected ? 1.5 : 0.5,
                              outline: "none",
                              cursor: abbr ? "pointer" : "default",
                              transition: "fill 0.15s",
                            },
                            hover: {
                              fill: stateColor(count, maxCount, isSelected, true),
                              stroke: "#fff",
                              strokeWidth: 1,
                              outline: "none",
                              cursor: "pointer",
                            },
                            pressed: {
                              fill: BB_CRIMSON,
                              stroke: "#fff",
                              strokeWidth: 1.5,
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>

              {/* Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, paddingBottom: 4 }}>
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>Fewer</span>
                <div style={{ flex: 1, height: 4, borderRadius: 99, background: `linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(155,28,46,0.9) 100%)` }} />
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", fontWeight: 600 }}>More</span>
              </div>
            </div>

            {/* Name Search */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
                {selectedState ? `Search within ${ABBR_TO_NAME[selectedState] || selectedState}` : "Search by name"}
              </div>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
                <input
                  data-testid="input-employer-search"
                  value={query}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Type company name…"
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 10px 8px 30px", color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
                {searching && <Loader2 size={12} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", animation: "spin 1s linear infinite" }} />}
              </div>

              {/* Search dropdown */}
              {query.trim().length >= 2 && searchResults.length > 0 && (
                <div style={{ marginTop: 6, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {searchResults.map(emp => (
                    <button
                      key={emp.ein}
                      onClick={() => selectEmployer(emp)}
                      style={{ width: "100%", textAlign: "left", padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(155,28,46,0.1)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                    >
                      <Building2 size={11} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{emp.city}, {emp.state} · {(emp.participants || 0).toLocaleString()} lives</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Employer Card */}
            {selected && (
              <div style={{ background: "rgba(155,28,46,0.07)", border: "1px solid rgba(155,28,46,0.25)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: BB_CRIMSON, marginBottom: 6, letterSpacing: "0.10em", textTransform: "uppercase" }}>Selected Prospect</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{selected.name}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>{selected.city}, {selected.state} · EIN {selected.ein}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { label: "Covered Lives", val: (selected.participants || 0).toLocaleString(), icon: <Users size={10} /> },
                    { label: "Welfare Premiums", val: `$${((selected.welfare_premiums || 0) / 1000).toFixed(0)}K`, icon: <DollarSign size={10} /> },
                  ].map(m => (
                    <div key={m.label} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 7, padding: "7px 9px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>{m.icon}<span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase" }}>{m.label}</span></div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Run Button */}
            <button
              data-testid="btn-run-discovery"
              onClick={runDiscovery}
              disabled={!selected || running}
              style={{
                width: "100%", padding: "13px 20px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                letterSpacing: "0.05em", textTransform: "uppercase",
                background: running || !selected ? "rgba(155,28,46,0.25)" : `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1525 100%)`,
                color: running || !selected ? "rgba(255,255,255,0.4)" : "#fff",
                border: `1px solid ${running || !selected ? "rgba(155,28,46,0.2)" : BB_CRIMSON}`,
                cursor: running || !selected ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {running ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Discovering…</> : <><Zap size={14} /> Run Email Discovery</>}
            </button>

            {/* How it works */}
            <div style={{ background: "rgba(0,43,92,0.15)", border: "1px solid rgba(0,43,92,0.30)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(100,160,220,0.7)", marginBottom: 8 }}>How It Works</div>
              {[
                "Click a state → zoom + city filter appear",
                "Domain auto-discovered via Hunter.io",
                "Contacts ranked by HR/finance relevance",
                "Top emails individually verified",
                "Claude writes personalized outreach",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: i < 4 ? 6 : 0, alignItems: "flex-start" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(0,43,92,0.5)", border: "1px solid rgba(0,43,92,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 7, fontWeight: 900, color: "rgba(100,160,220,0.8)" }}>{i + 1}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── COL 2: State Zoom + City Chips + Prospect List ─────────── */}
          {selectedState && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Zoomed State Map */}
              <div style={{ background: "rgba(155,28,46,0.05)", border: `1px solid rgba(155,28,46,0.25)`, borderRadius: 16, padding: 16, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                      {ABBR_TO_NAME[selectedState] || selectedState}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                      <MapPin size={9} style={{ display: "inline", marginRight: 4 }} />
                      {(stateCounts[selectedState] || 0).toLocaleString()} plan sponsors
                    </div>
                  </div>
                  <span style={{ fontSize: 28, fontWeight: 900, color: BB_CRIMSON, opacity: 0.15, letterSpacing: "-0.04em" }}>{selectedState}</span>
                </div>

                {/* Zoomed state shape */}
                {stateGeo && (
                  <div style={{ borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: stateGeo.center, scale: stateGeo.scale }}
                      style={{ width: "100%", height: "auto" }}
                    >
                      <Geographies geography={GEO_URL}>
                        {({ geographies }) =>
                          geographies.map((geo) => {
                            const fips = geo.id as string;
                            const abbr = FIPS_TO_ABBR[fips] || "";
                            const isThis = abbr === selectedState;
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                style={{
                                  default: {
                                    fill: isThis ? BB_CRIMSON : "rgba(255,255,255,0.04)",
                                    stroke: isThis ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.06)",
                                    strokeWidth: isThis ? 0.8 : 0.3,
                                    outline: "none",
                                    filter: isThis ? "drop-shadow(0 0 8px rgba(155,28,46,0.6))" : "none",
                                  },
                                  hover: { fill: isThis ? BB_CRIMSON : "rgba(255,255,255,0.04)", outline: "none" },
                                  pressed: { outline: "none" },
                                }}
                              />
                            );
                          })
                        }
                      </Geographies>
                    </ComposableMap>
                  </div>
                )}
              </div>

              {/* City Filter Chips */}
              {cityCounts.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>
                    Filter by City
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {/* All chip */}
                    <button
                      data-testid="city-filter-all"
                      onClick={() => setSelectedCity(null)}
                      style={{
                        padding: "4px 12px", borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: "pointer",
                        background: !selectedCity ? `rgba(155,28,46,0.25)` : "rgba(255,255,255,0.05)",
                        border: !selectedCity ? `1px solid rgba(155,28,46,0.5)` : "1px solid rgba(255,255,255,0.1)",
                        color: !selectedCity ? "#fff" : "rgba(255,255,255,0.45)",
                      }}
                    >
                      All <span style={{ opacity: 0.6 }}>({stateProspects.length})</span>
                    </button>
                    {cityCounts.slice(0, 18).map(([city, count]) => {
                      const isActive = selectedCity === city;
                      return (
                        <button
                          key={city}
                          data-testid={`city-chip-${city.replace(/\s+/g, "-")}`}
                          onClick={() => setSelectedCity(isActive ? null : city)}
                          style={{
                            padding: "4px 12px", borderRadius: 99, fontSize: 10, fontWeight: 700, cursor: "pointer",
                            background: isActive ? `rgba(155,28,46,0.25)` : "rgba(255,255,255,0.05)",
                            border: isActive ? `1px solid rgba(155,28,46,0.5)` : "1px solid rgba(255,255,255,0.08)",
                            color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                            transition: "all 0.12s",
                          }}
                        >
                          {city} <span style={{ opacity: 0.55 }}>({count})</span>
                        </button>
                      );
                    })}
                    {cityCounts.length > 18 && (
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", padding: "5px 0", alignSelf: "center" }}>
                        +{cityCounts.length - 18} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Prospect List */}
              {(displayList.length > 0 || loadingState) && (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
                      {selectedCity ? `${selectedCity} Sponsors` : `${ABBR_TO_NAME[selectedState] || selectedState} Sponsors`}
                    </div>
                    {!loadingState && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{displayList.length}</span>}
                  </div>
                  {loadingState ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20, gap: 8 }}>
                      <Loader2 size={14} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Loading…</span>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 340, overflowY: "auto" }}>
                      {displayList.map(emp => (
                        <button
                          key={emp.ein}
                          data-testid={`prospect-${emp.ein}`}
                          onClick={() => selectEmployer(emp)}
                          style={{
                            width: "100%", textAlign: "left", padding: "10px 14px",
                            background: selected?.ein === emp.ein ? "rgba(155,28,46,0.12)" : "none",
                            border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                          }}
                          onMouseEnter={e => { if (selected?.ein !== emp.ein) e.currentTarget.style.background = "rgba(155,28,46,0.07)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = selected?.ein === emp.ein ? "rgba(155,28,46,0.12)" : "none"; }}
                        >
                          <Building2 size={12} color={selected?.ein === emp.ein ? BB_CRIMSON : "rgba(255,255,255,0.25)"} style={{ flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: selected?.ein === emp.ein ? "#fff" : "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>
                              {emp.city} · {(emp.participants || 0).toLocaleString()} lives
                              {emp.has_health && <span style={{ marginLeft: 5, padding: "1px 4px", borderRadius: 3, background: "rgba(16,185,129,0.15)", color: "#10b981", fontSize: 8 }}>Health</span>}
                              {emp.has_stop_loss && <span style={{ marginLeft: 3, padding: "1px 4px", borderRadius: 3, background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontSize: 8 }}>SL</span>}
                            </div>
                          </div>
                          {selected?.ein === emp.ein
                            ? <div style={{ width: 5, height: 5, borderRadius: "50%", background: BB_CRIMSON, flexShrink: 0 }} />
                            : <ChevronRight size={10} color="rgba(255,255,255,0.12)" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state for city filter */}
              {displayList.length === 0 && !loadingState && stateProspects.length > 0 && selectedCity && (
                <div style={{ textAlign: "center", padding: "24px 16px", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
                  No prospects in {selectedCity}. Try another city or "All".
                </div>
              )}

              {/* No state prospects yet (no loadingState, no search) */}
              {stateProspects.length === 0 && !loadingState && !query.trim() && (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
                  No Form 5500 data found for this state.
                </div>
              )}
            </div>
          )}

          {/* ── COL 3 (or COL 2 when no state): Discovery Results ──────── */}
          <div>
            {!selectedState && !result && !running && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 480, textAlign: "center" }}>
                <MapPin size={36} color="rgba(255,255,255,0.1)" style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Click a state to begin</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", maxWidth: 260 }}>The state zooms in on the map and cities appear for filtering</div>
              </div>
            )}

            {selectedState && !result && !running && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 480, textAlign: "center", opacity: 0.5 }}>
                <MailOpen size={44} color="rgba(255,255,255,0.2)" style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                  {selected ? "Ready to discover" : "Select a sponsor"}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                  {selected ? `Click Run Email Discovery for ${selected.name}` : "Pick a plan sponsor from the city list"}
                </div>
              </div>
            )}

            {running && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 480, gap: 16 }}>
                <Loader2 size={36} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Running discovery pipeline…</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", maxWidth: 280, textAlign: "center" }}>Querying Hunter.io, verifying emails, generating AI outreach draft</div>
              </div>
            )}

            {result && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Section 1 — Identified Contact */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <SectionHeader n={1} label="Identified Contact" />
                  {result.best_contact ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${BB_CRIMSON}, #7a1525)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>
                          {(result.best_contact.first_name?.[0] || "") + (result.best_contact.last_name?.[0] || "") || "?"}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                          {result.best_contact.first_name} {result.best_contact.last_name}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", marginBottom: 8 }}>
                          {result.best_contact.position || "—"} · {result.employer.name}
                        </div>
                        <div style={{ fontSize: 13, color: "#60a5fa", fontWeight: 600 }}>{result.best_contact.email}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Star size={13} color="#f59e0b" style={{ marginBottom: 4 }} />
                        <div style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>Best Match</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No verified contact found — outreach draft still generated below.</div>
                  )}
                </div>

                {/* Section 2 — Company Domain */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <SectionHeader n={2} label="Company Domain" />
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Globe size={20} color="rgba(255,255,255,0.4)" />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{result.employer.domain}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                        {result.hunter_meta.total_emails_found} email{result.hunter_meta.total_emails_found !== 1 ? "s" : ""} found · {result.hunter_meta.organization || result.employer.name}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3 — Candidate Emails */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <SectionHeader n={3} label="Candidate Emails" />
                  {result.candidates.length === 0 ? (
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No email addresses found for this domain.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {result.candidates.map((c, i) => (
                        <div key={i} data-testid={`candidate-email-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: BB_CRIMSON, minWidth: 18 }}>#{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{c.email}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                              {c.first_name} {c.last_name}{c.position ? ` · ${c.position}` : ""} · {c.sources} source{c.sources !== 1 ? "s" : ""}
                            </div>
                          </div>
                          <div>
                            <ConfidenceBar score={c.confidence} />
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "right", marginTop: 2 }}>Hunter confidence</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 4 — Verification Results */}
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <SectionHeader n={4} label="Verification Results" />
                  {result.verified.length === 0 ? (
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No emails were verified.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {result.verified.map((v, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{v.email}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                              {v.mx_records ? "MX records valid" : "No MX records"} · {v.disposable ? "⚠ Disposable" : "Not disposable"}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <VerificationBadge result={v.result} />
                            <ConfidenceBar score={v.score} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 5 — Recommended Primary Email */}
                {result.best_contact && (
                  <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 16, padding: 20 }}>
                    <SectionHeader n={5} label="Recommended Primary Email" color="#10b981" />
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <Shield size={22} color="#10b981" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#10b981", letterSpacing: "-0.01em" }}>{result.best_contact.email}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 2 }}>Selected based on verification status and role relevance</div>
                      </div>
                      <button
                        data-testid="btn-copy-email"
                        onClick={() => copyText(result.best_contact!.email, () => {})}
                        style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  </div>
                )}

                {/* Section 6 — Outreach Draft */}
                {result.outreach?.email_body && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                    <SectionHeader n={6} label="AI-Generated Outreach Draft" />
                    {result.outreach.subject_lines?.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Suggested Subject Lines</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {result.outreach.subject_lines.map((sl, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                              <div style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.75)", fontStyle: "italic" }}>"{sl}"</div>
                              <button
                                data-testid={`btn-copy-subject-${i}`}
                                onClick={() => { copyText(sl, () => setCopiedSubject(i)); setTimeout(() => setCopiedSubject(null), 2000); }}
                                style={{ padding: "4px 10px", borderRadius: 6, background: copiedSubject === i ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: copiedSubject === i ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.10)", color: copiedSubject === i ? "#10b981" : "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                              >
                                <Copy size={10} /> {copiedSubject === i ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Email Body</div>
                      <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.06)", position: "relative" }}>
                        <pre style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "inherit", lineHeight: 1.7 }}>
                          {result.outreach.email_body}
                        </pre>
                        <button
                          data-testid="btn-copy-body"
                          onClick={() => { copyText(result!.outreach.email_body, () => setCopiedBody(true)); setTimeout(() => setCopiedBody(false), 2000); }}
                          style={{ position: "absolute", top: 12, right: 12, padding: "5px 10px", borderRadius: 7, background: copiedBody ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: copiedBody ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.1)", color: copiedBody ? "#10b981" : "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                        >
                          <Copy size={10} /> {copiedBody ? "Copied!" : "Copy Email"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </Layout>
  );
}

function SectionHeader({ n, label, color = "rgba(255,255,255,0.55)" }: { n: number; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(155,28,46,0.2)", border: "1px solid rgba(155,28,46,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 900, color: BB_CRIMSON }}>{n}</span>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color }}>{label}</span>
    </div>
  );
}
