// src/main.ts
import "./styles.css";
import { loadDataset } from "./data/bundle.js";
import { reachable, sharedDestinations, type Reachable } from "./reach/query.js";
import { COLORS, createProjection } from "./geo/projection.js";
import { drawBasemap } from "./render/basemap.js";
import { drawReach, type Layer } from "./render/arcs.js";
import { renderLabels, type CountryLabel } from "./render/labels.js";
import { createPicker } from "./ui/picker.js";
import { createSlider } from "./ui/slider.js";
import { createList } from "./ui/list.js";
import { createPanel } from "./ui/panel.js";
import { parseState, toSearch, type AppState } from "./state/url.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

const mapEl = document.createElement("div");
mapEl.className = "map";
const canvas = document.createElement("canvas");
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
mapEl.append(canvas, svg);

const [dataset, world, labels] = await Promise.all([
  loadDataset(),
  fetch("/world.json").then((r) => r.json()) as Promise<GeoJSON.FeatureCollection>,
  fetch("/labels.json").then((r) => r.json()) as Promise<CountryLabel[]>,
]);

let state: AppState = parseState(location.search);

const brand = document.createElement("div");
brand.className = "brand";
brand.textContent = "fly.eric.fun";

const pickerA = createPicker({
  airports: dataset.airports, slot: "a", color: COLORS.originA,
  onSelect: (iata) => { state = { ...state, a: iata }; highlight = null; commit(); },
});
const pickerB = createPicker({
  airports: dataset.airports, slot: "b", color: COLORS.originB,
  onSelect: (iata) => { state = { ...state, b: iata }; highlight = null; commit(); },
});
const slider = createSlider({
  value: state.minutes,
  onChange: (minutes) => { state = { ...state, minutes }; commit(); },
});
const list = createList({
  onHover: (airport) => { highlight = airport; draw(); },
  onSelect: () => {},
});

const footer = document.createElement("div");
footer.className = "footer";
footer.textContent = "Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports";

const panel = createPanel([brand, pickerA.el, pickerB.el, slider.el, list.el, footer]);
app.append(panel, mapEl);

let highlight: number | null = null;

function currentLayers(): { layers: Layer[]; ra: Reachable[]; rb: Reachable[]; shared: Set<number> } {
  const ia = state.a ? dataset.index.get(state.a) : undefined;
  const ib = state.b ? dataset.index.get(state.b) : undefined;
  const opts = { yearRoundOnly: state.yearRoundOnly };
  const ra = ia === undefined ? [] : reachable(dataset, ia, state.minutes, opts);
  const rb = ib === undefined ? [] : reachable(dataset, ib, state.minutes, opts);
  const shared = ia !== undefined && ib !== undefined ? sharedDestinations(ra, rb) : new Set<number>();

  const layers: Layer[] = [];
  if (ia !== undefined) layers.push({ origin: dataset.airports[ia]!, destinations: ra, color: COLORS.originA });
  if (ib !== undefined) layers.push({ origin: dataset.airports[ib]!, destinations: rb, color: COLORS.originB });
  return { layers, ra, rb, shared };
}

function draw(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = mapEl.clientWidth;
  const h = mapEl.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const projection = createProjection(w, h);
  drawBasemap(ctx, world, projection, w, h);
  renderLabels(svg, labels, projection, 1);

  const { layers, ra, rb, shared } = currentLayers();
  drawReach(ctx, projection, dataset.airports, layers, shared);

  if (highlight !== null) {
    const ap = dataset.airports[highlight];
    const xy = ap && projection([ap.lon, ap.lat]);
    if (xy) {
      ctx.strokeStyle = COLORS.shared;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  list.update({
    airports: dataset.airports, a: ra, b: rb, shared,
    labelA: state.a ?? "", labelB: state.b,
  });
}

function commit(): void {
  history.replaceState(null, "", toSearch(state));
  draw();
}

window.addEventListener("resize", draw);
window.addEventListener("popstate", () => {
  state = parseState(location.search);
  pickerA.setValue(state.a);
  pickerB.setValue(state.b);
  slider.setValue(state.minutes);
  draw();
});

pickerA.setValue(state.a);
pickerB.setValue(state.b);
draw();
