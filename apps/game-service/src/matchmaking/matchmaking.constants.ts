export const MATCHMAKING_QUEUE_KEY = "matchmaking:queue";
export const MATCHMAKING_META_PREFIX = "matchmaking:meta:";
export const MATCHMAKING_LOCK_PREFIX = "matchmaking:lock:";
export const MATCHMAKING_RATE_PREFIX = "matchmaking:rate:";
export const MATCH_BY_USER_PREFIX = "match:byUser:";
export const MATCHMAKING_PAIR_LOCK_PREFIX = "matchmaking:pair-lock:";
export const USER_RATING_PREFIX = "user:rating:";
export const MATCH_STATE_PREFIX = "match:";
export const MATCH_STATE_SUFFIX = ":state";
export const MATCHMAKING_MATCH_FOUND_CHANNEL = "matchmaking:match-found";

export const MATCHMAKING_LOCK_TTL_SECONDS = 5;
export const MATCHMAKING_PAIR_LOCK_TTL_SECONDS = 5;
export const MATCH_BY_USER_TTL_SECONDS = 3600;
export const MATCH_STATE_TTL_SECONDS = 3600;
export const MATCHMAKING_RATE_LIMIT_TTL_SECONDS = 1;
export const MATCHMAKING_WORKER_INTERVAL_MS = 500;
export const DEFAULT_RATING = 1000;
export const BEST_OF = 3;

export type QueueMemberMeta = {
  userId: string;
  rating: number;
  displayName: string;
  queuedAt: number;
};

export type MatchFoundPayload = {
  matchId: string;
  opponent: { displayName: string; rating: number };
  bestOf: number;
};

export type MatchFoundEvent = {
  userId: string;
  payload: MatchFoundPayload;
  queuedAt: number;
};

export function matchmakingMetaKey(userId: string): string {
  return `${MATCHMAKING_META_PREFIX}${userId}`;
}

export function matchByUserKey(userId: string): string {
  return `${MATCH_BY_USER_PREFIX}${userId}`;
}

export function matchmakingPairLockKey(userA: string, userB: string): string {
  const [first, second] = userA < userB ? [userA, userB] : [userB, userA];
  return `${MATCHMAKING_PAIR_LOCK_PREFIX}${first}:${second}`;
}

export function matchStateKey(matchId: string): string {
  return `${MATCH_STATE_PREFIX}${matchId}${MATCH_STATE_SUFFIX}`;
}
