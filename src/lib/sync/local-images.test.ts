import { describe, it, expect } from "vitest";
import { hasLocalImages } from "./local-images";

describe("hasLocalImages", () => {
  const doc = (src: string) => JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src } }] });
  it("flags Tauri asset URLs", () => {
    expect(hasLocalImages(doc("http://asset.localhost/C%3A%5Cimg%5Ca.jpg"))).toBe(true);
    expect(hasLocalImages(doc("https://asset.localhost/x.jpg"))).toBe(true);
    expect(hasLocalImages(doc("asset://localhost/C%3A/a.jpg"))).toBe(true);
  });
  it("ignores web images and plain text", () => {
    expect(hasLocalImages(doc("https://files.lifescribe.us/a.jpg"))).toBe(false);
    expect(hasLocalImages("a story that mentions asset.localhost in prose")).toBe(false);
    expect(hasLocalImages(null)).toBe(false);
  });
});
