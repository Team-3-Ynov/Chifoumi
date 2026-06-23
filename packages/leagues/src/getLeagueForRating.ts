import { LeagueError } from "./league-error.js";
import type { League } from "./types.js";

export function getLeagueForRating<TLeague extends League>(
  rating: number,
  leagues: readonly TLeague[],
): TLeague {
  assertRating(rating);
  assertNonEmptyLeagues(leagues);

  for (const league of leagues) {
    assertLeagueConfig(league);

    if (rating >= league.minRating && (league.maxRating === null || rating <= league.maxRating)) {
      return league;
    }
  }

  throw new LeagueError("NO_MATCHING_LEAGUE", "rating does not match any league");
}

function assertRating(rating: number): void {
  if (!Number.isFinite(rating)) {
    throw new LeagueError("INVALID_RATING", "rating must be a finite number");
  }
}

function assertNonEmptyLeagues(leagues: readonly League[]): void {
  if (leagues.length === 0) {
    throw new LeagueError("EMPTY_LEAGUES", "leagues must contain at least one league");
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
