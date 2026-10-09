import type { LinkTable } from "../data/links";

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
  /** Subset of extraColumns the app also sends on publish (the web accepts and stores them). */
  pushColumns?: string[];
  /** Remote image URLs downloaded to local files during refresh. */
  images?: ImageDef[];
  /** True when the web record can carry a category (name/color/icon) that maps to a local category. */
  categorized?: boolean;
  /** True when the web record carries a `tags` array of names. */
  tagged?: boolean;
  /** Link tables this record's pulled data populates (it is the "owner" side of each). */
  links?: LinkSpec[];
}

/** How a pulled field of `[{remote_id}]` refs becomes rows in a local link table. */
export interface LinkSpec {
  /** Dotted path within the pulled fields, e.g. "linked_stories" or "related.albums". */
  field: string;
  table: LinkTable;
  /** Column of `table` holding this record's local id. */
  ownerCol: string;
  /** Column of `table` holding the linked record's local id. */
  otherCol: string;
  /** Entity type whose sync_state resolves remote ids to local ids. */
  otherType: EntityType;
}

/** Pulled fields that feed categories, tags and links rather than being stored as columns. */
export function relationFields(def: EntityDef): string[] {
  const out: string[] = [];
  if (def.categorized) out.push("category", "category_color", "category_icon");
  if (def.tagged) out.push("tags");
  for (const l of def.links ?? []) out.push(l.field.split(".")[0]);
  return [...new Set(out)];
}

export interface ImageDef {
  /** Field on the pulled record holding the web image URL. */
  remoteField: string;
  /** Local column receiving the downloaded file path. */
  pathColumn: string;
}

export const ENTITIES: EntityDef[] = [
  {
    type: "biography",
    table: "biography",
    remoteKey: "biography",
    singleton: true,
    columns: ["title", "tagline", "bio"],
    extraColumns: ["subject_first_name", "subject_middle_name", "subject_last_name", "subject_maiden_name", "subject_suffix"],
    pushColumns: ["subject_first_name", "subject_middle_name", "subject_last_name", "subject_maiden_name", "subject_suffix"],
    images: [
      { remoteField: "banner_image_url", pathColumn: "cover_photo_path" },
      { remoteField: "profile_image_url", pathColumn: "avatar_photo_path" },
    ],
  },
  {
    type: "story",
    table: "stories",
    remoteKey: "stories",
    columns: ["title", "slug", "content", "excerpt", "status", "event_date", "event_date_precision"],
    extraColumns: ["author_name"],
    images: [{ remoteField: "featured_image_url", pathColumn: "featured_image_path" }],
    categorized: true,
    tagged: true,
    links: [{ field: "related.albums", table: "story_albums", ownerCol: "story_id", otherCol: "album_id", otherType: "album" }],
  },
  {
    type: "milestone",
    table: "milestones",
    remoteKey: "milestones",
    columns: ["title", "description", "date", "date_precision"],
    extraColumns: ["end_date", "end_date_precision", "position"],
    pushColumns: ["end_date", "end_date_precision"],
    images: [{ remoteField: "image_url", pathColumn: "image_path" }],
    categorized: true,
    links: [{ field: "linked_stories", table: "story_milestones", ownerCol: "milestone_id", otherCol: "story_id", otherType: "story" }],
  },
  {
    type: "career",
    table: "career_entries",
    remoteKey: "career",
    columns: ["organization", "title", "description", "start_date", "end_date", "is_current", "location"],
    extraColumns: ["employment_type"],
    pushColumns: ["employment_type"],
    images: [{ remoteField: "logo_url", pathColumn: "logo_path" }],
    categorized: true,
    links: [
      { field: "linked_stories", table: "story_career_entries", ownerCol: "career_entry_id", otherCol: "story_id", otherType: "story" },
      { field: "linked_albums", table: "album_career_entries", ownerCol: "career_entry_id", otherCol: "album_id", otherType: "album" },
    ],
  },
  {
    type: "map_pin",
    table: "map_pins",
    remoteKey: "map_pins",
    columns: ["name", "description", "latitude", "longitude"],
    extraColumns: ["position"],
    images: [{ remoteField: "image_url", pathColumn: "image_path" }],
    categorized: true,
    links: [
      { field: "linked_stories", table: "story_map_pins", ownerCol: "map_pin_id", otherCol: "story_id", otherType: "story" },
      { field: "linked_albums", table: "album_map_pins", ownerCol: "map_pin_id", otherCol: "album_id", otherType: "album" },
    ],
  },
  {
    type: "family_member",
    table: "family_members",
    remoteKey: "family_members",
    columns: ["given_name", "surname", "birth_date", "death_date", "bio"],
    extraColumns: ["gender", "birth_surname", "nickname", "suffix"],
    pushColumns: ["gender", "birth_surname", "nickname", "suffix"],
    images: [{ remoteField: "photo_url", pathColumn: "photo_path" }],
  },
  {
    type: "album",
    table: "albums",
    remoteKey: "albums",
    columns: ["name", "description", "cover_image"],
    extraColumns: ["position"],
    categorized: true,
    tagged: true,
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

/** Every column sent when publishing an entity: syncable columns plus the push-enabled extras. */
export function pushableColumns(def: EntityDef): string[] {
  return [...def.columns, ...(def.pushColumns ?? [])];
}

/** Human label for a record in lists ("Trip to Argentina", "Dev @ Org", "Jane Doe"). */
export function entityLabel(type: EntityType, fields: Record<string, unknown>): string {
  const str = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string).trim() : "");
  switch (type) {
    case "story":
    case "milestone":
      return str("title") || "Untitled";
    case "career":
      return [str("title"), str("organization")].filter(Boolean).join(" @ ") || "Career entry";
    case "map_pin":
    case "album":
      return str("name") || "Untitled";
    case "family_member":
      return [str("given_name"), str("surname")].filter(Boolean).join(" ") || "Family member";
    case "biography":
      return str("title") || "Profile";
    default:
      return str("filename") || "Item";
  }
}

