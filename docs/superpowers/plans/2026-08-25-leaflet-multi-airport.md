# Leaflet + Multi-Airport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static canvas map with an interactive Leaflet map, and replace the two fixed airport slots with one field accepting up to three airports.

**Architecture:** Leaflet renders the existing `public/world.json` as a vector layer (no tiles), with arcs and dots on a `L.canvas()` renderer. The great-circle interpolation and antimeridian splitting in `src/geo/arc.ts` are unchanged and still required — Leaflet draws straight lines between whatever vertices it is given. State moves from `{a, b}` to an ordered `airports: string[]` capped at 3, with colours assigned by array position.

**Tech Stack:** Leaflet 1.9, TypeScript, Vite, Vitest. `d3-geo` is removed.

**Spec:** `docs/superpowers/specs/2026-08-25-leaflet-multi-airport-design.md`

## Global Constraints

- **`src/` is browser code with NO Node types.** No `process`, `Buffer`, `require`, `node:*`. `scripts/` is Node. Typecheck with **`npm run typecheck`** (runs both tsconfigs); plain `npx tsc --noEmit` is insufficient.
- TypeScript `strict` with `noUncheckedIndexedAccess`.
- **`MAX_AIRPORTS = 3`.**
- **Origin colours by array position, exact values:** index 0 `#d94f45`, index 1 `#2b6cb0`, index 2 `#2e7d4f`.
- **Unchanged palette:** ocean `#dceaf2`, land `#f2f0eb`, border `#b3ada2`, label `#9a948a`.
- Slider unchanged: 30–480 minutes, 15-minute steps.
- **Footer copy verbatim:** `Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports`
- **Arcs and dots MUST use `L.canvas()`**, never the default SVG renderer.
- The label pane MUST set `pointer-events: none`.
- **Auto-focus fires only on selection change**, never on slider changes or plain redraws.
- `src/geo/arc.ts`, `src/geo/distance.ts`, `src/geo/duration.ts`, `src/data/*`, `scripts/*`, `public/*` are **not modified**.
- `reachable()` in `src/reach/query.ts` is **not modified** (only `sharedDestinations` is removed).
- Nothing under `data/` is committed.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/theme.ts` | **new** — origin colour palette, `originColor(i)` |
| `src/state/url.ts` | **rewrite** — array state, legacy `?a=&b=` folding, cap |
| `src/map/map.ts` | **new** — Leaflet map, panes, basemap layer |
| `src/map/bounds.ts` | **new** — antimeridian-safe bounds |
| `src/map/tooltip.ts` | **new** — tooltip text composition (pure) |
| `src/map/layers.ts` | **new** — arc/dot/origin layer build + teardown |
| `src/render/labels.ts` | **modify** — decouple from d3, render Leaflet markers |
| `src/ui/selector.ts` | **new** — multi-airport field with chips |
| `src/ui/list.ts` | **rewrite** — one section per airport |
| `src/main.ts` | **rewrite** — wiring |
| `src/geo/projection.ts`, `src/render/basemap.ts`, `src/render/arcs.ts` | **delete** |
| `src/ui/picker.ts` | **delete** (replaced by `selector.ts`) |

---

### Task 1: Dependencies and origin colours

**Files:**
- Create: `src/theme.ts`, `src/theme.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `ORIGIN_COLORS: readonly string[]`, `MAX_AIRPORTS = 3`, `originColor(index: number): string`

- [ ] **Step 1: Install Leaflet, remove d3-geo**

```bash
npm i leaflet
npm i -D @types/leaflet
npm uninstall d3-geo @types/d3-geo
```

- [ ] **Step 2: Write the failing test**

```ts
// src/theme.test.ts
import { expect, test } from "vitest";
import { MAX_AIRPORTS, ORIGIN_COLORS, originColor } from "./theme.js";

test("three origin colours are defined, in order", () => {
  expect(ORIGIN_COLORS).toEqual(["#d94f45", "#2b6cb0", "#2e7d4f"]);
});

test("MAX_AIRPORTS matches the palette length", () => {
  expect(MAX_AIRPORTS).toBe(3);
  expect(ORIGIN_COLORS).toHaveLength(MAX_AIRPORTS);
});

test("originColor maps position to colour", () => {
  expect(originColor(0)).toBe("#d94f45");
  expect(originColor(1)).toBe("#2b6cb0");
  expect(originColor(2)).toBe("#2e7d4f");
});

test("originColor wraps rather than returning undefined", () => {
  expect(originColor(3)).toBe("#d94f45");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/theme.test.ts`
Expected: FAIL — cannot resolve `./theme.js`.

- [ ] **Step 4: Write the implementation**

```ts
// src/theme.ts

/** Origin colours, assigned by position in the selected-airports array. */
export const ORIGIN_COLORS = ["#d94f45", "#2b6cb0", "#2e7d4f"] as const;

export const MAX_AIRPORTS = ORIGIN_COLORS.length;

/** Colour for the airport at `index`. Wraps defensively; callers cap at MAX_AIRPORTS. */
export function originColor(index: number): string {
  return ORIGIN_COLORS[index % ORIGIN_COLORS.length]!;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/theme.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/theme.ts src/theme.test.ts package.json package-lock.json
git commit -m "feat: add origin colour palette, swap d3-geo for leaflet"
```

