# The RFP Intelligence OS

### A Fiduciary-Grade System for Probabilistic Sales Intelligence, Resource Allocation, Account Monitoring, and Automated Briefing

*Kincaid IQ — Technical & Product Paper*
*June 2026*

---

## Abstract

Group-benefits brokers and consultants lose deals for structural, repeatable
reasons — they pursue the wrong RFPs, staff them inconsistently, miss the
renewal windows that re-open closed accounts, and operate without a single
source of truth on pipeline health. The RFP Intelligence OS is a closed-loop
sales operating system inside Kincaid IQ that addresses each of these failure
modes with evidence, not intuition. It ingests RFPs and scores them on a
seven-factor model, allocates finite analyst hours against expected value,
continuously monitors the DOL Form 5500 corpus for account-level change
signals, and delivers a scheduled intelligence digest so the loop runs without
anyone logging in.

This paper documents four interlocking subsystems: (1) the **RFP Intelligence
OS** core — intake, scoring, win/loss learning, and the Executive Command
Center; (2) the **Resource Allocator** — a greedy ROI optimizer over team
capacity; (3) the **Form 5500 Monitor** — year-over-year account change
detection and re-engagement; and (4) the **Intelligence Digest** — a scheduled,
preference-driven email briefing. Every subsystem is built to the platform's
constitutional doctrine: every number traces to evidence, no claim outruns its
data, and confidence is always labeled.

---

## 1. Design Philosophy

The OS inherits Kincaid IQ's constitutional doctrine, which shapes every design
decision:

1. **Every number is clickable into receipts.** Scores are not opaque; each of
   the seven factors carries its own sub-score and a written rationale.
2. **Narratives never outrun evidence.** When the data is too thin to support a
   finding — fewer than five recorded losses for a battlecard, for example — the
   system returns `INSUFFICIENT_EVIDENCE` rather than fabricating confidence.
3. **Exactly three confidence tiers.** Every AI- or model-derived assertion is
   labeled `CERTIFIED`, `MODELED`, or `INSUFFICIENT_EVIDENCE`.
4. **The voice is consistent.** All generated prose follows a single voice
   contract — senior-partner directness, structural justification, no marketing
   language — enforced via the system prompt on every AI call.

The OS is also **adaptive**: it does not assume its initial scoring model is
correct. It records outcomes, compares predictions to reality, and recalibrates
its own weights toward whatever actually correlates with wins for a given firm.

---

## 2. The RFP Intelligence OS Core

### 2.1 Intake & Parsing

The OS supports two ingestion paths, both routed through the platform's AI
extraction layer (Gemini 2.5 Flash via the `gemini_compat` client):

- **Manual upload** — PDF, DOCX, or TXT files are base64-encoded in the browser
  and posted to `POST /api/rfp/upload` (`backend/routers/rfp_intake.py`).
- **Email webhook** — inbound emails carrying RFP attachments are captured at
  `POST /api/rfp/webhook/email`, enabling a "forward-to-ingest" workflow.

The `_ai_parse` routine extracts twelve-plus structured fields — including
`employer_name`, `covered_lives`, `pbm_structure`, and `due_date` — and returns
a `parse_confidence` score (0–100). Any field the model could not confidently
extract is added to `needs_review_fields`, so the human reviewer's attention is
directed precisely where the machine was uncertain rather than across the whole
document.

### 2.2 The Seven-Factor Opportunity Scoring Engine

Each opportunity receives a composite score from 0 to 100, computed as a
weighted sum of seven factors. The weights below are the platform defaults
(`SCORE_WEIGHTS`); per-firm calibration (§2.4) can shift them.

