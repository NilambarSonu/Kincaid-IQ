"""
Gemini compatibility shim — now OpenAI-backed.

Historically this routed OpenAI-style chat-completions calls to Google Gemini.
Per the platform directive to use OpenAI exclusively, these drop-in clients now
forward to the real OpenAI SDK. The class names are intentionally unchanged so
the many call sites that do
    from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
keep working without edits — only the underlying provider changed.

Usage (drop-in):
    from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
    client = AsyncOpenAI(api_key=..., base_url=...)   # args ignored
    resp = await client.chat.completions.create(
        model="gemini-2.5-flash",   # any non-OpenAI id is remapped to DEFAULT_MODEL
        messages=[{"role": "system", "content": ...}, {"role": "user", "content": ...}],
        temperature=0.3,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )
    text = resp.choices[0].message.content
"""
import os
from typing import Any, List, Optional

from openai import AsyncOpenAI as _AsyncOpenAI, OpenAI as _SyncOpenAI

from backend.config import settings

# Platform directive: only ever use the highest-tier GPT-5 model. Every call —
# regardless of the model= string the caller passes — resolves to this.
DEFAULT_MODEL = "gpt-5"

# Reasoning-class models (GPT-5, o-series) require `max_completion_tokens` instead
# of `max_tokens`, only accept the default temperature (a custom value 400s), and
# spend part of the token budget on hidden reasoning — so we floor the completion
# budget to keep the visible answer from being starved.
_REASONING_PREFIXES = ("gpt-5", "o1", "o3", "o4")
_MIN_REASONING_COMPLETION = 2048

# GPT-5 defaults to "medium" reasoning effort, which for large JSON responses (e.g.
# the PBM Contract Clarity 360 forensic analysis) spends so long thinking that requests exceed
# multi-minute timeouts and/or exhaust the token budget before emitting an answer —
# making features silently fall back to demo output. Pin a fast-but-capable default
# ("low"); override globally with GPT5_REASONING_EFFORT, or per-call via the
# reasoning_effort kwarg. "none"/"" disables it (uses model default).
_REASONING_EFFORT = os.getenv("GPT5_REASONING_EFFORT", "low").strip()

_async_singleton: Optional[_AsyncOpenAI] = None
_sync_singleton: Optional[_SyncOpenAI] = None


def _aclient() -> _AsyncOpenAI:
    global _async_singleton
    if _async_singleton is None:
        _async_singleton = _AsyncOpenAI(
            api_key=settings.openai_api_key, base_url=settings.openai_base_url
        )
    return _async_singleton


def _sclient() -> _SyncOpenAI:
    global _sync_singleton
    if _sync_singleton is None:
        _sync_singleton = _SyncOpenAI(
            api_key=settings.openai_api_key, base_url=settings.openai_base_url
        )
    return _sync_singleton


def _map_model(model: Optional[str]) -> str:
    # The caller's model= string is intentionally ignored: only GPT-5 is used.
    return DEFAULT_MODEL


def _is_reasoning(model: str) -> bool:
    return str(model).startswith(_REASONING_PREFIXES)


def _build_kwargs(
    model: Optional[str],
    messages: Optional[List[dict]],
    max_tokens: Optional[int],
    temperature: Optional[float],
    response_format: Optional[dict],
    reasoning_effort: Optional[str] = None,
) -> dict:
    resolved = _map_model(model)
    kwargs: dict = {"model": resolved, "messages": messages or []}
    if _is_reasoning(resolved):
        # GPT-5: use max_completion_tokens (floored), and drop custom temperature.
        if max_tokens is not None:
            kwargs["max_completion_tokens"] = max(int(max_tokens), _MIN_REASONING_COMPLETION)
        effort = reasoning_effort if reasoning_effort is not None else _REASONING_EFFORT
        if effort and effort.lower() != "none":
            kwargs["reasoning_effort"] = effort
    else:
        if max_tokens is not None:
            kwargs["max_tokens"] = int(max_tokens)
        if temperature is not None:
            kwargs["temperature"] = temperature
    if response_format is not None:
        kwargs["response_format"] = response_format
    return kwargs


# ── Async client ──────────────────────────────────────────────────────────────
class _AsyncCompletions:
    async def create(
        self,
        model: Optional[str] = None,
        messages: Optional[List[dict]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        response_format: Optional[dict] = None,
        stream: bool = False,
        reasoning_effort: Optional[str] = None,
        **_: Any,
    ) -> Any:
        kwargs = _build_kwargs(model, messages, max_tokens, temperature, response_format, reasoning_effort)
        if stream:
            kwargs["stream"] = True
        # Returns the real OpenAI response (resp.choices[0].message.content) or,
        # when stream=True, the real OpenAI async stream (chunk.choices[0].delta.content).
        return await _aclient().chat.completions.create(**kwargs)


class _AsyncChat:
    def __init__(self):
        self.completions = _AsyncCompletions()


class AsyncGeminiClient:
    """Drop-in replacement for openai.AsyncOpenAI (chat-completions subset)."""

    def __init__(self, *_, **__):
        self.chat = _AsyncChat()


# ── Sync client ─────────────────────────────────────────────────────────────--
class _SyncCompletions:
    def create(
        self,
        model: Optional[str] = None,
        messages: Optional[List[dict]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        response_format: Optional[dict] = None,
        reasoning_effort: Optional[str] = None,
        **_: Any,
    ) -> Any:
        kwargs = _build_kwargs(model, messages, max_tokens, temperature, response_format, reasoning_effort)
        return _sclient().chat.completions.create(**kwargs)


class _SyncChat:
    def __init__(self):
        self.completions = _SyncCompletions()


class SyncGeminiClient:
    """Drop-in replacement for openai.OpenAI (chat-completions subset)."""

    def __init__(self, *_, **__):
        self.chat = _SyncChat()
