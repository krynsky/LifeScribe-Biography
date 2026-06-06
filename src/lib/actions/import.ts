import { query, execute } from "../db";
import type { ImportJob, ImportItem, ImportItemType, ImportItemStatus } from "../models";

export async function createImportJob(
  platform: ImportJob["source_platform"],
  archivePath?: string
): Promise<ImportJob> {
  const result = await execute(
    "INSERT INTO import_jobs (source_platform, archive_path) VALUES (?, ?)",
    [platform, archivePath ?? null]
  );
  const rows = await query<ImportJob>("SELECT * FROM import_jobs WHERE id = ?", [result.lastInsertId]);
  return rows[0];
}

export async function updateImportJob(
  id: number,
  data: {
    status?: ImportJob["status"];
    item_count?: number;
    processed_count?: number;
    failed_count?: number;
    error?: string;
  }
): Promise<void> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);
  const completedAt =
    data.status === "completed" || data.status === "failed" || data.status === "cancelled"
      ? ", completed_at = datetime('now')"
      : "";
  await execute(
    `UPDATE import_jobs SET ${setClauses}${completedAt} WHERE id = ?`,
    [...values, id]
  );
}

export async function listImportJobs(): Promise<ImportJob[]> {
  return query<ImportJob>("SELECT * FROM import_jobs ORDER BY started_at DESC");
}

export async function createImportItem(data: {
  import_job_id?: number;
  item_type: ImportItemType;
  content: object;
  source_data?: string;
  ai_confidence?: number;
}): Promise<ImportItem> {
  const result = await execute(
    `INSERT INTO import_items (import_job_id, item_type, content, source_data, ai_confidence)
     VALUES (?, ?, ?, ?, ?)`,
    [
      data.import_job_id ?? null,
      data.item_type,
      JSON.stringify(data.content),
      data.source_data ?? null,
      data.ai_confidence ?? null,
    ]
  );
  const rows = await query<ImportItem>("SELECT * FROM import_items WHERE id = ?", [result.lastInsertId]);
  return rows[0];
}

export async function updateImportItemStatus(
  id: number,
  status: ImportItemStatus,
  updatedContent?: object
): Promise<void> {
  if (updatedContent !== undefined) {
    await execute(
      "UPDATE import_items SET status = ?, content = ?, updated_at = datetime('now') WHERE id = ?",
      [status, JSON.stringify(updatedContent), id]
    );
  } else {
    await execute(
      "UPDATE import_items SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, id]
    );
  }
}

export async function listImportItems(filters?: {
  import_job_id?: number;
  status?: ImportItemStatus;
  item_type?: ImportItemType;
}): Promise<ImportItem[]> {
  let sql = "SELECT * FROM import_items";
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters?.import_job_id !== undefined) {
    conditions.push("import_job_id = ?");
    params.push(filters.import_job_id);
  }
  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.item_type) {
    conditions.push("item_type = ?");
    params.push(filters.item_type);
  }

  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY created_at ASC";

  return query<ImportItem>(sql, params);
}

export async function getPendingReviewCount(): Promise<number> {
  const rows = await query<{ count: number }>(
    "SELECT COUNT(*) as count FROM import_items WHERE status = 'pending_review'"
  );
  return rows[0]?.count ?? 0;
}
