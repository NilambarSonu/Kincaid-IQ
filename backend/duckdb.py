"""
Kincaid IQ — DuckDB Connection Manager
Wraps the DOL EFAST2 analytics database.
Thread-local connections for FastAPI compatibility.
"""
import os
import logging
import threading
import duckdb
from pathlib import Path

logger = logging.getLogger("kincaid.duckdb")

# ── Path resolution ──────────────────────────────────────────────────────────
_ROOT      = Path(__file__).parent.parent
_DATA_DIR  = _ROOT / "data"
_DUCK_PATH = _DATA_DIR / "dol5500.duckdb"

# Honour env override
_ENV_PATH  = os.environ.get("DUCKDB_PATH", "")
if _ENV_PATH:
    _DUCK_PATH = Path(_ENV_PATH)

# Thread-local storage — each thread gets its own connection
_local = threading.local()

# Cached availability status (checked once at startup)
_available: bool | None = None


def _ensure_data_dir():
    # Create both the default data dir and the actual parent of the DuckDB file
    # (DUCKDB_PATH may point outside data/).
    _DATA_DIR.mkdir(exist_ok=True)
    _DUCK_PATH.parent.mkdir(parents=True, exist_ok=True)


def _redact_url(url: str) -> str:
    """Drop the query string before logging — presigned S3 URLs carry the
    signature/credentials there and must never land in logs."""
    return url.split("?", 1)[0] if url else url


def _download_s3(remote: str, dest: Path) -> None:
    """Download an ``s3://bucket/key`` object to ``dest`` using boto3. Credentials
    and region come from the standard AWS chain (instance/task IAM role,
    AWS_REGION, env vars) — no presigned URL required, so nothing expires."""
    import boto3  # already a project dependency
    without_scheme = remote[len("s3://"):]
    bucket, _, key = without_scheme.partition("/")
    if not bucket or not key:
        raise ValueError(f"malformed S3 URL (expected s3://bucket/key): {remote}")
    boto3.client("s3").download_file(bucket, key, str(dest))


def _download_gcs(remote: str, dest: Path) -> None:
    """Download a ``gs://bucket/object`` blob to ``dest`` using the Google Cloud
    Storage client. Credentials come from Application Default Credentials — on
    Cloud Run / GKE / GCE this is the attached service account, so no presigned
    URL is required and nothing expires. The GCP parallel to ``_download_s3``."""
    from google.cloud import storage  # google-cloud-storage
    without_scheme = remote[len("gs://"):]
    bucket, _, blob = without_scheme.partition("/")
    if not bucket or not blob:
        raise ValueError(f"malformed GCS URL (expected gs://bucket/object): {remote}")
    storage.Client().bucket(bucket).blob(blob).download_to_filename(str(dest))


def _maybe_download():
    """
    If DUCKDB_REMOTE_URL is set and the local file doesn't exist, download it
    from S3/R2/HTTPS. One-time on startup.

    Supports ``s3://bucket/key`` (private buckets via the AWS credential chain /
    IAM role), ``gs://bucket/object`` (private buckets via GCP Application Default
    Credentials / the Cloud Run service account), as well as any ``http(s)://``
    URL (including a presigned S3 or Cloud Storage URL). The file is written to a
    temp path and atomically renamed so an interrupted download never leaves a
    corrupt-but-present file that later boots trust.
    """
    remote = os.environ.get("DUCKDB_REMOTE_URL", "")
    if not remote or _DUCK_PATH.exists():
        return

    logger.info(f"[DuckDB] Downloading from remote: {_redact_url(remote)}")
    _ensure_data_dir()
    tmp = _DUCK_PATH.with_name(_DUCK_PATH.name + ".part")
    try:
        if remote.startswith("s3://"):
            _download_s3(remote, tmp)
        elif remote.startswith("gs://"):
            _download_gcs(remote, tmp)
        else:
            import urllib.request
            urllib.request.urlretrieve(remote, str(tmp))
        os.replace(tmp, _DUCK_PATH)  # atomic on the same filesystem
        logger.info(f"[DuckDB] Downloaded → {_DUCK_PATH} ({_DUCK_PATH.stat().st_size:,} bytes)")
    except Exception as exc:
        logger.error(f"[DuckDB] Remote download failed: {exc}")
        try:
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass


def get_duck() -> duckdb.DuckDBPyConnection:
    """
    Return a thread-local read-only DuckDB connection.
    Each thread gets its own connection to avoid concurrency issues.
    Raises RuntimeError if the database file is not available.
    """
    # Return existing connection for this thread if healthy
    conn = getattr(_local, "conn", None)
    if conn is not None:
        try:
            conn.execute("SELECT 1").fetchone()
            return conn
        except Exception:
            _local.conn = None

    _maybe_download()

    if not _DUCK_PATH.exists():
        raise RuntimeError(
            f"DuckDB file not found at {_DUCK_PATH}. "
            "Upload dol5500.duckdb to the data/ directory or set DUCKDB_REMOTE_URL."
        )

    logger.info(f"[DuckDB] Opening read-only: {_DUCK_PATH}")
    conn = duckdb.connect(str(_DUCK_PATH), read_only=True)
    _local.conn = conn

    # Quick sanity — count tables
    try:
        n = conn.execute("SELECT COUNT(*) FROM information_schema.tables").fetchone()[0]
        logger.info(f"[DuckDB] Connected · {n} tables")
    except Exception as exc:
        logger.warning(f"[DuckDB] Schema check failed: {exc}")

    return conn


def duck_available() -> bool:
    """Non-raising check — returns False if DuckDB is unavailable."""
    global _available
    if _available is not None:
        return _available
    try:
        get_duck()
        _available = True
        return True
    except Exception:
        _available = False
        return False


def duck_table_count() -> int:
    """Return table count or 0 if unavailable."""
    try:
        return get_duck().execute(
            "SELECT COUNT(*) FROM information_schema.tables"
        ).fetchone()[0]
    except Exception:
        return 0
