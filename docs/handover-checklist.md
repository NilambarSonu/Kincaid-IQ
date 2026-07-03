# Client Handover Checklist — Kincaid IQ

Use this checklist when transferring the project to the client's infrastructure.

---

## 1. Repository Transfer

- [ ] Transfer GitHub repository ownership to client's GitHub organization
  - Go to **Settings → Danger Zone → Transfer ownership**
  - Enter the client's GitHub username or organization
- [ ] Verify client has access to all branches (`main`, `dev`)
- [ ] Verify GitHub Actions workflows are functional under new ownership
- [ ] Update any repository secrets (API keys, deployment credentials)

## 2. Environment Variables & Secrets

Hand over the following credentials (use a secure channel — never email):

### Required Secrets
| Secret | Where to Get It | Status |
|--------|----------------|--------|
| `SESSION_SECRET` | Generate a new 64-char random string | ☐ |
| `DATABASE_URL` | From cloud database provider | ☐ |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) | ☐ |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | ☐ |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) | ☐ |
| `STRIPE_SECRET_KEY` | [dashboard.stripe.com](https://dashboard.stripe.com) | ☐ |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard | ☐ |

### Optional Secrets
| Secret | Purpose | Status |
|--------|---------|--------|
| `HUBSPOT_ACCESS_TOKEN` | CRM integration | ☐ |
| `TWILIO_ACCOUNT_SID` | SMS notifications | ☐ |
| `TWILIO_AUTH_TOKEN` | SMS notifications | ☐ |
| `GOOGLE_CLIENT_ID` | Google OAuth login | ☐ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth login | ☐ |
| `GITHUB_CLIENT_ID` | GitHub OAuth login | ☐ |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth login | ☐ |

## 3. Cloud Infrastructure

- [ ] Transfer cloud account ownership (or create new account under client)
- [ ] Verify database backups are enabled and scheduled
- [ ] Verify container auto-scaling is configured
- [ ] Verify logging and monitoring are active
- [ ] Document monthly cost estimate for the client

## 4. Domain & DNS

- [ ] Transfer domain ownership (if applicable)
- [ ] Update DNS records to point to client's infrastructure
- [ ] Verify TLS certificates are valid and auto-renewing
- [ ] Update CORS origins in environment variables

## 5. OAuth & Third-Party Integrations

- [ ] Transfer Google Cloud Console project (for OAuth)
- [ ] Transfer GitHub OAuth App to client's account
- [ ] Transfer Stripe account or create new Stripe account under client
- [ ] Update all OAuth redirect URIs to the client's domain
- [ ] Update Stripe webhook URLs

## 6. Database

- [ ] Provide a fresh database backup to the client
- [ ] Document the backup/restore procedure (see `scripts/db_backup.sh`)
- [ ] Verify the DuckDB analytics file is accessible from the new infrastructure
- [ ] Confirm all tables are created and data is intact

## 7. CI/CD Pipeline

- [ ] Verify GitHub Actions workflows run under new ownership
- [ ] Update deployment secrets in GitHub repository settings
- [ ] Configure the deployment step for the client's chosen cloud provider
- [ ] Run a test deployment to verify the full pipeline

## 8. Documentation Provided

- [ ] This handover checklist
- [ ] [README.md](../README.md) — Project overview and setup
- [ ] [Deployment Guide](deployment-guide.md) — Step-by-step deployment instructions
- [ ] [.env.example](../.env.example) — All environment variables documented
- [ ] Architecture whitepapers (in `docs/`)

## 9. Post-Handover Support

- [ ] Schedule a walkthrough call with the client's technical team
- [ ] Provide 30-day support window for deployment questions
- [ ] Confirm the client can independently deploy, backup, and restore