---

### Task 2: Array-based URL state

**Files:**
- Modify: `src/state/url.ts`, `src/state/url.test.ts`

**Interfaces:**
- Consumes: `MAX_AIRPORTS` from `src/theme.ts`
- Produces: `type AppState = { airports: string[]; minutes: number; yearRoundOnly: boolean }`, `DEFAULT_STATE`, `MIN_MINUTES`, `MAX_MINUTES`, `STEP_MINUTES`, `clampMinutes`, `parseState(search)`, `toSearch(state)`

Keep `MIN_MINUTES`/`MAX_MINUTES`/`STEP_MINUTES`/`clampMinutes` exactly as they are. Only the airport half changes.

- [ ] **Step 1: Replace the airport tests**

Delete the existing tests that reference `state.a` / `state.b` and add these. Keep every existing `minutes` test unchanged.

```ts
// src/state/url.test.ts — airport section
import { expect, test } from "vitest";
import { DEFAULT_STATE, parseState, toSearch } from "./url.js";

test("parses a comma-separated airport list", () => {
  expect(parseState("?a=BER,LIS,IST").airports).toEqual(["BER", "LIS", "IST"]);
});

test("parses a single airport", () => {
  expect(parseState("?a=BER").airports).toEqual(["BER"]);
});

test("an empty search yields no airports", () => {
  expect(parseState("").airports).toEqual([]);
});

test("upper-cases codes", () => {
  expect(parseState("?a=ber,lis").airports).toEqual(["BER", "LIS"]);
});

test("drops codes that are not three letters", () => {
  expect(parseState("?a=BER,BERLIN,LI,LIS").airports).toEqual(["BER", "LIS"]);
});

test("drops duplicates, keeping first occurrence", () => {
  expect(parseState("?a=BER,LIS,BER").airports).toEqual(["BER", "LIS"]);
});

test("caps at three airports", () => {
  expect(parseState("?a=BER,LIS,IST,BKK,LHR").airports).toEqual(["BER", "LIS", "IST"]);
});

test("folds the legacy two-parameter form", () => {
  expect(parseState("?a=BER&b=LIS&t=180").airports).toEqual(["BER", "LIS"]);
});

test("legacy b alone still yields an airport", () => {
  expect(parseState("?b=LIS").airports).toEqual(["LIS"]);
});

test("toSearch emits the canonical comma-separated form", () => {
  expect(toSearch({ airports: ["BER", "LIS"], minutes: 180, yearRoundOnly: false }))
    .toBe("?a=BER%2CLIS&t=180");
});

test("toSearch omits the airport parameter when none are selected", () => {
  expect(toSearch({ airports: [], minutes: 180, yearRoundOnly: false })).toBe("?t=180");
});

test("round-trips through toSearch", () => {
  const state = { airports: ["BER", "LIS", "IST"], minutes: 195, yearRoundOnly: true };
  expect(parseState(toSearch(state))).toEqual(state);
});

test("DEFAULT_STATE has no airports", () => {
  expect(DEFAULT_STATE.airports).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/url.test.ts`
Expected: FAIL — `airports` does not exist on `AppState`.

- [ ] **Step 3: Write the implementation**

```ts
// src/state/url.ts
import { MAX_AIRPORTS } from "../theme.js";

export const MIN_MINUTES = 30;
export const MAX_MINUTES = 480;
export const STEP_MINUTES = 15;

export type AppState = {
  airports: string[];
  minutes: number;
  yearRoundOnly: boolean;
};

export const DEFAULT_STATE: AppState = {
  airports: [],
  minutes: 180,
  yearRoundOnly: false,
};

function code(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : null;
}

export function clampMinutes(n: number): number {
  const snapped = Math.round(n / STEP_MINUTES) * STEP_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, snapped));
}

export function parseState(search: string): AppState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  // Canonical form is a comma-separated `a`. The legacy two-slot form
  // (?a=BER&b=LIS) is still accepted so previously shared links keep working.
  const raw = [...(p.get("a") ?? "").split(","), p.get("b") ?? ""];
  const airports: string[] = [];
  for (const entry of raw) {
    const c = code(entry);
    if (c && !airports.includes(c) && airports.length < MAX_AIRPORTS) airports.push(c);
  }

  const rawT = p.get("t");
  const n = Number(rawT);
  return {
    airports,
    minutes:
      rawT !== null && rawT !== "" && Number.isFinite(n)
        ? clampMinutes(n)
        : DEFAULT_STATE.minutes,
    yearRoundOnly: p.get("yr") === "1",
  };
}

export function toSearch(state: AppState): string {
  const p = new URLSearchParams();
  if (state.airports.length > 0) p.set("a", state.airports.join(","));
  p.set("t", String(state.minutes));
  if (state.yearRoundOnly) p.set("yr", "1");
  return `?${p}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/url.test.ts`
Expected: PASS — all airport tests plus the untouched minutes tests.

- [ ] **Step 5: Commit**

```bash
git add src/state/url.ts src/state/url.test.ts
git commit -m "feat: move URL state to an airport array with legacy fallback"
```

---

### Task 3: Remove sharedDestinations

**Files:**
- Modify: `src/reach/query.ts`, `src/reach/query.test.ts`

**Interfaces:**
- Produces: `src/reach/query.ts` exporting only `Reachable` and `reachable`

`reachable()` itself must NOT change — only the now-unused intersection helper is removed.

- [ ] **Step 1: Delete the two sharedDestinations tests**

Remove `"sharedDestinations intersects two reach sets"` and `"sharedDestinations is empty when nothing overlaps"` from `src/reach/query.test.ts`, and drop `sharedDestinations` from that file's import. Leave every `reachable` test untouched.

- [ ] **Step 2: Delete the function**

Remove the `sharedDestinations` export from `src/reach/query.ts`. Leave `reachable` and `Reachable` exactly as they are.

- [ ] **Step 3: Verify nothing else referenced it**

Run: `git grep -n "sharedDestinations" -- src`
Expected: no output.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run src/reach/query.test.ts`
Expected: PASS, 8 tests (was 10).

