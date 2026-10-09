/**
 * Images inserted into a story from this computer are stored as Tauri asset URLs
 * (http://asset.localhost/... or asset://localhost/...). They only load inside the app, so a story
 * body containing one would show broken images on the website.
 */
export function hasLocalImages(content: unknown): boolean {
  if (typeof content !== "string") return false;
  return /"src"\s*:\s*"(?:https?:\/\/asset\.localhost|asset:\/\/localhost)/i.test(content);
}

export const LOCAL_IMAGES_NOTE = "Photos in this story will be uploaded to the website.";

/**
 * Photos downloaded from the website during Refresh are saved as `media/img-<hash>.<ext>` in the
 * app data folder. Anything the user chose themselves goes through the image library instead. So a
 * path like this is an unchanged copy of what is already on the site and must not be uploaded again.
 */
export function isWebDownloadedImage(path: string): boolean {
  return /[\\/]media[\\/]img-[a-z0-9]+\.[a-z0-9]+$/i.test(path);
}
