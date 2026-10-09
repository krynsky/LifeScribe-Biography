import type { Story } from "./models";
import { parseTags } from "./reader-utils";

/** Everything the story editor lets you change, as plain editable values. */
export interface StoryForm {
  title: string;
  excerpt: string;
  content: string | null;
  featuredImage: string | null;
  eventDate: string | null;
  eventDatePrecision: "year" | "month" | "day";
  categoryId: number | null;
  tags: string[];
}

export interface StoryPatch {
  title?: string;
  excerpt?: string;
  content?: string | null;
  featured_image_path?: string | null;
  event_date?: string | null;
  event_date_precision?: "year" | "month" | "day";
  category_id?: number | null;
  tags?: string[];
}

export function storyToForm(story: Story & { category_id?: number | null }): StoryForm {
  const precision = (story.event_date_precision ?? "day") as StoryForm["eventDatePrecision"];
  return {
    title: story.title,
    excerpt: story.excerpt ?? "",
    content: story.content,
    featuredImage: story.featured_image_path,
    eventDate: story.event_date,
    eventDatePrecision: precision === "year" || precision === "month" ? precision : "day",
    categoryId: story.category_id ?? null,
    tags: parseTags(story.tags),
  };
}

const sameTags = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false;
  const norm = (x: string[]) => [...x].map((t) => t.toLowerCase()).sort();
  const [na, nb] = [norm(a), norm(b)];
  return na.every((t, i) => t === nb[i]);
};

/**
 * The minimal update that turns `saved` into `current`, or null when nothing changed.
 * A blank title is never saved (the previous title is kept) so autosave can't erase it.
 */
export function diffStory(saved: StoryForm, current: StoryForm): StoryPatch | null {
  const patch: StoryPatch = {};
  const title = current.title.trim();
  if (title && title !== saved.title) patch.title = title;
  if (current.excerpt !== saved.excerpt) patch.excerpt = current.excerpt;
  if (current.content !== saved.content) patch.content = current.content;
  if (current.featuredImage !== saved.featuredImage) patch.featured_image_path = current.featuredImage;
  if (current.eventDate !== saved.eventDate || current.eventDatePrecision !== saved.eventDatePrecision) {
    patch.event_date = current.eventDate;
    patch.event_date_precision = current.eventDatePrecision;
  }
  if (current.categoryId !== saved.categoryId) patch.category_id = current.categoryId;
  if (!sameTags(current.tags, saved.tags)) patch.tags = current.tags;
  return Object.keys(patch).length > 0 ? patch : null;
}