- [ ] **Step 5: Commit**

```bash
git add src/reach/query.ts src/reach/query.test.ts
git commit -m "refactor: drop sharedDestinations, superseded by per-origin overlay"
```

---

### Task 4: Decouple label placement from d3-geo

**Files:**
- Modify: `src/render/labels.ts`, `src/render/labels.test.ts`

**Interfaces:**
- Produces: `type ProjectPoint = (lon: number, lat: number) => [number, number] | null`; `placeLabels(labels: CountryLabel[], project: ProjectPoint): PlacedLabel[]`
- Unchanged: `CountryLabel`, `MIN_RANK`, `visibleLabels`, `displayName`, `PlacedLabel`

`placeLabels` currently takes a d3 `GeoProjection`. `src/geo/projection.ts` is being deleted, so it must take a plain function instead. Leaflet supplies one in Task 7. The collision-suppression logic itself does not change.

- [ ] **Step 1: Update the test to use a plain projection function**

Replace the `createProjection` import and its use:

```ts
// src/render/labels.test.ts — replace the d3 import
import { placeLabels, visibleLabels, type CountryLabel, type ProjectPoint } from "./labels.js";

/** Simple equirectangular projection, enough to exercise collision suppression. */
const project: ProjectPoint = (lon, lat) => [
  ((lon + 180) / 360) * 1000,
  ((90 - lat) / 180) * 600,
];
```

Then change the call site from `placeLabels(cluster, projection)` to `placeLabels(cluster, project)`. Leave every assertion, including the no-overlap invariant, unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/labels.test.ts`
Expected: FAIL — `ProjectPoint` is not exported.

- [ ] **Step 3: Change the signature**

In `src/render/labels.ts`, remove the `d3-geo` import, add the type, and change `placeLabels`' parameter. The body changes only where it calls the projection:

```ts
/** Projects lon/lat to container pixel coordinates, or null if off-map. */
export type ProjectPoint = (lon: number, lat: number) => [number, number] | null;
```

```ts
export function placeLabels(
  labels: CountryLabel[],
  project: ProjectPoint,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const boxes: Box[] = [];
  for (const l of labels) {
    const xy = project(l.lon, l.lat);
    if (!xy) continue;
    const text = displayName(l.name).toUpperCase();
    const box = estimateBox(xy[0], xy[1], text);
    if (boxes.some((b) => overlaps(b, box))) continue;
    boxes.push(box);
    placed.push({ label: l, x: xy[0], y: xy[1], text });
  }
  return placed;
}
```

Delete the old `renderLabels` (the SVG version) — Task 7 replaces it with a Leaflet layer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/render/labels.test.ts`
Expected: PASS, all existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/render/labels.ts src/render/labels.test.ts
git commit -m "refactor: decouple label placement from d3-geo"
```

---

### Task 5: Antimeridian-safe bounds

**Files:**
- Create: `src/map/bounds.ts`, `src/map/bounds.test.ts`

**Interfaces:**
- Produces: `type Point = { lat: number; lon: number }`; `unwrappedBounds(points: Point[]): [[number, number], [number, number]] | null`

Leaflet's `LatLngBounds` does not wrap. A reach set spanning ±180° (e.g. Tokyo to Los Angeles) would otherwise produce bounds covering the entire globe and zoom all the way out. This finds the largest empty longitude gap and unwraps the cluster around it.

- [ ] **Step 1: Write the failing test**

```ts
// src/map/bounds.test.ts
import { expect, test } from "vitest";
import { unwrappedBounds } from "./bounds.js";

test("returns null for no points", () => {
  expect(unwrappedBounds([])).toBeNull();
});

test("wraps a single point tightly", () => {
  expect(unwrappedBounds([{ lat: 10, lon: 20 }])).toEqual([[10, 20], [10, 20]]);
});

test("ordinary cluster keeps its natural extent", () => {
  const b = unwrappedBounds([
    { lat: 40, lon: -10 },
    { lat: 50, lon: 20 },
  ])!;
  expect(b[0][0]).toBe(40);
  expect(b[1][0]).toBe(50);
  expect(b[1][1] - b[0][1]).toBeCloseTo(30, 6);
});

