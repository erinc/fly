import { expect, test } from "vitest";
import { visibleLabels, type CountryLabel } from "./labels.js";

// rank is polygon area in square degrees, as emitted by scripts/basemap.ts
const LABELS: CountryLabel[] = [
  { name: "Russia", lat: 60, lon: 90, rank: 2100 },
  { name: "France", lat: 46, lon: 2, rank: 55 },
  { name: "Luxembourg", lat: 49.8, lon: 6.1, rank: 0.3 },
];

test("the default zoom shows a dense label set but hides tiny countries", () => {
  const names = visibleLabels(LABELS, 1).map((l) => l.name);
  expect(names).toContain("Russia");
  expect(names).toContain("France");
  expect(names).not.toContain("Luxembourg");
});

test("zooming in reveals the smallest countries", () => {
  expect(visibleLabels(LABELS, 16).map((l) => l.name)).toContain("Luxembourg");
});

test("zooming in never hides a label that was already visible", () => {
  const near = visibleLabels(LABELS, 4).map((l) => l.name);
  for (const name of visibleLabels(LABELS, 1).map((l) => l.name)) {
    expect(near).toContain(name);
  }
});

test("labels are sorted by prominence", () => {
  const ranks = visibleLabels(LABELS, 40).map((l) => l.rank);
  expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
});

test("zoom is never allowed to divide by zero", () => {
  expect(() => visibleLabels(LABELS, 0)).not.toThrow();
});
