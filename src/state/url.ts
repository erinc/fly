import { MAX_AIRPORTS } from "../theme.js";

export const MIN_MINUTES = 60;
export const MAX_MINUTES = 720;
export const STEP_MINUTES = 15;

export type AppState = {
  airports: string[];
  minutes: number;
  yearRoundOnly: boolean;
};

export const DEFAULT_STATE: AppState = {
  airports: [],
  minutes: 180,
  yearRoundOnly: false,
};

function code(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(up) ? up : null;
}

export function clampMinutes(n: number): number {
  const snapped = Math.round(n / STEP_MINUTES) * STEP_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, snapped));
}

/** The final slider position is an open-ended "all routes" sentinel. */
export function routeLimit(minutes: number): number {
  return minutes >= MAX_MINUTES ? Number.POSITIVE_INFINITY : minutes;
}

export function parseState(search: string): AppState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  // Canonical form is a comma-separated `a`. The legacy two-slot form
  // (?a=BER&b=LIS) is still accepted so previously shared links keep working.
  const raw = [...(p.get("a") ?? "").split(","), p.get("b") ?? ""];
  const airports: string[] = [];
  for (const entry of raw) {
    const c = code(entry);
    if (c && !airports.includes(c) && airports.length < MAX_AIRPORTS) airports.push(c);
  }

  const rawT = p.get("t");
  const n = Number(rawT);
  return {
    airports,
    minutes:
      rawT !== null && rawT !== "" && Number.isFinite(n)
        ? clampMinutes(n)
        : DEFAULT_STATE.minutes,
    yearRoundOnly: p.get("yr") === "1",
  };
}

export function toSearch(state: AppState): string {
  const p = new URLSearchParams();
  if (state.airports.length > 0) p.set("a", state.airports.join(","));
  p.set("t", String(state.minutes));
  if (state.yearRoundOnly) p.set("yr", "1");
  return `?${p}`;
}
