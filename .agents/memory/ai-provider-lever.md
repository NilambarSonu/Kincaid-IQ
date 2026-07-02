---
name: AI provider routing
description: How a backend router's LLM provider is actually determined, and how to switch it.
---

Most backend routers are written against the OpenAI chat-completions surface but
import a *provider shim aliased as `AsyncOpenAI`*. The alias — not the call sites —
decides which provider actually runs. There are parallel OpenAI-shaped shims (one
Gemini-backed, one Claude-backed); each ignores the per-call `api_key`/`base_url`
args and resolves its own key/endpoint at import time.

**Why:** changing `settings.openai_*` does NOT redirect a router that imports a shim;
the shim is the real lever. A router's provider is whichever shim its import alias
points at, plus any explicit `model=` strings. A separate, smaller set of routers
import the genuine OpenAI/Anthropic SDKs directly and are driven by `config.py`.

**How to apply:**
- To switch ONE router to a different provider, swap its `import ... as AsyncOpenAI`
  alias to the other shim and update its `model=` strings to match (keep call sites
  honest — don't rely solely on the shim's non-matching-id fallback).
- To change keys/endpoints/gateway-vs-direct for the bulk path, edit the relevant
  shim; for the SDK-direct routers, edit `config.py`.
- A shim maps any model id outside its own family to that provider's default, so a
  stale `model=` string silently still works but misreports the model — always update it.
