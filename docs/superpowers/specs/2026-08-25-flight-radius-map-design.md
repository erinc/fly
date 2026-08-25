# fly.eric.fun — Flight Radius Map

**Date:** 2026-08-25
**Status:** Approved design, ready for implementation planning

## 1. Overview

A single-page web app showing a minimal world map. The user selects one or two
airports and drags a slider for maximum flight time. The map draws every
nonstop destination reachable within that time from each selected airport.

With two airports selected the two reach sets are overlaid, each in its own
colour, and destinations reachable from both are emphasised.

Hosted as a fully static bundle on Cloudflare. No server, no API keys, no
runtime cost.

### Goals

- Answer "where can I fly nonstop in under N hours?" at a glance.
- Answer "where can we both fly nonstop in under N hours?" for two origins.
- Current route data, not a decade-old snapshot.
- Minimal, modern, intuitive. One screen, no navigation, no modals.
- Works on mobile.

### Non-goals

- Connecting itineraries. Direct flights only.
- Prices, schedules, seat availability, specific airlines.
- Real-time flight tracking.
- Accounts, persistence, server state.

## 2. Decisions

Settled during brainstorming:

| Decision | Choice |
|---|---|
| Two-airport semantics | Union / overlay, with shared destinations emphasised |
| Reachability | Direct nonstop flights only |
| Route data | Wikipedia destination tables (current), **not** OpenFlights |
| Data freshness | Static precomputed bundle, rebuilt monthly in CI |
| Visualisation | Great-circle arcs + destination dots |
| Map style | Light "Ink" base, visible country borders, blue ocean, dense country labels |
| Layout (desktop) | Left sidebar with pickers, slider and destination list |
| Layout (mobile) | Same component as a draggable bottom sheet with two snap points |
| Slider | 30–480 min (0.5–8h), 15-minute steps |
| Dataset scope | Always a full crawl; no partial-dataset UI states |

## 3. Data sources

### 3.1 Airport metadata — OurAirports

`https://davidmegginson.github.io/ourairports-data/airports.csv` (public domain).

Filtered to `scheduled_service = yes`, non-empty `iata_code`, and type in
`{large_airport, medium_airport, small_airport}`.

**Measured: 4,009 airports** (1,149 large, 2,093 medium, 767 small).

Provides: IATA code, ICAO, name, municipality, ISO country, latitude,
longitude, type.

### 3.2 Airport article titles — Wikidata

One SPARQL query returns every airport carrying an IATA code (`P238`) together
with its English Wikipedia article:

```sparql
SELECT ?iata ?art WHERE {
  ?a   wdt:P238 ?iata .
  ?art schema:about ?a ;
       schema:isPartOf <https://en.wikipedia.org/> .
}
```

**Measured: 8,350 rows in a single ~22s query.** Of the 4,009
scheduled-service airports, **3,956 (99%) have an article.**

This same IATA↔article mapping is used in reverse to resolve destination
wikilinks back to IATA codes.

### 3.3 Route network — Wikipedia

Each airport article's "Airlines and destinations" section, fetched as
wikitext, lists that airport's current nonstop destinations.

Measured coverage on a 42-airport stratified random sample:

| Airport size | Coverage |
|---|---|
| Large | 14/14 (100%) |
| Medium | 12/14 (86%) |
| Small | 12/14 (86%) |
| **Total** | **38/42 (90%)** |

Three of the four misses used the singular heading *"Airline and
destinations"*. Matching that variant too brings expected coverage to roughly
98%.

### 3.4 Why not the alternatives

| Source | Verdict |
|---|---|
| **OpenFlights `routes.dat`** | Rejected. Last commit 2017-02-02, substantive data from 2014. Verified: **BER has zero routes** (opened 2020); NQZ likewise. |
| **OpenSky Network** | Returns 403 anonymously; needs an account. Provides observed flights, not a route network — would require multi-day accumulation. |
| **Amadeus Self-Service** | Free tier is quota-limited with commercial terms. Reintroduces key management for no benefit here. |
| **Wikipedia XML dumps** | Unnecessary. Tens of GB versus a 4-minute, 80 MB batched API crawl (§4.2). Only worthwhile if the whole corpus were needed. |

