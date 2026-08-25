import { expect, test } from "vitest";
import { greatCircleKm } from "./distance.js";

const LHR = { lat: 51.4706, lon: -0.461941 };
const JFK = { lat: 40.6398, lon: -73.7789 };
const CDG = { lat: 49.0128, lon: 2.55 };

test("LHR to JFK is about 5555 km", () => {
  expect(greatCircleKm(LHR, JFK)).toBeCloseTo(5555, -2);
});

test("LHR to CDG is about 348 km", () => {
  expect(greatCircleKm(LHR, CDG)).toBeCloseTo(348, -1);
});

test("distance to self is zero", () => {
  expect(greatCircleKm(LHR, LHR)).toBe(0);
});

test("distance is symmetric", () => {
  expect(greatCircleKm(LHR, JFK)).toBeCloseTo(greatCircleKm(JFK, LHR), 6);
});
