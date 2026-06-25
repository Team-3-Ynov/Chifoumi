import { generateFirstRound, type PlayerId, seedPlayers } from "@chifoumi/bracket";
import { WinnerSlot } from "@chifoumi/db";
import { describe, expect, it } from "@jest/globals";
import { buildBracketStructure } from "./build-bracket-structure.js";

function makeSeeded(ratings: number[]) {
  const players = ratings.map((rating, index) => ({
    id: `player-${index + 1}` as PlayerId,
    rating,
  }));
  return seedPlayers(players);
}

describe("buildBracketStructure", () => {
  it("creates a fully linked single-elimination tree", () => {
    const seeded = makeSeeded([1600, 1500, 1400, 1300]);
    const firstRound = generateFirstRound(seeded, 4);
    const built = buildBracketStructure(seeded, 4, firstRound);

    expect(built.matches).toHaveLength(3);
    expect(built.matches.filter((match) => match.round === 1)).toHaveLength(2);
    expect(built.matches.filter((match) => match.round === 2)).toHaveLength(1);

    const roundOneMatches = built.matches.filter((match) => match.round === 1);
    const finalMatch = built.matches.find((match) => match.round === 2);
    expect(roundOneMatches.every((match) => match.nextMatchId === finalMatch?.id)).toBe(true);
    expect(finalMatch?.nextMatchId).toBeNull();
  });

  it("seeds round 1 with standard pairings for 4 players", () => {
    const seeded = makeSeeded([1600, 1500, 1400, 1300]);
    const firstRound = generateFirstRound(seeded, 4);
    const built = buildBracketStructure(seeded, 4, firstRound);
    const roundOne = built.matches
      .filter((match) => match.round === 1)
      .sort((left, right) => left.positionIndex - right.positionIndex);

    expect(roundOne[0]).toMatchObject({
      slotAId: "player-1",
      slotBId: "player-4",
      winnerSlot: null,
    });
    expect(roundOne[1]).toMatchObject({
      slotAId: "player-2",
      slotBId: "player-3",
      winnerSlot: null,
    });
    expect(built.roundOnePlayable).toHaveLength(2);
  });

  it("advances bye winners into the next round slots", () => {
    const seeded = makeSeeded([1700, 1600, 1500]);
    const firstRound = generateFirstRound(seeded, 4);
    const built = buildBracketStructure(seeded, 4, firstRound);
    const roundOne = built.matches
      .filter((match) => match.round === 1)
      .sort((left, right) => left.positionIndex - right.positionIndex);
    const roundTwo = built.matches.find((match) => match.round === 2);

    expect(roundOne[0]).toMatchObject({
      slotAId: "player-1",
      slotBId: null,
      winnerSlot: WinnerSlot.a,
    });
    expect(roundTwo).toMatchObject({
      slotAId: "player-1",
      slotBId: null,
    });
    expect(built.roundOnePlayable).toHaveLength(1);
  });

  it("handles multiple byes in an oversized bracket", () => {
    const seeded = makeSeeded([1800, 1700, 1600, 1500, 1400]);
    const firstRound = generateFirstRound(seeded, 8);
    const built = buildBracketStructure(seeded, 8, firstRound);

    const byeMatches = built.matches.filter(
      (match) => match.round === 1 && match.winnerSlot === WinnerSlot.a,
    );
    expect(byeMatches).toHaveLength(3);
    expect(built.roundOnePlayable).toHaveLength(1);
    expect(built.matches).toHaveLength(7);
  });
});
