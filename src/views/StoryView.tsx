import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import StoryEditor from "@/components/editor/StoryEditor";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { getStory } from "@/lib/actions/stories";
import { getBiography } from "@/lib/actions/biography";
import { imageSrc } from "@/lib/image-src";
import { formatDisplayDate, parseTags } from "@/lib/reader-utils";
import CategoryChip, { TagList } from "@/components/reader/CategoryChip";
import type { Story } from "@/lib/models";

export default function StoryView() {
  const { storyId } = useParams({ from: "/stories/$storyId" });
  const [story, setStory] = useState<Story | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getStory(Number(storyId)), getBiography()])
      .then(([s, b]) => {
        setStory(s);
        setAuthor(b?.title ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storyId]);

  if (loading) return <ReadLoading />;
  if (!story || story.status !== "published") {
    return (
      <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>
        Story not found.
      </div>
    );
  }

  const hero = imageSrc(story.featured_image_path);
  const tags = parseTags(story.tags);
  const date = formatDisplayDate(story.event_date, story.event_date_precision);

  return (
    <ReadPage width="narrow">
      <Link to="/stories" className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        ← Stories
      </Link>
      {hero && (
        <img src={hero} alt="" className="w-full rounded-xl mt-4 mb-6 object-cover" style={{ maxHeight: 420 }} />
      )}
      <div className="mt-4">
        <CategoryChip name={story.category} color={story.category_color} icon={story.category_icon} />
      </div>
      <h1 className="text-3xl mt-2 mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {story.title}
      </h1>
      {(author || date) && (
        <div className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
          {[author, date].filter(Boolean).join(" · ")}
        </div>
      )}
      {story.excerpt && (
        <p className="text-base mb-6 pb-6 border-b" style={{ color: "var(--color-text-secondary)", borderColor: "var(--color-border)" }}>
          {story.excerpt}
        </p>
      )}
      <StoryEditor content={story.content} onChange={() => {}} readOnly />
      {tags.length > 0 && (
        <div className="mt-8 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <TagList tags={tags} />
        </div>
      )}
    </ReadPage>
  );
}
