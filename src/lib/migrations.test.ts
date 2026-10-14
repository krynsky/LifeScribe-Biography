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
    for (const t of ["stories", "milestones", "career_entries", "map_pins", "family_members", "albums", "media", "categories", "tags"]) {
      expect(tables).toContain(t);
    }
  });
});

describe("0009_uploaded_images", () => {
  it("creates the upload cache keyed by content hash", () => {
    const db = new Database(":memory:");
    migrate(db, 9);
    db.prepare("INSERT INTO uploaded_images (content_hash, url) VALUES (?, ?)").run("abc", "https://x/a.jpg");
    expect(() => db.prepare("INSERT INTO uploaded_images (content_hash, url) VALUES (?, ?)").run("abc", "https://x/b.jpg")).toThrow();
    expect(db.prepare("SELECT url FROM uploaded_images WHERE content_hash = 'abc'").get()).toEqual({ url: "https://x/a.jpg" });
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

describe("0011_drop_sync_tables", () => {
  it("removes the sync tables and triggers, and deleting records still works", () => {
    const db = new Database(":memory:");
    migrate(db);
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'sync_%' OR name LIKE 'trg_tombstone%' OR name = 'uploaded_images'").all() as { name: string }[]).map((r) => r.name);
    expect(names).toEqual([]);
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'S'); INSERT INTO albums (id, name) VALUES (1, 'A')");
    expect(() => db.exec("DELETE FROM stories WHERE id = 1; DELETE FROM albums WHERE id = 1")).not.toThrow();
  });

  it("upgrades a database that already has sync data", () => {
    const db = new Database(":memory:");
    migrate(db, 10);
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'S'); INSERT INTO sync_state (entity_type, local_id, remote_id) VALUES ('story', 1, 'st-1')");
    db.exec("DELETE FROM stories WHERE id = 1");
    migrate(db);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('sync_state','sync_deletions')").all()).toEqual([]);
  });
});

describe("0012_drop_web_cover_fields", () => {
  it("turns an album's web cover URL into a chosen cover before dropping the columns", () => {
    const db = new Database(":memory:");
    migrate(db, 11);
    db.exec(`
      INSERT INTO albums (id, name, cover_image) VALUES (1, 'Trip', 'https://x/b.jpg'), (2, 'Plain', NULL);
      INSERT INTO media (id, file_path, filename, album_id, sort_order, remote_url) VALUES
        (1, '/a.jpg', 'a.jpg', 1, 1, NULL), (2, '/b.jpg', 'b.jpg', 1, 2, 'https://x/b.jpg');
    `);
    migrate(db);
    expect(db.prepare("SELECT id, cover_media_id FROM albums ORDER BY id").all()).toEqual([
      { id: 1, cover_media_id: 2 },
      { id: 2, cover_media_id: null },
    ]);
    const cols = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    expect(cols("albums")).not.toContain("cover_image");
    expect(cols("media")).not.toContain("remote_url");
  });
});
