import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { moveId, setOrder } from "./order";

describe("moveId", () => {
  it("moves an item and clamps the target index", () => {
    expect(moveId([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3]);
    expect(moveId([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4]);
    expect(moveId([1, 2, 3], 2, 99)).toEqual([1, 3, 2]);
    expect(moveId([1, 2, 3], 9, 0)).toEqual([1, 2, 3]);
  });
});

describe("setOrder", () => {
  it("writes positions in the given order", async () => {
    const { db, runner } = createTestDb();
    db.exec("INSERT INTO albums (id, name) VALUES (1,'a'),(2,'b'),(3,'c')");
    await setOrder(runner, "albums", [3, 1, 2]);
    const rows = db.prepare("SELECT id FROM albums ORDER BY position").all();
    expect(rows).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
  });
});
