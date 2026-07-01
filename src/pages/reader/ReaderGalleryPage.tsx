import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Image } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listAlbums } from "@/lib/actions/gallery";
import { localFileUrl } from "@/lib/db";
import type { Album } from "@/lib/models";

export default function ReaderGalleryPage() {
  const [albums, setAlbums] = useState<(Album & { media_count: number; cover_path: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAlbums().then(setAlbums).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Gallery
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : albums.length === 0 ? (
        <EmptyState
          icon={<Image size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No photos yet"
          description="Photo albums will appear here once added."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              to="/reader/gallery/albums/$albumId"
              params={{ albumId: String(album.id) }}
              className="block rounded-xl overflow-hidden border hover:shadow-md transition-shadow"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div className="aspect-video flex items-center justify-center overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                {album.cover_path ? (
                  <img src={localFileUrl(album.cover_path)} alt={album.name} className="w-full h-full object-cover" />
                ) : (
                  <Image size={32} style={{ color: "var(--color-text-muted)" }} />
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{album.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {album.media_count} photo{album.media_count !== 1 ? "s" : ""}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