### 3.5 Licensing and attribution

- **OurAirports** — public domain.
- **Wikidata** — CC0.
- **Wikipedia** — **CC BY-SA 4.0**. The derived route dataset is a derivative
  work and must carry attribution and share-alike terms.

Required UI footer:

> Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports

The repository must state that `public/routes.bin` and `public/airports.json`
are CC BY-SA 4.0.

## 4. Build pipeline

Crawl and bundle are decoupled. The crawler writes one file per origin
airport; the bundler compiles whatever is on disk into the shipped artifacts.

```
data/raw/<IATA>.json     # gitignored, one file per crawled origin
  ↓ bundle
public/airports.json     # committed
public/routes.bin        # committed
```

Committing the bundled output (~150 KB) means a fresh clone runs immediately
with full data and no crawl.

### 4.1 CLI

```bash
npm run crawl -- IST,BKK     # refresh specific origins (dev convenience)
npm run crawl -- --all       # full crawl, ~4 min
npm run crawl -- --stale 30d # refresh files older than 30 days
npm run crawl -- --force     # ignore freshness, refetch
npm run bundle               # compile data/raw/ -> public/
```

Crawling is resumable and idempotent; a re-run skips fresh files unless
`--force`. The shipped bundle always represents a complete crawl.

### 4.2 Crawl mechanics

Articles are fetched **50 titles per request** with full wikitext:

```
action=query&format=json&formatversion=2
&prop=revisions&rvprop=content&rvslots=main
&redirects=1
&titles=A|B|C…
```

**Measured: 3 batches of 50 averaged ~2.8s and ~1.0 MB each**, projecting to
**80 requests, ~4 minutes, ~80 MB** for all 3,956 airports.

Two mandatory details, both discovered the hard way during research:

1. **`redirects=1` is required.** Without it, redirect titles resolve to empty
   stubs. This silently made Heathrow appear to have no destinations.
2. **Resolve titles via Wikidata, never by matching OurAirports names.**
   Name matching produced spurious "no article" results across the sample.

A descriptive `User-Agent` with contact details is required by Wikimedia's
policy. Requests are rate-limited politely and raw responses cached so re-runs
are incremental.

### 4.3 Parsing

For each article, locate the section whose heading matches
`/airlines? and destinations/i`, then extract wikilinks from the destination
cells and resolve them to IATA codes via the Wikidata map. Links that resolve
to airlines rather than airports simply have no `P238` and drop out — the
resolution step doubles as the filter.

**Measured on BER: 248 wikilinks → 136 IATA destinations**, including DWC, SPX,
EBL, BGW and DAM. The same airport has zero routes in OpenFlights.

Wikipedia's existing status markup is parsed and **flagged, not discarded**
(BER alone carries 25 seasonal markers):

- `seasonal` → `seasonal: true`
- `begins <date>` → future route, excluded until that date
- `ends <date>` → excluded after that date
- `charter` → `charter: true`

The UI offers a "year-round only" toggle driven by these flags.

### 4.4 Bundle format

- **`airports.json`** — only airports appearing in at least one route. IATA,
  name, city, country, lat, lon.
- **`routes.bin`** — flat typed array, one record per undirected pair:
  origin index (`Uint16`), destination index (`Uint16`), duration in minutes
  (`Uint16`), flags (`Uint8`). Expected well under 200 KB raw, comfortably
  under 50 KB gzipped.

The bundle step **fails the build** on any of the following, which together
catch Wikipedia format changes before they ship:

- Fewer than **85%** of crawled articles yield a destinations section
  (expected ~98%; §3.3).
