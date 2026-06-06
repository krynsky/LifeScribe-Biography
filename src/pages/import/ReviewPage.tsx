// Full implementation in U7
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Star } from "lucide-react";
import { listImportItems, getPendingReviewCount } from "@/lib/actions/import";
import type { ImportItem } from "@/lib/models";

export default function ReviewPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    Promise.all([
      listImportItems({ status: "pending_review" }),
      getPendingReviewCount(),
    ]).then(([items, count]) => {
      setItems(items);
      setCount(count);
    });
  }, []);

  return (
    <div className="p-8">
      <button
        onClick={() => navigate({ to: "/import" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Import Hub
      </button>
      <h1
        className="text-2xl mb-2"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
      >
        Review Suggestions
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
        {count > 0
          ? `${count} item${count !== 1 ? "s" : ""} waiting for your review`
          : "No items pending review"}
      </p>

      {items.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <Star size={28} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            AI curation review screen — implemented in U7
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs px-2 py-0.5 rounded-full uppercase"
                  style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
                >
                  {item.item_type}
                </span>
                <div className="flex gap-2">
                  <button className="text-xs px-2 py-1 rounded text-white" style={{ background: "var(--color-success)" }}>Accept</button>
                  <button className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--color-error)", color: "var(--color-error)" }}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
