import { Link } from "@tanstack/react-router";
import { imageSrc } from "@/lib/image-src";
import { formatDisplayDate, parseTags } from "@/lib/reader-utils";
import CategoryChip, { TagList } from "@/components/reader/CategoryChip";
import type { Story } from "@/lib/models";

interface StoryCardProps {
  story: Story;
  /** The stories list shows a 📝 placeholder when there is no cover; the home page shows none. */
  placeholder?: boolean;
}

export default function StoryCard({ story, placeholder = true }: StoryCardProps) {
  // Cover comes only from the story's featured image (no guessing from body images),
  // exactly like the public site.
  const cover = imageSrc(story.featured_image_path);
  const date = formatDisplayDate(story.event_date, story.event_date_precision);
  const tags = parseTags(story.tags);

  return (
    <Link
      to="/stories/$storyId"
      params={{ storyId: String(story.id) }}
      className="group flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
    >
      {cover ? (
        <img src={cover} alt={story.title} className="h-44 w-full object-cover" loading="lazy" />
      ) : placeholder ? (
        <div
          className="flex h-44 w-full items-center justify-center text-4xl"
          style={{ background: "linear-gradient(135deg, var(--color-surface-2), rgba(212,168,106,0.2))" }}
        >
          📝
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        {story.category && (
          <div className="mb-2">
            <CategoryChip name={story.category} color={story.category_color} icon={story.category_icon} />
          </div>
        )}
        <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
          {story.title}
        </h3>
        {story.excerpt && (
          <p className="mt-2 line-clamp-2 flex-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {story.excerpt}
          </p>
        )}
        {(date || tags.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {date && (
              <span className="text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                {date}
              </span>
            )}
            <TagList tags={tags} />
          </div>
        )}
      </div>
    </Link>
  );
}
