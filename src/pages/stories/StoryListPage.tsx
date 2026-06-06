import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, BookOpen, Search } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { listStories } from "@/lib/actions/stories";
import type { Story } from "@/lib/models";

export default function StoryListPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listStories({ search: search || undefined })
      .then(setStories)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="p-8">
      <PageHeader
        title="Stories"
        subtitle="Your life experiences in your own words"
        actions={
          <Link
            to="/stories/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            <Plus size={14} />
            New Story
          </Link>
        }
      />

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Search stories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
          }}
        />
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : stories.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No stories yet"
          description="Every life has a story worth telling. Write your first one."
          action={
            <Link
              to="/stories/new"
              className="px-4 py-2 rounded-lg text-sm text-white"
              style={{ background: "var(--color-primary)" }}
            >
              Write Your First Story
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {stories.map((story) => (
            <Link
              key={story.id}
              to="/stories/$storyId"
              params={{ storyId: String(story.id) }}
              className="block p-5 rounded-xl border hover:shadow-md transition-shadow"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-semibold text-base mb-1 truncate"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
                  >
                    {story.title}
                  </h3>
                  {story.excerpt && (
                    <p className="text-sm line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
                      {story.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {story.event_date && (
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {story.event_date.substring(0, story.event_date_precision === "year" ? 4 : story.event_date_precision === "month" ? 7 : 10)}
                      </span>
                    )}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: story.status === "published" ? "var(--color-success)" + "20" : "var(--color-surface-2)",
                        color: story.status === "published" ? "var(--color-success)" : "var(--color-text-muted)",
                      }}
                    >
                      {story.status}
                    </span>
                  </div>
                </div>
                <div className="text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                  {story.updated_at.substring(0, 10)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
