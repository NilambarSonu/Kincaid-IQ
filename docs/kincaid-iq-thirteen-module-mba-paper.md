# Thirteen Front Doors, One Fiduciary Engine: A Module-Level Analysis of the Kincaid IQ Healthcare Intelligence Platform

**A Stanford MBA Research Paper**

*Field: Strategy, Information Systems & Healthcare Economics. Prepared for discussion, June 2026.*

Author profile: M.B.A., Strategy, Stanford Graduate School of Business; analytical methodology grounded in Ph.D.-level economics (University of Chicago) — industrial organization, agency theory, and information economics.

---

## Abstract

The self-funded employer health plan is the largest under-audited pool of fiduciary capital in the American economy. A mid-market self-funded employer routes tens of millions of dollars a year through a chain of agents — brokers, third-party administrators (TPAs), pharmacy benefit managers (PBMs), carriers, and provider networks — under a legal regime (ERISA) that names the *employer* as the fiduciary of record and holds it personally accountable for the prudence of every dollar. Yet the employer is structurally the least-informed party in its own value chain. This is not a data problem; it is an *evidence* problem.

This paper conducts a module-level analysis of **Kincaid IQ**, a platform that addresses the evidence problem through thirteen analytical surfaces — what we call "front doors" — that all read from and write to a single evidence fabric keyed on the employer's federal tax identifier (EIN). We profile each module in turn: the **CFO War Room**, **HIOS (Healthcare Intelligence OS)**, the **Sales IQ Console**, the **Account Intel Hub**, **Sales IQ Intelligence**, **Sales OS**, **Filing Intelligence**, **Rx Defense IQ**, **RxPBM Intelligence**, **Stop-Loss IQ**, **Network IQ**, **Fiduciary IQ**, and the **RFP Intelligence OS**. For each, we state its economic purpose, its data substrate, and its analytical method. We then argue the strategic thesis that follows from the architecture: because the modules share an identity key, an evidence substrate, an economic vocabulary, and a constitutional doctrine, an insight produced in one surface is consumed — with its receipt intact — by every other. The result is not a software suite but a compounding intelligence asset, recently consolidated into a single **Company 360** dossier that proves the thesis at the level of running code.

**JEL classification:** D82 (asymmetric information), G22 (insurance), G34 (corporate governance), I11 (health: market structure), K32 (regulation), L14 (transactional relationships), M21 (business economics).

**Keywords:** agency theory, information economics, fiduciary forensics, ERISA, PBM transparency, evidence lineage, capital-efficiency intelligence, self-funded health plans.

---

## 1. Introduction: The Fiduciary's Information Deficit

Standard practice frames employer healthcare cost as a *reporting* problem: aggregate claims, benchmark them against a book of business, render a dashboard, and exhort the plan sponsor toward "engagement." This is a category error. It presumes the principal — the employer, and through it the plan's participants — lacks *information*. The binding constraint is not information; it is **enforceable evidence** about the conduct of the agents the principal has hired.

The distinction is the entire thesis. A dashboard that reports "your admin fees are in the 80th percentile" tells the fiduciary a number. It does not hand the fiduciary the filed federal document, the contract clause, the benchmark distribution, and the dollar-denominated consequence that together constitute a defensible finding under a Department of Labor (DOL) audit or in litigation. Under ERISA §404, the fiduciary's duty is procedural as much as substantive: it must be able to *show its work*. Software that produces numbers without receipts does not discharge that duty; it merely documents the fiduciary's exposure.

Kincaid IQ is architected around this distinction. Three design commitments recur across all thirteen modules:

