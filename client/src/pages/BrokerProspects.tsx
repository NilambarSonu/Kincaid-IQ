import { useState, useEffect, useRef } from "react";
import { useCompanyHandoff } from "@/hooks/use-company-handoff";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { apiRequest } from "@/lib/queryClient";
import {
  Search, Shield, Briefcase, ChevronRight, X, Download,
  Target, MapPin, TrendingUp, Zap, Activity, Pill,
  ArrowRight, RefreshCw, Star, AlertTriangle, LayoutGrid, List,
  CheckCircle2, Map as MapIcon, Plus, Save, Bookmark, Edit3, Trash2,
  FileText, Users, Clock, DollarSign, Building2, ExternalLink, UserX,
  BarChart2,
} from "lucide-react";
import { DoctrineBar } from "@/components/Doctrine";
import { ShareMenu } from "@/components/ShareMenu";
import { useManifestDownload } from "@/hooks/use-manifest-download";
import { useDivergenceWatch } from "@/hooks/use-divergence-watch";
import {
  risingAtRankMetrics,
  type DivergenceWatchEntry,
  type DivergenceThresholds,
} from "@/lib/divergence";

/* ─── PALETTE ────────────────────────────────────────────────────────────── */
const GOLD   = "#FFB800";
const BLUE   = "#00D4FF";
const GREEN  = "#00FF94";
const RED    = "#FF4D6D";
const ORANGE = "#FF6B1A";
const PURPLE = "#A855F7";

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
interface EdgarData {
  is_public: boolean;
  ticker?: string;
  cik?: string;
  legal_name?: string;
  trigger_type?: string;
  trigger_label?: string;
  trigger_date?: string;
}
interface Prospect {
  sponsor_name: string; city: string; state: string; ein: string; industry: string;
  naics_code: string; participants: number; form_year: number;
  metro_region: string; metro_label: string; welfare_codes: string;
  carriers: string[]; has_stop_loss: boolean; match_score: number;
  score_breakdown: Record<string, number>;
  fit_flags: string[]; opening_angle: string;
  why_this_account: string[]; est_commission: number;
  broker_comm_actual: number;
  edgar: EdgarData;
}
interface MetroPoint { key: string; label: string; count: number; avg_score: number; map_x: number; map_y: number }
interface ProspectsData {
  prospects: Prospect[]; profile: Record<string, any>;
  total_found: number; metro_distribution: MetroPoint[];
  summary: { shown: number; total_opportunity: number; stop_loss_gaps: number; rx_opportunities: number; avg_match_score: number };
}
interface QuizAnswers {
  sizes: string[]; metros: string[]; industries: string[];
  serviceWedge: string; salesMotion: string;
}
interface OverviewData {
  total_prospects: number; recommended: number;
  renewal_window_targets: number; rx_targets: number; sl_targets: number;
  ticker_phrases: string[];
}
interface SavedList {
  id: number; name: string; itemCount: number; createdAt: string;
  items: SavedListItem[];
}
interface SavedListItem {
  id: number; sponsorName: string; city: string; industry: string;
  participants: number; metroLabel: string; ein: string;
  matchScore: number; estCommission: number;
  notes: string; priority: string; addedAt: string;
}
interface BookAnalysis {
  industryDistribution: { name: string; value: number; pct: number }[];
  sizeDistribution: { band: string; count: number }[];
  renewalDistribution: { month: string; count: number }[];
  planTypeBreakdown: { type: string; count: number }[];
  insights: { type: string; text: string }[];
  avgEmployees: number; totalClients: number;
  profile: Record<string, any>;
}

/* ─── QUIZ CONFIG ────────────────────────────────────────────────────────── */
const SIZE_OPTIONS = [
  { key: "small",      label: "Small",      sub: "50–199 employees",    min: 50,   max: 199  },
  { key: "midmarket",  label: "Mid-Market", sub: "200–499 employees",   min: 200,  max: 499  },
  { key: "large",      label: "Large",      sub: "500–999 employees",   min: 500,  max: 999  },
  { key: "enterprise", label: "Enterprise", sub: "1,000+ employees",     min: 1000, max: 9999 },
];

const METRO_OPTIONS = [
  { key: "nashville",    label: "Nashville Metro",         sub: "Middle TN hub" },
  { key: "memphis",      label: "Memphis",                 sub: "West Tennessee" },
  { key: "knoxville",    label: "Knoxville",               sub: "East Tennessee" },
  { key: "chattanooga",  label: "Chattanooga",             sub: "SE Tennessee" },
  { key: "tricities",    label: "Tri-Cities",              sub: "NE Tennessee" },
  { key: "clarksville",  label: "Clarksville",             sub: "NW Tennessee" },
  { key: "jackson",      label: "Jackson",                 sub: "W-Central Tennessee" },
  { key: "murfreesboro", label: "Murfreesboro / Franklin", sub: "Rutherford County" },
  { key: "any",          label: "All Tennessee",           sub: "No geography preference" },
];

const INDUSTRY_OPTIONS = [
  { key: "healthcare",     label: "Healthcare / Medical",       naics: ["62"] },
  { key: "manufacturing",  label: "Manufacturing",              naics: ["31","32","33"] },
  { key: "education",      label: "Education / Schools",        naics: ["61"] },
  { key: "professional",   label: "Professional Services",      naics: ["54","55","56"] },
  { key: "construction",   label: "Construction / Trades",      naics: ["23"] },
  { key: "transportation", label: "Logistics / Transportation", naics: ["48","49"] },
  { key: "finance",        label: "Finance / Banking",          naics: ["52"] },
  { key: "retail",         label: "Retail / Auto",              naics: ["44","45"] },
  { key: "nonprofit",      label: "Nonprofit / Civic",          naics: ["81"] },
];

const SERVICE_OPTIONS = [
  { key: "rx",          label: "Rx Savings Lead",         sub: "PBM audit, spread pricing, rebate intelligence", icon: Pill },
  { key: "stoploss",    label: "Stop-Loss Lead",           sub: "Aggregate risk, carrier protection, laser analysis", icon: Shield },
  { key: "fullrenewal", label: "Full Renewal Partner",     sub: "End-to-end fiduciary stewardship across all products", icon: Briefcase },
  { key: "plandesign",  label: "Plan Design Optimization", sub: "Benchmarking, self-funded migration, plan architecture", icon: Target },
];

