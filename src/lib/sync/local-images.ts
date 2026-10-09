/**
 * Images inserted into a story from this computer are stored as Tauri asset URLs
 * (http://asset.localhost/... or asset://localhost/...). They only load inside the app, so a story
 * body containing one would show broken images on the website.
 */
export function hasLocalImages(content: unknown): boolean {
  if (typeof content !== "string") return false;
  return /"src"\s*:\s*"(?:https?:\/\/asset\.localhost|asset:\/\/localhost)/i.test(content);
}

export const LOCAL_IMAGES_WARNING = "Contains photos stored on this computer. They will not show on the website yet.";
