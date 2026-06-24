export type BracketErrorCode =
  | "INSUFFICIENT_PLAYERS"
  | "INVALID_BRACKET_SIZE"
  | "INVALID_PLAYER_RATING"
  | "PLAYERS_EXCEED_BRACKET_SIZE";

export class BracketError extends Error {
  constructor(
    readonly code: BracketErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BracketError";
  }
}
