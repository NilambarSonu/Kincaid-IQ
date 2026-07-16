/**
 * Operating Systems — overview hub for the four Kincaid Health operating systems.
 * Index page lists all four; the detail page renders a full spec sheet for one,
 * with a button into the live module.
 */
import { Link, useRoute } from "wouter";
import { Layout } from "@/components/Layout";
import {
  Activity, Zap, FileText, Sparkles, ArrowLeft, ArrowRight,
  ExternalLink, CheckCircle2, Database, Layers, Lock,
} from "lucide-react";

type OsKey = "hios" | "sales-os" | "rfp-os" | "rfp-intelligence";

type Os = {
  key: OsKey;
  name: string;
  short: string;
  identity: string;
  color: string;
  icon: any;
  liveRoute: string;
  liveLabel: string;
  summary: string;
  capabilities: string[];
  sourcesLabel: string;
  sources: string[];
  note?: string;
};

const OS_LIST: Os[] = [
  {
    key: "hios",
    name: "HIOS — Healthcare Intelligence Operating System",
    short: "HIOS",
    identity: "Healthcare Intelligence Operating System",
    color: "#00D4FF",
    icon: Activity,
    liveRoute: "/hios",
    liveLabel: "Open HIOS",
    summary:
      "The unified command room for the healthcare value-creation engine. HIOS sits on top of Claims Recovery, PBM Contract Clarity 360, and Fiduciary IQ and runs the operational workflows that turn denied claims, PBM contracts, and plan data into recovered dollars, with a receipt behind every number.",
    capabilities: [
      "Four-tile doctrine command center with live cross-module metrics that drill into the underlying module",
      "Denied-claim appeals tracked against the 180-day ERISA deadline with color-coded urgency",
      "Denial-letter parsing: paste a letter, get a structured denial reason and a pre-filled intake form",
      "Payer-specific appeal playbook drafting",
      "Three-tier multi-agent panel operating as PBM forensic auditor, ERISA litigator, McKinsey strategist, and Chief Medical Officer at once",
    ],
    sourcesLabel: "Cross-wired modules",
    sources: ["Claims Recovery IQ", "PBM Contract Clarity 360", "Fiduciary IQ"],
  },
  {
    key: "sales-os",
    name: "Sales OS",
    short: "Sales OS",
    identity: "AI Sales Intelligence Operating System",
    color: "#D4AF37",
    icon: Zap,
    liveRoute: "/sales-os",
    liveLabel: "Open Sales OS",
    summary:
      "A full prospecting and outreach engine that scores employer benefit plans and arms the rep with evidence-anchored intelligence drawn from public data. Built to find fiduciary arbitrage, for example an employer paying broker commissions above DOL benchmarks, and turn it into outreach.",
    capabilities: [
      "Four-axis account scoring: Fiduciary Risk, Savings Opportunity, Market Timing, Strategic Fit",
      "Sales Intelligence Copilot that analyzes employers, interprets Form 5500, and drafts evidence-anchored outreach",
      "Seeded account pipeline with prospects, alerts, and analytics tabs",
      "Per-account deep dives keyed by employer EIN",
    ],
    sourcesLabel: "Wired data sources",
    sources: [
      "DOL EFAST2 — Form 5500 filings (~800k/year)",
      "SEC EDGAR — public-company 10-K disclosures (~10k/year)",
      "CMS Open Data — Medicare and provider intel (~5M NPI records)",
      "IRS 990 Explorer — nonprofits and health systems (~350k orgs)",
      "SAM.gov — federal contractor registry (~750k entities)",
      "BLS QCEW — wage and employment benchmarks (~10M series)",
    ],
  },
  {
    key: "rfp-os",
    name: "RFP OS",
    short: "RFP OS",
    identity: "RFP Operations Operating System",
    color: "#00FF94",
    icon: FileText,
    liveRoute: "/rfp-os",
    liveLabel: "Open RFP OS",
    summary:
      "The console that turns an inbound RFP into a scored, draftable, trackable opportunity. Upload an RFP and the system parses it and runs a multi-factor scoring engine in about 20 seconds, then helps you draft and iterate the response.",
    capabilities: [
      "AI RFP parsing plus multi-factor opportunity scoring with a per-factor breakdown",
      "Versioned response draft generation, section by section, with regeneration",
      "Live re-scoring as inputs change",
      "Linked to the Revenue Forecast module and the RFP Board, Command Center, Model Health, and Resource Allocator",
    ],
    sourcesLabel: "Adjacent surfaces",
    sources: ["RFP Board", "RFP Command Center", "RFP Model Health", "RFP Resource Allocator", "Revenue Forecast"],
  },
  {
    key: "rfp-intelligence",
    name: "RFP Intelligence OS",
    short: "RFP Intelligence OS",
    identity: "Fiduciary RFP Intelligence Operating System",
    color: "#A855F7",
    icon: Sparkles,
    liveRoute: "/rfp-intelligence",
    liveLabel: "Open RFP Intelligence OS",
    summary:
      "A higher-tier, fiduciary-focused layer on top of RFP work. It scores each opportunity on a 0 to 100 Fiduciary Score and converts the gaps into pitch narrative, then hands the account off into PBM Contract Clarity 360 with pre-loaded context.",
    capabilities: [
      "0 to 100 Fiduciary Score per opportunity",
      "Turns benchmark gaps such as above-market broker compensation into the strongest opening angle",
      "One-click handoff into PBM Contract Clarity 360 with account context pre-loaded",
      "PDF generation of the resulting intelligence",
    ],
    sourcesLabel: "Hands off into",
    sources: ["PBM Contract Clarity 360"],
    note: "Gated module. Requires the rfp-intelligence entitlement.",
  },
];