- Airport count or route-pair count moves more than **5%** against the
  previously committed bundle.
- Any airport in the bundle has no coordinates.

`--force-bundle` overrides these when a large change is known-good.

## 5. Flight duration model

Wikipedia lists destinations, not durations. Duration is computed from
geometry using a model calibrated against real published block times.

```
duration_hours = 0.66 + great_circle_km / 790
```

`0.66h` (~40 min) is fixed overhead: taxi out, climb, descent, taxi in.
`790 km/h` is effective cruise speed inclusive of those phases.

Fitted specifically for the 0.5–8h slider range. **Maximum error 14 minutes**
across 11 real routes; most within 6.

| Route | km | Actual | Model | Error |
|---|---|---|---|---|
| FRA–MUC | 299 | 1.08 | 1.04 | −0.04 |
| LHR–CDG | 348 | 1.33 | 1.10 | −0.23 |
| MAD–BCN | 483 | 1.33 | 1.27 | −0.06 |
| SYD–MEL | 705 | 1.50 | 1.55 | +0.05 |
| BER–LHR | 932 | 1.83 | 1.84 | +0.01 |
| ORD–DEN | 1476 | 2.75 | 2.53 | −0.22 |
| LAX–SEA | 1544 | 2.83 | 2.61 | −0.22 |
| HKG–NRT | 2890 | 4.08 | 4.32 | +0.24 |
| JFK–LAX | 3974 | 5.92 | 5.69 | −0.23 |
| DXB–LHR | 5500 | 7.50 | 7.62 | +0.12 |
| LHR–JFK | 5555 | 7.54 | 7.69 | +0.15 |

### Known limitations

- It is a **model, not schedule data**. A given airline's published time may
  differ by 10–20 minutes.
- It is **symmetric** and cannot represent jet-stream asymmetry. Real LHR–JFK
  is roughly an hour longer westbound.
- Accuracy degrades at ultra-long-haul. The worst outlier in the full fit was
  SYD–LAX at 54 minutes — outside the 8h slider range, which is part of why
  the cap helps.

Real per-route durations would require commercial schedule data (Amadeus,
Cirium, OAG), reintroducing keys, quotas and cost for marginal accuracy on a
browsing tool. Explicitly out of scope.

## 6. Runtime architecture

Static bundle on **Cloudflare Workers Static Assets**. No Worker logic, no
database, no API.

- **Vanilla TypeScript + Vite.** The app is one map, one slider and one list;
  a framework would be more bundle than logic.
- **d3-geo** for projection and great-circle maths, drawn to **`<canvas>`**.
  SVG cannot redraw thousands of arcs per slider frame; canvas can.
- **Thin SVG overlay** for country labels and origin markers, so text stays
  crisp and hit-testing is simple.
- **Basemap: Natural Earth 110m**, simplified paths baked into the bundle
  (~120 KB). No tile server; works offline.
- **State lives entirely in the URL**: `?a=BER&b=LIS&t=180`. Shareable,
  back-button works, no store required.

### Modules

| Module | Responsibility |
|---|---|
| `data/` | Load and decode `airports.json` + `routes.bin` |
| `geo/` | Projection, great-circle interpolation, duration model |
| `reach/` | Reachability queries over the adjacency structure |
| `render/` | Canvas drawing of basemap, arcs and dots |
| `ui/` | Sidebar / bottom sheet, pickers, slider, list |

Each is independently testable with no dependency on the others' internals.

### Performance

Reachability is a filtered scan over one airport's adjacency list —
sub-millisecond. The slider updates on every drag frame with no debounce.

## 7. Interface

### 7.1 Selection

Two slots, **A** and **B**. B is optional throughout; one airport is a
first-class state, not a half-finished one.

- Search field matches IATA code, city, airport name and country.
  Keyboard-navigable.
- Clicking a dot on the map fills the next empty slot.
- Each slot has clear and swap controls.

