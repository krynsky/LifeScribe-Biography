import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import CategoryPicker from "@/components/forms/CategoryPicker";
import TagPicker from "@/components/forms/TagPicker";
import { createAlbum, updateAlbum } from "@/lib/actions/gallery";
import { getTagNames } from "@/lib/actions/taxonomy";
import { parseTags } from "@/lib/reader-utils";
import type { Album } from "@/lib/models";

interface AlbumFormModalProps {
  open: boolean;
  onClose: () => void;
  /** The album being edited; omit to create a new one. */
  album?: Album | null;
  onSaved: (album: Album) => void;
}

/** Create or edit an album's title, description, category and tags. */
export default function AlbumFormModal({ open, onClose, album, onSaved }: AlbumFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the form each time it opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(album?.name ?? "");
    setDescription(album?.description ?? "");
    setCategoryId(album?.category_id ?? null);
    setTags(album ? parseTags(album.tags) : []);
    if (album && album.tags === undefined) getTagNames("albums", album.id).then(setTags).catch(console.error);
  }, [open, album]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the album a title.");
    setSaving(true);
    setError(null);
    try {
      const data = { name: name.trim(), description: description.trim() || null, category_id: categoryId, tags };
      const saved = album ? await updateAlbum(album.id, data) : await createAlbum(data);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

  return (
    <Modal open={open} onClose={onClose} title={album ? "Edit Album" : "New Album"} maxWidth="520px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="album-name">Title *</label>
          <input id="album-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="album-desc">Description</label>
          <textarea id="album-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={field} />
        </div>
        <CategoryPicker value={categoryId} onChange={setCategoryId} />
        <TagPicker value={tags} onChange={setTags} />
        {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
            {saving ? "Saving…" : album ? "Save Changes" : "Create Album"}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
