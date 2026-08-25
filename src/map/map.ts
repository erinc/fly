import {
  AttributionControl,
  Map as MapLibreMap,
  setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// MapLibre 6 ships its vector-tile worker separately. Vite must bundle that
// worker explicitly; otherwise development and production can silently look
// like an empty map while the missing worker never processes any tiles.
setWorkerUrl(workerUrl);

const CARTO_POSITRON_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const OCEAN_COLOR = "#cfe8f3";

/**
 * GPU-rendered map surface backed by CARTO's Positron vector basemap.
 * MapLibre handles wheel and pinch input continuously and keeps basemap and
 * application layers in one WebGL scene.
 */
export async function createMap(container: HTMLElement): Promise<MapLibreMap> {
  const map = new MapLibreMap({
    container,
    style: CARTO_POSITRON_STYLE,
    center: [10, 30],
    zoom: 1,
    minZoom: 1,
    maxZoom: 8,
    renderWorldCopies: true,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    canvasContextAttributes: { antialias: true },
  });

  map.touchZoomRotate.disableRotation();
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");

  // The attribution starts empty, then MapLibre expands it when the CARTO
  // source metadata arrives. Collapse it immediately after that first update.
  const collapseInitialAttribution = () => {
    const attribution = container.querySelector(
      ".maplibregl-ctrl-attrib.maplibregl-compact",
    );
    if (!attribution) return;

    attribution.classList.remove("maplibregl-compact-show");
    map.off("styledata", collapseInitialAttribution);
    map.off("sourcedata", collapseInitialAttribution);
  };
  map.on("styledata", collapseInitialAttribution);
  map.on("sourcedata", collapseInitialAttribution);

  await new Promise<void>((resolve, reject) => {
    const ready = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(() => {
      map.off("style.load", ready);
      map.remove();
      reject(new Error("The vector basemap did not load in time."));
    }, 15_000);

    // App layers only need the style graph to exist. Waiting for MapLibre's
    // broader `load` event also waits for the first visible tile set, which
    // can unnecessarily hold the sidebar hostage on a slow connection.
    map.once("style.load", ready);
  });

  // CARTO Positron uses neutral gray water by default. Match its actual vector
  // source layer instead of its presentation-layer name so this remains robust
  // if CARTO renames the layer while keeping the same tileset schema.
  for (const layer of map.getStyle().layers) {
    if (
      layer.type === "fill" &&
      "source-layer" in layer &&
      layer["source-layer"] === "water" &&
      layer.id !== "water_shadow"
    ) {
      map.setPaintProperty(layer.id, "fill-color", OCEAN_COLOR);
    }
  }

  return map;
}
