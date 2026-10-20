import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync as Database } from "node:sqlite";

// Loaded from Node itself rather than imported, so the dev server's hot reload keeps
// working when this file changes (see lib/db.ts).
const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
type DatabaseSync = Database;

// User accounts live in their own database, separate from the pipeline's stocks.db.
export const APP_DB_PATH =
  process.env.CANETF_APP_DB_PATH ?? path.join(process.cwd(), "data", "app.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,  -- stored as typed, compared case-insensitively
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (              -- one row per signed-in browser
    id         TEXT PRIMARY KEY,                     -- SHA-256 of the cookie token, never the token itself
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profiles (              -- latest onboarding answers per user
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    answers    TEXT NOT NULL,                        -- JSON
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS watchlist (             -- companies and ETFs each user follows
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol   TEXT NOT NULL,                          -- a companies.symbol in stocks.db
    added_at TEXT NOT NULL,
    PRIMARY KEY (user_id, symbol)
);
`;

let db: DatabaseSync | undefined;

export function getAppDb() {
  if (!db) {
    mkdirSync(path.dirname(APP_DB_PATH), { recursive: true });
    db = new DatabaseSync(APP_DB_PATH);
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    db.exec(SCHEMA);
    migrate(db);
  }
  return db;
}

// Upgrades databases created by older versions of the schema above.
function migrate(db: DatabaseSync) {
  const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];

  // Accounts used to be identified by email; existing values become usernames.
  if (userColumns.some((c) => c.name === "email")) {
    db.exec("ALTER TABLE users RENAME COLUMN email TO username");
  }
}
