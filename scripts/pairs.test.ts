import { expect, test } from "vitest";
import { collectPairs, type PairDoc } from "./pairs.js";
import type { AirportRow } from "./sources/ourairports.js";
import { FLAG_CHARTER, FLAG_SEASONAL } from "../src/data/format.js";

const airport = (iata: string): AirportRow => ({
  iata, name: iata, city: iata, country: "XX", lat: 0, lon: 0, size: "large",
});

const byIata = new Map<string, AirportRow>([
  ["AAA", airport("AAA")],
  ["BBB", airport("BBB")],
]);

test("stores pair endpoints sorted regardless of crawl order", () => {
  const docs: PairDoc[] = [
    { iata: "BBB", destinations: [{ iata: "AAA", seasonal: false, charter: false }] },
  ];
  const pairs = collectPairs(docs, byIata);
  expect(pairs.get("AAA BBB")).toEqual({ a: "AAA", b: "BBB", flags: 0 });
});

test("deduplicates a pair reported from both origins", () => {
  const docs: PairDoc[] = [
    { iata: "AAA", destinations: [{ iata: "BBB", seasonal: false, charter: false }] },
    { iata: "BBB", destinations: [{ iata: "AAA", seasonal: false, charter: false }] },
  ];
  const pairs = collectPairs(docs, byIata);
  expect(pairs.size).toBe(1);
});

test("a route reported seasonal by one endpoint and year-round by the other is year-round", () => {
  const docs: PairDoc[] = [
    { iata: "AAA", destinations: [{ iata: "BBB", seasonal: true, charter: false }] },
    { iata: "BBB", destinations: [{ iata: "AAA", seasonal: false, charter: false }] },
  ];
  const pairs = collectPairs(docs, byIata);
  expect((pairs.get("AAA BBB")?.flags ?? 0) & FLAG_SEASONAL).toBe(0);
});

test("a route reported charter by one endpoint and scheduled by the other is scheduled", () => {
  const docs: PairDoc[] = [
    { iata: "AAA", destinations: [{ iata: "BBB", seasonal: false, charter: true }] },
    { iata: "BBB", destinations: [{ iata: "AAA", seasonal: false, charter: false }] },
  ];
  const pairs = collectPairs(docs, byIata);
  expect((pairs.get("AAA BBB")?.flags ?? 0) & FLAG_CHARTER).toBe(0);
});

test("a route reported seasonal by both endpoints stays seasonal", () => {
  const docs: PairDoc[] = [
    { iata: "AAA", destinations: [{ iata: "BBB", seasonal: true, charter: false }] },
    { iata: "BBB", destinations: [{ iata: "AAA", seasonal: true, charter: false }] },
  ];
  const pairs = collectPairs(docs, byIata);
  expect((pairs.get("AAA BBB")?.flags ?? 0) & FLAG_SEASONAL).toBe(FLAG_SEASONAL);
});

test("drops destinations to or from an airport missing from the shipped set", () => {
  const docs: PairDoc[] = [
    { iata: "AAA", destinations: [{ iata: "ZZZ", seasonal: false, charter: false }] },
  ];
  expect(collectPairs(docs, byIata).size).toBe(0);
});

test("drops a self-referential destination", () => {
  const docs: PairDoc[] = [
    { iata: "AAA", destinations: [{ iata: "AAA", seasonal: false, charter: false }] },
  ];
  expect(collectPairs(docs, byIata).size).toBe(0);
});
