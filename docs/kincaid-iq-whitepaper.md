# Capital Efficiency Intelligence: A Forensic-Economic Framework for the Valuation and Governance of Self-Funded Healthcare Risk

**A Kincaid RMC Intelligence Working Paper**

*Office of the Chief Economist*
Principal Investigator: Ph.D., Economics, University of Chicago (industrial organization, agency theory, information economics, causal inference); M.B.A., Strategy, Stanford Graduate School of Business.

Working Paper Series, June 2026. Draft for discussion.

---

## Abstract

We argue that employer healthcare cost is not an analytics problem but a governance problem, an evidence problem, and a deterministic computation problem. Under asymmetric information and misaligned agency, the intermediated benefits supply chain (brokers, pharmacy benefit managers, carriers, and third-party administrators) systematically extracts rents that present, on the plan sponsor's income statement, as recurring EBITDA leakage rather than as a discrete, recoverable liability. This paper formalizes that leakage through a single primitive metric, the **Delta Realized vs. Allowable Pricing (DRAP)**, and situates it within a constitutional doctrine of evidence (four hard rules, three confidence tiers, a seven-gate enforcement chain) that makes every asserted dollar reconstructable to a receipt. We then document fifteen operating modules of the Kincaid IQ platform that instantiate this framework end to end, from forensic discovery (Filing Intelligence, Shady Broker Index) through contract adjudication (Rx Defense IQ, Stop-Loss IQ, Network IQ, Fiduciary IQ) to executive synthesis (CFO War Room, HIOS). For each module we showcase its headline key performance indicators. Finally, applying a University of Chicago valuation lens and a Stanford strategy lens, we contend that an evidence-lineage engine of this class is correctly compared to data-infrastructure businesses (Palantir, Snowflake, Databricks) rather than to healthcare analytics or cost-containment software, and we derive the valuation logic that follows from that classification.

**JEL classification:** D82 (asymmetric information), G34 (mergers, corporate governance), I11 (health: market structure), L14 (transactional relationships), M21 (business economics).

**Keywords:** agency theory, information economics, fiduciary forensics, EBITDA leakage, evidence lineage, capital efficiency intelligence, ERISA.

---

## 1. Introduction

The standard treatment of employer healthcare cost frames it as a forecasting and reporting problem: assemble claims, benchmark spend, render a dashboard, and exhort the plan sponsor toward "engagement." This framing is category error. It presumes that the principal (the employer, and through it the plan participants) lacks *information*, when the binding constraint is that the principal lacks *enforceable evidence* about the conduct of its agents. Dashboards show numbers. They do not show receipts.

We adopt the opposite premise. Healthcare cost is a structural consequence of three failures that are economic, not analytic, in nature:

1. **A governance failure.** ERISA imposes fiduciary duties on plan sponsors, yet the parties who price the plan (PBMs, brokers, carriers) are not the parties who bear its fiduciary liability. The residual claimant and the decision-maker are decoupled.
2. **An evidence failure.** The contracts, claim records, and remittances that would prove or disprove fair dealing are dispersed, proprietary, and deliberately opaque. Absent reconciled evidence, even a diligent fiduciary cannot quantify its exposure.
3. **A computation failure.** When the evidence is assembled, the leakage is *deterministic*: it is the arithmetic difference between what was paid and what was allowable. It is not a statistical estimate that requires belief; it is a quantity that requires only correct accounting.

The thesis of this paper, and of the platform it documents, is that solving (3) under the discipline of (2) is what disciplines (1). We name the resulting category **Capital Efficiency Intelligence (CEI)**: the practice of converting opaque intermediated spend into a reconstructable, dollar-denominated, fiduciary-grade ledger of consequence.

The remainder of the paper proceeds as follows. Section 2 develops the economic framework (agency, information, and the DRAP primitive). Section 3 states the constitutional doctrine that governs every assertion the system makes. Section 4 documents the fifteen operating modules and showcases the top KPIs of each. Section 5 supplies the valuation and strategy analysis. Section 6 concludes.

---

## 2. Economic Framework

### 2.1 The principal-agent structure of intermediated benefits

Let a plan sponsor (principal *P*) delegate plan design and pricing to a set of agents *A = {broker, PBM, carrier, TPA}*. Each agent's compensation *cᵢ* is, in the prevailing market, a function of plan spend rather than of plan efficiency. Where compensation rises with the very cost the agent is retained to minimize, the incentive-compatibility constraint of classical agency theory is violated by construction. The agent's optimal action is not the principal's optimal outcome. This is not malfeasance; it is equilibrium.

