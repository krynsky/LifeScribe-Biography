import { Outlet } from "@tanstack/react-router";
import ReaderSidebar from "@/components/reader/ReaderSidebar";

export default function ReaderShell() {
  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--color-background)" }}>
      <ReaderSidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--color-background)" }}>
        <Outlet />
      </main>
    </div>
  );
}
