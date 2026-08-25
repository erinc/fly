// src/map/map.ts
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export const LABEL_PANE = "labels";

/**
 * The map surface. No tile layer: the basemap is the same Natural Earth
 * GeoJSON the canvas renderer used, so the app makes no external requests and
 * still works offline. The sea is the container background, set in styles.css.
 */
export function createMap(
  container: HTMLElement,
  world: GeoJSON.FeatureCollection,
): L.Map {
  const map = L.map(container, {
    center: [30, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 8,
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: false,
  });

  // Labels sit above the overlay pane but must never swallow pointer events
  // aimed at destination dots.
  map.createPane(LABEL_PANE);
  const pane = map.getPane(LABEL_PANE)!;
  pane.style.zIndex = "650";
  pane.style.pointerEvents = "none";

  L.geoJSON(world, {
    interactive: false,
    style: {
      fillColor: "#f2f0eb",
      fillOpacity: 1,
      color: "#b3ada2",
      weight: 0.5,
    },
  }).addTo(map);

  return map;
}
