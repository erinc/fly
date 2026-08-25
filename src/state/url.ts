export const MIN_MINUTES = 30;
export const MAX_MINUTES = 480;
export const STEP_MINUTES = 15;

export type AppState = {
  a: string | null;
  b: string | null;
  minutes: number;
  yearRoundOnly: boolean;
};

export const DEFAULT_STATE: AppState = {
  a: null, b: null, minutes: 180, yearRoundOnly: false,
};

function code(raw: string | null): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : null;
}

export function clampMinutes(n: number): number {
  const snapped = Math.round(n / STEP_MINUTES) * STEP_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, snapped));
}

export function parseState(search: string): AppState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawT = Number(p.get("t"));
  return {
    a: code(p.get("a")),
    b: code(p.get("b")),
    minutes: Number.isFinite(rawT) && p.get("t") !== null && p.get("t") !== ""
      ? clampMinutes(rawT)
      : DEFAULT_STATE.minutes,
    yearRoundOnly: p.get("yr") === "1",
  };
}

export function toSearch(state: AppState): string {
  const p = new URLSearchParams();
  if (state.a) p.set("a", state.a);
  if (state.b) p.set("b", state.b);
  p.set("t", String(state.minutes));
  if (state.yearRoundOnly) p.set("yr", "1");
  return `?${p}`;
}
