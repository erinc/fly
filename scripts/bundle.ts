import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { greatCircleKm } from "../src/geo/distance.js";
import { durationMinutes } from "../src/geo/duration.js";
import { decodeRoutes, encodeRoutes, type RouteRecord } from "../src/data/format.js";
import { parseAirportsCsv, type AirportRow } from "./sources/ourairports.js";
import type { Destination } from "./parse/destinations.js";
import { resolveCityName } from "./city-name.js";
import { collectPairs } from "./pairs.js";

const RAW = new URL("../data/raw/", import.meta.url);
const CACHE = new URL("../data/cache/", import.meta.url);
const PUBLIC = new URL("../public/", import.meta.url);
const force = process.argv.includes("--force-bundle");

const fail = (msg: string) => {
  if (force) {
    console.warn(`WARN (forced): ${msg}`);
    return;
  }
  console.error(`BUNDLE FAILED: ${msg}`);
  process.exit(1);
};

const airportsCsvPath = new URL("./airports.csv", CACHE);
if (!existsSync(airportsCsvPath)) {
  console.error(
    "BUNDLE FAILED: data/cache/airports.csv is missing. Run `npm run crawl` first " +
      "to fetch the OurAirports CSV and crawl Wikipedia destination tables.",
  );
  process.exit(1);
}
const csv = readFileSync(airportsCsvPath, "utf8");
const byIata = new Map<string, AirportRow>(parseAirportsCsv(csv).map((a) => [a.iata, a]));

if (!existsSync(RAW)) {
  console.error(
    "BUNDLE FAILED: data/raw/ does not exist. Run `npm run crawl -- --all` first " +
      "to crawl Wikipedia airport destination pages.",
  );
  process.exit(1);
}
const files = readdirSync(RAW).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error(
    "BUNDLE FAILED: data/raw/ is empty. Run `npm run crawl -- --all` first " +
      "to crawl Wikipedia airport destination pages.",
  );
  process.exit(1);
}

// Collect undirected pairs, keeping the strongest claim about each.
const docs: { iata: string; destinations: Destination[] }[] = [];
let withDestinations = 0;

for (const file of files) {
  const doc = JSON.parse(readFileSync(new URL(`./${file}`, RAW), "utf8")) as {
    iata: string;
    destinations: Destination[];
  };
  if (doc.destinations.length > 0) withDestinations++;
  docs.push(doc);
}

const pairs = collectPairs(docs, byIata);

const coverage = withDestinations / files.length;
console.log(`coverage: ${withDestinations}/${files.length} (${(coverage * 100).toFixed(1)}%)`);
if (coverage < 0.85) fail(`coverage ${(coverage * 100).toFixed(1)}% is below the 85% threshold`);

// Only airports that appear in at least one route are shipped.
const used = new Set<string>();
for (const p of pairs.values()) {
  used.add(p.a);
  used.add(p.b);
}
const airports = [...used].sort().map((iata) => byIata.get(iata)!);
const index = new Map(airports.map((a, i) => [a.iata, i]));

for (const a of airports) {
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) fail(`${a.iata} has no coordinates`);
}

// Route records store airport indices as Uint16, which silently wraps past
// 65535 rather than throwing — so the count must be checked explicitly here.
if (airports.length > 65535) fail(`${airports.length} airports exceeds the Uint16 index limit of 65535`);

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

// Drift gate against the previously committed bundle: airport count and
// route-pair count must each stay within 5% of the last committed bundle.
// Skipped entirely on a first run, when there is no previous bundle.
const prevAirportsPath = new URL("./airports.json", PUBLIC);
const prevRoutesPath = new URL("./routes.bin", PUBLIC);
if (existsSync(prevAirportsPath) && existsSync(prevRoutesPath)) {
  const prev = JSON.parse(readFileSync(prevAirportsPath, "utf8")) as { airports: unknown[] };
  const airportDrift = Math.abs(airports.length - prev.airports.length) / prev.airports.length;
  console.log(`airport count drift vs committed bundle: ${(airportDrift * 100).toFixed(1)}%`);
  if (airportDrift > 0.05) fail(`airport count moved ${(airportDrift * 100).toFixed(1)}% (>5%)`);

  const prevRoutesBuf = readFileSync(prevRoutesPath);
  const prevRoutes = decodeRoutes(
    prevRoutesBuf.buffer.slice(prevRoutesBuf.byteOffset, prevRoutesBuf.byteOffset + prevRoutesBuf.byteLength),
  );
  const routeDrift = Math.abs(routes.length - prevRoutes.count) / prevRoutes.count;
  console.log(`route-pair count drift vs committed bundle: ${(routeDrift * 100).toFixed(1)}%`);
  if (routeDrift > 0.05) fail(`route-pair count moved ${(routeDrift * 100).toFixed(1)}% (>5%)`);
} else {
  console.log("no previous bundle found — skipping drift gate (first run)");
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(
  new URL("./airports.json", PUBLIC),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    airports: airports.map((a) => [
      a.iata,
      a.name,
      resolveCityName(a.iata, a.city),
      a.country,
      a.lat,
      a.lon,
      a.size,
    ]),
  }),
);
writeFileSync(new URL("./routes.bin", PUBLIC), Buffer.from(encodeRoutes(routes)));
console.log(`wrote ${airports.length} airports, ${routes.length} routes`);
