import { describe, it, expect } from "vitest";
import { diffFields, plainTextFromDoc } from "./compare";

const doc = (...paras: string[]) =>
  JSON.stringify({ type: "doc", content: paras.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })) });

describe("plainTextFromDoc", () => {
  it("reads paragraphs as lines", () => {
    expect(plainTextFromDoc(doc("First", "Second"))).toBe("First\nSecond");
  });
  it("tolerates plain text and junk", () => {
    expect(plainTextFromDoc("just words")).toBe("just words");
    expect(plainTextFromDoc(null)).toBe("");
  });
});

describe("diffFields", () => {
  it("lists only the text fields that differ, with friendly labels", () => {
    const diffs = diffFields(
      "story",
      { title: "Same", excerpt: "Mine", content: doc("My words"), status: "draft" },
      { title: "Same", excerpt: "Theirs", content: doc("Web words"), status: "draft" }
    );
    expect(diffs.map((d) => d.label)).toEqual(["Text", "Summary"]);
    expect(diffs[0]).toMatchObject({ mine: "My words", web: "Web words" });
    expect(diffs[1]).toMatchObject({ mine: "Mine", web: "Theirs" });
  });

  it("treats empty values as equal and compares dates by day", () => {
    expect(diffFields("milestone", { title: "A", description: null, date: "2017-02-14" }, { title: "A", description: "", date: "2017-02-14T00:00:00.000Z" })).toEqual([]);
    expect(diffFields("milestone", { date: "2017-02-14" }, { date: "2017-02-15T00:00:00.000Z" })).toEqual([{ key: "date", label: "Date", mine: "2017-02-14", web: "2017-02-15" }]);
  });

  it("skips internal fields and fields missing on one side", () => {
    expect(diffFields("story", { slug: "a", event_date_precision: "day" }, { slug: "b", event_date_precision: "year" })).toEqual([]);
    expect(diffFields("story", { title: "Only local" }, {})).toEqual([]);
  });

  it("shortens very long text", () => {
    const [d] = diffFields("story", { excerpt: "x".repeat(2000) }, { excerpt: "y" });
    expect(d.mine.length).toBe(601);
    expect(d.mine.endsWith("…")).toBe(true);
  });
});
