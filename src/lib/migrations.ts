// Schema migrations, kept free of Tauri imports so tests can apply them to an in-memory SQLite.
// Statements are split on ";" and chunks that start with "--" are dropped, so SQL comments
// must not appear inside a migration template literal.

/**
 * Errors that mean "this statement already took effect" (a migration that partially applied
 * before being recorded). Anything else must still fail loudly.
 */
export function isBenignMigrationError(stmt: string, err: unknown): boolean {
  const msg = String(err);
  if (/duplicate column name/i.test(msg)) return true;
  if (/no such column/i.test(msg)) {
    // A DROP COLUMN that already ran, or an idempotent backfill (INSERT OR IGNORE / UPDATE)
    // re-run after the column it reads was dropped: both mean "already done".
    if (/^ALTER TABLE \w+ DROP COLUMN/i.test(stmt)) return true;
    if (/^(INSERT OR IGNORE|UPDATE) /i.test(stmt)) return true;
  }
  return false;
}

/**
 * Split a migration into individual statements, like the app's runner does: on ";" except inside
 * a CREATE TRIGGER ... BEGIN ... END block, whose body contains its own semicolons.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let trigger: string[] | null = null;
  for (const piece of sql.split(";")) {
    const text = piece.trim();
    if (trigger) {
      trigger.push(piece);
      if (/\bEND$/i.test(text)) {
        out.push(trigger.join(";").trim());
        trigger = null;
      }
      continue;
    }
    if (text.length === 0 || text.startsWith("--")) continue;
    if (/^CREATE\s+TRIGGER\b/i.test(text) && !/\bEND$/i.test(text)) {
      trigger = [piece];
      continue;
    }
    out.push(text);
  }
  if (trigger) out.push(trigger.join(";").trim()); // unterminated trigger: let SQLite report it
  return out;
}

// Ordered list of migration name → SQL content
export const MIGRATIONS: Array<[string, string]> = [
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
  [
    "0004_album_cover_and_media_url",
    `
ALTER TABLE albums ADD COLUMN cover_image TEXT;
ALTER TABLE media ADD COLUMN remote_url TEXT;
`,
  ],
  // Existing web-linked rows predate these fields, so the trailing UPDATEs force a
  // re-pull of every row with no unpublished local edits on the next Refresh.
  // (No SQL comments inside: the runner drops any statement chunk starting with "--".)
  [
    "0005_web_parity_fields",
    `
ALTER TABLE stories ADD COLUMN category TEXT;
ALTER TABLE stories ADD COLUMN category_color TEXT;
ALTER TABLE stories ADD COLUMN category_icon TEXT;
ALTER TABLE stories ADD COLUMN tags TEXT;

ALTER TABLE milestones ADD COLUMN category_color TEXT;
ALTER TABLE milestones ADD COLUMN category_icon TEXT;

ALTER TABLE career_entries ADD COLUMN employment_type TEXT;
ALTER TABLE career_entries ADD COLUMN category TEXT;
ALTER TABLE career_entries ADD COLUMN category_color TEXT;
ALTER TABLE career_entries ADD COLUMN category_icon TEXT;

ALTER TABLE map_pins ADD COLUMN image_path TEXT;
ALTER TABLE map_pins ADD COLUMN category TEXT;
ALTER TABLE map_pins ADD COLUMN category_color TEXT;
ALTER TABLE map_pins ADD COLUMN category_icon TEXT;

ALTER TABLE family_members ADD COLUMN gender TEXT;
ALTER TABLE family_members ADD COLUMN birth_surname TEXT;
ALTER TABLE family_members ADD COLUMN nickname TEXT;
ALTER TABLE family_members ADD COLUMN suffix TEXT;

ALTER TABLE albums ADD COLUMN category TEXT;
ALTER TABLE albums ADD COLUMN category_color TEXT;
ALTER TABLE albums ADD COLUMN category_icon TEXT;
ALTER TABLE albums ADD COLUMN tags TEXT;

UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'story' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM stories t WHERE t.id = sync_state.local_id AND t.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'milestone' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM milestones t WHERE t.id = sync_state.local_id AND t.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'career' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM career_entries t WHERE t.id = sync_state.local_id AND t.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'map_pin' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM map_pins t WHERE t.id = sync_state.local_id AND t.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'family_member' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM family_members t WHERE t.id = sync_state.local_id AND t.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'album' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM albums t WHERE t.id = sync_state.local_id AND t.updated_at <= sync_state.last_synced_at);
`,
  ],
  // Second parity pass: pre-resolved display data (author, related entries, thumbnails'
  // linked stories/albums, end dates, ordering). Trailing UPDATEs force one more re-pull of
  // clean rows. (No SQL comments inside the template: the runner drops chunks starting "--".)
  [
    "0006_web_parity_display",
    `
ALTER TABLE stories ADD COLUMN author_name TEXT;
ALTER TABLE stories ADD COLUMN related TEXT;
ALTER TABLE milestones ADD COLUMN end_date TEXT;
ALTER TABLE milestones ADD COLUMN end_date_precision TEXT;
ALTER TABLE milestones ADD COLUMN linked_stories TEXT;
ALTER TABLE milestones ADD COLUMN position INTEGER;
ALTER TABLE career_entries ADD COLUMN linked_albums TEXT;
ALTER TABLE career_entries ADD COLUMN linked_stories TEXT;
ALTER TABLE map_pins ADD COLUMN linked_albums TEXT;
ALTER TABLE map_pins ADD COLUMN linked_stories TEXT;
ALTER TABLE map_pins ADD COLUMN position INTEGER;
ALTER TABLE albums ADD COLUMN position INTEGER;
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'story' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM stories x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'milestone' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM milestones x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'career' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM career_entries x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'map_pin' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM map_pins x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'family_member' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM family_members x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'album' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM albums x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
UPDATE sync_state SET last_synced_remote_at = NULL
  WHERE entity_type = 'biography' AND last_synced_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM biography x WHERE x.id = sync_state.local_id AND x.updated_at <= sync_state.last_synced_at);
`,
  ],
  // Phase 1 of edit parity: real categories/tags (category_id + join tables), local link
  // tables between stories/albums and milestones/pins/career, ordering columns. Backfills from
  // the denormalized text/JSON the sync stored, then drops those columns. (No SQL comments
  // inside the template: the runner drops chunks starting with "--".)
  [
    "0007_categories_tags_links",
    `
ALTER TABLE categories ADD COLUMN icon TEXT;
ALTER TABLE stories ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE milestones ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE career_entries ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE map_pins ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE albums ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE career_entries ADD COLUMN position INTEGER;
ALTER TABLE family_members ADD COLUMN position INTEGER;
CREATE TABLE IF NOT EXISTS album_tags (
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, tag_id)
);
CREATE TABLE IF NOT EXISTS story_milestones (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, milestone_id)
);
CREATE TABLE IF NOT EXISTS story_albums (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, album_id)
);
CREATE TABLE IF NOT EXISTS story_map_pins (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  map_pin_id INTEGER NOT NULL REFERENCES map_pins(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, map_pin_id)
);
CREATE TABLE IF NOT EXISTS story_career_entries (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  career_entry_id INTEGER NOT NULL REFERENCES career_entries(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, career_entry_id)
);
CREATE TABLE IF NOT EXISTS album_milestones (
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, milestone_id)
);
CREATE TABLE IF NOT EXISTS album_map_pins (
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  map_pin_id INTEGER NOT NULL REFERENCES map_pins(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, map_pin_id)
);
CREATE TABLE IF NOT EXISTS album_career_entries (
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  career_entry_id INTEGER NOT NULL REFERENCES career_entries(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, career_entry_id)
);
INSERT OR IGNORE INTO categories (name, slug, color, icon)
  SELECT MIN(name), lower(replace(trim(MIN(name)), ' ', '-')), COALESCE(MAX(color), '#3D7A8A'), MAX(icon) FROM (
    SELECT category AS name, category_color AS color, category_icon AS icon FROM stories WHERE category IS NOT NULL AND trim(category) <> ''
    UNION ALL
    SELECT category AS name, category_color AS color, category_icon AS icon FROM milestones WHERE category IS NOT NULL AND trim(category) <> ''
    UNION ALL
    SELECT category AS name, category_color AS color, category_icon AS icon FROM career_entries WHERE category IS NOT NULL AND trim(category) <> ''
    UNION ALL
    SELECT category AS name, category_color AS color, category_icon AS icon FROM map_pins WHERE category IS NOT NULL AND trim(category) <> ''
    UNION ALL
    SELECT category AS name, category_color AS color, category_icon AS icon FROM albums WHERE category IS NOT NULL AND trim(category) <> ''
  ) GROUP BY lower(name);
UPDATE stories SET category_id = (SELECT c.id FROM categories c WHERE lower(c.name) = lower(stories.category))
  WHERE category IS NOT NULL AND trim(category) <> '';
UPDATE milestones SET category_id = (SELECT c.id FROM categories c WHERE lower(c.name) = lower(milestones.category))
  WHERE category IS NOT NULL AND trim(category) <> '';
UPDATE career_entries SET category_id = (SELECT c.id FROM categories c WHERE lower(c.name) = lower(career_entries.category))
  WHERE category IS NOT NULL AND trim(category) <> '';
UPDATE map_pins SET category_id = (SELECT c.id FROM categories c WHERE lower(c.name) = lower(map_pins.category))
  WHERE category IS NOT NULL AND trim(category) <> '';
UPDATE albums SET category_id = (SELECT c.id FROM categories c WHERE lower(c.name) = lower(albums.category))
  WHERE category IS NOT NULL AND trim(category) <> '';
INSERT OR IGNORE INTO tags (name, slug)
  SELECT MIN(value), lower(replace(trim(MIN(value)), ' ', '-')) FROM (
    SELECT value FROM stories, json_each(CASE WHEN json_valid(stories.tags) THEN stories.tags ELSE '[]' END)
    UNION ALL
    SELECT value FROM albums, json_each(CASE WHEN json_valid(albums.tags) THEN albums.tags ELSE '[]' END)
  ) GROUP BY lower(value);
INSERT OR IGNORE INTO story_tags (story_id, tag_id)
  SELECT s.id, t.id FROM stories s, json_each(CASE WHEN json_valid(s.tags) THEN s.tags ELSE '[]' END) j
  JOIN tags t ON lower(t.name) = lower(j.value);
INSERT OR IGNORE INTO album_tags (album_id, tag_id)
  SELECT a.id, t.id FROM albums a, json_each(CASE WHEN json_valid(a.tags) THEN a.tags ELSE '[]' END) j
  JOIN tags t ON lower(t.name) = lower(j.value);
INSERT OR IGNORE INTO story_milestones (story_id, milestone_id) SELECT ss.local_id, o.id FROM milestones o, json_each(CASE WHEN json_valid(o.linked_stories) THEN o.linked_stories ELSE '[]' END) j JOIN sync_state ss ON ss.entity_type = 'story' AND ss.remote_id = json_extract(j.value, '$.remote_id');
INSERT OR IGNORE INTO story_career_entries (story_id, career_entry_id) SELECT ss.local_id, o.id FROM career_entries o, json_each(CASE WHEN json_valid(o.linked_stories) THEN o.linked_stories ELSE '[]' END) j JOIN sync_state ss ON ss.entity_type = 'story' AND ss.remote_id = json_extract(j.value, '$.remote_id');
INSERT OR IGNORE INTO album_career_entries (album_id, career_entry_id) SELECT ss.local_id, o.id FROM career_entries o, json_each(CASE WHEN json_valid(o.linked_albums) THEN o.linked_albums ELSE '[]' END) j JOIN sync_state ss ON ss.entity_type = 'album' AND ss.remote_id = json_extract(j.value, '$.remote_id');
INSERT OR IGNORE INTO story_map_pins (story_id, map_pin_id) SELECT ss.local_id, o.id FROM map_pins o, json_each(CASE WHEN json_valid(o.linked_stories) THEN o.linked_stories ELSE '[]' END) j JOIN sync_state ss ON ss.entity_type = 'story' AND ss.remote_id = json_extract(j.value, '$.remote_id');
INSERT OR IGNORE INTO album_map_pins (album_id, map_pin_id) SELECT ss.local_id, o.id FROM map_pins o, json_each(CASE WHEN json_valid(o.linked_albums) THEN o.linked_albums ELSE '[]' END) j JOIN sync_state ss ON ss.entity_type = 'album' AND ss.remote_id = json_extract(j.value, '$.remote_id');
INSERT OR IGNORE INTO story_albums (story_id, album_id) SELECT o.id, ss.local_id FROM stories o, json_each(CASE WHEN json_valid(o.related) THEN json_extract(o.related, '$.albums') ELSE '[]' END) j JOIN sync_state ss ON ss.entity_type = 'album' AND ss.remote_id = json_extract(j.value, '$.remote_id');
ALTER TABLE stories DROP COLUMN category;
ALTER TABLE stories DROP COLUMN category_color;
ALTER TABLE stories DROP COLUMN category_icon;
ALTER TABLE stories DROP COLUMN tags;
ALTER TABLE stories DROP COLUMN related;
ALTER TABLE milestones DROP COLUMN category;
ALTER TABLE milestones DROP COLUMN category_color;
ALTER TABLE milestones DROP COLUMN category_icon;
ALTER TABLE milestones DROP COLUMN linked_stories;
ALTER TABLE career_entries DROP COLUMN category;
ALTER TABLE career_entries DROP COLUMN category_color;
ALTER TABLE career_entries DROP COLUMN category_icon;
ALTER TABLE career_entries DROP COLUMN linked_albums;
ALTER TABLE career_entries DROP COLUMN linked_stories;
ALTER TABLE map_pins DROP COLUMN category;
ALTER TABLE map_pins DROP COLUMN category_color;
ALTER TABLE map_pins DROP COLUMN category_icon;
ALTER TABLE map_pins DROP COLUMN linked_albums;
ALTER TABLE map_pins DROP COLUMN linked_stories;
ALTER TABLE albums DROP COLUMN category;
ALTER TABLE albums DROP COLUMN category_color;
ALTER TABLE albums DROP COLUMN category_icon;
ALTER TABLE albums DROP COLUMN tags;
`,
  ],
  // Profile: the formal name of the person the biography is about (same fields as the web site settings).
  [
    "0008_biography_subject_name",
    `
ALTER TABLE biography ADD COLUMN subject_first_name TEXT;
ALTER TABLE biography ADD COLUMN subject_middle_name TEXT;
ALTER TABLE biography ADD COLUMN subject_last_name TEXT;
ALTER TABLE biography ADD COLUMN subject_maiden_name TEXT;
ALTER TABLE biography ADD COLUMN subject_suffix TEXT
`,
  ],
  // Remembers which photo files were already uploaded to the website (by content hash), so
  // publishing again never uploads the same photo twice.
  [
    "0009_uploaded_images",
    `
CREATE TABLE IF NOT EXISTS uploaded_images (
  content_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
)
`,
  ],
  // Records deleted in the app that already exist on the website. Triggers write them here (and clear the
  // record's sync bookkeeping) so deleting is remembered no matter which screen did it. Publishing then
  // asks whether to remove them from the website; Refresh never brings them back meanwhile.
  [
    "0010_sync_deletions",
    `
CREATE TABLE IF NOT EXISTS sync_deletions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  remote_id TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  deleted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TRIGGER IF NOT EXISTS trg_tombstone_story AFTER DELETE ON stories
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'story', remote_id, OLD.title FROM sync_state
     WHERE entity_type = 'story' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'story' AND local_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_milestone AFTER DELETE ON milestones
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'milestone', remote_id, OLD.title FROM sync_state
     WHERE entity_type = 'milestone' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'milestone' AND local_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_career AFTER DELETE ON career_entries
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'career', remote_id, COALESCE(OLD.title || ' @ ', '') || OLD.organization FROM sync_state
     WHERE entity_type = 'career' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'career' AND local_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_map_pin AFTER DELETE ON map_pins
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'map_pin', remote_id, OLD.name FROM sync_state
     WHERE entity_type = 'map_pin' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'map_pin' AND local_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_family_member AFTER DELETE ON family_members
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'family_member', remote_id, OLD.given_name || COALESCE(' ' || OLD.surname, '') FROM sync_state
     WHERE entity_type = 'family_member' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'family_member' AND local_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_album AFTER DELETE ON albums
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'album', remote_id, OLD.name FROM sync_state
     WHERE entity_type = 'album' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'album' AND local_id = OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_tombstone_media AFTER DELETE ON media
BEGIN
  INSERT OR IGNORE INTO sync_deletions (entity_type, remote_id, label)
    SELECT 'media', remote_id, OLD.filename FROM sync_state
     WHERE entity_type = 'media' AND local_id = OLD.id AND remote_id IS NOT NULL;
  DELETE FROM sync_state WHERE entity_type = 'media' AND local_id = OLD.id;
END;
`,
  ],
];

