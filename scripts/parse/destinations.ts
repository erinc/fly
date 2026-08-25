export type Destination = { iata: string; seasonal: boolean; charter: boolean };

const HEADING = /^(=+)\s*(.+?)\s*=+\s*$/;
const DEST_HEADING = /airlines?\s+and\s+destinations/i;
const WIKILINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Returns the wikitext of the destinations section, or null if absent. */
export function findDestinationSection(wikitext: string): string | null {
  const lines = wikitext.split(/\r?\n/);
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const m = HEADING.exec(line);
    if (!m) continue;
    const eq = (m[1] ?? "").length;
    const heading = m[2] ?? "";
    if (start === -1) {
      if (DEST_HEADING.test(heading)) {
        start = i + 1;
        level = eq;
      }
    } else if (eq <= level) {
      return lines.slice(start, i).join("\n");
    }
  }
  return start === -1 ? null : lines.slice(start).join("\n");
}

function parseDate(text: string): Date | null {
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDestinations(
  wikitext: string,
  titleToIata: Record<string, string>,
  now: Date = new Date(),
): Destination[] {
  const section = findDestinationSection(wikitext);
  if (section === null) return [];

  const found = new Map<string, Destination>();
  let charterSection = false;

  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine;
    const strippedLine = line.replace(/'''/g, "").trim();

    // A "Charter:" subheading applies to following lines until the next
    // heading or a new (non-charter) subheading-like line.
    if (/^[*;\s]*charter\s*:?\s*$|^[*;\s]*charter\s*:/i.test(strippedLine)) {
      charterSection = true;
    } else if (HEADING.test(line)) {
      charterSection = false;
    }

    const lineHasCharterWord = /charter/i.test(line);

    // A wikitext line often lists several destinations in one cell, each
    // with its own trailing "(begins ...)" / "(ends ...)" annotation. begins
    // and ends *remove* routes, so matching them against the whole line
    // would let one destination's future-dated annotation silently drop
    // every other destination on the same line — a real data-loss bug.
    // Scope each match to the span from that wikilink up to the start of
    // the next wikilink on the line (or end of line for the last one), so
    // an annotation only affects the destination it actually belongs to.
    // seasonal, in contrast, only *labels* a route rather than removing it,
    // so an over-broad (line-scoped) match there is merely a cosmetic flag
    // error, not data loss — left as-is deliberately.
    const matches = [...line.matchAll(WIKILINK)];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]!;
      const title = (m[1] ?? "").trim();
      const iata = titleToIata[title];
      if (!iata) continue;

      const windowEnd = matches[i + 1]?.index ?? line.length;
      const window = line.slice(m.index, windowEnd);

      const begins = /begins\s+([0-9]{1,2}\s+\w+\s+[0-9]{4})/i.exec(window);
      if (begins) {
        const d = parseDate(begins[1] ?? "");
        if (d && d > now) continue;
      }
      const ends = /ends\s+([0-9]{1,2}\s+\w+\s+[0-9]{4})/i.exec(window);
      if (ends) {
        const d = parseDate(ends[1] ?? "");
        if (d && d < now) continue;
      }

      const seasonal = /seasonal/i.test(line);
      const charter = lineHasCharterWord || charterSection;

      const prev = found.get(iata);
      if (!prev) {
        found.set(iata, { iata, seasonal, charter });
      } else {
        // Any year-round or scheduled listing wins over seasonal/charter.
        prev.seasonal &&= seasonal;
        prev.charter &&= charter;
      }
    }
  }
  return [...found.values()];
}
