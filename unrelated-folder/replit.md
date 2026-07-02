# Kincaid IQ — Kincaid RMC Intelligence Platform

## Overview
Kincaid IQ is a fiduciary-grade private banking platform designed for Ultra-High-Net-Worth Individuals (UHNWIs) and family offices. It integrates Apple-grade design principles with institutional financial analytics and a dual AI engine (OpenAI + Anthropic) to provide sophisticated advisory intelligence. The platform aims to be a comprehensive financial management and advisory tool, offering features that range from net worth tracking and portfolio intelligence to advanced market analytics, scenario simulations, and personalized AI-driven insights. It seeks to consolidate disparate financial data points into a unified, intuitive interface, providing a Bloomberg Terminal-level experience for private wealth management.

## User Preferences
The user prefers a streamlined and intuitive experience, with clear visual indicators for financial performance and risk. They value AI-driven insights that are personalized and actionable, such as market briefings and deal analysis. The user requires robust reporting capabilities, including configurable quarterly reports and year-end tax packages. Security and data integrity are paramount, especially concerning sensitive financial information and AI interaction logs.

**Working style (PERMANENT — do not ask, just do):**
- Never ask the user to confirm or "apply" changes. Make the change directly, restart the workflow, and report what was done.
- Never ask "do you want me to wire that up?" / "should I add X?" — if it's a reasonable next step, just build it.
- After Layout/sidebar/page edits, always restart the "Start application" workflow (production build, not Vite dev) so the user sees results without a manual step.

## System Architecture
The platform utilizes a modern web stack:
- **Frontend**: Built with React 19, Vite, and TypeScript, employing Wouter for routing, TanStack Query for data fetching, Recharts for data visualization, Framer Motion for animations, and shadcn/ui for UI components.
- **Backend**: Implemented using Python FastAPI, SQLAlchemy ORM, and PostgreSQL for the database.
- **AI Integration**: A dual AI engine leverages OpenAI and Anthropic via Replit AI Integrations for advisory and analytical functionalities.
- **Authentication**: JWT-based authentication using HTTP-only cookies for `access_token`, bcrypt for password hashing, and OAuth support for Google and GitHub.
- **Data & Features**:
    - **Financial Analytics**: Includes real-time market data, portfolio performance tracking, asset allocation with drift indicators, liquidity analysis, private investment tracking, and real estate portfolio management.
    - **AI-Powered Modules**: Features AI advisory, personalized market briefings, deal memo generation, and intelligent analysis of financial documents.
    - **Wealth Management**: Provides tools for family office management, entity mapping, beneficiary tracking, lifestyle budgeting, succession planning, and foundation management.
    - **Advanced Market Intelligence**: Offers charting tools, equity screeners, fixed income analytics, options analytics, earnings trackers, commodities boards, economic dashboards, company deep dives, news intelligence, factor analysis, credit monitoring, and volatility monitoring.
    - **Planning & Reporting**: Includes tax return analysis, tax loss harvesting, Monte Carlo simulations, cost basis tracking, PME analysis, income calendars, charitable giving optimization, estate planning scenarios, and robust report generation (quarterly, tax packages).
    - **Document Management**: A secure document vault for file uploads, downloads, and metadata management.
    - **Drill-Down System**: A universal 7-level evidence trail system provides detailed insights for every metric across the platform, indicated by a search icon on hover.
- **Deployment**: The `start.sh` script handles the build process (`npm run build` for Vite) and starts the Uvicorn server for FastAPI, which also serves the static frontend assets.

## Healthcare SaaS Transformation (Latest)
Kincaid IQ is now a full multi-tenant Healthcare SaaS platform in addition to the UHNW private banking suite.

