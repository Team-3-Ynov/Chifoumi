import { describe, expect, it } from "vitest";
import { buildLeaderboardPath } from "./useLeaderboard.js";

describe("buildLeaderboardPath", () => {
  it("builds the default leaderboard path", () => {
    expect(buildLeaderboardPath()).toBe("/leaderboard?limit=50");
  });

  it("adds the selected league filter", () => {
    expect(buildLeaderboardPath("gold")).toBe("/leaderboard?limit=50&league=gold");
  });
});
