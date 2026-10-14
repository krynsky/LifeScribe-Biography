import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { normalizeLinkUrl } from "@/lib/link-url";
import { useNavigate } from "@tanstack/react-router";
import { followLink, isInternalHref, listInternalLinkOptions, type InternalLinkOption } from "@/lib/internal-links";

interface LinkDialogProps {
  editor: Editor;
  onClose: () => void;
}

/** Inline replacement for window.prompt: set, change or remove the link on the selected text. */
export default function LinkDialog({ editor, onClose }: LinkDialogProps) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [url, setUrl] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [options, setOptions] = useState<InternalLinkOption[]>([]);

  useEffect(() => {
    listInternalLinkOptions().then(setOptions).catch(console.error);
  }, []);

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    const href = isInternalHref(trimmed) ? trimmed : normalizeLinkUrl(trimmed);
    if (!href) {
      setError("Enter a web address (https://…), email, or phone number.");
      return;
    }
    const empty = editor.state.selection.empty && !editor.isActive("link");
    if (empty) {
      // Nothing selected: insert the address itself as the link text.
      editor.chain().focus().insertContent({ type: "text", text: trimmed, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    onClose();
  }

  return (
    <div className="px-3 py-2 border-b flex flex-wrap items-center gap-2" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>
      <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }} htmlFor="link-url">
        Link
      </label>
      <input
        id="link-url"
        autoFocus
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          } else if (e.key === "Escape") onClose();
        }}
        placeholder="https://example.com"
        className="flex-1 min-w-[12rem] px-2 py-1 rounded border text-sm"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
      />
      <button type="button" onClick={apply} className="px-3 py-1 rounded text-sm text-white" style={{ background: "var(--color-primary)" }}>
        {current ? (url.trim() ? "Update" : "Remove") : "Add"}
      </button>
      {current && (
        <button
          type="button"
          onClick={() => {
            followLink(current, (t) => navigate(t as never)).catch(console.error);
            onClose();
          }}
          className="px-3 py-1 rounded text-sm border"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          Open
        </button>
      )}
      <button type="button" onClick={onClose} className="px-3 py-1 rounded text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
        Cancel
      </button>
      {options.length > 0 && (
        <div className="basis-full flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }} htmlFor="link-internal">
            Or link to
          </label>
          <select
            id="link-internal"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                setUrl(e.target.value);
                setError(null);
              }
            }}
            className="flex-1 min-w-[12rem] px-2 py-1 rounded border text-sm"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            <option value="">Something in this biography…</option>
            {(["Sections", "Stories", "Albums"] as const).map((g) => (
              <optgroup key={g} label={g}>
                {options.filter((o) => o.group === g).map((o) => (
                  <option key={o.href} value={o.href}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p className="basis-full text-xs" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
