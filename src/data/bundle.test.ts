import { expect, test } from "vitest";
import { encodeRoutes, decodeRoutes } from "./format.js";
import { buildAdjacency, parseAirports } from "./bundle.js";

test("parses the compact airport tuple format", () => {
  const json = { airports: [["LHR", "Heathrow Airport", "London", "GB", 51.47, -0.46, "large"]] };
  expect(parseAirports(json)).toEqual([
    { iata: "LHR", name: "Heathrow Airport", city: "London", country: "GB", lat: 51.47, lon: -0.46, size: "large" },
  ]);
});

test("adjacency lists the route indices touching each airport", () => {
  const routes = decodeRoutes(encodeRoutes([
    { a: 0, b: 1, minutes: 60, flags: 0 },
    { a: 0, b: 2, minutes: 90, flags: 0 },
    { a: 1, b: 2, minutes: 30, flags: 0 },
  ]));
  const adj = buildAdjacency(3, routes);
  expect(adj[0]).toEqual([0, 1]);
  expect(adj[1]).toEqual([0, 2]);
  expect(adj[2]).toEqual([1, 2]);
});

test("an airport with no routes gets an empty list, not undefined", () => {
  const routes = decodeRoutes(encodeRoutes([{ a: 0, b: 1, minutes: 60, flags: 0 }]));
  expect(buildAdjacency(3, routes)[2]).toEqual([]);
});