| # | Factor | Weight | Scoring logic (summary) |
|---|--------|:------:|--------------------------|
| 1 | **Revenue Potential** | 22% | Tiered by contract value: ≥ $5M → 95 pts, ≥ $2M → 82, ≥ $500K → 68; falls back to a covered-lives estimate when value is absent. |
| 2 | **Strategic Value** | 18% | Bonuses for strategic verticals (healthcare, government) and complex, sticky plan types (self-funded). |
| 3 | **Win Probability** | 18% | Driven by `parse_confidence` and days remaining to `due_date` — thin data or a deadline already passed depresses the factor. |
| 4 | **Relationship Strength** | 15% | National incumbents (Mercer, Aon, etc.) penalized to 28 pts; regional/independent incumbents score 52. |
| 5 | **Competitive Intensity** | 12% | Geographic-footprint penalty (> 5 states, −20) and size penalty (> 2,000 lives, −15). |
| 6 | **Data Availability** | 10% | Share of `KEY_FIELDS` the AI successfully extracted — a direct measure of how much we actually know. |
| 7 | **Implementation Complexity** | 5% | Inverse factor: multi-state footprints, high live counts, and long requirement lists reduce the score. |

The composite maps to one of four **action tiers**:

- **Pursue Aggressively** — score ≥ 78
- **Pursue Selectively** — 58–77
- **Monitor** — 38–57
- **Decline** — < 38

Every opportunity persists not just `opportunity_score` but a full
`score_breakdown` (per-factor sub-scores), `score_factors` (written rationale
per factor), and a `score_confidence` tier — satisfying the "clickable into
receipts" rule.

### 2.3 AI Sales Enablement

Because each opportunity can be linked by EIN to the DOL Form 5500 corpus, the
OS generates grounded sales material rather than generic copy:

- `POST /api/rfp/opportunities/{id}/talking-points` — produces sales angles
  grounded in the employer's actual benchmarked admin fees, broker spend, and
  carrier mix drawn from DuckDB.
- `POST /api/rfp/opportunities/{id}/draft-response` — drafts a partner-grade RFP
  cover letter.
- **Competitive Battlecards** — surfaced inline on each opportunity. The card
  resolves a competitor in priority order: a pre-decision `known_competitor` tag
  first, then the `winning_competitor` recorded on a prior loss. The confidence
  tier is gated on the count of *loss* records (minimum of three) — below
  threshold the card reports `INSUFFICIENT_EVIDENCE` rather than guessing.

### 2.4 Win/Loss Intelligence & Adaptive Scoring

This is the learning loop that distinguishes the OS from a static scorecard.

- **Outcome capture** — every opportunity can be closed into one of four states
  (`won`, `lost`, `no_decision`, `deferred`) with a structured debrief:
  winning competitor, pricing factor, relationship factor, product gaps,
  procurement observations, and lessons learned (`RfpWinLoss`).
- **Win/Loss analytics** — server-side aggregation returns win rate, loss rate,
  average deal values, the share of losses driven by price, and breakdowns by
  competitor, reason, industry, and size band.
- **AI loss debrief** — `GET /api/rfp/win-loss/insights` synthesizes cross-deal
  patterns into 3–5 named strategic insights, each with an evidence count and a
  confidence tier (`CERTIFIED` only when backed by ≥ 5 records). Below five
  recorded losses it returns a single `INSUFFICIENT_EVIDENCE` finding by design.
- **Adaptive weights** — `POST /api/rfp/scoring/recalibrate` requires at least
  five decided outcomes, then nudges each factor weight by no more than ±3
  percentage points toward what correlated with wins, renormalizes to sum 1.0,
  and immediately re-scores the firm's entire open pipeline. Per-firm overrides
  live in `RfpScoringWeights`; a reset endpoint restores defaults. The OS thus
  converges on each firm's real win drivers over time.

### 2.5 The Executive Command Center

The Command Center is the single-screen pipeline view. Beyond stage-by-stage
aggregation of annual contract value at risk, it carries two probabilistic
instruments:

- **Monte Carlo Revenue Forecast** — rather than summing deal values, the
  forecast runs thousands of simulations over the open pipeline, treating each
  opportunity as a Bernoulli trial at its win probability and summing realized
  bookings per trial. The output is a **P10 / P50 / P90 booking band** — a
  defensible "we will likely book between X and Y" statement instead of a single
  fragile point estimate. A compact version is pinned to the OS header across
  every module; the full model lives on the Command Center.
- **Revenue Target Probability** — users set a target line and the model
  reports the probability of clearing it, converting "are we going to hit the
  number?" into an explicit percentage.

