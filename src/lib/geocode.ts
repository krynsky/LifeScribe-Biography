export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

/** Turn a Nominatim /search JSON response into place results, dropping malformed rows. */
export function parseNominatim(json: unknown): PlaceResult[] {
  if (!Array.isArray(json)) return [];
  const out: PlaceResult[] = [];
  for (const row of json) {
    const lat = Number((row as { lat?: unknown })?.lat);
    const lng = Number((row as { lon?: unknown })?.lon);
    const name = String((row as { display_name?: unknown })?.display_name ?? "").trim();
    if (name && isValidCoordinate(lat, lng)) out.push({ name, lat, lng });
  }
  return out;
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** First comma-separated part of a display name — a good default pin name ("Ogden Park, Chicago, …" → "Ogden Park"). */
export function shortPlaceName(displayName: string): string {
  return displayName.split(",")[0].trim() || displayName;
}

/** Parse a coordinate field: blank or non-numeric gives null. */
export function parseCoordinate(text: string): number | null {
  if (!text.trim()) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
