---
name: Anthropic compat shim has no native JSON mode
description: Why LLM callers in this repo must parse responses leniently, not with plain json.loads
---

`backend/anthropic_compat.py` exposes an OpenAI-shaped client (`AsyncAnthropicClient as AsyncOpenAI`) backed by Claude. `response_format={"type":"json_object"}` is NOT enforced — the shim only *steers* JSON via an appended system instruction. Claude Opus still occasionally wraps output in ```json fences or a leading sentence.

**Why:** Plain `json.loads(raw)` then fails at char 0 ("Expecting value: line 1 column 1 (char 0)"). In Rx Defense this made EVERY uploaded contract analysis silently fall back to generic demo data — the user saw demo results instead of an analysis of their own contract.

**How to apply:** Any caller of this shim that expects JSON must parse leniently — strip code fences, slice the outer `{...}`, and assert the result is a dict before use. See `_loads_llm_json()` in `backend/routers/rx_defense.py`. When adding new LLM calls anywhere in the backend, do the same rather than calling `json.loads` directly on `response.choices[0].message.content`.