test("a Pacific cluster spanning the antimeridian stays narrow", () => {
  // Tokyo (139) and Los Angeles (-118) are ~103 degrees apart across the
  // antimeridian, not 257 degrees the long way round.
  const b = unwrappedBounds([
    { lat: 35, lon: 139 },
    { lat: 34, lon: -118 },
  ])!;
  expect(b[1][1] - b[0][1]).toBeCloseTo(103, 0);
});

test("does not unwrap a genuinely global spread", () => {
  const b = unwrappedBounds([
    { lat: 0, lon: -170 },
    { lat: 0, lon: -60 },
    { lat: 0, lon: 60 },
    { lat: 0, lon: 170 },
  ])!;
  expect(b[1][1] - b[0][1]).toBeGreaterThan(200);
});

test("latitude bounds are independent of longitude unwrapping", () => {
  const b = unwrappedBounds([
    { lat: -20, lon: 179 },
    { lat: 60, lon: -179 },
  ])!;
  expect(b[0][0]).toBe(-20);
  expect(b[1][0]).toBe(60);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/map/bounds.test.ts`
Expected: FAIL — cannot resolve `./bounds.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/map/bounds.ts

export type Point = { lat: number; lon: number };

/**
 * Bounds that survive the antimeridian.
 *
 * Longitudes are circular, so a cluster straddling +/-180 looks like it spans
 * almost the whole globe. Find the largest empty gap between consecutive
 * longitudes and treat the point just after it as the cluster's start, then
 * unwrap every longitude forward from there. The result may exceed +180, which
 * Leaflet accepts and normalises.
 */
export function unwrappedBounds(
  points: Point[],
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;

  const lons = points.map((p) => p.lon).sort((a, b) => a - b);
  let bestGap = -1;
  let startIdx = 0;
  for (let i = 0; i < lons.length; i++) {
    const a = lons[i]!;
    const b = lons[(i + 1) % lons.length]!;
    const gap = (b - a + 360) % 360;
    if (gap > bestGap) {
      bestGap = gap;
      startIdx = (i + 1) % lons.length;
    }
  }
  const start = lons[startIdx]!;

  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    let lon = p.lon;
    while (lon < start) lon += 360;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lats), minLon],
    [Math.max(...lats), maxLon],
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/map/bounds.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/map/bounds.ts src/map/bounds.test.ts
git commit -m "feat: add antimeridian-safe bounds for auto-focus"
```

---

### Task 6: Tooltip text composition

**Files:**
- Create: `src/map/tooltip.ts`, `src/map/tooltip.test.ts`

**Interfaces:**
- Consumes: `Airport` from `src/data/bundle.js`, `formatDuration` from `src/ui/format.js`
- Produces: `type OriginLeg = { iata: string; minutes: number }`; `tooltipLines(dest: Airport, legs: OriginLeg[]): string[]`

Returns plain strings; the caller inserts them as text nodes. Never build HTML here.

- [ ] **Step 1: Write the failing test**

```ts
// src/map/tooltip.test.ts
import { expect, test } from "vitest";
import { tooltipLines } from "./tooltip.js";
import type { Airport } from "../data/bundle.js";

const BCN: Airport = {
  iata: "BCN", name: "Josep Tarradellas Barcelona-El Prat Airport",
  city: "Barcelona", country: "ES", lat: 41.3, lon: 2.08, size: "large",
};

test("first line names the city and code", () => {
  expect(tooltipLines(BCN, [{ iata: "BER", minutes: 125 }])[0]).toBe("Barcelona (BCN)");
});

test("one line per reaching origin, with the flight time", () => {
  expect(tooltipLines(BCN, [{ iata: "BER", minutes: 125 }])).toEqual([
    "Barcelona (BCN)",
    "BER · 2h 05m",
  ]);
});

test("lists every reaching origin", () => {
  expect(tooltipLines(BCN, [
    { iata: "BER", minutes: 125 },
    { iata: "LIS", minutes: 110 },
    { iata: "IST", minutes: 200 },
  ])).toEqual([
    "Barcelona (BCN)",
    "BER · 2h 05m",
    "LIS · 1h 50m",
    "IST · 3h 20m",
  ]);
});

test("falls back to the airport name when the city is blank", () => {
  const noCity = { ...BCN, city: "" };
  expect(tooltipLines(noCity, [])[0]).toBe(
    "Josep Tarradellas Barcelona-El Prat Airport (BCN)",
  );
});

test("with no reaching origins only the heading is returned", () => {
  expect(tooltipLines(BCN, [])).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/map/tooltip.test.ts`
Expected: FAIL — cannot resolve `./tooltip.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/map/tooltip.ts
import type { Airport } from "../data/bundle.js";
import { formatDuration } from "../ui/format.js";

export type OriginLeg = { iata: string; minutes: number };

/**
 * Plain-text tooltip lines: a heading, then one line per origin that reaches
 * this destination. Returned as strings so the caller can insert them as text
 * nodes — never as HTML.
 */
export function tooltipLines(dest: Airport, legs: OriginLeg[]): string[] {
  const label = dest.city || dest.name;
  return [
    `${label} (${dest.iata})`,
    ...legs.map((l) => `${l.iata} · ${formatDuration(l.minutes)}`),
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/map/tooltip.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/map/tooltip.ts src/map/tooltip.test.ts
git commit -m "feat: compose per-origin tooltip text"
```

---

### Task 7: Leaflet map and label layer

**Files:**
- Create: `src/map/map.ts`
- Modify: `src/render/labels.ts` (add the Leaflet label layer), `src/styles.css`

**Interfaces:**
- Consumes: `visibleLabels`, `placeLabels`, `ProjectPoint`, `CountryLabel` from `src/render/labels.js`
- Produces: `createMap(container: HTMLElement, world: GeoJSON.FeatureCollection): L.Map`; `LABEL_PANE = "labels"`; `createLabelLayer(map: L.Map, labels: CountryLabel[]): { refresh(): void; remove(): void }`

No unit tests — this is Leaflet wiring, verified in the browser in Task 10, the same rule the canvas renderer followed.

- [ ] **Step 1: Write `src/map/map.ts`**

```ts
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
```

- [ ] **Step 2: Add the Leaflet label layer to `src/render/labels.ts`**

Append to the file (the pure `visibleLabels` / `placeLabels` / `displayName` above are unchanged):

```ts
import L from "leaflet";
import { LABEL_PANE } from "../map/map.js";

/**
 * Country labels as non-interactive markers, re-placed on every zoom so
 * collision suppression reflects the actual pixel layout at that zoom level.
 */
export function createLabelLayer(map: L.Map, labels: CountryLabel[]) {
  const group = L.layerGroup([], { pane: LABEL_PANE }).addTo(map);

  const refresh = () => {
    group.clearLayers();
    const project: ProjectPoint = (lon, lat) => {
      const p = map.latLngToContainerPoint([lat, lon]);
      return [p.x, p.y];
    };
    for (const placed of placeLabels(visibleLabels(labels, map.getZoom()), project)) {
      L.marker([placed.label.lat, placed.label.lon], {
        pane: LABEL_PANE,
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "country-label",
          html: "",
          iconSize: [0, 0],
        }),
      })
        .addTo(group)
        .getElement()
        ?.appendChild(document.createTextNode(placed.text));
    }
  };

  map.on("zoomend moveend", refresh);
  refresh();

  return {
    refresh,
    remove() {
      map.off("zoomend moveend", refresh);
      group.remove();
    },
  };
}
```

- [ ] **Step 3: Add label and map styling to `src/styles.css`**

```css
/* Sea. Leaflet draws the land GeoJSON over this. */
.map .leaflet-container {
  background: var(--ocean);
  height: 100%;
  width: 100%;
  font: inherit;
}

.country-label {
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  text-shadow: 0 0 2px var(--ocean), 0 0 2px var(--ocean);
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `GeoJSON` types are unresolved, `@types/geojson` is already a devDependency.

- [ ] **Step 5: Commit**

```bash
git add src/map/map.ts src/render/labels.ts src/styles.css
git commit -m "feat: add leaflet map with vector basemap and zoom-aware labels"
```

---

### Task 8: Arc, dot and origin layers

**Files:**
- Create: `src/map/layers.ts`

**Interfaces:**
- Consumes: `arcSegments` from `src/geo/arc.js`, `Airport` from `src/data/bundle.js`, `Reachable` from `src/reach/query.js`, `tooltipLines`/`OriginLeg` from `./tooltip.js`, `originColor` from `src/theme.js`
- Produces: `type OriginLayer = { origin: Airport; destinations: Reachable[]; color: string }`; `createReachLayer(map: L.Map): { update(layers: OriginLayer[], airports: Airport[]): void; remove(): void }`

No unit tests — Leaflet wiring, browser-verified in Task 10.

- [ ] **Step 1: Write the implementation**

```ts
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
    const legsByAirport = new Map<number, OriginLeg[]>();
    for (const layer of layers) {
      for (const d of layer.destinations) {
        const legs = legsByAirport.get(d.airport) ?? [];
        legs.push({ iata: layer.origin.iata, minutes: d.minutes });
        legsByAirport.set(d.airport, legs);
      }
    }

    for (const [index, legs] of legsByAirport) {
      const dest = airports[index];
      if (!dest) continue;
      // Colour by the first origin that reaches it, matching its arcs.
      const first = layers.find((l) => l.destinations.some((d) => d.airport === index));
      const marker = L.circleMarker([dest.lat, dest.lon], {
        renderer,
        radius: 3,
        color: first?.color ?? "#111",
        fillColor: first?.color ?? "#111",
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/map/layers.ts
git commit -m "feat: render arcs, destination dots and origin markers on leaflet"
```

---

### Task 9: Multi-airport selector and per-airport list

**Files:**
- Create: `src/ui/selector.ts`
- Modify: `src/ui/list.ts`
- Delete: `src/ui/picker.ts`

**Interfaces:**
- Consumes: `searchAirports` from `src/ui/search.js`, `Airport` from `src/data/bundle.js`, `originColor`/`MAX_AIRPORTS` from `src/theme.js`, `Reachable` from `src/reach/query.js`, `formatDuration` from `src/ui/format.js`
- Produces: `createAirportSelector(opts: { airports: Airport[]; onChange: (codes: string[]) => void }): { el: HTMLElement; setValue(codes: string[]): void }`; `createList(opts: { onHover: (airport: number | null) => void }): { el: HTMLElement; update(args: { airports: Airport[]; groups: { origin: Airport; color: string; destinations: Reachable[] }[] }): void }`

`src/ui/search.ts` is unchanged and keeps its 8 tests.

- [ ] **Step 1: Write `src/ui/selector.ts`**

```ts
// src/ui/selector.ts
import type { Airport } from "../data/bundle.js";
import { searchAirports } from "./search.js";
import { MAX_AIRPORTS, originColor } from "../theme.js";

export function createAirportSelector(opts: {
  airports: Airport[];
  onChange: (codes: string[]) => void;
}) {
  let selected: string[] = [];

  const el = document.createElement("div");
  el.className = "selector";

  const chips = document.createElement("div");
  chips.className = "chips";

  const field = document.createElement("div");
  field.className = "picker";
  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = "Add an airport";
  input.setAttribute("aria-label", "Add an airport");
  const results = document.createElement("ul");
  results.className = "results";
  results.hidden = true;
  field.append(input, results);

  const note = document.createElement("p");
  note.className = "note";
  note.hidden = true;
  note.textContent = `Up to ${MAX_AIRPORTS} airports. Remove one to add another.`;

  let active = -1;
  let current: Airport[] = [];

  const close = () => { results.hidden = true; active = -1; };

  function renderChips() {
    chips.replaceChildren();
    selected.forEach((code, i) => {
      const ap = opts.airports.find((a) => a.iata === code);
      const chip = document.createElement("span");
      chip.className = "chip";

      const dot = document.createElement("i");
      dot.className = "dot";
      dot.style.background = originColor(i);

      const label = document.createElement("span");
      label.textContent = ap ? `${ap.iata} · ${ap.city || ap.name}` : code;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${ap?.city || code}`);
      remove.addEventListener("click", () => {
        selected = selected.filter((c) => c !== code);
        sync();
      });

      chip.append(dot, label, remove);
      chips.appendChild(chip);
    });

    const full = selected.length >= MAX_AIRPORTS;
    input.disabled = full;
    note.hidden = !full;
    if (full) close();
  }

  function sync() {
    renderChips();
    opts.onChange([...selected]);
  }

  const choose = (a: Airport) => {
    if (!selected.includes(a.iata) && selected.length < MAX_AIRPORTS) {
      selected.push(a.iata);
    }
    input.value = "";
    close();
    sync();
  };

  const render = () => {
    results.replaceChildren();
    current.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = i === active ? "active" : "";
      const code = document.createElement("b");
      code.textContent = a.iata;
      const city = document.createElement("span");
      city.textContent = a.city || a.name;
      const country = document.createElement("em");
      country.textContent = a.country;
      li.append(code, city, country);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(a); });
      results.appendChild(li);
    });
    results.hidden = current.length === 0;
  };

  input.addEventListener("input", () => {
    current = searchAirports(opts.airports, input.value).filter(
      (a) => !selected.includes(a.iata),
    );
    active = current.length ? 0 : -1;
    render();
  });

  input.addEventListener("keydown", (e) => {
    if (results.hidden) return;
    if (e.key === "ArrowDown") { active = Math.min(active + 1, current.length - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter") {
      const item = current[active];
      if (item) { choose(item); e.preventDefault(); }
    } else if (e.key === "Escape") close();
  });

  input.addEventListener("blur", () => setTimeout(close, 120));

  el.append(chips, field, note);
  renderChips();

  return {
    el,
    setValue(codes: string[]) {
      selected = codes.slice(0, MAX_AIRPORTS);
      renderChips();
    },
  };
}
```

- [ ] **Step 2: Rewrite `src/ui/list.ts`**

```ts
// src/ui/list.ts
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { formatDuration } from "./format.js";

