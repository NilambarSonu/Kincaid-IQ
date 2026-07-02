"""
Tests for RFP scoring config validation in backend.config.

These lock in `_validate_rfp_scoring` — the trip-wire that catches a typo'd
RFP_SCORING_CONFIG override before it silently produces wrong scores. A change
to the validated invariants (weights summing to ~1.0, strictly-descending tier
thresholds, structural parity with the defaults) should break these tests.

Run with:  python -m unittest backend.tests.test_rfp_scoring_config
"""

import copy
import os
import tempfile
import unittest

import backend.config as config
from backend.config import (
    RFP_SCORING_DEFAULTS,
    _validate_rfp_scoring,
    _deep_merge,
    _load_rfp_scoring,
)


def _merged(override: dict) -> dict:
    """Defaults deep-merged with `override`, mirroring _load_rfp_scoring."""
    cfg = copy.deepcopy(RFP_SCORING_DEFAULTS)
    _deep_merge(cfg, override)
    return cfg


class ValidConfigTests(unittest.TestCase):
    def test_defaults_are_valid(self):
        self.assertEqual(_validate_rfp_scoring(copy.deepcopy(RFP_SCORING_DEFAULTS)), [])

    def test_valid_partial_override_passes(self):
        cfg = _merged({"tier_thresholds": {"pursue_aggressively": 80}})
        self.assertEqual(_validate_rfp_scoring(cfg), [])

    def test_rebalanced_weights_pass(self):
        # Still sums to 1.0 after moving weight between two factors.
        cfg = _merged({"weights": {"revenue_potential": 0.27, "data_availability": 0.05}})
        self.assertEqual(_validate_rfp_scoring(cfg), [])


class WeightSumTests(unittest.TestCase):
    def test_weights_not_summing_to_one_flagged(self):
        cfg = _merged({"weights": {"revenue_potential": 0.50}})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("weights" in p and "sum" in p for p in problems))

    def test_within_tolerance_passes(self):
        # 0.22 -> 0.225 nudges the sum to 1.005, inside the ±0.01 tolerance.
        cfg = _merged({"weights": {"revenue_potential": 0.225}})
        self.assertEqual(_validate_rfp_scoring(cfg), [])

    def test_non_numeric_weight_flagged(self):
        cfg = _merged({"weights": {"revenue_potential": "high"}})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("weights.revenue_potential" in p and "numeric" in p for p in problems))


class TierThresholdTests(unittest.TestCase):
    def test_out_of_order_thresholds_flagged(self):
        # pursue_selectively (90) > pursue_aggressively (78) — inverted.
        cfg = _merged({"tier_thresholds": {"pursue_selectively": 90}})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("strictly descending" in p for p in problems))

    def test_equal_thresholds_flagged(self):
        cfg = _merged({"tier_thresholds": {"pursue_selectively": 78}})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("strictly descending" in p for p in problems))

    def test_non_numeric_threshold_flagged(self):
        cfg = _merged({"tier_thresholds": {"monitor": None}})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("tier_thresholds.monitor" in p for p in problems))


class StructuralParityTests(unittest.TestCase):
    def test_missing_band_key_flagged(self):
        cfg = _merged({})
        del cfg["revenue"]["ecv_top"]
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("missing key 'revenue.ecv_top'" in p for p in problems))

    def test_dict_clobbered_by_scalar_flagged(self):
        # A partial override that replaces a whole sub-object with a number.
        cfg = _merged({"weights": 0.5})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("'weights' must be an object" in p for p in problems))

    def test_list_clobbered_by_scalar_flagged(self):
        cfg = _merged({"high_value_industries": "healthcare"})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("high_value_industries' must be a list" in p for p in problems))

    def test_band_value_clobbered_by_string_flagged(self):
        cfg = _merged({"revenue": {"ecv_top": "5 million"}})
        problems = _validate_rfp_scoring(cfg)
        self.assertTrue(any("revenue.ecv_top" in p and "numeric" in p for p in problems))


