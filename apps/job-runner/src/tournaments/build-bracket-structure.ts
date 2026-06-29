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
      advanceWinner(match, roundTwo, pairing.player1.id);
      continue;
    }

    roundOnePlayable.push({
      tournamentMatchId: match.id,
      slotAId: pairing.player1.id,
      slotBId: pairing.player2.id,
    });
  }

  advanceUnopposedPlayers(rounds);
  prunePlayableMatchesWithEmptySibling(rounds);

  return {
    matches: rounds.flat(),
    roundOnePlayable,
  };
}

function advanceWinner(
  match: BracketMatchDraft,
  nextRound: BracketMatchDraft[] | undefined,
  winnerId: string,
): void {
  if (!nextRound) {
    return;
  }

  const parent = nextRound[Math.floor(match.positionIndex / 2)];
  if (!parent) {
    return;
  }

  if (match.positionIndex % 2 === 0) {
    parent.slotAId = winnerId;
    return;
  }

  parent.slotBId = winnerId;
}

function advanceUnopposedPlayers(rounds: BracketMatchDraft[][]): void {
  let advanced = true;

  while (advanced) {
    advanced = false;

    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      const currentRound = rounds[roundIndex];
      const nextRound = rounds[roundIndex + 1];
      if (!currentRound) {
        continue;
      }

      for (const match of currentRound) {
        if (match.winnerSlot !== null) {
          continue;
        }

        const hasSlotA = match.slotAId !== null;
        const hasSlotB = match.slotBId !== null;
        if (hasSlotA === hasSlotB) {
          continue;
        }

        const missingSlot = hasSlotA ? WinnerSlot.b : WinnerSlot.a;
        if (hasPendingFeeder(rounds, roundIndex, match.positionIndex, missingSlot)) {
          continue;
        }

        match.winnerSlot = hasSlotA ? WinnerSlot.a : WinnerSlot.b;
        const winnerId = hasSlotA ? match.slotAId : match.slotBId;
        if (winnerId) {
          advanceWinner(match, nextRound, winnerId);
        }
        advanced = true;
      }
    }
  }
}

function hasPendingFeeder(
  rounds: BracketMatchDraft[][],
  roundIndex: number,
  positionIndex: number,
  slot: WinnerSlot,
): boolean {
  const previousRound = rounds[roundIndex - 1];
  if (!previousRound) {
    return false;
  }

  const feederPosition = positionIndex * 2 + (slot === WinnerSlot.a ? 0 : 1);
  const feeder = previousRound[feederPosition];
  return feeder ? !isBranchEmpty(rounds, roundIndex - 1, feeder.positionIndex) : false;
}

function prunePlayableMatchesWithEmptySibling(rounds: BracketMatchDraft[][]): void {
  for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex++) {
    const currentRound = rounds[roundIndex];
    if (!currentRound) {
      continue;
    }

    for (const match of currentRound) {
      if (match.nextMatchId === null || match.winnerSlot !== null) {
        continue;
      }

      if (match.slotAId === null || match.slotBId === null) {
        continue;
      }

      const siblingPosition =
        match.positionIndex % 2 === 0 ? match.positionIndex + 1 : match.positionIndex - 1;
      if (isBranchEmpty(rounds, roundIndex, siblingPosition)) {
        match.nextMatchId = null;
      }
    }
  }
}

function isBranchEmpty(
  rounds: BracketMatchDraft[][],
  roundIndex: number,
  positionIndex: number,
): boolean {
  const match = rounds[roundIndex]?.[positionIndex];
  if (!match) {
    return true;
  }

  if (match.slotAId !== null || match.slotBId !== null) {
    return false;
  }

  if (roundIndex === 0) {
    return true;
  }

  return (
    isBranchEmpty(rounds, roundIndex - 1, positionIndex * 2) &&
    isBranchEmpty(rounds, roundIndex - 1, positionIndex * 2 + 1)
  );
}

export function defaultRatingForUser(rating: number | undefined): number {
  return rating !== undefined && Number.isFinite(rating) ? rating : DEFAULT_RATING;
}
