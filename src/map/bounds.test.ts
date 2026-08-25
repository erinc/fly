import { expect, test } from "vitest";
import { unwrappedBounds } from "./bounds.js";

test("returns null for no points", () => {
  expect(unwrappedBounds([])).toBeNull();
});

test("wraps a single point tightly", () => {
  expect(unwrappedBounds([{ lat: 10, lon: 20 }])).toEqual([[10, 20], [10, 20]]);
});

test("ordinary cluster keeps its natural extent", () => {
  const b = unwrappedBounds([
    { lat: 40, lon: -10 },
    { lat: 50, lon: 20 },
  ])!;
  expect(b[0][0]).toBe(40);
  expect(b[1][0]).toBe(50);
  expect(b[1][1] - b[0][1]).toBeCloseTo(30, 6);
});

test("a Pacific cluster spanning the antimeridian stays narrow", () => {
  // Tokyo (139) and Los Angeles (-118) are ~103 degrees apart across the
  // antimeridian, not 257 degrees the long way round.
  const b = unwrappedBounds([
    { lat: 35, lon: 139 },
    { lat: 34, lon: -118 },
  ])!;
  expect(b[1][1] - b[0][1]).toBeCloseTo(103, 0);
});

test("does not unwrap a genuinely global spread", () => {
  const b = unwrappedBounds([
    { lat: 0, lon: -170 },
    { lat: 0, lon: -60 },
    { lat: 0, lon: 60 },
    { lat: 0, lon: 170 },
  ])!;
  expect(b[1][1] - b[0][1]).toBeGreaterThan(200);
});

test("latitude bounds are independent of longitude unwrapping", () => {
  const b = unwrappedBounds([
    { lat: -20, lon: 179 },
    { lat: 60, lon: -179 },
  ])!;
  expect(b[0][0]).toBe(-20);
  expect(b[1][0]).toBe(60);
});
