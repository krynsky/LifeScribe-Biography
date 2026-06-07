import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import StoryEditor from "@/components/editor/StoryEditor";
import { getStory, updateStory, autosaveStory, deleteStory } from "@/lib/actions/stories";
import type { Story } from "@/lib/models";

const AUTOSAVE_DELAY_MS = 1500;

export default function StoryEditorPage() {
  const { storyId } = useParams({ from: "/stories/$storyId" });
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(true);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getStory(Number(storyId))
      .then((s) => {
        setStory(s);
        setTitle(s?.title ?? "");
        setContent(s?.content ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storyId]);

  const scheduleAutosave = useCallback(
    (newContent: string) => {
      if (!story) return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(async () => {
        try {
          await autosaveStory(story.id, newContent);
          setSaveError(false);
        } catch {
          setSaveError(true);
        }
      }, AUTOSAVE_DELAY_MS);
    },
    [story]
  );

  function handleContentChange(json: string) {
    setContent(json);
    scheduleAutosave(json);
  }

  async function handleSaveTitle() {
    if (!story || title === story.title) return;
    setSaving(true);
    try {
      const updated = await updateStory({ id: story.id, title });
      setStory(updated);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!story) return;
    const newStatus = story.status === "published" ? "draft" : "published";
    const updated = await updateStory({ id: story.id, status: newStatus });
    setStory(updated);
  }

  async function handleDelete() {
    if (!story || !confirm(`Permanently delete "${story.title}"?`)) return;
    await deleteStory(story.id);
    navigate({ to: "/stories" });
  }

  if (loading) {
    return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  }
  if (!story) {
    return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Story not found.</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <button
          onClick={() => navigate({ to: "/stories" })}
          className="flex items-center gap-1.5 text-sm flex-shrink-0"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} />
          Stories
        </button>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            className="w-full text-base font-semibold bg-transparent border-none outline-none"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {saveError && (
            <span className="text-xs" style={{ color: "var(--color-error)" }}>Save failed</span>
          )}
          {saving && (
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Saving…</span>
          )}
          <button
            onClick={handlePublish}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{
              background: story.status === "published" ? "var(--color-success)" + "20" : "var(--color-primary)",
              color: story.status === "published" ? "var(--color-success)" : "white",
            }}
          >
            {story.status === "published" ? "Published" : "Publish"}
          </button>
          <button
            onClick={handleDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: "var(--color-error)" }}
            title="Delete story"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">
          <StoryEditor content={content} onChange={handleContentChange} />
        </div>
      </div>
    </div>
  );
}
