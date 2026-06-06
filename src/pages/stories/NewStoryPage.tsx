// Placeholder — full editor implemented in U4
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createStory } from "@/lib/actions/stories";

export default function NewStoryPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      const story = await createStory({ title: title.trim() });
      navigate({ to: "/stories/$storyId", params: { storyId: String(story.id) } });
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
      >
        New Story
      </h1>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
            Title
          </label>
          <input
            type="text"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your story a title…"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
            }}
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {creating ? "Creating…" : "Create Story"}
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/stories" })}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
