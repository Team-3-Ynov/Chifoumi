import { BracketError } from "./bracket-error.js";
import type { Player, SeededPlayer } from "./types.js";

/**
 * Sorts players by rating descending and assigns seeds (1 = best rated).
 * Throws BracketError if fewer than 2 players are provided.
 */
export function seedPlayers(players: Player[]): SeededPlayer[] {
  if (players.length < 2) {
    throw new BracketError(
      "INSUFFICIENT_PLAYERS",
      `Cannot seed ${players.length} player(s). Minimum is 2.`,
    );
  }

  for (const player of players) {
    if (!Number.isFinite(player.rating)) {
      throw new BracketError(
        "INVALID_PLAYER_RATING",
        `Player ${player.id} has an invalid rating: ${player.rating}.`,
      );
    }
  }

  return [...players]
    .sort((a, b) => b.rating - a.rating)
    .map((player, index) => ({ ...player, seed: index + 1 }));
}
