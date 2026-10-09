import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import { IMAGE_EXTENSIONS, isInsideLibrary, libraryFileName } from "./image-library";

/** Folder holding every image the user has added. Lives in the app data folder. */
export async function libraryDir(): Promise<string> {
  const dir = await join(await appLocalDataDir(), "images");
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Copy an image into the library and return its new path. Files already in the library are
 * returned unchanged; identical content is stored once (named by hash).
 */
export async function copyIntoLibrary(sourcePath: string): Promise<string> {
  const dir = await libraryDir();
  if (isInsideLibrary(sourcePath, dir)) return sourcePath;
  const bytes = await readFile(sourcePath);
  return writeToLibrary(dir, bytes, sourcePath);
}

/** Store raw bytes (e.g. a downloaded or pasted image) in the library; `nameHint` supplies the extension. */
export async function storeImageBytes(bytes: Uint8Array, nameHint: string): Promise<string> {
  return writeToLibrary(await libraryDir(), bytes, nameHint);
}

async function writeToLibrary(dir: string, bytes: Uint8Array, nameHint: string): Promise<string> {
  const dest = await join(dir, await libraryFileName(bytes, nameHint));
  if (!(await exists(dest))) await writeFile(dest, bytes);
  return dest;
}

/** Let the user choose an image file, copy it into the library, and return the library path (null if cancelled). */
export async function pickImageIntoLibrary(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Images", extensions: [...IMAGE_EXTENSIONS] }],
  });
  if (!selected || typeof selected !== "string") return null;
  return copyIntoLibrary(selected);
}
