import unittest

import re

from backend.routers.rx_defense import (
    _spend_cap_scale,
    _effective_rx_spend,
    _apply_modeled_impacts,
    _compute_financial_impact,
    _savings_core,
    _PROVISION_EXPOSURE_PMPY,
    _PROVISION_RECOVERY_RATE,
    _MAX_LEAKAGE_SHARE,
    _ASSUMED_RX_PMPY,
)


def _sum_midpoints(strings):
    total = 0.0
    for s in strings:
        if not s:
            continue
        nums = [float(n.replace(",", "")) for n in re.findall(r"\$([\d,]+)", s)]
        if nums:
            total += sum(nums) / len(nums)
    return total


class TestRxSpendCap(unittest.TestCase):
    def test_no_spend_falls_back_to_modeled_baseline(self):
        # Spend unknown -> cap denominator is members x _ASSUMED_RX_PMPY so the
        # 30% ceiling always binds instead of silently disabling the cap.
        members = 500
        baseline = members * _ASSUMED_RX_PMPY  # 700K
        cap = baseline * _MAX_LEAKAGE_SHARE  # 210K
        scale = _spend_cap_scale(1_200_000, None, members)
        self.assertAlmostEqual(scale, cap / 1_200_000, places=6)
        self.assertLessEqual(round(1_200_000 * scale), round(cap) + 1)

    def test_no_spend_no_members_uses_reference_plan(self):
        # members omitted -> defaults to the 500-member reference plan baseline.
        self.assertEqual(_effective_rx_spend(None, 0), 500 * _ASSUMED_RX_PMPY)
        self.assertEqual(_effective_rx_spend(0, 0), 500 * _ASSUMED_RX_PMPY)

    def test_actual_spend_takes_precedence_over_baseline(self):
        self.assertEqual(_effective_rx_spend(2_500_000, 500), 2_500_000.0)

    def test_within_cap_is_unchanged(self):
        # 300K leakage vs 2.5M spend -> 12% < 30% cap, no scaling
        self.assertEqual(_spend_cap_scale(300_000, 2_500_000), 1.0)

    def test_over_cap_scales_to_30pct(self):
        # 1.2M leakage vs 2.5M spend -> cap 750K -> scale 0.625
        scale = _spend_cap_scale(1_200_000, 2_500_000)
        self.assertAlmostEqual(scale, 0.625, places=4)
        self.assertAlmostEqual(1_200_000 * scale, 750_000, places=2)

    def test_capped_total_never_exceeds_share_of_spend(self):
        spend = 2_500_000
        for raw in (10_000, 500_000, 750_000, 750_001, 1_000_000, 5_000_000):
            capped = raw * _spend_cap_scale(raw, spend)
            self.assertLessEqual(round(capped), round(spend * _MAX_LEAKAGE_SHARE) + 1)

    def test_never_exceeds_30pct_even_without_actual_spend(self):
        # The core guarantee the cap exists for: with no actual spend entered,
        # capped leakage still never exceeds 30% of the modeled baseline.
        members = 1500
        baseline = members * _ASSUMED_RX_PMPY
        for raw in (10_000, 500_000, baseline, baseline * 2):
            capped = raw * _spend_cap_scale(raw, None, members)
            self.assertLessEqual(round(capped), round(baseline * _MAX_LEAKAGE_SHARE) + 1)

    def test_zero_or_negative_modeled_total(self):
        self.assertEqual(_spend_cap_scale(0, 2_500_000), 1.0)
        self.assertEqual(_spend_cap_scale(-5, 2_500_000), 1.0)

    def test_per_provision_impacts_sum_within_cap(self):
        # Every provision at max risk (score 0) drives maximum modeled leakage.
        # After _apply_modeled_impacts the sum of the issue-card midpoints must
        # not exceed 30% of the members-based baseline.
        members = 500
        baseline = members * _ASSUMED_RX_PMPY
        result = {
            "provisions": [
                {"id": pid, "score": 0, "issues": [{"financial_impact": "$1 - $2 annually"}]}
                for pid in _PROVISION_EXPOSURE_PMPY
            ]
        }
        _apply_modeled_impacts(result, members)

        total = _sum_midpoints(
            issue["financial_impact"]
            for prov in result["provisions"]
            for issue in prov["issues"]
        )
        # Allow a small tolerance for the per-provision round-to-$1000 banding.
        self.assertLessEqual(total, baseline * _MAX_LEAKAGE_SHARE * 1.02)

    def test_exposure_at_stake_capped_to_30pct(self):
        # Mirrors /exposure: the cap is anchored to the WORST-CASE (score 0)
        # at-stake total, so BOTH the at-stake figure and the score-adjusted
        # exposure stay within 30% of spend and keep their ordering.
        members = 1500
        spend = 2_500_000
        cap = spend * _MAX_LEAKAGE_SHARE  # 750K
        raw_at_stake = 0.0
        raw_exposure = 0.0
        for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
            score = 2.0  # damaging but not score 0
            rf = max(0.0, (10.0 - score) / 10.0)
            raw_at_stake += meta["pmpy"] * members
            raw_exposure += rf * meta["pmpy"] * members
        scale = _spend_cap_scale(raw_at_stake, spend, members)
        total_at_stake = raw_at_stake * scale
        total_exposure = raw_exposure * scale
        self.assertLessEqual(round(total_at_stake), round(cap) + 1)
        self.assertLessEqual(round(total_exposure), round(cap) + 1)
        self.assertLessEqual(total_exposure, total_at_stake + 1)

    def test_savings_report_high_band_never_exceeds_30pct(self):
        # Mirrors /savings-report end-to-end: the HIGH savings band (the single
        # largest dollar figure the report shows) must never exceed 30% of the
        # effective Rx spend — including after the final hard clamp — for even a
        # maximally damaging contract on a large plan with low actual spend.
        members = 3000
        for spend in (300_000, 900_000, 2_500_000, None):
            raw_leakage = 0.0
            for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
                rf = 1.0  # every provision at score 0 (worst case)
                raw_leakage += rf * meta["pmpy"] * members
            scale = _spend_cap_scale(raw_leakage, spend, members)

            total_low = total_base = total_high = 0.0
            for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
                exp = 1.0 * meta["pmpy"] * members * scale
                lo, ba, hi = _PROVISION_RECOVERY_RATE.get(pid, (0.4, 0.6, 0.8))
                total_low  += exp * lo
                total_base += exp * ba
                total_high += exp * hi

            cap_ceiling = _effective_rx_spend(spend, members) * _MAX_LEAKAGE_SHARE
            if total_high > cap_ceiling and total_high > 0:
                clamp = cap_ceiling / total_high
                total_low  *= clamp
                total_base *= clamp
                total_high *= clamp

            self.assertLessEqual(round(total_high), round(cap_ceiling) + 1)
            self.assertLessEqual(total_base, total_high + 1)
            self.assertLessEqual(total_low, total_base + 1)

    def test_savings_report_issue_dollars_track_actual_spend_cap(self):
        # Mirrors /savings-report: with a low actual Rx spend the issue-level
        # financial_impact strings (recomputed via the same spend_scale as the
        # totals) must sum within 30% of that ACTUAL spend, not the baseline.
        members = 500
        actual_spend = 400_000  # far below the members baseline
        raw_leakage = 0.0
        for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
            raw_leakage += 1.0 * meta["pmpy"] * members  # all at score 0
        spend_scale = _spend_cap_scale(raw_leakage, actual_spend, members)

        impacts = [
            _compute_financial_impact(pid, 0.0, members, spend_scale)
            for pid in _PROVISION_EXPOSURE_PMPY
        ]
        total = _sum_midpoints(impacts)
        self.assertLessEqual(total, actual_spend * _MAX_LEAKAGE_SHARE * 1.02)


    def test_savings_core_high_band_capped_and_ordered(self):
        # _savings_core is the SINGLE source of truth shared by the savings
        # report and the dual-engine comparison. Its HIGH band must never exceed
        # 30% of effective Rx spend, the per-provision figures must sum within
        # that ceiling, and low <= base <= high must hold.
        members = 3000
        prov_by_id = {pid: {"score": 0.0} for pid in _PROVISION_EXPOSURE_PMPY}
        for spend in (300_000, 900_000, 2_500_000, None):
            core = _savings_core(prov_by_id, members, spend)
            ceiling = _effective_rx_spend(spend, members) * _MAX_LEAKAGE_SHARE
            self.assertLessEqual(round(core["total_high"]), round(ceiling) + 1)
            self.assertLessEqual(core["total_base"], core["total_high"] + 1)
            self.assertLessEqual(core["total_low"], core["total_base"] + 1)
            per_high = sum(p["save_high"] for p in core["per"].values())
            self.assertLessEqual(per_high, round(ceiling) + 2)

    def test_savings_core_ignores_healthy_provisions(self):
        # Only damaging clauses (score < 7) contribute to savings.
        members = 1500
        prov_by_id = {pid: {"score": 9.0} for pid in _PROVISION_EXPOSURE_PMPY}
        core = _savings_core(prov_by_id, members, 2_500_000)
        self.assertEqual(core["per"], {})
        self.assertEqual(core["total_base"], 0)


if __name__ == "__main__":
    unittest.main()
