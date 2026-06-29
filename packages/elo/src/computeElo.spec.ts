import { describe, expect, it } from "@jest/globals";
import { computeElo } from "./computeElo.js";
import { EloError } from "./elo-error.js";
import type { Outcome } from "./types.js";

describe("computeElo", () => {
  it("computes the standard equal-rating win with K=32", () => {
    expect(computeElo(1000, 1000, "A", 30, 30)).toEqual({
      newRatingA: 1016,
      newRatingB: 984,
      deltaA: 16,
      deltaB: -16,
    });
  });

  it("uses K=40 for beginners", () => {
    expect(computeElo(1000, 1000, "A", 3, 30)).toEqual({
      newRatingA: 1020,
      newRatingB: 984,
      deltaA: 20,
      deltaB: -16,
    });
  });

  it("uses K=16 for top-tier players above 2400 rating", () => {
    expect(computeElo(2500, 2500, "B", 100, 100)).toEqual({
      newRatingA: 2492,
      newRatingB: 2508,
      deltaA: -8,
      deltaB: 8,
    });
  });

  it("rewards the lower-rated player on a draw", () => {
    expect(computeElo(800, 1200, "DRAW", 30, 30)).toEqual({
      newRatingA: 813,
      newRatingB: 1187,
      deltaA: 13,
      deltaB: -13,
    });
  });

  it("applies each player's K-factor independently on a draw", () => {
    expect(computeElo(1000, 1000, "DRAW", 3, 30)).toEqual({
      newRatingA: 1000,
      newRatingB: 1000,
      deltaA: 0,
      deltaB: 0,
    });
    expect(computeElo(900, 1100, "DRAW", 3, 30)).toEqual({
      newRatingA: 910,
      newRatingB: 1092,
      deltaA: 10,
      deltaB: -8,
    });
  });

  it("handles rating edge cases", () => {
    expect(computeElo(0, 9999, "DRAW", 30, 30)).toEqual({
      newRatingA: 16,
      newRatingB: 9991,
      deltaA: 16,
      deltaB: -8,
    });
  });

  it("throws a typed EloError for invalid ratings", () => {
    expect(() => computeElo(-1, 1000, "A", 30, 30)).toThrow(
      expect.objectContaining({ code: "INVALID_RATING" }),
    );
    expect(() => computeElo(1000, Number.POSITIVE_INFINITY, "A", 30, 30)).toThrow(EloError);
  });

  it("throws a typed EloError for invalid games played", () => {
    expect(() => computeElo(1000, 1000, "A", -1, 30)).toThrow(
      expect.objectContaining({ code: "INVALID_GAMES_PLAYED" }),
    );
    expect(() => computeElo(1000, 1000, "A", 30, Number.NaN)).toThrow(EloError);
    expect(() => computeElo(1000, 1000, "A", 29.9, 30)).toThrow(
      expect.objectContaining({ code: "INVALID_GAMES_PLAYED" }),
    );
  });

  it("throws a typed EloError for an invalid winner", () => {
    expect(() => computeElo(1000, 1000, "C" as Outcome, 30, 30)).toThrow(
      expect.objectContaining({ code: "INVALID_WINNER" }),
    );
  });

  it("keeps a 100-case deterministic behavior snapshot", () => {
    const outcomes: Outcome[] = ["A", "B", "DRAW", "A"];
    const cases = Array.from({ length: 100 }, (_, index) => {
      const ratingA = 600 + index * 37;
      const ratingB = 2800 - index * 19;
      const gamesPlayedA = index % 45;
      const gamesPlayedB = (index * 7) % 80;
      const winner = outcomes[index % outcomes.length] ?? "DRAW";
      const result = computeElo(ratingA, ratingB, winner, gamesPlayedA, gamesPlayedB);

      return `${ratingA}/${ratingB}/${winner}/${gamesPlayedA}/${gamesPlayedB} => ${result.newRatingA}/${result.newRatingB}/${result.deltaA}/${result.deltaB}`;
    });

    expect(cases).toMatchSnapshot();
  });
});
