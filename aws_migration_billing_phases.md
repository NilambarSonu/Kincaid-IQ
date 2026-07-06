# AWS Migration Plan & Billing Schedule

This document divides the exact scope of the Kincaid IQ AWS migration into three distinct billing milestones. The milestones are structured to match the agreement of a **$440 USD total project budget** split into staged staging and production environments to minimize risk.

---

## MILESTONE 1: AWS Foundation & Staging Data Migration ($170 USD)
**Scope:** AWS account setup, IAM, region locking, networking, secrets configuration, and proving data migration works in a staging environment.

*This milestone focuses on building the secure AWS infrastructure and verifying PostgreSQL/RDS and S3/DuckDB data migration in a non-production environment.*

### Subphase 1.1: AWS Account & Foundation Setup (~0.5 Days)
- **Account & IAM:** Create/configure the AWS account, set up administrative IAM roles, and enable billing alerts.
- **Networking & Region:** Lock the primary region (e.g., `us-east-1`) to prevent cross-region data fees and provision the default VPC networking.
- **Secrets Management:** Set up AWS Secrets Manager to securely store API keys (OpenAI, Anthropic, Gemini, Stripe, HubSpot).
- **Container Registry:** Create the Elastic Container Registry (ECR) repo to prepare for the Docker image uploads.

### Subphase 1.2: Staging Data Migration & Proof of Concept (~1.5 Days)
- **Relational Data (PostgreSQL → Staging RDS):**
  - Provision a scalable Amazon RDS PostgreSQL instance (`db.t4g.medium`).
  - Perform `pg_dump` from Replit's database.
  - Perform `pg_restore` into the Staging RDS instance, migrating all 16 app tables and the massive ~2GB DOL Form 5500 filings.
  - Enforce TLS (`?sslmode=require`) on the staging database connection.
- **Analytics Data (DuckDB → Staging S3):**
  - Create a private Amazon S3 bucket.
  - Upload the 186 MB `dol5500.duckdb` file to S3.
  - Configure IAM permissions (`s3:GetObject`) so the staging application can fetch this file securely on boot.

> **✅ MILESTONE 1 COMPLETE:** The AWS foundation is built, ECR is configured, and all staging data migration is verified working. **Invoice: $170 USD.**

---

## MILESTONE 2: Staging Compute & Deployment ($170 USD)
**Scope:** Building the container, deploying the application in the staging environment, and verifying end-to-end functionality before touching production.

*This milestone brings the staging application online in AWS, links it to the newly migrated staging databases, and validates startup sequences.*

### Subphase 2.1: Staging Compute & Configuration (~1.0 Day)
- **Image Build:** Build the host-agnostic multi-stage Docker image and push it to AWS ECR.
- **App Runner Provisioning:** Deploy AWS App Runner for staging, pointing it at the staging ECR image.
- **Environment Configuration:** Inject all environment variables, connection strings (from Milestone 1), and secrets into the staging App Runner container.
- **Boot Validation:** Validate the startup sequence, ensuring the staging app successfully downloads the DuckDB file from S3 and connects to the RDS instance. Confirm the `/api/health` endpoint returns a green status.

> **✅ MILESTONE 2 COMPLETE:** The application is fully live and functional in the staging environment on AWS App Runner, proving that compute and database integrations are stable. **Invoice: $170 USD.**

---

## MILESTONE 3: Production Cutover, DNS & OAuth Routing ($100 USD) - **IN PROGRESS (60% of Milestone 3 completed)**
**Scope:** Performing the final production database cutover, custom domain DNS routing, OAuth app configurations, Stripe webhook routing, and CI/CD pipelines.

*This milestone moves the live users from Replit to AWS, configures production-grade settings, and decommissions Replit.*

### Subphase 3.1: Production Data Cutover & Compute (✅ COMPLETED)
- **Final Data Dump/Restore:** Performed final production `pg_dump` and `pg_restore` (restored the 326MB database backup containing 2k+ records successfully into the secure AWS RDS database).
- **Production App Runner Deployment:** Deployed the production App Runner instance connected to the production RDS database.

### Subphase 3.2: Domain, DNS & OAuth Routing (✅ COMPLETED)
- **DNS & SSL:** Point the production domain to AWS App Runner via Route 53 (or the current DNS provider) and ensure automatic TLS certificates are issued. (Completed: Domain configured in GoDaddy and App Runner).
- **OAuth Re-registration (CRITICAL):** Update Google Cloud Console and GitHub Developer Settings to whitelist the new AWS domain's redirect URIs to prevent social login breakage. (Completed).
- **Stripe Webhooks:** Update the Stripe Dashboard to route billing webhooks to the new AWS domain (`https://www.kincaidhealth.com/api/stripe/webhook`). (Completed).

### Subphase 3.3: CI/CD Pipeline & Operations (✅ COMPLETED)
- **Automated Deployments:** Implemented a GitHub Actions pipeline (`.github/workflows/deploy.yml`) so that pushing code to the `main` branch automatically builds the image, pushes to ECR, and triggers an App Runner deployment. Tested and verified green!
- **Monitoring & Logging:** Verified CloudWatch log streaming is capturing backend output correctly.
- **Alarms & Backups:** Set up automated backups (7-day retention) on RDS and S3 versioning on the analytics bucket.

> **✅ MILESTONE 3 COMPLETE:** Production compute is live, custom domain mapping is configured, OAuth & Stripe endpoints are updated, and environments are fully hardened. **Current overall project completion: 100%. Invoice: $100 USD.**
