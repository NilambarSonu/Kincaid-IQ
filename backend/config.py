from pydantic_settings import BaseSettings
from typing import Optional, List
import os
import json
import copy
import logging
import warnings
from dotenv import load_dotenv

logger = logging.getLogger("kincaid.config")

# Load the project .env before any module-level settings are derived. Pydantic
# also reads .env later, but several helpers below intentionally consult
# os.environ during import.
load_dotenv(override=False)

# Backward-compatible aliases for the existing local .env. boto3 and botocore
# read the standard AWS_* variables, while this project historically used the
# shorter ACCESS_KEY / SECRET_ACCESS_KEY names.
if os.environ.get("ACCESS_KEY") and not os.environ.get("AWS_ACCESS_KEY_ID"):
    os.environ["AWS_ACCESS_KEY_ID"] = os.environ["ACCESS_KEY"]
if os.environ.get("SECRET_ACCESS_KEY") and not os.environ.get("AWS_SECRET_ACCESS_KEY"):
    os.environ["AWS_SECRET_ACCESS_KEY"] = os.environ["SECRET_ACCESS_KEY"]


def _is_production() -> bool:
    """Production detection that works on Replit AND any external host (AWS, etc.).

    Replit sets ``REPLIT_DEPLOYMENT=1`` automatically in deployments. Off-Replit
    there is no such signal, so set ``APP_ENV=production`` (or ``ENVIRONMENT=
    production``) on the host. Without this, an AWS container would silently run
    in development mode — CORS ``["*"]`` and non-secure cookies — which is unsafe.
    """
    if os.environ.get("REPLIT_DEPLOYMENT", "") == "1":
        return True
    env = (os.environ.get("APP_ENV") or os.environ.get("ENVIRONMENT") or "").strip().lower()
    return env in ("production", "prod")


def _app_base_url() -> str:
    """Public base URL of the deployment.

    ``APP_BASE_URL`` is the portable, host-agnostic setting (use it on AWS).
    ``REPLIT_DEPLOYMENT_URL`` is honored as a Replit fallback. Defaults to the
    local dev server.
    """
    return (
        os.environ.get("APP_BASE_URL")
        or os.environ.get("REPLIT_DEPLOYMENT_URL")
        or "http://localhost:5000"
    ).rstrip("/")


def _get_cors_origins() -> List[str]:
    # An explicit comma-separated allow-list always wins. This is the recommended
    # way to lock down origins on AWS, e.g. CORS_ORIGINS="https://app.example.com".
    explicit = os.environ.get("CORS_ORIGINS", "").strip()
    if explicit:
        return [o.strip().rstrip("/") for o in explicit.split(",") if o.strip()]

    if _is_production():
        origins: List[str] = []
        base = os.environ.get("APP_BASE_URL", "").strip()
        if base:
            origins.append(base.rstrip("/"))
        deployment_url = os.environ.get("REPLIT_DEPLOYMENT_URL", "")
        if deployment_url:
            origins.append(deployment_url.rstrip("/"))
        repl_slug = os.environ.get("REPL_SLUG", "")
        repl_owner = os.environ.get("REPL_OWNER", "")
        if repl_slug and repl_owner:
            origins.append(f"https://{repl_slug}.{repl_owner}.repl.co")
            origins.append(f"https://{repl_slug}-{repl_owner}.replit.app")
        # De-duplicate while preserving order.
        seen: set = set()
        deduped = [o for o in origins if not (o in seen or seen.add(o))]
        if deduped:
            return deduped
        return ["https://*.replit.app", "https://*.repl.co"]
    return ["*"]


_FALLBACK_SECRET = "kincaid-iq-secret-key-change-in-production"
_SECRET_KEY = os.environ.get("SESSION_SECRET", _FALLBACK_SECRET)
_IS_PRODUCTION = _is_production()

if _SECRET_KEY == _FALLBACK_SECRET:
    if _IS_PRODUCTION:
        raise RuntimeError(
            "CRITICAL: SESSION_SECRET is not set — refusing to start in production "
            "with the default insecure key. Set the SESSION_SECRET environment variable."
        )
    else:
        warnings.warn(
            "[Kincaid Health] SESSION_SECRET not set — using insecure fallback key. "
            "This is only acceptable in development.",
            stacklevel=1,
        )


