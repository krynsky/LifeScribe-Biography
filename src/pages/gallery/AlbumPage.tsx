import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { ArrowLeft, ImagePlus, Link2, Pencil, Star, Trash2, Upload } from "lucide-react";
import AlbumGrid from "@/components/gallery/AlbumGrid";
import AlbumFormModal from "@/components/gallery/AlbumFormModal";
import CategoryChip, { TagList } from "@/components/reader/CategoryChip";
import Modal from "@/components/ui/Modal";
import { getAlbum, listMedia, updateMedia, deleteMedia, deleteAlbum, setAlbumCover } from "@/lib/actions/gallery";
import { addImageFiles, addMediaByUrl, pickImageFiles } from "@/lib/actions/media-add";
import { parseTags } from "@/lib/reader-utils";
import type { Album, Media } from "@/lib/models";

const iconBtn = "w-7 h-7 flex items-center justify-center rounded-md text-white";

export default function AlbumPage() {
  const { albumId } = useParams({ from: "/gallery/albums/$albumId" });
  const navigate = useNavigate();
  const id = Number(albumId);

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [captionFor, setCaptionFor] = useState<Media | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    const [a, m] = await Promise.all([getAlbum(id), listMedia({ album_id: id })]);
    setAlbum(a);
    setPhotos(m);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  const addFiles = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setMessage(null);
      setProgress(`Adding 0 of ${paths.length}…`);
      try {
        const { added, failed } = await addImageFiles(paths, id, (done, total) => setProgress(`Adding ${done} of ${total}…`));
        await load();
        if (failed.length === 0) setMessage({ text: `Added ${added.length} photo${added.length === 1 ? "" : "s"}.`, tone: "ok" });
        else
          setMessage({
            text: `Added ${added.length}; ${failed.length} could not be added: ${failed.map((f) => `${f.path.split(/[\\/]/).pop()} (${f.error})`).join(", ")}`,
            tone: "error",
          });
      } finally {
        setProgress(null);
      }
    },
    [id, load]
  );

  async function handlePick() {
    const paths = await pickImageFiles();
    if (paths) await addFiles(paths);
  }

  // Drag photos from Explorer onto the window.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const p = event.payload;
        if (p.type === "over") setDragOver(true);
        else if (p.type === "leave") setDragOver(false);
        else if (p.type === "drop") {
          setDragOver(false);
          void addFiles(p.paths);
        }
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(console.error);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addFiles]);

  async function handleSetCover(m: Media) {
    try {
      await setAlbumCover(id, m.id);
      await load();
      setMessage({ text: "Cover updated.", tone: "ok" });
    } catch (e) {
      setMessage({ text: String(e), tone: "error" });
    }
  }

  async function handleDeleteMedia(m: Media) {
    if (!confirm(`Remove "${m.title ?? m.filename}" from your gallery? This cannot be undone.`)) return;
    await deleteMedia(m.id);
    await load();
  }

  async function saveCaption() {
    if (!captionFor) return;
    await updateMedia(captionFor.id, { caption: captionText.trim() || null });
    setCaptionFor(null);
    await load();
  }

  async function handleDeleteAlbum() {
    if (!album) return;
    const kept = photos.length > 0 ? ` Its ${photos.length} item${photos.length === 1 ? "" : "s"} will be kept but removed from the album.` : "";
    if (!confirm(`Delete the album "${album.name}"?${kept}`)) return;
    await deleteAlbum(album.id);
    navigate({ to: "/gallery" });
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (!album) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Album not found.</div>;

  const tags = parseTags(album.tags);
  const outline = { borderColor: "var(--color-border)", color: "var(--color-text)", background: "var(--color-surface)" };

  return (
    <div className="p-8 relative">
      {dragOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: "rgba(61,122,138,0.25)" }}>
          <div className="px-8 py-6 rounded-2xl text-lg font-medium text-white shadow-xl" style={{ background: "var(--color-primary)" }}>
            <Upload className="inline mr-2 -mt-1" size={20} />
            Drop photos to add them to “{album.name}”
          </div>
        </div>
      )}

      <button onClick={() => navigate({ to: "/gallery" })} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
        <ArrowLeft size={14} />
        Gallery
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          {album.category && (
            <div className="mb-2">
              <CategoryChip variant="solid" name={album.category} color={album.category_color} icon={album.category_icon} />
            </div>
          )}
          <h1 className="text-2xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>{album.name}</h1>
          {album.description && <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{album.description}</p>}
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            {photos.length === 0 ? "No media yet." : `${photos.length} item${photos.length === 1 ? "" : "s"}`}
          </p>
          {tags.length > 0 && <div className="mt-2"><TagList tags={tags} /></div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0">
          <button onClick={() => void handlePick()} disabled={progress !== null} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
            <ImagePlus size={14} />
            Add Photos
          </button>
          <button onClick={() => setShowUrl(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border" style={outline}>
            <Link2 size={14} />
            Add by Link
          </button>
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border" style={outline}>
            <Pencil size={14} />
            Edit Details
          </button>
          <button onClick={() => void handleDeleteAlbum()} className="p-2 rounded-lg" style={{ color: "var(--color-error)" }} title="Delete album" aria-label="Delete album">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {(progress || message) && (
        <p className="text-sm mb-4" style={{ color: message?.tone === "error" ? "var(--color-error)" : "var(--color-text-secondary)" }} role="status">
          {progress ?? message?.text}
        </p>
      )}

      {photos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-16 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
          <div className="text-4xl mb-2">📷</div>
          <p className="text-sm">Drag photos here, or use Add Photos to upload them.</p>
          <p className="text-xs mt-1">You can also add a photo or a YouTube / Vimeo video by link.</p>
        </div>
      ) : (
        <AlbumGrid
          photos={photos}
          coverMediaId={album.cover_media_id}
          renderActions={(m) => (
            <>
              <button type="button" className={iconBtn} style={{ background: "rgba(0,0,0,0.55)" }} title="Edit caption" aria-label="Edit caption" onClick={() => { setCaptionFor(m); setCaptionText(m.caption ?? ""); }}>
                <Pencil size={12} />
              </button>
              <button type="button" className={iconBtn} style={{ background: album.cover_media_id === m.id ? "var(--color-primary)" : "rgba(0,0,0,0.55)" }} title="Use as album cover" aria-label="Use as album cover" onClick={() => void handleSetCover(m)}>
                <Star size={12} fill={album.cover_media_id === m.id ? "white" : "none"} />
              </button>
              <button type="button" className={iconBtn} style={{ background: "rgba(192,80,77,0.9)" }} title="Delete" aria-label="Delete" onClick={() => void handleDeleteMedia(m)}>
                <Trash2 size={12} />
              </button>
            </>
          )}
        />
      )}

      <AlbumFormModal open={showEdit} onClose={() => setShowEdit(false)} album={album} onSaved={() => void load()} />
      <AddByLinkModal open={showUrl} onClose={() => setShowUrl(false)} albumId={id} onAdded={() => void load()} />

      <Modal open={captionFor !== null} onClose={() => setCaptionFor(null)} title="Caption" maxWidth="440px">
        <textarea
          autoFocus
          value={captionText}
          onChange={(e) => setCaptionText(e.target.value)}
          rows={3}
          placeholder="Add a caption…"
          aria-label="Caption"
          className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
        <div className="flex gap-3 mt-3">
          <button onClick={() => void saveCaption()} className="flex-1 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>Save</button>
          <button onClick={() => setCaptionFor(null)} className="px-4 py-2 rounded-lg text-sm border" style={outline}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

interface AddByLinkModalProps {
  open: boolean;
  onClose: () => void;
  albumId: number;
  onAdded: () => void;
}

function AddByLinkModal({ open, onClose, albumId, onAdded }: AddByLinkModalProps) {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [type, setType] = useState<"image" | "video">("image");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setCaption("");
      setType("image");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addMediaByUrl({ url, caption, albumId, typeHint: type });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

  return (
    <Modal open={open} onClose={onClose} title="Add by Link" maxWidth="480px">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Paste a link to an image or video. YouTube and Vimeo links are recognised automatically. Linked media is not downloaded, so it needs an internet connection to display.
        </p>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="media-url">Link (https://)</label>
          <input id="media-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="media-type">Type</label>
          <select id="media-type" value={type} onChange={(e) => setType(e.target.value as "image" | "video")} className="w-full px-3 py-2 rounded-lg border text-sm" style={field}>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="media-caption">Caption <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
          <input id="media-caption" value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
        </div>
        {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={busy || !url.trim()} className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
            {busy ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
