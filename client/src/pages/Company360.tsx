import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Layout } from "@/components/Layout";
import { useCompanyHandoff, readHandoffParams } from "@/hooks/use-company-handoff";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Search, Building2, ArrowRight, ShieldCheck, AlertTriangle,
  CircleSlash, Loader2, DollarSign, TrendingDown, Layers,
} from "lucide-react";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG = "#0a0e1a";
const PANEL = "#111726";
const BORDER = "rgba(255,255,255,0.08)";
const GOLD = "#FFB800";
const GREEN = "#00FF94";
const BLUE = "#4f7dff";
const CYAN = "#00D4FF";
const RED = "#FF4D6D";
const MUTED = "rgba(255,255,255,0.55)";

// ── Types ───────────────────────────────────────────────────────────────────
interface Kpi { label: string; value: any; unit: string; }
interface ModuleCard {
  key: string;
  module: string;
  route: string;
  confidence: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
  headline: string;
  summary: string;
  kpis: Kpi[];
}
interface Dossier {
  ein: string;
  company: string;
  identity: {
    ein: string; sponsor: string; city: string; state: string;
    industry: string; participants: number; carrier: string; latest_year: number;
  };
  rollup: {
    total_broker_commissions: number;
    total_admin_fees: number;
    total_plan_income: number;
    estimated_annual_leakage: number;
    modules_with_findings: number;
    modules_total: number;
    confidence_mix: Record<string, number>;
  };
  modules: ModuleCard[];
}
interface SearchResult {
  ein: string; company: string; state: string; city: string;
  latest_year: number; participants: number;
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
  : `$${Math.round(n || 0).toLocaleString()}`;

function kpiValue(k: Kpi): string {
  if (k.value === null || k.value === undefined || k.value === "") return "—";
  if (k.unit === "$") return fmtMoney(Number(k.value));
  if (k.unit === "%") return `${k.value}%`;
  if (k.unit === "/100") return `${k.value}/100`;
  if (typeof k.value === "number") return k.value.toLocaleString();
  return String(k.value);
}

function ConfidenceBadge({ tier }: { tier: ModuleCard["confidence"] }) {
  const map = {
    CERTIFIED: { c: GREEN, Icon: ShieldCheck, label: "CERTIFIED" },
    MODELED: { c: GOLD, Icon: AlertTriangle, label: "MODELED" },
    INSUFFICIENT_EVIDENCE: { c: MUTED, Icon: CircleSlash, label: "INSUFFICIENT EVIDENCE" },
  } as const;
  const { c, Icon, label } = map[tier];
  return (
    <span
      data-testid={`badge-confidence-${tier}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 9, fontWeight: 900, letterSpacing: "0.1em",
        color: c, background: `${c}1A`, border: `1px solid ${c}40`,
        borderRadius: 4, padding: "2px 7px", textTransform: "uppercase",
      }}
    >
      <Icon size={11} strokeWidth={2.2} /> {label}
    </span>
  );
}

export default function Company360() {
  const [, params] = useRoute("/company-360/:ein");
  const routeEin = params?.ein ?? null;
  const { sendTo, sendToPath } = useCompanyHandoff();

  const [query, setQuery] = useState("");
  const [selectedEin, setSelectedEin] = useState<string | null>(routeEin);
  const [selectedName, setSelectedName] = useState<string>("");
  const debouncedQuery = useDebounce(query, 250);

  // Honor an inbound handoff (?ein=&company=) or a /company-360/:ein deep link.
  useEffect(() => {
    if (routeEin) { setSelectedEin(routeEin); return; }
    const h = readHandoffParams();
    if (h.ein) {
      setSelectedEin(h.ein);
      if (h.company) setSelectedName(h.company);
    }
  }, [routeEin]);

  const searchQ = useQuery<{ results: SearchResult[] }>({
    queryKey: [`/api/company-360/search?q=${encodeURIComponent(debouncedQuery)}`],
    enabled: debouncedQuery.trim().length >= 2,
  });

  const dossierQ = useQuery<Dossier>({
    queryKey: [`/api/company-360/${selectedEin}`],
    enabled: !!selectedEin,
  });

  const dossier = dossierQ.data;
  const results = searchQ.data?.results ?? [];

  const onPick = (r: SearchResult) => {
    setSelectedEin(r.ein);
    setSelectedName(r.company);
    setQuery("");
  };

  const mix = dossier?.rollup.confidence_mix ?? {};

  return (
    <Layout>
      <div style={{ background: BG, minHeight: "100%", padding: "28px 32px", color: "#fff" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <Building2 size={22} color={CYAN} />
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.01em" }}>
            Company 360
          </h1>
        </div>
        <p style={{ color: MUTED, fontSize: 13, margin: "0 0 22px", maxWidth: 720 }}>
          One employer, every module. Search a company to assemble a single EIN-keyed
          dossier across Filing Intelligence, Shady Broker, Sales OS, Stop-Loss,
          Network, Fiduciary, and the CFO War Room — each finding tagged with its
          evidence tier and a deep link into the module that produced it.
        </p>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 560, marginBottom: 28 }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color={MUTED} style={{ position: "absolute", left: 13, top: 13 }} />
            <input
              data-testid="input-company-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employer by name…"
              style={{
                width: "100%", background: PANEL, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: "11px 14px 11px 38px", color: "#fff",
                fontSize: 14, outline: "none",
              }}
            />
            {searchQ.isFetching && (
              <Loader2 size={16} className="animate-spin" color={MUTED}
                style={{ position: "absolute", right: 13, top: 13 }} />
            )}
          </div>
          {results.length > 0 && query.trim().length >= 2 && (
            <div style={{
              position: "absolute", top: 48, left: 0, right: 0, zIndex: 30,
              background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 10,
              overflow: "hidden", boxShadow: "0 14px 40px rgba(0,0,0,0.5)",
            }}>
              {results.map((r) => (
                <button
                  key={r.ein}
                  data-testid={`result-company-${r.ein}`}
                  onClick={() => onPick(r)}
                  style={{
                    display: "flex", width: "100%", textAlign: "left", gap: 10,
                    alignItems: "center", padding: "10px 14px", background: "transparent",
                    border: "none", borderBottom: `1px solid ${BORDER}`, color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <Building2 size={14} color={MUTED} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.company}</span>
                    <span style={{ display: "block", fontSize: 11, color: MUTED }}>
                      EIN {r.ein} · {r.city}, {r.state} · {r.participants.toLocaleString()} participants
                    </span>
                  </span>
                  <ArrowRight size={14} color={MUTED} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading / empty */}
        {selectedEin && dossierQ.isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: MUTED }}>
            <Loader2 size={18} className="animate-spin" /> Assembling dossier for {selectedName || selectedEin}…
          </div>
        )}
        {selectedEin && dossierQ.isError && (
          <div data-testid="text-dossier-error" style={{ color: RED, fontSize: 14 }}>
            No filing evidence on record for EIN {selectedEin}.
          </div>
        )}
        {!selectedEin && (
          <div style={{ color: MUTED, fontSize: 14, padding: "40px 0" }}>
            Search above to load a company dossier.
          </div>
        )}

        {/* Dossier */}
        {dossier && (
          <div>
            {/* Identity + roll-up */}
            <div style={{
              background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 14,
              padding: 22, marginBottom: 22,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h2 data-testid="text-company-name" style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>
                    {dossier.identity.sponsor}
                  </h2>
                  <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>
                    EIN {dossier.ein} · {dossier.identity.city}, {dossier.identity.state}
                    {dossier.identity.industry ? ` · ${dossier.identity.industry}` : ""}
                    {" · "}{dossier.identity.participants.toLocaleString()} participants
                    {dossier.identity.latest_year ? ` · FY${dossier.identity.latest_year}` : ""}
                  </div>
                </div>
                <button
                  data-testid="button-open-war-room"
                  onClick={() => sendTo("exec-war-room", dossier.ein, dossier.identity.sponsor)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    background: `${BLUE}22`, border: `1px solid ${BLUE}55`, color: "#cdd9ff",
                    borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  }}
                >
                  Open in CFO War Room <ArrowRight size={14} />
                </button>
              </div>

              {/* Roll-up tiles */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12, marginTop: 18,
              }}>
                <RollupTile icon={<TrendingDown size={15} color={RED} />} color={RED}
                  label="Est. Annual Leakage" value={fmtMoney(dossier.rollup.estimated_annual_leakage)} />
                <RollupTile icon={<DollarSign size={15} color={GOLD} />} color={GOLD}
                  label="Broker Commissions" value={fmtMoney(dossier.rollup.total_broker_commissions)} />
                <RollupTile icon={<DollarSign size={15} color={CYAN} />} color={CYAN}
                  label="Admin Fees" value={fmtMoney(dossier.rollup.total_admin_fees)} />
                <RollupTile icon={<Layers size={15} color={GREEN} />} color={GREEN}
                  label="Modules w/ Findings"
                  value={`${dossier.rollup.modules_with_findings}/${dossier.rollup.modules_total}`} />
              </div>

              {/* Confidence mix */}
              <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
                <MixPill color={GREEN} label="Certified" n={mix.CERTIFIED || 0} />
                <MixPill color={GOLD} label="Modeled" n={mix.MODELED || 0} />
                <MixPill color={MUTED} label="Insufficient" n={mix.INSUFFICIENT_EVIDENCE || 0} />
              </div>
            </div>

            {/* Module cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16,
            }}>
              {dossier.modules.map((m) => {
                const gap = m.confidence === "INSUFFICIENT_EVIDENCE";
                return (
                  <div
                    key={m.key}
                    data-testid={`card-module-${m.key}`}
                    style={{
                      background: PANEL, border: `1px solid ${gap ? BORDER : "rgba(79,125,255,0.22)"}`,
                      borderRadius: 14, padding: 18, display: "flex", flexDirection: "column",
                      opacity: gap ? 0.78 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 900 }}>{m.module}</span>
                      <ConfidenceBadge tier={m.confidence} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: gap ? MUTED : "#fff", marginTop: 10 }}>
                      {m.headline}
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 6, lineHeight: 1.5, flex: 1 }}>
                      {m.summary}
                    </div>

                    {m.kpis.length > 0 && (
                      <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14,
                      }}>
                        {m.kpis.map((k, i) => (
                          <div key={i} style={{
                            background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
                            borderRadius: 8, padding: "8px 10px",
                          }}>
                            <div style={{ fontSize: 9, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {k.label}
                            </div>
                            <div data-testid={`kpi-${m.key}-${i}`} style={{ fontSize: 15, fontWeight: 900, marginTop: 2 }}>
                              {kpiValue(k)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {m.route && (
                      <button
                        data-testid={`button-open-${m.key}`}
                        onClick={() => sendToPath(m.route, dossier.ein, dossier.identity.sponsor)}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                          marginTop: 14, background: gap ? "transparent" : `${BLUE}1A`,
                          border: `1px solid ${gap ? BORDER : `${BLUE}44`}`,
                          color: gap ? MUTED : "#cdd9ff", borderRadius: 9, padding: "8px 12px",
                          fontSize: 12, fontWeight: 800, cursor: "pointer",
                        }}
                      >
                        {gap ? "Resolve in" : "Open in"} {m.module} <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function RollupTile({ icon, color, label, value }: { icon: any; color: string; label: string; value: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${color}33`,
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 5, color }}>{value}</div>
    </div>
  );
}

function MixPill({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: MUTED }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: color, display: "inline-block" }} />
      {n} {label}
    </span>
  );
}
