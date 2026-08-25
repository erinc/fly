import { geoEqualEarth, type GeoProjection } from "d3-geo";

export const COLORS = {
  ocean: "#dceaf2",
  land: "#f2f0eb",
  border: "#b3ada2",
  label: "#9a948a",
  originA: "#d94f45",
  originB: "#2b6cb0",
  shared: "#111",
} as const;

export function createProjection(width: number, height: number): GeoProjection {
  return geoEqualEarth().fitExtent(
    [[8, 8], [width - 8, height - 8]],
    { type: "Sphere" },
  );
}
