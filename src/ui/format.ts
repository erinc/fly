// src/ui/format.ts
import { MAX_MINUTES } from "../state/url.js";

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Display the open-ended final slider position without changing route times. */
export function formatFlightTimeLimit(minutes: number): string {
  return minutes >= MAX_MINUTES ? "12h+" : formatDuration(minutes);
}
