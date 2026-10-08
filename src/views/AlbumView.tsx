import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import AlbumGrid from "@/components/gallery/AlbumGrid";
import ReadPage from "@/components/reader/ReadPage";
import { getAlbum, listMedia } from "@/lib/actions/gallery";
import type { Album, Media } from "@/lib/models";

export default function AlbumView() {
  const { albumId } = useParams({ from: "/gallery/albums/$albumId" });
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);

  useEffect(() => {
    const id = Number(albumId);
    Promise.all([getAlbum(id), listMedia({ album_id: id })])
      .then(([a, m]) => {
        setAlbum(a);
        setPhotos(m);
      })
      .catch(console.error);
  }, [albumId]);

  return (
    <ReadPage width="full">
      <div className="mb-8">
        <Link to="/gallery" className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          ← Gallery
        </Link>
        <h1 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
          {album?.name ?? "Album"}
        </h1>
        {album?.description && (
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {album.description}
          </p>
        )}
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {photos.length === 0 ? "No media yet." : `${photos.length} item${photos.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <AlbumGrid photos={photos} emptyMessage="No media has been added to this album yet." />
    </ReadPage>
  );
}
