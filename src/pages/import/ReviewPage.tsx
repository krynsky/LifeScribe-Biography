import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Star, CheckCircle, XCircle,
  Loader2, Clock, Briefcase, MapPin, BookOpen
} from "lucide-react";
import { listImportItems, updateImportItemStatus } from "@/lib/actions/import";
import { createStory } from "@/lib/actions/stories";
import { createMilestone } from "@/lib/actions/milestones";
import { createCareerEntry } from "@/lib/actions/career";
import { createMapPin } from "@/lib/actions/map-pins";
import type {
  ImportItem, ImportItemType,
  ImportStoryContent, ImportMilestoneContent,
  ImportCareerContent, ImportMapPinContent,
} from "@/lib/models";

// ── Type helpers ─────────────────────────────────────────────────────────

const TYPE_META: Record<ImportItemType, { label: string; color: string; Icon: React.ElementType }> = {
  story:     { label: "Story",     color: "var(--color-primary)",    Icon: BookOpen },
  milestone: { label: "Milestone", color: "#7C5CBF",                 Icon: Clock    },
  career:    { label: "Career",    color: "var(--color-accent-dark)", Icon: Briefcase},
  map_pin:   { label: "Place",     color: "#2E7D32",                 Icon: MapPin   },
  media:     { label: "Media",     color: "var(--color-text-muted)",  Icon: Star     },
  album:     { label: "Album",     color: "var(--color-text-muted)",  Icon: Star     },
};

function parseContent<T>(item: ImportItem): T {
  try { return JSON.parse(item.content) as T; } catch { return {} as T; }
}

function ContentPreview({ item }: { item: ImportItem }) {
  const type = item.item_type;

  if (type === "story") {
    const c = parseContent<ImportStoryContent>(item);
    return (
      <div>
        <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>{c.title ?? "—"}</div>
        {c.excerpt && <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{c.excerpt}</div>}
        {c.event_date && <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>Date: {c.event_date}</div>}
      </div>
    );
  }
  if (type === "milestone") {
    const c = parseContent<ImportMilestoneContent>(item);
    return (
      <div>
        <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>{c.title ?? "—"}</div>
        {c.description && <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{c.description}</div>}
        <div className="flex gap-3 text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          {c.date && <span>Date: {c.date}</span>}
          {c.category && <span>Category: {c.category}</span>}
        </div>
      </div>
    );
  }
  if (type === "career") {
    const c = parseContent<ImportCareerContent>(item);
    return (
      <div>
        <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>
          {c.title ? `${c.title} @ ${c.organization}` : c.organization ?? "—"}
        </div>
        <div className="flex gap-3 text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          <span className="capitalize">{c.entry_type}</span>
          {c.start_date && <span>{c.start_date}{c.is_current ? " – Present" : c.end_date ? ` – ${c.end_date}` : ""}</span>}
          {c.location && <span>{c.location}</span>}
        </div>
      </div>
    );
  }
  if (type === "map_pin") {
    const c = parseContent<ImportMapPinContent>(item);
    return (
      <div>
        <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>{c.name ?? "—"}</div>
        {c.address && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{c.address}</div>}
        {c.description && <div className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{c.description}</div>}
      </div>
    );
  }
  return <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{item.content.substring(0, 120)}</div>;
}

// ── Accept logic ─────────────────────────────────────────────────────────

