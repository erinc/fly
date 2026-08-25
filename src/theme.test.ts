import { expect, test } from "vitest";
import { MAX_AIRPORTS, ORIGIN_COLORS, originColor } from "./theme.js";

test("three origin colours are defined, in order", () => {
  expect(ORIGIN_COLORS).toEqual(["#d94f45", "#2b6cb0", "#2e7d4f"]);
});

test("MAX_AIRPORTS matches the palette length", () => {
  expect(MAX_AIRPORTS).toBe(3);
  expect(ORIGIN_COLORS).toHaveLength(MAX_AIRPORTS);
});

test("originColor maps position to colour", () => {
  expect(originColor(0)).toBe("#d94f45");
  expect(originColor(1)).toBe("#2b6cb0");
  expect(originColor(2)).toBe("#2e7d4f");
});

test("originColor wraps rather than returning undefined", () => {
  expect(originColor(3)).toBe("#d94f45");
});
