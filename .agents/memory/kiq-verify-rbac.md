---
name: Kincaid IQ Verify header-driven RBAC
description: Why the Verify ledger surface picks its RBAC role from a client header, and the guardrails that make that safe
---

The Kincaid IQ Verify surface (ported from the standalone BFF) selects its acting
RBAC role from the `X-KIQ-Role` request header, decoded behind real auth
(`get_current_user`). This is intentional: the page is an interactive demo of the
8-role permission model, so the frontend role selector must be able to switch roles
live.

**Why:** A reviewer will flag "client controls its own role" as privilege
escalation. In isolation that is correct, but here the header is the demo control,
not a security boundary bypass. Do NOT rip out the header or bind role solely to a
DB identity; that would break the role-switching demo the feature exists to show.

**How to apply:**
- The dangerous part is the default. Missing or unrecognized role MUST resolve to
  least privilege (`viewer`), never `owner`. Keep `_resolve_role` defaulting to
  viewer.
- If this ever graduates from a demo to a real authorization surface, that is the
  point to bind role to the authenticated user server-side and treat the header as
  optional downscoping only.

Separately: ledger appends serialize via a Postgres transaction advisory lock
(`pg_advisory_xact_lock`) so concurrent writers cannot read the same head and fork
the SHA-256 chain. The lock is skipped on non-Postgres dialects (SQLite tests).

The same rule applies to the standalone Node BFF build of Verify (a separate isolated
runnable trio on its own port): demo role comes from a request header and the
missing/invalid default is viewer, never owner. Apply the viewer-default fix to both
surfaces whenever either is touched.
