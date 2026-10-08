import { useEffect, useState } from "react";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import StoryCard from "@/components/reader/StoryCard";
import { getBiography } from "@/lib/actions/biography";
import { listStories } from "@/lib/actions/stories";
import { filterPublishedStories } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

export default function StoriesView() {
  const [stories, setStories] = useState<Story[]>([]);
  const [siteTitle, setSiteTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listStories({ status: "published" }), getBiography()])
      .then(([s, b]) => {
        setStories(filterPublishedStories(s));
        setSiteTitle(b?.title ?? "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  const subtitle =
    stories.length === 0
      ? "No stories published yet."
      : `${stories.length} ${stories.length === 1 ? "story" : "stories"}${siteTitle ? ` from ${siteTitle}` : ""}`;

  return (
    <ReadPage title="Stories" subtitle={subtitle}>
      {stories.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-20 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <p className="text-4xl">📝</p>
          <p className="mt-3">No stories have been published yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      )}
    </ReadPage>
  );
}
