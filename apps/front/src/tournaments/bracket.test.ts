import { describe, expect, it } from "vitest";
import type { BracketMatch } from "../api/types.js";
import { canCurrentPlayerPlay, isByeMatch, roundLabel } from "./bracket.js";

describe("roundLabel", () => {
  it("names the final rounds explicitly", () => {
    expect(roundLabel(3, 3)).toBe("Finale");
    expect(roundLabel(2, 3)).toBe("Demi-finales");
    expect(roundLabel(1, 3)).toBe("Quarts de finale");
  });

  it("falls back to a generic label for earlier rounds", () => {
    expect(roundLabel(1, 4)).toBe("Tour 1");
  });
});

describe("isByeMatch", () => {
  const filled = { userId: "u1", displayName: "alice" };

  it("is true for a round-1 match with a single filled slot", () => {
    expect(isByeMatch({ slotA: filled, slotB: null } as BracketMatch, 1)).toBe(true);
    expect(isByeMatch({ slotA: null, slotB: filled } as BracketMatch, 1)).toBe(true);
  });

  it("is false for full matches and for empty slots in later rounds", () => {
    const fullMatch = { slotA: filled, slotB: { userId: "u2", displayName: "bob" } };
    expect(isByeMatch(fullMatch as BracketMatch, 1)).toBe(false);
    // a single filled slot after round 1 only means the opponent is not decided yet
    expect(isByeMatch({ slotA: filled, slotB: null } as BracketMatch, 2)).toBe(false);
  });
});

describe("canCurrentPlayerPlay", () => {
  const base: BracketMatch = {
    id: "m",
    matchId: "match-1",
    slotA: { userId: "u1", displayName: "alice" },
    slotB: { userId: "u2", displayName: "bob" },
    scoreA: null,
    scoreB: null,
    winnerSlot: null,
  };

  it("is true for a participant when the game is ready", () => {
    expect(canCurrentPlayerPlay(base, "u1")).toBe(true);
    expect(canCurrentPlayerPlay(base, "u2")).toBe(true);
  });

  it("is false for spectators and non-participants", () => {
    expect(canCurrentPlayerPlay(base, undefined)).toBe(false);
    expect(canCurrentPlayerPlay(base, "u9")).toBe(false);
  });

  it("is false when the match is finished or has no game id (incl. byes)", () => {
    expect(canCurrentPlayerPlay({ ...base, winnerSlot: "a" }, "u1")).toBe(false);
    expect(canCurrentPlayerPlay({ ...base, matchId: null }, "u1")).toBe(false);
  });
});
