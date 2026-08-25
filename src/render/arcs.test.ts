import { expect, test } from "vitest";
import { createProjection } from "../geo/projection.js";
import { pathForArc } from "./arcs.js";

const NRT = { lat: 35.7647, lon: 140.3864 };
const LAX = { lat: 33.9425, lon: -118.408 };
const LHR = { lat: 51.4706, lon: -0.4619 };
const CDG = { lat: 49.0128, lon: 2.55 };

test("a short arc projects to a single screen-space path", () => {
  const p = createProjection(1000, 500);
  expect(pathForArc(p, LHR, CDG)).toHaveLength(1);
});

test("a Pacific arc projects to two screen-space paths", () => {
  const p = createProjection(1000, 500);
  expect(pathForArc(p, NRT, LAX).length).toBe(2);
});

test("all projected points are finite", () => {
  const p = createProjection(1000, 500);
  for (const seg of pathForArc(p, NRT, LAX)) {
    for (const [x, y] of seg) {
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  }
});
