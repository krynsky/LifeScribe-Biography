import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { IMAGE_EXTENSIONS, imageMimeType, isSupportedImage } from "../image-library";
import { copyIntoLibrary } from "../images";
import { planMediaUrl } from "../media-url";
import { insertMedia } from "./gallery";
import type { Media } from "../models";

const THUMB_SIZE = 480;

export interface AddFilesResult {
  added: Media[];
  failed: { path: string; error: string }[];
}

/** Let the user pick one or more image files (null if cancelled). */
export async function pickImageFiles(): Promise<string[] | null> {
  const picked = await open({ multiple: true, filters: [{ name: "Images", extensions: [...IMAGE_EXTENSIONS] }] });
  if (!picked) return null;
  return Array.isArray(picked) ? picked : [picked];
}

/**
 * Copy images into the app's library, make thumbnails, and add them to an album. One bad file never
 * stops the rest; failures are reported per file.
 */
export async function addImageFiles(
  paths: string[],
  albumId: number | null,
  onProgress?: (done: number, total: number) => void
): Promise<AddFilesResult> {
  const result: AddFilesResult = { added: [], failed: [] };
  let done = 0;
  for (const path of paths) {
    try {
      if (!isSupportedImage(path)) throw new Error("Not a supported image type.");
      const stored = await copyIntoLibrary(path);
      const thumb = await invoke<{ thumb_path: string; width: number; height: number }>("generate_thumbnail", {
        sourcePath: stored,
        maxSize: THUMB_SIZE,
      });
      const size = await stat(stored).then((s) => s.size).catch(() => undefined);
      const filename = path.split(/[\\/]/).pop() ?? "image";
      result.added.push(
        await insertMedia({
          file_path: stored,
          thumbnail_path: thumb.thumb_path,
          filename,
          width: thumb.width,
          height: thumb.height,
          file_size: size,
          mime_type: imageMimeType(filename),
          album_id: albumId ?? undefined,
          import_source: "upload",
        })
      );
    } catch (e) {
      result.failed.push({ path, error: String(e instanceof Error ? e.message : e) });
    }
    onProgress?.(++done, paths.length);
  }
  return result;
}

/** Fetch a Vimeo video's thumbnail via its public oEmbed (no key). Null when offline or unavailable. */
async function vimeoThumbnail(oembedUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(oembedUrl)}`);
    if (!resp.ok) return null;
    const json = (await resp.json()) as { thumbnail_url?: unknown };
    return typeof json.thumbnail_url === "string" ? json.thumbnail_url : null;
  } catch {
    return null;
  }
}

/**
 * Add an image or video by link, like the web's "Add by URL": YouTube and Vimeo are detected
 * automatically. Links are stored as-is (nothing is downloaded), so they need internet to display.
 * Throws an Error with a readable message for bad input.
 */
export async function addMediaByUrl(input: { url: string; caption?: string; albumId: number | null; typeHint?: "image" | "video" }): Promise<Media> {
  const plan = planMediaUrl(input.url, input.typeHint);
  if (plan.kind === "invalid") throw new Error(plan.reason);
  const base = { filename: plan.filename, caption: input.caption?.trim() || undefined, album_id: input.albumId ?? undefined, import_source: "url" };

  switch (plan.kind) {
    case "youtube":
      return insertMedia({ ...base, file_path: plan.thumbnailUrl, thumbnail_path: plan.thumbnailUrl, mime_type: "video/mp4", source_url: plan.url, remote_url: plan.thumbnailUrl });
    case "vimeo": {
      const thumb = await vimeoThumbnail(plan.oembedUrl);
      return insertMedia({ ...base, file_path: thumb ?? plan.url, thumbnail_path: thumb ?? undefined, mime_type: "video/mp4", source_url: plan.url, remote_url: thumb ?? undefined });
    }
    case "video-file":
      return insertMedia({ ...base, file_path: plan.url, mime_type: "video/mp4", source_url: plan.url });
    case "image":
      return insertMedia({ ...base, file_path: plan.url, thumbnail_path: plan.url, mime_type: imageMimeType(plan.filename), remote_url: plan.url });
  }
}
