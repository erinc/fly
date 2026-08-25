import { expect, test } from "vitest";
import { durationHours, durationMinutes } from "./duration.js";

// [route, great-circle km, actual published block time in hours]
const REAL_BLOCK_TIMES: [string, number, number][] = [
  ["FRA-MUC", 299, 1.08],
  ["LHR-CDG", 348, 1.33],
  ["MAD-BCN", 483, 1.33],
  ["SYD-MEL", 705, 1.5],
  ["BER-LHR", 932, 1.83],
  ["ORD-DEN", 1476, 2.75],
  ["LAX-SEA", 1544, 2.83],
  ["HKG-NRT", 2890, 4.08],
  ["JFK-LAX", 3974, 5.92],
  ["DXB-LHR", 5500, 7.5],
  ["LHR-JFK", 5555, 7.54],
];

test.each(REAL_BLOCK_TIMES)(
  "%s prediction is within 15 minutes of the real block time",
  (_route, km, actualHours) => {
    const errorMinutes = Math.abs(durationHours(km) - actualHours) * 60;
    expect(errorMinutes).toBeLessThanOrEqual(15);
  },
);

test("a zero-distance flight still carries the fixed overhead", () => {
  expect(durationMinutes(0)).toBe(40);
});

test("duration increases monotonically with distance", () => {
  expect(durationHours(1000)).toBeGreaterThan(durationHours(500));
});

test("durationMinutes returns whole minutes", () => {
  expect(Number.isInteger(durationMinutes(1234))).toBe(true);
});
