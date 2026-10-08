import { useEffect, useState } from "react";
import MapView from "@/components/maps/MapView";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { listMapPins } from "@/lib/actions/map-pins";
import { formatDisplayDate } from "@/lib/reader-utils";
import type { MapPin } from "@/lib/models";

export default function MapsView() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    listMapPins().then(setPins).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  return (
    <ReadPage title="Places" subtitle="Significant locations from a lifetime of experiences">
      <div className="rounded-xl overflow-hidden border mb-8" style={{ borderColor: "var(--color-border)" }}>
        <MapView pins={pins} onPinClick={setSelectedPin} height="420px" />
      </div>

      {pins.length > 0 && (
        <>
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            All Locations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                onClick={() => setSelectedPin(pin)}
                className="text-left p-4 rounded-xl border transition-shadow hover:shadow-md"
                style={{
                  background: "var(--color-surface)",
                  borderColor: selectedPin?.id === pin.id ? "var(--color-primary)" : "var(--color-border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                  {pin.name}
                </div>
                {pin.address && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{pin.address}</div>
                )}
                {pin.visit_date && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {formatDisplayDate(pin.visit_date, "month")}
                  </div>
                )}
                {pin.description && (
                  <p className="text-xs mt-2 line-clamp-3" style={{ color: "var(--color-text-secondary)" }}>
                    {pin.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </ReadPage>
  );
}
