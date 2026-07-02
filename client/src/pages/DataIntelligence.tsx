import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import {
  Database, Search, FileText, Pill, Building2,
  DollarSign, ShoppingBag, Calculator, AlertCircle,
  ExternalLink, ChevronRight, Info, CheckCircle, XCircle
} from "lucide-react";

const FEEDS = [
  {
    id: "sec",
    label: "SEC EDGAR",
    icon: FileText,
    color: "#00A8FF",
    tag: "Capital Markets",
    description: "10-K / 10-Q / 8-K filings search. XBRL segment disclosures, due diligence, benchmarking.",
    auth: "Public",
  },
  {
    id: "nadac",
    label: "NADAC Drug Pricing",
    icon: Pill,
    color: "#00FF94",
    tag: "Healthcare",
    description: "National Average Drug Acquisition Cost. Benchmark acquisition costs; replicate excess-of-NADAC logic.",
    auth: "Public",
  },
  {
    id: "cms",
    label: "CMS Data API",
    icon: Building2,
    color: "#A855F7",
    tag: "Healthcare",
    description: "Programmatic access to CMS datasets — Part D, provider data, Medicare spending.",
    auth: "Public",
  },
  {
    id: "ab2d",
    label: "CMS AB2D",
    icon: Database,
    color: "#FFB800",
    tag: "Claims",
    description: "Bulk Medicare Part A/B claims for eligible plan sponsors. Enterprise utilization analytics.",
    auth: "OAuth (Sponsor Only)",
  },
  {
    id: "pbm",
    label: "CMS PBM Spreads",
    icon: Info,
    color: "#FF4D6D",
    tag: "PBM Policy",
    description: "CMS PBM pricing/spread data instructions. DIR reporting, rebate pass-through, point-of-sale rules.",
    auth: "Reference",
  },
  {
    id: "usaspending",
    label: "USAspending",
    icon: DollarSign,
    color: "#00A8FF",
    tag: "Procurement",
    description: "Transaction-level federal spend. Procurement analytics, vendor benchmarking.",
    auth: "Public",
  },
  {
    id: "sam",
    label: "SAM.gov Opportunities",
    icon: ShoppingBag,
    color: "#00FF94",
    tag: "Procurement",
    description: "Federal contract opportunities. Market pricing signals, vendor landscape, sourcing pipeline.",
    auth: "API Key (Free)",
  },
  {
    id: "gsa",
    label: "GSA CALC+",
    icon: Calculator,
    color: "#A855F7",
    tag: "Labor Rates",
    description: "SIN 541 professional services labor rate benchmarks across thousands of GSA schedule holders.",
    auth: "Public",
  },
];

function TagBadge({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
      {text}
    </span>
  );
}

function AuthBadge({ text }: { text: string }) {
  const isPublic = text === "Public";
  const isRef = text === "Reference";
  const color = isPublic ? "#00FF94" : isRef ? "#FFB800" : "#FF4D6D";
  const Icon = isPublic ? CheckCircle : isRef ? Info : AlertCircle;
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold"
      style={{ color }}>
      <Icon size={10} />{text}
    </span>
  );
}

