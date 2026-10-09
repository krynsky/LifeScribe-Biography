# LifeScribe Development Guide

LifeScribe is a local-first biography desktop app built with Tauri 2.0. The frontend is React 19 + TypeScript; the backend is Rust for CPU-heavy work (photo processing, archive extraction); data lives in a local SQLite database. An optional sync layer talks to the lifescribe.us REST API.

The original design/plan document is [2026-06-06-001-feat-lifescribe-desktop-app-plan.md](../2026-06-06-001-feat-lifescribe-desktop-app-plan.md).

## Tech Stack

| Layer | Technology |
|-------|------------|
| App framework | Tauri 2.0 (Rust backend, webview frontend) |
| Frontend | React 19, TypeScript 5, Tailwind CSS 4, Vite 6 |
| Routing | TanStack Router (code-based route tree, not file-based) |
| State | Zustand |
| Rich text | Tiptap 2 (same JSON content format as lifescribe.us) |
| Database | SQLite via `tauri-plugin-sql` |
| Photo processing | Rust `image` + EXIF crates |
| Maps | Leaflet |
| AI | Anthropic SDK (`@anthropic-ai/sdk`), user-supplied API key, `claude-haiku-4-5` |
| Icons | lucide-react |
| Tests | Vitest (frontend unit tests) |

## Prerequisites

- Node.js + **pnpm**
- Rust toolchain (1.77.2+) with the Windows MSVC target
- Tauri 2.0 system prerequisites (WebView2 on Windows)

## Common Commands

```sh
pnpm install            # install JS dependencies
pnpm tauri dev          # run the full desktop app (starts Vite on port 1421 + Rust build)
pnpm dev                # frontend only in a browser (Tauri APIs unavailable — limited usefulness)
pnpm test               # run Vitest unit tests
pnpm build              # type-check (tsc) + Vite production build
pnpm tauri build        # produce a distributable desktop bundle
```

