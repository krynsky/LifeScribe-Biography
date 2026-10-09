import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { MIGRATIONS, isBenignMigrationError, splitStatements } from "./migrations";

/** Apply migrations [0, upTo) to a fresh in-memory DB, exactly like the app runner. */
export function migrate(db: Database.Database, upTo = MIGRATIONS.length): void {
  for (const [, sql] of MIGRATIONS.slice(0, upTo)) {
    for (const stmt of splitStatements(sql)) {
      try {
        db.exec(stmt);
      } catch (e) {
        if (isBenignMigrationError(stmt, e)) continue;
        throw e;
      }
    }
  }
}

describe("migrations", () => {
  it("apply cleanly in order to an empty database", () => {
    const db = new Database(":memory:");
    migrate(db);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);
    for (const t of ["stories", "milestones", "career_entries", "map_pins", "family_members", "albums", "media", "sync_state", "categories", "tags"]) {
      expect(tables).toContain(t);
    }
  });
});

describe("0008_biography_subject_name", () => {
  it("adds the subject name columns, keeping the existing biography row", () => {
    const db = new Database(":memory:");
    migrate(db);
    const cols = (db.prepare("PRAGMA table_info(biography)").all() as { name: string }[]).map((c) => c.name);
    for (const c of ["subject_first_name", "subject_middle_name", "subject_last_name", "subject_maiden_name", "subject_suffix"]) {
      expect(cols).toContain(c);
    }
    expect(db.prepare("SELECT title FROM biography WHERE id = 1").get()).toEqual({ title: "My Life Story" });
  });
});

describe("0007_categories_tags_links backfill", () => {
  function seededAtV6() {
    const db = new Database(":memory:");
    migrate(db, 6);
    db.exec(`
      INSERT INTO stories (id, title, status, category, category_color, category_icon, tags, related)
        VALUES (1, 'S1', 'published', 'Family', '#ff0000', '👨‍👩‍👧', '["Chicago","Family Trip"]', '{"albums":[{"remote_id":"alb-1","title":"A"}]}'),
               (2, 'S2', 'published', 'family', NULL, NULL, 'not json', NULL),
               (3, 'S3', 'draft', NULL, NULL, NULL, NULL, NULL);
      INSERT INTO milestones (id, title, date, category, linked_stories) VALUES (1, 'M1', '2000-01-01', 'Travel', '[{"remote_id":"st-1","title":"S1"}]');
      INSERT INTO albums (id, name, category, tags) VALUES (1, 'A', 'Experiences', '["chicago"]');
      INSERT INTO career_entries (id, organization, linked_stories, linked_albums) VALUES (1, 'Org', '[{"remote_id":"st-1"}]', '[{"remote_id":"alb-1"}]');
      INSERT INTO map_pins (id, name, latitude, longitude, linked_stories) VALUES (1, 'P', 1, 2, '[{"remote_id":"st-1"}]');
      INSERT INTO sync_state (entity_type, local_id, remote_id) VALUES ('story', 1, 'st-1'), ('album', 1, 'alb-1');
    `);
    return db;
  }
  const run7 = (db: Database.Database) => {
    for (const stmt of splitStatements(MIGRATIONS[6][1])) db.exec(stmt);
  };

  it("turns category text into shared category records (case-insensitive) and assigns ids", () => {
    const db = seededAtV6();
    run7(db);
    const cats = db.prepare("SELECT name, color, icon FROM categories ORDER BY name").all() as { name: string; color: string }[];
    expect(cats.map((c) => c.name)).toEqual(["Experiences", "Family", "Travel"]);
    expect(cats.find((c) => c.name === "Family")?.color).toBe("#ff0000");
    const s = db.prepare("SELECT id, category_id FROM stories ORDER BY id").all() as { id: number; category_id: number | null }[];
    expect(s[0].category_id).toBe(s[1].category_id); // "Family" and "family" are one category
    expect(s[0].category_id).not.toBeNull();
    expect(s[2].category_id).toBeNull();
  });

  it("turns JSON tags into tag records and join rows, ignoring junk", () => {
    const db = seededAtV6();
    run7(db);
    const tags = (db.prepare("SELECT name FROM tags ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    expect(tags).toEqual(["Chicago", "Family Trip"]); // "chicago" on the album merges with "Chicago"
    expect(db.prepare("SELECT COUNT(*) c FROM story_tags").get()).toEqual({ c: 2 });
    expect(db.prepare("SELECT COUNT(*) c FROM album_tags").get()).toEqual({ c: 1 });
  });

  it("rebuilds link rows from remote ids and drops the denormalized columns", () => {
    const db = seededAtV6();
    run7(db);
    expect(db.prepare("SELECT story_id, milestone_id FROM story_milestones").all()).toEqual([{ story_id: 1, milestone_id: 1 }]);
    expect(db.prepare("SELECT story_id, career_entry_id FROM story_career_entries").all()).toEqual([{ story_id: 1, career_entry_id: 1 }]);
    expect(db.prepare("SELECT album_id, career_entry_id FROM album_career_entries").all()).toEqual([{ album_id: 1, career_entry_id: 1 }]);
    expect(db.prepare("SELECT story_id, map_pin_id FROM story_map_pins").all()).toEqual([{ story_id: 1, map_pin_id: 1 }]);
    expect(db.prepare("SELECT story_id, album_id FROM story_albums").all()).toEqual([{ story_id: 1, album_id: 1 }]);
    const cols = (db.prepare("PRAGMA table_info(stories)").all() as { name: string }[]).map((c) => c.name);
    for (const gone of ["category", "category_color", "tags", "related"]) expect(cols).not.toContain(gone);
    expect(cols).toContain("category_id");
  });

  it("is safe to re-run after a partial application", () => {
    const db = seededAtV6();
    run7(db);
    for (const stmt of splitStatements(MIGRATIONS[6][1])) {
      try {
        db.exec(stmt);
      } catch (e) {
        if (!isBenignMigrationError(stmt, e)) throw e;
      }
    }
  });
});