export type ListGroup = {
  origin: Airport;
  color: string;
  destinations: Reachable[];
};

export function createList(opts: { onHover: (airport: number | null) => void }) {
  const el = document.createElement("div");
  el.className = "list";

  function section(group: ListGroup, airports: Airport[]) {
    const wrap = document.createElement("section");

    const head = document.createElement("div");
    head.className = "label";
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = group.color;
    const text = document.createElement("span");
    text.textContent = `${group.origin.city || group.origin.name} · ${group.destinations.length}`;
    head.append(dot, text);
    wrap.appendChild(head);

    if (group.destinations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No nonstop destinations within this flight time.";
      wrap.appendChild(empty);
      return wrap;
    }

    for (const r of group.destinations) {
      const ap = airports[r.airport];
      if (!ap) continue;
      const row = document.createElement("button");
      row.className = "row";
      row.type = "button";

      const left = document.createElement("span");
      left.append(document.createTextNode(`${ap.city || ap.name} `));
      const code = document.createElement("em");
      code.textContent = ap.iata;
      left.appendChild(code);
      if (r.seasonal) {
        const tag = document.createElement("i");
        tag.className = "tag";
        tag.textContent = "seasonal";
        left.append(" ", tag);
      }
      if (r.charter) {
        const tag = document.createElement("i");
        tag.className = "tag";
        tag.textContent = "charter";
        left.append(" ", tag);
      }

      const right = document.createElement("span");
      right.className = "mut";
      right.textContent = formatDuration(r.minutes);

      row.append(left, right);
      row.addEventListener("mouseenter", () => opts.onHover(r.airport));
      row.addEventListener("mouseleave", () => opts.onHover(null));
      wrap.appendChild(row);
    }
    return wrap;
  }

  return {
    el,
    update({ airports, groups }: { airports: Airport[]; groups: ListGroup[] }) {
      el.replaceChildren();
      if (groups.length === 0) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = "Add an airport to see where you can fly nonstop.";
        el.appendChild(p);
        return;
      }
      for (const g of groups) el.appendChild(section(g, airports));
    },
  };
}
```

- [ ] **Step 3: Delete the old picker**

```bash
git rm src/ui/picker.ts
```

- [ ] **Step 4: Add chip styling to `src/styles.css`**

```css
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #f4f3f0; border-radius: 20px; padding: 5px 6px 5px 10px; font-size: 12px;
}
.chip .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.chip-remove {
  border: 0; background: none; cursor: pointer; font-size: 15px; line-height: 1;
  color: var(--muted); padding: 0 2px;
}
.chip-remove:hover { color: var(--ink); }
.note { font-size: 11px; color: var(--muted); margin: 6px 0 0; }
.list .label { display: flex; align-items: center; gap: 7px; }
.list .label .dot { width: 8px; height: 8px; border-radius: 50%; }
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: errors only in `src/main.ts` (rewritten next). Everything else clean.

