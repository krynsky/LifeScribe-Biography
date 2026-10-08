import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import StoryCard from "@/components/reader/StoryCard";
import { getBiography, getBiographyStats } from "@/lib/actions/biography";
import { listStories } from "@/lib/actions/stories";
import { imageSrc } from "@/lib/image-src";
import { filterPublishedStories, isBiographyEmpty } from "@/lib/reader-utils";
import type { Biography, Story } from "@/lib/models";

type Stats = Awaited<ReturnType<typeof getBiographyStats>>;

const HOME_STORY_LIMIT = 6;

export default function HomeView() {
  const [bio, setBio] = useState<Biography | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    Promise.all([getBiography(), getBiographyStats(), listStories({ status: "published" })])
      .then(([b, s, st]) => {
        setBio(b);
        setStats(s);
        setStories(filterPublishedStories(st));
      })
      .catch(console.error);
  }, []);

  if (!bio || !stats) return <ReadLoading />;

  const banner = imageSrc(bio.cover_photo_path) ?? imageSrc(bio.avatar_photo_path);
  const tiles = [
    { icon: "📝", value: stats.storyCount, label: "Stories", to: "/stories" },
    { icon: "📅", value: stats.milestoneCount, label: "Milestones", to: "/timeline" },
    { icon: "🖼️", value: stats.albumCount, label: "Albums", to: "/gallery" },
    { icon: "💼", value: stats.careerCount, label: "Career", to: "/career" },
    { icon: "🌳", value: stats.familyMemberCount, label: "Family Members", to: "/family-tree" },
    { icon: "📍", value: stats.mapPinCount, label: "Places", to: "/maps" },
  ] as const;

  return (
    <ReadPage>
      {banner && (
        <div className="rounded-xl overflow-hidden mb-8" style={{ aspectRatio: "3 / 1" }}>
          <img src={banner} alt="" className="w-full h-full object-cover" style={{ objectPosition: "center 30%" }} />
        </div>
      )}

      <div className="text-center mb-10">
        <h1 className="text-4xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
          {bio.title}
        </h1>
        {bio.tagline && (
          <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
            {bio.tagline}
          </p>
        )}
      </div>

      {isBiographyEmpty(stats) ? (
        <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Nothing to read yet — switch to Edit to add stories, photos, and milestones.
        </p>
      ) : (
        <>
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            My Story in Numbers
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-10">
            {tiles.map((t) => (
              <Link
                key={t.label}
                to={t.to}
                className="rounded-xl border py-4 text-center transition-shadow hover:shadow-md"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="text-lg font-bold" style={{ color: "var(--color-text)" }}>{t.value}</div>
                <div className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>{t.label}</div>
              </Link>
            ))}
          </div>

          {stories.length > 0 && (
            <>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                  Stories
                </h2>
                {stories.length > HOME_STORY_LIMIT && (
                  <Link to="/stories" className="text-sm" style={{ color: "var(--color-primary)" }}>
                    View all
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {stories.slice(0, HOME_STORY_LIMIT).map((s) => (
                  <StoryCard key={s.id} story={s} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </ReadPage>
  );
}
