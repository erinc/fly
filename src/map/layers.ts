// src/map/layers.ts
import L from "leaflet";
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

const ARC_BASE_STYLE = { weight: 0.9, opacity: 0.55 };
const ARC_HIGHLIGHT_STYLE = { weight: 2.6, opacity: 1 };
const DOT_BASE_RADIUS = 3;
const DOT_HIGHLIGHT_RADIUS = 5.5;

/**
 * Arcs, destination dots and origin markers.
 *
 * Everything renders through a single L.canvas(). Three origins of ~200
 * destinations at 48 vertices each is on the order of 30,000 path vertices;
 * the default SVG renderer would make a DOM node per path and stutter on pan.
 */
export function createReachLayer(map: L.Map) {
  const renderer = L.canvas({ padding: 0.3 });
  const group = L.layerGroup().addTo(map);

  // Per-destination lookups rebuilt on every update(), since clearLayers()
  // destroys the Leaflet objects they point to. Used by highlight() to
  // restyle only the handful of paths touched by a hover, not the whole scene.
  let arcsByAirport = new Map<number, L.Polyline[]>();
  let dotByAirport = new Map<number, L.CircleMarker>();
  let highlighted: number | null = null;

  function update(layers: OriginLayer[], airports: Airport[]): void {
    group.clearLayers();
    arcsByAirport = new Map();
    dotByAirport = new Map();
    highlighted = null;

    // Arcs first, so dots and markers sit on top.
    for (const layer of layers) {
      for (const d of layer.destinations) {
        const dest = airports[d.airport];
        if (!dest) continue;
        // arcSegments interpolates along the great circle and splits at the
        // antimeridian. Leaflet draws straight lines between vertices, so this
        // step is what makes an arc an arc.
        const arcs = arcsByAirport.get(d.airport) ?? [];
        for (const seg of arcSegments(layer.origin, dest, ARC_STEPS)) {
          const pl = L.polyline(
            seg.map((p) => [p.lat, p.lon] as [number, number]),
            { renderer, color: layer.color, ...ARC_BASE_STYLE, interactive: false },
          ).addTo(group);
          arcs.push(pl);
        }
        arcsByAirport.set(d.airport, arcs);
      }
    }

    // One dot per destination, carrying every origin that reaches it.
    // Colour is captured here, from the first origin that reaches each
    // destination (matching its arcs), so update() doesn't need to re-scan
    // `layers` per destination below.
    const legsByAirport = new Map<number, OriginLeg[]>();
    const colorByAirport = new Map<number, string>();
    for (const layer of layers) {
      for (const d of layer.destinations) {
        const legs = legsByAirport.get(d.airport) ?? [];
        legs.push({ iata: layer.origin.iata, minutes: d.minutes });
        legsByAirport.set(d.airport, legs);
        if (!colorByAirport.has(d.airport)) colorByAirport.set(d.airport, layer.color);
      }
    }

    for (const [index, legs] of legsByAirport) {
      const dest = airports[index];
      if (!dest) continue;
      const color = colorByAirport.get(index) ?? "#111";
      const marker = L.circleMarker([dest.lat, dest.lon], {
        renderer,
        radius: DOT_BASE_RADIUS,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 0,
      }).addTo(group);
      dotByAirport.set(index, marker);
      marker.on("mouseover", () => highlight(index));
      marker.on("mouseout", () => highlight(null));

      const content = document.createElement("div");
      for (const line of tooltipLines(dest, legs)) {
        const row = document.createElement("div");
        row.textContent = line;
        content.appendChild(row);
      }
      marker.bindTooltip(content, { direction: "top", opacity: 1 });
    }

    for (const layer of layers) {
      L.circleMarker([layer.origin.lat, layer.origin.lon], {
        renderer,
        radius: 5,
        color: layer.color,
        fillColor: layer.color,
        fillOpacity: 1,
        weight: 0,
      }).addTo(group);
      L.circleMarker([layer.origin.lat, layer.origin.lon], {
        renderer,
        radius: 9,
        color: layer.color,
        fill: false,
        weight: 1.4,
        opacity: 0.6,
        interactive: false,
      }).addTo(group);
    }
  }

  /** Highlight all arcs and the dot for one destination airport, restoring
   *  whatever was previously highlighted first. Safe to call with an index
   *  that isn't currently drawn (e.g. after the slider drops it out of
   *  range) — it's just a no-op for that side. */
  function highlight(airport: number | null): void {
    if (airport === highlighted) return;

    if (highlighted !== null) {
      for (const pl of arcsByAirport.get(highlighted) ?? []) pl.setStyle(ARC_BASE_STYLE);
      dotByAirport.get(highlighted)?.setRadius(DOT_BASE_RADIUS);
    }

    highlighted = airport;

    if (airport !== null) {
      for (const pl of arcsByAirport.get(airport) ?? []) {
        pl.setStyle(ARC_HIGHLIGHT_STYLE);
        pl.bringToFront();
      }
      dotByAirport.get(airport)?.setRadius(DOT_HIGHLIGHT_RADIUS);
    }
  }

  return {
    update,
    highlight,
    remove() {
      group.remove();
    },
  };
}