### 7.2 Slider

30–480 minutes, 15-minute steps. Live update on drag. Current value shown as
`3h 00m`.

### 7.3 Map rendering

- A's arcs warm red (`#d94f45`), B's blue (`#2b6cb0`), drawn beneath the dots.
- Destinations reachable from **both** get a larger near-black dot.
- Origin markers are a filled dot with a ring, in the slot's colour.
- Small legend keyed to the slot colours.

**Projection: Equal Earth** (`d3.geoEqualEarth`). Note this differs from the
approved mockups, which used equirectangular; Equal Earth keeps the same
minimal character with markedly less polar distortion. Straightforward to
revert.

Two rendering requirements, being the usual sources of broken map bugs:

1. Arcs crossing the **antimeridian** must be split into two paths, or they
   draw a stripe across the map.
2. Arcs are **interpolated along the great circle and then projected** — never
   drawn as a straight line in screen space.

### 7.4 Visual design

| Element | Value |
|---|---|
| Ocean | `#dceaf2` |
| Land | `#f2f0eb` |
| Country borders | `#b3ada2`, 0.45px |
| Country labels | `#9a948a`, uppercase, letter-spaced, beneath the arcs |
| Origin A | `#d94f45` |
| Origin B | `#2b6cb0` |
| Shared destination | `#111` |

Country label density thins out or fills in with zoom level.

### 7.5 Destination list

Three sections: **Both** (with each leg's time), **A only**, **B only**. Each
row shows city, IATA code and duration. Hovering a row highlights its arc;
clicking pans the map to it.

### 7.6 Mobile

The desktop left rail and the mobile bottom sheet are **one component that
reflows**, not two designs. The sheet is draggable with two snap points:

- **Resting** — airport chips, slider, counts. Map keeps most of the screen
  and the slider falls under the thumb.
- **Raised** — additionally reveals the destination list.

### 7.7 Empty and edge states

Stated plainly rather than rendering a blank map:

- No destinations under the current threshold.
- An airport whose table parsed but yielded nothing.
- An airport absent from the route network entirely.

## 8. Testing

- **Duration model** — the 11 real block times in §5 as a locked regression
  test, asserting every prediction stays within 15 minutes.
- **Wikitext parser** — fixture tests from saved real articles: BER (dense,
  many seasonal markers), Heathrow (the redirect case), and a sparse regional
  airport. Parser changes cannot silently gut coverage.
- **Reachability** — unit tests over a small synthetic graph.
- **Bundle** — build fails on coverage or count regressions (§4.4).
- **Geo** — antimeridian splitting, great-circle interpolation, projection
  round-trips.

## 9. Deployment

Vite build → Cloudflare Workers Static Assets via Wrangler.

A **monthly GitHub Actions cron** runs the full crawl, re-bundles, runs the
test suite, and deploys only if it passes.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Wikipedia table format drifts | Fixture tests + bundle count thresholds fail the build |
| Coverage gaps at small airports | ~98% expected; empty states are explicit |
| Wikipedia data is community-edited and may contain errors | Accepted; far better than a 2014 snapshot |
| Duration model imprecision | Bounded at 14 min in range, documented in UI-adjacent copy |
| CC BY-SA obligations | Attribution in footer and repository |

## 11. Appendix — measured figures

All figures verified on 2026-08-25:

- OurAirports scheduled-service airports with IATA: **4,009**
- Of those, with an English Wikipedia article: **3,956 (99%)**
- Wikidata IATA→article rows, one query: **8,350** in ~22s
- Destination-table coverage, 42-airport stratified sample: **90%** (98%
  expected after matching the singular heading variant)
- BER destinations parsed from Wikipedia: **136**
- BER routes in OpenFlights: **0**
- Full crawl projection: **80 requests, ~4 min, ~80 MB**
- OpenFlights `routes.dat` last commit: **2017-02-02**
