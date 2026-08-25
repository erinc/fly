import { expect, test } from "vitest";
import {
  DEFAULT_STATE,
  MAX_MINUTES,
  MIN_MINUTES,
  parseState,
  routeLimit,
  toSearch,
} from "./url.js";

// Airport tests
test("parses a comma-separated airport list", () => {
  expect(parseState("?a=BER,LIS,IST").airports).toEqual(["BER", "LIS", "IST"]);
});

test("parses a single airport", () => {
  expect(parseState("?a=BER").airports).toEqual(["BER"]);
});

test("an empty search yields no airports", () => {
  expect(parseState("").airports).toEqual([]);
});

test("upper-cases codes", () => {
  expect(parseState("?a=ber,lis").airports).toEqual(["BER", "LIS"]);
});

test("drops codes that are not three letters", () => {
  expect(parseState("?a=BER,BERLIN,LI,LIS").airports).toEqual(["BER", "LIS"]);
});

test("drops duplicates, keeping first occurrence", () => {
  expect(parseState("?a=BER,LIS,BER").airports).toEqual(["BER", "LIS"]);
});

test("caps at three airports", () => {
  expect(parseState("?a=BER,LIS,IST,BKK,LHR").airports).toEqual(["BER", "LIS", "IST"]);
});

test("folds the legacy two-parameter form", () => {
  expect(parseState("?a=BER&b=LIS&t=180").airports).toEqual(["BER", "LIS"]);
});

test("legacy b alone still yields an airport", () => {
  expect(parseState("?b=LIS").airports).toEqual(["LIS"]);
});

test("toSearch emits the canonical comma-separated form", () => {
  expect(toSearch({ airports: ["BER", "LIS"], minutes: 180, yearRoundOnly: false }))
    .toBe("?a=BER%2CLIS&t=180");
});

test("toSearch omits the airport parameter when none are selected", () => {
  expect(toSearch({ airports: [], minutes: 180, yearRoundOnly: false })).toBe("?t=180");
});

test("round-trips through toSearch", () => {
  const state = { airports: ["BER", "LIS", "IST"], minutes: 195, yearRoundOnly: true };
  expect(parseState(toSearch(state))).toEqual(state);
});

test("DEFAULT_STATE has no airports", () => {
  expect(DEFAULT_STATE.airports).toEqual([]);
});

// Minutes tests
test("clamps the budget below the minimum", () => {
  expect(parseState("?t=5").minutes).toBe(MIN_MINUTES);
});

test("clamps the budget above the maximum", () => {
  expect(parseState("?t=99999").minutes).toBe(MAX_MINUTES);
});

test("uses the 12-hour endpoint as an all-routes sentinel", () => {
  expect(MAX_MINUTES).toBe(720);
  expect(routeLimit(MAX_MINUTES - 15)).toBe(705);
  expect(routeLimit(MAX_MINUTES)).toBe(Number.POSITIVE_INFINITY);
});

test("snaps the budget to the 15-minute step", () => {
  expect(parseState("?t=187").minutes).toBe(180);
});

test("a non-numeric budget falls back to the default", () => {
  expect(parseState("?t=soon").minutes).toBe(DEFAULT_STATE.minutes);
});
