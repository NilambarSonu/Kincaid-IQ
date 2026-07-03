# Kincaid IQ

**Private Banking Intelligence Platform** — An enterprise-grade SaaS platform built for fiduciary advisors, benefit consultants, and employer groups to manage healthcare plan governance, compliance, and strategic intelligence.

## Overview

Kincaid IQ is a comprehensive intelligence operating system that consolidates fiduciary oversight, claims analytics, compliance monitoring, and market intelligence into a single, unified platform. It is designed to eliminate the fragmented spreadsheet-and-email workflows that plague the employer health benefits industry.

### Core Capabilities

- **Fiduciary Governance** — Real-time fiduciary duty tracking, ERISA compliance dashboards, and automated audit trails
- **Claims Intelligence** — Deep claims analytics with recovery identification, stop-loss optimization, and PBM contract analysis
- **Rx Defense IQ** — Pharmaceutical spend analysis, formulary compliance, and pharmacy benefit manager (PBM) contract negotiation intelligence
- **Sales Intelligence OS** — Prospect research, RFP command center, pipeline management, and CRM synchronization
- **Compliance Engine** — Automated control monitoring, evidence collection, finding tracking, and audit report generation
- **Form 5500 Analytics** — DOL Form 5500 filing intelligence powered by a 186 MB DuckDB analytics database
- **M&A Diligence** — Due diligence intelligence for mergers and acquisitions in the benefits space
- **Multi-Tenant SaaS** — Organization-scoped access with role-based permissions, Stripe billing integration, and white-label support

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend API** | Python 3.11+, FastAPI, SQLAlchemy, Uvicorn |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Radix UI |
| **Database** | PostgreSQL 15 (relational), DuckDB (analytics) |
| **AI Providers** | OpenAI, Anthropic Claude, Google Gemini (multi-model, configurable) |
| **Payments** | Stripe (subscriptions, metered billing) |
| **CRM** | HubSpot, Salesforce (optional) |
| **PDF/Export** | WeasyPrint, ReportLab, python-docx |
| **Container** | Docker, Docker Compose |

## Prerequisites

- **Python** 3.11 or later
- **Node.js** 18 or later
- **Docker** and **Docker Compose** (for local development)
- **PostgreSQL** 15 (provided by Docker Compose, or bring your own)

## Getting Started

### 1. Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

At minimum, configure:
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — A long random string for session/JWT signing
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` — At least one AI provider

### 2. Run with Docker Compose

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** database on port 5432
- **Kincaid IQ** application on port 5000

### 3. Verify

Open your browser to `http://localhost:5000` to see the application, or check the API health:

```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{"status": "ok", "version": "2.0.0", "stack": "FastAPI + React 19 + PostgreSQL"}
```

## Environment Variables

See [`.env.example`](.env.example) for the full list of supported environment variables with documentation. The application is designed to degrade gracefully — features that require unconfigured API keys will simply be unavailable rather than causing crashes.

## Documentation

- [`docs/deployment-guide.md`](docs/deployment-guide.md) — Cloud-agnostic deployment instructions
- [`docs/handover-checklist.md`](docs/handover-checklist.md) — Repository and credential transfer guide
- [`docs/`](docs/) — Architecture whitepapers and technical documentation

## API Documentation

When running in development mode (`APP_ENV=development`), interactive API documentation is available at:

- **Swagger UI**: `http://localhost:5000/docs`
- **ReDoc**: `http://localhost:5000/redoc`

> API docs are automatically disabled in production for security.

## License

Proprietary — Kincaid RMC. All rights reserved.
