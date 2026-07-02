# The Thirteen-Layer Fiduciary Stack: An Architecture, Competitive, and Field-Operations Analysis of Kincaid IQ

**A Stanford MBA Research Paper**

*Field: Strategy, Information Systems & Healthcare Economics. Prepared for discussion, June 2026.*

Author profile: M.B.A., Strategy, Stanford Graduate School of Business; analytical methodology grounded in Ph.D.-level economics (University of Chicago) — industrial organization, agency theory, and information economics.

> **Companion to** *"Thirteen Front Doors, One Fiduciary Engine."* Where that paper argued the strategic thesis, this paper does the engineering and go-to-market work: it reads the platform as a **thirteen-layer stack**, specifies the architecture of each layer in detail, contrasts each layer against its real market competition, and documents exactly how a sales representative operates each one in the field.

---

## Abstract

Kincaid IQ is best understood not as thirteen products but as a **thirteen-layer stack** built on one evidence fabric. Every layer addresses the same legal entity — the self-funded employer, keyed by its EIN — and every layer reads from the same federal substrate (roughly 937,000 DOL Form 5500 filings and 1.35 million Schedule A records, 2020–2024, compiled into a columnar DuckDB analytics database). This paper specifies, for each of the thirteen layers, four things: (1) *what it does*, in operational detail; (2) *its architecture* — the request-to-render data flow, the backend router and its algorithms, the datastore, the frontend surface, and the scoring pipeline; (3) *what it does differently* from the incumbent tools a buyer would otherwise use; and (4) *how a sales representative interacts with it* day to day. We close with a side-by-side competitive matrix spanning all thirteen layers and the strategic conclusion that the stack's defensibility is the integration itself: any single layer can be cloned, but the fabric that lets a finding in Layer 7 become admissible evidence in Layer 1 cannot.

**JEL classification:** D82 (asymmetric information), G22 (insurance), G34 (corporate governance), I11 (health: market structure), K32 (regulation), L14 (transactional relationships), M15 (IT management), M31 (marketing).

**Keywords:** fiduciary forensics, ERISA, PBM transparency, Form 5500, evidence lineage, network adequacy, stop-loss optimization, sales intelligence, competitive strategy.

---

## 1. The Stack Model

Conventional benefits software is sold as a set of point solutions that happen to share a login. Kincaid IQ inverts this. Its thirteen modules form a **layered stack**, in which lower layers manufacture raw intelligence from federal data and upper layers refine, package, and present that intelligence to progressively more senior audiences. The layers are not independent; each consumes the output of the layers beneath it, and every layer's output carries a *receipt* — a drillable link back to the filing, contract clause, or claim that produced it.

We index the stack from the data floor upward:

| # | Layer | Audience | Function in the stack |
|---|-------|----------|-----------------------|
| **L1** | Filing Intelligence | Sales ops / producers | **Ingestion floor** — turns 937k filings into a scored pipeline |
| **L2** | Account Intel Hub | Producers / SDRs | **Enrichment** — adds firmographics, contacts, technographics |
| **L3** | Sales IQ Intelligence | Producers | **Regulatory context** — state-by-state legal strictness |
| **L4** | Sales OS | Producers | **Account working surface** — pre-call briefs + pipeline |
| **L5** | Sales IQ Console (Broker) | Brokers / channel | **Book & prospecting console** — whitespace analysis |
| **L6** | Rx Defense IQ | Analysts / counsel | **PBM contract forensics** — 65-issue fiduciary scoring |
| **L7** | RxPBM Intelligence | Analysts | **PBM market benchmarking** — comparative context |
| **L8** | Stop-Loss IQ | Actuarial / advisors | **Catastrophic-risk optimization** — attachment + IBNR |
| **L9** | Network IQ | Analysts / plan admins | **Supply-side analysis** — adequacy + leakage |
| **L10** | Fiduciary IQ | ERISA counsel / trustees | **Governance scoring** — 5 duties + 408(b)(2) |
| **L11** | HIOS | Plan operators | **Multi-agent operations OS** — orchestrated analysis |
| **L12** | RFP Intelligence OS | Producers / RevOps | **Deal workflow** — probabilistic bid + response drafting |
| **L13** | CFO War Room | Board / C-suite | **Executive synthesis** — 4 board-admissible tiles |

