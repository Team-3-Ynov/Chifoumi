export type LeagueErrorCode =
  | "INVALID_RATING"
  | "EMPTY_LEAGUES"
  | "INVALID_LEAGUE_CONFIG"
  | "NO_MATCHING_LEAGUE";

export class LeagueError extends Error {
  constructor(
    readonly code: LeagueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeagueError";
  }
}
