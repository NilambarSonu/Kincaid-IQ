import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { db } from "./db.js";

// 8 role RBAC. The buyer is the CFO, the PE operating partner, the deal team,
// the board. The buyer is never HR. owner and admin administer; the consumer
// roles read and drill; auditor verifies the ledger; viewer is read only.
export const ROLES = [
  "owner",
  "admin",
  "cfo",
  "pe_operating_partner",
  "deal_team",
  "board_member",
  "auditor",
  "viewer",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS: Record<Role, string[]> = {
  owner: ["*"],
  admin: ["org:manage", "metrics:read", "metrics:write", "evidence:read", "evidence:verify", "export:create"],
  cfo: ["metrics:read", "evidence:read", "evidence:verify", "export:create"],
  pe_operating_partner: ["metrics:read", "evidence:read", "evidence:verify", "export:create"],
  deal_team: ["metrics:read", "evidence:read", "export:create"],
  board_member: ["metrics:read", "evidence:read"],
  auditor: ["metrics:read", "evidence:read", "evidence:verify"],
  viewer: ["metrics:read"],
};

export function can(role: Role, perm: string): boolean {
  const granted = PERMISSIONS[role] ?? [];
  return granted.includes("*") || granted.includes(perm);
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  org_id: string;
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

// Demo only resolver. With DEMO_OPEN_AUTH enabled the caller selects a role via the
// x-demo-role header and we resolve a seeded user for it. A missing or unrecognized
// role resolves to least privilege (viewer), never owner, so the header can only
// ever raise access deliberately. With demo auth off, real sign in is not wired yet
// so we fail explicitly rather than silently granting access.
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!config.demoOpenAuth) {
    res.status(501).json({
      error: "AUTH_NOT_CONFIGURED",
      message: "Real auth is not wired. Set DEMO_OPEN_AUTH=1 for demo only, or implement the 8 role RBAC sign in.",
    });
    return;
  }
  const header = (req.header("x-demo-role") ?? "viewer").trim();
  const role: Role = isRole(header) ? header : "viewer";
  const row = db.prepare("SELECT id, email, name, role, org_id FROM users WHERE role = ? LIMIT 1").get(role) as
    | AuthedUser
    | undefined;
  (req as Request & { user?: AuthedUser }).user =
    row ?? { id: "demo", email: "demo@kincaidiq.local", name: `Demo ${role}`, role, org_id: "org-demo" };
  next();
}

export function requirePerm(perm: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: AuthedUser }).user;
    if (!user) {
      res.status(401).json({ error: "UNAUTHENTICATED" });
      return;
    }
    if (!can(user.role, perm)) {
      res.status(403).json({ error: "FORBIDDEN", needs: perm, role: user.role });
      return;
    }
    next();
  };
}
