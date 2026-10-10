import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Image, Trash2, Download } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CategoryChip from "@/components/reader/CategoryChip";
import { listAlbums, deleteAlbum, type AlbumListItem } from "@/lib/actions/gallery";
import { imageSrc } from "@/lib/image-src";

export default function GalleryPage() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<AlbumListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => listAlbums().then(setAlbums), []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  async function handleDelete(album: AlbumListItem) {
    const photos = album.media_count > 0 ? ` Its ${album.media_count} photo${album.media_count === 1 ? "" : "s"} will be kept but removed from the album.` : "";
    if (!confirm(`Delete the album "${album.name}"?${photos}`)) return;
    await deleteAlbum(album.id);
    await reload();
  }

  const newButton = (
    <button onClick={() => navigate({ to: "/gallery/new" })} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
      <Plus size={14} />
      New Album
    </button>
  );

  return (
    <div className="p-8">
      <PageHeader
        title="Gallery"
        subtitle="Photos organized into albums"
        actions={
          <>
            <Link to="/import/photos" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border font-medium" style={{ borderColor: "var(--color-border)", color: "var(--color-text)", background: "var(--color-surface)" }}>
              <Download size={14} />
              Import Photos
            </Link>
            {newButton}
          </>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : albums.length === 0 ? (
        <EmptyState
          icon={<Image size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No albums yet"
          description="Create an album, then add photos and videos — or import a folder of photos from your computer."
          action={newButton}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((album) => {
            const cover = imageSrc(album.cover_path) ?? imageSrc(album.cover_image);
            return (
              <div key={album.id} className="group relative rounded-xl overflow-hidden border hover:shadow-md transition-shadow" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
                <Link to="/gallery/albums/$albumId" params={{ albumId: String(album.id) }} className="block">
                  <div className="aspect-video flex items-center justify-center overflow-hidden" style={{ background: "var(--color-surface-2)" }}>
                    {cover ? <img src={cover} alt={album.name} className="w-full h-full object-cover" loading="lazy" /> : <Image size={32} style={{ color: "var(--color-text-muted)" }} />}
                  </div>
                  <div className="p-3">
                    {album.category && (
                      <div className="mb-1.5">
                        <CategoryChip variant="solid" name={album.category} color={album.category_color} icon={album.category_icon} />
                      </div>
                    )}
                    <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{album.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      {album.media_count} item{album.media_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => void handleDelete(album)}
                  className="absolute right-2 top-2 p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  title="Delete album"
                  aria-label={`Delete ${album.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