const OS_BY_KEY: Record<OsKey, Os> = OS_LIST.reduce((acc, os) => {
  acc[os.key] = os;
  return acc;
}, {} as Record<OsKey, Os>);

const tint = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/* ─── Index ──────────────────────────────────────────────────────────────── */
export default function OperatingSystems() {
  return (
    <Layout>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 4px 48px" }}>
        <div style={{ marginBottom: 8 }}>
          <p
            data-testid="text-os-eyebrow"
            style={{
              fontSize: 10, fontWeight: 900, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(180,210,255,0.55)",
            }}
          >
            Kincaid Health · Operating Systems
          </p>
          <h1
            data-testid="text-os-title"
            style={{ fontSize: 30, fontWeight: 900, color: "#0F172A", marginTop: 6, letterSpacing: "-0.02em" }}
          >
            The Four Operating Systems
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 8, maxWidth: 720, lineHeight: 1.6 }}>
            Each operating system is a full command surface, not a dashboard. They share one doctrine:
            one screen, four tiles, every number clickable into receipts, and no export without a manifest.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            marginTop: 28,
          }}
        >
          {OS_LIST.map((os) => {
            const Icon = os.icon;
            return (
              <Link
                key={os.key}
                href={`/operating-systems/${os.key}`}
                data-testid={`card-os-${os.key}`}
                className="sidebar-nav-item"
                style={{
                  display: "block",
                  padding: 20,
                  borderRadius: 16,
                  background: `linear-gradient(160deg, ${tint(os.color, 0.08)} 0%, #ffffff 100%)`,
                  border: `1px solid ${tint(os.color, 0.28)}`,
                  textDecoration: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center",
                      background: tint(os.color, 0.12), border: `1px solid ${tint(os.color, 0.3)}`,
                    }}
                  >
                    <Icon size={20} color={os.color} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{os.short}</p>
                    <p style={{ fontSize: 11, color: tint(os.color, 0.85), fontWeight: 600 }}>{os.identity}</p>
                  </div>
                  <ArrowRight size={16} color="#64748b" />
                </div>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 14, lineHeight: 1.6 }}>
                  {os.summary}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

/* ─── Detail ─────────────────────────────────────────────────────────────── */
export function OperatingSystemDetail() {
  const [, params] = useRoute("/operating-systems/:key");
  const key = (params?.key ?? "") as OsKey;
  const os = OS_BY_KEY[key];

  if (!os) {
    return (
      <Layout>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 4px" }}>
          <p style={{ color: "#0f172a", fontSize: 15 }} data-testid="text-os-notfound">
            That operating system does not exist.
          </p>
          <Link
            href="/operating-systems"
            data-testid="link-os-back"
            style={{ color: "#00D4FF", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12 }}
          >
            <ArrowLeft size={14} /> Back to all operating systems
          </Link>
        </div>
      </Layout>
    );
  }

  const idx = OS_LIST.findIndex((o) => o.key === os.key);
  const prev = OS_LIST[(idx - 1 + OS_LIST.length) % OS_LIST.length];
  const next = OS_LIST[(idx + 1) % OS_LIST.length];
  const Icon = os.icon;

  return (
    <Layout>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "8px 4px 56px" }}>
        <Link
          href="/operating-systems"
          data-testid="link-os-back"
          style={{ color: "#334155", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} /> All operating systems
        </Link>

        {/* Hero */}
        <div
          style={{
            marginTop: 18,
            padding: 28,
            borderRadius: 20,
            background: `linear-gradient(155deg, ${tint(os.color, 0.12)} 0%, #ffffff 60%)`,
            border: `1px solid ${tint(os.color, 0.3)}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center",
                background: tint(os.color, 0.14), border: `1px solid ${tint(os.color, 0.34)}`,
              }}
            >
              <Icon size={26} color={os.color} strokeWidth={1.8} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: tint(os.color, 0.9) }}>
                Operating System
              </p>
              <h1 data-testid="text-os-name" style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em", marginTop: 2 }}>
                {os.name}
              </h1>
            </div>
          </div>

          <p style={{ fontSize: 14.5, color: "#0f172a", marginTop: 18, lineHeight: 1.7 }}>
            {os.summary}
          </p>

          {os.note && (
            <div
              data-testid="text-os-note"
              style={{
                marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 11.5, fontWeight: 600, color: "#A855F7",
                background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.3)",
                borderRadius: 8, padding: "6px 12px",
              }}
            >
              <Lock size={13} /> {os.note}
            </div>
          )}

          <Link
            href={os.liveRoute}
            data-testid="button-os-open-live"
            style={{
              marginTop: 22, display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 13, fontWeight: 800, color: "#0a0a0a",
              background: os.color, borderRadius: 11, padding: "11px 18px", textDecoration: "none",
            }}
          >
            {os.liveLabel} <ExternalLink size={15} />
          </Link>
        </div>

        {/* Capabilities */}
        <section style={{ marginTop: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <Layers size={16} color={os.color} />
            <h2 style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
              Core capabilities
            </h2>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {os.capabilities.map((cap, i) => (
              <div
                key={i}
                data-testid={`text-os-capability-${i}`}
                style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  padding: 16, borderRadius: 12,
                  background: "#ffffff", border: "1px solid #e2e8f0",
                }}
              >
                <CheckCircle2 size={17} color={os.color} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>{cap}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sources */}
        <section style={{ marginTop: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <Database size={16} color={os.color} />
            <h2 style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
              {os.sourcesLabel}
            </h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {os.sources.map((s, i) => (
              <span
                key={i}
                data-testid={`badge-os-source-${i}`}
                style={{
                  fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.72)",
                  background: tint(os.color, 0.08), border: `1px solid ${tint(os.color, 0.24)}`,
                  borderRadius: 9, padding: "8px 13px",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* Prev / Next */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 40 }}>
          <Link
            href={`/operating-systems/${prev.key}`}
            data-testid="link-os-prev"
            className="sidebar-nav-item"
            style={{
              flex: 1, padding: 14, borderRadius: 12, textDecoration: "none",
              background: "#ffffff", border: "1px solid #e2e8f0",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              <ArrowLeft size={12} /> Previous
            </span>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 5 }}>{prev.short}</p>
          </Link>
          <Link
            href={`/operating-systems/${next.key}`}
            data-testid="link-os-next"
            className="sidebar-nav-item"
            style={{
              flex: 1, padding: 14, borderRadius: 12, textDecoration: "none", textAlign: "right",
              background: "#ffffff", border: "1px solid #e2e8f0",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Next <ArrowRight size={12} />
            </span>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 5 }}>{next.short}</p>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
