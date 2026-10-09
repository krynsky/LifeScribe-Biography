import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { addRelationship, deleteFamilyMember, describeRelationship, listRelationships, mergeRelationships, relationshipKey, removeRelationship } from "./family";

function seed() {
  const t = createTestDb();
  t.db.exec("INSERT INTO family_members (id, given_name) VALUES (1,'A'),(2,'B'),(3,'C')");
  return t;
}

describe("relationshipKey", () => {
  it("treats inverse statements as the same fact", () => {
    expect(relationshipKey(1, 2, "parent")).toBe(relationshipKey(2, 1, "child"));
    expect(relationshipKey(1, 2, "spouse")).toBe(relationshipKey(2, 1, "spouse"));
    expect(relationshipKey(1, 2, "sibling")).toBe(relationshipKey(2, 1, "sibling"));
    expect(relationshipKey(1, 2, "parent")).not.toBe(relationshipKey(2, 1, "parent"));
  });
  it("ignores types the app does not model", () => {
    expect(relationshipKey(1, 2, "partner")).toBeNull();
  });
});

describe("describeRelationship", () => {
  it("reads from either side", () => {
    const rel = { id: 1, from_member_id: 1, to_member_id: 2, relationship_type: "parent" };
    expect(describeRelationship(rel, 1)).toEqual({ otherId: 2, type: "parent", phrase: "is a parent of" });
    expect(describeRelationship(rel, 2)).toEqual({ otherId: 1, type: "child", phrase: "is a child of" });
    expect(describeRelationship(rel, 3)).toBeNull();
  });
});

describe("addRelationship", () => {
  it("adds, and rejects self, duplicates and inverse duplicates", async () => {
    const { runner } = seed();
    await addRelationship(runner, 1, 2, "parent");
    await expect(addRelationship(runner, 1, 2, "parent")).rejects.toThrow(/already exists/);
    await expect(addRelationship(runner, 2, 1, "child")).rejects.toThrow(/already exists/);
    await expect(addRelationship(runner, 1, 1, "sibling")).rejects.toThrow(/themselves/);
    await addRelationship(runner, 1, 2, "spouse"); // a different fact between the same people is fine
    await expect(addRelationship(runner, 2, 1, "spouse")).rejects.toThrow(/already exists/);
    expect(await listRelationships(runner)).toHaveLength(2);
  });

  it("removes a relationship", async () => {
    const { runner } = seed();
    await addRelationship(runner, 1, 2, "sibling");
    const [rel] = await listRelationships(runner);
    await removeRelationship(runner, rel.id);
    expect(await listRelationships(runner)).toHaveLength(0);
  });
});

describe("deleteFamilyMember", () => {
  it("removes the member and all their relationships", async () => {
    const { db, runner } = seed();
    await addRelationship(runner, 1, 2, "parent");
    await addRelationship(runner, 3, 1, "sibling");
    await addRelationship(runner, 2, 3, "spouse");
    await deleteFamilyMember(runner, 1);
    expect(db.prepare("SELECT COUNT(*) c FROM family_members").get()).toEqual({ c: 2 });
    expect((await listRelationships(runner)).map((r) => r.relationship_type)).toEqual(["spouse"]);
  });
});

describe("mergeRelationships", () => {
  it("adds only what's missing and never removes local relationships", async () => {
    const { runner } = seed();
    await addRelationship(runner, 1, 2, "parent"); // local-only knowledge
    const added = await mergeRelationships(runner, [
      { from_member_id: 2, to_member_id: 1, relationship_type: "child" }, // same fact as local
      { from_member_id: 2, to_member_id: 3, relationship_type: "spouse" },
      { from_member_id: 3, to_member_id: 2, relationship_type: "spouse" }, // duplicate within the batch
      { from_member_id: 1, to_member_id: 1, relationship_type: "sibling" }, // self
      { from_member_id: 1, to_member_id: 3, relationship_type: "partner" }, // not modelled
    ]);
    expect(added).toBe(1);
    expect(await listRelationships(runner)).toHaveLength(2);
  });
});