- **Forecast accuracy tracking** — at the moment a deal closes, the model's
  prediction is snapshotted (`RfpForecastAccuracy`). The Command Center then
  reports MAPE, predicted-vs-actual win rate, and calibration bias, and offers a
  one-click calibrated multiplier so the forecast self-corrects as real outcomes
  accumulate. The MAPE denominator is each deal's revenue-at-stake (not raw
  actual) to avoid divide-by-zero on lost deals.

---

## 3. The Resource Allocator

Scoring tells you which RFPs are *worth* pursuing; the Resource Allocator
(`client/src/pages/RfpResourceAllocator.tsx`) tells you which ones you can
*afford* to pursue with the analysts you actually have.

### 3.1 Expected-Value Model

Each opportunity is reduced to an expected value:

```
EV = P(win) × Contract Value
```

- **P(win)** derives from the opportunity score (defaulting to 50% when
  unscored).
- **Contract Value**, when not stated, is estimated as
  `covered_lives × $300 PMPM × 12 months × 15% commission`.

### 3.2 Greedy ROI Optimizer

The allocator ranks opportunities by **effective ROI** — expected value per
effort hour — and greedily staffs them "In" until the capacity pool is
exhausted. Strategic intent is encoded as multipliers: **Pursue Aggressively**
deals receive a 1.5× ROI boost, while **Decline**-tier deals are suppressed with
a 0.1× multiplier (and excluded outright when lockout is active). Opportunities
that do not fit the current pool are marked **Deferred**.

### 3.3 Capacity & What-If

Team capacity is configurable — `teamSize` (1–20 people) × `hrsPerPerson`
(4–80 hours) defines the total hour pool. A toggleable **what-if** mode lets a
sales leader adjust headcount and hours and immediately see how many additional
RFPs could be staffed and the resulting delta in captured expected value —
turning a hiring or overtime decision into a quantified revenue tradeoff.

---

## 4. The Form 5500 Monitor

Most broker CRMs treat a lost or dormant account as dead. The Form 5500 Monitor
(`backend/routers/rfp_intelligence.py`, `form_5500_monitor.py`;
`client/src/pages/Form5500Monitor.tsx`) treats it as a watch target, because the
DOL Form 5500 corpus reveals exactly when an account becomes winnable again.

### 4.1 Year-over-Year Change Detection

The monitor compares an employer's current and prior Form 5500 (Schedule H/A)
filings and raises an alert on four trigger types:

- `carrier_change` — a new carrier or TPA appears
- `participant_change` — material enrollment shift (`PARTICIPANTS`)
- `spend_change` — movement in `TOTAL_INCOME_AMT` / `ADMIN_SERVICE_FEES_AMT`
- `commission_change` — movement in broker commissions

Each of these is a textbook re-engagement trigger: a carrier change or a spike
in admin fees is precisely the moment an incumbent is vulnerable.

### 4.2 Account Profiles & Watchlist

Account profiles aggregate DuckDB benchmarking data — carrier names, PMPM broker
spend, and NAICS industry mapping — into a single intelligence view. Users
maintain a watchlist (`RfpWatchlistEntry`: `ein`, `employer_name`,
`last_seen_year`, `last_checked_at`) and can run an on-demand
`POST /api/rfp/watchlist/check-now` scan (rate-limited to once every five
minutes).

> **Data-integrity note.** Form 5500 filings carry a 12–18 month lag, and the
> DOL health/stop-loss boolean columns are unreliable (welfare benefit codes
> must be used instead). The monitor surfaces the filing-lag disclaimer in the
> UI and in every AI prompt, and any generated outreach is instructed to
> reference only detected changes — never invented events.

### 4.3 Nightly Alarm & Re-engagement

A scheduled job (`_rfp_new_filing_alarm` in `compliance_engine/scheduler.py`)
runs at **05:00 UTC**, compares each watched EIN's `last_seen_year` against the
latest Postgres/DuckDB data, generates alert records for new filings, and sends
SMTP notifications. From any alert the broker can generate an AI-drafted
re-engagement email (`POST /api/5500-monitor/alerts/{id}/draft-outreach`) that
references the specific detected change; sending it
(`/send-outreach`) logs the touchpoint to engagement history whether or not SMTP
is configured, so the audit trail is always intact.

---

## 5. The Intelligence Digest

