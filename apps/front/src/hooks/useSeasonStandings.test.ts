import { describe, expect, it } from "vitest";
import { buildSeasonStandingsPath } from "./useSeasonStandings.js";

describe("buildSeasonStandingsPath", () => {
  it("builds the paginated season standings path", () => {
    expect(buildSeasonStandingsPath("season-1")).toBe(
      "/seasons/season-1/standings?page=1&limit=50",
    );
  });

  it("builds the season standings path with page and league filters", () => {
    expect(buildSeasonStandingsPath("season-1", 3, "gold")).toBe(
      "/seasons/season-1/standings?page=3&limit=50&league=gold",
    );
  });
});
