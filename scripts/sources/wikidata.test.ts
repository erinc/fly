import { expect, test } from "vitest";
import { parseSparqlBindings, USER_AGENT } from "./wikidata.js";

const binding = (iata: string, article: string) => ({
  iata: { value: iata },
  art: { value: `https://en.wikipedia.org/wiki/${article}` },
});

test("maps IATA codes to decoded article titles", () => {
  const json = {
    results: {
      bindings: [
        binding("LHR", "Heathrow_Airport"),
        binding("BER", "Berlin_Brandenburg_Airport"),
      ],
    },
  };
  expect(parseSparqlBindings(json)).toEqual({
    LHR: "Heathrow Airport",
    BER: "Berlin Brandenburg Airport",
  });
});

test("percent-decodes titles containing non-ASCII characters", () => {
  const json = {
    results: { bindings: [binding("ZRH", "Z%C3%BCrich_Airport")] },
  };
  expect(parseSparqlBindings(json)).toEqual({ ZRH: "Zürich Airport" });
});

test("ignores malformed bindings rather than throwing", () => {
  const json = { results: { bindings: [{ iata: { value: "AAA" } }] } };
  expect(parseSparqlBindings(json)).toEqual({});
});

test("user agent identifies the project and a contact", () => {
  expect(USER_AGENT).toMatch(/fly\.eric\.fun/);
  expect(USER_AGENT).toMatch(/@/);
});