The cross-cutting substrate — shared by all thirteen — is documented once here so it need not be repeated in every section:

- **Identity key:** the employer **EIN**, the join that ties a Form 5500 to an EDGAR filing to a PBM contract.
- **Evidence substrate:** the **DuckDB** analytics database (`data/dol5500.duckdb`, ≈186 MB): `sch_h_2024` (≈937k plans), `employers` (≈192k), `industry_bench`, `state_benchmarks`, `carrier_rankings`, plus `year_trends`. Read-only, thread-local connections keep it safe under FastAPI's async workers.
- **Economic vocabulary:** PMPM (per-member-per-month), PEPM (per-employee-per-month), covered-life normalization, DRAP/CEI cost indices.
- **Constitutional doctrine:** three confidence tiers (**CERTIFIED**, **MODELED**, **INSUFFICIENT_EVIDENCE**); four hard rules (four tiles, drillable numbers, no export without a SHA-256 manifest, findings never outrun evidence); the seven-gate chain (DEFINE → WIRE → VALIDATE → PROMOTE → COMPUTE → GATE → RENDER).

We now proceed layer by layer.

---

## L1 — Filing Intelligence (Ingestion Floor)

**Route:** `/filing-intel` · **Backend:** `backend/routers/filing_intel.py` · **Frontend:** `FilingIntelligence.tsx`

### What it does
Filing Intelligence is the bottom of the stack — the engine that converts the entire national universe of employer welfare-plan filings into a prioritized, routed sales pipeline. Every self-funded employer files a Form 5500 with Schedule H (financials) and Schedule A (insurance/broker compensation). Filing Intelligence reads that corpus and, for each employer, computes an **Opportunity Intelligence Score (0–100)** — a weighted composite of the economically meaningful signals in the filing: covered lives (scale), total plan spend, evidence of excess administrative fees, broker-compensation opportunity, PBM/pharmacy indicators, and the regulatory environment of the employer's state. It then *routes* each scored filing to a territory or producer.

### Architecture
`GET /api/filing-intel/feed` executes a candidate SQL query (`_CANDIDATE_SQL`) against DuckDB `sch_h_2024`, joined to `industry_bench` and `state_benchmarks` for percentile context. Each row passes through `_score_filing` (the weighted-composite scorer) and `_route_filing` (territory assignment), and the ranked feed renders in the `FilingIntelligence.tsx` views: Pipeline Feed, Filing Command Center, and Consultant Rankings. Because DuckDB is columnar and read-only, the whole 937k-row scan returns in sub-second time. A key data-integrity discipline lives here: the DOL "health plan" boolean fields are unreliable, so the platform infers welfare/health status from `WELFARE_BENEFIT_CODES` (4A), and coerces DuckDB `Decimal` types to float before arithmetic to avoid overflow on the participant count field.

### What it does differently
The incumbent way to work Form 5500 data is a **list vendor** — Judy Diamond Associates (ALIRT), Miedema, or FreeERISA — which sells a searchable database of filings. Those tools give you *rows*. Filing Intelligence gives you a *ranked, scored, and routed pipeline*, in which each row already carries an economic thesis (why this employer, worth how much, via which lever) and a downstream destination (which Kincaid layer to open next). The difference is the difference between a phone book and a lead-scoring engine.

### How the rep interacts with it
The rep opens the Pipeline Feed each morning, filters by territory and score band, and works the top of the list. Each entry is a one-click hand-off into **Sales OS (L4)** for the pre-call brief. The rep never touches raw federal data; they consume a scored queue.

---

## L2 — Account Intel Hub (Enrichment)

**Route:** `/account-intel` · **Backend:** `backend/routers/account_intel.py` · **Frontend:** `AccountIntelHub.tsx`

### What it does
Filing data tells you the *plan*; it does not tell you the *company* or the *people*. The Account Intel Hub enriches an employer record with firmographics (size, revenue, corporate structure), contact intelligence (decision-makers and verified emails), and **technographics** — the HR, benefits, and payroll systems the employer runs. The technographic signal is the strategic payload: an employer on a legacy benefits-administration stack predicts both the pain and the replacement window.

