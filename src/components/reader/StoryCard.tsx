import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { imageSrc } from "@/lib/image-src";
import { firstImageFromContent, formatDisplayDate } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

export default function StoryCard({ story }: { story: Story }) {
  const cover = imageSrc(story.featured_image_path) ?? imageSrc(firstImageFromContent(story.content));
  const date = formatDisplayDate(story.event_date, story.event_date_precision);

  return (
    <Link
      to="/stories/$storyId"
      params={{ storyId: String(story.id) }}
      className="block rounded-xl overflow-hidden border transition-shadow hover:shadow-md"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="aspect-[3/2] flex items-center justify-center overflow-hidden"
        style={{ background: "var(--color-surface-2)" }}
      >
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <BookOpen size={28} style={{ color: "var(--color-text-muted)" }} />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
          {story.title}
        </h3>
        {story.excerpt && (
          <p className="text-xs mt-1.5 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
            {story.excerpt}
          </p>
        )}
        {date && (
          <div className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
            {date}
          </div>
        )}
      </div>
    </Link>
  );
}
