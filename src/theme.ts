/** Origin colours, assigned by position in the selected-place array. */
export const ORIGIN_COLORS = ["#d94f45", "#2e7d4f", "#2b6cb0"] as const;

export const MAX_AIRPORTS = ORIGIN_COLORS.length;

/** Colour for the place at `index`. Wraps defensively; callers cap at MAX_AIRPORTS. */
export function originColor(index: number): string {
  return ORIGIN_COLORS[index % ORIGIN_COLORS.length]!;
}
