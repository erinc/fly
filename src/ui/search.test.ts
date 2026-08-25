// src/ui/search.test.ts
import { expect, test } from "vitest";
import { searchAirports, searchOptions } from "./search.js";
import type { Airport, Metro } from "../data/bundle.js";

const ap = (iata: string, name: string, city: string, country: string): Airport =>
  ({ iata, name, city, country, lat: 0, lon: 0, size: "large" });

const AIRPORTS = [
  ap("BER", "Berlin Brandenburg Airport", "Berlin", "DE"),
  ap("BCN", "Barcelona–El Prat Airport", "Barcelona", "ES"),
  ap("LHR", "Heathrow Airport", "London", "GB"),
  ap("LGW", "Gatwick Airport", "London", "GB"),
  ap("TXL", "Berlin Tegel", "Berlin", "DE"),
];

const LONDON: Metro = {
  id: "london-gb-lgw-lhr",
  city: "London",
  country: "GB",
  codes: ["LGW", "LHR"],
};

test("an exact IATA match ranks first", () => {
  expect(searchAirports(AIRPORTS, "BER")[0]?.iata).toBe("BER");
});

test("search is case-insensitive", () => {
  expect(searchAirports(AIRPORTS, "ber")[0]?.iata).toBe("BER");
});

test("finds every airport serving a city", () => {
  const codes = searchAirports(AIRPORTS, "London").map((a) => a.iata);
  expect(codes).toContain("LHR");
  expect(codes).toContain("LGW");
});

test("matches on airport name", () => {
  expect(searchAirports(AIRPORTS, "Heathrow")[0]?.iata).toBe("LHR");
});

test("matches on country code", () => {
  expect(searchAirports(AIRPORTS, "ES").map((a) => a.iata)).toContain("BCN");
});

test("an empty query returns nothing", () => {
  expect(searchAirports(AIRPORTS, "   ")).toEqual([]);
});

test("respects the result limit", () => {
  expect(searchAirports(AIRPORTS, "a", 2)).toHaveLength(2);
});

test("an unmatched query returns nothing", () => {
  expect(searchAirports(AIRPORTS, "zzzzz")).toEqual([]);
});

test("puts an all-airports option before individual airports for a city search", () => {
  const options = searchOptions(AIRPORTS, [LONDON], "London");
  expect(options[0]).toEqual({ kind: "metro", metro: LONDON });
  expect(options.filter((o) => o.kind === "airport").map((o) => o.airport.iata))
    .toEqual(expect.arrayContaining(["LHR", "LGW"]));
});

test("keeps an exact airport first for an IATA search", () => {
  expect(searchOptions(AIRPORTS, [LONDON], "LHR")[0]).toEqual({
    kind: "airport",
    airport: AIRPORTS[2],
  });
});
