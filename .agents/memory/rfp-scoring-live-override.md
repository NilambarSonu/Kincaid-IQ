---
name: RFP scoring live override
description: How to retune the RFP opportunity scorer at runtime without a redeploy, and the in-place-mutation gotcha.
---

# RFP scoring live override

The 7-factor RFP opportunity scorer is tunable three ways, in precedence order:
defaults → `RFP_SCORING_CONFIG` env override → persisted admin override (DB row
`rfp_scoring_overrides`, singleton key `'active'`, edited from `/admin`).

**The in-place mutation rule:** `backend.routers.rfp_intake` does
`from backend.config import RFP_SCORING`, binding the dict by reference. To
change the active config at runtime you MUST mutate that dict in place
(`RFP_SCORING.clear(); RFP_SCORING.update(...)`) — never rebind
`config.RFP_SCORING = newdict`, or rfp_intake keeps pointing at the stale dict.
`config.apply_rfp_scoring(override)` does this correctly.

**Snapshot refresh:** the per-factor scorers read `RFP_SCORING[...]` dynamically,
but `SCORE_WEIGHTS`, `TIER_THRESHOLDS`, `HIGH_VALUE_INDUSTRIES`,
`COMPLEX_PLAN_TYPES` are cached at import time. After mutating RFP_SCORING you
must call `rfp_intake.refresh_scoring_constants()` (apply_rfp_scoring does this)
or weight/tier changes silently won't take effect.

**Why:** lets non-engineers retune live; the two caches (import-time reference +
import-time snapshots) are the two ways a "saved" override can silently no-op.

**How to apply:** persisted override is reloaded on boot via
`_load_persisted_rfp_scoring()` in main.py lifespan. Admin save coerces the
payload against `RFP_SCORING_DEFAULTS` (drops unknown keys, type-coerces) before
persisting — see `_coerce_to_template` in backend/routers/admin.py.

## DB-backed persistence (ephemeral-FS hosts)
The admin override now persists to Postgres table `rfp_scoring_overrides` (singleton row key='active'), not just the local JSON file — the file alone is wiped on restart on App Runner / any diskless host. Precedence in `_resolve_override_raw`: inline env > env file > **DB row** > admin JSON file > defaults.
**Why:** admin-tuned scoring silently reverted to defaults after every deploy on ephemeral filesystems; the DB table existed but was never wired.
**How to apply:** DB reads are gated by `_db_override_enabled` (off at import — engine/tables may not exist — turned on by `enable_db_override()` at startup after `create_tables()`). Never read the DB at config import time.
