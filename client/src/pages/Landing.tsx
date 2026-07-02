import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Shield, TrendingUp, Briefcase, Search, ArrowRight, Mail, Phone,
  X, ChevronDown, Menu,
} from "lucide-react";
import { SiLinkedin, SiInstagram, SiTiktok } from "react-icons/si";

// ── Shared colors ──────────────────────────────────────────────────────────────
const CYAN  = "#00B4D8";
const GOLD  = "#C9A84C";
const BG    = "#0a0a0a";
const CARD  = "#111111";
const BORDER = "rgba(255,255,255,0.08)";

// ── Shared nav ─────────────────────────────────────────────────────────────────
function PublicNav({ active }: { active?: string }) {
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { label: "Solutions",        href: "/solutions" },
    { label: "Kincaid IQ",       href: "/landing"   },
    { label: "Capital Library",  href: "/capital-library" },
    { label: "Family Offices",   href: "/family-offices"  },
    { label: "Contact",          href: "/contact"    },
  ];
  return (
    <nav className="fixed top-0 left-0 right-0 z-50"
      style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/landing">
          <span className="font-bold text-xl tracking-tight text-white cursor-pointer select-none">KRMC</span>
        </Link>
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <Link key={l.label} href={l.href}>
              <span className="text-sm cursor-pointer transition-colors"
                style={{ color: active === l.label ? "#fff" : "rgba(255,255,255,0.55)" }}>
                {l.label}
              </span>
            </Link>
          ))}
        </div>
        {/* Mobile toggle */}
        <button className="md:hidden text-white/60 hover:text-white" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t px-6 py-4 space-y-3" style={{ borderColor: BORDER, background: BG }}>
          {links.map(l => (
            <Link key={l.label} href={l.href}>
              <div className="text-sm py-1 cursor-pointer" style={{ color: "rgba(255,255,255,0.7)" }}
                onClick={() => setMobileOpen(false)}>
                {l.label}
              </div>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}



// ── Footer ─────────────────────────────────────────────────────────────────────
function PublicFooter() {
  return (
    <footer className="border-t py-10 px-6" style={{ borderColor: BORDER, background: BG }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="font-bold text-xl text-white mb-1">KRMC</div>
            <p className="text-sm max-w-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Kincaid RMC builds evidence-based governance systems for organizations that operate under board scrutiny.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://linkedin.com/in/jfshrack" target="_blank" rel="noreferrer"
              className="text-white/30 hover:text-white transition-colors"><SiLinkedin className="w-5 h-5" /></a>
            <a href="https://instagram.com/jfshrack" target="_blank" rel="noreferrer"
              className="text-white/30 hover:text-white transition-colors"><SiInstagram className="w-5 h-5" /></a>
            <a href="https://tiktok.com/@jman88898" target="_blank" rel="noreferrer"
              className="text-white/30 hover:text-white transition-colors"><SiTiktok className="w-5 h-5" /></a>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-2 text-xs"
          style={{ borderColor: BORDER, color: "rgba(255,255,255,0.25)" }}>
          <span>© {new Date().getFullYear()} Kincaid Risk Management Consultants. All rights reserved.</span>
          <span>Fiduciary-grade · AES-256 Encrypted · SOC 2 Type II</span>
        </div>
      </div>
    </footer>
  );
}

// ── HOME PAGE ──────────────────────────────────────────────────────────────────
export default function Landing() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Shield,
      title: "Audit-Grade Evidence",
      desc: "Every metric backed by verifiable claims data, contract terms, and defined methodologies. No black boxes.",
    },
    {
      icon: TrendingUp,
      title: "Real-Time Analytics",
      desc: "Live dashboards showing actual plan performance, spend patterns, and outlier detection across pharmacy and medical.",
    },
    {
      icon: Briefcase,
      title: "CFO-Ready Reports",
      desc: "Executive summaries with actionable insights, ranked decision levers, and exportable evidence packs for governance.",
    },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <PublicNav active="Kincaid IQ" />
      <div className="pt-14" />

      {/* Hero */}
      <section className="relative px-6 py-28 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 70% 55% at 50% 0%, ${CYAN}0d 0%, transparent 70%)` }} />
        <div className="max-w-4xl mx-auto relative">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
            style={{ color: CYAN, border: `1px solid ${CYAN}35`, background: `${CYAN}0a` }}
            data-testid="badge-platform">
            KINCAID IQ PLATFORM
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
            Benefits Intelligence<br />
            <span className="italic font-light" style={{ color: CYAN }}>Built for Finance</span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.5)" }}>
            Transform employer health plans with audit-grade analytics, defensible metrics, and CFO-ready insights that expose leakage and quantify decision levers.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
            <button
              onClick={() => setLocation("/contact")}
              className="flex items-center gap-2 px-7 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: CYAN, color: "#000" }}
              data-testid="btn-request-demo">
              Request Demo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {["Audit-Grade Evidence", "Enterprise Security", "CFO-Ready Reports"].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: "#10b981" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl p-7 transition-all hover:brightness-110"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
              data-testid={`feature-card-${i}`}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${CYAN}15`, border: `1px solid ${CYAN}30` }}>
                <f.icon className="w-5 h-5" style={{ color: CYAN }} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Battlefields preview */}
      <section className="px-6 py-20 border-t" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: CYAN, background: `${CYAN}0a`, border: `1px solid ${CYAN}25` }}>
            KINCAID IQ · SOLUTIONS
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Four Battlefields.<br />Board-Defensible Outcomes.
          </h2>
          <p className="text-lg mb-12" style={{ color: "rgba(255,255,255,0.4)" }}>
            Premium, evidence-first solutions built for CFOs, COOs, Boards, and investors
          </p>
          <Link href="/solutions">
            <button className="px-7 py-3 rounded-lg font-semibold text-sm transition-all hover:opacity-80"
              style={{ background: "transparent", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.6)" }}>
              View All Solutions →
            </button>
          </Link>
        </div>
      </section>

      <PublicFooter />

    </div>
  );
}

// ── SOLUTIONS PAGE ─────────────────────────────────────────────────────────────
export function SolutionsPage() {
  const battlefields = [
    {
      badge: "PBM & Pharmacy Transparency",
      dot: CYAN,
      title: "Expose the real economics—without vendor narratives.",
      desc: "Reconcile claims, contract terms, invoices, and remittance to surface pricing variance, rebate realization, and incentive misalignment—delivered as board-ready evidence, not opinions.",
      tags: ["Recoverable $", "Contract Variance"],
      proof: "No KPI without evidence. No insight without lineage.",
    },
    {
      badge: "GLP-1 Strategy & Financial Control",
      dot: "#10b981",
      title: "Turn GLP-1 from trend into governed margin duration.",
      desc: "Quantify penetration, persistence, run-rate exposure, and stop-loss interaction—then establish controls a CFO can defend and a board can govern.",
      tags: ["Run-Rate Risk", "Governance Control"],
      proof: "Economic substance over form—built for scrutiny.",
    },
    {
      badge: "Stop-Loss & Funding Architecture",
      dot: "#8b5cf6",
      title: "Reduce volatility and renewal shock with structure.",
      desc: "Model large-claim distribution realities, laser exposure, and attachment strategy—delivering a funding architecture aligned to risk tolerance, capital strategy, and board accountability.",
      tags: ["Volatility Index", "Renewal Shock Risk"],
      proof: "Finance-committee language, not benefits theater.",
    },
    {
      badge: "Broker Oversight & Compensation Forensics",
      dot: GOLD,
      title: "Make incentives visible—and accountable.",
      desc: "Map compensation flows, disclosures, and incentive structures—then translate that into a board-ready scorecard that converts opacity into governance.",
      tags: ["Disclosure Quality", "Conflict Risk"],
      proof: "Board accountability is a feature—not a meeting agenda.",
    },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <PublicNav active="Solutions" />
      <div className="pt-14" />
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: CYAN, background: `${CYAN}0a`, border: `1px solid ${CYAN}25` }}>
              KINCAID IQ · SOLUTIONS
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Four Battlefields.<br />Board-Defensible Outcomes.
            </h1>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
              Premium, evidence-first solutions built for CFOs, COOs, Boards, and investors—designed to withstand{" "}
              <span className="text-white/80 italic">diligence, audit, and exit scrutiny.</span>
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-12">
            {battlefields.map((b, i) => (
              <div key={i} className="rounded-2xl p-6 flex flex-col gap-4"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
                data-testid={`battlefield-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${b.dot}15`, color: b.dot, border: `1px solid ${b.dot}30` }}>
                    {b.badge}
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: b.dot }} />
                </div>
                <h3 className="text-xl font-bold text-white leading-snug">{b.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{b.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {b.tags.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: `1px solid ${BORDER}` }}>
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-xs italic" style={{ color: b.dot }}>
                  <span className="font-bold not-italic">Proof posture:</span> {b.proof}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-8"
              style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
              HOW IT WORKS
            </div>
          </div>
        </div>
      </section>
      <PublicFooter />

    </div>
  );
}

// ── CAPITAL LIBRARY PAGE ───────────────────────────────────────────────────────
export function CapitalLibraryPage() {
  const [query, setQuery] = useState("");

  const articles = [
    { title: "Compensation Committee Policy: AI Governance Incentive Alignment", date: "2025-12-25", desc: "Board-defensible framework to align executive compensation with AI governance, predictability, and evidence-backed decision integrity.", tags: ["compensation", "AI governance", "executive incentives", "board policy", "CHI-AI", "fiduciary duty"] },
    { title: "Capital Is Governance, Not Just Money", date: "2025-12-18", desc: "Capital allocation is a governance system. This framework explains why most companies mis-measure capital decisions and how to build investor-grade decision loops.", tags: ["capital", "governance", "board", "fiduciary", "investor-grade", "evidence", "KPI"] },
    { title: "Fiduciary Risk in the Age of AI", date: "2025-12-18", desc: "AI changes fiduciary exposure by accelerating decision velocity without improving evidence quality. This brief gives a board-level control framework.", tags: ["fiduciary", "AI", "board", "risk", "governance"] },
    { title: "PBM Rebate Forensics: ERISA §408(b)(2) Compliance Guide", date: "2025-11-30", desc: "Step-by-step guide for plan sponsors demanding full rebate disclosure and audit rights. With sample contract language.", tags: ["PBM", "ERISA", "rebates", "fiduciary", "audit"] },
    { title: "GLP-1 Formulary Governance: A Board-Level Framework", date: "2025-11-15", desc: "How to establish financial controls around GLP-1 utilization that survive regulatory scrutiny and board review.", tags: ["GLP-1", "formulary", "governance", "board", "pharmacy"] },
    { title: "Stop-Loss Architecture for Self-Funded Plans", date: "2025-10-28", desc: "Attachment point modeling, laser exposure, and aggregate corridor design for plan sponsors who need board-defensible funding architecture.", tags: ["stop-loss", "self-funded", "aggregate", "lasering", "risk"] },
  ];

  const filtered = articles.filter(a =>
    !query || a.title.toLowerCase().includes(query.toLowerCase())
    || a.desc.toLowerCase().includes(query.toLowerCase())
    || a.tags.some(t => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <PublicNav active="Capital Library" />
      <div className="pt-14" />
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.5)" }}>
              📖 Board-Safe Doctrine
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">Capital Library</h1>
            <p className="text-lg" style={{ color: "rgba(255,255,255,0.4)" }}>
              Decision delivery, evidence-backed governance, and capital defense.<br />
              Written for CFOs, CEOs, and operators who defend what they built.
            </p>
          </div>
          <div className="flex gap-3 mb-10">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none placeholder:text-white/25"
                style={{ background: "#1a1a1a", border: `1px solid ${BORDER}` }}
                placeholder="Search articles… (e.g., liquidity, governance, variance)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                data-testid="input-library-search"
              />
            </div>
            <button className="px-5 py-3 rounded-xl text-sm font-semibold"
              style={{ background: CYAN, color: "#000" }}>
              Search
            </button>
          </div>
          <div className="space-y-4">
            {filtered.map((a, i) => (
              <div key={i} className="rounded-2xl p-6 cursor-pointer transition-all hover:brightness-110"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
                data-testid={`article-${i}`}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-lg font-semibold text-white leading-snug">{a.title}</h3>
                  <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>{a.date}</span>
                </div>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{a.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {a.tags.map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: `1px solid ${BORDER}` }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-white/25 text-sm">No articles found for "{query}"</div>
            )}
          </div>
        </div>
      </section>
      <PublicFooter />

    </div>
  );
}

// ── FAMILY OFFICES PAGE ────────────────────────────────────────────────────────
export function FamilyOfficesPage() {
  const [activeTab, setActiveTab] = useState<"vc" | "ma">("vc");

  const services = [
    {
      title: "Governance & Decision Intelligence",
      desc: "Independent, conflict-free analysis and board/council-ready decision artifacts. No automated decisions. No black boxes.",
      bullets: [
        "Evidence-first analysis across finance, ops, workforce, IT, and contracts",
        "Scenario framing & trade-off clarity",
        "Fiduciary documentation and audit-ready outputs",
      ],
    },
    {
      title: "Venture Capital Support",
      desc: "For direct investing, venture studios, and strategic minority stakes—diligence and governance without chasing deal flow.",
      bullets: [
        "Pre-investment diligence (financial, operational, governance risk)",
        "Portfolio KPI systems for long-horizon oversight",
        "Independent validation of management claims",
      ],
    },
    {
      title: "M&A Support",
      desc: "Buy-side and sell-side diligence with integration-risk realism—so issues surface before they become permanent.",
      bullets: [
        "Buy-side & sell-side diligence",
        "Governance and integration risk assessment",
        "Board reporting during transition periods",
      ],
    },
  ];

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <PublicNav active="Family Offices" />
      <div className="pt-14" />
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4 text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
            LOCAL · INTERNATIONAL · SOVEREIGN-ADJACENT
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">How We Serve Family Offices</h1>
          <p className="text-lg max-w-2xl mb-8" style={{ color: "rgba(255,255,255,0.45)" }}>
            Family offices operate differently. Capital is permanent. Reputation is inherited. Decisions must hold up over decades—not quarters. Kincaid Risk Management Consultants strengthens fiduciary judgment with evidence, governance, and defensibility.
          </p>
          <div className="flex gap-3 mb-12">
            <button onClick={() => setActiveTab("vc")}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: activeTab === "vc" ? "rgba(255,255,255,0.08)" : "transparent",
                border: `1px solid ${activeTab === "vc" ? "rgba(255,255,255,0.2)" : BORDER}`,
                color: activeTab === "vc" ? "#fff" : "rgba(255,255,255,0.4)",
              }}
              data-testid="tab-vc">
              Venture Capital Support
            </button>
            <button onClick={() => setActiveTab("ma")}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: activeTab === "ma" ? "rgba(255,255,255,0.08)" : "transparent",
                border: `1px solid ${activeTab === "ma" ? "rgba(255,255,255,0.2)" : BORDER}`,
                color: activeTab === "ma" ? "#fff" : "rgba(255,255,255,0.4)",
              }}
              data-testid="tab-ma">
              M&A Support
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-16">
            {services.map((s, i) => (
              <div key={i} className="rounded-2xl p-6"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}
                data-testid={`service-card-${i}`}>
                <h3 className="font-bold text-white text-lg mb-3">{s.title}</h3>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>{s.desc}</p>
                <ul className="space-y-2">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                      <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-white/40" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-white text-lg mb-4">Local & International Reach</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-semibold text-white mb-2">United States</div>
                  <ul className="space-y-1.5 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <li>Middle-market family offices</li>
                    <li>Healthcare, technology, real estate, infrastructure exposure</li>
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-2">International & Gulf</div>
                  <ul className="space-y-1.5 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <li>Multi-generational governance structures</li>
                    <li>Sovereign-adjacent capital environments</li>
                    <li>Cross-border entities and compliance</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="rounded-2xl p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-bold text-white text-lg mb-4">Why Family Offices Work With Kincaid</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { label: "Independent:", text: "No placement fees. No conflicted incentives." },
                  { label: "Evidence-first:", text: "Traceable sources, clear limitations." },
                  { label: "Governance-grade:", text: "Built for boards, councils, and regulators." },
                  { label: "Global credibility:", text: "Local execution, international posture." },
                ].map(item => (
                  <li key={item.label} className="flex gap-2">
                    <span className="font-bold text-white">{item.label}</span>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <PublicFooter />

    </div>
  );
}

// ── CONTACT PAGE ───────────────────────────────────────────────────────────────
export function ContactPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <PublicNav active="Contact" />
      <div className="pt-14" />
      <section className="px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Let's Talk</h1>
          <p className="text-lg mb-12" style={{ color: "rgba(255,255,255,0.45)" }}>
            Building evidence-based systems that survive board scrutiny. Reach out directly.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <a href="mailto:jer@kincaidrmc.com" data-testid="link-email"
              className="rounded-2xl p-6 flex items-center gap-4 transition-all hover:brightness-110 text-left"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${CYAN}15`, border: `1px solid ${CYAN}30` }}>
                <Mail className="w-5 h-5" style={{ color: CYAN }} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>EMAIL</div>
                <div className="text-sm font-semibold text-white">jer@kincaidrmc.com</div>
              </div>
            </a>
            <a href="tel:+12192563331" data-testid="link-phone"
              className="rounded-2xl p-6 flex items-center gap-4 transition-all hover:brightness-110 text-left"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
                <Phone className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>PHONE</div>
                <div className="text-sm font-semibold text-white">219.256.3331</div>
              </div>
            </a>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(255,255,255,0.25)" }}>
            CONNECT ON SOCIAL
          </div>
          <div className="grid grid-cols-3 gap-4 mb-12">
            {[
              { icon: SiLinkedin, label: "LinkedIn", sub: "Connect professionally", href: "https://linkedin.com/in/jfshrack", color: "#0077b5" },
              { icon: SiInstagram, label: "Instagram", sub: "@jfshrack", href: "https://instagram.com/jfshrack", color: "#e1306c" },
              { icon: SiTiktok, label: "TikTok", sub: "@jman88898", href: "https://tiktok.com/@jman88898", color: "#000" },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" data-testid={`link-social-${s.label.toLowerCase()}`}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 transition-all hover:brightness-110"
                style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <s.icon className="w-6 h-6" style={{ color: "rgba(255,255,255,0.6)" }} />
                <div className="text-sm font-semibold text-white">{s.label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{s.sub}</div>
              </a>
            ))}
          </div>
          <div className="rounded-2xl px-6 py-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Kincaid RMC builds evidence-based governance systems for organizations that operate under board scrutiny.
              Our solutions are designed for leaders who need defensible answers, not chatbot performance.
            </p>
          </div>
        </div>
      </section>
      <PublicFooter />

    </div>
  );
}