Two consequences follow. First, rent extraction is *persistent* because it is structurally rewarded. Second, it is *concealed*, because disclosure would convert a tolerated equilibrium into an actionable fiduciary breach. Concealment is therefore an economic activity with its own returns, which is why the evidence is opaque by design rather than by accident.

### 2.2 From information asymmetry to evidence asymmetry

The information-economics literature (Akerlof, Spence, Stiglitz) treats asymmetry as a gap in *what is known*. The operative gap in healthcare is subtler: it is a gap in *what can be proven*. A sophisticated CFO may strongly suspect rent extraction yet remain unable to act, because suspicion is not admissible and is not negotiable. The platform's design objective is therefore to collapse evidence asymmetry, not merely information asymmetry, by binding every number to a cryptographically verifiable lineage. The economic payoff of evidence is its *enforceability*: a proven dollar can be recovered or renegotiated; a suspected dollar cannot.

### 2.3 The DRAP primitive and EBITDA leakage

Define, per claim *j*:

> **Spreadⱼ = Paidⱼ − Allowableⱼ**

where *Paidⱼ* is the realized remittance and *Allowableⱼ* is the benchmark-allowable price (NADAC, actuarially derived fee schedule, or contractually warranted rate). The plan-level leakage primitive is:

> **DRAP = Σⱼ Spreadⱼ**

DRAP is the **Delta Realized vs. Allowable Pricing**. Its defining properties are economic, not statistical:

