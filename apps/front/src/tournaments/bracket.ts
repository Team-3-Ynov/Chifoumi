import type { BracketMatch } from "../api/types.js";

export function roundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) {
    return "Finale";
  }
  if (round === totalRounds - 1) {
    return "Demi-finales";
  }
  if (round === totalRounds - 2) {
    return "Quarts de finale";
  }
  return `Tour ${round}`;
}

/**
 * The API does not flag byes. A bye only happens in round 1, where the best seeds
 * face an empty slot and auto-qualify. In later rounds a single filled slot just means
 * the opponent is not decided yet, so it must not be treated as a bye.
 */
export function isByeMatch(match: BracketMatch, round: number): boolean {
  return round === 1 && (match.slotA === null) !== (match.slotB === null);
}

/**
 * The current player can play a match when the game is ready (a real match id exists),
 * it has no winner yet, and the player is one of the two slots. A bye has no match id,
 * so it is excluded by the match id check.
 */
export function canCurrentPlayerPlay(
  match: BracketMatch,
  currentUserId: string | undefined,
): boolean {
  if (!currentUserId || match.matchId === null || match.winnerSlot !== null) {
    return false;
  }
  return match.slotA?.userId === currentUserId || match.slotB?.userId === currentUserId;
}
