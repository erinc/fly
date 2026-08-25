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

      const left = document.createElement("span");
      left.append(`${ap.city || ap.name} `);
      const em = document.createElement("em");
      em.textContent = ap.iata;
      left.appendChild(em);
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
      if (a.length === 0 && b.length === 0) {
        const p = document.createElement("p");
        p.className = "empty";
        p.textContent = `No nonstop destinations within this flight time from ${labelA} or ${labelB}.`;
        el.appendChild(p);
        return;
      }
      const bothWrap = section("Reachable from both", a.filter((r) => shared.has(r.airport)), airports);
      if (shared.size === 0) {
        const note = document.createElement("p");
        note.className = "empty";
        note.textContent = "No overlap at this flight time — see each airport's destinations below.";
        bothWrap.insertBefore(note, bothWrap.children[1] ?? null);
      }
      el.appendChild(bothWrap);
      el.appendChild(section(`${labelA} only`, a.filter((r) => !shared.has(r.airport)), airports));
      el.appendChild(section(`${labelB} only`, b.filter((r) => !shared.has(r.airport)), airports));
    },
  };
}
