"""
Anthropic (Claude) compatibility shim — now OpenAI-backed.

Historically this routed calls to Anthropic Claude. Per the platform directive to
use OpenAI exclusively, everything here forwards to the real OpenAI SDK. Nothing
in this module calls Claude anymore.

Two drop-in surfaces, both OpenAI-backed:

  • AsyncAnthropicClient / SyncAnthropicClient — the OpenAI chat-completions subset
    (`client.chat.completions.create(...)` -> resp.choices[0].message.content),
    for routers that imported this module `as AsyncOpenAI`.

  • AsyncAnthropic / Anthropic — the Anthropic *Messages* surface
    (`client.messages.create(...)` -> resp.content[0].text), so call sites that
    did `from anthropic import AsyncAnthropic` / `import anthropic` only need to
    swap the import to this module and keep their response parsing unchanged.
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
# the Rx Defense forensic analysis) spends so long thinking that requests exceed
# multi-minute timeouts and/or exhaust the token budget before emitting an answer —
# making features silently fall back to demo output. Pin a fast-but-capable default
# ("low"); override globally with GPT5_REASONING_EFFORT, or per-call via the
# reasoning_effort kwarg. "none"/"" disables it (uses model default).
_REASONING_EFFORT = os.getenv("GPT5_REASONING_EFFORT", "low").strip()

# Anthropic required max_tokens on every call; keep a default for messages-surface
# callers that omit it.
_DEFAULT_MAX_TOKENS = 4096

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


# ── OpenAI chat-completions surface (imported `as AsyncOpenAI`) ────────────────
def _chat_kwargs(
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
        kwargs = _chat_kwargs(model, messages, max_tokens, temperature, response_format, reasoning_effort)
        if stream:
            kwargs["stream"] = True
        return await _aclient().chat.completions.create(**kwargs)


class _AsyncChat:
    def __init__(self):
        self.completions = _AsyncCompletions()


class AsyncAnthropicClient:
    """Drop-in replacement for openai.AsyncOpenAI (chat-completions subset)."""

    def __init__(self, *_, **__):
        self.chat = _AsyncChat()


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
        return _sclient().chat.completions.create(
            **_chat_kwargs(model, messages, max_tokens, temperature, response_format, reasoning_effort)
        )


class _SyncChat:
    def __init__(self):
        self.completions = _SyncCompletions()


class SyncAnthropicClient:
    """Drop-in replacement for openai.OpenAI (chat-completions subset)."""

    def __init__(self, *_, **__):
        self.chat = _SyncChat()


# ── Anthropic Messages surface (imported as `anthropic` / AsyncAnthropic) ──────
class _TextBlock:
    def __init__(self, text: str):
        self.type = "text"
        self.text = text or ""


class _AnthropicUsage:
    def __init__(self, input_tokens: int, output_tokens: int):
        self.input_tokens = input_tokens or 0
        self.output_tokens = output_tokens or 0


class _AnthropicMessage:
    """Mimics anthropic.types.Message: .content[0].text, .usage.*_tokens."""

    def __init__(self, text: str, model: Optional[str], usage: _AnthropicUsage):
        self.content = [_TextBlock(text)]
        self.role = "assistant"
        self.model = model
        self.stop_reason = "end_turn"
        self.usage = usage


def _flatten_content(content: Any) -> Any:
    """Anthropic content may be a string or a list of blocks; OpenAI wants a string
    per message. Join text blocks; pass strings through unchanged."""
    if isinstance(content, list):
        return "\n".join(
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return content


def _to_oai_messages(system: Any, messages: Optional[List[dict]]) -> List[dict]:
    out: List[dict] = []
    if system:
        if isinstance(system, list):
            system = "\n\n".join(
                (b.get("text", "") if isinstance(b, dict) else str(b)) for b in system
            )
        out.append({"role": "system", "content": system})
    for m in messages or []:
        out.append(
            {"role": m.get("role", "user"), "content": _flatten_content(m.get("content"))}
        )
    return out


def _messages_kwargs(
    model: Optional[str],
    system: Any,
    messages: Optional[List[dict]],
    max_tokens: Optional[int],
    temperature: Optional[float],
    reasoning_effort: Optional[str] = None,
) -> dict:
    resolved = _map_model(model)
    kwargs: dict = {
        "model": resolved,
        "messages": _to_oai_messages(system, messages),
    }
    mt = int(max_tokens) if max_tokens is not None else _DEFAULT_MAX_TOKENS
    if _is_reasoning(resolved):
        kwargs["max_completion_tokens"] = max(mt, _MIN_REASONING_COMPLETION)
        effort = reasoning_effort if reasoning_effort is not None else _REASONING_EFFORT
        if effort and effort.lower() != "none":
            kwargs["reasoning_effort"] = effort
    else:
        kwargs["max_tokens"] = mt
        if temperature is not None:
            kwargs["temperature"] = temperature
    return kwargs


def _to_message(oai: Any) -> _AnthropicMessage:
    text = ""
    try:
        text = oai.choices[0].message.content or ""
    except (AttributeError, IndexError, TypeError):
        text = ""
    u = getattr(oai, "usage", None)
    usage = _AnthropicUsage(
        getattr(u, "prompt_tokens", 0) if u else 0,
        getattr(u, "completion_tokens", 0) if u else 0,
    )
    return _AnthropicMessage(text, getattr(oai, "model", None), usage)


class _AsyncMessages:
    async def create(
        self,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        messages: Optional[List[dict]] = None,
        system: Any = None,
        temperature: Optional[float] = None,
        reasoning_effort: Optional[str] = None,
        **_: Any,
    ) -> _AnthropicMessage:
        oai = await _aclient().chat.completions.create(
            **_messages_kwargs(model, system, messages, max_tokens, temperature, reasoning_effort)
        )
        return _to_message(oai)


class AsyncAnthropic:
    """OpenAI-backed drop-in for anthropic.AsyncAnthropic (messages subset)."""

    def __init__(self, *_, **__):
        self.messages = _AsyncMessages()


class _SyncMessages:
    def create(
        self,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        messages: Optional[List[dict]] = None,
        system: Any = None,
        temperature: Optional[float] = None,
        reasoning_effort: Optional[str] = None,
        **_: Any,
    ) -> _AnthropicMessage:
        oai = _sclient().chat.completions.create(
            **_messages_kwargs(model, system, messages, max_tokens, temperature, reasoning_effort)
        )
        return _to_message(oai)


class Anthropic:
    """OpenAI-backed drop-in for anthropic.Anthropic (messages subset)."""

    def __init__(self, *_, **__):
        self.messages = _SyncMessages()
