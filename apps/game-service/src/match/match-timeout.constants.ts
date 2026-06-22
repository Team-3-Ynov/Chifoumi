import { MATCH_SESSION_TTL_SECONDS } from "../match-session/match-session.types.js";

export const MATCH_TIMEOUT_QUEUE = "match-timeouts";

export const MATCH_TIMEOUT_JOB_NAME = "round-timeout";

export const MATCH_TIMEOUT_JOB_TTL_SECONDS = MATCH_SESSION_TTL_SECONDS;

export function matchTimeoutJobKey(matchId: string): string {
  return `match:${matchId}:timeoutJob`;
}
