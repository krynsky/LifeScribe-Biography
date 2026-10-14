import { join } from "@tauri-apps/api/path";
import { dataSubDir } from "./data-location";
import { mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { execute } from "./db";
import { backupFileName, backupsToDelete, sqlStringLiteral } from "./backup-names";

/** Folder holding database backups. */
export async function backupsDir(): Promise<string> {
  const dir = await dataSubDir("backups");
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Write a consistent snapshot of the whole database (SQLite `VACUUM INTO`, which is safe while the
 * app is running) and delete all but the newest few backups. Returns the new file's path.
 * Throws if the snapshot can't be made, so callers can refuse to continue with a risky action.
 */
export async function createBackup(reason: string): Promise<string> {
  const dir = await backupsDir();
  const path = await join(dir, backupFileName(new Date(), reason));
  await execute(`VACUUM INTO ${sqlStringLiteral(path)}`);
  try {
    const entries = await readDir(dir);
    for (const name of backupsToDelete(entries.map((e) => e.name))) {
      await remove(await join(dir, name)).catch(() => {});
    }
  } catch {
    /* pruning is best-effort; the new backup exists */
  }
  return path;
}
