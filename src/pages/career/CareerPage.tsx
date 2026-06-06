import { useEffect, useState } from "react";
import { Plus, Briefcase } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { listCareerEntries } from "@/lib/actions/career";
import type { CareerEntry } from "@/lib/models";

export default function CareerPage() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCareerEntries().then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <PageHeader
        title="Career & Education"
        subtitle="Your professional journey and academic milestones"
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            <Plus size={14} />
            Add Entry
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No career entries yet"
          description="Add your work history and education to preserve your professional story."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="p-5 rounded-xl border flex items-start gap-4"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--color-surface-2)" }}
              >
                <Briefcase size={16} style={{ color: "var(--color-text-muted)" }} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                      {entry.title ?? entry.entry_type === "education" ? "Student" : "Employee"}
                    </div>
                    <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      {entry.organization}
                    </div>
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {entry.start_date?.substring(0, 7)}
                    {entry.is_current ? " – Present" : entry.end_date ? ` – ${entry.end_date.substring(0, 7)}` : ""}
                  </div>
                </div>
                {entry.description && (
                  <p className="text-sm mt-1.5" style={{ color: "var(--color-text-secondary)" }}>
                    {entry.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
