import { describe, it, expect } from "vitest";
import { isBiographyEmpty, filterPublishedStories, firstImageFromContent, formatDisplayDate, parseTags, formatFamilyName, formatShortDate, formatMonthYear, computeDuration, parseLinked, parseRelated } from "./reader-utils";
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

describe("web date formats", () => {
  it("treats an unset precision as year-only for story dates", () => {
    expect(formatDisplayDate("2017-02-14T00:00:00.000Z", null)).toBe("2017");
    expect(formatDisplayDate("2017-02-14T00:00:00.000Z", "day")).toBe("February 14, 2017");
  });
  it("formats milestone short dates", () => {
    expect(formatShortDate("2026-06-12T00:00:00.000Z", "day")).toBe("Jun 12, 2026");
    expect(formatShortDate("2026-06-01T00:00:00.000Z", "month")).toBe("Jun 2026");
    expect(formatShortDate("2026-06-01T00:00:00.000Z", "year")).toBe("2026");
  });
  it("shows only the year for January career dates", () => {
    expect(formatMonthYear("2022-01-01T00:00:00.000Z")).toBe("2022");
    expect(formatMonthYear("2022-04-01T00:00:00.000Z")).toBe("Apr 2022");
  });
  it("computes career durations", () => {
    expect(computeDuration("2020-01-01", "2022-04-01", false)).toBe("2 yrs 3 mo");
    expect(computeDuration("2020-01-01", "2021-01-01", false)).toBe("1 yr");
    expect(computeDuration("2020-01-01", "2020-01-20", false)).toBe("Less than a month");
    expect(computeDuration("2020-01-01", null, true, new Date(Date.UTC(2020, 5, 1)))).toBe("5 mo");
  });
  it("parses linked refs and related defensively", () => {
    expect(parseLinked('[{"remote_id":"a","title":"T"}]')).toEqual([{ remote_id: "a", title: "T" }]);
    expect(parseLinked("bad")).toEqual([]);
    expect(parseRelated(null).albums).toEqual([]);
    expect(parseRelated('{"albums":[{"title":"A"}]}').albums).toEqual([{ title: "A" }]);
  });
});
