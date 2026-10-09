import { useEffect, useState } from "react";
import { MapPin as MapPinIcon, X } from "lucide-react";
import MapView from "@/components/maps/MapView";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { Link } from "@tanstack/react-router";
import { listMapPins } from "@/lib/actions/map-pins";
import { imageSrc } from "@/lib/image-src";
import { loadMapPinLinks, type LinkContext } from "@/lib/actions/related";
import type { MapPin } from "@/lib/models";

const CHIP = "inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs";
const STORY_STYLE = { borderColor: "var(--color-accent)", background: "var(--color-surface-2)", color: "var(--color-primary)" } as const;
const ALBUM_STYLE = { borderColor: "#d1fae5", background: "#ecfdf5", color: "#059669" } as const;

export default function MapsView() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [links, setLinks] = useState<LinkContext | null>(null);

  useEffect(() => {
    Promise.all([listMapPins(), loadMapPinLinks()])
      .then(([p, l]) => {
        setPins(p);
        setLinks(l);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  const detailImg = selected ? imageSrc(selected.image_path) ?? imageSrc(links?.thumbnails.get(selected.id)) : null;

  return (
    <ReadPage title="Places" subtitle="Significant locations from a lifetime of experiences." width="full">
      {pins.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed py-20 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <p className="text-4xl">📍</p>
          <p className="mt-3 font-medium">No locations pinned yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: "var(--color-border)" }}>
            <MapView pins={pins} onPinClick={setSelected} height="520px" />
            {selected && (
              <div className="absolute bottom-4 left-4 right-4 z-[1000] overflow-hidden rounded-xl bg-white shadow-xl sm:left-auto sm:w-80">
                {detailImg && <img src={detailImg} alt={selected.name} className="h-32 w-full object-cover" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPinIcon size={16} className="shrink-0" style={{ color: "var(--color-primary)" }} />
                      <h3 className="font-semibold" style={{ color: "var(--color-text)" }}>{selected.name}</h3>
                    </div>
                    <button type="button" onClick={() => setSelected(null)} aria-label="Close" style={{ color: "var(--color-text-muted)" }}>
                      <X size={16} />
                    </button>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                  </p>
                  {selected.description && (
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{selected.description}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>All Locations</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pins.map((pin) => {
                const img = imageSrc(pin.image_path) ?? imageSrc(links?.thumbnails.get(pin.id));
                const stories = links?.stories.get(pin.id) ?? [];
                const albums = links?.albums.get(pin.id) ?? [];
                return (
                  <div
                    key={pin.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(pin)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelected(pin);
                    }}
                    className="flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-colors"
                    style={{
                      background: selected?.id === pin.id ? "var(--color-surface-2)" : "var(--color-surface)",
                      borderColor: selected?.id === pin.id ? "var(--color-accent)" : "var(--color-border-light)",
                    }}
                  >
                    {img ? (
                      <img src={img} alt="" className="h-36 w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center" style={{ background: "var(--color-surface-2)" }}>
                        <MapPinIcon size={40} style={{ color: "var(--color-primary)" }} />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-center gap-2">
                        <MapPinIcon size={16} className="shrink-0" style={{ color: "var(--color-primary)" }} />
                        <span className="font-medium" style={{ color: "var(--color-text)" }}>{pin.name}</span>
                      </div>
                      {pin.description && (
                        <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>{pin.description}</p>
                      )}
                      {(stories.length > 0 || albums.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {stories.map((st) => (
                            <Link
                              key={st.id}
                              to="/stories/$storyId"
                              params={{ storyId: String(st.id) }}
                              onClick={(e) => e.stopPropagation()}
                              className={CHIP}
                              style={STORY_STYLE}
                            >
                              📖 {st.title}
                            </Link>
                          ))}
                          {albums.map((a) => (
                            <Link
                              key={a.id}
                              to="/gallery/albums/$albumId"
                              params={{ albumId: String(a.id) }}
                              onClick={(e) => e.stopPropagation()}
                              className={CHIP}
                              style={ALBUM_STYLE}
                            >
                              🖼️ {a.title}
                            </Link>
                          ))}
                        </div>
                      )}
                      <p className="mt-auto pt-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ReadPage>
  );
}
