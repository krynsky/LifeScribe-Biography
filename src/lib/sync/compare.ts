import { entityDef, pushableColumns, type EntityType } from "./registry";

export interface FieldDiff {
  key: string;
  label: string;
  mine: string;
  web: string;
}

const LABELS: Record<string, string> = {
  title: "Title",
  name: "Name",
  slug: "Web address",
  content: "Text",
  excerpt: "Summary",
  status: "Status",
  event_date: "Date",
  event_date_precision: "Date detail",
  date: "Date",
  date_precision: "Date detail",
  end_date: "End date",
  end_date_precision: "End date detail",
  description: "Description",
  bio: "Bio",
  tagline: "Tagline",
  organization: "Company",
  start_date: "Start",
  is_current: "Current position",
  location: "Location",
  employment_type: "Employment type",
  latitude: "Latitude",
  longitude: "Longitude",
  given_name: "First name",
  surname: "Last name",
  birth_date: "Birth date",
  death_date: "Death date",
  gender: "Gender",
  birth_surname: "Birth surname",
  nickname: "Nickname",
  suffix: "Suffix",
  subject_first_name: "Subject first name",
  subject_middle_name: "Subject middle name",
  subject_last_name: "Subject last name",
  subject_maiden_name: "Subject maiden name",
  subject_suffix: "Subject suffix",
  cover_image: "Cover image",
};

const DATE_KEYS = new Set(["event_date", "date", "end_date", "start_date", "birth_date", "death_date"]);

/** Readable text from a Tiptap document (JSON string), one paragraph per line. */
export function plainTextFromDoc(json: unknown): string {
  if (typeof json !== "string") return "";
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return json;
  }
  const lines: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) lines.push(current.trim());
    current = "";
  };
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === "string") current += n.text;
    else if (n.type === "hardBreak") current += " ";
    for (const child of n.content ?? []) walk(child);
    if (n.type && n.type !== "text" && n.type !== "doc" && n.type !== "hardBreak") flush();
  };
  walk(doc);
  flush();
  return lines.join("\n");
}

function show(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (key === "content") return plainTextFromDoc(value);
  if (DATE_KEYS.has(key) && typeof value === "string") return value.substring(0, 10);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "is_current") return value ? "Yes" : "No";
  return String(value);
}

/**
 * The text fields that differ between the app's version of a record and the website's, for the
 * conflict screen. Empty values compare equal, dates compare by day, and long text is shortened.
 */
export function diffFields(type: EntityType, local: Record<string, unknown>, remote: Record<string, unknown>): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const key of pushableColumns(entityDef(type))) {
    if (!(key in local) || !(key in remote)) continue;
    if (key === "slug" || key.endsWith("_precision")) continue; // internal details, not worth showing
    const mine = show(key, local[key]);
    const web = show(key, remote[key]);
    if (mine === web) continue;
    const clip = (t: string) => (t.length > 600 ? `${t.slice(0, 600)}…` : t);
    diffs.push({ key, label: LABELS[key] ?? key, mine: clip(mine), web: clip(web) });
  }
  return diffs;
}