### SaaS Architecture
- **Multi-Tenancy**: `Organization`, `OrganizationMember`, `PlanClient` models. Roles: owner > admin > analyst > viewer. 14-day trial on signup.
- **Stripe Billing**: Python `stripe` SDK. Plans: Fiduciary ($299/mo), Broker ($599/mo), Enterprise ($1,999/mo). Endpoints: `/api/billing/plans`, `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook`, `/api/billing/subscription`. Falls back to demo mode without `STRIPE_SECRET_KEY`.
- **Onboarding Flow**: `/landing` (marketing/pricing), `/signup` (org + user creation), `/onboarding` (5-step wizard: plan details → data upload → team → billing → launch). All public routes (no auth required).
- **4 Product Modules** (authenticated, org-scoped):
  - `/saas/fiduciary` — Plan Fiduciary Dashboard: 6 KPIs vs benchmark, 12-month cost trend, ERISA compliance matrix (10 rules), cost driver breakdown, benchmark percentile charts
  - `/saas/broker` — Broker Console: 8-client demo roster, risk scoring, revenue trend, renewal pipeline, commission tracking
  - `/saas/stoploss` — Stop-Loss Intelligence: 4-tier attachment analysis, 5 catastrophic claim predictions, IBNR reserve calculation, 5-carrier market comparison
  - `/saas/network` — Provider Network Analyzer: 8-specialty adequacy scores, 5 top OON leakage providers, PMPM in/out-of-network trend, CAA transparency compliance (8 requirements)
- **Billing UI** (`/billing`): Current subscription, plan upgrade/downgrade, plan cards
- **Sidebar**: "Healthcare SaaS" section with 6 items at bottom of nav

### SaaS Backend Files
- `backend/routers/orgs.py` — org CRUD, member management, client roster
- `backend/routers/billing.py` — Stripe integration + plan management
- `backend/routers/saas_fiduciary.py`, `saas_broker.py`, `saas_stoploss.py`, `saas_network.py`

### SaaS Frontend Files
- `client/src/pages/Landing.tsx`, `Signup.tsx`, `Onboarding.tsx`, `Billing.tsx`
- `client/src/pages/SaasFiduciary.tsx`, `SaasBroker.tsx`, `SaasStopLoss.tsx`, `SaasNetwork.tsx`

## Benefits Benchmarking Engine
- **Benefits Benchmarking** (`/benefits-benchmarking`): Bloomberg-terminal style employer benchmarking tool powered by DOL EFAST2 DuckDB (191,887 employers). Search any company by name or EIN, get their admin fees, broker commissions, and plan income compared against national P50/P75/P90 percentiles and state-level peers for their industry. Shows PMPM, percentile gauges (color-coded), side-by-side national/state benchmark tables, national trend charts, and top carrier rankings.
  - Backend: `backend/routers/benchmarking.py` — API at `/api/benchmark/*` (lookup, employer/{ein}, industry, trends, carriers, industries)
  - Data: DuckDB `dol5500.duckdb` — tables: `employers`, `industry_bench`, `state_benchmarks`, `year_trends`, `carrier_rankings`
  - Frontend: `client/src/pages/BenefitsBenchmarking.tsx`
  - Sidebar: "Data Intelligence" section, first entry

## Rx Defense
- **Rx Defense** (`/rx-defense`): AI-powered PBM contract defense tool evaluating contracts against 65 fiduciary-aligned issues across 13 provisions on a 0–100 scale. Features: upload PBM contracts (PDF/TXT/DOCX), demo analysis, demo comparison (before/after pair), 13-tab results view.
  - **13 Tabs**: Quick Look, Scorecard, $ Exposure, Exec Summary, Benchmarks, Red Flags, DOL Gap, CAA 2026, Tracker, Portfolio, Negotiation, Comparison, PBM Index
  - **Enhancement Suite (April 2026)**: 8 new features added:
    1. **Dollar Exposure Estimator** — input members + optional Rx spend → per-provision annual dollar exposure table. Endpoint: `GET /contracts/{id}/exposure`
    2. **AI Executive Summary** — GPT-4o plain-English CFO brief (headline + 3 paragraphs + next step). Endpoint: `GET /contracts/{id}/executive-summary`
    3. **Redline Generator** — downloads a `.docx` Word doc with model contract language for all weak provisions. Endpoint: `GET /contracts/{id}/redline`
    4. **PBM Benchmarking** — provision-level comparison vs CVS Caremark, Express Scripts, OptumRx, Industry Avg, Best-in-Class. Endpoint: `GET /benchmarks/provisions`
    5. **Portfolio Dashboard** — aggregate stats across all analyzed contracts. Endpoint: `GET /portfolio`
    6. **Presentation Mode** — 4-slide full-screen presentation (Overview, Risk Provisions, Key Findings, Recommendations)
    7. **Present button** — in ReportHeader, opens PresentationMode portal
    8. **Download Redline button** — in Negotiation tab alert bar
  - Backend: `backend/routers/rx_defense.py` — API at `/api/rx-defense/*`
  - Model: `RxDefenseContract` in `backend/models.py` (table: `rx_defense_contracts`)
  - Frontend: `client/src/pages/RxDefense.tsx` (~3200 lines)

