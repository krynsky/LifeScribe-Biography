import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Image, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getAlbum, listMedia } from "@/lib/actions/gallery";
import { localFileUrl } from "@/lib/db";
import type { Album, Media } from "@/lib/models";

export default function AlbumPage() {
  const { albumId } = useParams({ from: "/gallery/albums/$albumId" });
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    const id = Number(albumId);
    Promise.all([getAlbum(id), listMedia({ album_id: id })]).then(([a, m]) => {
      setAlbum(a);
      setPhotos(m);
    });
  }, [albumId]);

  // Lightbox keyboard nav
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

  return (
    <div className="p-8">
      <button
        onClick={() => navigate({ to: "/gallery" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Gallery
      </button>

      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {album?.name ?? "Album"}
      </h1>

      {photos.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>No photos in this album.</div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {photos.map((photo, idx) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIdx(idx)}
              className="aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
            >
              {photo.thumbnail_path ? (
                <img
                  src={localFileUrl(photo.thumbnail_path)}
                  alt={photo.title ?? photo.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image size={20} style={{ color: "var(--color-text-muted)" }} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.9)" }}
          onClick={() => setLightboxIdx(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
          >
            <X size={18} />
          </button>

          {/* Prev */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null || i === 0 ? photos.length - 1 : i - 1)); }}
          >
            <ChevronLeft size={22} />
          </button>

          {/* Image */}
          <div className="max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={localFileUrl(lightboxPhoto.file_path)}
              alt={lightboxPhoto.title ?? lightboxPhoto.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
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

          {/* Next */}
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i === null ? 0 : (i + 1) % photos.length)); }}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
