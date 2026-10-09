import Database from "@tauri-apps/plugin-sql";
import { convertFileSrc } from "@tauri-apps/api/core";

let _db: Database | null = null;
let _dbPromise: Promise<Database> | null = null;

import { MIGRATIONS, isBenignMigrationError, splitStatements } from "./migrations";

const MIGRATIONS_PATH = "sqlite:lifescribe.db";

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;
  _dbPromise = Database.load(MIGRATIONS_PATH)
    .then(async (db) => {
      await runMigrations(db);
      _db = db;
      return db;
    })
    .catch((err) => {
      // Don't cache the failure — let the next caller retry the load.
      _dbPromise = null;
      throw err;
    });
  return _dbPromise;
}

// Run SQL migrations from the migrations directory.
// We inline the migration SQL here since Tauri plugin-sql doesn't support
// reading migration files from disk in the same way as server-side ORMs.
async function runMigrations(db: Database): Promise<void> {
  // Create migration tracking table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = await db.select<Array<{ name: string }>>(
    "SELECT name FROM _migrations ORDER BY id"
  );
  const appliedNames = new Set(applied.map((r) => r.name));

  for (const [name, sql] of MIGRATIONS) {
    if (!appliedNames.has(name)) {
      // Execute each statement separately
      for (const stmt of splitStatements(sql)) {
        try {
          await db.execute(stmt);
        } catch (err) {
          // Tolerate statements that already took effect in a partially applied migration.
          if (isBenignMigrationError(stmt, err)) continue;
          throw err;
        }
      }
      await db.execute("INSERT OR IGNORE INTO _migrations (name) VALUES (?)", [name]);
    }
  }
}

// Helper to convert a local file path to a Tauri asset URL for display
export function localFileUrl(path: string): string {
  return convertFileSrc(path);
}

// Generic typed select helper
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return db.select<T[]>(sql, params);
}

// Generic execute helper (INSERT/UPDATE/DELETE)
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertId: number; rowsAffected: number }> {
  const db = await getDb();
  const result = await db.execute(sql, params);
  return {
    lastInsertId: result.lastInsertId ?? 0,
    rowsAffected: result.rowsAffected,
  };
}