/** A join table a published record "owns" (it is the side the user edits links from). */
export interface PushLinkSpec {
  table: LinkTable;
  /** Which side of the table the record is: a = first-named (story/album), b = second-named. */
  owner: "a" | "b";
  ownerCol: string;
  otherCol: string;
  otherType: EntityType;
}

/**
 * Links sent when a record is published. Only the sides the app lets you edit: the story editor owns
 * its four link tables; milestone, career and place editors own their story and album links.
 */
export const PUSH_LINKS: Partial<Record<EntityType, PushLinkSpec[]>> = {
  story: [
    { table: "story_milestones", owner: "a", ownerCol: "story_id", otherCol: "milestone_id", otherType: "milestone" },
    { table: "story_albums", owner: "a", ownerCol: "story_id", otherCol: "album_id", otherType: "album" },
    { table: "story_map_pins", owner: "a", ownerCol: "story_id", otherCol: "map_pin_id", otherType: "map_pin" },
    { table: "story_career_entries", owner: "a", ownerCol: "story_id", otherCol: "career_entry_id", otherType: "career" },
  ],
  milestone: [
    { table: "story_milestones", owner: "b", ownerCol: "milestone_id", otherCol: "story_id", otherType: "story" },
    { table: "album_milestones", owner: "b", ownerCol: "milestone_id", otherCol: "album_id", otherType: "album" },
  ],
  career: [
    { table: "story_career_entries", owner: "b", ownerCol: "career_entry_id", otherCol: "story_id", otherType: "story" },
    { table: "album_career_entries", owner: "b", ownerCol: "career_entry_id", otherCol: "album_id", otherType: "album" },
  ],
  map_pin: [
    { table: "story_map_pins", owner: "b", ownerCol: "map_pin_id", otherCol: "story_id", otherType: "story" },
    { table: "album_map_pins", owner: "b", ownerCol: "map_pin_id", otherCol: "album_id", otherType: "album" },
  ],
};
