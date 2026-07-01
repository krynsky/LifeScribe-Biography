import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listMilestones } from "@/lib/actions/milestones";
import type { Milestone } from "@/lib/models";

function formatDate(date: string, precision: string) {
  if (precision === "year") return date.substring(0, 4);
  if (precision === "month") return date.substring(0, 7);
  return date.substring(0, 10);
}

export default function ReaderTimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMilestones().then(setMilestones).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Timeline
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No milestones yet"
          description="Milestones will appear here once added."
        />
      ) : (
        <div className="relative pl-8 max-w-2xl">
          <div className="absolute left-3 top-0 bottom-0 w-0.5" style={{ background: "var(--color-border)" }} />
          <div className="space-y-6">
            {milestones.map((m) => (
              <div key={m.id} className="relative">
                <div
                  className="absolute -left-8 top-3 w-4 h-4 rounded-full border-2 border-white"
                  style={{ background: m.color || "var(--color-primary)" }}
                />
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{m.description}</p>
                      )}
                      {m.category && (
                        <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
                          {m.category}
                        </span>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--color-text-muted)" }}>
                      {formatDate(m.date, m.date_precision)}
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
