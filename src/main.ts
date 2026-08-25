// src/main.ts
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { loadDataset } from "./data/bundle.js";
import { reachable, type Reachable } from "./reach/query.js";
import { createMap } from "./map/map.js";
import { createReachLayer, type OriginLayer } from "./map/layers.js";
import { unwrappedBounds } from "./map/bounds.js";
import { createAirportSelector } from "./ui/selector.js";
import { createSlider } from "./ui/slider.js";
import { createToggle } from "./ui/toggle.js";
import { createList, type ListGroup } from "./ui/list.js";
import { createPanel } from "./ui/panel.js";
import { originColor, MAX_AIRPORTS } from "./theme.js";
import { parseState, toSearch, type AppState } from "./state/url.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

function renderLoadError() {
  app.replaceChildren();
  const p = document.createElement("p");
  p.className = "load-error";
  p.textContent = "Couldn't load map data. Try reloading.";
  app.appendChild(p);
}

let dataset: Awaited<ReturnType<typeof loadDataset>>;
try {
  dataset = await loadDataset();
} catch (err) {
  renderLoadError();
  throw err;
}

let state: AppState = normalise(parseState(location.search));

/** Drop codes the dataset doesn't know, then cap. */
function normalise(s: AppState): AppState {
  const airports = s.airports
    .filter((c) => dataset.index.has(c))
    .slice(0, MAX_AIRPORTS);
  return { ...s, airports };
}

const mapEl = document.createElement("div");
mapEl.className = "map";

const brand = document.createElement("a");
brand.className = "brand";
brand.href = "/";
brand.textContent = "✈️ fly.eric.fun";

const selector = createAirportSelector({
  airports: dataset.airports,
  onChange: (codes) => {
    state = { ...state, airports: codes };
    commit({ refocus: true });
  },
});

const slider = createSlider({
  value: state.minutes,
  onInput: (minutes) => { state = { ...state, minutes }; draw(); },
  onChange: (minutes) => { state = { ...state, minutes }; pushUrl(); },
});

const toggle = createToggle({
  label: "Year-round routes only",
  value: state.yearRoundOnly,
  onChange: (yearRoundOnly) => { state = { ...state, yearRoundOnly }; commit({ refocus: false }); },
});

const list = createList();

const panel = createPanel([brand, selector.el, slider.el, toggle.el, list.el]);
app.replaceChildren(panel, mapEl);

let map: Awaited<ReturnType<typeof createMap>>;
try {
  map = await createMap(mapEl);
} catch (err) {
  renderLoadError();
  throw err;
}
const reachLayer = createReachLayer(map);

function groups(): { layers: OriginLayer[]; listGroups: ListGroup[] } {
  const opts = { yearRoundOnly: state.yearRoundOnly };
  const layers: OriginLayer[] = [];
  const listGroups: ListGroup[] = [];
  state.airports.forEach((code, i) => {
    const idx = dataset.index.get(code);
    if (idx === undefined) return;
    const origin = dataset.airports[idx]!;
    const destinations: Reachable[] = reachable(dataset, idx, state.minutes, opts);
    const color = originColor(i);
    layers.push({ origin, destinations, color });
    listGroups.push({ origin, color, destinations });
  });
  return { layers, listGroups };
}

/** Last layers computed by draw(), reused by refocus() so selection changes
 *  don't run reachable() a second time over the same origins. */
let lastLayers: OriginLayer[] = [];

function draw(): void {
  const { layers, listGroups } = groups();
  lastLayers = layers;
  reachLayer.update(layers, dataset.airports);
  list.update({ airports: dataset.airports, groups: listGroups });
}

/** Fit the view to the current selection. Only ever called right after
 *  draw(), so it reuses draw()'s layers instead of recomputing them. */
function refocus(): void {
  const layers = lastLayers;
  const pts = layers.flatMap((l) => [
    { lat: l.origin.lat, lon: l.origin.lon },
    ...l.destinations.flatMap((d) => {
      const a = dataset.airports[d.airport];
      return a ? [{ lat: a.lat, lon: a.lon }] : [];
    }),
  ]);
  const b = unwrappedBounds(pts);
  if (b) {
    map.fitBounds(
      [
        [b[0][1], b[0][0]],
        [b[1][1], b[1][0]],
      ],
      { padding: 40, maxZoom: 6, duration: 450 },
    );
  }
}

function pushUrl(): void {
  history.replaceState(null, "", toSearch(state));
}

function commit({ refocus: shouldRefocus }: { refocus: boolean }): void {
  pushUrl();
  draw();
  if (shouldRefocus) refocus();
}

window.addEventListener("popstate", () => {
  state = normalise(parseState(location.search));
  selector.setValue(state.airports);
  slider.setValue(state.minutes);
  toggle.setValue(state.yearRoundOnly);
  draw();
  refocus();
});

selector.setValue(state.airports);
pushUrl();
draw();
if (state.airports.length > 0) refocus();
