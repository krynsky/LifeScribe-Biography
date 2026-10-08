import { describe, it, expect } from "vitest";
import { keylessMapsSrc } from "./google-maps-embed";

describe("keylessMapsSrc", () => {
  it("rewrites the keyed v1/place embed to a keyless one with the same query", () => {
    const out = keylessMapsSrc("https://www.google.com/maps/embed/v1/place?key=SECRET&q=65%20E%20Scott%20St%2C%20Chicago");
    expect(out).toBe("https://maps.google.com/maps?q=65%20E%20Scott%20St%2C%20Chicago&output=embed");
    expect(out).not.toContain("SECRET");
  });
  it("leaves other sources alone", () => {
    expect(keylessMapsSrc("https://maps.google.com/maps?q=x&output=embed")).toBe("https://maps.google.com/maps?q=x&output=embed");
    expect(keylessMapsSrc(null)).toBeNull();
  });
});
