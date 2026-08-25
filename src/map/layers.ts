// src/map/layers.ts
import L from "leaflet";
import { arcSegments } from "../geo/arc.js";
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { tooltipLines, type OriginLeg } from "./tooltip.js";
import { MAX_AIRPORTS } from "../theme.js";

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

// A destination can be reached from at most MAX_AIRPORTS origins (the app
// caps the selected-airport list at that length). Each origin's arc is one
// great-circle path, and splitAtAntimeridian only ever produces 2 segments
// for a single path (one possible crossing of the seam) — a great circle
// between two points crosses any given meridian at most once. So the worst
// case for one destination is MAX_AIRPORTS * 2 polyline segments; that's
// the fixed pool size below. Sized from that reasoning, not a guess.
const HIGHLIGHT_POOL_SIZE = MAX_AIRPORTS * 2;

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

  // Hover highlighting draws into a second, separate canvas/group so it
  // never touches the base canvas. Leaflet's canvas renderer has no partial
  // invalidation: any setStyle/setRadius/bringToFront on a canvas-rendered
  // path clears and repaints the *entire* canvas it belongs to, which with
  // ~30,000 base vertices made hovering down the destination list flash the
  // whole map.
  //
  // The fix isn't a different renderer per se — it's that highlight() must
  // never create or destroy layers, only mutate a fixed pool. Once that's
  // true, a dedicated L.canvas() is the better choice of the two:
  //   - It touches zero DOM. L.svg() would keep persistent <path> nodes,
  //     which is fine for churn but every setLatLngs/setStyle on them still
  //     triggers Chromium style/layout recalc on real DOM elements, and the
  //     browser has to manage those nodes' paint/composite layering.
  //   - It redraws only its own canvas, which holds at most
  //     HIGHLIGHT_POOL_SIZE + 1 tiny paths — cheap to fully repaint on the
  //     rare occasions Leaflet does redraw it (e.g. on setStyle), and that
  //     repaint never touches the base canvas's ~30,000 vertices.
  // It's added after `group` so it stacks above the base canvas.
  const highlightRenderer = L.canvas({ padding: 0.25 });
  const highlightGroup = L.layerGroup().addTo(map);

  // Fixed pool of highlight layers, created once and reused for the
  // lifetime of this reach layer. highlight() only ever calls
  // setLatLngs/setStyle/setLatLng on these — never addTo/removeLayer/
  // clearLayers/new L.polyline(...), so hovering never churns layers.
  const highlightPool: L.Polyline[] = [];
  for (let i = 0; i < HIGHLIGHT_POOL_SIZE; i++) {
    highlightPool.push(
      L.polyline([], {
        renderer: highlightRenderer,
        ...ARC_HIGHLIGHT_STYLE,
        interactive: false,
      }).addTo(highlightGroup),
    );
  }
  // Track each pooled polyline's last-applied colour so highlight() can
  // skip redundant setStyle calls (a no-op setStyle is itself a repaint of
  // the highlight canvas).
  const highlightPoolColor: (string | null)[] = new Array(HIGHLIGHT_POOL_SIZE).fill(null);
  // CircleMarker has no "empty latlngs" equivalent to hide it, so it starts
  // (and is hidden again) with radius 0 — setRadius, like setLatLngs([]) on
  // a polyline, hides it without detaching it from the map.
  const highlightMarker = L.circleMarker([0, 0], {
    renderer: highlightRenderer,
    radius: 0,
    fillOpacity: 1,
    weight: 0,
    interactive: false,
  }).addTo(highlightGroup);
  let highlightMarkerColor: string | null = null;
  let highlightMarkerVisible = false;

  // Per-destination lookups rebuilt on every update(), since clearLayers()
  // destroys the Leaflet objects they point to.
  // - dotByAirport: base dot markers, used only to wire up hover events.
  // - highlightData: plain coordinate/colour data (not Leaflet objects) used
  //   by highlight() to reposition the pooled highlight layers, so the base
  //   group's polylines/markers are never mutated after creation.
  let dotByAirport = new Map<number, L.CircleMarker>();
  let highlightData = new Map<number, HighlightData>();
  let highlighted: number | null = null;
  let scheduled: number | null | undefined;
  let rafId: number | null = null;

  function update(layers: OriginLayer[], airports: Airport[]): void {
    group.clearLayers();
    // The highlight pool is never rebuilt — only the base `group` is
    // destroyed and recreated here. Reset the pool to its hidden state so
    // update() (e.g. from a slider change) doesn't leave a stale highlight
    // drawn for a destination that may no longer exist.
    hideHighlightPool();
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

  /** Hide every pooled highlight layer without detaching it from the map:
   *  setLatLngs([]) renders nothing but keeps the polyline attached, and
   *  setRadius(0) does the same for the marker. Never removes/creates
   *  layers. */
  function hideHighlightPool(): void {
    for (const p of highlightPool) p.setLatLngs([]);
    if (highlightMarkerVisible) {
      highlightMarker.setRadius(0);
      highlightMarkerVisible = false;
    }
  }

  /** Reposition the highlight pool for one destination airport (or hide it,
   *  for null). Only ever mutates the fixed `highlightPool`/`highlightMarker`
   *  — never adds, removes, or constructs a layer, and never clears the
   *  highlight group. The base group's paths are untouched either way. */
  function drawHighlight(airport: number | null): void {
    highlighted = airport;
    if (airport === null) {
      hideHighlightPool();
      return;
    }

    const data = highlightData.get(airport);
    if (!data) {
      hideHighlightPool();
      return;
    }

    // data.arcs.length is bounded by HIGHLIGHT_POOL_SIZE (see its
    // derivation above), so every arc gets a pool slot.
    let i = 0;
    for (; i < data.arcs.length; i++) {
      const arc = data.arcs[i]!;
      const poly = highlightPool[i]!;
      poly.setLatLngs(arc.latlngs);
      if (highlightPoolColor[i] !== arc.color) {
        poly.setStyle({ color: arc.color });
        highlightPoolColor[i] = arc.color;
      }
    }
    // Hide any pool members left over from a previous, larger highlight.
    for (; i < highlightPool.length; i++) highlightPool[i]!.setLatLngs([]);

    const color = data.arcs[0]?.color ?? "#111";
    highlightMarker.setLatLng([data.lat, data.lon]);
    if (!highlightMarkerVisible) {
      highlightMarker.setRadius(DOT_HIGHLIGHT_RADIUS);
      highlightMarkerVisible = true;
    }
    if (highlightMarkerColor !== color) {
      highlightMarker.setStyle({ color, fillColor: color });
      highlightMarkerColor = color;
    }
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
