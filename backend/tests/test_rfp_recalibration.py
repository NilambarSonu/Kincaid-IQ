"""
Tests for the RFP adaptive-scoring auto-recalibration trigger.

These lock in the subtle rules of `_maybe_auto_recalibrate` / `_recalibrate_weights`
/ `record_outcome` in backend.routers.rfp_intelligence:

    * Recording decided outcomes that cross the threshold multiple creates
      exactly one `auto_threshold` scoring-weights row.
    * Re-editing an existing outcome (no change to the decided count) does not
      re-fire the auto recalibration.
    * Insufficient-data / no-detectable-pattern cases no-op silently — the
      soft failure is swallowed, no row is written, and no exception escapes.

Run with:  python -m unittest backend.tests.test_rfp_recalibration
"""

import json
import unittest
import uuid

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend import models
from backend.config import settings
from backend.routers import rfp_intelligence as rfp


# A factor breakdown that makes a factor strongly predictive: wins score high,
# losses score low on `revenue_potential`, yielding a >=15pt gap → an adjustment.
_WIN_BREAKDOWN = {"revenue_potential": 80}
_LOSS_BREAKDOWN = {"revenue_potential": 40}
# An undifferentiated breakdown: identical for wins and losses → no pattern.
_FLAT_BREAKDOWN = {"revenue_potential": 60}

# A multi-factor breakdown that moves three factors at once:
#   revenue_potential:    85 vs 40 → +45pt gap  → +0.03  (strong win driver)
#   strategic_value:      80 vs 45 → +35pt gap  → +0.03  (strong win driver)
#   competitive_intensity:30 vs 75 → -45pt gap  → -0.015 (strong loss driver)
#   relationship_strength:60 vs 60 →   0pt gap  → unchanged (near-zero)
_MULTI_WIN_BREAKDOWN = {
    "revenue_potential": 85,
    "strategic_value": 80,
    "competitive_intensity": 30,
    "relationship_strength": 60,
}
_MULTI_LOSS_BREAKDOWN = {
    "revenue_potential": 40,
    "strategic_value": 45,
    "competitive_intensity": 75,
    "relationship_strength": 60,
}


