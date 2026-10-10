import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { searchPlaces } from "@/lib/geocode-search";
import type { PlaceResult } from "@/lib/geocode";

interface PlaceSearchBoxProps {
  onPick: (place: PlaceResult) => void;
  placeholder?: string;
}

/** Search OpenStreetMap for a place (needs internet) and choose a result. Typing coordinates by hand always works offline. */
export default function PlaceSearchBox({ onPick, placeholder = "Search for a place…" }: PlaceSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced (Nominatim asks clients to go easy on requests).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setError(null);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchPlaces(query));
      } catch {
        setResults([]);
        setError("Place search needs an internet connection. You can still click the map or type coordinates.");
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-label="Search for a place"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "var(--color-text-muted)" }} />}
      </div>
      {results.length > 0 && (
        <ul className="absolute z-[600] left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.name}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setQuery("");
                  setResults([]);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
                style={{ color: "var(--color-text)" }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{error}</p>}
    </div>
  );
}
