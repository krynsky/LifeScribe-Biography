import { localFileUrl } from "@/lib/db";

/** Resolve a stored image reference (remote URL or local file path) to something an <img> can load. */
export function imageSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:|asset:|http:\/\/asset\.localhost)/i.test(path)) return path;
  return localFileUrl(path);
}
