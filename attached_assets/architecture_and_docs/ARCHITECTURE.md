# ARCHITECTURE.md — Kincaid IQ Full-Stack (Replit)

No em dashes anywhere. Stack, endpoint map, evidence chain, and run topology.

## Stack Diagram

```
+-----------------------------------------------------------+
|  REACT FRONTEND                                           |
|  KincaidDashboard.jsx : 10 views + Plan Dossier          |
|  useFetch() -> /api/* with retry (2x)                    |
+-----------------------------------------------------------+
|  BFF TILE LAYER (aggregate endpoints)                    |
|  /tiles/executive  -> 4-tile composite                   |
|  /tiles/provider   -> Provider intelligence              |
|  /tiles/pension    -> Funding gap aggregate              |
|  /tiles/actuarial  -> DB + SB actuarial                  |
|  /tiles/dfe        -> Investment concentration           |
|  /tiles/mep        -> Multi-employer aggregate           |
+-----------------------------------------------------------+
|  BFF RUNTIME (Replit native entry point)                 |
|  Express + TypeScript on better-sqlite3                   |
|  Evidence Ledger, RBAC, SSE. Port 8787.                  |
|  npm run dev  (DEMO_OPEN_AUTH=1 ts-node server)          |
+-----------------------------------------------------------+
|  FASTAPI ANALYTICAL CORE (parallel service)              |
|  routes.py v6 : 30 endpoints, evidence-anchored          |
|  _safe() NaN/Infinity filter, _evidence() SHA-256 chain  |
|  _sanitize() input validation, _clamp() bounds           |
+-----------------------------------------------------------+
|  DUCKDB ANALYTICAL ENGINE                                |
|  65 tables, ~3.9M rows, 12 materialized views            |
|  Sub-second OLAP, SHA-256 evidence hashing               |
|  DOL Form 5500, 2023-2024 plan years                     |
+-----------------------------------------------------------+
```

## Run Topology on Replit

- Primary process: the Node BFF. Express on better-sqlite3, port 8787. This boots with
  `npm run dev` and serves the Evidence Ledger, RBAC, and SSE endpoints. better-sqlite3 is
  embedded, so no external database is required to run the demo.
- Secondary process (optional in a parallel Repl or workspace tab): the FastAPI plus DuckDB
  analytical core for the heavy OLAP and the DOL 5500 engine.
- Frontend: the React app calls the BFF, which composes tiles and, when present, proxies
  analytical reads from the FastAPI core.
- Seed demo data: `npm run seed`. Health probe: `npm run health`. Verify ledger chain:
  `npm run verify`.

## Frontend to Backend Endpoint Map

| Frontend View | Component | Backend Endpoint(s) |
|---------------|-----------|---------------------|
| Executive (4-tile) | ExecDashboard | GET /tiles/executive |
| EBITDA Drag | EbitdaDrill | GET /ebitda-drag |
| Compliance Risk | ComplianceDrill | GET /compliance |
| Providers | ProviderDrill | GET /tiles/provider |
| Pension | PensionDrill | GET /tiles/pension + /tiles/actuarial |
| Actuarial SB | ActuarialDrill | GET /actuarial/sb-deep |
| YoY Trend | YoYDrill | GET /yoy/h |
| DFE/Investment | DfeDrill | GET /tiles/dfe |
| MEP | MepDrill | GET /tiles/mep |
| System Status | StatusView | GET /status |
| Plan Dossier | PlanDossier | GET /plan/{ein}/{pn} + /narrative/{ein}/{pn} + /kpis/{ein}/{pn} + /benchmark/{ein}/{pn} |
| Global Search | (Top bar) | GET /search |

## Evidence Chain (every response)

```json
{
  "evidence": {
    "source_type": "DOL_5500",
    "schedule": "H",
    "sha256": "a1b2c3d4e5f6a7b8",
    "computed_at": "2026-03-01T12:00:00Z"
  }
}
```

## Four Hard Rules (enforced in this layer)

1. One screen, four tiles always. ExecDashboard renders exactly four composite tiles.
2. Every number clickable into receipts. All Stat components drill to PlanDossier.
3. No export without receipts. EvidenceTag on every Card that carries data.
4. Narratives never outrun evidence. Board narratives cite SHA-256 hashed source filings.
