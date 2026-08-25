import { expect, test } from "vitest";
import { findDestinationSection, parseDestinations } from "./destinations.js";

const TITLES: Record<string, string> = {
  "Heathrow Airport": "LHR",
  "Barcelona–El Prat Airport": "BCN",
  "Faro Airport": "FAO",
  "Palma de Mallorca Airport": "PMI",
  // Airlines deliberately absent — they must drop out.
};

const NOW = new Date("2026-08-25T00:00:00Z");

test("finds the plural 'Airlines and destinations' section", () => {
  const wt = "== History ==\nfoo\n\n== Airlines and destinations ==\nbar\n\n== See also ==\nbaz";
  expect(findDestinationSection(wt)?.trim()).toBe("bar");
});

test("finds the singular 'Airline and destinations' section", () => {
  const wt = "== Facilities ==\nfoo\n\n== Airline and destinations ==\nbar\n\n== References ==\nbaz";
  expect(findDestinationSection(wt)?.trim()).toBe("bar");
});

test("returns null when there is no destinations section", () => {
  expect(findDestinationSection("== History ==\nnothing here")).toBeNull();
});

test("resolves destination wikilinks to IATA codes and drops airlines", () => {
  const wt = `== Airlines and destinations ==
{| class="wikitable"
| [[British Airways]] | [[Heathrow Airport]], [[Faro Airport]]
|}`;
  expect(parseDestinations(wt, TITLES, NOW).map((d) => d.iata).sort()).toEqual(["FAO", "LHR"]);
});

test("honours piped wikilinks", () => {
  const wt = `== Airlines and destinations ==
| [[Barcelona–El Prat Airport|Barcelona]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.iata).toBe("BCN");
});

test("flags seasonal routes rather than dropping them", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] <ref>x</ref> ''seasonal''`;
  const dests = parseDestinations(wt, TITLES, NOW);
  expect(dests).toEqual([{ iata: "FAO", seasonal: true, charter: false }]);
});

test("flags charter routes", () => {
  const wt = `== Airlines and destinations ==
'''Charter:''' [[Palma de Mallorca Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.charter).toBe(true);
});

test("excludes routes that have not begun yet", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] (begins 1 December 2026)`;
  expect(parseDestinations(wt, TITLES, NOW)).toEqual([]);
});

test("excludes routes that have already ended", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] (ends 1 January 2026)`;
  expect(parseDestinations(wt, TITLES, NOW)).toEqual([]);
});

test("deduplicates a destination served by several airlines", () => {
  const wt = `== Airlines and destinations ==
| [[British Airways]] | [[Faro Airport]]
| [[Ryanair]] | [[Faro Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)).toHaveLength(1);
});

test("a seasonal listing plus a year-round listing is not seasonal", () => {
  const wt = `== Airlines and destinations ==
| [[Faro Airport]] ''seasonal''
| [[Faro Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.seasonal).toBe(false);
});

test("returns an empty array when the section is missing", () => {
  expect(parseDestinations("== History ==\nnope", TITLES, NOW)).toEqual([]);
});

test("flags charter routes under a list-marker-prefixed subheading", () => {
  const wt = `== Airlines and destinations ==
* '''Charter:'''
| [[Palma de Mallorca Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW)[0]?.charter).toBe(true);
});

test("does not stop the section at a nested subheading", () => {
  const wt = `== Airlines and destinations ==
| [[Heathrow Airport]]
=== Charter ===
| [[Faro Airport]]
== References ==
| [[Barcelona–El Prat Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW).map((d) => d.iata).sort()).toEqual(["FAO", "LHR"]);
});

test("stops the section at a sibling heading", () => {
  const wt = `== Airlines and destinations ==
| [[Heathrow Airport]]
== References ==
| [[Faro Airport]]`;
  expect(parseDestinations(wt, TITLES, NOW).map((d) => d.iata)).toEqual(["LHR"]);
});
