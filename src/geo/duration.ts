/** Fixed overhead: taxi out, climb, descent, taxi in. */
export const OVERHEAD_HOURS = 0.66;

/** Effective cruise speed, inclusive of climb and descent phases. */
export const CRUISE_KMH = 790;

/**
 * Estimated nonstop block time.
 *
 * Calibrated against 11 real published block times for the 0.5-8h range;
 * maximum error 14 minutes. The model is symmetric and cannot represent
 * jet-stream asymmetry, and it degrades beyond ~8h. See spec section 5.
 */
export function durationHours(km: number): number {
  return OVERHEAD_HOURS + km / CRUISE_KMH;
}

export function durationMinutes(km: number): number {
  return Math.round(durationHours(km) * 60);
}
