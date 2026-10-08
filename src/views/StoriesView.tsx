import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import StoryCard from "@/components/reader/StoryCard";
import { listStories } from "@/lib/actions/stories";
import { filterPublishedStories } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

export default function StoriesView() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listStories({ status: "published" })
      .then((s) => setStories(filterPublishedStories(s)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  return (
    <ReadPage title="Stories" subtitle={`${stories.length} ${stories.length === 1 ? "story" : "stories"}`}>
      {stories.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No published stories yet"
          description="Published stories will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      )}
    </ReadPage>
  );
}
