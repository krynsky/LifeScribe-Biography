// Full implementation in U6
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera } from "lucide-react";

export default function PhotoImportPage() {
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
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "var(--color-accent)" + "20" }}
        >
          <Camera size={18} style={{ color: "var(--color-accent-dark)" }} />
        </div>
        <h1
          className="text-2xl"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
        >
          Import Photos
        </h1>
      </div>
      <div
        className="rounded-xl border-2 border-dashed p-12 text-center"
        style={{ borderColor: "var(--color-border)" }}
      >
        <Camera size={32} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
        <div className="text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
          Photo import — implemented in U6
        </div>
        <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Folder selection, EXIF extraction, thumbnail generation
        </div>
      </div>
    </div>
  );
}
