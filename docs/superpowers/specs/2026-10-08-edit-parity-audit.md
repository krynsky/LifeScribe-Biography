# Edit parity audit: web editor vs. desktop app

**Date:** 2026-10-08
**Goal:** Every editing capability on lifescribe.us exists in the app. The app is a standalone product: creating, editing and reading work with no web account. Connecting to the web is optional.

Sources compared: the web's site editor (`apps/web/src/components/*`, `app/actions/*`, `site/[siteId]/*`) and the app's `src/pages/*`, `src/lib/actions/*`.

## 1. Feature gap, by section

| Area | Web can | App can today | Gap |
|---|---|---|---|
| **Stories** | Title, rich body, excerpt, **cover photo**, status Draft/Published (autosave "Draft saved"), event date with **year/month/day pickers**, **category**, **tags** (create inline), slug, **Related Entries** (link milestones, albums, pins, career), delete | Title, body, excerpt, status, one date field, autosave | Cover photo, category, tags, related entries, precision pickers, slug |
| **Rich-text editor** | Block/format dropdowns, text color + highlight, lists, links, tables + table toolbar, image from media library, YouTube/Vimeo/**Google Maps**/oEmbed via dialog, undo/redo | Basic toolbar; can render embeds, can't insert them; local image picker only | Embed insert dialogs, color/highlight, tables toolbar, media picker, link dialog |
| **Timeline** | Title, description, date + precision, **end date + precision**, **category**, image, link stories/albums, reorder | Title, description, date, precision, free-text category, color | End date, category (managed), image, links, ordering |
| **Career** | Job title, company, **employment type**, location, month/year pickers, current flag, description, **logo upload**, **category**, links | Type, company, title, location, dates, description | Employment type, logo, category, links |
| **Places** | Add by map click or manually (name, lat/long), description, **image**, **category**, links, reorder | Add by map click, name, description | Image, category, manual coordinates, links |
| **Family tree** | Given name, surname plus **birth surname, nickname, suffix, gender**, birth/death date, bio, **photo**, **add/remove relationships** (parent, child, sibling, spouse, partner, other), "link to a LifeScribe user" | Given name, surname, dates, birthplace, bio | Gender, name parts, photo, **relationship editing**, ordering |
| **Gallery** | Create/edit album (title, description, **category, tags**), upload photos (drag-drop, progress), **add image/video by URL** (YouTube etc.), captions, **set cover**, delete media/album, reorder | Import pages only (local photos); no album create/edit, captions, cover or URL add | Whole album and media editor |
| **Categories** | Create/rename/recolor/icon/delete, usage counts, shared by stories, timeline, career, albums, pins | Tables exist but unused | Manager + pickers |
| **Tags** | Rename, merge, delete, unused flag | Tables exist but unused | Manager + picker |
| **Site profile** | Title, tagline, bio, **subject name parts**, **profile photo**, **banner**, visibility, directory listing | Title, tagline, bio, cover/avatar columns (no UI) | Photos and subject-name fields in the app; visibility/directory stay on the web |
| **Navigation** | Show/hide/reorder standard sections, add custom sections | None | Stays on the web (issue 5) |
| **Memorial** | Memorial mode, message, guestbook moderation, inactivity reminder | None | Stays on the web (issue 5) |
| **Sync** | n/a | Pull everything; push only core text fields | Push of all the new fields (see issue 3) |

## 2. Issues to address before building

These are blockers or decisions. Building without settling them risks rework or data loss.

### 1. Categories and tags need a real local model (blocker)
The app has `categories`, `tags`, `story_categories`, `story_tags` tables that nothing uses. The sync I just added stores category and tags as plain text copied onto each row (`category`, `category_color`, `tags` JSON). Editing needs real shared records (rename once, applies everywhere; recolor; merge; delete). That means:
- one `categories` table (name, slug, color, icon) and a `category_id` on stories, milestones, career, pins, albums;
- one `tags` table and join tables for stories and albums;
- a migration that converts the denormalized text from the first sync into those records, and a sync that maps by remote id/slug.

### 2. Entry linking has no local model (blocker)
The web's Related Entries link stories to milestones, albums, pins and career entries (and those pages show them back). Locally we only store a read-only JSON snapshot from the last pull. Standalone editing needs real link tables (`story_milestones`, `story_albums`, `story_pins`, `story_career`) with UI, and the read views must read them instead of the snapshot.

