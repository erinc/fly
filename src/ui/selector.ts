// src/ui/selector.ts
import type { Airport, Metro } from "../data/bundle.js";
import {
  addSelection,
  flattenSelections,
  selectionCodes,
  selectionsFromCodes,
  type AirportSelection,
} from "../data/selections.js";
import { searchOptions, type SearchOption } from "./search.js";
import { MAX_AIRPORTS, originColor } from "../theme.js";

export function createAirportSelector(opts: {
  airports: Airport[];
  metros: Metro[];
  onChange: (codes: string[]) => void;
  onMobileChoose?: () => void;
}) {
  let selected: AirportSelection[] = [];

  const el = document.createElement("div");
  el.className = "selector";

  const chips = document.createElement("div");
  chips.className = "chips";

  const field = document.createElement("div");
  field.className = "picker";
  const searchIcon = document.createElement("span");
  searchIcon.className = "search-icon";
  searchIcon.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = "Search airport or city…";
  input.setAttribute("aria-label", "Search airport or city");
  const results = document.createElement("ul");
  results.className = "results";
  results.hidden = true;
  field.append(searchIcon, input, results);
  field.addEventListener("mousedown", (event) => {
    if (event.target !== field && event.target !== searchIcon) return;
    event.preventDefault();
    input.focus();
  });

  const note = document.createElement("p");
  note.className = "note";
  note.hidden = true;
  note.textContent = `Up to ${MAX_AIRPORTS} places. Remove one to add another.`;

  let active = -1;
  let current: SearchOption[] = [];
  const mobile = window.matchMedia("(max-width: 760px)");

  const close = () => { results.hidden = true; active = -1; };

  function renderChips() {
    chips.replaceChildren();
    selected.forEach((selection, i) => {
      const codes = selectionCodes(selection);
      const ap = selection.kind === "airport"
        ? opts.airports.find((a) => a.iata === selection.code)
        : undefined;
      const color = originColor(i);
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.setProperty("--chip-color", color);

      const dot = document.createElement("i");
      dot.className = "dot";
      dot.style.background = color;

      const label = document.createElement("span");
      label.textContent = selection.kind === "metro"
        ? `${selection.metro.city} · ${codes.join(" + ")}`
        : ap ? `${ap.iata} · ${ap.city || ap.name}` : selection.code;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
      const removeLabel = selection.kind === "metro"
        ? `${selection.metro.city} all airports`
        : ap?.city || selection.code;
      remove.setAttribute("aria-label", `Remove ${removeLabel}`);
      remove.addEventListener("click", () => {
        selected = selected.filter((_, index) => index !== i);
        sync();
      });

      chip.append(dot, label, remove);
      chips.appendChild(chip);
    });

    const full = selected.length >= MAX_AIRPORTS;
    input.disabled = full;
    field.classList.toggle("disabled", full);
    note.hidden = !full;
    if (full) close();
  }

  function sync() {
    renderChips();
    opts.onChange(flattenSelections(selected));
  }

  const choose = (option: SearchOption) => {
    // sync() fires onChange, which triggers a map auto-focus in main.ts.
    // Only call it when the selection actually changes — re-selecting an
    // already-selected airport (or trying to add past the cap) must be a
    // no-op, or the auto-focus yanks the view away from wherever the user
    // had panned even though nothing changed.
    const incoming: AirportSelection = option.kind === "metro"
      ? { kind: "metro", metro: option.metro }
      : { kind: "airport", code: option.airport.iata };
    const next = addSelection(selected, incoming, opts.metros, MAX_AIRPORTS);
    const changed = next !== selected;
    selected = next;
    input.value = "";
    close();
    if (changed) {
      sync();
      if (mobile.matches) {
        input.blur();
        opts.onMobileChoose?.();
      }
    }
  };

  const render = () => {
    results.replaceChildren();
    current.forEach((option, i) => {
      const li = document.createElement("li");
      li.className = i === active ? "active" : "";
      const code = document.createElement("b");
      code.textContent = option.kind === "metro" ? "ALL" : option.airport.iata;
      const city = document.createElement("span");
      city.textContent = option.kind === "metro"
        ? `${option.metro.city} (All airports)`
        : option.airport.city || option.airport.name;
      const country = document.createElement("em");
      country.textContent = option.kind === "metro"
        ? option.metro.codes.join(" + ")
        : option.airport.country;
      li.append(code, city, country);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(option); });
      results.appendChild(li);
    });
    results.hidden = current.length === 0;
  };

  input.addEventListener("input", () => {
    const selectedCodes = new Set(flattenSelections(selected));
    current = searchOptions(opts.airports, opts.metros, input.value).filter((option) => {
      if (option.kind === "airport") return !selectedCodes.has(option.airport.iata);
      return !option.metro.codes.every((code) => selectedCodes.has(code));
    });
    active = current.length ? 0 : -1;
    render();
  });

  input.addEventListener("keydown", (e) => {
    if (results.hidden) return;
    if (e.key === "ArrowDown") { active = Math.min(active + 1, current.length - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter") {
      const item = current[active];
      if (item) { choose(item); e.preventDefault(); }
    } else if (e.key === "Escape") close();
  });

  input.addEventListener("blur", () => setTimeout(close, 120));

  el.append(field, chips, note);
  renderChips();

  return {
    el,
    setValue(codes: string[]) {
      selected = selectionsFromCodes(codes, opts.metros).slice(0, MAX_AIRPORTS);
      renderChips();
    },
  };
}