1. **A single identity key.** Every employer is addressed by its EIN — the same identifier that ties a DOL Form 5500 filing to an SEC EDGAR filing to a PBM contract. The EIN is the join key that lets thirteen modules speak about the same legal entity without re-keying.
2. **A shared evidence substrate.** The platform's analytical spine is a corpus of roughly 937,000 DOL Form 5500 filings and 1.35 million Schedule A records (2020–2024), compiled into a columnar **DuckDB** analytics database for sub-second query. This is filed, federal, admissible data — not modeled estimates.
3. **A constitutional doctrine.** Every AI-generated and analyst-facing assertion is governed by three confidence tiers — **CERTIFIED** (contract clause + claim record + remittance, reconciled), **MODELED** (inference from incomplete evidence, with bounds disclosed), and **INSUFFICIENT_EVIDENCE** (no finding issued; logged as a gap). A finding never outruns its evidence.

The remainder of this paper profiles the thirteen modules through this lens, then derives the strategic consequence.

---

## 2. The Command Layer

### 2.1 CFO War Room

**Route:** `/cfo-war-room` · **Surface:** executive command center · **Substrate:** governed claims, decision receipts, and the cross-module roll-up.

The CFO War Room is the platform's apex synthesis surface — the board-room view. Its defining constraint is deliberately austere and is enforced as a hard rule of the platform doctrine: **one screen, four tiles, always.** The four tiles correspond to the four economic questions a board must answer about its health plan — Financial Exposure, Contract Integrity, Operational Behavior, and Strategic Leverage. Nothing reaches a tile unless it clears a governance gate: the underlying claim must be *verified*, its data freshness must be *current*, and its confidence must exceed a high threshold. Material that fails the gate is not softened or hidden — it is rendered as an explicit Tile-4 gap, because under the doctrine **INSUFFICIENT_EVIDENCE is a valid and reportable finding.**

The War Room is also where the platform's **seven-gate enforcement chain** (DEFINE → WIRE → VALIDATE → PROMOTE → COMPUTE → GATE → RENDER) becomes visible to the user: each drill level maps to a gate, so an executive clicking into a number is literally walking back up the provenance chain that produced it. Two further hard rules apply here and propagate everywhere: **every number is clickable into its receipts** (drill, not tooltip), and **no export is permitted without a SHA-256 evidence manifest.** The War Room thus operationalizes the paper's central claim — it is a surface engineered to make a fiduciary's claims *board-admissible*, not merely persuasive.

### 2.2 HIOS — Healthcare Intelligence OS

**Route:** `/hios` · **Surface:** multi-agent operations console · **Substrate:** DuckDB Form 5500, Rx Defense contracts, Fiduciary IQ plans, AI orchestration.