function ResultTable({ data, cols }: { data: any[]; cols: { key: string; label: string }[] }) {
  if (!data?.length) return <p className="text-xs text-muted-foreground italic py-4 text-center">No results</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-white/10">
            {cols.map(c => (
              <th key={c.key} className="text-left py-2 pr-4 font-bold text-muted-foreground uppercase tracking-wider text-[9px]">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
              {cols.map(c => (
                <td key={c.key} className="py-2 pr-4 text-white/80 font-mono max-w-[200px] truncate">
                  {c.key === "url" || c.key === "edgar_url" ? (
                    <a href={row[c.key]} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                      Open <ExternalLink size={9} />
                    </a>
                  ) : (
                    String(row[c.key] ?? "—").slice(0, 80)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SECPanel() {
  const [q, setQ] = useState("pharmaceutical");
  const [input, setInput] = useState("pharmaceutical");
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/feeds/sec/search", q],
    queryFn: async () => {
      const r = await fetch(`/api/feeds/sec/search?q=${encodeURIComponent(q)}&limit=10`);
      return r.json();
    },
    enabled: !!q,
  });
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/30"
          placeholder="Company name or keyword…" data-testid="sec-search-input" />
        <button type="submit" data-testid="sec-search-btn"
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "rgba(0,168,255,0.15)", border: "1px solid rgba(0,168,255,0.3)", color: "#00A8FF" }}>
          Search
        </button>
      </form>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Querying SEC EDGAR…</p>}
      <ApiNote note={data?.note} reference={data?.reference} />
      {data?.results?.length > 0 && (
        <ResultTable data={data.results} cols={[
          { key: "company", label: "Company" },
          { key: "form", label: "Form" },
          { key: "filed", label: "Filed" },
          { key: "description", label: "Period" },
          { key: "edgar_url", label: "View" },
        ]} />
      )}
    </div>
  );
}

function ApiNote({ note, reference }: { note?: string; reference?: string }) {
  if (!note) return null;
  return (
    <div className="p-3 rounded-xl flex items-start gap-2"
      style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)" }}>
      <AlertCircle size={14} style={{ color: "#FFB800" }} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-[#FFB800]">{note}</p>
        {reference && (
          <a href={reference} target="_blank" rel="noopener noreferrer"
            className="text-[11px] underline text-[#FFB800]/70 hover:text-[#FFB800]">
            Browse datasets directly →
          </a>
        )}
      </div>
    </div>
  );
}

function NADACPanel() {
  const [drug, setDrug] = useState("metformin");
  const [input, setInput] = useState("metformin");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/feeds/nadac/search", drug],
    queryFn: async () => {
      const r = await fetch(`/api/feeds/nadac/search?drug=${encodeURIComponent(drug)}&limit=20`);
      return r.json();
    },
    enabled: !!drug,
  });
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setDrug(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00FF94]/30"
          placeholder="Drug name (e.g. metformin, atorvastatin)…" data-testid="nadac-search-input" />
        <button type="submit" data-testid="nadac-search-btn"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(0,255,148,0.15)", border: "1px solid rgba(0,255,148,0.3)", color: "#00FF94" }}>
          Search
        </button>
      </form>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Querying NADAC (Medicaid.gov)…</p>}
      <ApiNote note={data?.note} reference={data?.reference} />
      {data?.results?.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            {data.count} price changes · weekly comparison file (download.medicaid.gov)
          </p>
          <ResultTable data={data.results} cols={[
            { key: "drug", label: "Drug" },
            { key: "ndc", label: "NDC" },
            { key: "old_nadac_per_unit", label: "Old $/Unit" },
            { key: "new_nadac_per_unit", label: "New $/Unit" },
            { key: "percent_change", label: "% Chg" },
            { key: "primary_reason", label: "Reason" },
            { key: "effective_date", label: "Effective" },
          ]} />
        </>
      )}
    </div>
  );
}

function CMSPanel() {
  const [kw, setKw] = useState("Part D");
  const [input, setInput] = useState("Part D");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/feeds/cms/datasets", kw],
    queryFn: async () => {
      const r = await fetch(`/api/feeds/cms/datasets?keyword=${encodeURIComponent(kw)}&limit=12`);
      return r.json();
    },
    enabled: !!kw,
  });
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setKw(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A855F7]/30"
          placeholder="Dataset keyword (e.g. Part D, provider)…" data-testid="cms-search-input" />
        <button type="submit" data-testid="cms-search-btn"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#A855F7" }}>
          Search
        </button>
      </form>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Querying CMS Data API…</p>}
      <ApiNote note={data?.note} reference={data?.reference} />
      {data?.datasets?.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            {data.count} results
            {data.total_available ? ` · ${data.total_available} total datasets in catalog` : ""}
          </p>
          <ResultTable data={data.datasets} cols={[
            { key: "title", label: "Dataset" },
            { key: "modified", label: "Modified" },
            { key: "description", label: "Description" },
            { key: "url", label: "View" },
          ]} />
        </>
      )}
    </div>
  );
}

