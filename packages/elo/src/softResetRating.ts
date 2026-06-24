/** Platform baseline rating used in the seasonal soft-reset formula (US-060 AC2). */
export const SEASON_SOFT_RESET_BASE_RATING = 1000;

const RETAIN_WEIGHT = 0.75;
const BASE_WEIGHT = 0.25;

/**
 * Soft-resets a player's ELO toward the platform baseline between seasons.
 * Formula: round(rating × 0.75 + 1000 × 0.25).
 */
export function softResetRating(rating: number): number {
  return Math.round(rating * RETAIN_WEIGHT + SEASON_SOFT_RESET_BASE_RATING * BASE_WEIGHT);
}
