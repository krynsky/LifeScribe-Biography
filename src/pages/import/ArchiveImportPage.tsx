// Full implementation in U8
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Package } from "lucide-react";

export default function ArchiveImportPage() {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <button
        onClick={() => navigate({ to: "/import" })}
        className="flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} />
        Import Hub
      </button>
      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
      >
        Import Social Media Archive
      </h1>
      <div
        className="rounded-xl border-2 border-dashed p-12 text-center"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Package size={32} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
        <div className="text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
          Archive parsers — implemented in U8
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Facebook, Instagram, LinkedIn ZIP export support
        </div>
      </div>
    </div>
  );
}
