"""
Gemini compatibility shim.

Provides a tiny subset of the OpenAI Python SDK surface
(`client.chat.completions.create(...)` -> `resp.choices[0].message.content`)
backed by Google Gemini via Replit AI Integrations.

This lets the existing routers keep their OpenAI-style call sites unchanged
while routing all LLM traffic to Gemini. The Replit Gemini gateway only
speaks the native `generateContent` protocol (not OpenAI chat/completions),
so we translate here.

Usage (drop-in):
    from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
    client = AsyncOpenAI(api_key=..., base_url=...)   # args ignored
    resp = await client.chat.completions.create(
        model="gemini-2.5-flash",
        messages=[{"role": "system", "content": ...}, {"role": "user", "content": ...}],
        temperature=0.3,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )
    text = resp.choices[0].message.content
"""
import base64
import os
from typing import Any, List, Optional

from google import genai
from google.genai import types

# Prefer Replit's AI Integrations Gemini gateway when present; otherwise fall back
# to a direct Google Gemini key (GEMINI_API_KEY / GOOGLE_API_KEY) so the app runs
# on AWS or any host. When no custom base URL is set we let the SDK hit Google's
# public Gemini endpoint directly.
_API_KEY = (
    os.environ.get("AI_INTEGRATIONS_GEMINI_API_KEY")
    or os.environ.get("GEMINI_API_KEY")
    or os.environ.get("GOOGLE_API_KEY", "")
)
_BASE_URL = os.environ.get("AI_INTEGRATIONS_GEMINI_BASE_URL", "")

# Default model for any non-Gemini identifier (e.g. legacy "gpt-4o").
DEFAULT_MODEL = "gemini-2.5-flash"

# Gemini 2.5 spends part of its output budget on internal "thinking" tokens,
# so very low caps can yield empty text. Never cap below this floor.
_MIN_OUTPUT_TOKENS = 8192

_client_singleton: Optional["genai.Client"] = None


def _client() -> "genai.Client":
    global _client_singleton
    if _client_singleton is None:
        if _BASE_URL:
            # Replit AI Integrations gateway (custom endpoint, empty api_version).
            _client_singleton = genai.Client(
                api_key=_API_KEY,
                http_options=types.HttpOptions(base_url=_BASE_URL, api_version=""),
            )
        else:
            # Direct Google Gemini endpoint (AWS / any host) — SDK defaults apply.
            _client_singleton = genai.Client(api_key=_API_KEY)
    return _client_singleton


def _map_model(model: Optional[str]) -> str:
    if model and str(model).startswith("gemini"):
        return model
    return DEFAULT_MODEL


def _content_to_parts(content: Any) -> List["types.Part"]:
    if isinstance(content, str):
        return [types.Part(text=content)]
    if isinstance(content, list):
        parts: List[types.Part] = []
        for item in content:
            if isinstance(item, dict):
                itype = item.get("type")
                if itype == "text":
                    parts.append(types.Part(text=item.get("text", "")))
                elif itype == "image_url":
                    url = (item.get("image_url") or {}).get("url", "")
                    if url.startswith("data:") and "," in url:
                        header, b64 = url.split(",", 1)
                        mime = header.split(";")[0].replace("data:", "") or "image/png"
                        parts.append(
                            types.Part(
                                inline_data=types.Blob(
                                    mime_type=mime, data=base64.b64decode(b64)
                                )
                            )
                        )
                else:
                    parts.append(types.Part(text=str(item)))
            else:
                parts.append(types.Part(text=str(item)))
        return parts or [types.Part(text="")]
    return [types.Part(text=str(content))]


def _split_messages(messages: Optional[List[dict]]):
    """Translate OpenAI-style messages into (system_instruction, contents)."""
    system_parts: List[str] = []
    contents: List[types.Content] = []
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
        g_role = "model" if role == "assistant" else "user"
        contents.append(types.Content(role=g_role, parts=_content_to_parts(content)))
    system_instruction = "\n\n".join(p for p in system_parts if p) or None
    return system_instruction, contents


def _build_config(
    system_instruction: Optional[str],
    max_tokens: Optional[int],
    temperature: Optional[float],
    response_format: Optional[dict],
) -> "types.GenerateContentConfig":
    kwargs: dict = {}
    if system_instruction:
        kwargs["system_instruction"] = system_instruction
    if max_tokens is not None:
        kwargs["max_output_tokens"] = max(int(max_tokens), _MIN_OUTPUT_TOKENS)
    if temperature is not None:
        kwargs["temperature"] = temperature
    if (
        isinstance(response_format, dict)
        and response_format.get("type") == "json_object"
    ):
        kwargs["response_mime_type"] = "application/json"
    return types.GenerateContentConfig(**kwargs)


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


def _to_response(g: Any) -> _Response:
    text = getattr(g, "text", None) or ""
    prompt_tokens = completion_tokens = 0
    um = getattr(g, "usage_metadata", None)
    if um is not None:
        prompt_tokens = getattr(um, "prompt_token_count", 0) or 0
        completion_tokens = getattr(um, "candidates_token_count", 0) or 0
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
        system_instruction, contents = _split_messages(messages)
        config = _build_config(system_instruction, max_tokens, temperature, response_format)
        mapped_model = _map_model(model)
        if stream:
            return self._stream(mapped_model, contents, config)
        g = await _client().aio.models.generate_content(
            model=mapped_model, contents=contents, config=config
        )
        return _to_response(g)

    async def _stream(self, model: str, contents: Any, config: Any):
        """Yield OpenAI-style streaming chunks (chunk.choices[0].delta.content)."""
        iterator = await _client().aio.models.generate_content_stream(
            model=model, contents=contents, config=config
        )
        async for g in iterator:
            text = getattr(g, "text", None)
            if text:
                yield _Chunk(text)


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
        **_: Any,
    ) -> _Response:
        system_instruction, contents = _split_messages(messages)
        config = _build_config(system_instruction, max_tokens, temperature, response_format)
        g = _client().models.generate_content(
            model=_map_model(model), contents=contents, config=config
        )
        return _to_response(g)


class _SyncChat:
    def __init__(self):
        self.completions = _SyncCompletions()


class SyncGeminiClient:
    """Drop-in replacement for openai.OpenAI (chat-completions subset)."""

    def __init__(self, *_, **__):
        self.chat = _SyncChat()
