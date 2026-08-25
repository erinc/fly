import { expect, test } from "vitest";
import { placeLabels, visibleLabels, type CountryLabel, type ProjectPoint } from "./labels.js";

/** Simple equirectangular projection, enough to exercise collision suppression. */
const project: ProjectPoint = (lon, lat) => [
  ((lon + 180) / 360) * 1000,
  ((90 - lat) / 180) * 600,
];

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

// Mirrors the private box-estimation formula in labels.ts (FONT_SIZE=9,
// CHAR_WIDTH = 9*0.66+0.8, LINE_HEIGHT = 9*1.3) so this test can verify the
// invariant placeLabels is supposed to guarantee without exporting internals.
const CHAR_WIDTH = 9 * 0.66 + 0.8;
const LINE_HEIGHT = 9 * 1.3;

function boxOf(x: number, y: number, text: string) {
  const w = text.length * CHAR_WIDTH;
  const h = LINE_HEIGHT;
  return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}

function boxesOverlap(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

test("placed labels never overlap, even for a densely clustered set", () => {
  // A cluster of small, closely-spaced European "countries" that would
  // collide badly if collision suppression were broken — this is the shape
  // of bug that once shipped 133 overlapping label pairs.
  const cluster: CountryLabel[] = [
    { name: "Belgium", lat: 50.5, lon: 4.5, rank: 20 },
    { name: "Netherlands", lat: 52.1, lon: 5.3, rank: 18 },
    { name: "Luxembourg", lat: 49.8, lon: 6.1, rank: 16 },
    { name: "Switzerland", lat: 46.8, lon: 8.2, rank: 22 },
    { name: "Austria", lat: 47.5, lon: 14.5, rank: 15 },
    { name: "Czechia", lat: 49.8, lon: 15.5, rank: 17 },
    { name: "Slovakia", lat: 48.7, lon: 19.7, rank: 12 },
    { name: "Slovenia", lat: 46.1, lon: 14.8, rank: 10 },
  ];

  const placed = placeLabels(cluster, project);
  expect(placed.length).toBeGreaterThan(1);

  const boxes = placed.map((p) => boxOf(p.x, p.y, p.text));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
    }
  }
});