function AB2DPanel() {
  const { data } = useQuery<any>({
    queryKey: ["/api/feeds/cms/ab2d/info"],
    queryFn: async () => {
      const r = await fetch("/api/feeds/cms/ab2d/info");
      return r.json();
    },
  });
  if (!data) return <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/80 leading-relaxed">{data.description}</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Eligibility", value: data.eligibility },
          { label: "Auth Method", value: data.auth },
          { label: "Data Format", value: data.data_format },
          { label: "Documentation", value: data.documentation },
        ].map(item => (
          <div key={item.label} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">{item.label}</p>
            <p className="text-xs text-white/80">{item.value}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Use Cases</p>
        <ul className="space-y-1">
          {data.use_cases?.map((u: string) => (
            <li key={u} className="flex items-center gap-2 text-xs text-white/70">
              <ChevronRight size={12} style={{ color: "#FFB800" }} />{u}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Endpoints</p>
        {Object.entries(data.endpoints || {}).map(([env, url]) => (
          <div key={env} className="flex items-start gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold w-20 text-muted-foreground">{env}</span>
            <code className="text-[10px] text-[#FFB800] break-all">{String(url)}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

function PBMPanel() {
  const { data } = useQuery<any>({
    queryKey: ["/api/feeds/cms/pbm/policy"],
    queryFn: async () => {
      const r = await fetch("/api/feeds/cms/pbm/policy");
      return r.json();
    },
  });
  if (!data) return <p className="text-xs text-muted-foreground animate-pulse">Loading…</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-muted-foreground">Regulatory Basis: <span className="text-white">{data.regulatory_basis}</span></p>
      <div className="space-y-3">
        {data.reporting_requirements?.map((r: any) => (
          <div key={r.item} className="p-3 rounded-xl" style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.15)" }}>
            <p className="text-sm font-bold text-white mb-1">{r.item}</p>
            <p className="text-xs text-white/60 mb-1">{r.definition}</p>
            <p className="text-[11px] font-semibold" style={{ color: "#FF4D6D" }}>CMS: {r.cms_requirement}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Key Rules</p>
        <ul className="space-y-1">
          {data.key_rules?.map((r: string) => (
            <li key={r} className="flex items-start gap-2 text-xs text-white/70">
              <ChevronRight size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#FF4D6D" }} />{r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function USASpendingPanel() {
  const [kw, setKw] = useState("pharmaceutical");
  const [input, setInput] = useState("pharmaceutical");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/feeds/usaspending/search", kw],
    queryFn: async () => {
      const r = await fetch(`/api/feeds/usaspending/search?keyword=${encodeURIComponent(kw)}&limit=10`);
      return r.json();
    },
    enabled: !!kw,
  });
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setKw(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8FF]/30"
          placeholder="Keyword (e.g. pharmaceutical, healthcare IT)…" data-testid="usaspending-search-input" />
        <button type="submit" data-testid="usaspending-search-btn"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(0,168,255,0.15)", border: "1px solid rgba(0,168,255,0.3)", color: "#00A8FF" }}>
          Search
        </button>
      </form>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Querying USAspending.gov…</p>}
      {data && (
        <div>
          {(data.results?.length > 0 || data.count > 0) && (
            <p className="text-xs text-muted-foreground mb-2">
              {data.results?.length || data.count} awards returned
              {data.total > 0 ? ` · ${Number(data.total).toLocaleString()} total matching "${kw}"` : ` matching "${kw}"`}
            </p>
          )}
          <ApiNote note={data?.note} reference={data?.reference} />
          <ResultTable data={data.results || []} cols={[
            { key: "Recipient Name", label: "Recipient" },
            { key: "Award Amount", label: "Amount" },
            { key: "Award Type", label: "Type" },
            { key: "Awarding Agency", label: "Agency" },
            { key: "Start Date", label: "Date" },
            { key: "Description", label: "Description" },
          ]} />
        </div>
      )}
    </div>
  );
}

function SAMPanel() {
  const [kw, setKw] = useState("healthcare IT");
  const [input, setInput] = useState("healthcare IT");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/feeds/sam/opportunities", kw],
    queryFn: async () => {
      const r = await fetch(`/api/feeds/sam/opportunities?keyword=${encodeURIComponent(kw)}&limit=10`);
      return r.json();
    },
    enabled: !!kw,
  });
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setKw(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00FF94]/30"
          placeholder="Contract keyword (e.g. healthcare IT, consulting)…" data-testid="sam-search-input" />
        <button type="submit" data-testid="sam-search-btn"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(0,255,148,0.15)", border: "1px solid rgba(0,255,148,0.3)", color: "#00FF94" }}>
          Search
        </button>
      </form>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Querying SAM.gov…</p>}
      {data && (
        <div>
          {data.note && (
            <div className="p-3 rounded-xl mb-3 flex items-start gap-2"
              style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.2)" }}>
              <AlertCircle size={14} style={{ color: "#FFB800" }} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-[#FFB800] font-semibold">{data.note}</p>
                <a href={data.register_url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] underline text-[#FFB800]/70 hover:text-[#FFB800]">
                  Register for a free API key →
                </a>
              </div>
            </div>
          )}
          {data.results?.length > 0 && (
            <ResultTable data={data.results} cols={[
              { key: "title", label: "Opportunity" },
              { key: "agency", label: "Agency" },
              { key: "naics", label: "NAICS" },
              { key: "type", label: "Type" },
              { key: "posted", label: "Posted" },
              { key: "response_deadline", label: "Deadline" },
              { key: "url", label: "View" },
            ]} />
          )}
        </div>
      )}
    </div>
  );
}

function GSAPanel() {
  const [q, setQ] = useState("data analyst");
  const [input, setInput] = useState("data analyst");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/feeds/gsa/rates", q],
    queryFn: async () => {
      const r = await fetch(`/api/feeds/gsa/rates?q=${encodeURIComponent(q)}&limit=20`);
      return r.json();
    },
    enabled: !!q,
  });
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(input); }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A855F7]/30"
          placeholder="Labor category (e.g. data analyst, program manager)…" data-testid="gsa-search-input" />
        <button type="submit" data-testid="gsa-search-btn"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#A855F7" }}>
          Search
        </button>
      </form>
      {isLoading && <p className="text-xs text-muted-foreground animate-pulse">Querying GSA CALC+…</p>}
      {data && (
        <div>
          {data.total !== undefined && (
            <p className="text-xs text-muted-foreground mb-2">
              {data.total.toLocaleString()} rate records · {data.experience} experience
            </p>
          )}
          <ResultTable data={data.results || []} cols={[
            { key: "labor_category", label: "Labor Category" },
            { key: "price_year_1", label: "Rate (Yr 1)" },
            { key: "education", label: "Education" },
            { key: "min_years_experience", label: "Min Exp" },
            { key: "max_years_experience", label: "Max Exp" },
            { key: "sin", label: "SIN" },
            { key: "vendor", label: "Vendor" },
          ]} />
        </div>
      )}
    </div>
  );
}

const PANELS: Record<string, () => JSX.Element> = {
  sec:         SECPanel,
  nadac:       NADACPanel,
  cms:         CMSPanel,
  ab2d:        AB2DPanel,
  pbm:         PBMPanel,
  usaspending: USASpendingPanel,
  sam:         SAMPanel,
  gsa:         GSAPanel,
};

export default function DataIntelligence() {
  const [active, setActive] = useState("sec");
  const ActivePanel = PANELS[active];
  const activeFeed = FEEDS.find(f => f.id === active)!;

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(0,168,255,0.2), rgba(168,85,247,0.2))", border: "1px solid rgba(0,168,255,0.3)" }}>
            <Database size={20} style={{ color: "#00A8FF" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              Data Intelligence Hub
            </h1>
            <p className="text-sm" style={{ color: "rgba(140,170,220,0.6)" }}>
              Live feeds from 8 government &amp; public data APIs — SEC, CMS, NADAC, USAspending, SAM.gov, GSA CALC
            </p>
          </div>
        </div>

        {/* Feed selector cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FEEDS.map(feed => {
            const Icon = feed.icon;
            const isActive = active === feed.id;
            return (
              <button
                key={feed.id}
                data-testid={`feed-btn-${feed.id}`}
                onClick={() => setActive(feed.id)}
                className="text-left p-3 rounded-xl transition-all duration-150 hover:scale-[1.02]"
                style={{
                  background: isActive ? `${feed.color}14` : "rgba(255,255,255,0.03)",
                  border: isActive ? `1px solid ${feed.color}50` : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? `0 0 16px ${feed.color}18` : "none",
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${feed.color}20`, border: `1px solid ${feed.color}35` }}>
                    <Icon size={13} style={{ color: feed.color }} />
                  </div>
                  <TagBadge text={feed.tag} color={feed.color} />
                </div>
                <p className="text-xs font-bold text-white mb-0.5">{feed.label}</p>
                <AuthBadge text={feed.auth} />
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${activeFeed.color}22`, backdropFilter: "blur(12px)" }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <activeFeed.icon size={16} style={{ color: activeFeed.color }} />
                <h2 className="text-base font-bold text-white">{activeFeed.label}</h2>
                <TagBadge text={activeFeed.tag} color={activeFeed.color} />
              </div>
              <p className="text-xs text-muted-foreground">{activeFeed.description}</p>
            </div>
            <AuthBadge text={activeFeed.auth} />
          </div>

          <div className="border-t border-white/5 pt-4">
            <ActivePanel />
          </div>
        </div>

        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">
            All data sourced live from official U.S. government APIs · SEC EDGAR · data.medicaid.gov · data.cms.gov · usaspending.gov · sam.gov · calc.gsa.gov
          </p>
        </div>

      </div>
    </Layout>
  );
}
