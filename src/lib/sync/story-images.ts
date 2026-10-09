/**
 * Photos in a story body are stored as Tauri asset URLs that only work inside the app. Before a
 * story is published, each one is uploaded and replaced by the website address of the uploaded file.
 */

/** Recover the file path from an asset URL (`http://asset.localhost/<encoded path>` or `asset://localhost/<encoded path>`). */
export function assetUrlToPath(src: string): string | null {
  const m = src.match(/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\/(.+?)(?:[?#].*)?$/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export interface RewriteResult {
  /** The story body JSON with local photos replaced (unchanged when nothing needed it). */
  content: string;
  /** How many local photos were found. */
  found: number;
  /** Local photos that could not be uploaded, left as they were. */
  failed: { path: string; error: string }[];
}

/**
 * Walk a Tiptap JSON document and replace every local image `src` with the URL returned by
 * `upload(path)`. Photos that fail to upload are left in place and reported. Each distinct file is
 * uploaded once even if it appears several times.
 */
export async function rewriteLocalImages(content: string, upload: (path: string) => Promise<string>): Promise<RewriteResult> {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return { content, found: 0, failed: [] };
  }

  const urlForPath = new Map<string, string | Error>();
  const failed: RewriteResult["failed"] = [];
  let found = 0;

  async function visit(node: unknown): Promise<void> {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { src?: unknown }; content?: unknown[] };
    if (n.type === "image" && typeof n.attrs?.src === "string") {
      const path = assetUrlToPath(n.attrs.src);
      if (path) {
        found++;
        if (!urlForPath.has(path)) {
          try {
            urlForPath.set(path, await upload(path));
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            urlForPath.set(path, err);
            failed.push({ path, error: err.message });
          }
        }
        const result = urlForPath.get(path)!;
        if (typeof result === "string") n.attrs.src = result;
      }
    }
    if (Array.isArray(n.content)) for (const child of n.content) await visit(child);
  }

  await visit(doc);
  return { content: found > 0 ? JSON.stringify(doc) : content, found, failed };
}
