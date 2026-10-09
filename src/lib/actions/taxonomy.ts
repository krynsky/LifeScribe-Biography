import { appRunner } from "../data/sql";
import * as t from "../data/taxonomy";

export type { CategoryRow, TagRow } from "../data/taxonomy";

/** App-bound wrappers over the data layer, for components. */
export const listCategories = () => t.listCategories(appRunner);
export const createCategory = (input: { name: string; color?: string | null; icon?: string | null }) => t.createCategory(appRunner, input);
export const updateCategory = (id: number, patch: { name?: string; color?: string | null; icon?: string | null }) => t.updateCategory(appRunner, id, patch);
export const deleteCategory = (id: number) => t.deleteCategory(appRunner, id);

export const listTags = () => t.listTags(appRunner);
export const renameTag = (id: number, name: string) => t.renameTag(appRunner, id, name);
export const mergeTag = (sourceId: number, targetId: number) => t.mergeTag(appRunner, sourceId, targetId);
export const deleteTag = (id: number) => t.deleteTag(appRunner, id);
export const getTagNames = (table: t.TaggedTable, entityId: number) => t.getTagNames(appRunner, table, entityId);
export const setTags = (table: t.TaggedTable, entityId: number, names: string[]) => t.setTags(appRunner, table, entityId, names);
