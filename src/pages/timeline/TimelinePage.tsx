import { useEffect, useState } from "react";
import { Plus, Clock } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { listMilestones } from "@/lib/actions/milestones";
import type { Milestone } from "@/lib/models";

export default function TimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMilestones()
      .then(setMilestones)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <PageHeader
        title="Timeline"
        subtitle="Key moments and milestones in your life"
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
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
        />
      ) : (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div
            className="absolute left-3 top-0 bottom-0 w-0.5"
            style={{ background: "var(--color-border)" }}
          />
          <div className="space-y-6">
            {milestones.map((m) => (
              <div key={m.id} className="relative">
                {/* Dot */}
                <div
                  className="absolute -left-8 top-1.5 w-4 h-4 rounded-full border-2 border-white"
                  style={{ background: m.color || "var(--color-primary)" }}
                />
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3
                        className="font-semibold"
                        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
                      >
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                          {m.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {m.date.substring(0, m.date_precision === "year" ? 4 : m.date_precision === "month" ? 7 : 10)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
