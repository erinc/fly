import type { ReachInsights } from "../reach/insights.js";
import { countryFlag } from "./flag.js";
import { formatDuration } from "./format.js";
import { originColor } from "../theme.js";

function metric(value: number, label: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "insight-metric";
  const number = document.createElement("strong");
  number.textContent = String(value);
  const caption = document.createElement("span");
  caption.textContent = label;
  el.append(number, caption);
  return el;
}

function meetingRow(
  place: ReachInsights["meetings"][number],
  rank: number,
  airports: { iata: string }[],
): HTMLElement {
  const row = document.createElement("details");
  row.className = "meeting-details";
  const summary = document.createElement("summary");
  summary.className = "meeting";

  const position = document.createElement("span");
  position.className = "meeting-rank";
  position.textContent = String(rank);

  const placeEl = document.createElement("span");
  placeEl.className = "meeting-place";
  const flag = countryFlag(place.country);
  const destinationCodes = [...new Set(place.legs.flatMap((leg) => {
    const code = airports[leg.airport]?.iata;
    return code ? [code] : [];
  }))];
  const airportLabel = destinationCodes.length > 0 ? ` (${destinationCodes.join("/")})` : "";
  placeEl.textContent = `${flag ? `${flag} ` : ""}${place.city}${airportLabel}`;

  const time = document.createElement("span");
  time.className = "meeting-time";
  time.textContent = `${formatDuration(place.longestMinutes)} max`;
  time.title = `Longest flight ${formatDuration(place.longestMinutes)}; ${formatDuration(place.spreadMinutes)} difference between travelers`;

  summary.append(position, placeEl, time);
  row.appendChild(summary);

  const legs = document.createElement("div");
  legs.className = "meeting-legs";
  place.legs.forEach((leg, index) => {
    const legEl = document.createElement("div");
    legEl.className = "meeting-leg";
    const origin = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = "origin-dot";
    dot.style.background = originColor(index);
    const destination = airports[leg.airport]?.iata ?? place.city;
    origin.append(dot, document.createTextNode(`${leg.codes.join("+")} → ${destination}`));
    const duration = document.createElement("span");
    duration.textContent = formatDuration(leg.minutes);
    legEl.append(origin, duration);
    legs.appendChild(legEl);
  });
  row.appendChild(legs);
  return row;
}

export function createInsights(airports: { iata: string }[]) {
  const el = document.createElement("section");
  el.className = "insights";
  el.setAttribute("aria-label", "Reach insights");

  function update(insights: ReachInsights | null): void {
    el.replaceChildren();
    el.hidden = !insights || insights.groups.length === 0;
    if (!insights || insights.groups.length === 0) return;

    const heading = document.createElement("h2");
    heading.textContent = insights.groups.length === 1 ? "Where you can fly" : "Common reach";
    el.appendChild(heading);

    const metrics = document.createElement("div");
    metrics.className = "insight-metrics";
    if (insights.groups.length === 1) {
      const group = insights.groups[0]!;
      metrics.append(
        metric(group.destinations, group.destinations === 1 ? "destination" : "destinations"),
        metric(group.countriesAbroad, "countries"),
      );
    } else {
      metrics.append(
        metric(insights.commonDestinations, "shared destinations"),
        metric(insights.commonCountries, "shared countries"),
      );
    }
    el.appendChild(metrics);

    if (insights.groups.length > 1) {
      const meetingHeading = document.createElement("h3");
      meetingHeading.textContent = "Easiest places to meet";
      el.appendChild(meetingHeading);
      const meetingExplainer = document.createElement("p");
      meetingExplainer.className = "insight-explainer";
      meetingExplainer.textContent = "Ranked by the longest flight anyone takes";
      el.appendChild(meetingExplainer);
      if (insights.meetings.length > 0) {
        const meetings = document.createElement("div");
        meetings.className = "meetings";
        insights.meetings.slice(0, 3).forEach((place, index) => {
          meetings.appendChild(meetingRow(place, index + 1, airports));
        });
        el.appendChild(meetings);
      } else {
        const none = document.createElement("p");
        none.className = "insight-none";
        none.textContent = "No mutual nonstop meeting place at this flight time.";
        el.appendChild(none);
      }

      const originHeading = document.createElement("h3");
      originHeading.textContent = "Countries reachable from each";
      el.appendChild(originHeading);
      const countryLine = document.createElement("div");
      countryLine.className = "insight-by-origin";
      insights.groups.forEach((group, index) => {
        const item = document.createElement("span");
        const dot = document.createElement("i");
        dot.className = "origin-dot";
        dot.style.background = originColor(index);
        const count = document.createElement("strong");
        count.textContent = String(group.countriesAbroad);
        item.append(dot, document.createTextNode(`${group.codes.join("+")} `), count);
        countryLine.appendChild(item);
      });
      el.appendChild(countryLine);
    }

    if (insights.nextUnlock) {
      const unlock = document.createElement("p");
      unlock.className = "insight-unlock";
      if (insights.nextUnlock.kind === "reach") {
        const { destinations, countries } = insights.nextUnlock;
        const destinationLabel = destinations === 1 ? "destination" : "destinations";
        const countryCopy = countries > 0
          ? ` and ${countries} new ${countries === 1 ? "country" : "countries"}`
          : "";
        unlock.textContent = `+15m unlocks ${destinations} ${destinationLabel}${countryCopy}.`;
      } else {
        const places = insights.nextUnlock.places;
        const names = places.slice(0, 2).map((place) => place.city).join(" and ");
        const more = places.length > 2 ? ` +${places.length - 2} more` : "";
        unlock.textContent = `+15m lets everyone reach ${names}${more}.`;
      }
      el.appendChild(unlock);
    }
  }

  return { el, update };
}