class AutoRecalibrationTests(unittest.TestCase):
    def setUp(self):
        # Single shared in-memory SQLite connection so every Session sees the
        # same data (StaticPool keeps one underlying connection alive).
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        # The models declare `gen_random_uuid()` as a Postgres server-side
        # default for primary keys; SQLite has no such function, so register a
        # Python equivalent on every new connection before any DDL/DML runs.
        @event.listens_for(self.engine, "connect")
        def _register_uuid(dbapi_conn, _record):
            dbapi_conn.create_function(
                "gen_random_uuid", 0, lambda: str(uuid.uuid4())
            )

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.user_id = "user-1"
        self.db.add(models.User(id=self.user_id, username="tester", hashed_password="x"))
        self.db.commit()

        self._orig_threshold = settings.rfp_recalibrate_threshold
        self._opp_seq = 0
        self._wl_seq = 0

    def tearDown(self):
        settings.rfp_recalibrate_threshold = self._orig_threshold
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────
    def _make_opp(self, breakdown):
        """Create a (non-'complete') opportunity carrying a score breakdown.

        Status is intentionally not 'complete' so the post-recalibration
        re-score loop is a no-op — keeping these tests focused on the trigger
        logic rather than the scoring engine.
        """
        self._opp_seq += 1
        oid = f"opp-{self._opp_seq}"
        opp = models.RfpOpportunity(
            id=oid,
            user_id=self.user_id,
            source="upload",
            status="pending",
            score_breakdown=json.dumps(breakdown),
        )
        self.db.add(opp)
        self.db.commit()
        return opp

    def _add_outcome(self, opp_id, outcome):
        """Insert a RfpWinLoss row directly (bypasses the API path)."""
        self._wl_seq += 1
        wl = models.RfpWinLoss(
            id=f"wl-{self._wl_seq}",
            opportunity_id=opp_id,
            user_id=self.user_id,
            outcome=outcome,
        )
        self.db.add(wl)
        self.db.commit()
        return wl

    def _seed_decided(self, n_won, n_lost, predictive=True):
        """Create n_won + n_lost decided outcomes, each linked to its own opp."""
        win_bd = _WIN_BREAKDOWN if predictive else _FLAT_BREAKDOWN
        loss_bd = _LOSS_BREAKDOWN if predictive else _FLAT_BREAKDOWN
        for _ in range(n_won):
            opp = self._make_opp(win_bd)
            self._add_outcome(opp.id, "won")
        for _ in range(n_lost):
            opp = self._make_opp(loss_bd)
            self._add_outcome(opp.id, "lost")

    def _seed_decided_bd(self, win_bd, loss_bd, n_won, n_lost):
        """Like _seed_decided but with explicit win/loss factor breakdowns."""
        for _ in range(n_won):
            opp = self._make_opp(win_bd)
            self._add_outcome(opp.id, "won")
        for _ in range(n_lost):
            opp = self._make_opp(loss_bd)
            self._add_outcome(opp.id, "lost")

    def _auto_rows(self):
        return (
            self.db.query(models.RfpScoringWeights)
            .filter_by(user_id=self.user_id, trigger="auto_threshold")
            .all()
        )

    # ── tests ────────────────────────────────────────────────────────────────
    def test_crossing_threshold_creates_exactly_one_auto_row(self):
        settings.rfp_recalibrate_threshold = 5
        # 3 wins + 2 losses = 5 decided, a clear revenue_potential gap.
        self._seed_decided(n_won=3, n_lost=2, predictive=True)

        rfp._maybe_auto_recalibrate(self.user_id, self.db)

        rows = self._auto_rows()
        self.assertEqual(len(rows), 1, "exactly one auto_threshold row expected")
        self.assertEqual(rows[0].outcome_count, 5)
        self.assertEqual(rows[0].trigger, "auto_threshold")
        # The persisted weights are valid JSON and renormalized to ~1.0.
        weights = json.loads(rows[0].weights)
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=2)

    def test_below_threshold_does_not_fire(self):
        settings.rfp_recalibrate_threshold = 5
        # 4 decided outcomes — one short of the threshold boundary.
        self._seed_decided(n_won=2, n_lost=2, predictive=True)

        rfp._maybe_auto_recalibrate(self.user_id, self.db)

        self.assertEqual(len(self._auto_rows()), 0)

    def test_idempotent_at_same_count(self):
        settings.rfp_recalibrate_threshold = 5
        self._seed_decided(n_won=3, n_lost=2, predictive=True)

        rfp._maybe_auto_recalibrate(self.user_id, self.db)
        # Re-invoking at the same decided count must not write a second row.
        rfp._maybe_auto_recalibrate(self.user_id, self.db)
        rfp._maybe_auto_recalibrate(self.user_id, self.db)

        self.assertEqual(len(self._auto_rows()), 1)

    def test_reediting_existing_outcome_does_not_refire(self):
        """An upsert that keeps the decided count constant must not re-fire."""
        settings.rfp_recalibrate_threshold = 5
        # Seed 4 decided outcomes, then add the 5th via the API path so the
        # threshold is crossed inside record_outcome itself.
        self._seed_decided(n_won=2, n_lost=2, predictive=True)
        fifth = self._make_opp(_WIN_BREAKDOWN)

        user = self.db.get(models.User, self.user_id)

        rfp.record_outcome(
            fifth.id, rfp.OutcomeRequest(outcome="won"), self.db, user
        )
        self.assertEqual(len(self._auto_rows()), 1, "threshold crossing fires once")

        # Edit the SAME outcome (still decided, count stays 5) — no refire.
        rfp.record_outcome(
            fifth.id,
            rfp.OutcomeRequest(outcome="won", notes="updated debrief"),
            self.db,
            user,
        )
        rfp.record_outcome(
            fifth.id,
            rfp.OutcomeRequest(outcome="lost", notes="changed my mind"),
            self.db,
            user,
        )
        self.assertEqual(len(self._auto_rows()), 1, "re-edit must not refire")

    def test_insufficient_data_noops_silently(self):
        """Hitting a threshold boundary with <5 decided outcomes is swallowed."""
        settings.rfp_recalibrate_threshold = 2
        # 2 decided outcomes: on the boundary (2 % 2 == 0) but below the
        # 5-outcome minimum inside _recalibrate_weights.
        self._seed_decided(n_won=1, n_lost=1, predictive=True)

        # Must not raise.
        rfp._maybe_auto_recalibrate(self.user_id, self.db)

        self.assertEqual(len(self._auto_rows()), 0)

    def test_no_pattern_noops_silently(self):
        """Enough data but no detectable factor gap → no row, no exception."""
        settings.rfp_recalibrate_threshold = 5
        # 5 decided outcomes but identical breakdowns → zero adjustments.
        self._seed_decided(n_won=3, n_lost=2, predictive=False)

        rfp._maybe_auto_recalibrate(self.user_id, self.db)

        self.assertEqual(len(self._auto_rows()), 0)

    def test_record_outcome_no_pattern_returns_without_500(self):
        """record_outcome must return normally even when auto-recal no-ops."""
        settings.rfp_recalibrate_threshold = 5
        self._seed_decided(n_won=2, n_lost=2, predictive=False)
        fifth = self._make_opp(_FLAT_BREAKDOWN)
        user = self.db.get(models.User, self.user_id)

        result = rfp.record_outcome(
            fifth.id, rfp.OutcomeRequest(outcome="won"), self.db, user
        )

        self.assertEqual(result["outcome"], "won")
        self.assertEqual(len(self._auto_rows()), 0)

    def test_threshold_zero_disables_auto_recalibration(self):
        settings.rfp_recalibrate_threshold = 0
        self._seed_decided(n_won=3, n_lost=2, predictive=True)

        rfp._maybe_auto_recalibrate(self.user_id, self.db)

        self.assertEqual(len(self._auto_rows()), 0)


