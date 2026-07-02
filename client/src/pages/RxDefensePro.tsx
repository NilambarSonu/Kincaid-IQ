import { useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, Pill, CheckCircle2, ArrowRight, DollarSign, FileText,
  Zap, Lock, BarChart3, AlertTriangle, ChevronRight, Star,
  TrendingDown, Target, Scale, Gavel, Building2, Users, Clock,
} from "lucide-react";
import { Layout } from "@/components/Layout";

const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";

const PROVISIONS = [
  { id: 1,  name: "Fiduciary Loyalty Commitment",      risk: "critical", issues: 5 },
  { id: 2,  name: "Pass-Through Pharmacy Costs",        risk: "critical", issues: 4 },
  { id: 3,  name: "Rebate & Manufacturer Revenue",      risk: "critical", issues: 5 },
  { id: 4,  name: "Data Ownership & Access",            risk: "high",     issues: 5 },
  { id: 5,  name: "Audit Rights & Extrapolation",       risk: "high",     issues: 6 },
  { id: 6,  name: "Pharmacy Ownership & Neutrality",    risk: "high",     issues: 5 },
  { id: 7,  name: "Carve-Out & Vendor Rights",          risk: "medium",   issues: 5 },
  { id: 8,  name: "Lowest Net Cost & Clinical Integrity",risk: "high",    issues: 5 },
  { id: 9,  name: "Termination & Clean Exit",           risk: "medium",   issues: 5 },
  { id: 10, name: "Administrative Fee Verification",    risk: "medium",   issues: 5 },
  { id: 11, name: "Step Therapy & Clinical Management", risk: "high",     issues: 5 },
  { id: 12, name: "Mail Order & Specialty Steering",    risk: "critical", issues: 5 },
  { id: 13, name: "Performance Guarantees & Remedies",  risk: "medium",   issues: 5 },
];

const RISK_COLOR: Record<string, string> = {
  critical: "#DC2626",
  high:     "#EA580C",
  medium:   "#D97706",
};

const RISK_BG: Record<string, string> = {
  critical: "rgba(220,38,38,0.08)",
  high:     "rgba(234,88,12,0.08)",
  medium:   "rgba(217,119,6,0.08)",
};

const STATS = [
  { value: "13",    label: "Provisions Audited" },
  { value: "65",    label: "Fiduciary Issues Checked" },
  { value: "~30s",  label: "Full Analysis Time" },
  { value: "100",   label: "Max Possible Score" },
];

const FEATURES = [
  { icon: Shield,       title: "Fiduciary Scoring",        body: "Every contract receives a 0–100 score across 13 provisions. Most PBM contracts score 30–55. A score below 45 is a documented fiduciary liability." },
  { icon: DollarSign,   title: "Dollar Exposure Per Gap",  body: "Each missing provision translates to a dollar exposure estimate based on your plan's Rx spend. See exactly how much each gap is costing you annually." },
  { icon: Gavel,        title: "Model Contract Language",  body: "For every gap found, the AI generates ready-to-use contract language your attorney can insert directly into renegotiations." },
  { icon: Scale,        title: "Negotiation Playbook",     body: "Talking points, leverage strategies, and prioritized issues for every provision — turn your broker into the expert in the room." },
  { icon: BarChart3,    title: "Before / After Comparison",body: "Upload the renegotiated contract and compare scores provision by provision. Track exactly what improved, what regressed, and what still needs attention." },
  { icon: FileText,     title: "Fiduciary Audit Trail",    body: "The full report documents your CAA 2026 due diligence in writing — critical protection for plan sponsors in a DOL enforcement environment." },
];

const CASE_STUDIES = [
  { name: "Mid-Size Manufacturer", employees: 850, pbm: "CVS Caremark", score: 38, exposure: "$1.4M", finding: "Spread pricing on specialty drugs + no rebate pass-through clause. $1.1M recovered in renegotiation." },
  { name: "Healthcare System",     employees: 2200, pbm: "Express Scripts", score: 44, exposure: "$3.2M", finding: "Owned pharmacy steering + restricted audit rights. Renegotiated to pass-through model, saving $2.8M annually." },
  { name: "Regional Logistics Co.", employees: 430, pbm: "OptumRx",        score: 51, exposure: "$680K", finding: "Missing step therapy override rights + no GDR guarantee. Added performance guarantees worth $420K/year." },
];