### Architecture
`POST /api/account-intel/enrich` runs `enrich_account`, which fires **parallel** calls to a stack of enrichment providers (Apollo, Hunter.io, TheirStack, Crunchbase, SAM.gov; Clearbit and D&B where keyed), normalizes their heterogeneous responses into one unified schema, and returns a consolidated dossier. `_clean_domain` canonicalizes the input. The design degrades gracefully — a missing provider key drops that facet rather than failing the call. The `AccountIntelHub.tsx` surface presents Enrichment, Contact Discovery, Tech Stack, and Intent Signals views.

### What it does differently
General B2B intelligence tools — **ZoomInfo, Apollo, Clearbit, LinkedIn Sales Navigator** — are horizontal; they know the company but not its *plan*. The Account Intel Hub fuses horizontal enrichment onto the vertical Form 5500 spine, so a rep sees the CFO's email *and* the $12M welfare plan and its broker-commission anomaly in the same pane. It is enrichment that already knows the fiduciary story.

### How the rep interacts with it
When a scored filing warrants outreach, the rep clicks "Enrich" to resolve the buying committee and confirm the tech stack, then exports the contact into their outreach sequence. The Hub is the bridge from a filing to a human.

---

## L3 — Sales IQ Intelligence (Regulatory Context)

**Route:** `/sales-iq-intel` · **Backend:** `backend/routers/sales_iq.py` · **Frontend:** `SalesIQModule.tsx`

### What it does
Sales IQ Intelligence is the regulatory map. It tracks the fast-diverging landscape of state PBM licensing, broker-compensation disclosure, and fiduciary-duty law, and assigns each state a **strictness tier (1–4)**. The tier drives the *sales motion*: a Tier-1 state (e.g., CA, NY) leads with a fiduciary-and-compliance argument (the law is the wedge); a low-tier state leads with pure cost savings.

### Architecture
`GET /api/sales-iq/states/{code}` performs a lookup against a curated `_STATE_DATA` map (50 states, prioritized coverage for CA/NY/TX/FL) and returns the tier, the governing statutes, and the recommended posture. `compare_states` renders a side-by-side, and `generate_sales_angle` composes a jurisdiction-specific script. The `SalesIQModule.tsx` surface exposes State Comparison, Sales Angle Generator, and Compliance Alerts.

### What it does differently
There is no direct commercial competitor. The status quo is a **law-firm memo** or a trade-association (NABIP) resource — static, generic, and disconnected from any specific account. Sales IQ Intelligence turns regulatory posture into a live, per-state sales input wired into the same account context as everything else.

### How the rep interacts with it
Before a call into a new state, the rep checks the tier and pulls a jurisdiction-tuned angle, so the pitch is framed by whichever argument the local regime makes most binding.

---

## L4 — Sales OS (Account Working Surface)

**Route:** `/sales-os` · **Backend:** `backend/routers/sales_os.py` · **Frontend:** `SalesOS.tsx`

### What it does
Sales OS is the producer's working surface for a single account. Given an EIN it returns a **pre-call brief**: the employer's filed welfare premiums, broker commissions, admin fees, and participant count; a derived opportunity score and tier; a computed broker-commission rate (commission as a percentage of premium); an estimate of recoverable capital; and an AI-generated, evidence-anchored opener. It carries the account through an eight-stage Kanban pipeline (target → research → outreach → discovery → proposal → negotiation → closed-won/lost).

### Architecture
`GET /api/sales-os/accounts/{id}/brief` runs `compute_sbi` (the **Shady Broker Index** — a weighted composite of broker Opacity, Renewal Bias, Rebate Distortion, and Spread-Pricing Linkage) and `estimate_recoverable` (capital-recovery heuristics), then calls the dual AI engine to draft the opener. Account facts come from DuckDB `employers`/`sch_h_2024`, enriched by SAM.gov, SEC EDGAR, and CMS Open Data. The Kanban pipeline persists in Postgres. `SalesOS.tsx` renders the Pre-Call Brief, AI Opener, and Recoverable-Capital widget.

### What it does differently
Sales-engagement platforms — **Outreach, Salesloft, HubSpot Sales** — sequence *activity*; they do not know *why* an account is worth a call. Sales OS is evidence-anchored: every opener quotes a number the prospect filed with the federal government, converting a cold pitch into a discussion of the prospect's own disclosures. The Shady Broker Index is a differentiator with no equivalent in generic CRM.

### How the rep interacts with it
This is the rep's home screen. They open an account, read the brief, copy the AI opener, and advance the deal stage as it progresses — with every claim in the brief drillable to its filing.

