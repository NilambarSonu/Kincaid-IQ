# Claims Recovery IQ™ — A Forensic Recovery Engine for Self-Funded Health Plans

### Recovering ERISA Plan Assets at Scale, Measured as a Percentage of Spend

*Kincaid RMC Intelligence Platform — Research & Methodology Paper*
*June 2026*

---

## Abstract

Self-funded employer health plans process billions of dollars in claims through a
chain of intermediaries — third-party administrators (TPAs), pharmacy benefit
managers (PBMs), carriers, and providers — each of which can introduce overpayment,
spread pricing, upcoding, and contract leakage. Under ERISA, the plan sponsor is the
fiduciary of record and is legally obligated to recover those leaked assets, yet most
plans lack the line-level forensic capability to find them. **Claims Recovery IQ™** is
a forensic audit and recovery engine that reconciles the full claims universe against
plan documents, vendor contracts, and federal statute; classifies every finding into a
three-tier evidence standard; quantifies recoverable dollars; and generates
respondent-specific statutory demand letters. This paper documents the *why*, the
*how*, and the *results* of the engine. The central result is reported, by design, as a
**percentage of total claims spend**: on a representative Fortune-20-scale engagement of
**$1.2184 billion** in annual claims across **187,400 covered lives**, the engine
identified a gross recovery opportunity of **1.22% of spend** ($14.84M), of which
**0.76% of spend** ($9.28M) was high-confidence, returning a **net client benefit of
0.88% of spend** ($10.68M) after a 28% contingency fee.

---

## 1. The Why — The Fiduciary and Economic Problem

### 1.1 The structural problem

A self-funded plan pays its own claims; the TPA, PBM, and carrier are *vendors*, not
risk-bearers. This creates a classic principal–agent problem from information
economics: the parties who adjudicate, price, and remit claims are not the parties who
bear the cost of error. Their incentives are, at best, neutral to overpayment and, in
several documented mechanisms (PBM spread pricing, retained rebates, retroactive DIR),
directly *aligned* with it. The plan sponsor — the principal — holds the fiduciary
duty but is structurally the least informed party in the transaction.

### 1.2 The legal mandate

ERISA does not make recovery optional. The plan sponsor is a fiduciary under
**ERISA §§403–406** and must act prudently to protect plan assets. Federal law has
sharpened this obligation:

- **CAA 2021 §204** — pharmacy pass-through pricing and broker/consultant compensation
  transparency obligations.
- **CAA 2024** — elimination of retroactive direct-and-indirect-remuneration (DIR)
  clawbacks.
- **No Surprises Act (NSA §2799B-5)** — balance-billing prohibitions and the
  Independent Dispute Resolution (IDR) pathway for out-of-network emergency and air
  ambulance claims.

Failure to identify and pursue recoverable overpayments is itself a potential breach of
the prudent-expert standard. The economic loss and the legal exposure are the same
dollar.

### 1.3 The economic stakes

Overpayment is not noise around a mean; it is a persistent drag measurable against a
peer benchmark. On the representative engagement, the plan ran a per-member-per-month
(PMPM) cost of **$542.10** against a Fortune-500 peer benchmark of **$399.80** — a
**$142.30 PMPM delta**, or roughly **35.6% above peer**. Not all of that gap is
recoverable, but it is the signal that motivates a forensic audit: a plan this far above
its peer set is leaking assets through mechanisms that line-level reconciliation can
isolate and price.

---

## 2. The How — Methodology

### 2.1 Inputs and the 90-day forensic cycle

The engine ingests claim extracts in **CSV, Excel, PDF, and EDI X12 837** formats into a
forensic vault, then runs a **90-day forensic audit cycle** structured in five phases:

| Phase | Window | Purpose |
|---|---|---|
| Engagement Authorization & Evidence Preservation | Days 1–14 | Contingency agreement + MNDA; agency authority over claims/PBM/TPA data; litigation hold to all custodians |
| Forensic Audit | Days 15–90 | Line-level reconciliation of the full universe against plan docs, vendor contracts, and statute |
| Formal Written Demand | Days 90–104 | Respondent-specific demand letters with statutory basis, computation, 30-day cure period |
| Negotiation & Settlement | Days 104–180 | Sponsor-authorized settlement; partial recovery does not waive unreleased claims |
| Recovery Distribution & Accounting | Upon recovery | Itemized accounting; 28% contingency due within 15 days; net returned to plan trust |

### 2.2 The forensic reconciliation

The core method is **line-level reconciliation**: every claim line is tested against the
contract rate schedule, the plan document, CMS NCCI bundling edits, DRG grouper
integrity, and the applicable statute. This produces detection across **15+ enterprise
recovery categories**, including:

- **Pharmacy:** PBM Spread Pricing, Formulary Rebate Retention, Specialty Drug DIR
  Clawback.
- **Facility/Provider:** Outlier DRG Payments (MCC upcoding), Facility Fee Unbundling
  (global-surgery violations), Dialysis Overpricing, Implant Pass-Through,
  Observation-vs-Admission manipulation, Reference-Based-Pricing arbitrage.
- **Carrier/TPA processing:** Out-of-Network billed when In-Network available,
  Duplicate Claims, Coordination-of-Benefits errors, Ineligible Dependents.
- **Risk transfer:** Stop-Loss Lasering irregularities, Air Ambulance CAA gaps.

### 2.3 The three-tier evidence standard

Every finding is assigned exactly one confidence tier. This is the discipline that keeps
the recovery number defensible rather than aspirational:

- **CERTIFIED** — contract clause + claim record + remittance, fully reconciled.
- **MODELED** — inference from incomplete evidence, with bounds disclosed.
- **INSUFFICIENT_EVIDENCE** — no finding issued; logged as a gap, not a recovery.

A modeled finding never masquerades as a certified one. A demand is only as strong as the
tier behind it.

### 2.4 The AI forensic layer

An AI forensic engine analyzes claim samples and finding patterns under a strict
board-room voice contract — it identifies the specific governing statute (e.g.,
*ERISA §403*, *CAA §204*), articulates the recovery computation, and assembles the
evidentiary narrative. The same layer drafts **respondent-specific demand letters**
addressed to the liable party's General Counsel (TPA, PBM, carrier, or provider), each
citing the exact contract clause and statute, a 30-day cure period, an interest-accrual
notice, and a reservation of **ERISA §502(a)** rights. The AI assembles; it does not
invent the dollar — every figure traces to a reconciled claim line.

### 2.5 System surface

The engine exposes a small, auditable API surface:

- `POST /api/claims-recovery/upload` — ingest claim files into the forensic vault.
- `POST /api/claims-recovery/ai-analyze` — run the forensic audit against samples.
- `GET /api/claims-recovery/dashboard` — Command Center with the Recovery Waterfall.
- `GET /api/claims-recovery/ar-ledger` — aging demands (0–30, 31–60, 61–90, 90+ days)
  with interest accrual.
- `GET /api/claims-recovery/action/{id}/demand-letter` — respondent-specific demand.
- `GET /api/claims-recovery/board-pack` — executive PDF summary.

---

## 3. Results — Measured as a Percentage of Spend

> All percentages below are normalized against **total claims spend of
> $1,218,400,000** for the representative engagement (187,400 covered lives;
> 1,284,719 claims reviewed). Reporting recovery as a *share of spend* — rather than as
> an absolute dollar figure — makes results comparable across plans of different sizes
> and is the engine's primary results convention.

### 3.1 Headline results

