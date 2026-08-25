import type { LatLon } from "./types.js";

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Spherical linear interpolation along the great circle between two points. */
export function interpolateGreatCircle(a: LatLon, b: LatLon, steps = 64): LatLon[] {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lon);
  const φ2 = toRad(b.lat), λ2 = toRad(b.lon);
  const d =
    2 *
    Math.asin(
      Math.min(1, Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      )),
    );

  const pts: LatLon[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    // Degenerate case: coincident endpoints give d === 0 and would divide by zero.
    if (d === 0) { pts.push({ lat: a.lat, lon: a.lon }); continue; }
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push({ lat: toDeg(Math.atan2(z, Math.hypot(x, y))), lon: toDeg(Math.atan2(y, x)) });
  }
  return pts;
}

/**
 * Breaks a path wherever consecutive longitudes jump more than 180 degrees,
 * which means the path wrapped across the antimeridian. Without this the
 * renderer draws a stripe straight across the map.
 */
export function splitAtAntimeridian(points: LatLon[]): LatLon[][] {
  const segments: LatLon[][] = [];
  let current: LatLon[] = [];
  for (const p of points) {
    const prev = current.at(-1);
    if (prev && Math.abs(p.lon - prev.lon) > 180) {
      if (current.length >= 2) segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

export function arcSegments(a: LatLon, b: LatLon, steps = 64): LatLon[][] {
  return splitAtAntimeridian(interpolateGreatCircle(a, b, steps));
}
