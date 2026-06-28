import type { Decision, SyncMode, SyncState } from "./types";

export interface DecideInput {
  mode: SyncMode;
  /** Local entity updated_at, or null if there is no local row. */
  localUpdatedAt: string | null;
  /** Sync bookkeeping for the local row, or null if none. */
  state: SyncState | null;
  /** Web record updated_at, or null if the record is absent from the web response. */
  remoteUpdatedAt: string | null;
}

// ISO-8601 strings sort chronologically.
const newer = (a: string, b: string) => a > b;

export function decide(input: DecideInput): Decision {
  const { mode, localUpdatedAt, state, remoteUpdatedAt } = input;

  if (mode === "standalone") return { action: "noop" };

  const dirty =
    localUpdatedAt != null &&
    state?.last_synced_at != null &&
    newer(localUpdatedAt, state.last_synced_at);

  const webChanged =
    remoteUpdatedAt != null &&
    (state?.last_synced_remote_at == null ||
      newer(remoteUpdatedAt, state.last_synced_remote_at));

  // ── Web record absent → potential deletion ────────────────────────────────
  if (remoteUpdatedAt == null) {
    // Only records previously linked to the web can be "deleted on master".
    if (state?.remote_id == null) return { action: "noop" };
    if (mode === "web-master") return { action: "delete_local" };
    return { action: "noop" }; // app-master: web deletions never touch local
  }

  // ── Web record present, no local counterpart → new web item ───────────────
  if (state == null || localUpdatedAt == null) {
    return { action: "create_local" };
  }

  // ── app-master: app owns existing records; never overwrite from web ───────
  if (mode === "app-master") return { action: "noop" };

  // ── web-master reconciliation ─────────────────────────────────────────────
  if (dirty && webChanged) return { action: "conflict" };
  if (dirty && !webChanged) return { action: "keep_local_unpublished" };
  if (!dirty && webChanged) return { action: "take_web" };
  return { action: "noop" };
}
