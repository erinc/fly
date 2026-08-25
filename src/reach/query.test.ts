import { expect, test } from "vitest";
import { decodeRoutes, encodeRoutes, FLAG_SEASONAL } from "../data/format.js";
import { buildAdjacency, type Dataset } from "../data/bundle.js";
import { reachable } from "./query.js";

/** 0=BER 1=LIS 2=BCN 3=SYD */
function fixture(): Dataset {
  const routes = decodeRoutes(encodeRoutes([
    { a: 0, b: 2, minutes: 125, flags: 0 },            // BER-BCN
    { a: 1, b: 2, minutes: 110, flags: 0 },            // LIS-BCN
    { a: 0, b: 1, minutes: 200, flags: FLAG_SEASONAL },// BER-LIS seasonal
    { a: 0, b: 3, minutes: 1300, flags: 0 },           // BER-SYD, far
  ]));
  const airports = ["BER", "LIS", "BCN", "SYD"].map((iata) => ({
    iata, name: iata, city: iata, country: "XX", lat: 0, lon: 0, size: "large",
  }));
  return {
    airports,
    index: new Map(airports.map((a, i) => [a.iata, i])),
    routes,
    adjacency: buildAdjacency(4, routes),
  };
}

test("returns destinations within the time budget", () => {
  const r = reachable(fixture(), 0, 180);
  expect(r.map((x) => x.airport)).toEqual([2]);
});

test("respects the direction-agnostic adjacency", () => {
  const r = reachable(fixture(), 2, 180).map((x) => x.airport).sort();
  expect(r).toEqual([0, 1]);
});

test("excludes destinations beyond the budget", () => {
  expect(reachable(fixture(), 0, 100)).toEqual([]);
});

test("includes a destination exactly at the budget", () => {
  expect(reachable(fixture(), 0, 125).map((x) => x.airport)).toEqual([2]);
});

test("never returns the origin itself", () => {
  expect(reachable(fixture(), 0, 9999).some((x) => x.airport === 0)).toBe(false);
});

test("surfaces the seasonal flag", () => {
  const r = reachable(fixture(), 0, 250);
  expect(r.find((x) => x.airport === 1)?.seasonal).toBe(true);
});

test("yearRoundOnly drops seasonal routes", () => {
  const r = reachable(fixture(), 0, 250, { yearRoundOnly: true });
  expect(r.map((x) => x.airport)).toEqual([2]);
});

test("results are sorted by duration", () => {
  const mins = reachable(fixture(), 0, 9999).map((x) => x.minutes);
  expect(mins).toEqual([...mins].sort((p, q) => p - q));
});
