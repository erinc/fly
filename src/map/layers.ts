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

type HighlightArc = { latlngs: [number, number][]; color: string };
type HighlightData = { arcs: HighlightArc[]; lat: number; lon: number };

/**
 * Arcs, destination dots and origin markers.
 *
 * Everything (except the hover highlight, see below) renders through a
 * single L.canvas(). Three origins of ~200 destinations at 48 vertices each
 * is on the order of 30,000 path vertices; the default SVG renderer would
 * make a DOM node per path and stutter on pan.
 */
export function createReachLayer(map: L.Map) {
  // padding extends the canvas beyond the viewport so panning doesn't
  // reveal unpainted edges before Leaflet redraws. src/styles.css's
  // .map { contain: paint } clips the canvas to the map's box regardless,
  // so the overhang never leaks into surrounding layout (e.g. the
  // sidebar) — 0.25 is safe and buys smoother panning at the cost of a
  // bigger off-viewport canvas.
  const renderer = L.canvas({ padding: 0.25 });
  const group = L.layerGroup().addTo(map);

  // Hover highlighting draws into a second, separate renderer/group so it
  // never touches the base canvas. Leaflet's canvas renderer has no partial
  // invalidation: any setStyle/setRadius/bringToFront on a canvas-rendered
  // path clears and repaints the *entire* canvas, which with ~30,000 base
  // vertices made hovering down the destination list flash the whole map.
  // Only a handful of paths ever live in the highlight layer at once, so
  // the default SVG renderer (one DOM node per path, updated in place) is
  // the right tool here — it's added after `group` so its DOM node stacks
  // above the base canvas.
  const highlightRenderer = L.svg();
  const highlightGroup = L.layerGroup().addTo(map);

  // Per-destination lookups rebuilt on every update(), since clearLayers()
  // destroys the Leaflet objects they point to.
  // - dotByAirport: base dot markers, used only to wire up hover events.
  // - highlightData: plain coordinate/colour data (not Leaflet objects) used
  //   by highlight() to draw fresh paths into the highlight layer, so the
  //   base group's polylines/markers are never mutated after creation.
  let dotByAirport = new Map<number, L.CircleMarker>();
  let highlightData = new Map<number, HighlightData>();
  let highlighted: number | null = null;
  let scheduled: number | null | undefined;
  let rafId: number | null = null;

  function update(layers: OriginLayer[], airports: Airport[]): void {
    group.clearLayers();
    highlightGroup.clearLayers();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    scheduled = undefined;
    dotByAirport = new Map();
    highlightData = new Map();
    highlighted = null;

    // Arcs first, so dots and markers sit on top.
    for (const layer of layers) {
      for (const d of layer.destinations) {
        const dest = airports[d.airport];
        if (!dest) continue;
        const entry = highlightData.get(d.airport) ?? { arcs: [], lat: dest.lat, lon: dest.lon };
        // arcSegments interpolates along the great circle and splits at the
        // antimeridian. Leaflet draws straight lines between vertices, so this
        // step is what makes an arc an arc.
        for (const seg of arcSegments(layer.origin, dest, ARC_STEPS)) {
          const latlngs = seg.map((p) => [p.lat, p.lon] as [number, number]);
          L.polyline(latlngs, {
            renderer,
            color: layer.color,
            ...ARC_BASE_STYLE,
            interactive: false,
          }).addTo(group);
          entry.arcs.push({ latlngs, color: layer.color });
        }
        highlightData.set(d.airport, entry);
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

  /** Redraw the highlight layer for one destination airport (or clear it,
   *  for null). Only ever touches `highlightGroup`/`highlightRenderer` —
   *  the base group's paths are never mutated. */
  function drawHighlight(airport: number | null): void {
    highlightGroup.clearLayers();
    highlighted = airport;
    if (airport === null) return;

    const data = highlightData.get(airport);
    if (!data) return;

    for (const arc of data.arcs) {
      L.polyline(arc.latlngs, {
        renderer: highlightRenderer,
        color: arc.color,
        ...ARC_HIGHLIGHT_STYLE,
        interactive: false,
      }).addTo(highlightGroup);
    }

    const color = data.arcs[0]?.color ?? "#111";
    L.circleMarker([data.lat, data.lon], {
      renderer: highlightRenderer,
      radius: DOT_HIGHLIGHT_RADIUS,
      color,
      fillColor: color,
      fillOpacity: 1,
      weight: 0,
      interactive: false,
    }).addTo(highlightGroup);
  }

  /** Highlight all arcs and the dot for one destination airport, restoring
   *  whatever was previously highlighted first. Safe to call with an index
   *  that isn't currently drawn (e.g. after the slider drops it out of
   *  range) — it's just a no-op for that side.
   *
   *  Calls are coalesced with requestAnimationFrame: a fast cursor sweep
   *  across many rows fires many mouseenter/mouseover events, but only the
   *  latest one wins per animation frame, so a sweep costs one redraw per
   *  frame rather than one per event. */
  function highlight(airport: number | null): void {
    if (rafId === null && airport === highlighted) return;

    scheduled = airport;
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      const next = scheduled;
      scheduled = undefined;
      if (next !== undefined && next !== highlighted) drawHighlight(next);
    });
  }

  return {
    update,
    highlight,
    remove() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      highlightGroup.remove();
      group.remove();
    },
  };
}
