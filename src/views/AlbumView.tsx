import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import AlbumGrid from "@/components/gallery/AlbumGrid";
import ReadPage from "@/components/reader/ReadPage";
import CategoryChip, { TagList } from "@/components/reader/CategoryChip";
import { parseTags } from "@/lib/reader-utils";
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
      <div className="mt-3">
        <CategoryChip name={album?.category} color={album?.category_color} icon={album?.category_icon} />
      </div>
      <h1 className="text-3xl mt-2 mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {album?.name ?? "Album"}
      </h1>
      {album?.description && (
        <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
          {album.description}
        </p>
      )}
      {parseTags(album?.tags).length > 0 && (
        <div className="mb-4">
          <TagList tags={parseTags(album?.tags)} />
        </div>
      )}
      <div className={album?.description ? "" : "mt-6"}>
        <AlbumGrid photos={photos} />
      </div>
    </ReadPage>
  );
}
