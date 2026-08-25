# Flight Radius Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static single-page world map where the user selects one or two airports and a maximum nonstop flight time, and sees every reachable destination drawn as great-circle arcs.

**Architecture:** A build-time pipeline crawls Wikipedia airport destination tables (resolving airports via Wikidata) and compiles them, joined with OurAirports coordinates, into two static assets (`airports.json`, `routes.bin`). The runtime is a framework-free TypeScript app that loads those assets once and answers reachability queries client-side, rendering arcs to `<canvas>` with a thin SVG overlay for labels. Deployed as static assets on Cloudflare.

**Tech Stack:** TypeScript, Vite, Vitest, d3-geo, tsx (for build scripts), Wrangler (Cloudflare Workers Static Assets), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-25-flight-radius-map-design.md`

## Global Constraints

- **Node 22+** (dev machine is on v25.8.1, npm 11.11.0).
- **No UI framework.** No React, Vue, Svelte, Preact. Vanilla TypeScript + DOM.
- **Runtime is 100% static.** No Worker logic, no server, no API keys, no runtime network calls beyond fetching the app's own assets.
- **Duration model is exactly** `duration_hours = 0.66 + great_circle_km / 790`. Constants `OVERHEAD_HOURS = 0.66`, `CRUISE_KMH = 790`. Never change these without re-running the §5 regression table.
- **Slider range is 30–480 minutes, 15-minute steps.**
- **Wikipedia API calls MUST set** `redirects=1` and a descriptive `User-Agent` of the form `fly.eric.fun/1.0 (https://fly.eric.fun; https://github.com/erinc/fly)`.
- **Airport titles MUST be resolved via Wikidata `P238`**, never by matching OurAirports names.
- **Wikipedia batch size is 50 titles per request.**
- **Colours are exact:** ocean `#dceaf2`, land `#f2f0eb`, borders `#b3ada2`, country labels `#9a948a`, origin A `#d94f45`, origin B `#2b6cb0`, shared destination `#111`.
- **Required footer copy, verbatim:** `Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports`
- **Projection is `d3.geoEqualEarth`.**
- **`data/raw/` is gitignored. `public/airports.json` and `public/routes.bin` are committed.**

---

## File Structure

| File | Responsibility |
|---|---|
| `src/geo/types.ts` | Shared `LatLon` type |
| `src/geo/distance.ts` | Great-circle distance |
| `src/geo/duration.ts` | Distance → flight duration model |
| `src/geo/arc.ts` | Great-circle interpolation, antimeridian splitting |
| `src/geo/projection.ts` | Equal Earth projection setup |
| `src/data/bundle.ts` | Decode `routes.bin` / `airports.json` |
| `src/reach/query.ts` | Reachability queries |
| `src/state/url.ts` | URL ⇄ app state |
| `src/render/basemap.ts` | Canvas basemap (ocean, land, borders) |
| `src/render/arcs.ts` | Canvas arcs + destination dots |
| `src/render/labels.ts` | SVG country labels + origin markers |
| `src/ui/picker.ts` | Airport search/select control |
| `src/ui/slider.ts` | Flight-time slider |
| `src/ui/list.ts` | Destination list (Both / A only / B only) |
| `src/ui/panel.ts` | Sidebar ⇄ bottom-sheet container |
| `src/main.ts` | Wiring |
| `scripts/sources/ourairports.ts` | Parse OurAirports CSV |
| `scripts/sources/wikidata.ts` | IATA → article title map |
| `scripts/parse/destinations.ts` | Wikitext destination-table parser |
| `scripts/crawl.ts` | Batched crawl CLI → `data/raw/<IATA>.json` |
| `scripts/bundle.ts` | Compile `data/raw/` → `public/` + threshold gates |
| `scripts/basemap.ts` | Natural Earth → `public/world.json`, `public/labels.json` |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `wrangler.jsonc`, `index.html`, `src/main.ts`, `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: working `npm test`, `npm run dev`, `npm run build`

- [ ] **Step 1: Initialise the project and install dependencies**

```bash
npm init -y
npm pkg set name="fly-eric-fun" type="module" private=true
npm i d3-geo d3-geo-projection
npm i -D typescript vite vitest tsx @types/d3-geo wrangler
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src", "scripts", "*.config.ts"]
}
```

- [ ] **Step 3: Write `vitest.config.ts` and `vite.config.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
export default defineConfig({ build: { target: "es2022" } });
```

- [ ] **Step 4: Write `index.html` and a stub `src/main.ts`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>fly.eric.fun</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

```ts
// src/main.ts
export {};
```

- [ ] **Step 5: Add npm scripts**

```bash
npm pkg set scripts.dev="vite" scripts.build="vite build" scripts.test="vitest run" \
  scripts.crawl="tsx scripts/crawl.ts" scripts.bundle="tsx scripts/bundle.ts" \
  scripts.basemap="tsx scripts/basemap.ts" scripts.deploy="wrangler deploy"
