import { Link } from "@tanstack/react-router";
import type { LinkedItem } from "@/lib/data/links";

const CHIP = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";
const STORY_STYLE = {
  borderColor: "var(--color-accent)",
  background: "var(--color-surface-2)",
  color: "var(--color-primary-dark)",
} as const;
const ALBUM_STYLE = { borderColor: "#a7f3d0", background: "#ecfdf5", color: "#047857" } as const;

/** "📖 Story title" chips linking to the story. */
export function StoryChips({ items }: { items: LinkedItem[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((s) => (
        <Link key={s.id} to="/stories/$storyId" params={{ storyId: String(s.id) }} className={CHIP} style={STORY_STYLE}>
          📖 {s.title}
        </Link>
      ))}
    </div>
  );
}

/** "🖼️ Album name" chips linking to the album. */
export function AlbumChips({ items }: { items: LinkedItem[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <Link key={a.id} to="/gallery/albums/$albumId" params={{ albumId: String(a.id) }} className={CHIP} style={ALBUM_STYLE}>
          🖼️ {a.title}
        </Link>
      ))}
    </div>
  );
}