class LoadFallbackTests(unittest.TestCase):
    def setUp(self):
        self._saved = {
            k: os.environ.get(k)
            for k in ("RFP_SCORING_CONFIG", "RFP_SCORING_CONFIG_FILE")
        }

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_invalid_override_falls_back_to_defaults(self):
        os.environ.pop("RFP_SCORING_CONFIG_FILE", None)
        os.environ["RFP_SCORING_CONFIG"] = '{"weights": {"revenue_potential": 0.99}}'
        cfg = _load_rfp_scoring()
        self.assertEqual(cfg, RFP_SCORING_DEFAULTS)

    def test_valid_override_is_applied(self):
        os.environ.pop("RFP_SCORING_CONFIG_FILE", None)
        os.environ["RFP_SCORING_CONFIG"] = '{"tier_thresholds": {"pursue_aggressively": 80}}'
        cfg = _load_rfp_scoring()
        self.assertEqual(cfg["tier_thresholds"]["pursue_aggressively"], 80)
        # Untouched keys keep their defaults.
        self.assertEqual(cfg["tier_thresholds"]["monitor"], RFP_SCORING_DEFAULTS["tier_thresholds"]["monitor"])


class SaveAndReloadTests(unittest.TestCase):
    """Locks in the admin-editor save path: validate-before-persist, live in-place
    reload (listeners + RFP_SCORING mutated, not rebound), persistence, and reset."""

    def setUp(self):
        self._env = {
            k: os.environ.get(k)
            for k in ("RFP_SCORING_CONFIG", "RFP_SCORING_CONFIG_FILE")
        }
        os.environ.pop("RFP_SCORING_CONFIG", None)
        os.environ.pop("RFP_SCORING_CONFIG_FILE", None)
        self._orig_path = config.RFP_SCORING_OVERRIDE_PATH
        self._orig_active = copy.deepcopy(config.RFP_SCORING)
        self._orig_listeners = list(config._rfp_scoring_listeners)
        self._tmpdir = tempfile.mkdtemp()
        config.RFP_SCORING_OVERRIDE_PATH = os.path.join(self._tmpdir, "override.json")

    def tearDown(self):
        config.RFP_SCORING_OVERRIDE_PATH = self._orig_path
        config._rfp_scoring_listeners[:] = self._orig_listeners
        config._apply_in_place(copy.deepcopy(self._orig_active))
        for k, v in self._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def test_invalid_save_is_rejected_and_not_persisted(self):
        problems = config.save_rfp_scoring({"weights": {"revenue_potential": 0.99}})
        self.assertTrue(any("weights" in p and "sum" in p for p in problems))
        self.assertFalse(os.path.exists(config.RFP_SCORING_OVERRIDE_PATH))

    def test_valid_save_persists_and_applies_live(self):
        problems = config.save_rfp_scoring({"tier_thresholds": {"pursue_aggressively": 82}})
        self.assertEqual(problems, [])
        # Persisted to disk.
        self.assertTrue(os.path.exists(config.RFP_SCORING_OVERRIDE_PATH))
        # Applied to the live dict in place (same object identity preserved).
        self.assertEqual(config.RFP_SCORING["tier_thresholds"]["pursue_aggressively"], 82)
        # A reload (restart sim) picks the saved file back up.
        self.assertEqual(
            _load_rfp_scoring()["tier_thresholds"]["pursue_aggressively"], 82
        )

    def test_listener_fires_on_save(self):
        seen = {}
        config.register_rfp_scoring_listener(
            lambda cfg: seen.update(t=cfg["tier_thresholds"]["pursue_aggressively"])
        )
        config.save_rfp_scoring({"tier_thresholds": {"pursue_aggressively": 81}})
        self.assertEqual(seen.get("t"), 81)

    def test_reset_clears_override(self):
        config.save_rfp_scoring({"tier_thresholds": {"pursue_aggressively": 82}})
        config.reset_rfp_scoring()
        self.assertFalse(os.path.exists(config.RFP_SCORING_OVERRIDE_PATH))
        self.assertEqual(
            config.RFP_SCORING["tier_thresholds"]["pursue_aggressively"],
            RFP_SCORING_DEFAULTS["tier_thresholds"]["pursue_aggressively"],
        )


if __name__ == "__main__":
    unittest.main()
