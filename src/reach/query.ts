import type { Dataset } from "../data/bundle.js";
import { FLAG_CHARTER, FLAG_SEASONAL } from "../data/format.js";

export type Reachable = {
  airport: number;
  minutes: number;
  seasonal: boolean;
  charter: boolean;
};

export function reachable(
  data: Dataset,
  origin: number,
  maxMinutes: number,
  opts: { yearRoundOnly?: boolean } = {},
): Reachable[] {
  const { routes, adjacency } = data;
  const out: Reachable[] = [];
  for (const r of adjacency[origin] ?? []) {
    const minutes = routes.minutes[r]!;
    if (minutes > maxMinutes) continue;
    const flags = routes.flags[r]!;
    const seasonal = (flags & FLAG_SEASONAL) !== 0;
    if (opts.yearRoundOnly && seasonal) continue;
    const a = routes.a[r]!;
    const other = a === origin ? routes.b[r]! : a;
    if (other === origin) continue;
    out.push({ airport: other, minutes, seasonal, charter: (flags & FLAG_CHARTER) !== 0 });
  }
  return out.sort((p, q) => p.minutes - q.minutes);
}

export function sharedDestinations(a: Reachable[], b: Reachable[]): Set<number> {
  const inB = new Set(b.map((x) => x.airport));
  return new Set(a.map((x) => x.airport).filter((x) => inB.has(x)));
}
