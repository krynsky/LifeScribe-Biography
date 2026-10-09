import type { Editor } from "@tiptap/react";

/** Row/column controls, shown only while the cursor is inside a table. */
export default function TableToolbar({ editor }: { editor: Editor }) {
  if (!editor.isActive("table")) return null;

  const items: { label: string; run: () => void; danger?: boolean }[] = [
    { label: "Row above", run: () => editor.chain().focus().addRowBefore().run() },
    { label: "Row below", run: () => editor.chain().focus().addRowAfter().run() },
    { label: "Column left", run: () => editor.chain().focus().addColumnBefore().run() },
    { label: "Column right", run: () => editor.chain().focus().addColumnAfter().run() },
    { label: "Header row", run: () => editor.chain().focus().toggleHeaderRow().run() },
    { label: "Delete row", run: () => editor.chain().focus().deleteRow().run(), danger: true },
    { label: "Delete column", run: () => editor.chain().focus().deleteColumn().run(), danger: true },
    { label: "Delete table", run: () => editor.chain().focus().deleteTable().run(), danger: true },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b text-xs" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-2)" }}>
      <span className="mr-1 font-medium" style={{ color: "var(--color-text-secondary)" }}>
        Table
      </span>
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={it.run}
          className="px-2 py-1 rounded border"
          style={{ borderColor: "var(--color-border)", color: it.danger ? "var(--color-error)" : "var(--color-text)" }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