## Indiana Prospect Engine
The Broker Console includes a full Indiana Prospect Engine powered by real DOL Form 5500 data (2,500+ Indiana employers with welfare/health plans in `f5500_filings` table).

### Features
- **Overview Dashboard**: Real-time metrics (total prospects, recommended accounts, renewal window targets, Rx targets, stop-loss gaps) fetched from `GET /api/saas/broker/overview`. Live ticker with rotating intelligence phrases.
- **Book Analysis Mode**: Broker submits their 10-12 client book → backend analyzes industry mix, size distribution, renewal patterns, plan types, and generates whitespace intelligence insights. Charts via Recharts (industry bar chart, size distribution bars, renewal month histogram, plan type breakdown). API: `POST /api/saas/broker/book/analyze`.
- **No-Book Quiz Mode**: 5-question guided quiz (size, geography, industry, service wedge, sales motion) → queries live Form 5500 data via `GET /api/saas/broker/prospects`.
- **Results Dashboard**: Prospect cards with 6-factor fit scoring, fit flags (stop-loss gap, Rx opportunity, high-value, disruption target, fast-close), opening angles, and commission estimates. Indiana market map with metro-level filtering. Prospect detail drawer with score breakdown.
- **Saved Lists**: CRUD for prospect lists with inline data storage. Create/rename/delete lists, add/remove prospects, CSV export. API: `GET|POST /api/saas/broker/lists`, `PATCH /api/saas/broker/lists/:id`, `POST|DELETE /api/saas/broker/lists/:id/items`, `GET /api/saas/broker/lists/:id/export`.

### Database Tables (Prospect Engine)
- `prospects_5500_indiana` — Cached Indiana prospect records
- `broker_profiles` — Broker targeting profiles
- `broker_books` — Broker book of business clients
- `prospect_recommendations` — Scored recommendations
- `saved_prospect_lists` — Named prospect lists per broker
- `saved_prospect_list_items` — List items with inline prospect data (sponsor_name, city, industry, participants, metro_label, ein, match_score, est_commission)

### Key Files
- Backend: `backend/routers/saas_broker.py` (overview, book/analyze, lists CRUD, prospects query endpoints)
- Frontend: `client/src/pages/BrokerProspects.tsx` (ProspectsView, BookAnalyzerView, QuizFlow, ResultsDashboard, SavedListsPanel)
- Schema: `shared/schema.ts` (Drizzle schemas for all 6 tables)

## Live DuckDB Analytics Database
The platform now has a fully built and live DuckDB analytics database at `data/dol5500.duckdb` (185 MB):
- **Source**: 937k DOL Form 5500 filings + 1.35M Schedule A records from PostgreSQL (2020–2024)
- **Build script**: `scripts/build_duckdb.py` — uses DuckDB native postgres extension for sub-second transfers
- **Tables**: `sch_h_2024` (936,865 plans), `employers` (191,887), `state_benchmarks` (7,076), `industry_bench` (1,302), `carrier_rankings` (73,871)
- **Views**: `year_trends`, `high_commission_flags` (59,824 flagged records)
- **Connection**: Thread-local read-only connections via `backend/duckdb.py` — safe for FastAPI async workers
- **Key Fix**: DuckDB returns `decimal.Decimal` types; `_safe()` in `kiq_routes.py` converts to `float` before arithmetic
- **Default entity**: Executive tiles map `ENTITY_001` sentinel → EIN `231352204` (Tower Health Medical Plan, $49.9M, CEI 86.1)
- **Route**: `/broker-prospects` → `BrokerProspects.tsx` (ProspectsView, 1220 lines) — gated by `prospecting` module

