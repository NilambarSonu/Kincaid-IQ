import "dotenv/config";

// Runtime configuration. Keep real secrets in Replit Secrets, never in code or a
// committed .env file.
export const config = {
  // Dedicated port var. We deliberately do NOT read process.env.PORT because the
  // host platform may pin PORT to another service (the sibling FastAPI app uses 5000).
  port: Number(process.env.KINCAID_BFF_PORT ?? 8787),
  // DEMO_OPEN_AUTH=1 is demo only. Remove for any shared or production deployment
  // and wire the 8 role RBAC sign in.
  demoOpenAuth: process.env.DEMO_OPEN_AUTH !== "0",
  // The seed writes this file. Deterministic business data lives here.
  dbPath: process.env.DB_PATH ?? "kincaid-demo.db",
  env: process.env.NODE_ENV ?? "development",
};
