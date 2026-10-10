import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, MapPin as MapPinIcon, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import MapView from "@/components/maps/MapView";
import PlaceSearchBox from "@/components/maps/PlaceSearchBox";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, AlbumChips } from "@/components/reader/LinkedChips";
import { listMapPins, deleteMapPin } from "@/lib/actions/map-pins";
import { loadMapPinLinks, type LinkContext } from "@/lib/actions/related";
import { shortPlaceName, type PlaceResult } from "@/lib/geocode";
import { imageSrc } from "@/lib/image-src";
import type { MapPin } from "@/lib/models";

export default function MapsPage() {
  const navigate = useNavigate();
  const [pins, setPins] = useState<MapPin[]>([]);
  const [links, setLinks] = useState<LinkContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  const reload = useCallback(async () => {
    const [p, l] = await Promise.all([listMapPins(), loadMapPinLinks()]);
    setPins(p);
    setLinks(l);
  }, []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  const openNew = (init?: { lat?: string; lng?: string; name?: string }) => navigate({ to: "/maps/new", search: { lat: init?.lat, lng: init?.lng, name: init?.name } });
  const openEdit = useCallback((pin: MapPin) => navigate({ to: "/maps/$pinId", params: { pinId: String(pin.id) } }), [navigate]);

  // Stable identity: MapView re-draws its markers whenever this callback changes.
  const handlePinClick = openEdit;

  const handleMapClick = (lat: number, lng: number) => openNew({ lat: lat.toFixed(5), lng: lng.toFixed(5) });

  function pickResult(r: PlaceResult) {
    setFocus({ lat: r.lat, lng: r.lng, zoom: 13 });
    openNew({ lat: r.lat.toFixed(5), lng: r.lng.toFixed(5), name: shortPlaceName(r.name) });
  }

  async function handleDelete(pin: MapPin) {
    if (!confirm(`Remove "${pin.name}"? This cannot be undone.`)) return;
    await deleteMapPin(pin.id);
    await reload();
  }

  return (
    <div className="p-8 flex flex-col" style={{ height: "calc(100vh - 0px)" }}>
      <PageHeader
        title="Maps & Places"
        subtitle="The places that were part of your story"
        actions={
          <button onClick={() => openNew()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} />
            Add Pin Manually
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="flex-1 min-h-0 relative">
            <MapView pins={pins} onMapClick={handleMapClick} onPinClick={handlePinClick} height="100%" focus={focus} />
            {pins.length === 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] px-4 py-2.5 rounded-xl text-sm text-center shadow-md pointer-events-none" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", maxWidth: 260 }}>
                <MapPinIcon size={16} className="inline mr-1.5 -mt-0.5" style={{ color: "var(--color-primary)" }} />
                Click the map or search to add your first place
              </div>
            )}
          </div>

          <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            <PlaceSearchBox onPick={pickResult} />

            {pins.map((pin) => {
              const img = imageSrc(pin.image_path) ?? imageSrc(links?.thumbnails.get(pin.id));
              return (
                <div key={pin.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button")) openEdit(pin); }} className="group cursor-pointer rounded-xl border overflow-hidden" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                  {img && <img src={img} alt="" className="w-full h-24 object-cover" loading="lazy" />}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => setFocus({ lat: pin.latitude, lng: pin.longitude, zoom: 12 })} className="text-left min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{pin.name}</div>
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(pin)} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit" aria-label={`Edit ${pin.name}`}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => void handleDelete(pin)} className="p-1 rounded" style={{ color: "var(--color-error)" }} title="Delete" aria-label={`Delete ${pin.name}`}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1"><CategoryChip variant="solid" name={pin.category} color={pin.category_color} icon={pin.category_icon} /></div>
                    {pin.description && <div className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{pin.description}</div>}
                    <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}</div>
                    <StoryChips compact items={links?.stories.get(pin.id)} />
                    <AlbumChips compact items={links?.albums.get(pin.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
