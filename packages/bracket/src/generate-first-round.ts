import { BracketError } from "./bracket-error.js";
import type { BracketMatch, SeededPlayer } from "./types.js";

/**
 * Produces round-1 matchups using standard seeding: seed 1 vs seed N,
 * seed 2 vs seed N-1, etc. Best seeds receive a bye (null opponent) when
 * the number of registered players is less than bracketSize.
 *
 * @param seededPlayers - Players already seeded via seedPlayers()
 * @param bracketSize   - Must be a power of 2 >= seededPlayers.length
 */
export function generateFirstRound(
  seededPlayers: SeededPlayer[],
  bracketSize: number,
): BracketMatch[] {
  if (bracketSize < 2 || !isPowerOfTwo(bracketSize)) {
    throw new BracketError(
      "INVALID_BRACKET_SIZE",
      `bracketSize must be a power of 2 >= 2, got ${bracketSize}.`,
    );
  }

  if (seededPlayers.length > bracketSize) {
    throw new BracketError(
      "PLAYERS_EXCEED_BRACKET_SIZE",
      `${seededPlayers.length} players exceed bracketSize of ${bracketSize}.`,
    );
  }

  const slots: Array<SeededPlayer | null> = Array.from(
    { length: bracketSize },
    (_, i) => seededPlayers[i] ?? null,
  );

  const matches: BracketMatch[] = [];
  const halfSize = bracketSize / 2;

  for (let i = 0; i < halfSize; i++) {
    const player1 = slots[i] ?? null;
    const player2 = slots[bracketSize - 1 - i] ?? null;

    if (player1 === null) {
      continue;
    }

    matches.push({ player1, player2 });
  }

  return matches;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}
