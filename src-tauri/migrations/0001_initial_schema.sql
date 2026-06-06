-- LifeScribe Initial Schema
-- Mirrors the LifeScribe Prisma schema adapted for SQLite

-- Migration tracking (self-managed)
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Single biography per app instance
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

-- Insert default biography row
INSERT OR IGNORE INTO biography (id, title) VALUES (1, 'My Life Story');

-- Stories (rich text posts, Tiptap JSON format)
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT,
  content TEXT,          -- Tiptap JSON as string
  excerpt TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  event_date TEXT,       -- ISO date string
  event_date_precision TEXT DEFAULT 'day' CHECK (event_date_precision IN ('year', 'month', 'day')),
  featured_image_path TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3D7A8A',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Story ↔ Category junction
CREATE TABLE IF NOT EXISTS story_categories (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, category_id)
);

-- Story ↔ Tag junction
CREATE TABLE IF NOT EXISTS story_tags (
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, tag_id)
);

-- Timeline milestones
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

-- Albums
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

-- Media (photos, referenced by local file path)
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
  -- EXIF metadata
  taken_at TEXT,
  camera_make TEXT,
  camera_model TEXT,
  latitude REAL,
  longitude REAL,
  -- Organization
  album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  -- Import provenance
  import_source TEXT,
  import_hash TEXT,        -- SHA256 of file path for dedup
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  remote_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_import_hash ON media(import_hash) WHERE import_hash IS NOT NULL;

-- Family members
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

-- Family relationships
CREATE TABLE IF NOT EXISTS family_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  to_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'child', 'sibling', 'spouse', 'partner', 'other')),
  UNIQUE (from_member_id, to_member_id, relationship_type)
);

-- Career entries (jobs + education)
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

-- Map pins
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

-- Media ↔ Map pin junction
CREATE TABLE IF NOT EXISTS media_map_pins (
  media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  map_pin_id INTEGER NOT NULL REFERENCES map_pins(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, map_pin_id)
);

-- Import jobs (tracks an import session)
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

-- Import items (AI-curated suggestions pending review)
CREATE TABLE IF NOT EXISTS import_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_job_id INTEGER REFERENCES import_jobs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('story', 'milestone', 'media', 'career', 'map_pin', 'album')),
  status TEXT NOT NULL DEFAULT 'pending_curation' CHECK (status IN ('pending_curation', 'pending_review', 'accepted', 'rejected', 'skipped')),
  content TEXT NOT NULL,   -- JSON blob: the suggested content
  source_data TEXT,        -- Raw source content (original post text, etc.)
  ai_confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_stories_event_date ON stories(event_date);
CREATE INDEX IF NOT EXISTS idx_media_album_id ON media(album_id);
CREATE INDEX IF NOT EXISTS idx_media_taken_at ON media(taken_at);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(date);
CREATE INDEX IF NOT EXISTS idx_career_entries_dates ON career_entries(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_import_items_job ON import_items(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON import_items(status);
