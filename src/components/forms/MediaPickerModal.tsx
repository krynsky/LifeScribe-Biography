import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { listMedia } from "@/lib/actions/gallery";
import { imageSrc } from "@/lib/image-src";
import { pickImageIntoLibrary } from "@/lib/images";
import type { Media } from "@/lib/models";

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the file path of the chosen (or newly uploaded) image. */
  onPick: (path: string) => void;
  title?: string;
}

/** Choose one of your gallery photos, or upload a new image from your computer. */
export default function MediaPickerModal({ open, onClose, onPick, title = "Choose an image" }: MediaPickerModalProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    listMedia()
      .then(setMedia)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [open]);

  // Only still images: videos have no file to use as a picture.
  const images = useMemo(() => {
    const q = search.trim().toLowerCase();
    return media.filter((m) => m.mime_type?.startsWith("image/") && !m.source_url && (!q || m.filename.toLowerCase().includes(q) || (m.caption ?? "").toLowerCase().includes(q)));
  }, [media, search]);

  async function upload() {
    setError(null);
    try {
      const path = await pickImageIntoLibrary();
      if (path) {
        onPick(path);
        onClose();
      }
    } catch (e) {
      setError(`Could not add the image: ${String(e)}`);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="760px">
      <div className="flex gap-2 mb-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your photos…"
          className="flex-1 px-3 py-2 rounded-lg border text-sm"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
        <button type="button" onClick={() => void upload()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>
          <Upload size={14} />
          Upload from computer
        </button>
      </div>
      {error && (
        <p className="text-xs mb-3" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
      <div className="max-h-[50vh] overflow-y-auto">
        {loading ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
        ) : images.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: "var(--color-text-muted)" }}>
            {media.length === 0 ? "No photos yet — upload one from your computer." : "No photos match your search."}
          </p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {images.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onPick(m.file_path);
                  onClose();
                }}
                className="aspect-square rounded-lg overflow-hidden border hover:opacity-80"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}
                title={m.filename}
              >
                <img src={imageSrc(m.thumbnail_path ?? m.file_path) ?? ""} alt={m.title ?? m.filename} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
