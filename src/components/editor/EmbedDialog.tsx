import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { planEmbed } from "@/lib/embed-utils";
import { normalizeLinkUrl } from "@/lib/link-url";

interface EmbedDialogProps {
  editor: Editor;
  onClose: () => void;
}

/**
 * Insert a YouTube / Vimeo / Google Maps embed from a pasted URL or an address. Other URLs become a
 * plain link (the web editor's fallback). Works offline: nothing here calls a server.
 */
export default function EmbedDialog({ editor, onClose }: EmbedDialogProps) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function insert() {
    const plan = planEmbed(text);
    switch (plan.kind) {
      case "youtube":
        editor.chain().focus().setYoutubeVideo({ src: plan.src }).run();
        break;
      case "vimeo":
        editor.chain().focus().setVimeoEmbed({ src: plan.src }).run();
        break;
      case "maps":
        editor.chain().focus().setGoogleMapsEmbed({ src: plan.src }).run();
        break;
      case "maps-needs-resolve":
        setMessage("Short Google Maps links can't be opened offline. Open the link in your browser and paste the full address, or just type the place or street address here.");
        return;
      case "link": {
        const href = normalizeLinkUrl(plan.url);
        if (!href) {
          setMessage("That doesn't look like a valid link.");
          return;
        }
        editor.chain().focus().insertContent({ type: "text", text: plan.url, marks: [{ type: "link", attrs: { href } }] }).run();
        break;
      }
      case "invalid":
        setMessage(plan.reason);
        return;
    }
    onClose();
  }

  return (
    <div className="px-3 py-3 border-b" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>
      <p className="text-xs mb-2" style={{ color: "var(--color-text-secondary)" }}>
        Paste a YouTube or Vimeo link, a Google Maps link, or type an address to show on a map. Any other link is added as a link.
      </p>
      <div className="flex gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              insert();
            } else if (e.key === "Escape") onClose();
          }}
          placeholder="https://www.youtube.com/watch?v=…  or  65 E Scott St, Chicago"
          className="min-w-0 flex-1 px-3 py-2 rounded border text-sm"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
        <button type="button" onClick={insert} disabled={!text.trim()} className="px-4 py-2 rounded text-sm text-white disabled:opacity-50" style={{ background: "var(--color-primary)" }}>
          Embed
        </button>
        <button type="button" onClick={onClose} className="px-3 py-2 rounded text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
          Cancel
        </button>
      </div>
      {message && (
        <p className="text-xs mt-2" style={{ color: "var(--color-error)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
