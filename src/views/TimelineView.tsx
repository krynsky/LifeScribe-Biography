import { useEffect, useState } from "react";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, useLinkTargets } from "@/components/reader/LinkedChips";
import { getBiography } from "@/lib/actions/biography";
import { listMilestones } from "@/lib/actions/milestones";
import { imageSrc } from "@/lib/image-src";
import { formatShortDate, parseLinked } from "@/lib/reader-utils";
import type { Milestone } from "@/lib/models";

export default function TimelineView() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [siteTitle, setSiteTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const links = useLinkTargets();

  useEffect(() => {
    Promise.all([listMilestones(), getBiography()])
      .then(([m, b]) => {
        setMilestones(m);
        setSiteTitle(b?.title ?? "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  // Group by year, oldest first, like the public timeline.
  const groups: { year: string; items: Milestone[] }[] = [];
  for (const m of milestones) {
    const year = m.date.substring(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(m);
    else groups.push({ year, items: [m] });
  }

  return (
    <ReadPage title="Timeline" subtitle={siteTitle ? `Life milestones of ${siteTitle}` : "Life milestones"} width="timeline">
      {milestones.length === 0 ? (
        <div className="rounded-xl border border-dashed py-20 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <p className="text-4xl">📅</p>
          <p className="mt-3">No milestones have been added yet.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute bottom-2 left-5 top-2 w-px" style={{ background: "var(--color-border)" }} />
          <div className="space-y-10">
            {groups.map((g) => (
              <div key={g.year}>
                <div className="relative mb-6 flex items-center gap-4">
                  <div
                    className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {g.year}
                  </div>
                  <span className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>{g.year}</span>
                </div>

                <div className="ml-16 space-y-4">
                  {g.items.map((m) => {
                    const img = imageSrc(m.image_path);
                    const stories = parseLinked(m.linked_stories);
                    return (
                      <div
                        key={m.id}
                        className="relative overflow-hidden rounded-xl border"
                        style={{ background: "var(--color-surface)", borderColor: "var(--color-border-light)", boxShadow: "var(--shadow-card)" }}
                      >
                        <div
                          className="absolute top-5 h-3 w-3 rounded-full ring-2 ring-white"
                          style={{ left: "-2.75rem", background: m.category_color || "#6366F1" }}
                        />
                        {img && <img src={img} alt={m.title} className="h-40 w-full object-cover" loading="lazy" />}
                        <div className="p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <CategoryChip variant="solid" name={m.category} color={m.category_color} icon={m.category_icon} />
                            <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                              {formatShortDate(m.date, m.date_precision)}
                              {m.end_date && ` – ${formatShortDate(m.end_date, m.end_date_precision ?? "day")}`}
                            </span>
                          </div>
                          <h3 className="mt-2 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                            {m.title}
                          </h3>
                          {m.description && (
                            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                              {m.description}
                            </p>
                          )}
                          <StoryChips refs={stories} ids={links.stories} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ReadPage>
  );
}
