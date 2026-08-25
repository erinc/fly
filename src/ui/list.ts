// src/ui/list.ts
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { formatDuration } from "./format.js";

export type ListGroup = {
  origin: Airport;
  color: string;
  destinations: Reachable[];
};

export function createList(opts: { onHover: (airport: number | null) => void }) {
  const el = document.createElement("div");
  el.className = "list";

  function section(group: ListGroup, airports: Airport[]) {
    const wrap = document.createElement("section");

    const head = document.createElement("div");
    head.className = "label";
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = group.color;
    const text = document.createElement("span");
    text.textContent = `${group.origin.city || group.origin.name} · ${group.destinations.length}`;
    head.append(dot, text);
    wrap.appendChild(head);

    if (group.destinations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No nonstop destinations within this flight time.";
      wrap.appendChild(empty);
      return wrap;
    }

    for (const r of group.destinations) {
      const ap = airports[r.airport];
      if (!ap) continue;
      const row = document.createElement("button");
      row.className = "row";
      row.type = "button";

      const left = document.createElement("span");
      left.append(document.createTextNode(`${ap.city || ap.name} `));
      const code = document.createElement("em");
      code.textContent = ap.iata;
      left.appendChild(code);
      if (r.seasonal) {
        const tag = document.createElement("i");
        tag.className = "tag";
        tag.textContent = "seasonal";
        left.append(" ", tag);
      }
      if (r.charter) {
        const tag = document.createElement("i");
        tag.className = "tag";
        tag.textContent = "charter";
        left.append(" ", tag);
      }

      const right = document.createElement("span");
      right.className = "mut";
      right.textContent = formatDuration(r.minutes);

      row.append(left, right);
      row.addEventListener("mouseenter", () => opts.onHover(r.airport));
      row.addEventListener("mouseleave", () => opts.onHover(null));
      wrap.appendChild(row);
    }
    return wrap;
  }

  return {
    el,
    update({ airports, groups }: { airports: Airport[]; groups: ListGroup[] }) {
      el.replaceChildren();
      if (groups.length === 0) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = "Add an airport to see where you can fly nonstop.";
        el.appendChild(p);
        return;
      }
      for (const g of groups) el.appendChild(section(g, airports));
    },
  };
}
