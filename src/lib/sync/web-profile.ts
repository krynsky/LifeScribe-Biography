import { fetch } from "@tauri-apps/plugin-http";
import { getSyncToken, getSyncUrl } from "./config";

export interface RemoteProfile {
  id: string;
  email: string;
  display_name: string;
  site: { id: string; slug: string; title: string };
}

export async function testConnection(): Promise<RemoteProfile> {
  const baseUrl = getSyncUrl().replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${getSyncToken()}` },
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const json = (await resp.json()) as { data: RemoteProfile; error?: string };
  if (json.error) throw new Error(json.error);
  return json.data;
}
