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

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderLabels(
  svg: SVGSVGElement,
  labels: CountryLabel[],
  projection: GeoProjection,
  zoom: number,
): void {
  svg.replaceChildren();
  for (const l of visibleLabels(labels, zoom)) {
    const xy = projection([l.lon, l.lat]);
    if (!xy) continue;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(xy[0]));
    text.setAttribute("y", String(xy[1]));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", COLORS.label);
    text.setAttribute("font-size", "9");
    text.setAttribute("letter-spacing", "0.8");
    text.style.textTransform = "uppercase";
    text.textContent = l.name;
    svg.appendChild(text);
  }
}
