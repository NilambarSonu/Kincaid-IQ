---
name: ORM schema drift on legacy Postgres tables
description: SQLAlchemy create_all never ALTERs existing tables, so adding model columns silently breaks queries on pre-existing DBs unless an idempotent ensure-columns migration runs at startup.
---

# ORM schema drift on legacy Postgres tables

When you add columns to a SQLAlchemy model whose table already exists in the
database, `Base.metadata.create_all()` does NOT alter it — it only creates
missing tables. Every ORM query against that model then fails with
`UndefinedColumn` (e.g. `column ... org_id does not exist`), even though the
Python model looks correct.

**Why:** create_all is create-if-not-exists only; there is no migration tool
(Alembic) wired in here. Rollbacks, fresh installs, and task-agent merges can
all reintroduce a table that predates newer model columns.

**How to apply:** mirror the existing pattern — add an idempotent
`ensure_<table>_columns()` helper that runs `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` for each column (plus needed indexes), wrapped in try/except, and call
it from the FastAPI `lifespan` startup right after `create_tables()`. Examples
live in `backend/routers/form_5500_monitor.py`:
`ensure_account_intel_columns()` (rfp_accounts) and
`ensure_rfp_opportunity_columns()` (rfp_opportunities). Manually ALTERing the
live DB once is NOT durable — codify it so future merges/rollbacks self-heal.
