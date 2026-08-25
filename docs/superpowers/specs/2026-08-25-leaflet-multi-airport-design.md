# fly.eric.fun v2 — Interactive Map, Multiple Airports

**Date:** 2026-08-25
**Status:** Approved design, ready for implementation
**Supersedes:** parts of `2026-08-25-flight-radius-map-design.md` (§6 runtime
architecture, §7 interface). That spec's data pipeline (§3–§5) is unchanged and
remains authoritative.

## 1. What changes

Two changes to a working app:

1. **Two fixed airport slots (A/B) become one field accepting up to three
   airports.**
2. **The static canvas map becomes an interactive Leaflet map** with pan, zoom,
   tooltips, zoom-aware labels and auto-focus.

The build-time data pipeline, the duration model and the shipped bundle format
are untouched.

### Explicitly dropped

- **Shared destinations.** The intersection concept, the emphasised near-black
  dots, `sharedDestinations()` and its tests are removed. With N origins the
  map shows each origin's reach in its own colour, overlaid.
- **`d3-geo`.** Projection was its only substantive use.
- **Equal Earth.** Leaflet uses Web Mercator (§3).

### Explicitly not built

- Clicking a destination to promote it to an origin.
- Clicking an origin marker to remove it (removal is via the chip's ×).
- Raster tiles of any kind.

## 2. Decisions

| Decision | Choice |
|---|---|
| Map library | Leaflet |
| Basemap | Existing `public/world.json` as a vector layer — no tiles |
| Projection | Web Mercator (Leaflet default), accepted |
| Airport limit | 3 |
| Shared destinations | Removed entirely |
| Destination list | One section per selected airport |
| Map interactions | Pan/zoom, tooltips, zoom-aware labels, auto-focus |
| Arc renderer | `L.canvas()` |

## 3. Rendering architecture

### 3.1 Why the great-circle code survives

Leaflet draws straight lines between the points it is given. It has no concept
of a great circle. `src/geo/arc.ts` therefore stays exactly as it is: it
interpolates along the sphere and splits at the antimeridian, and Leaflet
receives the resulting vertex arrays as polylines. Removing or simplifying it
would silently turn every arc into a rhumb-ish straight line.

### 3.2 Layers

| Layer | Implementation | Pane |
|---|---|---|
| Sea | Map container background `#dceaf2` | — |
| Land + borders | `L.geoJSON(world)`, fill `#f2f0eb`, stroke `#b3ada2` @ 0.5px | default overlay |
| Arcs | `L.polyline` per segment, on `L.canvas()` | default overlay |
| Destination dots | `L.circleMarker`, on the same canvas renderer | default overlay |
| Origin markers | `L.circleMarker`, larger, with a ring | default overlay |
| Country labels | `L.marker` with `divIcon` | dedicated non-interactive pane |

**The arc and dot layers MUST use `L.canvas()`.** Three origins of ~200
destinations at 48 vertices each is on the order of 30,000 path vertices;
Leaflet's default SVG renderer creates a DOM node per path and stutters on pan.

The label pane must set `pointer-events: none` so labels never intercept
interaction meant for destination dots.

### 3.3 Projection

Web Mercator, Leaflet's default. This is a visible change from Equal Earth:
high latitudes inflate (Greenland appears larger than Africa). Accepted as the
conventional behaviour of interactive web maps. A custom Leaflet CRS was
considered and rejected as fighting the library's grain for no user benefit.

### 3.4 Bundle impact

`+` Leaflet (~42 KB gzipped), `−` d3-geo and `@types/d3-geo` (~12 KB gzipped).

## 4. State model

```ts
type AppState = {
  airports: string[];        // ordered, max 3, unique, validated
  minutes: number;           // 30–480, 15-minute steps (unchanged)
  yearRoundOnly: boolean;    // unchanged
};

export const MAX_AIRPORTS = 3;
```

### 4.1 URL

Canonical form: `?a=BER,LIS,IST&t=180&yr=1`

`parseState` must also accept the **legacy** `?a=BER&b=LIS` form and fold it
into the array, so previously shared links keep working. `toSearch` always
emits the canonical comma-separated form. Unknown codes, duplicates, and
anything past the third entry are dropped.

### 4.2 Colours

Assigned **by position in the array**, not by airport identity:

| Index | Colour |
|---|---|
| 0 | `#d94f45` (red) |
| 1 | `#2b6cb0` (blue) |
| 2 | `#2e7d4f` (green) |

Removing the first airport re-colours the remainder. This keeps the chip
colour, the arc colour and the list-section colour in agreement at all times.

The shared-destination colour `#111` is retired. Ocean, land, border and label
colours are unchanged.

## 5. Interface

### 5.1 Airport selector

Replaces `createPicker`'s two `{ el, setValue }` instances with a single
`createAirportSelector` that owns the whole list.

- One search field, cleared and ready after each selection.
- Selected airports render below as chips: colour dot, IATA, city, and an ×
  button to remove. The × must be a real `<button>` with an accessible name.
- At `MAX_AIRPORTS` the input is disabled with a short note; removing a chip
  re-enables it.
- Selecting an airport already in the list is a no-op, not a duplicate.

### 5.2 Destination list

One section per selected airport, in selection order, each headed by the
airport with its colour and its destination count, sorted by flight time
ascending. Seasonal and charter tags are unchanged.

Empty states, stated in words:
- A selected airport with no destinations under the current limit.
- No airports selected at all.

### 5.3 Map interaction

**Tooltips.** Bound to every destination marker; hover on desktop, tap on
mobile. Content: city, IATA code, and the flight time from *each* selected
origin that reaches it — with three airports selected, up to three times.

**Zoom-aware labels.** `visibleLabels(labels, zoom)` already accepts a zoom
argument and is currently pinned at `1`. It must be driven by Leaflet's actual
zoom on `zoomend`, with `placeLabels` collision suppression re-run per zoom
level. Both functions keep their existing tests.

**Auto-focus.** `fitBounds` over the origins plus their reachable destinations,
with padding. Two required constraints:

- **Only on selection change** — adding or removing an airport. It must NOT
  fire on slider changes or on any redraw, or it will yank the view away from a
  user who has just panned somewhere deliberately.
- **Antimeridian-safe** — a reach set spanning ±180° must not produce bounds
  that zoom out to the whole world.

### 5.4 Unchanged

The slider, the year-round toggle, the panel's desktop-rail/mobile-sheet
reflow, the footer attribution, and all empty-state and accessibility
requirements from the v1 spec.

## 6. Files

**Rewritten**
- `src/main.ts` — wiring for N airports and Leaflet
- `src/ui/picker.ts` → `src/ui/selector.ts` — multi-select with chips
- `src/ui/list.ts` — one section per airport
- `src/state/url.ts` — array state, legacy-form parsing
- `src/render/labels.ts` — same selection/suppression logic, Leaflet markers

**New**
- `src/map/map.ts` — Leaflet setup, panes, basemap layer
- `src/map/layers.ts` — arc/dot/origin layer construction and teardown

**Deleted**
- `src/geo/projection.ts` and its test
- `src/render/basemap.ts`
- `src/render/arcs.ts` and its test
- `sharedDestinations` from `src/reach/query.ts`, and its two tests

**Untouched**
- `src/geo/{types,distance,duration,arc}.ts`, `src/data/*`, `src/ui/{slider,toggle,format,panel}.ts`, all of `scripts/`, all of `public/`

## 7. Testing

Pure logic keeps and extends its tests:
- URL round-trip for 0–3 airports; legacy `?a=X&b=Y` folding; cap enforcement;
  duplicate and unknown-code rejection.
- Colour assignment by position, including after a removal.
- Tooltip text composition for 1, 2 and 3 reaching origins.
- `visibleLabels` and `placeLabels` tests carry over unchanged.

Leaflet layer wiring gets no unit tests — the same rule the canvas renderer
followed. It is verified in a browser: arcs curve, the antimeridian does not
draw a stripe, tooltips show correct per-origin times, labels thin and fill
with zoom, auto-focus fires on selection change but not on slider drags, and
the mobile sheet still sits above the map.

`reachable()` is not modified; its tests stand.

## 8. Risks

| Risk | Mitigation |
|---|---|
| SVG renderer stutter | `L.canvas()` mandated for arcs and dots |
| Labels stealing pointer events | Dedicated pane with `pointer-events: none` |
| Auto-focus fighting the user | Fires only on selection change |
| Antimeridian bounds blowing up | Explicitly handled and browser-verified |
| Mercator distortion surprising | Accepted decision, recorded here |
| Legacy links breaking | `?a=X&b=Y` parsed and folded |
