interface CategoryChipProps {
  name: string | null | undefined;
  color?: string | null;
  icon?: string | null;
  /** "tint" (stories) uses a light background; "solid" (timeline, career, gallery) is filled with white text, like the web bio. */
  variant?: "tint" | "solid";
}

export default function CategoryChip({ name, color, icon, variant = "tint" }: CategoryChipProps) {
  if (!name) return null;
  const c = color || "#6366F1";
  const style =
    variant === "solid"
      ? { background: c, color: "#fff" }
      : { background: `${c}15`, color: c };
  return (
    <span
      className="inline-flex w-fit items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full"
      style={style}
    >
      {icon && <span className="text-[10px]">{icon}</span>}
      {name}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: "var(--color-surface-2)", color: "var(--color-primary)" }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
