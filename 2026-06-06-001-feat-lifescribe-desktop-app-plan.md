---
title: "feat: LifeScribe Desktop — Local-First Biography App with Import & AI Curation"
type: feat
status: active
date: 2026-06-06
origin: docs/brainstorms/2026-05-24-content-import-hub-requirements.md
---

# LifeScribe Desktop — Local-First Biography App with Import & AI Curation

## Summary

A Tauri 2.0 desktop application (Windows first, Mac/mobile later) that provides LifeScribe's full biography creation and viewing experience running locally on the user's machine. Includes photo import with EXIF-based organization, social media archive parsing (Facebook, Instagram, LinkedIn), AI-powered content curation via Claude API, and optional sync to lifescribe.us. Processing happens on the user's hardware — no server-side heavy lifting.

---

## Problem Frame

LifeScribe users create accounts but struggle to populate their biographies with content. The web-only approach forces all heavy processing (photo analysis, archive parsing, AI curation) onto the server, creating cost and latency problems. A desktop app solves both sides: users get a native, responsive tool for creating and organizing their biography content, and the heavy lifting of importing/processing photos and social media archives runs on their own machine. The optional lifescribe.us sync lets users publish their work to the web when ready — but the app works fully offline without it.

(see origin: `docs/brainstorms/2026-05-24-content-import-hub-requirements.md`)

---

## Requirements

- R1. Standalone desktop application running on Windows (Mac, Android, iOS deferred to later versions)
- R2. Full biography content creation: stories (rich text), timeline/milestones, photo gallery/albums, family tree, career history, maps/places
- R3. Local photo import supporting folder selection and drag-and-drop, with EXIF metadata extraction (date, GPS, camera)
- R4. AI-powered content curation via Claude API that organizes imported content into biography entries
- R5. Social media archive parsing — users provide downloaded data exports from Facebook, Instagram, LinkedIn; app parses and maps to biography content types
- R6. Review/curation screen where users accept, edit, or reject AI suggestions before content is committed
- R7. Content mapping: posts → stories, photos → gallery, life events → milestones, check-ins → map pins, work history → career
- R8. Local-first architecture: all data stored in local SQLite database, photos referenced by file path on disk
- R9. Thumbnail generation and caching for photo gallery performance
- R10. Import history and duplicate detection within the biography
- R11. Optional sync to lifescribe.us web service (upload biography content, photos, and metadata)
- R12. App design mirrors LifeScribe's visual language (same color tokens, typography, component patterns)

**Origin actors:** A1 (Site Owner/Editor → local user), A2 (AI Curation System → Claude API), A3 (External Platforms → data export sources)
**Origin flows:** F1 (Photo Import Flow), F2 (Platform Archive Import Flow)
**Origin acceptance examples:** AE1 (photo clustering), AE2 (Facebook marriage post), AE3 (tweet aggregation), AE4 (bulk accept/reject), AE5 (duplicate detection)

---

## Scope Boundaries

- Mac OS, Android, and iOS versions (deferred — Tauri 2.0 supports these, architecture will accommodate)
- Real-time sync with social media platforms (one-time import only)
- Local AI inference / local LLMs (uses Claude API; local models could be added later)
- Guided writing prompts and blank-page assistance (separate initiative)
- Importing from messaging apps or email
- Importing friend/contact graphs for family tree
- Photo editing (cropping, filters, etc.)
- Face detection/recognition (potential future feature)
- Multi-user / multi-biography support in v1 (single biography per app instance)

### Deferred to Follow-Up Work

- Google Photos OAuth direct connection (possible in later version; initial version uses Google Takeout export)
- Video import and playback
- Printing / PDF export of biography
- Collaborative editing
- End-to-end encryption for sync

---

## Context & Research

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| App framework | Tauri 2.0 | Cross-platform (Win/Mac/mobile from one codebase), lightweight (~5MB), Rust backend for performance, web frontend |
| Frontend | React 19 + TypeScript + Tailwind CSS 4 | Matches LifeScribe web skills, rich ecosystem, Tiptap compatibility |
| Rich text editor | Tiptap | Same as LifeScribe web — full compatibility with lifescribe.us content format |
| Local database | SQLite via `tauri-plugin-sql` | Zero-config, reliable, single-file database, excellent for local-first apps |
| Photo processing | Rust `image` + `kamadak-exif` crates | Native speed for thumbnail generation and EXIF extraction |
| Archive parsing | Rust `zip` crate + TypeScript parsers | Rust for ZIP extraction, TypeScript for JSON/HTML content parsing |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`) | Same provider as LifeScribe web, excellent for content curation |
| Routing | React Router or TanStack Router | Client-side routing within the Tauri webview |
| State management | Zustand or TanStack Query | Lightweight, TypeScript-friendly |
| Sync (optional) | REST API calls to lifescribe.us | Upload content + photos when user opts in |

### Relevant LifeScribe Patterns to Port

- **Design system**: Color tokens (`--primary: #3D7A8A`, `--accent: #D4A86A`, etc.), Merriweather headings, Inter body
- **Tiptap editor configuration**: All extensions, toolbar layout, embed support — port directly
- **Content model**: Post (stories), Milestone, Album, Media, MapPin, CareerEntry, FamilyMember — adapt schema for SQLite
- **Sidebar navigation pattern**: Same layout structure with icon + label nav items