async function acceptItem(item: ImportItem): Promise<void> {
  if (item.item_type === "story") {
    const c = parseContent<ImportStoryContent>(item);
    await createStory({
      title: c.title ?? "Untitled Story",
      content: c.content ?? null,
      excerpt: c.excerpt ?? undefined,
      event_date: c.event_date ?? undefined,
      event_date_precision: c.event_date_precision ?? "day",
    });
  } else if (item.item_type === "milestone") {
    const c = parseContent<ImportMilestoneContent>(item);
    await createMilestone({
      title: c.title ?? "Untitled",
      description: c.description ?? undefined,
      date: c.date ?? new Date().toISOString().substring(0, 10),
      date_precision: c.date_precision ?? "day",
      category: c.category ?? undefined,
    });
  } else if (item.item_type === "career") {
    const c = parseContent<ImportCareerContent>(item);
    await createCareerEntry({
      entry_type: c.entry_type ?? "job",
      organization: c.organization ?? "Unknown",
      title: c.title ?? undefined,
      description: c.description ?? undefined,
      start_date: c.start_date ?? undefined,
      end_date: c.end_date ?? undefined,
      is_current: c.is_current ?? false,
      location: c.location ?? undefined,
    });
  } else if (item.item_type === "map_pin") {
    const c = parseContent<ImportMapPinContent>(item);
    await createMapPin({
      name: c.name ?? "Unnamed place",
      description: c.description ?? undefined,
      latitude: c.latitude ?? 0,
      longitude: c.longitude ?? 0,
      address: c.address ?? undefined,
      visit_date: c.visit_date ?? undefined,
    });
  }
  await updateImportItemStatus(item.id, "accepted");
}

// ── Component ─────────────────────────────────────────────────────────────

type FilterType = "all" | ImportItemType;

export default function ReviewPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    const all = await listImportItems({ status: "pending_review" });
    setItems(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleAccept(item: ImportItem) {
    try {
      await acceptItem(item);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error("Accept failed:", err);
    }
  }

  async function handleReject(item: ImportItem) {
    await updateImportItemStatus(item.id, "rejected");
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  const filtered = filter === "all" ? items : items.filter((i) => i.item_type === filter);

  const counts: Partial<Record<ImportItemType, number>> = {};
  for (const item of items) counts[item.item_type] = (counts[item.item_type] ?? 0) + 1;

  const FILTER_TYPES: FilterType[] = ["all", "story", "milestone", "career", "map_pin"];

  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => navigate({ to: "/import" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} /> Import Hub
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Review Imported Items
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {items.length > 0
              ? `${items.length} item${items.length !== 1 ? "s" : ""} waiting for review`
              : "Nothing waiting for review"}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      {items.length > 0 && (
        <div className="flex gap-1 mb-5 flex-wrap">
          {FILTER_TYPES.map((t) => {
            const count = t === "all" ? items.length : (counts[t as ImportItemType] ?? 0);
            if (t !== "all" && count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: filter === t ? "var(--color-primary)" : "var(--color-surface-2)",
                  color: filter === t ? "white" : "var(--color-text-secondary)",
                }}
              >
                {t === "all" ? "All" : TYPE_META[t as ImportItemType]?.label ?? t} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Items list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm py-8" style={{ color: "var(--color-text-muted)" }}>
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <Star size={28} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
          <div className="font-medium text-sm mb-1" style={{ color: "var(--color-text)" }}>
            {items.length === 0 ? "Nothing to review yet" : "No items match this filter"}
          </div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Import a social media archive and its stories, milestones and career entries will show up here for you to accept.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const meta = TYPE_META[item.item_type] ?? TYPE_META.media;
            const Icon = meta.Icon;
            const conf = item.ai_confidence != null ? Math.round(item.ai_confidence * 100) : null;
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: `${meta.color}18` }}
                  >
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      {conf !== null && (
                        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                          {conf}% confidence
                        </span>
                      )}
                    </div>
                    <ContentPreview item={item} />
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white font-medium"
                      style={{ background: "var(--color-primary)" }}
                      title="Accept — adds to your biography"
                    >
                      <CheckCircle size={12} /> Accept
                    </button>
                    <button
                      onClick={() => handleReject(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: "var(--color-error)", color: "var(--color-error)" }}
                      title="Reject"
                    >
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk actions */}
      {filtered.length > 1 && (
        <div className="flex gap-3 mt-5 pt-5 border-t" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={async () => { for (const item of filtered) await handleAccept(item); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white"
            style={{ background: "var(--color-primary)" }}
          >
            <CheckCircle size={13} /> Accept All Visible
          </button>
          <button
            onClick={async () => { for (const item of filtered) await handleReject(item); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-error)", color: "var(--color-error)" }}
          >
            <XCircle size={13} /> Reject All Visible
          </button>
        </div>
      )}
    </div>
  );
}