| Metric | Dollars | **% of Spend** |
|---|---:|---:|
| Total claims spend (denominator) | $1,218,400,000 | 100.00% |
| Anomalies flagged | $89,400,000 | **7.34%** |
| Recoverable (post-screen) | $21,200,000 | **1.74%** |
| **Gross recovery opportunity** | **$14,840,000** | **1.22%** |
| High-confidence recovery | $9,280,000 | **0.76%** |
| Contingency fee (28%) | $4,155,200 | 0.34% |
| **Net client benefit** | **$10,684,800** | **0.88%** |

The recovery waterfall narrows the universe from claims paid → audited (80.8% of
universe) → anomalies flagged (7.34%) → recoverable (1.74%) → defensible recovery
opportunity (1.22%) → net benefit after fee (0.88%).

### 3.2 Results by evidence tier (as % of spend)

| Confidence tier | Itemized recovery | % of Spend |
|---|---:|---:|
| CERTIFIED (8 findings) | $7,573,200 | **0.62%** |
| MODELED (7 findings) | $4,866,400 | **0.40%** |
| **Total itemized (15 findings)** | **$12,439,600** | **1.02%** |

More than 60% of the itemized recovery sits in the CERTIFIED tier — i.e., backed by a
reconciled contract clause, claim record, and remittance — which is the portion most
defensible in a demand or before the DOL.

### 3.3 Results by recovery category (as % of spend)

| # | Category | Confidence | Recovery | % of Spend |
|---|---|---|---:|---:|
| 1 | PBM Spread Pricing | CERTIFIED | $2,140,000 | 0.176% |
| 3 | Outlier DRG Payments (upcoding) | MODELED | $1,840,000 | 0.151% |
| 4 | Facility Fee Unbundling | CERTIFIED | $1,120,000 | 0.092% |
| 6 | Dialysis Overpricing | CERTIFIED | $980,000 | 0.080% |
| 2 | Formulary Rebate Retention | MODELED | $890,400 | 0.073% |
| 5 | Air Ambulance CAA Gap | CERTIFIED | $847,200 | 0.070% |
| 8 | OON Billed When INN Available | CERTIFIED | $842,000 | 0.069% |
| 7 | Specialty Drug DIR Clawback | CERTIFIED | $640,000 | 0.053% |
| 9 | Duplicate Claims | CERTIFIED | $624,000 | 0.051% |
| 10 | Observation vs. Admission | MODELED | $580,000 | 0.048% |
| 15 | Stop-Loss Lasering Irregularities | MODELED | $436,000 | 0.036% |
| 11 | Implant Pass-Through | MODELED | $428,000 | 0.035% |
| 12 | COB Primary/Secondary Errors | MODELED | $380,000 | 0.031% |
| 13 | Ineligible Dependent | CERTIFIED | $380,000 | 0.031% |
| 14 | Reference-Based-Pricing Arbitrage | MODELED | $312,000 | 0.026% |

Pharmacy mechanisms (categories 1, 2, 7) alone account for **0.30% of spend** —
roughly a quarter of the gross opportunity — confirming the PBM as the single largest
leakage channel.

### 3.4 Results by liable vendor (share of exposure)

| Vendor | Exposure | Share of recovery exposure |
|---|---:|---:|
| ESI (PBM) | $5,840,000 | 39.4% |
| Providers | $4,920,000 | 33.2% |
| Aetna (TPA) | $2,840,000 | 19.1% |
| Cigna (Carrier) | $1,240,000 | 8.3% |

### 3.5 Benchmark result

The plan's **$142.30 PMPM** gap to the peer benchmark (35.6% above peer) is the
macro-level signal; the 1.22%-of-spend recovery opportunity is the micro-level,
line-item-attributable portion of that gap that the forensic audit can defend and pursue.

---

## 4. Discussion

**Why express results as a percentage of spend?** Three reasons. First,
*comparability*: a 1.22% result is meaningful whether the plan spends $200M or $2B,
whereas a dollar figure is not. Second, *fiduciary framing*: a percentage of plan
assets is the natural unit for a sponsor's duty of prudence. Third, *honesty about
magnitude*: 1.22% sounds modest until it is read as **$14.84M of recoverable plan
assets** — and as a recurring annual leakage rate, not a one-time event.

