import { appRunner } from "./data/sql";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { getSiteSlug } from "./sync/config";

export type InternalTarget = { to: string; params?: Record<string, string> };

/** Pages of the public site that exist as top-level sections in the app too. */
const SECTION_ROUTES: Record<string, string> = {
  overview: "/",
  stories: "/stories",
  timeline: "/timeline",
  gallery: "/gallery",
  career: "/career",
  "family-tree": "/family-tree",
  maps: "/maps",
  places: "/maps",
};

const WEB_PATH = /^(?:https?:\/\/(?:www\.)?lifescribe\.us)?\/bio\/[^/?#]+(?:\/([^/?#]+))?(?:\/([^/?#]+))?\/?(?:[?#].*)?$/i;

/** True for links that point into the biography itself (the website's /bio/... addresses). */
export function isInternalHref(href: string | null | undefined): boolean {
  return !!href && WEB_PATH.test(href.trim());
}

/**
 * Work out where a website-style link (e.g. /bio/mark/stories/my-story) lives in the app.
 * Returns null when the thing it points at doesn't exist locally.
 */
export async function resolveInternalLink(href: string): Promise<InternalTarget | null> {
  const m = WEB_PATH.exec(href.trim());
  if (!m) return null;
  const section = (m[1] ?? "overview").toLowerCase();
  const ref = m[2] ? decodeURIComponent(m[2]) : null;

  if (section === "stories" && ref) {
    const rows = await appRunner.select<{ id: number }>("SELECT id FROM stories WHERE slug = ? LIMIT 1", [ref]);
    return rows[0] ? { to: "/stories/$storyId", params: { storyId: String(rows[0].id) } } : null;
  }
  if (section === "gallery" && ref) {
    const rows = await appRunner.select<{ id: number }>(
      `SELECT a.id FROM albums a LEFT JOIN sync_state s ON s.entity_type = 'album' AND s.local_id = a.id
       WHERE s.remote_id = ? OR CAST(a.id AS TEXT) = ? LIMIT 1`,
      [ref, ref]
    );
    return rows[0] ? { to: "/gallery/albums/$albumId", params: { albumId: String(rows[0].id) } } : null;
  }
  const to = SECTION_ROUTES[section];
  return to ? { to } : null;
}

export interface InternalLinkOption {
  group: "Stories" | "Albums" | "Sections";
  label: string;
  href: string;
}

const SECTION_LABELS: [string, string][] = [
  ["stories", "All stories"],
  ["timeline", "Timeline"],
  ["gallery", "Gallery"],
  ["family-tree", "Family tree"],
  ["career", "Career"],
  ["maps", "Places"],
];

/** Everything the link dialog can offer to link to, as website-compatible addresses. */
export async function listInternalLinkOptions(): Promise<InternalLinkOption[]> {
  const site = getSiteSlug() || "me";
  const base = `/bio/${site}`;
  const [stories, albums] = await Promise.all([
    appRunner.select<{ title: string; slug: string | null }>("SELECT title, slug FROM stories WHERE slug IS NOT NULL AND slug <> '' ORDER BY title"),
    appRunner.select<{ name: string; ref: string }>(
      `SELECT a.name, COALESCE(s.remote_id, CAST(a.id AS TEXT)) AS ref
       FROM albums a LEFT JOIN sync_state s ON s.entity_type = 'album' AND s.local_id = a.id ORDER BY a.name`
    ),
  ]);
  return [
    ...SECTION_LABELS.map(([s, label]): InternalLinkOption => ({ group: "Sections", label, href: `${base}/${s}` })),
    ...stories.map((s): InternalLinkOption => ({ group: "Stories", label: s.title, href: `${base}/stories/${s.slug}` })),
    ...albums.map((a): InternalLinkOption => ({ group: "Albums", label: a.name, href: `${base}/gallery/${a.ref}` })),
  ];
}

/** Follow a link: biography addresses open in the app (via `navigate`), web/email links in the system browser. */
export async function followLink(href: string, navigate: (target: InternalTarget) => unknown): Promise<void> {
  if (isInternalHref(href)) {
    const target = await resolveInternalLink(href);
    if (target) await navigate(target);
    else alert("That page isn't in this biography (yet).");
  } else if (/^(https?:|mailto:|tel:)/i.test(href)) {
    await openExternal(href);
  }
}