---

## L5 — Sales IQ Console / Broker Console (Book & Prospecting)

**Route:** `/saas/broker` · **Backend:** `backend/routers/saas_broker.py` · **Frontend:** `BrokerProspects.tsx`, `SaasBroker.tsx`

### What it does
The Sales IQ Console is the channel surface for brokers. In **Book Analysis mode**, a broker uploads their existing 10–12 client roster and receives a structural read — industry mix, size distribution, renewal-month clustering, plan-type concentration — plus *whitespace intelligence* on where the book is over- or under-exposed relative to the live filing universe. In **Prospecting mode** (the Indiana Prospect Engine), the console queries real Form 5500 data to surface scored, fit-ranked targets with opening angles, commission estimates, a metro-level market map, and saved, exportable prospect lists.

### Architecture
`GET /api/saas/broker/dashboard` and `/overview` drive the console; `POST /api/saas/broker/book/analyze` runs the book decomposition; `/prospects` queries the Indiana welfare-plan corpus. `_enrich` computes days-to-renewal and `_timeline_stages` renders a **9-stage renewal journey** (Strategy Prep → Renewal Complete). Data spans DuckDB `sch_h_2024` and Postgres `prospects_5500_indiana`, `saved_prospect_lists`, and `saved_prospect_list_items` (with inline prospect data for CSV export). Saved-list CRUD is fully wired.

### What it does differently
Broker BI incumbents — **Zywave, ThreeFlow** — manage quoting and placement workflow but do not turn federal filings into a scored prospecting engine with whitespace analytics. The Console fuses "analyze my current book" and "find my next book" on one federal substrate.

### How the rep/broker interacts with it
A channel broker starts by uploading their book to see whitespace, then switches to prospecting to build and export a target list — a self-service growth engine.

---

## L6 — Rx Defense IQ (PBM Contract Forensics)

**Route:** `/rx-defense` · **Backend:** `backend/routers/rx_defense.py` · **Frontend:** `RxDefense.tsx`, `RxDefenseFullReport.tsx`

### What it does
Rx Defense IQ is the platform's flagship forensic instrument. A user uploads a PBM contract (PDF/TXT/DOCX); the engine evaluates it against **65 fiduciary-aligned issues across 13 provisions** — spread pricing, rebate retention, definitional games on "generic"/"specialty," data-ownership and audit rights, and the rest of the levers through which PBM contracts leak plan assets — and returns a **0–100 fiduciary score**. It then attaches an economics layer: a **Dollar Exposure Estimator** (per-provision annual dollars as a function of members and Rx spend), an **AI Executive Summary** (a plain-English CFO brief), and a **Redline Generator** (a downloadable Word document with model contract language for every weak provision). A demo comparison shows a before/after pair.

### Architecture
`POST /api/rx-defense/analyze` extracts PDF text, then runs the dual AI engine (Anthropic + OpenAI) against the issue grid; results persist in Postgres `rx_defense_contracts`. `GET /contracts/{id}/exposure`, `/executive-summary`, and `/redline` serve the economics, brief, and Word document. The 13-tab `RxDefense.tsx` surface spans Quick Look, Scorecard, $ Exposure, Exec Summary, Benchmarks, Red Flags, DOL Gap, CAA 2026, Tracker, Portfolio, Negotiation, Comparison, and PBM Index. A modeled-leakage cap (30% of actual Rx spend) is enforced identically across the frontend and the backend exposure/savings endpoints, and INSUFFICIENT_EVIDENCE is never used as a fallback constant.

### What it does differently
PBM audit today is a **consulting engagement** — Truveris, Xevant, or a boutique pharmacy consultant runs a weeks-long manual review — or an attorney reads the contract by hand. Rx Defense IQ compresses that into an on-demand analysis that is simultaneously *scored* (0–100), *dollarized* (per-provision exposure), and *actionable* (redline you can send to the PBM). No incumbent delivers all three in one artifact with the receipts attached.

### How the rep interacts with it
The rep uploads a prospect's PBM contract (or runs the demo) live in a discovery meeting, shows the score and the dollar exposure, and offers the redline as the next step — turning a sales call into a working session.

---

## L7 — RxPBM Intelligence (PBM Market Benchmarking)

