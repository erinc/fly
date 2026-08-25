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
