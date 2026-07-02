import pkg from "node-sqlite3-wasm";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

const { Database } = pkg;

const dir = dirname(config.dbPath);
if (dir && dir !== ".") mkdirSync(dir, { recursive: true });

// We use node-sqlite3-wasm (pure WASM, no native build) instead of better-sqlite3
// because this environment has no prebuilt better-sqlite3 binary and cannot compile
// it from source. The WASM build needs no toolchain and persists to a real file.
const raw = new Database(config.dbPath);
raw.exec("PRAGMA foreign_keys = ON");

type Param = string | number | bigint | null;

interface Stmt {
  run: (...args: Param[]) => { changes: number; lastInsertRowid: number | bigint };
  get: <T = unknown>(...args: Param[]) => T | undefined;
  all: <T = unknown>(...args: Param[]) => T[];
}

// Thin better-sqlite3 style surface over the WASM binding. The WASM binding only
// binds an array of params (positional varargs are silently dropped), so we always
// collect args into an array. The db level helpers prepare and finalize internally,
// so there is no statement lifecycle to leak.
export const db = {
  exec(sql: string): void {
    raw.exec(sql);
  },
  prepare(sql: string): Stmt {
    return {
      run: (...args: Param[]) =>
        raw.run(sql, args.length ? args : undefined) as { changes: number; lastInsertRowid: number | bigint },
      get: <T = unknown>(...args: Param[]) => (raw.get(sql, args.length ? args : undefined) ?? undefined) as T | undefined,
      all: <T = unknown>(...args: Param[]) => raw.all(sql, args.length ? args : undefined) as T[],
    };
  },
  close(): void {
    raw.close();
  },
};

// Idempotent schema. Safe to call on every boot.
export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      member_months INTEGER NOT NULL,
      total_cost REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      paid REAL NOT NULL,
      allowable REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence_ledger (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      ts TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      subject TEXT,
      payload TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    );
  `);
}