**Route:** `/rx-pbm` · **Backend:** `backend/routers/pbm_contract.py`, `market.py` · **Frontend:** `RxPBM.tsx`

### What it does
Where L6 analyzes one contract, RxPBM Intelligence supplies the market context that makes a single contract legible. It benchmarks contract terms against the dominant PBMs (CVS Caremark, Express Scripts, OptumRx) and against industry-average and best-in-class standards, and models the savings of moving from an "original" to a "renegotiated" position.

### Architecture
`run_analysis` (LLM-based provision scoring) and `run_comparison` power a **Fiduciary Comparison Report** (original vs. renegotiated) and a savings modeler; PBM policy context is pulled from CMS transparency feeds. Contracts persist in Postgres `pbm_contracts`. The surface renders the comparison and savings views in `RxPBM.tsx`.

### What it does differently
Market-transparency resources — **46brooklyn, Drug Channels** — publish macro research; audit vendors benchmark privately per engagement. RxPBM Intelligence converts benchmarking into a live *comparative* judgment ("is this clause bad relative to what I could obtain in this market?"), which is the version of the judgment that carries negotiating leverage.

### How the rep interacts with it
After L6 produces a score, the rep opens L7 to show the prospect where they sit versus the market and to quantify the renegotiation prize — the economic case for acting.

---

## L8 — Stop-Loss IQ (Catastrophic-Risk Optimization)

**Route:** `/stop-loss` · **Backend:** `backend/routers/saas_stoploss.py`, `stop_loss.py` · **Frontend:** `StopLoss.tsx`

### What it does
Stop-Loss IQ governs the tail risk of a self-funded plan. It performs tiered **attachment-point analysis** (the specific and aggregate deductibles at which reinsurance engages), predicts catastrophic-claim exposure, computes an **IBNR** (incurred-but-not-reported) reserve, and compares carrier markets. The economic question is optimal risk retention: how much volatility should the employer hold, and how much should it cede, at what premium.

### Architecture
`GET /api/saas/stoploss/dashboard` runs `stoploss_dashboard` (four-tier attachment analysis, catastrophic-claim predictions, IBNR reserve calculation) and `carrier_comparison` (multi-carrier market view). `StopLoss.tsx` renders Attachment Analysis, a Catastrophic Claims Tracker, and an IBNR Reserve Gap. An AI analysis path (`stop_loss.py`) handles uploaded policy documents.

### What it does differently
Stop-loss is normally intermediated by **MGUs and specialty brokers** (Amwins, ELMCO, Tokio Marine HCC) whose incentives are placement, or by **actuarial firms** (Milliman) on a project basis. Stop-Loss IQ puts attachment optimization and IBNR modeling directly in the fiduciary's hands, independent of the party selling the coverage — a structural conflict removed.

### How the rep interacts with it
For a self-funded prospect, the rep models alternative attachment points live, shows the IBNR gap, and demonstrates that the current stop-loss placement may be mispriced — a wedge into the reinsurance conversation.

---

## L9 — Network IQ (Supply-Side Analysis)

**Route:** `/network-iq` · **Backend:** `backend/routers/saas_network.py` · **Frontend:** `NetworkIQ.tsx`, `NetworkIQFullReport.tsx`

### What it does
Network IQ analyzes the provider network — the supply side of the plan. It computes **adequacy scores** by specialty (provider-to-member ratios against access standards), identifies the top sources of **out-of-network (OON) leakage** (where members are pushed out of network and the plan overpays), tracks in- vs. out-of-network PMPM trends, and assesses Consolidated Appropriations Act (CAA) transparency compliance.

### Architecture
`GET /api/saas/network/dashboard` runs `network_dashboard` and `adequacy_detail` over provider-network and OON-claims data. The surface exposes Adequacy, Leakage, Disruption, and CAA-Compliance views, with a dedicated `NetworkIQFullReport.tsx` and a network-disruption report.

### What it does differently
Network adequacy is dominated by **Quest Analytics** (the compliance-filing standard) and network/leakage tools like **Zelis**; both serve payers and their incentive is network *operation*, not fiduciary *oversight*. Network IQ reframes adequacy and leakage as an *employer-side cost lever* — a structurally inadequate network is not a member-experience footnote, it is a mechanism that routes spend to the highest-cost setting.

