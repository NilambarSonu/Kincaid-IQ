"""
Tests for the 7-factor RFP opportunity-scoring engine.

These lock in the factor math, weight application, tier boundaries, and
confidence gating of `compute_opportunity_score` and its `_score_*` helpers in
backend.routers.rfp_intake. A subtle change to a factor formula, a weight, a
tier threshold, or the data-availability gate shifts scores platform-wide; these
tests are the trip-wire.

The factor scorers read plain attributes off an RfpOpportunity, so most tests
use transient (un-persisted) model instances — no database required.

Run with:  python -m unittest backend.tests.test_rfp_scoring
"""

import json
import datetime
import unittest

from backend import models
from backend.routers import rfp_intake as rfp


def _opp(**fields):
    """A transient RfpOpportunity carrying only the fields under test.

    Unset Column attributes read back as None on a transient instance, which is
    exactly what the scorers treat as 'field not extracted'.
    """
    return models.RfpOpportunity(**fields)


def _date_in(days):
    """ISO date string `days` from today (negative = in the past)."""
    return (datetime.date.today() + datetime.timedelta(days=days)).isoformat()


class RevenuePotentialTests(unittest.TestCase):
    def test_contract_value_tiers(self):
        self.assertEqual(rfp._score_revenue_potential(_opp(estimated_contract_value=5_000_000))[0], 95)
        self.assertEqual(rfp._score_revenue_potential(_opp(estimated_contract_value=2_000_000))[0], 82)
        self.assertEqual(rfp._score_revenue_potential(_opp(estimated_contract_value=500_000))[0], 68)
        self.assertEqual(rfp._score_revenue_potential(_opp(estimated_contract_value=100_000))[0], 48)

    def test_falls_back_to_covered_lives_when_no_contract_value(self):
        self.assertEqual(rfp._score_revenue_potential(_opp(covered_lives=1000))[0], 75)
        self.assertEqual(rfp._score_revenue_potential(_opp(covered_lives=300))[0], 58)
        self.assertEqual(rfp._score_revenue_potential(_opp(covered_lives=50))[0], 38)

    def test_contract_value_takes_priority_over_lives(self):
        # A tiny ECV still routes through the ECV branch (48), not the lives one.
        score, _ = rfp._score_revenue_potential(_opp(estimated_contract_value=100_000, covered_lives=5000))
        self.assertEqual(score, 48)

    def test_no_data_is_lowest(self):
        self.assertEqual(rfp._score_revenue_potential(_opp())[0], 20)


class StrategicValueTests(unittest.TestCase):
    def test_baseline_with_no_signals(self):
        score, rationale = rfp._score_strategic_value(_opp())
        self.assertEqual(score, 50)
        self.assertIn("No strong strategic signals", rationale)

    def test_high_value_industry_adds_twenty(self):
        self.assertEqual(rfp._score_strategic_value(_opp(industry="Healthcare"))[0], 70)

    def test_signals_stack(self):
        # base 50 + industry 20 + complex plan 15 + 500+ lives 10 = 95
        score, _ = rfp._score_strategic_value(
            _opp(industry="Finance", plan_type="self-funded", covered_lives=500)
        )
        self.assertEqual(score, 95)

    def test_capped_at_98(self):
        # 50 + 20 + 15 + 10 + 5 = 100, clamped to 98
        score, _ = rfp._score_strategic_value(
            _opp(
                industry="Healthcare",
                plan_type="self-funded",
                covered_lives=900,
                pbm_structure="carve-out",
            )
        )
        self.assertEqual(score, 98)


class WinProbabilityTests(unittest.TestCase):
    def test_parse_confidence_bands(self):
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=80))[0], 70)
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=50))[0], 55)
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=10))[0], 40)

    def test_due_date_windows(self):
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=80, due_date=_date_in(45)))[0], 80)
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=80, due_date=_date_in(20)))[0], 73)
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=80, due_date=_date_in(3)))[0], 60)
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=80, due_date=_date_in(-5)))[0], 50)

    def test_unparseable_due_date_is_ignored(self):
        # Confidence-only path (70); a junk date contributes nothing, no raise.
        self.assertEqual(rfp._score_win_probability(_opp(parse_confidence=80, due_date="not-a-date"))[0], 70)


class RelationshipStrengthTests(unittest.TestCase):
    def test_no_incumbent_is_open_field(self):
        self.assertEqual(rfp._score_relationship_strength(_opp())[0], 60)

    def test_national_incumbent_is_hard_to_displace(self):
        self.assertEqual(rfp._score_relationship_strength(_opp(benefit_consulting_relationship="Mercer"))[0], 28)
        self.assertEqual(rfp._score_relationship_strength(_opp(benefit_consulting_relationship="Aon Hewitt"))[0], 28)

    def test_regional_incumbent_is_displaceable(self):
        self.assertEqual(
            rfp._score_relationship_strength(_opp(benefit_consulting_relationship="Smith Regional Advisors"))[0], 52
        )

    def test_too_short_to_classify_is_unknown(self):
        self.assertEqual(rfp._score_relationship_strength(_opp(benefit_consulting_relationship="AB"))[0], 60)