### Key Architectural Differences from Web

| Concern | Web (LifeScribe.us) | Desktop (this app) |
|---------|---------------------|-------------------|
| Database | PostgreSQL (Neon) | SQLite (local file) |
| Storage | Cloudflare R2 | Local file system (photos stay on disk) |
| Auth | NextAuth, sessions, JWT | None needed — single local user |
| Background jobs | Inngest / server queue | Native threads (Rust async, Tauri commands) |
| File upload limits | Vercel 4.5MB body limit | No limit — direct file system access |
| Processing | Server-side, async with email notification | Local, background thread with in-app notification |
| AI API calls | Server-side (hides API key) | Client-side with user-provided API key stored locally |

---

## Key Technical Decisions

- **Tauri 2.0 over Electron**: 10-20x smaller binary, better performance, native Rust for CPU-intensive work (photo processing, ZIP extraction), and Tauri 2.0 has stable iOS/Android support for future mobile versions.
- **SQLite over IndexedDB/other**: Real relational database with full SQL, Prisma-compatible schema patterns, easy backup (single file), and the `tauri-plugin-sql` provides a clean TypeScript API.
- **Photos referenced by path, not copied**: The app stores file paths to photos on disk rather than copying them into app storage. This avoids doubling disk usage and works with users' existing folder structures. Thumbnails are generated and cached separately.
- **Rust for heavy lifting, TypeScript for UI logic**: Photo processing (EXIF extraction, thumbnail generation, ZIP extraction) runs in Rust via Tauri commands for native speed. Business logic (content mapping, UI state, API calls) stays in TypeScript for developer velocity.
- **User-provided Claude API key**: Since this is a local app, the user supplies their own Anthropic API key (stored encrypted in local app data). This avoids needing a proxy server for AI features. A future version could offer a LifeScribe-hosted AI tier via the sync subscription.
- **Tiptap JSON format compatibility**: Stories use the exact same Tiptap JSON content format as lifescribe.us, ensuring content is sync-ready and can be rendered identically on both platforms.
- **LinkedIn added to platform priority**: Origin doc listed Facebook, Instagram, Google Takeout, Twitter/X, WordPress. LinkedIn is added because its data export contains rich career/education history that maps directly to the Career feature.

---

## Open Questions

### Resolved During Planning

- **How does the app handle AI costs?** User provides their own Anthropic API key. The app estimates token usage before processing and asks for confirmation. A future LifeScribe subscription tier could bundle API access.
- **Where are thumbnails stored?** In an app-managed cache directory (`AppData/Local/LifeScribe/thumbs/` on Windows). Thumbnails can be regenerated if the cache is cleared.
- **How does sync handle photos?** Only metadata syncs by default. Photo upload to lifescribe.us is opt-in per album and uses the web service's existing R2 upload infrastructure.

### Deferred to Implementation

- Exact Tiptap extension configuration needed for desktop (may differ slightly from SSR-only extensions on web)
- SQLite migration strategy as schema evolves across app versions
- Handling moved/renamed photo files (broken path detection and relinking UI)
- Rate limiting and error handling for Claude API calls during large imports
- Windows installer packaging (MSI vs NSIS vs WiX)

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri 2.0 Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              React Frontend (WebView)                 │     │
│  │                                                       │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │     │
│  │  │ Sidebar  │  │  Router   │  │   Main Content    │   │     │
│  │  │   Nav    │  │(TanStack) │  │                   │   │     │
│  │  └──────────┘  └──────────┘  │ • Story Editor    │   │     │
│  │                               │ • Timeline        │   │     │
│  │  ┌──────────────────────────┐ │ • Gallery         │   │     │
│  │  │    State (Zustand)       │ │ • Import Hub      │   │     │
│  │  │    + TanStack Query      │ │ • Review Screen   │   │     │
│  │  └──────────────────────────┘ │ • Settings        │   │     │
│  │                               └──────────────────┘   │     │
│  │  ┌──────────────────────────────────────────────┐    │     │
│  │  │         Tauri IPC (invoke commands)           │    │     │
│  │  └──────────────────────────────────────────────┘    │     │
│  └─────────────────────────────────────────────────────┘     │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Rust Backend (Tauri Core)                │     │
│  │                                                       │     │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │     │
│  │  │   SQLite   │  │   Photo    │  │   Archive    │   │     │
│  │  │   (CRUD)   │  │ Processing │  │   Parsing    │   │     │
│  │  │            │  │            │  │              │   │     │
│  │  │ • Stories  │  │ • EXIF     │  │ • ZIP extract│   │     │
│  │  │ • Timeline │  │ • Thumbs   │  │ • FB parser  │   │     │
│  │  │ • Albums   │  │ • Resize   │  │ • IG parser  │   │     │
│  │  │ • Media    │  │ • Scan dir │  │ • LI parser  │   │     │
│  │  │ • MapPins  │  │            │  │              │   │     │
│  │  │ • Career   │  │            │  │              │   │     │
│  │  │ • Import   │  │            │  │              │   │     │
│  │  └────────────┘  └────────────┘  └──────────────┘   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
   ┌──────────────┐                  ┌──────────────────┐
   │  Claude API  │                  │  lifescribe.us   │
   │  (AI curation│                  │  (optional sync) │
   │   via HTTPS) │                  │                  │
   └──────────────┘                  └──────────────────┘
