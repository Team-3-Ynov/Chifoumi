import { EloError } from "./elo-error.js";

export function getKFactor(rating: number, gamesPlayed: number): number {
  assertNonNegativeFiniteNumber(rating, "rating", "INVALID_RATING");
  assertNonNegativeFiniteNumber(gamesPlayed, "gamesPlayed", "INVALID_GAMES_PLAYED");
  assertInteger(gamesPlayed, "gamesPlayed", "INVALID_GAMES_PLAYED");

  if (rating > 2400) {
    return 16;
  }

  if (gamesPlayed < 30) {
    return 40;
  }

  return 32;
}

function assertNonNegativeFiniteNumber(
  value: number,
  field: string,
  code: "INVALID_RATING" | "INVALID_GAMES_PLAYED",
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new EloError(code, `${field} must be a non-negative finite number`);
  }
}

function assertInteger(value: number, field: string, code: "INVALID_GAMES_PLAYED"): void {
  if (!Number.isInteger(value)) {
    throw new EloError(code, `${field} must be an integer`);
  }
}
