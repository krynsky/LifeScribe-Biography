import Database from "@tauri-apps/plugin-sql";
import { convertFileSrc } from "@tauri-apps/api/core";

let _db: Database | null = null;
let _dbPromise: Promise<Database> | null = null;

const MIGRATIONS_PATH = "sqlite:lifescribe.db";

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (_dbPromise) return _dbPromise;
  _dbPromise = Database.load(MIGRATIONS_PATH).then(async (db) => {
    await runMigrations(db);
    _db = db;
    return db;
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
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      for (const stmt of statements) {
        await db.execute(stmt);
      }
      await db.execute("INSERT OR IGNORE INTO _migrations (name) VALUES (?)", [name]);
    }
  }
}

// Ordered list of migration name → SQL content
const MIGRATIONS: Array<[string, string]> = [
  [
    "0001_initial_schema",
    `
CREATE TABLE IF NOT EXISTS biography (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'My Life Story',
  tagline TEXT,
  bio TEXT,
  birth_date TEXT,
  birth_place TEXT,
  cover_photo_path TEXT,
  avatar_photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

INSERT OR IGNORE INTO biography (id, title) VALUES (1, 'My Life Story');

CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT,
  content TEXT,
  excerpt TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  event_date TEXT,
  event_date_precision TEXT DEFAULT 'day' CHECK (event_date_precision IN ('year', 'month', 'day')),
  featured_image_path TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3D7A8A',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS story_categories (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, category_id)
);

CREATE TABLE IF NOT EXISTS story_tags (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, tag_id)
);

CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  date_precision TEXT DEFAULT 'day' CHECK (date_precision IN ('year', 'month', 'day')),
  category TEXT,
  color TEXT DEFAULT '#3D7A8A',
  image_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  cover_media_id INTEGER,
  date_from TEXT,
  date_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  filename TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',
  taken_at TEXT,
  camera_make TEXT,
  camera_model TEXT,
  latitude REAL,
  longitude REAL,
  album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  import_source TEXT,
  import_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_import_hash ON media(import_hash) WHERE import_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS family_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  given_name TEXT NOT NULL,
  surname TEXT,
  birth_date TEXT,
  death_date TEXT,
  birth_place TEXT,
  bio TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE TABLE IF NOT EXISTS family_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  to_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'child', 'sibling', 'spouse', 'partner', 'other')),
  UNIQUE (from_member_id, to_member_id, relationship_type)
);

CREATE TABLE IF NOT EXISTS career_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL DEFAULT 'job' CHECK (entry_type IN ('job', 'education')),
  organization TEXT NOT NULL,
  title TEXT,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  logo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE TABLE IF NOT EXISTS map_pins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT,
  visit_date TEXT,
  pin_type TEXT DEFAULT 'place' CHECK (pin_type IN ('place', 'home', 'work', 'travel', 'memory')),
  color TEXT DEFAULT '#3D7A8A',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE TABLE IF NOT EXISTS media_map_pins (
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  map_pin_id INTEGER NOT NULL REFERENCES map_pins(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, map_pin_id)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_platform TEXT NOT NULL CHECK (source_platform IN ('photos', 'facebook', 'instagram', 'linkedin', 'google_takeout', 'manual')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  archive_path TEXT,
  item_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS import_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_job_id INTEGER REFERENCES import_jobs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('story', 'milestone', 'media', 'career', 'map_pin', 'album')),
  status TEXT NOT NULL DEFAULT 'pending_curation' CHECK (status IN ('pending_curation', 'pending_review', 'accepted', 'rejected', 'skipped')),
  content TEXT NOT NULL,
  source_data TEXT,
  ai_confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_event_date ON stories(event_date);
CREATE INDEX IF NOT EXISTS idx_media_album_id ON media(album_id);
CREATE INDEX IF NOT EXISTS idx_media_taken_at ON media(taken_at);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(date);
CREATE INDEX IF NOT EXISTS idx_career_entries_dates ON career_entries(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_import_items_job ON import_items(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON import_items(status);
`,
  ],
  [
    "0002_sync_state",
    `
CREATE TABLE IF NOT EXISTS sync_state (
  entity_type           TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  remote_id             TEXT,
  last_synced_at        TEXT,
  last_synced_remote_at TEXT,
  PRIMARY KEY (entity_type, local_id)
);

INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'biography', id, remote_id, synced_at, NULL FROM biography WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'story', id, remote_id, synced_at, NULL FROM stories WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'milestone', id, remote_id, synced_at, NULL FROM milestones WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'career', id, remote_id, synced_at, NULL FROM career_entries WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'map_pin', id, remote_id, synced_at, NULL FROM map_pins WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'family_member', id, remote_id, synced_at, NULL FROM family_members WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'album', id, remote_id, synced_at, NULL FROM albums WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'media', id, remote_id, synced_at, NULL FROM media WHERE remote_id IS NOT NULL;

ALTER TABLE biography DROP COLUMN remote_id;
ALTER TABLE biography DROP COLUMN synced_at;
ALTER TABLE stories DROP COLUMN remote_id;
ALTER TABLE stories DROP COLUMN synced_at;
ALTER TABLE milestones DROP COLUMN remote_id;
ALTER TABLE milestones DROP COLUMN synced_at;
ALTER TABLE career_entries DROP COLUMN remote_id;
ALTER TABLE career_entries DROP COLUMN synced_at;
ALTER TABLE map_pins DROP COLUMN remote_id;
ALTER TABLE map_pins DROP COLUMN synced_at;
ALTER TABLE family_members DROP COLUMN remote_id;
ALTER TABLE family_members DROP COLUMN synced_at;
ALTER TABLE albums DROP COLUMN remote_id;
ALTER TABLE albums DROP COLUMN synced_at;
ALTER TABLE media DROP COLUMN remote_id;
ALTER TABLE media DROP COLUMN synced_at;
`,
  ],
  [
    "0003_media_source_url",
    `ALTER TABLE media ADD COLUMN source_url TEXT`,
  ],
];

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
