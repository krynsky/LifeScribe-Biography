/**
 * Pure helpers for moving the app's data to another folder: rewriting the file paths saved in the database
 * and recognising folders that are risky to keep a live database in. The Tauri side is in data-move-run.ts.
 */

/** Every database column that can hold a path to a file stored in the data folder. */
export const PATH_COLUMNS: ReadonlyArray<readonly [table: string, column: string]> = [
  ["media", "file_path"],
  ["media", "thumbnail_path"],
  ["stories", "featured_image_path"],
  ["milestones", "image_path"],
  ["map_pins", "image_path"],
  ["career_entries", "logo_path"],
  ["family_members", "photo_path"],
  ["biography", "cover_photo_path"],
];

/** Sub-folders copied to the new location. */
export const DATA_FOLDERS = ["images", "media", "backups", "thumbs"] as const;

const BACKSLASH = String.fromCharCode(92);
const toSlashes = (p: string) => p.split(BACKSLASH).join("/").replace(/\/+$/, "");
const lower = (p: string) => toSlashes(p).toLowerCase();

/** True when `path` is `folder` itself or somewhere inside it (any slash style, any case). */
export function isSameOrInside(path: string, folder: string): boolean {
  const p = lower(path);
  const f = lower(folder);
  return p === f || p.startsWith(f + "/");
}

/** Point a path that lives under `oldRoot` at the same place under `newRoot`; anything else is returned unchanged. */
export function rewritePath(path: string, oldRoot: string, newRoot: string): string {
  if (!path || !isSameOrInside(path, oldRoot) || lower(path) === lower(oldRoot)) return path;
  const rest = toSlashes(path).slice(toSlashes(oldRoot).length); // starts with "/"
  const root = newRoot.replace(/[\\/]+$/, "");
  return root + (newRoot.includes(BACKSLASH) ? rest.split("/").join(BACKSLASH) : rest);
}

/** Re-spell a folder path with one kind of slash and no trailing slash. */
function withSeparator(root: string, sep: string): string {
  return toSlashes(root).split("/").join(sep);
}

/**
 * Story text refers to images as asset URLs that contain the URI-encoded file path
 * (http://asset.localhost/C%3A%5CUsers%5C…). Swap the old folder for the new one inside any such URL.
 */
export function rewriteAssetUrls(text: string, oldRoot: string, newRoot: string): string {
  let out = text;
  for (const sep of [BACKSLASH, "/"]) {
    const from = encodeURIComponent(withSeparator(oldRoot, sep));
    const to = encodeURIComponent(withSeparator(newRoot, sep));
    out = out.split(from).join(to);
    // Same text in a different letter case (%5c vs %5C).
    out = out.replace(new RegExp(escapeRegExp(from), "gi"), to);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Folders that cloud-sync clients watch. Syncing a database file while the app has it open can corrupt it. */
export function looksCloudSynced(path: string): boolean {
  return /(^|[\\/])(onedrive|dropbox|google ?drive|icloud ?drive|iclouddrive|box sync|nextcloud|pcloud|mega ?sync)\b/i.test(path);
}
