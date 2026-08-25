import { expect, test } from "vitest";
import { DEFAULT_STATE, MAX_MINUTES, MIN_MINUTES, parseState, toSearch } from "./url.js";

test("parses both airports and the time budget", () => {
  expect(parseState("?a=BER&b=LIS&t=180")).toEqual({
    a: "BER", b: "LIS", minutes: 180, yearRoundOnly: false,
  });
});

test("an empty search yields the defaults", () => {
  expect(parseState("")).toEqual(DEFAULT_STATE);
});

test("a single airport is a valid state", () => {
  expect(parseState("?a=BER").b).toBeNull();
});

test("airport codes are upper-cased", () => {
  expect(parseState("?a=ber").a).toBe("BER");
});

test("rejects codes that are not three letters", () => {
  expect(parseState("?a=BERLIN").a).toBeNull();
});

test("clamps the budget below the minimum", () => {
  expect(parseState("?t=5").minutes).toBe(MIN_MINUTES);
});

test("clamps the budget above the maximum", () => {
  expect(parseState("?t=99999").minutes).toBe(MAX_MINUTES);
});

test("snaps the budget to the 15-minute step", () => {
  expect(parseState("?t=187").minutes).toBe(180);
});

test("a non-numeric budget falls back to the default", () => {
  expect(parseState("?t=soon").minutes).toBe(DEFAULT_STATE.minutes);
});

test("round-trips through toSearch", () => {
  const state = { a: "BER", b: "LIS", minutes: 195, yearRoundOnly: true };
  expect(parseState(toSearch(state))).toEqual(state);
});

test("omits empty slots from the query string", () => {
  expect(toSearch({ a: "BER", b: null, minutes: 180, yearRoundOnly: false }))
    .toBe("?a=BER&t=180");
});