- [ ] **Step 6: Commit**

```bash
git add src/ui/selector.ts src/ui/list.ts src/styles.css
git rm --cached src/ui/picker.ts 2>/dev/null || true
git commit -m "feat: multi-airport selector with chips, per-airport list sections"
```

---

### Task 10: Wire it together, delete dead code, verify in a browser

**Files:**
- Modify: `src/main.ts`
- Delete: `src/geo/projection.ts`, `src/geo/projection.test.ts`, `src/render/basemap.ts`, `src/render/arcs.ts`, `src/render/arcs.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–9

- [ ] **Step 1: Rewrite `src/main.ts`**

```ts
// src/main.ts
import "./styles.css";
import { loadDataset } from "./data/bundle.js";
import { reachable, type Reachable } from "./reach/query.js";
import { createMap } from "./map/map.js";
import { createReachLayer, type OriginLayer } from "./map/layers.js";
import { unwrappedBounds } from "./map/bounds.js";
import { createLabelLayer, type CountryLabel } from "./render/labels.js";
import { createAirportSelector } from "./ui/selector.js";
import { createSlider } from "./ui/slider.js";
import { createToggle } from "./ui/toggle.js";
import { createList, type ListGroup } from "./ui/list.js";
import { createPanel } from "./ui/panel.js";
import { originColor, MAX_AIRPORTS } from "./theme.js";
import { parseState, toSearch, type AppState } from "./state/url.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

