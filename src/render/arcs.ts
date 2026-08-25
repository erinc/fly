import type { GeoProjection } from "d3-geo";
import { arcSegments } from "../geo/arc.js";
import type { LatLon } from "../geo/types.js";
import { COLORS } from "../geo/projection.js";
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";

export type Layer = { origin: Airport; destinations: Reachable[]; color: string };

/** Interpolate along the great circle, split at the antimeridian, then project. */
export function pathForArc(
  projection: GeoProjection,
  a: LatLon,
  b: LatLon,
): [number, number][][] {
  return arcSegments(a, b, 48)
    .map((seg) =>
      seg
        .map((p) => projection([p.lon, p.lat]))
        .filter((xy): xy is [number, number] => xy !== null && Number.isFinite(xy[0]) && Number.isFinite(xy[1])),
    )
    .filter((seg) => seg.length >= 2);
}

export function drawReach(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  airports: Airport[],
  layers: Layer[],
  shared: Set<number>,
): void {
  ctx.lineWidth = 0.9;
  ctx.lineJoin = "round";

  for (const layer of layers) {
    ctx.strokeStyle = layer.color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const d of layer.destinations) {
      const dest = airports[d.airport];
      if (!dest) continue;
      for (const seg of pathForArc(projection, layer.origin, dest)) {
        ctx.moveTo(seg[0]![0], seg[0]![1]);
        for (let i = 1; i < seg.length; i++) ctx.lineTo(seg[i]![0], seg[i]![1]);
      }
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    for (const d of layer.destinations) {
      if (shared.has(d.airport)) continue;
      const dest = airports[d.airport];
      const xy = dest && projection([dest.lon, dest.lat]);
      if (!xy) continue;
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = COLORS.shared;
  for (const idx of shared) {
    const dest = airports[idx];
    const xy = dest && projection([dest.lon, dest.lat]);
    if (!xy) continue;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const layer of layers) {
    const xy = projection([layer.origin.lon, layer.origin.lat]);
    if (!xy) continue;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = layer.color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
