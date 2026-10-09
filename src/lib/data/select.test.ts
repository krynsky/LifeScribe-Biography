import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { CATEGORY_SELECT, categoryJoin, tagsSelect } from "./select";
import { setCategoryByName, setTags } from "./taxonomy";

describe("select fragments", () => {
  it("expose category and tags on stories under the names the views use", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO stories (id, title) VALUES (1, 'A'), (2, 'B')");
    await setCategoryByName(runner, "stories", 1, { name: "Family", color: "#f00", icon: "x" });
    await setTags(runner, "stories", 1, ["one", "two"]);
    const rows = await runner.select<{ id: number; category: string | null; category_color: string | null; tags: string }>(
      `SELECT s.id, ${CATEGORY_SELECT}, ${tagsSelect("story", "s")} FROM stories s ${categoryJoin("s")} ORDER BY s.id`
    );
    expect(rows[0]).toMatchObject({ category: "Family", category_color: "#f00" });
    expect((JSON.parse(rows[0].tags) as string[]).sort()).toEqual(["one", "two"]);
    expect(rows[1]).toMatchObject({ category: null, tags: "[]" });
  });

  it("work for albums too", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO albums (id, name) VALUES (1, 'A')");
    await setTags(runner, "albums", 1, ["x"]);
    const [row] = await runner.select<{ tags: string }>(`SELECT ${tagsSelect("album", "a")} FROM albums a`);
    expect(JSON.parse(row.tags)).toEqual(["x"]);
  });
});