**Why the contingency model matters.** The engine operates on a **28% contingency** —
no recovery, no fee, no retainer. This aligns the recovery agent's incentive with the
plan's, and it means the reported net benefit (0.88% of spend) is the figure the plan
actually keeps. The fee itself (0.34% of spend) is only ever charged against dollars
genuinely returned to the trust.

**Why the three-tier standard is the product.** The constraint that a narrative may
never outrun its evidence — that INSUFFICIENT_EVIDENCE is a valid, logged outcome — is
what separates a recovery *demand* from a recovery *theory*. The 0.62%-of-spend
CERTIFIED tier is the floor a CFO can take to a board with confidence.

---

## 5. Limitations

- **Representative figures.** The dashboard figures used here describe a representative
  Fortune-20-scale engagement; actual recovery rates vary by plan size, vendor mix,
  contract quality, and look-back depth (12–36 months by category).
- **Modeled tier uncertainty.** 0.40% of spend sits in the MODELED tier, where recovery
  is an inference within disclosed bounds; realized recovery in this tier depends on
  document production and negotiation.
- **Recovery ≠ identification.** The 1.22% is the *identified, defensible* opportunity.
  Realized cash recovery depends on vendor cooperation, the cure-period response, and,
  where necessary, IDR or DOL escalation.
- **Scope.** The engine targets self-funded plans (typically ≥50,000 lives); the
  methodology generalizes to smaller plans but the per-engagement economics are tuned to
  enterprise scale.

---

## 6. Conclusion

Claims Recovery IQ™ reframes overpayment from an unavoidable cost of doing business into
a *quantifiable, recoverable, fiduciary-mandated* asset. By reconciling the full claims
universe at the line level, gating every finding to a three-tier evidence standard, and
converting findings into statutory demands, the engine turns the principal–agent problem
back in the sponsor's favor. The result, stated in the unit that matters:

> **1.22% of spend** identified as recoverable, **0.76% of spend** at high confidence,
> **0.88% of spend** returned to the plan trust net of fees — recurring, every plan
> year, for as long as the underlying vendor mechanisms persist.

For a plan spending more than a billion dollars a year, that is the difference between a
fiduciary who watches assets leak and one who recovers them.

---

## Appendix A — Key Figures (Representative Engagement)

| Parameter | Value |
|---|---|
| Covered lives | 187,400 |
| Claims reviewed | 1,284,719 |
| Total claims spend | $1,218,400,000 |
| PMPM actual / benchmark / delta | $542.10 / $399.80 / +$142.30 |
| Findings (total / board-reportable) | 15 / 6 |
| Gross recovery opportunity | $14,840,000 (1.22% of spend) |
| High-confidence recovery | $9,280,000 (0.76% of spend) |
| Contingency fee (28%) | $4,155,200 (0.34% of spend) |
| Net client benefit | $10,684,800 (0.88% of spend) |
| Active A/R balance | $7,283,200 |
| Forensic audit cycle | 90 days |

## Appendix B — Statutory Basis Cited by the Engine

ERISA §§403–406 (plan-asset protection, prudent-expert standard, prohibited
transactions); ERISA §502(a) (civil enforcement); ERISA §503 (claims procedures);
CAA 2021 §204 (pharmacy pass-through, compensation transparency); CAA 2024
(retroactive-DIR elimination; 42 CFR §423.182); No Surprises Act §2799B-5 (balance
billing, IDR); CMS NCCI edits (global surgical package, bundling); CMS DRG grouper
integrity; ACA §1001 (dependent age limit).

*Figures in this paper are sourced from the Claims Recovery IQ™ Command Center
(`backend/routers/claims_recovery.py`). Percentages are computed against total claims
spend of $1,218,400,000.*
