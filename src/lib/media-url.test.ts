import { describe, it, expect } from "vitest";
import { planMediaUrl } from "./media-url";

describe("planMediaUrl", () => {
  it("recognises YouTube and Vimeo automatically", () => {
    expect(planMediaUrl("https://youtu.be/dTPov5REUPs")).toMatchObject({
      kind: "youtube",
      url: "https://www.youtube.com/embed/dTPov5REUPs",
      thumbnailUrl: "https://img.youtube.com/vi/dTPov5REUPs/hqdefault.jpg",
    });
    expect(planMediaUrl("https://vimeo.com/123456/abcdef12")).toMatchObject({ kind: "vimeo", oembedUrl: "https://vimeo.com/123456/abcdef12" });
  });

  it("treats direct video files and the video hint as video, everything else as image", () => {
    expect(planMediaUrl("https://example.com/clips/trip.MP4")).toMatchObject({ kind: "video-file", filename: "trip.MP4" });
    expect(planMediaUrl("https://example.com/watch", "video")).toMatchObject({ kind: "video-file" });
    expect(planMediaUrl("https://example.com/photos/me%20and%20you.jpg")).toMatchObject({ kind: "image", filename: "me and you.jpg" });
  });

  it("rejects empty, malformed and non-https links", () => {
    expect(planMediaUrl("").kind).toBe("invalid");
    expect(planMediaUrl("not a url").kind).toBe("invalid");
    expect(planMediaUrl("http://example.com/a.jpg")).toEqual({ kind: "invalid", reason: "Only https:// links are supported." });
    expect(planMediaUrl("javascript:alert(1)").kind).toBe("invalid");
  });
});
