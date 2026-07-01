import { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import AlbumGrid from "@/components/gallery/AlbumGrid";
import { getAlbum, listMedia } from "@/lib/actions/gallery";
import type { Album, Media } from "@/lib/models";

export default function ReaderAlbumPage() {
  const { albumId } = useParams({ from: "/reader/gallery/albums/$albumId" });
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
      <Link
        to="/reader/gallery"
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Gallery
      </Link>

      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        {album?.name ?? "Album"}
      </h1>

      <AlbumGrid photos={photos} />
    </div>
  );
}
