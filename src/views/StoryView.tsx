import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import StoryEditor from "@/components/editor/StoryEditor";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { AlbumChips } from "@/components/reader/LinkedChips";
import { TagList } from "@/components/reader/CategoryChip";
import { getStory } from "@/lib/actions/stories";
import { getBiography } from "@/lib/actions/biography";
import { subjectDisplayName } from "@/lib/profile-form";
import { imageSrc } from "@/lib/image-src";
import { getRelationsForStory, type StoryRelations } from "@/lib/actions/related";
import { formatDisplayDate, parseTags } from "@/lib/reader-utils";
import type { Story } from "@/lib/models";

export default function StoryView() {
  const { storyId } = useParams({ from: "/stories/$storyId" });
  const [story, setStory] = useState<Story | null>(null);
  const [siteTitle, setSiteTitle] = useState("");
  const [byline, setByline] = useState("");
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<StoryRelations | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getStory(Number(storyId)), getBiography(), getRelationsForStory(Number(storyId))])
      .then(([s, b, r]) => {
        setStory(s);
        setSiteTitle(b?.title ?? "");
        setByline(subjectDisplayName(b));
        setRelated(r);
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
  const hasRelated =
    !!related && (related.milestones.length > 0 || related.albums.length > 0 || related.mapPins.length > 0 || related.career.length > 0);
  const date = formatDisplayDate(story.event_date, story.event_date_precision);
  const heading = { fontFamily: "var(--font-heading)", color: "var(--color-text)" } as const;
  const sectionLabel = "mb-2 text-xs font-medium";

  return (
    <ReadPage width="narrow">
      <Link to="/stories" className="inline-flex items-center gap-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        ← {siteTitle || "Stories"}
      </Link>

      {hero && <img src={hero} alt={story.title} className="mt-6 h-auto w-full rounded-xl" />}

      <div className="mt-6">
        <h1 className="text-4xl font-bold leading-tight" style={heading}>
          {story.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {byline && (
            <span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>
              {byline}
            </span>
          )}
          {byline && date && <span>·</span>}
          {date && (
            <span className="font-medium" style={{ color: "var(--color-primary)" }}>
              {date}
            </span>
          )}
        </div>
        {story.excerpt && (
          <p className="mt-5 text-xl leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {story.excerpt}
          </p>
        )}
      </div>

      <hr className="my-10" style={{ borderColor: "var(--color-border-light)" }} />

      <StoryEditor content={story.content} onChange={() => {}} readOnly />

      {tags.length > 0 && (
        <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--color-border-light)" }}>
          <TagList tags={tags} />
        </div>
      )}

      {hasRelated && related && (
        <div className="mt-10 rounded-xl border p-6" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-secondary)" }}>
            Related Entries
          </h2>
          <div className="space-y-4">
            {related.milestones.length > 0 && (
              <div>
                <h3 className={sectionLabel} style={{ color: "var(--color-text-muted)" }}>📅 Timeline</h3>
                <ul className="space-y-1">
                  {related.milestones.map((m) => (
                    <li key={m.id} className="text-sm" style={{ color: "var(--color-text)" }}>
                      {m.title} <span style={{ color: "var(--color-text-muted)" }}>· {m.year}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {related.albums.length > 0 && (
              <div>
                <h3 className={sectionLabel} style={{ color: "var(--color-text-muted)" }}>🖼️ Gallery</h3>
                <AlbumChips items={related.albums} />
              </div>
            )}
            {related.mapPins.length > 0 && (
              <div>
                <h3 className={sectionLabel} style={{ color: "var(--color-text-muted)" }}>📍 Places</h3>
                <ul className="space-y-1">
                  {related.mapPins.map((p) => (
                    <li key={p.id} className="text-sm" style={{ color: "var(--color-text)" }}>{p.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {related.career.length > 0 && (
              <div>
                <h3 className={sectionLabel} style={{ color: "var(--color-text-muted)" }}>💼 Career</h3>
                <ul className="space-y-1">
                  {related.career.map((c) => (
                    <li key={c.id} className="text-sm" style={{ color: "var(--color-text)" }}>
                      {c.title ?? "Role"} <span style={{ color: "var(--color-text-muted)" }}>@ {c.company}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-12 border-t pt-8" style={{ borderColor: "var(--color-border-light)" }}>
        <Link to="/stories" className="text-sm" style={{ color: "var(--color-primary)" }}>
          ← All stories
        </Link>
      </div>
    </ReadPage>
  );
}