Note: the dev server runs on **port 1421** (not Vite's default), configured in both [vite.config.ts](../vite.config.ts) and [tauri.conf.json](../src-tauri/tauri.conf.json).

## Project Layout

```
src/                        # React frontend
  routes/index.tsx          # entire route tree (TanStack Router, code-based)
  pages/                    # one folder per feature (stories, gallery, import, ...); read-mode views live in src/views
  components/
    layout/                 # AppShell + Sidebar (editor chrome)
    editor/                 # StoryEditor (Tiptap), toolbar, custom embed extensions
    gallery/, maps/, reader/ (read-view building blocks), ui/
  lib/
    db.ts                   # SQLite connection singleton + inline migration runner
    actions/                # data-access layer: one module per entity (stories, gallery, ...)
    models/                 # shared TypeScript types
    ai-curator.ts           # Claude API integration for import curation
    archive-parsers.ts      # Facebook/Instagram/LinkedIn export parsers
    sync/                   # optional lifescribe.us sync engine
  store/                    # Zustand stores
  styles/globals.css        # Tailwind + design tokens

src-tauri/                  # Rust backend
  src/lib.rs                # plugin registration + Tauri command handler list
  src/photos.rs             # scan_folder, extract_exif, generate_thumbnail, batch_process_photos
  src/archive.rs            # extract_archive (ZIP extraction)
  src/db.rs                 # app data directory setup
  migrations/               # reference SQL schema (see Migrations below)
  tauri.conf.json           # window config, asset protocol scope, SQL plugin preload
  capabilities/             # Tauri permission grants (fs, dialog, http, shell, sql)
```

## Architecture

### Frontend/backend split
TypeScript owns all business logic, UI state, SQL queries, parsing of archive JSON/CSV, and API calls. Rust is only used where native speed matters, exposed as Tauri commands (invoked via `invoke()` from `@tauri-apps/api`):

- `scan_folder` — recursively find image files
- `extract_exif` — date taken, GPS, camera metadata
- `generate_thumbnail` — cached thumbnails for the gallery
- `batch_process_photos` — the above in bulk
- `extract_archive` — unzip social media data exports

Adding a Rust command: implement it in `src-tauri/src/`, register it in the `generate_handler!` list in [lib.rs](../src-tauri/src/lib.rs), and call it from TypeScript with `invoke("command_name", args)`.

### Database
- Single SQLite file `lifescribe.db` in the app-local data directory, opened via `tauri-plugin-sql` ([db.ts](../src/lib/db.ts)).
- **Migrations are inlined in `src/lib/db.ts`**, tracked in a `_migrations` table by name. The SQL files under [src-tauri/migrations/](../src-tauri/migrations/) are the reference copies; when changing schema, add a new named migration to the runner in `db.ts` (never edit an applied migration).
- Schema mirrors the lifescribe.us Prisma schema, adapted for SQLite. Core tables: `biography` (single row, id=1), `stories`, `milestones`, `albums`, `media`, `family_members` + `family_relationships`, `career_entries`, `map_pins`, plus junction tables and `import_jobs`/`import_items`.
- Every syncable table carries `synced_at` and `remote_id` columns used by the sync engine.
- All data access goes through `src/lib/actions/*` — pages should not run raw SQL.

### Content model conventions
- Story content is **Tiptap JSON serialized as a string**, byte-compatible with lifescribe.us so synced content renders identically on the web.
- Dates are ISO strings with a companion `*_precision` column (`year` | `month` | `day`).
- Photos are **referenced by absolute file path**, never copied. `media.import_hash` (unique index) provides duplicate detection across re-imports. The webview loads local images through Tauri's asset protocol (`convertFileSrc`), scoped in `tauri.conf.json`.

### Routing and Read/Edit mode
The whole route tree lives in [src/routes/index.tsx](../src/routes/index.tsx). Every route renders inside `AppShell` (one sidebar). `ViewModeProvider` ([src/lib/view-mode.tsx](../src/lib/view-mode.tsx)) holds a `"read" | "edit"` mode, toggled from the sidebar and persisted to localStorage. Each section route uses `byMode(EditPage, ReadView)` to render either its editor page (`src/pages/*`) or its read-only web-style view (`src/views/*`). There are no separate `/reader` routes.

### Data layer: taxonomy, links, ordering, images
- **Migrations** live in [src/lib/migrations.ts](../src/lib/migrations.ts) (no Tauri imports, so tests apply them to in-memory SQLite). The runner splits on `;`, drops chunks starting `--` (no SQL comments inside migrations), and tolerates statements that already took effect.
- **Categories and tags** are shared records: `categories` (name, slug, color, icon) with a `category_id` on stories, milestones, career entries, pins and albums; `tags` with `story_tags` / `album_tags`. Logic in [src/lib/data/taxonomy.ts](../src/lib/data/taxonomy.ts); read queries expose `category`, `category_color`, `category_icon` and `tags` via [src/lib/data/select.ts](../src/lib/data/select.ts).
- **Links** between stories/albums and milestones/pins/career are seven join tables (`story_milestones`, …) managed by [src/lib/data/links.ts](../src/lib/data/links.ts). Sync fills them from the web's linked records after every entity is pulled.
- **Ordering**: `position` columns plus `setOrder` / `moveId` in [src/lib/data/order.ts](../src/lib/data/order.ts).
- **Images** the user adds are copied into `%LOCALAPPDATA%\com.lifescribe.app\images` ([src/lib/images.ts](../src/lib/images.ts)), named by content hash. Settings has a button to copy older, path-referenced photos in.
- **Testing the data layer**: functions take a `SqlRunner` ([src/lib/data/sql.ts](../src/lib/data/sql.ts)); tests use `createTestDb()` from `src/lib/data/test-runner.ts`.

### Publishing to the website (optional sync)
Sync is opt-in. **Refresh** pulls the website into the app; **Review & publish** (Settings) sends changes the other way. Code lives in `src/lib/sync/`:
- `sync-service.ts` is the engine: `refresh`, `listUnpublished`, `publish`, `listDeletions` / `publishDeletions`, `resolveConflict`. It talks to a `DataStore` (SQLite) and a `WebAdapter` (REST), both interfaces, so it is unit-tested with fakes.
- `registry.ts` describes each synced type: columns, push-only extras, images, link tables, and what is sent (`PUSH_LINKS`).
- Publish order: records → album photos and covers → links and family relationships. Photos are uploaded first (`uploadImageFile`), resized if over 10 MB, and remembered by content hash in `uploaded_images`.
- A database backup (`VACUUM INTO`, newest 10 kept in `%LOCALAPPDATA%\com.lifescribe.app\backups`) is taken before Refresh, Reset, Publish and conflict resolution.
- Deleting a published record writes a row to `sync_deletions` via triggers (migration 0010); `deleteLocal` clears sync bookkeeping first so website-driven deletions are not recorded.
- Migrations containing `CREATE TRIGGER` rely on `splitStatements` keeping the trigger body together.
- The website side is in the LifeScribe repo under `apps/web/src/app/api/v1/sync/` (`pull`, `push`, `media`, `image`, `media-link`, `[entity]/[id]`) and `src/lib/sync/`.

### Import pipeline
1. **Photos**: `PhotoImportPage` → Rust `scan_folder`/`batch_process_photos` → rows in `media` (deduped by `import_hash`).
2. **Archives**: `ArchiveImportPage` → Rust `extract_archive` → `archive-parsers.ts` detects the platform (Facebook / Instagram / LinkedIn) and parses JSON/CSV into `import_items`.
3. **AI curation** (optional): `ai-curator.ts` sends raw text to Claude (`claude-haiku-4-5`, user's own API key from localStorage) with a strict JSON-only extraction prompt, producing suggested stories/milestones/career entries/map pins as `import_items`.
4. **Review**: `ReviewPage` lets the user accept/edit/reject each `import_item`; accepted items are materialized into the real tables.

### Sync engine (`src/lib/sync/`)
Optional integration with the lifescribe.us REST API (`https://lifescribe.us/api/v1`, bearer-token auth stored in localStorage).

- `SyncService` orchestrates; it is constructed from two injected interfaces — `SqlDataStore` (local SQLite) and `RestWebAdapter` (HTTP) — which makes it unit-testable with fakes (see `sync-service.test.ts`, `reconcile.test.ts`).
- `registry.ts` maps each entity type to its table/columns; `reconcile.ts` computes create/update/delete/conflict decisions.
- Three modes (`SyncMode`): `web-master` (default — web wins), `app-master`, and `standalone` (sync disabled).
- Operations exposed in Settings: `refresh()` (pull), `publish()` (push unpublished local items), `reset()` (re-clone from web). Conflicts are surfaced, never auto-resolved.

## Testing

```sh
pnpm test
```

Vitest covers pure logic: `reader-utils`, and the sync engine (`migration`, `reconcile`, `sync-service`). Tauri-dependent code (Rust commands, plugin-sql) is not covered by these tests — verify that behavior by running `pnpm tauri dev`.

When adding logic to `lib/`, prefer pure functions with injected dependencies (the sync layer is the pattern to copy) so they stay testable without a Tauri runtime.

## Design System

Ported from the LifeScribe web app: primary `#3D7A8A`, accent `#D4A86A`, Merriweather for headings, Inter for body text. Tokens live in [globals.css](../src/styles/globals.css) — reuse them (and existing `components/ui/` primitives like `Modal`, `PageHeader`, `EmptyState`) instead of hard-coding values.

## Security / Permissions Notes

- Tauri capabilities in `src-tauri/capabilities/` gate fs, dialog, http, shell, and sql access; the http plugin is scoped (e.g., `img.youtube.com` is allowed for video thumbnails). If a network or file call fails with a permission error, the capability files are the first place to look.
- The asset protocol scope in `tauri.conf.json` controls which disk paths the webview may load images from.
- The Claude API key and sync token are stored in `localStorage`, acceptable for a single-user local app.

## Release

```sh
pnpm tauri build
```

Bundles are produced per `tauri.conf.json` (`targets: "all"`; Windows installers today — Mac/mobile are planned but deferred). Version is tracked in three places: `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` — bump all of them together.
