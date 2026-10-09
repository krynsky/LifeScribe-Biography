import { describe, it, expect } from "vitest";
import { hashBytes, imageExtension, imageMimeType, isInsideLibrary, isSupportedImage, libraryFileName } from "./image-library";

describe("mime and support checks", () => {
  it("maps extensions to mime types", () => {
    expect(imageMimeType("a.JPG")).toBe("image/jpeg");
    expect(imageMimeType("a.png")).toBe("image/png");
    expect(imageMimeType("a.webp")).toBe("image/webp");
  });
  it("only accepts supported image files", () => {
    expect(isSupportedImage("C:\\x\\a.PNG")).toBe(true);
    expect(isSupportedImage("notes.txt")).toBe(false);
    expect(isSupportedImage("noext")).toBe(false);
  });
});

describe("image library helpers", () => {
  it("normalizes extensions and defaults unknown ones to jpg", () => {
    expect(imageExtension("C:\\Pics\\Me.PNG")).toBe("png");
    expect(imageExtension("/a/b/photo.jpeg")).toBe("jpeg");
    expect(imageExtension("noext")).toBe("jpg");
    expect(imageExtension("evil.exe")).toBe("jpg");
  });

  it("names files by content so the same image is stored once", async () => {
    const a = new TextEncoder().encode("same bytes");
    const b = new TextEncoder().encode("same bytes");
    const c = new TextEncoder().encode("other");
    expect(await hashBytes(a)).toBe(await hashBytes(b));
    expect(await hashBytes(a)).not.toBe(await hashBytes(c));
    expect(await libraryFileName(a, "x.PNG")).toMatch(/^[0-9a-f]{24}\.png$/);
  });

  it("detects files already in the library regardless of slash style or case", () => {
    expect(isInsideLibrary("C:\\Users\\x\\AppData\\Local\\app\\images\\a.jpg", "C:/Users/x/AppData/Local/app/images")).toBe(true);
    expect(isInsideLibrary("C:/Users/x/Pictures/a.jpg", "C:/Users/x/AppData/Local/app/images")).toBe(false);
    expect(isInsideLibrary("C:/Users/x/AppData/Local/app/images2/a.jpg", "C:/Users/x/AppData/Local/app/images")).toBe(false);
  });
});
