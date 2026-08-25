import { expect, test } from "vitest";
import { COLORS, createProjection } from "./projection.js";

test("projects a coordinate inside the canvas", () => {
  const p = createProjection(1000, 500);
  const xy = p([0, 0]);
  expect(xy).not.toBeNull();
  expect(xy![0]).toBeGreaterThan(0);
  expect(xy![0]).toBeLessThan(1000);
});

test("longitude increases to the right", () => {
  const p = createProjection(1000, 500);
  expect(p([50, 0])![0]).toBeGreaterThan(p([-50, 0])![0]);
});

test("latitude increases upward on screen", () => {
  const p = createProjection(1000, 500);
  expect(p([0, 50])![1]).toBeLessThan(p([0, -50])![1]);
});

test("the palette matches the approved design", () => {
  expect(COLORS.ocean).toBe("#dceaf2");
  expect(COLORS.land).toBe("#f2f0eb");
  expect(COLORS.border).toBe("#b3ada2");
  expect(COLORS.label).toBe("#9a948a");
  expect(COLORS.originA).toBe("#d94f45");
  expect(COLORS.originB).toBe("#2b6cb0");
  expect(COLORS.shared).toBe("#111");
});
