---
name: Backend Python tests (SQLite quirks + slow genai import)
description: How to write/run isolated Python unit tests against the SQLAlchemy models, and the gotchas that bite.
---

# Backend Python unit tests

There is no pytest installed and no Python test runner wired into `.replit`
(the `test` validation only runs TS via `tsx`). Use **stdlib `unittest`** so no
new deps are needed. A `backend-test` validation command runs
`python3 -m unittest discover -s backend/tests -p 'test_*.py'`.

## SQLite-in-memory against the real models
The models declare Postgres-only server defaults:
- primary keys use `server_default=func.gen_random_uuid()`
- timestamps use `func.now()` (fine on SQLite → CURRENT_TIMESTAMP)

**Rule:** when binding `Base.metadata` to an in-memory SQLite engine, register a
`gen_random_uuid` function on every connection *before* DDL/DML, or any insert
that relies on the server-side id default fails with
`sqlite3.OperationalError: unknown function: gen_random_uuid()`.

```python
@event.listens_for(engine, "connect")
def _reg(dbapi_conn, _):
    dbapi_conn.create_function("gen_random_uuid", 0, lambda: str(uuid.uuid4()))
```
Use `poolclass=StaticPool` + `check_same_thread=False` so every Session shares
the one in-memory connection. The router helpers take `db: Session` directly, so
you can pass a SQLite session straight in — no FastAPI/Postgres needed.

**Why:** this lets us unit-test DB-touching router logic (e.g. RFP auto
-recalibration) in isolation without a live Postgres or the API/auth stack.

## The 77-second import
Importing anything that pulls in `from google import genai` (e.g.
`backend.gemini_compat`, which most routers import) takes **~77s cold**, ~1–10s
warm. It is slow, not hung — give cold runs a >100s budget. Don't mistake an
empty/0-byte log on a fresh process for a deadlock.

**How to apply:** when a backend import "hangs", check whether it transitively
imports `google.genai` before assuming a real deadlock; budget time accordingly.
