import { writeFileSync } from "node:fs";
import { fetchBatch } from "../../wiki.js";

// The three articles are the spec's §8 set:
// - BER: dense article, many seasonal markers, and proves data currency
//   (BER opened in 2020 and has zero routes in the older open datasets).
// - LHR: requested by its redirect title "London Heathrow Airport" (not
//   "Heathrow Airport") to guard the redirects=1 requirement — without it
//   the article resolves to an empty stub.
// - EEK: a sparse regional airport, to prove the parser doesn't throw on
//   thin articles.
const PAGES: Record<string, string> = {
  BER: "Berlin Brandenburg Airport",
  LHR: "London Heathrow Airport",
  EEK: "Eek Airport",
};

const pages = await fetchBatch(Object.values(PAGES));

for (const [iata, title] of Object.entries(PAGES)) {
  // Look up by the title we requested — fetchBatch/extractPages already
  // resolves normalization and redirects, so no hand-rolled title matching.
  const content = pages.get(title);
  if (!content) throw new Error(`no content for ${title}`);
  writeFileSync(new URL(`./${iata}.wikitext`, import.meta.url), content);
  console.log(`${iata}: ${content.length} chars`);
}