const PRICING_TIERS = [
  {
    name: "Single Analysis",
    price: "$999",
    interval: "per contract",
    desc: "One full AI audit — upload your contract and receive the complete fiduciary report within 60 seconds.",
    features: ["65-point fiduciary audit", "Full score report (0–100)", "Gap analysis per provision", "Model contract language", "Negotiation playbook", "PDF export"],
    cta: "Analyze Now",
    highlight: false,
  },
  {
    name: "Broker Monthly",
    price: "$1,499",
    interval: "per month",
    desc: "Unlimited analyses for your entire book of business. Includes client-ready PDF reports and comparison tools.",
    features: ["3 standard reports included", "Unlimited contract uploads", "All Single Analysis features", "Before/after comparison tool", "Multi-client dashboard", "Email client reports directly", "White-label ready"],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    interval: "annual",
    desc: "White-labeled deployment for insurance carriers, TPAs, and large brokerages with API access.",
    features: ["Everything in Broker Monthly", "API access & webhooks", "Custom branding & domain", "Dedicated CSM", "SLA guarantee", "Bulk upload & batch processing"],
    cta: "Contact Sales",
    highlight: false,
  },
];

function RoiCalculator() {
  const [spend, setSpend] = useState(2000000);
  const exposure = Math.round(spend * 0.18);
  const recoverable = Math.round(spend * 0.12);

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(155,28,46,0.06) 0%, rgba(0,43,92,0.08) 100%)", border: "1.5px solid rgba(155,28,46,0.20)", borderRadius: 20, padding: "40px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Target size={20} color={BB_CRIMSON} />
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>ROI Calculator</span>
      </div>
      <h3 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", marginBottom: 6, marginTop: 0 }}>How much is your PBM contract costing you?</h3>
      <p style={{ fontSize: 14, color: "#64748B", marginBottom: 32 }}>Enter your annual prescription drug spend to estimate hidden PBM costs.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 32 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", textTransform: "uppercase" }}>Annual Rx Spend</label>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: BB_CRIMSON }}>$</span>
          <input
            type="range"
            min={250000}
            max={20000000}
            step={250000}
            value={spend}
            onChange={e => setSpend(Number(e.target.value))}
            style={{ flex: 1, accentColor: BB_CRIMSON }}
          />
          <span style={{ fontSize: 20, fontWeight: 900, color: "#0F172A", minWidth: 120, textAlign: "right" }}>{(spend / 1000000).toFixed(1)}M</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.20)", borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#DC2626", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Estimated Hidden Exposure</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#0F172A" }}>${(exposure / 1000000).toFixed(2)}M</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>spread pricing, rebate retention & specialty steering</div>
        </div>
        <div style={{ background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.20)", borderRadius: 14, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#059669", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>Typically Recoverable</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: "#0F172A" }}>${(recoverable / 1000000).toFixed(2)}M</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>through renegotiation using Rx Defense IQ findings</div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 16, textAlign: "center" }}>
        Based on independent actuarial benchmarks. Actual savings depend on contract terms and PBM model.
      </p>
    </div>
  );
}

