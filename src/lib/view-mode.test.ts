import { describe, it, expect } from "vitest";
import { parseViewMode } from "./view-mode";

describe("parseViewMode", () => {
  it("accepts read and defaults everything else to edit", () => {
    expect(parseViewMode("read")).toBe("read");
    expect(parseViewMode("edit")).toBe("edit");
    expect(parseViewMode(null)).toBe("edit");
    expect(parseViewMode("junk")).toBe("edit");
  });
});
