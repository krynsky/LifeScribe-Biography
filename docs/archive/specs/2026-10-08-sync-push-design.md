# Phase 7 design: publishing from the app to lifescribe.us (optional sync push)

**Date:** 2026-10-08
**Status:** Proposed. Waiting on the decisions in section 6.

The app works fully on its own. This phase adds an optional **Publish** step so a user who connects a lifescribe.us account can send what they wrote in the app to their website. Refresh (web → app) already exists.

## 1. What exists today

- **Refresh (pull):** brings the web's content into the app. Done and tested.
- **Publish (push):** sends only title/body-style text fields, and only for records that were *already linked to the web and then edited*. Brand-new app records are never listed, and none of these ever reach the web: images, categories, tags, links, family relationships and gender/name parts, end dates, employment type, subject name, albums' covers and media.
- **The web's push API** (`/api/v1/sync/push`) accepts only core text fields and ignores everything else. It has a stale-edit check (`last_synced_at` older than the web's `updatedAt` → conflict) but **no delete endpoint** (the app calls one that does not exist). Photo upload (`/api/v1/sync/media`) exists but takes album photos only.
- **Safety history:** an earlier sync overwrote rich web content and needed a database point-in-time restore. Publish therefore has to be explicit, previewable and reversible.

## 2. Principles

1. Publishing is always a deliberate action, never automatic. The app shows exactly what will change before anything is sent.
2. The app never silently overwrites web edits. If both sides changed a record, the user chooses.
3. A backup of the local database is taken before every Refresh and every Publish.
4. Anything the web can't accept is reported per item; one failure never blocks the rest.
5. New web API fields are additive, so older app builds keep working.

## 3. Pieces

**A. Safety net (app).** Rotating local database backups (last 10) before sync actions. A "Review before publishing" screen listing **new**, **changed** and **deleted** items per section with counts, where the user can untick items. A conflicts screen showing the app's version and the web's version side by side with "Keep mine" / "Use the web's".

**B. Core fields (app + web).** Extend the push payload and the web's validation and upsert code for: stories (summary, cover image, category, tags), milestones (end date, image, category), career (employment type, logo, category), places (image, category), albums (category, tags, cover, media), family members (gender, birth surname, nickname, suffix, photo, bio), and biography (subject name, profile photo, banner). Categories and tags are matched by name (created on the web if missing).

**C. Links and relationships (app + web).** Push story/album links to milestones, places and career, and family relationships (parent, child, sibling, spouse). Replace-by-owner so removing a link in the app removes it on the web.

**D. Images and media (app + web).** A new upload endpoint for single images (covers, logos, photos, banner) returning the stored URL; album photos go through the existing media route. Local file paths in the payload are replaced by those URLs. Story bodies are rewritten the same way: inline image URLs are uploaded and replaced; Google Maps embeds created in the app (keyless) are kept as they are if the web's renderer accepts them, otherwise converted.

**E. Deletes (app + web).** A small "removed in the app" list (tombstones) recorded when a linked record is deleted. Publish shows these as "also remove from the website?" and, if confirmed, calls a new delete endpoint. Nothing is ever deleted on the web without that confirmation.

**F. Verification.** Unit tests on the app side as before. For the web side, tests against a **non-production database** (see decision 1), plus a dry-run mode on the push API that validates and reports what *would* change without writing.

## 4. Suggested build order (each ships and can be tested alone)

1. **7a Safety net:** backups, review screen listing new/changed/deleted, conflicts screen. No new web writes yet.
2. **7b Core fields + taxonomy:** B for text, dates, categories, tags (no images yet). First real publish of new records.
3. **7c Links and relationships:** C.
4. **7d Images, media and story bodies:** D.
5. **7e Deletes:** E.

## 5. Risks

- Publishing changes the live site, so web changes must be deployed before the app can use them, and a bug in the web upsert code can affect real content. This is why decision 1 matters.
- Slug collisions: a new app story with a slug the web already has must not overwrite that web story (the current code returns the existing one silently); the new code must keep both.
- Date handling across time zones: dates are stored as midnight UTC on the web; the app must send dates without shifting the day.
- Large uploads and flaky connections: uploads need retry and resumable per-item progress.

## 6. Decisions needed

1. Where may Publish be tested?
2. How should deletes behave?
3. How should story-body images be handled?
4. Which order to build in?
