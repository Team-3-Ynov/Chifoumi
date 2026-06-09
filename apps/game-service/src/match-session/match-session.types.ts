export const MATCH_SESSION_TTL_SECONDS = 3600;
export const MATCH_LOCK_TTL_SECONDS = 2;
export const ROUND_DEADLINE_MS = 5_000;

export type MatchStatus = "WAITING_PLAYS" | "RESOLVING" | "ENDED";

export type MatchPlayer = {
  userId: string;
  displayName: string;
  rating: number;
};

export type MatchEndReason = "BEST_OF_3" | "FORFEIT_TIMEOUT";

export type MatchState = {
  matchId: string;
  players: [MatchPlayer, MatchPlayer];
  scoreA: number;
  scoreB: number;
  currentRound: number;
  status: MatchStatus;
  startedAt: string;
  roundDeadline: string;
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

export type MatchSessionEventPayloads = {
  matchFound: MatchFoundPayload;
  roundStart: RoundStartPayload;
  matchEnded: {
    matchId: string;
    winnerId: string;
    reason: MatchEndReason;
  };
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
