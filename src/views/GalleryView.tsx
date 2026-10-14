import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import CategoryChip from "@/components/reader/CategoryChip";
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
  const subtitle =
    total === 0
      ? "No photos have been added yet."
      : `${total} ${total === 1 ? "photo" : "photos"} across ${albums.length} ${albums.length === 1 ? "album" : "albums"}`;

  return (
    <ReadPage title="Photo Gallery" subtitle={subtitle} width="full">
      {total === 0 && (
        <div className="rounded-lg border border-dashed p-16 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <div className="text-5xl">📷</div>
          <p className="mt-4">No photos have been shared yet.</p>
        </div>
      )}

      {albums.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Albums
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => {
              // Web uses the album's explicit cover image; locally that is the downloaded photo
              // matching it (cover_path), else the remote cover URL.
              const cover = imageSrc(album.cover_path);
              return (
                <Link
                  key={album.id}
                  to="/gallery/albums/$albumId"
                  params={{ albumId: String(album.id) }}
                  className="group overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="relative aspect-video w-full overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                    {cover ? (
                      <img src={cover} alt={album.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-4xl" style={{ opacity: 0.4 }}>🖼️</span>
                      </div>
                    )}
                    {album.media_count > 0 && (
                      <span className="absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-xs text-white" style={{ background: "rgba(0,0,0,0.6)" }}>
                        {album.media_count}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    {album.category && (
                      <div className="mb-1.5">
                        <CategoryChip variant="solid" name={album.category} color={album.category_color} icon={album.category_icon} />
                      </div>
                    )}
                    <p className="font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                      {album.name}
                    </p>
                    {album.description && (
                      <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {album.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </ReadPage>
  );
}
