import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, MapPin as MapPinIcon, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import MapView from "@/components/maps/MapView";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, AlbumChips } from "@/components/reader/LinkedChips";
import CategoryPicker from "@/components/forms/CategoryPicker";
import ImagePicker from "@/components/forms/ImagePicker";
import LinkedPicker from "@/components/forms/LinkedPicker";
import { listMapPins, createMapPin, updateMapPin, deleteMapPin } from "@/lib/actions/map-pins";
import { getEntityLinks, listLinkTargets, setEntityLinks, type LinkTarget } from "@/lib/actions/entity-links";
import { loadMapPinLinks, type LinkContext } from "@/lib/actions/related";
import { isValidCoordinate, parseCoordinate, shortPlaceName, type PlaceResult } from "@/lib/geocode";
import { searchPlaces } from "@/lib/geocode-search";
import { imageSrc } from "@/lib/image-src";
import type { MapPin } from "@/lib/models";

interface PinForm {
  name: string;
  latitude: string;
  longitude: string;
  description: string;
  imagePath: string | null;
  categoryId: number | null;
  stories: number[];
  albums: number[];
}

const EMPTY_FORM: PinForm = { name: "", latitude: "", longitude: "", description: "", imagePath: null, categoryId: null, stories: [], albums: [] };

export default function MapsPage() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [links, setLinks] = useState<LinkContext | null>(null);
  const [targets, setTargets] = useState<{ stories: LinkTarget[]; albums: LinkTarget[] }>({ stories: [], albums: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MapPin | null>(null);
  const [form, setForm] = useState<PinForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // Place search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openEditRef = useRef<(pin: MapPin) => Promise<void>>(async () => {});

  const reload = useCallback(async () => {
    const [p, l] = await Promise.all([listMapPins(), loadMapPinLinks()]);
    setPins(p);
    setLinks(l);
  }, []);

  useEffect(() => {
    Promise.all([reload(), listLinkTargets().then(setTargets)])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reload]);

  // Debounced place search (Nominatim asks clients to go easy on requests).
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchError(null);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query));
      } catch {
        setResults([]);
        setSearchError("Place search needs an internet connection. You can still click the map or type coordinates.");
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  // Stable identity: MapView re-draws its markers whenever this callback changes.
  const handlePinClick = useCallback((pin: MapPin) => {
    void openEditRef.current(pin);
  }, []);

  function openNew(init?: Partial<PinForm>) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, ...init });
    setError(null);
    setShowModal(true);
  }

  async function openEdit(pin: MapPin) {
    const current = await getEntityLinks("map_pin", pin.id);
    setEditing(pin);
    setForm({
      name: pin.name,
      latitude: String(pin.latitude),
      longitude: String(pin.longitude),
      description: pin.description ?? "",
      imagePath: pin.image_path ?? null,
      categoryId: pin.category_id ?? null,
      stories: current.stories,
      albums: current.albums,
    });
    setError(null);
    setShowModal(true);
  }

  function handleMapClick(lat: number, lng: number) {
    openNew({ latitude: lat.toFixed(5), longitude: lng.toFixed(5) });
  }

  function pickResult(r: PlaceResult) {
    setFocus({ lat: r.lat, lng: r.lng, zoom: 13 });
    setQuery("");
    setResults([]);
    openNew({ latitude: r.lat.toFixed(5), longitude: r.lng.toFixed(5), name: shortPlaceName(r.name) });
  }

  openEditRef.current = openEdit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseCoordinate(form.latitude);
    const lng = parseCoordinate(form.longitude);
    if (!form.name.trim()) return setError("Give this place a name.");
    if (lat === null || lng === null) return setError("Enter latitude and longitude, or click the map / search for the place.");
    if (!isValidCoordinate(lat, lng)) return setError("Latitude must be between -90 and 90, and longitude between -180 and 180.");

    setSaving(true);
    setError(null);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        latitude: lat,
        longitude: lng,
        image_path: form.imagePath,
        category_id: form.categoryId,
      };
      const saved = editing ? await updateMapPin(editing.id, data) : await createMapPin(data);
      await setEntityLinks("map_pin", saved.id, { stories: form.stories, albums: form.albums });
      await reload();
      setFocus({ lat, lng, zoom: 10 });
      setShowModal(false);
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pin: MapPin) {
    if (!confirm(`Remove "${pin.name}"? This cannot be undone.`)) return;
    await deleteMapPin(pin.id);
    await reload();
  }

  const lat = parseCoordinate(form.latitude);
  const lng = parseCoordinate(form.longitude);
  const draft = useMemo(
    () => (showModal && lat !== null && lng !== null && isValidCoordinate(lat, lng) ? { lat, lng } : null),
    [showModal, lat, lng]
  );
  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

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
            <MapView pins={pins} onMapClick={handleMapClick} onPinClick={handlePinClick} height="100%" focus={focus} draft={draft} />
            {pins.length === 0 && !showModal && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] px-4 py-2.5 rounded-xl text-sm text-center shadow-md pointer-events-none" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)", maxWidth: 260 }}>
                <MapPinIcon size={16} className="inline mr-1.5 -mt-0.5" style={{ color: "var(--color-primary)" }} />
                Click the map or search to add your first place
              </div>
            )}
          </div>

          <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a place…"
                  aria-label="Search for a place"
                  className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border"
                  style={field}
                />
                {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--color-text-muted)" }} />}
              </div>
              {results.length > 0 && (
                <ul className="absolute z-[600] left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                  {results.map((r) => (
                    <li key={`${r.lat},${r.lng},${r.name}`}>
                      <button type="button" onClick={() => pickResult(r)} className="w-full text-left px-3 py-2 text-xs hover:opacity-80" style={{ color: "var(--color-text)" }}>
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchError && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{searchError}</p>}
            </div>

            {pins.map((pin) => {
              const img = imageSrc(pin.image_path) ?? imageSrc(links?.thumbnails.get(pin.id));
              return (
                <div key={pin.id} className="group rounded-xl border overflow-hidden" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                  {img && <img src={img} alt="" className="w-full h-24 object-cover" loading="lazy" />}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => setFocus({ lat: pin.latitude, lng: pin.longitude, zoom: 12 })} className="text-left min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{pin.name}</div>
                      </button>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button onClick={() => void openEdit(pin)} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit" aria-label={`Edit ${pin.name}`}>
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
                    <StoryChips items={links?.stories.get(pin.id)} />
                    <AlbumChips items={links?.albums.get(pin.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Place" : "Add Place"} maxWidth="560px">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Tip: close this window and click the map (or search for a place) to fill in the coordinates automatically.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="pin-name">Name *</label>
            <input id="pin-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Place name" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="pin-lat">Latitude *</label>
              <input id="pin-lat" inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="41.8781" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="pin-lng">Longitude *</label>
              <input id="pin-lng" inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-87.6298" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="pin-desc">Description</label>
            <textarea id="pin-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={field} />
          </div>
          <ImagePicker label="Image" allowGallery value={form.imagePath} onChange={(p) => setForm({ ...form, imagePath: p })} emptyHint="No image" />
          <CategoryPicker value={form.categoryId} onChange={(c) => setForm({ ...form, categoryId: c })} />
          <LinkedPicker label="Related stories" emoji="📖" options={targets.stories} value={form.stories} onChange={(ids) => setForm({ ...form, stories: ids })} emptyHint="No stories yet." />
          <LinkedPicker tone="album" label="Related albums" emoji="🖼️" options={targets.albums} value={form.albums} onChange={(ids) => setForm({ ...form, albums: ids })} emptyHint="No albums yet." />

          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Place"}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
