// src/ui/list.ts
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { formatDuration } from "./format.js";

export function createList(opts: {
  onHover: (airport: number | null) => void;
  onSelect: (airport: number) => void;
}) {
  const el = document.createElement("div");
  el.className = "list";

  function section(title: string, rows: Reachable[], airports: Airport[]) {
    const wrap = document.createElement("section");
    const h = document.createElement("div");
    h.className = "label";
    h.textContent = `${title} · ${rows.length}`;
    wrap.appendChild(h);
    for (const r of rows) {
      const ap = airports[r.airport];
      if (!ap) continue;
      const row = document.createElement("button");
      row.className = "row";
      row.type = "button";
      row.innerHTML =
        `<span>${ap.city || ap.name} <em>${ap.iata}</em>${r.seasonal ? ' <i class="tag">seasonal</i>' : ""}</span>` +
        `<span class="mut">${formatDuration(r.minutes)}</span>`;
      row.addEventListener("mouseenter", () => opts.onHover(r.airport));
      row.addEventListener("mouseleave", () => opts.onHover(null));
      row.addEventListener("click", () => opts.onSelect(r.airport));
      wrap.appendChild(row);
    }
    return wrap;
  }

  return {
    el,
    update({ airports, a, b, shared, labelA, labelB }: {
      airports: Airport[]; a: Reachable[]; b: Reachable[];
      shared: Set<number>; labelA: string; labelB: string | null;
    }) {
      el.replaceChildren();
      if (!labelB) {
        if (a.length === 0) {
          const p = document.createElement("p");
          p.className = "empty";
          p.textContent = "No nonstop destinations within this flight time.";
          el.appendChild(p);
          return;
        }
        el.appendChild(section(`From ${labelA}`, a, airports));
        return;
      }
      el.appendChild(section("Reachable from both", a.filter((r) => shared.has(r.airport)), airports));
      el.appendChild(section(`${labelA} only`, a.filter((r) => !shared.has(r.airport)), airports));
      el.appendChild(section(`${labelB} only`, b.filter((r) => !shared.has(r.airport)), airports));
    },
  };
}
