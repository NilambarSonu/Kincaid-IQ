import { Router, type IRouter, type Request } from "express";
import { createHash } from "node:crypto";
import { db } from "./db.js";
import { authMiddleware, requirePerm, type AuthedUser } from "./auth.js";
import { appendEvidence, getChain, verifyChain } from "./ledger.js";
import { computeExecutiveSurface, getClaims, getPlans } from "./compute.js";

const router: IRouter = Router();

function user(req: Request): AuthedUser {
  return (req as Request & { user?: AuthedUser }).user as AuthedUser;
}

// Public health check. npm run health hits this.
router.get("/health", (_req, res) => {
  const count = (table: string): number =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
  res.json({
    status: "ok",
    service: "kincaid-iq-bff",
    ts: new Date().toISOString(),
    counts: {
      organizations: count("organizations"),
      users: count("users"),
      plans: count("plans"),
      claims: count("claims"),
      evidence: count("evidence_ledger"),
    },
  });
});

// Everything below requires an authenticated principal.
router.use(authMiddleware);

router.get("/api/me", (req, res) => {
  res.json(user(req));
});

// Hard Rule: one screen, four tiles, always. Every tile carries a drill target
// and a SHA-256 receipt over its evidence.
router.get("/tiles/executive", requirePerm("metrics:read"), (req, res) => {
  res.json(computeExecutiveSurface(user(req).org_id));
});

// Drill targets behind the tiles. Every number on a tile is clickable into these.
router.get("/api/plans", requirePerm("metrics:read"), (req, res) => {
  res.json({ plans: getPlans(user(req).org_id) });
});

router.get("/api/claims", requirePerm("metrics:read"), (req, res) => {
  res.json({ claims: getClaims(user(req).org_id) });
});

router.get("/api/evidence", requirePerm("evidence:read"), (_req, res) => {
  res.json({ chain: getChain() });
});

// Replay and verify the SHA-256 hash chain. The verification itself is recorded
// as a new ledger entry so the act of auditing is also auditable.
router.get("/api/verify", requirePerm("evidence:verify"), (req, res) => {
  const result = verifyChain();
  appendEvidence({ actor: user(req).email, action: "evidence.verify", payload: result });
  res.json(result);
});

// Hard Rule: no export without a SHA-256 evidence manifest. We refuse to export
// if the ledger does not verify, and we record the manifest hash back into the chain.
router.post("/api/export", requirePerm("export:create"), (req, res) => {
  const u = user(req);
  const integrity = verifyChain();
  if (!integrity.ok) {
    res.status(409).json({ error: "LEDGER_BROKEN", detail: integrity });
    return;
  }
  const surface = computeExecutiveSurface(u.org_id);
  const plans = getPlans(u.org_id);
  const claims = getClaims(u.org_id);
  const body = JSON.stringify({
    org: u.org_id,
    surface: surface.tiles,
    plans,
    claims,
  });
  const manifestSha = createHash("sha256").update(body).digest("hex");
  const ledgerHead = integrity.head;
  appendEvidence({
    actor: u.email,
    action: "export.create",
    subject: manifestSha,
    payload: { manifestSha, ledgerHead, planCount: plans.length, claimCount: claims.length },
  });
  res.json({
    manifest: {
      sha256: manifestSha,
      ledgerHead,
      result_sha256: surface.result_sha256,
      generated_at: new Date().toISOString(),
      generated_by: u.email,
    },
    payload: JSON.parse(body),
  });
});

export default router;
