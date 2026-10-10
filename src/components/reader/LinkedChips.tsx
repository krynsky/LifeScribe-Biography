import { Link } from "@tanstack/react-router";
import type { LinkedItem } from "@/lib/data/links";

const CHIP = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";
const CHIP_COMPACT = "inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs";
const STORY_STYLE = {
  borderColor: "var(--color-accent)",
  background: "var(--color-surface-2)",
  color: "var(--color-primary-dark)",
} as const;
const ALBUM_STYLE = { borderColor: "#a7f3d0", background: "#ecfdf5", color: "#047857" } as const;

/** "📖 Story title" chips linking to the story. */
export function StoryChips({ items, compact }: { items: LinkedItem[] | undefined; compact?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-1" : "mt-3 flex flex-wrap gap-2"}>
      {items.map((s) => (
        <Link key={s.id} to="/stories/$storyId" params={{ storyId: String(s.id) }} className={compact ? CHIP_COMPACT : CHIP} style={STORY_STYLE}>
          📖 {s.title}
        </Link>
      ))}
    </div>
  );
}

/** "🖼️ Album name" chips linking to the album. */
export function AlbumChips({ items, compact }: { items: LinkedItem[] | undefined; compact?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={compact ? "mt-2 flex flex-wrap gap-1" : "mt-3 flex flex-wrap gap-2"}>
      {items.map((a) => (
        <Link key={a.id} to="/gallery/albums/$albumId" params={{ albumId: String(a.id) }} className={compact ? CHIP_COMPACT : CHIP} style={ALBUM_STYLE}>
          🖼️ {a.title}
        </Link>
      ))}
    </div>
  );
}