class Settings(BaseSettings):
    database_url: str = os.environ.get("DATABASE_URL", "")
    secret_key: str = _SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    cors_origins: List[str] = _get_cors_origins()

    google_client_id: Optional[str] = os.environ.get("GOOGLE_CLIENT_ID")
    google_client_secret: Optional[str] = os.environ.get("GOOGLE_CLIENT_SECRET")

    github_client_id: Optional[str] = os.environ.get("GITHUB_CLIENT_ID")
    github_client_secret: Optional[str] = os.environ.get("GITHUB_CLIENT_SECRET")

    # Prefer Replit's AI Integrations gateway when present; otherwise fall back to
    # a direct vendor key (OPENAI_API_KEY / ANTHROPIC_API_KEY) so the app runs on
    # AWS or any host. When no base URL is set the SDKs hit the vendor's public
    # endpoint directly.
    openai_api_key: str = (
        os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY")
        or os.environ.get("OPENAI_API_KEY", "")
    )
    openai_base_url: Optional[str] = (
        os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
        or os.environ.get("OPENAI_BASE_URL")
        or None
    )
    anthropic_api_key: str = (
        os.environ.get("AI_INTEGRATIONS_ANTHROPIC_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY", "")
    )
    anthropic_base_url: Optional[str] = (
        os.environ.get("AI_INTEGRATIONS_ANTHROPIC_BASE_URL")
        or os.environ.get("ANTHROPIC_BASE_URL")
        or None
    )

    base_url: str = _app_base_url()

    rfp_recalibrate_threshold: int = int(os.environ.get("RFP_RECALIBRATE_THRESHOLD", "10"))

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()


