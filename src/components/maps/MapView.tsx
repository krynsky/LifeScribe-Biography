import { useEffect, useRef } from "react";
import type { MapPin } from "@/lib/models";

interface MapViewProps {
  pins: MapPin[];
  onPinClick?: (pin: MapPin) => void;
  onMapClick?: (lat: number, lng: number) => void;
  height?: string;
}

export default function MapView({ pins, onPinClick, onMapClick, height = "500px" }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  // Keep callback refs so the map event handler always calls the latest version
  // without needing to re-initialize the map when these change.
  const onMapClickRef = useRef(onMapClick);
  const onPinClickRef = useRef(onPinClick);
  onMapClickRef.current = onMapClick;
  onPinClickRef.current = onPinClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Guard against React StrictMode's double-invoke: if cleanup fires before
    // the async import resolves, we set cancelled = true and bail out.
    let cancelled = false;

    // Dynamic import of Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Fix Leaflet's default icon path issue with bundlers
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!).setView([20, 0], 2);
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // Use ref so we always call the latest onMapClick without re-initing the map
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      // Add existing pins
      pins.forEach((pin) => {
        const marker = L.marker([pin.latitude, pin.longitude])
          .addTo(map)
          .bindPopup(`<strong>${pin.name}</strong>${pin.description ? `<br>${pin.description}` : ""}`);
        marker.on("click", () => onPinClickRef.current?.(pin));
      });

      // Fit bounds if we have pins; cap zoom so a single pin doesn't fill the screen
      if (pins.length === 1) {
        map.setView([pins[0].latitude, pins[0].longitude], 8);
      } else if (pins.length > 1) {
        const bounds = L.latLngBounds(pins.map((p) => [p.latitude, p.longitude]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        (mapRef.current as { remove: () => void }).remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when pins change
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      const map = mapRef.current as { eachLayer: (fn: (l: unknown) => void) => void; removeLayer: (l: unknown) => void; addLayer: (l: unknown) => void };
      // Remove all markers and re-add
      map.eachLayer((layer: unknown) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      pins.forEach((pin) => {
        const marker = L.marker([pin.latitude, pin.longitude]).bindPopup(
          `<strong>${pin.name}</strong>${pin.description ? `<br>${pin.description}` : ""}`
        );
        map.addLayer(marker);
        if (onPinClick) marker.on("click", () => onPinClick(pin));
      });
    });
  }, [pins, onPinClick]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: "0.75rem", overflow: "hidden" }}
    />
  );
}
