export const MATCH_DISCONNECT_FORFEIT_QUEUE = "match-disconnect-forfeits";

export const MATCH_DISCONNECT_FORFEIT_JOB_NAME = "match-disconnect-forfeit";

export const MATCH_DISCONNECT_FORFEIT_WINDOW_MS = 10_000;

export const MATCH_DISCONNECT_FORFEIT_JOB_TTL_SECONDS = 60;

export const MATCH_DISCONNECT_FORFEIT_JOB_ATTEMPTS = 5;

export const MATCH_DISCONNECT_FORFEIT_JOB_BACKOFF_MS = 200;

export const MATCH_DISCONNECT_FORFEIT_FAILED_JOBS_RETAINED = 100;

export function matchDisconnectForfeitJobKey(userId: string): string {
  return `match:disconnectForfeit:${userId}`;
}
