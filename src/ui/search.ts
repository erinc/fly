// src/ui/search.ts
import type { Airport, Metro } from "../data/bundle.js";

export type SearchOption =
  | { kind: "airport"; airport: Airport }
  | { kind: "metro"; metro: Metro };

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

function metroScore(metro: Metro, q: string): number {
  const city = metro.city.toLowerCase();
  const codes = metro.codes.map((code) => code.toLowerCase());
  if (city === q) return -1;
  if (codes.includes(q)) return 0.5;
  if (city.startsWith(q)) return 0.5;
  if (city.includes(q)) return 3.5;
  return Infinity;
}

export function searchOptions(
  airports: Airport[],
  metros: Metro[],
  query: string,
  limit = 8,
): SearchOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [
    ...airports.map((airport) => ({
      option: { kind: "airport", airport } as SearchOption,
      score: score(airport, q),
      label: airport.iata,
    })),
    ...metros.map((metro) => ({
      option: { kind: "metro", metro } as SearchOption,
      score: metroScore(metro, q),
      label: metro.city,
    })),
  ]
    .filter((entry) => entry.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((entry) => entry.option);
}
