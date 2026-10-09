/**
 * Recognise what a pasted URL (or address) should become inside a story. YouTube, Vimeo and
 * Google Maps embed natively and offline; anything else becomes a plain link, matching the
 * web editor's fallback. Mirrors apps/web/src/lib/embed-utils.ts so both sides agree on what
 * counts as a video.
 */

/** YouTube watch / youtu.be / shorts / embed URLs → video id + embed URL. */
export function parseYouTubeUrl(url: string): { embedUrl: string; videoId: string } | null {
  try {
    const u = new URL(url);
    let videoId: string | null = null;
    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1).split("?")[0];
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") videoId = u.searchParams.get("v");
      else if (u.pathname.startsWith("/shorts/")) videoId = u.pathname.split("/shorts/")[1]?.split("?")[0] ?? null;
      else if (u.pathname.startsWith("/embed/")) videoId = u.pathname.split("/embed/")[1]?.split("?")[0] ?? null;
    }
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
    return { videoId, embedUrl: `https://www.youtube.com/embed/${videoId}` };
  } catch {
    return null;
  }
}

/** vimeo.com/{id}, unlisted /{id}/{hash}, channels, groups and player URLs → video id + embed URL. */
export function parseVimeoUrl(url: string): { embedUrl: string; videoId: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    let videoId: string | null = null;
    let hash: string | null = null;
    if (u.hostname === "player.vimeo.com") {
      videoId = u.pathname.match(/^\/video\/(\d+)/)?.[1] ?? null;
      hash = u.searchParams.get("h");
    } else {
      const m = u.pathname.match(/\/(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
      videoId = m?.[1] ?? null;
      hash = m?.[2] ?? null;
    }
    if (!videoId) return null;
    return {
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ""}`,
    };
  } catch {
    return null;
  }
}

export function isGoogleMapsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "maps.app.goo.gl" ||
      u.hostname === "goo.gl" ||
      u.hostname === "maps.google.com" ||
      (u.hostname.includes("google.com") && u.pathname.startsWith("/maps"))
    );
  } catch {
    return false;
  }
}

/** True for short links that need a network redirect to reveal the place. */
export function isShortMapsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "maps.app.goo.gl" || host === "goo.gl";
  } catch {
    return false;
  }
}

/** Pull the place query out of a full Google Maps URL (`/maps/place/Name/@lat,lng` or `?q=`). */
export function mapsQueryFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") ?? u.searchParams.get("query");
    if (q) return q;
    const place = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (place) return decodeURIComponent(place[1].replace(/\+/g, " "));
    const coords = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coords) return `${coords[1]},${coords[2]}`;
    return null;
  } catch {
    return null;
  }
}

/** Keyless Google Maps embed for a place name, address or "lat,lng" (no API key, works offline-first). */
export function keylessMapsEmbed(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query.trim())}&output=embed`;
}

export type EmbedPlan =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "maps"; src: string }
  | { kind: "maps-needs-resolve"; url: string }
  | { kind: "link"; url: string }
  | { kind: "invalid"; reason: string };

/**
 * Decide how to embed what the user typed: a video URL, a maps URL, a plain address/place
 * (prefixed "map:" is not needed — anything that isn't a URL is treated as a place), or a link.
 */
export function planEmbed(input: string): EmbedPlan {
  const text = input.trim();
  if (!text) return { kind: "invalid", reason: "Paste a URL or an address." };

  const isUrl = /^https?:\/\//i.test(text);
  if (!isUrl) return { kind: "maps", src: keylessMapsEmbed(text) };

  const yt = parseYouTubeUrl(text);
  if (yt) return { kind: "youtube", src: yt.embedUrl };

  const vimeo = parseVimeoUrl(text);
  if (vimeo) return { kind: "vimeo", src: vimeo.embedUrl };

  if (isGoogleMapsUrl(text)) {
    if (isShortMapsUrl(text)) return { kind: "maps-needs-resolve", url: text };
    const q = mapsQueryFromUrl(text);
    return q ? { kind: "maps", src: keylessMapsEmbed(q) } : { kind: "link", url: text };
  }

  return { kind: "link", url: text };
}
