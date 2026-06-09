export const VALID_MOVES = ["rock", "paper", "scissors"] as const;

export type Move = (typeof VALID_MOVES)[number];

export type RoundWinner = "A" | "B" | "DRAW";

export function isValidMove(value: string): value is Move {
  return (VALID_MOVES as readonly string[]).includes(value);
}

export function resolveRound(moveA: Move, moveB: Move): RoundWinner {
  if (moveA === moveB) {
    return "DRAW";
  }

  const winsAgainst: Record<Move, Move> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  return winsAgainst[moveA] === moveB ? "A" : "B";
}
