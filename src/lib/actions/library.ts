import { dataSubDir } from "../data-location";
import { execute, query } from "../db";
import { isInsideLibrary } from "../image-library";
import { copyIntoLibrary, libraryDir } from "../images";

export interface LibraryCopyResult {
  copied: number;
  alreadyInLibrary: number;
  /** Original file no longer exists or can't be read. */
  missing: number;
}

/**
 * One-time migration: photos imported before the image library existed point at the user's
 * original files. Copy each into the library and repoint the row, so the biography no longer
 * breaks when those files are moved or deleted. Photos brought in from the website earlier already live in
 * the app's data folder and are left alone.
 */
export async function copyReferencedPhotosIntoLibrary(
  onProgress?: (done: number, total: number) => void
): Promise<LibraryCopyResult> {
  const [lib, syncDir] = [await libraryDir(), await dataSubDir("media")];
  const rows = await query<{ id: number; file_path: string }>(
    "SELECT id, file_path FROM media WHERE file_path IS NOT NULL AND (import_source IS NULL OR import_source <> 'sync')"
  );
  const result: LibraryCopyResult = { copied: 0, alreadyInLibrary: 0, missing: 0 };
  let done = 0;
  for (const row of rows) {
    if (isInsideLibrary(row.file_path, lib) || isInsideLibrary(row.file_path, syncDir)) {
      result.alreadyInLibrary++;
    } else {
      try {
        const dest = await copyIntoLibrary(row.file_path);
        await execute("UPDATE media SET file_path = ? WHERE id = ?", [dest, row.id]);
        result.copied++;
      } catch {
        result.missing++;
      }
    }
    onProgress?.(++done, rows.length);
  }
  return result;
}
