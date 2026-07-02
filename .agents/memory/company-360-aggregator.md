---
name: Company 360 cross-module aggregator
description: How the EIN-keyed cross-module dossier fans out and stays doctrine-consistent
---

The Company 360 dossier (`/api/company-360/{ein}`) aggregates every EIN-addressable
module into ONE normalized response by reusing each module's **plain, non-auth
helper function** directly (e.g. `_get_benchmarking_bundle`, `shady_broker._analyze`,
`sales_os.get_prospect_detail`) — never by calling the HTTP endpoints.

**Why:** those helpers are the proven compute path already covered by tests; calling
them in-process avoids auth/HTTP round-trips and keeps one source of truth per module.

**How to apply when adding a module to the dossier:**
- Add a `(key, module_label, deep_link_route, resolver)` tuple to the `resolvers`
  list in `company360.py`. The tuple shape is load-bearing: it guarantees a
  deterministic `INSUFFICIENT_EVIDENCE` fallback card on resolver failure, so the
  dossier keeps **fixed module cardinality** and the roll-up math (confidence_mix,
  modules_with_findings) stays honest.
- Each card MUST carry `route`; the frontend navigates from that backend-provided
  `route` via `sendToPath` (NOT a frontend key→target map). Routes that embed the
  EIN (e.g. `/sales-os/account/{ein}`) must be built server-side.
- Confidence tier is a real finding, not an error: modules that cannot resolve by
  EIN alone (Rx Defense needs a contract upload, Network IQ needs a provider
  directory) return `INSUFFICIENT_EVIDENCE` with a next-step reason — never a fake
  number or a thrown error. This is the platform doctrine ("narratives never outrun
  evidence").
