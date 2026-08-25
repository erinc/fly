import { expect, test } from "vitest";
import { generateMetros, metroCity, type MetroAirport } from "./metros.js";

const airport = (
  iata: string,
  city: string,
  country: string,
  lat: number,
  lon: number,
): MetroAirport => ({ iata, city, country, lat, lon });

test("generates Bangkok and Istanbul groups from city, country and proximity", () => {
  const metros = generateMetros([
    airport("BKK", "Bangkok", "TH", 13.69, 100.75),
    airport("DMK", "Bangkok", "TH", 13.91, 100.61),
    airport("IST", "Istanbul", "TR", 41.26, 28.74),
    airport("SAW", "Istanbul", "TR", 40.90, 29.31),
  ]);
  expect(metros.map((m) => [m.city, m.codes])).toEqual([
    ["Bangkok", ["BKK", "DMK"]],
    ["Istanbul", ["IST", "SAW"]],
  ]);
});

test("does not merge distant same-name cities in one country", () => {
  const metros = generateMetros([
    airport("JAC", "Jackson", "US", 43.61, -110.74),
    airport("JAN", "Jackson", "US", 32.31, -90.08),
    airport("MKL", "Jackson", "US", 35.60, -88.92),
  ]);
  expect(metros).toEqual([]);
});

test("does not merge matching cities in different countries", () => {
  const metros = generateMetros([
    airport("LHR", "London", "GB", 51.47, -0.46),
    airport("YXU", "London", "CA", 43.03, -81.15),
  ]);
  expect(metros).toEqual([]);
});

test("uses a parenthetical airport qualifier's leading served city", () => {
  expect(metroCity("Tokyo (Narita)")).toBe("Tokyo");
});
