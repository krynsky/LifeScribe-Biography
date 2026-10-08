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

  const banner = imageSrc(bio.cover_photo_path);
  // The public home page only shows tiles for sections that have content.
  const tiles = [
    { icon: "📝", value: stories.length, label: "Stories", to: "/stories" },
    { icon: "📅", value: stats.milestoneCount, label: "Milestones", to: "/timeline" },
    { icon: "🖼️", value: stats.albumCount, label: "Albums", to: "/gallery" },
    { icon: "💼", value: stats.careerCount, label: "Career", to: "/career" },
    { icon: "🌳", value: stats.familyMemberCount, label: "Family Members", to: "/family-tree" },
    { icon: "📍", value: stats.mapPinCount, label: "Places", to: "/maps" },
  ].filter((t) => t.value > 0);

  return (
    <ReadPage>
      {banner && (
        <img src={banner} alt="" role="presentation" className="block h-48 w-full rounded-xl object-cover sm:h-64 md:h-80" />
      )}

      <section className={`pb-10 text-center ${banner ? "pt-8" : "pt-6"}`}>
        <h1 className="text-4xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
          {bio.title}
        </h1>
        {bio.tagline && (
          <p className="mt-3 text-xl" style={{ color: "var(--color-text-secondary)" }}>
            {bio.tagline}
          </p>
        )}
        {bio.bio && (
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {bio.bio}
          </p>
        )}
      </section>

      {isBiographyEmpty(stats) ? (
        <p className="text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
          Nothing to read yet — switch to Edit to add stories, photos, and milestones.
        </p>
      ) : (
        <>
          {tiles.length > 0 && (
            <section className="mb-12">
              <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                My Story in Numbers
              </h2>
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {tiles.map((t) => (
                  <Link
                    key={t.label}
                    to={t.to}
                    className="flex flex-col items-center rounded-xl border px-2 py-4 text-center transition-shadow hover:shadow-md"
                    style={{ background: "var(--color-surface)", borderColor: "var(--color-border-light)", boxShadow: "var(--shadow-card)" }}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="mt-1.5 text-xl font-bold" style={{ color: "var(--color-text)" }}>{t.value}</span>
                    <span className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>{t.label}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-2">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
              Stories
            </h2>
            {stories.length === 0 ? (
              <div className="mt-6 rounded-xl border-2 border-dashed py-14 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                No stories published yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {stories.slice(0, HOME_STORY_LIMIT).map((s) => (
                  <StoryCard key={s.id} story={s} placeholder={false} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </ReadPage>
  );
}
