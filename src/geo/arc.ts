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
    // Near-antipodal case: d ≈ π makes sin(d) ≈ 0, causing NaN/Infinity.
    // For antipodal pairs the great circle is not unique; linearly interpolate in (lat,lon) space.
    // This is defence in depth—real airport pairs are never exactly antipodal.
    const ANTIPODAL_EPSILON = 1e-5;
    if (Math.abs(d - Math.PI) < ANTIPODAL_EPSILON) {
      pts.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });
      continue;
    }
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
 *
 * When a crossing is detected, the path is interpolated at ±180° to produce
 * seamless segment boundaries and avoid dropping points.
 */
export function splitAtAntimeridian(points: LatLon[]): LatLon[][] {
  const segments: LatLon[][] = [];
  let current: LatLon[] = [];
  for (const p of points) {
    const prev = current.at(-1);
    if (prev && Math.abs(p.lon - prev.lon) > 180) {
      // Interpolate the crossing point at ±180°.
      // Unwrap the longitude difference across the seam.
      const lonDiff = p.lon - prev.lon;
      const lonDiffUnwrapped = lonDiff > 0 ? lonDiff - 360 : lonDiff + 360;
      // Fraction of the path segment at which we cross ±180°.
      const boundaryLon = prev.lon > 0 ? 180 : -180;
      const t = boundaryLon - prev.lon;
      const tFraction = t / lonDiffUnwrapped;
      // Linearly interpolate latitude at the crossing.
      const crossLat = prev.lat + (p.lat - prev.lat) * tFraction;

      // End current segment with boundary point at the sign we're leaving.
      current.push({ lat: crossLat, lon: boundaryLon });
      if (current.length >= 2) segments.push(current);

      // Start new segment with boundary point at the opposite sign.
      current = [{ lat: crossLat, lon: -boundaryLon }];
    }
    current.push(p);
  }
  if (current.length >= 2) segments.push(current);
  return segments;
}

export function arcSegments(a: LatLon, b: LatLon, steps = 64): LatLon[][] {
  return splitAtAntimeridian(interpolateGreatCircle(a, b, steps));
}
