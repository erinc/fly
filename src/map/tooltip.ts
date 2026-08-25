import type { Airport } from "../data/bundle.js";
import { formatDuration } from "../ui/format.js";

export type OriginLeg = { iata: string; minutes: number };

/**
 * Plain-text tooltip lines: a heading, then one line per origin that reaches
 * this destination. Returned as strings so the caller can insert them as text
 * nodes — never as HTML.
 */
export function tooltipLines(dest: Airport, legs: OriginLeg[]): string[] {
  const label = dest.city || dest.name;
  return [
    `${label} (${dest.iata})`,
    ...legs.map((l) => `${l.iata} · ${formatDuration(l.minutes)}`),
  ];
}
