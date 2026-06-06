import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Clock, Image, Users, Briefcase, MapPin, Download } from "lucide-react";
import { getBiographyStats } from "@/lib/actions/biography";

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

      {/* Quick actions */}
      <div
        className="rounded-xl border p-6"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h2
          className="text-lg mb-4"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
        >
          Get Started
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/stories/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            <BookOpen size={14} />
            Write a Story
          </Link>
          <Link
            to="/import/photos"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <Download size={14} />
            Import Photos
          </Link>
          <Link
            to="/import/archive"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border"
            style={{
              color: "var(--color-text)",
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            <Download size={14} />
            Import from Facebook / Instagram
          </Link>
        </div>
      </div>
    </div>
  );
}