## Recent Additions
- **Administration Panel** (`/admin`): Full "control room" view into the Kincaid IQ backend. Shows live platform stats (73 routes, 75 pages, 23 routers, 16 tables, 12M+ rows, 2.47 GB), system health, AI provider/integration status, database table registry with row counts and sizes, environment variable viewer (secrets masked), seeding controls for KPI library and broker commissions, full API route registry (expandable by prefix with HTTP method badges), frontend page registry with category filtering, and AI query log. Backend: `backend/routers/admin.py` with `/api/admin/health`, `/api/admin/stats`, `/api/admin/tables`, `/api/admin/routes`, `/api/admin/config`, `/api/admin/logs`, `POST /api/admin/seed/{table}`.
- **Actuarial Broker Commissions** (`/actuarial-broker`): 57 Form 5500 Schedule A/C records; full-text search, filter by benefit type/state/year; multi-year comparison modal with trend chart; 5 flagged records above actuarial benchmark; DOL FOIA dataset link.
- **Business Valuation** (`/valuation`): 7-tab valuation model (Overview/Berkus/Scorecard/Risk Factors/VC/First Chicago/Comps).
- **Arbitrage Intelligence** (War Room): 8 expandable actuarial arbitrage moment cards with urgency badges, opportunity ranges, evidence sourcing; rendered in `/war-room`.

## AWS / Portability Layer
Kincaid IQ runs unchanged on Replit AND on any external host (AWS, etc.) via a non-destructive portability layer. Replit paths remain the fallback; direct vendor keys take precedence when present.

- **Production detection**: `backend/config.py` `_is_production()` returns true on `REPLIT_DEPLOYMENT=1` OR `APP_ENV=production` (also `ENVIRONMENT=production`). Off Replit, set `APP_ENV=production` or the app silently runs dev mode (open CORS, non-secure cookies). `auth.py` `IS_PRODUCTION` mirrors this for secure cookies.
- **Base URL / CORS**: `APP_BASE_URL` is the host-agnostic public URL (drives cookies, CORS, digest links, export verifier QR). `CORS_ORIGINS` (comma-separated) is an explicit allow-list that overrides auto-derived origins. `settings.base_url` resolves `APP_BASE_URL` → `REPLIT_DEPLOYMENT_URL` → localhost.
- **AI keys**: `config.py` prefers `AI_INTEGRATIONS_*` (Replit gateway) then falls back to direct `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. `backend/gemini_compat.py` prefers the Replit Gemini gateway, else direct `GEMINI_API_KEY`/`GOOGLE_API_KEY` against Google's public endpoint (no `http_options` when no custom base URL).
- **Stripe**: `backend/stripe_client.py` already env-first (`STRIPE_SECRET_KEY`), Replit connector is fallback.
- **HubSpot**: `backend/routers/crm_sync.py` `_hs_request()` uses direct `HUBSPOT_ACCESS_TOKEN` against `api.hubapi.com` when set, else the Replit connector proxy. `_hubspot_configured()` reports either path.
- **DuckDB**: `backend/duckdb.py` honors `DUCKDB_PATH` and downloads from `DUCKDB_REMOTE_URL` on boot when the local file is absent. Accepts `s3://bucket/key` (private bucket via the task/instance IAM role — needs `s3:GetObject` + `AWS_REGION`, nothing expires) OR any `http(s)://` URL (incl. presigned). Download is atomic (temp `.part` → `os.replace`) so a killed transfer never leaves a corrupt-but-present file. The 186 MB file is never baked into the image.
- **Container**: `Dockerfile` is multi-stage (Node build → Python 3.11 runtime), serves API + static frontend on `$PORT` (default 5000). `.dockerignore` keeps the image lean (no node_modules, dist, DuckDB, attached_assets). `.env.example` documents every variable.
- **Recommended runtime**: AWS App Runner (simplest) with RDS Postgres, DuckDB on S3, keys in Secrets Manager. ECS Fargate is the upgrade path (same image) when a persistent volume/EFS is needed.
- **Ephemeral-FS safe**: admin-saved RFP scoring now persists to Postgres (`rfp_scoring_overrides` singleton) and survives restarts on App Runner with no extra config. The `data/rfp_scoring_override.json` file and `RFP_SCORING_CONFIG` env var remain fallbacks. `overrideSource` in the admin payload shows the active source (env/db/file/defaults).
- **Still required on AWS**: re-register Google/GitHub OAuth redirect URIs for the new domain; provision the DuckDB file to S3 (`s3://` via IAM role or a presigned HTTPS URL — see `DUCKDB_REMOTE_URL`); the `replit.object_storage` import in `github_router.py` needs S3 (or that feature stays disabled, which it does gracefully).

