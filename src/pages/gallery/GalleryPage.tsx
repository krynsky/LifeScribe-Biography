import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Image } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { listAlbums } from "@/lib/actions/gallery";
import { localFileUrl } from "@/lib/db";
import type { Album } from "@/lib/models";

export default function GalleryPage() {
  const [albums, setAlbums] = useState<(Album & { media_count: number; cover_path: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAlbums().then(setAlbums).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <PageHeader
        title="Gallery"
        subtitle="Photos organized into albums"
        actions={
          <Link
            to="/import/photos"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            <Plus size={14} />
            Import Photos
          </Link>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : albums.length === 0 ? (
        <EmptyState
          icon={<Image size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No photos yet"
          description="Import photos from your computer to build your visual story."
          action={
            <Link
              to="/import/photos"
              className="px-4 py-2 rounded-lg text-sm text-white"
              style={{ background: "var(--color-primary)" }}
            >
              Import Photos
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              to="/gallery/albums/$albumId"
              params={{ albumId: String(album.id) }}
              className="block rounded-xl overflow-hidden border hover:shadow-md transition-shadow"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
            >
              <div
                className="aspect-video flex items-center justify-center overflow-hidden"
                style={{ background: "var(--color-surface-2)" }}
              >
                {album.cover_path ? (
                  <img
                    src={localFileUrl(album.cover_path)}
                    alt={album.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image size={32} style={{ color: "var(--color-text-muted)" }} />
                )}
              </div>
              <div className="p-3">
                <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
                  {album.name}
                </div>
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
