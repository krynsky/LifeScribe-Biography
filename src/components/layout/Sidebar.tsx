import { Link, useRouterState } from "@tanstack/react-router";
import { useAppVersion } from "@/lib/app-version";
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
  Eye,
  Pencil,
  UserCircle,
  Tags,
} from "lucide-react";
import { useViewMode } from "@/lib/view-mode";
import BrandLogo from "./BrandLogo";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  matchPrefix?: boolean;
  /** Draw a divider above this item. */
  separator?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Stories", path: "/stories", icon: BookOpen, matchPrefix: true },
  { label: "Timeline", path: "/timeline", icon: Clock, matchPrefix: true },
  { label: "Gallery", path: "/gallery", icon: Image, matchPrefix: true },
  { label: "Family Tree", path: "/family-tree", icon: Users, matchPrefix: true },
  { label: "Career", path: "/career", icon: Briefcase, matchPrefix: true },
  { label: "Maps & Places", path: "/maps", icon: MapPin, matchPrefix: true },
  { label: "Profile", path: "/profile", icon: UserCircle, separator: true },
  { label: "Categories & Tags", path: "/organize", icon: Tags },
  { label: "Import", path: "/import", icon: Download, matchPrefix: true },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const version = useAppVersion();
  const { mode, setMode } = useViewMode();

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
        className="px-5 py-5 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        <BrandLogo className="w-full h-auto brightness-0 invert" />
        {/* Stretched to the logo's full width, whatever the sidebar width is. */}
        <svg viewBox="0 0 184 36" className="mt-1 w-full h-auto" role="img" aria-label="Biography">
          <text
            x="0"
            y="25"
            fontSize="27"
            fontWeight="400"
            textLength="180"
            lengthAdjust="spacingAndGlyphs"
            fill="var(--color-sidebar-text)"
            fillOpacity="0.6"
            style={{ fontFamily: "var(--font-body, Inter, sans-serif)" }}
          >
            Biography
          </text>
        </svg>
      </div>

      {/* Read / Edit toggle */}
      <div className="px-3 pt-4">
        <div
          role="group"
          aria-label="View mode"
          className="flex p-0.5 rounded-lg"
          style={{ background: "var(--color-sidebar-hover-bg)" }}
        >
          {([
            { value: "read", label: "Read", icon: Eye },
            { value: "edit", label: "Edit", icon: Pencil },
          ] as const).map(({ value, label, icon: ModeIcon }) => {
            const selected = mode === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setMode(value)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs transition-colors"
                style={{
                  background: selected ? "var(--color-sidebar-active-bg)" : "transparent",
                  color: selected ? "var(--color-sidebar-text-active)" : "var(--color-sidebar-text)",
                  fontWeight: selected ? 500 : 400,
                }}
              >
                <ModeIcon size={12} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          return (
            <div key={item.path}>
              {item.separator && (
                <div
                  role="separator"
                  className="my-3 mx-3 border-t"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}
                />
              )}
            <Link
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
            </div>
          );
        })}
      </nav>

      {/* Bottom version */}
      <div
        className="px-5 py-3 text-xs"
        style={{ color: "var(--color-sidebar-text)", opacity: 0.4 }}
      >
        {version && `v${version}`}
      </div>
    </aside>
  );
}
