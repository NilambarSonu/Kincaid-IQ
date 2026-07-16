import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Shield, TrendingUp, Briefcase, Search, ArrowRight, Mail, Phone,
  X, ChevronDown, Menu,
} from "lucide-react";
import { SiLinkedin, SiInstagram, SiTiktok } from "react-icons/si";

// ── Shared light palette ────────────────────────────────────────────────────────
const PRIMARY = "hsl(var(--kincaid-crimson))";
const NAVY = "hsl(var(--kincaid-navy))";
const SKY = "hsl(var(--kincaid-sky))";
const GOLD = "hsl(var(--kincaid-gold))";
const BORDER = "rgba(0,0,0,0.06)";

// ── Shared nav ─────────────────────────────────────────────────────────────────
function PublicNav({ active }: { active?: string }) {
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { label: "Solutions",        href: "/solutions" },
    { label: "Kincaid Health",   href: "/landing"   },
    { label: "Capital Library",  href: "/capital-library" },
    { label: "Family Offices",   href: "/family-offices"  },
    { label: "Contact",          href: "/contact"    },
  ];
  return (
    <nav className="kiq-public-nav">
      <div className="kiq-public-container flex h-16 items-center justify-between">
        <Link href="/landing">
          <span className="kiq-public-wordmark cursor-pointer select-none">
            Kincaid Health
          </span>
        </Link>
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <Link key={l.label} href={l.href}>
              <span className={`kiq-public-link cursor-pointer ${active === l.label ? "is-active" : ""}`}>
                {l.label}
              </span>
            </Link>
          ))}
          <button 
            onClick={() => setLocation("/auth")}
            className="kincaid-btn kincaid-btn-primary cursor-pointer px-5 py-2 text-xs"
          >
            Access Platform
          </button>
        </div>
        {/* Mobile toggle */}
        <button className="md:hidden text-[var(--kiq-muted)] hover:text-[var(--kiq-ink)]" onClick={() => setMobileOpen(v => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="space-y-3 border-t border-[rgba(13,37,61,0.08)] bg-[var(--kiq-surface)]/92 px-6 py-4 md:hidden">
          {links.map(l => (
            <Link key={l.label} href={l.href}>
              <div className="kiq-public-link cursor-pointer py-2"
                onClick={() => setMobileOpen(false)}>
                {l.label}
              </div>
            </Link>
          ))}
          <button 
            onClick={() => { setMobileOpen(false); setLocation("/auth"); }}
            className="kincaid-btn kincaid-btn-primary w-full cursor-pointer py-3"
          >
            Access Platform
          </button>
        </div>
      )}
    </nav>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function PublicFooter() {
  return (
    <footer className="kiq-public-footer">
      <div className="kiq-public-container">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="kiq-public-wordmark mb-4">Kincaid Health</div>
            <p className="max-w-sm text-sm leading-relaxed text-[color:var(--kiq-muted)]">
              Kincaid Health builds evidence-based governance systems for organizations that operate under board scrutiny.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://linkedin.com/in/jfshrack" target="_blank" rel="noreferrer"
              className="text-[color:var(--kiq-muted)] transition-colors hover:text-[color:var(--kiq-primary-deep)]"><SiLinkedin className="w-5 h-5" /></a>
            <a href="https://instagram.com/jfshrack" target="_blank" rel="noreferrer"
              className="text-[color:var(--kiq-muted)] transition-colors hover:text-[color:var(--kiq-primary-deep)]"><SiInstagram className="w-5 h-5" /></a>
            <a href="https://tiktok.com/@jman88898" target="_blank" rel="noreferrer"
              className="text-[color:var(--kiq-muted)] transition-colors hover:text-[color:var(--kiq-primary-deep)]"><SiTiktok className="w-5 h-5" /></a>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[rgba(13,37,61,0.08)] pt-8 text-xs font-semibold text-[color:var(--kiq-subtle)] md:flex-row"
          style={{ borderColor: BORDER }}>
          <span>© {new Date().getFullYear()} Kincaid Health. All rights reserved.</span>
          <span>Fiduciary-grade · AES-256 Encrypted · SOC 2 Type II · ERISA §408(b)(2) Ready</span>
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
    <div className="kiq-public-shell">
      <PublicNav active="Kincaid Health" />
      <div className="pt-16" />

      {/* Hero */}
      <section className="relative px-6 py-32 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 70% 55% at 50% 0%, rgba(155,28,46,0.05) 0%, transparent 75%)` }} />
        <div className="kiq-public-container relative z-10 animate-kincaid-slide-up">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase border border-red-500/20 bg-red-500/5 text-red-700"
            data-testid="badge-platform">
            KINCAID HEALTH PLATFORM
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6 font-display text-[var(--kiq-ink)]">
            Benefits Intelligence<br />
            <span className="italic font-light text-red-600 font-sans">Built for Finance</span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 text-[var(--kiq-muted)] leading-relaxed">
            Transform employer health plans with audit-grade analytics, defensible metrics, and CFO-ready insights that expose leakage and quantify decision levers.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-10">
            <button
              onClick={() => setLocation("/contact")}
              className="kincaid-btn kincaid-btn-primary py-3 px-8 text-sm rounded-xl cursor-pointer shadow-lg shadow-red-500/10 border-none flex items-center gap-2"
              data-testid="btn-request-demo"
            >
              Request Demo <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLocation("/solutions")}
              className="kincaid-btn kincaid-btn-secondary py-3 px-8 text-sm rounded-xl cursor-pointer border border-[var(--kiq-hairline)] bg-[var(--kiq-surface)] text-[var(--kiq-ink-soft)] shadow-sm"
            >
              Explore Solutions
            </button>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm text-[var(--kiq-subtle)] font-medium">
            {["Audit-Grade Evidence", "Enterprise Security", "CFO-Ready Reports"].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-24 relative z-10">
        <div className="kiq-public-container grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="glass-3d p-7 bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)]/50 shadow-glass rounded-2xl flex flex-col items-start text-left"
              data-testid={`feature-card-${i}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-red-500/5 border border-red-500/15">
                <f.icon className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-[var(--kiq-ink)] mb-3 font-display">{f.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--kiq-muted)]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solutions Preview */}
      <section className="px-6 py-24 border-t border-[var(--kiq-hairline)] bg-[var(--kiq-surface)]" style={{ borderColor: BORDER }}>
        <div className="kiq-public-container text-center">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4 border border-red-500/20 bg-red-500/5 text-red-700">
            KINCAID HEALTH · SOLUTIONS
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[var(--kiq-ink)] mb-6 font-display">
            Four Battlefields.<br />Board-Defensible Outcomes.
          </h2>
          <p className="text-lg mb-12 text-[var(--kiq-muted)] max-w-2xl mx-auto leading-relaxed">
            Premium, evidence-first solutions built for CFOs, COOs, Boards, and investors who demand precision over vendor narratives.
          </p>
          <Link href="/solutions">
            <button className="kincaid-btn kincaid-btn-secondary py-3 px-8 text-sm rounded-xl cursor-pointer border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)] text-[var(--kiq-ink-soft)] shadow-sm">
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
      dot: "hsl(var(--kincaid-crimson))",
      bg: "rgba(155,28,46,0.05)",
      title: "Expose the real economics—without vendor narratives.",
      desc: "Reconcile claims, contract terms, invoices, and remittance to surface pricing variance, rebate realization, and incentive misalignment—delivered as board-ready evidence, not opinions.",
      tags: ["Recoverable $", "Contract Variance"],
      proof: "No KPI without evidence. No insight without lineage.",
    },
    {
      badge: "GLP-1 Strategy & Financial Control",
      dot: "hsl(var(--kincaid-emerald))",
      bg: "rgba(16,185,129,0.05)",
      title: "Turn GLP-1 from trend into governed margin duration.",
      desc: "Quantify penetration, persistence, run-rate exposure, and stop-loss interaction—then establish controls a CFO can defend and a board can govern.",
      tags: ["Run-Rate Risk", "Governance Control"],
      proof: "Economic substance over form—built for scrutiny.",
    },
    {
      badge: "Stop-Loss & Funding Architecture",
      dot: "hsl(270,60%,55%)",
      bg: "rgba(139,92,246,0.05)",
      title: "Reduce volatility and renewal shock with structure.",
      desc: "Model large-claim distribution realities, laser exposure, and attachment strategy—delivering a funding architecture aligned to risk tolerance, capital strategy, and board accountability.",
      tags: ["Volatility Index", "Renewal Shock Risk"],
      proof: "Finance-committee language, not benefits theater.",
    },
    {
      badge: "Broker Oversight & Compensation Forensics",
      dot: "hsl(var(--kincaid-gold))",
      bg: "rgba(251,191,36,0.05)",
      title: "Make incentives visible—and accountable.",
      desc: "Map compensation flows, disclosures, and incentive structures—then translate that into a board-ready scorecard that converts opacity into governance.",
      tags: ["Disclosure Quality", "Conflict Risk"],
      proof: "Board accountability is a feature—not a meeting agenda.",
    },
  ];

  return (
    <div className="kiq-public-shell">
      <PublicNav active="Solutions" />
      <div className="pt-16" />
      <section className="px-6 py-24">
        <div className="kiq-public-container">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-4 border border-red-500/20 bg-red-500/5 text-red-700">
              KINCAID HEALTH · SOLUTIONS
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-[var(--kiq-ink)] mb-6 font-display">
              Four Battlefields.<br />Board-Defensible Outcomes.
            </h1>
            <p className="text-lg max-w-2xl mx-auto text-[var(--kiq-muted)] leading-relaxed">
              Premium, evidence-first solutions built for CFOs, COOs, Boards, and investors—designed to withstand{" "}
              <span className="text-[var(--kiq-ink-soft)] font-semibold italic">diligence, audit, and exit scrutiny.</span>
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {battlefields.map((b, i) => (
              <div key={i} className="kiq-public-card p-7 flex flex-col gap-5 text-left"
                data-testid={`battlefield-${i}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                    style={{ background: b.bg, color: b.dot, borderColor: b.dot + "20" }}>
                    {b.badge}
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: b.dot }} />
                </div>
                <h3 className="text-xl font-bold text-[var(--kiq-ink)] leading-snug font-display">{b.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--kiq-muted)]">{b.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {b.tags.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)]">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-xs italic mt-auto" style={{ color: b.dot }}>
                  <span className="font-bold not-italic text-[var(--kiq-ink-soft)]">Proof posture:</span> {b.proof}
                </p>
              </div>
            ))}
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
    <div className="kiq-public-shell">
      <PublicNav active="Capital Library" />
      <div className="pt-16" />
      <section className="px-6 py-20">
        <div className="kiq-public-container">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-5 bg-red-500/5 border border-red-500/10 text-red-700">
              📖 Board-Safe Doctrine
            </div>
            <h1 className="text-5xl font-extrabold text-[var(--kiq-ink)] mb-4 font-display">Capital Library</h1>
            <p className="text-lg text-[var(--kiq-muted)] leading-relaxed">
              Decision delivery, evidence-backed governance, and capital defense.<br />
              Written for CFOs, CEOs, and operators who defend what they built.
            </p>
          </div>
          <div className="flex gap-3 mb-10">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--kiq-subtle)]" />
              <input
                className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-slate-950 outline-none placeholder:text-[var(--kiq-subtle)] bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="Search articles… (e.g., liquidity, governance, variance)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                data-testid="input-library-search"
              />
            </div>
            <button className="kincaid-btn kincaid-btn-primary py-3 px-6 text-sm rounded-xl cursor-pointer border-none shadow-md shadow-red-500/10">
              Search
            </button>
          </div>
          <div className="space-y-5">
            {filtered.map((a, i) => (
              <div key={i} className="kiq-public-card p-7 text-left"
                data-testid={`article-${i}`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-lg font-bold text-[var(--kiq-ink)] leading-snug font-display">{a.title}</h3>
                  <span className="text-xs flex-shrink-0 text-[var(--kiq-subtle)] font-semibold">{a.date}</span>
                </div>
                <p className="text-sm mb-4 leading-relaxed text-[var(--kiq-muted)]">{a.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {a.tags.map(t => (
                    <span key={t} className="text-[11px] px-2.5 py-1 rounded-full font-medium bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-[var(--kiq-subtle)] text-sm font-medium">No articles found for "{query}"</div>
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
    <div className="kiq-public-shell">
      <PublicNav active="Family Offices" />
      <div className="pt-16" />
      <section className="px-6 py-20">
        <div className="kiq-public-container">
          <div className="mb-4 text-xs font-bold uppercase tracking-widest text-[var(--kiq-subtle)]">
            LOCAL · INTERNATIONAL · SOVEREIGN-ADJACENT
          </div>
          <h1 className="text-5xl font-extrabold text-[var(--kiq-ink)] mb-6 font-display">How We Serve Family Offices</h1>
          <p className="text-lg max-w-3xl mb-10 text-[var(--kiq-muted)] leading-relaxed text-left">
            Family offices operate differently. Capital is permanent. Reputation is inherited. Decisions must hold up over decades—not quarters. Kincaid Health strengthens fiduciary judgment with evidence, governance, and defensibility.
          </p>
          <div className="flex gap-3 mb-10 justify-start">
            <button onClick={() => setActiveTab("vc")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{
                background: activeTab === "vc" ? "hsl(var(--kincaid-crimson))" : "#ffffff",
                border: `1px solid ${activeTab === "vc" ? "hsl(var(--kincaid-crimson))" : "rgba(0,0,0,0.08)"}`,
                color: activeTab === "vc" ? "#ffffff" : "hsl(var(--muted-foreground))",
                boxShadow: activeTab === "vc" ? "0 4px 12px rgba(155,28,46,0.15)" : "none",
              }}
              data-testid="tab-vc">
              Venture Capital Support
            </button>
            <button onClick={() => setActiveTab("ma")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
              style={{
                background: activeTab === "ma" ? "hsl(var(--kincaid-crimson))" : "#ffffff",
                border: `1px solid ${activeTab === "ma" ? "hsl(var(--kincaid-crimson))" : "rgba(0,0,0,0.08)"}`,
                color: activeTab === "ma" ? "#ffffff" : "hsl(var(--muted-foreground))",
                boxShadow: activeTab === "ma" ? "0 4px 12px rgba(155,28,46,0.15)" : "none",
              }}
              data-testid="tab-ma">
              M&A Support
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {services.map((s, i) => (
              <div key={i} className="kiq-public-card p-7 text-left flex flex-col"
                data-testid={`service-card-${i}`}>
                <h3 className="font-bold text-[var(--kiq-ink)] text-lg mb-4 font-display">{s.title}</h3>
                <p className="text-sm mb-5 leading-relaxed text-[var(--kiq-muted)]">{s.desc}</p>
                <ul className="space-y-3 mt-auto">
                  {s.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-[var(--kiq-muted)] leading-normal">
                      <span className="mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500/60" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="kiq-public-card p-7">
              <h3 className="font-bold text-[var(--kiq-ink)] text-lg mb-5 font-display">Local & International Reach</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-[var(--kiq-ink-soft)] mb-2 border-b pb-1">United States</div>
                  <ul className="space-y-2 text-sm text-[var(--kiq-muted)]">
                    <li>• Middle-market family offices</li>
                    <li>• Healthcare, real estate, and infrastructure exposure</li>
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--kiq-ink-soft)] mb-2 border-b pb-1">International & Gulf</div>
                  <ul className="space-y-2 text-sm text-[var(--kiq-muted)]">
                    <li>• Multi-generational structures</li>
                    <li>• Sovereign-adjacent capital</li>
                    <li>• Cross-border compliance</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="kiq-public-card p-7 flex flex-col justify-between">
              <h3 className="font-bold text-[var(--kiq-ink)] text-lg mb-4 font-display">Why Family Offices Work With Kincaid</h3>
              <ul className="space-y-3.5 text-sm">
                {[
                  { label: "Independent:", text: "No placement fees. No conflicted incentives." },
                  { label: "Evidence-first:", text: "Traceable sources, clear limitations." },
                  { label: "Governance-grade:", text: "Built for boards, councils, and regulators." },
                  { label: "Global credibility:", text: "Local execution, international posture." },
                ].map(item => (
                  <li key={item.label} className="flex gap-2 leading-relaxed">
                    <span className="font-bold text-[var(--kiq-ink-soft)]">{item.label}</span>
                    <span className="text-[var(--kiq-muted)]">{item.text}</span>
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
    <div className="kiq-public-shell">
      <PublicNav active="Contact" />
      <div className="pt-16" />
      <section className="px-6 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-5xl font-extrabold text-[var(--kiq-ink)] mb-4 font-display">Let's Talk</h1>
          <p className="text-lg mb-12 text-[var(--kiq-muted)] leading-relaxed">
            Building evidence-based systems that survive board scrutiny. Reach out directly.
          </p>
          <div className="grid grid-cols-2 gap-5 mb-10 text-left">
            <a href="mailto:jer@kincaidrmc.com" data-testid="link-email"
              className="kiq-public-card p-6 flex items-center gap-4 transition-all">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/5 border border-red-500/15">
                <Mail className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--kiq-subtle)] mb-0.5">EMAIL</div>
                <div className="text-sm font-bold text-[var(--kiq-ink-soft)]">jer@kincaidrmc.com</div>
              </div>
            </a>
            <a href="tel:+12192563331" data-testid="link-phone"
              className="kiq-public-card p-6 flex items-center gap-4 transition-all">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/5 border border-amber-500/15">
                <Phone className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--kiq-subtle)] mb-0.5">PHONE</div>
                <div className="text-sm font-bold text-[var(--kiq-ink-soft)]">219.256.3331</div>
              </div>
            </a>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mb-6 text-[var(--kiq-subtle)]">
            CONNECT ON SOCIAL
          </div>
          <div className="grid grid-cols-3 gap-4 mb-12 text-center">
            {[
              { icon: SiLinkedin, label: "LinkedIn", sub: "Connect", href: "https://linkedin.com/in/jfshrack", color: "text-[#0077b5]" },
              { icon: SiInstagram, label: "Instagram", sub: "@jfshrack", href: "https://instagram.com/jfshrack", color: "text-[#e1306c]" },
              { icon: SiTiktok, label: "TikTok", sub: "@jman88898", href: "https://tiktok.com/@jman88898", color: "text-[var(--kiq-ink)]" },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" data-testid={`link-social-${s.label.toLowerCase()}`}
                className="kiq-public-card p-5 flex flex-col items-center gap-2 transition-all">
                <s.icon className={`w-6 h-6 ${s.color} opacity-80`} />
                <div className="text-sm font-bold text-[var(--kiq-ink-soft)] font-display">{s.label}</div>
                <div className="text-xs text-[var(--kiq-subtle)]">{s.sub}</div>
              </a>
            ))}
          </div>
          <div className="glass p-6 bg-[var(--kiq-canvas-parchment)]/50 border border-[var(--kiq-hairline)] rounded-2xl shadow-sm">
            <p className="text-sm leading-relaxed text-[var(--kiq-muted)]">
              Kincaid Health builds evidence-based governance systems for organizations that operate under board scrutiny.
              Our solutions are designed for leaders who need defensible answers, not chatbot performance.
            </p>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
