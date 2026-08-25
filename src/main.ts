// src/main.ts
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { loadDataset } from "./data/bundle.js";
import { reachable, type Reachable } from "./reach/query.js";
import { mergeReachable } from "./reach/merge.js";
import { createMap } from "./map/map.js";
import { createReachLayer, type OriginLayer } from "./map/layers.js";
import { unwrappedBounds } from "./map/bounds.js";
import { createAirportSelector } from "./ui/selector.js";
import { createSlider } from "./ui/slider.js";
import { createToggle } from "./ui/toggle.js";
import { createList, type ListGroup } from "./ui/list.js";
import { createPanel } from "./ui/panel.js";
import { originColor, MAX_AIRPORTS } from "./theme.js";
import { parseState, routeLimit, toSearch, type AppState } from "./state/url.js";
import {
  flattenSelections,
  selectionCodes,
  selectionsFromCodes,
} from "./data/selections.js";

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
  const validCodes = s.airports.filter((c) => dataset.index.has(c));
  const selections = selectionsFromCodes(validCodes, dataset.metros).slice(0, MAX_AIRPORTS);
  const airports = flattenSelections(selections);
  return { ...s, airports };
}

const mapEl = document.createElement("div");
mapEl.className = "map";

const brand = document.createElement("a");
brand.className = "brand";
brand.href = "/";
brand.textContent = "✈️ FLY.ERIC.FUN";

let panel: ReturnType<typeof createPanel>;

const selector = createAirportSelector({
  airports: dataset.airports,
  metros: dataset.metros,
  onChange: (codes) => {
    state = { ...state, airports: codes };
    commit({ refocus: true });
  },
  onMobileChoose: () => panel.close({ restoreFocus: false }),
});

let slider: ReturnType<typeof createSlider>;
let mapSlider: ReturnType<typeof createSlider>;
let drawRequest: number | null = null;

const updateMinutes = (
  minutes: number,
  peer: ReturnType<typeof createSlider>,
) => {
  state = { ...state, minutes };
  peer.setValue(minutes);
  scheduleDraw();
};

const saveMinutes = (
  minutes: number,
  peer: ReturnType<typeof createSlider>,
) => {
  state = { ...state, minutes };
  peer.setValue(minutes);
  pushUrl();
};

slider = createSlider({
  value: state.minutes,
  onInput: (minutes) => updateMinutes(minutes, mapSlider),
  onChange: (minutes) => saveMinutes(minutes, mapSlider),
});

mapSlider = createSlider({
  value: state.minutes,
  label: "Flight time",
  onInput: (minutes) => updateMinutes(minutes, slider),
  onChange: (minutes) => saveMinutes(minutes, slider),
});
mapSlider.el.classList.add("mobile-map-slider");

const toggle = createToggle({
  label: "Year-round routes only",
  value: state.yearRoundOnly,
  onChange: (yearRoundOnly) => { state = { ...state, yearRoundOnly }; commit({ refocus: false }); },
});

const list = createList();

panel = createPanel(
  [brand, selector.el, slider.el, toggle.el, list.el],
  { initiallyOpen: state.airports.length === 0 },
);
app.replaceChildren(
  panel.el,
  panel.backdrop,
  panel.trigger,
  mapSlider.el,
  mapEl,
);

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
  const selections = selectionsFromCodes(state.airports, dataset.metros);
  selections.forEach((selection, i) => {
    const codes = selectionCodes(selection);
    const color = originColor(i);
    const memberDestinations: Reachable[][] = [];
    const originIndices = new Set<number>();
    for (const code of codes) {
      const idx = dataset.index.get(code);
      if (idx === undefined) continue;
      originIndices.add(idx);
      const origin = dataset.airports[idx]!;
      const destinations = reachable(
        dataset,
        idx,
        routeLimit(state.minutes),
        opts,
      );
      memberDestinations.push(destinations);
      layers.push({ origin, destinations, color });
    }
    const firstOrigin = dataset.airports[dataset.index.get(codes[0]!) ?? -1];
    if (!firstOrigin) return;
    listGroups.push({
      id: selection.kind === "metro" ? selection.metro.id : firstOrigin.iata,
      codes,
      color,
      destinations: mergeReachable(memberDestinations, originIndices),
    });
  });
  return { layers, listGroups };
}

/** Last layers computed by draw(), reused by refocus() so selection changes
 *  don't run reachable() a second time over the same origins. */
let lastLayers: OriginLayer[] = [];

function scheduleDraw(): void {
  if (drawRequest !== null) return;
  drawRequest = window.requestAnimationFrame(() => {
    drawRequest = null;
    draw();
  });
}

function draw(): void {
  if (drawRequest !== null) {
    window.cancelAnimationFrame(drawRequest);
    drawRequest = null;
  }
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
  mapSlider.setValue(state.minutes);
  toggle.setValue(state.yearRoundOnly);
  draw();
  refocus();
});

selector.setValue(state.airports);
pushUrl();
draw();
if (state.airports.length > 0) refocus();
