/**
 * Intelligence Engines
 * ====================
 * A data-driven catalog of analytical engines. The catalog and every engine's
 * full detail page are rendered generically from the backend registry
 * (`/api/engines`), so each engine gets its own URL and a full page without a
 * hand-coded component per engine.
 *
 *   /engines          → EngineCatalog (grouped by segment)
 *   /engines/:slug    → EngineDetail  (full page for one engine)
 */
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Layout } from "@/components/Layout";
import { DoctrineBar, ConfidenceChip, type ConfidenceTier } from "@/components/Doctrine";
import {
  TrendingUp, Pill, Activity, AlertTriangle, UserCheck, FlaskConical,
  BarChart3, LineChart as LineChartIcon, Globe2, Users, Layers, Calculator,
  CalendarDays, Sigma, Sparkles, ArrowLeft, ArrowRight, Cpu, Loader2,
  CheckCircle2, Lock,
} from "lucide-react";

const ICONS: Record<string, any> = {
  TrendingUp, Pill, Activity, AlertTriangle, UserCheck, FlaskConical,
  BarChart3, LineChart: LineChartIcon, Globe2, Users, Layers, Calculator,
  CalendarDays, Sigma, Sparkles, Cpu,
};

const BG = "transparent";
const CARD = "rgba(255,255,255,0.80)";
const BORDER = "rgba(15,23,42,0.10)";
const TEXT = "#08111f";
const MUTED = "#3f516a";

type CatalogEngine = {
  slug: string; name: string; category: string; blurb: string;
  icon: string; accent: string; tier_hint: ConfidenceTier; family: string;
};
type Catalog = {
  count: number;
  categories: { name: string; engines: CatalogEngine[] }[];
  engines: CatalogEngine[];
};

type Tile = { label: string; value: string; sub: string; tier: ConfidenceTier; drill?: string };
type Section = any;
type EnginePayload = {
  slug: string; name: string; category: string; blurb: string; accent: string; icon: string;
  entity: { ein: string; name: string; state?: string; members: number; members_filed: number;
    latest_year?: number; baseline_premium: number; has_data: boolean };
  tier: ConfidenceTier;
  tiles: Tile[];
  sections: Section[];
  methodology: string;
  unlocks: string[];
};

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const C = ICONS[name] || Cpu;
  return <C size={size} color={color} />;
}

/* ─────────────────────────────────────────────────────────────── Catalog ── */
export default function EngineCatalog() {
  const { data, isLoading } = useQuery<Catalog>({ queryKey: ["/api/engines"] });

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "calc(100vh - 56px)", padding: "28px 32px 72px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="kiq-ops-header" style={{ marginBottom: 24, borderRadius: 24, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center",
              background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.3)",
            }}>
              <Cpu size={22} color="#00D4FF" />
            </div>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: "-0.045em", fontFamily: "var(--font-display)" }} data-testid="text-engines-title">
                Intelligence Engines
              </h1>
              <div style={{ color: MUTED, fontSize: 13 }}>
                {isLoading ? "Loading catalog" : `${data?.count ?? 0} analytical engines · one full page each · honest confidence tiers`}
              </div>
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 14, maxWidth: 820, lineHeight: 1.6 }}>
            Every engine computes from filed DOL Form 5500 data for the active entity. Numbers are
            deterministic first; confidence tiers are per section. Where the 5500 cannot support a
            dollar finding, the engine returns INSUFFICIENT_EVIDENCE and names the ingestion that
            would unlock it.
          </p>
        </div>

        {isLoading && <div style={{ color: MUTED }}>Loading engines…</div>}

        {data?.categories.map(cat => (
          <section key={cat.name} style={{ marginBottom: 36 }}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: TEXT, letterSpacing: 0.3, margin: 0 }}>
                {cat.name}
              </h2>
              <span style={{ color: MUTED, fontSize: 12 }}>{cat.engines.length} engines</span>
            </div>
            <div style={{
              display: "grid", gap: 14,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}>
              {cat.engines.map(e => (
                <Link key={e.slug} href={`/engines/${e.slug}`} data-testid={`link-engine-${e.slug}`}>
                  <div
                    className="kiq-ops-card engine-card"
                    style={{
                      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18,
                      padding: 16, cursor: "pointer", height: "100%",
                      transition: "transform .12s ease, border-color .12s ease",
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.borderColor = e.accent + "88"; ev.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={ev => { ev.currentTarget.style.borderColor = BORDER; ev.currentTarget.style.transform = "none"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center",
                        background: e.accent + "1e", border: `1px solid ${e.accent}44`,
                      }}>
                        <Icon name={e.icon} size={18} color={e.accent} />
                      </div>
                      <ConfidenceChip tier={e.tier_hint} compact />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: TEXT, marginBottom: 6 }}>{e.name}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55, fontWeight: 600 }}>{e.blurb}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, color: e.accent, fontSize: 12, fontWeight: 600 }}>
                      Open engine <ArrowRight size={13} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      </div>
    </Layout>
  );
}

