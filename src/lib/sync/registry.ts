export type EntityType =
  | "biography"
  | "story"
  | "milestone"
  | "career"
  | "map_pin"
  | "family_member"
  | "album"
  | "media";

export interface EntityDef {
  type: EntityType;
  /** Local SQLite table name. */
  table: string;
  /** Array key under `data` in the /sync/pull response, and field key in /sync/push payload. */
  remoteKey: string;
  /** Syncable local columns (NOT id/created_at/updated_at). */
  columns: string[];
  /** True for the single-row biography table (local id = 1). */
  singleton?: boolean;
  /** Media is downloaded as binary files rather than upserted as a row of fields. */
  binary?: boolean;
}

export const ENTITIES: EntityDef[] = [
  {
    type: "biography",
    table: "biography",
    remoteKey: "biography",
    singleton: true,
    columns: ["title", "tagline", "bio"],
  },
  {
    type: "story",
    table: "stories",
    remoteKey: "stories",
    columns: ["title", "slug", "content", "excerpt", "status", "event_date", "event_date_precision"],
  },
  {
    type: "milestone",
    table: "milestones",
    remoteKey: "milestones",
    columns: ["title", "description", "date", "date_precision"],
  },
  {
    type: "career",
    table: "career_entries",
    remoteKey: "career",
    columns: ["organization", "title", "description", "start_date", "end_date", "is_current", "location"],
  },
  {
    type: "map_pin",
    table: "map_pins",
    remoteKey: "map_pins",
    columns: ["name", "description", "latitude", "longitude"],
  },
  {
    type: "family_member",
    table: "family_members",
    remoteKey: "family_members",
    columns: ["given_name", "surname", "birth_date", "death_date", "bio"],
  },
  {
    type: "album",
    table: "albums",
    remoteKey: "albums",
    columns: ["name", "description"],
  },
  {
    type: "media",
    table: "media",
    remoteKey: "media",
    binary: true,
    columns: ["filename", "caption", "file_size", "album_id"],
  },
];

export function entityDef(type: EntityType): EntityDef {
  const def = ENTITIES.find((e) => e.type === type);
  if (!def) throw new Error(`Unknown entity type: ${type}`);
  return def;
}
