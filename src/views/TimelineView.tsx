import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { listMilestones } from "@/lib/actions/milestones";
import { imageSrc } from "@/lib/image-src";
import { formatDisplayDate } from "@/lib/reader-utils";
import CategoryChip from "@/components/reader/CategoryChip";
import type { Milestone } from "@/lib/models";

export default function TimelineView() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMilestones().then(setMilestones).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  // Group by year so each group gets a rail badge, like the public timeline.
  const groups: { year: string; items: Milestone[] }[] = [];
  for (const m of milestones) {
    const year = m.date.substring(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(m);
    else groups.push({ year, items: [m] });
  }

  return (
    <ReadPage title="Timeline" subtitle="Life milestones" width="narrow">
      {milestones.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No milestones yet"
          description="Milestones will appear here once added."
        />
      ) : (
        <div className="relative pl-12">
          <div className="absolute left-4 top-2 bottom-0 w-0.5" style={{ background: "var(--color-border)" }} />
          {groups.map((g) => (
            <section key={g.year} className="mb-8">
              <div className="relative flex items-center mb-4">
                <div
                  className="absolute -left-12 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                  style={{ background: "var(--color-primary)" }}
                >
                  {`’${g.year.slice(-2)}`}
                </div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {g.year}
                </h2>
              </div>
              <div className="space-y-5">
                {g.items.map((m) => {
                  const img = imageSrc(m.image_path);
                  return (
                    <article
                      key={m.id}
                      className="rounded-xl border overflow-hidden"
                      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                    >
                      {img && <img src={img} alt="" className="w-full object-cover" style={{ maxHeight: 240 }} loading="lazy" />}
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--color-text-muted)" }}>
                          <CategoryChip name={m.category} color={m.category_color ?? m.color} icon={m.category_icon} />
                          <span>{formatDisplayDate(m.date, m.date_precision)}</span>
                        </div>
                        <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                          {m.title}
                        </h3>
                        {m.description && (
                          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
                            {m.description}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </ReadPage>
  );
}
