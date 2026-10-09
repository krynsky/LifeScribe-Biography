import { describe, it, expect } from "vitest";
import { isValidCoordinate, parseCoordinate, parseNominatim, shortPlaceName } from "./geocode";

describe("parseNominatim", () => {
  it("maps results and drops malformed rows", () => {
    const out = parseNominatim([
      { lat: "41.88", lon: "-87.63", display_name: "Chicago, Cook County, Illinois, USA" },
      { lat: "x", lon: "1", display_name: "Bad" },
      { lat: "95", lon: "0", display_name: "Out of range" },
      { lat: "1", lon: "2" },
      null,
    ]);
    expect(out).toEqual([{ name: "Chicago, Cook County, Illinois, USA", lat: 41.88, lng: -87.63 }]);
    expect(parseNominatim({ not: "an array" })).toEqual([]);
  });
});

describe("coordinates", () => {
  it("validates ranges", () => {
    expect(isValidCoordinate(0, 0)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(90.1, 0)).toBe(false);
    expect(isValidCoordinate(0, -180.5)).toBe(false);
    expect(isValidCoordinate(NaN, 0)).toBe(false);
  });
  it("parses text fields", () => {
    expect(parseCoordinate("-34.6037")).toBe(-34.6037);
    expect(parseCoordinate("  ")).toBeNull();
    expect(parseCoordinate("abc")).toBeNull();
  });
  it("shortens display names", () => {
    expect(shortPlaceName("Ogden Park, Chicago, Illinois")).toBe("Ogden Park");
  });
});
