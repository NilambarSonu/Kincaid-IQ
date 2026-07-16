"""
Kincaid Health — per-file evidence manifest helpers (Hard Rule #03).

Hard Rule #03 requires that *every* export carry a SHA-256 evidence manifest.
The unified Client Package builder in `export_router.py` does this with an
in-zip `manifest.json`; this module provides the lighter-weight **sidecar
header** form (`X-Kincaid-SHA256`) for endpoints that stream a single file
straight to the browser (DOCX, PDF, CSV, etc.).

It also exposes a registry (`MANIFEST_COMPLIANT_PATHS`) so the Administration
Panel route registry can show which export endpoints are manifest-compliant.
"""
from __future__ import annotations

import hashlib
from typing import Optional

MANIFEST_COMPLIANT_PATHS: set[str] = set()


def register_manifest_path(path: str) -> str:
    """Mark a route path as Hard Rule #03 compliant (single-file SHA-256 sidecar
    or ZIP+manifest.json). Call once at import time per endpoint."""
    MANIFEST_COMPLIANT_PATHS.add(path)
    return path


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


_EXPOSED = (
    "X-Kincaid-SHA256,"
    "X-Kincaid-Manifest,"
    "X-Kincaid-Hash-Algorithm,"
    "X-Kincaid-Size-Bytes,"
    "Content-Disposition"
)


def manifest_headers(
    data: bytes,
    filename: Optional[str] = None,
    extra: Optional[dict] = None,
) -> dict:
    """
    Build response headers that carry a per-file SHA-256 evidence record —
    the sidecar form of Hard Rule #03. Use on any single-file download.

    The browser-facing JS layer can read these headers (CORS-exposed below)
    and surface the hash in the UI for tamper-verification.
    """
    h: dict[str, str] = {
        "X-Kincaid-SHA256":              sha256_hex(data),
        "X-Kincaid-Manifest":            "sidecar-v1",
        "X-Kincaid-Hash-Algorithm":      "SHA-256",
        "X-Kincaid-Size-Bytes":          str(len(data)),
        "Access-Control-Expose-Headers": _EXPOSED,
    }
    if filename:
        h["Content-Disposition"] = f'attachment; filename="{filename}"'
    if extra:
        h.update(extra)
    return h
