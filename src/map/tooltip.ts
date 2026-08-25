import type { Airport } from "../data/bundle.js";
import { formatDuration } from "../ui/format.js";

export type OriginLeg = { iata: string; minutes: number };

/**
 * Plain-text tooltip lines: a heading, then the duration of each route that
 * reaches this destination. A single route does not repeat its origin; when
 * several selected origins share a destination, compact origin codes disambiguate
 * their durations. Returned as strings so the caller inserts text nodes only.
 */
export function tooltipLines(dest: Airport, legs: OriginLeg[]): string[] {
  const label = dest.city || dest.name;
  const showOrigins = legs.length > 1;
  return [
    `${label} (${dest.iata})`,
    ...legs.map((l) =>
      showOrigins ? `${l.iata} ${formatDuration(l.minutes)}` : formatDuration(l.minutes),
    ),
  ];
}
