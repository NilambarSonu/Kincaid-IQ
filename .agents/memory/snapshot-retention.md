---
name: Client-package snapshot retention
description: How delivery snapshot blobs are pruned and what must never be deleted alongside them.
---

# Client-package snapshot retention

`client_package_snapshots.data` (Postgres bytea) stores byte-identical copies of
every sent/downloaded package component. It is the largest growth driver in that
table. A daily scheduled job (`compliance_engine.scheduler`, 04:00 UTC) prunes it
via `backend/services/snapshot_retention.py`.

**Rule:** the prune deletes snapshot *blob rows only*. The parent
`ClientPackageDelivery` audit rows (who/when/what was sent) must NEVER be deleted
by retention — they are small and are the system of record for the delivery log,
compliance CSV exports, and the "Recent deliveries" UI.

**Why:** the heavy reproducible artifacts (the blobs) are what bloat the DB;
the audit metadata is cheap and legally/compliance important to retain.

**How to apply:** two independent limits, each disablable with env=0 —
`SNAPSHOT_RETENTION_DAYS` (age, default 365) and
`SNAPSHOT_RETENTION_MAX_PER_RECIPIENT` (keep last N deliveries' snapshots per
recipient, default 50). If you add a feature that depends on a snapshot existing
(e.g. "re-download exactly what was sent"), it must tolerate the blob being gone
while the delivery row remains — surface a graceful "snapshot expired" state.
