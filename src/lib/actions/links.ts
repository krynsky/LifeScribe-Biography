import { query } from "../db";

/** Map web ids (sync remote_id) to local row ids for one entity type, so synced "linked" refs can navigate. */
export async function localIdsByRemote(entityType: "story" | "album"): Promise<Map<string, number>> {
  const rows = await query<{ remote_id: string; local_id: number }>(
    "SELECT remote_id, local_id FROM sync_state WHERE entity_type = ? AND remote_id IS NOT NULL",
    [entityType]
  );
  return new Map(rows.map((r) => [r.remote_id, r.local_id]));
}