/* ────────────────────────────────────────────────────────────── Detail ──── */
export function EngineDetail() {
  const [, params] = useRoute("/engines/:slug");
  const slug = params?.slug ?? "";
  const [members, setMembers] = useState<string>("");
  const [narr, setNarr] = useState<{ headline: string; paragraphs: string[]; next_step: string } | null>(null);
  const [narrLoading, setNarrLoading] = useState(false);
  const [narrErr, setNarrErr] = useState<string | null>(null);

  const url = useMemo(() => {
    const qs = members ? `?members=${encodeURIComponent(members)}` : "";
    return `/api/engines/${slug}${qs}`;
  }, [slug, members]);

  const { data, isLoading, isError } = useQuery<EnginePayload>({ queryKey: [url], enabled: !!slug });

  async function generateNarrative() {
    if (!data) return;
    setNarrLoading(true); setNarrErr(null);
    try {
      const res = await fetch(`/api/engines/${slug}/narrative`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ein: data.entity.ein, members: members ? Number(members) : null }),
      });
      if (!res.ok) throw new Error(`Narrative failed (${res.status})`);
      setNarr(await res.json());
    } catch (e: any) {
      setNarrErr(e?.message || "Narrative generation failed");
    } finally {
      setNarrLoading(false);
    }
  }

  const accent = data?.accent || "#00D4FF";

  return (
    <Layout>
      <div className="kiq-ops-shell" style={{ minHeight: "calc(100vh - 56px)", padding: "28px 32px 72px", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Link href="/engines" data-testid="link-back-catalog">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 13, marginBottom: 16, cursor: "pointer" }}>
            <ArrowLeft size={14} /> All engines
          </div>
        </Link>

        {isLoading && <div style={{ color: MUTED }}>Computing engine…</div>}
        {isError && <div style={{ color: "#FF4D6D" }}>Could not load this engine.</div>}

        {data && (
          <>
            <DoctrineBar gate="THRESHOLD_EVALUATION" tier={data.tier} ein={data.entity.ein} einName={data.entity.name} />

            {/* Hero */}
            <div className="kiq-ops-header" style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20, borderRadius: 24, padding: "22px 24px" }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0,
                background: accent + "1e", border: `1px solid ${accent}44`,
              }}>
                <Icon name={data.icon} size={24} color={accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: 30, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: "-0.045em", fontFamily: "var(--font-display)" }} data-testid="text-engine-name">{data.name}</h1>
                  <ConfidenceChip tier={data.tier} />
                </div>
                <div style={{ color: MUTED, fontSize: 13.5, marginTop: 6, maxWidth: 780, lineHeight: 1.55 }}>{data.blurb}</div>
                <div style={{ color: MUTED, fontSize: 12.5, marginTop: 8 }}>
                  {data.category} · Entity <span style={{ color: TEXT }}>{data.entity.name}</span>
                  {data.entity.latest_year ? ` · FY${data.entity.latest_year}` : ""}
                  {" · EIN "}{data.entity.ein}
                </div>
              </div>
            </div>

            {/* Members override control */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <label style={{ color: MUTED, fontSize: 12.5 }}>Covered lives</label>
              <input
                data-testid="input-members"
                type="number" min={1} placeholder={String(data.entity.members_filed || "members")}
                value={members} onChange={e => setMembers(e.target.value)}
                style={{
                  width: 140, background: "#f8fafc", border: `1px solid ${BORDER}`,
                  borderRadius: 8, padding: "7px 10px", color: TEXT, fontSize: 13,
                }}
              />
              <span style={{ color: MUTED, fontSize: 12 }}>
                filed: {data.entity.members_filed.toLocaleString()} · override to re-scale modeled figures
              </span>
            </div>

            {/* Four tiles */}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 24 }} data-testid="grid-tiles">
              {data.tiles.map((t, i) => (
                <div key={i} className="kiq-ops-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14 }} data-testid={`tile-${i}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 6 }}>
                    <span style={{ color: MUTED, fontSize: 11.5, fontWeight: 500 }}>{t.label}</span>
                    <ConfidenceChip tier={t.tier} compact />
                  </div>
                  <div style={{ color: TEXT, fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>{t.value}</div>
                  {t.sub && <div style={{ color: MUTED, fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>{t.sub}</div>}
                </div>
              ))}
            </div>

            {/* Sections */}
            {data.sections.map((s: Section, i: number) => (
              <SectionCard key={i} section={s} accent={accent} />
            ))}

            {/* AI narrative (lazy) */}
            <div className="kiq-ops-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} color={accent} />
                  <span style={{ color: TEXT, fontSize: 14, fontWeight: 650 }}>Analyst narrative</span>
                  <span style={{ color: MUTED, fontSize: 12 }}>generated after the numbers, never before</span>
                </div>
                <button
                  data-testid="button-generate-narrative"
                  onClick={generateNarrative} disabled={narrLoading}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, cursor: narrLoading ? "default" : "pointer",
                    background: accent + "1e", border: `1px solid ${accent}55`, color: accent,
                    borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  {narrLoading ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                  {narrLoading ? "Investigating…" : narr ? "Regenerate" : "Generate narrative"}
                </button>
              </div>
              {narrErr && <div style={{ color: "#FF4D6D", fontSize: 12.5, marginTop: 12 }}>{narrErr}</div>}
              {narr && (
                <div style={{ marginTop: 14 }} data-testid="text-narrative">
                  <div style={{ color: TEXT, fontSize: 15, fontWeight: 650, marginBottom: 10 }}>{narr.headline}</div>
                  {narr.paragraphs?.map((p, k) => (
                    <p key={k} style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.65, margin: "0 0 10px" }}>{p}</p>
                  ))}
                  {narr.next_step && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6, padding: 12, background: accent + "12", border: `1px solid ${accent}33`, borderRadius: 9 }}>
                      <ArrowRight size={15} color={accent} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ color: TEXT, fontSize: 13 }}>{narr.next_step}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Methodology */}
            <div className="kiq-ops-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 18, marginTop: 20 }}>
              <div style={{ color: TEXT, fontSize: 14, fontWeight: 650, marginBottom: 8 }}>Methodology</div>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65, margin: 0 }}>{data.methodology}</p>
            </div>

            {/* Unlocks (only when there is a gap to name) */}
            {data.unlocks?.length > 0 && (
              <div className="kiq-ops-card" style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.22)", borderRadius: 18, padding: 18, marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Lock size={15} color="#FF4D6D" />
                  <span style={{ color: TEXT, fontSize: 14, fontWeight: 650 }}>What unlocks a CERTIFIED finding</span>
                </div>
                {data.unlocks.map((u, k) => (
                  <div key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
                    <ArrowRight size={14} color="#FF4D6D" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ color: MUTED, fontSize: 12.8, lineHeight: 1.5 }}>{u}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </Layout>
  );
}

