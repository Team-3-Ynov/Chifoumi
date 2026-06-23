import { LeagueError } from "./league-error.js";
import type { League } from "./types.js";

export function getLeagueProgress(rating: number, league: League): number {
  assertRating(rating);
  assertLeagueConfig(league);

  if (league.maxRating === null) {
    return 1;
  }

  if (league.maxRating === league.minRating) {
    return 1;
  }

  return clamp((rating - league.minRating) / (league.maxRating - league.minRating));
}

function clamp(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function assertRating(rating: number): void {
  if (!Number.isFinite(rating)) {
    throw new LeagueError("INVALID_RATING", "rating must be a finite number");
  }
}

function assertLeagueConfig(league: League): void {
  if (!Number.isFinite(league.minRating)) {
    throw new LeagueError("INVALID_LEAGUE_CONFIG", "league minRating must be a finite number");
  }

  if (league.maxRating === null) {
    return;
  }

  if (!Number.isFinite(league.maxRating) || league.maxRating < league.minRating) {
    throw new LeagueError(
      "INVALID_LEAGUE_CONFIG",
      "league maxRating must be null or greater than or equal to minRating",
    );
  }
}
