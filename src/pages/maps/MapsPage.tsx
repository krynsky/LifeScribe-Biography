import { useEffect, useState } from "react";
import { Plus, MapPin as MapPinIcon, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import MapView from "@/components/maps/MapView";
import { listMapPins, createMapPin, deleteMapPin } from "@/lib/actions/map-pins";
import type { MapPin } from "@/lib/models";

interface NewPinForm {
  lat: number;
  lng: number;
  name: string;
  description: string;
}

export default function MapsPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPin, setNewPin] = useState<NewPinForm | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    listMapPins().then(setPins).catch(console.error).finally(() => setLoading(false));
  }, []);

  function handleMapClick(lat: number, lng: number) {
    setNewPin({ lat, lng, name: "", description: "" });
  }

  async function handleCreatePin(e: React.FormEvent) {
    e.preventDefault();
    if (!newPin?.name.trim()) return;
    const pin = await createMapPin({
      name: newPin.name,
      description: newPin.description || undefined,
      latitude: newPin.lat,
      longitude: newPin.lng,
    });
    setPins((prev) => [pin, ...prev]);
    setNewPin(null);
  }

  async function handleDeletePin(pin: MapPin) {
    if (!confirm(`Remove "${pin.name}"?`)) return;
    await deleteMapPin(pin.id);
    setPins((prev) => prev.filter((p) => p.id !== pin.id));
    setSelectedPin(null);
  }

  return (
    <div className="p-8 flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
      <PageHeader
        title="Maps & Places"
        subtitle="The places that were part of your story"
        actions={
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Click on the map to add a pin
          </span>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Map */}
          <div className="flex-1 min-h-0 relative">
            <MapView
              pins={pins}
              onMapClick={handleMapClick}
              onPinClick={setSelectedPin}
              height="100%"
            />
            {/* Empty-state hint overlay when there are no pins */}
            {pins.length === 0 && !newPin && (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2.5 rounded-xl text-sm text-center shadow-md pointer-events-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                  maxWidth: "240px",
                }}
              >
                <MapPinIcon size={16} className="inline mr-1.5 -mt-0.5" style={{ color: "var(--color-primary)" }} />
                Click anywhere on the map to add a place
              </div>
            )}
          </div>

          {/* Sidebar — pin list or add form */}
          <div
            className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto"
          >
            {/* New pin form */}
            {newPin && (
              <form
                onSubmit={handleCreatePin}
                className="p-4 rounded-xl border"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-primary)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    New Place
                  </span>
                  <button type="button" onClick={() => setNewPin(null)}>
                    <X size={14} style={{ color: "var(--color-text-muted)" }} />
                  </button>
                </div>
                <div className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
                  {newPin.lat.toFixed(4)}, {newPin.lng.toFixed(4)}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={newPin.name}
                  onChange={(e) => setNewPin({ ...newPin, name: e.target.value })}
                  placeholder="Place name"
                  className="w-full px-3 py-2 rounded-lg border text-sm mb-2"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
                <textarea
                  value={newPin.description}
                  onChange={(e) => setNewPin({ ...newPin, description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border text-sm mb-3 resize-none"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
                <button
                  type="submit"
                  disabled={!newPin.name.trim()}
                  className="w-full py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
                  style={{ background: "var(--color-primary)" }}
                >
                  Add Place
                </button>
              </form>
            )}

            {/* Pin list */}
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
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <MapPinIcon size={14} className="mt-0.5 flex-shrink-0" style={{ color: pin.color || "var(--color-primary)" }} />
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                        {pin.name}
                      </div>
                      {pin.description && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                          {pin.description}
                        </div>
                      )}
                      <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePin(pin); }}
                    className="flex-shrink-0"
                  >
                    <X size={12} style={{ color: "var(--color-text-muted)" }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
