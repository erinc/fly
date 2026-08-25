export const USER_AGENT =
  "fly.eric.fun/1.0 (https://fly.eric.fun; https://github.com/erinc/fly)";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/** Every airport carrying an IATA code (P238) that has an English article. */
export const IATA_TITLE_QUERY = `
SELECT ?iata ?art WHERE {
  ?a   wdt:P238 ?iata .
  ?art schema:about ?a ;
       schema:isPartOf <https://en.wikipedia.org/> .
}`;

export function parseSparqlBindings(json: unknown): Record<string, string> {
  const bindings =
    (json as { results?: { bindings?: unknown[] } })?.results?.bindings ?? [];
  const map: Record<string, string> = {};
  for (const raw of bindings) {
    const b = raw as { iata?: { value?: string }; art?: { value?: string } };
    const iata = b.iata?.value;
    const url = b.art?.value;
    if (!iata || !url) continue;
    const slug = url.slice(url.lastIndexOf("/") + 1);
    try {
      map[iata] = decodeURIComponent(slug).replace(/_/g, " ");
    } catch {
      // Malformed percent-encoding in a title slug — skip this binding
      // rather than aborting the whole crawl.
      continue;
    }
  }
  return map;
}

export async function fetchIataTitleMap(): Promise<Record<string, string>> {
  const url = `${SPARQL_ENDPOINT}?format=json&query=${encodeURIComponent(IATA_TITLE_QUERY)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
  });
  if (!res.ok) throw new Error(`Wikidata query failed: ${res.status}`);
  return parseSparqlBindings(await res.json());
}