class ManualRecalibrationTests(unittest.TestCase):
    """Lock in the manual `POST /scoring/recalibrate` endpoint contract.

    The manual path differs from the automatic trigger in two ways:
      * A soft failure (insufficient data / no pattern) must surface as a clean
        HTTP 400 (RecalibrationSkipped → HTTPException), never an unhandled 500.
      * A success must persist a NON-auto weights row (trigger `manual_*`) and
        return the previous/new weights plus per-factor adjustments.
    Both share the post-recalibration re-score loop, which only touches
    opportunities whose status == 'complete'.
    """

    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _register_uuid(dbapi_conn, _record):
            dbapi_conn.create_function(
                "gen_random_uuid", 0, lambda: str(uuid.uuid4())
            )

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.user_id = "user-1"
        self.db.add(models.User(id=self.user_id, username="tester", hashed_password="x"))
        self.db.commit()
        self.user = self.db.get(models.User, self.user_id)

        self._opp_seq = 0
        self._wl_seq = 0

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────
    def _make_opp(self, breakdown=None, status="pending", **fields):
        self._opp_seq += 1
        oid = f"opp-{self._opp_seq}"
        opp = models.RfpOpportunity(
            id=oid,
            user_id=self.user_id,
            source="upload",
            status=status,
            score_breakdown=json.dumps(breakdown) if breakdown is not None else None,
            **fields,
        )
        self.db.add(opp)
        self.db.commit()
        return opp

    def _add_outcome(self, opp_id, outcome):
        self._wl_seq += 1
        wl = models.RfpWinLoss(
            id=f"wl-{self._wl_seq}",
            opportunity_id=opp_id,
            user_id=self.user_id,
            outcome=outcome,
        )
        self.db.add(wl)
        self.db.commit()
        return wl

    def _seed_decided(self, n_won, n_lost, predictive=True):
        win_bd = _WIN_BREAKDOWN if predictive else _FLAT_BREAKDOWN
        loss_bd = _LOSS_BREAKDOWN if predictive else _FLAT_BREAKDOWN
        for _ in range(n_won):
            opp = self._make_opp(win_bd)
            self._add_outcome(opp.id, "won")
        for _ in range(n_lost):
            opp = self._make_opp(loss_bd)
            self._add_outcome(opp.id, "lost")

    def _weights_rows(self):
        return self.db.query(models.RfpScoringWeights).filter_by(
            user_id=self.user_id
        ).all()

    # ── 400 (not 500) on soft failures ─────────────────────────────────────────
    def test_recalibrate_400_when_fewer_than_five_decided(self):
        """Under the 5-outcome minimum → HTTP 400, no weights row, no 500."""
        self._seed_decided(n_won=2, n_lost=2, predictive=True)  # only 4 decided

        with self.assertRaises(rfp.HTTPException) as ctx:
            rfp.recalibrate_weights(self.db, self.user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("5 decided outcomes", ctx.exception.detail)
        self.assertEqual(len(self._weights_rows()), 0)

    def test_recalibrate_400_when_no_detectable_pattern(self):
        """Enough data but flat breakdowns → no adjustments → HTTP 400, no row."""
        self._seed_decided(n_won=3, n_lost=2, predictive=False)  # 5 flat outcomes

        with self.assertRaises(rfp.HTTPException) as ctx:
            rfp.recalibrate_weights(self.db, self.user)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("No statistically significant", ctx.exception.detail)
        self.assertEqual(len(self._weights_rows()), 0)

    # ── successful manual recalibration ─────────────────────────────────────────
    def test_successful_recalibration_writes_manual_row_and_reports_weights(self):
        self._seed_decided(n_won=3, n_lost=2, predictive=True)  # 5 predictive

        result = rfp.recalibrate_weights(self.db, self.user)

        # The persisted row is a manual (non-auto) trigger.
        rows = self._weights_rows()
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row.trigger, "manual_5_outcomes")
        self.assertNotEqual(row.trigger, "auto_threshold")
        self.assertFalse(row.trigger.startswith("auto"))
        self.assertEqual(row.outcome_count, 5)

        # The response reports previous + new weights and the adjustments made.
        self.assertEqual(result["trigger"], "manual_5_outcomes")
        self.assertEqual(result["outcome_count"], 5)
        self.assertIn("previous_weights", result)
        self.assertIn("new_weights", result)
        self.assertTrue(result["adjustments"], "expected at least one adjustment")
        # revenue_potential is the predictive factor in the fixtures → it moved.
        self.assertIn("revenue_potential", result["adjustments"])
        self.assertNotEqual(
            result["previous_weights"], result["new_weights"],
            "new weights must differ from the previous set",
        )
        # New weights are renormalized to ~1.0 and match the persisted row.
        self.assertAlmostEqual(sum(result["new_weights"].values()), 1.0, places=2)
        self.assertEqual(json.loads(row.weights), result["new_weights"])

    # ── post-recalibration re-score loop ────────────────────────────────────────
    def test_recalibration_rescores_only_complete_opportunities(self):
        # 5 predictive decided outcomes (their opps default to 'pending').
        self._seed_decided(n_won=3, n_lost=2, predictive=True)

        # Two 'complete' opps should be re-scored; the non-complete ones not.
        complete_a = self._make_opp(status="complete", estimated_contract_value=3_000_000)
        complete_b = self._make_opp(status="complete", covered_lives=1500)
        pending = self._make_opp(status="pending", estimated_contract_value=3_000_000)
        parsing = self._make_opp(status="parsing", covered_lives=1500)

        result = rfp.recalibrate_weights(self.db, self.user)

        self.assertEqual(result["rescored_opportunities"], 2)

        # The complete opps now carry a fresh score + scored_at timestamp.
        for oid in (complete_a.id, complete_b.id):
            opp = self.db.get(models.RfpOpportunity, oid)
            self.assertIsNotNone(opp.opportunity_score)
            self.assertIsNotNone(opp.scored_at)
            self.assertIsNotNone(opp.score_tier)

        # The non-complete opps were left untouched (never scored).
        for oid in (pending.id, parsing.id):
            opp = self.db.get(models.RfpOpportunity, oid)
            self.assertIsNone(opp.opportunity_score)
            self.assertIsNone(opp.scored_at)

    def test_rescore_count_zero_when_no_complete_opportunities(self):
        """A valid recalibration with no 'complete' opps re-scores nothing."""
        self._seed_decided(n_won=3, n_lost=2, predictive=True)

        result = rfp.recalibrate_weights(self.db, self.user)

        self.assertTrue(result["adjustments"])
        self.assertEqual(result["rescored_opportunities"], 0)

    # ── new weights actually change opportunity scores (end-to-end) ──────────────
    def _seed_multifactor_decided(self):
        """Seed 5 decided outcomes whose breakdowns move three weights at once.

        Drives recalibration to *increase* revenue_potential + strategic_value
        and *decrease* competitive_intensity — verified by the asserted
        adjustments below. This is what makes the re-score loop produce a
        genuinely re-weighted (not uniformly offset) composite.
        """
        for _ in range(3):
            opp = self._make_opp(_MULTI_WIN_BREAKDOWN)
            self._add_outcome(opp.id, "won")
        for _ in range(2):
            opp = self._make_opp(_MULTI_LOSS_BREAKDOWN)
            self._add_outcome(opp.id, "lost")

    def test_recalibration_changes_score_in_expected_direction(self):
        """New weights must actually move a 'complete' opp's score, and the
        direction must follow the re-weighting — not be a uniform offset.

        After recalibration revenue_potential & strategic_value are up-weighted
        and competitive_intensity is down-weighted. So:
          * an opp scoring HIGH on revenue/strategic, LOW on competition → score UP
          * an opp scoring LOW on revenue/strategic, HIGH on competition → score DOWN
        Opposite movement on the same recalibration is the proof the weights are
        genuinely re-applied per factor.
        """
        from backend.routers.rfp_intake import (
            compute_opportunity_score,
            SCORE_WEIGHTS,
        )

        self._seed_multifactor_decided()

        # HIGH on the up-weighted factors, lower on the down-weighted one.
        up_opp = self._make_opp(
            status="complete",
            estimated_contract_value=5_000_000,   # revenue_potential = 95
            industry="healthcare",                # strategic_value bonuses
            plan_type="self-funded",
            covered_lives=600,
            pbm_structure="carve-out",
        )
        # LOW on the up-weighted factors, HIGH competitive_intensity.
        down_opp = self._make_opp(
            status="complete",
            covered_lives=100,                    # revenue_potential = 38
            industry="retail",                    # no strategic bonus
            plan_type="fully-insured",
        )

        up_before = compute_opportunity_score(
            up_opp, weights=dict(SCORE_WEIGHTS)
        )["opportunity_score"]
        down_before = compute_opportunity_score(
            down_opp, weights=dict(SCORE_WEIGHTS)
        )["opportunity_score"]

        result = rfp.recalibrate_weights(self.db, self.user)

        # The recalibration moved the three expected factors in the expected way.
        self.assertEqual(result["rescored_opportunities"], 2)
        self.assertGreater(result["adjustments"]["revenue_potential"], 0)
        self.assertGreater(result["adjustments"]["strategic_value"], 0)
        self.assertLess(result["adjustments"]["competitive_intensity"], 0)

        up_after = self.db.get(models.RfpOpportunity, up_opp.id).opportunity_score
        down_after = self.db.get(models.RfpOpportunity, down_opp.id).opportunity_score

        # Both scores actually changed — no silent no-op.
        self.assertNotEqual(up_after, up_before)
        self.assertNotEqual(down_after, down_before)
        # …and in opposite directions, proving real per-factor re-weighting.
        self.assertGreater(up_after, up_before)
        self.assertLess(down_after, down_before)

    def test_persisted_score_matches_recompute_with_new_weights(self):
        """The score written by the re-score loop must equal what
        compute_opportunity_score returns for the *new* weights — never a stale
        value carried over from the default-weight scoring.
        """
        from backend.routers.rfp_intake import (
            compute_opportunity_score,
            SCORE_WEIGHTS,
        )

        self._seed_multifactor_decided()

        opp = self._make_opp(
            status="complete",
            estimated_contract_value=5_000_000,
            industry="healthcare",
            plan_type="self-funded",
            covered_lives=600,
            pbm_structure="carve-out",
        )
        score_under_default = compute_opportunity_score(
            opp, weights=dict(SCORE_WEIGHTS)
        )["opportunity_score"]

        result = rfp.recalibrate_weights(self.db, self.user)
        new_weights = result["new_weights"]

        expected = compute_opportunity_score(opp, weights=new_weights)
        persisted = self.db.get(models.RfpOpportunity, opp.id)

        # The persisted score/tier/breakdown reflect the NEW weights exactly.
        self.assertEqual(persisted.opportunity_score, expected["opportunity_score"])
        self.assertEqual(persisted.score_tier, expected["score_tier"])
        self.assertEqual(persisted.score_breakdown, expected["score_breakdown"])
        # And it is not the stale default-weighted value.
        self.assertNotEqual(persisted.opportunity_score, score_under_default)


