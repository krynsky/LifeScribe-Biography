import { describe, it, expect } from "vitest";
import { createTestDb } from "../data/test-runner";
import { splitStatements } from "../migrations";

describe("splitStatements", () => {
  it("keeps a trigger body together and splits ordinary statements", () => {
    const sql = `
CREATE TABLE a (x);
CREATE TRIGGER t AFTER DELETE ON a
BEGIN
  INSERT INTO a VALUES (1);
  DELETE FROM a WHERE x = 2;
END;
INSERT INTO a VALUES (3)`;
    const out = splitStatements(sql);
    expect(out).toHaveLength(3);
    expect(out[1]).toMatch(/^CREATE TRIGGER t[\s\S]*DELETE FROM a WHERE x = 2;\s*END$/);
    expect(out[2]).toBe("INSERT INTO a VALUES (3)");
  });
});

function link(db: import("better-sqlite3").Database, type: string, localId: number, remoteId: string) {
  db.prepare("INSERT INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at) VALUES (?,?,?,?,?)").run(type, localId, remoteId, "t", "t");
}

describe("deletion tombstones (migration 0010)", () => {
  it("remembers a published story that is deleted, and clears its sync bookkeeping", () => {
    const { db } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'Trip to Argentina')");
    link(db, "story", 1, "r-story");
    db.exec("DELETE FROM stories WHERE id = 1");
    expect(db.prepare("SELECT entity_type, remote_id, label FROM sync_deletions").all()).toEqual([{ entity_type: "story", remote_id: "r-story", label: "Trip to Argentina" }]);
    expect(db.prepare("SELECT COUNT(*) c FROM sync_state WHERE entity_type = 'story'").get()).toEqual({ c: 0 });
  });

  it("ignores records that were never on the website", () => {
    const { db } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'Local only')");
    db.exec("DELETE FROM stories WHERE id = 1");
    expect(db.prepare("SELECT COUNT(*) c FROM sync_deletions").get()).toEqual({ c: 0 });
  });

  it("covers every synced type with a readable label", () => {
    const { db } = createTestDb();
    db.exec(`
      INSERT INTO milestones (id, title, date) VALUES (1, 'Born', '1966-01-01');
      INSERT INTO career_entries (id, organization, title) VALUES (1, 'Kaiser', 'Architect');
      INSERT INTO career_entries (id, organization) VALUES (2, 'NoTitle Inc');
      INSERT INTO map_pins (id, name, latitude, longitude) VALUES (1, 'Home', 1, 2);
      INSERT INTO family_members (id, given_name, surname) VALUES (1, 'Jane', 'Doe');
      INSERT INTO family_members (id, given_name) VALUES (2, 'Cher');
      INSERT INTO albums (id, name) VALUES (1, 'Trip');
      INSERT INTO media (id, file_path, filename) VALUES (1, '/a.jpg', 'a.jpg');
    `);
    const links: Array<[string, number, string]> = [
      ["milestone", 1, "m"], ["career", 1, "c1"], ["career", 2, "c2"], ["map_pin", 1, "p"],
      ["family_member", 1, "f1"], ["family_member", 2, "f2"], ["album", 1, "a"], ["media", 1, "x"],
    ];
    for (const [t, id, rid] of links) link(db, t, id, rid);
    db.exec("DELETE FROM milestones; DELETE FROM career_entries; DELETE FROM map_pins; DELETE FROM family_members; DELETE FROM albums; DELETE FROM media;");
    const labels = Object.fromEntries((db.prepare("SELECT remote_id, label FROM sync_deletions").all() as { remote_id: string; label: string }[]).map((r) => [r.remote_id, r.label]));
    expect(labels).toEqual({ m: "Born", c1: "Architect @ Kaiser", c2: "NoTitle Inc", p: "Home", f1: "Jane Doe", f2: "Cher", a: "Trip", x: "a.jpg" });
  });

  it("is idempotent per website record", () => {
    const { db } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'A'), (2, 'B')");
    link(db, "story", 1, "same");
    link(db, "story", 2, "same");
    db.exec("DELETE FROM stories");
    expect(db.prepare("SELECT COUNT(*) c FROM sync_deletions").get()).toEqual({ c: 1 });
  });
});
