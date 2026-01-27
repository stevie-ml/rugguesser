import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'maplibre-gl';
import '@maplibre/maplibre-gl-leaflet';

interface GameMapProps {
  onGuess: (lat: number, lng: number) => void;
  guessLat: number | null;
  guessLng: number | null;
  actualLat: number | null;
  actualLng: number | null;
  showResult: boolean;
  disabled: boolean;
  round: number;
}

export default function GameMap({
  onGuess,
  guessLat,
  guessLng,
  actualLat,
  actualLng,
  showResult,
  disabled,
  round,
}: GameMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const guessMarkerRef = useRef<L.Marker | null>(null);
  const actualMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);

  // Keep callback refs current so the click handler always uses latest values
  const onGuessRef = useRef(onGuess);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onGuessRef.current = onGuess;
    disabledRef.current = disabled;
  });

  // Initialize the Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [30, 40],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
    });

    // Use MapLibre GL vector tiles with CARTO Voyager style — forced English labels
    const glLayer = (L as any).maplibreGL({
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    glLayer.addTo(map);

    // Force all text labels to English
    const mlMap = glLayer.getMaplibreMap();
    mlMap.on('styledata', () => {
      try {
        const style = mlMap.getStyle();
        if (!style || !style.layers) return;
        for (const layer of style.layers) {
          if (
            layer.type === 'symbol' &&
            layer.layout &&
            layer.layout['text-field']
          ) {
            mlMap.setLayoutProperty(layer.id, 'text-field', [
              'coalesce',
              ['get', 'name_en'],
              ['get', 'name:en'],
              ['get', 'name_int'],
              ['get', 'name'],
            ]);
          }
        }
      } catch {
        // style not ready yet, will retry on next styledata event
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!disabledRef.current) {
        onGuessRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reset markers / line when a new round starts
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    [guessMarkerRef, actualMarkerRef].forEach((ref) => {
      if (ref.current) {
        map.removeLayer(ref.current);
        ref.current = null;
      }
    });
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }

    map.setView([30, 40], 3);
  }, [round]);

  // Place / move the guess marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (guessMarkerRef.current) {
      map.removeLayer(guessMarkerRef.current);
      guessMarkerRef.current = null;
    }

    if (guessLat != null && guessLng != null) {
      const icon = L.divIcon({
        className: 'guess-marker',
        html: '<div class="guess-pin"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      guessMarkerRef.current = L.marker([guessLat, guessLng], {
        icon,
      }).addTo(map);
    }
  }, [guessLat, guessLng]);

  // Show result: actual marker + connecting line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean previous result layers
    if (actualMarkerRef.current) {
      map.removeLayer(actualMarkerRef.current);
      actualMarkerRef.current = null;
    }
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }

    if (showResult && actualLat != null && actualLng != null) {
      // Red pin for the actual location
      const flagIcon = L.divIcon({
        className: 'actual-marker',
        html: '<div class="actual-pin"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      actualMarkerRef.current = L.marker([actualLat, actualLng], {
        icon: flagIcon,
      }).addTo(map);

      // Red line from guess to actual
      if (guessLat != null && guessLng != null) {
        lineRef.current = L.polyline(
          [
            [guessLat, guessLng],
            [actualLat, actualLng],
          ],
          { color: '#e74c3c', weight: 3 }
        ).addTo(map);

        // Zoom to show both markers
        const bounds = L.latLngBounds(
          [guessLat, guessLng],
          [actualLat, actualLng]
        );
        map.fitBounds(bounds, { padding: [100, 100], maxZoom: 8 });
      }
    }
  }, [showResult, actualLat, actualLng, guessLat, guessLng]);

  return <div ref={containerRef} id="game-map" />;
}
