import {
  type MatchEndReason,
  type MatchState,
  type MatchStatus,
  ROUND_DEADLINE_MS,
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
  | { type: "TIMEOUT"; silentPlayer: "A" | "B"; now: Date };

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
    const winnerIndex = event.silentPlayer === "A" ? 1 : 0;
    return endMatch(state, state.players[winnerIndex].userId, "FORFEIT_TIMEOUT");
  }

  return assertNever(event);
}

function resolveRound(state: MatchState, winner: "A" | "B" | "DRAW", now: Date): MatchState {
  const scoreA = state.scoreA + (winner === "A" ? 1 : 0);
  const scoreB = state.scoreB + (winner === "B" ? 1 : 0);

  if (scoreA === 2 || scoreB === 2) {
    const winnerId = scoreA === 2 ? state.players[0].userId : state.players[1].userId;
    return endMatch({ ...state, scoreA, scoreB }, winnerId, "BEST_OF_3");
  }

  return {
    ...state,
    scoreA,
    scoreB,
    status: "WAITING_PLAYS",
    currentRound: state.currentRound + 1,
    roundDeadline: new Date(now.getTime() + ROUND_DEADLINE_MS).toISOString(),
  };
}

function endMatch(state: MatchState, winnerId: string, endReason: MatchEndReason): MatchState {
  return {
    ...state,
    status: "ENDED",
    winnerId,
    endReason,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected match event: ${JSON.stringify(value)}`);
}