### How the rep interacts with it
The rep shows a prospect where their network is thin and where leakage is bleeding dollars, translating an abstract "network" into a specific, recoverable number.

---

## L10 — Fiduciary IQ (Governance Scoring)

**Route:** `/fiduciary-iq` · **Backend:** `backend/routers/fiduciary_iq.py` · **Frontend:** `FiduciaryIQ.tsx`

### What it does
Fiduciary IQ names the platform's organizing legal theory. It scores a plan's governance against the ERISA fiduciary duties — prudence (prudent-expert standard), loyalty, compliance, ongoing monitoring of service providers, and diversification — and assesses DOL-audit readiness by reconciling the plan's **§408(b)(2)** service-provider fee disclosures. The output is a defensibility posture: not "are your costs high?" but "can you defend your costs as the product of a prudent process?"

### Architecture
`GET /api/fiduciary-iq/plans/{id}` runs `_dashboard_data`, computing the **five-duty weighted score** and rendering a 408(b)(2) checklist and ERISA audit-readiness view. Plans and disclosures persist in Postgres `fiduciary_plans` and `fiduciary_disclosures`. `FiduciaryIQ.tsx` exposes Duty Scores, 408(b)(2) Tracking, ERISA Checklist, and Audit Readiness tabs.

### What it does differently
Health-plan fiduciary governance is a **greenfield** created by recent litigation (e.g., the J&J and Wells Fargo PBM cases). The nearest analogues — **fi360** and retirement-plan governance tools — are built for 401(k)s, not health plans; the alternative is bespoke law-firm work. Fiduciary IQ productizes health-plan fiduciary scoring, which effectively no incumbent offers.

### How the rep interacts with it
The rep uses the duty scorecard to make the fiduciary risk *personal and visible* to a trustee or CFO — the emotional and legal wedge that reframes a cost conversation as a liability conversation.

---

## L11 — HIOS (Multi-Agent Operations OS)

**Route:** `/hios` · **Backend:** `backend/routers/hios.py`, `backend/agents/*.py` · **Frontend:** `HealthcareIntelligenceOS.tsx`

### What it does
HIOS is the operator's console — the surface for the ongoing work of running a plan prudently. Its distinguishing feature is a **multi-agent AI orchestration layer**: rather than a single chatbot, HIOS coordinates specialized autonomous agents that run three intelligence levels simultaneously — claim-level forensics (always on), pattern-level anomaly detection, and strategic momentum control — spanning prior-authorization forensics, ERISA litigation-risk scoring, PBM anomaly detection, and workforce-impact analysis.

### Architecture
`GET /api/hios/command` runs `command_center`, an aggregator over an `AGENT_REGISTRY` of ~10 agents (e.g., `agent.enterprise_command`, `agent.pbm_forensics`), each governed by the shared `BASE_PERSONA` (the constitutional doctrine, injected into every `run_agent` call). A thread-safe `_TTLCache` and a token-bucket `_RateLimiter` protect the orchestration under load. Data spans DuckDB `sch_h_2024` plus Postgres `recovery_actions`, `rx_defense_contracts`, and `fiduciary_plans`. `HealthcareIntelligenceOS.tsx` presents Command Center, Prior Auth, PBM Forensics, ERISA Risk, and Workforce Impact tabs.

### What it does differently
Analytics incumbents — **Springbuk, Artemis (Nomi Health), Milliman MedInsight** — deliver dashboards a human must interpret. HIOS delivers an *orchestrated staff*: agents that prioritize, quantify, and propose the next action, each anchored to prevalence statistics and each obeying the same evidence doctrine. It is the difference between a report and a team.

### How the rep interacts with it
For enterprise deals, the rep demonstrates HIOS as the "operating system" the client would run post-sale — the vision layer that justifies a platform (not point-solution) purchase.

---

## L12 — RFP Intelligence OS (Deal Workflow)

**Route:** `/rfp-intelligence` · **Backend:** `backend/routers/rfp_intelligence.py` · **Frontend:** `RfpIntelligenceOS.tsx`

### What it does
The RFP Intelligence OS is where intelligence becomes revenue workflow. It manages the RFP lifecycle — opportunity tracking, win-probability estimation, bid pricing, AI-drafted competitive responses, and a filing-alarm watchlist — and grades its own forecasts against outcomes via a companion Model Health surface.

