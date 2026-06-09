export type Outcome = "A" | "B" | "DRAW";

export type EloInput = {
  ratingA: number;
  ratingB: number;
  winner: Outcome;
  gamesPlayedA: number;
  gamesPlayedB: number;
};

export type EloResult = {
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
};
