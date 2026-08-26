import { expect, test } from "vitest";
import type { Airport } from "../data/bundle.js";
import { analyzeReach, meetingPlaces, type InsightGroup } from "./insights.js";

const airports: Airport[] = [
  { iata: "AAA", name: "Alpha", city: "Alpha", country: "AA", lat: 0, lon: 0, size: "large" },
  { iata: "BBB", name: "Beta", city: "Beta", country: "BB", lat: 0, lon: 0, size: "large" },
  { iata: "VIE", name: "Vienna", city: "Vienna", country: "AT", lat: 0, lon: 0, size: "large" },
  { iata: "PRG", name: "Prague", city: "Prague", country: "CZ", lat: 0, lon: 0, size: "large" },
  { iata: "LGW", name: "Gatwick", city: "London", country: "GB", lat: 0, lon: 0, size: "large" },
  { iata: "LHR", name: "Heathrow", city: "London", country: "GB", lat: 0, lon: 0, size: "large" },
  { iata: "AAX", name: "Alpha Regional", city: "Elsewhere", country: "AA", lat: 0, lon: 0, size: "small" },
];

const group = (
  id: string,
  codes: string[],
  originCountries: string[],
  destinations: Array<[number, number]>,
): InsightGroup => ({
  id,
  codes,
  originCountries,
  destinations: destinations.map(([airport, minutes]) => ({
    airport, minutes, seasonal: false, charter: false,
  })),
});

test("counts foreign countries without counting the origin country", () => {
  const result = analyzeReach(airports, [group("a", ["AAA"], ["AA"], [[2, 100], [3, 110], [6, 80]])]);
  expect(result.groups[0]).toMatchObject({ destinations: 3, countriesAbroad: 2 });
});

test("distinguishes exact shared airports from shared countries", () => {
  const result = analyzeReach(airports, [
    group("a", ["AAA"], ["AA"], [[2, 100], [4, 120]]),
    group("b", ["BBB"], ["BB"], [[2, 130], [5, 125]]),
  ]);
  expect(result.commonDestinations).toBe(1);
  expect(result.commonCountries).toBe(2);
});

test("groups different airports in one city and ranks by longest leg then fairness", () => {
  const groups = [
    group("a", ["AAA"], ["AA"], [[2, 100], [3, 115], [4, 90]]),
    group("b", ["BBB"], ["BB"], [[2, 130], [3, 120], [5, 125]]),
  ];
  const meetings = meetingPlaces(groups, airports);
  expect(meetings.map((meeting) => meeting.city)).toEqual(["Prague", "London", "Vienna"]);
  expect(meetings[1]).toMatchObject({ longestMinutes: 125, spreadMinutes: 35 });
});

test("reports destinations and new foreign countries at the next step", () => {
  const current = group("a", ["AAA"], ["AA"], [[2, 100]]);
  const next = group("a", ["AAA"], ["AA"], [[2, 100], [3, 115], [6, 110]]);
  expect(analyzeReach(airports, [current], [next]).nextUnlock).toEqual({
    kind: "reach", destinations: 2, countries: 1,
  });
});

test("reports newly mutual meeting cities at the next step", () => {
  const current = [
    group("a", ["AAA"], ["AA"], [[2, 100]]),
    group("b", ["BBB"], ["BB"], [[2, 130], [3, 130]]),
  ];
  const next = [
    group("a", ["AAA"], ["AA"], [[2, 100], [3, 140]]),
    group("b", ["BBB"], ["BB"], [[2, 130], [3, 130]]),
  ];
  const unlock = analyzeReach(airports, current, next).nextUnlock;
  expect(unlock?.kind).toBe("meetings");
  if (unlock?.kind === "meetings") expect(unlock.places.map((place) => place.city)).toEqual(["Prague"]);
});
