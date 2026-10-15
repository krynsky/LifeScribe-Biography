import { Link } from "@tanstack/react-router";
import { Camera, Package, Star } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

const IMPORT_SOURCES = [
  {
    id: "photos",
    title: "Photos from Your Computer",
    description: "Import photos from any folder. EXIF dates, GPS, and camera info extracted automatically.",
    icon: Camera,
    path: "/import/photos",
    color: "var(--color-accent-dark)",
  },
  {
    id: "archive",
    title: "Social Media Archives",
    description: "Import your Facebook, Instagram, or LinkedIn data export to seed your biography.",
    icon: Package,
    path: "/import/archive",
    color: "var(--color-primary)",
  },
  {
    id: "review",
    title: "Review Imported Items",
    description: "Review and accept the stories, milestones and career entries found in your imported archives.",
    icon: Star,
    path: "/import/review",
    color: "#7C5CBF",
  },
];

export default function ImportHubPage() {
  return (
    <div className="p-8 max-w-2xl">
      <PageHeader
        title="Import"
        subtitle="Seed your biography from your existing content"
      />

      <div className="space-y-4">
        {IMPORT_SOURCES.map((source) => {
          const Icon = source.icon;
          return (
            <Link
              key={source.id}
              to={source.path}
              className="flex items-start gap-4 p-5 rounded-xl border hover:shadow-md transition-shadow"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${source.color}18` }}
              >
                <Icon size={18} style={{ color: source.color }} />
              </div>
              <div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: "var(--color-text)" }}>
                  {source.title}
                </div>
                <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {source.description}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