function renderLoadError() {
  app.replaceChildren();
  const p = document.createElement("p");
  p.className = "load-error";
  p.textContent = "Couldn't load map data. Try reloading.";
  app.appendChild(p);
}

let dataset: Awaited<ReturnType<typeof loadDataset>>;
let world: GeoJSON.FeatureCollection;
let labels: CountryLabel[];
try {
  [dataset, world, labels] = await Promise.all([
    loadDataset(),
    fetch("/world.json").then((r) => r.json()) as Promise<GeoJSON.FeatureCollection>,
    fetch("/labels.json").then((r) => r.json()) as Promise<CountryLabel[]>,
  ]);
} catch (err) {
  renderLoadError();
  throw err;
}

let state: AppState = normalise(parseState(location.search));

/** Drop codes the dataset doesn't know, then cap. */
function normalise(s: AppState): AppState {
  const airports = s.airports
    .filter((c) => dataset.index.has(c))
    .slice(0, MAX_AIRPORTS);
  return { ...s, airports };
}

const mapEl = document.createElement("div");
mapEl.className = "map";

const brand = document.createElement("div");
brand.className = "brand";
brand.textContent = "fly.eric.fun";

const selector = createAirportSelector({
  airports: dataset.airports,
  onChange: (codes) => {
    state = { ...state, airports: codes };
    commit({ refocus: true });
  },
});

const slider = createSlider({
  value: state.minutes,
  onInput: (minutes) => { state = { ...state, minutes }; draw(); },
  onChange: (minutes) => { state = { ...state, minutes }; pushUrl(); },
});

const toggle = createToggle({
  label: "Year-round routes only",
  value: state.yearRoundOnly,
  onChange: (yearRoundOnly) => { state = { ...state, yearRoundOnly }; commit({ refocus: false }); },
});

const list = createList({
  onHover: () => {},
});

const footer = document.createElement("div");
footer.className = "footer";
footer.textContent = "Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports";

const panel = createPanel([brand, selector.el, slider.el, toggle.el, list.el, footer]);
app.replaceChildren(panel, mapEl);

const map = createMap(mapEl, world);
const reachLayer = createReachLayer(map);
createLabelLayer(map, labels);

