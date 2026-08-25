import { expect, test } from "vitest";
import type { Reachable } from "./query.js";
import { mergeReachable } from "./merge.js";

const route = (airport: number, minutes: number, seasonal = false): Reachable => ({
  airport,
  minutes,
  seasonal,
  charter: false,
});

test("merges destinations and keeps the shortest flight", () => {
  expect(mergeReachable([
    [route(4, 120), route(5, 180)],
    [route(4, 90), route(6, 150)],
  ], new Set([0, 1]))).toEqual([
    route(4, 90),
    route(6, 150),
    route(5, 180),
  ]);
});

test("excludes every member airport from a metro destination list", () => {
  expect(mergeReachable([[route(1, 30), route(4, 90)]], new Set([0, 1])))
    .toEqual([route(4, 90)]);
});
