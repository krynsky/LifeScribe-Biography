import { useEffect, useState } from "react";
import MapView from "@/components/maps/MapView";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { listMapPins } from "@/lib/actions/map-pins";
import { formatDisplayDate } from "@/lib/reader-utils";
import { imageSrc } from "@/lib/image-src";
import CategoryChip from "@/components/reader/CategoryChip";
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
            {pins.map((pin) => {
              const img = imageSrc(pin.image_path);
              return (
              <button
                key={pin.id}
                type="button"
                onClick={() => setSelectedPin(pin)}
                className="text-left rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                style={{
                  background: "var(--color-surface)",
                  borderColor: selectedPin?.id === pin.id ? "var(--color-primary)" : "var(--color-border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {img && <img src={img} alt="" className="w-full h-36 object-cover" loading="lazy" />}
                <div className="p-4">
                <div className="mb-1.5">
                  <CategoryChip name={pin.category} color={pin.category_color} icon={pin.category_icon} />
                </div>
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
                </div>
              </button>
              );
            })}
          </div>
        </>
      )}
    </ReadPage>
  );
}
