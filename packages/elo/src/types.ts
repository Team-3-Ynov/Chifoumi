export type Outcome = "A" | "B" | "DRAW";

export type EloResult = {
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
};