export default function RxDefensePro() {
  const [, navigate] = useLocation();

  return (
    <Layout>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px", background: "#F8FAFC" }}>

        {/* ── HERO ──────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", padding: "80px 0 64px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.06)", border: "1px solid rgba(155,28,46,0.25)", borderRadius: 100, padding: "6px 18px", marginBottom: 32 }}>
            <Pill size={13} color={BB_CRIMSON} />
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Rx Defense IQ™ · Powered by Kincaid IQ</span>
          </div>

          <h1 style={{ fontSize: 56, fontWeight: 900, color: "#0F172A", lineHeight: 1.08, letterSpacing: "-0.03em", margin: "0 0 24px" }}>
            The PBM Contract Auditor<br />
            <span style={{ color: BB_CRIMSON }}>That Works Like a Senior Attorney</span>
          </h1>

          <p style={{ fontSize: 20, color: "#64748B", maxWidth: 680, margin: "0 auto 40px", lineHeight: 1.6 }}>
            Upload any PBM contract. In 30 seconds, AI identifies every fiduciary gap, quantifies the dollar exposure, and hands you the model language to fix it.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <button
              data-testid="btn-hero-analyze"
              onClick={() => navigate("/rx-defense")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 36px", background: `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1524 100%)`, color: "#fff", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 32px rgba(155,28,46,0.30)" }}
            >
              Analyze Your Contract <ArrowRight size={18} />
            </button>
            <button
              data-testid="btn-hero-demo"
              onClick={() => navigate("/rx-defense")}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 32px", background: "rgba(0,0,0,0.04)", color: "#0F172A", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer" }}
            >
              Run Demo Analysis
            </button>
          </div>
        </div>

        {/* ── STATS BAR ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "rgba(0,0,0,0.06)", borderRadius: 16, overflow: "hidden", marginBottom: 80, border: "1px solid rgba(0,0,0,0.08)" }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ background: "#FFFFFF", padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── WHAT IT AUDITS ────────────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON, marginBottom: 12 }}>13 Provisions · 65 Fiduciary Issues</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0F172A", margin: 0 }}>Everything Your PBM Doesn't Want You to Know</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {PROVISIONS.map((p) => (
              <div key={p.id} data-testid={`provision-card-${p.id}`} style={{ display: "flex", alignItems: "center", gap: 12, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "14px 18px" }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#CBD5E1", width: 22, flexShrink: 0 }}>{String(p.id).padStart(2, "0")}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#334155" }}>{p.name}</span>
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 6, background: RISK_BG[p.risk], color: RISK_COLOR[p.risk], flexShrink: 0 }}>{p.risk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES GRID ─────────────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON, marginBottom: 12 }}>What You Get</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0F172A", margin: 0 }}>Every Tool to Win at the Negotiating Table</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} style={{ background: "#FFFFFF", border: "1px solid rgba(155,28,46,0.15)", borderRadius: 16, padding: "28px 28px" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(155,28,46,0.08)", border: "1px solid rgba(155,28,46,0.20)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                    <Icon size={20} color={BB_CRIMSON} />
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0F172A", margin: "0 0 10px" }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7, margin: 0 }}>{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ROI CALCULATOR ────────────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <RoiCalculator />
        </div>

        {/* ── SAMPLE SCORE ──────────────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON, marginBottom: 12 }}>Real-World Results</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0F172A", margin: 0 }}>Case Studies</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {CASE_STUDIES.map((c) => (
              <div key={c.name} style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "28px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(155,28,46,0.08)", border: "1px solid rgba(155,28,46,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 size={20} color={BB_CRIMSON} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{c.employees.toLocaleString()} employees · {c.pbm}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#DC2626" }}>{c.score}</div>
                    <div style={{ fontSize: 9, color: "#DC2626", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Contract Score</div>
                  </div>
                  <div style={{ flex: 1, background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.18)", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#D97706" }}>{c.exposure}</div>
                    <div style={{ fontSize: 9, color: "#D97706", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Exposure Found</div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.65, margin: 0 }}>{c.finding}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── PRICING ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 80 }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON, marginBottom: 12 }}>Pricing</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#0F172A", margin: 0 }}>Simple, Transparent, ROI-Positive</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {PRICING_TIERS.map((tier) => (
              <div key={tier.name} data-testid={`pricing-tier-${tier.name.toLowerCase().replace(/\s/g, "-")}`}
                style={{ background: tier.highlight
                  ? `linear-gradient(145deg, rgba(155,28,46,0.08) 0%, rgba(0,43,92,0.10) 100%)`
                  : "#FFFFFF",
                  border: tier.highlight ? `2px solid rgba(155,28,46,0.45)` : "1px solid rgba(0,0,0,0.09)",
                  borderRadius: 20, padding: "36px 32px", display: "flex", flexDirection: "column", gap: 20, position: "relative" }}>
                {tier.highlight && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: BB_CRIMSON, color: "#fff", fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 16px", borderRadius: 100 }}>Most Popular</div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: tier.highlight ? BB_CRIMSON : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>{tier.name}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 42, fontWeight: 900, color: "#0F172A" }}>{tier.price}</span>
                    <span style={{ fontSize: 13, color: "#94A3B8" }}>/ {tier.interval}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, margin: 0 }}>{tier.desc}</p>
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#334155" }}>
                      <CheckCircle2 size={14} color={tier.highlight ? BB_CRIMSON : "#10B981"} style={{ flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid={`btn-tier-${tier.name.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => navigate(tier.cta === "Contact Sales" ? "/" : "/pricing")}
                  style={{ marginTop: "auto", padding: "14px 0", borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: "pointer", border: tier.highlight ? "none" : "1px solid rgba(0,0,0,0.15)", background: tier.highlight ? `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1524 100%)` : "transparent", color: tier.highlight ? "#fff" : "#334155", boxShadow: tier.highlight ? "0 6px 24px rgba(155,28,46,0.30)" : "none" }}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA FOOTER ────────────────────────────────────────── */}
        <div style={{ textAlign: "center", background: `linear-gradient(135deg, rgba(155,28,46,0.06) 0%, rgba(0,43,92,0.08) 100%)`, border: "1.5px solid rgba(155,28,46,0.20)", borderRadius: 24, padding: "64px 48px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>KIQ</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#475569" }}>Kincaid IQ Intelligence Platform</span>
          </div>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: "#0F172A", margin: "0 0 16px", lineHeight: 1.1 }}>Your clients' PBM contracts<br />are costing them money right now.</h2>
          <p style={{ fontSize: 17, color: "#64748B", margin: "0 0 40px" }}>Upload a contract and have the full fiduciary audit in under 60 seconds.</p>
          <button
            data-testid="btn-footer-cta"
            onClick={() => navigate("/rx-defense")}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "18px 48px", background: `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1524 100%)`, color: "#fff", border: "none", borderRadius: 16, fontSize: 18, fontWeight: 900, cursor: "pointer", boxShadow: "0 10px 40px rgba(155,28,46,0.30)" }}
          >
            Start Analyzing Contracts <ArrowRight size={20} />
          </button>
          <div style={{ marginTop: 20, fontSize: 12, color: "#94A3B8" }}>
            No setup required · First analysis free with demo contract · CAA 2026 aligned
          </div>
        </div>

      </div>
    </Layout>
  );
}