# ── RFP Opportunity Scoring configuration ──────────────────────────────────────
#
# Every weight, tier threshold, factor band cutoff, and the national-incumbent
# firm list used by the 7-factor opportunity scorer in
# backend/routers/rfp_intake.py lives here as the single tuning surface.
#
# To retune the model WITHOUT a code change, set the RFP_SCORING_CONFIG
# environment variable (or RFP_SCORING_CONFIG_FILE pointing at a JSON file) to a
# JSON object that overrides any subset of these defaults. The override is deep-
# merged onto the defaults, so you only need to specify the keys you want to
# change. Example:
#
#   RFP_SCORING_CONFIG='{"tier_thresholds": {"pursue_aggressively": 80},
#                        "weights": {"revenue_potential": 0.25}}'
#
# When nothing is overridden, behavior is identical to the previous hardcoded
# constants.
RFP_SCORING_DEFAULTS: dict = {
    # Composite weights — should sum to ~1.0.
    "weights": {
        "revenue_potential":         0.22,
        "strategic_value":           0.18,
        "win_probability":           0.18,
        "relationship_strength":     0.15,
        "competitive_intensity":     0.12,
        "data_availability":         0.10,
        "implementation_complexity": 0.05,
    },
    # Composite → tier cutoffs (a score >= threshold lands in that tier).
    # Below the lowest ("monitor") threshold → "decline".
    "tier_thresholds": {
        "pursue_aggressively": 78,
        "pursue_selectively":  58,
        "monitor":             38,
    },
    # Industries that earn the strategic-vertical bonus (matched as substrings,
    # case-insensitive).
    "high_value_industries": [
        "healthcare", "education", "finance", "government", "manufacturing",
    ],
    # Plan types that signal elevated fiduciary advisory scope.
    "complex_plan_types": [
        "self-funded", "self_funded", "level-funded", "level_funded",
    ],
    # Revenue-potential factor band cutoffs.
    "revenue": {
        "ecv_top":           5_000_000, "ecv_top_score":    95,
        "ecv_strong":        2_000_000, "ecv_strong_score": 82,
        "ecv_solid":           500_000, "ecv_solid_score":  68,
        "ecv_positive_score":       48,
        "lives_large":            1000, "lives_large_score": 75,
        "lives_mid":               300, "lives_mid_score":   58,
        "lives_positive_score":     38,
        "no_data_score":            20,
    },
    # Strategic-value factor: base + additive signal bonuses, capped.
    "strategic_value": {
        "base":                       50,
        "industry_bonus":             20,
        "complex_plan_bonus":         15,
        "large_plan_lives":          500, "large_plan_bonus": 10,
        "defined_pbm_bonus":           5,
        "cap":                        98,
    },
    # Win-probability factor: base ± parse-confidence band and due-date window.
    "win_probability": {
        "base":                       50,
        "conf_high":                  75, "conf_high_delta":   20,
        "conf_mid":                   40, "conf_mid_delta":      5,
        "conf_low_delta":            -10,
        "due_ample_days":             30, "due_ample_delta":    10,
        "due_tight_days":             14, "due_tight_delta":     3,
        "due_compressed_delta":      -10,
        "due_passed_delta":          -20,
        "floor":                       5, "cap":               95,
    },
    # Relationship-strength factor: incumbent displacement difficulty.
    "relationship_strength": {
        "no_incumbent_score":         60,
        "national_score":             28,
        "regional_score":             52,
        "unknown_score":              60,
        # Known large national firms — high displacement barrier.
        "national_firms": [
            "mercer", "aon", "willis", "wtw", "gallagher",
            "lockton", "bswift", "bentek",
        ],
    },
    # Competitive-intensity factor (higher score = easier to win).
    "competitive_intensity": {
        "base":                       70,
        "wide_states":                 5, "wide_states_delta": -20,
        "multi_states_delta":         -8,
        "single_state_delta":          5,
        "enterprise_lives":         2000, "enterprise_delta":  -15,
        "mid_lives":                 500, "mid_delta":          -5,
        "small_lives":               200, "small_delta":        10,
        "floor":                      10, "cap":                95,
    },
    # Data-availability factor: rationale band cutoffs (score is % of key fields).
    "data_availability": {
        "high_band":                  80,
        "moderate_band":              55,
        "sparse_band":                30,
    },
    # Implementation-complexity factor: max minus stacked penalties.
    "implementation_complexity": {
        "max_score":                  95,
        "wide_states":                 5, "wide_states_penalty":   25,
        "multi_states":                2, "multi_states_penalty":  10,
        "large_lives":              2000, "large_lives_penalty":   20,
        "mid_lives":                 500, "mid_lives_penalty":       5,
        "many_reqs":                   7, "many_reqs_penalty":     10,
        "floor":                      10,
    },
    # Confidence gate (data-availability % required for a MODELED finding;
    # below this → INSUFFICIENT_EVIDENCE).
    "confidence": {
        "modeled_min":                40,
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge `override` into `base` in place and return it."""
    for key, val in override.items():
        if isinstance(val, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], val)
        else:
            base[key] = val
    return base


# Weights are allowed to drift this far from a 1.0 sum before it counts as a
# misconfiguration (the composite is a plain weighted sum — no normalization —
# so a wrong total silently scales every score).
_WEIGHT_SUM_TOLERANCE = 0.01


def _is_number(val) -> bool:
    """True for real ints/floats only (bool is an int subclass — exclude it)."""
    return isinstance(val, (int, float)) and not isinstance(val, bool)


def _validate_rfp_scoring(cfg: dict) -> List[str]:
    """Check a (already merged) scoring config for the failure modes a typo'd
    override introduces. Returns a list of human-readable problems — empty means
    the config is sound.

    Validated:
      * Structural parity with RFP_SCORING_DEFAULTS — every key present, dicts
        stay dicts, lists stay lists, and every numeric default stays numeric
        (catches a key dropped or clobbered by a partial override).
      * Composite `weights` are all numeric and sum to ~1.0 within tolerance.
      * `tier_thresholds` are numeric and strictly descending
        (pursue_aggressively > pursue_selectively > monitor).
    """
    problems: List[str] = []

    def _check_shape(defaults: dict, active: dict, path: str) -> None:
        for key, default_val in defaults.items():
            dotted = f"{path}.{key}" if path else key
            if key not in active:
                problems.append(f"missing key '{dotted}'")
                continue
            actual = active[key]
            if isinstance(default_val, dict):
                if not isinstance(actual, dict):
                    problems.append(
                        f"'{dotted}' must be an object, got {type(actual).__name__}"
                    )
                else:
                    _check_shape(default_val, actual, dotted)
            elif isinstance(default_val, list):
                if not isinstance(actual, list):
                    problems.append(
                        f"'{dotted}' must be a list, got {type(actual).__name__}"
                    )
            elif _is_number(default_val):
                if not _is_number(actual):
                    problems.append(
                        f"'{dotted}' must be numeric, got {actual!r}"
                    )

    _check_shape(RFP_SCORING_DEFAULTS, cfg, "")

    # Composite weights must sum to ~1.0.
    weights = cfg.get("weights")
    if isinstance(weights, dict):
        numeric_weights = {k: v for k, v in weights.items() if _is_number(v)}
        if len(numeric_weights) == len(weights) and weights:
            total = sum(numeric_weights.values())
            if abs(total - 1.0) > _WEIGHT_SUM_TOLERANCE:
                problems.append(
                    f"'weights' sum to {total:.4f}, expected ~1.0 "
                    f"(±{_WEIGHT_SUM_TOLERANCE})"
                )

    # Tier thresholds must be strictly descending in their defined order.
    thresholds = cfg.get("tier_thresholds")
    if isinstance(thresholds, dict):
        order = list(RFP_SCORING_DEFAULTS["tier_thresholds"].keys())
        vals = [(k, thresholds.get(k)) for k in order]
        if all(_is_number(v) for _, v in vals):
            for (hk, hv), (lk, lv) in zip(vals, vals[1:]):
                if not hv > lv:
                    problems.append(
                        f"'tier_thresholds' must be strictly descending: "
                        f"'{hk}' ({hv}) must be greater than '{lk}' ({lv})"
                    )

    return problems


# Snapshot of the most recent _load_rfp_scoring() outcome, surfaced to admins
# via the Administration panel so a non-technical operator can confirm whether
# their custom tuning is live or was rejected at startup. Populated by
# _load_rfp_scoring(); never contains the override values themselves.
RFP_SCORING_HEALTH: dict = {
    "status": "defaults",
    "override_present": False,
    "source": None,
    "override_keys": [],
    "problems": [],
    "message": "No RFP_SCORING_CONFIG override set — using built-in defaults.",
}


# Persistent store for an admin-saved override (edited from the Administration
# Panel). Lives in the project-root `data/` dir alongside other runtime data.
# Env overrides (RFP_SCORING_CONFIG / RFP_SCORING_CONFIG_FILE) take precedence
# over this file so the env var remains the documented emergency lever.
RFP_SCORING_OVERRIDE_PATH = os.environ.get(
    "RFP_SCORING_OVERRIDE_PATH",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "rfp_scoring_override.json",
    ),
)


# The admin override is persisted to Postgres (``rfp_scoring_overrides``,
# singleton row key='active') so edits survive restarts on ephemeral-filesystem
# hosts (e.g. AWS App Runner). The local JSON file at RFP_SCORING_OVERRIDE_PATH
# remains a fallback for local dev / DB-less runs. DB access is disabled at
# import time (the engine/tables may not exist yet) and enabled by
# ``enable_db_override()`` once startup has created the tables.
_db_override_enabled = False


def enable_db_override() -> None:
    """Allow the override resolver to consult the Postgres-backed admin override.
    Called once at startup after tables are created."""
    global _db_override_enabled
    _db_override_enabled = True


def _read_db_override_raw() -> str:
    """Return the singleton admin override as a raw JSON string from Postgres, or
    ``""`` when unavailable (disabled, DB down, table missing, or no row). Never
    raises."""
    if not _db_override_enabled:
        return ""
    try:
        from backend.database import SessionLocal
        from backend import models
        with SessionLocal() as db:
            row = (
                db.query(models.RfpScoringOverride)
                .filter(models.RfpScoringOverride.key == "active")
                .first()
            )
            if row and isinstance(row.config, dict) and row.config:
                return json.dumps(row.config)
    except Exception as e:
        logger.warning("[Kincaid Health] Could not read RFP override from DB: %s", e)
    return ""


def _write_db_override(override: dict, updated_by: Optional[str] = None) -> None:
    """Upsert the singleton admin override row in Postgres. Raises on failure so
    the caller can surface a persistence error."""
    from backend.database import SessionLocal
    from backend import models
    with SessionLocal() as db:
        row = (
            db.query(models.RfpScoringOverride)
            .filter(models.RfpScoringOverride.key == "active")
            .first()
        )
        if row is None:
            db.add(models.RfpScoringOverride(key="active", config=override, updated_by=updated_by))
        else:
            row.config = override
            row.updated_by = updated_by
        db.commit()


def _delete_db_override() -> None:
    """Remove the singleton admin override row from Postgres (if present). Never
    raises."""
    try:
        from backend.database import SessionLocal
        from backend import models
        with SessionLocal() as db:
            db.query(models.RfpScoringOverride).filter(
                models.RfpScoringOverride.key == "active"
            ).delete()
            db.commit()
    except Exception as e:
        logger.warning("[Kincaid Health] Could not delete RFP override from DB: %s", e)


def _resolve_override_raw() -> tuple[str, str]:
    """Return ``(raw_json, source_label)`` for the highest-precedence override
    source: inline env > env file > DB admin override > admin-saved file > none."""
    raw = os.environ.get("RFP_SCORING_CONFIG", "").strip()
    if raw:
        return raw, "RFP_SCORING_CONFIG (env)"

    path = os.environ.get("RFP_SCORING_CONFIG_FILE", "").strip()
    if path:
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read().strip(), f"RFP_SCORING_CONFIG_FILE ({path})"
        except Exception as e:
            logger.warning("[Kincaid Health] Could not read RFP_SCORING_CONFIG_FILE %s: %s", path, e)

    db_raw = _read_db_override_raw()
    if db_raw:
        return db_raw, "admin override (database)"

    try:
        if os.path.exists(RFP_SCORING_OVERRIDE_PATH):
            with open(RFP_SCORING_OVERRIDE_PATH, "r", encoding="utf-8") as fh:
                return fh.read().strip(), f"admin override ({RFP_SCORING_OVERRIDE_PATH})"
    except Exception as e:
        logger.warning("[Kincaid Health] Could not read admin RFP override %s: %s", RFP_SCORING_OVERRIDE_PATH, e)

    return "", "defaults"


def env_override_active() -> bool:
    """True when an env-based override is shadowing any admin-saved file. The
    Admin Panel surfaces this so editors know their save won't survive a restart
    while the env var is set."""
    if os.environ.get("RFP_SCORING_CONFIG", "").strip():
        return True
    return bool(os.environ.get("RFP_SCORING_CONFIG_FILE", "").strip())


def _load_rfp_scoring() -> dict:
    """Build the active scoring config: defaults deep-merged with any override
    from RFP_SCORING_CONFIG (inline JSON), RFP_SCORING_CONFIG_FILE (path), or the
    admin-saved override file — in that order of precedence.

    The merged config is validated; on any hard failure the offending keys are
    logged and the override is discarded in favor of the known-good defaults so
    scoring never runs on a silently-broken config.

    Also records the outcome in the module-level RFP_SCORING_HEALTH dict for the
    Administration panel."""
    cfg = copy.deepcopy(RFP_SCORING_DEFAULTS)
    health = {
        "status": "defaults",
        "override_present": False,
        "source": None,
        "override_keys": [],
        "problems": [],
        "message": "No RFP_SCORING_CONFIG override set — using built-in defaults.",
    }

    raw, source = _resolve_override_raw()
    if not raw:
        source = None

    if raw:
        health["override_present"] = True
        health["source"] = source
        try:
            override = json.loads(raw)
            if isinstance(override, dict):
                health["override_keys"] = sorted(override.keys())
                _deep_merge(cfg, override)
                problems = _validate_rfp_scoring(cfg)
                if problems:
                    logger.error(
                        "[Kincaid Health] RFP scoring override from %s is invalid; "
                        "falling back to defaults. %d problem(s):",
                        source, len(problems),
                    )
                    for p in problems:
                        logger.error("[Kincaid Health]   - %s", p)
                    health.update({
                        "status": "invalid",
                        "problems": problems,
                        "message": (
                            f"Override from {source} was rejected "
                            f"({len(problems)} problem(s)); using defaults."
                        ),
                    })
                    RFP_SCORING_HEALTH.clear()
                    RFP_SCORING_HEALTH.update(health)
                    return copy.deepcopy(RFP_SCORING_DEFAULTS)
                logger.info(
                    "[Kincaid Health] Applied RFP scoring override from %s (%d top-level keys).",
                    source, len(override),
                )
                health.update({
                    "status": "applied",
                    "message": (
                        f"Override from {source} applied "
                        f"({len(override)} top-level key(s))."
                    ),
                })
            else:
                logger.warning("[Kincaid Health] RFP scoring override (%s) must be a JSON object; ignoring.", source)
                health.update({
                    "status": "error",
                    "message": f"{source} must be a JSON object; ignored — using defaults.",
                })
        except Exception as e:
            logger.warning("[Kincaid Health] Invalid RFP scoring override JSON from %s; using defaults. (%s)", source, e)
            health.update({
                "status": "error",
                "message": f"Invalid JSON in {source}: {e}; using defaults.",
            })

    RFP_SCORING_HEALTH.clear()
    RFP_SCORING_HEALTH.update(health)
    return cfg


RFP_SCORING: dict = _load_rfp_scoring()


# ── Live reload of the active scoring config (no restart) ──────────────────────
#
# RFP_SCORING is imported by reference into backend/routers/rfp_intake.py, whose
# factor functions read it live AND which derives a few module-level constants
# (SCORE_WEIGHTS, TIER_THRESHOLDS, …) once at import time. When the admin saves a
# new config we mutate RFP_SCORING IN PLACE (clear + update) so live references
# stay valid, then notify listeners so the derived constants are re-computed.
_rfp_scoring_listeners: list = []


def register_rfp_scoring_listener(fn) -> None:
    """Register a callback invoked with the active RFP_SCORING dict whenever the
    config is reloaded. Fires immediately so late registrants are in sync."""
    _rfp_scoring_listeners.append(fn)
    try:
        fn(RFP_SCORING)
    except Exception:
        logger.exception("[Kincaid Health] RFP scoring listener failed on register")


def _notify_rfp_scoring_listeners() -> None:
    for fn in _rfp_scoring_listeners:
        try:
            fn(RFP_SCORING)
        except Exception:
            logger.exception("[Kincaid Health] RFP scoring reload listener failed")


def _apply_in_place(merged: dict) -> None:
    RFP_SCORING.clear()
    RFP_SCORING.update(merged)
    _notify_rfp_scoring_listeners()


def get_rfp_scoring_override() -> Optional[dict]:
    """Return the persisted admin override dict (Postgres-backed, local JSON file
    as fallback), or None when no admin override exists. Env-based overrides are
    not returned here."""
    db_raw = _read_db_override_raw()
    if db_raw:
        try:
            data = json.loads(db_raw)
            return data if isinstance(data, dict) else None
        except Exception as e:
            logger.warning("[Kincaid Health] Could not parse RFP override from DB: %s", e)
    try:
        if os.path.exists(RFP_SCORING_OVERRIDE_PATH):
            with open(RFP_SCORING_OVERRIDE_PATH, "r", encoding="utf-8") as fh:
                data = json.loads(fh.read() or "{}")
                return data if isinstance(data, dict) else None
    except Exception as e:
        logger.warning("[Kincaid Health] Could not read admin RFP override %s: %s", RFP_SCORING_OVERRIDE_PATH, e)
    return None


def save_rfp_scoring(override: dict, persist: bool = True, updated_by: Optional[str] = None) -> List[str]:
    """Validate ``override`` (deep-merged onto the defaults) with the SAME
    ``_validate_rfp_scoring`` rules used at startup. On a clean result, apply it
    to the live RFP_SCORING dict in place (taking effect without a restart) and
    persist it to Postgres (``rfp_scoring_overrides``) so it survives restarts on
    ephemeral-filesystem hosts, plus best-effort to the local JSON file. Returns
    the list of validation problems — an empty list means the save succeeded.

    Nothing is persisted or applied when validation fails."""
    if not isinstance(override, dict):
        return ["override must be a JSON object"]

    merged = copy.deepcopy(RFP_SCORING_DEFAULTS)
    _deep_merge(merged, override)
    problems = _validate_rfp_scoring(merged)
    if problems:
        return problems

    if persist:
        db_ok = False
        try:
            _write_db_override(override, updated_by=updated_by)
            db_ok = True
        except Exception as e:
            logger.warning("[Kincaid Health] Could not persist RFP override to DB: %s", e)
        try:
            os.makedirs(os.path.dirname(RFP_SCORING_OVERRIDE_PATH), exist_ok=True)
            with open(RFP_SCORING_OVERRIDE_PATH, "w", encoding="utf-8") as fh:
                json.dump(override, fh, indent=2, sort_keys=True)
        except Exception as e:
            if not db_ok:
                return [f"could not persist override (DB and file both failed): {e}"]
            logger.warning("[Kincaid Health] Persisted RFP override to DB but not to file: %s", e)

    _apply_in_place(merged)
    logger.info("[Kincaid Health] RFP scoring config updated via admin editor and reloaded live.")
    return []


def reset_rfp_scoring() -> None:
    """Drop the admin override (Postgres row and local JSON file, if any) and
    reload the active config from env/defaults, applying it live."""
    _delete_db_override()
    try:
        if os.path.exists(RFP_SCORING_OVERRIDE_PATH):
            os.remove(RFP_SCORING_OVERRIDE_PATH)
    except Exception as e:
        logger.warning("[Kincaid Health] Could not remove admin RFP override %s: %s", RFP_SCORING_OVERRIDE_PATH, e)
    _apply_in_place(_load_rfp_scoring())
    logger.info("[Kincaid Health] RFP scoring config reset to env/defaults and reloaded live.")
