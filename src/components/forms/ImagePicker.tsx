import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { imageSrc } from "@/lib/image-src";
import { pickImageIntoLibrary } from "@/lib/images";
import MediaPickerModal from "./MediaPickerModal";

interface ImagePickerProps {
  /** Library path of the current image, or null. */
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  label?: string;
  /** Shape of the preview. */
  shape?: "wide" | "square" | "circle";
  emptyHint?: string;
  /** Also offer choosing from the gallery photos. */
  allowGallery?: boolean;
}

/** Choose an image file; it is copied into the app's image library and its library path returned. */
export default function ImagePicker({ value, onChange, label = "Image", shape = "wide", emptyHint = "No image", allowGallery = false }: ImagePickerProps) {
  const [busy, setBusy] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = imageSrc(value);

  async function choose() {
    setBusy(true);
    setError(null);
    try {
      const path = await pickImageIntoLibrary();
      if (path) onChange(path);
    } catch (e) {
      setError(`Could not add the image: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const box =
    shape === "circle" ? "w-24 h-24 rounded-full" : shape === "square" ? "w-24 h-24 rounded-lg" : "w-full h-32 rounded-lg";

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <div className={`${box} overflow-hidden flex items-center justify-center border flex-shrink-0`} style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
          {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{emptyHint}</span>}
        </div>
        {shape !== "wide" && (
          <div className="flex flex-col gap-2">
            <ChooseButton busy={busy} hasImage={!!src} onClick={choose} />
            {allowGallery && <GalleryButton onClick={() => setGalleryOpen(true)} />}
            {src && <RemoveButton onClick={() => onChange(null)} />}
          </div>
        )}
      </div>
      {shape === "wide" && (
        <div className="flex gap-2 mt-2">
          <ChooseButton busy={busy} hasImage={!!src} onClick={choose} />
            {allowGallery && <GalleryButton onClick={() => setGalleryOpen(true)} />}
          {src && <RemoveButton onClick={() => onChange(null)} />}
        </div>
      )}
      {error && <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>{error}</p>}
      {allowGallery && <MediaPickerModal open={galleryOpen} onClose={() => setGalleryOpen(false)} onPick={(p) => onChange(p)} />}
    </div>
  );
}

function ChooseButton({ busy, hasImage, onClick }: { busy: boolean; hasImage: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border disabled:opacity-50" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
      <ImagePlus size={14} />
      {hasImage ? "Change" : "Choose image"}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm" style={{ color: "var(--color-error)" }}>
      <Trash2 size={14} />
      Remove
    </button>
  );
}

function GalleryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
      From my photos
    </button>
  );
}
