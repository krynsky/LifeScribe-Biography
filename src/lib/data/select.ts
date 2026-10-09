/**
 * SQL fragments that expose a row's category and tags under the same names the read views
 * already use (`category`, `category_color`, `category_icon`, `tags` as a JSON array).
 * Usage: `SELECT t.*, ${CATEGORY_SELECT} FROM table t ${categoryJoin("t")}`.
 */
export const CATEGORY_SELECT = "c.name AS category, c.color AS category_color, c.icon AS category_icon";

export function categoryJoin(alias: string): string {
  return `LEFT JOIN categories c ON c.id = ${alias}.category_id`;
}

export function tagsSelect(kind: "story" | "album", alias: string): string {
  const join = kind === "story" ? "story_tags" : "album_tags";
  const col = kind === "story" ? "story_id" : "album_id";
  return `(SELECT json_group_array(t.name) FROM ${join} j JOIN tags t ON t.id = j.tag_id WHERE j.${col} = ${alias}.id) AS tags`;
}
