import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, BookOpen, Search, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CategoryChip, { TagList } from "@/components/reader/CategoryChip";
import { listStories, deleteStory } from "@/lib/actions/stories";
import { imageSrc } from "@/lib/image-src";
import { formatDisplayDate, parseTags } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

type StatusFilter = "all" | "published" | "draft";

export default function StoryListPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listStories({ search: search || undefined, status: statusFilter === "all" ? undefined : statusFilter })
      .then(setStories)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  async function handleDelete(story: Story) {
    if (!confirm(`Permanently delete "${story.title}"? This cannot be undone.`)) return;
    await deleteStory(story.id);
    setStories((prev) => prev.filter((s) => s.id !== story.id));
  }

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

      <div className="relative mb-4 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Search stories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
      </div>

      <div className="flex gap-1.5 mb-5" role="group" aria-label="Filter by status">
        {(["all", "published", "draft"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={statusFilter === f}
            onClick={() => setStatusFilter(f)}
            className="text-xs px-3 py-1 rounded-full border capitalize"
            style={{
              borderColor: statusFilter === f ? "var(--color-primary)" : "var(--color-border)",
              background: statusFilter === f ? "var(--color-primary)" : "transparent",
              color: statusFilter === f ? "white" : "var(--color-text-secondary)",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : stories.length === 0 ? (
        search || statusFilter !== "all" ? (
          <EmptyState
            icon={<BookOpen size={24} style={{ color: "var(--color-text-muted)" }} />}
            title="No matching stories"
            description="Try a different search or filter."
          />
        ) : (
          <EmptyState
            icon={<BookOpen size={24} style={{ color: "var(--color-text-muted)" }} />}
            title="No stories yet"
            description="Every life has a story worth telling. Write your first one."
            action={
              <Link to="/stories/new" className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>
                Write Your First Story
              </Link>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {stories.map((story) => {
            const cover = imageSrc(story.featured_image_path);
            const date = formatDisplayDate(story.event_date, story.event_date_precision);
            const tags = parseTags(story.tags);
            const published = story.status === "published";
            return (
              <div
                key={story.id}
                className="group flex items-stretch rounded-xl border overflow-hidden hover:shadow-md transition-shadow"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
              >
                <Link to="/stories/$storyId" params={{ storyId: String(story.id) }} className="flex flex-1 min-w-0">
                  <div className="w-28 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: "var(--color-surface-2)" }}>
                    {cover ? <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" /> : "📝"}
                  </div>
                  <div className="flex-1 min-w-0 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryChip name={story.category} color={story.category_color} icon={story.category_icon} />
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: published ? "#4A9B6F22" : "var(--color-surface-2)",
                          color: published ? "var(--color-success)" : "var(--color-text-muted)",
                        }}
                      >
                        {published ? "Published" : "Draft"}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base mb-1 truncate" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                      {story.title}
                    </h3>
                    {story.excerpt && (
                      <p className="text-sm line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
                        {story.excerpt}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {date && <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>{date}</span>}
                      <TagList tags={tags} />
                    </div>
                  </div>
                </Link>
                <div className="flex flex-col items-end justify-between p-3 flex-shrink-0">
                  <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Edited {story.updated_at.substring(0, 10)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(story)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    style={{ color: "var(--color-error)" }}
                    title="Delete story"
                    aria-label={`Delete ${story.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
