import { expect, test } from "vitest";
import { countryFlag } from "./flag.js";

test("converts ISO country codes to flag emoji", () => {
  expect(countryFlag("PT")).toBe("🇵🇹");
  expect(countryFlag("gb")).toBe("🇬🇧");
});

test("ignores invalid country codes", () => {
  expect(countryFlag("")).toBe("");
  expect(countryFlag("USA")).toBe("");
});
