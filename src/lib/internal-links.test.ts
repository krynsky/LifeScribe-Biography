import { describe, expect, it } from "vitest";
import { isInternalHref } from "./internal-links";

describe("isInternalHref", () => {
  it("recognises in-biography addresses", () => {
    expect(isInternalHref("/stories/how-my-career-path-began")).toBe(true);
    expect(isInternalHref("/gallery/42")).toBe(true);
    expect(isInternalHref("/timeline")).toBe(true);
  });
  it("still understands older website-style addresses", () => {
    expect(isInternalHref("/bio/mark-krynsky/stories/how-my-career-path-began")).toBe(true);
    expect(isInternalHref("https://lifescribe.us/bio/mark-krynsky/gallery/42")).toBe(true);
  });
  it("leaves everything else alone", () => {
    expect(isInternalHref("https://example.com/stories/y")).toBe(false);
    expect(isInternalHref("/somewhere-else/x")).toBe(false);
    expect(isInternalHref("mailto:a@b.co")).toBe(false);
    expect(isInternalHref("")).toBe(false);
  });
});
