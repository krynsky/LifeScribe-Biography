import { query, execute } from "../db";

/**
 * Minimal SQL interface. The app binds it to the Tauri SQLite plugin; tests bind it to an
 * in-memory better-sqlite3 database, so data-layer logic can be exercised without Tauri.
 */
export interface SqlRunner {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ lastInsertId: number; rowsAffected: number }>;
}

export const appRunner: SqlRunner = {
  select: (sql, params = []) => query(sql, params),
  execute: (sql, params = []) => execute(sql, params),
};
