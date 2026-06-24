import { BracketError } from "./bracket-error.js";

/** Largest bracket this engine supports (2^10 = 1 024 slots). */
const MAX_BRACKET_SIZE = 1024;

/**
 * Returns the smallest power of 2 that is >= registrationCount.
 * Throws BracketError for counts < 2 or counts that would require a bracket
 * larger than MAX_BRACKET_SIZE.
 */
export function computeBracketSize(registrationCount: number): number {
  if (!Number.isInteger(registrationCount)) {
    throw new BracketError(
      "INVALID_BRACKET_SIZE",
      `registrationCount must be a finite integer, got ${registrationCount}.`,
    );
  }

  if (registrationCount < 2) {
    throw new BracketError(
      "INSUFFICIENT_PLAYERS",
      `Cannot create a bracket with ${registrationCount} player(s). Minimum is 2.`,
    );
  }

  let size = 1;
  while (size < registrationCount) {
    size *= 2;
    if (size > MAX_BRACKET_SIZE) {
      throw new BracketError(
        "INVALID_BRACKET_SIZE",
        `Registration count ${registrationCount} requires a bracket larger than the maximum of ${MAX_BRACKET_SIZE}.`,
      );
    }
  }
  return size;
}
