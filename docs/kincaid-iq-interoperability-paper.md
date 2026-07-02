# One Evidence Fabric, Many Front Doors: How the Kincaid IQ Modules Interoperate to Compound Capital-Efficiency Intelligence

**A Stanford MBA Research Paper**

*Field: Strategy & Information Systems. Prepared for discussion, June 2026.*
Author profile: M.B.A., Strategy, Stanford Graduate School of Business; with valuation methodology grounded in Ph.D.-level economics (University of Chicago).

---

## Abstract

Most software described as a "platform" is in fact a portfolio of disconnected applications that happen to share a login. This paper makes the opposite argument about Kincaid IQ: its thirteen analyzed modules are not standalone tools but *front doors onto a single evidence fabric*. We show, with reference to the system's actual wiring, that interoperability is achieved through four shared layers, a common **identity key** (the employer EIN), a common **evidence substrate** (the DOL Form 5500 / DuckDB corpus), a common **economic vocabulary** (DRAP, PEPM, CEI), and a common **constitutional doctrine** (four hard rules, three confidence tiers, the seven-gate chain). Because every module reads from and writes to these same layers, an insight created in one surface (for example, a Shady Broker integrity score or an Rx Defense fiduciary score) is consumed, unchanged and with its receipt intact, by another (the RFP Intelligence opportunity engine, the CFO War Room). We trace three concrete cross-module flows that the codebase already implements, derive the strategic consequence (a data-network moat in which each module makes every other module more valuable), and close with the valuation logic that follows when modules compound rather than merely coexist.

**Keywords:** systems integration, data-network effects, evidence lineage, resource-based view, land-and-expand, healthcare fiduciary intelligence.

---

## 1. Thesis: integration is the product

The naive question about a multi-module platform is "what does each module do?" The strategic question is "what does each module do *for the others*?" A portfolio of tools adds value linearly: *n* tools deliver roughly *n* units of value. A fabric of interoperating modules adds value combinatorially: the value scales with the *connections* between modules, on the order of *n²*. The entire economic case for Kincaid IQ as an asset class, rather than a feature list, rests on which of these two regimes it occupies.

This paper's claim is that Kincaid IQ occupies the combinatorial regime, and that it does so because four layers are shared by construction. We examine each layer, then trace the flows that the shared layers make possible.

---

## 2. The four shared layers that make the modules one system

### 2.1 A shared identity key: the EIN as universal join

Every employer in the United States that files a benefit plan has an Employer Identification Number. Kincaid IQ treats the EIN as the **primary key of reality**. Filing Intelligence indexes filings by EIN; the benchmarking service exposes `/benchmark/employer/{ein}`; the RFP Intelligence engine stores `employer_ein` on every opportunity and exposes a unified `/intel/{ein}` bundle; the CFO War Room resolves a default entity to a specific EIN.

The consequence is profound and is the precondition for everything in Section 3: because all modules speak the same identity, a fact discovered about an employer in one module is *automatically addressable* from every other module. There is no entity-resolution tax, no fuzzy matching, no reconciliation project. The join already happened.

### 2.2 A shared evidence substrate: the DOL / DuckDB corpus

Beneath the modules sits one analytic substrate, a DuckDB warehouse built from 936k+ DOL Form 5500 filings and 1.35M Schedule A records (employers, industry benchmarks, state benchmarks, carrier rankings, year trends). Filing Intelligence, Sales OS, the Broker/Sales IQ Console, Shady Broker, RFP Intelligence, and the benchmarking engine all read from this same corpus.

Strategically, a shared substrate means a finding never has to be *re-sourced* as it moves between modules. The P50/P75/P90 percentile distributions that Filing Intelligence uses to flag an excess fee are the *same* distributions the War Room cites in a board tile and the *same* distributions RFP Intelligence embeds in a talking point. One source of truth, many consumers.

### 2.3 A shared economic vocabulary: DRAP, PEPM, CEI

Interoperability requires not just shared data but shared *units*. The platform standardizes on three:

- **DRAP (Delta Realized vs. Allowable Pricing)** — the EBITDA-leakage primitive (paid minus allowable), deterministic and reconstructable.
- **PEPM / PMPM (Per Employee/Member Per Month)** — the normalization unit that makes employers of different sizes comparable.
- **CEI (Confidence Engine Index, 0–100)** — the measured strength of evidence behind any finding.

