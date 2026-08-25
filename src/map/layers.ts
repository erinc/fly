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

  function update(layers: OriginLayer[], airports: Airport[]): void {
    group.clearLayers();

    // Arcs first, so dots and markers sit on top.
    for (const layer of layers) {
      for (const d of layer.destinations) {
        const dest = airports[d.airport];
        if (!dest) continue;
        // arcSegments interpolates along the great circle and splits at the
        // antimeridian. Leaflet draws straight lines between vertices, so this
        // step is what makes an arc an arc.
        for (const seg of arcSegments(layer.origin, dest, ARC_STEPS)) {
          L.polyline(
            seg.map((p) => [p.lat, p.lon] as [number, number]),
            { renderer, color: layer.color, weight: 0.9, opacity: 0.55, interactive: false },
          ).addTo(group);
        }
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
        radius: 3,
        color,
        fillColor: color,
        fillOpacity: 1,
        weight: 0,
      }).addTo(group);

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

  return {
    update,
    remove() {
      group.remove();
    },
  };
}
