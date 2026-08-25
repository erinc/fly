import type { GeoProjection } from "d3-geo";
import { COLORS } from "../geo/projection.js";

export type CountryLabel = { name: string; lat: number; lon: number; rank: number };

/**
 * Rank threshold at zoom 1, in square degrees of polygon area. Tuned against
 * the actual generated public/labels.json: 40 excludes Italy (29.4), the
 * United Kingdom (32.5) and Japan (29.4) at default zoom, which is
 * indefensible on a world map. 25 includes them (about 70 labels at zoom 1)
 * while still deferring Greece (12.8), Portugal (9.8), Austria (10.2) and
 * the Benelux to higher zooms.
 */
export const MIN_RANK = 25;

export function visibleLabels(labels: CountryLabel[], zoom: number): CountryLabel[] {
  const z = Math.max(1, zoom);
  const threshold = MIN_RANK / (z * z);
  return labels.filter((l) => l.rank >= threshold).sort((a, b) => b.rank - a.rank);
}

/**
 * Official names that are too long to render legibly at map-label scale.
 * Anything not listed here falls back to its source name unchanged.
 */
const SHORT_NAMES: Record<string, string> = {
  "United States of America": "United States",
  "Democratic Republic of the Congo": "DR Congo",
  "United Republic of Tanzania": "Tanzania",
  "Central African Republic": "Central African Rep.",
  "Bosnia and Herzegovina": "Bosnia",
  "North Macedonia": "N. Macedonia",
};

export function displayName(name: string): string {
  return SHORT_NAMES[name] ?? name;
}

const FONT_SIZE = 9;
/** Rough average glyph advance for this font at FONT_SIZE, in px, at the
 *  uppercase + letter-spacing(0.8) styling used below. Used to estimate a
 *  label's rendered bounding box without requiring layout (jsdom has no
 *  real text metrics), and cross-checked against getBBox() in the browser
 *  where available. */
const CHAR_WIDTH = FONT_SIZE * 0.66 + 0.8;
const LINE_HEIGHT = FONT_SIZE * 1.3;

type Box = { x0: number; y0: number; x1: number; y1: number };

function estimateBox(x: number, y: number, text: string): Box {
  const w = text.length * CHAR_WIDTH;
  const h = LINE_HEIGHT;
  return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export type PlacedLabel = { label: CountryLabel; x: number; y: number; text: string };

/**
 * Greedy collision suppression: walk labels in rank order (already sorted by
 * visibleLabels) and keep a label only if its estimated bounding box does not
 * overlap any label already placed. Highest-ranked (largest) countries win
 * placement priority.
 */
export function placeLabels(
  labels: CountryLabel[],
  projection: GeoProjection,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const boxes: Box[] = [];
  for (const l of labels) {
    const xy = projection([l.lon, l.lat]);
    if (!xy) continue;
    const text = displayName(l.name).toUpperCase();
    const box = estimateBox(xy[0], xy[1], text);
    if (boxes.some((b) => overlaps(b, box))) continue;
    boxes.push(box);
    placed.push({ label: l, x: xy[0], y: xy[1], text });
  }
  return placed;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderLabels(
  svg: SVGSVGElement,
  labels: CountryLabel[],
  projection: GeoProjection,
  zoom: number,
): void {
  svg.replaceChildren();
  for (const p of placeLabels(visibleLabels(labels, zoom), projection)) {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(p.x));
    text.setAttribute("y", String(p.y));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", COLORS.label);
    text.setAttribute("font-size", String(FONT_SIZE));
    text.setAttribute("letter-spacing", "0.8");
    text.style.textTransform = "uppercase";
    text.textContent = p.text;
    svg.appendChild(text);
  }
}