/* ─────────────────────────────────────────────────────────── Section cards ─ */
function SectionCard({ section, accent }: { section: Section; accent: string }) {
  const title = section.title;
  const shell: React.CSSProperties = {
    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, marginBottom: 20,
  };
  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
      <span style={{ color: TEXT, fontSize: 14, fontWeight: 650 }}>{title}</span>
      {section.tier && <ConfidenceChip tier={section.tier} compact />}
    </div>
  );

  if (section.type === "trend") {
    const rows = (section.series || []).map((s: any) => ({
      year: s.year,
      actual: s.actual ?? null,
      p50: s.p50 ?? null,
      bandLow: s.p10 ?? null,
      bandRange: s.p90 != null && s.p10 != null ? s.p90 - s.p10 : null,
    }));
    return (
      <div style={shell}>
        {header}
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 12, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" stroke={MUTED} tick={{ fontSize: 11 }} />
              <YAxis stroke={MUTED} tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtAxis(v)} width={64} />
              <Tooltip
                contentStyle={{ background: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, fontSize: 12 }}
                formatter={(v: any, n: any) => [typeof v === "number" ? fmtAxis(v) : v, labelFor(n)]}
              />
              <Area type="monotone" dataKey="bandLow" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area type="monotone" dataKey="bandRange" stackId="band" stroke="none" fill="url(#bandGrad)" isAnimationActive={false} />
              <Line type="monotone" dataKey="actual" stroke={accent} strokeWidth={2.4} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              <Line type="monotone" dataKey="p50" stroke={accent} strokeWidth={1.8} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {section.note && <div style={{ color: MUTED, fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{section.note}</div>}
      </div>
    );
  }

  if (section.type === "decomposition") {
    const bars = section.bars || [];
    const maxV = Math.max(...bars.map((b: any) => b.value), 1);
    return (
      <div style={shell}>
        {header}
        {bars.map((b: any, i: number) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ color: TEXT }}>{b.label}</span>
              <span style={{ color: MUTED }}>{money(b.value)} · {b.pct}%</span>
            </div>
            <div style={{ height: 9, background: "#f1f5f9", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${(b.value / maxV) * 100}%`, height: "100%", background: accent, borderRadius: 6 }} />
            </div>
          </div>
        ))}
        {section.note && <div style={{ color: MUTED, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{section.note}</div>}
      </div>
    );
  }

  if (section.type === "gauges") {
    const { value, p50, p75, p90 } = section;
    const scale = Math.max(value, p90) * 1.1 || 1;
    const pct = (v: number) => `${Math.min((v / scale) * 100, 100)}%`;
    return (
      <div style={shell}>
        {header}
        <div style={{ position: "relative", height: 14, background: "#f1f5f9", borderRadius: 7, marginBottom: 10 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct(value), background: accent, borderRadius: 7 }} />
          {[["P50", p50], ["P75", p75], ["P90", p90]].map(([lbl, v]: any) => (
            <div key={lbl} style={{ position: "absolute", left: pct(v), top: -4, bottom: -4, width: 2, background: "#fff6" }} title={`${lbl}: ${money(v)}`} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 18, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
          <span style={{ color: accent }}>Filed: {money(value)}</span>
          <span>P50 {money(p50)}</span>
          <span>P75 {money(p75)}</span>
          <span>P90 {money(p90)}</span>
        </div>
        {section.note && <div style={{ color: MUTED, fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{section.note}</div>}
      </div>
    );
  }

  if (section.type === "unlocks") {
    return (
      <div style={{ ...shell, background: "rgba(255,77,109,0.05)", border: "1px solid rgba(255,77,109,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Lock size={15} color="#FF4D6D" />
          <span style={{ color: TEXT, fontSize: 14, fontWeight: 650 }}>{title}</span>
        </div>
        {(section.items || []).map((u: string, k: number) => (
          <div key={k} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 7 }}>
            <ArrowRight size={14} color="#FF4D6D" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ color: MUTED, fontSize: 12.8, lineHeight: 1.5 }}>{u}</span>
          </div>
        ))}
      </div>
    );
  }

  // drivers / scenario → table
  const rows = section.rows || [];
  return (
    <div style={shell}>
      {header}
      <div style={{ display: "grid", gap: 0 }}>
        {rows.map((r: any, i: number) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0",
            borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none",
          }}>
            <div>
              <div style={{ color: TEXT, fontSize: 13 }}>{r.label}</div>
              {r.note && <div style={{ color: MUTED, fontSize: 11.5 }}>{r.note}</div>}
            </div>
            <div style={{ color: TEXT, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>{r.value}</div>
          </div>
        ))}
      </div>
      {section.note && <div style={{ color: MUTED, fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>{section.note}</div>}
    </div>
  );
}

function fmtAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}
function money(v: number): string { return fmtAxis(Number(v) || 0); }
function labelFor(n: string): string {
  if (n === "actual") return "Filed";
  if (n === "p50") return "Modeled P50";
  if (n === "bandRange") return "P10-P90 band";
  return n;
}