### Architecture
`GET /api/rfp/opportunities` runs `compute_opportunity_score` (defined in `rfp_intake.py`); a **Monte Carlo forecast** produces a P10/P50/P90 revenue distribution across the pipeline (shared math reused by the War Room); `generate_talking_points` and draft-response endpoints call the dual AI engine. A bid-curve model is maintained at **cross-language parity** (Python `backend/bid_model.py` and TypeScript `client/src/lib/bidModel.ts`, verified by a parity test). Opportunities and the watchlist persist in Postgres `rfp_opportunities` and `rfp_watchlist`. `RfpIntelligenceOS.tsx` renders the RFP board, command center, watchlist, and AI talking points.

### What it does differently
RFP-response tools — **Loopio, Responsive (RFPIO)** — are content-library managers; they help you *assemble* an answer, not *decide which deals to chase or what to bid*. The RFP Intelligence OS adds the probabilistic decision layer (win probability, revenue distribution, bid curve) and cross-references each opportunity against the prospect's own PBM gaps and DOL benchmarks — a fusion no RFP tool attempts.

### How the rep interacts with it
The rep works the RFP board like a pipeline, reads the win-probability and P50 forecast to decide where to invest effort, sets a bid from the curve, and generates a first-draft response — then trusts the Model Health grade to calibrate how much to rely on the numbers.

---

## L13 — CFO War Room (Executive Synthesis)

**Route:** `/cfo-war-room` · **Backend:** `backend/routers/executive.py` · **Frontend:** `ExecutiveWarRoom.tsx`, `CfoWarRoom.tsx`

### What it does
The CFO War Room is the apex of the stack — the board-room view. Its defining constraint is a hard rule: **one screen, four tiles, always** — Financial Exposure, Contract Integrity, Operational Behavior, and Strategic Leverage. Nothing reaches a tile unless it is board-admissible; material that fails the gate is rendered as an explicit gap, because INSUFFICIENT_EVIDENCE is a valid finding.

### Architecture
`GET /api/executive/dashboard` reads persisted `Claim` and `decision_receipts` models, applies `_is_board_admissible` (via `_claim_to_executive_tile`, which derives a `boardGrade` from confidence and freshness) using the policy engine's board-grade confidence floor (`CONFIDENCE_BOARD_THRESHOLD`), and emits the four tiles. The **seven-gate chain** is surfaced through `LEVEL_TO_GATE`: each drill level maps to a gate, so an executive clicking a number walks back up the provenance chain that produced it. Export is blocked without a SHA-256 evidence manifest. `ExecutiveWarRoom.tsx`/`CfoWarRoom.tsx` render the ExecutiveDashboard, ExecutiveSummaryBar, and ExecutiveStatusStrip.

### What it does differently
Executive BI — **Tableau/Power BI dashboards, Artemis, Springbuk** — will happily render any number, admissible or not. The War Room's differentiator is *governed austerity*: it refuses to show more than four tiles, refuses to show a number that fails the confidence gate, and refuses to export without a cryptographic manifest. It is engineered to make a fiduciary's claims *board-admissible*, not merely persuasive.

### How the rep interacts with it
In the closing meeting with the C-suite, the rep presents the War Room as the artifact the buyer's own board will see — the deliverable that turns the entire stack's findings into four defensible tiles. It is the vision that closes the platform sale.

---

## 2. Side-by-Side Competitive Analysis

