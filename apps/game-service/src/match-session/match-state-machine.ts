import {
  emptyRoundPlays,
  MAX_ROUNDS,
  type MatchEndReason,
  type MatchState,
  type MatchStatus,
  ROUND_DEADLINE_MS,
  WINS_TO_END,
} from "./match-session.types.js";

export class InvalidMatchTransitionError extends Error {
  constructor(from: MatchStatus, event: string) {
    super(`Invalid match transition from ${from} on ${event}`);
    this.name = "InvalidMatchTransitionError";
  }
}

export type MatchStateMachineEvent =
  | { type: "PLAYS_RECEIVED" }
  | { type: "ROUND_RESOLVED"; winner: "A" | "B" | "DRAW"; now: Date }
  | { type: "TIMEOUT"; silentPlayer: "A" | "B" | "BOTH"; now: Date };

export function transitionMatchState(state: MatchState, event: MatchStateMachineEvent): MatchState {
  if (state.status === "ENDED") {
    throw new InvalidMatchTransitionError(state.status, event.type);
  }

  if (event.type === "PLAYS_RECEIVED") {
    if (state.status !== "WAITING_PLAYS") {
      throw new InvalidMatchTransitionError(state.status, event.type);
    }
    return { ...state, status: "RESOLVING" };
  }

  if (event.type === "ROUND_RESOLVED") {
    if (state.status !== "RESOLVING") {
      throw new InvalidMatchTransitionError(state.status, event.type);
    }
    return resolveRound(state, event.winner, event.now);
  }

  if (event.type === "TIMEOUT") {
    if (state.status !== "WAITING_PLAYS") {
      throw new InvalidMatchTransitionError(state.status, event.type);
    }
    if (event.silentPlayer === "BOTH") {
      return endMatch(state, null, "FORFEIT_TIMEOUT");
    }

    const winnerIndex = event.silentPlayer === "A" ? 1 : 0;
    return endMatch(state, state.players[winnerIndex].userId, "FORFEIT_TIMEOUT");
  }

  return assertNever(event);
}

function resolveRound(state: MatchState, winner: "A" | "B" | "DRAW", now: Date): MatchState {
  const scoreA = state.scoreA + (winner === "A" ? 1 : 0);
  const scoreB = state.scoreB + (winner === "B" ? 1 : 0);

  if (scoreA === WINS_TO_END || scoreB === WINS_TO_END) {
    const winnerId = scoreA === WINS_TO_END ? state.players[0].userId : state.players[1].userId;
    return endMatch({ ...state, scoreA, scoreB }, winnerId, "BEST_OF_3");
  }

  if (state.currentRound >= MAX_ROUNDS) {
    return endMatch({ ...state, scoreA, scoreB }, null, "MAX_ROUNDS_DRAW");
  }

  return {
    ...state,
    scoreA,
    scoreB,
    status: "WAITING_PLAYS",
    currentRound: state.currentRound + 1,
    roundDeadline: new Date(now.getTime() + ROUND_DEADLINE_MS).toISOString(),
    roundPlays: emptyRoundPlays(),
  };
}

function endMatch(
  state: MatchState,
  winnerId: string | null,
  endReason: MatchEndReason,
): MatchState {
  return {
    ...state,
    status: "ENDED",
    winnerId: winnerId ?? undefined,
    endReason,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected match event: ${JSON.stringify(value)}`);
}
