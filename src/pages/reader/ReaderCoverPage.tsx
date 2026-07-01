import { useEffect, useState } from "react";
import { getBiography, getBiographyStats } from "@/lib/actions/biography";
import { localFileUrl } from "@/lib/db";
import { isBiographyEmpty } from "@/lib/reader-utils";
import type { Biography } from "@/lib/models";

interface Stats {
  storyCount: number;
  milestoneCount: number;
  mediaCount: number;
  albumCount: number;
  familyMemberCount: number;
  careerCount: number;
  mapPinCount: number;
}

export default function ReaderCoverPage() {
  const [bio, setBio] = useState<Biography | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([getBiography(), getBiographyStats()]).then(([b, s]) => {
      setBio(b);
      setStats(s);
    });
  }, []);

  if (!bio || !stats) {
    return (
      <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Loading…
      </div>
    );
  }

  const backgroundImage = bio.cover_photo_path
    ? localFileUrl(bio.cover_photo_path)
    : bio.avatar_photo_path
      ? localFileUrl(bio.avatar_photo_path)
      : null;

  const empty = isBiographyEmpty(stats);

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center text-center px-8"
      style={{
        background: backgroundImage
          ? `linear-gradient(rgba(20,16,12,0.55), rgba(20,16,12,0.55)), url(${backgroundImage}) center/cover no-repeat`
          : "linear-gradient(135deg, #2b2620, #4a4038)",
        color: "#f5f0e8",
      }}
    >
      <h1 className="text-4xl mb-3" style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.5px" }}>
        {bio.title}
      </h1>
      {bio.tagline && <p className="text-base opacity-85 max-w-lg">{bio.tagline}</p>}
      <p className="text-xs mt-10 opacity-60">
        {empty
          ? "Nothing to read yet — add stories, photos, and milestones from the editor."
          : "↓ choose a section from the left to begin reading"}
      </p>
    </div>
  );
}
