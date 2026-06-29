import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { ENTITIES, entityDef, type EntityType } from "./registry";
import { getSyncToken, getSyncUrl } from "./config";
import type { RemoteRecord, WebAdapter } from "./types";

interface ApiResponse<T> {
  data: T;
  error?: string;
}

async function api<T>(method: string, path: string, body?: unknown, _retries = 1): Promise<T> {
  const token = getSyncToken();
  const baseUrl = getSyncUrl().replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    if (resp.status >= 500 && _retries > 0) {
      await new Promise((r) => setTimeout(r, 3000));
      return api<T>(method, path, body, _retries - 1);
    }
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text.substring(0, 200)}`);
  }
  const json = (await resp.json()) as ApiResponse<T>;
  if (json.error) throw new Error(json.error);
  return json.data;
}

function toRemoteRecords(def: ReturnType<typeof entityDef>, rows: Array<Record<string, unknown>>): RemoteRecord[] {
  return rows.map((r) => {
    const fields: Record<string, unknown> = {};
    for (const c of def.columns) fields[c] = r[c] ?? null;
    if (def.binary) {
      // Media needs its download URL plus the web-side names the desktop must
      // resolve (album CUID → local album id, size_bytes → file_size).
      fields.url = r.url ?? null;
      fields.album_remote_id = r.album_remote_id ?? null;
      fields.size_bytes = r.size_bytes ?? null;
      fields.media_type = r.media_type ?? null;
    }
    return {
      remote_id: r.remote_id as string,
      remote_updated_at: (r.updated_at as string) ?? (r.remote_updated_at as string) ?? "",
      fields,
    };
  });
}

export class RestWebAdapter implements WebAdapter {
  async pullAll(): Promise<Record<EntityType, RemoteRecord[]>> {
    // limit=500 is the server's max; without it the route defaults to 50,
    // truncating large media sets. (Pagination is a future need beyond 500.)
    const data = await api<Record<string, Array<Record<string, unknown>>>>("GET", "/sync/pull?limit=500");
    const out = {} as Record<EntityType, RemoteRecord[]>;
    for (const def of ENTITIES) {
      const raw = data[def.remoteKey];
      // Singletons (biography) come back as a single object, not an array.
      const rows: Array<Record<string, unknown>> = def.singleton
        ? raw
          ? [raw as unknown as Record<string, unknown>]
          : []
        : ((raw as Array<Record<string, unknown>>) ?? []);
      out[def.type] = toRemoteRecords(def, rows);
    }
    return out;
  }

  async push(
    type: EntityType,
    records: Array<{ local_id: number; remote_id: string | null; last_synced_remote_at: string | null; fields: Record<string, unknown> }>
  ): Promise<{ remoteIdMap: Record<number, string>; remoteUpdatedAt: Record<number, string>; conflicts: string[] }> {
    const def = entityDef(type);
    const items = records.map((r) => ({
      ...r.fields,
      id: r.local_id,
      remote_id: r.remote_id,
      last_synced_at: r.last_synced_remote_at,
    }));
    const payload: Record<string, unknown> = {
      [def.remoteKey]: def.singleton ? items[0] : items,
    };

    const result = await api<{
      remote_id_map: Record<string, string>;
      conflicts: string[];
      remote_updated_at_map?: Record<string, string>;
    }>("POST", "/sync/push", payload);
    const conflicts = result.conflicts ?? [];
    const updatedAtMap = result.remote_updated_at_map ?? {};

    const remoteIdMap: Record<number, string> = {};
    const remoteUpdatedAt: Record<number, string> = {};
    if (def.singleton) {
      // Biography isn't in remote_id_map; treat as success unless a conflict mentions it.
      const failed = conflicts.some((c) => c.startsWith(def.remoteKey));
      const r0 = records[0];
      if (!failed && r0) {
        remoteIdMap[r0.local_id] = r0.remote_id ?? "site";
        const ru = updatedAtMap[`${def.remoteKey}:1`];
        if (ru) remoteUpdatedAt[r0.local_id] = ru;
      }
    } else {
      for (const r of records) {
        const key = `${def.remoteKey}:${r.local_id}`;
        const remoteId = result.remote_id_map[key];
        if (remoteId) {
          remoteIdMap[r.local_id] = remoteId;
          const ru = updatedAtMap[key];
          if (ru) remoteUpdatedAt[r.local_id] = ru;
        }
      }
    }
    return { remoteIdMap, remoteUpdatedAt, conflicts };
  }

  async deleteRemote(type: EntityType, remoteId: string): Promise<void> {
    const def = entityDef(type);
    await api("DELETE", `/sync/${def.remoteKey}/${remoteId}`);
  }

  async downloadMedia(remote: RemoteRecord): Promise<string> {
    const url = remote.fields.url as string;
    const filename = (remote.fields.filename as string) ?? "file";
    const ext = (filename.split(".").pop() ?? "jpg").toLowerCase();
    const dataDir = await appLocalDataDir();
    const mediaDir = await join(dataDir, "media");
    await mkdir(mediaDir, { recursive: true });
    const localPath = await join(mediaDir, `${remote.remote_id}.${ext}`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`media download ${resp.status}: ${url}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    await writeFile(localPath, bytes);
    return localPath;
  }
}
