"""
Anthropic (Claude) compatibility shim.

Provides the same tiny subset of the OpenAI Python SDK surface that
`gemini_compat` exposes — `client.chat.completions.create(...)` returning
`resp.choices[0].message.content`, plus OpenAI-style streaming chunks
(`chunk.choices[0].delta.content`) — but backed by Anthropic Claude.

This lets routers that were written against the OpenAI chat-completions
interface route to the highest Claude tier without rewriting their call
sites or response parsing.

Usage (drop-in):
    from backend.anthropic_compat import AsyncAnthropicClient as AsyncOpenAI
    client = AsyncOpenAI(api_key=..., base_url=...)   # args ignored
    resp = await client.chat.completions.create(
        model="claude-opus-4-5",
        messages=[{"role": "system", "content": ...}, {"role": "user", "content": ...}],
        temperature=0.4,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )
    text = resp.choices[0].message.content
"""
from typing import Any, List, Optional, Tuple

from anthropic import AsyncAnthropic, Anthropic

from backend.config import settings

# Highest Claude tier — used for any non-Claude identifier (e.g. legacy
# "gemini-2.5-flash" / "gpt-4o") so swapping the import alone is sufficient.
DEFAULT_MODEL = "claude-opus-4-5"

# Anthropic requires max_tokens on every call; use this when a caller omits it.
_DEFAULT_MAX_TOKENS = 4096

_async_singleton: Optional[AsyncAnthropic] = None
_sync_singleton: Optional[Anthropic] = None


def _aclient() -> AsyncAnthropic:
    global _async_singleton
    if _async_singleton is None:
        kwargs: dict = {"api_key": settings.anthropic_api_key}
        if settings.anthropic_base_url:
            kwargs["base_url"] = settings.anthropic_base_url
        _async_singleton = AsyncAnthropic(**kwargs)
    return _async_singleton


def _sclient() -> Anthropic:
    global _sync_singleton
    if _sync_singleton is None:
        kwargs: dict = {"api_key": settings.anthropic_api_key}
        if settings.anthropic_base_url:
            kwargs["base_url"] = settings.anthropic_base_url
        _sync_singleton = Anthropic(**kwargs)
    return _sync_singleton


def _map_model(model: Optional[str]) -> str:
    if model and str(model).startswith("claude"):
        return model
    return DEFAULT_MODEL


def _split_messages(
    messages: Optional[List[dict]], response_format: Optional[dict]
) -> Tuple[Optional[str], List[dict]]:
    """Translate OpenAI-style messages into (system, anthropic_messages).

    Anthropic takes `system` as a separate top-level argument and only
    user/assistant turns in `messages`.
    """
    system_parts: List[str] = []
    convo: List[dict] = []
    for m in messages or []:
        role = m.get("role")
        content = m.get("content")
        if role == "system":
            if isinstance(content, str):
                system_parts.append(content)
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        system_parts.append(item.get("text", ""))
            continue
        a_role = "assistant" if role == "assistant" else "user"
        convo.append({"role": a_role, "content": content})

    # Anthropic has no native JSON mode; steer it via the system prompt so the
    # OpenAI-style response_format={"type":"json_object"} callers keep working.
    if isinstance(response_format, dict) and response_format.get("type") == "json_object":
        system_parts.append(
            "Respond with a single valid JSON object only. "
            "No prose, no markdown code fences, no commentary before or after the JSON."
        )

    system = "\n\n".join(p for p in system_parts if p) or None
    return system, convo


def _extract_text(message: Any) -> str:
    parts: List[str] = []
    for block in getattr(message, "content", None) or []:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", "") or "")
    return "".join(parts)


# ── OpenAI-shaped response shims ──────────────────────────────────────────────
class _Message:
    def __init__(self, content: str):
        self.content = content
        self.role = "assistant"


class _Choice:
    def __init__(self, content: str):
        self.message = _Message(content)
        self.finish_reason = "stop"
        self.index = 0


class _Usage:
    def __init__(self, prompt_tokens: int, completion_tokens: int):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)


class _Response:
    def __init__(self, content: str, usage: _Usage):
        self.choices = [_Choice(content)]
        self.usage = usage


def _to_response(message: Any) -> _Response:
    text = _extract_text(message)
    um = getattr(message, "usage", None)
    prompt_tokens = getattr(um, "input_tokens", 0) or 0 if um else 0
    completion_tokens = getattr(um, "output_tokens", 0) or 0 if um else 0
    return _Response(text, _Usage(prompt_tokens, completion_tokens))


# ── OpenAI-shaped streaming chunk shims ───────────────────────────────────────
class _Delta:
    def __init__(self, content: Optional[str]):
        self.content = content
        self.role = "assistant"


class _ChunkChoice:
    def __init__(self, content: Optional[str]):
        self.delta = _Delta(content)
        self.finish_reason = None
        self.index = 0


class _Chunk:
    def __init__(self, content: Optional[str]):
        self.choices = [_ChunkChoice(content)]


def _build_kwargs(
    model: Optional[str],
    system: Optional[str],
    convo: List[dict],
    max_tokens: Optional[int],
    temperature: Optional[float],
) -> dict:
    kwargs: dict = {
        "model": _map_model(model),
        "messages": convo,
        "max_tokens": int(max_tokens) if max_tokens is not None else _DEFAULT_MAX_TOKENS,
    }
    if system:
        kwargs["system"] = system
    if temperature is not None:
        kwargs["temperature"] = temperature
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
        **_: Any,
    ) -> Any:
        system, convo = _split_messages(messages, response_format)
        kwargs = _build_kwargs(model, system, convo, max_tokens, temperature)
        if stream:
            return self._stream(kwargs)
        message = await _aclient().messages.create(**kwargs)
        return _to_response(message)

    async def _stream(self, kwargs: dict):
        """Yield OpenAI-style streaming chunks (chunk.choices[0].delta.content)."""
        async with _aclient().messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                if text:
                    yield _Chunk(text)


class _AsyncChat:
    def __init__(self):
        self.completions = _AsyncCompletions()


class AsyncAnthropicClient:
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
        **_: Any,
    ) -> _Response:
        system, convo = _split_messages(messages, response_format)
        kwargs = _build_kwargs(model, system, convo, max_tokens, temperature)
        message = _sclient().messages.create(**kwargs)
        return _to_response(message)


class _SyncChat:
    def __init__(self):
        self.completions = _SyncCompletions()


class SyncAnthropicClient:
    """Drop-in replacement for openai.OpenAI (chat-completions subset)."""

    def __init__(self, *_, **__):
        self.chat = _SyncChat()