| Layer | Kincaid IQ module | Closest incumbent(s) | What incumbents do | Kincaid's decisive difference |
|-------|-------------------|----------------------|--------------------|-------------------------------|
| L1 | Filing Intelligence | Judy Diamond/ALIRT, Miedema, FreeERISA | Searchable Form 5500 rows | Scored + routed pipeline with an economic thesis per row |
| L2 | Account Intel Hub | ZoomInfo, Apollo, Clearbit, LinkedIn Sales Nav | Horizontal firmographics/contacts | Enrichment fused onto the Form 5500 plan spine |
| L3 | Sales IQ Intelligence | Law-firm memos, NABIP resources | Static, generic regulatory summaries | Per-state strictness tiers wired into account context |
| L4 | Sales OS | Outreach, Salesloft, HubSpot Sales | Activity sequencing | Evidence-anchored briefs + Shady Broker Index |
| L5 | Sales IQ Console (Broker) | Zywave, ThreeFlow | Quoting/placement workflow | Book whitespace + federal prospecting engine |
| L6 | Rx Defense IQ | Truveris, Xevant, pharmacy consultants, attorneys | Manual, weeks-long PBM audits | On-demand scored + dollarized + redline-ready analysis |
| L7 | RxPBM Intelligence | 46brooklyn, Drug Channels, audit vendors | Macro research / private benchmarks | Live comparative judgment with negotiation leverage |
| L8 | Stop-Loss IQ | Amwins, ELMCO, Tokio Marine HCC; Milliman | Placement-driven or project actuarial | Employer-side attachment + IBNR modeling, conflict removed |
| L9 | Network IQ | Quest Analytics, Zelis, Ribbon | Payer-side adequacy/network ops | Employer-side adequacy + leakage as a cost lever |
| L10 | Fiduciary IQ | fi360 (retirement), law firms | 401(k) governance / bespoke legal work | Productized *health-plan* fiduciary scoring (greenfield) |
| L11 | HIOS | Springbuk, Artemis (Nomi), Milliman MedInsight | Dashboards for humans to interpret | Multi-agent orchestrated staff under one doctrine |
| L12 | RFP Intelligence OS | Loopio, Responsive (RFPIO) | Content-library assembly | Probabilistic bid/forecast + evidence-linked drafting |
| L13 | CFO War Room | Tableau/Power BI, Artemis, Springbuk | Render any number | Governed austerity: 4 tiles, gated, manifest-signed |

**The pattern in one line:** every incumbent competes with *one* layer; none competes with the *fabric*. A buyer can replace Filing Intelligence with a list vendor and Rx Defense with a consultant — but then the consultant's finding cannot flow, with its receipt intact, into the CFO's four tiles. The integration is the moat.

---

## 3. How a Rep Moves Through the Stack: One Motion

The thirteen layers are not thirteen tools a rep juggles; they are one motion a rep walks:

1. **L1 Filing Intelligence** — work the scored morning queue.
2. **L2 Account Intel Hub** — enrich the top targets, resolve the buying committee.
3. **L3 Sales IQ Intelligence** — set the jurisdiction-appropriate angle.
4. **L4 Sales OS** — open the pre-call brief, copy the evidence-anchored opener, advance the stage.
5. **L5 Sales IQ Console** — (channel) analyze the broker's book, build the prospect list.
6. **L6 Rx Defense IQ** — in discovery, upload the PBM contract, show the score and dollar exposure.
7. **L7 RxPBM Intelligence** — frame the exposure against the market; quantify the renegotiation prize.
8. **L8 Stop-Loss IQ** — model attachment points; expose the IBNR gap.
9. **L9 Network IQ** — surface adequacy gaps and leakage dollars.
10. **L10 Fiduciary IQ** — make the fiduciary liability personal to the trustee.
11. **L11 HIOS** — demo the post-sale operating system for enterprise buyers.
12. **L12 RFP Intelligence OS** — price the bid, draft the response, manage the deal.
13. **L13 CFO War Room** — close in the board room with four admissible tiles.

Every step hands the next step an artifact with its receipt attached. The rep never re-keys a fact and never presents a number they cannot drill. This is the operational meaning of "one evidence fabric."

---

## 4. Conclusion

Read as a stack, Kincaid IQ resolves into thirteen layers that manufacture, refine, and present fiduciary intelligence about the self-funded employer — from the 937,000-filing ingestion floor to the four-tile board room. Each layer has real, named competitors, and against each competitor Kincaid's advantage is the same: the incumbent optimizes a single layer, while Kincaid optimizes the *joins between layers*, so that an insight created anywhere is consumable everywhere with its evidence intact. The recently shipped **Company 360** dossier — one EIN, every layer, one normalized record with confidence tiers and deep links — is the proof in code that the thirteen layers were always one engine. For the sales representative, the payoff is a single, receipt-bearing motion from cold filing to closed board room. For the fiduciary buyer, it is the first ability to *show its work*.

---

*Prepared as a research, architecture, and go-to-market analysis for the Kincaid RMC Intelligence Platform. Architecture descriptions reflect the implemented codebase as of June 2026 (routers, endpoints, datastores, and frontend surfaces named are those present in the platform). Competitive references describe publicly known vendors for illustrative positioning; scoring methodologies described are those implemented in the platform's analytical engines.*
