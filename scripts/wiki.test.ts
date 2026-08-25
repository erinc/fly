import { expect, test } from "vitest";
import { buildQueryUrl, chunk, extractPages } from "./wiki.js";

test("chunk splits into batches of at most n", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunk of an empty list is empty", () => {
  expect(chunk([], 50)).toEqual([]);
});

test("query url always sets redirects=1", () => {
  expect(buildQueryUrl(["A"])).toContain("redirects=1");
});

test("query url requests raw wikitext content", () => {
  const url = buildQueryUrl(["A"]);
  expect(url).toContain("prop=revisions");
  expect(url).toContain("rvprop=content");
  expect(url).toContain("rvslots=main");
});

test("query url joins titles with a pipe", () => {
  expect(decodeURIComponent(buildQueryUrl(["Heathrow Airport", "Eek Airport"])))
    .toContain("Heathrow Airport|Eek Airport");
});

test("extractPages maps title to wikitext", () => {
  const json = {
    query: {
      pages: [{ title: "Eek Airport", revisions: [{ slots: { main: { content: "hello" } } }] }],
    },
  };
  expect(extractPages(json).get("Eek Airport")).toBe("hello");
});

test("extractPages follows redirect normalisation back to the requested title", () => {
  const json = {
    query: {
      redirects: [{ from: "London Heathrow Airport", to: "Heathrow Airport" }],
      pages: [{ title: "Heathrow Airport", revisions: [{ slots: { main: { content: "x" } } }] }],
    },
  };
  const pages = extractPages(json);
  expect(pages.get("Heathrow Airport")).toBe("x");
  expect(pages.get("London Heathrow Airport")).toBe("x");
});

test("extractPages skips missing pages", () => {
  const json = { query: { pages: [{ title: "Nope", missing: true }] } };
  expect(extractPages(json).size).toBe(0);
});
