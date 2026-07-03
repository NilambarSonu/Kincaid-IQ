import json
import unittest

from backend.routers.rx_defense import _loads_llm_json, _salvage_json_object


class TestLoadsLlmJson(unittest.TestCase):
    def test_plain_object(self):
        self.assertEqual(_loads_llm_json('{"a": 1, "b": [1, 2]}'), {"a": 1, "b": [1, 2]})

    def test_markdown_fenced(self):
        raw = '```json\n{"overall_score": 42, "provisions": []}\n```'
        self.assertEqual(_loads_llm_json(raw), {"overall_score": 42, "provisions": []})

    def test_prose_wrapped_object_sliced(self):
        raw = 'Here is the analysis you requested:\n{"x": 1}\nThanks.'
        self.assertEqual(_loads_llm_json(raw), {"x": 1})

    def test_empty_raises(self):
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            _loads_llm_json("")

    def test_non_object_json_rejected(self):
        # A bare array is valid JSON but not the object contract callers expect.
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            _loads_llm_json("[1, 2, 3]")

    def test_no_object_raises(self):
        with self.assertRaises((ValueError, json.JSONDecodeError)):
            _loads_llm_json("this is not json at all")


class TestSalvageJsonObject(unittest.TestCase):
    def test_truncated_mid_array_recovers_complete_elements(self):
        # The large forensic JSON hits the token cap and stops mid-provision.
        # Salvage must recover the completed leading provisions + top-level keys.
        raw = (
            '{"overall_score": 42, "provisions": ['
            '{"id": 1, "name": "Pricing", "score": 3.0},'
            '{"id": 2, "name": "Rebates", "score": 4.5},'
            '{"id": 3, "name": "Aud'  # <- truncated here
        )
        out = _salvage_json_object(raw)
        self.assertIsNotNone(out)
        self.assertEqual(out["overall_score"], 42)
        # The incomplete third provision is dropped; the two complete ones survive.
        self.assertEqual(len(out["provisions"]), 2)
        self.assertEqual(out["provisions"][0]["id"], 1)
        self.assertEqual(out["provisions"][1]["name"], "Rebates")

    def test_truncated_nested_string_drops_incomplete_member(self):
        # Truncation lands inside b's nested value; the complete leading member
        # "a" is recovered and the half-received "b" is dropped rather than kept
        # partially populated.
        raw = '{"a": 1, "b": {"c": "hello wor'
        out = _salvage_json_object(raw)
        self.assertEqual(out["a"], 1)
        self.assertNotIn("b", out)

    def test_escaped_quotes_preserved_and_trailing_key_dropped(self):
        raw = '{"note": "he said \\"hi\\" to me", "n": 2, "bad":'
        out = _salvage_json_object(raw)
        self.assertEqual(out["note"], 'he said "hi" to me')
        self.assertEqual(out["n"], 2)
        self.assertNotIn("bad", out)

    def test_unsalvageable_returns_none(self):
        self.assertIsNone(_salvage_json_object("no braces here"))

    def test_loader_uses_salvage_for_truncated_output(self):
        # End-to-end: _loads_llm_json must recover truncated output instead of
        # raising (which is what silently triggered the demo-analysis fallback).
        raw = '{"overall_score": 55, "provisions": [{"id": 1, "name": "X", "score": 2.0}], "key_find'
        out = _loads_llm_json(raw)
        self.assertEqual(out["overall_score"], 55)
        self.assertEqual(len(out["provisions"]), 1)


if __name__ == "__main__":
    unittest.main()