The digest (`backend/routers/rfp_digest.py`,
`client/src/pages/DigestPreferences.tsx`) is what makes the OS run without anyone
opening it. It assembles a personalized briefing on a schedule and emails it.

### 5.1 Preferences

Each user controls a `RfpDigestPreference` record: `enabled`, `frequency`
(daily/weekly), `day_of_week`, `hour_utc`, a CC `recipients` list, and an
independent toggle for each of the four content sections.

### 5.2 Content Sections

1. **New RFPs** — opportunities ingested since the last send.
2. **5500 Alerts** — unread account-change alerts from the monitor.
3. **Top Opportunities** — the five highest-value active opportunities.
4. **Deadlines** — RFPs whose response deadline falls within 14 days.

Every line item carries a deep link straight to the relevant record
(`/rfp-os?opp={id}`, `/5500-monitor?alert={id}`), so the digest is a launchpad,
not a dead-end summary.

### 5.3 Scheduling & Delivery

`_compute_next_run_at` computes the next UTC fire time from the user's frequency,
day, and hour. An hourly scheduler job (`run_due_rfp_digests`, firing at :15 past
the hour) scans for users whose `next_run_at` has passed, assembles the HTML
digest, and sends it via SMTP.

> **Reliability invariant.** `last_sent_at` and `next_run_at` advance **only on
> confirmed SMTP success**. On failure the system stamps `last_attempt_at`,
> records `last_error`, and leaves the send window intact, so the next scheduler
> pass retries the same lookback period — no briefing content is ever silently
> dropped. When SMTP is unconfigured the system degrades gracefully and records
> the reason rather than erroring.

Endpoints: `GET/PUT /api/rfp/digest/preferences`, `GET /api/rfp/digest/preview`
(JSON for in-UI rendering), and `POST /api/rfp/digest/send-now` (immediate test
send).

---

## 6. The Closed Loop

The four subsystems are deliberately not independent tools — they form a cycle:

```
        ┌──────────────────────────────────────────────────────┐
        │                                                        │
        ▼                                                        │
  Form 5500 Monitor ──→ detects account change, raises alert    │
        │                                                        │
        ▼                                                        │
  RFP Intelligence OS ──→ ingests & scores the opportunity      │
        │                                                        │
        ▼                                                        │
  Resource Allocator ──→ staffs it against finite capacity      │
        │                                                        │
        ▼                                                        │
  Win/Loss capture ──→ records outcome, recalibrates weights ───┘
        │
        ▼
  Intelligence Digest ──→ briefs the team on all of the above, daily
```

A carrier change detected by the monitor becomes a scored opportunity in the OS;
the allocator decides whether it is worth an analyst's week; the outcome is
captured and feeds back into the scoring weights; and the digest keeps the whole
team aware without anyone polling a dashboard. Each pass through the loop makes
the next prediction better.

---

## 7. Architecture Summary

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TypeScript, Wouter, TanStack Query, Recharts |
| Backend | Python FastAPI, SQLAlchemy ORM |
| Operational store | PostgreSQL (`rfp_opportunities`, `rfp_win_loss`, `rfp_scoring_weights`, `rfp_forecast_accuracy`, `rfp_digest_preferences`, `rfp_watchlist`, monitoring alerts/engagement history) |
| Analytics store | DuckDB — DOL Form 5500 corpus for benchmarking & change detection |
| AI | Gemini 2.5 Flash via the `gemini_compat` client, under the platform voice contract |
| Scheduling | APScheduler jobs in `compliance_engine/scheduler.py` (05:00 UTC filing alarm; hourly :15 digest run) |
| Delivery | SMTP with success-gated state advancement |

---

## 8. Conclusion

The RFP Intelligence OS reframes broker business development as a control
system. It replaces gut-feel RFP triage with a transparent seven-factor score,
replaces ad-hoc staffing with expected-value optimization against real capacity,
replaces dead pipelines with continuous Form 5500 surveillance, and replaces
manual status-chasing with a self-running intelligence digest. Critically, it is
honest about its own limits: it labels confidence, refuses to issue findings it
cannot support, discloses the data lag inherent in regulatory filings, and
recalibrates against reality every time a deal closes. The result is not a
dashboard but a learning loop — one that gets measurably sharper with every RFP
it sees.
