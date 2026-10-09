import { describe, it, expect } from "vitest";
import { UPLOAD_MAX_BYTES, planShrink, scaledSize } from "./shrink-image";

describe("planShrink", () => {
  it("does nothing for images that already fit", () => {
    expect(planShrink(1_000_000)).toEqual([]);
    expect(planShrink(UPLOAD_MAX_BYTES)).toEqual([]);
  });
  it("offers progressively smaller attempts for big images", () => {
    const attempts = planShrink(UPLOAD_MAX_BYTES + 1);
    expect(attempts.length).toBeGreaterThan(1);
    const dims = attempts.map((a) => a.maxDim);
    expect([...dims].sort((a, b) => b - a)).toEqual(dims);
    expect(attempts[attempts.length - 1].quality).toBeLessThan(attempts[0].quality);
  });
});

describe("scaledSize", () => {
  it("fits the long side inside the box, keeping the aspect ratio", () => {
    expect(scaledSize(6000, 4000, 2560)).toEqual({ width: 2560, height: 1707 });
    expect(scaledSize(3000, 6000, 2000)).toEqual({ width: 1000, height: 2000 });
  });
  it("never enlarges", () => {
    expect(scaledSize(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });
});