const US_STATES = [
  { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" }, { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" }, { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" }, { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" }, { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" }, { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" }, { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" }, { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" }, { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" }, { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" }, { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" }, { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" }, { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" }, { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" }, { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" }, { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" }, { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" }, { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" }, { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" }, { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" }, { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" }, { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" }, { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" }, { abbr: "WY", name: "Wyoming" },
];

const STATE_CITIES: Record<string, string[]> = {
  AL: ["Birmingham","Montgomery","Huntsville","Mobile","Tuscaloosa"],
  AK: ["Anchorage","Fairbanks","Juneau"],
  AZ: ["Phoenix","Tucson","Mesa","Chandler","Scottsdale","Tempe"],
  AR: ["Little Rock","Fort Smith","Fayetteville","Springdale","Jonesboro"],
  CA: ["Los Angeles","San Diego","San Jose","San Francisco","Sacramento","Oakland","Fresno","Long Beach"],
  CO: ["Denver","Colorado Springs","Aurora","Fort Collins","Lakewood","Boulder"],
  CT: ["Bridgeport","New Haven","Hartford","Stamford","Waterbury"],
  DE: ["Wilmington","Dover","Newark"],
  FL: ["Jacksonville","Miami","Tampa","Orlando","St. Petersburg","Hialeah","Fort Lauderdale"],
  GA: ["Atlanta","Columbus","Savannah","Augusta","Athens","Macon"],
  HI: ["Honolulu","Pearl City","Hilo","Kailua"],
  ID: ["Boise","Meridian","Nampa","Idaho Falls","Pocatello"],
  IL: ["Chicago","Aurora","Naperville","Joliet","Rockford","Springfield","Peoria","Elgin"],
  IA: ["Des Moines","Cedar Rapids","Davenport","Sioux City","Iowa City","Waterloo"],
  KS: ["Wichita","Overland Park","Kansas City","Topeka","Olathe"],
  KY: ["Louisville","Lexington","Bowling Green","Owensboro","Covington"],
  LA: ["New Orleans","Baton Rouge","Shreveport","Metairie","Lafayette"],
  ME: ["Portland","Augusta","Bangor","Lewiston"],
  MD: ["Baltimore","Frederick","Rockville","Gaithersburg","Annapolis"],
  MA: ["Boston","Worcester","Springfield","Lowell","Cambridge","Brockton"],
  MI: ["Detroit","Grand Rapids","Warren","Sterling Heights","Lansing","Ann Arbor","Flint"],
  MN: ["Minneapolis","Saint Paul","Rochester","Duluth","Bloomington","Plymouth"],
  MS: ["Jackson","Gulfport","Southaven","Hattiesburg","Biloxi"],
  MO: ["Kansas City","Saint Louis","Springfield","Columbia","Independence"],
  MT: ["Billings","Missoula","Great Falls","Bozeman","Helena"],
  NE: ["Omaha","Lincoln","Bellevue","Grand Island","Kearney"],
  NV: ["Las Vegas","Henderson","Reno","North Las Vegas","Sparks"],
  NH: ["Manchester","Nashua","Concord","Derry","Dover"],
  NJ: ["Newark","Jersey City","Paterson","Elizabeth","Edison","Trenton"],
  NM: ["Albuquerque","Las Cruces","Rio Rancho","Santa Fe","Roswell"],
  NY: ["New York","Buffalo","Rochester","Yonkers","Syracuse","Albany","Schenectady"],
  NC: ["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem","Fayetteville"],
  ND: ["Fargo","Bismarck","Grand Forks","Minot"],
  OH: ["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton"],
  OK: ["Oklahoma City","Tulsa","Norman","Broken Arrow","Lawton"],
  OR: ["Portland","Salem","Eugene","Gresham","Hillsboro"],
  PA: ["Philadelphia","Pittsburgh","Allentown","Erie","Reading","Scranton"],
  RI: ["Providence","Cranston","Warwick","Pawtucket"],
  SC: ["Columbia","Charleston","North Charleston","Greenville","Rock Hill"],
  SD: ["Sioux Falls","Rapid City","Aberdeen","Brookings"],
  TN: ["Nashville","Memphis","Knoxville","Chattanooga","Clarksville","Murfreesboro"],
  TX: ["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Plano"],
  UT: ["Salt Lake City","West Valley City","Provo","West Jordan","Orem","Sandy"],
  VT: ["Burlington","Essex","South Burlington","Montpelier"],
  VA: ["Virginia Beach","Norfolk","Chesapeake","Richmond","Newport News","Alexandria"],
  WA: ["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Kirkland"],
  WV: ["Charleston","Huntington","Morgantown","Parkersburg","Wheeling"],
  WI: ["Milwaukee","Madison","Green Bay","Kenosha","Racine","Appleton"],
  WY: ["Cheyenne","Casper","Laramie","Gillette"],
};

const MOTION_OPTIONS = [
  { key: "quickwins",   label: "Quick Wins",        sub: "Accounts actively in renewal within 90 days", icon: Zap },
  { key: "strategic",   label: "Strategic Pipeline", sub: "180+ day relationship build — longer sale cycle", icon: TrendingUp },
  { key: "disruption",  label: "Disruption Play",    sub: "Pull from large national carrier with cost evidence", icon: AlertTriangle },
  { key: "turnaround",  label: "Turnaround",         sub: "Fix troubled, high-cost, high-risk accounts", icon: Activity },
];

/* ─── FLAG CONFIG ────────────────────────────────────────────────────────── */
const FLAG_CFG: Record<string, { label: string; color: string; icon: typeof Pill }> = {
  stop_loss_gap:        { label: "Stop-Loss Gap",      color: ORANGE, icon: Activity },
  rx_opportunity:       { label: "Rx Opportunity",     color: PURPLE, icon: Pill     },
  high_value_strategic: { label: "High-Value",         color: GOLD,   icon: Star     },
  disruption_target:    { label: "Disruption Target",  color: BLUE,   icon: Target   },
  likely_fast_close:    { label: "Fast-Close Signal",  color: GREEN,  icon: Zap      },
  full_renewal_support: { label: "Full Renewal",       color: "#aaa", icon: Briefcase },
};

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function fmtMoney(n: number) { return n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${Math.round(n/1000)}K`; }
const scoreColor = (s: number) => s >= 85 ? GREEN : s >= 70 ? GOLD : s >= 55 ? ORANGE : RED;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
      background: active ? `${GOLD}18` : "rgba(255,255,255,0.04)",
      border: active ? `1px solid ${GOLD}45` : "1px solid rgba(255,255,255,0.09)",
      color: active ? GOLD : "rgba(255,255,255,0.5)", transition: "all 0.12s",
    }}>{children}</button>
  );
}


/* ─── TENNESSEE MAP ──────────────────────────────────────────────────────── */
function TnMapView({ metros, onSelect, selectedMetro }: {
  metros: MetroPoint[]; onSelect: (key: string) => void; selectedMetro: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const maxCount = Math.max(...metros.map(m => m.count), 1);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <MapIcon style={{ width: 14, height: 14, color: GOLD }} />
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
          Tennessee Market Intelligence Map
        </span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>Click a market to filter</span>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 360 440" width={280} height={340} style={{ display: "block" }}>
            <rect x={28} y={28} width={290} height={2} fill="rgba(255,255,255,0.08)" />
            <rect x={28} y={28} width={2} height={388} fill="rgba(255,255,255,0.08)" />
            <rect x={318} y={28} width={2} height={388} fill="rgba(255,255,255,0.08)" />
            <rect x={28} y={416} width={292} height={2} fill="rgba(255,255,255,0.08)" />
            <rect x={30} y={30} width={288} height={385} rx={4} fill="rgba(255,255,255,0.015)" />
            <text x={174} y={224} textAnchor="middle" fill="rgba(255,255,255,0.04)" fontSize={28} fontWeight={900} letterSpacing="0.2em">TENNESSEE</text>
            {[100, 180, 260, 340].map(y => <line key={y} x1={30} y1={y} x2={318} y2={y} stroke="rgba(255,255,255,0.03)" />)}
            {[100, 180, 260].map(x => <line key={x} x1={x} y1={30} x2={x} y2={415} stroke="rgba(255,255,255,0.03)" />)}
            {metros.map(m => {
              const r = 10 + (m.count / maxCount) * 26;
              const isSelected = selectedMetro === m.key;
              const isHovered  = hovered === m.key;
              const col = scoreColor(m.avg_score);
              return (
                <g key={m.key} onClick={() => onSelect(m.key)} onMouseEnter={() => setHovered(m.key)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                  {(isSelected || isHovered) && (
                    <circle cx={m.map_x} cy={m.map_y} r={r + 8} fill="none" stroke={col} strokeWidth={1.5} opacity={0.4} />
                  )}
                  <circle cx={m.map_x} cy={m.map_y} r={r} fill={`${col}22`} stroke={col} strokeWidth={isSelected ? 2.5 : 1} opacity={isSelected || isHovered ? 1 : 0.75} />
                  <text x={m.map_x} y={m.map_y + 1} textAnchor="middle" dominantBaseline="middle" fill={col} fontSize={r > 20 ? 12 : 9} fontWeight={900}>{m.count}</text>
                  {(isSelected || isHovered) && (
                    <text x={m.map_x} y={m.map_y + r + 12} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>{m.label}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>
            Ranked Markets
          </div>
          {metros.slice(0, 9).map(m => {
            const col = scoreColor(m.avg_score);
            const isSelected = selectedMetro === m.key;
            return (
              <button key={m.key} onClick={() => onSelect(m.key)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                  background: isSelected ? `${col}12` : "rgba(255,255,255,0.02)", border: isSelected ? `1px solid ${col}30` : "1px solid transparent",
                  textAlign: "left" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? col : "rgba(255,255,255,0.7)" }}>{m.label}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: col }}>{m.count}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>avg {m.avg_score}</div>
              </button>
            );
          })}
          {selectedMetro && (
            <button onClick={() => onSelect("")}
              style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
              ✕ Clear filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── SAVE TO LIST DROPDOWN ─────────────────────────────────────────────── */
function SaveToListDropdown({ prospect, onClose }: { prospect: Prospect; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: lists = [] } = useQuery<SavedList[]>({ queryKey: ["/api/saas/broker/lists"] });
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);

  const createListMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/saas/broker/lists", { name });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/saas/broker/lists"] }); setNewListName(""); setCreating(false); },
  });

  const addItemMut = useMutation({
    mutationFn: async (listId: number) => {
      const res = await apiRequest("POST", `/api/saas/broker/lists/${listId}/items`, {
        prospectEin: prospect.ein,
        sponsorName: prospect.sponsor_name,
        city: prospect.city,
        industry: prospect.industry,
        participants: prospect.participants,
        metroLabel: prospect.metro_label,
        matchScore: prospect.match_score,
        notes: "",
        priority: "medium",
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/saas/broker/lists"] }); onClose(); },
  });

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: "absolute", top: "100%", right: 0, zIndex: 50, marginTop: 4,
      background: "#0a0a14", border: `1px solid ${GOLD}30`, borderRadius: 12,
      padding: 8, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    }}>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", padding: "4px 8px", marginBottom: 4 }}>
        Save to List
      </div>
      {lists.map(l => (
        <button key={l.id} onClick={() => addItemMut.mutate(l.id)} data-testid={`save-to-list-${l.id}`}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8,
            background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "rgba(255,255,255,0.7)", fontSize: 12 }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          onMouseLeave={e => (e.currentTarget.style.background = "none")}>
          <Bookmark style={{ width: 12, height: 12, color: GOLD }} />
          <span style={{ flex: 1 }}>{l.name}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{l.itemCount}</span>
        </button>
      ))}
      {creating ? (
        <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
          <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="List name..."
            data-testid="new-list-name-input"
            style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6,
              padding: "6px 8px", color: "#fff", fontSize: 11, outline: "none" }}
            onKeyDown={e => { if (e.key === "Enter" && newListName.trim()) createListMut.mutate(newListName.trim()); }} />
          <button onClick={() => newListName.trim() && createListMut.mutate(newListName.trim())} data-testid="create-list-confirm"
            style={{ padding: "6px 10px", borderRadius: 6, background: `${GOLD}20`, border: `1px solid ${GOLD}40`, color: GOLD, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Add
          </button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} data-testid="create-new-list-btn"
          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 10px", borderRadius: 8,
            background: "none", border: "none", cursor: "pointer", textAlign: "left", color: GOLD, fontSize: 11, fontWeight: 700 }}>
          <Plus style={{ width: 12, height: 12 }} /> New List
        </button>
      )}
    </div>
  );
}

/* ─── PROSPECT CARD ──────────────────────────────────────────────────────── */
// "Fees rising at rank" flag for prospect/saved-list rows. Reuses the SAME
// divergence-watch payload + thresholds as Benefits Benchmarking (no duplicated
// thresholds). Clicking deep-links into Benefits Benchmarking on that EIN,
// scrolled to the triggering gauge.
function RisingAtRankFlag({
  ein, company, entry, thresholds, compact = false, testId,
}: {
  ein: string;
  company: string;
  entry: DivergenceWatchEntry | undefined;
  thresholds: DivergenceThresholds;
  compact?: boolean;
  testId: string;
}) {
  const { sendTo } = useCompanyHandoff();
  const hits = risingAtRankMetrics(entry, thresholds);
  if (!ein || hits.length === 0) return null;
  const open = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    sendTo("benchmarking", ein, company, { gauge: hits[0].gaugeKey });
  };
  return (
    <span
      role="button"
      tabIndex={0}
      data-testid={testId}
      onClick={open}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); } }}
      title={`Fees rising at rank on ${hits.map(h => h.label).join(", ")} — dollars climbed while the percentile stayed flat (peers absorbed the move). Click to open the gauge.`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0, cursor: "pointer",
        fontSize: compact ? 8 : 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em",
        color: RED, background: `${RED}12`, border: `1px solid ${RED}40`, borderRadius: 5,
        padding: compact ? "2px 5px" : "3px 7px",
      }}
    >
      <AlertTriangle style={{ width: compact ? 9 : 10, height: compact ? 9 : 10 }} />
      Fees rising at rank{hits.length > 1 ? ` ·${hits.length}` : ""}
    </span>
  );
}

function ProspectCard({ p, onSelect, index, divergenceWatch, thresholds }: {
  p: Prospect; onSelect: () => void; index: number;
  divergenceWatch: Record<string, DivergenceWatchEntry>; thresholds: DivergenceThresholds;
}) {
  const sc = scoreColor(p.match_score);
  const [showSave, setShowSave] = useState(false);
  const { sendTo } = useCompanyHandoff();

  return (
    <div style={{ position: "relative" }}>
      <button onClick={onSelect} data-testid={`prospect-card-${index}`}
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
          padding: "18px 20px", textAlign: "left", cursor: "pointer", transition: "all 0.12s", width: "100%",
          display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${sc}30`; e.currentTarget.style.background = `${sc}06`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>

        <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%",
          background: `radial-gradient(circle, ${sc}12 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 3, lineHeight: 1.3 }}>{p.sponsor_name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
              <MapPin style={{ width: 10, height: 10 }} />{p.city} · {p.metro_label}
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: sc, lineHeight: 1 }}>{p.match_score}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>fit score</div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
          {p.participants?.toLocaleString()} participants · {p.industry} · {p.form_year} filing
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <RisingAtRankFlag
            ein={p.ein}
            company={p.sponsor_name}
            entry={divergenceWatch[p.ein]}
            thresholds={thresholds}
            testId={`divergence-flag-prospect-${index}`}
          />
          {p.fit_flags.slice(0, 3).map(flag => {
            const cfg = FLAG_CFG[flag];
            if (!cfg) return null;
            return (
              <span key={flag} style={{ fontSize: 8, fontWeight: 900, color: cfg.color, background: `${cfg.color}10`,
                border: `1px solid ${cfg.color}25`, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {cfg.label}
              </span>
            );
          })}
          {p.edgar?.is_public && (
            <span style={{ fontSize: 8, fontWeight: 900, color: GOLD, background: `${GOLD}10`,
              border: `1px solid ${GOLD}30`, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              📈 {p.edgar.ticker || "PUBLIC"}
            </span>
          )}
          {p.edgar?.trigger_type && p.edgar.trigger_type !== "filing" && (() => {
            const triggerColors: Record<string, string> = {
              acquisition: "#FF4444", ma: "#FF6B1A", leadership: "#A855F7",
              restructuring: "#EF4444", debt: "#F59E0B", financial: "#3B82F6", other: "#6B7280",
            };
            const col = triggerColors[p.edgar.trigger_type] || "#6B7280";
            return (
              <span style={{ fontSize: 8, fontWeight: 900, color: col, background: `${col}15`,
                border: `1px solid ${col}35`, borderRadius: 4, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                🔥 {p.edgar.trigger_label}
              </span>
            );
          })()}
        </div>

        {p.why_this_account[0] && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
            {p.why_this_account[0].slice(0, 110)}{p.why_this_account[0].length > 110 ? "…" : ""}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 900, color: GREEN }}>~${p.est_commission?.toLocaleString()}</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: 4 }}>est. commission</span>
          </div>
          <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.25)" }} />
        </div>
      </button>
      <button onClick={e => { e.stopPropagation(); setShowSave(!showSave); }} data-testid={`save-prospect-${index}`}
        style={{ position: "absolute", top: 10, right: 10, zIndex: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${GOLD}30`,
          borderRadius: 6, padding: "4px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: GOLD, fontSize: 9, fontWeight: 700 }}>
        <Bookmark style={{ width: 10, height: 10 }} /> Save
      </button>
      {p.ein && p.edgar?.is_public && (
        <button
          onClick={e => { e.stopPropagation(); window.location.assign(`/commit-engine?ein=${p.ein}&name=${encodeURIComponent(p.sponsor_name)}`); }}
          data-testid={`run-commit-${index}`}
          style={{ position: "absolute", bottom: 10, right: 10, zIndex: 10, background: "rgba(79,125,255,0.15)", border: "1px solid rgba(79,125,255,0.4)",
            borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#4f7dff", fontSize: 9, fontWeight: 800 }}>
          ⚡ Run CommitEngine™
        </button>
      )}
      {/* Cross-app handoff buttons */}
      {p.ein && (
        <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 10, display: "flex", gap: 4 }}>
          <button
            onClick={e => { e.stopPropagation(); sendTo("benchmarking", p.ein, p.sponsor_name); }}
            data-testid={`send-to-benchmarking-${index}`}
            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: 6,
              padding: "4px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, color: "#60a5fa", fontSize: 9, fontWeight: 800 }}>
            📊 Benchmark
          </button>
          <button
            onClick={e => { e.stopPropagation(); sendTo("war-room", p.ein, p.sponsor_name); }}
            data-testid={`send-to-war-room-${index}`}
            style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.35)", borderRadius: 6,
              padding: "4px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, color: "#f5a623", fontSize: 9, fontWeight: 800 }}>
            🎯 War Room
          </button>
          <button
            onClick={e => { e.stopPropagation(); sendTo("rx-defense", p.ein, p.sponsor_name); }}
            data-testid={`send-to-rx-defense-${index}`}
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.28)", borderRadius: 6,
              padding: "4px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, color: "#10b981", fontSize: 9, fontWeight: 800 }}>
            💊 Rx Defense
          </button>
        </div>
      )}
      {showSave && <SaveToListDropdown prospect={p} onClose={() => setShowSave(false)} />}
    </div>
  );
}

