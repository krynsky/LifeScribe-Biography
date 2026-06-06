import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Image } from "lucide-react";
import { getAlbum, listMedia } from "@/lib/actions/gallery";
import { localFileUrl } from "@/lib/db";
import type { Album, Media } from "@/lib/models";

export default function AlbumPage() {
  const { albumId } = useParams({ from: "/gallery/albums/$albumId" });
  const navigate = useNavigate();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);

  useEffect(() => {
    const id = Number(albumId);
    Promise.all([getAlbum(id), listMedia({ album_id: id })]).then(([a, m]) => {
      setAlbum(a);
      setPhotos(m);
    });
  }, [albumId]);

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

      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
      >
        {album?.name ?? "Album"}
      </h1>

      {photos.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>No photos in this album.</div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="aspect-square rounded-lg overflow-hidden border"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
