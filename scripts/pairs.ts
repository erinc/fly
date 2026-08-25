import { FLAG_CHARTER, FLAG_SEASONAL } from "../src/data/format.js";
import type { AirportRow } from "./sources/ourairports.js";
import type { Destination } from "./parse/destinations.js";

export type PairDoc = { iata: string; destinations: Destination[] };

export type Pair = { a: string; b: string; flags: number };

/**
 * Collects undirected airport pairs from per-airport crawl docs, keeping the
 * strongest claim about each route. Endpoints are stored sorted so the same
 * pair reported from either origin's page collapses to one entry, and when
 * the two origins disagree about seasonal/charter status the bitwise AND of
 * their flags wins — i.e. a route claimed year-round by either endpoint is
 * year-round (same rule for charter vs. scheduled).
 */
export function collectPairs(docs: PairDoc[], byIata: Map<string, AirportRow>): Map<string, Pair> {
  const pairs = new Map<string, Pair>();
  for (const doc of docs) {
    for (const d of doc.destinations) {
      if (!byIata.has(doc.iata) || !byIata.has(d.iata) || doc.iata === d.iata) continue;
      const [a, b] = [doc.iata, d.iata].sort() as [string, string];
      const key = `${a} ${b}`;
      const flags = (d.seasonal ? FLAG_SEASONAL : 0) | (d.charter ? FLAG_CHARTER : 0);
      const prev = pairs.get(key);
      if (prev) prev.flags &= flags;
      else pairs.set(key, { a, b, flags });
    }
  }
  return pairs;
}
