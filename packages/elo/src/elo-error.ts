export type EloErrorCode = "INVALID_RATING" | "INVALID_GAMES_PLAYED" | "INVALID_WINNER";

export class EloError extends Error {
  constructor(
    readonly code: EloErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EloError";
  }
}
