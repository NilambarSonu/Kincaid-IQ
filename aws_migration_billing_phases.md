# AWS Migration Plan & Billing Schedule

This document divides the exact scope of the Kincaid IQ AWS migration into two distinct, billable macro-phases. The work is distributed to precisely match a **45.45% / 54.54%** split based on the estimated time and effort required for each step. 

---

## PHASE 1: Foundation & Data Migration (45.45% of Project)
**Estimated Effort:** ~2 Days
**Milestone:** Invoice for the first 45.45% is issued upon completion of this phase.

*This phase focuses on building the secure AWS infrastructure and migrating the heaviest components (the databases) without any downtime for the live Replit app.*

### Subphase 1.1: AWS Account & Foundation Setup (~0.5 Days)
- **Account & IAM:** Create/Configure the AWS account, set up administrative IAM roles, and enable strict billing alerts.
- **Networking & Region:** Lock the primary region (e.g., `us-east-1`) to prevent cross-region data fees and provision the default VPC networking.
- **Secrets Management:** Set up AWS Secrets Manager to securely store API keys (OpenAI, Anthropic, Gemini, Stripe, HubSpot).
- **Container Registry:** Create the Elastic Container Registry (ECR) repo to prepare for the Docker image uploads.

### Subphase 1.2: Data Migration - The Heavy Lifting (~1.5 Days)
- **Relational Data (PostgreSQL → Amazon RDS):**
  - Provision a scalable Amazon RDS PostgreSQL instance (`db.t4g.medium`).
  - Perform `pg_dump` from Replit's Postgres database.
  - Perform `pg_restore` into the new AWS RDS instance, securely migrating all 16 app tables and the massive ~2GB DOL Form 5500 filings.
  - Enforce TLS (`?sslmode=require`) on the new database connection.
- **Analytics Data (DuckDB → Amazon S3):**
  - Create a private Amazon S3 bucket.
  - Upload the 186 MB `dol5500.duckdb` file to S3.
  - Configure IAM permissions (`s3:GetObject`) so the application can fetch this file securely on boot.

> **✅ PHASE 1 COMPLETE:** The AWS foundation is built, and all production data has been safely ported and secured. The first payment milestone is unlocked.

---

## PHASE 2: Compute, Deployment & Cutover (54.54% of Project)
**Estimated Effort:** ~2.5 Days
**Milestone:** Invoice for the remaining 54.54% is issued upon successful live cutover.

*This phase brings the application online in AWS, links it to the newly migrated databases, switches over the public domain, and establishes automated pipelines for the future.*

### Subphase 2.1: Compute & Deployment (~1.0 Day)
- **Image Build:** Build the host-agnostic multi-stage Docker image and push it to AWS ECR.
- **App Runner Provisioning:** Deploy AWS App Runner, pointing it at the ECR image.
- **Environment Configuration:** Inject all environment variables, connection strings (from Phase 1), and secrets into the App Runner container.
- **Boot Validation:** Validate the startup sequence, ensuring the app successfully downloads the DuckDB file from S3 and connects to RDS. Confirm the `/api/health` endpoint is green.

### Subphase 2.2: Domain, DNS & OAuth Routing (~0.5 Days)
- **DNS & SSL:** Point the production domain to AWS App Runner via Route 53 (or the current DNS provider) and ensure automatic TLS certificates are issued.
- **OAuth Re-registration (CRITICAL):** Update Google Cloud Console and GitHub Developer Settings to whitelist the new AWS domain's redirect URIs to prevent social login breakage.
- **Stripe Webhooks:** Update the Stripe Dashboard to route billing webhooks to the new AWS domain (`https://yourdomain.com/api/stripe/webhook`).

### Subphase 2.3: CI/CD Pipeline & Operations (~1.0 Day)
- **Automated Deployments:** Implement a GitHub Actions pipeline so that pushing code automatically builds the image, pushes to ECR, and triggers an App Runner deployment.
- **Monitoring & Logging:** Verify CloudWatch log streaming is capturing backend output correctly.
- **Alarms & Backups:** Set up CloudWatch alarms for error rates and CPU usage, and verify that RDS automated snapshots/backups are enabled.

> **✅ PHASE 2 COMPLETE:** The application is fully live on AWS, the domain is successfully routed, Replit can be safely decommissioned, and automated deployments are active. The final payment milestone is unlocked.
