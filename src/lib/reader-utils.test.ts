import { describe, it, expect } from "vitest";
import { isBiographyEmpty, filterPublishedStories, firstImageFromContent, formatDisplayDate, parseTags, formatFamilyName } from "./reader-utils";
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

describe("firstImageFromContent", () => {
  it("finds the first nested image src", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hi" }] },
        { type: "image", attrs: { src: "a.png" } },
        { type: "image", attrs: { src: "b.png" } },
      ],
    });
    expect(firstImageFromContent(doc)).toBe("a.png");
  });
  it("returns null for empty or malformed content", () => {
    expect(firstImageFromContent(null)).toBeNull();
    expect(firstImageFromContent("not json")).toBeNull();
  });
});

describe("formatDisplayDate", () => {
  it("formats by precision", () => {
    expect(formatDisplayDate("2017-02-14", "year")).toBe("2017");
    expect(formatDisplayDate("2017-02-14", "month")).toBe("February 2017");
    expect(formatDisplayDate("2017-02-14", "day")).toBe("February 14, 2017");
    expect(formatDisplayDate(null)).toBe("");
  });
});

describe("parseTags", () => {
  it("parses a JSON array and tolerates junk", () => {
    expect(parseTags('["Chicago","Family"]')).toEqual(["Chicago", "Family"]);
    expect(parseTags(null)).toEqual([]);
    expect(parseTags("nope")).toEqual([]);
    expect(parseTags('{"a":1}')).toEqual([]);
  });
});

describe("formatFamilyName", () => {
  it("adds née and suffix like the web", () => {
    expect(formatFamilyName({ given_name: "Alicia", surname: "Krynsky", birth_surname: "Spika" })).toBe("Alicia Krynsky (née Spika)");
    expect(formatFamilyName({ given_name: "John", surname: "Doe", suffix: "Jr." })).toBe("John Doe, Jr.");
    expect(formatFamilyName({ given_name: "Mark", surname: null })).toBe("Mark");
  });
});