```

---

## Implementation Units

### U1. Project Scaffold — Tauri 2.0 + React + TypeScript + Tailwind

**Goal:** Create the foundational project structure with Tauri 2.0, React 19, TypeScript, Tailwind CSS 4, and all build tooling configured for Windows development.

**Requirements:** R1, R12

**Dependencies:** None

**Files:**
- Create: `src-tauri/` (Rust backend — Cargo.toml, main.rs, tauri.conf.json)
- Create: `src/` (React frontend — App.tsx, main.tsx, index.html)
- Create: `src/styles/globals.css` (Tailwind + LifeScribe design tokens)
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`
- Create: `src-tauri/Cargo.toml` (Tauri + plugin dependencies)

**Approach:**
- Use `create-tauri-app` with the React + TypeScript + Vite template
- Add Tailwind CSS 4 with the LifeScribe color token variables
- Configure `tauri-plugin-sql` for SQLite in Cargo.toml and tauri.conf.json
- Add Merriweather + Inter fonts (bundled locally, not Google Fonts CDN)
- Set up path aliases (`@/components`, `@/lib`, etc.) matching LifeScribe web conventions
- Configure Vite for development hot-reload with Tauri

**Patterns to follow:**
- LifeScribe web's `globals.css` for design token definitions
- LifeScribe web's TypeScript path aliases

**Test scenarios:**
- Happy path: `pnpm tauri dev` launches a window with the React app rendered, showing the LifeScribe color scheme
- Happy path: Hot-reload works — changing a React component updates the window without restart
- Edge case: App runs on Windows 10 and Windows 11 without compatibility issues

**Verification:**
- Running `pnpm tauri dev` opens a native window with the React frontend
- Tailwind utility classes render correctly with LifeScribe design tokens
- TypeScript compilation passes with no errors

---

### U2. SQLite Database Schema + Data Access Layer

