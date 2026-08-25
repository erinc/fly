// src/ui/picker.ts
import type { Airport } from "../data/bundle.js";
import { searchAirports } from "./search.js";

export type Picker = { el: HTMLElement; setValue(iata: string | null): void };

export function createPicker(opts: {
  airports: Airport[];
  slot: "a" | "b";
  color: string;
  onSelect: (iata: string | null) => void;
}): Picker {
  const el = document.createElement("div");
  el.className = "picker";

  const dot = document.createElement("i");
  dot.className = "dot";
  dot.style.background = opts.color;

  const input = document.createElement("input");
  input.type = "search";
  input.autocomplete = "off";
  input.placeholder = opts.slot === "a" ? "Choose an airport" : "Add a second airport";
  input.setAttribute("aria-label", opts.slot === "a" ? "First airport" : "Second airport");

  const results = document.createElement("ul");
  results.className = "results";
  results.hidden = true;

  let active = -1;
  let current: Airport[] = [];

  const close = () => { results.hidden = true; active = -1; };

  const choose = (a: Airport) => {
    input.value = `${a.iata} · ${a.city || a.name}`;
    close();
    opts.onSelect(a.iata);
  };

  const render = () => {
    results.replaceChildren();
    current.forEach((a, i) => {
      const li = document.createElement("li");
      li.className = i === active ? "active" : "";
      li.innerHTML = `<b>${a.iata}</b> <span>${a.city || a.name}</span> <em>${a.country}</em>`;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); choose(a); });
      results.appendChild(li);
    });
    results.hidden = current.length === 0;
  };

  input.addEventListener("input", () => {
    if (input.value.trim() === "") opts.onSelect(null);
    current = searchAirports(opts.airports, input.value);
    active = current.length ? 0 : -1;
    render();
  });

  input.addEventListener("keydown", (e) => {
    if (results.hidden) return;
    if (e.key === "ArrowDown") { active = Math.min(active + 1, current.length - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter" && current[active]) { choose(current[active]!); e.preventDefault(); }
    else if (e.key === "Escape") close();
  });

  input.addEventListener("blur", () => setTimeout(close, 120));

  el.append(dot, input, results);

  return {
    el,
    setValue(iata) {
      const a = iata ? opts.airports.find((x) => x.iata === iata) : undefined;
      input.value = a ? `${a.iata} · ${a.city || a.name}` : "";
    },
  };
}
