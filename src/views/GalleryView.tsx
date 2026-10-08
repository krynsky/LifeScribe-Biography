import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Image } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { listAlbums } from "@/lib/actions/gallery";
import { imageSrc } from "@/lib/image-src";
import type { Album } from "@/lib/models";

type AlbumRow = Album & { media_count: number; cover_path: string | null };

export default function GalleryView() {
  const [albums, setAlbums] = useState<AlbumRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAlbums().then(setAlbums).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  const total = albums.reduce((n, a) => n + a.media_count, 0);

  return (
    <ReadPage
      title="Photo Gallery"
      subtitle={`${total} ${total === 1 ? "photo" : "photos"} across ${albums.length} ${albums.length === 1 ? "album" : "albums"}`}
    >
      {albums.length === 0 ? (
        <EmptyState
          icon={<Image size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No photos yet"
          description="Photo albums will appear here once added."
        />
      ) : (
        <>
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Albums
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {albums.map((album) => {
              const cover = imageSrc(album.cover_path) ?? imageSrc(album.cover_image);
              return (
                <Link
                  key={album.id}
                  to="/gallery/albums/$albumId"
                  params={{ albumId: String(album.id) }}
                  className="block rounded-xl overflow-hidden border transition-shadow hover:shadow-md"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="relative aspect-video flex items-center justify-center overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Image size={32} style={{ color: "var(--color-text-muted)" }} />
                    )}
                    <span
                      className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded-full text-white"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                    >
                      {album.media_count}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                      {album.name}
                    </div>
                    {album.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>
                        {album.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </ReadPage>
  );
}
