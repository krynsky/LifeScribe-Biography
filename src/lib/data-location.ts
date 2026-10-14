import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";

/** Where the app keeps its data (see src-tauri/src/data.rs). */
export interface DataLocation {
  /** True when the user chose a folder; false = the default layout. */
  custom: boolean;
  /** False when a chosen folder can't be found (e.g. an unplugged drive). */
  available: boolean;
  /** Folder holding images/, media/, backups/ and thumbs/ (and the database, when custom). */
  filesRoot: string;
  dbPath: string;
  defaultFilesRoot: string;
  defaultDbPath: string;
  pointerFile: string;
}

let cached: Promise<DataLocation> | null = null;

/** Read once per run: a change only takes effect after the app restarts. */
export function getDataLocation(): Promise<DataLocation> {
  if (!cached) {
    cached = invoke<DataLocation>("get_data_location").catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export function unavailableMessage(loc: DataLocation): string {
  return `Your data folder (${loc.filesRoot}) can't be found. Reconnect the drive or folder and restart the app, or delete ${loc.pointerFile} to go back to the default location.`;
}

/** The folder that holds images/, media/ and backups/. Throws a readable error if the chosen folder is missing. */
export async function dataFilesDir(): Promise<string> {
  const loc = await getDataLocation();
  if (!loc.available) throw new Error(unavailableMessage(loc));
  return loc.filesRoot;
}

export async function dataSubDir(name: string): Promise<string> {
  return join(await dataFilesDir(), name);
}
