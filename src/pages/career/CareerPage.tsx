import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Briefcase, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, AlbumChips } from "@/components/reader/LinkedChips";
import { listCareerEntries, deleteCareerEntry } from "@/lib/actions/career";
import { loadCareerLinks, type LinkContext } from "@/lib/actions/related";
import { imageSrc } from "@/lib/image-src";
import { computeDuration, formatMonthYear } from "@/lib/reader-utils";
import type { CareerEntry } from "@/lib/models";

export default function CareerPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [links, setLinks] = useState<LinkContext | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [e, l] = await Promise.all([listCareerEntries(), loadCareerLinks()]);
    setEntries(e);
    setLinks(l);
  }, []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  const openAdd = () => navigate({ to: "/career/new" });
  const openEdit = (entry: CareerEntry) => navigate({ to: "/career/$entryId", params: { entryId: String(entry.id) } });

  async function handleDelete(entry: CareerEntry) {
    if (!confirm(`Delete "${entry.title ? `${entry.title} at ` : ""}${entry.organization}"? This cannot be undone.`)) return;
    await deleteCareerEntry(entry.id);
    await reload();
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Career"
        subtitle="Your work history and education"
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} />
            Add Position
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No career entries yet"
          description="Add your jobs and education to build your professional story."
          action={
            <button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>
              Add Your First Position
            </button>
          }
        />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {entries.map((entry) => {
            const logo = imageSrc(entry.logo_path) ?? imageSrc(links?.thumbnails.get(entry.id));
            const range = `${formatMonthYear(entry.start_date)} – ${entry.is_current ? "Present" : entry.end_date ? formatMonthYear(entry.end_date) : "?"}`;
            const duration = computeDuration(entry.start_date, entry.end_date, !!entry.is_current);
            return (
              <div key={entry.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button")) openEdit(entry); }} className="group flex gap-4 p-4 cursor-pointer rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden text-lg font-bold" style={{ background: "var(--color-surface-2)", color: "var(--color-primary)" }}>
                  {logo ? <img src={logo} alt="" className="w-full h-full object-contain" /> : entry.organization.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                      {entry.title || (entry.entry_type === "education" ? "Student" : "Employee")}
                    </h3>
                    {!!entry.is_current && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#15803d" }}>Current</span>
                    )}
                    <CategoryChip variant="solid" name={entry.category} color={entry.category_color} icon={entry.category_icon} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>
                    {entry.organization}
                    {entry.employment_type && <span style={{ color: "var(--color-text-muted)" }}> · {entry.employment_type}</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {range}
                    {duration && ` · ${duration}`}
                    {entry.location && ` · 📍 ${entry.location}`}
                  </p>
                  {entry.description && <p className="text-sm mt-2 whitespace-pre-line line-clamp-3" style={{ color: "var(--color-text-secondary)" }}>{entry.description}</p>}
                  <AlbumChips items={links?.albums.get(entry.id)} />
                  <StoryChips items={links?.stories.get(entry.id)} />
                </div>
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(entry)} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit" aria-label={`Edit ${entry.organization}`}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => void handleDelete(entry)} className="p-1.5 rounded" style={{ color: "var(--color-error)" }} title="Delete" aria-label={`Delete ${entry.organization}`}>
                    <Trash2 size={13} />
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
