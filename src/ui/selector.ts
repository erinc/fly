// src/ui/selector.ts
import type { Airport } from "../data/bundle.js";
import { searchAirports } from "./search.js";
import { MAX_AIRPORTS, originColor } from "../theme.js";

export function createAirportSelector(opts: {
  airports: Airport[];
  onChange: (codes: string[]) => void;
}) {
  let selected: string[] = [];

  const el = document.createElement("div");
  el.className = "selector";

  const chips = document.createElement("div");
  chips.className = "chips";

  const field = document.createElement("div");
  field.className = "picker";
  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = "Add an airport";
  input.setAttribute("aria-label", "Add an airport");
  const results = document.createElement("ul");
  results.className = "results";
  results.hidden = true;
  field.append(input, results);

  const note = document.createElement("p");
  note.className = "note";
  note.hidden = true;
  note.textContent = `Up to ${MAX_AIRPORTS} airports. Remove one to add another.`;

  let active = -1;
  let current: Airport[] = [];

  const close = () => { results.hidden = true; active = -1; };

  function renderChips() {
    chips.replaceChildren();
    selected.forEach((code, i) => {
      const ap = opts.airports.find((a) => a.iata === code);
      const chip = document.createElement("span");
      chip.className = "chip";

      const dot = document.createElement("i");
      dot.className = "dot";
      dot.style.background = originColor(i);

      const label = document.createElement("span");
      label.textContent = ap ? `${ap.iata} · ${ap.city || ap.name}` : code;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${ap?.city || code}`);
      remove.addEventListener("click", () => {
        selected = selected.filter((c) => c !== code);
        sync();
      });

      chip.append(dot, label, remove);
      chips.appendChild(chip);
    });

    const full = selected.length >= MAX_AIRPORTS;
    input.disabled = full;
    note.hidden = !full;
    if (full) close();
  }

  function sync() {
    renderChips();
    opts.onChange([...selected]);
  }

  const choose = (a: Airport) => {
    // sync() fires onChange, which triggers a map auto-focus in main.ts.
    // Only call it when the selection actually changes — re-selecting an
    // already-selected airport (or trying to add past the cap) must be a
    // no-op, or the auto-focus yanks the view away from wherever the user
    // had panned even though nothing changed.
    const changed = !selected.includes(a.iata) && selected.length < MAX_AIRPORTS;
    if (changed) selected.push(a.iata);
    input.value = "";
    close();
    if (changed) sync();
  };

  const render = () => {
    results.replaceChildren();
    current.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = i === active ? "active" : "";
      const code = document.createElement("b");
      code.textContent = a.iata;
      const city = document.createElement("span");
      city.textContent = a.city || a.name;
      const country = document.createElement("em");
      country.textContent = a.country;
      li.append(code, city, country);
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(a); });
      results.appendChild(li);
    });
    results.hidden = current.length === 0;
  };

  input.addEventListener("input", () => {
    current = searchAirports(opts.airports, input.value).filter(
      (a) => !selected.includes(a.iata),
    );
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

  el.append(chips, field, note);
  renderChips();

  return {
    el,
    setValue(codes: string[]) {
      selected = codes.slice(0, MAX_AIRPORTS);
      renderChips();
    },
  };
}
