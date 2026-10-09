import { fetch } from "@tauri-apps/plugin-http";
import { parseNominatim, type PlaceResult } from "./geocode";

/**
 * Look a place up on OpenStreetMap's Nominatim service (needs internet). Used only to suggest
 * coordinates; the user can always type latitude/longitude by hand when offline.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, {
    headers: { "User-Agent": "LifeScribe-Desktop/0.1 (personal biography app)", Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Search failed (${resp.status})`);
  return parseNominatim(await resp.json());
}
