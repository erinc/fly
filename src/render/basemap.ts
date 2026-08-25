import { geoPath, type GeoProjection } from "d3-geo";
import { COLORS } from "../geo/projection.js";

export function drawBasemap(
  ctx: CanvasRenderingContext2D,
  world: GeoJSON.FeatureCollection,
  projection: GeoProjection,
  width: number,
  height: number,
): void {
  const path = geoPath(projection, ctx);

  ctx.fillStyle = COLORS.ocean;
  ctx.fillRect(0, 0, width, height);

  // Ocean is only inside the projected sphere; clear the surround.
  ctx.beginPath();
  path({ type: "Sphere" } as never);
  ctx.fillStyle = COLORS.ocean;
  ctx.fill();

  ctx.beginPath();
  path(world as never);
  ctx.fillStyle = COLORS.land;
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = COLORS.border;
  ctx.stroke();
}
