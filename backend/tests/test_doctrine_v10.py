"""
Regression guard for the Kincaid Health Verify™ V10.0 governing doctrine.

Locks in the V10.0 markers on the canonical doctrine surfaces and verifies that
the downstream JSON output contracts / confidence tiers remain intact, so the
doctrine upgrade cannot silently regress and AI output keeps following V10.0.
"""
import unittest

from backend.agents.base import BASE_PERSONA, KIQ_VERIFY_HEADER
from backend.routers.kiq_engine import _NARRATIVE_SYSTEM


class TestDoctrineV10(unittest.TestCase):
    def test_base_persona_v10_identity(self):
        self.assertIn("Kincaid Health Verify", BASE_PERSONA)
        self.assertIn("University of Chicago", BASE_PERSONA)
        # Investigative discipline (constitutional)
        self.assertIn("investigate", BASE_PERSONA)
        self.assertIn("prove", BASE_PERSONA)
        self.assertIn("quantify consequences", BASE_PERSONA)
        # 30/90/180/365 action horizon + 11-phase method + normalization
        self.assertIn("30, 90, 180, and 365", BASE_PERSONA)
        self.assertIn("ELEVEN-PHASE FORENSIC METHOD", BASE_PERSONA)
        self.assertIn("PMPM", BASE_PERSONA)

    def test_base_persona_preserves_json_output_contract(self):
        self.assertIn("OUTPUT CONTRACT", BASE_PERSONA)
        self.assertIn("structured JSON only", BASE_PERSONA)

    def test_header_complements_specialized_identity(self):
        self.assertIn("Kincaid Health Verify", KIQ_VERIFY_HEADER)
        self.assertIn("specialized role", KIQ_VERIFY_HEADER)
        self.assertIn("30, 90, 180, and 365", KIQ_VERIFY_HEADER)

    def test_narrative_system_v10_voice_and_schema_intact(self):
        self.assertIn("Kincaid Health Verify", _NARRATIVE_SYSTEM)
        self.assertIn("30, 90, 180, and 365", _NARRATIVE_SYSTEM)
        # Confidence tiers (exactly three) preserved
        for tier in ("CERTIFIED", "MODELED", "INSUFFICIENT_EVIDENCE"):
            self.assertIn(tier, _NARRATIVE_SYSTEM)
        # JSON schema field keys preserved
        for field in ('"tier"', '"insight"', '"anomaly"', '"implication"', '"brief"'):
            self.assertIn(field, _NARRATIVE_SYSTEM)

    def test_no_legacy_pbm_only_behavioral_rule(self):
        # Canonical narrative surface must stay vendor-agnostic, not PBM-only
        self.assertNotIn("Do not assume PBM compliance", _NARRATIVE_SYSTEM)


if __name__ == "__main__":
    unittest.main()
