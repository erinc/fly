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
    // minZoom/maxZoom stay whole-level bounds: the basemap is Natural Earth
    // 110m vector data, which looks visibly angular/low-res past zoom 8, so
    // the ceiling stays put even though zooming itself is now fractional.
    minZoom: 2,
    maxZoom: 8,
    // Fractional zoom so scroll/pinch/dbl-click feel smooth instead of
    // snapping a whole level at a time.
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 120,
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: false,
  });

  // Labels sit above markers (600) but below tooltips (650) — both are
  // Leaflet built-in panes, see leaflet.css — and must never swallow pointer
  // events aimed at destination dots.
  map.createPane(LABEL_PANE);
  const labelPane = map.getPane(LABEL_PANE)!;
  labelPane.style.zIndex = "620";
  labelPane.style.pointerEvents = "none";

  // The basemap gets its own pane below Leaflet's overlayPane (400), rather
  // than relying on the default renderer. Leaflet's stylesheet gives
  // .leaflet-map-pane canvas a z-index of 100 and svg a z-index of 200 -
  // *within* a pane - so an unrendered L.geoJSON (which defaults to SVG)
  // would paint above the reach layer's L.canvas() arcs regardless of pane
  // order, hiding every arc that crosses land. Giving the basemap its own
  // pane sidesteps that canvas-vs-svg ordering entirely.
  map.createPane("basemap");
  map.getPane("basemap")!.style.zIndex = "350";

  L.geoJSON(world, {
    pane: "basemap",
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
