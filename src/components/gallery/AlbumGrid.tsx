import { useEffect, useState } from "react";
import { Image, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { imageSrc } from "@/lib/image-src";
import type { Media } from "@/lib/models";

interface AlbumGridProps {
  photos: Media[];
  emptyMessage?: string;
  /** Per-photo controls drawn over the tile (edit mode: caption, cover, delete). */
  renderActions?: (photo: Media) => React.ReactNode;
  /** Photo to mark with a "Cover" badge. */
  coverMediaId?: number | null;
}

export default function AlbumGrid({ photos, emptyMessage = "No photos in this album.", renderActions, coverMediaId }: AlbumGridProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (lightboxIdx === null) return;
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i === null || i === 0 ? photos.length - 1 : i - 1));
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null ? 0 : (i + 1) % photos.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, photos.length]);

  const lightboxPhoto = lightboxIdx !== null ? photos[lightboxIdx] : null;

  if (photos.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <div key={photo.id} className="relative group">
          <button
            onClick={() => setLightboxIdx(idx)}
            aria-label={`View ${photo.title ?? photo.filename}`}
            className="relative w-full aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
          >
            {imageSrc(photo.thumbnail_path ?? (photo.source_url ? null : photo.file_path)) ? (
              <img
                src={imageSrc(photo.thumbnail_path ?? photo.file_path)!}
                alt={photo.title ?? photo.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image size={20} style={{ color: "var(--color-text-muted)" }} />
              </div>
            )}
            {photo.source_url && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span
                  className="flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <Play size={18} fill="white" style={{ color: "white" }} />
                </span>
              </span>
            )}
            {coverMediaId === photo.id && (
              <span className="absolute left-1.5 top-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ background: "var(--color-primary)" }}>
                Cover
              </span>
            )}
          </button>
          {renderActions && (
            <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {renderActions(photo)}
            </div>
          )}
          {photo.caption && renderActions && (
            <div className="absolute left-0 right-0 bottom-0 px-2 py-1 text-[11px] truncate rounded-b-lg text-white" style={{ background: "rgba(0,0,0,0.5)" }}>
              {photo.caption}
            </div>
          )}
          </div>
        ))}
      </div>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
          >
            <X size={18} />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null || i === 0 ? photos.length - 1 : i - 1)); }}
          >
            <ChevronLeft size={22} />
          </button>

          <div className="max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {lightboxPhoto.source_url ? (
              <iframe
                src={lightboxPhoto.source_url}
                title={lightboxPhoto.title ?? lightboxPhoto.filename}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-lg"
                style={{ width: "min(90vw, 960px)", aspectRatio: "16 / 9", border: 0 }}
              />
            ) : (
              <img
                src={imageSrc(lightboxPhoto.file_path) ?? ""}
                alt={lightboxPhoto.title ?? lightboxPhoto.filename}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            )}
            {(lightboxPhoto.title || lightboxPhoto.caption) && (
              <div className="mt-3 text-center">
                {lightboxPhoto.title && (
                  <div className="font-medium text-sm" style={{ color: "white" }}>{lightboxPhoto.title}</div>
                )}
                {lightboxPhoto.caption && (
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>{lightboxPhoto.caption}</div>
                )}
              </div>
            )}
            <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              {(lightboxIdx ?? 0) + 1} / {photos.length}
            </div>
          </div>

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null ? 0 : (i + 1) % photos.length)); }}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </>
  );
}
