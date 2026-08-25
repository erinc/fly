// src/ui/slider.ts
import { MAX_MINUTES, MIN_MINUTES, STEP_MINUTES } from "../state/url.js";
import { formatDuration } from "./format.js";

export function createSlider(opts: { value: number; onChange: (minutes: number) => void }) {
  const el = document.createElement("div");
  el.className = "slider";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "Max flight time";

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(MIN_MINUTES);
  input.max = String(MAX_MINUTES);
  input.step = String(STEP_MINUTES);
  input.value = String(opts.value);
  input.setAttribute("aria-label", "Maximum flight time in minutes");

  const readout = document.createElement("div");
  readout.className = "readout";
  readout.textContent = formatDuration(opts.value);

  // Fires on every drag frame; the reach query is sub-millisecond so no debounce.
  input.addEventListener("input", () => {
    const m = Number(input.value);
    readout.textContent = formatDuration(m);
    opts.onChange(m);
  });

  el.append(label, input, readout);
  return {
    el,
    setValue(m: number) { input.value = String(m); readout.textContent = formatDuration(m); },
  };
}