```

- [ ] **Step 6: Write the smoke test**

```ts
// src/smoke.test.ts
import { expect, test } from "vitest";
test("test runner works", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 8: Write `wrangler.jsonc`**

```jsonc
{
  "name": "fly-eric-fun",
  "compatibility_date": "2026-08-25",
  "assets": { "directory": "./dist" }
}
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + typescript + vitest project"
```

---

### Task 2: Great-circle distance

**Files:**
- Create: `src/geo/types.ts`, `src/geo/distance.ts`
- Test: `src/geo/distance.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type LatLon = { lat: number; lon: number }`; `greatCircleKm(a: LatLon, b: LatLon): number`

- [ ] **Step 1: Write the failing test**

```ts
// src/geo/distance.test.ts
import { expect, test } from "vitest";
import { greatCircleKm } from "./distance.js";

const LHR = { lat: 51.4706, lon: -0.461941 };
const JFK = { lat: 40.6398, lon: -73.7789 };
const CDG = { lat: 49.0128, lon: 2.55 };

test("LHR to JFK is about 5555 km", () => {
  expect(greatCircleKm(LHR, JFK)).toBeCloseTo(5555, -2);
});

test("LHR to CDG is about 348 km", () => {
  expect(greatCircleKm(LHR, CDG)).toBeCloseTo(348, -1);
});

test("distance to self is zero", () => {
  expect(greatCircleKm(LHR, LHR)).toBe(0);
});

test("distance is symmetric", () => {
  expect(greatCircleKm(LHR, JFK)).toBeCloseTo(greatCircleKm(JFK, LHR), 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/geo/distance.test.ts`
Expected: FAIL — cannot resolve `./distance.js`.

- [ ] **Step 3: Write the implementation**

Haversine is used rather than the spherical law of cosines because the latter loses precision for short distances such as LHR–CDG.

```ts
// src/geo/types.ts
export type LatLon = { lat: number; lon: number };
```

```ts
// src/geo/distance.ts
import type { LatLon } from "./types.js";

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function greatCircleKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/geo/distance.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/geo
git commit -m "feat: add great-circle distance"
```

---

### Task 3: Flight duration model

**Files:**
- Create: `src/geo/duration.ts`
- Test: `src/geo/duration.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `OVERHEAD_HOURS: 0.66`, `CRUISE_KMH: 790`, `durationHours(km: number): number`, `durationMinutes(km: number): number` (rounded to nearest integer minute)

This is the spec's §5 regression table. It is the guard on the whole model — do not weaken the 15-minute tolerance.

- [ ] **Step 1: Write the failing test**

```ts
// src/geo/duration.test.ts
import { expect, test } from "vitest";
import { durationHours, durationMinutes } from "./duration.js";

// [route, great-circle km, actual published block time in hours]
const REAL_BLOCK_TIMES: [string, number, number][] = [
  ["FRA-MUC", 299, 1.08],
  ["LHR-CDG", 348, 1.33],
  ["MAD-BCN", 483, 1.33],
  ["SYD-MEL", 705, 1.5],
  ["BER-LHR", 932, 1.83],
  ["ORD-DEN", 1476, 2.75],
  ["LAX-SEA", 1544, 2.83],
  ["HKG-NRT", 2890, 4.08],
  ["JFK-LAX", 3974, 5.92],
  ["DXB-LHR", 5500, 7.5],
  ["LHR-JFK", 5555, 7.54],
];

test.each(REAL_BLOCK_TIMES)(
  "%s prediction is within 15 minutes of the real block time",
  (_route, km, actualHours) => {
    const errorMinutes = Math.abs(durationHours(km) - actualHours) * 60;
    expect(errorMinutes).toBeLessThanOrEqual(15);
  },
);

test("a zero-distance flight still carries the fixed overhead", () => {
  expect(durationMinutes(0)).toBe(40);
});

test("duration increases monotonically with distance", () => {
  expect(durationHours(1000)).toBeGreaterThan(durationHours(500));
});

test("durationMinutes returns whole minutes", () => {
  expect(Number.isInteger(durationMinutes(1234))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/geo/duration.test.ts`
Expected: FAIL — cannot resolve `./duration.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/geo/duration.ts

/** Fixed overhead: taxi out, climb, descent, taxi in. */
export const OVERHEAD_HOURS = 0.66;

/** Effective cruise speed, inclusive of climb and descent phases. */
export const CRUISE_KMH = 790;

/**
 * Estimated nonstop block time.
 *
 * Calibrated against 11 real published block times for the 0.5-8h range;
 * maximum error 14 minutes. The model is symmetric and cannot represent
 * jet-stream asymmetry, and it degrades beyond ~8h. See spec section 5.
 */
export function durationHours(km: number): number {
  return OVERHEAD_HOURS + km / CRUISE_KMH;
}

export function durationMinutes(km: number): number {
  return Math.round(durationHours(km) * 60);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/geo/duration.test.ts`
Expected: PASS, 14 tests (11 parameterised + 3).

- [ ] **Step 5: Commit**

```bash
git add src/geo
git commit -m "feat: add calibrated flight duration model with regression table"
```

---

### Task 4: OurAirports CSV parsing

**Files:**
- Create: `scripts/sources/ourairports.ts`
- Test: `scripts/sources/ourairports.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type AirportRow = { iata: string; name: string; city: string; country: string; lat: number; lon: number; size: "large" | "medium" | "small" }`; `parseAirportsCsv(csv: string): AirportRow[]`; `AIRPORTS_CSV_URL`

Filter rule from spec §3.1: `scheduled_service === "yes"`, non-empty `iata_code`, type in `{large_airport, medium_airport, small_airport}`. Expect ~4,009 rows from the real file.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/sources/ourairports.test.ts
import { expect, test } from "vitest";
import { parseAirportsCsv } from "./ourairports.js";

const HEADER =
  '"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft",' +
  '"continent","iso_country","iso_region","municipality","scheduled_service",' +
  '"icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"';

const row = (
  type: string,
  name: string,
  lat: string,
  lon: string,
  country: string,
  city: string,
  sched: string,
  iata: string,
) =>
  `1,"X","${type}","${name}",${lat},${lon},100,"EU","${country}","XX","${city}",` +
  `"${sched}","XXXX","${iata}","XXXX","","","",""`;

test("keeps scheduled-service airports that have an IATA code", () => {
  const csv = [
    HEADER,
    row("large_airport", "Heathrow Airport", "51.4706", "-0.4619", "GB", "London", "yes", "LHR"),
  ].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([
    { iata: "LHR", name: "Heathrow Airport", city: "London", country: "GB", lat: 51.4706, lon: -0.4619, size: "large" },
  ]);
});

test("drops airports without scheduled service", () => {
  const csv = [HEADER, row("large_airport", "Quiet", "1", "1", "GB", "Nowhere", "no", "QQQ")].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([]);
});

test("drops airports with no IATA code", () => {
  const csv = [HEADER, row("large_airport", "Nameless", "1", "1", "GB", "Nowhere", "yes", "")].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([]);
});

test("drops heliports, seaplane bases and closed airports", () => {
  const csv = [
    HEADER,
    row("heliport", "Helipad", "1", "1", "GB", "A", "yes", "AAA"),
    row("seaplane_base", "Lake", "1", "1", "GB", "B", "yes", "BBB"),
    row("closed", "Tegel", "1", "1", "DE", "Berlin", "yes", "TXL"),
  ].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([]);
});

test("handles commas inside quoted fields", () => {
  const csv = [
    HEADER,
    row("medium_airport", "Molde Airport, Aro", "62.7", "7.26", "NO", "Molde", "yes", "MOL"),
  ].join("\n");
  const rows = parseAirportsCsv(csv);
  expect(rows[0]?.name).toBe("Molde Airport, Aro");
  expect(rows[0]?.iata).toBe("MOL");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/sources/ourairports.test.ts`
Expected: FAIL — cannot resolve `./ourairports.js`.

- [ ] **Step 3: Write the implementation**

The CSV contains quoted fields with embedded commas, so a naive `split(",")` is wrong. This is a small purpose-built reader rather than a dependency.

```ts
// scripts/sources/ourairports.ts

export const AIRPORTS_CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

export type AirportSize = "large" | "medium" | "small";

export type AirportRow = {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  size: AirportSize;
};

const SIZES: Record<string, AirportSize> = {
  large_airport: "large",
  medium_airport: "medium",
  small_airport: "small",
};

/** Split one CSV line, honouring double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

export function parseAirportsCsv(csv: string): AirportRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0] ?? "");
  const col = (name: string) => header.indexOf(name);
  const iType = col("type");
  const iName = col("name");
  const iLat = col("latitude_deg");
  const iLon = col("longitude_deg");
  const iCountry = col("iso_country");
  const iCity = col("municipality");
  const iSched = col("scheduled_service");
  const iIata = col("iata_code");

  const rows: AirportRow[] = [];
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    const size = SIZES[f[iType] ?? ""];
    const iata = (f[iIata] ?? "").trim();
    if (!size || !iata || f[iSched] !== "yes") continue;
    const lat = Number(f[iLat]);
    const lon = Number(f[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push({
      iata,
      name: (f[iName] ?? "").trim(),
      city: (f[iCity] ?? "").trim(),
      country: (f[iCountry] ?? "").trim(),
      lat,
      lon,
      size,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/sources/ourairports.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/sources
git commit -m "feat: parse OurAirports CSV into filtered airport rows"
```

---

### Task 5: Wikidata IATA → article title map

**Files:**
- Create: `scripts/sources/wikidata.ts`
- Test: `scripts/sources/wikidata.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `USER_AGENT: string`; `parseSparqlBindings(json: unknown): Record<string, string>`; `fetchIataTitleMap(): Promise<Record<string, string>>`

One query returns ~8,350 rows in ~22s (spec §3.2). The parse step is unit-tested; the network fetch is not.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/sources/wikidata.test.ts
import { expect, test } from "vitest";
import { parseSparqlBindings, USER_AGENT } from "./wikidata.js";

const binding = (iata: string, article: string) => ({
  iata: { value: iata },
  art: { value: `https://en.wikipedia.org/wiki/${article}` },
});

test("maps IATA codes to decoded article titles", () => {
  const json = {
    results: {
      bindings: [
        binding("LHR", "Heathrow_Airport"),
        binding("BER", "Berlin_Brandenburg_Airport"),
      ],
    },
  };
  expect(parseSparqlBindings(json)).toEqual({
    LHR: "Heathrow Airport",
    BER: "Berlin Brandenburg Airport",
  });
});

test("percent-decodes titles containing non-ASCII characters", () => {
  const json = {
    results: { bindings: [binding("ZRH", "Z%C3%BCrich_Airport")] },
  };
  expect(parseSparqlBindings(json)).toEqual({ ZRH: "Zürich Airport" });
});

test("ignores malformed bindings rather than throwing", () => {
  const json = { results: { bindings: [{ iata: { value: "AAA" } }] } };
  expect(parseSparqlBindings(json)).toEqual({});
});

test("user agent identifies the project and a contact", () => {
  expect(USER_AGENT).toMatch(/fly\.eric\.fun/);
  expect(USER_AGENT).toMatch(/@/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/sources/wikidata.test.ts`
Expected: FAIL — cannot resolve `./wikidata.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/sources/wikidata.ts

export const USER_AGENT =
  "fly.eric.fun/1.0 (https://fly.eric.fun; https://github.com/erinc/fly)";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/** Every airport carrying an IATA code (P238) that has an English article. */
export const IATA_TITLE_QUERY = `
SELECT ?iata ?art WHERE {
  ?a   wdt:P238 ?iata .
  ?art schema:about ?a ;
       schema:isPartOf <https://en.wikipedia.org/> .
}`;

export function parseSparqlBindings(json: unknown): Record<string, string> {
  const bindings =
    (json as { results?: { bindings?: unknown[] } })?.results?.bindings ?? [];
  const map: Record<string, string> = {};
  for (const raw of bindings) {
    const b = raw as { iata?: { value?: string }; art?: { value?: string } };
    const iata = b.iata?.value;
    const url = b.art?.value;
    if (!iata || !url) continue;
    const slug = url.slice(url.lastIndexOf("/") + 1);
    map[iata] = decodeURIComponent(slug).replace(/_/g, " ");
  }
  return map;
}

export async function fetchIataTitleMap(): Promise<Record<string, string>> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(IATA_TITLE_QUERY)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`);
  return parseSparqlBindings(await res.json());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/sources/wikidata.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/sources
git commit -m "feat: resolve airport article titles via Wikidata P238"
```

---

### Task 6: Wikitext destination-table parser

**Files:**
- Create: `scripts/parse/destinations.ts`
- Test: `scripts/parse/destinations.test.ts`

**Interfaces:**
- Consumes: `Record<string, string>` title→IATA (the inverse of Task 5's map)
- Produces: `type Destination = { iata: string; seasonal: boolean; charter: boolean }`; `findDestinationSection(wikitext: string): string | null`; `parseDestinations(wikitext: string, titleToIata: Record<string, string>, now?: Date): Destination[]`

Rules from spec §4.3:
- Heading matches `/airlines? and destinations/i` — **both** the plural and singular forms; the singular variant accounted for 3 of 4 misses in the coverage sample.
- Wikilinks that resolve to no IATA code (airlines) drop out.
- `seasonal` and `charter` are flagged, not discarded.
- `begins <date>` excludes the route until that date; `ends <date>` excludes it after.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/parse/destinations.test.ts
import { expect, test } from "vitest";
import { findDestinationSection, parseDestinations } from "./destinations.js";

const TITLES: Record<string, string> = {
  "Heathrow Airport": "LHR",
  "Barcelona–El Prat Airport": "BCN",
  "Faro Airport": "FAO",
  "Palma de Mallorca Airport": "PMI",
  // Airlines deliberately absent — they must drop out.
};

const NOW = new Date("2026-08-25T00:00:00Z");

test("finds the plural 'Airlines and destinations' section", () => {
  const wt = "== History ==\nfoo\n\n== Airlines and destinations ==\nbar\n\n== See also ==\nbaz";
  expect(findDestinationSection(wt)?.trim()).toBe("bar");
});

test("finds the singular 'Airline and destinations' section", () => {
  const wt = "== Facilities ==\nfoo\n\n== Airline and destinations ==\nbar\n\n== References ==\nbaz";
  expect(findDestinationSection(wt)?.trim()).toBe("bar");
});

test("returns null when there is no destinations section", () => {
  expect(findDestinationSection("== History ==\nnothing here")).toBeNull();
});

test("resolves destination wikilinks to IATA codes and drops airlines", () => {
  const wt = `== Airlines and destinations ==
{| class="wikitable"
| [[British Airways]] | [[Heathrow Airport]], [[Faro Airport]]
|}`;
  expect(parseDestinations(wt, TITLES, NOW).map((d) => d.iata).sort()).toEqual(["FAO", "LHR"]);
});

test("honours piped wikilinks", () => {
  const wt = `== Airlines and destinations ==
| [[Barcelona–El Prat Airport|Barcelona]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.iata).toBe("BCN");
});

test("flags seasonal routes rather than dropping them", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] <ref>x</ref> ''seasonal''`;
  const dests = parseDestinations(wt, TITLES, NOW);
  expect(dests).toEqual([{ iata: "FAO", seasonal: true, charter: false }]);
});

test("flags charter routes", () => {
  const wt = `== Airlines and destinations ==
'''Charter:''' [[Palma de Mallorca Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.charter).toBe(true);
});

test("excludes routes that have not begun yet", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] (begins 1 December 2026)`;
  expect(parseDestinations(wt, TITLES, NOW)).toEqual([]);
});

test("excludes routes that have already ended", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] (ends 1 January 2026)`;
  expect(parseDestinations(wt, TITLES, NOW)).toEqual([]);
});

test("deduplicates a destination served by several airlines", () => {
  const wt = `== Airlines and destinations ==
| [[British Airways]] | [[Faro Airport]]
| [[Ryanair]] | [[Faro Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)).toHaveLength(1);
});

test("a seasonal listing plus a year-round listing is not seasonal", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] ''seasonal''
| [[Faro Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.seasonal).toBe(false);
});

test("returns an empty array when the section is missing", () => {
  expect(parseDestinations("== History ==\nnope", TITLES, NOW)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/parse/destinations.test.ts`
Expected: FAIL — cannot resolve `./destinations.js`.

- [ ] **Step 3: Write the implementation**

```ts
// scripts/parse/destinations.ts

export type Destination = { iata: string; seasonal: boolean; charter: boolean };

const HEADING = /^==+\s*(.+?)\s*==+\s*$/;
const DEST_HEADING = /airlines?\s+and\s+destinations/i;
const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Returns the wikitext of the destinations section, or null if absent. */
export function findDestinationSection(wikitext: string): string | null {
  const lines = wikitext.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i] ?? "");
    if (!m) continue;
    const eq = (lines[i] ?? "").match(/^=+/)?.[0].length ?? 2;
    if (start === -1) {
      if (DEST_HEADING.test(m[1] ?? "")) { start = i + 1; level = eq; }
    } else if (eq <= level) {
      return lines.slice(start, i).join("\n");
    }
  }
  return start === -1 ? null : lines.slice(start).join("\n");
}

function parseDate(text: string): Date | null {
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDestinations(
  wikitext: string,
  titleToIata: Record<string, string>,
  now: Date = new Date(),
): Destination[] {
  const section = findDestinationSection(wikitext);
  if (section === null) return [];

  const found = new Map<string, Destination>();
  const charterFromHere = new Set<string>();

  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine;
    const lineIsCharter = /charter/i.test(line);

    // A "Charter:" subheading applies to following lines until the next heading.
    if (/^[';*\s]*charter\s*:?/i.test(line.replace(/'''/g, ""))) {
      charterFromHere.add("on");
    } else if (HEADING.test(line)) {
      charterFromHere.clear();
    }

    for (const m of line.matchAll(WIKILINK)) {
      const title = (m[1] ?? "").trim();
      const iata = titleToIata[title];
      if (!iata) continue;

      const begins = /begins\s+([0-9]{1,2}\s+\w+\s+[0-9]{4})/i.exec(line);
      if (begins) {
        const d = parseDate(begins[1] ?? "");
        if (d && d > now) continue;
      }
      const ends = /ends\s+([0-9]{1,2}\s+\w+\s+[0-9]{4})/i.exec(line);
      if (ends) {
        const d = parseDate(ends[1] ?? "");
        if (d && d < now) continue;
      }

      const seasonal = /seasonal/i.test(line);
      const charter = lineIsCharter || charterFromHere.has("on");

      const prev = found.get(iata);
      if (!prev) {
        found.set(iata, { iata, seasonal, charter });
      } else {
        // Any year-round or scheduled listing wins over seasonal/charter.
        prev.seasonal &&= seasonal;
        prev.charter &&= charter;
      }
    }
  }
  return [...found.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/parse/destinations.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse
git commit -m "feat: parse Wikipedia destination tables with seasonal and charter flags"
```

---

### Task 7: Real-article fixture tests

**Files:**
- Create: `scripts/parse/fixtures/download.ts`, `scripts/parse/fixtures/BER.wikitext`, `scripts/parse/fixtures/LHR.wikitext`, `scripts/parse/fixtures/EEK.wikitext`
- Test: `scripts/parse/destinations.fixtures.test.ts`

**Interfaces:**
- Consumes: `parseDestinations`, `findDestinationSection` from Task 6
- Produces: committed fixtures; no new exports

Fixtures are committed so tests never touch the network. The three articles are the spec's §8 set: BER (dense, ~25 seasonal markers), Heathrow (the redirect case), and a sparse regional airport.

- [ ] **Step 1: Write the fixture downloader**

```ts
// scripts/parse/fixtures/download.ts
import { writeFileSync } from "node:fs";
import { USER_AGENT } from "../../sources/wikidata.js";

const PAGES: Record<string, string> = {
  BER: "Berlin Brandenburg Airport",
  // Deliberately the redirect title: without redirects=1 this yields an empty stub.
  LHR: "London Heathrow Airport",
  EEK: "Eek Airport",
};

const url = (titles: string) =>
  "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2" +
  "&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=" +
  encodeURIComponent(titles);

const res = await fetch(url(Object.values(PAGES).join("|")), {
  headers: { "User-Agent": USER_AGENT },
});
const data = (await res.json()) as {
  query: { pages: { title: string; revisions?: { slots: { main: { content: string } } }[] }[] };
};

for (const [iata, title] of Object.entries(PAGES)) {
  const page = data.query.pages.find(
    (p) => p.title === title || p.title.replace(/^London /, "") === title.replace(/^London /, ""),
  ) ?? data.query.pages.shift();
  const content = page?.revisions?.[0]?.slots.main.content;
  if (!content) throw new Error(`no content for ${title}`);
  writeFileSync(new URL(`./${iata}.wikitext`, import.meta.url), content);
  console.log(`${iata}: ${content.length} chars`);
}
```

- [ ] **Step 2: Download the fixtures**

Run: `npx tsx scripts/parse/fixtures/download.ts`
Expected: three files written, each thousands of characters. BER should be the largest.

- [ ] **Step 3: Write the failing test**

```ts
// scripts/parse/destinations.fixtures.test.ts
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { findDestinationSection, parseDestinations } from "./destinations.js";

const load = (iata: string) =>
  readFileSync(new URL(`./fixtures/${iata}.wikitext`, import.meta.url), "utf8");

// A minimal real title->IATA map, enough to assert on known destinations.
const TITLES: Record<string, string> = {
  "Barcelona–El Prat Airport": "BCN",
  "Amsterdam Airport Schiphol": "AMS",
  "Zurich Airport": "ZRH",
  "Frankfurt Airport": "FRA",
  "Munich Airport": "MUC",
  "Al Maktoum International Airport": "DWC",
  "Bethel Airport": "BET",
};

test("BER: finds a large destinations section with seasonal markers", () => {
  const wt = load("BER");
  const section = findDestinationSection(wt);
  expect(section).not.toBeNull();
  expect(section!.length).toBeGreaterThan(5000);
  expect(/seasonal/i.test(section!)).toBe(true);
});

test("BER: resolves known current destinations", () => {
  const codes = parseDestinations(load("BER"), TITLES).map((d) => d.iata);
  // DWC is a post-2024 route; its presence proves the data is current.
  expect(codes).toContain("DWC");
  expect(codes).toContain("BCN");
});

test("LHR: redirect title still yields a destinations section", () => {
  // Guards the redirects=1 requirement — without it this fixture is an empty stub.
  const section = findDestinationSection(load("LHR"));
  expect(section).not.toBeNull();
  expect(section!.length).toBeGreaterThan(2000);
});

test("EEK: a sparse regional airport still parses without throwing", () => {
  expect(() => parseDestinations(load("EEK"), TITLES)).not.toThrow();
});

test("every parsed destination has a three-letter IATA code", () => {
  for (const d of parseDestinations(load("BER"), TITLES)) {
    expect(d.iata).toMatch(/^[A-Z]{3}$/);
  }
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/parse/destinations.fixtures.test.ts`
Expected: PASS, 5 tests. If the LHR test fails with an empty section, `redirects=1` was dropped from the downloader — that is exactly the bug this test exists to catch.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse
git commit -m "test: add real-article parser fixtures for BER, LHR and EEK"
```

---

### Task 8: Batched crawl CLI

**Files:**
- Create: `scripts/crawl.ts`, `scripts/wiki.ts`
- Test: `scripts/wiki.test.ts`

**Interfaces:**
- Consumes: Task 4 `parseAirportsCsv`, Task 5 `fetchIataTitleMap`/`USER_AGENT`, Task 6 `parseDestinations`
- Produces: `chunk<T>(items: T[], size: number): T[][]`; `buildQueryUrl(titles: string[]): string`; `extractPages(json: unknown): Map<string, string>`; `data/raw/<IATA>.json` files shaped `{ iata, title, fetchedAt, destinations: Destination[] }`

Batch size is 50 (spec §4.2): 80 requests, ~4 min, ~80 MB for the full run.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/wiki.test.ts
import { expect, test } from "vitest";
import { buildQueryUrl, chunk, extractPages } from "./wiki.js";

test("chunk splits into batches of at most n", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunk of an empty list is empty", () => {
  expect(chunk([], 50)).toEqual([]);
});

test("query url always sets redirects=1", () => {
  expect(buildQueryUrl(["A"])).toContain("redirects=1");
});

test("query url requests raw wikitext content", () => {
  const url = buildQueryUrl(["A"]);
  expect(url).toContain("prop=revisions");
  expect(url).toContain("rvprop=content");
  expect(url).toContain("rvslots=main");
});

test("query url joins titles with a pipe", () => {
  expect(decodeURIComponent(buildQueryUrl(["Heathrow Airport", "Eek Airport"])))
    .toContain("Heathrow Airport|Eek Airport");
});

test("extractPages maps title to wikitext", () => {
  const json = {
    query: {
      pages: [{ title: "Eek Airport", revisions: [{ slots: { main: { content: "hello" } } }] }],
    },
  };
  expect(extractPages(json).get("Eek Airport")).toBe("hello");
});

test("extractPages follows redirect normalisation back to the requested title", () => {
  const json = {
    query: {
      redirects: [{ from: "London Heathrow Airport", to: "Heathrow Airport" }],
      pages: [{ title: "Heathrow Airport", revisions: [{ slots: { main: { content: "x" } } }] }],
    },
  };
  const pages = extractPages(json);
  expect(pages.get("Heathrow Airport")).toBe("x");
  expect(pages.get("London Heathrow Airport")).toBe("x");
});

test("extractPages skips missing pages", () => {
  const json = { query: { pages: [{ title: "Nope", missing: true }] } };
  expect(extractPages(json).size).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/wiki.test.ts`
Expected: FAIL — cannot resolve `./wiki.js`.

- [ ] **Step 3: Write `scripts/wiki.ts`**

```ts
// scripts/wiki.ts
import { USER_AGENT } from "./sources/wikidata.js";

export const BATCH_SIZE = 50;
const API = "https://en.wikipedia.org/w/api.php";

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function buildQueryUrl(titles: string[]): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    titles: titles.join("|"),
  });
  return `${API}?${params}`;
}

type ApiResponse = {
  query?: {
    redirects?: { from: string; to: string }[];
    normalized?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[];
  };
};

/** Maps every requested title (pre- and post-redirect) to its wikitext. */
export function extractPages(json: unknown): Map<string, string> {
  const q = (json as ApiResponse).query ?? {};
  const byTitle = new Map<string, string>();
  for (const p of q.pages ?? []) {
    const content = p.revisions?.[0]?.slots.main.content;
    if (p.missing || !content) continue;
    byTitle.set(p.title, content);
  }
  for (const hop of [...(q.normalized ?? []), ...(q.redirects ?? [])]) {
    const content = byTitle.get(hop.to);
    if (content !== undefined) byTitle.set(hop.from, content);
  }
  return byTitle;
}

export async function fetchBatch(titles: string[]): Promise<Map<string, string>> {
  const res = await fetch(buildQueryUrl(titles), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return extractPages(await res.json());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/wiki.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write `scripts/crawl.ts`**

```ts
// scripts/crawl.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { AIRPORTS_CSV_URL, parseAirportsCsv } from "./sources/ourairports.js";
import { fetchIataTitleMap, USER_AGENT } from "./sources/wikidata.js";
import { parseDestinations } from "./parse/destinations.js";
import { BATCH_SIZE, chunk, fetchBatch } from "./wiki.js";

const RAW_DIR = new URL("../data/raw/", import.meta.url);
const CACHE = new URL("../data/cache/", import.meta.url);

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const explicit = args.filter((a) => !a.startsWith("--") && /^[A-Z,]+$/.test(a))
  .flatMap((a) => a.split(",")).filter(Boolean);

const staleDays = Number((value("stale") ?? "").replace(/d$/, "")) || 0;
const force = flag("force");

function isFresh(iata: string): boolean {
  if (force) return false;
  const file = new URL(`./${iata}.json`, RAW_DIR);
  if (!existsSync(file)) return false;
  if (!staleDays) return true;
  const { fetchedAt } = JSON.parse(readFileSync(file, "utf8")) as { fetchedAt: string };
  return Date.now() - Date.parse(fetchedAt) < staleDays * 86_400_000;
}

async function cachedText(url: string, name: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const file = new URL(`./${name}`, CACHE);
  if (existsSync(file) && !force) return readFileSync(file, "utf8");
  const text = await (await fetch(url, { headers: { "User-Agent": USER_AGENT } })).text();
  writeFileSync(file, text);
  return text;
}

const airports = parseAirportsCsv(await cachedText(AIRPORTS_CSV_URL, "airports.csv"));
console.log(`airports with scheduled service and IATA: ${airports.length}`);

const iataToTitle = await fetchIataTitleMap();
const titleToIata: Record<string, string> = {};
for (const [iata, title] of Object.entries(iataToTitle)) titleToIata[title] = iata;
console.log(`wikidata IATA->article rows: ${Object.keys(iataToTitle).length}`);

let targets = airports.map((a) => a.iata).filter((c) => iataToTitle[c]);
if (explicit.length) targets = targets.filter((c) => explicit.includes(c));
else if (!flag("all") && !staleDays) {
  console.error("Specify airports (e.g. IST,BKK), or --all, or --stale 30d");
  process.exit(1);
}
targets = targets.filter((c) => !isFresh(c));
console.log(`crawling ${targets.length} airports in ${Math.ceil(targets.length / BATCH_SIZE)} batches`);

mkdirSync(RAW_DIR, { recursive: true });
let written = 0;
let empty = 0;

for (const [i, batch] of chunk(targets, BATCH_SIZE).entries()) {
  const titles = batch.map((c) => iataToTitle[c]!);
  const pages = await fetchBatch(titles);
  for (const iata of batch) {
    const title = iataToTitle[iata]!;
    const wikitext = pages.get(title);
    if (!wikitext) continue;
    const destinations = parseDestinations(wikitext, titleToIata);
    if (destinations.length === 0) empty++;
    writeFileSync(
      new URL(`./${iata}.json`, RAW_DIR),
      JSON.stringify({ iata, title, fetchedAt: new Date().toISOString(), destinations }),
    );
    written++;
  }
  console.log(`  batch ${i + 1}: ${written} written, ${empty} with no destinations`);
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`done: ${written} files, ${empty} empty (${((1 - empty / written) * 100).toFixed(1)}% coverage)`);
```

- [ ] **Step 6: Verify a targeted crawl works**

Run: `npm run crawl -- IST,BKK`
Expected: two files in `data/raw/`. Verify they contain real destinations:

```bash
node -e "for(const c of ['IST','BKK']){const d=JSON.parse(require('fs').readFileSync('data/raw/'+c+'.json'));console.log(c,d.destinations.length,'destinations')}"
```

Expected: each well over 100 destinations.

- [ ] **Step 7: Commit**

```bash
git add scripts
git commit -m "feat: add batched Wikipedia crawl CLI"
```

---

### Task 9: Bundle compiler

**Files:**
- Create: `scripts/bundle.ts`, `src/data/format.ts`
- Test: `src/data/format.test.ts`

**Interfaces:**
- Consumes: Task 2 `greatCircleKm`, Task 3 `durationMinutes`
- Produces: `MAGIC = "FLYR"`; `FLAG_SEASONAL = 1`, `FLAG_CHARTER = 2`; `encodeRoutes(routes: RouteRecord[]): ArrayBuffer`; `decodeRoutes(buf: ArrayBuffer): RouteTable`; `type RouteRecord = { a: number; b: number; minutes: number; flags: number }`; `type RouteTable = { count: number; a: Uint16Array; b: Uint16Array; minutes: Uint16Array; flags: Uint8Array }`; and `public/airports.json` + `public/routes.bin`

Binary layout (spec §4.4). Arrays are stored contiguously rather than interleaved so each maps directly onto a typed array without per-record `DataView` reads:

```
offset 0   : magic "FLYR"      (4 bytes)
offset 4   : count             (Uint32, little-endian)
offset 8   : a[]               (Uint16 x count)
offset 8+2n: b[]               (Uint16 x count)
offset 8+4n: minutes[]         (Uint16 x count)
offset 8+6n: flags[]           (Uint8  x count)
```

The 8-byte header keeps every `Uint16Array` 2-byte aligned.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/format.test.ts
import { expect, test } from "vitest";
import { decodeRoutes, encodeRoutes, FLAG_CHARTER, FLAG_SEASONAL } from "./format.js";

const SAMPLE = [
  { a: 0, b: 1, minutes: 95, flags: 0 },
  { a: 1, b: 2, minutes: 480, flags: FLAG_SEASONAL },
  { a: 0, b: 2, minutes: 40, flags: FLAG_SEASONAL | FLAG_CHARTER },
];

test("round-trips route records", () => {
  const t = decodeRoutes(encodeRoutes(SAMPLE));
  expect(t.count).toBe(3);
  expect([...t.a]).toEqual([0, 1, 0]);
  expect([...t.b]).toEqual([1, 2, 2]);
  expect([...t.minutes]).toEqual([95, 480, 40]);
  expect([...t.flags]).toEqual([0, FLAG_SEASONAL, FLAG_SEASONAL | FLAG_CHARTER]);
});

test("round-trips an empty table", () => {
  expect(decodeRoutes(encodeRoutes([])).count).toBe(0);
});

test("byte length matches the documented layout", () => {
  expect(encodeRoutes(SAMPLE).byteLength).toBe(8 + 3 * 7);
});

test("rejects a buffer with the wrong magic", () => {
  const bad = new Uint8Array(encodeRoutes(SAMPLE));
  bad[0] = 88;
  expect(() => decodeRoutes(bad.buffer)).toThrow(/magic/i);
});

test("handles airport indices above 255", () => {
  const t = decodeRoutes(encodeRoutes([{ a: 3000, b: 4000, minutes: 300, flags: 0 }]));
  expect(t.a[0]).toBe(3000);
  expect(t.b[0]).toBe(4000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/format.test.ts`
Expected: FAIL — cannot resolve `./format.js`.

- [ ] **Step 3: Write `src/data/format.ts`**

```ts
// src/data/format.ts

export const MAGIC = "FLYR";
export const FLAG_SEASONAL = 1;
export const FLAG_CHARTER = 2;
export const HEADER_BYTES = 8;

export type RouteRecord = { a: number; b: number; minutes: number; flags: number };

export type RouteTable = {
  count: number;
  a: Uint16Array;
  b: Uint16Array;
  minutes: Uint16Array;
  flags: Uint8Array;
};

export function encodeRoutes(routes: RouteRecord[]): ArrayBuffer {
  const n = routes.length;
  const buf = new ArrayBuffer(HEADER_BYTES + n * 7);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 4; i++) bytes[i] = MAGIC.charCodeAt(i);
  new DataView(buf).setUint32(4, n, true);

  const a = new Uint16Array(buf, HEADER_BYTES, n);
  const b = new Uint16Array(buf, HEADER_BYTES + n * 2, n);
  const minutes = new Uint16Array(buf, HEADER_BYTES + n * 4, n);
  const flags = new Uint8Array(buf, HEADER_BYTES + n * 6, n);

  for (let i = 0; i < n; i++) {
    const r = routes[i]!;
    a[i] = r.a;
    b[i] = r.b;
    minutes[i] = r.minutes;
    flags[i] = r.flags;
  }
  return buf;
}

export function decodeRoutes(buf: ArrayBuffer): RouteTable {
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) throw new Error("bad magic in routes.bin");
  }
  const count = new DataView(buf).getUint32(4, true);
  return {
    count,
    a: new Uint16Array(buf, HEADER_BYTES, count),
    b: new Uint16Array(buf, HEADER_BYTES + count * 2, count),
    minutes: new Uint16Array(buf, HEADER_BYTES + count * 4, count),
    flags: new Uint8Array(buf, HEADER_BYTES + count * 6, count),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/format.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write `scripts/bundle.ts`**

Gates from spec §4.4: <85% coverage fails, >5% count drift fails, missing coordinates fail. `--force-bundle` overrides.

```ts
// scripts/bundle.ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { greatCircleKm } from "../src/geo/distance.js";
import { durationMinutes } from "../src/geo/duration.js";
import { encodeRoutes, FLAG_CHARTER, FLAG_SEASONAL, type RouteRecord } from "../src/data/format.js";
import { parseAirportsCsv, type AirportRow } from "./sources/ourairports.js";
import type { Destination } from "./parse/destinations.js";

const RAW = new URL("../data/raw/", import.meta.url);
const PUBLIC = new URL("../public/", import.meta.url);
const force = process.argv.includes("--force-bundle");
const fail = (msg: string) => {
  if (force) { console.warn(`WARN (forced): ${msg}`); return; }
  console.error(`BUNDLE FAILED: ${msg}`);
  process.exit(1);
};

const csv = readFileSync(new URL("../data/cache/airports.csv", import.meta.url), "utf8");
const byIata = new Map<string, AirportRow>(parseAirportsCsv(csv).map((a) => [a.iata, a]));

const files = readdirSync(RAW).filter((f) => f.endsWith(".json"));
if (files.length === 0) fail("data/raw/ is empty — run `npm run crawl -- --all` first");

// Collect undirected pairs, keeping the strongest claim about each.
const pairs = new Map<string, { a: string; b: string; flags: number }>();
let withDestinations = 0;

for (const file of files) {
  const doc = JSON.parse(readFileSync(new URL(`./${file}`, RAW), "utf8")) as {
    iata: string; destinations: Destination[];
  };
  if (doc.destinations.length > 0) withDestinations++;
  for (const d of doc.destinations) {
    if (!byIata.has(doc.iata) || !byIata.has(d.iata) || doc.iata === d.iata) continue;
    const [a, b] = [doc.iata, d.iata].sort() as [string, string];
    const key = `${a} ${b}`;
    const flags = (d.seasonal ? FLAG_SEASONAL : 0) | (d.charter ? FLAG_CHARTER : 0);
    const prev = pairs.get(key);
    // A route claimed year-round by either endpoint is year-round.
    if (prev) prev.flags &= flags;
    else pairs.set(key, { a, b, flags });
  }
}

const coverage = withDestinations / files.length;
console.log(`coverage: ${withDestinations}/${files.length} (${(coverage * 100).toFixed(1)}%)`);
if (coverage < 0.85) fail(`coverage ${(coverage * 100).toFixed(1)}% is below the 85% threshold`);

// Only airports that appear in at least one route are shipped.
const used = new Set<string>();
for (const p of pairs.values()) { used.add(p.a); used.add(p.b); }
const airports = [...used].sort().map((iata) => byIata.get(iata)!);
const index = new Map(airports.map((a, i) => [a.iata, i]));

for (const a of airports) {
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) fail(`${a.iata} has no coordinates`);
}

const routes: RouteRecord[] = [];
for (const p of pairs.values()) {
  const A = byIata.get(p.a)!;
  const B = byIata.get(p.b)!;
  routes.push({
    a: index.get(p.a)!,
    b: index.get(p.b)!,
    minutes: Math.min(65535, durationMinutes(greatCircleKm(A, B))),
    flags: p.flags,
  });
}

// Drift gate against the previously committed bundle.
const prevPath = new URL("./airports.json", PUBLIC);
if (existsSync(prevPath)) {
  const prev = JSON.parse(readFileSync(prevPath, "utf8")) as { airports: unknown[] };
  const drift = Math.abs(airports.length - prev.airports.length) / prev.airports.length;
  console.log(`airport count drift vs committed bundle: ${(drift * 100).toFixed(1)}%`);
  if (drift > 0.05) fail(`airport count moved ${(drift * 100).toFixed(1)}% (>5%)`);
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(
  new URL("./airports.json", PUBLIC),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    airports: airports.map((a) => [a.iata, a.name, a.city, a.country, a.lat, a.lon, a.size]),
  }),
);
writeFileSync(new URL("./routes.bin", PUBLIC), Buffer.from(encodeRoutes(routes)));
console.log(`wrote ${airports.length} airports, ${routes.length} routes`);
```

- [ ] **Step 6: Verify the bundler runs**

Run: `npm run crawl -- --all` then `npm run bundle`

Expected: coverage above 90%, roughly 3,000–4,000 airports and tens of thousands of route pairs. `public/routes.bin` should be a few hundred KB at most.

```bash
ls -la public/
```

- [ ] **Step 7: Commit**

```bash
git add src/data scripts public/airports.json public/routes.bin
git commit -m "feat: compile crawled data into airports.json and routes.bin"
```

---

### Task 10: Client-side data loading

**Files:**
- Create: `src/data/bundle.ts`
- Test: `src/data/bundle.test.ts`

**Interfaces:**
- Consumes: Task 9 `decodeRoutes`, `RouteTable`
- Produces: `type Airport = { iata: string; name: string; city: string; country: string; lat: number; lon: number; size: string }`; `type Dataset = { airports: Airport[]; index: Map<string, number>; routes: RouteTable; adjacency: number[][] }`; `parseAirports(json: unknown): Airport[]`; `buildAdjacency(count: number, routes: RouteTable): number[][]`; `loadDataset(): Promise<Dataset>`

`adjacency[i]` holds the **route record indices** touching airport `i`, so a query reads minutes and flags straight from the typed arrays.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/bundle.test.ts
import { expect, test } from "vitest";
import { encodeRoutes, decodeRoutes } from "./format.js";
import { buildAdjacency, parseAirports } from "./bundle.js";

test("parses the compact airport tuple format", () => {
  const json = { airports: [["LHR", "Heathrow Airport", "London", "GB", 51.47, -0.46, "large"]] };
  expect(parseAirports(json)).toEqual([
    { iata: "LHR", name: "Heathrow Airport", city: "London", country: "GB", lat: 51.47, lon: -0.46, size: "large" },
  ]);
});

test("adjacency lists the route indices touching each airport", () => {
  const routes = decodeRoutes(encodeRoutes([
    { a: 0, b: 1, minutes: 60, flags: 0 },
    { a: 0, b: 2, minutes: 90, flags: 0 },
    { a: 1, b: 2, minutes: 30, flags: 0 },
  ]));
  const adj = buildAdjacency(3, routes);
  expect(adj[0]).toEqual([0, 1]);
  expect(adj[1]).toEqual([0, 2]);
  expect(adj[2]).toEqual([1, 2]);
});

test("an airport with no routes gets an empty list, not undefined", () => {
  const routes = decodeRoutes(encodeRoutes([{ a: 0, b: 1, minutes: 60, flags: 0 }]));
  expect(buildAdjacency(3, routes)[2]).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/bundle.test.ts`
Expected: FAIL — cannot resolve `./bundle.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/data/bundle.ts
import { decodeRoutes, type RouteTable } from "./format.js";

export type Airport = {
  iata: string; name: string; city: string; country: string;
  lat: number; lon: number; size: string;
};

export type Dataset = {
  airports: Airport[];
  index: Map<string, number>;
  routes: RouteTable;
  /** adjacency[airportIndex] = route record indices touching that airport */
  adjacency: number[][];
};

type Tuple = [string, string, string, string, number, number, string];

export function parseAirports(json: unknown): Airport[] {
  const rows = (json as { airports?: Tuple[] }).airports ?? [];
  return rows.map(([iata, name, city, country, lat, lon, size]) => ({
    iata, name, city, country, lat, lon, size,
  }));
}

export function buildAdjacency(count: number, routes: RouteTable): number[][] {
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < routes.count; i++) {
    adj[routes.a[i]!]!.push(i);
    adj[routes.b[i]!]!.push(i);
  }
  return adj;
}

export async function loadDataset(): Promise<Dataset> {
  const [airportsJson, routesBuf] = await Promise.all([
    fetch("/airports.json").then((r) => r.json()),
    fetch("/routes.bin").then((r) => r.arrayBuffer()),
  ]);
  const airports = parseAirports(airportsJson);
  const routes = decodeRoutes(routesBuf);
  return {
    airports,
    index: new Map(airports.map((a, i) => [a.iata, i])),
    routes,
    adjacency: buildAdjacency(airports.length, routes),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/bundle.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat: load and index the client dataset"
```

---

### Task 11: Reachability query

**Files:**
- Create: `src/reach/query.ts`
- Test: `src/reach/query.test.ts`

**Interfaces:**
- Consumes: Task 10 `Dataset`
- Produces: `type Reachable = { airport: number; minutes: number; seasonal: boolean; charter: boolean }`; `reachable(data, origin: number, maxMinutes: number, opts?: { yearRoundOnly?: boolean }): Reachable[]`; `sharedDestinations(a: Reachable[], b: Reachable[]): Set<number>`

- [ ] **Step 1: Write the failing test**

```ts
// src/reach/query.test.ts
import { expect, test } from "vitest";
import { decodeRoutes, encodeRoutes, FLAG_SEASONAL } from "../data/format.js";
import { buildAdjacency, type Dataset } from "../data/bundle.js";
import { reachable, sharedDestinations } from "./query.js";

/** 0=BER 1=LIS 2=BCN 3=SYD */
function fixture(): Dataset {
  const routes = decodeRoutes(encodeRoutes([
    { a: 0, b: 2, minutes: 125, flags: 0 },            // BER-BCN
    { a: 1, b: 2, minutes: 110, flags: 0 },            // LIS-BCN
    { a: 0, b: 1, minutes: 200, flags: FLAG_SEASONAL },// BER-LIS seasonal
    { a: 0, b: 3, minutes: 1300, flags: 0 },           // BER-SYD, far
  ]));
  const airports = ["BER", "LIS", "BCN", "SYD"].map((iata) => ({
    iata, name: iata, city: iata, country: "XX", lat: 0, lon: 0, size: "large",
  }));
  return {
    airports,
    index: new Map(airports.map((a, i) => [a.iata, i])),
    routes,
    adjacency: buildAdjacency(4, routes),
  };
}

test("returns destinations within the time budget", () => {
  const r = reachable(fixture(), 0, 180);
  expect(r.map((x) => x.airport)).toEqual([2]);
});

test("respects the direction-agnostic adjacency", () => {
  const r = reachable(fixture(), 2, 180).map((x) => x.airport).sort();
  expect(r).toEqual([0, 1]);
});

test("excludes destinations beyond the budget", () => {
  expect(reachable(fixture(), 0, 100)).toEqual([]);
});

test("includes a destination exactly at the budget", () => {
  expect(reachable(fixture(), 0, 125).map((x) => x.airport)).toEqual([2]);
});

test("never returns the origin itself", () => {
  expect(reachable(fixture(), 0, 9999).some((x) => x.airport === 0)).toBe(false);
});

test("surfaces the seasonal flag", () => {
  const r = reachable(fixture(), 0, 250);
  expect(r.find((x) => x.airport === 1)?.seasonal).toBe(true);
});

test("yearRoundOnly drops seasonal routes", () => {
  const r = reachable(fixture(), 0, 250, { yearRoundOnly: true });
  expect(r.map((x) => x.airport)).toEqual([2]);
});

test("results are sorted by duration", () => {
  const mins = reachable(fixture(), 0, 9999).map((x) => x.minutes);
  expect(mins).toEqual([...mins].sort((p, q) => p - q));
});

test("sharedDestinations intersects two reach sets", () => {
  const d = fixture();
  expect([...sharedDestinations(reachable(d, 0, 180), reachable(d, 1, 180))]).toEqual([2]);
});

test("sharedDestinations is empty when nothing overlaps", () => {
  const d = fixture();
  expect(sharedDestinations(reachable(d, 0, 100), reachable(d, 1, 180)).size).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/reach/query.test.ts`
Expected: FAIL — cannot resolve `./query.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/reach/query.ts
import type { Dataset } from "../data/bundle.js";
import { FLAG_CHARTER, FLAG_SEASONAL } from "../data/format.js";

export type Reachable = {
  airport: number;
  minutes: number;
  seasonal: boolean;
  charter: boolean;
};

export function reachable(
  data: Dataset,
  origin: number,
  maxMinutes: number,
  opts: { yearRoundOnly?: boolean } = {},
): Reachable[] {
  const { routes, adjacency } = data;
  const out: Reachable[] = [];
  for (const r of adjacency[origin] ?? []) {
    const minutes = routes.minutes[r]!;
    if (minutes > maxMinutes) continue;
    const flags = routes.flags[r]!;
    const seasonal = (flags & FLAG_SEASONAL) !== 0;
    if (opts.yearRoundOnly && seasonal) continue;
    const a = routes.a[r]!;
    const other = a === origin ? routes.b[r]! : a;
    if (other === origin) continue;
    out.push({ airport: other, minutes, seasonal, charter: (flags & FLAG_CHARTER) !== 0 });
  }
  return out.sort((p, q) => p.minutes - q.minutes);
}

export function sharedDestinations(a: Reachable[], b: Reachable[]): Set<number> {
  const inB = new Set(b.map((x) => x.airport));
  return new Set(a.map((x) => x.airport).filter((x) => inB.has(x)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/reach/query.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/reach
git commit -m "feat: add reachability queries and shared-destination intersection"
```

---

### Task 12: Great-circle arcs and antimeridian splitting

**Files:**
- Create: `src/geo/arc.ts`
- Test: `src/geo/arc.test.ts`

**Interfaces:**
- Consumes: Task 2 `LatLon`
- Produces: `interpolateGreatCircle(a: LatLon, b: LatLon, steps?: number): LatLon[]`; `splitAtAntimeridian(points: LatLon[]): LatLon[][]`; `arcSegments(a: LatLon, b: LatLon, steps?: number): LatLon[][]`

Spec §7.3: arcs are interpolated along the great circle **then** projected, and arcs crossing ±180° must be split or they draw a stripe across the map.

- [ ] **Step 1: Write the failing test**

```ts
// src/geo/arc.test.ts
import { expect, test } from "vitest";
import { arcSegments, interpolateGreatCircle, splitAtAntimeridian } from "./arc.js";

const LHR = { lat: 51.4706, lon: -0.4619 };
const JFK = { lat: 40.6398, lon: -73.7789 };
const NRT = { lat: 35.7647, lon: 140.3864 };
const LAX = { lat: 33.9425, lon: -118.408 };

test("interpolation starts and ends at the endpoints", () => {
  const pts = interpolateGreatCircle(LHR, JFK, 16);
  expect(pts[0]!.lat).toBeCloseTo(LHR.lat, 4);
  expect(pts.at(-1)!.lon).toBeCloseTo(JFK.lon, 4);
});

test("interpolation returns steps+1 points", () => {
  expect(interpolateGreatCircle(LHR, JFK, 16)).toHaveLength(17);
});

test("the great circle bows north of the straight lat/lon midpoint", () => {
  const pts = interpolateGreatCircle(LHR, JFK, 32);
  const mid = pts[16]!;
  expect(mid.lat).toBeGreaterThan((LHR.lat + JFK.lat) / 2);
});

test("identical endpoints do not produce NaN", () => {
  for (const p of interpolateGreatCircle(LHR, LHR, 8)) {
    expect(Number.isFinite(p.lat)).toBe(true);
    expect(Number.isFinite(p.lon)).toBe(true);
  }
});

test("a path that never crosses the antimeridian stays one segment", () => {
  expect(splitAtAntimeridian(interpolateGreatCircle(LHR, JFK, 32))).toHaveLength(1);
});

test("a Pacific crossing is split into two segments", () => {
  expect(arcSegments(NRT, LAX, 64).length).toBe(2);
});

test("no segment contains a longitude jump larger than 180 degrees", () => {
  for (const seg of arcSegments(NRT, LAX, 64)) {
    for (let i = 1; i < seg.length; i++) {
      expect(Math.abs(seg[i]!.lon - seg[i - 1]!.lon)).toBeLessThan(180);
    }
  }
});

test("every split segment has at least two points", () => {
  for (const seg of arcSegments(NRT, LAX, 64)) {
    expect(seg.length).toBeGreaterThanOrEqual(2);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/geo/arc.test.ts`
Expected: FAIL — cannot resolve `./arc.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/geo/arc.ts
import type { LatLon } from "./types.js";

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Spherical linear interpolation along the great circle between two points. */
export function interpolateGreatCircle(a: LatLon, b: LatLon, steps = 64): LatLon[] {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lon);
  const φ2 = toRad(b.lat), λ2 = toRad(b.lon);
  const d =
    2 *
    Math.asin(
      Math.min(1, Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      )),
    );

  const pts: LatLon[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    // Degenerate case: coincident endpoints give d === 0 and would divide by zero.
    if (d === 0) { pts.push({ lat: a.lat, lon: a.lon }); continue; }
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push({ lat: toDeg(Math.atan2(z, Math.hypot(x, y))), lon: toDeg(Math.atan2(y, x)) });
  }
  return pts;
}

/**
 * Breaks a path wherever consecutive longitudes jump more than 180 degrees,
 * which means the path wrapped across the antimeridian. Without this the
 * renderer draws a stripe straight across the map.
 */
export function splitAtAntimeridian(points: LatLon[]): LatLon[][] {
  const segments: LatLon[][] = [];
  let current: LatLon[] = [];
  for (const p of points) {
    const prev = current.at(-1);
    if (prev && Math.abs(p.lon - prev.lon) > 180) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

export function arcSegments(a: LatLon, b: LatLon, steps = 64): LatLon[][] {
  return splitAtAntimeridian(interpolateGreatCircle(a, b, steps));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/geo/arc.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/geo
git commit -m "feat: add great-circle arc interpolation with antimeridian splitting"
```

---

### Task 13: URL state

**Files:**
- Create: `src/state/url.ts`
- Test: `src/state/url.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `type AppState = { a: string | null; b: string | null; minutes: number; yearRoundOnly: boolean }`; `DEFAULT_STATE`; `MIN_MINUTES = 30`, `MAX_MINUTES = 480`, `STEP_MINUTES = 15`; `parseState(search: string): AppState`; `toSearch(state: AppState): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/url.test.ts
import { expect, test } from "vitest";
import { DEFAULT_STATE, MAX_MINUTES, MIN_MINUTES, parseState, toSearch } from "./url.js";

test("parses both airports and the time budget", () => {
  expect(parseState("?a=BER&b=LIS&t=180")).toEqual({
    a: "BER", b: "LIS", minutes: 180, yearRoundOnly: false,
  });
});

test("an empty search yields the defaults", () => {
  expect(parseState("")).toEqual(DEFAULT_STATE);
});

test("a single airport is a valid state", () => {
  expect(parseState("?a=BER").b).toBeNull();
});

test("airport codes are upper-cased", () => {
  expect(parseState("?a=ber").a).toBe("BER");
});

test("rejects codes that are not three letters", () => {
  expect(parseState("?a=BERLIN").a).toBeNull();
});

test("clamps the budget below the minimum", () => {
  expect(parseState("?t=5").minutes).toBe(MIN_MINUTES);
});

test("clamps the budget above the maximum", () => {
  expect(parseState("?t=99999").minutes).toBe(MAX_MINUTES);
});

test("snaps the budget to the 15-minute step", () => {
  expect(parseState("?t=187").minutes).toBe(180);
});

test("a non-numeric budget falls back to the default", () => {
  expect(parseState("?t=soon").minutes).toBe(DEFAULT_STATE.minutes);
});

test("round-trips through toSearch", () => {
  const state = { a: "BER", b: "LIS", minutes: 195, yearRoundOnly: true };
  expect(parseState(toSearch(state))).toEqual(state);
});

test("omits empty slots from the query string", () => {
  expect(toSearch({ a: "BER", b: null, minutes: 180, yearRoundOnly: false }))
    .toBe("?a=BER&t=180");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/url.test.ts`
Expected: FAIL — cannot resolve `./url.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/state/url.ts

export const MIN_MINUTES = 30;
export const MAX_MINUTES = 480;
export const STEP_MINUTES = 15;

export type AppState = {
  a: string | null;
  b: string | null;
  minutes: number;
  yearRoundOnly: boolean;
};

export const DEFAULT_STATE: AppState = {
  a: null, b: null, minutes: 180, yearRoundOnly: false,
};

function code(raw: string | null): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : null;
}

export function clampMinutes(n: number): number {
  const snapped = Math.round(n / STEP_MINUTES) * STEP_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, snapped));
}

export function parseState(search: string): AppState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawT = Number(p.get("t"));
  return {
    a: code(p.get("a")),
    b: code(p.get("b")),
    minutes: Number.isFinite(rawT) && p.get("t") !== null && p.get("t") !== ""
      ? clampMinutes(rawT)
      : DEFAULT_STATE.minutes,
    yearRoundOnly: p.get("yr") === "1",
  };
}

export function toSearch(state: AppState): string {
  const p = new URLSearchParams();
  if (state.a) p.set("a", state.a);
  if (state.b) p.set("b", state.b);
  p.set("t", String(state.minutes));
  if (state.yearRoundOnly) p.set("yr", "1");
  return `?${p}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/url.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/state
git commit -m "feat: encode app state in the URL"
```

---

### Task 14: Basemap assets

**Files:**
- Create: `scripts/basemap.ts`
- Output: `public/world.json`, `public/labels.json`

**Interfaces:**
- Consumes: nothing
- Produces: `public/world.json` (GeoJSON FeatureCollection, geometry only) and `public/labels.json` (`{ name: string; lat: number; lon: number; rank: number }[]`, `rank` being polygon area in square degrees, larger = more prominent)

Labels carry `rank` so the renderer can thin them by zoom (spec §7.4).

- [ ] **Step 1: Write the script**

```ts
// scripts/basemap.ts
import { mkdirSync, writeFileSync } from "node:fs";

const SRC =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";
const PUBLIC = new URL("../public/", import.meta.url);

type Ring = [number, number][];
type Feature = {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] } | null;
};

const src = (await (await fetch(SRC)).json()) as { features: Feature[] };

const round = (n: number) => Math.round(n * 100) / 100;
const labels: { name: string; lat: number; lon: number; rank: number }[] = [];
const features: unknown[] = [];

for (const f of src.features) {
  if (!f.geometry) continue;
  const name = (f.properties["NAME"] ?? f.properties["name"]) as string | undefined;
  const polys: Ring[][] =
    f.geometry.type === "MultiPolygon" ? (f.geometry.coordinates as Ring[][]) : [f.geometry.coordinates as Ring[]];

  features.push({
    type: "Feature",
    properties: {},
    geometry: {
      type: f.geometry.type,
      coordinates:
        f.geometry.type === "MultiPolygon"
          ? polys.map((p) => p.map((r) => r.map(([x, y]) => [round(x), round(y)])))
          : polys[0]!.map((r) => r.map(([x, y]) => [round(x), round(y)])),
    },
  });

  // Label the largest ring by absolute shoelace area.
  let best: { area: number; lon: number; lat: number } | null = null;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i]!;
      const [x0, y0] = ring[(i - 1 + ring.length) % ring.length]!;
      area += x1 * y0 - x0 * y1;
      cx += x1; cy += y1;
    }
    area = Math.abs(area) / 2;
    if (!best || area > best.area) best = { area, lon: cx / ring.length, lat: cy / ring.length };
  }
  if (name && best && name !== "Antarctica") {
    labels.push({ name, lat: round(best.lat), lon: round(best.lon), rank: Math.round(best.area) });
  }
}

labels.sort((a, b) => b.rank - a.rank);
mkdirSync(PUBLIC, { recursive: true });
writeFileSync(new URL("./world.json", PUBLIC), JSON.stringify({ type: "FeatureCollection", features }));
writeFileSync(new URL("./labels.json", PUBLIC), JSON.stringify(labels));
console.log(`wrote ${features.length} country features and ${labels.length} labels`);
```

- [ ] **Step 2: Run it**

Run: `npm run basemap`
Expected: `wrote 177 country features and ~176 labels`. `public/world.json` should be a few hundred KB.

- [ ] **Step 3: Sanity-check the output**

```bash
node -e "const l=require('./public/labels.json');console.log(l.slice(0,5).map(x=>x.name).join(', '))"
```

Expected: the largest countries first — Russia, Canada, China, United States of America, Brazil.

- [ ] **Step 4: Commit**

```bash
git add scripts/basemap.ts public/world.json public/labels.json
git commit -m "feat: generate Natural Earth basemap and country label assets"
```

---

### Task 15: Projection and basemap rendering

**Files:**
- Create: `src/geo/projection.ts`, `src/render/basemap.ts`
- Test: `src/geo/projection.test.ts`

**Interfaces:**
- Consumes: Task 14 assets, Task 2 `LatLon`
- Produces: `createProjection(width: number, height: number): GeoProjection`; `COLORS` (exact values from Global Constraints); `drawBasemap(ctx: CanvasRenderingContext2D, world: FeatureCollection, projection: GeoProjection, width: number, height: number): void`

- [ ] **Step 1: Write the failing test**

```ts
// src/geo/projection.test.ts
import { expect, test } from "vitest";
import { COLORS, createProjection } from "./projection.js";

test("projects a coordinate inside the canvas", () => {
  const p = createProjection(1000, 500);
  const xy = p([0, 0]);
  expect(xy).not.toBeNull();
  expect(xy![0]).toBeGreaterThan(0);
  expect(xy![0]).toBeLessThan(1000);
});

test("longitude increases to the right", () => {
  const p = createProjection(1000, 500);
  expect(p([50, 0])![0]).toBeGreaterThan(p([-50, 0])![0]);
});

test("latitude increases upward on screen", () => {
  const p = createProjection(1000, 500);
  expect(p([0, 50])![1]).toBeLessThan(p([0, -50])![1]);
});

test("the palette matches the approved design", () => {
  expect(COLORS.ocean).toBe("#dceaf2");
  expect(COLORS.land).toBe("#f2f0eb");
  expect(COLORS.border).toBe("#b3ada2");
  expect(COLORS.label).toBe("#9a948a");
  expect(COLORS.originA).toBe("#d94f45");
  expect(COLORS.originB).toBe("#2b6cb0");
  expect(COLORS.shared).toBe("#111");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/geo/projection.test.ts`
Expected: FAIL — cannot resolve `./projection.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/geo/projection.ts
import { geoEqualEarth, type GeoProjection } from "d3-geo";

export const COLORS = {
  ocean: "#dceaf2",
  land: "#f2f0eb",
  border: "#b3ada2",
  label: "#9a948a",
  originA: "#d94f45",
  originB: "#2b6cb0",
  shared: "#111",
} as const;

export function createProjection(width: number, height: number): GeoProjection {
  return geoEqualEarth().fitExtent(
    [[8, 8], [width - 8, height - 8]],
    { type: "Sphere" },
  );
}
```

```ts
// src/render/basemap.ts
import { geoPath, type GeoProjection } from "d3-geo";
import { COLORS } from "../geo/projection.js";

export function drawBasemap(
  ctx: CanvasRenderingContext2D,
  world: GeoJSON.FeatureCollection,
  projection: GeoProjection,
  width: number,
  height: number,
): void {
  const path = geoPath(projection, ctx);

  ctx.fillStyle = COLORS.ocean;
  ctx.fillRect(0, 0, width, height);

  // Ocean is only inside the projected sphere; clear the surround.
  ctx.beginPath();
  path({ type: "Sphere" } as never);
  ctx.fillStyle = COLORS.ocean;
  ctx.fill();

  ctx.beginPath();
  path(world as never);
  ctx.fillStyle = COLORS.land;
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/geo/projection.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Install GeoJSON types if the build complains**

```bash
npm i -D @types/geojson
```

- [ ] **Step 6: Commit**

```bash
git add src/geo src/render package.json package-lock.json
git commit -m "feat: add Equal Earth projection and canvas basemap rendering"
```

---

### Task 16: Arc and dot rendering

**Files:**
- Create: `src/render/arcs.ts`
- Test: `src/render/arcs.test.ts`

**Interfaces:**
- Consumes: Task 12 `arcSegments`, Task 15 `COLORS`, Task 10 `Airport`, Task 11 `Reachable`
- Produces: `type Layer = { origin: Airport; destinations: Reachable[]; color: string }`; `drawReach(ctx, projection, airports: Airport[], layers: Layer[], shared: Set<number>): void`; `pathForArc(projection, a: LatLon, b: LatLon): [number, number][][]`

`pathForArc` is extracted specifically so the antimeridian behaviour is testable without a canvas.

- [ ] **Step 1: Write the failing test**

```ts
// src/render/arcs.test.ts
import { expect, test } from "vitest";
import { createProjection } from "../geo/projection.js";
import { pathForArc } from "./arcs.js";

const NRT = { lat: 35.7647, lon: 140.3864 };
const LAX = { lat: 33.9425, lon: -118.408 };
const LHR = { lat: 51.4706, lon: -0.4619 };
const CDG = { lat: 49.0128, lon: 2.55 };

test("a short arc projects to a single screen-space path", () => {
  const p = createProjection(1000, 500);
  expect(pathForArc(p, LHR, CDG)).toHaveLength(1);
});

test("a Pacific arc projects to two screen-space paths", () => {
  const p = createProjection(1000, 500);
  expect(pathForArc(p, NRT, LAX).length).toBe(2);
});

test("all projected points are finite", () => {
  const p = createProjection(1000, 500);
  for (const seg of pathForArc(p, NRT, LAX)) {
    for (const [x, y] of seg) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/arcs.test.ts`
Expected: FAIL — cannot resolve `./arcs.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/render/arcs.ts
import type { GeoProjection } from "d3-geo";
import { arcSegments } from "../geo/arc.js";
import type { LatLon } from "../geo/types.js";
import { COLORS } from "../geo/projection.js";
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";

export type Layer = { origin: Airport; destinations: Reachable[]; color: string };

/** Interpolate along the great circle, split at the antimeridian, then project. */
export function pathForArc(
  projection: GeoProjection,
  a: LatLon,
  b: LatLon,
): [number, number][][] {
  return arcSegments(a, b, 48)
    .map((seg) =>
      seg
        .map((p) => projection([p.lon, p.lat]))
        .filter((xy): xy is [number, number] => xy !== null && Number.isFinite(xy[0]) && Number.isFinite(xy[1])),
    )
    .filter((seg) => seg.length >= 2);
}

export function drawReach(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  airports: Airport[],
  layers: Layer[],
  shared: Set<number>,
): void {
  ctx.lineWidth = 0.9;
  ctx.lineJoin = "round";

  for (const layer of layers) {
    ctx.strokeStyle = layer.color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const d of layer.destinations) {
      const dest = airports[d.airport];
      if (!dest) continue;
      for (const seg of pathForArc(projection, layer.origin, dest)) {
        ctx.moveTo(seg[0]![0], seg[0]![1]);
        for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i]![0], seg[i]![1]);
      }
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    for (const d of layer.destinations) {
      if (shared.has(d.airport)) continue;
      const dest = airports[d.airport];
      const xy = dest && projection([dest.lon, dest.lat]);
      if (!xy) continue;
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = COLORS.shared;
  for (const idx of shared) {
    const dest = airports[idx];
    const xy = dest && projection([dest.lon, dest.lat]);
    if (!xy) continue;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const layer of layers) {
    const xy = projection([layer.origin.lon, layer.origin.lat]);
    if (!xy) continue;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = layer.color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/render/arcs.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render
git commit -m "feat: render great-circle arcs, destination dots and origin markers"
```

---

### Task 17: Country labels overlay

**Files:**
- Create: `src/render/labels.ts`
- Test: `src/render/labels.test.ts`

**Interfaces:**
- Consumes: Task 14 `public/labels.json`, Task 15 `COLORS`
- Produces: `type CountryLabel = { name: string; lat: number; lon: number; rank: number }`; `visibleLabels(labels: CountryLabel[], zoom: number): CountryLabel[]`; `renderLabels(svg: SVGSVGElement, labels: CountryLabel[], projection: GeoProjection, zoom: number): void`

Thinning rule: show labels whose `rank` is at least `MIN_RANK / zoom²`, so zooming in reveals smaller countries. `rank` is polygon area in **square degrees** (Task 14), so `MIN_RANK = 40` reproduces the approved dense "B2" label set at the default zoom — roughly 60–80 countries. Do not raise it; the approved design is label-dense.

- [ ] **Step 1: Write the failing test**

```ts
// src/render/labels.test.ts
import { expect, test } from "vitest";
import { visibleLabels, type CountryLabel } from "./labels.js";

// rank is polygon area in square degrees, as emitted by scripts/basemap.ts
const LABELS: CountryLabel[] = [
  { name: "Russia", lat: 60, lon: 90, rank: 2100 },
  { name: "France", lat: 46, lon: 2, rank: 55 },
  { name: "Luxembourg", lat: 49.8, lon: 6.1, rank: 0.3 },
];

test("the default zoom shows a dense label set but hides tiny countries", () => {
  const names = visibleLabels(LABELS, 1).map((l) => l.name);
  expect(names).toContain("Russia");
  expect(names).toContain("France");
  expect(names).not.toContain("Luxembourg");
});

test("zooming in reveals the smallest countries", () => {
  expect(visibleLabels(LABELS, 16).map((l) => l.name)).toContain("Luxembourg");
});

test("zooming in never hides a label that was already visible", () => {
  const near = visibleLabels(LABELS, 4).map((l) => l.name);
  for (const name of visibleLabels(LABELS, 1).map((l) => l.name)) {
    expect(near).toContain(name);
  }
});

test("labels are sorted by prominence", () => {
  const ranks = visibleLabels(LABELS, 40).map((l) => l.rank);
  expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
});

test("zoom is never allowed to divide by zero", () => {
  expect(() => visibleLabels(LABELS, 0)).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/render/labels.test.ts`
Expected: FAIL — cannot resolve `./labels.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/render/labels.ts
import type { GeoProjection } from "d3-geo";
import { COLORS } from "../geo/projection.js";

export type CountryLabel = { name: string; lat: number; lon: number; rank: number };

/**
 * Rank threshold at zoom 1, in square degrees of polygon area. Tuned to the
 * approved dense label set; smaller countries appear as the user zooms in.
 */
export const MIN_RANK = 40;

export function visibleLabels(labels: CountryLabel[], zoom: number): CountryLabel[] {
  const z = Math.max(1, zoom);
  const threshold = MIN_RANK / (z * z);
  return labels.filter((l) => l.rank >= threshold).sort((a, b) => b.rank - a.rank);
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderLabels(
  svg: SVGSVGElement,
  labels: CountryLabel[],
  projection: GeoProjection,
  zoom: number,
): void {
  svg.replaceChildren();
  for (const l of visibleLabels(labels, zoom)) {
    const xy = projection([l.lon, l.lat]);
    if (!xy) continue;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(xy[0]));
    text.setAttribute("y", String(xy[1]));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", COLORS.label);
    text.setAttribute("font-size", "9");
    text.setAttribute("letter-spacing", "0.8");
    text.style.textTransform = "uppercase";
    text.textContent = l.name;
    svg.appendChild(text);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/render/labels.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/render
git commit -m "feat: add zoom-aware country label overlay"
```

---

### Task 18: Airport picker

**Files:**
- Create: `src/ui/search.ts`, `src/ui/picker.ts`
- Test: `src/ui/search.test.ts`

**Interfaces:**
- Consumes: Task 10 `Airport`
- Produces: `searchAirports(airports: Airport[], query: string, limit?: number): Airport[]`; `createPicker(opts: { airports: Airport[]; slot: "a" | "b"; color: string; onSelect: (iata: string | null) => void }): { el: HTMLElement; setValue(iata: string | null): void }`

Ranking rule: exact IATA match first, then city prefix, then name prefix, then substring matches anywhere.

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/search.test.ts
import { expect, test } from "vitest";
import { searchAirports } from "./search.js";
import type { Airport } from "../data/bundle.js";

const ap = (iata: string, name: string, city: string, country: string): Airport =>
  ({ iata, name, city, country, lat: 0, lon: 0, size: "large" });

const AIRPORTS = [
  ap("BER", "Berlin Brandenburg Airport", "Berlin", "DE"),
  ap("BCN", "Barcelona–El Prat Airport", "Barcelona", "ES"),
  ap("LHR", "Heathrow Airport", "London", "GB"),
  ap("LGW", "Gatwick Airport", "London", "GB"),
  ap("TXL", "Berlin Tegel", "Berlin", "DE"),
];

test("an exact IATA match ranks first", () => {
  expect(searchAirports(AIRPORTS, "BER")[0]?.iata).toBe("BER");
});

test("search is case-insensitive", () => {
  expect(searchAirports(AIRPORTS, "ber")[0]?.iata).toBe("BER");
});

test("finds every airport serving a city", () => {
  const codes = searchAirports(AIRPORTS, "London").map((a) => a.iata);
  expect(codes).toContain("LHR");
  expect(codes).toContain("LGW");
});

test("matches on airport name", () => {
  expect(searchAirports(AIRPORTS, "Heathrow")[0]?.iata).toBe("LHR");
});

test("matches on country code", () => {
  expect(searchAirports(AIRPORTS, "ES").map((a) => a.iata)).toContain("BCN");
});

test("an empty query returns nothing", () => {
  expect(searchAirports(AIRPORTS, "   ")).toEqual([]);
});

test("respects the result limit", () => {
  expect(searchAirports(AIRPORTS, "a", 2)).toHaveLength(2);
});

test("an unmatched query returns nothing", () => {
  expect(searchAirports(AIRPORTS, "zzzzz")).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/search.test.ts`
Expected: FAIL — cannot resolve `./search.js`.

- [ ] **Step 3: Write `src/ui/search.ts`**

```ts
// src/ui/search.ts
import type { Airport } from "../data/bundle.js";

/** Lower score sorts first. Infinity means "no match". */
function score(a: Airport, q: string): number {
  const iata = a.iata.toLowerCase();
  const city = a.city.toLowerCase();
  const name = a.name.toLowerCase();
  const country = a.country.toLowerCase();

  if (iata === q) return 0;
  if (city.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (country === q) return 3;
  if (city.includes(q)) return 4;
  if (name.includes(q)) return 5;
  return Infinity;
}

export function searchAirports(airports: Airport[], query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return airports
    .map((a) => ({ a, s: score(a, q) }))
    .filter((x) => x.s !== Infinity)
    .sort((x, y) => x.s - y.s || x.a.iata.localeCompare(y.a.iata))
    .slice(0, limit)
    .map((x) => x.a);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/search.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write `src/ui/picker.ts`**

```ts
// src/ui/picker.ts
import type { Airport } from "../data/bundle.js";
import { searchAirports } from "./search.js";

export type Picker = { el: HTMLElement; setValue(iata: string | null): void };

export function createPicker(opts: {
  airports: Airport[];
  slot: "a" | "b";
  color: string;
  onSelect: (iata: string | null) => void;
}): Picker {
  const el = document.createElement("div");
  el.className = "picker";

  const dot = document.createElement("i");
  dot.className = "dot";
  dot.style.background = opts.color;

  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = opts.slot === "a" ? "Choose an airport" : "Add a second airport";
  input.setAttribute("aria-label", opts.slot === "a" ? "First airport" : "Second airport");

  const results = document.createElement("ul");
  results.className = "results";
  results.hidden = true;

  let active = -1;
  let current: Airport[] = [];

  const close = () => { results.hidden = true; active = -1; };

  const choose = (a: Airport) => {
    input.value = `${a.iata} · ${a.city || a.name}`;
    close();
    opts.onSelect(a.iata);
  };

  const render = () => {
    results.replaceChildren();
    current.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = i === active ? "active" : "";
      li.innerHTML = `<b>${a.iata}</b> <span>${a.city || a.name}</span> <em>${a.country}</em>`;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(a); });
      results.appendChild(li);
    });
    results.hidden = current.length === 0;
  };

  input.addEventListener("input", () => {
    if (input.value.trim() === "") opts.onSelect(null);
    current = searchAirports(opts.airports, input.value);
    active = current.length ? 0 : -1;
    render();
  });

  input.addEventListener("keydown", (e) => {
    if (results.hidden) return;
    if (e.key === "ArrowDown") { active = Math.min(active + 1, current.length - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter" && current[active]) { choose(current[active]!); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });

  input.addEventListener("blur", () => setTimeout(close, 120));

  el.append(dot, input, results);

  return {
    el,
    setValue(iata) {
      const a = iata ? opts.airports.find((x) => x.iata === iata) : undefined;
      input.value = a ? `${a.iata} · ${a.city || a.name}` : "";
    },
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add src/ui
git commit -m "feat: add airport search and picker control"
```

---

### Task 19: Slider and destination list

**Files:**
- Create: `src/ui/slider.ts`, `src/ui/list.ts`
- Test: `src/ui/format.test.ts`, `src/ui/format.ts`

**Interfaces:**
- Consumes: Task 13 `MIN_MINUTES`/`MAX_MINUTES`/`STEP_MINUTES`, Task 11 `Reachable`, Task 10 `Airport`
- Produces: `formatDuration(minutes: number): string`; `createSlider(opts: { value: number; onChange: (minutes: number) => void }): { el: HTMLElement; setValue(m: number): void }`; `createList(opts: { onHover: (airport: number | null) => void; onSelect: (airport: number) => void }): { el: HTMLElement; update(args: { airports: Airport[]; a: Reachable[]; b: Reachable[]; shared: Set<number>; labelA: string; labelB: string | null }): void }`

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/format.test.ts
import { expect, test } from "vitest";
import { formatDuration } from "./format.js";

test("formats whole hours", () => {
  expect(formatDuration(180)).toBe("3h 00m");
});

test("formats hours and minutes", () => {
  expect(formatDuration(195)).toBe("3h 15m");
});

test("formats under an hour", () => {
  expect(formatDuration(45)).toBe("45m");
});

test("formats the slider maximum", () => {
  expect(formatDuration(480)).toBe("8h 00m");
});

test("pads single-digit minutes", () => {
  expect(formatDuration(125)).toBe("2h 05m");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/format.test.ts`
Expected: FAIL — cannot resolve `./format.js`.

- [ ] **Step 3: Write `src/ui/format.ts`**

```ts
// src/ui/format.ts
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, "0")}m`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/format.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write `src/ui/slider.ts`**

```ts
// src/ui/slider.ts
import { MAX_MINUTES, MIN_MINUTES, STEP_MINUTES } from "../state/url.js";
import { formatDuration } from "./format.js";

export function createSlider(opts: { value: number; onChange: (minutes: number) => void }) {
  const el = document.createElement("div");
  el.className = "slider";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "Max flight time";

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(MIN_MINUTES);
  input.max = String(MAX_MINUTES);
  input.step = String(STEP_MINUTES);
  input.value = String(opts.value);
  input.setAttribute("aria-label", "Maximum flight time in minutes");

  const readout = document.createElement("div");
  readout.className = "readout";
  readout.textContent = formatDuration(opts.value);

  // Fires on every drag frame; the reach query is sub-millisecond so no debounce.
  input.addEventListener("input", () => {
    const m = Number(input.value);
    readout.textContent = formatDuration(m);
    opts.onChange(m);
  });

  el.append(label, input, readout);
  return {
    el,
    setValue(m: number) { input.value = String(m); readout.textContent = formatDuration(m); },
  };
}
```

- [ ] **Step 6: Write `src/ui/list.ts`**

```ts
// src/ui/list.ts
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { formatDuration } from "./format.js";

export function createList(opts: {
  onHover: (airport: number | null) => void;
  onSelect: (airport: number) => void;
}) {
  const el = document.createElement("div");
  el.className = "list";

  function section(title: string, rows: Reachable[], airports: Airport[]) {
    const wrap = document.createElement("section");
    const h = document.createElement("div");
    h.className = "label";
    h.textContent = `${title} · ${rows.length}`;
    wrap.appendChild(h);
    for (const r of rows) {
      const ap = airports[r.airport];
      if (!ap) continue;
      const row = document.createElement("button");
      row.className = "row";
      row.type = "button";
      row.innerHTML =
        `<span>${ap.city || ap.name} <em>${ap.iata}</em>${r.seasonal ? ' <i class="tag">seasonal</i>' : ""}</span>` +
        `<span class="mut">${formatDuration(r.minutes)}</span>`;
      row.addEventListener("mouseenter", () => opts.onHover(r.airport));
      row.addEventListener("mouseleave", () => opts.onHover(null));
      row.addEventListener("click", () => opts.onSelect(r.airport));
      wrap.appendChild(row);
    }
    return wrap;
  }

  return {
    el,
    update({ airports, a, b, shared, labelA, labelB }: {
      airports: Airport[]; a: Reachable[]; b: Reachable[];
      shared: Set<number>; labelA: string; labelB: string | null;
    }) {
      el.replaceChildren();
      if (!labelB) {
        if (a.length === 0) {
          const p = document.createElement("p");
          p.className = "empty";
          p.textContent = "No nonstop destinations within this flight time.";
          el.appendChild(p);
          return;
        }
        el.appendChild(section(`From ${labelA}`, a, airports));
        return;
      }
      el.appendChild(section("Reachable from both", a.filter((r) => shared.has(r.airport)), airports));
      el.appendChild(section(`${labelA} only`, a.filter((r) => !shared.has(r.airport)), airports));
      el.appendChild(section(`${labelB} only`, b.filter((r) => !shared.has(r.airport)), airports));
    },
  };
}
```

- [ ] **Step 7: Commit**

```bash
git add src/ui
git commit -m "feat: add flight-time slider and destination list"
```

---

### Task 20: Panel shell and styles

**Files:**
- Create: `src/ui/panel.ts`, `src/styles.css`
- Modify: `index.html` (add the stylesheet link)

**Interfaces:**
- Consumes: Tasks 18, 19 controls
- Produces: `createPanel(children: HTMLElement[]): HTMLElement`

Spec §7.6: the desktop rail and the mobile sheet are **one component that reflows**, driven by a media query, with two snap points on mobile.

- [ ] **Step 1: Write `src/ui/panel.ts`**

```ts
// src/ui/panel.ts

/**
 * One component, two presentations: a fixed left rail on wide viewports and a
 * draggable two-snap bottom sheet on narrow ones. The snap state is a class on
 * the element; the media query decides whether it means anything.
 */
export function createPanel(children: HTMLElement[]): HTMLElement {
  const el = document.createElement("aside");
  el.className = "panel snap-low";

  const grab = document.createElement("div");
  grab.className = "grab";
  grab.setAttribute("role", "button");
  grab.setAttribute("aria-label", "Expand or collapse the panel");
  grab.tabIndex = 0;

  const toggle = () => el.classList.toggle("snap-high");
  grab.addEventListener("click", toggle);
  grab.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { toggle(); e.preventDefault(); }
  });

  let startY = 0;
  grab.addEventListener("pointerdown", (e) => { startY = e.clientY; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener("pointerup", (e) => {
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 24) el.classList.toggle("snap-high", dy < 0);
  });

  el.append(grab, ...children);
  return el;
}
```

- [ ] **Step 2: Write `src/styles.css`**

```css
:root {
  --ocean: #dceaf2;
  --land: #f2f0eb;
  --border: #b3ada2;
  --ink: #1a1a1a;
  --muted: #8d877c;
  --panel: #fff;
  --hairline: #e6e3de;
  --a: #d94f45;
  --b: #2b6cb0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body { background: var(--ocean); color: var(--ink); overflow: hidden; }

#app { display: flex; height: 100dvh; }
.map { position: relative; flex: 1; min-width: 0; }
.map canvas, .map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.map svg { pointer-events: none; }

.panel {
  width: 320px; flex: 0 0 320px; background: var(--panel);
  border-right: 1px solid var(--hairline); padding: 18px 16px;
  overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
}
.panel .grab { display: none; }

.brand { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 12px; }

.picker { position: relative; display: flex; align-items: center; gap: 8px;
  background: #f4f3f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; }
.picker .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.picker input { flex: 1; border: 0; background: transparent; font: inherit; font-size: 13px; outline: none; min-width: 0; }
.results { position: absolute; z-index: 10; top: 100%; left: 0; right: 0; margin: 4px 0 0;
  padding: 4px; list-style: none; background: #fff; border: 1px solid var(--hairline);
  border-radius: 8px; box-shadow: 0 8px 24px rgba(20,30,45,.14); max-height: 260px; overflow-y: auto; }
.results li { padding: 7px 8px; border-radius: 6px; font-size: 13px; cursor: pointer;
  display: flex; gap: 8px; align-items: baseline; }
.results li.active, .results li:hover { background: #f1efeb; }
.results em { margin-left: auto; color: var(--muted); font-style: normal; font-size: 11px; }

.label { font-size: 10px; letter-spacing: .09em; text-transform: uppercase;
  color: var(--muted); margin: 14px 0 6px; }
.slider input[type="range"] { width: 100%; accent-color: var(--ink); }
.readout { font-size: 20px; font-weight: 600; letter-spacing: -.02em; }

.list { margin-top: 8px; }
.row { display: flex; justify-content: space-between; gap: 10px; width: 100%;
  padding: 7px 4px; border: 0; border-bottom: 1px solid #efedea; background: none;
  font: inherit; font-size: 13px; text-align: left; cursor: pointer; color: inherit; }
.row:hover { background: #faf9f7; }
.row em { color: var(--muted); font-style: normal; font-size: 11px; }
.row .mut, .empty { color: var(--muted); }
.tag { font-style: normal; font-size: 10px; color: var(--muted);
  border: 1px solid var(--hairline); border-radius: 4px; padding: 0 4px; }
.empty { font-size: 13px; }

.footer { margin-top: auto; padding-top: 16px; font-size: 10px; color: var(--muted); line-height: 1.5; }
.footer a { color: inherit; }

@media (max-width: 760px) {
  #app { flex-direction: column; }
  .map { flex: 1; }
  .panel {
    position: fixed; left: 0; right: 0; bottom: 0; width: auto; flex: none;
    border-right: 0; border-radius: 16px 16px 0 0;
    box-shadow: 0 -6px 22px rgba(20,30,45,.16);
    padding: 8px 16px 20px; max-height: 82dvh;
    transition: height .22s ease;
  }
  .panel.snap-low { height: 42dvh; }
  .panel.snap-high { height: 82dvh; }
  .panel .grab { display: block; width: 36px; height: 4px; background: #d8d4cd;
    border-radius: 2px; margin: 4px auto 10px; touch-action: none; cursor: grab; }
  .brand { display: none; }
}
```

- [ ] **Step 3: Confirm the stylesheet is imported exactly once**

`src/main.ts` imports `./styles.css` (Task 21). Do **not** also add a
`<link rel="stylesheet">` to `index.html` — that would load the styles twice.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panel.ts src/styles.css index.html
git commit -m "feat: add reflowing panel shell and styles"
```

---

### Task 21: Wire the application together

**Files:**
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: every module from Tasks 10–20
- Produces: a working app

- [ ] **Step 1: Write `src/main.ts`**

```ts
// src/main.ts
import "./styles.css";
import { loadDataset } from "./data/bundle.js";
import { reachable, sharedDestinations, type Reachable } from "./reach/query.js";
import { COLORS, createProjection } from "./geo/projection.js";
import { drawBasemap } from "./render/basemap.js";
import { drawReach, type Layer } from "./render/arcs.js";
import { renderLabels, type CountryLabel } from "./render/labels.js";
import { createPicker } from "./ui/picker.js";
import { createSlider } from "./ui/slider.js";
import { createList } from "./ui/list.js";
import { createPanel } from "./ui/panel.js";
import { parseState, toSearch, type AppState } from "./state/url.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

const mapEl = document.createElement("div");
mapEl.className = "map";
const canvas = document.createElement("canvas");
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
mapEl.append(canvas, svg);

const [dataset, world, labels] = await Promise.all([
  loadDataset(),
  fetch("/world.json").then((r) => r.json()) as Promise<GeoJSON.FeatureCollection>,
  fetch("/labels.json").then((r) => r.json()) as Promise<CountryLabel[]>,
]);

let state: AppState = parseState(location.search);

const brand = document.createElement("div");
brand.className = "brand";
brand.textContent = "fly.eric.fun";

const pickerA = createPicker({
  airports: dataset.airports, slot: "a", color: COLORS.originA,
  onSelect: (iata) => { state = { ...state, a: iata }; commit(); },
});
const pickerB = createPicker({
  airports: dataset.airports, slot: "b", color: COLORS.originB,
  onSelect: (iata) => { state = { ...state, b: iata }; commit(); },
});
const slider = createSlider({
  value: state.minutes,
  onChange: (minutes) => { state = { ...state, minutes }; commit(); },
});
const list = createList({
  onHover: (airport) => { highlight = airport; draw(); },
  onSelect: () => {},
});

const footer = document.createElement("div");
footer.className = "footer";
footer.textContent = "Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports";

const panel = createPanel([brand, pickerA.el, pickerB.el, slider.el, list.el, footer]);
app.append(panel, mapEl);

let highlight: number | null = null;

function currentLayers(): { layers: Layer[]; ra: Reachable[]; rb: Reachable[]; shared: Set<number> } {
  const ia = state.a ? dataset.index.get(state.a) : undefined;
  const ib = state.b ? dataset.index.get(state.b) : undefined;
  const opts = { yearRoundOnly: state.yearRoundOnly };
  const ra = ia === undefined ? [] : reachable(dataset, ia, state.minutes, opts);
  const rb = ib === undefined ? [] : reachable(dataset, ib, state.minutes, opts);
  const shared = ia !== undefined && ib !== undefined ? sharedDestinations(ra, rb) : new Set<number>();

  const layers: Layer[] = [];
  if (ia !== undefined) layers.push({ origin: dataset.airports[ia]!, destinations: ra, color: COLORS.originA });
  if (ib !== undefined) layers.push({ origin: dataset.airports[ib]!, destinations: rb, color: COLORS.originB });
  return { layers, ra, rb, shared };
}

function draw(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = mapEl.clientWidth;
  const h = mapEl.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const projection = createProjection(w, h);
  drawBasemap(ctx, world, projection, w, h);
  renderLabels(svg, labels, projection, 1);

  const { layers, ra, rb, shared } = currentLayers();
  drawReach(ctx, projection, dataset.airports, layers, shared);

  if (highlight !== null) {
    const ap = dataset.airports[highlight];
    const xy = ap && projection([ap.lon, ap.lat]);
    if (xy) {
      ctx.strokeStyle = COLORS.shared;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  list.update({
    airports: dataset.airports, a: ra, b: rb, shared,
    labelA: state.a ?? "", labelB: state.b,
  });
}

function commit(): void {
  history.replaceState(null, "", toSearch(state));
  draw();
}

window.addEventListener("resize", draw);
window.addEventListener("popstate", () => {
  state = parseState(location.search);
  pickerA.setValue(state.a);
  pickerB.setValue(state.b);
  slider.setValue(state.minutes);
  draw();
});

pickerA.setValue(state.a);
pickerB.setValue(state.b);
draw();
```

- [ ] **Step 2: Enable top-level await in the build**

`src/main.ts` uses top-level `await`. Confirm `vite.config.ts` targets `es2022` (Task 1 Step 3 already sets this). If the build errors, that is the cause.

- [ ] **Step 3: Run the app**

Run: `npm run dev`

Manually verify:
- The map draws with a blue ocean, warm land, visible borders and country labels.
- Typing `BER` in the first field and selecting it draws red arcs.
- Adding `LIS` in the second draws blue arcs and near-black shared dots.
- Dragging the slider updates instantly with no stutter.
- The URL updates to `?a=BER&b=LIS&t=180`; reloading restores the same view.
- Narrowing the window below 760px turns the rail into a bottom sheet; the grab handle toggles the tall snap point.

- [ ] **Step 4: Run the whole test suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: wire map, pickers, slider and list into the app"
```

---

### Task 22: Deployment and scheduled refresh

**Files:**
- Create: `.github/workflows/refresh.yml`, `.github/workflows/ci.yml`, `README.md`
- Modify: `wrangler.jsonc` (confirm the assets directory)

**Interfaces:**
- Consumes: Tasks 8, 9, 14 scripts
- Produces: CI on push, a monthly data refresh, a deployable site

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "npm" }
      - run: npm ci
      - run: npm test
      - run: npx tsc --noEmit
      - run: npm run build
```

- [ ] **Step 2: Write `.github/workflows/refresh.yml`**

```yaml
name: refresh-data
on:
  schedule:
    - cron: "0 4 1 * *"   # 04:00 UTC on the 1st of each month
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "npm" }
      - run: npm ci
      - run: npm run crawl -- --all
      - run: npm run basemap
      # Fails the job if coverage drops below 85% or counts drift over 5%.
      - run: npm run bundle
      - run: npm test
      - name: Commit refreshed bundle
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/airports.json public/routes.bin
          git diff --staged --quiet || git commit -m "chore: monthly route data refresh"
          git push
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 3: Write `README.md`**

````markdown
# fly.eric.fun

A minimal world map showing every nonstop destination reachable from one or two
airports within a given flight time.

## Development

```bash
npm install
npm run dev
```

The committed bundle in `public/` means a fresh clone runs with full data — no
crawl required.

## Rebuilding the data

```bash
npm run crawl -- --all     # ~80 requests, ~4 minutes
npm run basemap            # Natural Earth basemap + country labels
npm run bundle             # compile data/raw/ -> public/
```

Refresh a few airports during development:

```bash
npm run crawl -- IST,BKK
npm run bundle
```

## Data and licensing

- Route network: **Wikipedia** airport "Airlines and destinations" tables,
  **CC BY-SA 4.0**. The generated `public/routes.bin` and `public/airports.json`
  are derivative works and carry the same licence.
- Airport metadata: **OurAirports**, public domain.
- Airport identifiers: **Wikidata** (`P238`), CC0.
- Basemap: **Natural Earth**, public domain.

Flight durations are **estimated**, not sourced: `0.66 + km / 790` hours,
calibrated to within 14 minutes over the 0.5–8h range. See the design spec for
limitations.

## Deployment

```bash
npm run build
npm run deploy
```
````

- [ ] **Step 4: Verify the production build**

Run: `npm run build`
Expected: `dist/` contains `index.html`, hashed JS/CSS, and the copied `airports.json`, `routes.bin`, `world.json`, `labels.json`.

```bash
ls dist/
```

- [ ] **Step 5: Commit**

```bash
git add .github README.md wrangler.jsonc
git commit -m "ci: add test workflow, monthly data refresh and deploy config"
```

---

## Self-Review Notes

Spec coverage check — every section maps to a task:

| Spec section | Tasks |
|---|---|
| §3.1 OurAirports | 4 |
| §3.2 Wikidata | 5 |
| §3.3 Wikipedia tables | 6, 7 |
| §3.5 Licensing / footer | 21 (footer), 22 (README) |
| §4.1 CLI | 8, 9 |
| §4.2 Crawl mechanics (`redirects=1`, batch 50, User-Agent) | 8, plus the LHR regression test in 7 |
| §4.3 Parsing, seasonal/charter flags | 6 |
| §4.4 Bundle format and gates | 9 |
| §5 Duration model | 3 |
| §6 Runtime architecture, modules | 10–21 |
| §7.1 Selection | 18 |
| §7.2 Slider | 19 |
| §7.3 Rendering, projection, antimeridian | 12, 15, 16 |
| §7.4 Visual design tokens | 15, 20 |
| §7.5 Destination list (hover-to-highlight) | 19, 21 |
| §7.5 click-to-pan | **Deferred — see below** |
| §7.6 Mobile sheet | 20 |
| §7.7 Empty states | 19 |
| §8 Testing | 3, 6, 7, 9, 11, 12 |
| §9 Deployment | 22 |

### Known deferral: pan and zoom

Spec §7.5 says clicking a list row "pans the map to it", and §7.4 says label
density varies with zoom. **Neither is implemented by Tasks 1–22** — the map
renders at a single fixed extent, `renderLabels` is always called with
`zoom = 1`, and `createList`'s `onSelect` is a no-op. Hover-to-highlight *is*
implemented.

This is a deliberate deferral, not an oversight: a pan/zoom layer is its own
piece of work (pointer and wheel handling, touch pinch, a transform threaded
through both the canvas projection and the SVG overlay, and re-tuning arc
stroke widths per zoom level). Everything needed for it is already
parameterised — `visibleLabels(labels, zoom)` takes a zoom argument, and
`createProjection(width, height)` is the single place a transform would apply.

Add it as **Task 23** in a follow-up plan once Tasks 1–22 are working and the
real data is on screen. Do not let it expand Task 21.