**Goal:** Define the local SQLite schema (mirroring LifeScribe's content models) and create a TypeScript data access layer that the frontend uses via Tauri commands.

**Requirements:** R2, R8, R10

**Dependencies:** U1

**Files:**
- Create: `src-tauri/migrations/` (SQL migration files)
- Create: `src/lib/db.ts` (TypeScript wrapper around tauri-plugin-sql)
- Create: `src/lib/models/` (TypeScript type definitions for all entities)
- Create: `src-tauri/src/db.rs` (Rust-side database initialization and migration runner)

**Approach:**
- Schema adapted from LifeScribe's Prisma schema for SQLite:
  - `biography` (replaces `Site` — single row for the user's biography metadata)
  - `stories` (replaces `Post` — title, slug, content as Tiptap JSON, excerpt, status, event_date)
  - `milestones` (timeline entries with date, precision, description, image)
  - `albums` (photo album groupings)
  - `media` (photo references — file_path on disk, thumbnail_path, EXIF metadata as JSON)
  - `family_members` + `family_relationships`
  - `career_entries`
  - `map_pins` (lat, lng, name, description)
  - `categories` + `tags`
  - `import_jobs` (status, source platform, started_at, completed_at, item_count)
  - `import_items` (pending AI-curated suggestions: type, content JSON, status accept/reject/pending)
- Use `tauri-plugin-sql` which provides `Database` class accessible from TypeScript
- Migrations run on app startup (version-tracked in a `_migrations` table)
- TypeScript types generated manually (no Prisma in desktop — it's too heavy), kept in `src/lib/models/`

**Patterns to follow:**
- LifeScribe's Prisma schema for field names and relationships (adapted for SQLite — no enums, use TEXT with CHECK constraints)
- Junction tables for many-to-many (story_tags, story_milestones, album_map_pins, etc.)

**Test scenarios:**
- Happy path: App starts, creates the SQLite database file if it doesn't exist, runs all migrations
- Happy path: CRUD operations (create story, read milestones, update career entry, delete media) work through the TypeScript data access layer
- Edge case: App starts with an existing database from a previous version — migrations apply incrementally without data loss
- Error path: Corrupted database file — app detects and offers to create a fresh database (with backup of the corrupted file)

**Verification:**
- SQLite database file is created at `AppData/Local/LifeScribe/data.db` on first launch
- All tables exist with correct columns after migration
- TypeScript types match the actual database schema

---

### U3. App Shell — Sidebar Navigation, Routing, Layout

**Goal:** Build the main application chrome — sidebar with navigation links, content area with client-side routing, and the overall layout that mirrors LifeScribe's site editor.

**Requirements:** R1, R2, R12

**Dependencies:** U1, U2

**Files:**
- Create: `src/components/layout/AppShell.tsx` (main layout with sidebar + content area)
- Create: `src/components/layout/Sidebar.tsx` (navigation links)
- Create: `src/components/layout/MobileSidebar.tsx` (responsive drawer — for future)
- Create: `src/routes/` (route definitions)
- Create: `src/pages/` (page components — Overview, Stories, Timeline, Gallery, Import, Settings)
- Modify: `src/App.tsx` (add router and layout)

**Approach:**
- Use TanStack Router for type-safe client-side routing
- Sidebar navigation items (same structure as LifeScribe's `editorNav` array):
  - Overview, Stories, Timeline, Gallery, Family Tree, Career, Maps & Places, Import, Settings
- Responsive layout: sidebar fixed-width on desktop, collapsible on narrow windows
- Overview page shows biography stats (story count, photo count, milestone count) and quick actions
- Empty states for each section with clear calls to action

**Patterns to follow:**
- LifeScribe's `apps/web/src/app/(site-editor)/site/[siteId]/layout.tsx` — sidebar structure, nav items, link styling
- LifeScribe's color tokens and component patterns (rounded-lg buttons, rounded-xl cards, border-[--border])

**Test scenarios:**
- Happy path: App renders sidebar with all nav items; clicking each navigates to the correct page
- Happy path: Overview page displays correct counts from the database (0 for fresh install)
- Edge case: Very narrow window width — sidebar collapses or overlays
- Happy path: Active nav item is visually highlighted

**Verification:**
- All navigation links work and render their respective page shells
- The layout visually matches LifeScribe's site editor aesthetic (same colors, typography, spacing)
- Window can be resized without layout breaking

---

### U4. Story Editor with Tiptap Rich Text

**Goal:** Implement the core content creation feature — a rich text story editor using Tiptap with the same capabilities as LifeScribe's web editor, storing content as Tiptap JSON in SQLite.

**Requirements:** R2, R7

**Dependencies:** U2, U3

**Files:**
- Create: `src/components/editor/StoryEditor.tsx` (Tiptap editor component)
- Create: `src/components/editor/EditorToolbar.tsx` (formatting toolbar)
- Create: `src/components/editor/ToolbarDropdown.tsx`
- Create: `src/components/editor/ColorPicker.tsx`
- Create: `src/components/editor/EmbedDialog.tsx`
- Create: `src/pages/stories/StoryListPage.tsx`
- Create: `src/pages/stories/StoryEditorPage.tsx`
- Create: `src/pages/stories/NewStoryPage.tsx`
- Create: `src/lib/actions/stories.ts` (CRUD operations for stories)

**Approach:**
- Port Tiptap configuration from LifeScribe web (all extensions: bold, italic, headings, lists, images, embeds, tables, colors, alignment)
- Stories list with search, sort by date, filter by status (draft/published)
- Story metadata: title, event date (with year/month/day precision), category, tags, featured image
- Autosave to SQLite on content change (debounced)
- Image insertion references local file paths (opened via Tauri file dialog)
- Content stored as Tiptap JSON (same format as lifescribe.us for sync compatibility)

**Patterns to follow:**
- LifeScribe's `apps/web/src/components/editor/TiptapEditor.tsx` — extension configuration
- LifeScribe's `apps/web/src/components/editor/BlogPostEditor.tsx` — toolbar layout and grouping
- LifeScribe's `apps/web/src/components/stories/StoryList.tsx` — list UI

**Test scenarios:**
- Happy path: Create a new story with title → opens editor → type formatted content → content autosaves → return to list shows the story
- Happy path: All formatting options work: bold, italic, headings H1-H6, lists, blockquotes, links, images, tables, text color, alignment
- Happy path: Insert a local image via file picker → image renders in editor → path stored in content JSON
- Edge case: Story with very large content (100+ paragraphs, many images) — editor remains responsive
- Error path: Database write fails during autosave — user sees a non-intrusive warning, content is preserved in memory
- Happy path: Edit existing story — loads content from DB, preserves all formatting

**Verification:**
- Stories can be created, edited, listed, and deleted
- Tiptap JSON output matches the format used by lifescribe.us (content is sync-compatible)
- Editor toolbar matches LifeScribe's visual design

---

### U5. Timeline, Gallery, and Supporting Features

**Goal:** Implement the remaining biography content features: timeline/milestones, photo gallery/albums, family tree, career history, and maps/places.

**Requirements:** R2, R7, R9

**Dependencies:** U2, U3

**Files:**
- Create: `src/pages/timeline/TimelinePage.tsx`
- Create: `src/components/timeline/TimelineEditor.tsx`
- Create: `src/pages/gallery/GalleryPage.tsx`
- Create: `src/pages/gallery/AlbumPage.tsx`
- Create: `src/components/gallery/PhotoGrid.tsx`
- Create: `src/components/gallery/AlbumManager.tsx`
- Create: `src/pages/family-tree/FamilyTreePage.tsx`
- Create: `src/pages/career/CareerPage.tsx`
- Create: `src/pages/maps/MapsPage.tsx`
- Create: `src/components/maps/MapView.tsx` (Leaflet)
- Create: `src/lib/actions/milestones.ts`
- Create: `src/lib/actions/gallery.ts`
- Create: `src/lib/actions/family-tree.ts`
- Create: `src/lib/actions/career.ts`
- Create: `src/lib/actions/map-pins.ts`

**Approach:**
- **Timeline**: Vertical timeline view with add/edit/delete milestones. Date precision support (year/month/day). Category color coding.
- **Gallery**: Grid view of photos grouped by album. Albums can be created manually or auto-generated during import. Photos display from local file paths with cached thumbnails. Lightbox view for full-size.
- **Family Tree**: Add family members with relationships. Same data model as LifeScribe web (given name, surname, birth/death dates, photo, bio).
- **Career**: Chronological list of jobs/education with company, title, dates, description.
- **Maps**: Leaflet-based map with pins. Each pin has name, coordinates, description, linked photos. Pins can be added manually or auto-generated from photo GPS data.
- All features use Tauri's file dialog for image/photo selection (no upload — just reference the local path)

**Patterns to follow:**
- LifeScribe's `apps/web/src/components/timeline/TimelineEditor.tsx`
- LifeScribe's `apps/web/src/components/gallery/PhotoGrid.tsx` and `GalleryManager.tsx`
- LifeScribe's `apps/web/src/components/maps/MapPinsManager.tsx`
- LifeScribe's `apps/web/src/components/career/CareerEditor.tsx`

**Test scenarios:**
- Happy path: Add a milestone with date, title, description → appears in timeline sorted by date
- Happy path: Create album, add photos from local folder via file picker → photos appear in grid with thumbnails
- Happy path: Add a map pin by clicking on map → pin appears with name and description
- Happy path: Add career entry → appears in chronological order
- Edge case: Gallery with 1000+ photos — virtualized grid renders smoothly
- Edge case: Photo file moved/deleted — thumbnail shows "missing file" indicator with option to relink
- Happy path: Family member with relationships — parent/child/sibling/spouse displayed correctly

**Verification:**
- All five feature sections (timeline, gallery, family tree, career, maps) support full CRUD
- Photo thumbnails load quickly from cache
- Map renders with Leaflet and pins are interactive
- Features work offline (no network dependency for core functionality)

---

### U6. Local Photo Import + EXIF Parsing + Thumbnails

**Goal:** Enable users to select folders or individual photos from their local machine, extract EXIF metadata (date, GPS, camera), generate thumbnails, and organize photos into the gallery with AI-suggested albums and map pins.

**Requirements:** R3, R7, R8, R9, R10

**Dependencies:** U2, U5

**Files:**
- Create: `src-tauri/src/photos.rs` (Rust: EXIF extraction, thumbnail generation, folder scanning)
- Create: `src/pages/import/ImportHubPage.tsx`
- Create: `src/pages/import/PhotoImportPage.tsx`
- Create: `src/components/import/FolderPicker.tsx`
- Create: `src/components/import/PhotoScanProgress.tsx`
- Create: `src/components/import/PhotoPreviewGrid.tsx`
- Create: `src/lib/actions/photo-import.ts`
- Modify: `src-tauri/src/main.rs` (register photo commands)
- Modify: `src-tauri/Cargo.toml` (add `image`, `kamadak-exif` crates)

**Approach:**
- **Rust commands exposed to frontend:**
  - `scan_folder(path)` → returns list of image files with basic info
  - `extract_exif(path)` → returns structured EXIF data (date, GPS coords, camera model, dimensions)
  - `generate_thumbnail(source_path, thumb_path, size)` → creates resized JPEG thumbnail
  - `batch_process_photos(paths)` → extracts EXIF + generates thumbs for a batch, reports progress
- **Frontend flow:**
  1. User navigates to Import → Photos
  2. Selects a folder or multiple files via Tauri's native file dialog
  3. Rust scans and extracts EXIF data (progress bar shown in UI)
  4. Frontend clusters photos by date/location (JS-side algorithm)
  5. Suggests album groupings and map pins from GPS data
  6. User reviews suggestions → accepted photos are added to gallery with metadata
- **Thumbnail strategy:** Generate 300px-wide JPEG thumbnails, stored in `AppData/Local/LifeScribe/thumbs/[hash].jpg`. Original photos stay in place — only the path is stored in the database.
- **Fallback for missing EXIF:** Photos without dates use file modification time. Photos without GPS get no map pin suggestion. User can manually set dates/locations during review.

**Patterns to follow:**
- Origin requirement AE1: "200 photos spanning 2015-2023 → clusters into ~15 time-period groups, suggests 8 albums, proposes 6 map pins"

**Test scenarios:**
- Covers AE1. Happy path: Select a folder with 200 photos spanning multiple years → progress bar shows scan → EXIF extracted → photos clustered by time period → albums and map pins suggested
- Happy path: Single photo with full EXIF (date + GPS + camera) → all metadata extracted correctly
- Edge case: Photo with no EXIF data → falls back to file modification date, no GPS pin suggested
- Edge case: HEIC/HEIF photos (iPhone) → EXIF still extracted correctly
- Edge case: Folder with 5000+ photos → scan completes within 2 minutes, progress updates smoothly
- Error path: Permission denied on a subfolder → skipped with warning, rest of scan continues
- Happy path: Thumbnail generated at correct size, cached for subsequent views

**Verification:**
- Selecting a folder of photos results in all photos appearing in a preview grid with metadata
- Thumbnails are cached and load instantly on subsequent views
- Photos without EXIF gracefully degrade to file metadata
- Large photo libraries (5000+) process without hanging the UI

---

### U7. AI Curation Service + Review Screen

**Goal:** Implement the AI-powered content curation that analyzes imported content (photos, social media posts) and generates biography entry suggestions, plus the review/curation screen where users accept or reject suggestions.

**Requirements:** R4, R6, R7, R8, R10

**Dependencies:** U2, U6

**Files:**
- Create: `src/lib/ai/curation-service.ts` (Claude API integration for content curation)
- Create: `src/lib/ai/prompts.ts` (System prompts for different curation tasks)
- Create: `src/lib/ai/types.ts` (Types for AI request/response)
- Create: `src/pages/import/ReviewPage.tsx`
- Create: `src/components/import/CurationCard.tsx` (individual suggestion card — accept/edit/reject)
- Create: `src/components/import/BulkActions.tsx` (bulk accept/reject controls)
- Create: `src/components/import/EditSuggestionModal.tsx`
- Create: `src/pages/settings/ApiKeySettings.tsx` (Claude API key configuration)
- Create: `src/lib/secure-storage.ts` (encrypted API key storage)

**Approach:**
- **API key management:** User enters their Anthropic API key in Settings. Stored encrypted in app local data via Tauri's keychain/credential store.
- **Curation pipeline:**
  1. After photo import or archive parsing, collected content goes into `import_items` table with status "pending_curation"
  2. AI curation runs in background (non-blocking UI):
     - Photo clusters → suggests album names, story drafts about the time period
     - Social media posts → synthesizes related posts into coherent story drafts
     - Life events → proposes timeline milestones
     - GPS data → suggests map pins with names (reverse geocoding)
  3. Results update `import_items` with AI-generated content and status "pending_review"
- **Claude API usage:**
  - Batch items into sensible groups (e.g., all photos from one time cluster together)
  - Use structured tool_use for consistent output format (title, content, type, date, etc.)
  - Prompt instructs Claude to preserve user's original voice and phrasing
  - Estimate token usage before processing; show cost estimate to user
- **Review screen:**
  - Cards showing each suggested item (story draft, milestone, album, map pin)
  - Each card: accept, edit, reject buttons
  - Bulk actions: accept all, reject all
  - Edit modal for refining AI suggestions before accepting
  - Accepted items are committed to the main biography tables
- **Graceful degradation:** If no API key is configured, import still works — photos/archives are parsed and organized by metadata, but no AI-generated story drafts. Users can manually create stories from imported material.

**Patterns to follow:**
- Origin requirement AE4: "user views the curation screen, they can bulk-accept all, bulk-reject all, or individually accept/edit/reject each item"
- Origin requirement R10: "preserves the user's original voice and phrasing where possible"

**Test scenarios:**
- Covers AE4. Happy path: AI proposes 25 items → user can bulk-accept, bulk-reject, or individually manage each
- Happy path: Photo cluster → AI generates a story draft with title like "Summer 2018 — Europe Trip" → user accepts → story created in database
- Happy path: Without API key configured, import works but skips AI curation — photos still organized by date/location
- Error path: Claude API returns an error (rate limit, invalid key) → user notified, items remain in "pending_curation" with option to retry
- Error path: API key invalid → clear error message directing user to Settings
- Edge case: Very large batch (500+ items) → processed in chunks with progress indicator
- Happy path: User edits AI suggestion before accepting → edited version is what gets saved

**Verification:**
- AI curation produces relevant, coherent biography content from imported material
- Review screen allows full control over what gets committed
- App works without AI key (graceful degradation to metadata-only organization)
- API key is stored securely and not visible in app logs or debug tools

---

### U8. Social Media Archive Parsers

**Goal:** Parse data export archives from Facebook, Instagram, and LinkedIn, extracting posts, photos, life events, check-ins, and work history into the normalized import format for AI curation.

**Requirements:** R5, R7, R10

**Dependencies:** U2, U7

**Files:**
- Create: `src-tauri/src/archive.rs` (Rust: ZIP extraction to temp directory)
- Create: `src/lib/parsers/facebook.ts` (Facebook JSON/HTML archive parser)
- Create: `src/lib/parsers/instagram.ts` (Instagram archive parser)
- Create: `src/lib/parsers/linkedin.ts` (LinkedIn archive parser)
- Create: `src/lib/parsers/types.ts` (Normalized intermediate format types)
- Create: `src/pages/import/ArchiveImportPage.tsx`
- Create: `src/components/import/PlatformGuide.tsx` (step-by-step download instructions)
- Create: `src/components/import/ArchiveUploadZone.tsx`

**Approach:**
- **Archive extraction (Rust):** Tauri command extracts ZIP to a temporary directory, returns the extracted path. Handles large ZIPs (multi-GB) with progress reporting.
- **Platform parsers (TypeScript):** Each parser reads the extracted directory structure and produces normalized `ImportItem` objects:
  - **Facebook:** Reads `posts/your_posts_*.json`, `photos_and_videos/`, `profile_information/life_events.json`, `location_history/`, `about_you/education_and_work.json`. Maps: posts → stories, photos → media, life events → milestones, check-ins → map pins, work/education → career.
  - **Instagram:** Reads `content/posts_*.json`, `media/posts/`, `personal_information/`. Maps: posts with substantial captions → stories, photos → media, location tags → map pins.
  - **LinkedIn:** Reads `Profile.csv`, `Positions.csv`, `Education.csv`, `Connections.csv` (for context only). Maps: positions → career entries, education → career entries, profile summary → biography metadata.
- **Platform guides:** Static instructional content with screenshots showing users how to download their data from each platform (Facebook Settings → Your Information → Download, etc.)
- **Duplicate detection:** Check imported content against existing biography entries by date + similarity.

**Patterns to follow:**
- Origin requirement AE2: Facebook marriage post with photos and life event → both story draft and milestone proposed
- Origin requirement AE3: 4,000 tweets → thematic clusters, not individual imports
- Origin requirement AE5: Duplicate detection when content overlaps

**Test scenarios:**
- Covers AE2. Happy path: Facebook archive with a "Just got married!" post + life event + photos → parser produces both a story suggestion and a milestone suggestion, photos attached
- Covers AE3. Happy path: Large collection of short posts → aggregated into themed groups rather than individual items
- Happy path: LinkedIn archive → career entries extracted with correct company, title, dates
- Happy path: Instagram archive with geotagged photos → map pins suggested from location data
- Edge case: Facebook archive in HTML format (older exports) vs JSON format (newer) → parser handles both
- Edge case: Archive with non-English content → parser preserves original text without mojibake
- Error path: Corrupted or incomplete ZIP → error message suggesting re-download
- Covers AE5. Happy path: Import detects content similar to existing biography entry → flagged as potential duplicate

**Verification:**
- Each supported platform's archive is parsed into correctly-typed import items
- Photos from archives are extracted and referenced correctly
- Step-by-step guides are accurate for current (2026) platform UI
- Duplicate detection correctly identifies overlapping content

---

### U9. Optional LifeScribe.us Sync

**Goal:** Allow users to optionally connect their desktop app to their lifescribe.us account and sync biography content (stories, milestones, albums, photos) to the web service.

**Requirements:** R11

**Dependencies:** U2, U4, U5

**Files:**
- Create: `src/lib/sync/sync-service.ts` (sync orchestration — diff, upload, conflict resolution)
- Create: `src/lib/sync/api-client.ts` (REST API calls to lifescribe.us)
- Create: `src/lib/sync/auth.ts` (OAuth or API token authentication with lifescribe.us)
- Create: `src/pages/settings/SyncSettings.tsx` (connect account, sync status, preferences)
- Create: `src/components/sync/SyncStatusBar.tsx` (shows sync state in the app header)
- Create: `src/components/sync/ConflictResolutionModal.tsx`

**Approach:**
- **Authentication:** User logs into lifescribe.us via OAuth flow (opens browser, redirects back to app with token). Token stored securely.
- **Sync strategy:** Desktop is the source of truth. Sync is one-directional (desktop → web) for v1. Bidirectional sync (web → desktop) deferred.
- **What syncs:**
  - Biography metadata (title, tagline, bio)
  - Stories (Tiptap JSON content — already format-compatible)
  - Milestones, career entries, map pins, family members
  - Albums and media metadata
  - Photos (opt-in per album — uploaded to lifescribe.us R2 storage)
- **Sync mechanics:**
  - Each entity gets a `synced_at` timestamp and `remote_id` in the local database
  - On sync: diff local changes since last sync → batch upload to lifescribe.us API
  - Photo upload uses chunked upload to handle large files
  - Conflict: if remote was modified (by web editor), show conflict resolution UI
- **Sync is fully optional:** App works completely offline. Sync settings page shows "Not connected" until user opts in.

**Patterns to follow:**
- LifeScribe web's existing API routes and content models define the sync target format
- Tiptap JSON compatibility between desktop and web ensures stories render identically

**Test scenarios:**
- Happy path: Connect lifescribe.us account → OAuth flow completes → "Connected" status shown
- Happy path: Create story locally → trigger sync → story appears on lifescribe.us
- Happy path: Sync with photos opt-in → photos upload to R2, appear in web gallery
- Error path: Network offline during sync → sync pauses, retries when connection restored
- Error path: Auth token expired → prompt user to re-authenticate
- Edge case: Story edited both locally and on web since last sync → conflict resolution UI shows both versions
- Happy path: Disconnect account → sync stops, local data remains intact

**Verification:**
- Content synced from desktop renders identically on lifescribe.us
- Sync is incremental (only changed items are uploaded)
- App functions fully without ever connecting to lifescribe.us
- Photo upload handles large files without timeout

---

## System-Wide Impact

- **Interaction graph:** Photo import (U6) feeds into AI curation (U7); archive parsers (U8) also feed into AI curation. All curated content ultimately creates entities managed by U4/U5. Sync (U9) reads from all content tables.
- **Error propagation:** Rust-side errors (file not found, permission denied, EXIF parse failure) are surfaced as typed errors to the TypeScript frontend via Tauri IPC. Frontend displays user-friendly messages.
- **State lifecycle risks:** Import jobs can be interrupted (app closed mid-import). On restart, check for incomplete import_jobs and offer to resume or discard. SQLite transactions ensure no partial writes during content acceptance.
- **API surface parity:** The Tiptap JSON content format MUST match lifescribe.us exactly. Any story created in the desktop app must render correctly on the web, and vice versa. This is the critical sync contract.
- **Unchanged invariants:** LifeScribe.us web service is NOT modified by this plan. The desktop app is a new client that uses the web's existing API (or a new sync-specific API endpoint added to the web later).

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Tauri 2.0 stability on Windows (relatively new framework) | Pin Tauri version, test on Windows 10 and 11, maintain escape hatch to Electron if critical issues emerge |
| Large photo libraries (50,000+ photos) causing performance issues | Virtualized lists, lazy thumbnail loading, SQLite indexed queries, Rust-side batch processing with progress |
| Facebook/Instagram export format changes breaking parsers | Parser version detection, graceful degradation (skip unparseable sections), community monitoring of format changes |
| Claude API costs surprising users | Show token estimate before processing, allow cancellation, support skip-AI mode |
| Tiptap version drift between desktop and web | Pin same Tiptap version in both, share extension configuration as a package |
| Cross-platform differences when Mac version ships | Tauri abstracts most OS differences; use conditional compilation in Rust for platform-specific paths |

---

## Phased Delivery

### Phase 1: Core App (U1–U3)
Ship a working biography creation tool: app shell, database, navigation, settings. Users can launch the app and see the structure — even though content features aren't in yet.

### Phase 2: Content Creation (U4–U5)
Full biography editing: stories with rich text, timeline, gallery, family tree, career, maps. The app is now a functional local biography tool even without import features.

### Phase 3: Import & AI (U6–U8)
Photo import, AI curation, archive parsers. This is the killer feature — users can seed their biography from existing content.

### Phase 4: Sync (U9)
Connect to lifescribe.us. Users who want their biography on the web can sync with one click.

---

## Documentation / Operational Notes

- **User documentation needed:** Getting started guide, API key setup instructions, platform archive download guides (with screenshots)
- **Windows installer:** Tauri bundles as MSI or NSIS installer. Auto-update via Tauri's built-in updater (update server TBD)
- **Data location:** `%LOCALAPPDATA%/LifeScribe/` on Windows — contains `data.db` (SQLite), `thumbs/` (cached thumbnails), `temp/` (archive extraction)
- **Backup:** User can back up by copying the `data.db` file. Photos are not copied (just referenced by path), so photo backup is the user's responsibility.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-24-content-import-hub-requirements.md](docs/brainstorms/2026-05-24-content-import-hub-requirements.md)
- Tauri 2.0 documentation: https://v2.tauri.app/
- tauri-plugin-sql: https://github.com/AlicanAky662/tauri-plugin-sql (or `@tauri-apps/plugin-sql`)
- kamadak-exif (Rust EXIF): https://crates.io/crates/kamadak-exif
- Tiptap editor: https://tiptap.dev/
- Anthropic Claude API: https://docs.anthropic.com/
- LifeScribe web codebase: design tokens, Tiptap config, content models (for compatibility reference)
