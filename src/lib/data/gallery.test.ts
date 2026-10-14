import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { deleteAlbum, deleteMedia, listAlbumsWithCovers, setAlbumCover } from "./gallery";
import { setCategoryByName, setTags } from "./taxonomy";
import { addLink } from "./links";

function seed() {
  const t = createTestDb();
  t.db.exec(`
    INSERT INTO albums (id, name) VALUES (1, 'Trip'), (2, 'Empty');
    INSERT INTO media (id, file_path, thumbnail_path, filename, mime_type, album_id, sort_order)
      VALUES (1, '/a.jpg', '/t1.jpg', 'a.jpg', 'image/jpeg', 1, 1),
             (2, '/b.jpg', '/t2.jpg', 'b.jpg', 'image/jpeg', 1, 2),
             (3, '/c.jpg', '/t3.jpg', 'c.jpg', 'image/jpeg', 1, 3);
    INSERT INTO stories (id, title) VALUES (1, 'S');
  `);
  return t;
}

describe("listAlbumsWithCovers", () => {
  it("counts media, and falls back to the first photo for the cover", async () => {
    const { runner } = seed();
    const albums = await listAlbumsWithCovers(runner);
    const trip = albums.find((a) => a.id === 1)!;
    expect(trip.media_count).toBe(3);
    expect(trip.cover_path).toBe("/t1.jpg");
    expect(albums.find((a) => a.id === 2)).toMatchObject({ media_count: 0, cover_path: null });
  });

  it("prefers an explicitly chosen cover", async () => {
    const { runner } = seed();
    await setAlbumCover(runner, 1, 3);
    expect((await listAlbumsWithCovers(runner)).find((a) => a.id === 1)!.cover_path).toBe("/t3.jpg");
  });

  it("exposes category and tags", async () => {
    const { runner } = seed();
    await setCategoryByName(runner, "albums", 1, { name: "Travel", color: "#00f" });
    await setTags(runner, "albums", 1, ["a", "b"]);
    const trip = (await listAlbumsWithCovers(runner)).find((a) => a.id === 1)!;
    expect(trip.category).toBe("Travel");
    expect((JSON.parse(trip.tags as string) as string[]).sort()).toEqual(["a", "b"]);
  });
});

describe("setAlbumCover", () => {
  it("rejects a photo from another album and can clear the choice", async () => {
    const { db, runner } = seed();
    db.exec("INSERT INTO media (id, file_path, filename, mime_type, album_id) VALUES (9, '/z.jpg', 'z.jpg', 'image/jpeg', 2)");
    await expect(setAlbumCover(runner, 1, 9)).rejects.toThrow(/isn't in this album/);
    await setAlbumCover(runner, 1, 2);
    await setAlbumCover(runner, 1, null);
    expect(db.prepare("SELECT cover_media_id FROM albums WHERE id = 1").get()).toEqual({ cover_media_id: null });
  });
});

describe("deleteMedia", () => {
  it("removes the photo and un-sets it as a cover", async () => {
    const { db, runner } = seed();
    await setAlbumCover(runner, 1, 2);
    await deleteMedia(runner, 2);
    expect(db.prepare("SELECT COUNT(*) c FROM media WHERE id = 2").get()).toEqual({ c: 0 });
    expect(db.prepare("SELECT cover_media_id FROM albums WHERE id = 1").get()).toEqual({ cover_media_id: null });
  });
});

describe("album edit tracking", () => {
  it("deleting a photo marks its album as edited", async () => {
    const { db, runner } = seed();
    db.exec("UPDATE albums SET updated_at = '2000-01-01 00:00:00'");
    await deleteMedia(runner, 1);
    const row = db.prepare("SELECT updated_at FROM albums WHERE id = 1").get() as { updated_at: string };
    expect(row.updated_at > "2020").toBe(true);
    expect((db.prepare("SELECT updated_at FROM albums WHERE id = 2").get() as { updated_at: string }).updated_at).toBe("2000-01-01 00:00:00");
  });
});

describe("deleteAlbum", () => {
  it("keeps the photos but removes the album, its tags and its links", async () => {
    const { db, runner } = seed();
    await setTags(runner, "albums", 1, ["x"]);
    await addLink(runner, "story_albums", 1, 1);
    await deleteAlbum(runner, 1);
    expect(db.prepare("SELECT COUNT(*) c FROM albums WHERE id = 1").get()).toEqual({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM media WHERE album_id IS NULL").get()).toEqual({ c: 3 });
    expect(db.prepare("SELECT COUNT(*) c FROM album_tags").get()).toEqual({ c: 0 });
    expect(db.prepare("SELECT COUNT(*) c FROM story_albums").get()).toEqual({ c: 0 });
  });
});
