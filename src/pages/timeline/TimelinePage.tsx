import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Clock, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, AlbumChips } from "@/components/reader/LinkedChips";
import { listMilestones, deleteMilestone } from "@/lib/actions/milestones";
import { loadMilestoneLinks, type LinkContext } from "@/lib/actions/related";
import { imageSrc } from "@/lib/image-src";
import { formatShortDate } from "@/lib/reader-utils";
import type { Milestone } from "@/lib/models";

export default function TimelinePage() {
  const navigate = useNavigate();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [links, setLinks] = useState<LinkContext | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [m, l] = await Promise.all([listMilestones(), loadMilestoneLinks()]);
    setMilestones(m);
    setLinks(l);
  }, []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  const openAdd = () => navigate({ to: "/timeline/new" });
  const openEdit = (m: Milestone) => navigate({ to: "/timeline/$milestoneId", params: { milestoneId: String(m.id) } });

  async function handleDelete(m: Milestone) {
    if (!confirm(`Delete "${m.title}"? This cannot be undone.`)) return;
    await deleteMilestone(m.id);
    await reload();
  }

  // Group by year, oldest first, like the public timeline.
  const groups: { year: string; items: Milestone[] }[] = [];
  for (const m of milestones) {
    const year = m.date.substring(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(m);
    else groups.push({ year, items: [m] });
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Timeline"
        subtitle="Key moments and milestones in your life"
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} />
            Add Milestone
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No milestones yet"
          description="Mark the moments that shaped your life — births, moves, achievements, and more."
          action={
            <button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>
              Add Your First Milestone
            </button>
          }
        />
      ) : (
        <div className="relative max-w-3xl">
          <div className="absolute bottom-2 left-5 top-2 w-px" style={{ background: "var(--color-border)" }} />
          <div className="space-y-8">
            {groups.map((g) => (
              <div key={g.year}>
                <div className="relative mb-4 flex items-center gap-4">
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md" style={{ background: "var(--color-primary)" }}>
                    {g.year}
                  </div>
                  <span className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>{g.year}</span>
                </div>
                <div className="ml-16 space-y-3">
                  {g.items.map((m) => {
                    const img = imageSrc(m.image_path) ?? imageSrc(links?.thumbnails.get(m.id));
                    return (
                      <div key={m.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button")) openEdit(m); }} className="group relative overflow-hidden cursor-pointer rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                        <div className="absolute top-5 h-3 w-3 rounded-full ring-2 ring-white" style={{ left: "-2.75rem", background: m.category_color || "#6366F1" }} />
                        {img && <img src={img} alt="" className="h-32 w-full object-cover" loading="lazy" />}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <CategoryChip variant="solid" name={m.category} color={m.category_color} icon={m.category_icon} />
                                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                                  {formatShortDate(m.date, m.date_precision)}
                                  {m.end_date && ` – ${formatShortDate(m.end_date, m.end_date_precision ?? "day")}`}
                                </span>
                              </div>
                              <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>{m.title}</h3>
                              {m.description && <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{m.description}</p>}
                              <StoryChips items={links?.stories.get(m.id)} />
                              <AlbumChips items={links?.albums.get(m.id)} />
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button onClick={() => openEdit(m)} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit milestone" aria-label={`Edit ${m.title}`}>
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => void handleDelete(m)} className="p-1.5 rounded" style={{ color: "var(--color-error)" }} title="Delete milestone" aria-label={`Delete ${m.title}`}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
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
    </div>
  );
}
