import { EloError } from "./elo-error.js";
import { getKFactor } from "./kFactor.js";
import type { EloResult, Outcome } from "./types.js";

type ScorePair = {
  scoreA: number;
  scoreB: number;
};

export function computeElo(
  ratingA: number,
  ratingB: number,
  winner: Outcome,
  gamesPlayedA: number,
  gamesPlayedB: number,
): EloResult {
  validateOutcome(winner);

  const kFactorA = getKFactor(ratingA, gamesPlayedA);
  const kFactorB = getKFactor(ratingB, gamesPlayedB);
  const expectedA = getExpectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;
  const { scoreA, scoreB } = getScorePair(winner);
  const deltaA = Math.round(kFactorA * (scoreA - expectedA));
  const deltaB = Math.round(kFactorB * (scoreB - expectedB));

  return {
    newRatingA: ratingA + deltaA,
    newRatingB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}

function getExpectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

function getScorePair(winner: Outcome): ScorePair {
  switch (winner) {
    case "A":
      return { scoreA: 1, scoreB: 0 };
    case "B":
      return { scoreA: 0, scoreB: 1 };
    case "DRAW":
      return { scoreA: 0.5, scoreB: 0.5 };
  }
}

function validateOutcome(winner: Outcome): void {
  if (!["A", "B", "DRAW"].includes(winner)) {
    throw new EloError("INVALID_WINNER", "winner must be A, B or DRAW");
  }
}
