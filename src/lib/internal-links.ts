import { open as openExternal } from "@tauri-apps/plugin-shell";
import { appRunner } from "./data/sql";

export type InternalTarget = { to: string; params?: Record<string, string> };

/** Top-level sections of the biography that a link can point at. */
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

/**
 * In-biography addresses: `/stories/<slug>`, `/gallery/<albumId>`, `/timeline`, …
 * The older `/bio/<site>/…` form (from stories written when the app synced with the website) is understood too.
 */
const INTERNAL_PATH = /^(?:https?:\/\/(?:www\.)?lifescribe\.us)?(?:\/bio\/[^/?#]+)?\/([a-z-]+)(?:\/([^/?#]+))?\/?(?:[?#].*)?$/i;

/** True for links that point into the biography itself rather than out to the web. */
export function isInternalHref(href: string | null | undefined): boolean {
  if (!href) return false;
  const m = INTERNAL_PATH.exec(href.trim());
  return !!m && (m[1].toLowerCase() in SECTION_ROUTES);
}

/** Work out where an in-biography link lives in the app, or null if the target no longer exists. */
export async function resolveInternalLink(href: string): Promise<InternalTarget | null> {
  const m = INTERNAL_PATH.exec(href.trim());
  if (!m) return null;
  const section = m[1].toLowerCase();
  const ref = m[2] ? decodeURIComponent(m[2]) : null;

  if (section === "stories" && ref) {
    const rows = await appRunner.select<{ id: number }>("SELECT id FROM stories WHERE slug = ? LIMIT 1", [ref]);
    return rows[0] ? { to: "/stories/$storyId", params: { storyId: String(rows[0].id) } } : null;
  }
  if (section === "gallery" && ref) {
    const rows = await appRunner.select<{ id: number }>("SELECT id FROM albums WHERE id = ? LIMIT 1", [Number(ref)]);
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

/** Everything the link dialog can offer to link to. */
export async function listInternalLinkOptions(): Promise<InternalLinkOption[]> {
  const [stories, albums] = await Promise.all([
    appRunner.select<{ title: string; slug: string | null }>("SELECT title, slug FROM stories WHERE slug IS NOT NULL AND slug <> '' ORDER BY title"),
    appRunner.select<{ id: number; name: string }>("SELECT id, name FROM albums ORDER BY name"),
  ]);
  return [
    ...SECTION_LABELS.map(([s, label]): InternalLinkOption => ({ group: "Sections", label, href: `/${s}` })),
    ...stories.map((s): InternalLinkOption => ({ group: "Stories", label: s.title, href: `/stories/${s.slug}` })),
    ...albums.map((a): InternalLinkOption => ({ group: "Albums", label: a.name, href: `/gallery/${a.id}` })),
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
