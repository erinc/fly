import {
  GeoJSONSource,
  Map as MapLibreMap,
  Popup,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import type { Feature, FeatureCollection } from "geojson";
import { arcSegments } from "../geo/arc.js";
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { tooltipLines, type OriginLeg } from "./tooltip.js";

export type OriginLayer = {
  origin: Airport;
  destinations: Reachable[];
  color: string;
};

const ARC_STEPS = 48;

const ROUTES_SOURCE = "flight-routes";
const DESTINATIONS_SOURCE = "flight-destinations";
const ORIGINS_SOURCE = "flight-origins";
const HIGHLIGHT_SOURCE = "flight-highlight";

const ROUTES_LAYER = "flight-routes-line";
const HIGHLIGHT_ROUTES_LAYER = "flight-highlight-line";
const HIGHLIGHT_DOT_LAYER = "flight-highlight-dot";
const DESTINATIONS_LAYER = "flight-destination-dots";
const ORIGIN_RING_LAYER = "flight-origin-rings";
const ORIGINS_LAYER = "flight-origin-dots";

const emptyCollection = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

function source(map: MapLibreMap, id: string): GeoJSONSource {
  return map.getSource(id) as GeoJSONSource;
}

/** GPU-rendered route, airport, highlight and tooltip layers. */
export function createReachLayer(map: MapLibreMap) {
  for (const id of [
    ROUTES_SOURCE,
    DESTINATIONS_SOURCE,
    ORIGINS_SOURCE,
    HIGHLIGHT_SOURCE,
  ]) {
    map.addSource(id, { type: "geojson", data: emptyCollection() });
  }

  // CARTO interleaves one early label layer with roads and borders, so using
  // the first symbol as the insertion point puts flights underneath country
  // outlines. Insert after the final non-symbol layer instead: routes and dots
  // stay above all basemap geometry and below CARTO's main label stack.
  const styleLayers = map.getStyle().layers;
  let lastGeometry = -1;
  for (let i = styleLayers.length - 1; i >= 0; i--) {
    if (styleLayers[i]?.type !== "symbol") {
      lastGeometry = i;
      break;
    }
  }
  const firstMainLabel = styleLayers[lastGeometry + 1]?.id;

  map.addLayer({
    id: ROUTES_LAYER,
    type: "line",
    source: ROUTES_SOURCE,
    paint: {
      "line-color": ["get", "color"],
      "line-width": 1.1,
      "line-opacity": 0.55,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, firstMainLabel);

  map.addLayer({
    id: HIGHLIGHT_ROUTES_LAYER,
    type: "line",
    source: HIGHLIGHT_SOURCE,
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2.8,
      "line-opacity": 1,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  }, firstMainLabel);

  map.addLayer({
    id: DESTINATIONS_LAYER,
    type: "circle",
    source: DESTINATIONS_SOURCE,
    paint: {
      "circle-radius": 3,
      "circle-color": ["get", "color"],
    },
  }, firstMainLabel);

  map.addLayer({
    id: HIGHLIGHT_DOT_LAYER,
    type: "circle",
    source: HIGHLIGHT_SOURCE,
    paint: {
      "circle-radius": 5.5,
      "circle-color": ["get", "color"],
    },
  }, firstMainLabel);

  map.addLayer({
    id: ORIGIN_RING_LAYER,
    type: "circle",
    source: ORIGINS_SOURCE,
    paint: {
      "circle-radius": 9,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": ["get", "color"],
      "circle-stroke-width": 1.4,
      "circle-stroke-opacity": 0.6,
    },
  }, firstMainLabel);

  map.addLayer({
    id: ORIGINS_LAYER,
    type: "circle",
    source: ORIGINS_SOURCE,
    paint: {
      "circle-radius": 5,
      "circle-color": ["get", "color"],
    },
  }, firstMainLabel);

  let highlightByAirport = new Map<number, Feature[]>();
  let popupData = new Map<number, { destination: Airport; legs: OriginLeg[] }>();

  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    focusAfterOpen: false,
    offset: 9,
  });

  const showDestination = (event: MapLayerMouseEvent) => {
    const index = Number(event.features?.[0]?.properties?.airport);
    const data = popupData.get(index);
    if (!data) return;

    const content = document.createElement("div");
    for (const line of tooltipLines(data.destination, data.legs)) {
      const row = document.createElement("div");
      row.textContent = line;
      content.appendChild(row);
    }

    map.getCanvas().style.cursor = "pointer";
    void source(map, HIGHLIGHT_SOURCE).setData({
      type: "FeatureCollection",
      features: highlightByAirport.get(index) ?? [],
    });
    popup
      .setLngLat([data.destination.lon, data.destination.lat])
      .setDOMContent(content)
      .addTo(map);
  };

  const hideDestination = () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
    void source(map, HIGHLIGHT_SOURCE).setData(emptyCollection());
  };

  map.on("mouseenter", DESTINATIONS_LAYER, showDestination);
  map.on("mouseleave", DESTINATIONS_LAYER, hideDestination);

  function update(layers: OriginLayer[], airports: Airport[]): void {
    const routeFeatures: Feature[] = [];
    const destinationFeatures: Feature[] = [];
    const originFeatures: Feature[] = [];
    const nextHighlights = new Map<number, Feature[]>();

    for (const layer of layers) {
      originFeatures.push({
        type: "Feature",
        properties: { color: layer.color },
        geometry: {
          type: "Point",
          coordinates: [layer.origin.lon, layer.origin.lat],
        },
      });

      for (const destination of layer.destinations) {
        const airport = airports[destination.airport];
        if (!airport) continue;
        const highlights = nextHighlights.get(destination.airport) ?? [];

        for (const segment of arcSegments(layer.origin, airport, ARC_STEPS)) {
          const feature: Feature = {
            type: "Feature",
            properties: { color: layer.color, airport: destination.airport },
            geometry: {
              type: "LineString",
              coordinates: segment.map((point) => [point.lon, point.lat]),
            },
          };
          routeFeatures.push(feature);
          highlights.push(feature);
        }
        nextHighlights.set(destination.airport, highlights);
      }
    }

    const legsByAirport = new Map<number, OriginLeg[]>();
    const colorByAirport = new Map<number, string>();
    for (const layer of layers) {
      for (const destination of layer.destinations) {
        const legs = legsByAirport.get(destination.airport) ?? [];
        legs.push({ iata: layer.origin.iata, minutes: destination.minutes });
        legsByAirport.set(destination.airport, legs);
        if (!colorByAirport.has(destination.airport)) {
          colorByAirport.set(destination.airport, layer.color);
        }
      }
    }

    const nextPopupData = new Map<number, { destination: Airport; legs: OriginLeg[] }>();
    for (const [index, legs] of legsByAirport) {
      const destination = airports[index];
      if (!destination) continue;
      const color = colorByAirport.get(index) ?? "#111";
      const point: Feature = {
        type: "Feature",
        id: index,
        properties: { airport: index, color },
        geometry: {
          type: "Point",
          coordinates: [destination.lon, destination.lat],
        },
      };
      destinationFeatures.push(point);
      const highlights = nextHighlights.get(index) ?? [];
      highlights.push(point);
      nextHighlights.set(index, highlights);
      nextPopupData.set(index, { destination, legs });
    }

    highlightByAirport = nextHighlights;
    popupData = nextPopupData;
    hideDestination();

    void source(map, ROUTES_SOURCE).setData({
      type: "FeatureCollection",
      features: routeFeatures,
    });
    void source(map, DESTINATIONS_SOURCE).setData({
      type: "FeatureCollection",
      features: destinationFeatures,
    });
    void source(map, ORIGINS_SOURCE).setData({
      type: "FeatureCollection",
      features: originFeatures,
    });
  }

  return {
    update,
    remove() {
      map.off("mouseenter", DESTINATIONS_LAYER, showDestination);
      map.off("mouseleave", DESTINATIONS_LAYER, hideDestination);
      popup.remove();
      for (const id of [
        ORIGINS_LAYER,
        ORIGIN_RING_LAYER,
        HIGHLIGHT_DOT_LAYER,
        DESTINATIONS_LAYER,
        HIGHLIGHT_ROUTES_LAYER,
        ROUTES_LAYER,
      ]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [
        HIGHLIGHT_SOURCE,
        ORIGINS_SOURCE,
        DESTINATIONS_SOURCE,
        ROUTES_SOURCE,
      ]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    },
  };
}