Because every module emits findings in these same units, the outputs are *additive*. A leakage figure from Rx Defense, a leakage figure from Network IQ, and a leakage figure from Claims-grade audit can be summed into a single portfolio DRAP without translation, because they were never in different currencies to begin with.

### 2.4 A shared constitution: doctrine as the integration contract

The deepest integration layer is the doctrine itself. The four hard rules (one screen / four tiles; every number clickable to a receipt; no export without a SHA-256 manifest; narratives never outrun evidence), the three confidence tiers (CERTIFIED / MODELED / INSUFFICIENT_EVIDENCE), and the seven-gate chain (DEFINE → WIRE → VALIDATE → PROMOTE → COMPUTE → GATE → RENDER) are enforced *platform-wide* from single sources of truth: a canonical AI persona prepended to every model call, a single narrative-engine voice, and a doctrine surface rendered verbatim in the UI.

This is what lets a finding cross module boundaries without losing trust. A CERTIFIED finding produced in Rx Defense arrives in the War Room *still CERTIFIED*, because both modules inherit the same confidence taxonomy and the same gate chain. The doctrine is, in effect, the API contract between modules: not a schema, but a standard of proof.

---

## 3. How the modules actually speak to each other (three traced flows)

Below are three flows that the system already implements. They are chosen because each crosses several modules and demonstrates that the shared layers of Section 2 are load-bearing, not aspirational.

### 3.1 Flow A — Discovery → Qualification → Pursuit (the revenue spine)

```
Filing Intelligence ──(EIN, recoverable value)──► Sales OS / Sales IQ Console
        │                                                   │
        │ (benchmarking bundle by EIN)                      │ (opportunity scoring 0–100)
        ▼                                                   ▼
   Shady Broker Index ──(integrity score)──►  RFP Intelligence ──► competitive battle card + AI response
        ▲                                            ▲
        └──────── Rx Defense IQ (fiduciary score) ───┘
```

The RFP Intelligence engine is the clearest proof of interoperation in the codebase: when it assembles intelligence for an opportunity, it **pulls the benchmarking bundle** (Filing Intelligence's view of the employer's fees and carriers), **pulls the Shady Broker summary and integrity score** for that EIN, and **reads the Rx Defense contract score** (`overall_score`/100) to enrich its AI-generated talking points and competitive response drafts. Three modules' outputs converge, keyed only by EIN, into one negotiation asset. No module re-derives what another already proved.

### 3.2 Flow B — Forensic adjudication → Executive synthesis (the proof spine)

```
Rx Defense IQ ─┐
Stop-Loss IQ ──┤
Network IQ ────┼──(DRAP, PEPM, CEI, confidence tier)──► HIOS ──► CFO War Room (4 tiles)
Fiduciary IQ ──┘                                          │
                                                          └─ shared forecast math (win-prob, P10/P50/P90)
```

The four contract-adjudication modules each emit findings in the shared DRAP/PEPM/CEI vocabulary. HIOS acts as the **fusion layer** that composes them, and the CFO War Room renders the composition under the four-tile rule. Crucially, the probabilistic forecast math (win probability, revenue, P10/P50/P90 bands) lives in a *single shared library* reused by both the RFP surface and the War Room, so the pipeline number a salesperson sees and the exposure number a CFO sees are computed by the same code, never two divergent re-implementations. The same discipline governs the bid-curve math, which is maintained with deliberate cross-language parity between backend and frontend so a value computed server-side equals the value rendered client-side.

### 3.3 Flow C — Enrichment → Targeting → Regulatory overlay (the context spine)

```
Account Intel Hub ──(firmographics, signals, contacts)──► Sales IQ Console
   (14+ providers fused)                                       │
                                                               ▼
                                          Sales IQ Intelligence (50-state regulatory overlay)
                                                               │
                                                               ▼
                                                    Filing Intelligence (DOL ground truth)
```

Account Intel Hub fuses 14+ external providers (Apollo, Crunchbase, TheirStack, Hunter, Salesforce, HubSpot) into a single account view, which the Sales IQ Console then situates against the 50-state regulatory overlay (spread-pricing prevalence, broker-disclosure law) and finally grounds in the DOL filing record. External enrichment, regulatory context, and government ground truth meet on the same EIN-keyed entity.

---

## 4. The modules, and the one KPI each contributes to the fabric

Interoperability means each module's headline KPI is also a *contribution to the shared ledger*. The table reframes each analyzed module by what it puts onto the common evidence fabric.

