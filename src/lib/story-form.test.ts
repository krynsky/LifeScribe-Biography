import { describe, it, expect } from "vitest";
import { diffStory, storyToForm, type StoryForm } from "./story-form";
import type { Story } from "./models";

const base: StoryForm = {
  title: "Trip",
  excerpt: "",
  content: null,
  featuredImage: null,
  eventDate: "2017-02-01",
  eventDatePrecision: "month",
  categoryId: 1,
  tags: ["Chicago", "Family"],
};

describe("diffStory", () => {
  it("returns null when nothing changed", () => {
    expect(diffStory(base, { ...base })).toBeNull();
  });

  it("returns only what changed", () => {
    expect(diffStory(base, { ...base, excerpt: "Hi" })).toEqual({ excerpt: "Hi" });
    expect(diffStory(base, { ...base, featuredImage: "C:/img/a.jpg" })).toEqual({ featured_image_path: "C:/img/a.jpg" });
    expect(diffStory(base, { ...base, categoryId: null })).toEqual({ category_id: null });
    expect(diffStory(base, { ...base, content: '{"a":1}' })).toEqual({ content: '{"a":1}' });
  });

  it("sends date and precision together", () => {
    expect(diffStory(base, { ...base, eventDate: "2017-02-14", eventDatePrecision: "day" })).toEqual({
      event_date: "2017-02-14",
      event_date_precision: "day",
    });
    expect(diffStory(base, { ...base, eventDate: null })).toEqual({ event_date: null, event_date_precision: "month" });
  });

  it("never saves a blank title and trims a real one", () => {
    expect(diffStory(base, { ...base, title: "   " })).toBeNull();
    expect(diffStory(base, { ...base, title: "  New  " })).toEqual({ title: "New" });
  });

  it("compares tags regardless of order or case", () => {
    expect(diffStory(base, { ...base, tags: ["family", "CHICAGO"] })).toBeNull();
    expect(diffStory(base, { ...base, tags: ["Chicago"] })).toEqual({ tags: ["Chicago"] });
  });
});

describe("storyToForm", () => {
  it("maps a story row, defaulting unset precision to day and parsing JSON tags", () => {
    const story = {
      id: 1, title: "T", slug: "t", content: "{}", excerpt: null, status: "draft",
      event_date: "2000-01-01", event_date_precision: null, featured_image_path: "p.jpg",
      view_count: 0, created_at: "", updated_at: "", tags: '["a","b"]', category_id: 3,
    } as unknown as Story;
    expect(storyToForm(story)).toEqual({
      title: "T", excerpt: "", content: "{}", featuredImage: "p.jpg",
      eventDate: "2000-01-01", eventDatePrecision: "day", categoryId: 3, tags: ["a", "b"],
    });
  });
});
