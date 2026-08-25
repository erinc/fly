export type Point = { lat: number; lon: number };

/**
 * Bounds that survive the antimeridian.
 *
 * Longitudes are circular, so a cluster straddling +/-180 looks like it spans
 * almost the whole globe. Find the largest empty gap between consecutive
 * longitudes and treat the point just after it as the cluster's start, then
 * unwrap every longitude forward from there. The result may exceed +180;
 * MapLibre accepts wrapped longitudes when fitting bounds.
 */
export function unwrappedBounds(
  points: Point[],
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;

  const lons = points.map((p) => p.lon).sort((a, b) => a - b);
  let bestGap = -1;
  let startIdx = 0;
  for (let i = 0; i < lons.length; i++) {
    const a = lons[i]!;
    const b = lons[(i + 1) % lons.length]!;
    const gap = (b - a + 360) % 360;
    if (gap > bestGap) {
      bestGap = gap;
      startIdx = (i + 1) % lons.length;
    }
  }
  const start = lons[startIdx]!;

  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    let lon = p.lon;
    while (lon < start) lon += 360;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }

  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lats), minLon],
    [Math.max(...lats), maxLon],
  ];
}
