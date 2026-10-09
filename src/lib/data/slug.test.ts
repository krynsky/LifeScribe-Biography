import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { slugifyTitle, uniqueStorySlug } from "./slug";

describe("slugifyTitle", () => {
  it("makes url-safe slugs and never returns empty", () => {
    expect(slugifyTitle("How I Met Esther!")).toBe("how-i-met-esther");
    expect(slugifyTitle("???")).toBe("story");
  });
});

describe("uniqueStorySlug", () => {
  it("appends a number on collision but not for the story's own slug", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO stories (id, title, slug) VALUES (1, 'A', 'trip'), (2, 'B', 'trip-2')");
    expect(await uniqueStorySlug(runner, "Trip")).toBe("trip-3");
    expect(await uniqueStorySlug(runner, "Trip", 1)).toBe("trip"); // story 1 already owns "trip"
    expect(await uniqueStorySlug(runner, "Fresh")).toBe("fresh");
    expect(await uniqueStorySlug(runner, "Trip-2", 2)).toBe("trip-2");
  });
});
