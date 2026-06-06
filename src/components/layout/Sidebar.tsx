import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Clock,
  Image,
  Users,
  Briefcase,
  MapPin,
  Download,
  Settings,
  LayoutDashboard,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  matchPrefix?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Stories", path: "/stories", icon: BookOpen, matchPrefix: true },
  { label: "Timeline", path: "/timeline", icon: Clock },
  { label: "Gallery", path: "/gallery", icon: Image, matchPrefix: true },
  { label: "Family Tree", path: "/family-tree", icon: Users },
  { label: "Career", path: "/career", icon: Briefcase },
  { label: "Maps & Places", path: "/maps", icon: MapPin },
  { label: "Import", path: "/import", icon: Download, matchPrefix: true },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  function isActive(item: NavItem): boolean {
    if (item.matchPrefix) {
      return currentPath.startsWith(item.path) && currentPath !== "/";
    }
    return currentPath === item.path;
  }

  return (
    <aside
      className="flex flex-col h-full w-56 flex-shrink-0"
      style={{ background: "var(--color-sidebar-bg)" }}
    >
      {/* App branding */}
      <div
        className="flex items-center gap-3 px-5 py-5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
          style={{ background: "var(--color-primary)" }}
        >
          L
        </div>
        <div>
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--color-sidebar-text-active)", fontFamily: "var(--font-heading)" }}
          >
            LifeScribe
          </div>
          <div className="text-xs" style={{ color: "var(--color-sidebar-text)", opacity: 0.6 }}>
            Biography
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: active
                  ? "var(--color-sidebar-text-active)"
                  : "var(--color-sidebar-text)",
                background: active
                  ? "var(--color-sidebar-active-bg)"
                  : "transparent",
                fontWeight: active ? 500 : 400,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--color-sidebar-hover-bg)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }
              }}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom version */}
      <div
        className="px-5 py-3 text-xs"
        style={{ color: "var(--color-sidebar-text)", opacity: 0.4 }}
      >
        v0.1.0
      </div>
    </aside>
  );
}
