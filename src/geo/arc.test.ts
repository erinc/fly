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
