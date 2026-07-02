import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger("kincaid.stripe")

_cached_credentials: Optional[dict] = None


async def _fetch_stripe_credentials_from_connector() -> dict:
    """Fetch Stripe API keys from the Replit connector API."""
    hostname = os.environ.get("REPLIT_CONNECTORS_HOSTNAME")
    if not hostname:
        raise ValueError("REPLIT_CONNECTORS_HOSTNAME not set")

    repl_identity = os.environ.get("REPL_IDENTITY")
    web_repl_renewal = os.environ.get("WEB_REPL_RENEWAL")

    if repl_identity:
        token = f"repl {repl_identity}"
    elif web_repl_renewal:
        token = f"depl {web_repl_renewal}"
    else:
        raise ValueError("No Replit authentication token found (REPL_IDENTITY or WEB_REPL_RENEWAL)")

    is_production = os.environ.get("REPLIT_DEPLOYMENT") == "1"
    target_env = "production" if is_production else "development"

    url = f"https://{hostname}/api/v2/connection"
    params = {
        "include_secrets": "true",
        "connector_names": "stripe",
        "environment": target_env,
    }
    headers = {
        "Accept": "application/json",
        "X-Replit-Token": token,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

    items = data.get("items", [])
    if not items:
        raise ValueError(f"Stripe {target_env} connection not found in Replit connector")

    settings = items[0].get("settings", {})
    publishable = settings.get("publishable")
    secret = settings.get("secret")

    if not publishable or not secret:
        raise ValueError("Stripe credentials missing from connector settings")

    return {
        "publishable_key": publishable,
        "secret_key": secret,
    }


def _get_stripe_credentials_sync() -> dict:
    """Synchronously get Stripe credentials, trying connector then environment fallback."""
    import asyncio

    # Try environment variables first (manual override)
    secret_key = os.environ.get("STRIPE_SECRET_KEY", "")
    publishable_key = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
    if secret_key:
        return {"secret_key": secret_key, "publishable_key": publishable_key}

    # Try Replit connector
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _fetch_stripe_credentials_from_connector())
                return future.result(timeout=15)
        else:
            return loop.run_until_complete(_fetch_stripe_credentials_from_connector())
    except Exception as e:
        logger.error(f"Failed to fetch Stripe credentials: {e}")
        raise


async def get_stripe_credentials() -> dict:
    """Get Stripe credentials (connector-first, env fallback)."""
    # Try environment variables first
    secret_key = os.environ.get("STRIPE_SECRET_KEY", "")
    publishable_key = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
    if secret_key:
        return {"secret_key": secret_key, "publishable_key": publishable_key}

    return await _fetch_stripe_credentials_from_connector()


def get_stripe_client():
    """Get a configured Stripe client. Returns None if Stripe is unavailable."""
    try:
        import stripe as stripe_lib

        # Try env var first
        secret_key = os.environ.get("STRIPE_SECRET_KEY", "")
        if secret_key:
            stripe_lib.api_key = secret_key
            return stripe_lib

        # Try synchronous connector fetch
        creds = _get_stripe_credentials_sync()
        stripe_lib.api_key = creds["secret_key"]
        return stripe_lib
    except Exception as e:
        logger.warning(f"Stripe client unavailable: {e}")
        return None
