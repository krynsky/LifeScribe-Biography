import { describe, it, expect } from "vitest";
import { isBiographyEmpty, filterPublishedStories } from "./reader-utils";
import type { Story } from "./models";

describe("isBiographyEmpty", () => {
  it("returns true when every count is zero", () => {
    expect(
      isBiographyEmpty({
        storyCount: 0, milestoneCount: 0, mediaCount: 0,
        familyMemberCount: 0, careerCount: 0, mapPinCount: 0,
      })
    ).toBe(true);
  });

  it("returns false when any single count is non-zero", () => {
    expect(
      isBiographyEmpty({
        storyCount: 1, milestoneCount: 0, mediaCount: 0,
        familyMemberCount: 0, careerCount: 0, mapPinCount: 0,
      })
    ).toBe(false);
    expect(
      isBiographyEmpty({
        storyCount: 0, milestoneCount: 0, mediaCount: 0,
        familyMemberCount: 0, careerCount: 0, mapPinCount: 3,
      })
    ).toBe(false);
  });
});

function story(overrides: Partial<Story>): Story {
  return {
    id: 1, title: "T", slug: null, content: null, excerpt: null,
    status: "draft", event_date: null, event_date_precision: "day",
    featured_image_path: null, view_count: 0,
    created_at: "2026-01-01", updated_at: "2026-01-01",
    ...overrides,
  };
}

describe("filterPublishedStories", () => {
  it("keeps only published stories", () => {
    const stories = [
      story({ id: 1, status: "published" }),
      story({ id: 2, status: "draft" }),
      story({ id: 3, status: "published" }),
    ];
    const result = filterPublishedStories(stories);
    expect(result.map((s) => s.id)).toEqual([1, 3]);
  });

  it("returns an empty array when nothing is published", () => {
    expect(filterPublishedStories([story({ status: "draft" })])).toEqual([]);
  });
});
