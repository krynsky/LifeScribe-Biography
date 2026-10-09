import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon,
  List, ListOrdered, Quote, Minus, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Table, Image as ImageIcon, Undo, Redo,
  Palette, Highlighter, Superscript, Subscript, Code2, Video, ListChecks,
} from "lucide-react";
import ColorPicker from "./ColorPicker";
import LinkDialog from "./LinkDialog";
import EmbedDialog from "./EmbedDialog";
import TableToolbar from "./TableToolbar";

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Keep the editor selection when a toolbar button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className="w-7 h-7 flex items-center justify-center rounded text-sm transition-colors disabled:opacity-30"
      style={{
        color: active ? "var(--color-primary)" : "var(--color-text-secondary)",
        background: active ? "var(--color-primary)" + "18" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 mx-0.5 flex-shrink-0" style={{ background: "var(--color-border)" }} />;
}

interface EditorToolbarProps {
  editor: Editor;
  onImageInsert?: () => void;
}

type Panel = "link" | "embed" | null;

export default function EditorToolbar({ editor, onImageInsert }: EditorToolbarProps) {
  const [panel, setPanel] = useState<Panel>(null);

  const blockValue = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  function setBlock(value: string) {
    const chain = editor.chain().focus();
    if (value === "p") chain.setParagraph().run();
    else chain.setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
  }

  return (
    <div>
      <div
        className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo size={13} />
        </ToolbarButton>

        <Divider />

        <select
          value={blockValue}
          onChange={(e) => setBlock(e.target.value)}
          aria-label="Text style"
          className="h-7 px-1.5 text-xs rounded border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
          <Bold size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
          <Italic size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
          <Underline size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline code">
          <Code size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superscript">
          <Superscript size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subscript">
          <Subscript size={13} />
        </ToolbarButton>

        <Divider />

        <ColorPicker
          icon={<Palette size={13} />}
          title="Text color"
          currentColor={(editor.getAttributes("textStyle").color as string | undefined) ?? null}
          onSelect={(hex) => (hex ? editor.chain().focus().setColor(hex).run() : editor.chain().focus().unsetColor().run())}
        />
        <ColorPicker
          icon={<Highlighter size={13} />}
          title="Highlight"
          currentColor={(editor.getAttributes("highlight").color as string | undefined) ?? null}
          onSelect={(hex) => (hex ? editor.chain().focus().setHighlight({ color: hex }).run() : editor.chain().focus().unsetHighlight().run())}
        />

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
          <List size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
          <ListOrdered size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Checklist">
          <ListChecks size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
          <Code2 size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus size={13} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left">
          <AlignLeft size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Center">
          <AlignCenter size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right">
          <AlignRight size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify size={13} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => setPanel((p) => (p === "link" ? null : "link"))} active={editor.isActive("link") || panel === "link"} title="Link">
          <LinkIcon size={13} />
        </ToolbarButton>
        {onImageInsert && (
          <ToolbarButton onClick={onImageInsert} title="Insert image">
            <ImageIcon size={13} />
          </ToolbarButton>
        )}
        <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
          <Table size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => setPanel((p) => (p === "embed" ? null : "embed"))} active={panel === "embed"} title="Embed video or map">
          <Video size={13} />
        </ToolbarButton>
      </div>

      {panel === "link" && <LinkDialog editor={editor} onClose={() => setPanel(null)} />}
      {panel === "embed" && <EmbedDialog editor={editor} onClose={() => setPanel(null)} />}
      <TableToolbar editor={editor} />
    </div>
  );
}
