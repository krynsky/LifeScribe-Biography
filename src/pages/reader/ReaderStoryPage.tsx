import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import StoryEditor from "@/components/editor/StoryEditor";
import { getStory } from "@/lib/actions/stories";
import type { Story } from "@/lib/models";

export default function ReaderStoryPage() {
  const { storyId } = useParams({ from: "/reader/stories/$storyId" });
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStory(Number(storyId)).then(setStory).catch(console.error).finally(() => setLoading(false));
  }, [storyId]);

  if (loading) {
    return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }
  if (!story || story.status !== "published") {
    return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Story not found.</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link
        to="/reader/stories"
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Stories
      </Link>
      <h1 className="text-2xl mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {story.title}
      </h1>
      {story.event_date && (
        <div className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          {story.event_date.substring(0, story.event_date_precision === "year" ? 4 : story.event_date_precision === "month" ? 7 : 10)}
        </div>
      )}
      <StoryEditor content={story.content} onChange={() => {}} readOnly />
    </div>
  );
}
