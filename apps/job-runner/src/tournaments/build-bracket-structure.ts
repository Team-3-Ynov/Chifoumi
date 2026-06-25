import { randomUUID } from "node:crypto";
import type { BracketMatch, SeededPlayer } from "@chifoumi/bracket";
import { WinnerSlot } from "@chifoumi/db";

const DEFAULT_RATING = 1000;

export type BracketMatchDraft = {
  id: string;
  round: number;
  positionIndex: number;
  slotAId: string | null;
  slotBId: string | null;
  winnerSlot: WinnerSlot | null;
  nextMatchId: string | null;
};

export type RoundOnePlayableMatch = {
  tournamentMatchId: string;
  slotAId: string;
  slotBId: string;
};

export type BuiltBracketStructure = {
  matches: BracketMatchDraft[];
  roundOnePlayable: RoundOnePlayableMatch[];
};

export function buildBracketStructure(
  seededPlayers: SeededPlayer[],
  bracketSize: number,
  firstRoundPairings: BracketMatch[],
): BuiltBracketStructure {
  const totalRounds = Math.log2(bracketSize);
  const rounds: BracketMatchDraft[][] = [];

  for (let round = 1; round <= totalRounds; round++) {
    const matchCount = bracketSize / 2 ** round;
    const roundMatches: BracketMatchDraft[] = [];

    for (let positionIndex = 0; positionIndex < matchCount; positionIndex++) {
      roundMatches.push({
        id: randomUUID(),
        round,
        positionIndex,
        slotAId: null,
        slotBId: null,
        winnerSlot: null,
        nextMatchId: null,
      });
    }

    rounds.push(roundMatches);
  }

  for (let roundIndex = 0; roundIndex < totalRounds - 1; roundIndex++) {
    const currentRound = rounds[roundIndex];
    const nextRound = rounds[roundIndex + 1];

    if (!currentRound || !nextRound) {
      continue;
    }

    for (let positionIndex = 0; positionIndex < currentRound.length; positionIndex++) {
      const match = currentRound[positionIndex];
      const parent = nextRound[Math.floor(positionIndex / 2)];
      if (match && parent) {
        match.nextMatchId = parent.id;
      }
    }
  }

  const slots: Array<SeededPlayer | null> = Array.from(
    { length: bracketSize },
    (_, index) => seededPlayers[index] ?? null,
  );
  const halfSize = bracketSize / 2;
  const roundOne = rounds[0];
  const roundTwo = rounds[1];
  const roundOnePlayable: RoundOnePlayableMatch[] = [];
  let pairingIndex = 0;

  for (let positionIndex = 0; positionIndex < halfSize; positionIndex++) {
    const slotA = slots[positionIndex];
    if (!slotA) {
      continue;
    }

    const pairing = firstRoundPairings[pairingIndex];
    pairingIndex += 1;
    if (!pairing) {
      continue;
    }

    const match = roundOne?.[positionIndex];
    if (!match) {
      continue;
    }

    match.slotAId = pairing.player1.id;
    match.slotBId = pairing.player2?.id ?? null;

    if (pairing.player2 === null) {
      match.winnerSlot = WinnerSlot.a;
      advanceByeWinner(match, roundTwo);
      continue;
    }

    roundOnePlayable.push({
      tournamentMatchId: match.id,
      slotAId: pairing.player1.id,
      slotBId: pairing.player2.id,
    });
  }

  return {
    matches: rounds.flat(),
    roundOnePlayable,
  };
}

function advanceByeWinner(
  match: BracketMatchDraft,
  nextRound: BracketMatchDraft[] | undefined,
): void {
  if (!nextRound || !match.slotAId) {
    return;
  }

  const parent = nextRound[Math.floor(match.positionIndex / 2)];
  if (!parent) {
    return;
  }

  if (match.positionIndex % 2 === 0) {
    parent.slotAId = match.slotAId;
    return;
  }

  parent.slotBId = match.slotAId;
}

export function defaultRatingForUser(rating: number | undefined): number {
  return rating !== undefined && Number.isFinite(rating) ? rating : DEFAULT_RATING;
}
