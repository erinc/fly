// src/ui/format.test.ts
import { expect, test } from "vitest";
import { formatDuration } from "./format.js";

test("formats whole hours", () => {
  expect(formatDuration(180)).toBe("3h 00m");
});

test("formats hours and minutes", () => {
  expect(formatDuration(195)).toBe("3h 15m");
});

test("formats under an hour", () => {
  expect(formatDuration(45)).toBe("45m");
});

test("formats the slider maximum", () => {
  expect(formatDuration(480)).toBe("8h 00m");
});

test("pads single-digit minutes", () => {
  expect(formatDuration(125)).toBe("2h 05m");
});
