/** Pure helpers for naming and pruning local database backups. */

export const BACKUP_PREFIX = "lifescribe-";
export const BACKUP_SUFFIX = ".db";
export const BACKUPS_TO_KEEP = 10;

/** `lifescribe-2026-10-08T14-03-22-before-publish.db` — sortable, filesystem-safe, says why it was made. */
export function backupFileName(now: Date, reason: string): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  const slug = reason.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "backup";
  return `${BACKUP_PREFIX}${stamp}-${slug}${BACKUP_SUFFIX}`;
}

/** True for files this app created (so pruning never touches anything else in the folder). */
export function isBackupFile(name: string): boolean {
  return /^lifescribe-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-.+\.db$/.test(name);
}

/** The oldest backups beyond `keep`, by name (names sort chronologically). */
export function backupsToDelete(names: string[], keep: number = BACKUPS_TO_KEEP): string[] {
  const ours = names.filter(isBackupFile).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}

/** Quote a path as a SQL string literal for `VACUUM INTO`. */
export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
