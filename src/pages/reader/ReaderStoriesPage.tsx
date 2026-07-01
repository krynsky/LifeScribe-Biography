import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listStories } from "@/lib/actions/stories";
import { filterPublishedStories } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

export default function ReaderStoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listStories({ status: "published" })
      .then((s) => setStories(filterPublishedStories(s)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Stories
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : stories.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No published stories yet"
          description="Published stories will appear here."
        />
      ) : (
        <div className="space-y-3">
          {stories.map((story) => (
            <Link
              key={story.id}
              to="/reader/stories/$storyId"
              params={{ storyId: String(story.id) }}
              className="block p-5 rounded-xl border hover:shadow-md transition-shadow"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="font-semibold text-base mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                {story.title}
              </h3>
              {story.excerpt && (
                <p className="text-sm line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{story.excerpt}</p>
              )}
              {story.event_date && (
                <span className="text-xs mt-2 inline-block" style={{ color: "var(--color-text-muted)" }}>
                  {story.event_date.substring(0, story.event_date_precision === "year" ? 4 : story.event_date_precision === "month" ? 7 : 10)}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