class CompetitiveIntensityTests(unittest.TestCase):
    def test_local_small_plan_is_favorable(self):
        # default 70 + single-state 5 + sub-200 lives 10 = 85
        self.assertEqual(
            rfp._score_competitive_intensity(_opp(states_covered=json.dumps(["IN"]), covered_lives=100))[0], 85
        )

    def test_wide_footprint_lowers_score(self):
        # 70 - 20 (>5 states) = 50
        self.assertEqual(
            rfp._score_competitive_intensity(_opp(states_covered=json.dumps(["A", "B", "C", "D", "E", "F"])))[0], 50
        )

    def test_enterprise_size_lowers_score(self):
        # single state +5 = 75, then 2000+ lives -15 = 60
        self.assertEqual(
            rfp._score_competitive_intensity(_opp(states_covered=json.dumps(["IN"]), covered_lives=2500))[0], 60
        )

    def test_malformed_states_treated_as_empty(self):
        # bad JSON → 0 states → single/local +5 = 75
        self.assertEqual(rfp._score_competitive_intensity(_opp(states_covered="{bad"))[0], 75)


class DataAvailabilityTests(unittest.TestCase):
    def _rich_fields(self):
        return dict(
            employer_name="Acme",
            industry="Healthcare",
            employer_size="500-1000",
            covered_lives=800,
            geographic_footprint="Midwest",
            pbm_structure="carve-out",
            benefit_consulting_relationship="Mercer",
            renewal_date="2026-01-01",
            due_date="2026-02-01",
            estimated_contract_value=2_000_000,
            plan_type="self-funded",
        )

    def test_all_key_fields_present_is_100(self):
        score, rationale = rfp._score_data_availability(_opp(**self._rich_fields()))
        self.assertEqual(score, 100)
        self.assertIn("high data quality", rationale)

    def test_no_fields_present_is_zero(self):
        score, rationale = rfp._score_data_availability(_opp())
        self.assertEqual(score, 0)
        self.assertIn("low data availability", rationale)

    def test_partial_fill_is_proportional(self):
        # 5 of 11 key fields → round(5/11*100) = 45
        score, _ = rfp._score_data_availability(
            _opp(employer_name="Acme", industry="Healthcare", covered_lives=800,
                 due_date="2026-02-01", plan_type="self-funded")
        )
        self.assertEqual(score, 45)

    def test_empty_string_and_empty_list_do_not_count(self):
        score, _ = rfp._score_data_availability(_opp(employer_name="", industry=""))
        self.assertEqual(score, 0)


class ImplementationComplexityTests(unittest.TestCase):
    def test_simple_plan_scores_high(self):
        self.assertEqual(rfp._score_implementation_complexity(_opp())[0], 95)

    def test_multistate_penalty(self):
        # >5 states → 95 - 25 = 70
        self.assertEqual(
            rfp._score_implementation_complexity(_opp(states_covered=json.dumps(["A", "B", "C", "D", "E", "F"])))[0], 70
        )

    def test_large_plan_penalty(self):
        # 2000+ lives → 95 - 20 = 75
        self.assertEqual(rfp._score_implementation_complexity(_opp(covered_lives=2500))[0], 75)

    def test_many_requirements_penalty(self):
        # >7 requirements → 95 - 10 = 85
        reqs = json.dumps([f"req-{i}" for i in range(8)])
        self.assertEqual(rfp._score_implementation_complexity(_opp(key_requirements=reqs))[0], 85)

    def test_penalties_stack_and_floor_at_10(self):
        # 25 (states) + 20 (lives) + 10 (reqs) = 55 penalty → 95 - 55 = 40
        reqs = json.dumps([f"req-{i}" for i in range(8)])
        score, _ = rfp._score_implementation_complexity(
            _opp(states_covered=json.dumps(["A", "B", "C", "D", "E", "F"]),
                 covered_lives=2500, key_requirements=reqs)
        )
        self.assertEqual(score, 40)


