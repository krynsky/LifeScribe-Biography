interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "var(--color-surface-2)" }}
        >
          {icon}
        </div>
      )}
      <h3
        className="text-base font-semibold mb-1"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm max-w-xs mb-4" style={{ color: "var(--color-text-secondary)" }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