| Module | Headline KPI it emits | What the fabric does with it |
|---|---|---|
| **Filing Intelligence** | Recoverable Value ($), OI Score | Seeds discovery; supplies benchmarking bundle to Sales OS & RFP Intelligence |
| **CFO War Room** | Total First-Year Opportunity ($), FCR % | Consumes all modules into 4 tiles; renders the portfolio DRAP |
| **HIOS** | Dollars Recovered ($), Annual $ at Risk | Fusion layer; composes adjudication findings for the executive |
| **Sales IQ Console** | Transparency / PBM Risk Score | Targets accounts using Filing + Account Intel + 50-state overlay |
| **Account Intel Hub** | Overall Intel Score, Signal Count | Enriches the EIN entity with firmographics/intent for every other module |
| **Sales IQ Intelligence** | Spread / Pass-through Prevalence % | Supplies the regulatory overlay that contextualizes every prospect |
| **Sales OS** | Opportunity Score (0–100), Est. Annual Premium ($) | Converts discovery into a scored, owned pipeline |
| **Rx Defense IQ** | Fiduciary Score (0–100), DRAP ($) | Emits contract-grade proof reused by RFP Intelligence & War Room |
| **Rx PBM Intelligence** | Spread Pricing %, Rebate Pass-through | Supplies the market norms that calibrate Rx Defense's allowable prices |
| **Stop-Loss IQ** | Carrier Accountability Score | Adds catastrophic-risk leakage to the portfolio DRAP |
| **Network IQ** | Adequacy Score, Leakage $ Exposure | Adds out-of-network leakage to the portfolio DRAP |
| **Fiduciary IQ** | Fiduciary Risk Score, DOL Audit Readiness | Converts financial findings into governance/audit exposure |
| **RFP Intelligence** | Opportunity value + win probability (P10/P50/P90) | Consumes Filing + Shady Broker + Rx Defense into one pursuit asset |

The point of the table is the right-hand column: no module is a dead end. Each one's output is another module's input.

---

## 5. Strategic consequence: the data-network moat

### 5.1 Why interoperation compounds (resource-based view)

In the resource-based view of strategy, advantage comes from resources that are valuable, rare, inimitable, and organizationally embedded. Kincaid IQ's inimitable resource is not any single module; it is the *accumulated, EIN-keyed, doctrine-certified evidence fabric*. Each new reconciled contract or claim enriches the benchmark distributions that score the next finding in every module. Marginal cost of the next insight falls; its credibility rises. A competitor can clone a single module's UI; it cannot clone the fabric without re-accumulating the lineage, which is precisely the asset that took time and reconciliation to build.

### 5.2 Why interoperation drives land-and-expand (go-to-market)

Because the modules share an identity key and a vocabulary, a customer who lands on one wedge (say, a single Rx Defense contract analysis) generates an EIN-keyed finding that *immediately illuminates adjacent exposure* in Stop-Loss, Network, and Fiduciary IQ, with no new data collection. The cross-sell is not a sales motion bolted on after the fact; it is a structural property of the fabric. The product expands itself.

### 5.3 Why interoperation re-rates the asset (valuation)

When modules merely coexist, the firm is valued as a SaaS portfolio on seats and churn. When modules compound, the firm is valued on the durability and provability of the data asset, the data-infrastructure comparable set (Palantir, Snowflake, Databricks). The valuation identity follows directly:

> **EV ∝ (Reconstructable DRAP across the EIN graph) × (CERTIFIED share) × (capitalization multiple of recovered EBITDA)**

The first term grows with every module added to the fabric (more surfaces that see leakage on the same entities), the second grows as shared doctrine certifies more of it, and the third is the market's translation. Interoperability is therefore not a feature of the product; it is the multiplier in the valuation.

---

## 6. Conclusion

The modules of Kincaid IQ speak to each other because they were built to share four things rather than to share a login: one identity key (the EIN), one evidence substrate (the DOL/DuckDB corpus), one economic vocabulary (DRAP / PEPM / CEI), and one constitution (the four rules, three tiers, seven gates). Those shared layers let a finding move from forensic discovery to negotiation asset to board tile without being re-sourced, re-priced, or re-proven, as the RFP Intelligence engine already demonstrates by fusing Filing, Shady Broker, and Rx Defense outputs on a single EIN. The strategic result is a system whose value scales with its connections rather than its features, a data-network moat that compounds, a go-to-market that expands itself, and a valuation that belongs to the data-infrastructure class. The modules are many front doors. The intelligence behind them is one fabric.
