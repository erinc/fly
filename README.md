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
npm run crawl -- --all     # ~80 batched requests, ~4 minutes
npm run basemap            # Natural Earth basemap + country labels
npm run bundle             # compile data/raw/ -> public/
```

Refresh a few airports during development:

```bash
npm run crawl -- IST,BKK
npm run bundle
```

The current dataset has **3,615 airports** and **32,276 route pairs**;
`public/routes.bin` is about 226 KB. Of crawled Wikipedia articles, **86.5%**
yield a destinations section — the shortfall from higher estimates is real,
not a parser bug: a number of small airports simply have no destinations
table on Wikipedia.

`npm run bundle` gates the refresh: it fails if coverage drops below 85%, or
if the airport or route-pair count drifts more than 5% from the last
committed bundle. There's a `--force-bundle` override for intentionally
replacing the baseline, but the scheduled CI refresh never passes it — a
tripped drift gate should fail loudly so a human looks, not silently
overwrite the dataset.

## Data and licensing

- Route network: **Wikipedia** airport "Airlines and destinations" tables,
  **CC BY-SA 4.0**. The generated `public/routes.bin` and `public/airports.json`
  are derivative works and carry the same licence.
- Airport metadata: **OurAirports**, public domain.
- Airport identifiers: **Wikidata** (`P238`), CC0.
- Basemap: **Natural Earth**, public domain.

Flight durations are **estimated**, not sourced: `0.66 + km / 790` hours,
calibrated to within 14 minutes over the 0.5–8h range. See the design spec for
further detail.

## Known limitations

- **Military co-location.** A small number of IATA codes resolve via
  Wikidata to a co-located military article instead of the civil airport, so
  those airports are missing routes. Confirmed cases: `HNL` resolves to
  "Joint Base Pearl Harbor–Hickam" rather than "Daniel K. Inouye
  International Airport"; `BGO` → "Flesland Air Station"; `ZAZ` → "Zaragoza
  Air Base". The obvious fix is a small manual override map from IATA code to
  the correct Wikipedia article; not yet implemented.
- **Interactive map.** The map is a Leaflet surface: pan, zoom, hover
  tooltips on destination dots, and auto-focus on selection changes are all
  supported, and label density adapts to zoom level. Up to three airports
  can be compared at once, each drawn in its own colour.

## Deployment

```bash
npm run build
npm run deploy
```

CI (`.github/workflows/ci.yml`) runs on every push and pull request: tests,
typecheck, and a production build. A monthly scheduled workflow
(`.github/workflows/refresh.yml`) re-crawls Wikipedia, rebuilds the bundle,
commits `public/airports.json` and `public/routes.bin` if they changed, and
deploys to Cloudflare Workers via `wrangler-action`.

### Required repository secrets

The scheduled deploy will fail without these, configured under
**Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with Workers Scripts: Edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account to deploy into |

The refresh workflow also needs `contents: write` permission to push the
regenerated bundle back to the branch; this is already declared in the
workflow. If the 5% drift gate trips, the job fails on purpose — that means
the dataset moved more than expected and a human should look before it
ships. `--force-bundle` is deliberately not used in CI.
