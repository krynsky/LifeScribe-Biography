import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { deleteEntityLinks, getEntityLinks, setEntityLinks } from "./entity-links";

function seed() {
  const t = createTestDb();
  t.db.exec(`
    INSERT INTO stories (id, title) VALUES (1, 'S1'), (2, 'S2');
    INSERT INTO albums (id, name) VALUES (1, 'A1'), (2, 'A2');
    INSERT INTO milestones (id, title, date) VALUES (1, 'M', '2000-01-01');
    INSERT INTO career_entries (id, organization) VALUES (1, 'Org');
    INSERT INTO map_pins (id, name, latitude, longitude) VALUES (1, 'P', 0, 0);
  `);
  return t;
}

describe("entity links", () => {
  it("round-trips stories and albums for each kind", async () => {
    const { runner } = seed();
    for (const kind of ["milestone", "career", "map_pin"] as const) {
      await setEntityLinks(runner, kind, 1, { stories: [1, 2], albums: [2] });
      const links = await getEntityLinks(runner, kind, 1);
      expect(links.stories.sort()).toEqual([1, 2]);
      expect(links.albums).toEqual([2]);
    }
  });

  it("leaves an omitted side untouched", async () => {
    const { runner } = seed();
    await setEntityLinks(runner, "milestone", 1, { stories: [1], albums: [1] });
    await setEntityLinks(runner, "milestone", 1, { stories: [2] });
    expect(await getEntityLinks(runner, "milestone", 1)).toEqual({ stories: [2], albums: [1] });
  });

  it("clears links and only the named entity's links on delete", async () => {
    const { runner } = seed();
    await setEntityLinks(runner, "career", 1, { stories: [1], albums: [1] });
    await setEntityLinks(runner, "map_pin", 1, { stories: [1], albums: [1] });
    await deleteEntityLinks(runner, "career", 1);
    expect(await getEntityLinks(runner, "career", 1)).toEqual({ stories: [], albums: [] });
    expect(await getEntityLinks(runner, "map_pin", 1)).toEqual({ stories: [1], albums: [1] });
  });
});
