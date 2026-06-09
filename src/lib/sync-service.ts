// LifeScribe.us sync service
// Provides optional two-way sync between the local SQLite database and the
// remote lifescribe.us REST API. Auth uses a long-lived personal access token
// stored in localStorage (no OAuth redirect needed for a desktop app).

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

// ── Push local data ───────────────────────────────────────────────────────

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

export async function pushToRemote(payload: SyncPayload): Promise<SyncResult> {
  return apiRequest<SyncResult>("POST", "/sync/push", payload);
}

export async function pullFromRemote(since?: string): Promise<SyncPayload> {
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  return apiRequest<SyncPayload>("GET", `/sync/pull${qs}`);
}

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

// Renames synced_at → last_synced_at for the push API contract.
function toApiRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { synced_at, ...rest } = record;
  return { ...rest, last_synced_at: (synced_at as string | null) ?? null };
}

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

// ── Sync orchestration (local DB → remote) ────────────────────────────────

export interface FullSyncResult {
  pushed: number;
  pulled: number;
  conflicts: string[];
  errors: string[];
}

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
    biography: bio ? toApiRecord(bio as unknown as Record<string, unknown>) : undefined,
    stories: stories.map((s) => toApiRecord(s as unknown as Record<string, unknown>)),
    milestones: milestones.map((m) => toApiRecord(m as unknown as Record<string, unknown>)),
    career: career.map((c) => toApiRecord(c as unknown as Record<string, unknown>)),
    map_pins: mapPins.map((p) => toApiRecord(p as unknown as Record<string, unknown>)),
    family_members: familyMembers.map((f) => toApiRecord(f as unknown as Record<string, unknown>)),
    albums: albums.map((a) => toApiRecord(a as unknown as Record<string, unknown>)),
  };

  const syncStartedAt = new Date().toISOString();
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
