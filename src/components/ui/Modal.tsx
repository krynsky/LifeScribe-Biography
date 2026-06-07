import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = "480px" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth,
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
          >
            {title}
          </h2>
          <button onClick={onClose}>
            <X size={16} style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
