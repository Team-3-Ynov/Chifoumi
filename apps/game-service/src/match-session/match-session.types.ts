export const MATCH_SESSION_TTL_SECONDS = 3600;
export const MATCH_LOCK_TTL_SECONDS = 2;
export const ROUND_DEADLINE_MS = 5_000;
export const MAX_ROUNDS = 5;
export const WINS_TO_END = 2;

export type MatchStatus =
  | "WAITING_PLAYS"
  | "WAITING_COMMITS"
  | "WAITING_REVEALS"
  | "RESOLVING"
  | "ENDED";

export type Move = "rock" | "paper" | "scissors";

export type MatchPlayer = {
  userId: string;
  displayName: string;
  rating: number;
};

export type MatchEndReason = "BEST_OF_3" | "FORFEIT_TIMEOUT" | "MAX_ROUNDS_DRAW";

export type RoundPlays = {
  a: Move | null;
  b: Move | null;
};

export type RoundCommits = {
  a: string | null;
  b: string | null;
};

export type RoundReveals = {
  a: Move | null;
  b: Move | null;
};

export type ResolvedRound = {
  roundNumber: number;
  moveA: Move | null;
  moveB: Move | null;
  winner: "a" | "b" | "draw";
  resolvedAt: string;
};

export type MatchState = {
  matchId: string;
  players: [MatchPlayer, MatchPlayer];
  scoreA: number;
  scoreB: number;
  currentRound: number;
  status: MatchStatus;
  startedAt: string;
  roundDeadline: string;
  roundPlays: RoundPlays;
  roundCommits?: RoundCommits;
  roundReveals?: RoundReveals;
  revealDeadline?: string;
  rounds?: ResolvedRound[];
  winnerId?: string;
  endReason?: MatchEndReason;
};

export type MatchFoundPayload = {
  matchId: string;
  opponent: {
    userId: string;
    displayName: string;
    rating: number;
  };
  bestOf: 3;
};

export type RoundStartPayload = {
  matchId: string;
  roundNumber: number;
  deadline: string;
};

export type RoundResolvedPayload = {
  matchId: string;
  roundNumber: number;
  yourMove: Move;
  theirMove: Move;
  winner: "a" | "b" | "draw";
  scoreA: number;
  scoreB: number;
};

export type MatchEndedPayload = {
  matchId: string;
  winner: string | null;
  finalScore: { a: number; b: number };
  eloDelta: { a: number; b: number };
  reason?: MatchEndReason;
};

export type MatchSessionEventPayloads = {
  matchFound: MatchFoundPayload;
  roundStart: RoundStartPayload;
  roundResolved: RoundResolvedPayload;
  matchEnded: MatchEndedPayload;
};

export type MatchSessionEvent = keyof MatchSessionEventPayloads;

export function matchStateKey(matchId: string): string {
  return `match:${matchId}:state`;
}

export function matchLockKey(matchId: string): string {
  return `match:${matchId}:lock`;
}

export function matchChannel(matchId: string): string {
  return `match:${matchId}`;
}

export function userMatchKey(userId: string): string {
  return `match:byUser:${userId}`;
}

export function playerIndex(state: MatchState, userId: string): 0 | 1 | null {
  if (state.players[0].userId === userId) {
    return 0;
  }
  if (state.players[1].userId === userId) {
    return 1;
  }
  return null;
}

export function emptyRoundPlays(): RoundPlays {
  return { a: null, b: null };
}

export function emptyRoundCommits(): RoundCommits {
  return { a: null, b: null };
}

export function emptyRoundReveals(): RoundReveals {
  return { a: null, b: null };
}
