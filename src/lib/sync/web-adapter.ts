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
    if (def.binary) fields.url = r.url ?? null;
    return {
      remote_id: r.remote_id as string,
      remote_updated_at: (r.updated_at as string) ?? (r.remote_updated_at as string) ?? "",
      fields,
    };
  });
}

export class RestWebAdapter implements WebAdapter {
  async pullAll(): Promise<Record<EntityType, RemoteRecord[]>> {
    const data = await api<Record<string, Array<Record<string, unknown>>>>("GET", "/sync/pull");
    const out = {} as Record<EntityType, RemoteRecord[]>;
    for (const def of ENTITIES) {
      const rows = (data[def.remoteKey] as Array<Record<string, unknown>>) ?? [];
      out[def.type] = toRemoteRecords(def, rows);
    }
    return out;
  }

  async push(
    type: EntityType,
    records: Array<{ local_id: number; remote_id: string | null; fields: Record<string, unknown> }>
  ): Promise<{ remoteIdMap: Record<number, string>; remoteUpdatedAt: Record<number, string> }> {
    const def = entityDef(type);
    const payloadItems = records.map((r) => ({ ...r.fields, remote_id: r.remote_id, _local_id: r.local_id }));
    const payload: Record<string, unknown> = { [def.remoteKey]: payloadItems };

    const result = await api<{ remote_id_map: Record<string, string>; conflicts: string[] }>(
      "POST",
      "/sync/push",
      payload
    );

    const remoteIdMap: Record<number, string> = {};
    const remoteUpdatedAt: Record<number, string> = {};
    for (const r of records) {
      const key = `${def.remoteKey}:${r.local_id}`;
      const remoteId = result.remote_id_map[key] ?? r.remote_id;
      if (remoteId) remoteIdMap[r.local_id] = remoteId;
    }
    return { remoteIdMap, remoteUpdatedAt };
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
