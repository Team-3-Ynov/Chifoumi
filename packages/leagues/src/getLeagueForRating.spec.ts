import { describe, expect, it } from "@jest/globals";
import { getLeagueForRating } from "./getLeagueForRating.js";
import { LeagueError } from "./league-error.js";

type TestLeague = {
  code: string;
  label: string;
  minRating: number;
  maxRating: number | null;
};

const leagues: TestLeague[] = [
  { code: "bronze", label: "Bronze", minRating: 0, maxRating: 999 },
  { code: "silver", label: "Silver", minRating: 1000, maxRating: 1499 },
  { code: "gold", label: "Gold", minRating: 1500, maxRating: 1999 },
  { code: "diamond", label: "Diamond", minRating: 2000, maxRating: null },
];

describe("getLeagueForRating", () => {
  it("returns the league matching minRating <= rating <= maxRating", () => {
    expect(getLeagueForRating(1200, leagues)).toEqual(expect.objectContaining({ code: "silver" }));
  });

  it("treats exact lower and upper bounds as included", () => {
    expect(getLeagueForRating(999, leagues).code).toBe("bronze");
    expect(getLeagueForRating(1000, leagues).code).toBe("silver");
    expect(getLeagueForRating(1499, leagues).code).toBe("silver");
    expect(getLeagueForRating(1500, leagues).code).toBe("gold");
  });

  it("returns the open-ended top league when maxRating is null", () => {
    expect(getLeagueForRating(2000, leagues).code).toBe("diamond");
    expect(getLeagueForRating(9999, leagues).code).toBe("diamond");
  });

  it("does not require leagues to be sorted", () => {
    const unsorted = [leagues[2], leagues[0], leagues[3], leagues[1]].filter(
      (league): league is TestLeague => league !== undefined,
    );

    expect(getLeagueForRating(100, unsorted).code).toBe("bronze");
    expect(getLeagueForRating(1750, unsorted).code).toBe("gold");
  });

  it("preserves extra fields on the returned league", () => {
    const league = getLeagueForRating(2000, leagues);

    expect(league.label).toBe("Diamond");
  });

  it("throws a typed LeagueError when rating is below the global minimum", () => {
    expect(() => getLeagueForRating(-1, leagues)).toThrow(
      expect.objectContaining({ code: "NO_MATCHING_LEAGUE" }),
    );
  });

  it("throws a typed LeagueError when rating is above a closed global maximum", () => {
    const closedLeagues = leagues.map((league) =>
      league.maxRating === null ? { ...league, maxRating: 2499 } : league,
    );

    expect(() => getLeagueForRating(2500, closedLeagues)).toThrow(
      expect.objectContaining({ code: "NO_MATCHING_LEAGUE" }),
    );
  });

  it("throws a typed LeagueError for empty leagues", () => {
    expect(() => getLeagueForRating(1000, [])).toThrow(
      expect.objectContaining({ code: "EMPTY_LEAGUES" }),
    );
  });

  it("throws a typed LeagueError for invalid ratings", () => {
    expect(() => getLeagueForRating(Number.NaN, leagues)).toThrow(LeagueError);
    expect(() => getLeagueForRating(Number.POSITIVE_INFINITY, leagues)).toThrow(
      expect.objectContaining({ code: "INVALID_RATING" }),
    );
  });

  it("throws a typed LeagueError for invalid league configs", () => {
    expect(() => getLeagueForRating(1000, [{ minRating: Number.NaN, maxRating: 1000 }])).toThrow(
      expect.objectContaining({ code: "INVALID_LEAGUE_CONFIG" }),
    );
    expect(() => getLeagueForRating(1000, [{ minRating: 1000, maxRating: 999 }])).toThrow(
      expect.objectContaining({ code: "INVALID_LEAGUE_CONFIG" }),
    );
    expect(() =>
      getLeagueForRating(1000, [{ minRating: 1000, maxRating: Number.POSITIVE_INFINITY }]),
    ).toThrow(expect.objectContaining({ code: "INVALID_LEAGUE_CONFIG" }));
  });
});
