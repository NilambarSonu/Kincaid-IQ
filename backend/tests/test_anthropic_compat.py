"""
Unit tests for the Anthropic compatibility shim (pure translation logic only —
no network calls). Guards the OpenAI-chat-completions surface the contract
analyzers depend on so a future change can't silently break their call sites.
"""
import unittest

from backend import anthropic_compat as ac


class TestModelMapping(unittest.TestCase):
    def test_non_claude_ids_fall_back_to_highest_tier(self):
        self.assertEqual(ac._map_model("gpt-4o"), ac.DEFAULT_MODEL)
        self.assertEqual(ac._map_model("gemini-2.5-flash"), ac.DEFAULT_MODEL)
        self.assertEqual(ac._map_model(None), ac.DEFAULT_MODEL)

    def test_claude_ids_pass_through(self):
        self.assertEqual(ac._map_model("claude-opus-4-5"), "claude-opus-4-5")
        self.assertEqual(ac._map_model("claude-sonnet-4-6"), "claude-sonnet-4-6")

    def test_default_is_an_opus_tier_model(self):
        self.assertTrue(ac.DEFAULT_MODEL.startswith("claude-opus"))


class TestMessageSplitting(unittest.TestCase):
    def test_system_separated_from_conversation(self):
        system, convo = ac._split_messages(
            [
                {"role": "system", "content": "be terse"},
                {"role": "user", "content": "hi"},
                {"role": "assistant", "content": "hello"},
            ],
            None,
        )
        self.assertEqual(system, "be terse")
        self.assertEqual(convo, [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ])

    def test_json_object_format_adds_steering_to_system(self):
        system, _ = ac._split_messages(
            [{"role": "user", "content": "give data"}],
            {"type": "json_object"},
        )
        self.assertIsNotNone(system)
        self.assertIn("valid JSON object only", system)

    def test_no_steering_without_json_format(self):
        system, _ = ac._split_messages(
            [{"role": "user", "content": "give data"}],
            None,
        )
        self.assertIsNone(system)


class TestKwargBuilding(unittest.TestCase):
    def test_max_tokens_defaulted_when_missing(self):
        kwargs = ac._build_kwargs("claude-opus-4-5", None, [{"role": "user", "content": "x"}], None, None)
        self.assertEqual(kwargs["max_tokens"], ac._DEFAULT_MAX_TOKENS)
        self.assertNotIn("temperature", kwargs)
        self.assertNotIn("system", kwargs)

    def test_explicit_values_preserved(self):
        kwargs = ac._build_kwargs("gpt-4o", "sys", [{"role": "user", "content": "x"}], 2000, 0.4)
        self.assertEqual(kwargs["model"], ac.DEFAULT_MODEL)  # remapped
        self.assertEqual(kwargs["max_tokens"], 2000)
        self.assertEqual(kwargs["temperature"], 0.4)
        self.assertEqual(kwargs["system"], "sys")


class TestResponseShapes(unittest.TestCase):
    def test_openai_shaped_completion_response(self):
        r = ac._Response("hello", ac._Usage(3, 5))
        self.assertEqual(r.choices[0].message.content, "hello")
        self.assertEqual(r.usage.total_tokens, 8)

    def test_openai_shaped_stream_chunk(self):
        chunk = ac._Chunk("tok")
        self.assertEqual(chunk.choices[0].delta.content, "tok")


if __name__ == "__main__":
    unittest.main()
