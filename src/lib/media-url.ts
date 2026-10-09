import { parseVimeoUrl, parseYouTubeUrl } from "./embed-utils";

export type MediaUrlPlan =
  | { kind: "youtube"; url: string; videoId: string; filename: string; thumbnailUrl: string }
  | { kind: "vimeo"; url: string; videoId: string; filename: string; oembedUrl: string }
  | { kind: "video-file"; url: string; filename: string }
  | { kind: "image"; url: string; filename: string }
  | { kind: "invalid"; reason: string };

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"];

function filenameFromUrl(url: URL, fallback: string): string {
  try {
    const name = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    return name || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Work out what an "add by URL" entry is. https only (same rule as the web); YouTube and Vimeo are
 * recognised automatically, direct video files by extension (or by `typeHint`), everything else is an image.
 */
export function planMediaUrl(input: string, typeHint?: "image" | "video"): MediaUrlPlan {
  const text = input.trim();
  if (!text) return { kind: "invalid", reason: "Paste a link first." };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { kind: "invalid", reason: "That doesn't look like a valid link." };
  }
  if (url.protocol !== "https:") return { kind: "invalid", reason: "Only https:// links are supported." };

  const yt = parseYouTubeUrl(text);
  if (yt) {
    return {
      kind: "youtube",
      url: yt.embedUrl,
      videoId: yt.videoId,
      filename: `YouTube – ${yt.videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt.videoId}/hqdefault.jpg`,
    };
  }

  const vimeo = parseVimeoUrl(text);
  if (vimeo) return { kind: "vimeo", url: vimeo.embedUrl, videoId: vimeo.videoId, filename: `Vimeo – ${vimeo.videoId}`, oembedUrl: vimeo.oembedUrl };

  const filename = filenameFromUrl(url, "media");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (typeHint === "video" || VIDEO_EXTENSIONS.includes(ext)) return { kind: "video-file", url: text, filename };
  return { kind: "image", url: text, filename };
}
