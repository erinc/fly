// src/main.ts
import "./styles.css";
import { loadDataset } from "./data/bundle.js";
import { reachable, type Reachable } from "./reach/query.js";
import { COLORS, createProjection } from "./geo/projection.js";
import { drawBasemap } from "./render/basemap.js";
import { drawReach, type Layer } from "./render/arcs.js";
import { renderLabels, type CountryLabel } from "./render/labels.js";
import { createPicker } from "./ui/picker.js";
import { createSlider } from "./ui/slider.js";
import { createToggle } from "./ui/toggle.js";
import { createList } from "./ui/list.js";
import { createPanel } from "./ui/panel.js";
import { parseState, toSearch, type AppState } from "./state/url.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

function renderLoadError(): void {
  app.replaceChildren();
  const msg = document.createElement("div");
  msg.className = "load-error";
  msg.textContent = "Couldn't load map data. Try reloading.";
  app.appendChild(msg);
}

let dataset: Awaited<ReturnType<typeof loadDataset>>;
let world: GeoJSON.FeatureCollection;
let labels: CountryLabel[];

try {
  [dataset, world, labels] = await Promise.all([
    loadDataset(),
    fetch("/world.json").then((r) => r.json()) as Promise<GeoJSON.FeatureCollection>,
    fetch("/labels.json").then((r) => r.json()) as Promise<CountryLabel[]>,
  ]);
} catch (err) {
  console.error("Failed to load map data", err);
  renderLoadError();
  throw err;
}

const mapEl = document.createElement("div");
mapEl.className = "map";
const canvas = document.createElement("canvas");
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
mapEl.append(canvas, svg);

/**
 * Drops any airport code that isn't in this bundle (e.g. a stale or
 * hand-edited URL) and, if only the second slot is occupied, swaps it into
 * the first so single-origin queries always render as single-origin chrome.
 */
function normalize(s: AppState): AppState {
  const a = s.a && dataset.index.has(s.a) ? s.a : null;
  const b = s.b && dataset.index.has(s.b) ? s.b : null;
  if (a === null && b !== null) return { ...s, a: b, b: null };
  return { ...s, a, b };
}

let state: AppState = normalize(parseState(location.search));

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
  onInput: (minutes) => { state = { ...state, minutes }; draw(); },
  onChange: (minutes) => { state = { ...state, minutes }; history.replaceState(null, "", toSearch(state)); },
});
const yearRoundToggle = createToggle({
  label: "Year-round only",
  value: state.yearRoundOnly,
  onChange: (yearRoundOnly) => { state = { ...state, yearRoundOnly }; commit(); },
});
const list = createList({
  onHover: (airport) => { highlight = airport; draw(); },
  onSelect: () => {},
});

const footer = document.createElement("div");
footer.className = "footer";
footer.textContent = "Route data from Wikipedia (CC BY-SA 4.0) · Airports from OurAirports";

const panel = createPanel([brand, pickerA.el, pickerB.el, slider.el, yearRoundToggle.el, list.el, footer]);
app.append(panel, mapEl);

let highlight: number | null = null;

function currentLayers(): { layers: Layer[]; ra: Reachable[]; rb: Reachable[]; shared: Set<number> } {
  const ia = state.a ? dataset.index.get(state.a) : undefined;
  const ib = state.b ? dataset.index.get(state.b) : undefined;
  const opts = { yearRoundOnly: state.yearRoundOnly };
  const ra = ia === undefined ? [] : reachable(dataset, ia, state.minutes, opts);
  const rb = ib === undefined ? [] : reachable(dataset, ib, state.minutes, opts);
  const shared = new Set<number>();

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
  state = normalize(state);
  pickerA.setValue(state.a);
  pickerB.setValue(state.b);
  yearRoundToggle.setValue(state.yearRoundOnly);
  history.replaceState(null, "", toSearch(state));
  draw();
}

window.addEventListener("resize", draw);
window.addEventListener("popstate", () => {
  state = normalize(parseState(location.search));
  pickerA.setValue(state.a);
  pickerB.setValue(state.b);
  slider.setValue(state.minutes);
  yearRoundToggle.setValue(state.yearRoundOnly);
  draw();
});

pickerA.setValue(state.a);
pickerB.setValue(state.b);
history.replaceState(null, "", toSearch(state));
draw();