/* ─── PROSPECT DRAWER ────────────────────────────────────────────────────── */
function ProspectDrawer({ p, onClose }: { p: Prospect; onClose: () => void }) {
  const sc = scoreColor(p.match_score);
  const [showSave, setShowSave] = useState(false);
  const { sendTo } = useCompanyHandoff();
  const { downloadWithManifest } = useManifestDownload();
  const FACTOR_LABELS: Record<string, string> = {
    size_match: "Size Match (25%)", industry_match: "Industry Match (20%)",
    geography: "Geography (15%)", renewal_timing: "Renewal Timing (15%)",
    service_fit: "Service Fit (15%)", whitespace: "Whitespace (10%)",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }} />
      <div onClick={e => e.stopPropagation()}
        style={{ position: "relative", width: 520, maxWidth: "95vw", height: "100vh", background: "#060610",
          borderLeft: `1px solid ${sc}25`, overflowY: "auto", boxShadow: `-20px 0 60px rgba(0,0,0,0.8)` }}>

        <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0,
          background: "#060610", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{p.sponsor_name}</div>
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin style={{ width: 10, height: 10 }} />{p.city}, {p.state || "TN"}</span>
                <span>·</span>
                <span>{p.metro_label}</span>
                <span>·</span>
                <span>{p.form_year} filing</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: sc, lineHeight: 1 }}>{p.match_score}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Fit Score</div>
              </div>
              <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "8px", cursor: "pointer" }}>
                <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.5)" }} />
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {p.fit_flags.map(flag => {
              const cfg = FLAG_CFG[flag];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <span key={flag} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 900,
                  color: cfg.color, background: `${cfg.color}12`, border: `1px solid ${cfg.color}25`,
                  borderRadius: 4, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <Icon style={{ width: 9, height: 9 }} />{cfg.label}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 24 }}>

          {p.edgar?.is_public && (
            <div style={{ background: p.edgar.trigger_type && p.edgar.trigger_type !== "filing" ? "rgba(255,68,68,0.06)" : `${GOLD}08`,
              border: `1px solid ${p.edgar.trigger_type && p.edgar.trigger_type !== "filing" ? "rgba(255,68,68,0.25)" : GOLD + "25"}`,
              borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>SEC EDGAR Intelligence</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
                    {p.edgar.legal_name || p.sponsor_name}
                    {p.edgar.ticker && <span style={{ marginLeft: 8, fontSize: 11, color: GOLD }}>({p.edgar.ticker})</span>}
                  </div>
                </div>
                {p.edgar.ticker && (
                  <a href={`https://finance.yahoo.com/quote/${p.edgar.ticker}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 9, fontWeight: 800, color: GOLD, background: `${GOLD}15`, border: `1px solid ${GOLD}30`,
                      borderRadius: 5, padding: "3px 8px", textDecoration: "none" }}>
                    View on Yahoo ↗
                  </a>
                )}
              </div>
              {p.edgar.trigger_type && p.edgar.trigger_type !== "filing" ? (
                <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", color: "#FF4444", marginBottom: 4 }}>
                    🔥 Active Trigger Event
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{p.edgar.trigger_label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Filed: {p.edgar.trigger_date}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 6, lineHeight: 1.5 }}>
                    {p.edgar.trigger_type === "acquisition" && "M&A events disrupt benefits programs — plan consolidation, carrier review, and broker displacement happen within 90 days of close."}
                    {p.edgar.trigger_type === "ma" && "A material agreement event signals business change — perfect timing for a fiduciary benefits review conversation."}
                    {p.edgar.trigger_type === "leadership" && "New executives audit vendor relationships, including benefits. This is a prime window to introduce yourself as the fiduciary alternative."}
                    {p.edgar.trigger_type === "restructuring" && "Workforce changes create immediate benefits exposure — stop-loss adequacy, Rx cost management, and plan design all need review."}
                    {p.edgar.trigger_type === "debt" && "New financial obligations signal budget pressure — a cost-optimization benefits pitch is well-timed."}
                    {p.edgar.trigger_type === "financial" && "Recent earnings release means CFO attention is on costs — benefits is typically 30-40% of total compensation expense."}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Publicly traded · No material trigger events in the last 180 days</div>
              )}
            </div>
          )}

          <div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>Account Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Industry",     value: p.industry },
                { label: "Participants", value: (p.participants || 0).toLocaleString() },
                { label: "Metro",        value: p.metro_label },
                { label: "NAICS Code",   value: p.naics_code },
                { label: "Est. Commission", value: `~$${p.est_commission?.toLocaleString()}` },
                { label: "Filing Year",  value: String(p.form_year) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>6-Factor Fit Score Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(p.score_breakdown || {}).map(([key, val]) => {
                const col = scoreColor(val);
                return (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{FACTOR_LABELS[key] || key}</span>
                      <span style={{ fontSize: 11, fontWeight: 900, color: col }}>{val}</span>
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${val}%`, height: "100%", background: col, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GREEN, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 style={{ width: 11, height: 11 }} /> Why This Account
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {p.why_this_account.map((reason, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", background: "rgba(0,255,148,0.04)", border: "1px solid rgba(0,255,148,0.1)", borderLeft: `3px solid ${GREEN}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: GREEN, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Target style={{ width: 11, height: 11 }} /> Suggested Opening Angle
            </div>
            <div style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderLeft: `3px solid ${GOLD}`, borderRadius: 12, padding: "16px 20px",
              fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
              {p.opening_angle}
            </div>
          </div>

          <div style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: BLUE, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <UserX style={{ width: 11, height: 11 }} /> Incumbent Intelligence
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {p.carriers.length > 0 && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Building2 style={{ width: 13, height: 13, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Incumbent Carrier(s)</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.carriers.map(c => (
                        <span key={c} style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}25`, borderRadius: 6, padding: "3px 9px" }}>{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <DollarSign style={{ width: 13, height: 13, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Incumbent Broker Revenue</div>
                  {p.broker_comm_actual > 0 ? (
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 900, color: ORANGE }}>${p.broker_comm_actual.toLocaleString()}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>reported · Form 5500 Sch A</span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 900, color: GOLD }}>~${p.est_commission.toLocaleString()}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginLeft: 6 }}>estimated · {p.participants.toLocaleString()} lives × avg rate</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <FileText style={{ width: 13, height: 13, color: "rgba(255,255,255,0.25)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.5, marginBottom: 6 }}>
                    Broker identity is disclosed in <strong style={{ color: "rgba(255,255,255,0.6)" }}>Form 5500 Schedule C</strong> — the service provider filing. Look up this employer's full filing to find the incumbent broker's firm name and total compensation.
                  </div>
                  <a
                    href={`https://efts.dol.gov/LATEST/search-index?q=%22${p.ein.replace(/-/g, "")}%22&dateRange=custom&startDate=2022-01-01&endDate=2024-12-31`}
                    target="_blank" rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: BLUE,
                      background: `${BLUE}10`, border: `1px solid ${BLUE}25`, borderRadius: 6, padding: "5px 10px", textDecoration: "none" }}>
                    <ExternalLink style={{ width: 10, height: 10 }} /> View Form 5500 Filing (DOL EFAST2)
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <button onClick={() => setShowSave(!showSave)} data-testid="drawer-save-pipeline"
                style={{ width: "100%", padding: "12px", borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: "pointer",
                  background: `${GOLD}18`, border: `1px solid ${GOLD}35`, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Bookmark style={{ width: 13, height: 13 }} /> Save to List
              </button>
              {showSave && <SaveToListDropdown prospect={p} onClose={() => setShowSave(false)} />}
            </div>
            <button onClick={() => sendTo("benchmarking", p.ein, p.sponsor_name)}
              data-testid="drawer-benchmarking"
              style={{ padding: "12px 16px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: `${GOLD}10`, border: `1px solid ${GOLD}30`, color: GOLD,
                display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart2 style={{ width: 12, height: 12 }} /> Benefits Benchmarking
            </button>
            <button onClick={() => downloadWithManifest(`/api/prospect-reports/dol-csv/${p.ein}`)}
              data-testid="drawer-export"
              style={{ padding: "12px 16px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.28)", color: "#00D4FF",
                display: "flex", alignItems: "center", gap: 6 }}>
              <Download style={{ width: 12, height: 12 }} /> DOL History (CSV)
            </button>
            <button onClick={() => downloadWithManifest(`/api/prospect-reports/shady-pdf/${p.ein}`)}
              data-testid="drawer-shady-pdf"
              style={{ padding: "12px 16px", borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)", color: "#ef4444",
                display: "flex", alignItems: "center", gap: 6 }}>
              <FileText style={{ width: 12, height: 12 }} /> Broker Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── BOOK TICKER ─────────────────────────────────────────────────────────── */
function BookTicker({ analysis }: { analysis: BookAnalysis }) {
  const [idx, setIdx] = useState(0);
  const topIndustry = analysis.industryDistribution[0]?.name ?? "Manufacturing";
  const sfPct = Math.round(
    ((analysis.planTypeBreakdown.find(p => p.type === "Self-Funded")?.count ?? 0) / analysis.totalClients) * 100
  );
  const peakRenewal = analysis.renewalDistribution.reduce(
    (best, r) => (r.count > best.count ? r : best),
    analysis.renewalDistribution[0] ?? { month: "Jan", count: 0 }
  );
  const phrases = [
    `Your book: ${analysis.totalClients} clients · avg ${analysis.avgEmployees.toLocaleString()} employees per account`,
    `${topIndustry} is your #1 vertical — ${analysis.industryDistribution[0]?.pct ?? 0}% of your current book`,
    sfPct > 0 ? `${sfPct}% self-funded book · strong natural wedge for PBM audit and stop-loss replacement` : `Diverse plan types in your book · migration opportunities to self-funded likely`,
    peakRenewal.count > 0 ? `Renewal hot zone: ${peakRenewal.month} — ${peakRenewal.count} client${peakRenewal.count > 1 ? "s" : ""} renewing · target lookalike accounts now` : `Spread your renewal calendar — even distribution across months`,
    `Book analysis complete · ${analysis.insights.length} whitespace opportunities identified in Tennessee market`,
    `Your winning profile is now live · finding employers that match your proven size, industry, and geography`,
  ];

  useEffect(() => {
    const iv = setInterval(() => setIdx(i => (i + 1) % phrases.length), 4000);
    return () => clearInterval(iv);
  }, [phrases.length]);

  return (
    <div style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderRadius: 10, padding: "10px 16px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 10, overflow: "hidden", minHeight: 40 }}>
      <Activity style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
      <div style={{ flex: 1, position: "relative", height: 18, overflow: "hidden" }}>
        {phrases.map((phrase, i) => (
          <div key={i} style={{
            position: "absolute", top: 0, left: 0, right: 0,
            opacity: i === idx ? 1 : 0,
            transform: `translateY(${i === idx ? 0 : 10}px)`,
            transition: "opacity 0.5s, transform 0.5s",
            fontSize: 12, fontWeight: 700, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{phrase}</div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>BOOK IQ</div>
    </div>
  );
}

/* ─── BOOK ANALYZER ──────────────────────────────────────────────────────── */
const DEMO_BOOK_CSV = `Cumberland Precision Manufacturing, Manufacturing, 420, Self-Funded, 3
Volunteer Components Inc, Manufacturing, 280, Self-Funded, 6
Music City Metalworks, Manufacturing, 650, Self-Funded, 9
Nashville Health Partners, Healthcare, 890, Self-Funded, 1
Tennessee Medical Associates, Healthcare, 340, Self-Funded, 7
Smoky Mountain Education Group, Education, 520, Level-Funded, 8
Blueridge Financial Advisors, Finance, 180, Self-Funded, 4
Tennessee Logistics LLC, Transportation, 310, Self-Funded, 11
Chattanooga Construction Co, Construction, 240, Level-Funded, 2
Tri-Cities Professional Group, Professional Services, 160, Self-Funded, 5
Dixie Foods, Food Service, 490, Self-Funded, 10
Memphis Community Services, Nonprofit, 120, Level-Funded, 12`;

const METRO_KEYS = ["nashville","memphis","knoxville","chattanooga","tricities","clarksville","jackson","murfreesboro"];
const PLAN_TYPES = ["Self-Funded", "Level-Funded", "Fully-Insured", "Reference-Based Pricing"];

function parsePastedBook(raw: string): { clientName: string; industry: string; employees: number; annualSpend: number; planType: string; metro: string; renewalMonth: number }[] {
  const lines = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("#"));
  return lines.map((line, idx) => {
    const cols = line.split(",").map(c => c.trim());
    const employees = parseInt(cols[2] ?? "300", 10) || 300;
    const planType = PLAN_TYPES.find(p => p.toLowerCase() === (cols[3] ?? "").toLowerCase()) ?? "Self-Funded";
    const renewalMonth = Math.max(1, Math.min(12, parseInt(cols[4] ?? String((idx % 12) + 1), 10) || (idx % 12) + 1));
    return {
      clientName: cols[0] ?? `Client ${idx + 1}`,
      industry: cols[1] ?? "Manufacturing",
      employees,
      annualSpend: employees * 7200,
      planType,
      metro: METRO_KEYS[idx % METRO_KEYS.length],
      renewalMonth,
    };
  });
}

function BookAnalyzerView({ onRunBookMatch }: { onRunBookMatch: () => void }) {
  const [step, setStep] = useState<"paste" | "results">("paste");
  const [pastedText, setPastedText] = usePersistentState<string>("broker:book", "");
  const [parseError, setParseError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null);
  const [clientCount, setClientCount] = useState(0);

  const analyzeMut = useMutation({
    mutationFn: async (clients: ReturnType<typeof parsePastedBook>) => {
      const res = await apiRequest("POST", "/api/saas/broker/book/analyze", { clients });
      return res.json() as Promise<BookAnalysis>;
    },
    // Mirror the quiz clear behavior: once the analysis succeeds and results are
    // shown, wipe the persisted book input (setting "" removes the localStorage
    // entry and the unmount flush keeps it removed) so a fresh visit starts clean.
    onSuccess: (data) => { setAnalysis(data); setStep("results"); setPastedText(""); },
  });

  function handleAnalyze() {
    setParseError(null);
    const raw = pastedText.trim();
    if (!raw) { setParseError("Please paste at least one client row."); return; }
    const clients = parsePastedBook(raw);
    if (clients.length === 0) { setParseError("Could not parse any clients. See format below."); return; }
    setClientCount(clients.length);
    analyzeMut.mutate(clients);
  }

  function handleUseDemo() {
    setPastedText(DEMO_BOOK_CSV);
    setParseError(null);
  }

  /* ── PASTE STEP ── */
  if (step === "paste") {
    const previewCount = pastedText.trim() ? parsePastedBook(pastedText).length : 0;
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 6 }}>Paste Your Book of Business</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>
            One client per line — comma-separated: <span style={{ color: GOLD, fontFamily: "monospace" }}>Company Name, Industry, Employees, Plan Type, Renewal Month</span>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 22px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
              Client List {previewCount > 0 && <span style={{ color: GREEN }}>· {previewCount} parsed</span>}
            </span>
            <button onClick={handleUseDemo} data-testid="use-demo-book"
              style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}30`, borderRadius: 8, color: GOLD,
                fontSize: 11, fontWeight: 800, padding: "5px 14px", cursor: "pointer" }}>
              Use Demo Book (12 clients)
            </button>
          </div>
          <textarea
            value={pastedText}
            onChange={e => { setPastedText(e.target.value); setParseError(null); }}
            placeholder={`Midwest Precision Manufacturing, Manufacturing, 420, Self-Funded, 3\nCircle City Health Partners, Healthcare, 890, Self-Funded, 1\nSummit Logistics LLC, Transportation, 310, Self-Funded, 11\n…paste 10–15 clients`}
            data-testid="book-paste-input"
            rows={12}
            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "monospace",
              padding: "12px 14px", resize: "vertical", outline: "none", lineHeight: 1.7, boxSizing: "border-box" }}
          />
          {parseError && (
            <div style={{ marginTop: 8, fontSize: 11, color: RED }}>{parseError}</div>
          )}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Field Reference</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {[
              { field: "Company Name", note: "Any name", example: "Acme Corp" },
              { field: "Industry", note: "Free text", example: "Manufacturing" },
              { field: "Employees", note: "Integer", example: "420" },
              { field: "Plan Type", note: "Optional", example: "Self-Funded" },
              { field: "Renewal Month", note: "1–12", example: "3 = March" },
            ].map(f => (
              <div key={f.field} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: GOLD, marginBottom: 2 }}>{f.field}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{f.note}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", marginTop: 3 }}>{f.example}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleAnalyze} disabled={analyzeMut.isPending} data-testid="run-book-analysis"
          style={{ width: "100%", padding: "16px", borderRadius: 14, fontSize: 14, fontWeight: 900, cursor: analyzeMut.isPending ? "default" : "pointer",
            background: analyzeMut.isPending ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${GOLD}25, ${GOLD}12)`,
            border: `1px solid ${analyzeMut.isPending ? "rgba(255,255,255,0.08)" : GOLD + "45"}`,
            color: analyzeMut.isPending ? "rgba(255,255,255,0.3)" : GOLD,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {analyzeMut.isPending
            ? <><RefreshCw style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Analyzing book…</>
            : <><TrendingUp style={{ width: 15, height: 15 }} /> Analyze My Book →</>}
        </button>
      </div>
    );
  }

  /* ── RESULTS STEP ── */
  if (!analysis) return null;

  const industryColors = [BLUE, ORANGE, GREEN, PURPLE, GOLD, "#aaa", RED, "#eee"];
  const industryData = analysis.industryDistribution.map((d, i) => ({ ...d, color: industryColors[i % industryColors.length] }));
  const sizeColors = [GREEN, GOLD, ORANGE, RED];
  const sizeData = analysis.sizeDistribution.map((d, i) => ({ ...d, fill: sizeColors[i % 4] }));
  const planColors = [BLUE, GREEN, ORANGE, PURPLE, GOLD];
  const planPieData = analysis.planTypeBreakdown.map((p, i) => ({
    name: p.type, value: p.count, fill: planColors[i % planColors.length],
  }));

  const summaryStats = [
    { label: "Total Clients", value: String(analysis.totalClients), color: GOLD, icon: Users },
    { label: "Avg Employees", value: analysis.avgEmployees.toLocaleString(), color: BLUE, icon: Building2 },
    { label: "Top Vertical", value: analysis.industryDistribution[0]?.name ?? "—", color: GREEN, icon: Briefcase },
    { label: "Top Plan Type", value: analysis.planTypeBreakdown[0]?.type ?? "—", color: ORANGE, icon: Shield },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Your Book Profile Analysis</div>
        <button onClick={() => setStep("paste")} data-testid="re-edit-book"
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
            color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, padding: "5px 12px", cursor: "pointer" }}>
          ← Re-paste / Edit
        </button>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 18 }}>
        Based on your {analysis.totalClients}-client book · real patterns used to target best-fit prospects.
      </div>

      {/* Live Ticker */}
      <BookTicker analysis={analysis} />

      {/* Summary stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
        {summaryStats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`,
              borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
              <Icon style={{ width: 16, height: 16, color: s.color, margin: "0 auto 6px" }} />
              <div style={{ fontSize: s.label === "Top Vertical" || s.label === "Top Plan Type" ? 13 : 20, fontWeight: 900, color: s.color, lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts row 1: Industry + Size */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Industry Concentration</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={industryData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                formatter={(v: any) => [v, "clients"]}
                contentStyle={{ background: "#080810", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: "right", fill: "rgba(255,255,255,0.3)", fontSize: 10, formatter: (v: any) => v > 0 ? v : "" }}>
                {industryData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Employer Size Distribution</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={sizeData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <XAxis dataKey="band" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 8 }} axisLine={false} tickLine={false}
                tickFormatter={v => v.split(" ")[0]} />
              <YAxis hide />
              <Tooltip
                formatter={(v: any) => [v, "clients"]}
                labelFormatter={l => `${l}`}
                contentStyle={{ background: "#080810", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sizeData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 10, padding: "7px 11px", background: `${GOLD}08`, border: `1px solid ${GOLD}15`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}>Book Avg: {analysis.avgEmployees.toLocaleString()} employees per account</div>
          </div>
        </div>
      </div>

      {/* Charts row 2: Renewal histogram + Plan type pie */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>Renewal Month Distribution</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={analysis.renewalDistribution} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v: any) => [v, "clients"]} contentStyle={{ background: "#080810", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {analysis.renewalDistribution.map((r, i) => (
                  <Cell key={i} fill={r.count === Math.max(...analysis.renewalDistribution.map(x => x.count)) ? GOLD : `${GOLD}45`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8, fontSize: 9, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
            Peak month highlighted in gold
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 10 }}>Plan Type Breakdown</div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={planPieData} cx="50%" cy="50%" outerRadius={52} innerRadius={28} dataKey="value" paddingAngle={3}>
                {planPieData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85} />)}
              </Pie>
              <Tooltip formatter={(v: any, name: any) => [v, name]} contentStyle={{ background: "#080810", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", justifyContent: "center" }}>
            {planPieData.map(p => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.fill, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{p.name} <span style={{ fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>({p.value})</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Whitespace Intelligence */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 16 }}>
          Market Whitespace Intelligence
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {analysis.insights.map((ins, i) => {
            const col = ins.type === "strength" ? GREEN : ins.type === "next" ? GOLD : ORANGE;
            const label = ins.type === "strength" ? "Strength" : ins.type === "next" ? "Next Best Target" : "Whitespace Gap";
            return (
              <div key={i} style={{ display: "flex", gap: 14, padding: "12px 16px", borderRadius: 12,
                background: `${col}06`, border: `1px solid ${col}18`, borderLeft: `3px solid ${col}` }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: col,
                    background: `${col}15`, border: `1px solid ${col}25`, borderRadius: 4, padding: "2px 6px" }}>{label}</span>
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>{ins.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={onRunBookMatch} data-testid="book-match-run"
        style={{ width: "100%", padding: "16px", borderRadius: 14, fontSize: 14, fontWeight: 900, cursor: "pointer",
          background: `linear-gradient(135deg, ${GOLD}22, ${GOLD}12)`, border: `1px solid ${GOLD}45`, color: GOLD,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <Target style={{ width: 16, height: 16 }} />
        Find My Best-Fit Prospects Based On This Book →
      </button>
    </div>
  );
}

/* ─── SAVED LISTS PANEL ──────────────────────────────────────────────────── */
function SavedListsPanel() {
  const qc = useQueryClient();
  const { sendTo } = useCompanyHandoff();
  const { downloadWithManifest } = useManifestDownload();
  const { data: lists = [], isLoading } = useQuery<SavedList[]>({ queryKey: ["/api/saas/broker/lists"] });
  const { divergenceWatch, thresholds } = useDivergenceWatch();
  const [expandedList, setExpandedList] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const renameMut = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await apiRequest("PATCH", `/api/saas/broker/lists/${id}`, { name });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/saas/broker/lists"] }); setEditingId(null); },
  });

  const deleteItemMut = useMutation({
    mutationFn: async ({ listId, itemId }: { listId: number; itemId: number }) => {
      await apiRequest("DELETE", `/api/saas/broker/lists/${listId}/items/${itemId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/saas/broker/lists"] }),
  });

  if (isLoading) return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", padding: 20 }}>Loading saved lists…</div>;
  if (!lists.length) return (
    <div style={{ padding: "30px 20px", textAlign: "center", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 12 }}>
      <Bookmark style={{ width: 24, height: 24, color: "rgba(255,255,255,0.15)", margin: "0 auto 12px" }} />
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>No saved lists yet</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>Save prospects from the results view to create lists</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {lists.map(l => (
        <div key={l.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", cursor: "pointer" }}
            onClick={() => setExpandedList(expandedList === l.id ? null : l.id)}>
            <Bookmark style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
            {editingId === l.id ? (
              <input value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") renameMut.mutate({ id: l.id, name: editName }); }}
                onBlur={() => renameMut.mutate({ id: l.id, name: editName })}
                onClick={e => e.stopPropagation()} autoFocus
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6,
                  padding: "4px 8px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none" }} />
            ) : (
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#fff" }}>{l.name}</span>
            )}
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 8px" }}>
              {l.itemCount} {l.itemCount === 1 ? "prospect" : "prospects"}
            </span>
            <button onClick={e => { e.stopPropagation(); setEditingId(l.id); setEditName(l.name); }} data-testid={`rename-list-${l.id}`}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <Edit3 style={{ width: 12, height: 12, color: "rgba(255,255,255,0.3)" }} />
            </button>
            <button onClick={e => { e.stopPropagation(); downloadWithManifest(`/api/saas/broker/lists/${l.id}/export`, { filename: `prospect-list-${l.id}.csv` }); }} data-testid={`export-list-${l.id}`}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
              <Download style={{ width: 12, height: 12, color: "rgba(255,255,255,0.3)" }} />
            </button>
            <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)",
              transform: expandedList === l.id ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </div>

          {expandedList === l.id && l.items.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 12px" }}>
              {l.items.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>{item.sponsorName}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                      {item.city} · {item.industry} · {item.participants.toLocaleString()} participants
                    </div>
                    {item.ein && (
                      <div style={{ marginTop: 4 }}>
                        <RisingAtRankFlag
                          ein={item.ein}
                          company={item.sponsorName}
                          entry={divergenceWatch[item.ein]}
                          thresholds={thresholds}
                          compact
                          testId={`divergence-flag-item-${item.id}`}
                        />
                      </div>
                    )}
                    {item.notes && (
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontStyle: "italic", marginTop: 2 }}>{item.notes}</div>
                    )}
                  </div>
                  {item.matchScore > 0 && (
                    <div style={{ fontSize: 14, fontWeight: 900, color: scoreColor(item.matchScore), flexShrink: 0 }}>{item.matchScore}</div>
                  )}
                  {item.ein && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => sendTo("benchmarking", item.ein, item.sponsorName)}
                        data-testid={`handoff-benchmark-${item.id}`}
                        title="Benchmark" style={{ background: "rgba(0,168,255,0.12)", border: "1px solid rgba(0,168,255,0.25)",
                          borderRadius: 5, padding: "2px 6px", cursor: "pointer", fontSize: 9, color: "#00A8FF", fontWeight: 700 }}>
                        BM
                      </button>
                      <button onClick={() => sendTo("war-room", item.ein, item.sponsorName)}
                        data-testid={`handoff-warroom-${item.id}`}
                        title="War Room" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)",
                          borderRadius: 5, padding: "2px 6px", cursor: "pointer", fontSize: 9, color: "#F5A623", fontWeight: 700 }}>
                        WR
                      </button>
                    </div>
                  )}
                  <button onClick={() => deleteItemMut.mutate({ listId: l.id, itemId: item.id })} data-testid={`delete-item-${item.id}`}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash2 style={{ width: 12, height: 12, color: "rgba(255,255,255,0.2)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── QUIZ FLOW ──────────────────────────────────────────────────────────── */
function QuizFlow({ onComplete, state = "IN" }: { onComplete: (p: URLSearchParams) => void; state?: string }) {
  const stateName = US_STATES.find(s => s.abbr === state)?.name ?? state;
  const [step, setStep] = usePersistentState<number>("broker:quiz:step", 0);
  const [answers, setAnswers] = usePersistentState<QuizAnswers>("broker:quiz:answers", { sizes: [], metros: [], industries: [], serviceWedge: "", salesMotion: "" });

  function toggleArr(key: keyof QuizAnswers, val: string) {
    const arr = (answers[key] as string[]);
    const next = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    setAnswers({ ...answers, [key]: next });
  }
  function setSingle(key: keyof QuizAnswers, val: string) { setAnswers({ ...answers, [key]: val }); }

  const STEPS = [
    {
      q: "What size accounts are you targeting?",
      hint: "Select all that apply",
      render: () => (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SIZE_OPTIONS.map(s => (
            <button key={s.key} onClick={() => toggleArr("sizes", s.key)}
              style={{ flex: "1 1 150px", padding: "16px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                background: answers.sizes.includes(s.key) ? `${GOLD}15` : "rgba(255,255,255,0.04)",
                border: answers.sizes.includes(s.key) ? `1px solid ${GOLD}45` : "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: answers.sizes.includes(s.key) ? GOLD : "#fff", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{s.sub}</div>
            </button>
          ))}
        </div>
      ),
      valid: () => answers.sizes.length > 0,
    },
    {
      q: `Which ${stateName} markets matter most to you?`,
      hint: "Select all target territories",
      render: () => {
        const stateCities = STATE_CITIES[state] || [];
        const metroOpts = state === "TN"
          ? METRO_OPTIONS
          : [
              { key: "any", label: `All ${stateName}`, sub: "No geography preference" },
              ...stateCities.map(city => ({ key: city.toUpperCase(), label: city, sub: `${city}, ${state}` })),
            ];
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {metroOpts.map(m => <Chip key={m.key} active={answers.metros.includes(m.key)} onClick={() => toggleArr("metros", m.key)}>{m.label}</Chip>)}
          </div>
        );
      },
      valid: () => answers.metros.length > 0,
    },
    {
      q: "Where is your strongest vertical expertise?",
      hint: "Select all industries you know well",
      render: () => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {INDUSTRY_OPTIONS.map(i => <Chip key={i.key} active={answers.industries.includes(i.key)} onClick={() => toggleArr("industries", i.key)}>{i.label}</Chip>)}
        </div>
      ),
      valid: () => answers.industries.length > 0,
    },
    {
      q: "What is your primary service wedge?",
      hint: "Choose one — this is how you open the conversation",
      render: () => (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {SERVICE_OPTIONS.map(s => {
            const Icon = s.icon;
            const active = answers.serviceWedge === s.key;
            return (
              <button key={s.key} onClick={() => setSingle("serviceWedge", s.key)}
                style={{ padding: "16px 18px", borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                  background: active ? `${GOLD}12` : "rgba(255,255,255,0.03)",
                  border: active ? `1px solid ${GOLD}40` : "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? `${GOLD}20` : "rgba(255,255,255,0.06)", border: `1px solid ${active ? GOLD + "40" : "rgba(255,255,255,0.1)"}` }}>
                    <Icon style={{ width: 14, height: 14, color: active ? GOLD : "rgba(255,255,255,0.4)" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: active ? GOLD : "#fff" }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{s.sub}</div>
              </button>
            );
          })}
        </div>
      ),
      valid: () => !!answers.serviceWedge,
    },
    {
      q: "What is your primary sales motion?",
      hint: "How you prefer to enter new accounts",
      render: () => (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {MOTION_OPTIONS.map(m => {
            const Icon = m.icon;
            const active = answers.salesMotion === m.key;
            return (
              <button key={m.key} onClick={() => setSingle("salesMotion", m.key)}
                style={{ padding: "16px 18px", borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "all 0.12s",
                  background: active ? `${BLUE}10` : "rgba(255,255,255,0.03)",
                  border: active ? `1px solid ${BLUE}35` : "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <Icon style={{ width: 16, height: 16, color: active ? BLUE : "rgba(255,255,255,0.4)" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: active ? BLUE : "#fff" }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{m.sub}</div>
              </button>
            );
          })}
        </div>
      ),
      valid: () => !!answers.salesMotion,
    },
  ];

  const current = STEPS[step];
  const isValid = current.valid();

  function submit() {
    const sizes = answers.sizes.length ? answers.sizes : ["small", "midmarket", "large"];
    const minSizes = sizes.map(s => s === "small" ? 50 : s === "midmarket" ? 200 : s === "large" ? 500 : 1000);
    const maxSizes = sizes.map(s => s === "small" ? 199 : s === "midmarket" ? 499 : s === "large" ? 999 : 9999);
    const naicsPrefixes = answers.industries.flatMap(k => INDUSTRY_OPTIONS.find(i => i.key === k)?.naics || []);
    const metroKeys = answers.metros.filter(m => m !== "any").join(",");
    const params = new URLSearchParams({
      mode: "custom",
      min_size: String(Math.min(...minSizes)),
      max_size: String(Math.max(...maxSizes)),
      industries: naicsPrefixes.join(","),
      metros: metroKeys,
      service_wedge: answers.serviceWedge || "any",
      sales_motion: answers.salesMotion || "any",
      limit: "500",
      state,
    });
    onComplete(params);
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? GOLD : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
        ))}
      </div>

      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
        Question {step + 1} of {STEPS.length}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 6 }}>{current.q}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>{current.hint}</div>

      <div style={{ marginBottom: 32 }}>{current.render()}</div>

      <div style={{ display: "flex", gap: 10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ padding: "12px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            ← Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => isValid && setStep(s => s + 1)} disabled={!isValid} data-testid="quiz-next"
            style={{ flex: 1, padding: "13px", borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: isValid ? "pointer" : "not-allowed",
              background: isValid ? `${GOLD}20` : "rgba(255,255,255,0.05)",
              border: isValid ? `1px solid ${GOLD}40` : "1px solid rgba(255,255,255,0.08)",
              color: isValid ? GOLD : "rgba(255,255,255,0.25)" }}>
            Next →
          </button>
        ) : (
          <button onClick={submit} disabled={!isValid} data-testid="quiz-submit"
            style={{ flex: 1, padding: "13px", borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: isValid ? "pointer" : "not-allowed",
              background: isValid ? `linear-gradient(135deg, ${GOLD}28, ${GOLD}15)` : "rgba(255,255,255,0.05)",
              border: isValid ? `1px solid ${GOLD}50` : "1px solid rgba(255,255,255,0.08)",
              color: isValid ? GOLD : "rgba(255,255,255,0.25)" }}>
            Find My Recommended Targets →
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── RESULTS DASHBOARD ──────────────────────────────────────────────────── */
function ResultsDashboard({ queryParams, onBack, state = "IN", initialFlagFilter = null }: { queryParams: URLSearchParams; onBack: () => void; state?: string; initialFlagFilter?: string | null }) {
  const stateName = US_STATES.find(s => s.abbr === state)?.name ?? state;
  const [viewMode, setViewMode] = useState<"list" | "map" | "saved">("list");
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [metroFilter, setMetroFilter] = useState("");
  const [triggeredOnly, setTriggeredOnly] = useState(false);
  const [publicOnly, setPublicOnly] = useState(false);
  const [flagFilter, setFlagFilter] = useState<string | null>(initialFlagFilter);
  const { divergenceWatch, thresholds } = useDivergenceWatch();

  // Restore view/metro from a shared link (?bview=&metro=). flag is restored
  // via initialFlagFilter; state/mode are restored by the parent.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bview = params.get("bview");
    if (bview === "list" || bview === "map" || bview === "saved") setViewMode(bview);
    const metro = params.get("metro");
    if (metro) setMetroFilter(metro);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getShareState(): Record<string, any> {
    const st: Record<string, any> = { mode: "results", bstate: state, bview: viewMode };
    if (metroFilter) st.metro = metroFilter;
    if (flagFilter) st.flag = flagFilter;
    return st;
  }

  const { data, isLoading } = useQuery<ProspectsData>({
    queryKey: ["/api/saas/broker/prospects", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/saas/broker/prospects?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const prospects = (data?.prospects || []).filter(p => {
    if (metroFilter && p.metro_region !== metroFilter) return false;
    if (triggeredOnly && !(p.edgar?.trigger_type && p.edgar.trigger_type !== "filing")) return false;
    if (publicOnly && !p.edgar?.is_public) return false;
    if (flagFilter && !p.fit_flags.includes(flagFilter)) return false;
    return true;
  });
  const triggeredCount = (data?.prospects || []).filter(p => p.edgar?.trigger_type && p.edgar.trigger_type !== "filing").length;
  const publicCount = (data?.prospects || []).filter(p => p.edgar?.is_public).length;
  const s = data?.summary;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
          color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: 0, flexShrink: 0 }}>
          ← Refine Search
        </button>

        <div style={{ flexShrink: 0 }}>
          <ShareMenu page="broker-prospects" getState={getShareState} getTitle={() => `${stateName} Prospects`} accent={GOLD} align="left" testIdPrefix="share-broker" />
        </div>

        {s && (
          <div style={{ display: "flex", gap: 20, marginLeft: "auto", flexWrap: "wrap" }}>
            {[
              { label: `${stateName} DB Matches`, value: data?.total_found, color: GOLD },
              { label: "Shown",               value: s.shown,          color: "rgba(255,255,255,0.6)" },
              { label: "Stop-Loss Gaps",       value: s.stop_loss_gaps, color: ORANGE },
              { label: "Rx Opportunities",     value: s.rx_opportunities, color: PURPLE },
              { label: "Total Commission Opp", value: fmtMoney(s.total_opportunity), color: GREEN },
              { label: "Avg Fit Score",        value: s.avg_match_score, color: scoreColor(s.avg_match_score) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.09em", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {([["list", LayoutGrid, "Recommended Accounts"], ...(state === "TN" ? [["map", MapIcon, `${stateName} Market Map`]] : []), ["saved", Bookmark, "Saved Lists"]] as ["list" | "map" | "saved", typeof LayoutGrid, string][]).map(([id, Icon, label]) => (
          <button key={id} onClick={() => setViewMode(id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: viewMode === id ? `${GOLD}15` : "rgba(255,255,255,0.04)",
              border: viewMode === id ? `1px solid ${GOLD}40` : "1px solid rgba(255,255,255,0.08)",
              color: viewMode === id ? GOLD : "rgba(255,255,255,0.4)" }}>
            <Icon style={{ width: 12, height: 12 }} />{label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {triggeredCount > 0 && (
            <button onClick={() => setTriggeredOnly(t => !t)} data-testid="filter-triggered"
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                background: triggeredOnly ? "rgba(255,68,68,0.15)" : "rgba(255,255,255,0.04)",
                border: triggeredOnly ? "1px solid rgba(255,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)",
                color: triggeredOnly ? "#FF4444" : "rgba(255,255,255,0.4)" }}>
              🔥 Triggered ({triggeredCount})
            </button>
          )}
          {publicCount > 0 && (
            <button onClick={() => setPublicOnly(p => !p)} data-testid="filter-public"
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                background: publicOnly ? `${GOLD}15` : "rgba(255,255,255,0.04)",
                border: publicOnly ? `1px solid ${GOLD}40` : "1px solid rgba(255,255,255,0.08)",
                color: publicOnly ? GOLD : "rgba(255,255,255,0.4)" }}>
              📈 Public Co. ({publicCount})
            </button>
          )}
          {flagFilter && FLAG_CFG[flagFilter] && (
            <button onClick={() => setFlagFilter(null)} data-testid="filter-flag-clear"
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 7, cursor: "pointer",
                background: `${FLAG_CFG[flagFilter].color}15`, border: `1px solid ${FLAG_CFG[flagFilter].color}40`,
                color: FLAG_CFG[flagFilter].color }}>
              {FLAG_CFG[flagFilter].label} <X style={{ width: 10, height: 10, marginLeft: 2 }} />
            </button>
          )}
          {metroFilter && (
            <button onClick={() => setMetroFilter("")}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "6px 12px", borderRadius: 7,
                background: `${GOLD}10`, border: `1px solid ${GOLD}25`, color: GOLD, cursor: "pointer" }}>
              <X style={{ width: 10, height: 10 }} /> Clear Metro
            </button>
          )}
        </div>
      </div>

      {viewMode === "saved" ? (
        <SavedListsPanel />
      ) : isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 14 }}>
          <RefreshCw style={{ width: 22, height: 22, color: GOLD, animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Querying {stateName} Form 5500 database — live intelligence loading…</div>
        </div>
      ) : viewMode === "map" && data?.metro_distribution ? (
        <TnMapView metros={data.metro_distribution} selectedMetro={metroFilter} onSelect={k => setMetroFilter(k === metroFilter ? "" : k)} />
      ) : !prospects.length ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>No Recommended Targets found with these filters.</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>Try broadening your geography or industry selections.</div>
        </div>
      ) : (
        <>
          {queryParams.get("mode") === "book" && (
            <div style={{ background: `${GOLD}07`, border: `1px solid ${GOLD}18`, borderRadius: 14, padding: "12px 18px", marginBottom: 18,
              display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              <Target style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
              Results powered by your book profile analysis. Sorted by 6-factor fit score — highest structural match to your current winning accounts.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            {prospects.map((p, i) => <ProspectCard key={p.ein + i} p={p} index={i} onSelect={() => setSelectedProspect(p)} divergenceWatch={divergenceWatch} thresholds={thresholds} />)}
          </div>
          <div style={{ marginTop: 18, padding: "12px 18px", background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
            Source: U.S. Department of Labor Form 5500 public filings ({stateName}, 2022–2023). Fit scores calculated by Kincaid IQ™ 6-factor model. Commission estimates are projections only.
          </div>
        </>
      )}

      {selectedProspect && <ProspectDrawer p={selectedProspect} onClose={() => setSelectedProspect(null)} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── OVERVIEW TICKER ────────────────────────────────────────────────────── */
function ProspectTicker({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phrases.length <= 1) return;
    const iv = setInterval(() => setIndex(i => (i + 1) % phrases.length), 4000);
    return () => clearInterval(iv);
  }, [phrases.length]);

  if (!phrases.length) return null;

  return (
    <div style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}20`, borderRadius: 10, padding: "10px 16px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 10, overflow: "hidden", minHeight: 40 }}>
      <Activity style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
      <div style={{ flex: 1, position: "relative", height: 18, overflow: "hidden" }}>
        {phrases.map((phrase, i) => (
          <div key={i} style={{
            position: "absolute", top: 0, left: 0, right: 0,
            opacity: i === index ? 1 : 0,
            transform: `translateY(${i === index ? 0 : 10}px)`,
            transition: "opacity 0.5s, transform 0.5s",
            fontSize: 12, fontWeight: 700, color: GOLD, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {phrase}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>LIVE</div>
    </div>
  );
}

/* ─── ROOT EXPORTED VIEW ─────────────────────────────────────────────────── */
export function ProspectsView() {
  const [mode, setMode] = usePersistentState<"intro" | "quiz" | "book" | "results">("broker:mode", "results");
  const [queryParams, setQueryParams] = useState<URLSearchParams | null>(
    () => new URLSearchParams({ mode: "book", limit: "500", state: "IN" })
  );
  const [initialFlagFilter, setInitialFlagFilter] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState("IN");
  const stateName = US_STATES.find(s => s.abbr === selectedState)?.name ?? selectedState;

  const [handoffEin, setHandoffEin] = useState<string | null>(null);
  const [handoffCompany, setHandoffCompany] = useState<string | null>(null);
  const [handoffDismissed, setHandoffDismissed] = useState(false);
  const { sendTo } = useCompanyHandoff();

  // After a quiz submit transitions to results, clear the persisted quiz
  // progress. This runs as a passive effect (after QuizFlow unmounts and flushes
  // its own state), so it reliably wipes the stored answers/step. Gated by a ref
  // so book-match / tile navigation into results does NOT discard an in-progress
  // quiz the user may want to resume later.
  const clearQuizOnResultsRef = useRef(false);
  useEffect(() => {
    if (mode === "results" && clearQuizOnResultsRef.current) {
      clearQuizOnResultsRef.current = false;
      try {
        localStorage.removeItem("broker:quiz:answers");
        localStorage.removeItem("broker:quiz:step");
      } catch {}
    }
  }, [mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ein = params.get("ein");
    const company = params.get("company");
    if (ein) { setHandoffEin(ein); setHandoffCompany(company || ein); }

    // Shared-link view-state restoration (?mode=&bstate=&flag=)
    const bstate = params.get("bstate");
    const flag = params.get("flag");
    const modeParam = params.get("mode");
    if (bstate) setSelectedState(bstate);
    if (modeParam === "results") {
      if (flag) setInitialFlagFilter(flag);
      setQueryParams(new URLSearchParams({ mode: "book", limit: "500", state: bstate || "IN" }));
      setMode("results");
    } else if (modeParam === "intro" || modeParam === "book" || modeParam === "quiz") {
      setMode(modeParam as "intro" | "book" | "quiz");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["/api/saas/broker/overview", selectedState],
    queryFn: async () => {
      const res = await fetch(`/api/saas/broker/overview?state=${selectedState}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: mode === "intro",
  });

  function runBookMatch() {
    setInitialFlagFilter(null);
    setQueryParams(new URLSearchParams({ mode: "book", limit: "500", state: selectedState }));
    setMode("results");
  }

  function runTileClick(flag: string | null) {
    setInitialFlagFilter(flag);
    setQueryParams(new URLSearchParams({ mode: "book", limit: "500", state: selectedState }));
    setMode("results");
  }

  function runQuizResults(params: URLSearchParams) {
    setInitialFlagFilter(null);
    setQueryParams(params);
    clearQuizOnResultsRef.current = true;
    setMode("results");
  }

  const doctrineBar = (
    <DoctrineBar
      gate={mode === "results" ? "RENDER" : mode === "book" || mode === "quiz" ? "COMPUTE" : "DEFINE"}
      tier={handoffEin ? "CERTIFIED" : mode === "results" ? "MODELED" : "INSUFFICIENT_EVIDENCE"}
      ein={handoffEin}
      einName={handoffCompany}
    />
  );

  const handoffBanner = !handoffDismissed && handoffEin ? (
    <div style={{ margin: "0 0 16px 0", padding: "10px 18px", background: "rgba(245,166,35,0.07)",
      border: "1px solid rgba(245,166,35,0.22)", borderRadius: 12,
      display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: GOLD }}>{handoffCompany}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
          EIN {handoffEin} · Handoff context active
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => sendTo("benchmarking", handoffEin, handoffCompany ?? "")}
          data-testid="handoff-broker-benchmark"
          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontWeight: 700,
            background: "rgba(0,168,255,0.1)", border: "1px solid rgba(0,168,255,0.3)", color: "#00A8FF" }}>
          Full Benchmark →
        </button>
        <button onClick={() => sendTo("war-room", handoffEin, handoffCompany ?? "")}
          data-testid="handoff-broker-warroom"
          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontWeight: 700,
            background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", color: GOLD }}>
          CFO War Room →
        </button>
      </div>
      <button onClick={() => setHandoffDismissed(true)} data-testid="handoff-dismiss"
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, padding: 4 }}>
        ✕
      </button>
    </div>
  ) : null;

  if (mode === "intro") return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 12 }}>
      {doctrineBar}
      {handoffBanner}
      {/* ── State Selector ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 16, gap: 10 }}>
        <MapPin style={{ width: 13, height: 13, color: GOLD }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>Prospect State:</span>
        <select
          value={selectedState}
          onChange={e => setSelectedState(e.target.value)}
          data-testid="state-selector"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${GOLD}35`, borderRadius: 8,
            color: GOLD, fontSize: 12, fontWeight: 800, padding: "6px 12px", cursor: "pointer", outline: "none" }}
        >
          {US_STATES.map(s => (
            <option key={s.abbr} value={s.abbr} style={{ background: "#0d1033", color: "#fff" }}>
              {s.name} ({s.abbr})
            </option>
          ))}
        </select>
      </div>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${GOLD}10`, border: `1px solid ${GOLD}25`,
          borderRadius: 20, padding: "6px 16px", fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
          <MapPin style={{ width: 11, height: 11 }} /> {stateName} Prospect Engine · Form 5500 Intelligence
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 10 }}>Recommended Target Accounts</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 540, margin: "0 auto", lineHeight: 1.7 }}>
          Powered by real DOL Form 5500 data from {overview ? `${overview.total_prospects.toLocaleString()}+` : "—"} {stateName} employers — identify your best-fit accounts with
          stop-loss gaps, Rx opportunities, and incumbent carrier displacement potential.
        </div>
      </div>

      {overview && <ProspectTicker phrases={overview.ticker_phrases} />}

      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }} data-testid="overview-metrics">
          {([
            { label: "Total Prospects", value: overview.total_prospects.toLocaleString(), color: GOLD, icon: Users, flag: null },
            { label: "Recommended", value: overview.recommended.toLocaleString(), color: GREEN, icon: Target, flag: "high_value_strategic" },
            { label: "Renewal Window", value: String(overview.renewal_window_targets), color: ORANGE, icon: Clock, flag: "full_renewal_support" },
            { label: "Rx Targets", value: String(overview.rx_targets), color: PURPLE, icon: Pill, flag: "rx_opportunity" },
            { label: "Stop-Loss Gaps", value: String(overview.sl_targets), color: RED, icon: Shield, flag: "stop_loss_gap" },
          ] as { label: string; value: string; color: string; icon: typeof Users; flag: string | null }[]).map(({ label, value, color, icon: Icon, flag }) => (
            <button key={label} onClick={() => runTileClick(flag)}
              data-testid={`overview-metric-${label.toLowerCase().replace(/\s+/g,"-")}`}
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14,
                padding: "14px 12px", textAlign: "center", position: "relative", overflow: "hidden",
                cursor: "pointer", transition: "all 0.15s", width: "100%" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.background = `${color}08`; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ position: "absolute", top: -10, right: -10, width: 50, height: 50, borderRadius: "50%",
                background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`, pointerEvents: "none" }} />
              <Icon style={{ width: 14, height: 14, color, marginBottom: 8 }} />
              <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>{label}</div>
              <div style={{ fontSize: 7, color: `${color}60`, marginTop: 5, letterSpacing: "0.05em" }}>Click to view →</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        {[
          {
            id: "book", title: "Book Analysis Mode", sub: "I have existing clients",
            desc: `We analyze your current book — industry mix, size concentration, service patterns, and whitespace gaps — then surface ${stateName} employers that match your proven winning profile.`,
            icon: Briefcase, color: GOLD,
            bullets: ["Your book profile visualized", "Whitespace intelligence report", "Best-fit account recommendations", "6-factor match scoring"],
            action: () => setMode("book"),
          },
          {
            id: "quiz", title: "No Book Mode", sub: "I'm building my pipeline",
            desc: `Answer 5 quick questions about your target market — size, geography, industry, service wedge, and sales motion — and we'll query live ${stateName} Form 5500 data to build your first prospect list.`,
            icon: Search, color: BLUE,
            bullets: ["5-question guided quiz", "Target market definition", "Live 5500 database query", "Prospect detail with opening angles"],
            action: () => setMode("quiz"),
          },
        ].map(opt => {
          const Icon = opt.icon;
          return (
            <button key={opt.id} onClick={opt.action} data-testid={`prospect-mode-${opt.id}`}
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: 20, padding: "28px 26px", textAlign: "left", cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 16 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${opt.color}40`; e.currentTarget.style.background = `${opt.color}06`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${opt.color}15`, border: `1px solid ${opt.color}30`, flexShrink: 0 }}>
                  <Icon style={{ width: 20, height: 20, color: opt.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{opt.title}</div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: opt.color, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{opt.desc}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {opt.bullets.map(b => (
                  <div key={b} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: opt.color, fontSize: 11 }}>✓</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{b}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "auto", fontSize: 12, fontWeight: 800, color: opt.color, display: "flex", alignItems: "center", gap: 6 }}>
                Select <ArrowRight style={{ width: 13, height: 13 }} />
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <Shield style={{ width: 16, height: 16, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
          All recommendations sourced from public DOL Form 5500 annual filings — {stateName} employers only.
          Fit scores and opportunity flags are generated by Kincaid IQ™ 6-factor model: size (25%), industry (20%),
          geography (15%), renewal timing (15%), service fit (15%), whitespace (10%). For broker use only.
        </span>
      </div>
    </div>
  );

  if (mode === "quiz") return (
    <div>
      {doctrineBar}
      {handoffBanner}
      <button onClick={() => setMode("intro")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 28,
        background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: 0 }}>
        ← Back
      </button>
      <QuizFlow onComplete={runQuizResults} state={selectedState} />
    </div>
  );

  if (mode === "book") return (
    <div>
      {doctrineBar}
      {handoffBanner}
      <button onClick={() => setMode("intro")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24,
        background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: 0 }}>
        ← Back
      </button>
      <BookAnalyzerView onRunBookMatch={runBookMatch} />
    </div>
  );

  if (mode === "results" && queryParams) return (
    <>
      {doctrineBar}
      {handoffBanner}
      <ResultsDashboard queryParams={queryParams} onBack={() => setMode("intro")} state={selectedState} initialFlagFilter={initialFlagFilter} />
    </>
  );

  return null;
}

export default ProspectsView;
