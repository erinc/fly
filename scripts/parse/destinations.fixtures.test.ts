import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { findDestinationSection, parseDestinations } from "./destinations.js";

const load = (iata: string) =>
  readFileSync(new URL(`./fixtures/${iata}.wikitext`, import.meta.url), "utf8");

// A minimal real title->IATA map, enough to assert on known destinations.
// Note: Wikipedia's current article links the Barcelona airport under its
// renamed title "Josep Tarradellas Barcelona–El Prat Airport", not the
// older "Barcelona–El Prat Airport" — using the live title is itself part
// of what these fixtures pin down.
const TITLES: Record<string, string> = {
  "Josep Tarradellas Barcelona–El Prat Airport": "BCN",
  "Amsterdam Airport Schiphol": "AMS",
  "Zurich Airport": "ZRH",
  "Frankfurt Airport": "FRA",
  "Munich Airport": "MUC",
  "Erbil International Airport": "EBL",
  "Bethel Airport": "BET",
};

test("BER: finds a large destinations section with seasonal markers", () => {
  const wt = load("BER");
  const section = findDestinationSection(wt);
  expect(section).not.toBeNull();
  expect(section!.length).toBeGreaterThan(5000);
  expect(/seasonal/i.test(section!)).toBe(true);
});

test("BER: resolves known current destinations", () => {
  const codes = parseDestinations(load("BER"), TITLES).map((d) => d.iata);
  // EBL (FlyErbil, an airline that only began operating in 2023) is a route
  // that postdates BER's 2020 opening; its presence proves the data is current.
  expect(codes).toContain("EBL");
  expect(codes).toContain("BCN");
});

test("LHR: redirect title still yields a destinations section", () => {
  // Guards the redirects=1 requirement — without it this fixture is an empty stub.
  const section = findDestinationSection(load("LHR"));
  expect(section).not.toBeNull();
  expect(section!.length).toBeGreaterThan(2000);
});

test("EEK: a sparse regional airport still parses without throwing", () => {
  expect(() => parseDestinations(load("EEK"), TITLES)).not.toThrow();
});

test("every parsed destination has a three-letter IATA code", () => {
  for (const d of parseDestinations(load("BER"), TITLES)) {
    expect(d.iata).toMatch(/^[A-Z]{3}$/);
  }
});
