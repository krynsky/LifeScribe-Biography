import { SqlDataStore } from "./data-store";
import { RestWebAdapter } from "./web-adapter";
import { SyncService } from "./sync-service";
import { getSyncMode } from "./config";

export { SyncService } from "./sync-service";
export * from "./config";
export type { SyncMode, SyncState } from "./types";
export type { RefreshSummary, ConflictItem } from "./sync-service";

/** Build a SyncService wired to the real SQLite store and REST adapter. */
export function makeSyncService(): SyncService {
  return new SyncService(new SqlDataStore(), new RestWebAdapter(), getSyncMode());
}
