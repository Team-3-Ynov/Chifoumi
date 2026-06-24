import { describe, expect, it } from "@jest/globals";
import { BracketError } from "./bracket-error.js";
import { computeBracketSize } from "./compute-bracket-size.js";
import { generateFirstRound } from "./generate-first-round.js";
import { seedPlayers } from "./seed-players.js";
import type { Player, SeededPlayer } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayers(ratings: number[]): Player[] {
  return ratings.map((rating, i) => ({ id: `p${i + 1}`, rating }));
}

// ---------------------------------------------------------------------------
// computeBracketSize
// ---------------------------------------------------------------------------

describe("computeBracketSize", () => {
  it("throws BracketError for count 0", () => {
    expect(() => computeBracketSize(0)).toThrow(BracketError);
    expect(() => computeBracketSize(0)).toThrow("Cannot create a bracket");
  });

  it("throws BracketError for count 1", () => {
    expect(() => computeBracketSize(1)).toThrow(BracketError);
    const err = (() => {
      try {
        computeBracketSize(1);
      } catch (e) {
        return e;
      }
    })() as BracketError;
    expect(err.code).toBe("INSUFFICIENT_PLAYERS");
  });

  it("returns 2 for count 2 (exact power of 2)", () => {
    expect(computeBracketSize(2)).toBe(2);
  });

  it("returns 4 for count 3 (rounds up to next power of 2)", () => {
    expect(computeBracketSize(3)).toBe(4);
  });

  it("returns 4 for count 4 (exact power of 2)", () => {
    expect(computeBracketSize(4)).toBe(4);
  });

  it("returns 8 for count 5", () => {
    expect(computeBracketSize(5)).toBe(8);
  });

  it("returns 8 for count 8 (exact power of 2)", () => {
    expect(computeBracketSize(8)).toBe(8);
  });

  it("returns 16 for count 9", () => {
    expect(computeBracketSize(9)).toBe(16);
  });

  it("returns 16 for count 16 (exact power of 2)", () => {
    expect(computeBracketSize(16)).toBe(16);
  });

  it("returns 32 for count 17", () => {
    expect(computeBracketSize(17)).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// seedPlayers
// ---------------------------------------------------------------------------

describe("seedPlayers", () => {
  it("throws BracketError for 0 players", () => {
    expect(() => seedPlayers([])).toThrow(BracketError);
    const err = (() => {
      try {
        seedPlayers([]);
      } catch (e) {
        return e;
      }
    })() as BracketError;
    expect(err.code).toBe("INSUFFICIENT_PLAYERS");
  });

  it("throws BracketError for 1 player", () => {
    expect(() => seedPlayers([{ id: "p1", rating: 1000 }])).toThrow(BracketError);
  });

  it("assigns seed 1 to the highest-rated player", () => {
    const players = makePlayers([1200, 1500, 1100]);
    const seeded = seedPlayers(players);
    expect(seeded[0]?.seed).toBe(1);
    expect(seeded[0]?.rating).toBe(1500);
  });

  it("sorts players by rating descending", () => {
    const players = makePlayers([1000, 1400, 800, 1200]);
    const seeded = seedPlayers(players);
    expect(seeded.map((p) => p.rating)).toEqual([1400, 1200, 1000, 800]);
  });

  it("assigns sequential seeds starting at 1", () => {
    const players = makePlayers([1000, 1400, 800, 1200]);
    const seeded = seedPlayers(players);
    expect(seeded.map((p) => p.seed)).toEqual([1, 2, 3, 4]);
  });

  it("preserves original player id and rating on seeded objects", () => {
    const players: Player[] = [
      { id: "alice", rating: 1500 },
      { id: "bob", rating: 1200 },
    ];
    const seeded = seedPlayers(players);
    expect(seeded[0]).toMatchObject({ id: "alice", rating: 1500, seed: 1 });
    expect(seeded[1]).toMatchObject({ id: "bob", rating: 1200, seed: 2 });
  });

  it("does not mutate the input array", () => {
    const players = makePlayers([800, 1500]);
    const original = [...players];
    seedPlayers(players);
    expect(players).toEqual(original);
  });

  it("handles 2 players (minimum)", () => {
    const seeded = seedPlayers(makePlayers([1000, 2000]));
    expect(seeded).toHaveLength(2);
    expect(seeded[0]?.seed).toBe(1);
    expect(seeded[0]?.rating).toBe(2000);
  });

  it("handles 8 players with correct seeding order", () => {
    const ratings = [1000, 1700, 1300, 1500, 900, 1600, 1100, 1400];
    const seeded = seedPlayers(makePlayers(ratings));
    expect(seeded).toHaveLength(8);
    for (let i = 0; i < seeded.length - 1; i++) {
      expect(seeded[i]?.rating).toBeGreaterThanOrEqual(seeded[i + 1]?.rating ?? 0);
      expect(seeded[i]?.seed).toBe(i + 1);
    }
  });

  it("handles players with identical ratings (stable output, seeds still sequential)", () => {
    const players: Player[] = [
      { id: "a", rating: 1000 },
      { id: "b", rating: 1000 },
    ];
    const seeded = seedPlayers(players);
    expect(seeded.map((p) => p.seed)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// generateFirstRound
// ---------------------------------------------------------------------------

describe("generateFirstRound", () => {
  function makeSeeded(ratings: number[]): SeededPlayer[] {
    return seedPlayers(makePlayers(ratings));
  }

  it("throws BracketError when bracketSize is not a power of 2", () => {
    const seeded = makeSeeded([1500, 1200]);
    expect(() => generateFirstRound(seeded, 3)).toThrow(BracketError);
    const err = (() => {
      try {
        generateFirstRound(seeded, 3);
      } catch (e) {
        return e;
      }
    })() as BracketError;
    expect(err.code).toBe("INVALID_BRACKET_SIZE");
  });

  it("throws BracketError when bracketSize is 1", () => {
    const seeded = makeSeeded([1500, 1200]);
    expect(() => generateFirstRound(seeded, 1)).toThrow(BracketError);
  });

  it("throws BracketError when bracketSize is 0", () => {
    const seeded = makeSeeded([1500, 1200]);
    expect(() => generateFirstRound(seeded, 0)).toThrow(BracketError);
  });

  it("throws BracketError when players exceed bracketSize", () => {
    const seeded = makeSeeded([1500, 1400, 1300]);
    expect(() => generateFirstRound(seeded, 2)).toThrow(BracketError);
    const err = (() => {
      try {
        generateFirstRound(seeded, 2);
      } catch (e) {
        return e;
      }
    })() as BracketError;
    expect(err.code).toBe("PLAYERS_EXCEED_BRACKET_SIZE");
  });

  it("produces 1 match for 2 players in a 2-bracket (no byes)", () => {
    const seeded = makeSeeded([1500, 1200]);
    const matches = generateFirstRound(seeded, 2);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.player1.seed).toBe(1);
    expect(matches[0]?.player2?.seed).toBe(2);
  });

  it("pairs seed 1 vs seed 4, seed 2 vs seed 3 for 4 players in a 4-bracket", () => {
    const seeded = makeSeeded([1600, 1500, 1400, 1300]);
    const matches = generateFirstRound(seeded, 4);
    expect(matches).toHaveLength(2);
    expect(matches[0]?.player1.seed).toBe(1);
    expect(matches[0]?.player2?.seed).toBe(4);
    expect(matches[1]?.player1.seed).toBe(2);
    expect(matches[1]?.player2?.seed).toBe(3);
  });

  it("pairs seed 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5 for 8 players in an 8-bracket", () => {
    const seeded = makeSeeded([1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100]);
    const matches = generateFirstRound(seeded, 8);
    expect(matches).toHaveLength(4);
    const pairs = matches.map((m) => [m.player1.seed, m.player2?.seed]);
    expect(pairs).toEqual([
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ]);
  });

  it("gives byes to top seeds when count is not a power of 2 (3 players, bracketSize 4)", () => {
    const seeded = makeSeeded([1600, 1500, 1400]);
    const matches = generateFirstRound(seeded, 4);

    // Seed 1 gets a bye (null opponent), seed 2 faces seed 3
    const byeMatch = matches.find((m) => m.player2 === null);
    expect(byeMatch).toBeDefined();
    expect(byeMatch?.player1.seed).toBe(1);

    const realMatch = matches.find((m) => m.player2 !== null);
    expect(realMatch?.player1.seed).toBe(2);
    expect(realMatch?.player2?.seed).toBe(3);
  });

  it("handles 5 players in an 8-bracket (3 byes for top seeds)", () => {
    const seeded = makeSeeded([1700, 1600, 1500, 1400, 1300]);
    const matches = generateFirstRound(seeded, 8);

    const byeMatches = matches.filter((m) => m.player2 === null);
    const realMatches = matches.filter((m) => m.player2 !== null);

    expect(byeMatches).toHaveLength(3);
    expect(realMatches).toHaveLength(1);

    // Seed 4 vs seed 5 is the only real first-round match
    expect(realMatches[0]?.player1.seed).toBe(4);
    expect(realMatches[0]?.player2?.seed).toBe(5);

    // Top 3 seeds get byes
    const byeSeeds = byeMatches.map((m) => m.player1.seed).sort((a, b) => a - b);
    expect(byeSeeds).toEqual([1, 2, 3]);
  });

  it("handles exactly bracketSize players (no byes)", () => {
    const seeded = makeSeeded([1800, 1700, 1600, 1500]);
    const matches = generateFirstRound(seeded, 4);
    expect(matches.every((m) => m.player2 !== null)).toBe(true);
    expect(matches).toHaveLength(2);
  });

  it("handles 2 players in a 4-bracket (both get byes)", () => {
    // slots = [seed1, seed2, null, null]
    // round-1 pairs: seed1 vs null, seed2 vs null → 2 bye matches
    const seeded = makeSeeded([1500, 1200]);
    const matches = generateFirstRound(seeded, 4);

    const byeMatches = matches.filter((m) => m.player2 === null);
    const realMatches = matches.filter((m) => m.player2 !== null);

    expect(byeMatches).toHaveLength(2);
    expect(realMatches).toHaveLength(0);
    const byeSeeds = byeMatches.map((m) => m.player1.seed).sort((a, b) => a - b);
    expect(byeSeeds).toEqual([1, 2]);
  });

  it("skips empty left-side slots when players < half of bracketSize (2 in 8-bracket)", () => {
    // slots = [seed1, seed2, null, null, null, null, null, null]
    // i=0: seed1 vs null → bye
    // i=1: seed2 vs null → bye
    // i=2..3: player1 slot is null → skipped (covers the continue branch)
    const seeded = makeSeeded([1500, 1200]);
    const matches = generateFirstRound(seeded, 8);

    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.player2 === null)).toBe(true);
  });
});
