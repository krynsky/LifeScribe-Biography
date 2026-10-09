import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import {
  createCategory,
  deleteCategory,
  ensureCategory,
  ensureTag,
  getTagNames,
  listCategories,
  listTags,
  mergeTag,
  renameTag,
  setCategoryByName,
  setTags,
  slugify,
  updateCategory,
} from "./taxonomy";

describe("slugify", () => {
  it("makes url-safe slugs", () => {
    expect(slugify("  Family & Friends! ")).toBe("family-friends");
    expect(slugify("!!!")).toBe("item");
  });
});

describe("categories", () => {
  it("creates, de-duplicates case-insensitively, and gives unique slugs", async () => {
    const { runner } = createTestDb();
    const a = await createCategory(runner, { name: "Family", color: "#f00", icon: "👪" });
    expect(a.slug).toBe("family");
    await expect(createCategory(runner, { name: "family" })).rejects.toThrow(/already exists/);
    expect(await ensureCategory(runner, "FAMILY")).toBe(a.id);
    const b = await createCategory(runner, { name: "Family!" }); // same slug base
    expect(b.slug).toBe("family-2");
  });

  it("assigns by name, creating on demand, and reports usage", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'S'), (2, 'T')");
    await setCategoryByName(runner, "stories", 1, { name: "Travel", color: "#00f" });
    await setCategoryByName(runner, "stories", 2, { name: "travel" });
    const list = await listCategories(runner);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Travel", usage: 2 });
  });

  it("renames, recolors and deletes (clearing assignments)", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO milestones (id, title, date) VALUES (1, 'M', '2000-01-01')");
    await setCategoryByName(runner, "milestones", 1, { name: "Life" });
    const [c] = await listCategories(runner);
    const renamed = await updateCategory(runner, c.id, { name: "Life Events", color: "#123456" });
    expect(renamed).toMatchObject({ name: "Life Events", slug: "life-events", color: "#123456" });
    await deleteCategory(runner, c.id);
    expect(await listCategories(runner)).toHaveLength(0);
    expect(db.prepare("SELECT category_id FROM milestones WHERE id = 1").get()).toEqual({ category_id: null });
  });

  it("clears a category when given null", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO albums (id, name) VALUES (1, 'A')");
    await setCategoryByName(runner, "albums", 1, { name: "X" });
    await setCategoryByName(runner, "albums", 1, null);
    expect(db.prepare("SELECT category_id FROM albums WHERE id = 1").get()).toEqual({ category_id: null });
  });
});

describe("tags", () => {
  it("replaces an entity's tags, creating new ones and reusing existing (case-insensitive)", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'S')");
    await setTags(runner, "stories", 1, ["Chicago", "Family"]);
    await setTags(runner, "stories", 1, ["chicago", "School", "  "]);
    expect(await getTagNames(runner, "stories", 1)).toEqual(["Chicago", "School"]);
    expect((await listTags(runner)).map((t) => t.name)).toEqual(["Chicago", "Family", "School"]);
  });

  it("renames, refuses a clashing rename, merges and counts usage", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'S'), (2, 'T'); INSERT INTO albums (id, name) VALUES (1, 'A')");
    await setTags(runner, "stories", 1, ["one"]);
    await setTags(runner, "stories", 2, ["two"]);
    await setTags(runner, "albums", 1, ["one", "two"]);
    const tags = await listTags(runner);
    const one = tags.find((t) => t.name === "one")!;
    const two = tags.find((t) => t.name === "two")!;
    expect(one.usage).toBe(2);
    await expect(renameTag(runner, one.id, "TWO")).rejects.toThrow(/merge/);
    await renameTag(runner, one.id, "uno");
    await mergeTag(runner, one.id, two.id);
    expect((await listTags(runner)).map((t) => [t.name, t.usage])).toEqual([["two", 3]]);
    expect(await getTagNames(runner, "stories", 1)).toEqual(["two"]);
  });

  it("ensureTag returns the existing tag", async () => {
    const { runner } = createTestDb();
    const a = await ensureTag(runner, "Hello");
    const b = await ensureTag(runner, "hello");
    expect(b.id).toBe(a.id);
  });
});
