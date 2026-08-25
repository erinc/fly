import type { Metro } from "./bundle.js";

export type AirportSelection =
  | { kind: "airport"; code: string }
  | { kind: "metro"; metro: Metro };

export function selectionCodes(selection: AirportSelection): string[] {
  return selection.kind === "metro" ? selection.metro.codes : [selection.code];
}

export function flattenSelections(selections: AirportSelection[]): string[] {
  return selections.flatMap(selectionCodes);
}

/** Reconstruct metro selections from the flat IATA list used by shared URLs.
 * A generated group is used only when every member code is present. */
export function selectionsFromCodes(codes: string[], metros: Metro[]): AirportSelection[] {
  const unique = [...new Set(codes)];
  const present = new Set(unique);
  const completeMetros = metros.filter((m) => m.codes.every((code) => present.has(code)));
  const metroByCode = new Map<string, Metro>();
  for (const metro of completeMetros) {
    for (const code of metro.codes) metroByCode.set(code, metro);
  }

  const emitted = new Set<string>();
  const selections: AirportSelection[] = [];
  for (const code of unique) {
    const metro = metroByCode.get(code);
    if (metro) {
      if (!emitted.has(metro.id)) {
        selections.push({ kind: "metro", metro });
        emitted.add(metro.id);
      }
    } else {
      selections.push({ kind: "airport", code });
    }
  }
  return selections;
}

export function addSelection(
  selections: AirportSelection[],
  incoming: AirportSelection,
  metros: Metro[],
  limit: number,
): AirportSelection[] {
  const currentCodes = flattenSelections(selections);
  const nextCodes = [...currentCodes, ...selectionCodes(incoming)];
  const next = selectionsFromCodes(nextCodes, metros);
  if (next.length > limit) return selections;
  if (nextCodes.length === currentCodes.length) return selections;
  if (flattenSelections(next).join(",") === currentCodes.join(",")) return selections;
  return next;
}