- **It is EBITDA leakage, not a soft "savings opportunity."** Every dollar of DRAP is a dollar that left the enterprise without consideration and that, capitalized at the firm's multiple, depresses enterprise value.
- **It is deterministic.** Given the claim set and the allowable schedule, DRAP is computed, not inferred. The same inputs yield the same output, byte for byte. (In the platform's reference seed, a demonstration plan portfolio reconstructs to **DRAP = $6,230,840** on every run, a property the verification harness asserts directly.)
- **It is reconstructable.** Each summand carries a receipt, so the aggregate can be drilled back to the line that produced it.

### 2.4 Normalization: PEPM and the comparability problem

Raw DRAP is not comparable across groups of different size. We normalize using **PEPM (Per Employee Per Month)**, and its per-member analogue PMPM:

> **PEPM = Total Plan Cost / Member-Months**

PEPM renders a 200-life employer and a 20,000-life employer commensurable, which is the precondition for benchmarking against national and state percentile distributions (P50/P75/P90). It is the unit in which governance conclusions become portable.

### 2.5 Confidence as a measured quantity: CEI

Not every assertion rests on equally hard evidence. We make the strength of evidence itself a *measured* quantity, the **Confidence Engine Index (CEI)**, a 0–100 score reflecting the verification level of a finding. CEI is what permits the system to be aggressive where evidence is reconciled and silent where it is not, rather than uniformly hedging. It is the formal bridge between the economics of Section 2 and the doctrine of Section 3.

---

## 3. Constitutional Doctrine

A forensic-economic engine is only as credible as its weakest unverified claim. The platform therefore subordinates every output to a constitution.

### 3.1 The four hard rules

1. **One screen, four tiles, always.** Executive cognition is bounded; the system refuses to dilute attention beyond four simultaneous claims.
2. **Every number is clickable into receipts.** Drill, not tooltip. A number that cannot be reconstructed does not earn the screen.
3. **No export without a SHA-256 evidence manifest.** Portability of a conclusion requires portability of its proof.
4. **Narratives never outrun evidence.** `INSUFFICIENT_EVIDENCE` is a valid, first-class finding.

### 3.2 The three confidence tiers

- **CERTIFIED** — contract clause plus claim record plus remittance, reconciled.
- **MODELED** — inference from incomplete evidence, with bounds disclosed.
- **INSUFFICIENT_EVIDENCE** — no finding issued; logged as a gap.

There is no fourth tier. The discipline is in the refusal to invent one.

### 3.3 The seven-gate enforcement chain

> **DEFINE → WIRE → VALIDATE → PROMOTE → COMPUTE → GATE → RENDER**

Every metric advances through these gates before it is allowed onto a screen. The chain is what operationalizes "narratives never outrun evidence": a number cannot be RENDERED until it has been VALIDATED and GATED.

---

## 4. The Operating Modules and Their Key Performance Indicators

The fifteen modules below implement the framework as a pipeline: *discover* leakage, *adjudicate* it against contracts and benchmarks, and *synthesize* it for the principal. For each module we state its function and showcase its headline KPIs.

### 4.1 Filing Intelligence
*Forensic discovery layer.* A search engine over 936k+ DOL Form 5500 filings that surfaces plan-sponsor "leaks" in administrative fees, PBM cost, and broker commissions, ranked by recoverable value.

> **Top KPIs**
> - **OI Score (Opportunity Intelligence)** — composite rank of a sponsor's recoverability.
> - **Recoverable Value ($)** — Excess Admin + Excess PBM relative to benchmark.
> - **Filing universe** — 936k+ Form 5500 records under index.
> - **Excess-fee percentile** — sponsor fee position vs. national P50/P75/P90.

### 4.2 CFO War Room
*Executive synthesis layer, and the platform's front door.* The four-tile doctrine command center for C-suite decision-making, with ten levels of drill-down from raw signal to board narrative.

> **Top KPIs**
> - **Four governing tiles** — Financial Exposure, Contract Integrity, Operational Behavior, Strategic Leverage.
> - **FCR % (Fee-to-Revenue)** — intermediary take as a share of plan economics.
> - **Total First-Year Opportunity ($)** — recoverable value actionable within 12 months.
> - **Commit Gate (1–7)** — current position in the evidence-enforcement chain.

### 4.3 HIOS — Healthcare Intelligence Operating System
*Cross-module fusion layer.* "Palantir for healthcare": fuses claims, PBM contracts, and litigation signals into one command surface that operates simultaneously as PBM forensic auditor, ERISA litigator, strategist, and chief medical officer.

> **Top KPIs**
> - **Dollars Recovered ($)** — realized recoveries across linked modules.
> - **Annual $ at Risk** — forward exposure under current contracts.
> - **System Health** — live agents online and active ingestion streams.
> - **Prior-Auth appeal throughput** — appeals tracked against the 180-day ERISA window.

### 4.4 Claims Recovery IQ
*Adjudication layer for paid claims.* Forensic audit of medical and pharmacy claims for overpayment, duplicate charges, and upcoding, with a GPT-4o forensic engine and a severity-ranked findings queue.

> **Top KPIs**
> - **Recovery Opportunity ($)** — total identified overpayment.
> - **PMPM vs. Benchmark** — normalized cost gap.
> - **Findings by severity** — count of CRITICAL/HIGH/MEDIUM findings.
> - **Confidence tier mix** — share of findings CERTIFIED vs. MODELED.

### 4.5 Sales IQ Console / Broker Console
*Go-to-market intelligence.* A dual-purpose prospecting and state-regulatory module pairing a 50-state map with a sales-angle generator and an integrated qualification engine.

> **Top KPIs**
> - **Transparency Score** — sponsor/market openness rating.
> - **PBM Risk Score** — exposure to spread and opaque rebate structures.
> - **Regulatory Strictness** — state-level enforcement intensity.
> - **Qualified-prospect count** — accounts passing the qualification engine.

### 4.6 Account Intel Hub
*Enrichment layer.* Firmographic and technographic enrichment that queries 14+ data providers in parallel (Apollo, Crunchbase, TheirStack, Hunter, Salesforce, HubSpot).

> **Top KPIs**
> - **Overall Intel Score** — composite account-readiness rating.
> - **Signal Count** — active intent and M&A signals detected.
> - **Contact Confidence** — verified-contact reliability.
> - **Provider coverage** — 14+ enrichment sources fused per account.

### 4.7 Sales IQ Intelligence (50-State Module)
*Regulatory overlay.* Deep state-by-state context for PBM spread pricing, broker disclosure law, and ERISA overlays, surfaced through an interactive map and per-state detail panels.

> **Top KPIs**
> - **Spread Prevalence %** — frequency of spread pricing by state.
> - **Pass-through Prevalence %** — adoption of pass-through models.
> - **Difficulty vs. Opportunity index** — sales-profile positioning per state.
> - **Coverage** — all 50 state regulatory regimes encoded.

### 4.8 Sales OS
*Revenue operating system.* A full-stack sales OS with a Kanban pipeline and DOL-driven prospecting, scoring employer accounts on a four-axis model.

> **Top KPIs**
> - **Opportunity Score (0–100)** — Fiduciary Risk + Savings + Market Timing + Strategic Fit.
> - **Estimated Annual Premium ($)** — addressable plan economics per account.
> - **Potential Revenue ($)** — modeled commission/fee capture.
> - **Pipeline velocity** — stage-to-stage conversion across the Kanban.

### 4.9 Shady Broker Index
*Forensic integrity scorecard.* Ranks broker integrity on commission concentration and multi-year Form 5500 anomalies across ten categories.

> **Top KPIs**
> - **Integrity Score (0–100)** — 100 denotes clean conduct.
> - **5-Year At-Risk Value ($)** — cumulative exposure attributable to the broker.
> - **Documented Overcharge ($)** — evidenced excess compensation.
> - **Red-flag count** — anomalies surfaced across ten scoring categories.

### 4.10 Rx Defense IQ
*Contract adjudication, pharmacy.* The PBM contract "X-ray": evaluates PDF/DOCX contracts against 65 fiduciary-aligned issues across 13 provisions and quantifies pricing distortion.

> **Top KPIs**
> - **Fiduciary Score (0–100)** — provision-weighted contract integrity.
> - **DRAP ($)** — realized-vs-allowable pricing leakage (reference seed: **$6,230,840**).
> - **Provisions analyzed** — 13 provisions / 65 issues per contract.
> - **Dollar Exposure ($)** — per-provision annualized exposure.

### 4.11 Rx Defense Pro
*Commercial / ROI layer.* The buyer-facing ROI calculator and packaging for the Rx Defense suite, translating forensic output into a recoverability estimate for brokers and enterprises.

> **Top KPIs**
> - **Estimated Hidden Exposure ($)** — modeled leakage from member count and Rx spend.
> - **Typically Recoverable ($)** — expected realizable recovery.
> - **ROI multiple** — recovery vs. engagement cost.
> - **Tiering** — Single / Monthly / Enterprise economics.

### 4.12 Rx PBM Intelligence
*Market knowledge base.* A reference hub for the pharmacy ecosystem: NADAC/AWP pricing, a directory of 24 PBMs, formulary analysis, and an RFP question bank.

> **Top KPIs**
> - **Spread Pricing %** — benchmark spread by drug/PBM.
> - **Rebate Pass-through Status** — share of rebate value reaching the plan.
> - **PBM directory** — 24 PBMs profiled.
> - **NADAC/AWP variance** — acquisition-cost-to-list distortion.

### 4.13 Stop-Loss IQ
*Contract adjudication, catastrophic risk.* Analysis of stop-loss policies for lasering risk and reimbursement clarity, with a carrier accountability index.

> **Top KPIs**
> - **Carrier Accountability Score** — carrier conduct rating.
> - **Risk Rating** — Excellent → Red Flag classification.
> - **Lasering exposure ($)** — value at risk from laser provisions.
> - **Attachment-point analysis** — tiered IBNR/reserve adequacy.

### 4.14 Network IQ
*Adequacy and leakage layer.* Maps member access against CMS standards, quantifying out-of-network leakage and CAA transparency compliance.

> **Top KPIs**
> - **Network Adequacy Score** — coverage vs. CMS standard by specialty.
> - **Leakage $ Exposure** — cost of out-of-network utilization.
> - **CAA Compliance Score** — transparency-requirement conformance.
> - **PMPM in/out-of-network trend** — directional access cost.

### 4.15 Fiduciary IQ
*Governance and audit-readiness layer.* The ERISA compliance and DOL audit-readiness dashboard, including a 408(b)(2) tracker and duty-level risk scoring.

> **Top KPIs**
> - **Fiduciary Risk Score** — composite breach exposure.
> - **DOL Audit Readiness Grade** — preparedness rating.
> - **Undisclosed Fees ($)** — 408(b)(2) disclosure gaps quantified.
> - **Compliance checklist completion %** — ERISA control coverage.

### 4.16 Operating Systems (the integrated whole)

The four "OS" surfaces (HIOS, Sales OS, RFP OS, RFP Intelligence OS) are not additional features but *compositions* of the modules above into role-specific command rooms. The economic point is that the same DRAP-grade evidence flows unchanged from a forensic discovery in Filing Intelligence to a board tile in the CFO War Room, with its receipt and confidence tier intact at every hop. The platform's headline portfolio KPI is the union of these flows: total reconstructable DRAP under management, the share CERTIFIED, and the first-year recoverable subset.

---

## 5. Valuation and Strategy

### 5.1 What is being valued (the Chicago lens)

Conventional comparables would price this asset as healthcare analytics or cost-containment software, categories that trade on usage and churn against modest gross margins. That comparison misreads the asset. What the platform produces is not analysis; it is *enforceable evidence*, and evidence is a durable, compounding, and defensible good.

Three Chicago-school properties drive the valuation:

1. **The output is a property right, not a report.** A CERTIFIED, manifest-signed finding is closer to a title than to a slide. Its value is its enforceability (Section 2.2), and enforceable claims do not churn the way dashboards do.
2. **Evidence lineage is an increasing-returns asset.** Each reconciled contract, claim, and remittance enriches the benchmark distributions (P50/P75/P90) against which the next finding is scored. Marginal cost of the next finding falls while its credibility rises, the classic signature of a data-network moat.
3. **The TAM is mispriced because the unit is wrong.** Measured as "benefits software seats," the market looks small. Measured as a recoverable share of intermediated EBITDA leakage across self-funded plans, the addressable quantity is the capitalized value of DRAP across the economy, which is orders of magnitude larger.

The correct comparable set is therefore the data-infrastructure class, **Palantir, Snowflake, Databricks**, businesses valued on the durability and lineage of the data asset rather than on application-layer engagement.

### 5.2 How value is captured (the Stanford lens)

Strategically, three structural advantages convert the economic thesis into defensible margin:

- **Wedge then platform.** Each module (Rx Defense, Stop-Loss, Network, Fiduciary) is an independent wedge that lands on a single contract or claim set, then composes into the OS layer. Land-and-expand is built into the product topology, not bolted on.
- **The doctrine is the moat.** The four hard rules and the SHA-256 manifest are not compliance overhead; they are a switching-cost generator. Once a CFO's board accepts manifest-grade evidence, competing on un-receipted "insights" is no longer admissible.
- **Incentive realignment is the wedge's selling point.** Because the buyer is the CFO, the PE operating partner, or the board, and never HR, the sale is framed as capital efficiency and fiduciary risk transfer, not as a benefits purchase. This re-prices the deal from a cost-center line item to an enterprise-value lever.

### 5.3 The valuation identity

Combining the two lenses, enterprise value scales with three quantities the platform itself measures:

> **EV ∝ (Reconstructable DRAP under management) × (CERTIFIED share) × (Capitalization multiple of recovered EBITDA)**

The first term is supply (how much leakage the engine can see), the second is defensibility (how much it can prove), and the third is the market's translation of recovered earnings into value. The platform's KPIs, showcased per module in Section 4, are precisely the operational measurements of this identity.

---

## 6. Conclusion

We have argued that employer healthcare cost is a governance, evidence, and computation problem, and that solving the computation under the discipline of the evidence is what disciplines the governance. The DRAP primitive converts diffuse suspicion into a deterministic, reconstructable, dollar-denominated quantity; the constitutional doctrine guarantees that no asserted dollar outruns its receipt; and the fifteen operating modules implement the full pipeline from forensic discovery to board-level synthesis, each measured by the KPIs showcased above. The strategic and valuation implication is that an evidence-lineage engine of this class belongs to the data-infrastructure category, where value accrues to the durability and provability of the data asset. Dashboards show numbers. This platform shows receipts, and receipts, unlike numbers, can be enforced, recovered, and capitalized.

---

## References (selected, indicative)

- Akerlof, G. (1970). "The Market for Lemons: Quality Uncertainty and the Market Mechanism." *Quarterly Journal of Economics.*
- Jensen, M., and Meckling, W. (1976). "Theory of the Firm: Managerial Behavior, Agency Costs and Ownership Structure." *Journal of Financial Economics.*
- Spence, M. (1973). "Job Market Signaling." *Quarterly Journal of Economics.*
- Stiglitz, J. (1975). "The Theory of Screening, Education, and the Distribution of Income." *American Economic Review.*
- Holmström, B. (1979). "Moral Hazard and Observability." *Bell Journal of Economics.*
- Coase, R. (1960). "The Problem of Social Cost." *Journal of Law and Economics.*
- Employee Retirement Income Security Act of 1974 (ERISA), 29 U.S.C. §1001 et seq.; Consolidated Appropriations Act, 2021 (CAA), transparency provisions.

*This working paper documents the conceptual and economic architecture of the Kincaid IQ platform. KPI values cited as reference-seed figures (e.g., DRAP = $6,230,840) are deterministic demonstration values produced by the platform's verification harness and are intended to illustrate methodology, not to represent any specific client engagement.*
