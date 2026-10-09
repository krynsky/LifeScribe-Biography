import Database from "better-sqlite3";
import { MIGRATIONS, isBenignMigrationError, splitStatements } from "../migrations";
import type { SqlRunner } from "./sql";

/** A fully-migrated in-memory database plus a SqlRunner over it. For tests only. */
export function createTestDb(): { db: Database.Database; runner: SqlRunner } {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const [, sql] of MIGRATIONS) {
    for (const stmt of splitStatements(sql)) {
      try {
        db.exec(stmt);
      } catch (e) {
        if (!isBenignMigrationError(stmt, e)) throw e;
      }
    }
  }
  const runner: SqlRunner = {
    async select<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async execute(sql: string, params: unknown[] = []) {
      const res = db.prepare(sql).run(...(params as never[]));
      return { lastInsertId: Number(res.lastInsertRowid), rowsAffected: res.changes };
    },
  };
  return { db, runner };
}
