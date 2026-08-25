import { greatCircleKm } from "../src/geo/distance.js";

export const MAX_METRO_DISTANCE_KM = 125;

export type MetroAirport = {
  iata: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};

export type GeneratedMetro = {
  id: string;
  city: string;
  country: string;
  codes: string[];
};

/** Parenthetical qualifiers distinguish individual airports in the UI, but
 * the leading city remains the served-city name used for metro grouping. */
export function metroCity(city: string): string {
  return city.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Build connected airport clusters within each served city and country.
 * Proximity prevents unrelated same-name cities (for example the several
 * US cities named Jackson) from being merged. */
export function generateMetros(
  airports: MetroAirport[],
  maxDistanceKm = MAX_METRO_DISTANCE_KM,
): GeneratedMetro[] {
  const buckets = new Map<string, { city: string; country: string; airports: MetroAirport[] }>();
  for (const airport of airports) {
    const city = metroCity(airport.city);
    if (!city || !airport.country) continue;
    const key = `${city.toLowerCase()}\u0000${airport.country.toUpperCase()}`;
    const bucket = buckets.get(key) ?? { city, country: airport.country.toUpperCase(), airports: [] };
    bucket.airports.push(airport);
    buckets.set(key, bucket);
  }

  const metros: GeneratedMetro[] = [];
  for (const bucket of buckets.values()) {
    const unseen = new Set(bucket.airports.map((_, i) => i));
    while (unseen.size > 0) {
      const first = unseen.values().next().value as number;
      unseen.delete(first);
      const component = [first];
      for (let cursor = 0; cursor < component.length; cursor++) {
        const from = bucket.airports[component[cursor]!]!;
        for (const candidate of [...unseen]) {
          if (greatCircleKm(from, bucket.airports[candidate]!) <= maxDistanceKm) {
            unseen.delete(candidate);
            component.push(candidate);
          }
        }
      }

      const codes = component.map((i) => bucket.airports[i]!.iata).sort();
      if (codes.length < 2) continue;
      metros.push({
        id: `${slug(bucket.city)}-${bucket.country.toLowerCase()}-${codes.join("-").toLowerCase()}`,
        city: bucket.city,
        country: bucket.country,
        codes,
      });
    }
  }

  return metros.sort((a, b) =>
    a.city.localeCompare(b.city) || a.country.localeCompare(b.country) || a.id.localeCompare(b.id),
  );
}
