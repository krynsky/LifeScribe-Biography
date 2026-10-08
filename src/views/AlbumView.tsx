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
    <ReadPage>
      <Link to="/gallery" className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        ← Gallery
      </Link>
      <h1 className="text-3xl mt-3 mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {album?.name ?? "Album"}
      </h1>
      {album?.description && (
        <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
          {album.description}
        </p>
      )}
      <div className={album?.description ? "" : "mt-6"}>
        <AlbumGrid photos={photos} />
      </div>
    </ReadPage>
  );
}
