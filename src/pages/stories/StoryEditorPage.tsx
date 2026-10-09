import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import StoryEditor from "@/components/editor/StoryEditor";
import CategoryPicker from "@/components/forms/CategoryPicker";
import TagPicker from "@/components/forms/TagPicker";
import ImagePicker from "@/components/forms/ImagePicker";
import DatePrecisionInput from "@/components/forms/DatePrecisionInput";
import RelatedEntriesPanel from "@/components/stories/RelatedEntriesPanel";
import { getStory, updateStory, deleteStory } from "@/lib/actions/stories";
import { diffStory, storyToForm, type StoryForm } from "@/lib/story-form";
import type { Story } from "@/lib/models";

const AUTOSAVE_DELAY_MS = 1200;

type SaveState = "saved" | "unsaved" | "saving" | "error";

export default function StoryEditorPage() {
  const { storyId } = useParams({ from: "/stories/$storyId" });
  const navigate = useNavigate();
  const id = Number(storyId);

  const [story, setStory] = useState<Story | null>(null);
  const [form, setForm] = useState<StoryForm | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // The form as last written to the database, and the latest form, kept in refs so the debounced
  // save and the unmount flush always see current values.
  const savedRef = useRef<StoryForm | null>(null);
  const formRef = useRef<StoryForm | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    setLoading(true);
    getStory(id)
      .then((s) => {
        setStory(s);
        if (s) {
          const f = storyToForm(s);
          setForm(f);
          formRef.current = f;
          savedRef.current = f;
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  /** Write any unsaved changes now. Safe to call repeatedly; saves never overlap. */
  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    inFlight.current = inFlight.current.then(async () => {
      const saved = savedRef.current;
      const snapshot = formRef.current;
      if (!saved || !snapshot) return;
      const patch = diffStory(saved, snapshot);
      if (!patch) {
        setSaveState("saved");
        return;
      }
      setSaveState("saving");
      try {
        const updated = await updateStory({ id, ...patch });
        // Mark exactly what we wrote as saved; a blank title was deliberately not written.
        savedRef.current = { ...snapshot, title: patch.title ?? saved.title };
        setStory(updated);
        setSavedAt(new Date());
        setSaveState(diffStory(savedRef.current, formRef.current!) ? "unsaved" : "saved");
      } catch (e) {
        console.error("Story save failed:", e);
        setSaveState("error");
      }
    });
    return inFlight.current;
  }, [id]);

  const schedule = useCallback(() => {
    setSaveState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }, [flush]);

  const update = useCallback(
    (patch: Partial<StoryForm>) => {
      const next = { ...(formRef.current as StoryForm), ...patch };
      formRef.current = next;
      setForm(next);
      schedule();
    },
    [schedule]
  );

  // Save pending edits when leaving the page.
  useEffect(() => () => void flush(), [flush]);

  async function handlePublishToggle() {
    if (!story) return;
    setPublishing(true);
    try {
      await flush();
      const updated = await updateStory({ id, status: story.status === "published" ? "draft" : "published" });
      setStory(updated);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!story || !confirm(`Permanently delete "${story.title}"? This cannot be undone.`)) return;
    if (timer.current) clearTimeout(timer.current);
    formRef.current = savedRef.current; // nothing left to autosave
    await deleteStory(id);
    navigate({ to: "/stories" });
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (!story || !form) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Story not found.</div>;

  const published = story.status === "published";
  const statusText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "unsaved"
        ? "Unsaved changes"
        : saveState === "error"
          ? "Save failed — will retry on your next change"
          : savedAt
            ? `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
            : "All changes saved";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <button onClick={() => navigate({ to: "/stories" })} className="flex items-center gap-1.5 text-sm flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={14} />
          Stories
        </button>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: published ? "#4A9B6F22" : "var(--color-surface-2)", color: published ? "var(--color-success)" : "var(--color-text-secondary)" }}
        >
          {published ? "Published" : "Draft"}
        </span>
        <span className="flex-1 text-xs" style={{ color: saveState === "error" ? "var(--color-error)" : "var(--color-text-muted)" }} role="status">
          {statusText}
        </span>
        <button
          onClick={handlePublishToggle}
          disabled={publishing || !form.title.trim()}
          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
          style={{ background: published ? "var(--color-surface-2)" : "var(--color-primary)", color: published ? "var(--color-text)" : "white" }}
        >
          {publishing ? "…" : published ? "Unpublish" : "Publish"}
        </button>
        <button onClick={handleDelete} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "var(--color-error)" }} title="Delete story" aria-label="Delete story">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <ImagePicker label="Cover photo" allowGallery value={form.featuredImage} onChange={(p) => update({ featuredImage: p })} emptyHint="No cover photo" />

          <div>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Story title…"
              aria-label="Story title"
              className="w-full text-3xl font-bold bg-transparent border-none outline-none"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
            />
            {!form.title.trim() && (
              <p className="text-xs mt-1" style={{ color: "var(--color-error)" }}>
                A story needs a title. Until you add one, the previous title is kept.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="story-excerpt">
              Summary
            </label>
            <textarea
              id="story-excerpt"
              value={form.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              rows={2}
              placeholder="A brief summary shown in previews (optional)…"
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <CategoryPicker value={form.categoryId} onChange={(c) => update({ categoryId: c })} />
            <DatePrecisionInput
              label="When did this happen?"
              date={form.eventDate}
              precision={form.eventDatePrecision}
              onChange={({ date, precision }) => update({ eventDate: date, eventDatePrecision: precision })}
            />
          </div>

          <TagPicker value={form.tags} onChange={(t) => update({ tags: t })} />

          <StoryEditor content={form.content} onChange={(json) => update({ content: json })} />

          <RelatedEntriesPanel storyId={id} />
        </div>
      </div>
    </div>
  );
}
