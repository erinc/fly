import { expect, test } from "vitest";
import { tooltipLines } from "./tooltip.js";
import type { Airport } from "../data/bundle.js";

const BCN: Airport = {
  iata: "BCN", name: "Josep Tarradellas Barcelona-El Prat Airport",
  city: "Barcelona", country: "ES", lat: 41.3, lon: 2.08, size: "large",
};

test("first line names the city and code", () => {
  expect(tooltipLines(BCN, [{ iata: "BER", minutes: 125 }])[0]).toBe("Barcelona (BCN)");
});

test("one line per reaching origin, with the flight time", () => {
  expect(tooltipLines(BCN, [{ iata: "BER", minutes: 125 }])).toEqual([
    "Barcelona (BCN)",
    "BER · 2h 05m",
  ]);
});

test("lists every reaching origin", () => {
  expect(tooltipLines(BCN, [
    { iata: "BER", minutes: 125 },
    { iata: "LIS", minutes: 110 },
    { iata: "IST", minutes: 200 },
  ])).toEqual([
    "Barcelona (BCN)",
    "BER · 2h 05m",
    "LIS · 1h 50m",
    "IST · 3h 20m",
  ]);
});

test("falls back to the airport name when the city is blank", () => {
  const noCity = { ...BCN, city: "" };
  expect(tooltipLines(noCity, [])[0]).toBe(
    "Josep Tarradellas Barcelona-El Prat Airport (BCN)",
  );
});

test("with no reaching origins only the heading is returned", () => {
  expect(tooltipLines(BCN, [])).toHaveLength(1);
});
