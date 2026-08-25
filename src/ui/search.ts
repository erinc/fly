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
