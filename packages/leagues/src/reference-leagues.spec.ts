import { describe, expect, it } from "@jest/globals";
import {
  getLeagueSummaryForRating,
  getReferenceLeagueByName,
  REFERENCE_LEAGUES,
  toLeagueSummary,
} from "./reference-leagues.js";

describe("reference leagues", () => {
  it("looks up leagues by case-insensitive name", () => {
    expect(getReferenceLeagueByName("gold")).toEqual(REFERENCE_LEAGUES[2]);
    expect(getReferenceLeagueByName(" Platinum ")).toEqual(REFERENCE_LEAGUES[3]);
    expect(getReferenceLeagueByName("diamond")).toBeNull();
  });

  it("returns a public summary for a rating", () => {
    expect(getLeagueSummaryForRating(1200)).toEqual({ name: "Gold", tier: 3 });
  });

  it("projects a reference league to its API summary", () => {
    expect(toLeagueSummary(REFERENCE_LEAGUES[0])).toEqual({ name: "Bronze", tier: 1 });
  });
});
