import { useEffect, useState } from "react";
import MapView from "@/components/maps/MapView";
import { listMapPins } from "@/lib/actions/map-pins";
import type { MapPin } from "@/lib/models";

export default function ReaderMapsPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    listMapPins().then(setPins).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
      <h1 className="text-2xl mb-6 flex-shrink-0" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Maps &amp; Places
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 min-h-0 relative">
            <MapView pins={pins} onPinClick={setSelectedPin} height="100%" />
          </div>
          <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            {pins.map((pin) => (
              <div
                key={pin.id}
                className="p-3 rounded-xl border cursor-pointer"
                style={{
                  background: "var(--color-surface)",
                  borderColor: selectedPin?.id === pin.id ? "var(--color-primary)" : "var(--color-border)",
                  boxShadow: "var(--shadow-card)",
                }}
                onClick={() => setSelectedPin(pin)}
              >
                <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{pin.name}</div>
                {pin.description && (
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{pin.description}</div>
                )}
                <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
