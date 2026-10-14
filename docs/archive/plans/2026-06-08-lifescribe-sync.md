# LifeScribe Desktop ↔ Web Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the desktop app's existing sync skeleton to the live LifeScribe.us REST API so push persists remote IDs, pull merges web changes into local SQLite, and the Settings UI shows the connected site.

**Architecture:** All changes are confined to `src/lib/sync-service.ts` (rewrite the orchestration layer; keep auth helpers and `apiRequest` unchanged) and `src/pages/settings/SettingsPage.tsx` (show site title/link and conflict counts). No new files, no new dependencies — `@tauri-apps/plugin-fs` is already installed.

**Tech Stack:** TypeScript, Tauri 2 (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-sql`), React, localStorage for auth/sync state, SQLite via Tauri plugin

---

## File Map

| File | Change |
|---|---|
| `src/lib/sync-service.ts` | Rewrite orchestration; fix types; add helpers; add `uploadMedia` |
| `src/pages/settings/SettingsPage.tsx` | Show site title + link; update sync status message |

---

## Task 1: Fix type definitions

**Files:**
- Modify: `src/lib/sync-service.ts`

- [ ] **Step 1: Replace `RemoteProfile` and `FullSyncResult` with correct shapes**

Open `src/lib/sync-service.ts`. Replace:

```typescript
export interface RemoteProfile {
  id: string;
  email: string;
  display_name: string;
}
```

with:

```typescript
export interface RemoteProfile {
  id: string;
  email: string;
  display_name: string;
  site: { id: string; slug: string; title: string };
}
```

Replace:

```typescript
export interface FullSyncResult {
  pushed: number;
  errors: string[];
}
```

with:

```typescript
export interface FullSyncResult {
  pushed: number;
  pulled: number;
  conflicts: string[];
  errors: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
pnpm tsc --noEmit
```

Expected: no errors on the changed interfaces. (`SettingsPage.tsx` will have a type error on `syncDone` usage once `FullSyncResult` changes — that's fine, it gets fixed in Task 6.)

---

## Task 2: Add storage key, imports, and `toApiRecord` helper

**Files:**
- Modify: `src/lib/sync-service.ts`

- [ ] **Step 1: Add the `last_pull_at` storage key constant**

At the top of `src/lib/sync-service.ts`, after the existing constants, add:

```typescript
const STORAGE_KEY_LAST_PULL = "lifescribe_last_pull_at";
```

- [ ] **Step 2: Add model-type imports and `readFile` import**

Replace the existing import line near the bottom of the file:

```typescript
import { query } from "./db";
```

with:

```typescript
import { readFile } from "@tauri-apps/plugin-fs";
import { query, execute } from "./db";
import type { Album, Biography, CareerEntry, FamilyMember, MapPin, Milestone, Story } from "./models";
```

- [ ] **Step 3: Clear the `last_pull_at` key when credentials are cleared**

In `clearSyncCredentials()`, add one line so cached pull state is also removed on disconnect:

```typescript
export function clearSyncCredentials(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_LAST_PULL);
}
```

- [ ] **Step 4: Add the `toApiRecord` helper**

Add this private function after the `pullFromRemote` export (before the sync orchestration section):

```typescript
// Renames synced_at → last_synced_at for the push API contract.
function toApiRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { synced_at, ...rest } = record;
  return { ...rest, last_synced_at: (synced_at as string | null) ?? null };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```
pnpm tsc --noEmit
```

Expected: no new errors.

---

## Task 3: Implement `persistPushResults`

This function writes the push response back to local SQLite: for each entity that was sent and didn't conflict, it sets `remote_id` (if newly assigned) and `synced_at = datetime('now')`. Biography is handled separately since it has no integer id.

**Files:**
- Modify: `src/lib/sync-service.ts`

- [ ] **Step 1: Add the `EntityBatch` interface and `persistPushResults` function**

Add this block after `toApiRecord` in `src/lib/sync-service.ts`:

```typescript
interface EntityBatch {
  table: string;
  typeKey: string;
  ids: number[];
}

async function persistPushResults(
  result: SyncResult,
  batches: EntityBatch[],
  biographyWasPushed: boolean
): Promise<void> {
  const conflictSet = new Set(result.conflicts);

  for (const { table, typeKey, ids } of batches) {
    for (const id of ids) {
      const baseKey = `${typeKey}:${id}`;
      // Skip if any conflict key starts with this base key
      // (e.g. "stories:5:stale" starts with "stories:5")
      if ([...conflictSet].some((c) => c.startsWith(baseKey))) continue;

      const remoteId = result.remote_id_map[baseKey];
      if (remoteId) {
        // Newly linked — write remote CUID and mark synced
        await execute(
          `UPDATE ${table} SET remote_id = ?, synced_at = datetime('now') WHERE id = ?`,
          [remoteId, id]
        );
      } else {
        // Previously linked — just mark synced
        await execute(
          `UPDATE ${table} SET synced_at = datetime('now') WHERE id = ?`,
          [id]
        );
      }
    }
  }

  if (biographyWasPushed) {
    await execute(
      `UPDATE biography SET synced_at = datetime('now') WHERE id = 1`,
      []
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
pnpm tsc --noEmit
```

Expected: no errors.

---

## Task 4: Implement `mergePullResult`

Upserts every entity type returned by the pull API into local SQLite. Matches on `remote_id`; inserts if no match (true two-way sync).

**Files:**
- Modify: `src/lib/sync-service.ts`

- [ ] **Step 1: Add `mergePullResult` function**

Add this function after `persistPushResults` in `src/lib/sync-service.ts`:

```typescript
async function mergePullResult(data: SyncPayload): Promise<number> {
  let pulled = 0;

  // biography — always update the single local row
  if (data.biography) {
    const bio = data.biography as { title?: string; tagline?: string | null; bio?: string | null };
    await execute(
      `UPDATE biography
          SET title     = COALESCE(?, title),
              tagline   = ?,
              bio       = ?,
              synced_at = datetime('now')
        WHERE id = 1`,
      [bio.title ?? null, bio.tagline ?? null, bio.bio ?? null]
    );
    pulled++;
  }

  // stories
  for (const raw of (data.stories ?? []) as Array<Record<string, unknown>>) {
    const s = raw as {
      remote_id: string; title: string; slug?: string | null;
      content?: string | null; excerpt?: string | null; status: string;
      event_date?: string | null; event_date_precision?: string | null;
    };
    const upd = await execute(
      `UPDATE stories
          SET title               = ?,
              slug                = ?,
              content             = ?,
              excerpt             = ?,
              status              = ?,
              event_date          = ?,
              event_date_precision = ?,
              synced_at           = datetime('now')
        WHERE remote_id = ?`,
      [s.title, s.slug ?? null, s.content ?? null, s.excerpt ?? null,
       s.status, s.event_date ?? null, s.event_date_precision ?? null, s.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO stories
           (title, slug, content, excerpt, status,
            event_date, event_date_precision, remote_id, synced_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
        [s.title, s.slug ?? null, s.content ?? null, s.excerpt ?? null,
         s.status, s.event_date ?? null, s.event_date_precision ?? null, s.remote_id]
      );
    }
    pulled++;
  }

  // milestones
  for (const raw of (data.milestones ?? []) as Array<Record<string, unknown>>) {
    const m = raw as {
      remote_id: string; title: string; description?: string | null;
      date: string; date_precision?: string | null;
    };
    const upd = await execute(
      `UPDATE milestones
          SET title          = ?,
              description    = ?,
              date           = ?,
              date_precision = ?,
              synced_at      = datetime('now')
        WHERE remote_id = ?`,
      [m.title, m.description ?? null, m.date, m.date_precision ?? null, m.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO milestones
           (title, description, date, date_precision, remote_id, synced_at)
         VALUES (?,?,?,?,?,datetime('now'))`,
        [m.title, m.description ?? null, m.date, m.date_precision ?? null, m.remote_id]
      );
    }
    pulled++;
  }

  // career entries
  for (const raw of (data.career ?? []) as Array<Record<string, unknown>>) {
    const c = raw as {
      remote_id: string; organization: string; title?: string | null;
      description?: string | null; start_date?: string | null;
      end_date?: string | null; is_current?: boolean | number; location?: string | null;
    };
    const isCurrent = c.is_current === true || c.is_current === 1 ? 1 : 0;
    const upd = await execute(
      `UPDATE career_entries
          SET organization = ?,
              title        = ?,
              description  = ?,
              start_date   = ?,
              end_date     = ?,
              is_current   = ?,
              location     = ?,
              synced_at    = datetime('now')
        WHERE remote_id = ?`,
      [c.organization, c.title ?? null, c.description ?? null,
       c.start_date ?? null, c.end_date ?? null, isCurrent,
       c.location ?? null, c.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO career_entries
           (organization, title, description, start_date, end_date,
            is_current, location, remote_id, synced_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
        [c.organization, c.title ?? null, c.description ?? null,
         c.start_date ?? null, c.end_date ?? null, isCurrent,
         c.location ?? null, c.remote_id]
      );
    }
    pulled++;
  }

  // map pins
  for (const raw of (data.map_pins ?? []) as Array<Record<string, unknown>>) {
    const p = raw as {
      remote_id: string; name: string; description?: string | null;
      latitude: number; longitude: number;
    };
    const upd = await execute(
      `UPDATE map_pins
          SET name        = ?,
              description = ?,
              latitude    = ?,
              longitude   = ?,
              synced_at   = datetime('now')
        WHERE remote_id = ?`,
      [p.name, p.description ?? null, p.latitude, p.longitude, p.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO map_pins
           (name, description, latitude, longitude, remote_id, synced_at)
         VALUES (?,?,?,?,?,datetime('now'))`,
        [p.name, p.description ?? null, p.latitude, p.longitude, p.remote_id]
      );
    }
    pulled++;
  }

  // family members
  for (const raw of (data.family_members ?? []) as Array<Record<string, unknown>>) {
    const fm = raw as {
      remote_id: string; given_name: string; surname?: string | null;
      birth_date?: string | null; death_date?: string | null; bio?: string | null;
    };
    const upd = await execute(
      `UPDATE family_members
          SET given_name  = ?,
              surname     = ?,
              birth_date  = ?,
              death_date  = ?,
              bio         = ?,
              synced_at   = datetime('now')
        WHERE remote_id = ?`,
      [fm.given_name, fm.surname ?? null, fm.birth_date ?? null,
       fm.death_date ?? null, fm.bio ?? null, fm.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO family_members
           (given_name, surname, birth_date, death_date, bio, remote_id, synced_at)
         VALUES (?,?,?,?,?,?,datetime('now'))`,
        [fm.given_name, fm.surname ?? null, fm.birth_date ?? null,
         fm.death_date ?? null, fm.bio ?? null, fm.remote_id]
      );
    }
    pulled++;
  }

  // albums
  for (const raw of (data.albums ?? []) as Array<Record<string, unknown>>) {
    const a = raw as { remote_id: string; name: string; description?: string | null };
    const upd = await execute(
      `UPDATE albums
          SET name        = ?,
              description = ?,
              synced_at   = datetime('now')
        WHERE remote_id = ?`,
      [a.name, a.description ?? null, a.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO albums (name, description, remote_id, synced_at)
         VALUES (?,?,?,datetime('now'))`,
        [a.name, a.description ?? null, a.remote_id]
      );
    }
    pulled++;
  }

  return pulled;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
pnpm tsc --noEmit
```

Expected: no errors.

---

## Task 5: Implement `uploadMedia` and rewrite `syncToRemote`

**Files:**
- Modify: `src/lib/sync-service.ts`

- [ ] **Step 1: Add `uploadMedia` export**

Add this after the `pullFromRemote` export:

```typescript
export async function uploadMedia(
  filePath: string,
  albumId?: string
): Promise<{ url: string; mediaId: string }> {
  const bytes = await readFile(filePath);
  const filename = filePath.replace(/\\/g, "/").split("/").pop() ?? "file";
  const blob = new Blob([bytes]);

  const form = new FormData();
  form.append("file", blob, filename);
  if (albumId) form.append("albumId", albumId);

  const token = getSyncToken();
  const baseUrl = getSyncUrl().replace(/\/$/, "");

  const resp = await fetch(`${baseUrl}/sync/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload ${resp.status}: ${text.substring(0, 200)}`);
  }

  const json = (await resp.json()) as ApiResponse<{ url: string; mediaId: string }>;
  if (json.error) throw new Error(json.error);
  return json.data;
}
```

- [ ] **Step 2: Replace `syncToRemote` with the full orchestrated version**

Delete the existing `syncToRemote` function (lines 116–148 in the original file) and replace with:

```typescript
export async function syncToRemote(onProgress?: (msg: string) => void): Promise<FullSyncResult> {
  onProgress?.("Loading local data…");

  const [biography, stories, milestones, career, mapPins, familyMembers, albums] =
    await Promise.all([
      query<Biography>("SELECT * FROM biography LIMIT 1"),
      query<Story>("SELECT * FROM stories"),
      query<Milestone>("SELECT * FROM milestones"),
      query<CareerEntry>("SELECT * FROM career_entries"),
      query<MapPin>("SELECT * FROM map_pins"),
      query<FamilyMember>("SELECT * FROM family_members"),
      query<Album>("SELECT * FROM albums"),
    ]);

  const bio = biography[0];

  const payload: SyncPayload = {
    biography: bio ? toApiRecord(bio as Record<string, unknown>) : undefined,
    stories: stories.map((s) => toApiRecord(s as Record<string, unknown>)),
    milestones: milestones.map((m) => toApiRecord(m as Record<string, unknown>)),
    career: career.map((c) => toApiRecord(c as Record<string, unknown>)),
    map_pins: mapPins.map((p) => toApiRecord(p as Record<string, unknown>)),
    family_members: familyMembers.map((f) => toApiRecord(f as Record<string, unknown>)),
    albums: albums.map((a) => toApiRecord(a as Record<string, unknown>)),
  };

  onProgress?.("Pushing to LifeScribe.us…");
  const pushResult = await pushToRemote(payload);

  onProgress?.("Saving sync state…");
  const batches: EntityBatch[] = [
    { table: "stories",        typeKey: "stories",        ids: stories.map((s) => s.id) },
    { table: "milestones",     typeKey: "milestones",     ids: milestones.map((m) => m.id) },
    { table: "career_entries", typeKey: "career",         ids: career.map((c) => c.id) },
    { table: "map_pins",       typeKey: "map_pins",       ids: mapPins.map((p) => p.id) },
    { table: "family_members", typeKey: "family_members", ids: familyMembers.map((f) => f.id) },
    { table: "albums",         typeKey: "albums",         ids: albums.map((a) => a.id) },
  ];
  await persistPushResults(pushResult, batches, !!bio);

  onProgress?.("Pulling web changes…");
  const syncStartedAt = new Date().toISOString();
  const since = localStorage.getItem(STORAGE_KEY_LAST_PULL) ?? undefined;
  let pulled = 0;
  try {
    const pullData = await pullFromRemote(since);
    pulled = await mergePullResult(pullData);
    localStorage.setItem(STORAGE_KEY_LAST_PULL, syncStartedAt);
  } catch (err) {
    console.error("[sync] pull failed:", err);
  }

  return {
    pushed: pushResult.pushed,
    pulled,
    conflicts: pushResult.conflicts,
    errors: [],
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```
pnpm tsc --noEmit
```

Expected: no errors in `sync-service.ts`. (SettingsPage may still have a type mismatch on `syncDone` — fixed next task.)

---

## Task 6: Update SettingsPage

Shows the connected site title + link, and surfaces pushed/pulled/conflict counts in the sync status message.

**Files:**
- Modify: `src/pages/settings/SettingsPage.tsx`

- [ ] **Step 1: Update sync state and `handleSync` to use the new `FullSyncResult` shape**

In `SettingsPage.tsx`, replace the existing `syncDone` state with a `syncResult` state, and update `handleSync`:

Replace this block:

```typescript
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncDone, setSyncDone] = useState(false);
```

with:

```typescript
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncResult, setSyncResult] = useState<{ pushed: number; pulled: number; conflicts: string[] } | null>(null);
```

Replace the existing `handleSync` function:

```typescript
  async function handleSync() {
    setSyncing(true);
    setSyncDone(false);
    setSyncStatus("");
    try {
      await syncToRemote((msg) => setSyncStatus(msg));
      setSyncDone(true);
    } catch (err) {
      setSyncStatus("Sync failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }
```

with:

```typescript
  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncStatus("");
    try {
      const result = await syncToRemote((msg) => setSyncStatus(msg));
      setSyncResult(result);
      const conflictNote = result.conflicts.length > 0
        ? ` · ${result.conflicts.length} conflict${result.conflicts.length > 1 ? "s" : ""} — resolve at lifescribe.us`
        : "";
      setSyncStatus(`Sync complete — ${result.pushed} pushed, ${result.pulled} pulled${conflictNote}`);
    } catch (err) {
      setSyncStatus("Sync failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }
```

- [ ] **Step 2: Update the connected-state UI to show site title and link**

In the connected state JSX block, replace the profile display section:

```tsx
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: "var(--color-primary)" + "10", borderColor: "var(--color-primary)" + "40" }}
              >
                <CheckCircle size={16} style={{ color: "var(--color-primary)" }} />
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    Connected as {syncProfile.display_name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{syncProfile.email}</div>
                </div>
              </div>
```

with:

```tsx
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: "var(--color-primary)" + "10", borderColor: "var(--color-primary)" + "40" }}
              >
                <CheckCircle size={16} style={{ color: "var(--color-primary)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    Connected as {syncProfile.display_name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{syncProfile.email}</div>
                  <a
                    href={`https://lifescribe.us/${syncProfile.site.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs mt-0.5"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {syncProfile.site.title} <ExternalLink size={10} />
                  </a>
                </div>
              </div>
```

- [ ] **Step 3: Update sync status display to use `syncResult` instead of `syncDone`**

Replace the sync status JSX block:

```tsx
              {syncStatus && (
                <div className="text-xs flex items-center gap-2" style={{ color: syncDone ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {syncing && <Loader2 size={11} className="animate-spin" />}
                  {syncDone && <CheckCircle size={11} />}
                  {syncStatus}
                </div>
              )}
```

with:

```tsx
              {syncStatus && (
                <div className="text-xs flex items-center gap-2" style={{ color: syncResult ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {syncing && <Loader2 size={11} className="animate-spin" />}
                  {syncResult && !syncing && <CheckCircle size={11} />}
                  {syncStatus}
                </div>
              )}
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```
pnpm tsc --noEmit
```

Expected: zero errors.

---

## Task 7: Smoke test and commit

- [ ] **Step 1: Start the dev app**

```
pnpm tauri dev
```

- [ ] **Step 2: Test connection flow**

1. Open Settings → "Sync to LifeScribe.us" section
2. Paste a valid PAT token from `https://lifescribe.us/settings/tokens`
3. Click **Connect Account**
4. Expected: the connected state shows your name, email, and the site title as a clickable link

- [ ] **Step 3: Test Sync Now**

1. Click **Sync Now**
2. Watch the progress messages: "Loading local data…" → "Pushing to LifeScribe.us…" → "Saving sync state…" → "Pulling web changes…"
3. Expected final status: `"Sync complete — N pushed, M pulled"` (no error)
4. Open the Tauri SQLite DB (e.g. `%LOCALAPPDATA%\LifeScribe\lifescribe.db` via DB Browser for SQLite) and verify:
   - `remote_id` is now populated on synced records in `stories`, `milestones`, etc.
   - `synced_at` is set on those rows
5. Log in to `https://lifescribe.us` and confirm your content appears

- [ ] **Step 4: Test disconnect clears state**

1. Click **Disconnect**
2. Expected: token input form reappears
3. Reconnect and sync again — expected: same results (second sync updates `synced_at`, `remote_id_map` returns empty since records are already linked)

- [ ] **Step 5: Commit**

```
git add src/lib/sync-service.ts src/pages/settings/SettingsPage.tsx
git commit -m "feat(sync): wire push/pull to live API with remote ID persistence and pull-merge"
```

---

## Appendix: Complete final `sync-service.ts`

For reference, here is what the complete file should look like after all tasks:

```typescript
// LifeScribe.us sync service

import { readFile } from "@tauri-apps/plugin-fs";

import { query, execute } from "./db";
import type { Album, Biography, CareerEntry, FamilyMember, MapPin, Milestone, Story } from "./models";

const STORAGE_KEY_TOKEN = "lifescribe_sync_token";
const STORAGE_KEY_URL = "lifescribe_sync_url";
const STORAGE_KEY_LAST_PULL = "lifescribe_last_pull_at";
const DEFAULT_API_URL = "https://lifescribe.us/api/v1";

// ── Auth ──────────────────────────────────────────────────────────────────

export function getSyncToken(): string {
  return localStorage.getItem(STORAGE_KEY_TOKEN) ?? "";
}

export function getSyncUrl(): string {
  return localStorage.getItem(STORAGE_KEY_URL) ?? DEFAULT_API_URL;
}

export function saveSyncCredentials(token: string, url?: string): void {
  localStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
  localStorage.setItem(STORAGE_KEY_URL, (url ?? DEFAULT_API_URL).trim());
}

export function clearSyncCredentials(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_LAST_PULL);
}

export function isSyncConfigured(): boolean {
  return !!getSyncToken();
}

// ── API client ────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  data: T;
  error?: string;
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = getSyncToken();
  const baseUrl = getSyncUrl().replace(/\/$/, "");

  const resp = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text.substring(0, 200)}`);
  }

  const json = (await resp.json()) as ApiResponse<T>;
  if (json.error) throw new Error(json.error);
  return json.data;
}

// ── Connection test ───────────────────────────────────────────────────────

export interface RemoteProfile {
  id: string;
  email: string;
  display_name: string;
  site: { id: string; slug: string; title: string };
}

export async function testConnection(): Promise<RemoteProfile> {
  return apiRequest<RemoteProfile>("GET", "/me");
}

// ── Push/pull types ───────────────────────────────────────────────────────

export interface SyncPayload {
  biography?: object;
  stories?: object[];
  milestones?: object[];
  career?: object[];
  map_pins?: object[];
  family_members?: object[];
  albums?: object[];
}

export interface SyncResult {
  pushed: number;
  conflicts: string[];
  remote_id_map: Record<string, string>;
}

export interface FullSyncResult {
  pushed: number;
  pulled: number;
  conflicts: string[];
  errors: string[];
}

export async function pushToRemote(payload: SyncPayload): Promise<SyncResult> {
  return apiRequest<SyncResult>("POST", "/sync/push", payload);
}

export async function pullFromRemote(since?: string): Promise<SyncPayload> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiRequest<SyncPayload>("GET", `/sync/pull${qs}`);
}

// ── Media upload ──────────────────────────────────────────────────────────

export async function uploadMedia(
  filePath: string,
  albumId?: string
): Promise<{ url: string; mediaId: string }> {
  const bytes = await readFile(filePath);
  const filename = filePath.replace(/\\/g, "/").split("/").pop() ?? "file";
  const blob = new Blob([bytes]);

  const form = new FormData();
  form.append("file", blob, filename);
  if (albumId) form.append("albumId", albumId);

  const token = getSyncToken();
  const baseUrl = getSyncUrl().replace(/\/$/, "");

  const resp = await fetch(`${baseUrl}/sync/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload ${resp.status}: ${text.substring(0, 200)}`);
  }

  const json = (await resp.json()) as ApiResponse<{ url: string; mediaId: string }>;
  if (json.error) throw new Error(json.error);
  return json.data;
}

// ── Payload helpers ───────────────────────────────────────────────────────

function toApiRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { synced_at, ...rest } = record;
  return { ...rest, last_synced_at: (synced_at as string | null) ?? null };
}

// ── Persist push results ──────────────────────────────────────────────────

interface EntityBatch {
  table: string;
  typeKey: string;
  ids: number[];
}

async function persistPushResults(
  result: SyncResult,
  batches: EntityBatch[],
  biographyWasPushed: boolean
): Promise<void> {
  const conflictSet = new Set(result.conflicts);

  for (const { table, typeKey, ids } of batches) {
    for (const id of ids) {
      const baseKey = `${typeKey}:${id}`;
      if ([...conflictSet].some((c) => c.startsWith(baseKey))) continue;

      const remoteId = result.remote_id_map[baseKey];
      if (remoteId) {
        await execute(
          `UPDATE ${table} SET remote_id = ?, synced_at = datetime('now') WHERE id = ?`,
          [remoteId, id]
        );
      } else {
        await execute(
          `UPDATE ${table} SET synced_at = datetime('now') WHERE id = ?`,
          [id]
        );
      }
    }
  }

  if (biographyWasPushed) {
    await execute(`UPDATE biography SET synced_at = datetime('now') WHERE id = 1`, []);
  }
}

// ── Pull-merge ────────────────────────────────────────────────────────────

async function mergePullResult(data: SyncPayload): Promise<number> {
  let pulled = 0;

  if (data.biography) {
    const bio = data.biography as { title?: string; tagline?: string | null; bio?: string | null };
    await execute(
      `UPDATE biography
          SET title     = COALESCE(?, title),
              tagline   = ?,
              bio       = ?,
              synced_at = datetime('now')
        WHERE id = 1`,
      [bio.title ?? null, bio.tagline ?? null, bio.bio ?? null]
    );
    pulled++;
  }

  for (const raw of (data.stories ?? []) as Array<Record<string, unknown>>) {
    const s = raw as {
      remote_id: string; title: string; slug?: string | null;
      content?: string | null; excerpt?: string | null; status: string;
      event_date?: string | null; event_date_precision?: string | null;
    };
    const upd = await execute(
      `UPDATE stories
          SET title = ?, slug = ?, content = ?, excerpt = ?, status = ?,
              event_date = ?, event_date_precision = ?, synced_at = datetime('now')
        WHERE remote_id = ?`,
      [s.title, s.slug ?? null, s.content ?? null, s.excerpt ?? null,
       s.status, s.event_date ?? null, s.event_date_precision ?? null, s.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO stories
           (title, slug, content, excerpt, status,
            event_date, event_date_precision, remote_id, synced_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
        [s.title, s.slug ?? null, s.content ?? null, s.excerpt ?? null,
         s.status, s.event_date ?? null, s.event_date_precision ?? null, s.remote_id]
      );
    }
    pulled++;
  }

  for (const raw of (data.milestones ?? []) as Array<Record<string, unknown>>) {
    const m = raw as {
      remote_id: string; title: string; description?: string | null;
      date: string; date_precision?: string | null;
    };
    const upd = await execute(
      `UPDATE milestones
          SET title = ?, description = ?, date = ?, date_precision = ?,
              synced_at = datetime('now')
        WHERE remote_id = ?`,
      [m.title, m.description ?? null, m.date, m.date_precision ?? null, m.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO milestones
           (title, description, date, date_precision, remote_id, synced_at)
         VALUES (?,?,?,?,?,datetime('now'))`,
        [m.title, m.description ?? null, m.date, m.date_precision ?? null, m.remote_id]
      );
    }
    pulled++;
  }

  for (const raw of (data.career ?? []) as Array<Record<string, unknown>>) {
    const c = raw as {
      remote_id: string; organization: string; title?: string | null;
      description?: string | null; start_date?: string | null;
      end_date?: string | null; is_current?: boolean | number; location?: string | null;
    };
    const isCurrent = c.is_current === true || c.is_current === 1 ? 1 : 0;
    const upd = await execute(
      `UPDATE career_entries
          SET organization = ?, title = ?, description = ?, start_date = ?,
              end_date = ?, is_current = ?, location = ?, synced_at = datetime('now')
        WHERE remote_id = ?`,
      [c.organization, c.title ?? null, c.description ?? null,
       c.start_date ?? null, c.end_date ?? null, isCurrent,
       c.location ?? null, c.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO career_entries
           (organization, title, description, start_date, end_date,
            is_current, location, remote_id, synced_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'))`,
        [c.organization, c.title ?? null, c.description ?? null,
         c.start_date ?? null, c.end_date ?? null, isCurrent,
         c.location ?? null, c.remote_id]
      );
    }
    pulled++;
  }

  for (const raw of (data.map_pins ?? []) as Array<Record<string, unknown>>) {
    const p = raw as {
      remote_id: string; name: string; description?: string | null;
      latitude: number; longitude: number;
    };
    const upd = await execute(
      `UPDATE map_pins
          SET name = ?, description = ?, latitude = ?, longitude = ?,
              synced_at = datetime('now')
        WHERE remote_id = ?`,
      [p.name, p.description ?? null, p.latitude, p.longitude, p.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO map_pins
           (name, description, latitude, longitude, remote_id, synced_at)
         VALUES (?,?,?,?,?,datetime('now'))`,
        [p.name, p.description ?? null, p.latitude, p.longitude, p.remote_id]
      );
    }
    pulled++;
  }

  for (const raw of (data.family_members ?? []) as Array<Record<string, unknown>>) {
    const fm = raw as {
      remote_id: string; given_name: string; surname?: string | null;
      birth_date?: string | null; death_date?: string | null; bio?: string | null;
    };
    const upd = await execute(
      `UPDATE family_members
          SET given_name = ?, surname = ?, birth_date = ?, death_date = ?,
              bio = ?, synced_at = datetime('now')
        WHERE remote_id = ?`,
      [fm.given_name, fm.surname ?? null, fm.birth_date ?? null,
       fm.death_date ?? null, fm.bio ?? null, fm.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO family_members
           (given_name, surname, birth_date, death_date, bio, remote_id, synced_at)
         VALUES (?,?,?,?,?,?,datetime('now'))`,
        [fm.given_name, fm.surname ?? null, fm.birth_date ?? null,
         fm.death_date ?? null, fm.bio ?? null, fm.remote_id]
      );
    }
    pulled++;
  }

  for (const raw of (data.albums ?? []) as Array<Record<string, unknown>>) {
    const a = raw as { remote_id: string; name: string; description?: string | null };
    const upd = await execute(
      `UPDATE albums SET name = ?, description = ?, synced_at = datetime('now')
        WHERE remote_id = ?`,
      [a.name, a.description ?? null, a.remote_id]
    );
    if (upd.rowsAffected === 0) {
      await execute(
        `INSERT INTO albums (name, description, remote_id, synced_at)
         VALUES (?,?,?,datetime('now'))`,
        [a.name, a.description ?? null, a.remote_id]
      );
    }
    pulled++;
  }

  return pulled;
}

// ── Sync orchestration ────────────────────────────────────────────────────

export async function syncToRemote(onProgress?: (msg: string) => void): Promise<FullSyncResult> {
  onProgress?.("Loading local data…");

  const [biography, stories, milestones, career, mapPins, familyMembers, albums] =
    await Promise.all([
      query<Biography>("SELECT * FROM biography LIMIT 1"),
      query<Story>("SELECT * FROM stories"),
      query<Milestone>("SELECT * FROM milestones"),
      query<CareerEntry>("SELECT * FROM career_entries"),
      query<MapPin>("SELECT * FROM map_pins"),
      query<FamilyMember>("SELECT * FROM family_members"),
      query<Album>("SELECT * FROM albums"),
    ]);

  const bio = biography[0];

  const payload: SyncPayload = {
    biography: bio ? toApiRecord(bio as Record<string, unknown>) : undefined,
    stories: stories.map((s) => toApiRecord(s as Record<string, unknown>)),
    milestones: milestones.map((m) => toApiRecord(m as Record<string, unknown>)),
    career: career.map((c) => toApiRecord(c as Record<string, unknown>)),
    map_pins: mapPins.map((p) => toApiRecord(p as Record<string, unknown>)),
    family_members: familyMembers.map((f) => toApiRecord(f as Record<string, unknown>)),
    albums: albums.map((a) => toApiRecord(a as Record<string, unknown>)),
  };

  onProgress?.("Pushing to LifeScribe.us…");
  const pushResult = await pushToRemote(payload);

  onProgress?.("Saving sync state…");
  const batches: EntityBatch[] = [
    { table: "stories",        typeKey: "stories",        ids: stories.map((s) => s.id) },
    { table: "milestones",     typeKey: "milestones",     ids: milestones.map((m) => m.id) },
    { table: "career_entries", typeKey: "career",         ids: career.map((c) => c.id) },
    { table: "map_pins",       typeKey: "map_pins",       ids: mapPins.map((p) => p.id) },
    { table: "family_members", typeKey: "family_members", ids: familyMembers.map((f) => f.id) },
    { table: "albums",         typeKey: "albums",         ids: albums.map((a) => a.id) },
  ];
  await persistPushResults(pushResult, batches, !!bio);

  onProgress?.("Pulling web changes…");
  const syncStartedAt = new Date().toISOString();
  const since = localStorage.getItem(STORAGE_KEY_LAST_PULL) ?? undefined;
  let pulled = 0;
  try {
    const pullData = await pullFromRemote(since);
    pulled = await mergePullResult(pullData);
    localStorage.setItem(STORAGE_KEY_LAST_PULL, syncStartedAt);
  } catch (err) {
    console.error("[sync] pull failed:", err);
  }

  return { pushed: pushResult.pushed, pulled, conflicts: pushResult.conflicts, errors: [] };
}
```
