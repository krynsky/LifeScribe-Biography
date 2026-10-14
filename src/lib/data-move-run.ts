import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import Database from "@tauri-apps/plugin-sql";
import { execute } from "./db";
import { createBackup } from "./backup";
import { sqlStringLiteral } from "./backup-names";
import { getDataLocation } from "./data-location";
import { DATA_FOLDERS, PATH_COLUMNS, isSameOrInside, rewriteAssetUrls, rewritePath } from "./data-move";

export type MoveResult = { kind: "moved"; filesCopied: number; newRoot: string } | { kind: "switched"; newRoot: string };

/** What to tell the user before a folder is accepted, or null when it's fine. */
export async function checkTargetFolder(target: string): Promise<{ error?: string; hasData: boolean }> {
  const loc = await getDataLocation();
  if (isSameOrInside(target, loc.filesRoot)) {
    return { error: "That is the folder the app already uses, or a folder inside it. Pick a different one.", hasData: false };
  }
  if (isSameOrInside(loc.filesRoot, target)) {
    return { error: "That folder contains the app's current data folder. Pick a folder outside it.", hasData: false };
  }
  const hasData = await invoke<boolean>("dir_has_database", { path: target });
  return { hasData };
}

/**
 * Copy everything to `target` and remember it as the data folder. The current data is left exactly as it is
 * (a safety copy); the change takes effect after the app restarts.
 *
 * When the folder already holds a LifeScribe database, nothing is copied and the app simply starts using it.
 */
export async function moveDataTo(target: string, useExisting: boolean, onProgress: (message: string) => void): Promise<MoveResult> {
  const loc = await getDataLocation();

  if (useExisting) {
    onProgress("Switching to the data in that folder…");
    await invoke("set_data_location", { path: target });
    return { kind: "switched", newRoot: target };
  }

  onProgress("Saving a backup first…");
  await createBackup("before-move");

  onProgress("Copying your database…");
  const newDbPath = await join(target, "lifescribe.db");
  await execute(`VACUUM INTO ${sqlStringLiteral(newDbPath)}`);

  onProgress("Copying your images, photos and backups…");
  const filesCopied = await invoke<number>("copy_data_folders", { srcRoot: loc.filesRoot, dstRoot: target, folders: [...DATA_FOLDERS] });

  onProgress("Updating saved file locations…");
  await rewriteCopiedDatabase(newDbPath, loc.filesRoot, target);

  onProgress("Finishing up…");
  await invoke("set_data_location", { path: target });
  return { kind: "moved", filesCopied, newRoot: target };
}

/** In the NEW database only, point every saved file path (and image links inside stories) at the new folder. */
async function rewriteCopiedDatabase(dbPath: string, oldRoot: string, newRoot: string): Promise<void> {
  const db = await Database.load(`sqlite:${dbPath}`);
  try {
    for (const [table, column] of PATH_COLUMNS) {
      const rows = await db.select<Array<{ id: number; value: string }>>(`SELECT id, ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} <> ''`);
      for (const row of rows) {
        const next = rewritePath(row.value, oldRoot, newRoot);
        if (next !== row.value) await db.execute(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [next, row.id]);
      }
    }
    const stories = await db.select<Array<{ id: number; content: string }>>("SELECT id, content FROM stories WHERE content IS NOT NULL AND content <> ''");
    for (const story of stories) {
      const next = rewriteAssetUrls(story.content, oldRoot, newRoot);
      if (next !== story.content) await db.execute("UPDATE stories SET content = ? WHERE id = ?", [next, story.id]);
    }
    // Fold the write-ahead log into the file so the copy is a single, complete database.
    await db.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  } finally {
    await db.close();
  }
}
