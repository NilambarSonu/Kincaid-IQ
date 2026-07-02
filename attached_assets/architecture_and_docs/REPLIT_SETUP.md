# REPLIT_SETUP.md — boot config (copy each block into the named file)

No em dashes. Three blocks: .replit, replit.nix, and the one-time setup commands.

================================================================
FILE: .replit
================================================================
run = "npm run dev"
entrypoint = "kincaid-iq-bff-server.ts"

[env]
DEMO_OPEN_AUTH = "1"
PORT = "8787"

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "npm run start"]
deploymentTarget = "cloudrun"

[[ports]]
localPort = 8787
externalPort = 80

================================================================
FILE: replit.nix
================================================================
{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.jq
    pkgs.curl
  ];
}

================================================================
ONE-TIME SETUP (run in the Replit shell)
================================================================
# Node BFF (primary process, port 8787)
npm install
npm run dev          # boots Express + better-sqlite3 BFF
npm run seed         # seeds demo data
npm run health       # confirms the BFF is up
npm run verify       # walks the evidence ledger chain

# FastAPI + DuckDB analytical core (optional parallel service)
python -m pip install fastapi uvicorn duckdb pydantic
uvicorn routes:app --host 0.0.0.0 --port 8000

================================================================
NOTES
================================================================
- better-sqlite3 is embedded, so the BFF runs with no external database.
- The BFF is the Replit native entry point. The FastAPI plus DuckDB core is the heavy
  analytical engine and can run in a parallel workspace tab or a second Repl.
- DEMO_OPEN_AUTH=1 is for demo only. Remove it for any shared or production deployment and
  wire the 8-role RBAC instead.
- Keep secrets (PAT for GitHub push, any API keys) in Replit Secrets, never in code.
