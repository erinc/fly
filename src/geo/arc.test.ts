import { expect, test } from "vitest";
import { arcSegments, interpolateGreatCircle, splitAtAntimeridian } from "./arc.js";

const LHR = { lat: 51.4706, lon: -0.4619 };
const JFK = { lat: 40.6398, lon: -73.7789 };
const NRT = { lat: 35.7647, lon: 140.3864 };
const LAX = { lat: 33.9425, lon: -118.408 };

test("interpolation starts and ends at the endpoints", () => {
  const pts = interpolateGreatCircle(LHR, JFK, 16);
  expect(pts[0]!.lat).toBeCloseTo(LHR.lat, 4);
  expect(pts.at(-1)!.lon).toBeCloseTo(JFK.lon, 4);
});

test("interpolation returns steps+1 points", () => {
  expect(interpolateGreatCircle(LHR, JFK, 16)).toHaveLength(17);
});

test("the great circle bows north of the straight lat/lon midpoint", () => {
  const pts = interpolateGreatCircle(LHR, JFK, 32);
  const mid = pts[16]!;
  expect(mid.lat).toBeGreaterThan((LHR.lat + JFK.lat) / 2);
});

test("identical endpoints do not produce NaN", () => {
  for (const p of interpolateGreatCircle(LHR, LHR, 8)) {
    expect(Number.isFinite(p.lat)).toBe(true);
    expect(Number.isFinite(p.lon)).toBe(true);
  }
});

test("a path that never crosses the antimeridian stays one segment", () => {
  expect(splitAtAntimeridian(interpolateGreatCircle(LHR, JFK, 32))).toHaveLength(1);
});

test("a Pacific crossing is split into two segments", () => {
  expect(arcSegments(NRT, LAX, 64).length).toBe(2);
});

test("no segment contains a longitude jump larger than 180 degrees", () => {
  for (const seg of arcSegments(NRT, LAX, 64)) {
    for (let i = 1; i < seg.length; i++) {
      expect(Math.abs(seg[i]!.lon - seg[i - 1]!.lon)).toBeLessThan(180);
    }
  }
});

test("every split segment has at least two points", () => {
  for (const seg of arcSegments(NRT, LAX, 64)) {
    expect(seg.length).toBeGreaterThanOrEqual(2);
  }
});

test("antimeridian split interpolates boundary crossing and preserves all points", () => {
  // For a path [170, -170, -160], the original buggy code would drop the first point.
  // The fixed version interpolates at ±180 and preserves all real points.
  const points = [
    { lat: 0, lon: 170 },
    { lat: 0, lon: -170 },
    { lat: 0, lon: -160 },
  ];
  const segments = splitAtAntimeridian(points);
  // Should produce 2 segments.
  expect(segments.length).toBe(2);
  // Each segment must be drawable (≥2 points).
  for (const seg of segments) {
    expect(seg.length).toBeGreaterThanOrEqual(2);
  }
  // Count real input points (exclude interpolated boundary points at exactly ±180).
  const realPoints = segments.flat().filter((p) => Math.abs(Math.abs(p.lon) - 180) > 0.01);
  expect(realPoints.length).toBe(3); // All three input points preserved.
});

test("antimeridian crossing produces segments with seam endpoints at ±180 and matching latitude", () => {
  const points = [
    { lat: 30, lon: 170 },
    { lat: 32, lon: -170 },
  ];
  const segments = splitAtAntimeridian(points);
  expect(segments.length).toBe(2);
  // First segment should end at +180.
  const seg1End = segments[0]![segments[0]!.length - 1]!;
  expect(seg1End.lon).toBeCloseTo(180, 5);
  // Second segment should start at -180.
  const seg2Start = segments[1]![0]!;
  expect(seg2Start.lon).toBeCloseTo(-180, 5);
  // Both boundary points should have the same latitude (linearly interpolated).
  expect(seg1End.lat).toBeCloseTo(seg2Start.lat, 5);
});

test("antipodal endpoints do not produce NaN or Infinity", () => {
  // Points at approximately opposite poles.
  const north = { lat: 89, lon: 0 };
  const south = { lat: -89, lon: 180 };
  const pts = interpolateGreatCircle(north, south, 16);
  expect(pts).toHaveLength(17);
  for (const p of pts) {
    expect(Number.isFinite(p.lat)).toBe(true);
    expect(Number.isFinite(p.lon)).toBe(true);
  }
});