### 3. Sync push covers almost none of what the editor will create (blocker for the optional connection)
The web's `/sync/push` accepts only core text fields (title, dates, description, etc.). It has no category, tags, images, links, gender/name parts, relationships, end dates, ordering or employment type, and no categories/tags objects at all. For connected users to publish what they edit, the push API and its validation schemas must grow to match. The pull side also only sends **published** stories, so web drafts never reach the app; that needs a decision. Deletes are one-way today (app delete does not reach the web, and a web delete removes the local record).

### 4. Standalone image storage (decided: copy into the app folder)
Edits need covers, logos, pin and family photos, profile photo and banner. Every image the user adds is copied into the app's data folder so the biography is self-contained. Existing photo import still references original paths; migrate it to copy as well. Publishing to the web requires uploading those files; the web has `/sync/media` for that, but the app only uses it for download today.

### 5. Hosted-site-only features (decided: stay on the web)
Visibility, public directory listing, guestbook/memorial, invitations, "link a LifeScribe user" and the public site's navigation menu are **not** built into the app; they remain managed on lifescribe.us. The app still auto-generates story slugs (needed for sync) but does not expose them. Site profile fields that are content (title, tagline, bio, subject name, profile photo, banner) are built.

### 6. Rich-text embeds (decided: supported providers + link cards)
YouTube, Vimeo and Google Maps embed natively. Any other URL becomes a simple link card. When connected, the web's oEmbed service may be used for more providers later.

### 7. Google Maps embeds in stories need a key policy (risk)
The web's embeds use a referrer-restricted API key. I rewrote them to the keyless form for display. New embeds created in the app must also be keyless, and when published they should be converted back to whatever the web expects. Needs a rule so each side keeps working.

### 8. Conflict and loss protection (risk)
There was already one data-loss incident from sync overwriting rich content (documented in the sync design). With full editing on both sides, conflicts become likely. Before enabling push for the new fields we need: a visible conflict resolution step, a backup of the local database before each sync, and dry-run counts before publishing.

### 9. Ordering (small)
The web has manual `position` ordering for timeline, albums, pins and family; the app orders by dates. Add a position column and drag-to-reorder, kept in sync.

### 10. Testing (risk)
Almost everything in the app UI is unreachable from automated tests today (Tauri-only). Each phase needs unit tests for the data layer plus a short manual checklist, and the sync push needs a test against a throwaway web database, not production.

### 11. In-story images use machine-specific addresses (found in phase 2)
Images inserted into a story body are stored as Tauri asset URLs that contain the absolute path on this computer. That is fine for local use, but a published or exported copy needs a portable form (for example an app-relative library reference rewritten on publish). Settle this in phase 7 before publishing story bodies to the web.

## 3. Proposed build order

Each phase ships on its own and keeps the app usable.

1. **Foundation (issues 1, 2, 4, 9):** categories/tags tables and migration, link tables, image storage (copy-in), position ordering, shared picker components (category, tags, image upload, date with precision).
2. **Stories:** full story editor (cover, category, tags, related entries, precision dates, slug) and the rich-text toolbar and embeds.
3. **Timeline, Career, Places:** every field above, with images, categories and links.
4. **Family tree:** name parts, gender, photo, relationship editor.
5. **Gallery:** album create/edit, upload, add by URL, captions, cover, reorder.
6. **Site profile, categories and tags managers:** profile photo, banner, subject name, and the managers.
7. **Sync push (issue 3, 8):** web API extension, conflict step, backup, deletes, then end-to-end test.

Phases 1-6 work with no web account. Phase 7 is the optional connection.

## 4. Progress

- **Phase 1 (foundation):** done and committed.
- **Phase 2 (stories and rich-text editor):** done. Stories have cover photo (upload or from gallery), category, tags, year/month/day date, summary, status, related entries and delete, all autosaved. The editor has text style, color/highlight, sub/superscript, checklist, code block, link and embed panels, table controls and an image picker.
- **Phase 3 (timeline, career, places):** done. Milestones: end date, category, image, linked stories and albums. Career: employment type, month/year dates, logo, category, links. Places: image, category, links, manual coordinates, map click and place search (needs internet; manual entry works offline). Reordering is not built: the web has no drag-to-reorder UI for these either.

