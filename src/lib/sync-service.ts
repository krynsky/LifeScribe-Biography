// LifeScribe.us sync service
// Provides optional two-way sync between the local SQLite database and the
// remote lifescribe.us REST API. Auth uses a long-lived personal access token
// stored in localStorage (no OAuth redirect needed for a desktop app).

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

// Renames synced_at → last_synced_at for the push API contract.
function toApiRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { synced_at, ...rest } = record;
  return { ...rest, last_synced_at: (synced_at as string | null) ?? null };
}

// ── Sync orchestration (local DB → remote) ────────────────────────────────

import { readFile } from "@tauri-apps/plugin-fs";
import { query, execute } from "./db";
import type { Album, Biography, CareerEntry, FamilyMember, MapPin, Milestone, Story } from "./models";

export interface FullSyncResult {
  pushed: number;
  pulled: number;
  conflicts: string[];
  errors: string[];
}

export async function syncToRemote(onProgress?: (msg: string) => void): Promise<FullSyncResult> {
  onProgress?.("Loading local data…");

  const [biography, stories, milestones, career, map_pins, family_members, albums] = await Promise.all([
    query<object>("SELECT * FROM biography LIMIT 1"),
    query<object>("SELECT * FROM stories WHERE status = 'published'"),
    query<object>("SELECT * FROM milestones"),
    query<object>("SELECT * FROM career_entries"),
    query<object>("SELECT * FROM map_pins"),
    query<object>("SELECT * FROM family_members"),
    query<object>("SELECT * FROM albums"),
  ]);

  const payload: SyncPayload = {
    biography: biography[0] as object,
    stories: stories as object[],
    milestones: milestones as object[],
    career: career as object[],
    map_pins: map_pins as object[],
    family_members: family_members as object[],
    albums: albums as object[],
  };

  onProgress?.("Pushing to LifeScribe.us…");

  try {
    const result = await pushToRemote(payload);
    onProgress?.(`Sync complete — ${result.pushed} items updated`);
    return { pushed: result.pushed, pulled: 0, conflicts: result.conflicts, errors: [] };
  } catch (err) {
    throw err;
  }
}
