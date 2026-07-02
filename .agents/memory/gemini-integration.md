---
name: Gemini via Replit AI Integrations
description: How to call Gemini from the Python backend; the gateway does NOT speak OpenAI's chat/completions protocol.
---

# Calling Gemini on Replit (Python backend)

The Replit Gemini gateway (`AI_INTEGRATIONS_GEMINI_BASE_URL`, ends in `.../modelfarm/gemini`)
**does NOT support the OpenAI-compatible `/chat/completions` endpoint** — hitting it returns
`400 INVALID_ENDPOINT`. You must use the **native `google-genai` Python SDK**:

```python
from google import genai
from google.genai import types
client = genai.Client(
    api_key=os.environ["AI_INTEGRATIONS_GEMINI_API_KEY"],
    http_options=types.HttpOptions(
        base_url=os.environ["AI_INTEGRATIONS_GEMINI_BASE_URL"],
        api_version="",          # MUST be empty string, else SDK appends /v1beta and 404s
    ),
)
# async: await client.aio.models.generate_content(model=, contents=, config=)
# sync:  client.models.generate_content(model=, contents=, config=)
```

**Why:** the integration is billed to Replit credits (no user API key). The OpenAI SDK
shim works for the OpenAI/Anthropic integrations but NOT this Gemini gateway.

## Drop-in adapter pattern (this repo)
`backend/gemini_compat.py` exposes `AsyncGeminiClient` / `SyncGeminiClient` with an
OpenAI-shaped `.chat.completions.create(...) -> resp.choices[0].message.content`.
Routers alias it: `from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI`,
so existing OpenAI-style call sites need no change. Translation rules baked in:
- `system` messages -> `system_instruction`; `assistant` role -> Gemini `model` role
- `response_format={"type":"json_object"}` -> `response_mime_type="application/json"`
- `max_tokens` floored to >=8192 (Gemini 2.5 spends output budget on thinking tokens; low caps -> empty text)
- any non-`gemini*` model id (e.g. legacy `gpt-4o`) maps to `gemini-2.5-flash`

**Out of scope when "switch to Gemini":** Anthropic/`claude` calls (separate engine) and
audio STT (`gpt-4o-mini-transcribe`, lives in the TS server module) — leave both alone.
