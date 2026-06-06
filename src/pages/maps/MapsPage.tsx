import { useEffect, useState } from "react";
import { Plus, MapPin } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { listMapPins } from "@/lib/actions/map-pins";
import type { MapPin as MapPinType } from "@/lib/models";

export default function MapsPage() {
  const [pins, setPins] = useState<MapPinType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMapPins().then(setPins).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 flex flex-col h-full">
      <PageHeader
        title="Maps & Places"
        subtitle="The places that were part of your story"
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            <Plus size={14} />
            Add Place
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : pins.length === 0 ? (
        <EmptyState
          icon={<MapPin size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No places yet"
          description="Mark the homes, cities, and destinations that were part of your life."
        />
      ) : (
        <div
          className="flex-1 rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
        >
          {/* Leaflet map rendered in U5 */}
          <div className="flex items-center justify-center h-64 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Map with {pins.length} pin{pins.length !== 1 ? "s" : ""} — Leaflet integration in U5
          </div>
        </div>
      )}
    </div>
  );
}
