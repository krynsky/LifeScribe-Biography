import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

interface ReaderNavItem {
  label: string;
  path:
    | "/reader"
    | "/reader/stories"
    | "/reader/timeline"
    | "/reader/gallery"
    | "/reader/family-tree"
    | "/reader/career"
    | "/reader/maps";
}

const READER_NAV_ITEMS: ReaderNavItem[] = [
  { label: "Cover", path: "/reader" },
  { label: "Stories", path: "/reader/stories" },
  { label: "Timeline", path: "/reader/timeline" },
  { label: "Gallery", path: "/reader/gallery" },
  { label: "Family Tree", path: "/reader/family-tree" },
  { label: "Career", path: "/reader/career" },
  { label: "Maps", path: "/reader/maps" },
];

export default function ReaderSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  function isActive(item: ReaderNavItem): boolean {
    if (item.path === "/reader") return currentPath === "/reader";
    return currentPath === item.path || currentPath.startsWith(item.path + "/");
  }

  return (
    <aside
      className="flex flex-col h-full w-56 flex-shrink-0"
      style={{ background: "var(--color-sidebar-bg)" }}
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "var(--color-sidebar-text)", opacity: 0.7 }}
        >
          <ArrowLeft size={12} />
          Exit Reader
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {READER_NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.path}
              to={item.path}
              className="block px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: active ? "var(--color-sidebar-text-active)" : "var(--color-sidebar-text)",
                background: active ? "var(--color-sidebar-active-bg)" : "transparent",
                fontWeight: active ? 500 : 400,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
