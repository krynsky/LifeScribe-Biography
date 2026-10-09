import type { SqlRunner } from "./sql";

/** Tables with a manual `position` column (lower = earlier; NULL sorts last). */
export const ORDERED_TABLES = ["milestones", "map_pins", "albums", "career_entries", "family_members"] as const;
export type OrderedTable = (typeof ORDERED_TABLES)[number];

/** Persist a manual order: row `ids[i]` gets position i. Rows not listed keep their position. */
export async function setOrder(r: SqlRunner, table: OrderedTable, ids: number[]): Promise<void> {
  if (!ORDERED_TABLES.includes(table)) throw new Error(`${table} has no manual order`);
  for (let i = 0; i < ids.length; i++) {
    await r.execute(`UPDATE ${table} SET position = ? WHERE id = ?`, [i, ids[i]]);
  }
}

/** Pure helper for drag-and-drop UIs: move one item to a new index and return the new id order. */
export function moveId(ids: number[], id: number, toIndex: number): number[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;
  const next = ids.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
  return next;
}
