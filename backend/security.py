"""
Kincaid Health — Security Hardening Layer v1.0
Rate limiting, login lockout, and brute-force protection.
"""
import time
import hashlib
from collections import defaultdict
from threading import Lock
from fastapi import Request, HTTPException
import logging

logger = logging.getLogger("kincaid.security")

# ── In-memory rate limiter ──────────────────────────────────────────────────
# { key: [timestamp, timestamp, ...] }
_rate_store: dict[str, list[float]] = defaultdict(list)
_rate_lock = Lock()

# ── Login lockout tracker ───────────────────────────────────────────────────
# { username_or_ip: {"count": int, "locked_until": float} }
_lockout_store: dict[str, dict] = defaultdict(lambda: {"count": 0, "locked_until": 0.0})
_lockout_lock = Lock()

LOGIN_MAX_ATTEMPTS = 10       # attempts before lockout
LOGIN_WINDOW_SECONDS = 300    # 5-minute window
LOGIN_LOCKOUT_SECONDS = 900   # 15-minute lockout


def _client_ip(request: Request) -> str:
    """Extract the real client IP, respecting proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, max_calls: int = 60, window: int = 60, key_prefix: str = "rl") -> None:
    """
    Generic sliding-window rate limiter.
    Raises HTTP 429 if the caller exceeds max_calls within window seconds.
    """
    ip = _client_ip(request)
    key = f"{key_prefix}:{ip}"
    now = time.time()

    with _rate_lock:
        # Drop timestamps outside the window
        _rate_store[key] = [t for t in _rate_store[key] if now - t < window]
        if len(_rate_store[key]) >= max_calls:
            logger.warning(f"[RATE LIMIT] {key} exceeded {max_calls} calls/{window}s")
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests — please wait {window} seconds before retrying.",
                headers={"Retry-After": str(window)},
            )
        _rate_store[key].append(now)


def check_login_lockout(username: str, ip: str) -> None:
    """Raise 429 if this username or IP is currently locked out."""
    for key in (f"login:{username}", f"login_ip:{ip}"):
        with _lockout_lock:
            record = _lockout_store[key]
            now = time.time()
            if record["locked_until"] > now:
                remaining = int(record["locked_until"] - now)
                logger.warning(f"[LOCKOUT] {key} — {remaining}s remaining")
                raise HTTPException(
                    status_code=429,
                    detail=f"Account temporarily locked due to too many failed attempts. "
                           f"Try again in {remaining // 60 + 1} minute(s).",
                    headers={"Retry-After": str(remaining)},
                )


def record_failed_login(username: str, ip: str) -> None:
    """Increment failed login counter; lock out if threshold exceeded."""
    now = time.time()
    for key in (f"login:{username}", f"login_ip:{ip}"):
        with _lockout_lock:
            record = _lockout_store[key]
            # Reset window if it's been longer than the window since first failure
            if now - record.get("window_start", 0) > LOGIN_WINDOW_SECONDS:
                record["count"] = 0
                record["window_start"] = now
            record["count"] += 1
            if record["count"] >= LOGIN_MAX_ATTEMPTS:
                record["locked_until"] = now + LOGIN_LOCKOUT_SECONDS
                logger.warning(
                    f"[LOCKOUT TRIGGERED] {key} — {LOGIN_MAX_ATTEMPTS} failures → "
                    f"locked for {LOGIN_LOCKOUT_SECONDS}s"
                )


def clear_login_failures(username: str, ip: str) -> None:
    """Clear failure counters on successful login."""
    for key in (f"login:{username}", f"login_ip:{ip}"):
        with _lockout_lock:
            _lockout_store[key] = {"count": 0, "locked_until": 0.0}


def mask_sensitive(value: str, show: int = 4) -> str:
    """Mask a sensitive string for logging."""
    if len(value) <= show:
        return "***"
    return value[:show] + "***"


def sha256_hex(data: str) -> str:
    """Return SHA-256 hex digest of a string."""
    return hashlib.sha256(data.encode()).hexdigest()
