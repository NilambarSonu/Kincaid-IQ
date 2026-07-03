# Deployment Guide — Kincaid IQ

This guide covers deploying Kincaid IQ to any cloud provider. The application is fully containerized and cloud-agnostic.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Internet                         │
│                       │                             │
│              ┌────────▼────────┐                    │
│              │  Load Balancer  │                    │
│              │  (TLS termination)                   │
│              └────────┬────────┘                    │
│                       │                             │
│              ┌────────▼────────┐                    │
│              │  Kincaid IQ     │                    │
│              │  Docker Container                    │
│              │  (FastAPI + React)                   │
│              │  Port 5000                           │
│              └──┬──────────┬───┘                    │
│                 │          │                        │
│        ┌────────▼──┐  ┌───▼──────────┐              │
│        │ PostgreSQL │  │ DuckDB File  │             │
│        │ (Managed)  │  │ (Object Store)│            │
│        └────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

Before deploying, ensure you have:

1. **Docker image built** — `docker build -t kincaid-iq .`
2. **PostgreSQL database** provisioned (managed or self-hosted)
3. **Object storage** for the DuckDB analytics file (S3, GCS, or DO Spaces)
4. **API keys** for at least one AI provider (OpenAI, Anthropic, or Gemini)
5. **Stripe keys** for billing (optional — app works without them)

---

## Step 1: Build the Docker Image

The Dockerfile uses a multi-stage build. The frontend must be pre-built before the Docker build:

```bash
# Install Node dependencies and build frontend
npm ci
npx vite build

# Build the Docker image
docker build -t kincaid-iq:latest .
```

## Step 2: Provision the Database

Create a PostgreSQL 15+ instance on your cloud provider:

| Provider | Service |
|----------|---------|
| AWS | Amazon RDS for PostgreSQL |
| GCP | Cloud SQL for PostgreSQL |
| DigitalOcean | Managed Databases |

**Requirements:**
- PostgreSQL 15 or later
- Minimum: 1 vCPU, 1 GB RAM (`db.t4g.micro` on AWS)
- Enable TLS (`?sslmode=require` in connection string)
- Enable automated backups

Save the connection string:
```
postgresql://username:password@hostname:5432/kincaid
```

## Step 3: Configure Environment Variables

Set the following environment variables on your container host. See `.env.example` for the complete list.

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Long random string (32+ chars). **App refuses to start without this in production.** |
| `APP_ENV` | Must be `production` |
| `APP_BASE_URL` | Public URL (e.g., `https://app.kincaid-iq.com`) |
| `PORT` | Container port (default: `5000`) |

### AI Providers (at least one required)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `GEMINI_API_KEY` | Google Gemini API key |

### Optional but Recommended

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe billing |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot CRM integration |
| `DUCKDB_REMOTE_URL` | S3/GCS URL for the DuckDB analytics file |

## Step 4: Deploy the Container

Push the Docker image to your cloud provider's container registry, then deploy it.

### Health Check

The application exposes a health endpoint for load balancer and orchestrator health checks:

```
GET /api/health
```

Response: `{"status": "ok", "version": "2.0.0"}`

### Startup Behavior

On boot, the application:
1. Creates all database tables (if they don't exist)
2. Runs inline migrations for schema changes
3. Downloads the DuckDB file from `DUCKDB_REMOTE_URL` (if configured)
4. Seeds demo data (if empty database)
5. Starts the compliance scheduler

## Step 5: Configure DNS & TLS

Point your domain to the cloud provider's load balancer/endpoint. TLS is typically handled by the cloud provider's load balancer (ACM on AWS, managed certs on GCP/DO).

## Step 6: Update OAuth Redirect URIs

If using Google or GitHub OAuth login, update the redirect URIs in:
- **Google Cloud Console** → APIs & Services → Credentials
- **GitHub** → Settings → Developer settings → OAuth Apps

Add your new production domain (e.g., `https://app.kincaid-iq.com/api/auth/google/callback`).

## Step 7: Update Stripe Webhooks

In the Stripe Dashboard, update the webhook endpoint URL to:
```
https://your-domain.com/api/stripe/webhook
```

---

## Post-Deployment Verification

Run through this checklist after deployment:

- [ ] `GET /api/health` returns `{"status": "ok"}`
- [ ] Frontend loads at the root URL
- [ ] User registration and login work
- [ ] AI features respond (try any AI-powered analysis)
- [ ] Stripe checkout flow works (if configured)
- [ ] OAuth login works (if configured)
- [ ] Form 5500 search returns results (if DuckDB is loaded)

---

## Monitoring

The application logs to `stdout` in structured format. Your cloud provider's logging service will automatically capture these:

| Provider | Logging Service |
|----------|-----------------|
| AWS | CloudWatch Logs |
| GCP | Cloud Logging |
| DigitalOcean | App Platform Logs |

Set up alerts for:
- HTTP 5xx error rate > 1%
- Container CPU > 80% sustained
- Database connection failures
