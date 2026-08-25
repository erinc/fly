import { expect, test } from "vitest";
import { decodeRoutes, encodeRoutes, FLAG_CHARTER, FLAG_SEASONAL } from "./format.js";

const SAMPLE = [
  { a: 0, b: 1, minutes: 95, flags: 0 },
  { a: 1, b: 2, minutes: 480, flags: FLAG_SEASONAL },
  { a: 0, b: 2, minutes: 40, flags: FLAG_SEASONAL | FLAG_CHARTER },
];

test("round-trips route records", () => {
  const t = decodeRoutes(encodeRoutes(SAMPLE));
  expect(t.count).toBe(3);
  expect([...t.a]).toEqual([0, 1, 0]);
  expect([...t.b]).toEqual([1, 2, 2]);
  expect([...t.minutes]).toEqual([95, 480, 40]);
  expect([...t.flags]).toEqual([0, FLAG_SEASONAL, FLAG_SEASONAL | FLAG_CHARTER]);
});

test("round-trips an empty table", () => {
  expect(decodeRoutes(encodeRoutes([])).count).toBe(0);
});

test("byte length matches the documented layout", () => {
  expect(encodeRoutes(SAMPLE).byteLength).toBe(8 + 3 * 7);
});

test("rejects a buffer with the wrong magic", () => {
  const bad = new Uint8Array(encodeRoutes(SAMPLE));
  bad[0] = 88;
  expect(() => decodeRoutes(bad.buffer)).toThrow(/magic/i);
});

test("handles airport indices above 255", () => {
  const t = decodeRoutes(encodeRoutes([{ a: 3000, b: 4000, minutes: 300, flags: 0 }]));
  expect(t.a[0]).toBe(3000);
  expect(t.b[0]).toBe(4000);
});
