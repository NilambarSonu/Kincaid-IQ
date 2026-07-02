---
name: DuckDB remote provisioning (AWS)
description: How the 186MB analytics DuckDB is fetched at boot off Replit, and the two non-obvious constraints.
---

# DuckDB remote provisioning

The analytics DuckDB (~186 MB) is never baked into the image. `backend/duckdb.py` `_maybe_download()` fetches it on first `get_duck()` when the local file is absent and `DUCKDB_REMOTE_URL` is set.

## Two supported URL forms
- `s3://bucket/key` → boto3 `download_file` using the standard AWS credential chain (task/instance IAM role, `AWS_REGION`). No presigned URL, so nothing expires — preferred on AWS.
- `http(s)://…` → `urllib.urlretrieve` (works for public objects and presigned S3 URLs).

## Non-obvious constraints
1. **Atomic write required.** Download to a temp `.part` then `os.replace()` onto the final path.
   **Why:** `get_duck()` gates purely on `_DUCK_PATH.exists()`. A killed/partial download that wrote directly to the final path would leave a corrupt file that every future boot trusts and opens read-only — silent bad data, not a clear failure.
2. **boto3 is a real project dependency** (pyproject) — import it lazily inside the function so import-time/module load stays cheap and Replit (no S3) is unaffected.

**How to apply:** any future "pull a large asset from S3 on boot" follows the same pattern — IAM-role s3:// preferred, atomic rename mandatory, existence-gate implies integrity-gate.
