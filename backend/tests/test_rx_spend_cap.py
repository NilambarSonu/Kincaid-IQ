import unittest

from backend.routers.rx_defense import _spend_cap_scale, _MAX_LEAKAGE_SHARE


class TestRxSpendCap(unittest.TestCase):
    def test_no_spend_is_uncapped(self):
        self.assertEqual(_spend_cap_scale(1_200_000, None), 1.0)
        self.assertEqual(_spend_cap_scale(1_200_000, 0), 1.0)

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

    def test_zero_or_negative_modeled_total(self):
        self.assertEqual(_spend_cap_scale(0, 2_500_000), 1.0)
        self.assertEqual(_spend_cap_scale(-5, 2_500_000), 1.0)


if __name__ == "__main__":
    unittest.main()
