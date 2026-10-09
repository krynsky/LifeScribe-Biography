import type { Story } from "./models";

export interface BiographyStats {
  storyCount: number;
  milestoneCount: number;
  mediaCount: number;
  familyMemberCount: number;
  careerCount: number;
  mapPinCount: number;
}

/** True when there is nothing anywhere in the biography to read yet. */
export function isBiographyEmpty(stats: BiographyStats): boolean {
  return (
    stats.storyCount === 0 &&
    stats.milestoneCount === 0 &&
    stats.mediaCount === 0 &&
    stats.familyMemberCount === 0 &&
    stats.careerCount === 0 &&
    stats.mapPinCount === 0
  );
}

/** Defensive filter so Reader Mode can never show an unpublished story. */
export function filterPublishedStories(stories: Story[]): Story[] {
  return stories.filter((s) => s.status === "published");
}

/** First image `src` found in a Tiptap JSON document, used as a card cover fallback. */
export function firstImageFromContent(content: string | null): string | null {
  if (!content) return null;
  try {
    const stack: unknown[] = [JSON.parse(content)];
    while (stack.length) {
      const node = stack.shift() as { type?: string; attrs?: { src?: string }; content?: unknown[] } | null;
      if (!node || typeof node !== "object") continue;
      if (node.type === "image" && node.attrs?.src) return node.attrs.src;
      if (Array.isArray(node.content)) stack.unshift(...node.content);
    }
  } catch {
    /* malformed content — no cover */
  }
  return null;
}

/** Format a stored date at its precision, e.g. "2017-02" -> "February 2017". */
export function formatDisplayDate(date: string | null, precision: "year" | "month" | "day" | string | null = "day"): string {
  if (!date) return "";
  const year = date.substring(0, 4);
  // The web treats an unset precision as year-only; only an explicit day/month shows more.
  const p = (precision ?? "").toLowerCase();
  if (p !== "day" && p !== "month") return year;
  precision = p;
  const month = Number(date.substring(5, 7));
  const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  if (!month || month > 12) return year;
  if (precision === "month") return `${names[month - 1]} ${year}`;
  const day = Number(date.substring(8, 10));
  return day ? `${names[month - 1]} ${day}, ${year}` : `${names[month - 1]} ${year}`;
}

/** Parse the JSON-array tag column synced from the web into a clean list of names. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && t.length > 0) : [];
  } catch {
    return [];
  }
}

/** Web-style display name, e.g. "Maria Gonzalez (née Lopez), Jr." */
export function formatFamilyName(m: {
  given_name: string;
  surname?: string | null;
  birth_surname?: string | null;
  suffix?: string | null;
}): string {
  let name = `${m.given_name} ${m.surname ?? ""}`.trim();
  if (m.birth_surname && m.birth_surname !== m.surname) name += ` (née ${m.birth_surname})`;
  if (m.suffix) name += `, ${m.suffix}`;
  return name || "Unnamed";
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Milestone date, short form like the public timeline: "Jun 12, 2026", "Jun 2026", "2026". */
export function formatShortDate(date: string | null, precision: string | null = "day"): string {
  if (!date) return "";
  const year = date.substring(0, 4);
  const p = (precision ?? "day").toLowerCase();
  if (p === "year") return year;
  const month = Number(date.substring(5, 7));
  if (!month || month > 12) return year;
  if (p === "month") return `${SHORT_MONTHS[month - 1]} ${year}`;
  const day = Number(date.substring(8, 10));
  return day ? `${SHORT_MONTHS[month - 1]} ${day}, ${year}` : `${SHORT_MONTHS[month - 1]} ${year}`;
}

/** Career date: "Mon YYYY", or just "YYYY" for January (the year-only default), like the web. */
export function formatMonthYear(date: string | null): string {
  if (!date) return "";
  const year = date.substring(0, 4);
  const month = Number(date.substring(5, 7));
  if (!month || month === 1) return year;
  return `${SHORT_MONTHS[month - 1]} ${year}`;
}

/** Career range duration, e.g. "2 yrs 3 mo", "Present", "Less than a month". */
export function computeDuration(start: string | null, end: string | null, isCurrent: boolean, now: Date = new Date()): string {
  if (!start) return "";
  const sy = Number(start.substring(0, 4));
  const sm = Number(start.substring(5, 7)) - 1;
  const ey = end ? Number(end.substring(0, 4)) : now.getUTCFullYear();
  const em = end ? Number(end.substring(5, 7)) - 1 : now.getUTCMonth();
  const months = (ey - sy) * 12 + (em - sm);
  if (months < 1) return isCurrent ? "Present" : "Less than a month";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (rem > 0) parts.push(`${rem} mo`);
  return parts.join(" ");
}
