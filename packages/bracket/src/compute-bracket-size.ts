import { BracketError } from "./bracket-error.js";

/**
 * Returns the smallest power of 2 that is >= registrationCount.
 * Throws BracketError for counts of 0 or 1 (cannot form a bracket).
 */
export function computeBracketSize(registrationCount: number): number {
  if (registrationCount < 2) {
    throw new BracketError(
      "INSUFFICIENT_PLAYERS",
      `Cannot create a bracket with ${registrationCount} player(s). Minimum is 2.`,
    );
  }

  let size = 1;
  while (size < registrationCount) {
    size *= 2;
  }
  return size;
}