If the CFO War Room is the board's view, HIOS is the operator's view — a unified console for the day-to-day work of running a plan as a prudent fiduciary. Its distinguishing feature is a **multi-agent AI orchestration layer**. Rather than a single chatbot, HIOS coordinates specialized autonomous agents (ingestion, prioritization, and intelligence agents are the core trio in the platform's agent architecture), each operating under a shared governing persona that runs **three intelligence levels simultaneously**: claim-level forensics (always on), pattern-level anomaly detection, and strategic momentum control. The economic logic is division of cognitive labor: a forensics agent surfaces anomalies anchored to precise prevalence statistics, a prioritization agent ranks them by recoverable dollars and urgency, and an intelligence agent composes the next forcing function — the smallest commitment that advances a remediation. HIOS is where the platform behaves less like a report and more like a staff.

### 2.3 Sales IQ Console

**Route:** `/saas/broker` · **Surface:** broker prospecting and book-analysis console · **Substrate:** DOL Form 5500 (Indiana Prospect Engine, 2,500+ welfare/health-plan employers).

The Sales IQ Console is the go-to-market command surface for brokers and producers. It operates in two modes. In **Book Analysis mode**, a broker submits their existing 10–12 client roster and the engine returns a structural read of the book — industry mix, size distribution, renewal-month clustering, and plan-type concentration — and then computes *whitespace intelligence*: where the book is over- or under-exposed relative to the live filing universe. In **prospecting mode**, the console queries real Form 5500 data to surface scored, fit-ranked targets with opening angles and commission estimates, complete with a metro-level market map. The console matters strategically because it inverts the usual direction of sales tooling: instead of a CRM that records what a broker did, it is an evidence engine that tells the broker what the *federal record* says they should do next.

---

## 3. The Prospect-Intelligence Layer

### 3.1 Account Intel Hub

**Route:** `/account-intel` · **Surface:** firmographic & technographic enrichment · **Substrate:** external enrichment APIs (Apollo, Hunter, TheirStack, SAM.gov, Crunchbase) joined to the EIN spine.

The Account Intel Hub answers a question the federal filings cannot: *who do I actually call, and what is their environment?* It enriches an employer record with firmographic data (size, revenue, location, corporate structure), contact intelligence, and technographic signals — the HR, benefits, and payroll systems an employer runs. The economic insight is that an employer running a legacy benefits-administration stack is a different (and often more actionable) prospect than one on a modern platform, because the technographic signal predicts both the *pain* and the *replacement window*. The Hub is the bridge between the platform's filed-data intelligence and the human act of outreach.

### 3.2 Sales IQ Intelligence

**Route:** `/sales-iq-intel` · **Surface:** multi-state regulatory intelligence · **Substrate:** state-level PBM, broker-transparency, and fiduciary legislation.

Sales IQ Intelligence is the platform's regulatory cartography. It tracks the rapidly diverging landscape of state-level transparency and fiduciary law — PBM licensing regimes, broker-compensation disclosure mandates, and fiduciary-duty statutes — and assigns each state a strictness tier. The tier drives the *sales motion*: in a high-strictness jurisdiction, the platform leads with a fiduciary-and-compliance script (the law is the wedge); in a low-strictness jurisdiction, it leads with a pure cost-savings script. This is information economics applied to go-to-market: the same evidence is framed differently depending on which argument the local regulatory regime makes most binding.

### 3.3 Sales OS

**Route:** `/sales-os` · **Surface:** pre-call intelligence and pipeline · **Substrate:** DuckDB `employers` table, with an opportunity-scoring model and a PostgreSQL Kanban pipeline.

Sales OS is the producer's working surface for a single account. Given an EIN, it returns an *account detail* — the employer's filed welfare premiums, broker commissions, admin fees, participant count, and a derived **opportunity score** and **tier** — alongside a commission-rate computation (broker commissions as a percentage of welfare premium). It then carries the account through an eight-stage Kanban pipeline (target → research → outreach → discovery → proposal → negotiation → closed-won / closed-lost). The strategic point is *evidence-anchored selling*: every opener Sales OS generates is grounded in a number the employer filed with the federal government, which makes the conversation a discussion of the prospect's own disclosures rather than a vendor pitch.

### 3.4 Filing Intelligence

**Route:** `/filing-intel` · **Surface:** filing-to-pipeline conversion engine · **Substrate:** DuckDB `sch_h_2024` (≈937,000 plans).

Filing Intelligence is the top of the funnel — the engine that turns the entire national filing corpus into a prioritized, routed pipeline. It scores each filing on a 0–100 **Opportunity Intelligence Score**, a weighted composite of the economically meaningful signals in a Form 5500: covered lives (scale of the opportunity), total plan spend, evidence of excess administrative fees, broker-compensation opportunity, PBM/pharmacy indicators, and the regulatory environment of the employer's state. The score is not an end in itself; it is a *routing* instrument that decides which of the platform's downstream surfaces (Sales OS, Rx Defense, Stop-Loss IQ) an opportunity should flow into. Filing Intelligence is the clearest demonstration that the platform's moat is its data: nine hundred thousand filings are not a feature, they are a structural advantage that compounds with every join.

---

## 4. The Forensic-Analytics Layer

### 4.1 Rx Defense IQ

**Route:** `/rx-defense` · **Surface:** PBM contract forensic review · **Substrate:** uploaded PBM contracts, analyzed by a dual AI engine (OpenAI + Anthropic).

Rx Defense IQ is the platform's flagship forensic instrument. A user uploads a PBM contract (PDF, TXT, or DOCX) and the engine evaluates it against **65 fiduciary-aligned issues spanning 13 provisions** — spread pricing, rebate retention, definitional games around "generic" and "specialty," data-ownership and audit rights, and the other levers through which PBM contracts leak plan assets — producing a **0–100 fiduciary score**. Crucially, the score is paired with an economics layer: a **Dollar Exposure Estimator** translates each weak provision into a per-provision annual dollar figure as a function of member count and Rx spend, an **AI Executive Summary** renders the finding as a plain-English CFO brief, and a **Redline Generator** emits model contract language as a Word document. Rx Defense IQ is where the platform converts a legal document into a dollar-denominated, remediation-ready finding — the canonical example of evidence-with-a-receipt.

### 4.2 RxPBM Intelligence

**Route:** `/rx-pbm` · **Surface:** market-wide PBM benchmarking · **Substrate:** PBM market data and CMS transparency feeds.

Where Rx Defense IQ analyzes *one* contract, RxPBM Intelligence supplies the market context that makes a single contract legible. It benchmarks contract terms against the behavior of the dominant PBMs (CVS Caremark, Express Scripts, OptumRx) and against an industry-average and best-in-class standard, so that a fiduciary can answer not only "is this clause bad?" but "is this clause bad *relative to what I could obtain in this market?*" This is the difference between an absolute and a comparative judgment, and in negotiation the comparative judgment is the one with leverage.

### 4.3 Stop-Loss IQ

**Route:** `/stop-loss` · **Surface:** catastrophic-risk and attachment-point analysis · **Substrate:** stop-loss policies and DuckDB benchmarking data.

Stop-Loss IQ governs the tail risk of a self-funded plan: the catastrophic claims that, absent stop-loss reinsurance, could impair the employer's balance sheet. The module performs tiered **attachment-point analysis** (the specific and aggregate deductibles at which reinsurance engages), predicts catastrophic-claim exposure, computes an **IBNR** (incurred-but-not-reported) reserve, and compares carrier markets. The economic question it answers is one of optimal risk retention: how much volatility should the employer hold on its own books, and how much should it cede — and at what premium. It is actuarial science rendered as a decision surface.

### 4.4 Network IQ

**Route:** `/network-iq` · **Surface:** provider-network adequacy and leakage · **Substrate:** provider directories, member geography, and transparency files.

Network IQ analyzes the provider network — the supply side of the plan. It computes **adequacy scores** by specialty (provider-to-member ratios against access standards), identifies the top sources of **out-of-network (OON) leakage** (where members are driven out of network and the plan overpays), tracks in- versus out-of-network PMPM trends, and assesses compliance with Consolidated Appropriations Act (CAA) transparency requirements. The strategic frame is that network design is a cost lever hiding in plain sight: a structurally inadequate network does not merely inconvenience members, it systematically routes spend to the highest-cost setting.

### 4.5 Fiduciary IQ

**Route:** `/fiduciary-iq` · **Surface:** ERISA governance and audit-readiness · **Substrate:** plan documents and 408(b)(2) vendor fee disclosures.

Fiduciary IQ is the module that names the platform's organizing legal theory. It scores a plan's governance against the duties ERISA imposes on a fiduciary — prudence, loyalty (the duty to act solely in participants' interest), compliance, ongoing monitoring of service providers, and appropriate diversification of risk — and assesses readiness for a DOL audit by reconciling the plan's §408(b)(2) fee disclosures. The output is a fiduciary risk posture: not "are your costs high?" but "can you *defend* your costs as the product of a prudent process?" In an enforcement environment where the DOL and the plaintiffs' bar are increasingly active, this is the question that determines whether a board sleeps at night.

---

## 5. The Workflow Layer

### 5.1 RFP Intelligence OS

**Route:** `/rfp-intelligence` · **Surface:** probabilistic sales and bid intelligence · **Substrate:** the opportunity CRM, joined to Rx Defense findings and DuckDB benchmarking.

The RFP Intelligence OS is where the platform's intelligence becomes revenue workflow. It manages the full RFP lifecycle — opportunity tracking, win-probability estimation, bid pricing, and AI-drafted competitive responses. Its analytical core is **probabilistic**: a Monte Carlo forecast produces a distribution (P10 / P50 / P90) of expected revenue across the open pipeline, win probability is derived from a documented scoring model, and a bid-curve model (maintained at cross-language parity between the Python backend and the TypeScript client) keeps pricing math honest across every surface that touches it. The module recently closed its own feedback loop with a Model Health surface that grades the platform's forecasts against outcomes — the system, in other words, has been engineered to be *accountable for its own predictions*.

---

## 6. The Strategic Consequence: From Suite to Compounding Asset

The thirteen modules above could, in principle, be sold as thirteen separate products. The argument of this paper is that doing so would destroy most of their value, because their value is *relational*, not additive.

Consider the path a single insight travels. Filing Intelligence scores a filing and routes it. Sales OS opens the account on the strength of the employer's own filed numbers. The Account Intel Hub supplies the contact and the technographic context. Rx Defense IQ analyzes the PBM contract and produces a fiduciary score with a dollar exposure; RxPBM Intelligence frames that score against the market. Stop-Loss IQ and Network IQ quantify the tail and the supply-side leakage. Fiduciary IQ assembles the governance posture. The RFP Intelligence OS prices the engagement and drafts the response. And the CFO War Room renders the whole as four board-admissible tiles — every number drillable back to the filing or the clause that produced it. **No insight is recomputed; each is consumed downstream with its receipt intact.**

This is the economic definition of a data-network moat: each module raises the marginal value of every other module, because each adds a join to the shared fabric. A competitor can clone any single surface. It cannot clone the *fabric* — the EIN spine, the 937,000-filing substrate, the shared economic vocabulary (PMPM, PEPM, covered-life normalization), and the constitutional doctrine that makes a finding in one module trustworthy in another — without rebuilding all of it at once.

The platform's most recent work makes this thesis literal. A new **Company 360** dossier takes a single EIN and fans out across every EIN-addressable module in one call, returning a normalized record in which each module's contribution is tagged with its confidence tier (CERTIFIED, MODELED, or INSUFFICIENT_EVIDENCE) and carries a deep link back into the surface that produced it. Modules that cannot resolve an employer from filed data alone — Rx Defense without an uploaded contract, Network IQ without a provider directory — return INSUFFICIENT_EVIDENCE rather than a fabricated number, preserving the doctrine end to end. Company 360 is not a fourteenth module. It is the proof, in running code, that the first thirteen were one engine all along.

---

## 7. Conclusion

The self-funded employer health plan suffers from a structural information asymmetry that conventional benefits software, by reporting numbers without receipts, documents but does not cure. Kincaid IQ's thirteen modules are best understood not as a feature list but as thirteen front doors onto a single fiduciary evidence engine. Each module answers a distinct economic question — the board's, the operator's, the producer's, the actuary's, the ERISA counsel's — but all draw on the same EIN-keyed substrate, speak the same economic vocabulary, and obey the same constitutional doctrine of confidence-tiered, receipt-bearing findings. The strategic payoff is a compounding asset whose value grows super-linearly with each module and each filing, and whose moat is the integrated evidence fabric itself. For the fiduciary, the payoff is simpler and more consequential: the ability, for the first time, to *show its work*.

---

*Prepared as a research and methodology paper for the Kincaid RMC Intelligence Platform. Module descriptions reflect the platform's implemented architecture as of June 2026. Illustrative figures are labeled as such; all scoring methodologies described are those implemented in the platform's analytical engines.*
