import type { SyncMode } from "./types";

const KEY_TOKEN = "lifescribe_sync_token";
const KEY_URL = "lifescribe_sync_url";
const KEY_MODE = "lifescribe_sync_mode";
const DEFAULT_API_URL = "https://lifescribe.us/api/v1";

export function getSyncToken(): string {
  return localStorage.getItem(KEY_TOKEN) ?? "";
}

export function getSyncUrl(): string {
  return localStorage.getItem(KEY_URL) ?? DEFAULT_API_URL;
}

export function getSyncMode(): SyncMode {
  return (localStorage.getItem(KEY_MODE) as SyncMode | null) ?? "web-master";
}

export function setSyncMode(mode: SyncMode): void {
  localStorage.setItem(KEY_MODE, mode);
}

export function saveSyncCredentials(token: string, url?: string): void {
  localStorage.setItem(KEY_TOKEN, token.trim());
  localStorage.setItem(KEY_URL, (url ?? DEFAULT_API_URL).trim());
}

export function clearSyncCredentials(): void {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_URL);
  localStorage.removeItem(KEY_MODE);
}

export function isSyncConfigured(): boolean {
  return !!getSyncToken() && getSyncMode() !== "standalone";
}
