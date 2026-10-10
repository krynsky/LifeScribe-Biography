import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import CategoryPicker from "@/components/forms/CategoryPicker";
import TagPicker from "@/components/forms/TagPicker";
import { createAlbum, getAlbum, updateAlbum } from "@/lib/actions/gallery";
import { getTagNames } from "@/lib/actions/taxonomy";
import { parseTags } from "@/lib/reader-utils";

/** Create an album, or edit its title, description, category and tags, on its own page. */
function AlbumFormPage({ albumId }: { albumId: number | null }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(albumId !== null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (albumId === null) return;
    getAlbum(albumId)
      .then(async (album) => {
        if (!album) return setNotFound(true);
        setName(album.name);
        setDescription(album.description ?? "");
        setCategoryId(album.category_id ?? null);
        setTags(album.tags === undefined ? await getTagNames("albums", album.id) : parseTags(album.tags));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [albumId]);

  const touch = () => {
    setDirty(true);
    setError(null);
  };
  const goBack = () => (albumId === null ? navigate({ to: "/gallery" }) : navigate({ to: "/gallery/albums/$albumId", params: { albumId: String(albumId) } }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the album a title.");
    setSaving(true);
    setError(null);
    try {
      const data = { name: name.trim(), description: description.trim() || null, category_id: categoryId, tags };
      const saved = albumId !== null ? await updateAlbum(albumId, data) : await createAlbum(data);
      setDirty(false);
      await navigate({ to: "/gallery/albums/$albumId", params: { albumId: String(saved.id) } });
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
      setSaving(false);
    }
  }

  function handleCancel() {
    if (dirty && !confirm("Discard your changes?")) return;
    void goBack();
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (notFound) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Album not found.</div>;

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 text-sm flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={14} />
          {albumId === null ? "Gallery" : "Album"}
        </button>
        <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }} role="status">
          {albumId === null ? "New album" : dirty ? "Unsaved changes" : "No changes"}
        </span>
        <button type="submit" disabled={saving} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {saving ? "Saving…" : albumId === null ? "Create album" : "Save changes"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <input
            autoFocus={albumId === null}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              touch();
            }}
            placeholder="Album title…"
            aria-label="Album title"
            className="w-full text-3xl font-bold bg-transparent border-none outline-none"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
          />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="album-desc">Description</label>
            <textarea
              id="album-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch();
              }}
              rows={5}
              className="w-full px-3 py-2 rounded-lg border text-sm resize-y"
              style={field}
            />
          </div>
          <CategoryPicker
            value={categoryId}
            onChange={(c) => {
              setCategoryId(c);
              touch();
            }}
          />
          <TagPicker
            value={tags}
            onChange={(t) => {
              setTags(t);
              touch();
            }}
          />
          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
        </div>
      </div>
    </form>
  );
}

export function NewAlbumPage() {
  return <AlbumFormPage albumId={null} />;
}

export default function AlbumEditorPage() {
  const { albumId } = useParams({ from: "/gallery/albums/$albumId/edit" });
  return <AlbumFormPage key={albumId} albumId={Number(albumId)} />;
}
