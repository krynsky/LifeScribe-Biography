/**
 * Pure helpers for the app's image library — the folder where every image a user adds
 * (covers, logos, photos, banner…) is copied so the biography doesn't depend on the
 * original files staying put. The Tauri file operations live in images.ts.
 */

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "heic"] as const;

/** Lower-cased extension of a path, restricted to known image types (default "jpg"). */
export function imageExtension(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? "";
  const ext = (name.includes(".") ? name.split(".").pop() : "")!.toLowerCase();
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? ext : "jpg";
}

/** Content hash used as the stored filename, so importing the same image twice stores it once. */
export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function libraryFileName(bytes: Uint8Array, sourcePath: string): Promise<string> {
  return `${await hashBytes(bytes)}.${imageExtension(sourcePath)}`;
}

/** True when `path` already lives in the library folder (either slash style, any case). */
export function isInsideLibrary(path: string, libraryDir: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(path).startsWith(norm(libraryDir) + "/");
}

/** MIME type for an image path, from its extension (defaults to jpeg). */
export function imageMimeType(path: string): string {
  const ext = imageExtension(path);
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
}

/** True when the path has a supported image extension. */
export function isSupportedImage(path: string): boolean {
  const name = path.split(/[\\/]/).pop() ?? "";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}
