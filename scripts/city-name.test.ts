import { expect, test } from "vitest";
import { cleanCityName, resolveCityName, CITY_OVERRIDES } from "./city-name.js";

test("passes ordinary names through untouched", () => {
  expect(cleanCityName("Annaba")).toBe("Annaba");
  expect(cleanCityName("Al Ain")).toBe("Al Ain");
  expect(cleanCityName("São Paulo")).toBe("São Paulo");
  expect(cleanCityName("St. Mary's")).toBe("St. Mary's");
});

test("strips a trailing parenthetical", () => {
  expect(cleanCityName("Paris (Roissy-en-France, Val-d'Oise)")).toBe("Paris");
  expect(cleanCityName("Segrate (MI)")).toBe("Segrate");
  expect(cleanCityName("Orio al Serio (BG)")).toBe("Orio al Serio");
  expect(cleanCityName("Ferno (VA)")).toBe("Ferno");
});

test("strips a trailing parenthetical with no preceding space", () => {
  expect(cleanCityName("Dubai(Jebel Ali)")).toBe("Dubai");
  expect(cleanCityName("Qeshm(Dayrestan)")).toBe("Qeshm");
});

test("strips a trailing parenthetical with extra internal whitespace", () => {
  expect(cleanCityName("Kaili  (Huangping)")).toBe("Kaili");
});

test("strips a trailing ', Suffix'", () => {
  expect(cleanCityName("London, Essex")).toBe("London");
  expect(cleanCityName("Colombier-Saugnieu, Rhône")).toBe("Colombier-Saugnieu");
  expect(cleanCityName("Birmingham, West Midlands")).toBe("Birmingham");
});

test("collapses an exact duplicate 'X, X'", () => {
  expect(cleanCityName("Luton, Luton")).toBe("Luton");
});

test("cleaning alone can produce the wrong half of a reversed 'suburb, city' pair", () => {
  // This is exactly why CGN/CFU/EDI/SAW need IATA overrides below:
  // generic cleaning cannot know which side of the comma/parens is the
  // real city.
  expect(cleanCityName("Ingliston, Edinburgh")).toBe("Ingliston");
  expect(cleanCityName("Pendik, Istanbul")).toBe("Pendik");
  expect(cleanCityName("Köln (Cologne)")).toBe("Köln");
});

test("does not mangle a hyphenated or apostrophe-bearing name with no trailing junk", () => {
  expect(cleanCityName("Colombier-Saugnieu")).toBe("Colombier-Saugnieu");
  expect(cleanCityName("Yan'an")).toBe("Yan'an");
  expect(cleanCityName("Forlì")).toBe("Forlì");
});

test("resolveCityName lets an override win over cleaning", () => {
  expect(resolveCityName("BRU", "Zaventem")).toBe("Brussels");
  expect(resolveCityName("LIN", "Segrate (MI)")).toBe("Milan");
  expect(resolveCityName("MXP", "Ferno (VA)")).toBe("Milan");
  expect(resolveCityName("BGY", "Orio al Serio (BG)")).toBe("Bergamo (Milan)");
  expect(resolveCityName("LYS", "Colombier-Saugnieu, Rhône")).toBe("Lyon");
  expect(resolveCityName("CGN", "Köln (Cologne)")).toBe("Cologne");
});

test("resolveCityName fixes reversed 'suburb, city' pairs found by scanning cleaned output", () => {
  expect(resolveCityName("SPN", "I Fadang, Saipan")).toBe("Saipan");
  expect(resolveCityName("BWX", "Rogojampi, Banyuwangi")).toBe("Banyuwangi");
  expect(resolveCityName("TRE", "Balemartine, Argyll and Bute")).toBe("Tiree");
});

test("resolveCityName falls back to cleaning when no override exists", () => {
  expect(resolveCityName("STN", "London, Essex")).toBe("London");
  expect(resolveCityName("LTN", "Luton, Luton")).toBe("Luton");
  expect(resolveCityName("CDG", "Paris (Roissy-en-France, Val-d'Oise)")).toBe("Paris");
  expect(resolveCityName("AAE", "Annaba")).toBe("Annaba");
});

test("every override key is a plausible 3-letter IATA code", () => {
  for (const iata of Object.keys(CITY_OVERRIDES)) {
    expect(iata).toMatch(/^[A-Z]{3}$/);
  }
});

test("override map has no empty values", () => {
  for (const [iata, city] of Object.entries(CITY_OVERRIDES)) {
    expect(city.trim().length, `override for ${iata} is empty`).toBeGreaterThan(0);
  }
});
