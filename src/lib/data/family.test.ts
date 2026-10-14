import { describe, it, expect } from "vitest";
import { createTestDb } from "./test-runner";
import { addRelationship, deleteFamilyMember, describeRelationship, listRelationships, relationshipKey, removeRelationship, setRelationshipEnded } from "./family";

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

describe("ended marriages", () => {
  it("marks only spouse relationships as ended and words them in the past tense", async () => {
    const { runner } = seed();
    await addRelationship(runner, 1, 2, "spouse");
    await addRelationship(runner, 1, 3, "parent");
    const [spouse, parent] = await listRelationships(runner);
    expect(describeRelationship(spouse, 1)?.phrase).toBe("is married to");
    await setRelationshipEnded(runner, spouse.id, true);
    await setRelationshipEnded(runner, parent.id, true); // ignored: not a marriage
    const after = await listRelationships(runner);
    expect(after.map((r) => r.ended)).toEqual([1, 0]);
    expect(describeRelationship(after[0], 2)?.phrase).toBe("was married to");
    await setRelationshipEnded(runner, spouse.id, false);
    expect((await listRelationships(runner))[0].ended).toBe(0);
  });
});
