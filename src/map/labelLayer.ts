// src/map/labelLayer.ts
//
// Kept out of src/render/labels.ts deliberately: that module is imported by
// labels.test.ts under Vitest's "node" environment, which has no `window`.
// Leaflet touches `window` at module-evaluation time (not just when called),
// so any static `import "leaflet"` in labels.ts would break that test suite
// on import alone. This file carries the Leaflet-dependent half of the same
// feature and imports the pure logic from labels.ts instead of duplicating it.
import L from "leaflet";
import {
  visibleLabels,
  placeLabels,
  type CountryLabel,
  type ProjectPoint,
} from "../render/labels.js";
import { LABEL_PANE } from "./map.js";

/**
 * Country labels as non-interactive markers, re-placed on every zoom so
 * collision suppression reflects the actual pixel layout at that zoom level.
 */
export function createLabelLayer(map: L.Map, labels: CountryLabel[]) {
  const group = L.layerGroup([], { pane: LABEL_PANE }).addTo(map);

  const refresh = () => {
    group.clearLayers();
    const project: ProjectPoint = (lon, lat) => {
      const p = map.latLngToContainerPoint([lat, lon]);
      return [p.x, p.y];
    };
    for (const placed of placeLabels(visibleLabels(labels, map.getZoom()), project)) {
      const marker = L.marker([placed.label.lat, placed.label.lon], {
        pane: LABEL_PANE,
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "country-label",
          html: "",
          iconSize: [0, 0],
        }),
      }).addTo(group);
      // Leaflet writes an inline transform (and, via iconSize, an inline
      // width/height) on the marker's own element to position it — centring
      // that element with CSS doesn't work (see the .country-label comment
      // in styles.css). Centre a child span instead and leave Leaflet's
      // element alone.
      const el = marker.getElement();
      if (el) {
        const span = document.createElement("span");
        span.textContent = placed.text;
        el.appendChild(span);
      }
    }
  };

  map.on("zoomend moveend", refresh);
  refresh();

  return {
    refresh,
    remove() {
      map.off("zoomend moveend", refresh);
      group.remove();
    },
  };
}
