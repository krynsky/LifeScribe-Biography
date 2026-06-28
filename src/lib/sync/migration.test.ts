import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";

// A representative slice of migration 0002 (stories only) to prove backfill + drop.
const MIGRATION_0002 = `
CREATE TABLE sync_state (
  entity_type TEXT NOT NULL, local_id INTEGER NOT NULL, remote_id TEXT,
  last_synced_at TEXT, last_synced_remote_at TEXT, PRIMARY KEY (entity_type, local_id)
);
INSERT OR IGNORE INTO sync_state SELECT 'story', id, remote_id, synced_at, NULL FROM stories WHERE remote_id IS NOT NULL;
ALTER TABLE stories DROP COLUMN remote_id;
ALTER TABLE stories DROP COLUMN synced_at;
`;

describe("migration 0002_sync_state", () => {
  it("backfills sync_state from remote_id and drops the columns", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE stories (id INTEGER PRIMARY KEY, title TEXT, updated_at TEXT, synced_at TEXT, remote_id TEXT);
      INSERT INTO stories (id, title, updated_at, synced_at, remote_id) VALUES (1, 'A', '2026-01-01', '2026-01-01', 'r1');
      INSERT INTO stories (id, title, updated_at, synced_at, remote_id) VALUES (2, 'B', '2026-01-01', NULL, NULL);
    `);

    db.exec(MIGRATION_0002);

    const states = db.prepare("SELECT * FROM sync_state").all() as Array<{ remote_id: string; local_id: number }>;
    expect(states).toHaveLength(1);
    expect(states[0].remote_id).toBe("r1");
    expect(states[0].local_id).toBe(1);

    const cols = db.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).not.toContain("remote_id");
    expect(names).not.toContain("synced_at");
    expect(names).toContain("title");
  });
});
