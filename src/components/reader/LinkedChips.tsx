import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { localIdsByRemote } from "@/lib/actions/links";
import type { LinkedRef } from "@/lib/reader-utils";

/** Local ids for synced story/album refs, loaded once. Chips fall back to plain text until resolved. */
export function useLinkTargets() {
  const [stories, setStories] = useState<Map<string, number>>(new Map());
  const [albums, setAlbums] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    Promise.all([localIdsByRemote("story"), localIdsByRemote("album")])
      .then(([s, a]) => {
        setStories(s);
        setAlbums(a);
      })
      .catch(console.error);
  }, []);
  return { stories, albums };
}

const STORY_CHIP =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";
const STORY_STYLE = {
  borderColor: "var(--color-accent)",
  background: "var(--color-surface-2)",
  color: "var(--color-primary-dark)",
} as const;
const ALBUM_STYLE = { borderColor: "#a7f3d0", background: "#ecfdf5", color: "#047857" } as const;

export function StoryChips({ refs, ids }: { refs: LinkedRef[]; ids: Map<string, number> }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {refs.map((r, i) => {
        const id = r.remote_id ? ids.get(r.remote_id) : undefined;
        const label = <>📖 {r.title}</>;
        return id != null ? (
          <Link key={r.remote_id ?? i} to="/stories/$storyId" params={{ storyId: String(id) }} className={STORY_CHIP} style={STORY_STYLE}>
            {label}
          </Link>
        ) : (
          <span key={r.remote_id ?? i} className={STORY_CHIP} style={STORY_STYLE}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function AlbumChips({ refs, ids }: { refs: LinkedRef[]; ids: Map<string, number> }) {
  if (refs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {refs.map((r, i) => {
        const id = r.remote_id ? ids.get(r.remote_id) : undefined;
        const label = <>🖼️ {r.title}</>;
        return id != null ? (
          <Link key={r.remote_id ?? i} to="/gallery/albums/$albumId" params={{ albumId: String(id) }} className={STORY_CHIP} style={ALBUM_STYLE}>
            {label}
          </Link>
        ) : (
          <span key={r.remote_id ?? i} className={STORY_CHIP} style={ALBUM_STYLE}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
