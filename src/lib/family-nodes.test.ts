import { describe, expect, it } from "vitest";
import { buildNodes } from "./family-nodes";

const m = (id: number, birth_date: string | null = null, gender = "male") => ({ id, given_name: `P${id}`, gender, birth_date }) as never;
const rel = (id: number, from: number, to: number, type: string, ended = 0) => ({ id, from_member_id: from, to_member_id: to, relationship_type: type, ended }) as never;
const ids = (list: { id: string }[]) => list.map((x) => Number(x.id));

describe("buildNodes", () => {
  it("lists children oldest first, undated last", () => {
    const members = [m(1), m(2, "2005-01-01"), m(3, "1999-06-01"), m(4), m(5, "2001-01-01")];
    const rels = [rel(1, 1, 2, "parent"), rel(2, 1, 3, "parent"), rel(3, 1, 4, "parent"), rel(4, 1, 5, "parent")];
    const parent = buildNodes(members, rels).find((n) => n.id === "1")!;
    expect(ids([...parent.children])).toEqual([3, 5, 2, 4]);
  });

  it("marks an ended marriage as divorced and a current one as married", () => {
    const members = [m(1), m(2, null, "female"), m(3, null, "female")];
    const nodes = buildNodes(members, [rel(1, 1, 2, "spouse", 1), rel(2, 1, 3, "spouse", 0)]);
    const spouses = nodes.find((n) => n.id === "1")!.spouses.map((s) => [s.id, String(s.type)]);
    expect(spouses).toEqual([["2", "divorced"], ["3", "married"]]);
  });

  it("only fills in a missing second parent from a current spouse", () => {
    const members = [m(1), m(2, null, "female"), m(3), m(4, null, "female")];
    // 3 has one parent (1); 1 is divorced from 2 and married to 4.
    const nodes = buildNodes(members, [rel(1, 1, 3, "parent"), rel(2, 1, 2, "spouse", 1), rel(3, 1, 4, "spouse", 0)]);
    expect(ids([...nodes.find((n) => n.id === "3")!.parents]).sort()).toEqual([1, 4]);
  });
});