class RecordOutcomeApiTests(AutoRecalibrationTests):
    """End-to-end coverage of the `record_outcome` API path itself.

    The base AutoRecalibrationTests only assert on the auto-recalibration
    trigger side effect. These lock in the *outcome upsert* contract:
      * Creating a brand-new RfpWinLoss row + the serialized response shape.
      * Editing an existing row in place (upsert — one row, fields mutated,
        opportunity re-staged).
      * The post-recalibration re-score loop that fires through the *auto*
        path (record_outcome → _maybe_auto_recalibrate) touches only
        'complete' opportunities.
    Inherits the in-memory SQLite fixture + helpers from AutoRecalibrationTests.
    """

    # Keys the frontend relies on in the serialized win/loss response.
    _EXPECTED_KEYS = {
        "id", "opportunity_id", "outcome", "decision_date", "contract_value",
        "winning_competitor", "pricing_factor", "relationship_factor",
        "product_gaps", "procurement_observations", "lessons_learned",
        "loss_reason", "notes", "monitoring_enrolled",
        "realized_revenue", "pursuit_hours", "pursuit_cost_usd",
        "hourly_rate_usd", "created_at",
        "employer_name", "industry", "participants", "estimated_value",
        "opportunity_score", "score_tier", "opp_created_at", "owner",
    }

    def _make_complete_opp(self, **fields):
        """Create a 'complete' opportunity eligible for the re-score loop."""
        self._opp_seq += 1
        oid = f"opp-{self._opp_seq}"
        opp = models.RfpOpportunity(
            id=oid,
            user_id=self.user_id,
            source="upload",
            status="complete",
            **fields,
        )
        self.db.add(opp)
        self.db.commit()
        return opp

    # ── create path ─────────────────────────────────────────────────────────────
    def test_record_outcome_creates_row_and_returns_serialized_shape(self):
        opp = self._make_opp(_WIN_BREAKDOWN)
        user = self.db.get(models.User, self.user_id)

        result = rfp.record_outcome(
            opp.id,
            rfp.OutcomeRequest(
                outcome="won",
                contract_value=1_250_000,
                notes="closed at full ask",
            ),
            self.db,
            user,
        )

        # Response shape: exact key set + echoed field values.
        self.assertEqual(set(result.keys()), self._EXPECTED_KEYS)
        self.assertEqual(result["opportunity_id"], opp.id)
        self.assertEqual(result["outcome"], "won")
        self.assertEqual(result["contract_value"], 1_250_000)
        self.assertEqual(result["notes"], "closed at full ask")
        self.assertEqual(result["product_gaps"], [])  # absent → [] not None
        self.assertIsNotNone(result["id"])
        self.assertIsNotNone(result["created_at"])

        # Persisted state: exactly one row, mirroring the response.
        rows = self.db.query(models.RfpWinLoss).filter_by(opportunity_id=opp.id).all()
        self.assertEqual(len(rows), 1)
        wl = rows[0]
        self.assertEqual(wl.id, result["id"])
        self.assertEqual(wl.outcome, "won")
        self.assertEqual(wl.contract_value, 1_250_000)
        self.assertEqual(wl.notes, "closed at full ask")
        self.assertEqual(wl.user_id, self.user_id)

        # The opportunity is re-staged to match the outcome.
        self.db.refresh(opp)
        self.assertEqual(opp.stage, "won")

    def test_record_outcome_404_for_unknown_opportunity(self):
        user = self.db.get(models.User, self.user_id)
        with self.assertRaises(rfp.HTTPException) as ctx:
            rfp.record_outcome(
                "does-not-exist", rfp.OutcomeRequest(outcome="won"), self.db, user
            )
        self.assertEqual(ctx.exception.status_code, 404)

    def test_record_outcome_rejects_invalid_outcome(self):
        opp = self._make_opp(_WIN_BREAKDOWN)
        user = self.db.get(models.User, self.user_id)
        with self.assertRaises(rfp.HTTPException) as ctx:
            rfp.record_outcome(
                opp.id, rfp.OutcomeRequest(outcome="maybe"), self.db, user
            )
        self.assertEqual(ctx.exception.status_code, 400)

    # ── edit path (upsert in place) ──────────────────────────────────────────────
    def test_record_outcome_edits_existing_row_in_place(self):
        # Disable auto-recal so this test stays focused on the upsert.
        settings.rfp_recalibrate_threshold = 0
        opp = self._make_opp(_WIN_BREAKDOWN)
        user = self.db.get(models.User, self.user_id)

        created = rfp.record_outcome(
            opp.id,
            rfp.OutcomeRequest(outcome="won", contract_value=900_000),
            self.db,
            user,
        )
        original_id = created["id"]

        # Edit: flip the outcome to a loss + attach a structured debrief.
        edited = rfp.record_outcome(
            opp.id,
            rfp.OutcomeRequest(
                outcome="lost",
                winning_competitor="Acme Benefits",
                pricing_factor=True,
                product_gaps=["no telehealth", "weak Rx network"],
                lessons_learned="undercut on admin fee",
                notes="debrief updated",
            ),
            self.db,
            user,
        )

        # Same row reused — never a second insert.
        self.assertEqual(edited["id"], original_id)
        rows = self.db.query(models.RfpWinLoss).filter_by(opportunity_id=opp.id).all()
        self.assertEqual(len(rows), 1)

        # Edited fields are reflected in both the response and the persisted row.
        self.assertEqual(edited["outcome"], "lost")
        self.assertEqual(edited["winning_competitor"], "Acme Benefits")
        self.assertEqual(edited["pricing_factor"], True)
        self.assertEqual(edited["product_gaps"], ["no telehealth", "weak Rx network"])
        self.assertEqual(edited["lessons_learned"], "undercut on admin fee")
        self.assertEqual(edited["notes"], "debrief updated")
        # contract_value from the create call survives (exclude_none upsert).
        self.assertEqual(edited["contract_value"], 900_000)

        wl = rows[0]
        self.assertEqual(wl.outcome, "lost")
        self.assertEqual(wl.winning_competitor, "Acme Benefits")
        self.assertEqual(json.loads(wl.product_gaps), ["no telehealth", "weak Rx network"])
        self.assertEqual(wl.contract_value, 900_000)

        # The opportunity is re-staged to the new outcome.
        self.db.refresh(opp)
        self.assertEqual(opp.stage, "lost")

    # ── auto-path re-score of 'complete' opportunities ───────────────────────────
    def test_record_outcome_auto_recalibration_rescores_complete_opps(self):
        settings.rfp_recalibrate_threshold = 5
        # Seed 4 predictive decided outcomes — one short of the threshold.
        self._seed_decided(n_won=2, n_lost=2, predictive=True)

        # 'complete' opps must be re-scored by the auto path; non-complete not.
        complete_a = self._make_complete_opp(estimated_contract_value=3_000_000)
        complete_b = self._make_complete_opp(covered_lives=1500)
        pending = self._make_opp(_WIN_BREAKDOWN)  # status='pending'

        # The 5th decided outcome crosses the threshold inside record_outcome,
        # firing the auto recalibration + re-score loop.
        fifth = self._make_opp(_WIN_BREAKDOWN)
        user = self.db.get(models.User, self.user_id)
        rfp.record_outcome(
            fifth.id, rfp.OutcomeRequest(outcome="won"), self.db, user
        )

        # Exactly one auto recalibration row was written.
        self.assertEqual(len(self._auto_rows()), 1)

        # The 'complete' opps now carry a fresh score + tier + timestamp.
        for oid in (complete_a.id, complete_b.id):
            opp = self.db.get(models.RfpOpportunity, oid)
            self.assertIsNotNone(opp.opportunity_score)
            self.assertIsNotNone(opp.score_tier)
            self.assertIsNotNone(opp.scored_at)

        # Non-complete opps are untouched by the re-score loop.
        for oid in (pending.id, fifth.id):
            opp = self.db.get(models.RfpOpportunity, oid)
            self.assertIsNone(opp.opportunity_score)
            self.assertIsNone(opp.scored_at)


