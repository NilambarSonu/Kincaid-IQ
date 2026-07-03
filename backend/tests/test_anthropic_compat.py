"""
Unit tests for the (now OpenAI-backed) Anthropic compatibility shim — pure
translation logic only, no network calls. Guards both drop-in surfaces:
the OpenAI chat-completions subset and the Anthropic Messages subset, so a
future change can't silently break the many call sites that depend on them.
"""
import unittest

from backend import anthropic_compat as ac


class TestModelMapping(unittest.TestCase):
    def test_every_id_forced_to_gpt5(self):
        # Platform directive: only the highest-tier GPT-5 model is ever used, no
        # matter what model= string the caller passes.
        for mid in ("claude-opus-4-5", "claude-sonnet-4-6", "gemini-2.5-flash",
                    "gpt-4o", "o3-mini", None):
            self.assertEqual(ac._map_model(mid), "gpt-5")

    def test_default_is_gpt5(self):
        self.assertEqual(ac.DEFAULT_MODEL, "gpt-5")

    def test_reasoning_detection(self):
        self.assertTrue(ac._is_reasoning("gpt-5"))
        self.assertTrue(ac._is_reasoning("o3-mini"))
        self.assertFalse(ac._is_reasoning("gpt-4o"))


class TestChatKwargs(unittest.TestCase):
    def test_model_forced_and_optional_fields_omitted(self):
        kwargs = ac._chat_kwargs("claude-sonnet-4-6", [{"role": "user", "content": "x"}], None, None, None)
        self.assertEqual(kwargs["model"], "gpt-5")
        self.assertNotIn("max_tokens", kwargs)
        self.assertNotIn("max_completion_tokens", kwargs)
        self.assertNotIn("temperature", kwargs)
        self.assertNotIn("response_format", kwargs)

    def test_gpt5_uses_completion_tokens_and_drops_temperature(self):
        rf = {"type": "json_object"}
        kwargs = ac._chat_kwargs("gpt-4o", [{"role": "user", "content": "x"}], 8000, 0.4, rf)
        self.assertEqual(kwargs["model"], "gpt-5")
        # max_tokens is rejected by GPT-5 — must be converted to max_completion_tokens.
        self.assertNotIn("max_tokens", kwargs)
        self.assertEqual(kwargs["max_completion_tokens"], 8000)
        # Custom temperature is dropped (GPT-5 only allows the default).
        self.assertNotIn("temperature", kwargs)
        self.assertEqual(kwargs["response_format"], rf)

    def test_gpt5_completion_tokens_floored(self):
        kwargs = ac._chat_kwargs("gpt-4o", [{"role": "user", "content": "x"}], 200, None, None)
        # A tiny budget is floored so reasoning tokens don't starve the answer.
        self.assertEqual(kwargs["max_completion_tokens"], ac._MIN_REASONING_COMPLETION)


class TestMessagesTranslation(unittest.TestCase):
    def test_system_prepended_as_message(self):
        msgs = ac._to_oai_messages("be terse", [{"role": "user", "content": "hi"}])
        self.assertEqual(msgs[0], {"role": "system", "content": "be terse"})
        self.assertEqual(msgs[1], {"role": "user", "content": "hi"})

    def test_no_system_message_when_absent(self):
        msgs = ac._to_oai_messages(None, [{"role": "user", "content": "hi"}])
        self.assertEqual(msgs, [{"role": "user", "content": "hi"}])

    def test_list_content_text_blocks_flattened(self):
        flat = ac._flatten_content(
            [{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]
        )
        self.assertEqual(flat, "a\nb")

    def test_string_content_passthrough(self):
        self.assertEqual(ac._flatten_content("plain"), "plain")

    def test_messages_kwargs_defaults_completion_tokens(self):
        kwargs = ac._messages_kwargs("claude-opus-4-5", None, [{"role": "user", "content": "x"}], None, None)
        self.assertEqual(kwargs["model"], "gpt-5")
        # GPT-5 uses max_completion_tokens; the messages-surface default is applied.
        self.assertNotIn("max_tokens", kwargs)
        self.assertEqual(kwargs["max_completion_tokens"], ac._DEFAULT_MAX_TOKENS)
        self.assertNotIn("temperature", kwargs)

    def test_messages_kwargs_drops_temperature_for_gpt5(self):
        kwargs = ac._messages_kwargs("claude-opus-4-5", None, [{"role": "user", "content": "x"}], 9000, 0.3)
        self.assertEqual(kwargs["max_completion_tokens"], 9000)
        self.assertNotIn("temperature", kwargs)


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeUsage:
    def __init__(self, p, c):
        self.prompt_tokens = p
        self.completion_tokens = c


class _FakeOAIResponse:
    def __init__(self, content, p, c, model="gpt-4o"):
        self.choices = [_FakeChoice(content)]
        self.usage = _FakeUsage(p, c)
        self.model = model


class TestResponseShapes(unittest.TestCase):
    def test_openai_response_translated_to_anthropic_message(self):
        msg = ac._to_message(_FakeOAIResponse("hello", 3, 5))
        self.assertEqual(msg.content[0].type, "text")
        self.assertEqual(msg.content[0].text, "hello")
        self.assertEqual(msg.usage.input_tokens, 3)
        self.assertEqual(msg.usage.output_tokens, 5)

    def test_empty_content_is_safe(self):
        msg = ac._to_message(_FakeOAIResponse(None, 0, 0))
        self.assertEqual(msg.content[0].text, "")


if __name__ == "__main__":
    unittest.main()
