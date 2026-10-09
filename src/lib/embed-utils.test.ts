import { describe, it, expect } from "vitest";
import { keylessMapsEmbed, mapsQueryFromUrl, parseVimeoUrl, parseYouTubeUrl, planEmbed } from "./embed-utils";

describe("parseYouTubeUrl", () => {
  it("handles watch, short, shorts and embed URLs", () => {
    const id = "dTPov5REUPs";
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${id}&t=3`)?.embedUrl).toBe(`https://www.youtube.com/embed/${id}`);
    expect(parseYouTubeUrl(`https://youtu.be/${id}?si=x`)?.videoId).toBe(id);
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${id}`)?.videoId).toBe(id);
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${id}`)?.videoId).toBe(id);
  });
  it("rejects bad ids and other hosts", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeUrl("https://example.com/watch?v=dTPov5REUPs")).toBeNull();
    expect(parseYouTubeUrl("nope")).toBeNull();
  });
});

describe("parseVimeoUrl", () => {
  it("handles plain, unlisted and player URLs", () => {
    expect(parseVimeoUrl("https://vimeo.com/123456")?.embedUrl).toBe("https://player.vimeo.com/video/123456");
    expect(parseVimeoUrl("https://vimeo.com/123456/abcdef12")?.embedUrl).toBe("https://player.vimeo.com/video/123456?h=abcdef12");
    expect(parseVimeoUrl("https://player.vimeo.com/video/987")?.videoId).toBe("987");
    expect(parseVimeoUrl("https://vimeo.com/123456/abcdef12")?.oembedUrl).toBe("https://vimeo.com/123456/abcdef12");
    expect(parseVimeoUrl("https://example.com/123")).toBeNull();
  });
});

describe("Google Maps", () => {
  it("extracts the place from a full URL", () => {
    expect(mapsQueryFromUrl("https://www.google.com/maps/place/Ogden+Elementary+School/@41.9,-87.6,15z")).toBe("Ogden Elementary School");
    expect(mapsQueryFromUrl("https://www.google.com/maps?q=65+E+Scott+St")).toBe("65 E Scott St");
    expect(mapsQueryFromUrl("https://www.google.com/maps/@41.9,-87.6,15z")).toBe("41.9,-87.6");
  });
  it("builds a keyless embed", () => {
    expect(keylessMapsEmbed("65 E Scott St, Chicago")).toBe("https://maps.google.com/maps?q=65%20E%20Scott%20St%2C%20Chicago&output=embed");
  });
});

describe("planEmbed", () => {
  it("chooses the right embed for each input", () => {
    expect(planEmbed("https://youtu.be/dTPov5REUPs")).toEqual({ kind: "youtube", src: "https://www.youtube.com/embed/dTPov5REUPs" });
    expect(planEmbed("https://vimeo.com/123456")).toMatchObject({ kind: "vimeo" });
    expect(planEmbed("https://www.google.com/maps/place/Ogden+Park/@1.0,2.0,15z")).toMatchObject({ kind: "maps" });
    expect(planEmbed("https://maps.app.goo.gl/abc")).toEqual({ kind: "maps-needs-resolve", url: "https://maps.app.goo.gl/abc" });
    expect(planEmbed("7019 N Ashland Blvd, Chicago")).toMatchObject({ kind: "maps" });
    expect(planEmbed("https://example.com/article")).toEqual({ kind: "link", url: "https://example.com/article" });
    expect(planEmbed("   ").kind).toBe("invalid");
  });
});