class CompositeAndWeightTests(unittest.TestCase):
    def test_default_composite_matches_weighted_sum(self):
        opp = _opp(estimated_contract_value=2_000_000, industry="Healthcare",
                   plan_type="self-funded", covered_lives=800, parse_confidence=80)
        result = rfp.compute_opportunity_score(opp)
        breakdown = json.loads(result["score_breakdown"])

        expected = round(sum(rfp.SCORE_WEIGHTS[k] * breakdown[k] for k in rfp.SCORE_WEIGHTS))
        self.assertEqual(result["opportunity_score"], expected)

    def test_adaptive_weights_change_the_composite(self):
        opp = _opp(estimated_contract_value=5_000_000, covered_lives=50)
        default = rfp.compute_opportunity_score(opp)

        # Skew all weight onto revenue_potential (which is high here).
        skewed = {k: 0.0 for k in rfp.SCORE_WEIGHTS}
        skewed["revenue_potential"] = 1.0
        adapted = rfp.compute_opportunity_score(opp, weights=skewed)

        breakdown = json.loads(adapted["score_breakdown"])
        self.assertEqual(adapted["opportunity_score"], breakdown["revenue_potential"])
        self.assertNotEqual(adapted["opportunity_score"], default["opportunity_score"])

    def test_missing_weight_key_falls_back_to_default(self):
        opp = _opp(estimated_contract_value=2_000_000, industry="Healthcare",
                   plan_type="self-funded", covered_lives=800, parse_confidence=80)
        # A weights dict missing several keys → those fall back to SCORE_WEIGHTS,
        # so providing only the defaults explicitly reproduces the default score.
        partial = {"revenue_potential": rfp.SCORE_WEIGHTS["revenue_potential"]}
        self.assertEqual(
            rfp.compute_opportunity_score(opp, weights=partial)["opportunity_score"],
            rfp.compute_opportunity_score(opp)["opportunity_score"],
        )

    def test_breakdown_and_factors_serialized_for_all_seven_factors(self):
        result = rfp.compute_opportunity_score(_opp())
        breakdown = json.loads(result["score_breakdown"])
        factors = json.loads(result["score_factors"])
        self.assertEqual(set(breakdown), set(rfp.SCORE_WEIGHTS))
        self.assertEqual(set(factors), set(rfp.SCORE_WEIGHTS))


class TierBoundaryTests(unittest.TestCase):
    """Drive the composite to an exact value by putting all weight on
    revenue_potential, whose score we control precisely via the ECV tiers."""

    def _score_with_revenue_only(self, **fields):
        weights = {k: 0.0 for k in rfp.SCORE_WEIGHTS}
        weights["revenue_potential"] = 1.0
        return rfp.compute_opportunity_score(_opp(**fields), weights=weights)

    def test_pursue_aggressively_at_or_above_78(self):
        # ECV 5M → revenue 95 ≥ 78
        self.assertEqual(self._score_with_revenue_only(estimated_contract_value=5_000_000)["score_tier"],
                         "pursue_aggressively")

    def test_pursue_selectively_band(self):
        # ECV 500k → revenue 68 (58–77)
        self.assertEqual(self._score_with_revenue_only(estimated_contract_value=500_000)["score_tier"],
                         "pursue_selectively")

    def test_monitor_band(self):
        # ECV 100k → revenue 48 (38–57)
        self.assertEqual(self._score_with_revenue_only(estimated_contract_value=100_000)["score_tier"],
                         "monitor")

    def test_decline_below_38(self):
        # No data → revenue 20 < 38
        self.assertEqual(self._score_with_revenue_only()["score_tier"], "decline")


class ConfidenceGatingTests(unittest.TestCase):
    def test_rich_opportunity_is_modeled(self):
        rich = _opp(
            employer_name="Acme", industry="Healthcare", employer_size="500-1000",
            covered_lives=800, geographic_footprint="Midwest", pbm_structure="carve-out",
            benefit_consulting_relationship="Mercer", renewal_date="2026-01-01",
            due_date="2026-02-01", estimated_contract_value=2_000_000, plan_type="self-funded",
        )
        self.assertEqual(rfp.compute_opportunity_score(rich)["score_confidence"], "MODELED")

    def test_sparse_opportunity_is_insufficient_evidence(self):
        self.assertEqual(rfp.compute_opportunity_score(_opp())["score_confidence"], "INSUFFICIENT_EVIDENCE")

    def test_gate_boundary_at_da_40(self):
        # 5/11 key fields → da 45 ≥ 40 → MODELED
        five = _opp(employer_name="Acme", industry="Healthcare", covered_lives=800,
                    due_date="2026-02-01", plan_type="self-funded")
        self.assertEqual(rfp.compute_opportunity_score(five)["score_confidence"], "MODELED")

        # 4/11 key fields → da 36 < 40 → INSUFFICIENT_EVIDENCE
        four = _opp(employer_name="Acme", industry="Healthcare", covered_lives=800,
                    plan_type="self-funded")
        self.assertEqual(rfp.compute_opportunity_score(four)["score_confidence"], "INSUFFICIENT_EVIDENCE")


if __name__ == "__main__":
    unittest.main()
