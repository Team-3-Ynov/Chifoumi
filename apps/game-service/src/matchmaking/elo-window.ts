const TEN_SECONDS_MS = 10_000;
const THIRTY_SECONDS_MS = 30_000;
const SIXTY_SECONDS_MS = 60_000;

export function getEloWindow(elapsedMs: number): number {
  if (elapsedMs < TEN_SECONDS_MS) {
    return 50;
  }
  if (elapsedMs < THIRTY_SECONDS_MS) {
    return 100;
  }
  if (elapsedMs < SIXTY_SECONDS_MS) {
    return 200;
  }
  return Number.POSITIVE_INFINITY;
}

export function ratingsMatch(
  ratingA: number,
  ratingB: number,
  windowA: number,
  windowB: number,
): boolean {
  const diff = Math.abs(ratingA - ratingB);
  const allowedWindow = Math.max(windowA, windowB);
  if (!Number.isFinite(allowedWindow)) {
    return true;
  }
  return diff <= allowedWindow;
}
