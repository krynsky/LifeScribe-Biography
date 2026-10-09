import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { addLink, albumsLinkedTo, getLinkedIds, getStoryRelations, removeLink, replaceLinks, storiesLinkedTo } from "./links";

function seed() {
  const t = createTestDb();
  t.db.exec(`
    INSERT INTO stories (id, title, status, event_date) VALUES (1, 'Pub', 'published', '2000-01-01'), (2, 'Draft', 'draft', NULL), (3, 'Pub2', 'published', '2010-01-01');
    INSERT INTO milestones (id, title, date) VALUES (1, 'M1', '1999-05-05'), (2, 'M2', '2001-01-01');
    INSERT INTO albums (id, name) VALUES (1, 'Alb');
    INSERT INTO map_pins (id, name, latitude, longitude) VALUES (1, 'Pin', 0, 0);
    INSERT INTO career_entries (id, organization, title) VALUES (1, 'Org', 'Dev');
  `);
  return t;
}

describe("links", () => {
  it("replaces an owner's links and ignores duplicates", async () => {
    const { runner } = seed();
    await replaceLinks(runner, "story_milestones", "milestone_id", 1, [1, 2, 2]);
    expect((await getLinkedIds(runner, "story_milestones", "milestone_id", 1)).sort()).toEqual([1, 2]);
    await replaceLinks(runner, "story_milestones", "milestone_id", 1, [3]);
    expect(await getLinkedIds(runner, "story_milestones", "milestone_id", 1)).toEqual([3]);
    // the other side sees the reverse
    expect(await getLinkedIds(runner, "story_milestones", "story_id", 3)).toEqual([1]);
  });

  it("rejects an owner column that isn't part of the table", async () => {
    const { runner } = seed();
    await expect(replaceLinks(runner, "story_albums", "milestone_id", 1, [1])).rejects.toThrow(/not a column/);
  });

  it("adds and removes single links", async () => {
    const { runner } = seed();
    await addLink(runner, "album_map_pins", 1, 1);
    await addLink(runner, "album_map_pins", 1, 1);
    expect(await getLinkedIds(runner, "album_map_pins", "album_id", 1)).toEqual([1]);
    await removeLink(runner, "album_map_pins", 1, 1);
    expect(await getLinkedIds(runner, "album_map_pins", "album_id", 1)).toEqual([]);
  });

  it("lists only published stories, newest first, per owner", async () => {
    const { runner } = seed();
    await replaceLinks(runner, "story_milestones", "milestone_id", 1, [1, 2, 3]);
    const map = await storiesLinkedTo(runner, "story_milestones", "milestone_id");
    expect(map.get(1)?.map((s) => s.title)).toEqual(["Pub2", "Pub"]);
    expect(map.get(2)).toBeUndefined();
  });

  it("lists linked albums per owner", async () => {
    const { runner } = seed();
    await addLink(runner, "album_career_entries", 1, 1);
    const map = await albumsLinkedTo(runner, "album_career_entries", "career_entry_id");
    expect(map.get(1)).toEqual([{ id: 1, title: "Alb" }]);
  });

  it("collects everything linked to a story", async () => {
    const { runner } = seed();
    await addLink(runner, "story_milestones", 1, 1);
    await addLink(runner, "story_albums", 1, 1);
    await addLink(runner, "story_map_pins", 1, 1);
    await addLink(runner, "story_career_entries", 1, 1);
    expect(await getStoryRelations(runner, 1)).toEqual({
      milestones: [{ id: 1, title: "M1", year: "1999" }],
      albums: [{ id: 1, title: "Alb" }],
      mapPins: [{ id: 1, name: "Pin" }],
      career: [{ id: 1, title: "Dev", company: "Org" }],
    });
  });

  it("deleting an entity removes its link rows", async () => {
    const { db, runner } = seed();
    await addLink(runner, "story_albums", 1, 1);
    db.exec("DELETE FROM albums WHERE id = 1");
    expect(await getLinkedIds(runner, "story_albums", "story_id", 1)).toEqual([]);
  });
});
