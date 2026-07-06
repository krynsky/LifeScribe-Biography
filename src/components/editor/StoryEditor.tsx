import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

// Tiptap core
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import HardBreak from "@tiptap/extension-hard-break";
import HorizontalRule from "@tiptap/extension-horizontal-rule";

// Block nodes
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

// Inline marks
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";

// Functional
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Youtube from "@tiptap/extension-youtube";
import { GoogleMapsEmbed } from "./extensions/google-maps-embed";
import { VimeoEmbed } from "./extensions/vimeo-embed";
import { OEmbedBlock } from "./extensions/oembed-block";

import EditorToolbar from "./EditorToolbar";

interface StoryEditorProps {
  content: string | null;
  onChange: (json: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

// Malformed content (e.g. legacy or externally synced data) must not crash
// the whole editor page — fall back to an empty document.
function safeParseDoc(content: string): object | null {
  try {
    return JSON.parse(content) as object;
  } catch {
    console.error("StoryEditor: could not parse story content as JSON");
    return null;
  }
}

const EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  History,
  Dropcursor,
  Gapcursor,
  HardBreak,
  HorizontalRule,
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  CodeBlock,
  TaskList,
  TaskItem.configure({ nested: true }),
  Bold,
  Italic,
  Underline,
  Strike,
  Code,
  Link.configure({ openOnClick: false }),
  Subscript,
  Superscript,
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Typography,
  CharacterCount,
  Image.configure({ inline: false, allowBase64: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  Youtube.configure({ inline: false, controls: true }),
  GoogleMapsEmbed,
  VimeoEmbed,
  OEmbedBlock,
];

export default function StoryEditor({
  content,
  onChange,
  placeholder = "Start writing your story…",
  readOnly = false,
}: StoryEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      ...EXTENSIONS,
      Placeholder.configure({ placeholder }),
    ],
    content: content ? safeParseDoc(content) : null,
    editable: !readOnly,
    onUpdate({ editor }) {
      onChangeRef.current(JSON.stringify(editor.getJSON()));
    },
  });

  // Sync external content changes (initial load from DB)
  useEffect(() => {
    if (!editor || !content) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== content) {
      const doc = safeParseDoc(content);
      if (doc) editor.commands.setContent(doc, false);
    }
  }, [content, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tiptap 2.27: useEditor triggers a re-render on every transaction via
  // useSyncExternalStore, so reading storage directly here always reflects
  // the current document state — no separate useState needed.
  const charCountStorage = editor?.storage.characterCount as
    | { characters: () => number; words: () => number }
    | undefined;
  const wordCount = charCountStorage?.words() ?? 0;
  const charCount = charCountStorage?.characters() ?? 0;

  const handleImageInsert = useCallback(async () => {
    if (!editor) return;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "bmp"] }],
      });
      if (selected && typeof selected === "string") {
        const url = convertFileSrc(selected);
        editor.chain().focus().setImage({ src: url, alt: selected.split(/[\\/]/).pop() }).run();
      }
    } catch (err) {
      console.error("Image insert failed:", err);
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {!readOnly && <EditorToolbar editor={editor} onImageInsert={handleImageInsert} />}
      <div className="flex-1 overflow-y-auto p-6">
        <EditorContent editor={editor} className="tiptap min-h-[400px]" />
      </div>
      <div
        className="flex items-center gap-4 px-6 py-2 border-t text-xs"
        style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
      >
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
    </div>
  );
}
