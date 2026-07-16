import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, Pill, DollarSign, Building2, User, ChevronDown, ChevronRight,
  ExternalLink, AlertCircle, CheckCircle2, Info, Activity, FileText,
  Hash, Package, Stethoscope, ClipboardList, Brain, ShieldAlert,
  TrendingUp, Zap, Flag, Target, BookOpen, ChevronUp
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const BG    = "#F8FAFC";
const CARD  = "#0d1033";
const CARD2 = "#111540";
const BORDER= "#e2e8f0";
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

type Tab = "rxnorm" | "open-payments" | "drug-spending" | "npi" | "pa-iq";

const TABS: { id: Tab; label: string; icon: any; desc: string }[] = [
  { id: "rxnorm",        label: "Drug Lookup",    icon: Pill,          desc: "RxNorm canonical names, generics, biosimilars & NDC codes" },
  { id: "open-payments", label: "Open Payments",  icon: DollarSign,    desc: "CMS Sunshine Act — manufacturer payments to physicians" },
  { id: "drug-spending", label: "Drug Spending",  icon: Activity,      desc: "Medicare Part D benchmark pricing by drug" },
  { id: "npi",           label: "Provider Lookup",icon: Stethoscope,   desc: "NPI Registry + PECOS Medicare enrollment status" },
  { id: "pa-iq",         label: "PA IQ™",         icon: Brain,         desc: "AI-powered prior authorization fiduciary intelligence — 6-section structured analysis" },
];

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}30`,
      borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700,
      letterSpacing: 0.4, textTransform: "uppercase",
    }}>{label}</span>
  );
}

function DataRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  const display = typeof value === "number" ? (value > 999 ? `$${value.toLocaleString()}` : String(value)) : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ color: TEXT2, fontSize: 11, fontWeight: 600 }}>{label}</span>
      <span style={{ color: TEXT1, fontSize: 11, fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{display}</span>
    </div>
  );
}

function Section({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: any }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 18px",
          background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <Icon size={16} color={color} />
        <span style={{ color: TEXT1, fontWeight: 700, fontSize: 13, flex: 1 }}>{title}</span>
        {open ? <ChevronDown size={14} color={TEXT2}/> : <ChevronRight size={14} color={TEXT2}/>}
      </button>
      {open && <div style={{ padding: "0 18px 16px" }}>{children}</div>}
    </div>
  );
}

/* ── RxNorm Tab ──────────────────────────────────────────────────────────────── */
function RxNormTab() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["/api/cms/rxnorm", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/cms/rxnorm?drug=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const EXAMPLES = ["Humira", "Ozempic", "Lipitor", "Eliquis", "Keytruda", "Adalimumab"];

  return (
    <div>
      <div style={{ background: `${ROSE}12`, border: `1px solid ${ROSE}28`, borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Info size={13} color={ROSE}/>
          <span style={{ color: ROSE, fontSize: 11, fontWeight: 700 }}>NIH RxNorm API — No Key Required</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          Look up any drug by brand or generic name. Returns canonical RxCUI identifier, all generic equivalents,
          brand names, and NDC codes. Essential for formulary normalization and biosimilar identification.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT2 }}/>
          <input
            data-testid="input-rxnorm-drug"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && query.trim() && setSearch(query.trim())}
            placeholder="Drug name (brand or generic)…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 13 }}
          />
        </div>
        <button
          data-testid="button-rxnorm-search"
          onClick={() => query.trim() && setSearch(query.trim())}
          disabled={isFetching}
          style={{ height: 40, padding: "0 20px", background: ROSE, border: "none", borderRadius: 8,
            color: "#0F172A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isFetching ? "…" : "Lookup"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); setSearch(ex); }}
            data-testid={`button-rxnorm-example-${ex.toLowerCase()}`}
            style={{ background: `${ACCENT}12`, border: `1px solid ${ACCENT}28`, borderRadius: 20,
              color: ACCENT, fontSize: 11, fontWeight: 600, padding: "4px 12px", cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      {data && !data.found && (
        <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}30`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ color: AMBER, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>No match found for "{data.query}"</div>
          {data.spelling_suggestions?.length > 0 && (
            <div style={{ color: TEXT2, fontSize: 11 }}>
              Did you mean: {data.spelling_suggestions.map((s: string) => (
                <button key={s} onClick={() => { setQuery(s); setSearch(s); }}
                  style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "0 4px" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {data?.found && (
        <>
          <div style={{ background: `${TEAL}12`, border: `1px solid ${TEAL}30`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <CheckCircle2 size={18} color={GREEN}/>
              <span style={{ color: TEXT1, fontWeight: 800, fontSize: 15 }}>RxCUI: {data.rxcui}</span>
              <a href={data.rxnav_url} target="_blank" rel="noopener noreferrer"
                style={{ color: TEAL, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <ExternalLink size={12}/> View in RxNav
              </a>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {data.drugs?.slice(0,4).map((d: any) => (
                <Chip key={d.rxcui} label={d.tty} color={TEAL} bg={`${TEAL}18`}/>
              ))}
            </div>
          </div>

          <Section title={`Generic Names (${data.generics?.length || 0})`} icon={Package} color={GREEN}>
            {data.generics?.length > 0
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 6 }}>
                  {data.generics.map((g: string) => (
                    <span key={g} style={{ background: `${GREEN}18`, color: GREEN, border: `1px solid ${GREEN}30`,
                      borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{g}</span>
                  ))}
                </div>
              : <p style={{ color: TEXT2, fontSize: 11, margin: "6px 0 0" }}>No generic equivalents found.</p>
            }
          </Section>

          <Section title={`Brand Names (${data.brand_names?.length || 0})`} icon={FileText} color={PURPLE}>
            {data.brand_names?.length > 0
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 6 }}>
                  {data.brand_names.map((b: string) => (
                    <span key={b} style={{ background: `${PURPLE}18`, color: PURPLE, border: `1px solid ${PURPLE}30`,
                      borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{b}</span>
                  ))}
                </div>
              : <p style={{ color: TEXT2, fontSize: 11, margin: "6px 0 0" }}>No brand names found.</p>
            }
          </Section>

          <Section title={`NDC Codes (${data.ndc_codes?.length || 0})`} icon={Hash} color={AMBER}>
            {data.ndc_codes?.length > 0
              ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 6 }}>
                  {data.ndc_codes.map((n: string) => (
                    <span key={n} style={{ background: `${AMBER}18`, color: AMBER, border: `1px solid ${AMBER}30`,
                      borderRadius: 4, padding: "3px 10px", fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>{n}</span>
                  ))}
                </div>
              : <p style={{ color: TEXT2, fontSize: 11, margin: "6px 0 0" }}>No NDC codes found.</p>
            }
          </Section>

          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", marginTop: 4 }}>
            <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>
              <strong style={{ color: TEXT1 }}>Biosimilar Note: </strong>
              Check the FDA Purple Book at{" "}
              <a href="https://purplebooksearch.fda.gov" target="_blank" rel="noopener noreferrer"
                style={{ color: ACCENT }}>purplebooksearch.fda.gov</a>
              {" "}for licensed biosimilars. Biosimilar substitution can reduce plan Rx spend 20–80% vs reference biologics.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Open Payments Tab ───────────────────────────────────────────────────────── */
function OpenPaymentsTab() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["/api/cms/open-payments", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/cms/open-payments?name=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const EXAMPLES = ["AbbVie", "Pfizer", "Merck", "Johnson", "Eli Lilly", "AstraZeneca"];

  return (
    <div>
      <div style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}28`, borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Info size={13} color={AMBER}/>
          <span style={{ color: AMBER, fontSize: 11, fontWeight: 700 }}>CMS Open Payments (Sunshine Act) — 42 U.S.C. § 1320a-7h</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          Search any pharmaceutical manufacturer to see payments made to physicians and teaching hospitals.
          Critical for identifying PBM formulary conflicts-of-interest and kickback risk under 42 U.S.C. § 1320a-7b(b).
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT2 }}/>
          <input
            data-testid="input-open-payments-name"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && query.trim() && setSearch(query.trim())}
            placeholder="Manufacturer or company name…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 13 }}
          />
        </div>
        <button
          data-testid="button-open-payments-search"
          onClick={() => query.trim() && setSearch(query.trim())}
          disabled={isFetching}
          style={{ height: 40, padding: "0 20px", background: AMBER, border: "none", borderRadius: 8,
            color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isFetching ? "…" : "Search"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); setSearch(ex); }}
            data-testid={`button-payments-example-${ex.toLowerCase().replace(/\s+/g,"-")}`}
            style={{ background: `${AMBER}12`, border: `1px solid ${AMBER}28`, borderRadius: 20,
              color: AMBER, fontSize: 11, fontWeight: 600, padding: "4px 12px", cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      {data && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Records Found", value: data.total_records, color: data.total_records > 0 ? AMBER : GREEN },
              { label: "Total Payments", value: data.total_payment_amount_usd > 0 ? `$${data.total_payment_amount_usd.toLocaleString()}` : "$0", color: data.total_payment_amount_usd > 0 ? RED : GREEN },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: CARD2, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
                <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
            {data.payment_breakdown_by_nature && Object.keys(data.payment_breakdown_by_nature).length > 0 && (
              <div style={{ flex: 2, background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>By Nature of Payment</div>
                {Object.entries(data.payment_breakdown_by_nature).slice(0,4).map(([k, v]: any) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
                    <span style={{ color: TEXT2 }}>{k || "Other"}</span>
                    <span style={{ color: TEXT1, fontWeight: 700 }}>${Number(v).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {data.records?.length > 0 && (
            <div style={{ overflowX: "auto", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["Manufacturer", "Recipient", "Type", "Nature", "Drug/Device", "Amount", "Date"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", color: TEXT2, fontWeight: 700, textAlign: "left",
                        fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.records.slice(0, 20).map((r: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "transparent" : `${CARD2}80` }}>
                      <td style={{ padding: "8px 12px", color: TEXT1 }}>{r.manufacturer || "—"}</td>
                      <td style={{ padding: "8px 12px", color: TEXT1 }}>{r.recipient_name || "—"}</td>
                      <td style={{ padding: "8px 12px" }}><Chip label={r.recipient_type || "—"} color={TEAL} bg={`${TEAL}15`}/></td>
                      <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.payment_nature || "—"}</td>
                      <td style={{ padding: "8px 12px", color: PURPLE }}>{r.drug_or_device || "—"}</td>
                      <td style={{ padding: "8px 12px", color: AMBER, fontWeight: 700 }}>
                        {r.amount_usd > 0 ? `$${r.amount_usd.toLocaleString()}` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.payment_date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.total_records === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: TEXT2 }}>
              <CheckCircle2 size={36} color={GREEN} style={{ marginBottom: 10 }}/>
              <div style={{ color: TEXT1, fontWeight: 700, marginBottom: 6 }}>No Payment Records Found</div>
              <div style={{ fontSize: 12 }}>No manufacturer payments found for "{data.query}" in the Open Payments database.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Drug Spending Tab ───────────────────────────────────────────────────────── */
function DrugSpendingTab() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["/api/cms/drug-spending", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/cms/drug-spending?drug=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const EXAMPLES = ["Humira", "Eliquis", "Keytruda", "Revlimid", "Ozempic", "Dupixent"];

  return (
    <div>
      <div style={{ background: `${GREEN}12`, border: `1px solid ${GREEN}28`, borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <DollarSign size={13} color={GREEN}/>
          <span style={{ color: GREEN, fontSize: 11, fontWeight: 700 }}>CMS Medicare Part D Drug Spending — Best Free Pricing Benchmark</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          See what Medicare actually pays per drug per claim. Plan formulary costs significantly above Medicare Part D
          rates are a strong signal for PBM pricing audit under ERISA § 404(a)(1)(B) prudent expert standard.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT2 }}/>
          <input
            data-testid="input-drug-spending-name"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && query.trim() && setSearch(query.trim())}
            placeholder="Drug name (brand or generic)…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 13 }}
          />
        </div>
        <button
          data-testid="button-drug-spending-search"
          onClick={() => query.trim() && setSearch(query.trim())}
          disabled={isFetching}
          style={{ height: 40, padding: "0 20px", background: GREEN, border: "none", borderRadius: 8,
            color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {isFetching ? "…" : "Lookup"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); setSearch(ex); }}
            data-testid={`button-spending-example-${ex.toLowerCase()}`}
            style={{ background: `${GREEN}12`, border: `1px solid ${GREEN}28`, borderRadius: 20,
              color: GREEN, fontSize: 11, fontWeight: 600, padding: "4px 12px", cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      {data?.records?.length > 0 && (
        <>
          <div style={{ overflowX: "auto", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["Brand", "Generic", "Manufacturer", "Year", "Avg/Claim", "Avg/Beneficiary", "Total Claims", "Total Spending"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", color: TEXT2, fontWeight: 700, textAlign: "left",
                      fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.records.map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? "transparent" : `${CARD2}80` }}>
                    <td style={{ padding: "8px 12px", color: TEXT1, fontWeight: 700 }}>{r.brand_name || "—"}</td>
                    <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.generic_name || "—"}</td>
                    <td style={{ padding: "8px 12px", color: TEXT2 }}>{r.manufacturer || "—"}</td>
                    <td style={{ padding: "8px 12px", color: TEAL }}>{r.year || "—"}</td>
                    <td style={{ padding: "8px 12px", color: GREEN, fontWeight: 700 }}>
                      {r.avg_spend_per_claim > 0 ? `$${r.avg_spend_per_claim.toLocaleString(undefined, {maximumFractionDigits:2})}` : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: AMBER, fontWeight: 700 }}>
                      {r.avg_spend_per_beneficiary > 0 ? `$${r.avg_spend_per_beneficiary.toLocaleString(undefined, {maximumFractionDigits:2})}` : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: TEXT1 }}>
                      {r.total_claims > 0 ? r.total_claims.toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: TEXT1, fontWeight: 700 }}>
                      {r.total_spending > 0 ? `$${(r.total_spending / 1e6).toFixed(1)}M` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>
              <strong style={{ color: TEXT1 }}>Benchmarking Note: </strong>
              Medicare Part D costs reflect CMS-negotiated pricing. Plan formulary average cost per claim
              significantly above these figures warrants a PBM spread pricing audit and MAC (Maximum Allowable Cost) review.
            </p>
          </div>
        </>
      )}

      {data && data.total_results === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: TEXT2 }}>
          <AlertCircle size={36} color={AMBER} style={{ marginBottom: 10 }}/>
          <div style={{ color: TEXT1, fontWeight: 700, marginBottom: 6 }}>Drug Not Found in Part D Database</div>
          <div style={{ fontSize: 12 }}>"{data.query}" may not be covered under Medicare Part D, or try the brand/generic name variant.</div>
        </div>
      )}
    </div>
  );
}

/* ── NPI / PECOS Tab ─────────────────────────────────────────────────────────── */
function NpiTab() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const { data: npiData, isFetching: npiLoading } = useQuery({
    queryKey: ["/api/cms/npi", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/cms/npi?name=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const { data: pecosData, isFetching: pecosLoading } = useQuery({
    queryKey: ["/api/cms/pecos", search],
    queryFn: async () => {
      if (!search) return null;
      const r = await fetch(`/api/cms/pecos?name=${encodeURIComponent(search)}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!search,
  });

  const EXAMPLES = ["CVS", "Aetna", "Cigna", "UnitedHealth", "Humana", "Optum"];

  return (
    <div>
      <div style={{ background: `${PURPLE}12`, border: `1px solid ${PURPLE}28`, borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Stethoscope size={13} color={PURPLE}/>
          <span style={{ color: PURPLE, fontSize: 11, fontWeight: 700 }}>NPI Registry + PECOS — CMS Provider Identity Verification</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          Verify healthcare provider identity via NPPES (NPI) and Medicare enrollment status via PECOS.
          Cross-reference results against OIG LEIE exclusion to confirm active excluded providers.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: TEXT2 }}/>
          <input
            data-testid="input-npi-name"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && query.trim() && setSearch(query.trim())}
            placeholder="Organization name or provider name…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, height: 40, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 13 }}
          />
        </div>
        <button
          data-testid="button-npi-search"
          onClick={() => query.trim() && setSearch(query.trim())}
          disabled={npiLoading || pecosLoading}
          style={{ height: 40, padding: "0 20px", background: PURPLE, border: "none", borderRadius: 8,
            color: "#0F172A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {(npiLoading || pecosLoading) ? "…" : "Search"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => { setQuery(ex); setSearch(ex); }}
            data-testid={`button-npi-example-${ex.toLowerCase()}`}
            style={{ background: `${PURPLE}12`, border: `1px solid ${PURPLE}28`, borderRadius: 20,
              color: PURPLE, fontSize: 11, fontWeight: 600, padding: "4px 12px", cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>

      {npiData && (
        <Section title={`NPI Registry — ${npiData.total_results || 0} Providers Found`} icon={User} color={PURPLE}>
          {npiData.records?.length > 0
            ? <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
                {npiData.records.map((r: any, i: number) => (
                  <div key={i} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <span style={{ color: TEXT1, fontWeight: 700, fontSize: 12 }}>{r.organization_name || "—"}</span>
                        <span style={{ color: TEXT2, fontSize: 10, marginLeft: 8 }}>NPI: {r.npi}</span>
                      </div>
                      <Chip
                        label={r.status === "A" ? "Active" : r.status || "Unknown"}
                        color={r.status === "A" ? GREEN : AMBER}
                        bg={r.status === "A" ? `${GREEN}18` : `${AMBER}18`}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <DataRow label="Taxonomy" value={r.taxonomy_desc}/>
                    </div>
                    <div style={{ color: TEXT2, fontSize: 10, marginTop: 4 }}>
                      {[r.city, r.state].filter(Boolean).join(", ")} · Enrolled: {r.enumeration_date || "—"}
                    </div>
                  </div>
                ))}
              </div>
            : <p style={{ color: TEXT2, fontSize: 11, margin: "8px 0 0" }}>No NPI records found for this entity.</p>
          }
        </Section>
      )}

      {pecosData && (
        <Section
          title={`PECOS Enrollment — ${pecosData.total_results || 0} Records${pecosData.has_terminated_enrollments ? " ⚠ Terminated Found" : ""}`}
          icon={ClipboardList}
          color={pecosData.has_terminated_enrollments ? RED : GREEN}
        >
          {pecosData.has_terminated_enrollments && (
            <div style={{ background: `${RED}12`, border: `1px solid ${RED}30`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, marginTop: 8 }}>
              <span style={{ color: RED, fontSize: 11, fontWeight: 700 }}>
                ⚠ {pecosData.terminated_count} terminated Medicare enrollment(s) found.
                This may correlate with OIG exclusion or voluntary withdrawal. Verify independently.
              </span>
            </div>
          )}
          {pecosData.records?.length > 0
            ? <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
                {pecosData.records.map((r: any, i: number) => (
                  <div key={i} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <span style={{ color: TEXT1, fontWeight: 700, fontSize: 12 }}>{r.provider_name || "—"}</span>
                      <Chip
                        label={r.terminated ? "Terminated" : "Active"}
                        color={r.terminated ? RED : GREEN}
                        bg={r.terminated ? `${RED}18` : `${GREEN}18`}
                      />
                    </div>
                    <div style={{ color: TEXT2, fontSize: 10 }}>
                      {r.provider_type} · {[r.city, r.state].filter(Boolean).join(", ")}
                      {r.termination_date && <span style={{ color: RED }}> · Terminated: {r.termination_date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            : <p style={{ color: TEXT2, fontSize: 11, margin: "8px 0 0" }}>No PECOS records found for this entity.</p>
          }
        </Section>
      )}
    </div>
  );
}

/* ── PA IQ Tab ───────────────────────────────────────────────────────────────── */

const RISK_COLORS: Record<string, string> = {
  HIGH: RED, ELEVATED: AMBER, MODERATE: PURPLE, LOW: GREEN,
};
const URGENCY_COLORS: Record<string, string> = {
  IMMEDIATE: RED, "48H": AMBER, "7 DAYS": PURPLE, "30 DAYS": TEAL,
};
const GRADE_COLORS: Record<string, string> = {
  A: GREEN, B: TEAL, C: AMBER, D: RED,
};

const PA_SCENARIOS = [
  {
    label: "GLP-1 Obesity Denial",
    drug_name: "Wegovy (Semaglutide 2.4mg)",
    diagnosis: "E66.09 — Morbid obesity due to excess calories, BMI 38, comorbid hypertension and pre-diabetes",
    denial_reason: "Step therapy required — must try and fail metformin and phentermine first. Non-formulary exclusion under plan's weight management exclusion clause.",
    pbm_name: "CVS Caremark",
    plan_type: "ERISA self-funded employer plan, 2,400 employees",
    annual_drug_cost: "$15,000 per member per year",
    employees_affected: "87 members identified on claims data",
  },
  {
    label: "Specialty Oncology PA",
    drug_name: "Keytruda (Pembrolizumab) 200mg IV q3wks",
    diagnosis: "C34.12 — Malignant neoplasm of left upper lobe bronchus, Stage IIIB NSCLC, PD-L1 ≥50%",
    denial_reason: "Medical necessity denied — PBM clinical team overriding oncologist recommendation. Site-of-care restriction requiring hospital outpatient rather than physician office infusion.",
    pbm_name: "Express Scripts (ESI)",
    plan_type: "Fully insured BCBS large group plan",
    annual_drug_cost: "$186,000 per member annually",
    employees_affected: "3 members currently denied",
  },
  {
    label: "Mental Health Parity Violation",
    drug_name: "Suboxone (Buprenorphine/Naloxone) — SUD Treatment",
    diagnosis: "F11.20 — Opioid use disorder, moderate severity, ASAM Level 2.1 criteria met",
    denial_reason: "PA denied — quantity limit of 16mg/day. Plan requires PA every 90 days vs no PA requirement for comparable chronic disease medications. Step therapy requiring inpatient detox first.",
    pbm_name: "OptumRx",
    plan_type: "ERISA self-funded plan, 800 employees, Texas",
    annual_drug_cost: "$4,200 per member annually",
    employees_affected: "12 members in SUD treatment",
  },
  {
    label: "Biosimilar Substitution Block",
    drug_name: "Humira (Adalimumab) — Brand, DAW-1",
    diagnosis: "M05.79 — Rheumatoid arthritis with rheumatoid factor, multiple sites, moderate-severe",
    denial_reason: "Plan forcing brand Humira despite 14 FDA-approved biosimilars available at 20-80% lower cost. PBM has rebate agreement with AbbVie creating formulary preference conflict. Biosimilar PA denied — 'not therapeutically equivalent' per PBM clinical policy.",
    pbm_name: "Prime Therapeutics",
    plan_type: "Taft-Hartley multiemployer plan, 3,200 participants",
    annual_drug_cost: "$72,000 brand vs $14,000-22,000 biosimilar per member",
    employees_affected: "43 members on adalimumab therapy",
  },
];

function PaAnalysisSection({ title, icon: Icon, color, children }: {
  title: string; icon: any; color: string; children: any;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: CARD, border: `1px solid ${color}30`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 18px",
          background: `${color}08`, border: "none", cursor: "pointer", textAlign: "left", borderBottom: open ? `1px solid ${color}20` : "none" }}>
        <Icon size={15} color={color}/>
        <span style={{ color: TEXT1, fontWeight: 700, fontSize: 12, flex: 1, textTransform: "uppercase", letterSpacing: 0.6 }}>{title}</span>
        {open ? <ChevronUp size={13} color={TEXT2}/> : <ChevronDown size={13} color={TEXT2}/>}
      </button>
      {open && <div style={{ padding: "14px 18px" }}>{children}</div>}
    </div>
  );
}

function PaIqTab() {
  const [form, setForm] = useState({
    drug_name: "",
    diagnosis: "",
    denial_reason: "",
    pbm_name: "",
    plan_type: "",
    patient_age: "",
    plan_state: "",
    additional_context: "",
    annual_drug_cost: "",
    employees_affected: "",
  });
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const r = await apiRequest("POST", "/api/cms/pa-analyze", payload);
      return r.json();
    },
    onSuccess: (data) => setResult(data),
  });

  function loadScenario(s: typeof PA_SCENARIOS[number]) {
    setForm({
      drug_name: s.drug_name,
      diagnosis: s.diagnosis,
      denial_reason: s.denial_reason || "",
      pbm_name: s.pbm_name || "",
      plan_type: s.plan_type || "",
      patient_age: "",
      plan_state: "",
      additional_context: "",
      annual_drug_cost: s.annual_drug_cost || "",
      employees_affected: s.employees_affected || "",
    });
    setResult(null);
  }

  function Field({ label, field, placeholder, rows }: {
    label: string; field: keyof typeof form; placeholder: string; rows?: number;
  }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", color: TEXT2, fontSize: 10, fontWeight: 700,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>{label}</label>
        {rows ? (
          <textarea
            data-testid={`input-pa-${field}`}
            value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            placeholder={placeholder}
            rows={rows}
            style={{ width: "100%", padding: "10px 12px", background: CARD2, border: `1px solid ${BORDER}`,
              borderRadius: 8, color: TEXT1, fontSize: 12, resize: "vertical", minHeight: 70,
              fontFamily: "inherit", boxSizing: "border-box" }}
          />
        ) : (
          <input
            data-testid={`input-pa-${field}`}
            value={form[field]}
            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
            placeholder={placeholder}
            style={{ width: "100%", padding: "10px 12px", height: 38, background: CARD2,
              border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT1, fontSize: 12, boxSizing: "border-box" }}
          />
        )}
      </div>
    );
  }

  const analysis = result?.analysis;

  return (
    <div>
      {/* Header banner */}
      <div style={{ background: `linear-gradient(135deg, ${ROSE}20, ${PURPLE}12)`,
        border: `1px solid ${ROSE}30`, borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Brain size={18} color={ROSE}/>
          <span style={{ color: ROSE, fontSize: 13, fontWeight: 800 }}>PA IQ™ — Prior Authorization Fiduciary Intelligence</span>
          <span style={{ background: `${ROSE}28`, color: ROSE, borderRadius: 20, padding: "2px 8px",
            fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>CLAUDE AI</span>
        </div>
        <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
          Powered by the Kincaid Health fiduciary intelligence engine. Transforms PA denial scenarios into
          structured economic impact analysis, root cause mapping, and ERISA-grounded appeal strategy.
          Not a chatbot — a deterministic fiduciary decision layer.
        </p>
      </div>

      {/* Example scenarios */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: 0.5, marginBottom: 8 }}>Load Example Scenario</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PA_SCENARIOS.map((s, i) => (
            <button key={i}
              data-testid={`button-pa-scenario-${i}`}
              onClick={() => loadScenario(s)}
              style={{ background: `${ROSE}12`, border: `1px solid ${ROSE}28`, borderRadius: 8,
                color: TEXT1, fontSize: 11, fontWeight: 600, padding: "6px 12px", cursor: "pointer",
                textAlign: "left", maxWidth: 200 }}>
              <span style={{ color: ROSE, fontSize: 9, fontWeight: 800, display: "block",
                textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>Scenario {i+1}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ color: TEXT1, fontSize: 12, fontWeight: 700, marginBottom: 14,
          textTransform: "uppercase", letterSpacing: 0.5 }}>PA Scenario Input</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Field label="Drug / Therapy *" field="drug_name" placeholder="e.g. Wegovy (Semaglutide 2.4mg)"/>
          <Field label="PBM / Carrier" field="pbm_name" placeholder="e.g. CVS Caremark, OptumRx, ESI"/>
        </div>

        <Field label="Clinical Diagnosis (ICD-10 or description) *" field="diagnosis"
          placeholder="e.g. E66.09 — Morbid obesity, BMI 38, comorbid hypertension and pre-diabetes" rows={2}/>

        <Field label="Denial Reason / PA Status" field="denial_reason"
          placeholder="e.g. Step therapy required — must fail metformin first. Non-formulary, medical necessity denial..." rows={3}/>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" }}>
          <Field label="Plan Type" field="plan_type" placeholder="e.g. ERISA self-funded, 2,400 lives"/>
          <Field label="Annual Drug Cost" field="annual_drug_cost" placeholder="e.g. $15,000/member/yr"/>
          <Field label="Members Affected" field="employees_affected" placeholder="e.g. 87 members"/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          <Field label="Patient Age / Demographics" field="patient_age" placeholder="e.g. 42F, no prior treatment failures"/>
          <Field label="State / Jurisdiction" field="plan_state" placeholder="e.g. Texas, ERISA preempts state mandates"/>
        </div>

        <Field label="Additional Context" field="additional_context"
          placeholder="Any additional clinical, contractual, or operational context relevant to the PA decision…" rows={2}/>

        <button
          data-testid="button-pa-analyze"
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending || !form.drug_name || !form.diagnosis}
          style={{
            width: "100%", height: 44, background: mutation.isPending ? `${ROSE}60` : ROSE,
            border: "none", borderRadius: 10, color: "#0F172A", fontSize: 13, fontWeight: 800,
            cursor: mutation.isPending || !form.drug_name ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            letterSpacing: 0.3,
          }}>
          <Brain size={17}/>
          {mutation.isPending ? "Kincaid Health Analyzing…" : "Run PA IQ™ Analysis"}
        </button>
      </div>

      {/* Error state */}
      {result?.status === "ERROR" && (
        <div style={{ background: `${RED}12`, border: `1px solid ${RED}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ color: RED, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Analysis Error</div>
          <div style={{ color: TEXT2, fontSize: 11 }}>{result.error}</div>
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div>
          {/* Intelligence Summary Bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140, background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.5, marginBottom: 6 }}>Intelligence Grade</div>
              <div style={{ color: GRADE_COLORS[analysis.intelligence_grade] || TEXT1, fontSize: 28, fontWeight: 900 }}>
                {analysis.intelligence_grade}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.5, marginBottom: 6 }}>Fiduciary Risk</div>
              <div style={{ color: RISK_COLORS[analysis.economic_impact?.fiduciary_risk_level] || AMBER,
                fontSize: 15, fontWeight: 900 }}>
                {analysis.economic_impact?.fiduciary_risk_level || "—"}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: CARD, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.5, marginBottom: 6 }}>Denial Pattern</div>
              <div style={{ color: PURPLE, fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>
                {analysis.intelligence_output?.denial_pattern_category || "—"}
              </div>
            </div>
            <div style={{ flex: 2, minWidth: 200, background: `${ROSE}12`, border: `1px solid ${ROSE}30`,
              borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.5, marginBottom: 6 }}>Problem Headline</div>
              <div style={{ color: TEXT1, fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                {analysis.problem_definition?.headline || "—"}
              </div>
            </div>
          </div>

          {/* § 1 — Problem Definition */}
          <PaAnalysisSection title="§1 — Problem Definition" icon={Flag} color={RED}>
            <p style={{ color: TEXT1, fontSize: 12, fontWeight: 600, margin: "0 0 8px", lineHeight: 1.6 }}>
              {analysis.problem_definition?.structural_failure}
            </p>
            <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.4, marginBottom: 4 }}>Contract / Policy / Execution Misalignment</div>
              <p style={{ color: TEXT2, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
                {analysis.problem_definition?.misalignment}
              </p>
            </div>
          </PaAnalysisSection>

          {/* § 2 — Economic Impact */}
          <PaAnalysisSection title="§2 — Economic Impact Analysis" icon={DollarSign} color={AMBER}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {[
                { label: "Direct Spend Leakage", value: analysis.economic_impact?.direct_spend_leakage, color: RED },
                { label: "Admin Cost", value: analysis.economic_impact?.administrative_cost, color: AMBER },
                { label: "Total Exposure Range", value: analysis.economic_impact?.total_exposure_range, color: RED },
                { label: "ERISA Exposure", value: analysis.economic_impact?.erisa_exposure, color: PURPLE },
              ].map(m => (
                <div key={m.label} style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ color: TEXT2, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: 0.4, marginBottom: 5 }}>{m.label}</div>
                  <div style={{ color: m.color, fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
                    {m.value || "N/A"}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.4, marginBottom: 4 }}>Downstream Consequences</div>
              <p style={{ color: TEXT2, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
                {analysis.economic_impact?.downstream_consequences}
              </p>
            </div>
          </PaAnalysisSection>

          {/* § 3 — Root Cause */}
          <PaAnalysisSection title="§3 — Root Cause Structure" icon={Target} color={PURPLE}>
            {[
              { label: "Contractual Logic Failure", value: analysis.root_cause?.contractual_logic, color: RED },
              { label: "Policy Enforcement Gap", value: analysis.root_cause?.policy_enforcement, color: AMBER },
              { label: "Operational Execution Gap", value: analysis.root_cause?.operational_gap, color: PURPLE },
            ].map(item => (
              <div key={item.label} style={{ background: CARD2, borderRadius: 8, padding: "10px 14px",
                marginBottom: 8, borderLeft: `3px solid ${item.color}` }}>
                <div style={{ color: item.color, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 4 }}>{item.label}</div>
                <p style={{ color: TEXT2, fontSize: 11, margin: 0, lineHeight: 1.6 }}>{item.value || "—"}</p>
              </div>
            ))}
          </PaAnalysisSection>

          {/* § 4 — Intelligence Output */}
          <PaAnalysisSection title="§4 — Intelligence Layer Output" icon={ShieldAlert} color={TEAL}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: TEAL, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Risk Signals</div>
                {(analysis.intelligence_output?.risk_signals || []).map((s: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <Zap size={10} color={AMBER} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: RED, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>PBM Conflict Flags</div>
                {(analysis.intelligence_output?.pbm_conflict_flags || []).map((f: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <Flag size={10} color={RED} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
              <div style={{ color: PURPLE, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.4, marginBottom: 6 }}>Denial Pattern</div>
              <div style={{ color: TEXT1, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                {analysis.intelligence_output?.denial_pattern_category}
              </div>
              <p style={{ color: TEXT2, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                {analysis.intelligence_output?.denial_pattern_description}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: GREEN, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Appeal Leverage Points</div>
                {(analysis.intelligence_output?.appeal_leverage_points || []).map((p: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <CheckCircle2 size={10} color={GREEN} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4 }}>{p}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: ACCENT, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Regulatory Hooks</div>
                {(analysis.intelligence_output?.regulatory_hooks || []).map((h: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <BookOpen size={10} color={ACCENT} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4, fontFamily: "monospace" }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </PaAnalysisSection>

          {/* § 5 — Prioritized Decisions */}
          <PaAnalysisSection title="§5 — Decision Prioritization Engine" icon={TrendingUp} color={GREEN}>
            {(analysis.prioritized_decisions || []).map((d: any) => (
              <div key={d.rank} style={{ background: CARD2, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: ROSE,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#0F172A", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                    {d.rank}
                  </div>
                  <span style={{ color: TEXT1, fontWeight: 700, fontSize: 13, flex: 1 }}>{d.action}</span>
                  <span style={{
                    background: `${(URGENCY_COLORS[d.urgency] || AMBER)}22`,
                    color: URGENCY_COLORS[d.urgency] || AMBER,
                    border: `1px solid ${(URGENCY_COLORS[d.urgency] || AMBER)}40`,
                    borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 800,
                    letterSpacing: 0.4, textTransform: "uppercase",
                  }}>{d.urgency}</span>
                </div>
                <p style={{ color: TEXT2, fontSize: 11, margin: "0 0 6px", lineHeight: 1.5 }}>{d.rationale}</p>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ color: GREEN, fontSize: 10, fontWeight: 700 }}>
                    Impact: {d.financial_impact}
                  </span>
                  <span style={{ color: TEXT2, fontSize: 10 }}>
                    Reversibility: {d.reversibility}
                  </span>
                </div>
              </div>
            ))}
          </PaAnalysisSection>

          {/* § 6 — Recommended Actions */}
          <PaAnalysisSection title="§6 — Recommended Actions" icon={Zap} color={ACCENT}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: ACCENT, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Immediate Steps</div>
                {(analysis.recommended_actions?.immediate_steps || []).map((s: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <span style={{ color: ROSE, fontWeight: 900, fontSize: 12, flexShrink: 0, marginTop: 1 }}>{i+1}.</span>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: AMBER, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Negotiation Levers</div>
                {(analysis.recommended_actions?.negotiation_levers || []).map((l: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
                    <TrendingUp size={10} color={AMBER} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: `${GREEN}10`, border: `1px solid ${GREEN}25`, borderRadius: 8,
              padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ color: GREEN, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 0.4, marginBottom: 6 }}>Appeal Strategy</div>
              <p style={{ color: TEXT1, fontSize: 11, margin: 0, lineHeight: 1.6 }}>
                {analysis.recommended_actions?.appeal_strategy}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: TEXT2, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Documentation Required</div>
                {(analysis.recommended_actions?.documentation_required || []).map((d: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                    <FileText size={10} color={TEXT2} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ color: TEXT2, fontSize: 11, lineHeight: 1.4 }}>{d}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: CARD2, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ color: RED, fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 0.4, marginBottom: 6 }}>Escalation Path</div>
                <p style={{ color: TEXT2, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                  {analysis.recommended_actions?.escalation_path}
                </p>
              </div>
            </div>
          </PaAnalysisSection>

          {/* Footer note */}
          <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: "10px 14px", marginTop: 8 }}>
            <p style={{ color: TEXT2, fontSize: 10, margin: 0 }}>
              <strong style={{ color: TEXT1 }}>Authority: </strong>
              {result?.authority} · Confidence: {analysis.confidence_level} · {analysis.analysis_note}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */
export default function RxIntelligence() {
  const [activeTab, setActiveTab] = useState<Tab>("rxnorm");

  const ActiveContent = {
    "rxnorm":        RxNormTab,
    "open-payments": OpenPaymentsTab,
    "drug-spending": DrugSpendingTab,
    "npi":           NpiTab,
    "pa-iq":         PaIqTab,
  }[activeTab];

  return (
    <div style={{ minHeight: "100vh", background: BG, padding: "28px 24px", color: TEXT1 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ROSE}22`,
              border: `1px solid ${ROSE}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Pill size={20} color={ROSE}/>
            </div>
            <div>
              <h1 style={{ color: TEXT1, fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
                Rx & Provider Intelligence™
              </h1>
              <p style={{ color: TEXT2, fontSize: 12, margin: 0, marginTop: 2 }}>
                RxNorm · CMS Open Payments · Medicare Drug Spending · NPI Registry · PECOS — All Free APIs
              </p>
            </div>
          </div>

          {/* API Sources */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {[
              { label: "NIH RxNorm", color: TEAL },
              { label: "CMS Open Payments", color: AMBER },
              { label: "Medicare Part D", color: GREEN },
              { label: "NPPES NPI Registry", color: PURPLE },
              { label: "CMS PECOS", color: ROSE },
              { label: "PA IQ™ (Claude AI)", color: ACCENT },
            ].map(s => (
              <span key={s.label} style={{
                background: `${s.color}14`, color: s.color, border: `1px solid ${s.color}30`,
                borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.4
              }}>{s.label}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: CARD, borderRadius: 12,
          border: `1px solid ${BORDER}`, padding: 6, marginBottom: 20 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: "10px 8px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? `${ROSE}22` : "transparent",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  transition: "all 0.15s",
                }}
              >
                <tab.icon size={16} color={active ? ROSE : TEXT2}/>
                <span style={{ color: active ? TEXT1 : TEXT2, fontSize: 11, fontWeight: active ? 700 : 500 }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab description */}
        <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: "8px 14px", marginBottom: 18 }}>
          <p style={{ color: TEXT2, fontSize: 11, margin: 0 }}>
            {TABS.find(t => t.id === activeTab)?.desc}
          </p>
        </div>

        {/* Active tab content */}
        <ActiveContent />

        {/* Footer */}
        <div style={{ marginTop: 28, padding: "16px 0", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ color: TEXT2, fontSize: 10, margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: TEXT1 }}>Data Sources: </strong>
            NIH National Library of Medicine (RxNorm) · CMS Open Payments (Sunshine Act, 42 U.S.C. § 1320a-7h) ·
            CMS Medicare Part D Drug Spending · CMS NPPES NPI Registry (42 U.S.C. § 1320d-2) · CMS PECOS (42 C.F.R. § 424.500).
            All data from public federal databases. Results are for informational due diligence purposes only and do not
            constitute legal or medical advice. Independent verification required before compliance determinations.
          </p>
        </div>
      </div>
    </div>
  );
}
