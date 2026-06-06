import { query, execute } from "../db";
import type { Biography } from "../models";

export async function getBiography(): Promise<Biography> {
  const rows = await query<Biography>("SELECT * FROM biography WHERE id = 1");
  return rows[0];
}

export async function updateBiography(
  data: Partial<Omit<Biography, "id" | "created_at" | "updated_at" | "synced_at" | "remote_id">>
): Promise<void> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return;

  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);

  await execute(
    `UPDATE biography SET ${setClauses}, updated_at = datetime('now') WHERE id = 1`,
    values
  );
}

export async function getBiographyStats(): Promise<{
  storyCount: number;
  milestoneCount: number;
  mediaCount: number;
  albumCount: number;
  familyMemberCount: number;
  careerCount: number;
  mapPinCount: number;
}> {
  const [stories, milestones, media, albums, family, career, pins] =
    await Promise.all([
      query<{ count: number }>("SELECT COUNT(*) as count FROM stories"),
      query<{ count: number }>("SELECT COUNT(*) as count FROM milestones"),
      query<{ count: number }>("SELECT COUNT(*) as count FROM media"),
      query<{ count: number }>("SELECT COUNT(*) as count FROM albums"),
      query<{ count: number }>("SELECT COUNT(*) as count FROM family_members"),
      query<{ count: number }>("SELECT COUNT(*) as count FROM career_entries"),
      query<{ count: number }>("SELECT COUNT(*) as count FROM map_pins"),
    ]);

  return {
    storyCount: stories[0]?.count ?? 0,
    milestoneCount: milestones[0]?.count ?? 0,
    mediaCount: media[0]?.count ?? 0,
    albumCount: albums[0]?.count ?? 0,
    familyMemberCount: family[0]?.count ?? 0,
    careerCount: career[0]?.count ?? 0,
    mapPinCount: pins[0]?.count ?? 0,
  };
}
