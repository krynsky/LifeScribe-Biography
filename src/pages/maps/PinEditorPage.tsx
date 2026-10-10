import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import MapView from "@/components/maps/MapView";
import PlaceSearchBox from "@/components/maps/PlaceSearchBox";
import CategoryPicker from "@/components/forms/CategoryPicker";
import ImagePicker from "@/components/forms/ImagePicker";
import LinkedPicker from "@/components/forms/LinkedPicker";
import { getMapPin, createMapPin, updateMapPin, deleteMapPin } from "@/lib/actions/map-pins";
import { getEntityLinks, listLinkTargets, setEntityLinks, type LinkTarget } from "@/lib/actions/entity-links";
import { isValidCoordinate, parseCoordinate, shortPlaceName, type PlaceResult } from "@/lib/geocode";
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

/** Add a place, or edit one, on its own page, with a map to click and a search to find it. */
function PinFormPage({ pinId, prefill }: { pinId: number | null; prefill?: Partial<PinForm> }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<PinForm>({ ...EMPTY_FORM, ...prefill });
  const [targets, setTargets] = useState<{ stories: LinkTarget[]; albums: LinkTarget[] }>({ stories: [], albums: [] });
  const [loading, setLoading] = useState(pinId !== null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number } | null>(() => {
    const lat = parseCoordinate(prefill?.latitude ?? "");
    const lng = parseCoordinate(prefill?.longitude ?? "");
    return lat !== null && lng !== null && isValidCoordinate(lat, lng) ? { lat, lng, zoom: 12 } : null;
  });

  useEffect(() => {
    listLinkTargets().then(setTargets).catch(console.error);
    if (pinId === null) return;
    Promise.all([getMapPin(pinId), getEntityLinks("map_pin", pinId)])
      .then(([pin, links]) => {
        if (!pin) return setNotFound(true);
        setForm({
          name: pin.name,
          latitude: String(pin.latitude),
          longitude: String(pin.longitude),
          description: pin.description ?? "",
          imagePath: pin.image_path ?? null,
          categoryId: pin.category_id ?? null,
          stories: links.stories,
          albums: links.albums,
        });
        setFocus({ lat: pin.latitude, lng: pin.longitude, zoom: 12 });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pinId]);

  const change = (patch: Partial<PinForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setError(null);
  };
  const goBack = () => navigate({ to: "/maps" });

  const lat = parseCoordinate(form.latitude);
  const lng = parseCoordinate(form.longitude);
  const valid = lat !== null && lng !== null && isValidCoordinate(lat, lng);
  const draft = useMemo(() => (valid ? { lat: lat!, lng: lng! } : null), [valid, lat, lng]);
  // One marker for the place being edited; memoised so the map doesn't redraw it on every keystroke.
  const markers = useMemo(() => (draft ? ([{ id: -1, name: form.name || "This place", latitude: draft.lat, longitude: draft.lng }] as unknown as MapPin[]) : []), [draft, form.name]);

  function setCoordinates(la: number, lo: number) {
    change({ latitude: la.toFixed(5), longitude: lo.toFixed(5) });
  }

  function pickPlace(place: PlaceResult) {
    change({ latitude: place.lat.toFixed(5), longitude: place.lng.toFixed(5), name: form.name || shortPlaceName(place.name) });
    setFocus({ lat: place.lat, lng: place.lng, zoom: 13 });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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
      const saved = pinId !== null ? await updateMapPin(pinId, data) : await createMapPin(data);
      await setEntityLinks("map_pin", saved.id, { stories: form.stories, albums: form.albums });
      setDirty(false);
      goBack();
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (pinId === null || !confirm(`Remove "${form.name}"? This cannot be undone.`)) return;
    await deleteMapPin(pinId);
    goBack();
  }

  function handleCancel() {
    if (dirty && !confirm("Discard your changes?")) return;
    goBack();
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (notFound) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Place not found.</div>;

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const label = "block text-sm font-medium mb-1";

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 text-sm flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={14} />
          Maps &amp; Places
        </button>
        <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }} role="status">
          {pinId === null ? "New place" : dirty ? "Unsaved changes" : "No changes"}
        </span>
        <button type="submit" disabled={saving} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {saving ? "Saving…" : pinId === null ? "Add place" : "Save changes"}
        </button>
        {pinId !== null && (
          <button type="button" onClick={() => void handleDelete()} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "var(--color-error)" }} title="Delete place" aria-label="Delete place">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl mx-auto grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <input
                autoFocus={pinId === null && !prefill?.name}
                value={form.name}
                onChange={(e) => change({ name: e.target.value })}
                placeholder="Place name…"
                aria-label="Place name"
                className="w-full text-3xl font-bold bg-transparent border-none outline-none"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
              />
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pin-desc">Description</label>
              <textarea id="pin-desc" value={form.description} onChange={(e) => change({ description: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={field} />
            </div>
            <ImagePicker label="Image" allowGallery value={form.imagePath} onChange={(p) => change({ imagePath: p })} emptyHint="No image" />
            <CategoryPicker value={form.categoryId} onChange={(c) => change({ categoryId: c })} />
            <LinkedPicker label="Related stories" emoji="📖" options={targets.stories} value={form.stories} onChange={(ids) => change({ stories: ids })} emptyHint="No stories yet." />
            <LinkedPicker tone="album" label="Related albums" emoji="🖼️" options={targets.albums} value={form.albums} onChange={(ids) => change({ albums: ids })} emptyHint="No albums yet." />
          </div>

          <div className="space-y-4 lg:sticky lg:top-0 self-start">
            <PlaceSearchBox onPick={pickPlace} />
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--color-border)" }}>
              <MapView pins={markers} onMapClick={setCoordinates} height="340px" focus={focus} draft={draft} />
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Click the map or search to set the location, or type the coordinates.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pin-lat">Latitude *</label>
                <input id="pin-lat" inputMode="decimal" value={form.latitude} onChange={(e) => change({ latitude: e.target.value })} placeholder="41.8781" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <div>
                <label className={label} style={{ color: "var(--color-text)" }} htmlFor="pin-lng">Longitude *</label>
                <input id="pin-lng" inputMode="decimal" value={form.longitude} onChange={(e) => change({ longitude: e.target.value })} placeholder="-87.6298" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm lg:col-span-2" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
        </div>
      </div>
    </form>
  );
}

export function NewPinPage() {
  const search = useSearch({ from: "/maps/new" });
  return <PinFormPage pinId={null} prefill={{ latitude: search.lat ?? "", longitude: search.lng ?? "", name: search.name ?? "" }} />;
}

export default function PinEditorPage() {
  const { pinId } = useParams({ from: "/maps/$pinId" });
  return <PinFormPage key={pinId} pinId={Number(pinId)} />;
}
