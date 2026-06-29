import { describe, expect, it } from "@jest/globals";
import { getLeagueProgress } from "./getLeagueProgress.js";
import { LeagueError } from "./league-error.js";

describe("getLeagueProgress", () => {
  it("returns 0 at the lower bound", () => {
    expect(getLeagueProgress(1000, { minRating: 1000, maxRating: 1499 })).toBe(0);
  });

  it("returns a percentage inside the current league", () => {
    expect(getLeagueProgress(1250, { minRating: 1000, maxRating: 1500 })).toBe(0.5);
  });

  it("returns 1 at the upper bound", () => {
    expect(getLeagueProgress(1500, { minRating: 1000, maxRating: 1500 })).toBe(1);
  });

  it("clamps progress below and above the league range", () => {
    expect(getLeagueProgress(999, { minRating: 1000, maxRating: 1500 })).toBe(0);
    expect(getLeagueProgress(1501, { minRating: 1000, maxRating: 1500 })).toBe(1);
  });

  it("returns 1 for the open-ended top league", () => {
    expect(getLeagueProgress(2000, { minRating: 2000, maxRating: null })).toBe(1);
    expect(getLeagueProgress(5000, { minRating: 2000, maxRating: null })).toBe(1);
  });

  it("returns 1 for a single-rating league", () => {
    expect(getLeagueProgress(1000, { minRating: 1000, maxRating: 1000 })).toBe(1);
  });

  it("throws a typed LeagueError for invalid ratings", () => {
    expect(() => getLeagueProgress(Number.NaN, { minRating: 1000, maxRating: 1500 })).toThrow(
      LeagueError,
    );
    expect(() =>
      getLeagueProgress(Number.POSITIVE_INFINITY, { minRating: 1000, maxRating: 1500 }),
    ).toThrow(expect.objectContaining({ code: "INVALID_RATING" }));
  });

  it("throws a typed LeagueError for invalid league configs", () => {
    expect(() => getLeagueProgress(1000, { minRating: Number.NaN, maxRating: 1500 })).toThrow(
      expect.objectContaining({ code: "INVALID_LEAGUE_CONFIG" }),
    );
    expect(() => getLeagueProgress(1000, { minRating: 1500, maxRating: 1499 })).toThrow(
      expect.objectContaining({ code: "INVALID_LEAGUE_CONFIG" }),
    );
    expect(() =>
      getLeagueProgress(1000, { minRating: 1000, maxRating: Number.POSITIVE_INFINITY }),
    ).toThrow(expect.objectContaining({ code: "INVALID_LEAGUE_CONFIG" }));
  });
});
