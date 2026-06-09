# LifeScribe Desktop ↔ Web Sync — Design Spec

**Date:** 2026-06-08  
**Status:** Approved  
**Scope:** `src/lib/sync-service.ts` + `src/pages/settings/SettingsPage.tsx`

---

## Problem

The desktop app has a skeleton `sync-service.ts` that can authenticate and fire HTTP requests, but the sync orchestration is broken in several ways:

1. `RemoteProfile` type is missing the `site` field returned by `/me`
2. Push payload sends `synced_at` but the API expects `last_synced_at` — stale detection never fires
3. `remote_id_map` returned by push is discarded — local records never receive their remote CUID
4. `synced_at` is never updated after a successful push
5. Pull response is never merged into local SQLite
6. `uploadMedia()` is not implemented
7. `syncToRemote` filters stories to `published` only — drafts never sync

---

## Architecture

All changes stay within two existing files. No new files.

### `src/lib/sync-service.ts`

Plain exported functions — no classes. Matches the existing style of every other file in the project.

### `src/pages/settings/SettingsPage.tsx`

Small update to the connected-state UI to show site title and a link, and to display conflict counts.

---

## Data Flow: `syncToRemote`

```
1. Load all local entities from SQLite
   - stories: all statuses (draft + published)
   - biography, milestones, career_entries, map_pins, family_members, albums

2. Map each entity to API push shape
   - Rename synced_at → last_synced_at on every record

3. POST /sync/push
   Response: { pushed, conflicts, remote_id_map }

4. Persist remote_id_map
   - Key format: "entityType:localId" → remoteCuid
   - For each entry: UPDATE {table} SET remote_id=?, synced_at=datetime('now') WHERE id=?

5. Update synced_at for already-linked records (had remote_id, no conflict)
   - These were updated on the web but don't appear in remote_id_map
   - UPDATE {table} SET synced_at=datetime('now') WHERE remote_id IS NOT NULL AND id IN (...)

6. GET /sync/pull?since=<last_pull_at from localStorage, or omit on first sync>
   - Store last_pull_at = syncStartedAt in localStorage after a successful pull

7. Merge pull result into local SQLite (see Pull-Merge section)

8. Return { pushed, pulled, conflicts, errors }
```

### Table routing for `remote_id_map` keys

| Key prefix      | Local table      |
|-----------------|------------------|
| `stories:N`     | `stories`        |
| `milestones:N`  | `milestones`     |
| `career:N`      | `career_entries` |
| `map_pins:N`    | `map_pins`       |
| `family_members:N` | `family_members` |
| `albums:N`      | `albums`         |

---

## Pull-Merge Behavior

For each entity type returned by `GET /sync/pull`:

- **Match by `remote_id`**: if a local record has that `remote_id`, UPDATE it with web values
- **No match**: INSERT as a new local record (covers entities created on the web)
- Always set `remote_id` and `synced_at = datetime('now')` on every upserted record

Pull responses do not include a local integer `id`, so:
- UPDATEs use `WHERE remote_id = ?`
- INSERTs let SQLite auto-assign `id`

### Field mapping (pull response → local columns)

| Entity         | Web field names                                                                 | Notes                        |
|----------------|---------------------------------------------------------------------------------|------------------------------|
| Biography      | `title, tagline, bio`                                                           | Always UPDATE biography id=1 |
| Stories        | `title, slug, content, excerpt, status, event_date, event_date_precision, remote_id` | status already lowercase |
| Milestones     | `title, description, date, date_precision, remote_id`                          |                              |
| Career         | `organization, title, description, start_date, end_date, is_current, location, remote_id` |                    |
| Map pins       | `name, description, latitude, longitude, remote_id`                            |                              |
| Family members | `given_name, surname, birth_date, death_date, bio, remote_id`                  |                              |
| Albums         | `name, description, remote_id`                                                 |                              |

---

## `uploadMedia(filePath, albumId?)`

```typescript
async function uploadMedia(filePath: string, albumId?: string): Promise<{ url: string; mediaId: string }>
```

- Read file bytes with `readFile` from `@tauri-apps/plugin-fs`
- POST multipart to `POST /sync/media`
  - Field `file`: Blob with filename derived from path
  - Field `albumId`: optional remote album CUID
- Do **not** set `Content-Type` — browser sets the multipart boundary automatically
- Returns `{ url, mediaId }` from response `data`

---

## Type Fixes

### `RemoteProfile`

```typescript
export interface RemoteProfile {
  id: string;
  email: string;
  display_name: string;
  site: { id: string; slug: string; title: string };
}
```

### `FullSyncResult`

```typescript
export interface FullSyncResult {
  pushed: number;
  pulled: number;
  conflicts: string[];
  errors: string[];
}
```

---

## SettingsPage Changes

**Connected state** — currently shows name + email. After this change:

- Show: `Connected as {display_name}` + `{email}`
- Add: site title as a clickable link to `https://lifescribe.us/{site.slug}`
- Sync status message: `"Sync complete — {pushed} pushed, {pulled} pulled"`
- If conflicts > 0: `"{n} items not synced — edit them on lifescribe.us to resolve"`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Conflicts returned by push | Non-fatal; recorded in `conflicts[]`; surfaced in UI message |
| Pull failure | Non-fatal; logged to console; push result still reported |
| Network error on push | Throws; caught by Settings `handleSync`; shown in `syncStatus` |
| Invalid token | 401 from API; `testConnection` throws; Settings shows error, clears credentials |

---

## What Is Not In Scope

- Automatic background sync (sync is manual, triggered by "Sync Now" button)
- Media batch-upload as part of the sync flow (`uploadMedia` is a utility function only)
- Conflict resolution UI (user is directed to lifescribe.us to resolve)
- Deletion sync (deleting locally does not delete on the web, and vice versa)