## External Dependencies
- **AI Services**: OpenAI API and Anthropic API.
- **Database**: PostgreSQL.
- **Authentication Providers**: Google OAuth and GitHub OAuth.
- **Market Data**: Yahoo Finance for live market tickers and historical data.
- **Charting Libraries**: Recharts.
- **PDF Generation**: jsPDF and html2canvas for client-side PDF export.
- **File Processing**: pypdf for PDF text extraction.
- **Version Control Integration**: GitHub API for direct repository interaction.
## Constitutional Doctrine (Kincaid IQ Verify™ V10.0 — June 20, 2026)
The Kincaid IQ platform follows a constitutional doctrine. The governing spec is now
**Kincaid IQ Verify™ V10.0** (`attached_assets/Pasted-KINCAID-IQ-VERIFY-V10-0-*.txt`) —
an Economic Intelligence, Fiduciary Forensics & Healthcare Value Creation engine
(UChicago dual-PhD identity, 11 forensic phases, 12-score framework, 30/90/180/365
action horizon). It supersedes the original Master Build Prompt
(`attached_assets/kincaid_iq_replit_master_prompt_*.html`).

The doctrine is enforced platform-wide at three canonical surfaces:
- **`BASE_PERSONA`** in `backend/agents/base.py` — the single source of truth,
  automatically prepended to **every** AI call routed through `run_agent` (all 5
  fiduciary agents, council, orchestrator, KIQ Narrative Engine, Sales OS). This is
  why all agent AI output follows V10.0. Carries the V10.0 identity, core mission,
  investigative discipline, the 11-phase forensic method, normalization units
  (PMPM/PEPY/EBITDA/EV), and the JSON output contract.
- **`_NARRATIVE_SYSTEM`** in `backend/routers/kiq_engine.py` — War Room narrative
  engine voice/identity (JSON schemas preserved).
- **`Doctrine.tsx`** (`VOICE_CONTRACT`, `HARD_RULES`, `GATE_CHAIN`) — the doctrine
  surfaced verbatim across pages (CFO War Room + DoctrineBar).

### Voice Contract (applies to every AI-generated sentence platform-wide)
University of Chicago PhD Economist + PhD Computer Scientist — industrial organization,
agency theory, information economics, causal inference — overlaid on a McKinsey senior
partner's board-room directness. No marketing language. No hedging. You do not
summarize — you investigate. You do not speculate — you prove. You do not report
observations — you quantify consequences. Every assertion justified by a structural
property and a dollar figure, not a preference.

### Four Hard Rules (non-negotiable)
1. One screen, four tiles always.
2. Every number clickable into receipts (drill, not tooltip).
3. No export without a SHA-256 evidence manifest.
4. Narratives never outrun evidence — INSUFFICIENT_EVIDENCE is a valid finding.

### Confidence Tiers (exactly three labels — no fourth)
- **CERTIFIED** — contract clause + claim record + remittance, reconciled.
- **MODELED** — inference from incomplete evidence; bounds disclosed.
- **INSUFFICIENT_EVIDENCE** — no finding issued; logged as Tile-4 gap.

### 7-Gate Enforcement Chain
DEFINE → WIRE → VALIDATE → PROMOTE → COMPUTE → GATE → RENDER.
Mapped to the War Room drill levels via `LEVEL_TO_GATE` in `CfoWarRoom.tsx`
and shown on the NarrativePanel header as `GATE · <name>`.
