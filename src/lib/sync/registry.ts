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
  /**
   * Web-owned columns mirrored locally for display. Written on refresh, never
   * pushed, and ignored by dirty detection (which uses updated_at).
   */
  extraColumns?: string[];
  /** Remote image URLs downloaded to local files during refresh. */
  images?: ImageDef[];
}

export interface ImageDef {
  /** Field on the pulled record holding the web image URL. */
  remoteField: string;
  /** Local column receiving the downloaded file path. */
  pathColumn: string;
}

const CATEGORY_COLUMNS = ["category", "category_color", "category_icon"];

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
    extraColumns: [...CATEGORY_COLUMNS, "tags"],
    images: [{ remoteField: "featured_image_url", pathColumn: "featured_image_path" }],
  },
  {
    type: "milestone",
    table: "milestones",
    remoteKey: "milestones",
    columns: ["title", "description", "date", "date_precision"],
    // milestones already have a local `category` column
    extraColumns: ["category", "category_color", "category_icon"],
    images: [{ remoteField: "image_url", pathColumn: "image_path" }],
  },
  {
    type: "career",
    table: "career_entries",
    remoteKey: "career",
    columns: ["organization", "title", "description", "start_date", "end_date", "is_current", "location"],
    extraColumns: ["employment_type", ...CATEGORY_COLUMNS],
    images: [{ remoteField: "logo_url", pathColumn: "logo_path" }],
  },
  {
    type: "map_pin",
    table: "map_pins",
    remoteKey: "map_pins",
    columns: ["name", "description", "latitude", "longitude"],
    extraColumns: CATEGORY_COLUMNS,
    images: [{ remoteField: "image_url", pathColumn: "image_path" }],
  },
  {
    type: "family_member",
    table: "family_members",
    remoteKey: "family_members",
    columns: ["given_name", "surname", "birth_date", "death_date", "bio"],
    extraColumns: ["gender", "birth_surname", "nickname", "suffix"],
    images: [{ remoteField: "photo_url", pathColumn: "photo_path" }],
  },
  {
    type: "album",
    table: "albums",
    remoteKey: "albums",
    columns: ["name", "description", "cover_image"],
    extraColumns: [...CATEGORY_COLUMNS, "tags"],
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

/** Every column a refresh writes for an entity: syncable + web-owned extras + image path/src columns. */
export function writableColumns(def: EntityDef): string[] {
  return [
    ...def.columns,
    ...(def.extraColumns ?? []),
    ...(def.images ?? []).map((i) => i.pathColumn),
  ];
}
