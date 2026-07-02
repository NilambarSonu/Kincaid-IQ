# Closing the Loop on RFP Intelligence: What Changed and Why

*Kincaid IQ — RFP Intelligence OS · June 2026*

For most of its life, the RFP Intelligence OS could tell a broker *what* to do —
which accounts to chase, what price to bid, how to talk to a prospect. What it
couldn't do was tell you whether it was any *good* at it. This round of work
closes that loop. The platform now grades its own forecasts, keeps its pricing
math honest across the stack, and gives brokers more day-to-day control over the
bid scenarios they live in. It also fixes a quiet data-integrity problem that
was breaking opportunity records behind the scenes.

This article walks through the changes in plain terms, then drops into the
specifics for the people who care about them.

---

## 1. A new "Model Health" view — the system now grades itself

The headline addition is a **RFP Model Health** page (`/rfp-model-health`,
reachable from the sidebar). It exists to answer a single uncomfortable
question: *how much should you trust the numbers this platform shows you?*

It is backed by a new, self-contained API (`/api/rfp/*`) that delivers seven
lightweight intelligence checks:

1. **Score the score.** Every closed win/loss is compared against the win
   probability the model *predicted* at the time. From that history it computes
   the standard scorecard a data scientist would ask for — a **Brier score**
   (overall accuracy of the probabilities), **AUC** (can it tell winners from
   losers at all?), and a **calibration** breakdown (when it says "70%," does it
   actually win ~70% of the time?).
2. **Empirical price elasticity.** Instead of assuming how sensitive a client is
   to price, the system now fits the price-response curve to your *actual* closed
   outcomes via a log-loss grid search, surfacing the alpha that best explains
   the wins and losses you've really had.
3. **Stale pipeline detection.** Opportunities that have gone quiet or blown
   past their close date are flagged so nothing rots silently in the pipeline.
4. **Duplicate detection (entity resolution).** Accounts and opportunities that
   are really the same employer — matched on EIN or a normalized company name
   (stripping "Inc.", "LLC", and the like) — are surfaced so your book stays
   clean.
5. **Correlation-aware forecasting.** The pipeline Monte Carlo can now model a
   shared market shock across deals, so the forecast band reflects systemic risk
   rather than pretending every deal is independent (more on the math below).
6. **One-click promotion.** Promote a researched account straight into a live
   RFP opportunity.
7. **HubSpot sync.** Push an opportunity to HubSpot as a deal from inside the
   workflow.

### Honesty as a feature: the three-tier confidence rule

Every one of these readouts obeys the platform's confidence doctrine. With fewer
than 5 records to work from, the answer is **INSUFFICIENT_EVIDENCE** — the system
declines to issue a finding rather than inventing one. Between 5 and 12 records
it's labeled **MODELED** (an inference with disclosed limits), and only above
that does it earn **CERTIFIED**. A model-health page that lied about its own
confidence would defeat its entire purpose.

---

## 2. Honest correlation in the forecast

The pipeline forecast's Monte Carlo simulation gained an optional
**correlation** control. At zero it behaves exactly as it always did — every
deal wins or loses independently — so nothing downstream changed by surprise.

The interesting part is *how* correlation was added, because the first instinct
is subtly wrong. Blending a shared random draw with a per-deal draw
(`rho × shared + (1−rho) × independent`) seems reasonable, but it quietly shifts
each deal's win probability away from the calibrated value — the slider would
have biased the forecast, not just widened it.

The implementation instead uses a **marginal-preserving mixture**: for each deal,
with probability *rho* it adopts the shared market draw, otherwise it draws its
own. Because both draws are uniform, every deal keeps its exact calibrated win
probability no matter where the slider sits — only the *dependence* between deals
changes. Turn it up and deals increasingly move together, widening the P10–P90
band to reflect real systemic risk, without ever moving the expected outcome.

---

## 3. One source of truth for the bid math

The Bid Optimizer's pricing curve — the logistic price-to-win-probability model,
the peak expected-value price, and the recommended range — used to be written
*twice*: once in Python on the server and once in TypeScript in the browser. Two
copies of the same math is two copies that can silently drift apart, and they
had: the client wasn't rounding probabilities the same way, and a percentage
label used a different rounding rule than the server.

The curve is now defined **once per language** (`backend/bid_model.py` and
`client/src/lib/bidModel.ts`), with both the server endpoint and the on-screen
recompute delegating to it. More importantly, a parity test
(`client/src/lib/bidModel.test.ts`) runs the Python implementation over a
~9,660-point grid and asserts the two produce **byte-identical** output. Any
future drift now fails the test suite instead of quietly mispricing a bid.

---

## 4. Brokers get more control over saved scenarios

Three quality-of-life upgrades landed in the Bid Optimizer:

- **Rename a saved scenario.** A mistyped scenario name no longer means
  delete-and-recreate — scenarios can be renamed inline (pencil to edit, Enter to
  save, Escape to cancel).
- **Baseline comparison.** A new table lists the unmodified model baseline
  alongside every saved scenario — anchor, base win probability, alpha, peak-EV
  price, peak EV, and recommended range — with the strongest scenario
  highlighted. All rows are derived from the same shared bid math, so the
  comparison is apples-to-apples.
- **Email the recommendation.** A "Send to…" action emails the one-page bid
  recommendation PDF directly to a client or teammate. The emailed PDF is
  byte-identical to the downloaded one (same SHA-256 evidence manifest), and the
  send is recorded in the client-package delivery history with a "Bid PDF"
  source badge.

---

## 5. Locking down recalibration with tests

The scoring engine can recalibrate its own factor weights as win/loss outcomes
roll in — powerful, but exactly the kind of subtle logic that breaks quietly.
That behavior is now protected by automated tests covering both the **automatic**
recalibration trigger (it fires once when it should, stays idempotent, and
no-ops safely on insufficient data) and the **manual** "recalibrate" endpoint
(returns a clean 400 rather than a 500 when there's too little data, writes the
expected weights, and re-scores only the opportunities it should). These run as a
dedicated backend test suite on every change.

---

## 6. The quiet fix: self-healing schema

Underneath all of this, the `rfp_opportunities` table had drifted out of sync
with the application's data model — eleven columns the code expected (including
the multi-tenant `org_id`) simply weren't there on existing databases, which
broke *every* opportunity query with an "undefined column" error.

The durable fix is an idempotent startup migration that adds any missing columns
(and their indexes) automatically when the app boots. The reason this matters
beyond the immediate bug: the framework's table creation only ever *creates*
missing tables — it never *alters* an existing one. So adding a field to a model
silently breaks production until something explicitly migrates the table. That
"something" now runs on every startup, so rollbacks and future merges self-heal
instead of regressing.

---

## In short

The platform moved from *making* recommendations to *standing behind* them. It
now measures its own forecast accuracy, prices bids from a single verified
formula, models real market risk without distorting its own numbers, and refuses
to overstate confidence when the evidence is thin. The broker-facing
improvements — renameable scenarios, baseline comparisons, one-click emailing —
are the visible polish; the self-grading and self-healing underneath are what
make the visible parts trustworthy.
