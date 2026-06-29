import type { Move, RoundWinner } from "@chifoumi/db";

export type MatchEndedPlayer = {
  userId: string;
  displayName: string;
  rating: number;
};

export type MatchEndedRound = {
  roundNumber: number;
  moveA: Move | null;
  moveB: Move | null;
  winner: RoundWinner;
  resolvedAt: string;
};

export type MatchEndedPayload = {
  matchId: string;
  players: [MatchEndedPlayer, MatchEndedPlayer];
  rounds: MatchEndedRound[];
  winner: string | null;
  finalScore: { a: number; b: number };
  startedAt: string;
  tournamentMatchId?: string;
};
