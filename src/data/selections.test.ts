import { expect, test } from "vitest";
import type { Metro } from "./bundle.js";
import { addSelection, flattenSelections, selectionsFromCodes } from "./selections.js";

const BANGKOK: Metro = {
  id: "bangkok-th-bkk-dmk",
  city: "Bangkok",
  country: "TH",
  codes: ["BKK", "DMK"],
};

test("reconstructs one metro selection when every airport is present", () => {
  expect(selectionsFromCodes(["BKK", "DMK"], [BANGKOK])).toEqual([
    { kind: "metro", metro: BANGKOK },
  ]);
});

test("keeps a partial metro as an individual airport", () => {
  expect(selectionsFromCodes(["BKK"], [BANGKOK])).toEqual([
    { kind: "airport", code: "BKK" },
  ]);
});

test("preserves selection order around a metro group", () => {
  const selections = selectionsFromCodes(["LIS", "DMK", "BKK", "BER"], [BANGKOK]);
  expect(selections.map((s) => s.kind === "metro" ? s.metro.city : s.code))
    .toEqual(["LIS", "Bangkok", "BER"]);
});

test("flattens metro selections for backwards-compatible URLs", () => {
  expect(flattenSelections([
    { kind: "metro", metro: BANGKOK },
    { kind: "airport", code: "LIS" },
  ])).toEqual(["BKK", "DMK", "LIS"]);
});

test("adding the second member upgrades an individual airport to one metro selection", () => {
  const selected = [{ kind: "airport" as const, code: "BKK" }];
  expect(addSelection(selected, { kind: "airport", code: "DMK" }, [BANGKOK], 3))
    .toEqual([{ kind: "metro", metro: BANGKOK }]);
});

test("a metro can replace an overlapping airport even at the selection limit", () => {
  const selected = [
    { kind: "airport" as const, code: "BKK" },
    { kind: "airport" as const, code: "LIS" },
    { kind: "airport" as const, code: "BER" },
  ];
  expect(addSelection(selected, { kind: "metro", metro: BANGKOK }, [BANGKOK], 3))
    .toHaveLength(3);
});
