// src/ui/list.ts
import type { Airport } from "../data/bundle.js";
import type { Reachable } from "../reach/query.js";
import { formatDuration } from "./format.js";

export type ListGroup = {
  origin: Airport;
  color: string;
  destinations: Reachable[];
};

const PANEL_ID = "list-tabpanel";

export function createList() {
  const el = document.createElement("div");
  el.className = "list";

  // Active tab, tracked by IATA code (not index) so it survives re-renders
  // triggered by the slider or the year-round toggle without jumping back
  // to the first tab.
  let activeIata: string | null = null;
  let lastArgs: { airports: Airport[]; groups: ListGroup[] } | null = null;

  function destinationRow(r: Reachable, airports: Airport[]) {
    const ap = airports[r.airport];
    if (!ap) return null;
    const row = document.createElement("div");
    row.className = "row";

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
    return row;
  }

  function renderPanelBody(panel: HTMLElement, group: ListGroup, airports: Airport[]) {
    if (group.destinations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No nonstop destinations within this flight time.";
      panel.appendChild(empty);
      return;
    }
    for (let i = group.destinations.length - 1; i >= 0; i--) {
      const r = group.destinations[i];
      if (!r) continue;
      const row = destinationRow(r, airports);
      if (row) panel.appendChild(row);
    }
  }

  function activate(iata: string) {
    if (!lastArgs) return;
    activeIata = iata;
    render(lastArgs);
  }

  function render({ airports, groups }: { airports: Airport[]; groups: ListGroup[] }) {
    lastArgs = { airports, groups };
    el.replaceChildren();

    if (groups.length === 0) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "Add an airport to see where you can fly nonstop.";
      el.appendChild(p);
      return;
    }

    // Resolve the active group: keep the current selection if it's still
    // present, otherwise fall back to the first remaining group.
    const activeGroup = groups.find((g) => g.origin.iata === activeIata) ?? groups[0]!;
    activeIata = activeGroup.origin.iata;

    if (groups.length >= 2) {
      const tablist = document.createElement("div");
      tablist.className = "tabs";
      tablist.setAttribute("role", "tablist");

      const tabButtons: HTMLButtonElement[] = [];

      groups.forEach((g, i) => {
        const tabId = `list-tab-${g.origin.iata}`;
        const isActive = g.origin.iata === activeIata;

        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = isActive ? "tab active" : "tab";
        tab.id = tabId;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.setAttribute("aria-controls", PANEL_ID);
        tab.tabIndex = isActive ? 0 : -1;

        const dot = document.createElement("i");
        dot.className = "dot";
        dot.style.background = g.color;
        const text = document.createElement("span");
        text.textContent = `${g.origin.city || g.origin.name} · ${g.destinations.length}`;
        tab.append(dot, text);

        tab.addEventListener("click", () => {
          if (activeIata !== g.origin.iata) activate(g.origin.iata);
        });

        tab.addEventListener("keydown", (ev) => {
          if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
          ev.preventDefault();
          const delta = ev.key === "ArrowRight" ? 1 : -1;
          const nextIndex = (i + delta + groups.length) % groups.length;
          const nextGroup = groups[nextIndex];
          if (!nextGroup) return;
          activate(nextGroup.origin.iata);
          tabButtons[nextIndex]?.focus();
        });

        tabButtons.push(tab);
        tablist.appendChild(tab);
      });

      el.appendChild(tablist);
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "tabpanel";
    if (groups.length >= 2) {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", `list-tab-${activeIata}`);
    }
    renderPanelBody(panel, activeGroup, airports);
    el.appendChild(panel);
  }

  return {
    el,
    update: render,
  };
}
