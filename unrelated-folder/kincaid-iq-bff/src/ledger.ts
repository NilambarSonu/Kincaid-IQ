import { createHash, randomUUID } from "node:crypto";
import { db } from "./db.js";

// Genesis hash for the first ledger entry.
const GENESIS = "0".repeat(64);

// Deterministic, key sorted JSON so the same logical payload always hashes the same.
export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

interface EntryCore {
  id: string;
  ts: string;
  actor: string;
  action: string;
  subject: string | null;
  payload: unknown;
}

export function hashEntry(prevHash: string, e: EntryCore): string {
  const material =
    prevHash +
    canonical({ id: e.id, ts: e.ts, actor: e.actor, action: e.action, subject: e.subject, payload: e.payload });
  return createHash("sha256").update(material).digest("hex");
}

export function lastHash(): string {
  const row = db.prepare("SELECT hash FROM evidence_ledger ORDER BY seq DESC LIMIT 1").get() as
    | { hash: string }
    | undefined;
  return row?.hash ?? GENESIS;
}

export interface AppendInput {
  actor: string;
  action: string;
  subject?: string | null;
  payload: unknown;
}

export function appendEvidence(input: AppendInput): { id: string; ts: string; hash: string; prev_hash: string } {
  const id = randomUUID();
  const ts = new Date().toISOString();
  const subject = input.subject ?? null;
  const prev = lastHash();
  const hash = hashEntry(prev, { id, ts, actor: input.actor, action: input.action, subject, payload: input.payload });
  db.prepare(
    "INSERT INTO evidence_ledger (id, ts, actor, action, subject, payload, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?)",
  ).run(id, ts, input.actor, input.action, subject, canonical(input.payload), prev, hash);
  return { id, ts, hash, prev_hash: prev };
}

export interface LedgerRow {
  seq: number;
  id: string;
  ts: string;
  actor: string;
  action: string;
  subject: string | null;
  payload: string;
  prev_hash: string;
  hash: string;
}

export function getChain(): LedgerRow[] {
  return db.prepare("SELECT * FROM evidence_ledger ORDER BY seq ASC").all() as LedgerRow[];
}

export interface VerifyResult {
  ok: boolean;
  length: number;
  brokenAt: number | null;
  reason: string | null;
  head: string | null;
}

// Replay the chain from genesis, recomputing every hash. Detects any tampering,
// reordering, or broken link. This backs the Hard Rule that narratives never
// outrun evidence and that no export ships without a verifiable manifest.
export function verifyChain(): VerifyResult {
  const rows = getChain();
  let prev = GENESIS;
  for (const r of rows) {
    if (r.prev_hash !== prev) {
      return { ok: false, length: rows.length, brokenAt: r.seq, reason: "prev_hash mismatch", head: null };
    }
    const recomputed = hashEntry(prev, {
      id: r.id,
      ts: r.ts,
      actor: r.actor,
      action: r.action,
      subject: r.subject,
      payload: JSON.parse(r.payload),
    });
    if (recomputed !== r.hash) {
      return { ok: false, length: rows.length, brokenAt: r.seq, reason: "hash mismatch", head: null };
    }
    prev = r.hash;
  }
  return { ok: true, length: rows.length, brokenAt: null, reason: null, head: rows.length ? prev : null };
}
