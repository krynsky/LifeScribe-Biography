interface CategoryChipProps {
  name: string | null | undefined;
  color?: string | null;
  icon?: string | null;
}

/** Tinted category pill used on story, album, timeline and career cards (matches the web bio). */
export default function CategoryChip({ name, color, icon }: CategoryChipProps) {
  if (!name) return null;
  const c = color || "#6366F1";
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${c}15`, color: c }}
    >
      {icon && <span>{icon}</span>}
      {name}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
