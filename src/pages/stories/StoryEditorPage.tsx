// Full Tiptap editor implemented in U4 — shell shown here
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getStory, deleteStory } from "@/lib/actions/stories";
import type { Story } from "@/lib/models";

export default function StoryEditorPage() {
  const { storyId } = useParams({ from: "/stories/$storyId" });
  const navigate = useNavigate();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStory(Number(storyId))
      .then(setStory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storyId]);

  async function handleDelete() {
    if (!story || !confirm(`Delete "${story.title}"?`)) return;
    await deleteStory(story.id);
    navigate({ to: "/stories" });
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (!story) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Story not found.</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <button
          onClick={() => navigate({ to: "/stories" })}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} />
          Stories
        </button>
        <div className="flex-1 text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
          {story.title}
        </div>
        <button
          onClick={handleDelete}
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: "var(--color-error)", borderColor: "var(--color-error)" + "40" }}
        >
          Delete
        </button>
      </div>

      {/* Editor area — Tiptap integration added in U4 */}
      <div className="flex-1 p-8 max-w-3xl mx-auto w-full">
        <h1
          className="text-2xl mb-4"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
        >
          {story.title}
        </h1>
        <div
          className="rounded-xl border p-6"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
            minHeight: 300,
          }}
        >
          {story.content
            ? <pre className="text-sm whitespace-pre-wrap">{story.content}</pre>
            : "Rich text editor (Tiptap) — implemented in U4"}
        </div>
      </div>
    </div>
  );
}
