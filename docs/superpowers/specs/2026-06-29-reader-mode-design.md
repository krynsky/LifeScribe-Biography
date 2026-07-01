# Reader Mode — Design

**Date:** 2026-06-29
**Status:** Approved (design)
**Sub-project:** #2 of 4 (in-app reader view). Sub-projects #3 (static-site export) and #4 (PDF/book export) are separate future cycles that will reuse this work's rendering; they are out of scope here.

---

## 1. Goal

Give the desktop app a polished, read-only way to *experience* the biography — the way a visitor would browse it on lifescribe.us — without leaving the app. Today the desktop is purely an authoring/management tool (Stories, Timeline, Gallery, Family Tree, Career, Maps are all edit-first pages); Reader Mode is the missing "just read it" experience.

## 2. Architecture

**Full-screen immersive mode.** A "Read My Biography" entry point takes over the entire window — the normal app sidebar/chrome (Overview, Stories, Gallery, Settings, etc.) is replaced by Reader Mode's own persistent sidebar. One "← Exit Reader" link returns to the normal editor.

**Route:** a new top-level route tree at `/reader`, structured as nested routes so browser back/forward and deep-linking work naturally within Reader Mode:
- `/reader` — Cover
- `/reader/stories`, `/reader/stories/$storyId`
- `/reader/timeline`
- `/reader/gallery`, `/reader/gallery/albums/$albumId`
- `/reader/family-tree`
- `/reader/career`
- `/reader/maps`

`ReaderShell` is the component for the `/reader` parent route — it renders the persistent sidebar plus an `<Outlet />`, mirroring how the existing root route wraps everything in `AppShell` today.

**Component reuse (key decision).** Reader Mode is a read-only *lens* over existing, already-correct rendering — not a parallel set of display components to maintain:
- Stories reuse `StoryEditor` with `readOnly={true}` (already supported — no toolbar, no edit chrome; already renders every Tiptap extension including embeds/video).
- Gallery/Album reuse a newly-extracted shared `AlbumGrid` component (grid + lightbox + video play-in-lightbox), pulled out of the current `AlbumPage` so both the editor's album view and the reader's gallery view render from one source.
- Timeline, Family Tree, Career, and Maps reuse the existing display logic from their current pages, with "Add/Edit/Delete/Import" controls stripped out.

**Consistent rule across every section:** strip *mutation* UI, keep all *display* interactions (expand, lightbox, map pan/zoom, opening a story).

## 3. Cover Page & Entry Point

**Entry point:** a prominent "Read My Biography" card/button at the top of the existing Overview page.

**Cover page** (editorial/book style): full-bleed background image using the biography's `cover_photo_path`, falling back to `avatar_photo_path`, falling back to a solid gradient if neither is set (so it never looks broken with no photo configured). Large serif title (`biography.title`) and tagline (`biography.tagline`) centered over the image, with a quiet hint: "↓ choose a section to begin reading."

**Empty biography state:** if there is no content anywhere (no stories, milestones, media, family members, career entries, or map pins), the Cover still renders title/tagline, but the hint is replaced with: "Nothing to read yet — add stories, photos, and milestones from the editor."

**Sidebar** (persistent for the whole Reader Mode session): fixed-width, lists the 7 sections (Cover, Stories, Timeline, Gallery, Family Tree, Career, Maps) with the active one highlighted. A small "← Exit Reader" link sits above the list, returning to `/` in the normal editor.

## 4. Per-Section Content

Each section reuses the sort order already used by its editor counterpart:

| Section | Content | Sort | Reuses |
|---|---|---|---|
| Stories | Published stories only (`status = 'published'`) | `event_date DESC`, falling back to `created_at DESC` (same as today's `listStories`) | `StoryEditor readOnly` for the full read view |
| Timeline | All milestones | `date ASC, created_at ASC` (same as today) | Existing Timeline visual, minus "Add Milestone" |
| Gallery | All albums, with covers | `created_at DESC` (same as today) | New shared `AlbumGrid`, minus "Import Photos" |
| Family Tree | All family members | `surname, given_name` (same as today) | Existing tree/list view, minus add/edit controls |
| Career | All career entries | existing order | Existing list view, minus add/edit controls |
| Maps | All map pins | `COALESCE(visit_date, created_at) DESC` (same as today) | Existing map view, minus add/edit controls |

If a section has zero items, it shows the same empty-state copy already used in its editor page, minus the "Add" call-to-action button.

## 5. File Structure

**New pages** (`src/pages/reader/`):
- `ReaderShell.tsx` — full-screen container: persistent sidebar + `<Outlet />`
- `ReaderCoverPage.tsx`
- `ReaderStoriesPage.tsx`, `ReaderStoryPage.tsx`
- `ReaderTimelinePage.tsx`
- `ReaderGalleryPage.tsx`, `ReaderAlbumPage.tsx`
- `ReaderFamilyTreePage.tsx`
- `ReaderCareerPage.tsx`
- `ReaderMapsPage.tsx`

**New shared component:**
- `src/components/gallery/AlbumGrid.tsx` — grid + lightbox + video playback, extracted from the current `AlbumPage` (a refactor of existing code, not a rebuild); `AlbumPage` is updated to use it too.

**New component:**
- `src/components/reader/ReaderSidebar.tsx` — persistent section nav + "Exit Reader" link

**Modified:**
- `src/routes/index.tsx` — add the `/reader/*` route tree, following the existing `createRoute` pattern
- `src/pages/OverviewPage.tsx` — add the "Read My Biography" entry point
- `src/lib/actions/stories.ts` — add a published-only variant/filter for Reader's story list
- `src/pages/gallery/AlbumPage.tsx` — refactored to use the new shared `AlbumGrid`

## 6. Data Access

No new database tables or migrations. Reader Mode only reads data that already exists (biography, stories, milestones, albums, media, family members, career entries, map pins). It works identically regardless of sync mode (`web-master` / `app-master` / `standalone`) since it never touches the network — purely local SQLite reads.

## 7. Testing

- **Vitest unit tests:** the published-only story filter, and the "is the biography completely empty" check driving the Cover page's empty state.
- **Manual smoke test:** each of the 7 sections exercised in the running app, consistent with how the rest of this UI-heavy codebase is verified today (no existing E2E/component-test framework to extend here).

## 8. Out of Scope

- Static-site export (#3) and PDF/book export (#4) — separate future cycles that will reuse Reader Mode's rendering approach.
- Print-friendly styling.
- A "show drafts" toggle (deferred; Reader Mode always shows published-only for now).
- Any new authoring/editing capability — Reader Mode is strictly read-only.