function groups(): { layers: OriginLayer[]; listGroups: ListGroup[] } {
  const opts = { yearRoundOnly: state.yearRoundOnly };
  const layers: OriginLayer[] = [];
  const listGroups: ListGroup[] = [];
  state.airports.forEach((code, i) => {
    const idx = dataset.index.get(code);
    if (idx === undefined) return;
    const origin = dataset.airports[idx]!;
    const destinations: Reachable[] = reachable(dataset, idx, state.minutes, opts);
    const color = originColor(i);
    layers.push({ origin, destinations, color });
    listGroups.push({ origin, color, destinations });
  });
  return { layers, listGroups };
}

function draw(): void {
  const { layers, listGroups } = groups();
  reachLayer.update(layers, dataset.airports);
  list.update({ airports: dataset.airports, groups: listGroups });
}

/** Fit the view to the current selection. Only ever called on selection change. */
function refocus(): void {
  const { layers } = groups();
  const pts = layers.flatMap((l) => [
    { lat: l.origin.lat, lon: l.origin.lon },
    ...l.destinations.flatMap((d) => {
      const a = dataset.airports[d.airport];
      return a ? [{ lat: a.lat, lon: a.lon }] : [];
    }),
  ]);
  const b = unwrappedBounds(pts);
  if (b) map.fitBounds(b, { padding: [40, 40], maxZoom: 6 });
}

function pushUrl(): void {
  history.replaceState(null, "", toSearch(state));
}

function commit({ refocus: shouldRefocus }: { refocus: boolean }): void {
  pushUrl();
  draw();
  if (shouldRefocus) refocus();
}

window.addEventListener("popstate", () => {
  state = normalise(parseState(location.search));
  selector.setValue(state.airports);
  slider.setValue(state.minutes);
  toggle.setValue(state.yearRoundOnly);
  draw();
  refocus();
});

selector.setValue(state.airports);
pushUrl();
draw();
if (state.airports.length > 0) refocus();
```

- [ ] **Step 2: Delete the canvas renderer and d3 projection**

```bash
git rm src/geo/projection.ts src/geo/projection.test.ts src/render/basemap.ts src/render/arcs.ts src/render/arcs.test.ts
```

- [ ] **Step 3: Confirm nothing still imports them**

Run: `git grep -nE "geo/projection|render/basemap|render/arcs|d3-geo|COLORS" -- src`
Expected: no output. If `COLORS` is still referenced, replace those uses with the CSS variables or `originColor`.

- [ ] **Step 4: Run the full suite and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all clean.

- [ ] **Step 5: Verify in a browser**

Run: `npm run dev`, then confirm each of these and record the result:
1. Map loads: blue sea, warm land, country borders, country labels, no console errors.
2. Adding `BER` draws red arcs and dots; the view auto-fits to Europe.
3. Adding `LIS` draws blue; adding `IST` draws green. The field disables at three with the note shown.
4. Removing the first chip re-colours the remaining two (second becomes red).
5. Hovering a destination dot shows a tooltip with the city, IATA and one line per reaching origin.
6. Zooming in reveals more country labels; zooming out thins them. No labels overlap.
7. Dragging the slider updates arcs live and does **not** move the map.
8. `?a=NRT` produces arcs that cross the Pacific without a stripe across the map, and auto-focus frames the Pacific rather than zooming out to the whole world.
9. The legacy URL `?a=BER&b=LIS&t=180` still loads both airports.
10. Below 760px the panel is a bottom sheet sitting above the map, and its grab handle still toggles.

- [ ] **Step 6: Update the README**

Replace the "no pan or zoom" known-limitation bullet with a note that the map is interactive (pan, zoom, tooltips, auto-focus), and state that up to three airports can be compared. Leave the licensing and data sections unchanged.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: interactive leaflet map with up to three airports"
```

---

## Self-Review Notes

Spec coverage:

| Spec section | Task |
|---|---|
| §3.1 arc.ts survives | 8 (used, unmodified) |
| §3.2 layers, canvas renderer, label pane | 7, 8 |
| §3.3 Web Mercator | 7 (Leaflet default) |
| §3.4 bundle impact | 1 |
| §4 state model, MAX_AIRPORTS | 1, 2 |
| §4.1 URL incl. legacy form | 2 |
| §4.2 colours by position | 1, 9 |
| §5.1 selector with chips | 9 |
| §5.2 per-airport list, empty states | 9 |
| §5.3 tooltips | 6, 8 |
| §5.3 zoom-aware labels | 4, 7 |
| §5.3 auto-focus, selection-change only, antimeridian-safe | 5, 10 |
| §5.4 slider/toggle/panel/footer unchanged | 10 |
| §6 file moves and deletions | 9, 10 |
| §7 testing | 1, 2, 4, 5, 6, 10 |

**Note for the executor:** Task 10 Step 1 assumes `createSlider` takes `onInput`/`onChange` and that `createToggle` takes `{ label, value, onChange }` and exposes `setValue`. Both were built that way in v1. Verify the actual signatures before writing `main.ts` and adapt the call sites if they differ — do not change `slider.ts` or `toggle.ts` themselves.
