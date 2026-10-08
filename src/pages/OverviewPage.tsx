import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, Image, Users, Briefcase, MapPin, Eye } from "lucide-react";
import { getBiographyStats } from "@/lib/actions/biography";
import { useViewMode } from "@/lib/view-mode";

interface Stats {
  storyCount: number;
  milestoneCount: number;
  mediaCount: number;
  albumCount: number;
  familyMemberCount: number;
  careerCount: number;
  mapPinCount: number;
}

interface StatCard {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
  path: string;
  color: string;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const { setMode } = useViewMode();

  useEffect(() => {
    getBiographyStats().then(setStats).catch(console.error);
  }, []);

  const cards: StatCard[] = [
    { label: "Stories", value: stats?.storyCount ?? 0, icon: BookOpen, path: "/stories", color: "var(--color-primary)" },
    { label: "Milestones", value: stats?.milestoneCount ?? 0, icon: Clock, path: "/timeline", color: "#7C5CBF" },
    { label: "Photos", value: stats?.mediaCount ?? 0, icon: Image, path: "/gallery", color: "var(--color-accent-dark)" },
    { label: "Family", value: stats?.familyMemberCount ?? 0, icon: Users, path: "/family-tree", color: "#4A9B6F" },
    { label: "Career", value: stats?.careerCount ?? 0, icon: Briefcase, path: "/career", color: "#C0504D" },
    { label: "Map Pins", value: stats?.mapPinCount ?? 0, icon: MapPin, path: "/maps", color: "#3B82F6" },
  ];

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl mb-1"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
        >
          Your Life Story
        </h1>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Everything that makes you, you — captured and preserved.
        </p>
      </div>

      {/* Switches the app to Read mode */}
      <button
        type="button"
        onClick={() => setMode("read")}
        className="w-full text-left flex items-center gap-4 p-6 rounded-xl border mb-8 transition-shadow hover:shadow-md"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--color-primary)" }}
        >
          <Eye size={20} color="white" />
        </div>
        <div>
          <div className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Read My Biography
          </div>
          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            See your life story the way a visitor would experience it
          </div>
        </div>
      </button>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.path}
              to={card.path}
              className="block p-5 rounded-xl border transition-shadow hover:shadow-md"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${card.color}18` }}
                >
                  <Icon size={18} />
                </div>
              </div>
              <div
                className="text-2xl font-bold mb-0.5"
                style={{ color: "var(--color-text)" }}
              >
                {card.value}
              </div>
              <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {card.label}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
