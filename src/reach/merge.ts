import type { Reachable } from "./query.js";

/** Merge the route networks of a metro selection into one destination list.
 * When several member airports serve the same destination, keep the shortest
 * flight. Member airports themselves are never shown as destinations. */
export function mergeReachable(
  groups: Reachable[][],
  originAirports: Set<number>,
): Reachable[] {
  const byAirport = new Map<number, Reachable>();
  for (const destinations of groups) {
    for (const destination of destinations) {
      if (originAirports.has(destination.airport)) continue;
      const current = byAirport.get(destination.airport);
      if (!current || destination.minutes < current.minutes) {
        byAirport.set(destination.airport, destination);
      }
    }
  }
  return [...byAirport.values()].sort((a, b) => a.minutes - b.minutes);
}
