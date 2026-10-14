import { describe, expect, it } from "vitest";
import { isInternalHref } from "./internal-links";

describe("isInternalHref", () => {
  it("recognises the website's biography addresses", () => {
    expect(isInternalHref("/bio/mark-krynsky/stories/how-my-career-path-began")).toBe(true);
    expect(isInternalHref("https://lifescribe.us/bio/mark-krynsky/gallery/42")).toBe(true);
    expect(isInternalHref("/bio/mark-krynsky")).toBe(true);
  });
  it("leaves everything else alone", () => {
    expect(isInternalHref("https://example.com/bio/x/stories/y")).toBe(false);
    expect(isInternalHref("mailto:a@b.co")).toBe(false);
    expect(isInternalHref("")).toBe(false);
  });
});