class RecalibrationMathTests(AutoRecalibrationTests):
    """Lock in the *magnitude and direction* of the weight adjustments.

    Inherits the in-memory SQLite fixture + helpers from AutoRecalibrationTests
    but exercises `_recalibrate_weights` directly so we can assert on the
    returned `new_weights` / `adjustments` / `summary` rather than just the
    presence of a persisted row.
    """

    def test_large_positive_gap_increases_that_factors_weight(self):
        # revenue_potential: won avg 80 vs lost avg 40 → +40pt gap (>= 15).
        self._seed_decided(n_won=3, n_lost=2, predictive=True)
        default = rfp._DEFAULT_WEIGHTS["revenue_potential"]

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # The raw delta applied before renormalization is the strong +0.03 nudge.
        self.assertGreater(result["adjustments"]["revenue_potential"], 0)
        self.assertAlmostEqual(
            result["adjustments"]["revenue_potential"], 0.03, places=4
        )
        # Even after renormalization the factor ends up weighing more than it
        # did by default — it did not get diluted away.
        self.assertGreater(result["new_weights"]["revenue_potential"], default)

    def test_strong_loss_driver_decreases_its_weight(self):
        # competitive_intensity scores LOW on wins, HIGH on losses → negative gap.
        self._seed_decided_bd(
            _MULTI_WIN_BREAKDOWN, _MULTI_LOSS_BREAKDOWN, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        self.assertLess(result["adjustments"]["competitive_intensity"], 0)
        self.assertAlmostEqual(
            result["adjustments"]["competitive_intensity"], -0.015, places=4
        )

    def test_near_zero_gap_leaves_that_factor_unchanged(self):
        # relationship_strength is identical (60) on wins and losses → 0pt gap.
        self._seed_decided_bd(
            _MULTI_WIN_BREAKDOWN, _MULTI_LOSS_BREAKDOWN, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # No raw adjustment is recorded for the undifferentiated factor.
        self.assertNotIn("relationship_strength", result["adjustments"])
        # And the factors that *did* differentiate are recorded.
        self.assertIn("revenue_potential", result["adjustments"])
        self.assertIn("strategic_value", result["adjustments"])

    def test_no_pattern_raises_recalibration_skipped(self):
        # Enough data, but every factor is flat → nothing differentiates.
        self._seed_decided(n_won=3, n_lost=2, predictive=False)

        with self.assertRaises(rfp.RecalibrationSkipped):
            rfp._recalibrate_weights(self.user_id, self.db)

    def test_weights_sum_to_one_after_renormalization(self):
        self._seed_decided_bd(
            _MULTI_WIN_BREAKDOWN, _MULTI_LOSS_BREAKDOWN, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        self.assertAlmostEqual(sum(result["new_weights"].values()), 1.0, places=2)

    def test_every_weight_stays_within_band(self):
        self._seed_decided_bd(
            _MULTI_WIN_BREAKDOWN, _MULTI_LOSS_BREAKDOWN, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        for factor, w in result["new_weights"].items():
            self.assertGreaterEqual(w, 0.02, f"{factor} below floor")
            self.assertLessEqual(w, 0.45, f"{factor} above ceiling")

    def test_summary_records_the_factors_that_moved(self):
        self._seed_decided_bd(
            _MULTI_WIN_BREAKDOWN, _MULTI_LOSS_BREAKDOWN, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)
        summary = result["summary"]

        # Outcome accounting is reported up front.
        self.assertIn("5 outcomes", summary)
        self.assertIn("3 wins", summary)
        self.assertIn("2 losses", summary)
        # Each moved factor is named in the human-readable narrative…
        for factor in result["adjustments"]:
            self.assertIn(factor, summary)
        # …and the unchanged factor is not mentioned.
        self.assertNotIn("relationship_strength", summary)

    def test_summary_distinguishes_strong_from_moderate_gaps(self):
        # revenue_potential: 80 vs 68 → +12pt gap → "moderate" band (>=8, <15).
        self._seed_decided_bd(
            {"revenue_potential": 80}, {"revenue_potential": 68}, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # Moderate gap gets the smaller +0.015 nudge and the "moderate" wording.
        self.assertAlmostEqual(
            result["adjustments"]["revenue_potential"], 0.015, places=4
        )
        self.assertIn("moderate", result["summary"])

    # ── significance-threshold boundary cells ──────────────────────────────────
    # The math has two cutoffs: a gap must reach 8pt to move a weight at all
    # (the "moderate" band), and reach 15pt to earn the larger "strong" nudge.
    # These tests pin both edges with a co-mover (revenue_potential) present so
    # the recalibration always succeeds — letting us assert on the *boundary*
    # factor in isolation rather than triggering RecalibrationSkipped.

    def test_gap_just_below_moderate_threshold_is_ignored(self):
        # strategic_value: won 67 vs lost 60 → +7pt gap → below the 8pt floor.
        # revenue_potential carries the recalibration so it does not skip.
        self._seed_decided_bd(
            {"revenue_potential": 85, "strategic_value": 67},
            {"revenue_potential": 40, "strategic_value": 60},
            n_won=3, n_lost=2,
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # A 7pt gap is sub-threshold → strategic_value earns no raw adjustment.
        self.assertNotIn("strategic_value", result["adjustments"])
        # Its weight only changes by the shared renormalization factor (every
        # weight is divided by the same post-adjustment total), never by a nudge
        # of its own. Recover that factor from a moved sibling and confirm
        # strategic_value tracks it exactly.
        renorm = (
            result["new_weights"]["revenue_potential"]
            / round(
                rfp._DEFAULT_WEIGHTS["revenue_potential"]
                + result["adjustments"]["revenue_potential"],
                4,
            )
        )
        self.assertAlmostEqual(
            result["new_weights"]["strategic_value"],
            rfp._DEFAULT_WEIGHTS["strategic_value"] * renorm,
            places=3,
        )
        # The strong co-mover did move, proving the run was not a global no-op.
        self.assertIn("revenue_potential", result["adjustments"])

    def test_gap_at_moderate_threshold_triggers_small_adjustment(self):
        # strategic_value: won 68 vs lost 60 → exactly +8pt → moderate +0.015.
        self._seed_decided_bd(
            {"revenue_potential": 85, "strategic_value": 68},
            {"revenue_potential": 40, "strategic_value": 60},
            n_won=3, n_lost=2,
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # Just-at the 8pt floor → the smaller "moderate" nudge fires.
        self.assertIn("strategic_value", result["adjustments"])
        self.assertAlmostEqual(
            result["adjustments"]["strategic_value"], 0.015, places=4
        )

    def test_gap_just_below_strong_threshold_uses_moderate_nudge(self):
        # revenue_potential: won 74 vs lost 60 → +14pt → still moderate (<15).
        self._seed_decided_bd(
            {"revenue_potential": 74}, {"revenue_potential": 60}, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # One pt short of the strong cutoff → it keeps the +0.015 moderate nudge.
        self.assertAlmostEqual(
            result["adjustments"]["revenue_potential"], 0.015, places=4
        )
        self.assertIn("moderate", result["summary"])

    def test_gap_at_strong_threshold_uses_strong_nudge(self):
        # revenue_potential: won 75 vs lost 60 → exactly +15pt → strong +0.03.
        self._seed_decided_bd(
            {"revenue_potential": 75}, {"revenue_potential": 60}, n_won=3, n_lost=2
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        # Crossing the 15pt cutoff flips it to the larger +0.03 strong nudge.
        self.assertAlmostEqual(
            result["adjustments"]["revenue_potential"], 0.03, places=4
        )
        self.assertNotIn("moderate", result["summary"])

    def test_strong_loss_gap_boundary_uses_asymmetric_negative_nudge(self):
        # A strong *negative* gap (loss driver) nudges down by 0.015, not 0.03 —
        # the down-weight is deliberately gentler than the up-weight. Pin the
        # 15pt boundary on the loss side: won 60 vs lost 75 → -15pt.
        self._seed_decided_bd(
            {"competitive_intensity": 60, "revenue_potential": 85},
            {"competitive_intensity": 75, "revenue_potential": 40},
            n_won=3, n_lost=2,
        )

        result = rfp._recalibrate_weights(self.user_id, self.db)

        self.assertAlmostEqual(
            result["adjustments"]["competitive_intensity"], -0.015, places=4
        )


class ResetWeightsTests(unittest.TestCase):
    """Lock in the manual `POST /scoring/weights/reset` endpoint contract.

    Resetting must:
      * persist a `manual_reset` RfpScoringWeights row whose weights equal the
        factory `_DEFAULT_WEIGHTS`,
      * record per-factor `adjustments` equal to default-minus-current, and
      * restore factory defaults even after an adaptive recalibration moved the
        active weights away from default.
    """

    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def _register_uuid(dbapi_conn, _record):
            dbapi_conn.create_function(
                "gen_random_uuid", 0, lambda: str(uuid.uuid4())
            )

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.user_id = "user-1"
        self.db.add(models.User(id=self.user_id, username="tester", hashed_password="x"))
        self.db.commit()
        self.user = self.db.get(models.User, self.user_id)

        self._opp_seq = 0
        self._wl_seq = 0

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    # ── helpers ────────────────────────────────────────────────────────────────
    def _make_opp(self, breakdown=None, status="pending", **fields):
        self._opp_seq += 1
        oid = f"opp-{self._opp_seq}"
        opp = models.RfpOpportunity(
            id=oid,
            user_id=self.user_id,
            source="upload",
            status=status,
            score_breakdown=json.dumps(breakdown) if breakdown is not None else None,
            **fields,
        )
        self.db.add(opp)
        self.db.commit()
        return opp

    def _add_outcome(self, opp_id, outcome):
        self._wl_seq += 1
        wl = models.RfpWinLoss(
            id=f"wl-{self._wl_seq}",
            opportunity_id=opp_id,
            user_id=self.user_id,
            outcome=outcome,
        )
        self.db.add(wl)
        self.db.commit()
        return wl

    def _seed_decided(self, n_won, n_lost, predictive=True):
        win_bd = _WIN_BREAKDOWN if predictive else _FLAT_BREAKDOWN
        loss_bd = _LOSS_BREAKDOWN if predictive else _FLAT_BREAKDOWN
        for _ in range(n_won):
            opp = self._make_opp(win_bd)
            self._add_outcome(opp.id, "won")
        for _ in range(n_lost):
            opp = self._make_opp(loss_bd)
            self._add_outcome(opp.id, "lost")

    def _reset_rows(self):
        return (
            self.db.query(models.RfpScoringWeights)
            .filter_by(user_id=self.user_id, trigger="manual_reset")
            .all()
        )

    # ── tests ────────────────────────────────────────────────────────────────
    def test_reset_from_default_writes_manual_reset_row(self):
        """With no prior weights, reset still logs a manual_reset row at default."""
        result = rfp.reset_weights(self.db, self.user)

        self.assertEqual(result["reset"], True)
        self.assertEqual(result["weights"], rfp._DEFAULT_WEIGHTS)

        rows = self._reset_rows()
        self.assertEqual(len(rows), 1, "exactly one manual_reset row expected")
        row = rows[0]
        self.assertEqual(row.trigger, "manual_reset")
        self.assertEqual(row.outcome_count, 0)
        # Persisted weights equal the factory defaults exactly.
        self.assertEqual(json.loads(row.weights), rfp._DEFAULT_WEIGHTS)
        # Resetting from default → every adjustment is zero.
        adjustments = json.loads(row.adjustments)
        self.assertEqual(set(adjustments), set(rfp._DEFAULT_WEIGHTS))
        for factor in rfp._DEFAULT_WEIGHTS:
            self.assertEqual(adjustments[factor], 0)

    def test_reset_adjustments_equal_default_minus_current(self):
        """After custom weights, adjustments == default-minus-current per factor."""
        # Seed an arbitrary non-default active weight set directly.
        custom = {
            "revenue_potential":         0.40,
            "strategic_value":           0.10,
            "win_probability":           0.10,
            "relationship_strength":     0.10,
            "competitive_intensity":     0.10,
            "data_availability":         0.10,
            "implementation_complexity": 0.10,
        }
        self.db.add(models.RfpScoringWeights(
            user_id=self.user_id,
            weights=json.dumps(custom),
            adjustments=json.dumps({}),
            trigger="manual_5_outcomes",
            outcome_count=5,
            summary="seed",
        ))
        self.db.commit()

        # Sanity: the active weights are the custom set, not the default.
        self.assertEqual(rfp._get_active_weights(self.user_id, self.db), custom)

        rfp.reset_weights(self.db, self.user)

        rows = self._reset_rows()
        self.assertEqual(len(rows), 1)
        adjustments = json.loads(rows[0].adjustments)
        for factor in rfp._DEFAULT_WEIGHTS:
            self.assertAlmostEqual(
                adjustments[factor],
                round(rfp._DEFAULT_WEIGHTS[factor] - custom[factor], 4),
                places=4,
            )

    def test_reset_after_recalibration_restores_factory_defaults(self):
        """A reset after an adaptive recalibration returns weights to default."""
        self._seed_decided(n_won=3, n_lost=2, predictive=True)
        recal = rfp.recalibrate_weights(self.db, self.user)
        # The recalibration moved the active weights off the factory defaults.
        self.assertNotEqual(recal["new_weights"], rfp._DEFAULT_WEIGHTS)
        self.assertNotEqual(
            rfp._get_active_weights(self.user_id, self.db), rfp._DEFAULT_WEIGHTS
        )

        result = rfp.reset_weights(self.db, self.user)

        # The endpoint returns the factory defaults regardless of prior state.
        self.assertEqual(result["weights"], rfp._DEFAULT_WEIGHTS)
        # Exactly one manual_reset row was written and it holds the defaults.
        rows = self._reset_rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(json.loads(rows[0].weights), rfp._DEFAULT_WEIGHTS)
        # The adjustments undo the recalibration: default-minus-recalibrated.
        adjustments = json.loads(rows[0].adjustments)
        for factor in rfp._DEFAULT_WEIGHTS:
            self.assertAlmostEqual(
                adjustments[factor],
                round(rfp._DEFAULT_WEIGHTS[factor] - recal["new_weights"][factor], 4),
                places=4,
            )


if __name__ == "__main__":
    unittest.main()
